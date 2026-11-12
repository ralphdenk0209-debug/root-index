-- FL-5b Test: Snack in Plänen, Plan-Vorschlag, Akte-Stichworte. Endet IMMER mit Fehler (= zurückgerollt).
-- Probelauf: fl5b_snacks_vorschlag.sql + diese Datei zusammen; danach nur diese Datei.
-- FL-5e (12.11.2026, „ein Snack“): 5 Prüfungen erwarten jetzt den einen Snack ohne Tageszeit.
--   Gilt erst mit fl5e_ein_snack.sql (Probelauf: fl5e_ein_snack.sql + diese Datei zusammen).
do $test$
#variable_conflict use_column
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  heute date := (now() at time zone 'Europe/Berlin')::date;
  mo date := date_trunc('week', (now() at time zone 'Europe/Berlin')::date)::date + 7;
  tok text; vv text; ev text; c1 text; pl bigint; j jsonb; e jsonb; n int; n2 int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;
  -- Muster-Zugang seit FL-4 Passwort (12.11.): eigene Test-Sitzung, wird mit dem Test zurückgerollt
  tok := 'fltest-' || md5(random()::text) || md5(random()::text);
  insert into public.fl_muster_sitzung(token_hash, gueltig_bis) values (encode(extensions.digest(tok, 'sha256'), 'hex'), now() + interval '15 minutes');

  -- 1) Musterpraxis: Vorschlag (anon mit Token) --------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, '{"plaetze":["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen","Snack:abends"]}'::jsonb);
  select count(*) into n from jsonb_array_elements(j->'eintraege');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and n >= 21, 'Anna Woche: ' || n || ' Vorschläge');
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'slot'='Snack')
                                   and not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'slot'='Snack' group by x->>'datum' having count(*) > 1)
                                   and not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'snack_zeit' is not null), 'Alte Snack-Plätze ergeben einen Snack je Tag, ohne Tageszeit');
  insert into _erg(ok,txt) values (not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'slot' not in ('Frühstück','Mittag','Abendessen','Snack')), 'Nur die vier Slots (alte Apps)');
  insert into _erg(ok,txt) values ((j->>'ziel_kcal')::numeric = 1800, 'Kalorienziel aus Vorgabe (Anna 1800)');
  insert into _erg(ok,txt) values (not exists (
      select 1 from jsonb_array_elements(j->'eintraege') a join jsonb_array_elements(j->'eintraege') b
        on a->>'datum' = b->>'datum' and a->>'slot'='Mittag' and b->>'slot'='Abendessen' and a->>'rezept_id' = b->>'rezept_id'), 'Mittag und Abendessen am selben Tag verschieden');
  select count(distinct x->>'rezept_id') into n from jsonb_array_elements(j->'eintraege') x where x->>'slot'='Mittag';
  insert into _erg(ok,txt) values (n >= 2, 'Abwechslung mittags: ' || n || ' verschiedene Rezepte');
  -- Dora (laktoseintolerant): kein Rezept/Produkt mit Laktose
  j := public.cb_fl5_muster_plan_vorschlag(tok, 4, mo, mo + 6, '{}'::jsonb);
  execute 'reset role';
  select count(*) into n from jsonb_array_elements(j->'eintraege') x
    join public.cb_rezept_allergene(array[x->>'rezept_id']) a on true
   where x->>'typ'='rezept' and a.laktose <> 'laktosefrei';
  select count(*) into n2 from jsonb_array_elements(j->'eintraege') x
    left join public."Produkt_Allergene" pa on pa."Produkt_ID" = x->>'produkt_id'
   where x->>'typ'='produkt' and coalesce(pa.laktose,'unklar') <> 'laktosefrei';
  insert into _erg(ok,txt) values (n = 0 and n2 = 0 and j->'beachtet' @> '["ohne laktose"]'::jsonb, 'Dora: nichts mit Laktose (' || jsonb_array_length(j->'eintraege') || ' Vorschläge)');
  execute 'set local role anon';
  -- nur ein Platz / belegt
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, jsonb_build_object('nur', jsonb_build_array(jsonb_build_object('datum', mo + 2, 'slot','Mittag'))));
  insert into _erg(ok,txt) values (jsonb_array_length(j->'eintraege') = 1 and (j->'eintraege'->0->>'datum')::date = mo + 2, 'Tauschen: genau ein Platz');
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo, jsonb_build_object('belegt', jsonb_build_array(jsonb_build_object('datum', mo, 'slot','Mittag'))));
  insert into _erg(ok,txt) values (not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'slot'='Mittag'), 'Belegte Plätze bleiben frei');
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, '{"seed":5}'::jsonb);
  e := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, '{"seed":6}'::jsonb);
  insert into _erg(ok,txt) values (j->'eintraege' <> e->'eintraege', 'Neu würfeln ändert den Vorschlag');
  begin perform public.cb_fl5_muster_plan_vorschlag('falsch-falsch-falsch', 1, mo, mo + 6, '{}'); insert into _erg(ok,txt) values (false,'Falscher Token geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Falscher Token abgelehnt'); end;
  begin perform public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 60, '{}'); insert into _erg(ok,txt) values (false,'Über 6 Wochen geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Über 6 Wochen abgelehnt'); end;
  begin perform public.cb_fp_plan_vorschlag('X', mo, mo + 6, '{}'); insert into _erg(ok,txt) values (false,'anon ruft Fachperson-Vorschlag!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Fachperson-Vorschlag gesperrt'); end;
  begin perform public._fl5_vorschlag('MUSTER-1', null, mo, mo + 6, '{}'); insert into _erg(ok,txt) values (false,'Kern direkt aufrufbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Vorschlags-Kern nicht direkt aufrufbar'); end;
  j := public.cb_fl5_muster_plaene(tok, 1);
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'plaene'->0->'eintraege') x where x->>'slot'='Snack')
                                   and not exists (select 1 from jsonb_array_elements(j->'plaene'->0->'eintraege') x where x->>'snack_zeit' is not null), 'Musterplan Anna: Snacks im einen Snack, ohne Tageszeit');
  execute 'reset role';

  -- 2) Echte Fachperson und Klientin ---------------------------------------------------
  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl5b-test-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl5b-test-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl5b-test-k1@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin,"Unvertraeglichkeiten","Kalorienziel_kcal") values
    ('U-fl5btest-t1','Therapeutin Eins','fl5b-test-t1@example.invalid',t1,'free',false,false,'{}',null),
    ('U-fl5btest-t2','Therapeutin Zwei','fl5b-test-t2@example.invalid',t2,'free',false,false,'{}',null),
    ('U-fl5btest-k1','Klientin','fl5b-test-k1@example.invalid',k1,'free',false,false,'{milch}',2000);
  insert into public."Ernaehrungstagebuch"("Benutzer_ID","Datum","Mahlzeit","Produkt_ID","Menge_g") values
    ('U-fl5btest-k1',heute-3,'Snack','P190',150), ('U-fl5btest-k1',heute-2,'Snack','P190',160), ('U-fl5btest-k1',heute-1,'Mittag','P274',200);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl5b-test-t1@example.invalid','Therapeutin Eins','FLFUENFBA','Praxis Eins',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fl5b-test-t2@example.invalid','Therapeutin Zwei','FLFUENFBB','Praxis Zwei',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_freigabe('fl5b-test-t1@example.invalid', null, true, 'Test');   -- FL-Lizenz: Keys nur mit Freigabe
  perform public.cb_admin_fachperson_freigabe('fl5b-test-t2@example.invalid', null, true, 'Test');   -- FL-Lizenz: Keys nur mit Freigabe
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  vv := public.cb_fp_ich()->>'vertrag_version';
  perform public.cb_fp_vertrag_bestaetigen(vv);
  c1 := public.cb_fp_key_anlegen(30,'K1',true)->>'code';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_gratis_code_einloesen(c1);
  ev := (public.cb_meine_fachpersonen()->'liste'->0)->>'text_version';
  perform public.cb_fachperson_einwilligen(c1, true, true, true, ev);

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_plan_vorschlag(c1, mo, mo + 6, '{"plaetze":["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen"]}'::jsonb);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and jsonb_array_length(j->'eintraege') > 0, 'T1: Vorschlag für Klientin (' || jsonb_array_length(j->'eintraege') || ')');
  insert into _erg(ok,txt) values ((j->>'ziel_kcal')::numeric = 2000, 'Kalorienziel aus dem Profil (2000)');
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'produkt_id'='P190' and x->>'slot'='Snack' and (x->>'menge_g')::numeric = 155),
                                   'Lieblingsprodukt Apfel als Snack, Menge wie gewohnt (155 g)');
  execute 'reset role';
  select count(*) into n from jsonb_array_elements(j->'eintraege') x join public.cb_rezept_allergene(array[x->>'rezept_id']) a on true
   where x->>'typ'='rezept' and ('milch' = any(a.enthaelt) or a.unvollstaendig);
  insert into _erg(ok,txt) values (n = 0, 'Ohne Milch: kein Rezept mit Milch oder unklaren Angaben');

  -- Akte-Stichworte (FL-4, _fl_akte_stichworte) wirken im Vorschlag – nur die eigene Akte, Verneinung zählt nicht
  insert into public.fl_akte(fachperson_auth, benutzer_id, stichworte) values (t1, 'U-fl5btest-k1', array['Zöliakie','kein Diabetes','Bluthochdruck']);
  insert into public.fl_akte(fachperson_auth, benutzer_id, stichworte) values (t2, 'U-fl5btest-k1', array['Diabetes Typ 1']);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_plan_vorschlag(c1, mo, mo + 6, '{}'::jsonb);
  execute 'reset role';
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements_text(j->'beachtet') x where x in ('aus der Akte: Zöliakie', 'Akte: Zöliakie'))
                                   and exists (select 1 from jsonb_array_elements_text(j->'beachtet') x where x like 'ohne %gluten%'), 'Akte: Zöliakie → ohne Gluten');
  insert into _erg(ok,txt) values (not exists (select 1 from jsonb_array_elements_text(j->'beachtet') x where x like 'Diabetes:%'),
                                   'Akte: „kein Diabetes“ und fremde Akte (T2) wirken nicht');
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements_text(j->'hinweise') x where x like '%kein Diabetes%' and x like '%Bluthochdruck%'),
                                   'Akte: übrige Stichworte stehen als Hinweis');
  select count(*) into n from jsonb_array_elements(j->'eintraege') x join public.cb_rezept_allergene(array[x->>'rezept_id']) a on true
   where x->>'typ'='rezept' and ('gluten' = any(a.enthaelt) or 'gluten' = any(a.spuren));
  insert into _erg(ok,txt) values (n = 0, 'Akte Zöliakie: kein Rezept mit Gluten (auch Spuren)');
  j := public._fl5_vorschlag('MUSTER-2', null, mo, mo + 6, '{}'::jsonb);
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements_text(j->'beachtet') x where x in ('aus der Akte: Diabetes Typ 2', 'Akte: Diabetes Typ 2')), 'Muster Bernd: Stichwort Diabetes Typ 2 aus der Akte');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  begin perform public.cb_fp_plan_vorschlag(c1, mo, mo + 6, '{}'); insert into _erg(ok,txt) values (false,'T2 bekommt Vorschlag für fremde Klientin!');
  exception when others then insert into _erg(ok,txt) values (true,'T2: kein Vorschlag für fremde Klientin'); end;

  -- 3) Speichern mit Snack-Zeit, Übernahme ---------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_plan_speichern(c1, jsonb_build_object('titel','Snacktest','von',heute,'bis',heute+3,'eintraege', jsonb_build_array(
         jsonb_build_object('datum',heute+1,'slot','Snack','snack_zeit','vormittags','typ','produkt','produkt_id','P190','menge_g',150),
         jsonb_build_object('datum',heute+1,'slot','Snack','snack_zeit','abends','typ','produkt','produkt_id','P195','menge_g',100),
         jsonb_build_object('datum',heute+1,'slot','Mittag','typ','frei','titel','Salat'))));
  pl := (j->>'id')::bigint;
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'Plan mit zwei Snack-Zeiten gespeichert');
  begin perform public.cb_fp_plan_speichern(c1, jsonb_build_object('titel','x','von',heute,'bis',heute,'eintraege', jsonb_build_array(
         jsonb_build_object('datum',heute,'slot','Snack','snack_zeit','mitternacht','typ','frei','titel','x'))));
  exception when others then insert into _erg(ok,txt) values (false,'Alte Seite mit Snack-Zeit kann nicht speichern: ' || sqlerrm); end;
  select x into j from jsonb_array_elements(public.cb_fp_plaene(c1)->'plaene') x where (x->>'id')::bigint = pl;
  insert into _erg(ok,txt) values ((j->'eintraege'->0->>'slot') = 'Mittag' and (j->'eintraege'->1->>'produkt_id') = 'P190' and (j->'eintraege'->2->>'produkt_id') = 'P195'
                                   and not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'snack_zeit' is not null), 'Reihenfolge: Mittag, dann beide Snacks im einen Snack');
  insert into _erg(ok,txt) values (j ? 'ziel_kcal' and (j->>'ziel_kcal')::numeric = 2000, 'Plan zeigt Kalorienziel');
  perform public.cb_fp_plan_teilen(pl, true);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_fl5_plan_uebernehmen(pl, false);
  execute 'reset role';
  insert into _erg(ok,txt) values (not exists (select 1 from public.fl5_plan_eintrag e join public.fl5_plan p on p.id = e.plan_id where p.code = c1 and e.snack_zeit is not null)
                                   and (select count(*) from public.fl5_plan p where p.code = c1) = 2,
                                   'Snack-Zeit wird nicht mehr gespeichert (auch keine unbekannte)');
  insert into _erg(ok,txt) values (exists (select 1 from public."Wochenplan" where "Benutzer_ID"='U-fl5btest-k1' and "Slot"='Snack') and not exists (select 1 from public."Wochenplan" where "Benutzer_ID"='U-fl5btest-k1' and "Titel" like '% · %')
                                   and not exists (select 1 from public."Wochenplan" where "Benutzer_ID"='U-fl5btest-k1' and "Slot" not in ('Frühstück','Mittag','Abendessen','Snack')),
                                   'Übernahme: Slot Snack, keine Tageszeit im Titel');
  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL5B-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
