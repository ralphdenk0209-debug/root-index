-- Scan in 5 s, Hebel 4 (Ralph „und 4“, 19.11.2026): jedes Foto sofort lesen, nicht nur das erste.
-- Web und iPhone schicken jedes Etikettfoto direkt nach der Aufnahme (cb_riki_scan_vorlesen). Gemessen: bei 2+ Fotos
-- vergehen vom ersten Foto bis „Senden“ im Mittel 24 s - die Fotos sind beim Senden meist schon gelesen.
-- riki-scan-worker v24 holt alle Vorlesungen zum Auftrag (cb_riki_scan_vorlesungen_fuer_job) und fuegt zusammen:
-- Zutaten aus genau einem Foto, Naehrwerte aus genau einem Foto (oder gleichen Werten). Laeuft die Zutatenliste ueber
-- zwei Fotos oder widersprechen sich die Naehrwerte, liest er wie bisher alle Fotos gemeinsam (v16-Regel bleibt).
-- Tagesgrenze der Vorlesungen je Nutzer 30 -> 60 (je Foto statt je Produkt).
-- Ruecksprung: drop function public.cb_riki_scan_vorlesungen_fuer_job(bigint, text); Grenze 60 -> 30 per Ersetzung.

create or replace function public.cb_riki_scan_vorlesungen_fuer_job(p_job_id bigint, p_ean text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'shadow_v1'
as $function$
/* 19.11.2026 Hebel 4: alle Vorlesungen desselben Nutzers zum Barcode der letzten 20 Minuten, neueste zuerst. */
declare j shadow_v1.riki_scan_job%rowtype; v_ean text; r jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Nur Service-Workflow.'; end if;
  select * into j from shadow_v1.riki_scan_job where job_id = p_job_id;
  if not found then return '[]'::jsonb; end if;
  v_ean := regexp_replace(coalesce(p_ean,''),'[^0-9]','','g');
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'status',v.status,'foto_sha',v.foto_sha,'schnellcheck',v.schnellcheck,'lesung',v.lesung) order by v.id desc), '[]'::jsonb)
    into r
    from shadow_v1.riki_scan_vorlesung v
   where v.benutzer_id = j.benutzer_id and v.ean = v_ean and v.status in ('offen','laeuft','fertig')
     and v.erstellt_am > now() - interval '20 minutes';
  return r;
end $function$;

revoke all on function public.cb_riki_scan_vorlesungen_fuer_job(bigint, text) from public, anon, authenticated;
grant execute on function public.cb_riki_scan_vorlesungen_fuer_job(bigint, text) to service_role;

do $do$
declare d text; n text;
begin
  d := pg_get_functiondef('public.cb_riki_scan_vorlesen'::regproc);
  n := replace(d, 'if v_heute >= 30 then', 'if v_heute >= 60 then /* 19.11.2026 Hebel 4: jedes Foto wird vorgelesen */');
  if n = d then raise exception 'Tagesgrenze in cb_riki_scan_vorlesen nicht gefunden'; end if;
  execute n;
end $do$;
