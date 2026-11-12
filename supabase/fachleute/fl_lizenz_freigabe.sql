-- FL-Lizenz (12.11.2026, Ralph): Klienten-Keys nur mit Freigabe, Preis vorerst nicht zeigen.
-- Ralph wörtlich: „nach der registrierung müssen wir unbedingt unterbinden, das ein key generiert werden kann und der preis
-- für monatliche kosten muss da auch vorerst weg. eher dann der hinweis, das eine lizenz erworben werden kann und sie dazu
-- kontakt mit mir per mail aufnehmen sollen … für petra und die anderen kontakte gilt der 5 euro preis … alle anderen sehen
-- den lizenz hinweis.“ Korrektur Ralph 12.11.: „4,99 haben wir vereinbart für petra“ → Freigabe-Preis 499 Cent.
-- Petra & Kolleginnen: select public.cb_admin_fachperson_freigabe('<mail>', 499, true, '<Name>');
--
-- Was diese Datei tut:
--  1. Tabelle fachperson_freigabe: Freigabe je E-Mail (auch schon vor der Registrierung eintragbar) mit eigenem Key-Preis.
--  2. _fp_keys_erlaubt(auth): Admin (Benutzer.is_admin) oder aktive Freigabe. Ohne das: kein Key (Server, nicht nur Knopf).
--  3. cb_fp_key_anlegen: ohne Freigabe ok=false, lizenz_noetig=true, nichts wird angelegt.
--     cb_fp_key_laufzeit: Verlängern nur mit Freigabe; Kürzen und Beenden bleiben immer möglich.
--  4. Preis: Einstellung preis_anzeigen (nein = Preis für Fachleute ohne Freigabe nicht ausliefern; ja = allgemeinen Preis zeigen).
--     Mit Freigabe gilt key_preis_cent der Freigabe (Konto-Wert fachperson_konto.key_preis_cent geht vor, sonst allgemeiner Preis).
--  5. cb_fp_ich / cb_fp_abrechnung liefern keys_erlaubt, preis_anzeigen, lizenz_kontakt; Preis nur, wenn erlaubt oder freigeschaltet.
--  6. Admin: cb_admin_fachperson_freigabe(email, preis_cent, aktiv, notiz), cb_admin_fachperson_freigaben().
--  7. Nachtrag (Ralph 12.11.): Lizenz sperrt nur bezahlte Funktionen – Keys anlegen/verlängern, Key-Mail,
--     Riki-Rezeptideen (KI-Kosten). „So bewertet Root Index“ bleibt für Freigeschaltete mit Verschwiegenheit offen.
--  8. Admin-Umschalter (Ralph 12.11.): Praxen in lizenz_umschalter_kuerzel (RALPH, RITEST) und Admins dürfen die EIGENE
--     Praxis auf „ohne Lizenz“ stellen (cb_fp_lizenz_testansicht), wirkt serverseitig, nie für andere Fachpersonen.
-- E-Mail-Adressen stehen NIE in dieser Datei (öffentliches Repo). Ralphs Konten (RALPH, RITEST) werden über das Kürzel freigegeben.
-- Rückweg: Sicherung fl-lizenz-rueckweg.sql (Notizordner der FL-Sitzungen).

-- 1) Freigabe je E-Mail ------------------------------------------------------------------------------
create table if not exists public.fachperson_freigabe (
  email          text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  key_preis_cent integer check (key_preis_cent is null or key_preis_cent >= 0),
  aktiv          boolean not null default true,
  notiz          text,
  angelegt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now()
);
comment on table public.fachperson_freigabe is 'FL-Lizenz 12.11.2026: Wer Klienten-Keys anlegen darf (je E-Mail), mit Key-Preis in Cent je Monat; leer = allgemeiner Preis.';
alter table public.fachperson_freigabe enable row level security;
revoke all on public.fachperson_freigabe from public, anon, authenticated;

insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('preis_anzeigen', 'nein', 'FL-Lizenz 12.11.: ja = allgemeinen Key-Preis auch Fachleuten ohne Freigabe zeigen; nein = nur Lizenz-Hinweis'),
  ('lizenz_kontakt', 'kontakt@root-index.de', 'FL-Lizenz 12.11.: Mail-Adresse im Lizenz-Hinweis für Fachleute ohne Freigabe')
on conflict (schluessel) do nothing;

-- Ralphs eigene Konten behalten den Zugang (RALPH ist Admin, RITEST ist sein Testkonto)
insert into public.fachperson_freigabe(email, key_preis_cent, aktiv, notiz)
select lower(btrim(u.email)), null, true, 'Ralphs Konto ' || k.kuerzel || ' (FL-Lizenz 12.11.2026)'
  from public.fachperson_konto k join auth.users u on u.id = k.auth_id
 where k.kuerzel in ('RALPH', 'RITEST') and u.email is not null
on conflict (email) do nothing;

-- Testansicht „ohne Lizenz“ je Praxis (nur über cb_fp_lizenz_testansicht, nur eigene Praxis)
alter table public.fachperson_konto add column if not exists lizenz_testansicht_ohne boolean not null default false;
insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('lizenz_umschalter_kuerzel', 'RALPH,RITEST', 'FL-Lizenz 12.11.: Diese Praxen (und Admins) dürfen ihre eigene Praxis zum Testen auf „ohne Lizenz“ stellen')
on conflict (schluessel) do nothing;

-- 2) Helfer (nicht direkt aufrufbar) -----------------------------------------------------------------
create or replace function public._fp_keys_erlaubt(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public', 'auth' as $$
  select p_auth is not null
     and not coalesce((select k.lizenz_testansicht_ohne from public.fachperson_konto k where k.auth_id = p_auth), false)   -- Testansicht „ohne Lizenz“
     and (
         exists (select 1 from public."Benutzer" b where b.auth_id = p_auth and coalesce(b.is_admin, false))
      or exists (select 1 from public.fachperson_freigabe l join auth.users u on lower(btrim(u.email)) = l.email
                  where u.id = p_auth and l.aktiv));
$$;
revoke all on function public._fp_keys_erlaubt(uuid) from public, anon, authenticated;

create or replace function public._fp_freigabe_preis(p_auth uuid)
returns integer language sql stable security definer set search_path to 'public', 'auth' as $$
  select l.key_preis_cent from public.fachperson_freigabe l join auth.users u on lower(btrim(u.email)) = l.email
   where u.id = p_auth and l.aktiv;
$$;
revoke all on function public._fp_freigabe_preis(uuid) from public, anon, authenticated;

create or replace function public._fp_umschalter_darf(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_auth is not null and (
         exists (select 1 from public."Benutzer" b where b.auth_id = p_auth and coalesce(b.is_admin, false))
      or exists (select 1 from public.fachperson_konto k where k.auth_id = p_auth
                    and k.kuerzel = any (string_to_array(replace(coalesce((select wert from public.fachleute_einstellung
                                                                           where schluessel = 'lizenz_umschalter_kuerzel'), ''), ' ', ''), ','))));
$$;
revoke all on function public._fp_umschalter_darf(uuid) from public, anon, authenticated;

-- Was die Oberfläche über Preis und Lizenz erfahren darf
create or replace function public._fp_preis_info(p_auth uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with e as (select coalesce((select wert from public.fachleute_einstellung where schluessel = 'preis_anzeigen'), 'nein') = 'ja' zeigen,
                    coalesce((select wert::int from public.fachleute_einstellung where schluessel = 'preis_cent'), 0) preis,
                    coalesce((select wert from public.fachleute_einstellung where schluessel = 'abrechnungsmodell'), 'je_key') modell,
                    coalesce((select wert from public.fachleute_einstellung where schluessel = 'abrechnung'), 'monat') art,
                    coalesce((select wert from public.fachleute_einstellung where schluessel = 'lizenz_kontakt'), 'kontakt@root-index.de') kontakt),
       f as (select k.key_preis_cent, k.abrechnungsmodell from public.fachperson_konto k where k.auth_id = p_auth),
       x as (select public._fp_keys_erlaubt(p_auth) erlaubt)
  select jsonb_build_object(
           'keys_erlaubt', x.erlaubt,
           'lizenz_umschalter', public._fp_umschalter_darf(p_auth),
           'lizenz_testansicht_ohne', coalesce((select k.lizenz_testansicht_ohne from public.fachperson_konto k where k.auth_id = p_auth), false),
           'preis_anzeigen', e.zeigen,
           'lizenz_kontakt', e.kontakt,
           'abrechnung', e.art,
           'modell', case when x.erlaubt then coalesce((select abrechnungsmodell from f), e.modell) end,
           'key_preis_cent', case when x.erlaubt then coalesce((select key_preis_cent from f), public._fp_freigabe_preis(p_auth), e.preis)
                                  when e.zeigen then coalesce((select key_preis_cent from f), e.preis) end)
    from e, x;
$$;
revoke all on function public._fp_preis_info(uuid) from public, anon, authenticated;

-- 3) Key anlegen und verlängern nur mit Freigabe -------------------------------------------------------
create or replace function public.cb_fp_key_anlegen(p_tage integer, p_bezeichnung text default null, p_vereinbarung_bestaetigt boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v public.fachperson_konto := public._fp_ich(); v_code text; v_z text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if not public._fp_keys_erlaubt(v.auth_id) then
    return jsonb_build_object('ok',false,'lizenz_noetig',true,
      'grund','Klienten-Keys gibt es mit einer Lizenz für Root Index Pro. Für eine Lizenz bitte per Mail an '
              || coalesce((select wert from public.fachleute_einstellung where schluessel = 'lizenz_kontakt'), 'kontakt@root-index.de') || ' wenden.');
  end if;
  if p_tage is null or p_tage < 1 or p_tage > 730 then return jsonb_build_object('ok',false,'grund','Laufzeit: 1 Tag bis 2 Jahre.'); end if;
  if v.vereinbarung_bestaetigt_am is null then
    if not coalesce(p_vereinbarung_bestaetigt,false) then
      return jsonb_build_object('ok',false,'grund','Bitte zuerst die Vereinbarung zur Verschwiegenheit mit den Klienten bestätigen.','vereinbarung_noetig',true); end if;
    update public.fachperson_konto set vereinbarung_bestaetigt_am = now() where auth_id = v.auth_id;
  end if;
  loop
    v_code := v.kuerzel || '-';
    for i in 1..4 loop v_code := v_code || substr(v_z, 1 + floor(random()*length(v_z))::int, 1); end loop;
    exit when not exists (select 1 from public.gratis_code where code = v_code);
  end loop;
  insert into public.gratis_code(code, tage, max_einloesungen, notiz, fachperson_auth, bezeichnung)
  values (v_code, p_tage, 1, 'Fachperson-Key: ' || v.name, v.auth_id, nullif(left(trim(coalesce(p_bezeichnung,'')),80),''));
  return jsonb_build_object('ok',true,'code',v_code,'link','https://root-index.de/klientin.html?code=' || v_code,'tage',p_tage);
end $function$;

create or replace function public.cb_fp_key_laufzeit(p_code text, p_menge integer, p_einheit text default 'tage')
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_iv interval; v_tage int; v_bis timestamptz;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id for update;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
  if g.beendet_am is not null then return jsonb_build_object('ok',false,'grund','Der Key ist beendet. Bitte einen neuen Key anlegen.'); end if;
  if p_menge is null or p_menge = 0 or abs(p_menge) > 730 then return jsonb_build_object('ok',false,'grund','Bitte eine Anzahl angeben.'); end if;
  -- FL-Lizenz: verlängern nur mit Freigabe (kürzen und beenden bleiben immer möglich)
  if p_menge > 0 and not public._fp_keys_erlaubt(v.auth_id) then
    return jsonb_build_object('ok',false,'lizenz_noetig',true,
      'grund','Verlängern geht mit einer Lizenz für Root Index Pro. Für eine Lizenz bitte per Mail an '
              || coalesce((select wert from public.fachleute_einstellung where schluessel = 'lizenz_kontakt'), 'kontakt@root-index.de') || ' wenden.');
  end if;
  v_iv := case lower(coalesce(p_einheit,'tage'))
            when 'tage' then make_interval(days => p_menge)
            when 'wochen' then make_interval(weeks => p_menge)
            when 'monate' then make_interval(months => p_menge) end;
  if v_iv is null then return jsonb_build_object('ok',false,'grund','Einheit: tage, wochen oder monate.'); end if;
  if g.klient_auth is null then
    -- noch nicht eingeloest: geplante Laufzeit in Tagen aendern
    v_tage := ((current_date + g.tage + v_iv)::date - current_date);
    if v_tage < 1 then return jsonb_build_object('ok',false,'grund','Kürzer als 1 Tag geht nicht. Zum Stoppen „Beenden“ nehmen.'); end if;
    if v_tage > 730 then return jsonb_build_object('ok',false,'grund','Höchstens 2 Jahre.'); end if;
    update public.gratis_code set tage = v_tage where code = g.code;
    return jsonb_build_object('ok',true,'tage',v_tage);
  end if;
  if p_menge > 0 then
    -- abgelaufene Keys laufen ab jetzt wieder - aber nur, wenn der Klient nicht inzwischen bei einer anderen Fachperson ist
    if exists (select 1 from public.gratis_code o where o.klient_auth = g.klient_auth and o.code <> g.code and public._fp_key_laeuft(o)) then
      return jsonb_build_object('ok',false,'grund','Diese Person ist inzwischen mit einer anderen Fachperson verbunden.'); end if;
    v_bis := greatest(g.laeuft_bis, now()) + v_iv;
  else
    if g.laeuft_bis <= now() then return jsonb_build_object('ok',false,'grund','Der Key ist schon abgelaufen.'); end if;
    v_bis := greatest(g.laeuft_bis + v_iv, now());          -- nie vor jetzt: kuerzen bis jetzt = Zugang endet sofort
  end if;
  if v_bis > now() + interval '2 years' then return jsonb_build_object('ok',false,'grund','Höchstens 2 Jahre im Voraus.'); end if;
  update public.gratis_code set laeuft_bis = v_bis where code = g.code;
  return jsonb_build_object('ok',true,'laeuft_bis',v_bis);
end $function$;

-- 4) Abrechnung: Key-Preis aus Konto, sonst aus Freigabe, sonst allgemein --------------------------------
create or replace function public._fp_abrechnung(p_fp uuid, p_monat date)
returns table(fachperson_auth uuid, monat date, keys_aktiv integer, key_tage integer, keys_neu integer, abrechnung text, preis_cent integer, betrag_cent integer, lizenz_art text, lizenz_preis_cent integer, lizenz_intervall text, lizenz_bis timestamp with time zone, modell text, keys_betrag_cent integer, lizenz_betrag_cent integer)
language sql stable security definer set search_path to 'public' as $function$
  with m as (select date_trunc('month', coalesce(p_monat, (now() at time zone 'Europe/Berlin')::date))::date monat),
  e as (select coalesce((select wert from public.fachleute_einstellung where schluessel='abrechnung'),'monat') art,
               coalesce((select wert::int from public.fachleute_einstellung where schluessel='preis_cent'),0) preis,
               coalesce((select wert from public.fachleute_einstellung where schluessel='abrechnungsmodell'),'je_key') modell),
  k as (
    select g.fachperson_auth, g.start_am,
           public._fp_key_tage(g.start_am, least(g.laeuft_bis, coalesce(g.beendet_am, g.laeuft_bis), now()), m.monat) tage
      from public.gratis_code g, m
     where g.fachperson_auth is not null and g.start_am is not null
       and (p_fp is null or g.fachperson_auth = p_fp)),
  z as (
    select f.auth_id, m.monat,
           count(k.tage) filter (where k.tage > 0)::int aktiv,
           coalesce(sum(k.tage),0)::int tage,
           count(k.start_am) filter (where date_trunc('month', k.start_am at time zone 'Europe/Berlin')::date = m.monat)::int neu
      from public.fachperson_konto f cross join m
      left join k on k.fachperson_auth = f.auth_id
     where (p_fp is null or f.auth_id = p_fp)
     group by f.auth_id, m.monat),
  b as (
    select z.*, f.lizenz_art, f.lizenz_preis_cent, f.lizenz_intervall, f.lizenz_bis, e.art,
           coalesce(f.key_preis_cent, public._fp_freigabe_preis(f.auth_id), e.preis) kp,   -- FL-Lizenz: Preis der Freigabe
           coalesce(f.abrechnungsmodell, e.modell) mo,
           case when f.lizenz_art = 'lizenz_bezahlt' and coalesce(f.lizenz_preis_cent,0) > 0
                     and (f.lizenz_bis is null or f.lizenz_bis >= z.monat)
                     and f.seit < (z.monat + interval '1 month')
                     and (coalesce(f.lizenz_intervall,'monat') = 'monat'
                          or extract(month from f.seit at time zone 'Europe/Berlin') = extract(month from z.monat))
                then f.lizenz_preis_cent else 0 end lz
      from z cross join e join public.fachperson_konto f on f.auth_id = z.auth_id),
  c as (
    select b.*, case when b.art = 'tag'
                     then round(b.tage * b.kp::numeric / extract(day from (b.monat + interval '1 month' - interval '1 day')))::int
                     else b.aktiv * b.kp end kb
      from b)
  select c.auth_id, c.monat, c.aktiv, c.tage, c.neu, c.art, c.kp,
         case c.mo when 'gratis' then 0 when 'je_key' then c.kb when 'lizenz_pauschal' then c.lz else c.lz + c.kb end,
         c.lizenz_art, c.lizenz_preis_cent, c.lizenz_intervall, c.lizenz_bis,
         c.mo,
         case when c.mo in ('je_key','lizenz_plus_keys') then c.kb else 0 end,
         case when c.mo in ('lizenz_pauschal','lizenz_plus_keys') then c.lz else 0 end
    from c;
$function$;
revoke all on function public._fp_abrechnung(uuid, date) from public, anon, authenticated;

create or replace function public.cb_fp_abrechnung(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v public.fachperson_konto := public._fp_ich(); r record; pi jsonb := public._fp_preis_info(v.auth_id);
        frei boolean := coalesce((pi->>'keys_erlaubt')::boolean, false) or coalesce((pi->>'preis_anzeigen')::boolean, false);
begin
  select * into r from public._fp_abrechnung(v.auth_id, p_monat);
  return jsonb_build_object('monat', r.monat, 'keys_aktiv', r.keys_aktiv, 'key_tage', r.key_tage, 'keys_neu', r.keys_neu,
                            'abrechnung', r.abrechnung, 'preis_cent', case when frei then r.preis_cent end, 'betrag_cent', r.betrag_cent,
                            'modell', r.modell, 'keys_betrag_cent', r.keys_betrag_cent, 'lizenz_betrag_cent', r.lizenz_betrag_cent,
                            'lizenz_art', r.lizenz_art, 'lizenz_preis_cent', r.lizenz_preis_cent, 'lizenz_intervall', r.lizenz_intervall,
                            'keys_erlaubt', pi->'keys_erlaubt', 'preis_anzeigen', pi->'preis_anzeigen', 'lizenz_kontakt', pi->'lizenz_kontakt');
end $function$;

-- 5) cb_fp_ich: Freigabe und Preis-Info mitgeben ---------------------------------------------------------
create or replace function public.cb_fp_ich()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $function$
declare v public.fachperson_konto; v_mail text; t public.fachperson_vertrag_text;
begin
  if auth.uid() is null then return jsonb_build_object('fachperson',false,'angemeldet',false); end if;
  select email into v_mail from auth.users where id = auth.uid();
  select * into v from public.fachperson_konto where auth_id = auth.uid() and aktiv;
  if v.auth_id is null then return jsonb_build_object('fachperson',false,'angemeldet',true,'email',v_mail); end if;
  select * into t from public.fachperson_vertrag_text where version = public._fp_vertrag_aktuell();
  return jsonb_build_object('fachperson',true,'angemeldet',true,'name',v.name,'praxis',v.praxis,'kuerzel',v.kuerzel,'email',v_mail,
    'vereinbarung_bestaetigt_am',v.vereinbarung_bestaetigt_am,
    'lizenz_art',v.lizenz_art,'lizenz_bis',v.lizenz_bis,'lizenz_ok',public._fp_lizenz_ok(v.auth_id),
    'vertrag_ok', public._fp_vertrag_ok(v.auth_id),
    'vertrag_version', t.version, 'vertrag_titel', t.titel,
    'vertrag_text', case when not public._fp_vertrag_ok(v.auth_id) then t.text end,
    'vertrag_bestaetigt_am', (select am from public.fachperson_vertrag_bestaetigung b where b.auth_id = v.auth_id and b.version = t.version))
    || public._fp_preis_info(v.auth_id);
end $function$;

-- 6) Admin: Freigabe setzen und ansehen ------------------------------------------------------------------
create or replace function public.cb_admin_fachperson_freigabe(p_email text, p_key_preis_cent integer default null,
                                                               p_aktiv boolean default true, p_notiz text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare m text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  if position('@' in m) < 2 then return jsonb_build_object('ok',false,'grund','Bitte eine E-Mail-Adresse angeben.'); end if;
  if p_key_preis_cent is not null and p_key_preis_cent < 0 then return jsonb_build_object('ok',false,'grund','Preis in Cent, 0 oder mehr.'); end if;
  insert into public.fachperson_freigabe(email, key_preis_cent, aktiv, notiz)
  values (m, p_key_preis_cent, coalesce(p_aktiv, true), nullif(btrim(coalesce(p_notiz, '')), ''))
  on conflict (email) do update set key_preis_cent = excluded.key_preis_cent, aktiv = excluded.aktiv,
         notiz = coalesce(excluded.notiz, public.fachperson_freigabe.notiz), geaendert_am = now();
  return jsonb_build_object('ok', true, 'freigabe', (select to_jsonb(l) from public.fachperson_freigabe l where l.email = m),
           'konto_da', exists (select 1 from auth.users u where lower(btrim(u.email)) = m),
           'fachperson', (select k.kuerzel from public.fachperson_konto k join auth.users u on u.id = k.auth_id where lower(btrim(u.email)) = m));
end $function$;
revoke all on function public.cb_admin_fachperson_freigabe(text, integer, boolean, text) from public, anon;
grant execute on function public.cb_admin_fachperson_freigabe(text, integer, boolean, text) to authenticated;

create or replace function public.cb_admin_fachperson_freigaben()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $function$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('email', l.email, 'key_preis_cent', l.key_preis_cent, 'aktiv', l.aktiv, 'notiz', l.notiz,
             'angelegt_am', l.angelegt_am, 'geaendert_am', l.geaendert_am,
             'konto_da', exists (select 1 from auth.users u where lower(btrim(u.email)) = l.email),
             'fachperson', (select k.kuerzel from public.fachperson_konto k join auth.users u on u.id = k.auth_id where lower(btrim(u.email)) = l.email))
             order by l.angelegt_am)
      from public.fachperson_freigabe l), '[]'::jsonb);
end $function$;
revoke all on function public.cb_admin_fachperson_freigaben() from public, anon;
grant execute on function public.cb_admin_fachperson_freigaben() to authenticated;

-- Admin-Übersicht: Freigabe mit anzeigen
create or replace function public.cb_admin_fachleute(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $function$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name',f.name,'praxis',f.praxis,'kuerzel',f.kuerzel,'aktiv',f.aktiv,
             'email',(select email from auth.users u where u.id = f.auth_id),
             'vertrag_ok', public._fp_vertrag_ok(f.auth_id),
             'keys_erlaubt', public._fp_keys_erlaubt(f.auth_id),
             'monat',a.monat,'keys_aktiv',a.keys_aktiv,'key_tage',a.key_tage,'keys_neu',a.keys_neu,
             'abrechnung',a.abrechnung,'betrag_cent',a.betrag_cent,'modell',a.modell,'key_preis_cent',a.preis_cent,
             'keys_betrag_cent',a.keys_betrag_cent,'lizenz_betrag_cent',a.lizenz_betrag_cent,
             'lizenz_art',a.lizenz_art,'lizenz_preis_cent',a.lizenz_preis_cent,'lizenz_intervall',a.lizenz_intervall,'lizenz_bis',a.lizenz_bis,
             'keys_gesamt',(select count(*) from public.gratis_code g where g.fachperson_auth = f.auth_id)) order by f.name)
      from public.fachperson_konto f
      join public._fp_abrechnung(null, p_monat) a on a.fachperson_auth = f.auth_id), '[]'::jsonb);
end $function$;

-- 7) Bezahlte Funktionen: Riki-Rezeptideen und Key-Mail nur mit Lizenz ------------------------------------
create or replace function public.cb_fl5_riki_limit()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare v public.fachperson_konto := public._fp_ich(); n int; l int;
begin
  if not public._fp_keys_erlaubt(v.auth_id) then   -- FL-Lizenz: KI kostet Geld, nur mit Lizenz
    return jsonb_build_object('erlaubt', false, 'lizenz_noetig', true, 'heute', 0, 'limit', 0,
      'grund', 'Rezeptideen von Riki gibt es mit einer Lizenz für Root Index Pro. Für eine Lizenz bitte per Mail an '
               || coalesce((select wert from public.fachleute_einstellung where schluessel = 'lizenz_kontakt'), 'kontakt@root-index.de') || ' wenden.');
  end if;
  l := coalesce((select nullif(wert, '')::int from public.fachleute_einstellung where schluessel = 'fl5_riki_limit_tag'), 20);
  select count(*) into n from public."Riki_Nutzung"
   where akteur = auth.uid() and modus = 'fl5_rezeptideen' and erfolg and erfasst_am >= date_trunc('day', now());
  return jsonb_build_object('erlaubt', n < l, 'heute', n, 'limit', l,
    'grund', case when n >= l then 'Tageslimit für Riki-Rezeptideen erreicht (' || l || ' am Tag).' end);
end $function$;

create or replace function public.cb_fp_key_mail_vorbereiten(p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_mail text := lower(trim(coalesce(p_email,'')));
        v_id bigint; v_max_key int; v_max_fp int; v_fp_mail text;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
  if not public._fp_keys_erlaubt(v.auth_id) then   -- FL-Lizenz: Key-Versand nur mit Lizenz
    return jsonb_build_object('ok',false,'lizenz_noetig',true,'grund','Keys per Mail verschicken geht mit einer Lizenz für Root Index Pro. Für eine Lizenz bitte per Mail an '
           || coalesce((select wert from public.fachleute_einstellung where schluessel = 'lizenz_kontakt'), 'kontakt@root-index.de') || ' wenden.'); end if;
  if g.klient_auth is not null then return jsonb_build_object('ok',false,'grund','Der Key ist schon eingelöst.'); end if;
  if g.beendet_am is not null or not g.aktiv then return jsonb_build_object('ok',false,'grund','Der Key ist beendet.'); end if;
  if v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_mail) > 200 then return jsonb_build_object('ok',false,'grund','Bitte eine gültige E-Mail eintragen.'); end if;
  select coalesce((select wert::int from public.fachleute_einstellung where schluessel='mail_je_key_tag'),3),
         coalesce((select wert::int from public.fachleute_einstellung where schluessel='mail_je_fachperson_tag'),30)
    into v_max_key, v_max_fp;
  perform pg_advisory_xact_lock(hashtext('fp_mail:' || v.auth_id::text));
  if (select count(*) from public.fp_key_mail_log where code = g.code and status <> 'fehler' and am > now() - interval '24 hours') >= v_max_key then
    return jsonb_build_object('ok',false,'grund','Für diesen Key sind heute schon ' || v_max_key || ' Mails rausgegangen. Bitte morgen wieder – oder den QR-Code nutzen.'); end if;
  if (select count(*) from public.fp_key_mail_log where fachperson_auth = v.auth_id and status <> 'fehler' and am > now() - interval '24 hours') >= v_max_fp then
    return jsonb_build_object('ok',false,'grund','Tageslimit von ' || v_max_fp || ' Mails erreicht. Bitte morgen wieder.'); end if;
  insert into public.fp_key_mail_log(code, fachperson_auth, an_email) values (g.code, v.auth_id, v_mail) returning id into v_id;
  select email into v_fp_mail from auth.users where id = v.auth_id;
  return jsonb_build_object('ok',true,'log_id',v_id,'an',v_mail,'code',g.code,'tage',g.tage,
    'link','https://root-index.de/klientin.html?code=' || g.code,
    'fachperson',v.name,'praxis',v.praxis,'antwort_an',v_fp_mail);
end $function$;

-- 8) Admin-Umschalter: eigene Praxis „mit / ohne Lizenz“ (nur Admins und lizenz_umschalter_kuerzel) --------
create or replace function public.cb_fp_lizenz_testansicht(p_ohne boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v public.fachperson_konto := public._fp_ich();
begin
  if not public._fp_umschalter_darf(v.auth_id) then
    raise exception 'Nur für Praxen mit Test-Umschalter.' using errcode = '42501'; end if;
  update public.fachperson_konto set lizenz_testansicht_ohne = coalesce(p_ohne, false) where auth_id = v.auth_id;   -- nur die eigene Praxis
  return jsonb_build_object('ok', true) || public._fp_preis_info(v.auth_id);
end $function$;
revoke all on function public.cb_fp_lizenz_testansicht(boolean) from public, anon;
grant execute on function public.cb_fp_lizenz_testansicht(boolean) to authenticated;
