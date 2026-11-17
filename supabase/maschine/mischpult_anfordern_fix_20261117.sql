-- 17.11.2026 (Ralph: „der zähler der app nutzer stimmt ja immer noch nicht???“)
-- Ursache: Das Mischpult stand seit 05.11. still. cb_admin_mischpult_anfordern fügte (1,'{}',NULL,now())
-- ein; stand ist NOT NULL, und der Einfügewert wird auch bei ON CONFLICT geprüft -> 23502 bei jedem
-- Klick auf „Aktualisieren“, die Seite verschluckte den Fehler. Fix: '-infinity' statt NULL.
-- Live als Migration mischpult_anfordern_fix_20261117, Sicherung shadow_v1._sich_fn_mischpult_anfordern_20261117.
create or replace function public.cb_admin_mischpult_anfordern()
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare c record;
begin
  if not public.cb_ist_admin() then return jsonb_build_object('ok',false,'fehler','kein Admin'); end if;
  select stand, angefordert_am into c from public.mischpult_cache where id = 1;
  if c.angefordert_am is not null and c.angefordert_am > coalesce(c.stand, '-infinity') then
    return jsonb_build_object('ok',true,'angefordert_am',c.angefordert_am,'neu',false);
  end if;
  insert into public.mischpult_cache(id, daten, stand, angefordert_am) values (1, '{}'::jsonb, '-infinity', now())
  on conflict (id) do update set angefordert_am = now();
  return jsonb_build_object('ok',true,'angefordert_am',now(),'neu',true);
end $function$;
