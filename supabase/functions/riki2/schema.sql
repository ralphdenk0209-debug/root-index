-- Riki 2 im Schatten (31.10.2026, Ralph jaja). Liest dieselben Scans wie Riki, schreibt NUR in eigene Tabellen.
-- Produkte, Scores, Freigabe werden nicht beruehrt. Ersetzt Riki erst nach gemessenem Vergleich.
-- Angewendet als Migration riki2_schatten_v1_20261031. Diese Datei ist die Ablage im Repo.

create table if not exists shadow_v1.riki2_config (
  schluessel text primary key,
  wert text not null,
  notiz text
);
insert into shadow_v1.riki2_config(schluessel, wert, notiz) values
  ('an', 'ja', 'Schalter fuer den Takt. nein = Riki 2 ruht.'),
  ('tagesdeckel_usd', '1.0', 'Ralph jaja 31.10.: eigener Deckel 1 $/Tag fuer Riki 2 (nur Fotolesung kostet).'),
  ('modell', 'claude-sonnet-5-5', 'Fotolesung. Riki liest mit claude-sonnet-4-6.'),
  ('pro_takt', '3', 'Laeufe je Aufruf der Edge Function.'),
  ('fenster_stunden', '24', 'Nur Scans dieser Frist werden eingereiht.')
on conflict (schluessel) do nothing;

create table if not exists shadow_v1.riki2_lauf (
  lauf_id bigserial primary key,
  eingang text not null check (eingang in ('foto','ean')),
  job_id bigint,
  scan_eintrag_id bigint,
  ean text not null,
  produkt_id text,
  status text not null default 'offen' check (status in ('offen','laeuft','fertig','fehler','uebersprungen')),
  versuche int not null default 0,
  erstellt_am timestamptz not null default now(),
  gestartet_am timestamptz,
  beendet_am timestamptz,
  dauer_ms int,
  ergebnis jsonb,
  kosten_usd numeric not null default 0,
  modell text,
  version text,
  fehler text
);
create unique index if not exists riki2_lauf_foto_uq on shadow_v1.riki2_lauf(job_id) where eingang = 'foto';
create unique index if not exists riki2_lauf_ean_uq on shadow_v1.riki2_lauf(ean) where eingang = 'ean';
create index if not exists riki2_lauf_offen_ix on shadow_v1.riki2_lauf(status, erstellt_am);

create table if not exists shadow_v1.riki2_quelle (
  id bigserial primary key,
  lauf_id bigint not null references shadow_v1.riki2_lauf(lauf_id) on delete cascade,
  quelle text not null,
  url text,
  http int,
  ergebnis text not null,          -- treffer | gesperrt | leer | nicht_gefunden | ean_falsch | fehler
  ean_beweis text,                 -- woran der Barcode belegt ist, sonst null
  name text,
  marke text,
  zutaten_text text,
  naehrwerte jsonb,
  befunde jsonb,
  dauer_ms int,
  am timestamptz not null default now()
);
create index if not exists riki2_quelle_lauf_ix on shadow_v1.riki2_quelle(lauf_id);

alter table shadow_v1.riki2_config enable row level security;
alter table shadow_v1.riki2_lauf enable row level security;
alter table shadow_v1.riki2_quelle enable row level security;

-- Kosten heute (eigener Deckel)
create or replace function shadow_v1._riki2_kosten_heute()
returns numeric language sql stable set search_path = shadow_v1, public as $$
  select coalesce(sum(kosten_usd), 0) from shadow_v1.riki2_lauf
  where beendet_am >= date_trunc('day', now());
$$;

-- Neue Scans einreihen (Foto-Jobs und reine Barcode-Scans)
create or replace function shadow_v1.cb_riki2_einreihen()
returns int language plpgsql security definer set search_path = shadow_v1, public as $$
declare v_h int := coalesce((select wert::int from shadow_v1.riki2_config where schluessel='fenster_stunden'), 24);
        n1 int; n2 int;
begin
  insert into shadow_v1.riki2_lauf(eingang, job_id, scan_eintrag_id, ean, produkt_id)
  select 'foto', j.job_id, j.scan_eintrag_id, regexp_replace(coalesce(s."EAN",''),'\D','','g'), j.produkt_id
  from shadow_v1.riki_scan_job j
  join public."Scan_Warteschlange" s on s."Eintrag_ID" = j.scan_eintrag_id
  where j.erstellt_am > now() - make_interval(hours => v_h)
    and not exists (select 1 from shadow_v1.riki2_lauf l where l.eingang='foto' and l.job_id=j.job_id)
  on conflict do nothing;
  get diagnostics n1 = row_count;

  insert into shadow_v1.riki2_lauf(eingang, ean, produkt_id)
  select 'ean', c."EAN", c."Produkt_ID"
  from public."Scan_Cache" c
  where c."Erfasst_am" > now() - make_interval(hours => v_h)
    and c."EAN" ~ '^\d{8,14}$'
    and not exists (select 1 from shadow_v1.riki2_lauf l where l.eingang='ean' and l.ean=c."EAN")
  on conflict do nothing;
  get diagnostics n2 = row_count;

  -- Haenger: laeuft > 5 Min -> neu versuchen, nach 3 Versuchen Fehler
  update shadow_v1.riki2_lauf set status = case when versuche >= 3 then 'fehler' else 'offen' end,
         fehler = coalesce(fehler, 'Haenger: laeuft > 5 Min')
  where status = 'laeuft' and gestartet_am < now() - interval '5 minutes';
  return n1 + n2;
end $$;

-- Auftraege holen (nur Service)
create or replace function public.cb_riki2_claim(p_max int default 3)
returns jsonb language plpgsql security definer set search_path = shadow_v1, public as $$
declare v jsonb := '[]'::jsonb; r record;
        v_rest numeric := coalesce((select wert::numeric from shadow_v1.riki2_config where schluessel='tagesdeckel_usd'),0) - shadow_v1._riki2_kosten_heute();
        v_modell text := (select wert from shadow_v1.riki2_config where schluessel='modell');
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Nur Service.'; end if;
  for r in
    select l.* from shadow_v1.riki2_lauf l
    where l.status='offen' order by l.erstellt_am, l.lauf_id
    limit greatest(1, least(p_max, 6)) for update skip locked
  loop
    update shadow_v1.riki2_lauf set status='laeuft', versuche=versuche+1, gestartet_am=now() where lauf_id=r.lauf_id;
    v := v || jsonb_build_array(jsonb_build_object(
      'lauf_id', r.lauf_id, 'eingang', r.eingang, 'ean', r.ean, 'job_id', r.job_id, 'produkt_id', r.produkt_id,
      'fotos', case when r.eingang='foto' then (
          select coalesce(s."Fotos_Base64", '[]'::jsonb) || case when s."Foto_Base64" is not null then jsonb_build_array(s."Foto_Base64") else '[]'::jsonb end
          from public."Scan_Warteschlange" s where s."Eintrag_ID" = r.scan_eintrag_id) end));
  end loop;
  return jsonb_build_object('laeufe', v, 'budget_rest_usd', v_rest, 'modell', v_modell);
end $$;

-- Ergebnis ablegen (nur Service). Bucht Kosten auch in Riki_Nutzung (Monatslimit gilt gemeinsam).
create or replace function public.cb_riki2_ablegen(p_lauf_id bigint, p jsonb)
returns jsonb language plpgsql security definer set search_path = shadow_v1, public as $$
declare q jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Nur Service.'; end if;
  update shadow_v1.riki2_lauf set
    status = coalesce(p->>'status', 'fertig'),
    beendet_am = now(),
    dauer_ms = (p->>'dauer_ms')::int,
    ergebnis = p->'ergebnis',
    kosten_usd = coalesce((p->>'kosten_usd')::numeric, 0),
    modell = p->>'modell',
    version = p->>'version',
    fehler = p->>'fehler'
  where lauf_id = p_lauf_id;
  delete from shadow_v1.riki2_quelle where lauf_id = p_lauf_id;
  for q in select x from jsonb_array_elements(coalesce(p->'quellen','[]'::jsonb)) x loop
    insert into shadow_v1.riki2_quelle(lauf_id, quelle, url, http, ergebnis, ean_beweis, name, marke, zutaten_text, naehrwerte, befunde, dauer_ms)
    values (p_lauf_id, q->>'quelle', q->>'url', (q->>'http')::int, coalesce(q->>'ergebnis','fehler'), q->>'ean_beweis',
            q->>'name', q->>'marke', q->>'zutaten_text', q->'naehrwerte', q->'befunde', (q->>'dauer_ms')::int);
  end loop;
  if coalesce((p->>'kosten_usd')::numeric, 0) > 0 then
    insert into public."Riki_Nutzung"(akteur, modus, modell, input_token, output_token, kosten_usd, produkt_id, erfolg, fehler, dauer_ms)
    values (null, 'riki2-etikett', p->>'modell', coalesce((p->>'in')::int,0), coalesce((p->>'out')::int,0),
            (p->>'kosten_usd')::numeric, (select produkt_id from shadow_v1.riki2_lauf where lauf_id=p_lauf_id),
            coalesce(p->>'status','fertig') = 'fertig', p->>'fehler', (p->>'dauer_ms')::int);
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cb_riki2_claim(int) from public, anon, authenticated;
revoke all on function public.cb_riki2_ablegen(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.cb_riki2_claim(int) to service_role;
grant execute on function public.cb_riki2_ablegen(bigint, jsonb) to service_role;

-- Takt: einreihen, dann Edge Function asynchron anstossen (pg_net)
create or replace function public.cb_riki2_takt()
returns text language plpgsql security definer set search_path = shadow_v1, public, extensions as $$
declare v_neu int; v_offen int; v_key text; v_n int;
begin
  if coalesce((select wert from shadow_v1.riki2_config where schluessel='an'),'nein') <> 'ja' then return 'aus'; end if;
  v_neu := shadow_v1.cb_riki2_einreihen();
  select count(*) into v_offen from shadow_v1.riki2_lauf where status='offen';
  if v_offen = 0 then return 'neu '||v_neu||', nichts offen'; end if;
  -- derselbe oeffentliche Anon-Schluessel wie cb_riki_scan_worker_takt (kein Geheimnis; die Funktion prueft selbst)
  v_key := substring(pg_get_functiondef('public.cb_riki_scan_worker_takt()'::regprocedure) from 'Bearer (eyJ[A-Za-z0-9._-]+)');
  v_n := coalesce((select wert::int from shadow_v1.riki2_config where schluessel='pro_takt'), 3);
  perform net.http_post(
    url := 'https://haurbpfkfaaehorirzee.supabase.co/functions/v1/riki2',
    headers := jsonb_build_object('Authorization', 'Bearer '||v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('max', v_n),
    timeout_milliseconds := 150000);
  return 'neu '||v_neu||', offen '||v_offen||', angestossen';
end $$;
revoke all on function public.cb_riki2_takt() from public, anon, authenticated;

-- Vergleich Riki gegen Riki 2 je Lauf
create or replace view shadow_v1.v_riki2_vergleich as
with b as (
  select l.lauf_id, l.eingang, l.ean, l.status, l.erstellt_am, l.dauer_ms, l.kosten_usd, l.modell, l.fehler,
         coalesce(l.produkt_id, (select p."Produkt_ID" from public."Produkte" p where p."EAN_GTIN" = l.ean order by p."Erstellt_am" limit 1)) pid,
         l.ergebnis e,
         (select extract(epoch from (j.beendet_am - j.erstellt_am)) from shadow_v1.riki_scan_job j where j.job_id = l.job_id) riki_s
  from shadow_v1.riki2_lauf l
)
select b.lauf_id, b.eingang, b.ean, b.status, b.erstellt_am, b.pid produkt_id,
       p."Produktname" riki_name, b.e->>'name' riki2_name,
       p."Marke" riki_marke, b.e->>'marke' riki2_marke,
       zr."Zutatenliste_Rohtext" riki_zutaten, b.e->>'zutaten_text' riki2_zutaten, b.e->>'zutaten_quelle' riki2_zutaten_quelle,
       nm."kcal_100g_ml" riki_kcal, (b.e->'naehrwerte'->>'kcal')::numeric riki2_kcal,
       nm."Salz_g_100g_ml" riki_salz, (b.e->'naehrwerte'->>'salz')::numeric riki2_salz,
       round(public.similarity(lower(coalesce(p."Produktname",'')), lower(coalesce(b.e->>'name','')))::numeric, 2) name_aehnlich,
       round(public.similarity(lower(coalesce(zr."Zutatenliste_Rohtext",'')), lower(coalesce(b.e->>'zutaten_text','')))::numeric, 2) zutaten_aehnlich,
       case
         when b.status <> 'fertig' then b.status
         when b.pid is null and coalesce((b.e->>'vollstaendig')::boolean,false) then 'nur_riki2'
         when b.pid is null then 'beide_leer'
         when zr."Zutatenliste_Rohtext" is null and b.e->>'zutaten_text' is not null then 'nur_riki2_zutaten'
         when zr."Zutatenliste_Rohtext" is not null and b.e->>'zutaten_text' is null then 'nur_riki_zutaten'
         when nm."kcal_100g_ml" is not null and (b.e->'naehrwerte'->>'kcal') is null then 'nur_riki_naehrwerte'
         when nm."kcal_100g_ml" is null and (b.e->'naehrwerte'->>'kcal') is not null then 'nur_riki2_naehrwerte'
         when public.similarity(lower(coalesce(zr."Zutatenliste_Rohtext",'')), lower(coalesce(b.e->>'zutaten_text',''))) >= 0.85
              and (nm."kcal_100g_ml" is null
                   or abs(nm."kcal_100g_ml" - (b.e->'naehrwerte'->>'kcal')::numeric) <= greatest(5, nm."kcal_100g_ml"*0.05)) then 'gleich'
         else 'abweichend'
       end urteil,
       b.e->'fehlt' riki2_fehlt, b.e->'befunde' riki2_befunde,
       round(b.riki_s::numeric, 1) riki_s, round(b.dauer_ms/1000.0, 1) riki2_s, b.kosten_usd riki2_usd, b.modell, b.fehler
from b
left join public."Produkte" p on p."Produkt_ID" = b.pid
left join lateral (select z."Zutatenliste_Rohtext" from public."Zutaten_Rohtext" z
                   where z."Produkt_ID" = b.pid and z."Ersetzt_Am" is null order by z."Erfasst_Am" desc limit 1) zr on true
left join public."Naehrwerte_Makro" nm on nm."Produkt_ID" = b.pid;

comment on view shadow_v1.v_riki2_vergleich is 'Riki 2 im Schatten (31.10.2026): je Lauf Riki gegen Riki 2. Abweichungen prueft Claude (Skill riki-pruefer).';
