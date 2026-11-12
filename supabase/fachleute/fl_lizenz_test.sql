-- FL-Lizenz Test (12.11.2026): ohne Freigabe kein Key, mit Freigabe Key und eigener Preis, Preis sonst verborgen.
-- Läuft in EINER Transaktion und endet IMMER mit einem Fehler, damit alles zurückgerollt wird.
-- Ergebnis in der Fehlermeldung: "FL-LIZENZ-TEST: <n> OK, <m> FEHLER | ...".
-- Probelauf vor dem Einspielen: fl_lizenz_freigabe.sql + diese Datei zusammen ausführen. Danach: nur diese Datei.
do $test$
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); t3 uuid := gen_random_uuid(); t4 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  ritest uuid := (select auth_id from public.fachperson_konto where kuerzel = 'RITEST');
  ralph_keys int := (select count(*) from public.gratis_code where fachperson_auth = '2a00cb9e-1b48-4181-b90c-f34cd54a04a9');
  preis int := (select wert::int from public.fachleute_einstellung where schluessel = 'preis_cent');
  vv text; c text; c2 text; c4 text; j jsonb; n int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;

  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl-lizenz-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl-lizenz-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl-lizenz-k1@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin) values
    ('U-fllizenz-k1','Klientin Lizenz','fl-lizenz-k1@example.invalid',k1,'free',false,false);

  -- Admin: T1 ohne Freigabe (wie jede neue Registrierung), T2 mit Freigabe 4,99 € (wie Petra, Ralph 12.11.)
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl-lizenz-t1@example.invalid','Lizenz Eins','FLLIZA','Praxis Eins',true,'lizenz_bezahlt');
  perform public.cb_admin_fachperson_setzen('fl-lizenz-t2@example.invalid','Lizenz Zwei','FLLIZB','Praxis Zwei',true,'lizenz_bezahlt');
  j := public.cb_admin_fachperson_freigabe(' FL-Lizenz-T2@Example.invalid ', 499, true, 'wie Petra');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and j->'freigabe'->>'email'='fl-lizenz-t2@example.invalid' and j->>'fachperson'='FLLIZB',
                                   'Admin gibt T2 frei (E-Mail ohne Groß/Leerzeichen, Konto erkannt)');
  -- Freigabe schon VOR der Registrierung (Petra hat evtl. noch kein Konto)
  j := public.cb_admin_fachperson_freigabe('fl-lizenz-t3@example.invalid', 499, true, 'vorab');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and not (j->>'konto_da')::boolean, 'Freigabe vor der Registrierung möglich');
  insert into _erg(ok,txt) values (jsonb_array_length(public.cb_admin_fachperson_freigaben()) >= 4, 'Admin sieht Freigabe-Liste');
  insert into _erg(ok,txt) values (public._fp_keys_erlaubt(ralph), 'RALPH (Admin) darf Keys');
  insert into _erg(ok,txt) values (ritest is null or public._fp_keys_erlaubt(ritest), 'RITEST darf Keys');
  insert into _erg(ok,txt) values ((select count(*) from public.gratis_code where fachperson_auth = ralph) = ralph_keys, 'RALPH-Keys unverändert');

  execute 'set local role authenticated';
  -- T1: ohne Freigabe
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_ich(); vv := j->>'vertrag_version';
  insert into _erg(ok,txt) values (not (j->>'keys_erlaubt')::boolean and j->'key_preis_cent' = 'null'::jsonb and not (j->>'preis_anzeigen')::boolean
                                   and j->>'lizenz_kontakt' = 'kontakt@root-index.de', 'T1 cb_fp_ich: keine Freigabe, kein Preis, Kontakt da');
  perform public.cb_fp_vertrag_bestaetigen(vv);
  j := public.cb_fp_key_anlegen(30, 'Frau Ohne', true);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean and (j->>'lizenz_noetig')::boolean and j->>'grund' like '%kontakt@root-index.de%',
                                   'T1: Key anlegen scheitert mit Lizenz-Hinweis');
  execute 'reset role';
  insert into _erg(ok,txt) values ((select count(*) from public.gratis_code where fachperson_auth = t1) = 0, 'T1: kein Key in der Datenbank');
  insert into _erg(ok,txt) values ((select vereinbarung_bestaetigt_am from public.fachperson_konto where auth_id = t1) is null, 'T1: nichts nebenbei gespeichert');
  execute 'set local role authenticated';
  j := public.cb_fp_abrechnung(null);
  insert into _erg(ok,txt) values (j->'preis_cent' = 'null'::jsonb and (j->>'betrag_cent')::int = 0 and not (j->>'keys_erlaubt')::boolean, 'T1 Abrechnung: kein Preis, 0 €');
  j := public.cb_fp_inhalt('bewertung_fachleute');
  insert into _erg(ok,txt) values (j ? 'ok', 'T1 (registriert, Vereinbarung) liest „So bewertet Root Index“');
  j := public.cb_fl5_riki_limit();
  insert into _erg(ok,txt) values (not (j->>'erlaubt')::boolean and (j->>'lizenz_noetig')::boolean, 'T1: Riki-Rezeptideen gesperrt (Lizenz)');
  insert into _erg(ok,txt) values (not (public.cb_fp_ich()->>'lizenz_umschalter')::boolean, 'T1: kein Test-Umschalter');
  begin perform public.cb_fp_lizenz_testansicht(true); insert into _erg(ok,txt) values (false,'T1 nutzt Test-Umschalter!');
  exception when others then insert into _erg(ok,txt) values (true,'T1: Test-Umschalter gesperrt'); end;
  begin perform public._fp_keys_erlaubt(t1); insert into _erg(ok,txt) values (false,'_fp_keys_erlaubt direkt aufrufbar!');
  exception when others then insert into _erg(ok,txt) values (true,'_fp_keys_erlaubt nicht direkt aufrufbar'); end;
  begin perform 1 from public.fachperson_freigabe limit 1; insert into _erg(ok,txt) values (false,'authenticated liest Freigaben!');
  exception when others then insert into _erg(ok,txt) values (true,'fachperson_freigabe direkt gesperrt'); end;
  begin perform public.cb_admin_fachperson_freigabe('fl-lizenz-t1@example.invalid', 0); insert into _erg(ok,txt) values (false,'T1 gibt sich selbst frei!');
  exception when others then insert into _erg(ok,txt) values (true,'Freigabe nur durch Admin'); end;

  -- Preis-Schalter: preis_anzeigen = ja zeigt den allgemeinen Preis auch ohne Freigabe, Keys bleiben gesperrt
  execute 'reset role';
  update public.fachleute_einstellung set wert = 'ja' where schluessel = 'preis_anzeigen';
  execute 'set local role authenticated';
  j := public.cb_fp_ich();
  insert into _erg(ok,txt) values ((j->>'key_preis_cent')::int = preis
                                   and not (j->>'keys_erlaubt')::boolean, 'Schalter preis_anzeigen=ja: Preis sichtbar, Keys weiter gesperrt');
  insert into _erg(ok,txt) values (not (public.cb_fp_key_anlegen(30, 'x', true)->>'ok')::boolean, 'Schalter ändert nichts an der Key-Sperre');
  execute 'reset role';
  update public.fachleute_einstellung set wert = 'nein' where schluessel = 'preis_anzeigen';
  execute 'set local role authenticated';

  -- T2: mit Freigabe 4,99 €. Allgemeiner Preis hier kurz 9,99 €, damit sichtbar ist, dass der Freigabe-Preis gilt
  execute 'reset role';
  update public.fachleute_einstellung set wert = '999' where schluessel = 'preis_cent';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fp_ich();
  insert into _erg(ok,txt) values ((j->>'keys_erlaubt')::boolean and (j->>'key_preis_cent')::int = 499, 'T2 cb_fp_ich: Freigabe, Preis 4,99 (allgemein 9,99)');
  perform public.cb_fp_vertrag_bestaetigen(vv);
  j := public.cb_fp_key_anlegen(30, 'Frau Mit', true); c := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and c like 'FLLIZB-%', 'T2: Key angelegt (' || coalesce(c,'?') || ')');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  perform public.cb_gratis_code_einloesen(c);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fp_abrechnung(null);
  insert into _erg(ok,txt) values ((j->>'preis_cent')::int = 499 and (j->>'keys_aktiv')::int = 1 and (j->>'betrag_cent')::int = 499,
                                   'T2 Abrechnung: 1 Key × 4,99 = 4,99 (' || j::text || ')');
  execute 'reset role';
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2, null)) = 499, 'Stripe-Grundlage (_fp_abrechnung) für T2: 4,99');
  update public.fachleute_einstellung set wert = preis::text where schluessel = 'preis_cent';
  execute 'set local role authenticated';
  j := public.cb_fp_key_laufzeit(c, 1, 'monate');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T2 mit Freigabe verlängert');
  insert into _erg(ok,txt) values ((public.cb_fl5_riki_limit()->>'erlaubt')::boolean, 'T2: Riki-Rezeptideen erlaubt');
  c2 := public.cb_fp_key_anlegen(30, 'offen', true)->>'code';
  insert into _erg(ok,txt) values ((public.cb_fp_key_mail_vorbereiten(c2, 'fl-lizenz-k9@example.invalid')->>'ok')::boolean, 'T2: Key-Mail mit Freigabe');

  -- Freigabe entzogen: keine neuen Keys, kein Verlängern; Kürzen und Beenden gehen, Klient bleibt verbunden
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_freigabe('fl-lizenz-t2@example.invalid', 499, false, null);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  insert into _erg(ok,txt) values ((public.cb_fp_key_anlegen(30, 'noch einer', true)->>'lizenz_noetig')::boolean, 'Freigabe aus: kein neuer Key');
  insert into _erg(ok,txt) values ((public.cb_fp_key_laufzeit(c, 1, 'monate')->>'lizenz_noetig')::boolean, 'Freigabe aus: nicht verlängern');
  insert into _erg(ok,txt) values ((public.cb_fp_key_mail_vorbereiten(c2, 'fl-lizenz-k9@example.invalid')->>'lizenz_noetig')::boolean, 'Freigabe aus: keine Key-Mail');
  insert into _erg(ok,txt) values (not (public.cb_fl5_riki_limit()->>'erlaubt')::boolean, 'Freigabe aus: kein Riki');
  insert into _erg(ok,txt) values ((public.cb_fp_key_laufzeit(c, -3, 'tage')->>'ok')::boolean, 'Freigabe aus: kürzen geht');
  select count(*) into n from jsonb_array_elements(public.cb_fp_keys()) x where x->>'code' = c and x->>'status' = 'laeuft';
  insert into _erg(ok,txt) values (n = 1, 'Freigabe aus: bestehender Key läuft weiter');
  insert into _erg(ok,txt) values ((public.cb_fp_key_beenden(c)->>'ok')::boolean, 'Freigabe aus: beenden geht');

  -- T3 registriert sich nach der Freigabe
  execute 'reset role';
  insert into auth.users(id, aud, role, email, created_at) values (t3,'authenticated','authenticated','FL-Lizenz-T3@example.invalid',now());
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl-lizenz-t3@example.invalid','Lizenz Drei','FLLIZC',null,true,'lizenz_bezahlt');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t3)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  j := public.cb_fp_key_anlegen(14, 'Herr Drei', true);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T3 (Freigabe vor Registrierung) legt Key an');

  -- T4: Praxis mit Test-Umschalter (wie RALPH/RITEST) schaltet nur sich selbst
  execute 'reset role';
  insert into auth.users(id, aud, role, email, created_at) values (t4,'authenticated','authenticated','fl-lizenz-t4@example.invalid',now());
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl-lizenz-t4@example.invalid','Lizenz Vier','FLLIZD',null,true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_freigabe('fl-lizenz-t4@example.invalid', null, true, 'Test');
  perform public.cb_admin_fachperson_freigabe('fl-lizenz-t2@example.invalid', 499, true, null);
  update public.fachleute_einstellung set wert = wert || ',FLLIZD' where schluessel = 'lizenz_umschalter_kuerzel';
  insert into _erg(ok,txt) values (public._fp_umschalter_darf(ralph) and (ritest is null or public._fp_umschalter_darf(ritest)), 'RALPH und RITEST haben den Umschalter');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t4)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  j := public.cb_fp_ich();
  insert into _erg(ok,txt) values ((j->>'lizenz_umschalter')::boolean and (j->>'keys_erlaubt')::boolean and not (j->>'lizenz_testansicht_ohne')::boolean, 'T4: Umschalter da, mit Lizenz');
  j := public.cb_fp_lizenz_testansicht(true);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and not (j->>'keys_erlaubt')::boolean and j->'key_preis_cent' = 'null'::jsonb, 'T4 „ohne Lizenz“: wie Fachleute ohne Freigabe');
  insert into _erg(ok,txt) values ((public.cb_fp_key_anlegen(30, 'x', true)->>'lizenz_noetig')::boolean, 'T4 „ohne Lizenz“: Key-Sperre greift');
  insert into _erg(ok,txt) values (not (public.cb_fl5_riki_limit()->>'erlaubt')::boolean, 'T4 „ohne Lizenz“: Riki gesperrt');
  insert into _erg(ok,txt) values ((public.cb_fp_inhalt('bewertung_fachleute') ? 'ok'), 'T4 „ohne Lizenz“: „So bewertet“ bleibt lesbar');
  execute 'reset role';
  insert into _erg(ok,txt) values (public._fp_keys_erlaubt(t2) and not (select lizenz_testansicht_ohne from public.fachperson_konto where auth_id = t2), 'T2 unberührt vom Umschalter');
  execute 'set local role authenticated';
  j := public.cb_fp_lizenz_testansicht(false);
  c4 := public.cb_fp_key_anlegen(30, 'y', true)->>'code';
  insert into _erg(ok,txt) values ((j->>'keys_erlaubt')::boolean and c4 like 'FLLIZD-%', 'T4 zurück „mit Lizenz“: Key geht wieder');

  -- Musterpraxis und anon: kein Weg zum vertraulichen Text
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin perform public.cb_fp_inhalt('bewertung_fachleute'); insert into _erg(ok,txt) values (false,'anon liest Bewertung!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: „So bewertet“ gesperrt'); end;
  begin perform public.cb_admin_fachperson_freigaben(); insert into _erg(ok,txt) values (false,'anon liest Freigaben!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Freigaben gesperrt'); end;
  begin perform public.cb_fp_lizenz_testansicht(false); insert into _erg(ok,txt) values (false,'anon schaltet Lizenz!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: kein Umschalter'); end;
  begin perform public.cb_fp_key_anlegen(30, 'x', true); insert into _erg(ok,txt) values (false,'anon legt Key an!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: kein Key'); end;
  execute 'reset role';
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname <> 'cb_fp_inhalt' and pg_get_functiondef(p.oid) ilike '%fl_inhalt%'
     and (p.proname like '%muster%' or pg_get_function_identity_arguments(p.oid) like '%p_token%');
  insert into _erg(ok,txt) values (n = 0, 'Keine Muster-Funktion liest fl_inhalt');

  select count(*) filter (where e.ok), count(*) filter (where not e.ok or e.ok is null),
         string_agg(case when e.ok then 'OK ' else 'FEHLER ' end || e.txt, ' | ' order by e.nr)
    into ok, bad, log from _erg e;
  raise exception 'FL-LIZENZ-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
