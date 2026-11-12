-- FL-4 Ansicht-Test. Läuft in EINER Transaktion und endet IMMER mit einem Fehler (alles wird zurückgerollt).
-- Probelauf: fl4_ansicht.sql + diese Datei zusammen. Danach: nur diese Datei.
do $test$
#variable_conflict use_column
declare
  t1 uuid := gen_random_uuid(); t2 uuid := gen_random_uuid(); k1 uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9'; j jsonb; ok int; bad int; log text;
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;
  insert into auth.users(id, aud, role, email, created_at) values
    (t1,'authenticated','authenticated','fl4-ans-t1@example.invalid',now()),
    (t2,'authenticated','authenticated','fl4-ans-t2@example.invalid',now()),
    (k1,'authenticated','authenticated','fl4-ans-k1@example.invalid',now());
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fl4-ans-t1@example.invalid','Ansicht Eins','FLANSA','Praxis A',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fl4-ans-t2@example.invalid','Ansicht Zwei','FLANSB','Praxis B',true,'gruenderin_gratis');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  insert into _erg(ok,txt) values (public.cb_fp_ansicht() is null, 'Ohne Ansicht: null (Standard)');
  j := public.cb_fp_ansicht_setzen('{"reihenfolge":["produkte","ziele","produkte","Böse;drop"],"zu":["ziele","ziele"]}');
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and j->'layout'->'reihenfolge' = '["produkte","ziele"]'::jsonb and j->'layout'->'zu' = '["ziele"]'::jsonb,
                                   'Speichern bereinigt (doppelt und ungültig raus, Reihenfolge bleibt)');
  insert into _erg(ok,txt) values (public.cb_fp_ansicht()->'reihenfolge'->>0 = 'produkte', 'Gespeicherte Ansicht wird geladen');
  j := public.cb_fp_ansicht_setzen('{"reihenfolge":"x"}');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Falsches Format abgelehnt');

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t2)::text, true);
  insert into _erg(ok,txt) values (public.cb_fp_ansicht() is null, 'Andere Fachperson sieht fremde Ansicht nicht');

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  begin perform public.cb_fp_ansicht_setzen('{}'); insert into _erg(ok,txt) values (false,'Nicht-Fachperson speichert!');
  exception when others then insert into _erg(ok,txt) values (true,'Nicht-Fachperson: gesperrt'); end;
  begin perform count(*) from public.fl_ansicht; insert into _erg(ok,txt) values (false,'Tabelle direkt lesbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Tabelle nicht direkt lesbar'); end;

  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',t1)::text, true);
  j := public.cb_fp_ansicht_setzen(null);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and public.cb_fp_ansicht() is null, 'Zurücksetzen löscht die Ansicht');
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  begin perform public.cb_fp_ansicht(); insert into _erg(ok,txt) values (false,'anon liest Ansicht!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: gesperrt'); end;
  execute 'reset role';

  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL4-ANSICHT-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
