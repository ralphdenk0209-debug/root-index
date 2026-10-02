// RIKI-REZEPT — Rezeptfotos lesen (Kochbuch, Zettel, Bildschirm).
//
// Gebaut nach demselben Muster wie riki-etikett:
//   - mehrere Fotos (eine Kochbuchseite hat Zutaten links, Zubereitung rechts)
//   - Limit- und Budget-Check VOR dem Aufruf (kostet Geld)
//   - Rikis Selbstgespraech entscheidet NICHT. Die serverseitige Pruefung entscheidet.
//
// GRUNDSATZ: Riki SCHLAEGT VOR, Riki entscheidet nicht. Der Nutzer sieht jeden Wert,
// bevor er gespeichert wird. Was Riki nicht lesen kann, bleibt leer - nicht geraten.

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

const REGELWERK = `Du bist RIKI, die Rezept-Lese-KI von Root Index.

AUFGABE: Aus einem oder mehreren Fotos ein REZEPT auslesen — Zutaten mit Mengen und die Zubereitung.
Die Fotos koennen zeigen: eine Kochbuchseite, einen handgeschriebenen Zettel, einen Bildschirm,
eine Verpackungsrueckseite mit Rezeptvorschlag.

OBERSTE REGEL: NICHTS ERFINDEN.
Was du nicht sicher LESEN kannst, gibst du als null zurueck.
Du ergaenzt NICHTS aus Kochwissen. Auch wenn du das Gericht kennst und weisst, dass
dort ueblicherweise Salz hineingehoert — steht es nicht da, kommt es nicht rein.
Ein fehlender Wert ist ehrlich. Ein geratener Wert ist eine Luege, die wie ein Fakt aussieht.

=== MEHRERE FOTOS ===
Die Fotos gehoeren zu EINEM Rezept. Typisch: Foto 1 = Zutatenliste, Foto 2 = Zubereitung.
Oder: Kochbuch linke Seite / rechte Seite.
-> Fuege sie zu EINEM Rezept zusammen. Gib jede Zutat GENAU EINMAL aus.
-> Steht dieselbe Zutat auf zwei Fotos (Ueberlappung), nenne sie trotzdem nur einmal.
-> Zeigen die Fotos ERKENNBAR VERSCHIEDENE Rezepte, nimm das erste und melde es in "warnungen".

=== MENGEN ===
Gib die Menge so an, wie sie dasteht ("2 EL", "1 Prise", "200 g", "1/2 Bund").
ZUSAETZLICH: rechne sie in GRAMM um — aber NUR, wenn die Umrechnung eindeutig ist:
  200 g -> 200 | 1 kg -> 1000 | 250 ml Wasser/Milch -> 250
  1 EL Oel -> 10 | 1 TL Salz -> 5 | 1 EL Zucker -> 12
Wenn die Umrechnung NICHT eindeutig ist ("1 Prise", "etwas", "1 Bund", "nach Geschmack",
"2 Stueck" ohne Stueckgewicht, "1 Zwiebel"): menge_g = null.
RATE KEIN GEWICHT. Eine Zwiebel wiegt zwischen 50 und 200 g — das ist keine Zahl, das ist ein Bereich.

=== NAEHRWERTE ===
Stehen auf dem Foto Naehrwerte pro Portion (kcal, Eiweiss, KH, Fett), gib sie an.
Stehen dort KEINE: alle null. Rechne NICHTS aus den Zutaten hoch — das machen wir selbst,
und zwar nur, wenn wir jede Zutat kennen.

=== PORTIONEN UND ZEIT ===
Steht "fuer 4 Personen" -> portionen: 4. Steht nichts da -> null. Nicht "4" annehmen.
Zeit in Minuten, wenn angegeben. Sonst null.

=== ZUBEREITUNG ===
Schreibe die Zubereitungsschritte ab. Formuliere NICHT um, kuerze NICHT, ergaenze NICHTS.
Ist kein Zubereitungstext auf dem Foto: zubereitung = null.

=== ERNAEHRUNGSFORM ===
Leite sie NUR aus den tatsaechlich genannten Zutaten ab:
  "vegan" nur, wenn NICHTS Tierisches vorkommt (kein Ei, keine Milch, kein Honig, kein Fleisch, kein Fisch)
  "vegetarisch" wenn Milch/Ei vorkommen, aber kein Fleisch/Fisch
  "omnivor" wenn Fleisch oder Fisch vorkommt
Unsicher -> null.

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "name": string|null,
  "portionen": number|null,
  "zeit_min": number|null,
  "ernaehrungsform": "vegan"|"vegetarisch"|"omnivor"|null,
  "naehrwerte_portion": { "kcal": number|null, "protein": number|null, "kh": number|null, "fett": number|null },
  "zutaten": [ { "name": string, "menge": string|null, "menge_g": number|null } ],
  "zubereitung": string|null,
  "warnungen": string[],
  "unsicher": boolean
}`;

// Serverseitige Pruefung. Riki darf sagen "passt schon" - das zaehlt hier nicht.
function pruefe(v: any): string[] {
  const w: string[] = [];
  const zut = Array.isArray(v?.zutaten) ? v.zutaten : [];

  if (!v?.name) w.push("Kein Rezeptname erkennbar - bitte selbst eintragen.");
  if (!zut.length) w.push("Keine Zutaten erkannt. Ist die Zutatenliste auf dem Foto vollstaendig zu sehen?");
  if (!v?.zubereitung) w.push("Keine Zubereitung erkannt - du kannst sie selbst ergaenzen.");

  const ohneMenge = zut.filter((z: any) => z?.menge_g == null).length;
  if (zut.length && ohneMenge === zut.length)
    w.push("Bei keiner Zutat war eine eindeutige Grammangabe moeglich. Ohne Mengen koennen wir das Rezept nicht bewerten.");
  else if (ohneMenge > 0)
    w.push(`${ohneMenge} von ${zut.length} Zutaten haben keine eindeutige Grammangabe (z. B. "1 Prise"). Wir raten sie nicht - trag sie bei Bedarf selbst ein.`);

  const p = Number(v?.portionen);
  if (isFinite(p) && (p < 1 || p > 50)) w.push(`Portionen (${p}) sieht falsch gelesen aus.`);

  const n = v?.naehrwerte_portion ?? {};
  const kcal = typeof n.kcal === "number" ? n.kcal : null;
  if (kcal !== null && (kcal < 20 || kcal > 3000))
    w.push(`${kcal} kcal pro Portion sieht falsch gelesen aus.`);

  return w;
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

    // Dieselbe Bremse wie beim Etikett: Tageslimit pro Nutzer + globales Monatsbudget.
    // Ein Foto-Feature ohne Kostenbremse ist eine offene Rechnung.
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

    // Bis zu 4 Fotos: Kochbuch links/rechts, Zutaten, Zubereitung.
    const bilder: string[] = Array.isArray(body.bilder) ? body.bilder.slice(0, 4) : [];
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

    inhalt.push({ type: "text", text:
      `Lies aus ${inhalt.length > 1 ? "diesen " + inhalt.length + " Fotos" : "diesem Foto"} EIN Rezept aus: ` +
      "Name, Portionen, Zutaten mit Mengen, Zubereitung. " +
      (inhalt.length > 1 ? "Die Fotos gehoeren zusammen - fuege sie zu EINEM Rezept zusammen, jede Zutat genau einmal. " : "") +
      "Was du nicht sicher lesen kannst: null. Mengen NICHT raten - eine Zwiebel wiegt zwischen 50 und 200 g." });

    const modell: string = body.modell ?? "claude-haiku-4-5-20251001";
    const t0 = Date.now();

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        max_tokens: 3000,
        system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: inhalt }],
      }),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki konnte das Rezept nicht lesen." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let vorschlag: any = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      vorschlag = JSON.parse(m ? m[0] : text);
    } catch { vorschlag = null; }

    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;

    await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: modell,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: null, p_erfolg: true, p_fehler: null });

    if (!vorschlag) {
      return new Response(JSON.stringify({ error: "Riki hat kein verwertbares Ergebnis geliefert." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Zutaten den Katalog-Produkten zuordnen - aber nur, wenn es EINDEUTIG ist.
    // Eine falsche Zuordnung erzeugt einen Rezept-Score, der unsichtbar falsch ist.
    const zutaten = Array.isArray(vorschlag.zutaten) ? vorschlag.zutaten : [];
    let zugeordnet = 0;
    for (const z of zutaten) {
      z.produkt_id = null; z.treffer = null;
      if (!z?.name) continue;
      try {
        const { data: t } = await sb.rpc("cb_zutat_zuordnen", { p_name: z.name });
        if (t?.gefunden) {
          z.produkt_id = t.produkt_id;
          z.treffer = { name: t.name, marke: t.marke, score: t.score, art: t.art };
          zugeordnet++;
        } else {
          z.treffer = { grund: t?.grund ?? "kein Treffer" };
        }
      } catch { /* Zuordnung ist Kuer, nicht Pflicht */ }
    }
    vorschlag.zutaten = zutaten;

    const w = [...pruefe(vorschlag), ...((vorschlag.warnungen ?? []) as string[])];

    // Ein Rezept-Score entsteht NUR, wenn JEDE Zutat einem bewerteten Produkt zugeordnet ist
    // UND eine Grammangabe hat. Sonst wuerde die Luecke weggerechnet (§1.11r).
    const vollstaendig = zutaten.length > 0 &&
      zutaten.every((z: any) => z.produkt_id && z.menge_g != null && z.treffer?.score != null);
    if (!vollstaendig && zutaten.length > 0) {
      const fehlt = zutaten.filter((z: any) => !z.produkt_id).length;
      if (fehlt > 0) w.push(
        `${fehlt} von ${zutaten.length} Zutaten kennen wir nicht aus dem Katalog. ` +
        "Das Rezept bekommt deshalb noch keinen Root-Index-Wert - wir rechnen keine Luecken weg.");
    }

    return new Response(JSON.stringify({
      vorschlag,
      warnungen: w,
      zugeordnet,
      zutaten_gesamt: zutaten.length,
      score_moeglich: vollstaendig,
      hinweis: "Von Riki aus deinen Fotos gelesen. Pruef jeden Wert, bevor du speicherst - Riki schlaegt vor, du entscheidest.",
      meta: {
        modell, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
        fotos: inhalt.length - 1,
        heute_genutzt: (limit?.heute_genutzt ?? 0) + 1, limit_tag: limit?.limit_tag,
      },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
