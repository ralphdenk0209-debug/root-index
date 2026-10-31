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
//   Fotolesung: claude-sonnet-5-5 (Wert aus shadow_v1.riki2_config.modell), eigener Deckel 1 $/Tag.
//   Server-seitiger Fallback bei Ablehnung ist an (fallbacks: "default").

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

const VERSION = "riki2 v3";
const UA = "RootIndex/1.0 (root-index.de)";
const QUELLE_TIMEOUT_MS = 8000;
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

// ---------- Pruefungen (fest, ohne Modell) ----------
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
  if (typeof zucker === "number" && typeof kh === "number" && zucker > kh + 0.5) b.push({ art: "zucker_ueber_kh", quelle, text: `Zucker ${zucker} > KH ${kh}`, sperrt: true });
  if (typeof ges_fett === "number" && typeof fett === "number" && ges_fett > fett + 0.5) b.push({ art: "gesfett_ueber_fett", quelle, text: `ges. Fett ${ges_fett} > Fett ${fett}`, sperrt: true });
  const summe = (protein ?? 0) + (kh ?? 0) + (fett ?? 0) + (ballaststoffe ?? 0) + (salz ?? 0);
  if (summe > 108) b.push({ art: "summe_ueber_100", quelle, text: `Makros zusammen ${summe.toFixed(1)} g je 100 g`, sperrt: true });
  const n = name.toLowerCase();
  if (typeof kcal === "number") {
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

// ---------- Quelle: Open Food Facts (gemeinschaftlich, teils veraltet) ----------
async function quelleOff(ean: string): Promise<Quelle> {
  const t0 = Date.now();
  const q: Quelle = { quelle: "openfoodfacts", url: `https://world.openfoodfacts.org/product/${ean}`, ergebnis: "fehler", befunde: [], dauer_ms: 0 };
  try {
    const s = await holen(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=code,product_name,product_name_de,brands,ingredients_text_de,nutriments,nutrition_data_per`);
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
    const n = p.nutriments ?? {};
    if (p.nutrition_data_per === "serving") {
      q.befunde.push({ art: "portion", quelle: q.quelle, text: "OFF hat nur Portionswerte – nicht uebernommen" });
    } else {
      q.naehrwerte = sauberNW({ kcal: n["energy-kcal_100g"], kj: n["energy-kj_100g"], fett: n["fat_100g"], ges_fett: n["saturated-fat_100g"],
        kh: n["carbohydrates_100g"], zucker: n["sugars_100g"], ballaststoffe: n["fiber_100g"], protein: n["proteins_100g"], salz: n["salt_100g"] });
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

// ---------- Fotolesung (alle Fotos gemeinsam) ----------
const ZAHL_ODER_NULL = { type: ["number", "null"] };
const LESE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ean_auf_foto", "name", "marke", "zutatenverzeichnis_sichtbar", "zutaten_lesbar", "zutaten_text", "naehrwert_basis", "naehrwerte", "unsicher"],
  properties: {
    ean_auf_foto: { type: ["string", "null"] },
    name: { type: ["string", "null"] },
    marke: { type: ["string", "null"] },
    zutatenverzeichnis_sichtbar: { type: "string", enum: ["ja", "nein", "unklar"] },
    zutaten_lesbar: { type: "string", enum: ["voll", "teilweise", "nein"] },
    zutaten_text: { type: ["string", "null"] },
    naehrwert_basis: { type: "string", enum: ["100g", "100ml", "nur_zubereitet", "nur_portion", "keine"] },
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
- naehrwerte: nur die Spalte je 100 g bzw. je 100 ml für das Produkt WIE VERKAUFT. Gibt es zwei Spalten (z. B. „Pulver" und „zubereitet"), nimm die Spalte wie verkauft. Gibt es nur Werte für das zubereitete Produkt („pro 100 ml zubereitet", „nach Zubereitung"), naehrwert_basis "nur_zubereitet" und alle Werte null. Gibt es nur Portionsangaben, naehrwert_basis "nur_portion" und alle Werte null – niemals umrechnen. "<0,5 g" bzw. "Spuren" als 0 nur, wenn genau das dasteht; sonst null.
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
  const dm = nach("dm"), edeka = nach("edeka-lmiv"), off = nach("openfoodfacts");
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
  const zKand = [fotoVoll, edeka, dm, off].filter((q) => q?.zutaten_text) as Quelle[];
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
  const nKand = ([fotoOk, edeka, dm, off].filter((q) => nwKomplett(q?.naehrwerte)) as Quelle[]).filter((q) => {
    if (!andereRezeptur.has(q.quelle)) return true;
    befunde.push({ art: "naehrwerte_andere_rezeptur", quelle: q.quelle, text: `Nährwerte von ${q.quelle} nicht übernommen – Zutaten passen nicht zum Foto dieses Scans` });
    return false;
  });
  let naehrwerte: NW | null = null, naehrwerte_quelle: string | null = null;
  for (const k of nKand) {
    const pb = pruefeNaehrwerte(k.naehrwerte!, name ?? "", k.quelle);
    befunde.push(...pb);
    if (pb.some((x) => x.sperrt)) continue;
    if (!naehrwerte) { naehrwerte = k.naehrwerte!; naehrwerte_quelle = k.quelle; }
  }
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
  } else {
    fehlt.push("naehrwerte");
  }
  if (!name) fehlt.push("name");
  if (!marke) fehlt.push("marke");
  if (naehrwerte_quelle === "openfoodfacts" && quellen.find((q) => q.quelle === "openfoodfacts")?.befunde.some((b) => b.art === "kcal_errechnet")) {
    befunde.push({ art: "off_kcal_errechnet", text: "kcal stammt aus OFF und ist aus kJ errechnet" });
  }
  const vollstaendig = fehlt.length === 0;
  return { ean, name, name_quelle, marke, zutaten_text, zutaten_quelle, zutaten_teil, naehrwerte, naehrwerte_quelle, fehlt, befunde, vollstaendig };
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
  const fotoAufgabe = (async () => {
    if (lauf.eingang !== "foto" || !fotos_eindeutig.length) return;
    const tf = Date.now();
    if (!client) { fehler = "Kein Anthropic-Schlüssel"; return; }
    if (budgetRest.usd < 0.1) { foto = { quelle: "foto", ergebnis: "uebersprungen", befunde: [{ art: "tagesdeckel", text: "Riki-2-Tagesdeckel erreicht" }], dauer_ms: 0 }; return; }
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
        if (l.naehrwert_basis === "100g" || l.naehrwert_basis === "100ml") foto.naehrwerte = sauberNW(l.naehrwerte);
        else if (l.naehrwert_basis === "nur_portion") foto.befunde.push({ art: "portion", quelle: "foto", text: "Etikett zeigt nur Portionswerte" });
        else if (l.naehrwert_basis === "nur_zubereitet") foto.befunde.push({ art: "nur_zubereitet", quelle: "foto", text: "Etikett zeigt nur Werte für das zubereitete Produkt – nicht übernommen (wie verkauft, Ralph 13.10.)" });
        if (Array.isArray(l.unsicher) && l.unsicher.length) foto.befunde.push({ art: "unsicher", quelle: "foto", text: l.unsicher.join(", ") });
      }
    } catch (e) {
      fehler = "Fotolesung: " + String((e as Error)?.message ?? e).slice(0, 300);
      foto = { quelle: "foto", ergebnis: "fehler", befunde: [{ art: "fehler", text: fehler }], dauer_ms: Date.now() - tf };
    }
  })();

  const [quellen] = await Promise.all([
    ean.length >= 8 ? Promise.all([quelleEdeka(ean), quelleDm(ean), quelleOff(ean)]) : Promise.resolve([] as Quelle[]),
    fotoAufgabe,
  ]);
  const f = foto as Quelle | null;
  const fotoFuerMerge = f && f.ergebnis === "treffer" ? f : null;
  const ergebnis = zusammenfuehren(ean, quellen, fotoFuerMerge);
  if (f) ergebnis.befunde.push(...f.befunde);
  const alle = f ? [f, ...quellen] : quellen;
  const kostenFinal: number = kosten;
  budgetRest.usd += vorbehalt - kostenFinal; // Vorbehalt durch echte Kosten ersetzen

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
