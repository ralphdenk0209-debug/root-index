// Attrappen-Test der Monatsrechnung: Datenbank und Stripe werden vorgetaeuscht, kein Netz.
// deno test --allow-env --allow-net=esm.sh,deno.land --allow-read supabase/functions/fp-monatsrechnung/attrappe_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

type Ruf = { m: string; url: string; body: string; idem?: string };
const rufe: Ruf[] = [];
let liste: any[] = [];
let handler: (r: Request) => Promise<Response>;

Deno.env.set("SUPABASE_URL", "https://attrappe.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "anon"); Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "dienst");
(Deno as any).serve = (h: any) => { handler = h; };
const echt = globalThis.fetch;
globalThis.fetch = (async (input: any, o: any = {}) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  if (url.startsWith("https://esm.sh") || url.startsWith("https://deno.land")) return echt(input, o);
  const body = typeof o.body === "string" ? o.body : "";
  const h = new Headers(o.headers);
  rufe.push({ m: o.method ?? "GET", url, body: decodeURIComponent(body), idem: h.get("Idempotency-Key") ?? undefined });
  const J = (x: unknown) => new Response(JSON.stringify(x), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.includes("/rest/v1/rpc/_fp_stripe_monatsliste")) return J(liste);
  if (url.includes("/rest/v1/fachperson_rechnung")) return J(o.method === "POST" ? { id: 7 } : []);
  if (url.endsWith("/v1/invoices")) return J({ id: "in_1" });
  if (url.endsWith("/v1/invoiceitems")) return J({ id: "ii" });
  if (url.endsWith("/v1/invoices/in_1/finalize")) return J({ id: "in_1", status: "open", number: "RI-0001", hosted_invoice_url: "https://x/h", invoice_pdf: "https://x/p" });
  return new Response("{}", { status: 404 });
}) as any;
await import("./index.ts");

const zeile = { auth_id: "a1", name: "T1", praxis: "P", email: "t@x", modus: "test", customer_id: "cus_1", zahlungsart: "SEPA ···3000",
  monat: "2026-10-01", abrechnung: "monat", modell: "je_key", keys: 2, key_tage: 40, preis_cent: 499,
  keys_betrag_cent: 998, lizenz_betrag_cent: 0, betrag_cent: 998, rechnung_status: null, stripe_invoice_id: null };
const los = (b: unknown) => handler(new Request("http://x", { method: "POST", headers: { Authorization: "Bearer dienst" }, body: JSON.stringify(b) })).then((r) => r.json());

Deno.test("ohne Schluessel: klare Meldung, nichts an Stripe", async () => {
  Deno.env.delete("STRIPE_FP_SECRET_KEY"); liste = [zeile]; rufe.length = 0;
  const r = await los({ monat: "2026-10-01" });
  assertEquals(r.nicht_eingerichtet, true);
  assertEquals(r.fehler.startsWith("Stripe noch nicht eingerichtet"), true);
  assertEquals(rufe.filter((x) => x.url.includes("stripe.com")).length, 0);
});
Deno.test("Live-Schluessel im Testmodus wird abgewiesen", async () => {
  Deno.env.set("STRIPE_FP_SECRET_KEY", "sk_live_attrappe"); liste = [zeile]; rufe.length = 0;
  const r = await los({ monat: "2026-10-01" });
  assertEquals(r.nicht_eingerichtet, true);
  assertEquals(rufe.filter((x) => x.url.includes("stripe.com")).length, 0);
});
Deno.test("Rechnung: 2 Keys x 4,99, Paragraf 19, abschliessen, Idempotenz", async () => {
  Deno.env.set("STRIPE_FP_SECRET_KEY", "sk_test_attrappe"); liste = [zeile]; rufe.length = 0;
  const r = await los({ monat: "2026-10-01" });
  assertEquals(r.ergebnis[0].status, "erstellt");
  const s = rufe.filter((x) => x.url.includes("stripe.com"));
  assertEquals(s.map((x) => x.url.replace("https://api.stripe.com/v1/", "")), ["invoices", "invoiceitems", "invoices/in_1/finalize"]);
  assertEquals(s[0].body.includes("footer=Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.".replace(/ /g, "+")) || s[0].body.includes("§ 19 UStG"), true);
  assertEquals(s[0].body.includes("collection_method=charge_automatically"), true);
  assertEquals(s[1].body.includes("amount=998"), true);
  assertEquals(s[1].body.includes("2+×+4,99") || s[1].body.includes("2 × 4,99"), true);
  assertEquals(s[0].idem, "fp-rechnung-test-a1-2026-10-01-inv");
  // keine Klientendaten an Stripe
  assertEquals(s.some((x) => /STRTEST|Frau |bezeichnung|klient_auth/.test(x.body)), false);
  // Belegen vor Stripe
  const erstDb = rufe.findIndex((x) => x.url.includes("fachperson_rechnung") && x.m === "POST");
  const erstStripe = rufe.findIndex((x) => x.url.includes("stripe.com"));
  assertEquals(erstDb >= 0 && erstDb < erstStripe, true);
});
Deno.test("schon abgerechnet: nichts doppelt", async () => {
  liste = [{ ...zeile, rechnung_status: "offen", stripe_invoice_id: "in_alt" }]; rufe.length = 0;
  const r = await los({ monat: "2026-10-01" });
  assertEquals(r.ergebnis[0].status, "schon");
  assertEquals(rufe.filter((x) => x.url.includes("stripe.com")).length, 0);
});
Deno.test("ohne Zahlungsart: vermerkt, keine Stripe-Rechnung", async () => {
  liste = [{ ...zeile, customer_id: null, zahlungsart: null }]; rufe.length = 0;
  const r = await los({ monat: "2026-10-01" });
  assertEquals(r.ergebnis[0].status, "ohne_zahlungsart");
  assertEquals(rufe.filter((x) => x.url.includes("stripe.com")).length, 0);
});
Deno.test("Lizenz plus Keys: zwei Positionen", async () => {
  liste = [{ ...zeile, modell: "lizenz_plus_keys", lizenz_betrag_cent: 1900, betrag_cent: 2898 }]; rufe.length = 0;
  await los({ monat: "2026-10-01" });
  const items = rufe.filter((x) => x.url.endsWith("/v1/invoiceitems"));
  assertEquals(items.length, 2);
  assertEquals(items[1].body.includes("amount=1900"), true);
});
Deno.test("fremder Aufrufer ohne Admin abgewiesen", async () => {
  const r = await handler(new Request("http://x", { method: "POST", headers: { Authorization: "Bearer fremd" }, body: "{}" }));
  assertEquals(r.status, 401);
});
