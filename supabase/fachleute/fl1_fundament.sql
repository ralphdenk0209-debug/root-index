-- =====================================================================
-- FL-1 Fundament Fachleute-Zugang (11.11.2026)
-- Rolle Fachperson (Therapeutin), Verschwiegenheitsvertrag Root Index <->
-- Fachperson, Klienten-Keys mit Laufzeit, Bindung Klient -> Fachperson
-- (immer nur EINE, Uebertrag moeglich) mit Bestaetigung + Einwilligung
-- (Art. 9 DSGVO), Zugriffsschicht fuer FL-4, Abrechnungsgrundlage,
-- Kennzeichen "ehemaliger Klient" fuer das 3,99-Angebot (App-Store-
-- Angebotscodes aus hochgeladener Liste), Lizenzart je Fachperson
-- (Gruenderinnen gratis, spaeter bezahlte Lizenz; Preise entscheidet Ralph).
--
-- Ralph-Entscheide 11.11.: 4,99 EUR je Key und Monat, jeder angefangene
-- Kalendermonat zaehlt voll (umschaltbar: fachleute_einstellung.abrechnung
-- = 'monat' | 'tag'); Klient mit eigenem Abo bekommt den Key trotzdem
-- (Hinweis zum Selbstkuendigen); beim Uebertrag sieht die neue Fachperson
-- erst ab dem Wechsel, aeltere Eintraege nur mit Zustimmung des Klienten.
--
-- Grundsatz wie im Rest des Projekts: Tabellen haben RLS an, KEINE
-- Policies und KEINE Rechte fuer anon/authenticated. Jeder Zugriff laeuft
-- ueber die Funktionen unten; jede prueft auth.uid().
-- Keys sind Zeilen in public.gratis_code (vorhandenes Prinzip erweitert).
-- =====================================================================

-- 0) Einstellungen ------------------------------------------------------
create table if not exists public.fachleute_einstellung (
  schluessel text primary key,
  wert text not null,
  notiz text
);
alter table public.fachleute_einstellung enable row level security;
revoke all on public.fachleute_einstellung from anon, authenticated;
insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('abrechnung','monat','monat = jeder angefangene Kalendermonat zaehlt voll (Ralph 11.11.); tag = tagesgenau'),
  ('preis_cent','499','Preis je Klienten-Key und Monat in Cent (Ralph 11.11.)'),
  ('abrechnungsmodell','je_key','Standard je Fachperson: je_key | lizenz_pauschal | lizenz_plus_keys | gratis (Ralph 11.11.)')
on conflict (schluessel) do nothing;

-- 1) Rolle Fachperson + Verschwiegenheitsvertrag ------------------------
-- public.fachperson (seit 26.10., Kuerzel-Verzeichnis GOERGENS/RALPH, cb_admin_fachperson_*)
-- bleibt unveraendert. Das Konto mit Login haengt ueber das Kuerzel daran.
create table if not exists public.fachperson_konto (
  auth_id uuid primary key references auth.users(id),
  name text not null,
  praxis text,
  kuerzel text not null unique references public.fachperson(kuerzel),
  aktiv boolean not null default true,
  seit timestamptz not null default now(),
  vereinbarung_bestaetigt_am timestamptz,   -- "Verschwiegenheit mit Klienten vereinbart und erfuellt", Pflicht beim ersten Key
  -- Lizenz (Ralph 11.11.): die ersten 4-6 sind Gruenderinnen mit lebenslangem Gratis-Zugang,
  -- spaetere zahlen eine Lizenz. Preis/Stufen entscheidet Ralph; abgerechnet ueber denselben Weg wie die Keys.
  lizenz_art text not null default 'lizenz_bezahlt' check (lizenz_art in ('gruenderin_gratis','lizenz_bezahlt')),
  lizenz_bis timestamptz,                   -- nur lizenz_bezahlt: bezahlt bis (null = noch offen/unbefristet)
  lizenz_preis_cent integer check (lizenz_preis_cent is null or lizenz_preis_cent >= 0),
  lizenz_intervall text check (lizenz_intervall is null or lizenz_intervall in ('monat','jahr')),
  notiz text
);
-- 11.11.2026 (Ralph jaja): Preis und Abrechnungsmodell je Fachperson, leer = globaler Standard
alter table public.fachperson_konto
  add column if not exists key_preis_cent integer check (key_preis_cent is null or key_preis_cent >= 0),
  add column if not exists abrechnungsmodell text check (abrechnungsmodell is null or abrechnungsmodell in ('je_key','lizenz_pauschal','lizenz_plus_keys','gratis'));
alter table public.fachperson_konto enable row level security;
revoke all on public.fachperson_konto from anon, authenticated;

create table if not exists public.fachperson_vertrag_text (
  version text primary key,
  titel text not null,
  text text not null,
  gilt_ab timestamptz not null default now()
);
alter table public.fachperson_vertrag_text enable row level security;
revoke all on public.fachperson_vertrag_text from anon, authenticated;
insert into public.fachperson_vertrag_text(version, titel, text) values ('platzhalter-2026-11-11',
'Verschwiegenheitsvereinbarung zwischen Root Index und Fachperson (Platzhalter)',
'PLATZHALTER – der endgültige Vertragstext folgt (Aufgabe FL-3). Sobald er vorliegt, ist hier eine erneute Bestätigung nötig.

Sinngemäß: Ich behandle alle Informationen über Root Index, die ich als Fachperson erhalte und die nicht öffentlich sind, vertraulich. Daten meiner Klientinnen und Klienten nutze ich nur für deren Begleitung und nur, solange sie eingewilligt haben.')
on conflict (version) do nothing;

create table if not exists public.fachperson_vertrag_bestaetigung (
  auth_id uuid not null references public.fachperson_konto(auth_id),
  version text not null references public.fachperson_vertrag_text(version),
  am timestamptz not null default now(),
  primary key (auth_id, version)
);
alter table public.fachperson_vertrag_bestaetigung enable row level security;
revoke all on public.fachperson_vertrag_bestaetigung from anon, authenticated;

-- 2) Keys: gratis_code erweitern ---------------------------------------
alter table public.gratis_code
  add column if not exists fachperson_auth uuid references public.fachperson_konto(auth_id),
  add column if not exists klient_auth uuid references auth.users(id) on delete set null,
  add column if not exists bezeichnung text,          -- eigene Notiz der Fachperson (z. B. "Frau M.")
  add column if not exists start_am timestamptz,      -- Einloesung = Laufzeitbeginn
  add column if not exists laeuft_bis timestamptz,    -- Ende der Laufzeit (verlaengern/kuerzen aendert das)
  add column if not exists beendet_am timestamptz,    -- vorzeitig beendet (endgueltig)
  add column if not exists beendet_grund text;        -- fachperson | wechsel | admin
do $$ begin
  alter table public.gratis_code add constraint gratis_code_fachperson_einzeln
    check (fachperson_auth is null or max_einloesungen = 1);
exception when duplicate_object then null; end $$;
create index if not exists gratis_code_fachperson_idx on public.gratis_code(fachperson_auth) where fachperson_auth is not null;
create index if not exists gratis_code_klient_idx on public.gratis_code(klient_auth) where klient_auth is not null;

-- 3) Bestaetigung + Einwilligung des Klienten ---------------------------
create table if not exists public.fachperson_einwilligung_text (
  version text primary key,
  text text not null,               -- {fachperson} = Name (Praxis), {ab} = Datum
  text_aeltere text not null,       -- Zusatz-Haken: auch aeltere Eintraege
  text_besprochen text not null,    -- Pflicht-Bestaetigung "darueber gesprochen"
  gilt_ab timestamptz not null default now()
);
alter table public.fachperson_einwilligung_text enable row level security;
revoke all on public.fachperson_einwilligung_text from anon, authenticated;

insert into public.fachperson_einwilligung_text(version, text, text_aeltere, text_besprochen) values ('fl1-2026-11-11',
'Ich willige ein, dass {fachperson} folgende Angaben aus meinem Root-Index-Konto sehen darf: mein Ernährungstagebuch (Lebensmittel, Mengen, Nährwerte, Bewertungen), die daraus berechneten Tages-, Wochen- und Monatswerte, meine eigenen Rezepte sowie meine Profilangaben zu Name, Alter, Größe, Gewicht, Ernährungszielen, Ernährungsform, Unverträglichkeiten und Diabetes-Typ. Zyklusdaten sind ausgenommen.

Diese Angaben können Gesundheitsdaten sein (Art. 9 DSGVO). Zweck ist ausschließlich meine ernährungstherapeutische Begleitung durch diese Fachperson. Sichtbar sind Einträge ab dem {ab}; ältere nur, wenn ich das zusätzlich ankreuze.

Die Einwilligung ist freiwillig. Premium behalte ich auch ohne sie. Ich kann sie jederzeit ohne Angabe von Gründen widerrufen (root-index.de/klientin.html). Ab dem Widerruf sieht die Fachperson nichts mehr. Der Zugriff endet außerdem automatisch, wenn mein Zugangscode abläuft oder beendet wird oder ich zu einer anderen Fachperson wechsle.',
'Zusätzlich darf {fachperson} auch meine älteren Einträge (vor dem {ab}) sehen.',
'Ich habe mit {fachperson} über die Verschwiegenheit gesprochen.')
on conflict (version) do nothing;

create table if not exists public.fachperson_einwilligung (
  code text primary key references public.gratis_code(code),
  klient_auth uuid not null references auth.users(id) on delete cascade,
  besprochen_am timestamptz,         -- Pflicht-Bestaetigung "mit Fachperson ueber Verschwiegenheit gesprochen"
  einwilligung_am timestamptz,
  version text references public.fachperson_einwilligung_text(version),
  aeltere_freigegeben boolean not null default false,
  widerruf_am timestamptz,
  daten_ab date                      -- ab diesem Tag (Berlin) darf die Fachperson Eintraege sehen
);
alter table public.fachperson_einwilligung enable row level security;
revoke all on public.fachperson_einwilligung from anon, authenticated;

create table if not exists public.fachperson_einwilligung_log (
  id bigserial primary key,
  code text not null,
  klient_auth uuid,
  aktion text not null check (aktion in ('besprochen','erteilt','widerrufen','wechsel')),
  version text,
  aeltere_freigegeben boolean,
  am timestamptz not null default now()
);
alter table public.fachperson_einwilligung_log enable row level security;
revoke all on public.fachperson_einwilligung_log from anon, authenticated;

-- 4) Kernregeln ---------------------------------------------------------
create or replace function public._fp_key_laeuft(g public.gratis_code)
returns boolean language sql stable set search_path to 'public' as $$
  select g.fachperson_auth is not null and g.klient_auth is not null
     and g.beendet_am is null and g.laeuft_bis > now();
$$;

create or replace function public._fp_vertrag_aktuell()
returns text language sql stable security definer set search_path to 'public' as $$
  select version from public.fachperson_vertrag_text where gilt_ab <= now() order by gilt_ab desc limit 1;
$$;

create or replace function public._fp_vertrag_ok(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.fachperson_vertrag_bestaetigung v
                  where v.auth_id = p_auth and v.version = public._fp_vertrag_aktuell());
$$;

-- Lizenz gueltig? Gruenderin immer; bezahlte Lizenz bis lizenz_bis (null = offen)
create or replace function public._fp_lizenz_ok(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.fachperson_konto f where f.auth_id = p_auth and f.aktiv
                    and (f.lizenz_art = 'gruenderin_gratis' or f.lizenz_bis is null or f.lizenz_bis > now()));
$$;

-- Angemeldete Fachperson: aktiv, Lizenz gueltig UND aktueller Vertrag bestaetigt, sonst Fehler
create or replace function public._fp_ich() returns public.fachperson_konto
language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto;
begin
  select * into v from public.fachperson_konto where auth_id = auth.uid() and aktiv;
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  if not public._fp_lizenz_ok(v.auth_id) then raise exception 'Die Lizenz ist abgelaufen. Bitte bei Root Index melden.' using errcode = '42501'; end if;
  if not public._fp_vertrag_ok(v.auth_id) then raise exception 'Bitte zuerst die Verschwiegenheitsvereinbarung bestätigen.' using errcode = '42501'; end if;
  return v;
end $$;

-- Darf die angemeldete Fachperson die Daten zu diesem Key sehen?
-- Liefert Benutzer_ID und daten_ab, sonst Fehler 42501. NUR fuer andere
-- SECURITY-DEFINER-Funktionen (FL-4), nicht direkt aufrufbar.
create or replace function public._fp_klient(p_code text, out benutzer_id text, out daten_ab date)
language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid();
begin
  select b."Benutzer_ID", case when e.aeltere_freigegeben then date '1900-01-01' else e.daten_ab end
    into benutzer_id, daten_ab
    from public.gratis_code g
    join public.fachperson_konto f on f.auth_id = g.fachperson_auth and f.aktiv
    join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    join public."Benutzer" b on b.auth_id = g.klient_auth
   where g.code = upper(trim(p_code))
     and g.fachperson_auth = v_uid
     and public._fp_vertrag_ok(v_uid)
     and public._fp_lizenz_ok(v_uid)
     and public._fp_key_laeuft(g)
     and e.einwilligung_am is not null and e.widerruf_am is null
   limit 1;
  if benutzer_id is null then raise exception 'Kein Zugriff auf diesen Klienten.' using errcode = '42501'; end if;
end $$;

-- Premium: Fachperson solange aktiv mit gueltiger Lizenz (Gruenderin lebenslang), Klient solange sein Key laeuft
create or replace function public.cb_ist_premium(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select (coalesce(b.is_premium,false) and (b.premium_bis is null or b.premium_bis > now()))
        or coalesce(b.trial_bis > now(), false)
        or coalesce(b.subscription_status = 'active', false)
        or coalesce(b.subscription_status = 'trialing' and b.trial_bis > now(), false)
      from public."Benutzer" b where b.auth_id = p_auth limit 1), false)
  or exists (select 1 from public.fachperson_konto f where f.auth_id = p_auth and f.aktiv
               and (f.lizenz_art = 'gruenderin_gratis' or f.lizenz_bis is null or f.lizenz_bis > now()))
  or exists (select 1 from public.gratis_code g
              where g.klient_auth = p_auth and g.fachperson_auth is not null
                and g.beendet_am is null and g.laeuft_bis > now());
$$;

-- Eigenes Abo neben dem Key? (Hinweis zum Selbstkuendigen)
create or replace function public._fp_eigenes_abo(p_auth uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select b.subscription_status in ('active','trialing')
                       or (b.abo_quelle is not null and b.current_period_end > now())
                     from public."Benutzer" b where b.auth_id = p_auth limit 1), false);
$$;

-- 5) Code-Einloesung (klientin.html) erweitern ---------------------------
create or replace function public.cb_gratis_code_info(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.gratis_code; v_fp public.fachperson_konto;
begin
  select * into v from public.gratis_code where code = upper(trim(p_code));
  if not found or not v.aktiv then return jsonb_build_object('gueltig',false,'grund','Diesen Code gibt es nicht.'); end if;
  if v.gueltig_bis is not null and v.gueltig_bis < now() then return jsonb_build_object('gueltig',false,'grund','Der Code ist abgelaufen.'); end if;
  if v.beendet_am is not null then return jsonb_build_object('gueltig',false,'grund','Der Code wurde beendet.'); end if;
  if v.max_einloesungen is not null and v.eingeloest >= v.max_einloesungen then return jsonb_build_object('gueltig',false,'grund','Der Code wurde schon eingelöst.'); end if;
  if v.fachperson_auth is not null then
    select * into v_fp from public.fachperson_konto where auth_id = v.fachperson_auth;
    if not coalesce(v_fp.aktiv,false) then return jsonb_build_object('gueltig',false,'grund','Der Code ist nicht mehr gültig.'); end if;
    return jsonb_build_object('gueltig',true,'tage',v.tage,'fachperson',v_fp.name,'praxis',v_fp.praxis);
  end if;
  return jsonb_build_object('gueltig',true,'tage',v.tage);
end $$;

-- p_wechsel: Klient bestaetigt den Uebertrag zu einer anderen Fachperson
drop function if exists public.cb_gratis_code_einloesen(text);
create or replace function public.cb_gratis_code_einloesen(p_code text, p_wechsel boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_c public.gratis_code; v_bis timestamptz; v_code text := upper(trim(p_code));
        v_fp public.fachperson_konto; v_alt record;
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
    select * into v_fp from public.fachperson_konto where auth_id = v_c.fachperson_auth;
    if not coalesce(v_fp.aktiv,false) then return jsonb_build_object('ok',false,'grund','Der Code ist nicht mehr gültig.'); end if;
    if v_c.fachperson_auth = v_uid then return jsonb_build_object('ok',false,'grund','Den eigenen Klienten-Code kann man nicht selbst einlösen.'); end if;
    -- Ein Klient hat immer nur EINE Fachperson
    perform pg_advisory_xact_lock(hashtext('fp_klient:' || v_uid::text));
    select g.code, g.fachperson_auth, f.name into v_alt
      from public.gratis_code g join public.fachperson_konto f on f.auth_id = g.fachperson_auth
     where g.klient_auth = v_uid and public._fp_key_laeuft(g) limit 1;
    if v_alt.code is not null then
      if v_alt.fachperson_auth = v_c.fachperson_auth then
        return jsonb_build_object('ok',false,'grund','Du hast schon einen laufenden Code von ' || v_alt.name || '. Die Fachperson kann ihn verlängern.');
      end if;
      if not coalesce(p_wechsel,false) then
        return jsonb_build_object('ok',false,'wechsel_noetig',true,'bisherige_fachperson',v_alt.name,'neue_fachperson',v_fp.name,
          'grund','Du bist gerade mit ' || v_alt.name || ' verbunden. Mit diesem Code wechselst du zu ' || v_fp.name || '.');
      end if;
      -- Uebertrag: alter Key endet jetzt, alte Fachperson sieht nichts mehr
      update public.gratis_code set beendet_am = now(), beendet_grund = 'wechsel', aktiv = false,
             laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
       where code = v_alt.code;
      insert into public.fachperson_einwilligung_log(code, klient_auth, aktion) values (v_alt.code, v_uid, 'wechsel');
    end if;
    insert into public.gratis_code_einloesung(code, auth_id, tage) values (v_code, v_uid, v_c.tage);
    update public.gratis_code set eingeloest = eingeloest + 1, klient_auth = v_uid, start_am = now(),
           laeuft_bis = now() + make_interval(days => v_c.tage)
     where code = v_code returning laeuft_bis into v_bis;
    insert into public.fachperson_einwilligung(code, klient_auth) values (v_code, v_uid) on conflict (code) do nothing;
    -- Versand-E-Mail wird nach dem Einloesen nicht mehr gebraucht (Datensparsamkeit)
    update public.fp_key_mail_log set an_email = null where code = v_code and an_email is not null;
    return jsonb_build_object('ok',true,'tage',v_c.tage,'premium_bis',v_bis,'code',v_code,
                              'fachperson',v_fp.name,'praxis',v_fp.praxis,'einwilligung_offen',true,
                              'gewechselt_von', v_alt.name, 'eigenes_abo', public._fp_eigenes_abo(v_uid));
  end if;

  insert into public.gratis_code_einloesung(code, auth_id, tage) values (v_code, v_uid, v_c.tage);
  update public.gratis_code set eingeloest = eingeloest + 1 where code = v_code;
  v_bis := public._testzeit_verlaengern(v_uid, v_c.tage);
  return jsonb_build_object('ok',true,'tage',v_c.tage,'premium_bis',v_bis);
end $$;
grant execute on function public.cb_gratis_code_einloesen(text, boolean) to authenticated;
revoke all on function public.cb_gratis_code_einloesen(text, boolean) from public, anon;

-- 6) Klient: Status, Fachperson, Bestaetigung, Einwilligung, Widerruf ----
-- Fuer App und Web: laufender Key? ehemaliger Klient (fuer das 3,99-Angebot)? eigenes Abo?
create or replace function public.cb_klient_status()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_lauf public.gratis_code; v_ende timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok',false); end if;
  select * into v_lauf from public.gratis_code g where g.klient_auth = v_uid and public._fp_key_laeuft(g) limit 1;
  select max(least(g.laeuft_bis, coalesce(g.beendet_am, g.laeuft_bis))) into v_ende
    from public.gratis_code g where g.klient_auth = v_uid and g.fachperson_auth is not null;
  return jsonb_build_object('ok',true,
    'klient', v_lauf.code is not null,
    'laeuft_bis', v_lauf.laeuft_bis,
    -- ehemaliger Klient: hatte einen Fachperson-Key, keiner laeuft mehr -> Angebot 3,99 EUR/Monat
    'ehemaliger_klient', v_lauf.code is null and v_ende is not null,
    'ehemals_seit', case when v_lauf.code is null then v_ende end,
    'eigenes_abo', public._fp_eigenes_abo(v_uid));
end $$;

create or replace function public.cb_meine_fachpersonen()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); t public.fachperson_einwilligung_text; v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  select * into t from public.fachperson_einwilligung_text where gilt_ab <= now() order by gilt_ab desc limit 1;
  return jsonb_build_object('ok',true,'eigenes_abo',public._fp_eigenes_abo(v_uid),'liste', coalesce((
    select jsonb_agg(x.j order by x.s desc) from (
      select g.start_am s, jsonb_build_object(
        'code', g.code, 'fachperson', f.name, 'praxis', f.praxis,
        'laeuft_bis', g.laeuft_bis, 'laeuft', public._fp_key_laeuft(g), 'beendet_grund', g.beendet_grund,
        'besprochen_am', e.besprochen_am,
        'einwilligung_am', e.einwilligung_am, 'widerruf_am', e.widerruf_am,
        'daten_ab', e.daten_ab, 'aeltere_freigegeben', e.aeltere_freigegeben,
        'einwilligung_aktiv', (e.einwilligung_am is not null and e.widerruf_am is null),
        'text_version', t.version,
        'text', replace(replace(t.text, '{fachperson}', w.wer), '{ab}', to_char(w.ab, 'DD.MM.YYYY')),
        'text_aeltere', replace(replace(t.text_aeltere, '{fachperson}', f.name), '{ab}', to_char(w.ab, 'DD.MM.YYYY')),
        'text_besprochen', replace(t.text_besprochen, '{fachperson}', f.name)) j
      from public.gratis_code g
      join public.fachperson_konto f on f.auth_id = g.fachperson_auth
      left join public.fachperson_einwilligung e on e.code = g.code
      cross join lateral (select f.name || coalesce(' (' || f.praxis || ')','') wer,
                                 coalesce(case when e.einwilligung_am is not null and e.widerruf_am is null then e.daten_ab end, v_heute) ab) w
      where g.klient_auth = v_uid and g.fachperson_auth is not null) x), '[]'::jsonb));
end $$;

-- Ein Aufruf speichert die Pflicht-Bestaetigung "besprochen" und - falls
-- p_einwilligen - die Einwilligung (optional auch fuer aeltere Eintraege).
create or replace function public.cb_fachperson_einwilligen(p_code text, p_besprochen boolean, p_einwilligen boolean,
                                                            p_aeltere boolean default false, p_version text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_c public.gratis_code; v_ver text; v_ab date := (now() at time zone 'Europe/Berlin')::date;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  select * into v_c from public.gratis_code where code = upper(trim(p_code));
  if not found or v_c.klient_auth is distinct from v_uid or v_c.fachperson_auth is null then
    return jsonb_build_object('ok',false,'grund','Dieser Code gehört nicht zu deinem Konto.'); end if;
  if not public._fp_key_laeuft(v_c) then return jsonb_build_object('ok',false,'grund','Der Code ist nicht mehr aktiv.'); end if;
  if not coalesce(p_besprochen,false) then
    return jsonb_build_object('ok',false,'grund','Bitte bestätige, dass du mit deiner Fachperson über die Verschwiegenheit gesprochen hast.'); end if;
  select version into v_ver from public.fachperson_einwilligung_text where gilt_ab <= now() order by gilt_ab desc limit 1;
  if coalesce(p_einwilligen,false) and p_version is distinct from v_ver then
    return jsonb_build_object('ok',false,'grund','Der Einwilligungstext hat sich geändert. Bitte Seite neu laden.'); end if;

  insert into public.fachperson_einwilligung(code, klient_auth) values (v_c.code, v_uid) on conflict (code) do nothing;
  update public.fachperson_einwilligung set besprochen_am = coalesce(besprochen_am, now()) where code = v_c.code
    and besprochen_am is null;
  if found then
    insert into public.fachperson_einwilligung_log(code, klient_auth, aktion, version) values (v_c.code, v_uid, 'besprochen', v_ver);
  end if;

  if coalesce(p_einwilligen,false) then
    update public.fachperson_einwilligung fe set einwilligung_am = now(), version = v_ver,
       aeltere_freigegeben = coalesce(p_aeltere,false),
       -- erneute Einwilligung nach Widerruf: wieder ab heute; sonst bleibt das erste Datum
       daten_ab = case when fe.widerruf_am is null and fe.daten_ab is not null then fe.daten_ab else v_ab end,
       widerruf_am = null
     where fe.code = v_c.code;
    insert into public.fachperson_einwilligung_log(code, klient_auth, aktion, version, aeltere_freigegeben)
    values (v_c.code, v_uid, 'erteilt', v_ver, coalesce(p_aeltere,false));
  end if;
  return jsonb_build_object('ok',true,'eingewilligt',coalesce(p_einwilligen,false));
end $$;

create or replace function public.cb_fachperson_widerrufen(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_code text := upper(trim(p_code));
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  update public.fachperson_einwilligung set widerruf_am = now(), aeltere_freigegeben = false
   where code = v_code and klient_auth = v_uid and einwilligung_am is not null and widerruf_am is null;
  if not found then return jsonb_build_object('ok',false,'grund','Keine aktive Einwilligung zu diesem Code.'); end if;
  insert into public.fachperson_einwilligung_log(code, klient_auth, aktion) values (v_code, v_uid, 'widerrufen');
  return jsonb_build_object('ok',true);
end $$;

-- 7) Fachperson: Konto, Vertrag, Keys ------------------------------------
create or replace function public.cb_fp_ich()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $$
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
    'vertrag_bestaetigt_am', (select am from public.fachperson_vertrag_bestaetigung b where b.auth_id = v.auth_id and b.version = t.version));
end $$;

create or replace function public.cb_fp_vertrag_bestaetigen(p_version text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_ver text := public._fp_vertrag_aktuell();
begin
  if not exists (select 1 from public.fachperson_konto where auth_id = auth.uid() and aktiv) then
    raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  if p_version is distinct from v_ver then return jsonb_build_object('ok',false,'grund','Der Vertragstext hat sich geändert. Bitte Seite neu laden.'); end if;
  insert into public.fachperson_vertrag_bestaetigung(auth_id, version) values (auth.uid(), v_ver) on conflict do nothing;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cb_fp_keys()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', g.code, 'bezeichnung', g.bezeichnung, 'tage', g.tage, 'erstellt_am', g.erstellt_am,
      'start_am', g.start_am, 'laeuft_bis', g.laeuft_bis, 'beendet_am', g.beendet_am, 'beendet_grund', g.beendet_grund,
      'status', case when g.beendet_am is not null then 'beendet'
                     when g.klient_auth is null then 'offen'
                     when g.laeuft_bis > now() then 'laeuft' else 'abgelaufen' end,
      'besprochen', e.besprochen_am is not null,
      'einwilligung', case when e.einwilligung_am is null then 'keine'
                           when e.widerruf_am is not null then 'widerrufen' else 'erteilt' end,
      'daten_ab', case when e.widerruf_am is null and e.einwilligung_am is not null then e.daten_ab end,
      'aeltere_freigegeben', coalesce(e.aeltere_freigegeben and e.widerruf_am is null, false),
      'mail_an', m.an_email, 'mail_am', m.am,
      -- Name des Klienten nur bei laufendem Key UND aktiver Einwilligung
      'klient_name', case when public._fp_key_laeuft(g) and e.einwilligung_am is not null and e.widerruf_am is null
                          then (select b."Name" from public."Benutzer" b where b.auth_id = g.klient_auth limit 1) end
    ) order by g.erstellt_am desc)
    from public.gratis_code g
    left join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    left join lateral (select l.an_email, l.am from public.fp_key_mail_log l
                        where l.code = g.code and l.status = 'gesendet' order by l.am desc limit 1) m on true
    where g.fachperson_auth = v.auth_id), '[]'::jsonb);
end $$;

create or replace function public.cb_fp_key_anlegen(p_tage integer, p_bezeichnung text default null, p_vereinbarung_bestaetigt boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); v_code text; v_z text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
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
end $$;

-- Laufzeit verlaengern (p_menge > 0) oder kuerzen (p_menge < 0); Einheit tage|wochen|monate
create or replace function public.cb_fp_key_laufzeit(p_code text, p_menge integer, p_einheit text default 'tage')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_iv interval; v_tage int; v_bis timestamptz;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id for update;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
  if g.beendet_am is not null then return jsonb_build_object('ok',false,'grund','Der Key ist beendet. Bitte einen neuen Key anlegen.'); end if;
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
end $$;

create or replace function public.cb_fp_key_beenden(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  update public.gratis_code set beendet_am = now(), beendet_grund = 'fachperson', aktiv = false,
         laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id and beendet_am is null;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht, oder er ist schon beendet.' using errcode = '42501'; end if;
  update public.fp_key_mail_log set an_email = null where code = upper(trim(p_code)) and an_email is not null;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cb_fp_key_bezeichnung(p_code text, p_bezeichnung text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  update public.gratis_code set bezeichnung = nullif(left(trim(coalesce(p_bezeichnung,'')),80),'')
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
  return jsonb_build_object('ok',true);
end $$;

-- 7b) Einlöse-Link per E-Mail (Ralph 11.11.) ------------------------------
-- Die Edge-Funktion fp-key-mail ruft cb_fp_key_mail_vorbereiten MIT dem
-- Login der Fachperson auf (Pruefung + Sperre hier), sendet per SMTP und
-- traegt das Ergebnis mit Dienstrechten nach. E-Mail des Klienten nur fuer
-- den Versand; nach Einloesen oder Beenden wird sie geloescht.
create table if not exists public.fp_key_mail_log (
  id bigserial primary key,
  code text not null references public.gratis_code(code),
  fachperson_auth uuid not null references public.fachperson_konto(auth_id),
  an_email text,
  am timestamptz not null default now(),
  status text not null default 'vorbereitet' check (status in ('vorbereitet','gesendet','fehler')),
  fehler text
);
alter table public.fp_key_mail_log enable row level security;
revoke all on public.fp_key_mail_log from anon, authenticated;
create index if not exists fp_key_mail_log_fp_am on public.fp_key_mail_log(fachperson_auth, am);
create index if not exists fp_key_mail_log_code on public.fp_key_mail_log(code);
-- Grenzen gegen Massenversand (umschaltbar)
insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('mail_je_key_tag','3','Hoechstens so viele Einladungs-Mails je Key in 24 Stunden'),
  ('mail_je_fachperson_tag','30','Hoechstens so viele Einladungs-Mails je Fachperson in 24 Stunden')
on conflict (schluessel) do nothing;

create or replace function public.cb_fp_key_mail_vorbereiten(p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_mail text := lower(trim(coalesce(p_email,'')));
        v_id bigint; v_max_key int; v_max_fp int; v_fp_mail text;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
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
-- Keys zaehlen nur bis jetzt, nicht im Voraus.
create or replace function public._fp_key_tage(p_start timestamptz, p_ende timestamptz, p_monat date)
returns integer language sql immutable set search_path to pg_catalog as $$
  with t as (
    select (p_start at time zone 'Europe/Berlin')::date s,
           greatest((p_ende at time zone 'Europe/Berlin')::date, (p_start at time zone 'Europe/Berlin')::date + 1) e,
           date_trunc('month', p_monat)::date ma,
           (date_trunc('month', p_monat) + interval '1 month')::date me)
  select case when p_start is null then 0 else greatest(0, least(e, me) - greatest(s, ma)) end from t;
$$;

-- Je Fachperson und Monat: Keys mit mind. 1 aktivem Tag (Modell "monat"),
-- Key-Tage (Modell "tag"), neu eingeloeste Keys, Lizenz und Betrag.
-- 11.11.2026 (Ralph jaja): Key-Preis und Abrechnungsmodell je Fachperson,
-- leer = globaler Standard aus fachleute_einstellung. Modelle:
--   je_key            nur Keys
--   lizenz_pauschal   nur Lizenz, Keys inklusive
--   lizenz_plus_keys  Lizenz + Keys
--   gratis            nichts
-- Lizenz wird nur bei lizenz_art = 'lizenz_bezahlt' berechnet, solange sie in
-- dem Monat gilt; Intervall 'jahr' = voller Preis im Jahrestag-Monat von "seit".
drop function if exists public._fp_abrechnung(uuid, date);
create or replace function public._fp_abrechnung(p_fp uuid, p_monat date)
returns table(fachperson_auth uuid, monat date, keys_aktiv integer, key_tage integer, keys_neu integer,
              abrechnung text, preis_cent integer, betrag_cent integer,
              lizenz_art text, lizenz_preis_cent integer, lizenz_intervall text, lizenz_bis timestamptz,
              modell text, keys_betrag_cent integer, lizenz_betrag_cent integer)
language sql stable security definer set search_path to 'public' as $$
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
           coalesce(f.key_preis_cent, e.preis) kp,
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
$$;
revoke all on function public._fp_abrechnung(uuid, date) from public, anon, authenticated;

create or replace function public.cb_fp_abrechnung(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); r record;
begin
  select * into r from public._fp_abrechnung(v.auth_id, p_monat);
  return jsonb_build_object('monat', r.monat, 'keys_aktiv', r.keys_aktiv, 'key_tage', r.key_tage, 'keys_neu', r.keys_neu,
                            'abrechnung', r.abrechnung, 'preis_cent', r.preis_cent, 'betrag_cent', r.betrag_cent,
                            'modell', r.modell, 'keys_betrag_cent', r.keys_betrag_cent, 'lizenz_betrag_cent', r.lizenz_betrag_cent,
                            'lizenz_art', r.lizenz_art, 'lizenz_preis_cent', r.lizenz_preis_cent, 'lizenz_intervall', r.lizenz_intervall);
end $$;

-- 9b) Anschluss-Angebot fuer ehemalige Klienten ---------------------------
-- App Store Connect: Angebotscode "Therapie-Anschluss 3,99" (3,99 EUR/Monat
-- fuer 12 Monate, danach 4,99; nur DE). Ralph laedt Einmalcodes hoch, jeder
-- ehemalige Klient bekommt hoechstens EINEN (bleibt ihm fest zugeordnet).
create table if not exists public.angebot_code (
  code text primary key,
  art text not null default 'therapie_anschluss_399',
  hochgeladen_am timestamptz not null default now(),
  vergeben_an uuid references auth.users(id) on delete set null,
  vergeben_am timestamptz
);
alter table public.angebot_code enable row level security;
revoke all on public.angebot_code from anon, authenticated;
create unique index if not exists angebot_code_einmal_je_nutzer on public.angebot_code(art, vergeben_an) where vergeben_an is not null;

create or replace function public.cb_mein_anschluss_angebot()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); s jsonb; v_code text;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  s := public.cb_klient_status();
  -- schon vergeben? dann immer denselben zeigen
  select code into v_code from public.angebot_code where art = 'therapie_anschluss_399' and vergeben_an = v_uid;
  if v_code is null then
    if not coalesce((s->>'ehemaliger_klient')::boolean,false) then return jsonb_build_object('ok',true,'angebot',false); end if;
    if coalesce((s->>'eigenes_abo')::boolean,false) then return jsonb_build_object('ok',true,'angebot',false,'grund','eigenes_abo'); end if;
    perform pg_advisory_xact_lock(hashtext('angebot:' || v_uid::text));
    select code into v_code from public.angebot_code where art = 'therapie_anschluss_399' and vergeben_an is null
     order by hochgeladen_am, code limit 1 for update skip locked;
    if v_code is null then return jsonb_build_object('ok',true,'angebot',true,'code',null,'grund','Zurzeit kein Code verfügbar.'); end if;
    update public.angebot_code set vergeben_an = v_uid, vergeben_am = now() where code = v_code;
  end if;
  return jsonb_build_object('ok',true,'angebot',true,'code',v_code,'preis','3,99 € im Monat für 12 Monate, danach 4,99 €',
    'apple_url','https://apps.apple.com/redeem?ctx=offercodes&id=6818112011&code=' || v_code);
end $$;

create or replace function public.cb_admin_angebot_codes_hochladen(p_codes text[], p_art text default 'therapie_anschluss_399')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  insert into public.angebot_code(code, art)
  select distinct upper(trim(c)), p_art from unnest(p_codes) c where trim(coalesce(c,'')) <> ''
  on conflict (code) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ok',true,'neu',n,
    'frei',(select count(*) from public.angebot_code where art = p_art and vergeben_an is null),
    'vergeben',(select count(*) from public.angebot_code where art = p_art and vergeben_an is not null));
end $$;

-- 10) Admin -------------------------------------------------------------
create or replace function public.cb_admin_fachperson_setzen(p_email text, p_name text default null, p_kuerzel text default null,
                                                             p_praxis text default null, p_aktiv boolean default true,
                                                             p_lizenz_art text default null, p_lizenz_bis timestamptz default null,
                                                             p_lizenz_preis_cent integer default null, p_lizenz_intervall text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_uid uuid; v_alt public.fachperson_konto; v_kz text := upper(regexp_replace(coalesce(p_kuerzel,''),'[^A-Za-z0-9]','','g'));
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Zu dieser E-Mail gibt es noch kein Konto. Die Fachperson legt es auf root-index.de/therapeut.html an.'); end if;
  select * into v_alt from public.fachperson_konto where auth_id = v_uid;
  if v_alt.auth_id is null then
    if coalesce(p_name,'') = '' or v_kz = '' then return jsonb_build_object('ok',false,'grund','Name und Kürzel nötig.'); end if;
    if p_lizenz_art is null then return jsonb_build_object('ok',false,'grund','Lizenzart nötig: gruenderin_gratis oder lizenz_bezahlt.'); end if;
    if v_kz !~ '^[A-Z0-9]{3,16}$' then return jsonb_build_object('ok',false,'grund','Kürzel: 3–16 Buchstaben oder Ziffern.'); end if;
    if exists (select 1 from public.fachperson_konto k where k.kuerzel = v_kz) then return jsonb_build_object('ok',false,'grund','Kürzel gehört schon zu einem anderen Konto.'); end if;
    -- Kuerzel-Verzeichnis (vorhanden seit 26.10.) ergaenzen, falls neu
    insert into public.fachperson(kuerzel, name, email, eigener_code, klienten_code, status)
    values (v_kz, trim(p_name), lower(trim(p_email)), '-', v_kz || '-*', 'konto')
    on conflict (kuerzel) do nothing;
    insert into public.fachperson_konto(auth_id, name, praxis, kuerzel, aktiv, lizenz_art, lizenz_bis, lizenz_preis_cent, lizenz_intervall)
    values (v_uid, trim(p_name), nullif(trim(coalesce(p_praxis,'')),''), v_kz, coalesce(p_aktiv,true),
            p_lizenz_art, p_lizenz_bis, p_lizenz_preis_cent, p_lizenz_intervall);
  else
    update public.fachperson_konto set name = coalesce(nullif(trim(coalesce(p_name,'')),''), name),
           praxis = coalesce(nullif(trim(coalesce(p_praxis,'')),''), praxis),
           aktiv = coalesce(p_aktiv, aktiv),   -- Kuerzel bleibt fest (steckt in den ausgegebenen Codes)
           lizenz_art = coalesce(p_lizenz_art, lizenz_art), lizenz_bis = coalesce(p_lizenz_bis, lizenz_bis),
           lizenz_preis_cent = coalesce(p_lizenz_preis_cent, lizenz_preis_cent), lizenz_intervall = coalesce(p_lizenz_intervall, lizenz_intervall)
     where auth_id = v_uid;
  end if;
  if p_aktiv = false then
    -- deaktiviert: alle laufenden Keys dieser Fachperson enden jetzt
    update public.gratis_code set beendet_am = now(), beendet_grund = 'admin', aktiv = false,
           laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
     where fachperson_auth = v_uid and beendet_am is null;
  end if;
  return jsonb_build_object('ok',true,'fachperson',(select to_jsonb(f) from public.fachperson_konto f where auth_id = v_uid));
end $$;

-- Preis/Modell je Fachperson genau setzen. NULL = globaler Standard (bzw. leer).
create or replace function public.cb_admin_fachperson_abrechnung(p_email text, p_modell text default null, p_key_preis_cent integer default null,
                                                                 p_lizenz_preis_cent integer default null, p_lizenz_intervall text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_uid uuid;
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  select f.auth_id into v_uid from public.fachperson_konto f join auth.users u on u.id = f.auth_id where lower(u.email) = lower(trim(p_email));
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Keine Fachperson mit dieser E-Mail.'); end if;
  if p_modell is not null and p_modell not in ('je_key','lizenz_pauschal','lizenz_plus_keys','gratis') then
    return jsonb_build_object('ok',false,'grund','Modell: je_key, lizenz_pauschal, lizenz_plus_keys oder gratis.'); end if;
  update public.fachperson_konto set abrechnungsmodell = p_modell, key_preis_cent = p_key_preis_cent,
         lizenz_preis_cent = p_lizenz_preis_cent, lizenz_intervall = p_lizenz_intervall
   where auth_id = v_uid;
  return jsonb_build_object('ok',true,'fachperson',(select to_jsonb(f) from public.fachperson_konto f where auth_id = v_uid));
end $$;

create or replace function public.cb_admin_fachleute(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name',f.name,'praxis',f.praxis,'kuerzel',f.kuerzel,'aktiv',f.aktiv,
             'email',(select email from auth.users u where u.id = f.auth_id),
             'vertrag_ok', public._fp_vertrag_ok(f.auth_id),
             'monat',a.monat,'keys_aktiv',a.keys_aktiv,'key_tage',a.key_tage,'keys_neu',a.keys_neu,
             'abrechnung',a.abrechnung,'betrag_cent',a.betrag_cent,'modell',a.modell,'key_preis_cent',a.preis_cent,
             'keys_betrag_cent',a.keys_betrag_cent,'lizenz_betrag_cent',a.lizenz_betrag_cent,
             'lizenz_art',a.lizenz_art,'lizenz_preis_cent',a.lizenz_preis_cent,'lizenz_intervall',a.lizenz_intervall,'lizenz_bis',a.lizenz_bis,
             'keys_gesamt',(select count(*) from public.gratis_code g where g.fachperson_auth = f.auth_id)) order by f.name)
      from public.fachperson_konto f
      join public._fp_abrechnung(null, p_monat) a on a.fachperson_auth = f.auth_id), '[]'::jsonb);
end $$;

-- 11) Rechte ------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array[
    'public._fp_key_laeuft(public.gratis_code)', 'public._fp_vertrag_aktuell()', 'public._fp_vertrag_ok(uuid)',
    'public._fp_ich()', 'public._fp_klient(text)', 'public._fp_eigenes_abo(uuid)', 'public._fp_lizenz_ok(uuid)',
    'public._fp_key_tage(timestamptz, timestamptz, date)', 'public._fp_abrechnung(uuid, date)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.cb_klient_status()',
    'public.cb_meine_fachpersonen()',
    'public.cb_fachperson_einwilligen(text, boolean, boolean, boolean, text)',
    'public.cb_fachperson_widerrufen(text)',
    'public.cb_fp_ich()',
    'public.cb_fp_vertrag_bestaetigen(text)',
    'public.cb_fp_keys()',
    'public.cb_fp_key_anlegen(integer, text, boolean)',
    'public.cb_fp_key_laufzeit(text, integer, text)',
    'public.cb_fp_key_beenden(text)',
    'public.cb_fp_key_bezeichnung(text, text)',
    'public.cb_fp_klient_tagessummen(text, date, date)',
    'public.cb_fp_abrechnung(date)',
    'public.cb_admin_fachperson_setzen(text, text, text, text, boolean, text, timestamptz, integer, text)',
    'public.cb_admin_fachleute(date)',
    'public.cb_admin_fachperson_abrechnung(text, text, integer, integer, text)',
    'public.cb_mein_anschluss_angebot()',
    'public.cb_fp_key_mail_vorbereiten(text, text)',
    'public.cb_admin_angebot_codes_hochladen(text[], text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
