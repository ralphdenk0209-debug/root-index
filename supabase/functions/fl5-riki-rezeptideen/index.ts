// FL5-RIKI-REZEPTIDEEN — Rezeptideen für Ernährungsfachleute (FL-5, 11./12.11.2026).
//
// Eigener, neuer Einstieg (Ralph: riki-rezept-vorschlag / „Was koche ich?“ bleiben unverändert).
// Ergänzt den Plan-Vorschlag aus dem eigenen Bestand, wenn dort zu wenig passt.
//
// DATENSCHUTZ: Die Seite schickt NUR, was die Fachperson im Formular sieht und bestätigt
// (Mahlzeit, ungefähre kcal, „ohne …“, Ernährungsform, Diabetes ja/nein, freie Wünsche).
// Keine Namen, keine Kennungen, keine Tagebuchdaten. Diese Funktion liest keine Klientendaten.
//
// Bremse VOR dem Aufruf: nur freigeschaltete Fachleute (cb_fl5_riki_limit → _fp_ich),
// Tageslimit je Fachperson (fachleute_einstellung.fl5_riki_limit_tag) und das allgemeine
// Riki-Monatsbudget (cb_riki_etikett_limit_check). Kosten werden gebucht (cb_riki_buchen,
// modus 'fl5_rezeptideen').
//
// Riki SCHLÄGT NUR VOR. Die Fachperson speichert eine Idee als privates Rezept (cb_rezept_anlegen);
// erst dann rechnet Root Index Nährwerte und Score aus den zugeordneten Produkten.
// KI austauschbar: Modell kommt aus fachleute_einstellung.fl5_ki_modell (Standard Haiku).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PREISE: Record<string, { in: number; out: number }> = {
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

const REGELWERK = `Du bist RIKI, der Rezept-Ideengeber von Root Index, hier im Auftrag einer Ernährungsfachkraft.

AUFGABE: Schlage machbare Rezepte für EINE Mahlzeit vor, passend zu den Vorgaben der Fachkraft
(Unverträglichkeiten, Ernährungsform, ggf. Diabetes, ungefähre kcal je Portion, Wünsche).

OBERSTE REGELN:
1. Unverträglichkeiten sind HART: Kein Rezept darf eine genannte Zutat oder Zutatengruppe enthalten
   (z. B. „ohne milch“ = keine Milch, Butter, Käse, Sahne, Joghurt, Quark; „ohne gluten“ = kein Weizen,
   Dinkel, Roggen, Gerste usw.; „ohne laktose“ = keine laktosehaltigen Milchprodukte).
2. Ernährungsform respektieren (vegan / vegetarisch).
3. Bei Diabetes: zuckerarm, kein zugesetzter Zucker, eher Vollkorn und Ballaststoffe – sachlich, ohne Versprechen.
4. KEINE GESUNDHEITS-, HEIL- ODER WIRKVERSPRECHEN. Sachliche Beschreibung, keine Diagnosen.
5. Alltagstaugliche Zutaten aus dem deutschen Supermarkt, Mengen je Zutat für die angegebene Portionenzahl.
6. kcal je Portion ist eine EHRLICHE SCHÄTZUNG (auf ~10 kcal runden), keine Messung.
7. Vorschläge VERSCHIEDEN machen.

MENGEN: je Zutat natürliche Menge ("200 g", "1 EL") und, WENN eindeutig, "menge_g" in Gramm, sonst null. Gramm nicht raten.

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "vorschlaege": [
    { "name": string, "kurz": string, "portionen": number, "zeit_min": number|null,
      "ernaehrungsform": "vegan"|"vegetarisch"|"omnivor"|null, "kcal_geschaetzt": number|null,
      "zutaten": [ { "name": string, "menge": string|null, "menge_g": number|null } ],
      "zubereitung": string }
  ],
  "hinweis": string|null
}`;

const ERLAUBT_OHNE = ["ei", "erdnuss", "fisch", "gluten", "krebstiere", "lupinen", "milch", "laktose", "schalenfruechte",
  "sellerie", "senf", "sesam", "soja", "sulfite", "weichtiere", "fructose", "histamin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const key = findeKey();
  if (!key) return json({ ok: false, grund: "Kein KI-Schlüssel hinterlegt." }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });

  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ ok: false, grund: "Bitte anmelden." }, 401);

    // Bremse 1: nur freigeschaltete Fachleute, Tageslimit je Fachperson
    const { data: lim, error: limErr } = await sb.rpc("cb_fl5_riki_limit");
    if (limErr) return json({ ok: false, grund: limErr.message }, 403);
    const l: any = lim ?? {};
    if (l.erlaubt !== true) return json({ ok: false, grund: l.grund ?? "Limit erreicht.", heute: l.heute, limit: l.limit }, 429);
    // Bremse 2: allgemeines Riki-Monatsbudget
    const { data: bRaw } = await sb.rpc("cb_riki_etikett_limit_check");
    const b: any = Array.isArray(bRaw) ? bRaw[0] : bRaw;
    if (b && b.erlaubt === false && /budget/i.test(String(b.grund ?? ""))) return json({ ok: false, grund: b.grund }, 429);

    // Eingaben säubern – nur, was die Fachperson bestätigt hat
    const mahlzeit = ["Frühstück", "Mittag", "Abendessen", "Snack"].includes(String(body.mahlzeit)) ? String(body.mahlzeit) : "Mittag";
    const ohne: string[] = (Array.isArray(body.ohne) ? body.ohne : []).map((x: unknown) => String(x ?? "").trim().toLowerCase())
      .filter((x: string) => ERLAUBT_OHNE.includes(x)).slice(0, 15);
    const ef = ["vegan", "vegetarisch"].includes(String(body.ernaehrungsform)) ? String(body.ernaehrungsform) : null;
    const diabetes = body.diabetes === true;
    const kcal = Number(body.kcal_portion);
    const kcalTxt = isFinite(kcal) && kcal >= 50 && kcal <= 2000 ? `etwa ${Math.round(kcal)} kcal je Portion` : "übliche Portionsgröße";
    const wuensche = String(body.wuensche ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    const anzahl = Math.min(5, Math.max(1, Number(body.anzahl) || 3));

    const frage =
      `Mahlzeit: ${mahlzeit}. Zielgröße: ${kcalTxt}. Portionen je Rezept: 2.\n` +
      (ohne.length ? `Unverträglichkeiten (hart): ohne ${ohne.join(", ")}.\n` : "") +
      (ef ? `Ernährungsform: ${ef}.\n` : "") +
      (diabetes ? `Diabetes: zuckerarm, ohne zugesetzten Zucker.\n` : "") +
      (wuensche ? `Wünsche der Fachkraft: ${wuensche}\n` : "") +
      `Schlage ${anzahl} verschiedene Rezepte vor.`;

    const { data: mRaw } = await sb.rpc("cb_fl5_ki_modell");
    const modell: string = (typeof mRaw === "string" && PREISE[mRaw]) ? mRaw : "claude-haiku-4-5-20251001";
    const t0 = Date.now();
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modell, max_tokens: 3500,
        system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: frage }] }),
    });
    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "fl5_rezeptideen", p_modell: modell, p_in: 0, p_out: 0, p_kosten: 0,
        p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return json({ ok: false, grund: "Riki konnte gerade keine Ideen erstellen." }, 502);
    }
    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let erg: any = null;
    try { const m = text.match(/\{[\s\S]*\}/); erg = JSON.parse(m ? m[0] : text); } catch { erg = null; }
    const usage: any = j.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const preis = PREISE[modell];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;
    await sb.rpc("cb_riki_buchen", { p_modus: "fl5_rezeptideen", p_modell: modell, p_in: inTok, p_out: outTok,
      p_kosten: Number(kosten.toFixed(6)), p_produkt_id: null, p_erfolg: true, p_fehler: null });

    const vorschlaege = Array.isArray(erg?.vorschlaege) ? erg.vorschlaege.slice(0, anzahl) : [];
    if (!vorschlaege.length) return json({ ok: false, grund: "Riki hat keine verwertbaren Ideen geliefert. Bitte anders formulieren." }, 502);
    return json({ ok: true, vorschlaege, mahlzeit,
      hinweis: "Ideen von Riki (KI) – kcal sind Schätzungen. Bitte prüfen; erst nach dem Speichern rechnet Root Index Nährwerte und Score aus den Produkten.",
      meta: { modell, dauer_ms: Date.now() - t0, heute: (l.heute ?? 0) + 1, limit: l.limit } });
  } catch (e) {
    return json({ ok: false, grund: String(e) }, 500);
  }
});
