-- 19.11.2026 (Ralph „jaja, bauen“): Wächter „Scan-Kette gebremst“.
-- Anlass: Ein Hilfstakt (tmp-claude-gewanteil, alle 3 Min.) drückte scan-kette von ~1.700 auf 93 Läufe/h, Lücken bis 168 s.
-- Ralph: „Ein nutzer der im laden länger warten muss, nutzt die app nicht mehr … alle anderen hinten anstellen, solange sie laufen“.
--
-- 1) Lücken-Messung: shadow_v1.scan_kette_luecken(fenster) – Lücken zwischen zwei Läufen von scan-kette (auch bis jetzt).
-- 2) Sicht public.v_scan_kette_luecken_offen (Fälle ansehen): Lücken > 30 s in den letzten 10 Min.
-- 3) Notbremse cb_last_waechter (jede Minute) ergänzt:
--    - Lücke > 30 s in den letzten 3 Min. → alle aktiven Hilfstakte „tmp-%“ pausieren (Grund „Scan-Kette gebremst“).
--    - Zähler wb_scan_kette (Gate, rot) = Lücken > 30 s in den letzten 10 Min.
--    - Wiederanlauf wie bisher einzeln, aber erst nach 10 Min. ohne Lücke.
-- 4) scan-kette und scan-neu-sofort auf die Ausnahmeliste der Notbremse (fehlten seit N12, 14.11.: die allgemeine
--    Notbremse hätte bei Überlast die Scan-Kette selbst pausiert).

insert into shadow_v1.last_bremse_ausnahme(jobname, warum)
select x, 'Scan-Vorrang (Ralph 19.11.2026): darf nie pausiert werden'
from unnest(array['scan-kette','scan-neu-sofort']) x
where not exists (select 1 from shadow_v1.last_bremse_ausnahme a where a.jobname = x);

create or replace function shadow_v1.scan_kette_luecken(p_fenster interval default interval '10 minutes')
 returns table(von timestamptz, bis timestamptz, sekunden numeric)
 language sql stable security definer
 set search_path to 'public', 'shadow_v1'
as $f$
  select start_time, coalesce(lead(start_time) over (order by start_time), now()),
         round(extract(epoch from coalesce(lead(start_time) over (order by start_time), now()) - start_time)::numeric, 1)
    from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'scan-kette' and active)
     and start_time > now() - p_fenster
$f$;

create or replace view public.v_scan_kette_luecken_offen as
select von, bis, sekunden from shadow_v1.scan_kette_luecken(interval '10 minutes') where sekunden > 30;

-- cb_last_waechter: Text der Fassung vom 05.10. plus Schritt 1b und Bedingung im Wiederanlauf
create or replace function public.cb_last_waechter(p_test_ueberlast boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'shadow_v1'
as $function$
/* 05.10.2026 (Ralph): Notbremse gegen Ueberlast.
   1) ZUERST entscheiden: waren die letzten 2 Laeufe Ueberlast (gemessen oder eigener Lauf abgebrochen)?
      -> alle Hintergrund-Takte ausser shadow_v1.last_bremse_ausnahme pausieren.
   1b) 19.11.2026 (Ralph „jaja, bauen“): Scan-Kette gebremst (Luecke > 30 s in 3 Min.) -> Hilfstakte tmp-% pausieren,
      Zaehler wb_scan_kette = Luecken > 30 s in 10 Min.
   2) DANN messen (Produktdetail + Katalog als echte Nutzerabfragen, Festplatten-Warten) und protokollieren.
   3) 10 min ohne Ueberlast und ohne Scan-Luecke -> pausierte Takte einzeln wieder an (einer je 5 min). */
declare t0 timestamptz; v_det int; v_kat int; v_akt int; v_io int; v_ue boolean := false; v_grund text := ''; v_aktion text := null;
  v_hist int; r record; n int := 0; v_sk_max numeric; v_sk_10 int; m int := 0;
begin
  -- 1) Entscheidung aus den letzten zwei Laeufen
  select count(*) filter (where x.ue) into v_hist from (
    select case when d.status='failed' then true
                else coalesce((select m.ueberlast from shadow_v1.last_messung m where m.am between d.start_time and coalesce(d.end_time, d.start_time)+interval '5 seconds' order by m.id desc limit 1), false) end ue
    from cron.job_run_details d join cron.job j on j.jobid=d.jobid
    where j.jobname='last-waechter' and d.status in ('failed','succeeded') and d.start_time > now()-interval '5 minutes'
    order by d.start_time desc limit 2) x;
  if p_test_ueberlast then v_hist := 2; end if;
  if v_hist >= 2 then
    for r in select j.jobid, j.jobname from cron.job j
             where j.active and j.jobname is not null
               and not exists (select 1 from shadow_v1.last_bremse_ausnahme a where a.jobname=j.jobname) loop
      perform cron.alter_job(r.jobid, active := false);
      insert into shadow_v1.last_bremse_pausiert(jobid, jobname, grund) values (r.jobid, r.jobname, 'Ueberlast in 2 Messungen');
      n := n+1;
    end loop;
    if n > 0 then v_aktion := 'NOTBREMSE: '||n||' Takte pausiert'; end if;
  end if;
  -- 1b) Scan-Kette gebremst? (19.11.2026)
  begin
    select max(sekunden) filter (where von > now()-interval '3 minutes' or bis > now()-interval '3 minutes'),
           count(*) filter (where sekunden > 30)
      into v_sk_max, v_sk_10 from shadow_v1.scan_kette_luecken(interval '10 minutes');
    insert into public."Waechter_Zaehler_Cache"(schluessel, anzahl, stand) values ('wb_scan_kette', coalesce(v_sk_10,0), now())
    on conflict (schluessel) do update set anzahl = excluded.anzahl, stand = excluded.stand;
    if coalesce(v_sk_max,0) > 30 then
      v_grund := v_grund||'Scan-Kette Luecke '||v_sk_max||' s; ';
      for r in select j.jobid, j.jobname from cron.job j
               where j.active and j.jobname like 'tmp-%'
                 and not exists (select 1 from shadow_v1.last_bremse_ausnahme a where a.jobname=j.jobname) loop
        perform cron.alter_job(r.jobid, active := false);
        insert into shadow_v1.last_bremse_pausiert(jobid, jobname, grund) values (r.jobid, r.jobname, 'Scan-Kette gebremst ('||v_sk_max||' s)');
        m := m+1;
      end loop;
      if m > 0 then v_aktion := coalesce(v_aktion||'; ','')||'SCAN-VORRANG: '||m||' Hilfstakte pausiert'; end if;
    end if;
  exception when others then null;
  end;
  -- 2) Messen
  select count(*) filter (where state='active'), count(*) filter (where state='active' and wait_event in ('DataFileRead','BufferMapping','DataFileExtend','WALWrite'))
    into v_akt, v_io from pg_stat_activity where pid<>pg_backend_pid();
  t0 := clock_timestamp(); perform public.cb_web_produkt_detail('P23242'); v_det := (extract(epoch from clock_timestamp()-t0)*1000)::int;
  if v_det <= 2000 then
    t0 := clock_timestamp(); perform public.cb_katalog_zaehler(false); v_kat := (extract(epoch from clock_timestamp()-t0)*1000)::int;
  end if;
  if v_det > 2000 then v_ue := true; v_grund := v_grund||'Detail '||v_det||' ms; '; end if;
  if coalesce(v_kat,0) > 3000 then v_ue := true; v_grund := v_grund||'Katalog '||v_kat||' ms; '; end if;
  if v_io >= 6 then v_ue := true; v_grund := v_grund||v_io||' warten auf Festplatte; '; end if;
  if p_test_ueberlast then v_ue := true; v_grund := v_grund||'TEST; '; end if;
  -- 3) Wiederanlauf (19.11.: erst wenn die Scan-Kette 10 Min. ohne Luecke > 30 s lief)
  if v_aktion is null and not v_ue and coalesce(v_sk_10,0) = 0
     and exists (select 1 from shadow_v1.last_bremse_pausiert where wieder_am is null)
     and not exists (select 1 from shadow_v1.last_messung where am > now()-interval '10 minutes' and ueberlast)
     and exists (select 1 from shadow_v1.last_messung where am < now()-interval '9 minutes')
     and not exists (select 1 from shadow_v1.last_messung where am > now()-interval '5 minutes' and aktion like 'wieder an%') then
    select p.jobid, p.jobname into r from shadow_v1.last_bremse_pausiert p where p.wieder_am is null order by p.pausiert_am, p.id limit 1;
    if exists (select 1 from cron.job where jobid=r.jobid) then perform cron.alter_job(r.jobid, active := true); end if;
    update shadow_v1.last_bremse_pausiert set wieder_am = now() where jobid=r.jobid and wieder_am is null;
    v_aktion := 'wieder an: '||r.jobname;
  end if;
  insert into shadow_v1.last_messung(detail_ms, katalog_ms, aktiv, io_warten, ueberlast, grund, aktion)
  values (v_det, v_kat, v_akt, v_io, v_ue, nullif(v_grund,''), v_aktion);
  return jsonb_build_object('detail_ms',v_det,'katalog_ms',v_kat,'aktiv',v_akt,'io',v_io,'ueberlast',v_ue,'aktion',v_aktion,
                            'scan_luecke_max_s',v_sk_max,'scan_luecken_10min',v_sk_10);
end $function$;

-- 5) Mischpult: Wächter in die Liste (Gate = rot)
create or replace function public.cb_admin_cockpit_waechter_alle()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'shadow_v1', 'pg_temp'
as $function$
  with reg as (
    select watcher_id, watcher_name, view_name, cache_key, live_count, cache_count, checked_at from public."Waechter_System_Pruefung"
  ), cache as (
    select schluessel, anzahl, stand from public."Waechter_Zaehler_Cache"
  ), rz as (
    select max(anzahl) filter (where schluessel = 'wb_rezeptur_geprueft') g,
           max(anzahl) filter (where schluessel = 'wb_rezeptur_gesamt') t
      from public."Waechter_Zaehler_Cache" where schluessel in ('wb_rezeptur_geprueft','wb_rezeptur_gesamt')
  ), extra(k, name, view_name, gate) as (values
    ('wb_scan_kette','Scan-Kette gebremst (Lücke > 30 s, Hilfstakte pausiert)','v_scan_kette_luecken_offen',true),
    ('w2','Widersprüche','v_zutaten_qa_r9',true),
    ('wb_zerleger','Zerleger ohne Nachlauf','v_zerleger_ohne_nachlauf_offen',false),
    ('wb_blattzeile','Blatt ohne Zutatenzeile','v_blatt_ohne_zeile_offen',false),
    ('wb_ralph','Ralph prüfen','v_ralph_pruefen_offen',false),
    ('wb_scan','Scan nicht im Index (Claude arbeitet ab)','v_scan_ohne_index_offen',false),
    ('wb_scan_foto','Scan wartet auf Rückseitenfoto (keine Gratisquelle)','v_scan_wartet_auf_foto',false),
    ('wb_riki','Riki-Fehler (Schlüssel, Guthaben, Überlast)','v_riki_fehler_offen',true),
    ('wb_variante','Gleiches Produkt, andere Werte (je Land)','v_produkt_variante_abweichend_offen',false),
    ('wb_fremdmarke','Quelle zeigt fremde Marke','v_quelle_fremdmarke_offen',false),
    ('wb_fremdtext','Fremdtext im Zutatenfeld (Werbung, Adresse, Naehrwerte)','v_rohtext_fremdtext_offen',false),
    ('wb_wirkform','Wirkform ohne Bioverfuegbarkeit/Quelle','v_wirkform_ohne_bioverfuegbarkeit_offen',false),
    ('wb_kategorie','Kategorie passt nicht zum Namen','v_kategorie_name_offen',false),
    ('wb_lastbremse','Notbremse: Takte wegen Ueberlast pausiert','v_last_bremse_offen',true),
    ('wb_dublette','Zutaten-Dubletten (Note)','v_zutaten_dublette_note_offen',false),
    ('wb_rezeptur','Rezeptur-Prüfung überfällig (schon geprüft, Termin vorbei)'
       || coalesce(' · Fortschritt: ' || translate(to_char((select g from rz), 'FM999,999'), ',', '.') || ' von ' || translate(to_char((select t from rz), 'FM999,999'), ',', '.') || ' geprüft', ''),
       'v_rezeptur_ueberfaellig',false),
    ('wb_rezeptur_klaeren','Rezeptur geändert, nicht übernommen (Claude klärt)','v_rezeptur_klaeren',false)
  ), alle as (
    select coalesce(r.cache_key, r.watcher_id) k, r.watcher_name name, r.view_name,
           coalesce(c.anzahl, r.live_count, 0) n, coalesce(c.stand, r.checked_at) stand,
           (r.cache_key in ('w1','w2','w3','w4','w5','w6','w7','w8','w9')) gate
      from reg r left join cache c on c.schluessel = r.cache_key
    union all
    select e.k, e.name, e.view_name, coalesce(c.anzahl,0), c.stand, e.gate
      from extra e left join cache c on c.schluessel = e.k
     where not exists (select 1 from reg r where r.view_name = e.view_name)
  )
  select coalesce(jsonb_agg(jsonb_build_object('k',k,'name',name,'view',view_name,'n',n,'gate',gate,'stand',stand)
           order by gate desc, n desc, name),'[]'::jsonb)
  from alle;
$function$;

-- Nachtrag gleich danach (Migration scan_kette_waechter_10s_20261119, Ralph „30 Sekunden stocken?“):
-- Schwelle 30 s -> 10 s in cb_last_waechter (Zähler, Pausieren, Wiederanlauf), Sicht und Mischpult-Name.
-- Messung 24 h: Median und 95 % der Abstände 2 s, aber im Normalbetrieb 2–12 Lücken > 10 s je Stunde (bis 88 s).
-- Der Wächter wird darum vorerst oft rot – das ist echt und der erste Hebel für „Scan in 5 s“.
create or replace view public.v_scan_kette_luecken_offen as
select von, bis, sekunden from shadow_v1.scan_kette_luecken(interval '10 minutes') where sekunden > 10;
revoke all on public.v_scan_kette_luecken_offen from anon, authenticated;
