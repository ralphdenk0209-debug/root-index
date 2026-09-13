// etikett-belegpruefung — Gegenprobe am Altbestand (Work KV-495)
//
// 04.09.2026, Ralph-Entscheid Variante A.
//
// Der Riegel aus KV-488 schuetzt neue Etikettlaeufe: erfindet RIKI Zutaten,
// obwohl auf keinem Foto ein Zutatenverzeichnis steht, werden sie verworfen.
// Produkte, die vorher entstanden sind, tragen ihre erfundenen Zutaten weiter.
//
// Diese Funktion stellt genau eine Frage je Produkt - dieselbe enge Frage wie
// der Riegel, ohne den teuren Lesevorgang drumherum. Rund 0,005 USD statt
// 0,035 USD je Produkt.
//
// Sie aendert NICHTS am Produkt. Sie schreibt nur ihren Befund nach
// shadow_v1.etikett_belegpruefung. Was mit den Treffern geschieht, entscheidet
// Ralph, nachdem die Zahlen vorliegen.
//
// Aufruf:
//   POST { "limit": 20 }                 20 ungepruefte Produkte
//   POST { "produkt_id": "P73692" }      genau eines
//   POST { "limit": 5, "trockenlauf": true }   fragt nichts, zeigt nur die Auswahl

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

// Wortgleich mit riki-etikett: der Schluessel liegt nicht ueberall unter
// demselben Namen, erkannt wird er am Praefix. Ein eigener Suchweg hier haette
// beim ersten Lauf 500 geliefert - genau das ist passiert.
function findeKey(): string {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  }
  return "";
}

// Wortgleich mit dem Riegel in riki-etikett. Zwei Formulierungen fuer dieselbe
// Frage waeren zwei Wahrheiten.
const FRAGE =
  "Beantworte genau zwei Fragen zu diesen Fotos, ohne zu raten.\n" +
  "1. Steht auf einem der Fotos ein Zutatenverzeichnis - also eine Aufzaehlung " +
  "der Zutaten, meist nach dem Wort \"Zutaten\"? Eine Naehrwerttabelle ist KEIN " +
  "Zutatenverzeichnis. Ein Werbetext oder ein Rezept ist KEIN Zutatenverzeichnis.\n" +
  "2. Welcher Markenname steht auf der Vorderseite der Packung? Ein Bio-Siegel " +
  "oder ein Anbauverband wie Bioland ist KEINE Marke. Wenn du keinen Markennamen " +
  "sicher liest: UNBEKANNT.\n" +
  "Antworte in genau einer Zeile im Format: JA|Markenname  oder  NEIN|UNBEKANNT";

async function frage(
  fotos: string[],
  key: string,
  modell: string,
): Promise<{ antwort: string; marke: string | null; inTok: number; outTok: number }> {
  const inhalt: unknown[] = [];
  for (const b64 of fotos.slice(0, 3)) {
    const m = String(b64).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) inhalt.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!inhalt.length) return { antwort: "keine_fotos", marke: null, inTok: 0, outTok: 0 };
  inhalt.push({ type: "text", text: FRAGE });

  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modell, max_tokens: 30, messages: [{ role: "user", content: inhalt }] }),
  });
  const j = await ai.json();
  if (!ai.ok) return { antwort: "unklar", marke: null, inTok: 0, outTok: 0 };
  const usage: any = j.usage ?? {};
  const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);
  const outTok = usage.output_tokens ?? 0;
  const roh = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
  const [links, rechts] = roh.split("|").map((s: string) => (s ?? "").trim());
  const l = (links ?? "").toLowerCase();
  const antwort = /^ja\b/.test(l) ? "ja" : /^nein\b/.test(l) ? "nein" : "unklar";
  let marke: string | null = (rechts ?? "").trim();
  if (!marke || /^unbekannt$/i.test(marke) || marke.length > 60) marke = null;
  return { antwort, marke, inTok, outTok };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const antworte = (k: unknown, status = 200) =>
    new Response(JSON.stringify(k), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  let eingabe: any = {};
  try { eingabe = await req.json(); } catch { eingabe = {}; }
  const produktId: string | null = typeof eingabe.produkt_id === "string" ? eingabe.produkt_id : null;
  const grenze = Math.min(Math.max(Number(eingabe.limit ?? 10) || 10, 1), 50);
  const trockenlauf = eingabe.trockenlauf === true;
  const modell: string = eingabe.modell ?? "claude-haiku-4-5-20251001";
  const preis = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];

  const key = findeKey();
  if (!key && !trockenlauf) return antworte({ ok: false, fehler: "Kein Anthropic-Key hinterlegt." }, 500);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Kandidaten: Etikettfoto-Produkte, deren Fotos noch da sind und die noch
  // nicht geprueft wurden. Wer keine Fotos mehr hat, ist nicht pruefbar - das
  // steht in KV-495 als eigener offener Punkt.
  let frageProdukte = db.from("Produkte").select('"Produkt_ID"').eq("Quelle_Typ", "Etikettfoto").order("Produkt_ID");
  if (produktId) frageProdukte = frageProdukte.eq("Produkt_ID", produktId);
  const { data: kandidaten, error: fehlerLesen } = await frageProdukte;
  if (fehlerLesen) return antworte({ ok: false, fehler: fehlerLesen.message }, 500);

  const ids = (kandidaten ?? []).map((p: any) => p.Produkt_ID);
  // NICHT db.schema("shadow_v1") verwenden: das Schema ist nach aussen nicht
  // offen, die Abfrage liefert still nichts und jeder Lauf prueft dieselben
  // Produkte erneut. Genau das ist am 04.09. passiert - 42 Zeilen fuer 20
  // Produkte. Derselbe Fehler steckte in quelle-abruf-einfach (KP-373).
  // Der Weg nach draussen ist immer eine Sicht oder eine Funktion in public.
  const { data: schonGeprueft } = await db
    .from("v_etikett_belegpruefung").select("produkt_id").in("produkt_id", ids);
  const fertig = new Set((schonGeprueft ?? []).map((r: any) => r.produkt_id));

  const { data: scans } = await db.from("Scan_Warteschlange")
    .select('"Produkt_ID","Fotos_Base64"').in("Produkt_ID", ids);
  const fotosJe = new Map<string, string[]>();
  for (const s of scans ?? []) {
    const f = Array.isArray((s as any).Fotos_Base64) ? (s as any).Fotos_Base64 : [];
    if (f.length && !fotosJe.has((s as any).Produkt_ID)) fotosJe.set((s as any).Produkt_ID, f);
  }

  const offen = ids.filter((id: string) => (produktId ? true : !fertig.has(id)) && fotosJe.has(id)).slice(0, grenze);
  if (trockenlauf) {
    return antworte({ ok: true, trockenlauf: true, kandidaten: ids.length, mit_fotos: fotosJe.size, schon_geprueft: fertig.size, wuerde_pruefen: offen });
  }

  const faelle: unknown[] = [];
  let kostenSumme = 0;
  for (const pid of offen) {
    const fotos = fotosJe.get(pid) ?? [];
    const a = await frage(fotos, key, modell);
    const kosten = (a.inTok / 1e6) * preis.in + (a.outTok / 1e6) * preis.out;
    kostenSumme += kosten;
    if (a.inTok || a.outTok) {
      await db.rpc("cb_riki_buchen", { p_modus: "etikett-belegpruefung", p_modell: modell, p_in: a.inTok, p_out: a.outTok, p_kosten: Number(kosten.toFixed(6)), p_produkt_id: pid, p_erfolg: true, p_fehler: null });
    }
    const { data: gespeichert, error: fehlerSchreiben } = await db.rpc("cb_etikett_belegpruefung_setzen", {
      p_produkt_id: pid,
      p_antwort: a.antwort,
      p_fotos_geprueft: fotos.length,
      p_marke_gelesen: a.marke,
      p_kosten_usd: Number(kosten.toFixed(6)),
      p_evidence: { work_id: 495, modell },
    });
    faelle.push({ produkt_id: pid, antwort: a.antwort, marke_gelesen: a.marke, gespeichert: gespeichert ?? null, fehler: fehlerSchreiben?.message ?? null });
    await new Promise((r) => setTimeout(r, 200));
  }

  return antworte({
    ok: true,
    geprueft: faelle.length,
    ja: faelle.filter((f: any) => f.antwort === "ja").length,
    nein: faelle.filter((f: any) => f.antwort === "nein").length,
    unklar: faelle.filter((f: any) => f.antwort === "unklar").length,
    kosten_usd: Number(kostenSumme.toFixed(4)),
    faelle,
  });
});
