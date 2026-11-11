-- FL-1 Zugriffstest: zwei Fachpersonen (T1, T2), zwei Klienten (K1, K2).
-- Laeuft in EINER Transaktion und endet IMMER mit einem Fehler, damit
-- alles zurueckgerollt wird. Das Ergebnis steht in der Fehlermeldung:
-- "FL1-TEST: <n> OK, <m> FEHLER | ...".
do $test$
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid();
  k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  ver text; a text; b text; c text; j jsonb; n int; ok int := 0; bad int := 0; log text := '';
begin
  -- Hilfen
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;

  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl1-test-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl1-test-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl1-test-k1@example.invalid',now()),
    (k2,'authenticated','authenticated','fl1-test-k2@example.invalid',now());
  insert into public."Benutzer"("Benutzer_ID","Name","Email",auth_id,tier,is_premium,is_admin) values
    ('U-fl1test-k1','Klientin Eins','fl1-test-k1@example.invalid',k1,'free',false,false),
    ('U-fl1test-k2','Klient Zwei','fl1-test-k2@example.invalid',k2,'free',false,false);
  -- Tagebuch heute: K1 und K2 je ein Eintrag
  insert into public."Ernaehrungstagebuch"("Benutzer_ID","Datum","Mahlzeit","Freitext_Name","Menge_g","Man_kcal")
  values ('U-fl1test-k1',(now() at time zone 'Europe/Berlin')::date,'Frühstück','Test-Apfel',150,80),
         ('U-fl1test-k2',(now() at time zone 'Europe/Berlin')::date,'Frühstück','Test-Brot',100,250);

  -- Admin (Ralph) schaltet T1, T2 frei
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  j := public.cb_admin_fachperson_setzen('fl1-test-t1@example.invalid','Test Therapeutin Eins','TESTA','Praxis A');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'Admin setzt T1: '||j::text);
  j := public.cb_admin_fachperson_setzen('fl1-test-t2@example.invalid','Test Therapeutin Zwei','TESTB',null);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'Admin setzt T2');

  -- K1 darf NICHT Admin-Funktion nutzen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  begin perform public.cb_admin_fachperson_setzen('fl1-test-k1@example.invalid','x','XX');
        insert into _erg(ok,txt) values (false,'K1 konnte Admin-Funktion nutzen!');
  exception when others then insert into _erg(ok,txt) values (true,'K1 kein Admin: '||sqlerrm); end;
  -- K1 ist keine Fachperson
  begin perform public.cb_fp_keys(); insert into _erg(ok,txt) values (false,'K1 sieht Key-Liste!');
  exception when others then insert into _erg(ok,txt) values (true,'K1 keine Fachperson: '||sqlerrm); end;
  insert into _erg(ok,txt) values (not public.cb_ist_premium(k1), 'K1 vor Einloesung kein Premium');

  -- T1: erster Key ohne Vereinbarung -> abgelehnt, dann mit
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  insert into _erg(ok,txt) values (public.cb_ist_premium(t1), 'T1 hat Premium (lebenslang)');
  j := public.cb_fp_key_anlegen(30,'Frau Eins',false);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean and (j->>'vereinbarung_noetig')::boolean, 'T1 ohne Vereinbarung abgelehnt');
  j := public.cb_fp_key_anlegen(30,'Frau Eins',true); a := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and a like 'TESTA-%', 'T1 legt Key A an: '||coalesce(a,'-'));
  j := public.cb_fp_key_anlegen(14,'Herr Zwei bei T1'); c := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 legt Key C an (zweiter Key ohne Haken ok)');

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fp_key_anlegen(60,'Herr Zwei',true); b := j->>'code';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and b like 'TESTB-%', 'T2 legt Key B an: '||coalesce(b,'-'));
  -- T2 sieht nur eigene Keys
  j := public.cb_fp_keys();
  insert into _erg(ok,txt) values (jsonb_array_length(j)=1 and j->0->>'code'=b, 'T2 sieht nur eigenen Key B ('||jsonb_array_length(j)||')');
  -- T2 darf A nicht aendern/beenden/umbenennen
  begin perform public.cb_fp_key_laufzeit(a, 1, 'monate'); insert into _erg(ok,txt) values (false,'T2 verlaengert fremden Key A!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kann A nicht verlaengern'); end;
  begin perform public.cb_fp_key_beenden(a); insert into _erg(ok,txt) values (false,'T2 beendet fremden Key A!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kann A nicht beenden'); end;
  begin perform public.cb_fp_key_bezeichnung(a,'x'); insert into _erg(ok,txt) values (false,'T2 benennt A um!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kann A nicht umbenennen'); end;

  -- Einloesen: K1 -> A, K2 -> B und C
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_gratis_code_einloesen(a);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (j->>'einwilligung_offen')::boolean, 'K1 loest A ein');
  insert into _erg(ok,txt) values (public.cb_ist_premium(k1), 'K1 hat Premium ueber Key');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_gratis_code_einloesen(a);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'K2 kann A nicht nochmal einloesen: '||(j->>'grund'));
  j := public.cb_gratis_code_einloesen(b); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 loest B ein');
  j := public.cb_gratis_code_einloesen(c); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 loest C (von T1) ein');

  -- Ohne Einwilligung: T1 sieht K1 nicht, auch keinen Namen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T1 sieht K1 ohne Einwilligung!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 ohne Einwilligung kein Zugriff'); end;
  j := public.cb_fp_keys();
  insert into _erg(ok,txt) values (not exists(select 1 from jsonb_array_elements(j) x where x->>'klient_name' is not null), 'T1 sieht ohne Einwilligung keine Namen');

  -- Einwilligung K1 -> A; K1 kann NICHT fuer B einwilligen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  j := public.cb_meine_fachpersonen(); ver := j->'liste'->0->>'text_version';
  insert into _erg(ok,txt) values (jsonb_array_length(j->'liste')=1 and position('Test Therapeutin Eins' in j->'liste'->0->>'text')>0, 'K1 sieht Einwilligungstext mit Namen T1');
  j := public.cb_fachperson_einwilligen(a, false, ver);
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Einwilligung ohne Verschwiegenheits-Haken abgelehnt');
  j := public.cb_fachperson_einwilligen(a, true, ver); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K1 willigt fuer A ein');
  j := public.cb_fachperson_einwilligen(b, true, ver); insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'K1 kann nicht fuer fremden Key B einwilligen');
  -- K2 willigt fuer B und C ein
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_fachperson_einwilligen(b, true, ver); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 willigt fuer B ein');
  j := public.cb_fachperson_einwilligen(c, true, ver); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 willigt fuer C ein');

  -- Gegenseitig pruefen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(a) s where s.kcal = 80;
  insert into _erg(ok,txt) values (n=1, 'T1 sieht K1-Tageswert (80 kcal)');
  select count(*) into n from public.cb_fp_klient_tagessummen(c) s where s.kcal = 250;
  insert into _erg(ok,txt) values (n=1, 'T1 sieht K2 ueber eigenen Key C');
  begin perform * from public.cb_fp_klient_tagessummen(b); insert into _erg(ok,txt) values (false,'T1 sieht K2 ueber fremden Key B!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 kein Zugriff ueber Key B (gehoert T2)'); end;
  j := public.cb_fp_keys();
  insert into _erg(ok,txt) values (jsonb_array_length(j)=2 and exists(select 1 from jsonb_array_elements(j) x where x->>'klient_name'='Klientin Eins'), 'T1 sieht genau 2 Keys und Namen K1');

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(b) s where s.kcal = 250;
  insert into _erg(ok,txt) values (n=1, 'T2 sieht K2 ueber B');
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T2 sieht K1!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kein Zugriff auf K1'); end;
  begin perform * from public.cb_fp_klient_tagessummen(c); insert into _erg(ok,txt) values (false,'T2 sieht K2 ueber Key C von T1!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 kein Zugriff ueber Key C (gehoert T1)'); end;

  -- Klienten sind keine Fachpersonen
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'K1 nutzt Fachperson-Zugriff!');
  exception when others then insert into _erg(ok,txt) values (true,'K1 kein Fachperson-Zugriff'); end;

  -- Widerruf: K2 widerruft C -> T1 sieht K2 nicht mehr, T2 weiter ueber B
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k2)::text, true);
  j := public.cb_fachperson_widerrufen(c); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'K2 widerruft C');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public.cb_fp_klient_tagessummen(c); insert into _erg(ok,txt) values (false,'T1 sieht K2 nach Widerruf!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 nach Widerruf kein Zugriff'); end;
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  select count(*) into n from public.cb_fp_klient_tagessummen(b);
  insert into _erg(ok,txt) values (n=1, 'T2 sieht K2 weiter ueber B');

  -- Laufzeit: T1 verlaengert A um 1 Monat, kuerzt dann um 3 Monate -> Ende jetzt
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_key_laufzeit(a, 1, 'monate'); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 verlaengert A um 1 Monat');
  j := public.cb_fp_key_laufzeit(a, -2, 'wochen'); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 kuerzt A um 2 Wochen');
  insert into _erg(ok,txt) values (public.cb_ist_premium(k1), 'K1 noch Premium nach Kuerzen um 2 Wochen');
  j := public.cb_fp_key_laufzeit(a, -3, 'monate'); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T1 kuerzt A auf jetzt');
  insert into _erg(ok,txt) values (not public.cb_ist_premium(k1), 'K1 nach Ablauf kein Premium mehr');
  begin perform * from public.cb_fp_klient_tagessummen(a); insert into _erg(ok,txt) values (false,'T1 sieht K1 nach Ablauf!');
  exception when others then insert into _erg(ok,txt) values (true,'T1 nach Ablauf kein Zugriff'); end;

  -- Beenden: T2 beendet B -> Zugriff weg
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fp_key_beenden(b); insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'T2 beendet B');
  begin perform * from public.cb_fp_klient_tagessummen(b); insert into _erg(ok,txt) values (false,'T2 sieht K2 nach Beenden!');
  exception when others then insert into _erg(ok,txt) values (true,'T2 nach Beenden kein Zugriff'); end;

  -- Abrechnung: T1 eigene Zahl, nicht T2
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_abrechnung(null);
  insert into _erg(ok,txt) values ((j->>'keys_aktiv')::int=2 and (j->>'key_tage')::int=2, 'T1 Abrechnung: 2 Keys, 2 Key-Tage heute ('||j::text||')');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  j := public.cb_admin_fachleute(null);
  insert into _erg(ok,txt) values (jsonb_array_length(j) >= 2, 'Admin sieht Abrechnung aller Fachleute');
  -- Rechenprobe Key-Tage: 30-Tage-Key ab 11.11. 14:00 -> Nov 20, Dez 10
  insert into _erg(ok,txt) values (public._fp_key_tage('2026-11-11 14:00+01','2026-12-11 14:00+01','2026-11-01')=20
                               and public._fp_key_tage('2026-11-11 14:00+01','2026-12-11 14:00+01','2026-12-01')=10, 'Key-Tage Nov 20 + Dez 10 = 30');

  -- Direkter Tabellenzugriff als angemeldeter Nutzer: verboten
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  perform set_config('role','authenticated',true);
  begin perform 1 from public.gratis_code limit 1; insert into _erg(ok,txt) values (false,'authenticated liest gratis_code!');
  exception when others then insert into _erg(ok,txt) values (true,'gratis_code direkt gesperrt'); end;
  begin perform 1 from public.fachperson limit 1; insert into _erg(ok,txt) values (false,'authenticated liest fachperson!');
  exception when others then insert into _erg(ok,txt) values (true,'fachperson direkt gesperrt'); end;
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
