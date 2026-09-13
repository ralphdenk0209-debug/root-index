// riki-herstellerseite — Nährwerte + Zutaten + VERZEHREMPFEHLUNG + EAN von einer Produktseite lesen.
// URL rein -> Server holt die Seite (Browser-Kennung) -> Text extrahieren -> Riki liest.
// GRUNDSATZ: NICHTS ERFINDEN. Was nicht dasteht, bleibt null. Riki schlägt vor, Mensch prüft.
// JS-Seiten liefern nur eine leere Hülle -> ehrlich melden, Screenshot-Fallback im Frontend.
// 18.07.2026: verzehrempfehlung + form + ean ergänzt.
// 21.07.2026 (v5): ZUSATZSTOFFE-Extraktion + Fleisch/Wurst-Kompound-Regeln ergänzt (aus riki-analyse).
//   Zusätze aus den Klammern von Wurst/Schinken/Käse MÜSSEN mit E-Nummern nach zusatzstoffe -
//   sonst blieb die Zusatzstoff-Achse fälschlich "keine". Schema um e_nummern erweitert.
// 28.07.2026 (v10): WIRKSTOFFE PRO TAGESDOSIS (Ralphs Fall NORSAN: "Omega-3 Fettsäuren 2,0 g,
//   davon EPA 1040 mg, davon DPA 120 mg, davon DHA 600 mg" - das Schema hatte KEIN Wirkstoff-Feld,
//   die Dosis-Tabelle blieb leer). Neues additives Feld wirkstoffe (Tagesdosis, inkl. Fettsäuren/
//   davon-Zeilen); Server-Filter bereinigeWirk (IU verworfen, nie umgerechnet).
// 28.07.2026 (v9): MIKRONÄHRSTOFFE JE 100 g (Ralphs Fall: Bad-Reichenhaller-Seite mit Jod/Fluorid/
//   Folsäure-Tabelle — das Schema hatte GAR KEIN Feld dafür, die Werte konnten nie ankommen).
//   Neues additives Feld mikronaehrstoffe_100g, NUR aus der 100-g/100-ml-Spalte, nie hochgerechnet.
// 29.07.2026 (v11, Ralph: "riki schafft es nicht, die daten zu lesen" — LaVita-Fall): DREI LESE-HILFEN.
//   Befund: shop.lavita.com verlinkt Zutaten/Nährwerte nur auf Unterseiten, kein JSON-LD, Rest per JS.
//   (1) JSON-LD (schema.org) wird VOR dem Script-Strippen eingesammelt — viele Shops tragen dort
//       Name/GTIN/Nährwerte, htmlZuText warf das bisher weg.
//   (2) UNTERSEITEN-FOLGE: verlinkte "Zutaten"/"Nährwert"/"Inhaltsstoffe"-Seiten (gleiche Domain,
//       max. 2, je 8 s) werden mitgelesen — der LaVita-Fall.
//   (3) LEER-PROTOKOLL: Leer-/Fehlschlag-Fälle landen jetzt in Riki_Nutzung (erfolg=false, Grund+Host)
//       — vorher waren sie unsichtbar, das Protokoll zeigte nur Erfolge. Grundlage für die
//       wöchentliche Riki-Lese-Optimierer-Aufgabe.
// v13 (30.07.2026, Ralph-Go): BIO-KENNZEICHNUNG als eigenes Feld "bio" (true|false|null). Speist
//   Produkte.Bio ueber cb_produkt_bio_setzen (Quelle "Herstellerseite"). Bio gibt KEINE Punkte.
// v12 (29.07.2026, Ralph-Go Gleichlauf-Regel): Kategorie-Liste 23->24 (neu: Desserts & Süßspeisen).
//   Alles additiv und je in try/catch — schlägt eine Hilfe fehl, arbeitet der alte Weg unverändert.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}

const REGEL = `Du bist RIKI, die Lese-KI von Root Index. Du bekommst den TEXT einer Hersteller-Produktseite.
AUFGABE: Auslesen (1) NÄHRWERTE je 100 g/ml, (2) ZUTATENLISTE, (3) VERZEHREMPFEHLUNG, (4) EAN falls ausgewiesen, (5) ZUSATZSTOFFE, (6) MIKRONÄHRSTOFFE je 100 g, (7) WIRKSTOFFE pro Tagesdosis, (8) BIO-KENNZEICHNUNG.
OBERSTE REGEL: NICHTS ERFINDEN. Was nicht klar dasteht, gib als null zurück. Nicht aus Wissen ergänzen.
Der Text kann Navigation, Werbung und andere Produkte enthalten - nimm NUR die Angaben zu DIESEM Produkt.
Abschnitte "STRUKTURIERTE DATEN (JSON-LD)" und "UNTERSEITE ..." gehören zur selben Produktseite und sind gleichwertige Quellen.
Nimm die 100-g-Spalte, nicht Portionswerte. kJ ist ~4,184x kcal - gib kcal, nicht kJ.

=== BEZUG: 100 g ODER 100 ml ===
Setze "bezug" darauf, was in der Naehrwerttabelle der Seite ueber der Naehrwertspalte steht:
- steht dort "je 100 ml" / "pro 100 ml" / "per 100 ml"  -> "bezug":"100ml"
- steht dort "je 100 g" / "pro 100 g" / "per 100 g"     -> "bezug":"100g"
- steht beides oder nichts Eindeutiges                   -> "bezug":null
RATE NICHT nach Produktart. Ein Getraenk kann "je 100 g" deklariert sein.
Nur was dort steht, zaehlt. Im Zweifel null.

=== KATEGORIE: NUR AUS DIESER LISTE ===
"kategorie_vorschlag" MUSS exakt einer dieser 24 Werte sein - Schreibweise genau so:
Backen | Brot & Backwaren | Brotaufstrich | Desserts & Süßspeisen | Energy-Gel | Fertigprodukte | Fleisch & Fisch |
Getränk | Getreide & Beilagen | Milchprodukte & Eier | Nüsse & Hülsenfrüchte |
Obst & Gemüse | Öle & Fette | Proteinpulver | Riegel | Snacks | Supplement |
Süßungsmittel | Süßwaren | Tofu & Fleischalternativen | Würzen & Saucen | Salze |
Lebensmittel | Sonstiges
ERFINDE KEINE neue Kategorie und fasse keine zusammen. Passt nichts davon eindeutig,
setze "kategorie_vorschlag": null - dann waehlt der Mensch. Ein falscher Wert ist
schlimmer als keiner, weil die Kategorie die Naehrwert-Bewertung steuert.
Hinweise: reines Speise-/Wuerzsalz -> "Salze". Wasser und alle Getraenke -> "Getränk".
Backzutaten wie Backpulver oder Aroma -> "Backen". Verzehrfertige Puddings, Grütze,
Milchreis, Mousse, Dessertcremes -> "Desserts & Süßspeisen". Passt sonst nichts -> "Lebensmittel".

=== BIO / ÖKO (streng!) ===
Setze "bio":true NUR, wenn die Seite das Produkt ausdruecklich als oekologisch erzeugt auslobt:
EU-Bio-Logo, "Bio", "Öko", "aus biologischem Anbau", "aus kontrolliert biologischem Anbau",
eine Öko-Kontrollstellennummer (DE-ÖKO-xxx, AT-BIO-xxx) oder ein Bio-Verband (Demeter, Bioland,
Naturland). Auch die Zutatenliste zaehlt, wenn dort Zutaten als "bio"/"aus biologischem Anbau"
gekennzeichnet sind.
- Ein Marken- oder Produktname allein ist KEIN Beleg. "dmBio" im Namen zaehlt nicht.
  "Prebiotic", "Biotin", "Bionade" enthalten zwar die Buchstaben bio, sagen aber nichts ueber
  die Erzeugung - dann null.
- Sagt die Seite ausdruecklich, dass es KEIN Bio-Produkt ist -> false. Das ist selten.
- Steht nichts davon da -> null. null heisst "nicht geprueft", NICHT "kein Bio".
Im Zweifel null. Eine falsche Bio-Angabe ist schlimmer als keine.
KEIN WIDERSPRUCH ZUR BEWERTUNG: Bio aendert die Zutaten-Stufe NICHT (Bio-Zucker bleibt 2).
Dieses Feld ist eine reine Kennzeichnung, keine Note.

VERZEHREMPFEHLUNG (oft unter "Dosierung", "Empfohlene Verwendung", "Herstellerempfehlung", "Anwendung"):
- Gib die empfohlene TAGESMENGE knapp und wörtlich wieder, z. B. "2 Kapseln pro Tag", "1 Portion = 6 g (1 Messlöffel)".
- Nennt die Seite eine SPANNE ("1-2 Kapseln taeglich"), gib die Spanne an - runde NICHT auf einen Wert.
- Steht die Menge je Kapsel statt je Tagesdosis, vermerke das, z. B. "1-2 Kapseln pro Tag (Werte je 1 Kapsel)".
- Keine Angabe: null. Rate NICHT aus der Packungsgroesse.
- form: "Kapseln", "Tabletten", "Pulver", "Tropfen", "Spray" o. ae., sonst null.

EAN (streng!): NUR übernehmen, wenn die Seite eine Ziffernfolge ausdruecklich als EAN, GTIN, Barcode oder
Strichcode bezeichnet (in JSON-LD auch "gtin13"/"gtin8"/"gtin"). 8 oder 13 Ziffern. Artikelnummer, SKU, Bestellnummer, Hersteller-Nr. und ASIN sind
KEINE EAN - dann null. Im Zweifel null. Eine falsche EAN ist schlimmer als keine.

=== WIRKSTOFFE PRO TAGESDOSIS (Supplements - SEHR WICHTIG, NICHT ÜBERSEHEN) ===
Supplement-Seiten führen eine Tabelle "Nährstoffe / Zusammensetzung pro Tagesportion/Tagesdosis", z. B.:
Vitamin D 20 µg (400 %) | Omega-3 Fettsäuren: 2,0 g | - davon EPA 1040 mg | - davon DPA 120 mg | - davon DHA 600 mg.
-> Gib JEDE Zeile dieser Tabelle im Feld "wirkstoffe" zurück - AUCH Fettsäuren (Omega-3, EPA, DHA, DPA, ALA),
   Aminosäuren, Pflanzenstoffe, Kreatin, Coenzym Q10 usw. NICHT nur Vitamine und Mineralstoffe.
-> "davon"-Zeilen als EIGENE Einträge mit führendem "davon " im Namen ("davon EPA").
-> Mengen exakt wie angegeben, Einheit exakt "g" | "mg" | "µg". NICHT umrechnen, NICHT aufsummieren.
-> nrv_prozent NUR, wenn die Seite einen %-Referenzwert nennt (z. B. 400) - Fußnoten wie
   "* kein Referenzwert vorhanden" bedeuten null.
-> Das sind PORTIONS-/TAGESWERTE - sie gehören NICHT in mikronaehrstoffe_100g.
-> Keine solche Tabelle vorhanden: leeres Array [].

=== MIKRONÄHRSTOFFE JE 100 g (Vitamine/Mineralstoffe - SEHR WICHTIG bei Salzen, Wasser, angereicherten Produkten) ===
Manche Seiten fuehren eine eigene Tabelle "Vitamine und Mineralstoffe" mit Spalten wie
"pro 100 g" und "pro Portion (2 g)", z. B.: Jod 2 000 µg (1 333 %) | Fluorid 31 mg | Folsäure 10 000 µg.
-> Gib diese Werte im Feld "mikronaehrstoffe_100g" zurueck - AUSSCHLIESSLICH aus der 100-g/100-ml-Spalte.
-> Gibt es NUR Portionswerte: leeres Array []. Rechne NIEMALS von der Portion auf 100 g hoch.
-> Je Eintrag: deutscher Naehrstoffname ("Jod", "Fluorid", "Folsäure", "Selen", "Vitamin C", "Magnesium", "Calcium" ...),
   Menge als Zahl, Einheit exakt "mg" | "µg" | "g". Prozentangaben (%NRV, Referenzmenge) NICHT uebernehmen.
-> Das ist NICHT die Naehrwerttabelle: kcal/Fett/Eiweiss/Salz gehoeren weiter nach naehrwerte_100g.
-> Keine Menge ohne klare 100-g-Angabe. Nichts erfinden. Keine Tabelle vorhanden: leeres Array [].

BEWERTUNG je Zutat = VERARBEITUNGSGRAD (nicht Gesundheit): 10=roh, 9=mechanisch/gekeimt, 8=Vollrohstoff gemahlen (Vollkornmehl, Honig, Magermilch), 6-7=teilentfernt (Type-Mehl, natives Öl, Meersalz), 4-5=isoliert (Auszugsmehl, raffiniertes Öl, Sirup, Protein-Isolat, Speisesalz, Aroma), 2-3=raffinierte Fraktion (Zucker, Glukosesirup, Maltodextrin, Stärke). Bio ändert nichts. Extrakt/Isolat/Sirup=niedrig.
ABER: Eine nackte Prozentangabe ("55%", "(80 %)") ist die MENGE im Produkt (QUID), keine Wirkstoff-Standardisierung - für die Stufe ignorieren. Lebensmittel-"Extrakte", die nur ausgepresster/eingekochter Rohstoff sind (Kokosnussextrakt = Kokosmilch-Basis = 8, Tomatenmark = 6, Saft aus Konzentrat = 5), gehören auf die normale Staffel, nicht auf die Supplement-Extrakt-Staffel.

VERARBEITETES/GEPÖKELTES FLEISCH ist NICHT roh - niemals 10:
- Gepökeltes Vollmuskel-Fleisch (Kochschinken, Hinterschinken, Kasseler, Bacon, Rohschinken/Serrano) = 5, kritisch=true.
- Gereifte Rohwurst (Salami, Pepperoni, Cervelat, Chorizo, Mettwurst, Nduja) = 4, kritisch=true.
- Die Wurst/der Schinken bleibt EINE Zutat (5/4), AUCH wenn ihre Sub-Zutaten in Klammern stehen. Die Fleisch-Teile (Schweinefleisch, Speck) NICHT einzeln listen. Nur die ZUSÄTZE aus der Klammer (Natriumnitrit, Phosphate ...) nach zusatzstoffe ziehen.

ZUSATZSTOFFE (SEHR WICHTIG - NICHT ÜBERSEHEN):
- Erkenne Zusatzstoffe als E-Nummer (E250) UND im Klartext ("Antioxidationsmittel (Ascorbinsäure)", "Stabilisator (Natriumnitrit)", "Farbstoff (Carotin)", "Säuerungsmittel (Citronensäure)", "Emulgator (Soja-Lecithin)").
- Verschachtelte Wurst/Schinken/Käse-Zutaten tragen ihre Zusätze IN KLAMMERN. Diese Zusätze (z.B. Natriumnitrit E250, Natriumascorbat E301, Diphosphate E450, Triphosphate E451) MÜSSEN nach zusatzstoffe.e_nummern UND zusatzstoffe.text - sonst wird die Zusatzstoff-Achse fälschlich "keine". Übersieh sie nie.
- Gib zu jedem Zusatzstoff NAME und - wenn erkennbar - die E-Nummer an (Format "Natriumnitrit (E250)"). e_nummern ist die Liste der reinen E-Nummern (["E250","E301"]).
- suessstoffe=true bei künstlichen Süßstoffen (E950,E951,E954,E955). status "keine" NUR, wenn wirklich kein Zusatzstoff dasteht, sonst "enthalten" (oder "neutral", wenn alle unbedenklich).
ANTWORTE NUR MIT JSON: {"name":string|null,"marke":string|null,"kategorie_vorschlag":string|null,"bio":true|false|null,"verzehrempfehlung":string|null,"form":string|null,"ean":string|null,"bezug":"100g"|"100ml"|null,"naehrwerte_100g":{"kcal":number|null,"protein":number|null,"kh":number|null,"zucker":number|null,"fett":number|null,"ges_fett":number|null,"ballaststoffe":number|null,"salz":number|null},"zutaten":[{"name":string,"rating":1-10,"kritisch":boolean,"begruendung":string}],"wirkstoffe":[{"name":string,"menge":number,"einheit":"g"|"mg"|"µg","nrv_prozent":number|null}],"mikronaehrstoffe_100g":[{"name":string,"menge":number,"einheit":"mg"|"µg"|"g"}],"zusatzstoffe":{"text":string,"e_nummern":string[],"status":"keine"|"neutral"|"enthalten","suessstoffe":boolean},"gefunden":boolean}`;

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

function fokus(text: string): string {
  const low = text.toLowerCase();
  const teile: string[] = [];
  const fenster = (pos: number, vor: number, len: number) => text.slice(Math.max(0, pos - vor), Math.max(0, pos - vor) + len);
  const a = low.search(/nährwert|naehrwert|zutaten|inhaltsstoffe|vitamine|mineralstoffe/);
  teile.push(a < 0 ? text.slice(0, 9000) : fenster(a, 2500, 9000));
  const b = low.search(/dosierung|verzehrempfehlung|empfohlene verwendung|herstellerempfehlung|anwendungshinweis|verzehrmenge|einnahme/);
  if (b >= 0) teile.push("\n--- DOSIERUNG ---\n" + fenster(b, 300, 2500));
  const c = low.search(/\bean\b|gtin|barcode|strichcode/);
  if (c >= 0) teile.push("\n--- KENNZEICHNUNG ---\n" + fenster(c, 200, 700));
  return teile.join("\n");
}

/* v11: JSON-LD-Blöcke VOR dem Script-Strippen einsammeln. Viele Shops tragen dort
   schema.org-Produktdaten (Name, GTIN, teils Nährwerte) - htmlZuText warf sie bisher weg.
   Nur Blöcke mit Produkt-Bezug, je gekappt; scheitert die Suche, kommt "" zurück. */
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

/* v11: Unterseiten-Folge (der LaVita-Fall). Manche Hersteller verlinken Zutatenliste und
   Nährwerttabelle nur auf eigene Unterseiten - die Hauptseite bleibt leer. Wir folgen
   max. 2 Links derselben Domain, deren Text/Adresse nach Zutaten/Nährwerten klingt,
   je 8 s Zeitfenster. Scheitert etwas, kommt "" zurück - der alte Weg bleibt unberührt. */
type UnterseitenErgebnis = { text: string; attempted: string[]; successful: string[] };
async function unterseitenText(html: string, basisUrl: string): Promise<UnterseitenErgebnis> {
  try {
    const basis = new URL(basisUrl);
    const links: string[] = [];
    const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && links.length < 2) {
      const kandidat = (m[1] ?? "") + " " + (m[2] ?? "").replace(/<[^>]+>/g, " ");
      if (!/zutat|inhaltsstoffe|n(ä|ae)hrwert/i.test(kandidat)) continue;
      try {
        const u = new URL(m[1], basis);
        if (u.host !== basis.host) continue;
        if (u.href.split("#")[0] === basis.href.split("#")[0]) continue;
        if (!links.includes(u.href)) links.push(u.href);
      } catch (_e) { /* kaputter Link - ignorieren */ }
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
        if (t.length > 200) {
          successful.push(l);
          out += "\n--- UNTERSEITE " + l + " ---\n" + fokus(t);
        }
      } catch (_e) { /* Unterseite nicht erreichbar - weiter */ }
    }
    return { text: out, attempted, successful };
  } catch (_e) { return { text: "", attempted: [], successful: [] }; }
}

function pruefe(v: any): { warnungen: string[]; score_erlaubt: boolean } {
  const w: string[] = [];
  const n = v?.naehrwerte_100g ?? {};
  const z = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : null);
  const kcal = z(n.kcal), prot = z(n.protein), kh = z(n.kh), fett = z(n.fett), ball = z(n.ballaststoffe), zuck = z(n.zucker), gesf = z(n.ges_fett);
  const fehlt: string[] = [];
  if (kcal === null) fehlt.push("Kalorien");
  if (prot === null) fehlt.push("Eiweiß");
  if (kh === null) fehlt.push("Kohlenhydrate");
  if (fett === null) fehlt.push("Fett");
  if (fehlt.length) { w.push(`Auf der Seite nicht gefunden: ${fehlt.join(", ")}.`); return { warnungen: w, score_erlaubt: false }; }
  const ber = 4 * prot! + 4 * kh! + 9 * fett! + 2 * (ball ?? 0);
  const abw = Math.abs(kcal! - ber);
  if (kcal! > 0 && abw > 20 && abw / kcal! > 0.30) w.push(`Kalorien (${Math.round(kcal!)}) passen nicht zu den Nährwerten (rechnerisch ${Math.round(ber)}).`);
  if (zuck !== null && zuck > kh! + 0.5) w.push(`Zucker (${zuck} g) > Kohlenhydrate (${kh} g) — unmöglich.`);
  if (gesf !== null && gesf > fett! + 0.5) w.push("Gesättigtes Fett > Gesamtfett — unmöglich.");
  return { warnungen: w, score_erlaubt: w.length === 0 };
}

/* bezug normalisieren: was das Modell schreibt, ist ungeprueft. Erlaubt sind genau zwei
   Werte, alles andere wird zu null - "wir wissen es nicht" ist eine gueltige Antwort und
   besser als ein falscher Beleg. Bewusst KEINE Ableitung aus der Produktart. */
/* bio normalisieren (v13): erlaubt sind genau true, false und null. Alles andere - auch
   Strings wie "ja" in einer anderen Sprache oder Objekte - wird zu null. "Wir wissen es
   nicht" ist eine gueltige Antwort und besser als ein falscher Beleg. Bewusst KEINE
   Ableitung aus Marken- oder Produktnamen: genau daran scheitert die Namensregel
   ("Prebiotic" enthaelt "bio"). */
function normBio(v){
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "ja") return true;
    if (t === "false" || t === "nein") return false;
  }
  return null;
}
function normBezug(v){
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) v = v[0];
  if (typeof v === "object") return null;
  const t = String(v).toLowerCase().replace(/\s+/g, "");
  if (t.includes("/")) return null;                 /* "100g/ml" sagt nichts aus */
  if (/^(100g|je100g|pro100g|per100g|g)$/.test(t)) return "100g";
  if (/^(100ml|je100ml|pro100ml|per100ml|ml)$/.test(t)) return "100ml";
  return null;
}

/* Mikronaehrstoffe je 100 g saeubern (28.07.2026, v9): nur Name + positive Menge + bekannte Einheit.
   IU und unbekannte Einheiten werden VERWORFEN statt umgerechnet - lieber ein fehlender Wert als ein
   falscher. NICHTS ergaenzen: was Riki nicht gelesen hat, bleibt weg. Das Modell ist ungeprueft -
   dieser Filter ist die Verteidigung des Servers, das Frontend prueft zusaetzlich. */
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

/* Wirkstoffe pro Tagesdosis säubern (v10): Name + positive Menge + bekannte Einheit.
   IU/IE werden VERWORFEN statt umgerechnet. nrv_prozent nur als endliche Zahl >= 0, sonst null. */
function bereinigeWirk(list: any[]): any[] {
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
    let nrv: number | null = Number(x?.nrv_prozent);
    if (!isFinite(nrv as number) || (nrv as number) < 0) nrv = null;
    const k = name.toLowerCase();
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    out.push({ name, menge, einheit, nrv_prozent: nrv });
  }
  return out;
}

function eanOk(roh: unknown): string | null {
  const s = String(roh ?? "").replace(/\D/g, "");
  if (s.length !== 8 && s.length !== 13) return null;
  const zif = s.split("").map(Number);
  const pruef = zif.pop()!;
  let summe = 0;
  zif.reverse().forEach((d, i) => { summe += d * (i % 2 === 0 ? 3 : 1); });
  return ((10 - (summe % 10)) % 10) === pruef ? s : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Bitte anmelden." }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

    let body: any = {}; try { body = await req.json(); } catch {}
    const url = String(body.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) return new Response(JSON.stringify({ error: "Bitte eine gültige URL (mit https://) angeben." }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

    /* v11: Leer-/Fehlschlag-Fälle protokollieren - vorher unsichtbar (Protokoll zeigte nur Erfolge).
       Grundlage für die wöchentliche Riki-Lese-Optimierer-Aufgabe. Bucht 0 Kosten. */
    /* v21 / Work #228: product_id ist optional fuer Rueckwaertskompatibilitaet.
       Wenn sie mitkommt, muss sie echt sein: keine stille Nicht-Persistenz. */
    const productIdRaw = String(body.product_id ?? "").trim();
    const productId = productIdRaw || null;
    let initialNext: any = null;
    if (productId) {
      const chk = await sb.rpc("cb_riki_naechster_quellenweg", { p_product_id: productId });
      if (chk.error) return new Response(JSON.stringify({ error: "Unbekannte/ungueltige product_id: " + chk.error.message }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      initialNext = chk.data ?? null;
    }

    const attempt = async (kind: "product_page"|"embedded_structured"|"linked_manufacturer_data", status: "success"|"empty"|"not_reachable"|"ambiguous"|"not_found"|"error", ref?: string|null, detail?: string|null, evidence: any = {}) => {
      if (!productId) return null;
      const r = await sb.rpc("cb_riki_retrieval_attempt_speichern", {
        p_product_id: productId, p_source_family: "hersteller", p_retrieval_kind: kind,
        p_attempt_status: status, p_source_ref: ref ?? null, p_detail: detail ?? null,
        p_evidence: evidence ?? {},
      });
      if (r.error) console.warn("[riki-herstellerseite v21] retrieval attempt nicht speicherbar", kind, r.error.message);
      return r.data ?? null;
    };
    const nextPath = async () => {
      if (!productId) return null;
      const r = await sb.rpc("cb_riki_naechster_quellenweg", { p_product_id: productId });
      if (r.error) { console.warn("[riki-herstellerseite v21] Quellenleiter nicht lesbar", r.error.message); return null; }
      return r.data ?? null;
    };
    const sourceState = async (status: "eindeutig"|"nicht_gefunden"|"mehrdeutig"|"nicht_lesbar", note: string, evidence: any = {}) => {
      if (!productId) return null;
      const r = await sb.rpc("cb_riki_quelle_status_setzen", {
        p_product_id: productId, p_source_kind: "herstellerseite", p_discovery_status: status,
        p_source_ref: url, p_candidates: [], p_note: note, p_evidence: evidence ?? {},
      });
      if (r.error) console.warn("[riki-herstellerseite v21] Quellenstatus nicht speicherbar", r.error.message);
      return r.data ?? null;
    };

    let host = ""; try { host = new URL(url).host; } catch (_e) { host = "?"; }
    const logLeer = async (grund: string) => {
      try { await sb.rpc("cb_riki_buchen", { p_modus: "herstellerseite", p_modell: "claude-haiku-4-5-20251001", p_in: 0, p_out: 0, p_kosten: 0, p_produkt_id: productId, p_erfolg: false, p_fehler: ("leer: " + host + " — " + grund).slice(0, 400) }); } catch (_e) {}
    };

    const { data: limitRaw, error: limitErr } = await sb.rpc("cb_riki_etikett_limit_check");
    if (limitErr) return new Response(JSON.stringify({ error: "Limit-Prüfung fehlgeschlagen: " + limitErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    const limit: any = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;
    if (limit?.erlaubt !== true) return new Response(JSON.stringify({ error: limit?.grund ?? "Limit erreicht." }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });

    let html = "";
    try {
      const c = new AbortController(); const id = setTimeout(() => c.abort(), 12000);
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html" }, signal: c.signal, redirect: "follow" });
      clearTimeout(id);
      if (!r.ok) {
        await attempt("product_page", "not_reachable", url, "HTTP " + r.status, { http_status: r.status, host });
        await sourceState("nicht_lesbar", "Herstellerseite antwortete HTTP " + r.status + ". Zugriffsschutz wird nicht umgangen.", { http_status: r.status, host });
        const next = await nextPath();
        await logLeer("HTTP " + r.status);
        return new Response(JSON.stringify({ error: `Seite antwortete ${r.status}.`, leer: true, quelle_url: url, retrieval_meta: { product_id: productId, product_page: "not_reachable", next } }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }
      html = await r.text();
      await attempt("product_page", "success", r.url || url, "HTTP " + r.status, { http_status: r.status, host, bytes: html.length });
    } catch (e) {
      await attempt("product_page", "not_reachable", url, "Fetch fehlgeschlagen", { host, error: String((e as any)?.message ?? e).slice(0,300) });
      await sourceState("nicht_lesbar", "Herstellerseite nicht erreichbar.", { host, error: String((e as any)?.message ?? e).slice(0,300) });
      const next = await nextPath();
      await logLeer("nicht erreichbar");
      return new Response(JSON.stringify({ error: "Seite nicht erreichbar: " + String((e as any)?.message ?? e), leer: true, quelle_url: url, retrieval_meta: { product_id: productId, product_page: "not_reachable", next } }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const text = htmlZuText(html);
    const strukturiert = jsonLdBloecke(html);
    await attempt("embedded_structured", strukturiert ? "success" : "empty", url,
      strukturiert ? "JSON-LD/embedded Produktdaten gefunden" : "Keine verwertbaren eingebetteten strukturierten Produktdaten",
      { chars: strukturiert.length });
    /* v11: Unterseiten mitlesen, wenn der Haupttext dünn ist ODER keine Zutaten nennt (LaVita-Fall). */
    let unter = "";
    let unterMeta: UnterseitenErgebnis = { text: "", attempted: [], successful: [] };
    if (text.length < 400 || !/zutaten|inhaltsstoffe/i.test(text) || !/nährwert|naehrwert|kcal/i.test(text)) {
      unterMeta = await unterseitenText(html, url);
      unter = unterMeta.text;
    }
    await attempt("linked_manufacturer_data", unterMeta.successful.length ? "success" : (unterMeta.attempted.length ? "empty" : "not_found"),
      unterMeta.successful[0] || unterMeta.attempted[0] || url,
      unterMeta.successful.length ? "Verlinkte Hersteller-Unterseite mit Produktdaten gelesen" : (unterMeta.attempted.length ? "Verlinkte Hersteller-Unterseiten ohne verwertbare Produktdaten" : "Keine passende Hersteller-Unterseite/API/PDF verlinkt"),
      { attempted: unterMeta.attempted, successful: unterMeta.successful });
    const gesamtHatWas = /nährwert|naehrwert|kcal|energie|zutaten|dosierung|verzehr|einnahme|gtin|nutrition|ingredient/i.test(text + strukturiert + unter);
    if ((text.length + strukturiert.length + unter.length) < 400 || !gesamtHatWas) {
      await sourceState("nicht_lesbar", "Herstellerseite liefert im Server-Abruf keine verwertbaren Produktdaten.", { host, static_chars: text.length, embedded_chars: strukturiert.length, linked_chars: unter.length });
      const next = await nextPath();
      await logLeer("JS-Hülle/keine Daten (auch JSON-LD und Unterseiten leer)");
      return new Response(JSON.stringify({ leer: true, quelle_url: url,
        hinweis: "Im Hersteller-Abruf stehen keine verwertbaren Produktdaten. Die Quellenleiter entscheidet serverseitig den naechsten Weg; das Etikett ist erst Backup.",
        retrieval_meta: { product_id: productId, initial_next: initialNext, product_page: "success", embedded_structured: strukturiert ? "success" : "empty", linked_manufacturer_data: unterMeta.successful.length ? "success" : (unterMeta.attempted.length ? "empty" : "not_found"), next } }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const key = findeKey();
    if (!key) return new Response(JSON.stringify({ error: "Kein Anthropic-Key." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    const modell = "claude-haiku-4-5-20251001";
    const t0 = Date.now();
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modell, max_tokens: 2500,
        system: [{ type: "text", text: REGEL, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `Produktseite: ${url}\n\nSEITENTEXT:\n${fokus(text)}${strukturiert}${unter}` }] }),
    });
    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "herstellerseite", p_modell: modell, p_in: 0, p_out: 0, p_kosten: 0, p_produkt_id: productId, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki konnte die Seite nicht lesen." }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const txt = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let vorschlag: any = null; try { const m = txt.match(/\{[\s\S]*\}/); vorschlag = JSON.parse(m ? m[0] : txt); } catch {}

    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell]; const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;
    await sb.rpc("cb_riki_buchen", { p_modus: "herstellerseite", p_modell: modell, p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)), p_produkt_id: productId, p_erfolg: true, p_fehler: null });

    if (!vorschlag) return new Response(JSON.stringify({ error: "Riki hat kein verwertbares Ergebnis geliefert." }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });

    const eanRoh = vorschlag.ean;
    vorschlag.ean = eanOk(eanRoh);
    const eanVerworfen = !!(eanRoh && !vorschlag.ean);

    const hatInhalt = !!(vorschlag.zutaten?.length || vorschlag.naehrwerte_100g || vorschlag.verzehrempfehlung);
    if (vorschlag.gefunden === false || !hatInhalt) {
      await sourceState("nicht_gefunden", "Auf der erreichbaren Seite waren keine eindeutigen Angaben zu diesem Produkt zu finden.", { host });
      const next = await nextPath();
      await logLeer("Riki fand keine eindeutigen Produktangaben");
      return new Response(JSON.stringify({ leer: true, quelle_url: url, hinweis: "Auf der Seite waren keine eindeutigen Angaben zu DIESEM Produkt zu finden.", retrieval_meta: { product_id: productId, next } }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const check = pruefe(vorschlag);
    if (eanVerworfen) check.warnungen.push("Eine gefundene Ziffernfolge war keine gültige EAN (Prüfziffer) – verworfen, Feld bleibt leer.");
    try { if (vorschlag && typeof vorschlag === "object") vorschlag.bezug = normBezug(vorschlag.bezug); } catch (_e) {}
    try { if (vorschlag && typeof vorschlag === "object") vorschlag.bio = normBio(vorschlag.bio); } catch (_e) { vorschlag.bio = null; }
    try { if (vorschlag && typeof vorschlag === "object") vorschlag.mikronaehrstoffe_100g = bereinigeMikro100(vorschlag.mikronaehrstoffe_100g ?? []); } catch (_e) { vorschlag.mikronaehrstoffe_100g = []; }
    try { if (vorschlag && typeof vorschlag === "object") vorschlag.wirkstoffe = bereinigeWirk(vorschlag.wirkstoffe ?? []); } catch (_e) { vorschlag.wirkstoffe = []; }


    /* v21: Erfolgreicher Herstellerbefund landet, falls product_id bekannt ist,
       direkt im gemeinsamen source_extraction-Vertrag. Der Browser muss nichts
       in sections/items umformen. */
    let sourceRunId: number | null = null;
    if (productId) {
      const pr = await sb.rpc("cb_riki_feldpayload_extraction_speichern", {
        p_product_id: productId, p_source_kind: "herstellerseite", p_source_ref: url,
        p_payload: vorschlag, p_status: "captured",
        p_metadata: { edge_function: "riki-herstellerseite", edge_version: 21, retrieval: { host, embedded_chars: strukturiert.length, linked_attempted: unterMeta.attempted, linked_successful: unterMeta.successful } },
      });
      if (pr.error) return new Response(JSON.stringify({ error: "Herstellerbefund gelesen, aber source_extraction konnte nicht gespeichert werden: " + pr.error.message, quelle_url: url }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
      sourceRunId = Number(pr.data);
    }
    const next = await nextPath();

    return new Response(JSON.stringify({
      vorschlag, warnungen: check.warnungen, score_erlaubt: check.score_erlaubt,
      quelle_url: url,
      hinweis: "Von Riki aus der Herstellerseite gelesen – VORSCHLAG. Gegen das Etikett prüfen, bevor du freigibst.",
      source_run_id: sourceRunId,
      retrieval_meta: { product_id: productId, initial_next: initialNext, product_page: "success", embedded_structured: strukturiert ? "success" : "empty", linked_manufacturer_data: unterMeta.successful.length ? "success" : (unterMeta.attempted.length ? "empty" : "not_found"), next },
      meta: { modell, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0, edge_version: 21 },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
