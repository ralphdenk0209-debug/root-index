-- pro_anfrage.sql · 14.11.2026 · Anfrageformular auf der Zielseite pro.html (Root Index Pro)
-- Ralph 14.11. (über den Steuerungs-Chat): Name, Praxis, E-Mail, Nachricht (optional), Pflicht-Haken Datenschutz,
-- Honeypot, Bremse, Herkunft mitspeichern, Ralph sieht jede Anfrage sofort.
--
-- Aufbau
--   public.pro_anfrage           neue Tabelle, RLS an, anon/authenticated ohne Tabellenrechte (nur Admins lesen per Policy)
--   public.pro_anfrage_senden()  security definer, anon darf sie aufrufen; prüft, bremst, speichert
--   Mail an kontakt@root-index.de über den BESTEHENDEN Weg: die Funktion legt zusätzlich eine Zeile in
--   "Kontakt_Anfragen" an (typ 'Root Index Pro'); deren AFTER-INSERT-Trigger trg_kontakt_weiterleiten ruft die
--   Edge-Funktion kontakt-weiterleiten (SMTP über webspace.bz, Reply-To = Absender). Keine neuen Schlüssel.
--   Scheitert die Mail, bleibt die Anfrage gespeichert, der Fehler steht in "Kontakt_Anfragen".weiterleitung_fehler.
--
-- Bremse: höchstens 3 Anfragen je E-Mail in 24 Stunden und höchstens 20 Anfragen insgesamt je Stunde
-- (schützt das Postfach, falls jemand mit wechselnden Adressen flutet).
-- Honeypot: ist das unsichtbare Feld gefüllt, antwortet die Funktion "ok" und speichert nichts.
-- Datenschutz: Kontaktanfragen sind in der Datenschutzerklärung Abschnitt 13 abgedeckt (Löschung 12 Monate
-- nach Abschluss). Herkunft ist nur eine Kampagnen-Kennung (a-z0-9-, max 40), keine Person.
--
-- Diese Datei hat bewusst KEIN begin/commit: Probelauf = Datei + pro_anfrage_test.sql in EINEM Aufruf,
-- der Test endet mit RAISE, damit alles zurückgerollt wird. Live als Migration (z. B. pro_anfrage_20261114).

create table if not exists public.pro_anfrage (
  id               bigint generated always as identity primary key,
  angelegt_am      timestamptz not null default now(),
  name             text not null check (char_length(name) between 2 and 120),
  praxis           text not null check (char_length(praxis) between 2 and 160),
  email            text not null check (char_length(email) between 6 and 200),
  nachricht        text check (nachricht is null or char_length(nachricht) <= 3000),
  herkunft         text check (herkunft is null or herkunft ~ '^[a-z0-9-]{1,40}$'),
  einwilligung_am  timestamptz not null,
  kontakt_id       bigint,                                    -- Zeile in "Kontakt_Anfragen" (Mail-Weg)
  status           text not null default 'offen' check (status in ('offen', 'erledigt', 'spam'))
);
comment on table public.pro_anfrage is
  'Anfragen über das Formular auf pro.html (Root Index Pro). Schreiben nur über pro_anfrage_senden(). '
  'Mail an kontakt@ über "Kontakt_Anfragen" (kontakt_id). Löschen 12 Monate nach Abschluss (Datenschutz Abschnitt 13/18).';

create index if not exists pro_anfrage_email_zeit on public.pro_anfrage (lower(email), angelegt_am);
create index if not exists pro_anfrage_zeit on public.pro_anfrage (angelegt_am);

alter table public.pro_anfrage enable row level security;
revoke all on public.pro_anfrage from public, anon, authenticated;
grant select, update on public.pro_anfrage to authenticated;          -- greift nur über die Policies (Admins)
drop policy if exists pro_anfrage_admin_lesen on public.pro_anfrage;
create policy pro_anfrage_admin_lesen on public.pro_anfrage for select to authenticated using (public.cb_ist_admin());
drop policy if exists pro_anfrage_admin_status on public.pro_anfrage;
create policy pro_anfrage_admin_status on public.pro_anfrage for update to authenticated
  using (public.cb_ist_admin()) with check (public.cb_ist_admin());

create or replace function public.pro_anfrage_senden(
  p_name text, p_praxis text, p_email text, p_nachricht text default null,
  p_herkunft text default null, p_einwilligung boolean default false, p_falle text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text := left(btrim(regexp_replace(coalesce(p_name, ''),   '\s+', ' ', 'g')), 120);
  v_praxis   text := left(btrim(regexp_replace(coalesce(p_praxis, ''), '\s+', ' ', 'g')), 160);
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_nachr    text := nullif(btrim(coalesce(p_nachricht, '')), '');
  v_herkunft text := left(btrim(regexp_replace(lower(coalesce(p_herkunft, '')), '[^a-z0-9]+', '-', 'g'), '-'), 40);
  v_id bigint; v_kid bigint;
begin
  -- Honeypot: Menschen sehen das Feld nicht. Gefüllt = Programm. Freundlich "ok", nichts speichern.
  if nullif(btrim(coalesce(p_falle, '')), '') is not null then
    return jsonb_build_object('ok', true);
  end if;
  if not coalesce(p_einwilligung, false) then
    return jsonb_build_object('ok', false, 'grund', 'einwilligung');
  end if;
  if char_length(v_name) < 2 then return jsonb_build_object('ok', false, 'grund', 'name'); end if;
  if char_length(v_praxis) < 2 then return jsonb_build_object('ok', false, 'grund', 'praxis'); end if;
  if char_length(v_email) > 200 or v_email !~ '^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]{2,}$' then
    return jsonb_build_object('ok', false, 'grund', 'email');
  end if;
  if v_nachr is not null and char_length(v_nachr) > 3000 then
    return jsonb_build_object('ok', false, 'grund', 'nachricht_lang');
  end if;
  v_herkunft := rtrim(v_herkunft, '-');
  if v_herkunft !~ '^[a-z0-9-]{1,40}$' then v_herkunft := null; end if;

  -- Bremse
  if (select count(*) from public.pro_anfrage
       where lower(email) = v_email and angelegt_am > now() - interval '24 hours') >= 3
     or (select count(*) from public.pro_anfrage where angelegt_am > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele');
  end if;

  insert into public.pro_anfrage (name, praxis, email, nachricht, herkunft, einwilligung_am)
  values (v_name, v_praxis, v_email, v_nachr, v_herkunft, now())
  returning id into v_id;

  -- Mail an kontakt@ über den bestehenden Weg (Trigger auf "Kontakt_Anfragen")
  insert into public."Kontakt_Anfragen" (typ, benutzer_id, name, email, nachricht)
  values ('Root Index Pro', null, v_name || ' (' || v_praxis || ')', v_email,
          'Anfrage über root-index.de/pro.html (Root Index Pro)' || chr(10) ||
          'Praxis:   ' || v_praxis || chr(10) ||
          'Herkunft: ' || coalesce(v_herkunft, '–') || chr(10) ||
          'Datenschutz-Haken gesetzt: ja' || chr(10) || chr(10) ||
          coalesce(v_nachr, '(keine Nachricht)') || chr(10) || chr(10) ||
          'pro_anfrage #' || v_id)
  returning id into v_kid;
  update public.pro_anfrage set kontakt_id = v_kid where id = v_id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.pro_anfrage_senden(text, text, text, text, text, boolean, text) from public;
grant execute on function public.pro_anfrage_senden(text, text, text, text, text, boolean, text) to anon, authenticated;
