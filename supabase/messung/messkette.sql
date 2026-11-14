-- Messkette Reel/Anzeige -> Klick -> App-Besuch -> Konto -> Probe -> bezahltes Abo
-- (Content Studio, Six-Sigma-Projekt "Root Index bekannt machen", N60/N61; Ralph 14.11.2026 "ja, alle so bauen")
--
-- Teil A  Herkunft je Konto: ri_herkunft_offen() fuer die Frage in der iPhone-App
-- Teil B  Bezahlstatus je Abo: Angebotsart, Preis, Waehrung, Transaktion je Apple-/Google-Meldung
--         + Kennzeichen "von Hand freigeschaltet" fuer Premium-Konten ohne Zahlungsquelle
-- Teil C  Schema "messung" mit Summen-Sichten ohne personenbezogene Spalten (nur Server/Admin)
--
-- Datensparsam: keine neuen personenbezogenen Daten. herkunft ist eine Kampagnen-Kennung
-- (z. B. w006, reel-b4, kanal-instagram, frage-tiktok), keine Geraete- oder Personenkennung.

begin;

-------------------------------------------------------------------------------
-- Teil A: Herkunft
-------------------------------------------------------------------------------

comment on column public."Benutzer".herkunft is
  'Kampagnen-Kennung beim Anlegen (a-z0-9-, max 40). Schema: w<Nr> = Werbung, reel-<Kennung> = Reel/Bio-Link, '
  'bio = Link in der Bio, nl-<Kennung> = Newsletter, utm-<quelle>-<kampagne> = fremde UTM-Links, '
  'kanal-<instagram|facebook|tiktok|youtube|pinterest|threads|google|bing|suche|andere|direkt> = nur Referrer erkannt, '
  'frage-<antwort> = Selbstauskunft in der iPhone-App. Nur Kennung, keine Person.';

-- Die iPhone-App fragt nach der Registrierung einmal "Wie bist du auf Root Index gekommen?".
-- Offen ist die Frage nur fuer ein neues Konto (< 2 Tage) ohne Herkunft. "Keine Angabe" wird als
-- frage-keine gespeichert, damit nie wieder gefragt wird (ohne Merker auf dem Geraet).
create or replace function public.ri_herkunft_offen()
returns boolean
language sql stable security definer
set search_path to 'public', 'auth'
as $$
  select coalesce((
    select b.herkunft is null and u.created_at > now() - interval '2 days'
      from public."Benutzer" b join auth.users u on u.id = b.auth_id
     where b.auth_id = auth.uid() limit 1), false);
$$;
revoke all on function public.ri_herkunft_offen() from public, anon;
grant execute on function public.ri_herkunft_offen() to authenticated;

-------------------------------------------------------------------------------
-- Teil B: Bezahlstatus je Abo
-------------------------------------------------------------------------------

alter table shadow_v1.apple_abo_protokoll
  add column if not exists transaktion_id text,
  add column if not exists kauf_am timestamptz,
  add column if not exists angebot text,          -- probe | einfuehrung | aktion | code | rueckgewinn | standard
  add column if not exists angebot_rabatt text,   -- Apple offerDiscountType: FREE_TRIAL | PAY_AS_YOU_GO | PAY_UP_FRONT | ONE_TIME
  add column if not exists preis_milli bigint,    -- Apple price: Preis x 1000 (4,99 EUR = 4990)
  add column if not exists waehrung text;
comment on column shadow_v1.apple_abo_protokoll.angebot is
  'probe = kostenlose Probe (FREE_TRIAL), einfuehrung = Einfuehrungsangebot mit Preis, aktion = Werbeangebot, '
  'code = Angebotscode, rueckgewinn = Win-back, standard = ohne Angebot (voller Preis). Aus der von Apple signierten Transaktion.';

alter table public.google_abo_protokoll
  add column if not exists transaktion_id text,
  add column if not exists kauf_am timestamptz,
  add column if not exists angebot text,
  add column if not exists angebot_rabatt text,
  add column if not exists preis_milli bigint,
  add column if not exists waehrung text;

-- Angebotsart aus den Apple-Feldern (offerType 1 Einfuehrung, 2 Werbung, 3 Code, 4 Win-back).
create or replace function public._ri_apple_angebot(p_offer_type text, p_rabatt text)
returns text language sql immutable as $$
  select case
    when nullif(p_offer_type,'') is null and nullif(p_rabatt,'') is null then 'standard'
    when upper(coalesce(p_rabatt,'')) = 'FREE_TRIAL' then 'probe'
    when p_offer_type = '1' then 'einfuehrung'
    when p_offer_type = '2' then 'aktion'
    when p_offer_type = '3' then 'code'
    when p_offer_type = '4' then 'rueckgewinn'
    else 'unbekannt' end
$$;

-- cb_apple_abo_setzen: gleiche Unterschrift, gleiche Buchung wie bisher. Neu: die Angebotsfelder,
-- die apple-kauf jetzt in p_roh mitschickt, landen in eigenen Spalten des Protokolls.
create or replace function public.cb_apple_abo_setzen(p_auth uuid, p_original_tx text, p_produkt text, p_bis timestamp with time zone, p_art text, p_umgebung text, p_roh jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
/* 01.10.2026 (Ralph: Premium in der App ueber Apple, Weg A). Nur service_role (Edge-Funktion apple-kauf).
   Die Edge-Funktion hat die Apple-Signatur geprueft; hier wird nur gebucht. Stripe-Abos bleiben unberuehrt:
   premium_bis wird nie verkuerzt, wenn ein anderes Abo (Stripe) noch laeuft.
   14.11.2026 (Messkette N61): Angebotsart, Preis, Waehrung, Transaktion und Kaufzeit ins Protokoll. */
declare v_bid text; v_akt boolean; v_kauf timestamptz;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') <> 'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'Nur Server.';
  end if;
  if p_auth is null and p_original_tx is not null then
    select auth_id into p_auth from public."Benutzer" where apple_original_tx = p_original_tx limit 1;
  end if;
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = p_auth;
  begin
    v_kauf := case when coalesce(p_roh->>'kauf_ms','') ~ '^[0-9]{10,14}$'
                   then to_timestamp((p_roh->>'kauf_ms')::bigint / 1000.0) end;
  exception when others then v_kauf := null;
  end;
  insert into shadow_v1.apple_abo_protokoll(auth_id, original_tx, produkt, art, ablauf, umgebung, roh,
                                            transaktion_id, kauf_am, angebot, angebot_rabatt, preis_milli, waehrung)
    values (p_auth, p_original_tx, p_produkt, p_art, p_bis, p_umgebung, p_roh,
            nullif(p_roh->>'transaktion',''), v_kauf,
            case when p_roh ? 'angebot_typ' or p_roh ? 'rabatt' or p_roh ? 'preis'
                 then public._ri_apple_angebot(p_roh->>'angebot_typ', p_roh->>'rabatt') end,
            nullif(p_roh->>'rabatt',''),
            case when coalesce(p_roh->>'preis','') ~ '^[0-9]{1,12}$' then (p_roh->>'preis')::bigint end,
            nullif(upper(p_roh->>'waehrung'),''));
  if v_bid is null then return jsonb_build_object('ok', false, 'grund', 'nutzer_unbekannt'); end if;
  v_akt := p_bis is not null and p_bis > now() and coalesce(p_art,'') not in ('REVOKE','REFUND','EXPIRED');
  update public."Benutzer" set
     apple_original_tx = coalesce(p_original_tx, apple_original_tx),
     abo_quelle = case when v_akt then 'apple' else abo_quelle end,
     is_premium = case when v_akt then true else is_premium end,
     tier = case when v_akt then 'premium' else tier end,
     premium_since = case when v_akt then coalesce(premium_since, now()) else premium_since end,
     premium_bis = case when v_akt then greatest(coalesce(premium_bis, p_bis), p_bis)
                        when abo_quelle = 'apple' then p_bis else premium_bis end
   where "Benutzer_ID" = v_bid;
  return jsonb_build_object('ok', true, 'aktiv', v_akt, 'bis', p_bis);
end $function$;

-- Premium ohne Zahlungsquelle: eigenes Kennzeichen statt abo_quelle, damit nichts anderes
-- (z. B. _fp_eigenes_abo) sein Verhalten aendert.
alter table public."Benutzer" add column if not exists premium_hand text;
comment on column public."Benutzer".premium_hand is
  'Premium ohne Zahlungsquelle: hand = von Hand freigeschaltet, intern = Admin/Beta-Tester. Nur fuer die Messung (14.11.2026).';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'benutzer_premium_hand_check') then
    alter table public."Benutzer" add constraint benutzer_premium_hand_check check (premium_hand in ('hand','intern'));
  end if;
end $$;

create table if not exists shadow_v1._sich_benutzer_premium_hand_20261114 as
  select "Benutzer_ID", premium_hand from public."Benutzer" where is_premium;

update public."Benutzer" set premium_hand = case when coalesce(is_admin,false) or coalesce("Beta_Tester",false) then 'intern' else 'hand' end
 where is_premium and premium_hand is null
   and abo_quelle is null and stripe_subscription_id is null and apple_original_tx is null and google_purchase_token is null;

-------------------------------------------------------------------------------
-- Teil C: Mess-Sichten (Schema messung, nur Summen)
-------------------------------------------------------------------------------

create schema if not exists messung;
revoke all on schema messung from public, anon, authenticated;
comment on schema messung is 'Messkette Content Studio (14.11.2026): nur Summen, keine personenbezogenen Spalten. Nicht ueber die API erreichbar.';

-- Herkunft in Gruppen fuer die Auswertung
create or replace function messung.herkunft_gruppe(h text)
returns text language sql immutable as $$
  select case
    when h is null then 'ohne'
    when h ~ '^w[0-9]+' then 'werbung'
    when h ~ '^(reel|bio|story)(-|$)' then 'reel-bio'
    when h ~ '^nl' then 'newsletter'
    when h ~ '^utm-' then 'utm'
    when h ~ '^kanal-' then h
    when h ~ '^frage-' then h
    else 'sonstige-kennung' end
$$;

-- Abo-Ereignisse je Abo (original_tx) und Quelle; Production und Sandbox getrennt.
create or replace view messung._abo_je_abo as
with e as (
  select 'apple'::text quelle, umgebung, auth_id, original_tx abo, coalesce(kauf_am, am) zeit, angebot, preis_milli, art
    from shadow_v1.apple_abo_protokoll
  union all
  select 'google', 'Production', auth_id, purchase_token, coalesce(kauf_am, am), angebot, preis_milli, art
    from public.google_abo_protokoll
)
select quelle, umgebung, abo, (array_agg(auth_id) filter (where auth_id is not null))[1] auth_id,
       min(zeit) filter (where angebot = 'probe') probe_am,
       min(zeit) filter (where angebot in ('standard','einfuehrung','aktion','code','rueckgewinn') and coalesce(preis_milli,0) > 0) bezahlt_am,
       min(zeit) filter (where art = 'DID_CHANGE_RENEWAL_STATUS:AUTO_RENEW_DISABLED') kuendigung_am,
       min(zeit) filter (where art in ('EXPIRED','REFUND','REVOKE')) ende_am,
       bool_or(angebot is null) hat_alte_zeilen
  from e group by quelle, umgebung, abo;
comment on view messung._abo_je_abo is 'Hilfssicht je Abo (enthaelt auth_id) - nicht fuer die Auswertung freigeben, nur Grundlage der Summen.';

-- Summen je Tag. umgebung: 'Production' fuer echte Zahlen, 'Sandbox' fuer Testkaeufe.
create or replace function messung.kette(p_umgebung text default 'Production')
returns table(tag date, besuche_app int, besuche_seiten int, besuche_instagram int, besuche_facebook int,
              besuche_tiktok int, besuche_suche int, besuche_direkt int,
              konten_neu int, konten_web int, konten_iphone int, konten_android int,
              konten_mit_herkunft int, konten_werbung int, konten_reel_bio int,
              proben int, umwandlungen int, bezahlt_neu int, bezahlt_ohne_probe int, kuendigungen int)
language sql stable security definer
set search_path to 'public', 'auth'
as $$
  with tage as (
    select generate_series(date '2026-09-21', (now() at time zone 'Europe/Berlin')::date, interval '1 day')::date tag
  ),
  bes as (
    select tag,
           sum(anzahl) filter (where seite = 'app' and quelle <> 'eigen')::int app,
           sum(anzahl) filter (where seite <> 'app' and quelle <> 'eigen')::int seiten,
           sum(anzahl) filter (where quelle = 'instagram')::int ig,
           sum(anzahl) filter (where quelle = 'facebook')::int fb,
           sum(anzahl) filter (where quelle = 'tiktok')::int tt,
           sum(anzahl) filter (where quelle in ('google','bing','andere-suche'))::int suche,
           sum(anzahl) filter (where quelle = 'direkt')::int direkt
      from public."Seiten_Aufrufe" group by tag
  ),
  kon as (
    select (u.created_at at time zone 'Europe/Berlin')::date tag,
           count(*)::int neu,
           count(*) filter (where b.anmelde_weg = 'Web')::int web,
           count(*) filter (where b.anmelde_weg = 'iPhone-App')::int iphone,
           count(*) filter (where b.anmelde_weg = 'Android-App')::int android,
           count(b.herkunft)::int mit_h,
           count(*) filter (where messung.herkunft_gruppe(b.herkunft) = 'werbung')::int werbung,
           count(*) filter (where messung.herkunft_gruppe(b.herkunft) = 'reel-bio')::int reel
      from public."Benutzer" b join auth.users u on u.id = b.auth_id
     where not coalesce(b.is_admin, false)
     group by 1
  ),
  abo as (select * from messung._abo_je_abo where umgebung = p_umgebung),
  ab as (
    select t.tag,
           (select count(*) from abo where (probe_am at time zone 'Europe/Berlin')::date = t.tag)::int proben,
           (select count(*) from abo where probe_am is not null and bezahlt_am > probe_am
                                       and (bezahlt_am at time zone 'Europe/Berlin')::date = t.tag)::int umw,
           (select count(*) from abo where (bezahlt_am at time zone 'Europe/Berlin')::date = t.tag)::int bez,
           (select count(*) from abo where probe_am is null and (bezahlt_am at time zone 'Europe/Berlin')::date = t.tag)::int bez_direkt,
           (select count(*) from abo where (kuendigung_am at time zone 'Europe/Berlin')::date = t.tag)::int kuend
      from tage t
  )
  select t.tag, coalesce(bes.app,0), coalesce(bes.seiten,0), coalesce(bes.ig,0), coalesce(bes.fb,0),
         coalesce(bes.tt,0), coalesce(bes.suche,0), coalesce(bes.direkt,0),
         coalesce(kon.neu,0), coalesce(kon.web,0), coalesce(kon.iphone,0), coalesce(kon.android,0),
         coalesce(kon.mit_h,0), coalesce(kon.werbung,0), coalesce(kon.reel,0),
         ab.proben, ab.umw, ab.bez, ab.bez_direkt, ab.kuend
    from tage t left join bes using (tag) left join kon using (tag) join ab using (tag)
   order by t.tag desc
$$;
revoke all on function messung.kette(text) from public, anon, authenticated;

create or replace view messung.kette_tag as select * from messung.kette('Production');
comment on view messung.kette_tag is
  'Messkette je Tag (Europe/Berlin): Besuche (ohne eigene Geraete), neue Konten je Weg und Herkunft, Proben, '
  'Umwandlungen Probe->bezahlt, neue bezahlte Abos, Kuendigungen. Nur Production. Abo-Zahlen erst ab 14.11.2026 vollstaendig '
  '(aeltere Apple-Meldungen ohne Angebotsart).';

create or replace view messung.kette_woche as
select date_trunc('week', tag)::date woche_ab,
       sum(besuche_app)::int besuche_app, sum(besuche_seiten)::int besuche_seiten,
       sum(besuche_instagram)::int besuche_instagram, sum(besuche_facebook)::int besuche_facebook,
       sum(besuche_tiktok)::int besuche_tiktok, sum(besuche_suche)::int besuche_suche, sum(besuche_direkt)::int besuche_direkt,
       sum(konten_neu)::int konten_neu, sum(konten_web)::int konten_web, sum(konten_iphone)::int konten_iphone,
       sum(konten_android)::int konten_android, sum(konten_mit_herkunft)::int konten_mit_herkunft,
       sum(konten_werbung)::int konten_werbung, sum(konten_reel_bio)::int konten_reel_bio,
       sum(proben)::int proben, sum(umwandlungen)::int umwandlungen, sum(bezahlt_neu)::int bezahlt_neu,
       sum(bezahlt_ohne_probe)::int bezahlt_ohne_probe, sum(kuendigungen)::int kuendigungen
  from messung.kette_tag group by 1 order by 1 desc;

-- Trichter je Herkunft: neue Konten -> davon mit Probe -> davon bezahlt (Production, ohne Admins).
create or replace view messung.trichter_herkunft as
with k as (
  select b.auth_id, coalesce(b.herkunft,'ohne') herkunft, messung.herkunft_gruppe(b.herkunft) gruppe,
         coalesce(b.anmelde_weg,'unbekannt') weg, (u.created_at at time zone 'Europe/Berlin')::date tag
    from public."Benutzer" b join auth.users u on u.id = b.auth_id
   where not coalesce(b.is_admin, false)
),
a as (select auth_id, min(probe_am) probe_am, min(bezahlt_am) bezahlt_am
        from messung._abo_je_abo where umgebung = 'Production' and auth_id is not null group by auth_id)
select date_trunc('week', k.tag)::date woche_ab, k.gruppe, k.herkunft, k.weg,
       count(*)::int konten,
       count(a.probe_am)::int mit_probe,
       count(a.bezahlt_am)::int bezahlt,
       count(*) filter (where a.probe_am is not null and a.bezahlt_am > a.probe_am)::int probe_zu_bezahlt
  from k left join a using (auth_id)
 group by 1,2,3,4 order by 1 desc, 5 desc;

-- Stand heute: wer ist Premium und warum (nur Summen).
create or replace view messung.premium_stand as
select coalesce(abo_quelle, premium_hand, 'unbekannt') quelle, count(*)::int konten,
       count(*) filter (where premium_bis is null or premium_bis > now())::int laufend
  from public."Benutzer" where is_premium group by 1 order by 2 desc;

revoke all on all tables in schema messung from public, anon, authenticated;
revoke all on all functions in schema messung from public, anon, authenticated;

commit;
