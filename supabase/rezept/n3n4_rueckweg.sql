-- Rückweg N3/N4: alte Funktion und alte Texte zurück, neue Funktionen weg.
do $r$ declare d text; begin
  select def into d from shadow_v1._sich_fn_n4_rezept_buchen_20261113 where name = 'cb_tb_rezept_buchen';
  if d is null then raise exception 'Sicherung fehlt'; end if;
  execute d;
end $r$;
update public."Ernaehrungstagebuch" e set "Rezept_Menge" = s."Rezept_Menge"
  from shadow_v1._sich_n4_rezept_menge_20261113 s where s."Eintrag_ID" = e."Eintrag_ID";
drop function if exists public.cb_rezept_nicht_gebucht(text);
drop function if exists public._rezept_portion_txt(numeric);
