-- Rückweg zu waskoche_alias_20261116b.sql
delete from public."Zutat_Alias"
where "Alias" in ('nudeln','spaghetti','penne','pasta','teigwaren','linsen','rote linsen')
  and "Alias" not in (select "Alias" from shadow_v1._sich_zutat_alias_20261116b);
update public."Zutat_Alias" set "Produkt_ID" = 'P1155' where "Alias" = 'schafskäse' and "Produkt_ID" = 'P13634';
