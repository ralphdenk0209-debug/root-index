-- FL-4 Akte-Test: gemeinsam bearbeiten, Protokoll, Rechte, Snack-Zeiten.
-- Läuft in EINER Transaktion und endet IMMER mit einem Fehler (alles wird zurückgerollt).
-- Probelauf: fl4_akte.sql + fl4_muster_wochenplan_voll.sql + diese Datei zusammen. Danach: nur diese Datei.
do $test$
#variable_conflict use_column
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  heute date := (now() at time zone 'Europe/Berlin')::date;
  tok text; vv text; ev text; v_code text; j jsonb; n int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;
  select wert into tok from public.fachleute_einstellung where schluessel = 'muster_token';

  -- 1) Musterpraxis: Snack-Zeiten und Akte -----------------------------------------
  insert into _erg(ok,txt) values (not exists (select 1 from public.fl_muster_wochenplan where slot not in ('Frühstück','Mittag','Abendessen','Snack')),
                                   'Muster-Wochenplan nur mit den 4 alten Slots');
  select count(*) into n from public.fl_muster_wochenplan where slot = 'Snack' and snack_zeit is not null;
  insert into _erg(ok,txt) values (n > 150, 'Snacks mit Tageszeit: ' || n);
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  j := public.cb_fl_muster_dashboard(tok, 3, heute - 6, heute);
  select count(*) into n from jsonb_array_elements(j->'wochenplan') x where x->>'datum' = heute::text;
  insert into _erg(ok,txt) values (n between 4 and 6, 'Muster Clara heute: ' || n || ' geplante Mahlzeiten');
  insert into _erg(ok,txt) values (exists (select 1 from jsonb_array_elements(j->'wochenplan') x where x->>'snack_zeit' = 'vormittags' and (x->>'kcal_portion')::numeric > 0),
                                   'Snack vormittags mit kcal');
  insert into _erg(ok,txt) values ((j->'akte'->>'nur_ansehen')::boolean and j->'akte'->>'ziel_text' is not null, 'Muster-Akte mit Ziel, nur ansehen');
  begin perform public.cb_fp_akte_setzen('MUSTER-C5P4', '{"gewicht_kg":80}'); insert into _erg(ok,txt) values (false,'anon schreibt Akte!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Akte schreiben gesperrt'); end;
  begin perform count(*) from public.fl_akte; insert into _erg(ok,txt) values (false,'anon liest fl_akte!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: fl_akte gesperrt'); end;
  execute 'reset role';

  -- 2) Testpersonen ------------------------------------------------------------------
  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl4-akte-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl4-akte-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl4-akte-k1@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin,"Gewicht_kg","Groesse_cm","Geschlecht","Diabetes_Typ") values
    ('U-fl4akte-k1','Klientin Akte','fl4-akte-k1@example.invalid',k1,'free',false,false,70,168,'weiblich',null);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl4-akte-t1@example.invalid','Akte Eins','FLAKTEA','Praxis A',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fl4-akte-t2@example.invalid','Akte Zwei','FLAKTEB','Praxis B',true,'gruenderin_gratis');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  vv := public.cb_fp_ich()->>'vertrag_version';
  execute 'set local role authenticated';
  perform public.cb_fp_vertrag_bestaetigen(vv);
  v_code := public.cb_fp_key_anlegen(30,'Frau Akte',true)->>'code';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_gratis_code_einloesen(v_code);
  ev := (public.cb_meine_fachpersonen()->'liste'->0)->>'text_version';
  insert into _erg(ok,txt) values (ev = 'fl4-2026-11-12', 'Neue Einwilligungsfassung wird angeboten: ' || coalesce(ev,'–'));
  perform public.cb_fachperson_einwilligen(v_code, true, true, false, ev);
  -- wie eine ältere Zustimmung (nur lesen) behandeln
  execute 'reset role';
  update public.fachperson_einwilligung set version = 'fl4-2026-11-11' where code = v_code;
  execute 'set local role authenticated';

  -- 3) Nur lesen: kein Schreiben --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_klient_dashboard(v_code, heute - 7, heute);
  insert into _erg(ok,txt) values (not (j->'akte'->>'darf_bearbeiten')::boolean and j->'akte'->'felder' = 'null'::jsonb
                                   and j->'akte'->>'bearbeiten_hinweis' is not null, 'Ohne Bearbeiten-Einwilligung: Akte nur lesen, Hinweis');
  begin perform public.cb_fp_akte_setzen(v_code, '{"gewicht_kg":68}'); insert into _erg(ok,txt) values (false,'Schreiben ohne Einwilligung geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Schreiben ohne Bearbeiten-Einwilligung abgelehnt'); end;

  -- 4) Mit Einwilligung: gemeinsam bearbeiten --------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_fachperson_einwilligen(v_code, true, true, false, 'fl4-2026-11-12');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K1 stimmt der Fassung mit Bearbeiten zu');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_akte_setzen(v_code, jsonb_build_object('gewicht_kg', '68,5', 'diabetes_typ', 'typ2', 'groesse_cm', 168,
         'unvertraeglichkeiten', jsonb_build_array('laktose','gluten'), 'ziel_text', '5 kg leichter bis Juni', 'sport_text', '2× Schwimmen',
         'geburtsdatum', '1986-04-02', 'aktivitaet', 'Leicht aktiv', 'ernaehrungsform', 'Vegetarisch'));
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (j->>'geaendert')::int = 8, 'T1 ändert 8 Felder (Größe gleich → nicht protokolliert): ' || (j->>'geaendert'));
  execute 'reset role';
  insert into _erg(ok,txt) values ((select "Gewicht_kg" = 68.5 and "Diabetes_Typ" = 'typ2' and "Unvertraeglichkeiten" = array['gluten','laktose']
                                           and "Ernaehrungsform" = 'Vegetarisch' and "Alter" = extract(year from age(current_date, date '1986-04-02'))::int
                                      from public."Benutzer" where "Benutzer_ID" = 'U-fl4akte-k1'), 'Profil der Person geändert (gilt auch in der App), Alter aus Geburtsdatum');
  select count(*) into n from public.fl_akte_protokoll where benutzer_id = 'U-fl4akte-k1' and fachperson_auth = t1;
  insert into _erg(ok,txt) values (n = 8, 'Protokoll: ' || n || ' Einträge mit alt/neu');
  insert into _erg(ok,txt) values ((select alt = '70'::jsonb and neu = '68.5'::jsonb from public.fl_akte_protokoll where benutzer_id = 'U-fl4akte-k1' and feld = 'gewicht_kg'),
                                   'Protokoll Gewicht 70 → 68.5');
  execute 'set local role authenticated';
  j := public.cb_fp_klient_dashboard(v_code, heute - 7, heute);
  insert into _erg(ok,txt) values ((j->'akte'->>'darf_bearbeiten')::boolean and j->'akte'->>'ziel_text' = '5 kg leichter bis Juni'
                                   and jsonb_array_length(j->'akte'->'protokoll') = 8 and (j->'akte'->'felder'->>'gewicht_kg')::numeric = 68.5,
                                   'Dashboard zeigt Akte, Felder und Protokoll');
  j := public.cb_fp_akte_setzen(v_code, '{"diabetes_typ":""}');
  insert into _erg(ok,txt) values ((j->>'geaendert')::int = 1 and (j->'felder' is null or true), 'Angabe löschen (leer = keine Angabe)');
  begin perform public.cb_fp_akte_setzen(v_code, '{"diabetes_typ":"typ3"}'); insert into _erg(ok,txt) values (false,'Ungültiger Diabetes-Typ geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Ungültiger Wert abgelehnt'); end;
  begin perform public.cb_fp_akte_setzen(v_code, '{"Zyklus_Start":"2026-11-01"}'); insert into _erg(ok,txt) values (false,'Zyklus schreibbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Nicht erlaubtes Feld (Zyklus) abgelehnt'); end;
  begin perform public.cb_fp_akte_setzen(v_code, '{"is_premium":true}'); insert into _erg(ok,txt) values (false,'Premium schreibbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Konto-/Abo-Felder nicht schreibbar'); end;
  begin perform public.cb_fp_akte_setzen(v_code, '{"gewicht_kg":5}'); insert into _erg(ok,txt) values (false,'Gewicht 5 kg geht!');
  exception when others then insert into _erg(ok,txt) values (true,'Unplausibles Gewicht abgelehnt'); end;

  -- 5) Fremde Fachkraft, direkter Tabellenzugriff ------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  begin perform public.cb_fp_akte_setzen(v_code, '{"gewicht_kg":90}'); insert into _erg(ok,txt) values (false,'T2 schreibt fremde Akte!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 schreibt keine fremde Akte'); end;
  begin perform count(*) from public.fl_akte_protokoll; insert into _erg(ok,txt) values (false,'Protokoll direkt lesbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Protokoll nicht direkt lesbar'); end;
  begin perform public._fl_akte_json('U-fl4akte-k1', t1, true); insert into _erg(ok,txt) values (false,'Hilfsfunktion von außen aufrufbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Hilfsfunktionen gesperrt'); end;

  -- 6) Widerruf: kein Schreiben mehr --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_fachperson_widerrufen(v_code);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform public.cb_fp_akte_setzen(v_code, '{"gewicht_kg":67}'); insert into _erg(ok,txt) values (false,'Nach Widerruf schreibbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Nach Widerruf kein Schreiben'); end;
  execute 'reset role';

  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL4-AKTE-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
