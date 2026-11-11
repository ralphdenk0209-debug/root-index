-- =============================================================================
--  Regelschutz 11.11.2026 (Geschaeftsgeheimnis, Repo-privat-Chat)
-- -----------------------------------------------------------------------------
--  GEMESSEN 11.11. (als angemeldeter Nicht-Admin, Rolle authenticated):
--    * View "Bewertungsregeln": 0 von 254 Zeilen  -> schon geschuetzt (WHERE-Filter
--      in der View: postgres/service_role/cb_ist_admin()).
--    * cb_riki_regelwerk_holen('verarbeitungsgrad'): ok=true, 101.573 Zeichen,
--      251 Regeln angehaengt  -> LECK. Grund: die Sperre fragt current_user ab.
--      In einer SECURITY-DEFINER-Funktion ist current_user immer der Besitzer
--      (postgres) - die Sperre greift also nie.
--    * cb_zutat_vorschlag_pruefen: gleiche Sperre, gleicher Fehler (auch anon).
--    * cb_admin_waechter_faelle: gar keine Sperre, auch anon; gibt Regeltitel
--      und Noten aus und ist eine schwere Abfrage.
--
--  AENDERUNG:
--    1. Die Sperre fragt statt current_user, ob der Aufruf von INNEN kommt:
--       kein JWT UND nicht ueber die API (session_user <> 'authenticator').
--       Ueber die API ist session_user immer "authenticator" und ein JWT da;
--       pg_cron (z. B. cb_zutat_stapel_takt) und der SQL-Editor haben keins.
--       Service-Workflow (JWT-Rolle service_role) und Admins (cb_ist_admin)
--       bleiben wie bisher erlaubt.
--    2. cb_admin_waechter_faelle: Huelle mit Admin-Sperre vor der schweren
--       Abfrage (Nicht-Admins bekommen sofort "Nur Admins.").
--    3. anon darf die Admin-Regelfunktionen nicht mehr aufrufen.
--  Kein Regelinhalt in dieser Datei. Frontend unveraendert.
-- =============================================================================

do $$
declare
  f text; d text; alt text; neu text; n int;
begin
  -- 1. Sperre: current_user (immer postgres) -> echte Herkunft des Aufrufs
  alt := $q$current_user not in ('postgres','supabase_admin','service_role')$q$;
  neu := $q$not (auth.jwt() is null and session_user <> 'authenticator')$q$;
  foreach f in array array['public.cb_riki_regelwerk_holen(text)',
                           'public.cb_zutat_vorschlag_pruefen(text,integer,text,text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    n := (length(d) - length(replace(d, alt, ''))) / length(alt);
    if n <> 1 then raise exception 'Regelschutz: % hat % Treffer statt 1 - nichts geaendert', f, n; end if;
    execute replace(d, alt, neu);
  end loop;

  -- 2. Waechter-Faelle nur fuer Admins: die schwere Abfrage wandert unveraendert
  --    in _cb_admin_waechter_faelle_roh (niemand ausser postgres darf sie rufen);
  --    cb_admin_waechter_faelle wird eine Huelle, die zuerst die Sperre prueft.
  alter function public.cb_admin_waechter_faelle(integer) rename to _cb_admin_waechter_faelle_roh;
  revoke all on function public._cb_admin_waechter_faelle_roh(integer) from public, anon, authenticated, service_role;
  create function public.cb_admin_waechter_faelle(p_limit integer default 8)
    returns table(fall_text text, produkte integer, beispiel_produkt text, problem text,
                  vorschlag_text text, vorschlag_zutat_id text, vorschlag_note text,
                  vorschlag_art text, regel text, anteil text, kandidaten jsonb)
    language plpgsql stable security definer set search_path = public, shadow_v1
  as $f$
  begin
    if not (public.cb_ist_admin() or (auth.jwt() is null and session_user <> 'authenticator')) then
      raise exception 'Nur Admins.';
    end if;
    return query select * from public._cb_admin_waechter_faelle_roh(p_limit);
  end $f$;
end $$;

-- 3. anon raus aus den Admin-Regelfunktionen (Admins sind immer angemeldet)
revoke execute on function public.cb_admin_waechter_faelle(integer) from public, anon;
revoke execute on function public.cb_zutat_vorschlag_pruefen(text,integer,text,text) from public, anon;
revoke execute on function public.cb_regel_speichern(text,text,text,text,text,text,text,numeric) from public, anon;
revoke execute on function public.cb_regel_loeschen(text) from public, anon;
revoke execute on function public.cb_admin_stamm_notenrahmen(text,uuid) from public, anon;
grant execute on function public.cb_admin_waechter_faelle(integer) to authenticated, service_role;
grant execute on function public.cb_zutat_vorschlag_pruefen(text,integer,text,text) to authenticated, service_role;
grant execute on function public.cb_regel_speichern(text,text,text,text,text,text,text,numeric) to authenticated, service_role;
grant execute on function public.cb_regel_loeschen(text) to authenticated, service_role;
grant execute on function public.cb_admin_stamm_notenrahmen(text,uuid) to authenticated, service_role;
