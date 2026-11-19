-- Scan in 5 s, Hebel 1+2 (Ralph „jaja, 1+2+3 bauen“, 19.11.2026)
-- 1) trg_sofortstart schickt hintergrund=true: riki-scan-worker v23 antwortet sofort und arbeitet per
--    EdgeRuntime.waitUntil weiter. pg_net schickt den naechsten Aufruf erst, wenn der laufende geantwortet hat
--    (gemessen 19.11.: leerer Anstoss wartete bis 0,03 s nach Ende eines Vorlesens).
-- 2) cb_riki_scan_schnellcheck_holen: riki-etikett holt nach dem Lesen das parallel gelaufene
--    Schnell-Check-Ergebnis am Auftrag bzw. an der Vorlesung ab. Nur Service-Workflow.
--
-- Ruecksprung Trigger (Fassung bis 19.11.2026):
--   body := jsonb_build_object('max_jobs',1)   statt   jsonb_build_object('max_jobs',1,'hintergrund',true)
-- Ruecksprung Funktion: drop function public.cb_riki_scan_schnellcheck_holen(bigint, bigint);

create or replace function shadow_v1.trg_riki_scan_job_sofortstart()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  if new.status = 'offen' then
    begin
      perform net.http_post(
        url := 'https://haurbpfkfaaehorirzee.supabase.co/functions/v1/riki-scan-worker',
        headers := jsonb_build_object('Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdXJicGZrZmFhZWhvcmlyemVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDY2OTYsImV4cCI6MjA5Nzk4MjY5Nn0.6U0bD0m2kYM2iL0KJ9fbCFvcQMXAglr8GvwmPwyHqyw'),
        -- 19.11.2026: hintergrund=true -> Worker antwortet sofort, pg_net ist frei fuer den naechsten Auftrag
        body := jsonb_build_object('max_jobs',1,'hintergrund',true),
        timeout_milliseconds := 150000);
    exception when others then null; -- Cron-Takt bleibt das Netz
    end;
  end if;
  return new;
end $function$;

create or replace function public.cb_riki_scan_schnellcheck_holen(p_job_id bigint default null, p_vorlesung_id bigint default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public', 'shadow_v1'
as $function$
/* 19.11.2026 (Scan in 5 s): Ergebnis des parallel laufenden Schnell-Checks fuer riki-etikett. Nur Service-Workflow. */
declare v jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Nur Service-Workflow.';
  end if;
  if p_job_id is not null then
    select ergebnis_meta->'schnellcheck' into v from shadow_v1.riki_scan_job where job_id = p_job_id;
  elsif p_vorlesung_id is not null then
    select schnellcheck into v from shadow_v1.riki_scan_vorlesung where id = p_vorlesung_id;
  end if;
  return case when v is null or v = 'null'::jsonb then null else v end;
end $function$;

revoke all on function public.cb_riki_scan_schnellcheck_holen(bigint, bigint) from public, anon, authenticated;
grant execute on function public.cb_riki_scan_schnellcheck_holen(bigint, bigint) to service_role;
