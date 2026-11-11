-- =====================================================================
-- FL-1 Fundament Fachleute-Zugang (11.11.2026)
-- Rolle Fachperson (Therapeutin), Klienten-Keys mit Laufzeit, Bindung
-- Klient -> Fachperson mit Einwilligung (Art. 9 DSGVO), Zugriffsschicht
-- fuer FL-4, Zaehlung als Abrechnungsgrundlage.
--
-- Grundsatz wie im Rest des Projekts: Tabellen haben RLS an, KEINE
-- Policies und KEINE Rechte fuer anon/authenticated. Jeder Zugriff laeuft
-- ueber die Funktionen unten; jede prueft auth.uid().
--
-- Keys sind Zeilen in public.gratis_code (vorhandenes Prinzip, nicht
-- doppelt gebaut). Ein Key ist an genau eine Fachperson gebunden
-- (fachperson_auth) und an genau einen Klienten (klient_auth, max 1).
-- Premium fuer Fachperson und Klient ergibt sich aus diesen Tabellen in
-- cb_ist_premium - kuerzt die Fachperson, endet Premium sofort mit.
-- =====================================================================

-- 1) Rolle Fachperson ---------------------------------------------------
create table if not exists public.fachperson (
  auth_id uuid primary key references auth.users(id),
  name text not null,
  praxis text,
  kuerzel text not null unique check (kuerzel ~ '^[A-Z0-9]{2,12}$'),
  aktiv boolean not null default true,
  seit timestamptz not null default now(),
  vereinbarung_bestaetigt_am timestamptz,   -- "Verschwiegenheit mit Klienten vereinbart" (FL-0), beim ersten Key
  notiz text
);
alter table public.fachperson enable row level security;
revoke all on public.fachperson from anon, authenticated;

-- 2) Keys: gratis_code erweitern ---------------------------------------
alter table public.gratis_code
  add column if not exists fachperson_auth uuid references public.fachperson(auth_id),
  add column if not exists klient_auth uuid references auth.users(id) on delete set null,
  add column if not exists bezeichnung text,          -- eigene Notiz der Fachperson (z. B. "Frau M.")
  add column if not exists start_am timestamptz,      -- Einloesung = Laufzeitbeginn
  add column if not exists laeuft_bis timestamptz,    -- Ende der Laufzeit (verlaengern/kuerzen aendert das)
  add column if not exists beendet_am timestamptz;    -- vorzeitig beendet (endgueltig)
do $$ begin
  alter table public.gratis_code add constraint gratis_code_fachperson_einzeln
    check (fachperson_auth is null or max_einloesungen = 1);
exception when duplicate_object then null; end $$;
create index if not exists gratis_code_fachperson_idx on public.gratis_code(fachperson_auth) where fachperson_auth is not null;
create index if not exists gratis_code_klient_idx on public.gratis_code(klient_auth) where klient_auth is not null;

-- 3) Einwilligung -------------------------------------------------------
create table if not exists public.fachperson_einwilligung_text (
  version text primary key,
  text text not null,               -- {fachperson} wird durch Name (Praxis) ersetzt, {ab} durch das Datum
  gilt_ab timestamptz not null default now()
);
alter table public.fachperson_einwilligung_text enable row level security;
revoke all on public.fachperson_einwilligung_text from anon, authenticated;

insert into public.fachperson_einwilligung_text(version, text) values ('fl1-2026-11-11',
'Ich willige ein, dass {fachperson} folgende Angaben aus meinem Root-Index-Konto sehen darf: mein Ernährungstagebuch (Lebensmittel, Mengen, Nährwerte, Bewertungen), die daraus berechneten Tages-, Wochen- und Monatswerte, meine eigenen Rezepte sowie meine Profilangaben zu Name, Alter, Größe, Gewicht, Ernährungszielen, Ernährungsform, Unverträglichkeiten und Diabetes-Typ. Zyklusdaten sind ausgenommen.

Diese Angaben können Gesundheitsdaten sein (Art. 9 DSGVO). Zweck ist ausschließlich meine ernährungstherapeutische Begleitung durch diese Fachperson. Sichtbar sind nur Einträge ab dem {ab}.

Die Einwilligung ist freiwillig. Premium behalte ich auch ohne sie. Ich kann sie jederzeit ohne Angabe von Gründen widerrufen (root-index.de/klientin.html). Ab dem Widerruf sieht die Fachperson nichts mehr. Der Zugriff endet außerdem automatisch, wenn mein Zugangscode abläuft oder beendet wird.')
on conflict (version) do nothing;

create table if not exists public.fachperson_einwilligung (
  code text primary key references public.gratis_code(code),
  klient_auth uuid not null references auth.users(id) on delete cascade,
  einwilligung_am timestamptz,
  version text references public.fachperson_einwilligung_text(version),
  verschwiegenheit_besprochen boolean not null default false,  -- FL-0: Klient bestaetigt "darueber gesprochen"
  widerruf_am timestamptz,
  daten_ab date                      -- ab diesem Tag darf die Fachperson Eintraege sehen
);
alter table public.fachperson_einwilligung enable row level security;
revoke all on public.fachperson_einwilligung from anon, authenticated;

create table if not exists public.fachperson_einwilligung_log (
  id bigserial primary key,
  code text not null,
  klient_auth uuid,
  aktion text not null check (aktion in ('erteilt','widerrufen')),
  version text,
  verschwiegenheit_besprochen boolean,
  am timestamptz not null default now()
);
alter table public.fachperson_einwilligung_log enable row level security;
revoke all on public.fachperson_einwilligung_log from anon, authenticated;

-- 4) Kernregeln ---------------------------------------------------------
-- Laeuft ein Fachperson-Key gerade? (eingeloest, nicht beendet, Laufzeit offen)
create or replace function public._fp_key_laeuft(g public.gratis_code)
returns boolean language sql stable set search_path to 'public' as $$
  select g.fachperson_auth is not null and g.klient_auth is not null
     and g.beendet_am is null and g.laeuft_bis > now();
$$;

-- Darf die angemeldete Fachperson die Daten zu diesem Key sehen?
-- Liefert Benutzer_ID und daten_ab, sonst Fehler. NUR fuer andere
-- SECURITY-DEFINER-Funktionen (FL-4), nicht direkt aufrufbar.
create or replace function public._fp_klient(p_code text, out benutzer_id text, out daten_ab date)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  select b."Benutzer_ID", e.daten_ab into benutzer_id, daten_ab
    from public.gratis_code g
    join public.fachperson f on f.auth_id = g.fachperson_auth and f.aktiv
    join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    join public."Benutzer" b on b.auth_id = g.klient_auth
   where g.code = upper(trim(p_code))
     and g.fachperson_auth = v_uid
     and public._fp_key_laeuft(g)
     and e.einwilligung_am is not null and e.widerruf_am is null
   limit 1;
  if benutzer_id is null then raise exception 'Kein Zugriff auf diesen Klienten.' using errcode = '42501'; end if;
end $$;
revoke all on function public._fp_klient(text) from public, anon, authenticated;

-- Premium: Fachperson lebenslang (solange aktiv), Klient solange sein Key laeuft
create or replace function public.cb_ist_premium(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select (coalesce(b.is_premium,false) and (b.premium_bis is null or b.premium_bis > now()))
        or coalesce(b.trial_bis > now(), false)
        or coalesce(b.subscription_status = 'active', false)
        or coalesce(b.subscription_status = 'trialing' and b.trial_bis > now(), false)
      from public."Benutzer" b where b.auth_id = p_auth limit 1), false)
  or exists (select 1 from public.fachperson f where f.auth_id = p_auth and f.aktiv)
  or exists (select 1 from public.gratis_code g
              where g.klient_auth = p_auth and g.fachperson_auth is not null
                and g.beendet_am is null and g.laeuft_bis > now());
$$;

-- 5) Code-Einloesung (klientin.html) erweitern ---------------------------
create or replace function public.cb_gratis_code_info(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.gratis_code; v_fp public.fachperson;
begin
  select * into v from public.gratis_code where code = upper(trim(p_code));
  if not found or not v.aktiv then return jsonb_build_object('gueltig',false,'grund','Diesen Code gibt es nicht.'); end if;
  if v.gueltig_bis is not null and v.gueltig_bis < now() then return jsonb_build_object('gueltig',false,'grund','Der Code ist abgelaufen.'); end if;
  if v.beendet_am is not null then return jsonb_build_object('gueltig',false,'grund','Der Code wurde beendet.'); end if;
  if v.max_einloesungen is not null and v.eingeloest >= v.max_einloesungen then return jsonb_build_object('gueltig',false,'grund','Der Code wurde schon eingelöst.'); end if;
  if v.fachperson_auth is not null then
    select * into v_fp from public.fachperson where auth_id = v.fachperson_auth;
    if not coalesce(v_fp.aktiv,false) then return jsonb_build_object('gueltig',false,'grund','Der Code ist nicht mehr gültig.'); end if;
    return jsonb_build_object('gueltig',true,'tage',v.tage,'fachperson',v_fp.name,'praxis',v_fp.praxis);
  end if;
  return jsonb_build_object('gueltig',true,'tage',v.tage);
end $$;

create or replace function public.cb_gratis_code_einloesen(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_c public.gratis_code; v_bis timestamptz; v_code text := upper(trim(p_code)); v_fp public.fachperson;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  perform public.cb_link_me();   -- Benutzer-Zeile sicherstellen (sonst ginge die Testzeit verloren)
  select * into v_c from public.gratis_code where code = v_code for update;
  if not found or not v_c.aktiv then return jsonb_build_object('ok',false,'grund','Diesen Code gibt es nicht.'); end if;
  if v_c.gueltig_bis is not null and v_c.gueltig_bis < now() then return jsonb_build_object('ok',false,'grund','Der Code ist abgelaufen.'); end if;
  if exists (select 1 from public.gratis_code_einloesung where code = v_code and auth_id = v_uid) then
    return jsonb_build_object('ok',false,'grund','Du hast diesen Code schon eingelöst.'); end if;
  if v_c.beendet_am is not null then return jsonb_build_object('ok',false,'grund','Der Code wurde beendet.'); end if;
  if v_c.max_einloesungen is not null and v_c.eingeloest >= v_c.max_einloesungen then return jsonb_build_object('ok',false,'grund','Der Code ist schon aufgebraucht.'); end if;

  if v_c.fachperson_auth is not null then
    select * into v_fp from public.fachperson where auth_id = v_c.fachperson_auth;
    if not coalesce(v_fp.aktiv,false) then return jsonb_build_object('ok',false,'grund','Der Code ist nicht mehr gültig.'); end if;
    if v_c.fachperson_auth = v_uid then return jsonb_build_object('ok',false,'grund','Den eigenen Klienten-Code kann man nicht selbst einlösen.'); end if;
    insert into public.gratis_code_einloesung(code, auth_id, tage) values (v_code, v_uid, v_c.tage);
    update public.gratis_code set eingeloest = eingeloest + 1, klient_auth = v_uid, start_am = now(),
           laeuft_bis = now() + make_interval(days => v_c.tage)
     where code = v_code returning laeuft_bis into v_bis;
    insert into public.fachperson_einwilligung(code, klient_auth) values (v_code, v_uid) on conflict (code) do nothing;
    return jsonb_build_object('ok',true,'tage',v_c.tage,'premium_bis',v_bis,'code',v_code,
                              'fachperson',v_fp.name,'praxis',v_fp.praxis,'einwilligung_offen',true);
  end if;

  insert into public.gratis_code_einloesung(code, auth_id, tage) values (v_code, v_uid, v_c.tage);
  update public.gratis_code set eingeloest = eingeloest + 1 where code = v_code;
  v_bis := public._testzeit_verlaengern(v_uid, v_c.tage);
  return jsonb_build_object('ok',true,'tage',v_c.tage,'premium_bis',v_bis);
end $$;

-- 6) Klient: Fachpersonen, Einwilligung, Widerruf ------------------------
create or replace function public.cb_meine_fachpersonen()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_ver text;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  select version into v_ver from public.fachperson_einwilligung_text order by gilt_ab desc limit 1;
  return jsonb_build_object('ok',true,'liste', coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', g.code, 'fachperson', f.name, 'praxis', f.praxis,
      'laeuft_bis', g.laeuft_bis, 'laeuft', public._fp_key_laeuft(g),
      'einwilligung_am', e.einwilligung_am, 'widerruf_am', e.widerruf_am, 'daten_ab', e.daten_ab,
      'einwilligung_aktiv', (e.einwilligung_am is not null and e.widerruf_am is null),
      'text_version', v_ver,
      'text', replace(replace(t.text, '{fachperson}', f.name || coalesce(' (' || f.praxis || ')','')),
                      '{ab}', to_char(coalesce(case when e.widerruf_am is null then e.daten_ab end,
                                               (now() at time zone 'Europe/Berlin')::date), 'DD.MM.YYYY'))
    ) order by g.start_am desc)
    from public.gratis_code g
    join public.fachperson f on f.auth_id = g.fachperson_auth
    left join public.fachperson_einwilligung e on e.code = g.code
    left join public.fachperson_einwilligung_text t on t.version = v_ver
    where g.klient_auth = v_uid and g.fachperson_auth is not null), '[]'::jsonb));
end $$;

create or replace function public.cb_fachperson_einwilligen(p_code text, p_verschwiegenheit_besprochen boolean, p_version text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_c public.gratis_code; v_ver text; v_ab date := (now() at time zone 'Europe/Berlin')::date;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  select * into v_c from public.gratis_code where code = upper(trim(p_code));
  if not found or v_c.klient_auth is distinct from v_uid or v_c.fachperson_auth is null then
    return jsonb_build_object('ok',false,'grund','Dieser Code gehört nicht zu deinem Konto.'); end if;
  if not public._fp_key_laeuft(v_c) then return jsonb_build_object('ok',false,'grund','Der Code ist nicht mehr aktiv.'); end if;
  select version into v_ver from public.fachperson_einwilligung_text order by gilt_ab desc limit 1;
  if p_version is distinct from v_ver then return jsonb_build_object('ok',false,'grund','Der Einwilligungstext hat sich geändert. Bitte Seite neu laden.'); end if;
  if not coalesce(p_verschwiegenheit_besprochen,false) then
    return jsonb_build_object('ok',false,'grund','Bitte bestätige, dass du mit deiner Fachperson über die Verschwiegenheit gesprochen hast.'); end if;
  insert into public.fachperson_einwilligung as fe (code, klient_auth, einwilligung_am, version, verschwiegenheit_besprochen, widerruf_am, daten_ab)
  values (v_c.code, v_uid, now(), v_ver, true, null, v_ab)
  on conflict (code) do update set einwilligung_am = now(), version = v_ver, verschwiegenheit_besprochen = true,
     daten_ab = case when fe.widerruf_am is null and fe.daten_ab is not null then fe.daten_ab else v_ab end,
     widerruf_am = null;
  insert into public.fachperson_einwilligung_log(code, klient_auth, aktion, version, verschwiegenheit_besprochen)
  values (v_c.code, v_uid, 'erteilt', v_ver, true);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cb_fachperson_widerrufen(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_code text := upper(trim(p_code));
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  update public.fachperson_einwilligung set widerruf_am = now()
   where code = v_code and klient_auth = v_uid and einwilligung_am is not null and widerruf_am is null;
  if not found then return jsonb_build_object('ok',false,'grund','Keine aktive Einwilligung zu diesem Code.'); end if;
  insert into public.fachperson_einwilligung_log(code, klient_auth, aktion) values (v_code, v_uid, 'widerrufen');
  return jsonb_build_object('ok',true);
end $$;

-- 7) Fachperson: eigenes Konto und Keys ----------------------------------
create or replace function public._fp_ich() returns public.fachperson
language sql stable security definer set search_path to 'public' as $$
  select * from public.fachperson where auth_id = auth.uid() and aktiv;
$$;
revoke all on function public._fp_ich() from public, anon, authenticated;

create or replace function public.cb_fp_ich()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $$
declare v public.fachperson;
begin
  if auth.uid() is null then return jsonb_build_object('fachperson',false,'angemeldet',false); end if;
  v := public._fp_ich();
  if v.auth_id is null then
    return jsonb_build_object('fachperson',false,'angemeldet',true,'email',(select email from auth.users where id = auth.uid())); end if;
  return jsonb_build_object('fachperson',true,'angemeldet',true,'name',v.name,'praxis',v.praxis,'kuerzel',v.kuerzel,
    'vereinbarung_bestaetigt_am',v.vereinbarung_bestaetigt_am,'email',(select email from auth.users where id = auth.uid()));
end $$;

create or replace function public.cb_fp_keys()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson := public._fp_ich();
begin
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', g.code, 'bezeichnung', g.bezeichnung, 'tage', g.tage, 'erstellt_am', g.erstellt_am,
      'start_am', g.start_am, 'laeuft_bis', g.laeuft_bis, 'beendet_am', g.beendet_am,
      'status', case when g.beendet_am is not null then 'beendet'
                     when g.klient_auth is null then 'offen'
                     when g.laeuft_bis > now() then 'laeuft' else 'abgelaufen' end,
      'einwilligung', case when e.einwilligung_am is null then 'keine'
                           when e.widerruf_am is not null then 'widerrufen' else 'erteilt' end,
      'daten_ab', case when e.widerruf_am is null then e.daten_ab end,
      -- Name des Klienten nur bei laufendem Key UND aktiver Einwilligung
      'klient_name', case when public._fp_key_laeuft(g) and e.einwilligung_am is not null and e.widerruf_am is null
                          then (select b."Name" from public."Benutzer" b where b.auth_id = g.klient_auth limit 1) end
    ) order by g.erstellt_am desc)
    from public.gratis_code g
    left join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    where g.fachperson_auth = v.auth_id), '[]'::jsonb);
end $$;

create or replace function public.cb_fp_key_anlegen(p_tage integer, p_bezeichnung text default null, p_vereinbarung_bestaetigt boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson := public._fp_ich(); v_code text; v_z text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  if p_tage is null or p_tage < 1 or p_tage > 730 then return jsonb_build_object('ok',false,'grund','Laufzeit: 1 Tag bis 2 Jahre.'); end if;
  if v.vereinbarung_bestaetigt_am is null then
    if not coalesce(p_vereinbarung_bestaetigt,false) then
      return jsonb_build_object('ok',false,'grund','Bitte bestätige zuerst die Vereinbarung zur Verschwiegenheit.','vereinbarung_noetig',true); end if;
    update public.fachperson set vereinbarung_bestaetigt_am = now() where auth_id = v.auth_id;
  end if;
  loop
    v_code := v.kuerzel || '-';
    for i in 1..4 loop v_code := v_code || substr(v_z, 1 + floor(random()*length(v_z))::int, 1); end loop;
    exit when not exists (select 1 from public.gratis_code where code = v_code);
  end loop;
  insert into public.gratis_code(code, tage, max_einloesungen, notiz, fachperson_auth, bezeichnung)
  values (v_code, p_tage, 1, 'Fachperson-Key: ' || v.name, v.auth_id, nullif(left(trim(coalesce(p_bezeichnung,'')),80),''));
  return jsonb_build_object('ok',true,'code',v_code,'link','https://root-index.de/klientin.html?code=' || v_code,'tage',p_tage);
end $$;

-- Laufzeit verlaengern (p_menge > 0) oder kuerzen (p_menge < 0); Einheit tage|wochen|monate
create or replace function public.cb_fp_key_laufzeit(p_code text, p_menge integer, p_einheit text default 'tage')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson := public._fp_ich(); g public.gratis_code; v_iv interval; v_tage int; v_bis timestamptz;
begin
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id for update;
  if not found then raise exception 'Diesen Key gibt es bei dir nicht.' using errcode = '42501'; end if;
  if g.beendet_am is not null then return jsonb_build_object('ok',false,'grund','Der Key ist beendet. Lege bitte einen neuen an.'); end if;
  if p_menge is null or p_menge = 0 or abs(p_menge) > 730 then return jsonb_build_object('ok',false,'grund','Bitte eine Anzahl angeben.'); end if;
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
    v_bis := greatest(g.laeuft_bis, now()) + v_iv;          -- abgelaufene Keys laufen ab heute wieder
  else
    if g.laeuft_bis <= now() then return jsonb_build_object('ok',false,'grund','Der Key ist schon abgelaufen.'); end if;
    v_bis := greatest(g.laeuft_bis + v_iv, now());          -- nie vor heute: kuerzen bis jetzt = Zugang endet sofort
  end if;
  if v_bis > now() + interval '2 years' then return jsonb_build_object('ok',false,'grund','Höchstens 2 Jahre im Voraus.'); end if;
  update public.gratis_code set laeuft_bis = v_bis where code = g.code;
  return jsonb_build_object('ok',true,'laeuft_bis',v_bis);
end $$;

create or replace function public.cb_fp_key_beenden(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson := public._fp_ich();
begin
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  update public.gratis_code set beendet_am = now(), aktiv = false,
         laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id and beendet_am is null;
  if not found then raise exception 'Diesen Key gibt es bei dir nicht oder er ist schon beendet.' using errcode = '42501'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cb_fp_key_bezeichnung(p_code text, p_bezeichnung text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson := public._fp_ich();
begin
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  update public.gratis_code set bezeichnung = nullif(left(trim(coalesce(p_bezeichnung,'')),80),'')
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es bei dir nicht.' using errcode = '42501'; end if;
  return jsonb_build_object('ok',true);
end $$;

-- 8) Zugriffsschicht fuer FL-4: Beispiel Tageswerte ----------------------
-- Muster fuer alle kuenftigen Klienten-Auswertungen: erst _fp_klient(p_code)
-- (wirft ohne Recht), dann nur Daten ab daten_ab.
create or replace function public.cb_fp_klient_tagessummen(p_code text, p_von date default null, p_bis date default null)
returns table("Datum" date, kcal numeric, protein numeric, kh numeric, zucker numeric, fett numeric,
              ballaststoffe numeric, salz numeric, score_schnitt numeric, eintraege bigint)
language plpgsql stable security definer set search_path to 'public' as $$
declare k record;
begin
  select * into k from public._fp_klient(p_code);
  return query
    select s."Datum", s.kcal, s.protein, s.kh, s.zucker, s.fett, s.ballaststoffe, s.salz, s.score_schnitt, s.eintraege
      from public.v_tagebuch_tagessumme s
     where s."Benutzer_ID" = k.benutzer_id
       and s."Datum" >= greatest(k.daten_ab, coalesce(p_von, k.daten_ab))
       and s."Datum" <= coalesce(p_bis, (now() at time zone 'Europe/Berlin')::date)
     order by s."Datum";
end $$;

-- 9) Abrechnungsgrundlage ------------------------------------------------
-- Key-Tage eines Keys in einem Monat (Kalendertage Berlin, Starttag zaehlt,
-- Endtag nicht; jeder gestartete Key zaehlt mindestens 1 Tag). Laufende
-- Keys zaehlen nur bis heute, nicht im Voraus.
create or replace function public._fp_key_tage(p_start timestamptz, p_ende timestamptz, p_monat date)
returns integer language sql immutable as $$
  with t as (
    select (p_start at time zone 'Europe/Berlin')::date s,
           greatest((p_ende at time zone 'Europe/Berlin')::date, (p_start at time zone 'Europe/Berlin')::date + 1) e,
           date_trunc('month', p_monat)::date ma,
           (date_trunc('month', p_monat) + interval '1 month')::date me)
  select case when p_start is null then 0 else greatest(0, least(e, me) - greatest(s, ma)) end from t;
$$;

create or replace function public._fp_abrechnung(p_fp uuid, p_monat date)
returns table(fachperson_auth uuid, monat date, keys_aktiv integer, key_tage integer, keys_neu integer)
language sql stable security definer set search_path to 'public' as $$
  with m as (select date_trunc('month', coalesce(p_monat, (now() at time zone 'Europe/Berlin')::date))::date monat),
  k as (
    select g.fachperson_auth, g.start_am,
           public._fp_key_tage(g.start_am, least(g.laeuft_bis, coalesce(g.beendet_am, g.laeuft_bis), now()), m.monat) tage, m.monat
      from public.gratis_code g, m
     where g.fachperson_auth is not null and g.start_am is not null
       and (p_fp is null or g.fachperson_auth = p_fp))
  select f.auth_id, m.monat,
         count(*) filter (where k.tage > 0)::int,
         coalesce(sum(k.tage),0)::int,
         count(*) filter (where date_trunc('month', k.start_am at time zone 'Europe/Berlin')::date = m.monat)::int
    from public.fachperson f cross join m
    left join k on k.fachperson_auth = f.auth_id
   where (p_fp is null or f.auth_id = p_fp)
   group by f.auth_id, m.monat;
$$;
revoke all on function public._fp_abrechnung(uuid, date) from public, anon, authenticated;

create or replace function public.cb_fp_abrechnung(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson := public._fp_ich(); r record;
begin
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  select * into r from public._fp_abrechnung(v.auth_id, p_monat);
  return jsonb_build_object('monat', r.monat, 'keys_aktiv', r.keys_aktiv, 'key_tage', r.key_tage, 'keys_neu', r.keys_neu);
end $$;

-- 10) Admin -------------------------------------------------------------
create or replace function public.cb_admin_fachperson_setzen(p_email text, p_name text default null, p_kuerzel text default null,
                                                             p_praxis text default null, p_aktiv boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_uid uuid; v_alt public.fachperson; v_kz text := upper(regexp_replace(coalesce(p_kuerzel,''),'[^A-Za-z0-9]','','g'));
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Zu dieser E-Mail gibt es noch kein Konto. Die Fachperson legt es auf root-index.de/therapeut.html an.'); end if;
  select * into v_alt from public.fachperson where auth_id = v_uid;
  if v_alt.auth_id is null then
    if coalesce(p_name,'') = '' or v_kz = '' then return jsonb_build_object('ok',false,'grund','Name und Kürzel nötig.'); end if;
    insert into public.fachperson(auth_id, name, praxis, kuerzel, aktiv) values (v_uid, trim(p_name), nullif(trim(coalesce(p_praxis,'')),''), v_kz, coalesce(p_aktiv,true));
  else
    update public.fachperson set name = coalesce(nullif(trim(coalesce(p_name,'')),''), name),
           praxis = coalesce(nullif(trim(coalesce(p_praxis,'')),''), praxis),
           kuerzel = coalesce(nullif(v_kz,''), kuerzel), aktiv = coalesce(p_aktiv, aktiv)
     where auth_id = v_uid;
  end if;
  if p_aktiv = false then
    -- deaktiviert: alle laufenden Keys dieser Fachperson enden jetzt
    update public.gratis_code set beendet_am = now(), aktiv = false,
           laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
     where fachperson_auth = v_uid and beendet_am is null;
  end if;
  return jsonb_build_object('ok',true,'fachperson',(select to_jsonb(f) from public.fachperson f where auth_id = v_uid));
end $$;

create or replace function public.cb_admin_fachleute(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name',f.name,'praxis',f.praxis,'kuerzel',f.kuerzel,'aktiv',f.aktiv,
             'email',(select email from auth.users u where u.id = f.auth_id),
             'monat',a.monat,'keys_aktiv',a.keys_aktiv,'key_tage',a.key_tage,'keys_neu',a.keys_neu,
             'keys_gesamt',(select count(*) from public.gratis_code g where g.fachperson_auth = f.auth_id)) order by f.name)
      from public.fachperson f
      join public._fp_abrechnung(null, p_monat) a on a.fachperson_auth = f.auth_id), '[]'::jsonb);
end $$;

-- 11) Rechte ------------------------------------------------------------
revoke all on function public._fp_key_laeuft(public.gratis_code) from public, anon, authenticated;
revoke all on function public._fp_key_tage(timestamptz, timestamptz, date) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array[
    'public.cb_meine_fachpersonen()',
    'public.cb_fachperson_einwilligen(text, boolean, text)',
    'public.cb_fachperson_widerrufen(text)',
    'public.cb_fp_ich()',
    'public.cb_fp_keys()',
    'public.cb_fp_key_anlegen(integer, text, boolean)',
    'public.cb_fp_key_laufzeit(text, integer, text)',
    'public.cb_fp_key_beenden(text)',
    'public.cb_fp_key_bezeichnung(text, text)',
    'public.cb_fp_klient_tagessummen(text, date, date)',
    'public.cb_fp_abrechnung(date)',
    'public.cb_admin_fachperson_setzen(text, text, text, text, boolean)',
    'public.cb_admin_fachleute(date)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
