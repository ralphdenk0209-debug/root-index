// riki-quelle-lesen — RIKI SOURCE EXTRACTOR v1 (Work #238, Ralph-Entscheid 24.08.2026)
//
// EINE Quelle rein, EIN strukturierter Befund raus. Mehr nicht.
// Diese Funktion sucht nicht, vergleicht nicht und entscheidet keine Identitaet —
// das macht riki-orchestrator. Hier gilt nur: was steht auf DIESER Seite?
//
// GRUNDSATZ (Ralphs Extractor-Vertrag):
//   Nichts ergaenzen. Nichts aus Vorwissen. Nichts aus anderen Varianten.
//   Nichts sprachlich verschoenern. Originaltexte bleiben erhalten.
//   Naehrwerte nie umrechnen, wenn die Quelle einen Wert direkt liefert.
//   0 heisst echte deklarierte Null. Nicht angegeben heisst null.
//
// WARUM DER SERVER MAPPT UND NICHT DAS MODELL (Work #234: 9 gegen 11 Items):
//   Das Modell liefert Ralphs lesbaren Extractor-Vertrag. Die Umsetzung in
//   riki_source_extraction_item_v1 — item_uid, row_index, section_key — macht
//   dieser Server, deterministisch. Ein Modell, das seine eigenen Schluessel
//   erfindet, erfindet sie bei jedem Lauf neu. Genau das war der Fehler.
//
// UNTERZUTATEN SIND KEINE EIGENEN ZEILEN:
//   "Kefirkulturen (Hefen, Milchsaeurebakterien)" ist EIN Item mit zwei
//   parenthetical_items — nicht ein Mal ein Item und beim naechsten Lauf drei.
//   Ausnahme: Zusatzstoffe aus der Klammer werden eigene Items in "zusatzstoffe",
//   sonst bliebe die Zusatzstoff-Achse faelschlich leer (Wurst-/Schinken-Fall).
//
// ABRUFTEIL: uebernommen aus riki-herstellerseite v21 (fetch, htmlZuText,
//   JSON-LD, Unterseiten-Folge). UEBERGANG: solange beide Funktionen laufen,
//   existiert dieser Abruf zweimal. Faellig vor der #240-Abnahme:
//   riki-herstellerseite auf diese Funktion zurueckfuehren. Steht als Work Item.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const CONTRACT = "riki_source_extraction_item_v1";
const EDGE_VERSION = 3;

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-opus-5": { in: 5.0, out: 25.0 },
};

/* v3.1, gemessen am 25.08.2026: Opus 5 lehnt den Parameter temperature ab -
   "`temperature` is deprecated for this model." Vier Eskalationsversuche sind
   daran gescheitert, jeder mit 0 Token und 0 Kosten.
   Fuer die anderen Modelle bleibt temperature 0, denn genau daran haengt die
   Reproduzierbarkeit aus #234: derselbe Text soll dieselbe Struktur ergeben.
   Bei Opus faellt dieser Hebel weg - das ist bei der Auswertung von #234 zu
   beruecksichtigen, nicht stillschweigend hinzunehmen. */
const OHNE_TEMPERATURE = new Set<string>(["claude-opus-5"]);

// Ralph-Entscheid 24.08.2026 (Variante A): Fuer den Benchmark laeuft RIKI auf
// Sonnet, nicht auf Haiku. Rund dreifacher Tokenpreis — der Anspruch ist Maszstab
// zu sein, nicht zu sparen. Ueber "modell" im Aufruf weiter umstellbar.
// Der Modellname ist gemessen, nicht angenommen: 1.643 erfolgreiche Aufrufe
// unter genau diesem Namen, zuletzt am 24.08.2026.
const STANDARD_MODELL = "claude-sonnet-4-6";

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}

/* ---------------------------------------------------------------------------
   Der Extractor-Prompt. Ralphs Fassung vom 24.08.2026, unveraendert in der
   Sache; ergaenzt nur um die Sektionsnamen, die dieser Server kennt.
--------------------------------------------------------------------------- */
const EXTRACTOR_REGEL = `Du extrahierst ausschliesslich Informationen, die in der uebergebenen Quelle tatsaechlich enthalten sind.
Nichts ergaenzen. Nichts aus Vorwissen einsetzen. Nichts aus anderen Produktvarianten uebernehmen.
Nichts sprachlich verschoenern. Originaltexte muessen erhalten bleiben.

Der uebergebene Text kann Navigation, Werbung und ANDERE Produkte enthalten. Nimm ausschliesslich
Angaben zu dem Produkt, das im Auftrag benannt ist. Bist du dir bei einem Block nicht sicher,
ob er zu diesem Produkt gehoert, nimm ihn NICHT — schreib ihn stattdessen nach "unresolved".

Abschnitte "STRUKTURIERTE DATEN (JSON-LD)" und "UNTERSEITE ..." gehoeren zur selben Quelle
und sind gleichwertig.

=== ZUTATEN ===
Bei Zutaten trennst du die Rollen:
ingredient | subingredient | additive | processing | property | quantity | allergen | unresolved

Klammern werden NICHT entfernt. Klammerinhalt wird strukturell dem unmittelbar davorstehenden
Bestandteil zugeordnet, solange die Quelle keinen anderen Zusammenhang zeigt.

Beispiel: "Kefirkulturen (Hefen, Milchsaeurebakterien)"
  ingredient: "Kefirkulturen"
  subingredients: "Hefen", "Milchsaeurebakterien"

Beispiel: "Bio-Kuhmilch (fettarm, homogenisiert, pasteurisiert)"
  ingredient: "Bio-Kuhmilch"
  properties: "fettarm"
  processing: "homogenisiert", "pasteurisiert"
NICHT drei oder vier verschiedene Zutaten daraus machen.

Der sichtbare Originaltext wird zusaetzlich unveraendert gespeichert — je Zutat in
"original_text", und die vollstaendige Zutatenzeile der Quelle in "ingredients_raw_text".

Steht in der Klammer ein ZUSATZSTOFF (E-Nummer oder Klartext wie "Natriumnitrit",
"Antioxidationsmittel (Ascorbinsaeure)", "Emulgator (Lecithine)"), gehoert er ZUSAETZLICH
in die Liste "additives" — mit Name und, falls erkennbar, E-Nummer. Uebersieh das nie:
sonst sieht ein Produkt zusatzstofffrei aus, das keines ist.

=== NAEHRWERTE, MIKRONAEHRSTOFFE, WIRKSTOFFE ===
Naehrwerte niemals umrechnen, wenn die Quelle einen Wert direkt liefert.
Einheiten und Bezugsbasis unveraendert erhalten. "<", ">", "=<", ">=" bleiben als operator erhalten.
kJ und kcal sind zwei getrennte Zeilen, wenn die Quelle beide nennt — nicht ineinander umrechnen.
0 bedeutet nur echte deklarierte Null. Nicht angegeben bedeutet null.
basis ist genau das, was ueber der Spalte steht: "100g", "100ml", "portion", "tagesdosis",
"packung" oder "sonstige". Steht nichts Eindeutiges da: "unbekannt". RATE NICHT nach Produktart.
Portions- und Tagesdosiswerte NIEMALS auf 100 g hochrechnen und umgekehrt.
IU/IE nicht in mg/µg umrechnen — Einheit so lassen, wie sie dasteht.

micronutrients: ausdrueckliche Vitamine und Mineralstoffe (mit Wert, Einheit, basis, nrv falls genannt).
active_compounds: ausdrueckliche Wirkstoffe und sonstige Stoffe — Omega-3, EPA, DHA, Aminosaeuren,
Coenzym Q10, L-Carnitin, Pflanzenextrakte. "davon"-Zeilen als eigene Eintraege mit fuehrendem "davon ".

=== ALLERGENE ===
Nur ausdrueckliche Angaben. claim ist "enthalten" oder "spuren". Nichts ableiten:
Weizenmehl in der Zutatenliste ist keine Allergendeklaration, solange die Quelle keine macht.

=== IDENTITAET ===
Nur uebernehmen, was die Quelle ausdruecklich nennt. Eine Ziffernfolge ist nur dann eine gtin,
wenn die Quelle sie als EAN, GTIN, Barcode oder Strichcode bezeichnet (in JSON-LD auch gtin13/gtin8).
Artikelnummer, SKU, Bestellnummer und ASIN sind KEINE gtin — dann null.

=== EXPLIZITE ABWESENHEIT ===
Sagt die Quelle ausdruecklich, dass etwas NICHT enthalten ist ("ohne Konservierungsstoffe",
"laktosefrei"), gehoert das nach "explicit_absence" — nicht als Zutat, nicht als Wert 0.

ANTWORTE AUSSCHLIESSLICH MIT EINEM JSON-OBJEKT, ohne Markdown und ohne Text davor oder danach:
{
 "source": {"retrieved_product_name":null,"brand":null,"manufacturer":null,"gtin":null,
            "package_size":null,"market":null,"variant":null,"product_url":null},
 "ingredients_raw_text": null,
 "ingredients": [
   {"original_text":"...","name":"...","role":"ingredient|subingredient|additive|unresolved",
    "subingredients":[],"processing":[],"properties":[],"quantity":null,"e_number":null,
    "confidence":"hoch|mittel|niedrig"}
 ],
 "additives": [{"original_text":"...","name":"...","e_number":null,"confidence":"hoch|mittel|niedrig"}],
 "nutrition": [{"original_label":"...","original_value_text":"...","name":"...","operator":"=",
                "value":null,"unit":"...","basis":"100g|100ml|portion|tagesdosis|packung|sonstige|unbekannt"}],
 "micronutrients": [{"original_label":"...","original_value_text":"...","name":"...","operator":"=",
                     "value":null,"unit":"...","basis":"...","nrv_percent":null}],
 "active_compounds": [{"original_label":"...","original_value_text":"...","name":"...","operator":"=",
                       "value":null,"unit":"...","basis":"...","nrv_percent":null}],
 "allergens": [{"original_text":"...","name":"...","claim":"enthalten|spuren"}],
 "dosage": {"serving_size":null,"daily_dose":null,"recommendation_text":null,"form":null},
 "explicit_absence": [],
 "unresolved": [{"original_text":"...","reason":"..."}],
 "source_coverage": {"identity":"complete|partial|none","ingredients":"complete|partial|none",
                     "additives":"complete|partial|none","allergens":"complete|partial|none",
                     "nutrition":"complete|partial|none","micronutrients":"complete|partial|none",
                     "active_compounds":"complete|partial|none","dosage":"complete|partial|none"}
}`;

/* ---------------------------------------------------------------------------
   Abruf. Uebernommen aus riki-herstellerseite v21 — gleiche Regeln, gleiche
   Zeitfenster. Wird zurueckgefuehrt, sobald diese Funktion abgenommen ist.
--------------------------------------------------------------------------- */
function htmlZuText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/td)[^>]*>/gi, " \n ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&euro;/gi, "€")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function jsonLdBloecke(html: string): string {
  try {
    const out: string[] = [];
    const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && out.length < 4) {
      const t = (m[1] ?? "").trim();
      if (t.length > 40 && /product|nutrition|gtin|ingredient|offers/i.test(t)) out.push(t.slice(0, 4000));
    }
    return out.length ? "\n--- STRUKTURIERTE DATEN (JSON-LD) ---\n" + out.join("\n") : "";
  } catch (_e) { return ""; }
}

function fokus(text: string): string {
  const low = text.toLowerCase();
  const teile: string[] = [];
  const fenster = (pos: number, vor: number, len: number) => text.slice(Math.max(0, pos - vor), Math.max(0, pos - vor) + len);
  const a = low.search(/nährwert|naehrwert|zutaten|inhaltsstoffe|vitamine|mineralstoffe|zusammensetzung/);
  teile.push(a < 0 ? text.slice(0, 12000) : fenster(a, 3000, 12000));
  const b = low.search(/dosierung|verzehrempfehlung|empfohlene verwendung|herstellerempfehlung|anwendungshinweis|verzehrmenge|einnahme/);
  if (b >= 0) teile.push("\n--- DOSIERUNG ---\n" + fenster(b, 300, 2500));
  const c = low.search(/\bean\b|gtin|barcode|strichcode/);
  if (c >= 0) teile.push("\n--- KENNZEICHNUNG ---\n" + fenster(c, 200, 700));
  const d = low.search(/allergen|kann spuren/);
  if (d >= 0) teile.push("\n--- ALLERGENE ---\n" + fenster(d, 300, 1200));
  return teile.join("\n");
}

/* ---------------------------------------------------------------------------
   v2 / Work #228, gemessen 25.08.2026 an LaVita P1809 (research_session 15/16).

   BEFUND: Die Shop-Seite enthaelt den Satz
     "Zutaten - Die gesamte Zutatenliste finden Sie hier."
   Der alte Ausloeser fragte nur, ob das WORT "Zutaten" im Text vorkommt. Es kam
   vor - also hielt er die Seite fuer versorgt und lud die Unterseite NICHT nach.
   Gemessen: linked_attempted = [], nicht ein einziger Versuch. Ergebnis:
   ingredients none, nutrition none, micronutrients none.
   Der Wegweiser hat die Wegsuche abgeschaltet. Genau umgekehrt ist richtig:
   ein Verweis ist der BEWEIS, dass die Daten woanders stehen.

   Die drei Aenderungen sind additiv - der neue Ausloeser feuert immer dann,
   wenn der alte feuerte, und zusaetzlich in diesem Fall. Keine Regression an
   den 167 bisher erfolgreichen Faellen moeglich.
--------------------------------------------------------------------------- */

/* Steht dort eine ZUTATENLISTE - oder nur ein Link darauf?
   Eine echte Liste ist lang und durch Kommas/Semikolons gegliedert.
   Ein Linktext ist kurz. Genau daran wird unterschieden. */
function hatZutatenListe(text: string): boolean {
  const re = /(zutaten|inhaltsstoffe|zusammensetzung)\s*[:\-–]?\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const ab = m.index + m[0].length;
    const nach = text.slice(ab, ab + 600);
    const bisAbsatz = (nach.split(/\n\s*\n/)[0] ?? nach);
    const trenner = (bisAbsatz.match(/[,;]/g) ?? []).length;
    if (bisAbsatz.trim().length >= 80 && trenner >= 3) return true;
  }
  return false;
}

/* Stehen Naehrwerte mit ZAHLEN da - oder nur das Wort "Naehrwerttabelle"? */
function hatNaehrwertZahlen(text: string): boolean {
  if (/\d[\d.,]*\s*(kcal|kj)\b/i.test(text)) return true;
  return /(energie|fett|eiwei|kohlenhydrat|ballaststoff|salz)[^\n]{0,80}?\d[\d.,]*\s*(g|mg|µg|kj|kcal)\b/i.test(text);
}

/* Sagt die Seite selbst, dass die Daten woanders stehen? Dann IMMER nachladen. */
function verweistAufUnterseite(text: string): boolean {
  return /(zutatenliste|zutaten|inhaltsstoffe|n(ä|ae)hrwert(tabelle|angaben)?)[^\n]{0,60}\b(finden sie|findest du|siehe|hier|mehr erfahren|ansehen|anzeigen|zur uebersicht|zur übersicht)\b/i.test(text)
      || /\b(finden sie|findest du|hier)\b[^\n]{0,40}(zutatenliste|n(ä|ae)hrwert|inhaltsstoffe)/i.test(text);
}

/* Registrierbare Domain: shop.lavita.com und www.lavita.com sind dieselbe
   Organisation, aber nicht derselbe Host. Die alte Regel u.host !== basis.host
   haette den Link zur Zutatenseite auch dann verworfen, wenn der Ausloeser
   gefeuert haette - zweite, unabhaengige Sperre.
   Mandanten-Plattformen bleiben ausgenommen: dort teilen sich FREMDE Anbieter
   eine Domain, da waere "gleiche Organisation" schlicht falsch. */
const ZWEISTUFIGE_TLD = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.jp", "com.au", "net.au", "co.nz",
  "com.br", "co.za", "com.tr", "com.mx", "co.in", "com.cn",
]);
const MANDANTEN_PLATTFORM = new Set([
  "myshopify.com", "shopifypreview.com", "wixsite.com", "squarespace.com",
  "webflow.io", "shopware.store", "jimdosite.com", "weebly.com", "godaddysites.com",
]);
function registrierbareDomain(host: string): string {
  const t = String(host ?? "").toLowerCase().replace(/\.$/, "");
  const p = t.split(".").filter(Boolean);
  if (p.length <= 2) return p.join(".");
  const letzteZwei = p.slice(-2).join(".");
  if (ZWEISTUFIGE_TLD.has(letzteZwei)) return p.slice(-3).join(".");
  return letzteZwei;
}
function gleicheOrganisation(a: string, b: string): boolean {
  if (a === b) return true;
  const ra = registrierbareDomain(a);
  const rb = registrierbareDomain(b);
  if (!ra || ra !== rb) return false;
  if (MANDANTEN_PLATTFORM.has(ra)) return false;   /* fremde Anbieter, gleiche Domain */
  return true;
}

type UnterErgebnis = { text: string; attempted: string[]; successful: string[]; verworfen_fremd: string[] };
async function unterseitenText(html: string, basisUrl: string, maxLinks: number): Promise<UnterErgebnis> {
  try {
    const basis = new URL(basisUrl);
    const links: string[] = [];
    const verworfenFremd: string[] = [];
    const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && links.length < maxLinks) {
      const kandidat = (m[1] ?? "") + " " + (m[2] ?? "").replace(/<[^>]+>/g, " ");
      if (!/zutat|inhaltsstoffe|n(ä|ae)hrwert|zusammensetzung|naehrstoff|dosierung|verzehr/i.test(kandidat)) continue;
      try {
        const u = new URL(m[1], basis);
        if (!gleicheOrganisation(u.host, basis.host)) {
          if (verworfenFremd.length < 10 && !verworfenFremd.includes(u.href)) verworfenFremd.push(u.href);
          continue;
        }
        if (u.href.split("#")[0] === basis.href.split("#")[0]) continue;
        if (!links.includes(u.href)) links.push(u.href);
      } catch (_e) { /* kaputter Link */ }
    }
    let out = "";
    const attempted: string[] = [];
    const successful: string[] = [];
    for (const l of links) {
      attempted.push(l);
      try {
        const c = new AbortController(); const id = setTimeout(() => c.abort(), 8000);
        const r = await fetch(l, { headers: { "User-Agent": UA, "Accept": "text/html" }, signal: c.signal, redirect: "follow" });
        clearTimeout(id);
        if (!r.ok) continue;
        const t = htmlZuText(await r.text());
        if (t.length > 200) { successful.push(l); out += "\n--- UNTERSEITE " + l + " ---\n" + fokus(t); }
      } catch (_e) { /* nicht erreichbar */ }
    }
    return { text: out, attempted, successful, verworfen_fremd: verworfenFremd };
  } catch (_e) { return { text: "", attempted: [], successful: [], verworfen_fremd: [] }; }
}

/* ---------------------------------------------------------------------------
   Deterministische Umsetzung in riki_source_extraction_item_v1.
   Gleiche Quelle + gleicher Inhalt -> gleiche item_uid. Das ist Phase G.
--------------------------------------------------------------------------- */
function slug(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function basisKey(b: unknown): string | null {
  const t = String(b ?? "").toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  if (/^(100g|je100g|pro100g|per100g)$/.test(t)) return "pro_100g";
  if (/^(100ml|je100ml|pro100ml|per100ml)$/.test(t)) return "pro_100ml";
  if (/portion|serving/.test(t)) return "pro_portion";
  if (/tagesdosis|tagesportion|dailydose|tag/.test(t)) return "daily_dose";
  if (/packung|container|behälter|behaelter/.test(t)) return "per_container";
  if (/unbekannt|unknown/.test(t)) return "unresolved";
  return "other";
}

function zahl(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}

function operator(x: unknown): string | null {
  const t = String(x ?? "").trim();
  if (t === "<" || t === ">" || t === "<=" || t === ">=" || t === "≤" || t === "≥") return t;
  return null; // "=" ist der Normalfall und braucht keinen Vermerk
}

function konfidenz(x: unknown): string | null {
  const t = String(x ?? "").trim().toLowerCase();
  if (t === "hoch" || t === "mittel" || t === "niedrig") return t;
  return null;
}

type Aufbau = { sections: any[]; items: any[]; zaehler: Record<string, number> };

function baueVertrag(p: any, quelleUrl: string): Aufbau {
  const items: any[] = [];
  const zaehler: Record<string, number> = {};
  let row = 0;

  const naechste = (sectionKey: string) => { zaehler[sectionKey] = (zaehler[sectionKey] ?? 0) + 1; };

  const push = (o: any) => {
    row += 1;
    items.push({ ...o, row_index: row, source_locator: { url: quelleUrl, ...(o.source_locator ?? {}) } });
    naechste(o.section_key);
  };

  // --- Zutaten ------------------------------------------------------------
  // Eine Hauptzutat = eine Zeile. Unterzutaten haengen als parenthetical_items daran.
  const zutaten = Array.isArray(p?.ingredients) ? p.ingredients : [];
  let zIndex = 0;
  for (const z of zutaten) {
    const orig = String(z?.original_text ?? z?.name ?? "").trim();
    const name = String(z?.name ?? "").trim();
    if (!orig) continue;
    const rolle = String(z?.role ?? "ingredient").trim();
    if (rolle === "subingredient" || rolle === "processing" || rolle === "property") continue; // haengen am Parent
    if (rolle === "additive") continue; // kommen ueber additives, damit sie nur einmal existieren

    zIndex += 1;
    const subs: string[] = Array.isArray(z?.subingredients) ? z.subingredients.map((x: any) => String(x).trim()).filter(Boolean) : [];
    const proc: string[] = Array.isArray(z?.processing) ? z.processing.map((x: any) => String(x).trim()).filter(Boolean) : [];
    const props: string[] = Array.isArray(z?.properties) ? z.properties.map((x: any) => String(x).trim()).filter(Boolean) : [];
    const unklar = rolle === "unresolved" || !name;

    push({
      item_uid: `${slug(quelleUrl)}|zutaten|${zIndex}|${slug(orig)}`,
      section_key: "zutaten",
      semantic_class: unklar ? "unresolved" : "ingredient",
      original_text: orig,
      original_label: name || orig,
      original_value_text: z?.quantity ? String(z.quantity) : null,
      base_ingredient: unklar ? null : name,
      processing_modifiers: proc.length ? proc : null,
      attributes: props.length ? { properties: props } : null,
      parenthetical_role: subs.length ? "subingredients" : null,
      parenthetical_items: subs.length ? subs : null,
      confidence: konfidenz(z?.confidence),
      extraction_status: unklar ? "unresolved" : "extracted",
      persistence_status: "not_persisted",
      target_kind: unklar ? null : "Produkt_Zutaten",
      note: unklar ? "Rolle in der Quelle nicht eindeutig." : null,
    });
  }

  // --- Zusatzstoffe -------------------------------------------------------
  const zusatz = Array.isArray(p?.additives) ? p.additives : [];
  let aIndex = 0;
  for (const a of zusatz) {
    const orig = String(a?.original_text ?? a?.name ?? "").trim();
    const name = String(a?.name ?? "").trim();
    if (!orig) continue;
    aIndex += 1;
    push({
      item_uid: `${slug(quelleUrl)}|zusatzstoffe|${aIndex}|${slug(orig)}`,
      section_key: "zusatzstoffe",
      semantic_class: "additive",
      original_text: orig,
      original_label: name || orig,
      original_value_text: a?.e_number ? String(a.e_number) : null,
      attributes: a?.e_number ? { e_number: String(a.e_number).toUpperCase() } : null,
      confidence: konfidenz(a?.confidence),
      extraction_status: "extracted",
      persistence_status: "not_persisted",
      target_kind: null,
    });
  }

  // --- Allergene ----------------------------------------------------------
  const allerg = Array.isArray(p?.allergens) ? p.allergens : [];
  let alIndex = 0;
  for (const al of allerg) {
    const orig = String(al?.original_text ?? al?.name ?? "").trim();
    const name = String(al?.name ?? "").trim();
    const claim = String(al?.claim ?? "").trim();
    if (!orig || (claim !== "enthalten" && claim !== "spuren")) continue; // ohne klare Angabe kein Allergen
    alIndex += 1;
    push({
      item_uid: `${slug(quelleUrl)}|allergene|${alIndex}|${slug(orig)}`,
      section_key: "allergene",
      semantic_class: "allergen",
      original_text: orig,
      original_label: name || orig,
      attributes: { allergen_claim: claim },
      extraction_status: "extracted",
      persistence_status: "not_persisted",
      target_kind: "Allergene",
    });
  }

  // --- Werte-Listen: Naehrwerte, Mikronaehrstoffe, Wirkstoffe -------------
  const werteListe = (liste: any[], sectionKey: string, klasse: string) => {
    let i = 0;
    for (const w of Array.isArray(liste) ? liste : []) {
      const label = String(w?.original_label ?? w?.name ?? "").trim();
      const orig = String(w?.original_value_text ?? "").trim() || label;
      const name = String(w?.name ?? "").trim();
      if (!label && !name) continue;
      const v = zahl(w?.value);
      const bk = basisKey(w?.basis);
      i += 1;
      const unklar = v === null && !String(w?.original_value_text ?? "").trim();
      push({
        item_uid: `${slug(quelleUrl)}|${sectionKey}|${i}|${slug(name || label)}`,
        section_key: sectionKey,
        semantic_class: unklar ? "unresolved" : klasse,
        original_text: orig || label,
        original_label: label || name,
        original_value_text: String(w?.original_value_text ?? "").trim() || null,
        comparison_operator: operator(w?.operator),
        amount: v,
        unit: String(w?.unit ?? "").trim() || null,
        basis_key: bk,
        basis_label: String(w?.basis ?? "").trim() || null,
        attributes: w?.nrv_percent !== null && w?.nrv_percent !== undefined
          ? { nrv_percent: zahl(w.nrv_percent) } : null,
        extraction_status: unklar ? "unresolved" : "extracted",
        persistence_status: "not_persisted",
        target_kind: unklar ? null : (sectionKey === "naehrwerte" ? "Naehrwerte_Makro" : "Produkt_Naehrstoffe"),
        note: unklar ? "Wert in der Quelle nicht als Zahl lesbar." : null,
      });
    }
  };
  werteListe(p?.nutrition, "naehrwerte", "macro_nutrient");
  werteListe(p?.micronutrients, "mikronaehrstoffe", "micronutrient");
  werteListe(p?.active_compounds, "wirkstoffe", "active_compound");

  // --- Was die Quelle zeigte, aber niemand zuordnen konnte ----------------
  const offen = Array.isArray(p?.unresolved) ? p.unresolved : [];
  let uIndex = 0;
  for (const u of offen) {
    const orig = String(u?.original_text ?? "").trim();
    if (!orig) continue;
    uIndex += 1;
    push({
      item_uid: `${slug(quelleUrl)}|zutaten|unresolved-${uIndex}|${slug(orig)}`,
      section_key: "zutaten",
      semantic_class: "unresolved",
      original_text: orig,
      original_label: orig.slice(0, 120),
      extraction_status: "unresolved",
      persistence_status: "not_persisted",
      target_kind: null,
      note: String(u?.reason ?? "").trim() || "Nicht zuzuordnen.",
    });
  }

  // --- Sektionen ----------------------------------------------------------
  const cov = p?.source_coverage ?? {};
  const covStatus = (k: string, sectionKey: string): string => {
    const c = String(cov?.[k] ?? "").trim();
    const n = zaehler[sectionKey] ?? 0;
    if (c === "complete" && n > 0) return "complete";
    if (c === "partial" && n > 0) return "partial";
    if (n > 0) return "partial";
    if (c === "none") return "not_applicable";
    return "open";
  };

  const sections = [
    { section_key: "zutaten",          section_label: "Zutaten",          extracted_rows: zaehler["zutaten"] ?? 0,          status: covStatus("ingredients", "zutaten") },
    { section_key: "zusatzstoffe",     section_label: "Zusatzstoffe",     extracted_rows: zaehler["zusatzstoffe"] ?? 0,     status: covStatus("additives", "zusatzstoffe") },
    { section_key: "allergene",        section_label: "Allergene",        extracted_rows: zaehler["allergene"] ?? 0,        status: covStatus("allergens", "allergene") },
    { section_key: "naehrwerte",       section_label: "Naehrwerte",       extracted_rows: zaehler["naehrwerte"] ?? 0,       status: covStatus("nutrition", "naehrwerte") },
    { section_key: "mikronaehrstoffe", section_label: "Mikronaehrstoffe", extracted_rows: zaehler["mikronaehrstoffe"] ?? 0, status: covStatus("micronutrients", "mikronaehrstoffe") },
    { section_key: "wirkstoffe",       section_label: "Wirkstoffe",       extracted_rows: zaehler["wirkstoffe"] ?? 0,       status: covStatus("active_compounds", "wirkstoffe") },
  ];

  return { sections, items, zaehler };
}

/* ---------------------------------------------------------------------------
   v3 / Modelleskalation, Ralph-Auftrag 25.08.2026.

   Diese Funktion ENTSCHEIDET NICHT, ob eskaliert wird - sie MELDET nur, ob der
   Befund Anlass dazu gibt. Die Entscheidung faellt der Orchestrator, weil nur
   er weiss, welche Stufe gerade laeuft und ob es eine naechste gibt.

   Die Pruefungen sind genau die, die am 25.08. von Hand die Fehler gefunden
   haben, die RIKI uebersehen hat:
     - Energie gegen die Makronaehrstoffe nachgerechnet
       -> haette die 255 kcal bei LaVita widerlegt (richtig waren 305)
       -> haette die 91 kcal bei den Followfood-Garnelen widerlegt (richtig 75)
     - Zucker groesser als Kohlenhydrate, gesaettigte groesser als Gesamtfett
       -> unmoegliche Werte, die kein Etikett so ausweist
     - Abdeckung meldet fuer Zutaten oder Naehrwerte "none"
       -> die Seite trug die Daten nicht; ein staerkeres Modell liest dasselbe
          Nichts, deshalb ist hier ZUERST eine andere Quelle faellig
     - viele unklare Zeilen
       -> hier hilft ein staerkeres Modell wirklich, das ist Leseverstaendnis

   Wichtig fuer die Auswertung: der Grund sagt, WELCHE Stufe helfen kann.
   "quelle" heisst andere Adresse, "modell" heisst staerkeres Modell.
--------------------------------------------------------------------------- */
type Befund = { code: string; hilft: "quelle" | "modell"; text: string };

function zahlAus(liste: any[], namen: RegExp, einheit?: RegExp): number | null {
  for (const w of Array.isArray(liste) ? liste : []) {
    const bk = basisKey(w?.basis);
    if (bk !== "pro_100g" && bk !== "pro_100ml") continue;
    const label = String(w?.name ?? w?.original_label ?? "");
    if (!namen.test(label)) continue;
    if (einheit && !einheit.test(String(w?.unit ?? ""))) continue;
    const v = zahl(w?.value);
    if (v !== null) return v;
  }
  return null;
}

/* v3.3: Alle Zahlen, die im Quelltext tatsaechlich vorkommen. Deutsche
   Schreibweise (1.545 als Tausender, 4,3 als Dezimalzahl) und englische.
   Grundlage der Herkunftspruefung unten. */
function zahlenImQuelltext(text: string): Set<number> {
  const out = new Set<number>();
  try {
    const roh = String(text ?? "").match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g) ?? [];
    for (const r of roh) {
      const n = /^\d{1,3}(\.\d{3})+/.test(r)
        ? Number(r.replace(/\./g, "").replace(",", "."))
        : Number(r.replace(",", "."));
      if (isFinite(n)) out.add(Math.round(n * 10000) / 10000);
    }
  } catch (_e) { /* eine kaputte Zahl darf nichts kippen */ }
  return out;
}

function qualitaetsbefund(p: any, aufbau: Aufbau, quelltext?: string): Befund[] {
  const b: Befund[] = [];
  try {
    const n = Array.isArray(p?.nutrition) ? p.nutrition : [];
    const kcal = zahlAus(n, /energie|brennwert|energy/i, /kcal/i);
    const kh   = zahlAus(n, /kohlenhydrat/i);
    const ew   = zahlAus(n, /eiwei|protein/i);
    const fett = zahlAus(n, /^fett$|gesamtfett|^fat$/i);
    const zuck = zahlAus(n, /zucker|sugar/i);
    const gfs  = zahlAus(n, /ges(ä|ae)ttigt|saturated/i);
    const ball = zahlAus(n, /ballaststoff|fibre|fiber/i);

    if (kcal !== null && kh !== null && ew !== null && fett !== null) {
      const berechnet = 4 * kh + 4 * ew + 9 * fett + 2 * (ball ?? 0);
      const abw = Math.abs(kcal - berechnet);
      /* Schwelle 15 %, gemessen am echten Fall: Open Food Facts fuehrte fuer die
         Vilgain Tortilla 255 kcal, die eigenen Makros ergeben 305. Das sind 16 %
         Abweichung - mit der aus riki-herstellerseite uebernommenen 30-%-Schwelle
         waere genau dieser Fehler durchgerutscht. Der groessere der beiden Werte
         ist der Nenner, sonst haengt das Ergebnis davon ab, welcher falsch ist. */
      if (kcal > 0 && abw > 20 && abw / Math.max(kcal, berechnet) > 0.15) {
        b.push({ code: "energie_unstimmig", hilft: "modell",
          text: `Energie ${Math.round(kcal)} kcal passt nicht zu den Naehrwerten (rechnerisch ${Math.round(berechnet)} kcal).` });
      }
    }
    if (zuck !== null && kh !== null && zuck > kh + 0.5) {
      b.push({ code: "zucker_ueber_kohlenhydrate", hilft: "modell",
        text: `Zucker ${zuck} g groesser als Kohlenhydrate ${kh} g - unmoeglich.` });
    }
    if (gfs !== null && fett !== null && gfs > fett + 0.5) {
      b.push({ code: "gesaettigte_ueber_fett", hilft: "modell",
        text: `Gesaettigte Fettsaeuren ${gfs} g groesser als Gesamtfett ${fett} g - unmoeglich.` });
    }

    /* ---------------------------------------------------------------------
       v3.3, ergaenzt 28.08.2026 nach einem gemessenen Durchrutscher.

       Ein Modell bekam eine zerrissene Naehrwerttabelle (Dr. Oetker Bistro
       Baguette: drei Spaltenkoepfe, nur eine Wertereihe, 7 Zahlen auf 8
       Zeilen). Es hat die Werte um eine Position verschoben, "8,9" der
       Energie zugeordnet und daraus 8900 kJ gemacht - und fuer die dadurch
       leere Zeile die Zahl 2,7 ERFUNDEN, die im Quelltext nirgends steht.

       Warum die bestehenden Pruefungen das nicht fingen: energie_unstimmig
       rechnet nur mit kcal, und kcal war null. Die drei neuen Pruefungen
       schliessen genau diese Luecke. Sie sind bewusst rein physikalisch -
       keine Schaetzung, keine Produktkenntnis.
    --------------------------------------------------------------------- */

    /* 1. Obergrenzen. 100 g reines Fett sind 900 kcal bzw. rund 3766 kJ -
          mehr Energie kann kein Lebensmittel je 100 g tragen. Gramm-Werte
          koennen 100 g je 100 g nicht ueberschreiten. */
    const kj = zahlAus(n, /energie|brennwert|energy/i, /kj/i);
    const grenzen: Array<[string, number | null, number, string]> = [
      ["Energie", kcal, 900, "kcal"], ["Energie", kj, 3800, "kJ"],
      ["Fett", fett, 100, "g"], ["Kohlenhydrate", kh, 100, "g"],
      ["Eiweiss", ew, 100, "g"], ["Zucker", zuck, 100, "g"],
      ["Ballaststoffe", ball, 100, "g"],
    ];
    for (const [name, wert, max, einheit] of grenzen) {
      if (wert !== null && (wert < 0 || wert > max)) {
        b.push({ code: "wert_physikalisch_unmoeglich", hilft: "modell",
          text: `${name} ${wert} ${einheit} je 100 g - unmoeglich, die Obergrenze liegt bei ${max} ${einheit}. Vermutlich falsche Spalte oder verrutschtes Komma.` });
      }
    }

    /* 2. kJ und kcal derselben Quelle muessen im Verhaeltnis 4,184 stehen.
          Faengt vertauschte Spalten und Zuordnungsfehler, auch wenn beide
          Werte fuer sich genommen plausibel aussehen. */
    if (kj !== null && kcal !== null && kcal > 0) {
      const faktor = kj / kcal;
      if (faktor < 3.8 || faktor > 4.6) {
        b.push({ code: "kj_kcal_unstimmig", hilft: "modell",
          text: `${kj} kJ zu ${kcal} kcal ergibt Faktor ${faktor.toFixed(2)}, erwartet rund 4,18. Die beiden Werte gehoeren nicht zusammen.` });
      }
    }

    /* 3. Die Hauptnaehrstoffe koennen zusammen keine 100 g je 100 g
          ueberschreiten. Faengt gemischte Spalten (100 g plus Portion). */
    if (fett !== null && kh !== null && ew !== null) {
      const summe = fett + kh + ew;
      if (summe > 101) {
        b.push({ code: "summe_ueber_hundert", hilft: "modell",
          text: `Fett ${fett} + Kohlenhydrate ${kh} + Eiweiss ${ew} = ${summe.toFixed(1)} g je 100 g. Mehr als 100 g je 100 g gibt es nicht.` });
      }
    }

    /* 4. HERKUNFTSPRUEFUNG. Jede Zahl, die der Extractor ausgibt, muss so im
          Quelltext stehen. Genau hier waere die erfundene 2,7 aufgeflogen -
          alle anderen Pruefungen sahen sie fuer plausibel an, weil sie zu
          klein war, um irgendeine Grenze zu reissen.
          Ausgenommen: Umrechnungen zwischen kJ und kcal (4,184) und der NRV,
          die die Quelle als Prozent fuehrt. */
    if (quelltext) {
      const vorhanden = zahlenImQuelltext(quelltext);
      /* Die Umrechnung kJ<->kcal gilt NUR fuer Energiezeilen. Sonst deckt die
         Toleranz von 2 Einheiten bei kleinen Werten fast alles ab: die am
         28.08. erfundene 2,7 g waere ueber 0,94 x 4,184 = 3,93 als "passend"
         durchgegangen. Gemessen und korrigiert im selben Durchgang. */
      const passt = (w: number, istEnergie: boolean): boolean => {
        if (vorhanden.has(Math.round(w * 10000) / 10000)) return true;
        if (!istEnergie) return false;
        for (const v of vorhanden) {
          for (const f of [4.184, 1 / 4.184]) {
            if (Math.abs(w - v * f) < Math.max(2, Math.abs(w) * 0.02)) return true;
          }
        }
        return false;
      };
      const erfunden: string[] = [];
      for (const it of aufbau.items) {
        const w = it?.amount;
        if (typeof w !== "number" || !isFinite(w)) continue;
        const label = String(it?.original_label ?? it?.original_text ?? "");
        const istEnergie = /energie|brennwert|energy/i.test(label)
          || /^(kj|kcal)$/i.test(String(it?.unit ?? ""));
        if (passt(w, istEnergie)) continue;
        if (erfunden.length < 8) erfunden.push(`${label || "?"}: ${w}`);
      }
      if (erfunden.length) {
        b.push({ code: "zahl_nicht_in_quelle", hilft: "modell",
          text: `${erfunden.length} Wert(e) stehen so nicht im Quelltext: ${erfunden.join("; ")}. Frei erfundene Zahlen sind schlimmer als fehlende - niemand sieht ihnen an, dass sie erfunden sind.` });
      }
    }

    const cov = p?.source_coverage ?? {};
    const zutatenZeilen = aufbau.zaehler["zutaten"] ?? 0;
    const naehrZeilen   = aufbau.zaehler["naehrwerte"] ?? 0;
    if (String(cov?.ingredients ?? "") === "none" && zutatenZeilen === 0) {
      b.push({ code: "keine_zutaten", hilft: "quelle",
        text: "Die Quelle traegt keine Zutatenliste. Ein staerkeres Modell liest dasselbe Nichts - hier ist eine andere Adresse faellig." });
    }
    if (String(cov?.nutrition ?? "") === "none" && naehrZeilen === 0) {
      b.push({ code: "keine_naehrwerte", hilft: "quelle",
        text: "Die Quelle traegt keine Naehrwerttabelle. Andere Adresse noetig, nicht anderes Modell." });
    }

    const gesamt = aufbau.items.length;
    const unklar = aufbau.items.filter((i: any) => i.semantic_class === "unresolved").length;
    if (gesamt > 0 && unklar / gesamt > 0.30) {
      b.push({ code: "viele_unklare_zeilen", hilft: "modell",
        text: `${unklar} von ${gesamt} Zeilen konnten nicht zugeordnet werden.` });
    }
    /* v3.2, korrigiert nach dem Testlauf vom 25.08.2026 (research_id 28-31):
       Dieser Befund war als "modell" eingestuft und hat dreimal eine Eskalation
       ausgeloest, die das Ergebnis VERSCHLECHTERT hat.
       Der Grund ist fachlich, nicht technisch: sind ALLE Zutatenzeilen unklar,
       ist der Text meistens gar keine Zutatenliste, sondern Fliesstext. Beim
       gemessenen Fall war die Quelle ein Magazin-Artikel. Opus hat daraus fuenf
       Rezeptvorschlaege ("Avocado-Mango-Salat mit Kichererbsen") als Zutaten
       eingesammelt, Haiku hatte zurueckhaltend zwei Zeilen als unklar markiert
       und dafuer den Eiweisswert sauber gelesen.
       Ein staerkeres Modell holt aus einer Seite ohne Zutatenliste keine
       Zutatenliste - es holt mehr Text. Also: hilft = quelle.
       Zusaetzlich die Untergrenze: bei einer einzigen Zutatenzeile ist das
       kein Muster, sondern ein Einzelfall. Lauf 175 hatte 3 % unklare Zeilen
       und wurde allein wegen dieser einen Zeile eskaliert. */
    if (gesamt > 0 && zutatenZeilen >= 2 && zutatenZeilen === unklar) {
      b.push({ code: "nur_unklare_zutaten", hilft: "quelle",
        text: "Jede gelesene Zutatenzeile ist unklar - der Text ist vermutlich gar keine Zutatenliste. Eine andere Adresse hilft, ein anderes Modell nicht." });
    }
  } catch (_e) {
    /* Eine gescheiterte Pruefung darf den Lesevorgang nicht kippen. */
  }
  return b;
}

/* ------------------------------------------------------------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const antwort = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return antwort({ error: "Bitte anmelden." }, 401);

    let body: any = {}; try { body = await req.json(); } catch {}
    const url = String(body.url ?? "").trim();
    const productId = String(body.product_id ?? "").trim();
    const sourceKind = String(body.source_kind ?? "herstellerseite").trim();
    const auftrag = String(body.auftrag ?? "").trim(); // welches Produkt ist gemeint
    const modell = String(body.modell ?? STANDARD_MODELL).trim();
    const maxUnterseiten = Math.min(Math.max(Number(body.max_unterseiten ?? 3), 0), 5);

    if (!/^https?:\/\//i.test(url)) return antwort({ error: "Bitte eine gueltige URL (mit https://) angeben." }, 400);
    if (!productId) return antwort({ error: "product_id fehlt. Der Extraktionsvertrag verlangt sie — ohne Produkt gibt es keinen Ablageort." }, 400);
    if (!PREISE[modell]) return antwort({ error: "Unbekanntes Modell: " + modell }, 400);

    const limit: any = await sb.rpc("cb_riki_etikett_limit_check").then((r: any) => Array.isArray(r.data) ? r.data[0] : r.data);
    if (limit?.erlaubt !== true) return antwort({ error: limit?.grund ?? "Limit erreicht." }, 429);

    let host = ""; try { host = new URL(url).host; } catch (_e) { host = "?"; }

    // --- Seite holen ------------------------------------------------------
    let html = "";
    try {
      const c = new AbortController(); const id = setTimeout(() => c.abort(), 12000);
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html" }, signal: c.signal, redirect: "follow" });
      clearTimeout(id);
      if (!r.ok) {
        await sb.rpc("cb_riki_retrieval_attempt_speichern", {
          p_product_id: productId, p_source_family: sourceKind, p_retrieval_kind: "product_page",
          p_attempt_status: "not_reachable", p_source_ref: url, p_detail: "HTTP " + r.status, p_evidence: { host, http_status: r.status },
        });
        return antwort({ leer: true, grund: "not_reachable", detail: "HTTP " + r.status, quelle_url: url });
      }
      html = await r.text();
    } catch (e) {
      await sb.rpc("cb_riki_retrieval_attempt_speichern", {
        p_product_id: productId, p_source_family: sourceKind, p_retrieval_kind: "product_page",
        p_attempt_status: "not_reachable", p_source_ref: url, p_detail: "Fetch fehlgeschlagen", p_evidence: { host, error: String((e as any)?.message ?? e).slice(0, 300) },
      });
      return antwort({ leer: true, grund: "not_reachable", detail: String((e as any)?.message ?? e).slice(0, 200), quelle_url: url });
    }

    const text = htmlZuText(html);
    const strukturiert = jsonLdBloecke(html);
    let unter: UnterErgebnis = { text: "", attempted: [], successful: [], verworfen_fremd: [] };

    /* v2 / Work #228: Ausloeser fragt nach INHALT, nicht nach Stichwoertern.
       Der Grund wird mitprotokolliert - beim naechsten Fall soll man nachsehen
       koennen, warum nachgeladen wurde oder eben nicht, statt zu raten. */
    const gruende: string[] = [];
    if (text.length < 600) gruende.push("text_kurz");
    if (!hatZutatenListe(text)) gruende.push("keine_zutatenliste");
    if (!hatNaehrwertZahlen(text)) gruende.push("keine_naehrwertzahlen");
    if (verweistAufUnterseite(text)) gruende.push("verweist_auf_unterseite");
    if (maxUnterseiten > 0 && gruende.length > 0) {
      unter = await unterseitenText(html, url, maxUnterseiten);
    }

    const gesamt = text.length + strukturiert.length + unter.text.length;
    const hatWas = /nährwert|naehrwert|kcal|energie|zutaten|inhaltsstoffe|zusammensetzung|dosierung|verzehr|gtin|nutrition|ingredient/i.test(text + strukturiert + unter.text);
    if (gesamt < 400 || !hatWas) {
      await sb.rpc("cb_riki_retrieval_attempt_speichern", {
        p_product_id: productId, p_source_family: sourceKind, p_retrieval_kind: "product_page",
        p_attempt_status: "empty", p_source_ref: url, p_detail: "Keine verwertbaren Produktdaten im Serverabruf",
        p_evidence: { host, static_chars: text.length, embedded_chars: strukturiert.length, linked_chars: unter.text.length, linked_attempted: unter.attempted, linked_grunde: gruende, linked_verworfen_fremd: unter.verworfen_fremd },
      });
      return antwort({ leer: true, grund: "empty", quelle_url: url,
        hinweis: "Die Seite liefert im Serverabruf keine verwertbaren Produktdaten (vermutlich erst im Browser aufgebaut).",
        unterseiten: unter.attempted, unterseiten_gruende: gruende });
    }

    // --- Lesen ------------------------------------------------------------
    const key = findeKey();
    if (!key) return antwort({ error: "Kein Anthropic-Key hinterlegt." }, 500);

    const t0 = Date.now();
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        max_tokens: 8000,
        // Phase G: derselbe Text muss dieselbe Struktur ergeben. Opus 5 lehnt
        // den Parameter ab, deshalb wird er dort weggelassen statt den ganzen
        // Aufruf scheitern zu lassen (gemessen 25.08.2026, vier Fehlversuche).
        ...(OHNE_TEMPERATURE.has(modell) ? {} : { temperature: 0 }),
        system: [{ type: "text", text: EXTRACTOR_REGEL, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content:
          `AUFTRAG — gemeintes Produkt: ${auftrag || "(nicht naeher benannt; nimm das Produkt, das diese Seite fuehrt)"}\n` +
          `QUELLE: ${url}\n\nQUELLTEXT:\n${fokus(text)}${strukturiert}${unter.text}` }],
      }),
    });
    const j = await ai.json();

    const usage: any = j?.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;

    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "quelle-lesen", p_modell: modell, p_in: 0, p_out: 0, p_kosten: 0, p_produkt_id: productId, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return antwort({ error: "Modellaufruf fehlgeschlagen.", detail: JSON.stringify(j).slice(0, 300) }, 502);
    }

    const txt = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let payload: any = null;
    try { const m = txt.match(/\{[\s\S]*\}/); payload = JSON.parse(m ? m[0] : txt); } catch { /* unten behandelt */ }

    await sb.rpc("cb_riki_buchen", { p_modus: "quelle-lesen", p_modell: modell, p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)), p_produkt_id: productId, p_erfolg: !!payload, p_fehler: payload ? null : "kein JSON" });
    if (!payload) return antwort({ error: "Der Extractor hat kein verwertbares JSON geliefert." }, 502);

    // --- In den gemeinsamen Vertrag schreiben -----------------------------
    const aufbau = baueVertrag(payload, url);
    if (!aufbau.items.length) {
      return antwort({ leer: true, grund: "keine_items", quelle_url: url,
        hinweis: "Der Extractor hat die Seite gelesen, aber keinen einzigen belegten Eintrag gefunden.",
        source: payload?.source ?? null,
        qualitaet: { geprueft: true, eskalation_empfohlen: true, hilft: "quelle",
                     befunde: [{ code: "keine_items", hilft: "quelle",
                                 text: "Kein einziger belegter Eintrag - andere Adresse noetig." }] } });
    }

    /* v3: Qualitaetsbefund erheben. Nur melden, nicht entscheiden. */
    const befunde = qualitaetsbefund(payload, aufbau, fokus(text) + strukturiert + unter.text);
    /* QUELLENMANGEL SCHLAEGT MODELLMANGEL. Traegt die Seite die Daten nicht,
       sind unklare Zeilen die FOLGE davon, nicht die Ursache. Ein staerkeres
       Modell liest dasselbe Nichts und kostet nur mehr.
       Der Test test-modelleskalation.js hat genau diesen Fehler gefunden:
       der LaVita-Fall meldete "keine Zutaten" UND "viele unklare Zeilen" -
       und waere ohne diese Regel auf Opus eskaliert. */
    const hilftQuelle = befunde.some((x) => x.hilft === "quelle");
    const qualitaet = {
      geprueft: true,
      eskalation_empfohlen: befunde.length > 0,
      hilft: befunde.length === 0 ? null : (hilftQuelle ? "quelle" : "modell"),
      befunde,
    };

    /* Z5d (Ralph-Entscheid 29.08.2026, Variante A): der Laufstatus wird aus den
       Abschnitten abgeleitet, nicht mehr fest auf "captured" gesetzt.
       Ein Lauf ist abgeschlossen, wenn ALLE Abschnitte auf 'complete' oder
       'not_applicable' stehen. Ist wenigstens ein Abschnitt gelesen, aber nicht
       alle fertig, ist der Lauf 'partial'. Wurde nichts fertig gelesen, bleibt
       er 'captured'. Der Status entsteht weiter an genau einer Stelle: hier,
       im Aufrufer von cb_riki_source_extraction_speichern.
       Am 29.08.2026 gemessen: von 77 haengenden Laeufen erfuellen 9 diese Regel. */
    const abschnitte = (aufbau.sections ?? []).map((s: any) => String(s?.status ?? ""));
    const alleFertig = abschnitte.length > 0 &&
      abschnitte.every((s) => s === "complete" || s === "not_applicable");
    const etwasGelesen = abschnitte.some((s) => s === "complete" || s === "partial");
    const laufStatus = alleFertig ? "complete" : (etwasGelesen ? "partial" : "captured");

    const gespeichert = await sb.rpc("cb_riki_source_extraction_speichern", {
      p_product_id: productId,
      p_source_kind: sourceKind,
      p_source_ref: url,
      p_sections: aufbau.sections,
      p_items: aufbau.items,
      p_status: laufStatus,
      p_metadata: {
        contract_version: CONTRACT,
        edge_function: "riki-quelle-lesen",
        edge_version: EDGE_VERSION,
        modell,
        temperature: OHNE_TEMPERATURE.has(modell) ? null : 0,
        host,
        identitaet_der_quelle: payload?.source ?? {},
        zutaten_rohtext: payload?.ingredients_raw_text ?? null,
        dosierung: payload?.dosage ?? {},
        explizite_abwesenheit: payload?.explicit_absence ?? [],
        source_coverage: payload?.source_coverage ?? {},
        abruf: { static_chars: text.length, embedded_chars: strukturiert.length,
                 linked_attempted: unter.attempted, linked_successful: unter.successful,
                 linked_grunde: gruende, linked_verworfen_fremd: unter.verworfen_fremd },
        qualitaet,
      },
    });
    if (gespeichert.error) return antwort({ error: "Befund gelesen, aber nicht speicherbar: " + gespeichert.error.message, quelle_url: url }, 500);

    const runId = Number(gespeichert.data);

    return antwort({
      ok: true,
      run_id: runId,
      quelle_url: url,
      source_kind: sourceKind,
      identitaet_der_quelle: payload?.source ?? {},
      dosierung: payload?.dosage ?? {},
      explizite_abwesenheit: payload?.explicit_absence ?? [],
      source_coverage: payload?.source_coverage ?? {},
      zaehler: aufbau.zaehler,
      qualitaet,
      unterseiten: { versucht: unter.attempted, gelesen: unter.successful,
                     gruende: gruende, verworfen_fremd: unter.verworfen_fremd },
      hinweis: "Ein Befund aus EINER Quelle. Kein Vergleich, keine Identitaetsentscheidung, keine Produktfelder veraendert.",
      meta: { modell, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0, edge_version: EDGE_VERSION },
    });
  } catch (e) {
    return antwort({ error: String(e) }, 500);
  }
});
