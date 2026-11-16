-- 16.11.2026 „Was koche ich?“: fehlende Zuordnungen für Grundlebensmittel (Zutat_Alias).
-- Nur Einfügen, nichts Bestehendes ändern oder löschen (on conflict do nothing / not exists).
-- Vorher: magerquark (2 Treffer, raten nicht), gemüsemischung (12), paprikaschote(n) (2),
-- petersilie (21) = nicht zugeordnet; kreuzkümmel → „Kreuzkümmel-Käse“ (falsch).
-- Rückweg: supabase/rezept/waskoche_alias_20261116_rueckweg.sql
-- Sicherung des Ist-Stands (171 Zeilen am 16.11.2026).
create table if not exists shadow_v1._sich_zutat_alias_20261116 as select * from public."Zutat_Alias";

insert into "Zutat_Alias" ("Alias", "Produkt_ID")
select a, p from (values
  ('magerquark',     'P537'),   -- Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.
  ('gemüsemischung', 'P343'),   -- Gemüsemischung Kaisergemüse (generisch)
  ('paprikaschote',  'P114'),   -- Paprika (rot), generisch
  ('paprikaschoten', 'P114'),
  ('kreuzkümmel',    'P1688'),  -- Kreuzkümmel, gemahlen
  ('petersilie',     'P288')    -- Petersilienblatt
) v(a, p)
where exists (select 1 from "Produkte" x where x."Produkt_ID" = v.p and x."Produktstatus" = 'Aktiv')
  and not exists (select 1 from "Zutat_Alias" z where z."Alias" = v.a);
