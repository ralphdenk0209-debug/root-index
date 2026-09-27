// quick-import — Link rein -> alle Sorten einer Herstellerseite mit Zutaten, Naehrwerten, EAN auslesen.
// 27.09.2026 (Ralph jaja "A"): Cockpit-Kachel Quick-Import. Aufruf NUR serverseitig aus dem Takt
// Erstauslieferung 27.09.2026: zweiter Commit, weil der erste Push zwei Commits hatte (fetch-depth 2 sah die Aenderung nicht).
// Auslieferung 2 (27.09.2026): Wirkstoffe-Stand erneut ausliefern - 7bdf74 kam im selben Push wie b045feb und wurde nicht erkannt.
// public.cb_quick_import_takt (service_role) oder von einem Admin. Diese Funktion LIEST NUR und schreibt
// nichts in die Datenbank - anlegen, binden, freigeben macht der Takt in SQL (derselbe Weg wie von Hand).
// GRUNDSATZ wie riki-herstellerseite: NICHTS ERFINDEN. Was nicht dasteht, bleibt null.
// Shopify-Shops: Sorten + Barcode kommen kostenlos aus /products/<handle>.json; Probe-/Mustergroessen fallen weg.
// 27.09.2026 (Ralph jaja): auch WIRKSTOFFE je Tagesdosis (Supplements -> Reinheits-Index).
// Lesen der Zutaten/Naehrwerte je Sorte: Claude Sonnet (staerker als Haiku, weil mehrere Sorten auf einer Seite).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MODELL = "claude-sonnet-4-6";
const PREIS = { in: 3.0, out: 15.0 }; // USD je 1 Mio Token

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const k = env["ANTHROPIC_API_KEY"];
  if (typeof k === "string" && k.trim().startsWith("sk-ant-")) return k.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}

async function holen(url: string, accept = "text/html", ms = 15000): Promise<{ ok: boolean; status: number; text: string }> {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": accept, "Accept-Language": "de-DE,de;q=0.9" }, signal: c.signal, redirect: "follow" });
    const t = await r.text();
    return { ok: r.ok, status: r.status, text: t };
  } catch (e) { return { ok: false, status: -1, text: String((e as any)?.message ?? e) }; }
  finally { clearTimeout(id); }
}

function jsonLd(html: string): string {
  const out: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 4) {
    const t = (m[1] ?? "").trim();
    if (t.length > 40 && /product|nutrition|gtin|ingredient/i.test(t)) out.push(t.slice(0, 5000));
  }
  return out.join("\n");
}

function htmlZuText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h\d)[^>]*>/gi, " \n ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&euro;/gi, "€").replace(/&auml;/g, "ä").replace(/&ouml;/g, "ö").replace(/&uuml;/g, "ü").replace(/&szlig;/g, "ß")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/* Relevante Fenster statt der ganzen Seite: alles rund um Zutaten/Naehrwerte/Verzehr, max ~30k Zeichen. */
function fokus(text: string): string {
  const low = text.toLowerCase();
  const re = /zutaten|inhaltsstoffe|nährwert|naehrwert|verzehrempfehlung|dosierung|zusammensetzung|ingredients|nutrition/g;
  const spans: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(low)) && spans.length < 40) spans.push([Math.max(0, m.index - 600), Math.min(text.length, m.index + 2400)]);
  if (!spans.length) return text.slice(0, 20000);
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) { const l = merged[merged.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else merged.push([s[0], s[1]]); }
  return (text.slice(0, 1500) + "\n...\n" + merged.map(([a, b]) => text.slice(a, b)).join("\n...\n")).slice(0, 30000);
}

function eanOk(roh: unknown): string | null {
  const s = String(roh ?? "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(s.length)) return null;
  const z = s.split("").map(Number); const p = z.pop()!;
  let sum = 0; z.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return ((10 - (sum % 10)) % 10) === p ? s : null;
}

const PROBE = /(probe|sample|muster|tester|gratis|geschenk|gift|abo\b|bundle|set\b|\bx\s*\d|\d\s*x\b)/i;

function grammAus(t: string): { menge: number | null; einheit: string | null } {
  const m = String(t ?? "").replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!m) return { menge: null, einheit: null };
  let n = Number(m[1]); let e = m[2].toLowerCase();
  if (e === "kg") { n = n * 1000; e = "g"; } if (e === "l") { n = n * 1000; e = "ml"; }
  return { menge: n, einheit: e };
}

const REGEL = `Du bist RIKI, die Lese-KI von Root Index. Du bekommst den Text einer Hersteller-Produktseite und (falls vorhanden) die Liste der SORTEN/VARIANTEN aus dem Shop.
AUFGABE: Fuer JEDE genannte Sorte getrennt auslesen: Zutatenliste (woertlich, vollstaendig, mit Prozentangaben, ohne Allergen-Hervorhebungszeichen), Naehrwerte je 100 g bzw. 100 ml, Verzehrempfehlung, Form, Bio-Kennzeichnung.
OBERSTE REGEL: NICHTS ERFINDEN. Was fuer eine Sorte nicht klar dasteht, ist null. Nie Angaben einer Sorte auf eine andere uebertragen, ausser die Seite sagt ausdruecklich, dass sie fuer alle Sorten gelten.
- Zutaten: exakt den Wortlaut der Seite fuer diese Sorte. Keine Zusammenfassung, keine Uebersetzung.
- Naehrwerte: nur die 100-g/100-ml-Spalte, kcal (nicht kJ). Portionswerte NICHT umrechnen.
- Kategorie NUR aus: Backen | Brot & Backwaren | Brotaufstrich | Desserts & Süßspeisen | Energy-Gel | Fertigprodukte | Fleisch & Fisch | Getränk | Getreide & Beilagen | Milchprodukte & Eier | Nüsse & Hülsenfrüchte | Obst & Gemüse | Öle & Fette | Proteinpulver | Riegel | Snacks | Supplement | Süßungsmittel | Süßwaren | Tofu & Fleischalternativen | Würzen & Saucen | Salze | Lebensmittel | Sonstiges. Sonst null.
- Bio nur true bei ausdruecklicher Bio-/Öko-Auslobung, sonst null.
- EAN nur, wenn die Seite eine Ziffernfolge ausdruecklich als EAN/GTIN/Barcode bezeichnet.
- WIRKSTOFFE (nur bei Supplements / Nahrungsergaenzung): die Tabelle "pro Tagesdosis / pro Portion" mit Vitaminen, Mineralstoffen und dem Hauptwirkstoff (z. B. Kollagenhydrolysat, Kreatin, Omega-3, EPA, DHA). Je Zeile Name, Menge, Einheit exakt "g" | "mg" | "µg" | "Mrd KBE" | "Mio KBE", und nrv_prozent nur wenn angegeben. KEIMZAHLEN (Probiotika, KBE/CFU/koloniebildende Einheiten) NIE als mg: z. B. "16 Milliarden KBE" -> menge 16, einheit "Mrd KBE"; "200 Mio KBE" -> menge 200, einheit "Mio KBE". Werte je TAGESDOSIS laut Verzehrempfehlung, nicht je 100 g. Aminosaeurenprofile NICHT uebernehmen. Keine Tabelle: [].
- Gibt es KEINE Sortenliste, nenne selbst die Sorten, die die Seite als eigene Produkte fuehrt (Geschmacksrichtungen). Proben/Muster/Sets weglassen.
ANTWORTE NUR MIT JSON:
{"marke":string|null,"produkte":[{"sorte_key":string|null,"name":string,"kategorie":string|null,"zutaten":string|null,"naehrwerte_100g":{"kcal":number|null,"fett":number|null,"ges_fett":number|null,"kh":number|null,"zucker":number|null,"ballaststoffe":number|null,"protein":number|null,"salz":number|null}|null,"bezug":"100g"|"100ml"|null,"verzehrempfehlung":string|null,"form":string|null,"bio":true|null,"ean":string|null,"wirkstoffe":[{"name":string,"menge":number,"einheit":"g"|"mg"|"µg"|"Mrd KBE"|"Mio KBE","nrv_prozent":number|null}],"hinweis":string|null}]}
"name" = Produktname OHNE Marke, mit Sorte (z. B. "Kollagen Pfirsich"). "sorte_key" = der Schluessel aus der mitgegebenen Sortenliste (unveraendert), sonst null.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const auth = req.headers.get("Authorization") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000";
  if (auth !== "Bearer " + service) {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: adm } = await sb.rpc("cb_ist_admin");
    if (adm !== true) return json({ ok: false, fehler: "Nur Admin/Takt." }, 401);
  }
  let body: any = {}; try { body = await req.json(); } catch { /* leer */ }
  const url = String(body.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return json({ ok: false, fehler: "Keine gültige URL." }, 400);
  const t0 = Date.now();
  let u: URL; try { u = new URL(url); } catch { return json({ ok: false, fehler: "URL nicht lesbar." }, 400); }

  // 1) Shopify-Sorten (kostenlos)
  let shop = "html"; let sorten: any[] = []; let shopTitel = ""; let shopMarke = ""; let shopBild: string | null = null;
  const h = u.pathname.match(/\/products\/([^\/?#]+)/);
  if (h) {
    const r = await holen(`${u.origin}/products/${h[1]}.json`, "application/json", 12000);
    if (r.ok) {
      try {
        const p = JSON.parse(r.text)?.product;
        if (p?.variants?.length) {
          shop = "shopify"; shopTitel = String(p.title ?? ""); shopMarke = String(p.vendor ?? ""); shopBild = p.image?.src ?? p.images?.[0]?.src ?? null;
          const bilder: Record<string, string> = {};
          for (const im of (p.images ?? [])) for (const vid of (im.variant_ids ?? [])) bilder[String(vid)] = im.src;
          for (const v of p.variants) {
            const titel = String(v.title ?? "");
            if (PROBE.test(titel)) continue;
            const opt = [v.option1, v.option2, v.option3].filter((x: any) => x && x !== "Default Title");
            const gr = grammAus(titel);
            sorten.push({ sorte_key: String(v.id), titel, optionen: opt, ean: eanOk(v.barcode), sku: v.sku ?? null,
              preis: v.price != null ? Number(v.price) : null, menge: gr.menge ?? (v.grams ? Number(v.grams) : null), einheit: gr.einheit ?? (v.grams ? "g" : null),
              bild: bilder[String(v.id)] ?? shopBild, link: `${u.origin}/products/${h[1]}?variant=${v.id}` });
          }
        }
      } catch { /* kein Shopify-JSON */ }
    }
  }

  // 2) Seite lesen
  const seite = await holen(url);
  if (!seite.ok && !sorten.length) return json({ ok: false, fehler: `Seite antwortete ${seite.status}.`, shop });
  const ld = jsonLd(seite.text);
  const text = fokus(htmlZuText(seite.text));
  if ((text.length + ld.length) < 300) return json({ ok: false, fehler: "Seite liefert keinen lesbaren Text (JavaScript-Seite).", shop, sorten });

  // 3) Riki (Sonnet) liest je Sorte
  const key = findeKey();
  if (!key) return json({ ok: false, fehler: "Kein Anthropic-Key." }, 500);
  const sortenText = sorten.length ? "SORTEN AUS DEM SHOP (sorte_key: Titel):\n" + sorten.map((s) => `${s.sorte_key}: ${s.titel}`).join("\n") : "KEINE SORTENLISTE - Sorten selbst aus der Seite bestimmen.";
  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELL, max_tokens: 6000,
      system: [{ type: "text", text: REGEL, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Produktseite: ${url}\nShop-Titel: ${shopTitel}\nMarke (Shop): ${shopMarke}\n\n${sortenText}\n\nSEITENTEXT:\n${text}\n\n${ld ? "JSON-LD:\n" + ld : ""}` }] }),
  });
  const j = await ai.json();
  const usage: any = j.usage ?? {};
  const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const outTok = usage.output_tokens ?? 0;
  const kosten = Number(((inTok / 1e6) * PREIS.in + (outTok / 1e6) * PREIS.out).toFixed(6));
  if (!ai.ok) return json({ ok: false, fehler: "Riki-Aufruf fehlgeschlagen: " + JSON.stringify(j).slice(0, 300), modell: MODELL, kosten_usd: 0, in: 0, out: 0 });
  const txt = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  let erg: any = null; try { const m = txt.match(/\{[\s\S]*\}/); erg = JSON.parse(m ? m[0] : txt); } catch { /* */ }
  if (!erg?.produkte?.length) return json({ ok: false, fehler: "Riki hat keine Produkte erkannt.", modell: MODELL, kosten_usd: kosten, in: inTok, out: outTok, shop });

  // 4) Zusammenfuehren: Shop-Daten (EAN, Bild, Preis, Menge, Link) gewinnen vor Riki
  const produkte = erg.produkte.map((p: any) => {
    const s = sorten.find((x) => x.sorte_key === String(p.sorte_key ?? "")) ?? null;
    const wirk = (Array.isArray(p.wirkstoffe) ? p.wirkstoffe : []).map((w: any) => {
      let e = String(w?.einheit ?? "").trim().toLowerCase(); if (e === "ug" || e === "mcg") e = "µg";
      // 27.09.2026 (Ralph jaja): Keimzahlen als KBE, nie als mg (Braineffect: 16 Mrd KBE kam als 16.000.000.000 mg)
      if (/^(mrd|milliarden?)\s*(kbe|cfu)$/.test(e)) e = "Mrd KBE"; else if (/^(mio|millionen?)\s*(kbe|cfu)$/.test(e)) e = "Mio KBE";
      let m = Number(w?.menge); const n = Number(w?.nrv_prozent);
      const keim = /(bacter|bakter|lacto|bifido|probiot|kultur|kbe|cfu|streptococ|saccharomyc)/i.test(String(w?.name ?? ""));
      if ((e === "kbe" || e === "cfu" || (keim && ["mg", "g", "µg"].includes(e))) && isFinite(m) && m >= 1e6) { m = Math.round(m / 1e7) / 100; e = "Mrd KBE"; }
      return (String(w?.name ?? "").trim() && isFinite(m) && m > 0 && ["g", "mg", "µg", "Mrd KBE", "Mio KBE"].includes(e))
        ? { name: String(w.name).trim(), menge: m, einheit: e, nrv_prozent: isFinite(n) && n >= 0 ? n : null } : null;
    }).filter(Boolean);
    return { ...p, wirkstoffe: wirk, marke: erg.marke || shopMarke || null, ean: s?.ean ?? eanOk(p.ean), bild: s?.bild ?? shopBild, preis: s?.preis ?? null,
      menge: s?.menge ?? null, einheit: s?.einheit ?? null, link: s?.link ?? url, sorte_titel: s?.titel ?? null };
  });
  return json({ ok: true, shop, url, marke: erg.marke || shopMarke || null, produkte, sorten_shop: sorten.length, modell: MODELL, kosten_usd: kosten, in: inTok, out: outTok, dauer_ms: Date.now() - t0 });
});
