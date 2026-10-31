-- BR-NW-WIE-VERKAUFT – Grundlage der Naehrwert-Achse.
--
-- Fassung 2 (31.10.2026, Ralph: "dann zubereitet verwenden und Regelwerk wieder aendern mit Begruendung"):
--   Wie verkauft, AUSSER Bruehe/Bouillon/Bruehwuerfel/gekoernte Bruehe/Suppen- und Sossenpulver: dort gelten die
--   zubereiteten Werte laut Etikett (auch wenn beide Spalten da sind – gleiche Grundlage fuer alle Bruehen).
--   Grund (gemessen 31.10.): Werte wie verkauft liessen sich nur fuer 15 von 185 Bruehpulvern belegen; Etiketten und
--   selbst Herstellerseiten nennen fast immer nur die zubereitete Form (LMIV Art. 31 Abs. 3). Fassung 1 haette Bruehen
--   dauerhaft ohne Index gelassen. Regeltext: shadow_v1.rule_definition rule_key 'naehrwert.wie_verkauft' (Version 2).
--   Migration naehrwerte_zubereitet_bruehe_20261031: Riegel trg_naehrwerte_aa_wie_verkauft und seine Funktion entfernt,
--   185 Zeilen aus shadow_v1._abzug_bruehe_zubereitet_20261031 zurueckgeschrieben (Index wie vorher, Mittel 60).
--
-- Fassung 1 (31.10.2026, Migration naehrwerte_wie_verkauft_riegel_20261031) – ERSETZT:
--   Riegel auf "Naehrwerte_Makro" wies Bruehpulver-Werte < 50 kcal/100 g ab (zubereitet = Naehrwerte fehlen).

-- Erkennung Bruehpulver (bleibt, z. B. fuer Auswertungen und Riki 2):
create or replace function shadow_v1.cb_bruehe_pulver(p_name text, p_kat text)
returns boolean language sql immutable as $$
  select coalesce(p_kat,'') in ('Würzen & Saucen','Fertigprodukte')
     and coalesce(p_name,'') ~* '(brühe|bruehe|bouillon|brühwürfel|suppenwürfel|gekörnt|streuwürze)'
     and coalesce(p_name,'') !~* '(fond|flüssig|fluessig|fertig|im glas|tetra|knochenbrühe|suppe mit|klare brühe mit|gewürfelt|ramen|tonkotsu|pilzbrühe|kraftbrühe|mit fleisch)';
$$;

drop trigger if exists trg_naehrwerte_aa_wie_verkauft on public."Naehrwerte_Makro";
drop function if exists public.cb_trg_naehrwerte_wie_verkauft();
