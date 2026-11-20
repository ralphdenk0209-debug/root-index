-- Scan-Ketten-Luecken, Nachtrag 4 (Ralph „jaja, alle 51“, 20.11.2026): die uebrigen Takte mit „set statement_timeout=…;“
-- vor dem eigentlichen Befehl laufen als ein Befehl. Ursache (Notiz scan-5-sekunden-messung, Abschnitt 5): bei zwei Befehlen
-- wartet der pg_cron-Planer nach dem SET-Ergebnis, bis das SELECT fertig ist, und startet so lange keinen anderen Takt
-- (Scan-Kette alle 2 s). Seit 155/156/194 umgestellt sind (20.11. 08:30): 1 Luecke in 20 Min. statt bis 6/h bis 101 s.
-- Ohne Vorsatz gilt die Grundgrenze von 120 s. Laufzeiten der 50 Takte (3 Tage): p95 hoechstens 44,5 s; alle Laeufe ueber
-- 100 s endeten zeitgleich mit 20-56 anderen Takten = Wartezeit des Planers, keine echte Laufzeit.
-- Bleiben wie sie sind: waechter-zaehler-takt (12, bis 392 s), waechter-ernaehrung (111, bis 216 s), sperre-bestand-takt (74, 91 s,
-- Grenze 150 s) - brauchen mehr als 120 s; tmp-claude-gewanteil-nacht-20261119 (229) - bricht 64 von 153 Laeufen an seiner
-- 9-s-Grenze ab, die Grenze ist Absicht (Hilfstakt < 10 s); laufprotokoll-kuerzen (188, „set lock_timeout“, einmal nachts).
-- 22 und 55 hatten zwei SELECTs - jetzt ein SELECT mit beiden Aufrufen in derselben Reihenfolge.
-- Sicherung der alten Befehle: shadow_v1._sich_cron_befehle_20261120.
-- Ruecksprung: select cron.alter_job(s.jobid, command := s.command) from shadow_v1._sich_cron_befehle_20261120 s;

create table if not exists shadow_v1._sich_cron_befehle_20261120 as
select jobid, jobname, command, now() gesichert_am
  from cron.job
 where active and command ~* '^\s*set\s+statement_timeout' and jobid not in (12, 111, 74, 229);

do $do$
declare r record; v_neu text; n int := 0;
begin
  for r in select s.jobid, s.command from shadow_v1._sich_cron_befehle_20261120 s order by s.jobid loop
    v_neu := case r.jobid
      when 22 then 'select public.cb_off_rohtext_takt_timeout(), (select public.cb_off_rohtext_takt(20, 2.0, false) where public.cb_bestand_frei()); /* 20.11.2026 ein Befehl statt set + 2 select (Scan-Kette) */'
      when 55 then 'select (select public.cb_parser_familien_umhaengen_takt(300, false)), (select public.cb_zusatzstoff_achse_ableiten_takt(700, false)); /* 20.11.2026 ein Befehl statt set + 2 select (Scan-Kette) */'
      else regexp_replace(r.command, '^\s*set\s+statement_timeout\s*=\s*''[^'']*''\s*;\s*', '', 'i')
    end;
    if v_neu ~* '^\s*set' or v_neu = r.command then raise exception 'Job % nicht umgestellt', r.jobid; end if;
    if regexp_replace(v_neu, '/\*.*?\*/', '', 'g') ~ ';\s*\S' then raise exception 'Job % hat noch zwei Befehle: %', r.jobid, v_neu; end if;
    perform cron.alter_job(r.jobid, command := v_neu);
    n := n + 1;
  end loop;
  if n <> 50 then raise exception 'Erwartet 50 Takte, gefunden %', n; end if;
end $do$;
