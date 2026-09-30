// riki-mahlzeit — RIKI "Mahlzeit fotografieren -> Allergene" (30.09.2026)
//
// Phase 1 (Ralph): nur Admin-Test. Neue Funktion, fasst die Maschine nicht an.
// Das Modell erkennt NUR, was auf dem Teller ist, und nennt dazu moegliche
// Allergene (EU-14-Schluessel wie cb_allergen_liste). Ob etwas den Nutzer
// betrifft, entscheidet cb_mahlzeit_abgleich in der Datenbank - an das Modell
// geht nur das Foto, keine Gesundheitsdaten.
//
// Modelle (nur der vorhandene Anthropic-Schluessel): Sonnet 5.5, Opus 5.5, Fable 5.1.
// Kosten werden je Aufruf gebucht (cb_riki_buchen) und in Riki_Mahlzeit_Analyse
// abgelegt; Tagesdeckel 2 USD ueber cb_mahlzeit_deckel.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODELLE: Record<string, { id: string; in: number; out: number; name: string }> = {
  sonnet: { id: "claude-sonnet-5-5", in: 2.0, out: 10.0, name: "Sonnet 5.5" },
  opus:   { id: "claude-opus-5-5",   in: 4.0, out: 20.0, name: "Opus 5.5" },
  fable:  { id: "claude-fable-5-1",  in: 10.0, out: 50.0, name: "Fable 5.1" },
};

const ALLERGENE = ["gluten","krebstiere","ei","fisch","erdnuss","soja","milch","laktose",
  "schalenfruechte","sellerie","senf","sesam","sulfite","lupinen","weichtiere"];

const PROMPT = `Du siehst ein Foto einer Mahlzeit. Aufgabe: erkennen, was darauf ist, und moegliche Allergene nennen.
Regeln:
- Beurteile nur, was du siehst. Schaetze Mengen nach der sichtbaren Portion auf dem Foto, nicht nach Standardportionen.
- "sicherheit": "sicher" = klar erkennbar; "wahrscheinlich" = sehr naheliegend; "typisch" = nicht sichtbar, steckt aber in solchen Gerichten meist drin (z. B. Butter in Soße, Ei in Panade).
- Allergene nur aus dieser Liste: ${ALLERGENE.join(", ")}. "laktose" nur zusaetzlich zu "milch", wenn das Milchprodukt laktosehaltig ist.
- Keine Entwarnung erfinden: Wenn du etwas nicht beurteilen kannst, schreib es in "unsicher".
- Kein Essen erkennbar -> "gericht": null und leere Listen.
Gib das Ergebnis ausschliesslich ueber das Werkzeug "mahlzeit_ergebnis" zurueck.`;

// Strukturierte Ausgabe ueber ein Werkzeug: kein freies JSON, das ein Modell mal falsch schliesst
// (Opus lieferte beim ersten Test ein kaputtes Array).
const WERKZEUG = {
  name: "mahlzeit_ergebnis",
  description: "Ergebnis der Mahlzeit-Erkennung",
  input_schema: {
    type: "object",
    properties: {
      gericht: { type: ["string", "null"], description: "kurzer Name auf Deutsch" },
      bestandteile: { type: "array", items: { type: "object", properties: {
        name: { type: "string" },
        sicherheit: { type: "string", enum: ["sicher", "wahrscheinlich", "typisch"] },
        menge_g: { type: "number" },
        allergene: { type: "array", items: { type: "string", enum: ALLERGENE } },
      }, required: ["name", "sicherheit", "allergene"] } },
      versteckt_moeglich: { type: "array", items: { type: "object", properties: {
        allergen: { type: "string", enum: ALLERGENE }, grund: { type: "string" } }, required: ["allergen"] } },
      unsicher: { type: "string" },
      kcal_geschaetzt: { type: "number" },
    },
    required: ["gericht", "bestandteile", "versteckt_moeglich"],
  },
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function parseJson(text: string): any {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Keine JSON-Antwort vom Modell.");
  return JSON.parse(text.slice(a, b + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const key = findeKey();
  if (!key) return json({ error: "Kein Anthropic-Schluessel gefunden." }, 500);

  let body: any = {};
  try { body = await req.json(); } catch (_e) { body = {}; }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });

  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json({ error: "Nicht angemeldet." }, 401);
  const { data: istAdmin } = await sb.rpc("cb_ist_admin");
  if (istAdmin !== true) return json({ error: "Diese Funktion ist noch in der Testphase (nur Admin)." }, 403);

  const { data: dk } = await sb.rpc("cb_mahlzeit_deckel");
  const d: any = Array.isArray(dk) ? dk[0] : dk;
  if (d && d.erlaubt === false) return json({ error: `Tagesdeckel erreicht (${Number(d.heute_usd).toFixed(2)} von ${d.deckel_usd} USD).` }, 429);

  const m = MODELLE[String(body.modell || "sonnet")] ?? MODELLE.sonnet;
  const bild = String(body.bild || "");
  const typ = String(body.typ || "image/jpeg");
  // Testweg (nur Admin): Foto per Adresse statt Upload, z. B. freie Testbilder von Wikimedia.
  const bildUrl = typeof body.bild_url === "string" && /^https:\/\/[^\s]+$/.test(body.bild_url) ? body.bild_url : "";
  if (!bildUrl && (!bild || bild.length < 1000)) return json({ error: "Kein Foto erhalten." }, 400);
  if (bild.length > 7_000_000) return json({ error: "Foto zu groß – bitte kleiner aufnehmen." }, 413);

  const start = Date.now();
  let inTok = 0, outTok = 0, kosten = 0;
  try {
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: m.id,
        max_tokens: 2000,
        tools: [WERKZEUG],
        // Erzwingen (tool_choice "tool") lehnen Sonnet/Opus/Fable 5.x ab - "auto" + klare Anweisung.
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: [
          { type: "image", source: bildUrl ? { type: "url", url: bildUrl } : { type: "base64", media_type: typ, data: bild } },
          { type: "text", text: PROMPT },
        ] }],
      }),
    });
    const r = await ai.json();
    if (!ai.ok) throw new Error(r?.error?.message || ("Modellfehler " + ai.status));
    inTok = r?.usage?.input_tokens ?? 0; outTok = r?.usage?.output_tokens ?? 0;
    kosten = (inTok * m.in + outTok * m.out) / 1_000_000;
    const tu = (r?.content || []).find((c: any) => c?.type === "tool_use");
    const erg: any = tu?.input ?? parseJson((r?.content || []).map((c: any) => c?.text || "").join(""));

    // Nur bekannte Allergen-Schluessel durchlassen (was das Modell schreibt, ist ungeprueft).
    const sauber = (l: any) => (Array.isArray(l) ? l : []).map((x: any) => String(x).toLowerCase().trim()).filter((x: string) => ALLERGENE.includes(x));
    erg.bestandteile = (Array.isArray(erg.bestandteile) ? erg.bestandteile : []).map((b: any) => ({
      name: String(b?.name || "").slice(0, 80),
      sicherheit: ["sicher", "wahrscheinlich", "typisch"].includes(b?.sicherheit) ? b.sicherheit : "wahrscheinlich",
      menge_g: Number(b?.menge_g) > 0 ? Math.round(Number(b.menge_g)) : null,
      allergene: sauber(b?.allergene),
    }));
    erg.versteckt_moeglich = (Array.isArray(erg.versteckt_moeglich) ? erg.versteckt_moeglich : [])
      .filter((v: any) => ALLERGENE.includes(String(v?.allergen || "").toLowerCase()))
      .map((v: any) => ({ allergen: String(v.allergen).toLowerCase(), grund: String(v?.grund || "").slice(0, 160) }));

    const alle = new Set<string>();
    erg.bestandteile.forEach((b: any) => b.allergene.forEach((a: string) => alle.add(a)));
    erg.versteckt_moeglich.forEach((v: any) => alle.add(v.allergen));
    const { data: abgleich } = await sb.rpc("cb_mahlzeit_abgleich", { p_allergene: [...alle] });

    const dauer = Date.now() - start;
    const { data: id } = await sb.rpc("cb_mahlzeit_speichern", {
      p_modell: m.id, p_ergebnis: erg, p_in: inTok, p_out: outTok, p_kosten: kosten, p_dauer_ms: dauer });
    await sb.rpc("cb_riki_buchen", { p_modus: "mahlzeit", p_modell: m.id, p_in: inTok, p_out: outTok, p_kosten: kosten });

    return json({ ok: true, id, modell: m.name, ergebnis: erg, allergene: [...alle], abgleich,
      meta: { input_token: inTok, output_token: outTok, kosten_usd: Number(kosten.toFixed(5)), dauer_ms: dauer } });
  } catch (e) {
    try { await sb.rpc("cb_riki_buchen", { p_modus: "mahlzeit", p_modell: m.id, p_in: inTok, p_out: outTok, p_kosten: kosten, p_erfolg: false, p_fehler: String((e as Error)?.message || e).slice(0, 300) }); } catch (_e) { /* egal */ }
    return json({ error: String((e as Error)?.message || e) }, 502);
  }
});
