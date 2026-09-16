/* Klassisches Script: app.js und __ADMIN_PAGE müssen vor dem Aufruf bereitstehen. */

function applyAdminMode(){
  if(!ADMIN_MODE) return;
  const bn=document.querySelector('.bottomnav'); if(bn) bn.style.display='';
  const ms=document.getElementById('mehrSheet'); if(ms) ms.style.display='';
  if(!document.getElementById('adminTop')){
    /* adminCrumb bleibt als unsichtbares Schreibziel für adminGo im DOM. */
    /* Build-Kurzform immer aus der letzten Gruppe ableiten; der Titel behält den Vollwert. */
    var _bKurz='', _bVoll='';
    try{
      if(typeof APP_BUILD!=='undefined' && APP_BUILD){
        _bVoll=String(APP_BUILD);
        var _t=_bVoll.split('-');
        _bKurz=_t[_t.length-1]||_bVoll;
      }
    }catch(e){}
    const top=document.createElement('div'); top.id='adminTop';
    top.innerHTML=
       '<div id="adminCrumb" style="display:none"></div>'
      /* 🔴 26.08.2026, Ralph: „notiz und versionsnummer unten raus."
         Beide Knöpfe standen unten links im Menü und haben dort nur Platz
         gekostet. Die Versionsnummer steht ohnehin oben rechts in der schwarzen
         Leiste — DORT ist sie jetzt auch der Knopf zum harten Neuladen.
         Die Funktionen bleiben: todoDockToggle() und adminNeuLaden() sind
         unverändert erreichbar, nur ohne eigenen Knopf an dieser Stelle. */
      +'<button class="atLogout" onclick="doLogout()" title="Abmelden" aria-label="Abmelden">🚪</button>';
    document.body.appendChild(top);
    /* Dockzustand wiederherstellen; geschlossen trotzdem einmal für den Zähler laden. */
    try{
      var _tdAuf=false; try{ _tdAuf=(localStorage.getItem('ri_todoDock')==='1'); }catch(e){}
      setTimeout(function(){
        /* ME ist App-Zustand und kein window-Export. */
        if(!(typeof ME!=="undefined" && ME && ME.is_admin)) return;
        if(_tdAuf){ try{ todoDockToggle(true); }catch(e){} }
        else { try{ todoLoad(); }catch(e){} }
      }, 900);
    }catch(e){}
    /* Esc schliesst das Dock – aber nur, wenn der Fokus nicht in einem Eingabefeld steht. */
    try{ document.addEventListener('keydown', function(ev){
      if(ev.key!=='Escape') return;
      var d=document.getElementById('todoDock'); if(!d || d.style.display==='none') return;
      var a=document.activeElement, tn=a&&a.tagName;
      if(tn==='INPUT'||tn==='TEXTAREA'||tn==='SELECT'){ if(d.contains(a)){ a.blur(); return; } return; }
      todoDockToggle(false);
    }); }catch(e){}
    const nav=document.createElement('div'); nav.id='adminNav';
    var _an=function(k,ico,lbl,oc,extra){ return '<button class="anBtn"'+(extra||'')+' data-k="'+k+'" onclick="'+oc+'"><span class="anIco">'+ico+'</span><span class="anLbl">'+lbl+'</span></button>'; };
    nav.innerHTML=
       _an('dash','📊','Dashboard',"adminGo('dash')")
      /* 🔴 31.08.2026, Ralph (E16): „die steuerung muss vom admin aus erreichbar
         sein, also ich will sie dort oeffnen koennen." Eigene Seite wie
         video-skript-01.html — eigenes Fenster mit Cache-Buster, damit nach einem
         Deploy nie ein alter Stand aus dem Cache kommt. Kein app.js-Panel: die
         Seite bringt ihre eigene Anmeldung aus derselben Sitzung mit. */
      +_an('steuerung','🎛️','Steuerung',"window.open('steuerung.html?cb='+Date.now(),'_blank')")
      /* 07.09.2026 (#217, Ralph): die Maschine als Netzplan - eigene Seite, eigenes Fenster. */
      +_an('maschine','🚇','Maschine',"window.open('maschine.html?cb='+Date.now(),'_blank')")
      /* 09.09.2026 (#217, Ralph): Riki-Kosten je Aufruf und Produkt - eigene Seite. */
      +_an('rikikosten','💸','Kosten',"window.open('riki-kosten.html?cb='+Date.now(),'_blank')")
      /* 16.09.2026, Ralph: "Benchmark im Menü löschen." Wie schon bei bewerten/
         nährwerte/dubletten/kategorien am 07.09.: nur der Knopf ist weg, der
         Weg bleibt - benchmarkBoardOpen() ist unveraendert aufrufbar. */
      +_an('produkterfassung','🗂️','Erfassen',"adminGo('produkterfassung')",' id="amProdErf"')
      /* 🔴 26.08.2026, Ralph: „auf dem dashboard fehlt mir noch die zutatenstamm
         anzeige oder link." GEMESSEN: adminGo('stamm') gibt es seit Langem und
         funktioniert (Zeile 237), aber im Menue stand kein Knopf dafuer. Ein
         vorhandener Weg ohne Tuer — genau der Fall aus Paragraf 3.1. */
      /* 🔴 03.09.2026, Ralph: „aktiviere den zutatenstamm wieder im admin, der
         button soll wieder links in das adminmenue." Der Knopf steht jetzt fest
         hier — ohne FEATURES-Schalter, der ihn stillschweigend ausblenden kann.
         Er fuehrt auf einen Bereich mit fuenf Reitern: die zwei Stammlisten plus
         Regelwerk, Staffeln und den bebilderten Bewertungsablauf. */
      +_an('stamm','🧬','Zutatenstamm',"adminGo('stamm')")
      /* 🔴 26.08.2026, Ralph: die Entscheidung, was wo hin kommt, muss er auch
         ohne KI treffen koennen. Die Notenleiter zeigt die 117 Staffeln nach Note
         sortiert, mit Herleitung und Quelle - als Vergleichsmaterial. */
      /* Notenleiter: siehe Hinweis weiter unten — jetzt Reiter im Zutatenstamm. */
      /* 🔴 26.08.2026, Work #301: vier fertige Serverwege fuer die automatische
         Zutatenbewertung hatten keine Tuer - gemessen 0 Treffer im ganzen
         Frontend. Das ist der Knopf dazu. */
      /* 🔴 07.09.2026, Ralph: „bewerten, nährwerte, dubletten und kategorien
         raus aus dem menü." Nur der Knopf ist weg, der Weg bleibt: die
         Funktionen bewertungOeffnen(), adminGo('mikro'), adminGo('dubletten')
         und katKonfigOpen() sind unveraendert aufrufbar — wie schon bei
         Regelwerk und Notenleiter am 03.09. Kein Code geloescht, nur eine
         Tuer weniger im Menue. */
      +_an('bundles','🧩','Bundles',"adminGo('bundles')")
      +_an('rezepte','🍳','Rezepte',"adminGo('rezepte')")
      +_an('rezzut','🥣','Rezept-Zutaten',"rezZutatenWaecherOpenSafe()")
      +_an('tausch','🔁','Tausch-Tipps',"adminGo('tausch')")
      +_an('empfehlungen','⭐','Empfehlungen',"adminGo('empfehlungen')")
      /* 🔴 03.09.2026: Regelwerk und Notenleiter haben hier keinen eigenen Knopf
         mehr. Beide wohnen als Reiter im Zutatenstamm — dort, wo man sie
         braucht. Die alten Wege adminGo('regelwerk') und staffelnOeffnen()
         funktionieren unveraendert weiter, sie landen nur an der neuen Stelle. */
      +_an('stufen','🎚️','Stufen',"adminGo('stufen')")
      +_an('fotostudio','📸','Fotostudio',"adminGo('fotostudio')")
      /* 27.08.2026, Ralph: Video-Skript 01 (Vorstellung Root Index) als eigene
         Seite wie fahrplan.html — Lese-Ansicht plus Prompter-Modus. Eigenes
         Fenster mit Cache-Buster, damit nach einem Deploy nie ein alter Stand
         aus dem Cache kommt (die 15.08.-Falle). Kein app.js-Panel: die Seite
         braucht weder Datenbank noch Anmeldung. */
      +_an('videoskript','🎬','Video-Skript',"window.open('video-skript-01.html?cb='+Date.now(),'_blank')")
      /* 🔴 06.09.2026, Ralph (#580): „ich will die liste im dashboard haben und
         sehen, wenn riki etwas ergaenzt." Marken-Domain-Liste als eigene Seite
         wie steuerung.html — eigenes Fenster mit Cache-Buster. Sie fuettert den
         Skript-Abruf mit Adressen; ohne Adresse holt er nichts. RIKI darf eine
         Domain vorschlagen, belegt wird sie erst durch einen Zutatentext. */
      +_an('markendomain','🌐','Marken-Domains',"window.open('marken-domains.html?cb='+Date.now(),'_blank')")
      +_an('werangelegt','👤','Wer hat angelegt',"admWerAngelegtOpen()")
      +_an('nutzer','👥','Nutzer',"adminGo('nutzer')");
    /* Menüplaketten aus bereits geladenen Dashboarddaten ableiten. */
    window.adminNavBadges=function(d){
      try{
        var setB=function(k,n){ var b=document.querySelector('#adminNav .anBtn[data-k="'+k+'"]'); if(!b) return;
          var e=b.querySelector('.anBdg');
          if(!e){ e=document.createElement('span'); e.className='anBdg'; b.appendChild(e); }
          if(n>0){ e.textContent=(n>99?'99+':n); e.style.display=''; } else e.style.display='none'; };
        setB('produkterfassung', Number((d&&d.qualitaet&&d.qualitaet.unverifiziert)||0));
      }catch(e){}
    };
    document.body.appendChild(nav);
    /* Der Pfeil-Chip holt das beim Scrollen ausgeblendete Menü zurück. */
    if(!document.getElementById('adminNavPeek')){
      var peek=document.createElement('div'); peek.id='adminNavPeek'; peek.title='Menü einblenden';
      peek.innerHTML='▾ Menü';
      peek.onclick=function(){ document.body.classList.remove('navHidden'); window._navPinned=true; };
      document.body.appendChild(peek);
    }
    /* Einklappknopf als erstes Nav-Kind halten; in der Oben-Lage blendet CSS ihn aus. */
    if(!document.getElementById('adminNavKlapp')){
      var kl=document.createElement('button'); kl.id='adminNavKlapp'; kl.type='button';
      kl.innerHTML='<span class="nkIco">☰</span><span class="nkTxt">Menü</span>';
      kl.onclick=function(){ adminNavSchmalSetzen(!document.body.classList.contains('navSchmal')); };
      nav.insertBefore(kl, nav.firstChild);
    }
  }
  /* matchMedia muss dieselbe 1100px-Grenze wie das CSS verwenden. */
  if(!window._adminNavSeiteBound){
    window._adminNavSeiteBound=true;
    var mq=(window.matchMedia?window.matchMedia('(min-width:1100px)'):null);
    /* Kopfcluster zwischen Body und Seitennavigation umhängen, niemals kopieren. */
    /* Schwarze Kopfleiste einmal anlegen; Sichtbarkeit steuert ausschließlich CSS. */
    var kopfleisteBauen=function(){
      if(document.getElementById('riKopf')) return;
      var k=document.createElement('div'); k.id='riKopf';
      /* 16.09.2026, Ralph: "versionsnummer mal richtig anzeigen" - die ganze
         Build-Nummer, nicht nur die letzte Ziffer (eine "2" sagt nichts). */
      var b=''; try{ if(typeof APP_BUILD!=='undefined'&&APP_BUILD){ b=String(APP_BUILD); } }catch(e){}
      k.innerHTML='<span class="riGi">▦</span>'
        +'<span class="riWm">ROOT<b>COCKPIT</b></span>'
        +'<span class="riR"><span>[ri!] root<b>index</b></span>'
        +(b?'<span id="riBuild" role="button" tabindex="0" '
            +'style="cursor:pointer;padding:1px 7px;border-radius:6px;font-weight:700" '
            +'title="Version '+esc(String(APP_BUILD))+' — wird gerade geprüft">'
            +esc(b)+'</span>':'')+'</span>';
      document.body.appendChild(k);

      /* ======================================================================
         AMPEL AN DER VERSIONSNUMMER  ·  Ralph-Auftrag 26.08.2026
         ----------------------------------------------------------------------
         „wenn ich deployed habe und noch nicht die neue version live ist, das
         die zahl rot ist und wenn sie aktuell ist das sie grün ist."

         Genau der Fall, der uns heute dreimal Zeit gekostet hat: ausgeliefert
         ist nicht gleich ausgeführt. Die Zahl oben rechts ist, was DIESES
         Fenster fährt (APP_BUILD). build.txt ist, was auf dem Server liegt.
         Sind sie gleich → grün. Sind sie verschieden → rot, und ein Klick lädt
         hart neu (adminNeuLaden leert Cache und Service-Worker).

         🔴 IMMER mit Cache-Buster abfragen. Ohne kam am 15.08. ein vier Stunden
         alter Stand zurück — dann prüft die Ampel sich selbst ins Grüne.
         ====================================================================== */
      var _riAmpel=async function(){
        var el=document.getElementById('riBuild'); if(!el) return;
        var lauf=''; try{ lauf=String(APP_BUILD||''); }catch(e){}
        if(!lauf) return;
        var liegt='';
        try{
          liegt=(await fetch('build.txt?cb='+Date.now(),{cache:'no-store'})
                  .then(function(r){ return r.ok?r.text():''; })).trim();
        }catch(e){ liegt=''; }
        if(!liegt){
          /* Nicht erreichbar heisst NICHT „aktuell". Grau und ehrlich (§1). */
          el.style.background='transparent'; el.style.color='#9aa7b4';
          el.title='Version '+lauf+' — Serverstand nicht abfragbar, Zustand unbekannt';
          return;
        }
        var aktuell=(liegt===lauf);
        el.style.background = aktuell ? 'rgba(46,160,90,.22)' : 'rgba(214,60,48,.30)';
        el.style.color      = aktuell ? '#7ee2a8' : '#ff9d93';
        el.title = aktuell
          ? 'Aktuell: dieses Fenster fährt '+lauf+', und genau das liegt auf dem Server.'
          : 'VERALTET: dieses Fenster fährt '+lauf+', auf dem Server liegt '+liegt
            +'. Klick lädt hart neu.';
        el.onclick=function(){
          if(aktuell){ location.reload(); return; }
          try{ if(typeof adminNeuLaden==='function'){ adminNeuLaden(el); return; } }catch(e){}
          location.reload();
        };
        el.onkeydown=function(ev){ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); el.onclick(); } };
      };
      _riAmpel();
      /* Alle 60 s nachsehen: dann wird die Zahl kurz nach Ralphs Deploy von
         selbst rot, ohne dass er etwas anklicken muss. */
      try{ setInterval(_riAmpel, 60000); }catch(e){}
    };
    kopfleisteBauen();

    var clusterUmhaengen=function(anSeite){
      var t=document.getElementById('adminTop'), nav=document.getElementById('adminNav');
      if(!t) return;
      if(anSeite && nav){ if(t.parentNode!==nav) nav.appendChild(t); }
      else if(t.parentNode!==document.body) document.body.appendChild(t);
    };
    var setzen=function(an){
      document.body.classList.toggle('navSeite', !!an);
      clusterUmhaengen(!!an);
      if(an){
        /* navHidden beim Wechsel in die Seitenlage ausdrücklich lösen. */
        document.body.classList.remove('navHidden'); window._navPinned=false;
        var s=false; try{ s=(localStorage.getItem('ri_navSchmal')==='1'); }catch(e){}
        document.body.classList.toggle('navSchmal', s);
      } else {
        /* navSchmal gilt nur in Seitenlage; der gespeicherte Wert bleibt erhalten. */
        document.body.classList.remove('navSchmal');
      }
    };
    if(mq){
      setzen(mq.matches);
      if(mq.addEventListener) mq.addEventListener('change', function(e){ setzen(e.matches); });
      else if(mq.addListener) mq.addListener(function(e){ setzen(e.matches); });
    }
    window._adminClusterUmhaengen=clusterUmhaengen;
  }
  /* Bei jedem Durchlauf nachhängen, weil die responsive Bindung nur einmal entsteht. */
  try{ if(window._adminClusterUmhaengen)
         window._adminClusterUmhaengen(document.body.classList.contains('navSeite')); }
  catch(e){ try{ console.warn('Knopf-Cluster:',e); }catch(_){} }
  /* Scroll-Verhalten (nur einmal binden): runterscrollen blendet das Nav aus,
     ganz oben kommt es von selbst zurück, dazwischen holt es der Pfeil-Chip. */
  if(!window._adminNavScrollBound){
    window._adminNavScrollBound=true; window._navLastY=0;
    window.addEventListener('scroll', function(){
      /* Die feste Seitenleiste darf beim Scrollen nicht ausgeblendet werden. */
      if(document.body.classList.contains('navSeite')) return;
      var y=window.scrollY||document.documentElement.scrollTop||0;
      if(y<=36){ document.body.classList.remove('navHidden'); window._navPinned=false; }
      else if(y>90 && y>window._navLastY+4 && !window._navPinned){ document.body.classList.add('navHidden'); }
      window._navLastY=y;
    }, {passive:true});
  }
  /* Feature-Sichtbarkeit nach jedem Aufbau mit dem aktuellen Zustand abgleichen. */
  try{ var _ar=document.getElementById('amRegelwerk'); if(_ar) _ar.style.display=(FEATURES['regelwerk']===true?'':'none'); }catch(e){}
  /* Auth-Ereignisse dürfen die Startnavigation nur einmal auslösen. */
  if(ADMIN_START_DONE) return;
  if(ME&&ME.is_admin){ ADMIN_START_DONE=true; setMode('freigabe'); }
  else { openAdminLogin(); }
}

function adminNavSchmalSetzen(schmal){
  try{ document.body.classList.toggle('navSchmal', !!schmal); }catch(e){ return; }
  try{ localStorage.setItem('ri_navSchmal', schmal?'1':'0'); }catch(e){}
  var k=document.getElementById('adminNavKlapp');
  if(k) k.title = schmal ? 'Menü ausklappen' : 'Menü einklappen';
}
if(typeof window!=='undefined'){ window.adminNavSchmalSetzen=adminNavSchmalSetzen; }

function adminDrawerToggle(){ var d=document.getElementById('adminDrawer'),s=document.getElementById('adminScrim'); if(!d)return; var open=d.classList.toggle('open'); if(s)s.classList.toggle('open',open); }

function adminDrawerClose(){ var d=document.getElementById('adminDrawer'),s=document.getElementById('adminScrim'); if(d)d.classList.remove('open'); if(s)s.classList.remove('open'); }
if(typeof window!=='undefined'){ window.adminDrawerToggle=adminDrawerToggle; window.adminDrawerClose=adminDrawerClose; }

function adminGo(k){
  /* 🔴 22.08.2026, Work #199: 'kontakt' fehlte hier. fgTab kennt das Panel
     (kontakt:'fgPanelKontakt'), adminGo aber nicht — es fiel in den else-Zweig
     und rief navTo('kontakt'), eine Seite, die es nicht gibt. Aufgefallen beim
     Anschliessen des Drills: 21 Produktwuensche warten, die Ansicht dafuer gibt
     es seit Langem, nur der Weg dorthin ging ins Leere. */
  const fg={dash:1,scans:1,bundles:1,rezepte:1,empfehlungen:1,zuverif:1,regelwerk:1,produkterfassung:1,kontakt:1};
  if(k==='stamm'){ try{ navTo('freigabe'); }catch(e){} try{ fgTab('stamm'); }catch(e){} return; }
  if(fg[k]){ try{ navTo('freigabe'); }catch(e){} try{ fgTab(k); }catch(e){} }
  else { try{ navTo(k); }catch(e){} }
  try{ document.querySelectorAll('#adminNav .anBtn').forEach(b=>{ b.classList.toggle('active', b.getAttribute('data-k')===k); }); }catch(e){}
  try{ var cr=document.getElementById('adminCrumb'); if(cr) cr.textContent=AD_TITLES[k]||''; }catch(e){}
  try{ document.body.classList.toggle('peLightBg', k==='produkterfassung'); }catch(e){}
  /* Freigabeleiste beim Bereichswechsel schließen; der Editor öffnet sie bei Bedarf neu. */
  try{ feFreigabeLeisteHide(); }catch(e){}
  try{ adminDrawerClose(); }catch(e){}
}
if(typeof window!=='undefined') window.adminGo=adminGo;
