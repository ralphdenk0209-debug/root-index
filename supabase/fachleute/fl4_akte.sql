-- =====================================================================
-- FL-4 Klientenakte gemeinsam bearbeiten + Snack-Zeiten (Ralph 11.11.2026)
-- Ralph: „die persönlichen daten sollen die therapeutin zusammen mit der patientin anlegen und
-- bearbeiten können, auch wenn die patientin vorbefüllt hat, wie auch z.b. diabetes, größe,
-- gewicht, ziel, ggf sportpläne usw.“
-- Setzt fl1_fundament.sql, fl4_dashboard.sql, fl4_wochenplan.sql voraus.
--
-- * Neue Einwilligungsfassung fl4-2026-11-12 (= fl4-2026-11-11 + Absatz „gemeinsam ändern“),
--   Spalte mit_bearbeiten. Ohne Zustimmung zu dieser Fassung darf die Fachkraft nur lesen.
-- * Die Fachkraft schreibt nur diese Profilfelder: Geschlecht, Geburtsdatum, Größe, Gewicht,
--   Aktivität, Ernährungsform, Diabetes-Typ, Unverträglichkeiten – dieselben Werte, die auch
--   App und Web erlauben. Keine Zyklus-, Schwangerschafts-, Abo- oder Kontodaten.
-- * Ziel in Worten, Sport/Bewegung und eine gemeinsame Notiz stehen in fl_akte, je Fachkraft
--   und Person (nach einem Wechsel sieht die neue Fachkraft die alte Akte nicht).
-- * Jede Änderung landet in fl_akte_protokoll (wer, wann, Feld, alt, neu).
-- * Snack-Zeiten (Absprache FL-5): Slot bleibt 'Snack', neue Spalte snack_zeit
--   ('vormittags','nachmittags','abends','spaet') – alte Apps zeigen weiter „Snack“.
-- * Nachtplan 11./12.11.: private Notiz und Diagnose-Stichworte je Person (nur für die Fachkraft,
--   brauchen keine Bearbeiten-Einwilligung, aber laufenden Key mit Einwilligung), Praxisdaten
--   (fl_praxis), öffentliche Vorführung ohne Passwort (fachleute_einstellung.muster_oeffentlich).
-- Keine bestehende Funktion ändert Name oder Signatur; _fl4_dashboard bleibt unverändert.
-- =====================================================================

-- 1) Einwilligung mit „gemeinsam bearbeiten“ --------------------------------
alter table public.fachperson_einwilligung_text add column if not exists mit_bearbeiten boolean not null default false;

insert into public.fachperson_einwilligung_text(version, text, text_aeltere, text_besprochen, mit_wochenplan, mit_bearbeiten)
select 'fl4-2026-11-12',
       replace(t.text, 'Zyklusdaten sind ausgenommen.',
         'Zyklusdaten sind ausgenommen.' || E'\n\n' ||
         'Außerdem darf {fachperson} gemeinsam mit mir meine Profilangaben zu Geschlecht, Geburtsdatum, Größe, Gewicht, '
         || 'Aktivität, Ernährungsform, Diabetes-Typ und Unverträglichkeiten anlegen und ändern sowie mein Ziel, '
         || 'Sport und Bewegung und gemeinsame Notizen in meiner Akte festhalten. Jede Änderung wird mit Datum gespeichert. '
         || 'Die geänderten Profilangaben gelten auch in meiner App.'),
       t.text_aeltere, t.text_besprochen, true, true
  from public.fachperson_einwilligung_text t
 where t.version = 'fl4-2026-11-11'
   and position('Zyklusdaten sind ausgenommen.' in t.text) > 0
on conflict (version) do nothing;

-- 2) Akte und Protokoll ---------------------------------------------------
create table if not exists public.fl_akte (
  fachperson_auth uuid not null,
  benutzer_id     text not null references public."Benutzer"("Benutzer_ID") on delete cascade,
  ziel_text       text check (length(ziel_text) <= 2000),
  sport_text      text check (length(sport_text) <= 2000),
  notiz_text      text check (length(notiz_text) <= 4000),
  privat_notiz    text check (length(privat_notiz) <= 8000),
  stichworte      text[] not null default '{}' check (coalesce(array_length(stichworte, 1), 0) <= 20),
  geaendert_am    timestamptz not null default now(),
  primary key (fachperson_auth, benutzer_id)
);
create table if not exists public.fl_akte_protokoll (
  id              bigint generated always as identity primary key,
  benutzer_id     text not null references public."Benutzer"("Benutzer_ID") on delete cascade,
  fachperson_auth uuid not null,
  code            text not null,
  feld            text not null,
  alt             jsonb,
  neu             jsonb,
  am              timestamptz not null default now()
);
create index if not exists fl_akte_protokoll_idx on public.fl_akte_protokoll(benutzer_id, am desc);
alter table public.fl_akte enable row level security;
alter table public.fl_akte_protokoll enable row level security;
revoke all on public.fl_akte, public.fl_akte_protokoll from anon, authenticated;

-- Musterpraxis: Akte-Texte der erfundenen Personen
alter table public.fl_muster_klient add column if not exists ziel_text text;
alter table public.fl_muster_klient add column if not exists sport_text text;
alter table public.fl_muster_klient add column if not exists notiz_text text;
alter table public.fl_muster_klient add column if not exists privat_notiz text;
alter table public.fl_muster_klient add column if not exists stichworte text[] not null default '{}';
update public.fl_muster_klient set
  ziel_text = case nr when 1 then 'Bis Sommer 5 kg leichter, ohne Heißhunger am Abend.'
                      when 2 then 'Blutzucker stabil halten (HbA1c unter 7 %), mehr Gemüse statt Brot am Abend.'
                      when 3 then 'Ausreichend Eiweiß als Vegetarierin, Energie für das Training.'
                      when 4 then 'Laktosefrei satt werden, regelmäßig essen trotz Schichtdienst.' end,
  sport_text = case nr when 1 then '2× Yoga, täglich 30 Minuten zu Fuß.'
                       when 2 then 'Nach dem Abendessen 20 Minuten spazieren, 1× Schwimmen.'
                       when 3 then '3× Krafttraining, 1× Laufen (10 km).'
                       when 4 then 'Kaum Zeit; Ziel: 2× Rad zur Arbeit.' end,
  notiz_text = case nr when 1 then 'Nächster Termin: Abendsnack-Alternativen besprechen.'
                       when 2 then 'Hausarzt-Werte zum nächsten Termin mitbringen.'
                       when 3 then 'Eiweiß je Mahlzeit verteilen, Hülsenfrüchte ausprobieren.'
                       when 4 then 'Vorbereitete Mahlzeiten für Nachtschichten planen.' end
 where ziel_text is null;
update public.fl_muster_klient set
  stichworte = case nr when 1 then array['Übergewicht (BMI 29)','Heißhunger abends']
                       when 2 then array['Diabetes Typ 2','Bluthochdruck','Fettstoffwechselstörung']
                       when 3 then array['Vegetarisch','Leistungssport','Eisenmangel']
                       when 4 then array['Laktoseintoleranz','Schichtdienst','Reizdarm'] end,
  privat_notiz = case nr when 1 then 'Motiviert, isst abends aus Stress. Nächstes Mal: Abendroutine besprechen.'
                         when 2 then 'Metformin laut Hausarzt. Mag kein Gemüse roh – gegart anbieten.'
                         when 3 then 'Ferritin niedrig (Hausarzt). Hülsenfrüchte + Vitamin C kombinieren.'
                         when 4 then 'Bauchschmerzen bei Stress; FODMAP-arme Phase erwägen.' end
 where privat_notiz is null;

-- 3) Snack-Zeiten ----------------------------------------------------------
alter table public.fl_muster_wochenplan add column if not exists snack_zeit text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fl_muster_wochenplan_snack_zeit_check') then
    alter table public.fl_muster_wochenplan add constraint fl_muster_wochenplan_snack_zeit_check
      check (snack_zeit is null or (slot = 'Snack' and snack_zeit in ('vormittags','nachmittags','abends','spaet')));
  end if;
end $$;

-- 4) Hilfen -----------------------------------------------------------------
-- Darf die Fachkraft (angemeldet) diese Person bearbeiten? Zugriff (_fp_klient) + Einwilligung mit_bearbeiten.
create or replace function public._fl_akte_darf(p_code text)
returns boolean language sql stable security definer set search_path = public as $f$
  select coalesce((select t.mit_bearbeiten
                     from public.gratis_code g
                     join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
                     join public.fachperson_einwilligung_text t on t.version = e.version
                    where g.code = upper(trim(p_code)) and g.fachperson_auth = auth.uid()), false)
$f$;

-- Zusatzteil fürs Dashboard: Profilfelder zum Bearbeiten, Akte, letzte Änderungen
create or replace function public._fl_akte_json(p_benutzer text, p_fachperson uuid, p_darf boolean)
returns jsonb language sql stable security definer set search_path = public as $f$
  select jsonb_build_object(
    'darf_bearbeiten', p_darf,
    'bearbeiten_hinweis', case when not p_darf then
       'Gemeinsam bearbeiten geht, sobald die Person der Einwilligung mit Bearbeiten zugestimmt hat (auf root-index.de/klientin.html).' end,
    'felder', case when p_darf then (select jsonb_build_object('geschlecht', b."Geschlecht", 'geburtsdatum', b."Geburtsdatum",
                 'groesse_cm', b."Groesse_cm", 'gewicht_kg', b."Gewicht_kg", 'aktivitaet', b."Aktivitaetslevel",
                 'ernaehrungsform', b."Ernaehrungsform", 'diabetes_typ', b."Diabetes_Typ",
                 'unvertraeglichkeiten', to_jsonb(coalesce(b."Unvertraeglichkeiten", array[]::text[])))
               from public."Benutzer" b where b."Benutzer_ID" = p_benutzer) end,
    'ziel_text', a.ziel_text, 'sport_text', a.sport_text, 'notiz_text', a.notiz_text, 'geaendert_am', a.geaendert_am,
    'privat_notiz', a.privat_notiz, 'stichworte', to_jsonb(coalesce(a.stichworte, '{}'::text[])),
    'protokoll', (select jsonb_agg(jsonb_build_object('feld', x.feld, 'alt', x.alt, 'neu', x.neu, 'am', x.am) order by x.am desc)
                    from (select * from public.fl_akte_protokoll pr
                           where pr.benutzer_id = p_benutzer and pr.fachperson_auth = p_fachperson
                           order by pr.am desc limit 20) x))
  from (select 1) d
  left join public.fl_akte a on a.fachperson_auth = p_fachperson and a.benutzer_id = p_benutzer
$f$;

-- 5) Speichern ---------------------------------------------------------------
-- p_daten: nur die geänderten Felder, z. B. {"gewicht_kg": 72.5, "ziel_text": "…"}.
-- Leerer String/null = Angabe löschen (bei Profilfeldern wie in der App).
create or replace function public.cb_fp_akte_setzen(p_code text, p_daten jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
#variable_conflict use_column
declare k record; v_uid uuid := auth.uid(); v_code text := upper(trim(p_code)); f text; v_alt jsonb; v_neu jsonb;
        v_txt text; v_num numeric; v_dat date; v_arr text[]; n int := 0;
        erlaubt text[] := array['geschlecht','geburtsdatum','groesse_cm','gewicht_kg','aktivitaet','ernaehrungsform',
                                'diabetes_typ','unvertraeglichkeiten','ziel_text','sport_text','notiz_text'];
begin
  select * into k from public._fp_klient(v_code);                         -- wirft 42501 ohne Recht
  if not public._fl_akte_darf(v_code) then
    raise exception 'Die Person hat dem gemeinsamen Bearbeiten noch nicht zugestimmt.' using errcode = '42501'; end if;
  if p_daten is null or jsonb_typeof(p_daten) <> 'object' then raise exception 'Keine Angaben übergeben.'; end if;

  for f in select jsonb_object_keys(p_daten) loop
    if not f = any(erlaubt) then raise exception 'Feld % kann hier nicht geändert werden.', f; end if;
    v_neu := p_daten -> f;
    if v_neu = 'null'::jsonb or v_neu = '""'::jsonb then v_neu := null; end if;
    v_txt := nullif(trim(v_neu #>> '{}'), '');

    if f = 'geschlecht' then
      if v_txt is not null and v_txt not in ('weiblich','männlich','divers') then raise exception 'Geschlecht ungültig.'; end if;
      select to_jsonb("Geschlecht") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
      update public."Benutzer" set "Geschlecht" = v_txt where "Benutzer_ID" = k.benutzer_id;
      v_neu := to_jsonb(v_txt);
    elsif f = 'geburtsdatum' then
      v_dat := v_txt::date;
      if v_dat is not null and (v_dat > current_date or v_dat < date '1900-01-01') then raise exception 'Geburtsdatum ungültig.'; end if;
      select to_jsonb("Geburtsdatum") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
      update public."Benutzer" set "Geburtsdatum" = v_dat,
             "Alter" = coalesce(extract(year from age(current_date, v_dat))::int, "Alter")
       where "Benutzer_ID" = k.benutzer_id;
      v_neu := to_jsonb(v_dat);
    elsif f in ('groesse_cm','gewicht_kg') then
      v_num := replace(v_txt, ',', '.')::numeric;
      if f = 'groesse_cm' and v_num is not null and (v_num < 50 or v_num > 250) then raise exception 'Größe bitte in cm (50–250).'; end if;
      if f = 'gewicht_kg' and v_num is not null and (v_num < 20 or v_num > 400) then raise exception 'Gewicht bitte in kg (20–400).'; end if;
      if f = 'groesse_cm' then
        select to_jsonb("Groesse_cm") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
        update public."Benutzer" set "Groesse_cm" = v_num where "Benutzer_ID" = k.benutzer_id;
      else
        select to_jsonb("Gewicht_kg") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
        update public."Benutzer" set "Gewicht_kg" = v_num where "Benutzer_ID" = k.benutzer_id;
      end if;
      v_neu := to_jsonb(v_num);
    elsif f = 'aktivitaet' then
      if v_txt is not null and v_txt not in ('Sitzend','Leicht aktiv','Mäßig aktiv','Sehr aktiv') then raise exception 'Aktivität ungültig.'; end if;
      select to_jsonb("Aktivitaetslevel") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
      update public."Benutzer" set "Aktivitaetslevel" = v_txt where "Benutzer_ID" = k.benutzer_id;
      v_neu := to_jsonb(v_txt);
    elsif f = 'ernaehrungsform' then
      if v_txt is not null and v_txt not in ('Omnivor','Flexitarisch','Pescetarisch','Vegetarisch','Vegan') then raise exception 'Ernährungsform ungültig.'; end if;
      select to_jsonb("Ernaehrungsform") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
      update public."Benutzer" set "Ernaehrungsform" = v_txt where "Benutzer_ID" = k.benutzer_id;
      v_neu := to_jsonb(v_txt);
    elsif f = 'diabetes_typ' then
      if v_txt is not null and v_txt not in ('typ1','typ2','praediabetes','gestationsdiabetes','sonstiger') then raise exception 'Diabetes-Typ ungültig.'; end if;
      select to_jsonb("Diabetes_Typ") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
      update public."Benutzer" set "Diabetes_Typ" = v_txt where "Benutzer_ID" = k.benutzer_id;
      v_neu := to_jsonb(v_txt);
    elsif f = 'unvertraeglichkeiten' then
      if v_neu is not null and jsonb_typeof(v_neu) <> 'array' then raise exception 'Unverträglichkeiten als Liste übergeben.'; end if;
      select coalesce(array_agg(distinct x order by x), array[]::text[]) into v_arr from jsonb_array_elements_text(coalesce(v_neu, '[]')) x;
      if exists (select 1 from unnest(v_arr) x where x not in ('laktose','gluten','krebstiere','ei','fisch','erdnuss','soja','milch',
                   'schalenfruechte','sellerie','senf','sesam','sulfite','lupinen','weichtiere')) then
        raise exception 'Unbekannte Unverträglichkeit.'; end if;
      select to_jsonb("Unvertraeglichkeiten") into v_alt from public."Benutzer" where "Benutzer_ID" = k.benutzer_id;
      update public."Benutzer" set "Unvertraeglichkeiten" = v_arr where "Benutzer_ID" = k.benutzer_id;
      v_neu := to_jsonb(v_arr);
    else  -- ziel_text, sport_text, notiz_text
      insert into public.fl_akte(fachperson_auth, benutzer_id) values (v_uid, k.benutzer_id) on conflict do nothing;
      execute format('select to_jsonb(%I) from public.fl_akte where fachperson_auth = $1 and benutzer_id = $2', f)
         into v_alt using v_uid, k.benutzer_id;
      execute format('update public.fl_akte set %I = $1, geaendert_am = now() where fachperson_auth = $2 and benutzer_id = $3', f)
         using v_txt, v_uid, k.benutzer_id;
      v_neu := to_jsonb(v_txt);
    end if;

    if v_alt is distinct from v_neu then
      insert into public.fl_akte_protokoll(benutzer_id, fachperson_auth, code, feld, alt, neu)
      values (k.benutzer_id, v_uid, v_code, f, v_alt, v_neu);
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'geaendert', n)
      || public._fl_akte_json(k.benutzer_id, v_uid, true);
end $f$;

-- 6) Dashboards ergänzen (Signaturen unverändert) ----------------------------
create or replace function public.cb_fp_klient_dashboard(p_code text, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare k record; v_von date; v_heute date := (now() at time zone 'Europe/Berlin')::date;
        r jsonb; v_plan boolean; v_wv date; v_p jsonb;
begin
  select * into k from public._fp_klient(p_code);                           -- wirft 42501 ohne Recht
  v_von := greatest(p_von, k.daten_ab);
  if v_von > p_bis then
    r := jsonb_build_object('von', p_von, 'bis', p_bis, 'leer', true, 'daten_ab', k.daten_ab, 'heute', v_heute,
                            'code', upper(trim(p_code)), 'grund', 'Einträge sind erst ab dem ' || to_char(k.daten_ab, 'DD.MM.YYYY') || ' freigegeben.');
  else
    r := public._fl4_dashboard(k.benutzer_id, v_von, p_bis)
      || jsonb_build_object('daten_ab', case when k.daten_ab > date '1900-01-01' then k.daten_ab end, 'heute', v_heute, 'code', upper(trim(p_code)));
    -- Prüfer 11.11.: Datenlage je Vitamin/Mineralstoff (Anteil der gegessenen Gramm mit Angaben, FL-2)
    r := r || jsonb_build_object('mikro_abdeckung', (select jsonb_object_agg(n.kennzahl, n.abdeckung_prozent)
             from public.cb_auswertung_naehrwerte(k.benutzer_id, v_von, p_bis, 'gesamt', true) n where n.kennzahl like 'mikro:%'));
  end if;

  select coalesce(t.mit_wochenplan, false) into v_plan
    from public.gratis_code g
    join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    join public.fachperson_einwilligung_text t on t.version = e.version
   where g.code = upper(trim(p_code));
  if coalesce(v_plan, false) then
    v_wv := date_trunc('week', v_heute)::date;
    -- Snack_Zeit kommt mit FL-5; to_jsonb liest die Spalte, sobald es sie gibt (vorher null)
    select jsonb_agg(jsonb_build_object('datum', w."Datum", 'slot', w."Slot", 'snack_zeit', to_jsonb(w) ->> 'Snack_Zeit',
             'rezept_id', w."Rezept_ID", 'titel', coalesce(r3."Rezeptname", p."Produktname", w."Titel"), 'kcal_portion', r3."Kcal_Portion")
             order by w."Datum", array_position(array['Frühstück','Mittag','Abendessen','Snack'], w."Slot"), w."Reihenfolge")
      into v_p
      from public."Wochenplan" w
      left join public."Rezepte" r3 on r3."Rezept_ID" = w."Rezept_ID"
      left join public."Produkte" p on p."Produkt_ID" = w."Produkt_ID"
     where w."Benutzer_ID" = k.benutzer_id and w."Datum" between greatest(v_wv, k.daten_ab) and v_wv + 13;
    r := (r - 'wochenplan_hinweis') || jsonb_build_object('wochenplan', coalesce(v_p, '[]'::jsonb), 'wochenplan_von', v_wv);
  else
    r := r || jsonb_build_object('wochenplan', null,
           'wochenplan_hinweis', 'Der Wochenplan wird sichtbar, sobald die Person der Einwilligung mit Wochenplan zugestimmt hat (auf root-index.de/klientin.html).');
  end if;
  return r || jsonb_build_object('akte', public._fl_akte_json(k.benutzer_id, auth.uid(), public._fl_akte_darf(p_code)));
end $f$;

create or replace function public.cb_fl_muster_dashboard(p_token text, p_nr int, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_bid text; m record; v_heute date := (now() at time zone 'Europe/Berlin')::date; v_wv date; v_ver int; v_plan jsonb;
begin
  if not public._fl_muster_token_ok(p_token) then raise exception 'Dieser Vorschau-Link gilt nicht mehr.' using errcode = '42501'; end if;
  select * into m from public.fl_muster_klient where nr = p_nr;               -- nur Musterklienten, nie eine freie ID
  v_bid := m.benutzer_id;
  if v_bid is null or not public._fl_muster_ist(v_bid) then raise exception 'Diesen Musterklienten gibt es nicht.' using errcode = '42501'; end if;
  v_wv := date_trunc('week', v_heute)::date; v_ver := public._fl_muster_versatz();
  -- Wochenplan mit Snack-Zeit und Produkt-Snacks (ersetzt den Teil aus _fl4_dashboard)
  select jsonb_agg(jsonb_build_object('datum', w.datum + v_ver, 'slot', w.slot, 'snack_zeit', w.snack_zeit, 'rezept_id', w.rezept_id,
           'produkt_id', w.produkt_id, 'menge_g', w.menge_g, 'titel', coalesce(r3."Rezeptname", w.titel),
           'kcal_portion', coalesce(r3."Kcal_Portion", round(nm."kcal_100g_ml" * w.menge_g / 100))) order by w.datum, w.reihenfolge)
    into v_plan
    from public.fl_muster_wochenplan w
    left join public."Rezepte" r3 on r3."Rezept_ID" = w.rezept_id
    left join public."Naehrwerte_Makro" nm on nm."Produkt_ID" = w.produkt_id
   where w.benutzer_id = v_bid and w.datum + v_ver between v_wv and v_wv + 13;
  return public._fl4_dashboard(v_bid, p_von, p_bis)
      || jsonb_build_object('heute', v_heute, 'code', m.code, 'wochenplan', coalesce(v_plan, '[]'::jsonb), 'wochenplan_von', v_wv,
           'akte', jsonb_build_object('darf_bearbeiten', true, 'nur_ansehen', true,
              'felder', jsonb_build_object('geschlecht', m."Geschlecht", 'geburtsdatum', null, 'alter', m."Alter",
                 'groesse_cm', m."Groesse_cm", 'gewicht_kg', m."Gewicht_kg", 'aktivitaet', null,
                 'ernaehrungsform', m."Ernaehrungsform", 'diabetes_typ', m."Diabetes_Typ",
                 'unvertraeglichkeiten', to_jsonb(coalesce(m."Unvertraeglichkeiten", array[]::text[]))),
              'ziel_text', m.ziel_text, 'sport_text', m.sport_text, 'notiz_text', m.notiz_text,
              'privat_notiz', m.privat_notiz, 'stichworte', to_jsonb(coalesce(m.stichworte, '{}'::text[])),
              'protokoll', jsonb_build_array(
                 jsonb_build_object('feld', 'gewicht_kg', 'alt', m."Gewicht_kg" + 1.2, 'neu', m."Gewicht_kg", 'am', v_heute - 7),
                 jsonb_build_object('feld', 'ziel_text', 'alt', null, 'neu', m.ziel_text, 'am', v_heute - 21))));
end $f$;

-- 6b) Private Notiz und Diagnose-Stichworte (nur Fachkraft) -----------------------
create or replace function public.cb_fp_akte_privat_setzen(p_code text, p_notiz text, p_stichworte text[])
returns jsonb language plpgsql security definer set search_path = public as $f$
declare k record; v_uid uuid := auth.uid(); v_sw text[];
begin
  select * into k from public._fp_klient(p_code);                         -- laufender Key + Einwilligung, sonst 42501
  select coalesce(array_agg(distinct left(trim(x), 60)) filter (where trim(x) <> ''), '{}') into v_sw from unnest(coalesce(p_stichworte, '{}')) x;
  if coalesce(array_length(v_sw, 1), 0) > 20 then return jsonb_build_object('ok', false, 'grund', 'Höchstens 20 Stichworte.'); end if;
  if length(p_notiz) > 8000 then return jsonb_build_object('ok', false, 'grund', 'Die Notiz ist zu lang (höchstens 8000 Zeichen).'); end if;
  insert into public.fl_akte(fachperson_auth, benutzer_id, privat_notiz, stichworte)
  values (v_uid, k.benutzer_id, nullif(trim(p_notiz), ''), v_sw)
  on conflict (fachperson_auth, benutzer_id) do update set privat_notiz = excluded.privat_notiz, stichworte = excluded.stichworte, geaendert_am = now();
  return jsonb_build_object('ok', true, 'stichworte', to_jsonb(v_sw));
end $f$;

-- Für FL-5 (Plan-Vorschlag, Rezepte teilen): Stichworte der Fachkraft zu einer Person. Nur intern.
create or replace function public._fl_akte_stichworte(p_benutzer text, p_fachperson uuid)
returns text[] language sql stable security definer set search_path = public as $f$
  select coalesce((select m.stichworte from public.fl_muster_klient m where m.benutzer_id = p_benutzer),
                  (select a.stichworte from public.fl_akte a where a.benutzer_id = p_benutzer and a.fachperson_auth = p_fachperson),
                  '{}'::text[])
$f$;

-- 6c) Praxisdaten (Einstellungen) -----------------------------------------------------
create table if not exists public.fl_praxis (
  auth_id      uuid primary key,
  beruf        text check (length(beruf) <= 120),
  anschrift    text check (length(anschrift) <= 300),
  telefon      text check (length(telefon) <= 60),
  webseite     text check (length(webseite) <= 200),
  geaendert_am timestamptz not null default now()
);
alter table public.fl_praxis enable row level security;
revoke all on public.fl_praxis from anon, authenticated;

create or replace function public.cb_fp_praxis()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v public.fachperson_konto; p public.fl_praxis;
begin
  select * into v from public.fachperson_konto where auth_id = auth.uid();
  if v.auth_id is null then raise exception 'Nur für Fachleute.' using errcode = '42501'; end if;
  select * into p from public.fl_praxis where auth_id = v.auth_id;
  return jsonb_build_object('name', v.name, 'praxis', v.praxis, 'kuerzel', v.kuerzel, 'beruf', p.beruf, 'anschrift', p.anschrift,
                            'telefon', p.telefon, 'webseite', p.webseite, 'geaendert_am', p.geaendert_am);
end $f$;

create or replace function public.cb_fp_praxis_setzen(p_name text, p_praxis text, p_beruf text, p_anschrift text, p_telefon text, p_webseite text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.fachperson_konto where auth_id = v_uid) then raise exception 'Nur für Fachleute.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then return jsonb_build_object('ok', false, 'grund', 'Bitte einen Namen eintragen.'); end if;
  if length(p_name) > 120 or length(p_praxis) > 160 then return jsonb_build_object('ok', false, 'grund', 'Name oder Praxis ist zu lang.'); end if;
  if length(p_beruf) > 120 or length(p_anschrift) > 300 or length(p_telefon) > 60 or length(p_webseite) > 200 then
    return jsonb_build_object('ok', false, 'grund', 'Eine Angabe ist zu lang.'); end if;
  update public.fachperson_konto set name = trim(p_name), praxis = nullif(trim(p_praxis), '') where auth_id = v_uid;
  insert into public.fl_praxis(auth_id, beruf, anschrift, telefon, webseite)
  values (v_uid, nullif(trim(p_beruf), ''), nullif(trim(p_anschrift), ''), nullif(trim(p_telefon), ''), nullif(trim(p_webseite), ''))
  on conflict (auth_id) do update set beruf = excluded.beruf, anschrift = excluded.anschrift, telefon = excluded.telefon,
                                      webseite = excluded.webseite, geaendert_am = now();
  return jsonb_build_object('ok', true) || public.cb_fp_praxis();
end $f$;

-- 6d) Öffentliche Vorführung ohne Passwort (Ralph 11.11.: „Zugang über den Link ohne Konto“).
-- Abschaltbar: update fachleute_einstellung set wert = 'nein' where schluessel = 'muster_oeffentlich'.
-- Die Musterfunktionen liefern nur erfundene Daten und schreiben nichts.
insert into public.fachleute_einstellung(schluessel, wert, notiz)
values ('muster_oeffentlich', 'ja', 'Vorführung therapeut-demo.html ohne Passwort (Token „oeffentlich“); nein = nur mit muster_token')
on conflict (schluessel) do nothing;
create or replace function public._fl_muster_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $f$
  select (coalesce(length(p_token), 0) >= 16
          and exists (select 1 from public.fachleute_einstellung where schluessel = 'muster_token' and wert = p_token))
      or (p_token = 'oeffentlich'
          and exists (select 1 from public.fachleute_einstellung where schluessel = 'muster_oeffentlich' and wert = 'ja'))
      or public._fl_wunsch_darf();   -- freigeschaltete Fachperson (aktiv, Lizenz, Vertrag) oder Admin
$f$;

-- 7) Rechte ------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['public._fl_akte_darf(text)', 'public._fl_akte_json(text, uuid, boolean)', 'public._fl_akte_stichworte(text, uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  execute 'revoke all on function public.cb_fp_akte_setzen(text, jsonb) from public, anon';
  execute 'grant execute on function public.cb_fp_akte_setzen(text, jsonb) to authenticated';
  foreach f in array array['public.cb_fp_akte_privat_setzen(text, text, text[])', 'public.cb_fp_praxis()',
                           'public.cb_fp_praxis_setzen(text, text, text, text, text, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke all on function public.cb_fp_klient_dashboard(text, date, date) from public, anon';
  execute 'grant execute on function public.cb_fp_klient_dashboard(text, date, date) to authenticated';
  execute 'revoke all on function public.cb_fl_muster_dashboard(text, integer, date, date) from public';
  execute 'grant execute on function public.cb_fl_muster_dashboard(text, integer, date, date) to anon, authenticated';
end $$;
