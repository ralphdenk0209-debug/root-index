-- N10/N11 (14.11.2026, Ralph „jaja … der takt muss bei scans sofort laufen! … noGo!“)
--
-- N10: Riki meldet bei einer Zutatenliste ohne Zusatzstoffe status „keine“ und text "".
--      cb_produkt_ingest schreibt die Zusatzstoff-Zeile nur bei nicht leerem Text, die Achse
--      fehlte bis zum Takt w655 (alle 15 Minuten). Fall: Ralphs Dinkel-Spaghetti P96673.
--      Jetzt leitet der Sofort-Weg die Achse für genau dieses Produkt sofort ab, mit derselben
--      Regel wie der Takt (#655 Ralph A 09.09.2026: aus vollständig gebundener Zutatenliste).
--      Der Takt bleibt als Netz.
-- N11: Etikett „Zucker <0,5 g“ wurde leer gespeichert, die Nährwert-Achse fehlte
--      (Hähnchenbrust ja! P96672). riki-etikett liefert jetzt die Zahl ohne Zeichen und
--      naehrwerte_100g.kleiner_als ["zucker"]; der Eingang schreibt daraus
--      Naehrwerte_Makro.Vergleichsoperatoren {"Zucker_g_100g_ml":"<"} wie bisherige Fälle.

-- Sicherungen der geänderten Funktionen
create table if not exists shadow_v1._sich_fn_n10n11_20261114 as
select p.proname, pg_get_functiondef(p.oid) def, now() gesichert_am
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('cb_produkt_sofort_durchlauf','cb_scan_zutaten_stapel_takt','cb_produkt_ingest');

-- 1) Zusatzstoff-Achse für EIN Produkt ableiten (Logik wie cb_zusatzstoff_achse_ableiten_takt)
create or replace function shadow_v1.zusatzstoff_achse_ableiten_eins(p_id text)
returns jsonb language plpgsql security definer set search_path to 'public','shadow_v1' as $f$
declare v_treffer boolean;
begin
  if exists (select 1 from public."Zusatzstoffe" z where z."Produkt_ID"=p_id) then
    return jsonb_build_object('status','vorhanden'); end if;
  if not exists (select 1 from public."Produkte" p where p."Produkt_ID"=p_id and p."Produktstatus" in ('Entwurf','Aktiv')) then
    return jsonb_build_object('status','produktstatus'); end if;
  if not exists (select 1 from public."Produkt_Zutaten" pz where pz."Produkt_ID"=p_id) then
    return jsonb_build_object('status','keine_zutaten'); end if;
  if not exists (select 1 from public."Zutaten_Rohtext" z where z."Produkt_ID"=p_id and coalesce(btrim(z."Zutatenliste_Rohtext"),'')<>'') then
    return jsonb_build_object('status','kein_rohtext'); end if;
  if exists (select 1 from shadow_v1.v_active_product_ingredient_repair_open o where o."Produkt_ID"=p_id) then
    return jsonb_build_object('status','zutaten_offen'); end if;
  select exists (
    select 1 from shadow_v1.v_product_ingredient_all_resolution x
    join lateral public.cb_zusatz_stamm_treffer(coalesce(x.canonical_name, x.sichtbarer_name)) st on true
    where x."Produkt_ID"=p_id and coalesce(x.canonical_name, x.sichtbarer_name) is not null
  ) into v_treffer;
  insert into public."Zusatzstoffe"("Zusatzstoff_ID","Produkt_ID","Zusatzstoffe_Status","Quelle_Status","Kommentar")
  values ('ZS-'||p_id, p_id,
    case when v_treffer then 'enthalten laut Zutatenliste (Stamm-Abgleich)' else 'keine laut Zutatenliste (Stamm-Abgleich, kein Zusatzstoff-Fund)' end,
    'abgeleitet aus gebundenen Zutaten (Sofort-Weg), '||to_char(now(),'YYYY-MM-DD'),
    '#655 Ralph-Entscheid A 09.09.2026; N10 14.11.2026: sofort beim Scan statt Takt.')
  on conflict do nothing;
  return jsonb_build_object('status', case when v_treffer then 'enthalten' else 'keine' end);
end $f$;
revoke all on function shadow_v1.zusatzstoff_achse_ableiten_eins(text) from public, anon, authenticated;

-- 2) Sofort-Weg und Stapel-Takt rufen sie vor der Freigabe auf; 3) Eingang schreibt „<“
do $do$
declare d text; n text;
begin
  -- 2a) cb_produkt_sofort_durchlauf
  d := pg_get_functiondef('public.cb_produkt_sofort_durchlauf'::regproc);
  n := replace(d, 'r_stapel jsonb; v_f text;', 'r_stapel jsonb; r_zus jsonb; v_f text;');
  n := replace(n, '  t1 := clock_timestamp(); v_ms_ref :=',
    '  /* N10 14.11.2026 (Ralph jaja): Zusatzstoff-Achse sofort ableiten, nicht auf Takt w655 warten. */'||chr(10)||
    '  begin r_zus := shadow_v1.zusatzstoff_achse_ableiten_eins(p_id); exception when others then r_zus := jsonb_build_object(''fehler'',sqlerrm); end;'||chr(10)||
    '  t1 := clock_timestamp(); v_ms_ref :=');
  n := replace(n, '''zutaten_stapel'', r_stapel,', '''zutaten_stapel'', r_stapel, ''zusatzstoffe'', r_zus,');
  if n = d or (length(n) - length(d)) < 250 then raise exception 'N10: sofort_durchlauf nicht wie erwartet ersetzt'; end if;
  execute n;

  -- 2b) cb_scan_zutaten_stapel_takt
  d := pg_get_functiondef('public.cb_scan_zutaten_stapel_takt'::regproc);
  n := replace(d, '        update public."Produkte" set "Freigabe_Status"=''ENTWURF'' where "Produkt_ID"=r.product_id and "Freigabe_Status"=''BLOCKIERT_RIKI'';',
    '        begin perform shadow_v1.zusatzstoff_achse_ableiten_eins(r.product_id); exception when others then null; end; /* N10 14.11.2026 */'||chr(10)||
    '        update public."Produkte" set "Freigabe_Status"=''ENTWURF'' where "Produkt_ID"=r.product_id and "Freigabe_Status"=''BLOCKIERT_RIKI'';');
  if n = d then raise exception 'N10: stapel_takt nicht ersetzt'; end if;
  execute n;

  -- 3) cb_produkt_ingest: Vergleichsoperatoren aus naehrwerte.kleiner_als
  d := pg_get_functiondef('public.cb_produkt_ingest'::regproc);
  n := replace(d, '"Notizen_Naehrwerte","Mehrfach_unges_Fett_g_100g_ml")',
                  '"Notizen_Naehrwerte","Mehrfach_unges_Fett_g_100g_ml","Vergleichsoperatoren")');
  n := replace(n, 'v_alt_notiz, v_alt_mufa);',
    'v_alt_notiz, v_alt_mufa,'||chr(10)||
    '        /* N11 14.11.2026 (Ralph jaja): Etikett „<0,5 g“ -> Zahl + Operator „<“ */'||chr(10)||
    '        coalesce((select jsonb_object_agg(m.col, ''<'') from jsonb_array_elements_text(case when jsonb_typeof(p->''naehrwerte''->''kleiner_als'')=''array'' then p->''naehrwerte''->''kleiner_als'' else ''[]''::jsonb end) k(f)'||chr(10)||
    '          join (values (''zucker'',''Zucker_g_100g_ml''),(''salz'',''Salz_g_100g_ml''),(''fett'',''Fett_g_100g_ml''),(''ges_fett'',''Ges_Fett_g_100g_ml''),(''kh'',''Kohlenhydrate_g_100g_ml''),(''protein'',''Protein_g_100g_ml''),(''ballaststoffe'',''Ballaststoffe_g_100g_ml''),(''polyole'',''Polyole_g_100g_ml'')) m(f,col) using (f)), ''{}''::jsonb));');
  if n = d or (length(n) - length(d)) < 400 then raise exception 'N11: ingest nicht wie erwartet ersetzt'; end if;
  execute n;
end $do$;
