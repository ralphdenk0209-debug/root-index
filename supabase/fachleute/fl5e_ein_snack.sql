-- FL-5e (12.11.2026, Ralph: „wir haben einen snack im tagebuch“ … „und ja, ein snack“)
-- Pläne kennen nur noch die Plätze des Tagebuchs: Frühstück, Mittag, Abendessen, Snack.
-- * Bestehende Pläne (fl5_plan_eintrag, auch die Musterpläne) und der Muster-Wochenplan (fl_muster_wochenplan):
--   alle Snacks kommen in den einen Snack. Kein Eintrag geht verloren, nur die Tageszeit (snack_zeit) wird leer.
--   Die Reihenfolge innerhalb eines Tages bleibt wie bisher angezeigt (vormittags vor nachmittags vor abends).
-- * Sicherung vorher: shadow_v1._sich_fl5e_plan_eintrag_20261112, shadow_v1._sich_fl5e_muster_wochenplan_20261112,
--   shadow_v1._sich_fn_fl5e_ein_snack_20261112 (Funktionen). Rückweg: fl5e_rueckweg.sql.
-- * _fl5_platz: Snack immer nach dem Abendessen (wie im Tagebuch), Tageszeit egal.
-- * cb_fp_plan_speichern: snack_zeit wird nicht mehr gespeichert (alte Seiten, die sie noch schicken, gehen weiter).
-- * _fl5_vorschlag: Standard-Plätze sind die vier Plätze; schickt eine alte Seite noch „Snack:vormittags“ usw.,
--   wird daraus der eine Snack (kein doppelter Snack je Tag).
-- Die Spalte snack_zeit bleibt (alte Apps, Rückweg), ist aber immer leer.
-- Ist-Abgleich (wie geplant / anders / ohne Eintrag) vergleicht schon bisher nur mit der Mahlzeit „Snack“ im Tagebuch
-- und ändert sich dadurch nicht (geprüft in fl5e_test.sql).
-- Probelauf: diese Datei + fl5e_test.sql zusammen in EINEM Aufruf (der Test endet immer mit Fehler = zurückgerollt).
-- KEIN begin/commit in dieser Datei.

-- 1) Sicherung ------------------------------------------------------------------------------
create table if not exists shadow_v1._sich_fl5e_plan_eintrag_20261112 as
  select e.id, e.plan_id, e.datum, e.slot, e.snack_zeit, e.reihenfolge, now() gesichert_am from public.fl5_plan_eintrag e;
create table if not exists shadow_v1._sich_fl5e_muster_wochenplan_20261112 as
  select w.id, w.benutzer_id, w.datum, w.slot, w.snack_zeit, w.reihenfolge, now() gesichert_am from public.fl_muster_wochenplan w;
create table if not exists shadow_v1._sich_fn_fl5e_ein_snack_20261112 as
  select p.proname, pg_get_functiondef(p.oid) def, now() gesichert_am
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('_fl5_platz', '_fl5_vorschlag', 'cb_fp_plan_speichern');
revoke all on shadow_v1._sich_fl5e_plan_eintrag_20261112, shadow_v1._sich_fl5e_muster_wochenplan_20261112,
              shadow_v1._sich_fn_fl5e_ein_snack_20261112 from public, anon, authenticated;

-- 2) Zusammenführen (Reihenfolge je Tag wie bisher angezeigt, dann Tageszeit leeren) ----------
update public.fl5_plan_eintrag e set reihenfolge = n.rf
  from (select x.id, (row_number() over (partition by x.plan_id, x.datum
                        order by public._fl5_platz(x.slot, x.snack_zeit), x.reihenfolge, x.id))::int rf
          from public.fl5_plan_eintrag x
         where x.plan_id in (select plan_id from public.fl5_plan_eintrag where snack_zeit is not null)) n
 where n.id = e.id and e.reihenfolge is distinct from n.rf;
update public.fl5_plan_eintrag set snack_zeit = null where snack_zeit is not null;

update public.fl_muster_wochenplan w set reihenfolge = n.rf
  from (select x.id, (row_number() over (partition by x.benutzer_id, x.datum
                        order by public._fl5_platz(x.slot, x.snack_zeit), x.reihenfolge, x.id))::int rf
          from public.fl_muster_wochenplan x
         where x.benutzer_id in (select benutzer_id from public.fl_muster_wochenplan where snack_zeit is not null)) n
 where n.id = w.id and w.reihenfolge is distinct from n.rf;
update public.fl_muster_wochenplan set snack_zeit = null where snack_zeit is not null;

-- 3) Funktionen ------------------------------------------------------------------------------
create or replace function public._fl5_platz(p_slot text, p_snack_zeit text)
 returns integer language sql immutable set search_path to 'public'
as $function$
  -- FL-5e: ein Snack wie im Tagebuch, nach dem Abendessen; p_snack_zeit zählt nicht mehr
  select case p_slot when 'Frühstück' then 1 when 'Mittag' then 3 when 'Abendessen' then 5 when 'Snack' then 7 else 9 end;
$function$;

-- Kleine, geprüfte Änderungen am Live-Stand (jede Stelle muss genau so oft vorkommen, sonst Abbruch)
do $patch$
declare d text; n int;
begin
  -- cb_fp_plan_speichern: Tageszeit nicht mehr speichern
  d := pg_get_functiondef('public.cb_fp_plan_speichern(text,jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, $a$v_sz := case when v_slot = 'Snack' then nullif(x->>'snack_zeit', '') end;$a$, ''))) / length($a$v_sz := case when v_slot = 'Snack' then nullif(x->>'snack_zeit', '') end;$a$);
  if n <> 1 then raise exception 'FL-5e: cb_fp_plan_speichern hat sich geändert (Stelle snack_zeit % mal gefunden)', n; end if;
  d := replace(d, $a$v_sz := case when v_slot = 'Snack' then nullif(x->>'snack_zeit', '') end;$a$,
                  $a$v_sz := null;   -- FL-5e: ein Snack wie im Tagebuch, Tageszeit wird nicht mehr gespeichert$a$);
  execute d;

  -- _fl5_vorschlag: vier Plätze, „Snack:…“ wird zum einen Snack
  d := pg_get_functiondef('public._fl5_vorschlag(text,text,date,date,jsonb)'::regprocedure);
  n := (length(d) - length(replace(d, $a$'["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen"]'$a$, ''))) / length($a$'["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen"]'$a$);
  if n <> 1 then raise exception 'FL-5e: _fl5_vorschlag hat sich geändert (Standard-Plätze % mal gefunden)', n; end if;
  d := replace(d, $a$'["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen"]'$a$, $a$'["Frühstück","Mittag","Abendessen","Snack"]'$a$);

  n := (length(d) - length(replace(d, $a$split_part(p.v, ':', 1) slot, nullif(split_part(p.v, ':', 2), '') sz$a$, ''))) / length($a$split_part(p.v, ':', 1) slot, nullif(split_part(p.v, ':', 2), '') sz$a$);
  if n <> 1 then raise exception 'FL-5e: _fl5_vorschlag hat sich geändert (Plätze-Zerlegung % mal gefunden)', n; end if;
  d := replace(d, $a$split_part(p.v, ':', 1) slot, nullif(split_part(p.v, ':', 2), '') sz$a$, $a$p.v slot, null::text sz$a$);

  n := (length(d) - length(replace(d, $a$from jsonb_array_elements_text(v_plaetze) p(v)),$a$, ''))) / length($a$from jsonb_array_elements_text(v_plaetze) p(v)),$a$);
  if n <> 1 then raise exception 'FL-5e: _fl5_vorschlag hat sich geändert (Plätze-Quelle % mal gefunden)', n; end if;
  d := replace(d, $a$from jsonb_array_elements_text(v_plaetze) p(v)),$a$,
                  $a$from (select split_part(q.v, ':', 1) v from jsonb_array_elements_text(v_plaetze) with ordinality q(v, o)
                 group by split_part(q.v, ':', 1) order by min(q.o)) p(v)),   -- FL-5e: ein Snack, „Snack:…“ zählt als Snack$a$);

  n := (length(d) - length(replace(d, $a$nullif(x->>'snack_zeit', '') sz$a$, ''))) / length($a$nullif(x->>'snack_zeit', '') sz$a$);
  if n <> 2 then raise exception 'FL-5e: _fl5_vorschlag hat sich geändert (nur/belegt snack_zeit % mal gefunden)', n; end if;
  d := replace(d, $a$nullif(x->>'snack_zeit', '') sz$a$, $a$null::text sz$a$);
  execute d;
end $patch$;

notify pgrst, 'reload schema';
