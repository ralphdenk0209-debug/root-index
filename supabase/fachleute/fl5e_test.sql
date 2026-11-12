-- FL-5e Test: ein Snack. Sicherung, nichts verloren, Reihenfolge, Ist-Abgleich unverändert, Vorschlag mit einem Snack.
-- Endet IMMER mit Fehler (= zurückgerollt). Ergebnis in der Meldung: "FL5E-TEST: <n> OK, <m> FEHLER | ...".
-- Probelauf (vor dem Einspielen), alles in EINEM Aufruf:
--   fl5e_test_vorher.sql + fl5e_ein_snack.sql + diese Datei
-- Nach dem Einspielen: nur diese Datei (der Vergleich mit dem Vorher-Stand entfällt dann).
do $test$
#variable_conflict use_column
declare
  tok text; heute date := (now() at time zone 'Europe/Berlin')::date;
  mo date := date_trunc('week', (now() at time zone 'Europe/Berlin')::date)::date + 7;
  j jsonb; n int; n2 int; ok int := 0; bad int := 0; log text := ''; v_vorher boolean := to_regclass('pg_temp._fl5e_vorher') is not null;
begin
  create temp table _erg(nr serial, ok boolean, txt text) on commit drop;
  -- Muster-Zugang seit FL-4 Passwort (12.11.): eigene Test-Sitzung, wird mit dem Test zurückgerollt
  tok := 'fltest-' || md5(random()::text) || md5(random()::text);
  insert into public.fl_muster_sitzung(token_hash, gueltig_bis) values (encode(extensions.digest(tok, 'sha256'), 'hex'), now() + interval '15 minutes');

  -- 1) Sicherung und nichts verloren ----------------------------------------------------------
  insert into _erg(ok,txt) values ((select count(*) from shadow_v1._sich_fl5e_plan_eintrag_20261112) = (select count(*) from public.fl5_plan_eintrag)
                                   and (select count(*) from shadow_v1._sich_fl5e_muster_wochenplan_20261112) = (select count(*) from public.fl_muster_wochenplan),
                                   'Sicherung vollständig (Pläne ' || (select count(*) from public.fl5_plan_eintrag) || ', Muster-Wochenplan ' || (select count(*) from public.fl_muster_wochenplan) || ' Einträge)');
  select count(*) into n from shadow_v1._sich_fl5e_plan_eintrag_20261112 where snack_zeit is not null;
  select count(*) into n2 from shadow_v1._sich_fl5e_muster_wochenplan_20261112 where snack_zeit is not null;
  insert into _erg(ok,txt) values (n > 0 or n2 > 0 or not v_vorher, 'Sicherung enthält die alten Snack-Zeiten (' || n || ' in Plänen, ' || n2 || ' im Muster-Wochenplan)');
  insert into _erg(ok,txt) values ((select count(*) from shadow_v1._sich_fn_fl5e_ein_snack_20261112) = 3, 'Sicherung der 3 Funktionen');
  insert into _erg(ok,txt) values (not has_table_privilege('anon', 'shadow_v1._sich_fl5e_plan_eintrag_20261112', 'select')
                                   and not has_table_privilege('authenticated', 'shadow_v1._sich_fl5e_plan_eintrag_20261112', 'select'), 'Sicherung nicht lesbar für anon/authenticated');
  insert into _erg(ok,txt) values (not exists (select 1 from public.fl5_plan_eintrag where snack_zeit is not null)
                                   and not exists (select 1 from public.fl_muster_wochenplan where snack_zeit is not null), 'Keine Snack-Zeit mehr (ein Snack)');
  insert into _erg(ok,txt) values (not exists (select 1 from shadow_v1._sich_fl5e_plan_eintrag_20261112 s left join public.fl5_plan_eintrag e on e.id = s.id
                                                where e.id is null or e.plan_id <> s.plan_id or e.datum <> s.datum or e.slot <> s.slot)
                                   and not exists (select 1 from shadow_v1._sich_fl5e_muster_wochenplan_20261112 s left join public.fl_muster_wochenplan w on w.id = s.id
                                                where w.id is null or w.benutzer_id <> s.benutzer_id or w.datum <> s.datum or w.slot <> s.slot),
                                   'Nichts verloren: jeder Eintrag noch da, gleicher Tag und gleiche Mahlzeit');

  -- 2) Reihenfolge je Tag wie vorher angezeigt (vormittags vor nachmittags vor abends) -----------
  with alt as (select s.*, case s.slot when 'Frühstück' then 1 when 'Mittag' then 3 when 'Abendessen' then 5
                                        when 'Snack' then case coalesce(s.snack_zeit, 'nachmittags') when 'vormittags' then 2 when 'nachmittags' then 4 when 'abends' then 6 else 7 end
                                        else 9 end pa
                 from shadow_v1._sich_fl5e_plan_eintrag_20261112 s
                where s.plan_id in (select plan_id from shadow_v1._sich_fl5e_plan_eintrag_20261112 where snack_zeit is not null)),
       neu as (select alt.*, e.reihenfolge rn from alt join public.fl5_plan_eintrag e on e.id = alt.id)
  select count(*) into n from neu a join neu b on a.plan_id = b.plan_id and a.datum = b.datum and a.id <> b.id
   where (a.pa, a.reihenfolge, a.id) < (b.pa, b.reihenfolge, b.id) and a.rn >= b.rn;
  insert into _erg(ok,txt) values (n = 0, 'Pläne: Reihenfolge je Tag wie vorher (' || n || ' Abweichungen)');
  with alt as (select s.*, case s.slot when 'Frühstück' then 1 when 'Mittag' then 3 when 'Abendessen' then 5
                                        when 'Snack' then case coalesce(s.snack_zeit, 'nachmittags') when 'vormittags' then 2 when 'nachmittags' then 4 when 'abends' then 6 else 7 end
                                        else 9 end pa
                 from shadow_v1._sich_fl5e_muster_wochenplan_20261112 s
                where s.benutzer_id in (select benutzer_id from shadow_v1._sich_fl5e_muster_wochenplan_20261112 where snack_zeit is not null)),
       neu as (select alt.*, w.reihenfolge rn from alt join public.fl_muster_wochenplan w on w.id = alt.id)
  select count(*) into n from neu a join neu b on a.benutzer_id = b.benutzer_id and a.datum = b.datum and a.id <> b.id
   where (a.pa, a.reihenfolge, a.id) < (b.pa, b.reihenfolge, b.id) and a.rn >= b.rn;
  insert into _erg(ok,txt) values (n = 0, 'Muster-Wochenplan: Reihenfolge je Tag wie vorher (' || n || ' Abweichungen)');
  insert into _erg(ok,txt) values (public._fl5_platz('Snack', 'vormittags') = 7 and public._fl5_platz('Snack', null) = 7 and public._fl5_platz('Abendessen', null) = 5
                                   and public._fl5_platz('Frühstück', null) = 1, 'Platz: Frühstück, Mittag, Abendessen, Snack');

  -- 3) Ist-Abgleich und Muster-Wochenplan unverändert (nur im Probelauf mit Vorher-Stand) --------
  if v_vorher then
    create temp table _fl5e_nachher on commit drop as
    with k as (select m.nr from public.fl_muster_klient m where public._fl_muster_ist(m.benutzer_id)),
         pl as (select k.nr, x from k, jsonb_array_elements(public.cb_fl5_muster_plaene(tok, k.nr)->'plaene') x)
    select 'plan'::text art, (x->>'id') schl, x->'ist' wert from pl
    union all select 'eintrag', (e->>'id'), jsonb_build_object('status', e->>'status', 'gegessen', e->'gegessen') from pl, jsonb_array_elements(pl.x->'eintraege') e
    union all select 'wochenplan', k.nr::text, (select jsonb_build_object('n', jsonb_array_length(coalesce(d->'wochenplan', '[]')),
                                                  'snack', (select count(*) from jsonb_array_elements(coalesce(d->'wochenplan', '[]')) w where w->>'slot' = 'Snack'))
                                                from public.cb_fl_muster_dashboard(tok, k.nr, heute - 7, heute - 1) d) from k;
    select count(*) into n from _fl5e_vorher where art = 'eintrag';
    select count(*) into n2 from _fl5e_vorher v full join _fl5e_nachher a on a.art = v.art and a.schl = v.schl
     where coalesce(v.art, a.art) = 'eintrag' and v.wert is distinct from a.wert;
    insert into _erg(ok,txt) values (n > 0 and n2 = 0, 'Ist-Abgleich je Eintrag gleich wie vorher (' || n || ' Einträge, ' || n2 || ' Abweichungen)');
    select count(*) into n from _fl5e_vorher where art = 'plan';
    select count(*) into n2 from _fl5e_vorher v full join _fl5e_nachher a on a.art = v.art and a.schl = v.schl
     where coalesce(v.art, a.art) = 'plan' and v.wert is distinct from a.wert;
    insert into _erg(ok,txt) values (n > 0 and n2 = 0, 'Zusammenfassung „wie geplant / anders / ohne Eintrag“ gleich (' || n || ' Pläne, ' || n2 || ' Abweichungen)');
    select count(*) into n2 from _fl5e_vorher v full join _fl5e_nachher a on a.art = v.art and a.schl = v.schl
     where coalesce(v.art, a.art) = 'wochenplan' and v.wert is distinct from a.wert;
    insert into _erg(ok,txt) values (n2 = 0, 'Muster-Wochenplan im Dashboard: gleich viele Einträge und Snacks');
  else
    insert into _erg(ok,txt) values (true, 'Ist-Abgleich: kein Vorher-Stand (nur im Probelauf geprüft)');
  end if;
  select count(*) into n from jsonb_array_elements(public.cb_fl_muster_dashboard(tok, 1, heute - 7, heute - 1)->'wochenplan') w where w->>'snack_zeit' is not null;
  insert into _erg(ok,txt) values (n = 0, 'Dashboard Muster: Wochenplan ohne Snack-Zeit');

  -- 4) Vorschlag: ein Snack je Tag -------------------------------------------------------------
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, '{}'::jsonb);
  insert into _erg(ok,txt) values ((select count(*) from jsonb_array_elements(j->'eintraege') x where x->>'slot' = 'Snack') between 1 and 7
                                   and not exists (select 1 from jsonb_array_elements(j->'eintraege') x group by x->>'datum', x->>'slot' having count(*) > 1)
                                   and not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'snack_zeit' is not null),
                                   'Vorschlag Standard: je Tag höchstens ein Eintrag je Platz, ein Snack, ohne Tageszeit (' || jsonb_array_length(j->'eintraege') || ' Vorschläge)');
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, '{"plaetze":["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen","Snack:abends","Snack:spaet"]}'::jsonb);
  insert into _erg(ok,txt) values (not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'slot' = 'Snack' group by x->>'datum' having count(*) > 1),
                                   'Alte Seite mit 4 Snack-Plätzen bekommt einen Snack je Tag');
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, '{"plaetze":["Frühstück","Mittag","Abendessen","Snack"]}'::jsonb);
  insert into _erg(ok,txt) values ((select count(*) from jsonb_array_elements(j->'eintraege') x where x->>'slot' = 'Snack') >= 1
                                   and (select count(distinct x->>'slot') from jsonb_array_elements(j->'eintraege') x) <= 4, 'Neue Seite: vier Plätze');
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo, jsonb_build_object('plaetze', '["Frühstück","Mittag","Abendessen","Snack"]'::jsonb,
         'belegt', jsonb_build_array(jsonb_build_object('datum', mo, 'slot', 'Snack'))));
  insert into _erg(ok,txt) values (not exists (select 1 from jsonb_array_elements(j->'eintraege') x where x->>'slot' = 'Snack'), 'Belegter Snack bleibt frei');
  j := public.cb_fl5_muster_plan_vorschlag(tok, 1, mo, mo + 6, jsonb_build_object('plaetze', '["Frühstück","Mittag","Abendessen","Snack"]'::jsonb,
         'nur', jsonb_build_array(jsonb_build_object('datum', mo + 3, 'slot', 'Snack'))));
  insert into _erg(ok,txt) values (jsonb_array_length(j->'eintraege') = 1 and j->'eintraege'->0->>'slot' = 'Snack', 'Tauschen: genau der eine Snack');

  select count(*) filter (where ok), count(*) filter (where not ok), string_agg(case when not ok then '✗ ' else '' end || txt, ' | ' order by nr)
    into ok, bad, log from _erg;
  raise exception 'FL5E-TEST: % OK, % FEHLER | %', ok, bad, log;
end $test$;
