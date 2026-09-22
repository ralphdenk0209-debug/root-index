// SEO-SEARCH-CONSOLE-SYNC  (16.09.2026, Ralph)
//
// Holt zwei echte Zahlenreihen aus der Google Search Console API und schreibt
// sie in genau zwei Tabellen (A4.2, eine Quelle je Frage):
//   1) searchanalytics.query  -> seo_suchdaten_taeglich (Klicks/Impressionen je Tag)
//   2) urlInspection.index.inspect -> seo_index_stichprobe (Stichprobe: ist die
//      URL laut Google indexiert?)
//
// WICHTIG, A2 nichts erfinden: Google liefert "Anzahl indexierter Seiten"
// NIRGENDS als API-Summe (nur in der Search-Console-Oberflaeche, "Seiten"-
// Bericht). urlInspection prueft nur EINE URL je Aufruf, mit Tageslimit. Diese
// Funktion prueft deshalb je Lauf eine kleine Stichprobe (ungepruefte/aelteste
// zuerst) statt alles auf einmal - das Dashboard nennt es "Stichprobe", nie
// "alle Seiten".
//
// Aufruf: nur mit Authorization: Bearer <SERVICE_ROLE_KEY> - wie
// riki-scan-worker/riki-zutat-bewerten. Der taegliche Anstoss kommt per
// GitHub-Actions-Cron (.github/workflows/seo-search-console.yml), nicht von
// aussen erreichbar.

import { createClient } from "jsr:@supabase/supabase-js@2";

const STICHPROBE_LIMIT = 40; // je Lauf, Google erlaubt weit mehr - bewusst klein und hoeflich
const SUCH_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemZuArrayBuffer(pem: string): ArrayBuffer {
  const roh = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(roh);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function googleZugriffstoken(schluessel: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const jetzt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: schluessel.client_email,
    scope: SUCH_SCOPE,
    aud: schluessel.token_uri || "https://oauth2.googleapis.com/token",
    iat: jetzt,
    exp: jetzt + 3600,
  };
  const enc = new TextEncoder();
  const teil1 = b64url(enc.encode(JSON.stringify(header)));
  const teil2 = b64url(enc.encode(JSON.stringify(claims)));
  const basis = `${teil1}.${teil2}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemZuArrayBuffer(schluessel.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatur = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(basis),
  );
  const jwt = `${basis}.${b64url(new Uint8Array(signatur))}`;

  const antwort = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!antwort.ok) {
    throw new Error(`Google-Token fehlgeschlagen: ${antwort.status} ${await antwort.text()}`);
  }
  const daten = await antwort.json();
  return daten.access_token as string;
}

async function siteUrlFinden(token: string): Promise<string> {
  const r = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`sites.list fehlgeschlagen: ${r.status} ${await r.text()}`);
  const daten = await r.json();
  const eintraege: Array<{ siteUrl: string; permissionLevel: string }> = daten.siteEntry || [];
  const treffer = eintraege.find((e) =>
    e.siteUrl.includes("root-index.de") && e.permissionLevel !== "siteUnverifiedUser"
  );
  if (!treffer) throw new Error("Keine verifizierte root-index.de-Property in Search Console gefunden.");
  return treffer.siteUrl;
}

function datumIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function suchdatenHolen(token: string, siteUrl: string) {
  const ende = new Date();
  ende.setUTCDate(ende.getUTCDate() - 3); // GSC-Daten sind ~2-3 Tage verzoegert
  const start = new Date(ende);
  start.setUTCDate(start.getUTCDate() - 27); // 28-Tage-Fenster

  const r = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: datumIso(start),
        endDate: datumIso(ende),
        dimensions: ["date"],
        rowLimit: 1000,
      }),
    },
  );
  if (!r.ok) throw new Error(`searchAnalytics.query fehlgeschlagen: ${r.status} ${await r.text()}`);
  const daten = await r.json();
  const zeilen: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> =
    daten.rows || [];
  return zeilen.map((z) => ({
    tag: z.keys[0],
    klicks: Math.round(z.clicks || 0),
    impressionen: Math.round(z.impressions || 0),
    ctr: z.ctr ?? null,
    position: z.position ?? null,
  }));
}

async function sitemapProduktUrls(): Promise<string[]> {
  const r = await fetch("https://root-index.de/sitemap.xml");
  if (!r.ok) throw new Error(`sitemap.xml nicht lesbar: ${r.status}`);
  const xml = await r.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // nur echte Produktseiten, keine Verzeichnis-/Kategorieseiten (A2: keine
  // Stichprobe auf Seiten ziehen, die kein Produkt sind).
  return locs.filter((u) =>
    u.includes("/produkt/") &&
    !u.endsWith("/produkt/") &&
    !u.includes("/produkt/index.html") &&
    !u.includes("/produkt/kategorie-")
  );
}

async function urlPruefen(token: string, siteUrl: string, inspectionUrl: string) {
  const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  if (!r.ok) throw new Error(`urlInspection fehlgeschlagen (${inspectionUrl}): ${r.status} ${await r.text()}`);
  const daten = await r.json();
  const stand = daten?.inspectionResult?.indexStatusResult || {};
  const coverageState = String(stand.coverageState || "");
  return {
    verdict: String(stand.verdict || ""),
    coverageState,
    indexiert: /ndexed/i.test(coverageState),
  };
}

Deno.serve(async (req: Request) => {
  // 22.09.2026 (Cockpit/#787): alle 7 Laeufe seit 16.09. scheiterten mit "Nicht
  // autorisiert" - der Schluessel in GitHub ist nicht zeichengleich mit der
  // Funktionsumgebung. Deshalb keine Zeichenpruefung mehr, sondern Supabase selbst
  // fragen: nur ein Service-Schluessel darf die Auth-Admin-Liste lesen.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const mitgeschickt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const pruefung = mitgeschickt ? await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: mitgeschickt, Authorization: `Bearer ${mitgeschickt}` },
  }) : null;
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "") || mitgeschickt;
  if (!pruefung || !pruefung.ok) {
    return new Response(JSON.stringify({ ok: false, fehler: "Nicht autorisiert." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const schluesselRoh = Deno.env.get("GOOGLE_SC_KEY");
  if (!schluesselRoh) {
    return new Response(JSON.stringify({ ok: false, fehler: "Secret GOOGLE_SC_KEY fehlt." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const ergebnis: Record<string, unknown> = { ok: true };

  try {
    const schluessel = JSON.parse(schluesselRoh);
    const token = await googleZugriffstoken(schluessel);
    const siteUrl = await siteUrlFinden(token);
    ergebnis.site = siteUrl;

    // 1) Klicks/Impressionen je Tag
    const zeilen = await suchdatenHolen(token, siteUrl);
    for (const z of zeilen) {
      const { error } = await sb.from("seo_suchdaten_taeglich").upsert({
        tag: z.tag,
        klicks: z.klicks,
        impressionen: z.impressionen,
        ctr: z.ctr,
        position: z.position,
        aktualisiert_am: new Date().toISOString(),
      });
      if (error) throw new Error(`Upsert seo_suchdaten_taeglich (${z.tag}): ${error.message}`);
    }
    ergebnis.tage_aktualisiert = zeilen.length;

    // 2) Stichprobe: welche Produktseiten kennt Google?
    const alleUrls = await sitemapProduktUrls();
    const { data: bekannt } = await sb
      .from("seo_index_stichprobe")
      .select("url,letzter_check_am")
      .in("url", alleUrls.slice(0, 5000)); // Sicherheitsdeckel, Sitemap ist gross
    const bekannteMap = new Map((bekannt || []).map((r) => [r.url, r.letzter_check_am as string]));
    const vierzehnTageHer = Date.now() - 14 * 24 * 3600 * 1000;
    const kandidaten = alleUrls.filter((u) => {
      const letzter = bekannteMap.get(u);
      return !letzter || new Date(letzter).getTime() < vierzehnTageHer;
    });
    // Zufaellig mischen, damit nicht immer dieselben Seiten am Ende der Liste
    // uebersprungen werden.
    for (let i = kandidaten.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kandidaten[i], kandidaten[j]] = [kandidaten[j], kandidaten[i]];
    }
    const stichprobe = kandidaten.slice(0, STICHPROBE_LIMIT);

    let geprueft = 0;
    const fehlerListe: string[] = [];
    for (const url of stichprobe) {
      try {
        const check = await urlPruefen(token, siteUrl, url);
        const istBekannt = bekannteMap.has(url);
        const { error } = await sb.from("seo_index_stichprobe").upsert({
          url,
          letzter_check_am: new Date().toISOString(),
          indexiert: check.indexiert,
          verdict: check.verdict,
          coverage_state: check.coverageState,
          checks: istBekannt ? undefined : 1,
        });
        if (error) throw new Error(error.message);
        geprueft++;
      } catch (e) {
        fehlerListe.push(`${url}: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 200)); // hoeflich zum Tageslimit
    }
    ergebnis.stichprobe_geprueft = geprueft;
    ergebnis.stichprobe_kandidaten = kandidaten.length;
    if (fehlerListe.length) ergebnis.stichprobe_fehler = fehlerListe.slice(0, 5);

    return new Response(JSON.stringify(ergebnis), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: (e as Error).message, teilergebnis: ergebnis }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
