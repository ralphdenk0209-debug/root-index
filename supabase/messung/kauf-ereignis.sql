-- N100a (Ralph 17.11.2026 „N100a Kauf messen“): Bezahlseite und Kauf-Fehler messen.
-- Nur Tagessummen je Plattform, keine Nutzerkennung. Bis 05.11. lehnte apple-kauf jeden
-- Kauf ab, ohne dass es jemand merkte (#898). Jetzt zaehlen Web, iPhone und Server:
--   angebot_gesehen  Premium-Angebot/Kaufdialog wurde gezeigt
--   kauf_gestartet   Kaufknopf gedrueckt
--   kauf_abgebrochen Nutzer hat im Apple-/Stripe-Fenster abgebrochen
--   kauf_fehler      Kauf oder Freischaltung gescheitert (mit kurzem Grund)
--   kauf_ok          Freischaltung bestaetigt
-- Warnung: jeder kauf_fehler legt (hoechstens einmal je Stunde) eine Push-Nachricht fuer
-- Ralph (U000) in Push_Ausgang und zaehlt den Waechter-Schluessel wb_kauf_fehler (24 h).

create table if not exists public.kauf_ereignis_tag (
  tag       date not null,
  plattform text not null,
  ereignis  text not null,
  grund     text not null default '',
  anzahl    integer not null default 0,
  zuletzt   timestamptz not null default now(),
  primary key (tag, plattform, ereignis, grund)
);
alter table public.kauf_ereignis_tag enable row level security;
revoke all on public.kauf_ereignis_tag from anon, authenticated;

create or replace function public.cb_kauf_ereignis(p_ereignis text, p_plattform text, p_grund text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tag date := (now() at time zone 'Europe/Berlin')::date;
  v_grund text := left(regexp_replace(lower(coalesce(p_grund, '')), '[^a-z0-9äöüß_:. -]', '', 'g'), 60);
  v_fehler_24h int;
begin
  if p_ereignis not in ('angebot_gesehen','kauf_gestartet','kauf_abgebrochen','kauf_fehler','kauf_ok') then return; end if;
  if p_plattform not in ('web','ios','android','server-apple','server-google','server-stripe') then return; end if;
  -- Server-Eingaenge nur mit service_role, sonst koennte jeder „Server-Fehler“ melden.
  if p_plattform like 'server-%' and coalesce(auth.role(), '') <> 'service_role' then return; end if;
  if p_ereignis <> 'kauf_fehler' then v_grund := ''; end if;

  insert into public.kauf_ereignis_tag as k (tag, plattform, ereignis, grund, anzahl, zuletzt)
  values (v_tag, p_plattform, p_ereignis, v_grund, 1, now())
  on conflict (tag, plattform, ereignis, grund) do update set anzahl = k.anzahl + 1, zuletzt = now();

  if p_ereignis = 'kauf_fehler' then
    select coalesce(sum(anzahl), 0) into v_fehler_24h
      from public.kauf_ereignis_tag
     where ereignis = 'kauf_fehler' and zuletzt > now() - interval '24 hours';
    insert into public."Waechter_Zaehler_Cache"(schluessel, anzahl, stand)
    values ('wb_kauf_fehler', v_fehler_24h, now())
    on conflict (schluessel) do update set anzahl = excluded.anzahl, stand = excluded.stand;
    if not exists (select 1 from public."Push_Ausgang"
                    where quelle = 'kauf-fehler' and erstellt > now() - interval '1 hour') then
      insert into public."Push_Ausgang"("Empfaenger_ID", titel, text, url, quelle)
      values ('U000', '⚠️ Kauf gescheitert',
              'Ein Premium-Kauf ist gescheitert (' || p_plattform || coalesce(nullif(': ' || v_grund, ': '), '') || '). Bitte prüfen.',
              '/', 'kauf-fehler');
    end if;
  end if;
exception when others then
  -- Messen darf den Kauf nie stoeren.
  null;
end;
$function$;

revoke all on function public.cb_kauf_ereignis(text, text, text) from public, anon;
grant execute on function public.cb_kauf_ereignis(text, text, text) to authenticated, service_role;

create or replace view messung.kauf_tag as
select tag, plattform,
       coalesce(sum(anzahl) filter (where ereignis = 'angebot_gesehen'), 0)::int  as angebot_gesehen,
       coalesce(sum(anzahl) filter (where ereignis = 'kauf_gestartet'), 0)::int   as kauf_gestartet,
       coalesce(sum(anzahl) filter (where ereignis = 'kauf_abgebrochen'), 0)::int as kauf_abgebrochen,
       coalesce(sum(anzahl) filter (where ereignis = 'kauf_fehler'), 0)::int      as kauf_fehler,
       coalesce(sum(anzahl) filter (where ereignis = 'kauf_ok'), 0)::int          as kauf_ok,
       string_agg(grund || ' ×' || anzahl, ', ' order by anzahl desc) filter (where ereignis = 'kauf_fehler') as fehler_gruende
  from public.kauf_ereignis_tag
 group by tag, plattform
 order by tag desc, plattform;

grant select on messung.kauf_tag to studio_messung;
