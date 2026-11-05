// RIKI 2 – SCHATTEN-LESER
//
// v1 (2026-10-31, Ralph jaja „deinen Agenten parallel aufbauen als Test, Riki wird ersetzt, wenn dieser perfekt
//   funktioniert"). Liest dieselben Scans wie Riki und schreibt NUR in shadow_v1.riki2_lauf / riki2_quelle.
//   Produkte, Scores und Freigabe werden nicht beruehrt. Vergleich: shadow_v1.v_riki2_vergleich.
//
//   Was anders ist als bei Riki:
//   1. EIN Leser fuer alle Gratisquellen (EDEKA-LMIV, dm, Open Food Facts), parallel, jede mit Barcode-Beweis.
//      Ergebnis je Quelle ehrlich: treffer | gesperrt | leer | nicht_gefunden | ean_falsch | fehler.
//   2. ALLE Fotos eines Scans in EINER Lesung (bis 6; Riki liest hoechstens 3).
//   3. Feste Pruefungen vor der Uebernahme: Atwater, Zucker <= KH, ges. Fett <= Fett, Summe <= 108 g,
//      Portionsfalle, OFF-kcal aus kJ errechnet, Null-Werte gegen zweite Quelle.
//   4. Nichts wird erfunden: fehlt etwas, steht es in "fehlt". Widerspruch = Befund, nicht Mittelwert.
//
// v2 (2026-10-31, erste Messung, Fall Gefro Gemuesebruehe 4250589702734): (a) Etikett nennt nur Werte
//   „zubereitet" -> nicht uebernehmen (Ralph 13.10.: Naehrwerte wie verkauft), Befund nur_zubereitet. (b) Abgleich
//   Foto-Teilliste gegen Fremdquelle strenger: bis 6 Zutaten in Reihenfolge, >= 80 % gleich. Vorher reichten 2 von 3,
//   so kam die alte OFF-Rezeptur („10 % Gemuese, Isomaltulose") gegen das neue Etikett durch.
//
//   (c) dm-Bremse: hoechstens eine dm-Anfrage gleichzeitig, 300 ms Abstand. Bei 6 parallelen Laeufen kam 3x HTTP 429.
//   429 heisst jetzt "ueberlast" (nicht "gesperrt"): Last, keine Sperre.
//
// v3 (2026-10-31, gleicher Fall): Widerspricht eine Quelle dem Foto DIESES Scans bei den Zutaten (andere Rezeptur),
//   werden auch ihre Naehrwerte nicht uebernommen (Befund naehrwerte_andere_rezeptur). OFF lieferte 162 kcal der alten Rezeptur.
//
// v4 (2026-10-31, Pruefung der ersten 36 Laeufe): (a) OFF: ist ingredients_text_de leer, ingredients_text nehmen, wenn
//   der Text deutsch aussieht (Skyr 4070308071763: lang=en, Text deutsch). (b) Zutatentext-Pruefung fuer jede Quelle:
//   Bruchstueck („laktose", 20310608) oder Muell („002971 340303 181 kcal …", 4002971340303) wird nicht uebernommen.
//   (c) kJ gegen kcal: weichen sie > 4 % ab, sperrt der Befund (OFF Choc Pudding: 331 kJ, aber 73,15 kcal).
//
// v5 (2026-10-31): kJ/kcal-Pruefung nach EU-Umrechnungsfaktoren (VO 1169/2011 Anh. XIV): Eiweiss/KH 17/4, Fett 37/9,
//   Ballaststoffe 8/2, Polyole 10/2,4 -> Verhaeltnis kJ:kcal liegt zwischen 3,9 und 4,3. v4 pruefte starr gegen 4,184 und
//   verwarf die Weingummis (Polyole, 1233 kJ / 313 kcal = 3,94) zu Unrecht.
//
// v6 (2026-10-31, Ralph „Herstellerseiten einbauen"): HERSTELLERWEG nur bei Luecke (Zutaten oder Naehrwerte fehlen).
//   Websuche (Haiku 5.5, max. 2 Suchen, gesperrte Shops REWE/Kaufland/Netto per blocked_domains gar nicht erst gesucht)
//   liefert bis zu 3 Adressen. Riki 2 liest selbst: Shopify-JSON (Barcode der Varianten), JSON-LD (gtin), EAN-Regex,
//   Text + bis zu 2 Unterseiten „Zutaten/Naehrwerte" (LaVita-Fall), dann Haiku 5.5 mit festem Schema.
//   Mit Barcode-Beweis zaehlt die Seite wie dm; ohne Beweis nur als Lueckenfueller nach OFF, Befund vorlaeufig_ohne_ean
//   (Ralph 28.09.: Ladenscan → Herstellerseite vorlaeufig). Ersetzt spaeter riki-research + riki-herstellerseite.
//
// v6.2 (2026-10-31, Fall gefro.de): Steht die Scan-EAN auf der Seite, ist das Produkt belegt – das Modell wird
//   nicht mehr gefragt, ob es passt (Haiku sagte trotz JSON-LD-GTIN „nein"). Seitenauswertung mit effort medium.
//   dm.de/dm.at aus der Suche: dm lesen wir schon ueber die Schnittstelle, die Seiten sind leere JS-Huellen.
//
// v6.3 (2026-10-31, Ralph Entscheid A „nur wie verkauft"): Bruehe/Bouillon/Wuerfel/gekoernte Bruehe unter 50 kcal
//   je 100 g = wohl zubereitete Werte -> sperrt (Pulver liegt wie verkauft bei 150-300 kcal). OFF fuehrt bei 12 von 12
//   geprueften Bruehpulvern nur zubereitete Werte, oft im Feld „wie verkauft". Fluessiges (Fond, Glas, Tetra) ausgenommen.
//
// v6.4 (2026-10-31, Ralph „dann zubereitet verwenden und Regelwerk wieder aendern mit Begruendung" + jaja „anpassen"):
//   Regel BR-NW-WIE-VERKAUFT Fassung 2: Zubereitungsprodukte (Bruehe, Bouillon, Wuerfel, gekoernte Bruehe, Suppen- und
//   Sossenpulver) werden ZUBEREITET bewertet, wie das Etikett es nennt – auch wenn beide Spalten da sind. Grund: wie
//   verkauft liess sich nur fuer 15 von 185 Bruehpulvern belegen (Nachholen 31.10.). Fotolesung und Seitenauswertung
//   liefern dafuer naehrwert_basis "zubereitet" mit der zubereiteten Spalte; OFF nimmt bei Bruehe die *_prepared_100g-Felder.
//   Uebernommen nur, wenn der Name ein Zubereitungsprodukt ist (zubereitungsprodukt()); sonst gilt weiter wie verkauft.
//   v6.3-Sperre (< 50 kcal) ersetzt durch das Gegenteil: Bruehe mit >= 50 kcal = Werte wie verkauft -> sperrt.
//
// v6.5 (2026-10-31, Ralph jaja „verbessern", Faelle KoRo + ALDI aus dem 13er-Test):
//   DEUTSCHE SEITE: Ist eine gefundene Seite nicht deutsch (<html lang>), folgt Riki 2 ihrem Sprachverweis
//   (hreflang de-DE, sonst de/de-AT/de-CH/de-*) und liest die deutsche Fassung (KoRo /ie -> korodrogerie.de).
//   Deutsche Adressen stehen vorn; doppelte Ziele werden nur einmal gelesen. Die Suche soll deutsche Seiten nennen.
//   ANDERE SORTE: Ohne Barcode-Beweis wird eine Seite verworfen, wenn (a) ihre Sorte (Feld sorte_seite) kein Wort
//   mit dem Scan-Namen teilt (ALDI Skyr „Erdbeere" fuer „HighProtein Skyr Drink") oder (b) die Suche auf demselben
//   Shop mehrere Seiten derselben Linie fand – dann ist ohne Barcode nicht klar, welche Sorte gescannt wurde.
//
// v6.6 (2026-10-31, Nachpruefung v6.5): Suche nannte bei KoRo gar keine Seite mehr, weil nur deutsche verlangt waren –
//   jetzt: deutsche bevorzugen, sonst die fremdsprachige trotzdem nennen (Riki 2 folgt selbst dem hreflang).
//   sorte_seite = VOLLSTAENDIGE Sortenbezeichnung (My Vay: „Chicken Style" statt „Spicy Sticks Chicken Style" verwarf die richtige Seite).
//
// v6.7 (2026-10-31, Ralph jaja „v6.7", Abgleich der Faelle „nur Riki"):
//   CODECHECK als vierte kostenlose Quelle, nur Zutaten: Suche per Barcode -> Produktseite -> Liste aus
//   id="ingredients_list" (wie Rikis off_abgleich). Uebernommen nur, wenn die Scan-EAN auf der Seite steht.
//   Rang nach OFF (beide gemeinschaftlich gepflegt). Faelle: Ehrmann Choc Pudding 4002971340303, Kania Curry Ketchup 4335619446403.
//   VORRANG ECHTER SCANS: Laeufe mit Eingang „nachholen" (Tests, Bestand) duerfen den Tagesdeckel nur bis auf
//   0,50 $ Rest nutzen (31.10.: Tests verbrauchten den Deckel, 3 echte Scans liefen ohne Foto/Herstellerweg).
//
// v6.8 (2026-11-01, Ralph „Ja, so eintragen", Fall Jeden Tag H-Vollmilch 4306188362593):
//   REINE MILCH: Packung hat keine Zutatenliste (LMIV Art. 19, eine Zutat). Findet keine Quelle eine Liste und ist der
//   Name reine Kuhmilch ohne Zusatz und Naehrwerte wie Milch (25–75 kcal, KH <= 6 g, Fett <= 4,5 g, Eiweiss 2,8–4,5 g), gilt „Milch" (Quelle regel:einzutat).
//   Spart dann auch die Websuche (vorher 0,023 $ und 7 s fuer nichts).
//
// v6.9 (2026-11-01, Ralph „ja, verbesserung bauen", Idee Quellenkette REWE/Ehrmann High Protein Mango):
//   OFF-NAMENSSUCHE: Bleibt nach den Barcode-Quellen eine Luecke, sucht Riki 2 kostenlos bei OFF nach Marke + Name
//   (0,5 s). Nur ein eindeutiger Kandidat (Marke gleich, alle Sortenwoerter, eine Zutatenliste) zaehlt – immer „vorläufig".
//   Erst wenn danach noch etwas fehlt, kommt die bezahlte Websuche. REWE bleibt gesperrt (403 + Captcha auch fuer
//   rewe.de/shop/p/…), wird nicht umgangen.
//   SALZ 0 bei Milchprodukten (Name oder erste Zutat Milch/Joghurt/Quark …, Eiweiss >= 2,5 g) -> „salz_ungeklaert".
//   NAECHSTER SCHRITT: ergebnis.naechster_schritt = "etikettfoto", wenn etwas fehlt oder nur Vorlaeufiges da ist.
//
// v7.0 (2026-11-03, Ralph „jaja, bauen", Test an 8 Produkten):
//   SPRACHE: fremdsprachige Listen werden abgewiesen (Pilos Duo Mus kam italienisch durch, „aroma" zaehlte als deutsch);
//   gezaehlt werden verschiedene Woerter, nicht Wiederholungen.
//   NAEHRWERTE: fehlen Salz, Zucker oder ges. Fett -> fehlt „naehrwerte_teilweise" (Milsani Skyr galt als vollstaendig);
//   Quellen mit vollstaendiger Tabelle werden vorgezogen. Viele Nachkommastellen (528,037 kcal) = umgerechnet -> „nw_umgerechnet", vorlaeufig.
//   EINE ZUTAT: Mineral-/Quellwasser (nur mit Sorte im Namen) und purer Honig wie Milch – Naehrwerte nie dazuerfunden.
//   SORTE UNBEKANNT: nennt der Scan-Name nur die Marke, wird eine Seite ohne Barcode nicht als „anderes Produkt" gefuehrt, sondern „sorte_unbekannt".
//
// v7.1 (2026-11-04, Ralph „jaja bau riki 2 so", Idee „erst abschreiben, dann deuten"):
//   TABELLE WOERTLICH: das Modell schreibt die Naehrwerttabelle Zeile fuer Zeile ab (Beschriftung, Spalte, Wert);
//   welche Zahl Fett/Eiweiss/… ist, entscheidet der Code. Die Modell-Zuordnung bleibt als Vergleich.
//   GEZIELT NACHLESEN: schlaegt eine Rechenprobe an oder ordnen Code und Modell anders zu, liest Riki 2 NUR die Tabelle
//   (nur das Foto mit der Tabelle) noch einmal – mit anderer Frage: je Wert Zeile + Nachbarzeilen. Nur bei Verdacht.
//
//   Fotolesung: claude-sonnet-5-5 (Wert aus shadow_v1.riki2_config.modell), eigener Deckel 1 $/Tag.
//   Server-seitiger Fallback bei Ablehnung ist an (fallbacks: "default").

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

const VERSION = "riki2 v7.1";
const UA = "RootIndex/1.0 (root-index.de)";
const QUELLE_TIMEOUT_MS = 8000;
const RESERVE_ECHTE_SCANS = 0.5;
// Sonnet 5.5: 2 $ / 10 $ je 1 Mio Tokens (Stand 06.10.2026)
const PREIS: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-4-8": [5, 25],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

type NW = { kcal?: number | null; kj?: number | null; fett?: number | null; ges_fett?: number | null; kh?: number | null;
  zucker?: number | null; ballaststoffe?: number | null; protein?: number | null; salz?: number | null };
type Befund = { art: string; quelle?: string; text: string; sperrt?: boolean };
type Quelle = {
  quelle: string; url?: string | null; http?: number | null; ergebnis: string; ean_beweis?: string | null;
  name?: string | null; marke?: string | null; zutaten_text?: string | null; naehrwerte?: NW | null;
  befunde: Befund[]; dauer_ms: number;
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const k = env["ANTHROPIC_API_KEY"];
  if (typeof k === "string" && k.trim().startsWith("sk-ant-api")) return k.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-api")) return v.trim();
  return null;
}

// ---------- Barcode ----------
const ohneNullen = (x: unknown) => String(x ?? "").replace(/\D/g, "").replace(/^0+/, "");
const gtinGleich = (a: unknown, b: unknown) => ohneNullen(a) !== "" && ohneNullen(a) === ohneNullen(b);
function gtinGueltig(code: unknown): boolean {
  const s = String(code ?? "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(s.length)) return false;
  const z = s.split("").map(Number);
  const pruef = z.pop()!;
  const summe = z.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === pruef;
}

// ---------- Hilfen ----------
async function holen(url: string, accept = "application/json"): Promise<{ status: number; text: string }> {
  const c = new AbortController();
  const uhr = setTimeout(() => c.abort(), QUELLE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": accept, "Accept-Language": "de-DE,de;q=0.9" }, signal: c.signal, redirect: "follow" });
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(uhr);
  }
}
const zahl = (x: unknown): number | null => {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(/[^0-9,.\-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const ohneHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const ohneZutatenWort = (s: string) => s.replace(/^\s*zutaten\s*:\s*/i, "").trim();
const klammernAusgeglichen = (s: string) => (s.match(/\(/g) ?? []).length === (s.match(/\)/g) ?? []).length;
function sauberNW(nw: NW | null | undefined): NW | null {
  if (!nw) return null;
  const o: NW = {};
  for (const k of ["kcal", "kj", "fett", "ges_fett", "kh", "zucker", "ballaststoffe", "protein", "salz"] as const) {
    const v = zahl((nw as any)[k]);
    if (v !== null) o[k] = v;
  }
  return Object.keys(o).length ? o : null;
}
const nwKomplett = (nw: NW | null | undefined) => !!nw && [nw.kcal, nw.protein, nw.kh, nw.fett].every((v) => typeof v === "number");
const NW_PFLICHT = ["salz", "zucker", "ges_fett"] as const;
const NW_WORT: Record<string, string> = { salz: "Salz", zucker: "Zucker", ges_fett: "gesättigte Fette" };

// ---------- Pruefungen (fest, ohne Modell) ----------
// v7.0: verschiedene Woerter zaehlen, nicht Wiederholungen; „aroma" ist auch italienisch/spanisch – zaehlt nur,
// wenn keine fremden Woerter ueberwiegen (Kraeutertee „Grüner Tee, Aroma, Ingwer" bleibt deutsch)
const DEUTSCH = /\b(und|enthält|enthalten|kann|spuren|milch|zucker|salz|wasser|säuerungsmittel|emulgator|weizen|gewürze|pflanzliche|aus|mit|sahne|stärke|natürliches|süßungsmittel|verdickungsmittel)\b/gi;
const FREMD = /\b(ingredienti|ingrédients|ingredients|ingredientes|ingrediënten|ingrediencie|składniki|latte|zucchero|panna|acqua|edulcoranti|addensanti|conservare|sucre|lait|sel|eau|farine|beurre|huile|émulsifiant|arôme|sugar|milk|salt|water|flour|azúcar|leche|harina|aceite|suiker|melk|zout|meel|olie|smaakstof)\b/gi;
const verschiedene = (t: string, re: RegExp) => new Set((t.match(re) ?? []).map((w) => w.toLowerCase())).size;
function siehtDeutschAus(t: string): boolean {
  if (fremdsprachig(t)) return false;
  const punkte = verschiedene(t, DEUTSCH) + (/\baroma\b/i.test(t) ? 1 : 0) + ((/[äöüß]/i.test(t)) ? 1 : 0);
  // ohne jedes fremde Wort reicht ein deutsches Wort, das mehrfach vorkommt (Brot: „Wasser … Wasser")
  return punkte >= 2 || (verschiedene(t, FREMD) === 0 && (t.match(DEUTSCH) ?? []).length >= 2);
}
// v7.0 (Pilos Duo Mus 4335619348585: OFF hatte die italienische Liste, „aroma" zweimal liess sie als deutsch durch)
function fremdsprachig(t: string): boolean {
  const fremd = verschiedene(t, FREMD), deutsch = verschiedene(t, DEUTSCH) + ((/[äöüß]/i.test(t)) ? 1 : 0);
  return fremd >= 3 && fremd > deutsch;
}
// Liefert einen Grund, wenn der Text keine brauchbare Zutatenliste ist, sonst null.
function zutatenUnbrauchbar(t: string, name: string): string | null {
  const s = t.trim();
  if (fremdsprachig(s)) return "Liste ist nicht deutsch";
  if (/\b(kcal|kj|brennwert|nährwert|naehrwert)\b|https?:|www\.|@/i.test(s)) return "Text enthält Nährwert-, Web- oder Adressangaben";
  const ziffern = (s.match(/\d/g) ?? []).length;
  if (s.length > 0 && ziffern / s.length > 0.25) return "Text besteht überwiegend aus Ziffern";
  const posten = ersteN(s, 3);
  if (posten.length < 2) {
    const n = name.toLowerCase();
    const einzel = (posten[0] ?? s).toLowerCase();
    // Einzutaten-Produkte (Quark, Milch, Nüsse) sind erlaubt, wenn die eine Zutat zum Namen passt
    if (!einzel || !(n.includes(einzel) || einzel.includes(n.split(/\s+/)[0] ?? "") || gleicheZutat(einzel, n))) return `nur ein Bruchstück („${s.slice(0, 40)}")`;
  }
  return null;
}
// v6.4: Produkte, die nur zubereitet gegessen werden (Regel BR-NW-WIE-VERKAUFT Fassung 2)
function zubereitungsprodukt(name: string): boolean {
  const n = name.toLowerCase();
  return /(brühe|bruehe|bouillon|brühwürfel|suppenwürfel|gekörnt|streuwürze|suppenpulver|soßenpulver|saucenpulver|bratensoße|bratensauce|tassensuppe|tütensuppe|instantsuppe)/.test(n)
    && !/(fond|flüssig|fluessig|fertig|im glas|tetra|knochenbrühe|suppe mit|klare brühe mit)/.test(n);
}
// v6.9: Erzeugnis auf Milchbasis (Name oder erste Zutat), nicht pflanzlich, mit nennenswert Eiweiss
function milchprodukt(name: string, zutaten: string | null, nw: NW): boolean {
  const n = name.toLowerCase();
  if (/(hafer|soja|mandel|kokos|vegan|pflanz|reisdrink|cashew|erbse|butter|schokolade|riegel|keks)/.test(n)) return false;
  if (typeof nw.protein !== "number" || nw.protein < 2.5) return false;
  const z = (zutaten ?? "").toLowerCase().replace(/[_*]/g, "").trim();
  return /(milch|joghurt|jogurt|quark|skyr|kefir|käse|kaese|pudding|sahne)/.test(n)
    || /^(pasteurisierte |entrahmte |teilentrahmte |frische |fettarme )*(mager|voll)?(milch|joghurt|quark|skyr|kefir|sahne|buttermilch)/.test(z);
}
// v6.8: Reine Kuhmilch (Voll-, H-, Frisch-, fettarme Milch). Sie braucht keine Zutatenliste (LMIV Art. 19:
// ein Erzeugnis aus einer Zutat) – die eine Zutat ist „Milch". Alles mit Zusatz, Geschmack oder anderer Tierart gilt nicht.
function reineMilch(name: string, nw: NW | null): boolean {
  const n = name.toLowerCase();
  if (/(kakao|schoko|choco|erdbeer|vanill|banan|kaffee|latte|mokka|drink|getränk|getraenk|mix|shake|protein|laktosefrei|lactosefrei|laktase|hafer|soja|mandel|reis|kokos|cashew|erbse|dinkel|butter|dick|sauer|kondens|pulver|schnitte|ziege|schaf|stute|kamel|joghurt|kefir|quark|käse|kaese|sahne|creme|eis|zucker|vitamin|omega|calcium|kalzium|yog|gouda|caramel|nois|praline|riegel|tafel|keks|aus )/.test(n)) return false;
  const wort = n.split(/[\s,;()/]+/).some((w) => /^(h-?)?(bio-?)?(voll|frisch|weide|heu|land|alpen|berg|bergbauern|mager|roh|vorzugs|teilentrahmte|entrahmte)?-?milch$/.test(w));
  if (!wort) return false;
  // Nur mit Nährwerten wie Milch: „Vollmilch" steht auch auf Schokolade, Käse und Joghurt
  if (!nw || typeof nw.kcal !== "number" || typeof nw.kh !== "number" || typeof nw.fett !== "number") return false;
  if (nw.kcal < 25 || nw.kcal > 75 || nw.kh > 6 || nw.fett > 4.5) return false; // mehr KH als Milchzucker = Zusatz
  if (typeof nw.protein === "number" && (nw.protein < 2.8 || nw.protein > 4.5)) return false;
  return true;
}
// v7.0: Weitere Erzeugnisse aus einer Zutat. Mineral-/Quellwasser nur, wenn der Name die Sorte (mit/ohne Kohlensaeure)
// verraet – „Elisabethen" allein reicht nicht. Honig nur pur (Honigverordnung: kein Zusatz erlaubt). Liefert die Zutat oder null.
function einzutatWasser(name: string, nw: NW | null): string | null {
  const roh = name.toLowerCase();
  const sprudel = /(medium|classic|klassik|klassisch|spritzig|sprudel|perlend|perlig|prickelnd|mild|sanft|mit kohlensäure|mit kohlensaeure)/.test(roh);
  const n = roh.replace(/mit kohlens(ä|ae)ure( versetzt)?/g, "");
  if (/(tafelwasser|heilwasser|aroma|geschmack|zitrone|limette|apfel|orange|frucht|vitamin|plus|tee|schorle|limo|sirup|mit )/.test(n)) return null;
  const art = /mineralwasser/.test(n) ? "Natürliches Mineralwasser" : /quellwasser/.test(n) ? "Quellwasser" : null;
  if (!art) return null;
  if (nw && ((typeof nw.kcal === "number" && nw.kcal > 1) || (typeof nw.kh === "number" && nw.kh > 0.5))) return null;
  const still = /(naturell|still|ohne kohlensäure|ohne kohlensaeure|ohne zusatz von kohlens)/.test(roh);
  if (sprudel && !still) return `${art}, mit Kohlensäure versetzt`;
  if (still && !sprudel) return art;
  return null;
}
// Honig: der Name darf nur aus Honigsorte + Beschreibung + Marke bestehen (Liste statt Ausschluss: „Erdbeer in Honig",
// „Honig & Ostseesalz", „Hanfhonig" mit Hanfoel sind keine reinen Honige)
const HONIGSORTE = "(blüten|bluten|akazien|raps|linden|wald|tannen|kastanien|heide|klee|sonnenblumen|orangenblüten|lavendel|manuka|kanuka|thymian|eukalyptus|buchweizen|löwenzahn|sommertracht|frühtracht|frühlingsblüten|sommerblüten|wildblüten|wildblumen|obstblüten|bienen|imker|tropen|wiesen|sommer|frühlings|berg|alpen|gebirgs|koriander|rosmarin|salbei|zitrus|orangen|edelkastanien)";
const HONIGWORT = new RegExp(`^(${HONIGSORTE}-?)?honig$`);
const HONIG_BESCHREIBUNG = /^(bio|flüssig(er|e|es)?|cremig(er|e|es)?|gerührt(er|e|es)?|fest(er|e|es)?|echt(er|e|es)?|deutsch(er|e|es)?|naturrein(er|e|es)?|rein(er|e|es)?|natur|aus|von|der|dem|den|region|regional(er|e|es)?|heimisch(er|e|es)?|multifloral|monofloral|mgo|umf|premium|fein(er|e|es)?|mild(er|e|es)?|kräftig(er|e|es)?|original|traditionell(er|e|es)?|spender|glas|deutschland|österreich|neuseeland|europa|eu|nicht-eu|eu-?länder|\d+\+?|\d+([.,]\d+)?(g|kg)|g|kg|\+)$/;
function einzutatHonig(name: string, nw: NW | null, marke: string | null = null): string | null {
  const n = name.toLowerCase();
  if (/[&]| und | mit | in | im /.test(` ${n} `)) return null;
  const mw = (marke ?? "").toLowerCase().split(/[\s,;()/]+/).filter(Boolean);
  const woerter = n.split(/[\s,;()/]+/).filter(Boolean);
  // „Blüten Honig" getrennt geschrieben: Sortenwort direkt vor „honig" zaehlt mit
  let honig: string | null = null;
  for (let k = 0; k < woerter.length; k++) {
    const w = woerter[k];
    if (HONIGWORT.test(w)) { honig = honig ?? w; continue; }
    if (new RegExp(`^${HONIGSORTE}$`).test(w) && woerter[k + 1] === "honig") continue;
    if (HONIG_BESCHREIBUNG.test(w) || mw.includes(w)) continue;
    return null;
  }
  if (!honig) return null;
  if (nw && typeof nw.kcal === "number" && (nw.kcal < 260 || nw.kcal > 360 || (typeof nw.fett === "number" && nw.fett > 0.5))) return null;
  // Schreibweise aus dem Namen uebernehmen (Manuka-Honig, Waldhonig)
  const orig = name.split(/[\s,;()/]+/).find((w) => w.toLowerCase() === honig) ?? honig;
  return orig.charAt(0).toUpperCase() + orig.slice(1);
}
function pruefeNaehrwerte(nw: NW | null, name: string, quelle: string): Befund[] {
  const b: Befund[] = [];
  if (!nw) return b;
  const { kcal, fett, ges_fett, kh, zucker, ballaststoffe, protein, salz } = nw;
  if ([kcal, fett, kh, protein].every((v) => typeof v === "number")) {
    const ber = 4 * protein! + 4 * kh! + 9 * fett! + 2 * (ballaststoffe ?? 0);
    const diff = Math.abs(kcal! - ber);
    if (diff > 20 && diff > 0.3 * Math.max(kcal!, 1)) {
      b.push({ art: "atwater", quelle, text: `kcal ${kcal} passt nicht zu den Makros (errechnet ${Math.round(ber)})`, sperrt: true });
    }
  }
  if (typeof kcal === "number" && typeof nw.kj === "number" && nw.kj > 0) {
    const verh = nw.kj / Math.max(kcal, 0.1);
    const ausKj = nw.kj / 4.184;
    if ((verh < 3.9 || verh > 4.3) && Math.abs(kcal - ausKj) > 3) b.push({ art: "kj_kcal_widerspruch", quelle, text: `${nw.kj} kJ zu ${kcal} kcal (Verhältnis ${verh.toFixed(2)}, erlaubt 3,9–4,3)`, sperrt: true });
  }
  if (typeof zucker === "number" && typeof kh === "number" && zucker > kh + 0.5) b.push({ art: "zucker_ueber_kh", quelle, text: `Zucker ${zucker} > KH ${kh}`, sperrt: true });
  if (typeof ges_fett === "number" && typeof fett === "number" && ges_fett > fett + 0.5) b.push({ art: "gesfett_ueber_fett", quelle, text: `ges. Fett ${ges_fett} > Fett ${fett}`, sperrt: true });
  const summe = (protein ?? 0) + (kh ?? 0) + (fett ?? 0) + (ballaststoffe ?? 0) + (salz ?? 0);
  if (summe > 108) b.push({ art: "summe_ueber_100", quelle, text: `Makros zusammen ${summe.toFixed(1)} g je 100 g`, sperrt: true });
  const n = name.toLowerCase();
  if (typeof kcal === "number") {
    if (zubereitungsprodukt(name) && kcal >= 50) {
      b.push({ art: "wie_verkauft_statt_zubereitet", quelle, text: `Brühe/Pulver mit ${kcal} kcal je 100 g – Werte wie verkauft; bewertet wird zubereitet (BR-NW-WIE-VERKAUFT F2)`, sperrt: true });
    }
    if (/\b(chips|crisps|nachos|tortilla)/.test(n) && kcal < 300) b.push({ art: "portionsfalle", quelle, text: `Chips mit ${kcal} kcal – wohl Portion statt 100 g`, sperrt: true });
    if (/(^|\s)(oel|öl)\b|speiseöl|olivenöl|rapsöl/.test(n) && !/sardin|thunfisch|in öl|dressing/.test(n) && kcal < 700) b.push({ art: "portionsfalle", quelle, text: `Öl mit ${kcal} kcal – wohl Portion statt 100 g`, sperrt: true });
    if (/\b(nüsse|nuesse|mandeln|erdnüsse|cashew|walnüsse|haselnüsse)\b/.test(n) && !/drink|riegel|joghurt|creme/.test(n) && kcal < 450) b.push({ art: "portionsfalle", quelle, text: `Nüsse mit ${kcal} kcal – wohl Portion statt 100 g`, sperrt: true });
  }
  return b;
}

// ---------- Quelle: EDEKA-LMIV (B2B-Portal, kostenlos) ----------
async function quelleEdeka(ean: string): Promise<Quelle> {
  const t0 = Date.now();
  const q: Quelle = { quelle: "edeka-lmiv", url: "https://lmiv.edeka-foodservice.de/", ergebnis: "fehler", befunde: [], dauer_ms: 0 };
  try {
    const s = await holen(`https://lmiv.edeka-foodservice.de/.rest/search/v1/productsearch?mandant=efs,ecc&index=products&term=${ean}`);
    q.http = s.status;
    if (s.status === 403 || s.status === 429) { q.ergebnis = "gesperrt"; return q; }
    if (s.status !== 200) return q;
    const treffer = (JSON.parse(s.text)?.results ?? []).find((t: any) => gtinGleich(ohneHtml(String(t?.mainGlobalTradeItemNumber ?? "")), ean));
    if (!treffer) { q.ergebnis = "nicht_gefunden"; return q; }
    q.ean_beweis = "mainGlobalTradeItemNumber = EAN";
    q.name = ohneHtml(String(treffer.name ?? treffer.productName ?? treffer.title ?? "")) || null;
    const z = ohneZutatenWort(ohneHtml(String(treffer.listOfIngredients ?? "")));
    if (z) {
      // Der Suchtreffer kuerzt lange Listen (~500 Zeichen) - dann nicht uebernehmen (29.10.)
      if (z.length >= 480 || !klammernAusgeglichen(z)) q.befunde.push({ art: "gekuerzt", quelle: q.quelle, text: `Zutatenliste im Suchtreffer vermutlich abgeschnitten (${z.length} Zeichen)` });
      else q.zutaten_text = z;
    }
    // Naehrwerte aus der Produktseite (data-config). Erste Zeile je Wert = je 100 g (15.09.: Portionsfalle).
    const art = treffer.articleId;
    for (const reg of ["ECC", "EFS"]) {
      if (!art) break;
      try {
        const p = await holen(`https://lmiv.edeka-foodservice.de/produkte?articleId=${art}&region=${reg}`, "text/html");
        if (p.status !== 200) continue;
        const cfg = p.text.match(/<cmp-product-detail[^>]*data-config='([^']*)'/)?.[1];
        if (!cfg) continue;
        const d = JSON.parse(cfg.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
        const nw: NW = {};
        for (const r of d?.nutritionalValues ?? []) {
          const l = String(r?.label ?? "").toLowerCase();
          const k = l.startsWith("brennwert in kcal") ? "kcal" : l.startsWith("brennwert in kj") ? "kj"
            : /^fett, davon ges/.test(l) ? "ges_fett" : l === "fett" ? "fett"
            : l.startsWith("kohlenhydrate, davon") ? "zucker" : l === "kohlenhydrate" ? "kh"
            : l.startsWith("ballaststoffe") ? "ballaststoffe" : /^(eiweiß|eiweiss|protein)/.test(l) ? "protein"
            : l === "salz" ? "salz" : null;
          const v = zahl(r?.per100);
          if (k && v !== null && (nw as any)[k] === undefined) (nw as any)[k] = v;
        }
        if (Object.keys(nw).length) { q.naehrwerte = nw; break; }
      } catch (_) { /* naechste Region */ }
    }
    q.ergebnis = q.zutaten_text || nwKomplett(q.naehrwerte) ? "treffer" : "leer";
    return q;
  } catch (e) {
    q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    return q;
  } finally {
    q.dauer_ms = Date.now() - t0;
  }
}

// ---------- Quelle: dm (oeffentliche Produkt-Schnittstelle, kostenlos) ----------
let dmKette: Promise<void> = Promise.resolve();
function dmWarten(): Promise<void> {
  const dran = dmKette.then(() => new Promise<void>((r) => setTimeout(r, 300)));
  dmKette = dran;
  return dran;
}
async function quelleDm(ean: string): Promise<Quelle> {
  await dmWarten();
  const t0 = Date.now();
  const q: Quelle = { quelle: "dm", ergebnis: "fehler", befunde: [], dauer_ms: 0 };
  try {
    const s = await holen(`https://product-search.services.dmtech.com/de/search?query=${ean}&pageSize=3`);
    q.http = s.status;
    if (s.status === 429) { q.ergebnis = "ueberlast"; return q; }
    if (s.status === 403) { q.ergebnis = "gesperrt"; return q; }
    if (s.status !== 200) return q;
    const t = (JSON.parse(s.text)?.products ?? []).find((p: any) => gtinGleich(p?.gtin, ean));
    if (!t?.dan) { q.ergebnis = "nicht_gefunden"; return q; }
    const d0 = await holen(`https://products.dm.de/product/products/detail/DE/dan/${t.dan}`);
    q.http = d0.status;
    if (d0.status !== 200) return q;
    const d = JSON.parse(d0.text);
    if (!gtinGleich(d?.gtin, ean)) { q.ergebnis = "ean_falsch"; q.befunde.push({ art: "ean_falsch", quelle: "dm", text: `GTIN am Detail ${d?.gtin}` }); return q; }
    q.ean_beweis = "GTIN in Suche und Detail = EAN";
    q.url = "https://www.dm.de" + (d?.self ?? "");
    q.marke = t.brandName ?? d?.brand?.name ?? null;
    q.name = d?.title?.headline ?? null;
    const nw: NW = {};
    for (const g of d?.descriptionGroups ?? []) {
      if (g?.header === "Zutaten") {
        for (const b of g?.contentBlock ?? []) for (const z of b?.texts ?? []) {
          const m = String(z).match(/Zutaten\s*:\s*([^\n]+)/i);
          if (!q.zutaten_text && m) q.zutaten_text = m[1].replace(/\s+/g, " ").trim();
        }
      } else if (g?.header === "Nährwerte") {
        for (const b of g?.contentBlock ?? []) for (const r of b?.table ?? []) {
          const l = String(r?.[0] ?? "").toLowerCase();
          const w = String(r?.[1] ?? "");
          if (l === "brennwert") {
            const kc = w.match(/([0-9][0-9.,]*)\s*kcal/i)?.[1];
            const kj = w.match(/([0-9][0-9.,]*)\s*kj/i)?.[1];
            if (kc) nw.kcal = zahl(kc.replace(/\.(?=\d{3})/g, ""));
            if (kj) nw.kj = zahl(kj.replace(/\.(?=\d{3})/g, ""));
            continue;
          }
          const k = l === "fett" ? "fett" : l.startsWith("davon gesättigte") ? "ges_fett" : l === "kohlenhydrate" ? "kh"
            : l.startsWith("davon zucker") ? "zucker" : l.startsWith("ballaststoffe") ? "ballaststoffe"
            : /^(eiweiß|eiweiss|protein)/.test(l) ? "protein" : l === "salz" ? "salz" : null;
          const v = zahl(w);
          if (k && v !== null) (nw as any)[k] = v;
        }
      }
    }
    q.naehrwerte = Object.keys(nw).length ? nw : null;
    q.ergebnis = q.zutaten_text || nwKomplett(q.naehrwerte) ? "treffer" : "leer";
    return q;
  } catch (e) {
    q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    return q;
  } finally {
    q.dauer_ms = Date.now() - t0;
  }
}

// ---------- Quelle: Codecheck (v6.7, gemeinschaftlich, nur Zutaten) ----------
async function quelleCodecheck(ean: string): Promise<Quelle> {
  const t0 = Date.now();
  const q: Quelle = { quelle: "codecheck", url: null, ergebnis: "fehler", befunde: [], dauer_ms: 0 };
  try {
    const s = await holen(`https://www.codecheck.info/product.search?q=${ean}`, "text/html");
    q.http = s.status;
    if (s.status === 403 || s.status === 429 || s.status === 503) { q.ergebnis = "gesperrt"; return q; }
    if (s.status !== 200) return q;
    const link = s.text.match(/href="(\/p\/lebensmittel\/[^"]+\.html)"/)?.[1];
    if (!link) { q.ergebnis = "nicht_gefunden"; return q; }
    q.url = "https://www.codecheck.info" + link;
    const p = await holen(q.url, "text/html");
    q.http = p.status;
    if (p.status !== 200) return q;
    if (!new RegExp(`(^|\\D)0*${ohneNullen(ean)}(\\D|$)`).test(p.text)) { q.ergebnis = "ean_falsch"; return q; }
    q.ean_beweis = "EAN auf der Codecheck-Seite";
    const roh = p.text.match(/id="ingredients_list">([\s\S]*?)(<span class="fs-8">|\*Aufgrund)/)?.[1] ?? "";
    const z = roh.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();
    q.zutaten_text = z ? ohneZutatenWort(z) : null;
    if (q.zutaten_text && !siehtDeutschAus(q.zutaten_text)) {
      q.befunde.push({ art: "nicht_deutsch", quelle: q.quelle, text: "Codecheck-Liste sieht nicht deutsch aus – nicht übernommen" });
      q.zutaten_text = null;
    }
    q.ergebnis = q.zutaten_text ? "treffer" : "leer";
    return q;
  } catch (e) {
    q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    return q;
  } finally {
    q.dauer_ms = Date.now() - t0;
  }
}

// ---------- Quelle: Open Food Facts (gemeinschaftlich, teils veraltet) ----------
async function quelleOff(ean: string): Promise<Quelle> {
  const t0 = Date.now();
  const q: Quelle = { quelle: "openfoodfacts", url: `https://world.openfoodfacts.org/product/${ean}`, ergebnis: "fehler", befunde: [], dauer_ms: 0 };
  try {
    const s = await holen(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=code,lang,product_name,product_name_de,brands,ingredients_text,ingredients_text_de,nutriments,nutrition_data_per`);
    q.http = s.status;
    if (s.status === 404) { q.ergebnis = "nicht_gefunden"; return q; }
    if (s.status === 403 || s.status === 429) { q.ergebnis = "gesperrt"; return q; }
    if (s.status !== 200) return q;
    const d = JSON.parse(s.text);
    if (d?.status !== 1) { q.ergebnis = "nicht_gefunden"; return q; }
    if (!gtinGleich(d?.code, ean)) { q.ergebnis = "ean_falsch"; return q; }
    q.ean_beweis = "code = EAN";
    const p = d.product ?? {};
    q.name = (p.product_name_de || p.product_name || "").trim() || null;
    q.marke = String(p.brands ?? "").split(",")[0].trim() || null;
    q.zutaten_text = String(p.ingredients_text_de ?? "").replace(/_/g, "").trim() || null;
    if (!q.zutaten_text) {
      const allg = String(p.ingredients_text ?? "").replace(/_/g, "").trim();
      if (allg && siehtDeutschAus(allg)) {
        q.zutaten_text = allg;
        q.befunde.push({ art: "off_sprachfeld", quelle: q.quelle, text: `Liste aus dem allgemeinen OFF-Feld (lang=${p.lang ?? "?"}), sieht deutsch aus` });
      } else if (allg) {
        q.befunde.push({ art: "nicht_deutsch", quelle: q.quelle, text: `OFF hat nur eine fremdsprachige Liste (lang=${p.lang ?? "?"}) – nicht übernommen` });
      }
    }
    const n = p.nutriments ?? {};
    if (p.nutrition_data_per === "serving") {
      q.befunde.push({ art: "portion", quelle: q.quelle, text: "OFF hat nur Portionswerte – nicht uebernommen" });
    } else {
      // v6.4: Bruehe zubereitet bewerten – OFF fuehrt die zubereitete Spalte als *_prepared_100g
      const zub = zubereitungsprodukt(q.name ?? "") && typeof n["energy-kcal_prepared_100g"] === "number" ? "_prepared_100g" : "_100g";
      if (zub !== "_100g") q.befunde.push({ art: "zubereitet", quelle: q.quelle, text: "Brühe: zubereitete Spalte von OFF genommen (BR-NW-WIE-VERKAUFT F2)" });
      q.naehrwerte = sauberNW({ kcal: n["energy-kcal" + zub], kj: n["energy-kj" + zub], fett: n["fat" + zub], ges_fett: n["saturated-fat" + zub],
        kh: n["carbohydrates" + zub], zucker: n["sugars" + zub], ballaststoffe: n["fiber" + zub], protein: n["proteins" + zub], salz: n["salt" + zub] });
      const kc = q.naehrwerte?.kcal, kj = q.naehrwerte?.kj;
      // Etiketten nennen kcal als ganze Zahl. Krumme kcal = kJ/4,184 → von OFF errechnet, nicht vom Etikett.
      if (typeof kc === "number" && typeof kj === "number" && !Number.isInteger(kc) && Math.abs(kc - kj / 4.184) < 0.6) {
        q.befunde.push({ art: "kcal_errechnet", quelle: q.quelle, text: `kcal ${kc} ist aus kJ ${kj} errechnet, nicht vom Etikett` });
      }
    }
    q.ergebnis = q.zutaten_text || nwKomplett(q.naehrwerte) ? "treffer" : "leer";
    return q;
  } catch (e) {
    q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    return q;
  } finally {
    q.dauer_ms = Date.now() - t0;
  }
}

// ---------- v6.9: Open Food Facts per Name (kostenlos, nur vorlaeufig) ----------
// Findet OFF den Barcode nicht, sucht Riki 2 dort nach Marke + Name. Uebernommen wird nur ein EINDEUTIGER
// Kandidat: gleiche Marke, alle Sortenwoerter des Scan-Namens im Namen, und alle passenden Eintraege mit derselben
// Zutatenliste. Ohne Barcode-Beweis -> landet als „web:"-Quelle ohne EAN, also immer „vorläufig".
async function quelleOffName(marke: string, name: string, ean: string): Promise<Quelle> {
  const t0 = Date.now();
  const such = `${marke} ${name}`.replace(/\s+/g, " ").trim();
  const q: Quelle = { quelle: "web:off-namenssuche", url: `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(such)}`, ergebnis: "fehler", befunde: [], dauer_ms: 0 };
  try {
    const s = await holen(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(such)}&search_simple=1&action=process&json=1&page_size=20&fields=code,lang,product_name,product_name_de,brands,quantity,ingredients_text,ingredients_text_de,nutriments,nutrition_data_per`);
    q.http = s.status;
    if (s.status === 429 || s.status === 503) { q.ergebnis = "ueberlast"; return q; }
    if (s.status === 403) { q.ergebnis = "gesperrt"; return q; }
    if (s.status !== 200) return q;
    const d = JSON.parse(s.text);
    const mk = marke.toLowerCase().split(/[\s,]+/)[0];
    const woerter = sortenWoerter(name);
    const passt = ((d?.products ?? []) as any[]).filter((p) => {
      if (gtinGleich(p.code, ean)) return false; // der Barcode selbst ist Sache von quelleOff
      if (!String(p.brands ?? "").toLowerCase().includes(mk)) return false;
      const pn = sortenWoerter(String(p.product_name_de || p.product_name || "")).join(" ");
      return woerter.length > 0 && woerter.every((w) => pn.includes(w.slice(0, Math.max(4, w.length - 2))));
    });
    if (!passt.length) { q.ergebnis = "nicht_gefunden"; return q; }
    const zt = (p: any) => {
      const de = String(p.ingredients_text_de ?? "").replace(/_/g, "").trim();
      const allg = String(p.ingredients_text ?? "").replace(/_/g, "").trim();
      return de || (allg && siehtDeutschAus(allg) ? allg : "");
    };
    const listen = new Set(passt.map((p) => zt(p).toLowerCase().replace(/[^a-zäöüß]/g, "")).filter(Boolean));
    if (listen.size > 1 || (passt.length > 1 && !listen.size)) {
      q.ergebnis = "mehrdeutig";
      q.befunde.push({ art: "off_name_mehrdeutig", quelle: q.quelle, text: `${passt.length} OFF-Einträge passen zu „${such}" – ohne Barcode nicht klar, welcher gescannt wurde` });
      return q;
    }
    const p = passt.find((x) => zt(x)) ?? passt[0];
    q.url = `https://world.openfoodfacts.org/product/${p.code}`;
    q.name = (p.product_name_de || p.product_name || "").trim() || null;
    q.marke = String(p.brands ?? "").split(",")[0].trim() || null;
    q.zutaten_text = zt(p) || null;
    const n = p.nutriments ?? {};
    if (p.nutrition_data_per !== "serving" && !zubereitungsprodukt(q.name ?? "")) {
      q.naehrwerte = sauberNW({ kcal: n["energy-kcal_100g"], kj: n["energy-kj_100g"], fett: n["fat_100g"], ges_fett: n["saturated-fat_100g"],
        kh: n["carbohydrates_100g"], zucker: n["sugars_100g"], ballaststoffe: n["fiber_100g"], protein: n["proteins_100g"], salz: n["salt_100g"] });
    }
    q.befunde.push({ art: "off_name_kandidat", quelle: q.quelle, text: `OFF-Eintrag ${p.code} „${q.name}" (${p.quantity ?? "?"}) passt nach Marke + Name, Barcode ≠ Scan ${ean}` });
    q.ergebnis = q.zutaten_text || nwKomplett(q.naehrwerte) ? "treffer" : "leer";
    return q;
  } catch (e) {
    q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    return q;
  } finally {
    q.dauer_ms = Date.now() - t0;
  }
}

// ---------- Fotolesung (alle Fotos gemeinsam) ----------
const ZAHL_ODER_NULL = { type: ["number", "null"] };
const LESE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ean_auf_foto", "name", "marke", "zutatenverzeichnis_sichtbar", "zutaten_lesbar", "zutaten_text", "naehrwert_basis", "tabelle_foto", "tabelle", "naehrwerte", "unsicher"],
  properties: {
    ean_auf_foto: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    marke: { type: ["string", "null"] },
    zutatenverzeichnis_sichtbar: { type: "string", enum: ["ja", "nein", "unklar"] },
    zutaten_lesbar: { type: "string", enum: ["voll", "teilweise", "nein"] },
    zutaten_text: { type: ["string", "null"] },
    naehrwert_basis: { type: "string", enum: ["100g", "100ml", "zubereitet", "nur_portion", "keine"] },
    // v7.1: Tabelle erst woertlich abschreiben – die Zuordnung zu Fett/Eiweiss/… macht der Code
    tabelle_foto: { type: ["integer", "null"] },
    tabelle: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["beschriftung", "werte"],
        properties: {
          beschriftung: { type: "string" },
          werte: { type: "array", items: { type: "object", additionalProperties: false, required: ["spalte", "wert"], properties: { spalte: { type: "string" }, wert: { type: "string" } } } },
        },
      },
    },
    naehrwerte: {
      type: "object",
      additionalProperties: false,
      required: ["kcal", "kj", "fett", "ges_fett", "kh", "zucker", "ballaststoffe", "protein", "salz"],
      properties: { kcal: ZAHL_ODER_NULL, kj: ZAHL_ODER_NULL, fett: ZAHL_ODER_NULL, ges_fett: ZAHL_ODER_NULL, kh: ZAHL_ODER_NULL,
        zucker: ZAHL_ODER_NULL, ballaststoffe: ZAHL_ODER_NULL, protein: ZAHL_ODER_NULL, salz: ZAHL_ODER_NULL },
    },
    unsicher: { type: "array", items: { type: "string" } },
  },
};

const LESE_AUFTRAG = `Du liest Fotos EINER Lebensmittelverpackung ab. Die Fotos gehören zusammen (Vorderseite, Rückseite, Seiten); setze die Angaben über alle Fotos zusammen.

Regeln:
- Schreibe nur ab, was auf den Fotos steht. Nichts ergänzen, nichts schätzen, nichts aus Erfahrung einsetzen. Was du nicht sicher lesen kannst, ist null und kommt mit dem Feldnamen in "unsicher".
- zutatenverzeichnis_sichtbar: "ja" nur, wenn auf einem Foto wirklich ein Zutatenverzeichnis zu sehen ist (meist mit "Zutaten:"). Ein Siegel, eine Werbeaussage oder eine Allergenzeile ist kein Zutatenverzeichnis.
- zutaten_text: die deutsche Zutatenliste wörtlich in Etikett-Reihenfolge, mit allen Klammern und %-Angaben, ohne das Wort "Zutaten:" am Anfang. Fremdsprachige Fassungen weglassen. Geht die Liste über zwei Fotos, füge sie in der richtigen Reihenfolge zusammen. Ist nur ein Teil lesbar: zutaten_lesbar "teilweise" und nur den lesbaren Anfang abschreiben.
- naehrwerte: die Spalte je 100 g bzw. je 100 ml für das Produkt WIE VERKAUFT. Ausnahme Brühe, Bouillon, Brühwürfel, gekörnte Brühe, Suppen- und Soßenpulver: dort die Spalte ZUBEREITET („pro 100 ml zubereitet"), naehrwert_basis "zubereitet" – auch wenn es zwei Spalten gibt. Nennt ein anderes Produkt nur zubereitete Werte, ebenfalls diese mit naehrwert_basis "zubereitet". Gibt es nur Portionsangaben, naehrwert_basis "nur_portion" und alle Werte null – niemals umrechnen. "<0,5 g" bzw. "Spuren" als 0 nur, wenn genau das dasteht; sonst null.
- tabelle: die Nährwerttabelle Zeile für Zeile WÖRTLICH abschreiben, ohne zu deuten oder umzurechnen. beschriftung genau wie gedruckt (z. B. "davon gesättigte Fettsäuren"), dazu jeder Wert der Zeile mit seiner Spaltenüberschrift wie gedruckt (z. B. spalte "pro 100 g", wert "8,0 g"; Brennwert z. B. wert "1500 kJ / 359 kcal"). Steht die Überschrift nur über der Tabelle (z. B. "Nährwerte je 100 g"), diese als spalte nehmen. Ist keine Tabelle zu sehen: leere Liste.
- tabelle_foto: die Nummer des Fotos (1 = erstes Foto), auf dem die Nährwerttabelle steht, sonst null.
- name: der Handelsname, wie er groß auf der Vorderseite steht, ohne Menge. marke: die Marke des Herstellers oder Händlers. Ein Bio-Siegel, "EU-Bio", "Bioland", "Demeter", "Fairtrade" ist keine Marke.
- ean_auf_foto: die Ziffern unter dem Strichcode, falls lesbar, sonst null.`;

async function fotoLesen(client: Anthropic, modell: string, fotos: string[]) {
  const bilder = fotos.slice(0, 6).map((f) => {
    const m = f.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
    return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : null;
  }).filter(Boolean);
  if (!bilder.length) return { lesung: null, fehler: "keine verwertbaren Fotos", kosten: 0, inT: 0, outT: 0, modell };
  const r: any = await client.beta.messages.create({
    model: modell,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: LESE_SCHEMA } },
    messages: [{ role: "user", content: [...bilder, { type: "text", text: LESE_AUFTRAG }] }],
  } as any);
  const benutzt = String(r?.model ?? modell);
  const [pe, pa] = PREIS[benutzt] ?? PREIS[modell] ?? [2, 10];
  const inT = Number(r?.usage?.input_tokens ?? 0), outT = Number(r?.usage?.output_tokens ?? 0);
  const kosten = Math.round(((inT * pe + outT * pa) / 1e6) * 1e6) / 1e6;
  if (r?.stop_reason === "refusal") return { lesung: null, fehler: "Modell hat abgelehnt", kosten, inT, outT, modell: benutzt };
  if (r?.stop_reason === "max_tokens") return { lesung: null, fehler: "Antwort abgeschnitten (max_tokens)", kosten, inT, outT, modell: benutzt };
  const text = (r?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  try {
    return { lesung: JSON.parse(text), fehler: null, kosten, inT, outT, modell: benutzt };
  } catch (_) {
    return { lesung: null, fehler: "Antwort war kein JSON", kosten, inT, outT, modell: benutzt };
  }
}

// ---------- v7.1: Naehrwerte aus der woertlich abgeschriebenen Tabelle (Zuordnung im Code, nicht im Modell) ----------
// Fehler wie „Eiweiß 2,4 statt 8,0" sind Zuordnungsfehler: der Wert ist richtig gelesen, aber der falschen Zeile gegeben.
type Zeile = { beschriftung: string; werte: { spalte: string; wert: string }[] };
const NW_FELDER = ["kcal", "kj", "fett", "ges_fett", "kh", "zucker", "ballaststoffe", "protein", "salz"] as const;
function zahlText(t: string): number | null {
  const s = t.toLowerCase();
  if (/spuren/.test(s)) return 0;
  if (/<\s*\d/.test(s)) return 0; // „<0,5 g" wie bisher als 0
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
}
function feldZurZeile(b: string): (typeof NW_FELDER)[number] | "energie" | null {
  const t = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (/brennwert|energie/.test(t)) return "energie";
  if (/^kj\b/.test(t)) return "kj";
  if (/^kcal\b/.test(t)) return "kcal";
  if (/ungesättigt|ungesaettigt|trans/.test(t)) return null;
  if (/gesättigt|gesaettigt/.test(t)) return "ges_fett";
  if (/zuckeralkohol|mehrwertig|stärke|staerke|polyol/.test(t)) return null;
  if (/zucker/.test(t)) return "zucker";
  if (/kohlenhydrat/.test(t)) return "kh";
  if (/ballaststoff/.test(t)) return "ballaststoffe";
  if (/eiweiß|eiweiss|protein/.test(t)) return "protein";
  if (/salz/.test(t)) return "salz";
  if (/^fett\b/.test(t)) return "fett";
  return null;
}
function nwAusTabelle(tabelle: Zeile[] | null | undefined, zubereitet: boolean): { nw: NW | null; spalte: string | null; befunde: Befund[] } {
  const befunde: Befund[] = [];
  if (!Array.isArray(tabelle) || !tabelle.length) return { nw: null, spalte: null, befunde };
  const spalten = [...new Set(tabelle.flatMap((z) => (z.werte ?? []).map((w) => String(w.spalte ?? "").trim())))];
  const je100 = (h: string) => /100\s*(g|ml)/i.test(h);
  const zub = (h: string) => /zubereit/i.test(h);
  let spalte = zubereitet ? spalten.find((h) => zub(h)) : spalten.find((h) => je100(h) && !zub(h));
  // eine einzige Spalte ohne Portionsangabe (Ueberschrift fehlt) zaehlt als je 100 g
  if (!spalte && spalten.length === 1 && !zub(spalten[0]) && !/portion|stück|stueck|riegel|scheibe|glas|becher|\d+\s*(g|ml)\b/i.test(spalten[0])) spalte = spalten[0];
  if (spalte === undefined) { befunde.push({ art: "tabelle_ohne_100g", quelle: "foto", text: `keine passende Spalte (Spalten: ${spalten.join(" | ").slice(0, 120)})` }); return { nw: null, spalte: null, befunde }; }
  const o: NW = {};
  for (const z of tabelle) {
    const w = (z.werte ?? []).find((x) => String(x.spalte ?? "").trim() === spalte);
    if (!w) continue;
    const text = String(w.wert ?? "");
    // Zeile ohne eigene Beschriftung mit kJ/kcal = zweite Zeile des Brennwerts („1500 kJ" / „359 kcal")
    const f = feldZurZeile(String(z.beschriftung ?? "")) ?? (!String(z.beschriftung ?? "").trim() && /\d\s*(kj|kcal)\b/i.test(text) ? "energie" : null);
    if (!f) continue;
    if (f === "energie" || f === "kj" || f === "kcal") {
      const kj = text.match(/(\d+(?:[.,]\d+)?)\s*kj/i), kc = text.match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
      const setz = (k: "kj" | "kcal", v: number) => { if (typeof o[k] !== "number") o[k] = v; };
      if (kj) setz("kj", Number(kj[1].replace(",", ".")));
      if (kc) setz("kcal", Number(kc[1].replace(",", ".")));
      if (!kj && !kc && f !== "energie") { const v = zahlText(text); if (v !== null) setz(f, v); }
      continue;
    }
    const v = zahlText(text);
    if (v === null) continue;
    if (typeof o[f] === "number") { if (o[f] !== v) befunde.push({ art: "tabelle_doppelt", quelle: "foto", text: `${f} steht zweimal (${o[f]} und ${v}) – erster Wert genommen` }); continue; }
    o[f] = v;
  }
  return { nw: sauberNW(o), spalte, befunde };
}
// Felder, in denen Code-Zuordnung und Modell-Lesung auseinanderliegen
function nwUnterschiede(a: NW, b: NW): string[] {
  return NW_FELDER.filter((f) => typeof a[f] === "number" && typeof b[f] === "number" && Math.abs(a[f]! - b[f]!) > Math.max(0.05, 0.02 * Math.abs(a[f]!)));
}
// v7.1: Gezielte Nachlesung nur der Naehrwerttabelle – mit ANDERER Frage (je Wert die Nachbarzeilen), damit sie
// nicht dieselben Fehler wiederholt. Nur bei Verdacht (Rechenprobe oder Widerspruch Code/Modell).
const NACHLESE_FELD = { type: "object", additionalProperties: false, required: ["wert", "zeile_darueber", "zeile_darunter"],
  properties: { wert: { type: ["string", "null"] }, zeile_darueber: { type: ["string", "null"] }, zeile_darunter: { type: ["string", "null"] } } };
const NACHLESE_SCHEMA = { type: "object", additionalProperties: false, required: ["spalte", ...NW_FELDER],
  properties: { spalte: { type: ["string", "null"] }, ...Object.fromEntries(NW_FELDER.map((f) => [f, NACHLESE_FELD])) } };
const NACHLESE_WORT: Record<string, string> = { kcal: "Brennwert in kcal", kj: "Brennwert in kJ", fett: "Fett", ges_fett: "davon gesättigte Fettsäuren",
  kh: "Kohlenhydrate", zucker: "davon Zucker", ballaststoffe: "Ballaststoffe", protein: "Eiweiß", salz: "Salz" };
function nachleseAuftrag(zubereitet: boolean) {
  return `Schau NUR auf die Nährwerttabelle. Nimm die Spalte ${zubereitet ? "für das ZUBEREITETE Produkt (je 100 ml zubereitet)" : "je 100 g bzw. je 100 ml (nicht je Portion, nicht zubereitet)"} und nenne in "spalte" ihre Überschrift wörtlich.
Gehe die Zeilen einzeln durch. Für jeden der folgenden Werte: suche zuerst die Zeile mit genau dieser Beschriftung, dann schreibe die Zahl in DIESER Zeile und DIESER Spalte wörtlich ab (mit Einheit, z. B. "8,0 g"), und nenne die Beschriftung der Zeile direkt darüber und direkt darunter.
${NW_FELDER.map((f) => `- ${f}: ${NACHLESE_WORT[f]}`).join("\n")}
Gibt es die Zeile nicht oder ist die Zahl nicht sicher lesbar: wert null. Nichts schätzen, nichts umrechnen.`;
}
function nachleseWerte(d: any): NW | null {
  const o: NW = {};
  for (const f of NW_FELDER) {
    const t = String(d?.[f]?.wert ?? "");
    if (!t) continue;
    if (f === "kj" || f === "kcal") {
      const m = t.match(f === "kj" ? /(\d+(?:[.,]\d+)?)\s*kj/i : /(\d+(?:[.,]\d+)?)\s*kcal/i);
      const v = m ? Number(m[1].replace(",", ".")) : zahlText(t);
      if (v !== null) o[f] = v;
      continue;
    }
    const v = zahlText(t);
    if (v !== null) o[f] = v;
  }
  return sauberNW(o);
}
async function tabelleNachlesen(client: Anthropic, modell: string, fotos: string[], zubereitet: boolean) {
  const bilder = fotos.map((f) => {
    const m = f.match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
    return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : null;
  }).filter(Boolean);
  const r: any = await client.beta.messages.create({
    model: modell,
    max_tokens: 3000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: { type: "json_schema", schema: NACHLESE_SCHEMA } },
    messages: [{ role: "user", content: [...bilder, { type: "text", text: nachleseAuftrag(zubereitet) }] }],
  } as any);
  const benutzt = String(r?.model ?? modell);
  const [pe, pa] = PREIS[benutzt] ?? PREIS[modell] ?? [2, 10];
  const inT = Number(r?.usage?.input_tokens ?? 0), outT = Number(r?.usage?.output_tokens ?? 0);
  const kosten = Math.round(((inT * pe + outT * pa) / 1e6) * 1e6) / 1e6;
  if (r?.stop_reason !== "end_turn") return { nw: null as NW | null, kosten, inT, outT, spalte: null as string | null };
  try {
    const d = JSON.parse((r?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(""));
    return { nw: nachleseWerte(d), kosten, inT, outT, spalte: d?.spalte ?? null };
  } catch (_) {
    return { nw: null as NW | null, kosten, inT, outT, spalte: null as string | null };
  }
}

// ---------- Herstellerweg: Websuche + Seite lesen (bezahlt, nur bei Luecke) ----------
const SUCH_MODELL = "claude-haiku-5-5";
const HAIKU_PREIS: [number, number] = [0.1, 0.5]; // je 1 Mio Tokens (bis 100K Prompt)
const SUCHE_PREIS = 0.01; // je Websuche
// Server-Abruf gesperrt (403/Captcha, gemessen 31.10.) – gar nicht erst suchen. Portale haben wir schon direkt.
const NICHT_SUCHEN = ["rewe.de", "kaufland.de", "netto-online.de", "openfoodfacts.org", "fddb.info", "codecheck.info", "dm.de", "dm.at"];
const SEITEN_UA = "Mozilla/5.0 (compatible; RootIndex/1.0; +https://root-index.de)";

const SUCH_AUFTRAG = (marke: string, name: string, ean: string) => `Finde Produktseiten zu GENAU diesem Lebensmittel, auf denen die Zutatenliste und/oder die Nährwerttabelle je 100 g stehen.
Marke: ${marke}
Produktname: ${name}
EAN: ${ean}

Reihenfolge: 1. offizielle Seite des Herstellers (Domain kann einen Zusatz tragen), 2. deutscher Online-Händler mit Produktseite.
Bevorzuge die deutsche Fassung der Seite (deutsche Domain oder /de/). Gibt es nur eine fremdsprachige Fassung, nenne sie trotzdem.
Die Seite muss dieses eine Produkt zeigen (Marke passt, Name oder Sorte passt). Keine Kategorie-, Such- oder Startseiten, keine Preisvergleiche, Blogs, Rezepte.
Suche zuerst mit der EAN, dann mit Marke und Name. Höchstens 2 Suchen. Nichts erfinden.
Antworte zuletzt nur mit JSON: {"kandidaten":[{"url":"...","art":"hersteller"|"haendler"}]} – höchstens 3, beste zuerst, leer wenn nichts passt.`;

async function websuche(client: Anthropic, marke: string, name: string, ean: string) {
  const r: any = await client.messages.create({
    model: SUCH_MODELL,
    max_tokens: 2000,
    output_config: { effort: "low" },
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2, blocked_domains: NICHT_SUCHEN, user_location: { type: "approximate", country: "DE" } }],
    messages: [{ role: "user", content: SUCH_AUFTRAG(marke, name, ean) }],
  } as any);
  const inT = Number(r?.usage?.input_tokens ?? 0) + Number(r?.usage?.cache_read_input_tokens ?? 0) + Number(r?.usage?.cache_creation_input_tokens ?? 0);
  const outT = Number(r?.usage?.output_tokens ?? 0);
  const suchen = Number(r?.usage?.server_tool_use?.web_search_requests ?? 0);
  const kosten = (inT * HAIKU_PREIS[0] + outT * HAIKU_PREIS[1]) / 1e6 + suchen * SUCHE_PREIS;
  const text = (r?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  let kandidaten: { url: string; art: string }[] = [];
  try {
    const m = text.match(/\{[\s\S]*\}/);
    kandidaten = (JSON.parse(m ? m[0] : text)?.kandidaten ?? []).filter((k: any) => typeof k?.url === "string" && /^https?:\/\//.test(k.url));
  } catch (_) { /* keine Kandidaten */ }
  kandidaten = kandidaten.filter((k) => { try { const h = new URL(k.url).host; return !NICHT_SUCHEN.some((d) => h === d || h.endsWith("." + d)); } catch { return false; } });
  return { kandidaten: kandidaten.slice(0, 3), kosten, inT, outT, suchen, antwort: text.slice(0, 600), stop: String(r?.stop_reason ?? ""), modell: String(r?.model ?? SUCH_MODELL) };
}

async function holeSeite(url: string, accept = "text/html"): Promise<{ status: number; text: string }> {
  const c = new AbortController();
  const uhr = setTimeout(() => c.abort(), QUELLE_TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { "User-Agent": SEITEN_UA, "Accept": accept, "Accept-Language": "de-DE,de;q=0.9" }, signal: c.signal, redirect: "follow" });
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(uhr);
  }
}

// Barcode auf der Seite: Shopify-Varianten, JSON-LD gtin*, oder Ziffern direkt hinter EAN/GTIN/Barcode.
function eansAusHtml(html: string): { eans: string[]; weg: string | null } {
  const raus = new Set<string>();
  let weg: string | null = null;
  for (const m of html.matchAll(/"gtin(?:8|12|13|14)?"\s*:\s*"?(\d{8,14})/gi)) if (gtinGueltig(m[1])) { raus.add(m[1]); weg = weg ?? "json_ld_gtin"; }
  for (const m of html.matchAll(/(EAN|GTIN|Barcode|Strichcode)[^0-9]{0,80}?(\d{13}|\d{8})\b/gi)) if (gtinGueltig(m[2])) { raus.add(m[2]); weg = weg ?? "text_" + m[1].toLowerCase(); }
  return { eans: [...raus], weg };
}
function seitenText(html: string): string {
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim()).join("\n").slice(0, 6000);
  const t = html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<td[^>]*>/gi, " | ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return (ld ? "STRUKTURIERTE DATEN (JSON-LD):\n" + ld + "\n\nSEITENTEXT:\n" : "") + t;
}
function unterseiten(html: string, basis: string): string[] {
  const host = new URL(basis).host;
  const raus: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href="([^"#]+)"[^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    if (!/zutaten|nährwert|naehrwert|inhaltsstoffe|ingredients/i.test(m[2].replace(/<[^>]+>/g, ""))) continue;
    try { const u = new URL(m[1], basis); if (u.host === host && !raus.includes(u.toString()) && u.toString() !== basis) raus.push(u.toString()); } catch { /* weiter */ }
    if (raus.length >= 2) break;
  }
  return raus;
}

// v6.5: Sprache der Seite und deutsche Fassung laut hreflang
function seitenSprache(html: string): string | null {
  const m = html.match(/<html[^>]*\blang="([a-z]{2})/i);
  return m ? m[1].toLowerCase() : null;
}
function deutscheFassung(html: string, basis: string): string | null {
  const alt: Record<string, string> = {};
  for (const m of html.matchAll(/<link[^>]+>/gi)) {
    const tag = m[0];
    if (!/rel="alternate"/i.test(tag)) continue;
    const hl = tag.match(/hreflang="([^"]+)"/i)?.[1]?.toLowerCase(), href = tag.match(/href="([^"]+)"/i)?.[1];
    if (hl && href && hl.startsWith("de")) { try { alt[hl] = new URL(href.replace(/&amp;/g, "&"), basis).toString(); } catch { /* weiter */ } }
  }
  const wahl = alt["de-de"] ?? alt["de"] ?? alt["de-at"] ?? alt["de-ch"] ?? Object.values(alt)[0] ?? null;
  return wahl && wahl !== basis ? wahl : null;
}
const wirktDeutsch = (url: string) => { try { const u = new URL(url); return /\.(de|at|ch)$/.test(u.host) && !/^\/(en|fr|it|es|nl)(-[a-z]{2})?\//i.test(u.pathname) || /^\/de(-[a-z]{2})?\//i.test(u.pathname); } catch { return false; } };
// v6.5: Woerter fuer den Sortenvergleich (klein, ohne Umlaute, ab 4 Zeichen, ohne Fuellwoerter)
function sortenWoerter(t: string): string[] {
  const f = t.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  return [...new Set(f.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(sorte|geschmack|style|classic|original|natur|\d+)$/.test(w)))];
}
function sortePasst(sorte: string, name: string): boolean {
  const n = sortenWoerter(name).join(" ");
  const s = sortenWoerter(sorte);
  return !s.length || s.some((w) => n.includes(w) || n.includes(w.slice(0, Math.max(4, w.length - 2))));
}
// v6.5: Mehrere Kandidaten auf demselben Shop mit gleicher Namenswurzel = Sortenfamilie
function geschwisterHosts(urls: string[]): Set<string> {
  const je: Record<string, string[]> = {};
  for (const u of urls) { try { const x = new URL(u); (je[x.host] ??= []).push(x.pathname.replace(/\/$/, "")); } catch { /* weiter */ } }
  const raus = new Set<string>();
  const kopf = (p: string) => (p.split("/").pop() ?? "").split(/[-_]/).slice(0, 3).join("-");
  for (const [h, pf] of Object.entries(je)) {
    const eind = [...new Set(pf)];
    if (eind.some((a, i) => eind.some((b, j) => i !== j && kopf(a) === kopf(b)))) raus.add(h);
  }
  return raus;
}

const SEITEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["produkt_passt", "sorte_seite", "zutaten_text", "naehrwert_basis", "naehrwerte"],
  properties: {
    produkt_passt: { type: "string", enum: ["ja", "nein", "unklar"] },
    sorte_seite: { type: ["string", "null"] },
    zutaten_text: { type: ["string", "null"] },
    naehrwert_basis: { type: "string", enum: ["100g", "100ml", "zubereitet", "nur_portion", "keine"] },
    naehrwerte: LESE_SCHEMA.properties.naehrwerte,
  },
};
const SEITEN_AUFTRAG = (marke: string, name: string, text: string, belegt: boolean) => `Unten steht der Text einer Produktseite. Gesucht: Angaben zu GENAU diesem Produkt – Marke „${marke}", Produkt „${name}".
${belegt ? '- produkt_passt: Die Seite ist über den Barcode als dieses Produkt belegt → "ja". Nur wenn die Seite mehrere Produkte zeigt und die Angaben keinem zuzuordnen sind: "unklar".' : '- produkt_passt: "ja" nur, wenn die Seite dieses Produkt zeigt (Marke und Name/Sorte passen; Handelsnamen dürfen etwas abweichen). Andere Sorte oder Kategorie-Seite = "nein".'}
- sorte_seite: die VOLLSTÄNDIGE Sortenbezeichnung, die die Seite für IHR Produkt nennt – alles, was diese Variante von anderen derselben Produktlinie unterscheidet (z. B. „Erdbeere", „Spicy Sticks Chicken Style"), wörtlich; null, wenn keine genannt.
- zutaten_text: die deutsche Zutatenliste wörtlich, ohne „Zutaten:" am Anfang; sonst null.
- naehrwerte: die Spalte je 100 g bzw. 100 ml WIE VERKAUFT. Bei Brühe, Bouillon, Brühwürfel, gekörnter Brühe, Suppen- und Soßenpulver die Spalte ZUBEREITET → naehrwert_basis "zubereitet" (auch wenn beide Spalten da sind); nennt ein anderes Produkt nur zubereitete Werte, diese mit "zubereitet". Nur Portion → "nur_portion", Werte null. kcal als kcal, kJ als kJ.
- Nichts ergänzen, nichts schätzen. Was nicht dasteht, ist null.

${text.slice(0, 24000)}`;

async function seiteAuswerten(client: Anthropic, marke: string, name: string, text: string, belegt: boolean) {
  const r: any = await client.messages.create({
    model: SUCH_MODELL,
    max_tokens: 6000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SEITEN_SCHEMA } },
    messages: [{ role: "user", content: SEITEN_AUFTRAG(marke, name, text, belegt) }],
  } as any);
  const inT = Number(r?.usage?.input_tokens ?? 0), outT = Number(r?.usage?.output_tokens ?? 0);
  const kosten = (inT * HAIKU_PREIS[0] + outT * HAIKU_PREIS[1]) / 1e6;
  const t = (r?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  let lesung: any = null;
  try { lesung = JSON.parse(t); } catch (_) { /* null */ }
  return { lesung, kosten, inT, outT };
}

async function herstellerweg(client: Anthropic, marke: string, name: string, ean: string) {
  const quellen: Quelle[] = [];
  let kosten = 0, inT = 0, outT = 0;
  const s = await websuche(client, marke, name, ean);
  kosten += s.kosten; inT += s.inT; outT += s.outT;
  const geschwister = geschwisterHosts(s.kandidaten.map((k) => k.url));
  const gelesen = new Set<string>();
  const reihe = [...s.kandidaten].sort((a, b) => Number(wirktDeutsch(b.url)) - Number(wirktDeutsch(a.url)));
  for (const k of reihe.slice(0, 2)) {
    const t0 = Date.now();
    let host = ""; try { host = new URL(k.url).host.replace(/^www\./, ""); } catch { continue; }
    const q: Quelle = { quelle: "web:" + host, url: k.url, ergebnis: "fehler", befunde: [], dauer_ms: 0 };
    quellen.push(q);
    try {
      let eans: string[] = [], weg: string | null = null;
      const sh = k.url.match(/^(https?:\/\/[^/]+)(?:\/[a-z]{2})?\/products\/([^/?#]+)/i);
      if (sh) {
        try {
          const j = await holeSeite(`${sh[1]}/products/${sh[2]}.json`, "application/json");
          if (j.status === 200) {
            const codes = (JSON.parse(j.text)?.product?.variants ?? []).map((v: any) => String(v?.barcode ?? "")).filter(gtinGueltig);
            if (codes.length) { eans = codes; weg = "shopify_json"; }
          }
        } catch (_) { /* weiter mit HTML */ }
      }
      let h = await holeSeite(k.url);
      q.http = h.status;
      // v6.5: fremdsprachige Seite -> deutsche Fassung laut hreflang
      const spr = h.status === 200 ? seitenSprache(h.text) : null;
      const de = spr && spr !== "de" ? deutscheFassung(h.text, k.url) : null;
      if (de) {
        const h2 = await holeSeite(de);
        if (h2.status === 200) {
          q.befunde.push({ art: "deutsche_seite", quelle: q.quelle, text: `Seite war „${spr}" – deutsche Fassung gelesen: ${de}` });
          h = h2; q.url = de; q.http = 200;
          try { q.quelle = "web:" + new URL(de).host.replace(/^www\./, ""); } catch { /* bleibt */ }
        }
      }
      if (gelesen.has(q.url ?? k.url)) { q.ergebnis = "doppelt"; continue; }
      gelesen.add(q.url ?? k.url);
      if (h.status === 403 || h.status === 429 || h.status === 503) { q.ergebnis = "gesperrt"; continue; }
      if (h.status !== 200) continue;
      const ea = eansAusHtml(h.text);
      if (!eans.length) { eans = ea.eans; weg = ea.weg; }
      if (eans.length && !eans.some((e) => gtinGleich(e, ean))) {
        // Seite nennt nur andere Barcodes: andere Groesse/Sorte
        q.ergebnis = "ean_falsch"; q.befunde.push({ art: "ean_falsch", quelle: q.quelle, text: `Seite nennt ${eans.slice(0, 3).join(", ")}` }); continue;
      }
      if (eans.some((e) => gtinGleich(e, ean))) q.ean_beweis = `EAN auf der Seite (${weg})`;
      let text = seitenText(h.text);
      for (const u of unterseiten(h.text, k.url)) {
        try { const us = await holeSeite(u); if (us.status === 200) text += `\n\nUNTERSEITE ${u}:\n` + seitenText(us.text).slice(0, 8000); } catch (_) { /* weiter */ }
      }
      if (text.length < 400) { q.ergebnis = "leer"; q.befunde.push({ art: "leere_huelle", quelle: q.quelle, text: "Seite lädt Inhalte erst im Browser (JavaScript)" }); continue; }
      const a = await seiteAuswerten(client, marke, name, text, !!q.ean_beweis);
      kosten += a.kosten; inT += a.inT; outT += a.outT;
      const l = a.lesung;
      if (!l || l.produkt_passt !== "ja") { q.ergebnis = "leer"; q.befunde.push({ art: "anderes_produkt", quelle: q.quelle, text: `Produkt passt: ${l?.produkt_passt ?? "?"}` }); continue; }
      // v6.5: ohne Barcode-Beweis keine fremde Sorte
      if (!q.ean_beweis && l.sorte_seite && !sortePasst(String(l.sorte_seite), name)) {
        // v7.0: Nennt der Scan-Name nur die Marke (Elisabethen Quelle -> „Elisabethen"), ist die Sorte unbekannt, nicht anders
        const mw = sortenWoerter(marke);
        const eigene = sortenWoerter(name).filter((w) => !mw.some((m) => m.startsWith(w) || w.startsWith(m)));
        q.ergebnis = "leer";
        q.befunde.push(eigene.length
          ? { art: "anderes_produkt", quelle: q.quelle, text: `andere Sorte: Seite „${l.sorte_seite}", Scan „${name}"` }
          : { art: "sorte_unbekannt", quelle: q.quelle, text: `Seite nennt Sorte „${l.sorte_seite}", der Scan-Name „${name}" nennt keine – ohne Barcode nicht übernommen, Etikett nötig` });
        continue;
      }
      if (!q.ean_beweis && geschwister.has(new URL(k.url).host)) {
        q.ergebnis = "leer"; q.befunde.push({ art: "anderes_produkt", quelle: q.quelle, text: "mehrere Sorten derselben Linie gefunden, keine per Barcode belegt" }); continue;
      }
      if (l.zutaten_text) q.zutaten_text = ohneZutatenWort(String(l.zutaten_text));
      if (l.naehrwert_basis === "100g" || l.naehrwert_basis === "100ml") q.naehrwerte = sauberNW(l.naehrwerte);
      else if (l.naehrwert_basis === "zubereitet" && zubereitungsprodukt(name)) { q.naehrwerte = sauberNW(l.naehrwerte); q.befunde.push({ art: "zubereitet", quelle: q.quelle, text: "Brühe: zubereitete Werte der Seite (BR-NW-WIE-VERKAUFT F2)" }); }
      else if (l.naehrwert_basis === "zubereitet") q.befunde.push({ art: "nur_zubereitet", quelle: q.quelle, text: "Seite nennt nur zubereitete Werte – kein Zubereitungsprodukt, nicht übernommen" });
      q.ergebnis = q.zutaten_text || nwKomplett(q.naehrwerte) ? "treffer" : "leer";
      if (q.ergebnis === "treffer" && q.ean_beweis) break; // bewiesener Treffer reicht
    } catch (e) {
      q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    } finally {
      q.dauer_ms = Date.now() - t0;
    }
  }
  // v6.1: jede Suche protokollieren (was gesucht, wie oft, welche Adressen, Antwort im Wortlaut)
  quellen.unshift({ quelle: "websuche", ergebnis: s.kandidaten.length ? "treffer" : "nicht_gefunden", url: s.kandidaten.map((k) => k.url).join(" ") || null,
    befunde: [{ art: "suche", quelle: "websuche", text: `${s.modell}, ${s.suchen} Suche(n), stop=${s.stop}, „${marke} ${name}" – Antwort: ${s.antwort}` }], dauer_ms: 0 });
  return { quellen, kosten, inT, outT, suchen: s.suchen };
}

// ---------- Zusammenfuehren (fest, ohne Modell) ----------
function ersteN(text: string, n: number): string[] {
  const teile: string[] = [];
  let tiefe = 0, akt = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") tiefe++;
    if (ch === ")" || ch === "]") tiefe = Math.max(0, tiefe - 1);
    if (ch === "," && tiefe === 0) { teile.push(akt); akt = ""; } else akt += ch;
    if (teile.length >= n) break;
  }
  if (teile.length < n && akt) teile.push(akt);
  return teile.map((t) => t.replace(/\(.*$/s, "").replace(/[\d,.%*]+/g, "").trim().toLowerCase()).filter(Boolean).slice(0, n);
}
function abstand(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let vor = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, vor + (a[i - 1] === b[j - 1] ? 0 : 1));
      vor = t;
    }
  }
  return d[b.length];
}
const gleicheZutat = (a: string, b: string) => a === b || abstand(a, b) <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 6));
// Zwei vollstaendige Listen: von den ersten 3 Zutaten mindestens 2 an gleicher Stelle (wie nachlesen_etikett_abgleich).
function zutatenPassen(a: string, b: string): boolean {
  const x = ersteN(a, 3), y = ersteN(b, 3);
  if (x.length < 2 || y.length < 2) return true; // nicht pruefbar
  let gleich = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (gleicheZutat(x[i], y[i])) gleich++;
  return gleich >= 2;
}
// Teilweise lesbares Foto gegen Fremdquelle: bis 6 Zutaten (die letzte lesbare kann abgeschnitten sein), >= 80 % gleich.
function passtZumFoto(teil: string, kandidat: string): boolean {
  const x = ersteN(teil, 7), y = ersteN(kandidat, 7);
  const vergleich = x.length > 3 ? x.slice(0, -1).slice(0, 6) : x;
  if (vergleich.length < 3) return zutatenPassen(teil, kandidat);
  let gleich = 0;
  vergleich.forEach((z, i) => { if (y[i] && gleicheZutat(z, y[i])) gleich++; });
  return gleich / vergleich.length >= 0.8;
}

function zusammenfuehren(ean: string, quellen: Quelle[], foto: Quelle | null) {
  const befunde: Befund[] = [];
  const fehlt: string[] = [];
  const nach = (n: string) => quellen.find((q) => q.quelle === n && q.ean_beweis);
  const dm = nach("dm"), edeka = nach("edeka-lmiv"), off = nach("openfoodfacts"), cc = nach("codecheck");
  const web = quellen.filter((q) => q.quelle.startsWith("web:") && q.ergebnis === "treffer");
  const webMitEan = web.filter((q) => q.ean_beweis), webOhneEan = web.filter((q) => !q.ean_beweis);
  const fotoOk = foto && foto.ergebnis === "treffer" ? foto : null;

  // Name/Marke: Haendler und OFF mit Barcode-Beweis vor dem Foto (Ralph 23.09.)
  const name = off?.name ?? dm?.name ?? edeka?.name ?? fotoOk?.name ?? null;
  const marke = dm?.marke ?? off?.marke ?? fotoOk?.marke ?? null;
  const name_quelle = off?.name ? "openfoodfacts" : dm?.name ? "dm" : edeka?.name ? "edeka-lmiv" : fotoOk?.name ? "foto" : null;
  if (marke && fotoOk?.marke && !marke.toLowerCase().includes(fotoOk.marke.toLowerCase()) && !fotoOk.marke.toLowerCase().includes(marke.toLowerCase())) {
    befunde.push({ art: "marke_widerspruch", text: `Foto sagt „${fotoOk.marke}", Quelle sagt „${marke}"` });
  }

  // Zutaten: volles Etikettfoto > EDEKA > dm > OFF (OFF nur mit Abgleich, sonst Befund)
  const fotoVoll = fotoOk && (fotoOk as any)._lesbar === "voll" ? fotoOk : null;
  const fotoTeil = fotoOk && (fotoOk as any)._lesbar === "teilweise" ? fotoOk : null;
  const zKand = ([fotoVoll, edeka, dm, ...webMitEan, off, cc, ...webOhneEan].filter((q) => q?.zutaten_text) as Quelle[]).filter((q) => {
    const grund = zutatenUnbrauchbar(q.zutaten_text!, name ?? "");
    if (!grund) return true;
    befunde.push({ art: "zutaten_unbrauchbar", quelle: q.quelle, text: grund });
    return false;
  });
  let zutaten_text: string | null = null, zutaten_quelle: string | null = null;
  const andereRezeptur = new Set<string>();
  for (const k of zKand) {
    if (fotoTeil?.zutaten_text && !passtZumFoto(fotoTeil.zutaten_text, k.zutaten_text!)) {
      befunde.push({ art: "zutaten_passen_nicht_zum_foto", quelle: k.quelle, text: "Anfang der Liste weicht vom lesbaren Teil des Fotos ab" });
      andereRezeptur.add(k.quelle);
      continue;
    }
    zutaten_text = k.zutaten_text!; zutaten_quelle = k.quelle; break;
  }
  if (zutaten_quelle === "openfoodfacts" && !fotoTeil) befunde.push({ art: "off_ungeprueft", quelle: "openfoodfacts", text: "Zutaten nur von OFF, ohne zweite Quelle geprüft" });
  for (const k of zKand) {
    if (zutaten_text && k.zutaten_text !== zutaten_text && !passtZumFoto(zutaten_text, k.zutaten_text!)) {
      befunde.push({ art: "zutaten_widerspruch", quelle: k.quelle, text: `${k.quelle} hat eine andere Liste als ${zutaten_quelle} (andere Rezeptur?)` });
      if (zutaten_quelle === "foto") andereRezeptur.add(k.quelle);
    }
  }
  const zutaten_teil = !zutaten_text && fotoTeil?.zutaten_text ? fotoTeil.zutaten_text : null;
  if (!zutaten_text) fehlt.push(zutaten_teil ? "zutaten_unvollstaendig" : "zutaten");

  // Naehrwerte: Foto (je 100 g) > EDEKA > dm > OFF; nur wer die Pruefungen besteht
  const nKand = ([fotoOk, edeka, dm, ...webMitEan, off, ...webOhneEan].filter((q) => nwKomplett(q?.naehrwerte)) as Quelle[]).filter((q) => {
    if (!andereRezeptur.has(q.quelle)) return true;
    befunde.push({ art: "naehrwerte_andere_rezeptur", quelle: q.quelle, text: `Nährwerte von ${q.quelle} nicht übernommen – Zutaten passen nicht zum Foto dieses Scans` });
    return false;
  });
  let naehrwerte: NW | null = null, naehrwerte_quelle: string | null = null;
  const gut: Quelle[] = [];
  for (const k of nKand) {
    const pb = pruefeNaehrwerte(k.naehrwerte!, name ?? "", k.quelle);
    befunde.push(...pb);
    if (pb.some((x) => x.sperrt)) continue;
    gut.push(k);
  }
  // v7.0: unter den Quellen mit Barcode-Beweis die mit Salz, Zucker und ges. Fett vorziehen (Milsani Skyr: OFF ohne Salz)
  const voll = gut.find((k) => !webOhneEan.includes(k) && NW_PFLICHT.every((f) => typeof k.naehrwerte![f] === "number"));
  const wahl = voll ?? gut[0];
  if (wahl) { naehrwerte = wahl.naehrwerte!; naehrwerte_quelle = wahl.quelle; }
  if (naehrwerte) {
    for (const k of nKand) {
      if (k.quelle === naehrwerte_quelle) continue;
      const a = naehrwerte.kcal!, b = k.naehrwerte!.kcal!;
      if (Math.abs(a - b) > Math.max(10, 0.1 * a)) befunde.push({ art: "kcal_widerspruch", quelle: k.quelle, text: `${naehrwerte_quelle} ${a} kcal, ${k.quelle} ${b} kcal` });
      for (const f of ["salz", "fett", "zucker"] as const) {
        const x = naehrwerte[f], y = k.naehrwerte![f];
        if (x === 0 && typeof y === "number" && y >= 0.2) {
          befunde.push({ art: "null_widerspruch", quelle: k.quelle, text: `${f}: ${naehrwerte_quelle} sagt 0, ${k.quelle} sagt ${y}`, sperrt: true });
          fehlt.push(`${f}_ungeklaert`);
        }
      }
    }
    // v7.0: Salz, Zucker, ges. Fett gehoeren zur Bewertung – fehlen sie, ist die Tabelle nicht vollstaendig
    const ohne = NW_PFLICHT.filter((f) => typeof naehrwerte![f] !== "number");
    if (ohne.length) {
      fehlt.push("naehrwerte_teilweise");
      befunde.push({ art: "naehrwerte_teilweise", quelle: naehrwerte_quelle ?? undefined, text: `Es fehlen ${ohne.map((f) => NW_WORT[f]).join(", ")} – Etikett nötig` });
    }
    // v7.0: Werte mit vielen Nachkommastellen stehen so auf keinem Etikett – aus Portionswerten umgerechnet (Côte d'Or 5410081201008)
    const krumm = (Object.keys(naehrwerte) as (keyof NW)[]).filter((f) => { const v = naehrwerte![f]; return typeof v === "number" && /\.\d{4,}/.test(String(v)); });
    if (krumm.length >= 2) {
      befunde.push({ art: "nw_umgerechnet", quelle: naehrwerte_quelle ?? undefined, text: `Nährwerte von ${naehrwerte_quelle} sind umgerechnet (z. B. ${krumm[0]} ${naehrwerte[krumm[0]]}), nicht vom Etikett – vorläufig` });
    }
  } else {
    fehlt.push("naehrwerte");
  }
  // v6.9: Salz 0 bei Milchprodukten ist fast nie echt (Milch hat von Natur aus ~0,1 g) -> offen statt uebernehmen
  if (naehrwerte && naehrwerte.salz === 0 && milchprodukt(name ?? "", zutaten_text, naehrwerte)) {
    const anders = nKand.find((k) => k.quelle !== naehrwerte_quelle && typeof k.naehrwerte?.salz === "number" && k.naehrwerte.salz > 0);
    befunde.push({ art: "salz_null_unplausibel", quelle: naehrwerte_quelle ?? undefined, text: `Salz 0 bei einem Milchprodukt – Milch hat von Natur aus etwa 0,1 g${anders ? ` (${anders.quelle}: ${anders.naehrwerte!.salz} g)` : ""}; Etikett nötig` });
    fehlt.push("salz_ungeklaert");
  }
  // v6.8: reine Milch ohne Zutatenliste -> „Milch" (Ralph 01.11.: „Ja, so eintragen"); nie gegen ein lesbares Teilfoto
  if (!zutaten_text && !zutaten_teil && name && reineMilch(name, naehrwerte)) {
    zutaten_text = "Milch"; zutaten_quelle = "regel:einzutat";
    fehlt.splice(fehlt.indexOf("zutaten"), 1);
    befunde.push({ art: "einzutat", text: `„${name}" ist reine Milch – keine Zutatenliste nötig (LMIV Art. 19), Zutat „Milch"` });
  }
  // v7.0: Wasser und Honig genauso – nur die Zutat, Naehrwerte werden nie dazuerfunden
  const ez = !zutaten_text && !zutaten_teil && name ? (einzutatWasser(name, naehrwerte) ?? einzutatHonig(name, naehrwerte, marke)) : null;
  if (ez) {
    zutaten_text = ez; zutaten_quelle = "regel:einzutat";
    fehlt.splice(fehlt.indexOf("zutaten"), 1);
    befunde.push({ art: "einzutat", text: `„${name}" besteht aus einer Zutat – keine Zutatenliste nötig (LMIV Art. 19), Zutat „${ez}"` });
  }
  if (!name) fehlt.push("name");
  if (!marke) fehlt.push("marke");
  if (naehrwerte_quelle === "openfoodfacts" && quellen.find((q) => q.quelle === "openfoodfacts")?.befunde.some((b) => b.art === "kcal_errechnet")) {
    befunde.push({ art: "off_kcal_errechnet", text: "kcal stammt aus OFF und ist aus kJ errechnet" });
  }
  for (const q of webOhneEan) {
    if (zutaten_quelle === q.quelle || naehrwerte_quelle === q.quelle) befunde.push({ art: "vorlaeufig_ohne_ean", quelle: q.quelle, text: `${q.quelle} genutzt, aber ohne Barcode auf der Seite – vorläufig` });
  }
  const vollstaendig = fehlt.length === 0;
  // v6.9: Was die Kette als Naechstes braucht – fehlt etwas oder ist nur Vorlaeufiges da, hilft nur das Etikettfoto
  const naechster_schritt = !vollstaendig || befunde.some((b) => b.art === "vorlaeufig_ohne_ean" || b.art === "nw_umgerechnet") ? "etikettfoto" : null;
  return { ean, name, name_quelle, marke, zutaten_text, zutaten_quelle, zutaten_teil, naehrwerte, naehrwerte_quelle, fehlt, befunde, vollstaendig, naechster_schritt };
}

// ---------- Ein Lauf ----------
async function einLauf(sb: any, client: Anthropic | null, modell: string, budgetRest: { usd: number }, lauf: any) {
  const t0 = Date.now();
  const ean = String(lauf.ean ?? "").replace(/\D/g, "");
  const fotos: string[] = (Array.isArray(lauf.fotos) ? lauf.fotos : []).filter((x: unknown) => typeof x === "string" && x.startsWith("data:image/"));
  const fotos_eindeutig = [...new Set(fotos)];

  let kosten = 0, inT = 0, outT = 0, benutzt: string | null = null, fehler: string | null = null;
  let foto: Quelle | null = null;
  let vorbehalt = 0;
  // v6.7: Nachholen/Tests lassen 0,50 $ des Tagesdeckels fuer echte Scans uebrig
  const reserve = lauf.eingang === "nachholen" ? RESERVE_ECHTE_SCANS : 0;
  const fotoAufgabe = (async () => {
    if (lauf.eingang !== "foto" || !fotos_eindeutig.length) return;
    const tf = Date.now();
    if (!client) { fehler = "Kein Anthropic-Schlüssel"; return; }
    if (budgetRest.usd - reserve < 0.1) { foto = { quelle: "foto", ergebnis: "uebersprungen", befunde: [{ art: "tagesdeckel", text: "Riki-2-Tagesdeckel erreicht" }], dauer_ms: 0 }; return; }
    vorbehalt = 0.1; budgetRest.usd -= vorbehalt; // Vorbehalt, damit parallele Laeufe den Deckel nicht gemeinsam reissen
    try {
      const r = await fotoLesen(client, modell, fotos_eindeutig);
      kosten = r.kosten; inT = r.inT; outT = r.outT; benutzt = r.modell;
      const l = r.lesung;
      foto = { quelle: "foto", url: lauf.job_id ? `riki_scan_job:${lauf.job_id}` : null, ergebnis: l ? "treffer" : "fehler", befunde: [], dauer_ms: Date.now() - tf };
      if (r.fehler) foto.befunde.push({ art: "fehler", quelle: "foto", text: r.fehler });
      if (l) {
        const fe = String(l.ean_auf_foto ?? "").replace(/\D/g, "");
        if (fe && gtinGueltig(fe) && gtinGueltig(ean) && !gtinGleich(fe, ean)) {
          foto.ergebnis = "ean_falsch";
          foto.befunde.push({ art: "foto_ean_anders", quelle: "foto", text: `Barcode auf dem Foto ${fe} ≠ Scan ${ean}`, sperrt: true });
        } else if (fe && gtinGleich(fe, ean)) {
          foto.ean_beweis = "Barcode auf dem Foto = Scan";
        }
        foto.name = l.name; foto.marke = l.marke;
        (foto as any)._lesbar = l.zutatenverzeichnis_sichtbar === "ja" ? l.zutaten_lesbar : "nein";
        if (l.zutatenverzeichnis_sichtbar === "ja" && l.zutaten_text) foto.zutaten_text = ohneZutatenWort(String(l.zutaten_text));
        if (l.zutatenverzeichnis_sichtbar !== "ja" && l.zutaten_text) foto.befunde.push({ art: "zutaten_ohne_verzeichnis", quelle: "foto", text: "Zutaten geliefert, obwohl kein Verzeichnis sichtbar – verworfen" });
        const zub = l.naehrwert_basis === "zubereitet" && zubereitungsprodukt(String(l.name ?? ""));
        if (l.naehrwert_basis === "100g" || l.naehrwert_basis === "100ml" || zub) {
          // v7.1: Werte aus der woertlich abgeschriebenen Tabelle, Zuordnung im Code; Modell-Zuordnung nur als Vergleich/Ersatz
          const modellNW = sauberNW(l.naehrwerte);
          const t = nwAusTabelle(l.tabelle, zub);
          foto.befunde.push(...t.befunde);
          let nw = modellNW, abweichend: string[] = [];
          if (nwKomplett(t.nw)) {
            nw = t.nw;
            if (modellNW) abweichend = nwUnterschiede(t.nw!, modellNW);
            if (abweichend.length) foto.befunde.push({ art: "zuordnung_abweichend", quelle: "foto", text: `Tabelle (Code) und Modell ordnen anders zu: ${abweichend.map((f) => `${f} ${t.nw![f as keyof NW]} / ${modellNW![f as keyof NW]}`).join(", ")}` });
          } else if (Array.isArray(l.tabelle) && l.tabelle.length) {
            foto.befunde.push({ art: "tabelle_unvollstaendig", quelle: "foto", text: "Tabelle abgeschrieben, aber nicht alle Grundwerte zuzuordnen – Modell-Zuordnung genommen" });
          }
          // v7.1: Verdacht (Rechenprobe schlaegt an oder Zuordnungen widersprechen sich) -> nur die Tabelle gezielt nachlesen
          const sperrt = (x: NW | null) => !!x && pruefeNaehrwerte(x, String(l.name ?? ""), "foto").some((b) => b.sperrt);
          if (nw && (abweichend.length || sperrt(nw))) {
            const nr = Number(l.tabelle_foto);
            const bild = Number.isInteger(nr) && nr >= 1 && nr <= fotos_eindeutig.length ? [fotos_eindeutig[nr - 1]] : fotos_eindeutig.slice(0, 6);
            if (budgetRest.usd - reserve >= 0.05) {
              try {
                const r2 = await tabelleNachlesen(client, modell, bild, zub);
                kosten += r2.kosten; inT += r2.inT; outT += r2.outT;
                if (nwKomplett(r2.nw) && !sperrt(r2.nw)) {
                  const geaendert = nwUnterschiede(r2.nw!, nw);
                  foto.befunde.push({ art: "nachgelesen", quelle: "foto", text: `Tabelle gezielt nachgelesen (${bild.length === 1 ? `Foto ${nr}` : "alle Fotos"}, Spalte „${r2.spalte ?? "?"}")${geaendert.length ? `: geändert ${geaendert.map((f) => `${f} ${nw![f as keyof NW]} → ${r2.nw![f as keyof NW]}`).join(", ")}` : ": gleiche Werte"}` });
                  nw = r2.nw;
                } else {
                  foto.befunde.push({ art: "nachlesen_ohne_erfolg", quelle: "foto", text: "Nachlesung brachte keine stimmigen Werte – erste Lesung bleibt, Prüfungen entscheiden" });
                }
              } catch (e) {
                foto.befunde.push({ art: "fehler", quelle: "foto", text: "Nachlesung: " + String((e as Error)?.message ?? e).slice(0, 200) });
              }
            } else {
              foto.befunde.push({ art: "tagesdeckel", quelle: "foto", text: "Nachlesung übersprungen: Tagesdeckel" });
            }
          }
          foto.naehrwerte = nw;
          if (zub) foto.befunde.push({ art: "zubereitet", quelle: "foto", text: "Brühe: zubereitete Werte vom Etikett (BR-NW-WIE-VERKAUFT F2)" });
        }
        else if (l.naehrwert_basis === "nur_portion") foto.befunde.push({ art: "portion", quelle: "foto", text: "Etikett zeigt nur Portionswerte" });
        else if (l.naehrwert_basis === "zubereitet") foto.befunde.push({ art: "nur_zubereitet", quelle: "foto", text: "Etikett zeigt nur Werte für das zubereitete Produkt – kein Zubereitungsprodukt, nicht übernommen" });
        if (Array.isArray(l.unsicher) && l.unsicher.length) foto.befunde.push({ art: "unsicher", quelle: "foto", text: l.unsicher.join(", ") });
      }
    } catch (e) {
      fehler = "Fotolesung: " + String((e as Error)?.message ?? e).slice(0, 300);
      foto = { quelle: "foto", ergebnis: "fehler", befunde: [{ art: "fehler", text: fehler }], dauer_ms: Date.now() - tf };
    }
  })();

  const [quellen] = await Promise.all([
    ean.length >= 8 ? Promise.all([quelleEdeka(ean), quelleDm(ean), quelleOff(ean), quelleCodecheck(ean)]) : Promise.resolve([] as Quelle[]),
    fotoAufgabe,
  ]);
  const f = foto as Quelle | null;
  const fotoFuerMerge = f && f.ergebnis === "treffer" ? f : null;
  let ergebnis = zusammenfuehren(ean, quellen, fotoFuerMerge);
  // v6.9: erst kostenlos bei OFF nach Marke + Name suchen (0,5 s), dann erst die bezahlte Websuche
  const lueckeDa = () => ergebnis.fehlt.some((x) => x === "zutaten" || x === "zutaten_unvollstaendig" || x === "naehrwerte" || x === "naehrwerte_teilweise");
  if (lueckeDa() && ergebnis.marke && ergebnis.name && ean.length >= 8) {
    quellen.push(await quelleOffName(ergebnis.marke, ergebnis.name, ean));
    ergebnis = zusammenfuehren(ean, quellen, fotoFuerMerge);
  }
  // v6: Herstellerweg nur bei Luecke, nur mit Marke + Name, nur im Deckel
  let kostenWeb = 0;
  const luecke = lueckeDa();
  if (luecke && client && ergebnis.marke && ergebnis.name && ean.length >= 8) {
    if (budgetRest.usd - reserve < 0.06) {
      ergebnis.befunde.push({ art: "tagesdeckel", text: reserve ? "Herstellerweg übersprungen: Rest des Tagesdeckels bleibt echten Scans" : "Herstellerweg übersprungen: Riki-2-Tagesdeckel" });
    } else {
      budgetRest.usd -= 0.06;
      try {
        const w = await herstellerweg(client, ergebnis.marke, ergebnis.name, ean);
        kostenWeb = w.kosten; inT += w.inT; outT += w.outT;
        quellen.push(...w.quellen);
        ergebnis = zusammenfuehren(ean, quellen, fotoFuerMerge);
        benutzt = benutzt ?? SUCH_MODELL;
      } catch (e) {
        ergebnis.befunde.push({ art: "fehler", quelle: "websuche", text: String((e as Error)?.message ?? e).slice(0, 300) });
      }
      budgetRest.usd += 0.06 - kostenWeb;
    }
  }
  for (const q of quellen) ergebnis.befunde.push(...q.befunde.filter((b) => ["leere_huelle", "anderes_produkt", "sorte_unbekannt", "off_name_kandidat", "off_name_mehrdeutig"].includes(b.art)));
  if (f) ergebnis.befunde.push(...f.befunde);
  const alle = f ? [f, ...quellen] : quellen;
  const kostenFinal: number = Math.round((kosten + kostenWeb) * 1e6) / 1e6;
  budgetRest.usd += vorbehalt - kosten; // Vorbehalt durch echte Kosten ersetzen

  const meldung = {
    status: "fertig",
    dauer_ms: Date.now() - t0,
    ergebnis,
    quellen: alle.map(({ _lesbar, ...q }: any) => q),
    kosten_usd: kostenFinal,
    in: inT, out: outT,
    modell: benutzt,
    version: VERSION,
    fehler,
  };
  const { error } = await sb.rpc("cb_riki2_ablegen", { p_lauf_id: lauf.lauf_id, p: meldung });
  if (error) throw new Error("ablegen: " + (error.message ?? JSON.stringify(error)));
  return { lauf_id: lauf.lauf_id, ean, vollstaendig: ergebnis.vollstaendig, fehlt: ergebnis.fehlt, s: Math.round(meldung.dauer_ms / 100) / 10, usd: kostenFinal };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return antwort({ ok: false, fehler: "POST erforderlich" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const body = await req.json().catch(() => ({}));
    const max = Math.max(1, Math.min(6, Number(body?.max ?? 3)));
    const { data, error } = await sb.rpc("cb_riki2_claim", { p_max: max });
    if (error) throw new Error("claim: " + error.message);
    const laeufe = data?.laeufe ?? [];
    if (!laeufe.length) return antwort({ ok: true, version: VERSION, laeufe: 0 });
    const key = findeKey();
    const client = key ? new Anthropic({ apiKey: key, maxRetries: 1, timeout: 90_000 }) : null;
    const budgetRest = { usd: Number(data?.budget_rest_usd ?? 0) };
    const modell = String(data?.modell ?? "claude-sonnet-5-5");
    const ergebnisse = await Promise.all(laeufe.map((l: any) =>
      einLauf(sb, client, modell, budgetRest, l).catch(async (e) => {
        const msg = String((e as Error)?.message ?? e).slice(0, 500);
        await sb.rpc("cb_riki2_ablegen", { p_lauf_id: l.lauf_id, p: { status: "fehler", fehler: msg, version: VERSION } });
        return { lauf_id: l.lauf_id, fehler: msg };
      })
    ));
    return antwort({ ok: true, version: VERSION, laeufe: ergebnisse });
  } catch (e) {
    return antwort({ ok: false, version: VERSION, fehler: String((e as Error)?.message ?? e) }, 500);
  }
});
