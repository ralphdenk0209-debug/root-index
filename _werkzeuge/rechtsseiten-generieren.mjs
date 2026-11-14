#!/usr/bin/env node
/* =============================================================================
   Rechtsseiten als eigene, verlinkbare HTML-Seiten            14.11.2026
   -----------------------------------------------------------------------------
   Ralph (14.11.2026): Datenschutz, Impressum und AGB oeffneten sich nur als
   Fenster per Klick. Sie brauchen eigene Seiten, die man verlinken kann und
   die Google und der Meta-App-Review ohne JavaScript lesen koennen.

   EINE QUELLE: Die Texte stehen weiter NUR in app.js (legalOpen, Deutsch) und
   recht-texte.js (window.RI_RECHT.en, Englisch). Dieses Skript fuehrt
   legalOpen() in einer Sandbox aus und schreibt den Text, den das Fenster
   zeigt, in statische Seiten. Wer einen Rechtstext aendert, laesst danach
   dieses Skript laufen und committet die Seiten mit:

       node _werkzeuge/rechtsseiten-generieren.mjs           # schreiben
       node _werkzeuge/rechtsseiten-generieren.mjs --pruefen # nur pruefen (Exit 1 = veraltet)

   Die Datenloeschungs-Seite (datenloeschung.html / en/data-deletion.html)
   ist kein Overlay-Text und steht deshalb hier unten im Skript.
   ============================================================================= */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const WEB = process.env.RI_WEB || join(dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = "https://root-index.de";
const PRUEFEN = process.argv.includes("--pruefen");

/* ---------- Seiten: Overlay-Schluessel -> Adresse, Titel, Beschreibung ---------- */
const SEITEN = [
  { key: "impressum", de: "impressum.html", en: "en/legal-notice.html",
    deT: "Impressum", enT: "Legal notice", deNav: "Impressum", enNav: "Legal notice",
    deD: "Impressum von Root Index: Anbieter, Anschrift, Kontakt, Marke und Datenquellen der unabhängigen Lebensmittelbewertung.",
    enD: "Legal notice of Root Index: provider, address, contact, trademark and data sources of the independent food rating." },
  { key: "datenschutz", de: "datenschutz.html", en: "en/privacy.html",
    deT: "Datenschutzerklärung", enT: "Privacy Policy", deNav: "Datenschutz", enNav: "Privacy",
    deD: "Datenschutzerklärung von Root Index: welche Daten die Web-App und die iPhone-App verarbeiten, wozu, wie lange, und welche Rechte du hast.",
    enD: "Privacy Policy of Root Index: which data the web app and the iPhone app process, why, for how long, and what rights you have." },
  { key: "agb", de: "agb.html", en: "en/terms.html",
    deT: "Allgemeine Geschäftsbedingungen (AGB)", enT: "Terms and Conditions", deNav: "AGB", enNav: "Terms",
    deD: "Allgemeine Geschäftsbedingungen von Root Index Premium: Vertrag, Testphase, Preise, Laufzeit und Kündigung.",
    enD: "Terms and Conditions of Root Index Premium: contract, trial, prices, term and cancellation." },
  { key: "widerruf", de: "widerrufsbelehrung.html", en: "en/withdrawal.html",
    deT: "Widerrufsbelehrung", enT: "Right of withdrawal", deNav: "Widerrufsbelehrung", enNav: "Withdrawal",
    deD: "Widerrufsbelehrung für Root Index Premium mit Muster-Widerrufsformular.",
    enD: "Information on the right of withdrawal for Root Index Premium, with model withdrawal form." },
  { key: "gesundheit", de: null, en: "en/consumer-health-data-privacy.html",
    enT: "Consumer Health Data Privacy Policy", enNav: "Consumer health data",
    enD: "Consumer Health Data Privacy Policy of Root Index for users in Washington, Nevada and Connecticut." },
  { key: "loeschung", de: "datenloeschung.html", en: "en/data-deletion.html",
    deT: "Datenlöschung", enT: "Data deletion", deNav: "Datenlöschung", enNav: "Data deletion",
    deD: "So löschst du deine Daten bei Root Index: Konto löschen, nur Gesundheitsdaten löschen, Newsletter abmelden oder Löschung per E-Mail anfragen.",
    enD: "How to delete your data at Root Index: delete your account, delete only health data, unsubscribe from the newsletter or request deletion by email." },
];

/* ---------- Texte aus der Quelle holen ---------- */
function rechtEnLaden() {
  const w = {};
  vm.runInNewContext(readFileSync(join(WEB, "recht-texte.js"), "utf8"), { window: w });
  return w.RI_RECHT || {};
}

function legalOpenTexte(markt, rechtFenster) {
  const src = readFileSync(join(WEB, "app.js"), "utf8");
  const a = src.indexOf("function legalOpen(which){");
  if (a < 0) throw new Error("legalOpen in app.js nicht gefunden");
  const b = src.indexOf("\n}\n", a);
  const fn = src.slice(a, b + 2);
  const texte = {};
  for (const s of SEITEN) {
    if (s.key === "loeschung") continue;
    let html = null;
    const el = { style: {}, setAttribute() {}, set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
    const ctx = {
      RI_MARKT: markt, window: { RI_RECHT: rechtFenster },
      document: { getElementById: () => null, createElement: () => el, body: { appendChild() {} } },
    };
    vm.runInNewContext(fn + `\nlegalOpen(${JSON.stringify(s.key)});`, ctx);
    const m = /<!--RI-TEXT-->([\s\S]*)<!--\/RI-TEXT-->/.exec(html || "");
    if (!m) throw new Error(`Marke <!--RI-TEXT--> fehlt im Fenster (${s.key})`);
    texte[s.key] = m[1];
  }
  return texte;
}

/* ---------- Fenster-HTML -> Seiten-HTML ---------- */
function umbauen(body, sprache) {
  const url = (key) => {
    const s = SEITEN.find((x) => x.key === key);
    return "/" + (sprache === "en" ? s.en : (s.de || s.en));
  };
  let h = body;
  // erste Ueberschrift = h1, weitere h2; Inline-Stile der Bausteine H/P/I raus (Seite hat eigenes CSS)
  let erste = true;
  h = h.replace(/<h3 style="[^"]*">([\s\S]*?)<\/h3>/g, (_, t) => {
    if (erste) { erste = false; return `<h1>${t}</h1>`; }
    return `<h2>${t}</h2>`;
  });
  h = h.replace(/<p style="font-size:13\.5px;line-height:1\.55;color:var\(--ink\);margin:\.2em 0">/g, "<p>");
  h = h.replace(/<p style="font-size:12px;color:var\(--muted\)(;margin:\.2em 0)?">/g, '<p class="klein">');
  // Verweise auf andere Fenster -> echte Links
  h = h.replace(/href="#" onclick="legalOpen\('(\w+)'\);return false"/g, (_, k) => `href="${url(k)}"`);
  h = h.replace(/<a onclick="legalOpen\('(\w+)'\)"/g, (_, k) => `<a href="${url(k)}"`);
  // Knopf "Vertrag widerrufen" startet in der App das Formular -> Link in die App
  h = h.replace(/<button onclick="[^"]*riWiderrufFormular\(\)[^"]*"[^>]*>([\s\S]*?)<\/button>/g,
    (_, t) => `<a class="knopf" href="/?widerruf">${t}</a>`);
  if (/onclick=|<button/.test(h)) throw new Error("Seite enthaelt noch onclick/button – Umbau in rechtsseiten-generieren.mjs ergaenzen");
  return h;
}

/* ---------- Datenloeschung (eigene Seite, kein Overlay-Text) ---------- */
const MAIL = '<a href="mailto:kontakt@root-index.de">kontakt@root-index.de</a>';
const LOESCHUNG = {
  de: `<h1>Datenlöschung</h1>
<p>Hier steht, wie du deine Daten bei Root Index löschen kannst. Die Wege gelten für die Web-App unter root-index.de und für die iPhone-App „Root Index“.</p>
<h2>1. Konto und alle Daten löschen</h2>
<p>In der App: <b>Menü → „Abo &amp; Konto“ → „Konto löschen“</b>. Zur Bestätigung tippst du <b>LÖSCHEN</b> ein.</p>
<p>Damit werden sofort und endgültig gelöscht: Tagebuch, Profil, Ziele, Körpermaße, Favoriten, eigene Rezepte, Training, Wasser und Supplements sowie dein Konto. Das lässt sich nicht rückgängig machen.</p>
<p>Hast du ein laufendes Premium-Abo, kündige es bitte vorher: im Browser unter „Abo &amp; Konto“ → „Verträge hier kündigen“, in der iPhone-App in den Abo-Einstellungen deiner Apple-ID. Rechnungsdaten, die wir aus steuerlichen Gründen aufbewahren müssen, bleiben beim Zahlungsdienstleister gespeichert.</p>
<h2>2. Nur die Gesundheitsdaten löschen</h2>
<p>In der App: <b>Menü → „Rechtliches“ → „Einwilligung widerrufen“</b>. Dann werden alle Gesundheitsdaten sofort gelöscht: Tagebuch, Gewicht, Körpermaße, Schlaf, Schritte, Supplemente, Zyklus und Training. Dein Konto bleibt bestehen.</p>
<h2>3. Newsletter abbestellen</h2>
<p>Jede Newsletter-Mail enthält einen Link zum Abmelden. Danach bekommst du keine Ausgabe mehr.</p>
<h2>4. Löschung per E-Mail oder Brief</h2>
<p>Kommst du nicht mehr in dein Konto, oder möchtest du andere Daten löschen lassen (zum Beispiel hochgeladene Fotos oder eine Kontaktanfrage), schreib an ${MAIL} oder an die Anschrift im <a href="/impressum.html">Impressum</a>. Bitte nenne die E-Mail-Adresse deines Kontos, damit wir es finden. Wir bestätigen dir die Löschung.</p>
<p>Wie lange welche Daten gespeichert werden, steht in der <a href="/datenschutz.html">Datenschutzerklärung</a> (Abschnitt 18 „Speicherdauer und Löschung“). Dort stehen auch deine weiteren Rechte, etwa auf Auskunft.</p>
<h2>5. Meta-App „Content Studio“</h2>
<p>Für die eigene Arbeit auf Instagram und Facebook nutzt Root Index eine Meta-App namens „Content Studio“. Sie verarbeitet nur Daten der eigenen Root-Index-Konten (eigene Beiträge, deren Statistiken und Kommentare unter diesen Beiträgen) sowie öffentliche Beiträge zu Hashtags, die nur zusammengefasst und ohne Nutzernamen ausgewertet werden. Möchtest du, dass Daten aus dieser App gelöscht werden, schreib an ${MAIL} oder an die Anschrift im <a href="/impressum.html">Impressum</a>.</p>`,
  en: `<h1>Data deletion</h1>
<p>This page explains how you can delete your data at Root Index. It applies to the web app at root-index.de and to the iPhone app “Root Index”.</p>
<h2>1. Delete your account and all data</h2>
<p>In the app: <b>Menu → “Abo &amp; Konto” (Subscription &amp; account) → “Konto löschen” (Delete account)</b>. To confirm, type <b>LÖSCHEN</b>.</p>
<p>This immediately and permanently deletes your diary, profile, goals, body measurements, favourites, own recipes, training, water and supplements, and your account. This cannot be undone.</p>
<p>If you have an active Premium subscription, please cancel it first: in the browser under “Abo &amp; Konto” → “Verträge hier kündigen” (Cancel contracts here), in the iPhone app in the subscription settings of your Apple ID. Invoice data that we must keep for tax reasons remains stored with the payment provider.</p>
<h2>2. Delete only your health data</h2>
<p>In the app: <b>Menu → “Rechtliches” (Legal) → “Einwilligung widerrufen” (Withdraw consent)</b>. All health data is deleted immediately: diary, weight, body measurements, sleep, steps, supplements, cycle and training. Your account remains.</p>
<h2>3. Unsubscribe from the newsletter</h2>
<p>Every newsletter email contains an unsubscribe link. After that you will not receive any further issues.</p>
<h2>4. Deletion request by email or letter</h2>
<p>If you can no longer access your account, or want other data deleted (for example uploaded photos or a contact request), write to ${MAIL} or to the postal address in the <a href="/en/legal-notice.html">legal notice</a>. Please state the email address of your account so we can find it. We will confirm the deletion.</p>
<p>How long each type of data is kept is set out in our <a href="/en/privacy.html">Privacy Policy</a> (section 18), together with your other rights, such as access.</p>
<h2>5. Meta app “Content Studio”</h2>
<p>For its own work on Instagram and Facebook, Root Index uses a Meta app called “Content Studio”. It only processes data of Root Index’s own accounts (own posts, their insights and comments on these posts) and public hashtag posts, which are only analysed in aggregate and without usernames. If you want data from this app to be deleted, write to ${MAIL} or to the postal address in the <a href="/en/legal-notice.html">legal notice</a>.</p>`,
};

/* ---------- Seitenrahmen ---------- */
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const CSS = `:root{--bg:#eef1ec;--card:#fff;--ink:#1d3c24;--muted:#6b6256;--line:#e4e8e2;--greendk:#047857;--green:#047857;--d1:#1D3C24;--d2:#24492E}
@media (prefers-color-scheme:dark){:root{--bg:#0f1a12;--card:#16241a;--ink:#e7efe8;--muted:#a9b3aa;--line:#2a3a2e;--greendk:#6ee7b7;--green:#6ee7b7}}
*{box-sizing:border-box}
html{color-scheme:light dark}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.6}
.hero{background:linear-gradient(180deg,var(--d1),var(--d2));color:#fff;padding:12px 16px}
.hero a{display:inline-flex;align-items:center;gap:.5em;color:#fff;text-decoration:none;font-size:22px;font-weight:700;letter-spacing:-.2px}
.hero img{height:44px;width:auto}
.hero sup{font-size:.45em;font-weight:600;margin-left:.1em}
main{max-width:760px;margin:18px auto;padding:0 16px}
.pfad{font-size:13px;color:var(--muted);margin:0 0 10px}
.pfad a{color:var(--muted)}
article{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px;overflow-wrap:anywhere}
h1{font-size:clamp(1.4rem,4vw,1.9rem);line-height:1.2;margin:0 0 10px;color:var(--ink)}
h2{font-size:1.05rem;margin:22px 0 4px;color:var(--greendk)}
p{margin:.35em 0;font-size:15px}
p.klein{font-size:13px;color:var(--muted)}
a{color:var(--greendk)}
table{border-collapse:collapse;width:100%;font-size:13.5px}
.knopf{display:inline-block;margin:8px 0 4px;padding:10px 16px;border-radius:10px;background:#047857;color:#fff;font-weight:700;text-decoration:none}
footer{max-width:760px;margin:18px auto 40px;padding:0 16px;text-align:center;font-size:13px;line-height:1.9;color:var(--muted)}
footer a{color:var(--muted);margin:0 6px;white-space:nowrap}`;

function seite(s, sprache, inhalt) {
  const de = sprache === "de";
  const pfad = de ? s.de : s.en;
  const titel = de ? s.deT : s.enT;
  const besch = de ? s.deD : s.enD;
  const alt = [];
  if (s.de && s.en) {
    alt.push(`<link rel="alternate" hreflang="de" href="${DOMAIN}/${s.de}">`,
      `<link rel="alternate" hreflang="en" href="${DOMAIN}/${s.en}">`,
      `<link rel="alternate" hreflang="x-default" href="${DOMAIN}/${s.de}">`);
  }
  const fuss = SEITEN.filter((x) => (de ? x.de : x.en) && (de || x.key !== "gesundheit"))
    .map((x) => `<a href="/${de ? x.de : x.en}">${de ? x.deNav : x.enNav}</a>`);
  if (de) fuss.push(`<a href="/produkt/">Produktverzeichnis</a>`, s.en ? `<a href="/${s.en}" hreflang="en" lang="en">English</a>` : "");
  else fuss.push(`<a href="/en/how-we-rate.html">How we rate</a>`, s.de ? `<a href="/${s.de}" hreflang="de" lang="de">Deutsch</a>` : "");
  const start = de ? "/" : "/en/";
  return `<!doctype html>
<html lang="${sprache}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Erzeugt von _werkzeuge/rechtsseiten-generieren.mjs aus ${s.key === "loeschung" ? "dem Skript selbst" : (de ? "app.js (legalOpen)" : "recht-texte.js")} – nicht von Hand aendern. -->
<title>${esc(titel)} – Root Index</title>
<meta name="description" content="${esc(besch)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${DOMAIN}/${pfad}">
${alt.join("\n")}
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1D3C24">
<meta property="og:title" content="${esc(titel)} – Root Index">
<meta property="og:description" content="${esc(besch)}">
<meta property="og:url" content="${DOMAIN}/${pfad}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Root Index">
<meta property="og:locale" content="${de ? "de_DE" : "en_GB"}">
<meta property="og:image" content="${DOMAIN}/icon-512.png">
<style>
${CSS}
</style>
</head>
<body>
<header class="hero"><a href="${start}"><img src="/logo-mark.png" alt="Root Index Logo" onerror="this.style.display='none'"><span>Root Index<sup>™</sup></span></a></header>
<main>
<nav class="pfad"><a href="${start}">Root Index</a> › ${esc(de ? s.deNav : s.enNav)}</nav>
<article>
${inhalt}
</article>
</main>
<footer>${fuss.filter(Boolean).join(" · ")}</footer>
</body>
</html>
`;
}

/* ---------- Lauf ---------- */
const rechtEn = rechtEnLaden();
if (!rechtEn.en) throw new Error("recht-texte.js liefert keine englischen Texte");
const textDe = legalOpenTexte("", rechtEn);
const textEn = legalOpenTexte("UK", rechtEn);
textDe.loeschung = LOESCHUNG.de;
textEn.loeschung = LOESCHUNG.en;

const dateien = [];
for (const s of SEITEN) {
  if (s.de) dateien.push([s.de, seite(s, "de", umbauen(textDe[s.key], "de"))]);
  if (s.en) dateien.push([s.en, seite(s, "en", umbauen(textEn[s.key], "en"))]);
}
// Pruefung: englische Fassung darf nicht versehentlich der deutsche Text sein
for (const [p, h] of dateien) if (p.startsWith("en/") && /Datenschutzerklärung – Root Index|Angaben gemäß § 5 DDG/.test(h)) throw new Error(`${p}: deutscher Text in englischer Seite`);

let veraltet = 0;
for (const [p, h] of dateien) {
  const ziel = join(WEB, p);
  const alt = existsSync(ziel) ? readFileSync(ziel, "utf8") : "";
  if (alt === h) continue;
  veraltet++;
  if (PRUEFEN) console.log(`veraltet: ${p}`);
  else { writeFileSync(ziel, h); console.log(`geschrieben: ${p} (${h.length} Zeichen)`); }
}
if (PRUEFEN && veraltet) { console.error(`${veraltet} Rechtsseite(n) passen nicht zu app.js/recht-texte.js – Skript ohne --pruefen laufen lassen.`); process.exit(1); }
if (!veraltet) console.log("Rechtsseiten aktuell.");
