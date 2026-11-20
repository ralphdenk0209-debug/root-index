-- Scan in 5 s, Hebel 6 a + b (Ralph „jaja, a und b“, 20.11.2026)
--
-- Befund (20.11., Steuerungs-Chat + Unterchat Scan-Tempo): 49 von 56 Luecken der scan-kette ueber 10 s (12 h, bis 101 s)
-- fallen in lange Laeufe von off-abgleich (38x, Ø 34 s, bis 104 s), rezeptur-abgleich (10x) und naehrwert-abgleich (9x).
-- pg_cron startet die Sekundentakte dann nicht (cron.use_background_workers = off, max_running_jobs 32 nicht erreicht).
--
-- a) cb_riki_scan_job_abschliessen: Ist ein Foto-Auftrag nach dem Sofort-Durchlauf nicht sauber (Score unvollstaendig
--    oder Freigabe-Sperre), laeuft shadow_v1.cb_scan_kette(pid) sofort im Abschluss mit (Zusatzstoff-Achse, Luecke aus
--    Gratisquellen, Sofort-Durchlauf) statt auf den 2-s-Takt zu warten. Danach wird neu geprueft; ist es jetzt sauber,
--    endet der Auftrag als 'fertig' mit Freigabe - die App zeigt den Index noch waehrend sie nachfragt.
--    ergebnis_meta.kette wird gesetzt, der Takt scan-kette ueberspringt den Auftrag dann (bleibt Rueckfall fuer Fehler).
-- b) Die drei langen Takte laufen in kleinen Losen, gleiche Menge je Stunde:
--    off-abgleich      3-59/10, 10 Stueck (60/h)  ->  jede Minute, 1 Stueck (60/h)
--    naehrwert-abgleich 8-59/15, 10 Stueck (40/h) ->  1-59/3, 2 Stueck (40/h)
--    rezeptur-abgleich 6-59/10, 30 Stueck (180/h) -> 0-58/2, 6 Stueck (180/h)
--
-- Ruecksprung a): Funktion aus Sicherung shadow_v1._sich_fn_abschliessen_20261120 (Spalte def) neu anlegen.
-- Ruecksprung b): cron.alter_job mit den alten Werten oben (Befehle unten in Kommentaren).

create table if not exists shadow_v1._sich_fn_abschliessen_20261120 as
select now() am, pg_get_functiondef('public.cb_riki_scan_job_abschliessen'::regproc) def;

do $do$
declare d text; n text;
begin
  d := pg_get_functiondef('public.cb_riki_scan_job_abschliessen'::regproc);
  n := d;
  n := replace(n, '  v_frei jsonb := null;', '  v_frei jsonb := null;
  v_kette jsonb := null;');
  n := replace(n, '  begin
    perform public.cb_referenz_freigabe_guard(v.produkt_id);
  exception when others then
    v_ref_ok := false;
  end;
', '  begin
    perform public.cb_referenz_freigabe_guard(v.produkt_id);
  exception when others then
    v_ref_ok := false;
  end;

  /* 20.11.2026 (Scan in 5 s, Hebel 6 a, Ralph „jaja, a und b“): nicht sauber -> Scan-Kette sofort hier statt im
     2-s-Takt (der setzte unter Last bis 101 s aus). Danach neu pruefen. Fehler halten den Abschluss nicht auf. */
  if not v_score_ok or not v_ref_ok then
    begin
      v_kette := shadow_v1.cb_scan_kette(v.produkt_id);
    exception when others then
      v_kette := jsonb_build_object(''fehler'', left(sqlerrm, 200));
    end;
    select coalesce(s."Score_vollstaendig",false) into v_score_ok from public."Scores" s where s."Produkt_ID"=v.produkt_id;
    v_ref_ok := true;
    begin
      perform public.cb_referenz_freigabe_guard(v.produkt_id);
    exception when others then
      v_ref_ok := false;
    end;
  end if;
');
  n := replace(n, 'ergebnis_meta=coalesce(p_ergebnis_meta,''{}''::jsonb)||jsonb_build_object(''sofort'',v_sofort)',
                  'ergebnis_meta=coalesce(p_ergebnis_meta,''{}''::jsonb)||jsonb_build_object(''sofort'',v_sofort)
          ||case when v_kette is null then ''{}''::jsonb else jsonb_build_object(''kette'', v_kette||jsonb_build_object(''am'',now(),''im_abschluss'',true),
               ''luecke_sofort'', coalesce(v_kette->''luecke'', jsonb_build_object(''ergebnis'',''nicht_noetig''))||jsonb_build_object(''am'',now())) end');
  if n = d or position('v_kette jsonb := null' in n) = 0 or position('Hebel 6 a' in n) = 0
     or (length(n) - length(replace(n, 'im_abschluss', ''))) / length('im_abschluss') <> 2 then
    raise exception 'cb_riki_scan_job_abschliessen: Ersetzung nicht vollstaendig';
  end if;
  execute n;
end $do$;

-- b) Takte in kleine Lose. Alte Befehle (Ruecksprung):
--  155 off-abgleich       '3-59/10 * * * *'  set statement_timeout='280s'; select public.cb_off_abgleich_takt(10) where public.cb_bestand_frei();
--  156 naehrwert-abgleich '8-59/15 * * * *'  set statement_timeout='280s'; select public.cb_naehrwert_abgleich_takt(10) where public.cb_bestand_frei();
--  194 rezeptur-abgleich  '6-59/10 * * * *'  set statement_timeout='280s'; select public.cb_rezeptur_abgleich_takt() where public.cb_bestand_frei(); /* 11.11.2026 Ralph „A, jaja“: Rezeptur-Abgleich kostenlos */
select cron.alter_job(155, schedule := '* * * * *',
  command := 'set statement_timeout=''280s''; select public.cb_off_abgleich_takt(1) where public.cb_bestand_frei(); /* 20.11.2026 Ralph jaja: kleine Lose (Scan-Kette hat Vorrang), 60/h wie vorher */');
select cron.alter_job(156, schedule := '1-59/3 * * * *',
  command := 'set statement_timeout=''280s''; select public.cb_naehrwert_abgleich_takt(2) where public.cb_bestand_frei(); /* 20.11.2026 Ralph jaja: kleine Lose (Scan-Kette hat Vorrang), 40/h wie vorher */');
select cron.alter_job(194, schedule := '0-58/2 * * * *',
  command := 'set statement_timeout=''280s''; select public.cb_rezeptur_abgleich_takt(6) where public.cb_bestand_frei(); /* 11.11.2026 Ralph „A, jaja“: Rezeptur-Abgleich kostenlos. 20.11.2026 Ralph jaja: kleine Lose (Scan-Kette hat Vorrang), 180/h wie vorher */');

-- Nachtrag 20.11.2026 (Ralph „jaja, a und b“, Hinweis Steuerungs-Chat wb_rezeptur 31 ueberfaellig):
-- Die Kandidatenauswahl im Rezeptur-Takt kostete bei JEDEM Lauf 4-5,5 s (Planer schaetzt 7 statt 42.536 Produkte ->
-- verschachtelte Schleifen ueber 20.000 x 1.546). Neu: shadow_v1._rezeptur_kandidaten_neu(n) - gleiche Reihenfolge
-- (Probe 30 von 30 gleich), 0,3 s. Rezeptur jede Minute 3 Stueck (180/h wie vorher), Naehrwert 1 Stueck an 40 Minuten
-- je Stunde (40/h wie vorher), damit jeder Lauf unter 10 s bleibt. Ueberfaellige entstanden, weil der Rezeptur-Takt
-- bei Ampel „gelb (Wiederanlauf)“ aussetzt - die zeigt die Notbremse nach jeder Scan-Ketten-Luecke.
-- Ruecksprung: Funktion aus shadow_v1._sich_fn_rezeptur_takt_20261120 (def); cron wie oben im Kommentar.

create table if not exists shadow_v1._sich_fn_rezeptur_takt_20261120 as
select now() am, pg_get_functiondef('public.cb_rezeptur_abgleich_takt'::regproc) def;

do $do$
declare d text; a int; b int; n text;
begin
  d := pg_get_functiondef('public.cb_rezeptur_abgleich_takt'::regproc);
  a := position('  for r in' || chr(10) || '    with bel as materialized' in d);
  b := position('     limit v_n' || chr(10) || '  loop' in d);
  if a = 0 or b = 0 or b < a then raise exception 'Kandidatenblock nicht gefunden'; end if;
  n := substr(d, 1, a - 1) || '  for r in select k.pid from shadow_v1._rezeptur_kandidaten_neu(v_n) k  /* 20.11.2026 schnelle Auswahl, gleiche Reihenfolge */' || chr(10) || '  loop'
       || substr(d, b + length('     limit v_n' || chr(10) || '  loop'));
  execute n;
end $do$;

select cron.alter_job(194, schedule := '* * * * *',
  command := 'set statement_timeout=''280s''; select public.cb_rezeptur_abgleich_takt(3) where public.cb_bestand_frei(); /* 11.11.2026 Ralph „A, jaja“: Rezeptur-Abgleich kostenlos. 20.11.2026 Ralph jaja: kleine Lose (Scan-Kette hat Vorrang), 180/h wie vorher */');
select cron.alter_job(156, schedule := '0,1,3,4,6,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48,49,51,52,54,55,57,58 * * * *',
  command := 'set statement_timeout=''280s''; select public.cb_naehrwert_abgleich_takt(1) where public.cb_bestand_frei(); /* 20.11.2026 Ralph jaja: kleine Lose (Scan-Kette hat Vorrang), 40/h wie vorher */');

-- Hilfsfunktion (am 20.11. vor der Migration angelegt, hier zur Nachvollziehbarkeit):
create or replace function shadow_v1._rezeptur_kandidaten_neu(v_n int) returns table(pid text, prio int, naechste_am timestamptz) language sql stable set search_path to 'public','shadow_v1' as $f$
with edk as materialized (select distinct produkt_id from shadow_v1.off_abgleich where ergebnis = 'abweichung' and quelle in ('edeka','dm')),
     bel as materialized (select distinct produkt_id from shadow_v1.v_rezeptur_beliebt)
select pid, prio, naechste_am from (
 (select p."Produkt_ID" pid, 0 prio, null::timestamptz naechste_am
    from edk join public."Produkte" p on p."Produkt_ID" = edk.produkt_id
   where p."Produktstatus" = 'Aktiv' and p."Freigabe_Status" = 'FREIGEGEBEN_RIKI' and regexp_replace(coalesce(p."EAN_GTIN",''),'\D','','g') ~ '^4[0-4]\d{11}$'
     and not exists (select 1 from shadow_v1.rezeptur_pruefung rp where rp.produkt_id = p."Produkt_ID")
   order by 1 desc limit v_n)
 union all
 (select p."Produkt_ID", 1, rp.naechste_am
    from bel join public."Produkte" p on p."Produkt_ID" = bel.produkt_id
    left join shadow_v1.rezeptur_pruefung rp on rp.produkt_id = p."Produkt_ID"
   where p."Produktstatus" = 'Aktiv' and p."Freigabe_Status" = 'FREIGEGEBEN_RIKI' and regexp_replace(coalesce(p."EAN_GTIN",''),'\D','','g') ~ '^4[0-4]\d{11}$'
     and (rp.produkt_id is null or rp.naechste_am <= now())
     and not (rp.produkt_id is null and exists (select 1 from edk where edk.produkt_id = p."Produkt_ID"))
   order by 3 nulls first, 1 desc limit v_n)
 union all
 (select p."Produkt_ID", 2, rp.naechste_am
    from shadow_v1.rezeptur_pruefung rp join public."Produkte" p on p."Produkt_ID" = rp.produkt_id
   where rp.naechste_am <= now()
     and p."Produktstatus" = 'Aktiv' and p."Freigabe_Status" = 'FREIGEGEBEN_RIKI' and regexp_replace(coalesce(p."EAN_GTIN",''),'\D','','g') ~ '^4[0-4]\d{11}$'
     and not exists (select 1 from bel where bel.produkt_id = p."Produkt_ID")
   order by 3, 1 desc limit v_n)
 union all
 (select p."Produkt_ID", 3, null::timestamptz
    from public."Produkte" p
   where p."Produktstatus" = 'Aktiv' and p."Freigabe_Status" = 'FREIGEGEBEN_RIKI' and regexp_replace(coalesce(p."EAN_GTIN",''),'\D','','g') ~ '^4[0-4]\d{11}$'
     and not exists (select 1 from shadow_v1.rezeptur_pruefung rp where rp.produkt_id = p."Produkt_ID")
     and not exists (select 1 from edk where edk.produkt_id = p."Produkt_ID")
     and not exists (select 1 from bel where bel.produkt_id = p."Produkt_ID")
   order by 1 desc limit v_n)
) x order by prio, naechste_am nulls first, pid desc limit v_n
$f$;

-- Nachtrag 2 (20.11.2026, Ralph „jaja, laufen lassen“): Der Rezeptur-Takt setzte bei Ampel „gelb (Wiederanlauf)“ aus. Die zeigt nur,
-- dass die Notbremse Hilfstakte (tmp-%) nach einer Scan-Ketten-Luecke pausiert hat - keine echte Last. Folge: wb_rezeptur 31 -> 75.
-- Jetzt pausiert er nur bei echter Ueberlast (rot/gelb). Ruecksprung: Bedingung wieder auf <> 'gruen'.
do $do$
declare d text; n text;
begin
  d := pg_get_functiondef('public.cb_rezeptur_abgleich_takt'::regproc);
  n := replace(d, $a$if coalesce(public.cb_last_stand(10)->>'ampel','gruen') <> 'gruen' then$a$,
                  $b$if coalesce(public.cb_last_stand(10)->>'ampel','gruen') not in ('gruen','gelb (Wiederanlauf)') then /* 20.11.2026 Ralph „jaja, laufen lassen“: Wiederanlauf der Notbremse ist keine Last - sonst entstehen Ueberfaellige */$b$);
  if n = d then raise exception 'Lastpruefung nicht gefunden'; end if;
  execute n;
end $do$;
