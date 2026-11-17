/* N15 (Ralph „jaja“ 17.11.2026, weitergeleitet vom Steuerungs-Chat): Meldung an den Nutzer, wenn seine
   Riki-Erfassung haengt. Erfassung, Riki und Freigabe bleiben unveraendert - hier wird nur GELESEN,
   was mit den eigenen Auftraegen ist, und gemerkt, welche Meldung der Nutzer schon weggeklickt hat.
   Neu: Tabelle shadow_v1.erfassung_hinweis_gesehen, Funktionen shadow_v1._erfassung_haengt,
   public.cb_meine_erfassungen_haengen, public.cb_meine_erfassungen_gesehen. Nichts Bestehendes geaendert.
   Rueckweg: drop function public.cb_meine_erfassungen_gesehen(text[]); drop function public.cb_meine_erfassungen_haengen();
             drop function shadow_v1._erfassung_haengt(text); drop table shadow_v1.erfassung_hinweis_gesehen; */

create table if not exists shadow_v1.erfassung_hinweis_gesehen(
  benutzer_id text not null,
  produkt_id  text not null,
  art         text not null,
  am          timestamptz not null default now(),
  primary key (benutzer_id, produkt_id)
);
alter table shadow_v1.erfassung_hinweis_gesehen enable row level security;
revoke all on shadow_v1.erfassung_hinweis_gesehen from anon, authenticated;

create or replace function shadow_v1._erfassung_haengt(p_bid text)
returns table(job_id bigint, produkt_id text, name text, ean text, art text, titel text, text text, foto boolean)
language sql stable security definer set search_path to 'public','shadow_v1','pg_temp'
as $f$
  with letzte as (
    select distinct on (j.produkt_id) j.job_id, j.produkt_id, j.status, j.erstellt_am, j.beendet_am, j.ergebnis_meta
      from shadow_v1.riki_scan_job j
     where j.benutzer_id = p_bid and j.produkt_id is not null
       and j.erstellt_am > now() - interval '30 days'
     order by j.produkt_id, j.erstellt_am desc
  ), lage as (
    select l.job_id, l.produkt_id, p."Produktname" name, p."EAN_GTIN" ean, p."Produktstatus" ps, p."Kategorie" kat,
           coalesce(l.ergebnis_meta->>'kein_lebensmittel','') <> '' kl,
           (select count(*) from public."Produkt_Zutaten" z where z."Produkt_ID" = l.produkt_id) zut,
           exists(select 1 from public."Naehrwerte_Makro" n where n."Produkt_ID" = l.produkt_id and n.kcal_100g_ml is not null) nw,
           coalesce(p."Kategorie",'') ilike '%supplement%' supp
      from letzte l
      join public."Produkte" p on p."Produkt_ID" = l.produkt_id
      left join public."Scores" s on s."Produkt_ID" = l.produkt_id
     where not (p."Produktstatus" = 'Aktiv' and s."Clean_Score" is not null)          -- fertig: meldet cb_riki_scan_index_neu
       and (l.status in ('gehalten','fehler')
            or (l.status in ('offen','laeuft') and l.erstellt_am < now() - interval '2 hours'))
       and coalesce(l.beendet_am, l.erstellt_am) < now() - interval '10 minutes'      -- die ersten Minuten zeigt der Scan selbst
  ), art as (
    select g.*, case
        when g.kl or (g.ps = 'Abgelehnt' and g.kat = 'Sonstiges') then 'kein_lebensmittel'
        when g.ps = 'Abgelehnt' then 'abgelehnt'
        when g.zut = 0 and not g.nw and not g.supp then 'foto_beides'
        when g.zut = 0 then 'foto_zutaten'
        when not g.nw and not g.supp then 'foto_naehrwerte'
        else 'pruefung' end a
      from lage g
  )
  select a.job_id, a.produkt_id, coalesce(nullif(btrim(a.name),''),'Dein Produkt'), a.ean, a.a,
         case a.a when 'kein_lebensmittel' then 'Kein Lebensmittel'
                  when 'abgelehnt' then 'Nicht übernommen'
                  when 'pruefung' then 'Wir prüfen noch'
                  else 'Bitte noch ein Foto' end,
         case a.a
           when 'kein_lebensmittel' then 'Das ist kein Lebensmittel – Root Index bewertet nur Lebensmittel und Supplements.'
           when 'abgelehnt' then 'Dieses Produkt konnten wir so nicht übernehmen. Bei Fragen schreib uns über Kontakt.'
           when 'foto_beides' then 'Wir konnten Zutatenliste und Nährwerte nicht lesen. Bitte fotografiere die Rückseite noch einmal – gerade, nah und scharf.'
           when 'foto_zutaten' then 'Wir konnten die Zutatenliste nicht lesen. Bitte fotografiere sie noch einmal – gerade, nah und scharf.'
           when 'foto_naehrwerte' then 'Uns fehlen noch die Nährwerte. Bitte fotografiere die Nährwerttabelle.'
           else 'Ist angekommen. Wir prüfen es noch von Hand, das dauert etwas länger. Sobald der Index steht, siehst du es hier.' end,
         a.a like 'foto%'
    from art a
   where not exists (select 1 from shadow_v1.erfassung_hinweis_gesehen h
                      where h.benutzer_id = p_bid and h.produkt_id = a.produkt_id and h.art = a.a)
   order by a.job_id desc
$f$;
revoke all on function shadow_v1._erfassung_haengt(text) from public, anon, authenticated;

create or replace function public.cb_meine_erfassungen_haengen()
returns jsonb language plpgsql stable security definer set search_path to 'public','shadow_v1','pg_temp'
as $f$
/* N15: eigene Erfassungen, die nicht durchgehen, mit Grund in einfachen Worten. Nur noch nicht weggeklickte. */
declare v_bid text;
begin
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  if v_bid is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from shadow_v1._erfassung_haengt(v_bid) x), '[]'::jsonb);
end $f$;

create or replace function public.cb_meine_erfassungen_gesehen(p_produkt_ids text[])
returns integer language plpgsql security definer set search_path to 'public','shadow_v1','pg_temp'
as $f$
/* N15: Nutzer hat die Meldung weggeklickt. Gemerkt wird die Art - aendert sich der Grund, kommt sie wieder. */
declare v_bid text; v_n int;
begin
  select "Benutzer_ID" into v_bid from public."Benutzer" where auth_id = auth.uid();
  if v_bid is null then return 0; end if;
  insert into shadow_v1.erfassung_hinweis_gesehen(benutzer_id, produkt_id, art, am)
  select v_bid, x.produkt_id, x.art, now() from shadow_v1._erfassung_haengt(v_bid) x
   where x.produkt_id = any(coalesce(p_produkt_ids,'{}'))
  on conflict (benutzer_id, produkt_id) do update set art = excluded.art, am = excluded.am;
  get diagnostics v_n = row_count;
  return v_n;
end $f$;

revoke all on function public.cb_meine_erfassungen_haengen() from public, anon;
revoke all on function public.cb_meine_erfassungen_gesehen(text[]) from public, anon;
grant execute on function public.cb_meine_erfassungen_haengen() to authenticated;
grant execute on function public.cb_meine_erfassungen_gesehen(text[]) to authenticated;
