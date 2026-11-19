-- 19.11.2026 (Ralph: „dashboard neu berechnen bei klick auf aktualisieren dauer fast 2 minuten …
-- beim klick sollte es sich schon etwas schneller neu rechnen“, danach „jetzt auch noch timeout“)
--
-- Gemessen: cb_mischpult_cache_bauen 31–41 s. Davon cb_admin_cockpit_lage 39,8 s, darin cb_netzplan 32,5 s.
-- cb_admin_cockpit_lage braucht aus cb_netzplan nur zufluesse, autopilot und bestand (je < 50 ms).
-- cb_netzplan rechnet zusätzlich ~35 Wächter-Sichten live, cb_takt_status und Regelwerk - für das Mischpult ungenutzt.
-- Lösung: schlanke cb_netzplan_zufluesse() mit genau diesen drei Teilen (Text 1:1 aus cb_netzplan),
-- cb_admin_cockpit_lage ruft sie statt cb_netzplan. cb_netzplan selbst bleibt unverändert (admin.html).
-- Dazu Takt mischpult-cache von jeder Minute auf alle 5 Sekunden (prüft nur, ob angefordert wurde).

create table if not exists shadow_v1._sich_fn_cockpit_lage_20261119 as
select now() gesichert_am, pg_get_functiondef('public.cb_admin_cockpit_lage()'::regprocedure) def;

create or replace function public.cb_netzplan_zufluesse()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  ap_an boolean; ap_erreichbar int; ap_unerreichbar int; ap_letzter timestamptz;
  ap_heute numeric; ap_deckel numeric; ap_alt_min int;
begin
  if not cb_ist_admin() then
    return jsonb_build_object('ok', false, 'grund', 'Nur Admins.');
  end if;

  select (coalesce(wert,'nein') = 'ja') into ap_an from "Riki_Config" where schluessel = 'autopilot_an';
  select nullif(wert,'')::numeric into ap_deckel from "Riki_Config" where schluessel = 'autopilot_tageslimit_usd';

  select count(*) into ap_erreichbar from "Scan_Warteschlange"
   where "Status" = 'offen' and "Produkt_ID" is null
     and ("Foto_Base64" is not null or "Fotos_Base64" is not null);
  select count(*) into ap_unerreichbar from "Scan_Warteschlange"
   where "Status" = 'offen' and "Produkt_ID" is null
     and "Foto_Base64" is null and "Fotos_Base64" is null;

  select max(erfasst_am) into ap_letzter from "Riki_Nutzung" where modus = 'etikett-auto';
  ap_alt_min := case when ap_letzter is null then null
                     else round(extract(epoch from (now() - ap_letzter)) / 60) end;
  select coalesce(round(sum(kosten_usd)::numeric, 2), 0) into ap_heute from "Riki_Nutzung"
   where modus in ('etikett-auto','etikett-waechter') and erfasst_am::date = current_date;

  return jsonb_build_object(
    'ok', true,
    'stand', now(),
    'zufluesse', jsonb_build_array(
      jsonb_build_object(
        'id','foto', 'name','Etikettfoto', 'was','Nutzer fotografiert ein Etikett',
        'ziel','autopilot', 'weg','auto',
        'wartend', ap_erreichbar,
        'aeltester_tage', (select max((current_date - "Erfasst_am"::date)) from "Scan_Warteschlange"
                            where "Status"='offen' and "Produkt_ID" is null
                              and ("Foto_Base64" is not null or "Fotos_Base64" is not null)),
        'hinweis','Der Autopilot liest alle 30 Minuten. Das ist der einzige Zufluss, der von allein weiterlaeuft.',
        'status_unsicher', false),
      jsonb_build_object(
        'id','barcode', 'name','Barcode-Scan (ohne Foto)', 'was','Nutzer scannt im Laden, kein Etikettfoto dabei',
        'ziel','ralph', 'weg','keiner',
        'wartend', ap_unerreichbar,
        'aeltester_tage', (select max((current_date - "Erfasst_am"::date)) from "Scan_Warteschlange"
                            where "Status"='offen' and "Produkt_ID" is null
                              and "Foto_Base64" is null and "Fotos_Base64" is null),
        'hinweis','SACKGASSE: Der Autopilot ueberspringt sie bewusst (kein Lesestoff fuer Riki), und keine andere Automatik holt sie ab.',
        'status_unsicher', true),
      jsonb_build_object(
        'id','scancache', 'name','Scan-Cache (OpenFoodFacts)', 'was','EAN war bei OFF bekannt, Werte vorlaeufig',
        'ziel','ralph', 'weg','hand',
        'wartend', (select count(*) from "Scan_Cache" where not "Geprueft" and "Produkt_ID" is null),
        'aeltester_tage', (select max((current_date - "Erfasst_am"::date)) from "Scan_Cache"
                            where not "Geprueft" and "Produkt_ID" is null),
        'hinweis','Kostenlose Vorstufe. Wird erst Katalog, wenn du sie uebernimmst — OFF ist Quelle, nicht Freigabe.',
        'status_unsicher', false),
      jsonb_build_object(
        'id','wunsch', 'name','Produktwunsch (Kontaktformular)', 'was','Nutzer meldet ein fehlendes Produkt mit EAN',
        'ziel','ralph', 'weg','keiner',
        'wartend', (select count(*) from "Kontakt_Anfragen" where typ='produkt' and status='offen'),
        'aeltester_tage', (select max((current_date - created_at::date)) from "Kontakt_Anfragen"
                            where typ='produkt' and status='offen'),
        'hinweis','Die taegliche Anreicherung, die das automatisch tat, ist seit 12.07. abgeschaltet.',
        'status_unsicher', true),
      jsonb_build_object(
        'id','tagebuch', 'name','Manuell im Tagebuch', 'was','Nutzer traegt ein Lebensmittel von Hand ein',
        'ziel','ralph', 'weg','hand',
        'wartend', (select count(*) from "Melde_Produktwunsch" where "Status"='offen'),
        'aeltester_tage', (select max((current_date - "Erstellt_am"::date)) from "Melde_Produktwunsch"
                            where "Status"='offen'),
        'hinweis','Mit Barcode entsteht seit 27.07. sofort ein Entwurf. Ohne Barcode bleibt es Freitext und wartet hier.',
        'status_unsicher', true),
      jsonb_build_object(
        'id','zutat_neu', 'name','Neue Zutat', 'was','Eine Zutat, die es im Stamm noch nicht gab',
        'ziel','wochenlauf', 'weg','auto',
        'wartend', (select count(*) from v_zutat_neu_shadow_offen),
        'aeltester_tage', (select max((current_date - "Angelegt_am"::date)) from v_zutat_neu_shadow_offen),
        'hinweis','Der Sofort-Waechter prueft bei der Anlage, der Montagslauf prueft alle nach.',
        'status_unsicher', false)
    ),
    'bestand', (
      select coalesce(jsonb_agg(jsonb_build_object('typ', coalesce(q."Quelle_Typ",'ohne Quelle'), 'anzahl', q.n)
                                order by q.n desc), '[]'::jsonb)
      from (select p."Quelle_Typ", count(*) n from "Produkte" p where p."Produktstatus"='Aktiv' group by 1) q
    ),
    'autopilot', jsonb_build_object(
      'an', coalesce(ap_an,false),
      'wartend_erreichbar', ap_erreichbar,
      'wartend_unerreichbar', ap_unerreichbar,
      'letzter_lauf', ap_letzter,
      'letzter_lauf_min', ap_alt_min,
      'heute_usd', ap_heute,
      'tageslimit_usd', ap_deckel
    )
  );
end $function$;

revoke all on function public.cb_netzplan_zufluesse() from public, anon;
grant execute on function public.cb_netzplan_zufluesse() to authenticated, service_role;

create or replace function public.cb_admin_cockpit_lage()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'shadow_v1', 'pg_temp'
 set statement_timeout to '60s'
as $function$
declare v_dash jsonb; v_netz jsonb; v_kette jsonb; v_stamm jsonb; v_bes jsonb;
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.'; end if;
  v_dash := public.cb_dashboard() - 'waechter' - 'takte';
  -- 19.11.2026: schlanke Fassung statt cb_netzplan() (32 s, Rest ungenutzt)
  v_netz := public.cb_netzplan_zufluesse();
  v_kette := public.cb_kette_stand();
  v_stamm := public.cb_dashboard_stamm();
  select coalesce(jsonb_agg(jsonb_build_object('tag',to_char(t.tag,'YYYY-MM-DD'),
      'google',coalesce(a.google,0),'bing',coalesce(a.bing,0),'direkt',coalesce(a.direkt,0),'andere',coalesce(a.andere,0),'gesamt',coalesce(a.gesamt,0)) order by t.tag),'[]')
  into v_bes from generate_series((current_date-13)::date,current_date,'1 day') t(tag)
  left join (select tag, sum(anzahl) filter(where quelle='google') google, sum(anzahl) filter(where quelle='bing') bing,
      sum(anzahl) filter(where quelle='direkt') direkt, sum(anzahl) filter(where quelle in ('andere','andere-suche','intern')) andere, sum(anzahl) gesamt
      from public."Seiten_Aufrufe" where tag>=current_date-13 group by tag) a on a.tag=t.tag;
  return jsonb_build_object('ok',true,'stand',now(),'dash',v_dash,
    'zufluesse',v_netz->'zufluesse','autopilot',v_netz->'autopilot','bestand',v_netz->'bestand',
    'kette',v_kette,'stamm',v_stamm,'besucher',v_bes);
end $function$;

select cron.alter_job(152, schedule := '5 seconds');
