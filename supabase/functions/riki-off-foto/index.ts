// RIKI-OFF-FOTO v1 (03.11.2026, Ralph „ja“: „das sollte doch riki können“)
//
// WARUM: Scans ohne Zutatenliste/Naehrwerte blieben haengen, bis jemand ein Etikettfoto machte.
//   Ralph hat keine Fotos. Open Food Facts hat zu vielen Barcodes Etikettfotos anderer Nutzer.
//   Am 03.11. von Hand gemessen: 7 von 9 haengenden Scans liessen sich damit loesen.
// WAS: Kandidaten aus cb_riki_off_foto_kandidaten (Tagesdeckel 25) -> OFF-Bildliste zur EAN ->
//   bis zu 6 Fotos (Zutaten/Naehrwerte zuerst, dann Rohfotos) -> riki-etikett liest sie
//   -> PRUEFEN: Naehrwerte vom Foto muessen zum Scan passen (kcal +-12 %, mind. 10 kcal) ODER
//   der Barcode auf dem Foto ist gleich. Sonst nichts uebernehmen (nicht_passend).
//   Fremdsprachige Liste -> Uebersetzung (Ralph 25.09./30.10.: uebersetzen ok).
//   -> cb_riki_off_foto_uebernehmen (Scan-Brücke / Rohtext / Naehrwerte nur fuellen, nie ueberschreiben,
//   Referenz-Nachlauf, Freigabe-Takt). Nichts wird geraten.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const LESE_MODELL = "claude-sonnet-4-6";
const UEBERSETZ_MODELL = "claude-haiku-4-5-20251001";
const UA = "RootIndex/1.0 (root-index.de; riki-off-foto)";
const MAX_BILD = 3_700_000; // Bytes je Foto (Base64 bleibt unter 5 MB)
const MAX_SUMME = 14_000_000;

function antwort(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
function findeKey(): string | null {
  const env = Deno.env.toObject();
  const k = env["ANTHROPIC_API_KEY"];
  if (typeof k === "string" && k.trim().startsWith("sk-ant-api")) return k.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-api")) return v.trim();
  return null;
}
function offPfad(ean: string): string {
  const e = ean.length < 13 ? ean.padStart(13, "0") : ean;
  const m = e.match(/^(\d{3})(\d{3})(\d{3})(\d+)$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}/${m[4]}` : e;
}
function b64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
function zahl(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x.replace(",", ".")) : Number(x);
  return x !== null && x !== undefined && x !== "" && Number.isFinite(n) ? n : null;
}
function gtinGleich(a: unknown, b: unknown): boolean {
  const s = String(a ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const f = String(b ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return !!s && !!f && s === f;
}
function istDeutsch(t: string): boolean {
  const de = (t.match(/\b(und|mit|aus|zucker|salz|speisesalz|wasser|milch|säuerungsmittel|emulgator|aroma|verdickungsmittel|stärke|weizenmehl|enthält)\b/gi) ?? []).length;
  const fremd = (t.match(/\b(ingredienti|ingrédients|ingredients|ingredientes|sucre|zucchero|azúcar|sugar|water|eau|acqua|agua|sel|sale|salt|lait|latte|leche|milk|farine|farina|harina|flour|huile|olio|aceite|oil|suiker|zout|melk)\b/gi) ?? []).length;
  return de >= 2 && de >= fremd;
}

/** Bildauswahl: ausgewaehlte Zutaten-/Naehrwertfotos (deutsch zuerst), dann Rohfotos (neueste zuerst). */
function bildUrls(ean: string, images: Record<string, any>): string[] {
  const p = `https://images.openfoodfacts.org/images/products/${offPfad(ean)}`;
  const urls: string[] = [];
  const genutzt = new Set<string>();
  const sel = Object.keys(images).filter((k) => /^(ingredients|nutrition)_/.test(k));
  sel.sort((a, b) => {
    const r = (k: string) => (k.endsWith("_de") ? 0 : 1) * 10 + (k.startsWith("ingredients") ? 0 : 1);
    return r(a) - r(b);
  });
  for (const k of sel) {
    const im = images[k];
    if (!im?.rev) continue;
    urls.push(`${p}/${k}.${im.rev}.full.jpg`);
    if (im.imgid) genutzt.add(String(im.imgid));
  }
  const frontIds = new Set(Object.keys(images).filter((k) => k.startsWith("front_")).map((k) => String(images[k]?.imgid ?? "")));
  const roh = Object.keys(images).filter((k) => /^\d+$/.test(k) && !genutzt.has(k));
  roh.sort((a, b) => (Number(images[b]?.uploaded_t ?? b) - Number(images[a]?.uploaded_t ?? a)));
  // Vorderseiten ans Ende - die Rueckseite traegt Zutaten und Naehrwerte.
  roh.sort((a, b) => Number(frontIds.has(a)) - Number(frontIds.has(b)));
  for (const k of roh) urls.push(`${p}/${k}.jpg`);
  return urls;
}

async function fotosLaden(urls: string[]): Promise<{ bilder: string[]; geladen: string[] }> {
  const bilder: string[] = [];
  const geladen: string[] = [];
  let summe = 0;
  for (const u of urls) {
    if (bilder.length >= 6) break;
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 15_000 || buf.byteLength > MAX_BILD || summe + buf.byteLength > MAX_SUMME) continue;
      const typ = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
      if (!/^image\/(jpeg|png|webp)$/.test(typ)) continue;
      summe += buf.byteLength;
      bilder.push(`data:${typ};base64,${b64(buf)}`);
      geladen.push(u);
    } catch (_) { /* naechstes Foto */ }
  }
  return { bilder, geladen };
}

async function uebersetzen(text: string, sb: any): Promise<{ text: string | null; kosten: number }> {
  const key = findeKey();
  if (!key) return { text: null, kosten: 0 };
  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: UEBERSETZ_MODELL, max_tokens: 800, messages: [{ role: "user", content:
      "Übersetze diese Zutatenliste eines Lebensmittels wortgetreu ins Deutsche, wie sie auf einem deutschen Etikett stünde. " +
      "Reihenfolge, Prozentangaben, Klammern und E-Nummern genau beibehalten. Nichts weglassen, nichts ergänzen, " +
      "keine Allergenhinweise, Lagerhinweise oder Werbung übernehmen. Antworte NUR mit der deutschen Liste ohne das Wort „Zutaten:“.\n\n" + text }] }),
  });
  const j = await ai.json().catch(() => null);
  if (!ai.ok || !j) return { text: null, kosten: 0 };
  const out = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const u = j.usage ?? {};
  const kosten = ((u.input_tokens ?? 0) / 1e6) * 1.0 + ((u.output_tokens ?? 0) / 1e6) * 5.0;
  try { await sb.rpc("cb_riki_buchen", { p_modus: "off-foto-uebersetzen", p_modell: UEBERSETZ_MODELL, p_in: u.input_tokens ?? 0, p_out: u.output_tokens ?? 0, p_kosten: Number(kosten.toFixed(6)), p_produkt_id: null, p_erfolg: true, p_fehler: null }); } catch (_) { /* nur Buchung */ }
  return { text: out && out.length > 5 ? out.replace(/^zutaten\s*:\s*/i, "") : null, kosten };
}

async function einFall(sb: any, url: string, serviceKey: string, k: any) {
  const ean = String(k.ean);
  const t0 = Date.now();
  // 1. Bildliste von Open Food Facts
  let prod: any = null;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=images,product_name,product_name_de,brands`, { headers: { "User-Agent": UA } });
    const j = await r.json().catch(() => null);
    prod = j?.status === 1 ? j.product : null;
  } catch (_) { prod = null; }
  const urls = prod?.images ? bildUrls(ean, prod.images) : [];
  if (!urls.length) {
    await sb.rpc("cb_riki_off_foto_status", { p_ean: ean, p_status: "keine_fotos", p_ergebnis: { grund: "Open Food Facts hat keine Fotos zu dieser EAN" }, p_kosten: 0 });
    return { ean, status: "keine_fotos" };
  }
  const { bilder, geladen } = await fotosLaden(urls);
  if (!bilder.length) {
    await sb.rpc("cb_riki_off_foto_status", { p_ean: ean, p_status: "keine_fotos", p_ergebnis: { grund: "Fotos nicht ladbar oder zu groß", urls: urls.slice(0, 6) }, p_kosten: 0 });
    return { ean, status: "keine_fotos" };
  }
  // 2. Riki liest
  const r = await fetch(`${url}/functions/v1/riki-etikett`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bilder, ean, ean_pruefen: true, modell: LESE_MODELL, schlank: true, nur_zeilen: true }),
  });
  const d = await r.json().catch(() => null);
  let kosten = Number(d?.meta?.kosten_usd ?? 0);
  const v = d?.vorschlag;
  if (!r.ok || !v) {
    await sb.rpc("cb_riki_off_foto_status", { p_ean: ean, p_status: "fehler", p_ergebnis: { grund: `riki-etikett HTTP ${r.status}`, fehler: String(d?.error ?? "").slice(0, 300) }, p_kosten: kosten });
    return { ean, status: "fehler" };
  }
  // 3. Pruefen: gleiches Produkt?
  const nwRoh = v.nur_portionswerte === true ? {} : (v.naehrwerte_100g ?? {});
  const nw: Record<string, number> = {};
  for (const f of ["kcal", "fett", "ges_fett", "kh", "zucker", "ballaststoffe", "protein", "salz"]) {
    const n = zahl(nwRoh[f]);
    if (n !== null && n >= 0) nw[f] = n;
  }
  const scanKcal = zahl(k.kcal);
  const fotoKcal = zahl(nw.kcal);
  const eanGleich = gtinGleich(ean, v.ean_auf_foto);
  const eanAnders = !!String(v.ean_auf_foto ?? "").replace(/\D/g, "") && !eanGleich;
  let pruefung = "";
  if (eanAnders) pruefung = "barcode_anders";
  else if (scanKcal !== null && fotoKcal !== null) {
    pruefung = Math.abs(scanKcal - fotoKcal) <= Math.max(10, 0.12 * scanKcal) ? "kcal_passt" : "kcal_anders";
  } else if (eanGleich) pruefung = "barcode_gleich";
  else pruefung = "nicht_pruefbar";
  if (!(pruefung === "kcal_passt" || pruefung === "barcode_gleich")) {
    await sb.rpc("cb_riki_off_foto_status", { p_ean: ean, p_status: "nicht_passend", p_ergebnis: { grund: `Foto nicht sicher dasselbe Produkt (${pruefung}, Scan ${scanKcal ?? "–"} kcal, Foto ${fotoKcal ?? "–"} kcal)`, fotos: geladen }, p_kosten: kosten });
    return { ean, status: "nicht_passend", pruefung };
  }
  // 4. Zutatentext (Etikettreihenfolge), ggf. uebersetzen
  const zeilen: any[] = Array.isArray(v.zutaten) ? v.zutaten : [];
  let rohtext: string | null = zeilen.map((z) => String(z?.original_text ?? z?.name ?? "").trim()).filter(Boolean).join(", ") || null;
  let uebersetzt = false;
  if (rohtext && !istDeutsch(rohtext)) {
    const u = await uebersetzen(rohtext, sb);
    kosten += u.kosten;
    if (u.text && istDeutsch(u.text)) { rohtext = u.text; uebersetzt = true; }
    else rohtext = null; // lieber nichts als eine fremdsprachige Liste
  }
  if (!rohtext && Object.keys(nw).length === 0) {
    await sb.rpc("cb_riki_off_foto_status", { p_ean: ean, p_status: "nichts_gelesen", p_ergebnis: { grund: "Fotos zeigen weder Zutaten noch Nährwerte lesbar", fotos: geladen }, p_kosten: kosten });
    return { ean, status: "nichts_gelesen" };
  }
  // 5. Uebernehmen
  const name = String(prod?.product_name_de || prod?.product_name || v.name || "").trim() || null;
  const marke = String(prod?.brands || v.marke || "").trim() || null;
  const { data: ue, error: ueErr } = await sb.rpc("cb_riki_off_foto_uebernehmen", {
    p_ean: ean, p_rohtext: rohtext, p_nw: nw, p_name: name, p_marke: marke,
    p_meta: { fotos: geladen.length, pruefung, uebersetzt, urls: geladen },
  });
  const status = ueErr ? "fehler" : (ue?.ok ? "uebernommen" : "fehler");
  await sb.rpc("cb_riki_off_foto_status", { p_ean: ean, p_status: status, p_ergebnis: {
    grund: ueErr ? ueErr.message : (ue?.ok ? `${ue.produkt_id} ${ue.produktstatus}${uebersetzt ? ", übersetzt" : ""}` : (ue?.grund ?? "?")),
    pruefung, uebersetzt, zutaten: !!rohtext, naehrwerte: Object.keys(nw), fotos: geladen, uebernahme: ue ?? null, ms: Date.now() - t0 }, p_kosten: kosten });
  return { ean, status, produkt_id: ue?.produkt_id ?? null, produktstatus: ue?.produktstatus ?? null, pruefung };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return antwort({ ok: false, fehler: "POST erforderlich" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const n = Math.max(1, Math.min(Number(body?.max ?? 2), 3));
    const { data: kd, error } = await sb.rpc("cb_riki_off_foto_kandidaten", { p_n: body?.ean ? 25 : n });
    if (error) throw new Error(error.message);
    let liste: any[] = Array.isArray(kd?.kandidaten) ? kd.kandidaten : [];
    if (body?.ean) liste = liste.filter((x) => String(x.ean) === String(body.ean));
    const ergebnisse: any[] = [];
    for (const k of liste.slice(0, n)) {
      try { ergebnisse.push(await einFall(sb, url, serviceKey, k)); }
      catch (e) {
        try { await sb.rpc("cb_riki_off_foto_status", { p_ean: String(k.ean), p_status: "fehler", p_ergebnis: { grund: String(e).slice(0, 300) }, p_kosten: 0 }); } catch (_) { /* */ }
        ergebnisse.push({ ean: k.ean, status: "fehler", fehler: String(e).slice(0, 200) });
      }
    }
    return antwort({ ok: true, verarbeitet: ergebnisse.length, ergebnisse, grund: kd?.grund ?? null, ms: Date.now() - t0 });
  } catch (e) {
    return antwort({ ok: false, fehler: String(e), ms: Date.now() - t0 }, 500);
  }
});
