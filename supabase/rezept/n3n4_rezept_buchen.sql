-- N3 + N4 „Was koche ich?“ / Rezept im Tagebuch (Ralph 13.11.2026 „Ja, so bauen“).
-- N3: neue Funktion cb_rezept_nicht_gebucht – listet die Zutaten, die beim Buchen NICHT ins
--     Tagebuch gehen (kein Produkt zugeordnet oder kein Gewicht). Gleiche Regel wie in
--     cb_tb_rezept_buchen (Produkt_ID not null und Menge_g > 0).
-- N4: cb_tb_rezept_buchen schrieb „1.0# Portion“ (to_char-Muster 'FM999990.0#', „#“ ist dort
--     kein Platzhalter). Jetzt „1 Portion“, „1,5 Portionen“. Bestehende Zeilen mit „#“ reparieren.
-- Sicherungen in shadow_v1 (nicht lesbar für anon/authenticated). Rückweg: n3n4_rueckweg.sql.
-- Probelauf: diese Datei + n3n4_test.sql in EINEM Aufruf (Test endet immer mit Fehler = zurückgerollt).

-- 0) Sicherungen ---------------------------------------------------------------------------------
create table if not exists shadow_v1._sich_fn_n4_rezept_buchen_20261113 as
  select p.proname::text as name, pg_get_functiondef(p.oid) as def, now() as gesichert_am
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'cb_tb_rezept_buchen';
create table if not exists shadow_v1._sich_n4_rezept_menge_20261113 as
  select "Eintrag_ID", "Rezept_Menge", now() as gesichert_am
  from public."Ernaehrungstagebuch" where "Rezept_Menge" like '%#%';
revoke all on shadow_v1._sich_fn_n4_rezept_buchen_20261113 from anon, authenticated;
revoke all on shadow_v1._sich_n4_rezept_menge_20261113 from anon, authenticated;

-- 1) N3: Zutaten, die nicht gebucht werden ---------------------------------------------------------
create or replace function public.cb_rezept_nicht_gebucht(p_rezept text)
 returns table(reihenfolge numeric, zutat text, menge text, grund text)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select rp."Reihenfolge",
         coalesce(nullif(trim(rp."Zutat_Text"), ''), 'Zutat'),
         nullif(trim(coalesce(rp."Menge_Anzeige", case when rp."Menge_g" > 0 then round(rp."Menge_g")::text || ' g' end, '')), ''),
         case when rp."Produkt_ID" is null then 'nicht zugeordnet' else 'ohne Gewicht' end
  from public."Rezept_Produkte" rp
  where rp."Rezept_ID" = p_rezept
    and (rp."Produkt_ID" is null or rp."Menge_g" is null or rp."Menge_g" <= 0)
  order by rp."Reihenfolge";
$function$;
revoke all on function public.cb_rezept_nicht_gebucht(text) from public, anon;
grant execute on function public.cb_rezept_nicht_gebucht(text) to authenticated, service_role;

-- 2) N4: Portionen richtig schreiben ---------------------------------------------------------------
create or replace function public._rezept_portion_txt(p numeric)
 returns text language sql immutable set search_path to 'public'
as $function$
  select replace(rtrim(to_char(round(p, 2), 'FM999990.99'), '.'), '.', ',')
         || case when round(p, 2) = 1 then ' Portion' else ' Portionen' end;
$function$;
revoke all on function public._rezept_portion_txt(numeric) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cb_tb_rezept_buchen(p_mahlzeit text, p_rezept text, p_datum date, p_portionen numeric DEFAULT NULL::numeric, p_gramm numeric DEFAULT NULL::numeric)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_bid text; v_name text; v_p numeric; v_w numeric; v_fak numeric; v_batch text; v_menge text;
        r record; v_g numeric; v_added int:=0;
begin
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id=auth.uid();
  if v_bid is null then raise exception 'Nicht angemeldet.'; end if;
  select "Rezeptname", coalesce("Portionen",1) into v_name, v_p from public."Rezepte" where "Rezept_ID"=p_rezept;
  if v_name is null then raise exception 'Rezept nicht gefunden.'; end if;
  select sum("Menge_g") into v_w from public."Rezept_Produkte"
    where "Rezept_ID"=p_rezept and "Produkt_ID" is not null and "Menge_g" is not null;
  if p_gramm is not null and p_gramm>0 then
    if v_w is null or v_w<=0 then raise exception 'Fuer die Gramm-Buchung fehlen Zutaten mit Gewicht.'; end if;
    v_fak := p_gramm / v_w;
    v_menge := round(p_gramm)::text||' g';
  else
    if p_portionen is null or p_portionen<=0 then p_portionen := 1; end if;
    v_fak := p_portionen / greatest(v_p,1);
    v_menge := public._rezept_portion_txt(p_portionen);   -- N4 13.11.2026: war to_char(…,'FM999990.0#') → „1.0# Portion“
  end if;
  v_batch := 'RB'||replace(gen_random_uuid()::text,'-','');
  for r in select "Produkt_ID","Menge_g" from public."Rezept_Produkte" where "Rezept_ID"=p_rezept order by "Reihenfolge" loop
    v_g := case when r."Menge_g" is not null then round(r."Menge_g"*v_fak) else null end;
    if r."Produkt_ID" is not null and v_g is not null and v_g>0 then
      insert into public."Ernaehrungstagebuch"("Benutzer_ID","Datum","Mahlzeit","Produkt_ID","Menge_g","Notiz","Rezept_Batch","Rezept_ID","Rezept_Menge")
      values (v_bid,p_datum,p_mahlzeit,r."Produkt_ID",v_g,'aus Rezept: '||v_name,v_batch,p_rezept,v_menge);
      v_added := v_added+1;
    end if;
  end loop;
  if v_added=0 then raise exception 'Dieses Rezept hat keine mit dem Katalog verknuepften Zutaten mit Gewicht - es kann noch nicht als Naehrwert gebucht werden.'; end if;
  return v_batch;
end; $function$;

-- 3) N4: bestehende Zeilen reparieren („1.0# Portion“ → „1 Portion“, „2.0# Portionen“ → „2 Portionen“)
update public."Ernaehrungstagebuch" e
   set "Rezept_Menge" = public._rezept_portion_txt(substring(e."Rezept_Menge" from '^([0-9]+(?:\.[0-9]+)?)#')::numeric)
 where e."Rezept_Menge" ~ '^[0-9]+(\.[0-9]+)?# Portion(en)?$';
