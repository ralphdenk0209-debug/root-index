// RIKI-ETIKETT — der Ausweg aus der Sackgasse.
//
// 18.08.2026 v25 WELLE 1 (#120), Ralph-Entscheid: base_ingredient OHNE Bio-Vorsilbe,
//   wortgleich zu riki-analyse. parenthetical_items als string[]|null statt [{text}].
//   Ohne "ignored": gleiche Werteliste wie riki-analyse.
//   Grund: fuer denselben Extraktionsvertrag darf es nur EINE Struktur geben.
//   Die Spuren-/Allergenregel wird hier BEWUSST NICHT wiederholt. Sie steht in
//   riki-analyse als zentrale Konstante HINWEIS_REGEL; eine zweite Fassung hier
//   waere eine Pflegekopie (§4.2). riki-etikett liest Fotos, nicht Rohtext — der
//   gemessene Befund (P1593, P1532, P1391) trat ausschliesslich im Modus
//   "rohtext" auf. Es gibt keinen gemessenen Anlass, hier etwas zu aendern.
//
// v24 (2026-08-16, Work #78, Ralph-Go 16.08.): ZUTATENZEILEN STRUKTURIEREN.
// Zutaten werden nicht mehr als unteilbarer Komplettstring fuer die Stammsuche behandelt.
// Grundzutat, Verarbeitung, explizite Attribute und Klammerrolle werden getrennt geliefert.
// Originaltext bleibt verlustfrei; unklare Klammern werden unresolved statt geraten.
// Bestehende Felder name/rating bleiben rueckwaertskompatibel erhalten.
//
// v22 (2026-08-15, Work #19): WIRKSTOFF-EINHEITEN STRIKT.
// Eine fehlende oder unbekannte Einheit wird verworfen, NIE still zu mg umgedeutet.
// FCC ist nicht IU; IU ist nicht mg. Alle übrigen Regeln bleiben unverändert.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

const CONTRACT_VERSION = "riki_source_extraction_item_v1";
const PAREN_ROLES = new Set(["processing", "composition", "explanation", "subingredients", "unresolved"]);

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  }
  return null;
}

const REGELWERK = `Du bist RIKI, die Etikett-Lese-KI von Root Index.

AUFGABE: Aus Fotos einer Lebensmittelverpackung die NÄHRWERTTABELLE, die ZUTATENLISTE und — bei Nahrungsergänzung/angereicherten Produkten — die WIRKSTOFF-MENGEN (Vitamine/Mineralstoffe mit mg/µg) auslesen. Zeigt das Etikett eine Vitamin-/Mineralstoff-Tabelle mit einer 100-g-Spalte, lies ZUSÄTZLICH die MIKRONÄHRSTOFFE JE 100 g aus.

OBERSTE REGEL: NICHTS ERFINDEN.
Was du nicht sicher LESEN kannst, gibst du als null zurück und setzt \"unsicher\": true.
Du ergänzt NICHTS aus Erfahrung, auch wenn du das Produkt zu kennen glaubst.
Ein fehlender Wert ist ehrlich. Ein geratener Wert ist eine Lüge, die wie ein Fakt aussieht.

=== MEHRSPRACHIGE VERPACKUNGEN — SEHR WICHTIG ===
Viele Verpackungen zeigen die Zutatenliste in MEHREREN SPRACHEN nebeneinander.
-> Erfasse die Zutaten GENAU EINMAL. Nimm die DEUTSCHE Liste.
-> Gibt es keine deutsche: nimm EINE andere Sprache und übersetze die Namen ins Deutsche.
-> Gib NIEMALS dieselbe Zutat in zwei Sprachen aus.
Die anderen Sprachen sind nur Gegenprobe. Bei unaufloesbarem Widerspruch: unsicher=true und warnungen.

=== WAS KEINE ZUTAT IST ===
NICHT als Zutat ausgeben: Herkunftsangaben, Werbetexte, Spurenhinweise, Lagerhinweise, Nährwertangaben, Siegel/Zertifikate.
Jede Zutat, die du ausgibst, MUSS ein rating zwischen 1 und 10 haben. Niemals null.
Wenn du eine Zutat nicht bewerten kannst, gib sie NICHT aus.

=== DAS FELD \"warnungen\" ===
\"warnungen\" ist KEIN Prüfprotokoll. Nur echte Probleme hinein; wenn alles stimmt: [].

=== DIE WICHTIGSTE FALLE: PORTION STATT 100 g ===
Nährwerttabellen haben oft ZWEI Spalten. Du MUSST die 100-g-Spalte nehmen. Steht NUR Portion da: nicht umrechnen, naehrwerte_100g=null, nur_portionswerte=true.

=== BEZUG: 100 g ODER 100 ml ===
Setze \"bezug\" exakt nach sichtbarer Spaltenueberschrift: \"100g\" | \"100ml\" | null. Nicht nach Produktart raten.

=== KATEGORIE: NUR AUS DIESER LISTE ===
\"kategorie_vorschlag\" MUSS exakt einer dieser Werte sein:
Backen | Brot & Backwaren | Brotaufstrich | Desserts & Süßspeisen | Energy-Gel | Fertigprodukte | Fleisch & Fisch | Getränk | Getreide & Beilagen | Milchprodukte & Eier | Nüsse & Hülsenfrüchte | Obst & Gemüse | Öle & Fette | Proteinpulver | Riegel | Snacks | Supplement | Süßungsmittel | Süßwaren | Tofu & Fleischalternativen | Würzen & Saucen | Salze | Lebensmittel | Sonstiges
Passt nichts eindeutig: null.

=== BIO / ÖKO (streng!) ===
Setze bio=true NUR bei sichtbarem Beleg fuer oekologische Erzeugung. Markenname allein ist kein Beleg. Fehlt Beleg oder ist unklar: null. Bio aendert die Verarbeitungsnote nicht.

=== ZUTATEN: VOLLSTÄNDIG, ABER STRUKTURIERT — WORK #78 ===
Alle Zutaten laut Etikett, auch Farbstoffe, Süßstoffe, Säuerungsmittel, Aromen. Deutsches Dezimalkomma ist kein Trenner.

WICHTIG: Der sichtbare Kompletttext einer Zutatenzeile ist NICHT automatisch der Stammname.
Fuer JEDE Zutat lieferst du zusaetzlich zur bisherigen Anzeige folgende Struktur:
- original_text: sichtbarer Zutatenwortlaut VERLUSTFREI, inklusive Klammern, Sternchen und Mengenangaben.
- name: rueckwaertskompatible sichtbare Bezeichnung; darf dem original_text entsprechen.
- base_ingredient: der Name, mit dem die Zutat im Stamm GESUCHT wird - ohne Verarbeitung,
  ohne Klammer, ohne Prozentangabe, und OHNE die Vorsilbe \"Bio-\"/\"Bio \": Bio ist ein MERKMAL
  und gehoert nach attributes {\"bio\":true}, nicht in die Identitaet. \"Bio-Kuhmilch\" sucht als
  \"Kuhmilch\" mit bio:true. Der Originaltext behaelt das Bio selbstverstaendlich.
  base_ingredient ist ein Suchbegriff, KEINE Zuordnung: ob es diese Zutat im Stamm gibt,
  entscheidest nicht du. NICHT in eine Canonical-ID umwandeln.
- processing_modifiers: Array nur explizit sichtbarer Verarbeitungsschritte, z.B. pasteurisiert, homogenisiert, geroestet, getrocknet, kaltgepresst.
- attributes: Objekt nur fuer explizit sichtbare Eigenschaften, z.B. {\"fettarm\":true,\"bio\":true}. Nichts aus Produktwissen ergaenzen.
- parenthetical_role: GENAU einer von processing | composition | explanation | subingredients | unresolved, wenn Klammerinhalt vorhanden ist; sonst null.
- parenthetical_items: Array der originalen sichtbaren Klammerbestandteile als reine Strings, z.B. [\"Hefen\",\"Milchsäurebakterien\"]. KEINE Objekte. Ohne Klammer: null.
- extraction_status: extracted | unresolved | needs_review.
  extracted     du hast die Zeile sicher gelesen
  unresolved    du kannst sie nicht sicher zuordnen - Begruendung in note
  needs_review  du hast sie gelesen, aber die Aufteilung ist unsicher

DIE KLAMMERROLLE MUSS VOR EINER AUFSPALTUNG BESTIMMT WERDEN:
1. processing: Klammer nennt nur Verarbeitung/Eigenschaften der Grundzutat.
   Beispiel: \"Bio-Kuhmilch (pasteurisiert, homogenisiert, fettarm)\"
   => base_ingredient=\"Kuhmilch\" (OHNE die Bio-Vorsilbe); processing_modifiers=[\"pasteurisiert\",\"homogenisiert\"]; attributes={\"fettarm\":true,\"bio\":true}; parenthetical_role=\"processing\".
2. composition oder explanation: Klammer erklaert, woraus die benannte Zutat/Kultur besteht, OHNE daraus automatisch weitere Produktzutaten zu machen.
   Beispiel: \"Kefir-Kulturen (Hefen, Milchsäurebakterien)\"
   => base_ingredient=\"Kefir-Kulturen\"; parenthetical_role=\"composition\"; parenthetical_items=[\"Hefen\",\"Milchsäurebakterien\"].
   WICHTIG: Das bleibt EINE Produktzutat. Die Klammeritems sind KEINE automatischen Produktzutaten.
3. subingredients: Nur wenn die Quelle eine echte zusammengesetzte Zutat mit Unterzutaten deklariert, z.B. \"Pesto (Basilikum, Öl, Salz)\". Unterzutaten strukturieren, aber NICHT automatisch persistieren.
4. explanation: reine Erlaeuterung/Synonym/Funktionsbeschreibung, die keine neue Produktzutat erzeugt.
5. Wenn die Rolle nicht sicher aus dem sichtbaren Wortlaut bestimmbar ist: parenthetical_role=\"unresolved\", extraction_status=\"unresolved\". NICHT RATEN.

Der Komplettstring darf NIEMALS als Empfehlung fuer eine neue Stammzutat interpretiert werden, wenn base_ingredient sauber abtrennbar ist.
Funktionsbezeichnungen wie \"Emulgator\", \"Antioxidationsmittel\", \"Säuerungsmittel\" sind keine neue Stoffidentitaet; Stoff und Rolle trennen.

=== BEWERTUNG: NUR DER VERARBEITUNGSGRAD ===
10 = roh; 9 = rein mechanisch/gekeimt; 8 = vollstaendiger Rohstoff gemahlen/getrocknet; 6-7 = teilweise entfernt/nativ; 4-5 = industriell isoliert; 2-3 = raffiniert/isolierte Fraktion.
Vollwert-Pulver=8; Ganzpflanzen-Extrakt ohne %-Standardisierung=5; standardisierter Extrakt=4; hochreines Isolat=2; isolierte Mikronaehrstoffe und freie Aminosaeuren=3; Aroma: natuerlich=5, unspezifiziert=4, kuenstlich=3.
Bewerte den STOFF, nicht seine Funktionsrolle. Bio aendert die Note nicht.

=== ZUSATZSTOFFE ===
Erkenne E-Nummer und Klartext. kritisch=true bei Azo-Farbstoffen E102/E104/E110/E122/E124/E129, E250, E407, E950/E951/E954/E955, E450/E451. Aromen sind keine Zusatzstoffe.

=== WIRKSTOFF-MENGEN ===
Je Stoff Name, Menge, Einheit mg|µg|g|IU und falls sichtbar nrv. Nichts umrechnen. FCC ist nicht IU; IU ist nicht mg; g ist nicht mg. Keine Menge => kein Wirkstoffeintrag.

=== MIKRONÄHRSTOFFE JE 100 g ===
Nur sichtbare 100-g/100-ml-Spalte; nie aus Portion hochrechnen. Je Eintrag Name, Menge, Einheit mg|µg|g.

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  \"name\": string|null,
  \"marke\": string|null,
  \"kategorie_vorschlag\": string|null,
  \"bio\":true|false|null,
  \"bezug\": \"100g\"|\"100ml\"|null,
  \"nur_portionswerte\": boolean,
  \"portion_g\": number|null,
  \"etikett_sprachen\": string[],
  \"naehrwerte_100g\": { \"kcal\": number|null, \"protein\": number|null, \"kh\": number|null, \"zucker\": number|null, \"fett\": number|null, \"ges_fett\": number|null, \"ballaststoffe\": number|null, \"salz\": number|null },
  \"zutaten\": [ {
    \"name\": string,
    \"original_text\": string,
    \"base_ingredient\": string|null,
    \"processing_modifiers\": string[],
    \"attributes\": object,
    \"parenthetical_role\": \"processing\"|\"composition\"|\"explanation\"|\"subingredients\"|\"unresolved\"|null,
    \"parenthetical_items\": string[]|null,
    \"extraction_status\": \"extracted\"|\"unresolved\"|\"needs_review\",
    \"anteil_prozent\": number|null,
    \"rating\": 1-10,
    \"kritisch\": boolean,
    \"begruendung\": string
  } ],
  \"wirkstoffe\": [ { \"name\": string, \"menge\": number, \"einheit\": \"mg\"|\"µg\"|\"g\"|\"IU\", \"nrv\": number|null } ],
  \"mikronaehrstoffe_100g\": [ { \"name\": string, \"menge\": number, \"einheit\": \"mg\"|\"µg\"|\"g\" } ],
  \"zusatzstoffe\": { \"text\": string, \"e_nummern\": string[], \"status\": \"keine\"|\"neutral\"|\"enthalten\", \"suessstoffe\": boolean },
  \"warnungen\": string[],
  \"unsicher\": boolean,
  \"unsicher_warum\": string|null
}`;

const FREMD = /(seeds?|sprouted|salt|flour|sugar|oil|wheat|water|graine|germé|sel |farine|huile|sucre|semi|semilla|aceite|sale |zucchero|olio)/i;
const DEUTSCH = /(saaten|sprossen|kerne|salz|mehl|zucker|öl|wasser|weizen|dinkel|hafer|milch|samen|körner|flöckchen)/i;

function normTextArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function normAttributes(v: any): Record<string, any> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    const key = String(k).trim();
    if (!key) continue;
    if (typeof val === "boolean" || typeof val === "string" || typeof val === "number") out[key] = val;
  }
  return out;
}

// v25 / Welle 1 · EINE VERTRAGSFORM (§4.2): parenthetical_items ist string[]|null —
// wortgleich zu riki-analyse, das dieselbe Struktur seit v9 so ausgibt. Zwei
// Strukturen fuer denselben Extraktionsvertrag waeren eine zweite Kopie derselben
// Regel; das Frontend haette je Quelle eine andere Form zu lesen.
// BEIDE Eingabeformen werden vertragen: das Modell liefert uebergangsweise noch
// {"text": "..."}-Objekte, wenn es aus dem Gedaechtnis antwortet statt aus dem Prompt.
// Nichts da -> null, nicht []: ein leeres Array behauptet "geprueft, keine Klammer",
// null sagt "keine Angabe". Der Unterschied ist der ganze Sinn des Feldes.
function normParentheticalItems(v: any): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const x of v) {
    const text = typeof x === "string" ? x.trim() : String(x?.text ?? "").trim();
    if (text) out.push(text);
  }
  return out.length ? out : null;
}

function strukturZutat(x: any): any {
  const name = String(x?.name ?? "").trim();
  const originalText = String(x?.original_text ?? name).trim();
  let base = String(x?.base_ingredient ?? "").trim() || null;
  const modifiers = normTextArray(x?.processing_modifiers);
  const attributes = normAttributes(x?.attributes);
  const pitems = normParentheticalItems(x?.parenthetical_items);
  let role: string | null = x?.parenthetical_role == null ? null : String(x.parenthetical_role).trim().toLowerCase();
  if (role !== null && !PAREN_ROLES.has(role)) role = "unresolved";
  const hatKlammer = /\([^)]*\)/.test(originalText);
  if (hatKlammer && role === null) role = "unresolved";
  let extractionStatus = String(x?.extraction_status ?? "extracted").trim().toLowerCase();
  // WELLE 1: "ignored" bewusst nicht aufgenommen — dieselbe Werteliste wie in
  // riki-analyse. Zwei Prompts fuer denselben Strukturvertrag duerfen nicht
  // verschiedene Werte kennen (§4.2).
  if (!new Set(["extracted", "unresolved", "needs_review"]).has(extractionStatus)) extractionStatus = "needs_review";
  if (role === "unresolved") extractionStatus = "unresolved";
  if (!base) {
    // Kein eigener Parser: nur bei komplett fehlender Modellstruktur ehrlich unresolved.
    // Damit wird der Komplettstring niemals still als bindbare Stammzutat ausgegeben.
    extractionStatus = "unresolved";
  }
  return {
    ...x,
    name,
    original_text: originalText,
    base_ingredient: base,
    processing_modifiers: modifiers,
    attributes,
    parenthetical_role: role,
    parenthetical_items: pitems,
    extraction_status: extractionStatus,
  };
}

function bereinigeZutaten(zut: any[]): { zutaten: any[]; warnungen: string[] } {
  const w: string[] = [];
  if (!Array.isArray(zut)) return { zutaten: [], warnungen: w };
  let z = zut.filter((x) => {
    const r = Number(x?.rating);
    return x?.name && isFinite(r) && r >= 1 && r <= 10;
  }).map(strukturZutat);
  const verworfen = zut.length - z.length;
  if (verworfen > 0) w.push(`${verworfen} Einträge waren keine echten Zutaten (z. B. Herkunftsangaben) und wurden weggelassen.`);
  const deutsche = z.filter((x) => DEUTSCH.test(String(x.name)));
  const fremde = z.filter((x) => !DEUTSCH.test(String(x.name)) && FREMD.test(String(x.name)));
  if (deutsche.length >= 2 && fremde.length >= 2) {
    w.push("Das Etikett ist mehrsprachig — die Zutatenliste stand offenbar mehrfach darauf. Wir haben nur die deutsche Fassung behalten. Bitte prüfen.");
    z = z.filter((x) => !fremde.includes(x));
  }
  const gesehen = new Set<string>();
  z = z.filter((x) => {
    const k = String(x.original_text || x.name).toLowerCase().trim();
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });
  return { zutaten: z, warnungen: w };
}

// Work #19: nur Einträge mit Name + positiver Menge + BELEGTER erlaubter Einheit.
function bereinigeWirkstoffe(wk: any[]): any[] {
  if (!Array.isArray(wk)) return [];
  const erlaubt = new Set(["mg", "µg", "g", "iu"]);
  const out: any[] = [];
  const gesehen = new Set<string>();
  for (const x of wk) {
    const name = String(x?.name ?? "").trim();
    const menge = Number(x?.menge);
    if (!name || !isFinite(menge) || menge <= 0) continue;
    let einheit = String(x?.einheit ?? "").trim().toLowerCase();
    if (einheit === "ug" || einheit === "mcg") einheit = "µg";
    if (!erlaubt.has(einheit)) continue;
    einheit = einheit === "iu" ? "IU" : einheit;
    const nrvRaw = Number(x?.nrv);
    const nrv = isFinite(nrvRaw) && nrvRaw >= 0 ? nrvRaw : null;
    const k = name.toLowerCase();
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    out.push({ name, menge, einheit, nrv });
  }
  return out;
}

function bereinigeMikro100(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  const out: any[] = [];
  const gesehen = new Set<string>();
  for (const x of list) {
    const name = String(x?.name ?? "").trim();
    const menge = Number(x?.menge);
    if (!name || !isFinite(menge) || menge <= 0) continue;
    let einheit = String(x?.einheit ?? "").trim().toLowerCase();
    if (einheit === "ug" || einheit === "mcg") einheit = "µg";
    if (einheit !== "mg" && einheit !== "µg" && einheit !== "g") continue;
    const k = name.toLowerCase();
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    out.push({ name, menge, einheit });
  }
  return out;
}

function istEchteWarnung(w: string): boolean {
  const s = String(w).toLowerCase();
  if (/(plausibel|akzeptabel|typisch|stimmt überein|in ordnung|unauffällig|konsistent|korrekt|passt|kein problem)/.test(s)) {
    return /(nicht lesbar|unmöglich|fehlt|verdeckt|unleserlich|nur portion|widerspr|abweichung von \d{2,})/.test(s);
  }
  return true;
}
function normBio(v: any){ if(v===true||v===false)return v; if(typeof v==="string"){const t=v.trim().toLowerCase();if(t==="true"||t==="ja")return true;if(t==="false"||t==="nein")return false;} return null; }
function normBezug(v: any){ if(v===null||v===undefined)return null;if(Array.isArray(v))v=v[0];if(typeof v==="object")return null;const t=String(v).toLowerCase().replace(/\s+/g,"");if(t.includes("/"))return null;if(/^(100g|je100g|pro100g|per100g|g)$/.test(t))return "100g";if(/^(100ml|je100ml|pro100ml|per100ml|ml)$/.test(t))return "100ml";return null; }

/* ============================================================================
   KV-488, Ralph-Entscheid 04.09.2026 (Variante C, Teil A): Zutatenbeleg

   Gemessen an Job 83 (Quark, P73692): kein Foto zeigte eine Zutatenliste,
   RIKI lieferte trotzdem "Magermilch, Saeuerungsmittel (Milchsaeurebakterien)"
   samt original_text - der Beleg war miterfunden. Das Produkt stand danach mit
   Score 90, "Sehr gut", 0 Warnungen und vollstaendig=true da.

   Ein Riegel auf original_text greift deshalb nicht. Was greift, ist eine
   ENGE Zweitfrage: nicht "lies die Zutaten", sondern "steht hier eine
   Zutatenliste, ja oder nein". Die Frage laesst dem Modell keinen Raum, eine
   Antwort zu bauen, und kostet rund einen halben Cent.

   Sagt die Zweitfrage nein, werden die Zutaten verworfen und der Score
   gesperrt. Nichts wird stillschweigend uebernommen (Kernvertrag B1).
   ========================================================================== */

async function etikettGegenprobe(
  inhalt: unknown[],
  key: string,
  modell: string,
): Promise<
  { antwort: "ja" | "nein" | "unklar"; marke: string | null; inTok: number; outTok: number }
> {
  // Beide Fragen in EINEM Aufruf: die Bilder tragen die Kosten, der Text kaum
  // etwas. Zwei Aufrufe waeren doppelt so teuer fuer denselben Nutzen.
  const frage = [
    ...inhalt,
    {
      type: "text",
      text:
        "Beantworte genau zwei Fragen zu diesen Fotos, ohne zu raten.\n" +
        "1. Steht auf einem der Fotos ein Zutatenverzeichnis - also eine Aufzaehlung " +
        "der Zutaten, meist nach dem Wort \"Zutaten\"? Eine Naehrwerttabelle ist KEIN " +
        "Zutatenverzeichnis. Ein Werbetext oder ein Rezept ist KEIN Zutatenverzeichnis.\n" +
        "2. Welcher Markenname steht auf der Vorderseite der Packung? Ein Bio-Siegel " +
        "oder ein Anbauverband wie Bioland ist KEINE Marke. Wenn du keinen Markennamen " +
        "sicher liest: UNBEKANNT.\n" +
        "Antworte in genau einer Zeile im Format: JA|Markenname  oder  NEIN|UNBEKANNT",
    },
  ];
  try {
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modell,
        max_tokens: 30,
        messages: [{ role: "user", content: frage }],
      }),
    });
    const j = await ai.json();
    if (!ai.ok) return { antwort: "unklar", marke: null, inTok: 0, outTok: 0 };
    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const roh = (j.content ?? []).filter((c: any) => c.type === "text")
      .map((c: any) => c.text).join("").trim();
    const [links, rechts] = roh.split("|").map((s: string) => (s ?? "").trim());
    const l = (links ?? "").toLowerCase();
    const antwort: "ja" | "nein" | "unklar" = /^ja\b/.test(l)
      ? "ja"
      : /^nein\b/.test(l)
      ? "nein"
      : "unklar";
    let marke: string | null = (rechts ?? "").trim();
    if (!marke || /^unbekannt$/i.test(marke) || marke.length > 60) marke = null;
    return { antwort, marke, inTok, outTok };
  } catch {
    // Faellt die Gegenprobe aus, wird nicht verworfen - aber auch nicht
    // stillschweigend freigegeben. Der Aufrufer behandelt "unklar".
    return { antwort: "unklar", marke: null, inTok: 0, outTok: 0 };
  }
}

/* Vergleich zweier Markenangaben. Nicht buchstabengenau: "EDEKA Bio" und
   "Edeka" sind dieselbe Marke, "EDEKA Bio" und "Milbona" nicht. */
function markeGleich(a: unknown, b: unknown): boolean {
  const norm = (x: unknown) =>
    String(x ?? "").toLowerCase()
      .replace(/[^a-zäöüß0-9 ]+/g, " ")
      .split(/\s+/).filter((w) => w && !SIEGEL.includes(w)).join(" ").trim();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return true; // fehlt eine Seite, gibt es keinen Widerspruch
  return na === nb || na.includes(nb) || nb.includes(na);
}

/* KV-488, zweiter Teil desselben Befunds: das Siegel ist nicht die Marke.

   Bei Job 83 stand als Marke "EDEKA Bio / Bioland". Bioland ist ein
   Anbauverband, EDEKA Bio eine Handelsmarke - die Packung war Milbona.
   Ein Siegel steht auf fast jeder Bio-Packung gross und farbig; das Modell
   greift danach, wenn es die Marke nicht sicher liest.

   Deshalb: bekannte Siegel und Verbaende werden als Marke abgewiesen. Die
   Marke wird dann leer statt falsch - eine leere Marke ist ehrlich, eine
   falsche wandert in die Identitaetspruefung und erzeugt Dubletten. */
const SIEGEL = [
  "bioland", "demeter", "naturland", "ecoland", "biokreis", "gaea",
  "eu-bio", "eu bio", "eg-oeko", "eg-öko", "oekotest", "ökotest",
  "fairtrade", "rainforest alliance", "utz", "msc", "asc", "gots",
  "v-label", "vegan", "vegetarisch", "ohne gentechnik", "gentechnikfrei",
  "regionalfenster", "qs", "ivo", "haccp", "ce",
  "bio", "oeko", "öko", "organic",
];

function markeIstSiegel(marke: unknown): string | null {
  const roh = String(marke ?? "").trim();
  if (!roh) return null;
  // Zuerst war hier ein zweiter Riegel: eine Aufzaehlung ist keine Marke, denn
  // eine Packung traegt genau eine. Gemessen am Bestand am 04.09. war er zu
  // scharf - 7.747 von 17.047 Marken enthalten ein Trennzeichen, und es sind
  // echte Doppelangaben aus dem Import ("Alnatura, Alnatura GmbH", "Edeka,
  // Gut & Guenstig", 15.114 Produkte). Der Riegel haette bei fast jeder zweiten
  // Marke angeschlagen. Deshalb wieder entfernt; die falsch gelesene Marke aus
  // Job 83 bleibt damit offen und steht als eigener Punkt im Work Item.
  const teile = roh.split(/[\/,;|]+/).map((t) => t.trim()).filter(Boolean);
  const echt = teile.filter((t) => {
    const n = t.toLowerCase().replace(/\s+/g, " ").trim();
    if (SIEGEL.includes(n)) return false;
    // "EDEKA Bio" -> "edeka" bleibt uebrig, das ist eine Marke. "Bio Bioland"
    // dagegen loest sich vollstaendig auf.
    const rest = n.split(/\s+/).filter((w) => !SIEGEL.includes(w)).join(" ").trim();
    return rest.length >= 2;
  });
  if (echt.length === 0) return roh;
  return null;
}

function pruefe(v: any): { warnungen: string[]; score_erlaubt: boolean } {
  const w: string[] = []; const n=v?.naehrwerte_100g??{}; const z=(x:unknown)=>(typeof x==="number"&&isFinite(x)?x:null);
  const kcal=z(n.kcal),prot=z(n.protein),kh=z(n.kh),fett=z(n.fett),gesf=z(n.ges_fett),ball=z(n.ballaststoffe),zuck=z(n.zucker);
  if(v?.nur_portionswerte===true){w.push("Auf dem Etikett stehen nur Portionswerte. Wir rechnen NICHT um — bitte die 100-g-Spalte fotografieren.");return{warnungen:w,score_erlaubt:false};}
  const fehlend:string[]=[]; if(kcal===null)fehlend.push("Kalorien");if(prot===null)fehlend.push("Eiweiß");if(kh===null)fehlend.push("Kohlenhydrate");if(fett===null)fehlend.push("Fett");
  if(fehlend.length){w.push(`Auf dem Foto nicht lesbar: ${fehlend.join(", ")}. Bitte die Nährwerttabelle noch einmal fotografieren — gern näher dran.`);return{warnungen:w,score_erlaubt:false};}
  const berechnet=4*prot!+4*kh!+9*fett!+2*(ball??0),abw=Math.abs(kcal!-berechnet);
  if(kcal!>0&&abw>20&&abw/kcal!>0.30)w.push(`Die Kalorienangabe (${Math.round(kcal!)}) passt nicht zu den Nährwerten — rechnerisch wären es ${Math.round(berechnet)}.`);
  if(zuck!==null&&zuck>kh!+0.5)w.push(`Zucker (${zuck} g) liegt über den Kohlenhydraten (${kh} g) — das ist unmöglich.`);
  if(gesf!==null&&gesf>fett!+0.5)w.push("Gesättigtes Fett liegt über dem Gesamtfett — das ist unmöglich.");
  if(prot!+kh!+fett!+(ball??0)>108)w.push("Die Summe der Nährwerte liegt über 100 g — das ist unmöglich.");
  const name=String(v?.name??"").toLowerCase();if(/(chips|flips|nachos|cracker)/.test(name)&&!/(wrap|tortilla|fladen)/.test(name)&&kcal!<300)w.push(`${Math.round(kcal!)} kcal für ein Knabber-Produkt — vermutlich die Portionsspalte.`);if(/(\böl\b|olivenöl|rapsöl)/.test(name)&&kcal!<700)w.push(`${Math.round(kcal!)} kcal für ein Öl — vermutlich ein Portionswert.`);
  return{warnungen:w,score_erlaubt:w.length===0};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const key = findeKey();
  if (!key) return new Response(JSON.stringify({ error: "Kein Anthropic-Key hinterlegt." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  let body:any={}; try{body=await req.json();}catch{body={};}
  const authHeader=req.headers.get("Authorization")??""; const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""; const istAutopilot=serviceKey!==""&&authHeader===`Bearer ${serviceKey}`;
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,istAutopilot?serviceKey:Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}}}); const modusName=istAutopilot?"etikett-auto":"etikett";
  try{
    let limit:any=null;
    if(!istAutopilot){const{data:u}=await sb.auth.getUser();if(!u?.user)return new Response(JSON.stringify({error:"Bitte anmelden, um Etiketten auszulesen."}),{status:401,headers:{...CORS,"Content-Type":"application/json"}});const{data:limitRaw,error:limitErr}=await sb.rpc("cb_riki_etikett_limit_check");if(limitErr)return new Response(JSON.stringify({error:"Limit-Prüfung fehlgeschlagen: "+limitErr.message}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});limit=Array.isArray(limitRaw)?limitRaw[0]:limitRaw;if(limit?.erlaubt!==true)return new Response(JSON.stringify({error:limit?.grund??"Limit erreicht.",heute_genutzt:limit?.heute_genutzt,limit_tag:limit?.limit_tag}),{status:429,headers:{...CORS,"Content-Type":"application/json"}});}
    const bilder:string[]=Array.isArray(body.bilder)?body.bilder.slice(0,3):[];if(!bilder.length)return new Response(JSON.stringify({error:"Keine Bilder übergeben."}),{status:400,headers:{...CORS,"Content-Type":"application/json"}});
    const inhalt:unknown[]=[];for(const b64 of bilder){const m=String(b64).match(/^data:(image\/[a-z]+);base64,(.+)$/);if(!m)continue;inhalt.push({type:"image",source:{type:"base64",media_type:m[1],data:m[2]}});}if(!inhalt.length)return new Response(JSON.stringify({error:"Bilder konnten nicht gelesen werden."}),{status:400,headers:{...CORS,"Content-Type":"application/json"}});
    inhalt.push({type:"text",text:"Lies aus diesen Etikettfotos die Nährwerttabelle (Spalte 'je 100 g'!), die Zutatenliste UND — falls vorhanden — die Wirkstoff-/Vitamin-Tabelle mit Mengen aus."+(body.ean?` Der Barcode lautet ${body.ean}.`:" Dieses Produkt hat keinen Barcode.")+" Zutaten nur einmal aus der deutschen Fassung. Strukturiere jede Zutatenzeile nach Work #78 in original_text, base_ingredient, processing_modifiers, attributes, parenthetical_role, parenthetical_items und extraction_status. Klammerinhalt erst nach seiner Rolle beurteilen; composition/explanation erzeugt keine weiteren Produktzutaten. Unklar => unresolved. Einheiten nie umdeuten."});
    const modell:string=body.modell??"claude-haiku-4-5-20251001";const t0=Date.now();
    const ai=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:modell,max_tokens:8000,system:[{type:"text",text:REGELWERK,cache_control:{type:"ephemeral"}}],messages:[{role:"user",content:inhalt}]})});
    const j=await ai.json();if(!ai.ok){await sb.rpc("cb_riki_buchen",{p_modus:modusName,p_modell:modell,p_in:0,p_out:0,p_kosten:0,p_produkt_id:null,p_erfolg:false,p_fehler:JSON.stringify(j).slice(0,400)});return new Response(JSON.stringify({error:"Riki konnte das Etikett nicht lesen."}),{status:502,headers:{...CORS,"Content-Type":"application/json"}});}
    const text=(j.content??[]).filter((c:any)=>c.type==="text").map((c:any)=>c.text).join("");let vorschlag:any=null;try{const m=text.match(/\{[\s\S]*\}/);vorschlag=JSON.parse(m?m[0]:text);}catch{vorschlag=null;}
    const usage:any=j.usage??{};const inTok=(usage.input_tokens??0)+(usage.cache_creation_input_tokens??0)+(usage.cache_read_input_tokens??0);const outTok=usage.output_tokens??0;const preis=PREISE[modell]??PREISE["claude-haiku-4-5-20251001"];const kosten=(inTok/1e6)*preis.in+(outTok/1e6)*preis.out;
    await sb.rpc("cb_riki_buchen",{p_modus:modusName,p_modell:modell,p_in:inTok,p_out:outTok,p_kosten:Number(kosten.toFixed(6)),p_produkt_id:null,p_erfolg:true,p_fehler:null});
    if(!vorschlag)return new Response(JSON.stringify({error:"Riki hat kein verwertbares Ergebnis geliefert."}),{status:502,headers:{...CORS,"Content-Type":"application/json"}});
    const clean=bereinigeZutaten(vorschlag.zutaten??[]);vorschlag.zutaten=clean.zutaten;vorschlag.wirkstoffe=bereinigeWirkstoffe(vorschlag.wirkstoffe??[]);try{vorschlag.mikronaehrstoffe_100g=bereinigeMikro100(vorschlag.mikronaehrstoffe_100g??[]);}catch{vorschlag.mikronaehrstoffe_100g=[];}
    /* KV-488: Zutatenbeleg. Nur fragen, wenn RIKI ueberhaupt Zutaten behauptet -
       ohne Behauptung gibt es nichts zu widerlegen und nichts zu bezahlen. */
    let belegAntwort: "ja" | "nein" | "unklar" | "nicht_gefragt" = "nicht_gefragt";
    let zutatenVerworfen = false;
    let markeWiderspruch: string | null = null;
    let gegenprobeMarke: string | null = null;
    if (Array.isArray(vorschlag.zutaten) && vorschlag.zutaten.length > 0) {
      const beleg = await etikettGegenprobe(inhalt, key, modell);
      belegAntwort = beleg.antwort;
      if (beleg.inTok || beleg.outTok) {
        const kb = (beleg.inTok / 1e6) * preis.in + (beleg.outTok / 1e6) * preis.out;
        await sb.rpc("cb_riki_buchen", { p_modus: modusName + "-beleg", p_modell: modell, p_in: beleg.inTok, p_out: beleg.outTok, p_kosten: Number(kb.toFixed(6)), p_produkt_id: null, p_erfolg: true, p_fehler: null });
      }
      if (beleg.antwort === "nein") {
        vorschlag.zutaten = [];
        vorschlag.zutaten_verworfen_grund = "Auf den Fotos steht kein Zutatenverzeichnis.";
        zutatenVerworfen = true;
      }
      /* KV-488: widersprechen sich Hauptlauf und Gegenprobe bei der Marke, ist
         keine der beiden belegt. Dann bleibt die Marke leer und beide Werte
         stehen im Hinweis - der Mensch entscheidet, nichts rutscht durch. */
      gegenprobeMarke = beleg.marke;
      if (beleg.marke && !markeGleich(vorschlag.marke, beleg.marke)) {
        markeWiderspruch = `${String(vorschlag.marke ?? "-")} / ${beleg.marke}`;
        vorschlag.marke_widerspruch = markeWiderspruch;
        vorschlag.marke = null;
      }
    }
    /* KV-488: Siegel oder Aufzaehlung ist keine Marke. Leer ist ehrlicher als falsch. */
    const markeVerdaechtig = markeIstSiegel(vorschlag.marke);
    if (markeVerdaechtig) { vorschlag.marke_verworfen = markeVerdaechtig; vorschlag.marke = null; }
    const check=pruefe(vorschlag);const rikiEcht=(vorschlag.warnungen??[]).filter(istEchteWarnung);const blocker=check.warnungen;const hinweise=[...clean.warnungen,...rikiEcht];let erlaubt=check.score_erlaubt;
    if (markeVerdaechtig) {
      hinweise.push(
        `"${markeVerdaechtig}" ist ein Siegel, keine Marke — bitte die Marke auf der Packung prüfen.` +
          (gegenprobeMarke ? ` Auf dem Foto gelesen: "${gegenprobeMarke}".` : ""),
      );
    }
    if (markeWiderspruch) {
      hinweise.push(`Zwei verschiedene Marken gelesen (${markeWiderspruch}). Wir zeigen keine, bis das geklärt ist.`);
    }
    if (zutatenVerworfen) {
      blocker.push("Auf den Fotos steht kein Zutatenverzeichnis. Die von Riki gelesenen Zutaten wurden deshalb verworfen — bitte die Zutatenliste fotografieren.");
      erlaubt = false;
    }
    try{vorschlag.bezug=normBezug(vorschlag.bezug);}catch{}try{vorschlag.bio=normBio(vorschlag.bio);}catch{vorschlag.bio=null;}
    return new Response(JSON.stringify({vorschlag,warnungen:blocker.length?blocker:hinweise,score_erlaubt:erlaubt,guete:erlaubt?"vorlaeufig":"zweifelhaft",hinweis:erlaubt?"Von Riki aus deinem Foto gelesen. Root Index hat dieses Produkt noch nicht geprüft.":"Die Angaben auf dem Foto sind unstimmig oder unvollständig. Wir zeigen keinen Score, bis das geklärt ist.",meta:{modell,kosten_usd:Number(kosten.toFixed(6)),dauer_ms:Date.now()-t0,heute_genutzt:istAutopilot?null:(limit?.heute_genutzt??0)+1,limit_tag:limit?.limit_tag??null,zutaten_bereinigt:clean.warnungen.length>0,zutatenbeleg:belegAntwort,zutaten_verworfen:zutatenVerworfen,marke_widerspruch:markeWiderspruch,contract_version:CONTRACT_VERSION,ingredient_structure_version:"work78_v1"}}),{headers:{...CORS,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{...CORS,"Content-Type":"application/json"}});}
});
