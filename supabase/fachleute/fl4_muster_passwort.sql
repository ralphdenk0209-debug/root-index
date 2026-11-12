-- FL-4 (12.11.2026, Ralph): „Für Muster machen wir auch eine Anmeldung, aber nur mit einem Passwort das ich weitergeben kann“.
-- Musterpraxis nur noch mit EINEM gemeinsamen Passwort (kein Konto, keine E-Mail). Gespeichert wird nur ein bcrypt-Hash.
-- Richtiges Passwort → Zugang (Zufalls-Token, 8 Stunden, in der DB nur als SHA-256). Alle cb_fl_muster_* und cb_fl5_muster_*
-- prüfen über _fl_muster_token_ok → ohne gültigen Zugang keine Musterdaten.
-- Nicht mehr gültig: öffentliche Vorführung ('oeffentlich') und der alte Vorschau-Link (?z=, muster_token).
-- Angemeldete, freigeschaltete Fachleute und Admins sehen die Musterpraxis weiter ohne Passwort (_fl_wunsch_darf).
-- Passwort setzen/ändern/entfernen nur Admin. Ändern oder Entfernen beendet alle bisherigen Zugänge.
-- Bremse: je Absender 5 Fehlversuche in 15 Minuten, insgesamt 30 in 15 Minuten → bis dahin gesperrt (auch mit richtigem Passwort).
-- Geändert wird nur _fl_muster_token_ok; alles andere ist neu.

create table if not exists public.fl_muster_zugang (
  id           int primary key default 1 check (id = 1),
  hash         text,                                   -- bcrypt; null = kein Passwort, Musterpraxis zu
  geaendert_am timestamptz not null default now()
);
create table if not exists public.fl_muster_sitzung (
  token_hash  text primary key,                        -- SHA-256 des Zugangs, nie der Zugang selbst
  gueltig_bis timestamptz not null,
  angelegt_am timestamptz not null default now()
);
create table if not exists public.fl_muster_fehlversuch (
  id     bigserial primary key,
  quelle text not null,                                -- SHA-256 der Absender-Adresse, keine Adresse im Klartext
  zeit   timestamptz not null default now()
);
create index if not exists fl_muster_fehlversuch_zeit on public.fl_muster_fehlversuch(zeit);
alter table public.fl_muster_zugang      enable row level security;
alter table public.fl_muster_sitzung     enable row level security;
alter table public.fl_muster_fehlversuch enable row level security;
revoke all on public.fl_muster_zugang, public.fl_muster_sitzung, public.fl_muster_fehlversuch from anon, authenticated;
revoke all on sequence public.fl_muster_fehlversuch_id_seq from anon, authenticated;

-- Vorschau-Token: nur noch ein gültiger Zugang aus cb_fl_muster_anmelden (oder angemeldete Fachperson/Admin).
create or replace function public._fl_muster_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(length(p_token), 0) between 40 and 100
          and exists (select 1 from public.fl_muster_sitzung
                       where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and gueltig_bis > now()))
      or public._fl_wunsch_darf();
$$;
revoke all on function public._fl_muster_token_ok(text) from public, anon, authenticated;

create or replace function public._fl_muster_quelle()
returns text language plpgsql stable security definer set search_path = public as $f$
declare h jsonb;
begin
  begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
  return encode(extensions.digest(coalesce(nullif(h->>'cf-connecting-ip', ''), nullif(h->>'x-real-ip', ''),
                nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''), 'unbekannt'), 'sha256'), 'hex');
end $f$;
revoke all on function public._fl_muster_quelle() from public, anon, authenticated;

-- Anmeldung zur Musterpraxis. Antwort: {ok:true, token, gueltig_bis} oder {ok:false, grund:'falsch'|'gesperrt'}.
create or replace function public.cb_fl_muster_anmelden(p_passwort text)
returns jsonb language plpgsql volatile security definer set search_path = public as $f$
declare v_q text := public._fl_muster_quelle(); v_hash text; v_tok text; v_bis timestamptz := now() + interval '8 hours';
begin
  delete from public.fl_muster_fehlversuch where zeit < now() - interval '1 day';
  delete from public.fl_muster_sitzung where gueltig_bis < now();
  if (select count(*) from public.fl_muster_fehlversuch where quelle = v_q and zeit > now() - interval '15 minutes') >= 5
     or (select count(*) from public.fl_muster_fehlversuch where zeit > now() - interval '15 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;
  select hash into v_hash from public.fl_muster_zugang where id = 1;
  if v_hash is null or p_passwort is null or length(p_passwort) > 200
     or extensions.crypt(p_passwort, v_hash) is distinct from v_hash then
    insert into public.fl_muster_fehlversuch(quelle) values (v_q);
    return jsonb_build_object('ok', false, 'grund', 'falsch');
  end if;
  v_tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.fl_muster_sitzung(token_hash, gueltig_bis) values (encode(extensions.digest(v_tok, 'sha256'), 'hex'), v_bis);
  return jsonb_build_object('ok', true, 'token', v_tok, 'gueltig_bis', v_bis);
end $f$;

-- Admin: Passwort setzen oder ändern (p_passwort) bzw. entfernen (null). Beendet alle bisherigen Zugänge.
create or replace function public.cb_admin_fl_muster_passwort(p_passwort text)
returns jsonb language plpgsql volatile security definer set search_path = public as $f$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  if p_passwort is not null and length(p_passwort) < 10 then return jsonb_build_object('ok', false, 'grund', 'Mindestens 10 Zeichen.'); end if;
  if length(p_passwort) > 200 then return jsonb_build_object('ok', false, 'grund', 'Höchstens 200 Zeichen.'); end if;
  insert into public.fl_muster_zugang(id, hash, geaendert_am)
  values (1, case when p_passwort is null then null else extensions.crypt(p_passwort, extensions.gen_salt('bf', 10)) end, now())
  on conflict (id) do update set hash = excluded.hash, geaendert_am = excluded.geaendert_am;
  delete from public.fl_muster_sitzung where true;
  delete from public.fl_muster_fehlversuch where true;
  return jsonb_build_object('ok', true, 'gesetzt', p_passwort is not null, 'geaendert_am', now());
end $f$;

-- Admin: Stand ansehen (nie das Passwort, nie den Hash).
create or replace function public.cb_admin_fl_muster_passwort_stand()
returns jsonb language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'gesetzt',      exists (select 1 from public.fl_muster_zugang where id = 1 and hash is not null),
    'geaendert_am', (select geaendert_am from public.fl_muster_zugang where id = 1),
    'zugaenge',     (select count(*) from public.fl_muster_sitzung where gueltig_bis > now()),
    'fehlversuche', (select count(*) from public.fl_muster_fehlversuch where zeit > now() - interval '15 minutes'));
end $f$;

revoke all on function public.cb_fl_muster_anmelden(text) from public;
grant execute on function public.cb_fl_muster_anmelden(text) to anon, authenticated;
revoke all on function public.cb_admin_fl_muster_passwort(text) from public, anon;
grant execute on function public.cb_admin_fl_muster_passwort(text) to authenticated;
revoke all on function public.cb_admin_fl_muster_passwort_stand() from public, anon;
grant execute on function public.cb_admin_fl_muster_passwort_stand() to authenticated;
