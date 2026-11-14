-- fl4_muster_oeffentlich_rueckweg.sql · 14.11.2026 · Rückweg zu fl4_muster_oeffentlich.sql
-- Stellt _fl_muster_token_ok wortgleich auf die Live-Fassung vom 14.11.2026 zurück (pg_get_functiondef vor der Änderung).
-- Schneller Notschalter ohne Rückweg: update public.fachleute_einstellung set wert = 'nein' where schluessel = 'muster_oeffentlich';

begin;
CREATE OR REPLACE FUNCTION public._fl_muster_token_ok(p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (coalesce(length(p_token), 0) between 40 and 100
          and exists (select 1 from public.fl_muster_sitzung
                       where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and gueltig_bis > now()))
      or public._fl_wunsch_darf();
$function$;
revoke all on function public._fl_muster_token_ok(text) from public, anon, authenticated;
-- Sicherungstabelle kann danach weg: drop table if exists public._sich_fl_muster_token_ok_20261114;
commit;
