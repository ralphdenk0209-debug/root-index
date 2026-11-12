-- FL-1 Stripe: LIVE SCHALTEN (vorbereitet 12.11.2026) – NICHT AUSGEFÜHRT.
-- Erst nach Ralphs ausdrücklichem „jaja, live“ einspielen, und erst wenn:
--   1. STRIPE_FP_SECRET_KEY in Supabase ein Live-Schlüssel ist (sk_live_/rk_live_) – laut Ralph erledigt 12.11.,
--   2. Teil B der Klickliste erledigt ist (SEPA live an, Rechnungsangaben, E-Mails, Smart Retries),
--   3. therapeut.html mit therapeut-zahlung.js?v=4 ausgerollt ist (Branch claude/fl1-stripe-live).
-- Probelauf ohne Wirkung: fl1_stripe_live_test.sql (rollt alles zurück).
-- Folge: Alle Fachleute brauchen im Live-Modus eine NEUE Zahlungsart (die Test-IBAN zählt nur im Modus test).

begin;
create table if not exists public._sicherung_fl1_stripe_live_20261112 as
  select * from public.fachleute_einstellung where schluessel like 'stripe%';
revoke all on public._sicherung_fl1_stripe_live_20261112 from public, anon, authenticated;

update public.fachleute_einstellung set wert = 'live' where schluessel = 'stripe_modus';

-- Takt aus fl1_stripe_takt.sql: am 1. jedes Monats 05:00 UTC (06:00 Uhr Winter, 07:00 Uhr Sommer) Rechnungen für den Vormonat
select cron.schedule('fp-monatsrechnung', '0 5 1 * *',
  $$select public.cb_edge_rufen('fp-monatsrechnung', '{}'::jsonb, 120)$$);
commit;

-- Prüfen danach:
--   select wert from public.fachleute_einstellung where schluessel = 'stripe_modus';   -- live
--   select jobname, schedule, active from cron.job where jobname = 'fp-monatsrechnung';

-- Freigabe für Petra & Kolleginnen (E-Mail von Ralph, je Person eine Zeile; 499 Cent je Key und Monat):
--   insert into public.fachperson_freigabe(email, key_preis_cent, aktiv, notiz)
--   values (lower(btrim('<mail>')), 499, true, 'Petra (Ralph 12.11.: 4,99 vereinbart)')
--   on conflict (email) do update set key_preis_cent = 499, aktiv = true, geaendert_am = now();
-- Achtung: Das Konto darf nicht auf abrechnungsmodell 'gratis' stehen (dann 0 € und keine Rechnung).
--   leer (= allgemein 'je_key') oder 'je_key' ist richtig.

-- Zurück auf Test (falls nötig):
--   update public.fachleute_einstellung set wert = 'test' where schluessel = 'stripe_modus';
--   select cron.unschedule('fp-monatsrechnung');
--   (dann muss auch STRIPE_FP_SECRET_KEY wieder ein Testschlüssel sein)
