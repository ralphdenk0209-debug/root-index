-- FL-1 Stripe: Probelauf LIVE SCHALTEN (12.11.2026). Endet IMMER mit Fehler (alles zurückgerollt).
-- Spielt fl1_stripe_live.sql in einer Transaktion durch, mit einer Fachperson „wie Petra“
-- (Freigabe 499 Cent) und einer ohne Freigabe.
do $test$
declare
  p uuid := gen_random_uuid(); o uuid := gen_random_uuid();
  ralph uuid := '2a00cb9e-1b48-4181-b90c-f34cd54a04a9';
  vm date := date_trunc('month', (now() at time zone 'Europe/Berlin') - interval '1 month')::date;
  j jsonb; n int; ok int := 0; bad int := 0; log text := '';
begin
  create temp table _e(nr serial, ok boolean, txt text) on commit drop;
  grant all on _e to public; grant usage on sequence _e_nr_seq to public;
  insert into auth.users(id, aud, role, email, created_at) values
    (p,'authenticated','authenticated','fls-live-petra@example.invalid',now()),
    (o,'authenticated','authenticated','fls-live-ohne@example.invalid',now());
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',ralph)::text, true);
  perform public.cb_admin_fachperson_setzen('fls-live-petra@example.invalid','Live Wie Petra','FLSLP','Praxis P',true,'gruenderin_gratis');
  perform public.cb_admin_fachperson_setzen('fls-live-ohne@example.invalid','Live Ohne','FLSLO',null,true,'gruenderin_gratis');
  insert into public.fachperson_vertrag_bestaetigung(auth_id, version, am)
    select x, public._fp_vertrag_aktuell(), now() from unnest(array[p,o]) x;
  update public.fachperson_konto set seit = vm - 10, vereinbarung_bestaetigt_am = now() where auth_id in (p,o);
  -- Freigabe wie Petra (direkt, wie in fl1_stripe_live.sql beschrieben)
  insert into public.fachperson_freigabe(email, key_preis_cent, aktiv, notiz)
    values ('fls-live-petra@example.invalid', 499, true, 'Probe wie Petra');
  insert into public.gratis_code(code, tage, fachperson_auth, start_am, laeuft_bis, max_einloesungen)
    values ('FLSLIVE1', 30, p, vm + 3, vm + 33, 1), ('FLSLIVE2', 30, p, vm + 12, vm + 42, 1), ('FLSLIVE3', 30, p, vm + 25, vm + 55, 1);
  -- Test-Kundin aus dem Testmodus (soll im Live-Modus NICHT zählen)
  insert into public.fachperson_stripe(auth_id, modus, customer_id, zahlungsart) values (p,'test','cus_FLSTEST','SEPA-Lastschrift ···3000');

  -- Vorher: Modus test
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',p)::text, true);
  j := public.cb_fp_ich();
  insert into _e(ok,txt) values ((j->>'keys_erlaubt')::boolean and (j->>'key_preis_cent')::int = 499, 'Wie Petra: keys_erlaubt, Preis 4,99 € (Karte wird gezeigt)');
  j := public.cb_fp_zahlung_stand();
  insert into _e(ok,txt) values (j->>'modus' = 'test' and j->>'zahlungsart' like 'SEPA%', 'Vorher: Modus test, Test-Zahlungsart sichtbar');
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',o)::text, true);
  j := public.cb_fp_ich();
  insert into _e(ok,txt) values (not coalesce((j->>'keys_erlaubt')::boolean, false), 'Ohne Freigabe: keys_erlaubt falsch (keine Karte, nur Lizenz-Hinweis)');

  -- Live schalten (Inhalt von fl1_stripe_live.sql)
  perform set_config('role','postgres',true);
  update public.fachleute_einstellung set wert = 'live' where schluessel = 'stripe_modus';
  get diagnostics n = row_count;
  insert into _e(ok,txt) values (n = 1, 'stripe_modus auf live gesetzt (1 Zeile)');
  perform cron.schedule('fp-monatsrechnung', '0 5 1 * *', $$select public.cb_edge_rufen('fp-monatsrechnung', '{}'::jsonb, 120)$$);
  select count(*) into n from cron.job where jobname = 'fp-monatsrechnung' and schedule = '0 5 1 * *' and active;
  insert into _e(ok,txt) values (n = 1, 'Takt fp-monatsrechnung angelegt (1. des Monats 05:00 UTC)');

  -- Nachher: Modus live
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',p)::text, true);
  j := public.cb_fp_zahlung_stand();
  insert into _e(ok,txt) values (j->>'modus' = 'live' and j->>'zahlungsart' is null, 'Nachher: Modus live, Test-IBAN zählt nicht, neue Zahlungsart nötig');
  insert into _e(ok,txt) values (public.cb_fp_stripe_kundin()->>'customer_id' is null and public.cb_fp_stripe_kundin()->>'modus' = 'live', 'Live: noch keine Stripe-Kundin (wird beim Hinterlegen angelegt)');
  perform set_config('role','service_role',true);
  select count(*) into n from public._fp_stripe_monatsliste(vm) l
   where l.auth_id = p and l.modus = 'live' and l.keys = 3 and l.preis_cent = 499 and l.betrag_cent = 1497 and l.customer_id is null;
  insert into _e(ok,txt) values (n = 1, 'Monatsliste live: wie Petra 3 Keys × 4,99 € = 14,97 €, ohne Zahlungsart');
  select count(*) into n from public._fp_stripe_monatsliste(vm) l where l.auth_id = o;
  insert into _e(ok,txt) values (n = 0, 'Monatsliste live: ohne Freigabe/Keys nicht dabei');

  select count(*) filter (where e.ok), count(*) filter (where not e.ok or e.ok is null),
         string_agg(case when e.ok then 'OK ' else 'FEHLER ' end || e.txt, ' | ' order by e.nr)
    into ok, bad, log from _e e;
  raise exception 'FLS-LIVE-PROBE: % OK, % FEHLER | %', ok, bad, log;
end $test$;
