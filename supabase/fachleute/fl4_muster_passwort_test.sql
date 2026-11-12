-- FL-4 Musterpraxis-Passwort: Test. Läuft in EINER Transaktion und endet IMMER mit einem Fehler (alles wird zurückgerollt).
-- Probelauf: fl4_muster_passwort.sql + diese Datei zusammen. Danach: nur diese Datei.
-- Das Wegwerf-Passwort unten gibt es nur in dieser Transaktion; es wird nie gespeichert.
do $test$
#variable_conflict use_column
declare
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9'; k1 uuid := gen_random_uuid();
  pw1 text := 'wegwerf-' || md5(random()::text); pw2 text := 'wegwerf-' || md5(random()::text);
  j jsonb; tok text; alt text; ok int; bad int; log text; i int; hs text;
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  grant all on _erg to public; grant usage on sequence _erg_nr_seq to public;
  insert into auth.users(id, aud, role, email, created_at) values (k1,'authenticated','authenticated','fl4-mpw-k1@example.invalid',now());
  select wert into alt from public.fachleute_einstellung where schluessel = 'muster_token';   -- alter Link-Token, wird nicht ausgegeben
  delete from public.fl_muster_zugang where true; delete from public.fl_muster_sitzung where true; delete from public.fl_muster_fehlversuch where true;

  -- anon ohne Passwort
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.5"}', true);
  execute 'set local role anon';
  j := public.cb_fl_muster_anmelden('irgendwas-123');
  insert into _erg(ok,txt) values (j->>'grund' = 'falsch', 'Ohne gesetztes Passwort: kein Zugang');
  begin perform public.cb_fl_muster('oeffentlich'); insert into _erg(ok,txt) values (false,'„oeffentlich“ öffnet noch!');
  exception when others then insert into _erg(ok,txt) values (true,'Öffentliche Vorführung gesperrt'); end;
  begin perform public.cb_fl_muster(alt); insert into _erg(ok,txt) values (alt is null,'Alter Vorschau-Link öffnet noch!');
  exception when others then insert into _erg(ok,txt) values (true,'Alter Vorschau-Link gesperrt'); end;
  begin perform public.cb_fl_muster_naehrwerte('oeffentlich', 1, current_date - 7, current_date, 'tag'); insert into _erg(ok,txt) values (false,'Nährwerte ohne Zugang!');
  exception when others then insert into _erg(ok,txt) values (true,'Nährwerte ohne Zugang gesperrt'); end;
  begin perform public.cb_admin_fl_muster_passwort(pw1); insert into _erg(ok,txt) values (false,'anon setzt Passwort!');
  exception when others then insert into _erg(ok,txt) values (true,'anon: Passwort setzen gesperrt'); end;
  begin perform count(*) from public.fl_muster_zugang; insert into _erg(ok,txt) values (false,'Hash-Tabelle lesbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Hash-Tabelle für anon nicht lesbar'); end;
  execute 'reset role';

  -- angemeldet, aber kein Admin
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',k1)::text, true);
  execute 'set local role authenticated';
  begin perform public.cb_admin_fl_muster_passwort(pw1); insert into _erg(ok,txt) values (false,'Nicht-Admin setzt Passwort!');
  exception when others then insert into _erg(ok,txt) values (true,'Nicht-Admin: Passwort setzen gesperrt'); end;
  begin perform public.cb_admin_fl_muster_passwort_stand(); insert into _erg(ok,txt) values (false,'Nicht-Admin sieht Stand!');
  exception when others then insert into _erg(ok,txt) values (true,'Nicht-Admin: Stand gesperrt'); end;
  begin perform count(*) from public.fl_muster_sitzung; insert into _erg(ok,txt) values (false,'Zugangs-Tabelle lesbar!');
  exception when others then insert into _erg(ok,txt) values (true,'Zugangs-Tabelle nicht lesbar'); end;
  execute 'reset role';

  -- Admin setzt Wegwerf-Passwort
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  execute 'set local role authenticated';
  j := public.cb_admin_fl_muster_passwort('kurz');
  insert into _erg(ok,txt) values (not (j->>'ok')::boolean, 'Zu kurzes Passwort abgelehnt');
  j := public.cb_admin_fl_muster_passwort(pw1);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and (j->>'gesetzt')::boolean, 'Admin setzt Passwort');
  j := public.cb_admin_fl_muster_passwort_stand();
  insert into _erg(ok,txt) values ((j->>'gesetzt')::boolean and j::text !~ '\$2[aby]\$' and position(pw1 in j::text) = 0, 'Stand zeigt weder Passwort noch Hash');
  insert into _erg(ok,txt) values (public.cb_fl_muster(null) is not null, 'Admin sieht Musterpraxis ohne Passwort');
  execute 'reset role';
  select hash into hs from public.fl_muster_zugang where id = 1;
  insert into _erg(ok,txt) values (hs ~ '^\$2[aby]\$10\$' and position(pw1 in hs) = 0, 'Gespeichert ist nur ein bcrypt-Hash');

  -- anon mit Passwort
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  j := public.cb_fl_muster_anmelden(pw1 || 'x');
  insert into _erg(ok,txt) values (j->>'grund' = 'falsch' and j->>'token' is null, 'Falsches Passwort: kein Zugang');
  j := public.cb_fl_muster_anmelden(pw1); tok := j->>'token';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and tok ~ '^[0-9a-f]{48}$', 'Richtiges Passwort: Zugang');
  insert into _erg(ok,txt) values (public.cb_fl_muster(tok) is not null, 'Zugang öffnet die Musterpraxis');
  insert into _erg(ok,txt) values (jsonb_typeof(public.cb_fl_muster_naehrwerte(tok, 1, current_date - 7, current_date, 'tag')) = 'array', 'Zugang öffnet die Nährwerte');
  begin perform public.cb_fl_muster(md5(tok) || md5(tok)); insert into _erg(ok,txt) values (false,'Erfundener Zugang öffnet!');
  exception when others then insert into _erg(ok,txt) values (true,'Erfundener Zugang gesperrt'); end;
  execute 'reset role';
  insert into _erg(ok,txt) values (not exists (select 1 from public.fl_muster_sitzung where token_hash = tok), 'Zugang nur als Hash gespeichert');

  -- Bremse je Absender: nach 5 Fehlversuchen auch das richtige Passwort gesperrt, anderer Absender nicht
  execute 'set local role anon';
  for i in 1..4 loop perform public.cb_fl_muster_anmelden('falsch-' || i); end loop;   -- mit dem einen oben: 5
  j := public.cb_fl_muster_anmelden(pw1);
  insert into _erg(ok,txt) values (j->>'grund' = 'gesperrt', 'Bremse: 5 Fehlversuche sperren diesen Absender');
  perform set_config('request.headers', '{"x-forwarded-for":"198.51.100.7"}', true);
  j := public.cb_fl_muster_anmelden(pw1);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean, 'Anderer Absender kommt weiter rein');
  -- Bremse gesamt: 30 Fehlversuche in 15 Minuten
  for i in 1..30 loop
    perform set_config('request.headers', json_build_object('x-forwarded-for', '192.0.2.' || i)::text, true);
    perform public.cb_fl_muster_anmelden('falsch');
  end loop;
  perform set_config('request.headers', '{"x-forwarded-for":"198.51.100.99"}', true);
  j := public.cb_fl_muster_anmelden(pw1);
  insert into _erg(ok,txt) values (j->>'grund' = 'gesperrt', 'Bremse: 30 Fehlversuche insgesamt sperren alle');
  execute 'reset role';
  insert into _erg(ok,txt) values ((select count(*) from public.fl_muster_fehlversuch) <= 36, 'Gesperrte Versuche füllen die Tabelle nicht');

  -- Admin ändert Passwort: alte Zugänge und altes Passwort gelten nicht mehr, Bremse zurückgesetzt
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  execute 'set local role authenticated';
  j := public.cb_admin_fl_muster_passwort(pw2);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  begin perform public.cb_fl_muster(tok); insert into _erg(ok,txt) values (false,'Alter Zugang gilt nach Änderung noch!');
  exception when others then insert into _erg(ok,txt) values (true,'Nach Änderung: alter Zugang gesperrt'); end;
  j := public.cb_fl_muster_anmelden(pw1);
  insert into _erg(ok,txt) values (j->>'grund' = 'falsch', 'Nach Änderung: altes Passwort falsch');
  j := public.cb_fl_muster_anmelden(pw2); tok := j->>'token';
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and public.cb_fl_muster(tok) is not null, 'Nach Änderung: neues Passwort öffnet');
  execute 'reset role';

  -- Admin entfernt Passwort: Musterpraxis zu
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  execute 'set local role authenticated';
  j := public.cb_admin_fl_muster_passwort(null);
  insert into _erg(ok,txt) values ((j->>'ok')::boolean and not (j->>'gesetzt')::boolean and not (public.cb_admin_fl_muster_passwort_stand()->>'gesetzt')::boolean, 'Admin entfernt Passwort');
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
  j := public.cb_fl_muster_anmelden(pw2);
  insert into _erg(ok,txt) values (j->>'grund' = 'falsch', 'Ohne Passwort: kein Zugang mehr');
  begin perform public.cb_fl_muster(tok); insert into _erg(ok,txt) values (false,'Zugang gilt nach Entfernen noch!');
  exception when others then insert into _erg(ok,txt) values (true,'Nach Entfernen: Zugang gesperrt'); end;
  execute 'reset role';

  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL4-MUSTER-PASSWORT-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
