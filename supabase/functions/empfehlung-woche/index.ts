// EMPFEHLUNG-WOCHE — RIKI schreibt einmal pro Woche die Empfehlungen zum
// eigenen Verhalten. Ralph, 11.09.2026: "1x pro woche reicht und da nehmen wir
// sonnet."
//
// Drei Bremsen, damit das nie teuer wird:
//   1. Hoechstens alle 7 Tage je Nutzer.
//   2. Haben sich die Gewohnheiten nicht geaendert (gleicher Kontext-Hash),
//      wird der alte Text weiterbenutzt — auch nach 7 Tagen.
//   3. Dieselbe Tages-/Monatsbremse wie bei den anderen RIKI-Wegen.
//
// Faellt das Modell aus, fehlt der TEXT, nicht die Seite: die kostenlosen
// Regeln aus cb_empfehlungen stehen unabhaengig davon darunter.
//
// Die Zahlen im Prompt kommen aus cb_empfehlung_kontext — gemessen an den
// eigenen Daten. Das Modell darf formulieren, nicht rechnen.
//
// ---------------------------------------------------------------------------
// LM-STUDIO-TESTPFAD (Ralph, 11.09.2026: "nur fuer mich zum testen")
//
// Die Cloud kann ein LM Studio auf Ralphs Rechner NICHT anrufen — es steht
// hinter seinem Router, nicht im Netz. Deshalb derselbe Weg wie beim
// lmstudio-product-agent: der ORT DES MODELLS holt sich die Arbeit ab.
//   modus "prompt" : gibt den fertigen Prompt heraus, den Sonnet bekaeme.
//                    Zum Hineinkopieren in LM Studio.
//   modus "lokal"  : nimmt die Antwort des lokalen Modells entgegen und
//                    speichert sie wie einen RIKI-Text — Kosten 0.
// Beide nur fuer Admins: es ist ein Testpfad, kein Produktweg.

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
const MODELL = "claude-sonnet-4-6";
const TAGE_BIS_NEU = 7;

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  }
  return null;
}

async function hashVon(x: unknown): Promise<string> {
  const daten = new TextEncoder().encode(JSON.stringify(x ?? {}));
  const roh = await crypto.subtle.digest("SHA-256", daten);
  return Array.from(new Uint8Array(roh)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const REGELWERK = `Du bist RIKI, der Begleiter von Root Index. Du schreibst einem Nutzer
einmal pro Woche drei kurze Empfehlungen zu seinem eigenen Essen und Training.

DU BEKOMMST NUR GEMESSENE DATEN. Alles, was du schreibst, muss sich aus ihnen ergeben.

OBERSTE REGELN:
1. RECHNE NICHTS AUS und erfinde keine Zahl. Nenne nur Zahlen, die im Kontext stehen.
   Steht etwas nicht drin, schreib nicht darueber.
2. KEINE GESUNDHEITS- ODER HEILVERSPRECHEN, keine Diagnosen, keine Warnungen vor
   Krankheiten. Kein "entgiftend", kein "boostet", kein "gefaehrlich".
3. Kein erhobener Zeigefinger. Der Nutzer macht das freiwillig. Du beschreibst, was
   auffaellt, und machst EINEN konkreten, machbaren Vorschlag.
4. Beruecksichtige den AUFWAND: Fruehstueck darf hoechstens ein paar Minuten kosten,
   abends darf es laenger dauern.
5. Deutsch, Du-Form, ruhig und klar. Jede Empfehlung hoechstens zwei Saetze.
6. Wiederhole nicht dreimal dasselbe. Wenn die Daten nur fuer eine Empfehlung reichen,
   gib eine — lieber weniger als erfunden.

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "texte": [
    { "titel": string, "text": string, "warum": string, "art": "mahlzeit"|"training"|"allgemein" }
  ]
}
"warum" nennt die Zahl aus dem Kontext, auf die sich die Empfehlung stuetzt.`;

const frageVon = (kontext: unknown) =>
  "Hier sind meine gemessenen Daten der letzten Wochen:\n" + JSON.stringify(kontext) +
  "\n\nSchreib mir hoechstens drei kurze Empfehlungen.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const modus = String(body?.modus ?? "").trim();

  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Bitte anmelden." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: kontext, error: kErr } = await sb.rpc("cb_empfehlung_kontext");
    if (kErr) {
      return new Response(JSON.stringify({ error: "Kontext nicht lesbar: " + kErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const hash = await hashVon(kontext);

    // --- Testpfade, nur fuer Admins ---------------------------------------
    if (modus === "prompt" || modus === "lokal") {
      const { data: istAdmin } = await sb.rpc("cb_ist_admin");
      if (istAdmin !== true) {
        return new Response(JSON.stringify({ error: "Nur fuer Admins." }),
          { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      if (modus === "prompt") {
        return new Response(JSON.stringify({
          system: REGELWERK,
          frage: frageVon(kontext),
          kontext,
          hash,
          hinweis: "In LM Studio: System-Prompt und Frage einsetzen, Antwort als JSON zurueckgeben.",
        }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }

      // modus "lokal": die Antwort des lokalen Modells entgegennehmen.
      let texte: any[] = [];
      const roh = body?.antwort ?? body?.texte;
      try {
        const erg = typeof roh === "string" ? JSON.parse((roh.match(/\{[\s\S]*\}/) ?? [roh])[0]) : roh;
        texte = Array.isArray(erg) ? erg : (Array.isArray(erg?.texte) ? erg.texte : []);
      } catch { texte = []; }
      texte = texte.slice(0, 3);

      if (!texte.length) {
        return new Response(JSON.stringify({ error: "Kein verwertbares JSON. Erwartet wird {\"texte\":[{titel,text,warum,art}]}." }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      const lokalesModell = String(body?.modell ?? "lmstudio-lokal").slice(0, 80);
      // Kosten 0 - das Modell laeuft auf eigener Hardware. Trotzdem gebucht,
      // damit der Vergleich in derselben Uebersicht steht wie die bezahlten.
      await sb.rpc("cb_riki_buchen", { p_modus: "empfehlung", p_modell: lokalesModell,
        p_in: Number(body?.tokens_in ?? 0), p_out: Number(body?.tokens_out ?? 0),
        p_kosten: 0, p_produkt_id: null, p_erfolg: true, p_fehler: null });

      await sb.rpc("cb_empfehlung_text_speichern", {
        p_texte: texte, p_modell: lokalesModell, p_kosten: 0, p_hash: hash });

      return new Response(JSON.stringify({ texte, frisch: true, modell: lokalesModell, kosten_usd: 0 }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // --- Normalweg ---------------------------------------------------------
    const { data: altRaw } = await sb.rpc("cb_empfehlung_text_holen");
    const alt: any = altRaw ?? {};

    // Bremse 1 und 2: jung genug ODER unveraendert -> nichts kostet Geld.
    const jung = alt?.vorhanden === true && Number(alt?.alter_tage ?? 99) < TAGE_BIS_NEU;
    const gleich = alt?.vorhanden === true && alt?.hash === hash;
    if (body?.erzwingen !== true && (jung || gleich)) {
      return new Response(JSON.stringify({
        texte: alt?.texte ?? [],
        frisch: false,
        modell: alt?.modell ?? null,
        grund: jung ? "noch keine Woche her" : "Gewohnheiten unveraendert",
        erstellt: alt?.erstellt ?? null,
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Ohne Gewohnheiten gibt es nichts zu schreiben - und nichts zu bezahlen.
    const gew = (kontext as any)?.gewohnheiten;
    if (!Array.isArray(gew) || gew.length === 0) {
      return new Response(JSON.stringify({ texte: [], frisch: false, grund: "zu wenig Daten" }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const key = findeKey();
    if (!key) {
      return new Response(JSON.stringify({ texte: alt?.texte ?? [], frisch: false, grund: "kein Modellzugang" }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // 02.10.2026 (Ralph): kostenpflichtige RIKI-Funktion nur mit Premium.
    // Gleiche Antwortform wie die Limit-Bremse darunter: der Text fehlt, nicht die Seite.
    const { data: premiumRaw } = await sb.rpc("cb_riki_premium_check", { p_feature: "riki_wochentext" });
    const premium: any = Array.isArray(premiumRaw) ? premiumRaw[0] : premiumRaw;
    if (premium?.erlaubt !== true) {
      const grund = premium?.grund ?? "Diese RIKI-Funktion gehört zu Premium.";
      return new Response(JSON.stringify({ ok: false, texte: alt?.texte ?? [], frisch: false, grund, fehler: grund, premium: false }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Bremse 3: dieselbe Kostenbremse wie bei den anderen RIKI-Wegen.
    const { data: limitRaw } = await sb.rpc("cb_riki_etikett_limit_check");
    const limit: any = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;
    if (limit && limit.erlaubt === false) {
      return new Response(JSON.stringify({ texte: alt?.texte ?? [], frisch: false, grund: limit?.grund ?? "Limit erreicht" }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const modell = PREISE[String(body?.modell ?? "")] ? String(body.modell) : MODELL;
    const t0 = Date.now();
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        max_tokens: 900,
        system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: frageVon(kontext) }],
      }),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "empfehlung", p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ texte: alt?.texte ?? [], frisch: false, grund: "Modell nicht erreichbar" }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let texte: any[] = [];
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const erg = JSON.parse(m ? m[0] : text);
      texte = Array.isArray(erg?.texte) ? erg.texte.slice(0, 3) : [];
    } catch { texte = []; }

    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell] ?? PREISE[MODELL];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;

    await sb.rpc("cb_riki_buchen", { p_modus: "empfehlung", p_modell: modell,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: null, p_erfolg: texte.length > 0, p_fehler: texte.length ? null : "kein verwertbares JSON" });

    if (!texte.length) {
      return new Response(JSON.stringify({ texte: alt?.texte ?? [], frisch: false, grund: "kein verwertbarer Text" }),
        { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    await sb.rpc("cb_empfehlung_text_speichern", {
      p_texte: texte, p_modell: modell, p_kosten: Number(kosten.toFixed(6)), p_hash: hash });

    return new Response(JSON.stringify({
      texte, frisch: true, modell,
      meta: { modell, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
              tokens_in: inTok, tokens_out: outTok },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
