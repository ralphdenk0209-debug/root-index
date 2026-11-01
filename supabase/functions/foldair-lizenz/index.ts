// =============================================================================
//  Foldair-Lizenz nach dem Kauf   (31.10.2026)
// -----------------------------------------------------------------------------
//  Die Danke-Seite foldair.de/danke.html ruft diese Funktion mit der Stripe-
//  Checkout-ID auf (?session_id=cs_...). Die Funktion fragt Stripe, ob wirklich
//  bezahlt wurde, und erzeugt dann den Lizenzschlüssel – im selben Format wie
//  Foldair ihn prüft: Base64("Name|E-Mail|Art|Datum") + "." + Base64(Ed25519-Signatur).
//  Ed25519 ist deterministisch: dieselbe Bestellung liefert immer denselben Schlüssel.
//
//  Geheimnisse (Supabase → Edge Functions → Secrets):
//    STRIPE_SECRET_KEY   – vorhanden (Root Index)
//    FOLDAIR_LIZENZ_KEY  – privater Schlüssel aus Ralphs Schlüsselbund „Foldair Lizenz-Signatur“
//  Jeder Verkauf wird in public.foldair_lizenzen festgehalten.
// =============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

const CORS = {
  "Access-Control-Allow-Origin": "https://foldair.de",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const antwort = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

// Preis → Lizenzart (Cent). 19,99 € ist der Startpreis der persönlichen Lizenz.
function art(betrag: number): string | null {
  if (betrag === 1999 || betrag === 2900) return "persoenlich";
  if (betrag === 3900) return "familie";
  if (betrag === 6900) return "firma";
  return null;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function signieren(text: string): Promise<string> {
  const seed = Uint8Array.from(atob(Deno.env.get("FOLDAIR_LIZENZ_KEY")!), (c) => c.charCodeAt(0));
  // PKCS#8-Hülle für einen rohen 32-Byte-Ed25519-Schlüssel
  const kopf = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];
  const pkcs8 = new Uint8Array([...kopf, ...seed]);
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  const daten = new TextEncoder().encode(text);
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", key, daten));
  return b64(daten) + "." + b64(sig);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const id = new URL(req.url).searchParams.get("session_id") ?? "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return antwort(400, { fehler: "Ungültige Bestellnummer." });

  let s: Stripe.Checkout.Session;
  try {
    s = await stripe.checkout.sessions.retrieve(id, { expand: ["line_items.data.price.product"] });
  } catch {
    return antwort(404, { fehler: "Bestellung nicht gefunden." });
  }
  // „no_payment_required“: 100-%-Gutschein (Tester, Verlosungen)
  if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return antwort(402, { fehler: "Die Zahlung ist noch nicht abgeschlossen." });

  const posten = s.line_items?.data?.[0];
  const produkt = posten?.price?.product as Stripe.Product | undefined;
  if (!produkt?.name?.toLowerCase().includes("foldair")) return antwort(404, { fehler: "Das ist keine Foldair-Bestellung." });
  const lizenzart = art(posten?.price?.unit_amount ?? 0);
  if (!lizenzart) return antwort(500, { fehler: "Unbekannter Preis – bitte an kontakt@root-index.de schreiben." });

  const email = s.customer_details?.email ?? "";
  const name = (s.customer_details?.name || email).replaceAll("|", " ").trim();
  const tag = new Date(s.created * 1000).toISOString().slice(0, 10);
  const schluessel = await signieren(`${name}|${email}|${lizenzart}|${tag}`);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("foldair_lizenzen").upsert({
    session_id: id, name, email, art: lizenzart, betrag_cent: s.amount_total, schluessel, test: !s.livemode,
  }, { onConflict: "session_id", ignoreDuplicates: true });

  return antwort(200, { name, email, art: lizenzart, schluessel });
});
