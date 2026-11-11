-- FL-1 Stripe: Monatslauf als Takt. ERST BEIM LIVE-SCHALTEN einspielen
-- (nach Ralphs jaja). Am 1. jedes Monats 06:00 Uhr (05:00 UTC, im Sommer 07:00 Uhr)
-- Rechnungen fuer den Vormonat.
select cron.schedule('fp-monatsrechnung', '0 5 1 * *',
  $$select public.cb_edge_rufen('fp-monatsrechnung', '{}'::jsonb, 120)$$);
