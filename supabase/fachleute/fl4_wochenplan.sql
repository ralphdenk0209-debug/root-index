-- =====================================================================
-- FL-4 Nachtrag: Wochenplan echter Klienten (Ralph 11.11.2026: „der Wochenplaner muss mit rein“)
-- Setzt fl4_dashboard.sql voraus.
-- * Neue Fassung des Einwilligungstexts (fl4-2026-11-11) = Fassung fl1-2026-11-11
--   plus „meinen Wochenplan (geplante Rezepte und Mahlzeiten)“. Neue Fassung =
--   neue Zeile (FL-1-Regel), die alte bleibt unverändert stehen.
-- * Die Therapeutin sieht den Wochenplan nur, wenn die Person einer Fassung mit
--   mit_wochenplan = true zugestimmt hat. Stand 11.11.: noch keine Einwilligungen.
-- =====================================================================
alter table public.fachperson_einwilligung_text add column if not exists mit_wochenplan boolean not null default false;

insert into public.fachperson_einwilligung_text(version, text, text_aeltere, text_besprochen, mit_wochenplan)
select 'fl4-2026-11-11',
       replace(t.text, 'meine eigenen Rezepte sowie', 'meine eigenen Rezepte, meinen Wochenplan (geplante Rezepte und Mahlzeiten) sowie'),
       t.text_aeltere, t.text_besprochen, true
  from public.fachperson_einwilligung_text t
 where t.version = 'fl1-2026-11-11'
   and position('meine eigenen Rezepte sowie' in t.text) > 0
on conflict (version) do nothing;

-- Dashboard echter Klienten: Wochenplan (diese und nächste Woche) nur mit passender Einwilligung
create or replace function public.cb_fp_klient_dashboard(p_code text, p_von date, p_bis date)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare k record; v_von date; v_heute date := (now() at time zone 'Europe/Berlin')::date;
        r jsonb; v_plan boolean; v_wv date; v_p jsonb;
begin
  select * into k from public._fp_klient(p_code);                           -- wirft 42501 ohne Recht
  v_von := greatest(p_von, k.daten_ab);
  if v_von > p_bis then
    r := jsonb_build_object('von', p_von, 'bis', p_bis, 'leer', true, 'daten_ab', k.daten_ab, 'heute', v_heute,
                            'code', upper(trim(p_code)), 'grund', 'Einträge sind erst ab dem ' || to_char(k.daten_ab, 'DD.MM.YYYY') || ' freigegeben.');
  else
    r := public._fl4_dashboard(k.benutzer_id, v_von, p_bis)
      || jsonb_build_object('daten_ab', case when k.daten_ab > date '1900-01-01' then k.daten_ab end, 'heute', v_heute, 'code', upper(trim(p_code)));
  end if;

  select coalesce(t.mit_wochenplan, false) into v_plan
    from public.gratis_code g
    join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    join public.fachperson_einwilligung_text t on t.version = e.version
   where g.code = upper(trim(p_code));
  if coalesce(v_plan, false) then
    v_wv := date_trunc('week', v_heute)::date;
    select jsonb_agg(jsonb_build_object('datum', w."Datum", 'slot', w."Slot", 'rezept_id', w."Rezept_ID",
             'titel', coalesce(r3."Rezeptname", p."Produktname", w."Titel"), 'kcal_portion', r3."Kcal_Portion")
             order by w."Datum", array_position(array['Frühstück','Mittag','Abendessen','Snack'], w."Slot"), w."Reihenfolge")
      into v_p
      from public."Wochenplan" w
      left join public."Rezepte" r3 on r3."Rezept_ID" = w."Rezept_ID"
      left join public."Produkte" p on p."Produkt_ID" = w."Produkt_ID"
     where w."Benutzer_ID" = k.benutzer_id and w."Datum" between greatest(v_wv, k.daten_ab) and v_wv + 13;
    r := (r - 'wochenplan_hinweis') || jsonb_build_object('wochenplan', coalesce(v_p, '[]'::jsonb), 'wochenplan_von', v_wv);
  else
    r := r || jsonb_build_object('wochenplan', null,
           'wochenplan_hinweis', 'Der Wochenplan wird sichtbar, sobald die Person der Einwilligung mit Wochenplan zugestimmt hat (auf root-index.de/klientin.html).');
  end if;
  return r;
end $f$;
revoke all on function public.cb_fp_klient_dashboard(text, date, date) from public, anon;
grant execute on function public.cb_fp_klient_dashboard(text, date, date) to authenticated;
