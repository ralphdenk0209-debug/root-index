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

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
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
      "zubereitung": string
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
    if (zutaten.length < 2) {
      return new Response(JSON.stringify({ error: "Bitte mindestens 2 Zutaten angeben." }),
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

    const modell: string = body.modell ?? "claude-haiku-4-5-20251001";
    const t0 = Date.now();

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        max_tokens: 3500,
        system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: frage }],
      }),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki konnte keine Vorschläge erstellen." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let ergebnis: any = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      ergebnis = JSON.parse(m ? m[0] : text);
    } catch { ergebnis = null; }

    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;

    await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: modell,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: null, p_erfolg: true, p_fehler: null });

    const vorschlaege = Array.isArray(ergebnis?.vorschlaege) ? ergebnis.vorschlaege : [];
    if (!vorschlaege.length) {
      return new Response(JSON.stringify({ error: "Riki hat keine verwertbaren Vorschläge geliefert. Versuch es mit mehr oder anderen Zutaten." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      vorschlaege,
      hinweis: ergebnis?.hinweis ?? "Vorschläge von Riki – die kcal-Angabe ist eine Schätzung. Wähl einen Vorschlag, dann kannst du ihn als Rezept übernehmen und anpassen.",
      meta: {
        modell, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
        kcal_tag: isFinite(kcalTag) && kcalTag > 0 ? Math.round(kcalTag) : null, mahlzeit,
        heute_genutzt: (limit?.heute_genutzt ?? 0) + 1, limit_tag: limit?.limit_tag,
      },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
