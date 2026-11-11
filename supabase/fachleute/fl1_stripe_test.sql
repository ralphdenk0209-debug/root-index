-- FL-1 Stripe: Zugriffstest. Endet IMMER mit Fehler (alles zurueckgerollt).
do $test$
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  vm date := date_trunc('month', (now() at time zone 'Europe/Berlin') - interval '1 month')::date;
  j jsonb; n int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _e(nr serial, ok boolean, txt text) on commit drop;
  grant all on _e to public; grant usage on sequence _e_nr_seq to public;
  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fls-test-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fls-test-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fls-test-k1@example.invalid',now());
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fls-test-t1@example.invalid','Stripe Test Eins','STRTA','Praxis S',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fls-test-t2@example.invalid','Stripe Test Zwei','STRTB',null,true,'gruenderin_gratis');
  insert into public.fachperson_vertrag_bestaetigung(auth_id, version, am)
    select x, public._fp_vertrag_aktuell(), now() from unnest(array[t1,t2]) x;
  update public.fachperson_konto set seit = vm - 10, vereinbarung_bestaetigt_am = now() where auth_id in (t1,t2);
  -- T1: zwei Keys im Vormonat, T2: keiner
  insert into public.gratis_code(code, tage, fachperson_auth, start_am, laeuft_bis, max_einloesungen)
    values ('STRTEST1', 30, t1, vm + 3, vm + 33, 1), ('STRTEST2', 30, t1, vm + 20, vm + 50, 1);
  insert into public.fachperson_stripe(auth_id, modus, customer_id, zahlungsart) values (t1,'test','cus_TEST1','SEPA-Lastschrift ···3000');
  insert into public.fachperson_rechnung(auth_id, modus, monat, keys, betrag_cent, status) values (t1,'test',vm,2,998,'offen');

  -- Monatsliste: nur service_role
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  begin perform * from public._fp_stripe_monatsliste(vm); insert into _e(ok,txt) values (false,'T1 liest Monatsliste!');
  exception when others then insert into _e(ok,txt) values (true,'Monatsliste fuer Fachperson gesperrt'); end;
  begin perform count(*) from public.fachperson_stripe; insert into _e(ok,txt) values (false,'T1 liest Tabelle fachperson_stripe direkt!');
  exception when others then insert into _e(ok,txt) values (true,'Tabelle fachperson_stripe direkt gesperrt'); end;
  begin perform count(*) from public.fachperson_rechnung; insert into _e(ok,txt) values (false,'T1 liest Tabelle fachperson_rechnung direkt!');
  exception when others then insert into _e(ok,txt) values (true,'Tabelle fachperson_rechnung direkt gesperrt'); end;
  j := public.cb_fp_zahlung_stand();
  insert into _e(ok,txt) values (j->>'zahlungsart' like 'SEPA%' and jsonb_array_length(j->'rechnungen')=1 and j->>'modus'='test', 'T1 sieht eigene Zahlungsart und 1 Rechnung');
  j := public.cb_fp_stripe_kundin();
  insert into _e(ok,txt) values (j->>'customer_id'='cus_TEST1', 'T1 bekommt eigene Kundin');
  begin perform public.cb_admin_fachleute_rechnungen(null); insert into _e(ok,txt) values (false,'T1 nutzt Admin-Rechnungen!');
  exception when others then insert into _e(ok,txt) values (true,'Admin-Rechnungen fuer T1 gesperrt'); end;

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  j := public.cb_fp_zahlung_stand();
  insert into _e(ok,txt) values (j->>'zahlungsart' is null and jsonb_array_length(j->'rechnungen')=0, 'T2 sieht nichts von T1');
  insert into _e(ok,txt) values (public.cb_fp_stripe_kundin()->>'customer_id' is null, 'T2 hat keine Kundin');

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  begin perform public.cb_fp_zahlung_stand(); insert into _e(ok,txt) values (false,'Klient sieht Zahlungsstand!');
  exception when others then insert into _e(ok,txt) values (true,'Klient (keine Fachperson) abgewiesen'); end;
  begin perform public.cb_fp_stripe_kundin(); insert into _e(ok,txt) values (false,'Klient bekommt Kundin!');
  exception when others then insert into _e(ok,txt) values (true,'Klient bekommt keine Stripe-Kundin'); end;
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  begin perform public.cb_fp_zahlung_stand(); insert into _e(ok,txt) values (false,'Anon sieht Zahlungsstand!');
  exception when others then insert into _e(ok,txt) values (true,'Anon abgewiesen'); end;

  perform set_config('role','service_role',true);
  select count(*) into n from public._fp_stripe_monatsliste(vm) l where l.auth_id = t1 and l.keys = 2 and l.betrag_cent = 998 and l.customer_id = 'cus_TEST1' and l.rechnung_status = 'offen';
  insert into _e(ok,txt) values (n=1, 'Monatsliste: T1 mit 2 Keys, 9,98 EUR, Kundin, schon abgerechnet');
  select count(*) into n from public._fp_stripe_monatsliste(vm) l where l.auth_id = t2;
  insert into _e(ok,txt) values (n=0, 'Monatsliste: T2 ohne Keys taucht nicht auf');
  perform set_config('role','postgres',true);
  begin insert into public.fachperson_rechnung(auth_id, modus, monat, betrag_cent) values (t1,'test',vm,1);
        insert into _e(ok,txt) values (false,'Doppelte Monatsrechnung moeglich!');
  exception when unique_violation then insert into _e(ok,txt) values (true,'Doppelte Monatsrechnung ausgeschlossen'); end;

  select count(*) filter (where e.ok), count(*) filter (where not e.ok), string_agg(case when not e.ok then e.txt end, '; ')
    into ok, bad, log from _e e;
  raise exception 'FLS-TEST: % OK, % FEHLER | %', ok, bad, coalesce(log,'');
end $test$;
