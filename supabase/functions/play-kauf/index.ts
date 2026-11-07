// play-kauf — Premium-Abo über Google Play (Android), Gegenstück zu apple-kauf.
// 07.11.2026 (#858), bereitgestellt mit Ralphs OK ("Ja, einspielen").
//
// Zwei Eingänge, eine Prüfung:
//  1) POST {purchaseToken, produkt}  von der App nach dem Kauf / "Käufe wiederherstellen" (mit Nutzer-JWT)
//  2) POST Pub/Sub-Push               Google Play Echtzeit-Meldungen (Verlängerung, Kündigung, Erstattung)
//     URL: …/functions/v1/play-kauf?schluessel=<PLAY_RTDN_SCHLUESSEL>
// Jeder Kauf wird bei Google nachgefragt (purchases.subscriptionsv2.get). Erst dann bestätigt der
// Server den Kauf bei Google (acknowledge) und bucht (cb_google_abo_setzen). Die App entscheidet nichts.
//
// Geheimnisse (setzt Ralph im Supabase-Dashboard, nie im Chat):
//   GOOGLE_PLAY_SA        – JSON-Schlüssel des Dienstkontos mit Play-Console-Recht „Bestellungen und Abos verwalten“
//   PLAY_RTDN_SCHLUESSEL  – beliebiges langes Zufallswort, steht auch in der Pub/Sub-Push-URL
//   PLAY_PAKET            – optional, Standard de.rootindex.app

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const PAKET = Deno.env.get("PLAY_PAKET") || "de.rootindex.app";
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PAKET}/purchases`;

// --- Zugang zur Play Developer API (OAuth mit Dienstkonto, 1 h gültig) ---
let zugang: { token: string; bis: number } | null = null;
async function googleZugang(): Promise<string> {
  if (zugang && zugang.bis > Date.now() + 60_000) return zugang.token;
  const sa = JSON.parse(Deno.env.get("GOOGLE_PLAY_SA") || "{}");
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_PLAY_SA fehlt");
  const jetzt = Math.floor(Date.now() / 1000);
  const behauptung = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(jetzt).setExpirationTime(jetzt + 3600)
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: behauptung }),
  });
  const a = await r.json();
  if (!r.ok || !a.access_token) throw new Error("Google-Anmeldung fehlgeschlagen: " + (a.error_description || a.error || r.status));
  zugang = { token: a.access_token, bis: Date.now() + (Number(a.expires_in) || 3600) * 1000 };
  return zugang.token;
}

// --- Kauf bei Google nachfragen ---
async function aboHolen(token: string) {
  const r = await fetch(`${API}/subscriptionsv2/tokens/${encodeURIComponent(token)}`,
    { headers: { Authorization: `Bearer ${await googleZugang()}` } });
  const a = await r.json();
  if (!r.ok) throw new Error("Google kennt diesen Kauf nicht (" + (a?.error?.message || r.status) + ")");
  return a;
}

async function bestaetigen(produkt: string, token: string) {
  const r = await fetch(`${API}/subscriptions/${encodeURIComponent(produkt)}/tokens/${encodeURIComponent(token)}:acknowledge`,
    { method: "POST", headers: { Authorization: `Bearer ${await googleZugang()}`, "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) throw new Error("Bestätigung bei Google fehlgeschlagen (" + r.status + ")");
}

// Google-Zustand -> Buchung. Aktiv sind ACTIVE und IN_GRACE_PERIOD (Zahlung hakt, Zugang bleibt).
// CANCELED heißt nur „verlängert sich nicht“ – Zugang bis zum Ablauf bleibt.
function buchung(abo: any) {
  const posten = (abo.lineItems ?? [])[0] ?? {};
  const zustand = String(abo.subscriptionState || "");
  const ende = ["SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED"].includes(zustand);
  const zurueck = !!abo.canceledStateContext?.systemInitiatedCancellation && zustand === "SUBSCRIPTION_STATE_EXPIRED";
  return {
    produkt: String(posten.productId ?? ""),
    bis: ende ? new Date().toISOString() : (posten.expiryTime ? new Date(posten.expiryTime).toISOString() : null),
    art: zurueck ? "REVOKED" : (ende ? "EXPIRED" : zustand.replace("SUBSCRIPTION_STATE_", "")),
    nutzer: abo.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    offen: abo.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    test: !!abo.testPurchase,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch (_e) { /* leer */ }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 2) Echtzeit-Meldung von Google Play (Pub/Sub-Push)
    if (body.message?.data) {
      const url = new URL(req.url);
      if (url.searchParams.get("schluessel") !== Deno.env.get("PLAY_RTDN_SCHLUESSEL")) return json({ error: "nein" }, 403);
      const m = JSON.parse(atob(String(body.message.data)));
      const s = m.subscriptionNotification;
      if (!s?.purchaseToken || m.packageName !== PAKET) return json({ ok: true, ignoriert: true });
      const b = buchung(await aboHolen(String(s.purchaseToken)));
      const art = (m.voidedPurchaseNotification ? "REFUND" : b.art) + ":" + String(s.notificationType ?? "");
      const { data, error } = await admin.rpc("cb_google_abo_setzen", {
        p_auth: b.nutzer, p_token: String(s.purchaseToken), p_produkt: b.produkt, p_bis: b.bis, p_art: art,
        p_roh: { meldung: s.notificationType, test: b.test },
      });
      if (error) throw error;
      return json({ ok: true, ergebnis: data });
    }

    // 1) Kauf/Wiederherstellen aus der App - nur angemeldet
    const auth = req.headers.get("Authorization") ?? "";
    const nutzer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await nutzer.auth.getUser();
    if (!u?.user) return json({ error: "Nicht angemeldet." }, 401);
    if (!body.purchaseToken) return json({ error: "Kein Kaufnachweis." }, 400);

    const token = String(body.purchaseToken);
    const b = buchung(await aboHolen(token));
    // Der Kauf gehört dem Konto, das ihn ausgelöst hat (obfuscatedAccountId = auth-ID).
    if (b.nutzer && String(b.nutzer).toLowerCase() !== u.user.id.toLowerCase()) {
      return json({ error: "Dieser Kauf gehört zu einem anderen Konto." }, 409);
    }
    if (b.offen) await bestaetigen(b.produkt || String(body.produkt || "premium"), token);
    const { data, error } = await admin.rpc("cb_google_abo_setzen", {
      p_auth: u.user.id, p_token: token, p_produkt: b.produkt, p_bis: b.bis, p_art: b.offen ? "KAUF" : b.art,
      p_roh: { test: b.test },
    });
    if (error) throw error;
    return json({ ok: true, ergebnis: data });
  } catch (e) {
    const s: any = e;
    console.error("play-kauf Fehler", String(s?.message || s));
    return json({ error: "Freischaltung fehlgeschlagen: " + String(s?.message || s) }, 400);
  }
});
