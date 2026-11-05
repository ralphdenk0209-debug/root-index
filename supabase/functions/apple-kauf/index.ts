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
// 05.11.2026 (#898): eigene Pruefung statt @apple/app-store-server-library - die scheitert in
// der Edge-Laufzeit an node:crypto (siehe pruefung.ts). Seit dem Start wurde so kein Kauf gebucht.
import { appleJwsPruefen } from "./pruefung.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const BUNDLE = Deno.env.get("APPLE_BUNDLE_ID") || "de.root-index.RootIndex";
const APP_ID = Number(Deno.env.get("APPLE_APP_ID") || "0") || undefined;

let wurzeln: Uint8Array[] | null = null;
async function apfelWurzeln(): Promise<Uint8Array[]> {
  if (wurzeln) return wurzeln;
  const urls = ["https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
                "https://www.apple.com/appleca/AppleIncRootCertificate.cer"];
  const liste: Uint8Array[] = [];
  for (const u of urls) {
    const r = await fetch(u);
    if (r.ok) liste.push(new Uint8Array(await r.arrayBuffer()));
  }
  if (!liste.length) throw new Error("Apple-Root-Zertifikat nicht ladbar");
  wurzeln = liste;
  return liste;
}

// Wie bei Apples Bibliothek: richtige App, Umgebung Store oder TestFlight (Sandbox).
// 11.10.2026: keine Online-Pruefung (OCSP) - die Kette bis zum Apple-Root wird voll geprueft.
function inhaltPruefen(x: any) {
  if (String(x?.bundleId ?? "") !== BUNDLE) throw new Error("Falsche App: " + String(x?.bundleId ?? "-"));
  const umgebung = String(x?.environment ?? "");
  if (umgebung !== "Production" && umgebung !== "Sandbox") throw new Error("Falsche Umgebung: " + umgebung);
  if (umgebung === "Production" && APP_ID && x?.appAppleId !== undefined && Number(x.appAppleId) !== APP_ID) {
    throw new Error("Falsche App-ID: " + String(x.appAppleId));
  }
}

async function transaktionPruefen(jws: string) {
  const tx = await appleJwsPruefen(jws, await apfelWurzeln());
  inhaltPruefen(tx);
  return tx;
}

async function meldungPruefen(payload: string) {
  const m = await appleJwsPruefen(payload, await apfelWurzeln());
  inhaltPruefen(m?.data ?? {});
  return m;
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
    const s: any = e;
    console.error("apple-kauf Fehler", s?.constructor?.name, s?.status ?? "", String(s?.message || s));
    return json({ error: "Freischaltung fehlgeschlagen: " + String(s?.message || s?.status || s) }, 400);
  }
});
