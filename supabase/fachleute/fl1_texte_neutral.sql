-- FL-1 Nachtrag 11.11.2026: Meldungen an Fachleute neutral (weder du noch Sie), Ralph.
-- Klienten werden weiter geduzt. Gleicher Inhalt wie fl1_fundament.sql (dort fuehrend).
-- Nur Texte geaendert, keine Logik.

-- Platzhalter-Vertrag: bisher von niemandem bestaetigt (geprueft), darum Text an Ort und Stelle angepasst
update public.fachperson_vertrag_text
   set text = replace(text, 'Sobald er da ist, wirst du hier gebeten, ihn erneut zu bestätigen.', 'Sobald er vorliegt, ist hier eine erneute Bestätigung nötig.')
 where version = 'platzhalter-2026-11-11'
   and not exists (select 1 from public.fachperson_vertrag_bestaetigung b where b.version = 'platzhalter-2026-11-11');

create or replace function public._fp_ich() returns public.fachperson_konto
language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto;
begin
  select * into v from public.fachperson_konto where auth_id = auth.uid() and aktiv;
  if v.auth_id is null then raise exception 'Nur für freigeschaltete Fachleute.' using errcode = '42501'; end if;
  if not public._fp_lizenz_ok(v.auth_id) then raise exception 'Die Lizenz ist abgelaufen. Bitte bei Root Index melden.' using errcode = '42501'; end if;
  if not public._fp_vertrag_ok(v.auth_id) then raise exception 'Bitte zuerst die Verschwiegenheitsvereinbarung bestätigen.' using errcode = '42501'; end if;
  return v;
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
        return jsonb_build_object('ok',false,'grund','Du hast schon einen laufenden Code von ' || v_alt.name || '. Die Fachperson kann ihn verlängern.');
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

create or replace function public.cb_fp_key_anlegen(p_tage integer, p_bezeichnung text default null, p_vereinbarung_bestaetigt boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); v_code text; v_z text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if p_tage is null or p_tage < 1 or p_tage > 730 then return jsonb_build_object('ok',false,'grund','Laufzeit: 1 Tag bis 2 Jahre.'); end if;
  if v.vereinbarung_bestaetigt_am is null then
    if not coalesce(p_vereinbarung_bestaetigt,false) then
      return jsonb_build_object('ok',false,'grund','Bitte zuerst die Vereinbarung zur Verschwiegenheit mit den Klienten bestätigen.','vereinbarung_noetig',true); end if;
    update public.fachperson_konto set vereinbarung_bestaetigt_am = now() where auth_id = v.auth_id;
  end if;
  loop
    v_code := v.kuerzel || '-';
    for i in 1..4 loop v_code := v_code || substr(v_z, 1 + floor(random()*length(v_z))::int, 1); end loop;
    exit when not exists (select 1 from public.gratis_code where code = v_code);
  end loop;
  insert into public.gratis_code(code, tage, max_einloesungen, notiz, fachperson_auth, bezeichnung)
  values (v_code, p_tage, 1, 'Fachperson-Key: ' || v.name, v.auth_id, nullif(left(trim(coalesce(p_bezeichnung,'')),80),''));
  return jsonb_build_object('ok',true,'code',v_code,'link','https://root-index.de/klientin.html?code=' || v_code,'tage',p_tage);
end $$;

create or replace function public.cb_fp_key_laufzeit(p_code text, p_menge integer, p_einheit text default 'tage')
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_iv interval; v_tage int; v_bis timestamptz;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id for update;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
  if g.beendet_am is not null then return jsonb_build_object('ok',false,'grund','Der Key ist beendet. Bitte einen neuen Key anlegen.'); end if;
  if p_menge is null or p_menge = 0 or abs(p_menge) > 730 then return jsonb_build_object('ok',false,'grund','Bitte eine Anzahl angeben.'); end if;
  v_iv := case lower(coalesce(p_einheit,'tage'))
            when 'tage' then make_interval(days => p_menge)
            when 'wochen' then make_interval(weeks => p_menge)
            when 'monate' then make_interval(months => p_menge) end;
  if v_iv is null then return jsonb_build_object('ok',false,'grund','Einheit: tage, wochen oder monate.'); end if;
  if g.klient_auth is null then
    -- noch nicht eingeloest: geplante Laufzeit in Tagen aendern
    v_tage := ((current_date + g.tage + v_iv)::date - current_date);
    if v_tage < 1 then return jsonb_build_object('ok',false,'grund','Kürzer als 1 Tag geht nicht. Zum Stoppen „Beenden“ nehmen.'); end if;
    if v_tage > 730 then return jsonb_build_object('ok',false,'grund','Höchstens 2 Jahre.'); end if;
    update public.gratis_code set tage = v_tage where code = g.code;
    return jsonb_build_object('ok',true,'tage',v_tage);
  end if;
  if p_menge > 0 then
    -- abgelaufene Keys laufen ab jetzt wieder - aber nur, wenn der Klient nicht inzwischen bei einer anderen Fachperson ist
    if exists (select 1 from public.gratis_code o where o.klient_auth = g.klient_auth and o.code <> g.code and public._fp_key_laeuft(o)) then
      return jsonb_build_object('ok',false,'grund','Diese Person ist inzwischen mit einer anderen Fachperson verbunden.'); end if;
    v_bis := greatest(g.laeuft_bis, now()) + v_iv;
  else
    if g.laeuft_bis <= now() then return jsonb_build_object('ok',false,'grund','Der Key ist schon abgelaufen.'); end if;
    v_bis := greatest(g.laeuft_bis + v_iv, now());          -- nie vor jetzt: kuerzen bis jetzt = Zugang endet sofort
  end if;
  if v_bis > now() + interval '2 years' then return jsonb_build_object('ok',false,'grund','Höchstens 2 Jahre im Voraus.'); end if;
  update public.gratis_code set laeuft_bis = v_bis where code = g.code;
  return jsonb_build_object('ok',true,'laeuft_bis',v_bis);
end $$;

create or replace function public.cb_fp_key_beenden(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  update public.gratis_code set beendet_am = now(), beendet_grund = 'fachperson', aktiv = false,
         laeuft_bis = case when laeuft_bis > now() then now() else laeuft_bis end
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id and beendet_am is null;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht, oder er ist schon beendet.' using errcode = '42501'; end if;
  update public.fp_key_mail_log set an_email = null where code = upper(trim(p_code)) and an_email is not null;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cb_fp_key_bezeichnung(p_code text, p_bezeichnung text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich();
begin
  update public.gratis_code set bezeichnung = nullif(left(trim(coalesce(p_bezeichnung,'')),80),'')
   where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cb_fp_key_mail_vorbereiten(p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v public.fachperson_konto := public._fp_ich(); g public.gratis_code; v_mail text := lower(trim(coalesce(p_email,'')));
        v_id bigint; v_max_key int; v_max_fp int; v_fp_mail text;
begin
  select * into g from public.gratis_code where code = upper(trim(p_code)) and fachperson_auth = v.auth_id;
  if not found then raise exception 'Diesen Key gibt es in diesem Konto nicht.' using errcode = '42501'; end if;
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
