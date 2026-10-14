// appstore-sync — 14.10.2026, Ralph: "bau das ins dashboard ein" (App-Store-Rezensionen + Downloads).
// Liest per App Store Connect API: Kundenrezensionen und taegliche Verkaufsberichte (Downloads,
// Updates, Kaeufe je Land) und speichert sie ueber public.cb_appstore_speichern. Schreibt NICHTS zu Apple.
// Secrets (setzt Ralph selbst in Supabase): ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (Inhalt der .p8),
// ASC_VENDOR_NUMBER (App Store Connect -> Zahlungen und Finanzberichte, oben links).
// Aufruf: taeglich per pg_cron (cb_edge_rufen, service_role) oder von einem Admin aus appstore.html.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_ID = "6818112011";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const txt = (s: string) => b64url(new TextEncoder().encode(s));

async function token(keyId: string, issuer: string, p8: string): Promise<string> {
  const pem = p8.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = txt(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const last = txt(JSON.stringify({ iss: issuer, iat: jetzt, exp: jetzt + 1100, aud: "appstoreconnect-v1" }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(kopf + "." + last));
  return kopf + "." + last + "." + b64url(sig);
}

// Produkttyp laut Apple-Verkaufsbericht -> unsere Art.
function art(pti: string): string | null {
  const p = (pti || "").toUpperCase();
  if (p.startsWith("1")) return "download";
  if (p.startsWith("7")) return "update";
  if (p.startsWith("3")) return "erneut";
  if (p.startsWith("IA") || p.startsWith("FI")) return "kauf";
  return p ? "sonstig" : null;
}

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
  const keyId = Deno.env.get("ASC_KEY_ID"), issuer = Deno.env.get("ASC_ISSUER_ID");
  const p8 = Deno.env.get("ASC_PRIVATE_KEY"), vendor = Deno.env.get("ASC_VENDOR_NUMBER");
  const fehlt = [!keyId && "ASC_KEY_ID", !issuer && "ASC_ISSUER_ID", !p8 && "ASC_PRIVATE_KEY", !vendor && "ASC_VENDOR_NUMBER"].filter(Boolean);
  if (fehlt.length) {
    await admin.rpc("cb_appstore_speichern", { p_rez: [], p_tage: [], p_fehler: "Secrets fehlen: " + fehlt.join(", "), p_info: {} });
    return json({ ok: false, fehler: "Secrets fehlen: " + fehlt.join(", ") }, 500);
  }
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* leer */ }
  const tageZurueck = Math.min(Math.max(Number(body.tage ?? 0) || 0, 0), 365) || 10;

  const fehler: string[] = [];
  const rez: Record<string, unknown>[] = [];
  const tage: Record<string, unknown>[] = [];
  let jwt = "";
  try { jwt = await token(keyId!, issuer!, p8!); } catch (e) { fehler.push("Schluessel: " + String((e as Error)?.message ?? e)); }

  if (jwt) {
    // 1) Rezensionen (neueste zuerst, mit Antwort)
    try {
      let next: string | null = `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/customerReviews?sort=-createdDate&limit=200&include=response`;
      for (let seite = 0; next && seite < 10; seite++) {
        const r: Response = await fetch(next, { headers: { Authorization: "Bearer " + jwt } });
        const j = await r.json();
        if (!r.ok) { fehler.push("Rezensionen " + r.status + ": " + (j?.errors?.[0]?.detail ?? "")); break; }
        const antworten = new Map<string, string>();
        for (const inc of j.included ?? []) if (inc.type === "customerReviewResponses") antworten.set(inc.id, inc.attributes?.responseBody ?? null);
        for (const d of j.data ?? []) {
          const a = d.attributes ?? {};
          const rid = d.relationships?.response?.data?.id;
          rez.push({ id: d.id, sterne: a.rating, titel: a.title, text: a.body, autor: a.reviewerNickname, land: a.territory, erstellt: a.createdDate, antwort: rid ? antworten.get(rid) ?? null : null });
        }
        next = j.links?.next ?? null;
      }
    } catch (e) { fehler.push("Rezensionen: " + String((e as Error)?.message ?? e)); }

    // 2) Taegliche Verkaufsberichte (gestern und tageZurueck Tage davor). 404 = an dem Tag nichts.
    for (let i = 1; i <= tageZurueck; i++) {
      const tag = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const q = new URLSearchParams({ "filter[frequency]": "DAILY", "filter[reportType]": "SALES", "filter[reportSubType]": "SUMMARY", "filter[vendorNumber]": vendor!, "filter[reportDate]": tag });
      try {
        const r = await fetch("https://api.appstoreconnect.apple.com/v1/salesReports?" + q, { headers: { Authorization: "Bearer " + jwt, Accept: "application/a-gzip" } });
        if (r.status === 404) { tage.push({ datum: tag, land: "", art: "download", einheiten: 0, erloes: 0 }); continue; }
        if (!r.ok) { const t = await r.text(); fehler.push("Bericht " + tag + " " + r.status + ": " + t.slice(0, 160)); if (r.status === 401 || r.status === 403) break; continue; }
        const roh = await new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).text();
        const zeilen = roh.split("\n").filter((z) => z.trim());
        const kopf = (zeilen.shift() ?? "").split("\t");
        const s = (n: string) => kopf.indexOf(n);
        const iTyp = s("Product Type Identifier"), iUnits = s("Units"), iLand = s("Country Code"), iProc = s("Developer Proceeds");
        let gefunden = false;
        for (const z of zeilen) {
          const f = z.split("\t");
          // Das Konto hat nur Root Index – alle Zeilen gehoeren dazu (App, Abo, Updates).
          const a = art(f[iTyp]); if (!a) continue;
          const units = Number(f[iUnits]) || 0;
          tage.push({ datum: tag, land: f[iLand] ?? "", art: a, einheiten: units, erloes: (Number(f[iProc]) || 0) * units });
          gefunden = true;
        }
        if (!gefunden) tage.push({ datum: tag, land: "", art: "download", einheiten: 0, erloes: 0 });
      } catch (e) { fehler.push("Bericht " + tag + ": " + String((e as Error)?.message ?? e)); }
    }
  }

  const f = fehler.length ? fehler.join(" | ").slice(0, 1500) : null;
  const { data, error } = await admin.rpc("cb_appstore_speichern", { p_rez: rez, p_tage: tage, p_fehler: f, p_info: { rezensionen: rez.length, tageszeilen: tage.length, tage: tageZurueck } });
  if (error) return json({ ok: false, fehler: error.message }, 500);
  return json({ ok: !f, fehler: f, rezensionen: rez.length, tageszeilen: tage.length, speicher: data });
});
