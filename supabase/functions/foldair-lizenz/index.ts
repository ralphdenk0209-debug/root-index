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
//  24.11.2026 (Ralph): Der Schlüssel geht zusätzlich einmal per Mail an den Käufer
//  (SMTP wie mail-agent: Secrets MAIL_ADDRESS / MAIL_PASSWORD, smtp.webspace.bz:465).
//  Gesendet wird nur einmal je Bestellung (Spalte mail_gesendet), Fehler in mail_fehler.
// =============================================================================
import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

const esc = (x: unknown) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const ARTEN: Record<string, string> = { persoenlich: "Persönliche Lizenz", familie: "Familienlizenz", firma: "Firmenlizenz" };

async function schluesselMail(an: string, name: string, lizenzart: string, schluessel: string, sessionId: string) {
  const user = Deno.env.get("MAIL_ADDRESS"), pass = Deno.env.get("MAIL_PASSWORD");
  if (!user || !pass) throw new Error("MAIL_ADDRESS/MAIL_PASSWORD fehlen");
  const link = `https://foldair.de/danke.html?session_id=${sessionId}`;
  const art = ARTEN[lizenzart] ?? lizenzart;
  const text =
`Hallo ${name},

danke für deinen Kauf! Hier ist dein Foldair-Lizenzschlüssel (${art}):

${schluessel}

So schaltest du Foldair frei:
1. Foldair öffnen – noch nicht installiert? https://foldair.de/download/Foldair.dmg
2. Oben im Menü Foldair › Lizenz … wählen.
3. Schlüssel einfügen und „Aktivieren“ klicken – fertig, auch ohne Internet.

Bitte heb diese Mail auf. Deinen Schlüssel findest du auch jederzeit hier:
${link}

Fragen? Antworte einfach auf diese Mail.

Ralph Denk · Foldair · foldair.de`;
  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f6f9fd;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16202e">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="font-weight:700;font-size:18px;margin-bottom:14px">Foldair</div>
  <div style="background:#fff;border:1px solid #e3e9f2;border-radius:16px;padding:20px;font-size:15px;line-height:1.55">
    <p style="margin:0 0 12px">Hallo ${esc(name)},</p>
    <p style="margin:0 0 12px">danke für deinen Kauf! Hier ist dein Lizenzschlüssel <span style="color:#5b6778">(${esc(art)})</span>:</p>
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all;background:#f6f9fd;border:1px solid #e3e9f2;border-radius:10px;padding:12px">${esc(schluessel)}</div>
    <p style="margin:16px 0 6px;font-weight:600">So schaltest du Foldair frei</p>
    <ol style="margin:0 0 12px;padding-left:20px">
      <li>Foldair öffnen – noch nicht installiert? <a href="https://foldair.de/download/Foldair.dmg" style="color:#2563eb">Hier herunterladen</a>.</li>
      <li>Oben im Menü <b>Foldair › Lizenz …</b> wählen.</li>
      <li>Schlüssel einfügen und <b>Aktivieren</b> klicken – fertig, auch ohne Internet.</li>
    </ol>
    <p style="margin:0 0 12px">Bitte heb diese Mail auf. Deinen Schlüssel findest du auch jederzeit <a href="${esc(link)}" style="color:#2563eb">auf deiner Danke-Seite</a>.</p>
    <p style="margin:0">Fragen? Antworte einfach auf diese Mail.</p>
  </div>
  <p style="font-size:12px;color:#5b6778;text-align:center;margin-top:14px">Ralph Denk · <a href="https://foldair.de" style="color:#2563eb">foldair.de</a> · <a href="https://foldair.de/impressum.html" style="color:#2563eb">Impressum</a></p>
</div></body></html>`;
  const smtp = new SMTPClient({ connection: { hostname: "smtp.webspace.bz", port: 465, tls: true, auth: { username: user, password: pass } } });
  await smtp.send({ from: `Foldair <${user}>`, to: an, subject: "Dein Foldair-Lizenzschlüssel", content: text, html });
  await smtp.close();
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

  // Schlüssel einmal per Mail schicken: Zeile zuerst für sich beanspruchen, damit
  // zwei gleichzeitige Aufrufe (Neuladen der Danke-Seite) nicht doppelt senden.
  if (email.includes("@")) {
    const { data: frei } = await admin.from("foldair_lizenzen")
      .update({ mail_gesendet: new Date().toISOString(), mail_fehler: null })
      .eq("session_id", id).is("mail_gesendet", null).select("session_id");
    if (frei && frei.length) {
      try {
        await schluesselMail(email, name, lizenzart, schluessel, id);
      } catch (e) {
        await admin.from("foldair_lizenzen").update({ mail_gesendet: null, mail_fehler: String(e).slice(0, 500) }).eq("session_id", id);
      }
    }
  }

  return antwort(200, { name, email, art: lizenzart, schluessel });
});
