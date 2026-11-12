-- FL-5d Test: neue Texte im Plan-Vorschlag sind live, alte nicht mehr. Nur lesen.
-- Erwartung nach dem Einspielen von fl5d_texte_vorschlag.sql: alle Zeilen ok = true.
-- Danach zusätzlich fl5b_test.sql laufen lassen (30 Prüfungen, Logik unverändert).
with f as (
  select string_agg(p.prosrc, ' ') s from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('_fl5_vorschlag', 'cb_fl5_muster_plan_vorschlag')),
neu(txt) as (values
  ('Der Zeitraum passt nicht. Höchstens 6 Wochen.'),
  ('Diabetes: weniger Zucker und Kohlenhydrate, keine Desserts'),
  ('Geprüft sind die 14 Hauptallergene und Laktose, auch Spuren. Andere Unverträglichkeiten wie Fruktose oder Histamin sind nicht geprüft.'),
  ('''Akte: '''),
  ('Aus der Akte nicht berücksichtigt: '),
  ('. Selbst prüfen.'),
  ('''Kalorienziel '''),
  ('gern gegessen'),
  ('Für einige Plätze passt nichts. Dort selbst wählen.'),
  ('Kein freigegebenes Tagebuch. Lieblingsprodukte und Kalorienziel fehlen.'),
  ('Diese Musterperson gibt es nicht.')),
alt(txt) as (values
  ('Zeitraum ungültig'), ('Kohlenhydrat-Anteil zuerst'), ('Geprüft werden die 14'), ('aus der Akte: '),
  ('nicht automatisch berücksichtigt'), ('Portionen nach Kalorienziel'), ('isst sie/er gern'),
  ('aus dem Bestand'), ('Ohne freigegebenes Tagebuch'), ('Musterklienten'))
select 'neu da: ' || neu.txt pruefung, position(neu.txt in f.s) > 0 ok from neu, f
union all
select 'alt weg: ' || alt.txt, position(alt.txt in f.s) = 0 from alt, f;
