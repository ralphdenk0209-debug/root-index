/* Klassisches Script: globale Funktionsnamen bleiben Teil des Ladevertrags. */

/* Die Produkterfassung erzwingt ein helles Farbschema innerhalb ihres Containers.
   Farbtoken werden aus den vorhandenen --k-Token abgeleitet, damit neue Token mitlaufen. */
function peLightCssInject(){
  if(document.getElementById('peLightCss')) return;
  var toks={};
  try{
    for(var i=0;i<document.styleSheets.length;i++){
      var rules=null; try{ rules=document.styleSheets[i].cssRules; }catch(e){ rules=null; }
      if(!rules) continue;
      for(var j=0;j<rules.length;j++){
        var st=rules[j].style; if(!st||!st.length) continue;
        for(var k=0;k<st.length;k++){ var p=st[k];
          if(/^--k-[0-9a-f]{6}$/.test(p)) toks[p]='#'+p.slice(4);
        }
      }
    }
  }catch(e){}
  var tokCss=''; for(var key in toks){ tokCss+=key+':'+toks[key]+';'; }
  var css=
    '#fgProdErf{color-scheme:light;color:#1f2a44;background:#ccd6e4;border-radius:12px;padding:4px 10px 16px;'+tokCss
      +'--bg:#ccd6e4;--card:#ffffff;--ink:#1f2a44;--muted:#5f6d80;--line:#c3cede;'
      +'--green:#2e9e57;--green2:#10b981;--greendk:#1f7d43;--greenlt:#e7f6ec;'
      +'--auf-gruen:#ffffff;--auf-gruen-dunkel:#ffffff;--card2:#eef2f7;}'
    +'#fgProdErf #fe_grid>div,#fgProdErf #peDetail{min-width:0}'
    +'#fgProdErf input,#fgProdErf select,#fgProdErf textarea{color-scheme:light;background:#ffffff;color:#1f2a44;border-color:#d3dbe6}'
    +'#fgProdErf input:disabled,#fgProdErf select:disabled{background:#eef2f7;color:#7b8698}'
    +'#fgProdErf input::placeholder,#fgProdErf textarea::placeholder{color:#9aa7b2;opacity:1}'
    +'#fgProdErf img{filter:none}'
    +'#fgProdErf .peChip{border:1px solid #d3dbe6;background:#fff;color:#1f2a44;border-radius:20px;padding:5px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}'
    +'#fgProdErf .peChip.on{background:#3b56b0;border-color:#2a3f86;color:#fff}'
    +'#fgProdErf .peGrid tbody tr{cursor:pointer}'
    +'#fgProdErf .peGrid tbody tr:hover{background:#f3f6fb}'
    +'#fgProdErf .peGrid tbody tr.sel{background:#e8ecfb;box-shadow:inset 3px 0 0 #3b56b0}'
    +'#fgProdErf .peBtn{border:1px solid #d3dbe6;background:#fff;color:#1f2a44;border-radius:9px;padding:8px 13px;font-size:13px;cursor:pointer;font-weight:600}'
    +'#fgProdErf .peBtn:hover{background:#eef2f7}'
    +'#fgProdErf .peBtn.pri{background:#3b56b0;border-color:#2a3f86;color:#fff}'
    +'#fgProdErf .peBtn.pri:hover{background:#2a3f86}'
    +'#fgProdErf .pePill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid}';
  var s=document.createElement('style'); s.id='peLightCss'; s.textContent=css; document.head.appendChild(s);
}
/* OFF-Massenimporte gehören nicht zu „Zu erledigen"; die lokale Prüfung spiegelt
   ausschließlich die serverseitige Regel für bereits geladene Zeilen. */
function peIstOffImport(p){ return /^openfoodfacts massenimport/i.test(String(p.herkunft||'')); }
function peIstOffen(p){
  return (String(p.pstatus||'')==='Entwurf'
      || p.zu_verifizieren
      || ['offen','noch_nicht_erfasst'].indexOf(String(p.ean_status||''))>=0)
      && !peIstOffImport(p);
}
/* 🔴 20.09.2026 (Ralph jaja): EINE Zahl je Produkt. Lebensmittel haben den Root Index
   (p.score), Nahrungsergaenzung den Reinheits-Index (p.supp_index, aus der Datenbank).
   Sortierung, Spaltenfilter und der Chip "Ohne Index" fragen ab jetzt hier nach - sonst
   stuenden alle Supplements unter "Ohne Index", obwohl ihre Zahl danebensteht. */
function peIndexWert(p){
  if(p && p.supp_index!=null){ var r=Number(p.supp_index); if(isFinite(r)) return r; }
  if(!p || p.score==null) return null;
  var v=Number(p.score); return isFinite(v)?v:null;
}
/* Wächtertreffer bleiben bis zur Freigabe auffindbar.
   🔴 06.09.2026 (#619, Ralph: "der Browser soll doch aus der Datenbank lesen"):
   Vorher stand hier ein NACHBAU der Wächterregel:
     p.naehrwerte_qa || p.portionsfalle_qa || !p.quelle_typ || p.score==null || p.zu_verifizieren
   Das war ein dritter Ort für dieselbe Frage - neben cb_produkt_waechterfrei und
   cb_produkt_stationen. Das Schild in der Liste konnte deshalb etwas anderes sagen
   als der Server (Kernvertrag B1: kein lokaler Nachbau einer Serverentscheidung).
   Jetzt liefert cb_erfassung_liste das Urteil mit, aus v_produkt_waechter_offen.
   KEIN RÜCKFALL auf die alte Rechnung: liefert der Server das Feld nicht, zeigt die
   Liste kein Schild und sagt im Titel warum - zwei Wahrheiten wären schlimmer als
   eine fehlende Anzeige. */
function peHatWaechter(p){
  return (Number(p && p.waechter_anzahl) || 0) > 0;
}
/* Die Namen der anschlagenden Wächter für den Tooltip - der Server nennt sie. */
function peWaechterText(p){
  var w = p && p.waechter;
  if(Array.isArray(w) && w.length) return 'Wächter: ' + w.join(' · ') + ' – bis zur Freigabe prüfen';
  return 'Von einem Wächter gemeldet – bis zur Freigabe prüfen';
}
function peWaechterFeldFehlt(p){
  return !p || p.waechter_anzahl === undefined || p.waechter_anzahl === null;
}
/* Die Listenhöhe wird aus der sichtbaren Viewporthöhe und dem Abstand der Liste
   zur Fensteroberkante gemessen. Mit offenem Editor oder eingeklappter Liste darf
   der Container nicht gedeckelt werden.
   🔴 06.09.2026 (Ralph: "Liste laesst sich nicht mehr scrollen, Seite soll nicht
   scrollen"): Die Rechnung addierte scrollY zu r.top. r.top ist aber bereits
   fensterrelativ - bei gescrollter Seite wurde die Hoehe um genau den Scrollweg
   zu klein, Fusszeile und Pager verschwanden hinter overflow:hidden und die
   Tabelle bekam keinen Platz mehr zum Scrollen. Zwei Aenderungen: scrollY raus,
   und solange die Liste gedeckelt ist, scrollt die SEITE gar nicht mehr - dann
   scrollt nur noch die Tabelle, wie es sein soll.
   Rueckweg: _sicherungen/2026-09-06-listenhoehe/produktliste.js.bak */
function peSeitenScroll(aus){
  try{
    var d=document.documentElement, b=document.body;
    if(aus){
      if(!window._peScrollAus){
        window._peScrollAus=true;
        window._peScrollVorher={ d:d.style.overflow, b:b.style.overflow };
      }
      /* 🔴 11.09.2026, RALPH: "es war als ich ein Produkt geloescht habe, sonst
         geht es." Damit war es messbar - und die Messung war eindeutig:
         overflow:hidden verhindert nur das Scrollen MIT DER MAUS. scrollTo und
         scrollIntoView scrollen trotzdem. Im laufenden Browser nachgestellt:
           vorher  scrollY 0,   Listenoberkante  62, Unterkante 906
           scrollTo(0,140) bei overflow:hidden
           nachher scrollY 140, Listenoberkante -78, Unterkante 766
         Die Seite steht dann 140 px verschoben fest: oben abgeschnitten, unten
         laeuft die Liste aus dem Bild, und zurueck kommt man nicht, weil der
         Seitenscroll gesperrt ist. Genau Ralphs Bild.
         Der Sprung an den Anfang stand bisher IM Erstbesetzungs-Block und lief
         deshalb nur beim allerersten Einfrieren. Jetzt bei jedem. */
      if(window.scrollY||window.pageYOffset) window.scrollTo(0,0);
      d.style.overflow='hidden'; b.style.overflow='hidden';
    }else if(window._peScrollAus){
      window._peScrollAus=false;
      d.style.overflow=(window._peScrollVorher&&window._peScrollVorher.d)||'';
      b.style.overflow=(window._peScrollVorher&&window._peScrollVorher.b)||'';
    }
  }catch(e){}
}
function peListeHoehe(){
  var s=document.getElementById('peListenSeite');
  if(!s){ peSeitenScroll(false); peFabSetzen(null); return; }
  /* 🔴 06.09.2026, Ralph: "bei klick auf ein produkt springt die seite extrem auf
     und die seite wird scrollbar." Ursache gefunden: peSelect hob hier die
     Deckelung auf, sobald ein Produkt gewaehlt war - die Liste wuchs auf ihre
     volle Laenge und die Seite sprang. Der Kommentar dafuer stammte aus der Zeit
     des INLINE-Editors. peSelect ruft openFgEditor(id) OHNE targetEl, und das
     rendert ins Vollbild-Overlay #panel - der Editor liegt also UEBER der Seite
     und braucht den Seitenscroll gar nicht. Nur die eingeklappte Liste braucht
     ihn noch. Der Inline-Fall (openFgEditor mit targetEl) setzt _fgEditorTarget;
     dann geben wir die Deckelung weiterhin frei. */
  if(window._peListCollapsed || window._fgEditorTarget){
    peSeitenScroll(false); s.style.height=''; s.style.overflow=''; return; }
  /* Erst den Seitenscroll stilllegen, dann messen: sonst misst man die Position
     einer gescrollten Seite und deckelt die Liste um den Scrollweg zu kurz. */
  peSeitenScroll(true);
  var sicht=(window.visualViewport && window.visualViewport.height) || window.innerHeight || 0;
  if(!sicht) return;
  var r=s.getBoundingClientRect();
  var h=Math.max(320, Math.round(sicht - r.top - 14));
  s.style.height=h+'px';
  s.style.overflow='hidden';
  /* Listenhöhe und schwebender Knopf verwenden dieselbe Messung. */
  peFabSetzen(Math.round(r.top)+8);
}
/* Der Sticky-Kopf reserviert PE_FAB_W für den schwebenden Neuanlageknopf. */
var PE_FAB_W=186;
function peNeuFabInit(){
  if(document.getElementById('peNeuFab')) return;      // genau einer, nie zwei
  var b=document.createElement('button');
  b.id='peNeuFab';
  b.type='button';
  b.title='Neues Produkt anlegen';
  b.setAttribute('aria-label','Neues Produkt anlegen');
  b.onclick=function(){ try{ peNeu(); }catch(e){ console.error('peNeu:',e); } };
  b.style.cssText='position:fixed;right:22px;top:96px;z-index:40;'
    +'height:40px;padding:0 18px;border:0;border-radius:20px;'
    +'background:#2f4fd6;color:#fff;font-size:14px;font-weight:700;cursor:pointer;'
    +'box-shadow:0 4px 14px rgba(20,40,90,.28);display:flex;align-items:center;gap:7px';
  b.innerHTML='<span style="font-size:18px;line-height:1">＋</span><span>Neues Produkt</span>';
  document.body.appendChild(b);
}
/* Ohne Messwert bleibt die letzte Position; negative Oberkanten werden sichtbar gehalten. */
function peFabSetzen(top){
  var b=document.getElementById('peNeuFab'); if(!b) return;
  if(top===null || top===undefined) return;
  b.style.top=Math.max(8,Math.round(top))+'px';
}
/* Beim Verlassen der Erfassung muss der Seitenscroll zurueck - sonst haengt die
   naechste Admin-Seite mit gesperrtem Scroll fest. */
function peNeuFabWeg(){ var b=document.getElementById('peNeuFab'); if(b) b.remove(); peSeitenScroll(false); }
function peListeHoeheBinden(){
  if(window._peHoeheGebunden) return; window._peHoeheGebunden=true;
  var lauf=function(){ if(window._peHoeheRaf) return;
    window._peHoeheRaf=requestAnimationFrame(function(){ window._peHoeheRaf=null; peListeHoehe(); }); };
  window.addEventListener('resize',lauf);
  if(window.visualViewport){ window.visualViewport.addEventListener('resize',lauf); }
  /* Chipumbrüche ändern die Kopfhöhe; ResizeObserver hält die Messung aktuell. */
  try{
    var st=document.getElementById('peSticky');
    if(st && typeof ResizeObserver==='function'){ new ResizeObserver(lauf).observe(st); }
  }catch(e){}
  /* Wird die Erfassung durch eine andere Admin-Seite ersetzt, verschwindet
     #peListenSeite aus dem DOM. Dann muss der Seitenscroll zurueck - sonst
     haengt die naechste Seite mit gesperrtem Scroll fest. Ein Beobachter statt
     eines Merkzettels: peNeuFabWeg wird von niemandem gerufen (06.09.2026). */
  try{
    var ls=document.getElementById('peListenSeite');
    var elt=ls && ls.parentNode;
    if(elt && typeof MutationObserver==='function'){
      new MutationObserver(function(){
        if(!document.getElementById('peListenSeite')) peSeitenScroll(false);
      }).observe(elt,{childList:true});
    }
  }catch(e){}
}
function peSyncStickyTop(){
  var el=document.getElementById('peSticky'); if(!el) return;
  var top=0;
  /* Unter der tatsächlich fixierten Kopfzeile kleben. */
  var at=document.getElementById('adminTop');
  if(at){ var sa=getComputedStyle(at); if(sa.position==='fixed'){ var ra=at.getBoundingClientRect(); if(ra.bottom>top) top=ra.bottom; } }
  document.querySelectorAll('.hero').forEach(function(h){
    var st=getComputedStyle(h); if(st.position!=='sticky'&&st.position!=='fixed') return;
    var r=h.getBoundingClientRect(); if(r.top<=1 && r.bottom>top) top=r.bottom;
  });
  el.style.top=Math.max(0,Math.round(top))+'px';
}
/* Alle Listenfilter werden gemeinsam gespeichert; peRender ist die einzige Schreibstelle. */
function peStateSave(){
  try{ localStorage.setItem('peFilter', JSON.stringify({
    chip:window._peChip||null, colF:window._peColF||null, brandOff:window._peBrandOff||null,
    hideMarken:!!window._peHideMarken,
    q:((document.getElementById('peSuche')||{}).value||''),
    sort:((document.getElementById('peSort')||{}).value||'neu'),
    kat:((document.getElementById('peVorKat')||{}).value||'') })); }catch(e){}
}
function peStateLoad(){ try{ return JSON.parse(localStorage.getItem('peFilter')||'null'); }catch(e){ return null; } }
/* Liste und Hauptzähler sind serverseitig. PE_CHIP_NUR_SEITE, Markenfilter und
   Sortierung wirken mangels Serverentsprechung nur auf die geladene Seite. */
var PE_SEITE=100;
/* Uebersetzung Oberflaechen-Chip -> Datenbank-Chip. Die Liste kennt mehr Chips,
   als die Datenbank filtern kann. Wo es keine Entsprechung gibt, holen wir die
   naechstgroessere Menge (nie eine kleinere - sonst faellt weg, was der lokale
   Filter noch finden koennte) und sieben auf der Seite nach. */
var PE_CHIP_SERVER={
  offen:'offen', alle:'alle', zuverif:'zuverif', keinscore:'ohne_score',
  waechter:'waechter', scan:'scan', import:'import',
  /* Teilmengen des Waechter-Filters (er enthaelt "Quelle fehlt", "Naehrwert-QA"
     und "Portionsfalle") - deshalb ist 'waechter' hier die richtige Obermenge. */
  keinquelle:'waechter', naehrwerte:'waechter', portionsfalle:'waechter',
  /* Ohne DB-Entsprechung: ganze Liste holen, Seite lokal sieben. */
  keinzut:'alle', markiert:'alle', unverif:'alle'
};
var PE_CHIP_NUR_SEITE={keinquelle:1,keinzut:1,markiert:1,naehrwerte:1,portionsfalle:1,unverif:1};
/* Eine Zeile aus dem Scan-Eingang ist KEIN Produkt: sie hat noch keine P-Nummer
   (id = "S-<EAN>", echte_id = null). Alles, was eine Produkt-RPC ruft, muss sie
   aussparen - sonst schickt die Oberflaeche eine Pseudo-Nummer an die Datenbank. */
function peIstScan(p){ return !!(p && (p.quelle==='scan' || (p.echte_id==null && String(p.id||'').indexOf('S-')===0))); }
/* Suchtext und Kategorie: solange die Maske noch nicht steht (erster Aufruf),
   gilt der gespeicherte Wert - danach immer das Feld. Zwei Quellen waeren eine
   zweite Wahrheit; deshalb EIN Leser je Wert. */
function peSucheWert(){ var el=document.getElementById('peSuche'); return el?String(el.value||'').trim():String(window._peQVor||''); }
function peKatWert(){ var el=document.getElementById('peVorKat'); return el?String(el.value||'').trim():String(window._peKatVor||''); }
/* Fehler NIE stumm verschlucken (§1.13i): der Grund steht im Kasten, daneben ein
   Knopf, der den Abruf wiederholt. Eine leere Liste ohne Grund sieht aus wie ein
   Ergebnis. */
function peFehlerHtml(e,retry){
  return '<div style="color:#cf5442;font-size:12.5px;padding:10px;line-height:1.55;background:#fff;border:1px solid #f0c4bb;border-radius:11px">'
    +'<b>Liste nicht ladbar.</b><br>'+esc((e&&e.message)||String(e))
    +'<br><button type="button" onclick="'+retry+'" style="margin-top:9px;padding:6px 13px;border:1px solid #cf5442;border-radius:8px;background:#fff;color:#cf5442;font-weight:700;font-size:12.5px;cursor:pointer">Erneut versuchen</button></div>';
}
/* EIN Abruf, EINE Seite. Wirft bei Fehler weiter - der Aufrufer zeigt ihn an. */
async function peDatenHolen(offset){
  var chip=window._peChip||'offen';
  var srv=PE_CHIP_SERVER[chip]||'alle';
  var q=peSucheWert(), kat=peKatWert();
  /* p_colf hält Seitenmenge und Gesamtzahl auf derselben serverseitigen Grundmenge. */
  var r=await client.rpc('cb_erfassung_liste',{p_chip:srv,p_suche:q||null,p_kat:kat||null,
                                               p_offset:Number(offset||0),p_limit:PE_SEITE,
                                               p_colf:peColfPayload(null)});
  if(r.error) throw r.error;
  var d=r.data; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){} }
  if(!d||d.ok!==true) throw new Error((d&&d.grund)||'Die Liste hat keine Antwort geliefert.');
  var scan=Array.isArray(d.scan)?d.scan:[];
  var rows=Array.isArray(d.rows)?d.rows:[];
  /* Scan-Kandidaten ZUERST: sie sind das, was noch gar kein Produkt ist, also die
     eigentliche Arbeit. Die Datenbank liefert sie nur auf Seite 1 (offset 0) -
     das steht auch so am Blaetterer, damit niemand sie ab Seite 2 vermisst. */
  window._peRows=scan.concat(rows);
  /* 🔴 06.09.2026, Ralph (#598): die acht Stationspunkte kommen vom Server, in EINEM
     Aufruf fuer die ganze Seite. Die Liste rechnet nichts nach - sie zeigt, was
     cb_produkt_stationen_liste sagt. Faellt der Aufruf aus, bleiben die Punkte leer;
     eine leere Anzeige ist ehrlicher als eine geratene. */
  try{
    var _ids=rows.map(function(r){ return String(r.id); }).filter(function(i){ return /^P/.test(i); });
    window._peStationen={};
    if(_ids.length){
      var _st=await client.rpc('cb_produkt_stationen_liste',{p_ids:_ids});
      if(!_st.error && Array.isArray(_st.data))
        _st.data.forEach(function(z){ window._peStationen[z.Produkt_ID]={ampel:z.ampel,st:z.stationen}; });
    }
  }catch(e){ window._peStationen={}; console.warn('[Stationen]',e&&e.message||e); }
  window._verifRows=rows;   /* Editor-Navigation (vor/zurueck) darf nur echte Produkte kennen */
  window._peGesamt=Number(d.gesamt||0);
  window._peOffset=Number(d.offset||0);
  window._peStand=d.stand||null;
  /* Scananzahl nur übernehmen, wenn dieser Abruf sie erhoben hat; unbekannt bleibt null. */
  if(Number(d.offset||0)===0 && (srv==='offen'||srv==='alle'||srv==='scan'))
       window._peScanGesamt=Number(d.scan_anzahl||scan.length);
  else if(Number(d.offset||0)===0) window._peScanGesamt=null;
  return d;
}
/* Chip-Zahlen fuer den GANZEN Katalog. Schlaegt der Abruf fehl, bleibt _peZaehler
   null - die Chips zeigen dann KEINE Zahl statt einer falschen (§1.11n-ii: NULL
   heisst grau, nicht gelb). */
async function peZaehlerHolen(){
  try{
    var r=await client.rpc('cb_erfassung_zaehler');
    if(r.error) throw r.error;
    var d=r.data; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){} }
    window._peZaehler=(d&&d.ok===true)?d:null;
  }catch(e){ console.error('cb_erfassung_zaehler',e); window._peZaehler=null; }
}
/* Blaettern. Laedt die Seite neu und zeichnet nur die Liste - die Maske bleibt stehen. */
async function peSeite(offset){
  var pg=document.getElementById('pePager');
  if(pg) pg.innerHTML='<span style="color:#7b8698;font-size:12px">Lade…</span>';
  try{ await peDatenHolen(offset); }
  catch(e){ console.error('cb_erfassung_liste',e);
    if(pg) pg.innerHTML=peFehlerHtml(e,'peSeite('+Number(offset||0)+')');
    return; }
  try{ peRender(); }catch(e){}
}
/* Suche geht an die Datenbank, nicht mehr an den Browser. Gebremst (350 ms), damit
   nicht jeder Tastendruck einen Abruf ausloest; jede Aenderung faengt wieder bei
   Seite 1 an - sonst stuende man auf Seite 7 einer Liste, die es nicht mehr gibt. */
function peSucheGeaendert(){
  if(window._peSuchTimer) clearTimeout(window._peSuchTimer);
  window._peSuchTimer=setTimeout(function(){ window._peSuchTimer=0;
    try{ peStateSave(); }catch(e){}
    peSeite(0); },350);
}
/* Kategorie-Auswahl: wirkt sofort, ebenfalls serverseitig, ebenfalls ab Seite 1. */
function peFilterGeaendert(){ try{ peStateSave(); }catch(e){} peSeite(0); }
/* Aus dem Scan-Eingang ein Produkt anlegen. Nutzt den BESTEHENDEN Anlege-Weg
   (openFgEditor ohne id, mit Vorbelegung) - kein zweiter Weg, kein zweites
   Formular (§1.11i). Der Editor bekommt bewusst nur, was die Datenbank belegt
   liefert: Name, Marke, EAN, Kategorie. Naehrwerte werden NICHT geraten. */
function peScanAnlegen(id){
  var p=(window._peRows||[]).find(function(r){ return String(r.id)===String(id); });
  if(!p){ alert('Diese Scan-Zeile ist nicht mehr in der Liste – bitte neu laden.'); return; }
  /* Nur belegte Scan-Kopfdaten vorbelegen; Nährwerte bleiben bewusst leer. */
  try{
    scanEntwurfAnlegen({
      ean:p.ean||'', name:p.name||'', marke:p.marke||'', kategorie:p.kategorie||'',
      quelle:'Scan-Eingang · EAN '+(p.ean||'—'),
      scanIdsFuerEan:String(p.ean||''),
      prefill:{ name:p.name||'', marke:p.marke||'', ean:p.ean||'', kategorie:p.kategorie||'',
        hinweis:'Aus dem Scan-Eingang übernommen (Barcode '+(p.ean||'—')+'). Die Angaben sind ein VORSCHLAG aus dem Scan-Zwischenspeicher – vor der Freigabe gegen das Etikett prüfen. Nährwerte sind bewusst leer.' }
    });
  }catch(e){ alert('Editor-Fehler: '+(e&&e.message||e)); }
}
if(typeof window!=='undefined'){
  window.peIstScan=peIstScan; window.peSeite=peSeite; window.peSucheGeaendert=peSucheGeaendert;
  window.peFilterGeaendert=peFilterGeaendert; window.peScanAnlegen=peScanAnlegen;
  window.peDatenHolen=peDatenHolen; window.peZaehlerHolen=peZaehlerHolen;
}
async function loadProduktErfassung(){
  var box=document.getElementById('fgProdErf'); if(!box) return;
  peLightCssInject();
  try{ document.body.classList.add('peLightBg'); }catch(e){}
  box.style.cssText='width:100%;max-width:none;margin:0;';
  box.innerHTML='<div style="color:#7b8698;font-size:12.5px;padding:8px">Lade Produkte…</div>';
  /* Filter vor dem ersten Serverabruf laden; die Eingabefelder existieren hier noch nicht. */
  var _ps=peStateLoad();
  if(_ps){
    if(_ps.chip) window._peChip=_ps.chip;
    if(_ps.colF) window._peColF=_ps.colF;
    if(_ps.brandOff) window._peBrandOff=_ps.brandOff;
    window._peHideMarken=!!_ps.hideMarken;
  }
  window._peQVor=(_ps&&_ps.q)||'';
  window._peKatVor=(_ps&&_ps.kat)||'';
  if(window._peChip===undefined) window._peChip='offen';
  try{ await peDatenHolen(0); }
  catch(e){ console.error('cb_erfassung_liste',e);
    box.innerHTML=peFehlerHtml(e,'loadProduktErfassung()'); return; }
  await peZaehlerHolen();
  box.innerHTML=
    /* #peDetail bleibt außerhalb: der Editor benötigt normalen Seitenscroll. */
    '<div id="peListenSeite" style="display:flex;flex-direction:column;min-height:0">'
    /* Sticky-Menü: Toolbar + Chips bleiben beim Scrollen oben stehen.
       padding-right haelt den schwebenden "+ Neues Produkt" frei (PE_FAB_W). */
    +'<div id="peSticky" style="flex:0 0 auto;position:sticky;top:0;z-index:22;background:#f4f7fa;margin:0 -10px;padding:8px '+(PE_FAB_W+10)+'px 6px 10px;box-shadow:0 8px 10px -9px rgba(20,40,70,.30)">'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
      +'<button class="peBtn" onclick="peMenu(\'akt\',this)">☑ Aktionen ▾</button>'
      +'<button class="peBtn" onclick="scanEingangToggle()" title="Scan-Eingang ein-/ausblenden: gescannte Produkte zur Prüfung, Entwürfe">📥 Scan-Eingang</button>'
      +'<button class="peBtn" onclick="peMenu(\'set\',this)">⚙ Einstellungen ▾</button>'
      +'<span style="color:#7b8698;margin-left:6px;font-size:12.5px" title="Filtert die Liste nach Kategorie und ist zugleich die Vorgabe für neue Produkte.">Kategorie</span>'
      /* Kategorie filtert serverseitig über peFilterGeaendert. */
      +katSelectHtml("peVorKat","","width:150px;height:34px;padding:6px 8px;border:1px solid #d3dbe6;border-radius:8px;background:#fff;color:#1f2a44;font-size:13px","peFilterGeaendert()","alle Kategorien")
      +'<button id="peMarkenBtn" class="peBtn" onclick="peBrandBox(this)" title="Marken zum Ausblenden abwählen">🏷 Marken ▾</button>'+'<button id="peJunkBtn" class="peBtn" onclick="peHideMarkenToggle()" title="Dr. Oetker, Gustavo Gusto und Original Wagner ausblenden">🚫 Werbe-Marken</button>'
      +'<span style="flex:1"></span>'
    +'</div>'
    /* Chipzahlen bei jedem Render aus derselben aktuellen Grundmenge zeichnen. */
    +'<div id="peChipRows">'+peChipRowsHtml()+'</div>'
    /* Zeile darunter nennt jeden aktiven Filter und laesst ihn einzeln abwerfen.
       Ohne Filter ist sie leer und nimmt keinen Platz. */
    +'<div id="peAktivFilter">'+peAktivFilterHtml()+'</div>'
    +'</div>'
    +'<div style="flex:0 0 auto;display:grid;grid-template-columns:2fr 1fr;gap:8px;margin:2px 0 8px">'
      /* Suche läuft serverseitig über Titel, Marke, EAN und P-Nummer. */
      +'<div><input id="peSuche" oninput="peSucheGeaendert()" placeholder="🔍 Titel, Marke, EAN, P-Nummer…" style="width:100%;padding:7px 9px;border:1px solid #d3dbe6;border-radius:8px;background:#fff;color:#1f2a44;font-size:13px"></div>'
      +'<div>'
        +'<select id="peSort" onchange="peRender()" style="width:100%;padding:7px 9px;border:1px solid #d3dbe6;border-radius:8px;background:#fff;color:#1f2a44;font-size:13px"><option value="neu">Erfasst – neueste zuerst</option><option value="score">Index aufsteigend</option><option value="titel">Titel A–Z</option><option value="mark">Nur markierte</option></select></div>'
    +'</div>'
    +'<div id="peAutoBanner" style="flex:0 0 auto;display:none;margin:0 0 10px;padding:8px 12px;border:1px solid #cfe0d6;border-radius:11px;background:#eef7f1;color:#1f5e34;font-size:12.5px"></div>'
    /* flex:1 1 auto + min-height:0 = "nimm den ganzen Rest, und schrumpfe auch
       unter deinen Inhalt". Ohne min-height:0 waechst ein Flex-Kind nie kleiner
       als sein Inhalt - dann scrollt wieder die Seite statt der Liste. */
    +'<div id="peListWrap" style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border:1px solid #e2e8ef;border-radius:11px;overflow:hidden;margin-bottom:12px;background:#fff;box-shadow:0 1px 2px rgba(20,40,70,.04)">'
      +'<div id="peListBar" onclick="peListToggle()" title="Liste ein-/ausklappen" style="flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:#eef3f8;border-bottom:1px solid #e2e8ef;user-select:none">'
        +'<span id="peListCaret" style="color:#3b56b0;font-weight:800;font-size:13px;width:12px">▾</span>'
        +'<span style="font-weight:700;color:#1f2a44;font-size:13px">Produktliste</span>'
        /* Tagesbudget bleibt in der kompakten Listenkopfzeile sichtbar. */
        +'<span id="peKostenZeile" style="font-size:11px;margin-left:10px"></span>'
        +'<span id="peListHint" style="color:#7b8698;font-size:12px"></span>'
        +'<span style="flex:1"></span>'
        +'<span id="peListAction" style="color:#3b56b0;font-size:12px;font-weight:600"></span>'
      +'</div>'
      +'<div id="peListBody" style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column">'
        /* Die Tabelle nimmt den Flex-Rest und scrollt intern; keine feste Höhenzahl. */
        +'<div id="peGridWrap" style="flex:1 1 auto;min-height:0;overflow:auto"><table class="peGrid" id="peGrid" style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:13px"></table></div>'
        +'<div id="peFoot" style="flex:0 0 auto;padding:7px 10px;color:#7b8698;font-size:12px;border-top:1px solid #e2e8ef;background:#eef3f8"></div>'
        +'<div id="pePager" style="flex:0 0 auto;padding:8px 10px;border-top:1px solid #e2e8ef;background:#f4f7fa"></div>'
      +'</div>'
    +'</div>'
    +'</div>'
    +'<div id="peDetail"></div>'
    /* Kontextmenue */
    +'<div id="peCtx" style="position:fixed;z-index:60;background:#fff;border:1px solid #d3dbe6;border-radius:10px;padding:5px;min-width:210px;box-shadow:0 14px 38px rgba(20,40,70,.18);display:none"></div>';
  try{ var b=document.getElementById('peBearb'); if(b) b.value=(window._adminName||(window.__profil&&window.__profil.name)||'Angemeldet'); }catch(e){}
  try{ if(_ps){
    var _q=document.getElementById('peSuche'); if(_q&&_ps.q) _q.value=_ps.q;
    var _s=document.getElementById('peSort'); if(_s&&_ps.sort) _s.value=_ps.sort;
    var _k=document.getElementById('peVorKat'); if(_k&&_ps.kat) _k.value=_ps.kat;
  } }catch(e){}
  peRender();
  try{ peAutoInfo(); }catch(e){}
  try{ peNeuFabInit(); peListeHoehe(); peListeHoeheBinden(); }catch(e){}
  try{ peSyncStickyTop(); if(!window._peStickyBound){ window._peStickyBound=true;
      window.addEventListener('scroll',function(){ if(window._peStickyRaf)return; window._peStickyRaf=requestAnimationFrame(function(){ window._peStickyRaf=0; peSyncStickyTop(); }); },{passive:true});
      window.addEventListener('resize',peSyncStickyTop); } }catch(e){}
}
/* Autopilotstatus und Tagesbudget kommen ausschließlich aus cb_autopilot_status. */
async function peAutoInfo(){
  var el=document.getElementById('peAutoBanner'); if(!el) return;
  try{
    var r=await client.rpc('cb_autopilot_status');
    var d=r&&r.data; if(!d||d.ok!==true){ el.style.display='none'; return; }
    var teile=[];
    teile.push(d.an?'🤖 <b>Riki-Autopilot aktiv</b> (liest Foto-Scans alle 30 Min, Riki-Wächter prüft jede Lesung)':'🤖 <b>Riki-Autopilot AUS</b>');
    if(Number(d.wartend)>0) teile.push('<b>'+d.wartend+'</b> Foto-Scan'+(d.wartend==1?' wartet':'s warten')+' auf den nächsten Lauf');
    if(Number(d.handarbeit)>0) teile.push('<span style="color:#c88616"><b>'+d.handarbeit+'</b> Foto-Scan'+(d.handarbeit==1?' braucht':'s brauchen')+' HANDARBEIT (Riki kam nicht durch – Notiz in der Scan-Warteschlange)</span>');
    teile.push('<span style="color:#7b8698">heute '+Number(d.heute_usd).toFixed(2)+' von '+Number(d.tageslimit_usd).toFixed(2)+' $ Tagesdeckel</span>');
    /* Das Tagesbudget bleibt sichtbar; ab 80 Prozent wird es hervorgehoben. */
    el.style.display='none';
    try{
      var kz=document.getElementById('peKostenZeile');
      if(kz){
        var heute=Number(d.heute_usd)||0, limit=Number(d.tageslimit_usd)||0;
        var eng=(limit>0 && heute>=limit*0.8);
        kz.innerHTML='<span title="Riki-Tagesbudget" style="color:'+(eng?'#cf5442':'#9aa7b2')+'">'
          +'🤖 '+heute.toFixed(2)+'/'+limit.toFixed(2)+' $'
          +(Number(d.wartend)>0?(' · '+d.wartend+' warten'):'')+'</span>';
      }
    }catch(_e){}
  }catch(e){ el.style.display='none'; }
}
function peMenu(kind,anchor){
  var ctx=document.getElementById('peCtx'); if(!ctx) return;
  var it=function(txt,fn){ return '<button onclick="document.getElementById(\'peCtx\').style.display=\'none\';'+fn+'" style="display:block;width:100%;text-align:left;background:none;border:0;color:#1f2a44;padding:8px 11px;border-radius:7px;font-size:13px;cursor:pointer">'+txt+'</button>'; };
  var html;
  if(kind==='akt'){
    /* Sammelaktionen wirken nur auf echte Produkte der geladenen Seite. */
    var _sicht=(window._peSichtbar||[]).filter(function(p){return !peIstScan(p);}).length;
    var _markN=(window._peRows||[]).filter(function(p){return p.markiert && !peIstScan(p);}).length;
    var _sep2='<div style="height:1px;background:#e2e8ef;margin:4px 6px"></div>';
    html= it('↻ Liste neu laden','loadProduktErfassung()')
      +_sep2+'<div style="padding:5px 11px 3px;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#9aa7b2;font-weight:800">Schritt 1 · Auswählen</div>'
      +'<div style="padding:0 11px 5px;font-size:11px;color:#9aa7b2;line-height:1.4">wirkt auf die geladene Seite (max. '+PE_SEITE+' Zeilen)</div>'
      +it('⚑ Alle gefilterten markieren ('+_sicht+')','peBulkMarkieren(true)')
      +it('⚐ Alle Markierungen aufheben ('+_markN+')','peBulkMarkieren(false)')
      +it('👁 Nur markierte zeigen','peChip(\'markiert\')')
      +_sep2+'<div style="padding:5px 11px 3px;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#9aa7b2;font-weight:800">Schritt 2 · Sammel-Aktion auf Markierte ('+_markN+')</div>'
      +it('✓ Geprüfte Freigabe versuchen','peBulkStatus(\'Aktiv\')')
      +it('🌱 Aktiv ohne Index setzen','peBulkStatus(\'Aktiv ohne Index\')')
      +it('↩ Auf Entwurf zurücknehmen','peBulkStatus(\'Entwurf\')')
      +_sep2+it('🧹 Filter zurücksetzen','peChip(\'alle\')');
  } else {
    var _cur=(typeof feAnsichtGet==='function')?feAnsichtGet():'klassisch';
    var _sep='<div style="height:1px;background:#e2e8ef;margin:4px 6px"></div>';
    html= it('↕ Sortierung: neueste','peSetSort(\'neu\')')+it('↕ Sortierung: Index aufsteigend','peSetSort(\'score\')')+it('↕ Sortierung: Titel A–Z','peSetSort(\'titel\')')
      +_sep+'<div style="padding:5px 11px 3px;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#9aa7b2;font-weight:800">Editor-Ansicht</div>'
      +it((_cur==='klassisch'?'✓ ':'')+'Klassisch','feAnsichtSet(\'klassisch\')')
      +it((_cur==='vorgang'?'✓ ':'')+'Vorgang (Phasenleiste + Ampel)','feAnsichtSet(\'vorgang\')');
  }
  ctx.innerHTML=html; ctx.style.display='block';
  var rc=anchor.getBoundingClientRect(); var w=ctx.offsetWidth,h=ctx.offsetHeight;
  ctx.style.left=Math.min(rc.left,innerWidth-w-6)+'px'; ctx.style.top=Math.min(rc.bottom+4,innerHeight-h-6)+'px';
  setTimeout(function(){ document.addEventListener('click',peCtxHide); },0);
}
function peCtxHide(){ var c=document.getElementById('peCtx'); if(c)c.style.display='none'; document.removeEventListener('click',peCtxHide); }
/* Der Klappzustand der Seitenfilter ist reine Sitzungsdarstellung. */
function peReihe3Toggle(){
  window._peReihe3Offen = !(window._peReihe3Offen===true);
  try{ peRender(); }catch(e){}
}
function peSetSort(v){ var s=document.getElementById('peSort'); if(s){ s.value=v; } peRender(); }
/* Sammelaktionen wirken auf gespeicherte Markierungen. */
async function peBulkMarkieren(an){
  var ziel=an?(window._peSichtbar||[]):((window._peRows||[]).filter(function(p){return p.markiert;}));
  /* Scan-Zeilen aussortieren: cb_produkt_markieren kennt keine Pseudo-Nummer S-<EAN>. */
  ziel=ziel.filter(function(p){ return !peIstScan(p); });
  if(!ziel.length){ alert(an?'Keine Produkte im Filter.':'Nichts markiert.'); return; }
  if(!confirm(an?('Alle '+ziel.length+' GEFILTERTEN Produkte markieren?\n\n(Die Fähnchen bleiben gespeichert, bis du sie aufhebst.)'):('Alle '+ziel.length+' Markierungen entfernen?'))) return;
  for(var i=0;i<ziel.length;i++){ var p=ziel[i];
    try{ var r=await client.rpc('cb_produkt_markieren',{p_id:p.id,p_an:!!an}); if(!r.error) p.markiert=!!an; }catch(e){} }
  peRender();
}
async function peBulkStatus(ziel){
  /* Nur echte Produkte: eine Scan-Zeile hat noch keine P-Nummer, die Freigabe-RPCs
     wuerden sie nicht finden. */
  var mark=(window._peRows||[]).filter(function(p){return p.markiert && !peIstScan(p);});
  if(!mark.length){ alert('Nichts markiert.\n\nSchritt 1: erst filtern (Chips, Suche, Marke), dann „Alle gefilterten markieren".'); return; }
  var msg = ziel==='Aktiv' ? ('Für '+mark.length+' markierte Produkte die GEPRÜFTE Freigabe versuchen?\n\nDie Blocker gelten je Produkt weiter — blockierte bleiben unverändert und werden dir genannt.')
    : ziel==='Aktiv ohne Index' ? (mark.length+' markierte Produkte BEWUSST OHNE Index in den Katalog stellen?\n\nNur für Produkte ohne belegbare Nährwerte (z. B. frische Sprossen).')
    : (mark.length+' markierte Produkte auf „Entwurf" zurücknehmen?\n\nSie verschwinden aus dem Katalog, bleiben aber erhalten.');
  if(!confirm(msg)) return;
  var ok=0, blockiert=[], fehler=0;
  for(var i=0;i<mark.length;i++){ var p=mark[i];
    try{
      if(ziel==='Aktiv'){
        var r=await client.rpc('produkt_pruefen_freigeben',{p_id:p.id});
        if(r.error){ blockiert.push(p.id); continue; }
      } else if(ziel==='Aktiv ohne Index'){
        var r2=await client.rpc('cb_produkt_ohne_index',{p_id:p.id,p_an:true});
        var d2=r2&&r2.data; if(typeof d2==='string'){ try{ d2=JSON.parse(d2);}catch(e){} }
        if(r2.error||!(d2&&d2.ok)){ fehler++; continue; }
      } else {
        var r3=await client.rpc('cb_produkt_status_setzen',{p_id:p.id,p_status:ziel});
        if(r3.error){ fehler++; continue; }
      }
      ok++;
    }catch(e){ fehler++; }
  }
  alert('Sammel-Aktion fertig:\n\u2713 '+ok+' umgestellt'
    +(blockiert.length?('\n\u26a0 '+blockiert.length+' blockiert (Freigabe-Prüfung sagt je Produkt, was fehlt): '+blockiert.slice(0,8).join(', ')+(blockiert.length>8?' …':'')):'')
    +(fehler?('\n\u2715 '+fehler+' Fehler'):''));
  loadProduktErfassung();
}
if(typeof window!=='undefined'){ window.peBulkMarkieren=peBulkMarkieren; window.peBulkStatus=peBulkStatus; }
/* Ein Chipwechsel startet eine neue Serverabfrage ab Seite 1. */
function peChip(k){ window._peChip=k;
  /* Spaltenfilter leeren, damit sie die neue Chip-Grundmenge nicht still verdecken. */
  window._peColF={};
  try{ var _cb=document.getElementById('peColBox'); if(_cb) _cb.remove(); }catch(e){}
  document.querySelectorAll('#fgProdErf .peChip').forEach(function(c){ c.classList.toggle('on', c.getAttribute('data-k')===k); });
  try{ peStateSave(); }catch(e){}
  peSeite(0); }
/* Markenfilter wirken nur auf der geladenen Seite; katalogweite Suche bleibt serverseitig. */
function peMarkenListe(){ var s={}; (window._peRows||[]).forEach(function(p){ var m=String(p.marke||'').trim(); if(m) s[m]=(s[m]||0)+1; });
  return Object.keys(s).sort(function(a,b){return a.toLowerCase()<b.toLowerCase()?-1:1;}).map(function(m){return {name:m,n:s[m]};}); }
function peBrandLabelUpd(){ var b=document.getElementById('peMarkenBtn'); if(!b) return; var off=window._peBrandOff||{};
  var n=Object.keys(off).filter(function(k){return off[k];}).length; b.textContent='🏷 Marken'+(n>0?' ('+n+' aus)':'')+' ▾'; }
function peBrandBox(btn){
  var ex=document.getElementById('peBrandBox'); if(ex){ ex.remove(); return; }
  window._peBrandOff=window._peBrandOff||{};
  var list=peMarkenListe();
  var box=document.createElement('div'); box.id='peBrandBox';
  box.style.cssText='position:absolute;z-index:80;background:#fff;border:1px solid #d3dbe6;border-radius:11px;box-shadow:0 14px 40px rgba(20,40,70,.22);padding:10px;width:270px;max-height:60vh;overflow:auto';
  var r=btn.getBoundingClientRect();
  box.style.top=(window.scrollY+r.bottom+6)+'px'; box.style.left=(window.scrollX+Math.max(6,r.left))+'px';
  var head='<div style="display:flex;gap:6px;margin-bottom:6px"><button type="button" onclick="peBrandAlle(true)" style="flex:1;padding:6px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">alle an</button><button type="button" onclick="peBrandAlle(false)" style="flex:1;padding:6px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">alle aus</button></div>'
    +'<div style="font-size:11px;color:#7b8698;margin-bottom:4px">Abgewählte Marken werden ausgeblendet.</div>';
  var rows=list.map(function(m){ var off=!!window._peBrandOff[m.name];
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:13px;cursor:pointer;border-top:1px solid #eef2f7"><input type="checkbox" '+(off?'':'checked')+' data-m="'+esc(m.name)+'" onchange="peBrandToggle(this)" style="width:16px;height:16px;flex:0 0 auto"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(m.name)+'</span><span style="color:#9aa7b2;font-size:11px">'+m.n+'</span></label>'; }).join('')
    || '<div style="color:#9aa7b2;font-size:12px;padding:6px 2px">keine Marken in der Liste</div>';
  box.innerHTML=head+rows;
  document.body.appendChild(box);
  setTimeout(function(){ var close=function(e){ if(!box.contains(e.target)&&e.target!==btn){ box.remove(); document.removeEventListener('mousedown',close); } }; document.addEventListener('mousedown',close); },0);
}
function peBrandToggle(cb){ var name=cb.getAttribute('data-m')||''; window._peBrandOff=window._peBrandOff||{};
  if(cb.checked) delete window._peBrandOff[name]; else window._peBrandOff[name]=true; peBrandLabelUpd(); peRender(); }
function peBrandAlle(on){ window._peBrandOff=window._peBrandOff||{};
  if(on){ window._peBrandOff={}; } else { peMarkenListe().forEach(function(m){ window._peBrandOff[m.name]=true; }); }
  var bx=document.getElementById('peBrandBox'); if(bx) bx.querySelectorAll('input[type=checkbox]').forEach(function(c){ c.checked=on; });
  peBrandLabelUpd(); peRender(); }
if(typeof window!=='undefined'){ window.peBrandBox=peBrandBox; window.peBrandToggle=peBrandToggle; window.peBrandAlle=peBrandAlle; }
/* Liste und lokale Zähler verwenden dasselbe Filterurteil. `ohneSpalte` nimmt
   beim Aufbau eines Spaltenfilters nur dessen eigene Auswahl aus. */
function pePasst(p, ohneSpalte, ohneChip){
  var q=((document.getElementById('peSuche')||{}).value||'').trim().toLowerCase();
  var chipf=ohneChip ? 'alle' : (window._peChip||'alle');
  var katf=((document.getElementById('peVorKat')||{}).value||'').trim();
  /* Scan-Eingänge sind keine Produkte und bleiben von Produktfiltern ausgenommen.
     Nur die Suche darf sie einschränken; der Scan-Chip zeigt ausschließlich sie. */
  if(peIstScan(p)){
    if(chipf==='scan') return true;
    if(!q) return true;
    return (String(p.name||'')+' '+String(p.marke||'')+' '+String(p.id||'')+' '+String(p.ean||'')+' '+String(p.kategorie||'')).toLowerCase().indexOf(q)>=0;
  }
  if(katf && String(p.kategorie||'')!==katf) return false;
  if(window._peBrandOff && p.marke && window._peBrandOff[String(p.marke)]) return false;
  if(window._peHideMarken && p.marke && /oetker|gustavo|wagner/i.test(String(p.marke))) return false;
  /* Serverfilter werden lokal wortgleich angewendet, bis die Antwort eintrifft;
     PE_CHIP_NUR_SEITE hat ausschließlich hier seine lokale Entsprechung. */
  if(chipf==='offen'&&!peIstOffen(p)) return false;
  if(chipf==='import'&&!(String(p.pstatus||'')==='Entwurf'&&peIstOffImport(p))) return false;
  if(chipf==='scan'&&!peIstScan(p)) return false;
  if(chipf==='zuverif'&&!p.zu_verifizieren) return false;
  if(chipf==='keinscore'&&peIndexWert(p)!=null) return false;
  if(chipf==='keinquelle'&&p.quelle_typ) return false;
  if(chipf==='keinzut'&&p.hat_zutaten) return false;
  if(chipf==='markiert'&&!p.markiert) return false;
  if(chipf==='waechter'&&!peHatWaechter(p)) return false;
  if(chipf==='naehrwerte'&&!p.naehrwerte_qa) return false;
  if(chipf==='portionsfalle'&&!p.portionsfalle_qa) return false;
  if(chipf==='unverif'&&p.verifiziert==='Ja') return false;
  /* Aktive Spaltenfilter stehen als Spalte → erlaubte Werte in window._peColF. */
  var cf=window._peColF||{};
  for(var col in cf){ if(cf.hasOwnProperty(col)&&cf[col]){
    if(col===ohneSpalte) continue;      /* die eigene Spalte zaehlt sich nicht selbst weg */
    if(cf[col].__q!==undefined){ if(String(peColVal(p,col)).toLowerCase().indexOf(cf[col].__q)<0) return false; }
    else if(!cf[col][peColVal(p,col)]) return false; } }
  if(!q) return true;
  return (String(p.name||'')+' '+String(p.marke||'')+' '+String(p.id||'')+' '+String(p.ean||'')+' '+String(p.kategorie||'')+' '+String(p.herkunft||'')+' '+String(p.grund||'')).toLowerCase().indexOf(q)>=0;
}
/* Serverchips zeigen Katalogzahlen aus cb_erfassung_zaehler. Lokale Chips sind
   ausdrücklich als Seitenfilter markiert; bei Abruffehlern bleibt die Zahl leer. */
function peChipRowsHtml(){
  var z=window._peZaehler||null;
  /* Reihe 2 zaehlt ueber dieselbe Menge wie die Liste - aber ohne den Chip selbst,
     sonst zeigte jeder nicht gewaehlte Chip 0 und man kaeme nie wieder heraus
     (das waere die Einbahnstrasse aus §1.11n-nn). */
  /* Lokale Produktzustände dürfen Scan-Eingänge nicht mitzählen. */
  var rws=(window._peRows||[]).filter(function(p){ return !peIstScan(p) && pePasst(p, null, true); });
  var chip=function(k,txt,n,nurSeite){
    /* Ein Chip mit 0 bleibt sichtbar, wird aber blass - sonst springt die Leiste bei
       jedem Filterwechsel um und man sucht einen Chip, der nur leer ist. */
    var an=(window._peChip===k);
    var zahl=(n==null)?'':(' ('+n+')');
    var tip=nurSeite ? 'Diese Zahl zählt nur die geladene Seite – nicht den ganzen Katalog.'
                     : (n==null ? 'Zahl gerade nicht abrufbar.' : 'Zahl gilt für den ganzen Katalog.');
    return '<span class="peChip'+(an?' on':'')+'" data-k="'+k+'" onclick="peChip(\''+k+'\')" title="'+esc(tip)+'"'
      +(n===0&&!an?' style="opacity:.45"':'')+'>'+txt+zahl+'</span>'; };
  var katf=peKatWert();
  var g=function(feld){ return z?Number(z[feld]||0):null; };
  var scanN=(window._peScanGesamt==null)?null:Number(window._peScanGesamt);
  return '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      +chip('offen','Zu erledigen',g('offen'))
      +chip('alle','Alle',g('gesamt'))
      +chip('zuverif','Zu verifizieren',g('zuverif'))
      +chip('keinscore','Ohne Index',g('ohne_score'))
      +chip('waechter','🛡 Alle Auffälligen',g('waechter'))
      +chip('scan','📥 Scan-Eingang',scanN)
      +chip('import','📦 Import-Entwürfe',g('import_entwurf'))
      /* Freigabewerte werden bei Bedarf geladen und über p_colf gefiltert. */
      +'<select id="peFreigabeSel" onfocus="peFreigabeWerte()" onchange="peFreigabeFilterSet(this.value)" title="Nach Freigabe-Status filtern (ganzer Bestand)" style="align-self:center;font-size:11.5px;padding:3px 6px;border:1px solid #d3dbe6;border-radius:8px;background:#fff;color:#1d2733;max-width:190px">'
        +'<option value="">Freigabe: alle</option>'
        +((window._peFreigabeWerte||[]).map(function(w){ var akt=(window._peColF&&window._peColF.freigabe&&window._peColF.freigabe[w.wert]); return '<option value="'+esc(w.wert)+'"'+(akt?' selected':'')+'>'+esc(w.wert)+' ('+w.n+')</option>'; }).join(''))
        +((window._peColF&&window._peColF.freigabe&&!(window._peFreigabeWerte||[]).length)?('<option value="'+esc(Object.keys(window._peColF.freigabe)[0]||'')+'" selected>'+esc(Object.keys(window._peColF.freigabe)[0]||'')+'</option>'):'')
      +'</select>'
      +(katf?'<span style="align-self:center;font-size:11.5px;color:#7b8698;margin-left:4px">gefiltert auf „'+esc(katf)+'"</span>':'')
      +(z?'':'<span style="align-self:center;font-size:11.5px;color:#cf5442;margin-left:4px">Zahlen gerade nicht abrufbar</span>')
    +'</div>'
    /* Ein aktiver Seitenfilter hält seine Reihe sichtbar. */
    +(function(){
        var R3=['keinquelle','keinzut','markiert','naehrwerte','portionsfalle','unverif'];
        var NAM={keinquelle:'Ohne Quelle',keinzut:'Ohne Zutaten',markiert:'Markiert',
                 naehrwerte:'Nährwerte',portionsfalle:'Portionsfalle',unverif:'Unverifiziert'};
        var aktiv=(R3.indexOf(window._peChip)>=0) ? window._peChip : null;
        var offen=(window._peReihe3Offen===true) || !!aktiv;
        return '<div style="margin-top:6px">'
          +'<button onclick="peReihe3Toggle()" style="border:1px solid #d3dbe6;background:#fff;border-radius:8px;'
          +'padding:3px 9px;font-size:11px;color:#7b8698;cursor:pointer;font-weight:600">'
          +'Nur auf dieser Seite'+(aktiv?(': <b style="color:#2e7d32">'+esc(NAM[aktiv]||aktiv)+'</b>'):'')
          +' <span style="display:inline-block;transition:transform .18s'+(offen?';transform:rotate(180deg)':'')+'">▾</span></button>'
        +'</div>';
      })()
    +'<div id="peReihe3" style="display:'+(((window._peReihe3Offen===true)||['keinquelle','keinzut','markiert','naehrwerte','portionsfalle','unverif'].indexOf(window._peChip)>=0)?'flex':'none')+';gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">'
      +'<span style="font-size:11px;color:#9aa7b2;font-weight:700;letter-spacing:.02em" title="Diese Filter arbeiten auf den geladenen '+PE_SEITE+' Zeilen – die Datenbank kann sie nicht filtern.">NUR AUF DIESER SEITE</span>'
      +chip('keinquelle','Ohne Quelle',rws.filter(function(p){return !p.quelle_typ;}).length,true)
      +chip('keinzut','Ohne Zutaten',rws.filter(function(p){return !p.hat_zutaten;}).length,true)
      +chip('markiert','⚑ Markiert',rws.filter(function(p){return p.markiert;}).length,true)
      +chip('naehrwerte','⚠ Nährwerte',rws.filter(function(p){return p.naehrwerte_qa;}).length,true)
      +chip('portionsfalle','⚠ Portionsfalle',rws.filter(function(p){return p.portionsfalle_qa;}).length,true)
      +chip('unverif','Unverifiziert',rws.filter(function(p){return p.verifiziert!=='Ja';}).length,true)
    +'</div>';
}
/* Blaetterer unter der Liste. Zeigt, WO man steht - und sagt ab Seite 2 dazu, dass die
   Scan-Kandidaten nur auf Seite 1 stehen (die Datenbank liefert sie nur dort). */
function pePagerHtml(){
  var ges=Number(window._peGesamt||0), off=Number(window._peOffset||0), lim=PE_SEITE;
  var b=function(txt,ziel,an){
    return an
      ? '<button type="button" onclick="peSeite('+ziel+')" style="padding:6px 14px;border:1px solid #c3ccf0;border-radius:8px;background:#eef1fb;color:#3b56b0;font-weight:700;font-size:12.5px;cursor:pointer">'+txt+'</button>'
      : '<button type="button" disabled style="padding:6px 14px;border:1px solid #e2e8ef;border-radius:8px;background:#fff;color:#c2cad6;font-weight:700;font-size:12.5px;cursor:default">'+txt+'</button>'; };
  if(!ges) return '<div style="text-align:center;color:#9aa7b2;font-size:12px">Keine Produktzeilen in diesem Filter.</div>';
  var von=off+1, bis=Math.min(off+lim,ges);
  return '<div style="display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap">'
    +b('‹ zurück', Math.max(0,off-lim), off>0)
    +'<span style="font-size:12.5px;color:#5b6b82;font-weight:700">'+von+'–'+bis+' von '+ges+'</span>'
    +b('weiter ›', off+lim, bis<ges)
    +(off>0?'<span style="font-size:11.5px;color:#9aa7b2">Scan-Kandidaten stehen nur auf Seite 1</span>':'')
    +'</div>';
}
/* Jeden aktiven Filter sichtbar und einzeln rücknehmbar halten. */
function peAktivFilterHtml(){
  var teile=[];
  var kat=((document.getElementById('peVorKat')||{}).value||'').trim();
  var suche=((document.getElementById('peSuche')||{}).value||'').trim();
  var chip=window._peChip||'alle';
  var colF=window._peColF||{};
  var colN=Object.keys(colF).length;
  var brandN=window._peBrandOff?Object.keys(window._peBrandOff).length:0;
  var CHIPNAME={offen:'Zu erledigen',zuverif:'Zu verifizieren',keinscore:'Ohne Index',keinquelle:'Ohne Quelle',
                keinzut:'Ohne Zutaten',markiert:'Markiert',waechter:'Alle Auffälligen',naehrwerte:'Nährwerte',
                portionsfalle:'Portionsfalle',unverif:'Unverifiziert',scan:'Scan-Eingang',import:'Import-Entwürfe'};
  var pill=function(txt,weg){
    return '<span style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e0a32e;color:#8a5a0b;'
      +'border-radius:999px;padding:3px 6px 3px 11px;font-size:12px;font-weight:700">'+txt
      +'<button type="button" onclick="peFilterWeg(\''+weg+'\')" title="diesen Filter aufheben" '
      +'style="border:0;background:#fdf0d8;color:#8a5a0b;border-radius:999px;width:18px;height:18px;line-height:1;'
      +'cursor:pointer;font-size:12px;font-weight:700;padding:0">✕</button></span>'; };
  if(kat)     teile.push(pill('Kategorie: '+esc(kat),'kat'));
  if(chip&&chip!=='alle') teile.push(pill(esc(CHIPNAME[chip]||chip),'chip'));
  if(suche)   teile.push(pill('Suche: „'+esc(suche.length>22?suche.slice(0,22)+'…':suche)+'"','suche'));
  if(colN)    teile.push(pill('Spaltenfilter ('+colN+')','spalten'));
  if(brandN)  teile.push(pill(brandN+' Marke'+(brandN===1?'':'n')+' ausgeblendet','marken'));
  if(window._peHideMarken) teile.push(pill('Werbe-Marken aus','werbe'));
  /* PE_CHIP_NUR_SEITE ist die gemeinsame Quelle für den sichtbaren Reichweitenhinweis. */
  var _nurSeite = !!PE_CHIP_NUR_SEITE[chip] ||
                  (colN>0) || (brandN>0) || !!window._peHideMarken;
  if(!teile.length) return '';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding:7px 9px;'
    +'background:#fff8ec;border:1px solid #f0dcb4;border-radius:10px">'
    +'<span style="font-size:11.5px;font-weight:700;color:#8a5a0b;letter-spacing:.02em">FILTER AKTIV – nicht alle Produkte sichtbar</span>'
    + teile.join('')
    + (_nurSeite?'<span style="font-size:11.5px;color:#8a5a0b;background:#fdf0d8;border-radius:8px;padding:3px 8px" title="Diese Art Filter kann die Datenbank nicht – sie siebt die '+PE_SEITE+' geladenen Zeilen.">wirkt nur auf die geladene Seite</span>':'')
    +'<button type="button" onclick="peFilterWeg(\'alle\')" style="margin-left:auto;border:1px solid #8a5a0b;background:#8a5a0b;color:#fff;'
    +'border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">Alle Filter aufheben</button>'
    +'</div>';
}
function peFilterWeg(was){
  if(was==='kat'||was==='alle'){ var k=document.getElementById('peVorKat'); if(k) k.value=''; }
  if(was==='chip'||was==='alle'){ window._peChip='alle'; }
  if(was==='suche'||was==='alle'){ var s=document.getElementById('peSuche'); if(s) s.value=''; }
  if(was==='spalten'||was==='alle'){ window._peColF={}; }
  if(was==='marken'||was==='alle'){ window._peBrandOff=null; }
  if(was==='werbe'||was==='alle'){ window._peHideMarken=false; }
  /* Serverfilter benötigen einen Neuabruf; lokale Filter nur ein Neuzeichnen. */
  try{
    if(was==='kat'||was==='chip'||was==='suche'||was==='alle'){ peStateSave(); peSeite(0); }
    else peRender();
  }catch(e){}
}
if(typeof window!=='undefined'){
  window.pePasst=pePasst; window.peChipRowsHtml=peChipRowsHtml;
  window.peAktivFilterHtml=peAktivFilterHtml; window.peFilterWeg=peFilterWeg;
  window.pePagerHtml=pePagerHtml;
}
function peRender(){
  var rows=window._peRows||[]; var g=document.getElementById('peGrid'); if(!g) return;
  try{ peStateSave(); }catch(e){}   /* NACH dem Guard: ohne aufgebaute Liste wuerden leere Felder den gespeicherten Zustand ueberschreiben */
  var sort=((document.getElementById('peSort')||{}).value)||'neu';
  var list=rows.filter(function(p){ return pePasst(p, null); });
  /* Chipzahlen aus der aktuellen Listenmenge nachziehen. */
  try{ var _cr=document.getElementById('peChipRows'); if(_cr) _cr.innerHTML=peChipRowsHtml(); }catch(e){}
  try{ var _af=document.getElementById('peAktivFilter'); if(_af) _af.innerHTML=peAktivFilterHtml(); }catch(e){}
  /* Filter können die Kopfhöhe ändern; deshalb die Listenhöhe nachziehen. */
  try{ if(typeof peListeHoehe==='function') peListeHoehe(); }catch(e){}
  if(sort==='mark') list=list.filter(function(p){return p.markiert;});
  /* ⚠ Die Sortierung ordnet die GELADENE SEITE (100 Zeilen), nicht den Katalog. Die
     Grundordnung macht die Datenbank (erfasst desc, id desc); wer nach Index oder Titel
     sortiert, sortiert innerhalb dieser Seite. Eine katalogweite Sortierung braeuchte
     einen weiteren Parameter an cb_erfassung_liste - der ist bewusst NICHT erfunden. */
  list.sort(function(a,b){
    if(sort==='score'){ var _ia=peIndexWert(a), _ib=peIndexWert(b); var sa=(_ia==null?9999:_ia), sb=(_ib==null?9999:_ib); if(sa!==sb) return sa-sb; }
    else if(sort==='titel'){ var ta=String(a.name||'').toLowerCase(),tb=String(b.name||'').toLowerCase(); if(ta!==tb) return ta<tb?-1:1; }
    var da=String(a.erfasst||''),db=String(b.erfasst||''); if(da!==db) return da<db?1:-1;
    var na=parseInt(String(a.id).replace(/\D/g,''),10)||0,nb=parseInt(String(b.id).replace(/\D/g,''),10)||0; return nb-na; });
  window._peSichtbar=list;
  var th=function(h){ return '<th style="position:sticky;top:0;background:#eef3f8;text-align:left;padding:9px 10px;border-bottom:1px solid #e2e8ef;font-size:12px;color:#5b6b82;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h+'</th>'; };
  var td=function(c,st,attr){ return '<td '+(attr||'')+' style="padding:9px 10px;border-bottom:1px solid #e2e8ef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(st||'')+'">'+c+'</td>'; };
  /* Feste Spaltenbreiten (table-layout:fixed) – lange Titel werden abgeschnitten (…), statt die
     Tabelle zu sprengen. Titel-Spalte ohne feste Breite = nimmt den Rest. */
  /* Spaltenbreiten sind ziehbar; die Titelspalte nimmt ohne gespeicherten Wert den Rest. */
  var _peColW=(function(){
    try{ var s=JSON.parse(localStorage.getItem('peColW')||'null');
         if(Array.isArray(s)&&s.length===PE_COL_STD.length) return s; }catch(e){}
    return PE_COL_STD.slice();
  })();
  window._peColW=_peColW;
  var cols='<colgroup>'+_peColW.map(function(w,i){
    return '<col'+(w>0?(' style="width:'+w+'px"'):'')+'>'; }).join('')+'</colgroup>';
  /* 🔴 20.09.2026, RALPH (P1045 Magnesiumcitrat): der Reinheits-Index gehoert auch in die
     Liste - siehe peIndexWert oben. Eigene Optik mit "R" davor, damit niemand ihn fuer einen
     Root Index haelt. */
  var scoreCell=function(s, p){
    var si=(p&&p.supp_index!=null)?Number(p.supp_index):null;
    if(si!=null && isFinite(si)){
      var cr=si>=80?'#2e9e57':si>=60?'#c88616':'#7b5cd6';
      return '<span title="Reinheits-Index für Nahrungsergänzung (Dosis 35 · Wirkform 25 · Transparenz 20 · Zusatzstoffe 20) – nicht der Root Index"'
        +' style="font-weight:800;color:'+cr+'"><span style="font-size:10px;opacity:.75;margin-right:2px">R</span>'
        +String(Math.round(si))+'</span>';
    }
    if(s==null) return '<span style="font-weight:800;color:#7b8698">–</span>';
    var c=s>=80?'#2e9e57':s>=60?'#c88616':'#cf5442'; return '<span style="font-weight:800;color:'+c+'">'+s+'</span>'; };
  var statPill=function(p){
    /* Scan-Zeile: noch kein Produkt. Statt der Status-Pille steht hier der Knopf, der den
       bestehenden Anlege-Weg oeffnet (openFgEditor ohne id). stopPropagation, weil die
       ganze Zeile sonst zusaetzlich peSelect ausloest. */
    if(peIstScan(p)) return '<button type="button" onclick="event.stopPropagation();peScanAnlegen(\''+esc(p.id)+'\')" title="Aus diesem Scan ein Produkt anlegen – Name, Marke, EAN werden vorbelegt" style="padding:3px 9px;border:1px solid #3b56b0;border-radius:20px;background:#eef1fb;color:#3b56b0;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">📥 anlegen</button>';
    if(String(p.pstatus||'')==='Entwurf') return '<span class="pePill" style="color:#c88616;border-color:#eddcb6;background:#fbf3e2">Entwurf</span>';
    if(p.zu_verifizieren) return '<span class="pePill" style="color:#3b56b0;border-color:#c3ccf0;background:#eef1fb">zu verifizieren</span>';
    return '<span class="pePill" style="color:#1f7d43;border-color:#bfe3cb;background:#e7f6ec">Aktiv</span>'; };
  /* 27z: filterbare Spaltenköpfe (Excel-artig) - Klick öffnet die Werte-Häkchen-Liste.
     Aktiver Filter faerbt den Kopf blau und zeigt einen gefüllten Trichter. */
  /* Der Ziehgriff sitzt IM Spaltenkopf, rechts. stopPropagation ist Pflicht: sonst
     oeffnet jedes Ziehen zusaetzlich den Excel-Filter dieser Spalte. */
  var _griff=function(i){
    return '<span onmousedown="peColZiehStart(event,'+i+')" ondblclick="peColBreiteZuruecksetzen(event,'+i+')"'
      +' title="Ziehen = Breite aendern · Doppelklick = zuruecksetzen"'
      +' style="position:absolute;top:0;right:0;width:7px;height:100%;cursor:col-resize;user-select:none"></span>';
  };
  var thF=function(h,col,i){
    var on=!!(window._peColF&&window._peColF[col]);
    var basis='position:sticky;top:0;background:'+(on?'#e3ebfb':'#eef3f8')+';text-align:left;padding:9px 10px;'
      +'border-bottom:1px solid #e2e8ef;font-size:12px;color:'+(on?'#3b56b0':'#5b6b82')+';font-weight:700;'
      +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    if(!col) return '<th style="'+basis+'">'+h+_griff(i)+'</th>';
    return '<th onclick="peColFilter(event,\''+col+'\')" title="Klicken zum Filtern (wie in Excel)" style="'+basis+';cursor:pointer">'
      +h+' <span style="font-size:10px">'+(on?'▼':'▾')+'</span>'+_griff(i)+'</th>';
  };
  /* Freigabepunkte zeigen ausschließlich Felder aus v_erfassung_katalog;
     Scan-Eingänge bleiben leer und es wird keine Regel im Frontend nachgebaut. */
  var pePkt=function(kl,titel){ return '<span class="pePkt pePkt-'+kl+'" title="'+esc(titel)+'"></span>'; };
  var _stFarbe={gruen:'g',gelb:'y',rot:'r',wartet:'w'};
  /* 🔴 06.09.2026, Ralph: "waechter leer oder fehlen. geht nicht. leer, wenn nicht
     erforderlich." Drei Zustaende, die man auseinanderhalten muss:
       · NOCH NICHT GEPRUEFT (kein Eintrag im Vorrat) -> grauer Strich. Ein hohler
         Kreis sah aus wie "nicht noetig" und war doch nur "wir wissen es nicht".
       · WARTET / nicht erforderlich (Vorbedingung fehlt) -> hohler Kreis.
       · GEPRUEFT -> gruen, gelb oder rot.
     Nichts raten: was der Server nicht gesagt hat, wird als ungeprueft gezeigt. */
  /* 🔴 06.09.2026, Ralph: "noch nicht geprueft in blau", "nicht erforderlich weiss".
     Blau = wir wissen es noch nicht. Weiss = geprueft und hier nicht noetig.
     Zwei verschiedene Aussagen, zwei verschiedene Zeichen. */
  var peStrich=function(t){ return '<span class="pePkt pePkt-u" title="'+esc(t)+'"></span>'; };
  var pePunkte=function(p){
    if(peIstScan(p)) return ['','','','','','','',''];
    var d=(window._peStationen||{})[String(p.id)];
    if(!d||!Array.isArray(d.st)){
      var t='Stationen noch nicht geprüft – der Takt holt dieses Produkt nach';
      return [peStrich(t),peStrich(t),peStrich(t),peStrich(t),peStrich(t),peStrich(t),peStrich(t),peStrich(t)];
    }
    return d.st.map(function(e){
      return pePkt(_stFarbe[e.f]||'x', e.s+': '+e.g);
    });
  };
  /* Anlagedatum kommt aus Erstellt_am; `erfasst` bezeichnet die letzte Prüfung. */
  var peDatum=function(v){
    if(!v) return '<span style="color:#9aa7b2">–</span>';
    var d=new Date(v); if(isNaN(d.getTime())) return esc(String(v).slice(0,10));
    var z=function(n){ return (n<10?'0':'')+n; };
    return '<span title="'+esc(String(v))+'">'+z(d.getDate())+'.'+z(d.getMonth()+1)+'.'+String(d.getFullYear()).slice(2)+'</span>';
  };
  var _thPkt=function(kurz,lang,i){
    return '<th title="'+esc(lang)+'" style="position:sticky;top:0;background:#eef3f8;text-align:center;padding:9px 2px;'
      +'border-bottom:1px solid #e2e8ef;font-size:11px;color:#5b6b82;font-weight:700;white-space:nowrap;overflow:hidden">'
      +kurz+_griff(i)+'</th>';
  };
  g.innerHTML=cols+'<thead><tr>'+[thF('P-Nr','pnr',0),thF('Titel','titel',1),thF('Marke','marke',2),thF('Index','index',3),thF('Status','status',4),thF('EAN','ean',5),thF('Quelle','quelle',6),
      thF('Angelegt',null,7),
      _thPkt('Q','Station Quelle: woher kommt der Text?',8),
      _thPkt('W','Etikettwortlaut am Produkt',9),
      _thPkt('Z','zerlegt: Zutatenzeilen entstanden',10),
      _thPkt('B','gebunden: jede Zeile kennt der Stamm',11),
      _thPkt('S','bewertet: Score vollständig',12),
      _thPkt('N','Nährwerte: Wächter still',13),
      _thPkt('E','Einheit und Kategorie: Wächter still',14),
      _thPkt('F','freigegeben',15),
      thF('⚑ 🛡',null,16)].join('')+'</tr></thead><tbody>'
    +list.map(function(p){ var seln=(String(window._peSel||'')===String(p.id));
      var _scan=peIstScan(p);
      return '<tr class="'+(seln?'sel':'')+'" data-id="'+esc(p.id)+'" onclick="peSelect(\''+esc(p.id)+'\')" oncontextmenu="peRowCtx(event,\''+esc(p.id)+'\')"'
      +(_scan?' style="background:#f7faff"':'')+'>'
      /* Pseudo-Nummer S-<EAN> sichtbar anders: es ist KEINE P-Nummer, und man darf sie
         nirgends als solche verwenden (§1.12 – ein Platzhalter, der sich als Wissen ausgibt). */
      +td(_scan?('<span title="Scan-Kandidat – noch keine Produkt-Nummer" style="color:#3b56b0;font-weight:700">'+esc(p.id)+'</span>'):esc(p.id),'color:#7b8698')
      +td('<b>'+esc(p.name||'—')+'</b>','', 'title="'+esc(p.name||'')+'"')
      +td(esc(p.marke||''),'','title="'+esc(p.marke||'')+'"')
      +td(scoreCell(p.score,p),'overflow:visible')
      +td(statPill(p),'overflow:visible')
      +td(p.ean?esc(p.ean):'<span style="color:#c88616">offen</span>','color:#7b8698')
      +td(p.quelle_typ?esc(p.quelle_typ):'<span style="color:#cf5442">fehlt</span>','color:#7b8698;font-size:12px','title="'+esc(p.quelle_typ||'')+'"')
      +td(peDatum(p.angelegt),'color:#7b8698;font-size:12px')
      +pePunkte(p).map(function(pk){ return td(pk,'text-align:center;padding:9px 2px;overflow:visible'); }).join('')
      +td((String(p.herkunft||'')==='Riki-Autopilot'?'<span title="Vom Riki-Autopilot angelegt und vom Riki-Wächter geprüft – bitte verifizieren" style="margin-right:2px">🤖</span>':'')+(p.markiert?'<span style="color:#cf5442">⚑</span>':'')+(peHatWaechter(p)?'<span title="'+esc(peWaechterText(p))+'" style="color:#c88616">🛡</span>':(peWaechterFeldFehlt(p)?'<span title="Der Server hat für diese Zeile kein Wächterurteil geliefert – die Liste rechnet es bewusst nicht selbst nach (#619)" style="color:#9aa7b2">·</span>':'')),'overflow:visible')
      +'</tr>'; }).join('')
    +'</tbody>';
  /* Fußzeile trennt geladene Seitenzeilen von der serverseitigen Gesamtmenge. */
  var f=document.getElementById('peFoot');
  if(f){
    var _ges=Number(window._peGesamt||0), _off=Number(window._peOffset||0);
    var _nProd=rows.filter(function(p){ return !peIstScan(p); }).length;
    var _nScan=rows.length-_nProd;
    f.textContent='Auf dieser Seite '+list.length+' von '+rows.length+' geladenen Zeilen'
      +(_ges?(' · Produkte '+(_nProd?(_off+1):0)+'–'+(_off+_nProd)+' von '+_ges):'')
      +(_nScan?(' · '+_nScan+' Scan-Kandidat'+(_nScan===1?'':'en')):'');
  }
  try{ var _pg=document.getElementById('pePager'); if(_pg) _pg.innerHTML=pePagerHtml(); }catch(e){}
  var lh=document.getElementById('peListHint'); if(lh) lh.textContent='· '+list.length+' angezeigt';
  try{ peStatusBtnUpdate(); }catch(e){}
}
/* Ein Klick auf einen filterbaren Spaltenkopf öffnet die Werte-Liste mit Häkchen +
   Suchfeld. window._peColF[spalte] = { wert:true } (erlaubte Werte); kein Eintrag = kein
   Filter. peColVal ist die EINE Wertequelle - Filter und Anzeige nutzen dieselbe (§1.11i). */
function peColVal(p,col){
  /* Scan-Zeilen sind ein eigener Zustand, kein Produktstatus - sonst stuenden sie im
     Spaltenfilter unter "zu verifizieren" und man haelt sie fuer Produkte. */
  if(col==='status') return peIstScan(p)?'Scan':(String(p.pstatus||'')==='Entwurf'?'Entwurf':(p.zu_verifizieren?'zu verifizieren':'Aktiv'));
  if(col==='ean') return p.ean?'vorhanden':'offen';
  if(col==='marke') return String(p.marke||'').trim()||'– leer –';
  if(col==='kategorie') return String(p.kategorie||'').trim()||'– leer –';
  if(col==='quelle') return String(p.quelle_typ||'').trim()||'– leer –';
  if(col==='herkunft') return String(p.herkunft||'').trim()||'– leer –';
  /* Zug 2 (#17): Freigabe_Status - GLEICHLAUF mit cb_erf_menge (SQL, freigabe-Zweig) */
  if(col==='freigabe') return String(p.freigabe_status||'').trim()||'– leer –';
  if(col==='pnr') return String(p.id||'');
  if(col==='titel') return String(p.name||'');
  /* Index: Zehner-Gruppen NUR fuers Filtern/Zaehlen (90–100 zusammen, weil 100 sonst allein steht).
     Das sind Anzeige-Eimer, keine Bewertungsgrenzen. */
  if(col==='index'){ var s=peIndexWert(p); if(s==null||!isFinite(s)) return 'ohne Index'; if(s>=90) return '90–100'; var lo=Math.floor(s/10)*10; return lo+'–'+(lo+9); }
  return '';
}
/* Spaltenfilter arbeiten serverseitig. Werte und Zahlen kommen aus
   cb_erfassung_spaltenwerte (ganzer Bestand,
   Excel-Semantik: die eigene Spalte zaehlt sich nicht weg - macht die DB), die Filterung
   laeuft ueber p_colf in cb_erfassung_liste. pePasst behaelt die wortgleiche Klausel nur
   fuer die Sofort-Reaktion auf der geladenen Seite (dasselbe Muster wie Suche/Chips).
   Die Wertableitung lebt DOPPELT: peColVal (JS) und cb_erf_colwert (SQL) - GLEICHLAUF-PAAR,
   wer eines aendert, zieht das andere nach (an beiden Orten dokumentiert). */
function peColfPayload(ohneSpalte){
  var cf=window._peColF||{}, out={}, n=0;
  var DB={status:1,ean:1,marke:1,kategorie:1,quelle:1,herkunft:1,index:1,pnr:1,titel:1};
  for(var col in cf){ if(!cf.hasOwnProperty(col)||!cf[col]||col===ohneSpalte||!DB[col]) continue;
    if(cf[col].__q!==undefined){ if(cf[col].__q){ out[col]={q:cf[col].__q}; n++; } }
    else { out[col]={werte:Object.keys(cf[col])}; n++; }
  }
  return n?out:null;
}
var _peColfT=null;
function peColfReload(){
  clearTimeout(_peColfT);
  _peColfT=setTimeout(function(){
    peDatenHolen(0).then(function(){ peRender(); })
      .catch(function(e){ console.error('cb_erfassung_liste (Spaltenfilter)', e); });
  }, 350);
}
async function peColWerteLaden(col, wq){
  var d=window._peColBoxDaten; if(!d||d.col!==col) return;
  try{
    var srv=PE_CHIP_SERVER[window._peChip||'offen']||'alle';
    var r=await client.rpc('cb_erfassung_spaltenwerte',{p_spalte:col,p_chip:srv,
      p_suche:peSucheWert()||null,p_kat:peKatWert()||null,p_colf:peColfPayload(col),p_wertsuche:wq||null});
    if(r.error) throw r.error;
    var a=r.data; if(typeof a==='string'){ try{a=JSON.parse(a);}catch(e){} }
    if(!a||a.ok!==true) throw new Error((a&&a.grund)||'keine Antwort');
    d=window._peColBoxDaten; if(!d||d.col!==col) return;   /* Box wurde inzwischen geschlossen */
    var cf=d.cfStart;
    d.werte=(a.werte||[]).map(function(x){ return String(x.wert); });
    d.cnt={}; (a.werte||[]).forEach(function(x){ d.cnt[String(x.wert)]=Number(x.n)||0; });
    d.sel={}; d.werte.forEach(function(v){ d.sel[v]=cf?!!cf[v]:true; });
    d.gekappt=!!a.gekappt; d.distinkt=Number(a.distinct_gesamt||d.werte.length); d.laed=false;
    /* 🔴 06.09.2026: bei sehr grossen Mengen wertet der Server hoechstens 20.000
       Zeilen aus - vorher lief die Abfrage beim Chip „Alle" (61.740) in den Timeout
       und der Filter zeigte gar nichts. Wenn gestichprobt wird, MUSS das dastehen:
       eine Zahl, die sich als vollstaendig ausgibt, waere schlimmer als der Hinweis. */
    d.gestichprobt=!!a.gestichprobt; d.gelesen=Number(a.gelesen||0);
    var h=document.getElementById('peColHinweis');
    if(h) h.innerHTML=d.gekappt
      ? '⚠ '+d.distinkt+' verschiedene Werte – gezeigt werden die häufigsten 400. Übers Suchfeld fragt die Datenbank nach.'
      : (d.gestichprobt
        ? '<span style="color:#c88616">'+d.distinkt+' Werte · Zahlen aus einer Stichprobe von '+d.gelesen.toLocaleString('de-DE')+' Zeilen, nicht aus dem ganzen Bestand</span>'
        : '<span style="color:#9aa7b2">'+d.distinkt+' Werte · Zahlen gelten für den ganzen Bestand</span>');
    peColRender();
  }catch(e){
    console.error('cb_erfassung_spaltenwerte', e);
    var l=document.getElementById('peColList');
    if(l) l.innerHTML='<div style="color:#cf5442;font-size:12px;padding:6px 2px">Werte nicht abrufbar: '+esc((e&&e.message)||e)+'</div>';
  }
}
var _peColWqT=null;
function peColServerSuche(){
  var d=window._peColBoxDaten; if(!d) return;
  /* Nur wenn die Liste gekappt ist, muss die DB nachsuchen - sonst reicht das
     Client-Sieben in peColRender. */
  if(!d.gekappt) return;
  clearTimeout(_peColWqT);
  _peColWqT=setTimeout(function(){
    var q=((document.getElementById('peColSuche')||{}).value||'').trim();
    peColWerteLaden(d.col, q);
  }, 350);
}
function peColFilter(ev,col){
  try{ ev.stopPropagation(); }catch(e){}
  var ex=document.getElementById('peColBox');
  if(ex){ var same=(ex.getAttribute('data-col')===col); ex.remove(); if(same) return; }
  /* 28j: P-Nr und Titel filtern per TIPPEN (gleiche Huelle am Spaltenkopf, aber ein Text-Filter -
     eine Haekchen-Liste aus ~1600 einmaligen Werten waere sinnlos). Leeres Feld = Filter weg. */
  if(col==='pnr'||col==='titel'){
    var cur=(((window._peColF||{})[col])||{}).__q||'';
    var tb=document.createElement('div'); tb.id='peColBox'; tb.setAttribute('data-col',col);
    tb.style.cssText='position:absolute;z-index:85;background:#fff;color:#1d2733;border:1px solid #d3dbe6;border-radius:11px;box-shadow:0 14px 40px rgba(20,40,70,.22);padding:10px;width:260px;display:flex;flex-direction:column;gap:7px';
    var t0=ev.target.closest?ev.target.closest('th'):ev.target; var r0=t0.getBoundingClientRect();
    tb.style.top=(window.scrollY+r0.bottom+4)+'px';
    tb.style.left=(window.scrollX+Math.min(r0.left, Math.max(6, innerWidth-272)))+'px';
    tb.innerHTML='<input id="peColQ" oninput="peColQSet(\''+col+'\',this.value)" value="'+esc(cur)+'" placeholder="'+(col==='pnr'?'P-Nummer tippen…':'Titel tippen…')+'" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d3dbe6;border-radius:8px;font-size:13px;background:#fff;color:#1d2733">'
      +'<button type="button" onclick="peColQSet(\''+col+'\',\'\');var q=document.getElementById(\'peColQ\');if(q)q.value=\'\';" style="padding:6px;border:1px solid #c3ccf0;border-radius:8px;background:#eef1fb;color:#3b56b0;cursor:pointer;font-size:12px;font-weight:700">Filter weg</button>';
    document.body.appendChild(tb);
    try{ var qi=document.getElementById('peColQ'); if(qi) qi.focus(); }catch(e){}
    setTimeout(function(){ var close=function(e){ if(!tb.contains(e.target)){ tb.remove(); document.removeEventListener('mousedown',close); } }; document.addEventListener('mousedown',close); },0);
    return;
  }
  /* Serverwerte berücksichtigen alle Filter außer der gerade geöffneten Spalte. */
  var cf=(window._peColF&&window._peColF[col])||null;   /* null = alles erlaubt */
  var box=document.createElement('div'); box.id='peColBox'; box.setAttribute('data-col',col);
  box.style.cssText='position:absolute;z-index:85;background:#fff;color:#1d2733;border:1px solid #d3dbe6;border-radius:11px;box-shadow:0 14px 40px rgba(20,40,70,.22);padding:10px;width:280px;max-height:60vh;display:flex;flex-direction:column';
  var t=ev.target.closest?ev.target.closest('th'):ev.target; var r=t.getBoundingClientRect();
  box.style.top=(window.scrollY+r.bottom+4)+'px';
  box.style.left=(window.scrollX+Math.min(r.left, Math.max(6, innerWidth-292)))+'px';
  box.innerHTML=
    '<input id="peColSuche" oninput="peColRender();peColServerSuche()" placeholder="🔍 Werte suchen…" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d3dbe6;border-radius:8px;font-size:13px;margin-bottom:7px;background:#fff;color:#1d2733">'
    +'<div style="display:flex;gap:6px;margin-bottom:6px">'
      +'<button type="button" onclick="peColAlle(true)" style="flex:1;padding:6px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">alle an</button>'
      +'<button type="button" onclick="peColAlle(false)" style="flex:1;padding:6px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">alle aus</button>'
      +'<button type="button" onclick="peColReset()" style="flex:1;padding:6px;border:1px solid #c3ccf0;border-radius:8px;background:#eef1fb;color:#3b56b0;cursor:pointer;font-size:12px;font-weight:700">Filter weg</button>'
    +'</div>'
    +'<div id="peColHinweis" style="font-size:11px;color:#b45309;margin-bottom:5px;line-height:1.4"></div>'
    +'<div id="peColList" style="flex:1;overflow:auto;min-height:0"><div style="color:#9aa7b2;font-size:12px;padding:6px 2px">Werte werden geladen (ganzer Bestand) …</div></div>';
  document.body.appendChild(box);
  window._peColBoxDaten={col:col, werte:[], cnt:{}, sel:{}, cfStart:cf, laed:true, gekappt:false};
  peColWerteLaden(col, '');
  setTimeout(function(){ var close=function(e){ if(!box.contains(e.target)){ box.remove(); document.removeEventListener('mousedown',close); } }; document.addEventListener('mousedown',close); },0);
}
function peColRender(){
  var d=window._peColBoxDaten; var list=document.getElementById('peColList'); if(!d||!list) return;
  if(d.laed) return;   /* Lade-Hinweis stehen lassen, bis die DB-Werte da sind */
  var q=((document.getElementById('peColSuche')||{}).value||'').trim().toLowerCase();
  var werte=q?d.werte.filter(function(v){ return v.toLowerCase().indexOf(q)>=0; }):d.werte;
  list.innerHTML=werte.map(function(v){
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:13px;cursor:pointer;border-top:1px solid #eef2f7">'
      +'<input type="checkbox" '+(d.sel[v]?'checked':'')+' data-v="'+esc(v)+'" onchange="peColChk(this)" style="width:16px;height:16px;flex:0 0 auto;accent-color:#16a34a">'
      +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(v)+'</span>'
      +'<span style="color:#9aa7b2;font-size:11px">'+d.cnt[v]+'</span></label>';
  }).join('') || '<div style="color:#9aa7b2;font-size:12px;padding:6px 2px">kein Wert passt zur Suche</div>';
}
function _peColApply(){
  var d=window._peColBoxDaten; if(!d) return;
  var alleAn=d.werte.every(function(v){ return d.sel[v]; });
  window._peColF=window._peColF||{};
  /* Bei gekappten Listen (Marke: ~17.000 Werte, gezeigt 400) heisst „alle sichtbaren an"
     nur dann „kein Filter", wenn vorher auch keiner da war - sonst wuerde ein bestehender
     Filter durch blosses Oeffnen der Box verschwinden. */
  if(alleAn && (!d.gekappt || !window._peColF[d.col])) delete window._peColF[d.col];
  else { var m={}; d.werte.forEach(function(v){ if(d.sel[v]) m[v]=true; }); window._peColF[d.col]=m; }
  peRender();          /* sofort: die geladene Seite siebt mit der wortgleichen Regel */
  peColfReload();      /* und die Datenbank rechnet die echte Menge nach (350 ms gebuendelt) */
}
function peColChk(cb){ var d=window._peColBoxDaten; if(!d) return; d.sel[cb.getAttribute('data-v')]=cb.checked; _peColApply(); }
function peColAlle(on){ var d=window._peColBoxDaten; if(!d) return;
  var q=((document.getElementById('peColSuche')||{}).value||'').trim().toLowerCase();
  d.werte.forEach(function(v){ if(!q||v.toLowerCase().indexOf(q)>=0) d.sel[v]=on; });
  peColRender(); _peColApply(); }
function peColReset(){ var d=window._peColBoxDaten; if(d){ d.werte.forEach(function(v){ d.sel[v]=true; }); }
  peColRender(); _peColApply(); }
function peColQSet(col,v){ v=String(v||'').trim().toLowerCase(); window._peColF=window._peColF||{}; if(v) window._peColF[col]={__q:v}; else delete window._peColF[col]; peRender(); peColfReload(); }
/* Zug 2 (#17): Freigabe_Status-Filter. Werte einmal je Sitzung aus der DB (ganzer Bestand,
   Chip 'alle' - der Nutzer will sehen, was es ueberhaupt gibt), Auswahl laeuft als
   normale Spaltenfilter-Menge ueber p_colf ('freigabe'). */
async function peFreigabeWerte(){
  if(window._peFreigabeWerte) return;
  try{
    var r=await client.rpc('cb_erfassung_spaltenwerte',{p_spalte:'freigabe',p_chip:'alle',p_colf:null});
    if(r.error) throw r.error;
    var a=r.data; if(typeof a==='string'){ try{a=JSON.parse(a);}catch(e){} }
    if(a&&a.ok===true){ window._peFreigabeWerte=(a.werte||[]); try{ peRender(); }catch(e){} }
  }catch(e){ console.error('cb_erfassung_spaltenwerte freigabe', e); }
}
function peFreigabeFilterSet(v){
  window._peColF=window._peColF||{};
  if(v){ var m={}; m[v]=true; window._peColF.freigabe=m; }
  else delete window._peColF.freigabe;
  peRender(); peColfReload();
}
if(typeof window!=='undefined'){ window.peColFilter=peColFilter; window.peColChk=peColChk; window.peColAlle=peColAlle; window.peColReset=peColReset; window.peColRender=peColRender; window.peColVal=peColVal; window.peColQSet=peColQSet; window.peColServerSuche=peColServerSuche; window.peColfPayload=peColfPayload; window.peColfReload=peColfReload; window.peColWerteLaden=peColWerteLaden; window.peFreigabeWerte=peFreigabeWerte; window.peFreigabeFilterSet=peFreigabeFilterSet; }
/* Der Status-Knopf zeigt den ECHTEN Status des ausgewählten Produkts (Aktiv/Entwurf), farbig.
   Ohne Auswahl neutral „⇄ Status". Klick schaltet um (peToggleStatus). */
function peStatusBtnUpdate(){
  var b=document.getElementById('peStatusBtn'); if(!b) return;
  var id=window._peSel; var p=id?(window._peRows||[]).find(function(r){return String(r.id)===String(id);}):null;
  /* Scan-Zeile hat keinen Produktstatus – der Knopf bleibt neutral statt „Aktiv" zu behaupten. */
  if(!p || peIstScan(p)){ b.innerHTML='⇄ Status'; b.style.background='#fff'; b.style.color='#7b8698'; b.style.borderColor='#d3dbe6'; b.style.fontWeight='600'; b.title=p?'Scan-Zeile – noch kein Produkt':'Erst ein Produkt in der Liste anklicken'; return; }
  b.style.fontWeight='700';
  if(String(p.pstatus||'')==='Entwurf'){ b.innerHTML='⇄ Entwurf'; b.style.background='#fbf3e2'; b.style.color='#c88616'; b.style.borderColor='#eddcb6'; b.title='„'+(p.name||id)+'" – umschalten auf Aktiv (über die geprüfte Freigabe)'; }
  else { b.innerHTML='⇄ Aktiv'; b.style.background='#e7f6ec'; b.style.color='#1f7d43'; b.style.borderColor='#bfe3cb'; b.title='„'+(p.name||id)+'" – umschalten auf Entwurf (aus dem Katalog nehmen)'; }
}
function peRowCtx(ev,id){
  ev.preventDefault();
  /* Rechtsklick öffnet nur das Menü; die Ziel-ID geht direkt an dessen Aktionen. */
  window._peSel=id;
  try{ var host=document.getElementById('peGrid')||document; Array.prototype.forEach.call(host.querySelectorAll('tr[data-id]'),function(tr){ tr.classList.toggle('sel', String(tr.getAttribute('data-id'))===String(id)); }); }catch(e){}
  var ctx=document.getElementById('peCtx'); if(!ctx) return;
  var p=(window._peRows||[]).find(function(r){return String(r.id)===String(id);})||{};
  var it=function(txt,fn,danger){ return '<button onclick="document.getElementById(\'peCtx\').style.display=\'none\';'+fn+'" style="display:block;width:100%;text-align:left;background:none;border:0;color:'+(danger?'#cf5442':'#1f2a44')+';padding:8px 11px;border-radius:7px;font-size:13px;cursor:pointer">'+txt+'</button>'; };
  var sep='<div style="height:1px;background:#e2e8ef;margin:4px 6px"></div>';
  /* Scan-Zeile: alle Produkt-Aktionen (Bearbeiten, Markieren, Loeschen) rufen RPCs, die eine
     P-Nummer erwarten. Es gibt hier genau EINE sinnvolle Handlung. */
  if(peIstScan(p)){
    /* Scan verwerfen nutzt denselben bestehenden RPC-Weg wie der Scan-Eingang. */
    ctx.innerHTML=it('📥 Produkt aus diesem Scan anlegen','peScanAnlegen(\''+esc(id)+'\')')
      +sep+it('🗑 Scan verwerfen','peScanVerwerfen(\''+esc(id)+'\')',true);
    ctx.style.display='block';
    var w0=ctx.offsetWidth,h0=ctx.offsetHeight;
    ctx.style.left=Math.min(ev.clientX,innerWidth-w0-6)+'px'; ctx.style.top=Math.min(ev.clientY,innerHeight-h0-6)+'px';
    setTimeout(function(){ document.addEventListener('click',peCtxHide); },0);
    return;
  }
  ctx.innerHTML=
     it('✎ Bearbeiten','peSelect(\''+esc(id)+'\')')
    +it('👁 Als Nutzer ansehen','peAlsNutzer(\''+esc(id)+'\')')
    +it((p.markiert?'⚑ Markierung entfernen':'⚑ Markieren'),'peToggleMark(\''+esc(id)+'\','+(p.markiert?'false':'true')+')')
    +sep
    +it('🗑 Löschen','peDeaktiv(\''+esc(id)+'\')',true);
  ctx.style.display='block';
  var w=ctx.offsetWidth,h=ctx.offsetHeight;
  ctx.style.left=Math.min(ev.clientX,innerWidth-w-6)+'px'; ctx.style.top=Math.min(ev.clientY,innerHeight-h-6)+'px';
  setTimeout(function(){ document.addEventListener('click',peCtxHide); },0);
}

/* Ziehen ändert nur das <col>; die gespeicherten Breiten überleben Seitenwechsel. */
/* Die Standardbreiten stehen an EINEM Ort - sonst laufen Anzeige und Ruecksetzen
   auseinander (1.2c). 0 = keine feste Breite (Titel nimmt den Rest). */
/* Gespeicherte Breiten gelten nur bei exakt passender Spaltenanzahl. */
/* 06.09.2026 (#598): acht Stationsspalten statt sechs Inhaltsspalten.
   Die gespeicherte Breite aus dem localStorage passt dann nicht mehr und wird
   verworfen - deshalb der Laengenvergleich weiter oben. */
var PE_COL_STD=[88,0,120,58,106,136,108,104,26,26,26,26,26,26,26,26,52];
var _peZieh=null;
function peColZiehStart(ev,i){
  if(ev.stopPropagation) ev.stopPropagation();   /* sonst oeffnet sich der Excel-Filter */
  if(ev.preventDefault) ev.preventDefault();
  var g=document.getElementById('peGrid'); if(!g) return;
  var col=g.querySelectorAll('colgroup col')[i]; if(!col) return;
  var th=ev.target&&ev.target.parentNode;
  _peZieh={ i:i, col:col, x0:ev.clientX, w0:(th?th.getBoundingClientRect().width:120) };
  document.addEventListener('mousemove',peColZiehZug);
  document.addEventListener('mouseup',peColZiehEnde);
  try{ document.body.style.cursor='col-resize'; document.body.style.userSelect='none'; }catch(e){}
}
function peColZiehZug(ev){
  if(!_peZieh) return;
  /* Untergrenze 40px: eine Spalte, die man auf 0 zieht, ist danach nicht mehr greifbar -
     der Nutzer koennte sie nie wieder aufziehen. */
  var w=Math.max(40, Math.round(_peZieh.w0 + (ev.clientX - _peZieh.x0)));
  _peZieh.col.style.width=w+'px';
  _peZieh.wNeu=w;
}
function peColZiehEnde(){
  document.removeEventListener('mousemove',peColZiehZug);
  document.removeEventListener('mouseup',peColZiehEnde);
  try{ document.body.style.cursor=''; document.body.style.userSelect=''; }catch(e){}
  if(_peZieh && _peZieh.wNeu!=null){
    /* Ohne vollständigen Speicherstand von PE_COL_STD kopieren, damit andere Breiten bleiben. */
    var arr=(Array.isArray(window._peColW)&&window._peColW.length===PE_COL_STD.length)
              ? window._peColW.slice() : PE_COL_STD.slice();
    arr[_peZieh.i]=_peZieh.wNeu;
    window._peColW=arr;
    try{ localStorage.setItem('peColW', JSON.stringify(arr)); }
    catch(e){ console.error('Spaltenbreite konnte nicht gemerkt werden', e); }
  }
  _peZieh=null;
}
/* Doppelklick auf den Griff: NUR diese Spalte zurueck auf den Standard. Ohne Rueckweg
   waere eine einmal verzogene Spalte dauerhaft kaputt (1.11n-nn: der Weg zurueck gehoert dazu). */
function peColBreiteZuruecksetzen(ev,i){
  if(ev.stopPropagation) ev.stopPropagation();
  if(ev.preventDefault) ev.preventDefault();
  var arr=(window._peColW||PE_COL_STD.slice()).slice(); arr[i]=PE_COL_STD[i]; window._peColW=arr;
  try{ localStorage.setItem('peColW', JSON.stringify(arr)); }catch(e){}
  try{ peRender(); }catch(e){ console.error('peRender', e); }
}
/* Scan-Verwerfen entfernt nur vorläufige Scan-Daten, niemals ein Produkt. */
async function peScanVerwerfen(id){
  var p=(window._peRows||[]).find(function(r){return String(r.id)===String(id);});
  if(!peIstScan(p)){ alert('Das ist keine Scan-Zeile.'); return; }
  /* Die EAN steckt in der Pseudo-Nummer S-<EAN>. Lieber aus dem Datensatz nehmen -
     wer sie aus der ID schneidet, verlaesst sich auf eine Schreibweise. */
  var ean=String((p&&p.ean)||'').trim() || String(id).replace(/^S-/,'');
  if(!ean){ alert('Zu dieser Zeile ist keine EAN hinterlegt.'); return; }
  if(!confirm('Scan '+ean+' verwerfen?\n\n'+((p&&p.name)?('„'+p.name+'"\n\n'):'')
    +'Es wird KEIN Produkt geloescht – nur die vorlaeufigen Scan-Daten.\nScannt jemand den Barcode erneut, wird er wieder gesucht.')) return;
  try{
    var r=await client.rpc('cb_scan_verwerfen',{p_ean:ean});
    if(r.error) throw r.error;
    /* Die RPC meldet ihr Scheitern im Ergebnis, nicht als Fehler - sonst sieht ein
       abgelehnter Aufruf wie ein Erfolg aus. */
    if(r.data && r.data.ok===false) throw new Error(r.data.grund||'abgelehnt');
    window._peRows=(window._peRows||[]).filter(function(x){return String(x.id)!==String(id);});
    if(String(window._peSel||'')===String(id)) window._peSel=null;
    try{ peRender(); }catch(e){}
    try{ peZaehlerHolen(); }catch(e){ console.error('peZaehlerHolen', e); }
  }catch(e){ alert('Verwerfen fehlgeschlagen: '+(e&&e.message?e.message:e)); }
}
async function peToggleMark(id,an){
  if(peIstScan((window._peRows||[]).find(function(r){return String(r.id)===String(id);}))){
    alert('Scan-Zeilen lassen sich nicht markieren – sie sind noch kein Produkt.\n\nErst über „📥 anlegen" ein Produkt daraus machen.'); return; }
  try{ await fgEditMark(id, an===true||an==='true'); }catch(e){}
  var p=(window._peRows||[]).find(function(r){return String(r.id)===String(id);}); if(p) p.markiert=(an===true||an==='true');
  peRender();
}
function peAlsNutzer(id){
  /* Eine Scan-Zeile gibt es in der Nutzer-Ansicht nicht – sie ist noch kein Produkt. */
  if(peIstScan((window._peRows||[]).find(function(r){return String(r.id)===String(id);}))){
    alert('Diese Zeile ist ein Scan-Kandidat und noch kein Produkt – es gibt keine Nutzer-Ansicht davon.'); return; }
  /* prodOeffnen lädt das Produktobjekt; produktZutatenV2 bleibt objektbasiert. */
  try{ if(typeof prodOeffnen==='function'){ prodOeffnen(id); return; } }catch(e){}
  alert('Nutzer-Ansicht ist hier nicht verfügbar.'); }

async function peToggleStatus(){
  var id=window._peSel; if(!id){ alert('Bitte zuerst ein Produkt in der Liste anklicken.'); return; }
  var p=(window._peRows||[]).find(function(r){return String(r.id)===String(id);})||{};
  if(peIstScan(p)){ alert('Das ist eine Scan-Zeile – sie hat noch keinen Produktstatus.\n\nErst über „📥 anlegen" ein Produkt daraus machen.'); return; }
  await feStatusWechsel(id, String(p.pstatus||'Aktiv'), p.name, loadProduktErfassung);
}
/* cb_produkt_loeschen entscheidet serverseitig zwischen Löschung und Ablehnung;
   Produkte mit Tagebuchbezug dürfen nur ausdrücklich archiviert werden. */
async function peDeaktiv(id){
  var p=(window._peRows||[]).find(function(r){return String(r.id)===String(id);})||{};
  if(peIstScan(p)){ alert('Das ist eine Scan-Zeile, kein Produkt – es gibt nichts zu löschen.\n\nScans verwirft man im Scan-Eingang (📥 in der Toolbar).'); return {ok:false,aktion:'abgelehnt'}; }
  if(!confirm('Produkt '+id+(p.name?(' – „'+p.name+'"'):'')+' WIRKLICH LÖSCHEN?\n\nEndgültig aus der Datenbank entfernt – NICHT rückgängig zu machen.')) return {ok:false,aktion:'abgebrochen'};
  try{
    var r=await client.rpc('cb_produkt_loeschen',{p_id:id});
    if(r.error) throw r.error;
    var d=r.data||{};
    /* Serverablehnung lässt Editor und Bestand unverändert. Erfolg wird erst nach
       abgeschlossenem Neuladen gemeldet; Archivieren bleibt ausdrücklich benannt. */
    var _archiviert=false;
    if(d.ok===false && d.grund==='tagebuch'){
      if(!confirm('„'+(p.name||id)+'" steht in '+d.anzahl+' Nutzer-Tagebuch-Eintrag/en – hartes Löschen würde deren Historie zerstören.\n\nStattdessen ARCHIVIEREN (aus dem Katalog nehmen, Nutzer-Historie bleibt erhalten)?')) return {ok:false,aktion:'abgebrochen'};
      var r2=await client.rpc('cb_produkt_status_setzen',{p_id:id,p_status:'Abgelehnt'});
      if(r2.error) throw r2.error;
      _archiviert=true;
    }else if(d.ok===false){
      /* Unbekannte Ablehnungen verändern den lokalen Bestand nicht. */
      alert('„'+(p.name||id)+'" wurde NICHT gelöscht.\n\nDer Server hat abgelehnt'+(d.grund?(' – Grund: '+d.grund):' und keinen Grund genannt')+'.\n\nDas Produkt steht unverändert in der Liste.');
      return {ok:false,aktion:'abgelehnt',grund:d.grund||''};
    }
    window._peRows=(window._peRows||[]).filter(function(x){return String(x.id)!==String(id);});
    if(String(window._peSel||'')===String(id)){ window._peSel=null; try{ if(typeof peClose==="function") peClose(); else { var det=document.getElementById('peDetail'); if(det) det.innerHTML=''; } }catch(e){} }
    await loadProduktErfassung();
    /* Erst der neu geladene Serverstand darf den Abschluss bestätigen. */
    if(_archiviert){
      alert('„'+(p.name||id)+'" wurde ARCHIVIERT, nicht gelöscht.\n\nStatus jetzt „Abgelehnt“ – das Produkt bleibt in der Datenbank und erscheint je nach Filter weiterhin in der Liste. Die Tagebuch-Einträge der Nutzer bleiben erhalten.');
    }
    return {ok:true,aktion:_archiviert?'archiviert':'geloescht'};
  }catch(e){ alert('Konnte nicht löschen: '+(e.message||e)); return {ok:false,aktion:'fehler',fehler:e}; }
}
function peSelect(id){ window._peSel=id;
  document.querySelectorAll('#peGrid tbody tr').forEach(function(tr){ tr.classList.toggle('sel', tr.getAttribute('data-id')===String(id)); });
  try{ peStatusBtnUpdate(); }catch(e){}
  /* Editor kommt: Deckelung aufheben, sonst liegt er unter dem Fensterrand. */
  try{ peListeHoehe(); }catch(e){}
  /* openFgEditor erhält nur echte P-Nummern; Scan-Eingänge gehen in den Anlegeweg. */
  var _p=(window._peRows||[]).find(function(r){ return String(r.id)===String(id); });
  if(peIstScan(_p)){ peScanAnlegen(id); return; }
  /* Editor im Overlay öffnen; der bestehende Inline-Modus bleibt Rückfall. */
  try{ openFgEditor(id); }catch(e){ alert('Editor-Fehler: '+(e&&e.message||e)); }
}
function peNeu(){ window._peSel=null;
  document.querySelectorAll('#peGrid tbody tr').forEach(function(tr){ tr.classList.remove('sel'); });
  try{ peStatusBtnUpdate(); }catch(e){}
  var pre=null; try{ var vk=((document.getElementById('peVorKat')||{}).value||'').trim(); if(vk) pre={kategorie:vk}; }catch(e){}
  try{ openFgEditor(null, pre); }catch(e){ alert('Editor-Fehler: '+(e&&e.message||e)); }
}
function peClose(){ window._peSel=null;
  document.querySelectorAll('#peGrid tbody tr').forEach(function(tr){ tr.classList.remove('sel'); });
  try{ peStatusBtnUpdate(); }catch(e){}
  var det=document.getElementById('peDetail'); if(det) det.innerHTML='';
  try{ var _nf=document.getElementById("navFreigabe"); if(_nf) _nf.style.display="none"; }catch(e){}
  try{ feFreigabeLeisteHide(); }catch(e){}
  try{ peListSet(false); }catch(e){}   /* Editor zu → Liste wieder aufklappen */
  /* Editor zu heisst: die Deckelung gilt wieder. window._peSel ist oben schon
     null gesetzt, deshalb setzt peListeHoehe jetzt die volle Hoehe. */
  try{ peListeHoehe(); }catch(e){}
  /* 🔴 11.09.2026: DAS hier war der Ausloeser beim Loeschen. peListeHoehe() sperrt
     eine Zeile darueber den Seitenscroll - und dieses scrollIntoView scrollte
     danach trotzdem, weil programmatisches Scrollen von overflow:hidden nicht
     aufgehalten wird. Die Seite blieb verschoben stehen und war nicht mehr zu
     bewegen. Solange der Seitenscroll gesperrt ist, gibt es nichts zu scrollen:
     die Liste beginnt ohnehin oben. */
  if(!window._peScrollAus){
    var box=document.getElementById('fgProdErf');
    if(box) box.scrollIntoView({behavior:'smooth',block:'start'});
  }
}
/* Klappzustand der Liste liegt in window._peListCollapsed. */
function peListSet(collapsed){
  window._peListCollapsed=!!collapsed;
  var body=document.getElementById('peListBody'), car=document.getElementById('peListCaret'),
      act=document.getElementById('peListAction'), bar=document.getElementById('peListBar');
  if(body) body.style.display=collapsed?'none':'';
  if(car) car.textContent=collapsed?'▸':'▾';
  if(act) act.textContent=collapsed?'einblenden':'';
  if(bar) bar.style.borderBottom=collapsed?'0':'1px solid #e2e8ef';
}
function peListToggle(){ peListSet(!window._peListCollapsed);
  /* Zugeklappt heisst: kein Vollhoehen-Container (siehe peListeHoehe). */
  try{ peListeHoehe(); }catch(e){} }
if(typeof window!=='undefined'){ window.peListSet=peListSet; window.peListToggle=peListToggle; }

/* Werbe-Marken ausblenden: Dr. Oetker, Gustavo Gusto, Original Wagner – case-insensitiv als
   Teiltreffer, damit auch Varianten/Kombis ("Nestlé, Original Wagner", "GUSTAVO GUSTO",
   "Dr. Oetker, Paula") erwischt werden. */
function peHideMarkenToggle(){
  window._peHideMarken=!window._peHideMarken;
  var b=document.getElementById('peJunkBtn');
  if(b){ var on=window._peHideMarken; b.style.background=on?'#fde8e8':''; b.style.color=on?'#b91c1c':''; b.style.borderColor=on?'#fca5a5':''; b.textContent=on?'🚫 Werbe-Marken (aus)':'🚫 Werbe-Marken'; }
  if(typeof peRender==='function') peRender();
}
