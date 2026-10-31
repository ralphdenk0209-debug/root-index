-- BR-NW-WIE-VERKAUFT (Ralph 13.10.2026, Entscheid A + jaja 31.10.2026): Naehrwerte zaehlen nur WIE VERKAUFT.
-- Riegel auf public."Naehrwerte_Makro": Kommt fuer ein Bruehe-/Bouillon-Pulver (Wuerzen & Saucen, Fertigprodukte) ein
-- Wert unter 50 kcal je 100 g an, sind es Werte fuer die zubereitete Bruehe (Pulver wie verkauft 150-300 kcal).
-- Sie werden nicht uebernommen – egal ob von Riki, einem Takt oder aus dem Editor. Ohne Naehrwerte kein Index
-- (trg_auto_clean_score: 'unvollstaendig – Naehrwerte fehlen'). Werte wie verkauft (>= 50 kcal) laufen durch.
-- Ausnahme von Hand: Naehrwert_Quelle_Status enthaelt 'wie verkauft geprueft'.
-- Angewendet als Migration naehrwerte_wie_verkauft_riegel_20261031. Sicherung: shadow_v1._abzug_bruehe_zubereitet_20261031.

create or replace function shadow_v1.cb_bruehe_pulver(p_name text, p_kat text)
returns boolean language sql immutable as $$
  select coalesce(p_kat,'') in ('Würzen & Saucen','Fertigprodukte')
     and coalesce(p_name,'') ~* '(brühe|bruehe|bouillon|brühwürfel|suppenwürfel|gekörnt|streuwürze)'
     and coalesce(p_name,'') !~* '(fond|flüssig|fluessig|fertig|im glas|tetra|knochenbrühe|suppe mit|klare brühe mit|gewürfelt|ramen|tonkotsu|pilzbrühe|kraftbrühe|mit fleisch)';
$$;

create or replace function public.cb_trg_naehrwerte_wie_verkauft()
returns trigger language plpgsql set search_path = public, shadow_v1 as $$
declare v_name text; v_kat text; v_kcal numeric := new."kcal_100g_ml";
begin
  if v_kcal is null or v_kcal >= 50 or coalesce(new."Naehrwert_Quelle_Status",'') ~* 'wie verkauft gepr' then return new; end if;
  select "Produktname", "Kategorie" into v_name, v_kat from public."Produkte" where "Produkt_ID" = new."Produkt_ID";
  if not shadow_v1.cb_bruehe_pulver(v_name, v_kat) then return new; end if;
  new."kcal_100g_ml" := null; new."kJ_100g_ml" := null;
  new."Protein_g_100g_ml" := null; new."Kohlenhydrate_g_100g_ml" := null; new."Zucker_g_100g_ml" := null;
  new."Fett_g_100g_ml" := null; new."Ges_Fett_g_100g_ml" := null; new."Ballaststoffe_g_100g_ml" := null; new."Salz_g_100g_ml" := null;
  new."Omega3_g_100g_ml" := null; new."Polyole_g_100g_ml" := null; new."Mehrfach_unges_Fett_g_100g_ml" := null;
  new."Einfach_unges_Fett_g_100g_ml" := null; new."Transfette_g_100g_ml" := null;
  new."kcal_Portion" := null; new."kJ_Portion" := null; new."Protein_g_Portion" := null; new."KH_g_Portion" := null;
  new."Zucker_g_Portion" := null; new."Fett_g_Portion" := null; new."Ballaststoffe_g_Portion" := null;
  new."Protein_pro_100kcal" := null; new."Ballaststoffe_pro_100kcal" := null; new."Zucker_Protein_Ratio" := null;
  new."Naehrwert_Quelle_Status" := 'zubereitet – nicht übernommen (BR-NW-WIE-VERKAUFT)';
  new."Notizen_Naehrwerte" := left(coalesce(nullif(new."Notizen_Naehrwerte",'') || ' | ', '') ||
    to_char(now(),'DD.MM.YYYY') || ': ' || v_kcal || ' kcal/100 g sind Werte der zubereiteten Brühe, nicht übernommen (BR-NW-WIE-VERKAUFT). Werte wie verkauft nötig (z. B. Herstellerseite).', 2000);
  return new;
end $$;

-- Name mit "aa", damit der Riegel vor trg_naehrwerte_ableiten laeuft (BEFORE-Trigger feuern alphabetisch).
drop trigger if exists trg_naehrwerte_aa_wie_verkauft on public."Naehrwerte_Makro";
create trigger trg_naehrwerte_aa_wie_verkauft before insert or update on public."Naehrwerte_Makro"
  for each row execute function public.cb_trg_naehrwerte_wie_verkauft();
