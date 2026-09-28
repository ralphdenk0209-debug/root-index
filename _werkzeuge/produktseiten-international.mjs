#!/usr/bin/env node
/* =============================================================================
   Root Index – Produktseiten International (EN/FR)            28.09.2026
   -----------------------------------------------------------------------------
   Ralph (28.09.2026): "werden die produktkarten für google auch gebaut und
   ausgeliefert?" – "ja auf jeden fall."

   Baut fuer die Produkte der Maerkte UK/US (Englisch) und FR (Franzoesisch)
   eigene Seiten, damit Google sie in der Landessprache findet:

     en/product/<slug>.html          englische Produktseite (UK, US, Irland)
     en/product/category-<x>.html    englische Kategorieseite
     en/product/index.html           Verzeichnis
     fr/produit/<slug>.html          franzoesische Produktseite (FR)
     fr/produit/categorie-<x>.html   franzoesische Kategorieseite
     fr/produit/index.html           Verzeichnis
     sitemap-int.xml                 alle URLs dieser Seiten

   Quelle: Sicht v_web_produkte_int (= v_web_produkte ohne DE-Filter, nur
   UK/US/FR, dazu Spalte markt). Zutaten- und Kategorienamen kommen aus
   cb_anzeigenamen(en|fr) – derselben Quelle, die die App nutzt. Die deutschen
   Seiten (produkt/) baut weiterhin produktseiten-generieren.mjs; dieser Lauf
   fasst sie nicht an und kann sie nicht kaputt machen.

   Ausgeliefert wird vorerst unter root-index.de (INWX-Webspace). Zieht .com
   auf den Webspace, reicht es, DOMAIN umzustellen (Umzug mit 301).

   REGELN wie beim deutschen Generator: nichts erfinden, fehlende Felder
   weglassen, die Seite zeigt nur den Serverzustand. Deutsche Freitexte des
   Servers (warum/schwaechen) werden NICHT gezeigt – sie sind nicht uebersetzt.
   ============================================================================= */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const WEB = process.env.RI_WEB || dirname(HIER);
const DOMAIN = process.env.RI_DOMAIN_INT || "https://root-index.de";

const FELDER = "id,name,marke,kategorie,clean_score,bewertung,score_vollstaendig,zutaten,p_zutaten,p_zusatzstoffe,p_nova,p_naehrwert,ernaehrungsform,quelle,m_kcal,m_protein,m_fett,m_ges_fett,m_kh,m_zucker,m_ballast,m_salz,ean,bio,inhalt_menge,inhalt_einheit,mengen_einheit,verifiziert_am,spuren_hinweis,markt";

/* ---------- Sprachen ---------- */
const SPR = {
  en: {
    maerkte: ["UK", "US"], ordner: "en/product", kat: "category", html: "en",
    claim: "The front sells.<br>We read the back.",
    produkte: "Products", verzeichnis: "Product directory",
    titel: (m, n) => `${m ? m + " " : ""}${n} – Ingredients, Nutrition & Rating | Root Index`,
    besch: (s, w, basis, m, n, k) => [s !== null ? `Root Index rating: ${s}/100${w ? " (" + w + ")" : ""}.` : null,
      `Ingredients and nutrition per ${basis} for ${m ? m + " " : ""}${n}.`, k ? `Category: ${k}.` : null],
    wort: { "Sehr gut": "Very good", "Gut": "Good", "Mittel": "Medium", "Schwach": "Weak" }, vorlaeufig: "Provisional",
    ef: { "vegan": "🌱 vegan", "vegetarisch": "🥚 vegetarian", "enthält Tierprodukte": "🥩 contains animal products" },
    achsen: ["Ingredients", "Additives", "Processing", "Nutrition"],
    nw: ["Energy", "Protein", "Fat", "of which saturates", "Carbohydrate", "of which sugars", "Fibre", "Salt"],
    rang: (p, g, k) => `🏆 <b>Rank ${p} of ${g}</b> in “${k}” – compared within the category, not oil with bread.`,
    inListe: (n) => `In the ingredient list · ${n}`,
    legende: (k) => `Small number = ingredient score from 0 to 10 · <span style="color:var(--gelb)">Yellow</span> = score 3 or worse${k ? " · ⚠ = flagged as critical" : ""}`,
    spuren: (t) => `<b>Allergy note from the label:</b> ${t} – traces are not an ingredient and do not count towards the Root Index.`,
    nwKopf: (b) => `Nutrition per ${b}`,
    e1: (n, m, s, w) => `${n}${m ? " by " + m : ""} scores ${s} out of 100 in the Root Index${w ? " – " + w : ""}.`,
    e2eins: (z, r) => `The product has a single ingredient: ${z}${r !== null ? ` with a score of ${r} out of 10` : ""}.`,
    e2: (n, st, sw, bsp) => `Of ${n} ingredients, ${st} ${st === 1 ? "is" : "are"} rated 8 or better and ${sw} ${sw === 1 ? "is" : "are"} rated 3 or worse${bsp ? ", including " + bsp : ""}.`,
    e3: (k) => k === 1 ? "One ingredient is flagged as critical." : `${k} ingredients are flagged as critical.`,
    e4: (b, t) => `Per ${b}: ${t}.`,
    kcal: "kcal", zucker: "g sugars", ballast: "g fibre", salz: "g salt",
    app: "Open in the app", appSub: "with diary, shopping list and better alternatives",
    besser: (k) => `Better rated${k ? " in " + k : ""}`,
    quelle: "Source", geprueft: "checked on",
    kategorieBesch: (n, k) => `${n} products in the category ${k} with Root Index rating, ingredient list and nutrition per 100 g.`,
    kategorieText: (n) => `${n} products with Root Index rating, ingredients and nutrition.`,
    katTitel: (k) => `${k} – Products with rating | Root Index`,
    vzTitel: "Product directory – all rated products | Root Index",
    vzBesch: (n) => `${n} foods and supplements with Root Index rating, ingredient check and nutrition – sorted by category.`,
    vzText: (n, k) => `${n} products in ${k} categories – each page shows rating, ingredients and nutrition.`,
    weitere: "More products",
    fuss: "We rate the composition, not the marketing. No medical or dietary advice.",
    zurApp: "Open the app",
    rm: { frage: "Was this page helpful?", ja: "Yes", nein: "No", melden: "Report an error", fehlt: "What was missing?",
      falsch: "What is wrong? (ingredients, nutrition, brand …)", senden: "Send", danke: "Thank you for your feedback." },
    unt: { mehr: "See all rated products", app: "Root Index as an app", titel: "Support Root Index",
      text: "Voluntary contribution – help us stay independent and ad-free. No subscription, nothing in return.", knopf: "Support now ↗" },
    zahl: (v) => String(v),
  },
  fr: {
    maerkte: ["FR"], ordner: "fr/produit", kat: "categorie", html: "fr",
    claim: "Le recto vend.<br>Nous lisons le verso.",
    produkte: "Produits", verzeichnis: "Répertoire des produits",
    titel: (m, n) => `${m ? m + " " : ""}${n} – Ingrédients, valeurs nutritionnelles et note | Root Index`,
    besch: (s, w, basis, m, n, k) => [s !== null ? `Note Root Index : ${s}/100${w ? " (" + w + ")" : ""}.` : null,
      `Ingrédients et valeurs nutritionnelles pour ${basis} de ${m ? m + " " : ""}${n}.`, k ? `Catégorie : ${k}.` : null],
    wort: { "Sehr gut": "Très bon", "Gut": "Bon", "Mittel": "Moyen", "Schwach": "Faible" }, vorlaeufig: "Provisoire",
    ef: { "vegan": "🌱 végan", "vegetarisch": "🥚 végétarien", "enthält Tierprodukte": "🥩 contient des produits animaux" },
    achsen: ["Ingrédients", "Additifs", "Transformation", "Nutrition"],
    nw: ["Énergie", "Protéines", "Matières grasses", "dont acides gras saturés", "Glucides", "dont sucres", "Fibres alimentaires", "Sel"],
    rang: (p, g, k) => `🏆 <b>Place ${p} sur ${g}</b> dans « ${k} » – comparé au sein de la catégorie, pas l’huile avec le pain.`,
    inListe: (n) => `Dans la liste des ingrédients · ${n}`,
    legende: (k) => `Petit chiffre = note de l’ingrédient de 0 à 10 · <span style="color:var(--gelb)">Jaune</span> = note de 3 ou moins${k ? " · ⚠ = signalé comme critique" : ""}`,
    spuren: (t) => `<b>Mention allergènes de l’étiquette :</b> ${t} – les traces ne sont pas un ingrédient et ne comptent pas dans le Root Index.`,
    nwKopf: (b) => `Valeurs nutritionnelles pour ${b}`,
    e1: (n, m, s, w) => `${n}${m ? " de " + m : ""} obtient ${s} sur 100 au Root Index${w ? " – " + w : ""}.`,
    e2eins: (z, r) => `Le produit contient un seul ingrédient : ${z}${r !== null ? `, noté ${r} sur 10` : ""}.`,
    e2: (n, st, sw, bsp) => `Sur ${n} ingrédients, ${st} ${st <= 1 ? "a" : "ont"} une note de 8 ou plus et ${sw} une note de 3 ou moins${bsp ? ", dont " + bsp : ""}.`,
    e3: (k) => k === 1 ? "Un ingrédient est signalé comme critique." : `${k} ingrédients sont signalés comme critiques.`,
    e4: (b, t) => `Pour ${b} : ${t}.`,
    kcal: "kcal", zucker: "g de sucres", ballast: "g de fibres", salz: "g de sel",
    app: "Ouvrir dans l’app", appSub: "avec journal, liste de courses et meilleures alternatives",
    besser: (k) => `Mieux notés${k ? " dans " + k : ""}`,
    quelle: "Source", geprueft: "vérifié le",
    kategorieBesch: (n, k) => `${n} produits de la catégorie ${k} avec note Root Index, liste des ingrédients et valeurs nutritionnelles pour 100 g.`,
    kategorieText: (n) => `${n} produits avec note Root Index, ingrédients et valeurs nutritionnelles.`,
    katTitel: (k) => `${k} – Produits notés | Root Index`,
    vzTitel: "Répertoire des produits – tous les produits notés | Root Index",
    vzBesch: (n) => `${n} aliments et compléments avec note Root Index, analyse des ingrédients et valeurs nutritionnelles – par catégorie.`,
    vzText: (n, k) => `${n} produits dans ${k} catégories – chaque page montre la note, les ingrédients et les valeurs nutritionnelles.`,
    weitere: "Autres produits",
    fuss: "Nous évaluons la composition, pas le marketing. Aucun conseil médical ou diététique.",
    zurApp: "Ouvrir l’app",
    rm: { frage: "Cette page vous a-t-elle été utile ?", ja: "Oui", nein: "Non", melden: "Signaler une erreur", fehlt: "Qu’est-ce qui manquait ?",
      falsch: "Qu’est-ce qui est faux ? (ingrédients, valeurs nutritionnelles, marque …)", senden: "Envoyer", danke: "Merci pour votre retour." },
    unt: { mehr: "Voir tous les produits notés", app: "Root Index en app", titel: "Soutenir Root Index",
      text: "Contribution volontaire – aidez-nous à rester indépendants et sans publicité. Sans abonnement, sans contrepartie.", knopf: "Soutenir ↗" },
    zahl: (v) => String(v).replace(".", ","),
  },
};

/* ---------- Zugangsdaten aus app.js (eine Regel, ein Ort) ---------- */
function ausAppJs() {
  const app = readFileSync(join(WEB, "app.js"), "utf8");
  const url = app.match(/SUPABASE_URL\s*=\s*"([^"]+)"/);
  const key = app.match(/SUPABASE_KEY\s*=\s*"([^"]+)"/);
  if (!url || !key) throw new Error("SUPABASE_URL/KEY nicht in app.js gefunden");
  return { url: url[1], key: key[1] };
}

/* ---------- Daten holen: Keyset wie beim deutschen Generator ---------- */
const STUFEN = [200, 80, 30, 10, 3, 1];
async function holeAb(url, key, letzteId) {
  const nach = letzteId ? `&id=gt.${encodeURIComponent(letzteId)}` : "";
  let fehler = "";
  for (const groesse of STUFEN) {
    for (let versuch = 1; versuch <= 2; versuch++) {
      try {
        const r = await fetch(`${url}/rest/v1/v_web_produkte_int?select=${FELDER}&order=id&limit=${groesse}${nach}`, { headers: { apikey: key } });
        if (r.ok) return await r.json();
        fehler = `REST ${r.status}: ${(await r.text()).slice(0, 160)}`;
      } catch (e) { fehler = `Netzfehler: ${e.message}`; }
      await new Promise((f) => setTimeout(f, 1500 * versuch));
    }
    console.log(`  ! nach id ${letzteId}: ${groesse} Zeilen gingen nicht, versuche kleiner`);
  }
  throw new Error(`nach id ${letzteId} nicht zu holen - ${fehler}`);
}
async function alleProdukte(url, key) {
  const alle = [];
  let letzteId = null;
  while (true) {
    const teil = await holeAb(url, key, letzteId);
    if (teil.length === 0) break;
    alle.push(...teil);
    letzteId = teil[teil.length - 1].id;
  }
  return alle;
}
async function anzeigenamen(url, key, sprache) {
  const r = await fetch(`${url}/rest/v1/rpc/cb_anzeigenamen`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ p_sprache: sprache }),
  });
  if (!r.ok) throw new Error(`cb_anzeigenamen(${sprache}): REST ${r.status}`);
  return await r.json();
}

/* ---------- Helfer ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function slug(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/œ/g, "oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
// OFF liefert Werte wie 0.43999999761581 – auf zwei Stellen runden (nur Anzeige).
const rund = (v) => (v === null ? null : Math.round(v * 100) / 100);
function sauberName(n) {
  const roh = String(n || "");
  let s = roh;
  const i = s.search(/\s\d+[.,]\d{2}\s?[€£$]/);
  if (i > 0) s = s.slice(0, i);
  s = s.trim();
  return s.length >= 3 ? s : roh;
}

/* ---------- Seitenteile ---------- */
function stilVersion() {
  // Stil kommt vom deutschen Generator (/produkt/stil.css) – eine Quelle.
  try { return createHash("sha1").update(readFileSync(join(WEB, "produkt", "stil.css"))).digest("hex").slice(0, 10); }
  catch (e) { return "1"; }
}
function seiteJs(T, url, key) {
  // Zaehler wie produkt/seite.js (ohne Cookie, ohne Kennung) + Rueckmeldung in der Landessprache.
  return `(function(){try{
if(/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent))return;
var r=document.referrer,q="direkt";
if(r){var h="";try{h=new URL(r).hostname}catch(e){}
q=/(^|\\.)google\\./.test(h)?"google":/bing\\./.test(h)?"bing":/duckduckgo|ecosia|yahoo|qwant|startpage|brave/.test(h)?"andere-suche":/root-index\\.(de|com)$/.test(h)?"intern":"andere";}
try{if(/(^|[?&])von=com([&#]|$)/.test(location.search))sessionStorage.setItem("ri_von","com");
if(sessionStorage.getItem("ri_von")==="com")q="com";}catch(e){}
fetch("${url}/rest/v1/rpc/cb_seite_zaehlen",{method:"POST",keepalive:true,headers:{"apikey":"${key}","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_quelle:q})}).catch(function(){});
}catch(e){}})();
(function(){try{
var w=document.getElementById("rmBox");if(!w)return;
function senden(u,t){return fetch("${url}/rest/v1/rpc/cb_seite_rueckmeldung",{method:"POST",keepalive:true,headers:{"apikey":"${key}","Content-Type":"application/json"},body:JSON.stringify({p_seite:location.pathname,p_urteil:u,p_text:t||null})}).catch(function(){})}
function danke(){w.innerHTML='<span class="dank">${T.rm.danke.replace(/'/g, "\\'")}</span>'}
function schon(){try{return localStorage.getItem("ri_rm_"+location.pathname)==="1"}catch(e){return false}}
function merken(){try{localStorage.setItem("ri_rm_"+location.pathname,"1")}catch(e){}}
if(schon()){danke();return}
var f=document.getElementById("rmForm"),ta=document.getElementById("rmText"),art="nein";
document.getElementById("rmJa").onclick=function(){senden("ja");merken();danke()};
function auf(a,txt){art=a;f.classList.add("auf");document.getElementById("rmFrage").textContent=txt;ta.focus()}
document.getElementById("rmNein").onclick=function(){auf("nein",${JSON.stringify(T.rm.fehlt)})};
document.getElementById("rmMeld").onclick=function(){auf("meldung",${JSON.stringify(T.rm.falsch)})};
document.getElementById("rmSend").onclick=function(e){e.preventDefault();senden(art,(ta.value||"").slice(0,500));merken();danke()};
}catch(e){}})();
`;
}

function seite(T, V, jsV, { titel, beschreibung, kanonisch, inhalt, jsonld, rueckmeldung }) {
  const basis = "/" + T.ordner + "/";
  const rm = rueckmeldung ? `<div class="rm" id="rmBox">
<b>${esc(T.rm.frage)}</b><span class="kn"><button type="button" id="rmJa">${esc(T.rm.ja)}</button><button type="button" id="rmNein">${esc(T.rm.nein)}</button></span>
<span class="kn"><button type="button" id="rmMeld">${esc(T.rm.melden)}</button></span>
<form id="rmForm"><label for="rmText" id="rmFrage">${esc(T.rm.fehlt)}</label>
<textarea id="rmText" maxlength="500" rows="3"></textarea>
<div class="send"><button type="submit" id="rmSend">${esc(T.rm.senden)}</button></div></form>
</div>
<div class="unt">
<p class="mehr"><a href="${basis}">${esc(T.unt.mehr)}</a> · <a href="/?markt=${T.maerkte[0]}">${esc(T.unt.app)}</a></p>
<div class="kasten">
<b>${esc(T.unt.titel)}</b>
<p>${esc(T.unt.text)}</p>
<a class="btn" href="https://buy.stripe.com/bJedR88cq2V26jCbxB1gs00?client_reference_id=produktseite-${T.html}" target="_blank" rel="noopener nofollow">${esc(T.unt.knopf)}</a>
</div></div>` : "";
  return `<!doctype html>
<html lang="${T.html}">
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
<meta property="og:locale" content="${T.html === "fr" ? "fr_FR" : "en_GB"}">
<link rel="preload" href="/fonts/inter-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<link rel="stylesheet" href="/produkt/stil.css?v=${V}">
</head>
<body>
<header class="kopf"><a class="logo" href="/?markt=${T.maerkte[0]}"><img src="/logo-mark.png" alt="" onerror="this.style.display='none'">Root Index</a><div class="claim">${T.claim}</div></header>
<main>
${inhalt}
${rm}
<p class="fuss">${esc(T.fuss)} · <a href="/?markt=${T.maerkte[0]}">${esc(T.zurApp)}</a> · <a href="${basis}">${esc(T.verzeichnis)}</a></p>
</main>
<script src="${basis}seite.js?v=${jsV}" defer></script>
</body>
</html>`;
}

/* Fluxkompensator und Achsen: Geometrie wie im deutschen Generator. */
const ACHSEN = [["p_zutaten", 30, "#16a34a", 1], ["p_zusatzstoffe", 15, "#3987e5", 1], ["p_nova", 15, "#7c6fe0", 1], ["p_naehrwert", 40, "#d97706", 2]];
const RING = { "Sehr gut": "#16a34a", "Gut": "#65a30d", "Mittel": "#e8920c", "Schwach": "#dc2626" };
const SCHRIFT = { "Sehr gut": "#7CFF9B", "Gut": "#b9e56f", "Mittel": "#FFC24B", "Schwach": "#ff8a7a" };
function fluxSvg(p, score, ringfarbe) {
  const A = ACHSEN.map(([f, max, farbe, k]) => {
    const v = num(p[f]) === null ? null : num(p[f]) * k;
    return { f: farbe, pct: v === null ? null : Math.max(0, Math.min(1, v / max)) };
  });
  const L = 92;
  const bahn = ["M26 34 H74 L106 64", "M274 34 H226 L194 64", "M26 142 H74 L106 112", "M274 142 H226 L194 112"];
  const kap = [[26, 34], [274, 34], [26, 142], [274, 142]];
  const ziel = score === null ? "–" : String(Math.round(score));
  return `<svg viewBox="0 0 300 176" style="width:100%;display:block" role="img" aria-label="Root Index ${ziel}/100">`
    + `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">`
    + bahn.map((d) => `<path d="${d}" stroke="rgba(243,238,220,.14)"/>`).join("")
    + A.map((a, i) => `<path d="${bahn[i]}" stroke="${a.pct === null ? "rgba(243,238,220,.28)" : a.f}" stroke-dasharray="${L}" stroke-dashoffset="${(a.pct === null ? L : L * (1 - a.pct)).toFixed(1)}"/>`).join("")
    + `</g>`
    + A.map((a, i) => `<circle cx="${kap[i][0]}" cy="${kap[i][1]}" r="7" fill="${a.pct === null ? "#9aa7a0" : a.f}"/>`).join("")
    + `<circle cx="150" cy="88" r="42" fill="#1d321f" stroke="${score === null ? "#9aa7a0" : ringfarbe}" stroke-width="5"/>`
    + `<text x="150" y="103" text-anchor="middle" style="font-size:44px;font-weight:800;font-family:Inter,sans-serif" fill="#F3EEDC">${ziel}</text>`
    + `</svg>`;
}
function achsenHtml(T, p) {
  return ACHSEN.map(([f, max, farbe, k], i) => {
    const v = num(p[f]) === null ? null : Math.round(num(p[f]) * k * 10) / 10;
    const pct = v === null ? 0 : Math.max(0, Math.min(100, v / max * 100));
    return `<div class="achse"><div class="l">${esc(T.achsen[i])}</div><div class="bar"><i style="width:${pct.toFixed(0)}%;background:${farbe}"></i></div>`
      + `<div class="v">${v === null ? "–" : T.zahl(v)}<span style="color:var(--mut);font-weight:600">/${max}</span></div></div>`;
  }).join("");
}

function produktSeite(T, V, jsV, p, datei, katDatei, kat, alternativen, rang) {
  const basisPfad = "/" + T.ordner + "/";
  const name = p.name;
  const marken = String(p.marke || "").split(",").map((t) => t.trim()).filter(Boolean);
  const markeVoll = marken.join(" · ");
  const erste = marken[0] || "";
  const marke = erste && !String(name).toLowerCase().startsWith(erste.toLowerCase()) ? erste : "";
  const kanonisch = `${DOMAIN}${basisPfad}${datei}`;
  const basis = (p.mengen_einheit || "g").toLowerCase() === "ml" ? "100 ml" : "100 g";
  const score = num(p.clean_score);
  const voll = p.score_vollstaendig !== false;
  const wortDe = p.bewertung || "";
  const wort = voll ? (T.wort[wortDe] || "") : T.vorlaeufig;
  const wortKurz = T.wort[wortDe] || "";
  const ringfarbe = RING[wortDe] || "#9aa7a0";
  const schrift = SCHRIFT[wortDe] || "#F3EEDC";
  const titel = T.titel(marke, name);
  const beschreibung = T.besch(score, wortKurz, basis, marke, name, kat).filter(Boolean).join(" ").slice(0, 300);

  const zutaten = (Array.isArray(p.zutaten) ? p.zutaten : []).filter((z) => z && z.name);
  const schwach = zutaten.filter((z) => num(z.rating) !== null && num(z.rating) <= 3);
  const stark = zutaten.filter((z) => num(z.rating) !== null && num(z.rating) >= 8).length;
  const kritische = zutaten.filter((z) => z.kritisch).length;
  const naehr = [
    num(p.m_kcal) !== null ? `${Math.round(num(p.m_kcal))} ${T.kcal}` : null,
    num(p.m_zucker) !== null ? `${T.zahl(rund(num(p.m_zucker)))} ${T.zucker}` : null,
    num(p.m_ballast) !== null ? `${T.zahl(rund(num(p.m_ballast)))} ${T.ballast}` : null,
    num(p.m_salz) !== null ? `${T.zahl(rund(num(p.m_salz)))} ${T.salz}` : null,
  ].filter(Boolean);
  const einordnung = [
    score !== null ? T.e1(esc(name), marke ? esc(marke) : "", score, esc(wortKurz)) : null,
    zutaten.length === 0 ? null
      : zutaten.length === 1 ? T.e2eins(esc(zutaten[0].name), num(zutaten[0].rating))
        : T.e2(zutaten.length, stark, schwach.length, schwach.slice(0, 3).map((z) => esc(z.name)).join(", ")),
    kritische ? T.e3(kritische) : null,
    naehr.length ? T.e4(basis, naehr.join(", ")) : null,
  ].filter(Boolean).join(" ");

  const jsonld = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: T.produkte, item: `${DOMAIN}${basisPfad}` },
      { "@type": "ListItem", position: 2, name: kat, item: `${DOMAIN}${basisPfad}${katDatei}` },
      { "@type": "ListItem", position: 3, name },
    ],
  };
  const zutatenHtml = zutaten.map((z) => {
    const n = num(z.rating);
    const t = esc(z.name) + (n !== null ? `<sup>${n}</sup>` : "") + (z.kritisch ? ` <span class="krit">⚠</span>` : "");
    return `<span>${n !== null && n <= 3 ? `<u>${t}</u>` : t}</span>`;
  }).join(", ");
  const NW = [
    [["m_kcal", 0, "kcal", 0], ["m_protein", 1, "g", 0], ["m_fett", 2, "g", 0], ["m_ges_fett", 3, "g", 1]],
    [["m_kh", 4, "g", 0], ["m_zucker", 5, "g", 1], ["m_ballast", 6, "g", 0], ["m_salz", 7, "g", 0]],
  ];
  const nwHtml = NW.map((sp) => sp.filter(([f]) => num(p[f]) !== null)
    .map(([f, i, e, davon]) => `<div class="zeile${davon ? " davon" : ""}"><span>${esc(T.nw[i])}</span><b>${f === "m_kcal" ? Math.round(num(p[f])) : T.zahl(rund(num(p[f])))} ${e}</b></div>`).join(""))
    .filter(Boolean).map((h) => `<div>${h}</div>`).join("");
  const zusatz = [kat, p.inhalt_menge ? `${T.zahl(rund(num(p.inhalt_menge)))} ${p.inhalt_einheit || ""}`.trim() : null, p.bio === true ? (T.html === "fr" ? "Bio" : "Organic") : null].filter(Boolean);
  const ef = T.ef[String(p.ernaehrungsform || "")];
  const offQuelle = /open food facts/i.test(String(p.quelle || ""));

  const inhalt = `
<nav class="krumen"><a href="${basisPfad}">${esc(T.produkte)}</a> › <a href="${basisPfad}${katDatei}">${esc(kat)}</a></nav>
${markeVoll ? `<div class="mk">${esc(markeVoll)}</div>` : ""}
<h1>${esc(name)}</h1>
${zusatz.length ? `<p class="zs">${esc(zusatz.join(" · "))}</p>` : ""}
${ef ? `<span class="pille">${esc(ef)}</span>` : ""}
<div class="bal">
  <div class="kt"><div class="flux">${fluxSvg(p, score, ringfarbe)}</div>
  <div class="ri"><small>ROOT INDEX</small><strong style="color:${schrift}">${score === null ? "–" : score}/100</strong><em style="color:${schrift}">${esc(String(wort).toUpperCase())}</em></div></div>
  <div class="achsen">${achsenHtml(T, p)}</div>
</div>
${rang ? `<p class="rang">${T.rang(rang.platz, rang.gesamt, esc(kat))}</p>` : ""}
${zutaten.length ? `<span class="lab">${esc(T.inListe(zutaten.length))}</span>
<div class="zt">${zutatenHtml}</div>
<div class="legende">${T.legende(kritische)}</div>` : ""}
${p.spuren_hinweis ? `<p class="legende">${T.spuren(esc(p.spuren_hinweis))}</p>` : ""}
${nwHtml ? `<span class="lab">${esc(T.nwKopf(basis))}</span><div class="nw">${nwHtml}</div>` : ""}
${einordnung ? `<p class="einordnung">${einordnung}</p>` : ""}
<a class="appbtn" href="/?p=${encodeURIComponent(p.id)}&amp;markt=${encodeURIComponent(p.markt)}">${esc(T.app)}<span>${esc(T.appSub)}</span></a>
${alternativen.length ? `<span class="lab">${esc(T.besser(kat))}</span><div class="liste">${
  alternativen.map((a) => `<a href="${basisPfad}${a.datei}"><span>${esc(a.name)}${a.marke ? ` <span style="color:var(--mut)">· ${esc(a.marke)}</span>` : ""}</span><b>${a.score}/100</b></a>`).join("")
}</div>` : ""}
<div class="quelle">${esc(T.quelle)}: ${offQuelle ? "Open Food Facts (ODbL)" : "Root Index"}${p.ean ? ` · EAN ${esc(p.ean)}` : ""}${p.verifiziert_am ? ` · ${esc(T.geprueft)} ${esc(String(p.verifiziert_am).slice(0, 10))}` : ""}</div>`;
  return seite(T, V, jsV, { titel, beschreibung, kanonisch, inhalt, jsonld, rueckmeldung: true });
}

/* ---------- Eine Sprache bauen ---------- */
function bauen(sprache, produkte, namen, V, url, key) {
  const T = SPR[sprache];
  const ZIEL = join(WEB, T.ordner);
  const basisPfad = "/" + T.ordner + "/";
  mkdirSync(ZIEL, { recursive: true });
  const js = seiteJs(T, url, key);
  const jsV = createHash("sha1").update(js).digest("hex").slice(0, 10);
  writeFileSync(join(ZIEL, "seite.js"), js);
  // Vollstaendige Neuerzeugung, nur .html in diesem Ordner.
  for (const f of readdirSync(ZIEL)) if (f.endsWith(".html")) unlinkSync(join(ZIEL, f));

  const tr = (de) => (de && namen[de]) || de;
  const liste = produkte.filter((p) => p && p.id && p.name && T.maerkte.includes(p.markt));
  const proKat = new Map();
  const vergeben = new Set();
  for (const p of liste) {
    p._name = sauberName(p.name);
    p._kat = tr(p.kategorie) || T.weitere;
    // Zutatennamen in die Landessprache; fehlt eine Uebersetzung, bleibt der Stammname.
    p._zutaten = (Array.isArray(p.zutaten) ? p.zutaten : []).map((z) => z && { ...z, name: tr(z.name) });
    const ersteMarke = String(p.marke || "").split(",")[0].trim();
    const markeDoppelt = ersteMarke && p._name.toLowerCase().startsWith(ersteMarke.toLowerCase());
    const teil = slug([markeDoppelt ? null : ersteMarke, p._name].filter(Boolean).join(" ")) || slug([ersteMarke, p._kat].join(" ")) || "product";
    let datei = `${teil}-${slug(p.id)}.html`;
    if (vergeben.has(datei)) datei = `${slug(p.id)}-${datei}`;
    vergeben.add(datei);
    const katDatei = `${T.kat}-${slug(p._kat) || "x"}.html`;
    if (!proKat.has(p._kat)) proKat.set(p._kat, { datei: katDatei, eintraege: [] });
    proKat.get(p._kat).eintraege.push({ p, datei });
  }
  const urls = [`${DOMAIN}${basisPfad}`];
  let geschrieben = 0;
  for (const [kat, { datei: katDatei, eintraege }] of proKat) {
    const bewertet = eintraege.filter((e) => num(e.p.clean_score) !== null).sort((a, b) => num(b.p.clean_score) - num(a.p.clean_score));
    const platz = new Map(bewertet.map((e, i) => [e.p.id, i + 1]));
    const vorrat = bewertet.slice(0, 40);
    for (const { p, datei } of eintraege) {
      const rang = platz.has(p.id) && bewertet.length >= 3 ? { platz: platz.get(p.id), gesamt: bewertet.length } : null;
      const kand = vorrat.filter((e) => e.p.id !== p.id && num(e.p.clean_score) > (num(p.clean_score) ?? -1));
      let h = 0; for (const z of String(p.id)) h = (h * 31 + z.charCodeAt(0)) % 100000;
      const alt = [];
      for (let k = 0; k < 3 && k < kand.length; k++) {
        const e = kand[(h + k * 7) % kand.length];
        if (!alt.some((a) => a.datei === e.datei)) alt.push({ datei: e.datei, name: e.p._name, marke: String(e.p.marke || "").split(",")[0].trim(), score: num(e.p.clean_score) });
      }
      const q = { ...p, name: p._name, zutaten: p._zutaten };
      writeFileSync(join(ZIEL, datei), produktSeite(T, V, jsV, q, datei, katDatei, kat, alt, rang));
      urls.push(`${DOMAIN}${basisPfad}${datei}`);
      geschrieben++;
    }
  }
  const kats = [...proKat.entries()].sort((a, b) => a[0].localeCompare(b[0], sprache));
  for (const [kat, { datei, eintraege }] of kats) {
    eintraege.sort((a, b) => a.p._name.localeCompare(b.p._name, sprache));
    const inhalt = `
<nav class="krumen"><a href="${basisPfad}">${esc(T.produkte)}</a></nav>
<h1>${esc(kat)}</h1>
<p class="marke">${esc(T.kategorieText(eintraege.length))}</p>
<div class="liste">${eintraege.map(({ p, datei: d }) =>
      `<a href="${basisPfad}${d}">${esc(p._name)}${p.marke ? " · " + esc(String(p.marke).split(",")[0].trim()) : ""}${num(p.clean_score) !== null ? ` <b>${p.clean_score}/100</b>` : ""}</a>`).join("")}</div>`;
    writeFileSync(join(ZIEL, datei), seite(T, V, jsV, {
      titel: T.katTitel(kat), beschreibung: T.kategorieBesch(eintraege.length, kat),
      kanonisch: `${DOMAIN}${basisPfad}${datei}`, inhalt, jsonld: null,
    }));
    urls.push(`${DOMAIN}${basisPfad}${datei}`);
  }
  writeFileSync(join(ZIEL, "index.html"), seite(T, V, jsV, {
    titel: T.vzTitel, beschreibung: T.vzBesch(geschrieben), kanonisch: `${DOMAIN}${basisPfad}`,
    inhalt: `<h1>${esc(T.verzeichnis)}</h1>
<p class="marke">${esc(T.vzText(geschrieben, kats.length))}</p>
<div class="liste">${kats.map(([kat, { datei, eintraege }]) => `<a href="${basisPfad}${datei}">${esc(kat)} <b>${eintraege.length}</b></a>`).join("")}</div>`,
    jsonld: null,
  }));
  const ohneUebersetzung = new Set();
  for (const p of liste) for (const z of (p.zutaten || [])) if (z && z.name && !namen[z.name]) ohneUebersetzung.add(z.name);
  console.log(`✅ ${sprache}: ${geschrieben} Produktseiten · ${kats.length} Kategorien · Zutatennamen ohne Übersetzung: ${ohneUebersetzung.size}`);
  return { urls, geschrieben, kategorien: kats.length, ohne: ohneUebersetzung.size };
}

/* ---------- Hauptlauf ---------- */
async function main() {
  const { url, key } = ausAppJs();
  const argDatei = process.argv.indexOf("--aus-datei");
  const produkte = argDatei > -1 ? JSON.parse(readFileSync(process.argv[argDatei + 1], "utf8")) : await alleProdukte(url, key);
  console.log(`Geladen: ${produkte.length} Produkte (UK/US/FR)`);
  if (!Array.isArray(produkte) || produkte.length === 0) throw new Error("0 Produkte – nichts geschrieben.");
  const V = stilVersion();
  const stand = { stand: new Date().toISOString() };
  const urls = [];
  for (const sprache of ["en", "fr"]) {
    const namen = argDatei > -1 && process.env.RI_NAMEN ? JSON.parse(readFileSync(process.env.RI_NAMEN, "utf8"))[sprache] || {} : await anzeigenamen(url, key, sprache);
    const r = bauen(sprache, produkte, namen, V, url, key);
    urls.push(...r.urls);
    stand[sprache] = { seiten: r.geschrieben, kategorien: r.kategorien, zutaten_ohne_uebersetzung: r.ohne };
  }
  writeFileSync(join(WEB, "sitemap-int.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
  mkdirSync(join(WEB, "en", "product"), { recursive: true });
  writeFileSync(join(WEB, "en", "product", "stand.json"), JSON.stringify(stand) + "\n");
  console.log(`✅ Sitemap international: ${urls.length} URLs`);
}

main().catch((e) => { console.error("❌ Produktseiten international: " + e.message); process.exit(1); });
