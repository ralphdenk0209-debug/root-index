// RIKI-SCAN-WORKER
//
// v9 (2026-09-18, #214, Ralph jaja): BARCODE AUF DEM FOTO PRUEFEN. Ersatz fuer die am 13.09. verlorene
//   EAN-Pruefung aus v5 (Quelltext nie abgelegt, neu entworfen, nicht nachgebaut). riki-etikett bekommt
//   ean_pruefen=true und liest die Nummer selbst ab (ean_auf_foto). Nur wenn Foto-Nummer UND Scan-Nummer
//   gueltige GTINs mit korrekter Pruefziffer sind und sich unterscheiden, wird der Job angehalten: kein
//   Ingest, Fehler "Barcode auf dem Foto passt nicht zum gescannten". Unlesbar oder ungueltig -> weiter wie
//   bisher (Befund steht in ergebnis_meta.ean_pruefung). Vergleich ohne fuehrende Nullen (EAN-13 = UPC-12).
//
// v8 (2026-09-18, #214, Ralph "machen"): LESEERGEBNIS VOR DEM SPEICHERN ABLEGEN.
//   Am 17.09. gingen 6 bezahlte Sonnet-Lesungen verloren, weil das Speichern scheiterte
//   (Timeout) und das Leseergebnis nirgends lag. Neu: nach einer brauchbaren Lesung legt
//   der Worker sie ueber cb_riki_scan_lesung_ablegen in shadow_v1.riki_scan_lesung ab -
//   VOR cb_produkt_ingest. Ein Retry desselben Jobs holt sie ueber cb_riki_scan_lesung_holen
//   und bezahlt nicht neu. Neu lesen erzwingen: ergebnis_meta.retry.neu_lesen = true.
//
// v7 (2026-09-17, #214, Ralph jaja): MODELL WIEDER MITSCHICKEN. Der Worker schickte seit dem
//   Rueckfall auf v4 (Git-Umzug 13.09.) kein Modell mehr - riki-etikett las deshalb mit Haiku,
//   gegen Ralphs Entscheid A vom 09.09. (Sonnet im Hintergrund). Gemessen in Riki_Nutzung:
//   09./10.09. Sonnet, 16./17.09. Haiku. Neu: LESE_MODELL wird an riki-etikett uebergeben.
//
// v6 (2026-09-17, #214, Ralph 3A): ZUSATZDATEN UEBER DEN FREIGEGEBENEN SCHREIBWEG.
//   v4 schrieb Wirkstoffe und Mikronaehrstoffe direkt in "Produkt_Naehrstoffe" und
//   "Produkt_Mikronaehrstoffe". Der Riegel guard_riki_direct_nutrient_write sperrt das
//   (42501) - jeder Scan mit Wirkstoffen endete als Fehler. Neu: ein Aufruf von
//   cb_riki_scan_zusatzdaten_persistieren (setzt app.riki_fachpersistenz selbst, loescht
//   nur Zeilen derselben Quelle, schreibt in EINER Transaktion).
//   Hinweis: vom 07. bis 10.09. lief live ein v5 (Meta-Felder ean_vom_foto, ean_verworfen,
//   zusatzdaten). Sein Quelltext wurde nie abgelegt; der Git-Umzug vom 13.09. hat v4
//   darueber ausgeliefert. Die EAN-Pruefung aus v5 ist hier NICHT nachgebaut (nichts raten).
//
// v4 (2026-09-05, #530, Ralph-Go 05.09.): FEHLERGRUND IM KLARTEXT. Elf von 63 Jobs
//   endeten mit "Zusatzdaten-Persistenz fehlgeschlagen: [object Object]". Ursache:
//   supabase-js wirft bei .insert() ein einfaches Objekt (message/code/details/hint),
//   kein Error - String() macht daraus "[object Object]". Damit war nicht messbar,
//   was fehlschlug. Neu: fehlerText() zieht die Felder heraus. Zusaetzlich werden
//   Zeilen mit unbrauchbarer Menge oder fehlender Pflichtangabe VOR dem Insert
//   erkannt und namentlich gemeldet, statt als anonymer Datenbankfehler zu enden.
//   Kein Wert wird dabei stillschweigend ersetzt oder geraten.
//   Sicherung v3: bereiche/_sicherungen/2026-09-05-riki-scan-worker-v3/
//
// v3 (2026-09-04, KV-491 Punkt 5, Ralph-Go 04.09.): STATION QUELLE. Nach dem Ingest
//   schreibt der Worker product_source_state (etikettfoto, eindeutig, Referenz Job).
//   Sicherung v2: bereiche/_sicherungen/2026-09-04-riki-scan-worker-v2/
//
// v2 (2026-09-04, KP-468 Schritt 2, Ralph-Go 04.09.): ETIKETT-ROHTEXT MITSCHICKEN.
//   Der Rauchtest (KP-437) fand: Zutaten_Rohtext hatte 0 Zeilen bei allen drei
//   Produkten - der Wortlaut vom Etikett wurde nirgends festgehalten. Ohne ihn ist
//   die Zerlegung nicht belegbar und eine falsche Reihenfolge (P73665) nicht
//   korrigierbar. riki-etikett liefert je Zutat original_text verlustfrei (v24,
//   Work #78); daraus wird die Liste in Etikettreihenfolge zusammengesetzt und als
//   zutaten_rohtext an cb_produkt_ingest gegeben. Der Server schreibt sie nur,
//   wenn noch nichts da ist (Migration work468_ingest_zutaten_rohtext_20260904).
//   Sicherung v1: bereiche/_sicherungen/2026-09-04-riki-scan-worker-v1/
//
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// #530: supabase-js wirft bei .insert() ein einfaches Objekt, keinen Error.
// String() daraus ergibt "[object Object]" - der Grund war elfmal nicht lesbar.
const LESE_MODELL = "claude-sonnet-4-6";
const WORKER = "riki-scan-worker v13";
// v11 (23.09.2026, Ralph jaja Foto-Tempo B): SCHLANK-LESEN. Riki schreibt keine Note/Begruendung je Zutat mehr -
//   die Maschine bewertet aus dem Stamm (cb_produkt_ingest liest rating nie). Schalter SCHLANK; erst nach Probe an.
//   Probe-Modus: body.probe=true arbeitet genau einen offenen Auftrag aus shadow_v1.riki_probe_auftrag ab
//   (nur service_role kann Auftraege anlegen/holen) und schreibt Zeiten + Lesung zurueck. Kein Ingest, kein Job-Status.
const NUR_ZEILEN = true; // 23.09.2026 Tempo C (Ralph jaja): Riki liefert je Zutat nur name + original_text; Probe 10 Jobs im Mittel 13 s statt 20 s
const SCHLANK = true; // 23.09.2026 nach Probe (13 Lesungen: Zutaten/Naehrwerte/Name/Marke gleich, -35 % Zeit)
const CHECK_MODELL = "claude-haiku-4-5-20251001";

/* v10, 23.09.2026 (Ralph A Foto-Tempo): SCHNELL-CHECK VOR DEM GROSSEN LESEN.
   Frueher merkte man ein unscharfes Foto erst nach 20-60 s am Ende. Jetzt fragt ein
   kleines Modell in 1-3 s: Gibt es ein Zutatenverzeichnis, ist es scharf lesbar, welche Marke?
   Das Ergebnis liegt sofort am Auftrag (cb_riki_scan_job_zwischenstand), die App meldet
   "bitte neu fotografieren", waehrend Riki trotzdem weiterliest (Naehrwerte, Name).
   riki-etikett uebernimmt die Antwort als Gegenprobe und spart den zweiten Aufruf. */
function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}
async function schnellCheck(images: string[]): Promise<any> {
  const key = findeKey();
  if (!key) return { antwort: "unklar", lesbar: null, marke: null, grund: "kein_key" };
  const t0 = Date.now();
  const inhalt: any[] = [];
  for (const b of images.slice(0, 3)) {
    const m = String(b).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) inhalt.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  inhalt.push({ type: "text", text:
    "Beantworte drei Fragen zu diesen Verpackungsfotos, ohne zu raten.\n" +
    "1. Steht auf einem Foto ein Zutatenverzeichnis (Aufzaehlung der Zutaten, meist nach dem Wort \"Zutaten\")? Eine Naehrwerttabelle ist KEIN Zutatenverzeichnis.\n" +
    "2. Ist dieses Zutatenverzeichnis VOLLSTAENDIG im Bild und SCHARF genug, um jedes Wort sicher zu lesen?\n" +
    "3. Welcher Markenname steht auf der Packung? Ein Siegel ist keine Marke. Nicht sicher: UNBEKANNT.\n" +
    "Antworte in genau einer Zeile: JA|SCHARF|Marke oder JA|UNSCHARF|Marke oder NEIN|-|Marke" });
  try {
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CHECK_MODELL, max_tokens: 30, messages: [{ role: "user", content: inhalt }] }),
    });
    const j = await ai.json();
    if (!ai.ok) return { antwort: "unklar", lesbar: null, marke: null, grund: "http_" + ai.status, ms: Date.now() - t0 };
    const roh = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").trim();
    const [a1, a2, a3] = roh.split("|").map((x: string) => (x ?? "").trim());
    const antwort = /^ja\b/i.test(a1 ?? "") ? "ja" : /^nein\b/i.test(a1 ?? "") ? "nein" : "unklar";
    const lesbar = antwort === "ja" ? (/^scharf/i.test(a2 ?? "") ? true : /^unscharf/i.test(a2 ?? "") ? false : null) : (antwort === "nein" ? false : null);
    let marke: string | null = (a3 ?? "").trim();
    if (!marke || /^unbekannt$/i.test(marke) || marke.length > 60 || marke === "-") marke = null;
    const u: any = j.usage ?? {};
    const inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    const outTok = u.output_tokens ?? 0;
    return { antwort, lesbar, marke, roh: roh.slice(0, 120), ms: Date.now() - t0, kosten_usd: Number(((inTok / 1e6) * 1.0 + (outTok / 1e6) * 5.0).toFixed(6)), in: inTok, out: outTok };
  } catch (e) {
    return { antwort: "unklar", lesbar: null, marke: null, grund: String(e).slice(0, 120), ms: Date.now() - t0 };
  }
}

// v9: GTIN-Pruefziffer (EAN-8/UPC-12/EAN-13/GTIN-14).
function gtinGueltig(x: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(x)) return false;
  const d = x.split("").map(Number);
  const pruef = d.pop()!;
  let summe = 0;
  for (let i = d.length - 1, g = 3; i >= 0; i--, g = g === 3 ? 1 : 3) summe += d[i] * g;
  return (10 - (summe % 10)) % 10 === pruef;
}
function eanPruefen(scan: unknown, foto: unknown): { ergebnis: string; scan: string | null; foto: string | null } {
  const s = String(scan ?? "").replace(/\D/g, "");
  const f = String(foto ?? "").replace(/\D/g, "");
  if (!s) return { ergebnis: "ohne_scan", scan: null, foto: f || null };
  if (!f) return { ergebnis: "foto_nicht_lesbar", scan: s, foto: null };
  if (!gtinGueltig(f)) return { ergebnis: "foto_ungueltig", scan: s, foto: f };
  if (!gtinGueltig(s)) return { ergebnis: "scan_ungueltig", scan: s, foto: f };
  const norm = (x: string) => x.replace(/^0+/, "");
  return { ergebnis: norm(s) === norm(f) ? "gleich" : "verschieden", scan: s, foto: f };
}

function fehlerText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const teile = [o.message, o.code ? `code ${o.code}` : null, o.details, o.hint]
      .filter((x) => typeof x === "string" && x.length > 0);
    if (teile.length) return teile.join(" | ");
    try { return JSON.stringify(e); } catch { /* faellt unten durch */ }
  }
  return String(e);
}

// #530: eine Zahl, die keine ist, geht als NaN in den Insert und kommt als
// anonymer Datenbankfehler zurueck. Hier wird sie vorher benannt.
function zahlOderNull(x: unknown): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function cleanImages(job: any): string[] {
  const out: string[] = [];
  const add = (x: unknown) => {
    if (typeof x === "string" && x.startsWith("data:image/") && !out.includes(x)) out.push(x);
  };
  if (Array.isArray(job?.fotos)) for (const x of job.fotos) add(x);
  add(job?.foto);
  return out.slice(0, 6);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return response({ ok: false, fehler: "POST erforderlich" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const started = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.probe === true) {
      const { data: auftrag } = await sb.rpc("cb_riki_probe_holen");
      if (!auftrag) return response({ ok: true, probe: "kein offener Auftrag" });
      const opt = auftrag.optionen ?? {};
      /* Variante: true = schlank, false = voll, "zeilen" = nur Zutatenzeilen (Tempo C) */
      const varianten: any[] = Array.isArray(opt.varianten) ? opt.varianten : [true];
      const aufgaben: Promise<any>[] = [];
      for (const pj of (auftrag.jobs ?? [])) {
        const bilder = cleanImages(pj);
        for (const schlank of varianten) {
          aufgaben.push((async () => {
            const t0 = Date.now();
            try {
              const r = await fetch(`${url}/functions/v1/riki-etikett`, {
                method: "POST",
                headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ bilder, ean: pj.ean || undefined, ean_pruefen: true, modell: LESE_MODELL, schlank: schlank === true, nur_zeilen: schlank === "zeilen", gegenprobe: { antwort: "ja", marke: null } }),
              });
              const d = await r.json().catch(() => null);
              const v = d?.vorschlag ?? {};
              return { job_id: pj.job_id, schlank, http: r.status, ms: Date.now() - t0, bild_kb: Math.round(bilder.join("").length / 1024),
                out_token: d?.meta?.out_token ?? null, in_token: d?.meta?.in_token ?? null, kosten_usd: d?.meta?.kosten_usd ?? null,
                name: v.name ?? null, marke: v.marke ?? null, naehrwerte_100g: v.naehrwerte_100g ?? null,
                zutaten: Array.isArray(v.zutaten) ? v.zutaten.map((z: any) => z?.original_text ?? z?.name) : null,
                namen: Array.isArray(v.zutaten) ? v.zutaten.map((z: any) => z?.name) : null,
                e_nummern: v.zusatzstoffe?.e_nummern ?? null, warnungen: d?.warnungen ?? null, fehler: d?.error ?? null };
            } catch (e) { return { job_id: pj.job_id, schlank, ms: Date.now() - t0, fehler: String(e) }; }
          })());
        }
      }
      const ergebnis = await Promise.all(aufgaben);
      await sb.rpc("cb_riki_probe_ablegen", { p_auftrag_id: auftrag.auftrag_id, p_ergebnis: ergebnis });
      return response({ ok: true, probe: auftrag.auftrag_id, anzahl: ergebnis.length, ms: Date.now() - started });
    }
    const maxJobs = Math.max(1, Math.min(Number(body?.max_jobs ?? 2), 4));
    const results: any[] = [];

    for (let i = 0; i < maxJobs; i++) {
      const { data: claim, error: claimErr } = await sb.rpc("cb_riki_scan_job_claim", { p_job_id: null });
      if (claimErr) throw new Error(`claim: ${claimErr.message}`);
      const job = claim?.job;
      if (!job) break;

      const jobStarted = Date.now();
      const images = cleanImages(job);
      if (!images.length) {
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: { worker: WORKER, dauer_ms: Date.now() - jobStarted },
          p_fehler: "Keine verwertbaren Fotos im RIKI-Job.",
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "keine_fotos" });
        continue;
      }

      let read: any = null;
      let readStatus = 0;
      // v8: liegt fuer diesen Job schon eine bezahlte Lesung, wird sie wiederverwendet.
      let lesungWiederverwendet = false;
      let lesungAbgelegt: unknown = null;
      try {
        const h = await sb.rpc("cb_riki_scan_lesung_holen", { p_job_id: job.job_id });
        if (!h.error && h.data?.lesung?.vorschlag) {
          read = h.data.lesung;
          readStatus = Number(h.data.riki_http ?? 200);
          lesungWiederverwendet = true;
        }
      } catch (_) { /* ohne Ablage wird normal gelesen */ }
      // v10: Schnell-Check (nur bei neuer Lesung). Ergebnis sofort am Auftrag ablegen.
      let schnell: any = null;
      if (!lesungWiederverwendet) {
        schnell = await schnellCheck(images);
        try { await sb.rpc("cb_riki_scan_job_zwischenstand", { p_job_id: job.job_id, p_schnellcheck: schnell }); } catch (_) { /* nur Anzeige */ }
        try {
          if (schnell?.kosten_usd) await sb.rpc("cb_riki_buchen", { p_modus: "etikett-schnellcheck", p_modell: CHECK_MODELL, p_in: schnell.in ?? 0, p_out: schnell.out ?? 0, p_kosten: schnell.kosten_usd, p_produkt_id: job.produkt_id ?? null, p_erfolg: true, p_fehler: null });
        } catch (_) { /* Buchung ist nicht lebenswichtig */ }
      }
      if (!lesungWiederverwendet) try {
        const r = await fetch(`${url}/functions/v1/riki-etikett`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          // v7: Ralph-Entscheid A vom 09.09.2026 - im Hintergrund liest Sonnet, weil Haiku nicht
          // reproduzierbar liest. riki-etikett nimmt body.modell, sonst Haiku.
          body: JSON.stringify({ bilder: images, ean: job.ean || undefined, ean_pruefen: true, modell: LESE_MODELL, schlank: SCHLANK, nur_zeilen: NUR_ZEILEN, gegenprobe: (schnell && (schnell.antwort === "ja" || schnell.antwort === "nein")) ? { antwort: schnell.antwort, marke: null } : undefined }),
        });
        readStatus = r.status;
        read = await r.json().catch(() => null);
        if (!r.ok || !read?.vorschlag) {
          const msg = read?.error ?? read?.fehler ?? `riki-etikett HTTP ${r.status}`;
          await sb.rpc("cb_riki_scan_job_abschliessen", {
            p_job_id: job.job_id,
            p_ok: false,
            p_ergebnis_meta: { worker: WORKER, riki_http: r.status, dauer_ms: Date.now() - jobStarted },
            p_fehler: String(msg).slice(0, 1000),
          });
          results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "riki_etikett", http: r.status });
          continue;
        }
        // v8: bezahlte Lesung sofort ablegen, bevor irgendetwas gespeichert wird.
        try {
          const ab = await sb.rpc("cb_riki_scan_lesung_ablegen", {
            p_job_id: job.job_id, p_lesung: read, p_modell: LESE_MODELL, p_riki_http: r.status,
          });
          lesungAbgelegt = ab.error ? { fehler: fehlerText(ab.error) } : ab.data;
        } catch (e) { lesungAbgelegt = { fehler: fehlerText(e) }; }
      } catch (e) {
        const msg = String(e);
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: { worker: WORKER, dauer_ms: Date.now() - jobStarted },
          p_fehler: msg.slice(0, 1000),
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "riki_fetch" });
        continue;
      }

      const v = read.vorschlag;
      // v9: Barcode vom Foto gegen den Scan. Nur ein sicherer Widerspruch haelt an.
      const eanPruefung = eanPruefen(job.ean, v?.ean_auf_foto);
      if (eanPruefung.ergebnis === "verschieden") {
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: { worker: WORKER, riki_http: readStatus, dauer_ms: Date.now() - jobStarted,
            ean_pruefung: eanPruefung, lesung_wiederverwendet: lesungWiederverwendet, lesung_abgelegt: lesungAbgelegt },
          p_fehler: `Barcode auf dem Foto (${eanPruefung.foto}) passt nicht zum gescannten (${eanPruefung.scan}). Nichts gespeichert.`,
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "ean_widerspruch" });
        continue;
      }
      const zusatz = v.zusatzstoffe ?? {};
      // KP-468: Etikettwortlaut in Etikettreihenfolge, aus original_text je Zutat.
      // Kein Gesamtfeld in riki-etikett - das hier ist die verlustfreie Kette der
      // Einzelzeilen, nicht ein neu gelesener Text. Steht so im Kommentar der Zeile.
      const rohtext = Array.isArray(v.zutaten)
        ? v.zutaten.map((z: any) => String(z?.original_text ?? z?.name ?? "").trim()).filter(Boolean).join(", ")
        : "";
      /* 23.09.2026 (Ralph jaja A): Marke kommt zuerst aus OFF (Scan_Cache, beim Barcode-Scan geholt).
         Nur wenn dort keine steht, gilt Rikis gelesene Marke. Die Marke aus dem Haiku-Schnell-Check
         zaehlt nicht mehr als Widerspruch (oben: marke null) - sie verwechselte Marke und Produktname. */
      let offMarke: string | null = null;
      let offName: string | null = null;
      if (job.ean) {
        try {
          const { data: sc } = await sb.from("Scan_Cache").select("Marke,Name").eq("EAN", String(job.ean)).maybeSingle();
          const m = typeof sc?.Marke === "string" ? sc.Marke.split(",")[0].trim() : ""; // OFF fuehrt Marken als Liste - die erste zaehlt
          if (m) offMarke = m;
          /* 23.09.2026 (Ralph „ja"): auch der Name zuerst aus OFF. Steht die Marke vorn/hinten im Namen, faellt sie weg;
             bleibt weniger als 3 Zeichen uebrig oder ist der Name nur die Marke, gilt Rikis Name. */
          let nm = typeof sc?.Name === "string" ? sc.Name.replace(/\s+/g, " ").trim() : "";
          if (nm && m) {
            const esc = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const ohne = nm.replace(new RegExp("^" + esc + "\\s*[-–:,]?\\s*", "i"), "").replace(new RegExp("\\s*[-–:,]?\\s*" + esc + "$", "i"), "").trim();
            nm = ohne.length >= 3 ? ohne : "";
          }
          if (nm.length >= 3) offName = nm;
        } catch (_) { /* ohne OFF weiter wie bisher */ }
      }
      const payload: any = {
        produkt_id: job.produkt_id,
        ean: job.ean || null,
        name: offName ?? v.name ?? null,
        marke: offMarke ?? v.marke ?? null,
        kategorie: v.kategorie_vorschlag ?? null,
        basis: v.bezug === "100ml" ? "100ml" : "100g",
        quelle: `Etikettfoto (RIKI-Hintergrundlauf), Job ${job.job_id}`,
        quelle_typ: "Etikettfoto",
        naehrwerte: v.naehrwerte_100g ?? null,
        zutaten: Array.isArray(v.zutaten) ? v.zutaten : [],
        zutaten_replace: true,
        zutaten_rohtext: rohtext || null,
        zusatzstoffe_text: zusatz.text ?? "",
        zusatzstoffe_status: zusatz.status ?? null,
        suessstoffe: zusatz.suessstoffe === true ? "ja" : "nein",
      };

      if (!payload.name) {
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: { worker: WORKER, riki_http: readStatus, dauer_ms: Date.now() - jobStarted },
          p_fehler: "RIKI konnte keinen Produktnamen lesen.",
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "kein_name" });
        continue;
      }

      const { data: ing, error: ingErr } = await sb.rpc("cb_produkt_ingest", { p: payload, p_auto_freigeben: false });
      if (ingErr) {
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: { worker: WORKER, riki_http: readStatus, dauer_ms: Date.now() - jobStarted,
            lesung_wiederverwendet: lesungWiederverwendet, lesung_abgelegt: lesungAbgelegt },
          p_fehler: `Persistenz fehlgeschlagen: ${ingErr.message}`.slice(0, 1000),
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "persistenz" });
        continue;
      }

      // v3 (KV-491 Punkt 5, 04.09.): STATION QUELLE schreiben. product_source_state
      // hatte fuer jeden Etikettweg 0 Zeilen - die Kette war ab hier nicht belegbar.
      // Eine Zeile je Produkt und Quellenart, Referenz ist der Job. Ein Fehler hier
      // bricht den Job nicht ab, steht aber im Ergebnis.
      let quelleStand: any = null;
      try {
        const q = await sb.rpc("cb_riki_quelle_status_setzen", {
          p_product_id: job.produkt_id, p_source_kind: "etikettfoto", p_discovery_status: "eindeutig",
          p_source_ref: `riki-scan-job:${job.job_id}`, p_candidates: [],
          p_note: `Worker v3, Job ${job.job_id}, ${images.length} Fotos, riki_http ${readStatus}`,
          p_evidence: { job_id: job.job_id, fotos: images.length, zutaten_rohtext: ing?.zutaten_rohtext ?? null } });
        quelleStand = q.error ? { fehler: q.error.message } : q.data;
      } catch (e) { quelleStand = { fehler: fehlerText(e) }; }

      // Zusatzbereiche werden nur additiv geschrieben, wenn riki-etikett sie wirklich liefert.
      // Diese Tabellen waren bereits Teil des alten Autopiloten. Fehler hier machen den Job sichtbar fehlerhaft.
      // #530: untaugliche Zeilen werden VOR dem Insert benannt, nicht geraten.
      // Menge_100g und Einheit sind in Produkt_Mikronaehrstoffe Pflicht.
      const untauglich: string[] = [];
      let zusatzStand: unknown = null;
      try {
        const QUELLE = "Etikettfoto (RIKI-Hintergrundlauf)";
        const wirk = Array.isArray(v.wirkstoffe) ? v.wirkstoffe : [];
        const wirkGut: Array<Record<string, unknown>> = [];
        for (const x of wirk as any[]) {
          const name = String(x?.name ?? "").trim();
          const menge = zahlOderNull(x?.menge);
          if (!name) { untauglich.push("Naehrstoff ohne Namen"); continue; }
          if (menge === null || menge < 0) { untauglich.push(`Naehrstoff "${name}": Menge unbrauchbar (${JSON.stringify(x?.menge)})`); continue; }
          const nrv = zahlOderNull(x?.nrv);
          wirkGut.push({ name, menge: String(menge), einheit: x?.einheit == null ? null : String(x.einheit), nrv: nrv === null || nrv < 0 ? null : String(nrv) });
        }
        const mikro = Array.isArray(v.mikronaehrstoffe_100g) ? v.mikronaehrstoffe_100g : [];
        const mikroGut: Array<Record<string, unknown>> = [];
        for (const x of mikro as any[]) {
          const name = String(x?.name ?? "").trim();
          const menge = zahlOderNull(x?.menge);
          const einheit = x?.einheit == null ? "" : String(x.einheit).trim();
          if (!name) { untauglich.push("Mikronaehrstoff ohne Namen"); continue; }
          if (menge === null || menge < 0) { untauglich.push(`Mikronaehrstoff "${name}": Menge unbrauchbar`); continue; }
          if (!einheit) { untauglich.push(`Mikronaehrstoff "${name}": Einheit fehlt`); continue; }
          mikroGut.push({ name, menge: String(menge), einheit });
        }
        if (wirkGut.length || mikroGut.length) {
          const { data, error } = await sb.rpc("cb_riki_scan_zusatzdaten_persistieren", {
            p_produkt_id: job.produkt_id,
            p_naehrstoffe: wirkGut,
            p_mikro: mikroGut,
            p_quelle: QUELLE,
          });
          if (error) throw error;
          zusatzStand = data ?? null;
          const dbUntauglich = Array.isArray((data as any)?.untauglich) ? (data as any).untauglich : [];
          for (const u of dbUntauglich) untauglich.push(String(u));
        }
      } catch (e) {
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: {
            schnellcheck: schnell,
            worker: WORKER, ingest: ing, lesung_wiederverwendet: lesungWiederverwendet, dauer_ms: Date.now() - jobStarted,
            untaugliche_zeilen: untauglich,
          },
          p_fehler: `Zusatzdaten-Persistenz fehlgeschlagen: ${fehlerText(e)}`.slice(0, 1000),
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "zusatzpersistenz" });
        continue;
      }

      const meta = {
        schnellcheck: schnell,
        worker: WORKER,
        ean_pruefung: eanPruefung,
        lesung_wiederverwendet: lesungWiederverwendet,
        lesung_abgelegt: lesungAbgelegt,
        // #530: uebersprungene Zeilen bleiben sichtbar. Ein Job darf nicht als
        // sauber gelten, wenn Angaben unterwegs verloren gingen (Kernvertrag B1).
        untaugliche_zeilen: untauglich,
        riki_http: readStatus,
        score_erlaubt: read?.score_erlaubt ?? null,
        warnungen: read?.warnungen ?? [],
        ingest: ing,
        zutaten_rohtext: ing?.zutaten_rohtext ?? null,
        station_quelle: quelleStand,
        zusatzdaten: zusatzStand,
        dauer_ms: Date.now() - jobStarted,
      };
      const { data: finished, error: finishErr } = await sb.rpc("cb_riki_scan_job_abschliessen", {
        p_job_id: job.job_id,
        p_ok: true,
        p_ergebnis_meta: meta,
        p_fehler: null,
      });
      if (finishErr) throw new Error(`finish: ${finishErr.message}`);
      results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: finished?.status ?? "unbekannt", finish: finished });
    }

    return response({ ok: true, verarbeitet: results.length, ergebnisse: results, dauer_ms: Date.now() - started });
  } catch (e) {
    return response({ ok: false, fehler: String(e), dauer_ms: Date.now() - started }, 500);
  }
});
