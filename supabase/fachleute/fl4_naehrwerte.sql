-- FL-4 (12.11.2026, Ralph): „nährwerte könnten auch angezeigt werden als diagramm tag/woche/monat wenn umgeschaltet wird.“
-- Nährwerte je Tag, Woche oder Monat für EINE Person, gerechnet von FL-2 (cb_auswertung_naehrwerte, mit Datenabdeckung).
-- Echte Personen: nur mit laufendem Key und Einwilligung (_fp_klient), erst ab daten_ab. Musterpraxis: nur über den Vorschau-Token.
-- Rein additiv: zwei neue Funktionen, keine bestehende geändert.

create or replace function public._fl4_naehrwerte_json(p_benutzer text, p_von date, p_bis date, p_raster text)
returns jsonb language sql stable security definer set search_path = public as $f$
  select coalesce(jsonb_agg(jsonb_build_object('von', n.zeitraum_von, 'bis', n.zeitraum_bis, 'erfasst', n.tage_erfasst,
           'k', n.kennzahl, 'name', n.name, 'einheit', n.einheit, 'je_tag', round(n.je_tag, 2), 'abdeckung', n.abdeckung_prozent)
           order by n.zeitraum_von, n.kennzahl), '[]'::jsonb)
    from public.cb_auswertung_naehrwerte(p_benutzer, p_von, p_bis, p_raster, true) n
   where n.kennzahl in ('kcal','protein','fett','ges_fett','kh','zucker','ballaststoffe','salz') or n.kennzahl like 'mikro:%'
$f$;

create or replace function public.cb_fp_klient_naehrwerte(p_code text, p_von date, p_bis date, p_raster text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare k record; v_von date;
begin
  if p_raster not in ('tag','woche','monat') then raise exception 'Raster ungültig.'; end if;
  if p_von is null or p_bis is null or p_bis < p_von or p_bis - p_von > (case when p_raster = 'tag' then 92 else 400 end) then
    raise exception 'Zeitraum ungültig.'; end if;
  select * into k from public._fp_klient(p_code);                           -- wirft 42501 ohne Recht
  v_von := greatest(p_von, k.daten_ab);
  if v_von > p_bis then return '[]'::jsonb; end if;
  return public._fl4_naehrwerte_json(k.benutzer_id, v_von, p_bis, p_raster);
end $f$;

create or replace function public.cb_fl_muster_naehrwerte(p_token text, p_nr int, p_von date, p_bis date, p_raster text)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare v_bid text;
begin
  if not public._fl_muster_token_ok(p_token) then raise exception 'Dieser Vorschau-Link gilt nicht mehr.' using errcode = '42501'; end if;
  if p_raster not in ('tag','woche','monat') then raise exception 'Raster ungültig.'; end if;
  if p_von is null or p_bis is null or p_bis < p_von or p_bis - p_von > (case when p_raster = 'tag' then 92 else 400 end) then
    raise exception 'Zeitraum ungültig.'; end if;
  select benutzer_id into v_bid from public.fl_muster_klient where nr = p_nr;   -- nur Musterpersonen
  if v_bid is null or not public._fl_muster_ist(v_bid) then raise exception 'Diesen Musterklienten gibt es nicht.' using errcode = '42501'; end if;
  return public._fl4_naehrwerte_json(v_bid, p_von, p_bis, p_raster);
end $f$;

revoke all on function public._fl4_naehrwerte_json(text, date, date, text) from public, anon, authenticated;
revoke all on function public.cb_fp_klient_naehrwerte(text, date, date, text) from public, anon;
grant execute on function public.cb_fp_klient_naehrwerte(text, date, date, text) to authenticated;
revoke all on function public.cb_fl_muster_naehrwerte(text, integer, date, date, text) from public;
grant execute on function public.cb_fl_muster_naehrwerte(text, integer, date, date, text) to anon, authenticated;
