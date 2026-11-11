-- FL-1 Nachtrag 11.11.2026 (Ralph jaja): Einlöse-Link per E-Mail.
-- Gleicher Inhalt wie die Abschnitte in fl1_fundament.sql (dort fuehrend).

-- 7b) Einlöse-Link per E-Mail (Ralph 11.11.) ------------------------------
-- Die Edge-Funktion fp-key-mail ruft cb_fp_key_mail_vorbereiten MIT dem
-- Login der Fachperson auf (Pruefung + Sperre hier), sendet per SMTP und
-- traegt das Ergebnis mit Dienstrechten nach. E-Mail des Klienten nur fuer
-- den Versand; nach Einloesen oder Beenden wird sie geloescht.
create table if not exists public.fp_key_mail_log (
  id bigserial primary key,
  code text not null references public.gratis_code(code),
  fachperson_auth uuid not null references public.fachperson_konto(auth_id),
  an_email text,
  am timestamptz not null default now(),
  status text not null default 'vorbereitet' check (status in ('vorbereitet','gesendet','fehler')),
  fehler text
);
alter table public.fp_key_mail_log enable row level security;
revoke all on public.fp_key_mail_log from anon, authenticated;
create index if not exists fp_key_mail_log_fp_am on public.fp_key_mail_log(fachperson_auth, am);
create index if not exists fp_key_mail_log_code on public.fp_key_mail_log(code);
-- Grenzen gegen Massenversand (umschaltbar)
insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('mail_je_key_tag','3','Hoechstens so viele Einladungs-Mails je Key in 24 Stunden'),
  ('mail_je_fachperson_tag','30','Hoechstens so viele Einladungs-Mails je Fachperson in 24 Stunden')
on conflict (schluessel) do nothing;

create or replace function public.cb_fp_key_mail_vorbereiten(p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_mail text := lower(trim(coalesce(p_email,'')));
        v_id bigint; v_max_key int; v_max_fp int; v_fp_mail text;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es bei dir nicht.' using errcode = '42501'; end if;
  if g.klient_auth is not null then return jsonb_build_object('ok',false,'grund','Der Key ist schon eingelöst.'); end if;
  if g.beendet_am is not null or not g.aktiv then return jsonb_build_object('ok',false,'grund','Der Key ist beendet.'); end if;
  if v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_mail) > 200 then return jsonb_build_object('ok',false,'grund','Bitte eine gültige E-Mail eintragen.'); end if;
  select coalesce((select wert::int from public.fachleute_einstellung where schluessel='mail_je_key_tag'),3),
         coalesce((select wert::int from public.fachleute_einstellung where schluessel='mail_je_fachperson_tag'),30)
    into v_max_key, v_max_fp;
  perform pg_advisory_xact_lock(hashtext('fp_mail:' || v.auth_id::text));
  if (select count(*) from public.fp_key_mail_log where code = g.code and status <> 'fehler' and am > now() - interval '24 hours') >= v_max_key then
    return jsonb_build_object('ok',false,'grund','Für diesen Key sind heute schon ' || v_max_key || ' Mails rausgegangen. Bitte morgen wieder – oder den QR-Code nutzen.'); end if;
  if (select count(*) from public.fp_key_mail_log where fachperson_auth = v.auth_id and status <> 'fehler' and am > now() - interval '24 hours') >= v_max_fp then
    return jsonb_build_object('ok',false,'grund','Tageslimit von ' || v_max_fp || ' Mails erreicht. Bitte morgen wieder.'); end if;
  insert into public.fp_key_mail_log(code, fachperson_auth, an_email) values (g.code, v.auth_id, v_mail) returning id into v_id;
  select email into v_fp_mail from auth.users where id = v.auth_id;
  return jsonb_build_object('ok',true,'log_id',v_id,'an',v_mail,'code',g.code,'tage',g.tage,
    'link','https://root-index.de/klientin.html?code=' || g.code,
    'fachperson',v.name,'praxis',v.praxis,'antwort_an',v_fp_mail);
end $$;

create or replace function public.cb_gratis_code_einloesen(p_code text, p_wechsel boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_c public.gratis_code; v_bis timestamptz; v_code text := upper(trim(p_code));
        v_fp public.fachperson_konto; v_alt record;
begin
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Bitte zuerst anmelden.'); end if;
  perform public.cb_link_me();   -- Benutzer-Zeile sicherstellen (sonst ginge die Testzeit verloren)
  select * into v_c from public.gratis_code where code = v_code for update;
  if not found or not v_c.aktiv then return jsonb_build_object('ok',false,'grund','Diesen Code gibt es nicht.'); end if;
  if v_c.gueltig_bis is not null and v_c.gueltig_bis < now() then return jsonb_build_object('ok',false,'grund','Der Code ist abgelaufen.'); end if;
  if exists (select 1 from public.gratis_code_einloesung where code = v_code and auth_id = v_uid) then
    return jsonb_build_object('ok',false,'grund','Du hast diesen Code schon eingelöst.'); end if;
  if v_c.beendet_am is not null then return jsonb_build_object('ok',false,'grund','Der Code wurde beendet.'); end if;
  if v_c.max_einloesungen is not null and v_c.eingeloest >= v_c.max_einloesungen then return jsonb_build_object('ok',false,'grund','Der Code ist schon aufgebraucht.'); end if;

  if v_c.fachperson_auth is not null then
    select * into v_fp from public.fachperson_konto where auth_id = v_c.fachperson_auth;
    if not coalesce(v_fp.aktiv,false) then return jsonb_build_object('ok',false,'grund','Der Code ist nicht mehr gültig.'); end if;
    if v_c.fachperson_auth = v_uid then return jsonb_build_object('ok',false,'grund','Den eigenen Klienten-Code kann man nicht selbst einlösen.'); end if;
    -- Ein Klient hat immer nur EINE Fachperson
    perform pg_advisory_xact_lock(hashtext('fp_klient:' || v_uid::text));
    select g.code, g.fachperson_auth, f.name into v_alt
      from public.gratis_code g join public.fachperson_konto f on f.auth_id = g.fachperson_auth
     where g.klient_auth = v_uid and public._fp_key_laeuft(g) limit 1;
    if v_alt.code is not null then
      if v_alt.fachperson_auth = v_c.fachperson_auth then
        return jsonb_build_object('ok',false,'grund','Du hast schon einen laufenden Code von ' || v_alt.name || '. Sie kann ihn verlängern.');
      end if;
      if not coalesce(p_wechsel,false) then
        return jsonb_build_object('ok',false,'wechsel_noetig',true,'bisherige_fachperson',v_alt.name,'neue_fachperson',v_fp.name,
          'grund','Du bist gerade mit ' || v_alt.name || ' verbunden. Mit diesem Code wechselst du zu ' || v_fp.name || '.');
      end if;
      -- Uebertrag: alter Key endet jetzt, alte Fachperson sieht nichts mehr
      update public.gratis_code set beendet_am = now(), beendet_grund = 'wechsel', aktiv = false,
             laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
       where code = v_alt.code;
      insert into public.fachperson_einwilligung_log(code, klient_auth, aktion) values (v_alt.code, v_uid, 'wechsel');
    end if;
    insert into public.gratis_code_einloesung(code, auth_id, tage) values (v_code, v_uid, v_c.tage);
    update public.gratis_code set eingeloest = eingeloest + 1, klient_auth = v_uid, start_am = now(),
           laeuft_bis = now() + make_interval(days => v_c.tage)
     where code = v_code returning laeuft_bis into v_bis;
    insert into public.fachperson_einwilligung(code, klient_auth) values (v_code, v_uid) on conflict (code) do nothing;
    -- Versand-E-Mail wird nach dem Einloesen nicht mehr gebraucht (Datensparsamkeit)
    update public.fp_key_mail_log set an_email = null where code = v_code and an_email is not null;
    return jsonb_build_object('ok',true,'tage',v_c.tage,'premium_bis',v_bis,'code',v_code,
                              'fachperson',v_fp.name,'praxis',v_fp.praxis,'einwilligung_offen',true,
                              'gewechselt_von', v_alt.name, 'eigenes_abo', public._fp_eigenes_abo(v_uid));
  end if;

  insert into public.gratis_code_einloesung(code, auth_id, tage) values (v_code, v_uid, v_c.tage);
  update public.gratis_code set eingeloest = eingeloest + 1 where code = v_code;
  v_bis := public._testzeit_verlaengern(v_uid, v_c.tage);
  return jsonb_build_object('ok',true,'tage',v_c.tage,'premium_bis',v_bis);
end $$;
create or replace function public.cb_fp_keys()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', g.code, 'bezeichnung', g.bezeichnung, 'tage', g.tage, 'erstellt_am', g.erstellt_am,
      'start_am', g.start_am, 'laeuft_bis', g.laeuft_bis, 'beendet_am', g.beendet_am, 'beendet_grund', g.beendet_grund,
      'status', case when g.beendet_am is not null then 'beendet'
                     when g.klient_auth is null then 'offen'
                     when g.laeuft_bis > now() then 'laeuft' else 'abgelaufen' end,
      'besprochen', e.besprochen_am is not null,
      'einwilligung', case when e.einwilligung_am is null then 'keine'
                           when e.widerruf_am is not null then 'widerrufen' else 'erteilt' end,
      'daten_ab', case when e.widerruf_am is null and e.einwilligung_am is not null then e.daten_ab end,
      'aeltere_freigegeben', coalesce(e.aeltere_freigegeben and e.widerruf_am is null, false),
      'mail_an', m.an_email, 'mail_am', m.am,
      -- Name des Klienten nur bei laufendem Key UND aktiver Einwilligung
      'klient_name', case when public._fp_key_laeuft(g) and e.einwilligung_am is not null and e.widerruf_am is null
                          then (select b."Name" from public."Benutzer" b where b.auth_id = g.klient_auth limit 1) end
    ) order by g.erstellt_am desc)
    from public.gratis_code g
    left join public.fachperson_einwilligung e on e.code = g.code and e.klient_auth = g.klient_auth
    left join lateral (select l.an_email, l.am from public.fp_key_mail_log l
                        where l.code = g.code and l.status = 'gesendet' order by l.am desc limit 1) m on true
    where g.fachperson_auth = v.auth_id), '[]'::jsonb);
end $$;
create or replace function public.cb_fp_key_beenden(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  update public.gratis_code set beendet_am = now(), beendet_grund = 'fachperson', aktiv = false,
         laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id and beendet_am is null;
  if not found then raise exception 'Diesen Key gibt es bei dir nicht oder er ist schon beendet.' using errcode = '42501'; end if;
  update public.fp_key_mail_log set an_email = null where code = upper(trim(p_code)) and an_email is not null;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.cb_fp_key_mail_vorbereiten(text, text) from public, anon;
grant execute on function public.cb_fp_key_mail_vorbereiten(text, text) to authenticated;
