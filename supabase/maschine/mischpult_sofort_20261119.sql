-- 19.11.2026 abends (Ralph: „das laden dauert ja immer noch ewig“)
-- Gemessen: Der 5-s-Takt mischpult-cache springt unter Last nur alle ~3 Min. an (pg_cron „job startup timeout“,
-- Lücken 16:55 → 16:57:50 → 17:00:50). Anfordern → fertig dauerte so 64 s, obwohl die Rechnung nur 3–13 s braucht.
-- Lösung: cb_admin_mischpult_anfordern stößt die Rechnung sofort selbst an (pg_net → PostgREST-RPC
-- cb_mischpult_cache_bei_bedarf als service_role, wie _newsletter_anstossen). Der Takt bleibt als Rückfall.
create or replace function public.cb_admin_mischpult_anfordern()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare c record; v_key text;
begin
  if not public.cb_ist_admin() then return jsonb_build_object('ok',false,'fehler','kein Admin'); end if;
  select stand, angefordert_am into c from public.mischpult_cache where id = 1;
  -- schon angefordert und noch nicht gerechnet: nichts doppelt anstoßen
  if c.angefordert_am is not null and c.angefordert_am > coalesce(c.stand, '-infinity') then
    return jsonb_build_object('ok',true,'angefordert_am',c.angefordert_am,'neu',false);
  end if;
  -- 17.11.2026: stand ist NOT NULL; der Einfuegewert wird auch bei ON CONFLICT geprueft
  insert into public.mischpult_cache(id, daten, stand, angefordert_am) values (1, '{}'::jsonb, '-infinity', now())
  on conflict (id) do update set angefordert_am = now();
  -- 19.11.2026: sofort rechnen lassen, nicht auf den Takt warten (pg_net schickt nach dem Commit)
  begin
    select regexp_replace(decrypted_secret,'[[:space:]]','','g') into v_key from vault.decrypted_secrets where name='service_role_key' limit 1;
    if v_key is not null then
      perform net.http_post(
        url := 'https://haurbpfkfaaehorirzee.supabase.co/rest/v1/rpc/cb_mischpult_cache_bei_bedarf',
        headers := jsonb_build_object('Authorization','Bearer '||v_key,'apikey',v_key,'Content-Type','application/json'),
        body := '{}'::jsonb, timeout_milliseconds := 90000);
    end if;
  exception when others then null;  -- Rückfall: Takt mischpult-cache
  end;
  return jsonb_build_object('ok',true,'angefordert_am',now(),'neu',true);
end $function$;

-- Fassung b (gleich danach eingespielt als mischpult_sofort_20261119b): auch eine schon offene, aber hängende
-- Anforderung wird beim Klick sofort angestoßen (neu=false, aber http_post trotzdem). Gemessen 17:03 UTC:
-- Klick 17:03:28,40 → Rechnung fertig nach 3,95 s (HTTP 200), Seite fragt alle 3 s nach.
