-- =====================================================================
-- FL-5b (11./12.11.2026): Snack-Plätze in den Plänen der Therapeutin und
-- Plan-Vorschlag je Klient aus dem eigenen Bestand.
-- TEXTE im Plan-Vorschlag: fl5d_texte_vorschlag.sql ersetzt _fl5_vorschlag und
-- cb_fl5_muster_plan_vorschlag (nur Texte). Diese Datei nicht allein neu einspielen.
-- Setzt fl5_plaene_rezepte.sql (live, Migration 20261111200526) voraus.
-- NUR ADDITIV: eine neue Spalte, neue Funktionen; geänderte Funktionen sind
-- ausschließlich FL-5-eigene (gleiche Signatur). Wochenplan, cb_plan_woche,
-- app.js und iPhone bleiben unberührt (Slot bleibt 'Snack').
--
-- Teil A  fl5_plan_eintrag.snack_zeit (vormittags | nachmittags | abends | spaet),
--         nur bei slot = 'Snack'. Reihenfolge der Plätze:
--         Frühstück · Snack vormittags · Mittag · Snack nachmittags · Abendessen
--         · Snack abends · Spätsnack. Snack ohne Zeit = nachmittags.
--         Übernahme in den Wochenplan: Slot 'Snack', die Zeit steht im Titel.
-- Teil B  Plan-Vorschlag (_fl5_vorschlag): füllt Tage/Wochen/Monat (max. 6 Wochen)
--         aus Rezepten (öffentlich, Root Index, eigene der Fachperson) und – für
--         Frühstück und Snacks – Produkten, die die Person selbst schon isst und
--         die im Root Index „Gut“ oder „Sehr gut“ sind.
--         Beachtet: Unverträglichkeiten (Allergene je Rezept/Produkt, unvollständige
--         Angaben werden bei Unverträglichkeit ausgeschlossen), Ernährungsform,
--         Diabetes (zuckerärmere Rezepte zuerst), Kalorienziel nach FL-2 (Vorgabe >
--         Profil > Richtwert) für die Portionen, was die Person gern isst.
--         Speichert nichts – die Fachperson übernimmt, tauscht, sperrt, gibt frei.
--         Eine KI (Riki) ergänzt später über einen eigenen Einstieg, nicht hier.
-- =====================================================================

-- ---------- Teil A: Snack-Zeit ----------
alter table public.fl5_plan_eintrag add column if not exists snack_zeit text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fl5_plan_eintrag_snack_zeit_check') then
    alter table public.fl5_plan_eintrag add constraint fl5_plan_eintrag_snack_zeit_check
      check (snack_zeit is null or (slot = 'Snack' and snack_zeit in ('vormittags','nachmittags','abends','spaet')));
  end if;
end $$;

-- Reihenfolge eines Platzes (Snack ohne Zeit zählt als nachmittags)
create or replace function public._fl5_platz(p_slot text, p_snack_zeit text)
returns int language sql immutable set search_path = public as $$
  select case p_slot when 'Frühstück' then 1 when 'Mittag' then 3 when 'Abendessen' then 5
           when 'Snack' then case coalesce(p_snack_zeit, 'nachmittags') when 'vormittags' then 2 when 'nachmittags' then 4
                                  when 'abends' then 6 else 7 end
           else 9 end;
$$;

-- Plan als JSON (wie FL-5, neu: snack_zeit, Reihenfolge nach Platz, Kalorienziel für die Fachperson)
create or replace function public._fl5_plan_json(p_plan bigint, p_benutzer text, p_mit_ist boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare p public.fl5_plan; v_ver int := 0; v_heute date := (now() at time zone 'Europe/Berlin')::date;
        v_von date; v_bis date; v_ist_bis date; e jsonb; t jsonb; s jsonb; v_ist_ok boolean; v_ist jsonb := '[]'::jsonb;
        v_ziel numeric; v_ziel_her text; v_darf boolean;
begin
  select * into p from public.fl5_plan where id = p_plan;
  if p.id is null then return null; end if;
  if p.muster_benutzer is not null then v_ver := public._fl_muster_versatz(); end if;
  v_von := p.von + v_ver; v_bis := p.bis + v_ver; v_ist_bis := least(v_bis, v_heute - 1);
  v_darf := coalesce(p_mit_ist, false) and p_benutzer is not null and public.cb_auswertung_daten_ab(p_benutzer) is not null;
  v_ist_ok := v_darf and v_ist_bis >= v_von;
  if v_ist_ok then
    select coalesce(jsonb_agg(jsonb_build_object('datum', a.datum, 'mahlzeit', a.mahlzeit, 'rezept_id', a.rezept_id,
             'produkt_id', a.produkt_id, 'name', a.name, 'kcal', a.kcal)), '[]'::jsonb)
      into v_ist from public.cb_auswertung_eintraege(p_benutzer, v_von, v_ist_bis) a;
  end if;
  if v_darf then                                   -- Kalorienziel nach FL-2 (Vorgabe > Profil > Richtwert)
    select s2.soll, s2.soll_herkunft into v_ziel, v_ziel_her
      from public.cb_auswertung_ist_soll(p_benutzer, v_heute - 28, v_heute - 1, 'gesamt') s2
     where s2.kennzahl = 'kcal' and s2.einheit = 'kcal' limit 1;
  end if;
  with ist as materialized (
    select * from jsonb_to_recordset(v_ist) as i(datum date, mahlzeit text, rezept_id text, produkt_id text, name text, kcal numeric)),
  pe as (
    select x.*, x.datum + v_ver d,
           coalesce(x.titel, r."Rezeptname", pr."Produktname") anzeige, r."Bild_URL" bild,
           case when x.typ = 'rezept' then round(r."Kcal_Portion" * coalesce(x.portionen, 1))
                when x.typ = 'produkt' and x.menge_g is not null then round(nm.kcal_100g_ml * x.menge_g / 100) end kcal_plan
      from public.fl5_plan_eintrag x
      left join public."Rezepte" r on r."Rezept_ID" = x.rezept_id
      left join public."Produkte" pr on pr."Produkt_ID" = x.produkt_id
      left join public."Naehrwerte_Makro" nm on nm."Produkt_ID" = x.produkt_id
     where x.plan_id = p.id),
  st as (
    select pe.*,
      case when not v_ist_ok or pe.d > v_ist_bis then 'offen'
           when not exists (select 1 from ist i where i.datum = pe.d and i.mahlzeit = pe.slot) then 'nichts_eingetragen'
           when pe.typ = 'rezept' and exists (select 1 from ist i where i.datum = pe.d and i.mahlzeit = pe.slot and i.rezept_id = pe.rezept_id) then 'wie_geplant'
           when pe.typ = 'produkt' and exists (select 1 from ist i where i.datum = pe.d and i.mahlzeit = pe.slot and i.produkt_id = pe.produkt_id) then 'wie_geplant'
           when pe.typ = 'frei' then 'eingetragen'
           else 'anders' end status,
      case when v_ist_ok and pe.d <= v_ist_bis then
        (select jsonb_agg(distinct coalesce((select r2."Rezeptname" from public."Rezepte" r2 where r2."Rezept_ID" = i.rezept_id), i.name))
           from ist i where i.datum = pe.d and i.mahlzeit = pe.slot) end gegessen
      from pe),
  tg as (
    select gs.tag::date datum,
           (select round(sum(pe.kcal_plan)) from pe where pe.d = gs.tag::date) kcal_plan,
           case when gs.tag::date <= v_ist_bis then (select round(sum(i.kcal)) from ist i where i.datum = gs.tag::date) end kcal_ist,
           gs.tag::date <= v_ist_bis and exists (select 1 from ist i where i.datum = gs.tag::date) erfasst
      from generate_series(v_von, v_bis, interval '1 day') gs(tag))
  select (select jsonb_agg(jsonb_build_object('id', st.id, 'datum', st.d, 'slot', st.slot, 'snack_zeit', st.snack_zeit, 'typ', st.typ, 'rezept_id', st.rezept_id,
           'produkt_id', st.produkt_id, 'titel', st.anzeige, 'portionen', st.portionen, 'menge_g', st.menge_g, 'hinweis', st.hinweis,
           'bild', st.bild, 'kcal_plan', st.kcal_plan, 'status', st.status, 'gegessen', st.gegessen)
           order by st.d, public._fl5_platz(st.slot, st.snack_zeit), st.reihenfolge, st.id) from st),
         (select jsonb_build_object('eintraege_vorbei', count(*) filter (where st.status <> 'offen'),
                            'wie_geplant', count(*) filter (where st.status = 'wie_geplant'),
                            'anders', count(*) filter (where st.status = 'anders'),
                            'nichts_eingetragen', count(*) filter (where st.status = 'nichts_eingetragen')) from st),
         (select jsonb_agg(jsonb_build_object('datum', tg.datum, 'kcal_plan', tg.kcal_plan, 'kcal_ist', tg.kcal_ist, 'erfasst', tg.erfasst)
                           order by tg.datum) from tg)
    into e, s, t;
  return jsonb_build_object('id', p.id, 'titel', p.titel, 'notiz', p.notiz, 'von', v_von, 'bis', v_bis,
    'geteilt', p.geteilt_am is not null, 'geteilt_am', p.geteilt_am, 'geaendert_am', p.geaendert_am,
    'eintraege', coalesce(e, '[]'::jsonb), 'ist', case when v_ist_ok then s end, 'tage', case when v_ist_ok then t end,
    'ziel_kcal', v_ziel, 'ziel_herkunft', v_ziel_her);
end $f$;

-- Plan speichern (wie FL-5, neu: snack_zeit)
create or replace function public.cb_fp_plan_speichern(p_code text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); k record; c text := upper(trim(p_code)); v_bid text;
        v_id bigint := nullif(p_plan->>'id', '')::bigint; v_von date; v_bis date; v_titel text; x jsonb; i int := 0;
        v_d date; v_slot text; v_typ text; v_rid text; v_pid text; v_port numeric; v_g numeric; v_t text; v_sz text;
begin
  select * into k from public._fp_klient(p_code);
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  v_titel := left(trim(coalesce(p_plan->>'titel', '')), 80);
  begin v_von := (p_plan->>'von')::date; v_bis := (p_plan->>'bis')::date;
  exception when others then return jsonb_build_object('ok', false, 'grund', 'Bitte Anfang und Ende als Datum angeben.'); end;
  if v_titel = '' then return jsonb_build_object('ok', false, 'grund', 'Bitte einen Titel eingeben.'); end if;
  if v_von is null or v_bis is null or v_bis < v_von then return jsonb_build_object('ok', false, 'grund', 'Das Ende liegt vor dem Anfang.'); end if;
  if v_bis - v_von > 41 then return jsonb_build_object('ok', false, 'grund', 'Ein Plan umfasst höchstens 6 Wochen.'); end if;
  if jsonb_array_length(coalesce(p_plan->'eintraege', '[]'::jsonb)) > 400 then return jsonb_build_object('ok', false, 'grund', 'Zu viele Einträge.'); end if;
  if v_id is null then
    insert into public.fl5_plan(fachperson_auth, code, titel, notiz, von, bis)
    values (v.auth_id, c, v_titel, nullif(left(trim(coalesce(p_plan->>'notiz', '')), 1000), ''), v_von, v_bis) returning id into v_id;
  else
    update public.fl5_plan set titel = v_titel, notiz = nullif(left(trim(coalesce(p_plan->>'notiz', '')), 1000), ''),
           von = v_von, bis = v_bis, geaendert_am = now()
     where id = v_id and code = c and fachperson_auth = v.auth_id;
    if not found then return jsonb_build_object('ok', false, 'grund', 'Diesen Plan gibt es nicht.'); end if;
    delete from public.fl5_plan_eintrag where plan_id = v_id;
  end if;
  for x in select value from jsonb_array_elements(coalesce(p_plan->'eintraege', '[]'::jsonb)) loop
    i := i + 1;
    v_d := (x->>'datum')::date; v_slot := x->>'slot'; v_typ := coalesce(x->>'typ', 'rezept');
    v_rid := nullif(x->>'rezept_id', ''); v_pid := nullif(x->>'produkt_id', '');
    v_port := nullif(x->>'portionen', '')::numeric; v_g := nullif(x->>'menge_g', '')::numeric;
    v_t := nullif(left(trim(coalesce(x->>'titel', '')), 120), '');
    v_sz := case when v_slot = 'Snack' then nullif(x->>'snack_zeit', '') end;
    if v_d is null or v_d < v_von or v_d > v_bis then raise exception 'Eintrag % liegt außerhalb des Plans.', i; end if;
    if v_slot not in ('Frühstück','Mittag','Abendessen','Snack') then raise exception 'Eintrag %: unbekannte Mahlzeit.', i; end if;
    if v_sz is not null and v_sz not in ('vormittags','nachmittags','abends','spaet') then raise exception 'Eintrag %: unbekannte Snack-Zeit.', i; end if;
    if v_typ = 'rezept' then
      if not exists (select 1 from public."Rezepte" r where r."Rezept_ID" = v_rid and r."Status" = 'Aktiv' and not coalesce(r."Gesperrt", false)
                       and (r."Benutzer_ID" is null or coalesce(r."Sichtbarkeit", 'oeffentlich') = 'oeffentlich' or r."Benutzer_ID" = v_bid)) then
        raise exception 'Eintrag %: dieses Rezept lässt sich nicht einplanen (nur eigene oder öffentliche).', i; end if;
      v_pid := null; v_g := null;
    elsif v_typ = 'produkt' then
      if not exists (select 1 from public."Produkte" pr where pr."Produkt_ID" = v_pid) then raise exception 'Eintrag %: Produkt nicht gefunden.', i; end if;
      v_rid := null; v_port := null;
    elsif v_typ = 'frei' then
      if v_t is null then raise exception 'Eintrag %: bitte einen Text eingeben.', i; end if;
      v_rid := null; v_pid := null; v_port := null;
    else raise exception 'Eintrag %: unbekannte Art.', i; end if;
    insert into public.fl5_plan_eintrag(plan_id, datum, slot, snack_zeit, typ, rezept_id, produkt_id, portionen, menge_g, titel, hinweis, reihenfolge)
    values (v_id, v_d, v_slot, v_sz, v_typ, v_rid, v_pid, v_port, v_g, case when v_typ = 'frei' then v_t end,
            nullif(left(trim(coalesce(x->>'hinweis', '')), 200), ''), i);
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $f$;

-- Übernahme in den Wochenplan (wie FL-5, neu: Snack-Zeit im Titel, Slot bleibt 'Snack')
create or replace function public.cb_fl5_plan_uebernehmen(p_plan bigint, p_einkauf boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare p public.fl5_plan; v_bid text; v_heute date := (now() at time zone 'Europe/Berlin')::date;
        v_alt bigint[]; v_neu bigint[]; n int; x record; v_ein int := 0; v_meld text; j jsonb;
begin
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  if v_bid is null then raise exception 'Nicht angemeldet.'; end if;
  select pl.* into p from public.fl5_plan pl
   where pl.id = p_plan and pl.geteilt_am is not null and pl.code in (select public._fl5_meine_codes());
  if p.id is null then raise exception 'Diesen Plan gibt es nicht (mehr).' using errcode = '42501'; end if;
  select wochenplan_ids into v_alt from public.fl5_plan_uebernahme where plan_id = p.id and klient_auth = auth.uid();
  if v_alt is not null then
    delete from public."Wochenplan" where "Benutzer_ID" = v_bid and "Eintrag_ID" = any(v_alt);
  end if;
  with ins as (
    insert into public."Wochenplan"("Benutzer_ID","Datum","Slot","Typ","Rezept_ID","Produkt_ID","Menge_g","Titel","Reihenfolge")
    select v_bid, e.datum, e.slot, case when e.typ = 'rezept' then 'rezept' else 'produkt' end, e.rezept_id, e.produkt_id, e.menge_g,
           case when e.typ = 'rezept' then coalesce(r."Rezeptname", 'Rezept')
                     || case when coalesce(e.portionen, 1) <> 1 then ' (' || trim_scale(e.portionen) || ' Portionen)' else '' end
                when e.typ = 'produkt' then pr."Produktname"
                else e.titel end
           || case e.snack_zeit when 'vormittags' then ' · vormittags' when 'nachmittags' then ' · nachmittags'
                                when 'abends' then ' · abends' when 'spaet' then ' · spät' else '' end,
           public._fl5_platz(e.slot, e.snack_zeit) * 100 + e.reihenfolge
      from public.fl5_plan_eintrag e
      left join public."Rezepte" r on r."Rezept_ID" = e.rezept_id
      left join public."Produkte" pr on pr."Produkt_ID" = e.produkt_id
     where e.plan_id = p.id and e.datum >= v_heute
       and (e.typ <> 'rezept' or e.rezept_id is not null) and (e.typ <> 'produkt' or e.produkt_id is not null)
    returning "Eintrag_ID")
  select coalesce(array_agg("Eintrag_ID"), '{}') into v_neu from ins;
  n := cardinality(v_neu);
  insert into public.fl5_plan_uebernahme(plan_id, klient_auth, am, wochenplan_ids, einkauf)
  values (p.id, auth.uid(), now(), v_neu, coalesce(p_einkauf, false))
  on conflict (plan_id, klient_auth) do update set am = now(), wochenplan_ids = excluded.wochenplan_ids, einkauf = excluded.einkauf;
  if coalesce(p_einkauf, false) and n > 0 then
    for x in select e.rezept_id, sum(coalesce(e.portionen, 1)) port from public.fl5_plan_eintrag e
              where e.plan_id = p.id and e.datum >= v_heute and e.typ = 'rezept' and e.rezept_id is not null group by e.rezept_id loop
      j := public.cb_einkauf_from_rezept(x.rezept_id, x.port, null);
      v_ein := v_ein + coalesce((j->>'anzahl')::int, 0);
    end loop;
    for x in select e.produkt_id, pr."Produktname" name, sum(e.menge_g) g from public.fl5_plan_eintrag e
               join public."Produkte" pr on pr."Produkt_ID" = e.produkt_id
              where e.plan_id = p.id and e.datum >= v_heute and e.typ = 'produkt' group by e.produkt_id, pr."Produktname" loop
      perform public.cb_einkauf_add(x.name, case when x.g > 0 then round(x.g)::text || ' g' end, x.produkt_id);
      v_ein := v_ein + 1;
    end loop;
  end if;
  v_meld := case when n = 0 then 'In diesem Plan steht ab heute nichts mehr.'
                 else '✓ ' || n || ' Mahlzeit' || case when n = 1 then '' else 'en' end || ' in deinem Wochenplan'
                      || case when coalesce(p_einkauf, false) then ', ' || v_ein || ' Zeile' || case when v_ein = 1 then '' else 'n' end || ' auf der Einkaufsliste' else '' end || '.' end;
  return jsonb_build_object('ok', n > 0, 'anzahl', n, 'einkauf', v_ein, 'meldung', v_meld);
end $f$;

-- ---------- Teil B: Plan-Vorschlag ----------
-- p_benutzer: Klient (echte Benutzer_ID oder MUSTER-n), p_fp_bid: Benutzer_ID der Fachperson (eigene Rezepte) oder null.
-- p_opt: { plaetze: ["Frühstück","Snack:vormittags","Mittag","Snack:nachmittags","Abendessen","Snack:abends","Snack:spaet"],
--          seed: int (neu würfeln), nur: [{datum,slot,snack_zeit}] (nur diese Plätze), belegt: [{datum,slot,snack_zeit}] (auslassen) }
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
    raise exception 'Zeitraum ungültig (höchstens 6 Wochen).'; end if;
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
  if nullif(v_diab, '') is not null then v_beachtet := v_beachtet || 'Diabetes: weniger Zucker und Kohlenhydrat-Anteil zuerst, keine Desserts'::text; end if;
  if cardinality(v_unv) > 0 then v_hinweise := v_hinweise || 'Geprüft werden die 14 Hauptallergene und Laktose (auch Spuren); andere Unverträglichkeiten (z. B. Fruktose, Histamin) nicht.'::text; end if;
  if coalesce((v_opt->>'nur_rezepte')::boolean, false) then v_beachtet := v_beachtet || 'nur Rezepte, keine Markenprodukte'::text; end if;
  if cardinality(v_sw_ja) > 0 then v_beachtet := v_beachtet || ('aus der Akte: ' || array_to_string(v_sw_ja, ', ')); end if;
  if cardinality(v_sw_rest) > 0 then v_hinweise := v_hinweise || ('Aus der Akte, bei der Auswahl nicht automatisch berücksichtigt: ' || array_to_string(v_sw_rest, ', ') || ' – bitte selbst prüfen.'); end if;
  if v_ziel is not null then v_beachtet := v_beachtet || ('Portionen nach Kalorienziel ' || round(v_ziel) || ' kcal (' || coalesce(v_ziel_her, '') || ')'); end if;

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
           case when r.mal > 0 then 'isst sie/er gern' end grund
      from (select distinct slot from pl2) z join rez r on
           (z.slot = 'Frühstück' and r.mt ilike '%Frühstück%')
        or (z.slot in ('Mittag','Abendessen') and (r.mt ilike '%Mittag%' or r.mt ilike '%Abendessen%'))   -- ohne Mahlzeit-Angabe nie (Prüfer 12.11.)
        or (z.slot = 'Snack' and (r.mt ilike '%Snack%' or (r.mt ilike '%Dessert%' and nullif(v_diab, '') is null
              and (select count(*) from rez r3 where r3.mt ilike '%Snack%') + (select count(*) from prod p3 where p3.mahlzeit = 'Snack') < 3)))
              -- Dessert als Snack nur ohne Diabetes und nur, wenn es weniger als 3 andere Snacks gibt
    union all
    select z.slot, 'produkt', p.id, p.name, null, p.g, p.k100,
           coalesce(p.punkte, 50) + 8 * ln(1 + p.mal), 'isst sie/er gern'
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
    v_hinweise := v_hinweise || 'Für manche Plätze passt nichts aus dem Bestand – dort bitte selbst wählen oder Riki-Rezeptideen nutzen.'::text;
  end if;
  if not v_ist_daten then v_hinweise := v_hinweise || 'Ohne freigegebenes Tagebuch: keine Lieblingsprodukte und kein Kalorienziel.'::text; end if;
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
  if v_bid is null or not public._fl_muster_ist(v_bid) then raise exception 'Diesen Musterklienten gibt es nicht.' using errcode = '42501'; end if;
  return public._fl5_vorschlag(v_bid, null, p_von, p_bis, p_optionen);
end $f$;

-- ---------- Musterpläne: volle Tage mit Snacks ----------
do $muster$
declare v_a bigint; v_b bigint; d date;
begin
  select id into v_a from public.fl5_plan where muster_benutzer = 'MUSTER-1' order by id limit 1;
  select id into v_b from public.fl5_plan where muster_benutzer = 'MUSTER-2' order by id limit 1;
  if exists (select 1 from public.fl5_plan_eintrag where plan_id in (v_a, v_b) and snack_zeit is not null) then return; end if;
  update public.fl5_plan_eintrag set snack_zeit = 'nachmittags' where plan_id in (v_a, v_b) and slot = 'Snack';
  if v_a is not null then
    for d in select distinct datum from public.fl5_plan_eintrag where plan_id = v_a loop
      insert into public.fl5_plan_eintrag(plan_id, datum, slot, snack_zeit, typ, produkt_id, menge_g, reihenfolge) values
        (v_a, d, 'Snack', 'vormittags', 'produkt', 'P195', 120, 5),           -- Banane
        (v_a, d, 'Snack', 'abends', 'produkt', 'P50849', 150, 6);             -- Skyr Natur
    end loop;
  end if;
  if v_b is not null then
    for d in select distinct datum from public.fl5_plan_eintrag where plan_id = v_b loop
      insert into public.fl5_plan_eintrag(plan_id, datum, slot, snack_zeit, typ, produkt_id, menge_g, reihenfolge) values
        (v_b, d, 'Snack', 'vormittags', 'produkt', 'P281', 150, 5),           -- Tomate
        (v_b, d, 'Snack', 'abends', 'produkt', 'P292', 150, 6);               -- Gurke
    end loop;
  end if;
end $muster$;

-- ---------- Rechte ----------
do $$ declare f text; begin
  foreach f in array array['public._fl5_vorschlag(text, text, date, date, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  execute 'revoke all on function public._fl5_platz(text, text) from public, anon';
  execute 'grant execute on function public._fl5_platz(text, text) to authenticated';
  execute 'revoke all on function public.cb_fp_plan_vorschlag(text, date, date, jsonb) from public, anon';
  execute 'grant execute on function public.cb_fp_plan_vorschlag(text, date, date, jsonb) to authenticated';
  execute 'revoke all on function public.cb_fl5_muster_plan_vorschlag(text, integer, date, date, jsonb) from public';
  execute 'grant execute on function public.cb_fl5_muster_plan_vorschlag(text, integer, date, date, jsonb) to anon, authenticated';
end $$;
