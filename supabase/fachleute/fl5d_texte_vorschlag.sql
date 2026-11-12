-- =====================================================================
-- FL-5d (12.11.2026): Texte im Plan-Vorschlag kürzer und neutral (Teil B der FL-5-Textrunde).
-- Setzt fl5b_snacks_vorschlag.sql voraus (live, mit Akte-Stichworten: Migration fl5b_vorschlag_akte_stichworte).
-- NUR TEXTE: gleiche Funktionen, gleiche Signaturen, gleiche Logik. Rechte bleiben (create or replace).
-- Gegenüberstellung: iCloud Projekte/Root Index/Fachleute/FL5-TeilB-Texte-zur-Pruefung.md
-- Danach prüfen: fl5b_test.sql (30 Prüfungen) und fl5d_test.sql.
-- NOCH NICHT EINGESPIELT – nur nach Ralphs jaja für die Datenbank.
-- =====================================================================

create or replace function public._fl5_vorschlag(p_benutzer text, p_fp_bid text, p_von date, p_bis date, p_opt jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare
  v_muster boolean := public._fl_muster_ist(p_benutzer);
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_unv text[]; v_form text; v_diab text; v_ziel numeric; v_ziel_her text;
  v_opt jsonb := coalesce(p_opt, '{}'::jsonb);
  v_seed int := coalesce(nullif(v_opt->>'seed', '')::int, 0);
  v_plaetze jsonb := coalesce(v_opt->'plaetze', '["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen"]'::jsonb);
  v_ein jsonb := '[]'::jsonb; v_rez_ids text[]; r jsonb; v_beachtet text[] := '{}'; v_hinweise text[] := '{}';
  v_ist_daten boolean;
  v_sw text[]; v_sw_ja text[] := '{}'; v_sw_rest text[] := '{}'; v_w text;
begin
  if p_von is null or p_bis is null or p_bis < p_von or p_bis - p_von > 41 then
    raise exception 'Der Zeitraum passt nicht. Höchstens 6 Wochen.'; end if;
  if v_muster then
    select m."Unvertraeglichkeiten", m."Ernaehrungsform", m."Diabetes_Typ" into v_unv, v_form, v_diab
      from public.fl_muster_klient m where m.benutzer_id = p_benutzer;
  else
    select b."Unvertraeglichkeiten", b."Ernaehrungsform", b."Diabetes_Typ" into v_unv, v_form, v_diab
      from public."Benutzer" b where b."Benutzer_ID" = p_benutzer;
  end if;
  v_unv := coalesce(v_unv, '{}');
  -- FL-4-Akte: Diagnose-Stichworte der Fachperson (Muster: aus fl_muster_klient). Nur eindeutige Stichworte
  -- wirken (Diabetes, Laktose, Zöliakie/Gluten, vegan/vegetarisch); alle anderen werden nur angezeigt.
  v_sw := coalesce(public._fl_akte_stichworte(p_benutzer, auth.uid()), '{}');
  foreach v_w in array v_sw loop
    continue when nullif(trim(v_w), '') is null;
    if v_w ~* '^\s*(kein|keine|ohne|nicht|v\.\s*a\.|verdacht)' then v_sw_rest := v_sw_rest || v_w;
    elsif v_w ~* 'diabet' then
      if nullif(v_diab, '') is null then v_diab := 'laut Akte'; end if; v_sw_ja := v_sw_ja || v_w;
    elsif v_w ~* 'laktose' then
      if not 'laktose' = any(v_unv) then v_unv := v_unv || 'laktose'::text; end if; v_sw_ja := v_sw_ja || v_w;
    elsif v_w ~* 'z(ö|oe)liakie|gluten' then
      if not 'gluten' = any(v_unv) then v_unv := v_unv || 'gluten'::text; end if; v_sw_ja := v_sw_ja || v_w;
    elsif v_w ~* '^\s*vegan' then
      if v_form is null or v_form not ilike 'vegan%' then v_form := 'vegan'; end if; v_sw_ja := v_sw_ja || v_w;
    elsif v_w ~* '^\s*vegetar' then
      if v_form is null or v_form not ilike 'veg%' then v_form := 'vegetarisch'; end if; v_sw_ja := v_sw_ja || v_w;
    else v_sw_rest := v_sw_rest || v_w; end if;
  end loop;
  v_ist_daten := public.cb_auswertung_daten_ab(p_benutzer) is not null;
  if v_ist_daten then
    select s.soll, s.soll_herkunft into v_ziel, v_ziel_her
      from public.cb_auswertung_ist_soll(p_benutzer, v_heute - 28, v_heute - 1, 'gesamt') s
     where s.kennzahl = 'kcal' and s.einheit = 'kcal' limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('datum', a.datum, 'mahlzeit', a.mahlzeit, 'rezept_id', a.rezept_id,
             'produkt_id', a.produkt_id, 'menge_g', a.menge_g)), '[]'::jsonb)
      into v_ein from public.cb_auswertung_eintraege(p_benutzer, v_heute - 60, v_heute - 1) a;
  end if;
  if cardinality(v_unv) > 0 then v_beachtet := v_beachtet || ('ohne ' || array_to_string(v_unv, ', ')); end if;
  if v_form ilike 'vegan%' then v_beachtet := v_beachtet || 'vegan'::text;
  elsif v_form ilike 'vegetar%' then v_beachtet := v_beachtet || 'vegetarisch'::text; end if;
  if nullif(v_diab, '') is not null then v_beachtet := v_beachtet || 'Diabetes: weniger Zucker und Kohlenhydrate, keine Desserts'::text; end if;
  if cardinality(v_unv) > 0 then v_hinweise := v_hinweise || 'Geprüft sind die 14 Hauptallergene und Laktose, auch Spuren. Andere Unverträglichkeiten wie Fruktose oder Histamin sind nicht geprüft.'::text; end if;
  if coalesce((v_opt->>'nur_rezepte')::boolean, false) then v_beachtet := v_beachtet || 'nur Rezepte, keine Markenprodukte'::text; end if;
  if cardinality(v_sw_ja) > 0 then v_beachtet := v_beachtet || ('Akte: ' || array_to_string(v_sw_ja, ', ')); end if;
  if cardinality(v_sw_rest) > 0 then v_hinweise := v_hinweise || ('Aus der Akte nicht berücksichtigt: ' || array_to_string(v_sw_rest, ', ') || '. Selbst prüfen.'); end if;
  if v_ziel is not null then v_beachtet := v_beachtet || ('Kalorienziel ' || round(v_ziel) || ' kcal' || coalesce(' (' || case v_ziel_her when 'Vorgabe Therapeutin' then 'Praxis' when 'Ziel im Profil' then 'App' else nullif(v_ziel_her, '') end || ')', '')); end if;

  select array_agg(x."Rezept_ID") into v_rez_ids from public."Rezepte" x
   where x."Status" = 'Aktiv' and not coalesce(x."Gesperrt", false) and x."Kcal_Portion" > 0
     and (x."Benutzer_ID" is null or coalesce(x."Sichtbarkeit", 'oeffentlich') = 'oeffentlich' or (p_fp_bid is not null and x."Benutzer_ID" = p_fp_bid));

  with
  ein as materialized (select * from jsonb_to_recordset(v_ein) as e(datum date, mahlzeit text, rezept_id text, produkt_id text, menge_g numeric)),
  pl as (select (row_number() over ())::int nr, split_part(p.v, ':', 1) slot, nullif(split_part(p.v, ':', 2), '') sz
           from jsonb_array_elements_text(v_plaetze) p(v)),
  pl2 as (select pl.*, case pl.slot when 'Frühstück' then 0.25 when 'Mittag' then 0.30 when 'Abendessen' then 0.25
                          else 0.20 / greatest(1, (select count(*) from pl x where x.slot = 'Snack')) end anteil
            from pl where pl.slot in ('Frühstück','Mittag','Abendessen','Snack')),
  nur as (select (x->>'datum')::date datum, x->>'slot' slot, nullif(x->>'snack_zeit', '') sz from jsonb_array_elements(coalesce(v_opt->'nur', '[]'::jsonb)) x),
  bel as (select (x->>'datum')::date datum, x->>'slot' slot, nullif(x->>'snack_zeit', '') sz from jsonb_array_elements(coalesce(v_opt->'belegt', '[]'::jsonb)) x),
  ziele as (
    select (d.d::date - p_von)::int ti, d.d::date datum, pl2.slot, pl2.sz, pl2.nr, pl2.anteil * v_ziel kz
      from generate_series(p_von, p_bis, interval '1 day') d(d) cross join pl2
     where (not exists (select 1 from nur) or exists (select 1 from nur n where n.datum = d.d::date and n.slot = pl2.slot and n.sz is not distinct from pl2.sz))
       and not exists (select 1 from bel b where b.datum = d.d::date and b.slot = pl2.slot and b.sz is not distinct from pl2.sz)),
  alg as materialized (select * from public.cb_rezept_allergene(coalesce(v_rez_ids, '{}'))),
  idx as materialized (select * from public.cb_rezept_index(coalesce(v_rez_ids, '{}'))),
  vt  as materialized (select * from public.cb_rezept_vertraeglichkeit(coalesce(v_rez_ids, '{}'))),
  rez as materialized (
    select x."Rezept_ID" id, x."Rezeptname" name, x."Kcal_Portion" kcal, coalesce(x."Mahlzeit_Typ", '') mt,
           100.0 * coalesce(x."KH_g_Portion", 0) * 4 / nullif(x."Kcal_Portion", 0) kh_anteil,
           i.punkte, v.zucker_portion zp,
           (select count(distinct (e.datum, e.mahlzeit)) from ein e where e.rezept_id = x."Rezept_ID") mal
      from public."Rezepte" x
      left join alg a on a.rezept_id = x."Rezept_ID"
      left join idx i on i.rezept_id = x."Rezept_ID"
      left join vt v on v.rezept_id = x."Rezept_ID"
     where x."Rezept_ID" = any(coalesce(v_rez_ids, '{}'))
       and not (coalesce(a.enthaelt, '{}') && v_unv)
       and not (coalesce(a.spuren, '{}') && v_unv)                       -- Prüfer 12.11.: auch Spuren ausschließen
       and not ('laktose' = any(v_unv) and coalesce(a.laktose, 'unklar') <> 'laktosefrei')
       and not (cardinality(v_unv) > 0 and coalesce(a.unvollstaendig, true))
       and (v_form is null or v_form not ilike 'veg%'
            or (v_form ilike 'vegan%' and x."Ernaehrungsform" ilike 'vegan%')
            or (v_form ilike 'vegetar%' and (x."Ernaehrungsform" ilike 'vegan%' or x."Ernaehrungsform" ilike 'vegetar%')))),
  prod as materialized (                               -- eigene Lieblingsprodukte für Frühstück und Snacks
    select e.produkt_id id, p."Produktname" name, e.mahlzeit, count(distinct e.datum) mal,
           greatest(5, round(percentile_cont(0.5) within group (order by e.menge_g)::numeric / 5) * 5) g,
           s."Clean_Score" punkte, nm.kcal_100g_ml k100
      from ein e
      join public."Produkte" p on p."Produkt_ID" = e.produkt_id
      join public."Scores" s on s."Produkt_ID" = e.produkt_id and s."Bewertung" in ('Gut','Sehr gut')
      left join public."Naehrwerte_Makro" nm on nm."Produkt_ID" = e.produkt_id
      left join public."Produkt_Allergene" pa on pa."Produkt_ID" = e.produkt_id
     -- nur einzeln gegessene Produkte (keine Rezeptzutaten), und keine Kleinstmengen wie Gewürz oder Aufstrich
     where e.mahlzeit in ('Frühstück','Snack') and e.menge_g > 0 and e.rezept_id is null
       and not (coalesce(pa.enthaelt, '{}') && v_unv)
       and not (coalesce(pa.spuren, '{}') && v_unv)
       and not ('laktose' = any(v_unv) and coalesce(pa.laktose, 'unklar') <> 'laktosefrei')
       and not (cardinality(v_unv) > 0 and pa."Produkt_ID" is null)
       and not coalesce((v_opt->>'nur_rezepte')::boolean, false)        -- Option „nur Rezepte, keine Markenprodukte“
     group by e.produkt_id, p."Produktname", e.mahlzeit, s."Clean_Score", nm.kcal_100g_ml
    having percentile_cont(0.5) within group (order by e.menge_g) >= 50
        or coalesce(nm.kcal_100g_ml, 0) * percentile_cont(0.5) within group (order by e.menge_g) / 100 >= 50),
  kand as (                                            -- Kandidaten je Platz-Art mit Gewicht
    select z.slot, 'rezept' typ, r.id, r.name, r.kcal, null::numeric g, null::numeric k100,
           coalesce(r.punkte, 50) + 8 * ln(1 + r.mal)
             - case when nullif(v_diab, '') is not null then coalesce(r.zp, 10) + coalesce(r.kh_anteil, 50) / 2 else 0 end   -- Diabetes: weniger Zucker und KH-Anteil zuerst
             - case when z.slot = 'Snack' and r.mt ilike '%Dessert%' then 30 else 0 end gewicht,      -- Dessert nur, wenn sonst wenig da ist
           case when r.mal > 0 then 'gern gegessen' end grund
      from (select distinct slot from pl2) z join rez r on
           (z.slot = 'Frühstück' and r.mt ilike '%Frühstück%')
        or (z.slot in ('Mittag','Abendessen') and (r.mt ilike '%Mittag%' or r.mt ilike '%Abendessen%'))   -- ohne Mahlzeit-Angabe nie (Prüfer 12.11.)
        or (z.slot = 'Snack' and (r.mt ilike '%Snack%' or (r.mt ilike '%Dessert%' and nullif(v_diab, '') is null
              and (select count(*) from rez r3 where r3.mt ilike '%Snack%') + (select count(*) from prod p3 where p3.mahlzeit = 'Snack') < 3)))
              -- Dessert als Snack nur ohne Diabetes und nur, wenn es weniger als 3 andere Snacks gibt
    union all
    select z.slot, 'produkt', p.id, p.name, null, p.g, p.k100,
           coalesce(p.punkte, 50) + 8 * ln(1 + p.mal), 'gern gegessen'
      from (select distinct slot from pl2 where slot in ('Frühstück','Snack')) z join prod p on p.mahlzeit = z.slot
     -- Frühstück aus Produkten nur, wenn kein passendes Frühstücksrezept da ist
     where z.slot = 'Snack' or not exists (select 1 from rez r where r.mt ilike '%Frühstück%')),
  rang as (select k.*, row_number() over (partition by k.slot order by k.gewicht desc, k.id) rn,
                  count(*) over (partition by k.slot) n from kand k),
  wahl as (
    select z.*, k.typ, k.id, k.name, k.kcal, k.g, k.k100, k.grund, k.n
      from ziele z
      left join lateral (
        select * from rang r where r.slot = z.slot
           -- Abwechslung: jeden Tag eins weiter unter den besten (höchstens 6); Abendessen versetzt zum Mittag,
           -- Snacks je Tageszeit versetzt; seed = neu würfeln
           and r.rn = 1 + ((z.ti + v_seed
                            + case when z.slot = 'Abendessen' then (least(r.n, 6) + 1) / 2 else 0 end
                            + case z.sz when 'nachmittags' then 1 when 'abends' then 2 when 'spaet' then 3 else 0 end) % least(r.n, 6))
         limit 1) k on true)
  select jsonb_build_object(
    'ok', true, 'ziel_kcal', v_ziel, 'ziel_herkunft', v_ziel_her, 'beachtet', to_jsonb(v_beachtet),
    'eintraege', coalesce((select jsonb_agg(jsonb_build_object(
        'datum', w.datum, 'slot', w.slot, 'snack_zeit', w.sz, 'typ', w.typ,
        'rezept_id', case when w.typ = 'rezept' then w.id end, 'produkt_id', case when w.typ = 'produkt' then w.id end,
        'titel', w.name,
        'portionen', case when w.typ = 'rezept' then case when w.kz is null then 1
                          else round(greatest(0.5, least(3, round(w.kz / w.kcal * 2) / 2)), 1) end end,
        'menge_g', case when w.typ = 'produkt' then w.g end,
        'kcal_plan', case when w.typ = 'rezept' then round(w.kcal * case when w.kz is null then 1 else greatest(0.5, least(3, round(w.kz / w.kcal * 2) / 2)) end)
                          when w.typ = 'produkt' and w.k100 is not null then round(w.k100 * w.g / 100) end,
        'grund', w.grund) order by w.datum, public._fl5_platz(w.slot, w.sz))
        from wahl w where w.id is not null), '[]'::jsonb),
    'leer', coalesce((select jsonb_agg(distinct jsonb_build_object('slot', w.slot, 'snack_zeit', w.sz)) from wahl w where w.id is null), '[]'::jsonb),
    'kandidaten', (select jsonb_object_agg(x.slot, x.n) from (select slot, count(*) n from kand group by slot) x))
  into r;
  if jsonb_array_length(r->'leer') > 0 then
    v_hinweise := v_hinweise || 'Für einige Plätze passt nichts. Dort selbst wählen.'::text;
  end if;
  if not v_ist_daten then v_hinweise := v_hinweise || 'Kein freigegebenes Tagebuch. Lieblingsprodukte und Kalorienziel fehlen.'::text; end if;
  return r || jsonb_build_object('hinweise', to_jsonb(v_hinweise));
end $f$;

create or replace function public.cb_fp_plan_vorschlag(p_code text, p_von date, p_bis date, p_optionen jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); k record; v_bid text;
begin
  select * into k from public._fp_klient(p_code);                           -- wirft 42501 ohne Bindung
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  return public._fl5_vorschlag(k.benutzer_id, v_bid, p_von, p_bis, p_optionen);
end $f$;

create or replace function public.cb_fl5_muster_plan_vorschlag(p_token text, p_nr int, p_von date, p_bis date, p_optionen jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_bid text;
begin
  if not public._fl_muster_token_ok(p_token) then raise exception 'Dieser Vorschau-Link gilt nicht mehr.' using errcode = '42501'; end if;
  select benutzer_id into v_bid from public.fl_muster_klient where nr = p_nr;
  if v_bid is null or not public._fl_muster_ist(v_bid) then raise exception 'Diese Musterperson gibt es nicht.' using errcode = '42501'; end if;
  return public._fl5_vorschlag(v_bid, null, p_von, p_bis, p_optionen);
end $f$;
