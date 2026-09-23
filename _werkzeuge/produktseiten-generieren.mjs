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
<meta name="theme-color" content="#263e27">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschreibung)}">
<meta property="og:url" content="${kanonisch}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Root Index">
<link rel="preload" href="/fonts/inter-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<style>
/* Stil der Instagram-Vorlage (instagram/STIL.md, Ralph 20.09.2026) und der
   Startseite der App: dunkles Gruen, Creme, Akzent #7CFF9B, Schrift Inter,
   Untertitel "Die Vorderseite verkauft. Wir lesen die Rueckseite."
   Wer aus der Suche kommt, soll sofort sehen, dass er bei Root Index ist. */
@font-face{font-family:Inter;src:url(/fonts/inter-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:Inter;src:url(/fonts/inter-latin-600-normal.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:Inter;src:url(/fonts/inter-latin-800-normal.woff2) format("woff2");font-weight:800;font-display:swap}
:root{--acc:#7CFF9B;--cream:#F3EEDC;--mut:rgba(243,238,220,.66);--line:rgba(124,255,155,.2);--panel:rgba(10,26,16,.5);--gelb:#FFC24B}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--cream);line-height:1.55;
  background:#1d321f radial-gradient(120% 60% at 50% 0%,#2f4b31 0%,#263e27 50%,#1d321f 100%) no-repeat;min-height:100vh}
a{color:var(--acc)}
.kopf{max-width:760px;margin:0 auto;padding:18px 18px 4px;display:flex;align-items:center;gap:14px}
.kopf .logo{display:inline-flex;align-items:center;gap:.5em;color:var(--cream);text-decoration:none;font-weight:800;font-size:1.15rem;flex:0 0 auto}
.kopf img{height:40px;width:auto}
.kopf .claim{border-left:2px solid var(--line);padding-left:14px;font-size:.78rem;line-height:1.3;color:var(--mut);font-weight:600}
main{max-width:760px;margin:0 auto;padding:6px 18px 28px}
nav.krumen{font-size:.8rem;margin:10px 0 14px;color:var(--mut)}nav.krumen a{text-decoration:none}
.mk{font-size:.78rem;font-weight:600;color:var(--mut);letter-spacing:1px;text-transform:uppercase}
h1{font-weight:800;font-size:clamp(1.55rem,4.6vw,2.25rem);line-height:1.1;letter-spacing:-.5px;margin:.12em 0 .25em}
.zs,.marke{color:var(--mut);font-size:.95rem;margin:0}
.pille{display:inline-block;border-radius:999px;padding:3px 12px;font-size:.78rem;font-weight:600;margin:10px 0 0;background:rgba(124,255,155,.12);color:var(--acc);border:1px solid var(--line)}
/* Der Bewertungsbalken nach STIL.md: Flux mit Zahl, ROOT INDEX / Wert / Urteil,
   daneben vier gleichrangige Achsen mit kurzem Fuellbalken und Wert. */
.bal{margin:20px 0 10px;border:2px solid rgba(124,255,155,.55);border-radius:20px;background:var(--panel);padding:16px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px}
.bal .kt{display:flex;align-items:center;gap:12px;flex:0 0 auto}
.bal .flux{width:132px}
.bal .ri small{display:block;font-size:.68rem;letter-spacing:1.6px;font-weight:800;color:var(--mut)}
.bal .ri strong{display:block;font-size:1.9rem;font-weight:800;line-height:1.1}
.bal .ri em{font-style:normal;font-weight:800;letter-spacing:1px;font-size:.9rem}
.achsen{flex:1 1 300px;display:grid;grid-template-columns:repeat(4,1fr)}
.achse{padding:2px 8px;border-left:1px solid var(--line);text-align:center;min-width:0}
.achse:first-child{border-left:0}
.achse .l{font-size:.68rem;color:var(--mut);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.achse .bar{height:8px;border-radius:5px;background:rgba(243,238,220,.12);margin:8px auto 6px;max-width:72px;overflow:hidden}
.achse .bar i{display:block;height:100%;border-radius:5px}
.achse .v{font-weight:800;font-size:.88rem}
@media(max-width:560px){.achsen{grid-template-columns:repeat(2,1fr);row-gap:12px}.achse:nth-child(3){border-left:0}}
.rang{font-size:.84rem;color:var(--mut);margin:6px 2px 0}.rang b{color:var(--acc)}
.lab{display:inline-block;border:2px solid rgba(124,255,155,.55);color:var(--acc);border-radius:30px;padding:3px 14px;font-weight:800;font-size:.7rem;letter-spacing:1px;margin:28px 0 12px;text-transform:uppercase}
.zt{font-size:1.02rem;line-height:1.75}
.zt span{white-space:nowrap}
.zt u{text-decoration:none;color:var(--gelb);font-weight:600}
.zt sup{color:var(--mut);font-size:.66rem;margin-left:1px}
.legende{font-size:.76rem;color:var(--mut);margin-top:8px}
.nw{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;align-items:start}
@media(max-width:520px){.nw{grid-template-columns:1fr}}
.zeile{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--line);font-size:.92rem}
.zeile span:first-child{color:var(--mut)}.zeile b{font-weight:600}
.zeile.davon span:first-child{padding-left:12px}
p.einordnung{margin:26px 0 0;padding:14px 16px;border-left:3px solid var(--acc);background:var(--panel);border-radius:0 12px 12px 0}
.appbtn{display:block;margin:22px 0 4px;padding:15px;border-radius:14px;background:var(--acc);color:#123018;font-weight:800;text-align:center;text-decoration:none;font-size:1rem}
.appbtn span{display:block;font-weight:600;font-size:.78rem;opacity:.75}
.liste a{display:flex;justify-content:space-between;gap:12px;padding:10px 2px;border-bottom:1px solid var(--line);color:var(--cream);text-decoration:none}
.liste a b{color:var(--acc);white-space:nowrap}
h2{font-size:1rem;margin-top:24px}
.quelle{font-size:.78rem;color:var(--mut);margin-top:26px;line-height:1.7}
.krit{color:#ff8a7a}
.fuss{margin:34px 0 10px;padding-top:14px;border-top:1px solid var(--line);font-size:.78rem;color:var(--mut)}
</style>
</head>
<body>
<header class="kopf"><a class="logo" href="/"><img src="/logo-mark.png" alt="" onerror="this.style.display='none'">Root Index</a><div class="claim">Die Vorderseite verkauft.<br>Wir lesen die Rückseite.</div></header>
<main>
${inhalt}
<p class="fuss">Bewertet wird die Zusammensetzung, nicht die Werbung. Keine medizinische oder ernährungstherapeutische Beratung.
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
// Auf dunklem Grund braucht das Urteil hellere Toene als in der weissen App-Karte.
const SCHRIFT = { "Sehr gut": "#7CFF9B", "Gut": "#b9e56f", "Mittel": "#FFC24B", "Schwach": "#ff8a7a" };
const ACHSEN = [
  ["p_zutaten", "Zutaten", 30, "#16a34a", 1],
  ["p_zusatzstoffe", "Zusatzstoffe", 15, "#3987e5", 1],
  ["p_nova", "Verarbeitung", 15, "#7c6fe0", 1],
  ["p_naehrwert", "Nährwerte", 40, "#d97706", 2],   // steht auf 20 skaliert, wie in app.js x2
];

/* Der Fluxkompensator - Geometrie eins zu eins aus app.js (pkFlux), Farben fuer
   dunklen Grund. Ohne Animation: die Zahl soll im Quelltext stehen. */
function fluxSvg(p, score, ringfarbe) {
  const A = ACHSEN.map(([f, , max, farbe, k]) => {
    const v = num(p[f]) === null ? null : num(p[f]) * k;
    return { f: farbe, pct: v === null ? null : Math.max(0, Math.min(1, v / max)) };
  });
  const L = 92;
  const bahn = ["M26 34 H74 L106 64", "M274 34 H226 L194 64", "M26 142 H74 L106 112", "M274 142 H226 L194 112"];
  const kap = [[26, 34], [274, 34], [26, 142], [274, 142]];
  const ziel = score === null ? "–" : String(Math.round(score));
  return `<svg viewBox="0 0 300 176" style="width:100%;display:block" role="img" aria-label="Root Index ${ziel} von 100, vier Achsen">`
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">`
    + bahn.map((d) => `<path d="${d}" stroke="rgba(243,238,220,.14)"/>`).join("")
    + A.map((a, i) => `<path d="${bahn[i]}" stroke="${a.pct === null ? "rgba(243,238,220,.28)" : a.f}" stroke-dasharray="${L}" stroke-dashoffset="${(a.pct === null ? L : L * (1 - a.pct)).toFixed(1)}"/>`).join("")
    + `</g>`
    + A.map((a, i) => `<circle cx="${kap[i][0]}" cy="${kap[i][1]}" r="7" fill="${a.pct === null ? "#9aa7a0" : a.f}"/>`).join("")
    + `<circle cx="150" cy="88" r="42" fill="#1d321f" stroke="${score === null ? "#9aa7a0" : ringfarbe}" stroke-width="5"/>`
    + `<text x="150" y="103" text-anchor="middle" style="font-size:44px;font-weight:800;font-family:Inter,sans-serif" fill="#F3EEDC">${ziel}</text>`
    + `</svg>`;
}

function pille(ef) {
  const m = { "vegan": "🌱", "vegetarisch": "🥚", "enthält Tierprodukte": "🥩" };
  return m[String(ef || "")] ? `<span class="pille">${m[ef]} ${esc(ef)}</span>` : "";
}

function achsenHtml(p) {
  return ACHSEN.map(([f, label, max, farbe, k]) => {
    const v = num(p[f]) === null ? null : Math.round(num(p[f]) * k * 10) / 10;
    const pct = v === null ? 0 : Math.max(0, Math.min(100, v / max * 100));
    return `<div class="achse"><div class="l">${label}</div><div class="bar"><i style="width:${pct.toFixed(0)}%;background:${farbe}"></i></div>`
      + `<div class="v">${v === null ? "–" : String(v).replace(".", ",")}<span style="color:var(--mut);font-weight:600">/${max}</span></div></div>`;
  }).join("");
}

function produktSeite(p, datei, katDatei, kat, alternativen, rang) {
  const name = p.name;
  // Handelsmarken stehen im Stamm oft als Kommaliste ("Best Moments,Guschlbauer,Penny"):
  // im Titel die erste, darueber alle lesbar getrennt.
  const marken = String(p.marke || "").split(",").map((t) => t.trim()).filter(Boolean);
  const markeVoll = marken.join(" · ");
  const erste = marken[0] || "";
  const marke = erste && !String(p.name).toLowerCase().startsWith(erste.toLowerCase()) ? erste : "";
  const kanonisch = `${DOMAIN}/produkt/${datei}`;
  const basis = (p.mengen_einheit || "g").toLowerCase() === "ml" ? "100 ml" : "100 g";
  // Titel wie gesucht wird (Search Console, 21.09.2026): Marke vorne, dann das
  // Produkt, und das Wort, das die Leute tippen: "Inhaltsstoffe".
  const titel = `${marke ? marke + " " : ""}${name} – Zutaten, Inhaltsstoffe & Bewertung | Root Index`;
  const score = num(p.clean_score);
  const voll = p.score_vollstaendig !== false;
  const wort = voll ? (p.bewertung || "") : "Vorläufig";
  const ringfarbe = RING[p.bewertung] || "#9aa7a0";
  const schrift = SCHRIFT[p.bewertung] || "#F3EEDC";
  const beschreibung = [
    score !== null ? `Root-Index-Bewertung: ${score}/100${p.bewertung ? " (" + p.bewertung + ")" : ""}.` : null,
    `Zutaten, Inhaltsstoffe und Nährwerte je ${basis} für ${marke ? marke + " " : ""}${name}.`,
    p.kategorie ? `Kategorie: ${p.kategorie}.` : null,
  ].filter(Boolean).join(" ").slice(0, 300);

  const zutaten = Array.isArray(p.zutaten) ? p.zutaten.filter((z) => z && z.name) : [];
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
  // Ein paar Saetze aus dem, was der Server ohnehin liefert - nichts erfunden.
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

  // Zutaten offen wie auf der Instagram-Karte: Fliesstext, schwache in Gelb,
  // die Note klein dahinter. Nichts muss aufgeklappt werden.
  const zutatenHtml = zutaten.map((z) => {
    const n = num(z.rating);
    const t = esc(z.name) + (n !== null ? `<sup>${n}</sup>` : "") + (z.kritisch ? ` <span class="krit">⚠</span>` : "");
    return `<span>${n !== null && n <= 3 ? `<u>${t}</u>` : t}</span>`;
  }).join(", ");

  // Zwei feste Spalten, damit "davon ..." nie von seiner Hauptzeile getrennt wird.
  const NW = [
    [["m_kcal", "Energie", "kcal", 0], ["m_protein", "Eiweiß", "g", 0], ["m_fett", "Fett", "g", 0], ["m_ges_fett", "davon gesättigt", "g", 1]],
    [["m_kh", "Kohlenhydrate", "g", 0], ["m_zucker", "davon Zucker", "g", 1], ["m_ballast", "Ballaststoffe", "g", 0], ["m_salz", "Salz", "g", 0]],
  ];
  const nwHtml = NW.map((spalte) => spalte.filter(([f]) => num(p[f]) !== null)
    .map(([f, l, e, davon]) => `<div class="zeile${davon ? " davon" : ""}"><span>${l}</span><b>${f === "m_kcal" ? Math.round(num(p[f])) : zahl(p[f])} ${e}</b></div>`).join(""))
    .filter(Boolean).map((h) => `<div>${h}</div>`).join("");

  const zusatz = [p.kategorie, p.inhalt_menge ? `${zahl(p.inhalt_menge)} ${esc(p.inhalt_einheit || "")}`.trim() : null, p.bio === true ? "Bio" : null].filter(Boolean);

  const inhalt = `
<nav class="krumen"><a href="/produkt/">Produkte</a>${p.kategorie ? ` › <a href="/produkt/${katDatei}">${esc(p.kategorie)}</a>` : ""}</nav>
${markeVoll ? `<div class="mk">${esc(markeVoll)}</div>` : ""}
<h1>${esc(name)}</h1>
${zusatz.length ? `<p class="zs">${esc(zusatz.join(" · "))}</p>` : ""}
${pille(p.ernaehrungsform)}
<div class="bal">
  <div class="kt"><div class="flux">${fluxSvg(p, score, ringfarbe)}</div>
  <div class="ri"><small>ROOT INDEX</small><strong style="color:${schrift}">${score === null ? "–" : score}/100</strong><em style="color:${schrift}">${esc(String(wort).toUpperCase())}</em></div></div>
  <div class="achsen">${achsenHtml(p)}</div>
</div>
${rang ? `<p class="rang">🏆 <b>Platz ${rang.platz} von ${rang.gesamt}</b> in „${esc(kat)}" – verglichen wird innerhalb der Kategorie, nicht Öl mit Brot.</p>` : ""}
${zutaten.length ? `<span class="lab">In der Zutatenliste · ${zutaten.length}</span>
<div class="zt">${zutatenHtml}</div>
<div class="legende">Kleine Zahl = Note der Zutat von 0 bis 10 · <span style="color:var(--gelb)">Gelb</span> = Note 3 oder schlechter${kritische ? " · ⚠ = als kritisch gekennzeichnet" : ""}</div>` : ""}
${nwHtml ? `<span class="lab">Nährwerte je ${basis}</span><div class="nw">${nwHtml}</div>` : ""}
${einordnung ? `<p class="einordnung">${einordnung}</p>` : ""}
<a class="appbtn" href="/?p=${encodeURIComponent(p.id)}">In der App öffnen<span>mit Tagebuch, Einkaufsliste und besseren Alternativen</span></a>
${alternativen && alternativen.length ? `<span class="lab">Besser bewertet${kat ? ` in ${esc(kat)}` : ""}</span><div class="liste">${
  alternativen.map((a) => `<a href="/produkt/${a.datei}"><span>${esc(a.name)}${a.marke ? ` <span style="color:var(--mut)">· ${esc(a.marke)}</span>` : ""}</span><b>${a.score}/100</b></a>`).join("")
}</div>` : ""}
<div class="quelle">Quelle: ${esc(p.quelle || "nicht angegeben")}${p.ean && !String(p.quelle||"").includes(String(p.ean)) ? ` · EAN ${esc(p.ean)}` : ""}${p.verifiziert_am ? ` · geprüft am ${esc(String(p.verifiziert_am).slice(0, 10))}` : ""}${p.warum ? `<br>${esc(p.warum)}` : ""}</div>`;

  return seite({ titel, beschreibung, kanonisch, inhalt, jsonld });
}

/* Produktnamen tragen im Stamm manchmal den Kassenbon mit - "Tortilla Chips
   Salz 300g 1.59€ 1kg 5.30€" (126 von 45.509 am 21.09.2026). Auf der Seite und
   im Suchtreffer ist das Rauschen. Ab dem ersten Preis wird abgeschnitten,
   danach fallen Mengen- und Gebindeangaben am Ende weg. Der Stamm selbst bleibt
   unveraendert - das ist Anzeige, keine Korrektur der Daten. */
function sauberName(n) {
  const roh = String(n || "");
  let s = roh;
  const i = s.search(/\s\d+[.,]\d{2}\s?€/);
  if (i > 0) s = s.slice(0, i);
  for (let k = 0; k < 3; k++) {
    s = s.replace(/\s+(\d+[.,]?\d*\s?(g|kg|ml|l)(-Packung)?|\d+-g-Packung|Beutel|Flasche|Packung|Dose|Glas|Becher|Schale|Stück)\s*$/i, "");
  }
  s = s.trim();
  return s.length >= 3 ? s : roh;
}

/* ---------- Hauptlauf ---------- */
async function main() {
  const argDatei = process.argv.indexOf("--aus-datei");
  const produkte = argDatei > -1
    ? JSON.parse(readFileSync(process.argv[argDatei + 1], "utf8"))
    : await alleProdukte();

  if (!Array.isArray(produkte) || produkte.length === 0) throw new Error("0 Produkte erhalten – Abbruch, nichts geschrieben.");
  for (const p of produkte) if (p && p.name) p.name = sauberName(p.name);

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

  // Stand fuer das Cockpit: wie viele Seiten stehen seit wann bei Google.
  // Die Zahl der freigegebenen Produkte waechst den ganzen Tag, die Seiten
  // entstehen nur im Lauf - die Luecke soll sichtbar sein.
  writeFileSync(join(WEB, "produkt", "stand.json"),
    JSON.stringify({ seiten: geschrieben, kategorien: kats.length, sitemap: urls.length, stand: new Date().toISOString() }) + "\n");

  console.log(`✅ Produktseiten: ${geschrieben} · Kategorien: ${kats.length} · Sitemap-URLs: ${urls.length}`);
  if (geschrieben < 100 && argDatei === -1) console.log("⚠️  Ungewoehnlich wenige Produkte – v_web_produkte pruefen.");
}

main().catch((e) => { console.error("❌ Produktseiten-Generator: " + e.message); process.exit(1); });
