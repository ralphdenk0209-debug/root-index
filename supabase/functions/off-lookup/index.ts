// off-lookup — OpenFoodFacts-Brücke für Root Index (v3.3)
//
//   mode = "ean"   -> Produkt per Barcode holen (Live-Scan im Laden, SCAN-2)
//   mode = "suche" -> Marke+Name suchen, EAN-Kandidat liefern (SCAN-1)
//
// GRUNDREGEL: Diese Funktion SCHLÄGT VOR. Sie schreibt nichts in den Katalog.
// Eine falsch zugeordnete EAN ist schlimmer als keine — sie zeigt im Laden
// den Score eines ANDEREN Produkts.
//
// v3.3 (2026-11-05, #865 Non-Food-Blocker, Ralph „jaja, bauen“): KEIN LEBENSMITTEL.
//   OFF antwortet bei einem Barcode aus Open Beauty Facts / Open Pet Food Facts mit status 0 und
//   status_verbose "product found with a different product type: beauty|petfood". Dann meldet die
//   Funktion nonfood = "beauty" | "petfood" – Web und App zeigen „Kein Lebensmittel“ statt des
//   Foto-Knopfs, Riki startet gar nicht. "product" (Open Products Facts) sperrt NIE: dort stehen auch
//   Supplements (gemessen 04.11.: 1 von 460 Supplements, Sunday Natural Magnesiumglycinat). Regel von
//   Ralph (04.11.): Supplements muessen durchgehen. Messung: 0 von 479 gescannten und 0 von 400
//   Katalog-Barcodes waeren gesperrt worden.
//   Bis v3.2 lag der Quelltext nur in Supabase; ab v3.3 im Repo (supabase/functions/off-lookup).
// v3.2 (2026-09-10): Packungsmenge fehlt bei OFF oft (P73700: quantity null) - dann zaehlt
//   die Portionsangabe (serving_size "50 g") als Mengenhinweis fuer die Pulver-Falle.
// v3.1 (2026-09-10): Pulver-Falle enger. "protein|pulver|shake" traf 364 Bestandsprodukte,
//   darunter High-Protein-Pudding (80 kcal, richtig) und Muellermilch-Shake (fluessig, richtig).
//   Jetzt: whey|isolat|proteinpulver|eiweisspulver|mahlzeitenersatz ODER (shake/pulver UND
//   Menge in g, nicht ml) UND < 300 kcal.
// v3 (2026-09-10, KP-574, Ralph jaja): PORTIONSRIEGEL. OFF liefert neben den _100g-Werten
//   nutrition_data_per ("100g" | "serving"), serving_quantity und _serving-Werte. Bei P73700
//   standen Portionswerte (50 g) in der 100-g-Spalte: 211 statt 368 kcal. Neu:
//   (a) nutrition_data_per <> 100g  -> Warnung, kein Score;
//   (b) energy-kcal_serving == energy-kcal_100g bei serving_quantity <> 100 -> Portionswert
//       kopiert, kein Score;
//   (c) Portionsfalle fuer Pulver/Shakes.
//   Die Antwort traegt basis_off und portion_off, damit der Server nachvollziehen kann.
// v2 (2026-07-13): Atwater-Schwelle korrigiert: > 20 kcal UND > 30 %.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA = "RootIndex/1.0 (kontakt@root-index.de)";
const FELDER = "code,product_name,brands,quantity,nutriments,ingredients_text_de,ingredients_text,additives_tags,nova_group,nutrition_data_per,serving_size,serving_quantity";

/* v3.3 (#865): nur diese beiden Produktarten von OFF sperren. Nie "product" (dort liegen auch Supplements). */
const NONFOOD_ART: Record<string, string> = { beauty: "Kosmetik", petfood: "Tiernahrung" };
const NONFOOD_MELDUNG = "Kein Lebensmittel – Root Index bewertet nur Lebensmittel und Supplements.";

type Makro = {
  kcal: number | null; protein: number | null; kh: number | null;
  zucker: number | null; fett: number | null; ges_fett: number | null;
  ballaststoffe: number | null; salz: number | null;
};

function makros(n: Record<string, unknown>): Makro {
  const z = (k: string): number | null => {
    const v = n?.[k];
    return typeof v === "number" && isFinite(v) ? v : null;
  };
  return {
    kcal: z("energy-kcal_100g"), protein: z("proteins_100g"), kh: z("carbohydrates_100g"),
    zucker: z("sugars_100g"), fett: z("fat_100g"), ges_fett: z("saturated-fat_100g"),
    ballaststoffe: z("fiber_100g"), salz: z("salt_100g"),
  };
}

// OFF ist eine zulässige Quelle, aber KEINE unfehlbare.
function pruefeMakros(m: Makro, energie_kj: number | null) {
  const warnungen: string[] = [];
  const berechnet =
    4 * (m.protein ?? 0) + 4 * (m.kh ?? 0) + 9 * (m.fett ?? 0) + 2 * (m.ballaststoffe ?? 0);
  let kcal = m.kcal;

  if (kcal !== null && kcal > 0 && berechnet > 0) {
    const abw = Math.abs(kcal - berechnet);
    if (abw > 20 && abw / kcal > 0.30) {
      warnungen.push(
        `kcal (${Math.round(kcal)}) passt nicht zu den Makros — rechnerisch ${Math.round(berechnet)}.`,
      );
      if (energie_kj) {
        const ausKj = energie_kj / 4.184;
        if (Math.abs(ausKj - berechnet) < abw) {
          warnungen.push(`Aus kJ (${energie_kj}) neu berechnet: ${Math.round(ausKj)} kcal.`);
          kcal = Math.round(ausKj);
        }
      }
    }
  }

  if (m.zucker !== null && m.kh !== null && m.zucker > m.kh + 0.5)
    warnungen.push(`Zucker (${m.zucker} g) liegt über den Kohlenhydraten (${m.kh} g) — unmöglich.`);
  if (m.ges_fett !== null && m.fett !== null && m.ges_fett > m.fett + 0.5)
    warnungen.push("Gesättigtes Fett liegt über dem Gesamtfett — unmöglich.");
  if ((m.protein ?? 0) + (m.kh ?? 0) + (m.fett ?? 0) + (m.ballaststoffe ?? 0) > 108)
    warnungen.push("Summe der Makronährstoffe über 100 g — unmöglich.");

  return { kcal, berechnet: Math.round(berechnet), warnungen };
}

// Die Portionsfalle: ein Portionswert ist IN SICH konsistent — Atwater ist dagegen blind.
function portionsfalle(name: string, kcal: number | null, menge: string): string | null {
  if (kcal === null || kcal <= 0) return null;
  const n = name.toLowerCase();
  const q = (menge ?? "").toLowerCase();
  const inGramm = /\d\s*(g|gr|gramm|kg)\b/.test(q) && !/\d\s*(ml|l|liter|cl)\b/.test(q);
  if (/(chips|flips|nachos|cracker)/.test(n) && !/(wrap|tortilla|fladen)/.test(n) && kcal < 400)
    return `${Math.round(kcal)} kcal für ein Chips-Produkt — das ist vermutlich der PORTIONSWERT, nicht der 100-g-Wert.`;
  if (/(nussmus|mandelmus|erdnussmus|nussbutter)/.test(n) && kcal < 450)
    return `${Math.round(kcal)} kcal für Nussmus — vermutlich ein Portionswert.`;
  if (/(\böl\b|olivenöl|rapsöl|sonnenblumenöl)/.test(n) && kcal < 700)
    return `${Math.round(kcal)} kcal für ein Öl — vermutlich ein Portionswert.`;
  // v3.1 (KP-574): Proteinpulver/Shake-Pulver liegen je 100 g praktisch nie unter 300 kcal.
  const pulverWort = /(whey|isolat|proteinpulver|eiwei(ss|ß)pulver|mahlzeitenersatz)/.test(n)
    || (/(shake|pulver)/.test(n) && !/(pudding|backpulver|puddingpulver|saucenpulver|so(ss|ß)enpulver|gewürz)/.test(n) && inGramm);
  if (pulverWort && kcal < 300)
    return `${Math.round(kcal)} kcal für ein Pulver/Shake-Pulver (${menge}) — vermutlich ein Portionswert.`;
  return null;
}

async function holeEan(ean: string) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=${FELDER}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return { gefunden: false, fehler: `OFF antwortete ${r.status}` };
  const j = await r.json();
  if (j.status !== 1 || !j.product) {
    // v3.3 (#865): Barcode steht bei OFF, aber in Open Beauty Facts / Open Pet Food Facts.
    const typ = String(j?.status_verbose ?? "").match(/different product type:\s*([a-z]+)/i)?.[1]?.toLowerCase() ?? "";
    if (NONFOOD_ART[typ]) {
      return { gefunden: false, nonfood: typ, nonfood_art: NONFOOD_ART[typ], meldung: NONFOOD_MELDUNG };
    }
    return { gefunden: false, ...(typ ? { off_produktart: typ } : {}) };
  }

  const p = j.product;
  const nut = p.nutriments ?? {};
  const m = makros(nut);
  const kj = typeof nut["energy-kj_100g"] === "number" ? nut["energy-kj_100g"] : null;
  const check = pruefeMakros(m, kj);
  const name = p.product_name ?? "";
  // v3.2: fehlt die Packungsmenge, zaehlt die Portionsangabe als Mengenhinweis
  const mengeHinweis = String(p.quantity ?? p.serving_size ?? "");
  const falle = portionsfalle(name, check.kcal, mengeHinweis);
  if (falle) check.warnungen.push(falle);

  // v3 (KP-574): Portionsriegel aus den OFF-Metadaten.
  const basisOff: string = String(p.nutrition_data_per ?? "").toLowerCase();
  const portionMenge: number | null = typeof p.serving_quantity === "number" ? p.serving_quantity
    : (typeof p.serving_quantity === "string" && isFinite(Number(p.serving_quantity)) ? Number(p.serving_quantity) : null);
  const kcalServing: number | null = typeof nut["energy-kcal_serving"] === "number" ? nut["energy-kcal_serving"] : null;
  if (basisOff && basisOff !== "100g" && basisOff !== "100ml") {
    check.warnungen.push(`OpenFoodFacts führt die Nährwerte je ${basisOff}${p.serving_size ? ` (${p.serving_size})` : ""}, nicht je 100 g — kein Score aus dieser Quelle.`);
  }
  if (kcalServing !== null && m.kcal !== null && portionMenge !== null && Math.abs(portionMenge - 100) > 1 && Math.abs(kcalServing - m.kcal) < 0.5) {
    check.warnungen.push(`Portionswert (${portionMenge} g) und 100-g-Wert sind identisch (${Math.round(m.kcal)} kcal) — der Portionswert wurde kopiert.`);
  }

  const vollstaendig = check.kcal !== null && m.protein !== null && m.kh !== null && m.fett !== null;
  const sauber = vollstaendig && check.warnungen.length === 0;

  return {
    gefunden: true,
    ean: p.code,
    name,
    marke: p.brands ?? null,
    menge: p.quantity ?? null,
    zutaten_text: p.ingredients_text_de ?? p.ingredients_text ?? null,
    zusatzstoffe: (p.additives_tags ?? []).map((t: string) => t.replace(/^en:/, "").toUpperCase()),
    nova: p.nova_group ?? null,
    naehrwerte: { ...m, kcal: check.kcal },
    kcal_berechnet: check.berechnet,
    basis_off: basisOff || null,
    portion_off: { menge: portionMenge, text: p.serving_size ?? null, kcal: kcalServing },
    vollstaendig,
    warnungen: check.warnungen,
    guete: sauber ? "vorlaeufig" : vollstaendig ? "zweifelhaft" : "unvollstaendig",
    hinweis: sauber
      ? "Berechnet aus OpenFoodFacts-Daten. Root Index hat dieses Produkt noch nicht geprüft."
      : "Die OpenFoodFacts-Daten zu diesem Produkt sind unstimmig. Wir zeigen keinen Score, bis das geklärt ist.",
    score_erlaubt: sauber,
  };
}

async function sucheKandidat(
  marke: string, name: string,
  unser: { kcal: number | null; protein: number | null; fett: number | null },
) {
  const q = `${marke} ${name}`.trim();
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,brands,nutriments`;

  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return { status: "fehler", grund: `OFF antwortete ${r.status}` };
  const j = await r.json();
  const treffer = j.products ?? [];
  if (!treffer.length) return { status: "kein_treffer", suchbegriff: q };
  if (unser.kcal === null)
    return { status: "keine_gegenprobe_moeglich", grund: "Eigene Nährwerte fehlen", suchbegriff: q };

  let best: Record<string, unknown> | null = null;
  let bestAbw = Infinity;

  for (const p of treffer) {
    const m = makros(p.nutriments ?? {});
    if (m.kcal === null || m.kcal <= 0) continue;

    let abw = Math.abs(m.kcal - unser.kcal) / Math.max(unser.kcal, 1);
    if (unser.protein !== null && m.protein !== null)
      abw += 0.5 * Math.abs(m.protein - unser.protein) / Math.max(unser.protein, 1);
    if (unser.fett !== null && m.fett !== null)
      abw += 0.5 * Math.abs(m.fett - unser.fett) / Math.max(unser.fett, 1);

    if (abw < bestAbw) {
      bestAbw = abw;
      best = {
        ean: p.code, off_name: p.product_name, off_marke: p.brands,
        off_kcal: m.kcal, off_protein: m.protein, off_fett: m.fett,
        abweichung: Math.round(abw * 1000) / 1000,
      };
    }
  }

  if (!best) return { status: "kein_treffer_mit_naehrwerten", suchbegriff: q };

  const status = bestAbw < 0.12 ? "sicher" : bestAbw < 0.35 ? "pruefen" : "zu_unsicher";
  return { status, suchbegriff: q, unser, kandidat: best };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const mode = body.mode ?? "ean";

    if (mode === "ean") {
      if (!body.ean) throw new Error("ean fehlt");
      return new Response(JSON.stringify(await holeEan(String(body.ean))), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (mode === "suche") {
      if (!body.marke || !body.name) throw new Error("marke und name werden benötigt");
      const r = await sucheKandidat(String(body.marke), String(body.name), {
        kcal: body.kcal ?? null, protein: body.protein ?? null, fett: body.fett ?? null,
      });
      return new Response(JSON.stringify(r), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unbekannter mode: ${mode}`);
  } catch (e) {
    return new Response(JSON.stringify({ status: "fehler", grund: String(e?.message ?? e) }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
