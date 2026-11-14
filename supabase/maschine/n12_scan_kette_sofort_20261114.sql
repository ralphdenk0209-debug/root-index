-- N12 Scan-Kette sofort (14.11.2026, Ralph „jaja, so bauen“):
-- „die wächter müssen ALLE laufen, wenn ein scan kommt, sonst können sie pausieren, es sei denn, wir importieren“.
-- Gemessen vorher (30 Tage, 94 Foto-Scans): nur 24 bekamen den Index sofort, die übrigen warteten im Mittel 25 Min.
-- 1) Ballaststoff-Regel für ALLE Quellen (Fall Cashew-Aufstrich P96671, Werte von OFF statt Foto).
-- 2) Scan-Kette je Produkt: Zusatzstoffe, Lücken füllen (gratis), Referenz, Score, Freigabe – sofort.
-- 3) Takte: scan-kette alle 2 s, scan-neu-sofort alle 5 s (Barcode ohne Foto), Zutaten-Stapel 5 s,
--    Index melden 10 s; luecke-sofort (1 Min.) aufgegangen in scan-kette.
-- 4) Bestand-Takte machen Platz, solange ein Scan läuft; Schalter maschine_schalter (bestand_an/import_an).

-- Sicherungen
create table if not exists shadow_v1._sich_cron_scan_kette_20261114 as select jobid, jobname, schedule, command, active, now() gesichert_am from cron.job;
create table if not exists shadow_v1._sich_nw_ballast_nd_20261114 as
select n."Produkt_ID", n."Ballaststoffe_nicht_deklariert", n."Notizen_Naehrwerte", s."Clean_Score", s."Status"
from public."Naehrwerte_Makro" n left join public."Scores" s using ("Produkt_ID")
where n."Ballaststoffe_g_100g_ml" is null and not coalesce(n."Ballaststoffe_nicht_deklariert",false)
  and n.kcal_100g_ml is not null and n."Fett_g_100g_ml" is not null and n."Ges_Fett_g_100g_ml" is not null
  and n."Kohlenhydrate_g_100g_ml" is not null and n."Zucker_g_100g_ml" is not null
  and n."Protein_g_100g_ml" is not null and n."Salz_g_100g_ml" is not null;

-- 1) Ballaststoff-Regel als Trigger (gilt für Foto, OFF, dm, EDEKA, Hersteller gleich)
create or replace function public.cb_trg_ballast_nicht_deklariert()
returns trigger language plpgsql set search_path to 'public' as $f$
begin
  /* Regel Riki 13.10.2026 (Ralph jaja), für alle Quellen seit 14.11.2026 (Ralph „jaja, so bauen“):
     Nährwerttabelle vollständig (Energie, Fett, ges. Fett, KH, Zucker, Eiweiß, Salz), aber keine
     Ballaststoff-Zeile -> „nicht deklariert“. Ballaststoffe stehen nach LMIV vor Eiweiß und Salz;
     sind die da, war die Stelle der Ballaststoff-Zeile sichtbar. Kommt später ein Wert, gilt der Wert. */
  if new."Ballaststoffe_g_100g_ml" is not null then
    new."Ballaststoffe_nicht_deklariert" := false;
  elsif not coalesce(new."Ballaststoffe_nicht_deklariert",false)
    and new.kcal_100g_ml is not null and new."Fett_g_100g_ml" is not null and new."Ges_Fett_g_100g_ml" is not null
    and new."Kohlenhydrate_g_100g_ml" is not null and new."Zucker_g_100g_ml" is not null
    and new."Protein_g_100g_ml" is not null and new."Salz_g_100g_ml" is not null then
    new."Ballaststoffe_nicht_deklariert" := true;
    new."Notizen_Naehrwerte" := left(concat_ws(' | ', nullif(new."Notizen_Naehrwerte",''),
      to_char(now(),'DD.MM.YYYY')||': Tabelle vollständig ohne Ballaststoff-Zeile – nicht deklariert (Regel 13.10./14.11.).'), 2000);
  end if;
  return new;
end $f$;
drop trigger if exists trg_naehrwerte_ballast_nd on public."Naehrwerte_Makro";
create trigger trg_naehrwerte_ballast_nd before insert or update on public."Naehrwerte_Makro"
  for each row execute function public.cb_trg_ballast_nicht_deklariert();
-- Bestand nachziehen (13 Zeilen am 14.11., Sicherung oben)
update public."Naehrwerte_Makro" n set "Ballaststoffe_nicht_deklariert" = false
 where n."Produkt_ID" in (select "Produkt_ID" from shadow_v1._sich_nw_ballast_nd_20261114);

-- 2) Scan-Kette für EIN Produkt
create or replace function shadow_v1.cb_scan_kette(p_pid text)
returns jsonb language plpgsql security definer set search_path to 'public','shadow_v1','pg_temp' as $f$
declare r jsonb := jsonb_build_object('pid', p_pid); x jsonb; t0 timestamptz := clock_timestamp();
begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  begin r := r || jsonb_build_object('zusatz', shadow_v1.zusatzstoff_achse_ableiten_eins(p_pid));
  exception when others then r := r || jsonb_build_object('zusatz_fehler', left(sqlerrm,200)); end;
  if not coalesce((select s."Score_vollstaendig" from public."Scores" s where s."Produkt_ID"=p_pid), false) then
    begin x := shadow_v1.cb_luecke_sofort_fuellen(p_pid); r := r || jsonb_build_object('luecke', x);
    exception when others then r := r || jsonb_build_object('luecke_fehler', left(sqlerrm,200)); end;
    begin perform shadow_v1.zusatzstoff_achse_ableiten_eins(p_pid); exception when others then null; end;
  end if;
  if exists (select 1 from public."Produkte" p where p."Produkt_ID"=p_pid and p."Produktstatus"='Entwurf') then
    begin x := public.cb_produkt_sofort_durchlauf(p_pid);
      r := r || jsonb_build_object('sofort', jsonb_build_object('freigegeben', x->'freigegeben', 'score_vollstaendig', x->'score_vollstaendig',
                                   'freigabe', x->'freigabe', 'zutaten_stapel', x->'zutaten_stapel'));
    exception when others then r := r || jsonb_build_object('sofort_fehler', left(sqlerrm,200)); end;
  end if;
  return r || (select jsonb_build_object('produktstatus', p."Produktstatus", 'freigabe_status', p."Freigabe_Status",
                 'score', s."Clean_Score", 'score_status', s."Status")
               from public."Produkte" p left join public."Scores" s using ("Produkt_ID") where p."Produkt_ID"=p_pid)
           || jsonb_build_object('ms', round(extract(epoch from clock_timestamp()-t0)*1000));
end $f$;

-- 2a) Takt: gehaltene Foto-Scans sofort durch die Kette (ersetzt luecke-sofort)
create or replace function public.cb_scan_kette_takt()
returns jsonb language plpgsql security definer set search_path to 'public','shadow_v1','pg_temp' as $f$
declare r record; x jsonb; v_liste jsonb := '[]';
begin
  if not pg_try_advisory_xact_lock(hashtext('cb_scan_kette_takt')) then return jsonb_build_object('uebersprungen','laeuft'); end if;
  for r in
    select distinct on (j.produkt_id) j.produkt_id pid
      from shadow_v1.riki_scan_job j
      join public."Produkte" p on p."Produkt_ID" = j.produkt_id and p."Produktstatus" = 'Entwurf'
     where j.status = 'gehalten' and j.beendet_am > now() - interval '3 hours'
       and not (coalesce(j.ergebnis_meta,'{}'::jsonb) ? 'kette')
     order by j.produkt_id, j.beendet_am
     limit 5
  loop
    x := shadow_v1.cb_scan_kette(r.pid);
    update shadow_v1.riki_scan_job
       set ergebnis_meta = coalesce(ergebnis_meta,'{}'::jsonb) || jsonb_build_object('kette', x || jsonb_build_object('am', now()))
                           || case when coalesce(ergebnis_meta,'{}'::jsonb) ? 'luecke_sofort' then '{}'::jsonb
                                   else jsonb_build_object('luecke_sofort', coalesce(x->'luecke', jsonb_build_object('ergebnis','nicht_noetig')) || jsonb_build_object('am', now())) end
     where produkt_id = r.pid and status in ('gehalten','fertig') and beendet_am > now() - interval '3 hours'
       and not (coalesce(ergebnis_meta,'{}'::jsonb) ? 'kette');
    v_liste := v_liste || jsonb_build_array(x);
  end loop;
  return jsonb_build_object('bearbeitet', jsonb_array_length(v_liste), 'liste', v_liste);
end $f$;

-- 2b) Takt: neue Barcode-Scans ohne Produkt sofort (Verknüpfen, aus OFF anlegen, Brücke) statt 5–15 Min.
create table if not exists shadow_v1.scan_sofort_versuch(ean text primary key, am timestamptz not null default now(), ergebnis jsonb);
alter table shadow_v1.scan_sofort_versuch enable row level security;
create or replace function public.cb_scan_neu_sofort_takt()
returns jsonb language plpgsql security definer set search_path to 'public','shadow_v1','pg_temp' as $f$
declare v_eans text[]; r_auto jsonb; r_br jsonb; c record; v_kette jsonb := '[]';
begin
  if not pg_try_advisory_xact_lock(hashtext('cb_scan_neu_sofort_takt')) then return jsonb_build_object('uebersprungen','laeuft'); end if;
  select array_agg(sc."EAN") into v_eans from public."Scan_Cache" sc
   where sc."Erfasst_am" > now() - interval '15 minutes' and sc."Produkt_ID" is null and not coalesce(sc."Geprueft",false)
     and not exists (select 1 from shadow_v1.scan_sofort_versuch v where v.ean = sc."EAN");
  if v_eans is null then return jsonb_build_object('neu',0); end if;
  insert into shadow_v1.scan_sofort_versuch(ean) select unnest(v_eans) on conflict do nothing;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  begin r_auto := shadow_v1.cb_scan_auto_takt(300); exception when others then r_auto := jsonb_build_object('fehler', left(sqlerrm,200)); end;
  begin r_br := shadow_v1.cb_scan_bruecke_takt(4); exception when others then r_br := jsonb_build_object('fehler', left(sqlerrm,200)); end;
  for c in select sc."EAN" ean, sc."Produkt_ID" pid from public."Scan_Cache" sc
            join public."Produkte" p on p."Produkt_ID" = sc."Produkt_ID" and p."Produktstatus" = 'Entwurf'
           where sc."EAN" = any(v_eans) loop
    v_kette := v_kette || jsonb_build_array(shadow_v1.cb_scan_kette(c.pid));
  end loop;
  update shadow_v1.scan_sofort_versuch set ergebnis = jsonb_build_object('auto', r_auto->'neu', 'bruecke', left(r_br::text,300), 'kette', v_kette)
   where ean = any(v_eans);
  return jsonb_build_object('neu', cardinality(v_eans), 'kette', v_kette);
end $f$;

-- 4) Schalter: Bestand macht Platz, solange ein Scan läuft
create table if not exists shadow_v1.maschine_schalter(id int primary key default 1 check (id=1), bestand_an boolean not null default true,
  import_an boolean not null default false, geaendert_am timestamptz not null default now(), notiz text);
alter table shadow_v1.maschine_schalter enable row level security;
insert into shadow_v1.maschine_schalter(id, notiz) values (1, '14.11.2026 Ralph: Bestand-Takte pausieren bei Scan; bestand_an=false pausiert sie ganz, außer import_an') on conflict do nothing;
create or replace function public.cb_scan_laeuft()
returns boolean language sql stable security definer set search_path to 'public','shadow_v1' as $f$
  select exists (select 1 from shadow_v1.riki_scan_job j where j.status in ('offen','laeuft') and j.erstellt_am > now() - interval '10 minutes')
      or exists (select 1 from shadow_v1.riki_scan_job j where j.status = 'gehalten' and j.beendet_am > now() - interval '5 minutes'
                   and not (coalesce(j.ergebnis_meta,'{}'::jsonb) ? 'kette'))
      or exists (select 1 from public."Scan_Cache" sc where sc."Erfasst_am" > now() - interval '2 minutes' and sc."Produkt_ID" is null);
$f$;
create or replace function public.cb_bestand_frei()
returns boolean language sql stable security definer set search_path to 'public','shadow_v1' as $f$
  select coalesce((select s.bestand_an or s.import_an from shadow_v1.maschine_schalter s where s.id = 1), true)
         and not public.cb_scan_laeuft();
$f$;
revoke all on function shadow_v1.cb_scan_kette(text), public.cb_scan_kette_takt(), public.cb_scan_neu_sofort_takt(),
  public.cb_scan_laeuft(), public.cb_bestand_frei() from public, anon, authenticated;

-- 3) Takte
select cron.schedule('scan-kette', '2 seconds', $c$set statement_timeout='110s'; select public.cb_scan_kette_takt();$c$);
select cron.schedule('scan-neu-sofort', '5 seconds', $c$set statement_timeout='200s'; select public.cb_scan_neu_sofort_takt();$c$);
select cron.alter_job(86, schedule := '5 seconds');   -- scan-zutaten-stapel
select cron.alter_job(144, schedule := '10 seconds'); -- riki-index-melden
select cron.alter_job(186, active := false);          -- luecke-sofort: aufgegangen in scan-kette
select cron.alter_job(185, schedule := '* * * * *');  -- riki-off-foto statt alle 10 Min.

-- 4b) Bestand-Takte: laufen nur, wenn kein Scan läuft (und Schalter an)
do $do$
declare j record; n text;
begin
  for j in select jobid, command from cron.job where jobid in (5,22,23,24,25,30,41,42,43,44,46,50,51,119,121,138,139,142,148,154,155,156,194,195) loop
    n := regexp_replace(j.command, '(select\s+(public|shadow_v1)\.[a-z0-9_]+\([^;]*\))(\s*;)?(\s*/\*.*\*/)?\s*$', '\1 where public.cb_bestand_frei();\4', 'i');
    if n = j.command then raise exception 'Bestand-Takt % nicht umgestellt: %', j.jobid, j.command; end if;
    perform cron.alter_job(j.jobid, command := n);
  end loop;
end $do$;
