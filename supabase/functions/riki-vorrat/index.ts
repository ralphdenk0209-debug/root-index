// RIKI-VORRAT v15 — aus Kühlschrank-/Vorratsfotos erkennen, WAS da ist.
//
// Ralph, 19.09.2026: „beide, welche produkte und daraus dann rezepte generieren.
// erkennen ist wichtig."
//
// GEMESSEN am Quelltext der Fassung v14, drei Ursachen für die schwache Qualität:
//
// 1. MODELL. v14 stand auf Haiku, und das Web übergab nie ein Modell — also lief
//    jeder Vorratslauf auf Haiku. Das Etikettlesen nutzt dagegen seit jeher
//    Sonnet (RIKI_LESE_MODELL): 237 Läufe, 0 Fehler. Ein Kühlschrankfoto mit
//    dreißig kleinen Etiketten ist schwerer als ein einzelnes Etikett aus
//    30 cm Abstand, lief aber auf dem schwächeren Modell. Jetzt Sonnet als
//    Standard, Haiku nur auf ausdrückliche Anfrage.
//
// 2. DAS REGELWERK VERBOT, WAS RALPH WILL. Es sagte „Gib generische deutsche
//    Zutatennamen" und „Rate keine Marken", dazu „dreimal Joghurt = EINMAL
//    Joghurt". Damit konnte kein Modell Produkte liefern, egal wie gut es ist.
//    Jetzt zwei getrennte Listen: `produkte` mit Marke, wo das Etikett lesbar
//    ist, und `zutaten` generisch für den Rezeptvorschlag. Beides aus einem Lauf.
//
// 3. BILDER WURDEN STILL VERWORFEN. slice(0,3) — Ralph schickte vier Fotos, das
//    vierte fiel weg, ohne dass irgendwo etwas davon stand. Jetzt bis zu sechs,
//    und was darüber liegt, steht als Warnung in der Antwort.
//
// OBERSTE REGEL BLEIBT: NICHTS ERFINDEN. Eine geratene Zutat ist eine Lüge.

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

/** Dasselbe Modell, mit dem das Etikettlesen arbeitet. */
const STANDARD_MODELL = "claude-sonnet-4-6";
const MAX_BILDER = 6;

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  }
  return null;
}

const REGELWERK = `Du bist RIKI, die Vorrats-Erkennung von Root Index.

AUFGABE: Auf Fotos von Kühlschrank, Vorratsschrank oder Küchentheke erkennst du, WAS da ist.
Zwei Dinge in einem Durchgang:
  1. PRODUKTE - was konkret im Regal steht, mit Marke, wenn du sie lesen kannst.
  2. ZUTATEN - dieselben Dinge generisch, als Grundlage für einen Rezeptvorschlag.

OBERSTE REGEL: NICHTS ERFINDEN.
Nenne nur, was du WIRKLICH SIEHST. Eine geratene Zutat ist eine Lüge. Was du nicht sicher
identifizieren kannst, gehört nach "unsicher" oder gar nicht in die Antwort.

SO LIEST DU EIN BILD:
- Geh systematisch vor: Fach für Fach, links nach rechts. Auch Türfächer und hintere Reihen.
- LIES DIE ETIKETTEN. Marke und Produktname stehen meist darauf - das ist keine Raterei,
  sondern Ablesen. Steht die Marke da, nenn sie. Steht sie nicht oder ist sie verdeckt,
  lass das Markenfeld leer und nenn nur das Produkt.
- Beschriftete Vorratsdosen: die Aufschrift ist die Antwort ("Chia Samen", "Kichererbsen").
- Durchsichtige Dosen ohne Aufschrift: nenne, was du am Inhalt erkennst (Reis, Linsen), sonst nichts.
- Ein angeschnittenes oder halb verdecktes Etikett darfst du nennen, wenn genug lesbar ist,
  um sicher zu sein - sonst nach "unsicher".

PRODUKTE (Feld "produkte"):
- Ein Eintrag je unterscheidbarem Produkt. Vier Becher derselben Sorte sind EIN Eintrag mit anzahl 4.
- Zwei verschiedene Joghurts sind ZWEI Einträge - hier wird NICHT zusammengefasst.
- Felder: name (was es ist, ohne Marke), marke (oder null), anzahl (wenn zählbar, sonst null),
  sicher (true = klar gelesen, false = wahrscheinlich, aber nicht zweifelsfrei).

ZUTATEN (Feld "zutaten"):
- Generische deutsche Namen (Joghurt, Quark, Frischkäse, Kefir, Butter, Haferflocken, Mandelmus).
- HIER wird zusammengefasst: drei Joghurtsorten = einmal "Joghurt".
- Das ist die Liste, aus der später Rezepte entstehen - sie soll kochbar sein, nicht vollständig.

NICHT AUFNEHMEN:
- Alles, was man nicht isst: Geräte, Behälter, Küchenrolle, Toilettenpapier, Deko, Putzmittel.
- Mengen in Gramm oder Litern - Packungsgrößen schätzt du nicht.

"unsicher": Dinge, die du vermutest, aber nicht sicher bist - der Nutzer prüft und streicht.
"warnungen": nur echte Probleme ("Bild zu dunkel", "hintere Reihe nicht lesbar").

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "produkte": [ { "name": string, "marke": string|null, "anzahl": number|null, "sicher": boolean } ],
  "zutaten": [ string ],
  "unsicher": [ string ],
  "warnungen": [ string ]
}`;

function saeubere(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const n = String(x ?? "").trim();
    if (!n) continue;
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out.slice(0, 80);
}

type Produkt = { name: string; marke: string | null; anzahl: number | null; sicher: boolean };

function saeubereProdukte(arr: unknown): Produkt[] {
  if (!Array.isArray(arr)) return [];
  const out: Produkt[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    const marke = o.marke == null ? null : String(o.marke).trim() || null;
    const k = (marke ?? "").toLowerCase() + "|" + name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const anzahlRoh = Number(o.anzahl);
    out.push({
      name, marke,
      anzahl: Number.isFinite(anzahlRoh) && anzahlRoh > 0 ? Math.round(anzahlRoh) : null,
      sicher: o.sicher !== false,
    });
  }
  return out.slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const key = findeKey();
  if (!key) {
    return new Response(JSON.stringify({ error: "Kein Anthropic-Key hinterlegt." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Bitte anmelden." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // 02.10.2026 (Ralph): kostenpflichtige RIKI-Funktion nur mit Premium.
    const { data: premiumRaw } = await sb.rpc("cb_riki_premium_check", { p_feature: "ki_premium" });
    const premium: any = Array.isArray(premiumRaw) ? premiumRaw[0] : premiumRaw;
    if (premium?.erlaubt !== true) {
      const grund = premium?.grund ?? "Diese RIKI-Funktion gehört zu Premium.";
      return new Response(JSON.stringify({ ok: false, error: grund, fehler: grund, premium: false }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Kostenbremse: Tageslimit pro Nutzer + Monatsbudget. Zaehlt seit dem
    // 19.09.2026 auch die Vorratslaeufe, obwohl sie als eigener Modus buchen.
    const { data: limitRaw, error: limitErr } = await sb.rpc("cb_riki_etikett_limit_check");
    if (limitErr) {
      return new Response(JSON.stringify({ error: "Limit-Pruefung fehlgeschlagen: " + limitErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const limit: any = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;
    if (limit?.erlaubt !== true) {
      return new Response(JSON.stringify({
        error: limit?.grund ?? "Limit erreicht.",
        heute_genutzt: limit?.heute_genutzt, limit_tag: limit?.limit_tag,
      }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const alleBilder: string[] = Array.isArray(body.bilder) ? body.bilder : [];
    const bilder = alleBilder.slice(0, MAX_BILDER);
    const verworfen = Math.max(0, alleBilder.length - bilder.length);
    if (!bilder.length) {
      return new Response(JSON.stringify({ error: "Keine Bilder uebergeben." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const inhalt: unknown[] = [];
    for (const b64 of bilder) {
      const m = String(b64).match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!m) continue;
      inhalt.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
    }
    if (!inhalt.length) {
      return new Response(JSON.stringify({ error: "Bilder konnten nicht gelesen werden." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const fotoZahl = inhalt.length;

    inhalt.push({ type: "text", text:
      `Erkenne auf ${fotoZahl > 1 ? "diesen " + fotoZahl + " Fotos" : "diesem Foto"} die vorhandenen ` +
      "Lebensmittel. Geh Fach fuer Fach vor und lies die Etiketten - Marke und Produktname stehen darauf. " +
      "Gib BEIDES zurueck: produkte (konkret, mit Marke wo lesbar) und zutaten (generisch, fuer Rezepte). " +
      "Nichts raten, keine Mengen, nichts Ungeniessbares." });

    const modell: string = typeof body.modell === "string" && body.modell.trim()
      ? body.modell.trim() : STANDARD_MODELL;
    const t0 = Date.now();

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        max_tokens: 4000,
        system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: inhalt }],
      }),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "vorrat", p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki konnte die Fotos nicht auswerten." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let erg: any = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      erg = JSON.parse(m ? m[0] : text);
    } catch { erg = null; }

    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell] ?? PREISE[STANDARD_MODELL];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;

    await sb.rpc("cb_riki_buchen", { p_modus: "vorrat", p_modell: modell,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: null, p_erfolg: true, p_fehler: null });

    if (!erg) {
      return new Response(JSON.stringify({ error: "Riki hat kein verwertbares Ergebnis geliefert." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const produkte = saeubereProdukte(erg.produkte);
    let zutaten = saeubere(erg.zutaten);
    const unsicher = saeubere(erg.unsicher);
    const warnungen = Array.isArray(erg.warnungen) ? erg.warnungen.map((x: unknown) => String(x)).filter(Boolean) : [];

    // Faellt die Zutatenliste aus, ist die Produktliste die naechstbeste
    // Grundlage - lieber daraus ableiten als dem Nutzer nichts geben.
    if (!zutaten.length && produkte.length) {
      zutaten = saeubere(produkte.map((p) => p.name));
    }

    if (verworfen > 0) {
      warnungen.push(`Nur die ersten ${MAX_BILDER} Fotos wurden ausgewertet, ${verworfen} weitere nicht.`);
    }
    if (!produkte.length && !zutaten.length && !unsicher.length) {
      warnungen.push("Auf den Fotos konnte Riki nichts sicher erkennen. Fotografier näher dran oder tipp die Zutaten selbst ein.");
    }

    return new Response(JSON.stringify({
      produkte, zutaten, unsicher, warnungen,
      hinweis: "Von Riki aus deinen Fotos erkannt. Prüf die Liste - streich, was nicht stimmt, ergänz, was fehlt.",
      meta: {
        modell, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
        fotos: fotoZahl, fotos_verworfen: verworfen,
        produkte_gefunden: produkte.length, zutaten_gefunden: zutaten.length,
        heute_genutzt: (limit?.heute_genutzt ?? 0) + 1, limit_tag: limit?.limit_tag,
      },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
