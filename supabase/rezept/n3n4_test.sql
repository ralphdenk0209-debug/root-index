-- Test N3/N4. Endet IMMER mit Fehler (= zurückgerollt). Ergebnis: "N3N4-TEST: <n> OK, <m> FEHLER | …".
-- Probelauf vor dem Einspielen: n3n4_rezept_buchen.sql + diese Datei in EINEM Aufruf.
-- Nach dem Einspielen: nur diese Datei (Prüfungen der Reparatur greifen dann auf die Sicherung).
do $test$
#variable_conflict use_column
declare ok int := 0; bad int := 0; log text := ''; n int; n2 int; t text; v_auth uuid; v_batch text;
  rz constant text := 'RU3680a644e61747d3a105929dbbce78bb';  -- Sandras „Gemüse-Eierpfanne mit Schafskäse“
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;

  -- 1) Portionen-Text
  insert into _erg(ok,txt) values (public._rezept_portion_txt(1) = '1 Portion', '1 → „' || public._rezept_portion_txt(1) || '“');
  insert into _erg(ok,txt) values (public._rezept_portion_txt(1.5) = '1,5 Portionen', '1,5 → „' || public._rezept_portion_txt(1.5) || '“');
  insert into _erg(ok,txt) values (public._rezept_portion_txt(0.25) = '0,25 Portionen', '0,25 → „' || public._rezept_portion_txt(0.25) || '“');
  insert into _erg(ok,txt) values (public._rezept_portion_txt(2) = '2 Portionen', '2 → „' || public._rezept_portion_txt(2) || '“');
  insert into _erg(ok,txt) values (public._rezept_portion_txt(1.00) = '1 Portion', '1,00 → „' || public._rezept_portion_txt(1.00) || '“');

  -- 2) Reparatur: Sicherung vollständig, kein „#“ mehr, Werte stimmen
  select count(*) into n from shadow_v1._sich_n4_rezept_menge_20261113;
  insert into _erg(ok,txt) values (n > 0, 'Sicherung der alten Texte: ' || n || ' Zeilen');
  insert into _erg(ok,txt) values (not exists (select 1 from public."Ernaehrungstagebuch" where "Rezept_Menge" like '%#%'), 'Kein „#“ mehr in Rezept_Menge');
  select count(*) into n2 from shadow_v1._sich_n4_rezept_menge_20261113 s join public."Ernaehrungstagebuch" e using ("Eintrag_ID")
    where e."Rezept_Menge" = case s."Rezept_Menge" when '1.0# Portion' then '1 Portion' when '2.0# Portionen' then '2 Portionen' end;
  insert into _erg(ok,txt) values (n2 = n, 'Repariert richtig: ' || n2 || ' von ' || n || ' (1.0# → 1 Portion, 2.0# → 2 Portionen)');
  insert into _erg(ok,txt) values ((select count(*) from shadow_v1._sich_fn_n4_rezept_buchen_20261113) = 1, 'Alte cb_tb_rezept_buchen gesichert');
  insert into _erg(ok,txt) values (not has_table_privilege('anon', 'shadow_v1._sich_n4_rezept_menge_20261113', 'select')
                                   and not has_table_privilege('authenticated', 'shadow_v1._sich_n4_rezept_menge_20261113', 'select'), 'Sicherung nicht lesbar für anon/authenticated');

  -- 3) N3: Liste der nicht gebuchten Zutaten an Sandras Rezept
  select string_agg(zutat || ' (' || coalesce(menge,'–') || ') – ' || grund, ' / ' order by reihenfolge), count(*) into t, n
    from public.cb_rezept_nicht_gebucht(rz);
  insert into _erg(ok,txt) values (n = 2 and t like 'Gemüsemischung (200 g) – nicht zugeordnet%' and t like '%Salz und Pfeffer (nach Geschmack) – nicht zugeordnet',
                                   'Nicht gebucht: ' || coalesce(t,'–'));
  -- Gegenprobe über alle Rezepte: nicht gebucht + gebucht = alle Zutaten
  select count(*) into n from public."Rezepte" r
   where (select count(*) from public.cb_rezept_nicht_gebucht(r."Rezept_ID"))
       + (select count(*) from public."Rezept_Produkte" rp where rp."Rezept_ID" = r."Rezept_ID" and rp."Produkt_ID" is not null and rp."Menge_g" > 0)
      <> (select count(*) from public."Rezept_Produkte" rp where rp."Rezept_ID" = r."Rezept_ID");
  insert into _erg(ok,txt) values (n = 0, 'Gegenprobe alle Rezepte: nicht gebucht + gebucht = alle Zutaten (Abweichungen: ' || n || ')');
  insert into _erg(ok,txt) values (has_function_privilege('authenticated', 'public.cb_rezept_nicht_gebucht(text)', 'execute')
                                   and not has_function_privilege('anon', 'public.cb_rezept_nicht_gebucht(text)', 'execute'), 'Rechte: angemeldet ja, anonym nein');

  -- 4) Buchung wie Sandra (wird zurückgerollt): 1,5 Portionen
  select auth_id into v_auth from public."Benutzer" where "Benutzer_ID" = 'U001';
  perform set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  v_batch := public.cb_tb_rezept_buchen('Mittag', rz, current_date, 1.5, null);
  select count(*), min("Rezept_Menge"), string_agg("Produkt_ID" || ':' || "Menge_g", ',' order by "Eintrag_ID") into n, t, log
    from public."Ernaehrungstagebuch" where "Rezept_Batch" = v_batch;
  insert into _erg(ok,txt) values (t = '1,5 Portionen', 'Neue Buchung schreibt „' || coalesce(t,'–') || '“');
  insert into _erg(ok,txt) values (n = 3 and log like '%P162:15%', 'Gebucht ' || n || ' Zutaten inkl. Öl: ' || log);
  log := '';

  select count(*) filter (where ok), count(*) filter (where not ok) into ok, bad from _erg;
  select string_agg((case when e.ok then 'OK ' else 'FEHLER ' end) || e.txt, ' | ' order by nr) into log from _erg e;
  raise exception 'N3N4-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
