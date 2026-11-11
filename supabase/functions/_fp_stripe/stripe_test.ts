// Attrappen-Test (ohne echten Schluessel, ohne Netz): deno test supabase/functions/_fp_stripe/stripe_test.ts
import { assertEquals, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stripe, stripeSchluessel, euro, monatName } from "./stripe.ts";

Deno.test("ohne Schluessel: klare Meldung", () => {
  Deno.env.delete("STRIPE_FP_SECRET_KEY");
  assertThrows(() => stripeSchluessel("test"), Error, "STRIPE_FP_SECRET_KEY fehlt");
});
Deno.test("Schluessel muss zum Modus passen", () => {
  Deno.env.set("STRIPE_FP_SECRET_KEY", "sk_live_attrappe");
  assertThrows(() => stripeSchluessel("test"), Error, "kein Testschluessel");
  Deno.env.set("STRIPE_FP_SECRET_KEY", "sk_test_attrappe");
  assertThrows(() => stripeSchluessel("live"), Error, "kein Live-Schluessel");
  assertEquals(stripeSchluessel("test"), "sk_test_attrappe");
  Deno.env.set("STRIPE_FP_SECRET_KEY", " rk_test_x \n");
  assertEquals(stripeSchluessel("test"), "rk_test_x");
});
Deno.test("Formular, Version, Idempotenz an Stripe", async () => {
  const echt = globalThis.fetch; let gesehen: any;
  globalThis.fetch = (async (url: string, o: any) => { gesehen = { url, ...o }; return new Response(JSON.stringify({ id: "in_attrappe" }), { status: 200 }); }) as any;
  try {
    const r = await stripe("sk_test_x", "POST", "checkout/sessions",
      { mode: "setup", payment_method_types: ["sepa_debit", "card"], metadata: { a: "b" }, leer: null }, "idem-1");
    assertEquals(r.id, "in_attrappe");
    assertEquals(gesehen.url, "https://api.stripe.com/v1/checkout/sessions");
    assertEquals(gesehen.headers["Stripe-Version"], "2024-06-20");
    assertEquals(gesehen.headers["Idempotency-Key"], "idem-1");
    assertEquals(decodeURIComponent(gesehen.body), "mode=setup&payment_method_types[0]=sepa_debit&payment_method_types[1]=card&metadata[a]=b");
    await stripe("sk_test_x", "GET", "checkout/sessions/cs_1", { expand: ["setup_intent.payment_method"] });
    assertEquals(decodeURIComponent(gesehen.url), "https://api.stripe.com/v1/checkout/sessions/cs_1?expand[0]=setup_intent.payment_method");
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "No such customer" } }), { status: 400 })) as any;
    await assertRejects(() => stripe("sk_test_x", "GET", "customers/x"), Error, "Stripe 400: No such customer");
  } finally { globalThis.fetch = echt; }
});
Deno.test("Euro und Monat deutsch", () => {
  assertEquals(euro(998).replace(/\s/g, " "), "9,98 €");
  assertEquals(monatName("2026-10-01"), "Oktober 2026");
});
