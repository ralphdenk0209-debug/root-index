-- 16.11.2026 (Ralph: offene Punkte umsetzen): allgemeine Einträge statt Marken in „Was koche ich?“.
-- Vorher: nudeln → „Nudeln“ (Feinkost Dittmann), spaghetti → Lorettes (128 kcal, frisch),
-- linsen → „Linsen“ (93,6 kcal, gekocht), rote linsen → dmBio, schafskäse → „Salakis Light“ (Marke).
-- Rückweg: waskoche_alias_20261116b_rueckweg.sql
create table if not exists shadow_v1._sich_zutat_alias_20261116b as select * from public."Zutat_Alias";

insert into public."Zutat_Alias" ("Alias", "Produkt_ID")
select a, p from (values
  ('nudeln',      'P491'),  -- Teigwaren eifrei (trocken, BLS)
  ('spaghetti',   'P491'),
  ('penne',       'P491'),
  ('pasta',       'P491'),
  ('teigwaren',   'P491'),
  ('linsen',      'P375'),  -- Linse reif (getrocknet, BLS)
  ('rote linsen', 'P381')   -- Linse rot reif (getrocknet, BLS)
) v(a, p)
where exists (select 1 from public."Produkte" x where x."Produkt_ID" = v.p and x."Produktstatus" = 'Aktiv')
  and not exists (select 1 from public."Zutat_Alias" z where z."Alias" = v.a);

-- Bestehende Zuordnung umstellen (Zeile bleibt, nur das Ziel ändert sich; alter Wert in der Sicherung).
update public."Zutat_Alias" set "Produkt_ID" = 'P13634'   -- Feta (ohne Marke)
where "Alias" = 'schafskäse' and "Produkt_ID" = 'P1155';
