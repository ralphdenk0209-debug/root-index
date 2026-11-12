-- FL-1 Zugriffstest: zwei Fachpersonen (T1, T2), zwei Klienten (K1, K2).
-- Laeuft in EINER Transaktion und endet IMMER mit einem Fehler, damit
-- alles zurueckgerollt wird. Das Ergebnis steht in der Fehlermeldung:
-- "FL1-TEST: <n> OK, <m> FEHLER | ...".
do $test$
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid();
  k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  heute date := (now() at time zone 'Europe/Berlin')::date;
  ver text; vv text; ac text; a text; b text; c text; d text; j jsonb; n int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;

  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl1-test-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl1-test-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl1-test-k1@example.invalid',now()),
    (k2,'authenticated','authenticated','fl1-test-k2@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin,subscription_status) values
    ('U-fl1test-k1','Klientin Eins','fl1-test-k1@example.invalid',k1,'free',false,false,null),
    ('U-fl1test-k2','Klient Zwei','fl1-test-k2@example.invalid',k2,'free',false,false,'active');   -- K2 hat eigenes Abo
  -- Tagebuch: K1 heute 80 kcal und vor 10 Tagen 500 kcal; K2 heute 250 kcal
  insert into public."Ernaehrungstagebuch"("Benutzer_ID","Datum","Mahlzeit","Freitext_Name","Menge_g","Man_kcal") values
    ('U-fl1test-k1',heute,'Frühstück','Test-Apfel',150,80),
    ('U-fl1test-k1',heute-10,'Frühstück','Test-Kuchen',100,500),
    ('U-fl1test-k2',heute,'Frühstück','Test-Brot',100,250);

  -- Admin (Ralph) schaltet T1, T2 frei
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  j := public.cb_admin_fachperson_setzen('fl1-test-t1@example.invalid','Test Therapeutin Eins','TESTA','Praxis A');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Freischalten ohne Lizenzart abgelehnt');
  j := public.cb_admin_fachperson_setzen('fl1-test-t1@example.invalid','Test Therapeutin Eins','TESTA','Praxis A',true,'gruenderin_gratis');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and j->'fachperson'->>'lizenz_art'='gruenderin_gratis', 'Admin schaltet T1 als Gruenderin frei');
  j := public.cb_admin_fachperson_setzen('fl1-test-t2@example.invalid','Test Therapeutin Zwei','TESTB',null,true,'lizenz_bezahlt',now()+interval '30 days',null,'monat');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'Admin schaltet T2 mit bezahlter Lizenz frei');
  perform public.cb_admin_fachperson_freigabe('fl1-test-t1@example.invalid', null, true, 'Test');   -- FL-Lizenz: Keys nur mit Freigabe
  perform public.cb_admin_fachperson_freigabe('fl1-test-t2@example.invalid', null, true, 'Test');   -- FL-Lizenz: Keys nur mit Freigabe
  j := public.cb_admin_angebot_codes_hochladen(array['TESTCODE1','TESTCODE2',' testcode2 ','']);
  insert into _erg(ok,txt) values ((j->>'neu')::int=2, 'Admin laedt 2 Angebotscodes hoch (Doppelte/Leere ignoriert)');

  -- K1 darf NICHT Admin-Funktion nutzen und ist keine Fachperson
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  begin perform public.cb_admin_fachperson_setzen('fl1-test-k1@example.invalid','x','XX'); insert into _erg(ok,txt) values (false,'K1 nutzt Admin-Funktion!');
  exception when others then insert into _erg(ok,txt) values (true,'K1 kein Admin'); end;
  begin perform public.cb_fp_keys(); insert into _erg(ok,txt) values (false,'K1 sieht Key-Liste!');
  exception when others then insert into _erg(ok,txt) values (true,'K1 keine Fachperson'); end;
  insert into _erg(ok,txt) values (not public.cb_ist_premium(k1), 'K1 vor Einloesung kein Premium');

  -- T1: Vertrag noch nicht bestaetigt -> nichts geht
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  insert into _erg(ok,txt) values (public.cb_ist_premium(t1), 'T1 hat Premium (lebenslang)');
  j := public.cb_fp_ich(); vv := j->>'vertrag_version';
  insert into _erg(ok,txt) values (not (j->>'vertrag_ok')::boolean and j->>'vertrag_text' is not null, 'T1 sieht Vertrag zum Bestaetigen');
  begin perform public.cb_fp_key_anlegen(30,'x',true); insert into _erg(ok,txt) values (false,'T1 legt Key ohne Vertrag an!');
  exception when others then insert into _erg(ok,txt) values (true,'Ohne Vertrag kein Key: '||sqlerrm); end;
  j := public.cb_fp_vertrag_bestaetigen('falsche-version'); insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Falsche Vertragsversion abgelehnt');
  j := public.cb_fp_vertrag_bestaetigen(vv); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 bestaetigt Vertrag');
  insert into _erg(ok,txt) values (exists(select 1 from public.fachperson_vertrag_bestaetigung where auth_id=t1 and version=vv and am is not null), 'Vertrag mit Version und Zeitstempel gespeichert');
  -- erster Key ohne Verschwiegenheits-Haken -> abgelehnt, dann mit
  j := public.cb_fp_key_anlegen(30,'Frau Eins',false);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean and (j->>'vereinbarung_noetig')::boolean, 'T1 erster Key ohne Klienten-Vereinbarung abgelehnt');
  j := public.cb_fp_key_anlegen(30,'Frau Eins',true); a := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and a like 'TESTA-%', 'T1 legt Key A an');
  insert into _erg(ok,txt) values ((select vereinbarung_bestaetigt_am is not null from public.fachperson_konto where auth_id=t1), 'Klienten-Vereinbarung mit Zeitstempel gespeichert');
  j := public.cb_fp_key_anlegen(14,'Herr Zwei bei T1'); c := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 legt Key C an (spaeter fuer Uebertrag K2)');
  -- Einlöse-Link per E-Mail: Pruefung, Sperre
  j := public.cb_fp_key_mail_vorbereiten(a, 'kein-mail');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Mail: ungueltige Adresse abgelehnt');
  j := public.cb_fp_key_mail_vorbereiten(a, 'Klientin@Example.invalid');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and j->>'an'='klientin@example.invalid' and j->>'link' like '%klientin.html?code='||a, 'Mail: T1 bereitet Versand fuer A vor');
  perform public.cb_fp_key_mail_vorbereiten(a, 'klientin@example.invalid');
  perform public.cb_fp_key_mail_vorbereiten(a, 'klientin@example.invalid');
  j := public.cb_fp_key_mail_vorbereiten(a, 'klientin@example.invalid');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Mail: 4. Mail je Key und Tag gesperrt');

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen(vv);
  j := public.cb_fp_key_anlegen(60,'Herr Zwei',true); b := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and b like 'TESTB-%', 'T2 legt Key B an');
  j := public.cb_fp_key_anlegen(30,'zweiter Key fuer K2',false); d := j->>'code';
  j := public.cb_fp_keys();
  insert into _erg(ok,txt) values (jsonb_array_length(j)=2 and not exists(select 1 from jsonb_array_elements(j) x where x->>'code' in (a,c)), 'T2 sieht nur eigene Keys');
  begin perform public.cb_fp_key_laufzeit(a, 1, 'monate'); insert into _erg(ok,txt) values (false,'T2 verlaengert fremden Key A!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kann A nicht verlaengern'); end;
  begin perform public.cb_fp_key_beenden(a); insert into _erg(ok,txt) values (false,'T2 beendet fremden Key A!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kann A nicht beenden'); end;
  begin perform public.cb_fp_key_bezeichnung(a,'x'); insert into _erg(ok,txt) values (false,'T2 benennt A um!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kann A nicht umbenennen'); end;
  begin perform public.cb_fp_key_mail_vorbereiten(a,'x@example.invalid'); insert into _erg(ok,txt) values (false,'T2 verschickt Mail fuer fremden Key A!');
  exception when others then insert into _erg(ok,txt) values (true,'Mail: T2 kann fuer A nichts verschicken'); end;

  -- Einloesen: K1 -> A, K2 -> B
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_gratis_code_einloesen(a);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (j->>'einwilligung_offen')::boolean and not (j->>'eigenes_abo')::boolean, 'K1 loest A ein');
  insert into _erg(ok,txt) values (not exists(select 1 from public.fp_key_mail_log where code=a and an_email is not null)
                               and (select count(*) from public.fp_key_mail_log where code=a)=3, 'Mail: E-Mail nach Einloesen geloescht, Protokoll bleibt');
  insert into _erg(ok,txt) values (public.cb_ist_premium(k1), 'K1 hat Premium ueber Key');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_gratis_code_einloesen(a);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'K2 kann A nicht nochmal einloesen');
  j := public.cb_gratis_code_einloesen(b);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (j->>'eigenes_abo')::boolean, 'K2 loest B ein, Hinweis eigenes Abo');
  j := public.cb_gratis_code_einloesen(d);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'K2 kein zweiter Key derselben Fachperson');
  j := public.cb_gratis_code_einloesen(c);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean and (j->>'wechsel_noetig')::boolean, 'K2 Key von T1: erst Wechsel bestaetigen');

  -- Ohne Einwilligung: T1 sieht K1 nicht, auch keinen Namen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T1 sieht K1 ohne Einwilligung!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 ohne Einwilligung kein Zugriff'); end;
  j := public.cb_fp_keys();
  insert into _erg(ok,txt) values (not exists(select 1 from jsonb_array_elements(j) x where x->>'klient_name' is not null), 'T1 sieht ohne Einwilligung keine Namen');

  -- K1: nur "besprochen" bestaetigen, ohne Einwilligung -> T1 sieht weiter nichts
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_meine_fachpersonen(); ver := j->'liste'->0->>'text_version';
  insert into _erg(ok,txt) values (jsonb_array_length(j->'liste')=1 and position('Test Therapeutin Eins' in j->'liste'->0->>'text')>0, 'K1 sieht Einwilligungstext mit Namen T1');
  j := public.cb_fachperson_einwilligen(a, false, true, false, ver);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Ohne Besprochen-Bestaetigung abgelehnt');
  j := public.cb_fachperson_einwilligen(a, true, false, false, ver);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (select besprochen_am is not null and einwilligung_am is null from public.fachperson_einwilligung where code=a), 'K1 bestaetigt nur Besprochen (Zeitstempel)');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T1 sieht K1 nur mit Besprochen!');
  exception when others then insert into _erg(ok,txt) values (true,'Besprochen allein gibt keinen Zugriff'); end;
  -- K1 willigt ein (ohne aeltere); fuer fremden Key B nicht moeglich
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_fachperson_einwilligen(a, true, true, false, ver); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K1 willigt fuer A ein');
  j := public.cb_fachperson_einwilligen(b, true, true, false, ver); insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'K1 kann nicht fuer fremden Key B einwilligen');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_fachperson_einwilligen(b, true, true, false, ver); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 willigt fuer B ein');

  -- Gegenseitig pruefen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(a);
  insert into _erg(ok,txt) values (n=1 and exists(select 1 from public.cb_fp_klient_tagessummen(a) s where s.kcal=80), 'T1 sieht K1 nur ab Einwilligung (heute 80 kcal, nicht vor 10 Tagen)');
  select count(*) into n from public.cb_fp_klient_tagessummen(a, heute-30, null);
  insert into _erg(ok,txt) values (n=1, 'T1 kommt auch mit fruehem Startdatum nicht an aeltere Eintraege');
  begin perform * from public.cb_fp_klient_tagessummen(b); insert into _erg(ok,txt) values (false,'T1 sieht K2 ueber fremden Key B!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 kein Zugriff ueber Key B (gehoert T2)'); end;
  j := public.cb_fp_keys();
  insert into _erg(ok,txt) values (exists(select 1 from jsonb_array_elements(j) x where x->>'klient_name'='Klientin Eins'), 'T1 sieht Namen K1 nach Einwilligung');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(b) s where s.kcal = 250;
  insert into _erg(ok,txt) values (n=1, 'T2 sieht K2 ueber B');
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T2 sieht K1!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kein Zugriff auf K1'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'K1 nutzt Fachperson-Zugriff!');
  exception when others then insert into _erg(ok,txt) values (true,'K1 kein Fachperson-Zugriff'); end;

  -- K1 gibt aeltere Eintraege frei -> T1 sieht auch den Eintrag vor 10 Tagen
  j := public.cb_fachperson_einwilligen(a, true, true, true, ver);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(a, heute-30, null);
  insert into _erg(ok,txt) values (n=2, 'Mit Freigabe aeltere Eintraege: T1 sieht 2 Tage');

  -- Uebertrag: K2 wechselt von T2 (B) zu T1 (C)
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_gratis_code_einloesen(c, true);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and j->>'gewechselt_von'='Test Therapeutin Zwei', 'K2 wechselt zu T1 (Key C)');
  insert into _erg(ok,txt) values ((select beendet_grund='wechsel' and beendet_am is not null from public.gratis_code where code=b), 'Alter Key B endet mit Grund Wechsel');
  insert into _erg(ok,txt) values ((select count(*) from public.gratis_code g where g.klient_auth=k2 and g.beendet_am is null and g.laeuft_bis>now())=1, 'K2 hat genau eine laufende Fachperson');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(b); insert into _erg(ok,txt) values (false,'T2 sieht K2 nach Wechsel!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 nach Wechsel kein Zugriff'); end;
  j := public.cb_fp_key_laufzeit(b, 1, 'monate');
  insert into _erg(ok,txt) values (not coalesce((j->>'ok')::boolean,false), 'T2 kann beendeten Key B nicht wiederbeleben');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(c); insert into _erg(ok,txt) values (false,'T1 sieht K2 vor Einwilligung!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 sieht K2 erst nach neuer Einwilligung'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_fachperson_einwilligen(c, true, true, false, ver);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(c);
  insert into _erg(ok,txt) values (n=1, 'T1 sieht K2 nach Einwilligung');

  -- Widerruf: K2 widerruft C -> T1 sieht K2 nicht mehr
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_fachperson_widerrufen(c); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 widerruft C');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(c); insert into _erg(ok,txt) values (false,'T1 sieht K2 nach Widerruf!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 nach Widerruf kein Zugriff'); end;
  insert into _erg(ok,txt) values ((select count(*) from public.fachperson_einwilligung_log where klient_auth in (k1,k2))>=7, 'Alle Bestaetigungen im Protokoll mit Zeitstempel');

  -- Laufzeit: T1 verlaengert A um 1 Monat, kuerzt um 2 Wochen, dann auf jetzt
  j := public.cb_fp_key_laufzeit(a, 1, 'monate'); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 verlaengert A um 1 Monat');
  j := public.cb_fp_key_laufzeit(a, -2, 'wochen'); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 kuerzt A um 2 Wochen');
  insert into _erg(ok,txt) values (public.cb_ist_premium(k1), 'K1 noch Premium nach Kuerzen um 2 Wochen');
  j := public.cb_fp_key_laufzeit(a, -3, 'monate'); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 kuerzt A auf jetzt');
  insert into _erg(ok,txt) values (not public.cb_ist_premium(k1), 'K1 nach Ablauf kein Premium mehr');
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T1 sieht K1 nach Ablauf!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 nach Ablauf kein Zugriff'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_klient_status();
  insert into _erg(ok,txt) values ((j->>'ehemaliger_klient')::boolean and not (j->>'klient')::boolean, 'K1 ist jetzt ehemaliger Klient (3,99-Angebot)');
  j := public.cb_mein_anschluss_angebot(); ac := j->>'code';
  insert into _erg(ok,txt) values ((j->>'angebot')::boolean and ac like 'TESTCODE%' and j->>'apple_url' like '%code='||ac, 'K1 bekommt Angebotscode 3,99');
  j := public.cb_mein_anschluss_angebot();
  insert into _erg(ok,txt) values (j->>'code' = ac and (select count(*) from public.angebot_code where vergeben_an=k1)=1, 'K1 bekommt beim zweiten Aufruf denselben Code');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_klient_status();
  insert into _erg(ok,txt) values ((j->>'klient')::boolean and not (j->>'ehemaliger_klient')::boolean and (j->>'eigenes_abo')::boolean, 'K2 aktiver Klient mit eigenem Abo');
  j := public.cb_mein_anschluss_angebot();
  insert into _erg(ok,txt) values (not (j->>'angebot')::boolean and j->>'code' is null, 'K2 (aktiver Klient) bekommt keinen Code');

  -- Neue Vertragsversion: T1 muss erneut bestaetigen
  update public.fachperson_vertrag_text set gilt_ab = now() - interval '1 day' where gilt_ab = now();  -- nur im Probelauf (gleiche Transaktion wie die Migration)
  insert into public.fachperson_vertrag_text(version, titel, text, gilt_ab) values ('test-v2','Test','Test', now());
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_ich();
  insert into _erg(ok,txt) values (not (j->>'vertrag_ok')::boolean and j->>'vertrag_version'='test-v2', 'Neue Vertragsversion verlangt neue Bestaetigung');
  begin perform public.cb_fp_keys(); insert into _erg(ok,txt) values (false,'T1 arbeitet ohne neue Vertragsversion!');
  exception when others then insert into _erg(ok,txt) values (true,'Ohne neue Bestaetigung gesperrt'); end;
  perform public.cb_fp_vertrag_bestaetigen('test-v2');

  -- Bezahlte Lizenz abgelaufen: T2 gesperrt, kein Premium; verlaengert: wieder frei
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen('test-v2');   -- Vertrag ok, damit nur die Lizenz sperrt
  update public.fachperson_konto set lizenz_bis = now() - interval '1 day' where auth_id = t2;
  insert into _erg(ok,txt) values (not public.cb_ist_premium(t2), 'T2 Lizenz abgelaufen: kein Premium');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  begin perform public.cb_fp_keys(); insert into _erg(ok,txt) values (false,'T2 arbeitet mit abgelaufener Lizenz!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 Lizenz abgelaufen: gesperrt'); end;
  update public.fachperson_konto set lizenz_bis = now() + interval '30 days' where auth_id = t2;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);

  -- Abrechnung (Modell monat, 499 Cent): T1 hat A und C diesen Monat = 2 Keys
  j := public.cb_fp_abrechnung(null);
  insert into _erg(ok,txt) values ((j->>'keys_aktiv')::int=2 and j->>'abrechnung'='monat' and (j->>'betrag_cent')::int=998, 'T1 Abrechnung: 2 Keys x 4,99 = 9,98 ('||j::text||')');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  perform public.cb_fp_vertrag_bestaetigen('test-v2');
  j := public.cb_fp_abrechnung(null);
  insert into _erg(ok,txt) values ((j->>'keys_aktiv')::int=1, 'T2 Abrechnung: Key B zaehlt im Wechselmonat ('||j::text||')');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  j := public.cb_admin_fachleute(null);
  insert into _erg(ok,txt) values (jsonb_array_length(j) >= 2, 'Admin sieht Abrechnung aller Fachleute');
  -- Preis und Modell je Fachperson (T2: 1 Key B diesen Monat, bezahlte Lizenz seit heute)
  j := public.cb_admin_fachperson_abrechnung('fl1-test-t2@example.invalid','lizenz_plus_keys',300,1000,'monat');
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2,null))=1300, 'Modell Lizenz plus Keys: 10,00 + 1 x 3,00 = 13,00');
  perform public.cb_admin_fachperson_abrechnung('fl1-test-t2@example.invalid','lizenz_pauschal',300,1000,'monat');
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2,null))=1000, 'Modell Lizenz pauschal: 10,00, Keys inklusive');
  perform public.cb_admin_fachperson_abrechnung('fl1-test-t2@example.invalid','lizenz_pauschal',null,1200,'jahr');
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2,null))=1200
                               and (select betrag_cent from public._fp_abrechnung(t2,(now() + interval '1 month')::date))=0, 'Jahreslizenz: voller Preis nur im Jahrestag-Monat');
  perform public.cb_admin_fachperson_abrechnung('fl1-test-t2@example.invalid','gratis',null,1000,'monat');
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2,null))=0, 'Modell gratis: 0');
  perform public.cb_admin_fachperson_abrechnung('fl1-test-t2@example.invalid','je_key',300,null,null);
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2,null))=300, 'Eigener Key-Preis 3,00 statt 4,99');
  perform public.cb_admin_fachperson_abrechnung('fl1-test-t2@example.invalid',null,null,null,null);
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t2,null))=499 and (select modell from public._fp_abrechnung(t2,null))='je_key', 'Leer = globaler Standard (je Key, 4,99)');
  insert into _erg(ok,txt) values ((select betrag_cent from public._fp_abrechnung(t1,null))=998, 'Gruenderin T1 unveraendert 9,98');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform public.cb_admin_fachperson_abrechnung('fl1-test-t1@example.invalid','gratis'); insert into _erg(ok,txt) values (false,'T1 setzt eigenen Preis!');
  exception when others then insert into _erg(ok,txt) values (true,'Preis/Modell nur durch Admin'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  insert into _erg(ok,txt) values (public._fp_key_tage('2026-11-11 14:00+01','2026-12-11 14:00+01','2026-11-01')=20
                               and public._fp_key_tage('2026-11-11 14:00+01','2026-12-11 14:00+01','2026-12-01')=10, 'Key-Tage Nov 20 + Dez 10 = 30');

  -- Direkter Tabellenzugriff als angemeldeter Nutzer und anon: verboten
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  perform set_config('role','authenticated',true);
  begin perform 1 from public.gratis_code limit 1; insert into _erg(ok,txt) values (false,'authenticated liest gratis_code!');
  exception when others then insert into _erg(ok,txt) values (true,'gratis_code direkt gesperrt'); end;
  begin perform 1 from public.fachperson_konto limit 1; insert into _erg(ok,txt) values (false,'authenticated liest fachperson!');
  exception when others then insert into _erg(ok,txt) values (true,'fachperson direkt gesperrt'); end;
  begin perform 1 from public.fp_key_mail_log limit 1; insert into _erg(ok,txt) values (false,'authenticated liest Mail-Protokoll!');
  exception when others then insert into _erg(ok,txt) values (true,'fp_key_mail_log direkt gesperrt'); end;
  begin perform 1 from public.fachperson_einwilligung limit 1; insert into _erg(ok,txt) values (false,'authenticated liest einwilligung!');
  exception when others then insert into _erg(ok,txt) values (true,'fachperson_einwilligung direkt gesperrt'); end;
  begin perform * from public._fp_klient(c); insert into _erg(ok,txt) values (false,'authenticated ruft _fp_klient!');
  exception when others then insert into _erg(ok,txt) values (true,'_fp_klient nicht direkt aufrufbar'); end;
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.cb_fp_keys(); insert into _erg(ok,txt) values (false,'anon ruft cb_fp_keys!');
  exception when others then insert into _erg(ok,txt) values (true,'anon kein cb_fp_keys'); end;

  select count(*) filter (where e.ok), count(*) filter (where not e.ok or e.ok is null),
         string_agg(case when e.ok then 'OK ' else 'FEHLER ' end || e.txt, ' | ' order by e.nr)
    into ok, bad, log from _erg e;
  raise exception 'FL1-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
