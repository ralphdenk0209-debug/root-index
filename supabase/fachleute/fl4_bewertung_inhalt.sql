-- FL-4 (11.11.2026): „So bewertet Root Index“ im Fachleute-Bereich.
-- Die vertrauliche Fachleute-Fassung (FL-3) liegt NICHT im Repo (GitHub-Repo ist öffentlich, Webspace bekommt das Repo)
-- und nicht als Datei auf dem Webspace, sondern nur in der Datenbank (Tabelle fl_inhalt).
-- Der Text wird getrennt eingespielt: SQL mit Inhalt liegt in iCloud unter
--   Projekte/Root Index/Fachleute/intern-nicht-herausgeben/fl4_bewertung_inhalt_MIT_TEXT.sql
-- Abruf nur über cb_fp_inhalt(): freigeschaltete Fachperson mit gültiger Lizenz und bestätigter
-- Verschwiegenheitsvereinbarung, oder Admin. Neue Fassung von FL-3: Zeile 'bewertung_fachleute' aktualisieren.
create table if not exists public.fl_inhalt (
  schluessel   text primary key,
  titel        text not null,
  html         text not null,
  stand        text not null,
  geaendert_am timestamptz not null default now()
);
alter table public.fl_inhalt enable row level security;
revoke all on public.fl_inhalt from anon, authenticated;

create or replace function public.cb_fp_inhalt(p_schluessel text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare r public.fl_inhalt;
begin
  if not public._fl_wunsch_darf() then
    raise exception 'Nur für freigeschaltete Fachleute mit bestätigter Vereinbarung.' using errcode = '42501'; end if;
  select * into r from public.fl_inhalt where schluessel = p_schluessel;
  if r.schluessel is null then return jsonb_build_object('ok', false, 'grund', 'Diesen Inhalt gibt es nicht.'); end if;
  return jsonb_build_object('ok', true, 'titel', r.titel, 'html', r.html, 'stand', r.stand);
end $f$;
revoke all on function public.cb_fp_inhalt(text) from public, anon;
grant execute on function public.cb_fp_inhalt(text) to authenticated;
