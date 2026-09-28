// umsatz-sync — 28.09.2026 (Ralph "ja, plausibel"): Zaehler EU-Schwelle 10.000 EUR.
// Liest alle erfolgreichen Stripe-Zahlungen (Abo + freiwillige Unterstuetzung) seit 1.1. des Vorjahres
// und speichert Betrag, Erstattung, Waehrung und Kundenland ueber public.cb_umsatz_stripe_speichern.
// Land: Rechnungsadresse (billing_details), sonst Kartenland. Schreibt NICHTS nach Stripe.
// Aufruf: taeglich per pg_cron (cb_edge_rufen, service_role) oder von einem Admin aus dem Cockpit.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000";
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== "Bearer " + service) {
    const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: adm } = await sb.rpc("cb_ist_admin");
    if (adm !== true) return json({ ok: false, fehler: "Nur Admin/Takt." }, 401);
  }
  const admin = createClient(url, service);
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return json({ ok: false, fehler: "STRIPE_SECRET_KEY fehlt" }, 500);

  const jahr = new Date().getUTCFullYear() - 1;
  const ab = Math.floor(Date.UTC(jahr, 0, 1) / 1000) - 3600;
  const rows: Record<string, unknown>[] = [];
  let nach: string | null = null, fehler: string | null = null;
  try {
    for (let seite = 0; seite < 100; seite++) {
      const q = new URLSearchParams({ limit: "100", "created[gte]": String(ab) });
      if (nach) q.set("starting_after", nach);
      const r = await fetch("https://api.stripe.com/v1/charges?" + q, { headers: { Authorization: "Bearer " + key } });
      const j = await r.json();
      if (!r.ok) { fehler = "Stripe " + r.status + ": " + (j?.error?.message ?? ""); break; }
      for (const c of j.data ?? []) {
        if (c.status !== "succeeded" || !c.paid) continue;
        const bl = c.billing_details?.address?.country ?? null;
        const kl = c.payment_method_details?.card?.country ?? null;
        rows.push({
          id: c.id, created: c.created, amount: c.amount, refunded: c.amount_refunded ?? 0, currency: c.currency,
          land: bl ?? kl, land_quelle: bl ? "rechnungsadresse" : (kl ? "karte" : null),
          art: c.invoice ? "abo" : "unterstuetzung", ref: c.description ?? c.metadata?.client_reference_id ?? null, live: c.livemode,
        });
      }
      if (!j.has_more || !(j.data?.length)) break;
      nach = j.data[j.data.length - 1].id;
    }
  } catch (e) { fehler = String((e as Error)?.message ?? e); }
  const { data, error } = await admin.rpc("cb_umsatz_stripe_speichern", { p_rows: rows, p_fehler: fehler });
  if (error) return json({ ok: false, fehler: error.message }, 500);
  return json({ ok: !fehler, gelesen: rows.length, fehler, speicher: data });
});
