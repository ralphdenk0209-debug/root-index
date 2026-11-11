-- FL-1 Nachtrag 11.11.2026 (Ralph „jaja, einbauen“): Key-Preis und Abrechnungsmodell je Fachperson.
-- Gleicher Inhalt wie in fl1_fundament.sql (dort fuehrend).

-- 11.11.2026 (Ralph jaja): Preis und Abrechnungsmodell je Fachperson, leer = globaler Standard
alter table public.fachperson_konto
  add column if not exists key_preis_cent integer check (key_preis_cent is null or key_preis_cent >= 0),
  add column if not exists abrechnungsmodell text check (abrechnungsmodell is null or abrechnungsmodell in ('je_key','lizenz_pauschal','lizenz_plus_keys','gratis'));
insert into public.fachleute_einstellung(schluessel, wert, notiz) values
  ('abrechnungsmodell','je_key','Standard je Fachperson: je_key | lizenz_pauschal | lizenz_plus_keys | gratis (Ralph 11.11.)')
on conflict (schluessel) do nothing;

drop function if exists public._fp_abrechnung(uuid, date);
create or replace function public._fp_abrechnung(p_fp uuid, p_monat date)
returns table(fachperson_auth uuid, monat date, keys_aktiv integer, key_tage integer, keys_neu integer,
              abrechnung text, preis_cent integer, betrag_cent integer,
              lizenz_art text, lizenz_preis_cent integer, lizenz_intervall text, lizenz_bis timestamptz,
              modell text, keys_betrag_cent integer, lizenz_betrag_cent integer)
language sql stable security definer set search_path to 'public' as $$
  with m as (select date_trunc('month', coalesce(p_monat, (now() at time zone 'Europe/Berlin')::date))::date monat),
  e as (select coalesce((select wert from public.fachleute_einstellung where schluessel='abrechnung'),'monat') art,
               coalesce((select wert::int from public.fachleute_einstellung where schluessel='preis_cent'),0) preis,
               coalesce((select wert from public.fachleute_einstellung where schluessel='abrechnungsmodell'),'je_key') modell),
  k as (
    select g.fachperson_auth, g.start_am,
           public._fp_key_tage(g.start_am, least(g.laeuft_bis, coalesce(g.beendet_am, g.laeuft_bis), now()), m.monat) tage
      from public.gratis_code g, m
     where g.fachperson_auth is not null and g.start_am is not null
       and (p_fp is null or g.fachperson_auth = p_fp)),
  z as (
    select f.auth_id, m.monat,
           count(k.tage) filter (where k.tage > 0)::int aktiv,
           coalesce(sum(k.tage),0)::int tage,
           count(k.start_am) filter (where date_trunc('month', k.start_am at time zone 'Europe/Berlin')::date = m.monat)::int neu
      from public.fachperson_konto f cross join m
      left join k on k.fachperson_auth = f.auth_id
     where (p_fp is null or f.auth_id = p_fp)
     group by f.auth_id, m.monat),
  b as (
    select z.*, f.lizenz_art, f.lizenz_preis_cent, f.lizenz_intervall, f.lizenz_bis, e.art,
           coalesce(f.key_preis_cent, e.preis) kp,
           coalesce(f.abrechnungsmodell, e.modell) mo,
           case when f.lizenz_art = 'lizenz_bezahlt' and coalesce(f.lizenz_preis_cent,0) > 0
                     and (f.lizenz_bis is null or f.lizenz_bis >= z.monat)
                     and f.seit < (z.monat + interval '1 month')
                     and (coalesce(f.lizenz_intervall,'monat') = 'monat'
                          or extract(month from f.seit at time zone 'Europe/Berlin') = extract(month from z.monat))
                then f.lizenz_preis_cent else 0 end lz
      from z cross join e join public.fachperson_konto f on f.auth_id = z.auth_id),
  c as (
    select b.*, case when b.art = 'tag'
                     then round(b.tage * b.kp::numeric / extract(day from (b.monat + interval '1 month' - interval '1 day')))::int
                     else b.aktiv * b.kp end kb
      from b)
  select c.auth_id, c.monat, c.aktiv, c.tage, c.neu, c.art, c.kp,
         case c.mo when 'gratis' then 0 when 'je_key' then c.kb when 'lizenz_pauschal' then c.lz else c.lz + c.kb end,
         c.lizenz_art, c.lizenz_preis_cent, c.lizenz_intervall, c.lizenz_bis,
         c.mo,
         case when c.mo in ('je_key','lizenz_plus_keys') then c.kb else 0 end,
         case when c.mo in ('lizenz_pauschal','lizenz_plus_keys') then c.lz else 0 end
    from c;
$$;
revoke all on function public._fp_abrechnung(uuid, date) from public, anon, authenticated;

create or replace function public.cb_fp_abrechnung(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v public.fachperson_konto := public._fp_ich(); r record;
begin
  select * into r from public._fp_abrechnung(v.auth_id, p_monat);
  return jsonb_build_object('monat', r.monat, 'keys_aktiv', r.keys_aktiv, 'key_tage', r.key_tage, 'keys_neu', r.keys_neu,
                            'abrechnung', r.abrechnung, 'preis_cent', r.preis_cent, 'betrag_cent', r.betrag_cent,
                            'modell', r.modell, 'keys_betrag_cent', r.keys_betrag_cent, 'lizenz_betrag_cent', r.lizenz_betrag_cent,
                            'lizenz_art', r.lizenz_art, 'lizenz_preis_cent', r.lizenz_preis_cent, 'lizenz_intervall', r.lizenz_intervall);
end $$;

create or replace function public.cb_admin_fachperson_abrechnung(p_email text, p_modell text default null, p_key_preis_cent integer default null,
                                                                 p_lizenz_preis_cent integer default null, p_lizenz_intervall text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'auth' as $$
declare v_uid uuid;
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  select f.auth_id into v_uid from public.fachperson_konto f join auth.users u on u.id = f.auth_id where lower(u.email) = lower(trim(p_email));
  if v_uid is null then return jsonb_build_object('ok',false,'grund','Keine Fachperson mit dieser E-Mail.'); end if;
  if p_modell is not null and p_modell not in ('je_key','lizenz_pauschal','lizenz_plus_keys','gratis') then
    return jsonb_build_object('ok',false,'grund','Modell: je_key, lizenz_pauschal, lizenz_plus_keys oder gratis.'); end if;
  update public.fachperson_konto set abrechnungsmodell = p_modell, key_preis_cent = p_key_preis_cent,
         lizenz_preis_cent = p_lizenz_preis_cent, lizenz_intervall = p_lizenz_intervall
   where auth_id = v_uid;
  return jsonb_build_object('ok',true,'fachperson',(select to_jsonb(f) from public.fachperson_konto f where auth_id = v_uid));
end $$;

create or replace function public.cb_admin_fachleute(p_monat date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'auth' as $$
begin
  if not public.cb_ist_admin() then raise exception 'Nur Admins.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('name',f.name,'praxis',f.praxis,'kuerzel',f.kuerzel,'aktiv',f.aktiv,
             'email',(select email from auth.users u where u.id = f.auth_id),
             'vertrag_ok', public._fp_vertrag_ok(f.auth_id),
             'monat',a.monat,'keys_aktiv',a.keys_aktiv,'key_tage',a.key_tage,'keys_neu',a.keys_neu,
             'abrechnung',a.abrechnung,'betrag_cent',a.betrag_cent,'modell',a.modell,'key_preis_cent',a.preis_cent,
             'keys_betrag_cent',a.keys_betrag_cent,'lizenz_betrag_cent',a.lizenz_betrag_cent,
             'lizenz_art',a.lizenz_art,'lizenz_preis_cent',a.lizenz_preis_cent,'lizenz_intervall',a.lizenz_intervall,'lizenz_bis',a.lizenz_bis,
             'keys_gesamt',(select count(*) from public.gratis_code g where g.fachperson_auth = f.auth_id)) order by f.name)
      from public.fachperson_konto f
      join public._fp_abrechnung(null, p_monat) a on a.fachperson_auth = f.auth_id), '[]'::jsonb);
end $$;

revoke all on function public.cb_admin_fachperson_abrechnung(text, text, integer, integer, text) from public, anon;
grant execute on function public.cb_admin_fachperson_abrechnung(text, text, integer, integer, text) to authenticated;
