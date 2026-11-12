-- FL-4 (12.11.2026): Musterpraxis wieder in cb_auswertung_ist_soll.
-- FL-2 hat um 02:33 (Migration fl2_ist_soll_korrektur) die Funktion aus fl2_auswertung.sql neu eingespielt;
-- dabei fielen die beiden FL-4-Stellen weg (Profil und Vorgaben der erfundenen Musterpersonen).
-- Dieser Block nimmt die LIVE-Fassung und setzt nur diese zwei Stellen wieder ein – FL-2s Korrekturen bleiben.
-- Bricht ab, wenn eine der Stellen nicht gefunden wird (dann nichts geändert).
do $fix$
declare d text; alt1 text; neu1 text; alt2 text; neu2 text;
begin
  d := pg_get_functiondef('public.cb_auswertung_ist_soll(text,date,date,text)'::regprocedure);
  if position('fl_muster_vorgabe' in d) > 0 then raise notice 'Musterteil ist schon drin.'; return; end if;

  alt1 := 'select * into v_b from public."Benutzer" where "Benutzer_ID" = p_benutzer;';
  neu1 := 'if public._fl_muster_ist(p_benutzer) then                                 -- FL-4 Muster: Profil aus fl_muster_klient
    select m."Geburtsdatum", m."Alter", m."Geschlecht", m."Kalorienziel_kcal", m."Eiweiss_ziel_g", m."KH_ziel_g",
           m."Fett_ziel_g", m."Gewicht_kg", m."Zustand"
      into v_b from public.fl_muster_klient m where m.benutzer_id = p_benutzer;
  else
    select * into v_b from public."Benutzer" where "Benutzer_ID" = p_benutzer;
  end if;';
  alt2 := 'from public."Klient_Vorgabe" v
     where v."Benutzer_ID" = p_benutzer and v.gueltig_ab <= p_bis';
  neu2 := 'from (select kv.kennzahl, kv.wert, kv.wert_bis, kv.einheit, kv.bezug, kv.art, kv.gesetzt_von, kv.notiz,
                   kv.gueltig_ab, kv.gueltig_bis, kv.id
              from public."Klient_Vorgabe" kv where kv."Benutzer_ID" = p_benutzer
            union all                                                       -- FL-4 Muster
            select mv.kennzahl, mv.wert, mv.wert_bis, mv.einheit, mv.bezug, mv.art, mv.gesetzt_von, mv.notiz,
                   date ''2026-01-01'', null::date, mv.id
              from public.fl_muster_vorgabe mv where mv.benutzer_id = p_benutzer and public._fl_muster_ist(p_benutzer)) v
     where v.gueltig_ab <= p_bis';

  if position(alt1 in d) = 0 then raise exception 'Stelle 1 (Profil) nicht gefunden – nichts geändert.'; end if;
  if position(alt2 in d) = 0 then raise exception 'Stelle 2 (Vorgaben) nicht gefunden – nichts geändert.'; end if;
  d := replace(replace(d, alt1, neu1), alt2, neu2);
  execute d;
end $fix$;
