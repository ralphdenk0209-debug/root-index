-- fl4_muster_oeffentlich.sql · 14.11.2026 · Musterpraxis öffentlich, ohne Passwort (Ralph 14.11. „A“)
--
-- Alle Musterfunktionen (cb_fl_muster, cb_fl_muster_dashboard, cb_fl_muster_naehrwerte, cb_fl5_muster_plaene,
-- cb_fl5_muster_plan_vorschlag) prüfen den Zugang über EINE Funktion: _fl_muster_token_ok(p_token).
-- Grundlage ist die Live-Fassung vom 14.11. (pg_get_functiondef, siehe Rückweg-Datei). Ergänzt wird nur:
--   p_token = 'oeffentlich' UND fachleute_einstellung.muster_oeffentlich = 'ja'
-- Abschalten wirkt sofort (kein Zwischenspeicher):
--   update public.fachleute_einstellung set wert = 'nein' where schluessel = 'muster_oeffentlich';
--
-- Nur lesen: Die fünf Musterfunktionen lesen ausschließlich fl_muster_*-Tabellen und Musterpläne (fl5_plan.muster_benutzer)
-- und prüfen die Nummer gegen fl_muster_klient / _fl_muster_ist. anon hat auf keine schreibende Fachleute-Funktion
-- (cb_fp_*, cb_fl5_*, cb_fl_wunsch_*, cb_admin_*) ein Ausführungsrecht; Key-Mail, Zahlung und Riki-Rezeptideen sind
-- Edge-Funktionen, die eine angemeldete Person verlangen. Siehe fl4_muster_oeffentlich_test.sql.
--
-- Diese Datei hat bewusst KEIN begin/commit: Probelauf = Datei + Testdatei in EINEM Aufruf, der Test endet mit RAISE.
-- Live als Migration (z. B. fl4_muster_oeffentlich_20261114). Rückweg: fl4_muster_oeffentlich_rueckweg.sql.

-- Sicherung der bisherigen Fassung (nur Admin/Server lesen)
create table if not exists public._sich_fl_muster_token_ok_20261114 as
  select now() as gesichert_am, pg_get_functiondef('public._fl_muster_token_ok(text)'::regprocedure) as def,
         (select wert from public.fachleute_einstellung where schluessel = 'muster_oeffentlich') as muster_oeffentlich;
alter table public._sich_fl_muster_token_ok_20261114 enable row level security;
revoke all on public._sich_fl_muster_token_ok_20261114 from public, anon, authenticated;

-- Schalter (gibt es live schon mit 'ja'; hier nur, falls er fehlt)
insert into public.fachleute_einstellung (schluessel, wert, notiz)
values ('muster_oeffentlich', 'ja', 'Vorführung therapeut-demo.html ohne Passwort (Token „oeffentlich“); nein = nur mit Passwort')
on conflict (schluessel) do nothing;
update public.fachleute_einstellung
   set notiz = 'Vorführung therapeut-demo.html ohne Passwort (Token „oeffentlich“, _fl_muster_token_ok, 14.11.2026); nein = nur mit Passwort oder als angemeldete Fachperson'
 where schluessel = 'muster_oeffentlich';

create or replace function public._fl_muster_token_ok(p_token text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
         (coalesce(length(p_token), 0) between 40 and 100
          and exists (select 1 from public.fl_muster_sitzung
                       where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and gueltig_bis > now()))
      -- 14.11.2026: öffentliche Vorführung, solange der Schalter auf 'ja' steht
      -- (coalesce: ein fehlender Token darf nie NULL ergeben, sonst greift "if not ... then raise" nicht)
      or (coalesce(p_token, '') = 'oeffentlich'
          and exists (select 1 from public.fachleute_einstellung
                       where schluessel = 'muster_oeffentlich' and wert = 'ja'))
      or public._fl_wunsch_darf(), false);
$function$;
-- Rechte bleiben wie live: nur postgres und service_role (create or replace behält die Rechte)
revoke all on function public._fl_muster_token_ok(text) from public, anon, authenticated;
