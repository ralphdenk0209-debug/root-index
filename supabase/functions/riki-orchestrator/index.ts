// riki-orchestrator — RIKI PRODUCT RESEARCH ORCHESTRATOR v2
//
// v4 (2026-09-04, KP-468 Schritt 3, Ralph-Go 04.09.) — vier Bruchstellen aus dem
// Rauchtest KP-438, jede gemessen, nichts geraten:
//   438-4  Zwei OpenFoodFacts-Seiten mit FREMDER GTIN wurden gelesen und als
//          Extraktionslauf 230/231 unter P73663 abgelegt (17 Items eines anderen
//          Produkts). Ursache: der GTIN-Abgleich kam erst NACH dem Lesen und
//          verliess sich auf die vom Modell gelesene GTIN - die stand bei 231 auf
//          null. Jetzt: GTIN steht bei OFF & Co. in der ADRESSE (/produkt/<ean>/)
//          und wird VOR dem Lesen geprueft; fremde GTIN = nicht lesen. Und wird
//          nach dem Lesen doch eine fremde GTIN erkannt, wird der Lauf verworfen
//          (cb_riki_source_extraction_verwerfen), nicht nur die Quelle abgelehnt.
//   438-2  product_source_state hatte 0 Zeilen trotz 8 gelesener Quellen: die
//          Station "Quelle" wurde nie geschrieben. Jetzt schreibt Phase H je
//          Quellenart ueber cb_riki_quelle_status_setzen - eindeutig mit der
//          benutzten Adresse, sonst nicht_gefunden mit den Kandidaten.
//   438-1  "Quellensuche lieferte kein JSON" in 6 von 6 Nachsuchen, ohne dass
//          jemand sehen konnte, was stattdessen kam. Jetzt stehen die ersten
//          200 Zeichen der Antwort im Protokoll. Messen, dann beheben.
//   438-3  HTTP 504: die Edge-Laufzeit endet bei 150 s, das Budget stand auf
//          240 s. Budget auf 130 s - fuer mehr gibt es die Modi start/schritt/
//          abschluss, die genau dafuer gebaut wurden.
//   E40    Eingefroren (Ralph 04.09.): Schalter Riki_Config.orchestrator_an, gelesen
//          ueber cb_riki_orchestrator_erlaubt. Alles ausser "ja" antwortet 423.
//   Sicherung v3.3: bereiche/_sicherungen/2026-09-04-riki-orchestrator-v3.3/
// Work #238 / #239 / #247, Ralph-Entscheide 24.08.2026.
//
// WAS v2 ANDERS MACHT ALS v1 (Ralph-Entscheid #247: A + B, C abgelehnt):
//   v1 hat GESUCHT und dann gelesen. Zwei Laeufe desselben Auftrags fanden
//   deshalb fast voellig verschiedene Quellen - nur OpenFoodFacts kam in beiden
//   vor. Nicht die Extraktion schwankte, sondern die Suche.
//   v2 kehrt die Reihenfolge um: PFLICHTKASKADE ZUERST.
//     1 Produktlink aus dem Produktstamm      (stand die ganze Zeit da, #246)
//     2 bewaehrte Quellen aus frueheren Laeufen (der gemerkte Plan, #247 B)
//     3 aus der GTIN gebildete Adresse         (keine Suche, keine Schwankung)
//     4 danach erst Websuche - und nur fuer Bereiche, die noch fehlen
//   Was belegt gelesen wurde, wandert in den Plan zurueck. Beim naechsten Lauf
//   steht es oben. Damit wird die Recherche mit jedem Lauf stabiler statt neu.
//
//   Ausserdem behoben (#248): die Identitaet wird jetzt bewertet, BEVOR die
//   Coverage gerechnet wird. Vorher meldete eine Recherche mit exakt
//   bestaetigter GTIN trotzdem "identity offen".
//
// ZIEL IST NICHT, EINE WEBSEITE ZU LESEN. Ziel ist, ein konkretes Produkt
// moeglichst vollstaendig, belegt, widerspruchsfrei und reproduzierbar zu erfassen.
//
// WAS DIESE FUNKTION TUT UND WAS NICHT:
//   Sie entscheidet Identitaet, sucht Quellen, verteilt sie an den Extractor,
//   jagt Luecken und schliesst ab. Sie liest KEINE Seite selbst — das macht
//   riki-quelle-lesen. Sie bewertet keine Zutat — das macht das Regelwerk.
//   Sie schreibt KEIN Produktfeld — waehrend der Recherche wird nichts ueberschrieben.
//
// WAS SIE NICHT NACHBAUT (Kernvertrag: kein zweiter Resolver):
//   Domainrolle          -> cb_riki_quellenwahl (brand_source_domain, #233)
//   Quellenreihenfolge   -> cb_riki_quellenleiter / cb_riki_naechster_quellenweg
//   Extraktionsvertrag   -> cb_riki_source_extraction_speichern (#216)
//   Coverage + Konflikte -> cb_riki_research_coverage_erheben / _quellenvergleich_erheben
//   Reproduzierbarkeit   -> cb_riki_research_struktur_hash
//
// MODI (ein Aufruf = ein Abschnitt, damit kein Zeitlimit den Lauf zerreisst):
//   start     Phase A+B  Identitaet festlegen, Quellenplan anlegen
//   schritt   Phase C+D  naechste geplante Quelle lesen, Coverage neu rechnen, Luecken jagen
//   abschluss Phase F+H  Quellenvergleich, Abschluss mit Begruendung
//   voll                 start, dann schritt bis fertig oder Zeitbudget, dann abschluss

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const EDGE_VERSION = 4;
// 110 s waren zu knapp: im Realtest #240 dauerten Laeufe 103 bis 117 s und
// wurden mitten in der Quellenliste abgeschnitten (Recherche 9 hatte danach
// noch zwei ungelesene Quellen). Gemessen, nicht geschaetzt.
// v4 (438-3): 240 s lagen ueber der Edge-Laufzeit von 150 s - der zweite
// oatsome-Lauf endete mit HTTP 504 und ohne Abschluss. 130 s lassen Luft fuer
// den Abschluss; laengere Recherchen laufen in Abschnitten (start/schritt/abschluss).
const ZEITBUDGET_MS = 130_000;
const MAX_QUELLEN = 8;
const MAX_NACHSUCHEN = 2;

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-opus-5": { in: 5.0, out: 25.0 },
};

/* ---------------------------------------------------------------------------
   MODELLESKALATION - Ralph-Auftrag 25.08.2026: "guenstig starten, bei
   Problemfaellen auf Opus wechseln."

   Zwei Regeln, ohne die das mehr kaputt macht als es hilft:

   1. DER ZWEITE LAUF ERSETZT DEN ERSTEN. Er stellt sich nicht daneben.
      Ein zweiter Befund zur selben Quelle waere genau der Zustand, der am
      25.08. als #252 gemessen wurde: dieselbe Zutat einmal gebunden, einmal
      offen. Der verworfene Lauf wird deshalb mit
      cb_riki_source_extraction_verwerfen auf rejected gesetzt.

   2. ESKALIERT WIRD NUR, WO EIN MODELL HELFEN KANN. Meldet der Leser
      "hilft: quelle" - die Seite trug die Daten schlicht nicht -, dann liest
      auch Opus dasselbe Nichts. Das war der LaVita-Fall vom 25.08. Dort ist
      eine andere Adresse faellig, kein teureres Modell.

   Kosten, gemessen an echten Token eines Lesevorgangs (in 8.332 / out 1.711):
      Haiku  0,017 $   Sonnet  0,051 $   Opus  0,085 $
   Haiku als Stufe 1 plus Opus bei Bedarf ist billiger als Sonnet fuer alle,
   solange unter 40 % der Faelle eskalieren.
--------------------------------------------------------------------------- */
const STANDARD_MODELL_ESKALATION = "claude-opus-5";

/* v3.1, gemessen 25.08.2026: Opus 5 lehnt den Parameter temperature ab
   ("`temperature` is deprecated for this model."). Vier Eskalationsversuche
   sind daran gescheitert. Fuer alle anderen Modelle bleibt temperature 0 -
   daran haengt die Reproduzierbarkeit aus #234. */
const OHNE_TEMPERATURE = new Set<string>(["claude-opus-5"]);
const WEBSUCHE_PREIS = 0.01;

// Ralph-Entscheid 24.08.2026 (Variante A): Fuer den Benchmark laeuft RIKI auf
// Sonnet, nicht auf Haiku. Rund dreifacher Tokenpreis — der Anspruch ist Maszstab
// zu sein, nicht zu sparen. Ueber "modell" im Aufruf weiter umstellbar.
// Der Modellname ist gemessen, nicht angenommen: 1.643 erfolgreiche Aufrufe
// unter genau diesem Namen, zuletzt am 24.08.2026.
const STANDARD_MODELL = "claude-sonnet-4-6";


function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}

function eanOk(roh: unknown): string | null {
  const s = String(roh ?? "").replace(/\D/g, "");
  if (s.length !== 8 && s.length !== 13) return null;
  const zif = s.split("").map(Number);
  const pruef = zif.pop()!;
  let summe = 0;
  zif.reverse().forEach((d, i) => { summe += d * (i % 2 === 0 ? 3 : 1); });
  return ((10 - (summe % 10)) % 10) === pruef ? s : null;
}

// v4 (438-4): Produktdatenbanken tragen die GTIN in der Adresse. Das ist ein
// belegter Wert - sicherer als das, was ein Modell von der Seite abliest.
function gtinAusUrl(url: string): string | null {
  const m = String(url ?? "").match(/\/(?:produkt|product|products|prod)\/(\d{8,14})(?:[\/?#]|$)/i);
  return m ? eanOk(m[1]) : null;
}

// Quellenart, wie der Extractor und product_source_state sie kennen (eine Liste, ein Ort).
function sourceKindVon(typ: string): string {
  return typ.startsWith("manufacturer") ? "herstellerseite"
       : typ === "aggregator" ? "openfoodfacts"
       : typ === "product_database" ? "produktdatenbank"
       : typ === "label_photo" ? "etikettfoto" : "haendlerseite";
}

/* ---------------------------------------------------------------------------
   PHASE B — Quellensuche. Das Modell darf SUCHEN und EINORDNEN, sonst nichts.
   Es liest hier keine Werte aus: sonst haetten wir zwei Extraktoren.
--------------------------------------------------------------------------- */
const SUCH_REGEL = `Du bist RIKI, der Produkt-Rechercheur von Root Index.
In diesem Schritt SUCHST du nur Quellen. Du liest KEINE Naehrwerte und KEINE Zutaten aus.
Wer das trotzdem tut, erzeugt eine zweite Wahrheit — genau das ist verboten.

AUFGABE: Finde per Websuche die Adressen (URLs), unter denen die Daten zu GENAU DIESEM
Produkt stehen. Ordne jede gefundene Adresse ein.

REIHENFOLGE DER EIGNUNG:
A manufacturer_product_page   offizielle Hersteller-/Markenproduktseite zu genau diesem Produkt
B manufacturer_datasheet      Hersteller-LMIV, Datenblatt, PDF, Produktdaten-API
C manufacturer_subpage        weitere offizielle Unterseite (Zutaten, Naehrwerte, Dosierung)
D retailer_page               Haendlerseite mit exakt passender GTIN
E product_database            serioese Produktdatenbank mit exakt passender GTIN
F aggregator                  OpenFoodFacts und Vergleichbares — zur Identitaet und Gegenpruefung
G label_photo                 Etikettfoto

DIESE REIHENFOLGE IST KEINE WAHRHEITSRANGLISTE. Entscheidend ist bei jeder Adresse:
Passt die GTIN? Passt die Variante? Passt der Markt? Passt die Packungsgroesse?
Eine Herstellerseite fuer eine ANDERE Variante ist schlechter als eine exakte GTIN-Quelle.
Eine andere GTIN ist ein anderes Produkt, bis das Gegenteil belegt ist.

NICHTS ERFINDEN: Gib nur Adressen an, die du in der Suche tatsaechlich gesehen hast.
Keine geratenen Adressmuster wie "hersteller.de/produkte/<name>". Findest du nichts
Passendes, gib eine leere Liste zurueck — das ist eine gueltige Antwort.

Sind bestimmte Bereiche AUSDRUECKLICH GESUCHT (im Auftrag genannt), suche gezielt die
Unterseiten, die genau diese Luecke schliessen.

ANTWORTE AUSSCHLIESSLICH MIT JSON:
{"quellen":[{"url":"...","source_type":"manufacturer_product_page|manufacturer_datasheet|manufacturer_subpage|retailer_page|product_database|aggregator|label_photo|other",
             "begruendung":"warum diese Adresse zu diesem Produkt gehoert",
             "gtin_auf_der_seite":null,
             "gtin_match":"exact|different|absent|unknown",
             "variant_match":"match|mismatch|unknown",
             "market_match":"match|mismatch|unknown"}],
 "abgelehnt":[{"url":"...","grund":"warum diese Adresse NICHT genommen wird"}],
 "hinweis":null}`;

const RANG: Record<string, number> = {
  manufacturer_product_page: 1,
  manufacturer_datasheet: 2,
  manufacturer_subpage: 3,
  product_database: 4,
  retailer_page: 5,
  aggregator: 6,
  label_photo: 7,
  other: 9,
};

/* ------------------------------------------------------------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const t0 = Date.now();
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const antwort = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  const protokoll: string[] = [];
  let kostenGesamt = 0;

  try {
    // E40 (Ralph, 04.09.2026): Der Orchestrator ist der teuerste Weg (0,27 USD je
    // Lauf) und eingefroren, bis ein kostenloser Weg gemessen ist. Der Schalter
    // liegt in Riki_Config.orchestrator_an; hier wird nur gefragt. Laesst sich
    // der Schalter nicht lesen, ist das ein Stopp - im Zweifel gesperrt.
    const frei = await sb.rpc("cb_riki_orchestrator_erlaubt");
    if (frei.error) return antwort({ error: "Schalter nicht lesbar - Orchestrator gesperrt: " + frei.error.message, edge_version: EDGE_VERSION }, 423);
    if (frei.data?.erlaubt !== true) return antwort({ error: String(frei.data?.grund ?? "Orchestrator gesperrt (E40)."), eingefroren: true, edge_version: EDGE_VERSION }, 423);

    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return antwort({ error: "Bitte anmelden." }, 401);

    // Beta-Riegel wie bei riki-research: Websuche kostet Geld, das zahlt nicht irgendwer.
    const { data: istAdmin } = await sb.rpc("cb_ist_admin");
    if (istAdmin !== true) return antwort({ error: "Der Orchestrator ist in der Erprobung nur fuer Admins." }, 403);

    let body: any = {}; try { body = await req.json(); } catch {}
    const modus = String(body.modus ?? "voll").trim();
    const modell = String(body.modell ?? STANDARD_MODELL).trim();
    if (!PREISE[modell]) return antwort({ error: "Unbekanntes Modell: " + modell }, 400);

    /* v3: Modelleskalation. Standardmaessig AUS - sie wird bewusst eingeschaltet,
       damit ein bestehender Aufruf sich nicht ploetzlich anders verhaelt. */
    const eskalationAn = body.eskalation === true || body.eskalation === "an";
    const modellEskalation = String(body.modell_eskalation ?? STANDARD_MODELL_ESKALATION).trim();
    if (eskalationAn && !PREISE[modellEskalation]) {
      return antwort({ error: "Unbekanntes Eskalationsmodell: " + modellEskalation }, 400);
    }
    if (eskalationAn && modellEskalation === modell) {
      return antwort({ error: "Eskalationsmodell ist dasselbe wie Stufe 1 - das waere nur ein zweiter Aufruf ohne Nutzen." }, 400);
    }
    const eskalationen: any[] = [];
    const maxQuellen = Math.min(Math.max(Number(body.max_quellen ?? MAX_QUELLEN), 1), 12);

    const key = findeKey();
    if (!key) return antwort({ error: "Kein Anthropic-Key hinterlegt." }, 500);

    const basisUrl = Deno.env.get("SUPABASE_URL")!;

    /* --- Hilfsfunktionen ------------------------------------------------ */

    // Das Modell suchen lassen. Es bekommt nur den Auftrag, nie die Aufgabe zu extrahieren.
    const sucheQuellen = async (auftrag: string, luecken: string[]) => {
      const ai = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: modell, max_tokens: 2500,
          ...(OHNE_TEMPERATURE.has(modell) ? {} : { temperature: 0 }),
          system: [{ type: "text", text: SUCH_REGEL, cache_control: { type: "ephemeral" } }],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
          messages: [{ role: "user", content:
            `PRODUKT: ${auftrag}\n` +
            (luecken.length ? `AUSDRUECKLICH GESUCHT (diese Bereiche fehlen noch): ${luecken.join(", ")}\n` : "") +
            `Finde die Adressen. Nichts auslesen.` }],
        }),
      });
      const j = await ai.json();
      const usage: any = j?.usage ?? {};
      const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
      const outTok = usage.output_tokens ?? 0;
      const suchen = usage.server_tool_use?.web_search_requests ?? 0;
      const p = PREISE[modell];
      const k = (inTok / 1e6) * p.in + (outTok / 1e6) * p.out + suchen * WEBSUCHE_PREIS;
      kostenGesamt += k;
      if (!ai.ok) { protokoll.push("Quellensuche fehlgeschlagen: " + JSON.stringify(j).slice(0, 200)); return { quellen: [], abgelehnt: [] }; }
      const txt = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      try { const m = txt.match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : txt); }
      catch {
        // v4 (438-1): nicht nur "kein JSON" - sondern WAS kam. Sonst bleibt der Fehler unsichtbar.
        protokoll.push("Quellensuche lieferte kein JSON. Antwort begann mit: " + txt.replace(/\s+/g, " ").slice(0, 200));
        return { quellen: [], abgelehnt: [] };
      }
    };

    // Quellen planen: Domainrolle serverseitig erfragen, dann sortiert ablegen.
    const planeQuellen = async (researchId: number, productId: string, gefunden: any) => {
      const liste: any[] = Array.isArray(gefunden?.quellen) ? gefunden.quellen : [];
      const bewertet: any[] = [];
      const gesehen = new Set<string>();

      for (const q of liste) {
        const url = String(q?.url ?? "").trim();
        if (!/^https?:\/\//i.test(url) || gesehen.has(url)) continue;
        gesehen.add(url);
        let rolle: any = null;
        try {
          const w = await sb.rpc("cb_riki_quellenwahl", { p_product_id: productId, p_source_url: url });
          rolle = w.data ?? null;
        } catch (_e) { /* keine belegte Rolle - nicht raten */ }
        const typ = String(q?.source_type ?? "other");
        // Belegte Herstellerdomain sticht die Typangabe des Modells (#233: 10 von 11 waren Haendler).
        const rang = rolle?.decision === "authoritative_source" ? 0 : (RANG[typ] ?? 9);
        bewertet.push({ url, typ, rang, rolle, q });
      }

      bewertet.sort((a, b) => a.rang - b.rang);
      const geplant: any[] = [];
      for (const b of bewertet.slice(0, maxQuellen)) {
        const r = await sb.rpc("cb_riki_research_quelle_setzen", {
          p_research_id: researchId, p_source_type: b.typ, p_evaluation: "planned", p_url: b.url,
          p_gtin_match: String(b.q?.gtin_match ?? "unknown"),
          p_variant_match: String(b.q?.variant_match ?? "unknown"),
          p_market_match: String(b.q?.market_match ?? "unknown"),
          p_evidence: { begruendung: String(b.q?.begruendung ?? "").slice(0, 500),
                        gtin_auf_der_seite: b.q?.gtin_auf_der_seite ?? null,
                        domainrolle: b.rolle ?? null, rang: b.rang },
        });
        if (!r.error) geplant.push({ research_source_id: Number(r.data), url: b.url, typ: b.typ, rang: b.rang });
      }

      // Abgelehnte Adressen bekommen ihren Grund - sonst fehlt genau diese Information spaeter.
      for (const a of (Array.isArray(gefunden?.abgelehnt) ? gefunden.abgelehnt : []).slice(0, 10)) {
        const url = String(a?.url ?? "").trim();
        const grund = String(a?.grund ?? "").trim();
        if (!/^https?:\/\//i.test(url) || !grund) continue;
        await sb.rpc("cb_riki_research_quelle_setzen", {
          p_research_id: researchId, p_source_type: "other", p_evaluation: "rejected",
          p_url: url, p_reject_reason: grund.slice(0, 500), p_evidence: { phase: "quellensuche" },
        });
      }
      return geplant;
    };

    // Eine geplante Quelle lesen lassen - durch den Extractor, nicht hier.
    const leseQuelle = async (researchSourceId: number, url: string, typ: string, productId: string, auftrag: string, zielGtin: string | null) => {
      const sourceKind = sourceKindVon(typ);

      // v4 (438-4): fremde GTIN in der Adresse - gar nicht erst lesen.
      const urlGtin = gtinAusUrl(url);
      if (zielGtin && urlGtin && urlGtin !== zielGtin) {
        await sb.rpc("cb_riki_research_quelle_abschliessen", {
          p_research_source_id: researchSourceId, p_evaluation: "rejected",
          p_reject_reason: `Adresse fuehrt GTIN ${urlGtin}, gesucht ist ${zielGtin}. Andere GTIN heisst anderes Produkt - nicht gelesen.`,
          p_gtin_match: "different",
          p_evidence: { gtin_in_adresse: urlGtin, vor_dem_lesen: true } });
        protokoll.push(`Quelle abgelehnt vor dem Lesen (fremde GTIN ${urlGtin} in der Adresse): ${url}`);
        return null;
      }
      // v3: ein Lesevorgang mit einem bestimmten Modell. Wird bei Eskalation
      // ein zweites Mal aufgerufen - mit demselben Text, anderem Leser.
      const einLauf = async (modellName: string) => {
        const r = await fetch(`${basisUrl}/functions/v1/riki-quelle-lesen`, {
          method: "POST",
          headers: { "Authorization": authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url, product_id: productId, source_kind: sourceKind, auftrag, modell: modellName }),
        });
        return await r.json();
      };

      let res: any = null;
      let modellGenutzt = modell;
      try {
        res = await einLauf(modell);
      } catch (e) {
        await sb.rpc("cb_riki_research_quelle_abschliessen", {
          p_research_source_id: researchSourceId, p_evaluation: "unreachable",
          p_evidence: { fehler: String((e as any)?.message ?? e).slice(0, 300) } });
        protokoll.push(`Quelle nicht erreichbar: ${url}`);
        return null;
      }

      if (res?.error) {
        await sb.rpc("cb_riki_research_quelle_abschliessen", {
          p_research_source_id: researchSourceId, p_evaluation: "unreachable",
          p_evidence: { fehler: String(res.error).slice(0, 300) } });
        protokoll.push(`Quelle fehlerhaft: ${url} — ${String(res.error).slice(0, 120)}`);
        return null;
      }
      if (res?.leer) {
        await sb.rpc("cb_riki_research_quelle_abschliessen", {
          p_research_source_id: researchSourceId, p_evaluation: "empty",
          p_evidence: { grund: res.grund ?? null, hinweis: res.hinweis ?? null } });
        // Auch das gehoert in den Plan: eine Adresse, die dreimal nichts liefert,
        // wird kuenftig nicht mehr vorgeschlagen.
        await sb.rpc("cb_riki_quellenplan_merken", {
          p_product_id: productId, p_url: url, p_source_type: typ,
          p_evaluation: "empty", p_items: 0, p_note: String(res.grund ?? "leer") });
        protokoll.push(`Quelle ohne verwertbare Daten: ${url}`);
        return null;
      }

      /* v3: Modelleskalation. Der Leser hat gemeldet, ob sein Befund Anlass gibt.
         Eskaliert wird NUR, wenn ein staerkeres Modell ueberhaupt helfen kann -
         bei "hilft: quelle" fehlen die Daten auf der Seite, nicht im Leser. */
      const q1 = res?.qualitaet ?? null;

      /* v3.2: Ist dieser Lauf bereits verworfen, wurde die Quelle in diesem
         Durchgang schon einmal eskaliert. cb_riki_source_extraction_speichern
         gibt bei gleichem Inhalt denselben Lauf zurueck - liest der Orchestrator
         dieselbe Adresse ein zweites Mal, landet er wieder auf dem verworfenen
         Lauf und wuerde erneut eskalieren. Gemessen am 25.08.2026: Lauf 175
         wurde zweimal verworfen, es entstanden zwei gueltige Opus-Befunde
         (188 und 189) zur selben Quelle - genau das Nebeneinander, das dieser
         Weg verhindern soll. */
      let schonEskaliert = false;
      if (eskalationAn && res?.run_id) {
        const vorher = await sb.from("source_extraction_run").select("status").eq("run_id", res.run_id).maybeSingle();
        if (!vorher.error && vorher.data?.status === "rejected") {
          schonEskaliert = true;
          protokoll.push(`Quelle bereits eskaliert, kein zweiter Opus-Lauf: ${url}`);
          eskalationen.push({ url, ergebnis: "bereits_eskaliert", run_alt: res.run_id });
        }
      }

      if (eskalationAn && !schonEskaliert && q1?.eskalation_empfohlen === true && q1?.hilft === "modell") {
        const gruende = (Array.isArray(q1.befunde) ? q1.befunde : []).map((x: any) => x?.code).filter(Boolean);
        protokoll.push(`Eskalation ${modell} → ${modellEskalation}: ${gruende.join(", ")} (${url})`);
        let res2: any = null;
        try { res2 = await einLauf(modellEskalation); } catch (_e) { res2 = null; }

        const zweiterTaugt = res2 && !res2.error && !res2.leer && res2.run_id;
        if (zweiterTaugt) {
          // Der erste Lauf wird verworfen - nicht danebengestellt (#252).
          const v = await sb.rpc("cb_riki_source_extraction_verwerfen", {
            p_run_id: res.run_id,
            p_grund: `Modelleskalation ${modell} → ${modellEskalation}. Befunde: ${gruende.join(", ")}.`,
            p_ersetzt_durch_run_id: res2.run_id,
          });
          if (v.error) {
            // Verwerfen misslungen: dann bleibt Stufe 1 gueltig. Zwei gueltige
            // Befunde zur selben Quelle sind schlimmer als ein schwaecherer.
            protokoll.push(`Eskalation zurueckgenommen - Lauf ${res.run_id} nicht verwerfbar: ${v.error.message}`);
            eskalationen.push({ url, von: modell, nach: modellEskalation, gruende,
                                ergebnis: "zurueckgenommen", fehler: v.error.message });
          } else {
            kostenGesamt += Number(res?.meta?.kosten_usd ?? 0);   // Stufe 1 ist bezahlt, auch wenn verworfen
            eskalationen.push({ url, von: modell, nach: modellEskalation, gruende,
                                ergebnis: "ersetzt", run_alt: res.run_id, run_neu: res2.run_id,
                                kosten_stufe1: res?.meta?.kosten_usd ?? null,
                                kosten_stufe2: res2?.meta?.kosten_usd ?? null,
                                qualitaet_nachher: res2?.qualitaet ?? null });
            res = res2;
            modellGenutzt = modellEskalation;
          }
        } else {
          protokoll.push(`Eskalation ohne Ergebnis - Stufe 1 bleibt gueltig (${url})`);
          eskalationen.push({ url, von: modell, nach: modellEskalation, gruende, ergebnis: "ohne_ergebnis" });
        }
      } else if (eskalationAn && q1?.eskalation_empfohlen === true && q1?.hilft === "quelle") {
        protokoll.push(`Keine Modelleskalation: die Quelle traegt die Daten nicht, eine andere Adresse ist faellig (${url})`);
        eskalationen.push({ url, von: modell, nach: null, ergebnis: "quelle_statt_modell",
                            gruende: (Array.isArray(q1.befunde) ? q1.befunde : []).map((x: any) => x?.code).filter(Boolean) });
      }

      // GTIN-Abgleich: eine andere GTIN ist ein anderes Produkt.
      // v4: die GTIN aus der Adresse zaehlt, wenn das Modell keine gelesen hat.
      const quelleGtin = eanOk(res?.identitaet_der_quelle?.gtin) ?? urlGtin;
      let gtinMatch = "unknown";
      if (zielGtin && quelleGtin) gtinMatch = (zielGtin === quelleGtin) ? "exact" : "different";
      else if (zielGtin && !quelleGtin) gtinMatch = "absent";

      if (gtinMatch === "different") {
        await sb.rpc("cb_riki_research_quelle_abschliessen", {
          p_research_source_id: researchSourceId, p_evaluation: "rejected",
          p_reject_reason: `Seite fuehrt GTIN ${quelleGtin}, gesucht ist ${zielGtin}. Andere GTIN heisst anderes Produkt.`,
          p_gtin_match: "different",
          p_evidence: { run_id: res.run_id ?? null, identitaet_der_quelle: res.identitaet_der_quelle ?? {} } });
        // v4 (438-4): der Lauf ist bereits gespeichert - er wird verworfen, nicht
        // stehen gelassen. Sonst liegen 17 Items eines fremden Produkts unter dieser ID.
        if (res?.run_id) {
          const v = await sb.rpc("cb_riki_source_extraction_verwerfen", {
            p_run_id: res.run_id,
            p_grund: `Fremde GTIN ${quelleGtin} (gesucht ${zielGtin}) - Befund gehoert zu einem anderen Produkt.`,
            p_ersetzt_durch_run_id: null });
          if (v.error) protokoll.push(`Lauf ${res.run_id} nicht verwerfbar: ${v.error.message}`);
        }
        protokoll.push(`Quelle abgelehnt (fremde GTIN ${quelleGtin}): ${url}` + (res?.run_id ? ` - Lauf ${res.run_id} verworfen` : ""));
        return null;
      }

      await sb.rpc("cb_riki_research_quelle_abschliessen", {
        p_research_source_id: researchSourceId, p_evaluation: "used",
        p_extraction_run_id: res.run_id, p_gtin_match: gtinMatch,
        p_evidence: { identitaet_der_quelle: res.identitaet_der_quelle ?? {}, zaehler: res.zaehler ?? {},
                      source_coverage: res.source_coverage ?? {}, kosten_usd: res?.meta?.kosten_usd ?? null,
                      modell: modellGenutzt, eskaliert: modellGenutzt !== modell,
                      qualitaet: res?.qualitaet ?? null } });
      kostenGesamt += Number(res?.meta?.kosten_usd ?? 0);

      /* Z5b (Ralph-Entscheid 29.08.2026, Variante A): der Schreibweg haengt am
         Orchestrator, nicht mehr nur am Knopf in der Maske (produkteditor.js).
         Genau EIN Schreibweg: cb_riki_fachwerte_persistieren. Hier wird nur
         aufgerufen, nichts nachgebaut. Bedingung: der Lauf steht auf
         'complete' - ein teilweise gelesener Lauf schreibt nicht.
         Die Zeilenauswahl (target_kind gesetzt) trifft die Funktion selbst. */
      if (res?.run_id) {
        const lauf = await sb.from("source_extraction_run")
          .select("status").eq("run_id", res.run_id).maybeSingle();
        if (!lauf.error && lauf.data?.status === "complete") {
          const p = await sb.rpc("cb_riki_fachwerte_persistieren", { p_run_id: res.run_id });
          if (p.error) protokoll.push(`Fachwerte nicht gespeichert (Lauf ${res.run_id}): ${p.error.message}`);
          else if ((p.data as any)?.abgelehnt === true) protokoll.push(`Fachwerte abgelehnt (Lauf ${res.run_id}): ${(p.data as any)?.grund ?? ""}`);
          else protokoll.push(`Fachwerte gespeichert (Lauf ${res.run_id}).`);
        } else if (!lauf.error) {
          protokoll.push(`Fachwerte nicht gespeichert - Lauf ${res.run_id} steht auf ${lauf.data?.status ?? "unbekannt"}, nicht complete.`);
        }
      }

      // #247 Teil B: was belegt gelesen wurde, kommt in den Plan. Beim naechsten
      // Lauf steht es oben und muss nicht neu gesucht werden.
      const gelesene = Object.values(res?.zaehler ?? {}).reduce((a: number, b: any) => a + Number(b || 0), 0);
      await sb.rpc("cb_riki_quellenplan_merken", {
        p_product_id: productId, p_url: url, p_source_type: typ,
        p_evaluation: "used", p_items: gelesene,
        p_note: `Recherche ${researchSourceId}.`,
      });

      protokoll.push(`Quelle gelesen: ${url} (${gelesene} Eintraege)`);
      return res;
    };

    // Welche Bereiche fehlen noch? Das ist die Lueckenjagd, Phase D.
    const luecken = async (researchId: number): Promise<string[]> => {
      const c = await sb.rpc("cb_riki_research_coverage_erheben", { p_research_id: researchId });
      if (c.error) { protokoll.push("Coverage nicht berechenbar: " + c.error.message); return []; }
      const cov = (c.data as any)?.coverage ?? {};
      const offen: string[] = [];
      for (const [bereich, v] of Object.entries<any>(cov)) {
        if (bereich === "classification") continue; // wird fachlich entschieden, nicht recherchiert
        if (v?.coverage === "none" || v?.coverage === "partial") offen.push(bereich);
      }
      return offen;
    };

    /* --- MODUS: start --------------------------------------------------- */
    let researchId: number | null = body.research_id ? Number(body.research_id) : null;
    let productId = String(body.product_id ?? "").trim();
    let auftrag = "";
    let zielGtin: string | null = null;

    const ladeKopf = async (id: number) => {
      const b = await sb.rpc("cb_riki_research_bundle", { p_research_id: id });
      if (b.error) throw new Error("Recherche nicht lesbar: " + b.error.message);
      const d: any = b.data;
      productId = String(d?.product_id ?? productId);
      const rq = d?.gesuchte_identitaet ?? {};
      zielGtin = eanOk(rq?.gtin);
      auftrag = [rq?.marke, rq?.produktname, rq?.packungsgroesse, zielGtin ? `GTIN ${zielGtin}` : null]
        .filter(Boolean).join(" · ");
      return d;
    };

    if (modus === "start" || modus === "voll") {
      const request = body.request ?? {};
      const produktname = String(request?.produktname ?? "").trim();
      zielGtin = eanOk(request?.gtin);
      if (!produktname && !zielGtin) return antwort({ error: "Der Auftrag braucht mindestens produktname oder eine gueltige GTIN." }, 400);
      if (!productId) return antwort({
        error: "product_id fehlt.",
        hinweis: "Der Extraktionsvertrag verlangt ein Produkt als Ablageort (source_extraction_run.product_id ist Pflichtfeld). Fuer Produkte ohne EAN muss der Datensatz vorher ueber den bestehenden Weg angelegt werden.",
      }, 400);

      const rs = await sb.rpc("cb_riki_research_start", {
        p_request: { ...request, gtin: zielGtin ?? request?.gtin ?? null },
        p_product_id: productId,
        p_run_label: String(body.run_label ?? "").trim() || null,
        p_orchestrator: "riki-orchestrator",
        p_orchestrator_version: EDGE_VERSION,
        p_metadata: { modell, gestartet_von: u.user.email ?? null },
      });
      if (rs.error) return antwort({ error: "Recherche konnte nicht gestartet werden: " + rs.error.message }, 500);
      researchId = Number(rs.data);
      protokoll.push(`Recherche ${researchId} gestartet.`);

      // PHASE A — Identitaet. Bewusst zurueckhaltend: "confirmed" gibt es erst,
      // wenn eine benutzte Quelle die GTIN bestaetigt. Vorher ist es eine Absicht.
      auftrag = [request?.marke, produktname, request?.packungsgroesse, zielGtin ? `GTIN ${zielGtin}` : null]
        .filter(Boolean).join(" · ");

      await sb.rpc("cb_riki_research_kandidat_setzen", {
        p_research_id: researchId, p_decision: "pending",
        p_gtin: zielGtin, p_product_name: produktname || null,
        p_brand: String(request?.marke ?? "").trim() || null,
        p_package_size: String(request?.packungsgroesse ?? "").trim() || null,
        p_market: String(request?.markt ?? "").trim() || null,
        p_source_url: String(request?.url ?? "").trim() || null,
        p_reason: "Suchauftrag, noch durch keine Quelle bestaetigt.",
        p_evidence: { phase: "A", gtin_pruefziffer: zielGtin ? "gueltig" : "keine oder ungueltig" },
      });

      if (request?.gtin && !zielGtin) {
        await sb.rpc("cb_riki_research_kandidat_setzen", {
          p_research_id: researchId, p_decision: "rejected",
          p_gtin: String(request.gtin), p_product_name: produktname || null,
          p_reason: "Ziffernfolge besteht die EAN-Pruefziffer nicht - als GTIN verworfen.",
          p_evidence: { phase: "A" },
        });
        protokoll.push("Uebergebene GTIN war keine gueltige EAN - verworfen, nicht korrigiert.");
      }

      await sb.rpc("cb_riki_research_identity_setzen", {
        p_research_id: researchId,
        p_identity_status: (zielGtin || produktname) ? "probable" : "insufficient",
        p_product_identity: {
          product_name: produktname || null,
          brand: String(request?.marke ?? "").trim() || null,
          gtin: zielGtin,
          package_size: String(request?.packungsgroesse ?? "").trim() || null,
          market: String(request?.markt ?? "").trim() || null,
          quelle_der_identitaet: "Suchauftrag - noch nicht durch eine Quelle bestaetigt",
        },
      });

      // PHASE B — PFLICHTKASKADE ZUERST (#247 A). Gesucht wird erst, wenn der
      // bekannte Bestand nicht reicht. Eine Suche liefert bei jedem Aufruf
      // andere Treffer; ein Plan aus dem Bestand tut das nicht.
      const geplant: any[] = [];
      const schonGeplant = new Set<string>();

      const plane = async (url: string, typ: string, herkunft: string, begruendung: string) => {
        const u = String(url ?? "").trim();
        if (!/^https?:\/\//i.test(u) || schonGeplant.has(u)) return;
        schonGeplant.add(u);
        const r = await sb.rpc("cb_riki_research_quelle_setzen", {
          p_research_id: researchId, p_source_type: typ, p_evaluation: "planned", p_url: u,
          p_evidence: { herkunft, begruendung },
        });
        if (!r.error) geplant.push({ research_source_id: Number(r.data), url: u, typ, rang: 0 });
      };

      // Rang 0: was Ralph im Aufruf ausdruecklich mitgibt, schlaegt alles andere.
      const direkt = String(request?.url ?? "").trim();
      if (/^https?:\/\//i.test(direkt)) {
        await plane(direkt, "manufacturer_product_page", "auftrag", "Vom Auftraggeber mitgegeben.");
      }

      // Rang 1 bis 3: Produktstamm, bewaehrte Quellen, GTIN-Direktadresse.
      const planAntwort = await sb.rpc("cb_riki_quellenplan", { p_product_id: productId });
      const plan: any = planAntwort.data ?? {};
      if (planAntwort.error) {
        protokoll.push("Quellenplan nicht lesbar: " + planAntwort.error.message);
      } else {
        for (const q of (plan?.quellen ?? [])) {
          await plane(String(q.url), String(q.source_type ?? "other"), String(q.origin ?? "plan"), String(q.begruendung ?? ""));
        }
        protokoll.push(`Pflichtkaskade: ${geplant.length} bekannte Quellen (ohne Suche, ohne Kosten).`);
      }

      // Rang 9: gesucht wird nur, wenn die Kaskade nichts oder zu wenig hergab.
      // Das spart nicht nur Geld, es ist der eigentliche Grund fuer #247:
      // was nicht gesucht wird, kann auch nicht bei jedem Lauf anders ausfallen.
      if (geplant.length === 0) {
        protokoll.push("Kaskade leer - Websuche noetig.");
        const gefunden = await sucheQuellen(auftrag, []);
        const ausSuche = await planeQuellen(researchId, productId, gefunden);
        for (const g of ausSuche) { schonGeplant.add(g.url); geplant.push(g); }
        protokoll.push(`${ausSuche.length} Quellen aus der Websuche.`);
      } else {
        protokoll.push("Websuche uebersprungen - der bekannte Bestand reicht als Start. Luecken werden spaeter gezielt gesucht.");
      }

      if (modus === "start") {
        return antwort({ ok: true, research_id: researchId, phase: "A+B abgeschlossen",
          identitaet: "probable", geplante_quellen: geplant, protokoll,
          kosten_usd: Number(kostenGesamt.toFixed(6)), dauer_ms: Date.now() - t0 });
      }
    }

    if (!researchId) return antwort({ error: "research_id fehlt." }, 400);
    // Ab hier steht die Nummer fest. Als const, damit sie in den Schleifen und
    // Closures nicht mehr "vielleicht null" ist.
    const rid: number = researchId;
    if (modus === "schritt" || modus === "abschluss") await ladeKopf(rid);

    /* --- MODUS: schritt / voll ------------------------------------------ */
    if (modus === "schritt" || modus === "voll") {
      let nachsuchen = 0;
      let gelesen = 0;

      while (Date.now() - t0 < ZEITBUDGET_MS) {
        // Der Stand kommt aus dem Bundle, nicht aus einer eigenen Tabellenabfrage:
        // shadow_v1 ist bewusst nur ueber die RPCs erreichbar.
        const bundle: any = (await sb.rpc("cb_riki_research_bundle", { p_research_id: rid })).data;
        const geplantJetzt = (bundle?.quellen ?? []).filter((q: any) => q.bewertung === "planned")
          .sort((a: any, b: any) => a.reihenfolge - b.reihenfolge);

        if (!geplantJetzt.length) {
          const offen = await luecken(rid);
          if (!offen.length || nachsuchen >= MAX_NACHSUCHEN) break;
          nachsuchen += 1;
          protokoll.push(`Luecken offen (${offen.join(", ")}) - gezielte Nachsuche ${nachsuchen}.`);
          const mehr = await sucheQuellen(auftrag, offen);
          const neu = await planeQuellen(rid, productId, mehr);
          if (!neu.length) { protokoll.push("Nachsuche fand keine weitere Quelle."); break; }
          continue;
        }

        const q = geplantJetzt[0];
        await leseQuelle(Number(q.research_source_id), String(q.url), String(q.quellentyp), productId, auftrag, zielGtin);
        gelesen += 1;
        if (gelesen >= maxQuellen) break;

        const offen = await luecken(rid);
        if (!offen.length) { protokoll.push("Alle Bereiche belegt - Suche beendet."); break; }
      }

      if (modus === "schritt") {
        const offen = await luecken(rid);
        return antwort({ ok: true, research_id: rid, phase: "C+D",
          gelesene_quellen: gelesen, offene_bereiche: offen, protokoll,
          eskalation: { aktiv: eskalationAn, stufe1: modell, stufe2: eskalationAn ? modellEskalation : null,
                        vorgaenge: eskalationen },
          kosten_usd: Number(kostenGesamt.toFixed(6)), dauer_ms: Date.now() - t0 });
      }
    }

    /* --- MODUS: abschluss / voll ---------------------------------------- */
    // PHASE F — Quellenvergleich. Rechnet der Server, nicht das Modell.
    const vgl = await sb.rpc("cb_riki_research_quellenvergleich_erheben", { p_research_id: rid });
    if (vgl.error) protokoll.push("Quellenvergleich fehlgeschlagen: " + vgl.error.message);

    // #248: ERST die Identitaet bewerten, DANN die Coverage rechnen.
    // In v1 lief es andersherum - eine Recherche mit exakt bestaetigter GTIN
    // meldete deshalb trotzdem "identity offen", und research_complete konnte
    // nie true werden.
    const bundle: any = (await sb.rpc("cb_riki_research_bundle", { p_research_id: rid })).data;
    const benutzte = (bundle?.quellen ?? []).filter((q: any) => q.bewertung === "used");
    const bestaetigt = benutzte.find((q: any) => q.gtin_treffer === "exact");
    if (bestaetigt) {
      await sb.rpc("cb_riki_research_identity_setzen", {
        p_research_id: rid, p_identity_status: "confirmed",
        p_product_identity: { ...(bundle?.identitaet?.werte ?? {}),
          quelle_der_identitaet: bestaetigt.url, beleg: "GTIN auf der Quelle stimmt exakt ueberein" },
      });
      await sb.rpc("cb_riki_research_kandidat_setzen", {
        p_research_id: rid, p_decision: "accepted",
        p_gtin: zielGtin, p_product_name: (bundle?.identitaet?.werte ?? {})?.product_name ?? null,
        p_source_url: bestaetigt.url, p_reason: "GTIN durch eine benutzte Quelle exakt bestaetigt.",
        p_evidence: { phase: "H" },
      });
      protokoll.push("Identitaet bestaetigt (GTIN auf der Quelle).");
    }

    // v4 (438-2): STATION QUELLE schreiben. Je Quellenart eine Zeile in
    // product_source_state - eindeutig mit der ersten benutzten Adresse, sonst
    // nicht_gefunden mit den Kandidaten und ihrem Grund. Vorher stand hier
    // nichts, und der Rauchtest sah 0 Zeilen trotz 8 gelesener Quellen.
    try {
      const alleQ: any[] = Array.isArray(bundle?.quellen) ? bundle.quellen : [];
      const arten = new Set<string>(alleQ.filter((q: any) => q.quellentyp && q.quellentyp !== "other").map((q: any) => sourceKindVon(String(q.quellentyp))));
      for (const art of arten) {
        const dieser = alleQ.filter((q: any) => sourceKindVon(String(q.quellentyp ?? "other")) === art);
        const treffer = dieser.find((q: any) => q.bewertung === "used");
        const kandidaten = dieser.slice(0, 10).map((q: any) => ({ url: q.url, bewertung: q.bewertung, gtin: q.gtin_treffer ?? null, grund: q.ablehnungsgrund ?? null }));
        const r = await sb.rpc("cb_riki_quelle_status_setzen", {
          p_product_id: productId, p_source_kind: art,
          p_discovery_status: treffer ? "eindeutig" : "nicht_gefunden",
          p_source_ref: treffer ? treffer.url : null,
          p_candidates: kandidaten,
          p_note: treffer ? `Orchestrator v${EDGE_VERSION}, Recherche ${rid}: benutzt, GTIN ${treffer.gtin_treffer ?? "unknown"}` : `Orchestrator v${EDGE_VERSION}, Recherche ${rid}: ${dieser.length} Adressen, keine benutzbar`,
          p_evidence: { research_id: rid, extraction_run_id: treffer?.extraction_run_id ?? null } });
        if (r.error) protokoll.push(`Station Quelle (${art}) nicht geschrieben: ${r.error.message}`);
      }
      if (arten.size) protokoll.push(`Station Quelle geschrieben: ${[...arten].join(", ")}.`);
    } catch (e) { protokoll.push("Station Quelle: " + String((e as any)?.message ?? e).slice(0, 200)); }

    // Jetzt erst rechnen - mit dem aktuellen Identitaetsstand.
    const offen = await luecken(rid);

    // PHASE H — Abschluss. "Fertig" ist hier eine Messung, keine Absicht.
    const vollstaendig = offen.length === 0;
    const begruendung = vollstaendig
      ? `Alle geprueften Bereiche belegt; ${benutzte.length} Quellen benutzt.`
      : `Offen geblieben: ${offen.join(", ")}. ${benutzte.length} Quellen benutzt, keine weitere passende Quelle gefunden.`;

    const ab = await sb.rpc("cb_riki_research_abschliessen", {
      p_research_id: rid, p_research_complete: vollstaendig, p_reason: begruendung });

    if (ab.error) {
      // Der Riegel hat gegriffen - das ist kein Fehler, sondern die Regel bei der Arbeit.
      protokoll.push("Abschluss abgelehnt: " + ab.error.message);
      await sb.rpc("cb_riki_research_abschliessen", {
        p_research_id: rid, p_research_complete: false,
        p_reason: "Nicht abschliessbar: " + ab.error.message.slice(0, 300) });
    }

    await sb.rpc("cb_riki_buchen", { p_modus: "orchestrator", p_modell: modell, p_in: 0, p_out: 0,
      p_kosten: Number(kostenGesamt.toFixed(6)), p_produkt_id: productId, p_erfolg: true, p_fehler: null });

    const fertig: any = (await sb.rpc("cb_riki_research_bundle", { p_research_id: rid })).data;

    return antwort({
      ok: true,
      research_id: rid,
      research_complete: fertig?.research_complete ?? false,
      begruendung: fertig?.begruendung ?? begruendung,
      identitaet: fertig?.identitaet ?? null,
      structure_hash: fertig?.structure_hash ?? null,
      benutzte_quellen: benutzte.length,
      offene_bereiche: offen,
      konflikte: (vgl.data as any)?.konflikte ?? null,
      protokoll,
      hinweis: "Recherche gesammelt und belegt. Kein Produktfeld wurde veraendert. Pruefpunkt: cb_riki_research_bundle(" + rid + ").",
      eskalation: { aktiv: eskalationAn, stufe1: modell, stufe2: eskalationAn ? modellEskalation : null,
                    vorgaenge: eskalationen },
      meta: { modell, kosten_usd: Number(kostenGesamt.toFixed(6)), dauer_ms: Date.now() - t0, edge_version: EDGE_VERSION },
    });
  } catch (e) {
    return antwort({ error: String(e), protokoll }, 500);
  }
});
