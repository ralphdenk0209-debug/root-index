-- fl4_muster_oeffentlich_test.sql · 14.11.2026 · Test zu fl4_muster_oeffentlich.sql
-- Probelauf: Inhalt der Änderung + diese Datei in EINEM Aufruf. Endet IMMER mit RAISE EXCEPTION (alles zurückgerollt).
do $$
declare
  ok int := 0; fehl text[] := '{}'; r jsonb; n int; s0 bigint; s1 bigint; f record; rufe text;
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  gesperrt text[] := '{}';
begin
  update public.fachleute_einstellung set wert = 'ja' where schluessel = 'muster_oeffentlich';

  -- Schreibzähler dieser Transaktion vor den Gast-Aufrufen
  select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) into s0 from pg_stat_xact_user_tables;

  execute 'set local role anon';

  -- 1–5 Gast liest die Musterpraxis über den öffentlichen Token
  r := public.cb_fl_muster('oeffentlich');
  if jsonb_array_length(r->'klienten') = 4 then ok := ok + 1; else fehl := array_append(fehl, ('cb_fl_muster: ' || left(r::text, 200))::text); end if;
  r := public.cb_fl_muster_dashboard('oeffentlich', 1, v_heute - 7, v_heute - 1);
  if r is not null then ok := ok + 1; else fehl := array_append(fehl, 'dashboard leer'::text); end if;
  r := public.cb_fl_muster_naehrwerte('oeffentlich', 1, v_heute - 7, v_heute - 1, 'tag');
  if r is not null then ok := ok + 1; else fehl := array_append(fehl, 'naehrwerte leer'::text); end if;
  r := public.cb_fl5_muster_plaene('oeffentlich', 1);
  if (r->>'ok')::boolean then ok := ok + 1; else fehl := array_append(fehl, ('plaene: ' || left(r::text, 200))::text); end if;
  r := public.cb_fl5_muster_plan_vorschlag('oeffentlich', 1, v_heute, v_heute + 6, '{}'::jsonb);
  if r is not null then ok := ok + 1; else fehl := array_append(fehl, 'plan_vorschlag leer'::text); end if;

  -- 6 falscher Token und leerer Token: abgelehnt
  begin perform public.cb_fl_muster('oeffentlich '); fehl := array_append(fehl, 'token mit Leerzeichen offen'::text);
  exception when insufficient_privilege then ok := ok + 1; end;
  begin perform public.cb_fl_muster(null); fehl := array_append(fehl, 'token null offen'::text);
  exception when insufficient_privilege then ok := ok + 1; end;

  -- 7 keine echten Daten: Nummer außerhalb der Musterpraxis wird abgelehnt
  begin perform public.cb_fl_muster_dashboard('oeffentlich', 999, v_heute - 7, v_heute - 1); fehl := array_append(fehl, 'nr 999 offen'::text);
  exception when insufficient_privilege or no_data_found or raise_exception then ok := ok + 1; end;

  execute 'reset role';

  -- 8 nichts geschrieben: Schreibzähler unverändert nach allen Gast-Aufrufen
  select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) into s1 from pg_stat_xact_user_tables;
  if s1 = s0 then ok := ok + 1; else fehl := array_append(fehl, ('Gast hat geschrieben: ' || (s1 - s0))::text); end if;

  -- 9 jede schreibende Fachleute-Funktion einzeln als Gast: muss mit fehlendem Recht abbrechen
  for f in
    select p.oid::regprocedure::text sig, p.oid,
           'select public.' || quote_ident(p.proname) || '(' ||
           coalesce((select string_agg('null::' || format_type(t, null), ', ' order by i)
                       from unnest(p.proargtypes::oid[]) with ordinality u(t, i)), '') || ')' sqltext
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.provolatile = 'v'
       and p.proname ~ '^(cb_fp_|cb_fl5_|cb_fl_wunsch|cb_admin_fl|cb_admin_fach|cb_fl_muster_anmelden$)'
       and p.proname not in ('cb_fl5_muster_plaene', 'cb_fl_muster_anmelden')
     order by 1
  loop
    begin
      execute 'set local role anon';
      execute f.sqltext;
      execute 'reset role';
      fehl := array_append(fehl, ('NICHT gesperrt: ' || f.sig)::text);
    exception when insufficient_privilege then
      execute 'reset role';
      ok := ok + 1; gesperrt := array_append(gesperrt, f.sig);
    when others then
      execute 'reset role';
      fehl := array_append(fehl, ('lief an (' || sqlstate || '): ' || f.sig)::text);
    end;
  end loop;

  -- 10 Abschalten wirkt sofort
  update public.fachleute_einstellung set wert = 'nein' where schluessel = 'muster_oeffentlich';
  execute 'set local role anon';
  begin perform public.cb_fl_muster('oeffentlich'); fehl := array_append(fehl, 'abgeschaltet und trotzdem offen'::text);
  exception when insufficient_privilege then ok := ok + 1; end;
  execute 'reset role';

  -- 11 Rechte: _fl_muster_token_ok selbst ist für Gäste nicht aufrufbar; Sicherung nicht lesbar
  if not has_function_privilege('anon', 'public._fl_muster_token_ok(text)', 'execute')
     and not has_table_privilege('anon', 'public._sich_fl_muster_token_ok_20261114', 'select') then ok := ok + 1;
  else fehl := array_append(fehl, 'rechte'::text); end if;

  raise exception 'PROBELAUF muster_oeffentlich (wird zurueckgerollt): % OK / % Fehler % | gesperrt (% Funktionen): %',
    ok, coalesce(array_length(fehl, 1), 0), fehl, coalesce(array_length(gesperrt, 1), 0), array_to_string(gesperrt, ', ');
end $$;
