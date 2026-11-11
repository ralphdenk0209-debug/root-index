-- =====================================================================
-- FL-1 Nachtrag: Abrechnung der Fachleute ueber Stripe (11.11.2026)
-- ENTWURF - noch nicht eingespielt. Einspielen nur nach Ralphs "jaja".
--
-- Ablauf:
--   1. Die Fachperson hinterlegt EINMAL eine Zahlungsart (SEPA-Lastschrift
--      oder Karte) ueber Stripe Checkout im Setup-Modus. Kein eigenes
--      Stripe-Konto noetig - sie wird Kundin im Root-Index-Stripe.
--   2. Am 1. jedes Monats erstellt fp-monatsrechnung fuer den Vormonat je
--      Fachperson eine Stripe-Rechnung aus _fp_abrechnung (Keys x Preis,
--      ggf. Lizenz) und zieht sie automatisch ein. Kein Abo, keine
--      Produkte/Preise in Stripe noetig.
--   3. Rechnungen sieht sie in therapeut.html (Liste) und im
--      Stripe-Kundenportal (PDF, Zahlungsart aendern).
--
-- Grenzen: Die Premium-Anbindung (stripe-checkout, Webhook, Benutzer.stripe_*,
-- STRIPE_SECRET_KEY) bleibt unberuehrt. Eigener Schluessel STRIPE_FP_SECRET_KEY.
-- Modus 'test'/'live' in fachleute_einstellung.stripe_modus; Test- und
-- Live-Kundinnen werden getrennt gespeichert und nie vermischt.
-- An Stripe gehen nur Name/Praxis/E-Mail der Fachperson und Anzahl der Keys,
-- NIE Namen, Bezeichnungen oder Codes von Klienten.
-- Rechte wie im Fundament: RLS an, keine Policies, keine Rechte fuer
-- anon/authenticated; Zugriff nur ueber die Funktionen unten.
-- =====================================================================

insert into public.fachleute_einstellung(schluessel, wert, notiz)
values ('stripe_modus', 'test', 'Stripe-Abrechnung der Fachleute: test oder live. Live erst nach Ralphs jaja.')
on conflict (schluessel) do nothing;

-- 1) Stripe-Kundin je Fachperson und Modus -----------------------------
create table if not exists public.fachperson_stripe (
  auth_id        uuid not null references public.fachperson_konto(auth_id) on delete cascade,
  modus          text not null check (modus in ('test','live')),
  customer_id    text not null,
  zahlungsart    text,            -- Anzeige, z. B. 'SEPA-Lastschrift ···1234'
  zahlungsart_am timestamptz,
  angelegt_am    timestamptz not null default now(),
  primary key (auth_id, modus),
  unique (modus, customer_id)
);
alter table public.fachperson_stripe enable row level security;
revoke all on public.fachperson_stripe from anon, authenticated;

-- 2) Monatsrechnungen (eine je Fachperson, Monat, Modus) ---------------
create table if not exists public.fachperson_rechnung (
  id                bigserial primary key,
  auth_id           uuid not null references public.fachperson_konto(auth_id),
  modus             text not null check (modus in ('test','live')),
  monat             date not null check (monat = date_trunc('month', monat)::date),
  keys              integer not null default 0,
  keys_betrag_cent  integer not null default 0,
  lizenz_betrag_cent integer not null default 0,
  betrag_cent       integer not null,
  status            text not null default 'angelegt'
                    check (status in ('angelegt','offen','bezahlt','fehlgeschlagen','ohne_zahlungsart','fehler','storniert')),
  stripe_invoice_id text,
  rechnung_nr       text,
  rechnung_url      text,
  pdf_url           text,
  fehler            text,
  erstellt_am       timestamptz not null default now(),
  aktualisiert_am   timestamptz,
  unique (auth_id, modus, monat)
);
alter table public.fachperson_rechnung enable row level security;
revoke all on public.fachperson_rechnung from anon, authenticated;
revoke all on sequence public.fachperson_rechnung_id_seq from anon, authenticated;

-- 3) intern ------------------------------------------------------------
create or replace function public._fp_stripe_modus()
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce((select wert from public.fachleute_einstellung where schluessel = 'stripe_modus'), 'test');
$$;
revoke all on function public._fp_stripe_modus() from public, anon, authenticated;
grant execute on function public._fp_stripe_modus() to service_role;

-- Liste fuer den Monatslauf (nur service_role / Edge-Funktion):
-- alle Fachpersonen mit Betrag > 0 im Monat, dazu Kundin und ob schon abgerechnet.
create or replace function public._fp_stripe_monatsliste(p_monat date)
returns table(auth_id uuid, name text, praxis text, email text, modus text,
              customer_id text, zahlungsart text,
              monat date, abrechnung text, modell text, keys integer, key_tage integer, preis_cent integer,
              keys_betrag_cent integer, lizenz_betrag_cent integer, betrag_cent integer,
              rechnung_status text, stripe_invoice_id text)
language sql stable security definer set search_path to 'public', 'auth' as $$
  select f.auth_id, f.name, f.praxis, u.email::text, public._fp_stripe_modus(),
         s.customer_id, s.zahlungsart,
         a.monat, a.abrechnung, a.modell, a.keys_aktiv, a.key_tage, a.preis_cent,
         a.keys_betrag_cent, a.lizenz_betrag_cent, a.betrag_cent,
         r.status, r.stripe_invoice_id
    from public._fp_abrechnung(null, p_monat) a
    join public.fachperson_konto f on f.auth_id = a.fachperson_auth
    join auth.users u on u.id = f.auth_id
    left join public.fachperson_stripe s on s.auth_id = f.auth_id and s.modus = public._fp_stripe_modus()
    left join public.fachperson_rechnung r on r.auth_id = f.auth_id and r.modus = public._fp_stripe_modus() and r.monat = a.monat
   where a.betrag_cent > 0;
$$;
revoke all on function public._fp_stripe_monatsliste(date) from public, anon, authenticated;
grant execute on function public._fp_stripe_monatsliste(date) to service_role;

-- Fuer fp-zahlung: Kundin der angemeldeten Fachperson (prueft _fp_ich).
create or replace function public.cb_fp_stripe_kundin()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $$
declare v public.fachperson_konto := public._fp_ich(); s public.fachperson_stripe;
begin
  select * into s from public.fachperson_stripe where auth_id = v.auth_id and modus = public._fp_stripe_modus();
  return jsonb_build_object('auth_id', v.auth_id, 'name', v.name, 'praxis', v.praxis,
                            'email', (select email from auth.users where id = v.auth_id),
                            'modus', public._fp_stripe_modus(), 'customer_id', s.customer_id);
end $$;
revoke all on function public.cb_fp_stripe_kundin() from public, anon;
grant execute on function public.cb_fp_stripe_kundin() to authenticated;

-- 4) fuer therapeut.html: Zahlungsart und Rechnungen ------------------
create or replace function public.cb_fp_zahlung_stand()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); s public.fachperson_stripe; m text := public._fp_stripe_modus();
begin
  select * into s from public.fachperson_stripe where auth_id = v.auth_id and modus = m;
  return jsonb_build_object(
    'modus', m,
    'zahlungsart', s.zahlungsart,
    'zahlungsart_am', s.zahlungsart_am,
    'rechnungen', coalesce((
      select jsonb_agg(jsonb_build_object('monat', r.monat, 'keys', r.keys, 'betrag_cent', r.betrag_cent,
                                          'status', r.status, 'rechnung_nr', r.rechnung_nr,
                                          'rechnung_url', r.rechnung_url, 'pdf_url', r.pdf_url)
                       order by r.monat desc)
        from (select * from public.fachperson_rechnung
               where auth_id = v.auth_id and modus = m order by monat desc limit 24) r), '[]'::jsonb));
end $$;
revoke all on function public.cb_fp_zahlung_stand() from public, anon;
grant execute on function public.cb_fp_zahlung_stand() to authenticated;

-- 5) Admin: Uebersicht aller Rechnungen eines Monats --------------------
create or replace function public.cb_admin_fachleute_rechnungen(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name', f.name, 'praxis', f.praxis, 'monat', r.monat, 'modus', r.modus,
             'keys', r.keys, 'betrag_cent', r.betrag_cent, 'status', r.status, 'fehler', r.fehler,
             'rechnung_nr', r.rechnung_nr, 'rechnung_url', r.rechnung_url) order by r.monat desc, f.name)
      from public.fachperson_rechnung r join public.fachperson_konto f on f.auth_id = r.auth_id
     where p_monat is null or r.monat = date_trunc('month', p_monat)::date), '[]'::jsonb);
end $$;
revoke all on function public.cb_admin_fachleute_rechnungen(date) from public, anon;
grant execute on function public.cb_admin_fachleute_rechnungen(date) to authenticated;
