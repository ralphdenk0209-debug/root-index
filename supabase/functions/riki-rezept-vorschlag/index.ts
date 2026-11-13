// RIKI-REZEPT-VORSCHLAG — aus vorhandenen Zutaten Rezeptvorschläge, die zum Kalorienbedarf passen.
//
// Feature 2 (Ralph 23.07.2026): Nutzer wählt/tippt Zutaten, die er zuhause hat → Riki schlägt
// mehrere Gerichte vor, die überwiegend DIESE Zutaten nutzen und deren Portion sinnvoll zum
// Tages-Kalorienziel passt.
//
// Gebaut nach dem Muster von riki-rezept/riki-etikett:
//   - Auth + Tageslimit/Budget-Bremse VOR dem Aufruf (kostet Geld)
//   - Riki SCHLÄGT VOR, entscheidet nicht. Der Nutzer wählt und speichert selbst.
//
// EHRLICHKEIT: Die kcal-Angabe eines Vorschlags ist eine SCHÄTZUNG (klar so benannt) — kein
// gemessener Wert. Der echte Root-Index-Wert entsteht erst, wenn der Nutzer den Vorschlag als
// Rezept speichert und jede Zutat einem bewerteten Produkt zugeordnet ist (bestehende Logik).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 13.11.2026 (N1, Ralph „Ja, so bauen“): Standard Sonnet 5.5. claude-sonnet-5 = Ziel der
// server-seitigen Ausweichschaltung (fallbacks: "default"), gleicher Preis.
const STANDARD_MODELL = "claude-sonnet-5-5";
const PREISE: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5-5": { in: 2.0, out: 10.0 },
  "claude-sonnet-5": { in: 2.0, out: 10.0 },
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-api")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-api")) return v.trim();
  }
  return null;
}

const REGELWERK = `Du bist RIKI, der Rezept-Ideengeber von Root Index.

AUFGABE: Aus einer Liste von Zutaten, die der Nutzer ZUHAUSE HAT, schlägst du mehrere machbare
Gerichte vor, deren Portionsgröße sinnvoll zum Kalorienbedarf des Nutzers passt.

OBERSTE REGELN:
1. NUTZE ÜBERWIEGEND DIE GENANNTEN ZUTATEN. Erfinde kein Gericht, das hauptsächlich aus Dingen
   besteht, die der Nutzer nicht genannt hat. Wenige Grund-/Vorratszutaten (Salz, Pfeffer, Wasser,
   Öl, gängige Gewürze) darfst du ergänzen — markiere sie mit "aus_vorrat": false und liste sie
   zusätzlich in "extra_zutaten". Alles, was der Nutzer genannt hat: "aus_vorrat": true.
2. KEINE GESUNDHEITS-/WIRKVERSPRECHEN. Beschreibe das Gericht sachlich, nicht "gesund", "entgiftend" o. ä.
3. Die kcal-Angabe ist eine EHRLICHE SCHÄTZUNG pro Portion. Gib sie an, aber verstehe: es ist ein
   Richtwert, keine Messung. Übertreibe keine Genauigkeit (runde auf ~10 kcal).
4. Mach die Vorschläge VERSCHIEDEN (nicht dreimal dasselbe mit anderem Namen).
5. JEDER VORSCHLAG BRAUCHT EINE ECHTE ANLEITUNG zum Nachkochen (siehe ZUBEREITUNG).

ZUBEREITUNG ("zubereitung"): nummerierte Schritte, je Schritt eine eigene Zeile, getrennt durch
einen Zeilenumbruch (\n), Form "1. …", "2. …". 4 bis 10 Schritte. Jeder Schritt ist eine konkrete
Handlung mit Hitze/Stufe und Zeit, wo es darauf ankommt (z. B. "3. Öl in einer Pfanne bei mittlerer
Hitze erhitzen, Zwiebel 3–4 Minuten glasig dünsten."). JEDE Zutat aus "zutaten" kommt in mindestens
einem Schritt vor, mit ihrer Menge beim ersten Auftauchen. Kein Einleitungssatz, kein Fazit, keine
Gesundheitsversprechen.

KALORIEN-PASSUNG:
- "kcal_tag" ist der TAGESbedarf des Nutzers. Ein einzelnes Gericht ist eine MAHLZEIT, kein ganzer Tag.
- Ist eine "mahlzeit" angegeben (Frühstück/Mittagessen/Abendessen/Snack), ziele auf einen passenden
  Anteil: Hauptmahlzeit ≈ 30–40 % von kcal_tag, Frühstück ≈ 20–30 %, Snack ≈ 10–15 %.
- Ohne "mahlzeit": ziele auf eine typische Hauptmahlzeit (≈ ein Drittel des Tagesbedarfs).
- Setze "passt_zu_kcal": true, wenn die geschätzte Portion in diesem Rahmen liegt, sonst false
  (z. B. wenn die genannten Zutaten nur ein sehr leichtes oder sehr schweres Gericht hergeben).
- Ist kein kcal_tag gegeben, lass "passt_zu_kcal": true und schätze die Portion trotzdem.

MENGEN: gib je Zutat eine natürliche Menge ("200 g", "1 EL") und, WENN eindeutig, "menge_g" (Gramm).
Nicht eindeutig ("1 Prise", "1 Zwiebel"): "menge_g": null. Gramm NICHT raten.

ERNÄHRUNGSFORM je Vorschlag NUR aus den tatsächlich verwendeten Zutaten ableiten
(vegan / vegetarisch / omnivor); unsicher -> null. Respektiere eine gewünschte "ernaehrungsform",
falls angegeben (dann nur solche Vorschläge).

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "vorschlaege": [
    {
      "name": string,
      "kurz": string,
      "portionen": number,
      "zeit_min": number|null,
      "ernaehrungsform": "vegan"|"vegetarisch"|"omnivor"|null,
      "kcal_geschaetzt": number|null,
      "passt_zu_kcal": boolean,
      "zutaten": [ { "name": string, "menge": string|null, "menge_g": number|null, "aus_vorrat": boolean } ],
      "extra_zutaten": string[],
      "zubereitung": string   // "1. …\n2. …\n3. …" (4–10 Schritte)
    }
  ],
  "hinweis": string|null
}`;

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

    // Dieselbe Kostenbremse wie beim Etikett/Rezept-Foto: Tageslimit pro Nutzer + Monatsbudget.
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

    // Eingaben säubern.
    const zutaten: string[] = Array.isArray(body.zutaten)
      ? body.zutaten.map((z: unknown) => String(z ?? "").trim()).filter((z: string) => z.length > 0).slice(0, 40)
      : [];
    // 11.11.2026: eine Zutat reicht (Sandra: nur „Tofu“ → iPhone zeigte nur „Ging nicht“, Server 400).
    if (zutaten.length < 1) {
      return new Response(JSON.stringify({ error: "Bitte mindestens eine Zutat angeben." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const kcalTag = Number(body.kcal_tag);
    const kcalTxt = isFinite(kcalTag) && kcalTag > 0 ? `Tages-Kalorienbedarf: ${Math.round(kcalTag)} kcal.` : "Kein Tages-Kalorienbedarf angegeben.";
    const mahlzeit = ["Frühstück", "Mittagessen", "Abendessen", "Snack"].includes(String(body.mahlzeit)) ? String(body.mahlzeit) : null;
    const ef = ["vegan", "vegetarisch", "omnivor"].includes(String(body.ernaehrungsform)) ? String(body.ernaehrungsform) : null;
    const anzahl = Math.min(5, Math.max(1, Number(body.anzahl) || 3));

    const frage =
      `Zutaten, die ich zuhause habe: ${zutaten.join(", ")}.\n` +
      `${kcalTxt}${mahlzeit ? " Mahlzeit: " + mahlzeit + "." : ""}${ef ? " Nur " + ef + "." : ""}\n` +
      `Schlage ${anzahl} verschiedene, machbare Gerichte vor, die überwiegend diese Zutaten nutzen und deren Portion zum Kalorienbedarf passt. ` +
      `kcal pro Portion als ehrliche Schätzung. Nichts erfinden, was den Rahmen sprengt.`;

    const modell: string = typeof body.modell === "string" && PREISE[body.modell] ? body.modell : STANDARD_MODELL;
    const istSonnet55 = modell === "claude-sonnet-5-5";
    const t0 = Date.now();

    // Sonnet 5.5: adaptives Denken (Standard) bei effort "low" – kein temperature/top_p, kein
    // budget_tokens. max_tokens großzügig, weil Denken mitzählt. Server-seitige Ausweichschaltung
    // bei Ablehnung durch die Sicherheitsfilter (fallbacks: "default" + Beta-Kopfzeile).
    const anfrage: Record<string, unknown> = {
      model: modell,
      max_tokens: istSonnet55 ? 12000 : 3500,
      system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: frage }],
    };
    const kopf: Record<string, string> = { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" };
    if (istSonnet55) {
      anfrage.output_config = { effort: "low" };
      anfrage.fallbacks = "default";
      kopf["anthropic-beta"] = "server-side-fallback-2026-07-01";
    }

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: kopf, body: JSON.stringify(anfrage),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki konnte keine Vorschläge erstellen." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Kosten: usage.iterations ist je Versuch maßgeblich (bei Ausweichschaltung mehrere Modelle),
    // sonst die Gesamtzahlen. Jeder Versuch zum Preis des Modells, das ihn ausgeführt hat.
    const usage: any = j.usage ?? {};
    const versuche: any[] = Array.isArray(usage.iterations) && usage.iterations.length ? usage.iterations : [usage];
    let inTok = 0, outTok = 0, kosten = 0;
    for (const v of versuche) {
      const vin = (v.input_tokens ?? 0) + (v.cache_creation_input_tokens ?? 0) + (v.cache_read_input_tokens ?? 0);
      const vout = v.output_tokens ?? 0;
      const p = PREISE[String(v.model ?? j.model ?? modell)] ?? PREISE[modell];
      inTok += vin; outTok += vout; kosten += (vin / 1e6) * p.in + (vout / 1e6) * p.out;
    }
    const bedientVon: string = String(j.model ?? modell);

    // Ablehnung durch die Sicherheitsfilter (auch nach Ausweichschaltung): sauber als Fehler melden.
    if (j.stop_reason === "refusal") {
      const kat = j.stop_details?.category ?? null;
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: bedientVon, p_in: inTok, p_out: outTok,
        p_kosten: Number(kosten.toFixed(6)), p_produkt_id: null, p_erfolg: false,
        p_fehler: ("refusal" + (kat ? ":" + kat : "")).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki darf zu dieser Anfrage keine Vorschläge machen. Bitte formuliere die Zutaten anders." }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (j.stop_reason === "max_tokens") {
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: bedientVon, p_in: inTok, p_out: outTok,
        p_kosten: Number(kosten.toFixed(6)), p_produkt_id: null, p_erfolg: false, p_fehler: "max_tokens" });
      return new Response(JSON.stringify({ error: "Riki ist mit der Antwort nicht fertig geworden. Bitte nochmal versuchen." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Nur text-Blöcke lesen (thinking- und fallback-Blöcke ignorieren).
    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let ergebnis: any = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      ergebnis = JSON.parse(m ? m[0] : text);
    } catch { ergebnis = null; }

    await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: bedientVon,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: null, p_erfolg: true, p_fehler: null });

    const vorschlaege = Array.isArray(ergebnis?.vorschlaege) ? ergebnis.vorschlaege : [];
    // Schritte vereinheitlichen: immer ein Text "1. …\n2. …" (falls Riki eine Liste liefert)
    // plus "schritte" als Liste ohne Nummer für die Anzeige in Web und iPhone.
    for (const v of vorschlaege) {
      const roh: string[] = Array.isArray(v?.zubereitung)
        ? v.zubereitung.map((x: unknown) => String(x ?? ""))
        : String(v?.zubereitung ?? "").split(/\n+/);
      const schritte = roh.map((x) => x.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((x) => x.length > 0);
      v.schritte = schritte;
      v.zubereitung = schritte.map((x, i) => `${i + 1}. ${x}`).join("\n");
    }
    if (!vorschlaege.length) {
      return new Response(JSON.stringify({ error: "Riki hat keine verwertbaren Vorschläge geliefert. Versuch es mit mehr oder anderen Zutaten." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      vorschlaege,
      hinweis: ergebnis?.hinweis ?? "Vorschläge von Riki – die kcal-Angabe ist eine Schätzung. Wähl einen Vorschlag, dann kannst du ihn als Rezept übernehmen und anpassen.",
      meta: {
        modell: bedientVon, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
        kcal_tag: isFinite(kcalTag) && kcalTag > 0 ? Math.round(kcalTag) : null, mahlzeit,
        heute_genutzt: (limit?.heute_genutzt ?? 0) + 1, limit_tag: limit?.limit_tag,
      },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
