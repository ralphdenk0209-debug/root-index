/* ---- FP-MONATSRECHNUNG ----------------------------------------------------
   ENTWURF 11.11.2026, FL-1: Monatsrechnung je Fachperson fuer den VORMONAT.
   Aufruf: Takt am 1. des Monats (cb_edge_rufen, service_role) oder Admin.
   Body (optional): { monat: "2026-11-01", nur: "<auth_id>", probe: true }
     probe -> nichts bei Stripe anlegen, nur zeigen, was abgerechnet wuerde.

   Je Fachperson mit Betrag > 0 (_fp_stripe_monatsliste, gleiche Rechnung wie
   die Monatsvorschau in therapeut.html):
     - ohne Zahlungsart -> Zeile 'ohne_zahlungsart', keine Stripe-Rechnung
     - sonst Rechnung (sofort einziehen), Positionen Keys und ggf. Lizenz,
       Fusszeile § 19 UStG, abschliessen -> Stripe zieht automatisch ein.
   Doppelt abrechnen ist ausgeschlossen: Zeile in fachperson_rechnung wird
   VOR dem Stripe-Aufruf belegt (unique auth_id+modus+monat), dazu
   Idempotency-Keys bei Stripe. Keine Klientendaten an Stripe. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { euro, monatName, stripe, stripeSchluessel } from "../_fp_stripe/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function vormonat(): string {
  const heute = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const d = new Date(Date.UTC(heute.getFullYear(), heute.getMonth() - 1, 1));
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000";
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== "Bearer " + service) {
    const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: adm } = await sb.rpc("cb_ist_admin");
    if (adm !== true) return json({ ok: false, fehler: "Nur Admin/Takt." }, 401);
  }
  let body: { monat?: string; nur?: string; probe?: boolean } = {};
  try { body = await req.json(); } catch { /* leer */ }
  const monat = /^\d{4}-\d{2}-01$/.test(body.monat ?? "") ? body.monat! : vormonat();
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: liste, error } = await admin.rpc("_fp_stripe_monatsliste", { p_monat: monat });
  if (error) return json({ ok: false, fehler: error.message }, 500);
  const zeilen = (liste ?? []).filter((z: any) => !body.nur || z.auth_id === body.nur);
  if (body.probe) return json({ ok: true, probe: true, monat, zeilen: zeilen.map((z: any) => ({
    name: z.name, praxis: z.praxis, keys: z.keys, betrag: euro(z.betrag_cent), zahlungsart: z.zahlungsart, schon: z.rechnung_status })) });
  if (!zeilen.length) return json({ ok: true, monat, erstellt: 0 });

  const modus = zeilen[0].modus as string;
  let key: string;
  try { key = stripeSchluessel(modus); } catch (e) { return json({ ok: false, fehler: "Stripe noch nicht eingerichtet: " + String(e).replace(/^Error: /, ""), nicht_eingerichtet: true }, 503); }

  const erg: unknown[] = [];
  for (const z of zeilen as any[]) {
    // schon fertig? (nur 'ohne_zahlungsart' und 'fehler' ohne Rechnung duerfen neu)
    if (z.rechnung_status && !(["ohne_zahlungsart", "fehler"].includes(z.rechnung_status) && !z.stripe_invoice_id)) {
      erg.push({ name: z.name, status: "schon", wie: z.rechnung_status }); continue;
    }
    const zeile = { auth_id: z.auth_id, modus, monat, keys: z.keys, keys_betrag_cent: z.keys_betrag_cent,
                    lizenz_betrag_cent: z.lizenz_betrag_cent, betrag_cent: z.betrag_cent, aktualisiert_am: new Date().toISOString() };
    if (!z.customer_id || !z.zahlungsart) {
      await admin.from("fachperson_rechnung").upsert({ ...zeile, status: "ohne_zahlungsart", fehler: null }, { onConflict: "auth_id,modus,monat" });
      erg.push({ name: z.name, status: "ohne_zahlungsart" }); continue;
    }
    // Zeile belegen (verhindert Doppellauf)
    const { data: beleg, error: eb } = await admin.from("fachperson_rechnung")
      .upsert({ ...zeile, status: "angelegt", fehler: null }, { onConflict: "auth_id,modus,monat" }).select("id").single();
    if (eb || !beleg) { erg.push({ name: z.name, status: "fehler", fehler: eb?.message }); continue; }
    const idem = `fp-rechnung-${modus}-${z.auth_id}-${monat}`;
    try {
      const mn = monatName(monat);
      const inv = await stripe(key, "POST", "invoices", {
        customer: z.customer_id, currency: "eur", collection_method: "charge_automatically", auto_advance: true,
        pending_invoice_items_behavior: "exclude",
        description: `Root Index für Fachleute – ${mn}`,
        footer: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
        metadata: { root_index_fachperson: z.auth_id, monat, modus },
      }, idem + "-inv");
      await admin.from("fachperson_rechnung").update({ stripe_invoice_id: inv.id }).eq("id", beleg.id);
      if (z.keys_betrag_cent > 0) {
        const was = z.abrechnung === "tag"
          ? `Klienten-Keys ${mn}: ${z.key_tage} Key-Tage, ${euro(z.preis_cent)} je Key und Monat, tagesgenau`
          : `Klienten-Keys ${mn}: ${z.keys} × ${euro(z.preis_cent)} (jeder angefangene Monat zählt voll)`;
        await stripe(key, "POST", "invoiceitems", { customer: z.customer_id, invoice: inv.id, currency: "eur",
          amount: z.keys_betrag_cent, description: was }, idem + "-keys");
      }
      if (z.lizenz_betrag_cent > 0) {
        await stripe(key, "POST", "invoiceitems", { customer: z.customer_id, invoice: inv.id, currency: "eur",
          amount: z.lizenz_betrag_cent, description: `Lizenz Root Index für Fachleute – ${mn}` }, idem + "-lizenz");
      }
      const fin = await stripe(key, "POST", `invoices/${inv.id}/finalize`, { auto_advance: true }, idem + "-fin");
      await admin.from("fachperson_rechnung").update({ status: fin.status === "paid" ? "bezahlt" : "offen", rechnung_nr: fin.number,
        rechnung_url: fin.hosted_invoice_url, pdf_url: fin.invoice_pdf, aktualisiert_am: new Date().toISOString() }).eq("id", beleg.id);
      erg.push({ name: z.name, status: "erstellt", betrag: euro(z.betrag_cent), nr: fin.number });
    } catch (e) {
      await admin.from("fachperson_rechnung").update({ status: "fehler", fehler: String(e).slice(0, 500), aktualisiert_am: new Date().toISOString() }).eq("id", beleg.id);
      erg.push({ name: z.name, status: "fehler", fehler: String(e).slice(0, 200) });
    }
  }
  return json({ ok: true, monat, modus, ergebnis: erg });
});
