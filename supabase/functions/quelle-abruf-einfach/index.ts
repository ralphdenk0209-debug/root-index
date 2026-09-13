// quelle-abruf-einfach — Stufe 1 des Quellenwegs (Work #373), Fassung 5.
//
// v5 (2026-09-06, #622): EIN PRODUKT GEZIELT. Bisher war die Arbeitsliste
//   v_quelle_abruf_offen die einzige Bezugsquelle. Wer ein bestimmtes Produkt
//   nannte, bekam trotzdem nichts, sobald es dort herausfiel - etwa weil in den
//   letzten 7 Tagen schon ein Abrufversuch vermerkt war (an P1809 gemessen:
//   ok=true, geprueft=0). Neu: ist produkt_id gesetzt und das Produkt steht
//   nicht in der Arbeitsliste, wird Produkte.Produktlink direkt gelesen. Kein
//   zweiter Abrufweg - dieselbe Verarbeitung, nur eine andere Bezugsquelle
//   fuer die Adresse. Die Arbeitsliste bleibt der Weg fuer den Takt.
//   Sicherung v4: bereiche/_sicherungen/2026-09-06-w622-quelle-abruf-einfach-v4/
//
// v4 (2026-09-05, #519, Ralph-Go 05.09.): STATION QUELLE. Der Abruf speicherte
//   den Zutatentext, schrieb aber nie product_source_state - am Produkt stand
//   damit nicht, woher der Text kam (Kernvertrag B1: jede Zutat mit Quelle).
//   Neu: nach jedem Fall eine Zeile ueber cb_riki_quelle_status_setzen, genau
//   wie riki-scan-worker v3 es fuer das Etikettfoto tut - derselbe Weg, nicht
//   ein zweiter daneben. Auch der erfolglose Abruf wird belegt (nicht_lesbar),
//   sonst sieht ein Produkt ohne Quelle aus wie eins, das nie versucht wurde.
//   Ein Fehler hier bricht den Lauf nicht ab, steht aber im Ergebnis.
//   Sicherung der alten Vault-Fassung (war Fassung 1, nicht die live laufende):
//   bereiche/_sicherungen/2026-09-05-quelle-abruf-einfach-vault-alt/
//
// v3 (2026-09-04): die Arbeitsliste kommt aus v_quelle_abruf_offen, und jeder
//   Versuch wird ueber cb_quelle_abruf_protokoll festgehalten - auch der
//   erfolglose. Damit laeuft die Funktion nicht mehr bei jedem Aufruf gegen
//   dieselben Seiten.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const STEMPEL = "OFF-QAE-";

// #519: ein Datenbankfehler kommt als einfaches Objekt zurueck, nicht als Error.
// String() daraus ergaebe "[object Object]" - derselbe Fall wie #530 im Worker.
function fehlerText(e) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const teile = [e.message, e.code ? "code " + e.code : null, e.details, e.hint]
      .filter((x) => typeof x === "string" && x.length > 0);
    if (teile.length) return teile.join(" | ");
    try { return JSON.stringify(e); } catch { /* faellt unten durch */ }
  }
  return String(e);
}

function htmlZuText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|td|tr|h[1-6]|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&auml;/gi, "ä").replace(/&ouml;/gi, "ö").replace(/&uuml;/gi, "ü")
    .replace(/&Auml;/gi, "Ä").replace(/&Ouml;/gi, "Ö").replace(/&Uuml;/gi, "Ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Harte Bedingungen, nachgeschaerft am 04.09.: der erste Trockenlauf hielt
// Werbezeilen wie "Qualitaet & Zertifizierung" faelschlich fuer Zutatenlisten.
const VERBOTEN =
  /Qualit(ä|ae)t|Zertifiz|Versand|haltbar|Lieferzeit|Datenschutz|Impressum|Newsletter|Rezept|Warenkorb|Anmelden|Kontakt/i;

function istPlausibel(text) {
  const t = text.trim();
  if (t.length < 15 || t.length > 4000) return false;
  if (!/\s/.test(t)) return false;
  if (/!/.test(t)) return false;
  if (t === t.toUpperCase()) return false;
  if (VERBOTEN.test(t)) return false;
  const trenner = (t.match(/[,;]/g) ?? []).length;
  const prozentVorn = /^\s*\d{1,3}\s*%/.test(t);
  if (trenner >= 2) return true;
  if (trenner === 1 && t.length >= 25) return true;
  if (prozentVorn) return true;
  return false;
}

const ABBRUCH =
  "(?:N(?:ä|ae|Ä)hrwert|Durchschnittliche N|Allergene|Kann Spuren|Aufbewahrung|" +
  "Herkunft|Hinweis|Verzehrempfehlung|Zubereitung|Lagerung|Brennwert|Energie|" +
  "GTIN|Artikelnummer|Inhalt:|Bewertung|Weitere Informationen|" +
  "Bei -|haltbar|Lieferzeit|Herkunftsland|Qualit(?:ä|ae)t)";

function ausJsonLd(html) {
  const bloecke = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const b of bloecke) {
    let daten;
    try {
      daten = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const stapel = [daten];
    while (stapel.length) {
      const k = stapel.pop();
      if (Array.isArray(k)) {
        stapel.push(...k);
        continue;
      }
      if (k && typeof k === "object") {
        for (const feld of ["ingredients", "recipeIngredient", "ingredientList"]) {
          const w = k[feld];
          if (typeof w === "string" && istPlausibel(w)) return w.trim();
          if (Array.isArray(w) && w.length) {
            const s = w.filter((x) => typeof x === "string").join(", ");
            if (istPlausibel(s)) return s.trim();
          }
        }
        stapel.push(...Object.values(k));
      }
    }
  }
  return null;
}

function ausText(text) {
  const muster = new RegExp(
    "Zutaten(?:verzeichnis|liste)?\\s*[:\\n]\\s*([\\s\\S]{10,2500}?)" +
      "(?=\\n\\s*\\n|" + ABBRUCH + "|$)",
    "i",
  );
  const t = text.match(muster);
  if (t && istPlausibel(t[1])) return t[1].trim();

  const zeilen = text.split("\n");
  for (let i = 0; i < zeilen.length - 1; i++) {
    if (/^\s*Zutaten(?:verzeichnis|liste)?\s*:?\s*$/i.test(zeilen[i])) {
      const rest = zeilen.slice(i + 1, i + 6).join(" ").trim();
      const bis = rest.split(new RegExp(ABBRUCH, "i"))[0].trim();
      if (istPlausibel(bis)) return bis;
    }
  }
  return null;
}

function zutatenFinden(html) {
  const a = ausJsonLd(html);
  if (a) return { text: a, weg: "json-ld" };
  const b = ausText(htmlZuText(html));
  if (b) return { text: b, weg: "muster" };
  return null;
}

async function einProdukt(pid, url) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return { produkt_id: pid, host: "", ergebnis: "blockiert", grund: "unbrauchbare Adresse" };
  }

  let html = "";
  try {
    const steuer = new AbortController();
    const uhr = setTimeout(() => steuer.abort(), 15000);
    const antwort = await fetch(url, {
      redirect: "follow",
      signal: steuer.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9",
      },
    });
    clearTimeout(uhr);
    if (!antwort.ok) {
      return { produkt_id: pid, host, ergebnis: "blockiert", grund: "HTTP " + antwort.status };
    }
    html = await antwort.text();
  } catch (e) {
    return { produkt_id: pid, host, ergebnis: "blockiert", grund: String(e && e.message ? e.message : e).slice(0, 200) };
  }

  if (html.length < 500) {
    return { produkt_id: pid, host, ergebnis: "blockiert", grund: "Seite kam praktisch leer zurueck" };
  }

  const fund = zutatenFinden(html);
  if (!fund) return { produkt_id: pid, host, ergebnis: "kein_text", grund: "keine Zutatenliste im Seitentext" };

  return {
    produkt_id: pid,
    host,
    ergebnis: "treffer",
    weg: fund.weg,
    zeichen: fund.text.length,
    probe: fund.text.slice(0, 4000),
  };
}

// #519: Station Quelle am Produkt. Derselbe Weg wie im riki-scan-worker v3.
// "eindeutig" nur beim Treffer - ein erfolgloser Abruf wird als "nicht_lesbar"
// belegt, damit ein nie versuchtes Produkt nicht wie ein gescheitertes aussieht.
async function stationQuelleSchreiben(db, fall, url) {
  const treffer = fall.ergebnis === "treffer";
  const { error } = await db.rpc("cb_riki_quelle_status_setzen", {
    p_product_id: fall.produkt_id,
    p_source_kind: "herstellerseite",
    p_discovery_status: treffer ? "eindeutig" : "nicht_lesbar",
    p_source_ref: url,
    p_candidates: [],
    p_note: treffer
      ? "Skript-Abruf ohne Browser (" + fall.weg + "), " + fall.host + ", Fassung 4"
      : "Skript-Abruf ohne Browser: " + (fall.grund ?? fall.ergebnis),
    p_evidence: {
      via: "quelle-abruf-einfach v4",
      host: fall.host,
      ergebnis: fall.ergebnis,
      zeichen: fall.zeichen ?? 0,
      work_id: 519,
    },
  });
  return error ? fehlerText(error) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const antworte = (koerper, status = 200) =>
    new Response(JSON.stringify(koerper), {
      status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  let eingabe = {};
  try {
    eingabe = await req.json();
  } catch {
    eingabe = {};
  }

  const produktId = typeof eingabe.produkt_id === "string" ? eingabe.produkt_id : null;
  const grenze = Math.min(Math.max(Number(eingabe.limit ?? 10) || 10, 1), 40);
  const trockenlauf = eingabe.trockenlauf === true;

  const db = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );

  let frage = db.from("v_quelle_abruf_offen").select('"Produkt_ID","Produktlink"');
  if (produktId) frage = frage.eq("Produkt_ID", produktId);
  else frage = frage.limit(grenze);

  const { data: offen, error: fehlerLesen } = await frage;
  if (fehlerLesen) return antworte({ ok: false, fehler: fehlerLesen.message }, 500);

  // #622: ein benanntes Produkt wird bedient, auch wenn es nicht in der
  // Arbeitsliste steht. Die Adresse kommt dann direkt vom Produkt.
  let liste = offen ?? [];
  let ausserhalbListe = false;
  if (produktId && liste.length === 0) {
    const { data: p, error: fp } = await db
      .from("Produkte")
      .select('"Produkt_ID","Produktlink"')
      .eq("Produkt_ID", produktId)
      .maybeSingle();
    if (fp) return antworte({ ok: false, fehler: fp.message }, 500);
    if (!p) {
      return antworte({ ok: true, geprueft: 0, grund: "Produkt " + produktId + " existiert nicht" });
    }
    if (!p.Produktlink || String(p.Produktlink).trim() === "") {
      return antworte({ ok: true, geprueft: 0, grund: "Produkt " + produktId + " hat keinen Produktlink" });
    }
    liste = [p];
    ausserhalbListe = true;
  }

  const faelle = [];
  let protokollFehler = null;
  let stationFehler = null;
  let stationGeschrieben = 0;

  for (const p of liste) {
    const url = String(p.Produktlink).trim();
    const fall = await einProdukt(p.Produkt_ID, url);
    faelle.push(fall);

    if (!trockenlauf) {
      const heute = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      if (fall.ergebnis === "treffer") {
        await db.from("Zutaten_Rohtext").insert({
          Zutat_Roh_ID: "ZR-" + fall.produkt_id + "-" + STEMPEL + heute,
          Produkt_ID: fall.produkt_id,
          Zutatenliste_Rohtext: fall.probe,
          Kommentar:
            "Herstellerseite " + fall.host + ", einfacher Abruf ohne Browser (" + fall.weg + "), " +
            new Date().toISOString().slice(0, 10) + ". Work #373 Stufe 1. " +
            "Rueckholbar ueber Zutat_Roh_ID-Muster %-" + STEMPEL + heute + ".",
        });
      }

      // #519: Station Quelle. Ein Fehler hier bricht den Lauf nicht ab.
      const sf = await stationQuelleSchreiben(db, fall, url);
      if (sf) { if (!stationFehler) stationFehler = sf; } else { stationGeschrieben++; }

      const { error: pf } = await db.rpc("cb_quelle_abruf_protokoll", {
        p_produkt_id: fall.produkt_id,
        p_status: fall.ergebnis,
        p_host: fall.host,
        p_detail: fall.grund ?? fall.weg ?? null,
        p_evidence: { zeichen: fall.zeichen ?? 0, work_id: 373 },
      });
      if (pf && !protokollFehler) protokollFehler = fehlerText(pf);
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return antworte({
    ok: true,
    trockenlauf,
    ausserhalb_arbeitsliste: ausserhalbListe,
    protokoll_fehler: protokollFehler,
    station_quelle_geschrieben: stationGeschrieben,
    station_quelle_fehler: stationFehler,
    geprueft: faelle.length,
    treffer: faelle.filter((f) => f.ergebnis === "treffer").length,
    kein_text: faelle.filter((f) => f.ergebnis === "kein_text").length,
    blockiert: faelle.filter((f) => f.ergebnis === "blockiert").length,
    faelle: faelle.map((f) => ({ produkt_id: f.produkt_id, ergebnis: f.ergebnis, weg: f.weg, zeichen: f.zeichen, grund: f.grund })),
  });
});
