-- FL-5c (11./12.11.2026): Bremse für Riki-Rezeptideen der Fachleute (Edge-Funktion fl5-riki-rezeptideen).
-- Nur neu: Einstellung + eine Funktion. riki-rezept-vorschlag / „Was koche ich?“ bleiben unberührt.
insert into public.fachleute_einstellung(schluessel, wert, notiz)
values ('fl5_riki_limit_tag', '20', 'FL-5: Riki-Rezeptideen je Fachperson und Tag (Kostenbremse; Monatsbudget gilt zusätzlich)')
on conflict (schluessel) do nothing;

create or replace function public.cb_fl5_riki_limit()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); n int; l int;     -- nur freigeschaltete Fachleute (Lizenz, Vertrag)
begin
  l := coalesce((select nullif(wert, '')::int from public.fachleute_einstellung where schluessel = 'fl5_riki_limit_tag'), 20);
  select count(*) into n from public."Riki_Nutzung"
   where akteur = auth.uid() and modus = 'fl5_rezeptideen' and erfolg and erfasst_am >= date_trunc('day', now());
  return jsonb_build_object('erlaubt', n < l, 'heute', n, 'limit', l,
    'grund', case when n >= l then 'Tageslimit für Riki-Rezeptideen erreicht (' || l || ' am Tag).' end);
end $f$;
revoke all on function public.cb_fl5_riki_limit() from public, anon;
grant execute on function public.cb_fl5_riki_limit() to authenticated;

-- KI austauschbar: Modell für die Rezeptideen als Einstellung (Edge-Funktion nimmt nur bekannte Modelle)
insert into public.fachleute_einstellung(schluessel, wert, notiz)
values ('fl5_ki_modell', 'claude-haiku-4-5-20251001', 'FL-5: KI-Modell für Riki-Rezeptideen der Fachleute (austauschbar)')
on conflict (schluessel) do nothing;
create or replace function public.cb_fl5_ki_modell()
returns text language sql stable security definer set search_path = public as $$
  select wert from public.fachleute_einstellung where schluessel = 'fl5_ki_modell';
$$;
revoke all on function public.cb_fl5_ki_modell() from public, anon;
grant execute on function public.cb_fl5_ki_modell() to authenticated;
