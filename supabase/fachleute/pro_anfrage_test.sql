-- pro_anfrage_test.sql · 14.11.2026 · Test zu pro_anfrage.sql
-- Probelauf: Inhalt von pro_anfrage.sql + diese Datei in EINEM Aufruf. Endet IMMER mit RAISE EXCEPTION,
-- damit Tabelle, Funktion, Testzeilen und die vorgemerkte Mail (net.http_request_queue) zurückgerollt werden.
do $$
declare
  ok int := 0; fehl text[] := '{}'; r jsonb; n int; v_mail0 bigint; v_mail1 bigint; z record;
begin
  select count(*) into v_mail0 from net.http_request_queue;

  -- Aufrufe wie aus dem Browser: Rolle anon
  execute 'set local role anon';

  -- 1 Honeypot: ok, aber nichts gespeichert
  r := public.pro_anfrage_senden('Bot', 'Botpraxis', 'bot@example.invalid', null, null, true, 'http://spam');
  if (r->>'ok')::boolean then ok := ok + 1; else fehl := fehl || 'honeypot antwortet nicht ok'; end if;

  -- 2 ohne Einwilligung
  r := public.pro_anfrage_senden('Anna Probe', 'Praxis Probe', 'anna@example.invalid', null, null, false, null);
  if r->>'grund' = 'einwilligung' then ok := ok + 1; else fehl := fehl || ('einwilligung: ' || r::text); end if;

  -- 3 kaputte E-Mail, 4 Name zu kurz, 5 Praxis fehlt
  r := public.pro_anfrage_senden('Anna Probe', 'Praxis Probe', 'anna@', null, null, true, null);
  if r->>'grund' = 'email' then ok := ok + 1; else fehl := fehl || ('email: ' || r::text); end if;
  r := public.pro_anfrage_senden('A', 'Praxis Probe', 'anna@example.invalid', null, null, true, null);
  if r->>'grund' = 'name' then ok := ok + 1; else fehl := fehl || ('name: ' || r::text); end if;
  r := public.pro_anfrage_senden('Anna Probe', ' ', 'anna@example.invalid', null, null, true, null);
  if r->>'grund' = 'praxis' then ok := ok + 1; else fehl := fehl || ('praxis: ' || r::text); end if;

  -- 6 gültig, Herkunft mit Unterstrich/Großbuchstaben wird normalisiert
  r := public.pro_anfrage_senden('  Anna   Probe ', 'Praxis Probe', 'Anna@Example.invalid', 'Bitte um Rückruf.', 'G_Pro_Suche', true, '');
  if (r->>'ok')::boolean then ok := ok + 1; else fehl := fehl || ('gueltig: ' || r::text); end if;

  -- 7 anon darf die Tabelle nicht direkt lesen
  begin
    perform 1 from public.pro_anfrage limit 1;
    fehl := fehl || 'anon kann pro_anfrage lesen';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- 8 Bremse: noch 2 erlaubt, die 4. Anfrage derselben Adresse in 24 h wird abgelehnt
  perform public.pro_anfrage_senden('Anna Probe', 'Praxis Probe', 'anna@example.invalid', null, null, true, null);
  perform public.pro_anfrage_senden('Anna Probe', 'Praxis Probe', 'anna@example.invalid', null, null, true, null);
  r := public.pro_anfrage_senden('Anna Probe', 'Praxis Probe', 'anna@example.invalid', null, null, true, null);
  if r->>'grund' = 'zu_viele' then ok := ok + 1; else fehl := fehl || ('bremse: ' || r::text); end if;

  execute 'reset role';

  -- 9 genau 3 Zeilen gespeichert (Honeypot und Fehler nicht), Werte sauber
  select count(*) into n from public.pro_anfrage where lower(email) in ('anna@example.invalid', 'bot@example.invalid');
  if n = 3 then ok := ok + 1; else fehl := fehl || ('zeilen: ' || n); end if;
  select * into z from public.pro_anfrage where email = 'anna@example.invalid' order by id limit 1;
  if z.name = 'Anna Probe' and z.herkunft = 'g-pro-suche' and z.nachricht = 'Bitte um Rückruf.' and z.einwilligung_am is not null
     and z.kontakt_id is not null then ok := ok + 1; else fehl := fehl || ('werte: ' || row_to_json(z)::text); end if;

  -- 10 Mail-Weg: je Anfrage eine Zeile in "Kontakt_Anfragen" und eine vorgemerkte Anfrage an kontakt-weiterleiten
  select count(*) into n from public."Kontakt_Anfragen" k join public.pro_anfrage p on p.kontakt_id = k.id
   where k.typ = 'Root Index Pro' and k.email = 'anna@example.invalid' and k.nachricht like '%Herkunft: g-pro-suche%';
  if n = 1 then ok := ok + 1; else fehl := fehl || ('kontakt_anfragen: ' || n); end if;
  select count(*) into v_mail1 from net.http_request_queue;
  if v_mail1 - v_mail0 = 3 then ok := ok + 1; else fehl := fehl || ('mails vorgemerkt: ' || (v_mail1 - v_mail0)); end if;

  -- 11 Rechte: anon führt die Funktion aus, hat aber kein Tabellenrecht
  if has_function_privilege('anon', 'public.pro_anfrage_senden(text,text,text,text,text,boolean,text)', 'execute')
     and not has_table_privilege('anon', 'public.pro_anfrage', 'select')
     and not has_table_privilege('anon', 'public.pro_anfrage', 'insert') then ok := ok + 1;
  else fehl := fehl || 'rechte'; end if;

  raise exception 'PROBELAUF pro_anfrage (wird zurueckgerollt): % OK / % Fehler %', ok, coalesce(array_length(fehl, 1), 0), fehl;
end $$;
