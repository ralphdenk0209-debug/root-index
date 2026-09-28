import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* 28.09.2026 (Ralph: "nicht eu darf sich vorerst nicht im bezahldienst anmelden
   wegen dem steuerrecht"): Premium-Kauf fuer die Laender UK und US gesperrt.
   Geprueft wird das Land im Profil (Benutzer_Einstellung 'markt') UND das von
   der App mitgeschickte Land - eines von beiden UK/US reicht fuer die Sperre.
   Bis dahin unveraendert (Stand Version 34, jetzt im Repo). */
const GESPERRT = new Set(["UK", "US"]);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function priceForPlan(plan: string): string {
  const month = Deno.env.get("STRIPE_PRICE_MONTH") || Deno.env.get("STRIPE_PRICE_ID") || "";
  const quarter = Deno.env.get("STRIPE_PRICE_QUARTER") || month;
  const year = Deno.env.get("STRIPE_PRICE_YEAR") || month;
  if (plan === "quarter") return quarter;
  if (plan === "year") return year;
  return month;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "not authenticated" }, 401);

    let plan = "month";
    let marktApp = "";
    try {
      const body = await req.json();
      if (body && typeof body.plan === "string") plan = body.plan;
      if (body && typeof body.markt === "string") marktApp = body.markt.toUpperCase();
    } catch (_) { /* no body */ }
    const price = priceForPlan(plan);
    if (!price) return json({ error: "no price configured" }, 500);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: b } = await admin.from("Benutzer").select("Benutzer_ID, Email, stripe_customer_id").eq("auth_id", user.id).single();

    // Laendersperre (Steuerrecht): vor jedem Kontakt mit Stripe
    let marktProfil = "";
    if (b?.Benutzer_ID) {
      const { data: e } = await admin.from("Benutzer_Einstellung").select("Wert").eq("Benutzer_ID", b.Benutzer_ID).eq("Schluessel", "markt").limit(1).maybeSingle();
      marktProfil = String(e?.Wert || "").toUpperCase();
    }
    if (GESPERRT.has(marktProfil) || GESPERRT.has(marktApp)) {
      return json({ error: "land_gesperrt", markt: GESPERRT.has(marktProfil) ? marktProfil : marktApp }, 403);
    }

    let customerId = b?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: (b?.Email as string) || user.email || undefined, metadata: { auth_id: user.id } });
      customerId = customer.id;
      await admin.from("Benutzer").update({ stripe_customer_id: customerId }).eq("auth_id", user.id);
    }

    // AGB: Testphase nur beim ersten Abonnement
    let hatteAbo = false;
    try {
      const alt = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
      hatteAbo = alt.data.length > 0;
    } catch (_) { hatteAbo = false; }
    const mitTest = !hatteAbo;

    const hinweis = mitTest
      ? "Es gelten die AGB und die Widerrufsbelehrung von Root Index (root-index.de, Menü → Rechtliches). Die siebentägige Testphase ist kostenlos; danach wird der gewählte Preis fällig, sofern du nicht vorher kündigst."
      : "Es gelten die AGB und die Widerrufsbelehrung von Root Index (root-index.de, Menü → Rechtliches). Die kostenlose Testphase gilt nur für das erste Abonnement; der gewählte Preis wird sofort fällig.";

    // Frankreich: Bezahlseite und Hinweis auf Franzoesisch (Loi Toubon), 28.09.2026
    const fr = marktProfil === "FR" || marktApp === "FR";
    const hinweisFr = mitTest
      ? "Les CGV et l’information sur le droit de rétractation de Root Index s’appliquent (menu → Mentions juridiques). L’essai de sept jours est gratuit ; ensuite, le prix choisi est dû, sauf résiliation préalable."
      : "Les CGV et l’information sur le droit de rétractation de Root Index s’appliquent (menu → Mentions juridiques). L’essai gratuit ne vaut que pour le premier abonnement ; le prix choisi est dû immédiatement.";
    const origin = req.headers.get("origin") || "https://root-index.de";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: mitTest ? { trial_period_days: 7, metadata: { auth_id: user.id } } : { metadata: { auth_id: user.id } },
      allow_promotion_codes: true,
      locale: fr ? "fr" : "de",
      custom_text: { submit: { message: fr ? hinweisFr : hinweis } },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });
    return json({ url: session.url, testphase: mitTest });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
