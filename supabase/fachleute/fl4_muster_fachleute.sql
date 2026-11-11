-- FL-4 Nachtrag (11.11.2026): Angemeldete Fachleute (und Admin) sehen die Musterpraxis
-- direkt in therapeut.html, ohne Vorschau-Link. Ohne Anmeldung gilt weiter nur der Token.
create or replace function public._fl_muster_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(length(p_token), 0) >= 16
          and exists (select 1 from public.fachleute_einstellung where schluessel = 'muster_token' and wert = p_token))
      or public._fl_wunsch_darf();   -- freigeschaltete Fachperson (aktiv, Lizenz, Vertrag) oder Admin
$$;
revoke all on function public._fl_muster_token_ok(text) from public, anon, authenticated;

-- Glaubwürdigere Mengen (Ralph 11.11.: Musterpraxis wird für Reels gezeigt):
-- Dora W. kam im Schnitt auf gut 600 kcal, Anna K. auf knapp 1.200 kcal je Tag – zu wenig für echte Menschen.
-- Gleiche Produkte, Portionen größer (Dora × 1,6, Anna × 1,3), auf 5 g gerundet. Nährwerte rechnet weiter das System.
update public.fl_muster_tagebuch set menge_g = greatest(5, round(menge_g * 1.6 / 5) * 5) where benutzer_id = 'MUSTER-4';
update public.fl_muster_tagebuch set menge_g = greatest(5, round(menge_g * 1.3 / 5) * 5) where benutzer_id = 'MUSTER-1';
