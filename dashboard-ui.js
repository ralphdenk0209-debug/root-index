/* ============================================================================
   DASHBOARD „ARBEITSFLÄCHE" (Ralph-Entscheid 30.07.2026)
   ----------------------------------------------------------------------------
   Vorgeschichte: Der Netzplan (Metro-Karte) hat es nicht getroffen — Ralph:
   „möchte eher etwas wie einen graph, aber interaktiv bzw lebend … soll dann mein
   dashboard ersetzen und für die tägliche arbeit sein". Nach drei Mockups sein
   Entscheid: **C als Grundgerüst, der Wächter-Ring aus B als Kopf-Element, A
   (lebender Graph) als Zweitansicht.**

   WARUM NICHT DER REINE GRAPH ALS HAUPTANSICHT — die Begründung gehört hierher,
   damit sie in drei Monaten nicht als Willkür gelesen wird: Ein Kräfte-Graph hat
   keine festen Plätze. Jeden Morgen liegt alles anders, man baut kein
   Muskelgedächtnis auf, und jede Zahl kostet einen Hover. Ralphs Ausgangsproblem
   war „ich verliere den Überblick" — Bewegung hilft dagegen nicht. Deshalb:
   Arbeitsfläche mit festen Plätzen als Werkzeug, Graph zum Erkunden.

   DREI BAUSTEINE
   1) WÄCHTER-RING: 25 Segmente, eines je Wächter, in drei Gruppen (Anlage · Tür ·
      Bestand) durch Lücken getrennt. Blass = still, gefüllt = meldet. Ein Ring statt
      einer Liste, weil niemand 25 Zahlen liest — ein rotes Segment im Augenwinkel
      aber sieht. In der Mitte die eine Zahl, um die es geht.
   2) ARBEITSLISTE „Heute zu tun": wird aus denselben Zahlen ABGELEITET, nicht
      gepflegt. Eine handgeführte Liste veraltet; diese kann es nicht (§4b).
   3) FLUSS: Zuflüsse → Prüfung → Katalog. Dicke = Menge, laufende Punkte = lebendig,
      und ein Zufluss ohne Abnehmer endet im ROTEN RIEGEL. Das ist der Befund vom
      30.07.: 51 Einträge holt niemand ab (§1.11n-hh).

   ALLE ZAHLEN AUS cb_dashboard + cb_netzplan. Keine im Code (§4b, MIKRO_REF-Falle).
   Scheitert ein Abruf, wird es LAUT gemeldet und die Seite fällt auf das alte
   Enterprise-Dashboard zurück — nie stilles Grün (§1.13i).
   NUR FÜR ADMINS, ohne Beta-Flag (Ralph 30.07.: „ist nur Admin!!! kein anderer nutzer“):
   das Dashboard liegt in der Freigabe-Ansicht, die in setMode hart auf ME.is_admin prüft.
   Ein Beta-Flag hätte in der NUTZER-Beta-Liste gestanden und sich dort auf „für alle“
   stellen lassen — ein Schalter, der etwas verspricht, was er nicht halten kann.
   Rückfall auf das alte Dashboard: admin-lokale dritte Ansicht „Klassisch“ im Umschalter.
   ============================================================================ */
/* ===== NETZPLAN ENTFERNT am 30.07.2026 (Ralph: „netzplan kann raus!") =====
   Die Metro-Karte ist durch das Dashboard „Arbeitsfläche" darunter ersetzt.
   VOLLSTÄNDIG GELÖSCHT, nicht deaktiviert (§1.11n-p): toter Code, der DOM-IDs vergibt,
   ist nicht tot — er wartet. npSvg/npStationen/npInfo hätten beim nächsten Umbau still
   mit neuen IDs kollidiert. Was BLEIBT: die RPC cb_netzplan() — sie ist jetzt die
   Datenquelle der Arbeitsfläche. Alter Stand: Git-Verlauf, Build 2026-07-30-1422. */

var _AB={gut:'#0ca30c',warn:'#e0951a',krit:'#dc3a3a',grau:'#9aa1ab',
         zu:'#0d8f9c',pr:'#6a4ac7',kern:'#2e7d46',ink:'#131a24',mut:'#6b7480'};

function dashArbeitCss(){
  if(document.getElementById('dashAbCss')) return;
  var A='#fgDash .ab';
  var css=A+'{--abbg:#f6f7f9;--abcard:#fff;--abink:#131a24;--abmut:#6b7480;--abline:#e6e9ee;'
    +'color:var(--abink);font-size:14px;line-height:1.55}'
   +A+' *{box-sizing:border-box}'
   +A+' .abkopf{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:13px}'
   +A+' .abkopf h2{font-size:19px;font-weight:800;margin:0;letter-spacing:-.2px}'
   +A+' .abkopf .st{font-size:11.5px;color:var(--abmut)}'
   +A+' .abum{display:inline-flex;border:1px solid var(--abline);border-radius:10px;overflow:hidden;background:#fff}'
   +A+' .abum button{background:#fff;border:0;color:var(--abmut);font-size:12px;font-weight:700;padding:6px 13px;cursor:pointer}'
   +A+' .abum button.on{background:var(--abink);color:#fff}'
   +A+' .abbtn{background:#fff;border:1px solid var(--abline);border-radius:9px;padding:6px 12px;'
    +'font-weight:700;font-size:12px;color:var(--abink);cursor:pointer}'
   +A+' .abbtn:hover{border-color:#cfd5de}'
   +A+' .abkpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:11px;margin-bottom:13px}'
   +A+' .abk{background:#fff;border:1px solid var(--abline);border-radius:14px;padding:12px 14px;'
    +'box-shadow:0 1px 2px rgba(16,24,40,.04)}'
   +A+' .abk .l{font-size:11.5px;color:var(--abmut);font-weight:600}'
   +A+' .abk .v{font-size:27px;font-weight:800;letter-spacing:-1.1px;line-height:1.15;margin-top:1px;'
    +'font-variant-numeric:tabular-nums}'
   +A+' .abk .s{font-size:11.5px;color:var(--abmut)}'
   +A+' .abprojektzeit{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(170px,.8fr);'
    +'gap:11px;margin-bottom:13px}'
   +A+' .abpk{display:flex;align-items:center;gap:12px;min-width:0;background:#fff;'
    +'border:1px solid var(--abline);border-radius:14px;padding:10px 14px;'
    +'box-shadow:0 1px 2px rgba(16,24,40,.04)}'
   +A+' .abpk.go{border-left:4px solid '+_AB.kern+'}'
   +A+' .abpk .abl{font-size:10.5px;font-weight:800;letter-spacing:.08em;color:var(--abmut);'
    +'white-space:nowrap}'
   +A+' .abpk strong{font-size:18px;line-height:1.15;font-variant-numeric:tabular-nums;'
    +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +A+' .abpk.go strong{font-size:21px;color:'+_AB.kern+'}'
   +A+' .abpk small{margin-left:auto;color:var(--abmut);font-size:10.5px;white-space:nowrap}'
   +'@media (max-width:720px){'+A+' .abprojektzeit{grid-template-columns:1fr}'
    +A+' .abpk small{display:none}}'
   +A+' .abbar{height:6px;background:#eef0f4;border-radius:4px;margin-top:8px;overflow:hidden}'
   +A+' .abbar i{display:block;height:6px;border-radius:4px}'
   +A+' .abrow{display:grid;gap:13px;align-items:start;margin-bottom:13px}'
   +A+' .abrow.r1{grid-template-columns:392px minmax(0,1fr)}'
   +A+' .abrow.r2{grid-template-columns:minmax(0,1fr) 320px}'
   /* .r3 seit 15.08.2026: drei gleich breite Kästen (Herzschlag · Herkunft · Bestand).
      Sie standen bis dahin als 320px-Säule rechts NEBEN dem Fluss. Ohne den Fluss wäre
      dort ein leeres Feld über zwei Drittel der Breite geblieben. .r2 bleibt unverändert —
      die Graph-Ansicht benutzt sie weiter (eine Regel ändern, die zwei Ansichten teilen,
      hätte den Graph mitgerissen). */
   +A+' .abrow.r3{grid-template-columns:repeat(3,minmax(0,1fr))}'
   +'@media (max-width:1080px){'+A+' .abrow.r1,'+A+' .abrow.r2,'+A+' .abrow.r3{grid-template-columns:1fr}}'
   +A+' .abp{background:#fff;border:1px solid var(--abline);border-radius:15px;'
    +'box-shadow:0 1px 2px rgba(16,24,40,.04);min-width:0}'
   +A+' .abph{display:flex;align-items:center;gap:9px;padding:11px 15px;border-bottom:1px solid var(--abline);flex-wrap:wrap}'
   +A+' .abph h3{font-size:13.5px;font-weight:700;margin:0;flex:1;min-width:120px}'
   +A+' .abtag{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}'
   +A+' .abpad{padding:13px 15px}'
   +A+' .abjob{display:flex;gap:11px;align-items:flex-start;padding:11px 15px;border-bottom:1px solid #f1f3f6;'
    +'text-decoration:none;color:inherit;cursor:pointer;transition:background .12s}'
   +A+' .abjob:last-child{border-bottom:0}'+A+' .abjob:hover{background:#fbfcfd}'
   +A+' .abjob .sv{width:3px;border-radius:3px;align-self:stretch;flex:0 0 3px}'
   +A+' .abjob .nm{font-size:21px;font-weight:800;min-width:50px;text-align:right;letter-spacing:-.7px;'
    +'font-variant-numeric:tabular-nums}'
   +A+' .abjob .tx{flex:1;min-width:0}'
   +A+' .abjob .t1{font-weight:700;font-size:13px}'
   +A+' .abjob .t2{font-size:12px;color:var(--abmut);margin-top:1px}'
   +A+' .abjob .go{font-size:11.5px;font-weight:700;color:#2e7d46;white-space:nowrap;align-self:center}'
   +A+' .abfoot{font-size:11.5px;color:var(--abmut);padding:10px 15px;border-top:1px solid var(--abline)}'
   +A+' .abwg{display:grid;grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:7px;padding:13px 15px}'
   +A+' .abwc{border:1px solid var(--abline);border-radius:10px;padding:8px 10px;cursor:pointer;'
    +'background:#fff;transition:transform .12s,box-shadow .12s}'
   +A+' .abwc:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,24,40,.08)}'
   +A+' .abwc .g{font-size:9.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase}'
   +A+' .abwc .n{font-size:11.5px;font-weight:600;line-height:1.3;height:30px;overflow:hidden;margin-top:1px}'
   +A+' .abwc .z{font-size:17px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}'
   +A+' .abkv{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:5px 0;'
    +'border-bottom:1px dashed var(--abline)}'
   +A+' .abkv:last-child{border-bottom:0}'+A+' .abkv b{font-variant-numeric:tabular-nums}'
   +A+' .abtab{font-size:11.5px;border:1px solid var(--abline);background:#fafbfc;border-radius:999px;'
    +'padding:4px 11px;cursor:pointer;font-weight:600;color:var(--abmut)}'
   +A+' .abtab.on{background:var(--abink);color:#fff;border-color:var(--abink)}'
   +A+' .abseg{cursor:pointer;transition:opacity .15s}'
   +A+' .abfehler{font-size:12.5px;color:#8d2b2b;background:#fdf1f1;border:1px solid #f0c2c2;'
    +'border-radius:10px;padding:9px 12px;margin-bottom:12px}'
   +A+' svg{display:block;width:100%;height:auto}'
   +A+' #abCv{display:block;width:100%;height:560px;cursor:grab}'
   +A+' #abCv.zieh{cursor:grabbing}'
   +A+' .abpill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;'
    +'background:#f4f6f8;border:1px solid var(--abline);border-radius:999px;padding:3px 9px;margin:0 4px 4px 0}'
   +A+' .abdot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:0 0 auto}'
   /* ===== HERO + BENTO — Durchgang 2 (Ralph-Auftrag „Variante B", 15.08.2026) =====
      Ralphs Vorgaben woertlich: weisse Karten, 14–18px Radius, leichte Schatten,
      Gruen=gut · Blau=neutral · Orange=pruefen · Rot=Blocker · Grau=Hintergrund,
      KEINE bunte Ampelwand. Desktop 4 Spalten · mittel 2 · klein 1.
      Die Farben kommen aus _AB — es wird KEINE zweite Palette aufgemacht (§4.2). */
   +A+' .abhero{background:linear-gradient(135deg,#17502c,#2e7d46);border-radius:16px;'
    +'padding:15px 19px;color:#fff;display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:14px;'
    +'box-shadow:0 6px 20px rgba(23,80,44,.18)}'
   +A+' .abhero .hzust{font-size:17px;font-weight:800;letter-spacing:-.2px;display:flex;align-items:center;gap:9px}'
   +A+' .abhero .hpunkt{width:11px;height:11px;border-radius:50%;flex:0 0 auto;'
    +'box-shadow:0 0 0 3px rgba(255,255,255,.22)}'
   +A+' .abhero .hzahlen{display:flex;gap:22px;flex-wrap:wrap}'
   +A+' .abhero .hz{min-width:0}'
   +A+' .abhero .hz b{display:block;font-size:20px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}'
   +A+' .abhero .hz span{font-size:11px;opacity:.82;letter-spacing:.02em}'
   +A+' .abhero .hz.klick{cursor:pointer;border-radius:8px;padding:2px 6px;margin:-2px -6px}'
   +A+' .abhero .hz.klick:hover{background:rgba(255,255,255,.13)}'
   +A+' .abhero .hr{margin-left:auto;display:flex;align-items:center;gap:11px;font-size:12px;opacity:.92}'
   +A+' .abhero .hbtn{background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.32);'
    +'color:#fff;padding:6px 13px;border-radius:9px;font-weight:700;cursor:pointer;font-size:12.5px}'
   +A+' .abhero .hbtn:hover{background:rgba(255,255,255,.26)}'
   /* Work #42/E5: der Anordnen-Knopf muss ANGESCHALTET aussehen, solange der
      Modus laeuft — sonst sieht Ralph im Hero nicht, warum das Dashboard
      ploetzlich gestrichelte Rahmen hat. */
   +A+' .abhero .hbtn.on{background:#fff;color:'+_AB.kern+';border-color:#fff;font-weight:800}'
   +'@media (max-width:720px){'+A+' .abhero .hr{margin-left:0;width:100%}}'
   /* Bento: 4 Spalten, die erste Kachel nimmt zwei — „HEUTE" ist die Hauptsache
      und darf nicht so gross wie eine Nebenzahl sein (Ralph: keine zehn gleich
      grossen Kaesten). */
   /* 🔴 KORREKTUR 15.08.2026, am Bild gemessen: bei 4 Spalten und einer doppelt
      breiten Kachel passen nur DREI der vier Kacheln in die Reihe — „Waechter-
      Status" fiel in eine zweite Zeile und wurde dort riesig. Ralphs Bild hat
      vier Kacheln nebeneinander, die erste gross. Das sind 2+1+1+1 = FUENF
      Spalten, nicht vier. */
   +A+' .abbento{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px;'
    +'align-items:stretch;margin-bottom:14px}'
   +A+' .abbento .bgross{grid-column:span 2}'
   +'@media (max-width:1180px){'+A+' .abbento{grid-template-columns:repeat(2,minmax(0,1fr))}'
    +A+' .abbento .bgross{grid-column:span 2}}'
   +'@media (max-width:640px){'+A+' .abbento{grid-template-columns:1fr}'
    +A+' .abbento .bgross{grid-column:span 1}}'
   +A+' .abbento .bk{background:#fff;border:1px solid var(--abline);border-radius:16px;'
    +'display:flex;flex-direction:column;min-width:0;overflow:hidden;box-shadow:0 2px 7px rgba(19,26,36,.05)}'
   +A+' .abbento .bkopf{display:flex;align-items:center;gap:8px;padding:11px 14px 0;flex-wrap:wrap}'
   +A+' .abbento .bkopf h3{margin:0;font-size:10.5px;font-weight:800;text-transform:uppercase;'
    +'letter-spacing:.06em;color:var(--abmut);flex:1;min-width:90px}'
   +A+' .abbento .bleib{padding:11px 14px 13px;flex:1;min-width:0}'
   /* 🔴 17.08.2026, Ralph mit Screenshot: „auf stamm ueberblick kann ich nicht
      klicken und da sind keine 740 faelle??" Er hatte recht, und die Ursache war
      nicht der Klick, sondern die HOEHE. Die Kachel fasst 270 px (Ralph 16.08.:
      „die kasten selbe hoehe"), der Inhalt ist auf 13 Zeilen gewachsen — der
      ganze ALT-Block mit Regelfaelle 740 und Quelle offen 554 lag UNTERHALB
      des Randes und war stumm abgeschnitten. Ein Inhalt, der lautlos verschwindet,
      ist schlimmer als einer, der nicht passt.
      Jetzt: die Kachel scrollt, UND man sieht, dass sie es tut. */
   +A+' .abbento .bscroll{overflow-y:auto;overscroll-behavior:contain;'
    +'scrollbar-width:thin;position:relative}'
   +A+' .abbento .bscroll::-webkit-scrollbar{width:7px}'
   +A+' .abbento .bscroll::-webkit-scrollbar-thumb{background:#c9d1da;border-radius:4px}'
   +A+' .abbento .bmehr{position:sticky;bottom:-13px;margin:0 -14px -13px;padding:14px 14px 7px;'
    +'font-size:10.5px;font-weight:700;color:var(--abmut);text-align:center;pointer-events:none;'
    +'background:linear-gradient(180deg,rgba(255,255,255,0) 0%,#fff 55%)}'
   +A+' .abbento .bzahl{font-size:31px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}'
   +A+' .abbento .bunter{font-size:11.5px;color:var(--abmut);margin-top:4px;line-height:1.4}'
   /* Aufgabenzeilen. Jede Zeile springt hin — eine Zahl ohne Weg ist eine Attrappe (Ralph P12). */
   +A+' .abbento .baufg{display:flex;align-items:center;gap:10px;padding:8px 14px;'
    +'border-top:1px solid var(--abline);cursor:pointer}'
   +A+' .abbento .baufg:hover{background:#f7f9fa}'
   /* 🔴 KORREKTUR: die Plakette war fest 22px breit, deshalb wurde bei >99 auf
      „99+" gekuerzt — und 248 sah aus wie 543. Zwei verschiedene Rueckstaende
      duerfen nicht gleich aussehen; genau die Zahl ist ja die Aussage. Jetzt
      waechst die Plakette mit der Stelligkeit (min-width statt width). */
   +A+' .abbento .baufg .bp{flex:0 0 auto;min-width:22px;height:22px;padding:0 5px;'
    +'border-radius:11px;color:#fff;font-size:11px;font-weight:800;display:flex;'
    +'align-items:center;justify-content:center;font-variant-numeric:tabular-nums}'
   /* 🔴 KORREKTUR: bt1/bt2 sind <span> und damit inline — im Bild lief
      „…niemand holt sie abältester Eintrag 31 Tage alt" in EINER Zeile
      ineinander. display:block trennt sie. Am Bild gemessen, nicht im Code
      gefunden: der Rendertest prueft Markup, nicht Umbruch. */
   +A+' .abbento .baufg .bt{flex:1;min-width:0}'
   +A+' .abbento .baufg .bt1{display:block;font-size:12.5px;font-weight:700;'
    +'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
   +A+' .abbento .baufg .bt2{display:block;font-size:11px;color:var(--abmut);'
    +'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}'
   +A+' .abbento .baufg .bgo{flex:0 0 auto;color:var(--abmut);font-size:15px}'
   +A+' .abbento .bleer{padding:20px 14px;text-align:center;color:var(--abmut);font-size:12.5px}'
   +A+' .abbento .bzeile{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;'
    +'padding:5px 0;border-bottom:1px dashed var(--abline)}'
   +A+' .abbento .bzeile:last-child{border-bottom:0}'
   +A+' .abbento .bzeile b{font-variant-numeric:tabular-nums;flex:0 0 auto}'
   +A+' .abbento .bfuss{font-size:11px;color:var(--abmut);padding:9px 14px;border-top:1px solid var(--abline)}'
   /* 🔴 KORREKTUR: weiter oben steht `.ab svg{width:100%;height:auto}` — fuer den
      grossen Waechter-Ring und den Fluss richtig, fuer den kleinen Kachelring
      verheerend. Er wurde auf Kachelbreite aufgeblasen und sprengte die Zeile.
      Die Breitenangabe im <svg>-Tag allein half nicht: die Regel ist
      spezifischer. Deshalb hier gezielt zurueckgesetzt statt die allgemeine
      Regel anzufassen — die haengt an Bausteinen, die ich nicht anfasse (§2.3). */
   +A+' .abbento .bring{display:flex;align-items:center;gap:12px;padding:4px 0}'
   +A+' .abbento .bring svg{width:62px;height:62px;flex:0 0 auto}'
   +A+' .abbento .bspark{display:flex;align-items:flex-end;gap:2px;height:30px;margin-top:7px}'
   +A+' .abbento .bspark i{flex:1;display:block;border-radius:2px 2px 0 0;background:'+_AB.kern+';opacity:.72}'
   /* ----- Bento-Reihe 2 (Durchgang 3) ----- */
   +A+' .abbento.ab2 .bleib{padding-top:9px}'
   +A+' .abbento .blade{color:var(--abmut);font-size:12px;padding:14px 0;text-align:center}'
   +A+' .abbento .bleerk{color:var(--abmut);font-size:12px;padding:8px 0}'
   +A+' .abbento .babs{font-size:10.5px;font-weight:800;text-transform:uppercase;'
    +'letter-spacing:.05em;color:var(--abmut);margin-bottom:3px}'
   +A+' .abbento .bfehl{font-size:11.5px;line-height:1.45;color:'+_AB.krit+';'
    +'background:#fdf1f1;border:1px solid #f2cfcf;border-radius:9px;padding:9px 10px}'
   /* Die Karte war Ralph zu gross. Sie wird NICHT neu gezeichnet — die Kachel
      begrenzt sie, und das SVG skaliert mit (§22: entKarteDE bleibt unberuehrt). */
   +A+' .abbento .abkarte{max-width:100%;overflow:hidden}'
   +A+' .abbento .abkarte svg{width:100%;height:auto;max-height:210px;display:block}'
   +A+' .abschnell{display:flex;align-items:center;gap:9px;width:100%;text-align:left;'
    +'background:#fff;border:1px solid var(--abline);border-radius:10px;padding:8px 11px;'
    +'margin-bottom:7px;font-size:12.5px;font-weight:700;color:var(--abink);cursor:pointer;'
    +'font-family:inherit}'
   +A+' .abschnell:hover{background:#f5f8f9;border-color:#cfd5de}'
   +A+' .abschnell .ic{font-size:15px;line-height:1}'
   +A+' .abschnell .pf{margin-left:auto;color:var(--abmut)}'
   /* ----- Anordnen-Modus (Work #42, Etappe 5) -----
      Der Modus muss auf den ERSTEN Blick erkennbar sein. Wer nicht sieht, dass
      er im Bearbeiten steckt, haelt eine ausgeblendete Kachel fuer verloren. */
   +A+' .abeleiste{display:flex;align-items:center;gap:9px;flex-wrap:wrap;'
    +'background:#fff8e8;border:1px solid #e8d7a8;border-radius:12px;'
    +'padding:9px 12px;margin-bottom:13px;font-size:12.5px}'
   +A+' .abeleiste b{font-size:12.5px}'
   +A+' .abeleiste .abesp{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}'
   +A+' .abeb{background:#fff;border:1px solid var(--abline);border-radius:8px;'
    +'padding:5px 9px;font-size:11.5px;font-weight:700;color:var(--abink);'
    +'cursor:pointer;font-family:inherit;white-space:nowrap}'
   +A+' .abeb:hover{background:#f5f8f9;border-color:#cfd5de}'
   +A+' .abeb[disabled]{opacity:.5;cursor:not-allowed}'
   +A+' .abeb.hin{background:#eef6ee;border-color:#bcd9bc}'
   +A+' .abbento .bk.bedit{outline:2px dashed #d9b45f;outline-offset:-2px}'
   +A+' .abbento .bk.bedit.bzieh{opacity:.45}'
   +A+' .abbento .bk.bedit.bziel{outline:2px solid '+_AB.kern+'}'
   +A+' .abedit{display:flex;align-items:center;gap:7px;flex-wrap:wrap;'
    +'background:#fbf3df;border-bottom:1px solid #e8d7a8;padding:6px 10px;'
    +'border-radius:15px 15px 0 0}'
   +A+' .abedit .abgriff{cursor:grab;font-size:14px;color:#9a8a5e}'
   +A+' .abedit .abename{font-size:11px;font-weight:800;text-transform:uppercase;'
    +'letter-spacing:.04em;color:var(--abmut);overflow:hidden;text-overflow:ellipsis;'
    +'white-space:nowrap;min-width:0}'
   +A+' .abedit .abesp{margin-left:auto;display:flex;gap:5px}'
   /* Inhaltsauswahl der freien Kachel */
   +A+' .abwahl{display:flex;flex-wrap:wrap;gap:5px}'
   +A+' .abkz{background:#fff;border:1px solid var(--abline);border-radius:20px;'
    +'padding:4px 9px;font-size:11px;font-weight:700;color:var(--abmut);'
    +'cursor:pointer;font-family:inherit}'
   +A+' .abkz:hover{border-color:#cfd5de}'
   +A+' .abkz.an{background:#eef6ee;border-color:#bcd9bc;color:'+_AB.gut+'}'
   /* ----- Freie Flaeche (Work #42, Umbau 15.08.) -----
      Die Kacheln liegen absolut. Die Flaeche selbst ist relativ und bekommt
      ihre Hoehe aus der untersten Kachel — sonst faellt der Rest der Seite
      in sie hinein. */
   /* display:block hebt das Raster aus .abbento auf — die Kacheln liegen hier
      absolut. Alles ANDERE aus .abbento gilt weiter und soll das auch. */
   +A+' .abfrei{display:block;position:relative;width:100%;margin-bottom:13px}'
   /* Nur was die freie Lage braucht. Aussehen kommt aus .abbento .bk. */
   +A+' .abfrei .bk{position:absolute;overflow:hidden}'
   +A+' .abfrei .bkopf{flex:0 0 auto}'
   +A+' .abfrei .bfuss{flex:0 0 auto}'
   +A+' .abfrei.bearb{background:'
    +'repeating-linear-gradient(0deg,#eef1f5 0 1px,transparent 1px 40px),'
    +'repeating-linear-gradient(90deg,#eef1f5 0 1px,transparent 1px 40px);'
    +'outline:1px dashed #d9b45f;outline-offset:6px;border-radius:8px}'
   +A+' .abfrei.zieht{user-select:none;cursor:grabbing}'
   +A+' .abfrei .bk.bzieh{opacity:.85;box-shadow:0 8px 24px rgba(16,24,40,.18)}'
   +A+' .abfrei .bleib{overflow:auto}'
   /* Der Anfasser fuer die Groesse, unten rechts. */
   +A+' .abziehe{position:absolute;right:0;bottom:0;width:18px;height:18px;'
    +'cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#d9b45f 50%);'
    +'border-bottom-right-radius:15px;display:none}'
   +A+' .abfrei.bearb .abziehe{display:block}'
   +A+' .abedit[data-zieh]{cursor:grab}'
   +A+' .abeb.weg{color:'+_AB.krit+';border-color:#f2cfcf}'
   +A+' .abeb.weg:hover{background:#fdf1f1}'
   +A+' .abetitel{flex:1;min-width:60px;font:inherit;font-size:11px;font-weight:800;'
    +'text-transform:uppercase;letter-spacing:.04em;color:var(--abink);'
    +'background:#fff;border:1px solid #e8d7a8;border-radius:6px;padding:2px 6px}'
   /* D3: ausgewaehlt und festgenagelt muessen auf einen Blick zu sehen sein. */
   +A+' .abfrei .bk.bwahl{outline:2px solid '+_AB.kern+';outline-offset:-2px;'
    +'box-shadow:0 4px 16px rgba(31,111,235,.22)}'
   +A+' .abfrei .bk.bfest .abziehe{display:none}'
   +A+' .abfrei .bk.bfest .abedit{background:#eef1f5;border-bottom-color:#dfe4ea;cursor:default}'
   /* D4: Notizkachel */
   +A+' .abnotiz{width:100%;height:100%;min-height:80px;box-sizing:border-box;resize:none;'
    +'font:inherit;font-size:13px;line-height:1.5;color:var(--abink);'
    +'border:1px solid var(--abline);border-radius:9px;padding:8px 10px;background:#fffdf6}'
   +A+' .abnotizText{font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}'

   /* ======================================================================
      ROOT COCKPIT · C2 · 15.08.2026 — Ralph-Go nach acht Entwurfsrunden.
      Vorlage: bereiche/Mockup-ROOTCOCKPIT.html, dort steht auch, WORAN die
      Optik haengt. Kurz: Foto unter der Kachel, Verlauf darueber, Ueberschrift
      gross in Versalien, Statuspunkte rechts, Standort-Pille im Inhalt.
      🔴 Nur EIN Gruen. Rot und Gelb sind Warnstufen, keine Dekoration.
      ====================================================================== */
   /* Foto und Verlauf: zwei getrennte Ebenen. Der Verlauf deckt frueher als
      bei einer Zeichnung — sonst steht die Beschriftung auf einem Ast. */
   +A+' .abbento .bk{position:relative;overflow:hidden}'
   +A+' .abbento .bfoto{position:absolute;inset:0;z-index:0;background-repeat:no-repeat;'
    +'background-position:center right;background-size:cover;opacity:.55}'
   /* 🔴 16.08., Ralph: „kann man nicht lesen." Er hatte recht, und es war ein
      Rechenfehler von mir: der Verlauf war bis 42 % deckend — genau die Breite,
      auf der in der VORLAGE der Text steht. Meine Kacheln haben aber Zeilen
      ueber die GANZE Breite, und die rechte Haelfte lag damit auf dem Foto.
      Jetzt deckt er bis 72 % voll und laeuft erst danach aus. Das Foto bleibt
      als Stimmung am rechten Rand — der Text steht auf Weiss.
      Merksatz fuer das naechste Mal: ein Verlauf muss zum INHALT passen, nicht
      zur Vorlage, aus der er abgemessen wurde. */
   +A+' .abbento .bschleier{position:absolute;inset:0;z-index:1;background:'
    +'linear-gradient(90deg,#fff 0%,#fff 72%,rgba(255,255,255,.82) 88%,rgba(255,255,255,.25) 100%),'
    +'linear-gradient(0deg,rgba(255,255,255,.62) 0%,rgba(255,255,255,0) 42%)}'
   /* Bei den drei Kacheln, deren Zeilen bis ganz nach rechts laufen, deckt er
      vollstaendig — dort ist Lesbarkeit wichtiger als Atmosphaere. */
   +A+' .abbento .bk.btext .bschleier{background:'
    +'linear-gradient(90deg,#fff 0%,#fff 86%,rgba(255,255,255,.55) 100%)}'
   +A+' .abbento .bkopf,'+A+' .abbento .bleib,'+A+' .abbento .bfuss{position:relative;z-index:2}'
   /* Ueberschrift: aus 10,5px Kleinschrift wird die grosse Versalzeile der
      Vorlage. Das ist der auffaelligste Einzelunterschied. */
   +A+' .abbento .bkopf h3{font-size:15px;font-weight:800;letter-spacing:.02em;'
    +'text-transform:uppercase;color:var(--abink);line-height:1.15}'
   /* Statuspunkte rechts oben — der Zustand steht am Rand, nicht im Text. */
   +A+' .abbento .bleds{margin-left:auto;display:flex;gap:4px;flex:0 0 auto}'
   +A+' .abbento .bleds i{width:9px;height:9px;border-radius:50%;background:#c6cbce;display:block}'
   +A+' .abbento .bleds i.gr{background:'+_AB.gut+'}'
   +A+' .abbento .bleds i.r{background:'+_AB.krit+'}'
   +A+' .abbento .bleds i.ge{background:'+_AB.warn+'}'
   /* Standort-Pille: grauer Chip, Beschriftung grau, Wert gruen. */
   +A+' .abbento .bort{display:inline-flex;align-items:center;gap:5px;background:#eef0f1;'
    +'border-radius:13px;padding:4px 11px;font-size:11.5px;color:var(--abmut);'
    +'margin-bottom:9px;align-self:flex-start;max-width:100%}'
   +A+' .abbento .bort b{color:'+_AB.gut+';font-weight:700}'
   /* Legende mit Pfeil-Chips statt Punkten. */
   +A+' .abbento .bleg{display:flex;gap:13px;flex-wrap:wrap;padding-top:9px}'
   +A+' .abbento .bleg span{display:flex;align-items:center;gap:6px;font-size:10px;'
    +'color:var(--abmut);text-transform:uppercase;letter-spacing:.03em;line-height:1.25}'
   +A+' .abbento .bleg i{width:15px;height:11px;flex:0 0 auto;'
    +'clip-path:polygon(0 0,70% 0,100% 50%,70% 100%,0 100%)}'
   +A+' .abbento .bleg i.gr{background:'+_AB.gut+'}'
   +A+' .abbento .bleg i.ge{background:'+_AB.warn+'}'
   +A+' .abbento .bleg i.r{background:'+_AB.krit+'}'
   /* Markenkachel: der Fluxkompensator fuellt die Flaeche, der Text sitzt
      unten links davor. */
   +A+' .abbento .bmarke{position:relative;display:flex;align-items:center;'
    +'justify-content:center;padding:0;min-height:150px}'
   +A+' .abbento .bmarke svg{position:absolute;inset:0;width:100%;height:100%;opacity:.9}'
   +A+' .abbento .bmtext{position:relative;z-index:2;align-self:flex-end;padding:0 0 10px 2px;'
    +'display:flex;align-items:center;gap:10px;width:100%}'
   +A+' .abbento .bmtext b{font-size:27px;font-weight:800;color:'+_AB.gut+';letter-spacing:-1px}'
   +A+' .abbento .bmtext span{font-size:11px;color:var(--abmut);line-height:1.45}'
   /* ----- Was bei Ralph liegt (16.08.) -----
      Abgesetzt vom Rest der Kachel, damit man auf einen Blick sieht: das hier
      ist deins, das andere ist Arbeit. */
   +A+' .abbento .bralph{margin-top:9px;padding-top:8px;border-top:1px solid var(--abline)}'
   +A+' .abbento .brtitel{font-size:9.5px;font-weight:800;text-transform:uppercase;'
    +'letter-spacing:.08em;color:'+_AB.krit+';margin-bottom:5px}'
   +A+' .abbento .brz{display:flex;align-items:flex-start;gap:9px;padding:6px 0;'
    +'border-bottom:1px solid #f0f2f4;cursor:pointer}'
   +A+' .abbento .brz:last-child{border-bottom:0}'
   +A+' .abbento .brz:hover{background:#fafbfc}'
   +A+' .abbento .brn{flex:0 0 auto;font-size:11px;font-weight:800;color:var(--abmut);'
    +'background:#eef0f1;border-radius:5px;padding:2px 7px;'
    +'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:1px}'
   +A+' .abbento .brt{flex:1;min-width:0}'
   /* 🔴 ZWEI Zeilen, nicht eine mit Punkten. Die Titel der Work Items sind
      lang; abgeschnitten steht da „erfassung — Freigabegruende raus aus…" und
      Ralph weiss weiterhin nicht, worum es geht. Umschreiben darf ich sie
      nicht (§1.1) — also bekommen sie Platz. */
   +A+' .abbento .brt .b1{font-size:12.5px;font-weight:600;color:var(--abink);'
    +'line-height:1.32;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;'
    +'overflow:hidden}'
   +A+' .abbento .brt .b2{display:block;font-size:10.5px;color:var(--abmut);margin-top:1px}'
   +A+' .abbento .brp{width:8px;height:8px;border-radius:50%;flex:0 0 auto;margin-top:5px;background:'+_AB.zu+'}'
   +A+' .abbento .brp.krit{background:'+_AB.krit+'}'
   +A+' .abbento .brp.warn{background:'+_AB.warn+'}'
   +A+' .abbento .brmehr{font-size:11px;color:var(--abmut);margin-top:5px}'
   /* Work #34: eine Zeile, die einen Weg hat, sieht auch so aus. Zeilen ohne
      Weg bleiben unveraendert — sonst verspricht die Optik etwas, das fehlt. */
   +A+' .abbento .bzeile.bklick{cursor:pointer;border-radius:6px;margin:0 -4px;padding-left:4px;padding-right:4px}'
   +A+' .abbento .bzeile.bklick:hover{background:#f2f5f8}'
   +A+' .abbento .bpfeil{color:var(--abmut);font-weight:700}'
   /* ----- Befehlszeile (C4) ----- */
   +A+' .abcmd{background:#fff;border:1px solid var(--abline);border-radius:10px;'
    +'margin-top:2px;position:relative}'
   +A+' .abcmdz{display:flex;align-items:center;gap:9px;padding:10px 13px;'
    +'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}'
   +A+' .abcmdpf{color:'+_AB.gut+';font-weight:700;flex:0 0 auto}'
   +A+' .abcmdz input{flex:1;background:transparent;border:0;outline:0;color:var(--abink);'
    +'font-family:inherit;font-size:13px;min-width:0;padding:0}'
   +A+' .abcmdz input::placeholder{color:#a8b0b6}'
   +A+' .abcmdcur{width:8px;height:15px;background:'+_AB.gut+';display:inline-block;'
    +'animation:abBlink 1.05s steps(1) infinite;flex:0 0 auto}'
   +'@keyframes abBlink{0%,50%{opacity:1}51%,100%{opacity:0}}'
   +A+' .abcmdkb{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;'
    +'color:var(--abmut);border:1px solid var(--abline);border-radius:4px;padding:2px 6px;flex:0 0 auto}'
   +A+' .abcmdl{border-top:1px solid var(--abline);max-height:0;overflow:hidden;'
    +'transition:max-height .15s}'
   +A+' .abcmd.auf .abcmdl{max-height:240px;overflow:auto}'
   +A+' .abcmdv{display:flex;align-items:center;gap:11px;padding:8px 13px;font-size:12.5px;'
    +'cursor:pointer;border-bottom:1px solid #f0f2f4}'
   +A+' .abcmdv:last-child{border-bottom:0}'
   +A+' .abcmdv.sel{background:#f5f8f9}'
   +A+' .abcmdv .b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:'+_AB.gut+';'
    +'font-weight:700;flex:0 0 124px}'
   +A+' .abcmdv .t{color:var(--abmut);flex:1;min-width:0;overflow:hidden;'
    +'text-overflow:ellipsis;white-space:nowrap}'
   +A+' .abcmdv .z{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;'
    +'color:var(--abmut);flex:0 0 auto}'
   /* ----- Meilenstein-Zeitleiste (C5) ----- */
   +A+' .abzeit{background:#fff;border:1px solid var(--abline);border-radius:10px;'
    +'margin-top:2px;overflow:hidden}'
   +A+' .abzk{display:flex;align-items:center;gap:11px;padding:10px 13px 8px}'
   +A+' .abzk b{font-size:13.5px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;'
    +'color:var(--abink)}'
   +A+' .abzz{font-size:11.5px;color:var(--abmut)}'
   +A+' .abzsp{margin-left:auto;display:flex;gap:6px}'
   /* Die Bahn: Monate als Abschnitte, darin die Punkte nach Datum. */
   +A+' .abzb{position:relative;height:132px;margin:0 13px 13px;background:#f4f6f7;'
    +'border-radius:7px;overflow:hidden}'
   +A+' .abzm{position:absolute;top:0;bottom:0;border-right:1px solid #e4e7e9}'
   +A+' .abzm span{position:absolute;left:7px;top:5px;font-size:9.5px;font-weight:800;'
    +'letter-spacing:.08em;color:#a8b0b6}'
   +A+' .abzl{position:absolute;left:0;right:0;top:12px;height:2px;background:#dfe3e6}'
   +A+' .abzheute{position:absolute;top:0;bottom:0;width:2px;background:'+_AB.kern+';z-index:3}'
   +A+' .abzheute span{position:absolute;top:2px;left:4px;font-size:9px;font-weight:800;'
    +'letter-spacing:.06em;color:'+_AB.kern+';white-space:nowrap}'
   +A+' .abzziel{position:absolute;right:0;top:0;bottom:0;width:5px;background:'+_AB.gut+';z-index:3}'
   +A+' .abzziel span{position:absolute;top:4px;right:9px;font-size:9.5px;font-weight:800;'
    +'letter-spacing:.05em;color:'+_AB.gut+';text-align:right;line-height:1.25;white-space:nowrap}'
   /* Ein Meilenstein: Punkt auf der Bahn, Beschriftung daneben. */
   +A+' .abzp{position:absolute;display:flex;align-items:center;gap:6px;z-index:2;'
    +'transform:translateX(-4px);max-width:210px}'
   +A+' .abzp i{width:9px;height:9px;border-radius:50%;background:'+_AB.warn+';flex:0 0 auto;'
    +'border:2px solid #fff;box-shadow:0 0 0 1px '+_AB.warn+'}'
   +A+' .abzp span{font-size:10.5px;color:var(--abink);background:rgba(255,255,255,.86);'
    +'padding:1px 5px;border-radius:3px;white-space:nowrap;overflow:hidden;'
    +'text-overflow:ellipsis;max-width:150px}'
   +A+' .abzp em{font-style:normal;font-size:9px;color:var(--abmut);'
    +'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:1px}'
   +A+' .abzp.ok i{background:'+_AB.gut+';box-shadow:0 0 0 1px '+_AB.gut+'}'
   +A+' .abzp.ok span{color:var(--abmut);text-decoration:line-through}'
   +A+' .abzp.spaet i{background:'+_AB.krit+';box-shadow:0 0 0 1px '+_AB.krit+'}'
   +A+' .abzp.spaet span{color:'+_AB.krit+';font-weight:700}'
   +A+' .abzeit.bearb .abzp{cursor:pointer}'
   +A+' .abzeit.bearb .abzp:hover span{background:#fff;box-shadow:0 0 0 1px '+_AB.kern+'}'
   +A+' .abzeit.bearb .abzb{outline:2px dashed #d9b45f;outline-offset:-3px}'
   /* Punktwolken in den vergangenen Monaten — wie in der Vorlage. Sie zeigen
      KEINE Daten und tun auch nicht so: sie sind Struktur, damit die alten
      Abschnitte nicht leer wirken. Deshalb ohne Beschriftung und blass. */
   +A+' .abzwolke i{position:absolute;width:5px;height:5px;border-radius:50%;'
    +'background:'+_AB.gut+';opacity:.22;pointer-events:none}'

   /* ----- Halbkreis und Balkenzeilen (Luecken 3-5, nach der Vorlage) ----- */
   +A+' .abbento .bhalb{display:flex;flex-direction:column;align-items:center;margin-top:2px}'
   +A+' .abbento .bhalb .pz{font-size:25px;font-weight:400;color:var(--abink);margin-top:-30px}'
   +A+' .abbento .bhalb .pl{font-size:11.5px;color:var(--abmut);margin-top:1px}'
   +A+' .abbento .bpaar{display:flex;gap:8px;width:100%;margin:10px 0 9px}'
   +A+' .abbento .bpaar>div{flex:1;background:#eef0f1;border-radius:4px;padding:8px 9px;'
    +'display:flex;align-items:center;gap:8px}'
   +A+' .abbento .bpaar .ic2{font-size:13px;color:var(--abmut)}'
   +A+' .abbento .bpaar .v{font-size:18px;font-weight:400;color:'+_AB.gut+';line-height:1}'
   +A+' .abbento .bpaar .l{font-size:8.5px;color:var(--abmut);text-transform:uppercase;'
    +'letter-spacing:.05em;margin-top:3px}'
   /* Balkenzeile: die Zahl steht IM Balken, die Schwellen als Pillen davor. */
   +A+' .abbento .bbz{display:flex;align-items:center;gap:9px;margin-bottom:6px}'
   +A+' .abbento .bbz .nm{flex:0 0 122px;font-size:12px;color:var(--abink);line-height:1.25}'
   +A+' .abbento .bbz .schw{display:flex;gap:3px;margin-top:3px}'
   +A+' .abbento .bbz .schw i{font-size:8.5px;font-weight:700;padding:1px 4px;border-radius:2px;'
    +'font-style:normal}'
   +A+' .abbento .bbz .schw i.ge{background:#fdf0cf;color:#8a6300}'
   +A+' .abbento .bbz .schw i.r{background:#fbdedb;color:#a3271e}'
   +A+' .abbento .bbz .werte{flex:1;display:flex;gap:5px}'
   +A+' .abbento .bbz .werte b{flex:1;background:'+_AB.gut+';color:#fff;font-size:12.5px;'
    +'font-weight:700;text-align:center;padding:5px 0;border-radius:2px}'
   +A+' .abbento .bbz .werte b.ge{background:'+_AB.warn+'}'
   +A+' .abbento .bbz .werte b.r{background:'+_AB.krit+'}'

   /* ----- DUNKLE DARSTELLUNG (Luecke 1) -----
      🔴 NUR Farbwerte. Kein zweiter Aufbau, keine zweite Kachelliste. */
   +'body.dashDunkel '+A+'{--abbg:#0b0d0e;--abcard:#17191b;--abink:#eef1f2;'
    +'--abmut:#9299a0;--abline:#292d30}'
   +'body.dashDunkel '+A+' .abbento .bk{background:#17191b}'
   +'body.dashDunkel '+A+' .abbento .bfoto{opacity:.4;filter:saturate(.75) brightness(.85)}'
   +'body.dashDunkel '+A+' .abbento .bschleier{background:'
    +'linear-gradient(90deg,#17191b 0%,#17191b 72%,rgba(23,25,27,.85) 88%,rgba(23,25,27,.3) 100%),'
    +'linear-gradient(0deg,rgba(23,25,27,.62) 0%,rgba(23,25,27,0) 42%)}'
   +'body.dashDunkel '+A+' .abbento .bk.btext .bschleier{background:'
    +'linear-gradient(90deg,#17191b 0%,#17191b 86%,rgba(23,25,27,.6) 100%)}'
   +'body.dashDunkel '+A+' .abbento .bort,'
   +'body.dashDunkel '+A+' .abbento .bpaar>div{background:#202325}'
   +'body.dashDunkel '+A+' .abcmd,'
   +'body.dashDunkel '+A+' .abzeit{background:#17191b;border-color:#292d30}'
   +'body.dashDunkel '+A+' .abzb{background:#101214}'
   +'body.dashDunkel '+A+' .abzp span{background:rgba(23,25,27,.86);color:#eef1f2}'
   +'body.dashDunkel '+A+' .abbento .bleds i{background:#3a4045}'
   +'body.dashDunkel '+A+' .abbento .bkopf h3{color:#eef1f2}'
   +'body.dashDunkel '+A+' .abzk b{color:#eef1f2}';
  var st=document.createElement('style'); st.id='dashAbCss'; st.textContent=css; document.head.appendChild(st);
}

/* Abgeleitete Summen EINMAL berechnen — sonst rechnet jede Kachel ihre eigene
   Wahrheit, und zwei Zahlen auf derselben Seite widersprechen sich (§1.2c). */
function _abAbl(np){
  var w=(np&&np.waechter)||[], z=(np&&np.zufluesse)||[];
  var grp=function(m){ return w.filter(function(x){return x.moment===m;}); };
  var sum=function(a){ return a.reduce(function(s,x){return s+(Number(x.offen)||0);},0); };
  var zs=function(weg){ return z.filter(function(x){return x.weg===weg;})
                          .reduce(function(s,x){return s+(Number(x.wartend)||0);},0); };
  return {
    gate_offen:sum(w.filter(function(x){return x.gate===true;})),
    gate_anzahl:w.filter(function(x){return x.gate===true;}).length,
    anlage:{n:grp('anlage').length,o:sum(grp('anlage'))},
    tuer:{n:grp('tuer').length,o:sum(grp('tuer'))},
    bestand:{n:grp('bestand').length,o:sum(grp('bestand'))},
    melden:w.filter(function(x){return (Number(x.offen)||0)>0;}).length,
    sackgasse:zs('keiner'), handarbeit:zs('hand'), automatik:zs('auto'),
    wartend:z.reduce(function(s,x){return s+(Number(x.wartend)||0);},0)
  };
}
function _abWf(w){ return (Number(w.offen)||0)===0 ? _AB.gut : (w.gate===true?_AB.krit:_AB.warn); }
function _abZf(z){ return (Number(z.wartend)||0)===0 ? _AB.gut : (z.weg==='keiner'?_AB.krit:_AB.warn); }

/* Die Dashboard-Auswahl kennt genau Arbeitsfläche und Architektur. */
function _abUmschalter(ans){
  var b=[['flaeche','Arbeitsfläche','Hero, Kacheln, Ring und Arbeitsliste'],
         /* 🔴 26.08.2026, Ralph: „die darstellung am dashboard ist schlecht, das
            sollte eher wie ein kanbanboard aufgebaut sein mit aufgabenstränge …
            und nicht als popup sondern anders und schön."
            Die Aufgaben sind damit eine gleichrangige ANSICHT, kein Overlay. */
         ['aufgaben','Aufgaben','Kanban — ein Strang je Thema, vier Spalten von offen bis fertig'],
         ['architektur','Architektur','Wirkdiagramm — Knoten, Kanten und Wächter aus der Datenbank']];
  return '<span class="abum">'+b.map(function(x){
    return '<button data-ans="'+x[0]+'" class="'+(ans===x[0]?'on':'')+'" title="'+x[2]+'">'
      +x[1]+'</button>'; }).join('')+'</span>';
}
function _abUmschalterNach(){
  var box=document.getElementById('fgDash'); if(!box) return;
  box.querySelectorAll('.abum button[data-ans]').forEach(function(b){
    b.addEventListener('click',function(){ dashArbeitAnsichtSet(b.dataset.ans); });
  });
  var nb=document.getElementById('abNeu');
  if(nb) nb.addEventListener('click',function(){
    /* Work #121: „Aktualisieren" muss auch das Cockpit neu holen. Ohne diese
       Zeile haette der Knopf die Seite neu gebaut und dieselbe alte Lage
       wieder hingeschrieben — ein Knopf, der so tut, als haette er gemessen. */
    _AB_CK=null; _AB_CK_FEHLER=null;
    if(typeof loadDashboard==='function') loadDashboard();
  });
}

/* 16.09.2026 (Ralph): Aufgaben- und Architektur-Ansicht geloescht — es gibt nur
   noch die Arbeitsflaeche. Alte gespeicherte Werte ('architektur'/'aufgaben')
   werden ignoriert statt gelesen. */
function dashArbeitAnsichtGet(){
  return 'flaeche';
}
function dashArbeitAnsichtSet(v){
  if(typeof loadDashboard==='function') loadDashboard();
}

/* ===========================================================================
   ARCHITEKTUR / WIRKDIAGRAMM — Work #29 (Ralph-Entscheid 15.08.2026)

   Die Erfassungs-Architektur liegt seit 15.08. in shadow_v1.architecture_* und
   wird ueber cb_admin_architektur_* gelesen und gepflegt. Diese Ansicht rendert
   sie. Die HTML-Datei bereiche/wirkdiagramm-erfassung.html ist damit nur noch
   Import- und Archivquelle, nicht mehr die Wahrheit.

   🔴 KEINE ZWEITE KNOTEN-KONSTANTE (§4.2, Ralph-Auflage zu diesem Durchgang).
   In dieser Datei steht kein einziger Knoten, keine Lane-Liste, keine
   Statusliste und keine Zahl. Alles kommt aus der RPC:
     - die Kopfzahlen aus a.counts, SERVERSEITIG gezaehlt und hier nur angezeigt.
       Nicht nachgerechnet — eine nachgerechnete Bilanz ist die zweite Wahrheit,
       die §26 und §28.4 gerade verhindern sollen.
     - die Reihenfolge der Bahnen aus dem kleinsten sort_order ihrer Knoten,
       also ABGELEITET statt gepflegt. Verschiebt ChatGPT einen Knoten, wandert
       die Bahn mit, ohne dass hier jemand etwas nachtraegt.
     - die Auswahlwerte der Schreibfelder aus den tatsaechlich vorkommenden
       Werten. Kommt serverseitig ein neuer Status dazu, steht er hier, ohne
       dass diese Datei angefasst werden muss.

   Geschrieben wird ausschliesslich ueber cb_admin_architektur_node_setzen und
   cb_admin_architektur_verifizieren, beide mit Pflichtbegruendung.
   =========================================================================== */
function arCss(){
  if(document.getElementById('arCssTag')) return;
  var s=document.createElement('style'); s.id='arCssTag';
  s.textContent=[
   '.arWrap{font-size:13px}',
   '.arKopf{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:0 0 12px}',
   '.arZ{display:flex;flex-direction:column;padding:7px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);min-width:74px}',
   '.arZ b{font-size:17px;line-height:1.15}',
   '.arZ span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}',
   '.arZ.on{outline:2px solid var(--k-2563eb,#2563eb);outline-offset:1px}',
   '.arZ[role=button]{cursor:pointer}',
   '.arBahn{margin:16px 0 0}',
   '.arBahnT{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 7px;padding-bottom:4px;border-bottom:1px solid var(--line)}',
   '.arGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:9px}',
   '.arK{border:1px solid var(--line);border-left-width:4px;border-radius:9px;background:var(--card);padding:9px 11px}',
   '.arK[data-st=gut]{border-left-color:#16a34a}',
   '.arK[data-st=lueck]{border-left-color:#d97706}',
   '.arK[data-st=bruch]{border-left-color:#dc2626}',
   '.arK[data-st=grenze]{border-left-color:#64748b}',
   '.arKt{font-weight:650;font-size:13px;margin:0 0 3px;display:flex;gap:6px;align-items:baseline}',
   '.arAdr{font-size:10.5px;color:var(--muted);font-weight:500;flex:0 0 auto}',
   '.arKs{color:var(--muted);font-size:11.5px;line-height:1.45}',
   '.arKm{font-size:11.5px;margin-top:5px;line-height:1.45}',
   '.arP{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;margin:5px 4px 0 0;border:1px solid var(--line)}',
   '.arP.p1{background:#fee2e2;color:#991b1b;border-color:#fecaca}',
   '.arP.p2{background:#ffedd5;color:#9a3412;border-color:#fed7aa}',
   '.arP.p3{background:#f1f5f9;color:#475569}',
   '.arP.rev{background:#fef9c3;color:#854d0e;border-color:#fde68a}',
   '.arP.ver{background:#dcfce7;color:#166534;border-color:#bbf7d0}',
   '.arP.ent{background:#dbeafe;color:#1e40af;border-color:#bfdbfe}',
   '.arP.own{background:transparent;color:var(--muted)}',
   '.arDet{margin-top:8px;font-size:11.5px}',
   '.arDet>summary{cursor:pointer;color:var(--muted);font-size:11px;user-select:none}',
   '.arDet dl{margin:7px 0 0;display:grid;grid-template-columns:auto 1fr;gap:3px 9px}',
   '.arDet dt{color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}',
   '.arDet dd{margin:0;font-size:11.5px;word-break:break-word}',
   '.arKante{display:block;font-size:11px;color:var(--muted);margin-top:2px}',
   '.arForm{margin-top:9px;padding-top:8px;border-top:1px dashed var(--line);display:grid;gap:6px}',
   '.arForm label{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}',
   '.arForm select,.arForm input,.arForm textarea{width:100%;padding:5px 7px;border:1px solid var(--line);border-radius:7px;background:var(--bg,#fff);color:var(--ink);font-size:12px;font-family:inherit}',
   '.arForm .arRow{display:flex;gap:6px}',
   '.arBtn{padding:5px 11px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);font-size:11.5px;font-weight:650;cursor:pointer}',
   '.arBtn.pri{background:#1d4ed8;color:#fff;border-color:#1d4ed8}',
   '.arBtn:disabled{opacity:.5;cursor:not-allowed}',
   '.arMsg{font-size:11.5px;margin-top:6px}',
   '.arWa{border:1px solid #fecaca;background:#fef2f2;border-radius:9px;padding:9px 11px;margin:0 0 12px}',
   '.arWa ul{margin:6px 0 0;padding-left:17px}',
   '.arWa li{font-size:11.5px;margin-bottom:3px}',
   '.arLeer{color:var(--muted);font-size:12px;padding:16px 0}'
  ].join('\n');
  document.head.appendChild(s);
}

function arFilterGet(){
  try{ return localStorage.getItem('ri_ar_filter')||'alle'; }catch(e){ return 'alle'; }
}
function arFilterSet(v){
  try{ localStorage.setItem('ri_ar_filter',v); }
  catch(e){ try{ console.warn('Architektur-Filter nicht speicherbar:',e); }catch(_){} }
  arRender();
}

/* Beide Abrufe getrennt gefangen: faellt der Waechter aus, soll das Diagramm
   trotzdem stehen — und der Grund sichtbar sein, nicht im Nichts verschwinden. */
async function arLaden(){
  var out={a:null,w:null,aFehler:'',wFehler:''};
  try{
    var r=await client.rpc('cb_admin_architektur_liste',{p_diagram_key:'produkterfassung'});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==='string') d=JSON.parse(d);
    out.a=d;
  }catch(e){
    out.aFehler=(e&&e.message)?String(e.message):String(e);
    try{ console.error('[Architektur] cb_admin_architektur_liste:',e); }catch(_){}
  }
  try{
    var rw=await client.rpc('cb_admin_architektur_waechter',{p_diagram_key:'produkterfassung'});
    if(rw&&rw.error) throw rw.error;
    var dw=rw&&rw.data; if(typeof dw==='string') dw=JSON.parse(dw);
    out.w=Array.isArray(dw)?dw:[];
  }catch(e){
    out.wFehler=(e&&e.message)?String(e.message):String(e);
    try{ console.error('[Architektur] cb_admin_architektur_waechter:',e); }catch(_){}
  }
  window._arDaten=out;
  return out;
}

/* Welche Knoten der aktive Filter zeigt. Die Kopfzahlen kommen aus a.counts und
   werden hier NICHT nachgerechnet; diese Funktion entscheidet nur, was sichtbar
   ist — sie behauptet keine Bilanz. */
function arGefiltert(nodes,filter){
  return nodes.filter(function(n){
    if(n.is_archived) return false;
    switch(filter){
      case 'prio1':    return String(n.priority)==='1';
      case 'offen':    return n.review_state!=='current';
      case 'entscheid':return !!n.decision_text;
      case 'arbeit':   return n.status==='lueck'||n.status==='bruch';
      case 'verif':    return !!n.verified_at;
      default:         return true;
    }
  });
}

function arHtml(){
  var D=window._arDaten||{}, a=D.a, w=D.w||[];
  var kopf='<div class="ab"><div class="abkopf"><h2>Architektur · Wirkdiagramm</h2>'
    +'<span class="st">aus der Datenbank — cb_admin_architektur_liste</span>'
    +'<span style="margin-left:auto;display:flex;gap:9px;align-items:center">'
    +_abUmschalter('architektur')
    +'<button class="abbtn" id="abNeu">↻ Aktualisieren</button></span></div></div>';

  if(!a || !a.nodes){
    return kopf+'<div class="arWrap"><div style="color:var(--k-dc2626);font-size:12.5px">'
      +'<b>Architektur nicht verfügbar.</b> Grund: '+esc(D.aFehler||'cb_admin_architektur_liste hat nichts geliefert')
      +'</div></div>';
  }

  var nodes=a.nodes||[], edges=a.edges||[], c=a.counts||{}, dia=a.diagram||{};
  var filter=arFilterGet();

  /* Nachbarn je Knoten aus den Kanten — ebenfalls abgeleitet, nicht gepflegt. */
  var raus={}, rein={};
  edges.forEach(function(e){
    if(e.is_active===false) return;
    (raus[e.from_node_key]=raus[e.from_node_key]||[]).push(e);
    (rein[e.to_node_key]=rein[e.to_node_key]||[]).push(e);
  });
  var titelVon={}; nodes.forEach(function(n){ titelVon[n.node_key]=n.title||n.node_key; });

  /* Die Kopfzahlen: NUR anzeigen, was der Server gezaehlt hat. Steht ein
     Schluessel nicht in counts, wird die Kachel weggelassen statt geraten. */
  var kacheln=[['gesamt','Knoten','alle'],['gut','gut','—'],['lueck','Lücke','arbeit'],
               ['bruch','Bruch','arbeit'],['grenze','Grenze','—'],['prio1','Prio 1','prio1'],
               ['review_offen','Review offen','offen'],['ralph_entscheid','bei Ralph','entscheid']];
  var zahlen=kacheln.filter(function(k){ return c[k[0]]!=null; }).map(function(k){
    var klick=(k[2]!=='—');
    return '<div class="arZ'+(klick&&filter===k[2]?' on':'')+'"'
      +(klick?' role="button" tabindex="0" data-fil="'+esc(k[2])+'"':'')
      +'><b>'+esc(String(c[k[0]]))+'</b><span>'+esc(k[1])+'</span></div>';
  }).join('');

  var filterLeiste='<div class="arKopf">'+zahlen
    +'<div style="margin-left:auto;display:flex;gap:6px;align-items:center">'
    +'<span style="font-size:11px;color:var(--muted)">Filter</span>'
    +'<select id="arFil" class="arBtn" style="font-weight:500">'
    +[['alle','alle Knoten'],['arbeit','nur Lücke und Bruch'],['prio1','nur Prio 1'],
      ['offen','Review offen'],['entscheid','Entscheidung bei Ralph'],['verif','verifiziert']]
      .map(function(o){ return '<option value="'+o[0]+'"'+(filter===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
    +'</select></div></div>';

  /* Waechter: kritische Meldungen zuerst, der Rest zusammengefasst. */
  var waBlock='';
  if(D.wFehler){
    waBlock='<div class="arWa"><b>Wächter nicht abrufbar.</b> Grund: '+esc(D.wFehler)+'</div>';
  }else if(w.length){
    var krit=w.filter(function(x){ return x.severity==='kritisch'; });
    waBlock='<div class="arWa"><b>Wächter: '+esc(String(w.length))+' Meldungen</b>'
      +(krit.length?' · '+esc(String(krit.length))+' kritisch':'')
      +'<ul>'+krit.slice(0,6).map(function(x){
          return '<li><b>'+esc(x.title||x.node_key)+'</b> — '+esc(x.problem||'')
            +(x.owner_agent?' <span style="color:var(--muted)">('+esc(x.owner_agent)+')</span>':'')+'</li>';
        }).join('')
      +(krit.length>6?'<li style="color:var(--muted)">… und '+esc(String(krit.length-6))+' weitere kritische</li>':'')
      +'</ul></div>';
  }

  var sicht=arGefiltert(nodes,filter);
  if(!sicht.length){
    return kopf+'<div class="arWrap">'+filterLeiste+waBlock
      +'<div class="arLeer">Kein Knoten passt zu diesem Filter.</div></div>';
  }

  /* Bahnenreihenfolge ABGELEITET aus dem kleinsten sort_order je Bahn. */
  var bahnMin={};
  nodes.forEach(function(n){
    var s=(n.sort_order==null)?1e9:Number(n.sort_order);
    if(bahnMin[n.lane]==null||s<bahnMin[n.lane]) bahnMin[n.lane]=s;
  });
  var bahnen=Object.keys(bahnMin).sort(function(x,y){ return bahnMin[x]-bahnMin[y]; });

  /* Adresse Bahn.Position — berechnet, nicht gepflegt (§26.7). Sie zaehlt ueber
     ALLE Knoten der Bahn, nicht nur die sichtbaren; sonst wuerde ein Filter die
     Adressen verschieben und der Verweis waere beim naechsten Mal falsch. */
  var adr={};
  bahnen.forEach(function(b){
    nodes.filter(function(n){ return n.lane===b; })
      .sort(function(x,y){ return (x.sort_order||0)-(y.sort_order||0); })
      .forEach(function(n,i){ adr[n.node_key]=(bahnen.indexOf(b)+1)+'.'+(i+1); });
  });

  /* Auswahlwerte aus dem Bestand ableiten statt hier zu hinterlegen. */
  function werte(feld){
    var s={}; nodes.forEach(function(n){ if(n[feld]!=null&&n[feld]!=='') s[String(n[feld])]=1; });
    return Object.keys(s).sort();
  }
  var stWerte=werte('status'), prWerte=werte('priority'), rvWerte=werte('review_state');

  var koerper=bahnen.map(function(b){
    var drin=sicht.filter(function(n){ return n.lane===b; })
      .sort(function(x,y){ return (x.sort_order||0)-(y.sort_order||0); });
    if(!drin.length) return '';
    return '<div class="arBahn"><div class="arBahnT">'+esc(b)+' · '+esc(String(drin.length))+'</div>'
      +'<div class="arGrid">'+drin.map(function(n){
        var pl='';
        if(n.priority!=null) pl+='<span class="arP p'+esc(String(n.priority))+'">Prio '+esc(String(n.priority))+'</span>';
        if(n.review_state!=='current') pl+='<span class="arP rev">Review offen</span>';
        if(n.verified_at) pl+='<span class="arP ver">🔒 verifiziert</span>';
        if(n.decision_text) pl+='<span class="arP ent">🙋 bei Ralph</span>';
        if(n.owner_agent) pl+='<span class="arP own">'+esc(n.owner_agent)+'</span>';

        var nb='';
        (rein[n.node_key]||[]).forEach(function(e){
          nb+='<span class="arKante">← '+esc(titelVon[e.from_node_key]||e.from_node_key)
            +(e.edge_type&&e.edge_type!=='flow'?' ['+esc(e.edge_type)+']':'')
            +(e.label?' · '+esc(e.label):'')+'</span>'; });
        (raus[n.node_key]||[]).forEach(function(e){
          nb+='<span class="arKante">→ '+esc(titelVon[e.to_node_key]||e.to_node_key)
            +(e.edge_type&&e.edge_type!=='flow'?' ['+esc(e.edge_type)+']':'')
            +(e.label?' · '+esc(e.label):'')+'</span>'; });

        var dl='';
        function zeile(t,v){ if(v==null||v==='') return; dl+='<dt>'+esc(t)+'</dt><dd>'+esc(String(v))+'</dd>'; }
        zeile('Schlüssel',n.node_key);
        zeile('Beleg',n.evidence_text);
        zeile('Entscheidung',n.decision_text);
        zeile('Status',n.status); zeile('Review',n.review_state);
        zeile('Verifiziert',n.verified_at?(String(n.verified_at).slice(0,10)+(n.verified_by_agent?' · '+n.verified_by_agent:'')):null);
        zeile('Prüfnotiz',n.verification_note);
        zeile('Herkunft',n.source_ref);
        zeile('Work',n.work_id);
        zeile('Geändert',String(n.updated_at||'').slice(0,10)+(n.updated_by_agent?' · '+n.updated_by_agent:''));

        var form='<div class="arForm" data-key="'+esc(n.node_key)+'">'
          +'<div class="arRow">'
          +'<div style="flex:1"><label>Status</label><select data-f="status">'
          +stWerte.map(function(v){ return '<option'+(v===n.status?' selected':'')+'>'+esc(v)+'</option>'; }).join('')
          +'</select></div>'
          +'<div style="flex:1"><label>Prio</label><select data-f="priority">'
          +'<option value=""'+(n.priority==null?' selected':'')+'>—</option>'
          +prWerte.map(function(v){ return '<option'+(String(n.priority)===v?' selected':'')+'>'+esc(v)+'</option>'; }).join('')
          +'</select></div>'
          +'<div style="flex:1"><label>Review</label><select data-f="review_state">'
          +rvWerte.map(function(v){ return '<option'+(v===n.review_state?' selected':'')+'>'+esc(v)+'</option>'; }).join('')
          +'</select></div></div>'
          +'<div><label>Begründung — Pflicht</label>'
          +'<input type="text" data-f="reason" placeholder="warum diese Änderung, mit Messung"></div>'
          +'<div class="arRow"><button class="arBtn pri" data-akt="setzen">Änderung speichern</button>'
          +'<button class="arBtn" data-akt="verif">🔒 verifizieren</button></div>'
          +'<div class="arMsg" data-rolle="msg"></div></div>';

        return '<div class="arK" data-st="'+esc(n.status||'')+'" data-key="'+esc(n.node_key)+'">'
          +'<div class="arKt"><span class="arAdr">'+esc(adr[n.node_key]||'')+'</span>'
          +'<span>'+esc(n.title||n.node_key)+'</span></div>'
          +(n.summary?'<div class="arKs">'+esc(n.summary)+'</div>':'')
          +(n.metric?'<div class="arKm">'+esc(n.metric)+'</div>':'')
          +'<div>'+pl+'</div>'
          +'<details class="arDet"><summary>Details, Nachbarn und Pflege</summary>'
          +(nb?'<div style="margin-top:6px">'+nb+'</div>':'')
          +(dl?'<dl>'+dl+'</dl>':'')
          +form
          +'</details></div>';
      }).join('')+'</div></div>';
  }).join('');

  var fuss='<div style="margin-top:16px;font-size:11px;color:var(--muted)">'
    +esc(dia.title||'Wirkdiagramm')+' · '+esc(String(nodes.length))+' Knoten · '
    +esc(String(edges.length))+' Kanten · Stand '+esc(String(dia.updated_at||'').slice(0,16).replace('T',' '))
    +' · Herkunft '+esc(dia.source_ref||'—')
    +' — gepflegt wird in der Datenbank, nicht in der HTML-Datei.</div>';

  return kopf+'<div class="arWrap">'+filterLeiste+waBlock+koerper+fuss+'</div>';
}

function arRender(){
  var box=document.getElementById('fgDash'); if(!box) return;
  arCss();
  box.innerHTML=arHtml();
  arNach();
}

function arNach(){
  var box=document.getElementById('fgDash'); if(!box) return;
  _abUmschalterNach();
  var sel=document.getElementById('arFil');
  if(sel) sel.addEventListener('change',function(){ arFilterSet(sel.value); });
  box.querySelectorAll('.arZ[data-fil]').forEach(function(z){
    z.addEventListener('click',function(){ arFilterSet(z.dataset.fil); });
    z.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); arFilterSet(z.dataset.fil); } });
  });
  box.querySelectorAll('.arForm').forEach(function(f){
    var key=f.dataset.key;
    var msg=f.querySelector('[data-rolle=msg]');
    function sag(t,farbe){ if(msg){ msg.textContent=t; msg.style.color=farbe||'var(--muted)'; } }
    function grund(){ var i=f.querySelector('[data-f=reason]'); return i?i.value.trim():''; }
    f.querySelectorAll('button[data-akt]').forEach(function(b){
      b.addEventListener('click',async function(){
        var g=grund();
        if(!g){ sag('Ohne Begründung wird nichts geschrieben — eine Änderung ohne Grund ist beim nächsten Lesen nicht nachvollziehbar.','#b45309'); return; }
        var akt=b.dataset.akt;
        var alt=b.textContent;
        b.disabled=true; b.textContent='…';
        try{
          if(akt==='verif'){
            var rv=await client.rpc('cb_admin_architektur_verifizieren',
              {p_diagram_key:'produkterfassung',p_node_key:key,p_agent:'claude',p_note:g});
            if(rv&&rv.error) throw rv.error;
            sag('Verifiziert gespeichert. Wird beim Neuladen sichtbar.','#166534');
          }else{
            var patch={};
            f.querySelectorAll('[data-f]').forEach(function(el){
              var name=el.dataset.f; if(name==='reason') return;
              var v=el.value;
              patch[name]=(v===''||v==='—')?null:(name==='priority'?Number(v):v);
            });
            var rs=await client.rpc('cb_admin_architektur_node_setzen',
              {p_diagram_key:'produkterfassung',p_node_key:key,p_patch:patch,p_reason:g,p_agent:'claude'});
            if(rs&&rs.error) throw rs.error;
            sag('Gespeichert. Wird beim Neuladen sichtbar.','#166534');
          }
        }catch(e){
          /* Kein leerer Fangblock (§11.4): der Grund steht sichtbar am Knoten,
             nicht nur in der Konsole — sonst sieht ein misslungener Schreibvorgang
             aus wie ein gelungener. */
          var t=(e&&e.message)?String(e.message):String(e);
          sag('Nicht gespeichert: '+t,'#dc2626');
          try{ console.error('[Architektur] Schreiben fehlgeschlagen',key,e); }catch(_){}
        }
        b.disabled=false; b.textContent=alt;
      });
    });
  });
}
if(typeof window!=='undefined'){
  window.arRender=arRender; window.arLaden=arLaden; window.arFilterSet=arFilterSet;
}

/* ---------------------------------------------------------------------------
   WÄCHTER-RING (aus Mockup B). 25 Segmente, drei Gruppen, feste Plätze.
   --------------------------------------------------------------------------- */
function _abRing(np,A){
  var w=(np&&np.waechter)||[];
  var ord=['anlage','tuer','bestand'], liste=[];
  ord.forEach(function(m){ w.filter(function(x){return x.moment===m;}).forEach(function(x){ liste.push(x); }); });
  if(!liste.length) return '<div class="abpad" style="color:'+_AB.krit+';font-size:12.5px">'
    +'Wächter nicht ladbar — der Ring bleibt leer. Grau heißt hier: wir wissen es nicht.</div>';
  var CXv=196, CYv=196, R1=112, R2=146, luecke=0.06;
  var span=(Math.PI*2 - luecke*3)/liste.length, a=-Math.PI/2, letzt=liste[0].moment, s='';
  var pol=function(r,ang){ return [(CXv+Math.cos(ang)*r).toFixed(1),(CYv+Math.sin(ang)*r).toFixed(1)]; };
  liste.forEach(function(o,i){
    if(o.moment!==letzt){ a+=luecke; letzt=o.moment; }
    var a2=a+span*0.86, f=_abWf(o), still=(Number(o.offen)||0)===0;
    var p1=pol(R2,a),p2=pol(R2,a2),p3=pol(R1,a2),p4=pol(R1,a);
    s+='<path class="abseg" data-w="'+i+'" d="M'+p1[0]+' '+p1[1]+'A'+R2+' '+R2+' 0 0 1 '+p2[0]+' '+p2[1]
      +'L'+p3[0]+' '+p3[1]+'A'+R1+' '+R1+' 0 0 0 '+p4[0]+' '+p4[1]+'Z" fill="'+f+'" opacity="'
      +(still?'0.26':'1')+'"><title>'+esc(o.name)+' — '+(still?'still':(o.offen+' offen'))
      +(o.gate===true?' · Go-Live-Gate':'')+'\n'+esc(o.kurz||'')+'</title></path>';
    a=a2+span*0.14;
  });
  [['Anlage',-Math.PI/2+0.2],['Tür',0.5],['Bestand',2.5]].forEach(function(l){
    var p=pol(R2+15,l[1]);
    s+='<text x="'+p[0]+'" y="'+p[1]+'" text-anchor="middle" font-size="10" font-weight="700" '
      +'fill="#9aa1ab" letter-spacing=".4">'+l[0]+'</text>';
  });
  var k=(np&&np.extra)||{};
  s+='<circle cx="'+CXv+'" cy="'+CYv+'" r="'+(R1-8)+'" fill="#fff" stroke="#eceff3"/>'
    +'<text x="'+CXv+'" y="'+(CYv-14)+'" text-anchor="middle" font-size="40" font-weight="800" '
    +'fill="'+_AB.kern+'" letter-spacing="-1.8">'+(_abKernZahl(np,'aktiv'))+'</text>'
    +'<text x="'+CXv+'" y="'+(CYv+7)+'" text-anchor="middle" font-size="11" fill="#8b93a0">aktive Produkte</text>'
    +'<text x="'+CXv+'" y="'+(CYv+31)+'" text-anchor="middle" font-size="12.5" font-weight="700" '
    +'fill="'+_AB.ink+'">Ø '+(_abKernZahl(np,'schnitt'))+' Index</text>'
    +'<text x="'+CXv+'" y="'+(CYv+50)+'" text-anchor="middle" font-size="10.5" fill="#8b93a0">'
    +(_abKernZahl(np,'ohne'))+' bewusst ohne Zahl</text>';
  return '<div style="padding:6px 10px 10px"><svg viewBox="0 0 392 392" id="abRing">'+s+'</svg></div>';
}
/* Kern-Zahlen kommen aus cb_dashboard und werden hier nur GELESEN. */
var _abD=null;
/* np gehoert dazu: der Anordnen-Modus zeichnet die Kacheln neu und braucht
   dieselben Daten wie der Erstaufbau — sonst holt er sie ein zweites Mal und
   zeigt womoeglich einen anderen Stand als der Rest der Seite (§4.2). */
var _abNp=null;
function _abKernZahl(np,was){
  var k=(_abD&&_abD.katalog)||{}, q=(_abD&&_abD.qualitaet)||{};
  if(was==='aktiv')   return k.aktiv==null?'–':k.aktiv;
  if(was==='schnitt') return k.schnitt_score==null?'–':String(k.schnitt_score).replace('.',',');
  if(was==='ohne')    return q.ohne_score==null?'–':q.ohne_score;
  return '–';
}

/* ---------------------------------------------------------------------------
   ARBEITSLISTE — abgeleitet, nicht gepflegt.
   --------------------------------------------------------------------------- */
/* 🔴 15.08.2026 AUFGETEILT (Durchgang 2): die ERHEBUNG steht jetzt in
   _abJobsListe, das MARKUP in _abJobs. Grund: die neue Bento-Kachel „Heute"
   braucht dieselben Aufgaben in anderer Form. Haette ich sie dort neu erhoben,
   gaebe es zwei Vorstellungen davon, was dringend ist — und irgendwann
   widersprechen sich zwei Kacheln auf derselben Seite (§4.2).
   Die Reihenfolge, die Schwellen und die Texte sind UNVERAENDERT uebernommen. */
function _abJobsListe(np,A){
  var jobs=[], z=(np&&np.zufluesse)||[], w=(np&&np.waechter)||[];
  z.filter(function(x){return x.weg==='keiner'&&(Number(x.wartend)||0)>0;}).forEach(function(x){
    /* 🔴 16.08.2026, Ralph: „die scanns koennen weit nach hinten, keine prio."
       Betroffen ist GENAU EIN Zufluss — 'barcode' (Barcode-Scan ohne Foto),
       gemessen 87 wartend. Er stand auf p:0 und damit ganz oben.
       KLEINE RICHTIGSTELLUNG: Ralph nennt sie „die off importe". Die 87 sind
       aber die Scan-Warteschlange ohne Etikettfoto; der OpenFoodFacts-Cache
       ist ein anderer Zufluss ('scancache', gemessen 48). Zurueckgestuft habe
       ich die 87 — das ist die Zahl, die er genannt hat. */
    var hinten=(x.id==='barcode');
    jobs.push({p:hinten?9:0, n:x.wartend,
      t1:x.name+(hinten?' — liegen bewusst hinten':' — niemand holt sie ab'),
      t2:hinten
        ? ('keine Prio (Ralph 16.08.) · ältester Eintrag '
           +(x.aeltester_tage==null?'?':x.aeltester_tage)+' Tage alt')
        : ('ältester Eintrag '+(x.aeltester_tage==null?'?':x.aeltester_tage)+' Tage alt · '+(x.hinweis||'')),
      go:hinten?'später →':'Weg festlegen →', f:hinten?_AB.grau:_AB.krit, ziel:'scan'});
  });
  if(A.gate_offen>0) jobs.push({p:1,n:A.gate_offen,t1:'Go-Live-Gate blockiert',
    t2:'diese Fälle verhindern jede Freigabe',go:'Wächter →',f:_AB.krit,ziel:'waechter'});
  z.filter(function(x){return x.weg==='hand'&&(Number(x.wartend)||0)>0;}).forEach(function(x){
    /* 🔴 16.08.2026, Ralph: „oof nach hinten, ja." Gemeint ist der
       OpenFoodFacts-Cache (Zufluss 'scancache', gemessen 48 wartend). Er stand
       auf p:2, jetzt p:9 — gleichauf mit den Barcode-Scans ganz unten.
       Beide sind damit zurueckgestuft, aber KEINER ist verschwunden. */
    var hinten=(x.id==='scancache');
    jobs.push({p:hinten?9:2, n:x.wartend,
      t1:x.name+(hinten?' — liegen bewusst hinten':' prüfen'),
      t2:hinten
        ? ('keine Prio (Ralph 16.08.) · ältester '
           +(x.aeltester_tage==null?'?':x.aeltester_tage)+' Tage · Vorstufe, wird erst Katalog wenn du sie übernimmst')
        : ('ältester '+(x.aeltester_tage==null?'?':x.aeltester_tage)+' Tage · nur du kannst das'),
      go:hinten?'später →':'Öffnen →', f:hinten?_AB.grau:_AB.warn, ziel:'scan'});
  });
  w.filter(function(x){return x.moment==='bestand'&&(Number(x.offen)||0)>0;})
   .sort(function(a,b){return b.offen-a.offen;}).slice(0,3).forEach(function(x){
    jobs.push({p:3,n:x.offen,t1:x.name,t2:(x.kurz||'')+' · blockiert nichts, will Nacharbeit',
      go:'Liste →',f:_AB.warn,ziel:'waechter'});
  });
  var td=((np&&np.extra)||{}).todos;
  if(td>0) jobs.push({p:4,n:td,t1:'Offene Notizen im Notizbuch',
    t2:'eigene Merkzettel und Prüfaufträge',go:'Notizbuch →',f:_AB.warn,ziel:'todo'});
  if(np&&np.wochenlauf&&np.wochenlauf.protokolliert===false)
    jobs.push({p:5,n:'?',t1:'Wochenlauf protokolliert sich nicht',
      t2:'wir wissen nicht, ob er lief — den Schlüssel schreibt niemand',
      go:'offen',f:_AB.grau,ziel:null});
  jobs.sort(function(a,b){ return a.p-b.p || ((Number(b.n)||0)-(Number(a.n)||0)); });
  return jobs;
}

/* 🔴 OHNE AUFRUFER seit 20.08.2026, Work #121 — bewusst stehengelassen, nicht
   geloescht (§3.7, P9). Die Detailliste „Alle offenen Punkte" zeigte dieselben
   sechs Zufluesse wie die Kachel „Eingang"; seit die Kachel echte Drilllisten
   oeffnet, ist diese hier die zweite Anzeige derselben Sache.
   NICHT VERWECHSELN: _abJobsListe (die Daten) lebt weiter — die freie Kachel
   vom Typ „liste" liest sie. Tot ist nur dieses Markup. */
function _abJobs(np,A){
  var jobs=_abJobsListe(np,A);
  if(!jobs.length) return '<div class="abpad" style="color:'+_AB.gut+';font-weight:700;font-size:13px">'
    +'Nichts offen. Alle Zuflüsse leer, alle Wächter still.</div>';
  return jobs.map(function(j){
    return '<div class="abjob" data-ziel="'+(j.ziel||'')+'">'
      +'<span class="sv" style="background:'+j.f+'"></span>'
      +'<span class="nm" style="color:'+j.f+'">'+j.n+'</span>'
      +'<span class="tx"><span class="t1">'+esc(j.t1)+'</span>'
      +'<div class="t2">'+esc(j.t2)+'</div></span>'
      +'<span class="go">'+esc(j.go)+'</span></div>';
  }).join('')+'<div class="abfoot">'+jobs.length+' Punkte · abgeleitet aus Wächtern und Zuflüssen — '
    +'nichts von Hand gepflegt, kann also nicht veralten.</div>';
}

/* ---------------------------------------------------------------------------
   🔴 15.08.2026, Ralph-Auftrag: HIER STAND DER FLUSS (_abFluss, 60 Zeilen).
   Ein SVG-Diagramm Zufluss → Prüfung → Live, mit Strichdicke nach Menge,
   laufenden Punkten und rotem Riegel bei Zuflüssen ohne Abnehmer.

   ERSATZLOS ENTFERNT, nicht auskommentiert und nicht hinter if(false) gelegt —
   sonst wäre es totes Werkzeug wie ladeStammPanel und ladeNutzungPanel, die
   beide monatelang im Code standen und beim Suchen jedes Mal Zeit gekostet
   haben. Rücksprungpunkt mit dem vollständigen Code:
   webseite/_sicherungen/2026-08-15-work22-hauptnav/app.js

   WAS DABEI NICHT VERLORENGEGANGEN IST, vor dem Löschen einzeln geprüft:
   · die Zahlen — np.zufluesse wird weiter von _abAbl, _abJobsListe und dem
     Graph gelesen. Nur die Zeichnung ist weg, nicht die Quelle.
   · die Aussage „Zufluss ohne Abnehmer" — sie steht im Hero als eigene Zahl
     und in der Kachel „Heute — offene Aufgaben" als eigene Zeile.
   · der Drilldown — die Hero-Zahlen sprangen ohnehin nach #abDetail
     („Alle offenen Punkte"), nie in den Fluss (Ralph P12 eingehalten).
   · _abZf (Farbe je Zufluss) bleibt stehen, der Graph benutzt sie.
   --------------------------------------------------------------------------- */
/* 🔴 OHNE AUFRUFER seit 20.08.2026, Work #121 — stehengelassen, nicht geloescht.
   Der „Herzschlag" zeigte dieselben drei Takte, die jetzt in der Kachel
   „Betrieb & Schnellzugriff" stehen (gemessen: cb_netzplan liefert 3,
   cockpit.karten.schnell.takte liefert dieselben 3). */
function _abTakte(np){
  var t=(np&&np.takte)||[], s='';
  t.forEach(function(x,i){
    var ser=Number(x.fehler_serie)||0, m=(x.minuten_her==null?null:Number(x.minuten_her));
    var f=ser>0?_AB.krit:_AB.gut;
    s+='<div class="abkv"><span><span class="abdot" style="background:'+f+';margin-right:7px"></span>'
      +esc(x.takt)+'</span><b style="color:'+f+'">'
      +(ser>0?'scheitert '+ser+'×':(m==null?'—':(m<1?'gerade eben':'vor '+m+' Min')))+'</b></div>';
  });
  if(!t.length) s+='<div class="abkv"><span>Takte</span><b style="color:'+_AB.grau
    +'">noch nicht protokolliert</b></div>';
  var pr=(np&&np.wochenlauf&&np.wochenlauf.protokolliert)===true;
  s+='<div class="abkv"><span><span class="abdot" style="background:'+(pr?_AB.gut:_AB.grau)
    +';margin-right:7px"></span>Wochenlauf</span><b style="color:'+(pr?_AB.gut:_AB.grau)+'">'
    +(pr?esc(String(np.wochenlauf.wert)):'nicht protokolliert')+'</b></div>'
    +'<div style="font-size:11px;color:'+_AB.mut+';margin-top:7px">Grau heißt: wir wissen es nicht — '
    +'nicht: es ist in Ordnung.</div>';
  return s;
}
function _abQuellen(np){
  var q=(np&&np.bestand)||[]; if(!q.length) return '<div style="font-size:12px;color:'+_AB.mut+'">keine Angabe</div>';
  var max=Math.max.apply(null,q.map(function(x){return Number(x.anzahl)||0;}))||1;
  return q.map(function(x){
    return '<div style="font-size:12px;margin-bottom:7px"><div style="display:flex;justify-content:space-between">'
      +'<span>'+esc(x.typ)+'</span><b style="font-variant-numeric:tabular-nums">'+x.anzahl+'</b></div>'
      +'<div class="abbar"><i style="width:'+((Number(x.anzahl)||0)/max*100)+'%;background:'+_AB.kern
      +';opacity:.75"></i></div></div>';
  }).join('');
}

/* ============================================================================
   HERO + BENTO-REIHE 1  ·  Dashboard Variante B, Durchgang 2  ·  15.08.2026
   ----------------------------------------------------------------------------
   §22 zuerst geprueft: NICHTS hiervon ist neu erhoben. Alle Zahlen kommen aus
   _abAbl(np) — derselben Ableitung, die die alte KPI-Reihe benutzte. Die
   Aufgabenliste ist _abJobs, der Ring ist _abRing; beide bleiben unveraendert
   und werden nur anders eingerahmt. Es gibt keine zweite Rechnung (§4.2).

   🔴 KEINE MOCKUP-ZAHLEN. Ralphs Auftragstext nannte „System gesund · 248
   Aufgaben · 4 kritische Bereiche". 248 stimmt und ist die Summe der wartenden
   Zuflüsse (gemessen 15.08.: 19+85+47+21+51+25). „4 kritische Bereiche" liess
   sich NICHT belegen — gemessen sind 6 offene Gate-Waechter und 2 Zufluesse
   ohne Abnehmer. Es wird deshalb benannt, was gemessen ist, statt eine Zahl
   nachzustellen, die zufaellig zum Mockup passt (§1.1).
   ========================================================================== */
/* ============================================================================
   COCKPIT v2  ·  Work #121  ·  20.08.2026
   ----------------------------------------------------------------------------
   EINE Quelle fuer die sichtbaren Standardzahlen: cb_admin_dashboard_cockpit_v2.
   Vorher erhob jede Kachel ihre Zahl selbst aus cb_dashboard und cb_netzplan —
   dieselbe Frage an mehreren Orten (§4.2). ChatGPT hat den Vertrag am 18.08.
   gebaut; angeschlossen war er nie. Gemessen 20.08. mit grep in app.js:
   0 Aufrufer. Wieder §22 — nicht gebaut, nur nicht verbunden.

   🔴 ER LAEDT NACH, NICHT VORHER. Gemessen 20.08. mit EXPLAIN (ANALYZE):
   3.806 ms kalt, 2.915 ms warm. Eine Kachel, die den Seitenaufbau drei
   Sekunden blockiert, waere ein Rueckschritt — derselbe Fall wie
   cb_admin_stamm_waechter mit 4,9 s in Work #17.

   🔴 SOLANGE NICHTS DA IST, STEHT „laedt" DA — keine alte Zahl aus einer
   zweiten Quelle als Platzhalter. Genau das waere die Doppelung, die dieser
   Umbau beseitigt.
   ========================================================================== */
var _AB_CK=null, _AB_CK_FEHLER=null, _AB_CK_LAEUFT=false;

/* Rangfolge der Dringlichkeit. Steht an EINER Stelle, damit Farbe, Satz und
   Reihenfolge nicht auseinanderlaufen koennen. */
var _AB_CK_RANG={kritisch:0, warnung:1, aktion:2, hinweis:3};
var _AB_CK_FARBE={kritisch:'#ff8a8a', warnung:'#ffcf6b', aktion:'#9ec9ff', hinweis:'#b7f0c8'};
var _AB_CK_ZUST={kritisch:'Eingriff nötig', warnung:'Läuft, mit Auffälligkeiten',
                 aktion:'Wartet auf dich', hinweis:'Läuft'};

function _abCkAttention(){
  var a=(_AB_CK&&_AB_CK.hero&&_AB_CK.hero.attention)||[];
  return a.slice().sort(function(x,y){
    var rx=_AB_CK_RANG[x&&x.severity], ry=_AB_CK_RANG[y&&y.severity];
    if(rx==null) rx=9; if(ry==null) ry=9;
    return (rx-ry)||((Number(y&&y.count)||0)-(Number(x&&x.count)||0));
  });
}

/* Alle drill_keys, die im gelieferten Cockpit-Objekt WIRKLICH vorkommen —
   eingesammelt, nicht abgeschrieben. Ein Schluessel, den der Server nicht
   nennt, bekommt keinen Knopf. */
function _abCkDrillSet(){
  var s={};
  (function geh(o){
    if(!o||typeof o!=='object') return;
    if(Array.isArray(o)){ o.forEach(geh); return; }
    Object.keys(o).forEach(function(k){
      var v=o[k];
      if(k==='drill_key' && typeof v==='string' && v) s[v]=1;
      else if(k==='drills' && v && typeof v==='object'){
        Object.keys(v).forEach(function(dk){ if(typeof v[dk]==='string' && v[dk]) s[v[dk]]=1; });
      }
      else geh(v);
    });
  })(_AB_CK);
  return s;
}
function _abCkDrillBekannt(k){
  if(!k || !_AB_CK) return false;
  return _abCkDrillSet()[k]===1;
}

async function _abCockpitHolen(neu){
  if(_AB_CK_LAEUFT) return;
  if(_AB_CK && !neu) return;
  _AB_CK_LAEUFT=true; _AB_CK_FEHLER=null;
  try{
    var r=await client.rpc('cb_admin_dashboard_cockpit_v2');
    if(r&&r.error) throw r.error;
    var o=r&&r.data; if(typeof o==='string') o=JSON.parse(o);
    if(!o) throw new Error('cb_admin_dashboard_cockpit_v2 hat nichts geliefert');
    if(o.ok===false) throw new Error(o.grund||'abgelehnt');
    _AB_CK=o;
  }catch(e){
    /* Kein leerer Fangblock (§11.4): der Grund steht in der Oberflaeche UND
       in der Konsole. Ein Dashboard, das schweigend leer bleibt, ist der
       Fehlertyp, den dieses Projekt am haeufigsten hatte. */
    _AB_CK=null; _AB_CK_FEHLER=(e&&e.message)||String(e);
    try{ console.error('[Cockpit v2]',e); }catch(_){}
  }
  _AB_CK_LAEUFT=false;
  try{ _abHeroFuellen(); }catch(e){ try{ console.warn('[Cockpit v2] Hero:',e); }catch(_){} }
  try{ _abNeuZeichnen(); }catch(e){ try{ console.warn('[Cockpit v2] Kacheln:',e); }catch(_){} }
}

/* Der Zustandssatz links im Hero. Er kommt aus DENSELBEN attention-Punkten wie
   die Zahlen rechts — vorher stand hier A.gate_offen aus cb_netzplan, waehrend
   das Cockpit gate_faelle fuehrt. Zwei Zahlen fuer dieselbe Frage; gemessen
   20.08.: 248 gegen 242. */
function _abHeroZustHtml(){
  var farbe, zust, warum;
  if(_AB_CK_FEHLER){
    farbe='#ff8a8a'; zust='Lage unbekannt';
    warum='cb_admin_dashboard_cockpit_v2 antwortet nicht: '+_AB_CK_FEHLER;
  } else if(!_AB_CK){
    farbe='#c9d2dd'; zust='Lage wird geladen';
    warum='cb_admin_dashboard_cockpit_v2 braucht rund drei Sekunden — die Seite wartet nicht darauf';
  } else {
    var a=_abCkAttention();
    if(!a.length){
      farbe='#7ee2a2'; zust='Ruhig';
      warum='Nichts verlangt gerade dein Eingreifen.';
    } else {
      var top=a[0];
      farbe=_AB_CK_FARBE[top.severity]||'#c9d2dd';
      zust=_AB_CK_ZUST[top.severity]||'Auffällig';
      warum=String(top.text||top.titel||'');
      if(a.length>1) warum+=' · und '+(a.length-1)+' weitere';
    }
  }
  return '<div class="hzust"><span class="hpunkt" style="background:'+farbe+'"></span>'+esc(zust)+'</div>'
    +'<div style="font-size:11.5px;opacity:.85;margin-top:3px">'+esc(warum)+'</div>';
}

/* Die Zahlen rechts im Hero: AUSSCHLIESSLICH hero.attention (§121, Kriterium 3).
   Die drei alten Zahlen (Vorgaenge warten · ohne Abnehmer · Waechter melden)
   sind ERSETZT, nicht ergaenzt — sie stehen weiterhin in den Kacheln „Eingang"
   und „Qualitaet" und muessen nicht zweimal auf dieselbe Seite (Kriterium 8). */
function _abHeroZahlenHtml(){
  if(_AB_CK_FEHLER) return '<div class="hz"><b>–</b><span>keine Lagemeldung</span></div>';
  if(!_AB_CK) return '<div class="hz"><b>…</b><span>lädt</span></div>';
  var a=_abCkAttention();
  /* 🔴 26.08.2026, Ralph: „die doppelungen oben weg."
     GEMESSEN: alle vier Zahlen der roten Leiste standen weiter unten nochmal —
     31 Foto-Eingänge in „Eingang", 1991 Gate-Fälle in „Qualität", 33 RIKI-Fehler
     in „RIKI", 7 Entscheidungen in „Arbeit". Man liest jede wichtige Zahl zweimal
     und weiß nicht, welche gilt.
     Hier fliegen die beiden raus, die IDENTISCH in einer Kachel danebenstehen.
     „Entscheidungen warten auf dich" BLEIBT: die Arbeitskachel ist am selben Tag
     entfernt worden, die Leiste ist jetzt der einzige Ort dafür. Der Serververtrag
     bleibt unverändert — das ist eine Anzeigeentscheidung, keine zweite Wahrheit. */
  var _doppelt={qualitaetsgate:1, riki_fehler:1};
  a=a.filter(function(x){ return !_doppelt[String(x&&x.id||'')]; });
  if(!a.length) return '<div class="hz"><b>0</b><span>offene Punkte</span></div>';
  return a.slice(0,4).map(function(x){
    var f=_AB_CK_FARBE[x.severity]||'#c9d2dd';
    /* 🔴 POSITIVLISTE, KEINE AUSSCHLUSSLISTE (§3.3). Ein action_key ist NICHT
       automatisch ein drill_key. Gemessen 20.08. gegen alle 22 Schluessel:
       20 liefern eine Liste, `qualitaet` und `eingang` antworten mit
       „Unbekannter Dashboard-Drill". Ein erster Entwurf schloss nur `eingang`
       aus — `qualitaet` haette ein Fehlerfenster geoeffnet, also genau den
       toten Knopf, den Kriterium 4 verbietet.
       Die Liste wird nicht von Hand gefuehrt: sie ergibt sich aus den
       drill_keys, die im Cockpit-Objekt selbst stehen (§28.4). */
    var key=_abCkDrillBekannt(x.action_key)?x.action_key:'';
    return '<div class="hz'+(key?' klick':'')+'"'
      +(key?' data-drill="'+esc(key)+'" data-drill-titel="'+esc(String(x.titel||''))+'"':'')
      +'><b style="color:'+f+'">'+esc(String(x.count==null?'–':x.count))+'</b>'
      +'<span title="'+esc(String(x.text||''))+'">'+esc(String(x.titel||x.id||''))+'</span></div>';
  }).join('');
}

/* Beide Haelften nachtragen, ohne den Hero neu zu bauen: in der rechten Spalte
   haengen Anordnen, Dunkel, Umschalter und Aktualisieren. Wer den ganzen Hero
   ersetzt, wirft deren Verdrahtung weg — und merkt es erst, wenn ein Knopf
   nichts mehr tut. */
function _abHeroFuellen(){
  var z=document.getElementById('abHeroZust');
  if(z) z.innerHTML=_abHeroZustHtml();
  var n=document.getElementById('abHeroZahlen');
  if(n){
    n.innerHTML=_abHeroZahlenHtml();
    /* 🔴 Der Hero liegt AUSSERHALB von #abBentoBox — _abNeuZeichnen und damit
       _abBentoNach fassen ihn nicht an. Wer das uebersieht, baut anklickbare
       Zahlen, die auf nichts hoeren. Deshalb hier, direkt am Container. */
    n.querySelectorAll('[data-drill]').forEach(function(x){
      x.addEventListener('click',function(){
        if(_AB_EDIT) return;
        _abDrillOeffnen(x.getAttribute('data-drill'), x.getAttribute('data-drill-titel')||'');
      });
    });
  }
}

/* ============================================================================
   HERO  ·  Work #121, Stufe 2  ·  20.08.2026
   ----------------------------------------------------------------------------
   Der Hero traegt jetzt genau eine Lage: die aus cb_admin_dashboard_cockpit_v2.
   Die Parameter d, np und A werden nicht mehr fuer Zahlen benutzt — sie bleiben
   in der Signatur, weil dashArbeitHtml und der Anordnen-Modus sie uebergeben
   und eine Signaturaenderung an dieser Stelle nichts verbessert (§11.3).
   ========================================================================== */
function _abHero(d,np,A,ans){
  /* 🔴 06.09.2026, Ralph: "kopf weg." Die Lageleiste mit Zustand und den vier
     Zahlen ist raus. Sie war die dritte Stelle, an der dieselben Zahlen standen -
     nach den Kacheln und der Steuerung. Was bleibt, ist die Knopfleiste rechts.
     _abHeroZustHtml und _abHeroZahlenHtml bleiben unangetastet stehen, samt
     ihrer Auffrischung in Zeile 1326/1329: sie schreiben in Elemente, die es
     jetzt nicht gibt, und das faengt der Aufrufer bereits ab (if(z), if(n)).
     Kein Serververtrag geaendert - eine reine Anzeigeentscheidung. */
  return '<div class="abhero">'
    +'<div class="hr"><span id="abStand"></span>'
      +'<button class="hbtn" id="abAnordnen" type="button" '
        +'title="Kacheln anordnen, ein-/ausblenden, Breite umschalten">🧩 Anordnen</button>'
      +'<button class="hbtn" id="abDunkel" type="button" '
        +'title="Helle oder dunkle Darstellung">🌙 Dunkel</button>'
      +'<button class="hbtn" id="abNeu">↻ Aktualisieren</button></div>'
  +'</div>';
}

/* Kachelrahmen. Eine Stelle, damit die vier Kacheln nicht viermal leicht
   unterschiedlich aussehen. */
function _abKachel(titel, tag, inhalt, fuss, gross, zus){
  zus=zus||{};
  /* Foto und Schleier liegen UNTER dem Inhalt. Zwei getrennte Ebenen, damit
     der Verlauf unabhaengig vom Bild eingestellt werden kann — beim ersten
     Versuch steckte beides in einer, und jede Aenderung am Verlauf hat das
     Bild mitverschoben. */
  var _foto = zus.foto
    ? '<div class="bfoto" style="background-image:url(bg-'+zus.foto+'.jpg)"></div>'
      +'<div class="bschleier"></div>'
    : '';
  var _leds = zus.leds
    ? '<span class="bleds">'+String(zus.leds).split(' ').map(function(f){
        return '<i class="'+f+'"></i>'; }).join('')+'</span>'
    : '';
  return '<div class="bk'+(gross?' bgross':'')+(zus.klasse||'')+'"'+(zus.attr||'')
    +(zus.stil?' style="'+zus.stil+'"':'')+'>'
    +_foto
    +(zus.vor||'')
    +'<div class="bkopf"><h3>'+titel+'</h3>'+(tag||'')+_leds+'</div>'
    +inhalt
    +(fuss?'<div class="bfuss">'+fuss+'</div>':'')
  +'</div>';
}

/* ============================================================================
   DRILL — jede Zahl wird eine Arbeitsliste  ·  Work #121, Stufe 4  ·  20.08.2026
   ----------------------------------------------------------------------------
   Ralphs Satz zum Auftrag: „Jede auffaellige Zahl muss in eine echte
   Arbeitsliste fuehren." Die Liste kommt von
   cb_admin_dashboard_cockpit_drill(p_key, p_limit) — SERVERSEITIG, in einem
   Vertrag mit festen Feldern: kind · id · title · info · age_days.

   🔴 KEIN TOTER KNOPF (Kriterium 4). Ein Sprung entsteht nur, wenn es fuer
   `kind` einen VORHANDENEN Weg gibt. Gibt es keinen, bleibt die Zeile eine
   Zeile — das ist ehrlich, ein Knopf, der nichts tut, waere es nicht.
   Gemessen 20.08.: fuer `work` gibt es im Frontend keine Queue-Ansicht; genau
   deshalb steht dort kein Knopf und die Serverliste selbst ist die Antwort.

   Das Panel liegt als Overlay ueber der Seite und benutzt Inline-Stile: so
   muss dashArbeitCss nicht angefasst werden, an dem parallel gearbeitet wird.
   ========================================================================== */
/* ============================================================================
   ARBEITSWEG "ZUTAT"  ·  Work #190, Ralph-Entscheid C=A  ·  22.08.2026
   ----------------------------------------------------------------------------
   VORHER fuehrte der Knopf auf zutStammEdit(id) -> RPC cb_zutat_stamm_get.
   Diese RPC ist serverseitig abgeschaltet; sie besteht aus einer Zeile und
   antwortet {ok:false, deprecated:true, grund:'Altstamm-Leseweg deaktiviert'}.
   zutStammEdit prueft ok:false NICHT, sondern rendert d.name||'' — der Dialog
   ging also mit LEEREM Namen und LEEREM Notenfeld auf, mit Speichern-Knopf
   darunter. Gemessen 22.08.: 981 Zeilen trugen diesen toten Knopf.

   DER WEG GEHT UEBER DEN NAMEN, NICHT UEBER DIE ID. Gemessen an den 677
   Regelfaellen mischt "Zutat_ID" drei Formen: ZG-… 550 · UUID 123 · ING… 4.
   Ein ID-Sprung traefe in 554 von 677 Faellen die falsche Welt. Der Name steht
   dagegen in jeder Zeile. Sobald ChatGPT in Work #194 entity_id und id_art
   mitliefert, kann hier ein echter ID-Sprung daneben treten — bis dahin waere
   er geraten (§1).

   KEIN NEUBAU (§22): geoeffnet wird die vorhandene Canonical-Stammliste
   (adminGo('stamm') -> fgTab -> fgStammPanelBauen -> fgStammListe ->
   cb_admin_stamm_neu_liste). Hier wird NUR navigiert und ein vorhandenes
   Suchfeld gefuellt. Kein Schreibweg, keine Bewertungslogik, nichts am Stamm
   geaendert (§7 — Zutaten und Bewertungen bleiben lesen ja, aendern nein).
   ========================================================================== */
function _abZutatImStammSuchen(name){
  var n=String(name==null?'':name).trim();
  if(!n) return false;
  if(typeof adminGo!=='function'){ try{ console.warn('[Stammweg] adminGo fehlt'); }catch(_){} return false; }
  try{ _abDrillZu(); }catch(e){}
  adminGo('stamm');                       /* fgTab('stamm') baut das Panel synchron */
  var feld=document.getElementById('fgStSuche');
  /* Kein Suchfeld heisst: das Panel ist nicht da. Dann lieber gar nichts tun,
     als Ralph auf einer Seite abzusetzen, die seine Zutat nicht zeigt. */
  if(!feld){ try{ console.warn('[Stammweg] fgStSuche nicht gefunden'); }catch(_){} return false; }
  feld.value=n;
  try{ if(window._fgStamm) window._fgStamm.offset=0; }catch(e){}
  /* Der Alt-Tab kennt weder Lifecycle- noch Notenfilter. Steht er noch, wird auf
     "Neuer Stamm" zurueckgeschaltet — fgStammTab laedt selbst nach. */
  if(window._fgStamm && window._fgStamm.tab!=='neu' && typeof fgStammTab==='function') fgStammTab('neu');
  if(typeof fgStammListe!=='function') return false;
  _abStammFilterDurchsetzen(n,0);
  return true;
}

/* 🔴 AN DER LIVE-ABNAHME GEFUNDEN, 22.08.2026, Build 4356 — ein Wettlauf.
   adminGo('stamm') baut ueber fgTab das Panel, und fgStammPanelBauen startet
   dabei SELBST einen Listenlauf: mit noch leerem Suchfeld. Mein gefilterter Lauf
   startete danach, war aber frueher fertig — der erste, ungefilterte Lauf kam
   zuletzt zurueck und ueberschrieb die Trefferliste.
   Gemessen am ausgelieferten Stand: Suchfeld stand auf "Säureregulator",
   die Liste zeigte "1–100 von 944". Also genau die Haelfte des Arbeitswegs.

   Ein Test, der _abZutatImStammSuchen EINZELN aufruft, kann das nicht finden:
   es ist kein Fehler in der Funktion, sondern in der Reihenfolge zweier
   Ladevorgaenge. Dieselbe Lehre wie am 15.08. — immer die Kette messen, nicht
   den Einzelaufruf.

   Behoben ohne zweiten Besitzer: es wird KEIN eigener Ladeweg gebaut. Es wird
   gewartet, bis kein Lauf mehr offen ist (fgStammListe setzt waehrenddessen
   .fgSwLad in die Tabelle), und dann genau einmal der vorhandene Weg gerufen. */
function _abStammFilterDurchsetzen(n,versuch){
  setTimeout(function(){
    var box=document.getElementById('fgStTabelle');
    /* Laeuft noch ein Ladevorgang? Dann warten — sonst ueberholt er uns wieder.
       Deckel bei 40 Versuchen (rund 4 s): lieber ungefiltert anzeigen als eine
       Schleife, die nie endet. */
    if(box && box.querySelector('.fgSwLad') && versuch<40){
      _abStammFilterDurchsetzen(n,versuch+1); return;
    }
    var feld=document.getElementById('fgStSuche'); if(!feld) return;
    feld.value=n;
    try{ if(window._fgStamm) window._fgStamm.offset=0; }catch(e){}
    try{ if(typeof fgStammListe==='function') fgStammListe(); }
    catch(e){ try{ console.warn('[Stammweg] Nachladen:',e); }catch(_){} }
  },100);
}
if(typeof window!=='undefined') window._abZutatImStammSuchen=_abZutatImStammSuchen;

/* Zeigt EINEN Work-Eintrag in der Arbeit-Kachel. Kein zweites Fenster und keine
   zweite Liste: die Kachel kann seit Work #199 filtern, also wird sie gefiltert.
   Findet die Kachel sich nicht auf der Seite, passiert nichts — lieber nichts als
   ein Sprung ins Leere (dieselbe Regel wie beim Stammweg). */
function _abWorkAnzeigen(id){
  var n=String(id==null?'':id).trim();
  if(!n) return false;
  try{ _abDrillZu(); }catch(e){}
  if(typeof adminGo==='function') adminGo('dash');
  var feld=document.getElementById('awfSuche');
  if(!feld){ try{ console.warn('[Arbeitsweg] Arbeit-Kachel nicht auf der Seite'); }catch(_){} return false; }
  _AB_WORK_FILTER={status:'',owner:'',bereich:'',prio:'',thema:'',suche:n};
  feld.value=n;
  _abWorkFuellen(false);
  try{ feld.scrollIntoView({block:'center'}); }catch(e){}
  return true;
}
if(typeof window!=='undefined') window._abWorkAnzeigen=_abWorkAnzeigen;

/* 🔴 DIESER KOMMENTAR STEHT BEWUSST AUSSERHALB DES OBJEKTS, 22.08.2026.
   test-work121-cockpit.js schneidet Variablenbloecke aus dem Modul und hoert
   nach 12 Zeilen auf zu suchen. Mein Kommentar IM Objekt hat es ueber diese
   Grenze geschoben — der Schnitt endete mitten im Text und der Test stuerzte
   mit "Invalid or unexpected token" ab. Zum zweiten Mal heute ein abgestuerzter
   statt roter Test, und ein abgestuerzter hat gar nichts geprueft.
   Merksatz: was zwischen `var X=` und dem abschliessenden `;` steht, bleibt kurz.

   Work #199 — zwei Wege, die es SCHON GAB und die nur nicht angeschlossen
   waren (§22). Gemessen am 22.08.:
     kontakt   21 offene Produktwuensche. Ansicht fgPanelKontakt mit
               cb_admin_kontakt_liste und cb_admin_kontakt_erledigt existiert
               seit Langem. Nichts neu gebaut. In adminnav.js fehlte nur
               'kontakt' in der Zielliste — adminGo lief in den else-Zweig und
               rief navTo('kontakt'), eine Seite, die es nicht gibt.
     work       7 Eintraege mit Entscheidungsbedarf. Seit heute zeigt die
               Arbeit-Kachel ALLE aktiven Works; der Drill springt dorthin und
               filtert auf die Nummer, statt eine zweite Liste aufzumachen.
     zutat     fuehrt in die Canonical-Stammliste, gefiltert auf den NAMEN
               (drei ID-Formen gemischt, siehe #190). Braucht r.name, das die
               Zeile ueber data-name mitliefert.

   OHNE WEG BLEIBEN: tagebuch_wunsch · riki · zusatzstoff. Sie bekommen keinen
   Knopf, sondern nur die Zeile — ein Knopf, der nichts oeffnet, ist schlimmer
   als eine Zahl ohne Knopf. Fuer zusatzstoff gibt es nur loadZusatzstoffeStamm
   (Listenladen), keinen Einzelweg; das waere ein Neubau und ist nicht geprueft.
   tagebuch_wunsch hat 51 offene Eintraege und serverseitig GAR KEINE RPC —
   als Work Item an ChatGPT gegeben. */
/* ============================================================================
   ARBEITSWEG "UNBEWERTETE ZUTAT"  ·  Work #194  ·  22.08.2026
   ----------------------------------------------------------------------------
   Das neue Gate w10 zaehlt 1.077 Produkte, deren Zutaten keine Note haben.
   ChatGPT liefert seit 12:37 je Zeile `entity_id` und `id_art` mit — genau die
   beiden Felder, auf die der Kommentar bei Work #190 gewartet hat.

   GEMESSEN 22.08. an allen 100 Drill-Zeilen, wieviele im Canonical-Stamm
   ueberhaupt auffindbar sind (cb_admin_stamm_neu_liste ueber den Namen):
     canonical  37 Zeilen ·  395 Produkte · 31 genau ein Treffer, 6 mehrdeutig, 0 leer
     legacy     63 Zeilen ·  979 Produkte ·  3 genau ein Treffer, 1 mehrdeutig, 59 LEER

   🔴 DESHALB BEKOMMT NUR `canonical` EINEN KNOPF. Bei den Legacy-Zeilen faende
   die Stammsuche in 59 von 63 Faellen NICHTS — sie stehen nicht im Canonical-
   Stamm, ihre Arbeit heisst "zuordnen oder anlegen", nicht "bewerten". Ein
   Knopf dorthin waere genau der tote Knopf, den Work #190 abgeschafft hat.
   Der fehlende Weg fuer die 63 Legacy-Zeilen ist als eigener Punkt gemeldet,
   nicht hier heimlich mit einer Attrappe zugedeckt.

   ⚠️ ENTITY_ID WIRD NICHT ZUM SPRINGEN BENUTZT. Gemessen: cb_admin_stamm_neu_liste
   sucht NICHT ueber die entity_id — eine UUID im Suchfeld liefert 0 Treffer,
   derselbe Name 1. `id_art` entscheidet also, OB ein Knopf erscheint; gesprungen
   wird weiterhin ueber den Namen (§22, kein Nachbau eines Lesewegs).

   KEIN NEUBAU: geoeffnet wird die vorhandene Stammliste; zusaetzlich wird der
   vorhandene Bewertungsfilter `fgStBew` auf "ohne Note" gestellt, damit Ralph
   direkt auf den unbewerteten Eintraegen landet. Kein Schreibweg, keine
   Bewertungslogik (§7 — Zutaten und Bewertungen: lesen ja, aendern nein).
   ========================================================================== */
function _abZutatUnbewertetOeffnen(r){
  var name=r&&(r.name||r.title||'');
  if(!name){ try{ console.warn('[Unbewertet] Zeile ohne Namen, kein Sprung'); }catch(_){} return false; }
  var ok=_abZutatImStammSuchen(name);
  if(!ok) return false;
  /* Der Bewertungsfilter wird NACH dem Panelbau gesetzt: fgStammPanelBauen legt
     das Select erst an. Derselbe Nachlauf-Deckel wie beim Suchfeld. */
  _abBewFilterOhneDurchsetzen(0);
  return true;
}
function _abBewFilterOhneDurchsetzen(versuch){
  setTimeout(function(){
    var bw=document.getElementById('fgStBew');
    if(!bw){
      if(versuch<40) _abBewFilterOhneDurchsetzen(versuch+1);
      else { try{ console.warn('[Unbewertet] fgStBew nicht gefunden'); }catch(_){} }
      return;
    }
    if(bw.value==='ohne') return;         /* steht schon richtig, nicht doppelt laden */
    bw.value='ohne';
    try{ if(window._fgStamm) window._fgStamm.offset=0; }catch(e){}
    try{ if(typeof fgStammListe==='function') fgStammListe(); }
    catch(e){ try{ console.warn('[Unbewertet] Nachladen:',e); }catch(_){} }
  },160);
}

/* Zusatzbedingung je Zeile: reicht `kind` nicht aus, um einen Knopf zu
   rechtfertigen, steht hier die Pruefung. Fehlt ein Eintrag, gilt allein `kind`
   — das bisherige Verhalten bleibt damit unveraendert. */
var _AB_DRILL_WENN={
  zutat_unbewertet: function(x){ return !!x && x.id_art==='canonical'; }
};

var _AB_DRILL_ZIEL={
  zutat_unbewertet: _abZutatUnbewertetOeffnen,
  produkt: function(r){ if(typeof openFgEditor==='function'){ _abDrillZu(); openFgEditor(r.id); } },
  stamm:   function(){ if(typeof adminGo==='function'){ _abDrillZu(); adminGo('stamm'); } },
  scan:    function(){ if(typeof scanEingangOeffnen==='function'){ _abDrillZu(); scanEingangOeffnen(); } },
  scan_cache: function(){ if(typeof scanEingangOeffnen==='function'){ _abDrillZu(); scanEingangOeffnen(); } },
  zutat:   function(r){ _abZutatImStammSuchen(r&&(r.name||r.id)); },
  kontakt: function(){ if(typeof adminGo==='function'){ _abDrillZu(); adminGo('kontakt'); } },
  work:    function(r){ _abWorkAnzeigen(r&&r.id); }
};

/* ----------------------------------------------------------------------------
   ZEILEN-AKTIONEN IM DRILL  ·  Work #208  ·  22.08.2026
   ----------------------------------------------------------------------------
   Bis heute konnte eine Drill-Zeile nur EINES: irgendwohin springen
   (_AB_DRILL_ZIEL). Fuer die 51 Tagebuchwuensche gibt es aber gar kein
   "irgendwohin" — es gibt keine Wunsch-Ansicht und es soll auch keine geben.
   Was fehlte, war nicht eine Seite, sondern zwei Knoepfe: abhaken oder
   ablehnen, direkt in der Zeile.

   Deshalb ein zweites Register statt einer zweiten Liste (§4.2). Ein Eintrag:
     kind -> [ {text, rpc, grund:true|false, frage} ]
   Es wird genau die RPC gerufen, die ChatGPT unter #208 gebaut hat — hier
   entsteht keine zweite Fachlogik, nur der Knopf davor. Ob ein Wunsch ein
   Produkt anlegen DARF, entscheidet weiterhin der Server, nicht diese Datei.

   🔴 Kein Weg "Wunsch -> Produkt anlegen". Der waere fachlich (§7) und ist
   nicht freigegeben. Abhaken und Ablehnen raeumen die Schlange, mehr nicht.
   ---------------------------------------------------------------------------- */
var _AB_DRILL_AKTION={
  tagebuch_wunsch:[
    {text:'angelegt ✓', rpc:'cb_admin_wunsch_erledigt', grund:false},
    {text:'abgelehnt ✕', rpc:'cb_admin_wunsch_ablehnen', grund:true,
     frage:'Warum abgelehnt? (Dublette, Unsinn, kein Lebensmittel …)'}
  ]
};

/* Ruft die RPC einer Zeilen-Aktion und meldet ehrlich zurueck. Kein
   optimistisches Ausblenden: die Zeile verschwindet erst, wenn der Server
   ok:true gesagt hat. Eine Zeile, die verschwindet, obwohl nichts gespeichert
   wurde, ist schlimmer als eine, die stehen bleibt. */
async function _abDrillAktion(btn){
  var a=(_AB_DRILL_AKTION[btn.dataset.kind]||[])[Number(btn.dataset.akt)];
  if(!a) return;
  var arg={p_id:Number(btn.dataset.id)};
  if(a.grund){
    var g=window.prompt(a.frage||'Grund?','');
    if(g===null) return;                 /* abgebrochen: nichts tun */
    if(!String(g).trim()){ alert('Ohne Grund wird nicht abgelehnt.'); return; }
    arg.p_grund=String(g).trim();
  }
  var alt=btn.textContent;
  btn.disabled=true; btn.textContent='…';
  try{
    var r=await client.rpc(a.rpc,arg);
    if(r&&r.error) throw r.error;
    var o=r&&r.data; if(typeof o==='string') o=JSON.parse(o);
    if(o&&o.ok===false) throw new Error(o.grund||'abgelehnt');
    var z=btn.closest('div[data-drillzeile]'); if(z) z.remove();
    /* Die Zahl in der Kachel wird NICHT nachgerechnet. _abNeuZeichnen malt nur
       die zwischengespeicherten Daten neu — die Kachel zeigte danach dieselbe
       alte Zahl und saehe aus, als waere sie frisch. Lieber ehrlich sagen,
       dass sie erst beim naechsten Laden stimmt. */
    var hin=document.getElementById('abDrillHinweis');
    if(hin){ hin.style.display=''; }
  }catch(e){
    btn.disabled=false; btn.textContent=alt;
    alert('Nicht gespeichert: '+((e&&e.message)||String(e)));
    try{ console.error('[Drill-Aktion] '+a.rpc,e); }catch(_){}
  }
}

function _abDrillBox(){
  var b=document.getElementById('abDrillBox');
  if(b) return b;
  b=document.createElement('div');
  b.id='abDrillBox';
  b.style.cssText='position:fixed;inset:0;z-index:9000;display:none;'
    +'background:rgba(15,23,32,.42);backdrop-filter:blur(2px)';
  b.addEventListener('click',function(e){ if(e.target===b) _abDrillZu(); });
  document.body.appendChild(b);
  return b;
}
function _abDrillZu(){
  var b=document.getElementById('abDrillBox'); if(b) b.style.display='none';
}
if(typeof window!=='undefined') window._abDrillZu=_abDrillZu;

function _abDrillRahmen(titel,inhalt){
  return '<div style="position:absolute;right:0;top:0;bottom:0;width:min(560px,92vw);'
    +'background:var(--card,#fff);color:var(--ink,#1b2733);box-shadow:-8px 0 28px rgba(0,0,0,.22);'
    +'display:flex;flex-direction:column">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:13px 16px;'
      +'border-bottom:1px solid var(--line,#dbe3ea);flex:0 0 auto">'
      +'<b style="font-size:14px">'+esc(titel)+'</b>'
      +'<button type="button" onclick="_abDrillZu()" style="margin-left:auto;border:1px solid '
        +'var(--line,#dbe3ea);border-radius:8px;background:var(--bg,#f4f6f8);color:inherit;'
        +'padding:5px 11px;font-size:12.5px;cursor:pointer">Schließen ✕</button>'
    +'</div>'
    +'<div style="flex:1 1 auto;overflow:auto;padding:10px 16px 18px">'+inhalt+'</div>'
  +'</div>';
}

async function _abDrillOeffnen(key,titel){
  if(!key) return;
  var b=_abDrillBox();
  b.style.display='block';
  b.innerHTML=_abDrillRahmen(titel||key,'<div class="blade">lädt…</div>');
  try{
    var r=await client.rpc('cb_admin_dashboard_cockpit_drill',{p_key:key,p_limit:50});
    if(r&&r.error) throw r.error;
    var o=r&&r.data; if(typeof o==='string') o=JSON.parse(o);
    if(!o) throw new Error('cb_admin_dashboard_cockpit_drill hat nichts geliefert');
    if(o.ok===false) throw new Error(o.grund||'abgelehnt');
    var rows=o.rows||[];
    var h=rows.length
      ? '<div style="font-size:11.5px;opacity:.7;margin-bottom:8px">'
          +rows.length+' von '+(o.count==null?rows.length:o.count)+' — Schlüssel '+esc(key)+'</div>'
        + rows.map(function(x,i){
            /* Work #194: `kind` sagt, WOHIN ein Sprung ginge. _AB_DRILL_WENN sagt,
               ob DIESE Zeile dort auch ankommt. Ohne Eintrag entscheidet wie bisher
               allein `kind`. */
            var wenn=_AB_DRILL_WENN[x.kind];
            var hatZiel=!!_AB_DRILL_ZIEL[x.kind] && (!wenn || wenn(x));
            var alt=(x.age_days==null)?'':(' · '+x.age_days+' Tage alt');
            return '<div style="display:flex;gap:9px;align-items:flex-start;padding:7px 0;'
              +'border-bottom:1px solid var(--line,#eef2f6)">'
              +'<span style="flex:0 0 auto;font-size:11px;opacity:.6;min-width:26px;'
                +'padding-top:2px">'+(i+1)+'</span>'
              +'<span style="flex:1 1 auto;min-width:0">'
                +'<div style="font-size:12.5px;font-weight:600;overflow-wrap:anywhere">'
                  +esc(String(x.title||x.id||''))+'</div>'
                +'<div style="font-size:11px;opacity:.7">'+esc(String(x.info||''))
                  +esc(alt)+' · '+esc(String(x.id||''))+'</div>'
              +'</span>'
              +(hatZiel
                ? '<button type="button" class="abdrillgo" data-kind="'+esc(String(x.kind))
                    +'" data-id="'+esc(String(x.id))
                    /* Work #190: der Zutatenweg sucht ueber den NAMEN, nicht ueber die
                       ID (drei ID-Formen gemischt). Deshalb reist der Titel mit. */
                    +'" data-name="'+esc(String(x.title||''))
                    /* Work #194: id_art reist mit, damit das Ziel weiss, aus welcher
                       Welt die Zeile kommt. */
                    +'" data-idart="'+esc(String(x.id_art||''))+'" style="flex:0 0 auto;border:1px solid '
                    +'var(--line,#dbe3ea);border-radius:8px;background:var(--bg,#f4f6f8);'
                    +'color:inherit;padding:4px 10px;font-size:12px;cursor:pointer">öffnen ›</button>'
                /* Work #194: kein Knopf ist ehrlich, aber stumm. Wo ein Weg
                   ABSICHTLICH fehlt, steht der Grund — sonst sieht es nach einem
                   vergessenen Knopf aus. Gemessen: 59 von 63 Legacy-Zeilen sind im
                   Canonical-Stamm gar nicht auffindbar. */
                : (_AB_DRILL_WENN[x.kind]
                    ? '<span style="flex:0 0 auto;font-size:11px;opacity:.55;'
                        +'padding:5px 2px;white-space:nowrap" title="Diese Zutat hat noch '
                        +'keinen Eintrag im Canonical-Stamm. Zuerst zuordnen oder anlegen, '
                        +'dann bewerten.">noch nicht im Stamm</span>'
                    : ''))
            +'</div>';
          }).join('')
      : '<div class="bleer">Diese Liste ist leer — die Zahl war 0 oder ist inzwischen abgearbeitet.</div>';
    b.innerHTML=_abDrillRahmen(titel||key,h);
    b.querySelectorAll('.abdrillgo').forEach(function(btn){
      btn.addEventListener('click',function(){
        var f=_AB_DRILL_ZIEL[btn.dataset.kind];
        if(f) f({id:btn.dataset.id, kind:btn.dataset.kind, name:btn.dataset.name||'',
                 id_art:btn.dataset.idart||''});
      });
    });
  }catch(e){
    b.innerHTML=_abDrillRahmen(titel||key,
      '<div class="bfehl"><b>Liste nicht ladbar.</b><br>'+esc((e&&e.message)||String(e))+'</div>');
    try{ console.error('[Drill] '+key,e); }catch(_){}
  }
}

/* ============================================================================
   KACHEL-REGISTER  ·  Work #42, Etappe 1  ·  15.08.2026
   ----------------------------------------------------------------------------
   Bis hierher stand die ANORDNUNG im Code: _abBento und _abBento2 riefen ihre
   Kacheln in fester Reihenfolge auf. Ab jetzt steht sie in EINER Liste, und der
   Code laeuft ueber die Liste. Das Verhalten ist unveraendert — genau das ist
   der Zweck: E1 ist die risikolose Etappe, die Ausgabe muss zeichengleich
   bleiben (Abnahme: Screenshot vorher/nachher identisch).

   §22 hat sich wieder ausgezahlt: _abKachel gab es bereits. Neu gebaut wurde
   nichts; zusammengefuehrt wurde nur der EINE Sonderweg, den _abBento2 mit
   seiner eigenen kleinen kachel()-Funktion noch hatte.

   Ein Eintrag: id · reihe · titel · breit · bau(c) -> {tag,inhalt,fuss}
   Alternativ roh(c) -> fertiges Markup, fuer Kacheln, die ihren Rahmen selbst
   mitbringen (Schnellzugriff). Etappe 2 legt eine Konfiguration darueber;
   liegt keine vor, gilt diese Liste als Rueckfall.
   ========================================================================== */
/* ============================================================================
   DER FLUSS  ·  Ralph-Auftrag 26.08.2026, Stufe 2 zu ZIEL.md  ·  Work #295
   ----------------------------------------------------------------------------
   Ralph: „ziel ist, das ich auf dem dashboard die aktivitaeten der agenten
   sehe, verstehe und steuern kann." Das ist Z1, Z2 und Z7 aus ZIEL.md.

   Diese Kachel beantwortet EINE Frage: wo steckt die Arbeit gerade fest?
   Nicht welche Aufgaben es gibt — dafuer flog die alte Arbeitskachel am
   26.08. mit 142 Zeilen raus. Eine Aufgabenliste ist kein Ueberblick.

   🔴 KEINE ZWEITE WAHRHEIT. Alle Zahlen kommen aus der Karte `aufgaben` von
   cb_admin_dashboard_cockpit_v2 — derselben Quelle, die „Deine Entscheidungen"
   schon benutzt. Hier wird nichts nachgerechnet und nichts hartkodiert.

   ⚠ ZWEI STATIONEN FEHLEN NOCH: `offen` und `verified` liefert die RPC nicht.
   Sie werden deshalb NICHT geschaetzt und NICHT im Browser nachgezaehlt,
   sondern als Luecke angezeigt. Nachtrag haengt an Work #297 (chatgpt).
   ========================================================================== */
function _abkFluss(c){
  var ck=_abCkKarte('aufgaben');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};

  var inArbeit = Number(ck.in_arbeit_alt_24h)||0;
  var wartet   = Number(ck.wartet_abnahme)||0;
  var beiRalph = Number(ck.bei_ralph)||0;
  var steht    = Number(ck.blockiert_oder_streit)||0;
  /* 🔴 26.08.2026, Work #297 erledigt: offen und verified kommen jetzt aus
     derselben Karte. Vorher standen hier zwei graue Fragezeichen — bewusst,
     weil eine im Browser nachgezaehlte Zahl neben Serverzahlen die zweite
     Wahrheit gewesen waere. Fehlt ein Feld trotzdem, bleibt das Fragezeichen:
     `null` heisst „nicht geliefert", 0 hiesse „es gibt keine". */
  var offen    = (ck.offen==null)    ? null : Number(ck.offen);
  var fertig   = (ck.verified==null) ? null : Number(ck.verified);
  /* Aus #296: 0 heisst, der Riegel ist zu. Steht hier je wieder eine Zahl,
     ist die Queue erneut verriegelt und der Stau hat wieder seine alte Ursache. */
  var gesperrt = Number(ck.nicht_aenderbar)||0;

  /* Eine Station: Zahl, Wort darunter, Farbe nach Dringlichkeit.
     `filter` macht sie zum Einstieg in die Arbeitstafel — Ralphs Z3, steuern.
     🔴 KEIN TOTER KNOPF: ohne `filter` bleibt die Station eine Anzeige. Die
     beiden Stationen, deren Zahl der Server noch nicht liefert, fuehren
     deshalb nirgendwo hin, statt eine leere Liste zu oeffnen. */
  function station(zahl, wort, farbe, titel, filter){
    var klick = filter
      ? ' onclick="arbeitstafelOeffnen(\''+filter+'\',\''+esc(wort)+'\')"'
        +' style="flex:1 1 0;min-width:0;text-align:center;cursor:pointer;border-radius:9px;'
        +'padding:4px 2px" onmouseover="this.style.background=\'rgba(0,0,0,.04)\'"'
        +' onmouseout="this.style.background=\'\'"'
      : ' style="flex:1 1 0;min-width:0;text-align:center;padding:4px 2px"';
    return '<div'+klick+' title="'+esc(titel)+'">'
      +'<div style="font-size:26px;font-weight:800;line-height:1;color:'+farbe+'">'+zahl+'</div>'
      +'<div class="bunter" style="margin-top:2px">'+wort+'</div></div>';
  }
  var pfeil='<div style="flex:0 0 14px;text-align:center;opacity:.3;font-size:15px">→</div>';

  var reihe='<div style="display:flex;align-items:flex-start;gap:2px;margin-top:4px">'
    + (offen==null
        ? station('?', 'offen', 'var(--matt,#8a97a4)', 'Diese Zahl liefert der Server nicht', null)
        : station(offen, 'offen', _AB.mut,
            'Angelegt, noch niemand dran - antippen oeffnet die Liste', 'open'))
    + pfeil
    + station(inArbeit, 'in Arbeit', inArbeit>0?_AB.warn:_AB.gut,
        'Laenger als 24 Stunden in Arbeit - antippen oeffnet die Liste', 'in_progress')
    + pfeil
    + station(wartet, 'wartet auf Abnahme', wartet>0?_AB.krit:_AB.gut,
        'Fertig gemeldet, noch nicht gegengeprueft - antippen oeffnet die Liste', 'ready_for_verification')
    + pfeil
    + (fertig==null
        ? station('?', 'fertig', 'var(--matt,#8a97a4)', 'Diese Zahl liefert der Server nicht', null)
        : station(fertig, 'fertig', _AB.gut,
            'Gegengeprueft und abgenommen - antippen oeffnet die Liste', 'verified'))
  +'</div>';

  /* Was den Fluss anhaelt. Nur zeigen, was tatsaechlich anliegt. */
  /* Beide Zeilen fuehren in die ARBEITSTAFEL, nicht in die Server-Drillliste:
     dort kann Ralph den Eintrag gleich aendern. Eine Liste, die nur zeigt,
     waere hier ein halber Weg. */
  var stopper='';
  if(beiRalph>0)
    stopper+='<div class="bzeile" style="cursor:pointer" '
      +'onclick="arbeitstafelOeffnen(\'decision_ralph\',\'Wartet auf deine Entscheidung\')">'
      +'<span style="font-size:11.5px">⛔ wartet auf deine Entscheidung</span>'
      +'<b style="font-size:11.5px;color:'+_AB.krit+'">'+beiRalph+'</b></div>';
  if(steht>0)
    stopper+='<div class="bzeile" style="cursor:pointer" '
      +'onclick="arbeitstafelOeffnen(\'blocked\',\'Hängt fest\')">'
      +'<span style="font-size:11.5px">blockiert oder strittig</span>'
      +'<b style="font-size:11.5px;color:'+_AB.warn+'">'+steht+'</b></div>';
  /* Diese Zeile soll NIE erscheinen. Tut sie es doch, ist der Riegel aus #296
     wieder da und kein Eintrag laesst sich mehr abhaken — die Ursache des
     Staus, nicht seine Folge. Deshalb steht sie oben und in Rot. */
  if(gesperrt>0)
    stopper='<div class="bzeile"><span style="font-size:11.5px;color:'+_AB.krit+'">'
      +'⛔ technisch nicht änderbar — Statusänderung schlägt fehl</span>'
      +'<b style="font-size:11.5px;color:'+_AB.krit+'">'+gesperrt+'</b></div>'+stopper;

  return {
    tag: wartet>0
      ? '<span class="abtag" style="background:#fdf1f1;color:'+_AB.krit+'">'+wartet+' stauen sich</span>'
      : '<span class="abtag" style="background:#effaef;color:'+_AB.gut+'">kein Stau</span>',
    inhalt:'<div class="bleib">'
      + reihe
      + (stopper?'<div style="margin-top:9px">'+stopper+'</div>':'')
      + (wartet===0&&beiRalph===0?'<div class="bleer" style="margin-top:8px">Nichts staut sich.</div>':'')
    +'</div>',
    fuss:'Eine Station antippen öffnet die Arbeitstafel — dort lässt sich ändern, '
        +'zuweisen und abnehmen. Wozu das dient, steht in ZIEL.md (Z1, Z2, Z3, Z7).'
  };
}

/* ############################################################################
   KANBAN „AUFGABEN"  ·  Ralph-Auftrag 26.08.2026  ·  Work #295 Stufe 3b
   ############################################################################
   Ralph: „die darstellung am dashboard ist schlecht, das sollte eher wie ein
   kanbanboard aufgebaut sein mit aufgabenstränge, wie z.b. das erfassen. und
   nicht als popup sondern anders und schön."

   DREI ENTSCHEIDUNGEN, JEDE MIT GRUND:

   1. KEINE UEBERLAGERUNG. Das Board ist eine dritte ANSICHT neben Arbeitsflaeche
      und Architektur — derselbe Umschalter, dieselbe Bauart wie arHtml/arRender.
      Ein Fenster, das ueber der Seite liegt, kann man nicht nebenbei offen
      lassen; eine Ansicht schon.

   2. EIN STRANG JE THEMA (Ralphs „aufgabenstränge"). Die Themen kommen aus
      `area` — den neun aus E13. Die Liste steht NICHT im Code, sie wird aus den
      Daten gebaut. Ein zehntes Thema erscheint von allein.

   3. VIER SPALTEN, UND „FERTIG" IST NICHT DABEI. Offen · In Arbeit · Wartet auf
      Abnahme · Klemmt. Eine Spalte mit 88 abgenommenen Eintraegen waere ein
      Archiv, kein Arbeitsbrett. Die vierte Spalte sammelt, was ohne Ralph
      liegenbleibt: decision_ralph, blocked, disputed.

   🔴 KEINE ZWEITE WAHRHEIT: Daten aus _abWorkLaden (cb_admin_agent_work_kurzliste),
   Aendern ueber _abWorkPanel und _abWorkSpeichern — dieselben Wege wie die Tafel.
   Der Behaelter heisst awBody, damit _abWorkSpeichern sein Panel unveraendert
   findet. Hier wird nichts nachgerechnet und nichts neu erfunden.
   ############################################################################ */
var _KB_SPALTEN=[
  {id:'open',    wort:'Offen',              status:['open'],                                  farbe:'#7b8794'},
  {id:'arbeit',  wort:'In Arbeit',          status:['in_progress'],                           farbe:'#2f6fb5'},
  {id:'abnahme', wort:'Wartet auf Abnahme', status:['ready_for_verification'],                farbe:'#c88616'},
  {id:'klemmt',  wort:'Klemmt',             status:['decision_ralph','blocked','disputed'],   farbe:'#cf5442'}
];
var _KB_ZU={};          /* eingeklappte Straenge, Kennung -> true */
try{ _KB_ZU=JSON.parse(localStorage.getItem('ri_kb_zu')||'{}')||{}; }catch(e){ _KB_ZU={}; }
var _KB_THEMA='';       /* leer = alle Straenge */
var _KB_SUCHE='';

function _kbMerken(){
  try{ localStorage.setItem('ri_kb_zu', JSON.stringify(_KB_ZU)); }
  catch(e){ try{ console.warn('Kanban: Klappzustand nicht speicherbar:',e); }catch(_){} }
}
function _kbTitel(t){ return String(t||'—').replace(/-/g,' '); }

/* Alter in Tagen — dieselbe Rechnung wie _abWorkAlter, nur kuerzer dargestellt. */
function _kbAlter(iso){
  if(!iso) return '';
  try{
    var d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);
    return d<=0 ? 'heute' : (d===1 ? 'gestern' : d+' T');
  }catch(e){ return ''; }
}

/* Eine Karte. Kurz genug, dass eine Spalte mehrere zeigt, lang genug, dass man
   erkennt, worum es geht. Klick klappt das vorhandene Aenderungs-Panel auf. */
function _kbKarte(w){
  var p=Number(w.priority)||0;
  var pf = p>=90?'#cf5442' : p>=60?'#c88616' : '#94a3b0';
  var t=String(w.title||'');
  /* Fuehrendes „thema — " im Titel weglassen: es steht schon ueber dem Strang.
     Zweimal dasselbe Wort in einer Karte ist verschenkter Platz. */
  t=t.replace(/^[a-zA-Zäöü+ ]{3,22}\s*[—-]\s*/,'');
  var kurz = t.length>96 ? t.slice(0,96).replace(/\s+\S*$/,'')+' …' : t;
  return '<div class="kbk" data-id="'+esc(String(w.work_id))+'">'
    +'<div class="kbkk">'
      +'<span class="kbnr">#'+esc(String(w.work_id))+'</span>'
      +'<span class="kbprio" style="background:'+pf+'" title="Priorität '+esc(String(p||'—'))+'"></span>'
      +'<span class="kbalt">'+esc(_kbAlter(w.updated_at))+'</span>'
    +'</div>'
    +'<div class="kbt" title="'+esc(t)+'">'+esc(kurz)+'</div>'
    +'<div class="kbf">'
      +'<span class="kbow">'+esc(w.owner_agent||'—')+'</span>'
      +(w.dependency_work_id?'<span class="kbdep" title="hängt an #'+esc(String(w.dependency_work_id))
        +'">⇠ '+esc(String(w.dependency_work_id))+'</span>':'')
    +'</div>'
    +'<div class="awpanel" data-panel="'+esc(String(w.work_id))+'"></div>'
  +'</div>';
}

function _kbStrang(thema, liste){
  var zu=!!_KB_ZU[thema];
  var spalten=_KB_SPALTEN.map(function(sp){
    var karten=liste.filter(function(w){ return sp.status.indexOf(w.status)>=0; })
      .sort(function(a,b){ return (b.priority||0)-(a.priority||0) || (b.work_id||0)-(a.work_id||0); });
    return '<div class="kbsp">'
      +'<div class="kbsk" style="border-top-color:'+sp.farbe+'">'
        +'<span>'+esc(sp.wort)+'</span><b>'+karten.length+'</b></div>'
      +'<div class="kbsl">'
        +(karten.length? karten.map(_kbKarte).join('')
                       : '<div class="kbleer">–</div>')
      +'</div></div>';
  }).join('');
  return '<section class="kbstrang'+(zu?' kbzu':'')+'" data-thema="'+esc(thema)+'">'
    +'<header class="kbsh" data-klapp="'+esc(thema)+'">'
      +'<span class="kbpfeil">'+(zu?'▸':'▾')+'</span>'
      +'<h3>'+esc(_kbTitel(thema))+'</h3>'
      +'<span class="kbanz">'+liste.length+'</span>'
    +'</header>'
    +'<div class="kbspalten">'+spalten+'</div>'
  +'</section>';
}

function _kbBoard(){
  var alle=(_AB_WORK||[]).filter(function(w){
    return w.status!=='verified' && w.status!=='cancelled';
  });
  var q=_KB_SUCHE.trim().toLowerCase();
  if(q) alle=alle.filter(function(w){
    return ('#'+w.work_id+' '+(w.title||'')+' '+(w.area||'')).toLowerCase().indexOf(q)>=0; });

  var gr={}, themen=[];
  alle.forEach(function(w){ var a=w.area||'—';
    if(!gr[a]){ gr[a]=[]; themen.push(a); } gr[a].push(w); });
  themen.sort(function(a,b){ return gr[b].length-gr[a].length || a.localeCompare(b); });

  var sichtbar = _KB_THEMA ? themen.filter(function(t){ return t===_KB_THEMA; }) : themen;
  if(!sichtbar.length)
    return '<div class="kbnix">Kein Eintrag passt. '
      +(q?'Suche: „'+esc(_KB_SUCHE)+'"':'')+'</div>';
  return sichtbar.map(function(t){ return _kbStrang(t, gr[t]); }).join('');
}

function _kbLeiste(){
  var alle=(_AB_WORK||[]).filter(function(w){
    return w.status!=='verified' && w.status!=='cancelled'; });
  var gt={}, themen=[];
  alle.forEach(function(w){ var a=w.area||'—'; if(!gt[a]){ gt[a]=0; themen.push(a); } gt[a]++; });
  themen.sort(function(a,b){ return gt[b]-gt[a] || a.localeCompare(b); });
  return '<div class="kbleiste">'
    +'<button type="button" class="kbchip'+(_KB_THEMA?'':' akt')+'" data-thema="">'
      +'Alle Stränge <b>'+alle.length+'</b></button>'
    + themen.map(function(t){
        return '<button type="button" class="kbchip'+(_KB_THEMA===t?' akt':'')+'" '
          +'data-thema="'+esc(t)+'">'+esc(_kbTitel(t))+' <b>'+gt[t]+'</b></button>';
      }).join('')
    +'<input id="kbSuche" class="kbsuche" placeholder="Nummer oder Text …" '
      +'value="'+esc(_KB_SUCHE)+'">'
  +'</div>';
}

function kbHtml(){
  var kopf='<div class="ab"><div class="abkopf"><h2>Aufgaben</h2>'
    +'<span class="st" id="kbStand">'+( _AB_WORK ? (_AB_WORK.filter(function(w){
        return w.status!=='verified'&&w.status!=='cancelled'; }).length+' offene Aufgaben')
      : 'lädt…')+'</span>'
    +'<span style="margin-left:auto;display:flex;gap:9px;align-items:center">'
    +_abUmschalter('aufgaben')
    +'<button class="abbtn" id="abNeu">↻ Aktualisieren</button></span></div></div>';
  if(_AB_WORK_FEHLER)
    return kopf+'<div class="kbwrap"><div class="bfehl"><b>Aufgaben nicht ladbar.</b><br>'
      +esc(_AB_WORK_FEHLER)+'</div></div>';
  return kopf+'<div class="kbwrap">'+_kbLeiste()+'<div id="awBody">'+_kbBoard()+'</div></div>';
}

function kbCss(){
  if(document.getElementById('kbCss')) return;
  var s=document.createElement('style'); s.id='kbCss';
  s.textContent=
   '.kbwrap{padding:0 18px 30px;max-width:1680px;margin:0 auto}'
  +'.kbleiste{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 14px}'
  +'.kbchip{border:1px solid var(--line,#dde3ea);border-radius:999px;background:var(--card,#fff);'
    +'color:inherit;padding:4px 11px;font-size:12px;cursor:pointer;line-height:1.5;transition:.12s}'
  +'.kbchip:hover{border-color:#9aa7b4}'
  +'.kbchip.akt{background:var(--ink,#18222d);color:#fff;border-color:var(--ink,#18222d)}'
  +'.kbchip b{font-weight:800;margin-left:3px;opacity:.75}'
  +'.kbsuche{margin-left:auto;flex:0 1 230px;padding:5px 11px;border:1px solid var(--line,#dde3ea);'
    +'border-radius:999px;background:var(--card,#fff);color:inherit;font-size:12px}'
  +'.kbstrang{margin:0 0 18px;background:var(--card,#fff);border:1px solid var(--line,#e4e9ef);'
    +'border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,32,.04)}'
  +'.kbsh{display:flex;align-items:center;gap:9px;padding:11px 15px;cursor:pointer;'
    +'border-bottom:1px solid var(--line,#eef2f6);user-select:none}'
  +'.kbsh:hover{background:var(--bg,#f7f9fb)}'
  +'.kbpfeil{font-size:11px;opacity:.45;width:11px}'
  +'.kbsh h3{margin:0;font-size:13.5px;font-weight:700;letter-spacing:.2px;text-transform:capitalize}'
  +'.kbanz{margin-left:auto;font-size:11.5px;font-weight:700;opacity:.5}'
  +'.kbzu .kbspalten{display:none}'
  +'.kbspalten{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;'
    +'background:var(--line,#eef2f6)}'
  +'.kbsp{background:var(--bg,#fafbfc);display:flex;flex-direction:column;min-width:0}'
  +'.kbsk{display:flex;align-items:center;gap:6px;padding:7px 11px 6px;font-size:11px;'
    +'font-weight:700;letter-spacing:.3px;text-transform:uppercase;opacity:.72;'
    +'border-top:2px solid transparent;background:var(--card,#fff)}'
  +'.kbsk b{margin-left:auto;font-size:11.5px;opacity:.8}'
  +'.kbsl{padding:8px;display:flex;flex-direction:column;gap:7px;'
    +'max-height:none}'
  +'.kbleer{font-size:11px;opacity:.28;text-align:center;padding:10px 0}'
  +'.kbk{background:var(--card,#fff);border:1px solid var(--line,#e6ebf0);border-radius:10px;'
    +'padding:8px 10px 7px;cursor:pointer;transition:.12s}'
  +'.kbk:hover{border-color:#9aa7b4;box-shadow:0 2px 7px rgba(16,24,32,.08);transform:translateY(-1px)}'
  +'.kbkk{display:flex;align-items:center;gap:6px;margin-bottom:4px}'
  +'.kbnr{font-size:10.5px;font-weight:800;opacity:.42;letter-spacing:.2px}'
  +'.kbprio{width:6px;height:6px;border-radius:50%;flex:0 0 6px}'
  +'.kbalt{margin-left:auto;font-size:10px;opacity:.38}'
  +'.kbt{font-size:12px;line-height:1.42;margin-bottom:5px}'
  +'.kbf{display:flex;align-items:center;gap:6px;font-size:10px;opacity:.5}'
  +'.kbow{text-transform:uppercase;letter-spacing:.4px;font-weight:700}'
  +'.kbdep{margin-left:auto;opacity:.75}'
  +'.kbnix{padding:40px 0;text-align:center;font-size:13px;opacity:.55}'
  +'@media(max-width:1100px){.kbspalten{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  +'@media(max-width:640px){.kbspalten{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}

/* Nach dem Zeichnen verdrahten. innerHTML wirft Handler weg — deshalb getrennt,
   dieselbe Bauart wie arNach(). */
function kbNach(){
  var box=document.getElementById('fgDash'); if(!box) return;
  _abUmschalterNach();
  var neu=document.getElementById('abNeu');
  if(neu) neu.addEventListener('click',function(){ kbLaden(true); });

  box.querySelectorAll('.kbchip').forEach(function(c){
    c.addEventListener('click',function(){ _KB_THEMA=c.dataset.thema||''; kbZeichnen(); });
  });
  var s=box.querySelector('#kbSuche');
  if(s){
    var t=null;
    s.addEventListener('input',function(){
      clearTimeout(t);
      t=setTimeout(function(){
        _KB_SUCHE=s.value; kbZeichnen();
        var n=document.getElementById('kbSuche');
        if(n){ n.focus(); try{ n.setSelectionRange(n.value.length,n.value.length); }catch(e){} }
      },260);
    });
  }
  box.querySelectorAll('.kbsh').forEach(function(h){
    h.addEventListener('click',function(){
      var k=h.dataset.klapp; _KB_ZU[k]=!_KB_ZU[k]; _kbMerken(); kbZeichnen();
    });
  });
  /* Karte anklicken klappt das VORHANDENE Aenderungsformular auf (_abWorkPanel).
     Immer nur eines — zwei halb ausgefuellte Entscheidungen nebeneinander sind
     eine Fehlerquelle, kein Komfort. Dieselbe Regel wie in der Tafel. */
  box.querySelectorAll('.kbk').forEach(function(k){
    k.addEventListener('click',function(e){
      if(e.target.closest('.awpanel')) return;      /* Klick IM Formular */
      var id=k.dataset.id;
      var p=k.querySelector('.awpanel'); if(!p) return;
      var offen=p.classList.contains('awoffen');
      box.querySelectorAll('.awpanel.awoffen').forEach(function(x){
        x.classList.remove('awoffen'); x.innerHTML=''; });
      if(offen) return;
      p.innerHTML=_abWorkPanel(id); p.classList.add('awoffen');
      _abWorkCss();
      /* Volltext nachladen — GENAU wie in der Tafel. Der Kasten heisst
         .awdet[data-det], nicht data-detail; beim ersten Versuch hatte ich das
         geraten statt nachgesehen, und das Formular waere ohne Text geblieben. */
      (async function(){
        var kasten=p.querySelector('.awdet[data-det="'+CSS.escape(String(id))+'"]');
        if(!kasten) return;
        try{
          var d=await _abWorkDetailLaden(id);
          if(!p.classList.contains('awoffen')) return;   /* inzwischen zugeklappt */
          kasten.innerHTML=_abWorkDetailHtml(d);
        }catch(e){
          kasten.innerHTML='<div class="bfehl">Text nicht ladbar: '+esc((e&&e.message)||String(e))+'</div>';
          try{ console.error('[Kanban] Detail #'+id, e); }catch(_){}
        }
      })();
      p.querySelectorAll('[data-do]').forEach(function(b){
        b.addEventListener('click',function(){
          if(b.dataset.do==='zu'){ p.classList.remove('awoffen'); p.innerHTML=''; return; }
          _abWorkSpeichern(b.dataset.id, b.dataset.do);
        });
      });
    });
  });
}

function kbZeichnen(){
  var body=document.getElementById('awBody'); if(!body) return;
  body.innerHTML=_kbBoard();
  var l=document.querySelector('.kbleiste');
  if(l) l.outerHTML=_kbLeiste();
  kbNach();
}

async function kbLaden(neu){
  var box=document.getElementById('fgDash'); if(!box) return;
  if(neu||!_AB_WORK) await _abWorkLaden();
  kbCss(); dashArbeitCss();
  box.innerHTML=kbHtml();
  kbNach();
}
if(typeof window!=='undefined'){ window.kbLaden=kbLaden; window.kbZeichnen=kbZeichnen; }

/* ============================================================================
   EINSTIEG IN DIE AUFGABEN  ·  Work #295  ·  26.08.2026
   ----------------------------------------------------------------------------
   Ralph: „gearbeitet wird im dashbord" — Z3, steuern koennen.

   🔴 HIER WURDE NICHTS GEBAUT, NUR ANGESCHLOSSEN (§22). Die vollstaendige
   Steuerung gibt es seit Work #198/#199: Aufklappen mit Volltext,
   Status/Owner/Prioritaet aendern, Abnehmen ueber den eigenen Serverweg. Das
   Kanban benutzt genau diese Wege weiter (_abWorkPanel, _abWorkSpeichern,
   _abWorkDetailLaden) — es zeichnet nur anders.

   ⚠ ZWISCHENSTAND VOM SELBEN TAG, bewusst festgehalten: zwischen 20:00 und
   21:00 war diese Funktion eine UEBERLAGERUNG mit Filterleiste und Zeilen.
   Ralph hat sie gesehen und verworfen („nicht als popup"). Der Weg dorthin war
   nicht falsch — die Ueberlagerung hat bewiesen, dass die alten Bedienwege
   ausserhalb ihrer Kachel funktionieren. Sie war nur die falsche Form.
   ========================================================================== */
function arbeitstafelOeffnen(status, titel){
  /* 🔴 26.08.2026, Ralph: „nicht als popup sondern anders und schoen."
     Diese Funktion HIESS einmal so, weil sie eine Ueberlagerung aufzog. Sie
     tut es nicht mehr: sie wechselt in die Ansicht „Aufgaben". Der Name bleibt,
     weil die Fluss-Kachel ihn ruft — ein zweiter Name fuer denselben Weg waere
     der Doppelpfad, den wir gerade ueberall abbauen.
     `status` wird bewusst NICHT als Filter gesetzt: im Kanban ist jeder Status
     eine eigene Spalte, alle vier stehen nebeneinander. Ein Filter, der drei
     davon ausblendet, waere ein Rueckschritt hinter das Brett. */
  try{ if(typeof dashArbeitAnsichtSet==='function'){ dashArbeitAnsichtSet('aufgaben'); return; } }
  catch(e){ try{ console.error('[Aufgaben] Ansichtswechsel:',e); }catch(_){} }
}
if(typeof window!=='undefined') window.arbeitstafelOeffnen=arbeitstafelOeffnen;

/* 🔴 C2, 15.08.2026 — ROOT-COCKPIT-OPTIK (Ralph-Go: „ja, kannst du so bauen").
   Jede Kachel bekommt ein FOTO als Hintergrund. Die Dateien liegen FLACH in
   webseite/ als bg-*.jpg — nicht in einem Unterordner: deploy.command kopiert
   nur regulaere Dateien direkt aus webseite/ und ueberspringt Ordner. Waeren
   sie unten drin, waeren sie gebaut und trotzdem nie live (gemessen, C1).
   `foto` ist die Kennung ohne Vorsilbe und Endung. Fehlt sie, bleibt die
   Kachel weiss — kein Fehler, nur ohne Bild. */
var _AB_KACHELN=[
  /* 🔴 20.08.2026, Work #121: die IDs bleiben unveraendert — gespeicherte
     Layouts aus Work #42 duerfen nicht migriert werden muessen (Kriterium 2).
     Geaendert sind nur die BESCHRIFTUNGEN, damit jede Kachel sagt, welche
     Frage sie beantwortet: Arbeit · Eingang · Qualitaet · Katalog · Stamm ·
     RIKI · Nutzung · Betrieb. Vorher hiessen zwei davon nach ihrer Herkunft
     („Wächter-Status", „Letzte Aktivitäten") statt nach ihrem Zweck. */
  /* 🔴 26.08.2026, Ralph: die Arbeitskachel ist RAUS. Sie hat mit 142 Zeilen den
     ganzen Bildschirm erschlagen — eine Aufgabenliste ist kein Überblick.
     Die Aufgaben werden separat durchgesehen (nötig/sinnvoll), erst danach
     entscheidet Ralph, ob und wie sie zurückkommt.
     Der Bauer _abkAufgaben bleibt stehen: er wird über die freie Kachel und
     über den Anordnen-Modus weiter erreicht, und ein gespeichertes Layout mit
     'aufgaben' darf nicht kaputtgehen.
  {id:'aufgaben',  reihe:1, titel:'Arbeit',                   breit:true,  bau:_abkAufgaben, foto:'flusslauf', leds:'r ge', text:true}, */
  /* 🔴 26.08.2026, Ralph-Entscheid: „die anderen kacheln können weg."
     ES BLEIBEN GENAU ZWEI: Katalog und RIKI. Dazu die Termine darüber und das
     Wächter-Raster darunter — mehr wollte Ralph nicht sehen.
     ENTFERNT und warum:
       Qualität   → zeigte nur die 9 Gate-Wächter; das Raster zeigt alle 23.
       Eingang    → 202 Einträge; gehört in eine Arbeitsliste, nicht in den Überblick.
       Stamm      → keine Zahl, die Ralph morgens braucht.
       Betrieb    → Schnellzugriff dupliziert das linke Menü.
       Nutzung    → interessant, aber nicht handlungsleitend.
       Root Index → Zierde ohne Zahl.
       Wirkkette  → gehört ins Wirkdiagramm, nicht aufs Dashboard.
       Meine Zahlen → die freie Kachel; ohne Nachbarn ergibt sie keinen Sinn mehr.
     Die BAUER bleiben alle im Code. Wer eine Kachel zurückwill, hängt eine Zeile
     wieder ein — kein Neubau, und gespeicherte Layouts brechen nicht.
  */
  /* 🔴 26.08.2026: genau vier Kacheln — 4 x 285 + 3 x 20 = 1200, die volle
     Breite der Flaeche. Eine fuenfte wuerde umbrechen und Ralph muesste
     wieder scrollen. Entscheidungen steht vorn: es ist das Einzige, was
     ohne ihn liegenbleibt. */
  /* 🔴 31.08.2026, Ralph: „die kachel soll oben unter den wächtern stehen und
     darf etwas breiter sein." Sie steht bereits VORN (erste Kachel, direkt
     unter dem Waechter-Raster) — breit:true gibt ihr die Doppelbreite (590),
     damit die Haertefall-Saetze nicht umbrechen. Standardzeile 1 damit:
     590+285+285+2x20 = 1200, exakt die Flaechenbreite; Region bricht um.
     ⚠ Ein GESPEICHERTES Layout behaelt seine Masse — dann einmal im
     Anordnen-Modus „Standard" waehlen. */
  /* 🔴 06.09.2026, Ralph: Kachel raus. Entscheidungen stehen in der Steuerung und
     in der Queue - im Dashboard war sie eine zweite Liste derselben Sache, und die
     Haertefaelle darin liefen ins Leere. Der Bauplan _abkEntscheid bleibt stehen,
     falls sie zurueckkommen soll; nur die Zeile hier ist auskommentiert. */
  /* {id:'entscheid', reihe:1, titel:'Deine Entscheidungen',   breit:true,  bau:_abkEntscheid, hoch:true}, */
  {id:'bestand',   reihe:1, titel:'Katalog',                  breit:false, bau:_abkBestand,  foto:'kiesel',    leds:'gr gr', hoch:true},
  {id:'riki',      reihe:1, titel:'RIKI',                     breit:false, bau:_abkRiki,     foto:'kaskade',   leds:'gr'},
  /* 🔴 26.08.2026, Ralph: „nutzer & region höher darstellen, da muss ich aktuell
     scrollen." Die Kachel ist zurück — und in Reihe 1 neben Katalog und RIKI,
     damit sie ohne Scrollen sichtbar ist. */
  {id:'region',    reihe:1, titel:'Nutzer &amp; Regionen',    breit:false, bau:_abkRegion,   foto:'regionen',  leds:'gr'},
  {id:'seo',       reihe:2, titel:'SEO / Google',            breit:true,  bau:_abkSeo,      foto:'regionen',  leds:'gr'},
  /* 16.09.2026, Ralph: Kombination aus Vorschlag A (nach "wer ist dran"
     gruppiert) und B (Ampel-Farbe, nach Dringlichkeit sortiert), als Kachel
     mit maximal halber Flaechenbreite. breit:true = 590px = die Haelfte von
     _AB_LW=1200 (siehe Rechnung weiter oben bei 'bestand'/'riki'/'region').
     Bauer und Daten sind die alte Arbeit-Kachel von Work #199 (_abkAufgaben,
     cb_admin_agent_work_kurzliste) — nur der Zeilen- und Filterteil ist neu
     gebaut (_abWorkGruppen/_abWorkZeile), keine zweite Ladung (A4.2). */
  {id:'aufgaben',  reihe:2, titel:'Aufgaben',                  breit:true,  bau:_abkAufgaben, foto:'flusslauf', leds:'r ge', text:true},
  /* 🔴 26.08.2026, Ralph-Auftrag „gearbeitet wird im dashbord" — Stufe 2 zu
     ZIEL.md.
     ⚠ `reihe` steuert die Standardlage NICHT — _abStandardLagen liest das Feld
     gar nicht, sondern packt die Kacheln der Reihe nach und bricht um, sobald
     x+Breite ueber _AB_LW=1200 geht. Das Feld steht hier nur, weil die vier
     anderen es auch tragen; wer sich darauf verlaesst, irrt.
     NACHGERECHNET statt vermutet: die vier Kacheln der ersten Zeile fuellen
     0..1200 exakt aus; `fluss` mit 590 passt nicht mehr daneben und bricht
     um auf x=0, y=360 (Reihe 1 ist 340 hoch, plus 20 Abstand). Hoehe 270,
     endet also bei 630 — am Laptop ohne nennenswertes Scrollen erreichbar
     (E9: Laptop ist der Hauptfall).
     Breit, weil der Fluss vier Stationen nebeneinander zeigt. */
  /* 🔴 06.09.2026, Ralph: Kachel raus - dieselbe Begruendung wie bei den
     Entscheidungen. Der Fluss der Arbeit steht im Kern-Poster und in der Steuerung. */
  /* {id:'fluss',     reihe:2, titel:'Der Fluss der Arbeit',    breit:true,  bau:_abkFluss}, */
  /* {id:'waechter',  reihe:1, titel:'Qualität',               breit:false, bau:_abkWaechter, foto:'stroem',    leds:'r ge'},
  {id:'aktivitaet',reihe:2, titel:'Eingang',                  breit:true,  bau:_abkAkt,      foto:'wellen',    leds:'gr', text:true},
  {id:'stammu',    reihe:2, titel:'Stamm',                    breit:false, bau:_abkStammU,   foto:'stamm',     leds:'ge gr'},
  {id:'schnell',   reihe:2, titel:'Betrieb &amp; Schnellzugriff', breit:false, roh:_abSchnell}, */
  /* C3, 15.08.: zwei neue Kacheln, beide mit ECHTEN Zahlen aus vorhandenen
     RPCs. §22 hat sich wieder ausgezahlt — gesucht statt gebaut:
       Stamm    -> cb_admin_stamm_waechter()      (das Dashboard ruft ihn schon)
       Wirkkette-> cb_admin_architektur_liste()   (seit 15.08. in der Datenbank)
     Die Deutschlandkarte wurde NICHT gebaut: entKarteDE und
     cb_bundesland_zaehlung gibt es seit Juli, sie haengen in der Kachel
     „Nutzer & Regionen". Im Entwurf hatte ich sie nachgezeichnet — das waere
     die zweite Kopie gewesen (§4.2). */
  /* {id:'marke',     reihe:1, titel:'Root Index',              breit:false, bau:_abkMarke},
  {id:'wirk',      reihe:2, titel:'Wirkkette',                 breit:false, bau:_abkWirk,     foto:'ringe',  leds:'r ge', text:true}, */
  /* Die freie Kachel: Ralph bestimmt ihren INHALT, nicht nur ihren Platz.
     Sie steht in der gespeicherten Standardvariante auf aus - wer sie will,
     schaltet sie im Anordnen-Modus ein. Ein Dashboard, das sich von selbst um
     eine Kachel erweitert, waere eine Ueberraschung, keine Verbesserung. */
  /* {id:'frei',      reihe:1, titel:'Meine Zahlen',           breit:false, bau:_abkFrei, waehlbar:true} */
];

/* ============================================================================
   KENNZAHL-REGISTER  ·  Work #42, „inhalt bestimmen"  ·  15.08.2026
   ----------------------------------------------------------------------------
   Ralphs Auftrag hiess „container verschieben, INHALT BESTIMMEN usw." Das
   Verschieben steht; hier kommt der Inhalt.

   🔴 KURATIERTE LISTE, kein freier Datenbankzugriff aus dem Browser (§10.2).
   Waehlbar ist genau das, was das Dashboard ohnehin schon geladen hat - keine
   einzige zusaetzliche Abfrage, keine neue Zaehlung. Jede Zahl hier hat ihre
   Quelle in denselben Daten wie die Kacheln daneben; damit kann keine zweite
   Wahrheit entstehen (§4.2).

   Erweitern heisst: eine Zeile in dieser Liste. Nicht: eine Migration.
   ========================================================================== */
var _AB_KENNZAHLEN=[
  {id:'aktiv',      titel:'aktive Produkte',      wert:function(c){ return _abKz(c.d,'katalog','aktiv'); }},
  {id:'entwurf',    titel:'Entwürfe',             wert:function(c){ return _abKz(c.d,'katalog','entwurf'); }},
  {id:'schnitt',    titel:'Index-Schnitt',        wert:function(c){ var v=_abKz(c.d,'katalog','schnitt_score');
                                                     return v==null?null:String(v).replace('.',','); }},
  {id:'ohne_score', titel:'ohne Index-Zahl',      warn:true, wert:function(c){ return _abKz(c.d,'qualitaet','ohne_score'); }},
  {id:'zutaten',    titel:'Zutaten im Stamm',     wert:function(c){ return _abKz(c.np,'extra','zutaten'); }},
  {id:'rezepte',    titel:'Rezepte',              wert:function(c){ return _abKz(c.np,'extra','rezepte'); }},
  {id:'nutzer',     titel:'Nutzer gesamt',        wert:function(c){ return _abKz(c.d,'nutzer','gesamt'); }},
  {id:'aktiv30',    titel:'aktiv, 30 Tage',       wert:function(c){ return _abKz(c.d,'nutzer','aktiv_30t'); }},
  {id:'premium',    titel:'Premium',              wert:function(c){ return _abKz(c.d,'nutzer','premium'); }},
  {id:'tagebuch',   titel:'Tagebuch, 7 Tage',     wert:function(c){ return _abKz(c.d,'nutzung','eintraege_7t'); }},
  {id:'wartend',    titel:'Vorgänge warten',      wert:function(c){ return c.A?c.A.wartend:null; }},
  {id:'sackgasse',  titel:'ohne Abnehmer',        warn:true, wert:function(c){ return c.A?c.A.sackgasse:null; }},
  {id:'melden',     titel:'Wächter melden',       warn:true, wert:function(c){ return c.A?c.A.melden:null; }},
  {id:'gate',       titel:'Gate-Fälle',           warn:true, wert:function(c){ return c.A?c.A.gate_offen:null; }},
  {id:'riki_monat', titel:'Riki, Monat',          wert:function(c){ var r=(c.d&&c.d.riki)||{}, v=Number(r.monat_usd);
                                                     return isNaN(v)?null:v.toFixed(2).replace('.',',')+' $'; }},
  {id:'regelwerk',  titel:'Regelwerk-Bereiche',   wert:function(c){ var r=(c.np&&c.np.regelwerk); return r?r.length:null; }}
];
/* Ein Griff, damit keine 16 eigene Null-Pruefungen entstehen. */
function _abKz(quelle, gruppe, feld){
  var g=(quelle&&quelle[gruppe])||{};
  var v=g[feld];
  return (v==null||v==='')?null:v;
}
var _AB_FREI_VORGABE=['aktiv','ohne_score','wartend','melden'];

/* ============================================================================
   EIGENE KACHELN  ·  Work #42  ·  15.08.2026
   ----------------------------------------------------------------------------
   🔴 RICHTIGSTELLUNG. Ralph: „neue kacheln einfuegen und loeschen glaub ich
   sind schon drin." Waren sie NICHT. Bis Build 3070 gab es genau die neun
   Kacheln aus dem Code; „✕" hat eine davon nur AUSGEBLENDET. Neu anlegen ging
   gar nicht. Hier steht es jetzt wirklich.

   DER UNTERSCHIED, der auch in der Oberflaeche sichtbar ist:
     · Kacheln aus dem Code (Aufgaben, Datenbestand, Riki …) kann man
       AUSBLENDEN, nicht loeschen — sie gehoeren zur App, nicht zum Layout.
       Zeichen: ✕. Sie kommen ueber die Leiste zurueck.
     · Selbst angelegte Kacheln kann man LOESCHEN. Zeichen: 🗑. Sie stehen nur
       im Layout, also verschwinden sie mit ihm.
   Ein Loeschknopf, der in Wahrheit nur ausblendet, waere eine Luege in der
   Oberflaeche - und ein Ausblendknopf, der in Wahrheit loescht, ein Datenverlust.
   ========================================================================== */
var _AB_TYPEN={
  frei: {titel:'Meine Zahlen', bau:function(c,x){ return _abkFrei(c,x); }, waehlbar:true},
  /* D4, Ralph: „notizen wird spaeter eine kachel." Die einzige Kachelart, die
     KEINE Datenfrage aufwirft — der Inhalt kommt von ihm. */
  notiz:{titel:'Notiz',        bau:function(c,x){ return _abkNotiz(c,x); }, text:true},
  /* D5-D7. 🔴 ALLE DREI ARBEITEN NUR MIT DATEN, DIE DAS DASHBOARD SCHON HAT.
     Ralph hat „weiter d5 bis d7" gesagt, aber die offenen Fragen dazu nicht
     beantwortet - welche Reihen ueber Zeit, welche Filter, ob Bilder gemeint
     waren. Statt zu raten (§1) ist jede Art auf das begrenzt, was messbar
     vorliegt; was fehlt, sagt die Kachel selbst. */
  verlauf:{titel:'Verlauf',    bau:function(c,x){ return _abkVerlauf(c,x); }, reihe:true},
  liste:  {titel:'Liste',      bau:function(c,x){ return _abkListe(c,x); },   quelle:true},
  bild:   {titel:'Bild',       bau:function(c,x){ return _abkBild(c,x); },    text:true}
};

/* ---- MARKE mit Fluxkompensator -------------------------------------------
   Ralph wollte ihn ausdruecklich als Hintergrund. Ein Foto gibt es davon nicht,
   also gezeichnet — und zwar EINMAL hier, nicht als Datei: eine Zeichnung, die
   sich aus drei Zahlen ergibt, gehoert in den Code, nicht in ein Bild. */
function _abkMarke(){
  var G=_AB.gut, S='#8c969b', l='', cx=150, cy=98;
  l+='<defs><radialGradient id="riKern"><stop offset="0" stop-color="'+G+'" stop-opacity=".9"/>'
    +'<stop offset="1" stop-color="'+G+'" stop-opacity="0"/></radialGradient></defs>';
  [-90,150,30].forEach(function(grad){
    var w=grad*Math.PI/180, ex=cx+Math.cos(w)*66, ey=cy+Math.sin(w)*66;
    l+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex+'" y2="'+ey+'" stroke="'+G
      +'" stroke-width="8" stroke-linecap="round" opacity=".35"/>'
      +'<line x1="'+cx+'" y1="'+cy+'" x2="'+ex+'" y2="'+ey+'" stroke="'+G
      +'" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>'
      +'<circle cx="'+ex+'" cy="'+ey+'" r="10" fill="none" stroke="'+S+'" stroke-width="1.8" opacity=".5"/>'
      +'<circle cx="'+ex+'" cy="'+ey+'" r="4.5" fill="'+G+'" opacity=".8"/>';
  });
  l+='<circle cx="'+cx+'" cy="'+cy+'" r="42" fill="url(#riKern)" opacity=".5"/>'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="28" fill="none" stroke="'+G
    +'" stroke-width="1" opacity=".45" stroke-dasharray="4 7"/>'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="19" fill="none" stroke="'+S+'" stroke-width="2.2" opacity=".6"/>'
    +'<circle cx="'+cx+'" cy="'+cy+'" r="12" fill="'+G+'" opacity=".9"/>';
  return {
    tag:'',
    inhalt:'<div class="bleib bmarke">'
      +'<svg viewBox="0 0 300 196" preserveAspectRatio="xMidYMid meet">'+l+'</svg>'
      +'<div class="bmtext"><b>[ri!]</b><span>Root Index<br>Erfassen · Bewerten · Freigeben</span></div>'
      +'</div>',
    fuss:''
  };
}

/* ---- WIRKKETTE ------------------------------------------------------------
   Laedt NACH, wie die anderen Kacheln der zweiten Reihe: cb_admin_architektur_liste
   liefert das ganze Diagramm, das ist nichts fuer den Seitenaufbau (Work #17). */
function _abkWirk(){
  return {
    tag:'<span class="abtag" style="background:#eef0f4;color:'+_AB.mut+'">Architektur</span>',
    inhalt:'<div class="bleib" id="abWirk"><div class="blade">lädt…</div></div>',
    fuss:''
  };
}

/* ---- D5 VERLAUF ------------------------------------------------------------
   🔴 EHRLICH GEZAEHLT: im Dashboard liegt GENAU EINE Reihe ueber Zeit vor -
   der taegliche Riki-Verbrauch (d.riki_verlauf, 14 Tage). Mehr ist nicht da.
   Die Auswahlliste hat deshalb einen Eintrag. Das ist kein Versehen und wird
   auch nicht mit erfundenen Reihen aufgefuellt; kommt serverseitig eine dazu,
   ist es hier eine Zeile. */
var _AB_REIHEN=[
  {id:'riki', titel:'Riki-Verbrauch je Tag', einheit:'$',
   werte:function(c){
     return (((c.d||{}).riki_verlauf)||[]).map(function(p){
       return {marke:p.tag, wert:Number(p.usd)||0}; });
   }}
];
function _abkVerlauf(c,x){
  var wahl=(x&&x.reihe_id)||_AB_REIHEN[0].id;
  var r=_AB_REIHEN.filter(function(y){ return y.id===wahl; })[0]||_AB_REIHEN[0];
  if(_AB_EDIT){
    return {
      tag:'<span class="abtag" style="background:#fbf3df;color:#8a7440">Reihe wählen</span>',
      inhalt:'<div class="bleib"><div class="abwahl">'
        + _AB_REIHEN.map(function(y){
            var an=(y.id===r.id);
            return '<button type="button" class="abkz'+(an?' an':'')+'" data-abreihe="'+esc(y.id)
              +'" data-kid="'+esc(x?x.id:'')+'">'+(an?'✓ ':'+ ')+esc(y.titel)+'</button>'; }).join('')
        +'</div><div class="bunter" style="margin-top:8px">Mehr Reihen gibt es zurzeit nicht — '
        +'sobald der Server eine liefert, steht sie hier.</div></div>',
      fuss:''
    };
  }
  var w=[]; try{ w=r.werte(c)||[]; }catch(e){ w=[]; }
  if(!w.length) return {tag:'', inhalt:'<div class="bleib"><div class="bleerk">'
    +'Für „'+esc(r.titel)+'" liegen keine Tageswerte vor.</div></div>', fuss:''};
  var max=Math.max.apply(null,[0.0001].concat(w.map(function(p){ return p.wert; })));
  var summe=w.reduce(function(a,p){ return a+p.wert; },0);
  return {
    tag:'<span class="abtag" style="background:#eef0f4;color:'+_AB.mut+'">'+w.length+' Tage</span>',
    inhalt:'<div class="bleib"><div class="bzahl" style="color:'+_AB.kern+'">'
      +summe.toFixed(2).replace('.',',')+' '+esc(r.einheit)+'</div>'
      +'<div class="bunter">'+esc(r.titel)+'</div>'
      +'<div class="bspark" style="height:60px">'
      + w.map(function(p){
          return '<i title="'+esc(String(p.marke))+': '+p.wert.toFixed(2)+'" style="height:'
            +Math.max(2,Math.round(p.wert/max*56))+'px"></i>'; }).join('')
      +'</div></div>',
    fuss:''
  };
}

/* ---- D6 LISTE --------------------------------------------------------------
   Auch hier nur Vorhandenes: die Arbeitsliste aus _abJobsListe (dieselbe
   Quelle wie die Kachel „Heute") und die Waechter, die melden. KEINE neue
   Abfrage, KEINE zweite Zaehlung (§4.2). */
var _AB_QUELLEN=[
  {id:'aufgaben', titel:'Offene Aufgaben',
   zeilen:function(c){
     return (_abJobsListe(c.np,c.A)||[]).map(function(j){
       return {links:j.t1, rechts:j.n, warn:(j.p===0), ziel:j.ziel}; });
   }},
  {id:'melder', titel:'Wächter, die melden',
   zeilen:function(c){
     return (((c.np||{}).waechter)||[])
       .filter(function(w){ return (Number(w.offen)||0)>0; })
       .sort(function(a,b){ return (Number(b.offen)||0)-(Number(a.offen)||0); })
       .map(function(w){ return {links:w.name, rechts:w.offen, warn:(w.gate===true)}; });
   }}
];
function _abkListe(c,x){
  var wahl=(x&&x.quelle)||_AB_QUELLEN[0].id;
  var q=_AB_QUELLEN.filter(function(y){ return y.id===wahl; })[0]||_AB_QUELLEN[0];
  var max=Number(x&&x.anzahl)||8;
  if(_AB_EDIT){
    return {
      tag:'<span class="abtag" style="background:#fbf3df;color:#8a7440">Quelle wählen</span>',
      inhalt:'<div class="bleib"><div class="abwahl">'
        + _AB_QUELLEN.map(function(y){
            var an=(y.id===q.id);
            return '<button type="button" class="abkz'+(an?' an':'')+'" data-abquelle="'+esc(y.id)
              +'" data-kid="'+esc(x?x.id:'')+'">'+(an?'✓ ':'+ ')+esc(y.titel)+'</button>'; }).join('')
        +'</div><div class="bunter" style="margin-top:8px">Zeigt die '+max+' obersten Zeilen. '
        +'Die Kachel höher ziehen zeigt mehr.</div></div>',
      fuss:''
    };
  }
  var z=[]; try{ z=q.zeilen(c)||[]; }catch(e){ z=[]; }
  return {
    tag:'<span class="abtag" style="background:#eef0f4;color:'+_AB.mut+'">'+z.length+'</span>',
    inhalt:'<div class="bleib">'
      +(z.length
        ? z.slice(0,max).map(function(r){
            return _abZeile(esc(String(r.links)), r.rechts, r.warn?_AB.krit:null); }).join('')
          +(z.length>max?'<div class="bunter" style="margin-top:6px">und '+(z.length-max)+' weitere</div>':'')
        : '<div class="bleerk">Nichts offen — '+esc(q.titel)+'.</div>')
      +'</div>',
    fuss:''
  };
}

/* ---- D7 BILD ---------------------------------------------------------------
   🔴 NUR UEBER EINE ADRESSE, KEIN HOCHLADEN. Hochladen braeuchte einen
   Ablageort fuer Dateien (Storage) samt Rechten - das ist ChatGPTs Haelfte
   (§31) und war nicht beauftragt. Mit einer Adresse geht es sofort und ohne
   fremde Entscheidung. Was das NICHT kann, steht in der Kachel, nicht nur hier. */
function _abkBild(c,x){
  var url=(x&&typeof x.text==='string')?x.text.trim():'';
  if(_AB_EDIT){
    return {
      tag:'<span class="abtag" style="background:#fbf3df;color:#8a7440">Bildadresse</span>',
      inhalt:'<div class="bleib"><input class="abetitel" style="width:100%;text-transform:none;'
        +'font-size:12px;font-weight:600" data-abnotiz="'+esc(x?x.id:'')+'" value="'+esc(url)+'" '
        +'placeholder="https://… — Adresse eines Bildes"></div>',
      fuss:'Hochladen geht hier nicht — dafür fehlt ein Ablageort für Dateien.'
    };
  }
  if(!url) return {tag:'', inhalt:'<div class="bleib"><div class="bleerk">'
    +'Kein Bild hinterlegt — „🧩 Anordnen" öffnen und eine Adresse eintragen.</div></div>', fuss:''};
  return {
    tag:'',
    inhalt:'<div class="bleib" style="padding:0"><img src="'+esc(url)+'" alt="" '
      +'style="display:block;width:100%;height:100%;object-fit:contain" '
      +'onerror="this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\','
      +'\'&lt;div class=&quot;bleerk&quot; style=&quot;padding:10px&quot;&gt;'
      +'Bild nicht ladbar — Adresse prüfen.&lt;/div&gt;\')"></div>',
    fuss:''
  };
}

/* Notizkachel. Der Text liegt im Layout und wird mit ihm gespeichert — also
   fuer alle Admins sichtbar, wie alles andere auch (Ralph-Entscheid C).
   🔴 Das ist KEIN Ersatz fuer das Notizbuch (📝): dort haengen To-dos mit
   Zaehler. Hier steht ein Zettel auf dem Schreibtisch. Wer beides
   zusammenwirft, hat zwei Orte fuer dieselbe Aufgabe. */
function _abkNotiz(c,x){
  var t=(x&&typeof x.text==='string')?x.text:'';
  if(_AB_EDIT){
    return {
      tag:'<span class="abtag" style="background:#fbf3df;color:#8a7440">Text</span>',
      inhalt:'<div class="bleib"><textarea class="abnotiz" data-abnotiz="'+esc(x?x.id:'')+'" '
        +'placeholder="Notiz schreiben — sie wird mit dem Layout gespeichert">'+esc(t)+'</textarea></div>',
      fuss:t.length+' Zeichen'
    };
  }
  return {
    tag:'',
    inhalt:'<div class="bleib"><div class="abnotizText">'
      + (t ? esc(t).replace(/\n/g,'<br>')
           : '<span class="bleerk">Leere Notiz — „🧩 Anordnen" öffnen und schreiben.</span>')
      +'</div></div>',
    fuss:''
  };
}

function _abFreiWahl(x){
  var w=(x&&x.inhalt&&x.inhalt.length)?x.inhalt:_AB_FREI_VORGABE;
  /* Nur bekannte Kennzahlen - eine gespeicherte, spaeter entfernte id wird
     uebergangen statt als leere Zeile gezeigt (§3.4: fehlend ist nicht 0). */
  return w.filter(function(id){
    return _AB_KENNZAHLEN.some(function(k){ return k.id===id; }); });
}

function _abkFrei(c,x){
  var gewaehlt=_abFreiWahl(x);
  if(_AB_EDIT){
    /* Im Anordnen-Modus zeigt die Kachel die AUSWAHL, nicht die Zahlen. */
    return {
      tag:'<span class="abtag" style="background:#fbf3df;color:#8a7440">Inhalt wählen</span>',
      inhalt:'<div class="bleib"><div class="abwahl">'
        + _AB_KENNZAHLEN.map(function(k){
            var an=gewaehlt.indexOf(k.id)>=0;
            return '<button type="button" class="abkz'+(an?' an':'')+'" '
              +'data-abkz="'+esc(k.id)+'" data-kid="'+esc(x?x.id:'frei')+'">'
              +(an?'✓ ':'+ ')+esc(k.titel)+'</button>';
          }).join('')
        +'</div></div>',
      fuss:gewaehlt.length+' von '+_AB_KENNZAHLEN.length+' gewählt · Klick schaltet um'
    };
  }
  return {
    tag:'',
    inhalt:'<div class="bleib">'
      + (gewaehlt.length
          ? gewaehlt.map(function(id){
              var k=_AB_KENNZAHLEN.filter(function(y){ return y.id===id; })[0];
              var v=null; try{ v=k.wert(c); }catch(e){ v=null; }
              return _abZeile(esc(k.titel), (v==null?'–':v),
                (k.warn && Number(v)>0)?_AB.warn:null);
            }).join('')
          : '<div class="bleerk">Noch nichts gewählt — „🧩 Anordnen" öffnen.</div>')
      +'</div>',
    fuss:''
  };
}

/* ============================================================================
   LAYOUT-KONFIGURATION  ·  Work #42, Etappe 2  ·  15.08.2026
   ----------------------------------------------------------------------------
   Ralph-Entscheid: der Editor wird von IHM bedient, die Wirkung gilt fuer ALLE
   Admins. Also liegt die Konfiguration in der Datenbank (nicht im Browser) und
   es gibt keine Fassung „nur fuer Ralph".

   _AB_LAYOUT ist die eine Stelle, an der eine gespeicherte Anordnung ankommt.
   Bleibt sie leer, gilt _AB_KACHELN — der Rueckfall ist damit IMMER da und
   braucht keine Datenbank. E4 fuellt sie aus dem RPC; hier wird nur gelesen.

   Vier Regeln, damit nichts still verschwindet (source_completeness):
     1. Keine Konfiguration        -> Registerreihenfolge, unveraendert.
     2. Unbekannte id in der Konf. -> uebergangen, aber GEZAEHLT und gemeldet.
        Der Code sagt, welche Kacheln es gibt, nicht die gespeicherte Liste.
     3. Kachel im Code, aber NICHT in der Konfiguration -> sie bleibt SICHTBAR
        und haengt sich hinten an ihre Reihe. Eine neu gebaute Kachel darf nicht
        deshalb unsichtbar sein, weil ein aelteres Layout sie nicht kennt.
     4. aus:true blendet aus — das ist eine ENTSCHEIDUNG, kein Datenverlust.

   🔴 Beim Ausblenden einer nachladenden Kachel (abAkt · abRegion · abStammU)
   faellt nur der Container weg; _abBento2Laden prueft mit getElementById und
   schreibt dann nirgendwohin. Der RPC-Aufruf laeuft trotzdem — unnoetig, aber
   ungefaehrlich. Notiert statt hier mitgebaut (§29 R3), gehoert in E5.
   ========================================================================== */
var _AB_LAYOUT=null;

/* ============================================================================
   FREIE FLAECHE  ·  Work #42, Umbau  ·  15.08.2026
   ----------------------------------------------------------------------------
   🔴 RALPH, WOERTLICH: „ich wollte einen freien editor, z.b. wie powerpoint, in
   dem kann ich auch bilder schieben, vergroessern verkleinern und wenn ich
   will, uebereinander legen."

   Bis hierher war es ein RASTER: die Kacheln standen in zwei Reihen, und
   „anordnen" hiess nur, ihre Reihenfolge zu tauschen. Das war nicht der
   Auftrag, sondern die naechstliegende Umsetzung davon - mein Fehler.

   Ab jetzt ist es eine FLAECHE. Jede Kachel hat vier Zahlen und eine fuenfte:
     x, b  — waagerecht, in logischen Einheiten 0.._AB_LW (nicht in Pixeln,
             damit dieselbe Anordnung auf jedem Bildschirm gleich aussieht)
     y, h  — senkrecht, in Bildpunkten
     z     — was oben liegt, wenn sich zwei ueberlappen
   Ueberlappen ist ausdruecklich erlaubt, nicht ein Fehler, der verhindert wird.

   WAS DIESER UMBAU KOSTET, ehrlich gesagt: das alte Raster ordnete sich auf
   schmalen Bildschirmen selbst um (5 Spalten -> 2 -> 1). Eine frei gelegte
   Flaeche kann das nicht - sie skaliert stattdessen mit. Auf dem Telefon wird
   das Dashboard damit klein statt umgebrochen. Das Adminboard ist ein
   Schreibtischwerkzeug; wenn du es anders willst, ist das eine Entscheidung
   und kein Nachbessern.
   ========================================================================== */
var _AB_LW=1200;        /* logische Breite der Flaeche */
var _AB_RASTER=10;      /* Fangraster waagerecht, in logischen Einheiten */
var _AB_RASTERY=10;     /* Fangraster senkrecht, in Bildpunkten */
var _AB_MINB=140, _AB_MINH=90;
var _AB_HOEHE=270;   /* eine Hoehe fuer alle Kacheln (Ralph 15.08.) */   /* kleiner geht nicht - sonst ist nichts mehr lesbar */

function _abLayoutZahl(v){ var n=Number(v); return (v==null||v===''||isNaN(n))?null:n; }

/* Die Standardaufteilung: daraus bekommt jede Kachel ihre erste Lage, solange
   niemand sie verschoben hat. Sie ist HERGELEITET, nicht gespeichert - eine
   neue Kachel im Code bekommt so von selbst einen Platz statt bei 0,0 zu
   liegen und alles zu verdecken. */
function _abStandardLagen(){
  /* 🔴 15.08., Ralph: „und die kasten selbe höhe". Vorher waren Reihe 1 und 2
     unterschiedlich hoch (250/300) — das sah aus wie ein Versehen, weil die
     Kacheln nebeneinander unterschiedlich weit nach unten reichten. Jetzt
     EINE Hoehe fuer alle. Wer eine andere will, zieht sie im Anordnen-Modus. */
  var k={}, x=0, y=0, zeile=0;
  _AB_KACHELN.forEach(function(t){
    /* 🔴 26.08.2026: `hoch` gibt einer Kachel mehr Standardhöhe. Katalog trägt
       seit Ralphs Umbau sechs Zeilen plus die grosse Zahl — bei 270 px wurde
       „ohne Quelle" und „EAN fehlt" unten abgeschnitten (im Browser gesehen). */
    var b=t.breit?590:285, h=_AB_HOEHE+(t.hoch?70:0);
    if(x+b>_AB_LW){ x=0; y+=zeile+20; zeile=0; }
    k[t.id]={x:x, y:y, b:b, h:h, z:1};
    x+=b+20; zeile=Math.max(zeile,h);
  });
  return k;
}

/* Die wirksame Lage einer Kachel: gespeichert, sonst hergeleitet. Einzelne
   fehlende Werte werden einzeln ergaenzt - eine halb gespeicherte Lage darf
   nicht die ganze Kachel auf 0,0 werfen. */
function _abLage(id, e, std){
  var s=(std||_abStandardLagen())[id]||{x:0,y:0,b:285,h:250,z:1};
  e=e||{};
  return {
    x:(e.x==null?s.x:e.x), y:(e.y==null?s.y:e.y),
    b:Math.max(_AB_MINB,(e.b==null?s.b:e.b)),
    h:Math.max(_AB_MINH,(e.h==null?s.h:e.h)),
    z:(e.z==null?s.z:e.z)
  };
}

/* Nimmt eine gespeicherte Anordnung an und gibt einen BERICHT zurueck, statt
   still zu schlucken, was nicht passt. Der Bericht ist der Beleg dafuer, dass
   Regel 2 und 3 gegriffen haben. */
function _abLayoutSetzen(cfg){
  var bericht={uebernommen:0, unbekannt:[], ergaenzt:[], eigene:0, name:''};
  var liste=(cfg&&cfg.kacheln)||[];
  if(!liste.length){ _AB_LAYOUT=null; return bericht; }
  var bekannt={};
  _AB_KACHELN.forEach(function(x){ bekannt[x.id]=true; });
  var rein=[], gesehen={};
  liste.forEach(function(e,i){
    if(!e||!e.id) return;
    /* Eine id, die der Code nicht kennt, ist nur dann Unrat, wenn sie auch
       keinen bekannten TYP traegt. Mit Typ ist es eine selbst angelegte
       Kachel - die MUSS durchkommen, sonst loescht das Laden sie weg. */
    var eigen=(!bekannt[e.id] && e.typ && _AB_TYPEN[e.typ]);
    if(!bekannt[e.id] && !eigen){ bericht.unbekannt.push(String(e.id)); return; }
    if(gesehen[e.id]) return;
    gesehen[e.id]=true;
    if(eigen) bericht.eigene++;
    rein.push({
      id:e.id,
      typ:(eigen?e.typ:null),
      titel:(eigen?(e.titel||_AB_TYPEN[e.typ].titel):null),
      reihe:(e.reihe==null?null:Number(e.reihe)),
      pos:(e.pos==null?i:Number(e.pos)),
      breit:(e.breit==null?null:!!e.breit),
      aus:!!e.aus,
      sperre:!!e.sperre,
      text:(typeof e.text==='string'?e.text:null),
      reihe_id:(e.reihe_id||null), quelle:(e.quelle||null), anzahl:_abLayoutZahl(e.anzahl),
      /* inhalt reist mit, auch wenn diese Fassung damit nichts anfangen kann —
         eine gespeicherte Auswahl darf nicht verlorengehen, nur weil sie
         gerade niemand liest. */
      inhalt:(Array.isArray(e.inhalt)?e.inhalt.slice():null),
      /* Freie Lage: x/breite in logischen Einheiten (0.._AB_LW), y/hoehe in
         Bildpunkten, z fuer „was liegt oben". Fehlt eine davon, rechnet
         _abLage() sie aus der Standardaufteilung aus — nie geraten, nur
         hergeleitet, und immer sichtbar (§3.4). */
      x:_abLayoutZahl(e.x), y:_abLayoutZahl(e.y), b:_abLayoutZahl(e.b), h:_abLayoutZahl(e.h), z:_abLayoutZahl(e.z)
    });
  });
  _AB_KACHELN.forEach(function(x){ if(!gesehen[x.id]) bericht.ergaenzt.push(x.id); });
  bericht.uebernommen=rein.length;
  bericht.name=(cfg&&cfg.name)||'';
  _AB_LAYOUT = rein.length ? {name:bericht.name, kacheln:rein} : null;
  return bericht;
}

/* ALLE sichtbaren Kacheln mit ihrer Lage, von hinten nach vorn sortiert.
   Das ist ab jetzt die EINE Liste, aus der gezeichnet wird - es gibt keine
   Reihen mehr, nur noch Lagen. */
function _abKachelFlaeche(){
  var std=_abStandardLagen(), konf={};

  /* 🔴 26.08.2026, IM BROWSER GESEHEN, nicht vermutet. Nach Ralphs Umbau von
     elf auf drei Kacheln stand links die halbe Fläche leer, Katalog war unten
     abgeschnitten und „Nutzer & Regionen" lag 680 Pixel tief — Ralph musste
     scrollen. Ursache: das GESPEICHERTE Layout gewinnt über das Register, und
     darin standen die drei verbliebenen Kacheln noch auf ihren alten Plätzen
     zwischen acht inzwischen entfernten.
     REGEL: passt das gespeicherte Layout nicht mehr zum Register, wird es für
     die Anzeige ignoriert und die Standardlagen gelten. Gelöscht wird es NICHT
     — wer die alten Kacheln zurückholt, hat seine Anordnung wieder. */
  var layoutPasst=true;
  if(_AB_LAYOUT && _AB_LAYOUT.kacheln){
    layoutPasst=_AB_LAYOUT.kacheln.every(function(e){
      if(!e || e.aus || e.typ) return true;              /* aus oder selbst angelegt */
      return _AB_KACHELN.some(function(x){ return x.id===e.id; });
    });
    if(!layoutPasst){ try{ console.info('[Dashboard] Gespeichertes Layout passt '
      +'nicht mehr zum Kachelsatz — Standardlagen gelten.'); }catch(_){} }
  }
  if(_AB_LAYOUT && layoutPasst) _AB_LAYOUT.kacheln.forEach(function(e){ konf[e.id]=e; });

  /* 🔴 20.08.2026, Work #121 Kriterium 2 — GEMESSENER FEHLER, nicht vermutet.
     Ein gespeichertes Layout ist immer AELTER als das Register. Kacheln, die
     nach dem Speichern dazukamen, hatten bis heute ihre Code-Standardlage —
     und die liegt auf einem Platz, den das gespeicherte Layout laengst anders
     vergeben hat. Gemessen am echten Layout „Standard 15.08." aus der Ablage
     (Work #44): `marke` lag genau auf `frei`. Zwei Kacheln uebereinander, und
     niemand haette den Grund gesehen.
     Ab jetzt bekommen ergaenzte Kacheln einen Platz UNTERHALB von allem
     Gespeicherten — dieselbe Regel, nach der _abKachelNeu eine neue Kachel
     ablegt. Ohne gespeichertes Layout aendert sich nichts: dann gelten die
     Standardlagen wie bisher. */
  var nachtrag={};
  if(_AB_LAYOUT && layoutPasst){
    var unten=0;
    _AB_LAYOUT.kacheln.forEach(function(e){
      if(e.aus) return;
      var l=_abLage(e.id, e, std);
      unten=Math.max(unten, l.y+l.h);
    });
    var xLauf=0, zeileY=unten? unten+20 : 0, zeileH=0;
    _AB_KACHELN.forEach(function(x){
      if(konf[x.id]) return;                          /* steht im Layout */
      var s=std[x.id]||{b:285,h:250};
      var b=Math.max(_AB_MINB, s.b), h=Math.max(_AB_MINH, s.h);
      if(xLauf+b>_AB_LW){ xLauf=0; zeileY+=zeileH+20; zeileH=0; }
      nachtrag[x.id]={x:xLauf, y:zeileY, b:b, h:h, z:1};
      xLauf+=b+20; zeileH=Math.max(zeileH,h);
    });
  }

  var raus=[];
  _AB_KACHELN.forEach(function(x,i){
    var e=konf[x.id] || nachtrag[x.id];
    if(e&&e.aus) return;                              /* ausgeblendet */
    var lage=_abLage(x.id, e, std);
    var k=x;
    if(e&&e.inhalt) k={id:x.id,titel:x.titel,bau:x.bau,roh:x.roh,waehlbar:x.waehlbar,
                       reihe:x.reihe,breit:x.breit,inhalt:e.inhalt};
    raus.push({k:k, lage:lage, i:i});
  });
  /* Dazu die selbst angelegten. Sie stehen NUR im Layout, nicht im Code. */
  if(_AB_LAYOUT) _AB_LAYOUT.kacheln.forEach(function(e,j){
    if(!e.typ || e.aus) return;
    var t=_AB_TYPEN[e.typ]; if(!t) return;
    if(_AB_KACHELN.some(function(x){ return x.id===e.id; })) return;
    raus.push({
      k:{id:e.id, typ:e.typ, titel:e.titel||t.titel, bau:t.bau,
         waehlbar:t.waehlbar, inhalt:e.inhalt, text:e.text, eigen:true,
         /* 🔴 NICHT `reihe`: das Feld traegt bei den Code-Kacheln die Reihennummer
            aus dem alten Raster. Beide Bedeutungen auf einem Namen — der erste
            Testlauf hat genau das gemeldet (T15m), weil die gespeicherte Reihe
            beim Rundlauf verschwand. Zwei Bedeutungen, zwei Namen. */
         reihe_id:e.reihe_id, quelle:e.quelle, anzahl:e.anzahl},
      lage:_abLage(e.id, e, std), i:1000+j});
  });
  /* Kleines z zuerst zeichnen; bei Gleichstand entscheidet die Registerfolge,
     damit die Reihenfolge nie zufaellig ist. */
  raus.sort(function(a,b){ return (a.lage.z-b.lage.z)||(a.i-b.i); });
  return raus;
}




/* ============================================================================
   ANORDNEN-MODUS  ·  Work #42, Etappe 5  ·  15.08.2026
   ----------------------------------------------------------------------------
   Ralph bedient, die Wirkung gilt fuer alle Admins (Entscheid C). Hier steht
   die BEDIENUNG; die Ablage kommt aus Work #44 und wird in E4 angeschlossen.

   Bis dahin wirkt eine Aenderung nur in der offenen Sitzung. Das steht in der
   Leiste als Satz, nicht im Kleingedruckten — ein Editor, der so tut, als haette
   er gespeichert, ist schlimmer als einer ohne Speicherknopf.

   🔴 Ausblenden ist KEINE Sackgasse: ausgeblendete Kacheln stehen mit Namen in
   der Leiste und lassen sich einzeln zurueckholen. Sonst waere „aus" ein Knopf,
   den man nur einmal druecken kann — und die Kachel gilt als verloren.
   ========================================================================== */
var _AB_EDIT=false;
var _AB_VORHER=null;   /* Stand beim Betreten, fuer „Verwerfen" */
var _AB_VARIANTEN=[];  /* [{name,standard}] aus der Datenbank */
var _AB_VARNAME='';    /* Name der gerade geladenen Variante */
var _AB_GELADEN=false; /* Riegel: einmal holen, nicht bei jedem Neuzeichnen */
var _AB_MELDUNG='';    /* letzter Satz fuer die Leiste — Erfolg UND Fehler */
var _AB_MAUS=false;    /* Fenster-Zuhoerer genau einmal anmelden */
var _AB_BEWEGEN=null, _AB_LOS=null;

/* ============================================================================
   ABLAGE ANSCHLIESSEN  ·  Work #42, Etappe 4  ·  15.08.2026
   ----------------------------------------------------------------------------
   §22 hat sich zum vierten Mal ausgezahlt: die Serverseite war schon da.
   ChatGPT hatte zu Work #44 geliefert — Tabelle dashboard_layout_variant plus
   cb_admin_dashboard_layout_standard() · _varianten() · _speichern(). Es fehlte
   genau ein Weg: eine BENANNTE Variante lesen. Den hat Claude als exakte
   Schwester von _standard() ergaenzt (Migration dashboard_layout_variante_laden),
   Hinweis dazu steht in Work #44.

   Gespeichert wird immer als STANDARD — Ralphs Entscheid C: er bedient, und was
   er anpasst, sehen alle Admins. Eine Variante, die niemand sieht, waere ein
   viertes Layout an einem fuenften Ort.

   🔴 Faellt das Laden aus, bleibt die Codereihenfolge stehen und der Grund steht
   IN der Leiste. Ein Dashboard, das wegen einer fehlgeschlagenen Abfrage leer
   oder wahllos sortiert erscheint, waere schlimmer als eines ohne Ablage.
   ========================================================================== */
async function _abLayoutHolen(){
  if(_AB_GELADEN) return;
  _AB_GELADEN=true;                        /* vor dem await, sonst laufen zwei */
  try{
    var r=await client.rpc('cb_admin_dashboard_layout_standard');
    if(r.error) throw r.error;
    var cfg=r.data; if(typeof cfg==='string') cfg=JSON.parse(cfg);
    if(cfg&&cfg.kacheln&&cfg.kacheln.length){
      var b=_abLayoutSetzen(cfg);
      _AB_VARNAME=b.name||'';
      _AB_MELDUNG='Layout „'+(_AB_VARNAME||'ohne Namen')+'" geladen'
        +(b.unbekannt.length?' · '+b.unbekannt.length+' unbekannte übergangen ('+b.unbekannt.join(', ')+')':'')
        +(b.ergaenzt.length?' · '+b.ergaenzt.length+' neue hinten angehängt':'');
      _abNeuZeichnen();
    }
  }catch(e){
    _AB_MELDUNG='⚠ Gespeichertes Layout nicht ladbar — es gilt die Standardanordnung. '
      +esc((e&&e.message)||String(e));
    try{ console.warn('[Layout] laden:',e); }catch(_){}
  }
  _abVariantenHolen();
}

async function _abVariantenHolen(){
  try{
    var r=await client.rpc('cb_admin_dashboard_layout_varianten');
    if(r.error) throw r.error;
    var v=r.data; if(typeof v==='string') v=JSON.parse(v);
    _AB_VARIANTEN=(v&&v.rows)||[];
    if(_AB_EDIT) _abNeuZeichnen();
  }catch(e){ try{ console.warn('[Layout] Varianten:',e); }catch(_){} }
}

async function _abVarianteWaehlen(name){
  if(!name) return;
  try{
    var r=await client.rpc('cb_admin_dashboard_layout_laden',{p_name:name});
    if(r.error) throw r.error;
    var cfg=r.data; if(typeof cfg==='string') cfg=JSON.parse(cfg);
    if(!cfg){ _AB_MELDUNG='❌ Variante „'+name+'" gibt es nicht (mehr).'; }
    else{
      _abMerken();                       /* auch ein Variantenwechsel ist EIN Zug */
      var b=_abLayoutSetzen(cfg);
      _AB_VARNAME=b.name||name;
      _AB_MELDUNG='Variante „'+_AB_VARNAME+'" geladen — noch nicht gespeichert.';
    }
  }catch(e){ _AB_MELDUNG='❌ '+((e&&e.message)||String(e)); }
  _abNeuZeichnen();
}

async function _abLayoutSpeichern(){
  var el=document.getElementById('abVarName');
  var name=((el&&el.value)||'').trim()||_AB_VARNAME||'Standard';
  var kacheln=_abLayoutAktuell().kacheln;
  var knopf=document.querySelector('[data-abe="speichern"]');
  if(knopf){ knopf.disabled=true; knopf.textContent='… speichert'; }
  try{
    var r=await client.rpc('cb_admin_dashboard_layout_speichern',
      {p_name:name, p_kacheln:kacheln, p_als_standard:true});
    if(r.error) throw r.error;
    _AB_VARNAME=name;
    _AB_MELDUNG='✅ „'+name+'" gespeichert · '+kacheln.length+' Kacheln · gilt für alle Admins.';
  }catch(e){
    /* Kein Schein-Erfolg: der Fehler steht im Klartext da, wo gedrueckt wurde. */
    _AB_MELDUNG='❌ NICHT gespeichert: '+((e&&e.message)||String(e));
    try{ console.error('[Layout] speichern:',e); }catch(_){}
  }
  await _abVariantenHolen();
  _abNeuZeichnen();
}

function _abEditRahmen(x){
  var g=_abGesperrt(x.id);
  return {
    klasse:' bedit'+(_abGewaehlt(x.id)?' bwahl':'')+(g?' bfest':''),
    attr:'',
    vor:'<div class="abedit" data-zieh="'+esc(x.id)+'" title="Zum Verschieben hier anfassen">'
      +'<span class="abgriff">⠿</span>'
      +(x.eigen
         ? '<input class="abetitel" data-abtitel="'+esc(x.id)+'" value="'+esc(x.titel)+'" '
           +'title="Überschrift ändern">'
         : '<span class="abename">'+x.titel+'</span>')
      +'<span class="abesp">'
      +'<button type="button" class="abeb" data-abe="sperre" data-kid="'+esc(x.id)+'" '
        +'title="'+(g?'Kachel wieder freigeben':'Kachel festnageln, damit sie nicht verrutscht')+'">'
        +(g?'🔒':'🔓')+'</button>'
      +(x.eigen
         ? '<button type="button" class="abeb" data-abe="kopie" data-kid="'+esc(x.id)+'" '
           +'title="Kachel duplizieren">⧉</button>'
         : '')
      +'<button type="button" class="abeb" data-abe="vor" data-kid="'+esc(x.id)+'" '
        +'title="nach vorn holen">▲</button>'
      +'<button type="button" class="abeb" data-abe="zurueck" data-kid="'+esc(x.id)+'" '
        +'title="nach hinten legen">▼</button>'
      /* Zwei verschiedene Knoepfe, weil es zwei verschiedene Dinge sind. */
      +(x.eigen
         ? '<button type="button" class="abeb weg" data-abe="weg" data-kid="'+esc(x.id)+'" '
           +'title="Diese selbst angelegte Kachel löschen">🗑</button>'
         : '<button type="button" class="abeb" data-abe="aus" data-kid="'+esc(x.id)+'" '
           +'title="Ausblenden — die Kachel gehört zur App und bleibt oben abrufbar">✕</button>')
      +'</span></div>'
      +'<i class="abziehe" data-groesse="'+esc(x.id)+'" title="Größe ziehen"></i>'
  };
}

/* ============================================================================
   AUSWAHL, TASTATUR, DUPLIZIEREN, SPERREN  ·  Work #52, Stufe D3  ·  15.08.2026
   ----------------------------------------------------------------------------
   Vier Dinge in EINEM Durchgang, weil alle vier an derselben Sache haengen:
   an der Frage „welche Kachel ist gemeint". Getrennt gebaut waere es dreimal
   derselbe Umbau (§2.2).

     · Auswaehlen: Klick auf den Kachelkopf. Mit Umschalt kommt eine dazu.
     · Tastatur:   Pfeiltasten schieben die Auswahl, mit Umschalt fein.
     · Duplizieren: nur EIGENE Kacheln. Eine Code-Kachel zweimal zu zeigen
       hiesse, dieselbe Zahl an zwei Orten zu haben (§4.2) — das ist genau der
       Fehler, den dieses Projekt seit Wochen jagt.
     · Sperren: eine fertig gelegte Kachel laesst sich festnageln, damit sie
       beim Arbeiten an der Nachbarin nicht verrutscht.
   ========================================================================== */
var _AB_WAHL=[];

/* 🔴 Kennung fuer eine neue Kachel. Der Zaehler ist NICHT Zierde: die erste
   Fassung nahm nur Date.now(), und beim Duplizieren im selben Millisekundenwert
   bekam die Kopie DIESELBE Kennung wie das Original — der Doppelte-Filter warf
   sie sofort wieder weg. Sichtbar war nur „der Knopf tut nichts". Gefunden vom
   Ablauftest T13k, nicht beim Ausprobieren. */
var _AB_ID_ZAEHLER=0;
function _abNeueId(){ return 'k'+Date.now().toString(36)+'-'+(++_AB_ID_ZAEHLER); }

function _abWahlSetzen(id, dazu){
  if(!id){ _AB_WAHL=[]; return; }
  if(!dazu){ _AB_WAHL=[id]; return; }
  var i=_AB_WAHL.indexOf(id);
  if(i>=0) _AB_WAHL.splice(i,1); else _AB_WAHL.push(id);
}
function _abGewaehlt(id){ return _AB_WAHL.indexOf(id)>=0; }

/* Gesperrt heisst: nicht schieben, nicht ziehen, nicht mit den Pfeiltasten
   bewegen. Ausblenden und Loeschen bleiben moeglich — eine Sperre gegen das
   Verrutschen ist keine Sperre gegen das Aufraeumen. */
function _abGesperrt(id){
  if(!_AB_LAYOUT) return false;
  var e=_AB_LAYOUT.kacheln.filter(function(k){ return k.id===id; })[0];
  return !!(e&&e.sperre);
}
function _abSperreUm(id){
  _abEditAendern(function(l,find){ var e=find(id); if(e) e.sperre=!e.sperre; });
}

/* Die Auswahl um einen Betrag verschieben — ein Zug fuer ALLE ausgewaehlten,
   nicht einer je Kachel. Sonst braeuchte man fuenf Mal Rueckgaengig fuer
   einen Tastendruck. */
function _abWahlSchieben(dx, dy){
  var ids=_AB_WAHL.filter(function(id){ return !_abGesperrt(id); });
  if(!ids.length) return false;
  /* 🔴 Erst rechnen, dann aendern. Am Rand bewegt sich nichts mehr — dann darf
     auch kein Zug auf den Rueckgaengig-Stapel wandern. Sonst druecken zehn
     Tastendruecke am Rand zehn Schritte auf den Stapel, die alle nichts
     rueckgaengig machen, und der Nutzer haelt „zurueck" fuer kaputt. */
  var ziel={}, aendert=false;
  ids.forEach(function(id){
    var lage=_abLage(id, (_AB_LAYOUT&&_AB_LAYOUT.kacheln.filter(function(k){return k.id===id;})[0])||null);
    var nx=Math.max(0, Math.min(_AB_LW-lage.b, lage.x+dx));
    var ny=Math.max(0, lage.y+dy);
    ziel[id]={x:nx, y:ny};
    if(nx!==lage.x||ny!==lage.y) aendert=true;
  });
  if(!aendert) return false;
  _abEditAendern(function(l,find){
    ids.forEach(function(id){
      var e=find(id); if(!e||!ziel[id]) return;
      e.x=ziel[id].x; e.y=ziel[id].y;
    });
  });
  return true;
}

/* Duplizieren. Der Zwilling liegt leicht versetzt — genau uebereinander waere
   er unsichtbar, und man haelt den Knopf fuer kaputt. */
function _abDuplizieren(id){
  var q=_abKachelFlaeche().filter(function(e){ return e.k.id===id; })[0];
  if(!q){ return; }
  if(!q.k.eigen){
    _AB_MELDUNG='Nur selbst angelegte Kacheln lassen sich duplizieren — eine Kachel der App zweimal zu zeigen hieße, dieselbe Zahl an zwei Orten zu führen.';
    _abNeuZeichnen(); return;
  }
  _abMerken();
  var cfg=_abLayoutAktuell();
  var alt=cfg.kacheln.filter(function(e){ return e.id===id; })[0];
  var neu=_abTief(alt);
  neu.id=_abNeueId();
  neu.titel=(alt.titel||'Kachel')+' (Kopie)';
  neu.x=Math.min(_AB_LW-neu.b, neu.x+20); neu.y=neu.y+20;
  neu.sperre=false;
  cfg.kacheln.push(neu);
  _abLayoutSetzen(cfg);
  _abWahlSetzen(neu.id,false);
  _AB_MELDUNG='Kopie angelegt — noch nicht gespeichert.';
  _abNeuZeichnen();
}

/* Eine Lage aendern. Laeuft ueber dieselbe eine Spur wie alles andere. */
function _abLageSetzen(id, neu){
  if(_abGesperrt(id)) return;
  _abEditAendern(function(l,find){
    var e=find(id); if(!e) return;
    if(neu.x!=null) e.x=Math.max(0, Math.round(neu.x/_AB_RASTER)*_AB_RASTER);
    if(neu.y!=null) e.y=Math.max(0, Math.round(neu.y/_AB_RASTERY)*_AB_RASTERY);
    if(neu.b!=null) e.b=Math.max(_AB_MINB, Math.min(_AB_LW,
                       Math.round(neu.b/_AB_RASTER)*_AB_RASTER));
    if(neu.h!=null) e.h=Math.max(_AB_MINH, Math.round(neu.h/_AB_RASTERY)*_AB_RASTERY);
    if(neu.z!=null) e.z=neu.z;
  });
}

/* ============================================================================
   EINRASTEN AN NACHBARN  ·  Work #52, Stufe D2  ·  15.08.2026
   ----------------------------------------------------------------------------
   Bisher fing eine Kachel nur am 10er-Raster. Buendige Kanten entstanden damit
   nur zufaellig: zwei Kacheln konnten 10 Einheiten versetzt stehen und sahen
   schief aus, obwohl beide „im Raster" lagen.

   Jetzt sucht die gezogene Kachel waehrend der Bewegung nach Kanten der
   ANDEREN Kacheln und faengt daran. Gefangen wird an:
     · linker Kante, Mitte, rechter Kante   (waagerecht)
     · Oberkante, Mitte, Unterkante         (senkrecht)
     · den beiden Raendern der Flaeche
     · und an „Kante an Kante" — rechte Kante der einen auf linke der anderen,
       damit zwei Kacheln buendig nebeneinander sitzen statt mit 3 Einheiten Luft.

   Die gefundene Linie wird ANGEZEIGT. Ein Fang, den man nicht sieht, fuehlt
   sich wie ein Ruckeln an; erst die Linie macht daraus eine Hilfe.
   ========================================================================== */
var _AB_FANG=14;    /* logische Einheiten, in denen gefangen wird */
var _AB_FANGY=10;   /* Bildpunkte senkrecht */

/* Liefert die korrigierte Lage und die Linien, die dabei getroffen wurden.
   Reine Rechnung, kein DOM — deshalb pruefbar. */
function _abFangen(id, n, andere){
  andere=andere||_abKachelFlaeche().filter(function(e){ return e.k.id!==id; })
                                   .map(function(e){ return e.lage; });
  var xz=[0,_AB_LW], yz=[0];
  andere.forEach(function(g){
    xz.push(g.x, g.x+g.b/2, g.x+g.b);
    yz.push(g.y, g.y+g.h/2, g.y+g.h);
  });
  var lx=[], ly=[], erg={x:n.x, y:n.y, b:n.b, h:n.h};

  /* Waagerecht: die drei Kanten der bewegten Kachel gegen alle Ziele. */
  var kandidatenX=[{eigen:n.x, art:'l'}, {eigen:n.x+n.b/2, art:'m'}, {eigen:n.x+n.b, art:'r'}];
  var bestX=null;
  kandidatenX.forEach(function(k){
    xz.forEach(function(ziel){
      var d=Math.abs(k.eigen-ziel);
      if(d<=_AB_FANG && (!bestX || d<bestX.d)) bestX={d:d, ziel:ziel, art:k.art};
    });
  });
  if(bestX){
    erg.x = bestX.art==='l' ? bestX.ziel
          : bestX.art==='m' ? bestX.ziel-n.b/2
          : bestX.ziel-n.b;
    lx.push(bestX.ziel);
  }
  var kandidatenY=[{eigen:n.y, art:'o'}, {eigen:n.y+n.h/2, art:'m'}, {eigen:n.y+n.h, art:'u'}];
  var bestY=null;
  kandidatenY.forEach(function(k){
    yz.forEach(function(ziel){
      var d=Math.abs(k.eigen-ziel);
      if(d<=_AB_FANGY && (!bestY || d<bestY.d)) bestY={d:d, ziel:ziel, art:k.art};
    });
  });
  if(bestY){
    erg.y = bestY.art==='o' ? bestY.ziel
          : bestY.art==='m' ? bestY.ziel-n.h/2
          : bestY.ziel-n.h;
    ly.push(bestY.ziel);
  }
  erg.x=Math.max(0,erg.x); erg.y=Math.max(0,erg.y);
  return {x:erg.x, y:erg.y, b:erg.b, h:erg.h, linienX:lx, linienY:ly};
}

/* Dasselbe fuer das Ziehen an der Ecke: hier wandern nur rechte und untere
   Kante, die linke obere bleibt liegen. */
function _abFangenGroesse(id, n, andere){
  andere=andere||_abKachelFlaeche().filter(function(e){ return e.k.id!==id; })
                                   .map(function(e){ return e.lage; });
  var xz=[_AB_LW], yz=[];
  andere.forEach(function(g){ xz.push(g.x, g.x+g.b); yz.push(g.y, g.y+g.h); });
  var lx=[], ly=[], b=n.b, h=n.h, bd=null, hd=null;
  xz.forEach(function(ziel){
    var d=Math.abs((n.x+n.b)-ziel);
    if(d<=_AB_FANG && (bd===null||d<bd)){ bd=d; b=ziel-n.x; lx[0]=ziel; }
  });
  yz.forEach(function(ziel){
    var d=Math.abs((n.y+n.h)-ziel);
    if(d<=_AB_FANGY && (hd===null||d<hd)){ hd=d; h=ziel-n.y; ly[0]=ziel; }
  });
  return {x:n.x, y:n.y, b:Math.max(_AB_MINB,b), h:Math.max(_AB_MINH,h),
          linienX:lx.filter(function(v){return v!=null;}),
          linienY:ly.filter(function(v){return v!=null;})};
}

/* Neue Kachel. Sie landet UNTEN auf der Flaeche, nicht bei 0,0 - sonst
   verdeckt sie beim Anlegen alles und man haelt das Dashboard fuer kaputt. */
function _abKachelNeu(typ){
  typ=typ||'frei';
  var t=_AB_TYPEN[typ]; if(!t) return;
  var unten=0;
  _abKachelFlaeche().forEach(function(e){ unten=Math.max(unten, e.lage.y+e.lage.h); });
  _abMerken();
  var cfg=_abLayoutAktuell();
  cfg.kacheln.push({id:_abNeueId(), typ:typ, titel:t.titel, aus:false,
    x:0, y:unten+20, b:285, h:250, z:1,
    inhalt:(t.text?null:_AB_FREI_VORGABE.slice()),
    text:(t.text?'':null)});
  _abLayoutSetzen(cfg);
  _AB_MELDUNG='Neue Kachel unten auf der Fläche angelegt — noch NICHT gespeichert.';
  _abNeuZeichnen();
}

/* Loeschen gibt es NUR fuer selbst angelegte Kacheln. Eine Kachel aus dem Code
   kann man ausblenden; sie zu loeschen wuerde eine Funktion der App entfernen,
   und das entscheidet kein Layout. */
function _abKachelWeg(id){
  var eigen=_abKachelFlaeche().filter(function(e){ return e.k.id===id && e.k.eigen; })[0];
  if(!eigen){ _AB_MELDUNG='Diese Kachel gehört zur App und kann nur ausgeblendet werden (✕).';
    _abNeuZeichnen(); return; }
  var cfg=_abLayoutAktuell(), vorher=cfg.kacheln.length;
  cfg.kacheln=cfg.kacheln.filter(function(e){ return e.id!==id; });
  if(cfg.kacheln.length===vorher) return;
  _abMerken();
  _abLayoutSetzen(cfg);
  _AB_MELDUNG='Kachel gelöscht — noch nicht gespeichert. „Verwerfen" holt sie zurück.';
  _abNeuZeichnen();
}

function _abTitelSetzen(id, titel){
  titel=String(titel||'').trim();
  if(!titel) return;
  _abEditAendern(function(l,find){ var e=find(id); if(e&&e.typ) e.titel=titel; });
}

/* „nach vorn" heisst: eins ueber den hoechsten, der GERADE sichtbar ist.
   Nicht z+1 — sonst klettert eine Kachel nach zwei Klicks ueber alles,
   ohne dass man sieht, warum. */
function _abStapel(id, nachVorn){
  var l=_abKachelFlaeche();
  var werte=l.map(function(e){ return e.lage.z; });
  var hoch=Math.max.apply(null,[1].concat(werte));
  var tief=Math.min.apply(null,[1].concat(werte));
  _abLageSetzen(id, {z: nachVorn ? hoch+1 : tief-1});
}

/* Der aktuelle Zustand als Konfiguration — abgeleitet aus dem, was wirklich
   gezeichnet wird, nicht aus einer zweiten Buchfuehrung (§4.2). */
function _abLayoutAktuell(){
  var raus=[], drin={};
  _abKachelFlaeche().forEach(function(e,i){
    drin[e.k.id]=true;
    raus.push({id:e.k.id, reihe:e.k.reihe, pos:i, breit:!!e.k.breit, aus:false,
               typ:e.k.typ||null, titel:(e.k.eigen?e.k.titel:null),
               sperre:_abGesperrt(e.k.id), text:(e.k.text==null?null:e.k.text),
               reihe_id:(e.k.reihe_id||null), quelle:(e.k.quelle||null), anzahl:(e.k.anzahl||null),
               x:e.lage.x, y:e.lage.y, b:e.lage.b, h:e.lage.h, z:e.lage.z,
               inhalt:(e.k.inhalt&&e.k.inhalt.length)?e.k.inhalt.slice():null});
  });
  /* Ausgeblendete gehen NICHT verloren — sie behalten Reihe und Breite. */
  if(_AB_LAYOUT) _AB_LAYOUT.kacheln.forEach(function(e){
    if(drin[e.id]) return;
    var reg=_AB_KACHELN.filter(function(k){ return k.id===e.id; })[0];
    raus.push({id:e.id, reihe:(e.reihe==null?(reg?reg.reihe:1):e.reihe),
               pos:(e.pos==null?999:e.pos),
               breit:(e.breit==null?!!(reg&&reg.breit):e.breit), aus:true,
               typ:e.typ||null, titel:e.titel||null,
               sperre:!!e.sperre, text:(e.text==null?null:e.text),
               reihe_id:(e.reihe_id||null), quelle:(e.quelle||null), anzahl:(e.anzahl||null),
               x:e.x, y:e.y, b:e.b, h:e.h, z:e.z,
               inhalt:(e.inhalt&&e.inhalt.length)?e.inhalt.slice():null});
  });
  return {name:(_AB_LAYOUT&&_AB_LAYOUT.name)||'', kacheln:raus};
}

function _abAusgeblendet(){
  if(!_AB_LAYOUT) return [];
  return _AB_LAYOUT.kacheln.filter(function(e){ return e.aus; }).map(function(e){
    var reg=_AB_KACHELN.filter(function(k){ return k.id===e.id; })[0];
    return {id:e.id, titel:(reg?reg.titel:e.id)};
  });
}

function _abEditLeiste(){
  /* Eine WARNUNG darf nicht im Anordnen-Modus versteckt sein: wer die Leiste nie
     oeffnet, saehe sonst nie, dass sein gespeichertes Layout nicht geladen
     werden konnte (§1.7 keine stillen Fehler). */
  if(!_AB_EDIT){
    return (_AB_MELDUNG && /^[⚠❌]/.test(_AB_MELDUNG))
      ? '<div class="abeleiste" style="background:#fdf1f1;border-color:#f2cfcf">'+_AB_MELDUNG+'</div>'
      : '';
  }
  var weg=_abAusgeblendet();
  return '<div class="abeleiste">'
    +'<b>🧩 Anordnen</b>'
    +'<span style="color:'+_AB.mut+'">Kacheln ziehen · Breite umschalten · ausblenden. '
      +'<b>Gilt nur in dieser Sitzung</b> — die Ablage für alle Admins folgt (#44).</span>'
    +(weg.length
       ? '<span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
         +'<span style="color:'+_AB.mut+'">ausgeblendet:</span>'
         + weg.map(function(w){
             return '<button type="button" class="abeb hin" data-abe="ein" data-kid="'
               +esc(w.id)+'" title="wieder einblenden">+ '+w.titel+'</button>'; }).join('')
         +'</span>'
       : '')
    +(_AB_VARIANTEN.length>1
       ? '<select id="abVarWahl" class="abeb" title="gespeicherte Variante laden">'
         +'<option value="">– Variante laden –</option>'
         + _AB_VARIANTEN.map(function(v){
             return '<option value="'+esc(v.name)+'"'+(v.name===_AB_VARNAME?' selected':'')+'>'
               +esc(v.name)+(v.standard?' ★':'')+'</option>'; }).join('')
         +'</select>'
       : '')
    +'<input id="abVarName" class="abeb" style="font-weight:600;min-width:150px" '
      +'value="'+esc(_AB_VARNAME||'Standard')+'" '
      +'title="Name, unter dem gespeichert wird" placeholder="Name des Layouts">'
    +'<span class="abesp" style="margin-left:0">'
    +'<button type="button" class="abeb" data-abe="zurueck1"'
      +(_AB_ZURUECK.length?'':' disabled')
      +' title="Rückgängig (Strg+Z)">↶ zurück'
      +(_AB_ZURUECK.length?' <b>'+_AB_ZURUECK.length+'</b>':'')+'</button>'
    +'<button type="button" class="abeb" data-abe="vor1"'
      +(_AB_VOR.length?'':' disabled')
      +' title="Wiederherstellen (Strg+Umschalt+Z)">↷ vor'
      +(_AB_VOR.length?' <b>'+_AB_VOR.length+'</b>':'')+'</button>'
    +'</span>'
    +'<button type="button" class="abeb hin" data-abe="neu" data-typ="frei" '
      +'title="Kachel mit Zahlen anlegen — erscheint unten auf der Fläche">+ Zahlen</button>'
    +'<button type="button" class="abeb hin" data-abe="neu" data-typ="notiz" '
      +'title="Notizzettel anlegen — dein Text, mit dem Layout gespeichert">+ Notiz</button>'
    +'<button type="button" class="abeb hin" data-abe="neu" data-typ="verlauf" '
      +'title="Verlauf über Tage — zurzeit gibt es eine Reihe: Riki-Verbrauch">+ Verlauf</button>'
    +'<button type="button" class="abeb hin" data-abe="neu" data-typ="liste" '
      +'title="Liste aus einer vorhandenen Quelle: offene Aufgaben oder meldende Wächter">+ Liste</button>'
    +'<button type="button" class="abeb hin" data-abe="neu" data-typ="bild" '
      +'title="Bild über eine Adresse — Hochladen geht noch nicht">+ Bild</button>'
    +'<span class="abesp">'
    +'<button type="button" class="abeb" data-abe="standard" '
      +'title="Zurück auf die im Code hinterlegte Anordnung — noch nicht gespeichert">↺ Standard</button>'
    +'<button type="button" class="abeb" data-abe="verwerfen">Verwerfen</button>'
    +'<button type="button" class="abeb hin" data-abe="speichern" '
      +'title="Speichert als Standard — gilt sofort für alle Admins">💾 Speichern</button>'
    +'<button type="button" class="abeb" data-abe="fertig">✓ Fertig</button>'
    +'</span>'
    +(_AB_MELDUNG?'<div style="flex-basis:100%;font-size:11.5px;color:'+_AB.mut+'">'
       +_AB_MELDUNG+'</div>':'')
    +'</div>';
}

/* ============================================================================
   RUECKGAENGIG  ·  Work #52, Stufe D1  ·  15.08.2026
   ----------------------------------------------------------------------------
   Bis hierher gab es nur „Verwerfen" — alles oder nichts. Ein falsch gezogener
   Rahmen war damit nur zu beheben, indem man die ganze Sitzung wegwarf. Wer so
   arbeitet, probiert nichts aus, und genau das Ausprobieren ist der Sinn eines
   Editors.

   WIE ES FUNKTIONIERT, in einem Satz: vor jeder Aenderung wird der ganze
   Zustand als Kopie auf einen Stapel gelegt; „Rueckgaengig" nimmt die oberste
   Kopie zurueck und legt den aktuellen Stand auf den Gegenstapel.

   🔴 EIN ZUG PRO HANDGRIFF, nicht pro Bildpunkt. Beim Schieben wird die Lage
   erst beim LOSLASSEN eingetragen — sonst laegen nach einem Zug 200 Schritte
   auf dem Stapel und „Rueckgaengig" bewegte die Kachel um einen Pixel.

   NICHT gemerkt wird das erste Laden aus der Datenbank: sonst koennte man
   „hinter" den Ausgangszustand zurueckgehen, und das Dashboard stuende ohne
   das gespeicherte Layout da, das es gerade geholt hat.
   ========================================================================== */
var _AB_ZURUECK=[], _AB_VOR=[];
var _AB_STAPEL_MAX=40;   /* mehr braucht niemand, und der Speicher bleibt endlich */

function _abTief(x){ return x?JSON.parse(JSON.stringify(x)):null; }

/* Vor einer Aenderung aufrufen. Der Gegenstapel wird geleert: wer nach einem
   Rueckgaengig etwas Neues tut, hat den alten Weg verlassen. */
function _abMerken(){
  _AB_ZURUECK.push(_abTief(_abLayoutAktuell()));
  if(_AB_ZURUECK.length>_AB_STAPEL_MAX) _AB_ZURUECK.shift();
  _AB_VOR.length=0;
}

/* Modus umschalten. Steht als FUNKTION hier und nicht im Klick-Handler, weil
   an ihm zwei Dinge haengen, die man sonst nur durch Klicken pruefen koennte:
   der Verwerfen-Bezugspunkt und das Leeren der Stapel. Beim ersten Testlauf
   lagen deshalb 12 fremde Zuege auf dem Stapel — der Test hat den Bau
   korrigiert, nicht umgekehrt. */
function _abEditModus(an){
  an=!!an;
  if(an && !_AB_EDIT){
    _AB_VORHER=_abTief(_AB_LAYOUT);
    /* Der Stapel gehoert der Bearbeitung, nicht der Seite. Beim Oeffnen leer:
       sonst koennte man hinter den Zustand zurueckgehen, mit dem man angefangen
       hat, und „Verwerfen" und „Rueckgaengig" wuerden sich widersprechen. */
    _AB_ZURUECK.length=0; _AB_VOR.length=0; _AB_MELDUNG='';
  }
  _AB_EDIT=an;
  return _AB_EDIT;
}

function _abZurueck(){
  if(!_AB_ZURUECK.length){ _AB_MELDUNG='Nichts mehr rückgängig zu machen.'; _abNeuZeichnen(); return; }
  _AB_VOR.push(_abTief(_abLayoutAktuell()));
  _abLayoutSetzen(_AB_ZURUECK.pop());
  _AB_MELDUNG='Rückgängig — noch '+_AB_ZURUECK.length+' Schritt(e) zurück möglich.';
  _abNeuZeichnen();
}

function _abVor(){
  if(!_AB_VOR.length){ _AB_MELDUNG='Nichts zum Wiederherstellen.'; _abNeuZeichnen(); return; }
  _AB_ZURUECK.push(_abTief(_abLayoutAktuell()));
  _abLayoutSetzen(_AB_VOR.pop());
  _AB_MELDUNG='Wiederhergestellt.';
  _abNeuZeichnen();
}

/* Ein ganzer Layoutwechsel (Standard, Verwerfen, andere Variante) ist EIN Zug —
   auch er muss sich zurueckholen lassen, sonst ist ein Fehlgriff auf „Standard"
   genauso teuer wie vorher die ganze Sitzung. */
function _abLayoutWechsel(cfg, satz){
  _abMerken();
  _abLayoutSetzen(cfg);
  if(satz) _AB_MELDUNG=satz;
  _abNeuZeichnen();
}

/* Eine Aenderung, ein Weg: alles laeuft ueber _abLayoutSetzen und zeichnet neu. */
function _abEditAendern(fn){
  _abMerken();
  var cfg=_abLayoutAktuell();
  fn(cfg.kacheln, function(id){
    for(var i=0;i<cfg.kacheln.length;i++) if(cfg.kacheln[i].id===id) return cfg.kacheln[i];
    return null;
  });
  cfg.kacheln.forEach(function(e,i){ if(e.pos==null) e.pos=i; });
  _abLayoutSetzen(cfg);
  _abNeuZeichnen();
}

/* 15.08. ENTFERNT beim Umbau auf die freie Flaeche: _abKachelListe,
   _abReihe und _abEditVerschieben waren der RASTER-Zeichner (zwei Reihen,
   Plaetze tauschen). Sie hatten nach dem Umbau keinen Aufrufer mehr. Stehen
   lassen hiesse zwei Anordnungslogiken im selben Code (§4.2) - genau der
   Fehler, gegen den die Regel geschrieben ist.
   RUECKHOLBAR: der letzte Stand MIT diesen drei Funktionen ist Build
   2026-08-15-3040 und liegt im ausgelieferten Repo (git). Es wurde KEINE
   zusaetzliche Sicherungsdatei angelegt — das hier ist die Fundstelle. */

/* ============================================================================
   BEFEHLSZEILE · C4 · 15.08.2026, Work #63
   ----------------------------------------------------------------------------
   Ralph zum ersten Entwurf: „das einzige coole von dir ist der cursor, der ist
   aber ohne funktion." Hier hat er eine.

   🔴 SIE SPRINGT UEBER adminGo — den EINEN Weg in einen Adminbereich, den es
   schon gibt (§4.2, §22). Keine zweite Sprungtabelle: waere hier eine, wuerde
   sie beim naechsten neuen Bereich vergessen und zeigte ins Leere.
   Die Zahlen daneben kommen aus denselben Daten, die das Dashboard ohnehin
   geladen hat — keine zusaetzliche Abfrage.
   ========================================================================== */
function _abBefehle(d,np,A){
  var k=(d&&d.katalog)||{}, ex=(np&&np.extra)||{};
  var z=function(v){ return (v==null?'—':String(v)); };
  return [
    {b:'produkte',       t:'Produktliste — alle aktiven',          z:z(k.aktiv),      go:'produkte'},
    {b:'erfassen',       t:'Neues Produkt erfassen',               z:'—',             go:'produkterfassung'},
    {b:'zu verifizieren',t:'Posteingang: Entwürfe, Scans, Audit',  z:z(A&&A.wartend), go:'zuverif'},
    {b:'scan',           t:'Scan-Eingang',                         z:'—',             go:'scans'},
    {b:'stamm',          t:'Zutatenstamm — neu und alt',           z:z(ex.zutaten),   go:'stamm'},
    {b:'rezepte',        t:'Rezepte',                              z:z(ex.rezepte),   go:'rezepte'},
    {b:'regelwerk',      t:'Bewertungsregeln',                     z:'—',             go:'regelwerk'},
    {b:'empfehlungen',   t:'Empfehlungen',                         z:'—',             go:'empfehlungen'},
    {b:'dashboard',      t:'Zurück zur Übersicht',                 z:'—',             go:'dash'},
    {b:'anordnen',       t:'Kacheln schieben, Größe, anlegen',     z:'—',             go:'#anordnen'},
    {b:'aktualisieren',  t:'Zahlen neu holen',                     z:'—',             go:'#neu'}
  ];
}

function _abCmdHtml(){
  return '<div class="abcmd" id="abCmd">'
    +'<div class="abcmdz">'
      +'<span class="abcmdpf">root-index /</span>'
      +'<input id="abCmdIn" autocomplete="off" spellcheck="false" '
        +'placeholder="Bereich oder Befehl tippen …">'
      +'<span class="abcmdcur"></span>'
      +'<span class="abcmdkb">↑↓</span><span class="abcmdkb">⏎</span><span class="abcmdkb">⌘K</span>'
    +'</div>'
    +'<div class="abcmdl" id="abCmdListe"></div>'
  +'</div>';
}

var _AB_CMD_SEL=0;
function _abCmdNach(box){
  var cmd=document.getElementById('abCmd'), inp=document.getElementById('abCmdIn'),
      liste=document.getElementById('abCmdListe');
  if(!cmd||!inp||!liste) return;
  var alle=_abBefehle(_abD,_abNp,(_abNp&&typeof _abAbl==='function')?_abAbl(_abNp):null);
  var treffer=function(){
    var q=inp.value.trim().toLowerCase();
    if(!q) return alle.slice(0,6);
    return alle.filter(function(x){
      return x.b.indexOf(q)>=0 || x.t.toLowerCase().indexOf(q)>=0; });
  };
  var male=function(){
    var t=treffer();
    if(_AB_CMD_SEL>=t.length) _AB_CMD_SEL=Math.max(0,t.length-1);
    liste.innerHTML = t.length
      ? t.map(function(x,i){
          return '<div class="abcmdv'+(i===_AB_CMD_SEL?' sel':'')+'" data-go="'+esc(x.go)+'">'
            +'<span class="b">'+esc(x.b)+'</span><span class="t">'+esc(x.t)+'</span>'
            +'<span class="z">'+esc(x.z)+'</span></div>'; }).join('')
      : '<div class="abcmdv"><span class="t">Kein Befehl dazu — bekannt sind: '
        +esc(alle.map(function(x){ return x.b; }).join(', '))+'</span></div>';
    liste.querySelectorAll('.abcmdv[data-go]').forEach(function(e){
      e.onmousedown=function(ev){ ev.preventDefault(); fuehre(e.getAttribute('data-go')); };
    });
  };
  var fuehre=function(go){
    inp.value=''; _AB_CMD_SEL=0; cmd.classList.remove('auf'); inp.blur();
    try{
      if(go==='#anordnen'){ var an=document.getElementById('abAnordnen'); if(an) an.click(); return; }
      if(go==='#neu'){ var n=document.getElementById('abNeu'); if(n) n.click(); return; }
      /* Der EINE Weg in einen Adminbereich. Keine zweite Sprungtabelle. */
      if(typeof adminGo==='function') adminGo(go);
    }catch(e){ try{ console.warn('[Befehlszeile]',go,e); }catch(_){} }
  };
  inp.addEventListener('focus',function(){ cmd.classList.add('auf'); male(); });
  inp.addEventListener('blur', function(){ setTimeout(function(){ cmd.classList.remove('auf'); },130); });
  inp.addEventListener('input',function(){ _AB_CMD_SEL=0; male(); });
  inp.addEventListener('keydown',function(ev){
    var t=treffer();
    if(ev.key==='ArrowDown'){ ev.preventDefault(); _AB_CMD_SEL=Math.min(t.length-1,_AB_CMD_SEL+1); male(); }
    else if(ev.key==='ArrowUp'){ ev.preventDefault(); _AB_CMD_SEL=Math.max(0,_AB_CMD_SEL-1); male(); }
    else if(ev.key==='Enter'){ ev.preventDefault(); if(t[_AB_CMD_SEL]) fuehre(t[_AB_CMD_SEL].go); }
    else if(ev.key==='Escape'){ inp.value=''; inp.blur(); }
  });
  /* ⌘K bzw. Strg+K einmal am Fenster — nicht bei jedem Neuzeichnen neu. */
  if(!window._abCmdTaste){
    window._abCmdTaste=true;
    window.addEventListener('keydown',function(ev){
      if(!(ev.metaKey||ev.ctrlKey)) return;
      if(String(ev.key).toLowerCase()!=='k') return;
      var i=document.getElementById('abCmdIn'); if(!i) return;
      ev.preventDefault(); i.focus();
    });
  }
  male();
}

var _AB_PROJEKT_TIMER=null;
var _AB_BERLIN_FORMAT=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});

function _abBerlinTeile(wert){
  var o={};
  _AB_BERLIN_FORMAT.formatToParts(new Date(wert)).forEach(function(x){
    if(x.type!=='literal') o[x.type]=Number(x.value);
  });
  return {jahr:o.year,monat:o.month,tag:o.day,stunde:o.hour,minute:o.minute,sekunde:o.second};
}

function _abBerlinZeitpunkt(jahr,monat,tag,stunde,minute,sekunde){
  var soll=Date.UTC(jahr,monat-1,tag,stunde,minute,sekunde), utc=soll;
  for(var i=0;i<3;i++){
    var p=_abBerlinTeile(utc);
    utc+=soll-Date.UTC(p.jahr,p.monat-1,p.tag,p.stunde,p.minute,p.sekunde);
  }
  return new Date(utc);
}

function _abProjektzeitWerte(jetzt){
  var nun=jetzt==null?new Date():new Date(jetzt);
  var ziel=_abBerlinZeitpunkt(2026,10,1,0,0,0);
  var rest=ziel-nun, countdown='LIVE';
  if(rest>0){
    var gesamtMinuten=Math.ceil(rest/60000);
    var tage=Math.floor(gesamtMinuten/1440);
    var stunden=Math.floor((gesamtMinuten%1440)/60);
    var minuten=gesamtMinuten%60;
    countdown=tage+' Tage · '+stunden+' Std · '+minuten+' Min';
  }
  var heute=_abBerlinTeile(nun);
  var projekttage=Math.max(0,Math.round(
    (Date.UTC(heute.jahr,heute.monat-1,heute.tag)-Date.UTC(2026,5,25))/86400000
  ));
  return {countdown:countdown,projekttage:projekttage,
    projektText:projekttage+' '+(projekttage===1?'Tag':'Tage')};
}

function _abProjektzeitHtml(){
  var z=_abProjektzeitWerte();
  return '<div class="abprojektzeit" aria-label="Projektzeit">'
    +'<div class="abpk go"><span class="abl">GO-LIVE</span><strong id="abGoLive">'
      +z.countdown+'</strong><small>01.10.2026 · 00:00 Berlin</small></div>'
    +'<div class="abpk"><span class="abl">PROJEKT</span><strong id="abProjektTage">'
      +z.projektText+'</strong><small>seit 25.06.2026</small></div>'
    +'</div>';
}

function _abProjektzeitRender(jetzt){
  var z=_abProjektzeitWerte(jetzt);
  var go=document.getElementById('abGoLive'); if(go) go.textContent=z.countdown;
  var pr=document.getElementById('abProjektTage'); if(pr) pr.textContent=z.projektText;
  return z;
}

function _abProjektzeitStart(){
  _abProjektzeitRender();
  if(_AB_PROJEKT_TIMER!==null) return;
  _AB_PROJEKT_TIMER=setInterval(function(){
    if(!document.getElementById('abGoLive')){
      clearInterval(_AB_PROJEKT_TIMER); _AB_PROJEKT_TIMER=null; return;
    }
    _abProjektzeitRender();
  },60000);
}

/* ============================================================================
   MEILENSTEIN-ZEITLEISTE BIS GO-LIVE · C5 · 15.08.2026, Work #63
   ----------------------------------------------------------------------------
   Ralph-Entscheid: „energie strom weg" — der Ereignisstrom faellt weg. Statt
   der letzten Stunde zeigt die Leiste den WEG BIS GO-LIVE am 01.10.2026.

   🔴 EINE WAHRHEIT, ZWEI ANZEIGEN. Ein Meilenstein traegt hoechstens einen
   Verweis auf einen Wirkdiagramm-Knoten und einen auf ein Work Item. Der
   Fortschritt wird NICHT hier gepflegt — er steht dort. Wer ihn hier zusaetzlich
   fuehrt, hat zwei Listen, die auseinanderlaufen (§4.2, §28.4).

   Die Lage auf der Leiste ergibt sich aus dem DATUM, nicht aus einer gepflegten
   Position. Verschiebt Ralph ein Datum, wandert der Punkt mit.
   ========================================================================== */
var _AB_MEILEN=[], _AB_ZIEL='2026-10-01', _AB_MEILEN_EDIT=false;

function _abTag(d){ var t=new Date(d); return isNaN(t)?null:t; }
function _abDatDe(d){
  var t=_abTag(d); if(!t) return '—';
  return String(t.getDate()).padStart(2,'0')+'.'+String(t.getMonth()+1).padStart(2,'0')+'.';
}

function _abZeitHtml(){
  var ziel=_abTag(_AB_ZIEL)||new Date();
  var heute=new Date();
  /* Der Anfang der Leiste: der frueheste Meilenstein oder heute — je nachdem,
     was frueher ist. Sonst stuende ein ueberfaelliger Punkt ausserhalb. */
  var start=heute;
  _AB_MEILEN.forEach(function(m){ var t=_abTag(m.faellig); if(t&&t<start) start=t; });
  start=new Date(start.getFullYear(),start.getMonth(),1);
  var spanne=Math.max(1, ziel-start);
  var pos=function(d){ var t=_abTag(d); if(!t) return 0;
    return Math.max(0,Math.min(100, (t-start)/spanne*100)); };

  /* Monatsabschnitte */
  var monate='', m=new Date(start), i=0;
  while(m<=ziel && i<14){
    var naechster=new Date(m.getFullYear(),m.getMonth()+1,1);
    var a=pos(m), b=Math.min(100,pos(naechster>ziel?ziel:naechster));
    monate+='<div class="abzm" style="left:'+a.toFixed(2)+'%;width:'+(b-a).toFixed(2)+'%">'
      +'<span>'+m.toLocaleDateString('de-DE',{month:'short',year:'2-digit'}).toUpperCase()+'</span></div>';
    m=naechster; i++;
  }

  var offen=_AB_MEILEN.filter(function(x){ return !x.erledigt; }).length;
  var tage=Math.ceil((ziel-heute)/86400000);

  var punkte=_AB_MEILEN.map(function(x,n){
    var p=pos(x.faellig), spaet=(!x.erledigt && _abTag(x.faellig) && _abTag(x.faellig)<heute);
    return '<div class="abzp'+(x.erledigt?' ok':'')+(spaet?' spaet':'')
      +'" style="left:'+p.toFixed(2)+'%;top:'+(18+(n%3)*29)+'px" data-mid="'+x.id+'" '
      +'title="'+esc(x.titel)+' · '+_abDatDe(x.faellig)+(x.notiz?' — '+esc(x.notiz):'')+'">'
      +'<i></i><span>'+esc(x.titel)+'</span>'
      +(x.node_key?'<em>'+esc(x.node_key)+'</em>':'')
      +(x.work_id?'<em>#'+x.work_id+'</em>':'')
      +'</div>';
  }).join('');

  return '<div class="abzeit'+(_AB_MEILEN_EDIT?' bearb':'')+'" id="abZeit">'
    +'<div class="abzk">'
      +'<b>Weg bis Go-Live</b>'
      +'<span class="abzz">'+(tage>0?tage+' Tage':'Ziel erreicht')+' · '+offen+' offen</span>'
      +'<span class="abzsp">'
        +'<button type="button" class="abeb" data-mz="neu">+ Meilenstein</button>'
        +'<button type="button" class="abeb'+(_AB_MEILEN_EDIT?' hin':'')+'" data-mz="edit">'
          +(_AB_MEILEN_EDIT?'✓ fertig':'✎ bearbeiten')+'</button>'
      +'</span>'
    +'</div>'
    +'<div class="abzb">'
      + monate
      + _abZeitWolken(start, heute, pos)
      +'<div class="abzl"></div>'
      +'<div class="abzheute" style="left:'+pos(heute).toFixed(2)+'%"><span>HEUTE</span></div>'
      +'<div class="abzziel"><span>GO LIVE<br>'+_abDatDe(_AB_ZIEL)+'</span></div>'
      + punkte
    +'</div>'
  +'</div>';
}

/* Punktwolken in den vergangenen Abschnitten — wie in der Vorlage.
   🔴 SIE ZEIGEN KEINE DATEN und tun auch nicht so: keine Beschriftung, keine
   Zahl, sehr blass. Sie sind Struktur, damit die vergangenen Wochen nicht
   leer wirken. Punkte, die nach Daten AUSSEHEN, aber keine sind, waeren
   genau die Attrappe, gegen die dieses Projekt anschreibt. */
function _abZeitWolken(start, heute, pos){
  var a=pos(start), b=pos(heute);
  if(b-a<3) return '';
  var h='<div class="abzwolke" style="position:absolute;left:'+a.toFixed(2)+'%;width:'
    +(b-a).toFixed(2)+'%;top:0;bottom:0;pointer-events:none">';
  /* Feste Verteilung statt Zufall: sonst tanzen die Punkte bei jedem
     Neuzeichnen und man haelt es fuer Bewegung in den Daten. */
  var n=Math.min(90, Math.round((b-a)*2.2));
  for(var i=0;i<n;i++){
    var x=((i*37)%100), y=18+((i*53)%70);
    h+='<i style="left:'+x+'%;top:'+y+'%"></i>';
  }
  return h+'</div>';
}

async function _abZeitLaden(){
  try{
    var r=await client.rpc('cb_admin_meilensteine');
    if(r.error) throw r.error;
    var j=r.data; if(typeof j==='string') j=JSON.parse(j);
    _AB_MEILEN=(j&&j.rows)||[];
    if(j&&j.ziel) _AB_ZIEL=j.ziel;
  }catch(e){
    _AB_MEILEN=[];
    try{ console.warn('[Meilensteine]',e); }catch(_){}
  }
  var b=document.getElementById('abZeitBox');
  if(b){ b.innerHTML=_abZeitHtml(); _abZeitNach(b); }
}

function _abZeitNach(box){
  box.querySelectorAll('[data-mz]').forEach(function(b){
    b.addEventListener('click',function(){
      var w=b.getAttribute('data-mz');
      if(w==='edit'){ _AB_MEILEN_EDIT=!_AB_MEILEN_EDIT;
        box.innerHTML=_abZeitHtml(); _abZeitNach(box); return; }
      if(w==='neu'){
        var t=window.prompt('Was ist der Meilenstein?'); if(!t) return;
        var d=window.prompt('Bis wann? (TT.MM.JJJJ)','30.09.2026'); if(!d) return;
        var m=String(d).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if(!m){ alert('Datum bitte als TT.MM.JJJJ'); return; }
        _abMeilenSetzen(null,{titel:t,
          faellig:m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')});
      }
    });
  });
  /* Ein Klick auf einen Punkt hakt ihn ab — aber NUR im Bearbeiten-Modus.
     Sonst wuerde ein Fehlklick beim Lesen den Plan aendern. */
  box.querySelectorAll('.abzp[data-mid]').forEach(function(e){
    e.addEventListener('click',function(){
      if(!_AB_MEILEN_EDIT) return;
      var id=Number(e.getAttribute('data-mid'));
      var m=_AB_MEILEN.filter(function(x){ return Number(x.id)===id; })[0];
      if(!m) return;
      _abMeilenSetzen(id,{erledigt:!m.erledigt});
    });
  });
}

async function _abMeilenSetzen(id, feld){
  try{
    var r=await client.rpc('cb_admin_meilenstein_setzen',{
      p_id:id, p_titel:(feld.titel==null?null:feld.titel),
      p_faellig:(feld.faellig==null?null:feld.faellig),
      p_node_key:null, p_work_id:null,
      p_erledigt:(feld.erledigt==null?null:feld.erledigt),
      p_notiz:null, p_sortierung:null});
    if(r.error) throw r.error;
  }catch(e){
    try{ console.error('[Meilenstein] speichern:',e); }catch(_){}
    alert('Nicht gespeichert: '+((e&&e.message)||e));
  }
  await _abZeitLaden();
}

/* Hilfslinien zeichnen. Sie liegen IN der Flaeche und verschwinden mit dem
   Loslassen — sie sind Werkzeug, nicht Inhalt, und stehen deshalb in keiner
   Konfiguration. */
function _abHilfslinien(xs, ys){
  var f=document.getElementById('abFlaeche'); if(!f) return;
  f.querySelectorAll('.abhilf').forEach(function(e){ e.remove(); });
  (xs||[]).forEach(function(v){
    var i=document.createElement('i'); i.className='abhilf x';
    i.style.left=(v/_AB_LW*100)+'%'; f.appendChild(i);
  });
  (ys||[]).forEach(function(v){
    var i=document.createElement('i'); i.className='abhilf y';
    i.style.top=v+'px'; f.appendChild(i);
  });
}

/* Verdrahtung ALLES, was in den Bento-Reihen haengt. Wird beim Erstaufbau und
   nach jedem Neuzeichnen im Anordnen-Modus gerufen — dieselbe Fassung, nicht
   zwei (§4.2). innerHTML wirft die Handler weg, deshalb muss das so laufen. */
function _abBentoNach(box){
  box=box||document.getElementById('fgDash'); if(!box) return;

  box.querySelectorAll('.baufg[data-job]').forEach(function(j){
    j.addEventListener('click',function(){
      if(_AB_EDIT) return;                 /* im Anordnen-Modus wird nicht gesprungen */
      _abSprung(j.getAttribute('data-job'));
    });
  });
  /* Schnellzugriff: adminGo statt eigener Navigation — es gibt genau einen Weg
     in einen Adminbereich (§4.2). */
  box.querySelectorAll('.abschnell[data-go]').forEach(function(b){
    b.addEventListener('click',function(){
      if(_AB_EDIT) return;
      var k=b.getAttribute('data-go');
      try{ if(typeof adminGo==='function') adminGo(k); }
      catch(e){ try{ console.warn('Schnellzugriff:',k,e); }catch(_){} }
    });
  });

  /* Work #121: die sechs Schnellzugriffe aus dem Cockpit. Jeder Schluessel
     zeigt auf einen vorhandenen Weg — oder auf die Serverliste. */
  box.querySelectorAll('.abschnellv2[data-akey]').forEach(function(b){
    b.addEventListener('click',function(){
      if(_AB_EDIT) return;
      var w=_AB_SCHNELL_WEG[b.getAttribute('data-akey')];
      if(!w) return;
      try{
        if(w.go && typeof adminGo==='function') adminGo(w.go);
        else if(w.drill) _abDrillOeffnen(w.drill, w.drillTitel||'');
        else if(w.fn) w.fn();
      }catch(e){ try{ console.warn('Schnellzugriff:',b.dataset.akey,e); }catch(_){} }
    });
  });

  /* Work #121: die Linkliste kommt aus der ausgelieferten Datei Links.md.
     Sie laedt nach wie alles andere — eine Datei ueber das Netz zu holen darf
     den Kachelaufbau nicht aufhalten. */
  if(box.querySelector('#abLinks')) { try{ _abLinksLaden(); }
    catch(e){ try{ console.warn('[Links]',e); }catch(_){} } }

  /* 31.08.2026: Zutaten-Haertefaelle in der Entscheidungs-Kachel — laedt nach,
     gleicher Grundsatz wie Links und Karte: nichts blockiert den Aufbau. */
  if(box.querySelector('#abWaechterHF')) { try{ _abWaechterHFLaden(); }
    catch(e){ try{ console.warn('[WaechterHF]',e); }catch(_){} } }

  /* Work #121: jede Zahl mit drill_key oeffnet die Serverliste. EINE Stelle
     fuer alle Kacheln — der Anordnen-Modus zeichnet sie neu und ruft dieselbe
     Verdrahtung wieder auf. */
  box.querySelectorAll('[data-drill]').forEach(function(z){
    z.style.cursor='pointer';
    z.addEventListener('click',function(){
      if(_AB_EDIT) return;
      _abDrillOeffnen(z.getAttribute('data-drill'), z.getAttribute('data-drill-titel')||'');
    });
  });

  /* Work Items in der Arbeit-Kachel: eine Zeile oeffnet die volle Liste, weil
     es fuer ein einzelnes Work Item im Frontend keine Ansicht gibt. */
  box.querySelectorAll('.brz[data-work]').forEach(function(z){
    z.style.cursor='pointer';
    z.addEventListener('click',function(){
      if(_AB_EDIT) return;
      _abDrillOeffnen('arbeit_attention','Arbeit — was bei dir liegt');
    });
  });

  /* ---- Anordnen-Modus: Knoepfe ------------------------------------------- */
  box.querySelectorAll('[data-abe]').forEach(function(b){
    b.addEventListener('click',function(ev){
      ev.stopPropagation();
      var was=b.getAttribute('data-abe'), id=b.getAttribute('data-kid');
      if(was==='aus')       _abEditAendern(function(l,find){ var e=find(id); if(e) e.aus=true; });
      else if(was==='ein')  _abEditAendern(function(l,find){ var e=find(id); if(e) e.aus=false; });
      else if(was==='vor')     _abStapel(id,true);
      else if(was==='zurueck') _abStapel(id,false);
      else if(was==='weg')     _abKachelWeg(id);
      else if(was==='neu')     _abKachelNeu(b.getAttribute('data-typ'));
      else if(was==='sperre')  _abSperreUm(id);
      else if(was==='kopie')   _abDuplizieren(id);
      else if(was==='standard')  _abLayoutWechsel(null,
        'Standardanordnung aus dem Code — noch NICHT gespeichert.');
      else if(was==='verwerfen') _abLayoutWechsel(_AB_VORHER,
        'Zurück auf den Stand beim Öffnen.');
      else if(was==='zurueck1')  _abZurueck();
      else if(was==='vor1')      _abVor();
      else if(was==='speichern'){ _abLayoutSpeichern(); }
      else if(was==='fertig'){ _AB_EDIT=false;
        /* 🔴 15.08., Ralph: Luecke 1 — Hell/Dunkel gab es im Entwurf, in der App
       nicht. Der Schalter aendert NUR die Farbwerte des Dashboards, nichts an
       Aufbau oder Inhalt: eine zweite Bauart waere eine zweite Wahrheit. Die
       Wahl wird gemerkt, sonst muesste man sie bei jedem Aufruf neu treffen. */
    var du=document.getElementById('abDunkel');
    if(du) du.addEventListener('click',function(){
      var an2=!document.body.classList.contains('dashDunkel');
      document.body.classList.toggle('dashDunkel', an2);
      du.classList.toggle('on', an2);
      du.textContent=an2?'☀ Hell':'🌙 Dunkel';
      try{ localStorage.setItem('ri_dashDunkel', an2?'1':'0'); }catch(e){}
    });
    try{
      if(localStorage.getItem('ri_dashDunkel')==='1'){
        document.body.classList.add('dashDunkel');
        if(du){ du.classList.add('on'); du.textContent='☀ Hell'; }
      }
    }catch(e){}

    var an=document.getElementById('abAnordnen'); if(an) an.classList.remove('on');
        _abNeuZeichnen(); }
    });
  });

  /* Inhalt einer waehlbaren Kachel umschalten. Dieselbe eine Aenderungsspur
     wie Breite und Ein/Aus - kein zweiter Schreibweg (§4.2). */
  box.querySelectorAll('[data-abkz]').forEach(function(b){
    b.addEventListener('click',function(ev){
      ev.stopPropagation();
      var kz=b.getAttribute('data-abkz'), id=b.getAttribute('data-kid');
      _abEditAendern(function(l,find){
        var e=find(id); if(!e) return;
        var w=(e.inhalt&&e.inhalt.length)?e.inhalt.slice():_AB_FREI_VORGABE.slice();
        var i=w.indexOf(kz);
        if(i>=0) w.splice(i,1); else w.push(kz);
        e.inhalt=w;
      });
    });
  });

  /* Reihe bzw. Quelle einer Verlaufs- oder Listenkachel umschalten — dieselbe
     eine Aenderungsspur wie alles andere. */
  box.querySelectorAll('[data-abreihe]').forEach(function(b){
    b.addEventListener('click',function(ev){ ev.stopPropagation();
      var w=b.getAttribute('data-abreihe'), id=b.getAttribute('data-kid');
      _abEditAendern(function(l,find){ var e=find(id); if(e) e.reihe_id=w; });
    });
  });
  box.querySelectorAll('[data-abquelle]').forEach(function(b){
    b.addEventListener('click',function(ev){ ev.stopPropagation();
      var w=b.getAttribute('data-abquelle'), id=b.getAttribute('data-kid');
      _abEditAendern(function(l,find){ var e=find(id); if(e) e.quelle=w; });
    });
  });
  box.querySelectorAll('[data-abnotiz]').forEach(function(t){
    t.addEventListener('mousedown',function(ev){ ev.stopPropagation(); });
    t.addEventListener('change',function(){
      var id=t.getAttribute('data-abnotiz'), wert=t.value;
      _abEditAendern(function(l,find){ var e=find(id); if(e) e.text=wert; });
    });
  });
  box.querySelectorAll('[data-abtitel]').forEach(function(f){
    f.addEventListener('change',function(){ _abTitelSetzen(f.getAttribute('data-abtitel'), f.value); });
    f.addEventListener('mousedown',function(ev){ ev.stopPropagation(); });  /* nicht schieben */
  });

  var vw=document.getElementById('abVarWahl');
  if(vw) vw.addEventListener('change',function(){ _abVarianteWaehlen(vw.value); });

  /* ---- Schieben und Groesse ziehen ---------------------------------------
     Kein HTML5-Drag: das kann nur „von A auf B fallen lassen" und kennt keine
     freie Lage. Hier wird mit der Maus gerechnet — waagerecht in logischen
     Einheiten, damit dieselbe Anordnung auf jedem Bildschirm gleich aussieht.
     Waehrend des Ziehens wird nur der Stil der einen Kachel angefasst; erst
     beim Loslassen geht die neue Lage durch die normale Aenderungsspur. */
  if(_AB_EDIT){
    var flaeche=document.getElementById('abFlaeche');
    var lauf=null;
    var jeEinheit=function(){
      var br=flaeche?flaeche.getBoundingClientRect().width:_AB_LW;
      return br/_AB_LW;   /* Bildpunkte je logischer Einheit */
    };
    var starten=function(ev, id, modus){
      _abWahlSetzen(id, ev.shiftKey);
      if(_abGesperrt(id)){
        _AB_MELDUNG='Diese Kachel ist festgenagelt (🔒). Erst freigeben, dann schieben.';
        _abNeuZeichnen(); return;
      }
      var el=box.querySelector('.bk[data-kid="'+id+'"]'); if(!el) return;
      var l=_abKachelFlaeche().filter(function(e){ return e.k.id===id; })[0];
      if(!l) return;
      /* Die Lagen der anderen EINMAL beim Anfassen holen, nicht bei jedem
         Mausschritt: sie aendern sich waehrend des Ziehens nicht, und
         hundertmal dieselbe Liste zu bauen macht das Ziehen zaeh. */
      lauf={id:id, modus:modus, el:el, start:l.lage,
            andere:_abKachelFlaeche().filter(function(e){ return e.k.id!==id; })
                                     .map(function(e){ return e.lage; }),
            mx:ev.clientX, my:ev.clientY, f:jeEinheit(), neu:null};
      el.classList.add('bzieh');
      if(flaeche) flaeche.classList.add('zieht');
      ev.preventDefault();
    };
    var bewegen=function(ev){
      if(!lauf) return;
      var dx=(ev.clientX-lauf.mx)/(lauf.f||1), dy=ev.clientY-lauf.my;
      var s=lauf.start, n;
      if(lauf.modus==='ziehen'){
        n={x:Math.max(0,Math.min(_AB_LW-s.b, s.x+dx)), y:Math.max(0,s.y+dy), b:s.b, h:s.h};
        n=_abFangen(lauf.id, n, lauf.andere);
      }else{
        n={x:s.x, y:s.y, b:Math.max(_AB_MINB,Math.min(_AB_LW-s.x, s.b+dx)),
           h:Math.max(_AB_MINH, s.h+dy)};
        n=_abFangenGroesse(lauf.id, n, lauf.andere);
      }
      _abHilfslinien(n.linienX, n.linienY);
      lauf.neu=n;
      lauf.el.style.left=(n.x/_AB_LW*100)+'%';
      lauf.el.style.top=Math.round(n.y)+'px';
      lauf.el.style.width=(n.b/_AB_LW*100)+'%';
      lauf.el.style.height=Math.round(n.h)+'px';
    };
    var loslassen=function(){
      if(!lauf) return;
      var l=lauf; lauf=null;
      l.el.classList.remove('bzieh');
      if(flaeche) flaeche.classList.remove('zieht');
      _abHilfslinien([],[]);
      if(l.neu) _abLageSetzen(l.id, l.neu);   /* erst hier wird es gespeichert */
    };
    box.querySelectorAll('[data-zieh]').forEach(function(g){
      g.addEventListener('mousedown',function(ev){
        if(ev.target.closest&&ev.target.closest('button')) return;  /* Knopf bleibt Knopf */
        starten(ev, g.getAttribute('data-zieh'), 'ziehen');
      });
    });
    box.querySelectorAll('[data-groesse]').forEach(function(g){
      g.addEventListener('mousedown',function(ev){
        starten(ev, g.getAttribute('data-groesse'), 'groesse');
      });
    });
    /* Die beiden Zuhoerer haengen am FENSTER, nicht an der Kachel: sonst bleibt
       eine Kachel kleben, sobald die Maus schneller ist als das Nachzeichnen
       und den Rand verlaesst. Sie werden EINMAL angemeldet und rufen den
       jeweils aktuellen Rechner - jedes Neuzeichnen sonst einen neuen Zuhoerer
       anhaengen, und nach zehn Umbauten liefen zehn davon. */
    _AB_BEWEGEN=bewegen; _AB_LOS=loslassen;
    if(!_AB_MAUS){
      _AB_MAUS=true;
      window.addEventListener('mousemove',function(ev){ if(_AB_BEWEGEN) _AB_BEWEGEN(ev); });
      window.addEventListener('mouseup',  function(){    if(_AB_LOS)     _AB_LOS(); });
      /* Strg+Z / Cmd+Z. Nur im Anordnen-Modus, und nicht waehrend jemand in ein
         Feld schreibt — dort gehoert das Rueckgaengig dem Textfeld. */
      window.addEventListener('keydown',function(ev){
        if(!_AB_EDIT) return;
        var z=document.activeElement;
        if(z && (z.tagName==='INPUT'||z.tagName==='TEXTAREA'||z.isContentEditable)) return;
        if(ev.ctrlKey||ev.metaKey){
          if(String(ev.key).toLowerCase()!=='z') return;
          ev.preventDefault();
          if(ev.shiftKey) _abVor(); else _abZurueck();
          return;
        }
        /* Pfeiltasten: grob 10, mit Umschalt fein 1. Die Feinstufe ist der
           einzige Weg, unter das Fangraster zu kommen — ohne sie waere „genau
           hier hin" mit der Tastatur unmoeglich. */
        var s=ev.shiftKey?1:10, dx=0, dy=0;
        if(ev.key==='ArrowLeft')  dx=-s;
        else if(ev.key==='ArrowRight') dx=s;
        else if(ev.key==='ArrowUp')    dy=-s;
        else if(ev.key==='ArrowDown')  dy=s;
        else if(ev.key==='Escape'){ _abWahlSetzen(null); _abNeuZeichnen(); return; }
        else return;
        if(_abWahlSchieben(dx,dy)){ ev.preventDefault(); _abNeuZeichnen(); }
      });
    }
  }

  _abCmdNach(box);
  /* Die Zeitleiste laedt NACH — sie darf den Seitenaufbau nicht aufhalten. */
  if(document.getElementById('abZeitBox')){
    try{ _abZeitLaden(); }catch(e){ try{ console.warn('[Zeitleiste]',e); }catch(_){} }
  }

  /* Reihe 2 laedt NACH — sie darf den Seitenaufbau nicht aufhalten (Work #17). */
  if(document.getElementById('abAkt')||document.getElementById('abRegion')
     ||document.getElementById('abStammU')||document.getElementById('abWirk')
     ||document.getElementById('abRalph')){
    try{ _abBento2Laden(_abD); }
    catch(e){ try{ console.error('Bento-Reihe 2:',e); }catch(_){} }
  }
}

/* ============================================================================
   DAS WÄCHTERPANEL AN EINER STELLE  ·  26.08.2026
   ----------------------------------------------------------------------------
   🔴 RALPHS BEFUND, im Browser beschrieben: „beim laden wird kurz die normale
   app seite angezeigt, dann auch kurz die wächter und dann sind sie weg."
   Er hatte den richtigen Verdacht — nur andersherum als vermutet: nichts
   überlagert das Panel, es wird ÜBERSCHRIEBEN.

   URSACHE: _abNeuZeichnen() baut #abBentoBox komplett neu auf und kannte das
   Wächterpanel nicht. Jedes Neuzeichnen — Anordnen-Modus, Aktualisieren, Thema
   wechseln — hat es weggeworfen. Das Panel stand nur im ERSTEN Aufbau.

   REPARATUR nach §4: eine Sache, ein Ort. Markup und Verdrahtung stehen je
   einmal hier und werden von BEIDEN Wegen benutzt. Ein dritter Weg kann das
   Panel nicht mehr vergessen.
   ========================================================================== */
/* ==========================================================================
   MASCHINEN-KETTE  ·  Ralph-Auftrag 10.09.2026
   --------------------------------------------------------------------------
   „das soll die maschinen-kette sein und die anzahl an produkte, die an den
   einzelnen knoten hängen. die anderen wächter prüfen, welche wir noch
   wirklich brauchen."
   Oben: die 8 Stationen der Maschine (dieselben wie im Produkt-Kopfband,
   cb_produkt_leiste) mit der Zahl der Produkte, deren ERSTER Hänger dort
   liegt. Quelle: cb_kette_stand() — liest den Massenlauf
   (shadow_v1.kern_produkt_lauf), dieselbe Messung wie die Lückenliste.
   Klick auf eine Station: Drill 'kette:<station>' zeigt die Produkte.
   Darunter: die Wächter — vorgabemäßig NUR die, die etwas melden. „alle"
   zeigt auch die stillen. Kein Wächter wurde gelöscht; nur die Anzeige.
   ========================================================================== */
var _abKette=null, _abKetteZeit=0;
function _abWaechterPanel(np,A){
  var anz=((np&&np.waechter)||[]).length;
  var melden=(A&&A.melden!=null)?A.melden:0;
  return '<div class="abp" style="margin:0 0 14px"><div class="abph"><h3>Maschinen-Kette</h3>'
    +'<span id="abKetteInfo" style="font-size:11.5px;color:#6b7280"></span></div>'
    +'<div id="abKette" style="display:flex;flex-wrap:wrap;gap:6px;align-items:stretch;margin:6px 0 10px">'
    +'<span style="font-size:12px;color:#6b7280;padding:4px">Lade Kette…</span></div>'
    +'<div class="abph"><h3>Wächter</h3>'
    +'<span class="abtab on" data-wf="melden">melden ('+melden+')</span>'
    +'<span class="abtab" data-wf="gate">Go-Live-Gate</span>'
    +'<span class="abtab" data-wf="alle">alle '+anz+'</span></div>'
    +'<div class="abwg" id="abWg"></div><div class="abfoot" id="abWf"></div></div>';
}
async function _abKetteLaden(){
  var box=document.getElementById('abKette'); if(!box) return;
  try{
    if(!_abKette || (Date.now()-_abKetteZeit)>60000){
      var r=await client.rpc('cb_kette_stand',{});
      if(r&&r.error) throw new Error(r.error.message||'RPC-Fehler');
      _abKette=(r&&r.data)||null; _abKetteZeit=Date.now();
    }
    _abKetteMal();
  }catch(e){
    try{ console.error('cb_kette_stand',e); }catch(_){}
    box=document.getElementById('abKette'); if(!box) return;
    box.innerHTML='<span style="font-size:12px;color:#bb0000;padding:4px">Kette nicht lesbar: '+esc((e&&e.message)||String(e))+'</span>';
  }
}
function _abKetteMal(){
  var box=document.getElementById('abKette'); if(!box||!_abKette) return;
  var st=_abKette.stationen||[], ges=Number(_abKette.gemessen)||0;
  var wMap={}; ((_abNp&&_abNp.waechter)||[]).forEach(function(w){ wMap[String(w.id)]=w; });
  box.innerHTML=st.map(function(s,i){
    var n=Number(s.haengt)||0, frei=(s.kasten_id==='frei');
    /* grün = nichts hängt · gelb = hängt, wird abgearbeitet · rot = > 10 % aller Produkte */
    var farbe = n===0 ? {rand:'#b7e3c6',fl:'#f2fbf5',tx:'#0f7a3d',pk:'#22a05a'}
              : (Number(s.prozent)>10 ? {rand:'#f3bdb5',fl:'#fff5f3',tx:'#a3241a',pk:'#d13b2a'}
              : {rand:'#f0d79a',fl:'#fffaf0',tx:'#8a6100',pk:'#e0a32e'});
    var wl=(s.waechter||[]).map(function(id){ var w=wMap[id]; return w?{id:id,n:Number(w.offen)||0,name:w.name,gate:w.gate===true}:null; })
      .filter(function(x){return x&&x.n>0;});
    var wtxt=wl.length?wl.map(function(x){return x.name+' '+x.n;}).join(' · '):'';
    var tip=s.titel+' — '+s.kurz+'\n'+n+' Produkte hängen hier ('+s.prozent+' % von '+ges+')'
      +(s.haeufigster_grund?'\nHäufigster Grund: '+s.haeufigster_grund+' ('+s.grund_n+')':'')
      +(wtxt?'\nWächter: '+wtxt:'')+'\nKlick zeigt die Produkte';
    return (i>0?'<span style="align-self:center;color:#9aa3ad;font-size:14px">›</span>':'')
      +'<div class="abKst" role="button" tabindex="0" data-st="'+esc(s.kasten_id)+'" data-titel="'+esc(s.titel)+'"'
      +' title="'+esc(tip)+'" style="flex:1 1 110px;min-width:110px;max-width:170px;box-sizing:border-box;padding:7px 9px;'
      +'border:1px solid '+farbe.rand+';border-top:4px solid '+farbe.pk+';border-radius:9px;background:'+farbe.fl+';cursor:pointer;user-select:none">'
      +'<div style="font-size:10.5px;color:#6b7280">'+s.rang+' · '+esc(s.titel)+'</div>'
      +'<div style="font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;color:'+farbe.tx+';line-height:1.1;margin-top:2px">'
        +(n===0?'OK':n.toLocaleString('de-DE'))+'</div>'
      +'<div style="font-size:10px;color:#6b7280;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        +(n===0?'nichts hängt':esc(String(s.haeufigster_grund||(frei?'warten auf Freigabe':''))))+'</div>'
      +(wtxt?'<div style="font-size:10px;color:#8a6100;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(wtxt)+'</div>':'')
      +'</div>';
  }).join('');
  var info=document.getElementById('abKetteInfo');
  if(info) info.textContent=ges.toLocaleString('de-DE')+' Entwürfe gemessen · '+(Number(_abKette.durch)||0).toLocaleString('de-DE')+' Produkte Aktiv · Stand '
    +(_abKette.gemessen_am?new Date(_abKette.gemessen_am).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}):'—');
  box.querySelectorAll('.abKst').forEach(function(c){
    var auf=function(){ dashDrill('kette:'+c.dataset.st, 'Hängt an: '+c.dataset.titel); };
    c.addEventListener('click',auf);
    c.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); auf(); } });
  });
}
/* Reiter verdrahten und die Schalterleiste zeichnen. Ohne diesen Aufruf bleibt
   das Panel eine leere Hülle — genau das war der zweite Teil des Fehlers. */
/* 🔴 SICHERHEITSNETZ, 26.08.2026. Ralph meldet: „kurz die wächter und dann
   sind sie weg." Ich konnte es an Build 4408 in seinem angemeldeten Fenster
   NICHT nachstellen — zehn Sekunden lang standen alle 23 Schalter. Belegt ist
   aber ein Weg, der es kann: _abNeuZeichnen baute #abBentoBox ohne das Panel
   neu. Das ist repariert.
   Weil ich den Rest nicht messen konnte, kommt hier ein Wächter über den
   Wächtern: die ersten 20 Sekunden nach dem Aufbau wird jede Sekunde geprüft,
   ob das Panel noch steht. Fehlt es, wird es EINMAL wieder eingesetzt und der
   Vorfall in die Konsole geschrieben — damit man sieht, DASS es passiert ist,
   statt es nur zu verdecken. Findet sich die Ursache, fliegt das hier raus. */
var _abWgWache=null;
function _abWaechterWache(np,A){
  try{ clearInterval(_abWgWache); }catch(e){}
  var runden=0, gemeldet=false;
  _abWgWache=setInterval(function(){
    runden++;
    if(runden>20){ try{ clearInterval(_abWgWache); }catch(e){} return; }
    var box=document.getElementById('abBentoBox'); if(!box) return;
    var g=document.getElementById('abWg');
    /* 10.09.2026: Kette-Panel statt Wächtergitter prüfen — das Gitter darf
       leer sein, wenn kein Wächter meldet. */
    if(g && document.getElementById('abKette')) return;  /* alles in Ordnung */
    if(!gemeldet){
      gemeldet=true;
      try{ console.warn('[Wächter] Panel war weg und wurde wieder eingesetzt '
        +'(Sekunde '+runden+'). Bitte Ralph melden — die Ursache ist noch offen.'); }catch(_){}
    }
    if(!g){
      var pz=box.querySelector('.abfrei');            /* die Kachelfläche */
      var html=_abWaechterPanel(np,A);
      if(pz && pz.parentNode===box){ pz.insertAdjacentHTML('beforebegin', html); }
      else { box.insertAdjacentHTML('afterbegin', html); }
    }
    try{ _abWaechterNach(np,A); }catch(e){}
  },1000);
}

function _abWaechterNach(np,A){
  var box=document.getElementById('fgDash'); if(!box) return;
  box.querySelectorAll('.abtab[data-wf]').forEach(function(t){
    t.addEventListener('click',function(){
      box.querySelectorAll('.abtab[data-wf]').forEach(function(x){x.classList.remove('on');});
      t.classList.add('on'); _abWgMal(t.dataset.wf,np,A);
    });
  });
  if(document.getElementById('abWg')) _abWgMal('melden',np,A);
  if(document.getElementById('abKette')) _abKetteLaden();
}

function _abNeuZeichnen(){
  var box=document.getElementById('abBentoBox'); if(!box) return;
  var A=null;
  try{ if(_abNp && typeof _abAbl==='function') A=_abAbl(_abNp); }catch(e){}
  box.innerHTML=_abEditLeiste()+_abProjektzeitHtml()
    +_abWaechterPanel(_abNp,A)
    +_abBento(_abD,_abNp,A)+_abBento2()
    +'<div id="abZeitBox"></div>'+_abCmdHtml();
  _abBentoNach(box);
  /* 26.08.2026: ohne diese Zeile war das Panel nach jedem Neuzeichnen leer. */
  try{ _abWaechterNach(_abNp,A); }catch(e){ try{ console.warn('[Wächter]',e); }catch(_){} }
}

/* Zeile Beschriftung/Wert. Stand vorher zweimal als lokales z() in _abBento. */
function _abZeile(l,v,f){
  return '<div class="bzeile"><span>'+l+'</span><b'
    +(f?' style="color:'+f+'"':'')+'>'+(v==null?'–':v)+'</b></div>';
}

/* ---- 1) HEUTE — OFFENE AUFGABEN (doppelt breit) ---------------------------
   Die Liste kommt aus _abJobsListe, damit es nicht zwei Vorstellungen davon
   gibt, was dringend ist. */
/* 🔴 20.08.2026, Work #121: die Kachel heisst jetzt fachlich ARBEIT und zeigt
   ausschliesslich Work Items — nicht mehr die Zufluesse aus dem Netzplan. Die
   gehoeren in die Kachel „Eingang" und standen hier ein zweites Mal (§4.2).
   Die Liste kommt aus cockpit.karten.aufgaben.top; sie wird SERVERSEITIG
   sortiert und gefiltert. Vorher holte _abRalphLaden 200 Zeilen und filterte
   im Browser — genau die „Browserzaehlung aus Rohdaten", die der Auftrag
   ausdruecklich verbietet. */
/* Die Filterleiste. 🔴 KORREKTUR 22.08.2026 nach Ralphs Screenshot: sie wurde
   bisher EINMAL beim Kachelaufbau gebaut — zu einem Zeitpunkt, an dem die Liste
   noch gar nicht geladen war. Danach fuellte _abWorkFuellen nur die Zeilen nach.
   Folge: die Statuschips blieben fuer immer auf dem leeren Erststand stehen,
   sichtbar als einzelnes "Alle" ohne Zahl. Ein Zaehler, der nie nachgezogen
   wird, ist schlimmer als keiner — er behauptet einen Stand.
   Jetzt wird die Leiste bei JEDER Fuellung mit erneuert. */
function _abWorkFilterleiste(){
  var alle=_AB_WORK||[], f=_AB_WORK_FILTER;
  var zaehl={}, bereiche=[], owner=[], gb={}, go={};
  alle.forEach(function(w){
    zaehl[w.status]=(zaehl[w.status]||0)+1;
    var b=w.bereich||'—'; if(!gb[b]){ gb[b]=1; bereiche.push(b); }
    var o=w.owner_agent||'—'; if(!go[o]){ go[o]=1; owner.push(o); }
  });
  bereiche.sort(); owner.sort();

  var chips='<button type="button" class="awchip'+(f.status?'':' akt')+'" data-status="">'
    +'Alle'+(alle.length?' <b>'+alle.length+'</b>':'')+'</button>'
    + _AB_WORK_STATUS.filter(function(st){ return zaehl[st.id]; }).map(function(st){
        return '<button type="button" class="awchip'+(f.status===st.id?' akt':'')+'" '
          +'data-status="'+esc(st.id)+'" style="border-left:3px solid '+st.farbe+'">'
          +esc(st.wort)+' <b>'+zaehl[st.id]+'</b></button>';
      }).join('');

  /* 🔴 Die Auswahl "Zustaendig" kam bisher aus _AB_WORK_OWNER — das ist die
     Liste der Werte, die der SERVER beim ZUWEISEN erlaubt, nicht die Liste der
     Werte, die es in den Daten GIBT. Ralph hat "ralph" gewaehlt und bekam
     "0 von 97": keinem Eintrag gehoert ihm. Ein Filter, der garantiert nichts
     findet, ist eine Attrappe. Er wird jetzt aus den Daten gebaut — dieselbe
     Regel, die fuer Bereich schon galt.
     Beim ZUWEISEN bleibt _AB_WORK_OWNER richtig: dort geht es darum, wem man
     etwas geben DARF, nicht wer schon etwas hat. */
  var sel=function(id,wert,liste,vorgabe){
    return '<select id="'+id+'" class="awsel"><option value="">'+esc(vorgabe)+'</option>'
      +liste.map(function(o){ return '<option value="'+esc(o)+'"'+(wert===o?' selected':'')+'>'+esc(o)+'</option>'; }).join('')
      +'</select>';
  };
  /* Prioritaetsfilter (Ralph 22.08.: "ein filter nach prio waere nett").
     Drei Stufen statt einer Zahl zum Eintippen — die Grenzen sind dieselben,
     nach denen die Zeile ihre Prioritaet einfaerbt. Eine zweite Einteilung
     waere eine zweite Wahrheit. Die Zahl in Klammern sagt, wie viele es sind. */
  var pz={hoch:0,mittel:0,normal:0};
  alle.forEach(function(w){ var p=Number(w.priority)||0;
    if(p>=90) pz.hoch++; else if(p>=60) pz.mittel++; else pz.normal++; });
  var prioSel='<select id="awfPrio" class="awsel">'
    +'<option value="">Priorität: alle</option>'
    +'<option value="hoch"'  +(f.prio==='hoch'  ?' selected':'')+'>ab 90 — sehr hoch ('+pz.hoch+')</option>'
    +'<option value="mittel"'+(f.prio==='mittel'?' selected':'')+'>60–89 — hoch ('+pz.mittel+')</option>'
    +'<option value="normal"'+(f.prio==='normal'?' selected':'')+'>unter 60 ('+pz.normal+')</option>'
    +'</select>';

  /* ══════════════════════════════════════════════════════════════════════════
     THEMEN  ·  Ralph-Auftrag 26.08.2026: „der durcheinander geht garnicht"
     ──────────────────────────────────────────────────────────────────────────
     Bis heute trug `area` 26 verschiedene Werte fuer 170 offene Aufgaben —
     „erfassung", „produkterfassung" und „riki+erfassung" waren dreimal
     dasselbe. Am 26.08. auf NEUN Themen gebuendelt; die alten Werte stehen
     je Eintrag unter evidence.area_vor_buendelung, die Buendelung ist also
     umkehrbar.

     🔴 DIE LISTE STEHT NICHT HIER. Sie wird aus den Daten gebaut, wie bei
     Bereich und Zustaendig. Eine Themenliste im Code waere die zweite
     Wahrheit, und beim naechsten neuen Thema die veraltete.

     Warum Chips und kein Auswahlfeld: Ralph soll die Themen SEHEN, nicht
     aufklappen muessen. Das war der ganze Punkt seines Auftrags. */
  var themen=[], gt={};
  alle.forEach(function(w){ var a=w.area||'—'; if(!gt[a]){ gt[a]=0; themen.push(a); } gt[a]++; });
  themen.sort(function(a,b){ return gt[b]-gt[a] || a.localeCompare(b); });
  var themenChips = themen.length<2 ? '' :
    '<div class="awfilter" style="margin-bottom:2px">'
    +'<button type="button" class="awchip'+(f.thema?'':' akt')+'" data-thema="">'
      +'Alle Themen <b>'+alle.length+'</b></button>'
    + themen.map(function(t){
        return '<button type="button" class="awchip'+(f.thema===t?' akt':'')+'" '
          +'data-thema="'+esc(t)+'">'+esc(t.replace(/-/g,' '))+' <b>'+gt[t]+'</b></button>';
      }).join('')
    +'</div>';

  return themenChips
    +'<div class="awfilter">'+chips+'</div>'
    +'<div class="awfilter2">'
      + sel('awfOwner',f.owner,owner,'Zuständig: alle')
      + prioSel
      + sel('awfBereich',f.bereich,bereiche,'Bereich: alle')
      +'<input id="awfSuche" class="awsuche" placeholder="Nummer oder Titel …" value="'+esc(f.suche)+'">'
      +'<button type="button" id="awfWeg" class="awsel" style="cursor:pointer" title="Filter zurücksetzen">×</button>'
    +'</div>';
}

function _abkAufgaben(c){
  var ck=_abCkKarte('aufgaben');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  /* Nach dem Einsetzen der Kachel Leiste und Zeilen nachfuellen. setTimeout(0),
     weil das Markup in diesem Augenblick noch eine Zeichenkette ist. */
  try{ setTimeout(function(){ _abWorkFuellen(false); _abWorkNeuHorcher(); },0); }catch(e){}
  return {
    tag:'<span class="abtag" style="background:'+((Number(ck.bei_ralph)||0)>0?'#fdf1f1':'#eef0f4')
      +';color:'+((Number(ck.bei_ralph)||0)>0?_AB.krit:_AB.mut)+'">'
      +(Number(ck.bei_ralph)||0)+' bei dir</span>',
    /* 16.09.2026: keine Filterleiste mehr (Ralph: "einfach und smart"). Die
       Gruppierung nach Zustaendigkeit und die Ampel-Farbe je Zeile ersetzen
       sie — wer alles sehen will, sieht ohnehin alle offenen Aufgaben. */
    inhalt:'<div class="awk" id="awKachel">'
      +'<div class="awkopf"><button type="button" class="awneubtn" id="awNeuBtn">+ Aufgabe anlegen</button></div>'
      +'<div class="awpanel" id="awNeuPanel"></div>'
      +'<div class="awliste bscroll" id="awBody"><div class="blade">lädt…</div></div>'
    +'</div>',
    fuss:'<span id="awStand">lädt…</span> · Zeile antippen zum Ändern · lädt alle 60 s nach'
  };
}

/* Statuswort fuer Ralph, nicht fuer Agenten. Der Queue-Status heisst
   „ready_for_verification"; das sagt ihm nichts (§32.2a). */
function _abCkStatusWort(s){
  return {ready_for_verification:'Wartet auf Abnahme', in_progress:'In Arbeit',
          open:'Offen', blocked:'Hängt fest', disputed:'Rückfrage',
          decision_ralph:'Du entscheidest'}[s] || String(s||'');
}

/* ============================================================================
   ARBEITSTAFEL  ·  Work #199, Ralph-Auftrag 22.08.2026
   ----------------------------------------------------------------------------
   Bis hierher zeigte die Arbeit-Kachel SECHS Eintraege: cockpit_v2 filtert auf
   decision_needed oder blocked/disputed, limit 6. Gemessen sind aber 120 aktive
   Work Items. Ralph sieht damit 5 % seiner Arbeit.

   WARUM EINE EIGENE FLAECHE UND NICHT DIE KACHEL. Eine Bento-Kachel misst rund
   700x250 px. 120 Zeilen mit Statusfarbe, Zustaendigkeit, Prioritaet, vier
   Filtern und Auswahlfeldern zum Entscheiden passen dort nicht - und eine
   Kachel, in der man scrollen und filtern muss, ist keine Uebersicht mehr.
   Die Kachel bleibt Zusammenfassung, die Tafel ist die Arbeitsflaeche.

   EINE QUELLE (§4). Alles kommt aus cb_admin_agent_work_kurzliste - auch die
   Auswahllisten der Filter werden aus den geladenen Zeilen gebaut, nicht aus
   einer zweiten Liste im Code. Eine gepflegte Statusliste im Browser waere die
   zweite Wahrheit, die beim naechsten neuen Status auseinanderlaeuft.

   REALTIME IST BEWUSST AUS (Ralph-Entscheid 22.08.): in der Tabelle stehen
   unsere internen Befundtexte. Stattdessen stiller Abruf alle 60 s, und nur
   solange die Tafel offen ist - ein Takt, der im Hintergrund weiterlaeuft, ist
   ein Leck an Rechenzeit, das niemandem auffaellt.
   ========================================================================== */
var _AB_WORK=null, _AB_WORK_FEHLER=null, _AB_WORK_STAND=null, _AB_WORK_TAKT=null;
var _AB_WORK_FILTER={status:'', owner:'', bereich:'', prio:'', thema:'', suche:''};

/* Reihenfolge, Wort und Farbe je Status — an EINER Stelle. Die Farben kommen aus
   dem vorhandenen _AB-Satz, damit die Tafel nicht ihre eigene Palette aufmacht. */
var _AB_WORK_STATUS=[
  {id:'decision_ralph',        wort:'Du entscheidest',    farbe:_AB.krit},
  {id:'blocked',               wort:'Hängt fest',         farbe:_AB.warn},
  {id:'disputed',              wort:'Rückfrage',          farbe:_AB.warn},
  {id:'ready_for_verification',wort:'Wartet auf Abnahme', farbe:_AB.zu},
  {id:'open',                  wort:'Offen',              farbe:_AB.mut},
  {id:'in_progress',           wort:'In Arbeit',          farbe:_AB.pr},
  {id:'cancelled',             wort:'Zurückgezogen',      farbe:_AB.grau}
];
/* 🔴 'verified' steht hier ABSICHTLICH NICHT. Gemessen am Server:
   cb_admin_agent_work_status wirft "Verified nur über
   cb_admin_agent_work_verifizieren". Ein Auswahlwert, der eine Fehlermeldung
   erzeugt, ist schlimmer als ein fehlender — Abnehmen hat einen eigenen Knopf. */
var _AB_WORK_OWNER=['claude','chatgpt','riki','shared','ralph'];

function _abWorkStatus(id){
  for(var i=0;i<_AB_WORK_STATUS.length;i++) if(_AB_WORK_STATUS[i].id===id) return _AB_WORK_STATUS[i];
  return {id:id, wort:String(id||'—'), farbe:_AB.grau};
}
function _abWorkRang(id){
  for(var i=0;i<_AB_WORK_STATUS.length;i++) if(_AB_WORK_STATUS[i].id===id) return i;
  return 99;
}
/* Alter in Tagen — als Zahl mit Gegenstand, nicht als "vor einiger Zeit". */
function _abWorkAlter(iso){
  if(!iso) return '';
  var t=Math.floor((Date.now()-new Date(iso).getTime())/86400000);
  if(isNaN(t)) return '';
  return t<=0 ? 'heute' : (t===1 ? '1 Tag' : t+' Tage');
}

async function _abWorkLaden(){
  try{
    var r=await client.rpc('cb_admin_agent_work_kurzliste',
      {p_status:null, p_owner:null, p_bereich:null, p_limit:500});
    if(r&&r.error) throw r.error;
    var rows=r&&r.data; if(typeof rows==='string') rows=JSON.parse(rows);
    if(!Array.isArray(rows)) throw new Error('cb_admin_agent_work_kurzliste hat keine Liste geliefert');
    _AB_WORK=rows; _AB_WORK_FEHLER=null; _AB_WORK_STAND=new Date();
    return rows;
  }catch(e){
    _AB_WORK_FEHLER=(e&&e.message)||String(e); _AB_WORK=null;
    try{ console.error('[Arbeitstafel] Laden', e); }catch(_){}
    return null;
  }
}

/* Die Filter arbeiten auf den geladenen Zeilen. Kein zweiter Serverabruf je
   Filterklick: 120 Zeilen filtert der Browser schneller, als die Anfrage
   unterwegs waere — und der Server bleibt die einzige Quelle der Zeilen. */
function _abWorkGefiltert(){
  var f=_AB_WORK_FILTER, q=(f.suche||'').trim().toLowerCase();
  return (_AB_WORK||[]).filter(function(w){
    if(f.status  && w.status!==f.status) return false;
    if(f.owner   && (w.owner_agent||'')!==f.owner) return false;
    if(f.bereich && (w.bereich||'—')!==f.bereich) return false;
    if(f.thema   && (w.area||'—')!==f.thema) return false;
    if(f.prio){
      var pw=Number(w.priority)||0;
      if(f.prio==='hoch'   && pw<90) return false;
      if(f.prio==='mittel' && (pw<60 || pw>=90)) return false;
      if(f.prio==='normal' && pw>=60) return false;
    }
    if(q){
      var heu=('#'+w.work_id+' '+(w.title||'')+' '+(w.area||'')+' '+(w.bereich||'')).toLowerCase();
      if(heu.indexOf(q)<0) return false;
    }
    return true;
  }).sort(function(a,b){
    return _abWorkRang(a.status)-_abWorkRang(b.status)
        || (b.priority||0)-(a.priority||0)
        || (b.work_id||0)-(a.work_id||0);
  });
}

/* ---- Die Liste STECKT IN DER KACHEL --------------------------------------
   🔴 KORREKTUR 22.08.2026, Ralph: „warum geht arbeit nicht in der vorhandenen
   liste und oeffnet ein neues fenster an der seite? ich wollte es direkt in der
   vorhandenen liste haben."
   Er hat recht, und der Fehler war meiner: sein Auftrag hiess „in die Arbeit-
   Liste", ich habe daraus eine eigene Flaeche gemacht, weil ich 124 Zeilen in
   einer 700x250-Kachel fuer unmoeglich hielt. Das war eine Entscheidung, die
   mir nicht zustand — ich haette fragen muessen statt umzubauen.
   Geloest ohne das Platzproblem zu leugnen: die Liste sitzt IN der Kachel und
   scrollt in sich (.bscroll gab es schon, §22). Wer mehr sehen will, zieht die
   Kachel im Anordnen-Modus groesser — dieser Weg ist gebaut und bleibt Ralphs.
   Die Kachelhoehe bleibt die gleiche wie bei allen anderen (Ralph 15.08.:
   „und die kasten selbe hoehe"). Zwei Ralph-Entscheide, beide eingehalten. */

/* Fuellt NUR den Listenteil der Kachel. Ein Filterklick zeichnet damit nicht das
   ganze Dashboard neu — und verliert auch nicht die Position der anderen Kacheln. */
async function _abWorkFuellen(neuLaden){
  var body=document.getElementById('awBody');
  if(!body) return;                       /* Kachel gerade nicht auf der Seite */
  if(neuLaden || (!_AB_WORK && !_AB_WORK_FEHLER)){
    if(!_AB_WORK) body.innerHTML='<div class="blade">lädt…</div>';
    await _abWorkLaden();
    body=document.getElementById('awBody'); if(!body) return;
  }
  if(_AB_WORK_FEHLER){
    body.innerHTML='<div class="bfehl"><b>Liste nicht ladbar.</b><br>'+esc(_AB_WORK_FEHLER)+'</div>';
    return;
  }
  var zeilen=_abWorkGefiltert();
  body.innerHTML = zeilen.length
    ? _abWorkGruppen(zeilen)
    : '<div class="bleer">Keine offenen Aufgaben.</div>';
  /* Die Leiste wird MIT erneuert — sonst bleiben die Zaehler auf dem leeren
     Erststand stehen (Ralphs Screenshot vom 22.08.). Wer gerade im Suchfeld
     tippt, bekommt seinen Platz zurueck: ohne das springt der Cursor weg. */
  var leiste=document.getElementById('awFilter');
  if(leiste){
    var war=document.activeElement, warSuche=war && war.id==='awfSuche';
    var pos=warSuche? war.selectionStart : null;
    leiste.innerHTML=_abWorkFilterleiste();
    if(warSuche){
      var neuF=document.getElementById('awfSuche');
      if(neuF){ neuF.focus(); try{ neuF.setSelectionRange(pos,pos); }catch(e){} }
    }
  }
  _abWorkCss();
  _abWorkKopfSetzen(zeilen.length);
  _abWorkHorcher();
  _abWorkTakt();
}

/* Die Zeile ueber der Liste sagt, wie viele von wie vielen gerade zu sehen sind. */
function _abWorkKopfSetzen(sichtbar){
  var el=document.getElementById('awStand'); if(!el) return;
  var ganz=(_AB_WORK||[]).length;
  el.textContent = sichtbar===ganz
    ? (ganz+' aktive Aufgaben')
    : (sichtbar+' von '+ganz+' aktiven Aufgaben');
}

/* Der 60-Sekunden-Takt (Ralph-Entscheid statt Realtime, weil in der Tabelle
   interne Befundtexte stehen). Zwei Bremsen, beide absichtlich:
   er haelt an, sobald die Kachel nicht mehr auf der Seite ist, und er zeichnet
   nicht, solange ein Formular offen ist — sonst rutscht die Zeile unter dem
   Cursor weg, waehrend Ralph entscheidet. */
function _abWorkTakt(){
  if(_AB_WORK_TAKT) return;
  _AB_WORK_TAKT=setInterval(function(){
    if(!document.getElementById('awBody')){ clearInterval(_AB_WORK_TAKT); _AB_WORK_TAKT=null; return; }
    if(document.querySelector('#awBody .awoffen')) return;
    _abWorkFuellen(true);
  },60000);
}

/* Kombination A+B (Ralph 16.09.2026): A gruppiert nach Zustaendigkeit, B ist
   die Ampel-Farbe nach Dringlichkeit. Beides liest dieselbe _abWorkGefiltert-
   Sortierung (Rang nach Status, dann Prioritaet) — keine zweite Reihenfolge. */
var _AB_WORK_OWNER_ORDNUNG=['ralph','claude','chatgpt','shared','riki'];
var _AB_WORK_OWNER_WORT={ralph:'Bei dir',claude:'Claude',chatgpt:'ChatGPT',shared:'Gemeinsam',riki:'Riki'};

function _abWorkGruppen(zeilen){
  var gr={};
  zeilen.forEach(function(w){
    var o=w.owner_agent||'—';
    (gr[o]=gr[o]||[]).push(w);
  });
  var rest=Object.keys(gr).filter(function(o){ return _AB_WORK_OWNER_ORDNUNG.indexOf(o)<0; });
  return _AB_WORK_OWNER_ORDNUNG.concat(rest).filter(function(o){ return gr[o] && gr[o].length; })
    .map(function(o){
      return '<div class="awkgrp"><h4>'+esc(_AB_WORK_OWNER_WORT[o]||o)+'<span class="awkcnt">'+gr[o].length+'</span></h4>'
        + gr[o].map(_abWorkZeile).join('')
      +'</div>';
    }).join('');
}

function _abWorkZeile(w){
  var s=_abWorkStatus(w.status);
  return '<div class="awkz" data-id="'+esc(String(w.work_id))+'">'
    +'<div class="awkz1">'
      +'<span class="awkdot" style="background:'+s.farbe+'" title="'+esc(s.wort)+'"></span>'
      +'<span class="awktxt"><span class="awkt">#'+esc(String(w.work_id))+' '+esc(w.title||'')+'</span>'
        +'<span class="awkm">'+esc(s.wort)+'</span></span>'
      +'<button type="button" class="awgo" data-id="'+esc(String(w.work_id))+'">Ändern</button>'
    +'</div>'
    +'<div class="awpanel" data-panel="'+esc(String(w.work_id))+'"></div>'
  +'</div>';
}

/* ---- Entscheiden --------------------------------------------------------- */
/* 🔴 Es wird NICHTS im Browser gerechnet oder geprueft. Die erlaubten Werte
   stehen serverseitig (cb_admin_agent_work_status prueft den Status,
   _zuweisen prueft owner und 1..100). Die Auswahlfelder bilden sie nur ab,
   damit Ralph nicht in eine Fehlermeldung laeuft. Lehnt der Server ab, steht
   sein Satz woertlich da (§8). */
/* ============================================================================
   VOLLTEXT BEIM AUFKLAPPEN  ·  22.08.2026, Ralph
   ----------------------------------------------------------------------------
   "text ist leider abgeschnitten, beim klick wird er auch nicht angezeigt.
    koennte beim klick auf aendern dann komplett angezeigt werden."
   Richtig, und die Kurzliste kann das gar nicht liefern: sie kuerzt den Titel
   serverseitig auf 120 Zeichen und fuehrt Beschreibung und Notiz ueberhaupt
   nicht. Das ist Absicht — sonst waeren es Megabyte je Seitenaufbau (gemessen:
   996 KB fuer 50 Zeilen ueber den alten Weg).
   Genau dafuer wurde cb_admin_agent_work_detail gebaut (Work #198) und von mir
   bis jetzt nicht benutzt. Es wird beim Aufklappen EINER Zeile geholt und
   gemerkt, damit ein zweites Aufklappen nicht noch einmal fragt.
   Gemessene Groessen: Titel bis 127 Zeichen, Beschreibung bis 2,7 kB,
   Notiz bis 8 kB. Deshalb scrollt der Kasten, statt die Kachel zu sprengen. */
var _AB_WORK_DETAIL={};

async function _abWorkDetailLaden(id){
  var k=String(id);
  if(_AB_WORK_DETAIL[k]) return _AB_WORK_DETAIL[k];
  var r=await client.rpc('cb_admin_agent_work_detail',{p_work_id:Number(id)});
  if(r&&r.error) throw r.error;
  var d=r&&r.data; if(typeof d==='string') d=JSON.parse(d);
  if(Array.isArray(d)) d=d[0];
  if(!d) throw new Error('Zu #'+k+' liefert der Server keinen Datensatz.');
  _AB_WORK_DETAIL[k]=d;
  return d;
}

/* Ein Textblock. Fehlt der Text, kommt der Block GAR NICHT — eine Ueberschrift
   ueber einem leeren Kasten sieht aus wie ein Ladefehler (§3.4: was fehlt, wird
   nicht erfunden, aber auch nicht als leere Huelle behauptet). */
function _abWorkTextblock(titel, text){
  var t=String(text==null?'':text).trim();
  if(!t) return '';
  return '<div class="awdetb"><h5>'+esc(titel)+'</h5><div class="awdett">'+esc(t)+'</div></div>';
}

function _abWorkDetailHtml(d){
  var zeit=function(x){ if(!x) return '—';
    try{ return new Date(x).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch(e){ return String(x); } };
  var kopf='<div class="awdetk">'
    +'<b>#'+esc(String(d.work_id))+'</b> '+esc(d.title||'')
    +'</div>'
    +'<div class="awdetm">'
      +'angelegt von '+esc(d.created_by_agent||'—')+' · '+zeit(d.created_at)
      +' · zuletzt '+zeit(d.updated_at)
      +(d.bereich?' · Bereich '+esc(d.bereich):'')
      +(d.area?' · '+esc(d.area):'')
      +(d.dependency_work_id?' · <b>hängt an #'+esc(String(d.dependency_work_id))+'</b>':'')
      +(d.verifier_agent?' · geprüft von '+esc(d.verifier_agent):'')
    +'</div>';
  return kopf
    + _abWorkTextblock('Worum es geht', d.description)
    + _abWorkTextblock('Wann es fertig ist', d.acceptance_criteria)
    + _abWorkTextblock('Letzter Stand', d.result_note)
    + _abWorkTextblock('Prüfvermerk', d.verification_note);
}

function _abWorkPanel(id){
  var w=(_AB_WORK||[]).filter(function(x){ return String(x.work_id)===String(id); })[0];
  if(!w) return '<div class="bleer">Eintrag nicht mehr in der Liste.</div>';
  var opt=function(v,t,akt){ return '<option value="'+esc(v)+'"'+(akt?' selected':'')+'>'+esc(t)+'</option>'; };
  return '<div class="awdet" data-det="'+esc(String(id))+'"><div class="blade">Text wird geladen…</div></div>'
    +'<div class="awform">'
    +'<label>Status'
      +'<select class="awsel" data-f="status">'
        + _AB_WORK_STATUS.filter(function(s){ return s.id!=='decision_ralph'||true; })
            .map(function(s){ return opt(s.id,s.wort,s.id===w.status); }).join('')
      +'</select></label>'
    +'<label>Zuständig'
      +'<select class="awsel" data-f="owner">'
        + _AB_WORK_OWNER.map(function(o){ return opt(o,o,o===(w.owner_agent||'')); }).join('')
      +'</select></label>'
    +'<label>Priorität'
      +'<input class="awsel awnum" type="number" min="1" max="100" step="1" data-f="prio" '
        +'value="'+esc(String(w.priority==null?'':w.priority))+'"></label>'
    +'<label class="awbreit">Notiz — was du entschieden hast und warum'
      +'<input class="awsel" data-f="note" placeholder="steht danach im Work Item"></label>'
    +'<div class="awknoepfe">'
      +'<button type="button" class="awok" data-do="speichern" data-id="'+esc(String(id))+'">Speichern</button>'
      +'<button type="button" class="awabn" data-do="abnehmen" data-id="'+esc(String(id))+'" '
        +'title="Setzt den Eintrag auf verifiziert — der eigene Weg, den der Server dafür verlangt">✓ Abnehmen</button>'
      +'<button type="button" class="awsel" style="cursor:pointer" data-do="zu" data-id="'+esc(String(id))+'">Abbrechen</button>'
      +'<span class="awmsg" data-msg="'+esc(String(id))+'"></span>'
    +'</div>'
  +'</div>';
}

/* ---- NEUE AUFGABE ANLEGEN --------------------------------------------------
   16.09.2026, Ralph: "+ anlegen neuer aufgaben" aus dem allerersten Auftrag.
   cb_admin_agent_work_setzen verlangt zwingend eine Projektaufgabe (sonst wäre
   das Work Item in der Steuerung unsichtbar) - deshalb lädt das Formular die
   offenen Projektaufgaben nach (cb_admin_projekt_aufgabe_liste, reine
   Leseliste, B3 gewahrt) und Projektaufgabe ist Pflichtfeld, kein Freitext. */
var _AB_WORK_PA_LISTE=null;

async function _abWorkPaListeLaden(){
  if(_AB_WORK_PA_LISTE) return _AB_WORK_PA_LISTE;
  var r=await client.rpc('cb_admin_projekt_aufgabe_liste');
  if(r&&r.error) throw r.error;
  _AB_WORK_PA_LISTE=r.data||[];
  return _AB_WORK_PA_LISTE;
}

function _abWorkNeuFormular(paListe){
  var opt=function(v,t){ return '<option value="'+esc(v)+'">'+esc(t)+'</option>'; };
  var paOpts='<option value="">– Projektaufgabe wählen –</option>'
    +(paListe||[]).map(function(p){
      return opt(p.aufgabe_id, p.projekt_id+' · '+p.nummer+' · '+p.titel);
    }).join('');
  return '<div class="awform">'
    +'<label class="awbreit">Titel'
      +'<input class="awsel" data-f="titel" placeholder="kurz, worum es geht"></label>'
    +'<label class="awbreit">Projektaufgabe (Pflicht — sonst unsichtbar in der Steuerung)'
      +'<select class="awsel" data-f="pa">'+paOpts+'</select></label>'
    +'<label>Zuständig'
      +'<select class="awsel" data-f="owner">'
        +_AB_WORK_OWNER.map(function(o){ return opt(o,o); }).join('')
      +'</select></label>'
    +'<label>Bereich'
      +'<select class="awsel" data-f="bereich">'
        +'<option value="">– automatisch aus Titel –</option>'
        +opt('benutzersicht','benutzersicht')+opt('dashboard','dashboard')+opt('erfassung','erfassung')
      +'</select></label>'
    +'<label>Priorität'
      +'<input class="awsel awnum" type="number" min="1" max="100" step="1" data-f="prio" value="50"></label>'
    +'<label class="awbreit">Genauer Bereich/Stichwort (area)'
      +'<input class="awsel" data-f="area" placeholder="z.B. dashboard-steuerung, produkt-erfassen …" list="awAreaVorschlaege"></label>'
    +'<datalist id="awAreaVorschlaege">'
      +['benutzer-app','zutaten-bewertung','produkt-erfassen','projektsteuerung','riki-lesen',
        'dashboard-steuerung','frontend','data','betrieb-werkzeug'].map(function(a){ return '<option value="'+esc(a)+'">'; }).join('')
    +'</datalist>'
    +'<label class="awbreit">Beschreibung'
      +'<textarea class="awsel" style="min-height:54px;font-family:inherit" data-f="beschreibung" '
        +'placeholder="was genau soll passieren"></textarea></label>'
    +'<label class="awbreit">Abnahmekriterium'
      +'<textarea class="awsel" style="min-height:44px;font-family:inherit" data-f="abnahme" '
        +'placeholder="woran erkennt man, dass es fertig ist"></textarea></label>'
    +'<label style="flex-direction:row;align-items:center;gap:6px;text-transform:none;font-weight:400">'
      +'<input type="checkbox" data-f="entscheidung" style="width:auto"> Braucht meine Entscheidung'
    +'</label>'
    +'<div class="awknoepfe">'
      +'<button type="button" class="awok" id="awNeuSpeichern">Anlegen</button>'
      +'<button type="button" class="awsel" style="cursor:pointer" id="awNeuAbbrechen">Abbrechen</button>'
      +'<span class="awmsg" id="awNeuMsg"></span>'
    +'</div>'
  +'</div>';
}

function _abWorkNeuHorcher(){
  var btn=document.getElementById('awNeuBtn'), panel=document.getElementById('awNeuPanel');
  if(!btn||!panel||btn.dataset.an) return;   /* nur einmal anhängen, Kachel wird alle 60s nachgefuellt */
  btn.dataset.an='1';
  btn.addEventListener('click',async function(){
    var offen=panel.classList.contains('awoffen');
    panel.classList.remove('awoffen'); panel.innerHTML='';
    if(offen) return;
    panel.innerHTML='<div class="blade">Projektaufgaben werden geladen…</div>';
    panel.classList.add('awoffen');
    try{
      var liste=await _abWorkPaListeLaden();
      if(!panel.classList.contains('awoffen')) return;
      panel.innerHTML=_abWorkNeuFormular(liste);
      var ab=panel.querySelector('#awNeuAbbrechen');
      if(ab) ab.addEventListener('click',function(){ panel.classList.remove('awoffen'); panel.innerHTML=''; });
      var sp=panel.querySelector('#awNeuSpeichern');
      if(sp) sp.addEventListener('click',function(){ _abWorkNeuSpeichern(panel); });
    }catch(e){
      panel.innerHTML='<div class="bfehl">Projektaufgaben nicht ladbar: '+esc((e&&e.message)||String(e))+'</div>';
      try{ console.error('[Aufgabe anlegen] Liste',e); }catch(_){}
    }
  });
}

async function _abWorkNeuSpeichern(panel){
  var g=function(f){ var el=panel.querySelector('[data-f="'+f+'"]'); return el?el.value:''; };
  var msg=panel.querySelector('#awNeuMsg');
  var sagen=function(t,farbe){ if(msg){ msg.textContent=t; msg.style.color=farbe||_AB.mut; } };
  var titel=(g('titel')||'').trim(), pa=g('pa'), beschreibung=(g('beschreibung')||'').trim(),
      abnahme=(g('abnahme')||'').trim(), owner=g('owner')||'shared', area=(g('area')||'').trim(),
      bereich=g('bereich')||'', prio=g('prio'), entscheidung=!!(panel.querySelector('[data-f="entscheidung"]')||{}).checked;
  if(!titel||!pa||!beschreibung||!abnahme||!area){
    sagen('Titel, Projektaufgabe, Bereich(area), Beschreibung und Abnahmekriterium sind Pflicht.',_AB.krit);
    return;
  }
  panel.querySelectorAll('button').forEach(function(b){ b.disabled=true; });
  sagen('Speichert…',_AB.mut);
  try{
    var ev=bereich?{bereich:bereich}:null;
    var r=await client.rpc('cb_admin_agent_work_setzen',{
      p_actor:'ralph', p_owner:owner, p_area:area, p_title:titel,
      p_description:beschreibung, p_acceptance_criteria:abnahme,
      p_priority:prio===''?50:Number(prio), p_decision_needed:entscheidung,
      p_evidence:ev, p_projekt_aufgabe_id:pa
    });
    if(r&&r.error) throw r.error;
    sagen('Angelegt (#'+r.data+').',_AB.gut);
    setTimeout(function(){ panel.classList.remove('awoffen'); panel.innerHTML=''; },900);
    await _abWorkFuellen(true);
    try{ _abCockpitHolen(true); }catch(e){}
  }catch(e){
    sagen(_abWorkFehlerKlartext(e), _AB.krit);
    try{ console.error('[Aufgabe anlegen] Speichern',e); }catch(_){}
    panel.querySelectorAll('button').forEach(function(b){ b.disabled=false; });
  }
}

/* ============================================================================
   SERVERFEHLER IN RALPHS SPRACHE  ·  26.08.2026, Stufe 3 zu ZIEL.md
   ----------------------------------------------------------------------------
   Der Server lehnt ab, und sein Satz stand bisher woertlich da — richtig so,
   solange er verstaendlich ist. "violates check constraint
   agent_work_item_description_kurz" ist es nicht. Ralph liest dann einen
   Datenbanknamen und weiss nur, dass etwas kaputt ist.

   🔴 HIER WIRD NICHTS GERATEN. Uebersetzt werden ausschliesslich Fehler, deren
   Ursache GEMESSEN ist (Work #296). Alles andere geht unveraendert durch —
   ein erfundener Klartext waere schlimmer als ein technischer Satz.
   Keine Zahl im Text: "227 von 271" waere morgen falsch und muesste von Hand
   nachgetragen werden. Die Zahl steht in #296, wo sie gemessen wird.
   ========================================================================== */
function _abWorkFehlerKlartext(e){
  var t=String((e&&e.message)||e||'');
  if(/description_kurz|result_note_kurz|acceptance_kurz/.test(t)){
    var feld = /description_kurz/.test(t) ? 'Beschreibung'
             : /result_note_kurz/.test(t) ? 'Ergebnisnotiz' : 'Abnahmekriterium';
    return 'Dieser Eintrag lässt sich zur Zeit nicht ändern. Seine '+feld+' ist länger, '
      +'als eine später eingeführte Grenze erlaubt — beim Anlegen wurde das nie geprüft, '
      +'bei jeder Änderung schon. Das betrifft den Großteil der älteren Einträge und ist '
      +'der Grund für den Abnahme-Stau. Behebung läuft als Work #296; bis dahin bleibt '
      +'dieser Eintrag unverändert stehen. Deine Eingabe ist nicht verloren, nur nicht gespeichert.';
  }
  if(/Verified nur über/.test(t))
    return 'Abgenommen wird über den Knopf „✓ Abnehmen", nicht über das Statusfeld. '
      +'Der Server besteht darauf, damit eine Abnahme immer einen Prüfer hat.';
  return t;
}

async function _abWorkSpeichern(id, was){
  var wrap=document.querySelector('#awBody .awpanel[data-panel="'+CSS.escape(String(id))+'"]');
  if(!wrap) return;
  var g=function(f){ var el=wrap.querySelector('[data-f="'+f+'"]'); return el?el.value:''; };
  var msg=wrap.querySelector('[data-msg]');
  var alt=(_AB_WORK||[]).filter(function(x){ return String(x.work_id)===String(id); })[0]||{};
  var note=(g('note')||'').trim();
  var sagen=function(t,farbe){ if(msg){ msg.textContent=t; msg.style.color=farbe||_AB.mut; } };
  wrap.querySelectorAll('button').forEach(function(b){ b.disabled=true; });
  try{
    if(was==='abnehmen'){
      /* Abnehmen laeuft ueber den eigenen Weg — der Server lehnt 'verified'
         ueber den Statusweg ausdruecklich ab. Actor ist ralph: er nimmt ab,
         nicht der Agent, der gebaut hat (§cross_verification). */
      var rv=await client.rpc('cb_admin_agent_work_verifizieren',
        {p_work_id:Number(id), p_verifier:'ralph', p_ok:true,
         p_note:note||'Von Ralph im Dashboard abgenommen.', p_evidence:null});
      if(rv&&rv.error) throw rv.error;
    }else{
      var neuStatus=g('status'), neuOwner=g('owner'), neuPrio=g('prio');
      var etwas=false;
      if(neuStatus && neuStatus!==alt.status){
        var rs=await client.rpc('cb_admin_agent_work_status',
          {p_work_id:Number(id), p_actor:'ralph', p_status:neuStatus,
           p_note:note||null, p_evidence:null});
        if(rs&&rs.error) throw rs.error; etwas=true;
      }
      var prioZahl = neuPrio===''?null:Number(neuPrio);
      var ownerNeu = (neuOwner && neuOwner!==(alt.owner_agent||'')) ? neuOwner : null;
      var prioNeu  = (prioZahl!=null && prioZahl!==alt.priority) ? prioZahl : null;
      if(ownerNeu!=null || prioNeu!=null){
        var rz=await client.rpc('cb_admin_agent_work_zuweisen',
          {p_work_id:Number(id), p_actor:'ralph', p_owner:ownerNeu, p_priority:prioNeu,
           p_decision_needed:null, p_note:note||null});
        if(rz&&rz.error) throw rz.error; etwas=true;
      }
      if(!etwas){ sagen('Nichts geändert.',_AB.mut);
        wrap.querySelectorAll('button').forEach(function(b){ b.disabled=false; }); return; }
    }
    sagen('Gespeichert.',_AB.gut);
    /* Den gemerkten Volltext dieses Eintrags wegwerfen — sonst zeigt das
       naechste Aufklappen die Notiz von VOR der Aenderung. Ein Zwischenspeicher,
       der nicht geleert wird, ist eine zweite Wahrheit auf Zeit. */
    try{ delete _AB_WORK_DETAIL[String(id)]; }catch(e){}
    /* Neu LADEN statt die Zeile im Browser zu korrigieren: was in der Datenbank
       steht, ist die Wahrheit — auch wenn der Server etwas anderes daraus
       gemacht hat, als das Formular vorschlug (§server_ssot). */
    await _abWorkFuellen(true);
    try{ _abCockpitHolen(true); }catch(e){}
  }catch(e){
    sagen(_abWorkFehlerKlartext(e), _AB.krit);
    try{ console.error('[Arbeitstafel] Speichern', id, e); }catch(_){}
    wrap.querySelectorAll('button').forEach(function(b){ b.disabled=false; });
  }
}

function _abWorkHorcher(){
  var t=document.getElementById('awKachel'); if(!t) return;
  /* Ein Horcher fuer beide Chip-Reihen. Welche Reihe geklickt wurde, sagt das
     vorhandene data-Attribut — ein Chip traegt entweder data-status oder
     data-thema, nie beides. Zwei getrennte Schleifen waeren dieselbe Logik
     zweimal. */
  t.querySelectorAll('.awchip').forEach(function(c){
    c.addEventListener('click',function(){
      if(c.dataset.thema!==undefined) _AB_WORK_FILTER.thema=c.dataset.thema||'';
      else                            _AB_WORK_FILTER.status=c.dataset.status||'';
      _abWorkFuellen(false);   /* zeichnet Leiste UND Zeilen, Zaehler bleiben echt */
    });
  });
  var pr=t.querySelector('#awfPrio');
  if(pr) pr.addEventListener('change',function(){ _AB_WORK_FILTER.prio=pr.value; _abWorkFuellen(false); });
  var o=t.querySelector('#awfOwner'), br=t.querySelector('#awfBereich'),
      s=t.querySelector('#awfSuche'), weg=t.querySelector('#awfWeg');
  if(o)  o.addEventListener('change',function(){ _AB_WORK_FILTER.owner=o.value; _abWorkFuellen(false); });
  if(br) br.addEventListener('change',function(){ _AB_WORK_FILTER.bereich=br.value; _abWorkFuellen(false); });
  if(weg)weg.addEventListener('click',function(){
    _AB_WORK_FILTER={status:'',owner:'',bereich:'',prio:'',thema:'',suche:''}; _abWorkFuellen(false); });
  if(s){
    /* Beim Tippen NICHT neu zeichnen — das nimmt den Fokus aus dem Feld.
       Erst beim Loslassen der Taste, und der Fokus wird danach zurueckgeholt. */
    var tmr=null;
    s.addEventListener('input',function(){
      clearTimeout(tmr);
      tmr=setTimeout(function(){
        _AB_WORK_FILTER.suche=s.value; _abWorkFuellen(false);
        var n=document.querySelector('#awKachel #awfSuche');
        if(n){ n.focus(); n.setSelectionRange(n.value.length,n.value.length); }
      },300);
    });
  }
  t.querySelectorAll('.awgo').forEach(function(btn){
    btn.addEventListener('click',function(){
      var id=btn.dataset.id;
      var p=t.querySelector('.awpanel[data-panel="'+CSS.escape(String(id))+'"]');
      if(!p) return;
      var offen=p.classList.contains('awoffen');
      /* Immer nur EIN Formular offen — zwei halb ausgefuellte Entscheidungen
         nebeneinander sind eine Fehlerquelle, kein Komfort. */
      t.querySelectorAll('.awpanel.awoffen').forEach(function(x){ x.classList.remove('awoffen'); x.innerHTML=''; });
      if(offen) return;
      p.innerHTML=_abWorkPanel(id); p.classList.add('awoffen');
      /* Volltext nachladen. Er kommt NICHT aus der Kurzliste — die kuerzt den
         Titel auf 120 Zeichen und fuehrt Beschreibung und Notiz gar nicht. */
      (async function(){
        var kasten=p.querySelector('.awdet[data-det="'+CSS.escape(String(id))+'"]');
        if(!kasten) return;
        try{
          var d=await _abWorkDetailLaden(id);
          if(!p.classList.contains('awoffen')) return;   /* inzwischen zugeklappt */
          kasten.innerHTML=_abWorkDetailHtml(d);
        }catch(e){
          kasten.innerHTML='<div class="bfehl">Text nicht ladbar: '+esc((e&&e.message)||String(e))+'</div>';
          try{ console.error('[Arbeitsliste] Detail #'+id, e); }catch(_){}
        }
      })();
      p.querySelectorAll('[data-do]').forEach(function(b){
        b.addEventListener('click',function(){
          if(b.dataset.do==='zu'){ p.classList.remove('awoffen'); p.innerHTML=''; return; }
          _abWorkSpeichern(b.dataset.id, b.dataset.do);
        });
      });
    });
  });
}

function _abWorkCss(){
  if(document.getElementById('abWorkCss')) return;
  /* Eng gebaut, weil die Liste IN der Kachel sitzt (Ralph 22.08.) und nicht in
     einer eigenen Flaeche. Alles, was Platz kostet und nichts erklaert, ist
     raus: kein Rahmen um die Zeile, kein Innenabstand, kleinere Schrift.
     Die Kachel behaelt die Hoehe aller anderen (Ralph 15.08.) und scrollt in
     sich — .bscroll gab es schon. */
  var A='#fgDash .awk';
  var css=A+'{display:flex;flex-direction:column;min-height:0;height:100%;font-size:12.5px;'
    /* 🔴 An der Abnahme von 4360 im Browser gemessen: die ganze Liste war
       UNSICHTBAR. Nicht leer — die Zeilen standen da, in richtiger Farbe und
       an richtiger Stelle, aber UNTER dem weissen Verlauf der Kachel.
       Ursache: .bkopf/.bleib/.bfuss tragen position:relative und z-index:2,
       der Schleier liegt auf z-index:1. Mein eigener Kasten stand auf
       position:static und damit darunter. Ich hatte .bleib durch einen
       eigenen Kasten ersetzt und dabei uebersehen, was .bleib mitbringt.
       Lehre: wer eine vorhandene Huelle ersetzt, uebernimmt ihre Pflichten. */
    +'position:relative;z-index:2}'
   +A+' *{box-sizing:border-box}'
   +A+' .awfilter{display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px 0;flex:0 0 auto}'
   +A+' .awfilter2{display:flex;gap:5px;flex-wrap:wrap;padding:6px 12px 7px;flex:0 0 auto}'
   +A+' .awchip{border:1px solid var(--abline,#e6e9ee);border-radius:999px;background:#fff;color:inherit;padding:2px 8px;font-size:11px;cursor:pointer;line-height:1.5}'
   +A+' .awchip.akt{background:var(--abink,#131a24);color:#fff;border-color:var(--abink,#131a24)}'
   +A+' .awchip b{font-weight:800;margin-left:2px}'
   +A+' .awsel{border:1px solid var(--abline,#e6e9ee);border-radius:7px;background:#fff;color:inherit;padding:3px 6px;font-size:11.5px;max-width:150px}'
   +A+' .awsuche{flex:1 1 120px;min-width:90px;border:1px solid var(--abline,#e6e9ee);border-radius:7px;background:#fff;color:inherit;padding:3px 8px;font-size:11.5px}'
   +A+' .awliste{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 12px 10px}'
   +A+' .awz{border-top:1px solid var(--abline,#eef2f6)}'
   +A+' .awz1{display:flex;align-items:center;gap:7px;padding:5px 0}'
   +A+' .awnr{flex:0 0 auto;font-size:11px;color:var(--abmut,#6b7480);min-width:38px;font-variant-numeric:tabular-nums}'
   +A+' .awpille{flex:0 0 auto;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700;white-space:nowrap}'
   +A+' .awtitel{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
   +A+' .awmeta{flex:0 0 auto;font-size:10.5px;color:var(--abmut,#6b7480)}'
   +A+' .awalt{min-width:46px;text-align:right}'
   +A+' .awprio{flex:0 0 auto;font-size:11px;font-weight:800;min-width:32px;text-align:right;font-variant-numeric:tabular-nums}'
   +A+' .awgo{flex:0 0 auto;border:1px solid var(--abline,#e6e9ee);border-radius:7px;background:#f4f6f8;color:inherit;padding:2px 7px;font-size:11px;cursor:pointer}'
   +A+' .awpanel{display:none}'
   +A+' .awpanel.awoffen{display:block;padding:2px 0 9px}'
   +A+' .awdet{background:#fff;border:1px solid var(--abline,#e6e9ee);border-radius:9px;padding:9px 11px;margin-bottom:7px}'
   +A+' .awdetk{font-size:12.5px;font-weight:700;line-height:1.45;overflow-wrap:anywhere}'
   +A+' .awdetm{font-size:10.5px;color:var(--abmut,#6b7480);margin:3px 0 8px;overflow-wrap:anywhere}'
   +A+' .awdetb{margin-top:7px}'
   +A+' .awdetb h5{margin:0 0 3px;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--abmut,#6b7480);font-weight:700}'
   /* pre-wrap haelt unsere Absaetze und Tabellen lesbar, anywhere bricht lange
      Funktionsnamen um, und der Deckel verhindert, dass eine 8-kB-Notiz die
      ganze Kachel fuellt. Gemessen: laengste Notiz heute 8.080 Zeichen. */
   +A+' .awdett{font-size:11.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;'
      +'max-height:200px;overflow-y:auto;overscroll-behavior:contain}'
   +A+' .awform{display:flex;gap:7px;flex-wrap:wrap;align-items:flex-end;background:#f6f7f9;border:1px solid var(--abline,#e6e9ee);border-radius:9px;padding:8px 9px}'
   +A+' .awform label{display:flex;flex-direction:column;gap:3px;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--abmut,#6b7480);font-weight:700}'
   +A+' .awform .awbreit{flex:1 1 180px}'
   +A+' .awform .awbreit .awsel{width:100%;max-width:none}'
   +A+' .awnum{width:60px}'
   +A+' .awknoepfe{display:flex;gap:6px;align-items:center;flex-wrap:wrap;width:100%;margin-top:1px}'
   +A+' .awok{border:0;border-radius:7px;background:#17505c;color:#fff;font-weight:700;padding:5px 12px;font-size:11.5px;cursor:pointer}'
   +A+' .awabn{border:1px solid #0ca30c;border-radius:7px;background:#effaef;color:#0a7c0a;font-weight:700;padding:5px 10px;font-size:11.5px;cursor:pointer}'
   +A+' .awmsg{font-size:11px}'
   +A+' .awkopf{display:flex;justify-content:flex-end;margin-bottom:7px}'
   +A+' .awneubtn{border:0;border-radius:7px;background:#17505c;color:#fff;font-weight:700;padding:5px 12px;font-size:11.5px;cursor:pointer}'
   +A+' textarea.awsel{resize:vertical;width:100%;max-width:none}'
   +A+' button[disabled]{opacity:.55;cursor:default}'
   /* Schmale Kachel: Alter und Zustaendigkeit weichen zuerst — die Nummer, der
      Status und der Titel muessen bleiben, sonst weiss man nicht, worum es geht. */
   +'@media (max-width:620px){'+A+' .awalt{display:none}}'
   /* 16.09.2026: Kombination A+B — Gruppen nach Zustaendigkeit, Ampel-Punkt
      statt Status-Pille. Ergaenzt dieselbe Kachel-CSS, keine zweite Datei. */
   +A+' .awkgrp{margin:0}'
   +A+' .awkgrp h4{display:flex;align-items:center;gap:6px;font-size:10.5px;text-transform:uppercase;'
      +'letter-spacing:.05em;color:var(--abmut,#6b7480);font-weight:700;margin:10px 0 2px}'
   +A+' .awkgrp:first-child h4{margin-top:0}'
   +A+' .awkcnt{font-variant-numeric:tabular-nums;background:var(--abline,#e6e9ee);border-radius:20px;padding:0 6px;font-weight:700}'
   +A+' .awkz{border-top:1px solid var(--abline,#eef2f6)}'
   +A+' .awkgrp .awkz:first-child{border-top:0}'
   +A+' .awkz1{display:flex;align-items:center;gap:8px;padding:6px 0}'
   +A+' .awkdot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}'
   +A+' .awktxt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}'
   +A+' .awkt{font-size:12.5px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
   +A+' .awkm{font-size:10.5px;color:var(--abmut,#6b7480)}';
  var st=document.createElement('style'); st.id='abWorkCss'; st.textContent=css;
  document.head.appendChild(st);
}
if(typeof window!=='undefined'){
  window._abWorkFuellen=_abWorkFuellen;
}

/* ---- Was bei RALPH liegt --------------------------------------------------
   Nur was WIRKLICH bei ihm liegt, nicht die ganze Queue: Punkte mit
   „decision_ralph", „disputed" oder „blocked". Alles andere ist Arbeit von
   Claude oder ChatGPT und gehoert nicht auf sein Dashboard.

   🔴 DIE ERKLAERUNG WIRD NICHT ERFUNDEN. Sie ist der Titel des Work Items,
   nur aufgeraeumt: der Bereichsvorsatz („erfassung — ") faellt weg, weil er
   danebensteht. Kein Umschreiben, kein Ausschmuecken — Ralph muss den Punkt
   im Work Item wiederfinden koennen. */
function _abRalphKurz(titel){
  var t=String(titel||'');
  /* Bereichsvorsatz und die interne Marke „#42/E3" fallen weg — beides steht
     entweder daneben oder sagt Ralph nichts. Der Rest bleibt Wort fuer Wort. */
  t=t.replace(/^(erfassung|dashboard|benutzersicht|produkterfassung|frontend|data|qa)\b\s*/i,'');
  t=t.replace(/^#\d+(\/\w+)?\s*/,'');
  t=t.replace(/^[—–-]\s*/,'');
  return t;
}
var _AB_RALPH_LAGE={
  decision_ralph:{t:'Du entscheidest', f:'krit'},
  disputed:      {t:'Rückfrage an dich', f:'warn'},
  blocked:       {t:'Hängt fest', f:'warn'}
};
/* 🔴 _abRalphLaden IST ENTFERNT (Work #121, 20.08.2026) — bewusst, mit
   Begruendung statt stillschweigend (§3.7).
   Sie holte 200 Zeilen aus cb_admin_agent_work_liste und filterte, sortierte
   und zaehlte sie IM BROWSER. Damit gab es zwei Vorstellungen davon, was „bei
   Ralph liegt": ihre und die des Servers. Gemessen 20.08.: der Filter hier
   ergab 5 Punkte, cockpit.hero.ralph_entscheidungen sagt 2 — weil er
   „decision_needed an einem erledigten Item" nicht mitzaehlt und der Browser
   schon.
   Die Kachel liest jetzt cockpit.karten.aufgaben. Der Container #abRalph ist
   dabei geblieben, nur ohne Nachlader: die Zeilen stehen sofort im Markup. */

/* ============================================================================
   COCKPIT-KACHELN  ·  Work #121, Stufe 3  ·  20.08.2026
   ----------------------------------------------------------------------------
   Jede der acht Kacheln liest ihre Zahlen aus _AB_CK.karten.<id>. Solange
   nichts da ist, steht „laedt" — KEINE Zahl aus der alten Quelle als
   Zwischenstand. Genau das waere die Doppelung, die dieser Umbau beseitigt:
   cb_dashboard und cb_netzplan haben andere Definitionen und liefern andere
   Zahlen (gemessen 20.08.: Gate 248 gegen 242, Stamm 941 gegen 944).
   ========================================================================== */
function _abCkKarte(id){ return (_AB_CK && _AB_CK.karten && _AB_CK.karten[id]) || null; }

function _abCkLadeHtml(){
  if(_AB_CK_FEHLER)
    return '<div class="bleib"><div class="bleer">Keine Zahlen — '+esc(_AB_CK_FEHLER)+'</div></div>';
  return '<div class="bleib"><div class="blade">lädt…</div></div>';
}

/* Eine Zeile mit anklickbarer Zahl. Ohne drill_key bleibt sie stumm — ein
   Knopf, der nichts oeffnet, ist schlimmer als eine Zahl ohne Knopf (§121,
   Kriterium 4: 0 tote Buttons). */
function _abCkZeile(l,v,key,farbe){
  var kl=key?' class="bzeile bdrill" data-drill="'+esc(key)+'" data-drill-titel="'+esc(l)+'"'
            :' class="bzeile"';
  return '<div'+kl+'><span>'+l+'</span><b'
    +(farbe?' style="color:'+farbe+'"':'')+'>'+(v==null?'–':v)+'</b></div>';
}

/* ---- 2) KATALOG ----------------------------------------------------------- */
/* ============================================================================
   DEINE ENTSCHEIDUNGEN  ·  Ralph 26.08.2026
   ----------------------------------------------------------------------------
   „das thema aufgaben anzeige zum entscheiden haben wir auch noch nicht drin."
   Stimmt: die rote Leiste sagt „7 Entscheidungen warten auf dich", aber nicht
   WELCHE. Ralph sah eine Zahl ohne Tür.

   Diese Kachel zeigt AUSSCHLIESSLICH, was bei ihm liegt — keine Arbeitsliste,
   keine 142 Zeilen. Das war der Grund, warum die alte Arbeitskachel rausflog.
   Die Daten stehen bereits im Cockpit-Vertrag (karten.aufgaben.top): dort
   liefert der Server die dringendsten Punkte, Entscheidungen zuerst. Kein
   zweiter Abruf, keine zweite Zählung (§4.2).
   ========================================================================== */
function _abkEntscheid(c){
  var ck=_abCkKarte('aufgaben');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var n=Number(ck.bei_ralph)||0;
  var top=(ck.top||[]).filter(function(x){ return x && x.decision_needed===true; });
  var zeilen=top.slice(0,4).map(function(x){
    var t=String(x.title||'').replace(/\s+—.*$/,'');       /* Kurzfassung bis zum Gedankenstrich */
    if(t.length>52) t=t.slice(0,52).replace(/\s+\S*$/,'')+' …';
    return '<div class="bzeile bdrill" data-drill="'+esc(ck.drill_key||'arbeit_attention')+'"'
      +' data-drill-titel="Entscheidungen" title="'+esc(String(x.title||''))+'">'
      +'<span style="font-size:11.5px">#'+esc(String(x.work_id))+' '+esc(t)+'</span>'
      +'<b style="font-size:11px;opacity:.6">P'+esc(String(x.priority==null?'':x.priority))+'</b></div>';
  }).join('');
  var rest=n-Math.min(top.length,4);
  return {
    tag: n>0
      ? '<span class="abtag" style="background:#fdf1f1;color:'+_AB.krit+'">'+n+' offen</span>'
      : '<span class="abtag" style="background:#effaef;color:'+_AB.gut+'">nichts offen</span>',
    inhalt:'<div class="bleib"><div class="bzahl" style="color:'+(n>0?_AB.krit:_AB.gut)+'">'
      +n+'</div><div class="bunter">Entscheidungen bei dir</div>'
      +(zeilen?'<div style="margin-top:9px">'+zeilen+'</div>':'')
      +(rest>0?'<div class="bunter" style="margin-top:6px">und '+rest+' weitere</div>':'')
      +(n===0?'<div class="bleer" style="margin-top:8px">Niemand wartet auf dich.</div>':'')
      /* 🔴 31.08.2026, Ralph-Auftrag: Zutaten-Haertefaelle GEHOEREN in diese
         Kachel — kurzes Problem, Vorschlag, Entscheid, verbindlich fuer alle
         kuenftigen Faelle. KEIN zweiter Ort: dieselbe Kachel, zweiter Block.
         Laedt NACH (wie Links/Karte), damit die Flaeche nicht wartet. */
      +'<div id="abWaechterHF" style="margin-top:9px;padding-top:8px;border-top:1px solid var(--line,#eef2f6)">'
        +'<div class="blade">Zutaten-Härtefälle laden…</div>'
      +'</div>'
    +'</div>',
    fuss: 'Ein Entscheid hier gilt ab sofort für alle künftigen Fälle derselben Schreibweise.'
  };
}

/* ============================================================================
   ZUTATEN-HAERTEFAELLE  ·  31.08.2026  ·  Ralph-Auftrag von der Waechter-Kachel
   ----------------------------------------------------------------------------
   Quelle: cb_admin_waechter_faelle(3) — gruppierte offene Zutat_Offen-Texte mit
   verstaendlichem Problemsatz und Vorschlag. Der Entscheid laeuft ueber
   cb_admin_waechter_entscheiden und wirkt DOPPELT: alle heutigen Produkte mit
   dieser Schreibweise werden gebunden, und das Synonym greift fuer jedes
   kuenftige Produkt automatisch. So lernt das System aus jedem Klick.
   Bei 'synonym_unsicher' und 'neu' gibt es bewusst KEINEN Ja-Knopf mit
   Automatik — nur 'spaeter': eine unsichere Bindung per Klick waere genau der
   stille Aufstieg, den der Kernvertrag verbietet.
   ========================================================================== */
async function _abWaechterHFLaden(){
  var box=document.getElementById('abWaechterHF'); if(!box) return;
  try{
    var r=await client.rpc('cb_admin_waechter_faelle',{p_limit:3});
    if(r.error) throw r.error;
    var f=r.data||[];
    if(!f.length){ box.innerHTML='<div class="bleer">Keine Zutaten-Härtefälle offen.</div>'; return; }
    /* 31.08., Ralph: "die darstellung ist auch nicht schön." Jetzt je Fall eine
       KARTE mit Akzentstreifen links (gruen = sicherer Vorschlag, ocker =
       unsicher, grau = neue Zutat), Produkte-Zaehler als Badge, Regelherleitung
       als eigene §-Zeile, Knoepfe klein und rechts. "später" ist weg (Ralph) —
       verwerfen wirkt dauerhaft. */
    /* 31.08., Ralph: (a) Mengenpraefix ("12% Kokosnussöl") ist KEIN Synonymfall —
       die Zahl gehoert ins Anteilsfeld, der Matcher loest kuenftige Faelle selbst;
       der Knopf bindet Bestand + Anteil. (b) Mehrdeutige Faelle (Zitronensaeure-
       konzentrat) zeigen bis zu drei Kandidaten ZUR WAHL statt nur Ablehnung. */
    var AK={synonym_sicher:'#2e9e57',synonym_wahrscheinlich:'#7fb069',
            mengenpraefix:'#2e9e57',auswahl:'#e0a32e',neu:'#98a1aa'};
    box.innerHTML='<div style="font-size:10.5px;font-weight:800;letter-spacing:.08em;'
        +'text-transform:uppercase;color:#8a94a0;margin-bottom:7px">Zutaten-Härtefälle</div>'
      + f.map(function(x,i){
        var sicher=(x.vorschlag_art==='synonym_sicher'||x.vorschlag_art==='synonym_wahrscheinlich');
        return '<div class="abhf" data-i="'+i+'" style="margin-bottom:8px;background:#fbfcfd;'
          +'border:1px solid #e7ebef;border-left:4px solid '+(AK[x.vorschlag_art]||'#98a1aa')+';'
          +'border-radius:10px;padding:9px 11px">'
          +'<div style="display:flex;align-items:baseline;gap:8px">'
            +'<span style="font-size:13px;font-weight:700;flex:1;min-width:0">„'+esc(x.fall_text)+'"</span>'
            +'<span style="flex:0 0 auto;font-size:10.5px;font-weight:700;background:#eef1f4;'
              +'color:#6b7280;border-radius:999px;padding:2px 8px">'
              +x.produkte+' Produkt'+(x.produkte===1?'':'e')+'</span>'
          +'</div>'
          +'<div style="font-size:11.5px;color:#5b6570;line-height:1.45;margin-top:3px">'+esc(x.problem)+'</div>'
          +(x.regel?'<div style="font-size:11px;color:#3d6b4a;background:#f0f7f1;border-radius:7px;'
              +'padding:4px 8px;margin-top:5px;line-height:1.4">§ '+esc(x.regel)+'</div>':'')
          +(x.vorschlag_art==='auswahl' && (x.kandidaten||[]).length
            ? '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">'
              +x.kandidaten.map(function(k,ki){
                return '<button class="abhfkw" data-i="'+i+'" data-ki="'+ki+'"'
                  +' style="padding:4px 9px;border:1px solid #d9e3dc;background:#f4f8f5;color:#2c5c3a;'
                  +'border-radius:8px;font-size:11px;cursor:pointer"'
                  +' title="'+esc(k.regel||('Note '+k.note))+'">= '+esc(k.name)+' ('+esc(k.note)+')</button>';
              }).join('')+'</div>'
            : '')
          +'<div class="abhfkorr" data-i="'+i+'" style="display:none;gap:6px;margin-top:7px">'
            +'<input class="abhfkin" data-i="'+i+'" type="text" value="'+esc(x.fall_text)+'"'
              +' style="flex:1;min-width:0;padding:5px 9px;border:1px solid #cfd7dd;border-radius:8px;'
              +'font-size:12px" placeholder="richtiger Zutatenname">'
            +'<button class="abhfkok" data-i="'+i+'" style="padding:5px 12px;border:1px solid #bfe3c8;'
              +'background:#effaef;color:#1c7c33;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">✓</button>'
          +'</div>'
          +'<div class="abhfkmsg" data-i="'+i+'" style="display:none;font-size:11px;color:#a33;margin-top:4px"></div>'
          +'<div style="display:flex;gap:6px;justify-content:flex-end;margin-top:7px">'
            +'<button class="abhfneu" data-i="'+i+'" style="padding:5px 10px;border:1px solid var(--line,#dde3e8);'
              +'background:#fff;color:#4a5560;border-radius:8px;font-size:11px;cursor:pointer"'
              +' title="Diesen Text verwerfen und den richtigen Namen eintippen">✎ verwerfen &amp; neu erfassen</button>'
            +'<button class="abhfvw" data-i="'+i+'" style="padding:5px 10px;border:1px solid #edd9d9;'
              +'background:#fff;color:#a33;border-radius:8px;font-size:11px;cursor:pointer"'
              +' title="Dauerhaft verwerfen — das ist keine echte Zutat">✗ gibt es nicht</button>'
            +(x.vorschlag_art==='mengenpraefix'
              ? '<button class="abhfpx" data-i="'+i+'" style="padding:5px 12px;border:1px solid #bfe3c8;'
                +'background:#effaef;color:#1c7c33;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">'
                +'✓ binden, '+esc(x.anteil||'%')+' als Anteil</button>'
              : sicher
              ? '<button class="abhfja" data-i="'+i+'" style="padding:5px 12px;border:1px solid #bfe3c8;'
                +'background:#effaef;color:#1c7c33;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">'
                +'✓ Vorschlag übernehmen</button>'
              : '')
          +'</div></div>';
      }).join('');
    box._faelle=f;
    box.querySelectorAll('.abhfja').forEach(function(b){
      b.addEventListener('click',function(){ _abWaechterEntscheid(box, Number(b.dataset.i), 'synonym'); });
    });
    box.querySelectorAll('.abhfvw').forEach(function(b){
      b.addEventListener('click',function(){ _abWaechterEntscheid(box, Number(b.dataset.i), 'verworfen'); });
    });
    box.querySelectorAll('.abhfpx').forEach(function(b){
      b.addEventListener('click',function(){ _abWaechterEntscheid(box, Number(b.dataset.i), 'praefix_bindung'); });
    });
    box.querySelectorAll('.abhfkw').forEach(function(b){
      b.addEventListener('click',function(){
        _abWaechterEntscheid(box, Number(b.dataset.i), 'synonym', Number(b.dataset.ki));
      });
    });
    /* "verwerfen & neu erfassen": Eingabefeld einblenden, Fall-Text vorbefuellt
       zum Korrigieren. ✓ verwirft den alten Text dauerhaft und bindet den
       eingetippten — nur wenn er eindeutig im bewerteten Stamm steht, sonst
       kommt die Meldung und nichts passiert. */
    box.querySelectorAll('.abhfneu').forEach(function(b){
      b.addEventListener('click',function(){
        var k=box.querySelector('.abhfkorr[data-i="'+b.dataset.i+'"]');
        if(k){ k.style.display='flex'; var inp=k.querySelector('input'); if(inp){ inp.focus(); inp.select(); } }
      });
    });
    box.querySelectorAll('.abhfkok').forEach(function(b){
      b.addEventListener('click',function(){
        var inp=box.querySelector('.abhfkin[data-i="'+b.dataset.i+'"]');
        _abWaechterEntscheid(box, Number(b.dataset.i), 'korrigiert', null, inp?inp.value:'');
      });
    });
    box.querySelectorAll('.abhfkin').forEach(function(inp){
      inp.addEventListener('keydown',function(ev){
        if(ev.key==='Enter') _abWaechterEntscheid(box, Number(inp.dataset.i), 'korrigiert', null, inp.value);
      });
    });
  }catch(e){
    box.innerHTML='<div class="bleer">Härtefälle konnten gerade nicht geladen werden.</div>';
    try{ console.warn('[WaechterHF]',e); }catch(_){}
  }
}

async function _abWaechterEntscheid(box, i, wahl, kandidatIdx, korrektur){
  var f=(box._faelle||[])[i]; if(!f) return;
  var zeile=box.querySelector('.abhf[data-i="'+i+'"]'); if(!zeile) return;
  var msg=box.querySelector('.abhfkmsg[data-i="'+i+'"]');
  if(wahl==='korrigiert' && !(korrektur||'').trim()){
    if(msg){ msg.style.display='block'; msg.textContent='Erst den richtigen Namen eintippen.'; }
    return;
  }
  zeile.style.opacity='.5';
  var ziel=null;
  if(wahl==='synonym') ziel=(kandidatIdx!=null && f.kandidaten && f.kandidaten[kandidatIdx])
      ? f.kandidaten[kandidatIdx].zid : f.vorschlag_zutat_id;
  if(wahl==='praefix_bindung') ziel=f.vorschlag_zutat_id;
  try{
    var r=await client.rpc('cb_admin_waechter_entscheiden',{
      p_fall_text:f.fall_text, p_entscheidung:wahl,
      p_ziel_zutat_id:ziel, p_begruendung:null,
      p_korrektur:(wahl==='korrigiert'?korrektur:null)});
    if(r.error) throw r.error;
    var d=(r.data&&r.data.offene_geloest!=null)?r.data:{};
    /* Der Stamm kennt den korrigierten Namen nicht eindeutig: Meldung zeigen,
       Karte bleibt bedienbar — kein Entscheid wurde geschrieben. */
    if(r.data && r.data.ok===false){
      zeile.style.opacity='1';
      if(msg){ msg.style.display='block'; msg.textContent=r.data.fehler||'Nicht gefunden.'; }
      return;
    }
    zeile.style.opacity='1';
    var ok=(wahl==='synonym'||wahl==='praefix_bindung'||wahl==='korrigiert');
    zeile.style.borderLeftColor = ok ? '#2e9e57' : '#c96a6a';
    zeile.style.background = ok ? '#f2faf4' : '#fbf4f4';
    zeile.innerHTML = ok
      ? '<div style="font-size:12px;color:#1c7c33;line-height:1.45">✓ <b>„'+esc(f.fall_text)+'"</b> aufgelöst — '
        +(d.offene_geloest||0)+' Produkt'+((d.offene_geloest||0)===1?'':'e')+' gebunden.'
        +'<div style="font-size:11px;margin-top:2px">'
        +(wahl==='praefix_bindung'
          ? esc(f.anteil||'%')+' als Anteil übernommen. Künftige Prozent-Fälle löst der Matcher selbst.'
          : wahl==='korrigiert'
          ? 'Etiketttext verworfen, korrigiert zu „'+esc(d.ziel_name||korrektur||'')+'".'
          : 'Gilt ab jetzt für alle künftigen Fälle.')+'</div></div>'
      : '<div style="font-size:12px;color:#9c4040;line-height:1.45">✗ <b>„'+esc(f.fall_text)+'"</b> dauerhaft verworfen'
        +'<div style="font-size:11px;margin-top:2px">Kommt nie wieder auf die Kachel.</div></div>';
  }catch(e){
    zeile.style.opacity='1';
    zeile.insertAdjacentHTML('beforeend','<div class="bunter" style="color:#b23">Entscheid kam nicht durch — bitte neu laden.</div>');
    try{ console.warn('[WaechterHF]',e); }catch(_){}
  }
}

function _abkBestand(c){
  var ck=_abCkKarte('bestand');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var dr=ck.drills||{};
  var w=function(v){ return (Number(v)||0)>0 ? _AB.warn : null; };
  /* 🔴 26.08.2026, Ralph: „hier sollen die anzahl entwurf produkte angezeigt
     werden und anzahl freigegebene und wie viel heute neu sind."
     Die Lückenzahlen (ohne Index, ohne Quelle, EAN fehlt) bleiben darunter —
     sie sind die anklickbaren Arbeitslisten und standen schon vorher da.
     Alle vier Zahlen kommen aus cockpit_v2; hier wird nichts gerechnet. */
  var heute=Number(ck.heute_neu);
  var sieben=Number(ck.neu_7t);
  /* Eine 0 an einem ruhigen Tag ist eine ECHTE Null (§1). Damit sie nicht wie
     ein kaputter Zähler aussieht, steht die Sieben-Tage-Zahl daneben. */
  /* 🔴 26.08.2026, KORREKTUR EINES EIGENEN FEHLERS. Hier stand kurzzeitig eine
     Zeile mit class="bbz"/"werte" — das ist die WÄCHTER-Zeile, deren <b> per CSS
     ein gefüllter Balken ist (Zeile 509: flex:1, background, weisse Schrift).
     In Ralphs Browser wurde daraus ein riesiger grüner Balken quer über die
     Kachel. Gelernt: die schlichte Zeile heisst `bzeile` und entsteht durch
     _abCkZeile — nichts danebenbauen (§22). */
  var heuteText = isNaN(heute) ? '–'
    : (heute>0 ? String(heute) : '0'+(isNaN(sieben)?'':' · '+sieben+' in 7 Tagen'));
  return {
    tag:'',
    inhalt:'<div class="bleib"><div class="bzahl" style="color:'+_AB.kern+'">'
      +(ck.aktiv==null?'–':ck.aktiv)+'</div>'
    +'<div class="bunter">freigegebene Produkte</div>'
    +'<div style="margin-top:9px">'
      + _abCkZeile('Entwürfe',  ck.entwurf, null)
      + _abCkZeile('heute neu', heuteText,  null)
    +'</div>'
    +'<div style="margin-top:7px;padding-top:7px;border-top:1px solid var(--line,#eef2f6)">'
      + _abCkZeile('ohne Index-Zahl', ck.ohne_score,    dr.ohne_score,  w(ck.ohne_score))
      + _abCkZeile('ohne Quelle',     ck.ohne_quelle,   dr.ohne_quelle, w(ck.ohne_quelle))
      + _abCkZeile('EAN fehlt',       ck.ean_fehlt,     dr.ean_fehlt,   w(ck.ean_fehlt))
    +'</div></div>',
    fuss:'Oben der Bestand, unten die Lücken — jede Zahl mit Liste ist anklickbar.'
  };
}

/* ---- 3) RIKI-BUDGET -------------------------------------------------------
   Budget, Verbrauch, Aufrufe und Fehler kommen aus dem Cockpit. Der
   14-Tage-Verlauf NICHT: den fuehrt der Vertrag nicht, er steht weiterhin in
   cb_dashboard.riki_verlauf. Das ist keine zweite Zaehlung derselben Groesse,
   sondern eine Groesse, die es nur an einem Ort gibt (§3.4: was fehlt, wird
   nicht erfunden — und was da ist, wird nicht weggeworfen). */
function _abkRiki(c){
  var d=c.d||{};
  var ck=_abCkKarte('riki');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var lim=Number(ck.monatslimit_usd)||0, verbr=Number(ck.monat_usd)||0;
  var anteil=lim?Math.max(0,Math.min(1,verbr/lim)):0;
  var bf=anteil>=0.9?_AB.krit:anteil>=0.6?_AB.warn:_AB.gut;
  var jetzt=new Date(), tagNr=jetzt.getDate();
  var tageMon=new Date(jetzt.getFullYear(),jetzt.getMonth()+1,0).getDate();
  var prog=(tagNr>0?verbr/tagNr*tageMon:0), progOk=(lim? prog<=lim : true);
  /* 16.09.2026, Ralph-Kombi-Dashboard: verlauf_14t kommt jetzt direkt aus
     derselben Karte (ck), die auch heute_usd/fehler_24h liefert - eine
     Quelle statt der nie befuellten d.riki_verlauf (A4.2). */
  var rv=(ck.verlauf_14t||d.riki_verlauf||[]).slice(-14);
  var rvMax=Math.max.apply(null,[0.0001].concat(rv.map(function(x){ return Number(x.usd)||0; })));
  var spark=rv.length
    ? '<div class="bspark">'+rv.map(function(x){ var v=Number(x.usd)||0;
        return '<i title="'+esc(x.tag)+': '+v.toFixed(2)+' $" style="height:'
          +Math.max(2,Math.round(v/rvMax*28))+'px"></i>'; }).join('')+'</div>'
    : '<div class="bunter">noch keine Tageswerte</div>';
  return {
    tag:'',
    /* 🔴 26.08.2026, Ralph: „riki kosten, aber aktuell und nicht irgendwelche
       rechnungen." Deshalb steht jetzt HEUTE gross und der Monat klein.
       Grund, gemessen am 26.08.: für den Monat gibt es vier verschiedene Zahlen —
       cockpit 78,28 $, Riki_Nutzung 126,71 $, Benchmark 63,81 $ in einem eigenen
       Buch, und die Anthropic-Console wies am 25.08. rund 97 $ aus. Solange
       #254 und #265 offen sind, ist die Monatszahl nicht belastbar. Die
       Tagesausgabe lebt nicht von aufaddierten Buchungsfehlern. */
    inhalt:'<div class="bleib"><div class="bzahl" style="color:'+_AB.kern+'">'
      +(ck.heute_usd==null?'–':Number(ck.heute_usd).toFixed(2).replace('.',',')+' $')+'</div>'
    +'<div class="bunter">heute ausgegeben · '+(ck.heute_calls==null?'–':ck.heute_calls)+' Aufrufe</div>'
    +spark
    +'<div style="margin-top:9px">'
      + _abCkZeile('Fehler, 24 h', ck.fehler_24h, ck.drill_key,
                   ((Number(ck.fehler_24h)||0)>0?_AB.krit:null))
    +'</div>'
    /* Korrektur wie in _abkBestand: schlichte Zeile ist `bzeile`, nicht `bbz`.
       `bbz .werte b` ist der gefüllte Wächterbalken und hat hier nichts zu suchen. */
    +(lim
      ? '<div style="margin-top:7px;padding-top:7px;border-top:1px solid var(--line,#eef2f6)">'
        + _abCkZeile('Monat (eigene Zählung)',
            '<span style="color:'+bf+'">'+verbr.toFixed(2).replace('.',',')+' $</span>'
            +'<span style="opacity:.55"> / '+lim.toFixed(0)+'</span>', null)
        +'<div class="abbar" style="margin-top:6px"><i style="width:'+Math.round(anteil*100)
        +'%;background:'+bf+'"></i></div></div>'
      : '')
    +'</div>',
    fuss:lim ? ('Prognose Monatsende ~'+prog.toFixed(0)+' $ · '
      +(progOk?'im Rahmen':'<b style="color:'+_AB.krit+'">über Budget</b>')
      +'. ⚠ Die Monatszahl ist die eigene Zählung und weicht von der echten '
      +'Abrechnung ab (#254, #265) — verlass dich auf den Tageswert.') : ''
  };
}

/* ---- 3b) SEO / GOOGLE --------------------------------------------------
   16.09.2026, Ralph: echte Google-Search-Console-Zahlen. Klicks/Impressionen
   kommen aus searchanalytics.query (seo_suchdaten_taeglich, taeglich per
   Edge Function befuellt). "Indexierte Seiten insgesamt" liefert KEINE
   Google-API als Summe — nur die Search-Console-Oberflaeche zeigt das. Was
   hier steht, ist eine ehrliche Stichprobe (urlInspection je URL) und wird
   auch so genannt, nie als Vollzaehlung ausgegeben (A2). */
function _abkSeo(c){
  var ck=_abCkKarte('seo');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var fmt=function(n){ return n==null?'–':String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); };
  var klicks=ck.klicks_28t, impr=ck.impressionen_28t, pos=ck.position_28t;
  var geprueft=Number(ck.stichprobe_geprueft)||0, indexiert=Number(ck.stichprobe_indexiert)||0;
  var anteil=ck.stichprobe_anteil;
  var af=(anteil==null)?_AB.mut:(anteil>=80?_AB.gut:(anteil>=50?_AB.warn:_AB.krit));
  var keineDaten=(klicks==null && impr==null);
  return {
    tag:'',
    inhalt:'<div class="bleib">'
      +(keineDaten
        ? '<div class="bunter">Noch keine Suchdaten — Google-Anbindung läuft erst seit Kurzem.</div>'
        : '<div style="display:flex;gap:18px;flex-wrap:wrap">'
          +'<div><div class="bzahl" style="color:'+_AB.kern+'">'+(klicks==null?'–':fmt(klicks))+'</div>'
          +'<div class="bunter">Klicks · 28 Tage</div></div>'
          +'<div><div class="bzahl" style="color:'+_AB.kern+'">'+(impr==null?'–':fmt(impr))+'</div>'
          +'<div class="bunter">Impressionen · 28 Tage</div></div>'
          +'</div>'
          +(pos!=null?'<div class="bunter" style="margin-top:4px">Ø Position '+String(pos).replace('.',',')+'</div>':''))
    +'<div style="margin-top:9px;padding-top:9px;border-top:1px solid var(--line,#eef2f6)">'
      +(geprueft>0
        ? '<span style="color:'+af+';font-weight:800">'+indexiert+' von '+geprueft+'</span>'
          +' <span style="opacity:.7">geprüften Produktseiten sind bei Google indexiert (Stichprobe'+(anteil!=null?', '+anteil+' %':'')+')</span>'
        : '<span class="bunter">Stichproben-Prüfung läuft an — erste Ergebnisse folgen.</span>')
    +'</div>'
    +'</div>',
    fuss:'⚠ Keine Vollzählung: Google liefert die Gesamtzahl indexierter Seiten über keine API. '
      +'Klicks/Impressionen sind echte Suchdaten, die Indexierung ist eine tägliche Stichprobe.'
  };
}

/* ---- 4) WÄCHTER-STATUS ----------------------------------------------------
   🔴 15.08.: nachgezogen auf die Vorlage — Halbkreis mit zwei Wertkaesten und
   Balkenzeilen mit der ZAHL IM BALKEN samt Schwellwert-Pillen davor.
   Die Schwellen sind NICHT erfunden: „meldet" ist >0, „blockiert" ist das
   Gate-Kennzeichen aus den Daten. Was es nicht gibt, steht auch nicht da —
   einen Verlauf ueber Zeit (−2h ▸ −1h ▸ JETZT wie in der Vorlage) speichert
   der Server nicht, deshalb gibt es hier keine Zeitkette. Sie zu zeichnen und
   mit dem heutigen Wert dreimal zu fuellen waere eine Luege im Bild. */
function _abkWaechter(c){
  var ck=_abCkKarte('waechter');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var g=ck.gate||[];
  var still=g.filter(function(x){ return (Number(x.offen)||0)===0; }).length;
  var quote=g.length? Math.round(still/g.length*100) : 0;
  /* Halbkreis: 81er Radius, wie in der Vorlage. Der gefuellte Teil ist der
     STILLE Anteil — die gute Richtung ist der Fortschritt. */
  var bogen=function(anteil){
    var a=Math.PI*(1-Math.max(0,Math.min(1,anteil)));
    return {x:(98+81*Math.cos(a)).toFixed(1), y:(97-81*Math.sin(a)).toFixed(1)};
  };
  var e=bogen(quote/100);
  var farbe=quote>=80?_AB.gut:(quote>=40?_AB.warn:_AB.krit);
  var faelle=Number(ck.gate_faelle)||0;

  /* 🔴 JEDE Zahl traegt ihren MESSSTAND (§121, Kriterium 5). Vorher stand hier
     eine Zahl ohne Alter — und eine Cache-Zahl von vorgestern sieht genauso aus
     wie eine von heute frueh. Gemessen 20.08.: „Zutaten-Regeln" war 78,3 Stunden
     alt, waehrend die uebrigen sieben 13,1 Stunden alt waren. */
  var zeile=function(x){
    var offen=Number(x.offen)||0;
    var f=offen>0?'r':'gr';
    var alt=Number(x.alter_stunden);
    var frisch=(x.frisch===true);
    var std=isNaN(alt)?'Stand unbekannt'
      :(alt<48? ('vor '+alt.toFixed(1).replace('.',',')+' h')
              : ('vor '+Math.round(alt/24)+' Tagen'));
    return '<div class="bbz'+(x.drill_key&&offen>0?' bdrill':'')+'"'
      +(x.drill_key&&offen>0?' data-drill="'+esc(x.drill_key)+'" data-drill-titel="'+esc(x.name||x.id)+'"':'')
      +'>'
      +'<span class="nm">'+esc(x.name||x.id||'')
        +'<span class="schw"><i class="'+(frisch?'gr':'ge')+'">'+esc(std)+'</i></span></span>'
      +'<span class="werte"><b class="'+f+'">'+offen+'</b></span>'
    +'</div>';
  };
  return {
    tag:(faelle>0
      ? '<span class="abtag" style="background:#fdf1f1;color:'+_AB.krit+'" '
        +'title="Summe der offenen Fälle bei den Wächtern, die die Freigabe blockieren">'
        +faelle+' Gate-Fälle</span>'
      : '<span class="abtag" style="background:#effaef;color:'+_AB.gut+'">Gate frei</span>'),
    inhalt:'<div class="bleib">'
      +'<div class="bort">Gate-Wächter: <b>'+g.length+'</b>'
        +(ck.messung_veraltet===true
          ? ' · <span style="color:'+_AB.warn+'">ein Messstand ist veraltet</span>' : '')
      +'</div>'
      /* 🔴 26.08.2026, Ralph: „die wächter sind wichtig oben, aber kleiner
         dargestellt ggf in einer zeile."
         Der Halbkreis ist raus. Er brauchte 98 Pixel Höhe, um eine einzige
         Prozentzahl zu zeigen — dieselbe Aussage steht jetzt als ein Satz.
         Darunter EINE Zeile Marken: je Wächter ein Feld, rot wenn offen, grün
         wenn still. Antippen öffnet dieselbe Arbeitsliste wie vorher; der
         Sprungweg ist unverändert (§22, kein zweiter Weg). */
      +'<div style="font-size:12.5px;margin:2px 0 8px">'
        +'<b style="color:'+farbe+'">'+quote+' %</b> still · '
        +(g.length-still)+' von '+g.length+' melden'
      +'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:5px">'
        + g.map(function(x){
            var offen=Number(x.offen)||0;
            var an=(x.drill_key && offen>0);
            return '<span'+(an?' class="bdrill" data-drill="'+esc(x.drill_key)
                  +'" data-drill-titel="'+esc(x.name||x.id)+'"':'')
              +' title="'+esc((x.name||x.id)+' — '+(x.frisch===true?'frisch gemessen':'Messstand alt'))+'"'
              +' style="display:inline-flex;align-items:center;gap:4px;'
              +'border:1px solid '+(offen>0?'#f0a9a4':'var(--line,#dbe3ea)')+';'
              +'background:'+(offen>0?'#fdeaea':'transparent')+';'
              +'border-radius:7px;padding:2px 7px;font-size:11.5px;'
              +(an?'cursor:pointer;':'')
              +(x.frisch===true?'':'border-style:dashed;')+'">'
              +'<span style="opacity:.8">'+esc(x.name||x.id||'')+'</span>'
              +'<b style="color:'+(offen>0?_AB.krit:_AB.gut)+'">'+offen+'</b>'
            +'</span>';
          }).join('')
      +'</div>'
      + (still===g.length && g.length
          ? '<div class="bleer">Kein Gate-Wächter meldet etwas.</div>' : '')
      +'<div class="bleg">'
        +'<span><i class="gr"></i>frisch gemessen</span>'
        +'<span><i class="ge"></i>Messstand alt</span>'
        +'<span><i class="r"></i>offene Fälle</span>'
      +'</div>'
    +'</div>',
    fuss:(Number(ck.weitere_beobachtungen_mit_faellen)||0)>0
      ? (ck.weitere_beobachtungen_mit_faellen+' weitere Beobachtungen haben Fälle, blockieren aber nicht.')
      : ''
  };
}

/* Die Flaeche zeichnen. EIN Behaelter, absolute Lagen, Ueberlappung erlaubt. */
function _abFlaeche(c){
  var l=_abKachelFlaeche(), unten=0;
  l.forEach(function(e){ unten=Math.max(unten, e.lage.y+e.lage.h); });
  var h='<div class="abbento abfrei'+(_AB_EDIT?' bearb':'')+'" id="abFlaeche" '
    +'style="height:'+(unten+16)+'px">';
  l.forEach(function(e){
    var g=e.lage, x=e.k;
    var stil='position:absolute;left:'+(g.x/_AB_LW*100).toFixed(4)+'%;top:'+g.y+'px;'
      +'width:'+(g.b/_AB_LW*100).toFixed(4)+'%;height:'+g.h+'px;z-index:'+g.z+';overflow:hidden';
    var zus=_AB_EDIT?_abEditRahmen(x):{};
    zus=Object.assign({}, zus, {stil:stil, foto:x.foto, leds:x.leds,
      /* text:true => Zeilen laufen bis ganz rechts, der Verlauf deckt voll. */
      klasse:(zus.klasse||'')+(x.text?' btext':''),
      attr:(zus.attr||'')+' data-kid="'+esc(x.id)+'"'});
    if(x.roh){
      var r=x.roh(c,x);
      r=r.replace('<div class="bk"','<div class="bk'+(zus.klasse||'')+'"'+zus.attr
        +' style="'+stil+'"');
      if(zus.vor) r=r.replace(/>/, '>'+zus.vor);
      h+=r; return;
    }
    var t=x.bau(c,x)||{};
    h+=_abKachel(x.titel, t.tag||'', t.inhalt||'', t.fuss||'', false, zus);
  });
  return h+'</div>';
}

function _abBento(d,np,A){
  return _abFlaeche({d:d||{},np:np||{},A:A});
}

/* ============================================================================
   BENTO-REIHE 2  ·  Durchgang 3  ·  15.08.2026
   ----------------------------------------------------------------------------
   §22 zuerst gesucht, und es hat sich wieder gelohnt: NICHTS hiervon ist neu.
     · „Letzte Aktivitaeten"  -> cb_top_aufrufe / cb_top_suchen. Beide standen in
       `ladeNutzungPanel` — einer Funktion, die NIRGENDS gerufen wird und deren
       Container `#dashNutzung` in keinem Markup steht. Totes Werkzeug, genau wie
       `ladeStammPanel`. Es fehlte nicht, es war nur nicht angeschlossen.
     · „Nutzer & Regionen"    -> dashKarteLoad + entKarteDE, vorhanden.
     · „Stamm-Ueberblick"     -> cb_admin_stamm_waechter, dieselbe Quelle wie der
       Stammwaechter. KEINE zweite Zaehlung (§4.2).
     · „Schnellzugriff"       -> adminGo, vorhanden.

   🔴 ALLE VIER LADEN NACH. Der Seitenaufbau darf nicht auf sie warten —
   cb_admin_stamm_waechter braucht gemessene 4,9 s und laeuft in den Timeout
   (Work #17). Eine Kachel, die den Rest der Seite blockiert, waere ein
   Rueckschritt gegenueber dem, was vorher da war.

   15.08. Work #42/E1: die drei nachladenden Kacheln stehen jetzt im Register
   oben. Ihr Inhalt ist unveraendert der Ladeplatzhalter mit derselben ID —
   die Nachlader (abAkt · abRegion · abStammU) suchen weiterhin dieselben
   Container und wurden NICHT angefasst.
   ========================================================================== */
/* ---- 5) EINGANG (id bleibt „aktivitaet") -----------------------------------
   🔴 20.08.2026, Work #121: die Kachel zeigt die sechs echten ZUFLUESSE mit
   Wartemenge und Alter, nicht mehr „Meistgeoeffnete Produkte / erfolglose
   Suchen". Die ID bleibt, damit gespeicherte Layouts aus Work #42 nicht
   migriert werden muessen — nur ihr fachlicher Inhalt ist definiert worden.

   WAS DABEI WEGFAELLT, und das steht hier statt es zu verschweigen: die
   30-Tage-Nutzung aus cb_top_aufrufe / cb_top_suchen. Beide RPCs bleiben
   unangetastet in der Datenbank; sie haben nur keinen Platz mehr im
   Standard-Dashboard. Ralph kann sie ueber die freie Kachel zurueckholen. */
function _abkAkt(c){
  var ck=_abCkKarte('aktivitaet');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var q=ck.queues||[];
  var wegWort={auto:'Automatik', hand:'von Hand', keiner:'kein Weg'};
  var zeilen=q.map(function(x){
    var n=Number(x.wartend)||0;
    var kein=(x.weg==='keiner');
    var alter=(x.aeltester_tage==null)?'':(' · ältester '+x.aeltester_tage+' T');
    return '<div class="bzeile'+(x.drill_key?' bdrill':'')+'"'
      +(x.drill_key?' data-drill="'+esc(x.drill_key)+'" data-drill-titel="'+esc(x.name||x.id)+'"':'')
      +'><span>'+esc(x.name||x.id||'')
        +'<i style="font-style:normal;opacity:.7"> — '+esc(wegWort[x.weg]||String(x.weg||''))
        +esc(alter)+'</i></span>'
      +'<b'+(kein&&n>0?' style="color:'+_AB.warn+'"':'')+'>'+n+'</b></div>';
  }).join('');
  var ohne=Number(ck.ohne_automatischen_weg)||0;
  return {
    tag:'<span class="abtag" style="background:'+(ohne>0?'#fff6e6':'#eef0f4')+';color:'
      +(ohne>0?_AB.warn:_AB.mut)+'">'+ohne+' ohne automatischen Weg</span>',
    inhalt:'<div class="bleib">'
      +(zeilen||'<div class="bleer">Kein Zufluss wartet.</div>')
      +'</div>',
    fuss:'Anklickbare Zeilen öffnen die wartenden Einträge.'
  };
}

/* ---- 7) NUTZUNG (id bleibt „region") ---------------------------------------
   Ralph-Korrektur 18.08.: die Deutschlandkarte BLEIBT. Sie wird weiterhin von
   dashKarteLoad/entKarteDE gezeichnet — kein zweiter Kartenzeichner (§4.2,
   Kriterium 11). Die Nutzungswerte darueber kommen aus dem Cockpit. */
function _abkRegion(c){
  var ck=_abCkKarte('region');
  var kopf=ck
    ? '<div style="margin-bottom:7px">'
        + _abCkZeile('Nutzer gesamt', ck.nutzer_gesamt, null)
        + _abCkZeile('aktiv, 7 Tage', ck.aktiv_7t, null)
        + _abCkZeile('Premium', ck.premium, null)
        + _abCkZeile('Tagebuch, 7 Tage', ck.tagebuch_7t, null)
      +'</div>'
    : '<div class="blade">Nutzungswerte laden…</div>';
  return {tag:'', inhalt:'<div class="bleib">'+kopf
    +'<div id="abRegion"><div class="blade">Karte lädt…</div></div></div>', fuss:''};
}

/* ---- 6) STAMM (id bleibt „stammu") -----------------------------------------
   🔴 20.08.2026, Work #121, Kriterium 6: die Kachel nennt NICHT mehr
   public.Zutaten_Stamm. Die Zahlen kommen aus der Canonical-Wahrheit im
   Cockpit. Der bisherige Nachlader rief cb_admin_stamm_waechter mit gemessenen
   4,9 s (Work #17) — er ist damit aus dem Seitenaufbau raus. */
function _abkStammU(c){
  var ck=_abCkKarte('stammu');
  if(!ck) return {tag:'', inhalt:_abCkLadeHtml(), fuss:''};
  var dr=ck.drills||{};
  var w=function(v){ return (Number(v)||0)>0 ? _AB.warn : null; };
  return {
    tag:'<span class="abtag" style="background:#eef0f4;color:'+_AB.mut+'">Canonical</span>',
    inhalt:'<div class="bleib"><div class="bzahl" style="color:'+_AB.kern+'">'
      +(ck.aktiv==null?'–':ck.aktiv)+'</div>'
    +'<div class="bunter">aktive Canonical-Zutaten</div>'
    +'<div style="margin-top:9px">'
      + _abCkZeile('wirklich unbewertet', ck.wirklich_unbewertet, null, w(ck.wirklich_unbewertet))
      + _abCkZeile('nie gebunden',        ck.nie_gebunden,   dr.nie_gebunden,   w(ck.nie_gebunden))
      + _abCkZeile('ohne Kategorie',      ck.ohne_kategorie, dr.ohne_kategorie, w(ck.ohne_kategorie))
    +'</div></div>',
    fuss:'Canonical ist die Wahrheit — der Legacy-Zeilenzähler ist keine Kennzahl mehr.'
  };
}

/* Die zweite Reihe ist mit dem Umbau auf die freie Flaeche entfallen — ihre
   vier Kacheln liegen jetzt in derselben Flaeche wie die anderen. Die Funktion
   bleibt als leere Huelle stehen, weil dashArbeitHtml sie ruft; entfernt wird
   sie erst, wenn der Aufrufer angefasst wird (§2.3: keine Nebenaenderung). */
function _abBento2(){ return ''; }

/* Schnellzugriff. Reine Wege, keine Zahlen — deshalb sofort da und ohne Nachladen.
   Die Ziele sind adminGo-Schluessel, die es WIRKLICH gibt (aus der fg-Tabelle in
   adminGo gelesen, nicht geraten). */
/* ---- 8) BETRIEB & SCHNELLZUGRIFF (id bleibt „schnell") ---------------------
   🔴 20.08.2026, Work #121: die sechs action keys kommen jetzt vom Server und
   werden auf VORHANDENE Wege gemappt. Kein Weg wird erfunden (Kriterium 7).
   Gemessen 20.08. an adminGo: dash · scans · bundles · rezepte · empfehlungen ·
   zuverif · regelwerk · produkterfassung · stamm sind die Tabs; alles andere
   laeuft ueber navTo. Fuer `work_queue` gibt es im Frontend KEINE Ansicht —
   der Knopf oeffnet deshalb die Serverliste, statt ins Leere zu zeigen.

   Dazu die Betriebstakte aus cockpit.karten.schnell.takte: Name, Alter,
   Fehlerserie. Ralphs Vorgabe „keine rohen HTML-Fehlermeldungen im Kacheltext"
   ist eingehalten — es steht nur, wann es zuletzt lief und ob es haengt. */
var _AB_SCHNELL_WEG={
  erfassung:   {ic:'✏️', go:'produkterfassung'},
  scan:        {ic:'📷', fn:function(){ if(typeof scanEingangOeffnen==='function') scanEingangOeffnen(); }},
  stamm:       {ic:'🧬', go:'stamm'},
  waechter:    {ic:'🛡️', fn:function(){ _abSprung('waechter'); }},
  work_queue:  {ic:'📋', drill:'arbeit_attention', drillTitel:'Work Queue — was offen ist'}
};

function _abSchnell(){
  var ck=_abCkKarte('schnell');
  var akt=(ck&&ck.aktionen)||[];
  var knoepfe=akt.map(function(a){
    var w=_AB_SCHNELL_WEG[a.key];
    if(!w) return '';                       /* unbekannter Schluessel: kein Knopf */
    return '<button type="button" class="abschnell abschnellv2" data-akey="'+esc(a.key)+'">'
      +'<span class="ic">'+w.ic+'</span>'+esc(a.label||a.key)+'<span class="pf">›</span></button>';
  }).join('');

  /* 🔴 14.09.2026, Work #633: die Liste kommt aus cb_netzplan und damit aus
     cb_takt_status - und die zeigt seit heute ALLE 41 aktiven Takte statt der
     fuenf, die sich selbst gemeldet hatten. 41 Zeilen sprengen die Kachel und
     sagen nichts. Gezeigt wird, was auffaellt: Fehlerserie, gescheiterter
     letzter Lauf, oder ueber einen Tag nichts gelaufen. Der Rest als eine
     Zeile. Wer alles sehen will, nimmt die Maschinenseite (cb_admin_takte_stand). */
  var _alleTakte=(ck&&ck.takte)||[];
  var _auffaellig=_alleTakte.filter(function(t){
    var min=Number(t.minuten_her);
    return (Number(t.fehler_serie)||0)>0 || Number(t.status)===500
        || (!isNaN(min) && min>1440);
  });
  var takte=_auffaellig.map(function(t){
    var min=Number(t.minuten_her);
    var alt=isNaN(min)?'–':(min<90? (Math.round(min)+' min her')
                                  : (Math.round(min/60)+' h her'));
    var serie=Number(t.fehler_serie)||0;
    var f=(serie>0||Number(t.status)===500)?_AB.krit:_AB.warn;
    return '<div class="bzeile"><span>'+esc(t.takt||'')+'</span><b'
      +' style="color:'+f+'">'+esc(alt)+(serie>0?(' · '+serie+'× Fehler'):'')+'</b></div>';
  }).join('');
  if(_alleTakte.length){
    var _still=_alleTakte.length-_auffaellig.length;
    takte+='<div class="bzeile"><span>'+(_auffaellig.length?'übrige Takte':'Takte')+'</span><b style="color:'
      +(_still?_AB.gut:_AB.grau)+'">'+_still+' von '+_alleTakte.length+' ohne Auffälligkeit</b></div>';
  }

  var auto=ck ? (ck.autopilot_an===true
      ? '<div class="bzeile"><span>Etikett-Autopilot</span><b style="color:'+_AB.gut+'">läuft</b></div>'
      : '<div class="bzeile'+((Number(ck.foto_wartend)||0)>0?' bdrill':'')+'"'
        +((Number(ck.foto_wartend)||0)>0?' data-drill="scan_foto" data-drill-titel="Wartende Etikettfotos"':'')
        +'><span>Etikett-Autopilot</span><b style="color:'+_AB.krit+'">aus · '
        +(Number(ck.foto_wartend)||0)+' warten</b></div>')
    : '';

  return '<div class="bk"><div class="bkopf"><h3>Betrieb &amp; Schnellzugriff</h3></div>'
    +'<div class="bleib" style="padding-top:6px">'
    + (ck ? (auto+takte+'<div style="height:7px"></div>'+knoepfe)
          : '<div class="blade">lädt…</div>')
    +'<div id="abLinks" style="margin-top:9px"><div class="blade">Linkliste lädt…</div></div>'
    +'</div></div>';
}

/* ============================================================================
   LINKLISTE  ·  Work #121, Kriterium 12/13  ·  20.08.2026
   ----------------------------------------------------------------------------
   Ralph-Entscheid 20.08. (Weg A): die vorhandene Liste wird AUSGELIEFERT, nicht
   abgeschrieben. Die Datei ist von "06 Betrieb/Links.md" nach
   "webseite/Links.md" GEZOGEN — nicht kopiert. Es gibt sie weiterhin genau
   einmal, Ralph pflegt sie unverändert in Obsidian, und die Wikilinks [[Links]]
   bleiben heil, weil der Dateiname derselbe ist.

   🔴 WAS DAMIT ÖFFENTLICH WIRD, und das steht hier statt im Kleingedruckten:
   deploy.command kopiert ALLE regulären Dateien direkt aus webseite/. Die Datei
   ist damit unter root-index.de/Links.md abrufbar — für jeden, auch ohne
   Anmeldung. Sie enthält keine Schlüssel und keine Passwörter (nachgelesen,
   nicht vermutet), aber die Adresse des GitHub-Repos steht darin. Wer das nicht
   will, nimmt die Zeile aus der Datei; das Dashboard zeigt dann eine Gruppe
   weniger und sonst nichts.

   Gelesen wird das Markdown so, wie Ralph es schreibt: „## Überschrift" wird
   eine Gruppe, „| Name | https://… |" wird eine Zeile. Was keine URL enthält,
   wird übersprungen — die drei unbelegten Punkte am Ende der Datei sind
   ausdrücklich als Lücke markiert und sollen keine Knöpfe werden (§1.2).
   ========================================================================== */
function _abLinksAusMd(md){
  var gruppen=[], aktuell=null;
  String(md||'').split('\n').forEach(function(z){
    var h=/^##\s+(.+?)\s*$/.exec(z);
    if(h){ aktuell={titel:h[1], links:[]}; gruppen.push(aktuell); return; }
    if(!aktuell) return;
    if(z.indexOf('|')!==0) return;
    var sp=z.split('|').map(function(x){ return x.trim(); }).filter(function(x,i,a){
      return !(i===0&&x==='') && !(i===a.length-1&&x===''); });
    if(sp.length<2) return;
    var url=/(https?:\/\/[^\s)|]+)/.exec(sp[1]);
    if(!url) return;                       /* „je Produkt", „vom Nutzer" — kein Link */
    var name=sp[0].replace(/\*\*/g,'').replace(/\s*\(.*?\)\s*$/,'').trim();
    if(!name) return;
    aktuell.links.push({name:name, url:url[1]});
  });
  return gruppen.filter(function(g){ return g.links.length; });
}

async function _abLinksLaden(){
  var box=document.getElementById('abLinks'); if(!box) return;
  try{
    var r=await fetch('Links.md?cb='+Date.now());
    if(!r.ok) throw new Error('HTTP '+r.status);
    var g=_abLinksAusMd(await r.text());
    if(!g.length){ box.innerHTML='<div class="bleer">Links.md enthält keine Linkzeilen.</div>'; return; }
    var anzahl=g.reduce(function(s,x){ return s+x.links.length; },0);
    /* 🔴 AUFGEKLAPPT waeren es sieben Zeilen zusaetzlich zu vier Betriebszeilen
       und sechs Knoepfen — auf 300 px Kachelhoehe eine Scrollwueste. Gemessen
       mit dem Zeilenzaehler aus test-work121-cockpit.js. Als <details> kostet
       die Liste EINE Zeile, bis Ralph sie braucht. Der Browser merkt sich das
       nicht; das waere ein zweiter Speicherort fuer eine Anzeigeeinstellung
       und ist es nicht wert. */
    box.innerHTML='<details><summary style="cursor:pointer;font-size:11px;'
      +'font-weight:700;letter-spacing:.02em;text-transform:uppercase;'
      +'color:var(--abmut);padding:3px 0">Links · '+anzahl+' aus Links.md</summary>'
      + g.map(function(x){
          return '<div class="bzeile" style="align-items:flex-start"><span>'+esc(x.titel)+'</span>'
            +'<b style="font-weight:500;text-align:right">'
            + x.links.map(function(l){
                return '<a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer" '
                  +'title="'+esc(l.url)+'" style="color:inherit">'+esc(l.name)+'</a>';
              }).join(' · ')
            +'</b></div>';
        }).join('')
      +'</details>';
  }catch(e){
    box.innerHTML='<div class="bfehl"><b>Linkliste nicht ladbar.</b><br>'
      +esc((e&&e.message)||String(e))+'</div>';
    try{ console.warn('[Links]',e); }catch(_){}
  }
}

/* Nachladen. Jede Kachel EINZELN und mit eigenem Fangblock: faellt eine aus,
   stehen die anderen drei trotzdem (§11.4 — und der Grund landet sichtbar in
   der Kachel, nicht nur in der Konsole). */
async function _abBento2Laden(d){
  var setz=function(id,html){ var e=document.getElementById(id); if(e) e.innerHTML=html; };
  var fehl=function(id,e,was){
    var m=(e&&e.message)||String(e);
    setz(id,'<div class="bfehl"><b>'+esc(was)+' nicht ladbar.</b><br>'+esc(m)+'</div>');
    try{ console.error('[Bento2] '+was, e); }catch(_){}
  };

  /* --- Eingang, Stamm, Arbeit: kommen seit Work #121 aus dem Cockpit --------
     Drei Nachlader sind hier ENTFERNT, jeder mit seinem Grund (§3.7):
       · cb_top_aufrufe / cb_top_suchen — die Kachel „aktivitaet" zeigt jetzt
         die Zuflüsse. Beide RPCs bleiben in der Datenbank, sie haben nur
         keinen Platz mehr im Standard-Dashboard.
       · cb_admin_stamm_waechter — 4,9 s gemessen (Work #17); die Stammzahlen
         stehen im Cockpit und kommen aus Canonical statt aus dem Legacy-Stamm.
       · cb_admin_agent_work_liste — siehe _abRalphLaden weiter oben.
     Die Deutschlandkarte (#abRegion) laedt weiterhin nach: sie ist ein
     Kartenzeichner, keine Zahl (Kriterium 11). */

  /* --- Wirkkette (C3, 15.08.) ---------------------------------------------
     Zahlen aus cb_admin_architektur_liste. Sie kommen SERVERSEITIG gezaehlt
     aus dem Feld `counts` — hier wird nichts nachgerechnet, sonst gaebe es
     eine zweite Bilanz neben der des Diagramms (§4.2, §28.4). */
  (async function(){
    if(!document.getElementById('abWirk')) return;
    try{
      var r=await client.rpc('cb_admin_architektur_liste',{p_diagram_key:'produkterfassung'});
      if(r.error) throw r.error;
      var j=r.data; if(typeof j==='string') j=JSON.parse(j);
      var c=(j&&j.counts)||{};
      var z=function(l,v,f){ return '<div class="bzeile"><span>'+l+'</span><b'
        +(f?' style="color:'+f+'"':'')+'>'+(v==null?'–':v)+'</b></div>'; };
      setz('abWirk',
        '<div class="bort">Knoten gesamt: <b>'+(c.gesamt==null?'–':c.gesamt)+'</b></div>'
        + z('Bruch', c.bruch, (Number(c.bruch)>0?_AB.krit:null))
        + z('Lücke', c.lueck, (Number(c.lueck)>0?_AB.warn:null))
        + z('grün oder Grenze', (Number(c.gut)||0)+(Number(c.grenze)||0), _AB.gut)
        + z('Prio ① — blockiert das Ziel', c.prio1, (Number(c.prio1)>0?_AB.warn:null))
        + z('Prüfung offen', c.review_offen)
        + (Number(c.ralph_entscheid)>0
            ? '<div class="bleg" style="padding-top:8px"><span><i class="r"></i>'
              +c.ralph_entscheid+' wartet auf deine Entscheidung</span></div>' : '')
      );
    }catch(e){ fehl('abWirk',e,'Wirkkette'); }
  })();

  /* --- Nutzer & Regionen --------------------------------------------------- */
  (async function(){
    var u=(d&&d.nutzer)||{};
    var kopf='<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px">'
      +'<div><div class="bzahl" style="font-size:24px;color:'+_AB.kern+'">'
        +(u.gesamt==null?'–':u.gesamt)+'</div>'
      +'<div class="bunter">Nutzer gesamt</div></div>'
      +'<div><div class="bzahl" style="font-size:24px;color:'+_AB.mut+'">'
        +(u.aktiv_30t==null?'–':u.aktiv_30t)+'</div>'
      +'<div class="bunter">aktiv, 30 Tage</div></div>'
      +'<div><div class="bzahl" style="font-size:24px;color:'+_AB.mut+'">'
        +(u.premium==null?'–':u.premium)+'</div>'
      +'<div class="bunter">Premium</div></div></div>';
    setz('abRegion',kopf+'<div id="abKarte" class="abkarte"><div class="blade">Karte lädt…</div></div>');
    try{
      var r=await client.rpc('cb_bundesland_zaehlung');
      var k=r&&r.data; if(typeof k==='string') k=JSON.parse(k);
      if(r&&r.error) throw r.error;
      var box=document.getElementById('abKarte'); if(!box) return;
      if(!(k&&k.ok)){ box.innerHTML='<div class="bleerk">Keine Regionsdaten.</div>'; return; }
      var ges=Number(k.gesamt_mit_angabe)||0;
      if(!ges){ box.innerHTML='<div class="bleerk">Noch keine Angabe zum Bundesland.</div>'; return; }
      /* entKarteDE ist die BESTEHENDE Kartenfunktion — nicht nachgebaut (§22).
         Ralph wollte die Karte kleiner; das macht die Kachelbreite, nicht ein
         zweiter Zeichner. */
      box.innerHTML=entKarteDE(k.laender, ges, Number(u.gesamt)||0);
    }catch(e){
      var b=document.getElementById('abKarte');
      if(b) b.innerHTML='<div class="bfehl">Karte nicht ladbar.<br>'
        +esc((e&&e.message)||String(e))+'</div>';
      try{ console.error('[Bento2] Karte', e); }catch(_){}
    }
  })();

  /* --- Stamm-Ueberblick ----------------------------------------------------
     🔴 20.08.2026, Work #121: RIEGEL statt Loeschung. Die Standardkachel
     „Stamm" liest ihre Zahlen jetzt aus dem Cockpit und legt keinen Container
     #abStammU mehr an — dieser Block liefe also ins Leere und wuerde dabei
     trotzdem die 4,9-Sekunden-RPC ziehen. Der Riegel ist derselbe wie beim
     Wirkketten-Block darunter. Der Code bleibt stehen, samt seiner
     Waechter-Drilldowns, falls die alte Kachel zurueckgeholt wird (§3.7:
     abschalten schlaegt loeschen). */
  (async function(){
    if(!document.getElementById('abStammU')) return;
    var zweiter=false;
    try{
      var r=await client.rpc('cb_admin_stamm_waechter');
      /* Ein automatischer Nachschlag, wie beim Stammwaechter oben — dieselbe
         Ursache (#17), deshalb dieselbe Behandlung und nicht eine zweite. */
      if(r.error && /timeout|canceling statement/i.test(r.error.message||'')){
        zweiter=true;
        setz('abStammU','<div class="blade">erster Versuch zu langsam — zweiter läuft…</div>');
        await new Promise(function(w){ setTimeout(w,700); });
        r=await client.rpc('cb_admin_stamm_waechter');
      }
      if(r.error) throw r.error;
      var s=r.data||{}, N=s.neu||{}, AL=s.alt||{};
      /* 🔴 16.08.2026, Work #34, Ralph-Entscheid A: „nur die Anzeige wie unten
         bringt nichts, da muss ich schon etwas machen oder entscheiden koennen."
         Weg A heisst: JEDE Zahl fuehrt zu ihren Zeilen. Entscheiden kommt spaeter,
         je Waechter — geraten wird kein Knopf (§1).
         §22 ZUM SECHSTEN MAL: der Leseweg war schon da. cb_admin_stamm_waechter_liste
         deckt vier Waechter ab (regelfaelle · widersprueche_aktiv · doppelte_note ·
         quelle_offen), „unbewertet" laeuft ueber cb_admin_stamm_neu_liste(p_bewertung).
         Nichts davon wurde neu gebaut.
         Die uebrigen sechs haben SERVERSEITIG keine Liste. Sie bleiben deshalb
         bewusst stumpf und sagen im Titel, warum — eine Zahl, die so tut, als
         fuehrte sie irgendwohin, ist schlimmer als eine, die es zugibt. */
      var z=function(l,v,warn,wk){
        var n=Number(v)||0, klick=(wk&&n>0);
        return '<div class="bzeile'+(klick?' bklick':'')+'"'
          +(klick?' data-wk="'+esc(wk)+'" data-wl="'+esc(l)+'" data-wn="'+n+'" role="button" tabindex="0"'
                  +' title="Klick zeigt die '+n+' betroffenen Zeilen"'
                : (wk===null&&n>0?' title="Für diesen Wächter gibt es serverseitig noch keine Liste — als Work Item gemeldet."':''))
          +'><span>'+l+(klick?' <span class="bpfeil">›</span>':'')+'</span><b'
          +(warn&&n>0?' style="color:'+_AB.warn+'"':'')+'>'
          +(v==null?'–':v)+'</b></div>'; };
      /* 🔴 15.08.2026, Ralph: „den Stammwaechter oben brauchen wir dann nicht mehr, der ist
         unten in Stamm-Ueberblick — ggf. fehlendes unten ergaenzen."
         GEMESSENE DIFFERENZ vor dem Ergaenzen: die Kachel zeigte 6 von 12 Zahlen. Es fehlten
         vier des neuen Stamms (Reviewproblem · retired ohne Nachfolger · Alias auf nicht aktiv ·
         Legacy-Bindung auf nicht aktiv) und zwei des alten (Regelfaelle · Notenkonflikte) —
         ausgerechnet die vier ROTEN, also die, bei denen etwas zu tun ist. Dazu fehlten der
         Weg in den Stamm-Bereich (Ralph P12: was einen Weg hat, behaelt ihn) und der Hinweis,
         woher die Alt-Zahlen kommen.
         Die Reihenfolge ist woertlich die der Box oben uebernommen, damit niemand zwei
         Anordnungen derselben Zahlen im Kopf halten muss. */
      /* 🔴 17.08.2026, Ralph zum zweiten Mal: „da ist nirgends 740."
         Er hatte wieder recht, und Scrollen war die falsche Antwort. Die Kachel
         zeigte 13 Zeilen, davon FUENF mit Wert 0 — und ausgerechnet die beiden
         groessten Zahlen des ganzen Blocks (Regelfaelle 740, Quelle offen 554)
         standen ganz unten, verdraengt von Nullen. Wer zweimal scrollen muss,
         um die wichtigste Zahl zu sehen, findet sie nicht.
         JETZT: stille Zeilen werden je Block zu EINER Zeile zusammengefasst.
         Nichts ist versteckt — die Namen stehen darin, und wo eine 0 steht, gibt
         es ohnehin nichts anzuklicken. 13 Zeilen -> 9. */
      var still=[], sichtbar=function(l,v,warn,wk){
        if(Number(v)===0){ still.push(l); return ''; }
        return z(l,v,warn,wk);
      };
      var stillZeile=function(){
        if(!still.length) return '';
        var t=still.slice(); still=[];
        return '<div class="bzeile" style="opacity:.62" title="'+esc(t.join(' · '))+'">'
          +'<span>'+t.length+' still</span><b style="color:'+_AB.gut+'">✓</b></div>'
          +'<div style="font-size:10px;color:'+_AB.mut+';line-height:1.35;margin:-2px 0 2px">'
          +esc(t.join(' · '))+'</div>';
      };
      setz('abStammU',
         '<div class="babs" style="color:'+_AB.kern+'">Neu · Canonical, maßgeblich</div>'
        + z('aktiv',N.active_total)
        + sichtbar('unbewertet',N.unbewertet,true,'neu:unbewertet')
        + sichtbar('ohne Profil',N.ohne_profil,true,'neu:ohne_profil')
        + sichtbar('Reviewproblem',N.bewertet_nicht_approved,true,'neu:reviewproblem')
        + sichtbar('retired ohne Nachfolger',N.retired_ohne_nachfolger,true,'neu:retired')
        + sichtbar('Alias auf nicht aktiv',N.auto_alias_auf_nichtaktiv,true,'neu:alias')
        + sichtbar('Legacy-Bindung auf nicht aktiv',N.legacy_bindung_auf_nichtaktiv,true,'neu:legacy')
        + stillZeile()
        +'<div class="babs" style="margin-top:10px;color:'+_AB.grau+'">Alt · Legacy, Übergang</div>'
        + z('Einträge',AL.gesamt)
        + sichtbar('Regelfälle',AL.regelfaelle,true,'alt:regelfaelle')
        + sichtbar('Quelle offen',AL.quelle_offen,true,'alt:quelle_offen')
        + sichtbar('Widersprüche',AL.widersprueche_aktiv,true,'alt:widersprueche_aktiv')
        + sichtbar('Notenkonflikte',AL.doppelte_note,true,'alt:doppelte_note')
        + stillZeile()
        +'<div style="font-size:10.5px;color:'+_AB.mut+';margin-top:7px;line-height:1.4">'
        /* Work #112, 20.08.2026: dieselbe Korrektur wie im Freigabe-Tab. Diese
           Kachel ist seit #121 abgeschaltet, der Satz aber nicht weniger falsch
           — und wer sie zurueckholt, holt sonst die geloeschte Tabelle mit. */
        +'Alt-Zahlen aus <code>shadow_v1.legacy_ingredient_source_ref</code>, nicht aus dem '
        +'Canonical-Stamm — Kontrolle für den Übergang.</div>'
        +'<button type="button" class="bgo2" onclick="navTo(\'freigabe\');fgTab(\'stamm\')" '
        +'style="margin-top:9px;padding:5px 11px;border:1px solid var(--line);border-radius:8px;'
        +'background:var(--card);color:var(--ink);font-size:12px;font-weight:700;cursor:pointer">'
        +'Stamm öffnen →</button>'
        +(zweiter?'<div style="font-size:10.5px;color:'+_AB.warn+';margin-top:7px;line-height:1.4">'
          +'⚠ erst im zweiten Anlauf geladen — die Abfrage liegt auf der Zeitgrenze.</div>':'')
        +'<div class="bmehr" id="abStammMehr" style="display:none">↓ weiter scrollen</div>');
      _abStammKlickNach();
      _abStammMehrPruefen();
    }catch(e){
      /* Derselbe Timeout wie beim Stammwaechter (#17). Hier steht er in einer
         Kachel und blockiert nichts — mit Knopf statt Sackgasse. */
      var m=(e&&e.message)||String(e);
      var to=/timeout|canceling statement/i.test(m);
      setz('abStammU','<div class="bfehl"><b>Zahlen fehlen.</b><br>'
        +(to?'Die Abfrage brauchte zu lange (bekannt, Datenbankseite).':esc(m))
        +'<br><button type="button" class="abschnell" style="margin-top:7px" '
        +'onclick="_abStammUNach()">nochmal holen</button></div>');
      try{ console.error('[Bento2] Stamm', e); }catch(_){}
    }
  })();
}
/* ---------------------------------------------------------------------------
   WORK #34, Weg A: eine Stamm-Waechterzahl fuehrt zu ihren Zeilen.
   🔴 KEINE ZWEITE LISTE. Die Zeilen kommen so, wie der Server sie fuehrt —
   es wird nichts umbenannt, nichts gerechnet, nichts weggelassen. Angezeigt
   werden die Felder, die die Zeile hat; der Rest steht darunter als Feld:Wert.
   Fuer Produkte und Zutaten gibt es einen Weg weiter, sonst nicht.
   --------------------------------------------------------------------------- */
var _AB_STAMM_WEG={
  /* Woher die Zeilen kommen — GEMESSEN aus pg_get_functiondef, nicht geraten.
     'liste'  : cb_admin_stamm_waechter_liste(p_waechter,…) kennt genau diese vier.
     'unbew'  : cb_admin_stamm_neu_liste(…,p_bewertung='ohne') aus Work #14. */
  'alt:regelfaelle':        {art:'liste', key:'regelfaelle'},
  'alt:widersprueche_aktiv':{art:'liste', key:'widersprueche_aktiv'},
  'alt:doppelte_note':      {art:'liste', key:'doppelte_note'},
  'alt:quelle_offen':       {art:'liste', key:'quelle_offen'},
  'neu:unbewertet':         {art:'unbew'},
  /* 🔴 17.08.2026: ChatGPT hat die fuenf fehlenden Listen nachgeliefert. GEMESSEN
     durch Aufruf jedes Schluessels, nicht aus dem Funktionstext gelesen — mein
     erster Versuch suchte per Muster im Quelltext und fand sie NICHT, obwohl sie
     da waren. Derselbe Fehlertyp wie beim abgeschnittenen Regeltext (§31.2):
     ein Werkzeug mit unvollstaendiger Sicht antwortet trotzdem.
     Gemessen 17.08.: ohne_profil 3 · reviewproblem 1 · retired 0 · alias 0 ·
     legacy 0 · regelfaelle 740 · quelle_offen 554 · widersprueche 0 · doppelte 0. */
  'neu:ohne_profil':        {art:'liste', key:'ohne_profil'},
  'neu:reviewproblem':      {art:'liste', key:'reviewproblem'},
  'neu:retired':            {art:'liste', key:'retired_ohne_nachfolger'},
  'neu:alias':              {art:'liste', key:'alias_auf_nicht_aktiv'},
  'neu:legacy':             {art:'liste', key:'legacy_bindung_auf_nicht_aktiv'}
};
/* Zeigt den Scroll-Hinweis NUR, wenn wirklich etwas unter dem Rand liegt —
   gemessen an scrollHeight gegen clientHeight, nicht angenommen. */
function _abStammMehrPruefen(){
  var b=document.getElementById('abStammU'), h=document.getElementById('abStammMehr');
  if(!b||!h) return;
  var mehr=function(){ return b.scrollHeight - b.clientHeight > 8; };
  var setz=function(){ h.style.display=(mehr() && b.scrollTop + b.clientHeight < b.scrollHeight - 8)?'':'none'; };
  setz();
  b.addEventListener('scroll',setz);
  try{ addEventListener('resize',setz); }catch(e){}
}
/* Wovon handeln diese Zeilen? Zaehlt die Befunde der GELADENEN Zeilen. */
function _waVerteilung(rows, geladen, total){
  var z={}, n=0;
  (rows||[]).forEach(function(r){
    var k=String(r.detail||'').split(' · ')[0];
    if(!k) return; z[k]=(z[k]||0)+1; n++;
  });
  var l=Object.keys(z).map(function(k){ return {k:k,n:z[k]}; })
        .sort(function(a,b){ return b.n-a.n; });
  if(!n || l.length>6) return '';                 /* zu bunt, sagt nichts aus */
  if(l.length===1 && geladen<3) return '';        /* zu wenig, um etwas zu sagen */
  return '<div style="background:#f5f7f9;border-radius:9px;padding:8px 11px;margin-bottom:10px;'
    +'font-size:12px;line-height:1.5">'
    +'<b>Wovon handeln sie:</b> '
    +l.map(function(x){ return esc(x.k)+' <b>'+x.n+'×</b>'; }).join(' · ')
    +'<div style="font-size:10.5px;color:var(--muted,#6b7a85);margin-top:3px">'
    +'gezählt über die '+geladen+' geladenen Zeilen'
    +(total!=null&&total>geladen?', nicht über alle '+total:'')+'</div></div>';
}
function _abStammKlickNach(){
  var box=document.getElementById('abStammU'); if(!box) return;
  box.querySelectorAll('.bzeile.bklick').forEach(function(r){
    var auf=function(){ _abStammZeilen(r.dataset.wk, r.dataset.wl, Number(r.dataset.wn)); };
    r.addEventListener('click',auf);
    r.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); auf(); } });
  });
}
async function _abStammZeilen(wk, label, kachelZahl){
  var w=_AB_STAMM_WEG[wk]; if(!w) return;
  var ov=document.getElementById('waFaelleOv');
  if(!ov){ ov=document.createElement('div'); ov.id='waFaelleOv';
    ov.style.cssText='position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-start;'
      +'justify-content:center;background:rgba(20,32,48,.45);overflow:auto;padding:24px 12px';
    ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    document.body.appendChild(ov); }
  ov.innerHTML='<div style="background:var(--card,#fff);color:var(--ink,#22343a);border-radius:16px;'
    +'max-width:820px;width:100%;box-shadow:0 20px 60px rgba(20,40,70,.32);padding:20px;margin:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">'
    +'<div style="font-weight:800;font-size:17px">🛡️ '+esc(label||wk)+'</div>'
    +'<button onclick="var o=document.getElementById(\'waFaelleOv\');if(o)o.remove()" '
    +'style="border:0;background:var(--bg,#eef2f5);border-radius:8px;width:30px;height:30px;'
    +'cursor:pointer;font-size:16px">✕</button></div>'
    +'<div id="waFaelleBody" style="font-size:13px;color:var(--muted,#6b7a85);margin-top:10px">Lade Zeilen …</div></div>';
  try{
    var rows=[], total=null;
    if(w.art==='liste'){
      var r=await client.rpc('cb_admin_stamm_waechter_liste',{p_waechter:w.key,p_limit:200,p_offset:0});
      if(r.error) throw new Error(r.error.message);
      var d=r.data||{}; total=d.total; rows=(d.rows||[]).map(_waZeileDeuten);
    }else{
      /* Work #14: derselbe Weg, den der Stamm-Bereich schon benutzt. */
      var r2=await client.rpc('cb_admin_stamm_neu_liste',
        {p_suche:null,p_status:'active',p_limit:200,p_offset:0,p_bewertung:'ohne'});
      if(r2.error) throw new Error(r2.error.message);
      var d2=r2.data||{}; total=d2.total;
      rows=(d2.rows||d2.zeilen||[]).map(_waZeileDeuten);
    }
    var b=document.getElementById('waFaelleBody'); if(!b) return;
    if(!rows.length){ b.innerHTML='<div style="color:#1e6b42">Keine offenen Zeilen — still. ✓</div>'; return; }
    b.style.color='var(--ink,#22343a)';
    /* 🔴 17.08.2026, durch Ralphs Screenshot gefunden: die Kachel zeigte
       „Regelfaelle 4", die Liste lieferte 740 Zeilen. Zwei Zahlen fuer denselben
       Waechter — die Kachel liest den Zwischenspeicher, die Liste die View (§4.2).
       Ich kann das hier nicht heilen, beide Quellen gehoeren nicht mir. Aber ein
       Widerspruch, der niemandem auffaellt, ist gefaehrlicher als einer, der
       danebensteht. Also steht er daneben. */
    var streit=(kachelZahl!=null && total!=null && Number(kachelZahl)!==Number(total));
    b.innerHTML=(streit
      ? '<div style="background:#fdf1f1;border:1px solid #e6b8b8;border-radius:9px;padding:9px 11px;'
        +'margin-bottom:9px;font-size:12px;line-height:1.45;color:#8a2b2b">'
        +'<b>Die Kachel sagt '+esc(String(kachelZahl))+', diese Liste hat '+esc(String(total))+'.</b><br>'
        +'Beides kommt vom Server, aber aus zwei Quellen: die Kachelzahl aus einem '
        +'Zwischenspeicher, die Liste direkt aus der Prüfsicht. Gemeldet — verlass dich '
        +'auf die Liste, nicht auf die Kachelzahl.</div>'
      : '')
      +'<div style="margin-bottom:6px;color:var(--muted,#6b7a85)">'
      +rows.length+' von '+(total==null?rows.length:total)+' Zeilen'
      +(total!=null&&total>rows.length?' — die ersten 200':'')+'</div>'
      /* 🔴 17.08.: Ralphs Liste war 200-mal dieselbe Zeile. Gemessen am ganzen
         Bestand sind 739 der 740 „Regelfaelle" derselbe Fall (Bewertung fehlt)
         und nur EINER eine echte Regelverletzung. Diese Verteilung gehoert an
         den Anfang, sonst blaettert man 200 Zeilen fuer eine Erkenntnis.
         Gezaehlt wird NUR ueber die geladenen Zeilen — und das steht auch dabei,
         damit die Zahl nicht fuer den Gesamtbestand gehalten wird (§1.3). */
      +_waVerteilung(rows, rows.length, total)
      +rows.map(function(x){
        var prod=(x.typ==='produkt');
        return '<div style="display:flex;align-items:flex-start;gap:8px;padding:9px 0;'
          +'border-top:1px solid var(--line,#e3e9ec)">'
          +'<div style="flex:1 1 240px;min-width:0">'
          +'<div style="font-weight:700">'+esc(x.name||x.id)+'</div>'
          +'<div style="font-size:11.5px;color:var(--muted,#6b7a85)">'+esc(x.detail||'')+'</div></div>'
          +(prod?'<button onclick="dashOpenProdukt(\''+esc(x.id)+'\');'
              +'var o=document.getElementById(\'waFaelleOv\');if(o)o.remove()" '
              +'style="flex:0 0 auto;border:1px solid #107e3e;background:#eef8f1;color:#1e6b42;'
              +'border-radius:9px;padding:7px 13px;font-weight:700;font-size:12.5px;cursor:pointer">'
              +'Öffnen ›</button>':'')
        +'</div>'; }).join('')
      +'<div style="font-size:11px;color:var(--muted,#6b7a85);margin-top:10px;line-height:1.45">'
      +'🔴 Weg A (Ralph 16.08.): hier wird <b>gezeigt</b>, noch nicht entschieden. '
      +'Was du je Wächter tun können sollst, steht noch nicht fest — ein geratener Knopf '
      +'wäre schlimmer als keiner.</div>';
  }catch(e){
    var b2=document.getElementById('waFaelleBody');
    if(b2){ b2.style.color='#cf5442'; b2.textContent='Konnte die Zeilen nicht laden: '+((e&&e.message)||e); }
    try{ console.warn('[Stamm-Zeilen]',wk,e); }catch(_){}
  }
}
if(typeof window!=='undefined'){ window._abStammZeilen=_abStammZeilen; }

/* Eigener Einstieg fuer den Wiederholen-Knopf — er darf nicht die ganze Reihe
   neu laden, nur seine Kachel. */
async function _abStammUNach(){
  var e=document.getElementById('abStammU'); if(!e) return;
  e.innerHTML='<div class="blade">lädt…</div>';
  try{ await _abBento2Laden(_abD); }catch(x){ try{ console.error('_abStammUNach',x); }catch(_){} }
}
if(typeof window!=='undefined') window._abStammUNach=_abStammUNach;

/* Kleiner Ring fuer die Kachel. Bewusst NUR eine Zusammenfassung — den
   klickbaren Ring mit Einzelsegmenten gibt es weiter unten in voller Groesse
   (_abRing). Hier waere er zu klein zum Treffen. */
function _abRingKlein(w,A){
  var ges=w.length||1, still=ges-A.melden;
  var u=2*Math.PI*26, anteil=still/ges;
  var f=(A.gate_offen>0)?_AB.krit:(A.melden>0?_AB.warn:_AB.gut);
  return '<svg width="62" height="62" viewBox="0 0 62 62" style="flex:0 0 auto">'
    +'<circle cx="31" cy="31" r="26" fill="none" stroke="#eef0f4" stroke-width="7"/>'
    +'<circle cx="31" cy="31" r="26" fill="none" stroke="'+f+'" stroke-width="7" '
      +'stroke-linecap="round" stroke-dasharray="'+(u*anteil).toFixed(1)+' '+u.toFixed(1)+'" '
      +'transform="rotate(-90 31 31)"/></svg>';
}

/* --------------------------------------------------------------------------- */
function dashArbeitHtml(d,np,fehler){
  _abD=d; _abNp=np;
  var A=_abAbl(np);
  var ri=(d&&d.riki)||{}, k=(d&&d.katalog)||{}, q=(d&&d.qualitaet)||{}, ex=(np&&np.extra)||{};
  var lim=Number(ri.monatslimit_usd)||0, verbr=Number(ri.monat_usd)||0;
  var ans=dashArbeitAnsichtGet();
  var h='<div class="ab">';
  /* 🔴 DURCHGANG 2 (15.08.2026): Kopfzeile und KPI-Reihe sind durch Hero + Bento
     ERSETZT, nicht ergaenzt. Beides zu zeigen hiesse, dieselbe Zahl zweimal auf
     eine Seite zu schreiben — und zwei Zahlen auf derselben Seite widersprechen
     sich irgendwann (§4.2). Der Umschalter und der Aktualisieren-Knopf sind in
     den Hero gewandert und behalten ihre IDs (#abStand, #abNeu), damit
     _abUmschalterNach() unveraendert weiterfunktioniert.
     Was aus der KPI-Reihe wohin ging: Katalog + Index-Schnitt -> Kachel
     „Datenbestand" · Wartestapel -> Hero · Waechter melden -> Hero und Kachel
     „Waechter-Status" · Riki-Budget -> Kachel „Riki-Budget". Keine Zahl ist
     weggefallen. */
  h+=_abHero(d,np,A,ans);
  if(fehler) h+='<div class="abfehler"><b>Live-Daten unvollständig.</b> '+esc(fehler)
    +' — betroffene Felder bleiben leer oder grau. Grau heißt: wir wissen es nicht.</div>';

  /* Beide Bento-Reihen liegen in EINEM Behaelter, damit der Anordnen-Modus sie
     zusammen neu zeichnen kann, ohne die Seite neu zu laden. */
  /* 🔴 26.08.2026, Ralph: „die wächter wolltest du nach oben bauen."
     Reihenfolge jetzt: Termine → Wächter-Raster → Kacheln. Die Wächter sind das,
     woran gearbeitet wird; sie standen ganz unten hinter allem anderen. */
  h+='<div id="abBentoBox">'+_abEditLeiste()+_abProjektzeitHtml()
    +_abWaechterPanel(np,A)
    +_abBento(d,np,A)+_abBento2()
    +'<div id="abZeitBox"></div>'+_abCmdHtml()+'</div>';

  /* ==========================================================================
     DETAILEBENE UNTER DEM BENTO  ·  entdoppelt am 20.08.2026, Work #121
     --------------------------------------------------------------------------
     🔴 HIER STANDEN VIER BLOECKE, DREI DAVON ZEIGTEN DIESELBEN ZAHLEN NOCH
     EINMAL. Bis heute war das begruendet: „hier sitzen die Drilldowns, die das
     Bento nicht hat" (Ralph P12). Seit #121 HAT das Bento Drilldowns — jede
     Zahl mit drill_key oeffnet cb_admin_dashboard_cockpit_drill mit echten
     Zeilen. Damit faellt die Begruendung weg, und was bleibt, ist eine zweite
     Anzeige derselben Sache (§4.2, Kriterium 8).

     GEMESSEN 20.08. gegen cb_netzplan, bevor etwas entfernt wurde:
       · „Alle offenen Punkte"  = dieselben 6 Zufluesse wie die Kachel Eingang
       · „Herzschlag"           = dieselben 3 Takte wie die Kachel Betrieb
       · „Zutaten im Stamm 705" = Legacy-Zaehler; das Cockpit sagt 944 aus
         Canonical. ZWEI Zahlen fuer dieselbe Frage, und #121 verbietet den
         Altstamm-Zeilencount als Kennzahl ausdruecklich.
       · „Tagebuch, 7 Tage"     = steht in der Kachel Nutzung (131)
     WAS BLEIBT, weil es diese Zahlen NUR hier gibt:
       · der Waechterring und das Raster darunter — 23 Waechter, das Cockpit
         fuehrt nur die 8 Gate-Waechter. Die uebrigen 15 haetten sonst keinen Ort.
       · „Woher der Katalog stammt" — 6 Quellen mit Zahlen, im Cockpit nicht.
       · Rezepte und Regelwerk-Bereiche — ebenfalls nirgends sonst.

     KEIN WEG GEHT VERLOREN (Ralph P12): die Zeilen von _abJobs sprangen an eine
     Stelle der Seite; die Kachel Eingang oeffnet stattdessen die Serverliste
     der wartenden Eintraege. Das ist mehr, nicht weniger. _abJobsListe bleibt
     unangetastet — die freie Kachel vom Typ „liste" liest sie weiter.
     ========================================================================== */
  /* 🔴 26.08.2026, Ralph: „ich dachte an diese wächter anzeige. die anderen
     kacheln können weg." — und zum Ring ausdrücklich: „auch weg."
     ENTFERNT: der Wächterring „Alle Wächter im Einzelnen" und der Block
     „Woher der Katalog stammt" samt Rezepte/Regelwerk.
     Der Ring zeigte dieselben 23 Wächter wie das Raster darunter, nur als
     Kreis, in dem man die Namen nur mit dem Zeiger findet. Zwei Anzeigen für
     dieselbe Sache — das Raster gewinnt, weil man dort lesen kann, was los ist.
     _abRing und _abQuellen bleiben im Code stehen: die freie Kachel und der
     Anordnen-Modus greifen darauf zu. Entfernt ist der feste Platz, nicht das
     Werkzeug. */

  /* Das Wächter-Raster steht jetzt OBEN, direkt unter den Terminen — siehe
     abBentoBox weiter oben. Hier stand es bis zum 26.08.2026 ganz unten. */

  h+='</div>';
  return h;
}

/* ---------------------------------------------------------------------------
   Nach dem Rendern verdrahten. Getrennt, weil innerHTML die Handler wegwirft.
   --------------------------------------------------------------------------- */
function dashArbeitNach(d,np){
  var A=_abAbl(np), box=document.getElementById('fgDash'); if(!box) return;
  var st=document.getElementById('abStand');
  if(st&&np&&np.stand){
    try{ st.textContent='Stand '+new Date(np.stand)
      .toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch(e){ st.textContent='Stand unbekannt';
      try{ console.warn('Stand-Zeit nicht lesbar:',np.stand,e); }catch(_){} }
  }
  _abUmschalterNach();

  /* Ring-Segmente: Klick springt in die passende Wächter-Gruppe */
  var wl=[]; ['anlage','tuer','bestand'].forEach(function(m){
    ((np&&np.waechter)||[]).filter(function(x){return x.moment===m;}).forEach(function(x){ wl.push(x); }); });
  box.querySelectorAll('#abRing .abseg').forEach(function(p){
    var w=wl[Number(p.dataset.w)]; if(!w) return;
    p.addEventListener('mouseenter',function(){ p.setAttribute('opacity','1'); });
    p.addEventListener('mouseleave',function(){ p.setAttribute('opacity',(Number(w.offen)||0)===0?'0.26':'1'); });
    p.addEventListener('click',function(){ _abWfSet(w.moment,np,A); });
  });
  /* Arbeitsliste: Sprünge in die bestehenden Ansichten - keine neuen Wege */
  /* 🔴 15.08.2026: der Sprung steht jetzt an EINER Stelle und wird von der alten
     Liste UND von den neuen Bento-Zeilen benutzt. Vorher haette die Kachel ihre
     eigene Sprungtabelle gebraucht — zwei Orte, die auseinanderlaufen (§4.2). */
  /* 15.08. Work #42/E5: aus der lokalen Variablen wurde eine Funktion im
     Dateikopf-Rang — der Anordnen-Modus verdrahtet die Bento-Zeilen neu und
     kommt an eine Closure hier drin nicht heran. Inhalt unveraendert. */
  box.querySelectorAll('.abjob[data-ziel]').forEach(function(j){
    j.addEventListener('click',function(){ _abSprung(j.dataset.ziel); });
  });
  _abNachRest(box,d,np,A);
}

function _abSprung(z){
    try{
      if(z==='scan'&&typeof scanEingangOeffnen==='function') scanEingangOeffnen();
      else if(z==='todo'&&typeof todoDockAuf==='function') todoDockAuf();
      else if(z==='waechter'){ var g=document.getElementById('abWg'); if(g) g.scrollIntoView({behavior:'smooth',block:'center'}); }
      /* 'fluss' bleibt als Schluessel bestehen, damit ein alter, noch im DOM stehender
         data-ziel-Wert nicht ins Leere laeuft — beide zeigen auf dieselbe Stelle. */
      else if(z==='punkte'||z==='fluss'){ var f=document.getElementById('abDetail'); if(f) f.scrollIntoView({behavior:'smooth',block:'start'}); }
    }catch(e){ try{ console.warn('Sprung fehlgeschlagen:',z,e); }catch(_){} }
}

function _abNachRest(box,d,np,A){
  box.querySelectorAll('.abhero [data-hero]').forEach(function(x){
    x.addEventListener('click',function(){ _abSprung(x.getAttribute('data-hero')); });
  });
  /* Alles, was IN den Bento-Reihen haengt, wird an EINER Stelle verdrahtet —
     der Anordnen-Modus zeichnet sie neu und braucht dieselbe Verdrahtung.
     Zwei Fassungen davon waeren genau der Fall aus §4.2. */
  _abBentoNach(box);
  _abProjektzeitStart();
  /* Gespeichertes Layout holen — NACH dem ersten Zeichnen, nicht davor. Das
     Dashboard darf nicht auf eine Abfrage warten (dieselbe Regel wie Reihe 2,
     Work #17). Der Riegel in _abLayoutHolen sorgt dafuer, dass es genau einmal
     laeuft und das Neuzeichnen es nicht wieder anstoesst. */
  try{ _abLayoutHolen(); }catch(e){ try{ console.warn('[Layout]',e); }catch(_){} }
  /* Work #121: dieselbe Regel wie beim Layout — erst zeichnen, dann holen.
     Das Cockpit braucht gemessene 2,9 bis 3,8 s; solange steht „lädt" in Hero
     und Kacheln, und zwar sichtbar statt als leere Flaeche. */
  try{ _abCockpitHolen(); }catch(e){ try{ console.warn('[Cockpit v2]',e); }catch(_){} }
  var an=document.getElementById('abAnordnen');
  if(an) an.addEventListener('click',function(){
    an.classList.toggle('on', _abEditModus(!_AB_EDIT));
    _abNeuZeichnen();
  });
  _abWaechterNach(np,A);
  try{ _abWaechterWache(np,A); }catch(e){}
}
function _abWfSet(m,np,A){
  var box=document.getElementById('fgDash'); if(!box) return;
  box.querySelectorAll('.abtab[data-wf]').forEach(function(x){
    x.classList.toggle('on', x.dataset.wf===m); });
  _abWgMal(m,np,A);
  var g=document.getElementById('abWg'); if(g) g.scrollIntoView({behavior:'smooth',block:'center'});
}
/* Welche Quelle hat schon eine kuratierte Fallliste? GEMESSEN aus
   pg_get_functiondef('cb_waechter_faelle') am 16.08.2026 — nicht geraten.
   Diese neun bringen zusaetzlich den Befundtext und (bei 3) die Abhak-Knoepfe;
   die uebrigen 16 gehen ueber cb_admin_waechter_faelle_view. */
var _AB_WNR={
  'v_zutaten_qa_offen':1, 'v_zutaten_qa_r9':2, 'v_naehrwerte_qa_offen':3,
  'v_kategorie_qa_offen':4, 'v_zusatzstoffe_qa_offen':5, 'v_zusatzstoffe_neu_offen':6,
  'v_quelle_qa_offen':7, 'v_zutaten_namenlos_offen':8, 'v_score_achse_fehlt_offen':9
};
function _abWgMal(f,np,A){
  var g=document.getElementById('abWg'); if(!g) return;
  var l=((np&&np.waechter)||[]).slice();
  if(f==='melden') l=l.filter(function(x){return (Number(x.offen)||0)>0;});
  else if(f==='gate') l=l.filter(function(x){return x.gate===true;});
  else if(['anlage','tuer','bestand'].indexOf(f)>=0) l=l.filter(function(x){return x.moment===f;});
  l.sort(function(a,b){ return (Number(b.offen)||0)-(Number(a.offen)||0)
    || String(a.name).localeCompare(String(b.name)); });
  var MOM={anlage:'ANLAGE',tuer:'TÜR',bestand:'BESTAND'};
  /* 🔴 16.08.2026: die Kacheln waren NICHT klickbar (Ralph: „ich kann nicht
     klicken, nicht passiert und nichts wird angezeigt"). Der Weg dorthin war
     seit Monaten da — dashWaechterFaelle mit dem vollen Ueberlagerungsfenster,
     Oeffnen-Knopf und Abhaken. Es fehlte nur die Verdrahtung (§22). */
  /* ==========================================================================
     KIPPSCHALTER-LEISTE  ·  Ralph-Auftrag 26.08.2026
     --------------------------------------------------------------------------
     „sie sollten aber anders dargestellt sein, damit sie in eine zeile passen,
     dürfen etwas kleiner sein. ich hätte sie gern so in dieser art dargestellt
     als kippschalter, leuchte in grün, gelb und rot. zahl darunter."

     Eine Lampe je Wächter, darunter die Zahl, darunter der Kurzname. 23 Stück
     passen so nebeneinander; wird das Fenster schmal, bricht die Zeile um,
     statt zu quetschen.

     DIE DREI FARBEN HABEN EINE BEDEUTUNG, sie sind keine Deko:
       grün  = 0 offen. Der Wächter ist still.
       gelb  = offen, blockiert aber die Freigabe NICHT.
       rot   = offen UND Go-Live-Gate. Das hält den Livegang auf.
     Damit sieht Ralph auf einen Blick, was ihn am 1.10. wirklich stoppt.

     Der Klickweg bleibt unverändert: dashWaechterFaelle über view und Nummer
     (§22, kein zweiter Weg). Nur das Aussehen ist neu.
     ========================================================================== */
  /* ==========================================================================
     ECHTE KIPPSCHALTER  ·  Ralph 26.08.2026: „optik von dir hässlich"
     --------------------------------------------------------------------------
     Er hatte recht. Meine erste Fassung war ein graues Rechteck mit einem
     Balken drin. Nachgesehen, was einen Kippschalter ausmacht, und die vier
     Merkmale übernommen, die auf allen Vorlagen vorkommen:
       1. ON- und OFF-Schild als farbige Plaketten mit weisser Schrift
       2. eine SECHSKANTMUTTER aus Chrom um den Hebelfuss — das prägendste Teil
       3. ein Hebel mit KUGELKOPF, nicht ein Stift
       4. Lichtkante oben, Schatten unten auf der Platte
     Als SVG, weil ein Sechskant und ein Kugelverlauf in CSS bei 40 Pixeln
     matschig werden. Die Verläufe stehen EINMAL in <defs> und werden 23-mal
     benutzt — nicht 23-mal derselbe Code im DOM.

     Der Hebel steht oben, wenn der Wächter meldet — wie eine ausgelöste
     Sicherung. Die Plakette auf seiner Seite leuchtet, die andere ist matt.
     Die Lampe darüber trägt die Ampelfarbe: grün still · gelb offen, blockiert
     nicht · rot offen und Go-Live-Gate.
     ========================================================================== */
  /* ══════════════════════════════════════════════════════════════════════
     STATUS-KACHELN  ·  Ralph-Auftrag 31.08.2026
     ----------------------------------------------------------------------
     „Wächter im Admin als kompakte Status-Kacheln darstellen. w_system als
     erste/übergeordnete Kachel sichtbar machen. Alle Werte ausschließlich
     aus cb_netzplan, keine zweite Logik. 0 klar als OK, offene Fälle mit
     Zahl/Warnung, technischer Wächterfehler rot. Klick auf Fachwächter
     öffnet unverändert die bestehende Fallliste."

     WAS HIER STAND: 23 Kippschalter als SVG, je 52 Pixel breit, mit
     Sechskantmutter, Kugelkopf und Verläufen. Sie sahen nach Schaltpult aus,
     aber die Zahl stand klein unter einer Grafik, die selbst nichts sagte.
     Eine Kachel, die man lesen kann, schlägt einen Schalter, den man
     bewundert.

     w_system IST ANDERS ALS DIE ÜBRIGEN und steht deshalb oben allein:
     die 23 Fachwächter zählen fachliche Fälle, w_system prüft die Wächter
     SELBST — ob sie existieren, laufen, frische Zahlen liefern und
     übereinstimmend zählen. Meldet er etwas, sind die 23 Zahlen darunter
     womöglich gar nicht belastbar. Diese Kachel bekommt deshalb die volle
     Breite und wird auch dann gezeigt, wenn der Reiterfilter sie ausblenden
     würde — eine Warnung, die ein Filter verstecken kann, ist keine.

     ALLE ZAHLEN KOMMEN AUS cb_netzplan (offen, gate, view, moment). Hier
     wird nichts nachgerechnet und nichts zweitgezählt (§4.2).

     DIE DREI ZUSTÄNDE:
       grün  offen = 0            still, nichts zu tun
       gelb  offen > 0, kein Gate offene Fälle, blockieren die Freigabe nicht
       rot   offen > 0 UND Gate   offene Fälle, die den Livegang aufhalten
       rot   w_system > 0         technischer Wächterfehler
     Der Klickweg bleibt unverändert: dashWaechterFaelle über view und Nummer.
     ══════════════════════════════════════════════════════════════════════ */
  var FARBE={
    gruen:{rand:'#b7e3c6', flaeche:'#f2fbf5', text:'#0f7a3d', punkt:'#22a05a'},
    gelb :{rand:'#f0d79a', flaeche:'#fffaf0', text:'#8a6100', punkt:'#e0a32e'},
    rot  :{rand:'#f3bdb5', flaeche:'#fff5f3', text:'#a3241a', punkt:'#d13b2a'}
  };
  var _art=function(w){
    var n=Number(w.offen)||0;
    if(n===0) return 'gruen';
    return (w.gate===true) ? 'rot' : 'gelb';
  };

  /* w_system kommt IMMER aus dem vollen Bestand, nie aus der gefilterten
     Auswahl - sonst blendet ein Reiter die Warnung über die Wächter aus. */
  var alleW=((np&&np.waechter)||[]);
  var sys=alleW.filter(function(x){ return String(x.id)==='w_system'; })[0]||null;
  var fach=l.filter(function(x){ return String(x.id)!=='w_system'; });

  var kopf='';
  if(sys){
    var sn=Number(sys.offen)||0, sart=(sn===0?'gruen':'rot'), sc=FARBE[sart];
    var snr=_AB_WNR[sys.view]||'';
    kopf='<div class="abwsys" role="button" tabindex="0"'
      +' data-wview="'+esc(sys.view||'')+'" data-wnr="'+snr+'" data-wname="'+esc(String(sys.name||'Wächter-System'))+'"'
      +' style="flex:1 1 100%;display:flex;align-items:center;gap:12px;padding:10px 13px;'
      +'border:1px solid '+sc.rand+';border-left:5px solid '+sc.punkt+';border-radius:11px;'
      +'background:'+sc.flaeche+';cursor:pointer;user-select:none;-webkit-user-select:none;margin-bottom:8px"'
      +' title="'+esc(String(sys.kurz||''))+'\nQuelle: '+esc(String(sys.view||''))+'\nKlick zeigt die Fälle">'
      +'<span style="width:11px;height:11px;border-radius:50%;background:'+sc.punkt+';flex:0 0 auto;'
        +'box-shadow:0 0 0 3px '+sc.punkt+'22"></span>'
      +'<span style="flex:1 1 auto;min-width:0">'
        +'<b style="font-size:13px;color:'+sc.text+'">'+esc(String(sys.name||'Wächter-System'))+'</b>'
        +'<span style="display:block;font-size:11px;color:#6b7280;margin-top:1px">'
        +(sn===0
           ? 'Alle Wächter laufen, liefern frische Zahlen und zählen übereinstimmend.'
           : '<b style="color:'+sc.text+'">Technischer Wächterfehler</b> – die Zahlen unten sind womöglich nicht belastbar.')
        +'</span></span>'
      +'<span style="flex:0 0 auto;font-size:19px;font-weight:800;font-variant-numeric:tabular-nums;'
        +'color:'+sc.text+'">'+(sn===0?'OK':sn)+'</span>'
      +'</div>';
  }

  g.innerHTML=kopf+fach.map(function(w){
    var n=Number(w.offen)||0, still=(n===0);
    var art=_art(w), c=FARBE[art];
    var nr=_AB_WNR[w.view]||'';
    var nm=String(w.name||w.id||'');
    return '<div class="abwc" role="button" tabindex="0"'
      +' data-wview="'+esc(w.view||'')+'" data-wnr="'+nr+'" data-wname="'+esc(nm)+'"'
      +' style="flex:0 0 auto;width:132px;display:flex;align-items:center;gap:7px;'
      +'padding:7px 9px;border:1px solid '+c.rand+';border-radius:9px;background:'+c.flaeche+';'
      +'cursor:pointer;user-select:none;-webkit-user-select:none"'
      +' title="'+esc(nm)+' — '+(still?'still, nichts offen':(n+' offen'))
      +(w.gate===true?' · Go-Live-Gate: blockiert die Freigabe':' · blockiert die Freigabe nicht')
      +'\n'+esc(String(w.kurz||''))+'\nQuelle: '+esc(String(w.view||''))+'\nKlick zeigt die Fälle">'
      +'<span style="width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:'+c.punkt+'"></span>'
      +'<span style="flex:1 1 auto;min-width:0;font-size:10.5px;line-height:1.25;color:#3f4650;'
        +'overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'
        +esc(nm)+(w.gate===true?'<span style="color:'+c.text+';font-weight:700" title="Go-Live-Gate"> ●</span>':'')
      +'</span>'
      +'<span style="flex:0 0 auto;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;'
        +'color:'+c.text+'">'+(still?'OK':n)+'</span>'
    +'</div>';
  }).join('')||(kopf?'':'<div style="font-size:12.5px;color:'+_AB.mut+';padding:4px">'+(f==='melden'?'Kein Wächter meldet etwas. ✓':'Kein Wächter in dieser Auswahl.')+'</div>');
  /* Die Leiste selbst: eine Zeile, bei schmalem Fenster Umbruch statt Quetschen. */
  g.style.cssText='display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start';
  /* Kopfkachel und Fachkacheln nehmen DENSELBEN Klickweg - dashWaechterFaelle
     ueber view und Nummer. Kein zweiter Weg, auch nicht fuer w_system (§22). */
  g.querySelectorAll('.abwc, .abwsys').forEach(function(c){
    var auf=function(){
      var nr=Number(c.dataset.wnr)||null;
      dashWaechterFaelle(nr, encodeURIComponent(c.dataset.wname||''), c.dataset.wview||'');
    };
    c.addEventListener('click',auf);
    c.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); auf(); } });
  });
  var wf=document.getElementById('abWf');
  if(wf) wf.innerHTML='<b>'+fach.length+'</b> angezeigt · '+A.melden+' von '
    +((np&&np.waechter)||[]).length+' melden etwas · Go-Live-Gate: <b style="color:'
    +(A.gate_offen?_AB.krit:_AB.gut)+'">'+A.gate_offen+'</b> offen (muss 0 sein) · '
    +'Prüfpunkte: Anlage '+A.anlage.n+' · Tür '+A.tuer.n+' · Bestand '+A.bestand.n;
}

/* ---------------------------------------------------------------------------
   GRAPH-ANSICHT (Mockup A). Eigene Physik, kein CDN.
   --------------------------------------------------------------------------- */
var _abG={lauf:false,N:[],L:[],zieh:null,offen:null,filter:'alle',ruhe:false,sel:null};
function _abGraphStop(){ _abG.lauf=false; }
function _abGraphStart(np,A){
  var cv=document.getElementById('abCv'); if(!cv) return;
  var cx=cv.getContext('2d'), W=0;
  function groesse(){ var r=cv.getBoundingClientRect(); cv.width=r.width*devicePixelRatio;
    cv.height=560*devicePixelRatio; cx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); W=r.width; }
  groesse(); addEventListener('resize',groesse);

  function baue(){
    _abG.N=[]; _abG.L=[];
    var add=function(o){ _abG.N.push(Object.assign({vx:0,vy:0,r:9},o)); };
    add({id:'kern',t:'Root Index',art:'kern',farbe:_AB.kern,r:26,x:W*0.55,y:280,
         zahl:_abKernZahl(np,'aktiv'),unter:'aktive Produkte · Ø '+_abKernZahl(np,'schnitt')+' Index'});
    ((np&&np.zufluesse)||[]).forEach(function(z,i){
      var n=Number(z.wartend)||0;
      add({id:'zf'+i,t:String(z.name).split(' (')[0],art:'zufluss',z:z,farbe:_abZf(z),
        r:9+Math.min(15,Math.sqrt(n)*2.6),x:120,y:70+i*76,zahl:n,unter:z.was||''});
      _abG.L.push({a:'zf'+i,b:'pp0',len:z.weg==='keiner'?250:180,tot:z.weg==='keiner'});
    });
    [['anlage','Prüfpunkt Anlage',A.anlage],['tuer','Prüfpunkt Tür',A.tuer],
     ['bestand','Prüfpunkt Bestand',A.bestand]].forEach(function(p,i){
      var gate=((np&&np.waechter)||[]).filter(function(w){
        return w.moment===p[0]&&w.gate===true&&(Number(w.offen)||0)>0; }).length;
      add({id:'pp'+i,t:p[1],art:'pruef',moment:p[0],
        farbe:gate>0?_AB.krit:(p[2].o>0?_AB.warn:_AB.gut),
        r:13+Math.min(11,Math.sqrt(p[2].o)),x:W*0.36,y:120+i*150,zahl:p[2].o,
        unter:p[2].n+' Wächter · '+p[2].o+' Meldungen'});
      _abG.L.push({a:'pp'+i,b:'kern',len:200});
    });
    _abG.L.push({a:'pp0',b:'pp1',len:150}); _abG.L.push({a:'pp1',b:'pp2',len:150});
    /* 🔴 14.09.2026, Work #633: cb_takt_status liefert jetzt ALLE aktiven Takte aus
       cron.job statt der fuenf, die sich selbst gemeldet hatten (einer davon lief
       zuletzt am 08.08.). Mit 41 Knoten bei y=90+i*70 liefe die Zeichnung bis
       y=2890 aus dem Bild. Gezeichnet wird deshalb, was etwas zu sagen hat:
       jeder Takt mit Fehlerserie oder Fehlerstatus - und EIN Sammelknoten fuer
       die, die einfach laufen. Eine Wand aus 41 gruenen Punkten sagt nichts. */
    var _tk=(np&&np.takte)||[];
    var _tkStumm=_tk.filter(function(t){ return !(Number(t.fehler_serie)||0) && Number(t.status)!==500; });
    var _tkLaut=_tk.filter(function(t){ return (Number(t.fehler_serie)||0) || Number(t.status)===500; })
                   .slice(0,8);
    _tkLaut.forEach(function(t,i){
      var ser=Number(t.fehler_serie)||0;
      add({id:'tk'+i,t:t.takt,art:'takt',farbe:_AB.krit,r:11,x:W*0.8,y:90+i*70,
        puls:false,unter:(ser>0?'scheitert '+ser+'×':'letzter Lauf gescheitert')
          +(t.minuten_her==null?'':' · vor '+t.minuten_her+' Min')});
      _abG.L.push({a:'tk'+i,b:i===0?'kern':'pp0',len:210});
    });
    if(_tkStumm.length){
      var _i=_tkLaut.length;
      var _lauf=_tkStumm.filter(function(t){ return Number(t.status)===202; }).length;
      add({id:'tk'+_i,t:_tkStumm.length+' Takte laufen',art:'takt',farbe:_AB.gut,r:13,
        x:W*0.8,y:90+_i*70,puls:true,
        unter:'ohne Fehler'+(_lauf?' · '+_lauf+' gerade im Lauf':'')});
      _abG.L.push({a:'tk'+_i,b:_i===0?'kern':'pp0',len:210});
    }
    if(_abG.offen){
      var ws=((np&&np.waechter)||[]).filter(function(w){return w.moment===_abG.offen;});
      var p=_abG.N.filter(function(n){return n.moment===_abG.offen;})[0];
      if(p) ws.forEach(function(w,i){
        var ang=(i/ws.length)*Math.PI*2, n=Number(w.offen)||0;
        add({id:'w'+i,t:w.name,art:'waechter',w:w,farbe:n===0?_AB.grau:(w.gate===true?_AB.krit:_AB.warn),
          r:6+Math.min(9,Math.sqrt(n)*1.5),x:p.x+Math.cos(ang)*105,y:p.y+Math.sin(ang)*105,
          zahl:n,unter:w.kurz||''});
        _abG.L.push({a:p.id,b:'w'+i,len:100,duenn:true});
      });
    }
  }
  function sicht(n){
    if(_abG.filter==='probleme') return (Number(n.zahl)||0)>0||n.art==='kern'||n.farbe===_AB.krit;
    return true;
  }
  function finde(id){ for(var i=0;i<_abG.N.length;i++) if(_abG.N[i].id===id) return _abG.N[i]; return null; }
  var t0=0;
  function schritt(ts){
    if(!_abG.lauf) return;
    var dt=Math.min(32,ts-t0)||16; t0=ts;
    var vis=_abG.N.filter(sicht);
    if(!_abG.ruhe){
      for(var i=0;i<vis.length;i++) for(var j=i+1;j<vis.length;j++){
        var a=vis[i],b=vis[j],dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy; if(d2<1)d2=1;
        var dd=Math.sqrt(d2), soll=(a.r+b.r)*2.1+32;
        if(dd<soll*2.4){ var kk=Math.min(2.2,soll*soll/d2)*0.55;
          a.vx-=dx/dd*kk;a.vy-=dy/dd*kk;b.vx+=dx/dd*kk;b.vy+=dy/dd*kk; }
      }
      _abG.L.forEach(function(l){
        var a=finde(l.a),b=finde(l.b); if(!a||!b||!sicht(a)||!sicht(b)) return;
        var dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy)||1,kk=(dd-l.len)*0.0055;
        a.vx+=dx/dd*kk*10;a.vy+=dy/dd*kk*10;b.vx-=dx/dd*kk*10;b.vy-=dy/dd*kk*10;
      });
      vis.forEach(function(n){
        if(n===_abG.zieh) return;
        n.vx+=(W*0.5-n.x)*0.0009*(n.art==='kern'?4:1);
        n.vy+=(280-n.y)*0.0009*(n.art==='kern'?4:1);
        n.vx*=0.86;n.vy*=0.86; n.x+=n.vx*dt*0.06; n.y+=n.vy*dt*0.06;
        n.x=Math.max(n.r+66,Math.min(W-n.r-66,n.x));
        n.y=Math.max(n.r+22,Math.min(560-n.r-22,n.y));
      });
    }
    cx.clearRect(0,0,W,560);
    _abG.L.forEach(function(l){
      var a=finde(l.a),b=finde(l.b); if(!a||!b||!sicht(a)||!sicht(b)) return;
      if(l.tot){
        var dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy)||1;
        var ex=a.x+dx/dd*dd*0.42, ey=a.y+dy/dd*dd*0.42;
        cx.strokeStyle='#e8b4b4';cx.lineWidth=2;cx.setLineDash([6,5]);
        cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(ex,ey);cx.stroke();cx.setLineDash([]);
        cx.strokeStyle=_AB.krit;cx.lineWidth=4;cx.beginPath();
        cx.moveTo(ex-dy/dd*9,ey+dx/dd*9);cx.lineTo(ex+dy/dd*9,ey-dx/dd*9);cx.stroke();
        return;
      }
      cx.strokeStyle=l.duenn?'#e9ecf1':'#dfe3ea'; cx.lineWidth=l.duenn?1:1.6;
      cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.stroke();
    });
    _abG.N.filter(sicht).forEach(function(n){
      if(n.puls){ var p=(Math.sin(ts/560)+1)/2;
        cx.strokeStyle=n.farbe;cx.globalAlpha=0.16+p*0.2;cx.lineWidth=2;
        cx.beginPath();cx.arc(n.x,n.y,n.r+6+p*7,0,7);cx.stroke();cx.globalAlpha=1; }
      if(n.id===_abG.sel){ cx.strokeStyle=n.farbe;cx.globalAlpha=0.3;cx.lineWidth=8;
        cx.beginPath();cx.arc(n.x,n.y,n.r+5,0,7);cx.stroke();cx.globalAlpha=1; }
      cx.fillStyle='#fff';cx.beginPath();cx.arc(n.x,n.y,n.r,0,7);cx.fill();
      cx.strokeStyle=n.farbe;cx.lineWidth=n.art==='kern'?4:3;cx.stroke();
      if(Number(n.zahl)>0||n.art==='kern'){ cx.fillStyle=n.farbe;
        cx.font='700 '+Math.max(10,Math.min(15,n.r))+'px system-ui';
        cx.textAlign='center';cx.textBaseline='middle';cx.fillText(n.zahl,n.x,n.y); }
      cx.fillStyle=_AB.ink;cx.font=(n.art==='kern'?'700 12.5px':'600 11.5px')+' system-ui';
      cx.textAlign='center';cx.textBaseline='top';cx.fillText(n.t,n.x,n.y+n.r+5);
    });
    requestAnimationFrame(schritt);
  }
  function treffer(mx,my){
    var c=_abG.N.filter(sicht);
    for(var i=c.length-1;i>=0;i--) if(Math.hypot(c[i].x-mx,c[i].y-my)<=c[i].r+6) return c[i];
    return null;
  }
  cv.addEventListener('mousedown',function(e){ var r=cv.getBoundingClientRect();
    _abG.zieh=treffer(e.clientX-r.left,e.clientY-r.top); if(_abG.zieh) cv.classList.add('zieh'); });
  addEventListener('mousemove',function(e){ if(!_abG.zieh) return; var r=cv.getBoundingClientRect();
    _abG.zieh.x=e.clientX-r.left; _abG.zieh.y=e.clientY-r.top; _abG.zieh.vx=_abG.zieh.vy=0; });
  addEventListener('mouseup',function(){ _abG.zieh=null; cv.classList.remove('zieh'); });
  cv.addEventListener('click',function(e){ var r=cv.getBoundingClientRect();
    var n=treffer(e.clientX-r.left,e.clientY-r.top); if(!n) return;
    _abG.sel=n.id;
    if(n.art==='pruef'){ _abG.offen=(_abG.offen===n.moment)?null:n.moment; baue(); }
    _abGDet(n,np,A); });
  var rb=document.getElementById('abRuhe');
  if(rb) rb.addEventListener('click',function(){ _abG.ruhe=!_abG.ruhe;
    rb.textContent=_abG.ruhe?'Bewegung an':'Bewegung aus'; });
  document.querySelectorAll('#fgDash .abtab[data-gf]').forEach(function(t){
    t.addEventListener('click',function(){
      document.querySelectorAll('#fgDash .abtab[data-gf]').forEach(function(x){x.classList.remove('on');});
      t.classList.add('on'); _abG.filter=t.dataset.gf; });
  });
  baue(); _abG.lauf=true; _abGDet(finde('kern'),np,A); requestAnimationFrame(schritt);
}
function _abGDet(n,np,A){
  var d=document.getElementById('abDet'); if(!d||!n) return;
  var art={zufluss:'Zufluss',pruef:'Prüfpunkt',takt:'Takt',kern:'Kern',waechter:'Wächter'}[n.art]||'';
  var h='<div style="font-weight:800;font-size:15px;display:flex;gap:8px;align-items:center">'
    +'<span class="abdot" style="background:'+n.farbe+'"></span>'+esc(n.t)+'</div>'
    +'<div style="font-size:11.5px;color:'+_AB.mut+';margin-top:2px">'+art+'</div>'
    +'<div style="font-size:12.5px;color:'+_AB.mut+';line-height:1.6;margin-top:9px">'+esc(n.unter||'')+'</div>';
  if(n.art==='zufluss'&&n.z){
    h+='<div class="abkv"><span>wartet</span><b>'+(n.z.wartend||0)+'</b></div>'
      +'<div class="abkv"><span>ältester</span><b>'
      +(n.z.aeltester_tage==null?'—':n.z.aeltester_tage+' Tage')+'</b></div>';
    if(n.z.weg==='keiner') h+='<div style="font-size:11.5px;color:#8d2b2b;background:#fdf1f1;'
      +'border:1px solid #f0c2c2;border-radius:9px;padding:8px 10px;margin-top:9px">'
      +'Sackgasse: keine Automatik greift hier. '+esc(n.z.hinweis||'')+'</div>';
  }
  if(n.art==='pruef'){
    var ws=((np&&np.waechter)||[]).filter(function(w){return w.moment===n.moment;})
      .sort(function(a,b){return (Number(b.offen)||0)-(Number(a.offen)||0);});
    h+='<div class="abkv"><span>Wächter hier</span><b>'+ws.length+'</b></div>'
      +'<div class="abkv"><span>davon Gate</span><b>'+ws.filter(function(w){return w.gate===true;}).length+'</b></div>'
      +'<div style="max-height:240px;overflow:auto;margin-top:8px">';
    ws.forEach(function(w){
      var nn=Number(w.offen)||0;
      h+='<div style="display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 0;'
        +'border-bottom:1px solid #f2f4f7"><span class="abdot" style="width:7px;height:7px;background:'
        +_abWf(w)+'"></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;'
        +'white-space:nowrap">'+(w.gate===true?'⛔ ':'')+esc(w.name)+'</span>'
        +'<b style="color:'+(nn===0?_AB.grau:_abWf(w))+'">'+nn+'</b></div>';
    });
    h+='</div>';
  }
  d.innerHTML=h;
}

if(typeof window!=='undefined'){
  window.dashArbeitAnsichtSet=dashArbeitAnsichtSet;
  window.dashArbeitHtml=dashArbeitHtml;
  window.dashArbeitNach=dashArbeitNach;
}

/* ============================================================
   ADMIN-DASHBOARD  (2026-07-13)
   Kein Schönfärben: Was unvollständig ist, steht drin. Was Geld kostet, steht drin.
   ============================================================ */
function kpi(label, wert, farbeWert, hinweis, drillKey){
  /* Optionaler drillKey (50d): macht die Kachel anklickbar und oeffnet die
     betroffenen Eintraege. Nur sinnvoll, wenn der Wert > 0 ist - bei 0 gibt es
     nichts zu zeigen, dann bleibt die Kachel ruhig. */
  var klick = (drillKey && Number(String(wert).replace(/[^0-9.]/g,''))>0);
  var attr = klick ? ' onclick="dashDrill(\''+drillKey+'\',\''+esc(label)+'\')" title="Betroffene anzeigen"' : '';
  var cur = klick ? 'cursor:pointer;' : '';
  var pfeil = klick ? '<span style="color:var(--muted);font-size:13px;flex:0 0 auto">›</span>' : '';
  /* Kompakte Karte mit fester Breite (Ralph 22.07.: „etwas groß und nicht sehr schön"): nicht mehr
     über die ganze Breite gestreckt, sondern gleich große Kacheln, die links bündig umbrechen. */
  return '<div'+attr+' style="flex:0 0 auto;width:180px;box-sizing:border-box;background:var(--card);border:1px solid '+(klick?'var(--k-16a34a)':'var(--line)')+';'
    +'border-radius:12px;padding:11px 13px;'+cur+'">'
    +'<div style="font-size:11px;color:var(--muted);line-height:1.3;display:flex;justify-content:space-between;align-items:center;gap:6px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+label+'</span>'+pfeil+'</div>'
    +'<div style="font-size:24px;font-weight:800;color:'+(farbeWert||'var(--ink)')+';line-height:1.15;margin-top:5px">'+wert+'</div>'
    +(hinweis?'<div style="font-size:10.5px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+hinweis+'</div>':'')
    +'</div>';
}
/* Drill-Down (50d): zeigt die betroffenen Zutaten/Produkte einer Kachel,
   Produkte direkt zum Bearbeiten. */
function dashDrill(key, titel){
  var ov=document.getElementById('drillOv'); if(ov) ov.remove();
  ov=document.createElement('div'); ov.id='drillOv'; ov.dataset.key=key;
  ov.style.cssText='position:fixed;inset:0;background:rgba(15,30,35,.5);z-index:9998;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto';
  ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
  /* Modal hell (passt zum neuen Dashboard) + zentriert. */
  ov.innerHTML='<div style="background:#fff;color:#22343a;max-width:600px;width:100%;border-radius:14px;padding:16px 18px;box-shadow:0 18px 50px rgba(0,0,0,.35)">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:15px">'+esc(titel)+'</b>'
    +'<button onclick="document.getElementById(\'drillOv\').remove()" style="border:0;background:#eef2f3;color:#22343a;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px">×</button></div>'
    +'<div id="drillBody" style="font-size:13px;color:#5b6d73">Lade…</div></div>';
  document.body.appendChild(ov);
  dashDrillLoad(key);
}
/* Getrennt, damit „Nochmal versuchen" bei einem Netzwerk-Aussetzer („Load failed") einfach neu lädt,
   ohne das Fenster neu aufzubauen. Der echte Fehler geht IMMER in die Konsole (§1.13i: nie stumm). */
async function dashDrillLoad(key){
  var body=document.getElementById('drillBody'); if(!body) return;
  body.innerHTML='<span style="color:#5b6d73">Lade…</span>';
  try{
    var r=await client.rpc('cb_dashboard_drill',{p_key:key});
    body=document.getElementById('drillBody'); if(!body) return;
    if(r&&r.error){ throw new Error(r.error.message||'RPC-Fehler'); }
    var rows=(r&&r.data)||[];
    if(!rows.length){ body.innerHTML='<span style="color:#107e3e">Nichts offen. ✓</span>'; return; }
    var _slBtn=(key==='ohne_quelle')?'<button onclick="rikiSammellauf()" style="width:100%;margin-bottom:10px;background:linear-gradient(90deg,#7b5be6,#c04bd6);color:#fff;border:0;border-radius:9px;padding:10px;font-weight:800;cursor:pointer">🤖 Riki-Sammellauf starten – Herstellerseiten lesen &amp; Quelle dokumentieren</button>':'';
    body.innerHTML=_slBtn+'<div style="margin-bottom:6px;color:#5b6d73">'+rows.length+' Einträge</div>'+rows.map(function(x){
      var _stil='flex:0 0 auto;padding:5px 10px;border:1px solid #0a6ed1;border-radius:8px;background:#eaf3fd;color:#0a6ed1;cursor:pointer;font-size:12px;font-weight:600';
      var _btn=function(fn,txt){ return '<button onclick="'+fn+'" style="'+_stil+'">'+(txt||'Bearbeiten')+'</button>'; };
      /* 🔴 Work #190, 22.08.2026 — hier stand _btn("zutStammEdit('…')").
         zutStammEdit ruft cb_zutat_stamm_get, und die RPC ist serverseitig
         abgeschaltet ({ok:false, deprecated:true}). Der Knopf oeffnete ein leeres
         Bearbeitungsfenster mit Speichern-Knopf. Gemessen an 981 Zeilen in fuenf
         Drill-Schluesseln (regelverstoesse 677 · stamm_ohne_kategorie 262 ·
         mehrdeutig 29 · zusatz_nicht_kategorisiert 10 · zutat_quelle 3).
         KEIN inline onclick mit dem Namen: esc() maskiert Apostrophe nicht, und
         genau einer der 677 Namen traegt einen. Ein Knopf, der bei einer Zeile
         einen Syntaxfehler wirft, ist schlimmer als kein Knopf. Deshalb
         data-Attribut plus Horcher weiter unten. */
      var edit = (x.kind==='produkt'&&x.id) ? _btn("dashOpenProdukt('"+esc(x.id)+"')")
               : (x.kind==='zutat'&&x.name) ? '<button type="button" class="dashZutGo" data-name="'
                   +esc(String(x.name))+'" style="'+_stil+'" title="Öffnet die Canonical-Stammliste, '
                   +'gefiltert auf diesen Namen">Im Stamm suchen</button>'
               : '';
      return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 2px;border-top:1px solid #eef2f3">'
        +'<div style="min-width:0"><div style="font-weight:600;color:#22343a">'+esc(x.name||'—')+'</div><div style="font-size:11.5px;color:#5b6d73">'+esc(x.info||'')+'</div></div>'+edit+'</div>';
    }).join('');
    /* Work #190: Horcher statt inline onclick — siehe Begruendung oben. Der
       Name kommt aus dem data-Attribut, damit Apostrophe nichts kaputt machen. */
    try{
      body.querySelectorAll('.dashZutGo').forEach(function(btn){
        btn.addEventListener('click',function(){
          if(typeof _abZutatImStammSuchen==='function'){
            var ov=document.getElementById('drillOv'); if(ov) ov.remove();
            _abZutatImStammSuchen(btn.dataset.name||'');
          }
        });
      });
    }catch(e){ try{ console.warn('[Stammweg] Horcher:',e); }catch(_){} }
  }catch(e){
    try{ console.error('cb_dashboard_drill', key, e); }catch(_){}
    body=document.getElementById('drillBody'); if(!body) return;
    var msg=(e&&e.message)||String(e);
    var net=/load failed|failed to fetch|networkerror|network error/i.test(msg);
    body.innerHTML='<div style="color:#bb0000;margin-bottom:10px">'+(net?'Verbindung unterbrochen – die Abfrage kam nicht durch. Das lag am Netz, nicht an den Daten.':('Fehler: '+esc(msg)))+'</div>'
      +'<button onclick="dashDrillLoad(\''+key+'\')" style="padding:8px 14px;border:0;border-radius:9px;background:#17505c;color:#fff;font-weight:700;cursor:pointer">↻ Nochmal versuchen</button>';
  }
}

/* Produkt aus dem Dashboard-Drill SAUBER öffnen (Ralph 22.07.): Vorher lief openFgEditor(id)
   ohne Ziel-Container mitten im Dashboard-Vollbild (body.dashFull) → der Editor lag verschoben
   über Kopfleiste/Ampel-Schiene. Jetzt wechseln wir in „Produkt erfassen" (das hebt body.dashFull
   auf) und öffnen das Produkt dort INLINE über den getesteten peSelect-Weg. */
function dashOpenProdukt(id){
  try{ var ov=document.getElementById('drillOv'); if(ov) ov.remove(); }catch(e){}
  try{ if(typeof fgTab==='function') fgTab('produkterfassung'); }catch(e){}
  /* 🔴 27.08.2026, Ralph: „bei den waechtern funktionieren die links zum produkt nicht".
     Gemessen im Code: #peDetail entsteht erst NACH loadProduktErfassung() — das sind zwei
     Serverrunden (cb_erfassung_liste + Zaehler). Das Warten hier brach nach 50×60 ms = 3 s
     ab und tat dann GAR NICHTS: kein Editor, keine Meldung. Ein Klick, auf den nichts folgt,
     sieht aus wie ein kaputter Link — er war nur zu ungeduldig.
     Jetzt: 12 s Geduld, danach der Overlay-Editor als Rueckfall (der braucht #peDetail gar
     nicht), und erst wenn auch der nicht kommt, eine sichtbare Meldung. Fehler nie
     verschlucken (§1.13i). */
  var tries=0;
  var open=function(){
    var det=document.getElementById('peDetail');
    if(!det){
      if(tries++<200){ setTimeout(open,60); return; }
      /* Rueckfall: Editor im Vollbild-Overlay, ohne Ziel-Container. */
      try{
        if(typeof openFgEditor==='function'){ openFgEditor(id); return; }
        throw new Error('openFgEditor fehlt');
      }catch(e){
        alert('Produkt '+id+' konnte nicht geöffnet werden.\n\n'+((e&&e.message)||e));
      }
      return;
    }
    try{
      if(typeof peSelect==='function') peSelect(id);
      else openFgEditor(id,null,det);
      det.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){ det.innerHTML='<div style="color:#cf5442">Editor-Fehler: '+esc((e&&e.message)||e)+'</div>'; }
  };
  open();
}
if(typeof window!=='undefined'){ window.dashOpenProdukt=dashOpenProdukt; }

/* ===== Riki-Sammellauf (Ralph 22.07.2026) =============================================
   Liest die Herstellerseiten der „ohne Quelle"-Produkte MIT Link der Reihe nach und
   DOKUMENTIERT nur die Quelle (Typ + Beleg) — überschreibt KEINE Nährwerte/Zutaten und
   setzt NICHT auf Verifiziert=Ja (§6: Riki liefert den Beleg, der Mensch prüft). Budget-
   Stopp: meldet die Edge-Function ein Limit, hält der Lauf sofort an. Kein Blind-Stapel. */
async function rikiSammellauf(){
  if(window._sammellaufRunning) return;
  var ov=document.createElement('div'); ov.id='sammellaufOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(6,10,16,.55);z-index:90;display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML='<div style="background:#fff;color:#22343a;border-radius:14px;max-width:560px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
    +'<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eef2f3"><b style="font-size:15px;flex:1">🤖 Riki-Sammellauf</b>'
      +'<button id="slClose" style="border:0;background:#f0f2f4;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px">✕</button></div>'
    +'<div style="padding:14px 16px">'
      +'<div style="font-size:12.5px;color:#5b6d73;line-height:1.5;margin-bottom:10px">Riki liest die Herstellerseiten der Produkte <b>ohne Quelle, die einen Link haben</b>. Bei Erfolg wird nur die <b>Quelle dokumentiert</b> (Typ + Beleg) — Nährwerte/Zutaten bleiben unangetastet, <b>Verifiziert bleibt „Nein"</b> (dein Review). Budget-Stopp ist aktiv.</div>'
      +'<div style="height:8px;border-radius:999px;background:#eceef0;overflow:hidden;margin-bottom:6px"><div id="slProg" style="width:0%;height:100%;background:linear-gradient(90deg,#22d3c5,#3b82f6);transition:width .2s"></div></div>'
      +'<div id="slStat" style="font-size:12px;color:#5b6d73;margin-bottom:10px">Lade Liste…</div>'
      +'<div id="slList" style="font-size:12.5px"></div>'
      +'<div style="display:flex;gap:8px;margin-top:12px"><button id="slStart" style="flex:1;background:#17505c;color:#fff;border:0;border-radius:9px;padding:10px;font-weight:700;cursor:pointer" disabled>▶ Starten</button>'
        +'<button id="slStop" style="background:#f7dede;color:#a11111;border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer;display:none">■ Stopp</button></div>'
    +'</div></div>';
  document.body.appendChild(ov);
  var $=function(id){ return document.getElementById(id); };
  $('slClose').onclick=function(){ if(window._sammellaufRunning) window._sammellaufStop=true; ov.remove(); };
  var items=[];
  try{ var r=await client.rpc('cb_sammellauf_liste'); if(r.error) throw new Error(r.error.message); items=r.data||[]; }
  catch(e){ $('slStat').innerHTML='<span style="color:#bb0000">Fehler beim Laden: '+esc((e&&e.message)||String(e))+'</span>'; return; }
  if(!items.length){ $('slStat').textContent='Keine Produkte mit Link ohne Quelle – nichts zu tun.'; return; }
  $('slStat').textContent=items.length+' Produkte mit Link bereit.';
  $('slStart').disabled=false;
  $('slList').innerHTML=items.map(function(it,i){ return '<div id="sl_'+i+'" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #eef2f3"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc((it.marke?it.marke+' · ':'')+it.name)+'</span><span class="slst" style="font-size:11px;color:#8a9aa0;flex:0 0 auto">wartet</span></div>'; }).join('');
  $('slStart').onclick=async function(){
    window._sammellaufRunning=true; window._sammellaufStop=false;
    $('slStart').style.display='none'; $('slStop').style.display='';
    $('slStop').onclick=function(){ window._sammellaufStop=true; $('slStop').textContent='stoppe…'; };
    var ok=0, leer=0, feh=0;
    for(var i=0;i<items.length;i++){
      if(window._sammellaufStop) break;
      var it=items[i]; var row=$('sl_'+i); var st=row?row.querySelector('.slst'):null;
      if(st){ st.textContent='liest…'; st.style.color='#0a6ed1'; }
      try{
        var s=await client.auth.getSession(); var tok=(s&&s.data&&s.data.session)?s.data.session.access_token:client.supabaseKey;
        var resp=await fetch(client.supabaseUrl+'/functions/v1/riki-herstellerseite',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':client.supabaseKey},body:JSON.stringify({url:it.link, product_id:it.produkt_id||null})});
        var d=await resp.json();
        if(d && d.error && /budget|limit|monatslimit/i.test(String(d.error))){ if(st){ st.textContent='Budget voll – Stopp'; st.style.color='#a11111'; } window._sammellaufStop=true; break; }
        if(d && d.leer){ leer++; if(st){ st.textContent='leer / nicht lesbar'; st.style.color='#b45309'; } }
        else if(d && d.error){ feh++; if(st){ st.textContent='Fehler'; st.style.color='#bb0000'; } }
        else {
          var typ=/amazon\./i.test(String(it.link))?'Amazon/Haendler':'Herstellerseite';
          var beleg=typ+': '+it.link+' (Riki-Sammellauf, Prüfung offen)';
          var sr=await client.rpc('cb_produkt_quelle_setzen',{p_id:it.produkt_id,p_typ:typ,p_beleg:beleg});
          if(sr.error||!(sr.data&&sr.data.ok)){ feh++; if(st){ st.textContent='Speicher-Fehler'; st.style.color='#bb0000'; } }
          else { ok++; if(st){ st.textContent='✓ '+typ; st.style.color='#107e3e'; } }
        }
      }catch(e){ feh++; if(st){ st.textContent='Fehler'; st.style.color='#bb0000'; } }
      $('slProg').style.width=Math.round((i+1)/items.length*100)+'%';
      $('slStat').textContent=(i+1)+' / '+items.length+' · ✓ '+ok+' · leer '+leer+' · Fehler '+feh;
      await new Promise(function(res){ setTimeout(res,400); });
    }
    window._sammellaufRunning=false; $('slStop').style.display='none';
    $('slStat').innerHTML='<b>Fertig.</b> '+ok+' Quelle dokumentiert · '+leer+' leer · '+feh+' Fehler'+(window._sammellaufStop?' · gestoppt':'')+'. <span style="color:#5b6d73">Bitte prüfen – Verifiziert bleibt „Nein".</span>';
    try{ if(typeof loadDashboard==='function') loadDashboard(); }catch(e){}
  };
}
if(typeof window!=='undefined'){ window.rikiSammellauf=rikiSammellauf; }

/* ===== Dashboard-Ansicht umschalten (Ralph 22.07.): klassisch <-> Vorgang 1:1 =====
   Merkt sich die Wahl in localStorage (ri_dash_ansicht), genau wie der Editor-Umschalter. */
/* Etappe 3 (Ralph 24.07.2026): die drei alten Dashboard-Umschalter (Command Center / Klassisch /
   Vorgang 1:1) sind weg. Es gibt nur noch EINE Dashboard-Ansicht. Der alte Klassisch/Vorgang-Code
   bleibt als toter Code stehen (Sicherheitsnetz), wird aber nie mehr aufgerufen. */
function dashAnsichtGet(){ return 'portal'; }
function dashAnsichtSet(v){ if(typeof loadDashboard==='function') loadDashboard(); }
function dashSwitchHtml(ansicht){ return ''; }
if(typeof window!=='undefined'){ window.dashAnsichtSet=dashAnsichtSet; }
function dashVorgangCss(){
  if(document.getElementById('dashVorgangCss')) return;
  /* Wie peLightCssInject: die --k-<hex>-Tokens tragen ihren Hellwert im Namen (im Dunkelmodus
     sind sie umgemappt) – hier für #fgDash auf die Hellwerte zurücksetzen, damit das Dashboard
     im hellen „Vorgangs"-Look erscheint, ohne den restlichen Admin anzufassen. */
  var toks={};
  try{ for(var i=0;i<document.styleSheets.length;i++){ var rules=null; try{ rules=document.styleSheets[i].cssRules; }catch(e){ rules=null; } if(!rules) continue;
    for(var j=0;j<rules.length;j++){ var st=rules[j].style; if(!st||!st.length) continue; for(var k2=0;k2<st.length;k2++){ var p=st[k2]; if(/^--k-[0-9a-f]{6}$/.test(p)) toks[p]='#'+p.slice(4); } } } }catch(e){}
  var tokCss=''; for(var key in toks){ tokCss+=key+':'+toks[key]+';'; }
  var css=
   '#fgDash{color-scheme:light;color:#22343a;'+tokCss+'--bg:#eaeef0;--card:#ffffff;--ink:#22343a;--muted:#5b6d73;--line:#d9e1e4;--green:#107e3e;--auf-gruen:#ffffff;--shadow:0 10px 40px rgba(0,0,0,.18)}'
  +'#fgDash input,#fgDash select{color-scheme:light;background:#fff;color:#22343a;border-color:#d3dbe6}'
  +'#fgDash .dvBand{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#17505c;color:#eaf4f6;padding:12px 18px;border-radius:12px 12px 0 0}'
  +'#fgDash .dvBand h2{font-size:18px;margin:0;font-weight:800}'
  +'#fgDash .dvStatus{background:#ffe1de;color:#a11111;font-weight:800;font-size:11px;letter-spacing:.4px;padding:4px 11px;border-radius:20px;text-transform:uppercase}'
  +'#fgDash .dvStatus.ok{background:#dff3e6;color:#0d6b34}'
  +'#fgDash .dvBand .r{margin-left:auto;display:flex;gap:12px;align-items:center;font-size:12.5px}'
  +'#fgDash .dvBand .btn{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);color:#fff;padding:6px 12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:12.5px}'
  +'#fgDash .dvMeta{display:flex;gap:24px;flex-wrap:wrap;padding:11px 18px;background:#fff;border:1px solid #d9e1e4;border-top:0;border-radius:0 0 12px 12px;font-size:12.5px;margin-bottom:14px}'
  +'#fgDash .dvMeta b{display:block;color:#5b6d73;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}'
  +'#fgDash .dvMeta span{font-weight:700}'
  +'#fgDash .dvGrid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:14px;align-items:start}'
  +'@media(max-width:1100px){#fgDash .dvGrid{grid-template-columns:1fr}}'
  +'#fgDash .dvRail{background:#fff;border:1px solid #d9e1e4;border-radius:12px;padding:13px;position:sticky;top:8px}'
  +'#fgDash .dvRail .lbl{font-weight:800;letter-spacing:1px;color:#1c6a7a;font-size:10.5px;text-transform:uppercase;margin-bottom:10px}'
  +'#fgDash .dvStep{display:flex;gap:9px}'
  +'#fgDash .dvStep .dc{display:flex;flex-direction:column;align-items:center;flex:0 0 auto}'
  +'#fgDash .dvStep .dot{width:20px;height:20px;border-radius:50%;margin-top:1px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;line-height:1}'
  +'#fgDash .dvStep .line{flex:1;width:2px;background:#dde4e6;margin:2px 0}'
  +'#fgDash .dvStep:last-child .line{display:none}'
  +'#fgDash .dot-err{background:#bb0000}'
  +'#fgDash .dot-warn{background:#e9730c}'
  +'#fgDash .dot-ok{background:#107e3e}'
  +'#fgDash .dvStep .tx{padding:1px 0 11px;min-width:0;flex:1}'
  +'#fgDash .dvStep .tx.klick{cursor:pointer}'
  +'#fgDash .dvStep .tx.klick:hover .t{color:#0a6ed1}'
  +'#fgDash .dvStep .tx .t{font-weight:700;font-size:12.5px;display:flex;justify-content:space-between;gap:8px}'
  +'#fgDash .dvStep .tx .d{color:#5b6d73;font-size:11px}'
  +'#fgDash .dvTabs{display:flex;border:1px solid #d9e1e4;border-radius:12px;overflow:hidden;background:#fff;margin-bottom:14px}'
  +'#fgDash .dvTab{flex:1;text-align:center;padding:11px 6px;font-size:12.5px;font-weight:700;color:#5b6d73;cursor:pointer}'
  +'#fgDash .dvTab .ic{font-size:15px;display:block;line-height:1;margin-bottom:3px}'
  +'#fgDash .dvTab:hover{background:#f1f5f6}'
  +'#fgDash .dvTab.active{background:#17505c;color:#fff}'
  +'#fgDash .dvHelp{position:fixed;right:18px;bottom:18px;width:322px;background:#fff;border:1px solid #bcd3dc;border-radius:14px;box-shadow:0 14px 38px rgba(20,60,70,.26);overflow:hidden;z-index:60}'
  +'#fgDash .dvHelp .hh{display:flex;align-items:center;gap:8px;background:#17505c;color:#eaf4f6;padding:10px 13px;font-weight:800;font-size:12px}'
  +'#fgDash .dvHelp .hh .x{margin-left:auto;cursor:pointer;opacity:.85}'
  +'#fgDash .dvHelp .hsub{padding:8px 13px 3px;font-size:11.5px;color:#5b6d73}'
  +'#fgDash .dvTask{display:flex;gap:9px;align-items:center;padding:9px 13px;border-top:1px solid #eef2f3}'
  +'#fgDash .dvTask .pri{flex:0 0 auto;width:19px;height:19px;border-radius:50%;font-size:11px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center}'
  +'#fgDash .dvTask .body{flex:1;min-width:0}'
  +'#fgDash .dvTask .tt{font-weight:700;font-size:12.5px}'
  +'#fgDash .dvTask .td{font-size:11.5px;color:#5b6d73;line-height:1.35}'
  +'#fgDash .dvTask .go{flex:0 0 auto;background:#d6e9ff;color:#0a6ed1;border:0;border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer}'
  +'#fgDash .dvReopen{position:fixed;right:18px;bottom:18px;background:#17505c;color:#fff;border:0;border-radius:24px;padding:10px 16px;font-weight:700;cursor:pointer;box-shadow:0 8px 22px rgba(20,60,70,.3);z-index:60}'
  /* Ansicht-Umschalter (Ralph 22.07.): klassisch <-> Vorgang 1:1 – oben im Dashboard, in beiden Modi sichtbar. */
  +'#fgDash .dashSwitch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;color:#5b6d73}'
  +'#fgDash .dashSwitch .grp{display:inline-flex;border:1px solid #cdd6d9;border-radius:9px;overflow:hidden}'
  +'#fgDash .dashSwitch button{border:0;background:#fff;color:#39525a;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer}'
  +'#fgDash .dashSwitch button.active{background:#17505c;color:#fff}'
  +'#fgDash .dashSwitch .hint{font-size:11px;color:#8a9a9f}'
  +'body.dashFull #freigabeView>div{max-width:none !important;margin:0 !important}'   /* !important nötig: der Wrapper hat inline max-width:1040px (wie beim peLightBg-Fix 20z) */
  +'body.dashFull #freigabeView>div>h2{display:none}';   /* „Freigabe"-Überschrift nur im Dashboard weg – die neue Kopfleiste sagt es schon (Ralph 22.07.) */
  var s=document.createElement('style'); s.id='dashVorgangCss'; s.textContent=css; document.head.appendChild(s);
}
function dashTab(el,id){
  var root=document.getElementById('fgDash'); if(!root) return;
  root.querySelectorAll('.dvTab').forEach(function(t){ t.classList.remove('active'); });
  if(el) el.classList.add('active');
  root.querySelectorAll('.dvPanel').forEach(function(p){ p.style.display='none'; });
  var t=document.getElementById(id); if(t) t.style.display='';
}
function dashHelpClose(){ var h=document.getElementById('dashHelp'); if(h) h.style.display='none'; var r=document.getElementById('dashHelpReopen'); if(r) r.style.display=''; }
function dashHelpOpen(){ var h=document.getElementById('dashHelp'); if(h) h.style.display=''; var r=document.getElementById('dashHelpReopen'); if(r) r.style.display='none'; }

/* Balkendiagramm ohne Fremdbibliothek – reines SVG. */
function balken(daten, opt){
  opt=opt||{};
  const w=opt.w||320, h=opt.h||90, pad=18;
  const n=daten.length; if(!n) return '';
  const max=Math.max.apply(null, daten.map(function(d){ return Number(d.v)||0; }));
  const m=max>0?max:1;
  const bw=(w-2*pad)/n;
  /* SVG NICHT auf volle Breite strecken: sonst skaliert auf dem Desktop die
     ganze Grafik samt Schrift hoch - aus 9px werden schnell 25px (Ralph, 18.07.2026).
     max-width kappt das. Und die Wert-Zahl je Balken nur, wenn wenige Balken da sind;
     bei 14 Tagen ueberlappen die Betraege - dann reicht der Tooltip beim Draufzeigen. */
  const zeigeWerte = (opt.werte!==false) && n<=8;
  let s='<svg viewBox="0 0 '+w+' '+(h+22)+'" style="width:100%;max-width:'+(opt.maxw||460)+'px;height:auto;display:block;margin:0 auto">';
  daten.forEach(function(d,i){
    const v=Number(d.v)||0;
    const bh=Math.max(v>0?2:0, Math.round((v/m)*(h-pad)));
    const x=pad+i*bw+bw*0.13, y=h-bh, bwr=bw*0.74;
    s+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bwr.toFixed(1)+'" height="'+bh
      +'" rx="2" fill="'+(d.col||opt.col||'var(--k-8cc63f)')+'"><title>'+esc(String(d.l))+': '+esc(String(d.t||v))+'</title></rect>';
    if(v>0 && zeigeWerte) s+='<text x="'+(x+bwr/2).toFixed(1)+'" y="'+(y-3).toFixed(1)+'" text-anchor="middle" '
      +'font-size="9" fill="var(--k-6b6256)">'+esc(String(d.t||v))+'</text>';
    s+='<text x="'+(x+bwr/2).toFixed(1)+'" y="'+(h+13)+'" text-anchor="middle" font-size="9" fill="var(--k-9aa7a0)">'+esc(String(d.l))+'</text>';
  });
  s+='</svg>';
  return s;
}

/* ===== Portal-M-Dashboard (Ralph 24.07.2026) – der HELLE Entwurf: „Stand"-Spalte links,
   Kachel-KPIs, Score/Quellen als helle Karten. Standard-Ansicht. Alle Zahlen echt aus cb_dashboard. */
function dashPortalCss(){
  if(document.getElementById('dashPortalCss')) return;
  var s=document.createElement('style'); s.id='dashPortalCss';
  var P='#fgDash .pm';
  s.textContent=
    P+'wrap{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;align-items:start}'
   +'@media(max-width:860px){'+P+'wrap{grid-template-columns:1fr}}'
   +P+'rail{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}'
   +P+'rail h3{font-size:13px;color:var(--muted);margin:0 0 10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}'
   +P+'st{display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--line)}'
   +P+'st:first-of-type{border-top:0}'
   +P+'dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto}'
   +P+'st .nm{font-size:12.5px;font-weight:600;flex:1;color:var(--ink)}'
   +P+'st .v{font-size:14px;font-weight:800;color:var(--ink)}'
   +P+'heute{margin:12px 0 6px;padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg);text-align:center}'
   +P+'heute .nm{font-weight:800;font-size:12.5px;color:var(--ink)}'+P+'heute .dt{font-size:10.5px;color:var(--muted)}'
   +P+'gate{padding:9px;border:1px solid #bfe0cc;border-radius:9px;text-align:center;font-size:12px;color:#1e6b42;background:#eef8f1;font-weight:700}'
   +P+'gate.zu{border-color:#f2ccc8;color:#8a2019;background:#fcefee}'
   +P+'head{display:flex;align-items:center;gap:10px;margin:0 0 14px}'
   +P+'head h1{font-size:20px;font-weight:800;margin:0}'+P+'head .sub{font-size:12.5px;color:var(--muted)}'
   +P+'head .btn{margin-left:auto;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 13px;font-weight:700;font-size:12.5px;color:var(--teal-d,#1f5966);cursor:pointer}'
   +P+'kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}'
   +'@media(max-width:900px){'+P+'kpis{grid-template-columns:repeat(2,1fr)}}'
   +P+'dk{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 10px;display:flex;flex-direction:column;align-items:center;text-align:center}'
   +P+'dk .ring{width:78px;height:78px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto}'
   +P+'dk .hole{width:60px;height:60px;border-radius:50%;background:var(--card);display:flex;align-items:center;justify-content:center}'
   +P+'dk .hole .v{font-size:18px;font-weight:800;line-height:1;color:var(--ink)}'
   +P+'dk .k{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:10px;font-weight:700}'
   +P+'dk .s{font-size:10px;color:var(--muted);margin-top:2px}'
   +P+'tabs{display:flex;gap:6px;margin:16px 0 12px;flex-wrap:wrap}'
   +P+'tab{padding:8px 15px;border:1px solid var(--line);border-radius:9px;background:var(--card);font-weight:700;font-size:12.5px;color:var(--muted);cursor:pointer}'
   +P+'tab:hover{border-color:#b9c7cc}'
   +P+'tab.on{background:linear-gradient(#2f6470,#1f5966);color:#fff;border-color:#1f5966}'
   +P+'cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}'
   +'@media(max-width:900px){'+P+'cards{grid-template-columns:1fr}}'
   +P+'card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}'
   +P+'card h4{font-size:13px;font-weight:800;margin:0;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--bg)}'
   +P+'card .cb{padding:10px 14px}'
   +P+'li{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:6px 0;border-top:1px solid var(--line)}'
   +P+'li:first-child{border-top:0}'
   +P+'li .sw{width:11px;height:11px;border-radius:3px;flex:0 0 auto}'
   +P+'li .nm{flex:1;color:var(--ink)}'+P+'li b{font-variant-numeric:tabular-nums;color:var(--ink)}'
   +P+'bar{height:7px;background:var(--bg);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:6px 0 2px}'
   +P+'bar i{display:block;height:100%}'
   /* Wächter-Badges (Apple-Stil: Icon + roter Zähler oben rechts + Tooltip) */
   +P+'wl{font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin:2px 0 7px}'
   +P+'wg{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 16px}'
   +P+'wi{position:relative;width:50px;height:50px;border-radius:50%;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:transform .12s,box-shadow .12s}'
   +P+'wi:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(20,40,70,.16)}'
   +P+'wi.ok{opacity:.6}'
   +P+'wi.err{border-color:#f2ccc8;background:#fcefee}'
   +P+'wb{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#e0352b;color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35);border:2px solid var(--card)}'
   +P+'wok{position:absolute;top:-4px;right:-4px;width:17px;height:17px;border-radius:50%;background:#1e9e5a;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;border:2px solid var(--card)}'
   /* Portal-M Chevron-Stepper (Produktweg) */
   +P+'chev{display:flex;overflow:hidden;border-radius:10px;border:1px solid var(--line);margin:0 0 16px;background:var(--card)}'
   +P+'cv{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:11px 6px 9px;position:relative;background:#eef4f6;color:#5b6d73;min-width:0}'
   +P+'cv .ic{width:34px;height:34px;border-radius:50%;background:#dfeaee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#3d7c8a}'
   +P+'cv .l{font-size:10.5px;font-weight:700;text-align:center;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}'
   +P+'cv.on{background:linear-gradient(#2f6470,#1f5966);color:#fff}'
   +P+'cv.on .ic{background:rgba(255,255,255,.18);color:#fff}'
   +P+'cv:not(:last-child)::after{content:"";position:absolute;right:-10px;top:0;bottom:0;width:20px;background:inherit;transform:skewX(-18deg);z-index:2;border-right:1px solid var(--line)}'
   +P+'cv.on:not(:last-child)::after{background:#1f5966;border-right:0}'
   +'@media(max-width:720px){'+P+'cv .l{font-size:9px}'+P+'cv .ic{width:28px;height:28px;font-size:14px}}';
  document.head.appendChild(s);
}
function dashPortalHtml(d){
  dashPortalCss();
  var k=d.katalog||{}, q=d.qualitaet||{}, gate=d.gate||{};
  var num=function(n){ return (n==null?0:Number(n)); };
  var fmt=function(n){ if(n==null) return '–'; return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' '); };
  var gateSum=num(gate.summe), gruen=(gateSum===0);
  var stand=''; try{ stand=(new Date()).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
  var heute=''; try{ heute=(new Date()).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); }catch(e){}
  var aktivN=num(k.aktiv);
  var anteil=function(v){ return aktivN>0?Math.round(num(v)/aktivN*100):0; };
  /* Donut-KPI: Ring = Anteil (%), Zahl in der Mitte. */
  var don=function(val,pct,col,label,sub){ pct=Math.max(0,Math.min(100,num(pct)));
    return '<div class="pmdk"><div class="ring" style="background:conic-gradient('+col+' '+pct+'%,var(--bg) 0)"><div class="hole"><span class="v">'+(val==null?'–':fmt(val))+'</span></div></div><div class="k">'+label+'</div><div class="s">'+sub+'</div></div>'; };
  var st=function(col,nm,v){ return '<div class="pmst"><span class="pmdot" style="background:'+col+'"></span><span class="nm">'+nm+'</span><span class="v">'+fmt(v)+'</span></div>'; };

  var rail='<aside class="pmrail"><h3>Stand · Katalog</h3>'
    +st('#107e3e','Aktiv',num(k.aktiv))
    +st('#c07a10','Zu verifizieren',num(q.unverifiziert))
    +st('#c07a10','Ohne Score',num(q.ohne_score))
    +'<div class="pmheute"><div class="nm">Heute</div><div class="dt">'+heute+'</div></div>'
    +'<div class="pmgate'+(gruen?'':' zu')+'">'+(gruen?'✓ Go-Live-Gate grün':'⚠ Go-Live-Gate ZU · '+gateSum)+'</div></aside>';

  var idxN=(k.schnitt_score!=null?Number(k.schnitt_score):null);
  var kpis='<div class="pmkpis">'
    +don(idxN,(idxN!=null?idxN:0),'#2c6070','Ø Root Index','von 100')
    +don(aktivN,100,'#107e3e','Aktiv','im Katalog')
    +don(num(q.unverifiziert),anteil(q.unverifiziert),'#c07a10','Zu verifizieren',anteil(q.unverifiziert)+' % von aktiv')
    +don(num(q.ohne_score),anteil(q.ohne_score),'#c07a10','Ohne Score',anteil(q.ohne_score)+' % · Suppl./OFF')
    +don(num(k.markenprodukte),anteil(k.markenprodukte),'#7a5cd0','Marken',anteil(k.markenprodukte)+' % von aktiv')
    +don(num(k.mit_ean),anteil(k.mit_ean),'#3b7ea6','Mit Barcode',anteil(k.mit_ean)+' % scanbar')
    +don(num(k.supplements),anteil(k.supplements),'#c07a10','Supplements',anteil(k.supplements)+' % · Dosis-Check')
    +don(gateSum,100,(gruen?'#107e3e':'#c23b2f'),'Go-Live-Gate',(gruen?'alle Wächter still':gateSum+' offen'))
    +'</div>';

  var scCol=function(v){ return v>=90?'#107e3e':v>=80?'#3b9ea8':v>=70?'#3b7ea6':v>=60?'#7a5cd0':v>=50?'#c07a10':'#c23b2f'; };
  var svArr=(d.score_verteilung||[]).slice().sort(function(a,b){ return num(b.von)-num(a.von); });
  var svLi=svArr.map(function(x){ return '<div class="pmli"><span class="sw" style="background:'+scCol(num(x.von))+'"></span><span class="nm">'+num(x.von)+'–'+(num(x.von)+9)+'</span><b>'+fmt(num(x.anzahl))+'</b></div>'; }).join('')
    || '<div style="color:var(--muted);font-size:12px">keine Daten</div>';
  var pal=['#2c6070','#7a5cd0','#c23b2f','#107e3e','#c07a10','#3b7ea6','#a05a9a','#5b6d73'];
  var quArr=(d.quellen||[]);
  var quLi=quArr.map(function(x,i){ return '<div class="pmli"><span class="sw" style="background:'+pal[i%pal.length]+'"></span><span class="nm">'+esc(x.typ)+'</span><b>'+fmt(num(x.anzahl))+'</b></div>'; }).join('')
    || '<div style="color:var(--muted);font-size:12px">keine Daten</div>';

  var sm='style="font-weight:400;color:var(--muted);font-size:11px"';
  var aktiv=num(k.aktiv);
  var pct=function(a,b){ return b>0?Math.round(num(a)/b*100):0; };

  /* Reiter 1 — Datenqualität: Score-Verteilung + Go-Live-Gate (echte Wächter) */
  var waLst=Array.isArray(gate.waechter)?gate.waechter:[];
  var waLi=waLst.map(function(w){ var o=num(w.offen); return '<div class="pmli"><span class="sw" style="background:'+(o>0?'#c07a10':'#107e3e')+'"></span><span class="nm">'+esc(w.name)+'</span><b>'+o+'</b></div>'; }).join('')
    || '<div class="pmli"><span class="sw" style="background:#107e3e"></span><span class="nm">alle Wächter still</span><b>0</b></div>';
  /* Wächter als Icon-Reihe mit Apple-Badge (Zahl oben rechts) + Tooltip. */
  var wIcon=function(nm){ var n=(nm||'').toLowerCase();
    if(/quelle/.test(n)) return '🔗';
    if(/atwater|n(ä|ae)hrwert|kcal|makro/.test(n)) return '⚖️';
    if(/zucker/.test(n)) return '🍬';
    if(/(\böl|\boel|fett)/.test(n)) return '🫒';
    if(/portion/.test(n)) return '🍽️';
    if(/zutat/.test(n)) return '🥣';
    if(/achse/.test(n)) return '📊';
    if(/zusatz|e-?nummer|e ?nummer/.test(n)) return '🧪';
    if(/vollkorn|mehl|st(ä|ae)rke|getreide/.test(n)) return '🌾';
    if(/namenlos|leer|name/.test(n)) return '🏷️';
    if(/ballast/.test(n)) return '🌿';
    return '🛡️'; };
  var offenGes=waLst.reduce(function(a,w){ return a+num(w.offen); },0);
  var wg=waLst.map(function(w){ var o=num(w.offen); var t=esc(w.name)+' — '+(o>0?(o+' offene(r) Fall/Fälle · klicken zum Bearbeiten'):'still (0)');
    return '<div class="pmwi '+(o>0?'err':'ok')+'" title="'+t+'" onclick="dashWaechterFaelle('+num(w.nr)+',\''+encodeURIComponent(w.name)+'\')">'+wIcon(w.name)
      +(o>0?'<span class="pmwb">'+(o>99?'99+':o)+'</span>':'<span class="pmwok">✓</span>')+'</div>'; }).join('');
  var waechterBlock = waLst.length
    ? '<div class="pmwl">🛡️ Wächter · '+(offenGes>0?(offenGes+' offene Punkte – klick auf ein Symbol öffnet die Fälle'):'alle still')+'</div><div class="pmwg">'+wg+'</div>'
    : '';

  var panelDq='<div class="pmpanel" data-panel="dq"><div class="pmcards">'
    +'<div class="pmcard"><h4>Score-Verteilung <span '+sm+'>aktive Produkte</span></h4><div class="cb">'+svLi+'</div></div>'
    +'<div class="pmcard"><h4>Go-Live-Gate <span '+sm+'>'+(gruen?'✓ grün':'⚠ ZU · '+gateSum)+'</span></h4><div class="cb">'+waLi+'</div></div>'
    +'</div></div>';

  /* Reiter 2 — Katalog: Quellen + Zusammensetzung */
  var zRow=function(label,v,col){ var p=pct(v,aktiv); return '<div class="pmli"><span class="nm">'+label+'</span><b>'+fmt(num(v))+' · '+p+'%</b></div><div class="pmbar"><i style="width:'+p+'%;background:'+col+'"></i></div>'; };
  var katZus='<div class="pmcard"><h4>Zusammensetzung <span '+sm+'>Anteil am aktiven Katalog</span></h4><div class="cb">'
    +zRow('Marken',k.markenprodukte,'#7a5cd0')
    +zRow('Mit Barcode',k.mit_ean,'#2c6070')
    +zRow('Supplements',k.supplements,'#c07a10')
    +'</div></div>';
  var panelKat='<div class="pmpanel" data-panel="kat" style="display:none"><div class="pmcards">'
    +'<div class="pmcard"><h4>Quellen <span '+sm+'>nach Beleg</span></h4><div class="cb">'+quLi+'</div></div>'
    +katZus+'</div></div>';

  /* Reiter 3 — Betrieb: Riki-Budget + Nutzer (echt) */
  var ri=d.riki||{}, u=d.nutzer||{};
  var budget=Number(ri.monatslimit_usd||20), verbr=Number(ri.monat_usd||0);
  var budPct=budget>0?Math.min(100,Math.round(verbr/budget*100)):0;
  var budCol=budPct>=90?'#c23b2f':budPct>=60?'#c07a10':'#107e3e';
  var rikiCard='<div class="pmcard"><h4>🤖 Riki <span '+sm+'>Budget diesen Monat</span></h4><div class="cb">'
    +'<div class="pmli" style="border-top:0"><span class="nm">verbraucht</span><b style="color:'+budCol+'">$'+verbr.toFixed(2)+' / '+budget.toFixed(0)+'</b></div>'
    +'<div class="pmbar"><i style="width:'+budPct+'%;background:'+budCol+'"></i></div>'
    +'<div class="pmli"><span class="nm">Calls Monat</span><b>'+fmt(num(ri.monat_calls))+'</b></div>'
    +'<div class="pmli"><span class="nm">Calls heute</span><b>'+fmt(num(ri.heute_calls))+'</b></div>'
    +'</div></div>';
  var nutzCard='<div class="pmcard"><h4>Nutzer <span '+sm+'>frühe Phase</span></h4><div class="cb">'
    +'<div class="pmli" style="border-top:0"><span class="nm">gesamt</span><b>'+fmt(num(u.gesamt))+'</b></div>'
    +'<div class="pmli"><span class="nm">aktiv 30 Tage</span><b>'+fmt(num(u.aktiv_30t))+'</b></div>'
    +'<div class="pmli"><span class="nm">Premium</span><b>'+fmt(num(u.premium))+'</b></div>'
    +'</div></div>';
  var panelBt='<div class="pmpanel" data-panel="bt" style="display:none"><div class="pmcards">'+rikiCard+nutzCard+'</div></div>';

  /* ===== 28z31 (Ralph-Entscheid: Variante A+B kombiniert) =====
     B: Aufgaben-Liste zuerst - das Dashboard sagt, was ansteht, jede Zeile springt hin.
     A: Bento-Helden - Waechter-Ring + Riki-Budget-Tacho mit Monats-Prognose. */
  var sc2=d.scans||{};
  var aufg=[];
  if(!gruen) aufg.push({ico:'🔴',txt:'Go-Live-Gate ZU — '+gateSum+' Pflicht-Fall/Fälle',sub:'muss 0 sein vor jedem Livegang',oc:''});
  waLst.forEach(function(w){ var o=num(w.offen); if(o>0) aufg.push({ico:'🟡',txt:esc(w.name)+' — '+o+' offen',sub:'Wächter · klick öffnet die Fälle',oc:"dashWaechterFaelle("+num(w.nr)+",'"+encodeURIComponent(w.name)+"')"}); });
  if(num(sc2.wartet_pruefung)>0) aufg.push({ico:'📷',txt:num(sc2.wartet_pruefung)+' Scan(s) warten auf deine Prüfung',sub:'Scan-Eingang in der Erfassung',oc:"scanEingangOeffnen()"});
  if(num(q.unverifiziert)>0) aufg.push({ico:'🕵️',txt:fmt(num(q.unverifiziert))+' Produkte zu verifizieren',sub:'unverifiziert im Katalog',oc:"window._peChip='zuverif';adminGo('produkterfassung')"});
  aufg=aufg.slice(0,5);
  var aufgRows=aufg.length?aufg.map(function(a){ return '<div onclick="'+(a.oc||'')+'" style="display:flex;align-items:center;gap:10px;padding:9px 13px;border-top:1px solid var(--line);'+(a.oc?'cursor:pointer':'')+'"><span style="font-size:15px">'+a.ico+'</span><div style="flex:1;min-width:0"><b style="font-size:13px">'+a.txt+'</b><div style="font-size:11px;color:var(--muted)">'+a.sub+'</div></div>'+(a.oc?'<span style="background:var(--green,#2e7d46);color:#fff;font-size:11.5px;font-weight:700;border-radius:8px;padding:5px 11px">öffnen</span>':'')+'</div>'; }).join('')
    :'<div style="display:flex;align-items:center;gap:10px;padding:11px 13px"><span style="font-size:15px">✅</span><b style="font-size:13px;color:#1e6b42">Nichts wartet auf dich — alles grün.</b></div>';
  var aufgBlock='<div style="border:1px solid var(--line);border-radius:14px;background:var(--card);overflow:hidden;margin-bottom:14px">'
    +'<div style="padding:10px 13px;background:var(--greenlt,#eaf5ee);border-bottom:1px solid var(--line);font-weight:800;font-size:13px;color:var(--greendk,#166534)">🧭 '+(aufg.length?(aufg.length+' Aufgabe'+(aufg.length>1?'n':'')+' warte'+(aufg.length>1?'n':'t')+' auf dich'):'Alles erledigt')+'</div>'+aufgRows+'</div>';

  var waTotal=waLst.length, waOk=waLst.filter(function(w){ return num(w.offen)===0; }).length;
  var ringAnteil=waTotal>0?(waOk/waTotal):1; var ringU=2*Math.PI*31;
  var heroW='<div style="background:linear-gradient(135deg,#173f24,#2e7d46);border-radius:14px;padding:14px;color:#fff;display:flex;align-items:center;gap:14px;min-width:0">'
    +'<svg width="70" height="70" viewBox="0 0 74 74" style="flex:0 0 auto"><circle cx="37" cy="37" r="31" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="8"/><circle cx="37" cy="37" r="31" fill="none" stroke="#7ee2a2" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+ringU.toFixed(1)+'" stroke-dashoffset="'+(ringU*(1-ringAnteil)).toFixed(1)+'" transform="rotate(-90 37 37)"/><text x="37" y="43" text-anchor="middle" fill="#ffffff" font-size="17" font-weight="800">'+waOk+'/'+waTotal+'</text></svg>'
    +'<div style="min-width:0"><div style="font-size:14.5px;font-weight:800">Wächter: '+waOk+' von '+waTotal+' grün</div>'
    +'<div style="font-size:11.5px;opacity:.85;margin-top:2px">'+(offenGes>0?(offenGes+' offene Punkte — die Symbole unten öffnen die Fälle'):'alle still — nichts offen')+'</div>'
    +'<div style="font-size:10.5px;opacity:.65;margin-top:4px">'+(gruen?'✓ Go-Live-Gate grün':'⚠ Go-Live-Gate ZU')+'</div></div></div>';
  var _jetzt=new Date(), _tagNr=_jetzt.getDate(), _tageMon=new Date(_jetzt.getFullYear(),_jetzt.getMonth()+1,0).getDate();
  var prognose=(_tagNr>0?verbr/_tagNr*_tageMon:0), progOk=prognose<=budget;
  var tachoAnteil=Math.max(0,Math.min(1,budget>0?verbr/budget:0));
  var rvA=(d.riki_verlauf||[]).slice(-14);
  var rvMax2=Math.max.apply(null,[0.0001].concat(rvA.map(function(x){ return Number(x.usd)||0; })));
  var rvBars=rvA.map(function(x){ var v=Number(x.usd)||0; var hh=Math.max(2,Math.round(v/rvMax2*26));
    return '<i title="'+esc(x.tag)+': '+v.toFixed(2)+' $" style="flex:1;display:block;height:'+hh+'px;background:var(--green,#2e7d46);opacity:.75;border-radius:2px 2px 0 0"></i>'; }).join('')
    ||'<span style="font-size:10px;color:var(--muted)">noch keine Tageswerte</span>';
  var heroR='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;min-width:0">'
    +'<div style="font-size:10.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">🤖 Riki-Budget · Monat</div>'
    +'<div style="display:flex;align-items:center;gap:12px;margin-top:4px">'
    +'<svg width="104" height="60" viewBox="0 0 120 66" style="flex:0 0 auto"><path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="#eceee9" stroke-width="11" stroke-linecap="round"/><path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="'+budCol+'" stroke-width="11" stroke-linecap="round" stroke-dasharray="'+(150.8*tachoAnteil).toFixed(1)+' 999"/><text x="60" y="50" text-anchor="middle" font-size="14" font-weight="800" fill="#1d2733">'+verbr.toFixed(2)+' $</text><text x="60" y="62" text-anchor="middle" font-size="8.5" fill="#7b8698">von '+budget.toFixed(0)+' $</text></svg>'
    +'<div style="min-width:0;flex:1">'
      +'<div style="font-size:11.5px;color:'+(progOk?'#1e6b42':'#c23b2f')+';font-weight:700">Prognose Monatsende: ~'+prognose.toFixed(0)+' $ '+(progOk?'✓ im Rahmen':'⚠ über Budget')+'</div>'
      +'<div style="display:flex;align-items:flex-end;gap:2px;height:26px;margin-top:6px">'+rvBars+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-top:2px">Kosten je Tag · letzte 14 Tage · Läuft das Budget voll, blockt Riki — gewollt.</div>'
    +'</div></div></div>';
  var heroBlock='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:14px">'+heroW+heroR+'</div>';
  /* 2026-07-29-1649 (Ralph): Audit-Karte - die drei Pruef-Ebenen + Stichproben zum Gegenpruefen */
  heroBlock+='<div id="dashAuditBox" style="margin-bottom:14px"></div>';

  var tabs='<div class="pmtabs">'
    +'<button class="pmtab on" data-tab="dq" onclick="dashPortalTab(\'dq\')">🔎 Datenqualität</button>'
    +'<button class="pmtab" data-tab="kat" onclick="dashPortalTab(\'kat\')">📦 Katalog</button>'
    +'<button class="pmtab" data-tab="bt" onclick="dashPortalTab(\'bt\')">⚙️ Betrieb</button>'
    +'</div>';

  return '<div class="pmwrap">'+rail
    +'<main><div class="pmhead"><div><h1>📊 Dashboard <span style="font-size:12px;color:var(--muted);font-weight:600">· Katalog auf einen Blick</span></h1><div class="sub">Live aus der Datenbank · '+stand+' Uhr</div></div>'
    +'<button class="btn" onclick="loadDashboard()">↻ Aktualisieren</button></div>'
    +aufgBlock+heroBlock+waechterBlock+kpis+tabs+panelDq+panelKat+panelBt+'</main></div>';
}
/* ===== ENTERPRISE-DASHBOARD (Ralph-Entscheid 29.07. abends: Variante B "Hell-Enterprise"
   aus 3 Profi-Mockups; Vorlage Klipfolio, Umsetzung nach dataviz-Regeln: echte Achsen,
   Rasterlinien, Limit-Linie, Statusfarben fest, Text in Texttoken). Ersetzt die
   Portal-Ansicht als Standard; dashPortalHtml bleibt als Sicherheitsnetz. ===== */
function entIc(name){
  var P={dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    box:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c2.8.3 5 2.6 5 5.5"/>',
    gauge:'<path d="M4 14a8 8 0 0 1 16 0"/><path d="M12 14l4-4"/><circle cx="12" cy="14" r="1.6"/>'};
  return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2a78d6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(P[name]||P.dash)+'</svg>';
}
function entKostenChart(rv, limit){
  var W=560,H=160,x0=36,x1=550,y0=14,y1=132;
  var vals=(rv||[]).slice(-14);
  if(!vals.length) return '<div style="font-size:12px;color:var(--muted)">noch keine Tageswerte</div>';
  var vmax=0; vals.forEach(function(x){ var v=Number(x.usd)||0; if(v>vmax) vmax=v; });
  var ymax=Math.max((limit||0)*1.1, vmax*1.15, 0.5);
  var Y=function(v){ return y1-(v/ymax)*(y1-y0); };
  var out=[];
  var step=ymax>3?1:0.5;
  for(var g=step; g<ymax; g+=step){
    var gy=Y(g);
    out.push('<line x1="'+x0+'" y1="'+gy.toFixed(1)+'" x2="'+x1+'" y2="'+gy.toFixed(1)+'" stroke="#e1e0d9" stroke-width="1"/>');
    out.push('<text x="'+(x0-6)+'" y="'+(gy+3).toFixed(1)+'" text-anchor="end" font-size="9" fill="#898781">'+String(g.toFixed(step<1?1:0)).replace('.',',')+'</text>');
  }
  if(limit){ var yl=Y(limit);
    out.push('<line x1="'+x0+'" y1="'+yl.toFixed(1)+'" x2="'+x1+'" y2="'+yl.toFixed(1)+'" stroke="#d03b3b" stroke-width="1.5" stroke-dasharray="5 4"/>');
    out.push('<text x="'+x1+'" y="'+(yl-5).toFixed(1)+'" text-anchor="end" font-size="9" font-weight="700" fill="#d03b3b">Tageslimit '+String(limit.toFixed(2)).replace('.',',')+'&#8202;$</text>'); }
  out.push('<line x1="'+x0+'" y1="'+y1+'" x2="'+x1+'" y2="'+y1+'" stroke="#c3c2b7" stroke-width="1"/>');
  var slot=(x1-x0)/vals.length, bw=Math.min(24, slot-8), imax=0;
  vals.forEach(function(x,i){ if((Number(x.usd)||0)>(Number(vals[imax].usd)||0)) imax=i; });
  vals.forEach(function(x,i){
    var v=Number(x.usd)||0, bx=x0+i*slot+(slot-bw)/2, by=Y(v), r=Math.min(4,bw/2);
    if(y1-by<2) by=y1-2;
    out.push('<path d="M'+bx.toFixed(1)+' '+y1+' V'+(by+r).toFixed(1)+' Q'+bx.toFixed(1)+' '+by.toFixed(1)+' '+(bx+r).toFixed(1)+' '+by.toFixed(1)+' H'+(bx+bw-r).toFixed(1)+' Q'+(bx+bw).toFixed(1)+' '+by.toFixed(1)+' '+(bx+bw).toFixed(1)+' '+(by+r).toFixed(1)+' V'+y1+' Z" fill="#2a78d6"><title>'+esc(String(x.tag||''))+': '+v.toFixed(2)+' $</title></path>');
    if(i%2===0){ var lbl=String(x.tag||'').replace(/^\d{4}-\d{2}-/,'').replace(/(\d{2})$/,'$1.');
      out.push('<text x="'+(bx+bw/2).toFixed(1)+'" y="'+(y1+12)+'" text-anchor="middle" font-size="8.5" fill="#898781">'+esc(lbl)+'</text>'); }
    if(i===imax && v>0) out.push('<text x="'+(bx+bw/2).toFixed(1)+'" y="'+(by-6).toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="700" fill="#0b0b0b">'+String(v.toFixed(2)).replace('.',',')+'&#8202;$</text>');
  });
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+out.join('')+'</svg>';
}
function entAreaChart(rv){
  var W=560,H=110,x0=36,x1=550,y0=10,y1=92;
  var vals=(rv||[]).slice(-14); if(!vals.length) return '';
  var kum=[], s=0; vals.forEach(function(x){ s+=Number(x.usd)||0; kum.push(s); });
  var ymax=Math.max(s*1.15, 1);
  var pts=kum.map(function(v,i){ var x=x0+(x1-x0)*i/(kum.length-1), y=y1-(v/ymax)*(y1-y0); return x.toFixed(1)+','+y.toFixed(1); });
  var out=[];
  for(var g=0.25; g<1; g+=0.25){ var gy=y1-g*(y1-y0);
    out.push('<line x1="'+x0+'" y1="'+gy.toFixed(1)+'" x2="'+x1+'" y2="'+gy.toFixed(1)+'" stroke="#e1e0d9" stroke-width="1"/>'); }
  out.push('<polygon points="'+x0+','+y1+' '+pts.join(' ')+' '+x1+','+y1+'" fill="rgba(42,120,214,0.16)"/>');
  out.push('<polyline points="'+pts.join(' ')+'" fill="none" stroke="#2a78d6" stroke-width="2"/>');
  var last=pts[pts.length-1].split(',');
  out.push('<circle cx="'+last[0]+'" cy="'+last[1]+'" r="4" fill="#2a78d6"/>');
  out.push('<text x="'+x0+'" y="'+(y1+12)+'" font-size="8.5" fill="#898781">'+esc(String(vals[0].tag||''))+'</text>');
  out.push('<text x="'+x1+'" y="'+(y1+12)+'" text-anchor="end" font-size="8.5" fill="#898781">'+esc(String(vals[vals.length-1].tag||''))+'</text>');
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block">'+out.join('')+'</svg>';
}
function dashEnterpriseHtml(d){
  var k=d.katalog||{}, q=d.qualitaet||{}, gate=d.gate||{}, u=d.nutzer||{}, ri=d.riki||{}, sc=d.scans||{};
  var num=function(n){ return (n==null?0:Number(n)); };
  var fmt=function(n){ if(n==null) return '\u2013'; return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); };
  var gateSum=num(gate.summe), gruen=(gateSum===0);
  var waLst=Array.isArray(gate.waechter)?gate.waechter:[];
  var stand=''; try{ stand=(new Date()).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }catch(e){}
  try{ window._entVerlauf = d.riki_verlauf; window._entNutzerGesamt = num(u.gesamt); }catch(e){}  /* Etappe 2: fuer Limit-Linie + Karte */
  var budget=Number(ri.monatslimit_usd||50), verbr=Number(ri.monat_usd||0);
  var _j=new Date(), _t=_j.getDate(), _dim=new Date(_j.getFullYear(),_j.getMonth()+1,0).getDate();
  var prog=(_t>0?verbr/_t*_dim:0), progOk=prog<=budget;
  var tile=function(span,inner){ return '<div style="grid-column:span '+span+';background:var(--card,#fcfcfb);border:1px solid rgba(11,11,11,0.10);border-radius:10px;padding:14px 16px;min-width:0;box-shadow:0 1px 3px rgba(20,40,70,.06)">'+inner+'</div>'; };
  var h3=function(t,sub){ return '<div style="font-size:12px;font-weight:700;color:var(--ink,#0b0b0b);margin-bottom:10px">'+t+(sub?' <span style="color:#898781;font-weight:400">'+sub+'</span>':'')+'</div>'; };
  var kpi=function(icon,val,lbl,sub){
    return '<div style="flex:1;min-width:150px;display:flex;gap:11px;align-items:center">'
      +'<div style="width:34px;height:34px;border-radius:8px;background:#eef4fb;display:flex;align-items:center;justify-content:center;flex:0 0 auto">'+entIc(icon)+'</div>'
      +'<div><div style="font-size:22px;font-weight:700;color:var(--ink,#0b0b0b);line-height:1.05;font-variant-numeric:tabular-nums">'+val+'</div>'
      +'<div style="font-size:10.5px;color:#898781">'+lbl+(sub?' \u00b7 '+sub:'')+'</div></div></div>';
  };
  var row=function(farbe,icon,txt,val,oc){
    var v = oc ? '<span onclick="'+oc+'" style="color:#2a78d6;font-weight:700;cursor:pointer;white-space:nowrap">'+val+' \u203a</span>'
               : '<span style="color:#898781;white-space:nowrap">'+val+'</span>';
    return '<div style="display:flex;align-items:center;gap:9px;font-size:12.5px;padding:6.5px 0;border-top:1px solid #e1e0d9;color:var(--ink,#0b0b0b)">'
      +'<span style="width:8px;height:8px;border-radius:50%;background:'+farbe+';flex:0 0 auto"></span>'
      +'<span style="width:13px;text-align:center;color:'+farbe+';font-weight:800">'+icon+'</span>'
      +'<span style="flex:1;min-width:0">'+txt+'</span>'+v+'</div>';
  };
  /* KPI-Zeile */
  var kpis='<div style="display:flex;gap:18px;flex-wrap:wrap">'
    +kpi('box',fmt(num(k.aktiv)),'Produkte im Katalog','\u00d8 Index '+(k.schnitt_score!=null?k.schnitt_score:'\u2013'))
    +kpi('gauge',fmt(num(q.unverifiziert)),'zu verifizieren','ohne Score '+fmt(num(q.ohne_score)))
    +kpi('user',fmt(num(u.gesamt)),'Nutzer',num(u.aktiv_30t)+' aktiv \u00b7 '+num(u.premium)+' Premium')
    +kpi('dash',(gruen?'gr\u00fcn':gateSum+' offen'),'Go-Live-Gate',gruen?'alle Pflicht-W\u00e4chter still':'Pflichtf\u00e4lle')
    +'</div>';
  /* Waechter-Kachel */
  var okNamen=[], waRows='';
  waLst.forEach(function(w){ var o=num(w.offen);
    if(o>0) waRows+=row('#fab219','!',esc(w.name),o,"dashWaechterFaelle("+num(w.nr)+",'"+encodeURIComponent(w.name)+"')");
    else okNamen.push(w.name); });
  if(num(sc.wartet_pruefung)>0) waRows+=row('#fab219','!','Scans warten auf Pr\u00fcfung',num(sc.wartet_pruefung),"scanEingangOeffnen()");
  if(okNamen.length) waRows+=row('#0ca30c','\u2713',okNamen.length+' W\u00e4chter still','0');
  /* Aufgaben */
  var aufg='';
  if(!gruen) aufg+=row('#d03b3b','\u2715','Go-Live-Gate ZU \u2014 Pflichtf\u00e4lle',gateSum,'');
  waLst.forEach(function(w){ var o=num(w.offen); if(o>0) aufg+=row('#fab219','!',esc(w.name)+' pr\u00fcfen',o,"dashWaechterFaelle("+num(w.nr)+",'"+encodeURIComponent(w.name)+"')"); });
  if(num(sc.wartet_pruefung)>0) aufg+=row('#fab219','!','Scans pr\u00fcfen',num(sc.wartet_pruefung),"scanEingangOeffnen()");
  if(!aufg) aufg=row('#0ca30c','\u2713','Nichts wartet auf dich \u2014 alles gr\u00fcn','');
  aufg+=row('#898781','\u00b7','Stand',stand);
  /* Etappe 2 (Ralph-Entscheid 29.07. abends): Kachel-Karte aus der FREIWILLIGEN
     Bundesland-Angabe im Profil. Anonyme Zaehlung (cb_bundesland_zaehlung), laedt nach. */
  var karte=h3('Nutzer nach Region','freiwillig \u00b7 anonym')
    +'<div id="entKarteBox"><div style="border:1px dashed #c3c2b7;border-radius:8px;padding:18px 12px;text-align:center;color:#898781;font-size:12px;line-height:1.55">'
    +'<div style="font-size:22px;font-weight:700;color:var(--ink,#0b0b0b)">'+fmt(num(u.gesamt))+'</div>Nutzer gesamt<br><br>'
    +'Z\u00e4hlung l\u00e4dt \u2026 gezeigt wird nur die anonyme Zahl je Bundesland \u2014 keine erfundenen Punkte.</div></div>';
  return '<div style="background:var(--bg,#f9f9f7);margin:-4px;padding:4px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin:2px 6px 10px"><h1 style="font-size:19px;font-weight:800;margin:0;color:var(--ink,#0b0b0b)">Dashboard</h1><span style="font-size:12px;color:#898781">Live aus der Datenbank \u00b7 '+stand+' Uhr</span>'
    +'<button onclick="loadDashboard()" style="margin-left:auto;background:var(--card,#fff);border:1px solid rgba(11,11,11,0.14);border-radius:8px;padding:7px 12px;font-weight:700;font-size:12px;color:var(--ink,#0b0b0b);cursor:pointer">\u21bb Aktualisieren</button></div>'
    +'<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:10px">'
    +tile(12,kpis)
    +tile(5,h3('Riki-Kosten je Tag','letzte 14 Tage, $')+'<div id="entKostenBox">'+entKostenChart(d.riki_verlauf,null)+'</div>'
      +'<div style="display:flex;gap:14px;font-size:10px;color:#898781;margin-top:6px"><span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#2a78d6;margin-right:5px;vertical-align:-1px"></span>Kosten/Tag</span><span id="entLimitLeg" style="color:#d03b3b;display:none">\u2212\u2212 Tageslimit</span></div>')
    +tile(4,h3('Riki-Budget \u00b7 Monat','kumuliert, $')
      +'<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px;flex-wrap:wrap"><span style="font-size:26px;font-weight:700;color:var(--ink,#0b0b0b)">'+String(verbr.toFixed(2)).replace('.',',')+'&#8202;$</span>'
      +'<span style="font-size:11px;font-weight:700;color:'+(progOk?'#006300':'#d03b3b')+'">'+(budget>0?Math.round(verbr/budget*100):0)+'&#8202;% von '+budget.toFixed(0)+'&#8202;$ \u00b7 Prognose ~'+prog.toFixed(0)+'&#8202;$ '+(progOk?'\u2713':'\u26a0')+'</span></div>'
      +entAreaChart(d.riki_verlauf)
      +'<div style="font-size:10px;color:#898781;margin-top:4px">L\u00e4uft das Budget voll, blockt Riki \u2014 gewollt.</div>')
    +tile(3,karte)
    +tile(4,h3('W\u00e4chter &amp; Takte','Klick \u00f6ffnet die F\u00e4lle')+waRows)
    +tile(4,h3('Audit','drei Pr\u00fcf-Ebenen')+'<div id="dashAuditBox"></div>')
    +tile(4,h3('Aufgaben heute','nach Dringlichkeit')+aufg)
    +tile(4,h3('Supabase','Datenbank \u00b7 Speicher \u00b7 Paket')+'<div id="entSupaBox" style="font-size:12.5px;color:#898781">L\u00e4dt \u2026</div>')
    /* Ralph-Auftrag 06.09.2026: in der Produktliste stand zwar eine Quelle, aber nicht,
       WER erfasst hat. Diese Kachel trennt beides: Personen aus Produkte.Angelegt_Von,
       Importe aus Daten_Quelle. Gemessen am 06.09.: 67 von 62.199 Produkten tragen einen
       Erfasser - die Kachel sagt das ausdruecklich, damit "Ralph 55" nicht wie ein
       Anteil am Katalog gelesen wird. Laedt nach ueber cb_admin_erfasser_statistik. */
    +tile(4,h3('Wer hat erfasst','Personen und Importe')+'<div id="entErfasserBox" style="font-size:12.5px;color:#898781">L\u00e4dt \u2026</div>')
    +'</div></div>';
}
/* Etappe 2b (Ralph: "mach eine saubere deutschlandkarte"): ECHTE Bundesland-Umrisse.
   Kartengrundlage: deutschlandGeoJSON (isellsoap) auf Basis (c) GeoBasis-DE / BKG,
   Lizenz dl-de/by-2-0 - Namensnennung steht in der Kachel-Fussnote. Die Umrisse wurden
   nur projiziert und geometrisch vereinfacht (Douglas-Peucker), NICHT gezeichnet. */
var DE_KARTE={w:240,h:325.4,c:{'Baden-Württemberg':[83.2,272.0],'Bayern':[145.3,255.2],'Berlin':[197.3,106.9],'Brandenburg':[207.1,122.0],'Bremen':[76.7,81.3],'Hamburg':[108.7,62.9],'Hessen':[82.9,186.1],'Mecklenburg-Vorpommern':[173.5,55.8],'Niedersachsen':[86.5,95.5],'Nordrhein-Westfalen':[44.3,149.5],'Rheinland-Pfalz':[41.4,214.8],'Saarland':[28.5,236.8],'Sachsen':[195.9,167.4],'Sachsen-Anhalt':[152.8,127.2],'Schleswig-Holstein':[97.0,40.6],'Thüringen':[135.1,173.5]},p:{
  'Baden-Württemberg':'M98.9,220.6 98.6,224.2 99.5,224.5 100.6,222.8 101.1,224.5 102.7,222.8 103.8,223.9 105.0,227.9 103.5,230.1 104.6,230.5 106.0,228.8 106.6,233.1 108.7,233.1 109.9,230.4 110.4,232.0 111.5,232.0 110.8,234.6 112.6,236.7 111.1,237.3 112.3,241.4 111.2,242.4 111.5,244.7 115.0,247.1 113.7,249.0 114.9,249.3 114.9,251.4 117.6,251.8 120.3,255.6 120.2,260.9 119.1,262.4 121.3,266.0 119.1,267.1 119.8,265.7 119.0,265.5 117.5,267.3 117.2,265.8 115.4,265.2 115.0,266.9 116.7,269.2 116.0,269.3 116.4,272.7 114.2,273.1 112.8,275.4 109.1,275.5 109.2,276.7 107.3,278.8 109.9,282.9 111.8,290.5 110.1,300.2 111.6,302.4 109.9,303.7 111.2,304.8 111.5,308.3 110.3,308.4 110.0,310.0 108.7,307.8 107.2,309.3 104.0,308.3 101.5,311.3 96.8,312.1 95.0,309.4 90.2,308.4 83.1,302.2 86.5,305.8 87.7,308.7 86.2,309.3 81.7,305.4 82.2,306.1 80.4,306.1 82.1,307.6 79.1,309.3 78.1,308.1 78.6,307.1 76.9,305.6 75.9,306.6 76.6,308.2 74.8,307.5 74.9,304.6 73.8,304.8 72.9,303.0 72.2,304.6 72.0,303.0 70.6,302.6 70.8,303.7 68.1,304.5 66.3,308.2 68.1,309.8 71.5,308.3 72.2,309.4 71.0,311.6 69.4,310.0 67.7,311.3 68.7,312.2 64.4,312.6 63.3,311.0 61.1,310.5 58.0,313.1 54.3,313.7 52.9,311.8 51.0,311.8 47.1,314.2 46.1,313.1 47.3,312.8 47.1,311.8 45.5,312.4 43.3,309.1 44.1,299.8 45.8,296.0 44.4,293.3 44.7,289.8 49.1,281.1 48.7,278.2 50.6,273.4 50.6,270.1 54.9,263.3 58.0,261.3 60.9,254.9 63.5,252.9 65.2,248.9 65.9,243.3 68.6,240.5 67.5,239.2 68.7,238.0 68.8,236.6 67.9,236.7 69.0,234.6 67.4,234.3 67.0,228.6 71.2,231.1 72.1,230.0 71.4,227.4 74.0,226.9 73.6,228.9 74.8,231.3 79.3,231.7 78.8,233.2 77.4,233.1 77.7,234.6 76.7,235.6 78.2,236.1 80.7,233.8 80.7,231.7 85.4,231.3 84.3,230.2 84.8,228.7 88.7,228.6 90.1,225.6 92.9,226.1 93.1,223.3 92.3,222.5 91.5,223.6 92.0,222.7 89.9,222.2 90.4,221.0 95.3,220.2 96.9,222.1 96.9,220.5Z',
  'Bayern':'M111.6,188.3 113.4,188.1 114.2,189.9 116.8,190.6 118.7,193.6 118.4,194.8 120.1,194.5 121.0,196.6 123.9,197.5 124.1,201.9 127.0,202.9 127.3,200.9 130.5,200.9 126.9,197.8 127.0,196.2 129.9,195.0 132.7,195.0 134.2,197.0 134.2,196.1 135.4,197.0 137.2,196.0 138.4,197.6 138.0,199.3 140.9,200.2 141.7,196.0 140.8,191.4 142.8,190.9 143.4,189.5 145.5,189.8 145.2,192.4 146.0,193.7 146.9,193.2 147.9,195.7 149.8,194.4 154.9,193.6 155.9,194.9 158.9,193.4 160.0,196.6 163.7,198.2 164.0,199.5 162.7,200.6 165.7,203.1 165.7,206.6 167.3,207.4 167.2,208.7 173.3,211.9 172.9,213.8 174.8,214.3 172.8,220.0 171.0,221.5 172.1,223.5 174.3,224.3 175.9,230.3 177.4,230.9 177.8,235.0 180.3,236.3 181.0,238.4 185.4,238.5 187.5,240.2 187.6,241.9 191.4,245.8 191.4,247.0 194.4,248.0 197.2,250.9 197.7,254.2 199.6,255.6 200.0,254.4 202.0,254.4 204.2,258.0 206.3,258.3 208.5,262.6 207.2,264.7 207.8,270.2 206.0,272.8 199.8,269.9 198.0,271.3 197.4,279.1 194.1,282.1 189.0,283.1 183.2,286.3 180.2,290.0 186.7,301.0 184.3,306.1 187.0,306.1 189.4,309.9 187.9,312.2 188.0,316.0 187.0,317.2 181.4,313.2 180.9,312.3 182.1,310.9 180.6,309.7 180.9,308.4 176.3,308.3 175.6,310.1 173.7,310.4 171.9,307.4 167.2,308.4 167.1,305.7 165.0,307.4 165.9,311.5 160.9,310.7 156.7,312.4 150.9,311.6 149.5,315.3 145.7,315.2 144.4,316.9 145.4,318.0 143.2,317.8 141.4,320.3 140.1,320.3 140.7,318.5 133.7,320.1 132.3,316.7 130.7,316.7 132.1,315.1 131.2,314.2 128.3,315.1 123.8,312.7 122.8,314.2 119.4,312.2 120.4,318.5 119.4,320.8 118.3,321.0 116.6,324.0 112.5,325.4 114.0,320.2 110.6,321.8 110.5,317.6 108.0,316.3 107.3,313.6 104.8,314.5 103.2,313.6 102.9,311.7 101.2,314.0 98.0,312.6 99.2,311.0 101.7,311.1 104.0,308.3 107.2,309.3 108.7,307.8 110.0,310.0 110.3,308.4 111.5,308.3 111.2,304.8 109.9,303.7 111.6,302.4 110.1,300.2 111.8,290.5 109.9,282.9 107.3,278.8 109.2,276.7 109.1,275.5 112.8,275.4 114.2,273.1 116.4,272.7 116.0,269.3 116.7,269.2 115.0,266.9 115.4,265.2 117.2,265.8 117.5,267.3 119.0,265.5 119.8,265.7 119.1,267.1 121.3,266.0 119.1,262.4 120.2,260.9 120.3,255.6 117.6,251.8 114.9,251.4 114.9,249.3 113.7,249.0 115.0,247.1 111.5,244.7 111.2,242.4 112.3,241.4 111.1,237.3 112.6,236.7 110.8,234.6 111.5,232.0 110.4,232.0 109.9,230.4 108.7,233.1 107.0,233.3 106.1,232.6 106.0,228.8 104.6,230.5 103.5,230.1 105.0,227.7 103.0,222.8 101.3,224.5 100.6,222.8 99.2,224.5 98.4,223.9 99.1,220.2 96.9,220.5 96.9,222.1 95.3,220.2 91.9,220.5 89.9,222.2 92.0,222.7 91.2,223.0 91.8,223.8 92.6,222.7 92.9,226.1 90.1,225.6 88.1,228.9 85.2,229.0 83.8,227.8 84.9,226.1 84.4,224.1 86.2,221.9 85.0,221.3 85.7,219.8 84.7,219.9 84.6,217.8 83.1,217.7 82.7,211.7 83.7,211.5 83.2,209.5 81.8,209.1 82.8,206.6 85.5,206.1 86.3,207.6 88.1,205.0 91.8,205.8 92.9,207.9 95.5,207.4 95.0,201.2 99.2,201.6 99.0,200.0 101.4,198.3 101.4,193.9 105.0,194.6 107.0,193.7 110.1,188.6Z',
  'Berlin':'M190.9,102.9 192.3,103.4 194.1,100.3 196.3,101.8 199.1,100.6 199.3,99.5 200.5,100.9 200.1,103.1 204.0,105.7 202.8,108.1 206.8,109.5 203.9,113.6 203.7,112.0 199.4,111.3 199.1,110.2 197.8,110.6 198.0,112.0 193.2,110.2 190.3,111.5 189.1,110.3 191.3,106.6 189.8,106.0Z',
  'Brandenburg':'M209.7,65.0 210.7,68.4 219.1,68.0 219.0,70.5 215.4,75.0 219.6,75.1 221.2,72.9 223.8,72.3 224.6,75.0 222.4,78.4 222.4,82.7 216.5,87.6 216.9,91.0 216.0,92.6 221.8,96.0 225.0,100.3 229.6,103.5 228.5,105.4 229.3,106.9 226.7,111.2 227.8,115.6 231.1,117.6 230.3,122.6 232.2,124.6 230.6,131.7 228.1,134.5 232.2,141.6 232.2,144.3 230.8,144.5 230.2,146.5 227.7,145.6 221.8,148.6 216.8,146.7 215.6,149.4 214.1,149.4 214.9,150.8 213.2,153.9 212.1,152.8 207.0,154.4 201.3,154.0 197.7,150.5 197.0,151.8 195.5,151.1 194.1,153.4 191.7,151.6 192.0,146.2 188.3,142.4 191.8,139.6 190.2,134.1 190.9,133.1 187.9,133.1 188.1,131.9 186.2,131.9 185.9,130.5 183.1,130.6 182.9,129.2 181.3,129.4 178.4,127.4 174.9,128.5 173.0,126.3 171.9,127.1 166.2,120.8 168.4,118.5 167.1,117.3 168.8,113.4 167.9,110.5 169.3,107.9 166.8,106.0 165.8,107.2 165.5,105.6 164.4,105.9 165.1,101.8 166.9,101.6 165.8,98.0 167.3,94.7 166.7,92.0 156.4,90.0 156.6,88.1 152.4,87.0 152.3,85.7 150.8,85.6 151.0,84.3 147.9,84.1 146.3,82.7 143.4,83.8 141.4,81.7 144.7,81.4 144.7,80.2 148.4,80.9 149.1,77.1 150.9,75.9 156.1,76.6 155.3,75.5 161.2,73.4 161.9,70.6 165.0,71.9 166.6,71.2 167.4,72.6 170.9,73.4 172.2,75.6 178.0,75.4 178.2,76.5 180.4,76.7 180.5,78.3 186.0,77.8 185.2,78.9 186.2,79.3 189.8,76.0 191.4,75.6 192.7,77.0 194.5,74.4 197.2,75.7 198.1,73.6 200.4,72.7 201.0,69.3 203.0,68.9 205.2,65.9 208.3,65.2 207.1,64.5 207.3,62.7 208.1,64.4ZM199.3,99.5 199.1,100.6 196.3,101.8 194.1,100.3 192.3,103.4 190.2,103.3 190.8,104.1 189.8,106.0 191.3,106.6 189.2,110.7 190.3,111.5 194.7,110.4 198.0,112.0 197.8,110.6 199.1,110.2 199.4,111.3 203.7,112.0 203.9,113.6 206.6,109.0 202.8,108.1 204.0,105.7 200.1,103.1 200.5,100.9Z',
  'Bremen':'M81.5,80.6 80.6,80.8 81.7,81.8 80.2,85.3 78.4,84.1 77.1,84.9 76.0,83.6 74.9,84.4 72.1,79.0 68.5,76.4 71.4,76.9 71.3,78.1 77.4,79.0 78.3,80.2 80.5,79.4Z',
  'Hamburg':'M110.0,55.9 113.3,55.0 111.8,57.1 114.1,59.4 112.1,62.7 116.8,67.3 114.6,69.0 112.7,68.9 109.5,66.1 108.0,68.0 105.6,68.2 106.0,66.8 104.4,67.6 101.9,64.3 102.0,62.3 100.9,62.2 101.8,59.2 103.5,61.1 105.7,58.3 110.0,57.2Z',
  'Hessen':'M95.0,143.1 98.4,142.9 99.9,145.1 97.4,147.7 98.8,151.9 96.9,153.1 96.6,154.9 101.1,156.9 102.1,155.2 101.2,156.0 100.4,154.0 103.4,152.1 104.7,153.8 104.3,152.1 105.8,152.0 107.4,157.5 109.6,157.9 110.1,160.0 114.3,161.6 113.7,164.6 112.6,163.2 111.4,163.6 112.8,164.6 112.0,167.2 113.9,168.5 112.2,169.7 109.2,168.9 108.6,170.3 109.9,171.7 106.7,171.7 106.7,172.6 107.8,172.1 107.5,173.4 108.5,172.7 109.7,174.3 108.7,176.5 106.8,176.9 104.8,184.5 106.7,185.0 106.8,183.3 109.4,183.0 110.3,184.9 109.1,185.6 109.1,190.7 107.2,193.5 104.1,194.6 101.8,193.6 101.2,198.8 99.0,200.0 99.2,201.6 95.0,201.2 95.5,207.4 92.9,207.9 91.8,205.8 88.1,205.0 86.3,207.6 85.5,206.1 82.4,207.4 81.8,209.4 83.2,209.5 83.7,211.5 82.7,211.7 83.1,217.7 84.6,217.8 84.7,219.9 85.7,219.8 85.0,221.3 86.2,221.9 84.4,224.1 84.9,226.1 83.8,227.0 85.4,231.3 80.7,231.7 80.7,233.8 77.1,236.2 77.4,233.1 78.8,233.2 79.3,231.7 74.8,231.3 73.6,228.9 74.0,226.9 71.4,227.4 72.1,230.0 70.3,231.2 66.0,227.3 65.2,224.2 68.5,221.0 66.9,221.1 64.9,216.2 64.8,213.0 62.9,210.6 60.6,209.9 52.8,212.5 50.1,209.1 52.3,205.9 54.2,207.0 53.0,204.2 53.6,202.8 55.9,201.5 57.0,202.4 57.7,201.6 57.1,200.1 59.4,199.8 57.9,195.7 55.3,194.0 56.5,192.6 56.0,189.3 57.2,188.0 60.0,188.2 60.3,186.2 58.8,183.1 60.4,180.5 59.2,178.2 62.9,174.5 65.7,175.4 68.1,173.2 68.0,171.0 70.2,168.9 69.3,167.9 69.8,165.5 75.0,165.1 74.3,164.0 76.3,161.0 75.4,158.6 71.5,159.2 70.8,157.5 74.2,153.8 80.8,153.3 81.1,151.6 79.6,149.5 81.7,148.3 84.7,148.7 84.9,151.0 87.9,150.3 91.8,144.7 90.9,143.9 94.6,142.0Z',
  'Mecklenburg-Vorpommern':'M174.1,23.9 177.6,25.7 185.7,25.9 181.5,27.1 177.1,26.4 175.6,27.3 176.0,28.1 171.9,28.3 169.9,31.3 170.0,33.0 172.5,33.8 171.2,32.5 174.5,30.0 174.9,28.3 176.0,29.2 178.0,27.8 177.7,27.1 179.2,27.3 179.7,28.7 181.1,27.6 181.7,29.7 187.2,25.8 187.3,27.6 189.1,28.8 189.4,32.4 194.1,34.3 195.7,36.6 195.0,37.5 197.5,36.8 196.7,38.2 197.4,37.6 198.6,40.4 199.8,40.6 199.4,39.0 204.9,37.0 207.8,39.8 206.1,42.9 210.6,47.4 208.2,49.7 211.2,48.0 210.4,44.6 211.9,44.6 211.8,46.9 212.4,45.7 213.9,46.6 214.0,44.3 212.1,41.5 210.5,41.5 210.8,42.7 209.2,44.2 209.1,42.1 206.8,43.4 207.9,40.0 206.3,37.5 207.7,36.7 209.4,39.9 213.2,41.9 218.6,47.1 217.7,47.7 218.5,49.8 213.8,49.4 210.2,50.8 207.8,50.1 213.8,54.4 220.2,55.0 218.5,56.6 220.0,56.7 221.3,60.1 220.7,63.3 222.7,66.7 223.7,72.2 221.2,72.9 219.6,75.1 215.4,75.0 219.0,70.5 219.1,68.0 210.7,68.4 209.7,64.9 208.1,64.4 207.3,62.7 207.1,64.5 208.3,65.2 205.2,65.9 203.0,68.9 201.0,69.3 200.4,72.7 198.1,73.6 197.2,75.7 194.5,74.4 192.7,77.0 191.4,75.6 189.8,76.0 186.2,79.3 185.2,78.9 186.0,77.8 180.5,78.3 180.4,76.7 178.2,76.5 178.0,75.4 172.2,75.6 170.9,73.4 167.4,72.6 166.6,71.2 165.0,71.9 161.9,70.6 161.2,73.4 159.2,74.8 157.8,74.5 157.1,75.7 155.3,75.5 156.1,76.6 153.8,77.0 150.9,75.9 148.8,77.4 149.4,79.2 148.4,80.9 144.7,80.2 144.4,81.4 139.2,80.3 139.5,78.4 136.1,76.3 134.1,71.9 132.2,71.3 130.1,73.0 126.6,70.1 123.7,70.3 124.8,66.5 129.7,64.3 129.6,61.7 132.3,61.5 132.9,57.6 127.9,54.5 127.6,50.8 128.2,49.1 131.0,47.2 131.7,48.3 133.3,47.9 131.3,47.3 131.5,46.0 139.0,43.5 141.0,44.8 141.0,46.9 143.1,45.9 146.2,48.3 146.9,45.5 145.9,45.8 145.9,44.3 145.5,45.8 144.4,45.6 144.2,44.3 147.2,43.2 147.1,45.5 147.9,42.8 149.3,42.8 150.7,40.4 150.1,39.9 148.2,42.1 148.0,41.1 152.1,37.7 156.6,38.1 162.7,36.5 163.7,37.9 164.2,36.9 162.9,36.6 169.3,31.7ZM197.9,15.5 196.5,17.6 197.7,20.0 204.4,20.6 204.1,22.4 201.6,24.9 202.6,27.2 204.3,27.4 206.7,29.9 205.4,31.2 205.6,32.7 203.6,31.8 205.1,30.5 202.6,30.9 204.5,29.6 198.5,30.1 197.0,32.8 195.9,32.9 197.6,33.5 196.9,34.9 194.2,33.6 195.1,33.9 195.4,32.5 193.7,33.5 191.9,32.9 191.7,31.7 190.3,32.3 191.5,31.6 189.6,30.3 190.0,28.6 193.5,28.1 192.2,26.2 190.6,26.2 193.7,24.1 192.7,22.8 190.8,23.1 190.4,21.3 193.3,21.1 194.6,22.7 194.4,21.1 196.3,19.9 195.5,21.2 196.5,20.8 197.5,23.5 199.9,24.0 199.8,21.2 197.0,20.2 196.3,18.5 193.0,20.8 194.0,17.1 190.8,20.8 193.2,16.6Z',
  'Niedersachsen':'M73.6,48.7 75.5,50.7 78.9,51.3 82.3,51.0 84.4,49.0 89.5,49.6 95.2,56.6 96.2,59.8 102.0,62.3 101.9,64.3 104.4,67.6 105.4,66.3 105.6,68.2 107.6,68.2 109.5,66.1 112.7,68.9 116.8,67.4 123.3,70.5 126.6,70.1 130.1,73.0 132.5,71.3 134.1,71.9 136.1,76.3 139.5,78.4 139.2,80.3 141.3,80.6 142.9,83.4 146.3,82.7 150.0,84.6 149.0,86.2 147.7,86.0 147.6,88.5 142.7,91.2 135.4,89.6 134.1,89.8 132.8,92.1 128.2,92.1 128.9,97.6 129.9,97.5 132.2,102.4 133.7,101.7 132.5,104.1 134.5,107.2 132.9,107.2 132.6,108.5 136.3,112.1 133.9,113.6 136.7,118.3 134.8,119.5 136.1,120.7 135.6,122.1 132.9,123.3 133.6,125.3 126.2,125.5 122.8,127.3 125.3,129.4 124.1,130.1 125.3,131.7 123.2,133.9 123.2,136.8 124.6,137.9 126.6,142.6 124.8,143.6 125.5,146.2 123.9,145.4 121.8,146.5 118.0,145.0 117.3,147.7 114.3,149.8 113.2,149.4 112.3,151.5 109.5,151.2 106.6,153.7 105.8,152.0 104.3,152.1 104.7,153.8 103.4,152.1 100.4,154.0 101.2,156.0 102.1,155.2 101.1,156.9 96.6,154.9 96.9,153.1 98.8,151.9 97.4,147.7 99.9,145.1 98.4,142.9 91.9,142.4 92.1,137.8 93.7,136.4 94.1,133.8 90.8,133.8 91.1,132.1 89.2,130.7 89.3,129.0 86.6,128.6 86.1,122.6 82.4,122.2 81.6,119.6 83.2,120.1 83.0,118.4 83.9,118.1 81.0,116.0 85.1,110.9 84.4,109.2 85.5,107.8 84.4,106.9 83.3,106.7 80.3,110.9 78.1,111.4 74.3,111.2 74.2,106.7 72.8,105.5 69.0,106.2 67.1,108.9 63.7,108.4 63.9,110.7 67.3,112.5 67.4,118.9 69.4,119.9 66.3,123.1 62.8,122.1 60.9,124.6 56.6,124.9 55.0,126.2 52.7,124.1 56.0,122.9 56.2,120.5 53.1,119.4 54.5,116.2 53.9,114.9 55.4,114.7 54.1,112.3 48.4,110.9 47.7,108.6 45.6,107.8 44.9,112.0 37.4,116.7 31.4,117.5 30.3,115.4 31.6,111.7 29.7,108.1 28.2,109.5 22.0,107.5 21.3,104.5 23.5,104.1 22.3,103.0 22.8,100.7 30.9,101.1 32.0,92.3 36.4,86.0 35.5,80.7 37.2,79.1 37.0,77.6 36.7,76.2 34.9,76.0 36.1,72.1 30.2,71.9 29.5,70.8 30.4,63.7 33.0,63.7 31.9,61.8 33.7,59.7 37.8,57.4 43.4,57.9 56.1,56.2 56.9,59.1 58.6,59.1 60.2,62.8 59.8,64.5 57.4,64.8 57.7,66.5 62.3,69.3 64.0,66.4 64.0,64.1 61.8,64.2 62.8,60.4 69.2,62.7 70.3,64.0 69.3,65.0 70.7,64.3 68.4,56.9 70.3,51.1ZM69.3,77.7 72.1,79.0 74.9,84.4 76.0,83.6 77.1,84.9 78.4,84.1 80.2,85.3 81.5,83.9 80.9,82.2 81.7,81.8 80.6,80.8 81.5,80.6 80.5,79.4 78.3,80.2 77.4,79.0 71.3,78.1 71.4,76.9 68.5,76.4ZM23.3,60.1 24.6,60.7 22.2,61.5 23.0,62.7 19.9,60.9Z',
  'Nordrhein-Westfalen':'M73.2,105.8 75.1,111.5 80.3,110.9 83.3,106.7 85.3,107.5 84.2,112.8 82.7,113.3 81.0,116.0 83.9,118.1 83.0,118.4 83.2,120.1 81.6,119.6 82.4,122.2 86.1,122.6 86.6,128.6 89.3,129.0 89.2,130.7 91.1,132.1 90.8,133.8 94.1,133.8 93.7,136.4 92.0,138.4 91.9,142.4 93.7,142.5 90.9,143.9 91.8,144.7 87.9,150.3 84.9,151.0 84.8,148.8 83.0,147.8 79.6,149.5 81.1,151.6 80.8,153.3 74.2,153.8 72.3,155.5 70.6,158.0 71.5,159.2 75.1,158.2 76.3,161.0 74.3,164.0 75.0,165.1 69.8,165.5 69.3,167.9 70.2,168.9 68.0,171.0 68.1,173.2 65.7,175.4 62.9,174.5 59.2,178.2 60.4,180.4 59.7,182.3 57.1,182.1 55.1,178.9 55.0,176.0 51.4,174.5 51.9,172.6 50.5,171.9 48.8,172.9 49.6,176.0 46.9,177.1 47.6,178.3 46.8,179.2 39.5,181.4 38.5,184.7 35.3,185.4 35.1,184.3 33.5,186.4 31.0,186.3 27.8,188.2 27.8,189.3 26.6,189.5 27.1,192.0 26.0,192.7 24.4,191.0 23.1,191.7 24.5,196.7 21.9,197.5 21.0,196.1 20.2,197.2 19.3,195.3 15.1,197.3 15.4,196.2 13.6,195.2 13.9,197.8 12.3,195.4 13.2,192.7 12.0,190.7 9.2,190.3 7.9,188.3 10.6,185.5 7.9,185.3 6.5,181.7 4.1,181.0 2.4,178.1 4.1,177.2 3.9,176.0 5.3,175.9 5.5,172.8 3.8,172.3 4.1,170.2 0.8,170.4 0.0,167.4 2.6,168.1 3.8,165.6 7.9,163.1 7.2,162.2 8.4,161.5 5.8,162.2 5.4,159.3 9.4,154.2 9.0,147.9 5.7,144.2 6.5,141.9 4.4,141.2 4.7,139.5 2.4,138.5 3.5,137.4 2.6,134.7 5.1,133.4 7.8,134.2 6.2,132.4 7.5,131.7 14.3,135.0 13.9,132.9 15.9,133.8 21.5,131.1 22.8,131.9 25.3,129.2 25.2,127.9 21.6,126.0 23.5,122.7 26.3,122.4 29.4,118.2 33.7,116.5 37.4,116.7 44.9,112.0 45.6,107.8 47.7,108.6 48.4,110.9 54.1,112.3 55.4,114.7 53.9,114.9 54.5,116.2 53.1,119.4 56.4,120.9 56.0,122.9 52.7,124.1 53.6,125.6 60.9,124.6 62.8,122.1 66.3,123.1 69.4,119.9 67.4,118.9 67.3,112.5 63.9,110.7 63.5,108.5 67.1,108.9 69.0,106.2Z',
  'Rheinland-Pfalz':'M50.5,171.9 51.9,172.6 51.4,174.5 55.0,176.0 55.1,178.9 57.1,182.1 58.9,181.9 60.3,186.5 59.4,188.9 57.2,188.0 56.0,189.3 56.5,192.6 55.3,194.0 57.9,195.7 59.4,199.8 57.1,200.1 57.7,201.6 57.0,202.4 55.9,201.5 53.6,202.8 53.0,204.2 54.2,207.0 52.3,205.9 50.1,209.1 52.8,212.5 62.5,210.2 64.8,213.0 64.9,216.2 66.9,221.1 68.5,221.0 65.2,224.2 67.0,228.6 67.4,234.3 69.0,234.6 67.9,236.7 68.8,236.6 68.7,238.0 67.5,239.2 68.6,240.5 66.0,243.0 65.2,248.9 62.0,254.4 58.1,253.5 54.1,250.7 52.3,251.7 50.5,250.4 47.1,251.1 43.5,249.0 42.4,246.0 38.8,245.9 37.2,242.8 39.7,240.8 40.3,237.3 37.2,236.5 36.2,234.7 37.7,233.1 36.7,228.3 35.2,229.2 30.4,226.0 19.3,231.3 13.3,230.2 14.5,225.2 16.9,222.8 17.2,219.3 14.0,218.8 12.9,217.4 11.5,218.2 9.1,213.3 7.6,213.2 5.9,208.8 7.2,204.0 8.3,203.4 7.8,201.4 10.6,200.2 11.2,198.0 14.4,197.8 13.3,195.4 15.4,196.2 15.1,197.3 19.3,195.3 20.2,197.2 21.0,196.1 21.9,197.5 24.5,196.7 23.1,191.7 24.4,191.0 26.0,192.7 27.1,192.0 26.6,189.5 27.8,189.3 27.8,188.2 31.0,186.3 33.5,186.4 35.1,184.3 35.3,185.4 38.5,184.7 39.5,181.4 46.8,179.2 47.6,178.3 46.9,177.1 49.6,176.0 48.8,172.9Z',
  'Saarland':'M30.5,226.2 35.2,229.2 36.7,228.3 37.7,230.4 37.7,233.1 36.2,234.7 37.2,236.5 40.3,237.3 39.7,240.8 37.2,242.8 39.0,247.0 34.7,248.3 32.1,246.6 31.1,248.4 30.4,245.2 27.6,243.7 25.4,244.1 25.2,246.7 22.7,246.2 20.8,241.4 18.2,238.5 19.1,237.7 17.4,234.9 14.7,233.2 12.7,233.6 13.1,230.2 19.3,231.3 28.0,226.4Z',
  'Sachsen':'M183.4,141.4 185.5,142.8 187.1,141.6 189.2,144.1 191.1,144.5 190.9,146.0 192.6,147.6 191.7,151.6 192.7,152.9 194.1,153.4 195.5,151.1 197.0,151.8 197.7,150.5 201.3,154.0 207.0,154.4 212.1,152.8 213.2,153.9 214.9,150.8 214.1,149.4 215.6,149.4 216.8,146.7 221.8,148.6 227.7,145.6 230.2,146.5 230.9,144.5 232.2,147.6 236.7,148.9 238.1,150.5 238.2,154.7 239.7,156.6 240.0,159.5 237.2,169.9 234.3,174.0 233.9,176.6 228.8,175.6 229.9,172.3 227.5,172.7 228.4,170.0 226.0,168.8 226.0,167.3 225.7,168.6 223.2,169.2 220.5,167.2 219.3,170.6 223.3,171.9 222.6,174.2 219.5,174.2 214.4,177.8 211.6,177.7 210.1,178.5 210.2,180.2 208.9,181.3 201.0,181.5 200.4,184.7 198.8,186.4 196.5,184.4 195.2,187.0 193.1,186.5 191.8,190.4 187.5,190.0 187.4,192.5 186.0,194.0 182.2,192.1 178.9,194.7 176.6,193.8 174.0,194.6 173.4,196.7 170.0,199.7 169.0,203.8 167.9,203.7 167.9,201.8 166.6,200.7 167.1,199.8 165.6,199.6 165.5,197.8 163.6,198.2 159.8,196.4 160.0,194.8 157.7,192.7 159.4,192.2 159.7,190.8 157.3,188.5 160.9,184.6 161.5,188.0 164.8,187.0 164.5,184.9 167.8,184.6 169.3,182.5 166.8,180.1 168.4,178.6 167.3,176.9 172.3,175.9 173.4,173.8 177.9,172.5 176.7,169.4 174.6,169.4 174.9,168.3 174.1,168.6 172.8,165.8 166.5,164.7 164.6,156.1 165.7,155.7 165.8,151.8 164.5,150.1 166.0,149.2 165.7,147.7 167.0,145.8Z',
  'Sachsen-Anhalt':'M150.8,85.2 152.3,85.7 152.4,87.0 156.6,88.1 156.4,90.0 166.7,92.0 167.3,94.7 165.8,98.0 166.9,101.6 165.1,101.8 164.4,105.9 165.5,105.6 165.8,107.2 166.8,106.0 169.3,107.9 167.9,110.5 168.8,113.4 167.1,117.3 168.4,118.5 166.2,120.8 167.8,123.5 171.9,127.1 173.3,126.5 174.9,128.5 178.4,127.4 181.3,129.4 182.9,129.2 183.1,130.6 185.9,130.5 186.2,131.9 188.1,131.9 187.9,133.1 190.9,133.1 190.2,134.1 191.8,139.6 187.7,142.9 187.1,141.6 185.5,142.8 182.5,141.1 181.1,142.6 178.7,141.9 177.4,143.7 167.0,145.8 165.8,147.4 166.0,149.2 164.5,150.1 165.8,151.8 165.7,155.7 164.6,156.1 166.1,160.4 165.3,161.8 166.3,161.8 166.5,164.7 168.2,165.5 167.3,167.7 168.5,168.0 166.6,171.8 165.5,170.2 161.0,170.7 160.2,168.8 157.4,166.9 154.3,167.7 151.8,164.7 146.6,164.9 146.7,161.5 143.9,160.3 146.9,157.0 144.8,155.1 144.7,153.4 142.8,152.3 134.1,152.1 133.0,147.1 131.3,145.2 132.7,144.6 132.4,143.7 126.6,142.6 124.6,137.9 123.2,136.8 123.2,133.9 125.3,131.7 124.1,130.1 125.3,129.4 123.5,128.6 123.0,127.0 124.6,127.2 126.2,125.5 133.6,125.3 132.9,123.3 135.6,122.1 136.1,120.7 134.8,119.5 136.7,118.3 133.9,113.6 136.3,112.1 132.6,108.5 132.9,107.2 134.5,107.2 132.5,104.1 133.7,101.7 132.2,102.4 129.9,97.5 128.9,97.6 128.2,92.1 132.8,92.1 134.1,89.8 135.4,89.6 142.7,91.2 147.6,88.5 147.9,85.8 151.3,84.6Z',
  'Schleswig-Holstein':'M136.1,21.8 140.4,23.0 142.5,27.3 137.4,27.3 136.8,25.5 134.5,25.7ZM66.4,0.5 67.3,1.7 65.0,3.7 65.3,6.4 67.0,7.5 77.0,5.8 87.8,8.4 89.3,10.6 92.6,9.0 93.3,11.2 98.0,7.5 97.7,9.4 102.6,10.8 104.0,12.5 105.6,12.2 105.7,10.8 106.9,11.5 109.0,16.1 107.6,14.8 106.3,17.9 102.1,19.9 100.8,22.1 106.5,18.1 106.7,16.0 109.0,16.2 108.8,21.1 103.9,24.6 104.7,25.5 111.4,23.9 113.3,25.1 111.5,31.1 112.9,30.4 114.1,26.9 116.4,25.9 123.9,29.0 126.5,31.4 128.7,31.1 132.4,28.2 137.6,27.8 135.8,29.3 136.7,35.9 131.1,40.4 129.2,40.1 127.7,42.1 128.7,44.3 131.1,44.7 131.3,47.3 133.3,47.9 131.7,48.3 131.0,47.2 128.2,49.1 127.9,54.5 132.9,57.6 132.3,61.5 129.6,61.7 129.7,64.3 124.8,66.5 124.4,69.6 123.3,70.5 116.4,67.4 116.9,66.7 112.5,63.6 112.3,61.3 113.6,61.1 114.1,59.4 111.8,57.1 113.3,55.4 112.8,54.7 110.3,55.5 110.0,57.2 108.1,57.0 107.8,58.4 105.7,58.3 103.5,61.1 101.8,59.2 100.9,62.2 99.5,61.9 96.2,59.8 95.2,56.6 89.5,49.6 80.6,48.2 77.2,43.1 81.0,42.7 81.5,41.6 80.0,38.6 78.2,39.0 76.9,36.8 77.6,33.6 79.4,33.3 80.7,31.1 78.3,32.9 77.8,32.1 77.9,33.2 77.3,32.0 72.6,32.8 70.9,31.2 71.6,29.2 73.7,29.2 71.7,28.0 78.4,27.3 82.5,24.4 81.4,22.4 79.5,24.8 76.8,24.5 79.0,19.4 77.0,19.2 77.3,17.2 73.7,13.6 73.9,12.0 71.2,7.2 66.6,8.8 63.8,7.6 63.0,12.7 63.5,6.2ZM69.9,12.6 71.3,14.1 70.6,15.7 66.1,14.7 66.8,13.1Z',
  'Thüringen':'M128.3,142.6 132.7,144.1 131.3,145.2 133.0,147.1 134.1,152.1 142.8,152.3 144.7,153.4 144.8,155.1 146.9,157.0 143.9,160.3 146.7,161.5 147.1,162.6 146.2,163.5 147.1,165.2 151.8,164.7 154.3,167.7 157.4,166.9 160.2,168.8 161.0,170.7 165.5,170.2 166.4,171.8 168.5,168.5 167.3,167.7 168.2,165.5 172.8,165.8 174.1,168.6 174.9,168.3 174.6,169.4 176.7,169.4 177.9,172.7 173.4,173.8 172.3,175.9 167.3,176.9 168.4,178.6 166.8,180.1 167.7,180.1 167.7,181.9 169.1,183.2 167.8,184.6 165.9,184.2 165.8,185.3 164.7,184.7 164.9,186.9 162.1,188.0 161.2,187.5 161.2,184.9 160.1,185.0 157.3,188.5 159.7,191.0 157.0,194.4 155.8,194.9 154.7,193.6 147.9,195.7 146.9,193.2 146.0,193.7 145.2,192.4 145.5,189.8 143.4,189.5 142.8,190.9 140.8,191.4 141.7,196.0 140.9,200.2 138.0,199.3 138.4,197.6 137.2,196.0 135.4,197.0 134.2,196.1 134.2,197.0 132.7,195.0 131.1,194.8 126.9,196.5 127.2,198.1 130.3,199.9 130.3,201.2 127.3,200.9 127.2,202.9 124.3,202.0 123.9,197.5 121.0,196.6 120.1,194.5 118.4,194.8 118.7,193.6 116.8,190.6 111.4,187.7 109.1,189.7 109.1,185.6 110.4,185.3 109.4,183.0 106.8,183.3 106.7,185.0 104.8,184.5 106.8,176.9 108.7,176.5 109.7,174.3 108.5,172.7 107.5,173.4 107.8,172.1 106.7,172.6 106.7,171.7 109.9,171.7 108.6,170.3 109.2,168.9 113.4,169.4 113.4,167.7 112.0,167.2 112.8,164.6 111.4,163.6 112.6,163.2 113.7,164.6 114.3,161.9 110.1,160.0 109.6,157.9 107.4,157.5 106.1,154.0 109.5,151.2 112.3,151.5 113.2,149.4 116.0,148.9 118.0,145.0 125.3,146.4 124.8,143.6Z'
}};
/* ===== Etappe 2: Deutschland-Karte (anonyme Bundesland-Zaehlung) =====
   Fuellung nach Anzahl in sequenziellen Blau-Stufen (dataviz-Regel), Zahl am
   Schwerpunkt nur wo eine Angabe existiert, Tooltip je Land. Gezeigt wird
   ausschliesslich das Aggregat der freiwilligen Profil-Angaben. */
function entKarteDE(laender, gesamtAngabe, nutzerGesamt){
  var cnt={}; (laender||[]).forEach(function(l){ if(l&&l.land!=null) cnt[l.land]=Number(l.anzahl)||0; });
  var max=0; Object.keys(cnt).forEach(function(k){ if(cnt[k]>max) max=cnt[k]; });
  var svg='';
  Object.keys(DE_KARTE.p).forEach(function(land){
    var n=cnt[land]||0;
    var fill='#eceae4', dunkel=false;   /* ohne Angabe: ruhige Flaeche, kein Wert */
    if(n>0 && max>0){ var r=n/max;
      fill = r>0.66 ? '#2a78d6' : (r>0.33 ? '#6da7ec' : '#b7d3f6');
      dunkel = r>0.66; }
    svg+='<g><title>'+esc(land)+' \u00b7 '+n+' Nutzer</title>'
      +'<path d="'+DE_KARTE.p[land]+'" fill="'+fill+'" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>'
      +'</g>';
  });
  /* Zahlen als zweite Ebene, damit keine Nachbar-Flaeche sie ueberdeckt */
  Object.keys(DE_KARTE.p).forEach(function(land){
    var n=cnt[land]||0; if(!(n>0)) return;
    var c=DE_KARTE.c[land]||[0,0]; var dunkel=(max>0 && n/max>0.66);
    svg+='<text x="'+c[0]+'" y="'+(c[1]+4)+'" text-anchor="middle" font-size="13" font-weight="700" fill="'+(dunkel?'#ffffff':'#0b0b0b')+'" style="paint-order:stroke" stroke="'+(dunkel?'rgba(11,11,11,0.25)':'rgba(255,255,255,0.85)')+'" stroke-width="3">'+n+'</text>';
  });
  return '<svg viewBox="0 0 '+DE_KARTE.w+' '+DE_KARTE.h+'" style="width:100%;max-width:190px;display:block;margin:0 auto 8px" role="img" aria-label="Nutzer je Bundesland">'+svg+'</svg>'
    +'<div style="font-size:10.5px;color:#898781;text-align:center;line-height:1.5">'+gesamtAngabe+' von '+nutzerGesamt+' Nutzern mit Angabe \u00b7 freiwillig \u00b7 anonym gez\u00e4hlt<br>Karte: \u00a9 GeoBasis-DE / BKG (dl-de/by-2-0)</div>';
}
/* ===== Supabase-Status-Kachel (Ralph 30.07.: "größe, welches paket usw im dashboard") =====
   Alles GEMESSENE Werte aus cb_supabase_status; das Paket ist ein gepflegter Config-Wert
   (Riki_Config supabase_paket) - solange er leer ist, sagt die Kachel das ehrlich,
   statt ein Paket zu raten. Limits erscheinen erst, wenn sie hinterlegt sind. */
async function dashSupaLoad(){
  var box=document.getElementById('entSupaBox'); if(!box) return;
  var d=null;
  try{ var r=await client.rpc('cb_supabase_status'); d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} } }catch(e){}
  if(!(d&&d.ok)){ box.innerHTML='<span style="color:#898781">Status nicht verf\u00fcgbar.</span>'; return; }
  var mb=function(b){ b=Number(b)||0; return b>=1048576? (b/1048576>=1024? (b/1073741824).toFixed(2).replace('.',',')+'\u2009GB' : Math.round(b/1048576)+'\u2009MB') : Math.max(1,Math.round(b/1024))+'\u2009kB'; };
  var balken=function(wert,limitMb){
    if(!(limitMb>0)) return '';
    var q=Math.min(1,(Number(wert)||0)/1048576/limitMb);
    var farbe=q>=0.9?'#d03b3b':(q>=0.75?'#fab219':'#2a78d6');
    return '<div style="height:6px;border-radius:4px;background:#e1e0d9;margin:4px 0 2px;overflow:hidden"><div style="height:100%;width:'+Math.max(2,Math.round(q*100))+'%;border-radius:4px;background:'+farbe+'"></div></div>'
      +'<div style="font-size:10.5px;color:#898781">'+Math.round(q*100)+'\u2009% von '+(limitMb>=1024?(limitMb/1024).toFixed(0)+'\u2009GB':limitMb+'\u2009MB')+'</div>';
  };
  var zeile=function(t,w){ return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid #e1e0d9;color:var(--ink,#0b0b0b)"><span style="color:#52514e">'+t+'</span><b>'+w+'</b></div>'; };
  box.innerHTML=
    '<div style="color:var(--ink,#0b0b0b);font-weight:700;margin-bottom:2px">'+esc(d.projekt||'')+'</div>'
    +'<div style="font-size:11px;color:#898781;margin-bottom:6px">Postgres '+esc(String(d.pg_version||'').split(' ')[0])+'</div>'
    +zeile('Paket', d.paket?esc(d.paket):'<span style="color:#c07a10">nicht hinterlegt</span>')
    +zeile('Datenbank', mb(d.db_bytes))+balken(d.db_bytes, Number(d.db_limit_mb)||0)
    +zeile('Dateispeicher', mb(d.storage_bytes)+' \u00b7 '+(Number(d.storage_dateien)||0)+' Dateien')+balken(d.storage_bytes, Number(d.storage_limit_mb)||0)
    +zeile('Struktur', (Number(d.tabellen)||0)+' Tabellen \u00b7 '+(Number(d.views)||0)+' Sichten \u00b7 '+(Number(d.funktionen)||0)+' Funktionen')
    +(d.paket?'':'<div style="font-size:10.5px;color:#898781;margin-top:6px">Paket einmal nennen \u2014 dann erscheinen die Limit-Balken.</div>');
}
/* ===== Erfasser-Kachel (Ralph 06.09.2026) =====
   Zeigt, wer wie viele Produkte angelegt hat und wie viele aus Importen stammen.
   Faellt der RPC aus, steht der Grund da - keine erfundene Verteilung. */
async function dashErfasserLoad(){
  var box=document.getElementById('entErfasserBox'); if(!box) return;
  var d=null;
  try{ var r=await client.rpc('cb_admin_erfasser_statistik'); d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} } }catch(e){}
  if(!d){ box.innerHTML='<div style="color:#c07a10">Erfasser-Zahlen konnten gerade nicht geladen werden.</div>'; return; }
  var f=function(n){ return String(n==null?0:n).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); };
  var zeile=function(farbe,txt,val,sub){
    return '<div style="display:flex;align-items:center;gap:9px;font-size:12.5px;padding:6.5px 0;border-top:1px solid #e1e0d9;color:var(--ink,#0b0b0b)">'
      +'<span style="width:8px;height:8px;border-radius:50%;background:'+farbe+';flex:0 0 auto"></span>'
      +'<span style="flex:1;min-width:0">'+txt+(sub?' <span style="color:#898781">'+sub+'</span>':'')+'</span>'
      +'<b style="font-variant-numeric:tabular-nums">'+f(val)+'</b></div>';
  };
  var pers=Array.isArray(d.personen)?d.personen:[];
  var imp=Array.isArray(d.importe)?d.importe:[];
  var h='';
  if(pers.length){
    pers.forEach(function(p){ h+=zeile('#2a78d6',esc(p.name),p.anzahl,p.aktiv!=null?(p.aktiv+' aktiv'):''); });
  } else {
    h+='<div style="color:#898781;padding:6px 0">Noch kein Produkt mit hinterlegtem Erfasser.</div>';
  }
  h+='<div style="margin-top:12px;font-size:11px;font-weight:700;color:var(--ink,#0b0b0b)">Herkunft aller '+f(d.gesamt)+' Produkte</div>';
  imp.forEach(function(i){ h+=zeile('#898781',esc(i.quelle),i.anzahl,''); });
  h+='<div style="margin-top:8px;font-size:10.5px;color:#898781;line-height:1.5">'
    +f(d.mit_erfasser)+' Produkte tragen einen Erfasser, '+f(d.ohne_erfasser)+' nicht \u2014 die stammen aus Importen. '
    +'Die Personenzahlen sind daher kein Anteil am Katalog.</div>';
  box.innerHTML=h;
}
async function dashKarteLoad(){
  var box=document.getElementById('entKarteBox'); if(!box) return;
  var d=null;
  try{ var r=await client.rpc('cb_bundesland_zaehlung'); d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} } }catch(e){}
  if(!(d&&d.ok)) return;  /* Lade-Fallback bleibt stehen - keine erfundene Karte */
  var ges=Number(d.gesamt_mit_angabe)||0;
  var nutzer=Number(window._entNutzerGesamt)||0;
  if(!ges){ box.innerHTML='<div style="border:1px dashed #c3c2b7;border-radius:8px;padding:16px 12px;text-align:center;color:#898781;font-size:12px;line-height:1.55">Noch keine Angaben.<br>Die Karte f\u00fcllt sich, sobald Nutzer im Profil ihr Bundesland w\u00e4hlen (freiwillig).</div>'; return; }
  box.innerHTML=entKarteDE(d.laender, ges, nutzer);
}
/* ===== Audit-Karte im Dashboard (Ralph 29.07.: "da hätte ich gerne eine anzeige im
   dashboard und stichproben zum gegenprüfen") ===== */
async function dashAuditLoad(){
  var box=document.getElementById('dashAuditBox'); if(!box) return;
  var d=null;
  try{ var r=await client.rpc('cb_audit_status'); d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} } }catch(e){}
  if(!(d&&d.ok)){ box.innerHTML=''; return; }
  var fmtT=function(t){ if(!t) return 'noch keiner'; try{ return new Date(t).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return String(t); } };
  var zeile=function(ico,titel,wert,warn){ return '<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line);font-size:12.5px"><span style="font-size:14px">'+ico+'</span><span style="flex:1;color:var(--ink)">'+titel+'</span><b style="color:'+(warn?'#c07a10':'var(--ink)')+'">'+wert+'</b></div>'; };
  box.innerHTML='<div>'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px">'
      +'<button onclick="dashAuditProbe()" style="margin-left:auto;padding:6px 12px;border:1px solid #2a78d6;border-radius:8px;background:transparent;color:#2a78d6;font-weight:700;font-size:12px;cursor:pointer">Stichprobe ziehen</button>'
    +'</div>'
    +zeile('🤖','Autopilot 1.0 · letzter Lauf '+fmtT(d.ap1_letzter_lauf)+' · heute '+(Number(d.ap1_heute_usd)||0).toFixed(2)+' $', (d.ap1_wartend||0)+' wartend', (d.ap1_wartend||0)>0)
    +zeile('🛡️','Sofort-Wächter · neue Zutaten seit letzter Wochenprüfung', (d.zutaten_ungeprueft||0)+' ungeprüft', false)
    +zeile('📅','Wochenprüfung 2.0 · letzter Lauf: '+fmtT(d.ap2_letzter_lauf), (d.ap2_offene_todos||0)+' offene Prüf-Todos', (d.ap2_offene_todos||0)>0)
    +zeile('🏷️','Automatisch entstandene Produkte (Autopilot/Crawl)', (Number(d.auto_produkte)||0)+' · davon auto-verifiziert '+(Number(d.auto_verifiziert)||0), false)
    +'<div id="dashAuditProbe"></div>'
  +'</div>';
  /* Etappe 2: Autopilot-Tagesdeckel als Linie im Kosten-Diagramm - der Wert kommt jetzt
     belegt aus cb_audit_status (Riki_Config autopilot_tageslimit_usd), nichts hartkodiert.
     Ehrliche Beschriftung: der Deckel gilt fuer den AUTOPILOT, das Diagramm zeigt alle Riki-Kosten. */
  try{ var lim=Number(d.ap1_tageslimit); var kb=document.getElementById('entKostenBox');
    if(kb && isFinite(lim) && lim>0 && Array.isArray(window._entVerlauf) && typeof entKostenChart==='function'){
      kb.innerHTML=entKostenChart(window._entVerlauf, lim);
      var lg=document.getElementById('entLimitLeg');
      if(lg){ lg.style.display=''; lg.textContent='\u2212\u2212 Autopilot-Deckel ('+lim.toFixed(2).replace('.',',')+'\u2009$)'; } } }catch(e){}
}
async function dashAuditProbe(){
  var out=document.getElementById('dashAuditProbe'); if(!out) return;
  out.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">Ziehe Stichprobe…</div>';
  var d=null;
  try{ var r=await client.rpc('cb_audit_stichprobe',{p_n:5}); d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} } }catch(e){}
  var list=(d&&d.ok&&Array.isArray(d.produkte))?d.produkte:[];
  if(!list.length){ out.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">Keine automatischen Produkte gefunden.</div>'; return; }
  out.innerHTML='<div style="font-size:11px;color:var(--muted);margin:8px 0 2px">Zufällige Auto-Produkte — gegen Etikett/Herstellerseite prüfen, dann ggf. verifizieren:</div>'
    +list.map(function(p){
      return '<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px dashed var(--line);font-size:12.5px">'
        +'<span style="flex:1;min-width:0"><b>'+esc(p.name||p.id)+'</b> <span style="color:var(--muted)">· '+esc(p.marke||'')+' · '+esc(p.herkunft||'')+' · '+esc(p.status||'')+' · verifiziert: '+esc(p.verifiziert||'Nein')+'</span>'
        +(p.quelle?'<div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.quelle)+'</div>':'')+'</span>'
        +'<button onclick="dashOpenProdukt(\''+esc(p.id)+'\')" style="flex:0 0 auto;border:1px solid #107e3e;background:#eef8f1;color:#1e6b42;border-radius:8px;padding:6px 11px;font-weight:700;font-size:12px;cursor:pointer">Öffnen ›</button>'
      +'</div>'; }).join('');
}
if(typeof window!=='undefined'){ window.dashAuditLoad=dashAuditLoad; window.dashAuditProbe=dashAuditProbe; }
/* Klick auf ein Wächter-Symbol: lädt die KONKRETEN Fälle (cb_waechter_faelle nach nr)
   und listet sie – Produkte sind direkt im Editor öffnenbar, Zutaten/Zusatzstoffe zeigen den Befund. */
async function dashWaechterFaelle(nr, nameEnc, view){
  if(!(ME&&ME.is_admin)) return;
  var nm=''; try{ nm=decodeURIComponent(nameEnc||''); }catch(e){ nm=nameEnc||''; }
  var ov=document.getElementById('waFaelleOv');
  if(!ov){ ov=document.createElement('div'); ov.id='waFaelleOv';
    ov.style.cssText='position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-start;justify-content:center;background:rgba(20,32,48,.45);overflow:auto;padding:24px 12px';
    ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    document.body.appendChild(ov); }
  ov.innerHTML='<div style="background:var(--card,#fff);color:var(--ink,#22343a);border-radius:16px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(20,40,70,.32);padding:20px;margin:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div style="font-weight:800;font-size:17px">🛡️ '+esc(nm)+'</div><button onclick="var o=document.getElementById(\'waFaelleOv\');if(o)o.remove()" style="border:0;background:var(--bg,#eef2f5);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px">✕</button></div>'
    +'<div id="waFaelleBody" style="font-size:13px;color:var(--muted,#6b7a85);margin-top:10px">Lade Fälle …</div></div>';
  try{
    /* Wächter 3 (Nährwerte) hat seit dem 30.07.2026 eine eigene, reichere Liste:
       cb_naehrwerte_qa_faelle nennt die Regel, die WIRKLICH greift (Spalte befund
       der View) und sagt je Fall, ob er bestätigbar ist. Vorher stand bei JEDEM
       Fall der kcal-Text – Ralph hat vier Fälle geprüft ("die kcal passen"),
       ausgelöst hatten n5/n6. Ein Hinweis, der nur für einen Fall stimmt, schickt
       den Prüfer an die falsche Stelle. */
    var rows=[];
    if(Number(nr)===3){
      var r3=await client.rpc('cb_naehrwerte_qa_faelle');
      if(r3.error) throw new Error(r3.error.message);
      rows=(r3.data||[]).map(function(x){
        return { typ:'produkt', id:x.id, name:x.name, detail:x.befund,
                 regeln:(x.regeln||[]), abhakbar:!!x.abhakbar };
      });
    } else if(nr){
      var r=await client.rpc('cb_waechter_faelle',{p_nr:nr});
      if(r.error) throw new Error(r.error.message);
      rows=r.data||[];
    } else if(view){
      /* 🔴 16.08.2026, Ralph: „unten sind die waechter, ich kann nicht klicken,
         nicht passiert und nichts wird angezeigt. wie soll ich das was machen"
         Gemessen: 25 Kacheln, aber cb_waechter_faelle kennt nur nr 1..9. Die
         anderen 16 zeigten eine Zahl ohne Weg — eine Attrappe.
         cb_admin_waechter_faelle_view gibt die Zeile so zurueck, wie die View
         sie fuehrt. Hier wird NICHTS ausgedacht: Titel, Kennung und Befund
         werden aus den vorhandenen Feldern GENOMMEN, und was uebrig bleibt,
         steht als Feld:Wert darunter statt verschluckt zu werden. */
      var rv=await client.rpc('cb_admin_waechter_faelle_view',{p_view:view,p_limit:100});
      if(rv.error) throw new Error(rv.error.message);
      rows=(rv.data||[]).map(function(o){
        var z=(o&&o.zeile)?o.zeile:o;
        return _waZeileDeuten(z);
      });
    } else {
      throw new Error('Dieser Waechter nennt keine Quelle — nichts zum Aufblaettern.');
    }
    var b=document.getElementById('waFaelleBody'); if(!b) return;
    if(!rows.length){ b.innerHTML='<div style="color:#1e6b42">Keine offenen Fälle – dieser Wächter ist still. ✓</div>'; return; }
    var html='<div style="margin-bottom:6px">'+rows.length+' Fall/Fälle zum Bearbeiten:</div>';
    html+=rows.map(function(x){
      var prod=(x.typ==='produkt');
      var hint = prod ? '' : ' · '+(x.typ==='zutat'?'Zutat':'Zusatzstoff')+' → im Regelwerk/Stamm bearbeiten';
      /* Bestätigen-Knöpfe: nur für die drei Regeln, die einen ZUSTAND beschreiben
         (n1 kcal · n5 Salz · n6 Ballaststoffe). Zucker über Kohlenhydraten,
         gesättigtes über Gesamtfett und eine Makro-Summe über 100 g sind
         physikalisch unmöglich – die sind immer ein Datenfehler und bekommen
         bewusst KEINEN Haken. Ein Riegel, den man wegklicken kann, ist kein Riegel. */
      var okBtns='';
      if(prod && x.abhakbar && (x.regeln||[]).length){
        okBtns=(x.regeln||[]).filter(function(rg){ return WA_REGEL_OK_TEXT[rg]; }).map(function(rg){
          return '<button onclick="waRegelOk(\''+esc(x.id)+'\',\''+esc(rg)+'\','+Number(nr)+',\''+encodeURIComponent(nm)+'\')"'
            +' title="Fall geprüft und in Ordnung – wird mit Begründung und deinem Namen am Produkt vermerkt"'
            +' style="flex:0 0 auto;border:1px solid #b8860b;background:#fdf6e3;color:#8a5a00;border-radius:9px;padding:7px 11px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap">✓ '
            +esc(WA_REGEL_OK_TEXT[rg])+' passt</button>';
        }).join('');
      }
      /* 🔴 26.08.2026, Ralph: „ist der inhalt plausibel?" — nein, war er nicht.
         Dieser Satz gehoert zum NAEHRWERT-Waechter (Nummer 3): Zucker ueber
         Kohlenhydraten oder eine Makrosumme ueber 100 g sind wirklich unmoeglich.
         Er stand aber bei JEDEM Waechter, dessen Faelle nicht abhakbar sind.
         Gemessen an „g oder ml": alle 42 Faelle tragen dringlichkeit
         „Annahme - Etikett pruefen" — eine ANNAHME, die man nachsehen soll, und
         nichts Unmoegliches. Bei „Wasser" stand „Physikalisch unmoeglich".
         Jetzt erscheint der Satz nur noch dort, wo er stimmt. */
      var hart=(prod && x.abhakbar===false && Number(nr)===3)
        ? '<div style="font-size:11px;color:#cf5442;font-weight:700;margin-top:2px">Physikalisch unmöglich – muss korrigiert werden, nicht abgehakt.</div>' : '';
      /* 🔴 27.08.2026, Ralph: „beim shake warnt er, ist g und er meint ml. in dem fall ist
         es ein pulver und g ist richtig. im popup muss ich entscheiden koennen."
         Der Waechter „g oder ml" meldete eine ANNAHME und bot keinen Weg, sie zu
         bestaetigen oder zu ueberschreiben — nur „Öffnen", also den Umweg ueber den
         ganzen Editor. Ein Waechter ohne Entscheidungsknopf ist eine Anzeigetafel.
         KEIN zweiter Weg: die Knoepfe rufen dieselbe RPC wie die Seite
         „⚖️ Bezugseinheit g / ml" (einheitSet) — cb_produkt_mengen_einheit_setzen.
         Quelle „Etikett": wer hier klickt, hat nachgesehen. */
      var ehBtns='';
      if(prod && view==='v_mengen_einheit_offen'){
        ehBtns=_waEhBtn(x.id,'g','100 g',view,nm)+_waEhBtn(x.id,'ml','100 ml',view,nm);
      }
      return '<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line,#e3e9ec);flex-wrap:wrap">'
        +'<div style="flex:1 1 240px;min-width:0"><div style="font-weight:700;color:var(--ink,#22343a)">'+esc(x.name||x.id)+'</div>'
        +'<div style="font-size:11.5px;color:var(--muted,#6b7a85)">'+esc(x.detail||'')+hint+'</div>'+hart+'</div>'
        +ehBtns
        +okBtns
        +(prod?'<button onclick="dashOpenProdukt(\''+esc(x.id)+'\');var o=document.getElementById(\'waFaelleOv\');if(o)o.remove()" style="flex:0 0 auto;border:1px solid #107e3e;background:#eef8f1;color:#1e6b42;border-radius:9px;padding:7px 13px;font-weight:700;font-size:12.5px;cursor:pointer">Öffnen ›</button>':'')
      +'</div>';
    }).join('');
    b.style.color='var(--ink,#22343a)'; b.innerHTML=html;
  }catch(e){ var b2=document.getElementById('waFaelleBody'); if(b2){ b2.style.color='#cf5442'; b2.textContent='Konnte die Fälle nicht laden: '+((e&&e.message)||e); } }
}
/* ---------------------------------------------------------------------------
   Eine rohe Wächterzeile in Titel / Kennung / Befund uebersetzen.
   🔴 KEINE ERFINDUNG: die Reihenfolge sagt nur, welches VORHANDENE Feld zuerst
   genommen wird. Findet sich keines, bleibt das Feld leer — es wird nichts
   hergeleitet. Alles, was nicht in Titel oder Befund gelandet ist, steht
   darunter als Feld:Wert; sonst waere die Haelfte der Zeile unsichtbar.
   --------------------------------------------------------------------------- */
var WA_FELD_ID   =['Produkt_ID','Zutat_ID','id','entity_id','e_nummer','normalform','grundname','einzahl_id','norm'];
/* 16.08. Work #34 ergaenzt: der neue Stamm nennt den Namen canonical_name, und
   v_zutaten_qa_r9 gruppiert ueber norm. Ohne die beiden faellt die Zeile auf die
   Kennung zurueck und Ralph liest eine UUID statt eines Namens.
   GEMESSEN an den echten Rueckgaben, nicht angenommen. */
var WA_FELD_NAME =['Produktname','Zutat','canonical_name','name','namen','grundname','einzahl','norm','normalform','e_nummer'];
var WA_FELD_TEXT =['befund','grund','problem','empfehlung','assessment_reason','dringlichkeit','werte_im_konflikt','spanne'];
function _waErstes(z,liste){
  for(var i=0;i<liste.length;i++){
    var v=z[liste[i]];
    if(v!==null && v!==undefined && String(v)!=='') return {k:liste[i], v:String(v)};
  }
  return null;
}
function _waZeileDeuten(z){
  z=z||{};
  var fi=_waErstes(z,WA_FELD_ID), fn=_waErstes(z,WA_FELD_NAME), ft=_waErstes(z,WA_FELD_TEXT);
  var id=fi?fi.v:'', name=fn?fn.v:(id||'(ohne Bezeichnung)');
  var benutzt={}; if(fi)benutzt[fi.k]=1; if(fn)benutzt[fn.k]=1; if(ft)benutzt[ft.k]=1;
  /* 🔴 17.08.2026, Ralphs Screenshot der Regelfaelle: jede Zeile zeigte 13
     Regel-Flags, davon ZWOELF mit "false". Der eine Wert, auf den es ankommt
     (r8_bewertung_fehlt: true), ging darin unter. Eine Regel, die NICHT greift,
     ist bei einem Waechter keine Information — sie ist Rauschen.
     Jetzt: false und 0 werden nicht ausgeschrieben, sondern GEZAEHLT. Damit ist
     nichts versteckt (die Anzahl steht da) und die Zeile wieder lesbar. */
  /* 🔴 17.08., zweiter Blick auf Ralphs Screenshot: dort stand
     „regeln: r8_bewertung_fehlt · … · r8_bewertung_fehlt: true" — DIESELBE
     Angabe zweimal in einer Zeile. Die View fuehrt die zutreffenden Regeln als
     Liste UND als einzelne Flags. Was in der Liste steht, wird deshalb nicht
     noch einmal als Flag ausgegeben (§4.2, hier in der Anzeige). */
  var inListe={};
  (Array.isArray(z.regeln)?z.regeln:[]).forEach(function(r){ inListe[String(r)]=1; });
  var aus=0;
  var rest=Object.keys(z).filter(function(k){
    if(benutzt[k]) return false;
    var v=z[k];
    if(v===null||v===undefined||String(v)==='') return false;
    if(v===false){ aus++; return false; }
    if(v===true && inListe[k]) return false;   /* steht schon in `regeln` */
    return true;
  }).map(function(k){ return k+': '+String(z[k]); });
  var detail=(ft?ft.v:'');
  if(rest.length) detail+=(detail?' · ':'')+rest.join(' · ');
  if(aus) detail+=(detail?' · ':'')+aus+' weitere treffen nicht zu';
  /* „produkt" nur, wenn wirklich eine Produkt-ID da ist — sonst zeigte der
     Oeffnen-Knopf auf eine Zutat und liefe ins Leere. */
  var typ=(z['Produkt_ID']?'produkt':(z['Zutat_ID']?'zutat':(z['e_nummer']?'zusatz':'sonst')));
  return {typ:typ, id:id, name:name, detail:detail, regeln:[], abhakbar:false};
}

/* Nur diese drei Nährwert-Regeln sind bestätigbar – sie beschreiben einen Zustand,
   keinen Datenfehler. n2/n3/n4 fehlen hier absichtlich; die Datenbank lehnt sie
   zusätzlich ab (cb_naehrwerte_regel_ok_setzen). Zwei Riegel, ein Grund. */
var WA_REGEL_OK_TEXT={ n1:'kcal', n5:'Salzwert', n6:'Ballaststoffe' };
var WA_REGEL_OK_FRAGE={
  n1:'Warum stimmt die kcal-Zahl, obwohl sie nicht zur Atwater-Rechnung passt?\n(z. B. organische Säuren, mehrwertige Alkohole, Etikett vom Hersteller geprüft)',
  n5:'Warum ist der Salzwert richtig?\n(z. B. Salzäquivalent aus Natriumverbindungen, Etikett geprüft)',
  n6:'Warum stehen 0 g Ballaststoffe?\n(z. B. laut Etikett nicht angegeben, Produkt hat wirklich keine)'
};
/* Einen geprüften Wächter-Fall abhaken. Ohne Begründung passiert nichts:
   ein Haken ohne Grund ist ein stiller Riegel-Verzicht. */
async function waRegelOk(pid, regel, nr, nameEnc){
  if(!(ME&&ME.is_admin)) return;
  var frage=WA_REGEL_OK_FRAGE[regel]||'Begründung';
  var grund=prompt(frage+'\n\nDie Begründung steht danach mit deinem Namen am Produkt.\nAbbrechen = nichts abhaken.','');
  if(grund===null) return;
  grund=String(grund||'').trim();
  if(grund.length<5){ alert('Ohne Begründung kein Haken.\n\nEin Haken ohne Grund ist ein stiller Riegel-Verzicht – in drei Monaten weiß niemand mehr, warum der Fall in Ordnung war.'); return; }
  try{
    var r=await client.rpc('cb_naehrwerte_regel_ok_setzen',{p_id:pid, p_regel:regel, p_begruendung:grund, p_an:true});
    if(r&&r.error) throw new Error(r.error.message);
    await dashWaechterFaelle(nr, nameEnc);
    try{ loadDashboard(); }catch(e){}
  }catch(e){ alert('Konnte nicht abhaken: '+((e&&e.message)||e)); }
}
/* ---------------------------------------------------------------------------
   Bezugseinheit direkt im Waechter-Fenster entscheiden (Ralph 27.08.2026).
   Ein Knopf, eine RPC, dieselbe wie auf der Seite „⚖️ Bezugseinheit g / ml".
   Es wird NICHTS umgerechnet — die Einheit sagt nur, wie die vorhandenen
   Zahlen gemeint sind.
   --------------------------------------------------------------------------- */
function _waEhBtn(pid,val,lbl,view,nm){
  return '<button onclick="waEinheitSetzen(\''+esc(pid)+'\',\''+val+'\',\''+esc(view)+'\',\''+encodeURIComponent(nm)+'\')"'
    +' title="Etikett nachgesehen: die Nährwerte gelten pro '+lbl+'. Wird als belegt gespeichert."'
    +' style="flex:0 0 auto;border:1px solid #3b56b0;background:#eef2fd;color:#28408f;border-radius:9px;padding:7px 11px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap">'+lbl+'</button>';
}
async function waEinheitSetzen(pid, val, view, nameEnc){
  if(!(ME&&ME.is_admin)) return;
  try{
    var r=await client.rpc('cb_produkt_mengen_einheit_setzen',{p_id:pid, p_einheit:val, p_quelle:'Etikett'});
    if(r&&r.error) throw new Error(r.error.message);
    await dashWaechterFaelle(null, nameEnc, view);
    try{ loadDashboard(); }catch(e){}
  }catch(e){ alert('Konnte die Einheit nicht setzen: '+((e&&e.message)||e)); }
}
if(typeof window!=='undefined'){ window.dashWaechterFaelle=dashWaechterFaelle; window.waRegelOk=waRegelOk; window.waEinheitSetzen=waEinheitSetzen; }
/* Reiter im hellen Portal-M-Dashboard umschalten (nur Anzeige, kein neuer Datenabruf). */
function dashPortalTab(id){
  var box=document.getElementById('fgDash'); if(!box) return;
  box.querySelectorAll('.pmpanel').forEach(function(p){ p.style.display=(p.getAttribute('data-panel')===id)?'':'none'; });
  box.querySelectorAll('.pmtab').forEach(function(t){ t.classList.toggle('on', t.getAttribute('data-tab')===id); });
}
