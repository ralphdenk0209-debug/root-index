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

const FELDER = "id,name,marke,kategorie,unterkategorie,clean_score,bewertung,score_vollstaendig,zutaten,p_zutaten,p_zusatzstoffe,p_nova,p_naehrwert,ernaehrungsform,quelle,warum,m_kcal,m_protein,m_fett,m_ges_fett,m_kh,m_zucker,m_ballast,m_salz,ean,bio,inhalt_menge,inhalt_einheit,mengen_einheit,verifiziert_am,form";

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
/* ---------- Besucherzaehler (Ralph 21.09.2026) ----------
   Ohne Cookie, ohne Kennung, ohne IP in der Datenbank: die Seite meldet nur
   "an diesem Tag wurde diese Adresse aus dieser Richtung aufgerufen", der
   Server zaehlt Tagessummen hoch (cb_seite_zaehlen). Kein Besucher laesst
   sich wiedererkennen - deshalb braucht es auch kein Einwilligungsbanner.
   Suchmaschinen-Robots fuehren JavaScript aus und wuerden sonst mitgezaehlt;
   sie werden am Browserkennzeichen aussortiert. */
let _zaehlerJs = null;
function zaehlerJs() {
  if (_zaehlerJs) return _zaehlerJs;
  const { url, key } = ausAppJs();
  _zaehlerJs = `<script>(function(){try{
if(/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent))return;
var r=document.referrer,q="direkt";
if(r){var h="";try{h=new URL(r).hostname}catch(e){}
q=/(^|\\.)google\\./.test(h)?"google":/bing\\./.test(h)?"bing":/duckduckgo|ecosia|yahoo|qwant|startpage|brave/.test(h)?"andere-suche":/root-index\\.de$/.test(h)?"intern":"andere";}
fetch("${url}/rest/v1/rpc/cb_seite_zaehlen",{method:"POST",keepalive:true,headers:{"apikey":"${key}","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_quelle:q})}).catch(function(){});
}catch(e){}})();</script>`;
  return _zaehlerJs;
}

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
:root{--green:#34D399;--greendk:#047857;--greenlt:#ECFDF5;--line:#e4e8e2;--muted:#6b6256;--bg:#eef1ec;--card:#fff;--ink:#1d3c24}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}
/* Kopf wie in der App: Logo und Wortmarke, heller Grund - nicht der gruene
   Balken von vorher. Wer aus der Suche kommt, soll dieselbe Seite sehen. */
.kopf{background:var(--card);border-bottom:1px solid var(--line);padding:10px 18px}
.kopf a{display:inline-flex;align-items:center;gap:.55em;color:var(--greendk);text-decoration:none;font-weight:700;font-size:1.05rem}
.kopf img{height:34px;width:auto}
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
p.einordnung{margin:.2em 0 1em;max-width:62ch}
.karte{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 14px 4px;box-shadow:0 1px 3px rgba(20,40,28,.05)}
.flux{width:250px;max-width:82%;margin:6px auto 0}
.wort{text-align:center;font-size:1.3rem;font-weight:800;margin:2px 0 0}
.rang{margin:12px 0 0;border-radius:12px;padding:10px 12px;font-size:.8rem;line-height:1.55}
.kacheln{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 4px}
@media(max-width:520px){.kacheln{grid-template-columns:repeat(2,1fr)}}
.kachel{background:var(--bg);border-radius:10px;padding:8px 9px;min-width:0}
.appbtn{display:block;margin:12px 0 2px;padding:11px 14px;border-radius:10px;background:var(--greenlt);border:1px solid #a7e3c6;color:var(--greendk);font-weight:700;text-align:center;text-decoration:none;font-size:.92rem}
.kachel .l{font-size:.72rem;color:var(--muted)}
.kachel .v{font-size:.94rem;font-weight:600;white-space:nowrap}
.pille{display:inline-block;border-radius:999px;padding:3px 10px;font-size:.76rem;font-weight:600;margin:4px 0 2px}
details{border-top:1px solid var(--line)}
summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:11px 2px;font-size:.88rem}
summary::-webkit-details-marker{display:none}
summary .pf{color:var(--muted);font-size:.75rem}
details>div{padding:2px 2px 12px}
.zeile{display:flex;justify-content:space-between;font-size:.82rem;padding:5px 0;border-bottom:1px solid var(--line)}
.zeile span:first-child{color:var(--muted)}
h1{font-size:1.3rem}
main{max-width:720px}
.fuss{margin:34px 0 20px;padding-top:14px;border-top:1px solid var(--line);font-size:.8rem;color:var(--muted)}
.liste a{display:block;padding:7px 2px;border-bottom:1px solid var(--line);text-decoration:none;color:#1c241c}
.liste a b{color:var(--green)}
nav.krumen{font-size:.85rem;margin-bottom:6px}nav.krumen a{color:var(--green)}
</style>
</head>
<body>
<div class="kopf"><a href="/"><img src="/logo-mark.png" alt="" onerror="this.style.display='none'">Root Index</a></div>
<main>
${inhalt}
<p class="fuss">Root Index liefert Informationen zur Zusammensetzung von Lebensmitteln.
Keine medizinische oder ernährungstherapeutische Beratung.
· <a href="/">Zur App</a> · <a href="/produkt/">Produktverzeichnis</a></p>
</main>
${zaehlerJs()}
</body>
</html>`;
}

/* ---------- Produktseite ----------
   Die Seite soll aussehen wie die Produktkarte in der App (Ralph 17.09.2026):
   Fluxkompensator mit den vier Achsen, Notenwort, Platz in der Kategorie,
   Nährwert-Kacheln, aufklappbare Kapitel. Uebernommen aus app.js (pkFlux,
   kachel, ACC, katRangHtml, farbe/farbeText) - mit zwei Unterschieden:

   - Keine Animation und kein Count-up. Eine statische Seite hat kein
     JavaScript, und Google soll die Zahl im Quelltext finden, nicht in
     einem Bewegungsablauf.
   - Farben als echte Werte statt als CSS-Variablen: diese Seiten laden
     ui.css nicht, eine Variable ohne Definition waere schwarz auf schwarz.
   Die Aufklappkapitel sind <details> - das ist HTML, kein Skript, und der
   Inhalt steht trotzdem im Quelltext. */
const NAEHRWERTE = [
  ["m_kcal", "Energie", "kcal"], ["m_protein", "Eiweiß", "g"], ["m_fett", "Fett", "g"],
  ["m_ges_fett", "davon gesättigt", "g"], ["m_kh", "Kohlenhydrate", "g"], ["m_zucker", "davon Zucker", "g"],
  ["m_ballast", "Ballaststoffe", "g"], ["m_salz", "Salz", "g"],
];

const RING = { "Sehr gut": "#16a34a", "Gut": "#65a30d", "Mittel": "#e8920c", "Schwach": "#dc2626" };
const SCHRIFT = { "Sehr gut": "#15803d", "Gut": "#4d7c0f", "Mittel": "#b45309", "Schwach": "#b91c1c" };

/* Der Fluxkompensator: vier Bahnen, vier Kappen, ein Ring mit der Zahl.
   Geometrie eins zu eins aus app.js - dieselbe Marke soll dieselbe Form haben. */
function fluxSvg(p, score, ringfarbe) {
  const A = [
    { v: num(p.p_zutaten), max: 30, f: "#16a34a" },
    { v: num(p.p_zusatzstoffe), max: 15, f: "#3987e5" },
    { v: num(p.p_nova), max: 15, f: "#7c6fe0" },
    { v: num(p.p_naehrwert) !== null ? num(p.p_naehrwert) * 2 : null, max: 40, f: "#d97706" },
  ].map((a) => ({ ...a, pct: a.v === null ? null : Math.max(0, Math.min(1, a.v / a.max)) }));
  const L = 92;
  const bahn = ["M26 34 H74 L106 64", "M274 34 H226 L194 64", "M26 142 H74 L106 112", "M274 142 H226 L194 112"];
  const kap = [[26, 34], [274, 34], [26, 142], [274, 142]];
  const ziel = score === null ? "–" : String(Math.round(score));
  return `<svg viewBox="0 0 300 176" style="width:100%;display:block" role="img" aria-label="Root Index ${ziel} von 100, vier Achsen">`
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">`
    + bahn.map((d) => `<path d="${d}" stroke="rgba(120,120,120,.16)"/>`).join("")
    + A.map((a, i) => `<path d="${bahn[i]}" stroke="${a.pct === null ? "rgba(120,120,120,.28)" : a.f}" stroke-dasharray="${L}" stroke-dashoffset="${(a.pct === null ? L : L * (1 - a.pct)).toFixed(1)}"/>`).join("")
    + `</g>`
    + A.map((a, i) => `<circle cx="${kap[i][0]}" cy="${kap[i][1]}" r="7" fill="${a.pct === null ? "#9aa7a0" : a.f}"/>`).join("")
    + `<circle cx="150" cy="88" r="42" fill="none" stroke="${score === null ? "#9aa7a0" : ringfarbe}" stroke-width="5"/>`
    + `<text x="150" y="103" text-anchor="middle" style="font-size:44px;font-weight:800" fill="#1c241c">${ziel}</text>`
    + `</svg>`;
}

function pille(ef) {
  const m = { "vegan": ["🌱", "#e7f4ec", "#1f5e34"], "vegetarisch": ["🥚", "#eef6e9", "#4d7c0f"], "enthält Tierprodukte": ["🥩", "#f3eee6", "#7c5e3a"] };
  const t = m[String(ef || "")];
  return t ? `<span class="pille" style="background:${t[1]};color:${t[2]}">${t[0]} ${esc(ef)}</span>` : "";
}

function kachel(p, feld, label, einheit) {
  const roh = num(p[feld]);
  if (roh === null) return "";
  const wert = feld === "m_kcal" ? Math.round(roh) : Math.round(roh * 10) / 10;
  return `<div class="kachel"><div class="l">${label}</div><div class="v">${String(wert).replace(".", ",")} ${einheit}</div></div>`;
}

function acc(icon, titel, inner) {
  return `<details><summary><span>${icon} ${titel}</span><span class="pf">▾</span></summary><div>${inner}</div></details>`;
}

/* Platz in der eigenen Kategorie. Aus app.js (katRang): ein Score ohne Maßstab
   verfuehrt zu sinnlosen Vergleichen - ein Oel mit einem Brot zu vergleichen
   entscheidet niemand. */
function rangHtml(rang, kat) {
  if (!rang) return "";
  const anteil = rang.platz / rang.gesamt;
  const f = anteil <= 0.25 ? "#166534" : (anteil <= 0.6 ? "#8a5a0b" : "#b45309");
  const bg = anteil <= 0.25 ? "#eaf5ee" : "#fff7ea";
  const bd = anteil <= 0.25 ? "#e3e8e3" : "#e4a343";
  return `<div class="rang" style="background:${bg};border:1px solid ${bd}">`
    + `<b style="color:${f}">🏆 Platz ${rang.platz} von ${rang.gesamt} in „${esc(kat)}"</b>`
    + `<div style="color:var(--muted);margin-top:3px">Der Index vergleicht <b>innerhalb der Kategorie</b>. Ein Öl mit einem Brot zu vergleichen ergibt keinen Sinn – ein Öl mit einem anderen Öl schon.</div></div>`;
}

function produktSeite(p, datei, katDatei, kat, alternativen, rang) {
  const name = p.name;
  // Im Stamm stehen Handelsmarken oft als Kommaliste in einem Feld
  // ("Best Moments,Guschlbauer,Penny"). So gehoert das nicht in einen
  // Seitentitel, den Google eins zu eins anzeigt - im Titel steht die erste,
  // die vollstaendige Liste steht lesbar unter der Ueberschrift.
  const marken = String(p.marke || "").split(",").map((t) => t.trim()).filter(Boolean);
  const markeVoll = marken.join(" · ");
  const erste = marken[0] || "";
  const marke = erste && !String(p.name).toLowerCase().startsWith(erste.toLowerCase()) ? erste : "";
  const kanonisch = `${DOMAIN}/produkt/${datei}`;
  const basis = (p.mengen_einheit || "g").toLowerCase() === "ml" ? "100 ml" : "100 g";
  // Titel wie gesucht wird (Search Console, 21.09.2026): Marke vorne, dann das
  // Produkt - "böklunder rindergulasch", "milsani panna cotta". Und das Wort,
  // das die Leute tippen: "hanuta inhaltsstoffe", nicht "Bewertung".
  // Traegt der Name die Marke schon, bleibt es beim Namen allein.
  const titel = `${marke ? marke + " " : ""}${name} – Zutaten, Inhaltsstoffe & Bewertung | Root Index`;
  const score = num(p.clean_score);
  const voll = p.score_vollstaendig !== false;
  const wort = voll ? (p.bewertung || "") : "Vorläufig";
  const ringfarbe = RING[p.bewertung] || "#9aa7a0";
  const schrift = SCHRIFT[p.bewertung] || "#57534e";
  const beschreibung = [
    score !== null ? `Root-Index-Bewertung: ${score}/100${p.bewertung ? " (" + p.bewertung + ")" : ""}.` : null,
    `Zutaten und Nährwerte je ${basis} für ${name}${marke ? " von " + marke : ""}.`,
    p.kategorie ? `Kategorie: ${p.kategorie}.` : null,
  ].filter(Boolean).join(" ").slice(0, 300);

  const zutaten = Array.isArray(p.zutaten) ? p.zutaten.filter((z) => z && z.name) : [];

  // Ein paar Saetze aus dem, was der Server ohnehin liefert. Nichts erfunden,
  // nichts nachgerechnet - ohne sie steht auf 38.000 Seiten kein einziger Satz,
  // und Google behandelt gleichfoermige Datenblaetter zurueckhaltend.
  const noten = zutaten.map((z) => num(z.rating)).filter((n) => n !== null);
  const schwach = zutaten.filter((z) => num(z.rating) !== null && num(z.rating) <= 3);
  const stark = noten.filter((n) => n >= 8).length;
  const kritische = zutaten.filter((z) => z.kritisch).length;
  const naehr = [
    num(p.m_kcal) !== null ? `${zahl(p.m_kcal)} kcal` : null,
    num(p.m_zucker) !== null ? `${zahl(p.m_zucker)} g Zucker` : null,
    num(p.m_ballast) !== null ? `${zahl(p.m_ballast)} g Ballaststoffe` : null,
    num(p.m_salz) !== null ? `${zahl(p.m_salz)} g Salz` : null,
  ].filter(Boolean);
  const einordnung = [
    score !== null
      ? `${esc(name)}${marke ? " von " + esc(marke) : ""} erreicht im Root Index ${score} von 100 Punkten${p.bewertung ? ` – ${esc(p.bewertung)}` : ""}.`
      : null,
    zutaten.length === 0 ? null
      : zutaten.length === 1
        ? `Das Produkt hat eine einzige Zutat: ${esc(zutaten[0].name)}${num(zutaten[0].rating) !== null ? ` mit Note ${zutaten[0].rating} von 10` : ""}.`
        : `Von ${zutaten.length} Zutaten sind ${stark} mit Note 8 oder besser und ${schwach.length} mit Note 3 oder schlechter bewertet${
            schwach.length ? `, darunter ${schwach.slice(0, 3).map((z) => esc(z.name)).join(", ")}` : ""}.`,
    kritische ? `${kritische === 1 ? "Eine Zutat ist" : kritische + " Zutaten sind"} als kritisch gekennzeichnet.` : null,
    naehr.length ? `Je ${basis}: ${naehr.join(", ")}.` : null,
  ].filter(Boolean).join(" ");

  const jsonld = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Produkte", item: `${DOMAIN}/produkt/` },
      ...(p.kategorie ? [{ "@type": "ListItem", position: 2, name: p.kategorie, item: `${DOMAIN}/produkt/${katDatei}` }] : []),
      { "@type": "ListItem", position: p.kategorie ? 3 : 2, name },
    ],
  };

  const alleZeilen = NAEHRWERTE.filter(([f]) => num(p[f]) !== null)
    .map(([f, l, e]) => `<div class="zeile"><span>${l}</span><span style="font-weight:600">${zahl(p[f])} ${e}</span></div>`).join("");
  const zutatenListe = zutaten.length
    ? `<ul class="zt">${zutaten.map((z) => `<li>${esc(z.name)}${num(z.rating) !== null ? ` – Note ${z.rating}/10` : ""}${z.kritisch ? ` <span class="krit">· kritisch</span>` : ""}</li>`).join("")}</ul>`
    : "";
  const achsen = [
    ["Zutaten", p.p_zutaten, 30], ["Zusatzstoffe", p.p_zusatzstoffe, 15],
    ["Verarbeitung (NOVA)", p.p_nova, 15], ["Nährwert", num(p.p_naehrwert) !== null ? num(p.p_naehrwert) * 2 : null, 40],
  ].filter(([, v]) => num(v) !== null)
    .map(([l, v, max]) => `<div class="zeile"><span>${l}</span><span style="font-weight:600">${zahl(v)} von ${max}</span></div>`).join("");

  const inhalt = `
<nav class="krumen"><a href="/produkt/">Produkte</a>${p.kategorie ? ` › <a href="/produkt/${katDatei}">${esc(p.kategorie)}</a>` : ""}</nav>
<div class="karte">
<h1>${esc(name)}</h1>
${markeVoll || p.kategorie ? `<p class="marke">${esc([markeVoll, p.kategorie].filter(Boolean).join(" · "))}${p.bio === true ? " · Bio" : ""}</p>` : ""}
${pille(p.ernaehrungsform)}
<div class="flux">${fluxSvg(p, score, ringfarbe)}</div>
${wort ? `<p class="wort" style="color:${schrift}">${esc(wort)}</p>` : ""}
${rangHtml(rang, kat)}
<div class="kacheln">${kachel(p, "m_kcal", "Energie", "kcal")}${kachel(p, "m_fett", "Fett", "g")}${kachel(p, "m_protein", "Eiweiß", "g")}${kachel(p, "m_ballast", "Ballaststoffe", "g")}</div>
${einordnung ? `<p class="einordnung">${einordnung}</p>` : ""}
<a class="appbtn" href="/?p=${encodeURIComponent(p.id)}">In der App öffnen – mit Tagebuch, Einkaufsliste und Alternativen</a>
${alleZeilen ? acc("📊", `Alle Nährwerte je ${basis}`, alleZeilen) : ""}
${zutatenListe ? acc("🧾", `Zutaten (${zutaten.length})`, zutatenListe) : ""}
${achsen ? acc("🔬", "Im Root Index", achsen + `<div style="color:var(--muted);font-size:.78rem;margin-top:6px">Die vier Achsen ergeben die Punktzahl. ${p.warum ? esc(p.warum) : "Bewertet wird die Zusammensetzung, nicht die Werbung."}</div>`) : ""}
${acc("🛡️", "Quelle & Beleg", `<div class="zeile"><span>Quelle</span><span style="font-weight:600">${esc(p.quelle || "nicht angegeben")}</span></div>${p.ean ? `<div class="zeile"><span>EAN</span><span style="font-weight:600">${esc(p.ean)}</span></div>` : ""}${p.inhalt_menge ? `<div class="zeile"><span>Inhalt</span><span style="font-weight:600">${zahl(p.inhalt_menge)} ${esc(p.inhalt_einheit || "")}</span></div>` : ""}${p.verifiziert_am ? `<div class="zeile"><span>Geprüft am</span><span style="font-weight:600">${esc(String(p.verifiziert_am).slice(0, 10))}</span></div>` : ""}`)}
</div>

${alternativen && alternativen.length ? `<h2>Besser bewertet${kat ? ` in ${esc(kat)}` : ""}</h2><div class="liste">${
  alternativen.map((a) => `<a href="/produkt/${a.datei}">${esc(a.name)}${a.marke ? " · " + esc(a.marke) : ""} <b>${a.score}/100</b></a>`).join("")
}</div>` : ""}`;

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

  // ERST zuordnen, DANN schreiben. Eine Produktseite soll auf besser bewertete
  // Produkte derselben Kategorie verweisen - dafuer muss die Kategorie schon
  // vollstaendig sein, wenn die erste Seite entsteht.
  for (const p of produkte) {
    if (!p || !p.id || !p.name) continue;
    const ersteMarke = String(p.marke || "").split(",")[0].trim();
    const markeDoppelt = ersteMarke && String(p.name).toLowerCase().startsWith(ersteMarke.toLowerCase());
    // Traegt der Name keine lateinischen Buchstaben (z. B. nur Ziffern oder
    // Sonderzeichen), bleibt der Slug leer und die Adresse faengt mit einem
    // Bindestrich an - fuer Google ein Name, den niemand sucht. Dann tritt die
    // Kategorie an die Stelle des Namens.
    const namensteil = slug([markeDoppelt ? null : ersteMarke, p.name].filter(Boolean).join(" "))
      || slug([ersteMarke, p.kategorie].filter(Boolean).join(" "))
      || "produkt";
    let datei = `${namensteil}-${slug(p.id)}.html`;
    if (vergeben.has(datei)) datei = `${slug(p.id)}-${datei}`;
    vergeben.add(datei);
    const kat = p.kategorie || "Weitere Produkte";
    const katDatei = `kategorie-${slug(kat)}.html`;
    if (!proKat.has(kat)) proKat.set(kat, { datei: katDatei, eintraege: [] });
    proKat.get(kat).eintraege.push({ p, datei });
  }

  // Je Kategorie die bestbewerteten Produkte als Vorrat fuer die Querverweise.
  const vorrat = new Map();
  for (const [kat, { eintraege }] of proKat) {
    vorrat.set(kat, eintraege
      .filter((e) => num(e.p.clean_score) !== null)
      .sort((a, b) => num(b.p.clean_score) - num(a.p.clean_score))
      .slice(0, 40));
  }
  // Aus dem Vorrat drei Stueck, ausgewaehlt anhand der eigenen id: so bekommt
  // nicht jede Seite derselben Kategorie dieselben drei Links, und die Auswahl
  // bleibt zwischen zwei Laeufen trotzdem dieselbe.
  function querverweise(p, kat) {
    const liste = (vorrat.get(kat) || []).filter((e) => e.p.id !== p.id && num(e.p.clean_score) > (num(p.clean_score) ?? -1));
    if (liste.length === 0) return [];
    let h = 0;
    for (const z of String(p.id)) h = (h * 31 + z.charCodeAt(0)) % 100000;
    const raus = [];
    for (let k = 0; k < 3 && k < liste.length; k++) {
      const e = liste[(h + k * 7) % liste.length];
      if (!raus.some((r) => r.datei === e.datei)) {
        raus.push({ datei: e.datei, name: e.p.name, marke: String(e.p.marke || "").split(",")[0].trim(), score: num(e.p.clean_score) });
      }
    }
    return raus;
  }

  let geschrieben = 0;
  for (const [kat, { datei: katDatei, eintraege }] of proKat) {
    // Platz in der Kategorie: nur unter denen, die eine Punktzahl haben -
    // "Platz 300 von 4000" waere sonst eine Aussage ueber fehlende Daten.
    const bewertet = eintraege.filter((e) => num(e.p.clean_score) !== null)
      .sort((a, b) => num(b.p.clean_score) - num(a.p.clean_score));
    const platzVon = new Map(bewertet.map((e, i) => [e.p.id, i + 1]));
    for (const { p, datei } of eintraege) {
      const rang = platzVon.has(p.id) && bewertet.length >= 3
        ? { platz: platzVon.get(p.id), gesamt: bewertet.length } : null;
      writeFileSync(join(ZIEL, datei), produktSeite(p, datei, katDatei, kat, querverweise(p, kat), rang));
      urls.push(`${DOMAIN}/produkt/${datei}`);
      geschrieben++;
    }
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
      `<a href="/produkt/${datei}">${esc(p.name)}${p.marke ? " · " + esc(String(p.marke).split(",")[0].trim()) : ""}${num(p.clean_score) !== null ? ` <b>${p.clean_score}/100</b>` : ""}</a>`).join("")}</div>`;
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
