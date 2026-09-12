#!/usr/bin/env node
/* =============================================================================
   Root Index – Produktseiten-Generator (Work: Google-Auffindbarkeit, 27.08.2026)
   -----------------------------------------------------------------------------
   Erzeugt aus der oeffentlichen Web-Sicht (v_web_produkte, Gast-Leseweg aus
   Work #186) statische HTML-Seiten, damit Google jedes Produkt unter einer
   eigenen URL findet:

     produkt/<slug>.html         eine Seite je Produkt
     produkt/kategorie-<x>.html  eine Seite je Kategorie (Linkstruktur)
     produkt/index.html          Einstieg / Verzeichnis
     sitemap.xml                 alle URLs fuer Google
     robots.txt                  Verweis auf die Sitemap

   WOHER DIE ZUGANGSDATEN KOMMEN: aus app.js gelesen (eine Regel, ein Ort).
   Der anon-Key ist oeffentlich – er steht in jeder ausgelieferten app.js.

   WO ES LAEUFT (seit 12.09.2026, Work #726): in GitHub Actions
   (.github/workflows/produktseiten.yml), nicht mehr in Deploy.command. Das Repo
   ist seit E47 die Wahrheit; der Vault-Ordner webseite/ ist Altlast.

   AUFRUF:
     node _werkzeuge/produktseiten-generieren.mjs      (aus dem Repo-Wurzelordner)
   Test ohne Netz:
     node ... --aus-datei fixture.json
   -----------------------------------------------------------------------------
   REGELN: Nichts erfinden – fehlende Felder werden weggelassen, nie mit 0
   gefuellt. Die Seite ZEIGT nur den Serverzustand (Kernvertrag B1), sie
   berechnet nichts nach.
   ============================================================================= */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));   // .../webseite/_werkzeuge
// RI_WEB erlaubt dem Deploy-Trockenlauf, in seine Temp-Kopie zu schreiben,
// ohne den Vault anzufassen. Ohne RI_WEB: der eigene webseite/-Ordner.
const WEB  = process.env.RI_WEB || dirname(HIER);        // .../webseite
const ZIEL = join(WEB, "produkt");
const DOMAIN = "https://root-index.de";

const FELDER = "id,name,marke,kategorie,unterkategorie,clean_score,bewertung,score_vollstaendig,zutaten,m_kcal,m_protein,m_fett,m_ges_fett,m_kh,m_zucker,m_ballast,m_salz,ean,bio,inhalt_menge,inhalt_einheit,mengen_einheit,verifiziert_am,form";

/* ---------- Zugangsdaten aus app.js (nicht duplizieren) ---------- */
function ausAppJs() {
  const app = readFileSync(join(WEB, "app.js"), "utf8");
  const url = app.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const key = app.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/);
  if (!url || !key) throw new Error("SUPABASE_URL/KEY nicht in app.js gefunden");
  return { url: url[1], key: key[1] };
}

/* ---------- Daten holen (Schluesselfenster, Gast-Leseweg) ----------
   Die Sicht rechnet die Zutatenliste je Zeile nach - rund 20 ms pro Produkt.
   Alles Weitere folgt daraus, gemessen an den Laeufen vom 12.09.:

   - count=exact rechnet die ganze Sicht einmal durch und reisst den
     Statement-Timeout sofort (Lauf #4).
   - Range/OFFSET hilft nicht: der Server muss auch die uebersprungenen Zeilen
     ausrechnen. Bei Zeile 550 waren das schon 600 Zeilen und damit ueber acht
     Sekunden - Lauf #5 starb genau dort, obwohl die Seite nur 50 Zeilen gross
     war. Tiefer in der Liste waere es immer schlimmer geworden.

   Deshalb blaettert der Lauf am Schluessel entlang: jede Anfrage holt die
   naechsten 200 Produkte NACH der zuletzt gesehenen id. Der Server rechnet
   dann nur diese 200 aus, gleich am Anfang wie am Ende der Liste. Das ist
   zwangslaeufig der Reihe nach - rund zehn Minuten fuer den ganzen Bestand,
   einmal am Tag. */
const STUFEN = [200, 80, 30, 10, 3];   // faellt eine Anfrage aus, wird sie kleiner

async function holeAb(url, key, letzteId) {
  const nach = letzteId ? `&id=gt.${encodeURIComponent(letzteId)}` : "";
  let fehler = "";
  // Ein paar Produkte tragen so viele Zutaten, dass selbst 200 Zeilen zu lange
  // rechnen (Lauf #6 blieb bei P63715 stehen). Statt aufzugeben wird die
  // Anfrage kleiner - notfalls bis auf drei Zeilen, dann kommt jedes Produkt
  // durch, und der Lauf verliert nur an dieser einen Stelle Zeit.
  for (const groesse of STUFEN) {
    for (let versuch = 1; versuch <= 2; versuch++) {
      let r = null;
      try {
        r = await fetch(`${url}/rest/v1/v_web_produkte?select=${FELDER}&order=id&limit=${groesse}${nach}`, {
          headers: { apikey: key },
        });
        if (r.ok) return await r.json();
        fehler = `REST ${r.status}: ${(await r.text()).slice(0, 160)}`;
      } catch (e) {
        fehler = `Netzfehler: ${e.message}`;
      }
      await new Promise((f) => setTimeout(f, 1500 * versuch));
    }
    console.log(`  ! nach id ${letzteId}: ${groesse} Zeilen gingen nicht, versuche kleiner`);
  }
  throw new Error(`nach id ${letzteId} auch mit ${STUFEN[STUFEN.length - 1]} Zeilen nicht zu holen - ${fehler}`);
}

async function alleProdukte() {
  const { url, key } = ausAppJs();
  console.log("Lade am Schluessel entlang, Seitengroesse " + STUFEN.join("/") + " ...");
  const alle = [];
  let letzteId = null;
  while (true) {
    const teil = await holeAb(url, key, letzteId);
    if (teil.length === 0) break;
    alle.push(...teil);
    letzteId = teil[teil.length - 1].id;
    if (alle.length % 2000 < STUFEN[0]) console.log(`  ... ${alle.length} Produkte (zuletzt ${letzteId})`);
  }
  console.log(`Fertig geladen: ${alle.length} Produkte`);
  return alle;
}

/* ---------- Helfer ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function slug(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
function zahl(v) { const n = num(v); return n === null ? null : String(n).replace(".", ","); }

/* ---------- Seitengeruest ---------- */
function seite({ titel, beschreibung, kanonisch, inhalt, jsonld }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<link rel="canonical" href="${kanonisch}">
<link rel="icon" href="/icon-192.png">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschreibung)}">
<meta property="og:url" content="${kanonisch}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Root Index">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<style>
:root{--green:#2e7d46;--line:#e3e8e3;--muted:#667066;--bg:#fbfdfb}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:#1c241c;line-height:1.55}
.kopf{background:var(--green);color:#fff;padding:14px 18px}.kopf a{color:#fff;text-decoration:none;font-weight:700}
main{max-width:760px;margin:0 auto;padding:18px}
h1{font-size:1.45rem;margin:.3em 0 .1em}
.marke{color:var(--muted);margin:0 0 12px}
.score{display:inline-block;background:var(--green);color:#fff;border-radius:9px;padding:6px 14px;font-weight:700;margin:6px 0 14px}
table{border-collapse:collapse;width:100%;max-width:430px}
td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;font-size:.95rem}
th{color:var(--muted);font-weight:600}
ul.zt{padding-left:0;list-style:none}ul.zt li{border-bottom:1px solid var(--line);padding:6px 2px}
.krit{color:#a33}
h2{font-size:1.05rem;margin-top:22px}
.fuss{margin:34px 0 20px;padding-top:14px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
.liste a{display:block;padding:7px 2px;border-bottom:1px solid var(--line);text-decoration:none;color:#1c241c}
.liste a b{color:var(--green)}
nav.krumen{font-size:.85rem;margin-bottom:6px}nav.krumen a{color:var(--green)}
</style>
</head>
<body>
<div class="kopf"><a href="/">🌱 Root Index</a></div>
<main>
${inhalt}
<p class="fuss">Root Index liefert Informationen zur Zusammensetzung von Lebensmitteln.
Keine medizinische oder ernährungstherapeutische Beratung.
· <a href="/">Zur App</a> · <a href="/produkt/">Produktverzeichnis</a></p>
</main>
</body>
</html>`;
}

/* ---------- Produktseite ---------- */
const NAEHRWERTE = [
  ["m_kcal", "Energie", "kcal"], ["m_protein", "Eiweiß", "g"], ["m_fett", "Fett", "g"],
  ["m_ges_fett", "davon gesättigt", "g"], ["m_kh", "Kohlenhydrate", "g"], ["m_zucker", "davon Zucker", "g"],
  ["m_ballast", "Ballaststoffe", "g"], ["m_salz", "Salz", "g"],
];

function produktSeite(p, datei, katDatei) {
  const name = p.name;
  // Traegt der Name die Marke schon ("dmBio Haferflocken"), waere "von dmBio"
  // im Titel eine Dopplung - Google zeigt den Titel genau so an, wie er hier steht.
  const marke = p.marke && !String(p.name).toLowerCase().startsWith(String(p.marke).toLowerCase()) ? p.marke : "";
  const kanonisch = `${DOMAIN}/produkt/${datei}`;
  const basis = (p.mengen_einheit || "g").toLowerCase() === "ml" ? "100 ml" : "100 g";
  const titel = `${name}${marke ? " von " + marke : ""} – Bewertung, Zutaten & Nährwerte | Root Index`;
  const score = num(p.clean_score);
  const beschreibung = [
    score !== null ? `Root-Index-Bewertung: ${score}/100${p.bewertung ? " (" + p.bewertung + ")" : ""}.` : null,
    `Zutaten und Nährwerte je ${basis} für ${name}${marke ? " von " + marke : ""}.`,
    p.kategorie ? `Kategorie: ${p.kategorie}.` : null,
  ].filter(Boolean).join(" ").slice(0, 300);

  const zutaten = Array.isArray(p.zutaten) ? p.zutaten.filter((z) => z && z.name) : [];
  const nz = NAEHRWERTE.map(([f, l, e]) => (num(p[f]) !== null ? `<tr><th>${l}</th><td>${zahl(p[f])} ${e}</td></tr>` : "")).join("");

  const jsonld = {
    "@context": "https://schema.org", "@type": "Product",
    name, url: kanonisch,
    ...(marke ? { brand: { "@type": "Brand", name: marke } } : {}),
    ...(p.kategorie ? { category: p.kategorie } : {}),
    ...(/^\d{13}$/.test(p.ean || "") ? { gtin13: p.ean } : {}),
    description: beschreibung,
  };

  const inhalt = `
<nav class="krumen"><a href="/produkt/">Produkte</a>${p.kategorie ? ` › <a href="/produkt/${katDatei}">${esc(p.kategorie)}</a>` : ""}</nav>
<h1>${esc(name)}</h1>
${p.marke ? `<p class="marke">${esc(p.marke)}${p.unterkategorie ? " · " + esc(p.unterkategorie) : ""}${p.bio === true ? " · Bio" : ""}</p>` : ""}
${score !== null ? `<div class="score">Root-Index-Bewertung: ${score}/100${p.bewertung ? " · " + esc(p.bewertung) : ""}</div>` : ""}
${zutaten.length ? `<h2>Zutaten (${zutaten.length})</h2><ul class="zt">${zutaten.map((z) =>
    `<li>${esc(z.name)}${num(z.rating) !== null ? ` – Note ${z.rating}/10` : ""}${z.kritisch ? ` <span class="krit">· kritisch</span>` : ""}</li>`).join("")}</ul>` : ""}
${nz ? `<h2>Nährwerte je ${basis}</h2><table>${nz}</table>` : ""}
${p.ean ? `<p>EAN: ${esc(p.ean)}</p>` : ""}
${p.inhalt_menge ? `<p>Inhalt: ${zahl(p.inhalt_menge)} ${esc(p.inhalt_einheit || "")}</p>` : ""}
<p><a href="/">→ Dieses Produkt in der Root-Index-App ansehen</a></p>`;

  return seite({ titel, beschreibung, kanonisch, inhalt, jsonld });
}

/* ---------- Hauptlauf ---------- */
async function main() {
  const argDatei = process.argv.indexOf("--aus-datei");
  const produkte = argDatei > -1
    ? JSON.parse(readFileSync(process.argv[argDatei + 1], "utf8"))
    : await alleProdukte();

  if (!Array.isArray(produkte) || produkte.length === 0) throw new Error("0 Produkte erhalten – Abbruch, nichts geschrieben.");

  mkdirSync(ZIEL, { recursive: true });
  // Vollstaendige Neuerzeugung: alte generierte Seiten entfernen (keine Waisen).
  for (const f of readdirSync(ZIEL)) if (f.endsWith(".html")) unlinkSync(join(ZIEL, f));

  const urls = [`${DOMAIN}/`, `${DOMAIN}/produkt/`];
  const proKat = new Map();
  const vergeben = new Set();
  let geschrieben = 0;

  for (const p of produkte) {
    if (!p || !p.id || !p.name) continue;
    const markeDoppelt = p.marke && String(p.name).toLowerCase().startsWith(String(p.marke).toLowerCase());
    let datei = `${slug([markeDoppelt ? null : p.marke, p.name].filter(Boolean).join(" "))}-${slug(p.id)}.html`;
    if (vergeben.has(datei)) datei = `${slug(p.id)}-${datei}`;
    vergeben.add(datei);
    const kat = p.kategorie || "Weitere Produkte";
    const katDatei = `kategorie-${slug(kat)}.html`;
    if (!proKat.has(kat)) proKat.set(kat, { datei: katDatei, eintraege: [] });
    proKat.get(kat).eintraege.push({ p, datei });
    writeFileSync(join(ZIEL, datei), produktSeite(p, datei, katDatei));
    urls.push(`${DOMAIN}/produkt/${datei}`);
    geschrieben++;
  }

  // Kategorieseiten
  const kats = [...proKat.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  for (const [kat, { datei, eintraege }] of kats) {
    eintraege.sort((a, b) => String(a.p.name).localeCompare(String(b.p.name), "de"));
    const inhalt = `
<nav class="krumen"><a href="/produkt/">Produkte</a></nav>
<h1>${esc(kat)}</h1>
<p class="marke">${eintraege.length} Produkte mit Root-Index-Bewertung, Zutaten und Nährwerten.</p>
<div class="liste">${eintraege.map(({ p, datei }) =>
      `<a href="/produkt/${datei}">${esc(p.name)}${p.marke ? " · " + esc(p.marke) : ""}${num(p.clean_score) !== null ? ` <b>${p.clean_score}/100</b>` : ""}</a>`).join("")}</div>`;
    writeFileSync(join(ZIEL, datei), seite({
      titel: `${kat} – Produkte mit Bewertung | Root Index`,
      beschreibung: `${eintraege.length} Produkte der Kategorie ${kat} mit Root-Index-Bewertung, Zutatenliste und Nährwerten je 100 g.`,
      kanonisch: `${DOMAIN}/produkt/${datei}`, inhalt, jsonld: null,
    }));
    urls.push(`${DOMAIN}/produkt/${datei}`);
  }

  // Verzeichnis-Einstieg
  writeFileSync(join(ZIEL, "index.html"), seite({
    titel: "Produktverzeichnis – alle bewerteten Produkte | Root Index",
    beschreibung: `${geschrieben} Lebensmittel und Supplements mit Root-Index-Bewertung, Zutaten-Check und Nährwerten – nach Kategorien sortiert.`,
    kanonisch: `${DOMAIN}/produkt/`,
    inhalt: `<h1>Produktverzeichnis</h1>
<p class="marke">${geschrieben} Produkte in ${kats.length} Kategorien – jede Seite zeigt Bewertung, Zutaten und Nährwerte.</p>
<div class="liste">${kats.map(([kat, { datei, eintraege }]) => `<a href="/produkt/${datei}">${esc(kat)} <b>${eintraege.length}</b></a>`).join("")}</div>`,
    jsonld: null,
  }));

  // Sitemap + robots
  writeFileSync(join(WEB, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
  writeFileSync(join(WEB, "robots.txt"),
    `User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: ${DOMAIN}/sitemap.xml\n`);

  console.log(`✅ Produktseiten: ${geschrieben} · Kategorien: ${kats.length} · Sitemap-URLs: ${urls.length}`);
  if (geschrieben < 100 && argDatei === -1) console.log("⚠️  Ungewoehnlich wenige Produkte – v_web_produkte pruefen.");
}

main().catch((e) => { console.error("❌ Produktseiten-Generator: " + e.message); process.exit(1); });
