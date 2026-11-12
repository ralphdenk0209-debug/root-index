-- FL-5e Rückweg: stellt Snack-Zeiten, Reihenfolge und die 3 Funktionen aus der Sicherung wieder her.
-- Nur nötig, wenn „ein Snack“ zurückgenommen werden soll. Pläne, die seither neu gespeichert wurden, behalten den einen Snack.
update public.fl5_plan_eintrag e set snack_zeit = s.snack_zeit, reihenfolge = s.reihenfolge
  from shadow_v1._sich_fl5e_plan_eintrag_20261112 s where s.id = e.id and s.slot = e.slot and s.datum = e.datum;
update public.fl_muster_wochenplan w set snack_zeit = s.snack_zeit, reihenfolge = s.reihenfolge
  from shadow_v1._sich_fl5e_muster_wochenplan_20261112 s where s.id = w.id and s.slot = w.slot and s.datum = w.datum;
do $r$ declare f record; begin
  for f in select def from shadow_v1._sich_fn_fl5e_ein_snack_20261112 loop execute f.def; end loop;
end $r$;
notify pgrst, 'reload schema';
