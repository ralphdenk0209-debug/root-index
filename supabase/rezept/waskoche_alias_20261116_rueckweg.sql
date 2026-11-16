-- Rückweg zu waskoche_alias_20261116.sql: entfernt nur die an diesem Tag eingefügten Zeilen.
delete from "Zutat_Alias"
where "Alias" in ('magerquark','gemüsemischung','paprikaschote','paprikaschoten','kreuzkümmel','petersilie')
  and "Erstellt_am"::date = date '2026-11-16';
