// SOCIAL-META-SYNC  (22.09.2026, Ralph, Work #787)
//
// Holt Instagram- und Facebook-Kennzahlen aus der Meta Graph API und schreibt
// je Tag und Kanal eine Zeile in social_kennzahlen_taeglich (Cockpit-Kachel Social).
//
// Zugang: beim ersten Lauf tauscht die Funktion den kurzlebigen Nutzer-Token
// (Secret META_NUTZER_TOKEN, aus dem Graph API Explorer) mit dem App-Geheimcode
// (Secret META_APP_SECRET) in einen langlebigen Nutzer-Token und daraus in den
// Seiten-Token der Seite "Root Index" - der laeuft nicht ab. Der Seiten-Token
// liegt danach in social_zugang; die Secrets werden nur fuer diesen Tausch gebraucht.
//
// Aufruf: nur mit einem Service-Schluessel, taeglich per GitHub-Actions-Cron
// (.github/workflows/social-meta.yml). Der Schluessel wird NICHT per Zeichenvergleich
// gegen die Umgebung geprueft (das scheiterte bei seo-search-console-sync bei allen
// Laeufen, weil GitHub einen anderen Schluessel als die Funktionsumgebung hat), sondern
// bei Supabase selbst: nur ein Service-Schluessel darf die Auth-Admin-Liste lesen.

import { createClient } from "jsr:@supabase/supabase-js@2";

const G = "https://graph.facebook.com/v21.0";
const APP_ID = "1731680354611198";
const FB_PAGE_ID = "1374317165757512";
const IG_USER_ID = "17841427154636859";

async function istServiceSchluessel(url: string, key: string): Promise<boolean> {
  if (!key) return false;
  const r = await fetch(`${url}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return r.ok;
}

async function graph(pfad: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(`${G}/${pfad}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (token) u.searchParams.set("access_token", token);
  const r = await fetch(u.toString());
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`${pfad}: ${j.error?.message || r.status}`);
  return j;
}

async function seitenTokenBesorgen(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await sb.from("social_zugang").select("token").eq("kanal", "facebook_seite").maybeSingle();
  if (data?.token) return data.token as string;

  const nutzerToken = Deno.env.get("META_NUTZER_TOKEN");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!nutzerToken || !appSecret) throw new Error("Kein Seiten-Token in social_zugang und Secrets META_NUTZER_TOKEN/META_APP_SECRET fehlen.");

  // 1) kurz -> lang (60 Tage)
  const lang = await graph("oauth/access_token", "", {
    grant_type: "fb_exchange_token", client_id: APP_ID, client_secret: appSecret, fb_exchange_token: nutzerToken,
  });
  // 2) lang -> Seiten-Token (kein Ablauf)
  const konten = await graph("me/accounts", lang.access_token as string, { fields: "id,name,access_token" });
  const seite = (konten.data || []).find((k: { id: string }) => k.id === FB_PAGE_ID);
  if (!seite) throw new Error("Seite Root Index nicht im Nutzer-Token freigegeben (me/accounts leer).");

  const { error } = await sb.from("social_zugang").upsert({
    kanal: "facebook_seite", token: seite.access_token, konto_id: FB_PAGE_ID, laeuft_ab: null, aktualisiert_am: new Date().toISOString(),
  });
  if (error) throw new Error(`social_zugang: ${error.message}`);
  return seite.access_token as string;
}

Deno.serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const key = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!(await istServiceSchluessel(url, key))) {
    return new Response(JSON.stringify({ ok: false, fehler: "Nicht autorisiert." }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const sb = createClient(url, serviceKey || key);
  const ergebnis: Record<string, unknown> = { ok: true };
  const heute = new Date().toISOString().slice(0, 10);

  try {
    const token = await seitenTokenBesorgen(sb);
    ergebnis.token_quelle = "social_zugang";

    const ig = await graph(IG_USER_ID, token, { fields: "followers_count,media_count" });
    let igReich = null, igProfil = null, igInter = null;
    try {
      const ins = await graph(`${IG_USER_ID}/insights`, token, { metric: "reach,profile_views,accounts_engaged", period: "day", metric_type: "total_value" });
      for (const m of ins.data || []) {
        const v = m.total_value?.value ?? null;
        if (m.name === "reach") igReich = v; if (m.name === "profile_views") igProfil = v; if (m.name === "accounts_engaged") igInter = v;
      }
    } catch (e) { ergebnis.instagram_insights_fehler = (e as Error).message; }
    const zIg = { tag: heute, kanal: "instagram", follower: ig.followers_count ?? null, beitraege: ig.media_count ?? null,
      reichweite: igReich, profilaufrufe: igProfil, interaktionen: igInter, aktualisiert_am: new Date().toISOString() };
    const e1 = await sb.from("social_kennzahlen_taeglich").upsert(zIg);
    if (e1.error) throw new Error(`Upsert instagram: ${e1.error.message}`);
    ergebnis.instagram = zIg;

    const fb = await graph(FB_PAGE_ID, token, { fields: "followers_count,fan_count" });
    let fbReich = null, fbProfil = null, fbInter = null;
    try {
      const ins = await graph(`${FB_PAGE_ID}/insights`, token, { metric: "page_impressions_unique,page_views_total,page_post_engagements", period: "day" });
      for (const m of ins.data || []) {
        const v = (m.values || []).slice(-1)[0]?.value ?? null;
        if (m.name === "page_impressions_unique") fbReich = v; if (m.name === "page_views_total") fbProfil = v; if (m.name === "page_post_engagements") fbInter = v;
      }
    } catch (e) { ergebnis.facebook_insights_fehler = (e as Error).message; }
    const zFb = { tag: heute, kanal: "facebook", follower: fb.followers_count ?? fb.fan_count ?? null, beitraege: null,
      reichweite: fbReich, profilaufrufe: fbProfil, interaktionen: fbInter, aktualisiert_am: new Date().toISOString() };
    const e2 = await sb.from("social_kennzahlen_taeglich").upsert(zFb);
    if (e2.error) throw new Error(`Upsert facebook: ${e2.error.message}`);
    ergebnis.facebook = zFb;

    return new Response(JSON.stringify(ergebnis), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: (e as Error).message, teilergebnis: ergebnis }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
