-- Scan in 5 s, Hebel 5 (Ralph „und 5“, 19.11.2026): fehlende Naehrwerte beim Foto-Scan sofort aus dem Netz.
-- Fehlen nach dem Etikettfoto Kalorien, Eiweiss, Kohlenhydrate oder Fett, uebernimmt der Scan-Worker (v23) VOR dem
-- Abschluss die erste vollstaendige Quelle mit Barcode-Beweis (EDEKA LMIV, dm, Open Food Facts, Codecheck - in dieser
-- Reihenfolge, abgefragt ueber riki2 nur_quellen, parallel ~0,6 s) ohne Sperr-Befund (Atwater, Zucker > KH,
-- Portionsfalle, Bruehe wie verkauft ...). Weicht die kcal einer Quelle vom Foto um mehr als 15 % (mind. 15 kcal) ab,
-- wird sie uebersprungen (anderes Produkt/andere Sorte). Eingetragen wie der OFF-Weg (cb_off_naehrwerte_eins) ueber
-- cb_produkt_ingest mit Quellenangabe und Quelle_Typ; Protokoll in product_source_retrieval_attempt.
-- Ruecksprung: drop function public.cb_riki_scan_naehrwerte_luecke(bigint, jsonb); Worker v23 ruft sie dann ins Leere
-- (Fehler wird abgefangen, Ablauf wie vorher).

create or replace function public.cb_riki_scan_naehrwerte_luecke(p_job_id bigint, p_quellen jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'shadow_v1'
as $function$
declare j record; n record; q jsonb; v_nw jsonb; v_wahl jsonb; v_typ text; v_name text; r jsonb; v_grund jsonb := '[]'::jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Nur Service-Workflow.'; end if;
  select jj.produkt_id, regexp_replace(coalesce(p."EAN_GTIN",''),'\D','','g') ean, p."Produktstatus" ps into j
    from shadow_v1.riki_scan_job jj join public."Produkte" p on p."Produkt_ID" = jj.produkt_id where jj.job_id = p_job_id;
  if j.produkt_id is null then return jsonb_build_object('ergebnis','kein_job'); end if;
  if j.ps <> 'Entwurf' then return jsonb_build_object('ergebnis','nicht_entwurf','produktstatus',j.ps); end if;
  if length(j.ean) not in (8,12,13,14) then return jsonb_build_object('ergebnis','ohne_ean'); end if;

  select * into n from public."Naehrwerte_Makro" where "Produkt_ID" = j.produkt_id;
  if n."kcal_100g_ml" is not null and n."Protein_g_100g_ml" is not null and n."Kohlenhydrate_g_100g_ml" is not null and n."Fett_g_100g_ml" is not null then
    return jsonb_build_object('ergebnis','nicht_noetig');
  end if;

  for q in select x from jsonb_array_elements(coalesce(p_quellen,'[]'::jsonb)) x
            order by case x->>'quelle' when 'edeka-lmiv' then 1 when 'dm' then 2 when 'openfoodfacts' then 3 else 4 end loop
    v_nw := q->'naehrwerte';
    if coalesce(q->>'ergebnis','') <> 'treffer' or coalesce(q->>'ean_beweis','') = '' or v_nw is null or jsonb_typeof(v_nw) <> 'object' then continue; end if;
    if not (jsonb_typeof(v_nw->'kcal')='number' and jsonb_typeof(v_nw->'protein')='number' and jsonb_typeof(v_nw->'kh')='number' and jsonb_typeof(v_nw->'fett')='number') then
      v_grund := v_grund || jsonb_build_object(q->>'quelle','unvollstaendig'); continue;
    end if;
    if exists (select 1 from jsonb_array_elements(coalesce(q->'befunde','[]'::jsonb)) b where coalesce((b->>'sperrt')::boolean,false)) then
      v_grund := v_grund || jsonb_build_object(q->>'quelle','gesperrt'); continue;
    end if;
    if n."kcal_100g_ml" is not null and abs(n."kcal_100g_ml" - (v_nw->>'kcal')::numeric) > greatest(15, 0.15 * n."kcal_100g_ml") then
      v_grund := v_grund || jsonb_build_object(q->>'quelle','kcal_weicht_vom_foto_ab'); continue;
    end if;
    v_wahl := q; exit;
  end loop;
  if v_wahl is null then return jsonb_build_object('ergebnis','keine_quelle','gruende',v_grund); end if;

  v_typ := case when v_wahl->>'quelle' = 'openfoodfacts' then 'OpenFoodFacts' else 'Amazon/Haendler' end;
  v_name := case v_wahl->>'quelle' when 'edeka-lmiv' then 'EDEKA LMIV' when 'dm' then 'dm' when 'openfoodfacts' then 'Open Food Facts' else 'Codecheck' end;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  r := public.cb_produkt_ingest(jsonb_build_object('produkt_id', j.produkt_id, 'basis', '100g',
         'naehrwerte', (v_wahl->'naehrwerte') - 'kj',
         'quelle', v_name||' (EAN '||j.ean||'), Scan-Luecke nach Etikettfoto', 'quelle_typ', v_typ), false);
  insert into shadow_v1.product_source_retrieval_attempt(product_id,source_family,retrieval_kind,source_ref,attempt_status,detail,evidence)
  values (j.produkt_id, case when v_wahl->>'quelle' in ('dm','edeka-lmiv') then 'haendler' else 'external_structured' end,'trusted_structured', v_wahl->>'quelle','success','Naehrwerte je 100 g nach Etikettfoto-Luecke (Scan in 5 s)',
          jsonb_build_object('abrufweg','scan_luecke','ean',j.ean,'job_id',p_job_id,'naehrwerte',v_wahl->'naehrwerte','url',v_wahl->>'url','ean_beweis',v_wahl->>'ean_beweis'));
  return jsonb_build_object('ergebnis','uebernommen','quelle',v_wahl->>'quelle','gruende',v_grund,'ingest',r);
end $function$;

revoke all on function public.cb_riki_scan_naehrwerte_luecke(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.cb_riki_scan_naehrwerte_luecke(bigint, jsonb) to service_role;
