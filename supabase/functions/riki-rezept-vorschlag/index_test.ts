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
function zuruecksetzen(antwort: any) { anthropicAntwort = antwort; anthropicAufrufe = []; buchungen = []; }

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
