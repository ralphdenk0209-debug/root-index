/* ===== SCHNELLANLAGE PER LESEZEICHEN (Ralph 27.07.2026) ==============================
   Ralph: "Kann man in Chrome oder Safari eine Funktion bauen, mit der ich, wenn ich eine
   Webadresse ausgewaehlt habe, diese mit Riki als Produkt anlegen kann?"

   Warum ein Lesezeichen und keine Browser-Erweiterung: Eine Erweiterung muesste gepackt,
   installiert und bei jeder Chrome-Aenderung gepflegt werden - und Safari braucht eine
   voellig andere Fassung. Das Lesezeichen ist EIN Klick, funktioniert in beiden Browsern
   und hat keinen Wartungsanteil. Es oeffnet admin.html?neu=<Adresse>; von dort uebernimmt
   der Empfaenger unten und laesst Riki die Seite sofort lesen (Ralph: "soll sofort loslegen").

   Der Empfaenger wartet auf die Anmeldung, statt sie vorauszusetzen: Wer den Link im
   Supermarkt anklickt, ist im neuen Tab oft noch nicht angemeldet. Ohne Warten waere der
   Import still verloren - der schlimmste Fall, weil man den Verlust nicht bemerkt. */
function rkBookmarkletCode(){
  var ziel=location.origin+location.pathname;   /* immer die echte Adresse dieses Backends */
  return "javascript:(function(){var u=location.href;if(!/^https?:/i.test(u)){alert('Das geht nur auf einer normalen Webseite.');return;}"
       + "window.open('"+ziel+"?neu='+encodeURIComponent(u),'_blank');})();";
}
/* rkBookmarkletBox ENTFERNT am 30.07.2026 (Ralph: „das unten kann raus, link habe ich
   angelegt"). Der Kasten erklaerte das Lesezeichen - einmal gebraucht, danach Ballast unter
   jedem Dashboard. Geloescht statt versteckt (§1.11n-p). rkBookmarkletCode() BLEIBT, und der
   Empfaenger admin.html?neu=<Adresse> arbeitet weiter: Ralphs Lesezeichen funktioniert. */

/* ============================================================================
   Empfaenger: admin.html?json=<JSON>  (Ralph-Go 02.08.2026)

   Sein Kurzbefehl liest die Produktseite und oeffnet damit direkt den Editor -
   kein Kopieren, kein Einfuegen. Ein Skript auf edeka.de kann aus Sicherheits-
   gruenden NICHT in unser Feld schreiben (Same-Origin), die Adresse ist der
   einzige Weg ueber die Herkunftsgrenze.

   🔴 Es wird NICHT automatisch uebernommen. Das JSON landet im Feld, den Knopf
   drueckt der Mensch - so sieht er, was gefuellt wurde und was nicht (§6:
   Riki/Skripte schlagen vor, der Mensch entscheidet).
   ============================================================================ */
(function rkJsonEmpfangen(){
  if(typeof window==="undefined" || !window.__ADMIN_PAGE) return;
  var roh=null;
  try{ roh=new URLSearchParams(location.search).get("json"); }catch(e){}
  if(!roh || !roh.trim()) return;
  /* Adresse SOFORT leeren: ein Neuladen wuerde sonst dasselbe noch einmal einspielen. */
  try{ history.replaceState(null,"",location.pathname+location.hash); }catch(e){}

  function hinw(txt,farbe){
    var b=document.getElementById("rkJsonHinweis");
    if(!b){ b=document.createElement("div"); b.id="rkJsonHinweis";
      b.style.cssText="position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9998;max-width:min(560px,92vw);padding:11px 16px;border-radius:11px;font-size:13.5px;font-weight:600;box-shadow:0 8px 26px -12px rgba(20,40,70,.5);background:#ffffff;border:1px solid #e2e8ef";
      document.body.appendChild(b); }
    b.style.color=farbe||"#1d3c24"; b.innerHTML=txt; return b;
  }
  function weg(){ var b=document.getElementById("rkJsonHinweis"); if(b) b.remove(); }

  /* Nur zum Anzeigen im Hinweis - die eigentliche Pruefung macht fgJsonUebernehmen. */
  var name="";
  try{ var o=JSON.parse(roh); name=String((o&&o.produktname)||""); }catch(e){}

  hinw('Produktseite empfangen'+(name?(': <b>'+esc(name)+'</b>'):'')+' &ndash; warte auf die Anmeldung&hellip;');

  var seit=0, MAX=60000, TAKT=400, loginGezeigt=false;
  var timer=setInterval(function(){
    seit+=TAKT;
    if(typeof ME!=="undefined" && ME && ME.is_admin){
      clearInterval(timer);
      try{
        var pr=openFgEditor(null);
        var nach=function(){
          window._rkSchnell=true;   /* Editor bleibt nach dem Freigeben offen - wie beim Lesezeichen */
          var ta=document.getElementById("fe_jsonIn");
          if(!ta){ hinw('Das JSON-Feld ist nicht da &ndash; bitte den Editor melden.','#cf5442'); return; }
          ta.value=roh;
          try{ ta.scrollIntoView({block:"center"}); }catch(e){}
          try{ ta.style.borderColor="#16a34a"; ta.style.background="#eaf5ee"; }catch(e){}
          hinw('&#10003; Produktseite eingef&uuml;gt'+(name?(': <b>'+esc(name)+'</b>'):'')
            +' &ndash; jetzt auf <b>&bdquo;&Uuml;bernehmen&ldquo;</b> klicken.','#166534');
          setTimeout(weg, 9000);
        };
        if(pr && typeof pr.then==="function") pr.then(nach); else setTimeout(nach,500);
      }catch(e){ hinw('Editor liess sich nicht oeffnen: '+esc(String(e&&e.message||e)),'#cf5442'); }
      return;
    }
    if(seit>3000 && !loginGezeigt && (typeof ME==="undefined" || !ME)){
      loginGezeigt=true;
      hinw('Bitte anmelden &ndash; die Produktdaten werden danach eingef&uuml;gt.','#92400e');
      try{ if(typeof openLogin==="function") openLogin(); }catch(e){}
    }
    if(seit>=MAX){
      clearInterval(timer);
      hinw('Abgebrochen &ndash; keine Admin-Anmeldung. Die Daten sind nicht verloren: '
        +'im Kurzbefehl noch einmal ausf&uuml;hren.','#cf5442');
      setTimeout(weg, 12000);
    }
  }, TAKT);
})();

/* Empfaenger: admin.html?neu=<Adresse> -> Editor auf, Riki liest sofort. */
(function rkSchnellAnlageEmpfangen(){
  if(typeof window==="undefined" || !window.__ADMIN_PAGE) return;
  var ziel=null;
  try{ ziel=new URLSearchParams(location.search).get("neu"); }catch(e){}
  if(!ziel || !/^https?:\/\//i.test(ziel)) return;
  /* Adresse SOFORT aus der Zeile nehmen: sonst legt ein Neuladen (oder ein wiederhergestellter
     Tab) dasselbe Produkt ein zweites Mal an. */
  try{ history.replaceState(null,"",location.pathname+location.hash); }catch(e){}

  function hinweis(txt,farbe){
    var b=document.getElementById("rkSchnellHinweis");
    if(!b){ b=document.createElement("div"); b.id="rkSchnellHinweis";
      b.style.cssText="position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9998;max-width:min(560px,92vw);padding:11px 16px;border-radius:11px;font-size:13.5px;font-weight:600;box-shadow:0 8px 26px -12px rgba(20,40,70,.5);background:#ffffff;border:1px solid #e2e8ef";
      document.body.appendChild(b); }
    b.style.color=farbe||"#1d3c24"; b.innerHTML=txt;
    return b;
  }
  function weg(){ var b=document.getElementById("rkSchnellHinweis"); if(b) b.remove(); }

  var kurz=ziel.replace(/^https?:\/\//i,"").split("/")[0];
  hinweis('Schnellanlage: <b>'+esc(kurz)+'</b> &ndash; warte auf die Anmeldung&hellip;');

  var seit=0, MAX=60000, TAKT=400;   /* 60 s: reicht auch, wenn erst noch angemeldet wird */
  var loginGezeigt=false;
  var timer=setInterval(function(){
    seit+=TAKT;
    if(typeof ME!=="undefined" && ME && ME.is_admin){
      clearInterval(timer);
      hinweis('Editor geht auf, Riki liest <b>'+esc(kurz)+'</b>&hellip;');
      try{
        var pr=openFgEditor(null);
        var nach=function(){ window._rkSchnell=true;   /* merkt sich: dieser Editor kam per Lesezeichen.
            Nach "Speichern & freigeben" bleibt er dann OFFEN und zeigt das angelegte Produkt
            (Ralph 27.07.: "das angelegte Produkt soll offen sein, damit ich es pruefen und
            anpassen kann"). Beim normalen Weg schliesst er weiter wie seit 23.07. */
          try{ rkImpAfterOpen(ziel); }catch(e){}
          setTimeout(function(){ hinweis('&#10003; Riki liest <b>'+esc(kurz)+'</b> &ndash; Werte pr&uuml;fen, dann freigeben.','#166534');
            setTimeout(weg, 6000); }, 300); };
        if(pr && typeof pr.then==="function") pr.then(nach); else setTimeout(nach,500);
      }catch(e){ hinweis('Editor liess sich nicht oeffnen: '+esc(String(e&&e.message||e)),'#cf5442'); }
      return;
    }
    if(seit>3000 && !loginGezeigt && (typeof ME==="undefined" || !ME)){
      loginGezeigt=true;
      hinweis('Bitte anmelden &ndash; die Seite <b>'+esc(kurz)+'</b> wird danach automatisch eingelesen.','#92400e');
      try{ if(typeof openLogin==="function") openLogin(); }catch(e){}
    }
    if(seit>=MAX){
      clearInterval(timer);
      hinweis('Schnellanlage abgebrochen &ndash; keine Admin-Anmeldung. Adresse: <b>'+esc(ziel)+'</b> (kopieren und im Riki-Import einf&uuml;gen).','#cf5442');
    }
  }, TAKT);
})();

/* ============================================================================
   WORK #122 — RIKI-BEGLEITER, PHASE A: DIE SCHALE

   Ralph 18.08.: RIKI soll auf allen Consumer-Seiten als kleiner schwebender
   Knopf sitzen, Klick oeffnet EIN Panel, das den Seitenzusammenhang kennt.

   🔴 PHASE A IST BEWUSST DUMM. Kein Gesundheitswissen, keine Regel, kein
   Profil, keine Antwort. Sie liefert genau zwei Dinge: den Knopf und den
   Zusammenhang. Alles Fachliche kommt serverseitig (Phase B ff., #122).
   Eine Gesundheitsregel in JavaScript waere die zweite Kopie einer Regel,
   die es serverseitig noch gar nicht gibt (§4.2, §10.2).

   🔴 UND SIE LUEGT NICHT. Das Panel zeigt in dieser Phase, WAS RIKI erkannt
   hat, und sagt ausdruecklich, dass er noch nicht antwortet. Ein Eingabefeld,
   das Fragen entgegennimmt und nichts tut, waere eine Attrappe - derselbe
   Fehler wie ein Chip, der aussieht wie ein Knopf (Ralph P12).

   §22-BEFUND VOR DEM BAU, gemessen an app.js, index.html und ui.css:
     - Es gibt KEINEN schwebenden Knopf, KEIN Panel und KEINEN Chat. Neubau.
     - "rikiView" existiert, ist aber der ADMIN-Import "Daten holen per Riki".
       Nicht verwechseln - der Begleiter ist etwas anderes.
     - Einen Erinnerungs-Weg gibt es im Frontend NICHT (ChatGPT fragte danach
       in #122). Deshalb zeigt Phase A keine Erinnerungen an: ohne Serverweg
       waere jede Anzeige eine Behauptung.
     - window._curMode fuehrt die aktuelle Seite bereits - kein zweiter
       Seitenzaehler noetig (§22).

   🔴 GETEILT MIT #125: dieser Knopf IST das "Riki-Symbol", das die
   Warteschlange melden soll. #125 baut KEIN zweites Symbol, sondern haengt
   sich mit rikiBadge() an dieses hier. Zwei Symbole waeren §4.2.

   PLATZ, gemessen statt geschaetzt: .bottomnav klebt unten mit z-index 40,
   body traegt padding-bottom:calc(78px + safe-area). Der Knopf sitzt deshalb
   78px + Abstand ueber dem unteren Rand - sonst verdeckt er die Navigation.
   z-index 9990: ueber dem Inhalt, aber UNTER den Overlays (9992-9996), damit
   er sich nicht ueber ein offenes Fenster legt.
   ============================================================================ */
function rikiShellAktiv(){
  /* app.js wird von index.html UND admin.html geladen.
     🔴 20.08.2026 KORRIGIERT: hier stand "Die Bodenleiste ist das Merkmal, das
     nur dort existiert - eine Tatsache, kein Dateinamen-Raten." Das war falsch.
     admin.html traegt eine <nav class="bottomnav"> (Z. 1445) und blendet sie nur
     per CSS aus (Z. 1488). Die Pruefung hat also IMMER true geliefert, und der
     Begleiter erschien im Admin - genau das hat Ralph im Editor gesehen.

     Eine Tatsache, die niemand nachgemessen hat, ist eine Vermutung. Ich habe
     die Zeile beim Bauen von #122 geschrieben, ohne in admin.html nachzusehen.

     GEWOLLT IST ER DORT INZWISCHEN (Work #133 E5: Riki erklaert die drei
     Erfassungsstationen), deshalb bleibt die Rueckgabe true - die Begruendung
     stimmt jetzt nur mit dem ueberein, was tatsaechlich passiert. */
  return true;
}
/* Der Seitenzusammenhang. Wird bei JEDEM Oeffnen frisch erhoben, nie gecacht -
   ein gemerkter Zusammenhang waere beim naechsten Oeffnen der vorige. */
function rikiKontext(){
  var seite = (typeof window!=="undefined" && window._curMode) ? String(window._curMode) : "start";
  var k = { seite: seite, produkt_id: null, suchbegriff: null, rezept_id: null };
  if(seite==="produkte" && window._offenesProdukt) k.produkt_id = window._offenesProdukt;
  if(seite==="produkte"){ var qi=document.getElementById("q"); if(qi && qi.value.trim()) k.suchbegriff = qi.value.trim(); }
  if(seite==="rezepte" && window._rezept && window._rezept.id) k.rezept_id = String(window._rezept.id);
  /* 🔴 20.08.2026: Die Startseite hat ZWEI Gesichter - renderStart() verzweigt
     an ME und baut ausgeloggt eine ganz andere Seite. Die Station kommt aus
     derselben Variablen, an der auch renderStart verzweigt; ein zweites Merkmal
     danebenzustellen hiesse, dass eines davon irgendwann das andere widerlegt. */
  if(seite==="start") k.station = (typeof ME!=="undefined" && ME) ? "nutzer" : "gast";
  /* 🔴 20.08.2026, Work #133 E5 — DER EDITOR IST JETZT EINE SEITE, DIE RIKI KENNT.
     Ralph: "riki hat sich nicht verändert."

     Er stand im Editor und sagte "Ich weiß gerade nicht, wo du bist" - richtig
     und ehrlich, aber nutzlos. `_curMode` beschreibt die Benutzersicht; der
     Admin-Editor taucht darin nicht auf.

     ERKANNT WIRD AN #feRahmen, nicht am Dateinamen: der Rahmen existiert genau
     dann, wenn der Editor offen ist. Eine Tatsache, kein Raten - dieselbe
     Ueberlegung wie bei rikiShellAktiv und der Bodenleiste.

     Die STATION kommt aus FE_SCHRITTE und window._feSchritt, den Traegern des
     Arbeitsflusses. Kein eigener Zaehler daneben (§4.2). */
  if(document.getElementById("feRahmen")){
    k.seite="erfassung";
    var s=null;
    try{ s=(typeof FE_SCHRITTE!=="undefined") ? FE_SCHRITTE.find(function(x){ return x.nr===(window._feSchritt||1); }) : null; }catch(e){}
    k.station = s ? s.id : null;                       /* kopf | analyse | bestand */
    k.stationstitel = s ? s.t : null;
    k.produkt_id = (window._fgEdit && window._fgEdit.id) || null;
  }
  return k;
}
/* ============================================================================
   WAS KANN ICH AUF DIESER SEITE?  (Ralph 19.08.: "gut waere auch, wenn man ihn
   auf einer seite oeffnet, das er mir die seite und die funktionen erklaert.")

   🔴 DIESE TEXTE MACHT KEIN MODELL, UND DAS IST DER GANZE PUNKT.
   Ein Sprachmodell weiss nicht, was in app.js steht. Gefragt, was diese Seite
   kann, wuerde es plausibel klingende Knoepfe beschreiben, die es nicht gibt -
   und der Nutzer wuerde sie suchen. Das ist derselbe Fehlertyp wie eine
   erfundene Naehrwertzahl, nur an der Oberflaeche (§1.1).
   Kuratierte Texte sind sofort da, kosten nichts und sind richtig, solange
   jemand sie pflegt. Der Preis steht unten.

   🔴 NUR BELEGTE SEITEN STEHEN HIER. Ich habe die Knoepfe am 19.08. aus
   index.html erhoben. Bei start, einkauf und rezepte ueberlappten die
   Seitenbereiche im HTML so, dass ich die Knoepfe nicht sicher der richtigen
   Seite zuordnen konnte - deshalb steht dort NICHTS statt einer Vermutung.
   Riki sagt dann ehrlich, dass er die Seite noch nicht erklaeren kann.

   ⚠ DER PREIS, offen benannt: das ist eine zweite Stelle, an der steht, was die
   App kann - die erste ist die App selbst. Wer einen Knopf umbenennt und das
   hier vergisst, laesst Riki etwas Falsches sagen. Dagegen hilft nur dieselbe
   Regel wie bei den Funktionsinventaren (§10.5): wer ein Element aendert, zieht
   es im selben Durchgang nach. Ein Mechanismus dafuer existiert NICHT - das ist
   eine bewusste Schwaeche und keine uebersehene.
   ============================================================================ */
var RIKI_SEITENHILFE={
  /* 🔴 20.08.2026, Ralph-Auftrag: "auf der startseite soll riki erklaeren, was
     root index ist und wie es funktioniert."

     🔴 WARUM ES DIE STARTSEITE BIS HEUTE NICHT GAB: am 19.08. stand hier
     "start, einkauf und rezepte ueberlappten im HTML" - deshalb kein Eintrag.
     Das war ein Werkzeugfehler, kein Datenfehler: die Startseite wird NICHT in
     index.html gebaut, sondern in renderStart() (Z. 10237). Dort steht sie
     vollstaendig und eindeutig. Wer am falschen Ort sucht, findet nichts und
     haelt das fuer einen Befund (§0.4).

     ZWEI ZUSTAENDE, ZWEI TEXTE: eingeloggt zeigt renderStart Kennzahlen und
     sieben Kacheln, ausgeloggt eine Willkommenkarte und vier. Ein Text fuer
     beides waere fuer die Haelfte der Leser falsch. Der Schluessel folgt der
     Bauart von "erfassung:kopf" - Station statt zweiter Namensraum (§4.2). */
  start:{ was:"Dein Tagesüberblick – und der Einstieg in alles Weitere.",
    kann:["Oben stehen <b>kcal</b> und die vier Säulen <b>Eiweiß · KH · Fett · Ballaststoffe</b>, gefüllt gegen dein Ziel aus dem Profil.",
          "Die <b>Kacheln</b> führen zu Produkten, Rezepten, Tagebuch, Training, Zyklus, Darmgesundheit und Einkaufsliste.",
          "Das <b>Strichcode-Symbol</b> oben rechts auf der Produkte-Kachel scannt sofort – ohne Umweg über die Suche.",
          "Das <b>Wasser-Feld</b> zählt die Gläser des Tages mit.",
          "Mit Premium kommen <b>Schritte</b> und <b>Schlaf</b> dazu."] },
  "start:gast":{ was:"Die Startseite ohne Anmeldung – schauen geht, speichern nicht.",
    kann:["<b>Anmelden / Registrieren</b> schaltet Tagebuch, Ziele und Verlauf frei.",
          "<b>Produkte ansehen</b> öffnet die Suche – auch ohne Konto.",
          "Im Feld darunter suchst du direkt nach <b>Rezepten</b>.",
          "Die vier Kacheln zeigen, was es gibt: Produkte, Rezepte, Tagebuch, Training.",
          "Ganz unten steht, wie du Root Index <b>als App</b> auf den Startbildschirm legst."] },
  /* 🔴 20.08.2026, A7 aus dem Konzeptkatalog: die fuenf fehlenden Seiten.
     JEDER Knopf unten wurde am 20.08. im Code nachgesehen, mit Fundstelle:
     einkauf  → renderEinkaufSeite/loadEinkauf, app.js Z. 15877 und 16086
     rezepte  → index.html Z. 1040-1053, renderRezeptList Z. 31537
     training → renderTraining, app.js Z. 29803
     zyklus   → renderZyklus/zyklusBundleHtml, app.js Z. 9966
     darm     → renderDarm/darmBundleHtml, app.js Z. 9972
     Kein Knopf ist beschrieben, den es nicht gibt (§1.1). */
  einkauf:{ was:"Was du noch brauchst – auf einer Liste, die auch dein Haushalt sieht.",
    kann:["Ins Feld <b>Ich brauche…</b> tippen und mit <b>+ Hinzufügen</b> aufnehmen – aus dem Katalog kommen Vorschläge.",
          "<b>📷 Barcode</b> nimmt ein Produkt direkt aus der Hand auf.",
          "<b>Aus dieser Woche erzeugen</b> füllt die Liste aus deinem Wochenplan.",
          "Antippen hakt ab: Erledigtes bleibt grau und durchgestrichen stehen, statt zu verschwinden.",
          "Gehörst du zu einem <b>Haushalt</b>, seht ihr eine gemeinsame Liste – ein Kürzel zeigt, wer was eingetragen hat."] },
  rezepte:{ was:"Rezepte mit denselben vier Prüfungen wie die Produkte dahinter.",
    kann:["<b>🍳 Was koche ich?</b> schlägt etwas aus deinem Vorrat vor.",
          "<b>📷 Abfotografieren</b> liest ein Rezept vom Blatt oder aus dem Buch.",
          "<b>+ Eigenes Rezept</b> legt eins von Hand an.",
          "Das <b>♥</b> an einer Karte merkt sich ein Rezept; der Haken darunter zeigt nur noch die Favoriten.",
          "Über die Suche findest du nach Name – Sammlungen bündeln Zusammengehöriges."] },
  training:{ was:"Plan, Übungen und was du davon tatsächlich gemacht hast.",
    kann:["Die fünf Reiter: <b>Plan · Übungen · Geräte · Statistik · Tagebuch</b>.",
          "Unter <b>⏱️ Zeitbudget pro Training</b> stellst du ein, wie lange eine Einheit dauern darf.",
          "<b>🏋️ Meine Geräte zuhause</b> begrenzt die Vorschläge auf das, was du wirklich hast.",
          "<b>💪 Übungs-Datenbank</b> zeigt die Ausführung je Übung.",
          "<b>📒 Ins Trainingstagebuch übernehmen</b> schreibt die Einheit fest – erst danach zählt sie auf der Startseite."] },
  zyklus:{ was:"Eine handverlesene Produktauswahl zu Zyklus und Nährstoffbedarf.",
    kann:["Je Kategorie stehen die Produkte, die in unserer Bewertung am besten abschneiden.",
          "Wo eine Kategorie eine <b>übliche Tagesmenge aus Studien</b> nennt, ist das eine Angabe zur Einordnung – <b>keine Empfehlung für dich</b>.",
          "Fehlt bei einer Kategorie die Rangfolge, sind die Produkte nicht vergleichbar genug – dann steht das dort.",
          "Die Seite ist als <b>Anzeige</b> gekennzeichnet, Partner-Links sind möglich. Die Bewertung selbst bleibt davon unberührt.",
          "Das ist keine medizinische Beratung – bei Beschwerden oder Verdacht auf einen Mangel gehört das in ärztliche Hände."] },
  darm:{ was:"Ballaststoffe, Probiotika und Präbiotika – die Basics, sauber bewertet.",
    kann:["Je Kategorie zeigen wir handverlesene Produkte mit ihrem Root Index.",
          "Angaben zur üblichen Menge stehen zur <b>Einordnung</b> dort, nicht als Anweisung.",
          "Nicht vergleichbare Kategorien tragen keinen Rang – das steht ausdrücklich dabei.",
          "Auch diese Seite ist <b>Anzeige</b> mit möglichen Partner-Links.",
          "Keine medizinische Beratung. Was der Darm braucht, entscheidet niemand über eine Produktkachel."] },
  tagebuch:{ was:"Hier steht, was du heute gegessen hast – und was das ergibt.",
    kann:["Mit den Pfeilen blätterst du durch die Tage, <b>Heute</b> springt zurück.",
          "<b>📊 Statistik</b> zeigt kcal-, Gewichts- und Zuckerverlauf über 7 oder 30 Tage.",
          "<b>🥗 Nährstoffe</b> öffnet die Mikronährstoffe des Tages.",
          "Das <b>+</b> an einer Mahlzeit fügt etwas hinzu, auch per Barcode.",
          "<b>Zucker</b> und <b>Salz</b> antippen zeigt, aus welchen Posten sie kommen."] },
  produkte:{ was:"Die Produktsuche – hier findest du, was schon bewertet ist.",
    kann:["Suchen kannst du nach <b>Produkt, Marke oder Kategorie</b>.",
          "<b>📷 Barcode scannen</b> geht direkt auf das Produkt in der Hand.",
          "Kennt die Datenbank es nicht, fotografierst du das Etikett – ich lese es."] },
  profil:{ was:"Deine Angaben – und die Ziele, gegen die das Tagebuch rechnet.",
    kann:["<b>Daten</b> und <b>Körpermaße</b> sind die Grundlage für den Bedarf.",
          "Unter <b>Ziele</b> stehen Kalorien- und Nährstoffziele.",
          "Änderungen gelten erst nach <b>Speichern</b>."] },
  planer:{ was:"Die Vorausplanung für einen Tag oder eine Woche.",
    kann:["Zwischen <b>Tag</b> und <b>Woche</b> umschalten.",
          "<b>Mahlzeiten</b> planen und mit <b>Hinzufügen</b> eintragen.",
          "Aus dem Plan heraus die <b>🛒 Einkaufsliste</b> füllen."] },
  /* 🔴 20.08.2026, Work #133 E5 — DIE DREI EDITOR-STATIONEN.
     Jeder genannte Knopf wurde am 20.08. im Code nachgesehen (openFgEditor,
     Z. 22734-23562) und traegt dort genau diese Beschriftung. Kein Knopf ist
     beschrieben, den es nicht gibt - das ist derselbe Anspruch wie bei einer
     Naehrwertzahl (§1.1), nur an der Oberflaeche.
     Die Schluessel heissen wie die Stationen in FE_SCHRITTE: kopf, analyse,
     bestand. Zwei Namensraeume fuer dieselbe Sache waeren §4.2. */
  "erfassung:kopf":{ was:"Station 1 – hier bekommt das Produkt seine Identität und eine belegte Quelle.",
    kann:["<b>Riki liest ▸</b> holt die Angaben von der Herstellerseite, <b>Text lesen ▸</b> aus einem eingefügten Etikettentext.",
          "<b>🏷 Etikett-Foto</b> und <b>📸 Foto → Seite</b> lesen aus Bildern; <b>🏷 OFF</b> und <b>USDA</b> schlagen extern nach.",
          "<b>Produktname</b> und <b>Kategorie</b> sind Pflicht, ohne sie gibt es keine Freigabe.",
          "<b>Quelle-Typ</b> und <b>Beleg</b> stehen links im Streifen – auch sie sind Freigabe-Pflicht.",
          "<b>Bio</b> und die <b>Ernährungsform</b> sind Merkmale, keine Punkte: Bio gibt keinen Bonus im Index."] },
  "erfassung:analyse":{ was:"Station 2 – die Nährwerttabelle des Etiketts und, falls vorhanden, die Wirkstoffe.",
    kann:["Die zwölf Nährwertfelder gelten für die <b>Bezugsbasis</b>, die du oben einstellst – meist 100 g.",
          "<b>Ballaststoffe nicht deklariert</b> ankreuzen ist etwas anderes als eine 0: leer heißt unbekannt.",
          "<b>+ Wirkstoff</b> für Nahrungsergänzung, <b>+ setzen</b> für Mikronährstoffe je 100 g.",
          "Rechts liegt das <b>Etikett zum Ablesen</b> – zoombar, und <b>🖼 Als Produktbild</b> übernimmt es.",
          "<b>🤖 Riki liest das Bild</b> füllt die Felder aus dem Foto, ersetzt aber dein Nachsehen nicht."] },
  "erfassung:bestand":{ was:"Station 3 – jede Zutat vom Etikett bekommt ihre Entsprechung im Stamm.",
    kann:["<b>Analysieren</b> zerlegt die eingefügte Zutatenliste, <b>OFF-Gegenprobe</b> vergleicht mit Open Food Facts.",
          "Im Suchfeld findest du vorhandene Zutaten; steht eine nicht im Stamm, hast du zwei Wege: binden oder <b>keine eigene Zutat</b>.",
          "<b>Keine Zusatzstoffe im Produkt</b> ist eine Aussage – kein Haken heißt nur, dass niemand hingesehen hat.",
          "Unter <b>Gegenüberstellung</b> stehen Etikett und Erfassung nebeneinander, <b>Nur Abweichungen</b> filtert.",
          "Fehlt der Zutaten-Rohtext, bleibt der Abgleich leer. Das ist kein Blocker für die Freigabe."] }
};
/* ============================================================================
   WAS IST ROOT INDEX?  (Ralph 20.08.: "auf der startseite soll riki erklaeren,
   was root index ist und wie es funktioniert.")

   🔴 JEDER SATZ HIER IST BELEGT, KEINER GERATEN:
   - die vier Achsen und ihre Gewichte: CLAUDE.md §4.1 (30 · 15 · 15 · 40 = 100)
   - "fehlt eine Achse, gibt es keine Note": §4.3 - eine fehlende Angabe darf
     kein Produkt besser aussehen lassen als eines, das seine Zahlen nennt
   - "Bio ist Merkmal, kein Bonus": §4.5
   - "Nahrungsergaenzung bekommt keinen vergleichbaren Index": §4.4
   Ein Sprachmodell wuerde hier plausible Prozente erfinden. Genau deshalb steht
   der Text kuratiert im Code und kommt nicht aus einem Modell (§1.1).

   ⚠ DERSELBE PREIS wie bei RIKI_SEITENHILFE: aendern sich die Gewichte in §4.1,
   luegt dieser Text, bis jemand ihn nachzieht. Ein Mechanismus dagegen existiert
   NICHT - bewusste Schwaeche, keine uebersehene.
   ============================================================================ */
var RIKI_INTRO={
  was:"Root Index liest die Rückseite der Packung – nicht die Werbung auf der Vorderseite.",
  punkte:["Jedes Lebensmittel bekommt eine Note von <b>0 bis 100</b> aus vier Prüfungen: <span id=\"rikiIntroAchsen\">…</span>",
          "<b>Jede Zahl hat eine Quelle</b> – Etikett, Hersteller oder amtlicher Bezugswert. Gibt es keine Quelle, gibt es keine Zahl.",
          "<b>Fehlt eine der vier Prüfungen, gibt es keine Note</b> statt einer guten. Wer nichts angibt, gewinnt hier nichts.",
          "<b>Bio ist ein Merkmal, kein Bonus.</b> Es ändert die Note nicht – du kannst danach filtern.",
          "<b>Nahrungsergänzung</b> bekommt bewusst keine vergleichbare Note: Höchstmengen und Wirkstoffformen lassen sich nicht in eine Zahl pressen.",
          "Was du isst, trägst du ins <b>Tagebuch</b> ein – daraus entstehen Tagessummen gegen deine Ziele."],
  fuss:"Root Index bewertet Produkte, keine Menschen – und ersetzt keine ärztliche Beratung."
};
/* ============================================================================
   🔴 20.08.2026 NACHMITTAGS — MEINE EIGENE ZWEITE KOPIE, KORRIGIERT

   Heute Morgen habe ich die vier Achsen hier als Text hingeschrieben: „Zutaten
   (30), Zusatzstoffe (15), Verarbeitungsgrad (15), Nährwert (40)" — und im
   Kommentar darunter selbst notiert, dass das eine zweite Stelle ist, die
   luegt, sobald jemand §4.1 aendert.

   GEMESSEN am selben Tag: die Achsen stehen laengst in der Datenbank und
   werden ueber `cb_methodik` ausgeliefert; die Methodik-Seite zeichnet ihre
   Balken daraus. Es war also keine unvermeidliche Doppelpflege, sondern eine
   vermeidbare — ich hatte nur nicht nachgesehen (§22).

   JETZT holt RIKI dieselben Zahlen aus derselben Quelle. Faellt sie aus,
   steht der Satz OHNE Zahlen da statt mit veralteten: eine fehlende Angabe
   ist ehrlich, eine falsche nicht (§3.4).
   ============================================================================ */
function rikiIntroAchsenText(){
  var m=window._methodik;
  var arr=(m&&m.achsen)||[];
  var teile=[];
  arr.forEach(function(a){
    if(!a || a.schluessel==="uebersicht") return;
    var w=String(a.wert||"").replace(/\s*Punkte?\s*$/i,"").trim();   /* „30 Punkte" → „30" */
    if(a.titel && w) teile.push("<b>"+esc(a.titel)+"</b> ("+esc(w)+")");
  });
  return teile.length ? teile.join(", ")+"." : "";
}
/* Nachtragen, sobald die Quelle da ist. Der Platzhalter wird NUR ersetzt, wenn
   wirklich Achsen kamen - sonst bleibt der ehrliche Ersatzsatz stehen. */
function rikiIntroAchsenNachtragen(){
  try{
    if(typeof methodikLaden!=="function") return;
    methodikLaden().then(function(){
      var el=document.getElementById("rikiIntroAchsen"); if(!el) return;
      var t=rikiIntroAchsenText();
      el.innerHTML = t || "Die vier Achsen konnte ich gerade nicht laden – sie stehen unter „Unsere Methode“.";
    }).catch(function(){});
  }catch(e){}
}
/* Die Erklaerung ist abschaltbar (Ralph 20.08.). Der Schalter steht in
   index.html neben rikiSichtbar; fehlt er, gilt AN - eine fehlende Einstellung
   darf nichts verschweigen (§3.4). */
function rikiIntroHtml(){
  if(typeof window.rikiIntroAn==="function" && !window.rikiIntroAn()) return "";
  /* Sind die Achsen schon im Speicher, stehen sie sofort da - sonst tragen wir
     sie nach, sobald cb_methodik geantwortet hat. */
  var _sofort=rikiIntroAchsenText();
  setTimeout(rikiIntroAchsenNachtragen,0);
  return '<div style="background:radial-gradient(130% 130% at 20% 10%,#1F5E39,#0B1710 70%);border-radius:12px;padding:12px 13px;margin-bottom:10px">'
    +'<div style="color:#5EF2A0;font-size:12px;font-weight:700;margin-bottom:5px">Was ist Root Index?</div>'
    +'<div style="color:#fff;font-size:13px;line-height:1.5;margin-bottom:7px">'+RIKI_INTRO.was+'</div>'
    +'<ul style="margin:0 0 7px;padding-left:17px;font-size:12px;color:rgba(255,255,255,.72);line-height:1.6">'
    + RIKI_INTRO.punkte.map(function(z){
        /* Der Platzhalter wird gefuellt, wenn die Achsen schon da sind - sonst
           bleibt er stehen und rikiIntroAchsenNachtragen() setzt ihn. */
        if(_sofort) z=z.replace('<span id="rikiIntroAchsen">…</span>','<span id="rikiIntroAchsen">'+_sofort+'</span>');
        return '<li style="margin-bottom:4px">'+z+'</li>';
      }).join('')
    +'</ul>'
    +'<div style="font-size:11px;color:rgba(255,255,255,.5);line-height:1.45">'+RIKI_INTRO.fuss+'</div>'
    +'</div>';
}
function rikiSeitenhilfeHtml(seite, station){
  /* Im Editor entscheidet die Station, nicht die Seite - "erfassung" allein
     erklaert nichts, es gibt drei verschiedene Arbeitsschritte darunter.
     20.08.: gilt jetzt fuer JEDE Seite mit Station (start:gast), damit nicht
     jede neue Unterscheidung eine eigene Zeile hier braucht. */
  var h=RIKI_SEITENHILFE[(station ? (seite+":"+station) : seite)] || RIKI_SEITENHILFE[seite];
  if(!h){
    /* Ehrlich statt hilfsbereit: eine erfundene Erklaerung waere schlimmer als
       keine, weil der Nutzer danach sucht, was ich behauptet habe. */
    return '<div style="font-size:12.5px;color:var(--tb-muted);line-height:1.5;background:var(--tb-card2,var(--k-fbf8f2));border-radius:10px;padding:10px 11px">'
      +'Diese Seite kann ich noch nicht erklären – ich sage lieber nichts, als etwas zu erfinden.</div>';
  }
  return '<div style="font-size:13.5px;color:var(--tb-text,var(--ink));line-height:1.5;margin-bottom:8px">'+h.was+'</div>'
    +'<ul style="margin:0 0 4px;padding-left:18px;font-size:12.5px;color:var(--tb-muted);line-height:1.6">'
    + h.kann.map(function(z){ return '<li style="margin-bottom:4px">'+z+'</li>'; }).join('')
    +'</ul>';
}
/* Klartext fuer das Panel. Bewusst als eigene Funktion: der Kontext ist Technik,
   der Satz ist Oberflaeche - und nur der Satz aendert sich, wenn Ralph ihn anders
   haben will. */
function rikiKontextText(k){
  /* 🔴 20.08.2026, E5: Im Editor sagt Riki nicht nur WO, sondern WIE WEIT.
     Die Zahlen kommen aus getErfassungsStatus() - derselben Quelle, aus der der
     weisse Statusstreifen seine Chips baut. Kein zweites Rechnen, keine zweite
     Wahrheit (§4.2). Antwortet sie nicht oder kennt sie das Produkt nicht,
     bleibt der Satz bei Ort und Station stehen; geraten wird nichts (§1.2). */
  if(k.seite==="erfassung"){
    var t="Du bearbeitest "+(k.produkt_id?("<b>"+esc(k.produkt_id)+"</b>"):"ein neues Produkt")
      +(k.stationstitel?(", Station <b>"+esc(k.stationstitel)+"</b>"):"")+".";
    var S=null; try{ S=(typeof getErfassungsStatus==="function")?getErfassungsStatus():null; }catch(e){}
    if(S && S.bekannt){
      /* 🔴 20.08.2026, E5 — DIE ECHTEN GRUENDE STATT DREIER OBERBEGRIFFE.
         Hier standen „die Quelle fehlt / die Naehrwerte sind unvollstaendig /
         n von m Bestandteilen" — eine eigene, groebere Zusammenfassung neben
         der Liste, die getErfassungsStatus ohnehin fuehrt. Wer „unvollstaendig"
         liest, weiss nicht, WELCHER Wert fehlt, und muss doch in die Karte
         schauen; und wenn ein vierter Grund dazukommt (etwa der
         Zusatzstoffstatus seit 14.08.), kannte die Zusammenfassung ihn nicht
         und meldete faelschlich „nichts offen" (§4.2).
         Jetzt werden die Gruende genannt, die der Statusstreifen und die
         Freigabekarte auch nennen — mit ihrer STATION, damit klar ist, wohin.
         Hoechstens vier, damit der Satz lesbar bleibt; der Rest wird gezaehlt,
         nicht verschwiegen. */
      var G=Array.isArray(S.freigabe_gruende)?S.freigabe_gruende:[];
      if(G.length){
        var _st={kopf:"Station 1",analyse:"Station 2",bestand:"Station 3"};
        var zeig=G.slice(0,4).map(function(g){
          var w=g&&g.s&&_st[g.s]?(" ("+_st[g.s]+")"):"";
          return esc(String((g&&g.t)||"")) + w;
        });
        t += " <b>Für die Freigabe fehlt noch:</b> "+zeig.join(" · ")
          + (G.length>4 ? (" · und "+(G.length-4)+" weitere") : "") + ".";
        if(S.bestandteile_gesamt && S.bestandteile_offen)
          t += " Bestandteile im Stamm: "+(S.bestandteile_gesamt-S.bestandteile_offen)+" von "+S.bestandteile_gesamt+".";
      }
      else if(S.freigabe_moeglich) t += " <b>Für die Freigabe fehlt nichts mehr.</b>";
    }
    return t;
  }
  /* 🔴 20.08.2026, A9 — DIE ZAHL DIESES PRODUKTS, NICHT DIE REGEL IM ALLGEMEINEN.
     „Du siehst gerade das Produkt P1234" war richtig und nutzlos. Gefragt wird
     vor einer Kachel nicht, wie der Index gebaut ist, sondern warum DIESE Zahl
     dasteht - oder warum keine.
     Die Werte kommen aus demselben Datensatz, den die Karte zeichnet
     (window._offenesProduktD, ein Verweis) und aus denselben Feldern wie der
     Fluxkompensator: p_zutaten 30 · p_zusatzstoffe 15 · p_nova 15 ·
     p_naehrwert ×2 = 40. Kein zweites Rechnen, keine zweite Skala (§4.2).
     FEHLT eine Achse, wird das GESAGT statt weggelassen: eine fehlende Achse
     ist der Grund, warum es keine Note gibt (§4.3). */
  if(k.produkt_id){
    var t="Du siehst gerade das Produkt <b>"+esc(k.produkt_id)+"</b>.";
    var d=null; try{ d=window._offenesProduktD; }catch(e){}
    if(d && String(d.id||"")===String(k.produkt_id)){
      var A=[["Zutaten",num(d.p_zutaten),30],["Zusatzstoffe",num(d.p_zusatzstoffe),15],
             ["Verarbeitung",num(d.p_nova),15],
             ["Nährwert",(num(d.p_naehrwert)!=null?num(d.p_naehrwert)*2:null),40]];
      var da=A.filter(function(a){ return a[1]!=null; }), fehlt=A.filter(function(a){ return a[1]==null; });
      var s=num(d.clean_score);
      if(s!=null) t+=" Der Root Index ist <b>"+Math.round(s)+"</b> von 100.";
      /* Ohne Gesamtnote darf der Satz nicht „Er kommt aus" lauten - es gibt kein
         „er". Beim Gegenlesen der Testausgabe aufgefallen. */
      if(da.length) t+=(s!=null?" Er kommt aus: ":" Berechnet sind bisher: ")
        +da.map(function(a){ return esc(a[0])+" "+(Math.round(a[1]*10)/10)+"/"+a[2]; }).join(" · ")+".";
      if(fehlt.length) t+=" <b>Ohne Zahl bleibt:</b> "+fehlt.map(function(a){ return esc(a[0]); }).join(" · ")
        +" – "+(fehlt.length===1?"diese Angabe fehlt":"diese Angaben fehlen")
        +". Fehlende Daten geben hier keine Punkte und auch keinen Abzug; sie fehlen einfach.";
      if(s==null) t+=" Eine Gesamtnote gibt es deshalb nicht – eine fehlende Zahl ist ehrlicher als eine geschätzte.";
    }
    return t;
  }
  if(k.suchbegriff) return "Du suchst gerade nach <b>"+esc(k.suchbegriff)+"</b>.";
  if(k.rezept_id) return "Du siehst gerade ein Rezept.";
  var n={start:"der Startseite",produkte:"der Produktsuche",rezepte:"den Rezepten",tagebuch:"deinem Tagebuch",
         planer:"dem Planer",einkauf:"der Einkaufsliste",profil:"deinem Profil",training:"dem Training"}[k.seite];
  return n ? ("Du bist gerade auf "+n+".") : "Ich weiß gerade nicht, wo du bist – das ist noch kein Fehler, nur noch nicht angeschlossen.";
}
/* Badge-Schnittstelle fuer #125 und spaeter fuer Erinnerungen und den
   Monatsrueckblick. Phase A setzt sie NIE selbst - sie steht hier, damit #125
   nichts Eigenes bauen muss. anzahl 0 blendet aus. */
function rikiBadge(anzahl){
  var b=document.getElementById("rikiFabBadge"); if(!b) return;
  var n=Number(anzahl)||0;
  b.textContent = n>9 ? "9+" : String(n);
  /* flex, NICHT "" : ein leerer Wert loescht nur den Inlinestil, und ein <span>
     faellt dann auf display:inline zurueck - die Zahl saesse schief im Kreis.
     Beim Bauen selbst gestolpert, deshalb steht es hier. */
  b.style.display = n>0 ? "flex" : "none";
}
/* ----------------------------------------------------------------------------
   DAS SYMBOL (Ralph-Entscheid 18.08.2026: Vorschlag A, Orb mit Gesicht)

   Ralph hat einen Entwurf mit fuenf Zustaenden vorgelegt und A gewaehlt. Als
   INLINE-SVG statt als Bilddatei, aus drei Gruenden: es skaliert ohne zweite
   Datei, es kann seine Zustaende selbst schalten, und es kostet keine zweite
   Anfrage beim Laden.

   ⚠ ES IST EIN NACHBAU nach Ralphs Bild, kein Original. Wenn er die Datei
   liefert, wird sie eingesetzt und dieser Block faellt weg.

   🔴 DER SPROESSLING IST KRAEFTIGER ALS IM ENTWURF, und das ist Absicht: bei
   52 px Knopfgroesse ist der Strich aus der Vorlage rund einen Pixel breit und
   damit kein Sproessling mehr, sondern ein Fussel. Lieber sichtbar abweichen
   als unsichtbar treu sein. Ralph 18.08. hat nur "a" gesagt - die Staerke habe
   ich entschieden, nicht er.

   🔴 DER KNOPF HAT KEINEN EIGENEN HINTERGRUND. Der Orb bringt seinen Halo mit;
   eine weisse Scheibe darunter waere ein zweiter Kreis um einen Kreis. Die
   Trefferflaeche bleibt trotzdem 52 px - sie haengt am <button>, nicht am Bild.

   ZUSTAENDE: normal · offen · denkt · bereit. Der Badge ist davon UNABHAENGIG
   (eigenes Element), damit "3 Hinweise" und "denkt gerade" gleichzeitig
   moeglich sind - im Entwurf sind es zwei Bilder, im Betrieb zwei Achsen.
   ---------------------------------------------------------------------------- */
function rikiOrbSvg(){
  return '<svg viewBox="0 0 64 64" style="width:100%;height:100%;display:block;overflow:visible" aria-hidden="true" focusable="false">'
    +'<defs>'
      +'<linearGradient id="rikiHaloGrad" x1="0" y1="1" x2="1" y2="0">'
        +'<stop offset="0" stop-color="#7ed3b2"/><stop offset="1" stop-color="#b3a3f2"/></linearGradient>'
      +'<filter id="rikiBlur" x="-60%" y="-60%" width="220%" height="220%">'
        +'<feGaussianBlur stdDeviation="2.4"/></filter>'
    +'</defs>'
    +'<circle id="rikiGlow" cx="32" cy="32" r="27" fill="#b3a3f2" filter="url(#rikiBlur)" opacity="0"/>'
    +'<circle id="rikiHalo" cx="32" cy="32" r="25" fill="url(#rikiHaloGrad)" filter="url(#rikiBlur)" opacity="0.85"/>'
    +'<circle id="rikiRing" cx="32" cy="32" r="24" fill="none" stroke="#9a8aee" stroke-width="2.5" stroke-linecap="round" opacity="0"/>'
    +'<circle id="rikiKoerper" cx="32" cy="32" r="19" fill="#171b22"/>'
    +'<g id="rikiAugen">'
      +'<ellipse cx="26" cy="32" rx="3.3" ry="4.4" fill="#ffffff"/>'
      +'<ellipse cx="38" cy="32" rx="3.3" ry="4.4" fill="#ffffff"/>'
    +'</g>'
    +'<g id="rikiSpross">'
      +'<path d="M36 18 C36 13.5 39.5 11.5 42.5 11.5" stroke="#4fc08d" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      +'<circle cx="43" cy="11" r="2.6" fill="#4fc08d"/>'
    +'</g>'
    +'<circle id="rikiFertig" cx="49" cy="15" r="6.5" fill="#2fb673" stroke="#ffffff" stroke-width="2" opacity="0"/>'
  +'</svg>';
}
/* Ein Stylesheet, einmal. Die Drehung liegt in CSS und nicht in einem Timer:
   ein Timer laeuft weiter, wenn der Zustand laengst gewechselt hat, und
   verbraucht Strom auf einem Handy, das in der Tasche steckt. */
function rikiStilEinmal(){
  if(document.getElementById("rikiStil")) return;
  var s=document.createElement("style");
  s.id="rikiStil";
  s.textContent="@keyframes rikiDreh{to{transform:rotate(360deg)}}"
    +"#rikiRing.rikiDreht{transform-origin:32px 32px;animation:rikiDreh 1.4s linear infinite}"
    /* 🔴 DAS PANEL ZIEHT SICH AUS DEM KNOPF AUF (Ralph 19.08.: "er koennte beim
       klick darauf sich gross ziehen"). Vorher fuhr unten eine Leiste hoch - das
       sah aus wie ein fremdes Fenster, das zufaellig aufgeht. Jetzt waechst die
       Karte aus der Ecke, in der der Orb sitzt: der Nutzer sieht, WOHER sie kommt
       und wohin sie beim Schliessen zurueckgeht.
       transform-origin sitzt genau auf dem Knopf (unten rechts) - deshalb ist es
       ein Aufziehen und kein Hereinfliegen. */
    +"@keyframes rikiAuf{from{opacity:0;transform:scale(.18)}to{opacity:1;transform:scale(1)}}"
    +"@keyframes rikiZu{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.18)}}"
    +"#rikiPanel{transform-origin:100% 100%;animation:rikiAuf .22s cubic-bezier(.2,.8,.3,1) both}"
    /* 🔴 20.08.2026, Ralph: "riki in frontend unten in der leiste ist schlecht …
       als schalter ist er unten ok, beim klick soll er so erscheinen wie er
       vorher war."
       HIER STAND: #rikiPanel.rikiAusLeiste{transform-origin:78% 100%} - die Karte
       zog sich aus der Leistenmitte auf, weil der Knopf dort steht. Technisch
       stimmig, in der Wirkung falsch: zusammen mit der tieferen Position klebte
       das Panel an der Leiste und wirkte wie ein Teil von ihr statt wie eine
       eigene Karte.
       Die Klasse wird nicht mehr vergeben; die Regel ist entfernt statt
       auskommentiert. Der Knopf bleibt unveraendert in der Leiste - das ist
       ausdruecklich Ralphs "als schalter ist er unten ok". */
    +"#rikiPanel.rikiSchliesst{animation:rikiZu .16s ease-in both}"
    /* Wer Bewegung abgestellt hat, bekommt einen ruhenden Ring und ein Panel ohne
       Aufzieh-Bewegung - aber beides bleibt SICHTBAR. Die Anzeige darf nicht
       verschwinden, nur weil sie sich nicht bewegt. */
    +"@media (prefers-reduced-motion: reduce){"
      +"#rikiRing.rikiDreht{animation:none}"
      +"#rikiPanel,#rikiPanel.rikiSchliesst{animation:none;opacity:1;transform:none}}";
  document.head.appendChild(s);
}
/* Genau EINE Stelle setzt das Aussehen. Vier Zustaende, sonst nichts - wer einen
   fuenften braucht, traegt ihn hier ein und nicht irgendwo als Sonderfall. */
function rikiFabZustand(z){
  var el=function(id){ return document.getElementById(id); };
  var glow=el("rikiGlow"), halo=el("rikiHalo"), ring=el("rikiRing"),
      koerper=el("rikiKoerper"), augen=el("rikiAugen"), spross=el("rikiSpross"), fertig=el("rikiFertig");
  if(!halo) return;                       // Symbol (noch) nicht da - kein Fehler
  var Z={ normal:{glow:0,   halo:.85, ring:0, dreht:false, koerper:1,   augen:1,  spross:1, fertig:0},
          offen: {glow:.55, halo:.85, ring:1, dreht:false, koerper:1,   augen:1,  spross:1, fertig:0},
          denkt: {glow:0,   halo:.35, ring:1, dreht:true,  koerper:.55, augen:.8, spross:0, fertig:0},
          bereit:{glow:0,   halo:.85, ring:0, dreht:false, koerper:1,   augen:1,  spross:1, fertig:1} }[z] || null;
  if(!Z) return;                          // unbekannter Zustand aendert NICHTS (§3.4)
  /* 20.08.: der Sonderfall "in der Leiste flach" ist mit dem Leisten-Knopf
     entfallen. Der schwebende Orb traegt seinen Halo wieder. */
  glow.setAttribute("opacity", Z.glow);
  halo.setAttribute("opacity", Z.halo);
  ring.setAttribute("opacity", Z.ring);
  ring.setAttribute("stroke", Z.dreht ? "#c9c2ea" : "#9a8aee");
  ring.setAttribute("stroke-dasharray", Z.dreht ? "24 14" : "");
  ring.classList.toggle("rikiDreht", Z.dreht);
  koerper.setAttribute("opacity", Z.koerper);
  augen.setAttribute("opacity", Z.augen);
  spross.setAttribute("opacity", Z.spross);
  fertig.setAttribute("opacity", Z.fertig);
  var f=rikiKnopf(); if(f) f.dataset.zustand=z;
}
/* ============================================================================
   WORK #126 — RIKI FRAGEN, PER TEXT ODER SPRACHE
   Ralph 19.08.: "ich kann ihn aber nichts fragen, weder per text noch per sprache."
   Serverweg von ChatGPT: Edge riki-frage v1, POST {frage, kontext}, Antwort
   {ok, antwort, dauer_ms, limit:{heute_genutzt, limit_tag}} bzw. {ok:false, fehler}.
   Tageslimit 30, eigenes Budget, Kontext ausschliesslich serverseitig minimiert.

   🔴 KEIN GESPRAECHSVERLAUF, UND DAS IST BEWUSST SICHTBAR.
   riki-frage nimmt genau EINE Frage; einen Verlauf kennt der Vertrag nicht.
   Wuerde ich Frage und Antwort untereinander stapeln, saehe es wie ein Chat aus,
   und "und wie viel davon?" liefe ins Leere - der Server hat die Vorfrage nie
   gesehen. Deshalb steht immer nur die LETZTE Frage mit ihrer Antwort da.
   Ein Verlauf braucht den Serververtrag; als Fund an #126 notiert.

   🔴 DIE FRAGE SETZT DEN ORB NICHT AUF "denkt".
   Dieser Zustand gehoert der Scan-Warteschlange (#125). Wuerde eine Frage ihn
   ueberschreiben, meldete der Orb "fertig" fuer eine Antwort, waehrend im
   Hintergrund noch ein Etikett laeuft. Das Warten auf die Antwort zeigt das
   Panel selbst - dort schaut der Nutzer ohnehin hin.
   ============================================================================ */
function rikiSpracheMoeglich(){
  try{ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }catch(e){ return false; }
}
function rikiFrageZeileHtml(){
  /* Das Mikrofon erscheint NUR, wenn der Browser es kann. Ein Knopf, der nichts
     tut, ist schlimmer als kein Knopf (Ralph P12). */
  var mik = rikiSpracheMoeglich()
    ? '<button id="rikiMik" onclick="rikiSprache()" aria-label="Frage sprechen" title="Frage sprechen" '
      +'style="flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:1px solid var(--tb-line,var(--k-e7e0d4));'
      +'background:var(--tb-card2,var(--k-fbf8f2));cursor:pointer;padding:0;font-size:17px;line-height:1">🎤</button>'
    : '';
  return '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--tb-line,var(--k-e7e0d4))">'
    +'<div style="display:flex;gap:7px;align-items:center">'
    +  '<input id="rikiFrage" type="text" maxlength="1200" placeholder="Frag mich zu dieser Seite…" '
    +    'onkeydown="if(event.key===\'Enter\'){event.preventDefault();rikiFrageSenden()}" '
    +    'style="flex:1;min-width:0;padding:11px 12px;border:1px solid var(--tb-line,var(--k-e7e0d4));border-radius:10px;'
    +    'background:var(--bg);color:var(--tb-text,var(--ink));font-size:15px">'
    +  mik
    +  '<button id="rikiSenden" onclick="rikiFrageSenden()" aria-label="Frage senden" '
    +    'style="flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:0;background:#7c6fe0;color:#fff;'
    +    'cursor:pointer;padding:0;font-size:17px;line-height:1">→</button>'
    +'</div>'
    +'<div id="rikiFrageHinweis" style="font-size:11.5px;color:var(--tb-muted);margin-top:6px;min-height:16px"></div>'
    +'</div>';
}
function rikiSprache(){
  var K = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!K) return;
  var hin=document.getElementById("rikiFrageHinweis");
  var mik=document.getElementById("rikiMik");
  try{
    var r=new K();
    r.lang="de-DE"; r.interimResults=false; r.maxAlternatives=1;
    if(hin) hin.textContent="Ich höre zu…";
    if(mik) mik.style.background="#efeafc";
    r.onresult=function(ev){
      var t=""; try{ t=ev.results[0][0].transcript||""; }catch(e){}
      var f=document.getElementById("rikiFrage");
      if(f && t){ f.value=t; }
      if(hin) hin.textContent="";
      if(mik) mik.style.background="var(--tb-card2,var(--k-fbf8f2))";
      /* Erkanntes wird NICHT automatisch abgeschickt. Spracherkennung verhoert
         sich, und eine falsch verstandene Frage kostet Geld und Vertrauen -
         der Nutzer sieht erst, was ankam, und tippt auf senden. */
      if(t && hin) hin.textContent="Verstanden – prüfen und senden.";
    };
    r.onerror=function(ev){
      if(mik) mik.style.background="var(--tb-card2,var(--k-fbf8f2))";
      /* Der Grund wird genannt, nicht verschluckt: "nicht erlaubt" und "nichts
         gehoert" brauchen verschiedene Reaktionen des Nutzers. */
      var g=(ev&&ev.error)||"unbekannt";
      if(hin) hin.textContent = (g==="not-allowed"||g==="service-not-allowed")
        ? "Das Mikrofon ist nicht erlaubt – bitte im Browser freigeben."
        : (g==="no-speech" ? "Ich habe nichts gehört." : "Spracherkennung nicht möglich ("+g+").");
    };
    r.onend=function(){ if(mik) mik.style.background="var(--tb-card2,var(--k-fbf8f2))"; };
    r.start();
  }catch(e){ if(hin) hin.textContent="Spracherkennung nicht möglich."; }
}
async function rikiFrageSenden(){
  var fEl=document.getElementById("rikiFrage");
  var hin=document.getElementById("rikiFrageHinweis");
  var out=document.getElementById("rikiAntwort");
  var sEl=document.getElementById("rikiSenden");
  var frage=String((fEl&&fEl.value)||"").trim();
  var zeig=function(t){ if(hin) hin.textContent=t||""; };
  if(!frage){ zeig("Schreib oder sprich eine Frage."); return; }
  if(frage.length>1200){ zeig("Die Frage ist zu lang (höchstens 1200 Zeichen)."); return; }
  var kontext=rikiKontext();
  if(sEl){ sEl.disabled=true; sEl.textContent="…"; }
  zeig("RIKI denkt…");
  if(out) out.innerHTML='<div style="font-size:13px;color:var(--tb-muted)">'+esc(frage)+'</div>';
  try{
    var s=(await client.auth.getSession()).data.session;
    if(!s) throw new Error("Bitte anmelden, um RIKI zu fragen.");
    var ruf=function(tok){
      return fetch(client.supabaseUrl+"/functions/v1/riki-frage",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},
        body:JSON.stringify({frage:frage, kontext:kontext})
      });
    };
    var r=await ruf(s.access_token);
    /* 🔴 EIN AUFFRISCHEN BEI 401, GENAU EINES (Ralph 19.08.: "Nicht angemeldet.",
       obwohl er angemeldet ist).
       getSession() liefert die GESPEICHERTE Sitzung zurueck - auch dann, wenn ihr
       Token abgelaufen ist. Das Frontend haelt sich also fuer angemeldet, der
       Server prueft das Token und sagt nein. Wer die Seite lange offen hat,
       trifft das zwangslaeufig.
       Es wird GENAU EINMAL aufgefrischt: hilft es nicht, ist die Anmeldung
       wirklich weg, und dann muss das dastehen statt einer Schleife. */
    if(r.status===401){
      try{
        var neu=(await client.auth.refreshSession()).data.session;
        if(neu && neu.access_token) r=await ruf(neu.access_token);
      }catch(x){ console.warn("riki-frage refresh:",x); }
    }
    var d=await r.json().catch(function(){ return null; });
    if(r.status===401){
      if(out) out.innerHTML='<div style="font-size:12.5px;color:var(--tb-muted);margin-bottom:6px">'+esc(frage)+'</div>'
        +'<div style="font-size:13px;color:var(--k-dc2626);line-height:1.5">Deine Anmeldung ist abgelaufen.</div>'
        +'<div style="font-size:11.5px;color:var(--tb-muted);line-height:1.5;margin-top:6px">'
        +'Ich habe sie einmal aufzufrischen versucht, das hat nicht gereicht. Melde dich neu an – deine Frage bleibt stehen.</div>'
        +'<div style="font-size:11px;color:var(--tb-muted);margin-top:6px">HTTP 401 · Build '+APP_BUILD+'</div>';
      zeig("");
      return;
    }
    if(!d || d.ok!==true){
      /* Der Servertext WOERTLICH - beim Produktdetail hat mich ein Sammelsatz
         wochenlang die Ursache gekostet (#35). Beim Tageslimit ist der Text
         ausserdem die eigentliche Auskunft. */
      var t=(d&&d.fehler)||("RIKI antwortet gerade nicht.");
      /* 🔴 DER HTTP-STATUS STEHT AB JETZT IMMER DABEI (Ralph 19.08., zweiter
         Fehlversuch). Ich habe zweimal geraten, was schiefgeht, weil ich den
         Status nicht sehen konnte: erst hielt ich es fuer den Service Worker,
         dann fuer den Cache-Buster - beide Male falsch, beide Male haette EINE
         Zahl es sofort geklaert. Ein Screenshot muss die Diagnose enthalten,
         sonst rate ich beim naechsten Mal wieder. Und die Konsole ist auf dem
         Handy praktisch nicht erreichbar, also gehoert die Zahl auf den Schirm.
         Klein und grau, aber da. */
      if(out) out.innerHTML='<div style="font-size:12.5px;color:var(--tb-muted);margin-bottom:6px">'+esc(frage)+'</div>'
        +'<div style="font-size:13px;color:var(--k-dc2626);line-height:1.5">'+esc(t)+'</div>'
        +'<div style="font-size:11px;color:var(--tb-muted);margin-top:6px">HTTP '+r.status+' · Build '+APP_BUILD+'</div>';
      zeig(r.status===429 ? "Tageslimit erreicht." : "");
      return;
    }
    if(out) out.innerHTML='<div style="font-size:12.5px;color:var(--tb-muted);margin-bottom:6px">'+esc(frage)+'</div>'
      +'<div style="font-size:13.5px;color:var(--tb-text,var(--ink));line-height:1.55;white-space:pre-wrap">'+esc(d.antwort||"")+'</div>';
    if(fEl) fEl.value="";
    var L=d.limit||{};
    zeig((L.heute_genutzt!=null && L.limit_tag!=null) ? ("Heute "+L.heute_genutzt+" von "+L.limit_tag+" Fragen.") : "");
  }catch(e){
    /* 🔴 "Load failed" ist Safaris Sammelsatz - genau die Sorte Meldung, die bei
       #35 wochenlang die Ursache verdeckt hat, diesmal vom Browser statt von uns.
       Ein fetch wirft einen TypeError bei GENAU DREI Dingen: Netz weg, der
       Server hat den Aufruf abgelehnt bevor er ankam (CORS/Vorabfrage), oder die
       Funktion laeuft nicht an. WELCHES davon, weiss der Browser - und nur die
       Konsole sagt es. Also wird der Nutzer nicht mit "Load failed" allein
       stehengelassen, und der volle Fehler geht in die Konsole.
       Gemessen 19.08.: bei Ralphs Fehlversuch entstand KEINE Zeile in
       Riki_Nutzung - die Anfrage hat den Server also nie erreicht. */
    var roh=(e&&e.message)||String(e);
    var netz=(e instanceof TypeError) || /load failed|failed to fetch|networkerror/i.test(roh);
    console.error("riki-frage:", e);
    /* 🔴 20.08.2026, Ralphs Screenshot: „Load failed · kein HTTP-Status“, dazu
       GEMESSEN in den Serverlogs: 0 Aufrufe von riki-frage im 24-Stunden-Fenster.
       Die Anfrage erreicht die Funktion also NIE — das ist Tatsache, die Ursache
       ist es nicht. Deshalb wird hier nicht geraten, sondern die Unterscheidung
       ERZWUNGEN, die der Satz oben offenlaesst:

         Vorabfrage kommt durch  → das Netz steht, es liegt am POST-Weg
                                   (Anmeldung, Vorabfrage-Kopfzeilen, Funktion)
         Vorabfrage scheitert    → das Netz oder die Adresse ist weg

       Genau ein zusaetzlicher Aufruf, nur im Fehlerfall. Und die ADRESSE steht
       dabei: ist client.supabaseUrl leer, sieht man es sofort am Text statt es
       zu vermuten. Dieselbe Lehre wie Work #35 — eine Meldung, die die Ursache
       verschweigt, kostet Wochen. */
    var _url="";
    try{ _url=String(client.supabaseUrl||"")+"/functions/v1/riki-frage"; }catch(_){ _url="(Adresse nicht lesbar)"; }
    var _probe="";
    if(netz){
      try{
        var pr=await fetch(_url,{method:"OPTIONS"});
        _probe="Vorabfrage an dieselbe Adresse antwortet (HTTP "+pr.status+") – das Netz steht. Es liegt also am Frageweg selbst, nicht an der Verbindung.";
      }catch(pe){
        _probe="Auch die Vorabfrage kommt nicht durch – Netz oder Adresse.";
      }
    }
    if(out) out.innerHTML='<div style="font-size:13px;color:var(--k-dc2626);line-height:1.5">'+esc(roh)+'</div>'
      +(netz?('<div style="font-size:11.5px;color:var(--tb-muted);line-height:1.5;margin-top:6px">'
        +'Die Anfrage ist nicht bis zum Server gekommen – nicht an deiner Frage.'
        +(_probe?('<br><b>'+esc(_probe)+'</b>'):'')
        +'</div>'):'')
      +'<div style="font-size:10.5px;color:var(--tb-muted);margin-top:6px;word-break:break-all">kein HTTP-Status · Build '+APP_BUILD+'<br>'+esc(_url)+'</div>';
    zeig("");
  }finally{
    if(sEl){ sEl.disabled=false; sEl.textContent="→"; }
  }
}
function rikiPanelSchliessen(){
  var p=document.getElementById("rikiPanel");
  var f=rikiKnopf(); if(f) f.setAttribute("aria-expanded","false");
  rikiFabZustand("normal");
  if(!p) return;
  /* Die Karte zieht sich in den Knopf zurueck, statt zu verschwinden. Das Entfernen
     haengt am Ende der Bewegung - ABER mit Zeitgeber als Rueckfall: wer Bewegung
     abgestellt hat, bekommt gar kein animationend, und dann bliebe die Karte fuer
     immer stehen. Ein Effekt, der ohne Animation klemmt, ist ein Fehler und keine
     Geschmacksfrage. */
  p.id="";                                   // ein zweiter Klick trifft nicht dieselbe Karte
  /* 20.08., E5a: der Editor bekommt seinen Platz zurueck. SOFORT, nicht erst am
     Ende der Bewegung - sonst bliebe die Maske schmal, wenn jemand Bewegung
     abgestellt hat und das animationend nie kommt (derselbe Rueckfallgedanke
     wie beim Entfernen der Karte darunter). */
  try{ document.body.classList.remove("rikiAngedocktOffen"); }catch(e){}
  p.classList.add("rikiSchliesst");
  var weg=false, fort=function(){ if(weg) return; weg=true; try{ p.remove(); }catch(e){} };
  try{ p.addEventListener("animationend", fort, {once:true}); }catch(e){}
  setTimeout(fort, 260);
}
function rikiPanelOeffnen(){
  if(document.getElementById("rikiPanel")){ rikiPanelSchliessen(); return; }
  var k=rikiKontext();
  var p=document.createElement("div");
  p.id="rikiPanel";
  p.setAttribute("role","dialog");
  p.setAttribute("aria-label","RIKI");
  /* 20.08.: die Klasse rikiAusLeiste ist entfallen - siehe Stilblock oben. */
  /* Karte statt Leiste: verankert an derselben Ecke wie der Knopf, direkt darueber.
     14px Abstand nach rechts wie der Knopf, 92+52+10 nach unten - also genau auf
     ihm sitzend. Die Breite ist gedeckelt, damit die Karte auf dem Handy nicht an
     beiden Raendern klebt und auf dem Schreibtisch nicht ueber den halben Schirm
     laeuft. */
  /* Das Panel haengt an der Stelle, an der der Knopf WIRKLICH sitzt. In der
     Leiste ist das knapp darueber (die Leiste ist 78px hoch); als schwebender
     Knopf weiter oben. Die Zahl wird nicht geraten, sie folgt dem Knopf. */
  /* 🔴 20.08.2026, Work #133 E5a — IM EDITOR DOCKT DAS PANEL AN.
     Ralphs DBKR-Vorlage hat die Benutzerfuehrung als Spalte am rechten Rand mit
     senkrechter Lasche, nicht als schwebendes Fenster. Der Grund ist nicht
     Geschmack: im Editor arbeitet man lange an einer Maske und will die Hilfe
     daneben stehen haben, nicht ueber dem Inhalt liegen.

     EIN PANEL, ZWEI SITZE - nicht zwei Panels (§4.2). Der Inhalt darunter ist
     Zeile fuer Zeile derselbe; unterschiedlich ist nur, WO es sitzt. Deshalb
     wird hier auch nur die Positionierung verzweigt und nicht das HTML.

     Angedockt kommt das Aussehen vollstaendig aus ui.css (.rikiAngedockt), damit
     es nicht an zwei Orten steht. Schwebend bleibt der Inlinestil, weil er eine
     gemessene Zahl enthaelt, die dem Knopf folgt. */
  /* 🔴 20.08.2026, Ralph: "beim klick soll er so erscheinen wie er vorher war."
     HIER STAND: bottom:calc((_inL?"86px":"154px") + safe-area) - das Panel sass
     in der Leistenfassung 68px tiefer und klebte damit direkt ueber der
     Bodenleiste. Zusammen mit dem Aufziehpunkt aus der Leistenmitte sah es aus
     wie eine ausgefahrene Schublade der Leiste, nicht wie eine Karte.

     JETZT gilt fuer beide Faelle die urspruengliche Hoehe. Die 154px stammen aus
     der Zeit des schwebenden Knopfes und sind der Wert, den Ralph mit "wie
     vorher" meint.

     🔴 NACHTRAG vom selben Tag: der Leisten-Knopf ist inzwischen ganz weg
     (Ralph: "riki ist immer noch im menü, der muss da raus"). Der Orb schwebt
     wieder rechts, und rikiInLeiste() gibt es nicht mehr. Diese 154px sind damit
     nicht mehr eine von zwei Zahlen, sondern die einzige. */
  var _angedockt = (k.seite==="erfassung");
  if(_angedockt){
    p.className=(p.className?p.className+" ":"")+"rikiAngedockt";
    /* Der Editor bekommt Platz, statt ueberdeckt zu werden. Die Klasse steht am
       body, weil das Panel selbst position:fixed ist und den Fluss nicht kennt. */
    try{ document.body.classList.add("rikiAngedocktOffen"); }catch(e){}
  } else {
    p.style.cssText="position:fixed;right:14px;z-index:9991;"
      +"bottom:calc(154px + env(safe-area-inset-bottom));"
      +"width:min(340px, calc(100vw - 28px));max-height:min(70vh, 460px);overflow:auto;"
      +"background:var(--tb-card,var(--k-ffffff));border:1px solid var(--tb-line,var(--k-e7e0d4));"
      +"border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.20);padding:14px 16px 16px";
  }
  p.innerHTML=
    /* Die Lasche gibt es nur angedockt - schwebend haette sie nichts, woran sie
       haengen koennte. Sie schliesst dasselbe Panel wie das Kreuz; zwei Wege zu
       einer Handlung sind hier gewollt, weil die Lasche im DBKR-Vorbild der
       sichtbare Anfasser ist und das Kreuz der genaue. */
     (_angedockt ? '<button class="rikiLasche" onclick="rikiPanelSchliessen()" aria-label="RIKI schließen"><span>Benutzerführung</span></button>' : '')
    +'<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">'
    +  '<b style="flex:1;font-size:16px;color:var(--tb-text,var(--ink))">RIKI</b>'
    +  (_angedockt&&k.stationstitel ? '<span class="rikiStation">'+esc(k.stationstitel)+'</span>' : '')
    +  '<button onclick="rikiPanelSchliessen()" aria-label="Schließen" style="border:0;background:none;font-size:20px;line-height:1;color:var(--tb-muted);cursor:pointer;padding:0 4px">&times;</button>'
    +'</div>'
    +'<div style="font-size:12px;color:var(--tb-muted);margin-bottom:8px">'+rikiKontextText(k)+'</div>'
    /* 🔴 20.08.2026, Ralph: die Produkterklaerung steht NUR auf der Startseite.
       Wer im Tagebuch steht, will wissen, was das Tagebuch kann - nicht, wie der
       Index rechnet. Ist die Option aus, faellt der Block weg und es bleibt
       genau die Oberflaechenerklaerung darunter. */
    + ((k.seite==="start") ? rikiIntroHtml() : "")
    + rikiSeitenhilfeHtml(k.seite, k.station)
    /* Seit Build 3910 gibt es den Antwortweg (riki-frage, ChatGPT 19.08.) - das
       Eingestaendnis von vorher ist damit gegenstandslos und ersetzt, nicht
       umformuliert. */
    +'<div id="rikiAntwort" style="margin-top:10px"></div>'
    + rikiFrageZeileHtml();
  document.body.appendChild(p);
  var f=rikiKnopf(); if(f) f.setAttribute("aria-expanded","true");
  rikiFabZustand("offen");
}
function rikiFabInit(){
  if(!rikiShellAktiv()) return;                 // siehe rikiShellAktiv — gilt für beide Oberflächen
  /* 🔴 20.08.2026, Ralph: "im menü das aufklappt soll man ihn ein oder ausblenden
     können." Die Wahl steht in index.html (rikiSichtbar), weil sie GELTEN muss,
     bevor app.js laeuft - sonst blitzt der Orb kurz auf. Fehlt die Funktion, gilt
     "an": eine fehlende Einstellung darf nichts ausblenden (§3.4). */
  if(typeof window.rikiSichtbar==="function" && !window.rikiSichtbar()) return;
  /* 🔴 20.08.2026: HIER STAND der Zweig fuer den Leisten-Knopf (#bnriki,
     Entscheid A vom 19.08.) - er fuellte dort nur das Symbol und kehrte um.
     Mit dem Knopf ist er entfallen; getElementById haette ab jetzt immer null
     geliefert und der Zweig waere nie wieder gelaufen.

     Ralph 20.08.: "setz ihn so wie er am anfang war rechts hin". Der schwebende
     Knopf darunter ist unveraendert der von vorher - er war nie geloescht,
     sondern nur uebersprungen, solange der Leisten-Knopf existierte (§22). */
  if(document.getElementById("rikiFab")) return; // genau einer, nie zwei (§4.2)
  var b=document.createElement("button");
  b.id="rikiFab";
  b.type="button";
  b.setAttribute("aria-label","RIKI öffnen");
  b.setAttribute("aria-expanded","false");
  b.onclick=function(){ rikiPanelOeffnen(); };
  /* Kein eigener Hintergrund, kein Rahmen: der Orb bringt seinen Halo mit. Die
     Trefferflaeche bleibt 52 px, sie haengt am <button> und nicht am Bild. */
  b.style.cssText="position:fixed;right:14px;z-index:9990;"
    +"bottom:calc(92px + env(safe-area-inset-bottom));"
    +"width:52px;height:52px;border:0;background:none;border-radius:50%;"
    +"cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;"
    +"-webkit-tap-highlight-color:transparent";
  /* 🔴 BADGE IST VIOLETT, NICHT ROT. In dieser App heisst Rot "ueber dem
     Hoechstwert" (Salz, Zucker). Ein roter Punkt am Begleiter wuerde eine
     Grenzueberschreitung behaupten, wo nur eine Nachricht wartet. Ralphs
     Entwurf zeigt Violett - er hat recht, meine erste Fassung war falsch. */
  b.innerHTML=rikiOrbSvg()
    +'<span id="rikiFabBadge" style="display:none;position:absolute;top:-2px;right:-4px;min-width:20px;height:20px;'
    +'border-radius:10px;background:#7c6fe0;color:var(--k-ffffff);font-size:11.5px;font-weight:700;'
    +'align-items:center;justify-content:center;padding:0 5px;box-shadow:0 1px 4px rgba(0,0,0,.22)">0</span>';
  document.body.appendChild(b);
  rikiStilEinmal();
  rikiFabZustand("normal");
  /* 30.09.2026 Webtest O6: waehrend das Intro laeuft, gehoert der Bildschirm dem Intro.
     Der Kopf wartet, bis es weg ist (Klasse hide oder Element entfernt). */
  (function warteAufIntro(){
    var io=document.getElementById("introOverlay");
    var laeuft=io && io.classList.contains("introOn") && !io.classList.contains("hide");
    b.style.visibility = laeuft ? "hidden" : "";
    if(laeuft) setTimeout(warteAufIntro, 300);
  })();
}
try{
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", rikiFabInit);
  else rikiFabInit();
}catch(e){}

