// hersteller-abgleich — I41, 29.09.2026 (Ralph "go").
// Liest Herstellerseiten KOSTENLOS (einfacher Abruf, keine KI) und vergleicht die
// Zutatenliste mit unserem Text. NUR MELDEN – schreibt nie in Produkte/Zutaten_Rohtext.
// Arbeitsliste: public.cb_hersteller_abgleich_holen(max), Ergebnis: public.cb_hersteller_abgleich_setzen(jsonb).
// Die Leselogik (htmlZuText .. zutatenFinden) ist eine Kopie aus quelle-abruf-einfach v5,
// mit Wortgrenze vor "Zutaten" (sonst greift "Backzutaten" im Seitenmenue).
// Aufruf: pg_cron ueber cb_edge_rufen (service_role) oder Admin.
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

const ABBRUCH =
  "(?:N(?:ä|ae|Ä)hrwert|Durchschnittliche N|Allergene|Kann Spuren|Aufbewahrung|" +
  "Herkunft|Hinweis|Verzehrempfehlung|Zubereitung|Lagerung|Brennwert|Energie|" +
  "GTIN|Artikelnummer|Inhalt:|Bewertung|Weitere Informationen|" +
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
    "(?<![A-Za-zÄÖÜäöüß])Zutaten(?:verzeichnis|liste)?\\s*[:\\n]\\s*([\\s\\S]{10,2500}?)" +
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
    if (/^\s*Zutaten(?:verzeichnis|liste)?\s*:?\s*$/i.test(zeilen[i])) {
      const rest = zeilen.slice(i + 1, i + 6).join(" ").trim();
      const bis = rest.split(new RegExp(ABBRUCH, "i"))[0].trim();
      if (istPlausibel(bis)) return bis;
    }
  }
  return null;
}

function zutatenFinden(html) {
  const a = ausJsonLd(html);
  if (a) return { text: a, weg: "json-ld" };
  const b = ausText(htmlZuText(html));
  if (b) return { text: b, weg: "muster" };
  return null;
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

async function seiteLesen(url: string) {
  try {
    const steuer = new AbortController();
    const uhr = setTimeout(() => steuer.abort(), 15000);
    const a = await fetch(url, { redirect: "follow", signal: steuer.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "de-DE,de;q=0.9" } });
    clearTimeout(uhr);
    if (!a.ok) return { ergebnis: "blockiert", grund: "HTTP " + a.status };
    const html = await a.text();
    if (html.length < 500) return { ergebnis: "blockiert", grund: "Seite praktisch leer" };
    const text = htmlZuText(html);
    const ean = eanFinden(html, text);
    const fund = zutatenFinden(html);
    if (!fund) return { ergebnis: "kein_text", ean, grund: "keine Zutatenliste im Seitentext" };
    return { ergebnis: "treffer", ean, text: fund.text.slice(0, 4000), weg: fund.weg };
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
  const { data: liste, error } = await db.rpc("cb_hersteller_abgleich_holen", { p_max: max });
  if (error) return json({ ok: false, fehler: error.message }, 500);
  const zaehler: Record<string, number> = {};
  const start = Date.now();
  for (const z of liste ?? []) {
    if (Date.now() - start > 110000) break;
    const r = await seiteLesen(z.url);
    const { data: s, error: e2 } = await db.rpc("cb_hersteller_abgleich_setzen", { p: { produkt_id: z.produkt_id, url: z.url, ...r } });
    const st = e2 ? "fehler" : String((s as any)?.status || "?");
    zaehler[st] = (zaehler[st] || 0) + 1;
    await new Promise((res) => setTimeout(res, 700));
  }
  return json({ ok: true, geprueft: (liste ?? []).length, zaehler, ms: Date.now() - start });
});
