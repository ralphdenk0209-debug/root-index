// apple-kauf — Premium-Abo ueber Apple (StoreKit 2), Weg A (Ralph 01.10.2026)
//
// Zwei Eingaenge, eine Pruefung:
//  1) POST {jws}            von der App nach dem Kauf / "Kaeufe wiederherstellen" (mit Nutzer-JWT)
//  2) POST {signedPayload}  App Store Server Notifications V2 (Verlaengerung, Kuendigung, Erstattung)
// Jede Apple-Signatur wird mit Apples Root-Zertifikat geprueft (SignedDataVerifier). Erst dann bucht
// cb_apple_abo_setzen (nur service_role). Die App entscheidet nichts.
//
// Umgebung: TestFlight-Kaeufe laufen in "Sandbox", Store-Kaeufe in "Production" - beide werden geprueft.
// Geheimnisse/Einstellungen: APPLE_BUNDLE_ID (Standard de.root-index.RootIndex), APPLE_APP_ID (Zahl aus
// App Store Connect, nur fuer Production noetig).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignedDataVerifier, Environment } from "npm:@apple/app-store-server-library@1";
import { Buffer } from "node:buffer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const BUNDLE = Deno.env.get("APPLE_BUNDLE_ID") || "de.root-index.RootIndex";
const APP_ID = Number(Deno.env.get("APPLE_APP_ID") || "0") || undefined;

let wurzeln: Buffer[] | null = null;
async function apfelWurzeln(): Promise<Buffer[]> {
  if (wurzeln) return wurzeln;
  const urls = ["https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
                "https://www.apple.com/appleca/AppleIncRootCertificate.cer"];
  const liste: Buffer[] = [];
  for (const u of urls) {
    const r = await fetch(u);
    if (r.ok) liste.push(Buffer.from(new Uint8Array(await r.arrayBuffer())));
  }
  if (!liste.length) throw new Error("Apple-Root-Zertifikat nicht ladbar");
  wurzeln = liste;
  return liste;
}

async function pruefer(): Promise<SignedDataVerifier[]> {
  const w = await apfelWurzeln();
  const v: SignedDataVerifier[] = [new SignedDataVerifier(w, true, Environment.SANDBOX, BUNDLE)];
  if (APP_ID) v.unshift(new SignedDataVerifier(w, true, Environment.PRODUCTION, BUNDLE, APP_ID));
  return v;
}

async function transaktionPruefen(jws: string) {
  let letzter: unknown = null;
  for (const v of await pruefer()) {
    try { return await v.verifyAndDecodeTransaction(jws); } catch (e) { letzter = e; }
  }
  throw letzter ?? new Error("Signatur ungueltig");
}

async function meldungPruefen(payload: string) {
  let letzter: unknown = null;
  for (const v of await pruefer()) {
    try { return await v.verifyAndDecodeNotification(payload); } catch (e) { letzter = e; }
  }
  throw letzter ?? new Error("Signatur ungueltig");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch (_e) { /* leer */ }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // 2) Server-Meldung von Apple
    if (body.signedPayload) {
      const m: any = await meldungPruefen(String(body.signedPayload));
      const art = String(m.notificationType || "") + (m.subtype ? ":" + m.subtype : "");
      const tx: any = m.data?.signedTransactionInfo ? await transaktionPruefen(m.data.signedTransactionInfo) : null;
      if (!tx) return json({ ok: true, ignoriert: art });
      const istEnde = ["EXPIRED", "REVOKE", "REFUND", "GRACE_PERIOD_EXPIRED"].includes(String(m.notificationType));
      const { data, error } = await admin.rpc("cb_apple_abo_setzen", {
        p_auth: tx.appAccountToken ?? null,
        p_original_tx: String(tx.originalTransactionId ?? ""),
        p_produkt: tx.productId ?? null,
        p_bis: istEnde ? new Date().toISOString() : (tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null),
        p_art: istEnde ? String(m.notificationType) : art,
        p_umgebung: String(tx.environment ?? ""),
        p_roh: { art, produkt: tx.productId, ablauf: tx.expiresDate },
      });
      if (error) throw error;
      return json({ ok: true, ergebnis: data });
    }

    // 1) Kauf/Wiederherstellen aus der App - nur angemeldet
    const auth = req.headers.get("Authorization") ?? "";
    const nutzer = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await nutzer.auth.getUser();
    if (!u?.user) return json({ error: "Nicht angemeldet." }, 401);
    if (!body.jws) return json({ error: "Kein Kaufnachweis." }, 400);

    const tx: any = await transaktionPruefen(String(body.jws));
    // Der Kauf gehoert dem Konto, das ihn ausgeloest hat (appAccountToken = auth-ID).
    if (tx.appAccountToken && String(tx.appAccountToken).toLowerCase() !== u.user.id.toLowerCase()) {
      return json({ error: "Dieser Kauf gehoert zu einem anderen Konto." }, 409);
    }
    const { data, error } = await admin.rpc("cb_apple_abo_setzen", {
      p_auth: u.user.id,
      p_original_tx: String(tx.originalTransactionId ?? ""),
      p_produkt: tx.productId ?? null,
      p_bis: tx.revocationDate ? new Date().toISOString() : (tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null),
      p_art: tx.revocationDate ? "REVOKE" : "KAUF",
      p_umgebung: String(tx.environment ?? ""),
      p_roh: { produkt: tx.productId, ablauf: tx.expiresDate, typ: tx.type },
    });
    if (error) throw error;
    return json({ ok: true, ergebnis: data });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 400);
  }
});
