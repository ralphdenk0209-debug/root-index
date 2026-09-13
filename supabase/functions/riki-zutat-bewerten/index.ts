// riki-zutat-bewerten — EINE Zutat einstufen + verifizieren.
// Grundsatz (Ralphs Credo): Die Stufe wird NICHT von Hand festgelegt.
// Riki stuft nach dem Verarbeitungsgrad-Regelwerk ein (Stufe + Begruendung + Konfidenz).
// Danach pruefen unabhaengige Waechter (W-Name Morphologie + W-Peer Statistik) in cb_zutat_verifizieren.
// W-Ref (OFF/extern) ist VERTAGT — enthaelt sich (OFF-Abdeckung fuer deutsche Namen unzureichend).
// BESTAETIGT erst, wenn >=2 unabhaengige Waechter uebereinstimmen.
// v5 (19.07.2026): Extrakt-/Isolat-Staffel ergaenzt (Bewertungslogik §7).
// v6 (20.07.2026): Protein-Hydrolysat/-Isolat (Kollagenpeptide) = 4 ergaenzt.
// v7 (20.07.2026): MODELL umgestellt (Standard claude-sonnet-4-6, Kosten via cb_riki_buchen).
// v8 (27.07.2026, Ralph-Go): ENZYM-Regel + BAKTERIENKULTUR-Regel ergaenzt.
// v9 (29.07.2026, Ralph-Go, Kokosnussextrakt-Fall): QUID-Regel + Lebensmittel-Extrakte.
// v10 (30.07.2026, Ralph-Go "3 ja alle drei"): Fette/Oele nach Bezeichnung, Salz-Jodierung,
//   ganzes Getreidekorn = 10, dazu Prinzip 9 (ohne Angabe die vorsichtigere Stufe).
// v16 (30.07.2026, Ralph-Go "3a bis 3c"): Milch-Staffel als ein Block, Protein nach
//   Reinheitsgrad (Konzentrat 5 / Isolat 4), Malz 8 vs. Malzextrakt 2, Mehl ohne Type = 5,
//   Meersalz/Steinsalz = 7.
// v17 (31.07.2026, Ralph-Go): BUDGET-RIEGEL nachgeruestet. Diese Funktion war die EINZIGE ohne
//   Riegel - sie buchte nur HINTERHER. Ein Budget, das nicht bremst, ist keine Grenze, sondern
//   eine Statistik. Der Riegel steht bewusst NUR im Zweig, der Geld ausgibt (stufe === null);
//   wird eine Stufe mitgegeben, laeuft nur die kostenlose Verifikation und darf nie blockieren.
//   Antwort bei vollem Budget: HTTP 200 mit { budget_voll: true } OHNE stufe - bewusst 200, weil
//   functions.invoke bei non-2xx den Antwortkoerper verschluckt (CLAUDE.md §4).
// v18 (31.07.2026, Ralph-Go "Gegenleser bauen"): QUELLE im Protokoll unterscheidbar
//   (riki | etikett | gegenleser). BEWUSST eine Positivliste - freier Text waere §1.2d.
// v19 (31.07.2026, Ralph-Go): STAPEL-MODUS + Kosten-Aufschluesselung. Rund 90 % der Kosten sind
//   das Regelwerk, das je Zutat neu uebertragen wird; im Stapel wird es einmal bezahlt.
//   DER REGELTEXT BLEIBT UNVERAENDERT (§1.2c) - nur die AUFGABE steht in der Nutzer-Nachricht.
// v20 (31.07.2026, Ralphs Fund "persil??? waschmittel?"): SPRACHE wird gemeldet. Statt einer
//   fuenften Wortliste (Sperrlisten-Falle §1.2b) sagt das Modell selbst, ob der Name deutsch ist.
// v21 (01.08.2026, Ralph-Go "3a bis 3c"): WASSER-Regel (Aufbereitung entscheidet) + GELLAN.
// v24 (01.08.2026, Ralph-Go "prompt nachziehen"): Gleichlauf zu vier Regeln vom 01.08.
//   (1) staffel/getreide - die Spanne "6-7" war eine ungeregelte Luecke mit Regel-Anschein.
//       Merkmal ist jetzt die Typenzahl (= Mineralstoffgehalt, DIN 10355).
//   (2) staffel7/matrix - Merkmal: ganzer Traeger 7, Fraktion 6. Am Bestand gemessen.
//   (3) staffel/emulgator - NEU. E471 trug im Stamm VIER Noten (3/4/5/6); 26 Produkte waren
//       bestraft, WEIL der Hersteller den Stoff genannt hat - Transparenz darf keine Note kosten.
//   (4) Pektin/Gellan standen schon in v23 - nur gegengeprueft, nicht gedoppelt.
// v25 (02.08.2026, Ralph-Go "weiter mit v24 durcharbeiten"): Gleichlauf zu den zwei Regeln, die
//   beim Durcharbeiten der v24-Restpunkte in Bewertungsregeln ergaenzt wurden (CLAUDE.md §0.05).
//   (a) staffel/emulgator + STEAROYLLACTYLATE (E481/E482) = 4 und eine MISCH-REGEL fuer mehrere
//       benannte Stoffe in einer Klammer: es gilt die STRENGSTE benannte Stufe. Anlass war
//       "Emulgatoren (E471, E481)" = 3 an 324 aktiven Produkten - E471 stand laengst auf 4, E481
//       war ungeregelt, und die 3 traf ausgerechnet den Hersteller, der BEIDE Stoffe nennt.
//       Ohne die Misch-Regel haette der naechste Lauf denselben Eintrag wieder frei ausgewuerfelt.
//   (b) staffel7/stdextrakt + isolierte/modifizierte CELLULOSEN (E460-E466, HPMC E464, auch als
//       Kapselhuelle, Methylcellulose, Cellulosegummi) = 4 wie Pektin und Gellan. Anlass: HPMC
//       trug im Stamm DREI Noten (4/5/6) - derselbe Stoff, unterschiedlich beklammert (§1.11n).
//   Nur Regeltext. Code, Stapel-Logik und Budget-Riegel unveraendert.
// v26 (02.08.2026, Ralph-Go "3a"): NEUE Regel staffel/garen im Gleichlauf (CLAUDE.md §0.05).
//   Garen war ungeregelt: 97 gegarte Stamm-Zutaten trugen Noten von 4 bis 10, und Riki wuerfelte
//   jeden neuen Fall frei aus. Die Regel ist NICHT gesetzt, sondern aus zwei vorhandenen Ankern
//   abgeleitet: s10 definiert Stufe 10 als "roh, nichts entfernt oder zugesetzt", und
//   staffel/milch zeigt denselben Erhitzungsschritt bereits (Rohmilch 10 → pasteurisiert 9).
//   Daraus folgt: Garen kostet die 10 - mehr nicht, denn es entfernt nichts und isoliert nichts.
//   Am Bestand gegengeprueft: 60 von 97 Eintraegen standen bereits so. Nur Regeltext.
// v27 (10.08.2026, Ralph-Go "weiter mit riki"): Gleichlauf zu den zwei Regelaenderungen
//   vom 10.08. in Bewertungsregeln (CLAUDE.md §24).
//   (a) ENZYM: "oder Protein-Isolat (5)" ersetzt durch "oder ein industriell isolierter
//       Stoff der Stufe 4-5". Der Satz widersprach dem Block ISOLIERTE PROTEINE IM SELBEN
//       PROMPT (Isolat/Hydrolysat = 4). In staffel/enzym am 10.08. ebenso behoben.
//   (b) BAKTERIENKULTUR: Sammelbegriffe ohne Stammnamen ("Kulturen", "Bakterienkulturen",
//       "Mikroorganismenkulturen", "Mikrobielle Kultur", "Kombucha-Kulturen") ausdruecklich
//       auf 8. Anlass: alle fuenf standen auf 3 und mussten am 10.08. korrigiert werden
//       (15 Bindungen). Der Prompt kannte die Regel, aber nicht die Woerter, die auf den
//       Etiketten stehen. Dazu: ein vorangestelltes Wort kippt die Zuordnung nicht
//       ("vegane Starterkultur" stand auf 3, obwohl "Starterkultur" woertlich als 8 gelistet
//       ist), und die Kategorie Bakterienkultur ist Pflicht, weil sonst der Waechter blind ist.
//   (c) BUTTERREINFETT: KEINE Aenderung noetig - der Prompt fuehrte es bereits nur im
//       Ausschluss und nie bei den Tierfetten. Hier war Riki sauberer als die Datenbank.
//   Nur Regeltext. Code, Stapel-Logik und Budget-Riegel unveraendert.
// v28 (10.08.2026, Ralph-Go "Riki-Gleichlauf v28"): Gleichlauf zu den ZWEI NEUEN Regeln
//   vom 10.08. in Bewertungsregeln (CLAUDE.md §24).
//   (a) staffel/roesten (Reihenfolge 88, Wert 9/5) - NEU. Roesten war ungeregelt: der
//       GAREN-Block benennt die Luecke seit v26 woertlich ("Braten, Fritieren, Roesten und
//       Backen ... fallen nicht hierunter"), gefuellt hat sie niemand. Merkmal ist das
//       ZUGESETZTE FETT, nicht die Hitze: trocken geroestet 9, in Fett geroestet/frittiert 5,
//       ohne Angabe nach Prinzip 9 die 5. Mahlen kostet nicht zusaetzlich. Am Bestand
//       gegengeprueft 10.08.: 150 Stammeintraege mit 722 Bindungen tragen Roest-Begriffe,
//       378 Bindungen standen bereits auf 9.
//   (b) staffel/fermentation (Reihenfolge 87, Wert 8) - NEU. Das fermentierte LEBENSMITTEL
//       war ungeregelt; geregelt war nur die KULTUR (staffel/bakterienkultur). Fermentation
//       entfernt keine Fraktion und isoliert nichts, kostet also keine Stufe. Trocknen
//       ebenfalls nicht (Ralph-Entscheid A). Milcherzeugnisse sind ausgenommen - die
//       speziellere staffel/milch geht vor (Joghurtpulver, Molkenpulver, Kaesepulver = 6).
//       Am Bestand gegengeprueft 10.08.: 408 Bindungen standen bereits auf 8, kein Gegenbeispiel.
//   (c) 🔴 WIDERSPRUCH IM PROMPT BEHOBEN, gefunden durch VERGLEICHEN statt Kopieren (§24):
//       Der WASSER-Block fuehrte "Sauerteig" als Beispiel fuer eine ZUBEREITUNG, die nach dem
//       Gesamterzeugnis eingestuft wird - genau das Gegenteil der neuen Regel, nach der das
//       Ansetzwasser nicht zaehlt. Das Wort ist aus der Aufzaehlung entfernt; die uebrigen
//       Beispiele (Teig, Marinade, Pflanzendrinks, Fond) bleiben unveraendert.
//   Nur Regeltext. Code, Stapel-Logik und Budget-Riegel unveraendert.
// v29 (10.08.2026, Ralph-Go "Riki v29 machen"): Gleichlauf zur NEUEN Regel
//   staffel/zubereitung (Reihenfolge 89, Wert 5) vom 10.08. (CLAUDE.md §24).
//   ANLASS: Der Satz stand seit v26 als ABGRENZUNG im GAREN-Block ("sobald etwas ANDERES
//   zugesetzt ist ... nach dem GESAMTERZEUGNIS") und war dort als Nebensatz einer
//   Garen-Regel nicht auffindbar. Er gilt aber auch OHNE Garschritt. In Bewertungsregeln
//   am 10.08. als eigener Schluessel herausgeloest - kein neuer Inhalt (§4.2).
//   MERKMAL: nennt der NAME die Verarbeitung? "Passata"/"Pueree"/"passierte" nennen sie
//   (8 bleibt), "Soße"/"Sauce"/"Ketchup" nennen sie nicht (Prinzip 9 -> 5).
//   BESTAND: Tomatensoße 8 -> 5 (12 Bind.) und Ketchup (Tomatenmark, Rohrohrzucker, ...)
//   8 -> 5 (3 Bind.) am 10.08. korrigiert; die 5er-Seite trug bereits 67 Bindungen
//   (tomatensauce 43, Sojasoße 15, soße 3, Tafelsenf 2, speisesenf 1, Ketchup-Varianten 3).
//   NICHT AUFGENOMMEN, beim Vergleichen gefunden (§24): Sojasauce steht im Stamm auf 6,
//   Sojasoße auf 5 - drei Regeln, drei Stufen, ein Stoff. Ungeklaert, deshalb kein Beispiel
//   im Prompt. Eigener Durchgang.
//   Nur Regeltext. Code, Stapel-Logik und Budget-Riegel unveraendert.
// v30 (10.08.2026, Ralph-Go "weiter mit gurken" + zweites Go): Gleichlauf zum Absatz
//   EINLEGEN UND SAEUERN, der am 10.08. in staffel/zubereitung ergaenzt wurde (CLAUDE.md §24).
//   ANLASS: Geplant war eine eigene Staffel staffel/einlegen mit Abstufung nach Zusatz
//   (Salzlake 7 → Essig 6 → Gewuerz+Zucker 5). Die breitere Messung am Bestand hat das
//   WIDERLEGT: acht Eintraege standen bereits auf 5 (eingelegte gurken, Gewuerzgurken,
//   eingelegte Kapern in zwei Schreibweisen, Pfefferonen eingelegt, Eingelegte
//   Peperonistuecke, getrocknete Tomaten eingelegt, Amarena-Kirschen), Abweichler waren
//   genau zwei. Wie stark gesaeuert wird, aendert die Stufe also nicht - eine Abstufung
//   danach waere eine Regel ohne Beleg gewesen. Deshalb KEIN neuer Schluessel, sondern ein
//   Absatz in der vorhandenen Regel (§4.2).
//   BESTAND: Essiggurken 6 → 5 (6 Bind.) und Salz-Dill-Gurken 7 → 5 (1 Bind.) am 10.08.
//   korrigiert; P66342 (Aktiv, Verifiziert) blieb bei Clean_Score 51 "Schwach".
//   TRENNSTRICH, den der Bestand selbst liefert: "Milchsauer vergorene Gurken" steht auf 8
//   und bleibt dort - das ist Fermentation, nicht Einlegen.
//   Nur Regeltext. Code, Stapel-Logik und Budget-Riegel unveraendert.

// v36 (12.09.2026) — Systemaufruf baut seinen eigenen Client mit dem
//   Service-Schluessel; der Schluessel ist kein JWT und darf nicht als
//   Authorization durchgereicht werden. Sonst unveraendert.
// v35 (12.09.2026) — Systemaufruf mit Service-Schluessel zugelassen, damit der
//   Stapel-Takt die Maschine ueberhaupt erreichen kann. Sonst unveraendert.
// v34 (12.09.2026) — KATEGORIE wird verlangt und durchgereicht.
//   ANLASS: cb_zutat_stamm_anlegen verlangt eine Kategorie, und der Riegel
//   cb_trg_keine_note_ohne_kategorie laesst ohne sie nichts durch. Im Editor fragt der
//   Mensch danach (zutKatFrage); im Stapel fragt niemand - damit war der Massenlauf
//   blockiert, obwohl Stufe und Regel laengst stimmten.
//   Die erlaubten Bezeichnungen stehen NICHT hier im Code, sondern im Abschnitt KATEGORIEN,
//   den cb_riki_regelwerk_holen aus dem Bestand erzeugt (Kategorien mit mindestens 25
//   bewerteten Zutaten). So bleibt die Liste von selbst aktuell und es gibt keine zweite
//   Kopie, die veralten kann - dieselbe Lehre wie beim Regeltext am 11.09.
// v33 (12.09.2026, nach der Messung an v32) — DIE ANTWORT WIRD KOMPAKT VERLANGT.
//   GEMESSEN: v32 lief bei 10 Namen sauber durch (10 von 10 mit Regel-Kennung,
//   Begruendungen 3-6 Woerter statt 15), brach aber bei 60 Namen mit "kein Array" ab.
//   Ursache: 1.115 Ausgabe-Token fuer 10 Namen = 111 je Zutat - MEHR als die 91 vor v32,
//   obwohl die Begruendung kuerzer wurde. Das Modell antwortete eingerueckt und in einem
//   Code-Zaun; Einrueckung und Zeilenumbrueche kosten bei sieben Feldern mehr, als die
//   kuerzere Begruendung einspart. 60 x 111 = 6.660 Token lagen ueber dem Deckel von
//   300 + 60*100 = 6.300 - die Antwort wurde mitten im Array abgeschnitten.
//   (a) Die Antwort wird jetzt NACKT und EINZEILIG verlangt.
//   (b) Der Deckel steigt auf 400 + n*130, damit eine knappe Antwort nicht am Rand steht.
//   (c) Der Fehlerfall zeigt Anfang UND Ende der Rohantwort plus Ausgabe gegen Deckel -
//       am Anfang allein war nicht zu sehen, dass abgeschnitten wurde.
// v32 (12.09.2026, Ralph "ja, weiter") — DREI KLEINE AENDERUNGEN, nur am Stapel-Auftrag.
//   (a) REGEL_ID wird verlangt und durchgereicht. Seit dem 11.09. haengt cb_riki_regelwerk_holen
//       die aktive Regeltabelle mit Kennungen an den Regeltext (236 Regeln statt der 64, die der
//       gepflegte Text von v30 kannte). Die Kennung ist der Anker fuer Stufe 1 von
//       cb_zutat_vorschlag_pruefen: nennt der Vorschlag eine Regel, entscheidet deren Wert.
//       Bis jetzt tauchten die Kennungen nur im Begruendungstext auf und waren nicht auswertbar.
//   (b) BEGRUENDUNG auf hoechstens 10 Woerter. GEMESSEN am 11.09. mit einem 60er-Stapel:
//       5.459 Ausgabe-Token fuer 60 Namen = 91 Token je Zutat. Bei 15 USD je Million ist die
//       Antwort damit der Kostentreiber (0,14 von 0,16 Cent je Zutat) - das Regelwerk selbst
//       kostet dank Prompt-Cache fast nichts mehr (cache_gelesen 40.275, geschrieben 0).
//   (c) Sonst NICHTS. Regeltext, Budget-Riegel, Einzelweg, Verifikation unveraendert.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PREISE: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6":         { in: 3.0, out: 15.0 },
};

function findeKey(): string | null {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) return off.trim();
  for (const v of Object.values(env)) if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return v.trim();
  return null;
}

/* v31 (10.08.2026, Ralph zweites Go nach §27.3): DER REGELTEXT STEHT NICHT MEHR HIER.
   Er liegt EINMAL in der Datenbank (Tabelle Riki_Regelwerk, Leseweg cb_riki_regelwerk_holen)
   und wird zur Laufzeit geholt. ANLASS: fuenf Edge Functions fuehrten je eine eigene Kopie der
   Verarbeitungsgrad-Staffel, vier davon kannten v24-v30 nicht. §17 verbietet die zweite Kopie.
   Eine Regelkorrektur wirkt ab jetzt ohne Deploy in allen Functions, die so lesen.
   STARTWERT ist der v30-Text, WOERTLICH: Version 30, 26.089 Zeichen,
   md5 3b448bc51c7f1f93e064c4cb670426aa - identisch mit _sicherungen/riki-zutat-bewerten-v30-2026-08-10.ts.
   Verifiziert war v30 mit 6 von 6 Sollwerten (Gurken-Reihe, 10.08.).
   KEIN RUECKFALL: kommt der Text nicht, bricht die Function ab und meldet das.
   Eine Einstufung ohne vollstaendiges Regelwerk waere schlimmer als keine (§1.2, §1.7).
   Nur der Regeltext-Bezug ist geaendert. Code, Stapel-Logik und Budget-Riegel unveraendert. */
async function regelHolen(sb: any): Promise<{ ok: boolean; text: string; version: number | null; fehler: string }> {
  try {
    const { data, error } = await sb.rpc("cb_riki_regelwerk_holen", { p_schluessel: "verarbeitungsgrad" });
    if (error) return { ok: false, text: "", version: null, fehler: "Regelwerk nicht lesbar: " + (error.message ?? String(error)) };
    if (!data || data.ok !== true || typeof data.text !== "string" || data.text.length < 1000) {
      return { ok: false, text: "", version: null, fehler: String(data?.fehler ?? "Regelwerk nicht lesbar: leere oder zu kurze Antwort") };
    }
    return { ok: true, text: data.text, version: Number(data.version), fehler: "" };
  } catch (e) {
    return { ok: false, text: "", version: null, fehler: "Regelwerk nicht lesbar: " + String(e) };
  }
}

/* v18: nur diese drei Quellen sind zulaessig. Freitext waere die Falle aus §1.2d. */
function quelleErlaubt(q: unknown): string | null {
  const s = String(q ?? "").trim();
  return (s === "riki" || s === "etikett" || s === "gegenleser") ? s : null;
}

/* v19: eine Antwort-Huelle, damit der Stapel-Zweig nicht jede Header-Zeile wiederholt. */
function jsonAntwort(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/* Aufschlaege fuer zwischengespeicherte Prompt-Token (Anthropic-Standard):
   Schreiben 1,25x Eingabepreis, Lesen 0,10x. ANNAHME laut Anbieter-Preisliste - sie geht
   NICHT in die Buchung ein, sondern nur in eine zweite, ausgewiesene Schaetzung.
   Gebucht wird weiter konservativ zum vollen Eingabepreis (lieber zu viel als zu wenig). */
const CACHE_WRITE_FAKTOR = 1.25;
const CACHE_READ_FAKTOR  = 0.10;

async function stapelLauf(sb: any, namen: string[], modell: string, quelle: string | null): Promise<Response> {
  const key = findeKey();
  if (!key) return jsonAntwort({ error: "Kein Anthropic-Key." }, 500);

  const { data: budRaw, error: budErr } = await sb.rpc("cb_riki_budget_check");
  if (budErr) return jsonAntwort({ error: "Budget-Pruefung fehlgeschlagen: " + budErr.message }, 500);
  const bud: any = Array.isArray(budRaw) ? budRaw[0] : budRaw;
  if (bud?.erlaubt !== true) {
    const verb = Number(bud?.verbraucht_usd ?? 0).toFixed(2);
    const lim = Number(bud?.limit_usd ?? 0).toFixed(2);
    return jsonAntwort({ budget_voll: true, budget: bud,
      error: `Monatslimit erreicht: ${verb} von ${lim} USD verbraucht.` });
  }

  const auftrag =
    "Stufe die folgenden Zutaten ein.\n" +
    "ABWEICHEND von der Formatangabe im Regelwerk antworte mit einem JSON-ARRAY - ein Objekt je Zutat, " +
    "in GENAU derselben Reihenfolge und Anzahl wie die Liste:\n" +
    "[{\"name\": string, \"stufe\": 1-10, \"begruendung\": string (HOECHSTENS 10 Woerter, " +
    "nur das Merkmal, das die Stufe traegt - keine Wiederholung des Namens, keine Einleitung), " +
    "\"regel_id\": string|null, \"kategorie\": string, " +
    "\"konfidenz\": \"hoch\"|\"mittel\"|\"niedrig\", \"kritisch\": true|false, " +
    "\"sprache\": \"de\"|\"andere\"}]\n" +
    "REGEL_ID: die Kennung in eckigen Klammern aus dem Abschnitt AKTIVE REGELTABELLE, die die " +
    "Stufe traegt (z. B. BR-STAFFEL-GEWUERZ-UNSPEZ). Passt keine Zeile, schreibe null. " +
    "Nicht raten - die Kennung muss woertlich in der Tabelle stehen.\n" +
    "KATEGORIE: GENAU EINE Bezeichnung aus dem Abschnitt KATEGORIEN am Ende des Regelwerks, " +
    "woertlich abgeschrieben. Passt keine, nimm \"Sonstiges\". Keine neue erfinden - der Stamm " +
    "nimmt nur bekannte Kategorien an.\n" +
    "FORM DER ANTWORT: NUR das nackte JSON-Array, in EINER Zeile, ohne Einrueckung, ohne " +
    "Zeilenumbrueche, ohne Code-Zaun (kein ```), ohne Vor- und Nachwort. Einrueckung und " +
    "Zeilenumbrueche kosten bei 60 Zutaten mehr als die Inhalte selbst.\n" +
    "SPRACHE: \"de\", wenn der Eintrag ein deutscher Zutatenname ist (auch mit Tippfehlern, " +
    "Fugen-s oder Bindestrichen). \"andere\" bei jedem fremdsprachigen Namen - auch wenn du " +
    "genau weisst, was gemeint ist: \"persil\" (franzoesisch fuer Petersilie), \"zout\", " +
    "\"citric acid\", \"epices\", \"suiker\" sind ALLE \"andere\". Ein Wort, das in beiden " +
    "Sprachen existiert und dasselbe meint (z. B. \"Aroma\"), ist \"de\". " +
    "Im Zweifel \"andere\" - ein faelschlich als fremd markierter Eintrag kostet nur eine " +
    "Rueckfrage, ein fremdsprachiger im deutschen Stamm bleibt dort stehen.\n" +
    "Jede Zutat wird EINZELN nach dem Regelwerk oben bewertet. Der Stapel ist nur eine " +
    "Uebertragungsform - die Zutaten stehen in KEINEM Zusammenhang und duerfen sich nicht " +
    "gegenseitig beeinflussen.\n\n" +
    namen.map((n, i) => `${i + 1}. ${n}`).join("\n");

  const rw = await regelHolen(sb);
  if (!rw.ok) return jsonAntwort({ error: "Regelwerk fehlt - es wurde NICHTS eingestuft.", detail: rw.fehler }, 503);

  const ai = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modell,
      max_tokens: Math.min(8000, 400 + namen.length * 130),
      system: [{ type: "text", text: rw.text, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: auftrag }] }),
  });
  const j: any = await ai.json();
  const usg: any = j?.usage ?? {};
  const roh = usg.input_tokens ?? 0;
  const cw = usg.cache_creation_input_tokens ?? 0;
  const cr = usg.cache_read_input_tokens ?? 0;
  const outTok = usg.output_tokens ?? 0;
  const preis = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];
  const inTok = roh + cw + cr;
  const kostenGebucht = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;
  const kostenEcht = ((roh + cw * CACHE_WRITE_FAKTOR + cr * CACHE_READ_FAKTOR) / 1e6) * preis.in
                   + (outTok / 1e6) * preis.out;

  if (!ai.ok) {
    await sb.rpc("cb_riki_buchen", { p_modus: "zutat-stapel", p_modell: modell, p_in: 0, p_out: 0,
      p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
    return jsonAntwort({ error: "Riki-Fehler", detail: j }, 502);
  }

  const txt = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  let arr: any = null;
  try { const m = txt.match(/\[[\s\S]*\]/); arr = JSON.parse(m ? m[0] : txt); } catch { arr = null; }
  if (!Array.isArray(arr)) {
    await sb.rpc("cb_riki_buchen", { p_modus: "zutat-stapel", p_modell: modell, p_in: inTok, p_out: outTok,
      p_kosten: Number(kostenGebucht.toFixed(6)), p_produkt_id: null, p_erfolg: false, p_fehler: "kein Array" });
    /* v33: der Anfang half bei der Fehlersuche nicht - abgeschnitten wird am ENDE.
       Deshalb beides, und die Verbrauchszahlen dazu: nur an outTok gegen max_tokens
       sieht man, ob die Antwort abgeschnitten wurde oder das Modell Unsinn schrieb. */
    return jsonAntwort({ error: "Riki lieferte kein Array.",
      roh_anfang: txt.slice(0, 400), roh_ende: txt.slice(-400), roh_zeichen: txt.length,
      verbrauch: { ausgabe: outTok, max_tokens: Math.min(8000, 400 + namen.length * 130) } }, 502);
  }

  await sb.rpc("cb_riki_buchen", { p_modus: "zutat-stapel", p_modell: modell, p_in: inTok, p_out: outTok,
    p_kosten: Number(kostenGebucht.toFixed(6)), p_produkt_id: null, p_erfolg: true, p_fehler: null });

  /* Zuordnung ueber die POSITION, nicht ueber den zurueckgegebenen Namen: ein Modell
     schreibt Namen gern um. Weicht die Anzahl ab, wird NICHT geraten - der Aufrufer
     bekommt die Abweichung gemeldet. */
  const ergebnisse: any[] = [];
  for (let i = 0; i < namen.length; i++) {
    const e = arr[i];
    if (!e || typeof e.stufe !== "number") { ergebnisse.push({ name: namen[i], fehler: "keine Stufe im Stapel" }); continue; }
    const stufe = Math.max(1, Math.min(10, Math.round(e.stufe)));
    const { data: verif } = await sb.rpc("cb_zutat_verifizieren", {
      p_name: namen[i], p_stufe: stufe,
      p_extern: { urteil: "kein_signal", text: "Externer Wächter (OFF) vorerst deaktiviert." },
      p_log: true, p_quelle: quelleErlaubt(quelle) ?? "riki" });
    ergebnisse.push({ name: namen[i], stufe, begruendung: e.begruendung ?? null,
      regel_id: (typeof e.regel_id === "string" && e.regel_id.trim()) ? e.regel_id.trim() : null,
      kategorie: (typeof e.kategorie === "string" && e.kategorie.trim()) ? e.kategorie.trim() : null,
      konfidenz: e.konfidenz ?? null, kritisch: e.kritisch === true,
      sprache: (e.sprache === "de" || e.sprache === "andere") ? e.sprache : null,
      verifikation: verif });
  }

  return jsonAntwort({
    modell, anzahl_angefragt: namen.length, anzahl_geliefert: arr.length,
    ergebnisse,
    verbrauch: { eingabe_roh: roh, cache_geschrieben: cw, cache_gelesen: cr, ausgabe: outTok,
      kosten_gebucht_usd: Number(kostenGebucht.toFixed(6)),
      kosten_geschaetzt_usd: Number(kostenEcht.toFixed(6)),
      je_zutat_gebucht_usd: Number((kostenGebucht / Math.max(namen.length, 1)).toFixed(6)) },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization") ?? "";
  /* v36 (12.09.2026): SYSTEMAUFRUF BEKOMMT EINEN EIGENEN CLIENT.
     GEMESSEN: mit v35 kam der Takt durch die Anmeldepruefung, scheiterte aber an
     der naechsten Zeile - "Budget-Pruefung fehlgeschlagen: Expected 3 parts in
     JWT; got 1". Der Service-Schluessel ist kein JWT; wird er als Authorization
     durchgereicht, kann der Client keine einzige RPC mehr rufen.
     Beim Systemaufruf wird der Client deshalb direkt mit dem Service-Schluessel
     gebaut und der Kopf NICHT weitergereicht. Fuer Menschen bleibt alles wie
     bisher: ihr Token geht durch, ihre Rechte gelten. */
  const _authRoh = authHeader.replace(/^Bearer\s+/i, "").trim();
  const _system = _authRoh.length > 0 && _authRoh === (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "\u0000");
  const sb = _system
    ? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    : createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

  try {
    /* v35 (12.09.2026): SYSTEMAUFRUF ZUGELASSEN.
       GEMESSEN: der neue Stapel-Takt (cb_zutat_stapel_takt) ruft ueber
       cb_edge_rufen mit dem Service-Schluessel - dort gibt es keinen angemeldeten
       Menschen, und die Antwort war "Bitte anmelden.". Damit konnte der Takt gar
       nicht laufen.
       Die Pruefung bleibt fuer alle anderen unveraendert: ohne Anmeldung kein
       Zugriff. Erlaubt ist zusaetzlich nur der Aufruf, der den Service-Schluessel
       dieses Projekts traegt - den hat nur die Datenbank selbst. */
    if (!_system) {
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) return new Response(JSON.stringify({ error: "Bitte anmelden." }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    let body: any = {}; try { body = await req.json(); } catch {}
    const name: string = String(body.name ?? "").trim();
    /* v19: Stapel-Weg. Wird "namen" mitgeschickt, laeuft der Einzel-Weg gar nicht erst an. */
    const namen: string[] = Array.isArray(body.namen)
      ? body.namen.map((x: unknown) => String(x ?? "").trim()).filter((s: string) => s.length > 0).slice(0, 60)
      : [];
    if (namen.length) {
      return await stapelLauf(sb, namen, body.modell ?? "claude-sonnet-4-6", body.quelle ?? null);
    }

    if (!name) return new Response(JSON.stringify({ error: "name fehlt" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });

    let stufe: number | null = (typeof body.stufe === "number" && isFinite(body.stufe)) ? body.stufe : null;
    let begruendung: string | null = body.begruendung ?? null;
    let konfidenz: string | null = body.konfidenz ?? null;
    let kritisch: boolean | null = (typeof body.kritisch === "boolean") ? body.kritisch : null;
    let riki_kosten = 0;

    // Modell wie bei den anderen Riki-Funktionen aus dem body ueberschreibbar.
    // Standard Sonnet: Haiku war beim Einstufen zu grob (hielt sich nicht an die Staffel).
    const modell: string = body.modell ?? "claude-sonnet-4-6";

    if (stufe === null) {
      // BUDGET-RIEGEL (v17) - vor jedem Aufruf, der Geld kostet.
      const { data: budRaw, error: budErr } = await sb.rpc("cb_riki_budget_check");
      if (budErr) {
        return new Response(JSON.stringify({ error: "Budget-Pruefung fehlgeschlagen: " + budErr.message }),
          { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const bud: any = Array.isArray(budRaw) ? budRaw[0] : budRaw;
      if (bud?.erlaubt !== true) {
        const verb = Number(bud?.verbraucht_usd ?? 0).toFixed(2);
        const lim = Number(bud?.limit_usd ?? 0).toFixed(2);
        return new Response(JSON.stringify({
          budget_voll: true,
          error: `Monatslimit erreicht: ${verb} von ${lim} USD verbraucht. Riki bewertet erst wieder, wenn das Limit angehoben wird oder der Monat wechselt.`,
          budget: bud,
        }), { headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const key = findeKey();
      if (!key) return new Response(JSON.stringify({ error: "Kein Anthropic-Key." }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
      const rwE = await regelHolen(sb);
      if (!rwE.ok) return new Response(JSON.stringify({ error: "Regelwerk fehlt - es wurde NICHTS eingestuft.", detail: rwE.fehler }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
      const ai = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: modell, max_tokens: 300,
          system: [{ type: "text", text: rwE.text, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: `Zutat: ${name}` }] }),
      });
      const j = await ai.json();
      if (!ai.ok) {
        await sb.rpc("cb_riki_buchen", { p_modus: "zutat", p_modell: modell, p_in: 0, p_out: 0,
          p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: JSON.stringify(j).slice(0, 400) });
        return new Response(JSON.stringify({ error: "Riki-Fehler", detail: j }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      const txt = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      let vr: any = null; try { const m = txt.match(/\{[\s\S]*\}/); vr = JSON.parse(m ? m[0] : txt); } catch {}
      if (!vr || typeof vr.stufe !== "number") {
        await sb.rpc("cb_riki_buchen", { p_modus: "zutat", p_modell: modell, p_in: 0, p_out: 0,
          p_kosten: 0, p_produkt_id: null, p_erfolg: false, p_fehler: "keine Stufe" });
        return new Response(JSON.stringify({ error: "Riki lieferte keine Stufe.", roh: txt }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      stufe = Math.max(1, Math.min(10, Math.round(vr.stufe)));
      begruendung = vr.begruendung ?? null; konfidenz = vr.konfidenz ?? null;
      kritisch = (vr.kritisch === true);
      const usg: any = j.usage ?? {};
      const inTok = (usg.input_tokens ?? 0) + (usg.cache_creation_input_tokens ?? 0) + (usg.cache_read_input_tokens ?? 0);
      const outTok = usg.output_tokens ?? 0;
      const preis = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];
      riki_kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;
      await sb.rpc("cb_riki_buchen", { p_modus: "zutat", p_modell: modell, p_in: inTok, p_out: outTok,
        p_kosten: Number(riki_kosten.toFixed(6)), p_produkt_id: null, p_erfolg: true, p_fehler: null });
    }

    // W-Ref (OFF) vertagt -> enthaelt sich.
    const ref = { urteil: "kein_signal", text: "Externer Wächter (OFF) vorerst deaktiviert." };

    const { data: verif, error: vErr } = await sb.rpc("cb_zutat_verifizieren", {
      p_name: name, p_stufe: stufe, p_extern: ref,
      p_log: true, p_quelle: quelleErlaubt(body.quelle) ?? (body.stufe != null ? "etikett" : "riki") });
    if (vErr) return new Response(JSON.stringify({ error: "Verifikation fehlgeschlagen: " + vErr.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({
      name, stufe, begruendung, konfidenz, kritisch, modell,
      riki_kosten_usd: Number(riki_kosten.toFixed(6)),
      verifikation: verif,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
