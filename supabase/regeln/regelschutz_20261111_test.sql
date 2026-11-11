-- Test zu regelschutz_20261111.sql. Liest nur, aendert nichts (bricht am Ende
-- absichtlich mit dem Ergebnis ab). Erwartung nach der Aenderung:
--   nicht_admin: holen/pruefen/waechter/roh gesperrt, view 0
--   admin: holen ok=true, view = alle Zeilen
--   service holen ok=true, intern(cron) holen ok=true
--   anon waechter false, anon pruefen false, auth waechter true
do $$
declare n bigint; r jsonb; res text := 'session_user='||session_user||' | ';
  nicht_admin text := (select auth_id::text from public."Benutzer" where not coalesce(is_admin,false) and auth_id is not null limit 1);
  admin text := (select auth_id::text from public."Benutzer" where coalesce(is_admin,false) and auth_id is not null limit 1);
begin
  perform set_config('request.jwt.claims', json_build_object('sub',nicht_admin,'role','authenticated')::text, true);
  set local role authenticated;
  begin r := public.cb_riki_regelwerk_holen('verarbeitungsgrad'); res := res||'nicht_admin holen: OFFEN '||coalesce(r->>'zeichen','?')||' | ';
  exception when others then res := res||'nicht_admin holen: gesperrt | '; end;
  begin perform public.cb_zutat_vorschlag_pruefen('Zucker',2,null,null); res := res||'nicht_admin pruefen: OFFEN | ';
  exception when others then res := res||'nicht_admin pruefen: gesperrt | '; end;
  select count(*) into n from public."Bewertungsregeln"; res := res||'nicht_admin view: '||n||' | ';
  begin select count(*) into n from public.cb_admin_waechter_faelle(3); res := res||'nicht_admin waechter: OFFEN | ';
  exception when others then res := res||'nicht_admin waechter: gesperrt | '; end;
  begin perform public._cb_admin_waechter_faelle_roh(1); res := res||'nicht_admin roh: OFFEN | ';
  exception when others then res := res||'nicht_admin roh: gesperrt | '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub',admin,'role','authenticated')::text, true);
  set local role authenticated;
  begin r := public.cb_riki_regelwerk_holen('verarbeitungsgrad'); res := res||'admin holen: ok='||(r->>'ok')||' | ';
  exception when others then res := res||'admin holen: FEHLER '||sqlerrm||' | '; end;
  select count(*) into n from public."Bewertungsregeln"; res := res||'admin view: '||n||' | ';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  begin r := public.cb_riki_regelwerk_holen('verarbeitungsgrad'); res := res||'service holen: ok='||(r->>'ok')||' | ';
  exception when others then res := res||'service holen: FEHLER '||sqlerrm||' | '; end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  begin r := public.cb_riki_regelwerk_holen('verarbeitungsgrad'); res := res||'intern(cron) holen: ok='||(r->>'ok')||' | ';
  exception when others then res := res||'intern holen: FEHLER '||sqlerrm||' | '; end;
  res := res||'anon waechter: '||has_function_privilege('anon','public.cb_admin_waechter_faelle(integer)','EXECUTE')
            ||', anon pruefen: '||has_function_privilege('anon','public.cb_zutat_vorschlag_pruefen(text,integer,text,text)','EXECUTE')
            ||', auth waechter: '||has_function_privilege('authenticated','public.cb_admin_waechter_faelle(integer)','EXECUTE');
  raise exception 'ERGEBNIS: %', res;
end $$;
