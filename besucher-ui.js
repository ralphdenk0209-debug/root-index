/* ============================================================================
   BESUCHER-KARTE IM ADMIN (Ralph 21.09.2026: "zähler im admin anzeigen")
   ----------------------------------------------------------------------------
   Zeigt, was cb_seite_zaehlen seit dem 21.09. zaehlt: Aufrufe der
   Produktseiten und der App je Tag, woher die Besucher kommen und welche
   Produktseiten am meisten aufgerufen werden.
   Die Zahlen sind Tagessummen ohne Cookie und ohne Kennung - ein Besucher,
   der zwei Seiten liest, zaehlt zweimal. Das steht so auch in der Karte,
   damit niemand "Aufrufe" fuer "Menschen" haelt.
   Datenquelle: cb_admin_besucher (nur Admins). Keine Zahl im Code.
   Die Karte sitzt VOR #fgDash, nicht darin: loadDashboard() schreibt #fgDash
   bei jedem Laden neu und wuerde sie sonst jedes Mal wieder loeschen.
   ============================================================================ */
(function(){
  var TAGE = 14, geladen = false;
  var F = { produkt:'#2e7d46', app:'#6a4ac7', sonst:'#9aa1ab', ink:'#131a24', mut:'#6b7480', line:'#e6e9ee' };
  var QUELLE = { google:'Google', bing:'Bing', 'andere-suche':'andere Suche', direkt:'direkt eingetippt', intern:'innerhalb der Seite', andere:'über Links' };

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function zahl(n){ return Number(n||0).toLocaleString('de-DE'); }

  function box(){
    var b=document.getElementById('besucherKarte'); if(b) return b;
    var dash=document.getElementById('fgDash'); if(!dash||!dash.parentNode) return null;
    b=document.createElement('div'); b.id='besucherKarte';
    b.style.cssText='background:#fff;border:1px solid '+F.line+';border-radius:14px;padding:14px 16px;margin:0 0 14px;color:'+F.ink+';font-size:14px;line-height:1.5';
    dash.parentNode.insertBefore(b, dash);
    return b;
  }

  // Balken als SVG mit fester Hoehe und gestreckter Breite, Beschriftung als
  // HTML darunter - sonst waechst die Grafik auf breiten Bildschirmen mit der
  // Breite mit, und die Datumsangaben werden riesig (live gesehen 21.09.).
  function balken(tage){
    var w=100,h=100,n=tage.length||1;
    var max=Math.max(1,Math.max.apply(null,tage.map(function(t){return t.produkt+t.app+t.sonst;})));
    var bw=w/n, g=bw*.22;
    var s='<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" style="width:100%;height:96px;display:block" role="img" aria-label="Aufrufe je Tag">';
    tage.forEach(function(t,i){
      var x=i*bw+g/2, bb=bw-g, y=h;
      [['sonst',F.sonst],['app',F.app],['produkt',F.produkt]].forEach(function(k){
        var v=t[k[0]]||0; if(!v) return;
        var hh=v/max*(h-2); y-=hh;
        s+='<rect x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+bb.toFixed(2)+'" height="'+hh.toFixed(2)+'" fill="'+k[1]+'"><title>'+esc(t.tag)+': '+v+'</title></rect>';
      });
    });
    s+='</svg>';
    var d=function(t){ return t? String(t.tag).slice(8,10)+'.'+String(t.tag).slice(5,7) : ''; };
    s+='<div style="display:flex;justify-content:space-between;font-size:11px;color:'+F.mut+';margin-top:3px"><span>'+d(tage[0])+'</span><span>max. '+zahl(max)+' am Tag</span><span>'+d(tage[tage.length-1])+'</span></div>';
    return s;
  }

  function kachel(label, wert, sub){
    return '<div style="background:#f6f7f9;border-radius:10px;padding:8px 10px;min-width:0">'
      +'<div style="font-size:11.5px;color:'+F.mut+'">'+label+'</div>'
      +'<div style="font-size:19px;font-weight:800">'+wert+'</div>'
      +(sub?'<div style="font-size:11px;color:'+F.mut+'">'+sub+'</div>':'')+'</div>';
  }

  function zeichnen(d){
    var b=box(); if(!b) return;
    var tage=d.nach_tag||[], q=d.nach_quelle||{};
    var prod=tage.reduce(function(a,t){return a+t.produkt;},0), app=tage.reduce(function(a,t){return a+t.app;},0);
    var qListe=Object.keys(q).sort(function(a,c){return q[c]-q[a];})
      .map(function(k){ return '<span style="white-space:nowrap">'+esc(QUELLE[k]||k)+' <b>'+zahl(q[k])+'</b></span>'; }).join(' · ');
    var top=(d.top_seiten||[]).slice(0,5).map(function(t){
      var name=String(t.seite).replace(/^\/produkt\//,'').replace(/-p\d+\.html$/,'').replace(/-/g,' ');
      return '<a href="'+esc(t.seite)+'" target="_blank" rel="noopener" style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid '+F.line+';color:'+F.ink+';text-decoration:none"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(name)+'</span><b>'+zahl(t.anzahl)+'</b></a>';
    }).join('');
    var um=[7,14,30].map(function(t){
      return '<button data-t="'+t+'" style="background:'+(t===TAGE?F.ink:'#fff')+';color:'+(t===TAGE?'#fff':F.mut)+';border:0;font-size:12px;font-weight:700;padding:5px 11px;cursor:pointer">'+t+' Tage</button>';
    }).join('');
    b.innerHTML=
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
      +'<b style="font-size:17px">👥 Besucher</b>'
      +'<span style="display:inline-flex;border:1px solid '+F.line+';border-radius:9px;overflow:hidden;margin-left:auto">'+um+'</span></div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:10px">'
      + kachel('Heute', zahl(d.heute))
      + kachel('Letzte '+d.tage+' Tage', zahl(d.summe))
      + kachel('davon aus Google', zahl(q.google||0), d.summe? Math.round((q.google||0)/d.summe*100)+' %':'')
      + kachel('Produktseiten / App', zahl(prod)+' / '+zahl(app))
      +'</div>'
      + balken(tage)
      +'<div style="font-size:11.5px;color:'+F.mut+';margin:4px 0 10px">'
      +'<span style="color:'+F.produkt+'">■</span> Produktseiten &nbsp; <span style="color:'+F.app+'">■</span> App &nbsp; <span style="color:'+F.sonst+'">■</span> Startseite</div>'
      +(qListe?'<div style="font-size:12.5px;margin-bottom:10px"><span style="color:'+F.mut+'">Woher: </span>'+qListe+'</div>':'')
      +(top?'<div style="font-size:12.5px"><div style="color:'+F.mut+';margin-bottom:2px">Meistgelesene Produktseiten</div>'+top+'</div>':'')
      +'<div style="font-size:11px;color:'+F.mut+';margin-top:10px">Aufrufe, nicht Personen: wer zwei Seiten liest, zählt zweimal. Gezählt seit 21.09.2026, ohne Cookies, ohne Kennung, Suchmaschinen-Robots ausgenommen.</div>';
    b.querySelectorAll('button[data-t]').forEach(function(btn){
      btn.onclick=function(){ TAGE=+btn.getAttribute('data-t'); laden(); };
    });
  }

  function fehler(msg){
    var b=box(); if(!b) return;
    b.innerHTML='<b>👥 Besucher</b><div style="color:#dc3a3a;font-size:12.5px;margin-top:6px">Zahlen nicht abrufbar: '+esc(msg)+'</div>';
  }

  function laden(){
    if(typeof client==='undefined' || !client || !client.rpc) return;
    client.rpc('cb_admin_besucher',{p_tage:TAGE}).then(function(r){
      if(r.error){ fehler(r.error.message); return; }
      geladen=true; zeichnen(r.data||{});
    }, function(e){ fehler(e&&e.message||String(e)); });
  }

  // Warten, bis App-Client, Anmeldung und das Dashboard da sind - dann einmal
  // laden und alle fuenf Minuten nachziehen.
  var versuche=0, t=setInterval(function(){
    versuche++;
    var istAdmin = typeof ME!=='undefined' && ME && ME.is_admin;
    if(istAdmin && document.getElementById('fgDash') && typeof client!=='undefined'){
      clearInterval(t); laden(); setInterval(laden, 5*60*1000);
    } else if(versuche>150){ clearInterval(t); }
  }, 400);
})();
