-- =====================================================================
-- FL-4 Fachleute-Dashboard, Musterpraxis und Wunschliste (11.11.2026)
-- Setzt voraus: FL-1 (live seit 11.11.2026) und FL-2 (fl2_auswertung.sql).
-- Reihenfolge beim Einspielen: erst FL-2, dann diese Datei.
--
-- Teil A  Musterpraxis „Praxis Muster“ mit 4 erfundenen Klienten
--         * eigene Tabellen fl_muster_* – KEINE Zeilen in Benutzer,
--           Ernaehrungstagebuch, gratis_code oder fachperson_konto.
--           Darum zählen die Musterklienten nie in Statistik, Abrechnung,
--           Wächter, Monatsbericht oder Produkt-Ranglisten.
--         * Tagebuch nur aus echten Index-Produkten (Produkt_ID + Gramm).
--           Nährwerte und Scores rechnet das System aus Naehrwerte_Makro und
--           Scores (gleiche Formel wie v_tagebuch_eintraege).
--         * Die Daten wandern wochenweise mit: gespeichert sind Basisdaten
--           um den 11.11.2026, angezeigt wird um volle Wochen verschoben,
--           immer nur bis gestern. Wochentage bleiben gleich.
--         * Zugang ohne Login über einen Vorschau-Link mit Zufalls-Token
--           (fachleute_einstellung.muster_token). Neu würfeln = alter Link tot.
-- Teil B  FL-2-Auswertungen mit Muster-Weiche (drei Funktionen aus FL-2
--         werden mit kleinem Zusatz neu angelegt, sonst unverändert)
-- Teil C  Dashboard je Klient (Tag/Woche/Monat): echte Klienten über den
--         Key-Code (_fp_klient, FL-1), Musterklienten über den Token.
--         Individuelle Vorgaben der Therapeutin (Klient_Vorgabe).
-- Teil D  Gemeinsame Wunschliste der Fachleute mit „Ich auch“-Stimmen,
--         Ähnlichkeitssuche und Anhängen (privater Bucket fachleute-wunsch).
--
-- Grundsatz wie FL-1: Tabellen haben RLS an, keine Policies, keine Rechte
-- für anon/authenticated. Zugriff nur über die Funktionen unten.
-- =====================================================================

-- =====================================================================
-- Teil A: Musterpraxis
-- =====================================================================
insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('muster_token', replace(gen_random_uuid()::text, '-', ''),
   'FL-4 Vorschau-Link Musterpraxis: https://root-index.de/fachleute-muster.html?z=<wert>. Neuer Wert = alter Link geht nicht mehr.'),
  ('muster_praxis', 'Praxis Muster', 'FL-4 Name der Musterpraxis (nur Anzeige)')
on conflict (schluessel) do nothing;

create table if not exists public.fl_muster_klient (
  benutzer_id   text primary key check (benutzer_id ~ '^MUSTER-[0-9]+$'),
  nr            int  not null unique,
  code          text not null unique,          -- nur Anzeige, KEIN echter gratis_code
  name          text not null,
  steckbrief    text not null,
  "Geschlecht"  text, "Alter" int, "Geburtsdatum" date,
  "Groesse_cm"  numeric, "Gewicht_kg" numeric,
  "Kalorienziel_kcal" numeric, "Eiweiss_ziel_g" numeric, "KH_ziel_g" numeric, "Fett_ziel_g" numeric,
  "Ernaehrungsform" text, "Unvertraeglichkeiten" text[] not null default '{}', "Diabetes_Typ" text, "Zustand" text,
  key_seit_tage int not null,                  -- Key eingelöst vor so vielen Tagen (relativ zu heute)
  key_laufzeit_tage int not null
);
create table if not exists public.fl_muster_tagebuch (
  id            bigint generated always as identity primary key,
  benutzer_id   text not null references public.fl_muster_klient(benutzer_id) on delete cascade,
  datum         date not null,                 -- Basisdatum (um den 11.11.2026)
  mahlzeit      text not null check (mahlzeit in ('Frühstück','Mittag','Abendessen','Snack')),
  produkt_id    text not null references public."Produkte"("Produkt_ID"),
  menge_g       numeric not null check (menge_g > 0),
  rezept_id     text references public."Rezepte"("Rezept_ID"),
  rezept_batch  text
);
create index if not exists fl_muster_tagebuch_idx on public.fl_muster_tagebuch(benutzer_id, datum);
create table if not exists public.fl_muster_vorgabe (
  id            bigint generated always as identity primary key,
  benutzer_id   text not null references public.fl_muster_klient(benutzer_id) on delete cascade,
  kennzahl text not null, wert numeric not null, wert_bis numeric, einheit text not null,
  bezug text not null default 'tag', art text not null, gesetzt_von text, notiz text
);
create table if not exists public.fl_muster_wochenplan (
  id            bigint generated always as identity primary key,
  benutzer_id   text not null references public.fl_muster_klient(benutzer_id) on delete cascade,
  datum date not null, slot text not null, rezept_id text references public."Rezepte"("Rezept_ID"),
  produkt_id text references public."Produkte"("Produkt_ID"), menge_g numeric, titel text, reihenfolge int not null default 0
);
create table if not exists public.fl_muster_rezept (
  benutzer_id text not null references public.fl_muster_klient(benutzer_id) on delete cascade,
  rezept_id   text not null references public."Rezepte"("Rezept_ID"),
  herkunft    text not null check (herkunft in ('gespeichert','empfohlen')),
  primary key (benutzer_id, rezept_id)
);
do $$ declare t text; begin
  foreach t in array array['fl_muster_klient','fl_muster_tagebuch','fl_muster_vorgabe','fl_muster_wochenplan','fl_muster_rezept'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Verschiebung in ganzen Wochen: Basis-„heute“ ist der 11.11.2026
create or replace function public._fl_muster_versatz()
returns int language sql stable set search_path = public as $$
  select (floor(((now() at time zone 'Europe/Berlin')::date - date '2026-11-11') / 7.0) * 7)::int;
$$;

-- Musterklient? Nur MUSTER-n, nur wenn es ihn gibt und es KEINEN echten Benutzer mit dieser ID gibt.
create or replace function public._fl_muster_ist(p_benutzer text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_benutzer, '') ~ '^MUSTER-[0-9]+$'
     and exists (select 1 from public.fl_muster_klient m where m.benutzer_id = p_benutzer)
     and not exists (select 1 from public."Benutzer" b where b."Benutzer_ID" = p_benutzer);
$$;

create or replace function public._fl_muster_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(length(p_token), 0) >= 16
     and exists (select 1 from public.fachleute_einstellung where schluessel = 'muster_token' and wert = p_token);
$$;

-- Tagebuch eines Musterklienten im Format von v_tagebuch_eintraege (+ Rezept_ID, Man_ges_fett).
-- Gleiche Rechnung wie die View: Wert je 100 g × Gramm / 100, gleich gerundet.
create or replace function public._fl_muster_eintraege(p_benutzer text)
returns table("Eintrag_ID" bigint, "Datum" date, "Mahlzeit" text, "Produkt_ID" text, "Produktname" text, manuell boolean,
              "Menge_g" numeric, kcal numeric, protein numeric, kh numeric, zucker numeric, fett numeric,
              ballaststoffe numeric, salz numeric, rid text, man_gf numeric)
language sql stable security definer set search_path = public as $$
  select -t.id, t.datum + public._fl_muster_versatz(), t.mahlzeit, t.produkt_id, p."Produktname", false, t.menge_g,
         round(n.kcal_100g_ml * t.menge_g / 100, 0),
         round(n."Protein_g_100g_ml" * t.menge_g / 100, 1),
         round(n."Kohlenhydrate_g_100g_ml" * t.menge_g / 100, 1),
         round(n."Zucker_g_100g_ml" * t.menge_g / 100, 1),
         round(n."Fett_g_100g_ml" * t.menge_g / 100, 1),
         round(n."Ballaststoffe_g_100g_ml" * t.menge_g / 100, 1),
         round(n."Salz_g_100g_ml" * t.menge_g / 100, 2),
         t.rezept_id, null::numeric
    from public.fl_muster_tagebuch t
    join public."Produkte" p on p."Produkt_ID" = t.produkt_id
    left join public."Naehrwerte_Makro" n on n."Produkt_ID" = t.produkt_id
   where t.benutzer_id = p_benutzer and public._fl_muster_ist(p_benutzer)
     and t.datum + public._fl_muster_versatz() < (now() at time zone 'Europe/Berlin')::date;
$$;

-- ---------- Musterdaten --------------------------------------------
-- Vier erfundene Personen. Profilwerte und Vorgaben sind Beispielwerte
-- für die Vorführung (wie sie eine Therapeutin eintragen würde), keine Messwerte.
insert into public.fl_muster_klient(benutzer_id, nr, code, name, steckbrief, "Geschlecht", "Alter", "Groesse_cm", "Gewicht_kg",
  "Kalorienziel_kcal", "Eiweiss_ziel_g", "KH_ziel_g", "Fett_ziel_g", "Ernaehrungsform", "Unvertraeglichkeiten", "Diabetes_Typ",
  key_seit_tage, key_laufzeit_tage) values
 ('MUSTER-1', 1, 'MUSTER-A7K2', 'Anna K.',
  'Büro, möchte abnehmen. Frühstück oft schnell, abends gern etwas Süßes.',
  'weiblich', 34, 168, 82, 1800, 90, 200, 65, 'Omnivor', '{}', null, 41, 90),
 ('MUSTER-2', 2, 'MUSTER-B3M9', 'Bernd M.',
  'Typ-2-Diabetes, Handwerker. Viel Brot und Wurst, wenig Gemüse.',
  'männlich', 58, 181, 97, 2100, 100, 220, 75, 'Omnivor', '{}', 'typ2', 38, 180),
 ('MUSTER-3', 3, 'MUSTER-C5P4', 'Clara S.',
  'Studentin, vegetarisch, läuft dreimal pro Woche. Viel Obst, Eiweiß eher knapp.',
  'weiblich', 27, 172, 61, 2200, 100, 270, 70, 'Vegetarisch', '{}', null, 36, 90),
 ('MUSTER-4', 4, 'MUSTER-D8V6', 'Dora W.',
  'Rentnerin, lebt allein, kleine Portionen. Laktoseintoleranz.',
  'weiblich', 72, 160, 58, 1600, 70, 180, 60, 'Omnivor', '{laktose}', null, 40, 180)
on conflict (benutzer_id) do nothing;

insert into public.fl_muster_vorgabe(benutzer_id, kennzahl, wert, wert_bis, einheit, bezug, art, gesetzt_von, notiz) values
 ('MUSTER-1','kcal',1800,null,'kcal','tag','etwa','Praxis Muster','Leichtes Defizit'),
 ('MUSTER-1','gruppe:gemuese',300,null,'g','tag','mindestens','Praxis Muster','Mittags und abends je eine Handvoll mehr'),
 ('MUSTER-1','zucker',50,null,'g','tag','hoechstens','Praxis Muster',null),
 ('MUSTER-2','kh',180,null,'g','tag','hoechstens','Praxis Muster','Mit Diabetologin abgestimmt'),
 ('MUSTER-2','ballaststoffe',30,null,'g','tag','mindestens','Praxis Muster',null),
 ('MUSTER-2','gruppe:gemuese+obst',400,null,'g','tag','mindestens','Praxis Muster','Erstes Etappenziel'),
 ('MUSTER-3','protein',1.2,null,'g/kg','tag','mindestens','Praxis Muster','Wegen Lauftraining'),
 ('MUSTER-4','protein',1.0,null,'g/kg','tag','mindestens','Praxis Muster','Muskelerhalt im Alter'),
 ('MUSTER-4','kcal',1600,null,'kcal','tag','etwa','Praxis Muster',null);

insert into public.fl_muster_rezept(benutzer_id, rezept_id, herkunft) values
 ('MUSTER-1','RUed019620fdae4494bb1239134b39e65e','empfohlen'),
 ('MUSTER-1','RU7c4e8d2e9b604f7dbd410660d9921d0d','gespeichert'),
 ('MUSTER-1','RUa8551a611043458d981835948b746b6b','empfohlen'),
 ('MUSTER-2','RUa1c57e78a1d14da5bc5fac615d754992','empfohlen'),
 ('MUSTER-2','RUed8d26e55b1e41fbb75092be7ce443ac','empfohlen'),
 ('MUSTER-3','RU6b28c43176d643d3bbfbbb56b3e1f75f','gespeichert'),
 ('MUSTER-3','RU5c58a0cd555247379af2000b8dbf6908','gespeichert'),
 ('MUSTER-3','RUed8d26e55b1e41fbb75092be7ce443ac','empfohlen'),
 ('MUSTER-4','RUa8551a611043458d981835948b746b6b','empfohlen'),
 ('MUSTER-4','RUed019620fdae4494bb1239134b39e65e','gespeichert')
on conflict do nothing;

-- Tagebuch erzeugen: je Person Gerichte je Mahlzeit, gewählt per Prüfsumme aus
-- Person+Tag+Mahlzeit (immer gleich bei erneutem Lauf), Mengen ±15 %, einzelne
-- Tage oder Mahlzeiten fehlen wie im echten Leben. Gericht = 'P-ID:Gramm;…'
-- oder 'R:Rezept_ID:Portionen' (Rezept wird wie in der App als Einzelzeilen je Zutat eingetragen).
do $gen$
declare
  d date; g record; it text; pid text; gr numeric; h int; n int; v_batch text;
begin
  if exists (select 1 from public.fl_muster_tagebuch) then return; end if;
  create temp table _gericht(person int, slot text, tage text, gewicht int, items text) on commit drop;
  insert into _gericht values
  -- Anna (1): Büro, abnehmen, Gemüse knapp, abends Süßes
  (1,'Frühstück','werktag',3,'P56754:60;P60412:20;P24728:20'),
  (1,'Frühstück','werktag',2,'P50849:150;P73899:30;P195:100'),
  (1,'Frühstück','werktag',1,'P72457:150;P31138:40;P180:60'),
  (1,'Frühstück','wochenende',2,'P10706:120;P57206:10;P59268:30;P95524:60'),
  (1,'Frühstück','wochenende',1,'R:RUed019620fdae4494bb1239134b39e65e:1'),
  (1,'Mittag','werktag',3,'P62410:110;P96387:150;P59268:15'),
  (1,'Mittag','werktag',2,'P52164:130;P96090:70;P58261:120'),
  (1,'Mittag','werktag',2,'R:RU7c4e8d2e9b604f7dbd410660d9921d0d:1'),
  (1,'Mittag','werktag',1,'P1630:350'),
  (1,'Mittag','wochenende',2,'P73762:250;P10430:150;P46417:150'),
  (1,'Mittag','wochenende',1,'P96384:140;P73762:200;P274:150;P57206:10'),
  (1,'Abendessen','alle',3,'P53326:100;P10898:40;P59268:30;P292:80;P281:80'),
  (1,'Abendessen','alle',2,'P264:60;P281:100;P292:80;P55894:50;P56178:10;P10706:60'),
  (1,'Abendessen','alle',1,'P56754:60;P24372:30'),
  (1,'Snack','werktag',3,'P33700:25'),
  (1,'Snack','alle',2,'P190:150'),
  (1,'Snack','wochenende',2,'P14788:50;P53145:330'),
  (1,'Snack','alle',1,'P55989:30;P69592:150'),
  -- Bernd (2): Typ-2-Diabetes, Brot und Wurst, wenig Gemüse
  (2,'Frühstück','alle',3,'P10706:120;P57206:15;P56002:30;P59268:30'),
  (2,'Frühstück','alle',2,'P53326:100;P57206:15;P12701:30;P24728:20'),
  (2,'Frühstück','wochenende',1,'P10706:120;P95524:120;P10898:40'),
  (2,'Mittag','werktag',3,'P53326:150;P56002:40;P59268:40;P292:60'),
  (2,'Mittag','werktag',2,'P1630:400'),
  (2,'Mittag','werktag',1,'P52164:180;P73762:300;P58261:100'),
  (2,'Mittag','wochenende',2,'P73762:350;P52164:200;P294:150;P57206:10'),
  (2,'Mittag','wochenende',1,'R:RUa1c57e78a1d14da5bc5fac615d754992:1'),
  (2,'Abendessen','alle',3,'P53326:150;P57206:15;P10898:50;P12701:30;P281:60'),
  (2,'Abendessen','alle',2,'P62410:150;P96387:200;P59268:20'),
  (2,'Abendessen','alle',1,'R:RUed8d26e55b1e41fbb75092be7ce443ac:1'),
  (2,'Snack','alle',2,'P55989:40'),
  (2,'Snack','alle',2,'P190:180'),
  (2,'Snack','wochenende',1,'P14788:75'),
  -- Clara (3): vegetarisch, läuft, viel Obst, Eiweiß knapp
  (3,'Frühstück','alle',3,'R:RU6b28c43176d643d3bbfbbb56b3e1f75f:1'),
  (3,'Frühstück','alle',2,'P73899:60;P50397:200;P195:120;P180:80;P361:15'),
  (3,'Frühstück','wochenende',1,'P10706:60;P53326:50;P60412:30;P24728:25;P57764:200'),
  (3,'Mittag','werktag',3,'P96389:110;P96387:150;P284:120;P55894:30'),
  (3,'Mittag','werktag',2,'P58907:80;P62621:60;P292:100;P114:100;P286:80'),
  (3,'Mittag','werktag',2,'P56144:70;P96090:60;P268:100;P162:10'),
  (3,'Mittag','wochenende',2,'R:RUed8d26e55b1e41fbb75092be7ce443ac:1'),
  (3,'Mittag','wochenende',1,'P1630:350'),
  (3,'Abendessen','alle',3,'R:RU5c58a0cd555247379af2000b8dbf6908:1'),
  (3,'Abendessen','alle',2,'P60654:120;P96090:70;P274:150;P114:80;P162:10'),
  (3,'Abendessen','alle',2,'P53326:100;P58907:50;P281:120;P292:80;P194:60'),
  (3,'Snack','alle',3,'P195:120;P190:150'),
  (3,'Snack','alle',2,'P227:180'),
  (3,'Snack','alle',2,'P200:100;P33754:20'),
  (3,'Snack','alle',1,'P33700:20'),
  -- Dora (4): Rentnerin, kleine Portionen, laktosefrei, Eiweiß zu niedrig
  (4,'Frühstück','alle',3,'P56754:40;P41666:10;P24728:20'),
  (4,'Frühstück','alle',2,'P395:30;P41674:150;P211:80'),
  (4,'Frühstück','alle',1,'P10706:60;P41667:20;P494:60'),
  (4,'Mittag','alle',3,'P73762:180;P46417:100;P494:60'),
  (4,'Mittag','alle',2,'P10430:90;P73762:150;P58261:80'),
  (4,'Mittag','alle',2,'P400:50;P286:100;P52164:70;P162:5'),
  (4,'Mittag','alle',1,'P96389:60;P96387:100'),
  (4,'Abendessen','alle',3,'P56754:40;P41666:5;P10898:20;P281:60'),
  (4,'Abendessen','alle',2,'P53326:50;P41672:60;P292:60'),
  (4,'Snack','alle',3,'P211:120'),
  (4,'Snack','alle',2,'P55989:20'),
  (4,'Snack','alle',2,'P236:80');

  for d in select generate_series(date '2026-10-12', date '2026-11-17', interval '1 day')::date loop
    for g in
      with p as (select generate_series(1,4) person),
      s as (select unnest(array['Frühstück','Mittag','Abendessen','Snack']) slot),
      wahl as (
        select p.person, s.slot,
               -- ganzer Tag fehlt (≈ 1 von 12), Mahlzeit fehlt (Frühstück selten, Snack oft)
               abs(0::bigint + hashtext('tag' || p.person || d)) % 12 = 0 as tag_fehlt,
               abs(0::bigint + hashtext('slot' || p.person || s.slot || d)) % 100 <
                 case s.slot when 'Frühstück' then case p.person when 1 then 12 else 4 end
                             when 'Mittag' then 8 when 'Abendessen' then 6
                             else case p.person when 1 then 35 when 2 then 50 when 3 then 15 else 30 end end as slot_fehlt,
               case when extract(isodow from d) >= 6 then 'wochenende' else 'werktag' end typ
          from p cross join s)
      select w.person, w.slot, x.items
        from wahl w
        cross join lateral (
          select gg.items from (
            select g2.items, sum(g2.gewicht) over (order by g2.items) - g2.gewicht lo, sum(g2.gewicht) over (order by g2.items) hi,
                   sum(g2.gewicht) over () ges
              from _gericht g2 where g2.person = w.person and g2.slot = w.slot and g2.tage in ('alle', w.typ)) gg
           where abs(0::bigint + hashtext('wahl' || w.person || w.slot || d)) % gg.ges >= gg.lo
             and abs(0::bigint + hashtext('wahl' || w.person || w.slot || d)) % gg.ges <  gg.hi) x
       where not w.tag_fehlt and not w.slot_fehlt
    loop
      if g.items like 'R:%' then
        v_batch := 'muster-' || g.person || '-' || d || '-' || g.slot;
        insert into public.fl_muster_tagebuch(benutzer_id, datum, mahlzeit, produkt_id, menge_g, rezept_id, rezept_batch)
        select 'MUSTER-' || g.person, d, g.slot, rp."Produkt_ID",
               round(rp."Menge_g" / greatest(r."Portionen", 1) * split_part(g.items, ':', 3)::numeric, 0),
               r."Rezept_ID", v_batch
          from public."Rezepte" r join public."Rezept_Produkte" rp on rp."Rezept_ID" = r."Rezept_ID"
          join public."Naehrwerte_Makro" n on n."Produkt_ID" = rp."Produkt_ID"
         where r."Rezept_ID" = split_part(g.items, ':', 2) and rp."Menge_g" > 0
           and round(rp."Menge_g" / greatest(r."Portionen", 1) * split_part(g.items, ':', 3)::numeric, 0) > 0;
      else
        foreach it in array string_to_array(g.items, ';') loop
          pid := split_part(it, ':', 1);
          h := abs(0::bigint + hashtext('menge' || g.person || d || g.slot || pid)) % 31;   -- 0..30
          gr := greatest(5, round(split_part(it, ':', 2)::numeric * (85 + h) / 100 / 5) * 5);
          insert into public.fl_muster_tagebuch(benutzer_id, datum, mahlzeit, produkt_id, menge_g)
          values ('MUSTER-' || g.person, d, g.slot, pid, gr);
        end loop;
      end if;
    end loop;
  end loop;

  -- Wochenplan (Basiswochen 9.11.–29.11.2026): an den meisten Tagen ein geplantes Rezept
  insert into public.fl_muster_wochenplan(benutzer_id, datum, slot, rezept_id, reihenfolge)
  select 'MUSTER-' || pr.person, d2, pr.slot, pr.rezept_id, 0
    from generate_series(date '2026-11-09', date '2026-11-29', interval '1 day') d2
    cross join (values
      (1,'Mittag','RU7c4e8d2e9b604f7dbd410660d9921d0d',1),(1,'Frühstück','RUed019620fdae4494bb1239134b39e65e',6),
      (1,'Abendessen','RUa8551a611043458d981835948b746b6b',3),
      (2,'Abendessen','RUed8d26e55b1e41fbb75092be7ce443ac',2),(2,'Mittag','RUa1c57e78a1d14da5bc5fac615d754992',7),
      (2,'Abendessen','RUa1c57e78a1d14da5bc5fac615d754992',4),
      (3,'Frühstück','RU6b28c43176d643d3bbfbbb56b3e1f75f',1),(3,'Frühstück','RU6b28c43176d643d3bbfbbb56b3e1f75f',3),
      (3,'Abendessen','RU5c58a0cd555247379af2000b8dbf6908',2),(3,'Mittag','RUed8d26e55b1e41fbb75092be7ce443ac',6),
      (3,'Abendessen','RU5c58a0cd555247379af2000b8dbf6908',5),
      (4,'Frühstück','RUa8551a611043458d981835948b746b6b',2),(4,'Frühstück','RUed019620fdae4494bb1239134b39e65e',7),
      (4,'Frühstück','RUa8551a611043458d981835948b746b6b',5)
    ) pr(person, slot, rezept_id, wtag)
   where extract(isodow from d2) = pr.wtag;
end $gen$;

-- =====================================================================
-- Teil B: FL-2-Auswertungen mit Muster-Weiche
-- Die drei Funktionen sind wörtlich aus fl2_auswertung.sql (Commit f74a078b);
-- neu ist nur, was mit „FL-4 Muster“ markiert ist. Wer FL-2 ändert:
-- die Weiche bitte mitnehmen (sonst ist die Musterpraxis leer, echte Daten bleiben sicher).
-- =====================================================================
create or replace function public.cb_auswertung_daten_ab(p_benutzer text)
returns date language sql stable security definer set search_path = public as $f$
  select case
    when public._fl_muster_ist(p_benutzer) then date '1900-01-01'          -- FL-4 Muster: erfundene Daten, für alle lesbar
    when public.cb_ist_admin()
      or exists (select 1 from public."Benutzer" b where b.auth_id = auth.uid() and b."Benutzer_ID" = p_benutzer)
    then date '1900-01-01'
    else (select min(case when e.aeltere_freigegeben then date '1900-01-01' else e.daten_ab end)
            from public.gratis_code g
            join public.fachperson_konto f on f.auth_id = g.fachperson_auth and f.aktiv
            join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
            join public."Benutzer" b on b.auth_id = g.klient_auth
           where b."Benutzer_ID" = p_benutzer
             and g.fachperson_auth = auth.uid()
             and public._fp_vertrag_ok(auth.uid())
             and public._fp_lizenz_ok(auth.uid())
             and public._fp_key_laeuft(g)
             and e.einwilligung_am is not null and e.widerruf_am is null)
  end;
$f$;

create or replace function public.cb_auswertung_eintraege(p_benutzer text, p_von date, p_bis date)
returns table(eintrag_id bigint, datum date, mahlzeit text, produkt_id text, name text, manuell boolean,
              rezept_id text, menge_g numeric, gruppe text,
              kcal numeric, protein numeric, kh numeric, zucker numeric, fett numeric, ges_fett numeric,
              ballaststoffe numeric, salz numeric)
language plpgsql stable security definer set search_path = public, shadow_v1 as $f$
#variable_conflict use_column
declare v_ab date;
begin
  v_ab := public.cb_auswertung_daten_ab(p_benutzer);
  if v_ab is null then raise exception 'Kein Zugriff auf dieses Tagebuch.' using errcode = '42501'; end if;
  if p_bis < p_von or p_bis - p_von > 400 then raise exception 'Zeitraum ungültig (höchstens 400 Tage).'; end if;
  return query
  with e as (
    select v."Eintrag_ID", v."Datum", v."Mahlzeit", v."Produkt_ID", v."Produktname", v.manuell, v."Menge_g",
           v.kcal, v.protein, v.kh, v.zucker, v.fett, v.ballaststoffe, v.salz,
           t."Rezept_ID" rid, t."Man_ges_fett" man_gf
      from public.v_tagebuch_eintraege v
      join public."Ernaehrungstagebuch" t on t."Eintrag_ID" = v."Eintrag_ID"
     where v."Benutzer_ID" = p_benutzer and v."Datum" between greatest(p_von, v_ab) and p_bis
    union all                                                               -- FL-4 Muster
    select m.* from public._fl_muster_eintraege(p_benutzer) m
     where m."Datum" between greatest(p_von, v_ab) and p_bis
  ),
  g as (
    select p."Produkt_ID" pid,
           coalesce(m.gruppe, public.cb_lebensmittelgruppe_regel(p."Kategorie", p."Unterkategorie", p."Produktname", z.k1, z.n, z.z1)) gr
      from (select distinct e."Produkt_ID" pid from e where e."Produkt_ID" is not null) x
      join public."Produkte" p on p."Produkt_ID" = x.pid
      left join public."Produkt_Lebensmittelgruppe" m on m."Produkt_ID" = x.pid
      left join lateral (
        select count(*)::int n,
               (array_agg(src.source_category order by pz."Reihenfolge"))[1] k1,
               (array_agg(src.source_name     order by pz."Reihenfolge"))[1] z1
          from public."Produkt_Zutaten" pz
          left join shadow_v1.legacy_ingredient_source_ref src on src.source_zutat_id = pz."Zutat_ID"
         where pz."Produkt_ID" = x.pid) z on true)
  select e."Eintrag_ID", e."Datum", e."Mahlzeit", e."Produkt_ID", e."Produktname", e.manuell,
         e.rid, e."Menge_g",
         coalesce(g.gr, public.cb_lebensmittelgruppe_regel(null, null, e."Produktname", null, null, null)),
         e.kcal, e.protein, e.kh, e.zucker, e.fett,
         case when e."Produkt_ID" is not null then round(n."Ges_Fett_g_100g_ml" * e."Menge_g" / 100, 1)
              else round(e.man_gf, 1) end,
         e.ballaststoffe, e.salz
    from e
    left join g on g.pid = e."Produkt_ID"
    left join public."Naehrwerte_Makro" n on n."Produkt_ID" = e."Produkt_ID"
   order by e."Datum", e."Eintrag_ID";
end $f$;

create or replace function public.cb_auswertung_ist_soll(p_benutzer text, p_von date, p_bis date, p_raster text default 'gesamt')
returns table(zeitraum_von date, zeitraum_bis date, tage_erfasst int,
              kennzahl text, name text, einheit text, bezug text,
              ist numeric, soll numeric, soll_bis numeric, art text, erfuellt boolean, ist_prozent_vom_soll numeric,
              soll_herkunft text, quelle text, quelle_url text, quelle_stand text, hinweis text)
language plpgsql stable security definer set search_path = public as $f$
#variable_conflict use_column
declare v_b record; v_alter int; v_geschl text;
begin
  if not public.cb_auswertung_darf(p_benutzer) then raise exception 'Kein Zugriff auf dieses Tagebuch.' using errcode = '42501'; end if;
  if public._fl_muster_ist(p_benutzer) then                                 -- FL-4 Muster: Profil aus fl_muster_klient
    select m."Geburtsdatum", m."Alter", m."Geschlecht", m."Kalorienziel_kcal", m."Eiweiss_ziel_g", m."KH_ziel_g",
           m."Fett_ziel_g", m."Gewicht_kg", m."Zustand"
      into v_b from public.fl_muster_klient m where m.benutzer_id = p_benutzer;
  else
    select * into v_b from public."Benutzer" where "Benutzer_ID" = p_benutzer;
  end if;
  v_alter  := coalesce(extract(year from age(p_bis, v_b."Geburtsdatum"))::int, v_b."Alter");
  v_geschl := case v_b."Geschlecht" when 'männlich' then 'maennlich' when 'weiblich' then 'weiblich' end;

  return query
  with nw as materialized (select * from public.cb_auswertung_naehrwerte(p_benutzer, p_von, p_bis, p_raster, true)),
  gr as materialized (select * from public.cb_auswertung_gruppen(p_benutzer, p_von, p_bis, p_raster)),
  zr as (select distinct nw.zeitraum_von zv, nw.zeitraum_bis zb, nw.tage_erfasst te from nw),
  -- Kandidaten für Soll
  vorgabe as (
    select distinct on (v.kennzahl) v.kennzahl, null::text vname, v.wert, v.wert_bis, v.einheit, v.bezug, v.art,
           'Vorgabe Therapeutin'::text herkunft, coalesce(v.gesetzt_von, 'Vorgabe')::text quelle, null::text url,
           to_char(v.gueltig_ab, 'DD.MM.YYYY')::text stand, v.notiz hinweis, 1 rang
      from (select kv.kennzahl, kv.wert, kv.wert_bis, kv.einheit, kv.bezug, kv.art, kv.gesetzt_von, kv.notiz,
                   kv.gueltig_ab, kv.gueltig_bis, kv.id
              from public."Klient_Vorgabe" kv where kv."Benutzer_ID" = p_benutzer
            union all                                                       -- FL-4 Muster
            select mv.kennzahl, mv.wert, mv.wert_bis, mv.einheit, mv.bezug, mv.art, mv.gesetzt_von, mv.notiz,
                   date '2026-01-01', null::date, mv.id
              from public.fl_muster_vorgabe mv where mv.benutzer_id = p_benutzer and public._fl_muster_ist(p_benutzer)) v
     where v.gueltig_ab <= p_bis and (v.gueltig_bis is null or v.gueltig_bis >= p_von)
     order by v.kennzahl, v.gueltig_ab desc, v.id desc),
  profil as (
    select k, null::text, w, null::numeric, e, 'tag'::text, 'etwa'::text, 'Ziel im Profil'::text, 'Profil des Klienten'::text,
           null::text, null::text, 'Im Ziel bei ±10 % (wie Tagebuch-Statistik der App).'::text, 2
      from (values ('kcal', v_b."Kalorienziel_kcal", 'kcal'), ('protein', v_b."Eiweiss_ziel_g", 'g'),
                   ('kh', v_b."KH_ziel_g", 'g'), ('fett', v_b."Fett_ziel_g", 'g')) p(k, w, e)
     where w is not null and w > 0),
  richt as (
    select distinct on (rw.kennzahl, rw.einheit) rw.kennzahl, rw.name, rw.wert, rw.wert_bis, rw.einheit, rw.bezug, rw.art,
           ('Richtwert ' || rw.herausgeber)::text, rw.quelle_titel, rw.quelle_url, rw.quelle_stand, rw.hinweis, 3
      from public."Richtwert" rw
     where rw.aktiv and (rw.geschlecht = 'alle' or rw.geschlecht = v_geschl)
       and coalesce(v_alter, 30) between rw.alter_von and rw.alter_bis
     order by rw.kennzahl, rw.einheit, (rw.geschlecht <> 'alle') desc, (rw.alter_bis - rw.alter_von))
  ,
  mikro as (
    select 'mikro:' || ms.naehrstoff, ms.naehrstoff, ms.soll, null::numeric, ms.einheit, 'tag'::text, 'mindestens'::text,
           ('Referenzwert ' || ms.quelle)::text, ms.quelle, null::text, null::text, ms.hinweis, 4
      from public.cb_mikro_soll(v_geschl, v_alter, coalesce(nullif(v_b."Zustand", ''), 'normal')) ms
     where ms.soll is not null),
  kand0 as (select * from vorgabe union all select * from profil union all select * from richt union all select * from mikro),
  kand as (select k.*, case when k.einheit = 'en%' then 'anteil' else 'menge' end dim from kand0 k),
  soll as (
    select k.kennzahl, k.vname, k.wert, k.wert_bis, k.einheit, k.bezug, k.art, k.herkunft, k.quelle, k.url, k.stand, k.hinweis, k.rang
      from kand k
     where not exists (select 1 from kand k2 where k2.kennzahl = k.kennzahl and k2.dim = k.dim and k2.rang < k.rang))
  ,
  ist as materialized (
    select zr.zv, zr.zb, zr.te, s.*,
      case
        when s.kennzahl like 'gruppe:%' then
          (select sum(gr.gramm) from gr where gr.zeitraum_von = zr.zv
              and gr.gruppe = any(string_to_array(substr(s.kennzahl, 8), '+'))) / nullif(zr.te, 0)
        when s.einheit = 'en%' then
          100.0 * (select nw.je_tag from nw where nw.zeitraum_von = zr.zv and nw.kennzahl = s.kennzahl)
                * case when s.kennzahl = 'fett' or s.kennzahl = 'ges_fett' then 9 else 4 end
                / nullif((select nw.je_tag from nw where nw.zeitraum_von = zr.zv and nw.kennzahl = 'kcal'), 0)
        else (select nw.je_tag from nw where nw.zeitraum_von = zr.zv and nw.kennzahl = s.kennzahl)
      end * case when s.bezug = 'woche' then 7 else 1 end as ist_wert,
      case when s.einheit = 'g/kg' then v_b."Gewicht_kg" end kg
    from zr cross join soll s)
  select i.zv, i.zb, i.te, i.kennzahl,
         coalesce(i.vname, (select l.name from public."Lebensmittelgruppe" l where 'gruppe:' || l.gruppe = i.kennzahl),
                  (select max(nw.name) from nw where nw.kennzahl = i.kennzahl),
                  case i.kennzahl when 'gruppe:gemuese+obst' then 'Obst und Gemüse' end,  -- FL-4: Name bei Summen-Vorgabe ohne Richtwert-Zeile
                  i.kennzahl),
         case when i.einheit = 'g/kg' then 'g' else i.einheit end,
         i.bezug,
         round(i.ist_wert, 1),
         round(case when i.einheit = 'g/kg' then i.wert * i.kg else i.wert end, 1),
         round(case when i.einheit = 'g/kg' then i.wert_bis * i.kg else i.wert_bis end, 1),
         i.art,
         case when i.te = 0 or (i.ist_wert is null and i.kennzahl not like 'gruppe:%') then null
              when i.einheit = 'g/kg' and i.kg is null then null
              else (with w as (select coalesce(i.ist_wert, 0) x,
                                      case when i.einheit = 'g/kg' then i.wert * i.kg else i.wert end lo,
                                      case when i.einheit = 'g/kg' then i.wert_bis * i.kg else i.wert_bis end hi)
                    select case i.art when 'mindestens' then x >= lo
                                      when 'hoechstens' then x <= lo
                                      when 'etwa' then abs(x - lo) <= lo * 0.1
                                      when 'bereich' then x between lo and coalesce(hi, lo) end from w)
         end,
         round(100.0 * coalesce(i.ist_wert, 0) / nullif(case when i.einheit = 'g/kg' then i.wert * i.kg else i.wert end, 0), 0),
         i.herkunft, i.quelle, i.url, i.stand,
         concat_ws(' ', i.hinweis,
                   case when i.einheit = 'g/kg' and i.kg is null then 'Kein Körpergewicht im Profil.' end,
                   case when i.kennzahl like 'mikro:%' and i.ist_wert is null and i.te > 0 then 'Keine Werte im Tagebuch.' end)
    from ist i
   order by i.zv, case when i.kennzahl like 'gruppe:%' then 2 when i.kennzahl like 'mikro:%' then 3 else 1 end, i.kennzahl;
end $f$;

-- =====================================================================
-- Teil C: Dashboard je Klient
-- =====================================================================
-- Kern (intern): alles für einen Zeitraum in einem JSON. Zugriff prüfen die
-- FL-2-Bausteine (cb_auswertung_daten_ab) – hier nur noch Zusammenstellen.
create or replace function public._fl4_dashboard(p_benutzer text, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_muster boolean := public._fl_muster_ist(p_benutzer); v_heute date := (now() at time zone 'Europe/Berlin')::date;
        r jsonb; v_profil jsonb; v_rez jsonb; v_plan jsonb; v_vg jsonb; v_wv date; v_ver int := public._fl_muster_versatz();
begin
  if p_von is null or p_bis is null or p_bis < p_von or p_bis - p_von > 92 then
    raise exception 'Zeitraum ungültig (höchstens 3 Monate).'; end if;

  if v_muster then
    select jsonb_build_object('name', m.name, 'steckbrief', m.steckbrief, 'geschlecht', m."Geschlecht", 'alter', m."Alter",
             'groesse_cm', m."Groesse_cm", 'gewicht_kg', m."Gewicht_kg", 'ernaehrungsform', m."Ernaehrungsform",
             'unvertraeglichkeiten', to_jsonb(m."Unvertraeglichkeiten"), 'diabetes_typ', m."Diabetes_Typ",
             'ziel_kcal', m."Kalorienziel_kcal", 'ziel_protein', m."Eiweiss_ziel_g", 'ziel_kh', m."KH_ziel_g", 'ziel_fett', m."Fett_ziel_g")
      into v_profil from public.fl_muster_klient m where m.benutzer_id = p_benutzer;
  else
    -- Einwilligung FL-1: Name, Alter, Größe, Gewicht, Ziele, Ernährungsform, Unverträglichkeiten, Diabetes-Typ. KEINE Zyklusdaten.
    select jsonb_build_object('name', b."Name", 'geschlecht', b."Geschlecht",
             'alter', coalesce(extract(year from age(v_heute, b."Geburtsdatum"))::int, b."Alter"),
             'groesse_cm', b."Groesse_cm", 'gewicht_kg', b."Gewicht_kg", 'ernaehrungsform', b."Ernaehrungsform",
             'unvertraeglichkeiten', to_jsonb(b."Unvertraeglichkeiten"), 'diabetes_typ', b."Diabetes_Typ",
             'ziel_kcal', b."Kalorienziel_kcal", 'ziel_protein', b."Eiweiss_ziel_g", 'ziel_kh', b."KH_ziel_g", 'ziel_fett', b."Fett_ziel_g")
      into v_profil from public."Benutzer" b where b."Benutzer_ID" = p_benutzer;
  end if;

  with e as materialized (select * from public.cb_auswertung_eintraege(p_benutzer, p_von, p_bis)),
  es as (select e.*, s."Clean_Score" score, s."Bewertung" bewertung, p."Marke" marke
           from e left join public."Scores" s on s."Produkt_ID" = e.produkt_id
                  left join public."Produkte" p on p."Produkt_ID" = e.produkt_id),
  tage as (
    select d::date datum,
           (select jsonb_build_object(
              'kcal', round(sum(es.kcal)), 'protein', round(sum(es.protein), 1), 'kh', round(sum(es.kh), 1),
              'zucker', round(sum(es.zucker), 1), 'fett', round(sum(es.fett), 1), 'ballaststoffe', round(sum(es.ballaststoffe), 1),
              'salz', round(sum(es.salz), 2),
              'gemuese_g', coalesce(round(sum(es.menge_g) filter (where es.gruppe = 'gemuese')), 0),
              'obst_g', coalesce(round(sum(es.menge_g) filter (where es.gruppe = 'obst')), 0),
              'score', round(sum(es.score * es.menge_g) filter (where es.score is not null and es.menge_g > 0)
                             / nullif(sum(es.menge_g) filter (where es.score is not null and es.menge_g > 0), 0)),
              'eintraege', count(*))
              from es where es.datum = d::date having count(*) > 0) w
      from generate_series(p_von, p_bis, interval '1 day') d)
  select jsonb_build_object(
    'von', p_von, 'bis', p_bis,
    'tage', (select jsonb_agg(jsonb_build_object('datum', t.datum) || coalesce(t.w, jsonb_build_object('leer', true)) order by t.datum) from tage t),
    'tage_erfasst', (select count(distinct datum) from e),
    'summe', (select jsonb_build_object('kcal', round(sum(es.kcal)), 'protein', round(sum(es.protein), 1), 'kh', round(sum(es.kh), 1),
                       'zucker', round(sum(es.zucker), 1), 'fett', round(sum(es.fett), 1), 'ballaststoffe', round(sum(es.ballaststoffe), 1),
                       'salz', round(sum(es.salz), 2),
                       'score', round(sum(es.score * es.menge_g) filter (where es.score is not null and es.menge_g > 0)
                                      / nullif(sum(es.menge_g) filter (where es.score is not null and es.menge_g > 0), 0))) from es),
    'gruppen', (select jsonb_agg(jsonb_build_object('gruppe', l.gruppe, 'name', l.name, 'gramm', x.g,
                                                   'gramm_je_tag', round(x.g / nullif((select count(distinct datum) from e), 0)),
                                                   'eintraege', x.n) order by l.sortierung)
                  from public."Lebensmittelgruppe" l
                  join (select es.gruppe, round(sum(es.menge_g)) g, count(*) n from es group by es.gruppe) x on x.gruppe = l.gruppe),
    'produkte', (select jsonb_agg(x.j order by x.g desc) from (
                   select sum(es.menge_g) g, jsonb_build_object('produkt_id', es.produkt_id, 'name', max(es.name), 'marke', max(es.marke),
                            'gramm', round(sum(es.menge_g)), 'mal', count(*), 'tage', count(distinct es.datum),
                            'score', max(es.score), 'bewertung', max(es.bewertung), 'gruppe', max(es.gruppe),
                            'kcal', round(sum(es.kcal))) j
                     from es where es.produkt_id is not null group by es.produkt_id) x),
    'eintraege', case when p_bis - p_von <= 6 then
                   (select jsonb_agg(jsonb_build_object('datum', es.datum, 'mahlzeit', es.mahlzeit, 'produkt_id', es.produkt_id,
                            'name', es.name, 'marke', es.marke, 'menge_g', round(es.menge_g), 'kcal', es.kcal, 'score', es.score,
                            'bewertung', es.bewertung, 'gruppe', es.gruppe, 'rezept_id', es.rezept_id,
                            'rezept', (select r."Rezeptname" from public."Rezepte" r where r."Rezept_ID" = es.rezept_id))
                            order by es.datum, array_position(array['Frühstück','Mittag','Abendessen','Snack'], es.mahlzeit), es.eintrag_id)
                      from es) end,
    'rezepte_gegessen', (select jsonb_agg(jsonb_build_object('rezept_id', x.rid, 'name', r."Rezeptname", 'mal', x.mal) order by x.mal desc)
                           from (select es.rezept_id rid, count(distinct (es.datum, es.mahlzeit)) mal from es where es.rezept_id is not null group by 1) x
                           join public."Rezepte" r on r."Rezept_ID" = x.rid)
  ) into r;

  -- Ist gegen Soll (FL-2) für den ganzen Zeitraum. Mikros nur für echte Klienten.
  r := r || jsonb_build_object('ist_soll', (
    select jsonb_agg(to_jsonb(s) - 'zeitraum_von' - 'zeitraum_bis')
      from public.cb_auswertung_ist_soll(p_benutzer, p_von, p_bis, 'gesamt') s
     where not (v_muster and s.kennzahl like 'mikro:%')));

  -- Rezepte: echte Klienten = eigene Rezepte (von der Einwilligung umfasst); Muster = gespeicherte/empfohlene
  if v_muster then
    select jsonb_agg(jsonb_build_object('rezept_id', r2."Rezept_ID", 'name', r2."Rezeptname", 'kcal_portion', r2."Kcal_Portion",
             'protein_portion', r2."Protein_g_Portion", 'mahlzeit', r2."Mahlzeit_Typ", 'bild', r2."Bild_URL", 'herkunft', mr.herkunft)
             order by mr.herkunft, r2."Rezeptname")
      into v_rez from public.fl_muster_rezept mr join public."Rezepte" r2 on r2."Rezept_ID" = mr.rezept_id
     where mr.benutzer_id = p_benutzer;
    -- Wochenplan: aktuelle und nächste Woche (Montag bis Sonntag)
    v_wv := date_trunc('week', v_heute)::date;
    select jsonb_agg(jsonb_build_object('datum', w.datum + v_ver, 'slot', w.slot, 'rezept_id', w.rezept_id, 'titel', coalesce(r3."Rezeptname", w.titel),
             'kcal_portion', r3."Kcal_Portion") order by w.datum, array_position(array['Frühstück','Mittag','Abendessen','Snack'], w.slot))
      into v_plan from public.fl_muster_wochenplan w left join public."Rezepte" r3 on r3."Rezept_ID" = w.rezept_id
     where w.benutzer_id = p_benutzer and w.datum + v_ver between v_wv and v_wv + 13;
    select jsonb_agg(jsonb_build_object('kennzahl', v.kennzahl, 'wert', v.wert, 'einheit', v.einheit, 'art', v.art, 'notiz', v.notiz) order by v.id)
      into v_vg from public.fl_muster_vorgabe v where v.benutzer_id = p_benutzer;
    r := r || jsonb_build_object('rezepte', coalesce(v_rez, '[]'::jsonb), 'wochenplan', coalesce(v_plan, '[]'::jsonb),
                                 'wochenplan_von', v_wv, 'vorgaben', coalesce(v_vg, '[]'::jsonb));
  else
    select jsonb_agg(jsonb_build_object('rezept_id', r2."Rezept_ID", 'name', r2."Rezeptname", 'kcal_portion', r2."Kcal_Portion",
             'protein_portion', r2."Protein_g_Portion", 'mahlzeit', r2."Mahlzeit_Typ", 'bild', r2."Bild_URL", 'herkunft', 'eigenes')
             order by r2."Rezeptname")
      into v_rez from public."Rezepte" r2 where r2."Benutzer_ID" = p_benutzer and coalesce(r2."Status", '') <> 'Entwurf';
    select jsonb_agg(jsonb_build_object('kennzahl', v.kennzahl, 'wert', v.wert, 'einheit', v.einheit, 'art', v.art, 'notiz', v.notiz,
             'seit', v.gueltig_ab) order by v.kennzahl)
      into v_vg from (select distinct on (kv.kennzahl) kv.* from public."Klient_Vorgabe" kv
                       where kv."Benutzer_ID" = p_benutzer and kv.gueltig_ab <= v_heute and (kv.gueltig_bis is null or kv.gueltig_bis >= v_heute)
                       order by kv.kennzahl, kv.gueltig_ab desc, kv.id desc) v;
    -- Wochenplan ist (Stand FL-1-Einwilligung fl1-2026-11-11) NICHT von der Einwilligung umfasst
    r := r || jsonb_build_object('rezepte', coalesce(v_rez, '[]'::jsonb), 'wochenplan', null,
                                 'wochenplan_hinweis', 'Der Wochenplan ist von der Einwilligung noch nicht umfasst.',
                                 'vorgaben', coalesce(v_vg, '[]'::jsonb));
  end if;
  return r || jsonb_build_object('profil', v_profil, 'muster', v_muster);
end $f$;
revoke all on function public._fl4_dashboard(text, date, date) from public, anon, authenticated;

-- Echte Klienten: nur über den Key-Code der angemeldeten Fachperson (FL-1)
create or replace function public.cb_fp_klient_dashboard(p_code text, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare k record; v_von date; v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  select * into k from public._fp_klient(p_code);                           -- wirft 42501 ohne Recht
  v_von := greatest(p_von, k.daten_ab);
  if v_von > p_bis then
    return jsonb_build_object('von', p_von, 'bis', p_bis, 'leer', true, 'daten_ab', k.daten_ab, 'heute', v_heute,
                              'code', upper(trim(p_code)), 'grund', 'Einträge sind erst ab dem ' || to_char(k.daten_ab, 'DD.MM.YYYY') || ' freigegeben.');
  end if;
  return public._fl4_dashboard(k.benutzer_id, v_von, p_bis)
      || jsonb_build_object('daten_ab', case when k.daten_ab > date '1900-01-01' then k.daten_ab end, 'heute', v_heute, 'code', upper(trim(p_code)));
end $f$;

-- Vorgaben der Therapeutin für einen echten Klienten setzen (p_wert null = Vorgabe entfernen)
create or replace function public.cb_fp_vorgabe_setzen(p_code text, p_kennzahl text, p_wert numeric, p_art text default null, p_notiz text default null)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare k record; v public.fachperson_konto := public._fp_ich(); v_heute date := (now() at time zone 'Europe/Berlin')::date;
        v_einheit text; v_art text;
begin
  select * into k from public._fp_klient(p_code);
  select x.e, coalesce(p_art, x.a) into v_einheit, v_art
    from (values ('kcal','kcal','etwa'), ('protein','g','mindestens'), ('kh','g','etwa'), ('fett','g','etwa'),
                 ('zucker','g','hoechstens'), ('ballaststoffe','g','mindestens'), ('salz','g','hoechstens'),
                 ('gruppe:gemuese','g','mindestens'), ('gruppe:obst','g','mindestens'), ('gruppe:gemuese+obst','g','mindestens'))
         x(k, e, a) where x.k = p_kennzahl;
  if v_einheit is null then return jsonb_build_object('ok', false, 'grund', 'Diese Kennzahl gibt es nicht.'); end if;
  if v_art not in ('mindestens','hoechstens','etwa') then return jsonb_build_object('ok', false, 'grund', 'Art: mindestens, höchstens oder etwa.'); end if;
  if p_wert is not null and (p_wert <= 0 or p_wert > case when v_einheit = 'kcal' then 6000 else 3000 end) then
    return jsonb_build_object('ok', false, 'grund', 'Bitte einen sinnvollen Wert eintragen.'); end if;
  -- alte Vorgabe endet gestern (heute angelegte werden ersetzt)
  delete from public."Klient_Vorgabe" where "Benutzer_ID" = k.benutzer_id and kennzahl = p_kennzahl and gueltig_ab >= v_heute;
  update public."Klient_Vorgabe" set gueltig_bis = v_heute - 1
   where "Benutzer_ID" = k.benutzer_id and kennzahl = p_kennzahl and (gueltig_bis is null or gueltig_bis >= v_heute);
  if p_wert is not null then
    insert into public."Klient_Vorgabe"("Benutzer_ID", kennzahl, wert, einheit, bezug, art, gueltig_ab, gesetzt_von, notiz)
    values (k.benutzer_id, p_kennzahl, p_wert, v_einheit, 'tag', v_art, v_heute, v.name, nullif(left(trim(coalesce(p_notiz, '')), 200), ''));
  end if;
  return jsonb_build_object('ok', true);
end $f$;

-- Musterpraxis: Übersicht (ohne Login, nur mit Token)
create or replace function public.cb_fl_muster(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  if not public._fl_muster_token_ok(p_token) then raise exception 'Dieser Vorschau-Link gilt nicht mehr.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'praxis', (select wert from public.fachleute_einstellung where schluessel = 'muster_praxis'),
    'heute', v_heute,
    'klienten', (select jsonb_agg(jsonb_build_object('nr', m.nr, 'code', m.code, 'name', m.name, 'steckbrief', m.steckbrief,
                   'start_am', v_heute - m.key_seit_tage, 'laeuft_bis', v_heute - m.key_seit_tage + m.key_laufzeit_tage,
                   'letzter_eintrag', (select max(t.datum + public._fl_muster_versatz()) from public.fl_muster_tagebuch t
                                        where t.benutzer_id = m.benutzer_id and t.datum + public._fl_muster_versatz() < v_heute))
                   order by m.nr) from public.fl_muster_klient m));
end $f$;

create or replace function public.cb_fl_muster_dashboard(p_token text, p_nr int, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_bid text;
begin
  if not public._fl_muster_token_ok(p_token) then raise exception 'Dieser Vorschau-Link gilt nicht mehr.' using errcode = '42501'; end if;
  select benutzer_id into v_bid from public.fl_muster_klient where nr = p_nr;   -- nur Musterklienten, nie eine freie ID
  if v_bid is null or not public._fl_muster_ist(v_bid) then raise exception 'Diesen Musterklienten gibt es nicht.' using errcode = '42501'; end if;
  return public._fl4_dashboard(v_bid, p_von, p_bis)
      || jsonb_build_object('heute', (now() at time zone 'Europe/Berlin')::date, 'code', (select code from public.fl_muster_klient where nr = p_nr));
end $f$;

-- Admin: Vorschau-Link anzeigen oder neu würfeln
create or replace function public.cb_admin_fl_muster_link(p_neu boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v text;
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  if p_neu then update public.fachleute_einstellung set wert = replace(gen_random_uuid()::text, '-', '') where schluessel = 'muster_token'; end if;
  select wert into v from public.fachleute_einstellung where schluessel = 'muster_token';
  return jsonb_build_object('ok', true, 'link', 'https://root-index.de/fachleute-muster.html?z=' || v);
end $f$;

-- =====================================================================
-- Teil D: Wunschliste der Fachleute
-- =====================================================================
create table if not exists public.fl_wunsch (
  id            bigint generated always as identity primary key,
  titel         text not null check (length(trim(titel)) between 3 and 120),
  beschreibung  text check (beschreibung is null or length(beschreibung) <= 4000),
  bereich       text not null check (bereich in ('dashboard','klienten','rezepte','auswertungen','sonstiges')),
  status        text not null default 'neu' check (status in ('neu','geplant','in_arbeit','erledigt','abgelehnt')),
  grund         text,                                   -- Pflicht bei „abgelehnt“
  antwort       text,                                   -- Antwort von Root Index (Ralph)
  antwort_am    timestamptz,
  erstellt_von  uuid not null references auth.users(id) on delete cascade,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint fl_wunsch_grund_bei_ablehnung check (status <> 'abgelehnt' or length(trim(coalesce(grund, ''))) > 0)
);
create table if not exists public.fl_wunsch_stimme (
  wunsch_id bigint not null references public.fl_wunsch(id) on delete cascade,
  auth_id   uuid   not null references auth.users(id) on delete cascade,
  am        timestamptz not null default now(),
  primary key (wunsch_id, auth_id)
);
create table if not exists public.fl_wunsch_anhang (
  id          bigint generated always as identity primary key,
  wunsch_id   bigint not null references public.fl_wunsch(id) on delete cascade,
  pfad        text not null unique,                     -- im Bucket fachleute-wunsch: <wunsch_id>/<datei>
  dateiname   text not null,
  mime        text not null,
  groesse     bigint not null,
  hochgeladen_von uuid not null references auth.users(id) on delete cascade,
  am          timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['fl_wunsch','fl_wunsch_stimme','fl_wunsch_anhang'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Wer darf die Wunschliste sehen und schreiben? Admin oder freigeschaltete Fachperson
-- (aktiv, Lizenz gültig, aktueller Verschwiegenheitsvertrag bestätigt).
create or replace function public._fl_wunsch_darf()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.cb_ist_admin()
      or (exists (select 1 from public.fachperson_konto f where f.auth_id = auth.uid() and f.aktiv)
          and public._fp_lizenz_ok(auth.uid()) and public._fp_vertrag_ok(auth.uid())));
$$;
create or replace function public._fl_wunsch_pruefen() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._fl_wunsch_darf() then raise exception 'Die Wunschliste ist nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
end $$;
-- Für die Storage-Regel: Pfad muss mit der ID eines vorhandenen Wunsches beginnen
create or replace function public._fl_wunsch_pfad_ok(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_name, '') ~ '^[0-9]+/[^/]+$'
     and exists (select 1 from public.fl_wunsch w where w.id = split_part(p_name, '/', 1)::bigint);
$$;

create or replace function public._fl_wer(p_auth uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select f.name || coalesce(' · ' || f.praxis, '') from public.fachperson_konto f where f.auth_id = p_auth),
                  case when exists (select 1 from public."Benutzer" b where b.auth_id = p_auth and b.is_admin) then 'Root Index' end,
                  'Fachperson');
$$;

create or replace function public.cb_fl_wuensche()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
begin
  perform public._fl_wunsch_pruefen();
  return jsonb_build_object('admin', public.cb_ist_admin(), 'liste', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', w.id, 'titel', w.titel, 'beschreibung', w.beschreibung, 'bereich', w.bereich, 'status', w.status,
      'grund', w.grund, 'antwort', w.antwort, 'antwort_am', w.antwort_am,
      'erstellt_am', w.erstellt_am, 'von', public._fl_wer(w.erstellt_von), 'eigener', w.erstellt_von = auth.uid(),
      'stimmen', (select count(*) from public.fl_wunsch_stimme s where s.wunsch_id = w.id),
      'ich_auch', exists (select 1 from public.fl_wunsch_stimme s where s.wunsch_id = w.id and s.auth_id = auth.uid()),
      'anhaenge', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'pfad', a.pfad, 'dateiname', a.dateiname, 'mime', a.mime,
                                    'groesse', a.groesse, 'eigener', a.hochgeladen_von = auth.uid()) order by a.am)
                              from public.fl_wunsch_anhang a where a.wunsch_id = w.id), '[]'::jsonb))
      order by array_position(array['in_arbeit','geplant','neu','erledigt','abgelehnt'], w.status),
               (select count(*) from public.fl_wunsch_stimme s where s.wunsch_id = w.id) desc, w.erstellt_am desc)
      from public.fl_wunsch w), '[]'::jsonb));
end $f$;

-- Ähnliche Einträge schon beim Tippen (Trigramm-Ähnlichkeit auf Titel und Beschreibung)
create or replace function public.cb_fl_wunsch_aehnlich(p_text text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare t text := lower(trim(coalesce(p_text, '')));
begin
  perform public._fl_wunsch_pruefen();
  if length(t) < 4 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x.j order by x.s desc) from (
    select greatest(public.word_similarity(t, lower(w.titel)), public.word_similarity(t, lower(coalesce(w.beschreibung, ''))) * 0.8) s,
           jsonb_build_object('id', w.id, 'titel', w.titel, 'status', w.status, 'bereich', w.bereich,
                              'stimmen', (select count(*) from public.fl_wunsch_stimme s where s.wunsch_id = w.id)) j
      from public.fl_wunsch w
     where public.word_similarity(t, lower(w.titel)) > 0.3 or public.word_similarity(t, lower(coalesce(w.beschreibung, ''))) > 0.4
     order by 1 desc limit 5) x), '[]'::jsonb);
end $f$;

create or replace function public.cb_fl_wunsch_anlegen(p_titel text, p_beschreibung text, p_bereich text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_id bigint;
begin
  perform public._fl_wunsch_pruefen();
  if length(trim(coalesce(p_titel, ''))) < 3 then return jsonb_build_object('ok', false, 'grund', 'Bitte einen Titel mit mindestens 3 Zeichen.'); end if;
  if p_bereich not in ('dashboard','klienten','rezepte','auswertungen','sonstiges') then
    return jsonb_build_object('ok', false, 'grund', 'Bitte einen Bereich wählen.'); end if;
  if (select count(*) from public.fl_wunsch where erstellt_von = auth.uid() and erstellt_am > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'grund', 'Zu viele Einträge in kurzer Zeit. Bitte später noch einmal.'); end if;
  insert into public.fl_wunsch(titel, beschreibung, bereich, erstellt_von)
  values (left(trim(p_titel), 120), nullif(left(trim(coalesce(p_beschreibung, '')), 4000), ''), p_bereich, auth.uid())
  returning id into v_id;
  insert into public.fl_wunsch_stimme(wunsch_id, auth_id) values (v_id, auth.uid());   -- eigene Stimme zählt
  return jsonb_build_object('ok', true, 'id', v_id);
end $f$;

-- Eigenen Wunsch ändern (solange Status „neu“) – Admin immer
create or replace function public.cb_fl_wunsch_bearbeiten(p_id bigint, p_titel text, p_beschreibung text, p_bereich text)
returns jsonb language plpgsql security definer set search_path = public as $f$
begin
  perform public._fl_wunsch_pruefen();
  if length(trim(coalesce(p_titel, ''))) < 3 then return jsonb_build_object('ok', false, 'grund', 'Bitte einen Titel mit mindestens 3 Zeichen.'); end if;
  if p_bereich not in ('dashboard','klienten','rezepte','auswertungen','sonstiges') then
    return jsonb_build_object('ok', false, 'grund', 'Bitte einen Bereich wählen.'); end if;
  update public.fl_wunsch set titel = left(trim(p_titel), 120), beschreibung = nullif(left(trim(coalesce(p_beschreibung, '')), 4000), ''),
         bereich = p_bereich, geaendert_am = now()
   where id = p_id and ((erstellt_von = auth.uid() and status = 'neu') or public.cb_ist_admin());
  if not found then return jsonb_build_object('ok', false, 'grund', 'Ändern geht nur beim eigenen Wunsch, solange er „neu“ ist.'); end if;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.cb_fl_wunsch_stimme(p_id bigint, p_an boolean)
returns jsonb language plpgsql security definer set search_path = public as $f$
begin
  perform public._fl_wunsch_pruefen();
  if not exists (select 1 from public.fl_wunsch where id = p_id) then return jsonb_build_object('ok', false, 'grund', 'Diesen Wunsch gibt es nicht.'); end if;
  if coalesce(p_an, true) then
    insert into public.fl_wunsch_stimme(wunsch_id, auth_id) values (p_id, auth.uid()) on conflict do nothing;
  else
    delete from public.fl_wunsch_stimme where wunsch_id = p_id and auth_id = auth.uid();
  end if;
  return jsonb_build_object('ok', true, 'stimmen', (select count(*) from public.fl_wunsch_stimme where wunsch_id = p_id));
end $f$;

-- Nach dem Hochladen in den Bucket: Anhang eintragen. Größe und Typ liest der Server aus dem Storage.
create or replace function public.cb_fl_wunsch_anhang_eintragen(p_id bigint, p_pfad text, p_dateiname text)
returns jsonb language plpgsql security definer set search_path = public, storage as $f$
declare o record;
begin
  perform public._fl_wunsch_pruefen();
  if split_part(coalesce(p_pfad, ''), '/', 1) <> p_id::text then return jsonb_build_object('ok', false, 'grund', 'Pfad passt nicht zum Wunsch.'); end if;
  select ob.name, ob.owner_id, ob.metadata into o from storage.objects ob where ob.bucket_id = 'fachleute-wunsch' and ob.name = p_pfad;
  if o.name is null then return jsonb_build_object('ok', false, 'grund', 'Datei nicht gefunden.'); end if;
  if o.owner_id is distinct from auth.uid()::text then return jsonb_build_object('ok', false, 'grund', 'Nur eigene Uploads.'); end if;
  if (select count(*) from public.fl_wunsch_anhang where wunsch_id = p_id) >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'Höchstens 10 Anhänge je Wunsch.'); end if;
  insert into public.fl_wunsch_anhang(wunsch_id, pfad, dateiname, mime, groesse, hochgeladen_von)
  values (p_id, p_pfad, left(coalesce(nullif(trim(p_dateiname), ''), split_part(p_pfad, '/', 2)), 160),
          coalesce(o.metadata->>'mimetype', 'application/octet-stream'), coalesce((o.metadata->>'size')::bigint, 0), auth.uid())
  on conflict (pfad) do nothing;
  return jsonb_build_object('ok', true);
end $f$;

-- Anhang austragen (eigener oder Admin). Die Datei selbst löscht die Seite vorher über den Storage.
create or replace function public.cb_fl_wunsch_anhang_loeschen(p_anhang_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_pfad text;
begin
  perform public._fl_wunsch_pruefen();
  delete from public.fl_wunsch_anhang where id = p_anhang_id and (hochgeladen_von = auth.uid() or public.cb_ist_admin())
  returning pfad into v_pfad;
  if v_pfad is null then return jsonb_build_object('ok', false, 'grund', 'Nur eigene Anhänge.'); end if;
  return jsonb_build_object('ok', true, 'pfad', v_pfad);
end $f$;

-- Admin (Ralph): Status setzen und antworten
create or replace function public.cb_admin_fl_wunsch_setzen(p_id bigint, p_status text, p_antwort text default null, p_grund text default null)
returns jsonb language plpgsql security definer set search_path = public as $f$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  if p_status not in ('neu','geplant','in_arbeit','erledigt','abgelehnt') then return jsonb_build_object('ok', false, 'grund', 'Unbekannter Status.'); end if;
  if p_status = 'abgelehnt' and length(trim(coalesce(p_grund, ''))) = 0 then
    return jsonb_build_object('ok', false, 'grund', 'Bei „abgelehnt“ bitte einen Grund angeben.'); end if;
  update public.fl_wunsch set status = p_status,
         grund = case when p_status = 'abgelehnt' then left(trim(p_grund), 1000) else null end,
         antwort = case when p_antwort is null then antwort else nullif(left(trim(p_antwort), 4000), '') end,
         antwort_am = case when p_antwort is null then antwort_am when nullif(trim(p_antwort), '') is null then null else now() end,
         geaendert_am = now()
   where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'grund', 'Diesen Wunsch gibt es nicht.'); end if;
  return jsonb_build_object('ok', true);
end $f$;

-- Storage: privater Bucket, 10 MB, Bilder und PDF
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('fachleute-wunsch', 'fachleute-wunsch', false, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists fl_wunsch_lesen on storage.objects;
create policy fl_wunsch_lesen on storage.objects for select to authenticated
  using (bucket_id = 'fachleute-wunsch' and public._fl_wunsch_darf());
drop policy if exists fl_wunsch_hochladen on storage.objects;
create policy fl_wunsch_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'fachleute-wunsch' and public._fl_wunsch_darf() and public._fl_wunsch_pfad_ok(name));
drop policy if exists fl_wunsch_loeschen on storage.objects;
create policy fl_wunsch_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'fachleute-wunsch' and public._fl_wunsch_darf() and (owner_id = auth.uid()::text or public.cb_ist_admin()));

-- =====================================================================
-- Rechte
-- =====================================================================
do $$ declare f text; begin
  foreach f in array array[
    'public._fl_muster_versatz()', 'public._fl_muster_ist(text)', 'public._fl_muster_token_ok(text)',
    'public._fl_muster_eintraege(text)', 'public._fl4_dashboard(text, date, date)',
    'public._fl_wunsch_pruefen()', 'public._fl_wer(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- Storage-Regeln laufen als angemeldeter Nutzer: diese zwei brauchen execute (liefern nur ja/nein)
  foreach f in array array['public._fl_wunsch_darf()', 'public._fl_wunsch_pfad_ok(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.cb_fp_klient_dashboard(text, date, date)',
    'public.cb_fp_vorgabe_setzen(text, text, numeric, text, text)',
    'public.cb_admin_fl_muster_link(boolean)',
    'public.cb_fl_wuensche()', 'public.cb_fl_wunsch_aehnlich(text)',
    'public.cb_fl_wunsch_anlegen(text, text, text)', 'public.cb_fl_wunsch_bearbeiten(bigint, text, text, text)',
    'public.cb_fl_wunsch_stimme(bigint, boolean)', 'public.cb_fl_wunsch_anhang_eintragen(bigint, text, text)',
    'public.cb_fl_wunsch_anhang_loeschen(bigint)', 'public.cb_admin_fl_wunsch_setzen(bigint, text, text, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Musterpraxis ohne Login (nur mit Token)
  foreach f in array array['public.cb_fl_muster(text)', 'public.cb_fl_muster_dashboard(text, integer, date, date)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
