-- FL-5e Probelauf, Teil 1: Vorher-Stand des Ist-Abgleichs der Musterpläne und des Muster-Wochenplans merken.
-- Nur zusammen mit fl5e_ein_snack.sql + fl5e_test.sql in EINEM Aufruf (Temp-Tabelle, alles wird zurückgerollt).
do $vorher$
declare tok text := 'fltest-' || md5(random()::text) || md5(random()::text); heute date := (now() at time zone 'Europe/Berlin')::date;
begin
  insert into public.fl_muster_sitzung(token_hash, gueltig_bis) values (encode(extensions.digest(tok, 'sha256'), 'hex'), now() + interval '15 minutes');
  create temp table _fl5e_vorher on commit drop as
  with k as (select m.nr from public.fl_muster_klient m where public._fl_muster_ist(m.benutzer_id)),
       pl as (select k.nr, x from k, jsonb_array_elements(public.cb_fl5_muster_plaene(tok, k.nr)->'plaene') x)
  select 'plan'::text art, (x->>'id') schl, x->'ist' wert from pl
  union all select 'eintrag', (e->>'id'), jsonb_build_object('status', e->>'status', 'gegessen', e->'gegessen') from pl, jsonb_array_elements(pl.x->'eintraege') e
  union all select 'wochenplan', k.nr::text, (select jsonb_build_object('n', jsonb_array_length(coalesce(d->'wochenplan', '[]')),
                                                'snack', (select count(*) from jsonb_array_elements(coalesce(d->'wochenplan', '[]')) w where w->>'slot' = 'Snack'))
                                              from public.cb_fl_muster_dashboard(tok, k.nr, heute - 7, heute - 1) d) from k;
end $vorher$;
