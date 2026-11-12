-- FL-4 (12.11.2026, Ralph): „ziele und gegessene produkte soll man auch zuklappen können, bzw alle die man nicht
-- braucht und soll so gespeichert werden. verschieben der karten wäre auch gut, dann kann das jeder individuell
-- sortieren, soll aber für alle klienten gelten.“
-- Je Fachperson EINE Ansicht (Reihenfolge und zugeklappte Karten der Personenansicht), gilt für alle Personen.
-- Nur eigene Zeile, nur über die zwei Funktionen. Rein additiv, keine bestehende Funktion geändert.

create table if not exists public.fl_ansicht (
  auth_id      uuid primary key,
  layout       jsonb not null check (jsonb_typeof(layout) = 'object' and length(layout::text) <= 2000),
  geaendert_am timestamptz not null default now()
);
alter table public.fl_ansicht enable row level security;
revoke all on public.fl_ansicht from anon, authenticated;

create or replace function public.cb_fp_ansicht()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
begin
  if not exists (select 1 from public.fachperson_konto where auth_id = auth.uid()) then
    raise exception 'Nur für Fachleute.' using errcode = '42501'; end if;
  return (select layout from public.fl_ansicht where auth_id = auth.uid());
end $f$;

-- p_layout = {"reihenfolge": [schlüssel …], "zu": [schlüssel …]}; null = Ansicht zurücksetzen.
create or replace function public.cb_fp_ansicht_setzen(p_layout jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_uid uuid := auth.uid(); v_r text[]; v_z text[];
begin
  if not exists (select 1 from public.fachperson_konto where auth_id = v_uid) then
    raise exception 'Nur für Fachleute.' using errcode = '42501'; end if;
  if p_layout is null or p_layout = 'null'::jsonb then
    delete from public.fl_ansicht where auth_id = v_uid;
    return jsonb_build_object('ok', true, 'zurueckgesetzt', true);
  end if;
  if jsonb_typeof(p_layout) <> 'object'
     or jsonb_typeof(coalesce(p_layout->'reihenfolge', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p_layout->'zu', '[]')) <> 'array' then
    return jsonb_build_object('ok', false, 'grund', 'Ansicht hat ein falsches Format.'); end if;
  -- nur kurze Schlüssel aus Kleinbuchstaben, höchstens 40 je Liste, doppelte raus
  select coalesce(array_agg(x order by o), '{}') into v_r from (
    select distinct on (x) x, o from jsonb_array_elements_text(coalesce(p_layout->'reihenfolge', '[]')) with ordinality t(x, o)
     where x ~ '^[a-z0-9_]{1,30}$' order by x, o) q;
  select coalesce(array_agg(distinct x), '{}') into v_z
    from jsonb_array_elements_text(coalesce(p_layout->'zu', '[]')) x where x ~ '^[a-z0-9_]{1,30}$';
  if cardinality(v_r) > 40 or cardinality(v_z) > 40 then return jsonb_build_object('ok', false, 'grund', 'Zu viele Karten.'); end if;
  insert into public.fl_ansicht(auth_id, layout) values (v_uid, jsonb_build_object('reihenfolge', to_jsonb(v_r), 'zu', to_jsonb(v_z)))
  on conflict (auth_id) do update set layout = excluded.layout, geaendert_am = now();
  return jsonb_build_object('ok', true, 'layout', jsonb_build_object('reihenfolge', to_jsonb(v_r), 'zu', to_jsonb(v_z)));
end $f$;

revoke all on function public.cb_fp_ansicht() from public, anon;
revoke all on function public.cb_fp_ansicht_setzen(jsonb) from public, anon;
grant execute on function public.cb_fp_ansicht() to authenticated;
grant execute on function public.cb_fp_ansicht_setzen(jsonb) to authenticated;
