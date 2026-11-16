// Offline-Test für riki-rezept-vorschlag (N1, 13.11.2026). Kein echter API-Aufruf:
// fetch wird ersetzt – Supabase (Auth, RPCs) und Anthropic antworten mit nachgebauten Daten.
// Aufruf:  deno test --allow-env --allow-read --allow-net=jsr.io supabase/functions/riki-rezept-vorschlag/index_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";

Deno.env.set("ANTHROPIC_API_KEY", "sk-ant-api-test-offline");
Deno.env.set("SUPABASE_URL", "https://offline.supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "anon-offline");

// Deno.serve abfangen, damit der Handler direkt aufrufbar ist.
let handler: (req: Request) => Promise<Response> = () => { throw new Error("kein Handler"); };
(Deno as any).serve = (h: any) => { handler = h; return {} as any; };

type Aufruf = { url: string; headers: Record<string, string>; body: any };
let anthropicAntwort: any = null;
let anthropicAufrufe: Aufruf[] = [];
let buchungen: any[] = [];

let zuordnungsAufrufe: string[] = [];
const KATALOG: Record<string, { id: string; name: string; kcal: number; p: number; kh: number; f: number; stueck?: any }> = {
  "eier": { id: "P494", name: "Ei", kcal: 135, p: 13.2, kh: 0.3, f: 9, stueck: [{ txt: "M – mittel", g: 51 }] },
  "gemüsemischung": { id: "P343", name: "Gemüsemischung Kaisergemüse", kcal: 37, p: 2.3, kh: 4.7, f: 0.4 },
  "schafskäse": { id: "P1155", name: "Salakis Light", kcal: 161, p: 19, kh: 0.9, f: 9 },
  "olivenöl": { id: "P162", name: "Olivenöl, nativ extra", kcal: 899, p: 0, kh: 0, f: 99.9 },
  "salz": { id: "P1693", name: "Speisesalz", kcal: 0, p: 0, kh: 0, f: 0 },
  "kartoffeln": { id: "P083", name: "Kartoffeln", kcal: 70, p: 2, kh: 15, f: 0.1 },
};
const echtesFetch = globalThis.fetch;
globalThis.fetch = async (input: any, init?: any): Promise<Response> => {
  const url = typeof input === "string" ? input : input.url;
  const json = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } });
  const roh = init?.body ?? (input instanceof Request ? await input.clone().text() : null);
  const body = roh ? JSON.parse(String(roh)) : null;
  if (url.startsWith("https://api.anthropic.com/")) {
    const h: Record<string, string> = {};
    new Headers(init?.headers ?? {}).forEach((v, k) => { h[k] = v; });
    anthropicAufrufe.push({ url, headers: h, body });
    return json(anthropicAntwort);
  }
  if (url.includes("/auth/v1/user")) return json({ id: "u-test", aud: "authenticated", role: "authenticated", email: "t@test" });
  if (url.includes("/rpc/cb_riki_premium_check")) return json([{ erlaubt: true }]);
  if (url.includes("/rpc/cb_riki_etikett_limit_check")) return json([{ erlaubt: true, heute_genutzt: 1, limit_tag: 10 }]);
  if (url.includes("/rpc/cb_riki_buchen")) { buchungen.push(body); return json(null); }
  // 16.11.2026: Katalog-Zuordnung und Nährwerte nachgebaut.
  if (url.includes("/rpc/cb_zutat_zuordnen")) {
    const k = String(body?.p_name ?? "").toLowerCase();
    const p = KATALOG[k];
    zuordnungsAufrufe.push(k);
    return json(p ? { gefunden: true, produkt_id: p.id, name: p.name, marke: null, score: 90, art: "exakt" }
                  : { gefunden: false, grund: "nicht im Katalog" });
  }
  if (url.includes("/rest/v1/v_web_produkte")) {
    const ids = decodeURIComponent(url).match(/id=in\.\(([^)]*)\)/)?.[1]?.split(",").map((x) => x.replace(/"/g, "")) ?? [];
    return json(Object.values(KATALOG).filter((p) => ids.includes(p.id)).map((p) => ({
      id: p.id, m_kcal: p.kcal, m_protein: p.p, m_kh: p.kh, m_fett: p.f, stueck: p.stueck ?? null })));
  }
  return echtesFetch(input, init);
};

await import("./index.ts");

function anfrage(extra: Record<string, unknown> = {}) {
  return new Request("http://lokal/riki-rezept-vorschlag", {
    method: "POST",
    headers: { "Authorization": "Bearer nutzer-token", "content-type": "application/json" },
    body: JSON.stringify({ zutaten: ["Eier", "Gemüsemischung", "Schafskäse"], kcal_tag: 1800, mahlzeit: "Mittagessen", anzahl: 1, ...extra }),
  });
}
function zuruecksetzen(antwort: any) { anthropicAntwort = antwort; anthropicAufrufe = []; buchungen = []; zuordnungsAufrufe = []; }

const VORSCHLAG = {
  vorschlaege: [{
    name: "Gemüse-Eierpfanne mit Schafskäse", kurz: "Pfanne mit Gemüse, Ei und Feta", portionen: 1, zeit_min: 20,
    ernaehrungsform: "vegetarisch", kcal_geschaetzt: 520, passt_zu_kcal: true,
    zutaten: [
      { name: "Eier", menge: "3 Stück", menge_g: 150, aus_vorrat: true },
      { name: "Gemüsemischung", menge: "200 g", menge_g: 200, aus_vorrat: true },
      { name: "Schafskäse", menge: "80 g", menge_g: 80, aus_vorrat: true },
      { name: "Olivenöl", menge: "1 EL", menge_g: 10, aus_vorrat: false },
    ],
    extra_zutaten: ["Olivenöl"],
    zubereitung: "1. Olivenöl (1 EL) in einer Pfanne bei mittlerer Hitze erhitzen.\n2. Gemüsemischung (200 g) 6–8 Minuten anbraten.\n3. Eier (3 Stück) verquirlen, salzen und pfeffern.\n4. Eier über das Gemüse gießen und bei niedriger Hitze 4 Minuten stocken lassen.\n5. Schafskäse (80 g) darüberbröseln und 1 Minute ziehen lassen.",
  }],
  hinweis: null,
};

Deno.test("Normalfall: Request-Body/Header für Sonnet 5.5, thinking-Block wird ignoriert", async () => {
  zuruecksetzen({
    id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_details: null,
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text: JSON.stringify(VORSCHLAG) },
    ],
    usage: { input_tokens: 1500, output_tokens: 900, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  });
  const r = await handler(anfrage());
  const d = await r.json();
  assertEquals(r.status, 200, JSON.stringify(d));
  assertEquals(anthropicAufrufe.length, 1);
  const { headers, body } = anthropicAufrufe[0];
  assertEquals(body.model, "claude-sonnet-5-5");
  assertEquals(body.output_config, { effort: "low" });
  assertEquals(body.fallbacks, "default");
  assertEquals(headers["anthropic-beta"], "server-side-fallback-2026-07-01");
  assert(body.max_tokens >= 8000, "max_tokens zu klein: " + body.max_tokens);
  for (const verboten of ["temperature", "top_p", "top_k", "thinking"]) assert(!(verboten in body), verboten + " darf nicht gesendet werden");
  assert(body.system[0].text.includes("nummerierte Schritte"), "Prompt verlangt keine Schritte");
  const v = d.vorschlaege[0];
  assertEquals(v.schritte.length, 5);
  assertEquals(v.schritte[0], "Olivenöl (1 EL) in einer Pfanne bei mittlerer Hitze erhitzen.");
  assert(v.zubereitung.startsWith("1. Olivenöl") && v.zubereitung.includes("\n5. Schafskäse"));
  assertEquals(d.meta.modell, "claude-sonnet-5-5");
  assertEquals(d.meta.kosten_usd, 0.012); // 1500 × 2 $/1M + 900 × 10 $/1M
  assertEquals(buchungen.length, 1);
  assertEquals(buchungen[0].p_erfolg, true);
});

Deno.test("Ablehnung (refusal): sauberer Fehler, Buchung als Fehlschlag", async () => {
  zuruecksetzen({
    id: "msg_2", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "refusal",
    stop_details: { type: "refusal", category: "general_harms", explanation: null },
    content: [], usage: { input_tokens: 1500, output_tokens: 0 },
  });
  const r = await handler(anfrage());
  const d = await r.json();
  assertEquals(r.status, 422);
  assert(String(d.error).startsWith("Riki darf zu dieser Anfrage keine Vorschläge machen"));
  assertEquals(buchungen.length, 1);
  assertEquals(buchungen[0].p_erfolg, false);
  assertEquals(buchungen[0].p_fehler, "refusal:general_harms");
});

Deno.test("Ausweichschaltung: fallback-Block + thinking ignoriert, Kosten je Versuch, Modell = Ausweichmodell", async () => {
  zuruecksetzen({
    id: "msg_3", type: "message", role: "assistant", model: "claude-sonnet-5", stop_reason: "end_turn", stop_details: null,
    content: [
      { type: "fallback", from: { model: "claude-sonnet-5-5" }, to: { model: "claude-sonnet-5" } },
      { type: "thinking", thinking: "", signature: "sig2" },
      { type: "text", text: JSON.stringify(VORSCHLAG) },
    ],
    usage: {
      input_tokens: 1500, output_tokens: 900,
      iterations: [
        { type: "message", model: "claude-sonnet-5-5", input_tokens: 1500, output_tokens: 0 },
        { type: "fallback_message", model: "claude-sonnet-5", input_tokens: 1500, output_tokens: 900 },
      ],
    },
  });
  const r = await handler(anfrage());
  const d = await r.json();
  assertEquals(r.status, 200, JSON.stringify(d));
  assertEquals(d.meta.modell, "claude-sonnet-5");
  assertEquals(d.meta.kosten_usd, 0.015); // 1500×2 + (1500×2 + 900×10) je 1M
  assertEquals(d.vorschlaege[0].schritte.length, 5);
  assertEquals(buchungen[0].p_modell, "claude-sonnet-5");
});

Deno.test("Abgeschnitten (max_tokens): Fehler statt halbem JSON", async () => {
  zuruecksetzen({
    id: "msg_4", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "max_tokens", stop_details: null,
    content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "{\"vorschlaege\": [" }],
    usage: { input_tokens: 1500, output_tokens: 12000 },
  });
  const r = await handler(anfrage());
  assertEquals(r.status, 502);
  assertEquals(buchungen[0].p_erfolg, false);
  assertEquals(buchungen[0].p_fehler, "max_tokens");
});

Deno.test("Schritte als Liste statt Text werden vereinheitlicht", async () => {
  const v2 = structuredClone(VORSCHLAG);
  (v2.vorschlaege[0] as any).zubereitung = ["1) Öl erhitzen.", "Gemüse 6 Minuten anbraten.", "", "3. Eier stocken lassen."];
  zuruecksetzen({
    id: "msg_5", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_details: null,
    content: [{ type: "text", text: JSON.stringify(v2) }], usage: { input_tokens: 10, output_tokens: 10 },
  });
  const d = await (await handler(anfrage())).json();
  assertEquals(d.vorschlaege[0].schritte, ["Öl erhitzen.", "Gemüse 6 Minuten anbraten.", "Eier stocken lassen."]);
  assertEquals(d.vorschlaege[0].zubereitung, "1. Öl erhitzen.\n2. Gemüse 6 Minuten anbraten.\n3. Eier stocken lassen.");
});

Deno.test("Fremdes Modell im Body wird ignoriert (Standard Sonnet 5.5)", async () => {
  zuruecksetzen({
    id: "msg_6", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_details: null,
    content: [{ type: "text", text: JSON.stringify(VORSCHLAG) }], usage: { input_tokens: 10, output_tokens: 10 },
  });
  await handler(anfrage({ modell: "claude-fable-5-2" }));
  assertEquals(anthropicAufrufe[0].body.model, "claude-sonnet-5-5");
});

function antwortMit(vorschlag: any) {
  return {
    id: "msg_k", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn", stop_details: null,
    content: [{ type: "text", text: JSON.stringify(vorschlag) }], usage: { input_tokens: 10, output_tokens: 10 },
  };
}

Deno.test("kcal_portion: Ziel pro Portion steht im Prompt, Spickzettel mit Katalogwerten", async () => {
  zuruecksetzen(antwortMit(VORSCHLAG));
  const r = await handler(anfrage({ kcal_tag: undefined, kcal_portion: 650 }));
  const d = await r.json();
  assertEquals(r.status, 200, JSON.stringify(d));
  const frage = anthropicAufrufe[0].body.messages[0].content as string;
  assert(frage.includes("Ziel pro Portion: etwa 650 kcal"), frage);
  assert(!frage.includes("Tagesbedarf"), "neuer Weg darf nicht von Tagesbedarf reden");
  assert(frage.includes("Gemüsemischung → Katalog „Gemüsemischung Kaisergemüse“: 37 kcal"), frage);
  assertEquals(d.meta.kcal_portion, 650);
  assertEquals(d.meta.ziel_quelle, "portion");
});

Deno.test("Alter Weg kcal_tag: Ziel = Anteil der Mahlzeit (Mittagessen 35 %)", async () => {
  zuruecksetzen(antwortMit(VORSCHLAG));
  const d = await (await handler(anfrage())).json(); // kcal_tag 1800, Mittagessen
  assertEquals(d.meta.kcal_portion, 630);
  assertEquals(d.meta.ziel_quelle, "tag");
  assert((anthropicAufrufe[0].body.messages[0].content as string).includes("abgeleitet aus 1800 kcal Tagesbedarf für Mittagessen"));
});

Deno.test("Zuordnung: jede Zutat hat produkt_id und Nährwerte, kcal pro Portion aus dem Katalog", async () => {
  zuruecksetzen(antwortMit(VORSCHLAG));
  const d = await (await handler(anfrage({ kcal_tag: undefined }))).json(); // ohne Ziel: keine Anpassung
  const v = d.vorschlaege[0];
  for (const z of v.zutaten) { assert(z.produkt_id, "ohne Zuordnung: " + z.name); assert(z.naehrwerte_100g?.kcal != null); }
  // 150 g Ei (202,5) + 200 g Gemüse (74) + 80 g Salakis (128,8) + 10 g Öl (89,9) = 495,2
  assertEquals(v.kcal_berechnet, 495);
  assertEquals(v.kcal_geschaetzt, 495);
  assertEquals(v.kcal_riki, 520);
  assertEquals(v.zutaten_mit_naehrwerten, 4);
  assertEquals(v.zutaten_ohne_naehrwerte, 0);
  assertEquals(v.naehrwerte_portion.protein, 39.6);
});

Deno.test("Mengen werden ans Ziel angepasst (±15 %), Anleitung nennt die neue Menge", async () => {
  zuruecksetzen(antwortMit(VORSCHLAG));
  const d = await (await handler(anfrage({ kcal_tag: undefined, kcal_portion: 700 }))).json();
  const v = d.vorschlaege[0];
  assert(Math.abs(v.kcal_geschaetzt - 700) / 700 <= 0.15, "kcal " + v.kcal_geschaetzt);
  assertEquals(v.passt_zu_kcal, true);
  assertEquals(v.mengen_angepasst.kcal_vorher, 495);
  const gemuese = v.zutaten.find((z: any) => z.name === "Gemüsemischung");
  const oel = v.zutaten.find((z: any) => z.name === "Olivenöl");
  assertEquals(oel.menge, "1 EL"); // Löffel bleiben
  assert(gemuese.menge !== "200 g" && v.zubereitung.includes("Gemüsemischung (" + gemuese.menge + ")"), v.zubereitung);
  assertEquals(v.schritte.length, 5);
});

Deno.test("Ohne menge_g: TL, Prise, Stück werden in Gramm umgerechnet", async () => {
  const v2 = structuredClone(VORSCHLAG);
  (v2.vorschlaege[0] as any).zutaten = [
    { name: "Eier", menge: "2 Stück", menge_g: null, aus_vorrat: true },
    { name: "Olivenöl", menge: "1 TL", menge_g: null, aus_vorrat: false },
    { name: "Salz", menge: "1 Prise", menge_g: null, aus_vorrat: false },
    { name: "Kartoffeln", menge: "1/2 kg", menge_g: null, aus_vorrat: true },
    { name: "Pfeffer", menge: "1 Prise", menge_g: null, aus_vorrat: false },
  ];
  zuruecksetzen(antwortMit(v2));
  const d = await (await handler(anfrage({ kcal_tag: undefined }))).json();
  const g = Object.fromEntries(d.vorschlaege[0].zutaten.map((z: any) => [z.name, z.menge_g]));
  assertEquals(g, { Eier: 100, Olivenöl: 5, Salz: 0.5, Kartoffeln: 500, Pfeffer: 0.5 });
  const pf = d.vorschlaege[0].zutaten.find((z: any) => z.name === "Pfeffer");
  assertEquals(pf.produkt_id, null);
  assertEquals(pf.mit_naehrwerten, false);
  assertEquals(d.vorschlaege[0].zutaten_ohne_naehrwerte, 1);
  assertEquals(d.vorschlaege[0].kcal_vollstaendig, true); // Pfeffer 0,5 g fällt nicht ins Gewicht
});
