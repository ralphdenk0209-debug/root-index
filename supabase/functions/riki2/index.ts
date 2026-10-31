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
//   Fotolesung: claude-sonnet-5-5 (Wert aus shadow_v1.riki2_config.modell), eigener Deckel 1 $/Tag.
//   Server-seitiger Fallback bei Ablehnung ist an (fallbacks: "default").

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

const VERSION = "riki2 v6";
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
const DEUTSCH = /\b(und|enthält|enthalten|kann|spuren|milch|zucker|salz|wasser|säuerungsmittel|emulgator|weizen|aroma|gewürze|pflanzliche|aus|mit)\b/gi;
function siehtDeutschAus(t: string): boolean {
  const treffer = (t.match(DEUTSCH) ?? []).length + ((/[äöüß]/i.test(t)) ? 1 : 0);
  return treffer >= 2;
}
// Liefert einen Grund, wenn der Text keine brauchbare Zutatenliste ist, sonst null.
function zutatenUnbrauchbar(t: string, name: string): string | null {
  const s = t.trim();
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
      }
    }
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

// ---------- Herstellerweg: Websuche + Seite lesen (bezahlt, nur bei Luecke) ----------
const SUCH_MODELL = "claude-haiku-5-5";
const HAIKU_PREIS: [number, number] = [0.1, 0.5]; // je 1 Mio Tokens (bis 100K Prompt)
const SUCHE_PREIS = 0.01; // je Websuche
// Server-Abruf gesperrt (403/Captcha, gemessen 31.10.) – gar nicht erst suchen. Portale haben wir schon direkt.
const NICHT_SUCHEN = ["rewe.de", "kaufland.de", "netto-online.de", "openfoodfacts.org", "fddb.info", "codecheck.info"];
const SEITEN_UA = "Mozilla/5.0 (compatible; RootIndex/1.0; +https://root-index.de)";

const SUCH_AUFTRAG = (marke: string, name: string, ean: string) => `Finde Produktseiten zu GENAU diesem Lebensmittel, auf denen die Zutatenliste und/oder die Nährwerttabelle je 100 g stehen.
Marke: ${marke}
Produktname: ${name}
EAN: ${ean}

Reihenfolge: 1. offizielle Seite des Herstellers (Domain kann einen Zusatz tragen), 2. deutscher Online-Händler mit Produktseite.
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
  return { kandidaten: kandidaten.slice(0, 3), kosten, inT, outT, suchen };
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

const SEITEN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["produkt_passt", "zutaten_text", "naehrwert_basis", "naehrwerte"],
  properties: {
    produkt_passt: { type: "string", enum: ["ja", "nein", "unklar"] },
    zutaten_text: { type: ["string", "null"] },
    naehrwert_basis: { type: "string", enum: ["100g", "100ml", "nur_zubereitet", "nur_portion", "keine"] },
    naehrwerte: LESE_SCHEMA.properties.naehrwerte,
  },
};
const SEITEN_AUFTRAG = (marke: string, name: string, text: string) => `Unten steht der Text einer Produktseite. Gesucht: Angaben zu GENAU diesem Produkt – Marke „${marke}", Produkt „${name}".
- produkt_passt: "ja" nur, wenn die Seite dieses Produkt zeigt (Marke und Name/Sorte passen). Andere Sorte oder Kategorie-Seite = "nein".
- zutaten_text: die deutsche Zutatenliste wörtlich, ohne „Zutaten:" am Anfang; sonst null.
- naehrwerte: nur die Spalte je 100 g bzw. 100 ml WIE VERKAUFT; nur zubereitete Werte → naehrwert_basis "nur_zubereitet", Werte null; nur Portion → "nur_portion", Werte null. kcal als kcal, kJ als kJ.
- Nichts ergänzen, nichts schätzen. Was nicht dasteht, ist null.

${text.slice(0, 24000)}`;

async function seiteAuswerten(client: Anthropic, marke: string, name: string, text: string) {
  const r: any = await client.messages.create({
    model: SUCH_MODELL,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SEITEN_SCHEMA } },
    messages: [{ role: "user", content: SEITEN_AUFTRAG(marke, name, text) }],
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
  for (const k of s.kandidaten.slice(0, 2)) {
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
      const h = await holeSeite(k.url);
      q.http = h.status;
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
      const a = await seiteAuswerten(client, marke, name, text);
      kosten += a.kosten; inT += a.inT; outT += a.outT;
      const l = a.lesung;
      if (!l || l.produkt_passt !== "ja") { q.ergebnis = "leer"; q.befunde.push({ art: "anderes_produkt", quelle: q.quelle, text: `Produkt passt: ${l?.produkt_passt ?? "?"}` }); continue; }
      if (l.zutaten_text) q.zutaten_text = ohneZutatenWort(String(l.zutaten_text));
      if (l.naehrwert_basis === "100g" || l.naehrwert_basis === "100ml") q.naehrwerte = sauberNW(l.naehrwerte);
      else if (l.naehrwert_basis === "nur_zubereitet") q.befunde.push({ art: "nur_zubereitet", quelle: q.quelle, text: "Seite nennt nur zubereitete Werte" });
      q.ergebnis = q.zutaten_text || nwKomplett(q.naehrwerte) ? "treffer" : "leer";
      if (q.ergebnis === "treffer" && q.ean_beweis) break; // bewiesener Treffer reicht
    } catch (e) {
      q.befunde.push({ art: "fehler", quelle: q.quelle, text: String((e as Error)?.message ?? e).slice(0, 200) });
    } finally {
      q.dauer_ms = Date.now() - t0;
    }
  }
  if (!s.kandidaten.length) quellen.push({ quelle: "websuche", ergebnis: "nicht_gefunden", befunde: [], dauer_ms: 0 });
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
  const dm = nach("dm"), edeka = nach("edeka-lmiv"), off = nach("openfoodfacts");
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
  const zKand = ([fotoVoll, edeka, dm, ...webMitEan, off, ...webOhneEan].filter((q) => q?.zutaten_text) as Quelle[]).filter((q) => {
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
  for (const q of webOhneEan) {
    if (zutaten_quelle === q.quelle || naehrwerte_quelle === q.quelle) befunde.push({ art: "vorlaeufig_ohne_ean", quelle: q.quelle, text: `${q.quelle} genutzt, aber ohne Barcode auf der Seite – vorläufig` });
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
  let ergebnis = zusammenfuehren(ean, quellen, fotoFuerMerge);
  // v6: Herstellerweg nur bei Luecke, nur mit Marke + Name, nur im Deckel
  let kostenWeb = 0;
  const luecke = ergebnis.fehlt.some((x) => x === "zutaten" || x === "zutaten_unvollstaendig" || x === "naehrwerte");
  if (luecke && client && ergebnis.marke && ergebnis.name && ean.length >= 8) {
    if (budgetRest.usd < 0.06) {
      ergebnis.befunde.push({ art: "tagesdeckel", text: "Herstellerweg übersprungen: Riki-2-Tagesdeckel" });
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
  for (const q of quellen) ergebnis.befunde.push(...q.befunde.filter((b) => ["leere_huelle", "anderes_produkt"].includes(b.art)));
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
