-- FL-4 Zugriffstest: Musterpraxis, Dashboard, Wunschliste.
-- Läuft in EINER Transaktion und endet IMMER mit einem Fehler, damit alles
-- zurückgerollt wird. Ergebnis in der Fehlermeldung: "FL4-TEST: <n> OK, <m> FEHLER | ...".
-- Vor dem Einspielen (Probelauf): fl2_auswertung.sql + fl4_dashboard.sql + diese Datei zusammen ausführen.
-- Nach dem Einspielen: nur diese Datei.
do $test$
#variable_conflict use_column
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid(); x1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  heute date := (now() at time zone 'Europe/Berlin')::date;
  wv date := date_trunc('week', (now() at time zone 'Europe/Berlin')::date)::date - 7;   -- letzte volle Woche
  tok text; vv text; ev text; v_code text; j jsonb; j2 jsonb; n int; n2 int; w1 bigint; v_anh bigint; echt_bid text; ok int := 0; bad int := 0; log text := '';
  vor_benutzer int; vor_tagebuch int; vor_codes int; vor_konten int;
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;
  select wert into tok from public.fachleute_einstellung where schluessel = 'muster_token';
  select "Benutzer_ID" into echt_bid from public."Ernaehrungstagebuch" where "Benutzer_ID" not like 'U-fl4test%' order by "Datum" desc limit 1;

  -- 1) Musterdaten: getrennt von echten Nutzern ------------------------------
  insert into _erg(ok,txt) values (not exists (select 1 from public."Benutzer" where "Benutzer_ID" like 'MUSTER-%'), 'Keine Musterklienten in Benutzer');
  insert into _erg(ok,txt) values (not exists (select 1 from public."Ernaehrungstagebuch" where "Benutzer_ID" like 'MUSTER-%'), 'Keine Mustereinträge im echten Tagebuch');
  insert into _erg(ok,txt) values (not exists (select 1 from public.gratis_code where code like 'MUSTER-%'), 'Muster-Keys sind keine echten Codes (keine Abrechnung)');
  insert into _erg(ok,txt) values (not exists (select 1 from public.fachperson_konto where name ilike '%muster%' or praxis ilike '%muster%'), 'Praxis Muster ist kein Fachperson-Konto');
  select count(*), count(distinct benutzer_id) into n, n2 from public.fl_muster_tagebuch;
  insert into _erg(ok,txt) values (n > 800 and n2 = 4, 'Mustertagebuch: ' || n || ' Zeilen für ' || n2 || ' Personen');
  select count(*) into n from public.fl_muster_tagebuch t
   where not exists (select 1 from public."Scores" s where s."Produkt_ID" = t.produkt_id and s."Clean_Score" is not null)
      or not exists (select 1 from public."Naehrwerte_Makro" m where m."Produkt_ID" = t.produkt_id and m.kcal_100g_ml is not null);
  insert into _erg(ok,txt) values (n <= (select count(*) from public.fl_muster_tagebuch where produkt_id = 'P1692'), 'Alle Produkte haben Score und Nährwerte (außer Wasser): ' || n);
  select count(distinct produkt_id) into n from public.fl_muster_tagebuch;
  insert into _erg(ok,txt) values (n >= 60, 'Abwechslung: ' || n || ' verschiedene Produkte');
  select min(c), max(c) into n, n2 from (select benutzer_id, count(distinct datum + public._fl_muster_versatz()) c from public.fl_muster_tagebuch
                                          where datum + public._fl_muster_versatz() between heute - 28 and heute - 1 group by 1) x;
  insert into _erg(ok,txt) values (n >= 20 and n2 <= 28, 'Je Person ' || n || '–' || n2 || ' erfasste Tage in den letzten 4 Wochen');
  insert into _erg(ok,txt) values ((select max("Datum") from public._fl_muster_eintraege('MUSTER-1')) < heute, 'Muster zeigt nichts ab heute');

  -- 2) Ohne Login (anon) -------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  j := public.cb_fl_muster(tok);
  insert into _erg(ok,txt) values (jsonb_array_length(j->'klienten') = 4 and j->>'praxis' = 'Praxis Muster', 'anon mit Token: Praxis Muster mit 4 Klienten');
  j := public.cb_fl_muster_dashboard(tok, 1, wv, wv + 6);
  insert into _erg(ok,txt) values ((j->>'muster')::boolean and (j->>'tage_erfasst')::int between 4 and 7 and jsonb_array_length(j->'tage') = 7,
                                   'anon Dashboard Woche: ' || (j->>'tage_erfasst') || ' Tage erfasst');
  insert into _erg(ok,txt) values ((j->'summe'->>'kcal')::numeric > 0 and (j->'summe'->>'score')::numeric between 1 and 100, 'Kalorien und Score werden gerechnet');
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'ist_soll') x where x->>'kennzahl' = 'gruppe:gemuese' and x->>'soll_herkunft' = 'Vorgabe Therapeutin'),
                                   'Muster-Vorgabe Gemüse greift (Anna)');
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'ist_soll') x where x->>'kennzahl' = 'gruppe:gemuese+obst' and x->>'soll_herkunft' = 'Richtwert DGE'),
                                   'DGE-Richtwert Obst und Gemüse dabei');
  execute 'reset role';   -- Vergleich mit den Tabellen als Admin-Rolle
  insert into _erg(ok,txt) values (not exists (select 1 from jsonb_array_elements(j->'produkte') x
                                                where x->>'produkt_id' not in (select produkt_id from public.fl_muster_tagebuch)),
                                   'Dashboard zeigt nur Produkte aus dem Mustertagebuch');
  select count(*) into n from jsonb_array_elements(j->'eintraege');
  insert into _erg(ok,txt) values (n = (select count(*) from public.fl_muster_tagebuch where benutzer_id = 'MUSTER-1'
                                         and datum + public._fl_muster_versatz() between wv and wv + 6), 'Einträge = Mustertagebuch (' || n || ')');
  execute 'set local role anon';
  insert into _erg(ok,txt) values (jsonb_array_length(j->'wochenplan') > 0 and jsonb_array_length(j->'rezepte') > 0, 'Rezepte und Wochenplan da');
  j := public.cb_fl_muster_dashboard(tok, 2, date_trunc('month', heute - 1)::date, heute - 1);
  insert into _erg(ok,txt) values ((j->>'tage_erfasst')::int >= 1 and exists (select 1 from jsonb_array_elements(j->'ist_soll') x where x->>'kennzahl' = 'kh' and x->>'soll_herkunft' = 'Vorgabe Therapeutin'),
                                   'Monat Bernd: KH-Vorgabe greift');
  begin perform public.cb_fl_muster('falsch-falsch-falsch'); insert into _erg(ok,txt) values (false,'anon mit falschem Token sieht Praxis!');
  exception when others then insert into _erg(ok,txt) values (true,'Falscher Token abgelehnt'); end;
  begin perform public.cb_fl_muster_dashboard(tok, 99, heute - 7, heute); insert into _erg(ok,txt) values (false,'Unbekannte Nr geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Nur Musterklienten über Nr'); end;
  begin perform public.cb_auswertung_eintraege('MUSTER-1', heute - 7, heute); insert into _erg(ok,txt) values (false,'anon ruft FL-2 direkt!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: FL-2-Auswertungen gesperrt'); end;
  begin perform public._fl4_dashboard('MUSTER-1', heute - 7, heute); insert into _erg(ok,txt) values (false,'anon ruft Kern direkt!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Dashboard-Kern gesperrt'); end;
  begin perform public.cb_fp_klient_dashboard('X', heute - 7, heute); insert into _erg(ok,txt) values (false,'anon ruft Klienten-Dashboard!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Klienten-Dashboard gesperrt'); end;
  begin perform count(*) from public.fl_muster_tagebuch; insert into _erg(ok,txt) values (false,'anon liest Mustertabelle direkt!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Mustertabellen gesperrt'); end;
  begin perform count(*) from public.fl_wunsch; insert into _erg(ok,txt) values (false,'anon liest Wunschliste!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Wunschliste gesperrt'); end;
  begin perform public.cb_fl_wuensche(); insert into _erg(ok,txt) values (false,'anon ruft Wunschliste!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Wunsch-Funktionen gesperrt'); end;
  execute 'reset role';

  -- 3) Testpersonen: 2 Fachpersonen, 1 Klientin, 1 normaler Nutzer --------------
  select count(*) into vor_benutzer from public."Benutzer";
  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl4-test-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl4-test-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl4-test-k1@example.invalid',now()),
    (x1,'authenticated','authenticated','fl4-test-x1@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin,"Gewicht_kg","Alter","Geschlecht") values
    ('U-fl4test-k1','Klientin Test','fl4-test-k1@example.invalid',k1,'free',false,false,70,40,'weiblich'),
    ('U-fl4test-x1','Fremder Test','fl4-test-x1@example.invalid',x1,'free',false,false,null,null,null);
  insert into public."Ernaehrungstagebuch"("Benutzer_ID","Datum","Mahlzeit","Produkt_ID","Menge_g") values
    ('U-fl4test-k1',heute,'Mittag','P274',200), ('U-fl4test-k1',heute,'Mittag','P190',150),
    ('U-fl4test-k1',heute-30,'Mittag','P1630',300);   -- vor der Einwilligung
  insert into public."Wochenplan"("Benutzer_ID","Datum","Slot","Typ","Rezept_ID") values
    ('U-fl4test-k1',heute,'Mittag','rezept','RU7c4e8d2e9b604f7dbd410660d9921d0d');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl4-test-t1@example.invalid','Test Therapeutin Eins','FLVIERA','Praxis A',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fl4-test-t2@example.invalid','Test Therapeutin Zwei','FLVIERB','Praxis B',true,'gruenderin_gratis');
  j := public.cb_admin_fl_muster_link(false);
  insert into _erg(ok,txt) values (j->>'link' like '%fachleute-muster.html?z=' || tok, 'Admin sieht Vorschau-Link');

  -- T1 und T2 bestätigen Vertrag, T1 legt Key an, K1 löst ein und willigt ein
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  vv := public.cb_fp_ich()->>'vertrag_version';
  execute 'set local role authenticated';
  perform public.cb_fp_vertrag_bestaetigen(vv);
  v_code := public.cb_fp_key_anlegen(30,'Frau Test',true)->>'code';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_gratis_code_einloesen(v_code);
  ev := (public.cb_meine_fachpersonen()->'liste'->0)->>'text_version';
  -- vor der Einwilligung: T1 sieht nichts
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform public.cb_fp_klient_dashboard(v_code, heute - 7, heute); insert into _erg(ok,txt) values (false,'T1 sieht ohne Einwilligung!');
  exception when others then insert into _erg(ok,txt) values (true,'Ohne Einwilligung kein Dashboard'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_fachperson_einwilligen(v_code, true, true, false, ev);

  -- 4) Echtes Dashboard ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_klient_dashboard(v_code, heute - 40, heute);
  insert into _erg(ok,txt) values (not (j->>'muster')::boolean and (j->>'tage_erfasst')::int = 1 and (j->'summe'->>'kcal')::numeric > 0,
                                   'T1 sieht Klientin, nur ab Einwilligung (1 Tag, ' || (j->'summe'->>'kcal') || ' kcal)');
  insert into _erg(ok,txt) values ((select (x->>'gramm')::numeric from jsonb_array_elements(j->'gruppen') x where x->>'gruppe' = 'gemuese') = 200,
                                   'Gemüse 200 g erkannt');
  insert into _erg(ok,txt) values (ev = 'fl4-2026-11-11' and jsonb_array_length(j->'wochenplan') = 1, 'Einwilligung mit Wochenplan: T1 sieht den Wochenplan');
  execute 'reset role';
  update public.fachperson_einwilligung set version = 'fl1-2026-11-11' where code = v_code;
  execute 'set local role authenticated';
  j2 := public.cb_fp_klient_dashboard(v_code, heute - 7, heute);
  insert into _erg(ok,txt) values (j2->'wochenplan' = 'null'::jsonb and j2->>'wochenplan_hinweis' is not null, 'Alte Einwilligung ohne Wochenplan: Wochenplan verborgen');
  insert into _erg(ok,txt) values (j->'profil'->>'name' = 'Klientin Test' and not (j->'profil' ? 'zyklus_start'), 'Profil ohne Zyklusdaten');
  j := public.cb_fp_vorgabe_setzen(v_code, 'kcal', 1700);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 setzt Kalorien-Vorgabe');
  j := public.cb_fp_vorgabe_setzen(v_code, 'gruppe:gemuese', 350, null, 'mehr Gemüse');
  j := public.cb_fp_klient_dashboard(v_code, heute - 7, heute);
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'ist_soll') x where x->>'kennzahl' = 'kcal' and x->>'soll_herkunft' = 'Vorgabe Therapeutin' and (x->>'soll')::numeric = 1700),
                                   'Vorgabe erscheint im Ist-Soll');
  j := public.cb_fp_vorgabe_setzen(v_code, 'kcal', null);
  execute 'reset role';
  insert into _erg(ok,txt) values (not exists (select 1 from public."Klient_Vorgabe" where "Benutzer_ID" = 'U-fl4test-k1' and kennzahl = 'kcal'), 'Vorgabe entfernen (am selben Tag gelöscht)');
  execute 'set local role authenticated';
  j := public.cb_fp_vorgabe_setzen(v_code, 'cholesterin', 100);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Unbekannte Kennzahl abgelehnt');
  -- T2 darf K1 nicht sehen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  begin perform public.cb_fp_klient_dashboard(v_code, heute - 7, heute); insert into _erg(ok,txt) values (false,'T2 sieht fremde Klientin!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 sieht fremde Klientin nicht'); end;
  begin perform public.cb_fp_vorgabe_setzen(v_code, 'kcal', 1500); insert into _erg(ok,txt) values (false,'T2 setzt fremde Vorgabe!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 setzt keine fremde Vorgabe'); end;
  begin perform public.cb_auswertung_eintraege('U-fl4test-k1', heute - 7, heute); insert into _erg(ok,txt) values (false,'T2 liest FL-2 fremd!');
  exception when others then insert into _erg(ok,txt) values (true,'T2: FL-2 fremd gesperrt'); end;
  -- Normaler Nutzer: keine echten Fremddaten, Muster ja
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',x1)::text, true);
  insert into _erg(ok,txt) values (echt_bid is not null, 'Echtes fremdes Tagebuch für den Test gefunden');
  begin perform public.cb_auswertung_eintraege(echt_bid, heute - 400, heute); insert into _erg(ok,txt) values (false,'Nutzer liest echtes fremdes Tagebuch!');
  exception when others then insert into _erg(ok,txt) values (true,'Nutzer: echtes fremdes Tagebuch gesperrt'); end;
  begin perform public.cb_auswertung_ist_soll(echt_bid, heute - 30, heute); insert into _erg(ok,txt) values (false,'Nutzer liest fremdes Ist-Soll!');
  exception when others then insert into _erg(ok,txt) values (true,'Nutzer: fremdes Ist-Soll gesperrt'); end;
  begin perform public.cb_fp_klient_dashboard(v_code, heute - 7, heute); insert into _erg(ok,txt) values (false,'Nutzer ruft Klienten-Dashboard!');
  exception when others then insert into _erg(ok,txt) values (true,'Nutzer: Klienten-Dashboard gesperrt'); end;
  select count(*) into n from public.cb_auswertung_eintraege('MUSTER-3', heute - 14, heute);
  insert into _erg(ok,txt) values (n > 0, 'Angemeldet: Musterdaten lesbar (' || n || ' Zeilen, nur erfunden)');
  select count(*) into n from public.cb_auswertung_eintraege('U-fl4test-x1', heute - 14, heute);
  insert into _erg(ok,txt) values (n = 0, 'Eigenes leeres Tagebuch: keine Musterzeilen eingemischt');

  -- 5) Wunschliste ---------------------------------------------------------------
  begin perform public.cb_fl_wuensche(); insert into _erg(ok,txt) values (false,'Nutzer sieht Wunschliste!');
  exception when others then insert into _erg(ok,txt) values (true,'Nutzer ohne Fachperson: keine Wunschliste'); end;
  begin perform public.cb_fl_wunsch_anlegen('Test','x','dashboard'); insert into _erg(ok,txt) values (false,'Nutzer legt Wunsch an!');
  exception when others then insert into _erg(ok,txt) values (true,'Nutzer legt keinen Wunsch an'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fl_wunsch_anlegen('Gemüse je Mahlzeit anzeigen', 'Im Dashboard sehen, zu welcher Mahlzeit das Gemüse gegessen wurde.', 'dashboard');
  w1 := (j->>'id')::bigint;
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 legt Wunsch an');
  j := public.cb_fl_wunsch_anlegen('x', null, 'dashboard');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Zu kurzer Titel abgelehnt');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fl_wunsch_aehnlich('Gemüse pro Mahlzeit');
  insert into _erg(ok,txt) values (jsonb_array_length(j) >= 1 and (j->0->>'id')::bigint = w1, 'T2 bekommt Hinweis auf ähnlichen Wunsch beim Tippen');
  j := public.cb_fl_wunsch_stimme(w1, true);
  insert into _erg(ok,txt) values ((j->>'stimmen')::int = 2, 'T2 stimmt „Ich auch“ (2 Stimmen)');
  j := public.cb_fl_wunsch_stimme(w1, true);
  insert into _erg(ok,txt) values ((j->>'stimmen')::int = 2, 'Doppelte Stimme zählt nicht');
  j := public.cb_fl_wunsch_bearbeiten(w1, 'Fremd geändert', null, 'sonstiges');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'T2 ändert fremden Wunsch nicht');
  j := public.cb_fl_wuensche();
  insert into _erg(ok,txt) values (jsonb_array_length(j->'liste') >= 1 and not (j->>'admin')::boolean
                                   and (select (x->>'ich_auch')::boolean from jsonb_array_elements(j->'liste') x where (x->>'id')::bigint = w1),
                                   'T2 sieht alle Wünsche mit eigener Stimme');
  begin perform public.cb_admin_fl_wunsch_setzen(w1, 'geplant'); insert into _erg(ok,txt) values (false,'T2 setzt Status!');
  exception when others then insert into _erg(ok,txt) values (true,'Fachperson setzt keinen Status'); end;
  -- Storage-Regeln (als angemeldete Fachperson)
  begin
    insert into storage.objects(bucket_id, name, owner_id, metadata) values ('fachleute-wunsch', w1 || '/skizze.png', t2::text, '{"mimetype":"image/png","size":1234}');
    insert into _erg(ok,txt) values (true, 'T2 lädt Anhang zu vorhandenem Wunsch hoch');
  exception when others then insert into _erg(ok,txt) values (false, 'Upload T2 scheitert: ' || sqlerrm); end;
  begin
    insert into storage.objects(bucket_id, name, owner_id) values ('fachleute-wunsch', '999999999/x.png', t2::text);
    insert into _erg(ok,txt) values (false, 'Upload zu nicht vorhandenem Wunsch geht!');
  exception when others then insert into _erg(ok,txt) values (true, 'Upload nur zu vorhandenem Wunsch'); end;
  j := public.cb_fl_wunsch_anhang_eintragen(w1, w1 || '/skizze.png', 'Skizze Dashboard.png');
  execute 'reset role';
  select id into v_anh from public.fl_wunsch_anhang where wunsch_id = w1;
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and exists (select 1 from public.fl_wunsch_anhang where wunsch_id = w1 and mime = 'image/png' and groesse = 1234),
                                   'Anhang eingetragen, Typ und Größe vom Server');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',x1)::text, true);
  select count(*) into n from storage.objects where bucket_id = 'fachleute-wunsch';
  insert into _erg(ok,txt) values (n = 0, 'Nutzer ohne Fachperson sieht keine Anhänge');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  select count(*) into n from storage.objects where bucket_id = 'fachleute-wunsch';
  insert into _erg(ok,txt) values (n = 1, 'T1 sieht den Anhang von T2');
  j := public.cb_fl_wunsch_anhang_loeschen(v_anh);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'T1 löscht fremden Anhang nicht');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  j := public.cb_admin_fl_wunsch_setzen(w1, 'abgelehnt', 'Danke!', null);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Ablehnen ohne Grund geht nicht');
  j := public.cb_admin_fl_wunsch_setzen(w1, 'geplant', 'Kommt mit dem nächsten Dashboard-Schritt.');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (select status = 'geplant' and antwort_am is not null from public.fl_wunsch where id = w1), 'Ralph setzt Status und antwortet');
  insert into _erg(ok,txt) values ((public.cb_fl_wuensche()->>'admin')::boolean, 'Ralph sieht Wunschliste als Admin');

  -- 6) Echte Zahlen unberührt ------------------------------------------------------
  insert into _erg(ok,txt) values ((select count(*) from public."Benutzer") = vor_benutzer + 2, 'Musterpraxis legt keine Benutzer an (nur die 2 Testpersonen)');

  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL4-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
