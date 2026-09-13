// RIKI-SCAN-WORKER
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
          p_ergebnis_meta: { worker: "riki-scan-worker v4", dauer_ms: Date.now() - jobStarted },
          p_fehler: "Keine verwertbaren Fotos im RIKI-Job.",
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "keine_fotos" });
        continue;
      }

      let read: any = null;
      let readStatus = 0;
      try {
        const r = await fetch(`${url}/functions/v1/riki-etikett`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bilder: images, ean: job.ean || undefined }),
        });
        readStatus = r.status;
        read = await r.json().catch(() => null);
        if (!r.ok || !read?.vorschlag) {
          const msg = read?.error ?? read?.fehler ?? `riki-etikett HTTP ${r.status}`;
          await sb.rpc("cb_riki_scan_job_abschliessen", {
            p_job_id: job.job_id,
            p_ok: false,
            p_ergebnis_meta: { worker: "riki-scan-worker v4", riki_http: r.status, dauer_ms: Date.now() - jobStarted },
            p_fehler: String(msg).slice(0, 1000),
          });
          results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "riki_etikett", http: r.status });
          continue;
        }
      } catch (e) {
        const msg = String(e);
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: { worker: "riki-scan-worker v4", dauer_ms: Date.now() - jobStarted },
          p_fehler: msg.slice(0, 1000),
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "riki_fetch" });
        continue;
      }

      const v = read.vorschlag;
      const zusatz = v.zusatzstoffe ?? {};
      // KP-468: Etikettwortlaut in Etikettreihenfolge, aus original_text je Zutat.
      // Kein Gesamtfeld in riki-etikett - das hier ist die verlustfreie Kette der
      // Einzelzeilen, nicht ein neu gelesener Text. Steht so im Kommentar der Zeile.
      const rohtext = Array.isArray(v.zutaten)
        ? v.zutaten.map((z: any) => String(z?.original_text ?? z?.name ?? "").trim()).filter(Boolean).join(", ")
        : "";
      const payload: any = {
        produkt_id: job.produkt_id,
        ean: job.ean || null,
        name: v.name ?? null,
        marke: v.marke ?? null,
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
          p_ergebnis_meta: { worker: "riki-scan-worker v4", riki_http: readStatus, dauer_ms: Date.now() - jobStarted },
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
          p_ergebnis_meta: { worker: "riki-scan-worker v4", riki_http: readStatus, dauer_ms: Date.now() - jobStarted },
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
      try {
        const wirk = Array.isArray(v.wirkstoffe) ? v.wirkstoffe : [];
        if (wirk.length) {
          const zeilen = wirk.map((x: any, idx: number) => ({
            Produkt_ID: job.produkt_id,
            naehrstoff: String(x?.name ?? ""),
            menge: zahlOderNull(x?.menge),
            einheit: x?.einheit == null ? null : String(x.einheit),
            nrv_prozent: zahlOderNull(x?.nrv),
            sort: idx + 1,
            quelle: "Etikettfoto (RIKI-Hintergrundlauf)",
            verifiziert: false,
          }));
          for (const z of zeilen) {
            if (!z.naehrstoff) untauglich.push("Naehrstoff ohne Namen");
            else if (z.menge === null) untauglich.push(`Naehrstoff "${z.naehrstoff}": Menge unbrauchbar (${JSON.stringify(wirk.find((w: any) => String(w?.name ?? "") === z.naehrstoff)?.menge)})`);
          }
          const gut = zeilen.filter((z) => z.naehrstoff && z.menge !== null);
          if (gut.length) {
            await sb.from("Produkt_Naehrstoffe").delete().eq("Produkt_ID", job.produkt_id);
            const { error } = await sb.from("Produkt_Naehrstoffe").insert(gut);
            if (error) throw error;
          }
        }
        const mikro = Array.isArray(v.mikronaehrstoffe_100g) ? v.mikronaehrstoffe_100g : [];
        if (mikro.length) {
          const zeilen = mikro.map((x: any) => ({
            Produkt_ID: job.produkt_id,
            Naehrstoff: String(x?.name ?? ""),
            Menge_100g: zahlOderNull(x?.menge),
            Einheit: x?.einheit == null ? null : String(x.einheit),
            Quelle_Status: "Etikettfoto (RIKI-Hintergrundlauf)",
          }));
          for (const z of zeilen) {
            if (!z.Naehrstoff) untauglich.push("Mikronaehrstoff ohne Namen");
            else if (z.Menge_100g === null) untauglich.push(`Mikronaehrstoff "${z.Naehrstoff}": Menge unbrauchbar`);
            else if (!z.Einheit) untauglich.push(`Mikronaehrstoff "${z.Naehrstoff}": Einheit fehlt`);
          }
          const gut = zeilen.filter((z) => z.Naehrstoff && z.Menge_100g !== null && z.Einheit);
          if (gut.length) {
            await sb.from("Produkt_Mikronaehrstoffe").delete().eq("Produkt_ID", job.produkt_id);
            const { error } = await sb.from("Produkt_Mikronaehrstoffe").insert(gut);
            if (error) throw error;
          }
        }
      } catch (e) {
        await sb.rpc("cb_riki_scan_job_abschliessen", {
          p_job_id: job.job_id,
          p_ok: false,
          p_ergebnis_meta: {
            worker: "riki-scan-worker v4", ingest: ing, dauer_ms: Date.now() - jobStarted,
            untaugliche_zeilen: untauglich,
          },
          p_fehler: `Zusatzdaten-Persistenz fehlgeschlagen: ${fehlerText(e)}`.slice(0, 1000),
        });
        results.push({ job_id: job.job_id, produkt_id: job.produkt_id, status: "fehler", grund: "zusatzpersistenz" });
        continue;
      }

      const meta = {
        worker: "riki-scan-worker v4",
        // #530: uebersprungene Zeilen bleiben sichtbar. Ein Job darf nicht als
        // sauber gelten, wenn Angaben unterwegs verloren gingen (Kernvertrag B1).
        untaugliche_zeilen: untauglich,
        riki_http: readStatus,
        score_erlaubt: read?.score_erlaubt ?? null,
        warnungen: read?.warnungen ?? [],
        ingest: ing,
        zutaten_rohtext: ing?.zutaten_rohtext ?? null,
        station_quelle: quelleStand,
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
