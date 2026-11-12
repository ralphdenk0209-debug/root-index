-- FL-5 Zugriffstest: Rezepte teilen, gemeinsam bearbeiten, Ernährungspläne, Ist gegen Plan.
-- Läuft in EINER Transaktion und endet IMMER mit einem Fehler, damit alles zurückgerollt
-- wird. Ergebnis in der Fehlermeldung: "FL5-TEST: <n> OK, <m> FEHLER | ...".
-- Probelauf vor dem Einspielen: fl5_plaene_rezepte.sql + diese Datei zusammen ausführen.
-- Nach dem Einspielen: nur diese Datei.
do $test$
#variable_conflict use_column
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid(); x1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  heute date := (now() at time zone 'Europe/Berlin')::date;
  oeff text := 'RUed8d26e55b1e41fbb75092be7ce443ac';    -- öffentliches Root-Index-Rezept (Linsen-Bowl)
  tok text; vv text; ev text; c1 text; c2 text; r1 text; r2 text; kop text; pl bigint; pl2 bigint;
  j jsonb; n int; n2 int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;
  select wert into tok from public.fachleute_einstellung where schluessel = 'muster_token';

  -- 1) Testpersonen: T1 mit K1, T2 mit K2, X1 ohne Fachperson ---------------------
  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl5-test-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl5-test-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl5-test-k1@example.invalid',now()),
    (k2,'authenticated','authenticated','fl5-test-k2@example.invalid',now()),
    (x1,'authenticated','authenticated','fl5-test-x1@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin) values
    ('U-fl5test-t1','Therapeutin Eins','fl5-test-t1@example.invalid',t1,'free',false,false),
    ('U-fl5test-t2','Therapeutin Zwei','fl5-test-t2@example.invalid',t2,'free',false,false),
    ('U-fl5test-k1','Klientin Eins','fl5-test-k1@example.invalid',k1,'free',false,false),
    ('U-fl5test-k2','Klient Zwei','fl5-test-k2@example.invalid',k2,'free',false,false),
    ('U-fl5test-x1','Fremder','fl5-test-x1@example.invalid',x1,'free',false,false);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl5-test-t1@example.invalid','Therapeutin Eins','FLFUNFA','Praxis Eins',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fl5-test-t2@example.invalid','Therapeutin Zwei','FLFUNFB','Praxis Zwei',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_freigabe('fl5-test-t1@example.invalid', null, true, 'Test');   -- FL-Lizenz: Keys nur mit Freigabe
  perform public.cb_admin_fachperson_freigabe('fl5-test-t2@example.invalid', null, true, 'Test');   -- FL-Lizenz: Keys nur mit Freigabe

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  vv := public.cb_fp_ich()->>'vertrag_version';
  perform public.cb_fp_vertrag_bestaetigen(vv);
  c1 := public.cb_fp_key_anlegen(30,'K1',true)->>'code';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  c2 := public.cb_fp_key_anlegen(30,'K2',true)->>'code';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_gratis_code_einloesen(c1);
  ev := (public.cb_meine_fachpersonen()->'liste'->0)->>'text_version';
  -- vor der Einwilligung: noch kein Teilen möglich
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform public.cb_fp_rezept_teilen(oeff, c1, false, null); insert into _erg(ok,txt) values (false,'Teilen ohne Einwilligung geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Ohne Einwilligung kein Teilen'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_fachperson_einwilligen(c1, true, true, true, ev);      -- ältere Einträge freigegeben (für Ist gegen Plan)
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  perform public.cb_gratis_code_einloesen(c2);
  perform public.cb_fachperson_einwilligen(c2, true, true, false, ev);

  -- 2) Rezepte anlegen: Fachperson mit Stufe „free“ darf (Premium über Konto) ------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  r1 := public.cb_rezept_anlegen('{"name":"FL5 Test Brokkoli-Feta","portionen":2,"zutaten":[{"name":"Broccoli","produkt_id":"P274","menge_g":300},{"name":"Feta","produkt_id":"P55894","menge_g":100}]}'::jsonb);
  insert into _erg(ok,txt) values (r1 like 'RU%', 'T1 (Stufe free, Fachperson) legt Rezept an');
  insert into _erg(ok,txt) values (exists (select 1 from public.cb_rezepte_list() x where x.id = r1 and x.is_own and x.sichtbarkeit = 'privat'), 'Neues Rezept ist privat');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  r2 := public.cb_rezept_anlegen('{"name":"FL5 Test Rezept T2","portionen":1,"zutaten":[{"name":"Apfel","produkt_id":"P190","menge_g":150}]}'::jsonb);

  -- 3) Vor dem Teilen sieht niemand das private Rezept ---------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  insert into _erg(ok,txt) values (not exists (select 1 from public.cb_rezepte_list() x where x.id = r1), 'K1 sieht privates Rezept vor dem Teilen nicht');
  insert into _erg(ok,txt) values (public.cb_rezept_skaliert(r1)->>'ok' = 'false', 'K1 öffnet privates Rezept vor dem Teilen nicht');

  -- 4) Teilen: T1 → K1 zum Mitbearbeiten --------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_rezept_teilen(r1, c1, true, 'passt bei Laktose? Nein – Feta tauschen');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 teilt eigenes Rezept mit K1 (mitbearbeiten)');
  j := public.cb_fp_rezept_teilen(oeff, c1, true, null);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Mitbearbeiten bei fremdem (Root-Index-)Rezept abgelehnt');
  j := public.cb_fp_rezept_teilen(oeff, c1, false, 'Empfehlung');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'Öffentliches Rezept als Empfehlung teilen');
  j := public.cb_fp_rezept_teilen(r2, c1, false, null);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'T1 teilt fremdes privates Rezept (von T2) nicht');
  begin perform public.cb_fp_rezept_teilen(r1, c2, false, null); insert into _erg(ok,txt) values (false,'T1 teilt mit fremdem Klienten!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 teilt nicht mit Klient von T2'); end;
  j := public.cb_fp_rezepte(c1);
  insert into _erg(ok,txt) values (jsonb_array_length(j->'geteilt') = 2, 'T1 sieht 2 Freigaben für K1');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  begin perform public.cb_fp_rezepte(c1); insert into _erg(ok,txt) values (false,'T2 sieht Freigaben von K1!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 sieht Freigaben fremder Klienten nicht'); end;
  begin perform public.cb_fp_rezept_teilen(r2, c1, false, null); insert into _erg(ok,txt) values (false,'T2 teilt mit K1!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 teilt nicht mit Klientin von T1'); end;
  j := public.cb_fp_rezept_teilen_beenden(r1, c1);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'T2 beendet fremde Freigabe nicht');

  -- 5) K1 sieht und bearbeitet, andere nicht ----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  insert into _erg(ok,txt) values (exists (select 1 from public.cb_rezepte_list() x where x.id = r1 and not x.is_own and x.quelle = 'Fachperson · Praxis Eins'),
                                   'K1 sieht geteiltes Rezept, Quelle „Fachperson · Praxis Eins“');
  insert into _erg(ok,txt) values (public.cb_rezept_skaliert(r1)->>'ok' = 'true', 'K1 öffnet geteiltes Rezept');
  j := public.cb_fl5_mein_bereich();
  insert into _erg(ok,txt) values (j->'fachperson'->>'praxis' = 'Praxis Eins' and jsonb_array_length(j->'rezepte') = 2
                                   and (select (x->>'mitbearbeiten')::boolean from jsonb_array_elements(j->'rezepte') x where x->>'rezept_id' = r1),
                                   'K1: Bereich zeigt 2 geteilte Rezepte, eines zum Mitbearbeiten');
  perform public.cb_rezept_anlegen(jsonb_build_object('rezept_id', r1, 'name', 'FL5 Test Brokkoli-Tofu', 'portionen', 2,
    'zutaten', '[{"name":"Broccoli","produkt_id":"P274","menge_g":300},{"name":"Apfel","produkt_id":"P190","menge_g":100}]'::jsonb));
  execute 'reset role';
  insert into _erg(ok,txt) values ((select "Rezeptname" = 'FL5 Test Brokkoli-Tofu' and "Benutzer_ID" = 'U-fl5test-t1' and "Sichtbarkeit" = 'privat'
                                      from public."Rezepte" where "Rezept_ID" = r1), 'K1 bearbeitet gemeinsames Rezept; gehört weiter T1, bleibt privat');
  execute 'set local role authenticated';
  begin perform public.cb_rezept_publish(r1, true); insert into _erg(ok,txt) values (false,'K1 veröffentlicht fremdes Rezept!');
  exception when others then insert into _erg(ok,txt) values (true,'Veröffentlichen nur durch Eigentümerin'); end;
  begin perform public.cb_rezept_delete(r1); insert into _erg(ok,txt) values (false,'K1 löscht fremdes Rezept!');
  exception when others then insert into _erg(ok,txt) values (true,'Löschen nur durch Eigentümerin'); end;
  begin perform public.cb_rezept_anlegen(jsonb_build_object('rezept_id', oeff, 'name', 'gekapert')); insert into _erg(ok,txt) values (false,'K1 bearbeitet Empfehlung!');
  exception when others then insert into _erg(ok,txt) values (true,'Empfehlung ohne Mitbearbeiten: kein Bearbeiten'); end;
  kop := public.cb_fl5_rezept_kopieren(r1)->>'rezept_id';
  insert into _erg(ok,txt) values (exists (select 1 from public.cb_rezepte_list() x where x.id = kop and x.is_own and x.sichtbarkeit = 'privat'),
                                   'K1 legt eigene private Kopie an');
  foreach vv in array array[k2::text, x1::text, t2::text] loop
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',vv)::text, true);
    insert into _erg(ok,txt) values (not exists (select 1 from public.cb_rezepte_list() x where x.id in (r1, kop)), 'Andere (' || left(vv,4) || ') sehen geteiltes Rezept und Kopie nicht');
    insert into _erg(ok,txt) values (public.cb_rezept_skaliert(r1)->>'ok' = 'false', 'Andere öffnen geteiltes Rezept nicht');
    begin perform public.cb_rezept_anlegen(jsonb_build_object('rezept_id', r1, 'name', 'gekapert')); insert into _erg(ok,txt) values (false,'Fremde bearbeiten geteiltes Rezept!');
    exception when others then insert into _erg(ok,txt) values (true,'Fremde bearbeiten geteiltes Rezept nicht'); end;
    begin perform public.cb_fl5_rezept_kopieren(r1); insert into _erg(ok,txt) values ((public.cb_fl5_rezept_kopieren(r1)->>'ok')::boolean is not true, 'Fremde kopieren geteiltes Rezept nicht');
    exception when others then insert into _erg(ok,txt) values (true,'Fremde kopieren geteiltes Rezept nicht'); end;
    j := public.cb_fl5_mein_bereich();
    insert into _erg(ok,txt) values (vv = k2::text or (jsonb_array_length(j->'rezepte') = 0 and jsonb_array_length(j->'plaene') = 0), 'Ohne Bindung zu T1: leerer Bereich');
  end loop;

  -- 6) Ernährungsplan ---------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_plan_speichern(c1, jsonb_build_object('titel','FL5 Testwoche','notiz','mehr Gemüse','von',heute-2,'bis',heute+4,
         'eintraege', jsonb_build_array(
            jsonb_build_object('datum',heute-2,'slot','Mittag','typ','rezept','rezept_id',r1,'portionen',1),
            jsonb_build_object('datum',heute-1,'slot','Mittag','typ','rezept','rezept_id',r1,'portionen',1),
            jsonb_build_object('datum',heute+1,'slot','Mittag','typ','rezept','rezept_id',r1,'portionen',2),
            jsonb_build_object('datum',heute+1,'slot','Snack','typ','produkt','produkt_id','P190','menge_g',150),
            jsonb_build_object('datum',heute+2,'slot','Abendessen','typ','frei','titel','Salat nach Wahl'))));
  pl := (j->>'id')::bigint;
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and pl is not null, 'T1 legt Plan für K1 an');
  begin
    perform public.cb_fp_plan_speichern(c1, jsonb_build_object('titel','x','von',heute,'bis',heute,
         'eintraege', jsonb_build_array(jsonb_build_object('datum',heute,'slot','Mittag','typ','rezept','rezept_id',r2))));
    insert into _erg(ok,txt) values (false, 'Plan mit fremdem privatem Rezept geht!');
  exception when others then insert into _erg(ok,txt) values (true, 'Plan nur mit Rezepten, die T1 sehen darf'); end;
  j := public.cb_fp_plan_speichern(c1, jsonb_build_object('titel','zu lang','von',heute,'bis',heute+60,'eintraege','[]'::jsonb));
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Plan über 6 Wochen abgelehnt');
  -- Entwurf: K1 sieht ihn noch nicht
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  insert into _erg(ok,txt) values (jsonb_array_length(public.cb_fl5_mein_bereich()->'plaene') = 0, 'Entwurf ist für K1 unsichtbar');
  begin perform public.cb_fl5_plan_uebernehmen(pl, false); insert into _erg(ok,txt) values (false,'K1 übernimmt Entwurf!');
  exception when others then insert into _erg(ok,txt) values (true,'Entwurf kann nicht übernommen werden'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fp_plan_teilen(pl, true);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'T2 teilt fremden Plan nicht');
  begin perform public.cb_fp_plaene(c1); insert into _erg(ok,txt) values (false,'T2 sieht Pläne von K1!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 sieht Pläne fremder Klienten nicht'); end;
  j := public.cb_fp_plan_loeschen(pl);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'T2 löscht fremden Plan nicht');
  begin perform public.cb_fp_plan_speichern(c1, jsonb_build_object('id',pl,'titel','fremd','von',heute,'bis',heute,'eintraege','[]'::jsonb));
        insert into _erg(ok,txt) values (false,'T2 ändert fremden Plan!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 ändert fremden Plan nicht'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_plan_teilen(pl, true);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 teilt Plan mit K1');

  -- 7) K1: Plan sehen, übernehmen, Einkaufsliste ------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_fl5_mein_bereich();
  insert into _erg(ok,txt) values (jsonb_array_length(j->'plaene') = 1 and jsonb_array_length(j->'plaene'->0->'eintraege') = 5 and j->'plaene'->0->'ist' = 'null'::jsonb,
                                   'K1 sieht geteilten Plan mit 5 Einträgen (ohne Tagebuch-Abgleich)');
  j := public.cb_fl5_plan_uebernehmen(pl, true);
  execute 'reset role';
  select count(*) into n from public."Wochenplan" where "Benutzer_ID" = 'U-fl5test-k1';
  select count(*) into n2 from public."Einkaufsliste" where "Benutzer_ID" = 'U-fl5test-k1';
  insert into _erg(ok,txt) values ((j->>'anzahl')::int = 3 and n = 3, 'Übernehmen: nur heute und später (3 Mahlzeiten im Wochenplan)');
  insert into _erg(ok,txt) values (n2 >= 2, 'Plan auf der Einkaufsliste (' || n2 || ' Zeilen)');
  insert into _erg(ok,txt) values (exists (select 1 from public."Wochenplan" where "Benutzer_ID" = 'U-fl5test-k1' and "Titel" like '%(2 Portionen)'), 'Portionen stehen im Wochenplan');
  execute 'set local role authenticated';
  j := public.cb_fl5_plan_uebernehmen(pl, false);
  execute 'reset role';
  insert into _erg(ok,txt) values ((select count(*) from public."Wochenplan" where "Benutzer_ID" = 'U-fl5test-k1') = 3, 'Erneut übernehmen ersetzt, keine Doppelten');
  -- Tagebuch für Ist gegen Plan: vorgestern nichts, gestern das Planrezept
  insert into public."Ernaehrungstagebuch"("Benutzer_ID","Datum","Mahlzeit","Produkt_ID","Menge_g","Rezept_ID") values
    ('U-fl5test-k1',heute-1,'Mittag','P274',150,r1), ('U-fl5test-k1',heute-1,'Snack','P195',100,null);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  begin perform public.cb_fl5_plan_uebernehmen(pl, false); insert into _erg(ok,txt) values (false,'K2 übernimmt fremden Plan!');
  exception when others then insert into _erg(ok,txt) values (true,'K2 übernimmt fremden Plan nicht'); end;
  insert into _erg(ok,txt) values (jsonb_array_length(public.cb_fl5_mein_bereich()->'plaene') = 0, 'K2 sieht Plan von K1 nicht');

  -- 8) Ist gegen Plan (Fachperson) ----------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_plaene(c1)->'plaene'->0;
  insert into _erg(ok,txt) values ((j->'ist'->>'wie_geplant')::int = 1 and (j->'ist'->>'nichts_eingetragen')::int = 1 and (j->'ist'->>'eintraege_vorbei')::int = 2,
                                   'Ist gegen Plan: gestern wie geplant, vorgestern nichts eingetragen');
  insert into _erg(ok,txt) values (j->>'uebernommen_am' is not null and jsonb_array_length(j->'tage') = 7, 'T1 sieht: übernommen, 7 Tage');
  insert into _erg(ok,txt) values ((select (x->>'kcal_ist')::numeric > 0 from jsonb_array_elements(j->'tage') x where (x->>'datum')::date = heute-1), 'Kalorien Ist aus dem Tagebuch (FL-2)');

  -- 9) Widerruf (K2) und Ende der Bindung (K1) ---------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_rezept_teilen(r2, c2, true, null);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  insert into _erg(ok,txt) values (exists (select 1 from public.cb_rezepte_list() x where x.id = r2), 'K2 sieht Rezept von T2');
  perform public.cb_fachperson_widerrufen(c2);
  insert into _erg(ok,txt) values (not exists (select 1 from public.cb_rezepte_list() x where x.id = r2), 'Nach Widerruf: K2 sieht das Rezept nicht mehr');
  begin perform public.cb_rezept_anlegen(jsonb_build_object('rezept_id', r2, 'name', 'nach Widerruf')); insert into _erg(ok,txt) values (false,'K2 bearbeitet nach Widerruf!');
  exception when others then insert into _erg(ok,txt) values (true,'Nach Widerruf kein Bearbeiten'); end;

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  perform public.cb_fp_key_beenden(c1);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  insert into _erg(ok,txt) values (not exists (select 1 from public.cb_rezepte_list() x where x.id in (r1, oeff) and x.quelle like 'Fachperson%'), 'Bindung beendet: geteiltes Rezept weg');
  insert into _erg(ok,txt) values (public.cb_rezept_skaliert(r1)->>'ok' = 'false', 'Bindung beendet: Rezept nicht mehr zu öffnen');
  j := public.cb_fl5_mein_bereich();
  insert into _erg(ok,txt) values (j->'fachperson' = 'null'::jsonb and jsonb_array_length(j->'plaene') = 0, 'Bindung beendet: kein Plan mehr');
  begin perform public.cb_fl5_plan_uebernehmen(pl, false); insert into _erg(ok,txt) values (false,'Übernehmen nach Ende!');
  exception when others then insert into _erg(ok,txt) values (true,'Bindung beendet: Übernehmen gesperrt'); end;
  begin perform public.cb_rezept_anlegen(jsonb_build_object('rezept_id', r1, 'name', 'nach Ende')); insert into _erg(ok,txt) values (false,'Bearbeiten nach Ende!');
  exception when others then insert into _erg(ok,txt) values (true,'Bindung beendet: Bearbeiten gesperrt'); end;
  insert into _erg(ok,txt) values (exists (select 1 from public.cb_rezepte_list() x where x.id = kop and x.is_own), 'Eigene Kopie bleibt bei K1');
  execute 'reset role';
  insert into _erg(ok,txt) values ((select count(*) from public."Wochenplan" where "Benutzer_ID" = 'U-fl5test-k1') = 3, 'Übernommener Wochenplan bleibt bei K1');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform public.cb_fp_plaene(c1); insert into _erg(ok,txt) values (false,'T1 sieht nach Ende noch Pläne!');
  exception when others then insert into _erg(ok,txt) values (true,'Bindung beendet: T1 sieht keine Pläne/Ist mehr'); end;

  -- 10) Direktzugriff auf Tabellen und interne Funktionen ------------------------------
  foreach vv in array array['fl5_rezept_freigabe','fl5_plan','fl5_plan_eintrag','fl5_plan_uebernahme'] loop
    begin execute format('select count(*) from public.%I', vv) into n; insert into _erg(ok,txt) values (false, 'authenticated liest ' || vv || '!');
    exception when others then insert into _erg(ok,txt) values (true, 'authenticated: ' || vv || ' gesperrt'); end;
  end loop;
  begin perform public._fl5_plan_json(pl, 'U-fl5test-k1', true); insert into _erg(ok,txt) values (false,'Plan-Kern direkt aufrufbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Plan-Kern nicht direkt aufrufbar'); end;
  begin perform public._fl5_bindung_ok(c1); insert into _erg(ok,txt) values (false,'Bindungsprüfung direkt aufrufbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Bindungsprüfung nicht direkt aufrufbar'); end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  foreach vv in array array['select public.cb_fl5_mein_bereich()', 'select public.cb_fp_plaene(''X'')', 'select public.cb_fl5_plan_uebernehmen(1, false)',
                            'select public.cb_fp_rezept_teilen(''x'',''X'',false,null)', 'select public.cb_fl5_rezept_kopieren(''x'')',
                            'select count(*) from public.fl5_plan'] loop
    begin execute vv; insert into _erg(ok,txt) values (false, 'anon: ' || vv || ' geht!');
    exception when others then insert into _erg(ok,txt) values (true, 'anon gesperrt: ' || left(vv, 40)); end;
  end loop;

  -- 11) Musterpraxis -------------------------------------------------------------------
  j := public.cb_fl5_muster_plaene(tok, 1);
  insert into _erg(ok,txt) values (jsonb_array_length(j->'plaene') = 1 and (j->'plaene'->0->'ist'->>'eintraege_vorbei')::int > 0,
                                   'Muster Anna: Plan mit Ist gegen Plan (' || coalesce(j->'plaene'->0->'ist'->>'wie_geplant','?') || ' von '
                                   || coalesce(j->'plaene'->0->'ist'->>'eintraege_vorbei','?') || ' wie geplant)');
  j := public.cb_fl5_muster_plaene(tok, 2);
  insert into _erg(ok,txt) values (jsonb_array_length(j->'plaene') = 1, 'Muster Bernd: Plan da');
  begin perform public.cb_fl5_muster_plaene('falsch-falsch-falsch', 1); insert into _erg(ok,txt) values (false,'Muster-Plan mit falschem Token!');
  exception when others then insert into _erg(ok,txt) values (true,'Muster-Plan: falscher Token abgelehnt'); end;
  execute 'reset role';
  insert into _erg(ok,txt) values (not exists (select 1 from public.fl5_plan where muster_benutzer is not null and code is not null), 'Musterpläne hängen an keinem echten Key');

  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL5-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
