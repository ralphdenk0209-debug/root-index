// RIKI-REZEPT-VORSCHLAG — aus vorhandenen Zutaten Rezeptvorschläge, die zum Kalorienbedarf passen.
//
// Feature 2 (Ralph 23.07.2026): Nutzer wählt/tippt Zutaten, die er zuhause hat → Riki schlägt
// mehrere Gerichte vor, die überwiegend DIESE Zutaten nutzen und deren Portion sinnvoll zum
// Tages-Kalorienziel passt.
//
// Gebaut nach dem Muster von riki-rezept/riki-etikett:
//   - Auth + Tageslimit/Budget-Bremse VOR dem Aufruf (kostet Geld)
//   - Riki SCHLÄGT VOR, entscheidet nicht. Der Nutzer wählt und speichert selbst.
//
// 16.11.2026 (Ralph, „650 kcal meine ich pro Portion“): neues Feld "kcal_portion" = Ziel pro
// Portion. Riki bekommt vorher die Katalog-Nährwerte der genannten Zutaten (Spickzettel), muss
// für jede Zutat Gramm angeben, und der Server ordnet danach jede Zutat über cb_zutat_zuordnen
// (derselbe Weg wie beim Rezeptfoto) dem Katalog zu und rechnet die kcal pro Portion aus den
// Katalogwerten nach. Liegt das mehr als 12 % neben dem Ziel, werden die Mengen anteilig
// angepasst (nur wenn die Zutaten mit Nährwerten fast alles abdecken). Alte App-Fassungen, die
// noch "kcal_tag" schicken, laufen weiter: das Ziel pro Portion wird dann wie bisher aus dem
// Tagesbedarf abgeleitet (Anteil je Mahlzeit).
//
// EHRLICHKEIT: Die kcal-Angabe eines Vorschlags ist eine SCHÄTZUNG (klar so benannt) — kein
// gemessener Wert. Der echte Root-Index-Wert entsteht erst, wenn der Nutzer den Vorschlag als
// Rezept speichert und jede Zutat einem bewerteten Produkt zugeordnet ist (bestehende Logik).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 13.11.2026 (N1, Ralph „Ja, so bauen“): Standard Sonnet 5.5. claude-sonnet-5 = Ziel der
// server-seitigen Ausweichschaltung (fallbacks: "default"), gleicher Preis.
const STANDARD_MODELL = "claude-sonnet-5-5";
const PREISE: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5-5": { in: 2.0, out: 10.0 },
  "claude-sonnet-5": { in: 2.0, out: 10.0 },
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-api")) return off.trim();
  for (const v of Object.values(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-api")) return v.trim();
  }
  return null;
}

const REGELWERK = `Du bist RIKI, der Rezept-Ideengeber von Root Index.

AUFGABE: Aus einer Liste von Zutaten, die der Nutzer ZUHAUSE HAT, schlägst du mehrere machbare
Gerichte vor, deren Portion das Kalorienziel pro Portion des Nutzers trifft.

OBERSTE REGELN:
1. NUTZE ÜBERWIEGEND DIE GENANNTEN ZUTATEN. Erfinde kein Gericht, das hauptsächlich aus Dingen
   besteht, die der Nutzer nicht genannt hat. Wenige Grund-/Vorratszutaten (Salz, Pfeffer, Wasser,
   Öl, gängige Gewürze) darfst du ergänzen — markiere sie mit "aus_vorrat": false und liste sie
   zusätzlich in "extra_zutaten". Alles, was der Nutzer genannt hat: "aus_vorrat": true.
2. KEINE GESUNDHEITS-/WIRKVERSPRECHEN. Beschreibe das Gericht sachlich, nicht "gesund", "entgiftend" o. ä.
3. Die kcal-Angabe ist eine EHRLICHE SCHÄTZUNG pro Portion. Gib sie an, aber verstehe: es ist ein
   Richtwert, keine Messung. Übertreibe keine Genauigkeit (runde auf ~10 kcal).
4. Mach die Vorschläge VERSCHIEDEN (nicht dreimal dasselbe mit anderem Namen).
5. JEDER VORSCHLAG BRAUCHT EINE ECHTE ANLEITUNG zum Nachkochen (siehe ZUBEREITUNG).

ZUBEREITUNG ("zubereitung"): nummerierte Schritte, je Schritt eine eigene Zeile, getrennt durch
einen Zeilenumbruch (\n), Form "1. …", "2. …". 4 bis 10 Schritte. Jeder Schritt ist eine konkrete
Handlung mit Hitze/Stufe und Zeit, wo es darauf ankommt (z. B. "3. Öl in einer Pfanne bei mittlerer
Hitze erhitzen, Zwiebel 3–4 Minuten glasig dünsten."). JEDE Zutat aus "zutaten" kommt in mindestens
einem Schritt vor, mit ihrer Menge beim ersten Auftauchen. Kein Einleitungssatz, kein Fazit, keine
Gesundheitsversprechen.

KALORIEN-PASSUNG:
- "Ziel pro Portion" ist die Kalorienmenge, die EINE Portion des Gerichts haben soll. Plane die Mengen
  so, dass eine Portion möglichst genau dieses Ziel trifft (höchstens ±10 % daneben).
- Rechne mit den Katalogwerten aus dem SPICKZETTEL (kcal je 100 g). Wo keiner steht, schätze ehrlich.
- "kcal_geschaetzt" = deine Rechnung für EINE Portion.
- Setze "passt_zu_kcal": true, wenn die Portion im Rahmen ±15 % liegt, sonst false.
- Ist kein Ziel gegeben, schätze eine normale Portion und lass "passt_zu_kcal": true.
- Plane für "portionen": 1, außer der Nutzer nennt eine andere Zahl. Die Mengen in "zutaten" gelten
  für ALLE Portionen zusammen.

ZUTATENNAMEN: Steht eine Zutat im SPICKZETTEL, verwende GENAU den Namen links vom Pfeil (z. B.
"Kartoffeln", nicht "festkochende Kartoffeln"). Sonst einfache Grundnamen ohne Marke ("Olivenöl",
"Zwiebel", "Rote Linsen"). Zustand und Schnitt gehören in die Anleitung, nicht in den Namen.

MENGEN: gib je Zutat eine natürliche Menge ("200 g", "1 EL", "2 Stück") UND IMMER "menge_g" (Gramm
bzw. ml der GANZEN Rezeptmenge, Rohgewicht ohne Schale). Bei Stück und Löffeln mit üblichen Werten
umrechnen: 1 Ei ≈ 55 g, 1 Zwiebel ≈ 80 g, 1 Knoblauchzehe ≈ 4 g, 1 Paprika ≈ 150 g, 1 Banane ≈ 120 g,
1 Karotte ≈ 80 g, 1 EL Öl ≈ 10 g, 1 TL Öl ≈ 5 g, 1 EL ≈ 15 g sonst, 1 TL ≈ 5 g sonst, 1 Prise ≈ 0,5 g.
Richte menge_g nach dem Zustand, zu dem der Katalogwert passt: Nudeln, Reis, Getreide und
Hülsenfrüchte mit über 300 kcal je 100 g sind trocken gemeint, mit unter 150 kcal gekocht bzw. aus
der Dose. Die Anleitung nennt dann dieselbe Menge.

ERNÄHRUNGSFORM je Vorschlag NUR aus den tatsächlich verwendeten Zutaten ableiten
(vegan / vegetarisch / omnivor); unsicher -> null. Respektiere eine gewünschte "ernaehrungsform",
falls angegeben (dann nur solche Vorschläge).

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "vorschlaege": [
    {
      "name": string,
      "kurz": string,
      "portionen": number,
      "zeit_min": number|null,
      "ernaehrungsform": "vegan"|"vegetarisch"|"omnivor"|null,
      "kcal_geschaetzt": number|null,   // pro Portion
      "passt_zu_kcal": boolean,
      "zutaten": [ { "name": string, "menge": string|null, "menge_g": number, "aus_vorrat": boolean } ],
      "extra_zutaten": string[],
      "zubereitung": string   // "1. …\n2. …\n3. …" (4–10 Schritte)
    }
  ],
  "hinweis": string|null
}`;


// ---------- 16.11.2026: Katalog-Zuordnung, Gramm, Nachrechnen ----------

type Naehr = { kcal: number | null; protein: number | null; kh: number | null; fett: number | null };
type Treffer = {
  gefunden: boolean; produkt_id?: string; name?: string; marke?: string | null;
  score?: number | null; art?: string; grund?: string; naehr?: Naehr | null; stueck_g?: number | null;
};

// Anteil einer Mahlzeit am Tagesbedarf – nur noch für alte App-Fassungen, die "kcal_tag" schicken.
const MZ_ANTEIL: Record<string, number> = { "Frühstück": 0.25, "Mittagessen": 0.35, "Abendessen": 0.30, "Snack": 0.12 };

// Vorratszutaten, die Riki gern ergänzt – ihre Katalogwerte stehen mit auf dem Spickzettel.
const VORRAT = ["Olivenöl", "Rapsöl", "Butter", "Zwiebel", "Knoblauch", "Salz", "Pfeffer", "Gemüsebrühe"];

// Kurzer Speicher je laufender Funktions-Instanz (Zuordnung ändert sich selten).
const zuordnungCache = new Map<string, { t: number; v: Treffer }>();

const zahl = (x: unknown): number | null => {
  const n = typeof x === "string" ? Number(x.replace(",", ".")) : Number(x);
  return x != null && x !== "" && isFinite(n) ? n : null;
};

async function zuordnen(sb: any, namen: string[]): Promise<Map<string, Treffer>> {
  const aus = new Map<string, Treffer>();
  const offen = [...new Set(namen.map((n) => n.trim()).filter((n) => n.length > 0))];
  const jetzt = Date.now();
  await Promise.all(offen.map(async (n) => {
    const k = n.toLowerCase();
    const c = zuordnungCache.get(k);
    if (c && jetzt - c.t < 10 * 60 * 1000) { aus.set(k, c.v); return; }
    let t: Treffer = { gefunden: false, grund: "Zuordnung nicht erreichbar" };
    try {
      const { data, error } = await sb.rpc("cb_zutat_zuordnen", { p_name: n });
      const r: any = Array.isArray(data) ? data[0] : data;
      if (!error && r) {
        t = r.gefunden
          ? { gefunden: true, produkt_id: r.produkt_id, name: r.name, marke: r.marke ?? null, score: zahl(r.score), art: r.art }
          : { gefunden: false, grund: r.grund ?? "nicht im Katalog" };
      }
    } catch { /* bleibt nicht zugeordnet */ }
    aus.set(k, t);
  }));
  // Nährwerte je 100 g aus derselben Quelle wie Web und App (v_web_produkte).
  const ids = [...new Set([...aus.values()].filter((t) => t.gefunden && t.produkt_id).map((t) => t.produkt_id!))];
  if (ids.length) {
    try {
      const { data } = await sb.from("v_web_produkte").select("id,m_kcal,m_protein,m_kh,m_fett,stueck").in("id", ids);
      const nach = new Map<string, any>((data ?? []).map((r: any) => [r.id, r]));
      for (const t of aus.values()) {
        const r = t.produkt_id ? nach.get(t.produkt_id) : null;
        if (!r) continue;
        t.naehr = { kcal: zahl(r.m_kcal), protein: zahl(r.m_protein), kh: zahl(r.m_kh), fett: zahl(r.m_fett) };
        // Stückgewicht: Größe M, sonst die erste Größe (z. B. Ei).
        const st: any[] = Array.isArray(r.stueck) ? r.stueck : [];
        const m = st.find((x) => /^M\b/.test(String(x?.txt ?? ""))) ?? st[0];
        t.stueck_g = m ? zahl(m.g) : null;
      }
    } catch { /* ohne Nährwerte */ }
  }
  for (const [k, t] of aus) zuordnungCache.set(k, { t: jetzt, v: t });
  return aus;
}

// Übliche Stückgewichte (essbarer Anteil), wenn der Katalog keins hat.
const STUECK_G: [RegExp, number][] = [
  [/^eier?\b|^ei$/i, 55], [/zwiebel/i, 80], [/knoblauch/i, 4], [/paprika/i, 150], [/tomate/i, 100],
  [/banane/i, 120], [/karotte|möhre/i, 80], [/kartoffel/i, 120], [/zucchini/i, 200], [/apfel/i, 150],
  [/zitrone|limette/i, 80], [/gurke/i, 400], [/champignon/i, 20],
];

// "1 TL", "1/2 Paprika", "200 g", "1 Prise" → Gramm. null, wenn nicht eindeutig.
function inGramm(menge: string | null | undefined, name: string, t: Treffer | undefined): number | null {
  const roh = String(menge ?? "").trim().toLowerCase().replace(/½/g, "0.5").replace(/¼/g, "0.25").replace(/¾/g, "0.75");
  if (!roh) return null;
  const m = roh.match(/^(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(.*)$/);
  if (!m) return /prise/.test(roh) ? 0.5 : null;
  let n = Number(m[1].replace(",", "."));
  if (m[2]) n = n / Number(m[2]);
  if (m[3]) n = (n + Number(m[3].replace(",", "."))) / 2;
  const e = m[4].trim();
  const oel = /öl|butter|fett|margarine/i.test(name);
  if (/^(g|gr|gramm)\b/.test(e)) return n;
  if (/^kg\b/.test(e)) return n * 1000;
  if (/^ml\b/.test(e)) return n;
  if (/^(l|liter)\b/.test(e)) return n * 1000;
  if (/^(el|essl)/.test(e)) return n * (oel ? 10 : 15);
  if (/^(tl|teel)/.test(e)) return n * 5;
  if (/^prise/.test(e)) return n * 0.5;
  if (/^(msp|messerspitze)/.test(e)) return n * 0.3;
  if (/^zehe/.test(e)) return n * 4;
  if (e === "" || /^(stk|stück|st\b)/.test(e) || /^[a-zäöüß]/.test(e)) {
    if (e !== "" && !/^(stk|stück|st\b)/.test(e) && !name.toLowerCase().split(/\s+/).some((w) => e.startsWith(w.slice(0, 4)))) return null;
    const sg = t?.stueck_g ?? STUECK_G.find(([re]) => re.test(name))?.[1] ?? null;
    return sg ? n * sg : null;
  }
  return null;
}

const rundG = (g: number) => g >= 50 ? Math.round(g / 5) * 5 : g >= 5 ? Math.round(g) : Math.round(g * 10) / 10;

// Zutaten eines Vorschlags anreichern und kcal pro Portion aus dem Katalog rechnen.
function nachrechnen(v: any, treffer: Map<string, Treffer>) {
  const portionen = Math.max(1, zahl(v.portionen) ?? 1);
  v.portionen = portionen;
  const summe = { kcal: 0, protein: 0, kh: 0, fett: 0 };
  let mit = 0, ohne = 0, gOhne = 0, gGesamt = 0;
  for (const z of (Array.isArray(v.zutaten) ? v.zutaten : [])) {
    const name = String(z?.name ?? "").trim();
    const t = treffer.get(name.toLowerCase());
    let g = zahl(z.menge_g);
    if (!(g != null && g > 0)) { g = inGramm(z.menge, name, t); z.menge_g_quelle = g != null ? "umgerechnet" : null; }
    else z.menge_g_quelle = z.menge_g_quelle ?? "riki";
    z.menge_g = g != null ? rundG(g) : null;
    if (t?.gefunden) {
      z.produkt_id = t.produkt_id;
      z.treffer = { name: t.name, marke: t.marke ?? null, score: t.score ?? null, art: t.art ?? null };
      z.naehrwerte_100g = t.naehr ?? null;
    } else {
      z.produkt_id = null;
      z.treffer = { grund: t?.grund ?? "nicht im Katalog" };
      z.naehrwerte_100g = null;
    }
    const n = z.naehrwerte_100g as Naehr | null;
    const hatWerte = !!(z.produkt_id && n && n.kcal != null && z.menge_g != null);
    if (hatWerte) {
      mit++;
      const f = z.menge_g / 100;
      summe.kcal += (n!.kcal ?? 0) * f; summe.protein += (n!.protein ?? 0) * f;
      summe.kh += (n!.kh ?? 0) * f; summe.fett += (n!.fett ?? 0) * f;
    } else {
      ohne++;
      if (z.menge_g != null) gOhne += z.menge_g;
    }
    if (z.menge_g != null) gGesamt += z.menge_g;
    z.mit_naehrwerten = hatWerte;
  }
  v.zutaten_mit_naehrwerten = mit;
  v.zutaten_ohne_naehrwerte = ohne;
  // Vollständig genug, wenn die Zutaten ohne Werte zusammen höchstens 10 % des Gewichts ausmachen.
  v.kcal_vollstaendig = gGesamt > 0 && gOhne / gGesamt <= 0.10;
  v.naehrwerte_portion = mit ? {
    kcal: Math.round(summe.kcal / portionen),
    protein: Math.round(summe.protein / portionen * 10) / 10,
    kh: Math.round(summe.kh / portionen * 10) / 10,
    fett: Math.round(summe.fett / portionen * 10) / 10,
  } : null;
  v.kcal_berechnet = v.naehrwerte_portion?.kcal ?? null;
}

// Art einer Mengenangabe: Gewicht/Volumen ("200 g"), Stück ("2 Stück", "1/2 Paprika") oder Löffel/Prise.
function mengenArt(menge: string, name: string): { art: "gewicht" | "stueck" | "loeffel" | "unklar"; n: number | null; einheit: string } {
  const roh = String(menge ?? "").trim().toLowerCase().replace(/½/g, "0.5");
  const m = roh.match(/^(?:ca\.?\s*)?(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*(.*)$/);
  if (!m) return { art: "unklar", n: null, einheit: "" };
  let n = Number(m[1].replace(",", ".")); if (m[2]) n = n / Number(m[2]);
  const e = m[3].trim();
  // Einheit in der Schreibweise des Originals behalten („Stück“, nicht „stück“).
  const orig = String(menge ?? "").trim().replace(/½/g, "0.5");
  const eOrig = orig.slice(Math.max(0, orig.length - m[3].length)).trim() || e;
  if (/^(g|gr|gramm|kg)\b/.test(e)) return { art: "gewicht", n, einheit: "g" };
  if (/^(ml|l|liter)\b/.test(e)) return { art: "gewicht", n, einheit: "ml" };
  if (/^(el|essl|tl|teel|prise|msp|messerspitze|zehe|bund|dose|packung|pck)/.test(e)) return { art: "loeffel", n, einheit: e };
  if (e === "" || /^(stk|stück|st\b)/.test(e) || name.toLowerCase().split(/\s+/).some((w) => w.length >= 4 && e.startsWith(w.slice(0, 4)))) {
    return { art: "stueck", n, einheit: eOrig };
  }
  return { art: "unklar", n, einheit: e };
}

const stueckText = (n: number, einheit: string) => {
  const t = Number.isInteger(n) ? String(n) : n === 0.5 ? "1/2" : String(Math.round(n * 10) / 10).replace(".", ",");
  return einheit ? `${t} ${einheit}` : t;
};

// Mengen anteilig an das Ziel anpassen: erst Stückzutaten auf ganze bzw. halbe Stück, dann die
// Gewichtszutaten ab 20 g. Löffel, Prisen und kleine Mengen bleiben, wie Riki sie angegeben hat.
function mengenAnpassen(v: any, ziel: number, treffer: Map<string, Treffer>) {
  const ist0 = v.kcal_berechnet;
  if (!(ist0 > 0) || !v.kcal_vollstaendig) return;
  if (Math.abs(ist0 - ziel) / ziel <= 0.12) return;
  let zub = String(v.zubereitung ?? "");
  const ersetzen = (alt: string, neu: string) => { if (alt && alt !== neu) zub = zub.split(alt).join(neu); };

  const f1 = ziel / ist0;
  for (const z of v.zutaten) {
    const ma = mengenArt(z.menge, String(z.name ?? ""));
    if (ma.art !== "stueck" || !(ma.n! > 0) || !(z.menge_g > 0)) continue;
    const proStueck = z.menge_g / ma.n!;
    const neuN = Math.max(0.5, Math.round(ma.n! * f1 * 2) / 2);
    const neuN2 = neuN >= 2 ? Math.round(neuN) : neuN;
    if (neuN2 === ma.n) continue;
    const neuText = stueckText(neuN2, ma.einheit);
    ersetzen(String(z.menge), neuText);
    z.menge = neuText; z.menge_g = rundG(proStueck * neuN2); z.menge_g_quelle = "angepasst";
  }
  nachrechnen(v, treffer);
  const ist1 = v.kcal_berechnet;
  if (ist1 > 0 && Math.abs(ist1 - ziel) / ziel > 0.05) {
    // Nur der Anteil der Gewichtszutaten wird verschoben, der Rest bleibt fest.
    let anteil = 0;
    for (const z of v.zutaten) {
      if (mengenArt(z.menge, String(z.name ?? "")).art === "gewicht" && z.menge_g >= 20 && z.mit_naehrwerten) {
        anteil += (z.naehrwerte_100g.kcal ?? 0) * z.menge_g / 100 / v.portionen;
      }
    }
    if (anteil > 0) {
      const f2 = Math.min(2.5, Math.max(0.4, (anteil + ziel - ist1) / anteil));
      for (const z of v.zutaten) {
        const ma = mengenArt(z.menge, String(z.name ?? ""));
        if (ma.art !== "gewicht" || !(z.menge_g >= 20) || !z.mit_naehrwerten) continue;
        const neuG = rundG(z.menge_g * f2);
        const neuText = `${neuG} ${ma.einheit}`;
        ersetzen(String(z.menge), neuText);
        z.menge = neuText; z.menge_g = neuG; z.menge_g_quelle = "angepasst";
      }
      nachrechnen(v, treffer);
    }
  }
  v.zubereitung = zub;
  v.mengen_angepasst = { kcal_vorher: ist0, kcal_nachher: v.kcal_berechnet };
}

function spickzettel(nutzer: string[], vorrat: string[], t: Map<string, Treffer>): string {
  const zeile = (n: string) => {
    const x = t.get(n.toLowerCase());
    if (x?.gefunden && x.naehr?.kcal != null) {
      const w = x.naehr;
      return `- ${n} → Katalog „${x.name}“: ${Math.round(w.kcal!)} kcal, ${w.protein ?? "?"} g Eiweiß, ${w.kh ?? "?"} g KH, ${w.fett ?? "?"} g Fett je 100 g` +
        (x.stueck_g ? ` (1 Stück ≈ ${x.stueck_g} g)` : "");
    }
    return `- ${n} → nicht im Katalog, bitte selbst schätzen`;
  };
  return "SPICKZETTEL (Katalogwerte):\nGenannte Zutaten:\n" + nutzer.map(zeile).join("\n") +
    "\nVorrat (nur wenn nötig):\n" + vorrat.map(zeile).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const key = findeKey();
  if (!key) {
    return new Response(JSON.stringify({ error: "Kein Anthropic-Key hinterlegt." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Bitte anmelden." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // 02.10.2026 (Ralph): kostenpflichtige RIKI-Funktion nur mit Premium.
    const { data: premiumRaw } = await sb.rpc("cb_riki_premium_check", { p_feature: "ki_premium" });
    const premium: any = Array.isArray(premiumRaw) ? premiumRaw[0] : premiumRaw;
    if (premium?.erlaubt !== true) {
      const grund = premium?.grund ?? "Diese RIKI-Funktion gehört zu Premium.";
      return new Response(JSON.stringify({ ok: false, error: grund, fehler: grund, premium: false }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Dieselbe Kostenbremse wie beim Etikett/Rezept-Foto: Tageslimit pro Nutzer + Monatsbudget.
    const { data: limitRaw, error: limitErr } = await sb.rpc("cb_riki_etikett_limit_check");
    if (limitErr) {
      return new Response(JSON.stringify({ error: "Limit-Pruefung fehlgeschlagen: " + limitErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const limit: any = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;
    if (limit?.erlaubt !== true) {
      return new Response(JSON.stringify({
        error: limit?.grund ?? "Limit erreicht.",
        heute_genutzt: limit?.heute_genutzt, limit_tag: limit?.limit_tag,
      }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Eingaben säubern.
    const zutaten: string[] = Array.isArray(body.zutaten)
      ? body.zutaten.map((z: unknown) => String(z ?? "").trim()).filter((z: string) => z.length > 0).slice(0, 40)
      : [];
    // 11.11.2026: eine Zutat reicht (Sandra: nur „Tofu“ → iPhone zeigte nur „Ging nicht“, Server 400).
    if (zutaten.length < 1) {
      return new Response(JSON.stringify({ error: "Bitte mindestens eine Zutat angeben." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const kcalTag = Number(body.kcal_tag);
    const kcalPortionRoh = Number(body.kcal_portion);
    const mahlzeit = ["Frühstück", "Mittagessen", "Abendessen", "Snack"].includes(String(body.mahlzeit)) ? String(body.mahlzeit) : null;
    const ef = ["vegan", "vegetarisch", "omnivor"].includes(String(body.ernaehrungsform)) ? String(body.ernaehrungsform) : null;
    const anzahl = Math.min(5, Math.max(1, Number(body.anzahl) || 3));
    const portionenWunsch = Math.min(8, Math.max(1, Math.round(Number(body.portionen) || 1)));

    // 16.11.2026: Ziel pro Portion. Neu: kcal_portion direkt. Alt (kcal_tag): Anteil je Mahlzeit.
    let ziel: number | null = null;
    let zielQuelle: "portion" | "tag" | null = null;
    if (isFinite(kcalPortionRoh) && kcalPortionRoh >= 50 && kcalPortionRoh <= 3000) {
      ziel = Math.round(kcalPortionRoh); zielQuelle = "portion";
    } else if (isFinite(kcalTag) && kcalTag > 0) {
      ziel = Math.round(kcalTag * (mahlzeit ? MZ_ANTEIL[mahlzeit] : 1 / 3) / 10) * 10; zielQuelle = "tag";
    }
    const zielTxt = ziel
      ? `Ziel pro Portion: etwa ${ziel} kcal (Rahmen ${Math.round(ziel * 0.85)}–${Math.round(ziel * 1.15)} kcal)` +
        (zielQuelle === "tag" ? ` – abgeleitet aus ${Math.round(kcalTag)} kcal Tagesbedarf${mahlzeit ? " für " + mahlzeit : ""}.` : ".")
      : "Kein Kalorienziel angegeben.";

    // Katalogwerte der genannten Zutaten + üblicher Vorrat vorab – Riki rechnet damit.
    // 16.11.2026 (Ralph: Auswahl vegan/vegetarisch): passende Vorratsliste, klare Regel im Text.
    const vorrat = ef === "vegan" ? VORRAT.filter((n) => n !== "Butter") : VORRAT;
    const efTxt = ef === "vegan"
      ? " Ernährungsform: NUR VEGANE Gerichte – keine tierischen Zutaten (kein Fleisch, Fisch, Ei, Milch, Käse, Quark, Joghurt, Butter, Honig). Genannte tierische Zutaten lässt du weg."
      : ef === "vegetarisch"
      ? " Ernährungsform: NUR VEGETARISCHE Gerichte – kein Fleisch, kein Fisch, keine Gelatine. Genannte Zutaten dieser Art lässt du weg."
      : "";
    const vorab = await zuordnen(sb, [...zutaten, ...vorrat]);

    const frage =
      `Zutaten, die ich zuhause habe: ${zutaten.join(", ")}.\n` +
      `${zielTxt}${mahlzeit ? " Mahlzeit: " + mahlzeit + "." : ""}${efTxt}` +
      ` Portionen: ${portionenWunsch}.\n\n` + spickzettel(zutaten, vorrat, vorab) + `\n\n` +
      `Schlage ${anzahl} verschiedene, machbare Gerichte vor, die überwiegend diese Zutaten nutzen und deren Portion das Ziel trifft. ` +
      `Gib für jede Zutat menge_g an. kcal pro Portion als ehrliche Rechnung mit den Katalogwerten. Nichts erfinden, was den Rahmen sprengt.`;

    const modell: string = typeof body.modell === "string" && PREISE[body.modell] ? body.modell : STANDARD_MODELL;
    const istSonnet55 = modell === "claude-sonnet-5-5";
    const t0 = Date.now();

    // Sonnet 5.5: adaptives Denken (Standard) bei effort "low" – kein temperature/top_p, kein
    // budget_tokens. max_tokens großzügig, weil Denken mitzählt. Server-seitige Ausweichschaltung
    // bei Ablehnung durch die Sicherheitsfilter (fallbacks: "default" + Beta-Kopfzeile).
    const anfrage: Record<string, unknown> = {
      model: modell,
      max_tokens: istSonnet55 ? 12000 : 3500,
      system: [{ type: "text", text: REGELWERK, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: frage }],
    };
    const kopf: Record<string, string> = { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" };
    if (istSonnet55) {
      anfrage.output_config = { effort: "low" };
      anfrage.fallbacks = "default";
      kopf["anthropic-beta"] = "server-side-fallback-2026-07-01";
    }

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: kopf, body: JSON.stringify(anfrage),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki konnte keine Vorschläge erstellen." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Kosten: usage.iterations ist je Versuch maßgeblich (bei Ausweichschaltung mehrere Modelle),
    // sonst die Gesamtzahlen. Jeder Versuch zum Preis des Modells, das ihn ausgeführt hat.
    const usage: any = j.usage ?? {};
    const versuche: any[] = Array.isArray(usage.iterations) && usage.iterations.length ? usage.iterations : [usage];
    let inTok = 0, outTok = 0, kosten = 0;
    for (const v of versuche) {
      const vin = (v.input_tokens ?? 0) + (v.cache_creation_input_tokens ?? 0) + (v.cache_read_input_tokens ?? 0);
      const vout = v.output_tokens ?? 0;
      const p = PREISE[String(v.model ?? j.model ?? modell)] ?? PREISE[modell];
      inTok += vin; outTok += vout; kosten += (vin / 1e6) * p.in + (vout / 1e6) * p.out;
    }
    const bedientVon: string = String(j.model ?? modell);

    // Ablehnung durch die Sicherheitsfilter (auch nach Ausweichschaltung): sauber als Fehler melden.
    if (j.stop_reason === "refusal") {
      const kat = j.stop_details?.category ?? null;
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: bedientVon, p_in: inTok, p_out: outTok,
        p_kosten: Number(kosten.toFixed(6)), p_produkt_id: null, p_erfolg: false,
        p_fehler: ("refusal" + (kat ? ":" + kat : "")).slice(0, 400) });
      return new Response(JSON.stringify({ error: "Riki darf zu dieser Anfrage keine Vorschläge machen. Bitte formuliere die Zutaten anders." }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (j.stop_reason === "max_tokens") {
      await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: bedientVon, p_in: inTok, p_out: outTok,
        p_kosten: Number(kosten.toFixed(6)), p_produkt_id: null, p_erfolg: false, p_fehler: "max_tokens" });
      return new Response(JSON.stringify({ error: "Riki ist mit der Antwort nicht fertig geworden. Bitte nochmal versuchen." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Nur text-Blöcke lesen (thinking- und fallback-Blöcke ignorieren).
    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let ergebnis: any = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      ergebnis = JSON.parse(m ? m[0] : text);
    } catch { ergebnis = null; }

    await sb.rpc("cb_riki_buchen", { p_modus: "rezept", p_modell: bedientVon,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: null, p_erfolg: true, p_fehler: null });

    const vorschlaege = Array.isArray(ergebnis?.vorschlaege) ? ergebnis.vorschlaege : [];
    // Schritte vereinheitlichen: immer ein Text "1. …\n2. …" (falls Riki eine Liste liefert)
    // plus "schritte" als Liste ohne Nummer für die Anzeige in Web und iPhone.
    for (const v of vorschlaege) {
      const roh: string[] = Array.isArray(v?.zubereitung)
        ? v.zubereitung.map((x: unknown) => String(x ?? ""))
        : String(v?.zubereitung ?? "").split(/\n+/);
      const schritte = roh.map((x) => x.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((x) => x.length > 0);
      v.schritte = schritte;
      v.zubereitung = schritte.map((x, i) => `${i + 1}. ${x}`).join("\n");
    }
    // 16.11.2026: jede Zutat dem Katalog zuordnen, Gramm sicherstellen, kcal pro Portion nachrechnen.
    const alleNamen: string[] = [];
    for (const v of vorschlaege) for (const z of (Array.isArray(v?.zutaten) ? v.zutaten : [])) if (z?.name) alleNamen.push(String(z.name));
    const treffer = new Map(vorab);
    const fehlend = alleNamen.filter((n) => !treffer.has(n.trim().toLowerCase()));
    if (fehlend.length) for (const [k, t] of await zuordnen(sb, fehlend)) treffer.set(k, t);
    for (const v of vorschlaege) {
      if (!Array.isArray(v.zutaten)) v.zutaten = [];
      v.kcal_riki = zahl(v.kcal_geschaetzt);
      nachrechnen(v, treffer);
      if (ziel) mengenAnpassen(v, ziel, treffer);
      // Angezeigte kcal = Katalogrechnung, wenn sie vollständig ist; sonst Rikis Schätzung.
      if (v.kcal_berechnet != null && v.kcal_vollstaendig) v.kcal_geschaetzt = v.kcal_berechnet;
      if (ziel && v.kcal_geschaetzt != null) v.passt_zu_kcal = Math.abs(v.kcal_geschaetzt - ziel) / ziel <= 0.15;
      // Schritte nach einer Mengenanpassung neu aufteilen.
      v.schritte = String(v.zubereitung ?? "").split(/\n+/).map((x: string) => x.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((x: string) => x.length > 0);
    }

    // Gewünschte Ernährungsform: Riki kennzeichnet jeden Vorschlag; nicht passende fallen weg,
    // solange mindestens einer passt (sonst bleiben sie, sichtbar markiert).
    if (ef) {
      const erlaubt = ef === "vegan" ? ["vegan"] : ef === "vegetarisch" ? ["vegan", "vegetarisch"] : ["vegan", "vegetarisch", "omnivor"];
      for (const v of vorschlaege) v.passt_zu_ernaehrung = erlaubt.includes(String(v.ernaehrungsform));
      const passend = vorschlaege.filter((v: any) => v.passt_zu_ernaehrung);
      if (passend.length) vorschlaege.splice(0, vorschlaege.length, ...passend);
    }

    if (!vorschlaege.length) {
      return new Response(JSON.stringify({ error: "Riki hat keine verwertbaren Vorschläge geliefert. Versuch es mit mehr oder anderen Zutaten." }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      vorschlaege,
      hinweis: (ziel
        ? `Ziel: etwa ${ziel} kcal pro Portion. Die kcal sind mit den Nährwerten aus dem Katalog gerechnet – ein Richtwert, keine Messung.`
        : "Vorschläge von Riki – die kcal-Angabe ist ein Richtwert aus den Katalogwerten.") +
        " Wähl einen Vorschlag, dann kannst du ihn als Rezept übernehmen und anpassen.",
      meta: {
        modell: bedientVon, kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
        kcal_tag: isFinite(kcalTag) && kcalTag > 0 ? Math.round(kcalTag) : null, mahlzeit,
        kcal_portion: ziel, ziel_quelle: zielQuelle, ernaehrungsform: ef,
        heute_genutzt: (limit?.heute_genutzt ?? 0) + 1, limit_tag: limit?.limit_tag,
      },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
