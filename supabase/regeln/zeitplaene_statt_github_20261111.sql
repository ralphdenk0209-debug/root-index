-- =============================================================================
--  SEO- und Social-Abruf per Supabase-Zeitplan statt GitHub Actions
--  (11.11.2026, Ralph: Variante 1 „GitHub nur Backup“)
-- -----------------------------------------------------------------------------
--  Bisher stiessen seo-search-console.yml und social-meta.yml die beiden
--  Edge-Funktionen an. Jetzt macht das pg_cron ueber cb_edge_rufen (Service-
--  Schluessel aus dem Vault) - derselbe Weg wie social-meta-konten-taeglich,
--  umsatz-sync-taeglich u. a. Zeiten in UTC wie bisher in den Workflows.
-- =============================================================================
select cron.schedule('seo-search-console-sync', '15 */3 * * *',
  $$select public.cb_edge_rufen('seo-search-console-sync','{}'::jsonb,150)$$);
select cron.schedule('social-meta-sync', '30 5,17 * * *',
  $$select public.cb_edge_rufen('social-meta-sync','{}'::jsonb,150)$$);
