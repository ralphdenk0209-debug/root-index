// RIKI-SCAN-AUTOPILOT v1 (2026-07-28)
//
// AUFGABE: Nutzer scannen Produkte und fotografieren Etiketten. Diese Scans lagen bis heute
// im toten Winkel (der "Eingang"-Reiter wurde am 19.07. entfernt). Der Autopilot arbeitet
// die Foto-Scans der Warteschlange selbststaendig ab:
//   Foto-Scan -> riki-etikett liest (v12, Service-Zugang) -> cb_produkt_ingest legt das
//   Produkt an (Quelle "Etikettfoto") -> alle Pruefungen gruen: Produkt wird AKTIV +
//   Verifiziert=Nein (ehrlicher Banner, wie die OFF-Importe) -> Zweifel: bleibt ENTWURF
//   fuer Ralph, mit Klartext-Notiz WARUM.
//
// v1 MIT WAECHTER (Ralph 28.07.: "wir brauchen fuer riki einen waechter, der seine arbeit
// verifiziert ... gefahr ist, dass riki etwas ueberliest oder weglaesst"):
// Ein ZWEITER, unabhaengiger Riki-Lauf prueft die Lesung gegen dieselben Fotos -
// fehlende Zutaten, fehlende Wirkstoff-Zeilen (NORSAN-Lehre), falsche Zahlen,
// Regelverstoesse (100-g-Spalte, kJ/kcal). Nur wenn Leser UND Waechter uebereinstimmen,
// wird das Produkt aktiv. Jede Abweichung -> ENTWURF fuer Ralph, mit Klartext.
// Kennzeichnung: Produkte.Herkunft = "Riki-Autopilot" (eigene Spalte in der Liste).
//
// RALPH-ENTSCHEIDE (28.07.2026): automatisch im Takt (pg_cron alle 30 Min) ·
// fehlerfrei gelesen = Aktiv-aber-unverifiziert · Zweifel prueft Ralph.
//
// SICHERUNGEN:
// - Schalter Riki_Config.autopilot_an ('ja'/'nein') - abschaltbar ohne Deploy.
// - Monats-Budget (cb_riki_budget_check) UND Tagesdeckel autopilot_tageslimit_usd.
// - Max 2 EANs pro Lauf (Edge-Zeitlimit). v2 (Ralph 28.07.: "darf mehr sein"):
//   BIS ZU 3 VERSUCHE je Scan (Marker [AUTOPILOT-VERSUCH n]) - danach Handarbeit.
//   Kein Endlos-Loop an demselben kaputten Foto, aber eine zweite Chance bei Wacklern.
// - NICHTS ERFINDEN gilt weiter: der Autopilot schaltet nur AKTIV, wenn Rikis Lesung
//   serverseitig plausibel ist (score_erlaubt), Riki sich sicher ist, Name+Kategorie da
//   sind und der Score vollstaendig rechnet. Alles andere: Entwurf + Ralph.

// v3 (28.07. abends, Ralphs Luecken-Frage): WIRKSTOFFE + MIKROS werden NICHT mehr verworfen.
// Rikis "wirkstoffe" (Tagesdosis, inkl. Fettsaeuren/davon-Zeilen) -> Produkt_Naehrstoffe;
// "mikronaehrstoffe_100g" (nur echte 100-g-Spalte) -> Produkt_Mikronaehrstoffe.
// Vorher fiel bei gescannten Supplements die ganze Dosis-Tabelle stumm weg.

// v4 (28.07. spaet, Ralph-Go): PRODUKTE OHNE BARCODE. Foto-Eintraege OHNE EAN (der
// "Kein Barcode?"-Knopf der Manuell-Maske speichert sie seit 27v) werden jetzt verarbeitet:
// jeder Eintrag einzeln (verschiedene Fotos koennen verschiedene Produkte sein),
// Dubletten-Schutz ueber Name+Marke (steckt in cb_produkt_ingest), EAN_Status='offen'
// (gueltiger Endzustand seit 28t). Ehrliche Grenze: Namens-Abgleich ist schwaecher als
// EAN-Abgleich - Dubletten landen als Entwurf bei Ralph, nie ungeprueft live.

// v5 (03.10.2026): Quelle ins Repo geholt (vorher nur deployt, v21) und Aufrufer-Sperre
// (aufruferErlaubt) eingebaut. Logik sonst unveraendert.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_EANS_PRO_LAUF = 2;
const MARKER = "[AUTOPILOT]";
const MAX_VERSUCHE = 3;

/* Wie oft wurde dieser Eintrag schon versucht? Legacy-Marker [AUTOPILOT] ohne Zahl = 1. */
function versucheAus(notiz: string): number {
  const m = String(notiz ?? "").match(/\[AUTOPILOT-VERSUCH (\d+)\]/);
  if (m) return Number(m[1]);
  return String(notiz ?? "").includes(MARKER) ? 1 : 0;
}

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
};
const WAECHTER_MODELL = "claude-haiku-4-5-20251001";

const WAECHTER_REGELN = `Du bist der WAECHTER von Root Index. Eine Lese-KI (Riki) hat aus Etikettfotos
Produktdaten gelesen. DEINE Aufgabe: die Lesung UNABHAENGIG gegen die Fotos pruefen.
Du bist die zweite Unterschrift - nicht der zweite Leser desselben Fehlers.

VORGEHEN (genau in dieser Reihenfolge):
1. Lies ZUERST selbst vom Etikett: Zutatenliste, Naehrwerttabelle (100-g-Spalte!),
   Wirkstoff-/Vitamin-Tabelle (falls vorhanden), Produktname.
2. Vergleiche DANACH mit Rikis Ergebnis (JSON unten).

WORAUF DU BESONDERS ACHTEST (bekannte Fehlerklassen):
- UEBERLESEN: Zutaten, die auf dem Etikett stehen, aber in Rikis Liste FEHLEN.
- WEGGELASSENE WIRKSTOFF-ZEILEN: Fettsaeuren (Omega-3/EPA/DHA), Aminosaeuren, Kreatin -
  JEDE Zeile mit Menge zaehlt, auch "davon"-Zeilen und Zeilen ohne Referenzwert.
- FALSCHE SPALTE: Portionswerte statt 100 g. kJ statt kcal (kJ ist ~4,2x groesser).
- ERFUNDENES: Eintraege bei Riki, die auf dem Etikett NICHT stehen.
- MEHRSPRACHIG: doppelte Zutaten in zwei Sprachen.

REGELN:
- NICHTS ERFINDEN. Was du nicht lesen kannst, meldest du als "nicht pruefbar" - nicht als Fehler.
- IM ZWEIFEL: freigabe_empfohlen = false. Ein Mensch prueft dann. Das ist der gewollte Weg.
- Kleinigkeiten (Gross-/Kleinschreibung, Reihenfolge, Uebersetzungsvarianten derselben Zutat)
  sind KEINE Fehler.

ANTWORTE NUR MIT JSON:
{
  "freigabe_empfohlen": boolean,
  "fehlende_zutaten": string[],
  "erfundene_zutaten": string[],
  "naehrwert_abweichungen": [ { "feld": string, "etikett": string, "riki": string } ],
  "fehlende_wirkstoffe": string[],
  "sonstige_probleme": string[],
  "nicht_pruefbar": string[],
  "anmerkung": string|null
}`;

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  }
  return null;
}

/* Der Waechter-Lauf: gleiche Fotos + Rikis Ergebnis, unabhaengige Pruefung.
   Bucht seine Kosten als modus "etikett-waechter". Bei technischem Fehler: null
   (der Aufrufer behandelt das als Zweifel - nie als stilles Gruen). */
async function waechterPrueft(sb: any, bilder: string[], vorschlag: any): Promise<any | null> {
  const key = findeKey();
  if (!key) return null;
  const inhalt: unknown[] = [];
  for (const b64 of bilder) {
    const m = String(b64).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) continue;
    inhalt.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!inhalt.length) return null;
  inhalt.push({ type: "text", text:
    "Pruefe diese Lesung gegen die Etikettfotos. Rikis Ergebnis:\n" +
    JSON.stringify({ name: vorschlag.name, marke: vorschlag.marke,
      kategorie: vorschlag.kategorie_vorschlag, naehrwerte_100g: vorschlag.naehrwerte_100g,
      zutaten: (vorschlag.zutaten ?? []).map((z: any) => z.name),
      wirkstoffe: vorschlag.wirkstoffe ?? [],
      zusatzstoffe: vorschlag.zusatzstoffe ?? null }) });

  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: WAECHTER_MODELL, max_tokens: 1500,
      system: [{ type: "text", text: WAECHTER_REGELN, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: inhalt }],
    }),
  });
  const j: any = await ai.json().catch(() => null);
  const usage: any = j?.usage ?? {};
  const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const outTok = usage.output_tokens ?? 0;
  const preis = PREISE[WAECHTER_MODELL];
  const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;
  await sb.rpc("cb_riki_buchen", { p_modus: "etikett-waechter", p_modell: WAECHTER_MODELL,
    p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
    p_produkt_id: null, p_erfolg: ai.ok, p_fehler: ai.ok ? null : JSON.stringify(j).slice(0, 300) });
  if (!ai.ok) return null;
  const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  try { const m = text.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : text); } catch { return null; }
}

function antwort(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/* 03.10.2026 (Ralph-Freigabe fuer die fixierte Maschine, 02.10.): Nur noch Takt/Service-Schluessel
   oder Admin. Vorher reichte jeder gueltige JWT (auch der oeffentliche Anon-Key). Der Takt
   cb_riki_autopilot_takt ruft jetzt ueber cb_edge_rufen mit dem Service-Schluessel aus dem Vault
   (neues Format sb_secret_...) - der wird hier gegen die Auth-API geprueft, nicht nur gelesen. */
function jwtRolle(t: string): string {
  try { const teil = t.split(".")[1] ?? ""; return JSON.parse(atob(teil.replace(/-/g, "+").replace(/_/g, "/")))?.role ?? ""; } catch (_e) { return ""; }
}
async function aufruferErlaubt(req: Request): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();
  const svc = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  for (const k of [auth, apikey]) {
    if (!k) continue;
    if (svc.length > 20 && k === svc) return true;
    if (k.startsWith("sb_secret_") || jwtRolle(k) === "service_role") {
      try {
        const t = createClient(url, k, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await t.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (!error) return true;
      } catch (_e) { /* weiter pruefen */ }
    }
  }
  if (auth && jwtRolle(auth) === "authenticated") {
    try {
      const u = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: "Bearer " + auth } } });
      const { data } = await u.rpc("cb_ist_admin");
      if (data === true) return true;
    } catch (_e) { /* nein */ }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await aufruferErlaubt(req))) return antwort({ ok: false, fehler: "Nur fuer Takt oder Admin." }, 403);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey);
  const t0 = Date.now();
  const protokoll: string[] = [];

  try {
    // ---- Schalter ----
    const { data: cfg } = await sb.from("Riki_Config").select("schluessel,wert")
      .in("schluessel", ["autopilot_an", "autopilot_tageslimit_usd"]);
    const cfgMap: Record<string, string> = {};
    for (const z of cfg ?? []) cfgMap[z.schluessel] = z.wert;
    if ((cfgMap["autopilot_an"] ?? "nein") !== "ja") {
      return antwort({ ok: true, uebersprungen: "autopilot_an ist nicht 'ja'" });
    }

    // ---- Budget: Monat (bestehender Waechter) + Tagesdeckel Autopilot ----
    const { data: budRaw, error: budErr } = await sb.rpc("cb_riki_budget_check");
    if (budErr) return antwort({ ok: false, fehler: "Budget-Pruefung: " + budErr.message }, 500);
    const bud: any = Array.isArray(budRaw) ? budRaw[0] : budRaw;
    if (bud?.erlaubt !== true) {
      return antwort({ ok: true, uebersprungen: "Monats-Budget erreicht", budget: bud });
    }
    const tagesdeckel = Number(cfgMap["autopilot_tageslimit_usd"] ?? "0");
    const heute = new Date().toISOString().slice(0, 10);
    const { data: heutig } = await sb.from("Riki_Nutzung").select("kosten_usd")
      .in("modus", ["etikett-auto", "etikett-waechter"]).gte("erfasst_am", heute + "T00:00:00Z");
    const heuteUsd = (heutig ?? []).reduce((s: number, z: any) => s + Number(z.kosten_usd ?? 0), 0);
    if (tagesdeckel > 0 && heuteUsd >= tagesdeckel) {
      return antwort({ ok: true, uebersprungen: `Tagesdeckel erreicht (${heuteUsd.toFixed(2)} von ${tagesdeckel} USD)` });
    }

    // ---- Kandidaten: offene Foto-Scans ohne Produkt, noch nicht versucht ----
    const { data: eintraege, error: qErr } = await sb.from("Scan_Warteschlange")
      .select('Eintrag_ID,EAN,Status,Produkt_ID,Typ,Notiz,Foto_Base64,Fotos_Base64,Erfasst_am')
      .eq("Status", "offen").is("Produkt_ID", null)
      .order("Erfasst_am", { ascending: true }).limit(200);
    if (qErr) return antwort({ ok: false, fehler: "Warteschlange: " + qErr.message }, 500);

    // je EAN sammeln; nur EANs mit mindestens einem Foto; Versuchs-Marker respektieren
    const proEan = new Map<string, any[]>();
    for (const e of eintraege ?? []) {
      const ean = String(e.EAN ?? "").trim();
      if (!ean) continue;
      if (!proEan.has(ean)) proEan.set(ean, []);
      proEan.get(ean)!.push(e);
    }
    const kandidaten: { ean: string; zeilen: any[]; bilder: string[]; versuche: number }[] = [];
    /* v4: EAN-lose Foto-Eintraege - jeder Eintrag ist ein eigener Kandidat (ean="") */
    for (const e of eintraege ?? []) {
      if (String(e.EAN ?? "").trim()) continue;                    // hat EAN -> unten
      const versuche = versucheAus(e.Notiz);
      if (versuche >= MAX_VERSUCHE) continue;
      const bilder: string[] = [];
      if (Array.isArray(e.Fotos_Base64)) for (const f of e.Fotos_Base64) {
        if (typeof f === "string" && f.startsWith("data:image/")) bilder.push(f);
      }
      if (typeof e.Foto_Base64 === "string" && e.Foto_Base64.startsWith("data:image/") && !bilder.includes(e.Foto_Base64)) bilder.push(e.Foto_Base64);
      if (!bilder.length) continue;
      kandidaten.push({ ean: "", zeilen: [e], bilder: bilder.slice(0, 3), versuche });
    }
    for (const [ean, zeilen] of proEan) {
      const versuche = Math.max(...zeilen.map((z) => versucheAus(z.Notiz)));
      if (versuche >= MAX_VERSUCHE) continue; // ausgereizt -> Handarbeit
      const bilder: string[] = [];
      for (const z of zeilen) {
        if (Array.isArray(z.Fotos_Base64)) for (const f of z.Fotos_Base64) {
          if (typeof f === "string" && f.startsWith("data:image/")) bilder.push(f);
        }
        if (typeof z.Foto_Base64 === "string" && z.Foto_Base64.startsWith("data:image/")) bilder.push(z.Foto_Base64);
      }
      if (!bilder.length) continue; // reine Barcode-Scans: kein Lesestoff fuer Riki
      kandidaten.push({ ean, zeilen, bilder: bilder.slice(0, 3), versuche });
    }

    if (!kandidaten.length) return antwort({ ok: true, ergebnis: "nichts zu tun", dauer_ms: Date.now() - t0 });

    const ergebnisse: any[] = [];
    let verarbeitet = 0;

    for (const k of kandidaten) {
      if (verarbeitet >= MAX_EANS_PRO_LAUF) break;

      // Produkt mit dieser EAN schon da? -> nur verknuepfen (kein Riki-Geld ausgeben)
      const { data: vorhanden } = k.ean ? await sb.from("Produkte").select('Produkt_ID,Produktstatus')
        .eq("EAN_GTIN", k.ean).limit(1) : { data: null };
      if (vorhanden && vorhanden.length) {
        const pid = vorhanden[0].Produkt_ID;
        await sb.from("Scan_Warteschlange").update({ Produkt_ID: pid,
          Notiz: `${MARKER} verknuepft mit bestehendem ${pid}` })
          .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
        ergebnisse.push({ ean: k.ean, ergebnis: "verknuepft", produkt_id: pid });
        continue;
      }

      verarbeitet++;

      // ---- Riki liest die Fotos (riki-etikett v12, Service-Zugang) ----
      const resp = await fetch(`${url}/functions/v1/riki-etikett`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ bilder: k.bilder, ean: k.ean || undefined }),
      });
      const gelesen: any = await resp.json().catch(() => null);
      const v = gelesen?.vorschlag;

      if (!resp.ok || !v) {
        await sb.from("Scan_Warteschlange").update({
          Notiz: `[AUTOPILOT-VERSUCH ${k.versuche + 1}] Riki konnte die Fotos nicht verwerten (${gelesen?.error ?? "HTTP " + resp.status}).${k.versuche + 1 >= MAX_VERSUCHE ? " Bitte von Hand pruefen." : " Naechster Versuch folgt."}` })
          .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
        ergebnisse.push({ ean: k.ean, ergebnis: "riki_fehler", fehler: gelesen?.error ?? resp.status });
        continue;
      }

      // ---- Produkt anlegen (bestehender Weg, kein zweiter Pfad) ----
      const zusatz = v.zusatzstoffe ?? {};
      const payload: any = {
        ean: k.ean || null,
        name: v.name ?? null,
        marke: v.marke ?? null,
        kategorie: v.kategorie_vorschlag ?? null,   // riki-etikett kennt NUR die 23 gueltigen Werte
        basis: v.bezug === "100ml" ? "100ml" : "100g",
        quelle: `Etikettfoto (Nutzer-Scan), von Riki gelesen am ${heute}`,
        quelle_typ: "Etikettfoto",
        naehrwerte: v.naehrwerte_100g ?? null,
        zutaten: Array.isArray(v.zutaten) ? v.zutaten : [],
        zusatzstoffe_text: zusatz.text ?? "",
        zusatzstoffe_status: zusatz.status ?? null,
        suessstoffe: zusatz.suessstoffe === true ? "ja" : "nein",
      };
      if (!payload.name) {
        await sb.from("Scan_Warteschlange").update({
          Notiz: `[AUTOPILOT-VERSUCH ${k.versuche + 1}] Riki konnte keinen Produktnamen lesen.${k.versuche + 1 >= MAX_VERSUCHE ? " Bitte von Hand anlegen." : " Naechster Versuch folgt."}` })
          .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
        ergebnisse.push({ ean: k.ean, ergebnis: "kein_name" });
        continue;
      }

      const { data: ingRaw, error: ingErr } = await sb.rpc("cb_produkt_ingest", { p: payload, p_auto_freigeben: false });
      if (ingErr) {
        await sb.from("Scan_Warteschlange").update({
          Notiz: `[AUTOPILOT-VERSUCH ${k.versuche + 1}] Anlegen fehlgeschlagen: ${ingErr.message}.${k.versuche + 1 >= MAX_VERSUCHE ? " Bitte von Hand pruefen." : " Naechster Versuch folgt."}` })
          .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
        ergebnisse.push({ ean: k.ean, ergebnis: "ingest_fehler", fehler: ingErr.message });
        continue;
      }
      const ing: any = ingRaw;
      const pid = ing?.produkt_id;

      // Scans ans Produkt binden (Fotos bleiben als Beleg in der Warteschlange, 18.07.-Prinzip)
      await sb.from("Scan_Warteschlange").update({ Produkt_ID: pid })
        .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
      await sb.from("Produkte").update({ Herkunft: "Riki-Autopilot" }).eq("Produkt_ID", pid);
      if (!k.ean) await sb.from("Produkte").update({ EAN_Status: "offen" }).eq("Produkt_ID", pid);   // v4: bewusst ohne Barcode (28t-Endzustand)

      // ---- v3: Wirkstoffe (Tagesdosis) + Mikros je 100 g uebernehmen - nichts verwerfen ----
      try {
        const wirk = Array.isArray(v.wirkstoffe) ? v.wirkstoffe : [];
        if (wirk.length) {
          await sb.from("Produkt_Naehrstoffe").delete().eq("Produkt_ID", pid);
          await sb.from("Produkt_Naehrstoffe").insert(wirk.map((x: any, i: number) => ({
            Produkt_ID: pid, naehrstoff: String(x.name), menge: Number(x.menge),
            einheit: String(x.einheit), nrv_prozent: (x.nrv ?? null), sort: i + 1,
            quelle: "Etikettfoto (Riki-Autopilot)", verifiziert: false,
          })));
        }
        const mikro = Array.isArray(v.mikronaehrstoffe_100g) ? v.mikronaehrstoffe_100g : [];
        if (mikro.length) {
          await sb.from("Produkt_Mikronaehrstoffe").delete().eq("Produkt_ID", pid);
          await sb.from("Produkt_Mikronaehrstoffe").insert(mikro.map((x: any) => ({
            Produkt_ID: pid, Naehrstoff: String(x.name), Menge_100g: Number(x.menge),
            Einheit: String(x.einheit), Quelle_Status: "Etikettfoto (Riki-Autopilot)",
          })));
        }
      } catch (_e) { /* Wirkstoff-Schreibfehler blockt den Rest nicht - Waechter/Zweifel greifen */ }

      // ---- WAECHTER: zweiter, unabhaengiger Riki prueft die Lesung ----
      const w = await waechterPrueft(sb, k.bilder, v);

      // ---- Gruen oder Zweifel? ----
      const zweifel: string[] = [];
      if (!w) zweifel.push("Waechter-Pruefung technisch fehlgeschlagen - kein stilles Gruen");
      else if (w.freigabe_empfohlen !== true) {
        const det = [
          ...(w.fehlende_zutaten ?? []).map((x: string) => "fehlt: " + x),
          ...(w.erfundene_zutaten ?? []).map((x: string) => "nicht auf Etikett: " + x),
          ...(w.naehrwert_abweichungen ?? []).map((x: any) => `${x.feld}: Etikett ${x.etikett} vs. Riki ${x.riki}`),
          ...(w.fehlende_wirkstoffe ?? []).map((x: string) => "Wirkstoff fehlt: " + x),
          ...(w.sonstige_probleme ?? []),
        ];
        zweifel.push("Waechter widerspricht: " + (det.length ? det.join("; ") : (w.anmerkung ?? "ohne Detail")));
      }
      if (gelesen.score_erlaubt !== true) zweifel.push("Naehrwerte unplausibel/unvollstaendig (" + (gelesen.warnungen ?? []).join(" · ") + ")");
      if (v.unsicher === true) zweifel.push("Riki unsicher: " + (v.unsicher_warum ?? "ohne Angabe"));
      if (!v.kategorie_vorschlag) zweifel.push("keine eindeutige Kategorie");
      if (ing?.vollstaendig !== true) zweifel.push("Score nicht vollstaendig (z. B. unbewertete Zutat)");

      if (!zweifel.length) {
        // Ralph-Entscheid: Aktiv + Verifiziert=Nein (ehrlicher Banner, wie OFF-Importe)
        await sb.from("Produkte").update({ Produktstatus: "Aktiv", Verifiziert: "Nein" }).eq("Produkt_ID", pid);
        await sb.from("Scan_Warteschlange").update({
          Notiz: `${MARKER} ${pid} angelegt, AKTIV (unverifiziert), Score ${ing?.clean_score ?? "-"}` })
          .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
        ergebnisse.push({ ean: k.ean || "(ohne Barcode)", ergebnis: "aktiv_unverifiziert", produkt_id: pid, score: ing?.clean_score });
      } else {
        await sb.from("Scan_Warteschlange").update({
          Notiz: `${MARKER} ${pid} als ENTWURF angelegt - braucht Ralph: ${zweifel.join(" | ")}` })
          .in("Eintrag_ID", k.zeilen.map((z) => z.Eintrag_ID));
        ergebnisse.push({ ean: k.ean || "(ohne Barcode)", ergebnis: "entwurf_zweifel", produkt_id: pid, gruende: zweifel });
      }
    }

    return antwort({ ok: true, verarbeitet, ergebnisse, protokoll, dauer_ms: Date.now() - t0 });
  } catch (e) {
    return antwort({ ok: false, fehler: String(e) }, 500);
  }
});
