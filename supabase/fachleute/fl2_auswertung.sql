-- =====================================================================
-- FL-2 Auswertungs-Bausteine für Ernährungstherapeutinnen (Projekt fachleute)
-- Stand 11.11.2026. Keine Oberfläche (die baut FL-4), nur DB.
--
-- Bausteine
--   Lebensmittelgruppe            Stamm der Gruppen (Gemüse, Obst, …)
--   Produkt_Lebensmittelgruppe    manuelle Zuordnung je Produkt (schlägt die Regel)
--   cb_lebensmittelgruppe_regel() Regel aus Kategorie/Unterkategorie/Name/erster Zutat
--   cb_lebensmittelgruppe()       Gruppe eines Produkts bzw. Freitexts
--   Richtwert                     belegte Richtwerte (DGE u. a.) mit Quelle, Stand, Abruf
--   Klient_Vorgabe                individuelle Vorgaben je Klient (füllt später FL-4)
--   cb_auswertung_darf()          Zugriffsschutz (heute: eigener Nutzer oder Admin; FL-1 erweitert)
--   cb_auswertung_eintraege()     Tagebuch-Einträge mit Gruppe und Nährwerten
--   cb_auswertung_gruppen()       Gramm je Lebensmittelgruppe je Tag/Woche/Monat
--   cb_auswertung_naehrwerte()    Energie, Makros, Ballaststoffe, Zucker, Salz, Mikros je Tag/Woche/Monat
--   cb_auswertung_ist_soll()      Ist gegen Soll (Vorgabe > Profilziel > Richtwert)
--
-- Rezepte: Ein Rezept landet im Tagebuch als Einzelzeilen je Zutat (Rezept_Batch/Rezept_ID),
-- jede Zeile mit eigenem Produkt und Gramm. Darum zählen Rezept-Zutaten automatisch mit.
-- Grenze: Ein Fertigprodukt zählt als Ganzes in eine Gruppe (z. B. Tomatensauce -> Gemüse,
-- Kichererbsen-Curry -> Fertiggerichte); es wird nicht nach Zutatenanteilen aufgeteilt.
-- =====================================================================

-- ---------- 1. Lebensmittelgruppen ----------------------------------
create table if not exists public."Lebensmittelgruppe" (
  gruppe       text primary key,
  name         text not null,
  sortierung   int  not null,
  beschreibung text
);

insert into public."Lebensmittelgruppe"(gruppe, name, sortierung, beschreibung) values
 ('gemuese',          'Gemüse & Pilze',                     10, 'Gemüse, Salat, Pilze, Kräuter, Tomatenprodukte (Passata, Tomatenmark, Tomatensauce). Ohne Kartoffeln und Hülsenfrüchte.'),
 ('obst',             'Obst',                               20, 'Frisch, tiefgekühlt, getrocknet, Fruchtmus ohne Zuckerzusatz.'),
 ('huelsenfruechte',  'Hülsenfrüchte',                      30, 'Linsen, Kichererbsen, Bohnen, Edamame, Tofu, Tempeh, Hülsenfrucht-Nudeln.'),
 ('kartoffeln',       'Kartoffeln',                         40, 'Kartoffeln und Kartoffelprodukte (Gnocchi, Schupfnudeln, Wedges). Süßkartoffel zählt als Gemüse.'),
 ('vollkorn',         'Getreide – Vollkorn',                50, 'Vollkornbrot, -nudeln, Flocken, Kleie, Buchweizen, Quinoa, gekeimtes Getreide.'),
 ('getreide',         'Getreide – nicht Vollkorn',          55, 'Helles Brot, Wraps, Reis, Nudeln, Cracker ohne Vollkorn-Angabe.'),
 ('milch',            'Milch & Milchprodukte',              60, 'Milch, Joghurt, Quark, Skyr, Kefir, Käse, Sahne.'),
 ('eier',             'Eier',                               65, 'Ei, Eiklar, Spiegelei.'),
 ('fleisch',          'Fleisch & Wurst',                    70, 'Fleisch, Geflügel, Schinken, Wurst.'),
 ('fisch',            'Fisch & Meeresfrüchte',              75, 'Fisch, Garnelen, Meeresfrüchte.'),
 ('nuesse_samen',     'Nüsse & Samen',                      80, 'Nüsse, Nussmus, Saaten (Lein, Chia, Kürbiskern).'),
 ('oele_fette',       'Öle & Fette',                        85, 'Öle, Butter, Ghee, Kokosmilch.'),
 ('suesses',          'Süßes & Knabbereien',                90, 'Süßwaren, Süßungsmittel, Honig, Desserts, süße Aufstriche, Kuchen, süße/salzige Snacks.'),
 ('getraenke',        'Getränke',                           95, 'Wasser, Saft, Tee, Kaffee (soweit im Tagebuch erfasst).'),
 ('milchalternativen','Pflanzendrinks & Milchalternativen', 96, 'Hafer-, Mandel-, Sojadrink, Soja-Joghurt. Zählen nicht als Milch.'),
 ('wuerzen',          'Würzen, Saucen & Brühe',             97, 'Gewürze, Senf, Pesto, Essig, Brühe, Meerrettich.'),
 ('fertiggerichte',   'Fertiggerichte & Fleischersatz',     98, 'Gemischte Gerichte, die nicht in eine Gruppe aufgeteilt werden.'),
 ('supplemente',      'Nahrungsergänzung & Proteinpulver',  99, 'Supplemente, Proteinpulver, Kollagen, Elektrolyte.'),
 ('sonstiges',        'Sonstiges',                         100, 'Flohsamenschalen, Konjak, Backzutaten.'),
 ('unbekannt',        'Nicht zugeordnet',                  110, 'Freitext oder Produkt ohne erkennbare Gruppe.')
on conflict (gruppe) do update set name = excluded.name, sortierung = excluded.sortierung, beschreibung = excluded.beschreibung;

create table if not exists public."Produkt_Lebensmittelgruppe" (
  "Produkt_ID"  text primary key references public."Produkte"("Produkt_ID") on delete cascade,
  gruppe        text not null references public."Lebensmittelgruppe"(gruppe),
  quelle        text not null default 'manuell',
  notiz         text,
  geaendert_am  timestamptz not null default now()
);

alter table public."Lebensmittelgruppe"         enable row level security;
alter table public."Produkt_Lebensmittelgruppe" enable row level security;
drop policy if exists lmg_lesen on public."Lebensmittelgruppe";
create policy lmg_lesen on public."Lebensmittelgruppe" for select to anon, authenticated using (true);
drop policy if exists lmg_admin on public."Lebensmittelgruppe";
create policy lmg_admin on public."Lebensmittelgruppe" for all to authenticated using (public.cb_ist_admin()) with check (public.cb_ist_admin());
drop policy if exists plmg_lesen on public."Produkt_Lebensmittelgruppe";
create policy plmg_lesen on public."Produkt_Lebensmittelgruppe" for select to anon, authenticated using (true);
drop policy if exists plmg_admin on public."Produkt_Lebensmittelgruppe";
create policy plmg_admin on public."Produkt_Lebensmittelgruppe" for all to authenticated using (public.cb_ist_admin()) with check (public.cb_ist_admin());

-- Regel. Eingaben: Produkt-Kategorie, Unterkategorie, Name (Produktname oder Freitext),
-- Kategorie der ersten Zutat (k1), Zahl der Zutaten (n), Name der ersten Zutat (z1).
create or replace function public.cb_lebensmittelgruppe_regel(
  p_kat text, p_ukat text, p_name text, p_k1 text default null, p_n int default null, p_z1 text default null)
returns text language sql immutable as $f$
-- ohne SET-Klausel, damit Postgres die Regel in die aufrufende Abfrage einbettet (sonst pro Zeile neu geplant)
with x as (
  select coalesce(p_kat,'') kat, coalesce(p_ukat,'') ukat, lower(coalesce(p_name,'')) nm,
         lower(coalesce(p_name,'') || ' ' || coalesce(p_z1,'')) nmz,
         coalesce(p_k1,'') k1, coalesce(p_n,0) n
)
select case
  -- Nahrungsergänzung
  when kat in ('Supplement','Proteinpulver','Trinknahrung') then 'supplemente'
  when kat in ('','Sonstiges') and nm ~ '(kollagen|collagen|whey|protein ?pulver|eiweiß-?shake|elektrolyt|magnesium|vitamin|kapsel)' then 'supplemente'
  -- Hülsenfrüchte (stehen oft unter Gemüse, Getreide oder Snacks)
  when kat not in ('Süßwaren','Snacks','Fertigprodukte') and nm !~ '(curry|suppe|eintopf)'
       and nm ~ '(kichererbse|linse|lenticchie|edamame|sojabohne|kidneybohne|weiße bohne|schwarze bohne|borlotti|mungbohne|lupine|tofu|tempeh|legumotti|hülsenfrucht)' then 'huelsenfruechte'
  when k1 = 'Hülsenfrüchte' and kat in ('Getreide & Beilagen','Nüsse & Hülsenfrüchte','Tofu & Fleischalternativen','Snacks','Obst & Gemüse','') then 'huelsenfruechte'
  -- Kartoffeln
  when kat in ('Obst & Gemüse','Getreide & Beilagen','Fertigprodukte','')
       and nm ~ '(kartoffel|gnocchi|schupfnudel|nockerl|wedges|pommes|rösti|kroketten)' and nm !~ '(süßkartoffel|süsskartoffel|chips)' then 'kartoffeln'
  -- Obst & Gemüse
  when kat = 'Obst & Gemüse' and (ukat in ('Obst','TK-Frucht','Trockenobst') or k1 = 'Obst') then 'obst'
  when kat = 'Obst & Gemüse' and (ukat in ('Gemüse','Pilze','Tiefkühlgemüse','Salat') or k1 in ('Gemüse','Pilze','Alge')) then 'gemuese'
  when kat = 'Obst & Gemüse' and nm ~ '(beere|apfel|äpfel|birne|banane|kirsch|pflaume|zwetsch|dattel|feige|mango|ananas|traube|orange|zitrone|kiwi|melone|pfirsich|nektarine|aprikose|granatapfel|obst|frucht|früchte)' then 'obst'
  when kat = 'Obst & Gemüse' then 'gemuese'
  -- Fleisch & Fisch
  when kat = 'Fleisch & Fisch' and (ukat in ('Fisch','Lachs','Garnelen','Meeresfrüchte','Thunfisch') or k1 = 'Fisch & Meeresfrüchte'
       or nm ~ '(lachs|thunfisch|hering|garnele|prawn|scampi|fisch|forelle|makrele|kabeljau|sardine|sardelle|muschel|tintenfisch|calamar|krabbe|shrimp|dorsch|pangasius|zander|seehecht|matjes|rollmops|sprotte)') then 'fisch'
  when kat = 'Fleisch & Fisch' then 'fleisch'
  -- Milchprodukte & Eier
  when kat = 'Milchprodukte & Eier' and (ukat = 'Ei' or k1 = 'Ei' or nm ~ '(^ei\M|^eier\M|eiweiß|eiklar|spiegelei|rührei|omelett)') then 'eier'
  when kat = 'Milchprodukte & Eier' and k1 <> 'Milchprodukt' and nm ~ '(soja|alpro|hafer|mandel|kokos|vegan|pflanzlich)' then 'milchalternativen'
  when kat = 'Milchprodukte & Eier' then 'milch'
  -- Nüsse & Samen
  when kat = 'Nüsse & Hülsenfrüchte' and nm ~ 'kokos.*milch' then 'oele_fette'
  when kat = 'Nüsse & Hülsenfrüchte' and k1 = 'Obst' and n > 1 then 'suesses'
  when kat = 'Nüsse & Hülsenfrüchte' then 'nuesse_samen'
  -- Getreide & Brot
  when kat in ('Getreide & Beilagen','Brot & Backwaren') and nm !~ 'reiswaffel'
       and nm ~ '(kuchen|torte\M|torten|keks|plätzchen|gebäck|croissant|muffin|donut|berliner|strudel|waffel|lebkuchen|stollen)' then 'suesses'
  when kat in ('Getreide & Beilagen','Brot & Backwaren') and (ukat ~* 'ballaststoff' or k1 = 'Ballaststoff') and nm !~ 'kleie' then 'sonstiges'
  when kat in ('Getreide & Beilagen','Brot & Backwaren') and nm ~ '(konjak|konjac)' then 'sonstiges'
  when kat in ('Getreide & Beilagen','Brot & Backwaren','Snacks','Backen')
       and nmz ~ '(vollkorn|kleie|haferflocken|hafer flocken|haferflocke|dinkelflocken|dinkel flocken|dinkelvollkorn|buchweizen|quinoa|hirse|amaranth|sprossen|gekeimt|naturreis|vollreis|schrot|knäckebrot|pumpernickel)'
       and not (kat = 'Snacks' and k1 <> 'Getreide') then 'vollkorn'
  when kat in ('Getreide & Beilagen','Brot & Backwaren') then 'getreide'
  when kat = 'Backen' and nm ~ 'mehl' then 'getreide'
  -- Öle & Fette
  when kat = 'Öle & Fette' and nm ~ '(essig|aceto|balsam)' then 'wuerzen'
  when kat = 'Öle & Fette' then 'oele_fette'
  -- Getränke / Pflanzendrinks
  when kat = 'Getränk' and nm ~ 'kokos.*milch' then 'oele_fette'
  when kat = 'Getränk' and (ukat ~* 'pflanzendrink' or nm ~ '(hafermilch|mandelmilch|sojamilch|reismilch|haferdrink|mandeldrink|sojadrink|reisdrink|mandel drink|hafer drink|soja drink|barista)') then 'milchalternativen'
  when kat = 'Getränk' then 'getraenke'
  -- Süßes
  when kat in ('Süßwaren','Süßungsmittel','Desserts & Süßspeisen','Riegel') then 'suesses'
  when kat = 'Brotaufstrich' and nm ~ '(fruchtmus|apfelmus|apfelmark|zwetschgenmus|pflaumenmus|ohne zucker)' then 'obst'
  when kat = 'Brotaufstrich' and k1 = 'Fleisch' then 'fleisch'
  when kat = 'Brotaufstrich' and k1 = 'Hülsenfrüchte' then 'huelsenfruechte'
  when kat = 'Brotaufstrich' then 'suesses'
  when kat = 'Snacks' and k1 = 'Getreide' then 'getreide'
  when kat = 'Snacks' and k1 = 'Nüsse & Samen' and n <= 3 then 'nuesse_samen'
  when kat = 'Snacks' then 'suesses'
  -- Würzen & Saucen (Tomatenprodukte zählen als Gemüse)
  when kat in ('Würzen & Saucen','Sonstiges','') and k1 = 'Gemüse' and nm ~ '(tomat|passata|polpa|concentr)' then 'gemuese'
  when kat in ('Würzen & Saucen','Salze') then 'wuerzen'
  -- Fertiggerichte
  when kat in ('Fertigprodukte','Tofu & Fleischalternativen') then 'fertiggerichte'
  when kat = 'Backen' then 'sonstiges'
  -- Ohne Kategorie (Freitext): erste Zutat, dann Name
  when k1 = 'Obst' and n = 1 then 'obst'
  when k1 in ('Gemüse','Pilze') and n = 1 then 'gemuese'
  when kat = 'Sonstiges' and k1 = 'Obst' then 'obst'
  when nm ~ '(meerrettich|senf|ketchup|brühe|pesto|sauce|soße|dressing|gewürz|essig)' then 'wuerzen'
  when nm ~ '(curry|\mpan\M|pfanne|ragout|eintopf|suppe|gericht|auflauf|bowl)' then 'fertiggerichte'
  when nm ~ '(spinat|brokkoli|blumenkohl|karotte|möhre|tomate|gurke|paprika|zucchini|salat|kohl|zwiebel|lauch|sellerie|pilz|champignon|aubergine|kürbis|rucola|spargel|grüne bohnen|erbsen|rote bete|radieschen|fenchel|mangold|süßkartoffel|süsskartoffel|gemüse)' then 'gemuese'
  when nm ~ '(beere|apfel|banane|kirsch|pflaume|dattel|mango|ananas|traube|orange|kiwi|melone|pfirsich|granatapfel|obst)' then 'obst'
  when nm ~ '(lachs|thunfisch|hering|garnele|fisch|forelle|makrele)' then 'fisch'
  when nm ~ '(hähnchen|chicken|pute|rind|schwein|schinken|wurst|salami|hack|tatar|speck|lamm)' then 'fleisch'
  when nm ~ 'butter' and nm !~ '(erdnuss|peanut|nuss)' then 'oele_fette'
  when nm ~ '(milch|joghurt|quark|skyr|kefir|käse|mozzarella|feta|sahne)' and nm !~ '(kokos|hafer|mandel|soja)' then 'milch'
  when nm ~ '(eiweiß|eiklar|^ei\M|eier)' then 'eier'
  when nm ~ '(mandel|walnuss|haselnuss|cashew|erdnuss|peanut|pistazie|nuss|samen|kerne)' then 'nuesse_samen'
  when nm ~ '(vollkorn|kleie|flocken|buchweizen|sprossen)' then 'vollkorn'
  when nm ~ '(mehl|brot|wrap|nudel|pasta|reis|couscous|bulgur)' then 'getreide'
  when nm ~ '(öl\M|olio|oil)' then 'oele_fette'
  when nm ~ '(schoko|konfekt|bonbon|gummi|zucker|honig|sirup|keks|kuchen)' then 'suesses'
  when nm ~ '(saft|wasser|tee\M|kaffee|limo|schorle)' then 'getraenke'
  when kat = 'Sonstiges' then 'sonstiges'
  else 'unbekannt'
end from x
$f$;

-- Gruppe eines Produkts (manuelle Zuordnung vor Regel) bzw. eines Freitexts (p_produkt_id null).
create or replace function public.cb_lebensmittelgruppe(p_produkt_id text, p_freitext text default null)
returns text language sql stable security definer set search_path = public, shadow_v1 as $f$
  select coalesce(
    (select m.gruppe from public."Produkt_Lebensmittelgruppe" m where m."Produkt_ID" = p_produkt_id),
    (select public.cb_lebensmittelgruppe_regel(p."Kategorie", p."Unterkategorie", p."Produktname", z.k1, z.n, z.z1)
       from public."Produkte" p
       left join lateral (
         select count(*)::int n,
                (array_agg(src.source_category order by pz."Reihenfolge"))[1] k1,
                (array_agg(src.source_name     order by pz."Reihenfolge"))[1] z1
           from public."Produkt_Zutaten" pz
           left join shadow_v1.legacy_ingredient_source_ref src on src.source_zutat_id = pz."Zutat_ID"
          where pz."Produkt_ID" = p."Produkt_ID") z on true
      where p."Produkt_ID" = p_produkt_id),
    public.cb_lebensmittelgruppe_regel(null, null, p_freitext, null, null, null)
  );
$f$;

-- ---------- 2. Richtwerte und individuelle Vorgaben ------------------
-- kennzahl: 'kcal','protein','kh','zucker','fett','ges_fett','ballaststoffe','salz',
--           'gruppe:<gruppe>[+<gruppe>…]' (Summe mehrerer Gruppen), 'mikro:<Nährstoff>'
-- art: 'mindestens' | 'hoechstens' | 'etwa' (±10 %) | 'bereich' (wert..wert_bis)
-- einheit: 'g','kcal','ml','mg','µg', 'en%' (Anteil an der Energie), 'g/kg' (je kg Körpergewicht)
-- bezug: 'tag' | 'woche'
create table if not exists public."Richtwert" (
  id            bigserial primary key,
  kennzahl      text not null,
  name          text not null,
  wert          numeric not null,
  wert_bis      numeric,
  einheit       text not null,
  bezug         text not null default 'tag' check (bezug in ('tag','woche')),
  art           text not null check (art in ('mindestens','hoechstens','etwa','bereich')),
  zielgruppe    text not null,
  geschlecht    text not null default 'alle' check (geschlecht in ('alle','maennlich','weiblich')),
  alter_von     int  not null default 19,
  alter_bis     int  not null default 200,
  herausgeber   text not null,
  quelle_titel  text not null,
  quelle_url    text not null,
  quelle_stand  text not null,
  abgerufen_am  date not null,
  beleg         text,
  hinweis       text,
  aktiv         boolean not null default true
);
alter table public."Richtwert" enable row level security;
drop policy if exists richtwert_lesen on public."Richtwert";
create policy richtwert_lesen on public."Richtwert" for select to anon, authenticated using (true);
drop policy if exists richtwert_admin on public."Richtwert";
create policy richtwert_admin on public."Richtwert" for all to authenticated using (public.cb_ist_admin()) with check (public.cb_ist_admin());

create unique index if not exists richtwert_eindeutig
  on public."Richtwert"(kennzahl, einheit, bezug, geschlecht, alter_von, alter_bis, herausgeber);

-- Richtwerte, abgerufen 11.11.2026. Jede Zahl steht wörtlich oder als Produkt (Portionen × Portionsgröße)
-- in der genannten Quelle. Wichtig (DGE-Ernährungskreis): Die Orientierungswerte sind „nicht geeignet,
-- mit tatsächlichen Verzehrdaten verglichen zu werden, um die Lebensmittelauswahl … des Einzelnen zu
-- bewerten“. FL-4 zeigt sie darum als Orientierung, nicht als Note.
-- Bewusst NICHT aufgenommen: „280 g Gemüse“ / „DGE-Teller“ (in keiner DGE-Quelle gefunden);
-- Milch (DGE rechnet in Milchäquivalenten, 400 g/Tag – Käse und Quark lassen sich aus Gramm nicht umrechnen);
-- Getränke 1,5 l (Wasser steht im Wasser-Log, nicht im Tagebuch); Süßes ≤ 8 en% (Modellwert, Q7).
insert into public."Richtwert"(kennzahl, name, wert, wert_bis, einheit, bezug, art, zielgruppe, alter_von, alter_bis,
                               herausgeber, quelle_titel, quelle_url, quelle_stand, abgerufen_am, beleg, hinweis) values
 ('gruppe:gemuese+obst', 'Obst und Gemüse', 550, null, 'g', 'tag', 'mindestens',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Obst und Gemüse: 5 Portionen à 110 g täglich (5 × 110 g = 550 g).',
  'Orientierungswert, nicht zur Bewertung Einzelner gedacht. Säfte zählen bei der DGE extra (2 Gläser/Woche).'),
 ('gruppe:gemuese', 'Gemüse', 245, null, 'g', 'tag', 'mindestens',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'Schäfer et al.: Wissenschaftliche Grundlagen der lebensmittelbezogenen Ernährungsempfehlungen für Deutschland, Ernährungs Umschau 3/2024, Tab. 2',
  'https://www.ernaehrungs-umschau.de/fileadmin/Ernaehrungs-Umschau/pdfs/pdf_2024/03_24/EU03_2024_M158_M166_Online.pdf',
  'März 2024', '2026-11-11', 'Optimierungsergebnis Modellvariante 3, Szenario 2: Gemüse 245 g/d (Szenario 1: 247 g/d).',
  'Modellwert der DGE-Berechnung, keine eigene DGE-Empfehlung für Gemüse allein. Als Untergrenze gesetzt, weil die DGE „mindestens 5 Portionen Obst und Gemüse“ empfiehlt.'),
 ('gruppe:obst', 'Obst', 300, null, 'g', 'tag', 'etwa',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'Schäfer et al.: Wissenschaftliche Grundlagen der lebensmittelbezogenen Ernährungsempfehlungen für Deutschland, Ernährungs Umschau 3/2024, Tab. 2',
  'https://www.ernaehrungs-umschau.de/fileadmin/Ernaehrungs-Umschau/pdfs/pdf_2024/03_24/EU03_2024_M158_M166_Online.pdf',
  'März 2024', '2026-11-11', 'Optimierungsergebnis Modellvariante 3, Szenario 1 und 2: Obst 300 g/d.',
  'Modellwert der DGE-Berechnung, keine eigene DGE-Empfehlung für Obst allein.'),
 ('gruppe:huelsenfruechte', 'Hülsenfrüchte', 125, null, 'g', 'woche', 'mindestens',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Hülsenfrüchte: 1 Portion à 125 g (verzehrfertig) wöchentlich; getrocknet × 1,8.',
  'Gramm im Tagebuch sind meist verzehrfertig; bei getrockneten Linsen o. Ä. zählt das Trockengewicht (zu niedrig).'),
 ('gruppe:nuesse_samen', 'Nüsse und Samen', 25, null, 'g', 'tag', 'etwa',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Nüsse und Samen: 1 Portion à 25 g täglich.', null),
 ('gruppe:kartoffeln', 'Kartoffeln', 250, null, 'g', 'woche', 'etwa',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Kartoffeln: 1 Portion à 250 g wöchentlich.', null),
 ('gruppe:vollkorn+getreide', 'Getreide, Brot, Nudeln', 300, null, 'g', 'tag', 'etwa',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Getreide, Brot, Nudeln: 5 Portionen à 60 g täglich (5 × 60 g = 300 g), davon mind. 1/3 Vollkorn.',
  '60 g = 1 Scheibe Brot bzw. ungekochte Nudeln, ungegarter Reis, Flocken. Gekocht eingetragene Nudeln/Reis wiegen mehr.'),
 ('gruppe:vollkorn', 'davon Vollkorn', 100, null, 'g', 'tag', 'mindestens',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Getreide 5 × 60 g täglich, davon mind. 1/3 Vollkorn (300 g ÷ 3 = 100 g).', 'Rechnerisch aus dem Orientierungswert.'),
 ('gruppe:oele_fette', 'Öle und Fette', 20, null, 'g', 'tag', 'etwa',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Pflanzliche Öle 1 EL à 10 g und Butter/Margarine 1 EL à 10 g täglich (= 20 g).',
  'Unsere Gruppe enthält auch Kokosmilch.'),
 ('gruppe:fisch', 'Fisch', 120, 240, 'g', 'woche', 'bereich',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Fisch: 1 bis 2 Portionen à 120 g wöchentlich.',
  'Fisch und Fleisch zusammen gedacht: 2 × Fisch + 1 × Fleisch oder 1 × Fisch + 2 × Fleisch.'),
 ('gruppe:fleisch', 'Fleisch und Wurst', 300, null, 'g', 'woche', 'hoechstens',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Empfehlungen „Gut essen und trinken“', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-empfehlungen/',
  'Fassung März 2024', '2026-11-11', 'Wenn Sie Fleisch und Wurst essen, dann nicht mehr als 300 g pro Woche.', null),
 ('gruppe:eier', 'Eier', 60, null, 'g', 'woche', 'etwa',
  'Erwachsene 18–65 J., Mischkost, ca. 2000 kcal', 18, 65, 'DGE',
  'DGE-Ernährungskreis, Orientierungswerte', 'https://www.dge.de/gesunde-ernaehrung/gut-essen-und-trinken/dge-ernaehrungskreis/',
  'Fassung März 2024', '2026-11-11', 'Eier: 1 Stück à 60 g wöchentlich; Eier in verarbeiteten Lebensmitteln kommen dazu.', null),
 ('ballaststoffe', 'Ballaststoffe', 30, null, 'g', 'tag', 'mindestens',
  'Erwachsene ab 19 J.', 19, 200, 'DGE',
  'DGE/ÖGE-Referenzwerte: Ballaststoffe', 'https://www.dge.de/wissenschaft/referenzwerte/ballaststoffe/',
  'Ableitung 2021', '2026-11-11', 'Richtwert für die Ballaststoffzufuhr: ≥ 30 g/Tag (19 Jahre und älter).', null),
 ('salz', 'Salz', 6, null, 'g', 'tag', 'hoechstens',
  'Erwachsene', 19, 200, 'DGE',
  'DGE-FAQ Speisesalz, Frage 5', 'https://www.dge.de/wissenschaft/faqs/salz/',
  'letzte Änderung 01.10.2023', '2026-11-11', 'Orientierungswert von bis zu 6 g Speisesalz/Tag.', null),
 ('protein', 'Eiweiß', 0.8, null, 'g/kg', 'tag', 'mindestens',
  'Erwachsene 19–64 J.', 19, 64, 'DGE',
  'DGE/ÖGE-Referenzwerte: Protein', 'https://www.dge.de/wissenschaft/referenzwerte/protein/',
  'Ableitung 2017', '2026-11-11', 'Empfohlene Zufuhr 0,8 g/kg Körpergewicht/Tag (19 bis unter 65 Jahre).',
  'Bezogen auf Normalgewicht; bei Übergewicht rechnet die DGE mit dem Normalgewicht, hier mit dem Gewicht im Profil.'),
 ('protein', 'Eiweiß', 1.0, null, 'g/kg', 'tag', 'mindestens',
  'Erwachsene ab 65 J.', 65, 200, 'DGE',
  'DGE/ÖGE-Referenzwerte: Protein', 'https://www.dge.de/wissenschaft/referenzwerte/protein/',
  'Ableitung 2017', '2026-11-11', 'Schätzwert 1,0 g/kg Körpergewicht/Tag (65 Jahre und älter).',
  'Bezogen auf Normalgewicht; hier mit dem Gewicht im Profil gerechnet.'),
 ('fett', 'Fett (Anteil an der Energie)', 30, null, 'en%', 'tag', 'etwa',
  'Erwachsene ab 19 J.', 19, 200, 'DGE',
  'DGE/ÖGE-Referenzwerte: Fett', 'https://www.dge.de/wissenschaft/referenzwerte/fett-essenzielle-fettsaeuren/',
  'Ableitung 2000', '2026-11-11', 'Richtwert für die Fettzufuhr: 30 % der Energie (Erwachsene).',
  'Bei hoher körperlicher Aktivität (PAL über 1,7) laut DGE ggf. höher.'),
 ('kh', 'Kohlenhydrate (Anteil an der Energie)', 50, null, 'en%', 'tag', 'mindestens',
  'Erwachsene ab 19 J.', 19, 200, 'DGE',
  'DGE/ÖGE-Referenzwerte: Kohlenhydrate', 'https://www.dge.de/wissenschaft/referenzwerte/kohlenhydrate/',
  'Ableitung 2000', '2026-11-11', 'Vollwertige Mischkost mit mehr als 50 % der Energie aus Kohlenhydraten.', null),
 ('zucker', 'Zucker (Anteil an der Energie)', 10, null, 'en%', 'tag', 'hoechstens',
  'Allgemeinbevölkerung', 19, 200, 'DAG/DDG/DGE',
  'Konsensuspapier „Quantitative Empfehlung zur Zuckerzufuhr in Deutschland“',
  'https://www.dge.de/fileadmin/dok/wissenschaft/stellungnahmen/Konsensuspapier_Zucker_DAG_DDG_DGE_2018.pdf',
  'Dezember 2018', '2026-11-11', 'Zufuhr freier Zucker auf weniger als 10 % der Gesamtenergiezufuhr begrenzen (nach WHO 2015).',
  'Gilt für FREIE Zucker. Das Tagebuch kennt nur Gesamtzucker (inkl. Milch- und Obstzucker); der Vergleich ist darum strenger als die Empfehlung.')
on conflict (kennzahl, einheit, bezug, geschlecht, alter_von, alter_bis, herausgeber) do update set
  name = excluded.name, wert = excluded.wert, wert_bis = excluded.wert_bis, art = excluded.art, zielgruppe = excluded.zielgruppe,
  quelle_titel = excluded.quelle_titel, quelle_url = excluded.quelle_url, quelle_stand = excluded.quelle_stand,
  abgerufen_am = excluded.abgerufen_am, beleg = excluded.beleg, hinweis = excluded.hinweis, aktiv = true;

create table if not exists public."Klient_Vorgabe" (
  id            bigserial primary key,
  "Benutzer_ID" text not null references public."Benutzer"("Benutzer_ID") on delete cascade,
  kennzahl      text not null,
  wert          numeric not null,
  wert_bis      numeric,
  einheit       text not null,
  bezug         text not null default 'tag' check (bezug in ('tag','woche')),
  art           text not null check (art in ('mindestens','hoechstens','etwa','bereich')),
  gueltig_ab    date not null default current_date,
  gueltig_bis   date,
  gesetzt_von   text,
  notiz         text,
  angelegt_am   timestamptz not null default now()
);
create index if not exists klient_vorgabe_benutzer on public."Klient_Vorgabe"("Benutzer_ID", kennzahl);
alter table public."Klient_Vorgabe" enable row level security;
drop policy if exists vorgabe_eigene on public."Klient_Vorgabe";
create policy vorgabe_eigene on public."Klient_Vorgabe" for select to authenticated
  using ("Benutzer_ID" in (select b."Benutzer_ID" from public."Benutzer" b where b.auth_id = auth.uid()) or public.cb_ist_admin());
drop policy if exists vorgabe_admin on public."Klient_Vorgabe";
create policy vorgabe_admin on public."Klient_Vorgabe" for all to authenticated using (public.cb_ist_admin()) with check (public.cb_ist_admin());

-- ---------- 3. Zugriff ----------------------------------------------
-- Heute: eigener Nutzer oder Admin. FL-1 ergänzt hier die Bindung Therapeutin -> Klient.
create or replace function public.cb_auswertung_darf(p_benutzer text)
returns boolean language sql stable security definer set search_path = public as $f$
  select public.cb_ist_admin()
      or exists (select 1 from public."Benutzer" b where b.auth_id = auth.uid() and b."Benutzer_ID" = p_benutzer);
$f$;

-- ---------- 4. Einträge mit Gruppe ----------------------------------
create or replace function public.cb_auswertung_eintraege(p_benutzer text, p_von date, p_bis date)
returns table(eintrag_id bigint, datum date, mahlzeit text, produkt_id text, name text, manuell boolean,
              rezept_id text, menge_g numeric, gruppe text,
              kcal numeric, protein numeric, kh numeric, zucker numeric, fett numeric, ges_fett numeric,
              ballaststoffe numeric, salz numeric)
language plpgsql stable security definer set search_path = public, shadow_v1 as $f$
#variable_conflict use_column
begin
  if not public.cb_auswertung_darf(p_benutzer) then raise exception 'Kein Zugriff auf dieses Tagebuch.'; end if;
  if p_bis < p_von or p_bis - p_von > 400 then raise exception 'Zeitraum ungültig (höchstens 400 Tage).'; end if;
  return query
  with e as (
    select v.*, t."Rezept_ID" rid, t."Man_ges_fett" man_gf
      from public.v_tagebuch_eintraege v
      join public."Ernaehrungstagebuch" t on t."Eintrag_ID" = v."Eintrag_ID"
     where v."Benutzer_ID" = p_benutzer and v."Datum" between p_von and p_bis
  ),
  g as (
    select p."Produkt_ID" pid,
           coalesce(m.gruppe, public.cb_lebensmittelgruppe_regel(p."Kategorie", p."Unterkategorie", p."Produktname", z.k1, z.n, z.z1)) gr
      from (select distinct e."Produkt_ID" pid from e where e."Produkt_ID" is not null) x
      join public."Produkte" p on p."Produkt_ID" = x.pid
      left join public."Produkt_Lebensmittelgruppe" m on m."Produkt_ID" = x.pid
      left join lateral (
        select count(*)::int n,
               (array_agg(src.source_category order by pz."Reihenfolge"))[1] k1,
               (array_agg(src.source_name     order by pz."Reihenfolge"))[1] z1
          from public."Produkt_Zutaten" pz
          left join shadow_v1.legacy_ingredient_source_ref src on src.source_zutat_id = pz."Zutat_ID"
         where pz."Produkt_ID" = x.pid) z on true)
  select e."Eintrag_ID", e."Datum", e."Mahlzeit", e."Produkt_ID", e."Produktname", e.manuell,
         e.rid, e."Menge_g",
         coalesce(g.gr, public.cb_lebensmittelgruppe_regel(null, null, e."Produktname", null, null, null)),
         e.kcal, e.protein, e.kh, e.zucker, e.fett,
         case when e."Produkt_ID" is not null then round(n."Ges_Fett_g_100g_ml" * e."Menge_g" / 100, 1)
              else round(e.man_gf, 1) end,
         e.ballaststoffe, e.salz
    from e
    left join g on g.pid = e."Produkt_ID"
    left join public."Naehrwerte_Makro" n on n."Produkt_ID" = e."Produkt_ID"
   order by e."Datum", e."Eintrag_ID";
end $f$;

-- Hilfsfunktion: Zeiträume (Tag / Woche ab Montag / Monat / gesamt), auf [von, bis] gekappt
create or replace function public.cb_auswertung_raster(p_von date, p_bis date, p_raster text)
returns table(zeitraum_von date, zeitraum_bis date, tage int)
language sql immutable set search_path = public as $f$
  with s as (
    select distinct
      case p_raster when 'tag' then d::date
                    when 'woche' then date_trunc('week', d)::date
                    when 'monat' then date_trunc('month', d)::date
                    else p_von end a
      from generate_series(p_von, p_bis, interval '1 day') d
  )
  select greatest(a, p_von),
         least(case p_raster when 'tag' then a
                             when 'woche' then a + 6
                             when 'monat' then (a + interval '1 month' - interval '1 day')::date
                             else p_bis end, p_bis),
         (least(case p_raster when 'tag' then a when 'woche' then a + 6
                              when 'monat' then (a + interval '1 month' - interval '1 day')::date
                              else p_bis end, p_bis) - greatest(a, p_von) + 1)::int
    from s order by 1;
$f$;

-- ---------- 5. Gramm je Lebensmittelgruppe --------------------------
-- p_raster: 'tag' | 'woche' | 'monat' | 'gesamt'. Je Zeitraum alle Gruppen (auch 0 g).
-- gramm_je_tag = Gramm / Tage mit mindestens einem Eintrag (wie die App-Statistik).
create or replace function public.cb_auswertung_gruppen(p_benutzer text, p_von date, p_bis date, p_raster text default 'tag')
returns table(zeitraum_von date, zeitraum_bis date, tage int, tage_erfasst int,
              gruppe text, gruppe_name text, sortierung int, gramm numeric, gramm_je_tag numeric, eintraege int)
language plpgsql stable security definer set search_path = public as $f$
#variable_conflict use_column
begin
  if p_raster not in ('tag','woche','monat','gesamt') then raise exception 'Raster: tag, woche, monat oder gesamt.'; end if;
  return query
  with e as materialized (select * from public.cb_auswertung_eintraege(p_benutzer, p_von, p_bis)),
  r as (select * from public.cb_auswertung_raster(p_von, p_bis, p_raster)),
  rt as (select r.zeitraum_von, r.zeitraum_bis, r.tage,
                (select count(distinct e.datum)::int from e where e.datum between r.zeitraum_von and r.zeitraum_bis) te
           from r)
  select rt.zeitraum_von, rt.zeitraum_bis, rt.tage, rt.te, l.gruppe, l.name, l.sortierung,
         case when rt.te > 0 then coalesce(s.g, 0) end,
         case when rt.te > 0 then round(coalesce(s.g, 0) / rt.te, 0) end,
         coalesce(s.n, 0)::int
    from rt
    cross join public."Lebensmittelgruppe" l
    left join lateral (select sum(e.menge_g) g, count(*) n from e
                        where e.datum between rt.zeitraum_von and rt.zeitraum_bis and e.gruppe = l.gruppe) s on true
   order by rt.zeitraum_von, l.sortierung;
end $f$;

-- ---------- 6. Mikronährstoffe eines Tages --------------------------
-- Gleiche Quellen wie cb_tagebuch_mikro (App, Stand 11.11.2026): Produkt-Mikros, Natrium aus Salz,
-- Stück-Supplemente, dauerhafte Supplemente (Nutzer_Supplement), Mineralwasser (Wasser_Log).
-- Zusätzlich gramm_mit_daten: wie viel Gramm des Tages für diesen Nährstoff Werte haben.
create or replace function public.cb_auswertung_mikro_tag(p_bid text, p_datum date)
returns table(naehrstoff text, einheit text, menge numeric, gramm_mit_daten numeric)
language sql stable security definer set search_path = public as $f$
  with tag as (
    select t."Produkt_ID" pid, sum(t."Menge_g") g
      from public."Ernaehrungstagebuch" t
     where t."Benutzer_ID" = p_bid and t."Datum" = p_datum and t."Produkt_ID" is not null
     group by t."Produkt_ID"),
  tag_stueck as (
    select t."Produkt_ID" pid, sum(t."Menge_Stueck") stk
      from public."Ernaehrungstagebuch" t
     where t."Benutzer_ID" = p_bid and t."Datum" = p_datum and t."Produkt_ID" is not null
       and t."Einheit" = 'Stück' and t."Menge_Stueck" is not null
     group by t."Produkt_ID"),
  food as (
    select m."Naehrstoff" stoff, max(m."Einheit") einh, sum(m."Menge_100g" * tag.g / 100.0) menge, sum(tag.g) gmd
      from tag join public."Produkt_Mikronaehrstoffe" m on m."Produkt_ID" = tag.pid
     group by m."Naehrstoff"),
  natrium_aus_salz as (
    select 'Natrium'::text stoff, 'mg'::text einh, sum(v.salz::numeric / 2.5 * 1000.0) menge, sum(v."Menge_g") gmd
      from public.v_tagebuch_eintraege v
     where v."Benutzer_ID" = p_bid and v."Datum" = p_datum and coalesce(v.salz, 0) > 0
       and not exists (select 1 from public."Produkt_Mikronaehrstoffe" pm
                        where pm."Produkt_ID" = v."Produkt_ID" and pm."Naehrstoff" = 'Natrium')
    having sum(v.salz::numeric) > 0),
  stueck as (
    select wm."naehrstoff" stoff, u."Einheit" einh,
           sum(pn."menge"::numeric * coalesce(wm.faktor, 1) / p."Portion_Menge" * ts.stk
               * case when lower(pn."einheit") = lower(u."Einheit") then 1
                      when lower(pn."einheit") = 'mg' and u."Einheit" = 'µg' then 1000
                      when lower(pn."einheit") = 'µg' and u."Einheit" = 'mg' then 0.001 else 0 end) menge,
           0::numeric gmd
      from tag_stueck ts
      join public."Produkte" p on p."Produkt_ID" = ts.pid and p."Portion_Einheit" = 'Stück' and p."Portion_Menge" > 0
      join public."Produkt_Naehrstoffe" pn on pn."Produkt_ID" = ts.pid and pn."Bezug" = 'tagesdosis'
      join public."Wirkstoff_Map" wm on lower(btrim(regexp_replace(pn."naehrstoff", '^[\s\-–—]*davon\s+', '', 'i'))) = wm."muster"
      join public."Mikro_Einheit" u on u."Naehrstoff" = wm."naehrstoff"
     where lower(pn."einheit") in ('mg','µg') and (pn."vergleichsoperator" is null or pn."vergleichsoperator" = '=')
       and not exists (select 1 from public."Produkt_Mikronaehrstoffe" pm where pm."Produkt_ID" = ts.pid and pm."Naehrstoff" = wm."naehrstoff")
     group by wm."naehrstoff", u."Einheit"),
  supp as (
    select wm."naehrstoff" stoff, u."Einheit" einh,
           sum(pn."menge"::numeric * coalesce(wm.faktor, 1) / greatest(ns."haeufigkeit_tage", 1)
               * case when lower(pn."einheit") = lower(u."Einheit") then 1
                      when lower(pn."einheit") = 'mg' and u."Einheit" = 'µg' then 1000
                      when lower(pn."einheit") = 'µg' and u."Einheit" = 'mg' then 0.001 else 0 end) menge,
           0::numeric gmd
      from public."Nutzer_Supplement" ns
      join public."Produkt_Naehrstoffe" pn on pn."Produkt_ID" = ns."Produkt_ID"
      join public."Wirkstoff_Map" wm on lower(btrim(regexp_replace(pn."naehrstoff", '^[\s\-–—]*davon\s+', '', 'i'))) = wm."muster"
      join public."Mikro_Einheit" u on u."Naehrstoff" = wm."naehrstoff"
     where ns."Benutzer_ID" = p_bid and ns."aktiv" and lower(pn."einheit") in ('mg','µg')
       and not exists (select 1 from tag where tag.pid = ns."Produkt_ID"
                          and exists (select 1 from public."Produkt_Mikronaehrstoffe" pm
                                       where pm."Produkt_ID" = ns."Produkt_ID" and pm."Naehrstoff" = wm."naehrstoff"))
       and not exists (select 1 from tag_stueck where tag_stueck.pid = ns."Produkt_ID")
     group by wm."naehrstoff", u."Einheit"),
  wasser as (
    select wn."Naehrstoff" stoff, u."Einheit" einh,
           sum(wn."Menge_mg_l" * (wl.ml / 1000.0)
               * case when lower(wn."Einheit") = lower(u."Einheit") then 1
                      when lower(wn."Einheit") = 'mg' and u."Einheit" = 'µg' then 1000
                      when lower(wn."Einheit") = 'µg' and u."Einheit" = 'mg' then 0.001 else 0 end) menge,
           0::numeric gmd
      from (select "Wasser_ID" wid, sum("Menge_ml") ml from public."Wasser_Log"
             where "Benutzer_ID" = p_bid and "Datum" = p_datum group by "Wasser_ID") wl
      join public."Wasser_Naehrstoffe" wn on wn."Wasser_ID" = wl.wid
      join public."Mikro_Einheit" u on u."Naehrstoff" = wn."Naehrstoff"
     group by wn."Naehrstoff", u."Einheit"),
  alle as (
    select * from food union all select * from natrium_aus_salz union all select * from stueck
    union all select * from supp union all select * from wasser)
  select a.stoff::text, max(a.einh)::text, round(sum(a.menge)::numeric, 3), sum(a.gmd)
    from alle a group by a.stoff having sum(a.menge) > 0;
$f$;
revoke execute on function public.cb_auswertung_mikro_tag(text, date) from public, anon, authenticated;

-- ---------- 7. Nährwerte je Zeitraum (Langformat) --------------------
-- Je Zeitraum und Kennzahl: Summe und Schnitt je erfasstem Tag.
-- Mikros (p_mit_mikro): Kennzahl 'mikro:<Nährstoff>'; abdeckung_prozent = Anteil der gegessenen
-- Gramm (Produkte), für die zu diesem Nährstoff Werte vorliegen.
create or replace function public.cb_auswertung_naehrwerte(p_benutzer text, p_von date, p_bis date,
                                                           p_raster text default 'tag', p_mit_mikro boolean default true)
returns table(zeitraum_von date, zeitraum_bis date, tage int, tage_erfasst int,
              kennzahl text, name text, einheit text, summe numeric, je_tag numeric, abdeckung_prozent numeric)
language plpgsql stable security definer set search_path = public as $f$
#variable_conflict use_column
begin
  if p_raster not in ('tag','woche','monat','gesamt') then raise exception 'Raster: tag, woche, monat oder gesamt.'; end if;
  return query
  with e as materialized (select * from public.cb_auswertung_eintraege(p_benutzer, p_von, p_bis)),
  r as (select * from public.cb_auswertung_raster(p_von, p_bis, p_raster)),
  rt as (select r.zeitraum_von zv, r.zeitraum_bis zb, r.tage,
                (select count(distinct e.datum)::int from e where e.datum between r.zeitraum_von and r.zeitraum_bis) te
           from r),
  makro as (
    select rt.zv, rt.zb, k.kennzahl, k.name, k.einheit, k.sort,
           (select sum(case k.kennzahl when 'kcal' then e.kcal when 'protein' then e.protein when 'kh' then e.kh
                                       when 'zucker' then e.zucker when 'fett' then e.fett when 'ges_fett' then e.ges_fett
                                       when 'ballaststoffe' then e.ballaststoffe when 'salz' then e.salz
                                       when 'menge' then e.menge_g end)
              from e where e.datum between rt.zv and rt.zb) s
      from rt cross join (values ('kcal','Energie','kcal',1), ('protein','Eiweiß','g',2), ('kh','Kohlenhydrate','g',3),
                                 ('zucker','davon Zucker','g',4), ('fett','Fett','g',5), ('ges_fett','davon gesättigte Fettsäuren','g',6),
                                 ('ballaststoffe','Ballaststoffe','g',7), ('salz','Salz','g',8), ('menge','Gegessene Menge','g',9))
                          k(kennzahl, name, einheit, sort)),
  tage_mikro as materialized (
    select d.datum, m.naehrstoff, m.einheit, m.menge, m.gramm_mit_daten
      from (select distinct e.datum from e) d
      cross join lateral public.cb_auswertung_mikro_tag(p_benutzer, d.datum) m
     where p_mit_mikro),
  gramm_tag as (select e.datum, sum(e.menge_g) filter (where e.produkt_id is not null) g from e group by e.datum),
  mikro as (
    select rt.zv, rt.zb, 'mikro:' || tm.naehrstoff kennzahl, tm.naehrstoff name, max(tm.einheit) einheit,
           100 + coalesce(min(mr.sortierung), 999) sort, sum(tm.menge) s,
           round(100.0 * sum(tm.gramm_mit_daten)
                 / nullif((select sum(gt.g) from gramm_tag gt where gt.datum between rt.zv and rt.zb), 0), 0) abd
      from rt join tage_mikro tm on tm.datum between rt.zv and rt.zb
      left join public.mikro_referenz mr on mr.naehrstoff = tm.naehrstoff
     group by rt.zv, rt.zb, tm.naehrstoff)
  select rt.zv, rt.zb, rt.tage, rt.te, x.kennzahl, x.name, x.einheit,
         case when rt.te > 0 then round(coalesce(x.s, 0), 2) end,
         case when rt.te > 0 then round(coalesce(x.s, 0) / rt.te, 2) end,
         x.abd
    from rt
    join (select zv, zb, kennzahl, name, einheit, sort, s, null::numeric abd from makro
          union all
          select zv, zb, kennzahl, name, einheit, sort, s, abd from mikro) x on x.zv = rt.zv
   order by rt.zv, x.sort, x.kennzahl;
end $f$;

-- ---------- 8. Ist gegen Soll --------------------------------------
-- Soll je Kennzahl nach Vorrang: 1. Klient_Vorgabe (Therapeutin, FL-4), 2. Ziel im Profil
-- (Benutzer: kcal, Eiweiß, KH, Fett), 3. Richtwert (DGE u. a.), für Mikros cb_mikro_soll (D-A-CH).
-- ist = Schnitt je erfasstem Tag; bei bezug 'woche' × 7. en% = Anteil an der Energie
-- (Eiweiß/KH/Zucker 4 kcal/g, Fett 9 kcal/g). g/kg = je kg Körpergewicht aus dem Profil.
create or replace function public.cb_auswertung_ist_soll(p_benutzer text, p_von date, p_bis date, p_raster text default 'gesamt')
returns table(zeitraum_von date, zeitraum_bis date, tage_erfasst int,
              kennzahl text, name text, einheit text, bezug text,
              ist numeric, soll numeric, soll_bis numeric, art text, erfuellt boolean, ist_prozent_vom_soll numeric,
              soll_herkunft text, quelle text, quelle_url text, quelle_stand text, hinweis text)
language plpgsql stable security definer set search_path = public as $f$
#variable_conflict use_column
declare v_b record; v_alter int; v_geschl text;
begin
  if not public.cb_auswertung_darf(p_benutzer) then raise exception 'Kein Zugriff auf dieses Tagebuch.'; end if;
  select * into v_b from public."Benutzer" where "Benutzer_ID" = p_benutzer;
  v_alter  := coalesce(extract(year from age(p_bis, v_b."Geburtsdatum"))::int, v_b."Alter");
  v_geschl := case v_b."Geschlecht" when 'männlich' then 'maennlich' when 'weiblich' then 'weiblich' end;

  return query
  with nw as materialized (select * from public.cb_auswertung_naehrwerte(p_benutzer, p_von, p_bis, p_raster, true)),
  gr as materialized (select * from public.cb_auswertung_gruppen(p_benutzer, p_von, p_bis, p_raster)),
  zr as (select distinct nw.zeitraum_von zv, nw.zeitraum_bis zb, nw.tage_erfasst te from nw),
  -- Kandidaten für Soll
  vorgabe as (
    select distinct on (v.kennzahl) v.kennzahl, null::text vname, v.wert, v.wert_bis, v.einheit, v.bezug, v.art,
           'Vorgabe Therapeutin'::text herkunft, coalesce(v.gesetzt_von, 'Vorgabe')::text quelle, null::text url,
           to_char(v.gueltig_ab, 'DD.MM.YYYY')::text stand, v.notiz hinweis, 1 rang
      from public."Klient_Vorgabe" v
     where v."Benutzer_ID" = p_benutzer and v.gueltig_ab <= p_bis and (v.gueltig_bis is null or v.gueltig_bis >= p_von)
     order by v.kennzahl, v.gueltig_ab desc, v.id desc),
  profil as (
    select k, null::text, w, null::numeric, e, 'tag'::text, 'etwa'::text, 'Ziel im Profil'::text, 'Profil des Klienten'::text,
           null::text, null::text, 'Im Ziel bei ±10 % (wie Tagebuch-Statistik der App).'::text, 2
      from (values ('kcal', v_b."Kalorienziel_kcal", 'kcal'), ('protein', v_b."Eiweiss_ziel_g", 'g'),
                   ('kh', v_b."KH_ziel_g", 'g'), ('fett', v_b."Fett_ziel_g", 'g')) p(k, w, e)
     where w is not null and w > 0),
  richt as (
    select distinct on (rw.kennzahl, rw.einheit) rw.kennzahl, rw.name, rw.wert, rw.wert_bis, rw.einheit, rw.bezug, rw.art,
           ('Richtwert ' || rw.herausgeber)::text, rw.quelle_titel, rw.quelle_url, rw.quelle_stand, rw.hinweis, 3
      from public."Richtwert" rw
     where rw.aktiv and (rw.geschlecht = 'alle' or rw.geschlecht = v_geschl)
       and coalesce(v_alter, 30) between rw.alter_von and rw.alter_bis
     order by rw.kennzahl, rw.einheit, (rw.geschlecht <> 'alle') desc, (rw.alter_bis - rw.alter_von))
  ,
  mikro as (
    select 'mikro:' || ms.naehrstoff, ms.naehrstoff, ms.soll, null::numeric, ms.einheit, 'tag'::text, 'mindestens'::text,
           ('Referenzwert ' || ms.quelle)::text, ms.quelle, null::text, null::text, ms.hinweis, 4
      from public.cb_mikro_soll(v_geschl, v_alter, coalesce(nullif(v_b."Zustand", ''), 'normal')) ms
     where ms.soll is not null),
  -- je Kennzahl die Soll-Quelle mit dem kleinsten Rang. Ein Anteil an der Energie (en%) ist eine
  -- eigene Größe und bleibt neben einer Gramm-Vorgabe stehen (z. B. Fett: Profilziel g und DGE en%).
  kand0 as (select * from vorgabe union all select * from profil union all select * from richt union all select * from mikro),
  kand as (select k.*, case when k.einheit = 'en%' then 'anteil' else 'menge' end dim from kand0 k),
  soll as (
    select k.kennzahl, k.vname, k.wert, k.wert_bis, k.einheit, k.bezug, k.art, k.herkunft, k.quelle, k.url, k.stand, k.hinweis, k.rang
      from kand k
     where not exists (select 1 from kand k2 where k2.kennzahl = k.kennzahl and k2.dim = k.dim and k2.rang < k.rang))
  ,
  ist as materialized (
    select zr.zv, zr.zb, zr.te, s.*,
      case
        when s.kennzahl like 'gruppe:%' then
          (select sum(gr.gramm) from gr where gr.zeitraum_von = zr.zv
              and gr.gruppe = any(string_to_array(substr(s.kennzahl, 8), '+'))) / nullif(zr.te, 0)
        when s.einheit = 'en%' then
          100.0 * (select nw.je_tag from nw where nw.zeitraum_von = zr.zv and nw.kennzahl = s.kennzahl)
                * case when s.kennzahl = 'fett' or s.kennzahl = 'ges_fett' then 9 else 4 end
                / nullif((select nw.je_tag from nw where nw.zeitraum_von = zr.zv and nw.kennzahl = 'kcal'), 0)
        else (select nw.je_tag from nw where nw.zeitraum_von = zr.zv and nw.kennzahl = s.kennzahl)
      end * case when s.bezug = 'woche' then 7 else 1 end as ist_wert,
      case when s.einheit = 'g/kg' then v_b."Gewicht_kg" end kg
    from zr cross join soll s)
  select i.zv, i.zb, i.te, i.kennzahl,
         coalesce(i.vname, (select l.name from public."Lebensmittelgruppe" l where 'gruppe:' || l.gruppe = i.kennzahl),
                  (select max(nw.name) from nw where nw.kennzahl = i.kennzahl), i.kennzahl),
         case when i.einheit = 'g/kg' then 'g' else i.einheit end,
         i.bezug,
         round(i.ist_wert, 1),
         round(case when i.einheit = 'g/kg' then i.wert * i.kg else i.wert end, 1),
         round(case when i.einheit = 'g/kg' then i.wert_bis * i.kg else i.wert_bis end, 1),
         i.art,
         case when i.te = 0 or (i.ist_wert is null and i.kennzahl not like 'gruppe:%') then null
              when i.einheit = 'g/kg' and i.kg is null then null
              else (with w as (select coalesce(i.ist_wert, 0) x,
                                      case when i.einheit = 'g/kg' then i.wert * i.kg else i.wert end lo,
                                      case when i.einheit = 'g/kg' then i.wert_bis * i.kg else i.wert_bis end hi)
                    select case i.art when 'mindestens' then x >= lo
                                      when 'hoechstens' then x <= lo
                                      when 'etwa' then abs(x - lo) <= lo * 0.1
                                      when 'bereich' then x between lo and coalesce(hi, lo) end from w)
         end,
         round(100.0 * coalesce(i.ist_wert, 0) / nullif(case when i.einheit = 'g/kg' then i.wert * i.kg else i.wert end, 0), 0),
         i.herkunft, i.quelle, i.url, i.stand,
         concat_ws(' ', i.hinweis,
                   case when i.einheit = 'g/kg' and i.kg is null then 'Kein Körpergewicht im Profil.' end,
                   case when i.kennzahl like 'mikro:%' and i.ist_wert is null and i.te > 0 then 'Keine Werte im Tagebuch.' end)
    from ist i
   order by i.zv, case when i.kennzahl like 'gruppe:%' then 2 when i.kennzahl like 'mikro:%' then 3 else 1 end, i.kennzahl;
end $f$;

-- Rechte: RPCs nur angemeldet; Schutz zusätzlich in cb_auswertung_darf
revoke execute on function public.cb_auswertung_eintraege(text, date, date) from public, anon;
revoke execute on function public.cb_auswertung_gruppen(text, date, date, text) from public, anon;
revoke execute on function public.cb_auswertung_naehrwerte(text, date, date, text, boolean) from public, anon;
revoke execute on function public.cb_auswertung_ist_soll(text, date, date, text) from public, anon;
grant execute on function public.cb_auswertung_eintraege(text, date, date) to authenticated;
grant execute on function public.cb_auswertung_gruppen(text, date, date, text) to authenticated;
grant execute on function public.cb_auswertung_naehrwerte(text, date, date, text, boolean) to authenticated;
grant execute on function public.cb_auswertung_ist_soll(text, date, date, text) to authenticated;
