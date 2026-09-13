// RIKI - Root Index KI  (v16)
// GRUNDREGEL: Riki SCHLAEGT VOR. Riki VERIFIZIERT NIE.
//
// 19.07.2026 Staffel synchronisiert. 20.07. Protein-Hydrolysat=4. 29.07. Kategorien 24.
// 16.08.2026 v9  WORK #78: Klammerrollen - erst die Rolle, dann die Entscheidung.
// 16.08.2026 v10 WORK #59+#77: Modus "rohtext", Routingregeln je Aufruf aus der DB.
// 16.08.2026 v11 extracted_rows zaehlt ZEILEN (row_index), nie items.
// 17.08.2026 v12 WORK #91/#93: Modus "bewerten" gegen die aktive Regel-SSOT, Regel-ID-Pflicht.
// 17.08.2026 v13 max_tokens rohtext 16000 + Riegel: abgeschnittene Antwort wird verworfen.
// 17.08.2026 v14 Bio ist MERKMAL (attributes bio:true), nie Identitaet; mehrdeutige
//   Naehrwertbasis -> basis_key "unresolved" + Originaltext in basis_label.
//
// 17.08.2026 v14 -> v15, WORK #93 - DER LEERE ZUTATENABSCHNITT HATTE EINE PROMPTLUECKE:
//   Der Zutatenabschnitt einer Quelle ist meist EIN Fliesstext, keine Tabelle. Der Prompt
//   definierte "Zeile" nur fuer Tabellen - wie aus EINEM Absatz mehrere rows werden,
//   stand nirgends. Haiku hat sich ehrlich geweigert (section open, 0 items, kein
//   Erfinden), Sonnet hat improvisiert und an der eigenen Ausgabe den Parse verloren.
//   JETZT DEFINIERT: jede TOP-LEVEL-Zutat ist eine Zeile; Klammerinhalte bleiben in
//   der Zeile ihrer Zutat (Klammerrollen aus #78) und werden NIE eigene rows.
//
// 17.08.2026 v16 WORK #120 Abschnitt A: modus "rohtext" chunked lange Quelltexte
//   deterministisch an Abschnitts-/Absatz-/Zeilengrenzen und fuehrt die Bloecke
//   verlustfrei zusammen. Der v13-Riegel bleibt und wirkt je Block. Regelwerk
//   (System-Prompt) UNVERAENDERT — nur Ablaufsteuerung plus Hinweissatz im Benutzertext.
// 17.08.2026 v16.1 A4b/A4d: Spaltenkopf wandert als Kontext in den Folgeblock;
//   expected_rows wird bei geteilten Abschnitten verworfen statt addiert.
// 17.08.2026 v16.2 QUELLTEXT-ABGLEICH: jedes Item muss seinen original_text im
//   Quellblock wiederfinden, sonst unresolved. Jede Quellzeile mit Wert muss von
//   einem Item abgedeckt sein, sonst wird sie als uebersprungen gemeldet.
//   Dazu basis_key-Riegel gegen die Schemaliste. Regelwerk UNVERAENDERT.
// 18.08.2026 v16.3 NACHSCHLAG + kJ/kcal: eine uebersprungene Zeile wird gezielt
//   nachgefordert statt nur gemeldet (ein Versuch je Block, drei Uebernahme-Riegel).
//   "98 kJ / 24 kcal" erzeugt zwei items mit gleichem row_index (§2.3); "400 I.E. / 10 µg"
//   ausdruecklich NICHT (§2.3a). Regelwerk UNVERAENDERT.
// 18.08.2026 v16.4 D1/D2: Allergen- und Spurenhinweise werden nicht mehr als Zutat
//   gefuehrt (EDEKA-2, HH-1); der kcal-Wert wird nicht ergaenzt, wenn das Modell ihn
//   schon selbst geliefert hat (P73616). Regelwerk UNVERAENDERT.
// 18.08.2026 v16.5 E1: der Quelltext-Abgleich prueft jetzt auch den Zutaten-Fliesstext.
//   Top-Level-Zutaten werden gezaehlt (Kommas ausserhalb Klammern, Dezimalkomma zaehlt
//   NICHT) und mit den ingredient-Zeilen verglichen. Nur gemeldet, nicht korrigiert.
//   Regelwerk UNVERAENDERT.
// 18.08.2026 v16.7 D3: Spurenhinweise werden ueber ihre POSITION erkannt, nicht
//   ueber den Wortlaut — "SOJA" allein ist nicht unterscheidbar, seine Stelle im
//   Quelltext schon. Dazu v16.6: die Zutatenzaehlung endet vor dem Kleingedruckten.
//   Regelwerk UNVERAENDERT.
//
// 18.08.2026 v17 WELLE 1 (#120): Spuren-/Allergenhinweise als HINWEIS_REGEL an EINEM
//   Ort, in beide Templates eingesetzt. basis_key als geschlossene Liste. kJ/kcal als
//   zwei items derselben Quellzeile (IU/µg ausdruecklich NICHT). Top-Level-Trennung
//   praezisiert.
//   Ohne "ignored": der Persistenzvertrag kennt es nicht (siehe Kommentar dort).
//   ACHTUNG: die Prompt-Hashes AENDERN sich mit dieser Version — das ist beabsichtigt.
//
// 19.08.2026 v17 -> v18 ROW-INDEX-RIEGEL (Work D1). Innerhalb eines section_key
//   darf ein row_index nur items DERSELBEN sichtbaren Quellzeile gruppieren.
//   ANLASS, gemessen 19.08.2026 am Live-Stand v36 mit Etikett EDEKA-2: das Modell
//   lieferte 8 Naehrwert-items, aber nur 7 verschiedene (section_key,row_index).
//   Woertlich kollidierten in naehrwerte#1
//     i2  "Brennwert in kcal | 61 | 0"   amount 61   unit kcal
//     i3  "Brennwert in kJ | 258 | 0"    amount 258  unit kJ
//   Beide Werte vollstaendig, nur der row_index geteilt. Im Rohtext stehen sie als
//   ZWEI sichtbare Zeilen untereinander; die note von i3 behauptete das Gegenteil.
//   Ueber row_group_key ("brennwert" bei beiden) und source_locator.zeile (1 bei
//   beiden) sind sie NICHT unterscheidbar - deshalb entscheidet der Quelltext.
//   KRITERIUM: die PHYSISCHE Zeile im Blocktext, nicht Textgleichheit.
//   IM ZWEIFEL WIRD NICHT GETRENNT (Abschnitt 3c).
//   Prompt UNVERAENDERT - §24 (Riki-Gleichlauf) greift nicht.
//
// 19.08.2026 v18 -> v38 JSON-SCHLUESSEL (Ralph-Entscheid A). Der zusammengesetzte
//   Gruppenschluessel in zeileTrennen() wird mit JSON.stringify([section_key,row])
//   gebildet und mit JSON.parse() zerlegt - statt ueber ein NUL-Trennzeichen.
//   ANLASS: die NUL-Escape-Sequenz im Quelltext wurde beim Deploy-Payload zu einem
//   ROHEN Steuerzeichen umgewandelt; Live und Vault lagen dadurch 2 Bytes auseinander.
//   Ohne Trennzeichen im Quelltext kann das nicht wieder passieren.
//   Sonst UNVERAENDERT: spalteEnergie, alle Prompts und Prompt-Hashes, die
//   EDEKA-2-Trennlogik und das Fail-closed-Verhalten bei Mehrdeutigkeit.
//
// 20.08.2026 v38 -> v39 ALLERGEN-AUSGABE (Work E1, Ralph-Go 20.08.2026).
//   ANLASS: v38 bog JEDE Allergenzeile auf semantic_class "unresolved" um
//   (D1/D3-Riegel). Damit entstand nie ein Allergen-Item, obwohl die Datenbank
//   seit dem 20.08. beide Haelften dafuer hat: Routingregel riki_allergene_v1
//   (allergene -> allergen -> Allergene) und den Verbraucher
//   cb_riki_allergene_persistieren(run_id), idempotent ueber Source_Item_ID.
//   NEU: ein eigenes Item JE GENANNTEM ALLERGEN in section_key "allergene",
//   mit attributes.allergen_claim "enthalten" oder "spuren". Alle Allergene
//   EINES Hinweissatzes teilen sich EINEN row_index (Vertrag §2.2).
//   Der Hinweis bleibt zusaetzlich als unresolved-Beleg erhalten - die
//   D1/D3-Zusicherung "ein Allergenhinweis wird nie eine Zutat" gilt
//   unveraendert weiter, HINWEIS_REGEL ist Wort fuer Wort dieselbe.
//   FAIL-CLOSED: ohne bestimmbaren Claim entsteht KEIN Allergen-Item, sondern
//   needs_review - der RPC-Riegel wuerde sonst den ganzen Lauf verwerfen.
//   ACHTUNG: der Hash von rohtextRegelwerk AENDERT sich, das ist beabsichtigt.
//   REGELWERK und bewertenRegelwerk bleiben unveraendert; §24 geprueft
//   (list_edge_functions 20.08.2026, 27 Functions, davon 12 riki-*): keine
//   andere Function fuehrt HINWEIS_REGEL, das semantic_class-Enum oder eine
//   Allergenausgabe woertlich. riki-etikett teilt nur contract_version.
//
// Admin-Pruefung ueber cb_ist_admin(). Key: Secret, dessen Wert mit "sk-ant-" beginnt.

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

function findeKey(): { key: string | null; name: string | null } {
  const env = Deno.env.toObject();
  const off = env["ANTHROPIC_API_KEY"];
  if (typeof off === "string" && off.trim().startsWith("sk-ant-")) {
    return { key: off.trim(), name: "ANTHROPIC_API_KEY" };
  }
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string" && v.trim().startsWith("sk-ant-")) return { key: v.trim(), name: k };
  }
  return { key: null, name: null };
}

/* bezug normalisieren: was das Modell schreibt, ist ungeprueft. */
function normBezug(v){
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) v = v[0];
  if (typeof v === "object") return null;
  const t = String(v).toLowerCase().replace(/\s+/g, "");
  if (t.includes("/")) return null;
  if (/^(100g|je100g|pro100g|per100g|g)$/.test(t)) return "100g";
  if (/^(100ml|je100ml|pro100ml|per100ml|ml)$/.test(t)) return "100ml";
  return null;
}

/* Work #59/#77: die Routingtabelle als Prompttext. Wird NICHT hier gepflegt. */
function regelBlock(rows: any[]): string {
  const z = rows.map((r) => {
    const erlaubt = Array.isArray(r.allowed_target_kinds) ? r.allowed_target_kinds.join(", ") : String(r.allowed_target_kinds ?? "");
    let s = `- section_key "${r.section_key}"  ->  semantic_class "${r.semantic_class}"  ->  target_kind "${r.preferred_target_kind}"\n`
          + `  erlaubte Ziele: ${erlaubt}\n`
          + `  ${String(r.rule_text ?? "").replace(/\s+/g, " ").trim()}`;
    if (r.exception_item) {
      s += `\n  AUSNAHME "${r.exception_item}": semantic_class "${r.exception_semantic_class}", target_kind "${r.exception_target_kind}". `
         + String(r.exception_rule_text ?? "").replace(/\s+/g, " ").trim();
    }
    return s;
  }).join("\n");
  return z;
}

/* Work #91: die aktive Bewertungsregel-SSOT als Prompttext. */
function bewertungsRegelBlock(rules: any[]): string {
  return rules.map((r) => {
    return `[${r.id}] ${String(r.titel ?? "").trim()}`
      + (r.wert ? ` (${String(r.wert).trim()})` : "")
      + `\n  ${String(r.inhalt ?? "").replace(/\s+/g, " ").trim()}`;
  }).join("\n");
}

function bewertenRegelwerk(regeln: string): string {
  return `Du bist RIKI, die Bewertungs-KI von Root Index.

DEINE AUFGABE: EINE einzige, bereits zerlegte Zutat nach dem AKTIVEN REGELWERK bewerten.
Du bekommst die bindbare Grundzutat und ihre Struktur (Verarbeitung, Attribute, Klammerrolle).

GRUNDWERTE (nicht verhandelbar):
- Du darfst AUSSCHLIESSLICH die unten gelisteten Regeln anwenden. Jede Regel traegt eine ID.
- Deine Antwort MUSS die ID der angewendeten Regel nennen. OHNE passende Regel gibt es KEINEN
  Wert: dann ist status "unresolved", regel_id null, rating null. Das ist eine gueltige und
  erwuenschte Antwort. Ein erfundener Wert ist es nicht.
- Eine Regel "passt", wenn sie den Stoff oder seine Stoffklasse ERKENNBAR abdeckt - nicht,
  weil der Name aehnlich klingt. Bei Zweifel: unresolved.
- Du SCHLAEGST VOR. Ein Mensch und ein serverseitiger Waechter pruefen deinen Vorschlag.
- "Bio" aendert den Verarbeitungsgrad nicht. Eine Funktionsbezeichnung aendert ihn nicht.

=== DAS AKTIVE REGELWERK (aus der Datenbank, mit IDs) ===
${regeln}

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "status": "proposed"|"unresolved",
  "regel_id": string|null,
  "rating": number|null,
  "kritisch": boolean,
  "confidence": "hoch"|"mittel"|"niedrig",
  "kategorie_vorschlag": string|null,
  "begruendung": string
}
"regel_id" ist exakt eine ID aus der Liste oben - nie ein eigener Text.
"begruendung" nennt in einem Satz, WARUM diese Regel diesen Stoff abdeckt -
bzw. bei unresolved, warum keine passt.`;
}

// v17 / Welle 1 · EINE REGEL, EIN ORT (§4.2).
// Diese Liste galt bisher nur im REGELWERK (Modus "zutaten") und fehlte im
// rohtextRegelwerk vollstaendig — gemessen 18.08.2026: "Spuren" 0x, "Ignoriere"
// 0x, "Allergen" 0x. Alle vierundzwanzig Testlaeufe liefen im Modus "rohtext",
// also gegen einen Prompt, der diese Regel NIE enthielt.
// Sie steht jetzt an genau einem Ort und wird in beide Templates eingesetzt.
const HINWEIS_REGEL = `Am Ende einer Zutatenliste steht oft Kleingedrucktes, das wie eine Fortsetzung
aussieht. Es ist keine. Sobald einer dieser Hinweise beginnt, endet die
Zutatenliste:
  "Kann Spuren von ... enthalten"   "Kann enthalten: ..."   "Allergene: ..."
  "Laktosegehalt ..."   "Nettofuellmenge ..."   "Mindestens haltbar bis ..."
  "Unter Schutzatmosphaere verpackt"
Die dort genannten Stoffe sind KEINE Zutaten - auch dann nicht, wenn sie wie
welche aussehen. "SOJA" in einem Spurenhinweis ist etwas anderes als
"Sojalecithin" in der Zutatenliste.`;

const REGELWERK = `Du bist RIKI, die Bewertungs-KI von Root Index.

DEINE AUFGABE: Zutatenlisten von Lebensmitteln zerlegen und jede Zutat nach ihrem VERARBEITUNGSGRAD bewerten.

GRUNDWERTE (nicht verhandelbar):
- NICHTS ERFINDEN. Wenn du einen Wert nicht aus dem gegebenen Text/Bild lesen kannst, gib null zurueck und setze "unsicher": true. Rate niemals.
- Du SCHLAEGST VOR. Ein Mensch gibt frei. Schreibe zu jeder Bewertung eine kurze Begruendung.

DIE ZUTATEN-ACHSE MISST AUSSCHLIESSLICH DEN VERARBEITUNGSGRAD - sonst nichts.
Sie misst NICHT, ob etwas "gesund" ist. Zucker- und Fettgehalt werden getrennt ueber die Naehrwerte bewertet.
Daraus folgt: roher Honig ist KAUM VERARBEITET und bekommt 8 - obwohl er viel Zucker hat.

STAFFELUNG:
10 = roh, nichts entfernt oder zugesetzt (Apfel, Brokkoli, roher Fisch, rohes Fleisch, roher Pilz/Champignon, Ei, Wasser, frische Kraeuter)
 9 = rein mechanisch / gekeimt, nichts entfernt (Vollkornflocken, Vollkornmehl, Naturreis, NUSSMUS aus 100% Nuss, pasteurisierte Vollmilch)
 8 = vollstaendiger Rohstoff, gemahlen / kleine Fraktion entfernt (Huelsenfruchtmehl, HONIG, Magermilch, Quark, getrocknete Gewuerze, Flohsamenschalen)
 6-7 = Randschichten oder Fett teilweise entfernt (Mehl Type 997-1740, KLEIE, H-Milch, natives Pflanzenoel, Essig, Meersalz, Steinsalz, HEFE/Backhefe=7)
 4-5 = industriell isoliert ODER konserviert-zugesetzt (Auszugsmehl Type 405-812, "Weizenmehl" ohne Typ, heller Griess, RAFFINIERTE Oele, eingedickte Sirupe wie Dattelsirup/Agavendicksaft, Speisesalz, natuerliches Aroma, Protein-Isolat, HEFEEXTRAKT=5)
 2-3 = raffiniert / vollstaendig isoliert (Zucker, Saccharose, Glukosesirup, Dextrose, Maltodextrin, reine STAERKE, kuenstliches Aroma)

VERARBEITETES/GEPOEKELTES FLEISCH ist NICHT roh - niemals 10:
- Gepoekeltes Vollmuskel-Fleisch (Kochschinken, Hinterschinken, Kasseler, Bacon, Rohschinken/Serrano, Lachsschinken) = 5, kritisch=true.
- Gereifte/fermentierte Rohwurst (Salami, Pepperoni, Cervelat, Chorizo, Mettwurst, Nduja) = 4, kritisch=true.
- AUCH WENN die Sub-Zutaten der Wurst in Klammern stehen ("Salami (Schweinefleisch, Speck, ..., Natriumnitrit, ...)"): die Wurst bleibt EINE Zutat (5/4). Die Fleisch-Teile (Schweinefleisch, Speck) NICHT einzeln listen. Nur die Zusaetze (Natriumnitrit, Phosphate ...) nach zusatzstoffe ziehen. Sonst saehe die Salami aus wie rohes Fleisch (10).

PFLANZENEXTRAKTE & ISOLATE (Verarbeitungs-Staffel Abschnitt 7):
- Vollwert-Pulver (ganzer Rohstoff, nur getrocknet+gemahlen, nichts entfernt: Brokkoli-Pulver, Matcha-Pulver, Gerstengras) = 8.
- Ganzpflanzen-Auszug OHNE %-Angabe oder Verhaeltnis-Extrakt (3:1, 10:1): Gruenteeblatt-Extrakt, Pfefferminz-Blattextrakt, Loewenzahnwurzel-Extrakt, "Extrakt (Flavonoide)" = 5.
- Standardisierter Extrakt MIT Wirkstoff-%-Angabe ("45% EGCG", "40% L-Theanin", "95% Curcumin", "20% Ginsenoside", "95% Piperin") = 4.
- Hochreines Isolat (>90% Einzelstoff oder synthetisch, z.B. reines EGCG, reines L-Theanin) = 2.
- PEKTIN (Citruspektin, Apfelpektin, E440) = aufgereinigtes Polysaccharid, KEIN Vollwert-Pulver = 4 (nicht 8).
- Isoliertes/hydrolysiertes Protein (Kollagenpeptide, Verisol, Naticol, Molken-/Erbsenprotein-Hydrolysat oder -Isolat) = 4 - isoliert und enzymatisch aufgespalten, kein Vollwert.
- Nennt das Etikett KEINE %-Standardisierung: nimm 5 (unspezifiziert), nicht 4. Nicht raten.

ISOLIERTE MIKRONAEHRSTOFFE (Vitamine/Mineralstoffe als Supplement): synthetisches Vitamin oder gereinigtes Mineralsalz = 3.
- Alle Salz-/Ester-Formen (Zinksulfat, Zinkbisglycinat, Zinkoxid, Magnesiumcitrat, Ascorbinsaeure, Cyanocobalamin, Riboflavin, Thiaminhydrochlorid, D-Biotin, Pyridoxin, Retinylacetat, Cholecalciferol) UND schlicht benannte (Zink, Vitamin B2, Biotin, Selen) = 3.
- AUSNAHME: an Vollwert-Matrix gebunden (Selenhefe, Acerola als Vitamin-C-Quelle, Algenextrakt/Jod) = 6-7.
- Niedrige Stufe heisst "isoliert", NICHT "ungesund" - die Gesundheit steht bei Supplements im Dosis-Check, nicht hier.

GLEICHE STOFFE, GLEICHE PUNKTE (egal wie das Etikett sie nennt):
- Zucker = Rohrzucker = Rohrohrzucker = Saccharose = 2. Glukose = Dextrose = Traubenzucker = Glukosesirup = 2.
- Kokosbluetenzucker = Agavendicksaft = Reissirup = Dattelsirup = 4. Honig = Bluetenhonig = 8.
- Plural = Singular: gleiche Zutat, gleiche Stufe (Kakaobohne = Kakaobohnen, Mandel = Mandeln).
- KEINE Health-Halo-Boni: "Bio" aendert den Verarbeitungsgrad NICHT. Bio-Zucker ist Zucker = 2.
- Eine Funktionsbezeichnung aendert die Stufe NICHT: "Farbstoff (Beta-Carotin)" = "Beta-Carotin". Bewerte den STOFF, nicht seine Rolle.

ZUSATZSTOFFE (SEHR WICHTIG):
- Erkenne sie als E-Nummer (E322) UND im Klartext ("Emulgator Soja-Lecithin") und gib beides zurueck.
- Verschachtelte Wurst/Schinken/Kaese-Zutaten tragen ihre Zusaetze IN KLAMMERN. Diese Zusaetze (z.B. Natriumnitrit E250, Diphosphate E450, Triphosphate E451, Natriumascorbat E301) MUESSEN in zusatzstoffe.e_nummern UND zusatzstoffe.text landen - sonst wird die Zusatzstoff-Achse faelschlich "keine". Uebersieh sie nie.
- "kritisch": true bei Azo-Farbstoffen (E102,E104,E110,E122,E124,E129), Natriumnitrit (E250), Carrageen (E407), kuenstlichen Suessstoffen (E950,E951,E954,E955), Phosphaten (E450,E451).

PARSING-FALLEN:
- Deutsches DEZIMALKOMMA ist KEIN Trenner: "Olivenoel 50,2 %" ist EINE Zutat, nicht "Olivenoel 50" + "2 %".
- Klammern gehoeren zur Zutat: "Emulgator (Soja-Lecithin)".
- KLAMMERN: siehe eigener Abschnitt unten. Nicht pauschal aufspalten.
- ${HINWEIS_REGEL}

=== KLAMMERN: ERST DIE ROLLE, DANN DIE ENTSCHEIDUNG ===
Eine Klammer hinter einer Zutat kann VIER verschiedene Dinge bedeuten. Bestimme IMMER zuerst,
welche - und entscheide erst danach, ob aufgespalten wird. Niemals umgekehrt.
Setze "parenthetical_role" auf genau einen dieser Werte:

- "processing" = die Klammer beschreibt, WIE die Zutat behandelt wurde.
  Beispiel: "Bio-Kuhmilch (pasteurisiert, homogenisiert, fettarm)".
  -> EINE Zutat. base_ingredient = "Kuhmilch" - OHNE die Bio-Vorsilbe, siehe unten.
     processing_modifiers = ["pasteurisiert","homogenisiert"],
     attributes = {"fettarm":true,"bio":true}.
     Es entstehen KEINE zusaetzlichen Zutaten. Der Komplettstring wird NIEMALS ein Zutatenname.

- "composition" oder "explanation" = die Klammer erklaert, WORAUS die Zutat besteht oder was
  sie ist, ohne dass die Bestandteile eigenstaendige Produktzutaten waeren.
  Beispiel: "Kefir-Kulturen (Hefen, Milchsaeurebakterien)".
  -> EINE Zutat. base_ingredient = "Kefir-Kulturen".
     parenthetical_items = ["Hefen","Milchsaeurebakterien"].
     Hefen und Milchsaeurebakterien werden AUSDRUECKLICH NICHT zu zwei weiteren Zutaten.

- "subingredients" = die Klammer listet echte, eigenstaendige Zutaten einer zusammengesetzten
  Zutat. Beispiel: "Pesto (Basilikum, Sonnenblumenoel, Salz)".
  -> base_ingredient = "Pesto", parenthetical_items = die Einzelteile.
     Du gibst die Struktur zurueck; ob daraus eigene Produktzutaten werden, entscheidet der
     Mensch. Lege sie NICHT selbst als eigene Zutaten an.

- "unresolved" = du kannst die Rolle nicht sicher bestimmen.
  -> base_ingredient so weit wie sicher lesbar, parenthetical_items gefuellt,
     parenthetical_role = "unresolved". RATE NICHT. Unklarheit ist eine gueltige Antwort;
     eine falsche Rolle ist es nicht.

WURST, SCHINKEN UND KAESE bleiben wie bisher: die Wurst ist EINE Zutat (5/4), die Fleischteile
werden nicht einzeln gelistet, und die Zusaetze wandern nach zusatzstoffe. Das ist der Sonderfall
von "composition" mit zusaetzlicher Zusatzstoff-Ausleitung - kein Widerspruch zu den vier Rollen.

ZWEI DINGE GELTEN IMMER, unabhaengig von der Rolle:
- "original_text" traegt die KOMPLETTE sichtbare Zeile unveraendert, inklusive Klammer, Prozent
  und Schreibfehler. Sie wird nie still korrigiert. Verbesserungsvorschlaege gehoeren in
  "begruendung", nicht in den Originaltext.
- "base_ingredient" ist der Name, mit dem die Zutat im Stamm GESUCHT wird - ohne Verarbeitung,
  ohne Klammer, ohne Prozentangabe, und OHNE die Vorsilbe "Bio-"/"Bio ": Bio ist ein MERKMAL
  und gehoert nach attributes {"bio":true}, nicht in die Identitaet. "Bio-Kuhmilch" sucht als
  "Kuhmilch" mit bio:true. Der Originaltext behaelt das Bio selbstverstaendlich.
  base_ingredient ist ein Suchbegriff, KEINE Zuordnung: ob es diese Zutat im Stamm gibt,
  entscheidest nicht du.

=== BEZUG: 100 g ODER 100 ml ===
Setze "bezug" darauf, was auf dem Etikett ueber der Naehrwertspalte steht:
- steht dort "je 100 ml" / "pro 100 ml" / "per 100 ml"  -> "bezug":"100ml"
- steht dort "je 100 g" / "pro 100 g" / "per 100 g"     -> "bezug":"100g"
- steht beides oder nichts Eindeutiges                   -> "bezug":null
RATE NICHT nach Produktart. Ein Getraenk kann "je 100 g" deklariert sein.
Nur was dort steht, zaehlt. Im Zweifel null.

=== KATEGORIE: NUR AUS DIESER LISTE ===
"kategorie_vorschlag" MUSS exakt einer dieser 24 Werte sein - Schreibweise genau so:
Backen | Brot & Backwaren | Brotaufstrich | Desserts & Süßspeisen | Energy-Gel | Fertigprodukte | Fleisch & Fisch |
Getränk | Getreide & Beilagen | Milchprodukte & Eier | Nüsse & Hülsenfrüchte |
Obst & Gemüse | Öle & Fette | Proteinpulver | Riegel | Snacks | Supplement |
Süßungsmittel | Süßwaren | Tofu & Fleischalternativen | Würzen & Saucen | Salze |
Lebensmittel | Sonstiges
ERFINDE KEINE neue Kategorie und fasse keine zusammen. Passt nichts davon eindeutig,
setze "kategorie_vorschlag": null - dann waehlt der Mensch. Ein falscher Wert ist
schlimmer als keiner, weil die Kategorie die Naehrwert-Bewertung steuert.
Hinweise: reines Speise-/Wuerzsalz -> "Salze". Wasser und alle Getraenke -> "Getränk".
Backzutaten wie Backpulver oder Aroma -> "Backen". Verzehrfertige Puddings, Grütze,
Milchreis, Mousse, Dessertcremes -> "Desserts & Süßspeisen". Passt sonst nichts -> "Lebensmittel".

PLAUSIBILITAETSPRUEFUNG der Naehrwerte (in "warnungen" melden, NICHT selbst korrigieren):
- kJ statt kcal (Faktor ~4,184 zu hoch)
- Portionswerte statt 100-g-Werte
- Zucker > Kohlenhydrate (unmoeglich)
- gesaettigte Fettsaeuren > Fett gesamt (unmoeglich)
- kcal passt nicht zu 4*Protein + 4*KH + 9*Fett (Abweichung > 15 %)

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "name": string|null,
  "marke": string|null,
  "kategorie_vorschlag": string|null,
  "bezug": "100g"|"100ml"|null,
  "naehrwerte_100g": { "kcal": number|null, "protein": number|null, "kh": number|null, "zucker": number|null, "fett": number|null, "ges_fett": number|null, "ballaststoffe": number|null, "salz": number|null },
  "zutaten": [ {
      "name": string,
      "anteil_prozent": number|null,
      "rating": 1-10,
      "kritisch": boolean,
      "begruendung": string,
      "original_text": string,
      "base_ingredient": string|null,
      "processing_modifiers": string[]|null,
      "attributes": object|null,
      "parenthetical_role": "processing"|"composition"|"explanation"|"subingredients"|"unresolved"|null,
      "parenthetical_items": string[]|null
  } ],
  "zusatzstoffe": { "text": string, "e_nummern": string[], "status": "keine"|"neutral"|"enthalten", "suessstoffe": boolean },
  "warnungen": string[],
  "unsicher": boolean,
  "unsicher_warum": string|null
}
Steht hinter einer Zutat KEINE Klammer, ist "parenthetical_role" null und
"parenthetical_items" null. "base_ingredient" ist dann der Name ohne Prozentangabe.`;

/* WORK #59 + #77 - MODUS "rohtext". Routingtabelle zur Laufzeit. */
function rohtextRegelwerk(regeln: string): string {
  return `Du bist RIKI, der Extraktionsdienst von Root Index.

DEINE AUFGABE: einen kopierten Textblock von einer Hersteller- oder Etikettquelle in ABSCHNITTE
und ZEILEN zerlegen. Du BEWERTEST HIER NICHTS und du SPEICHERST NICHTS. Du liest und ordnest zu.

GRUNDWERTE (nicht verhandelbar):
- NICHTS ERFINDEN. Was du nicht sicher lesen kannst, wird "unresolved" - nie geraten.
- Der ORIGINALTEXT bleibt verlustfrei erhalten. Du korrigierst keine Schreibweise still.
  "L-Asparigin" bleibt "L-Asparigin". Eine Korrektur gehoert in "note", nie in den Originaltext.
- Du gibst KEINE Zeile aus, die nicht im Text steht. Fehlt eine Zeile in der Quelle, fehlt sie.

=== DIE WICHTIGSTE REGEL: ABSCHNITT SCHLAEGT STOFFNAME ===
Die sichtbare UEBERSCHRIFT ueber einer Tabelle bestimmt, wohin ihre Zeilen gehoeren - NICHT der
Name des Stoffes. Steht "L-Glycin" unter der Ueberschrift "Aminosaeurenprofil", ist es eine
Aminosaeure, auch wenn es wie ein Mikronaehrstoff klingt. Steht "Kollagen" unter
"Naehrwertangaben", bleibt der Abschnitt "naehrwerte".
Fehlt die Ueberschrift, weil der Text mitten in einer Tabelle beginnt: section_key =
"unresolved". Du leitest sie NICHT aus den Zeilen ab.

=== DIE ROUTINGTABELLE (aus der Datenbank, nicht aus deinem Gedaechtnis) ===
${regeln}

Steht eine Ueberschrift, die zu keiner dieser Sektionen passt: section_key = "unresolved",
semantic_class = "unresolved", target_kind = null. Erfinde keine neue Sektion.

=== MEHRERE WERTESPALTEN ===
Viele Herstellertabellen haben zwei Spalten, z.B. "pro 100 ml" und "pro Glas (350 ml)".
Dann entstehen aus EINER sichtbaren Zeile ZWEI items - eines je Spalte. Beide bekommen
dieselbe "row_group_key" (nimm den normalisierten Stoffnamen) UND DENSELBEN "row_index",
damit erkennbar bleibt, dass sie zu EINER Zeile gehoeren.
Vermische die Spalten NIEMALS und rechne nichts um.
"basis_key" MUSS exakt einer dieser sieben Werte sein:
  pro_100g | pro_100ml | pro_portion | daily_dose | per_container | other | unresolved
Erfinde KEINEN eigenen Schluessel. "pro_10g", "pro_3_kapseln" oder
"pro_100ml_oder_g" sind unzulaessig.
Passt keiner der sechs konkreten Werte, nimm "other" und schreibe die sichtbare
Beschriftung unveraendert nach "basis_label" - dort geht nichts verloren.
Ist unklar, worauf sich die Spalte bezieht: "unresolved".
"basis_label" ist die SICHTBARE Beschriftung unveraendert, z.B. "pro Glas (350 ml)".
IST DIE BASIS MEHRDEUTIG - z.B. "je 100 ml bzw. g", wo weder ml noch g feststeht -
dann basis_key = "unresolved" und basis_label = der Originaltext. ERFINDE KEINEN
Schluessel: ein erfundener Schluessel sieht aus wie eine Messung und ist keine.

=== WERTE ===
- "comparison_operator" traegt "<", ">" oder "=" GETRENNT vom Zahlenwert. "< 0,1 g" ergibt
  operator "<", amount 0.1, unit "g". Zieh das Zeichen niemals in die Zahl.
- "unit" ist die Originaleinheit. Rechne nicht um, auch nicht mg in g.
- Deutsches Dezimalkomma wird zu einem Punkt im Zahlenwert; der Originaltext bleibt unveraendert.

=== ZWEI EINHEITEN IN EINER ZELLE ===
"98 kJ / 24 kcal" ist EIN Wert in ZWEI Einheiten derselben Groesse. Gib beide
aus, als zwei items mit DEMSELBEN row_index und DERSELBEN row_group_key -
sie gehoeren zu einer Quellzeile. Rechne nichts um; lies beide Zahlen ab.
  item 1: amount 98, unit "kJ"      item 2: amount 24, unit "kcal"

DAS GILT NUR FUER kJ/kcal. Bei "400 I.E. / 10 µg" (Vitamin D) wird NICHT
aufgespalten: IU und µg sind nicht dieselbe Groesse, und eine Aufspaltung wuerde
eine Gleichsetzung behaupten, die das Etikett nicht hergibt. Dort nimmst du den
Wert mit der belegten Einheit (µg) und laesst die andere Angabe im
original_value_text stehen.
Stehen kJ und kcal als ZWEI SICHTBARE ZEILEN untereinander, bleiben es zwei
Zeilen mit zwei row_index - dann ist nichts zusammenzufassen.

=== ZUTATENZEILEN ===
Der Zutatenabschnitt ist meist EIN FLIESSTEXT ("Zutaten: A, 29% B (C, D [E, F]), G ..."),
keine Tabelle. Dort gilt: JEDE TOP-LEVEL-ZUTAT IST EINE ZEILE. row_index zaehlt ihre
Position in der Liste, expected_rows = Anzahl der Top-Level-Zutaten. Klammer- und
Unterklammerinhalte bleiben IN der Zeile ihrer Zutat - als parenthetical_items mit Rolle -
und werden NIEMALS eigene rows. "71% EIER-TEIGWAREN (HARTWEIZENGRIESS, Wasser, ...)" ist
also EINE Zeile mit parenthetical_role "subingredients", nicht vier.
Nur Zeilen aus einem Zutatenabschnitt bekommen die Zutatenfelder. Fuer sie gelten dieselben
Klammerrollen wie im Modus "zutaten": processing | composition | explanation | subingredients |
unresolved. Erst die Rolle, dann die Entscheidung. Der Komplettstring wird nie ein Stammname.
"Bio" ist MERKMAL, nicht Identitaet: base_ingredient ohne Bio-Vorsilbe, attributes {"bio":true}.
Eine Zeile aus einer Naehrstoff- oder Wirkstofftabelle ist KEINE Zutat - auch dann nicht, wenn
der Stoff wie eine Zutat klingt.

WAS EINE TOP-LEVEL-ZUTAT TRENNT: ein Komma oder ein Semikolon, das AUSSERHALB
jeder Klammer steht. Nichts sonst.
  NICHT getrennt wird an einem Dezimalkomma: "Olivenoel 50,2 %" ist EINE Zutat.
  NICHT getrennt wird innerhalb einer Klammer: "(Salz, Kaliumjodat)" gehoert
    zur Zutat davor.
  NICHT getrennt wird an einem Komma im Namen selbst: "laktosefreier,
    schnittfester Mozzarella" ist EINE Zutat. Erkennbar daran, dass beide
    Teile zusammen einen Stoff beschreiben und der zweite Teil allein kein
    Lebensmittel waere.

ZWEI TOP-LEVEL-ZUTATEN DUERFEN NIE IN EINEM item LANDEN. Trennst du sie nicht,
weil du unsicher bist, dann gib das item mit extraction_status "needs_review"
und einer Begruendung in note aus - niemals als "extracted".
Beispiel: "Vollkornreismehl* extrudiert, Meersalz" sind ZWEI Zutaten; das Komma
steht ausserhalb jeder Klammer und "extrudiert" gehoert zum Reismehl.

=== WAS IN EINER ZUTATENLISTE KEINE ZUTAT IST ===
${HINWEIS_REGEL}

=== ABER SIE SIND AUCH KEIN MUELL: SIE SIND ALLERGENANGABEN ===
Solche Hinweise bekommen einen EIGENEN Abschnitt:
  section_key "allergene", semantic_class "allergen", target_kind "Allergene".

EIN ITEM JE GENANNTEM ALLERGEN - nicht eines fuer den ganzen Satz.
"Kann Spuren von Soja, Milch, Mandel, Nuessen und Sesam enthalten" ergibt FUENF
items. Alle fuenf tragen DENSELBEN row_index, denn sie stehen in EINER
Quellzeile.
  "original_label" = der EINE Allergenname, so wie er dasteht.
  "original_text"  = der vollstaendige Hinweissatz, woertlich zitiert.
Ein Allergen-item traegt keine Menge: amount, unit und basis_key bleiben null.

"attributes" traegt den CLAIM-TYP. Er unterscheidet zwei verschiedene Aussagen:
  {"allergen_claim":"enthalten"}  Bestandteil des Produkts. "Allergene: ...",
                                  "Enthaelt ...", oder ein in VERSALIEN
                                  hervorgehobener Stoff in der Zutatenliste.
  {"allergen_claim":"spuren"}     Kreuzkontamination, KEIN Bestandteil.
                                  "Kann Spuren von ... enthalten",
                                  "Kann ... enthalten",
                                  "Hergestellt in einem Betrieb, der auch ...".
BEIDES GLEICHZUSETZEN MACHT AUS EINER WARNUNG EINE ZUTAT. Ist der Fall aus dem
Wortlaut NICHT eindeutig zu bestimmen - etwa "Enthaelt moeglicherweise Sellerie"
-, dann RATE NICHT: gib das item mit section_key "unresolved", semantic_class
"unresolved", target_kind null und extraction_status "needs_review" aus und
schreibe in "note", was unklar ist.

Steht derselbe Stoff BEIDES - einmal in der Zutatenliste und einmal im
Spurenhinweis -, dann ist er einmal Zutat und einmal Allergen. Beide items
bleiben, mit ihrem jeweiligen section_key.

Ist eine Zutat in der Zutatenliste in VERSALIEN hervorgehoben, waehrend der
uebrige Text klein geschrieben ist ("WEIZENMEHL", "MILCHFETT"), ist das die
gesetzliche Allergenkennzeichnung. Dann entsteht ZUSAETZLICH zur Zutat ein
Allergen-item mit "allergen_claim":"enthalten". Die Zutat selbst bleibt
unveraendert bestehen und wird NICHT verdoppelt.

=== VOLLSTAENDIGKEIT: BEIDE ZAHLEN ZAEHLEN ZEILEN, NIEMALS ITEMS ===
"expected_rows" = wie viele Zeilen die Quelle in diesem Abschnitt SICHTBAR hat.
"extracted_rows" = wie viele VERSCHIEDENE "row_index" du in diesem Abschnitt ausgegeben hast.

Hat eine Zeile zwei Wertespalten, erzeugt sie ZWEI items - aber nur EINEN row_index und damit
nur EINE gezaehlte Zeile. ZAEHLE NIEMALS ITEMS. Wuerdest du items zaehlen, waere extracted_rows
bei zwei Spalten immer doppelt so gross wie expected_rows, der Vergleich waere wertlos und eine
FEHLENDE ZEILE BLIEBE UNSICHTBAR - bei 19 Zeilen stuenden dort 19 gegen 38, und fehlten sieben,
stuenden dort 19 gegen 24, was immer noch nach mehr aussieht.
Genau dafuer gibt es diese beiden Zahlen: an dieser Stelle sind schon einmal sieben von neunzehn
Aminosaeuren still verschwunden. Eine stille Luecke ist der schlimmste Fehler dieser Aufgabe.

Sind beide Zahlen gleich: status "complete".
Weichen sie ab: status "partial" UND in "note" steht, welche Zeilen du nicht lesen konntest.

ANTWORTE AUSSCHLIESSLICH MIT JSON, ohne Markdown:
{
  "contract_version": "riki_source_extraction_item_v1",
  "sections": [ {
      "section_key": string,
      "section_label": string|null,
      "expected_rows": number|null,
      "extracted_rows": number|null,
      "status": "open"|"complete"|"partial"|"unresolved",
      "note": string|null
  } ],
  "items": [ {
      "section_key": string,
      "row_index": number,
      "item_uid": string,
      "original_text": string,
      "original_label": string,
      "original_value_text": string|null,
      "item_key": string|null,
      "semantic_class": "ingredient"|"macro_nutrient"|"micronutrient"|"amino_acid"|"active_compound"|"allergen"|"unresolved",
      "target_kind": string|null,
      "comparison_operator": string|null,
      "amount": number|null,
      "unit": string|null,
      "basis_key": string|null,
      "basis_label": string|null,
      "row_group_key": string|null,
      "confidence": "hoch"|"mittel"|"niedrig"|null,
      "extraction_status": "extracted"|"unresolved"|"needs_review",
      "persistence_status": "not_persisted",
      "source_locator": object,
      "note": string|null,
      "base_ingredient": string|null,
      "processing_modifiers": string[]|null,
      "attributes": object|null,
      "parenthetical_role": string|null,
      "parenthetical_items": string[]|null
  } ]
}
"item_uid" vergibst du fortlaufend als "i1", "i2", "i3" ... - eindeutig innerhalb DIESER Antwort.
"row_index" zaehlt je Abschnitt bei 1 beginnend in der sichtbaren Reihenfolge.
"source_locator" beschreibt, wo die Zeile stand, z.B. {"abschnitt":"Aminosaeurenprofil","zeile":7}.
"persistence_status" ist IMMER "not_persisted" - du schreibst nichts.
"extraction_status" bedeutet:
  extracted     du hast die Zeile sicher gelesen
  unresolved    du kannst sie nicht sicher zuordnen - Begruendung in note
  needs_review  du hast sie gelesen, aber die Aufteilung ist unsicher
Bei semantic_class "allergen" ist "attributes" PFLICHT und traegt
{"allergen_claim":"enthalten"} oder {"allergen_claim":"spuren"} - dazu
section_key "allergene" und target_kind "Allergene". Fehlt eines davon, wird der
GANZE Lauf verworfen.`;
// WELLE 1, 18.08.2026: "ignored" wurde hier bewusst NICHT aufgenommen, obwohl der
// DB-CHECK auf source_extraction_item es kennt. Der Persistenzweg
// cb_riki_source_extraction_speichern prueft im Contract riki_source_extraction_item_v1
// gegen ('extracted','unresolved','needs_review') und wirft bei allem anderen eine
// Exception — ein einziges ignored-Item wuerde den GANZEN RPC-Lauf abbrechen.
// Prompt und Persistenzvertrag stehen damit in Deckung. Es wird KEIN Filter gebaut,
// der ignored still zu etwas anderem macht: eine sichtbare Quellzeile darf nicht
// durch eine Normalisierung verschwinden. "ignored" kommt erst, wenn der RPC es kennt.
}

// ============================================================================
// v16 · CHUNKING FUER MODUS "rohtext"
//
// Der folgende Kommentarblock stammt unveraendert aus
// bereiche/riki-analyse-v16-chunking.ts. Der Satz "Diese Datei ist KEIN
// vollstaendiger Function-Code" bezieht sich auf JENE Delta-Datei, nicht auf
// diese hier - er bleibt im Wortlaut stehen, weil an Kommentaren der
// Chunking-Datei nichts gekuerzt wird.
// ============================================================================

// ============================================================================
// riki-analyse v16 — Chunking für modus "rohtext"
// Vertrag RIKI-E2E-120 v2, Abschnitt A · Stand 2 nach ChatGPTs Gegenprüfung
//
// Diese Datei ist KEIN vollständiger Function-Code. Sie enthält genau die
// Bausteine, die in v15 eingesetzt werden — damit nachvollziehbar bleibt, was
// sich ändert, statt 700 Zeilen unverändertes Regelwerk mitzukopieren.
//
// ANLASS (gemessen 17.08.2026, Work #115):
//   P1023, P1022, P1700, P73617 — vier von vierzehn Etiketten wurden am
//   Ausgabelimit verworfen. Der v13-Riegel hat richtig gehandelt: lieber nichts
//   als ein halbes Ergebnis. Aber damit sind vier Etiketten unlesbar.
//
// RALPH-GO: 17.08.2026 "a" — Claude baut, ChatGPT prüft gegen. Gegenprüfung
// erfolgt; die drei berechtigten Einwände sind unten namentlich eingearbeitet.
//
// VERTRAGSBEZUG:
//   §2.7  Ein Limit darf nie als "complete" enden. Chunking ERSETZT den
//         v13-Riegel nicht, es kommt davor.
//   §8.4  0 stille Datenverluste — ein abgebrochener Block wird laut.
//   §1.2  extracted_rows zählt Quellzeilen, nie Items, und beweist allein
//         keine Vollständigkeit.
//
// WAS SICH NICHT ÄNDERT:
//   Das Regelwerk (System-Prompt) bleibt Wort für Wort gleich. Geändert wird
//   nur die Ablaufsteuerung und ein Hinweissatz im Benutzertext. Damit greift
//   CLAUDE.md §24 (Riki-Gleichlauf) nicht — es ist keine Regeländerung.
//
// GEMESSENE SCHEMA-GRENZEN — NEU GEMESSEN 17.08.2026 NACH ChatGPTs FIX:
//   source_extraction_section.status ∈ open | complete | partial |
//                                      unresolved | unreadable | not_applicable
//     -> "unresolved" ist inzwischen ERLAUBT. Der frühere Umweg über
//        unreadable ist damit falsch geworden und wurde entfernt.
//        unresolved = fachlich nicht eindeutig zuzuordnen.
//        unreadable = Quelle technisch nicht lesbar.
//        Zwei verschiedene Aussagen; sie werden nicht mehr vermischt.
//   source_extraction_item.extraction_status ∈ extracted | unresolved |
//                                              needs_review | ignored
//     -> needs_review ist inzwischen ERLAUBT (war es am Vormittag nicht,
//        siehe Hinweis an #3). Vertrag §7.3 ist damit erfüllbar.
//   ux_source_extraction_item_run_uid  UNIQUE (run_id, item_uid)
//     -> item_uid MUSS je Lauf eindeutig sein. Zwei Blöcke liefern beide "i1".
//        ChatGPTs Einwand, gemessen bestätigt: der Riegel ist ein INDEX, in
//        pg_constraint unsichtbar. Meine erste Gegenmessung hat ihn übersehen.
// ============================================================================


// ---------------------------------------------------------------------------
// 1 · SCHWELLE — die erste Fassung war falsch, die Gegenprobe hat sie gekippt
// ---------------------------------------------------------------------------
// ERSTER ANSATZ, VERWORFEN: Schwelle nach EINGABEZEICHEN, hergeleitet aus
// P1809 (6,1 Ausgabe-Token je Zeichen), Zielgröße 1.500 Zeichen.
// Die Gegenprobe an allen 14 Etiketten hat ihn widerlegt: P73617 hat nur 1.149
// Zeichen, wäre also EIN Block geblieben — und ist am 17.08. genau daran
// gescheitert. Zeichen sagen nichts über die Ausgabemenge.
//
// DER GRUND: die Ausgabe hängt an der Zahl der ITEMS, nicht der Zeichen. Eine
// Tabellenzeile mit zwei Wertespalten erzeugt ZWEI items (Regelwerk, Abschnitt
// "Mehrere Wertespalten"). P73617 hat 25 zweispaltige Zeilen: aus 34 sichtbaren
// Zeilen werden rund 59 items. Ein Zutatenfließtext derselben Länge erzeugt ein
// Fünftel davon.
//
// GEMESSEN 17.08.2026 an P1809: 33 items -> 11.698 Ausgabe-Token = 354 Token
// je item. Bei max_tokens 16.000 sind das rund 44 items.
//
// ZIELGRÖSSE 32 statt 44 — ChatGPTs Einwand 5, übernommen. Begründung: die
// 354 Token je item stammen aus EINER Messung. 44 wäre die rechnerische
// Grenze ohne jede Reserve; 32 lässt 27 % Luft. Ein zusätzlicher Block kostet
// rund einen Cent, ein Abbruch den ganzen Lauf.
const ROHTEXT_MAX_TOKENS = 16000;
const ROHTEXT_TOKEN_JE_ITEM = 360;   // Messwert 17.08.2026, P1809: 11.698/33
const ROHTEXT_ITEMS_JE_BLOCK = 32;   // 16.000/360 = 44, davon 27 % Marge


// ---------------------------------------------------------------------------
// 2 · WIEVIELE ITEMS ERZEUGT EIN TEXTSTÜCK
// ---------------------------------------------------------------------------
// Bewusst grob und bewusst großzügig. Diese Schätzung entscheidet NICHT über
// das Ergebnis, nur darüber, ob geteilt wird. Sie darf überschätzen; sie darf
// nicht unterschätzen.
//
// ChatGPTs Einwand 2 (Unterzählung bei whitespace-kollabierten Tabellen),
// eingearbeitet: Tabs, Semikolons und wiederholte Zahl-Einheit-Paare zählen
// jetzt als Spaltentrenner mit. Eine Tabelle, die beim Kopieren ihre
// Pipe-Zeichen verloren hat, wird dadurch nicht mehr als einspaltig gelesen.
function schaetzeItems(text: string): number {
  let items = 0;
  for (const roh of String(text ?? "").split("\n")) {
    const z = roh.trim();
    if (!z) continue;

    // Zutaten-Fließtext: Top-Level-Zutaten sind die Kommas AUSSERHALB von
    // Klammern. Klammerinhalte werden nie eigene rows (Regelwerk, #78).
    if (/^Zutaten/i.test(z)) {
      let tiefe = 0, n = 1;
      for (const c of z) {
        if (c === "(" || c === "[") tiefe++;
        else if (c === ")" || c === "]") tiefe--;
        else if (c === "," && tiefe === 0) n++;
      }
      items += n;
      continue;
    }
    // Überschriften und Fußnoten erzeugen keine items.
    if (/^(Allergene|Spuren|Kann |Produkt|Bezeichnung|Genaue|Herkunft|Weitere Info|Verpackung|Verzehr|\*|\d+ PORTIONEN)/i.test(z)) continue;

    // Spaltentrenner: Pipe, Tab, Semikolon. Eine reine Prozentspalte am Ende
    // ist keine eigene Basis und zählt nicht mit.
    const trenner = (z.match(/[|\t;]/g) || []).length;
    if (trenner >= 1) {
      items += Math.max(1, trenner - (/[|\t;]\s*\d+([.,]\d+)?\s*%?\s*$/.test(z) ? 1 : 0));
      continue;
    }

    // Whitespace-kollabierte Zeile: jedes Zahl-Einheit-Paar ist ein Wert.
    // "Vitamin C 300 mg 375 Vitamin E 30 mg 250" ist keine Zeile mit einem
    // Wert, sondern zwei Stoffe mit je einem.
    const wertpaare = (z.match(/\d+(?:[.,]\d+)?\s*(?:mg|µg|ug|mcg|g|kg|ml|l|kJ|kj|kcal|IU|I\.E\.|%)/gi) || []).length;
    if (wertpaare >= 1) items += wertpaare;
    else if (/\d/.test(z)) items += 1;
  }
  return items;
}


// ---------------------------------------------------------------------------
// 3 · SCHNITTKASKADE — ChatGPTs Einwand 1, der berechtigte Blocker
// ---------------------------------------------------------------------------
// Die erste Fassung schnitt AUSSCHLIESSLICH an Absatzgrenzen. Sein Gegenfall:
// eine per OCR oder Copy/Paste zusammengezogene Tabelle ohne Leerzeilen, im
// Extrem eine einzige lange Zeile. Dann findet der Splitter keine Grenze.
//
// Sein Wortlaut "erzeugt genau den stillen Verlust" trifft nicht ganz: mein
// Code hätte das über unresolved_truncated LAUT gemeldet, nicht still. Aber
// laut und unlesbar ist auch kein Ergebnis. Der Einwand steht.
//
// KASKADE, in dieser Reihenfolge:
//   1. Absatzgrenze (Leerzeile)     — sicher, Überschrift bleibt beim Block
//   2. Zeilengrenze innerhalb eines Absatzes — Überschrift wird MITGEGEBEN
//   3. Wertpaar-Grenze innerhalb einer Zeile — nur bei echten Trennzeichen
//   4. gar nicht teilbar             — unreadable, laut und mit Grund
//
// Ab Stufe 2 verliert der Folgeblock seine Überschrift. Sie wird ihm als
// KONTEXT im Benutzertext mitgegeben, nicht in den Quelltext hineingeschrieben
// — ein erfundener Quelltext wäre eine Fälschung (§1.1 des Regelwerks).
type Block = {
  text: string;
  ueberschrift: string | null;  // nur gesetzt, wenn innerhalb eines Abschnitts geschnitten wurde
  fortsetzungAbZeile: number | null;
  stufe: 1 | 2 | 3 | 4;
};

// A4b, gefunden im Testlauf vom 17.08. an P73617:
// Die erste Fassung verwarf JEDE Zeile mit einem Trennzeichen als Überschrift.
// Damit war "Aminosäurenprofil | pro 100g | pro Portion (10g)" keine Überschrift
// — obwohl sie Titel UND Spaltenköpfe in einer Zeile trägt. Der Folgeblock bekam
// deshalb GAR KEINEN Kontext, und L-Tryptophan, L-Thyrosin, L-Valin und
// Hydroxyprolin landeten mit basis_key "unresolved" statt pro_100g/pro_portion.
//
// Eine Kopfzeile erkennt man nicht am Fehlen von Trennern, sondern am Fehlen von
// MESSWERTEN. "pro 100 g" ist eine Bezugsangabe, "2,9 g" ist eine Messung.
function istUeberschrift(zeile: string): boolean {
  const z = zeile.trim();
  if (!z || z.length > 120) return false;

  // ZUERST die Datenzeile ausschliessen, dann erst den Kopf erkennen.
  // Eine Datenzeile hat MEHRERE Zellen, die nichts als eine Zahl enthalten.
  // Gefunden in der Gegenprobe: "Kalium [mg] | 6667 | 1000 | 50%" trägt die
  // Einheit im NAMEN und nackte Zahlen in den Spalten — die Messwert-Regel
  // weiter unten greift dort nicht.
  const zellen = z.split(/[|\t;]/).map((s) => s.trim()).filter(Boolean);
  const zahlZellen = zellen.filter((c) =>
    /^[<>~=]?\s*\d+(?:[.,]\d+)?\s*(?:%|mg|µg|ug|mcg|g|kg|ml|l|kJ|kj|kcal|IU|I\.E\.)?$/i.test(c)
  ).length;
  if (zahlZellen >= 2) return false;

  // Eine Bezugsangabe macht die Zeile zur Kopfzeile, egal ob mit Trennern.
  // "Naehrwertangaben pro 100 g" und "Mineralien | pro 100 g | pro Portion (10 g)"
  // sind beide Köpfe.
  if (/\b(pro|je|per|prozent|nrv|typische werte)\b/i.test(z)) return true;

  // Bezugsbeschriftung ohne Bezugswort: eine Menge, der ein WORT folgt, ist
  // eine Spaltenbeschriftung, keine Messung — "Naehrwerte | 100 ml
  // LaVita-Fertiggetraenk" (P1809). Eine Messung endet mit ihrer Einheit.
  if (/\d+(?:[.,]\d+)?\s*(?:ml|g|kg|l)\s+\S*[A-Za-zÄÖÜäöü]/.test(z)) return true;

  // Ohne all das: eine Kopfzeile trägt keinen Messwert.
  const messwerte = (z.match(/\d+(?:[.,]\d+)?\s*(mg|µg|ug|mcg|g|kg|ml|l|kJ|kj|kcal|IU|I\.E\.)\b/gi) || []).length;
  if (messwerte >= 1) return false;

  // Zeile mit Trennern, aber ohne jeden Messwert: Spaltenkopf ohne Bezugswort,
  // z.B. "Stoff | Menge | Anteil". Zählt als Kopf.
  return true;
}

function teileRohtext(text: string, itemsJeBlock: number): Block[] {
  const t = String(text ?? "").trim();
  if (!t) return [{ text: "", ueberschrift: null, fortsetzungAbZeile: null, stufe: 1 }];
  if (schaetzeItems(t) <= itemsJeBlock) {
    return [{ text: t, ueberschrift: null, fortsetzungAbZeile: null, stufe: 1 }];
  }

  const bloecke: Block[] = [];
  const absaetze = t.split(/\n[ \t]*\n/).map((s) => s.trim()).filter(Boolean);

  let sammel = "";
  let sammelItems = 0;
  const abgeben = () => { if (sammel) { bloecke.push({ text: sammel, ueberschrift: null, fortsetzungAbZeile: null, stufe: 1 }); sammel = ""; sammelItems = 0; } };

  for (const a of absaetze) {
    const aItems = schaetzeItems(a);

    if (aItems > itemsJeBlock) {
      // STUFE 2: dieser eine Absatz ist allein zu gross.
      abgeben();
      for (const b of teileAbsatzNachZeilen(a, itemsJeBlock)) bloecke.push(b);
      continue;
    }
    if (sammel && (sammelItems + aItems) > itemsJeBlock) abgeben();
    sammel = sammel ? sammel + "\n\n" + a : a;
    sammelItems += aItems;
  }
  abgeben();
  return bloecke.length ? bloecke : [{ text: t, ueberschrift: null, fortsetzungAbZeile: null, stufe: 1 }];
}

function teileAbsatzNachZeilen(absatz: string, itemsJeBlock: number): Block[] {
  const zeilen = absatz.split("\n");
  // A4b: Der Kopf kann MEHRERE Zeilen umfassen — ein Abschnittstitel und
  // darunter eine eigene Spaltenkopfzeile. Beide gehören dem Folgeblock als
  // Kontext, sonst verliert er die Bezugsbasis seiner Spalten.
  const kopfZeilen: string[] = [];
  let i = 0;
  while (i < zeilen.length && i < 2 && istUeberschrift(zeilen[i])) {
    kopfZeilen.push(zeilen[i].trim());
    i++;
  }
  const kopf = kopfZeilen.length ? kopfZeilen.join(" / ") : null;
  const daten = zeilen.slice(i);

  if (daten.length <= 1) {
    // STUFE 3: eine einzige, zu grosse Zeile.
    return teileEinzelzeile(daten[0] ?? absatz, kopf, itemsJeBlock);
  }

  const out: Block[] = [];
  let puffer: string[] = [];
  let pufferItems = 0;
  let abZeile = 1;
  let erster = true;

  const abgeben = () => {
    if (!puffer.length) return;
    const rumpf = puffer.join("\n");
    out.push({
      // Der erste Block behält die Kopfzeilen als echten Quelltext — sie
      // standen dort. Jeder Folgeblock bekommt sie als KONTEXT, nicht als
      // Quelltext: hineinzuschreiben, was dort nicht steht, wäre eine
      // Fälschung (§1.1).
      text: erster && kopfZeilen.length ? kopfZeilen.join("\n") + "\n" + rumpf : rumpf,
      ueberschrift: erster ? null : kopf,
      fortsetzungAbZeile: erster ? null : abZeile,
      stufe: 2,
    });
    abZeile += puffer.length;
    puffer = []; pufferItems = 0; erster = false;
  };

  for (const z of daten) {
    const zi = schaetzeItems(z);
    if (zi > itemsJeBlock) { abgeben(); out.push(...teileEinzelzeile(z, kopf, itemsJeBlock)); continue; }
    if (puffer.length && (pufferItems + zi) > itemsJeBlock) abgeben();
    puffer.push(z); pufferItems += zi;
  }
  abgeben();
  return out;
}

// STUFE 3/4: eine Zeile, die allein zu gross ist. Geteilt wird NUR an echten
// Trennzeichen. Gibt es keine, wird NICHT geraten — der Block geht als
// unteilbar durch und meldet sich am Ende als unreadable.
function teileEinzelzeile(zeile: string, kopf: string | null, itemsJeBlock: number): Block[] {
  const z = String(zeile ?? "").trim();
  if (!z) return [];
  const teile = z.split(/\s*;\s*|\t+/).map((s) => s.trim()).filter(Boolean);

  if (teile.length < 2) {
    return [{ text: kopf ? kopf + "\n" + z : z, ueberschrift: kopf, fortsetzungAbZeile: null, stufe: 4 }];
  }

  const out: Block[] = [];
  let puffer: string[] = [];
  let pufferItems = 0;
  for (const s of teile) {
    const si = schaetzeItems(s);
    if (puffer.length && (pufferItems + si) > itemsJeBlock) {
      out.push({ text: puffer.join("; "), ueberschrift: kopf, fortsetzungAbZeile: null, stufe: 3 });
      puffer = []; pufferItems = 0;
    }
    puffer.push(s); pufferItems += si;
  }
  if (puffer.length) out.push({ text: puffer.join("; "), ueberschrift: kopf, fortsetzungAbZeile: null, stufe: 3 });
  return out;
}


// ---------------------------------------------------------------------------
// 3b · DER QUELLTEXT-ABGLEICH — der eigentliche Vollständigkeitsnachweis
// ---------------------------------------------------------------------------
// v16.2, gebaut nach dem A5-Lauf vom 17.08.2026. Er beantwortet die Frage, die
// expected_rows NICHT beantworten kann, weil RIKI sie sich selbst stellt (§1.2):
//
//   HINRICHTUNG   Steht jeder gelieferte original_text wirklich im Quelltext?
//                 Wenn nicht, ist er ERFUNDEN.
//   RÜCKRICHTUNG  Ist jede Quelltextzeile mit einem Wert von einem Item
//                 abgedeckt? Wenn nicht, wurde sie ÜBERSPRUNGEN.
//
// Beide Richtungen sind im CODE prüfbar, ohne das Modell zu fragen. Das ist der
// Unterschied zu allem, was bisher da war.
//
// ANLASS, beide gemessen am 17.08.:
//   EDEKA-2 lieferte 1 Zutat, obwohl die Quelle keine Zutatenliste hat. Am
//     Vormittag bestand derselbe Fall — reine Modell-Varianz. Ein Testfall, der
//     mal besteht und mal nicht, beweist auch im Bestehen nichts.
//   P1023 verlor "SynBalance SportMax 4 BLN KBE", P1022 "Coenzym Q10 5 mg".
//     Beide Abschnitte meldeten sich als complete.

// Normalisierung nur für den VERGLEICH. Der Originaltext bleibt unangetastet —
// verglichen wird eine Kopie, gespeichert wird das Original (§1.1).
function vglNorm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[­​]/g, "")        // weiches Trennzeichen, Zero-Width
    .replace(/[„“”"'`´]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Ein Item gilt als belegt, wenn sein original_text ODER sein original_label
// im Quelltext steht. Beide sind laut Vertrag ZITATE aus der Quelle.
//
// base_ingredient wird BEWUSST NICHT geprüft — es ist eine ABLEITUNG, kein
// Zitat. Die erste Fassung nahm es mit, und der EDEKA-2-Fall rutschte durch:
// die erfundene Zutat "Pasteurisierte entrahmte Milch" hatte
// base_ingredient "Milch", und "Milch" steht im Allergenhinweis. Ein
// abgeleiteter Kurzname findet fast immer irgendwo einen Treffer.
function itemImQuelltext(it: any, quelleNorm: string): boolean {
  const kandidaten = [it?.original_text, it?.original_label]
    .map((x) => vglNorm(x))
    .filter((x) => x.length >= 4);
  if (!kandidaten.length) return true;              // nichts zu prüfen
  return kandidaten.some((k) => quelleNorm.includes(k));
}

// Engere Kopferkennung, NUR für die Rückrichtung. istUeberschrift() ist für das
// Teilen gebaut und dort bewusst großzügig — hier wäre sie zu großzügig und
// würde echte Datenzeilen verschlucken.
// Gefunden in der Gegenprobe: "SynBalance SportMax (…) 4 BLN KBE**" galt als
// Überschrift, weil "BLN" keine bekannte Einheit ist. Genau die Zeile, die bei
// P1023 verlorenging — der Riegel hätte sie übersehen.
function istBezugskopf(z: string): boolean {
  if (/\b(pro|je|per|prozent|nrv|typische werte)\b/i.test(z)) return true;
  if (/\d+(?:[.,]\d+)?\s*(?:ml|g|kg|l)\s+\S*[A-Za-zÄÖÜäöü]/.test(z)) return true;
  return false;
}

// E1, v16.5 — DIE ZWEITE HÄLFTE DER RÜCKRICHTUNG.
// nichtAbgedeckteZeilen() überspringt den Zutaten-Fließtext, weil dort "Zeile"
// etwas anderes bedeutet als in einer Tabelle: der ganze Block ist EINE Zeile.
// Damit prüfte der Abgleich im gesamten Zutatenteil bisher gar nichts.
//
// ANLASS, gemessen 18.08. an ALN-2: die Quelle nennt sieben Top-Level-Zutaten,
// RIKI lieferte sechs items. Zeile 5 trug zwei davon —
//   "DINKELVOLLKORNMEHL*¹ 3,6 %, Vollkornreismehl* extrudiert"
// — mit der Begründung "bleibt als Unterklammerinhalt". Dort ist keine Klammer,
// das ist ein Komma auf oberster Ebene.
// Derselbe Punkt zeigte an drei Läufen drei Verhalten: zusammengefasst MIT
// needs_review, getrennt, zusammengefasst OHNE Meldung. §7.3 lässt "getrennt
// ODER gemeldet" gelten — der dritte Fall ist weder noch.
//
// GEZÄHLT WIRD GROB UND BEWUSST NUR GEMELDET, NICHT KORRIGIERT: aus einem
// Zählunterschied lässt sich nicht ableiten, WELCHE Zutat fehlt. Das Aufteilen
// bleibt Sache des Modells (oder des Nachschlags); der Code sagt nur, dass die
// Zahlen auseinandergehen.
function zaehleTopLevelZutaten(text: string): number {
  let gesamt = 0;
  for (const roh of String(text ?? "").split("\n")) {
    const z = roh.trim();
    if (!/^Zutaten/i.test(z)) continue;
    // Alles ab dem Doppelpunkt, sonst zählt "Zutaten" selbst mit.
    let rumpf = z.replace(/^Zutaten[^:]*:\s*/i, "");

    // v16.6 — DIE ZUTATENLISTE ENDET VOR DEM KLEINGEDRUCKTEN.
    // Gefunden beim Aufbau des zweiten Testsatzes, BEVOR der Riegel je an einem
    // echten Etikett lief: die erste Fassung zählte Spurenhinweise als Zutaten mit.
    //   P1593  8 echte Zutaten, gezählt 11  (drei "kann enthalten"-Blöcke)
    //   P1532 14 echte Zutaten, gezählt 18  ("Kann enthalten: SOJA, MANDELN, …")
    //   P1177  5 echte Zutaten, gezählt 11  (Laktosegehalt + sechs Spurenallergene)
    // Bei ALN-2 fiel das nicht auf, weil der Hinweis dort in einer eigenen Zeile
    // stand. Ein zu hoher Sollwert lässt den Riegel bei JEDEM Etikett mit
    // Spurenhinweis im selben Absatz falschen Alarm schlagen — er würde melden,
    // dass Zutaten fehlen, obwohl alle da sind.
    //
    // Abgeschnitten wird am ersten dieser Marker. Die Liste ist bewusst
    // aufzählend und nicht raffiniert: jeder Eintrag steht für einen gemessenen
    // Fall, und ein Marker, der zu früh greift, macht den Sollwert zu klein und
    // den Riegel stumm — das ist die harmlosere Richtung.
    let ende = rumpf.search(
      /\b(?:kann(?:en)?\s+(?:Spuren\s+)?enthalten|kann\s+Spuren\s+von|Laktosegehalt|Nettof[üu]llmenge|Mindestens\s+haltbar|Unter\s+Schutzatmosph[äa]re)/i,
    );
    if (ende > 0) {
      // Vom Marker aus zurück bis zum letzten Trenner auf Tiefe 0. Sonst bleibt
      // das Wort davor stehen und zählt als Zutat mit: bei P1593 lautet der
      // Hinweis "Backmischung kann enthalten: (EI, SOJA, MILCH)" — ohne diesen
      // Schritt wäre "Backmischung" eine neunte Zutat.
      let tiefe = 0, schnitt = ende;
      for (let i = 0; i < ende; i++) {
        const c = rumpf[i];
        if (c === "(" || c === "[") tiefe++;
        else if (c === ")" || c === "]") tiefe = Math.max(0, tiefe - 1);
        else if ((c === "," || c === ";" || c === ".") && tiefe === 0) schnitt = i;
      }
      rumpf = rumpf.slice(0, schnitt);
    }
    let tiefe = 0, n = 1;
    for (let i = 0; i < rumpf.length; i++) {
      const c = rumpf[i];
      if (c === "(" || c === "[") tiefe++;
      else if (c === ")" || c === "]") tiefe = Math.max(0, tiefe - 1);
      else if ((c === "," || c === ";") && tiefe === 0) {
        // DEUTSCHES DEZIMALKOMMA IST KEIN TRENNER — steht wörtlich so im
        // Regelwerk, und genau darüber bin ich in der Gegenprobe gestolpert:
        // "DINKELVOLLKORNMEHL*¹ 3,6 %" ergab eine Zutat zu viel, ebenso
        // "Zartbitterschokolade* 4,9 %" bei ALN-1. Ein Komma zwischen zwei
        // Ziffern trennt nichts.
        const davor = rumpf[i - 1] ?? "";
        const danach = rumpf[i + 1] ?? "";
        if (/\d/.test(davor) && /\d/.test(danach)) continue;
        n++;
      }
    }
    gesamt += n;
  }
  return gesamt;
}

// Rückrichtung: Quelltextzeilen, die einen Messwert oder eine Mengenangabe
// tragen und von KEINEM Item abgedeckt sind. Zutaten-Fließtext wird hier
// ausgenommen — dafür gibt es zaehleTopLevelZutaten() oben.
function nichtAbgedeckteZeilen(quelle: string, items: any[]): string[] {
  const belegt = items.map((x) => vglNorm(x?.original_text || x?.original_label));
  const offen: string[] = [];
  for (const roh of String(quelle ?? "").split("\n")) {
    const z = roh.trim();
    if (!z || z.length < 4) continue;
    if (/^Zutaten/i.test(z)) continue;
    if (/^(Allergene|Spuren|Kann |Produkt|Bezeichnung|Genaue|Herkunft|Weitere Info|Verpackung|Verzehr|\*|\d+ PORTIONEN)/i.test(z)) continue;
    if (istBezugskopf(z)) continue;
    // Nur Zeilen, die überhaupt einen Wert tragen — Fließtext ohne Zahl ist
    // keine übersprungene Datenzeile.
    if (!/\d/.test(z)) continue;
    const zn = vglNorm(z);
    // Abgedeckt, wenn ein Item diese Zeile enthält oder die Zeile ein Item.
    const treffer = belegt.some((b) => b.length >= 4 && (zn.includes(b) || b.includes(zn)));
    if (!treffer) offen.push(z);
  }
  return offen;
}


// ---------------------------------------------------------------------------
// 4 · VERLUSTFREIES ZUSAMMENFÜHREN
// ---------------------------------------------------------------------------
// Die heikle Stelle. ChatGPTs Einwand 2b, eingearbeitet: row_index wird NICHT
// blind um max verschoben, sondern (block_order, section_key, local_row_index)
// wird auf einen neuen globalen Abschnittsindex abgebildet. Der Unterschied
// zeigt sich, wenn ein Block kaputte lokale Indizes liefert — dann wird nicht
// still repariert, sondern der Abschnitt auf partial gesetzt.
//
// item_uid wird global neu vergeben. Grund gemessen: UNIQUE (run_id, item_uid).
// Zwei Blöcke liefern beide "i1", "i2" — beim Persistieren kollidiert das.
type Merged = {
  contract_version: string;
  sections: any[];
  items: any[];
  chunking: any;
};

// ---------------------------------------------------------------------------
// 3c · ROW-INDEX-RIEGEL — eine Nummer, eine sichtbare Quellzeile
// ---------------------------------------------------------------------------
// v18, 19.08.2026, Work D1. Ralphs Vorgabe woertlich:
//   "Innerhalb desselben section_key darf ein row_index nur Items DERSELBEN
//    sichtbaren Quellzeile gruppieren. Haben Items denselben bisherigen
//    row_index, stammen aber nachweislich aus verschiedenen Quellzeilen, werden
//    sie deterministisch auf getrennte globale row_index verteilt."
//   GEGENREGEL: kJ/kcal und andere Mehrfachwerte DERSELBEN Quellzeile bleiben
//   zusammen — etwa "Energie | 98 kJ / 24 kcal".
//
// DAS KRITERIUM IST NICHT TEXTGLEICHHEIT, SONDERN DIE PHYSISCHE ZEILE.
// "verschiedener original_text ⇒ neue Nummer" waere zu grob: genau so entstehen
// die zwei items einer echten kJ/kcal-Zelle, wenn das Modell den Wertteil
// zitiert statt der ganzen Zeile. Gefragt wird deshalb: in WELCHER Zeile des
// Blocktextes steht dieser original_text? Zwei items gehoeren derselben
// Quellzeile an, wenn sie auf DIESELBE physische Zeile zeigen.
//   EDEKA-2  "Brennwert in kcal …" und "Brennwert in kJ …" stehen in
//            VERSCHIEDENEN Zeilen  ->  trennen.
//   "Energie | 98 kJ / 24 kcal"  beide items zeigen auf DIESELBE Zeile
//            ->  zusammen lassen.
//
// IM ZWEIFEL WIRD NICHT GETRENNT. Laesst sich fuer auch nur EIN item der Gruppe
// die Zeile nicht sicher bestimmen — weil das Modell umformuliert hat, weil der
// Text mehrfach vorkommt, weil er ueber einen Zeilenumbruch laeuft — bleibt der
// bisherige row_index unangetastet. Ein falsch getrennter row_index ERFINDET
// eine Quellzeile, die es nicht gibt (§1.1); das waere schlimmer als der Befund.
//
// WO ER SITZT: in fuegeZusammen(), VOR der Schluesselbildung. Die deterministische
// Neuvergabe der globalen row_index laeuft dort bereits; der Riegel baut keine
// zweite Nummernlogik daneben, sondern haengt nur eine Zeilenkennung an den
// vorhandenen Mappingschluessel (§4.2, §22). Damit laeuft er automatisch NACH
// der Blockzusammenfuehrung und VOR spalteEnergie — die von spalteEnergie
// erzeugten kcal-items entstehen erst danach und werden vom Riegel nie gesehen.
//
// Was er NICHT anfasst: den original_text, den row_group_key, den
// source_locator, den Status, die Reihenfolge der items und spalteEnergie.
type TrennFall = {
  blockNr: number;
  section_key: string;
  alt: number;
  gruppen: { zeile: number; schluessel: string; text: string }[];
};

// In welcher PHYSISCHEN Zeile des Blocktextes steht dieses item?
// Rueckgabe: 1-basierte Zeilennummer, oder null wenn nicht EINDEUTIG bestimmbar.
// Verglichen wird mit vglNorm() — derselben Normalisierung wie in
// itemImQuelltext(), damit es nur EINEN Zeilenabgleich gibt (§4.2).
function findeQuellzeile(it: any, zeilenNorm: string[]): number | null {
  // original_text zuerst, original_label nur als Rueckfall. Beide sind laut
  // Vertrag ZITATE aus der Quelle. base_ingredient wird bewusst NICHT geprueft —
  // es ist eine Ableitung und findet fast immer irgendwo einen Treffer
  // (derselbe Grund wie bei itemImQuelltext).
  for (const roh of [it?.original_text, it?.original_label]) {
    const nadel = vglNorm(roh);
    if (nadel.length < 4) continue;
    let treffer = -1, anzahl = 0;
    for (let i = 0; i < zeilenNorm.length; i++) {
      if (zeilenNorm[i].length >= 4 && zeilenNorm[i].includes(nadel)) { anzahl++; treffer = i; }
      if (anzahl > 1) break;
    }
    if (anzahl === 1) return treffer + 1;
    // MEHRDEUTIG: nicht auf das naechste Feld ausweichen. Kommt derselbe Text in
    // zwei Zeilen vor, ist die Zeile unbekannt — und ein Rueckfall auf das
    // kuerzere original_label wuerde die Mehrdeutigkeit nur verstecken.
    if (anzahl > 1) return null;
  }
  return null;
}

// Entscheidet je (section_key, LOKALEM row_index) eines Blocks, ob getrennt wird.
// Rueckgabe: Map item -> Zusatz fuer den Mappingschluessel ("" = keine Trennung).
// Gefuellt wird nur, wo wirklich getrennt wird; alles andere bleibt unberuehrt.
function zeileTrennen(
  items: any[],
  blockText: string,
  blockNr: number,
  faelle: TrennFall[],
): Map<any, string> {
  const zusatz = new Map<any, string>();
  const t = String(blockText ?? "");
  // Ohne Quelltext gibt es kein Kriterium — dann wird nicht getrennt.
  if (!t.trim() || !Array.isArray(items) || items.length < 2) return zusatz;
  const zeilenNorm = t.split("\n").map((z) => vglNorm(z));

  const gruppen = new Map<string, any[]>();
  for (const it of items) {
    const r = Number(it?.row_index);
    // Unbrauchbare lokale Indizes bekommen ohnehin je einen eigenen
    // Ersatzschluessel ("x1", "x2", …) und koennen gar nicht kollidieren.
    if (!isFinite(r) || r <= 0) continue;
    const k = JSON.stringify([String(it?.section_key ?? "unresolved"), r]);
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k)!.push(it);
  }

  for (const [k, gr] of gruppen) {
    if (gr.length < 2) continue;                       // keine Kollision
    const zeilen = gr.map((it) => findeQuellzeile(it, zeilenNorm));
    if (zeilen.some((z) => z === null)) continue;      // Zweifel -> unangetastet
    const verschiedene = new Set(zeilen as number[]);
    if (verschiedene.size < 2) continue;               // EINE Quellzeile -> zusammen

    const [skRoh, altRoh] = JSON.parse(k) as [string, number];
    const sk = String(skRoh);
    const alt = Number(altRoh);
    const fall: TrennFall = { blockNr, section_key: sk, alt, gruppen: [] };
    const gesehen = new Set<number>();
    for (let i = 0; i < gr.length; i++) {
      const z = zeilen[i] as number;
      // Deterministisch: die Zeilennummer selbst ist der Schluesselzusatz.
      // Dieselben Bloecke in derselben Reihenfolge ergeben dieselben Indizes.
      zusatz.set(gr[i], "@z" + z);
      if (!gesehen.has(z)) {
        gesehen.add(z);
        fall.gruppen.push({
          zeile: z,
          schluessel: blockNr + ":" + alt + "@z" + z,
          text: String(gr[i]?.original_text ?? gr[i]?.original_label ?? ""),
        });
      }
    }
    faelle.push(fall);
  }
  return zusatz;
}


function fuegeZusammen(
  teilergebnisse: { blockNr: number; daten: any; text?: string }[],
  abgebrocheneBloecke: number[],
  unteilbareBloecke: number[],
  blockAnzahl: number,
): Merged {
  const sections = new Map<string, any>();
  const items: any[] = [];
  const indexProblem = new Set<string>();
  // (section_key) -> Map(schluessel "block:lokal" -> globaler Index)
  const globalIndex = new Map<string, Map<string, number>>();
  // v18: je Trennung ein Fall. Wird nach der Indexvergabe zu Protokollzeilen —
  // die NEUEN row_index stehen erst dann fest.
  const trennFaelle: TrennFall[] = [];
  let uid = 0;

  for (const { blockNr, daten, text } of teilergebnisse) {
    const tItems: any[] = Array.isArray(daten?.items) ? daten.items : [];
    const tSections: any[] = Array.isArray(daten?.sections) ? daten.sections : [];

    // v18 · ROW-INDEX-RIEGEL (Abschnitt 3c). Er entscheidet VOR der Indexvergabe,
    // welche items einer lokalen Zeilennummer aus verschiedenen physischen
    // Quellzeilen stammen, und haengt genau denen eine Zeilenkennung an den
    // Mappingschluessel. Die Vergabe darunter erledigt die Trennung dann selbst.
    const zeilenZusatz = zeileTrennen(tItems, String(text ?? ""), blockNr, trennFaelle);

    for (const it of tItems) {
      const key = String(it?.section_key ?? "unresolved");
      if (!globalIndex.has(key)) globalIndex.set(key, new Map());
      const karte = globalIndex.get(key)!;

      const lokalRoh = Number(it?.row_index);
      const lokalOk = isFinite(lokalRoh) && lokalRoh > 0;
      if (!lokalOk) indexProblem.add(key);

      // Mehrere items derselben Quellzeile teilen sich denselben globalen
      // Index — genau darum wird über (block, lokal) gemappt und nicht gezählt.
      // v18: der Zusatz ist "" — ausser der Riegel hat fuer dieses item eine
      // eigene Quellzeile nachgewiesen. Dann trennt schon der Schluessel.
      const schluessel = blockNr + ":" + (lokalOk ? lokalRoh : "x" + (karte.size + 1))
                       + (zeilenZusatz.get(it) ?? "");
      if (!karte.has(schluessel)) karte.set(schluessel, karte.size + 1);
      const row = karte.get(schluessel)!;

      // NACHZUG 2 aus ChatGPTs Gegenprüfung: item_uid wird beim Merge GLOBAL
      // und deterministisch neu vergeben — fortlaufend über alle Blöcke, in
      // Verarbeitungsreihenfolge. Der vom Modell gelieferte Wert wird bewusst
      // VERWORFEN, nicht übernommen: jeder Block beginnt bei "i1", und
      // ux_source_extraction_item_run_uid UNIQUE (run_id, item_uid) würde beim
      // Persistieren kollidieren.
      // Deterministisch heisst: dieselben Blöcke in derselben Reihenfolge
      // erzeugen dieselben uids. Keine Zufallszahl, kein Zeitstempel.
      uid++;
      items.push({ ...it, section_key: key, row_index: row, item_uid: "i" + uid });
    }

    for (const se of tSections) {
      const key = String(se?.section_key ?? "unresolved");
      const alt = sections.get(key);
      const exp = Number(se?.expected_rows);
      const ext = Number(se?.extracted_rows);
      const st = normStatus(se?.status);
      const notiz = [se?.note, st.hinweis].filter(Boolean).join(" | ") || null;
      if (!alt) {
        sections.set(key, {
          section_key: key,
          section_label: se?.section_label ?? null,
          expected_rows: isFinite(exp) ? exp : null,
          extracted_rows: isFinite(ext) ? ext : null,
          status: st.status,
          note: notiz,
          _ersterBlock: blockNr,
        });
      } else {
        // A4d, gemessen 17.08. an P1023 und P1700: zwei Modellschätzungen über
        // Teilausschnitte ergeben ADDIERT keine gültige Zahl. Bei P1700 stand
        // dort 23 erwartet gegen 22 geliefert — die externe Zählung sagt 22,
        // RIKI hat also richtig gelesen und falsch geschätzt.
        // Deshalb: expected_rows wird bei geteilten Abschnitten VERWORFEN,
        // nicht summiert. Keine Zahl ist ehrlicher als eine addierte Schätzung
        // (§1.2 — RIKIs Selbstauskunft beweist ohnehin keine Vollständigkeit).
        alt.expected_rows = null;
        // Nur wenn der Abschnitt WIRKLICH über Blockgrenzen lief. Gefunden am
        // 17.08. an P73616: dort meldete ein Ein-Block-Lauf denselben
        // section_key zweimal, und die Note behauptete "lief ueber mehrere
        // Bloecke". Eine Begründung, die nicht stimmt, ist schlimmer als keine.
        if (blockNr !== alt._ersterBlock) alt.expected_rows_verworfen = true;
        else alt.expected_rows_mehrfach_im_block = true;
        alt.extracted_rows = summe(alt.extracted_rows, isFinite(ext) ? ext : null);
        alt.status = schlechtererStatus(alt.status, st.status);
        alt.note = [alt.note, notiz].filter(Boolean).join(" | ") || null;
        if (!alt.section_label && se?.section_label) alt.section_label = se.section_label;
      }
    }
  }

  // §2.7 / §8.4: ein technischer Abbruch darf NIE als complete enden. Eigener
  // sichtbarer Eintrag statt stillem Färben eines bestehenden Abschnitts.
  // Status "unreadable" — gemessen zulässig, "unresolved" wäre es nicht.
  if (abgebrocheneBloecke.length || unteilbareBloecke.length) {
    const teile: string[] = [];
    if (abgebrocheneBloecke.length) {
      teile.push(`Block ${abgebrocheneBloecke.join(", ")} von ${blockAnzahl} am Ausgabelimit abgeschnitten und verworfen.`);
    }
    if (unteilbareBloecke.length) {
      teile.push(`Block ${unteilbareBloecke.join(", ")} von ${blockAnzahl} war zu gross und ohne Trennzeichen nicht teilbar.`);
    }
    sections.set("nicht_gelesen", {
      section_key: "nicht_gelesen",
      section_label: "Nicht gelesen",
      expected_rows: null,
      extracted_rows: null,
      status: "unreadable",
      note: teile.join(" ") + " Die Zeilen dieser Bloecke FEHLEN im Ergebnis. Das ist kein vollstaendiger Lauf.",
    });
  }

  // Nachlauf: extracted_rows aus dem tatsächlichen Bestand neu zählen.
  // ChatGPTs Einwand 3: DISTINCT QUELLZEILEN, nicht Items. Eine Quellzeile mit
  // kJ und kcal liefert zwei items und bleibt EINE Zeile.
  for (const [key, se] of sections) {
    if (key === "nicht_gelesen") continue;
    const rows = new Set(
      items.filter((x) => String(x.section_key) === key).map((x) => Number(x.row_index)),
    );
    se.extracted_rows = rows.size;

    if (indexProblem.has(key)) {
      se.status = schlechtererStatus(se.status, "partial");
      se.note = [se.note, "Ein Block lieferte unbrauchbare row_index-Werte. Nicht repariert, Abschnitt gilt als unvollstaendig."]
        .filter(Boolean).join(" | ");
    }
    delete se._ersterBlock;
    if (se.expected_rows_verworfen || se.expected_rows_mehrfach_im_block) {
      // Ohne expected_rows kann der Abgleich hier nichts beweisen — das
      // übernimmt das externe Soll. Der Status wird deshalb NICHT auf partial
      // gesetzt: eine fehlende Selbstauskunft ist kein Befund.
      const grund = se.expected_rows_verworfen
        ? "Abschnitt lief ueber mehrere Bloecke"
        : "Abschnitt wurde im selben Block mehrfach gemeldet";
      se.note = [se.note,
        `${grund}; expected_rows verworfen statt addiert. ` +
        `${rows.size} Zeilen im Bestand. Vollstaendigkeit nur gegen externes Soll pruefbar.`]
        .filter(Boolean).join(" | ");
      delete se.expected_rows_verworfen;
      delete se.expected_rows_mehrfach_im_block;
    } else if (se.expected_rows != null && se.expected_rows !== rows.size) {
      se.status = schlechtererStatus(se.status, "partial");
      se.note = [se.note, `Merge-Gegenprobe: ${se.expected_rows} erwartet, ${rows.size} Zeilen im Bestand.`]
        .filter(Boolean).join(" | ");
    }
  }

  // v18 · PROTOKOLL DER TRENNUNGEN (§1.7 — keine stillen Eingriffe).
  // Erst hier, weil die neuen globalen row_index erst nach der Vergabe feststehen.
  // Passiert nichts, bleibt die Liste leer.
  const zeilenGetrennt: string[] = [];
  for (const f of trennFaelle) {
    const karte = globalIndex.get(f.section_key);
    const neu = f.gruppen.map((g) => String(karte?.get(g.schluessel) ?? "?")).join(", ");
    const texte = f.gruppen
      .map((g) => `Quellzeile ${g.zeile}: "${g.text.slice(0, 70)}"`)
      .join("  +  ");
    zeilenGetrennt.push(
      `Block ${f.blockNr}, section_key "${f.section_key}": row_index ${f.alt} trug ` +
      `${f.gruppen.length} verschiedene Quellzeilen -> neue row_index ${neu}. ${texte}`,
    );
  }

  return {
    contract_version: "riki_source_extraction_item_v1",
    sections: [...sections.values()],
    items,
    chunking: {
      bloecke: blockAnzahl,
      // v18 · eine Zeile je getrenntem row_index; leer, wenn nichts getrennt wurde.
      zeilen_getrennt: zeilenGetrennt,
      abgebrochen: abgebrocheneBloecke,
      unteilbar: unteilbareBloecke,
      // ChatGPTs Einwand 3, zweiter Teil: dieser Name sagt AUSDRÜCKLICH nur,
      // dass technisch alle Blöcke durchliefen. Er sagt NICHT, dass das
      // Etikett fachlich vollständig gelesen wurde — das entscheidet weiter
      // allein das externe Soll der 14er-Suite (§1.1, §1.2).
      technisch_vollstaendig: abgebrocheneBloecke.length === 0 && unteilbareBloecke.length === 0,
    },
  };
}

// Übernimmt aus dem Nachschlag NUR die Items, die eine der gemeldeten Zeilen
// abdecken — und auch die nur, wenn ihr Text wirklich im Block steht.
// Ohne diese zwei Riegel würde der Nachschlag zur zweiten Erfindungsquelle:
// das Modell bekommt eine Liste vorgesetzt und neigt dazu, sie zu bedienen.
function uebernimmNachschlag(ziel: any, nach: any, fehlend: string[], quelle: string): number {
  if (!nach || !Array.isArray(nach.items)) return 0;
  const zielItems: any[] = Array.isArray(ziel?.items) ? ziel.items : (ziel.items = []);
  const quelleNorm = vglNorm(quelle);
  const gesucht = fehlend.map((f) => vglNorm(f.replace(/^Block \d+: /, "").replace(/^"|"$/g, "")));
  const schonDa = new Set(zielItems.map((x) => vglNorm(x?.original_text || x?.original_label)));

  let n = 0;
  for (const it of nach.items) {
    const txt = vglNorm(it?.original_text || it?.original_label);
    if (!txt || txt.length < 4) continue;
    if (schonDa.has(txt)) continue;                                   // keine Dublette
    if (!gesucht.some((g) => g.includes(txt) || txt.includes(g))) continue;  // nicht angefordert
    if (!quelleNorm.includes(txt)) continue;                          // nicht im Quelltext
    it.note = [it?.note, "Im Nachschlag ergaenzt: der erste Durchgang hatte diese Zeile ausgelassen."]
      .filter(Boolean).join(" | ");
    zielItems.push(it);
    schonDa.add(txt);
    n++;
  }
  return n;
}

function summe(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

// NACHZUG 1 aus ChatGPTs Gegenprüfung vom 17.08. 20:20 — "unresolved
// semantisch erhalten".
//
// Der Stand davor bog "unresolved" nach "unreadable" um, weil der CHECK den
// Wert nicht kannte. ChatGPT hat das Schema inzwischen erweitert; nachgemessen:
//   status ∈ open|complete|partial|unresolved|unreadable|not_applicable
// Damit ist das Umbiegen nicht mehr nur überflüssig, sondern FALSCH — es hätte
// zwei verschiedene Aussagen zu einer gemacht:
//   unresolved = gelesen, aber fachlich nicht zuzuordnen (ALN-2: "Abschnitt
//                Allergene ist nicht in der Routing-Tabelle definiert")
//   unreadable = nicht lesbar, die Zeilen fehlen
// Genau diese Unterscheidung braucht §8.5: echte fachliche Zweifel dürfen
// bleiben, stille Datenverluste nicht.
const SECTION_STATUS = ["open", "complete", "partial", "unresolved", "unreadable", "not_applicable"] as const;

// Gibt den zu speichernden Status UND einen Hinweis zurück, falls der
// Originalwert nicht übernommen werden konnte. Der Hinweis wandert in die
// note — ein umgebogener Wert ohne Spur wäre eine stille Änderung.
function normStatus(v: any): { status: string; hinweis: string | null } {
  const roh = String(v ?? "open").trim();
  const s = roh.toLowerCase();
  if ((SECTION_STATUS as readonly string[]).includes(s)) return { status: s, hinweis: null };
  // Fail-closed: ein unbekannter Wert wird zur schlechteren Aussage, nie zur
  // besseren — und sagt, dass er umgebogen wurde.
  return {
    status: "unreadable",
    hinweis: `Modell meldete unbekannten Status "${roh}"; als unreadable gewertet (fail-closed).`,
  };
}

// Rangfolge, schlechtester gewinnt, fail-closed. Ein "complete" darf ein
// "partial" nie überschreiben — sonst verschwindet die Lücke beim Merge.
// Unbekannte Werte bekommen den schlechtesten Rang, nicht den besten.
//
// unresolved steht ÜBER partial und UNTER unreadable: ein fachlich offener
// Abschnitt ist schlimmer als ein teilweise gelesener, aber besser als einer,
// dessen Zeilen ganz fehlen.
function schlechtererStatus(a: string, b: string): string {
  const rang: Record<string, number> = {
    not_applicable: 0, complete: 1, open: 2, partial: 3, unresolved: 4, unreadable: 5,
  };
  const ra = rang[a] ?? 5;
  const rb = rang[b] ?? 5;
  const gewinner = rb > ra ? b : a;
  // Ein unbekannter Wert darf nicht als Status HINAUSGEHEN, auch wenn er
  // korrekt als schlechtester eingestuft wurde — sonst scheitert die
  // Persistenz am CHECK. Gefunden in der Gegenprobe zu Nachzug 1:
  // schlechtererStatus("complete","quatsch") lieferte "quatsch".
  return (rang[gewinner] === undefined) ? "unreadable" : gewinner;
}


// ---------------------------------------------------------------------------
// 5 · DER GEÄNDERTE AUFRUFZWEIG
// ---------------------------------------------------------------------------
// Ersetzt in v15 den einen fetch-Aufruf für modus === "rohtext".
// Ein Block  -> identisches Verhalten wie v15, inklusive v13-Riegel.
// Mehrere    -> Blöcke nacheinander, Ergebnisse gemergt, jeder Block einzeln
//               gebucht (Riki_Nutzung bildet den echten Verbrauch ab).
async function laufRohtext(opts: {
  key: string;
  modell: string;
  systemText: string;
  text: string;
  name?: string;
  quelle?: string;
  buche: (inTok: number, outTok: number, kosten: number, erfolg: boolean, fehler: string | null) => Promise<void>;
  preis: { in: number; out: number };
}) {
  const bloecke = teileRohtext(opts.text, ROHTEXT_ITEMS_JE_BLOCK);
  // v18: der Blocktext wandert MIT. Der row_index-Riegel braucht die physischen
  // Zeilen genau des Blocks, den dieses Teilergebnis gesehen hat — gegen den
  // Gesamttext geprueft waere er wertlos, wie schon der Quelltext-Abgleich.
  const teilergebnisse: { blockNr: number; daten: any; text: string }[] = [];
  const abgebrochen: number[] = [];
  const unteilbar: number[] = [];
  const befundeErfunden: string[] = [];
  const befundeUebersprungen: string[] = [];
  const nachgeholtProtokoll: string[] = [];
  let nachgeschlagen = 0;
  let inSum = 0, outSum = 0, kostenSum = 0;

  for (let i = 0; i < bloecke.length; i++) {
    const nr = i + 1;
    const b = bloecke[i];
    const e = await einBlock(b, nr, bloecke.length);

    if (e.truncated) {
      // Rettung: den Block eine Stufe tiefer schneiden. Einmal, nicht rekursiv.
      const feiner = b.text.includes("\n")
        ? teileAbsatzNachZeilen(b.text, Math.max(8, Math.floor(ROHTEXT_ITEMS_JE_BLOCK / 2)))
        : teileEinzelzeile(b.text, b.ueberschrift, Math.max(8, Math.floor(ROHTEXT_ITEMS_JE_BLOCK / 2)));

      if (feiner.length > 1) {
        let alleOk = true;
        const zwischen: { daten: any; text: string }[] = [];
        for (const f of feiner) {
          const e2 = await einBlock(f, nr, bloecke.length);
          if (e2.truncated || !e2.parsed) { alleOk = false; break; }
          zwischen.push({ daten: e2.parsed, text: f.text });
        }
        if (alleOk) { for (const d of zwischen) teilergebnisse.push({ blockNr: nr, daten: d.daten, text: d.text }); continue; }
      } else if (b.stufe === 4) {
        unteilbar.push(nr);
        continue;
      }
      abgebrochen.push(nr);
      continue;
    }
    if (e.parsed) {
      // v16.2: der Quelltext-Abgleich läuft JE BLOCK, gegen genau den Text,
      // den dieser Block gesehen hat. Über den Gesamttext geprüft wäre er
      // wertlos — dann fände jede Erfindung irgendwo einen Treffer.
      const vorher: string[] = [];
      pruefeGegenQuelltext(e.parsed, b.text, nr, befundeErfunden, vorher);

      // v16.3 NACHSCHLAG: der Riegel weiß, WELCHE Zeile fehlt — also fordert er
      // sie gezielt nach, statt sie nur zu melden. Genau EIN zusätzlicher
      // Versuch je Block; ein zweiter würde bei einem hartnäckigen Fall in eine
      // Schleife laufen und die Kosten vervielfachen.
      if (vorher.length) {
        const nach = await einBlockNachschlag(b, nr, bloecke.length, vorher);
        const neue = uebernimmNachschlag(e.parsed, nach, vorher, b.text);
        nachgeschlagen += neue;
        // Erneut prüfen: was jetzt noch fehlt, fehlt wirklich.
        const rest: string[] = [];
        pruefeGegenQuelltext(e.parsed, b.text, nr, befundeErfunden, rest);
        for (const r of rest) befundeUebersprungen.push(r);
        for (const v of vorher) {
          if (!rest.includes(v)) nachgeholtProtokoll.push(v);
        }
      }
      teilergebnisse.push({ blockNr: nr, daten: e.parsed, text: b.text });
    }
    else abgebrochen.push(nr);
  }

  if (!teilergebnisse.length) {
    return {
      ergebnis: null, inTok: inSum, outTok: outSum, kosten: kostenSum,
      fehler: `Alle ${bloecke.length} Bloecke unlesbar (abgebrochen: ${abgebrochen.join(",") || "-"}, ` +
              `unteilbar: ${unteilbar.join(",") || "-"}). Kein Teilergebnis brauchbar.`,
    };
  }

  const ergebnis = fuegeZusammen(teilergebnisse, abgebrochen, unteilbar, bloecke.length);

  // v16.3: kJ/kcal erst NACH dem Merge aufspalten — dort sind die item_uid
  // schon global vergeben, und die neuen bekommen die nächsten freien.
  const gespalten = spalteEnergie(ergebnis.items, ergebnis.items.length);
  ergebnis.items = gespalten.items;
  ergebnis.chunking.energie_ergaenzt = gespalten.ergaenzt;

  ergebnis.chunking.erfunden_verworfen = befundeErfunden;
  ergebnis.chunking.uebersprungene_zeilen = befundeUebersprungen;
  ergebnis.chunking.nachgeschlagen = nachgeschlagen;
  ergebnis.chunking.nachgeholt = nachgeholtProtokoll;
  // technisch_vollstaendig sagt weiterhin NUR etwas über die Blöcke aus.
  // Der Quelltext-Abgleich bekommt sein eigenes Feld — er ist eine fachliche
  // Aussage, keine technische.
  ergebnis.chunking.quelltext_abgleich_sauber =
    befundeErfunden.length === 0 && befundeUebersprungen.length === 0;

  return {
    ergebnis,
    inTok: inSum, outTok: outSum, kosten: kostenSum, fehler: null,
  };

  // v16.3 NACHSCHLAG. Derselbe Systemprompt, derselbe Block — nur mit der
  // konkreten Liste dessen, was fehlt. Das ist der Unterschied zwischen
  // "melden" und "schließen": der Riegel weiß die Zeile, also kann er sie
  // zitieren statt nur zu zählen.
  async function einBlockNachschlag(b: Block, nr: number, von: number, fehlend: string[]) {
    const zeilen = fehlend
      .map((f) => f.replace(/^Block \d+: /, "").replace(/^"|"$/g, ""))
      .slice(0, 12);

    const hinweis =
      `NACHSCHLAG zu Block ${nr}${von > 1 ? " von " + von : ""}. Ein vorheriger Durchgang hat ` +
      `folgende Zeilen des Quelltextes NICHT ausgegeben:\n` +
      zeilen.map((z) => `  - ${z}`).join("\n") + `\n\n` +
      `Gib AUSSCHLIESSLICH diese Zeilen aus, mit derselben Struktur wie sonst. ` +
      `Ist eine davon KEINE fachliche Datenzeile — etwa eine Fussnote, eine Ueberschrift ` +
      `oder eine Mengenangabe zur Packung — dann gib sie mit extraction_status "unresolved" ` +
      `und einer Begruendung in note aus. Erfinde nichts und ergaenze keine anderen Zeilen.\n\n`;

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": opts.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.modell,
        max_tokens: 4000,
        system: [{ type: "text", text: opts.systemText, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [{ type: "text", text:
          hinweis + `Der Quelltext dieses Blocks lautet:\n\n${b.text}` }] }],
      }),
    });

    const j = await ai.json();
    const u: any = j?.usage ?? {};
    const inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    const outTok = u.output_tokens ?? 0;
    const kosten = (inTok / 1e6) * opts.preis.in + (outTok / 1e6) * opts.preis.out;
    inSum += inTok; outSum += outTok; kostenSum += kosten;

    if (!ai.ok || j.stop_reason === "max_tokens") {
      await opts.buche(inTok, outTok, 0, false, `Nachschlag Block ${nr} fehlgeschlagen`);
      return null;
    }
    await opts.buche(inTok, outTok, Number(kosten.toFixed(6)), true, null);

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    try {
      const m = text.match(/\{[\s\S]*\}/);
      return JSON.parse(m ? m[0] : text);
    } catch (_e) { return null; }
  }

  async function einBlock(b: Block, nr: number, von: number) {
    // Der Hinweissatz steht im BENUTZERTEXT, nicht im Regelwerk. Ohne ihn
    // zählt das Modell expected_rows für einen Text, den es nur zum Teil sieht.
    let hinweis = "";
    if (von > 1) {
      hinweis =
        `Dies ist Block ${nr} von ${von} eines laengeren Quelltextes. Beurteile AUSSCHLIESSLICH ` +
        `die Abschnitte in diesem Block. expected_rows zaehlt nur die Zeilen, die HIER sichtbar sind.\n`;
    }
    if (b.ueberschrift) {
      // Kontext, KEIN Quelltext. Die Überschrift wird nicht in den Text
      // hineingeschrieben — ein erfundener Quelltext waere eine Faelschung.
      //
      // A4b: Der Kopf traegt jetzt auch die SPALTENUEBERSCHRIFT. Ohne sie hat
      // der Folgeblock keine Bezugsbasis und muss basis_key "unresolved"
      // setzen — gemessen am 17.08. an vier Aminosaeuren in P73617.
      hinweis +=
        `KONTEXT, nicht Teil des Quelltextes: die folgenden Zeilen stehen in der Quelle unter ` +
        `"${b.ueberschrift}"` +
        (b.fortsetzungAbZeile ? `, fortgesetzt ab Zeile ${b.fortsetzungAbZeile}` : "") +
        `. Steht dort eine Spaltenbeschriftung, gilt sie AUCH FUER DIESEN BLOCK — setze basis_key ` +
        `und basis_label danach, statt sie als unresolved zu melden. Gib die Kontextzeile NICHT ` +
        `als eigene Zeile aus.\n`;
    }
    if (hinweis) hinweis += "\n";

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": opts.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.modell,
        max_tokens: ROHTEXT_MAX_TOKENS,
        system: [{ type: "text", text: opts.systemText, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [{ type: "text", text:
          hinweis +
          `Zerlege diesen kopierten Quelltext in Abschnitte und Zeilen:\n\n${b.text}\n\n` +
          (opts.name ? `Produktname: ${opts.name}\n` : "") +
          (opts.quelle ? `Quelle: ${opts.quelle}\n` : "") }] }],
      }),
    });

    const j = await ai.json();
    const u: any = j?.usage ?? {};
    const inTok = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    const outTok = u.output_tokens ?? 0;
    const kosten = (inTok / 1e6) * opts.preis.in + (outTok / 1e6) * opts.preis.out;
    inSum += inTok; outSum += outTok; kostenSum += kosten;

    if (!ai.ok) {
      await opts.buche(inTok, outTok, 0, false, JSON.stringify(j).slice(0, 400));
      return { truncated: false, parsed: null };
    }

    // v13-RIEGEL BLEIBT — er wirkt jetzt je Block statt für den ganzen Lauf.
    if (j.stop_reason === "max_tokens") {
      await opts.buche(inTok, outTok, 0, false, `stop_reason max_tokens in Block ${nr}/${von} - verworfen`);
      return { truncated: true, parsed: null };
    }

    await opts.buche(inTok, outTok, Number(kosten.toFixed(6)), true, null);

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    try {
      const m = text.match(/\{[\s\S]*\}/);
      return { truncated: false, parsed: JSON.parse(m ? m[0] : text) };
    } catch (_e) {
      return { truncated: false, parsed: null };
    }
  }
}


// ---------------------------------------------------------------------------
// 5b · DER ABGLEICH SELBST
// ---------------------------------------------------------------------------
// Ändert das Ergebnis in genau zwei Punkten und macht sonst nur sichtbar:
//   1. Ein Item, dessen Text nicht im Quellblock steht, wird auf
//      extraction_status "unresolved" gesetzt und bekommt eine Note. Es wird
//      NICHT gelöscht — Löschen wäre eine zweite stille Änderung.
//   2. basis_key wird gegen die erlaubte Schemaliste geprüft. Ein erfundener
//      Wert wie "pro_10g" oder "pro_3_kapseln" wird zu "other", der
//      Originalwert wandert nach basis_label. Gemessen am 17.08.: beide Werte
//      traten auf, "pro_10g" sogar in einem Ein-Block-Lauf — es ist also kein
//      Chunking-Effekt, sondern eine Luecke im Prompt, die hier abgefangen
//      wird, ohne den Prompt zu aendern (§24 bleibt damit unberuehrt).
const BASIS_KEYS = ["pro_100g","pro_100ml","pro_portion","daily_dose","per_container","other","unresolved"];

// v16.7 / D3 — WO EINE ZUTAT STEHT, ENTSCHEIDET, OB SIE EINE IST.
//
// D1 prüft den WORTLAUT eines Items ("Allergene:", "kann Spuren von"). Der
// zweite Testsatz hat gezeigt, dass das nicht reicht — RIKI löst den
// Spurenhinweis auf und liefert die Allergene als nackte Namen:
//   P1593  Zeile 9  der ganze Hinweisblock als EINE Zutat, Wortlaut
//                   "kann enthalten" OHNE "Spuren" — D1 greift nicht
//   P1532  Zeile 15 "SOJA"
//          Zeile 16 "MANDELN, HASELNÜSSE, WALNÜSSE, PEKANNÜSSE"
//   P1391  Zeile 18 "SOJA"
//          Zeile 19 "weitere SCHALENFRÜCHTE (NÜSSE)"
// An "SOJA" allein ist textlich nichts zu erkennen. Sojalecithin IST eine
// Zutat, SOJA im Spurenhinweis ist keine.
//
// Der Unterschied ist die POSITION: steht der Text im Quellblock
// ausschliesslich HINTER dem Spurenmarker, gehört er zum Kleingedruckten.
// Dieselbe Markerliste wie in zaehleTopLevelZutaten() — eine Regel, ein Ort.
const SPUREN_MARKER =
  /\b(?:kann(?:en)?\s+(?:Spuren\s+)?enthalten|kann\s+Spuren\s+von|Allergene\s*:|Laktosegehalt)/i;

function nurImKleingedruckten(text: string, quelle: string): boolean {
  const m = quelle.search(SPUREN_MARKER);
  if (m < 0) return false;                       // kein Hinweisteil vorhanden
  const nadel = vglNorm(text);
  if (nadel.length < 3) return false;
  const vorne = vglNorm(quelle.slice(0, m));
  const hinten = vglNorm(quelle.slice(m));
  // Nur wenn der Text HINTEN vorkommt und VORNE nicht.
  return hinten.includes(nadel) && !vorne.includes(nadel);
}

// ChatGPT-Entscheid 18.08.2026 zu B-Punkt 1, wörtlich umgesetzt:
// "behalten-und-markieren im Extraktionsprotokoll, aber NIEMALS fachlich
//  weiterpersistieren." Ein erfundenes Item bleibt als Auditbeleg erhalten,
// trägt extraction_status "unresolved" UND persistence_status "not_persisted"
// und blockiert damit den Green-Gate (§6.8). Löschen wäre schlechter — dann
// verschwände gerade der Beleg, warum der Lauf nicht grün werden darf.
// ===========================================================================
// v39 · ALLERGENE SIND EIGENE ITEMS - weder Zutat noch "unresolved"  (Work E1)
// ===========================================================================
// Bis v38 endete jeder Allergenhinweis auf semantic_class "unresolved"; der
// D1/D3-Riegel weiter unten bog ihn dorthin um. Das war richtig gegen "wird
// zur Zutat" und falsch gegen "wird gar nichts".
//
// GEMESSEN am 20.08.2026 per pg_get_functiondef - der Riegel in
// public.cb_riki_source_extraction_speichern, Contract
// riki_source_extraction_item_v1, verlangt bei semantic_class = 'allergen'
// WOERTLICH alle drei:
//     if coalesce(i->>'section_key','') <> 'allergene'   -> Exception
//     if coalesce(i->>'target_kind','') <> 'Allergene'   -> Exception
//     if v_claim not in ('enthalten','spuren')           -> Exception
// mit v_claim := nullif(btrim(coalesce(i->'attributes'->>'allergen_claim','')),'').
// Eine Exception verwirft den GANZEN Lauf, nicht nur das Item. Deshalb ist hier
// alles fail-closed: was sich nicht sicher bestimmen laesst, wird KEIN
// Allergen-Item, sondern bleibt ein offener Beleg mit extraction_status
// "needs_review" (Vertrag §2.6).
//
// GEGENSTUECK, ebenfalls gemessen: cb_riki_allergene_persistieren(run_id) loest
// ueber cb_allergen_alias_auflosen() auf, und zwar in dieser Reihenfolge:
//   coalesce(nullif(original_label,''), nullif(item_key,''), original_text)
// Der Resolver vergleicht EXAKT auf einer voll gestrippten Normalform. Also
// gehoert in original_label DER EINE ALLERGENNAME und nicht der ganze Satz;
// der Satz steht verlustfrei in original_text. Eine Namensliste wird hier NICHT
// nachgebaut - sie liegt in shadow_v1.allergen_alias und gehoert dorthin (§4.2).
//
// enthalten und spuren sind zwei verschiedene Aussagen. "Kann Spuren von Milch
// enthalten" warnt vor Kreuzkontamination; "Allergene: Milch" beschreibt die
// Zusammensetzung. Wer beides gleichsetzt, macht aus einer Warnung eine Zutat -
// genau der Fehler, den D1 am 18.08. behoben hat.
const ALLERGEN_SECTION = "allergene";
const ALLERGEN_TARGET  = "Allergene";
const ALLERGEN_CLAIMS  = ["enthalten", "spuren"];
const ALLERGEN_STATUS  = ["extracted", "unresolved", "needs_review"];

// Die Marker, an denen ein Allergenhinweis BEGINNT, samt ihrer Claim-Bedeutung.
// Dieselbe Familie wie SPUREN_MARKER und zaehleTopLevelZutaten() - nur feiner,
// weil hier zusaetzlich unterschieden werden muss, WELCHE Aussage der Marker
// traegt. SPUREN_MARKER bleibt unveraendert und behaelt seine Aufgabe (§4.2:
// er beantwortet "gehoert der Text ins Kleingedruckte", diese Liste "welcher
// Claim gilt ab hier").
const ALLERGEN_MARKER_QUELLE =
  "kann(?:en)?\\s+(?:das\\s+Produkt\\s+)?(?:auch\\s+)?(?:geringe\\s+)?(?:Spuren\\s+(?:von\\s+)?)?enthalten" +
  "|kann(?:en)?\\s+(?:auch\\s+)?Spuren\\s+von" +
  "|kann(?:en)?\\s+folgende\\s+Spuren(?:\\s+enthalten)?" +
  "|Spuren\\s+von" +
  "|hergestellt\\s+in\\s+einem\\s+Betrieb,?\\s*(?:der|in\\s+dem|wo)\\s+(?:auch\\s+)?" +
  "|Allergenhinweise?\\s*:" +
  "|Allergeninformationen?\\s*:" +
  "|Allergene?\\s*:" +
  "|Enth[äa]lt\\b\\s*:?";

// Woerter, die eine Aussage AUFWEICHEN. Sie machen den Claim mehrdeutig:
// "Enthaelt moeglicherweise Sellerie" ist weder "enthalten" noch "spuren".
// Solche Faelle werden NICHT geraten (§1.1), sondern needs_review.
const CLAIM_UNKLAR =
  /\b(?:m[öo]glicherweise|eventuell|ggfs?\.?|gegebenenfalls|unter\s+Umst[äa]nden|vermutlich|womoeglich|wom[öo]glich)\b/gi;

function claimZuMarker(m: string): string {
  // "kann ... enthalten", "kann Spuren von", "Spuren von", "hergestellt in
  // einem Betrieb" beschreiben Kreuzkontamination. "Allergene:", "Enthaelt"
  // beschreiben die Zusammensetzung.
  if (/^kann/i.test(m) || /spuren/i.test(m) || /betrieb/i.test(m)) return "spuren";
  return "enthalten";
}

function allergenMarkerListe(s: string): { pos: number; ende: number; claim: string; text: string }[] {
  const re = new RegExp("(?:" + ALLERGEN_MARKER_QUELLE + ")", "gi");
  const out: { pos: number; ende: number; claim: string; text: string }[] = [];
  for (const m of String(s ?? "").matchAll(re)) {
    const pos = m.index ?? -1;
    if (pos < 0) continue;
    out.push({ pos, ende: pos + m[0].length, claim: claimZuMarker(m[0]), text: m[0] });
  }
  return out;
}

// Trennt eine Aufzaehlung auf OBERSTER Ebene. Dieselben Trennregeln wie
// zaehleTopLevelZutaten(): Komma und Semikolon ausserhalb jeder Klammer, kein
// Dezimalkomma. Zusaetzlich "und" / "oder" / "sowie" - die stehen in
// Allergenlisten regelmaessig vor dem letzten Eintrag.
//
// NICHT getrennt wird vor der EU-Standardformel "X und daraus hergestellte
// Erzeugnisse" (LMIV Anhang II). Sonst entstuende aus EINEM Allergen ein
// zweites namens "daraus hergestellte Erzeugnisse" - eine erfundene Angabe.
function teileAllergenAufzaehlung(s: string): string[] {
  const t = String(s ?? "");
  const out: string[] = [];
  const nimm = (a: number, b: number) => { const x = t.slice(a, b).trim(); if (x) out.push(x); };
  let tiefe = 0, start = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "(" || c === "[") { tiefe++; continue; }
    if (c === ")" || c === "]") { tiefe = Math.max(0, tiefe - 1); continue; }
    if (tiefe !== 0) continue;
    if (c === "," || c === ";") {
      const davor = t[i - 1] ?? "", danach = t[i + 1] ?? "";
      if (/\d/.test(davor) && /\d/.test(danach)) continue;   // Dezimalkomma trennt nichts
      nimm(start, i); start = i + 1; continue;
    }
    const m = /^\s+(?:und|oder|sowie)\s+/i.exec(t.slice(i));
    if (m) {
      const rest = t.slice(i + m[0].length);
      if (/^(?:daraus|hieraus|davon|deren|Erzeugnisse|Produkte|-?erzeugnisse)/i.test(rest)) {
        i += m[0].length - 1; continue;                      // EU-Standardformel
      }
      nimm(start, i);
      start = i + m[0].length;
      i += m[0].length - 1;
      continue;
    }
  }
  nimm(start, t.length);
  return out;
}

// Aus einem Aufzaehlungsglied den ALLERGENNAMEN herausloesen. Was abgetrennt
// wird, geht nicht verloren: es wandert nach attributes.allergen_zusatz, und
// der vollstaendige Satz steht ohnehin in original_text.
//
// Abgetrennt werden nur FESTE FORMELN und Klammerzusaetze - kein Wortstamm,
// keine Aehnlichkeit, keine Vermutung (§3.5). "WEIZENMEHL" bleibt
// "WEIZENMEHL"; ob daraus "Weizen" wird, entscheidet shadow_v1.allergen_alias
// und nicht diese Funktion.
function saeubereAllergenwort(s: string): { label: string; zusatz: string | null } {
  let t = String(s ?? "").trim();
  let zusatz: string | null = null;
  t = t.replace(/^(?:und|oder|sowie|auch|von|weitere[rsn]?|andere[rsn]?|sonstige[rsn]?)\s+/i, "").trim();
  const eu = t.match(/\s+(?:und|sowie)\s+(?:daraus\s+|hieraus\s+)?(?:hergestellte\s+)?Erzeugnisse(?:\s+daraus)?|\s+und\s+-?erzeugnisse/i);
  if (eu && eu.index !== undefined) { zusatz = t.slice(eu.index).trim(); t = t.slice(0, eu.index).trim(); }
  const kl = t.match(/\s*\(([^()]*)\)\s*$/);
  if (kl && kl.index !== undefined) {
    zusatz = [kl[1].trim(), zusatz].filter(Boolean).join(" | ");
    t = t.slice(0, kl.index).trim();
  }
  t = t.replace(/^[\s.;:,*†‡•-]+/, "").replace(/[\s.;:,*†‡•]+$/, "").trim();
  return { label: t, zusatz: zusatz || null };
}

// Ein Hinweissatz -> je genanntem Allergen ein Eintrag. Der Claim kommt aus dem
// Marker, VOR dem der Name steht - Position entscheidet, nicht Wortlaut. Steht
// in einem Satz erst "Allergene: Milch" und dann "Kann Spuren von Nuessen
// enthalten", bekommt Milch "enthalten" und Nuesse "spuren".
function zerlegeHinweis(zeile: string): { label: string; zusatz: string | null; claim: string | null }[] {
  const t = String(zeile ?? "");
  const marker = allergenMarkerListe(t);
  if (!marker.length) return [];
  const out: { label: string; zusatz: string | null; claim: string | null }[] = [];
  for (let i = 0; i < marker.length; i++) {
    const bis = i + 1 < marker.length ? marker[i + 1].pos : t.length;
    let seg = t.slice(marker[i].ende, bis);
    CLAIM_UNKLAR.lastIndex = 0;
    const unklar = CLAIM_UNKLAR.test(seg);
    CLAIM_UNKLAR.lastIndex = 0;
    if (unklar) seg = seg.replace(CLAIM_UNKLAR, " ");
    seg = seg.replace(/^\s*[:\-–—]\s*/, "");
    seg = seg.replace(/\s*\b(?:enthalten|enth[äa]lt|verarbeitet(?:\s+(?:wird|werden))?|hergestellt(?:\s+(?:wird|werden))?|sein\s+k[öo]nnen)\b\s*[.!;]?\s*$/i, "");
    seg = seg.replace(/[\s.]+$/, "");
    for (const roh of teileAllergenAufzaehlung(seg)) {
      const { label, zusatz } = saeubereAllergenwort(roh);
      if (label.length < 2) continue;
      if (!/[A-Za-zÄÖÜäöüß]/.test(label)) continue;
      out.push({ label, zusatz, claim: unklar ? null : marker[i].claim });
    }
  }
  return out;
}

// Der Hinweisteil DIESER Quellzeile, woertlich zitiert - ab dem ersten Marker
// bis zum Zeilenende. Bei "Zutaten: Mehl, Zucker. Kann Spuren von Nuessen
// enthalten." ist das genau der zweite Satz, nicht die ganze Zutatenliste.
// Rueckgabe null, wenn die Zeile nicht EINDEUTIG bestimmbar ist.
function hinweiszeileFuer(text: string, quelle: string): string | null {
  const roh = String(text ?? "").trim();
  const eigen = allergenMarkerListe(roh);
  if (eigen.length) return roh.slice(eigen[0].pos).trim();
  const nadel = vglNorm(roh);
  if (nadel.length < 3) return null;
  let treffer: string | null = null, n = 0;
  for (const z of String(quelle ?? "").split("\n")) {
    if (vglNorm(z).includes(nadel)) { n++; treffer = z; }
    if (n > 1) return null;                        // mehrdeutig -> kein Zitat
  }
  if (n !== 1 || treffer === null) return null;
  const m = allergenMarkerListe(treffer);
  return (m.length ? treffer.slice(m[0].pos) : treffer).trim();
}

// Welcher Claim gilt fuer einen Text, der SELBST keinen Marker traegt?
// Der des letzten Markers davor im Quellblock - dieselbe Positionslogik wie
// nurImKleingedruckten(). Kommt der Text mehrfach vor oder steht kein Marker
// davor, ist die Antwort null und nicht eine Vermutung.
function claimAusPosition(text: string, quelle: string): string | null {
  const q = String(quelle ?? "");
  const roh = String(text ?? "").trim();
  if (roh.length < 3) return null;
  const erste = q.indexOf(roh);
  if (erste < 0 || erste !== q.lastIndexOf(roh)) return null;
  const marker = allergenMarkerListe(q).filter((m) => m.pos <= erste);
  if (!marker.length) return null;
  return marker[marker.length - 1].claim;
}

// EU-Kennzeichnung: Allergene werden in der Zutatenliste HERVORGEHOBEN, in
// deutschen Etiketten fast immer durch Versalien. Das ist ein Struktursignal
// aus der LMIV, keine Namensvermutung - deshalb wird hier auch nichts
// uebersetzt oder gekuerzt, sondern das hervorgehobene Wort woertlich
// uebernommen.
//
// Das Signal traegt nur, wenn der Block ueberhaupt Kleinbuchstaben hat: eine
// durchgehend gross gesetzte Quelle hebt nichts hervor, dort waere jedes Wort
// ein Treffer.
const VERSALWORT = /[A-ZÄÖÜ][A-ZÄÖÜ]{2,}(?:[-‑][A-ZÄÖÜ]+)*/g;

function versalAllergene(text: string, quelle: string): string[] {
  const t = String(text ?? "");
  if (!t) return [];
  const klein = (String(quelle ?? "").match(/[a-zäöüß]/g) ?? []).length;
  const gross = (String(quelle ?? "").match(/[A-ZÄÖÜ]/g) ?? []).length;
  if (klein < gross) return [];
  const out: string[] = [];
  for (const m of t.match(VERSALWORT) ?? []) {
    if (/^(?:E\d+|[IVXLCDM]+)$/.test(m)) continue;          // E-Nummern, roemische Zahlen
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

// Ein vollstaendiges, schemafestes Allergen-Item. Alle drei Pflichtfelder des
// RPC-Riegels werden HIER gesetzt und nicht dem Modell ueberlassen: sie folgen
// deterministisch aus semantic_class (§4.2 - eine Regel, ein Ort).
function baueAllergenItem(a: {
  label: string; claim: string; zusatz: string | null;
  quellzeile: string; row: number; uid: string; note: string;
}): any {
  const attributes: any = { allergen_claim: a.claim };
  if (a.zusatz) attributes.allergen_zusatz = a.zusatz;
  return {
    section_key: ALLERGEN_SECTION,
    row_index: a.row,
    item_uid: a.uid,
    original_text: a.quellzeile,
    original_label: a.label,
    original_value_text: null,
    item_key: null,
    semantic_class: "allergen",
    target_kind: ALLERGEN_TARGET,
    comparison_operator: null,
    amount: null,
    unit: null,
    basis_key: null,
    basis_label: null,
    row_group_key: null,
    confidence: null,
    extraction_status: "extracted",
    persistence_status: "not_persisted",
    source_locator: {},
    note: a.note,
    base_ingredient: null,
    processing_modifiers: null,
    attributes,
    parenthetical_role: null,
    parenthetical_items: null,
  };
}

// Ein vom Modell geliefertes Allergen-Item schemafest machen. Laeuft fuer JEDES
// item mit semantic_class "allergen" - auch fuer die, die diese Datei selbst
// erzeugt hat (dort aendert sich dann nichts, das ist der Beweis, dass beide
// Wege dasselbe Ergebnis haben).
//
// FAIL-CLOSED: laesst sich der Claim nicht bestimmen, wird das Item KEIN
// Allergen. Es bleibt als Beleg erhalten - unresolved, needs_review,
// not_persisted -, denn ein Allergen ohne gueltigen Claim wuerde beim
// Persistieren den GANZEN Lauf werfen.
function normalisiereAllergenItem(it: any, quelle: string): void {
  const hinweise: string[] = [];
  if (String(it?.section_key ?? "") !== ALLERGEN_SECTION) {
    hinweise.push(`section_key "${String(it?.section_key ?? "")}" auf "${ALLERGEN_SECTION}" gesetzt (Routingregel riki_allergene_v1).`);
    it.section_key = ALLERGEN_SECTION;
  }
  if (String(it?.target_kind ?? "") !== ALLERGEN_TARGET) {
    hinweise.push(`target_kind auf "${ALLERGEN_TARGET}" gesetzt; er folgt deterministisch aus semantic_class.`);
    it.target_kind = ALLERGEN_TARGET;
  }
  const attr = (it?.attributes && typeof it.attributes === "object" && !Array.isArray(it.attributes))
    ? it.attributes : {};
  let claim = String(attr.allergen_claim ?? "").trim().toLowerCase();
  if (!ALLERGEN_CLAIMS.includes(claim)) {
    const txt = String(it?.original_text ?? "");
    const ausSatz = zerlegeHinweis(txt);
    const passend = ausSatz.find((x) => vglNorm(x.label) === vglNorm(it?.original_label));
    const abgeleitet = (passend?.claim ?? null)
      ?? (ausSatz.length && ausSatz.every((x) => x.claim === ausSatz[0].claim) ? ausSatz[0].claim : null)
      ?? claimAusPosition(String(it?.original_label ?? txt), quelle);
    if (abgeleitet) {
      claim = abgeleitet;
      hinweise.push(`allergen_claim "${abgeleitet}" aus dem Wortlaut bzw. der Position der Quellzeile abgeleitet.`);
    } else {
      it.semantic_class = "unresolved";
      it.section_key = "unresolved";
      it.target_kind = null;
      it.extraction_status = "needs_review";
      it.persistence_status = "not_persisted";
      it.attributes = Object.keys(attr).length ? attr : null;
      it.note = [it?.note,
        `RIEGEL v39: Allergen ohne bestimmbaren Claim-Typ. "enthalten" und "spuren" sind ` +
        `zwei verschiedene Aussagen - eine Warnung ist keine Zutat. Nicht geraten, sondern ` +
        `als needs_review offengelassen (Vertrag §2.6). Ein Allergen ohne gueltigen Claim ` +
        `wuerde cb_riki_source_extraction_speichern den ganzen Lauf verwerfen lassen.`]
        .filter(Boolean).join(" | ");
      return;
    }
  }
  attr.allergen_claim = claim;
  it.attributes = attr;
  if (!ALLERGEN_STATUS.includes(String(it?.extraction_status ?? ""))) it.extraction_status = "extracted";
  if (!String(it?.persistence_status ?? "")) it.persistence_status = "not_persisted";
  if (hinweise.length) {
    it.note = [it?.note, "RIEGEL v39: " + hinweise.join(" ")].filter(Boolean).join(" | ");
  }
}

function pruefeGegenQuelltext(
  daten: any,
  quelle: string,
  blockNr: number,
  erfunden: string[],
  uebersprungen: string[],
): void {
  const items: any[] = Array.isArray(daten?.items) ? daten.items : [];
  const quelleNorm = vglNorm(quelle);

  // === v39 · ALLERGEN-ITEMS (Work E1) ===
  // Lokale row_index-Verwaltung fuer den Abschnitt "allergene" DIESES Blocks.
  // EIN Hinweissatz = EINE Quellzeile = EIN row_index, egal wie viele Allergene
  // er nennt (Vertrag §2.2). Die globale Vergabe macht danach fuegeZusammen().
  //
  // IDEMPOTENZ ist hier Pflicht und kein Extra: pruefeGegenQuelltext laeuft bei
  // einem Nachschlag ZWEIMAL ueber dieselben Daten (siehe laufRohtext), und das
  // Modell kann das Allergen-Item bereits selbst geliefert haben. Der
  // Schluessel ist (normalisierte Quellzeile, normalisiertes Label); gebildet
  // mit JSON.stringify, nicht mit einem Trennzeichen - der v38-Grund gilt hier
  // genauso.
  const neueAllergene: any[] = [];
  const allergenRow = new Map<string, number>();
  const allergenDa = new Set<string>();
  let allergenMax = 0;
  let allergenOffen = 0;
  for (const it of items) {
    if (String(it?.semantic_class ?? "") !== "allergen") continue;
    const r = Number(it?.row_index);
    const q = vglNorm(it?.original_text);
    if (isFinite(r) && r > 0) {
      allergenMax = Math.max(allergenMax, r);
      if (q && !allergenRow.has(q)) allergenRow.set(q, r);
    }
    allergenDa.add(JSON.stringify([q, vglNorm(it?.original_label)]));
  }

  const rowFuer = (schluessel: string): number => {
    if (!allergenRow.has(schluessel)) { allergenMax += 1; allergenRow.set(schluessel, allergenMax); }
    return allergenRow.get(schluessel) as number;
  };

  // Legt aus EINEM Hinweissatz je genanntem Allergen ein Item an.
  // Rueckgabe: wie viele erzeugt wurden und welche Nennungen ohne bestimmbaren
  // Claim uebersprungen wurden. Uebersprungen heisst hier NICHT verschwunden -
  // der Hinweissatz bleibt als eigener Beleg erhalten und traegt die Namen.
  const legeAllergeneAn = (satz: string | null, herkunft: string): { n: number; offen: string[] } => {
    const offen: string[] = [];
    if (!satz) return { n: 0, offen };
    const teile = zerlegeHinweis(satz);
    if (!teile.length) return { n: 0, offen };
    const schluessel = vglNorm(satz);
    const row = rowFuer(schluessel);
    let n = 0;
    for (const teil of teile) {
      if (!teil.claim) { offen.push(teil.label); allergenOffen += 1; continue; }
      const k = JSON.stringify([schluessel, vglNorm(teil.label)]);
      if (allergenDa.has(k)) continue;
      allergenDa.add(k);
      neueAllergene.push(baueAllergenItem({
        label: teil.label, claim: teil.claim, zusatz: teil.zusatz,
        quellzeile: satz, row,
        uid: "v39a" + blockNr + "-" + (neueAllergene.length + 1),
        note: `v39: aus ${herkunft} gebildet, claim "${teil.claim}". Der Hinweissatz bleibt ` +
              `zusaetzlich als eigener Beleg erhalten; dieses Item ist die Allergenangabe dazu. ` +
              `Ob der Name ein bekanntes Allergen ist, entscheidet shadow_v1.allergen_alias - ` +
              `hier wird nichts uebersetzt und nichts gekuerzt.`,
      }));
      n += 1;
    }
    return { n, offen };
  };

  for (const it of items) {
    // --- Hinrichtung: steht das wirklich da? ---
    if (!itemImQuelltext(it, quelleNorm)) {
      const was = String(it?.original_label || it?.original_text || "?").slice(0, 60);
      erfunden.push(`Block ${blockNr}: "${was}"`);
      it.extraction_status = "unresolved";
      it.persistence_status = "not_persisted";   // ChatGPT-Entscheid B1, ausdrücklich
      it.confidence = "niedrig";
      it.note = [it.note,
        `RIEGEL: dieser Text steht nicht im Quellblock ${blockNr}. Bleibt als ` +
        `Auditbeleg erhalten (unresolved / not_persisted), darf aber NICHT in die ` +
        `Fachpersistenz und blockiert den Green-Gate.`]
        .filter(Boolean).join(" | ");
    }
    // --- v39: ein vom Modell geliefertes Allergen-Item schemafest machen ---
    // Laeuft auch ueber die Items, die diese Datei selbst erzeugt hat. Dort
    // aendert sie nichts - genau das ist der Nachweis, dass beide Wege
    // dasselbe Ergebnis liefern (§4.2).
    if (String(it?.semantic_class ?? "") === "allergen") normalisiereAllergenItem(it, quelle);

    // --- D1: Allergen- und Spurenhinweis ist KEINE Zutat ---
    // Gemessen 18.08. an zwei Etiketten mit demselben Fehler:
    //   EDEKA-2  "Allergene: Milch und daraus hergestellte Erzeugnisse"  -> ingredient
    //   HH-1     "Das Produkt kann Spuren von SENF und SOJA enthalten."  -> ingredient
    // Beides erklärt die +1 bei beiden. Der Quelltext-Abgleich greift hier
    // NICHT, denn die Zeilen stehen wirklich im Text — es ist keine Erfindung,
    // sondern eine Fehlklassifikation. Der Prompt verbietet sie längst
    // ("Ignoriere: Kann Spuren von ... enthalten, Lager- und Allergenhinweise"),
    // aber ein Verbot ohne Riegel ist eine Bitte.
    //
    // Besonders heikel bei EDEKA-2: dort GIBT es keine Zutatenliste. Die
    // Allergenzeile als Zutat zu führen macht aus "keine Angabe" eine Angabe —
    // genau der Fall, den Ralph als schärfsten Testfall ausgewählt hat.
    if (String(it?.semantic_class ?? "") === "ingredient") {
      const t = String(it?.original_text ?? it?.original_label ?? "");
      const istHinweis =
        /^\s*allergen/i.test(t) ||
        /kann\s+spuren\s+von/i.test(t) ||
        /kann(?:en)?\s+enthalten/i.test(t) ||     // D3: "kann enthalten" OHNE "Spuren" (P1593)
        /spuren\s+enthalten/i.test(t) ||
        /^\s*kann\s+folgende\s+spuren/i.test(t) ||
        // D3, der eigentliche Riegel: der Text steht im Quellblock NUR hinter
        // dem Spurenmarker. Fängt "SOJA" und "MANDELN, HASELNÜSSE, …", an denen
        // wörtlich nichts zu erkennen ist.
        nurImKleingedruckten(t, quelle);
      if (istHinweis) {
        // UNVERAENDERT gegenueber v38: der Hinweis wird nie eine Zutat und
        // bleibt als Beleg erhalten. Diese Zusicherung aus D1/D3 gilt weiter.
        it.semantic_class = "unresolved";
        it.target_kind = null;
        it.extraction_status = "unresolved";
        it.persistence_status = "not_persisted";
        it.note = [it.note,
          `RIEGEL: Allergen- oder Spurenhinweis ist keine Zutat (Regelwerk: "Ignoriere ` +
          `Spurenhinweise und Allergenhinweise"). Bleibt als Beleg erhalten, wird aber ` +
          `nicht als Zutat gefuehrt.`].filter(Boolean).join(" | ");

        // v39 · NEU: derselbe Hinweis erzeugt ZUSAETZLICH Allergen-Items.
        // Bis v38 endete er hier - "keine Zutat" war richtig, "also nichts"
        // war falsch. Der Beleg oben bleibt unangetastet; die Fachangabe
        // entsteht daneben.
        const satz = hinweiszeileFuer(t, quelle);
        const erg = legeAllergeneAn(satz, "Hinweiszeile");
        if (erg.n || erg.offen.length) {
          it.note = [it.note,
            `v39: daraus ${erg.n} Allergen-Item(s) gebildet` +
            (erg.offen.length
              ? `; ohne bestimmbaren Claim-Typ und deshalb NICHT als Allergen gefuehrt: ` +
                erg.offen.map((x) => `"${x}"`).join(", ") + ` (nicht geraten, §2.6).`
              : `.`)].filter(Boolean).join(" | ");
        }
      } else {
        // v39 · EU-KENNZEICHNUNG IN DER ZUTATENLISTE.
        // Ein in VERSALIEN hervorgehobenes Wort mitten in kleingeschriebenem
        // Text ist die Allergenkennzeichnung nach LMIV Anhang II - ein
        // Struktursignal, keine Namensvermutung. Daraus entsteht ZUSAETZLICH
        // ein Allergen-Item mit claim "enthalten".
        // Die Zutat selbst bleibt vollstaendig unangetastet: derselbe
        // section_key, derselbe row_index, derselbe Status. Sie wird nicht
        // verdoppelt, und die Zutatenzaehlung weiter unten zaehlt ohnehin nur
        // semantic_class "ingredient".
        const worte = versalAllergene(t, quelle);
        if (worte.length) {
          const schluessel = vglNorm(t);
          const row = rowFuer(schluessel);
          for (const w of worte) {
            const k = JSON.stringify([schluessel, vglNorm(w)]);
            if (allergenDa.has(k)) continue;
            allergenDa.add(k);
            neueAllergene.push(baueAllergenItem({
              label: w, claim: "enthalten", zusatz: null,
              quellzeile: t, row,
              uid: "v39a" + blockNr + "-" + (neueAllergene.length + 1),
              note: `v39: in der Zutatenliste in Versalien hervorgehoben - das ist die ` +
                    `gesetzliche Allergenkennzeichnung (LMIV Anhang II), also claim ` +
                    `"enthalten". Die Zutat selbst bleibt unveraendert bestehen. Ob der Name ` +
                    `ein bekanntes Allergen ist, entscheidet shadow_v1.allergen_alias.`,
            }));
          }
        }
      }
    }

    // --- basis_key gegen das Schema ---
    const bk = String(it?.basis_key ?? "").trim();
    if (bk && !BASIS_KEYS.includes(bk)) {
      it.note = [it.note,
        `RIEGEL: basis_key "${bk}" ist kein zulaessiger Wert; auf "other" gesetzt, ` +
        `Originalangabe bleibt in basis_label.`].filter(Boolean).join(" | ");
      if (!it.basis_label) it.basis_label = bk;
      it.basis_key = "other";
    }
  }

  // v39: die neuen Items erst NACH der Schleife anhaengen. Ein push waehrend
  // for...of ueber dasselbe Array wuerde sie in derselben Schleife noch einmal
  // durchlaufen.
  if (neueAllergene.length) items.push(...neueAllergene);

  // v39: der Abschnitt "allergene" muss auch als SEKTION existieren, sonst
  // taucht er in der Vollstaendigkeitsrechnung von fuegeZusammen gar nicht auf.
  // Eine vom Modell gelieferte Sektion wird NICHT ueberschrieben.
  if (items.some((x) => String(x?.semantic_class ?? "") === "allergen")) {
    const secs: any[] = Array.isArray(daten?.sections) ? daten.sections : (daten.sections = []);
    if (!secs.some((se) => String(se?.section_key ?? "") === ALLERGEN_SECTION)) {
      secs.push({
        section_key: ALLERGEN_SECTION,
        section_label: "Allergene",
        // expected_rows bleibt null: die Quelle nennt keine Zeilenzahl fuer
        // diesen Abschnitt, und eine geschaetzte Zahl waere keine Messung.
        expected_rows: null,
        extracted_rows: null,
        status: allergenOffen ? "partial" : "complete",
        note: "v39: Abschnitt aus den Allergenangaben dieses Blocks gebildet " +
              "(Routingregel riki_allergene_v1)." +
              (allergenOffen
                ? ` ${allergenOffen} Nennung(en) ohne bestimmbaren Claim-Typ nicht als ` +
                  `Allergen gefuehrt; sie stehen im Beleg-Item und wurden nicht geraten.`
                : ""),
      });
    }
  }

  // --- Rückrichtung: was stand da und fehlt? ---
  for (const zeile of nichtAbgedeckteZeilen(quelle, items)) {
    uebersprungen.push(`Block ${blockNr}: "${zeile.slice(0, 70)}"`);
  }

  // --- E1: die Zutatenzeile ist EINE Zeile und trägt trotzdem viele Zutaten ---
  const sollZutaten = zaehleTopLevelZutaten(quelle);
  if (sollZutaten > 0) {
    const istZutaten = new Set(
      items
        .filter((x) => String(x?.semantic_class ?? "") === "ingredient")
        .map((x) => Number(x?.row_index)),
    ).size;
    // Nur melden, wenn WENIGER geliefert wurde. Mehr kann legitim sein: die
    // grobe Kommazählung übersieht Klammern in Sonderformen, und eine Zutat
    // mehr ist kein Datenverlust.
    if (istZutaten > 0 && istZutaten < sollZutaten) {
      // PRUEFHINWEIS, KEINE FEHLERMELDUNG. Die Kommazaehlung kann in BEIDE
      // Richtungen danebenliegen, und der Text sagt das ausdruecklich —
      // sonst liest jemand eine Vermutung als Befund (§3.5: Aehnlichkeit ist
      // ein Pruefhinweis, keine Identitaet).
      // Bekannte Grenze, gemessen an P1177: "18 % laktosefreier, schnittfester
      // Mozzarella" traegt ein Komma INNERHALB des Zutatennamens. Fuer eine
      // Kommazaehlung sieht das aus wie ein Trenner; unterscheidbar ist es nur
      // fachlich. Dort zaehlt die Funktion 7 statt 5.
      uebersprungen.push(
        `Block ${blockNr}: Zutatenliste — ${sollZutaten} Trenner auf oberster Ebene gezaehlt, ` +
        `${istZutaten} Zeilen geliefert. PRUEFHINWEIS: entweder sind zwei Zutaten in einem ` +
        `Item zusammengefasst, oder ein Zutatenname enthaelt selbst ein Komma ` +
        `(z. B. "laktosefreier, schnittfester Mozzarella"). Nicht automatisch ein Verlust.`,
      );
    }
  }
}


// ---------------------------------------------------------------------------
// 5c · kJ/kcal-AUFSPALTUNG — Vertrag §2.3, im CODE statt im Prompt
// ---------------------------------------------------------------------------
// v16.3. Gemessen 17.08. an P1809 und P1700:
//   "Energie | 98 kJ / 24 kcal"  ->  amount 98, unit kJ. Die 24 kcal fehlen.
//   "Brennwert | 1107KJ/258kcal" ->  amount 1107, unit KJ. Dieselbe Lücke.
// §2.3 verlangt, dass beide Werte erhalten bleiben und über gemeinsame
// row_index/row_group_key zur selben Quellzeile gehören.
//
// WARUM IM CODE UND NICHT IM PROMPT: eine Prompt-Änderung löst §24 aus und
// zwingt zum Gleichlauf über neun Edge Functions. Die Aufspaltung ist reine
// Textarbeit an einem Wert, den das Modell bereits verlustfrei in
// original_value_text geliefert hat — dafür braucht es keine neue Regel.
//
// ABGRENZUNG ZU §2.3a, WICHTIG: NUR kJ/kcal wird aufgespalten. Das sind zwei
// Einheiten für DIESELBE Größe, ineinander umrechenbar. Bei "400 I.E. / 10 µg"
// (Vitamin D, P1809) wird NICHT aufgespalten — IU und µg sind nicht zwingend
// dasselbe, und eine Aufspaltung würde eine Gleichsetzung behaupten, die das
// Etikett nicht hergibt (CLAUDE.md §8: FCC ist nicht IU, IU ist nicht mg).
const ENERGIE_PAAR = /(\d+(?:[.,]\d+)?)\s*(kJ|KJ|kj)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(kcal|kCal|KCAL)/;

function spalteEnergie(items: any[], startUid: number): { items: any[]; ergaenzt: number } {
  const out: any[] = [];
  let uid = startUid;
  let ergaenzt = 0;

  // D2, gemessen 18.08. an P73616: das Modell liefert den kcal-Wert MANCHMAL
  // schon selbst als eigene Zeile (dort row_index 9, item_key energie_kcal),
  // manchmal nicht. Ergänzt man dann blind, steht 190 kcal zweimal im Ergebnis.
  // Also erst nachsehen, was schon da ist — je Abschnitt und Bezugsbasis.
  const schonKcal = new Set(
    items
      .filter((x) => String(x?.unit ?? "").toLowerCase() === "kcal")
      .map((x) => [x?.section_key, x?.row_group_key, x?.basis_key, Number(x?.amount)].join("#")),
  );

  for (const it of items) {
    out.push(it);
    const quelle = String(it?.original_value_text ?? it?.original_text ?? "");
    const m = quelle.match(ENERGIE_PAAR);
    if (!m) continue;

    // Nur wenn das Item selbst den kJ-Wert trägt — sonst wäre das kcal-Item
    // schon da und wir würden es verdoppeln.
    const einheitJetzt = String(it?.unit ?? "").toLowerCase();
    if (einheitJetzt !== "kj") continue;

    const kcalWert = Number(String(m[3]).replace(",", "."));
    if (!isFinite(kcalWert)) continue;

    // Existiert derselbe kcal-Wert in derselben Gruppe und Bezugsbasis bereits,
    // wird NICHT ergänzt. Der Wert des Modells hat Vorrang — er trägt seinen
    // eigenen source_locator.
    if (schonKcal.has([it?.section_key, it?.row_group_key, it?.basis_key, kcalWert].join("#"))) continue;

    uid++;
    ergaenzt++;
    out.push({
      ...it,
      item_uid: "i" + uid,
      amount: kcalWert,
      unit: "kcal",
      // GLEICHE Quellzeile: row_index und row_group_key bleiben, damit
      // erkennbar ist, dass beide Werte zu EINER Zeile gehören (§2.3).
      note: [it?.note,
        `§2.3: kcal-Wert aus "${m[0]}" ergaenzt. Beide Werte gehoeren zur selben ` +
        `Quellzeile (row_index ${it?.row_index}). Nicht umgerechnet — abgelesen.`]
        .filter(Boolean).join(" | "),
    });
  }
  return { items: out, ergaenzt };
}


// ---------------------------------------------------------------------------
// 6 · WAS DIE ANTWORT ZUSÄTZLICH TRÄGT
// ---------------------------------------------------------------------------
// meta.chunking = { bloecke, abgebrochen[], unteilbar[], technisch_vollstaendig }
//
// "technisch_vollstaendig" heisst AUSSCHLIESSLICH: alle Blöcke sind ohne
// Truncation durchgelaufen. Es heisst NICHT, dass das Etikett fachlich
// vollständig gelesen wurde. Das entscheidet weiterhin das externe Soll der
// 14er-Suite (§1.1). Wer diesen Wert als Vollständigkeitsbeweis liest, baut
// sich dasselbe expected_rows-Problem noch einmal.
//
// ERLEDIGT, nicht mehr offen: der am Vormittag an #3 notierte Widerspruch
// (extraction_status kannte "needs_review" nicht, obwohl Regelwerk und Vertrag
// §7.3 darauf bauen) ist behoben. Nachgemessen 17.08. abends:
//   extraction_status ∈ extracted | unresolved | needs_review | ignored
// ChatGPT hat beide CHECKs erweitert. Damit ist §7.3 erfüllbar und der
// Umweg über unreadable in normStatus() entfallen.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const { key, name: keyName } = findeKey();

  let body: any = {};
  try { body = await req.json(); } catch (_e) { body = {}; }

  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  if (body.modus === "diagnose") {
    const { data: u } = await sb.auth.getUser();
    const { data: istAdmin, error: adminErr } = await sb.rpc("cb_ist_admin");
    return new Response(JSON.stringify({
      key_gefunden: !!key,
      gefunden_unter: keyName,
      angemeldet: !!u?.user,
      user_id: u?.user?.id ?? null,
      ist_admin: istAdmin ?? null,
      admin_fehler: adminErr?.message ?? null,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  if (!key) {
    return new Response(JSON.stringify({
      error: "Kein Anthropic-Key gefunden (Secret muss mit sk-ant- beginnen).",
    }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Nicht angemeldet." }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: istAdmin, error: adminErr } = await sb.rpc("cb_ist_admin");
    if (adminErr) {
      return new Response(JSON.stringify({ error: "Admin-Pruefung fehlgeschlagen: " + adminErr.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (istAdmin !== true) {
      return new Response(JSON.stringify({ error: "Nur Admins." }),
        { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { data: budget } = await sb.rpc("cb_riki_budget_check");
    const b: any = Array.isArray(budget) ? budget[0] : budget;
    if (b && b.erlaubt === false) {
      return new Response(JSON.stringify({
        error: `Monatslimit erreicht: ${Number(b.verbraucht_usd).toFixed(2)} von ${b.limit_usd} USD. Limit in Riki_Config anpassen.`,
      }), { status: 429, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const modus: string = body.modus ?? "zutaten";
    const modell: string = body.modell ?? "claude-haiku-4-5-20251001";

    /* Regelabruf je Modus. Faellt er aus, wird ABGEBROCHEN statt geraten. */
    let systemText = REGELWERK;
    if (modus === "rohtext") {
      const { data: regelRows, error: regelErr } = await sb.rpc("cb_source_section_routing_rules");
      if (regelErr || !Array.isArray(regelRows) || regelRows.length === 0) {
        return new Response(JSON.stringify({
          error: "Routingregeln nicht abrufbar - ohne sie wird nicht extrahiert. " + (regelErr?.message ?? "leere Antwort"),
        }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      systemText = rohtextRegelwerk(regelBlock(regelRows));
    } else if (modus === "bewerten") {
      const { data: rw, error: rwErr } = await sb.rpc("cb_riki_regelwerk_aktiv_holen");
      const rules = rw && (rw as any).rules;
      if (rwErr || !Array.isArray(rules) || rules.length === 0) {
        return new Response(JSON.stringify({
          error: "Aktives Regelwerk nicht abrufbar - ohne Regeln wird nicht bewertet. " + (rwErr?.message ?? "leere Antwort"),
        }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
      }
      systemText = bewertenRegelwerk(bewertungsRegelBlock(rules));
    }

    /* ===================================================================
       v16 · WORK #120 Abschnitt A - DER ROHTEXT-PFAD ZWEIGT HIER AB.
       Er laeuft ueber laufRohtext() und kehrt NICHT in den gemeinsamen
       fetch-Weg zurueck. Damit gilt fuer rohtext:
         - genau EINE Buchung JE BLOCK, aus laufRohtext heraus,
         - KEINE zusaetzliche Sammelbuchung: die eine cb_riki_buchen-Stelle
           weiter unten wird fuer rohtext nie erreicht (return davor).
       Alle anderen Modi (zutaten, bewerten, etikett, diagnose) laufen
       unveraendert weiter - gleiche max_tokens, gleicher v13-Riegel,
       gleiche Buchung.
       =================================================================== */
    if (modus === "rohtext") {
      const t0r = Date.now();
      const preisR = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];

      const r = await laufRohtext({
        key,
        modell,
        systemText,
        text: body.text ?? "",
        name: body.name,
        quelle: body.quelle,
        preis: preisR,
        buche: async (inTok, outTok, kosten, erfolg, fehler) => {
          await sb.rpc("cb_riki_buchen", {
            p_modus: "rohtext", p_modell: modell,
            p_in: inTok, p_out: outTok, p_kosten: kosten,
            p_produkt_id: body.produkt_id ?? null,
            p_erfolg: erfolg, p_fehler: fehler,
          });
        },
      });

      /* Alle Bloecke unlesbar: analog zum v13-Riegel 502 und nichts liefern.
         Ein halbes Ergebnis waere schlimmer als keines. Gebucht ist bereits
         je Block, deshalb hier KEINE weitere Buchung. */
      if (r.fehler || !r.ergebnis) {
        return new Response(JSON.stringify({
          error: r.fehler ?? "Rohtext-Lauf ohne Ergebnis.",
        }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
      }

      /* WEG-ENTSCHEIDUNG (eine von zwei zulaessigen, hier bewusst gewaehlt):
         "chunking" wird aus dem vorschlag ENTFERNT und steht nur in meta.
         Grund: der vorschlag ist der Vertragsgegenstand
         riki_source_extraction_item_v1 - er traegt contract_version, sections
         und items, sonst nichts. Ein Zusatzfeld darin waere eine zweite,
         nicht vereinbarte Vertragsversion (§4.2 "eine Regel, ein Ort").
         Laufinformationen gehoeren nach meta, wie modell und kosten_usd auch.
         Gespiegelt wird NICHT: zwei Orte fuer dieselbe Zahl driften. */
      const ergebnis: any = { ...r.ergebnis };
      const chunking = ergebnis.chunking;
      delete ergebnis.chunking;

      return new Response(JSON.stringify({
        vorschlag: ergebnis,
        meta: { modell, input_token: r.inTok, output_token: r.outTok,
                kosten_usd: Number(r.kosten.toFixed(6)), dauer_ms: Date.now() - t0r,
                chunking,
                hinweis: "VORSCHLAG - nicht verifiziert. Gegen Etikett/Quelle pruefen, bevor du freigibst." },
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const inhalt: unknown[] = [];
    if (modus === "etikett" && Array.isArray(body.bilder) && body.bilder.length) {
      for (const b64 of body.bilder.slice(0, 3)) {
        const m = String(b64).match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (!m) continue;
        inhalt.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      }
      inhalt.push({ type: "text", text:
        "Lies aus diesen Etikettfotos die Naehrwerttabelle (je 100 g) und die vollstaendige Zutatenliste aus und bewerte die Zutaten." +
        (body.ean ? ` EAN: ${body.ean}.` : "") +
        " Was du nicht sicher lesen kannst: null und \"unsicher\": true. Nichts raten." });
    } else if (modus === "rohtext") {
      inhalt.push({ type: "text", text:
        `Zerlege diesen kopierten Quelltext in Abschnitte und Zeilen:\n\n${body.text ?? ""}\n\n` +
        (body.name ? `Produktname: ${body.name}\n` : "") +
        (body.quelle ? `Quelle: ${body.quelle}\n` : "") });
    } else if (modus === "bewerten") {
      inhalt.push({ type: "text", text:
        `Bewerte diese eine Zutat nach dem aktiven Regelwerk:\n\n` +
        `Grundzutat: ${body.name ?? ""}\n` +
        (body.struktur ? `Struktur aus der Zerlegung: ${JSON.stringify(body.struktur)}\n` : "") +
        `\nNenne die Regel-ID aus der Liste - oder unresolved, wenn keine passt.` });
    } else {
      inhalt.push({ type: "text", text:
        `Zerlege und bewerte diese Zutatenliste:\n\n${body.text ?? ""}\n\n` +
        (body.name ? `Produktname: ${body.name}\n` : "") +
        (body.naehrwerte ? `Bereits erfasste Naehrwerte je 100 g (bitte plausibilisieren): ${JSON.stringify(body.naehrwerte)}\n` : "") });
    }

    const t0 = Date.now();
    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        max_tokens: modus === "bewerten" ? 1000 : 16000, /* 13.09.2026 Ralph: "zutaten" hatte 2000 und lief bei normalen Zutatenlisten ins Ausgabelimit (P73725: exakt 2000 out, verworfen). Jetzt derselbe Deckel wie "rohtext". */
        system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: inhalt }],
      }),
    });

    const j = await ai.json();
    if (!ai.ok) {
      await sb.rpc("cb_riki_buchen", { p_modus: modus, p_modell: modell, p_in: 0, p_out: 0,
        p_kosten: 0, p_produkt_id: body.produkt_id ?? null, p_erfolg: false,
        p_fehler: JSON.stringify(j).slice(0, 400) });
      return new Response(JSON.stringify({
        error: "Anthropic-Fehler: " + (j?.error?.message ?? JSON.stringify(j).slice(0, 200)),
      }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    /* v13-RIEGEL: eine am Ausgabelimit abgeschnittene Antwort ist KEIN Ergebnis. */
    if (j.stop_reason === "max_tokens") {
      const u9: any = j.usage ?? {};
      await sb.rpc("cb_riki_buchen", { p_modus: modus, p_modell: modell,
        p_in: (u9.input_tokens ?? 0), p_out: (u9.output_tokens ?? 0), p_kosten: 0,
        p_produkt_id: body.produkt_id ?? null, p_erfolg: false,
        p_fehler: "stop_reason max_tokens - Antwort abgeschnitten, Lauf verworfen" });
      return new Response(JSON.stringify({
        error: "Die Antwort wurde am Ausgabelimit abgeschnitten - das Ergebnis waere unvollstaendig und wurde verworfen. Text kuerzen oder in zwei Bloecken einfuegen.",
      }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const text = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    let vorschlag: unknown = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      vorschlag = JSON.parse(m ? m[0] : text);
    } catch (_e) {
      vorschlag = { fehler: "Antwort war kein gueltiges JSON", roh: text.slice(0, 1200) };
    }

    /* Work #91, Riegel im CODE: proposed ohne regel_id/rating -> unresolved. */
    if (modus === "bewerten" && vorschlag && typeof vorschlag === "object") {
      const v: any = vorschlag;
      if (v.status === "proposed" && (!v.regel_id || v.rating == null)) {
        v.status = "unresolved"; v.regel_id = null; v.rating = null;
        v.begruendung = String(v.begruendung ?? "") + " [Riegel: proposed ohne Regel-ID/Wert -> unresolved]";
      }
    }

    const u2: any = j.usage ?? {};
    const inTok = (u2.input_tokens ?? 0) + (u2.cache_creation_input_tokens ?? 0) + (u2.cache_read_input_tokens ?? 0);
    const outTok = u2.output_tokens ?? 0;
    const preis = PREISE[modell] ?? PREISE["claude-haiku-4-5-20251001"];
    const kosten = (inTok / 1e6) * preis.in + (outTok / 1e6) * preis.out;

    await sb.rpc("cb_riki_buchen", { p_modus: modus, p_modell: modell,
      p_in: inTok, p_out: outTok, p_kosten: Number(kosten.toFixed(6)),
      p_produkt_id: body.produkt_id ?? null, p_erfolg: true, p_fehler: null });

    if (modus !== "rohtext" && modus !== "bewerten") {
      try { if (vorschlag && typeof vorschlag === "object") (vorschlag as any).bezug = normBezug((vorschlag as any).bezug); } catch (_e) {}
    }

    return new Response(JSON.stringify({
      vorschlag,
      meta: { modell, input_token: inTok, output_token: outTok,
              kosten_usd: Number(kosten.toFixed(6)), dauer_ms: Date.now() - t0,
              hinweis: "VORSCHLAG - nicht verifiziert. Gegen Etikett/Quelle pruefen, bevor du freigibst." },
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
