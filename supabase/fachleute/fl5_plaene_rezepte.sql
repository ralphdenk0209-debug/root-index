-- =====================================================================
-- FL-5 Ernährungspläne, Rezepte teilen, (Berichte) – 11.11.2026
-- Setzt voraus: FL-1, FL-2, FL-4 (live) und fl4_muster_fachleute.sql.
--
-- Teil A  Bindung: _fl5_bindung_ok(code) = Key läuft + Einwilligung erteilt,
--         nicht widerrufen + Fachperson aktiv, Lizenz und Vertrag ok.
--         Alles hier hängt an dieser einen Prüfung. Endet die Bindung,
--         sind Teilen und Pläne sofort weg (kein Takt nötig).
-- Teil B  Rezepte teilen: Freigabe je Rezept und Key (fl5_rezept_freigabe).
--         Mitbearbeiten nur bei eigenen Rezepten der Fachperson. Klient kann
--         eine eigene Kopie anlegen, die bleibt.
--         Geändert (vom Live-Stand aus, markiert „FL-5“): cb_rezepte_list,
--         _cb_rezept_zugang, cb_rezept_darf_bearbeiten, cb_rezept_anlegen.
-- Teil C  Ernährungspläne der Fachperson (fl5_plan, fl5_plan_eintrag):
--         Tage/Wochen mit Mahlzeiten aus Rezepten, Produkten oder Freitext.
--         Klient sieht geteilte Pläne, übernimmt sie in seinen Wochenplan,
--         auf Wunsch direkt auf die Einkaufsliste (cb_einkauf_from_rezept,
--         cb_einkauf_add). Ist gegen Plan aus FL-2 cb_auswertung_eintraege.
-- Teil D  Musterpraxis: zwei Beispielpläne (Anna, Bernd), nur lesen.
-- Berichte brauchen keine neue Funktion: therapeut.html druckt die
-- vorhandenen FL-4-Auswertungen (cb_fp_klient_dashboard / cb_fl_muster_dashboard).
--
-- Grundsatz wie FL-1/FL-4: Tabellen mit RLS an, keine Policies, keine Rechte
-- für anon/authenticated. Zugriff nur über die Funktionen.
-- =====================================================================

-- =====================================================================
-- Teil A: Bindung
-- =====================================================================
create or replace function public._fl5_bindung_ok(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gratis_code g
      join public.fachperson_konto f on f.auth_id = g.fachperson_auth and f.aktiv
      join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
     where g.code = upper(trim(p_code))
       and public._fp_key_laeuft(g)
       and public._fp_vertrag_ok(g.fachperson_auth)
       and public._fp_lizenz_ok(g.fachperson_auth)
       and e.einwilligung_am is not null and e.widerruf_am is null);
$$;

-- Codes, über die der angemeldete Klient gerade gebunden ist (nach FL-1 höchstens einer)
create or replace function public._fl5_meine_codes()
returns setof text language sql stable security definer set search_path = public as $$
  select g.code from public.gratis_code g
   where g.klient_auth = auth.uid() and auth.uid() is not null and public._fl5_bindung_ok(g.code);
$$;

-- =====================================================================
-- Teil B: Rezepte teilen
-- =====================================================================
create table if not exists public.fl5_rezept_freigabe (
  id              bigint generated always as identity primary key,
  rezept_id       text not null references public."Rezepte"("Rezept_ID") on delete cascade,
  code            text not null references public.gratis_code(code) on delete cascade,
  fachperson_auth uuid not null references public.fachperson_konto(auth_id) on delete cascade,
  mitbearbeiten   boolean not null default false,
  notiz           text check (notiz is null or length(notiz) <= 300),   -- z. B. „passt bei Laktoseintoleranz“
  erstellt_am     timestamptz not null default now(),
  beendet_am      timestamptz,
  unique (rezept_id, code)
);
create index if not exists fl5_rezept_freigabe_code_idx on public.fl5_rezept_freigabe(code);

-- Ernährungspläne (Teil C), hier schon angelegt, weil geteilte Pläne Rezepte sichtbar machen
create table if not exists public.fl5_plan (
  id              bigint generated always as identity primary key,
  fachperson_auth uuid references public.fachperson_konto(auth_id) on delete cascade,
  code            text references public.gratis_code(code) on delete cascade,
  muster_benutzer text references public.fl_muster_klient(benutzer_id) on delete cascade,
  titel           text not null check (length(trim(titel)) between 1 and 80),
  notiz           text check (notiz is null or length(notiz) <= 1000),
  von             date not null,
  bis             date not null,
  geteilt_am      timestamptz,                 -- null = Entwurf, Klient sieht ihn nicht
  erstellt_am     timestamptz not null default now(),
  geaendert_am    timestamptz not null default now(),
  constraint fl5_plan_zeitraum check (bis >= von and bis - von <= 41),
  constraint fl5_plan_wem check ((code is not null and fachperson_auth is not null and muster_benutzer is null)
                              or (code is null and fachperson_auth is null and muster_benutzer is not null))
);
create index if not exists fl5_plan_code_idx on public.fl5_plan(code);
create table if not exists public.fl5_plan_eintrag (
  id          bigint generated always as identity primary key,
  plan_id     bigint not null references public.fl5_plan(id) on delete cascade,
  datum       date not null,
  slot        text not null check (slot in ('Frühstück','Mittag','Abendessen','Snack')),
  typ         text not null check (typ in ('rezept','produkt','frei')),
  rezept_id   text references public."Rezepte"("Rezept_ID") on delete set null,
  produkt_id  text references public."Produkte"("Produkt_ID") on delete set null,
  portionen   numeric check (portionen is null or (portionen > 0 and portionen <= 20)),
  menge_g     numeric check (menge_g is null or (menge_g > 0 and menge_g <= 3000)),
  titel       text check (titel is null or length(titel) <= 120),
  hinweis     text check (hinweis is null or length(hinweis) <= 200),
  reihenfolge int not null default 0
);
create index if not exists fl5_plan_eintrag_idx on public.fl5_plan_eintrag(plan_id, datum);
create table if not exists public.fl5_plan_uebernahme (
  plan_id        bigint not null references public.fl5_plan(id) on delete cascade,
  klient_auth    uuid not null references auth.users(id) on delete cascade,
  am             timestamptz not null default now(),
  wochenplan_ids bigint[] not null default '{}',   -- beim erneuten Übernehmen werden genau diese ersetzt
  einkauf        boolean not null default false,
  primary key (plan_id, klient_auth)
);
do $$ declare t text; begin
  foreach t in array array['fl5_rezept_freigabe','fl5_plan','fl5_plan_eintrag','fl5_plan_uebernahme'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Rezepte, die der angemeldete Klient über seine Bindung sehen darf:
-- ausdrücklich geteilt ODER in einem geteilten Plan enthalten.
create or replace function public._fl5_geteilt_ids()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x.rid), '{}') from (
    select f.rezept_id rid from public.fl5_rezept_freigabe f
     where f.beendet_am is null and f.code in (select public._fl5_meine_codes())
    union
    select e.rezept_id from public.fl5_plan p join public.fl5_plan_eintrag e on e.plan_id = p.id
     where p.geteilt_am is not null and e.rezept_id is not null and p.code in (select public._fl5_meine_codes())) x;
$$;

-- Darf der angemeldete Klient dieses Rezept mitbearbeiten? Nur bei laufender Bindung,
-- Freigabe mit mitbearbeiten und wenn das Rezept (noch) der Fachperson dieses Keys gehört.
create or replace function public._fl5_darf_mitbearbeiten(p_rezept text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.fl5_rezept_freigabe f
      join public.gratis_code g on g.code = f.code
      join public."Rezepte" r on r."Rezept_ID" = f.rezept_id
      join public."Benutzer" bf on bf.auth_id = g.fachperson_auth and bf."Benutzer_ID" = r."Benutzer_ID"
     where f.rezept_id = p_rezept and f.mitbearbeiten and f.beendet_am is null
       and g.klient_auth = auth.uid() and public._fl5_bindung_ok(g.code));
$$;

-- ---------- geänderte gemeinsame Funktionen (Basis: Live-Stand 11.11.2026) ----------
-- _cb_rezept_zugang: + geteilte Rezepte (FL-5)
create or replace function public._cb_rezept_zugang(p_rezept text)
 returns text language plpgsql stable set search_path to 'public'
as $function$
declare
  v_bid   text;
  v_admin boolean;
  r       record;
begin
  select "Benutzer_ID", coalesce(is_admin, false) into v_bid, v_admin from public."Benutzer" where auth_id = auth.uid();
  v_admin := coalesce(v_admin, false);
  select x.* into r from public."Rezepte" x
   where x."Rezept_ID" = p_rezept
     and x."Status" = 'Aktiv'
     and (x."Benutzer_ID" is null or coalesce(x."Sichtbarkeit", 'oeffentlich') = 'oeffentlich'
          or (v_bid is not null and x."Benutzer_ID" = v_bid) or v_admin
          or x."Rezept_ID" = any(public._fl5_geteilt_ids()))                          -- FL-5
     and (not coalesce(x."Gesperrt", false) or v_admin or (v_bid is not null and x."Benutzer_ID" = v_bid))
     and (v_bid is null or x."Benutzer_ID" is null or x."Benutzer_ID" = v_bid
          or not exists (select 1 from public."Nutzer_Ausgeblendet" a
                          where a.benutzer_id = v_bid and a.ausgeblendet_id = x."Benutzer_ID"));
  if r."Rezept_ID" is null then return 'nicht_gefunden'; end if;
  if public._rezept_premium_zu(r."Frei", r."Benutzer_ID") then return 'premium'; end if;
  return 'ok';
end
$function$;

-- cb_rezept_darf_bearbeiten: + Mitbearbeiten über FL-5-Freigabe
create or replace function public.cb_rezept_darf_bearbeiten(p_rezept text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM "Benutzer" b
     WHERE b.auth_id = auth.uid()
       AND ( coalesce(b.is_admin,false)                                  -- Admin: immer
          OR b."Benutzer_ID" = (SELECT r."Benutzer_ID" FROM "Rezepte" r  -- sonst: nur eigenes
                                 WHERE r."Rezept_ID" = p_rezept) )
  ) OR public._fl5_darf_mitbearbeiten(p_rezept);                         -- FL-5: geteilt zum Mitbearbeiten
$function$;

-- cb_rezepte_list: + geteilte Rezepte, Quelle „Fachperson · Praxis“ (FL-5)
create or replace function public.cb_rezepte_list()
 returns table(id text, name text, ziel text, zeit_min numeric, portionen numeric, kcal numeric, protein numeric, kh numeric, fett numeric, zubereitung text, bild text, zutaten json, ernaehrungsform text, sichtbarkeit text, is_own boolean, quelle text, gesperrt boolean, gemeldet integer, mahlzeiten text, kategorien json)
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_bid text; v_admin boolean; v_geteilt text[];
begin
  select "Benutzer_ID", coalesce(is_admin,false) into v_bid, v_admin from public."Benutzer" where auth_id=auth.uid();
  v_admin := coalesce(v_admin,false);
  v_geteilt := public._fl5_geteilt_ids();                                                -- FL-5
  return query
    select r."Rezept_ID", r."Rezeptname", r."Ziel", r."Zubereitungszeit_Min", r."Portionen", r."Kcal_Portion",
      r."Protein_g_Portion", r."KH_g_Portion", r."Fett_g_Portion", case when public._rezept_premium_zu(r."Frei", r."Benutzer_ID") then null else r."Zubereitung" end, r."Bild_URL",
      case when public._rezept_premium_zu(r."Frei", r."Benutzer_ID") then null else
      ( select json_agg(json_build_object('name', coalesce(rp."Zutat_Text", pr."Produktname"),
            'menge', rp."Menge_Anzeige", 'menge_g', rp."Menge_g", 'produkt_id', rp."Produkt_ID",
            'clean_score', sc."Clean_Score", 'bewertung', sc."Bewertung",
            'p_zutaten', sc."Zutatenqualitaet", 'p_zusatzstoffe', sc."Zusatzstoffe_Score", 'p_nova', sc."Nova_Score", 'p_naehrwert', sc."Naehrwertqualitaet",
            'neutral', public._rezept_zutat_neutral(rp."Produkt_ID", rp."Zutat_Text")) order by rp."Reihenfolge")
        from public."Rezept_Produkte" rp
        left join public."Produkte" pr on pr."Produkt_ID"=rp."Produkt_ID"
        left join public."Scores" sc on sc."Produkt_ID"=rp."Produkt_ID"
        where rp."Rezept_ID"=r."Rezept_ID" ) end,
      r."Ernaehrungsform", coalesce(r."Sichtbarkeit",'oeffentlich'),
      (v_bid is not null and r."Benutzer_ID"=v_bid) as is_own,
      case when r."Benutzer_ID" is null or coalesce(bo.is_admin,false) then 'CleanBase'
           when r."Rezept_ID" = any(v_geteilt) and fk.auth_id is not null                  -- FL-5
             then 'Fachperson · '||coalesce(nullif(fk.praxis,''), fk.name)
           else 'Community · '||coalesce(bo."Name",'Nutzer') end as quelle,
      coalesce(r."Gesperrt",false),
      (select count(*)::int from public."Rezept_Meldungen" m where m."Rezept_ID"=r."Rezept_ID"),
      r."Mahlzeit_Typ",
      -- Kategorien: öffentlicher Stamm + EIGENE Sammlungen. Fremde Sammlungen
      -- bleiben draußen – ein privater Ordner ist privat.
      ( select json_agg(json_build_object('id', k."Kategorie_ID", 'art', k."Art", 'name', k."Name",
              'symbol', k."Symbol", 'quelle', rk."Quelle")
               order by case k."Art" when 'gericht' then 1 when 'eigenschaft' then 2
                                     when 'hauptzutat' then 3 else 4 end,
                        coalesce(k."Reihenfolge",100), k."Name")
        from public."Rezept_Kategorie" rk
        join public."Rezept_Kategorie_Stamm" k on k."Kategorie_ID"=rk."Kategorie_ID"
        where rk."Rezept_ID"=r."Rezept_ID"
          and (k."Benutzer_ID" is null or (v_bid is not null and k."Benutzer_ID"=v_bid)) )
    from public."Rezepte" r
    left join public."Benutzer" bo on bo."Benutzer_ID"=r."Benutzer_ID"
    left join public.fachperson_konto fk on fk.auth_id = bo.auth_id                        -- FL-5
    where r."Status"='Aktiv'
      and ( r."Benutzer_ID" is null
         or coalesce(r."Sichtbarkeit",'oeffentlich')='oeffentlich'
         or (v_bid is not null and r."Benutzer_ID"=v_bid)
         or v_admin
         or r."Rezept_ID" = any(v_geteilt) )                                                -- FL-5
      and ( not coalesce(r."Gesperrt",false) or v_admin or (v_bid is not null and r."Benutzer_ID"=v_bid) )
      -- 04.10.2026 (Apple 1.2): vom Nutzer ausgeblendete Autoren nicht zeigen
      and ( v_bid is null or r."Benutzer_ID" is null or r."Benutzer_ID" = v_bid
            or not exists (select 1 from public."Nutzer_Ausgeblendet" a
                            where a.benutzer_id = v_bid and a.ausgeblendet_id = r."Benutzer_ID") )
    order by (v_bid is not null and r."Benutzer_ID"=v_bid) desc, r."Rezept_ID";
end; $function$;

-- cb_rezept_anlegen: Bearbeiten auch für Mitbearbeiter (FL-5); Anlegen nach Stufe wie
-- _cb_hat_feature (Premium über Klienten-Key oder Fachperson-Konto zählt mit).
create or replace function public.cb_rezept_anlegen(p_payload jsonb)
 returns text language plpgsql security definer set search_path to 'public'
as $function$
declare v_pid text; v_g numeric; v_mg jsonb; v_zu jsonb; v_kom text; v_name text; v_bid text; v_admin boolean; v_rid text; z jsonb; i int:=0; v_ok boolean; v_meal text; v_owner text;
begin
  select "Benutzer_ID", coalesce(is_admin,false) into v_bid, v_admin from public."Benutzer" where auth_id=auth.uid();
  if v_bid is null then raise exception 'Nicht angemeldet.'; end if;
  v_admin := coalesce(v_admin,false);
  if coalesce(nullif(trim(p_payload->>'name'),''),'')='' then raise exception 'Name fehlt.'; end if;
  select string_agg(x, ',') into v_meal from jsonb_array_elements_text(coalesce(p_payload->'mahlzeiten','[]'::jsonb)) x;

  if coalesce(nullif(p_payload->>'rezept_id',''),'') <> '' then
    v_rid := p_payload->>'rezept_id';
    select "Benutzer_ID" into v_owner from public."Rezepte" where "Rezept_ID"=v_rid;
    if v_owner is null and not v_admin then raise exception 'Rezept nicht gefunden.'; end if;
    if not (v_admin or v_owner = v_bid or public._fl5_darf_mitbearbeiten(v_rid)) then        -- FL-5
      raise exception 'Keine Berechtigung, dieses Rezept zu bearbeiten.'; end if;
    update public."Rezepte" set
      "Rezeptname"=trim(p_payload->>'name'),
      "Portionen"=nullif(p_payload->>'portionen','')::numeric,
      "Kcal_Portion"=nullif(p_payload->>'kcal','')::numeric,
      "Protein_g_Portion"=nullif(p_payload->>'protein','')::numeric,
      "KH_g_Portion"=nullif(p_payload->>'kh','')::numeric,
      "Fett_g_Portion"=nullif(p_payload->>'fett','')::numeric,
      "Zubereitung"=p_payload->>'zubereitung',
      "Ziel"=p_payload->>'ziel',
      "Zubereitungszeit_Min"=nullif(p_payload->>'zeit','')::numeric,
      "Ernaehrungsform"=p_payload->>'ernaehrungsform',
      "Mahlzeit_Typ"=v_meal
    where "Rezept_ID"=v_rid;
    delete from public."Rezept_Produkte" where "Rezept_ID"=v_rid;
  else
    -- FL-5: gleiche Stufen-Regel wie überall (_cb_hat_feature), vorher nur Benutzer.tier –
    -- Klienten mit Key und Fachleute (Premium über cb_ist_premium) durften sonst nicht anlegen.
    v_ok := public._cb_hat_feature('rezepte_anlegen') or v_admin;
    if not v_ok then raise exception 'Deine Stufe darf keine Rezepte anlegen.'; end if;
    v_rid := 'RU'||replace(gen_random_uuid()::text,'-','');
    insert into public."Rezepte"("Rezept_ID","Rezeptname","Portionen","Kcal_Portion","Protein_g_Portion","KH_g_Portion","Fett_g_Portion","Zubereitung","Ziel","Zubereitungszeit_Min","Ernaehrungsform","Mahlzeit_Typ","Status","Benutzer_ID","Sichtbarkeit")
    values(v_rid, trim(p_payload->>'name'),
      nullif(p_payload->>'portionen','')::numeric, nullif(p_payload->>'kcal','')::numeric,
      nullif(p_payload->>'protein','')::numeric, nullif(p_payload->>'kh','')::numeric, nullif(p_payload->>'fett','')::numeric,
      p_payload->>'zubereitung', p_payload->>'ziel', nullif(p_payload->>'zeit','')::numeric,
      p_payload->>'ernaehrungsform', v_meal, 'Aktiv', v_bid, 'privat');
  end if;

  for z in select value from jsonb_array_elements(coalesce(p_payload->'zutaten','[]'::jsonb)) loop
    i:=i+1;
    -- 17.10.2026 (Ralph A): Server rechnet nach - Produkt zuordnen, Stueckmengen in Gramm, Riki-Hinweis in Kommentar
    v_name := nullif(trim(z->>'name'),'');
    v_pid  := nullif(z->>'produkt_id','');
    v_g    := nullif(z->>'menge_g','')::numeric;
    v_kom  := nullif(trim(z->>'hinweis'),'');
    if v_pid is null and v_name is not null then
      v_zu := public.cb_zutat_zuordnen(v_name);
      if coalesce((v_zu->>'gefunden')::boolean,false) then v_pid := v_zu->>'produkt_id'; end if;
    end if;
    if (v_g is null or v_g = 0) and coalesce(z->>'menge','') !~ '^\s*0\s*(g|ml)?\s*$' and v_name is not null then
      v_mg := public.cb_rezept_menge_gramm(v_name, z->>'menge');
      if (v_mg->>'g') is not null and (v_mg->>'g')::numeric > 0 then
        v_g := (v_mg->>'g')::numeric;
        if v_mg->>'art' = 'standardgewicht' then
          v_kom := concat_ws(' | ', v_kom, 'Standardgewicht: '||(v_mg->>'anzahl')||' × '||(v_mg->>'basis')||' ('||(v_mg->>'groesse')||') = '||(v_mg->>'g')||' g');
        end if;
      end if;
    end if;
    insert into public."Rezept_Produkte"("Rezept_Produkt_ID","Rezept_ID","Produkt_ID","Reihenfolge","Zutat_Text","Menge_g","Menge_Anzeige","Kommentar")
    values('RPU'||replace(gen_random_uuid()::text,'-',''), v_rid, v_pid, i,
      v_name, v_g,
      coalesce(nullif(z->>'menge',''), case when v_g is not null then v_g||' g' else null end), v_kom);
  end loop;
  perform public.cb_rezept_naehrwerte_neu(v_rid, true);
  return v_rid;
end; $function$;

-- ---------- Fachperson: teilen ----------
-- Rezept mit einem Klienten teilen (oder Freigabe ändern). Teilen darf sie alles, was sie
-- selbst sieht (eigene, öffentliche, Root-Index-Rezepte); Mitbearbeiten nur eigene.
create or replace function public.cb_fp_rezept_teilen(p_rezept text, p_code text, p_mitbearbeiten boolean default false, p_notiz text default null)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); k record; v_bid text; r record;
begin
  select * into k from public._fp_klient(p_code);                           -- wirft 42501 ohne Bindung
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  select * into r from public."Rezepte" x where x."Rezept_ID" = p_rezept and x."Status" = 'Aktiv' and not coalesce(x."Gesperrt", false)
     and (x."Benutzer_ID" is null or coalesce(x."Sichtbarkeit", 'oeffentlich') = 'oeffentlich' or x."Benutzer_ID" = v_bid);
  if r."Rezept_ID" is null then return jsonb_build_object('ok', false, 'grund', 'Dieses Rezept lässt sich nicht teilen (nur eigene oder öffentliche).'); end if;
  if coalesce(p_mitbearbeiten, false) and r."Benutzer_ID" is distinct from v_bid then
    return jsonb_build_object('ok', false, 'grund', 'Gemeinsam bearbeiten geht nur bei eigenen Rezepten.'); end if;
  insert into public.fl5_rezept_freigabe(rezept_id, code, fachperson_auth, mitbearbeiten, notiz)
  values (p_rezept, upper(trim(p_code)), v.auth_id, coalesce(p_mitbearbeiten, false), nullif(left(trim(coalesce(p_notiz, '')), 300), ''))
  on conflict (rezept_id, code) do update set mitbearbeiten = excluded.mitbearbeiten, notiz = excluded.notiz,
         beendet_am = null, fachperson_auth = excluded.fachperson_auth;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.cb_fp_rezept_teilen_beenden(p_rezept text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich();
begin
  update public.fl5_rezept_freigabe set beendet_am = now()
   where rezept_id = p_rezept and code = upper(trim(p_code)) and fachperson_auth = v.auth_id and beendet_am is null;
  if not found then return jsonb_build_object('ok', false, 'grund', 'Diese Freigabe gibt es nicht.'); end if;
  return jsonb_build_object('ok', true);
end $f$;

-- Für die Seite: eigene Rezepte der Fachperson + was mit diesem Klienten geteilt ist
create or replace function public.cb_fp_rezepte(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); k record; v_bid text; c text := upper(trim(p_code));
begin
  select * into k from public._fp_klient(p_code);
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  return jsonb_build_object('ok', true,
    'geteilt', coalesce((select jsonb_agg(jsonb_build_object('rezept_id', r."Rezept_ID", 'name', r."Rezeptname", 'kcal_portion', r."Kcal_Portion",
                 'bild', r."Bild_URL", 'mitbearbeiten', f.mitbearbeiten, 'notiz', f.notiz, 'seit', f.erstellt_am,
                 'eigen', r."Benutzer_ID" = v_bid) order by f.erstellt_am desc)
               from public.fl5_rezept_freigabe f join public."Rezepte" r on r."Rezept_ID" = f.rezept_id
              where f.code = c and f.fachperson_auth = v.auth_id and f.beendet_am is null), '[]'::jsonb),
    'eigene', coalesce((select jsonb_agg(jsonb_build_object('rezept_id', r."Rezept_ID", 'name', r."Rezeptname", 'kcal_portion', r."Kcal_Portion",
                 'bild', r."Bild_URL", 'sichtbarkeit', coalesce(r."Sichtbarkeit", 'oeffentlich')) order by r."Rezeptname")
               from public."Rezepte" r where r."Benutzer_ID" = v_bid and r."Status" = 'Aktiv'), '[]'::jsonb));
end $f$;

-- ---------- Klient: eigene Kopie ----------
-- Kopie eines Rezepts, das der Klient sehen darf. Die Kopie gehört ihm, ist privat und bleibt,
-- auch wenn die Bindung endet.
create or replace function public.cb_fl5_rezept_kopieren(p_rezept text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_bid text; v_rid text; v_zug text;
begin
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  if v_bid is null then raise exception 'Nicht angemeldet.'; end if;
  v_zug := public._cb_rezept_zugang(p_rezept);
  if v_zug <> 'ok' then return jsonb_build_object('ok', false, 'grund', 'Dieses Rezept ist nicht verfügbar.'); end if;
  if not (public._cb_hat_feature('rezepte_anlegen') or exists (select 1 from public."Benutzer" where auth_id = auth.uid() and is_admin)) then
    return jsonb_build_object('ok', false, 'grund', 'Deine Stufe darf keine Rezepte anlegen.'); end if;
  v_rid := 'RU' || replace(gen_random_uuid()::text, '-', '');
  insert into public."Rezepte"("Rezept_ID","Rezeptname","Ziel","Beschreibung","Kalorien_Ziel","Protein_Ziel","Status","Kommentar",
         "Zubereitungszeit_Min","Portionen","Kcal_Portion","Protein_g_Portion","KH_g_Portion","Fett_g_Portion","Zubereitung","Bild_URL",
         "Ernaehrungsform","Benutzer_ID","Sichtbarkeit","Gesperrt","Mahlzeit_Typ","Frei")
  select v_rid, r."Rezeptname", r."Ziel", r."Beschreibung", r."Kalorien_Ziel", r."Protein_Ziel", 'Aktiv', r."Kommentar",
         r."Zubereitungszeit_Min", r."Portionen", r."Kcal_Portion", r."Protein_g_Portion", r."KH_g_Portion", r."Fett_g_Portion", r."Zubereitung", r."Bild_URL",
         r."Ernaehrungsform", v_bid, 'privat', false, r."Mahlzeit_Typ", false
    from public."Rezepte" r where r."Rezept_ID" = p_rezept;
  insert into public."Rezept_Produkte"("Rezept_Produkt_ID","Rezept_ID","Produkt_ID","Reihenfolge","Menge","Einheit","Kommentar","Zutat_Text","Menge_Anzeige","Menge_g")
  select 'RPU' || replace(gen_random_uuid()::text, '-', ''), v_rid, rp."Produkt_ID", rp."Reihenfolge", rp."Menge", rp."Einheit", rp."Kommentar",
         rp."Zutat_Text", rp."Menge_Anzeige", rp."Menge_g"
    from public."Rezept_Produkte" rp where rp."Rezept_ID" = p_rezept;
  return jsonb_build_object('ok', true, 'rezept_id', v_rid);
end $f$;

-- =====================================================================
-- Teil C: Ernährungspläne
-- =====================================================================
-- Plan als JSON. p_benutzer = Benutzer_ID des Klienten (für Ist gegen Plan), p_mit_ist steuert,
-- ob das Tagebuch gelesen wird (nur Fachperson / Muster; Zugriff prüft FL-2 cb_auswertung_eintraege).
-- Planwerte (kcal) kommen aus Rezepte.Kcal_Portion × Portionen bzw. Naehrwerte_Makro × Gramm.
create or replace function public._fl5_plan_json(p_plan bigint, p_benutzer text, p_mit_ist boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare p public.fl5_plan; v_ver int := 0; v_heute date := (now() at time zone 'Europe/Berlin')::date;
        v_von date; v_bis date; v_ist_bis date; e jsonb; t jsonb; s jsonb; v_ist_ok boolean; v_ist jsonb := '[]'::jsonb;
begin
  select * into p from public.fl5_plan where id = p_plan;
  if p.id is null then return null; end if;
  if p.muster_benutzer is not null then v_ver := public._fl_muster_versatz(); end if;
  v_von := p.von + v_ver; v_bis := p.bis + v_ver; v_ist_bis := least(v_bis, v_heute - 1);
  -- Tagebuch nur, wenn gewünscht und der Aufrufer es nach FL-2 lesen darf
  v_ist_ok := coalesce(p_mit_ist, false) and p_benutzer is not null and v_ist_bis >= v_von
              and public.cb_auswertung_daten_ab(p_benutzer) is not null;
  if v_ist_ok then
    select coalesce(jsonb_agg(jsonb_build_object('datum', a.datum, 'mahlzeit', a.mahlzeit, 'rezept_id', a.rezept_id,
             'produkt_id', a.produkt_id, 'name', a.name, 'kcal', a.kcal)), '[]'::jsonb)
      into v_ist from public.cb_auswertung_eintraege(p_benutzer, v_von, v_ist_bis) a;
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
  select (select jsonb_agg(jsonb_build_object('id', st.id, 'datum', st.d, 'slot', st.slot, 'typ', st.typ, 'rezept_id', st.rezept_id,
           'produkt_id', st.produkt_id, 'titel', st.anzeige, 'portionen', st.portionen, 'menge_g', st.menge_g, 'hinweis', st.hinweis,
           'bild', st.bild, 'kcal_plan', st.kcal_plan, 'status', st.status, 'gegessen', st.gegessen)
           order by st.d, array_position(array['Frühstück','Mittag','Abendessen','Snack'], st.slot), st.reihenfolge, st.id) from st),
         (select jsonb_build_object('eintraege_vorbei', count(*) filter (where st.status <> 'offen'),
                            'wie_geplant', count(*) filter (where st.status = 'wie_geplant'),
                            'anders', count(*) filter (where st.status = 'anders'),
                            'nichts_eingetragen', count(*) filter (where st.status = 'nichts_eingetragen')) from st),
         (select jsonb_agg(jsonb_build_object('datum', tg.datum, 'kcal_plan', tg.kcal_plan, 'kcal_ist', tg.kcal_ist, 'erfasst', tg.erfasst)
                           order by tg.datum) from tg)
    into e, s, t;

  return jsonb_build_object('id', p.id, 'titel', p.titel, 'notiz', p.notiz, 'von', v_von, 'bis', v_bis,
    'geteilt', p.geteilt_am is not null, 'geteilt_am', p.geteilt_am, 'geaendert_am', p.geaendert_am,
    'eintraege', coalesce(e, '[]'::jsonb), 'ist', case when v_ist_ok then s end, 'tage', case when v_ist_ok then t end);
end $f$;

-- Fachperson: alle Pläne eines Klienten, mit Ist gegen Plan
create or replace function public.cb_fp_plaene(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); k record; c text := upper(trim(p_code));
begin
  select * into k from public._fp_klient(p_code);
  return jsonb_build_object('ok', true, 'plaene', coalesce((
    select jsonb_agg(public._fl5_plan_json(p.id, k.benutzer_id, true)
             || jsonb_build_object('uebernommen_am', (select u.am from public.fl5_plan_uebernahme u where u.plan_id = p.id))
             order by p.von desc, p.id desc)
      from public.fl5_plan p where p.code = c and p.fachperson_auth = v.auth_id), '[]'::jsonb));
end $f$;

-- Fachperson: Plan anlegen oder ändern. p_plan = {id?, titel, notiz, von, bis,
-- eintraege:[{datum, slot, typ: rezept|produkt|frei, rezept_id, produkt_id, portionen, menge_g, titel, hinweis}]}
create or replace function public.cb_fp_plan_speichern(p_code text, p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); k record; c text := upper(trim(p_code)); v_bid text;
        v_id bigint := nullif(p_plan->>'id', '')::bigint; v_von date; v_bis date; v_titel text; x jsonb; i int := 0;
        v_d date; v_slot text; v_typ text; v_rid text; v_pid text; v_port numeric; v_g numeric; v_t text;
begin
  select * into k from public._fp_klient(p_code);
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  v_titel := left(trim(coalesce(p_plan->>'titel', '')), 80);
  begin v_von := (p_plan->>'von')::date; v_bis := (p_plan->>'bis')::date;
  exception when others then return jsonb_build_object('ok', false, 'grund', 'Bitte Anfang und Ende als Datum angeben.'); end;
  if v_titel = '' then return jsonb_build_object('ok', false, 'grund', 'Bitte einen Titel eingeben.'); end if;
  if v_von is null or v_bis is null or v_bis < v_von then return jsonb_build_object('ok', false, 'grund', 'Das Ende liegt vor dem Anfang.'); end if;
  if v_bis - v_von > 41 then return jsonb_build_object('ok', false, 'grund', 'Ein Plan umfasst höchstens 6 Wochen.'); end if;
  if jsonb_array_length(coalesce(p_plan->'eintraege', '[]'::jsonb)) > 300 then return jsonb_build_object('ok', false, 'grund', 'Zu viele Einträge.'); end if;

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
    if v_d is null or v_d < v_von or v_d > v_bis then raise exception 'Eintrag % liegt außerhalb des Plans.', i; end if;
    if v_slot not in ('Frühstück','Mittag','Abendessen','Snack') then raise exception 'Eintrag %: unbekannte Mahlzeit.', i; end if;
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
    insert into public.fl5_plan_eintrag(plan_id, datum, slot, typ, rezept_id, produkt_id, portionen, menge_g, titel, hinweis, reihenfolge)
    values (v_id, v_d, v_slot, v_typ, v_rid, v_pid, v_port, v_g, case when v_typ = 'frei' then v_t end,
            nullif(left(trim(coalesce(x->>'hinweis', '')), 200), ''), i);
  end loop;
  return jsonb_build_object('ok', true, 'id', v_id);
end $f$;

create or replace function public.cb_fp_plan_teilen(p_plan bigint, p_an boolean)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich(); c text;
begin
  select code into c from public.fl5_plan where id = p_plan and fachperson_auth = v.auth_id;
  if c is null then return jsonb_build_object('ok', false, 'grund', 'Diesen Plan gibt es nicht.'); end if;
  perform public._fp_klient(c);                                              -- Bindung muss laufen
  update public.fl5_plan set geteilt_am = case when p_an then coalesce(geteilt_am, now()) end, geaendert_am = now() where id = p_plan;
  return jsonb_build_object('ok', true);
end $f$;

create or replace function public.cb_fp_plan_loeschen(p_plan bigint)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v public.fachperson_konto := public._fp_ich();
begin
  delete from public.fl5_plan where id = p_plan and fachperson_auth = v.auth_id;
  if not found then return jsonb_build_object('ok', false, 'grund', 'Diesen Plan gibt es nicht.'); end if;
  return jsonb_build_object('ok', true);   -- bereits übernommene Einträge bleiben im Wochenplan des Klienten
end $f$;

-- ---------- Klient ----------
-- Alles, was die Fachperson gerade mit mir teilt (nur bei laufender Bindung).
create or replace function public.cb_fl5_mein_bereich()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare c text; f public.fachperson_konto; v_bid text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'grund', 'Bitte zuerst anmelden.'); end if;
  select x into c from public._fl5_meine_codes() x limit 1;
  if c is null then return jsonb_build_object('ok', true, 'fachperson', null, 'plaene', '[]'::jsonb, 'rezepte', '[]'::jsonb); end if;
  select fk.* into f from public.gratis_code g join public.fachperson_konto fk on fk.auth_id = g.fachperson_auth where g.code = c;
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  return jsonb_build_object('ok', true,
    'fachperson', jsonb_build_object('name', f.name, 'praxis', f.praxis),
    'plaene', coalesce((select jsonb_agg(public._fl5_plan_json(p.id, null, false)
                         || jsonb_build_object('uebernommen_am', (select u.am from public.fl5_plan_uebernahme u where u.plan_id = p.id and u.klient_auth = auth.uid()))
                         order by p.von desc, p.id desc)
                 from public.fl5_plan p where p.code = c and p.geteilt_am is not null), '[]'::jsonb),
    'rezepte', coalesce((select jsonb_agg(jsonb_build_object('rezept_id', r."Rezept_ID", 'name', r."Rezeptname", 'kcal_portion', r."Kcal_Portion",
                          'bild', r."Bild_URL", 'notiz', fr.notiz, 'mitbearbeiten', public._fl5_darf_mitbearbeiten(r."Rezept_ID"), 'seit', fr.erstellt_am)
                          order by fr.erstellt_am desc)
                 from public.fl5_rezept_freigabe fr join public."Rezepte" r on r."Rezept_ID" = fr.rezept_id
                where fr.code = c and fr.beendet_am is null and r."Status" = 'Aktiv'), '[]'::jsonb));
end $f$;

-- Plan in den eigenen Wochenplan übernehmen (nur heute und später). Erneutes Übernehmen
-- ersetzt die beim letzten Mal eingetragenen Zeilen. p_einkauf: Zutaten und Produkte direkt
-- auf die Einkaufsliste (vorhandene Zeilen werden zusammengezählt, nichts gelöscht).
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
                else e.titel end,
           e.reihenfolge
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
    -- Rezepte: je Rezept die Summe der Portionen (FL-6 cb_einkauf_from_rezept)
    for x in select e.rezept_id, sum(coalesce(e.portionen, 1)) port from public.fl5_plan_eintrag e
              where e.plan_id = p.id and e.datum >= v_heute and e.typ = 'rezept' and e.rezept_id is not null group by e.rezept_id loop
      j := public.cb_einkauf_from_rezept(x.rezept_id, x.port, null);
      v_ein := v_ein + coalesce((j->>'anzahl')::int, 0);
    end loop;
    -- Produkte: je Produkt die Summe der Gramm (cb_einkauf_add)
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

-- =====================================================================
-- Teil D: Musterpraxis – Beispielpläne (nur lesen)
-- =====================================================================
create or replace function public.cb_fl5_muster_plaene(p_token text, p_nr int)
returns jsonb language plpgsql security definer set search_path = public as $f$
declare v_bid text;
begin
  if not public._fl_muster_token_ok(p_token) then raise exception 'Dieser Vorschau-Link gilt nicht mehr.' using errcode = '42501'; end if;
  select benutzer_id into v_bid from public.fl_muster_klient where nr = p_nr;
  if v_bid is null or not public._fl_muster_ist(v_bid) then raise exception 'Diesen Musterklienten gibt es nicht.' using errcode = '42501'; end if;
  return jsonb_build_object('ok', true, 'muster', true, 'plaene', coalesce((
    select jsonb_agg(public._fl5_plan_json(p.id, v_bid, true) || jsonb_build_object('uebernommen_am', null) order by p.von desc, p.id desc)
      from public.fl5_plan p where p.muster_benutzer = v_bid), '[]'::jsonb));
end $f$;

-- Basisdaten um den 11.11.2026 (wandern wie das Mustertagebuch wochenweise mit).
-- Anna: letzte und diese Woche (Ist gegen Plan sichtbar), Bernd: diese Woche.
do $muster$
declare v_a bigint; v_b bigint; d date;
begin
  if exists (select 1 from public.fl5_plan where muster_benutzer is not null) then return; end if;
  insert into public.fl5_plan(muster_benutzer, titel, notiz, von, bis, geteilt_am)
  values ('MUSTER-1', 'Mehr Gemüse, süßer Abend ohne Schokolade',
          'Mittags ein Rezept mit Gemüse, abends Salat zum Brot. Als Abendsnack Obst statt Schokolade.',
          date '2026-11-02', date '2026-11-15', now()) returning id into v_a;
  for d in select generate_series(date '2026-11-02', date '2026-11-15', interval '1 day')::date loop
    insert into public.fl5_plan_eintrag(plan_id, datum, slot, typ, rezept_id, produkt_id, portionen, menge_g, reihenfolge) values
      (v_a, d, 'Frühstück', case when extract(isodow from d) >= 6 then 'rezept' else 'produkt' end,
            case when extract(isodow from d) >= 6 then 'RUed019620fdae4494bb1239134b39e65e' end,
            case when extract(isodow from d) >= 6 then null else 'P50849' end, case when extract(isodow from d) >= 6 then 1 end,
            case when extract(isodow from d) >= 6 then null else 150 end, 1),
      (v_a, d, 'Mittag', 'rezept', case when extract(isodow from d) in (1,3,5) then 'RU7c4e8d2e9b604f7dbd410660d9921d0d'
                                        when extract(isodow from d) in (2,4) then 'RUed8d26e55b1e41fbb75092be7ce443ac'
                                        else 'RU5c58a0cd555247379af2000b8dbf6908' end, null, 1, null, 2),
      (v_a, d, 'Abendessen', 'produkt', null, 'P264', null, 60, 3),
      (v_a, d, 'Snack', 'produkt', null, 'P190', null, 150, 4);
  end loop;
  insert into public.fl5_plan(muster_benutzer, titel, notiz, von, bis, geteilt_am)
  values ('MUSTER-2', 'Woche 1: weniger Brot am Abend',
          'Abends warm mit Gemüse statt Brot und Wurst. Snack: Apfel. Mit Diabetologin abgestimmt.',
          date '2026-11-09', date '2026-11-15', now()) returning id into v_b;
  for d in select generate_series(date '2026-11-09', date '2026-11-15', interval '1 day')::date loop
    insert into public.fl5_plan_eintrag(plan_id, datum, slot, typ, rezept_id, produkt_id, portionen, menge_g, reihenfolge) values
      (v_b, d, 'Frühstück', 'produkt', null, 'P53326', null, 100, 1),
      (v_b, d, 'Mittag', 'produkt', null, 'P52164', null, 150, 2),
      (v_b, d, 'Abendessen', 'rezept', case when extract(isodow from d) in (1,3,5,7) then 'RUed8d26e55b1e41fbb75092be7ce443ac'
                                            else 'RUa1c57e78a1d14da5bc5fac615d754992' end, null, 1, null, 3),
      (v_b, d, 'Snack', 'produkt', null, 'P190', null, 180, 4);
    insert into public.fl5_plan_eintrag(plan_id, datum, slot, typ, produkt_id, menge_g, reihenfolge)
    values (v_b, d, 'Mittag', 'produkt', 'P294', 150, 3);
  end loop;
end $muster$;

-- =====================================================================
-- Rechte
-- =====================================================================
do $$ declare f text; begin
  foreach f in array array[
    'public._fl5_bindung_ok(text)', 'public._fl5_meine_codes()', 'public._fl5_darf_mitbearbeiten(text)',
    'public._fl5_plan_json(bigint, text, boolean)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- liefert nur Rezept-IDs, die mit dem Aufrufer geteilt sind; wird auch aus Funktionen ohne
  -- SECURITY DEFINER (_cb_rezept_zugang) erreicht
  execute 'revoke all on function public._fl5_geteilt_ids() from public, anon';
  execute 'grant execute on function public._fl5_geteilt_ids() to authenticated';
  foreach f in array array[
    'public.cb_fp_rezept_teilen(text, text, boolean, text)', 'public.cb_fp_rezept_teilen_beenden(text, text)',
    'public.cb_fp_rezepte(text)', 'public.cb_fl5_rezept_kopieren(text)',
    'public.cb_fp_plaene(text)', 'public.cb_fp_plan_speichern(text, jsonb)', 'public.cb_fp_plan_teilen(bigint, boolean)',
    'public.cb_fp_plan_loeschen(bigint)', 'public.cb_fl5_mein_bereich()', 'public.cb_fl5_plan_uebernehmen(bigint, boolean)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke all on function public.cb_fl5_muster_plaene(text, integer) from public';
  execute 'grant execute on function public.cb_fl5_muster_plaene(text, integer) to anon, authenticated';
end $$;
