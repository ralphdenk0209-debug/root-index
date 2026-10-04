// hersteller-abgleich — I41, 29.09.2026 (Ralph "go").
// Liest Herstellerseiten KOSTENLOS (einfacher Abruf, keine KI) und vergleicht die
// Zutatenliste mit unserem Text. NUR MELDEN – schreibt nie in Produkte/Zutaten_Rohtext.
// Arbeitsliste: public.cb_hersteller_abgleich_holen(max), Ergebnis: public.cb_hersteller_abgleich_setzen(jsonb).
// Die Leselogik (htmlZuText .. zutatenFinden) ist eine Kopie aus quelle-abruf-einfach v5,
// mit Wortgrenze vor "Zutaten" (sonst greift "Backzutaten" im Seitenmenue).
// Aufruf: pg_cron ueber cb_edge_rufen (service_role) oder Admin.
// 04.10.2026 (Ralph jaja): Land je Produkt (aus EAN) -> Seitensprache; Zutaten auch FR/IT/EN/ES/NL;
// Naehrwerte je 100 g werden mitgelesen (JSON-LD oder Tabelle) und gemeldet. Weiterhin NUR MELDEN.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function htmlZuText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|td|tr|h[1-6]|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&shy;/gi, "")
    .replace(/\u00ad/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&auml;/gi, "ä").replace(/&ouml;/gi, "ö").replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/gi, "Ä").replace(/&Ouml;/gi, "Ö").replace(/&Uuml;/gi, "Ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Harte Bedingungen, nachgeschaerft am 04.09.: der erste Trockenlauf hielt
// Werbezeilen wie "Qualitaet & Zertifizierung" faelschlich fuer Zutatenlisten.
const VERBOTEN =
  /Qualit(ä|ae)t|Zertifiz|Versand|haltbar|Lieferzeit|Datenschutz|Impressum|Newsletter|Rezept|Warenkorb|Anmelden|Kontakt/i;

function istPlausibel(text) {
  const t = text.trim();
  if (t.length < 15 || t.length > 4000) return false;
  if (!/\s/.test(t)) return false;
  if (/!/.test(t)) return false;
  if (t === t.toUpperCase()) return false;
  if (VERBOTEN.test(t)) return false;
  const trenner = (t.match(/[,;]/g) ?? []).length;
  const prozentVorn = /^\s*\d{1,3}\s*%/.test(t);
  if (trenner >= 2) return true;
  if (trenner === 1 && t.length >= 25) return true;
  if (prozentVorn) return true;
  return false;
}

const ZUTATEN_WORT =
  "(?:Zutaten(?:verzeichnis|liste)?|Ingr(?:é|e)dients?|Ingredienti|Ingredientes|Ingredi(?:ë|e)nten)";

const ABBRUCH =
  "(?:N(?:ä|ae|Ä)hrwert|Durchschnittliche N|Allergene|Kann Spuren|Aufbewahrung|" +
  "Herkunft|Hinweis|Verzehrempfehlung|Zubereitung|Lagerung|Brennwert|Energie|" +
  "GTIN|Artikelnummer|Inhalt:|Bewertung|Weitere Informationen|" +
  "Valeurs nutritionnelles|Valori nutrizionali|Nutrition|Informaci(?:ó|o)n nutricional|Voedingswaarde|" +
  "Bei -|haltbar|Lieferzeit|Herkunftsland|Qualit(?:ä|ae)t)";

function ausJsonLd(html) {
  const bloecke = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const b of bloecke) {
    let daten;
    try {
      daten = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const stapel = [daten];
    while (stapel.length) {
      const k = stapel.pop();
      if (Array.isArray(k)) {
        stapel.push(...k);
        continue;
      }
      if (k && typeof k === "object") {
        for (const feld of ["ingredients", "recipeIngredient", "ingredientList"]) {
          const w = k[feld];
          if (typeof w === "string" && istPlausibel(w)) return w.trim();
          if (Array.isArray(w) && w.length) {
            const s = w.filter((x) => typeof x === "string").join(", ");
            if (istPlausibel(s)) return s.trim();
          }
        }
        stapel.push(...Object.values(k));
      }
    }
  }
  return null;
}

function ausText(text) {
  const muster = new RegExp(
    "(?<![A-Za-zÄÖÜäöüß])" + ZUTATEN_WORT + "\\s*[:\\n]\\s*([\\s\\S]{10,2500}?)" +
      "(?=\\n\\s*\\n|" + ABBRUCH + "|$)",
    "gi",
  );
  // I41: alle Fundstellen pruefen (die erste ist oft nur ein Reiter "Zutaten | Naehrwerte | Allergene");
  // Treffer, die mit Naehrwert/Allergen beginnen, sind Reiterbeschriftungen, keine Liste.
  for (const t of text.matchAll(muster)) {
    const k = t[1].trim();
    if (/^(N(ä|ae)hrwert|Allergen|Allergiker)/i.test(k)) continue;
    if (istPlausibel(k)) return k;
  }

  const zeilen = text.split("\n");
  for (let i = 0; i < zeilen.length - 1; i++) {
    if (new RegExp("^\\s*" + ZUTATEN_WORT + "\\s*:?\\s*$", "i").test(zeilen[i])) {
      const rest = zeilen.slice(i + 1, i + 6).join(" ").trim();
      const bis = rest.split(new RegExp(ABBRUCH, "i"))[0].trim();
      if (istPlausibel(bis)) return bis;
    }
  }
  return null;
}

// I41: Reiter-/Abschnittsbloecke mit id/class "zutaten"/"ingredients" (z. B. albi.de: <div id="zutaten"><p>…</p>)
function ausBlock(html) {
  const re = /<(?:div|section|p|li|dd|span)\b[^>]*(?:id|class)=["'][^"']*(?:zutaten|ingredients?)[^"']*["'][^>]*>([\s\S]{0,3000})/gi;
  for (const m of html.matchAll(re)) {
    const t = htmlZuText(m[1]).split(new RegExp(ABBRUCH, "i"))[0];
    for (const teil of t.split(/\n\s*\n|\n/)) {
      const k = teil.replace(/^\s*Zutaten(?:verzeichnis|liste)?\s*:?\s*/i, "").trim();
      if (k && istPlausibel(k)) return k;
    }
  }
  return null;
}

function zutatenFinden(html) {
  const f = zutatenFindenRoh(html);
  if (f) f.text = f.text.replace(new RegExp("^\\s*" + ZUTATEN_WORT + "\\s*:\\s*", "i"), "").trim();
  return f;
}
function zutatenFindenRoh(html) {
  const a = ausJsonLd(html);
  if (a) return { text: a, weg: "json-ld" };
  const c = ausBlock(html);
  if (c) return { text: c, weg: "block" };
  const b = ausText(htmlZuText(html));
  if (b) return { text: b, weg: "muster" };
  return null;
}

// 04.10.2026: Naehrwerte je 100 g. Erst JSON-LD (schema.org NutritionInformation), dann Text.
function zahl(s: string | undefined | null): number | null {
  if (s == null) return null;
  const m = String(s).replace(/\s/g, "").match(/<?(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}
function naehrwerteJsonLd(html: string): Record<string, number> | null {
  for (const b of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let d; try { d = JSON.parse(b[1].trim()); } catch { continue; }
    const st = [d];
    while (st.length) {
      const k = st.pop();
      if (Array.isArray(k)) { st.push(...k); continue; }
      if (k && typeof k === "object") {
        const n = (k as any).nutrition;
        if (n && typeof n === "object") {
          const o: Record<string, number> = {};
          const set = (key: string, v: unknown) => { const z = zahl(v as string); if (z != null) o[key] = z; };
          set("kcal", n.calories); set("fett", n.fatContent); set("ges_fett", n.saturatedFatContent);
          set("kh", n.carbohydrateContent); set("zucker", n.sugarContent); set("protein", n.proteinContent);
          set("ballaststoffe", n.fiberContent); set("salz", n.saltContent);
          if (o.salz == null && n.sodiumContent) { const na = zahl(n.sodiumContent); if (na != null) o.salz = Math.round(na * 2.5 * 1000) / 1000; }
          if (Object.keys(o).length >= 3) return o;
        }
        st.push(...Object.values(k));
      }
    }
  }
  return null;
}
const NW_MUSTER: [string, RegExp][] = [
  ["kcal", /(\d+(?:[.,]\d+)?)\s*kcal/i],
  ["ges_fett", /(?:davon\s+)?ges(?:ä|ae)ttigte\s+Fetts(?:ä|ae)uren|dont\s+acides\s+gras\s+satur(?:é|e)s|of\s+which\s+saturates|di\s+cui\s+(?:acidi\s+grassi\s+)?saturi/i],
  ["fett", /(?<![a-zäöü])(?:Fett|Mati(?:è|e)res\s+grasses|Fat|Grassi)(?![a-zäöü])/i],
  ["zucker", /(?:davon\s+)?Zucker|dont\s+sucres|of\s+which\s+sugars|di\s+cui\s+zuccheri/i],
  ["kh", /Kohlenhydrate|Glucides|Carbohydrate|Carboidrati/i],
  ["ballaststoffe", /Ballaststoffe|Fibres\s+alimentaires|Fibre|Fibre/i],
  ["protein", /Eiwei(?:ß|ss)|Prot(?:é|e)ines|Protein|Proteine/i],
  ["salz", /(?<![a-zäöü])(?:Salz|Sel|Salt|Sale)(?![a-zäöü])/i],
];
function naehrwerteText(text: string): Record<string, number> | null {
  const start = text.search(/N(?:ä|ae)hrwert|Valeurs nutritionnelles|Nutrition|Valori nutrizionali/i);
  if (start < 0) return null;
  const block = text.slice(start, start + 1500);
  const o: Record<string, number> = {};
  const km = block.match(NW_MUSTER[0][1]);
  if (km) o.kcal = Number(km[1].replace(",", "."));
  const zeilen = block.split(/\n/).map((z) => z.trim()).filter((z) => z !== "");
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    for (const [key, re] of NW_MUSTER.slice(1)) {
      if (o[key] != null) continue;
      const m = z.match(re);
      if (!m) continue;
      if (key === "fett" && NW_MUSTER[1][1].test(z)) continue;
      // Wert steht in derselben Zeile oder (Tabelle) in der naechsten
      const rest = z.slice((m.index ?? 0) + m[0].length) + " " + (zeilen[i + 1] ?? "");
      const v = rest.match(/^[^0-9<]{0,40}<?\s*(\d+(?:[.,]\d+)?)\s*g(?![a-z])/i);
      if (v) { o[key] = Number(v[1].replace(",", ".")); break; }
    }
  }
  return Object.keys(o).length >= 3 ? o : null;
}

// EAN/GTIN der Seite: erst JSON-LD, dann Text ("EAN: 4032549037748", "GTIN 0401...")
function eanFinden(html: string, text: string): string | null {
  for (const b of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const m = b[1].match(/"gtin(?:13|14|8|12)?"\s*:\s*"?(\d{8,14})"?/i);
    if (m) return m[1];
  }
  const m = text.match(/(?:EAN|GTIN)(?:[- ]?(?:Code|Nummer|13|8))?\s*[:#]?\s*(\d{8}|\d{12,14})\b/i);
  return m ? m[1] : null;
}

const SPRACHE: Record<string, string> = {
  DE: "de-DE,de;q=0.9", AT: "de-AT,de;q=0.9", CH: "de-CH,de;q=0.9", FR: "fr-FR,fr;q=0.9", BE: "fr-BE,fr;q=0.9",
  IT: "it-IT,it;q=0.9", ES: "es-ES,es;q=0.9", NL: "nl-NL,nl;q=0.9", UK: "en-GB,en;q=0.9", US: "en-US,en;q=0.9",
};
async function seiteLesen(url: string, land = "DE") {
  try {
    const steuer = new AbortController();
    const uhr = setTimeout(() => steuer.abort(), 15000);
    const a = await fetch(url, { redirect: "follow", signal: steuer.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": SPRACHE[land] ?? SPRACHE.DE } });
    clearTimeout(uhr);
    if (!a.ok) return { ergebnis: "blockiert", grund: "HTTP " + a.status };
    const html = await a.text();
    if (html.length < 500) return { ergebnis: "blockiert", grund: "Seite praktisch leer" };
    const text = htmlZuText(html);
    const ean = eanFinden(html, text);
    const fund = zutatenFinden(html);
    const naehrwerte = naehrwerteJsonLd(html) ?? naehrwerteText(text) ?? undefined;
    if (!fund) return { ergebnis: "kein_text", ean, naehrwerte, grund: "keine Zutatenliste im Seitentext" };
    return { ergebnis: "treffer", ean, naehrwerte, text: fund.text.slice(0, 4000), weg: fund.weg };
  } catch (e) {
    return { ergebnis: "blockiert", grund: String((e as Error)?.message || e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000";
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== "Bearer " + service) {
    const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: adm } = await sb.rpc("cb_ist_admin");
    if (adm !== true) return json({ ok: false, fehler: "Nur Admin/Takt." }, 401);
  }
  const db = createClient(url, service);
  const body = await req.json().catch(() => ({}));
  const max = Math.max(1, Math.min(Number(body.max) || 15, 40));
  let { data: liste, error } = await db.rpc("cb_hersteller_abgleich_holen_land", { p_max: max });
  if (error) ({ data: liste, error } = await db.rpc("cb_hersteller_abgleich_holen", { p_max: max }));
  if (error) return json({ ok: false, fehler: error.message }, 500);
  const zaehler: Record<string, number> = {};
  const start = Date.now();
  for (const z of liste ?? []) {
    if (Date.now() - start > 110000) break;
    const r = await seiteLesen(z.url, (z as any).land ?? "DE");
    const { data: s, error: e2 } = await db.rpc("cb_hersteller_abgleich_setzen", { p: { produkt_id: z.produkt_id, url: z.url, ...r } });
    const st = e2 ? "fehler" : String((s as any)?.status || "?");
    zaehler[st] = (zaehler[st] || 0) + 1;
    await new Promise((res) => setTimeout(res, 700));
  }
  return json({ ok: true, geprueft: (liste ?? []).length, zaehler, ms: Date.now() - start });
});
