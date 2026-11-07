// PUSH-VERSAND v11 (07.11.2026, #858 Android)
//
// v10 (13.09.2026, Work #680) hatte zwei Zusteller: Web Push (Browser) und APNs (iPhone).
// v11 bringt den dritten: Firebase Cloud Messaging (FCM) fuer die Android-App.
// Weiterhin EINE Warteschlange (Push_Ausgang), EIN Text - was verschickt wird, entscheidet
// die Datenbank.
//
// Android-Geraete stehen in derselben Tabelle Push_Geraet wie iPhones, erkennbar an
// bundle_id = 'de.rootindex.app' (gesetzt von cb_push_geraet_speichern aus der App).
// WICHTIG: Diese Geraete gehen NIE an Apple - Apple wuerde sie als BadDeviceToken
// melden, und v10 haette sie dann geloescht.
//
// Eine Nachricht gilt erst dann als gesendet, wenn mindestens ein Zusteller sie angenommen
// hat oder es zu diesem Empfaenger nirgends ein Geraet gibt.
//
// Secrets:
//   APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID / APNS_BUNDLE_ID  - iPhone (wie v10)
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT       - Browser (wie v10)
//   FCM_SA          - JSON-Schluessel eines Firebase-Dienstkontos (Projekt root-index),
//                     Firebase-Konsole -> Projekteinstellungen -> Dienstkonten
//   FCM_PROJEKT     - optional, Standard root-index
// Fehlt ein Zusteller-Secret, laufen die anderen weiter und die Antwort sagt, was fehlt.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function antwort(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function keyInfo(s: string) {
  return { laenge: s.length, nur_base64url: /^[A-Za-z0-9_-]*$/.test(s), hat_leerzeichen: /\s/.test(s) };
}

const ANDROID_PAKET = "de.rootindex.app";

// ---------------------------------------------------------------- APNs

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Der .p8-Inhalt ist ein PKCS#8-Schluessel in Base64 zwischen zwei Zeilen. */
async function p8Laden(p8: string): Promise<CryptoKey> {
  const roh = p8.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(roh);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return await crypto.subtle.importKey(
    "pkcs8", bytes.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"],
  );
}

/** Apple erlaubt ein Ticket hoechstens eine Stunde; wir erneuern nach 45 Minuten. */
let ticket: { wert: string; bis: number } | null = null;
async function apnsTicket(keyId: string, teamId: string, p8: string): Promise<string> {
  const jetzt = Math.floor(Date.now() / 1000);
  if (ticket && ticket.bis > jetzt) return ticket.wert;
  const kopf = b64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const rumpf = b64url(new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: jetzt })));
  const schluessel = await p8Laden(p8);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, schluessel, new TextEncoder().encode(kopf + "." + rumpf),
  ));
  const wert = kopf + "." + rumpf + "." + b64url(sig);
  ticket = { wert, bis: jetzt + 45 * 60 };
  return wert;
}

type ApnsErgebnis = { ok: boolean; status: number; grund?: string };

async function apnsSenden(
  token: string, umgebung: string, ticketWert: string, bundleId: string,
  titel: string, text: string, url: string,
): Promise<ApnsErgebnis> {
  const host = umgebung === "test" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const r = await fetch("https://" + host + "/3/device/" + token, {
    method: "POST",
    headers: {
      "authorization": "bearer " + ticketWert,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: { alert: { title: titel, body: text }, sound: "default", "thread-id": "rootindex" },
      url,
    }),
  });
  if (r.status === 200) return { ok: true, status: 200 };
  let grund = "";
  try { grund = ((await r.json()) as { reason?: string }).reason ?? ""; } catch { /* Apple schweigt manchmal */ }
  return { ok: false, status: r.status, grund };
}

// ---------------------------------------------------------------- FCM (Android)

/** OAuth-Zugang mit dem Firebase-Dienstkonto (1 h gueltig, nach 50 min erneuert). */
let fcmZugang: { wert: string; bis: number } | null = null;
async function fcmToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const jetzt = Math.floor(Date.now() / 1000);
  if (fcmZugang && fcmZugang.bis > jetzt) return fcmZugang.wert;
  const behauptung = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(jetzt).setExpirationTime(jetzt + 3600)
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: behauptung }),
  });
  const a = await r.json();
  if (!r.ok || !a.access_token) throw new Error("FCM-Anmeldung: " + (a.error_description || a.error || r.status));
  fcmZugang = { wert: a.access_token, bis: jetzt + 50 * 60 };
  return fcmZugang.wert;
}

type FcmErgebnis = { ok: boolean; status: number; grund?: string };

async function fcmSenden(
  projekt: string, zugang: string, token: string, titel: string, text: string, url: string,
): Promise<FcmErgebnis> {
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projekt}/messages:send`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + zugang, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: titel, body: text },
        data: { url },
        android: { priority: "high", notification: { channel_id: "rootindex", tag: "rootindex" } },
      },
    }),
  });
  if (r.ok) return { ok: true, status: r.status };
  let grund = "";
  try {
    const j = await r.json();
    grund = (j?.error?.details ?? []).map((d: any) => d.errorCode).filter(Boolean).join(",") || j?.error?.status || "";
  } catch { /* leer */ }
  return { ok: false, status: r.status, grund };
}

// ---------------------------------------------------------------- Lauf

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const t0 = Date.now();
  try {
    const pub = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
    const priv = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
    const subj = (Deno.env.get("VAPID_SUBJECT") ?? "mailto:kontakt@root-index.de").trim();

    let webBereit = false;
    if (pub && priv) {
      try { webpush.setVapidDetails(subj, pub, priv); webBereit = true; }
      catch (e) {
        return antwort({
          ok: false, schritt: "setVapidDetails", fehler: String(e),
          pub_check: keyInfo(pub), priv_check: keyInfo(priv), subject: subj,
        });
      }
    }

    const p8 = (Deno.env.get("APNS_KEY_P8") ?? "").trim();
    const keyId = (Deno.env.get("APNS_KEY_ID") ?? "").trim();
    const teamId = (Deno.env.get("APNS_TEAM_ID") ?? "").trim();
    const bundleId = (Deno.env.get("APNS_BUNDLE_ID") ?? "de.root-index.RootIndex").trim();
    const apnsBereit = !!(p8 && keyId && teamId);

    let fcmSa: { client_email: string; private_key: string } | null = null;
    try {
      const roh = (Deno.env.get("FCM_SA") ?? "").trim();
      if (roh) { const j = JSON.parse(roh); if (j.client_email && j.private_key) fcmSa = j; }
    } catch { /* falsches Format -> wie fehlend */ }
    const fcmProjekt = (Deno.env.get("FCM_PROJEKT") ?? "root-index").trim();
    const fcmBereit = !!fcmSa;

    if (!webBereit && !apnsBereit && !fcmBereit) {
      return antwort({ ok: false, uebersprungen: "Weder VAPID- noch APNS- noch FCM-Secrets gesetzt." });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: offen, error } = await sb.from("Push_Ausgang")
      .select("id,Empfaenger_ID,titel,text,url,quelle").eq("gesendet", false)
      .order("erstellt", { ascending: true }).limit(100);
    if (error) return antwort({ ok: false, schritt: "Push_Ausgang lesen", fehler: error.message });
    if (!offen || !offen.length) {
      return antwort({ ok: true, ergebnis: "nichts zu senden",
        apns: apnsBereit ? "bereit" : "kein Schluessel", fcm: fcmBereit ? "bereit" : "kein Schluessel" });
    }

    const proEmp = new Map<string, any[]>();
    for (const n of offen) {
      if (!proEmp.has(n.Empfaenger_ID)) proEmp.set(n.Empfaenger_ID, []);
      proEmp.get(n.Empfaenger_ID)!.push(n);
    }

    let ticketWert = "";
    if (apnsBereit) {
      try { ticketWert = await apnsTicket(keyId, teamId, p8); }
      catch (e) {
        return antwort({ ok: false, schritt: "APNS-Ticket", fehler: String(e).slice(0, 300),
                         hinweis: "APNS_KEY_P8 muss der vollstaendige Inhalt der .p8-Datei sein." });
      }
    }
    let fcmWert = "";
    if (fcmBereit) {
      try { fcmWert = await fcmToken(fcmSa!); }
      catch (e) {
        return antwort({ ok: false, schritt: "FCM-Zugang", fehler: String(e).slice(0, 300),
                         hinweis: "FCM_SA muss der vollstaendige JSON-Schluessel des Firebase-Dienstkontos sein." });
      }
    }

    let web = 0, apple = 0, android = 0, tot = 0, toteGeraete = 0, ohneGeraet = 0;
    const sendeFehler: string[] = [];

    for (const [emp, nachrichten] of proEmp) {
      const ids = nachrichten.map((n: any) => n.id);
      const erste = nachrichten[0];
      const titel = erste.titel ?? "Root Index";
      const text = nachrichten.length > 1
        ? (erste.text ?? "") + " (+" + (nachrichten.length - 1) + " weitere)"
        : (erste.text ?? "");
      const url = erste.url ?? "/";

      const { data: abos } = webBereit
        ? await sb.from("Push_Abo").select("id,endpoint,p256dh,auth").eq("Benutzer_ID", emp)
        : { data: [] as any[] };
      const { data: alleGeraete } = (apnsBereit || fcmBereit)
        ? await sb.from("Push_Geraet").select("id,token,umgebung,bundle_id").eq("Benutzer_ID", emp)
        : { data: [] as any[] };
      const istAndroid = (g: any) => g.bundle_id === ANDROID_PAKET;
      const geraete = (alleGeraete ?? []).filter((g: any) => istAndroid(g) ? fcmBereit : apnsBereit);

      if ((!abos || !abos.length) && !geraete.length) {
        // Niemand da, der es empfangen koennte. Die Nachricht auf gesendet zu
        // setzen ist richtig: sonst laege sie fuer immer in der Schlange.
        ohneGeraet++;
        await sb.from("Push_Ausgang").update({ gesendet: true }).in("id", ids);
        continue;
      }

      let zugestellt = false;

      const nutzlast = JSON.stringify({ title: titel, body: text, url });
      for (const a of (abos ?? [])) {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, nutzlast, { TTL: 3600 });
          web++; zugestellt = true;
        } catch (e: any) {
          const sc = e && (e.statusCode ?? e.status);
          if (sc === 404 || sc === 410) { await sb.from("Push_Abo").delete().eq("id", a.id); tot++; }
          else if (sendeFehler.length < 5) sendeFehler.push("web " + sc + ": " + String(e?.body ?? e).slice(0, 160));
        }
      }

      for (const g of geraete) {
        try {
          if (istAndroid(g)) {
            const r = await fcmSenden(fcmProjekt, fcmWert, g.token, titel, text, url);
            if (r.ok) { android++; zugestellt = true; }
            else if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(r.grund ?? "")) {
              // Google sagt: diese App-Installation gibt es nicht mehr.
              await sb.from("Push_Geraet").delete().eq("id", g.id);
              toteGeraete++;
            } else if (sendeFehler.length < 5) {
              sendeFehler.push("fcm " + r.status + ": " + (r.grund || "?"));
            }
          } else {
            const r = await apnsSenden(g.token, g.umgebung, ticketWert, bundleId, titel, text, url);
            if (r.ok) { apple++; zugestellt = true; }
            else if (r.status === 410 || r.grund === "BadDeviceToken" || r.grund === "Unregistered") {
              // Apple sagt: dieses Geraet gibt es nicht mehr. Weiter zu senden
              // waere Unfug, also raus damit.
              await sb.from("Push_Geraet").delete().eq("id", g.id);
              toteGeraete++;
            } else if (sendeFehler.length < 5) {
              sendeFehler.push("apns " + r.status + ": " + (r.grund || "?"));
            }
          }
        } catch (e) {
          if (sendeFehler.length < 5) sendeFehler.push((istAndroid(g) ? "fcm" : "apns") + " Ausnahme: " + String(e).slice(0, 160));
        }
      }

      // Nur abhaken, was auch wirklich weg ist. Bleibt es liegen, versucht es
      // der Takt in einer Minute erneut.
      if (zugestellt) await sb.from("Push_Ausgang").update({ gesendet: true }).in("id", ids);
    }

    return antwort({
      ok: true, web_gesendet: web, apple_gesendet: apple, android_gesendet: android,
      tote_abos_entfernt: tot, tote_geraete_entfernt: toteGeraete,
      empfaenger_ohne_geraet: ohneGeraet,
      apns: apnsBereit ? "bereit" : "kein Schluessel", fcm: fcmBereit ? "bereit" : "kein Schluessel",
      sende_fehler: sendeFehler, dauer_ms: Date.now() - t0,
    });
  } catch (e) {
    return antwort({ ok: false, schritt: "unerwartet", fehler: String((e as Error)?.stack ?? e).slice(0, 500) });
  }
});
