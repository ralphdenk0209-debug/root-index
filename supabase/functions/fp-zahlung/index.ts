/* ---- FP-ZAHLUNG -----------------------------------------------------------
   ENTWURF 11.11.2026, FL-1: Zahlungsart der Fachperson fuer die monatliche
   Abrechnung. Nur mit Login der Fachperson (verify_jwt an, cb_fp_stripe_kundin
   prueft _fp_ich). Aktionen (POST {aktion}):
     einrichten  -> Stripe Checkout im Setup-Modus (SEPA-Lastschrift oder Karte),
                    legt bei Bedarf die Stripe-Kundin an. Antwort {url}.
     bestaetigen -> nach Rueckkehr (sid): Zahlungsart als Standard fuer Rechnungen
                    setzen, Anzeige-Text speichern.
     portal      -> Stripe-Kundenportal (Rechnungen/PDF, Zahlungsart, Rechnungsadresse).
     auffrischen -> Status offener Rechnungen bei Stripe nachsehen (statt Webhook).
   Premium-Anbindung bleibt unberuehrt (eigener Schluessel, siehe _fp_stripe). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripe, stripeSchluessel } from "../_fp_stripe/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* Rueckkehr nur auf eigene Seiten */
function basis(wunsch?: string): string {
  const erlaubt = /^(https:\/\/(www\.)?root-index\.de|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
  return wunsch && erlaubt.test(wunsch) ? wunsch : "https://root-index.de";
}

function zahlungsartText(pm: any): string {
  if (pm?.type === "sepa_debit") return "SEPA-Lastschrift ···" + (pm.sepa_debit?.last4 ?? "");
  if (pm?.type === "card") {
    const marke = String(pm.card?.brand ?? "Karte");
    return marke.charAt(0).toUpperCase() + marke.slice(1) + " ···" + (pm.card?.last4 ?? "");
  }
  return pm?.type ?? "Zahlungsart";
}

const STATUS: Record<string, string> = { draft: "angelegt", open: "offen", paid: "bezahlt", uncollectible: "fehlgeschlagen", void: "storniert" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, grund: "Nur POST" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, grund: "Bitte anmelden." }, 401);
  let body: { aktion?: string; sid?: string; basis?: string } = {};
  try { body = await req.json(); } catch { /* leer */ }

  const url = Deno.env.get("SUPABASE_URL")!;
  const nutzer = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ich, error } = await nutzer.rpc("cb_fp_stripe_kundin");
  if (error || !ich?.auth_id) return json({ ok: false, grund: error?.message || "Nur für freigeschaltete Fachleute." }, 403);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let key: string;
  try { key = stripeSchluessel(ich.modus); } catch (e) { return json({ ok: false, grund: "Zahlung ist gerade nicht eingerichtet.", technik: String(e) }, 500); }
  const zurueck = basis(body.basis) + "/therapeut.html";

  try {
    if (body.aktion === "einrichten") {
      let kunde = ich.customer_id as string | null;
      if (!kunde) {
        const k = await stripe(key, "POST", "customers", {
          name: ich.praxis || ich.name, email: ich.email, preferred_locales: ["de"],
          description: "Root Index für Fachleute" + (ich.praxis ? " – " + ich.name : ""),
          metadata: { root_index_fachperson: ich.auth_id, modus: ich.modus },
        }, "fp-kunde-" + ich.modus + "-" + ich.auth_id);
        kunde = k.id;
        const { error: e2 } = await admin.from("fachperson_stripe").insert({ auth_id: ich.auth_id, modus: ich.modus, customer_id: kunde });
        if (e2) throw new Error("Speichern: " + e2.message);
      }
      const s = await stripe(key, "POST", "checkout/sessions", {
        mode: "setup", customer: kunde, currency: "eur", locale: "de",
        payment_method_types: ["sepa_debit", "card"],
        success_url: zurueck + "?zahlung=ok&sid={CHECKOUT_SESSION_ID}#einstellungen",
        cancel_url: zurueck + "?zahlung=abbruch#einstellungen",
        metadata: { root_index_fachperson: ich.auth_id },
      });
      return json({ ok: true, url: s.url });
    }

    if (body.aktion === "bestaetigen") {
      if (!ich.customer_id || !body.sid) return json({ ok: false, grund: "Nichts zu bestätigen." });
      const s = await stripe(key, "GET", "checkout/sessions/" + encodeURIComponent(body.sid), { expand: ["setup_intent.payment_method"] });
      if (s.customer !== ich.customer_id) return json({ ok: false, grund: "Diese Sitzung gehört nicht zu diesem Konto." }, 403);
      const pm = s.setup_intent?.payment_method;
      if (s.status !== "complete" || !pm?.id) return json({ ok: false, grund: "Die Zahlungsart wurde noch nicht bestätigt." });
      await stripe(key, "POST", "customers/" + ich.customer_id, { invoice_settings: { default_payment_method: pm.id } });
      const text = zahlungsartText(pm);
      await admin.from("fachperson_stripe").update({ zahlungsart: text, zahlungsart_am: new Date().toISOString() })
        .eq("auth_id", ich.auth_id).eq("modus", ich.modus);
      return json({ ok: true, zahlungsart: text });
    }

    if (body.aktion === "portal") {
      if (!ich.customer_id) return json({ ok: false, grund: "Bitte zuerst eine Zahlungsart hinterlegen." });
      // Portal-Einstellung einmal je Modus anlegen und merken (fachleute_einstellung)
      const sk = "stripe_portal_" + ich.modus;
      let conf = (await admin.from("fachleute_einstellung").select("wert").eq("schluessel", sk).maybeSingle()).data?.wert as string | undefined;
      if (!conf) {
        const c = await stripe(key, "POST", "billing_portal/configurations", {
          business_profile: { headline: "Root Index für Fachleute – Abrechnung",
                              privacy_policy_url: "https://root-index.de/#datenschutz", terms_of_service_url: "https://root-index.de/#agb" },
          features: {
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            customer_update: { enabled: true, allowed_updates: ["name", "email", "address"] },
            subscription_cancel: { enabled: false },
          },
          default_return_url: zurueck,
          metadata: { zweck: "fachleute" },
        }, "fp-portal-" + ich.modus + "-v1");
        conf = c.id;
        await admin.from("fachleute_einstellung").upsert({ schluessel: sk, wert: conf, notiz: "Stripe-Kundenportal Fachleute (" + ich.modus + ")" });
      }
      const p = await stripe(key, "POST", "billing_portal/sessions", { customer: ich.customer_id, configuration: conf, return_url: zurueck + "#einstellungen", locale: "de" });
      return json({ ok: true, url: p.url });
    }

    if (body.aktion === "auffrischen") {
      const { data: offen } = await admin.from("fachperson_rechnung").select("id, stripe_invoice_id")
        .eq("auth_id", ich.auth_id).eq("modus", ich.modus).in("status", ["angelegt", "offen"]).not("stripe_invoice_id", "is", null);
      for (const r of offen ?? []) {
        const inv = await stripe(key, "GET", "invoices/" + r.stripe_invoice_id);
        const st = inv.status === "open" && inv.attempt_count > 0 && !inv.next_payment_attempt ? "fehlgeschlagen" : (STATUS[inv.status] ?? "offen");
        await admin.from("fachperson_rechnung").update({ status: st, rechnung_nr: inv.number, rechnung_url: inv.hosted_invoice_url,
          pdf_url: inv.invoice_pdf, aktualisiert_am: new Date().toISOString() }).eq("id", r.id);
      }
      return json({ ok: true, geprueft: (offen ?? []).length });
    }

    return json({ ok: false, grund: "Unbekannte Aktion." }, 400);
  } catch (e) {
    return json({ ok: false, grund: "Stripe ist gerade nicht erreichbar. Bitte später noch einmal.", technik: String(e).slice(0, 300) }, 502);
  }
});
