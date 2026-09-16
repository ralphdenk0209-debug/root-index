/* ============================================================================
   LADESTELLE · eine Stelle, an der die Seite ihre Daten holt · 16.09.2026
   ----------------------------------------------------------------------------
   Ralph, 16.09.2026: „Cockpit auf eine Ladestelle."

   GEMESSEN, nicht geschaetzt. Supabase edge_logs, EIN Aufruf von admin.html
   am 16.09.2026, 04:41:00 bis 04:41:12 — 58 RPC-Aufrufe. 31 davon waren
   exakte Wiederholungen derselben Funktion mit denselben Werten, in
   Sekundenbruchteilen:

     cb_features 3x · cb_link_me 3x · cb_me 3x · cb_my_features 3x
     cb_dashboard 3x · cb_netzplan 3x · cb_admin_meilensteine 5x
     cb_bundesland_zaehlung 5x · cb_kette_stand 4x · cb_admin_meldungen 3x
     cb_admin_kontakt_liste 3x · cb_admin_kontakt_erledigt_liste 3x
     cb_admin_bundles 3x · cb_admin_rezepte_free 3x

   DIE URSACHE, nicht das Symptom: Supabase meldet beim Seitenstart MEHRERE
   Auth-Ereignisse nacheinander (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED).
   An diesen Ereignissen haengen drei unabhaengige Ladewege — applyAuthState,
   ladeFeatures und, ueber die Ansicht, loadFreigabe/loadDashboard. Jeder
   laedt fuer sich. Keiner weiss vom anderen. Deshalb dreimal alles.

   WAS DIESE DATEI TUT
   Sie legt EINE Stelle vor client.rpc. Laeuft ein LESE-Aufruf mit denselben
   Werten gerade schon, bekommt der zweite Rufer dieselbe Antwort statt einer
   zweiten Leitung.

   🔴 SIE SPEICHERT NICHTS ZWISCHEN. Sobald die Antwort da ist, ist die Stelle
   wieder leer. Ein spaeterer Aufruf fragt erneut — „Aktualisieren" bleibt
   Aktualisieren, und niemand bekommt je eine Zahl von gestern. Ein Cache mit
   Haltbarkeit waere die zweite Wahrheit, die dieses Projekt nicht will
   (§4.2); er wurde geprueft und verworfen.

   🔴 NUR LESEN, und nur was in LESEND steht (zwei begruendete
   Ausnahmen stehen dort namentlich). Das ist eine ERLAUBNIS-Liste,
   kein Verbot. Was nicht draufsteht, laeuft unveraendert durch. Damit kann
   ein vergessener Schreibweg hier keinen Schaden anrichten: der schlimmste
   Fall einer Luecke ist ein Aufruf zu viel — also genau der heutige Zustand.
   Dieselbe Ueberlegung haelt cb_link_me und cb_build_melden bewusst DRAUSSEN:
   beide schreiben, auch wenn ihr Name harmlos klingt.

   🔴 KEINE FACHLOGIK. Diese Datei kennt keine Note, keine Regel, kein
   Produkt. Sie zaehlt Leitungen.
   ========================================================================== */
(function(global){
"use strict";

/* ── Die Erlaubnis-Liste ───────────────────────────────────────────────────
   Erhoben aus dem Seitenaufruf vom 16.09.2026 (siehe Kopf) plus den
   Nachbarn, die auf demselben Weg mehrfach kommen koennen. Jede Zeile ist
   eine Funktion, die NUR liest. Wer eine neue aufnimmt, prueft das vorher
   an pg_get_functiondef - nicht am Namen.

   ROT: JEDE Zeile wurde am 16.09.2026 gegen pg_proc.prosrc geprueft, nicht
   am Namen beurteilt. Zwei Funktionen schreiben doch etwas - beide bewusst
   aufgenommen, weil der Schreibvorgang ein Zeitstempel ohne Fachfolge ist und
   mehrfaches Ausfuehren nichts anderes ergibt als einmaliges:
     cb_me      setzt "letzte_aktivitaet" - laut eigenem Kommentar hoechstens
                alle 5 Minuten. Der Aufruf, den wir sparen, haette also
                ohnehin nichts geschrieben.
     cb_profil  rechnet "Alter" aus dem Geburtsdatum nach.
   Alles andere auf dieser Liste liest ausschliesslich. Wer etwas aufnimmt,
   prueft es genauso - am Funktionsrumpf, nicht am Namen. */
var LESEND = {
  /* Anmeldung, Stufen, Rechte (cb_me und cb_profil: Ausnahme siehe oben) */
  'cb_me':1, 'cb_my_features':1, 'cb_gast_features':1, 'cb_features':1,
  'cb_features_matrix':1, 'cb_profil':1,
  /* Dashboard und Cockpit */
  'cb_dashboard':1, 'cb_netzplan':1, 'cb_dashboard_drill':1,
  'cb_admin_dashboard_cockpit_v2':1, 'cb_admin_dashboard_cockpit_drill':1,
  'cb_admin_dashboard_layout_standard':1, 'cb_admin_dashboard_layout_varianten':1,
  'cb_admin_dashboard_layout_laden':1,
  'cb_admin_meilensteine':1, 'cb_bundesland_zaehlung':1, 'cb_kette_stand':1,
  'cb_supabase_status':1, 'cb_admin_erfasser_statistik':1, 'cb_audit_status':1,
  /* Freigabe-Bereich */
  'cb_admin_meldungen':1, 'cb_admin_kontakt_liste':1,
  'cb_admin_kontakt_erledigt_liste':1, 'cb_admin_bundles':1,
  'cb_admin_rezepte_free':1,
  /* Waechter und Stamm — nur die lesenden */
  'cb_admin_stamm_waechter':1, 'cb_admin_stamm_waechter_liste':1,
  'cb_admin_waechter_faelle':1, 'cb_admin_waechter_faelle_view':1,
  'cb_waechter_faelle':1, 'cb_naehrwerte_qa_faelle':1,
  /* Katalog und Nachschlagewerke */
  'cb_katalog_zaehler':1, 'cb_stueck_map':1, 'cb_stueck_groessen':1,
  'cb_quellen_typen':1, 'cb_mikro_einheiten':1, 'cb_tausch_tipps':1,
  'cb_todo_list':1, 'cb_meine_einstellungen':1,
  /* Tagebuch-Kopf (laeuft beim Start mit, auch im Adminbereich) */
  'cb_tagessumme':1, 'cb_train_log_tag':1, 'cb_schritte_tag':1,
  'cb_schritte_verlauf':1, 'cb_schlaf_tag':1, 'cb_schlaf_verlauf':1,
  /* Erfassung */
  'cb_erfassung_zaehler':1, 'cb_erfassung_liste':1
};

var offen = {};      /* Schluessel -> laufendes Versprechen */
var gespart = {};    /* Funktionsname -> wie oft eingespart (nur zum Nachsehen) */
var angeschlossen = false;

function schluessel(fn, args){
  var a;
  try{ a = JSON.stringify(args === undefined ? null : args); }
  catch(e){ a = null; }          /* nicht darstellbar -> nicht zusammenlegen */
  return (a === null) ? null : (fn + '|' + a);
}

/* Jeder Rufer bekommt seine EIGENE Huelle. Sonst haelt der eine das
   Antwortobjekt des anderen in der Hand und ein spaeteres r.data=… traefe
   beide. Die Nutzlast (data) ist dieselbe — sie wird gelesen, nicht
   umgeschrieben; eine tiefe Kopie waere bei 40.000 Zeilen teurer als der
   Aufruf, den wir gerade sparen. */
function huelle(r){
  if(!r || typeof r !== 'object') return r;
  return { data:r.data, error:r.error, count:r.count,
           status:r.status, statusText:r.statusText };
}

function anschliessen(client){
  if(!client || typeof client.rpc !== 'function') return false;
  if(angeschlossen) return true;          /* genau einmal, sonst Huelle um Huelle */
  var roh = client.rpc.bind(client);

  client.rpc = function(fn, args, opts){
    /* opts (head/count/get) aendert die Anfrage — Finger weg. */
    if(opts || !LESEND[fn]) return roh(fn, args, opts);
    var k = schluessel(fn, args);
    if(k === null) return roh(fn, args, opts);

    var laeuft = offen[k];
    if(laeuft){
      gespart[fn] = (gespart[fn]||0) + 1;
      return laeuft.then(huelle);
    }

    var p = Promise.resolve(roh(fn, args, opts));
    offen[k] = p;
    /* Die Stelle wird in JEDEM Fall wieder frei — auch wenn der Aufruf
       scheitert. Ein haengengebliebener Schluessel wuerde denselben Fehler
       fuer den Rest des Seitenlebens weiterreichen. */
    var frei = function(){ if(offen[k] === p) delete offen[k]; };
    p.then(frei, frei);
    return p.then(huelle);
  };

  angeschlossen = true;
  return true;
}

/* Zum Nachsehen in der Konsole: riLadestelle.bericht() */
function bericht(){
  var summe = 0, zeilen = [];
  Object.keys(gespart).forEach(function(f){
    summe += gespart[f]; zeilen.push(f + ': ' + gespart[f]);
  });
  zeilen.sort();
  return { gesparte_aufrufe: summe, je_funktion: zeilen, offen: Object.keys(offen).length };
}

global.riLadestelle = { anschliessen:anschliessen, bericht:bericht, LESEND:LESEND };

})(typeof window !== 'undefined' ? window : this);
