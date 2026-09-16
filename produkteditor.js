
function _istAroma(name){ return /(aroma|aromen|aromastoff)/i.test(String(name||"")); }
/* Farbe/Etikett je EFSA-Einstufung: grün unbedenklich · rot abgewertet · grau ungeprüft. */
function zusFarbe(einst){
  var e=String(einst||"").toLowerCase();
  if(e==="neutral"||e==="keine"||e==="unbedenklich") return {dot:"#2e9e57",bg:"#e7f6ec",txt:"#1f7d43",label:"unbedenklich"};
  if(e==="abgewertet"||e==="kritisch")               return {dot:"#c0392b",bg:"#fde8e8",txt:"#8a1c14",label:"abgewertet"};
  return {dot:"#9aa7b2",bg:"#eef1f4",txt:"#5b6b7e",label:"ungeprüft"};
}
function _zusNorm(s){
  return String(s||"").toLowerCase()
    .replace(/\([^)]*\)/g," ")
    .replace(/\u00df/g,"ss")
    .replace(/[\u00e4\u00e0\u00e1\u00e2\u00e3]/g,"a").replace(/[\u00f6\u00f2\u00f3\u00f4]/g,"o")
    .replace(/[\u00fc\u00f9\u00fa\u00fb]/g,"u").replace(/[\u00e9\u00e8\u00ea\u00eb]/g,"e")
    .replace(/ae/g,"a").replace(/oe/g,"o").replace(/ue/g,"u")    
    .replace(/[^a-z0-9]/g,"");
}
function _zusNormMap(){
  var n=(ZUSATZSTOFFE_STAMM||[]).length;
  if(window.__zusNormMap && window.__zusNormMapN===n) return window.__zusNormMap;
  var m={}, m2={};
  (ZUSATZSTOFFE_STAMM||[]).forEach(function(z){
    [z.name,z.name_de].forEach(function(nn){
      var k=_zusNorm(nn); if(!k||k.length<4) return;
      if(!m[k]) m[k]=[];
      if(m[k].indexOf(z)<0) m[k].push(z);
      var k2=k.replace(/e$/,"");                 /* Plural -> Singular */
      if(k2.length>=4){ if(!m2[k2]) m2[k2]=[]; if(m2[k2].indexOf(z)<0) m2[k2].push(z); }
    });
  });
  window.__zusNormMap=m; window.__zusNormMap2=m2; window.__zusNormMapN=n; return m;
}
function _zusFindStamm(nm){
  var ec=String(nm||"").match(/\bE\s?(\d{3,4}[a-z]?(?:i{1,3}|iv)?)\b/i);    
  if(ec && typeof ZUSATZSTOFFE_MAP!=="undefined"){
    var _voll="e"+ec[1].replace(/\s/g,"").toLowerCase();
    if(ZUSATZSTOFFE_MAP[_voll]) return ZUSATZSTOFFE_MAP[_voll];
    var _haupt=_voll.replace(/(i{1,3}|iv)$/,"");
    if(_haupt!==_voll && ZUSATZSTOFFE_MAP[_haupt]) return ZUSATZSTOFFE_MAP[_haupt];
  }
  var k=_zusNorm(nm); if(!k||k.length<4) return null;
  var hit=_zusNormMap()[k];
  if(hit&&hit.length===1) return hit[0];        /* exakter Treffer hat Vorrang */
  if(hit&&hit.length>1)   return null;          /* mehrdeutig bleibt mehrdeutig */
  var hit2=(window.__zusNormMap2||{})[k.replace(/e$/,"")];
  return (hit2&&hit2.length===1)?hit2[0]:null;  /* nur EINDEUTIG, sonst kein Treffer */
}
/* deutscher Anzeigename eines ausgewaehlten Zusatzstoffs (Stamm-name_de, sonst ZUS_SYN, sonst gespeichert) */
function _zusDe(z){
  if(!z) return "";
  try{ _zusSynMaps(); }catch(e){}
  var k=String(z.e||"").toLowerCase();
  var st=(typeof ZUSATZSTOFFE_MAP!=="undefined")?ZUSATZSTOFFE_MAP[k]:null;
  return (st&&st.name_de)||(window.__zusSynDe&&window.__zusSynDe[k])||z.name||"";
}
/* Rohtext des Zusatzstoff-Felds in Einzel-Zusatzstoffe zerlegen und gegen den Stamm auflösen. */
function _zusSplitTop(t){
  var out=[], cur="", depth=0;
  for(var i=0;i<t.length;i++){ var c=t.charAt(i);
    if(c==='('||c==='['){ depth++; cur+=c; }
    else if(c===')'||c===']'){ if(depth>0) depth--; cur+=c; }
    else if((c===','||c===';') && depth===0){ if(cur.trim()) out.push(cur.trim()); cur=""; }
    else cur+=c; }
  if(cur.trim()) out.push(cur.trim());
  return out;
}
function _zusOhneFunktionswort(nm){
  var t=String(nm||"").replace(/\([^)]*\)/g," ").replace(/^als\s+/i,"").replace(/[:.,;]/g," ").replace(/\s+/g," ").trim().toLowerCase();
  if(typeof ZUS_FUNKTION==="undefined") return t;
  var w=t.split(" ");
  while(w.length>1 && ZUS_FUNKTION[w[0]]) w.shift();
  return w.join(" ");
}
function _zusIstLeer(nm){ nm=String(nm||"").trim().toLowerCase(); if(!nm || /^keine\b/.test(nm) || /^(k\.?\s?a\.?|n\/a|-|\u2013|nicht deklariert|nicht angegeben|entfaellt)$/.test(nm)) return true; if(/^\(?(i{1,3}|iv|vi{0,3}|ix|x{1,3})\)?$/.test(nm)) return true;    
  if(/^natrium($|[^a-zäöüß])/.test(nm)) return true;
  if(/^(kalium|calcium|kalzium|magnesium|eisen|zink|jod|jodid|selen|fluorid|chlorid|phosphor|kupfer|mangan|molybdaen|chrom)[^a-zäöüß]*(<|>|\d)[\d.,]*\s*(mg|µg|mcg|g|%)/.test(nm)) return true;
  var np=nm.replace(/\([^)]*\)/g,"").replace(/^als\s+/,"").replace(/[:.]/g,"").replace(/\s+/g," ").trim(); return (typeof ZUS_FUNKTION!=="undefined" && !!ZUS_FUNKTION[np]); }
function zusSeed(text){
  window._fgZus=[];
  window._fgZusKeine = (function(){ var t=String(text||"").trim(); return !!t && _zusIstLeer(t); })();
  var t=String(text||"").trim();
  if(!t || _zusIstLeer(t)) return;
  var seen={};
  var push=function(tok){
    tok=String(tok||"").replace(/\s+/g," ").trim(); if(!tok) return;
    if(_zusIstLeer(tok)) return;   /* Phantom-„keine" gar nicht erst anlegen */
    var low=tok.toLowerCase();
    if(/keine zusatzstoffe|nicht erkannt|wird mit\s*\d+\s*zutaten|das produkt wird/i.test(low)) return;
    /* Aroma bleibt EIN Eintrag – die Klammer sind Geschmacksangaben, keine Zusatzstoffe. */
    if(_istAroma(tok)){ var ka='n:'+low; if(seen[ka]) return; seen[ka]=1; window._fgZus.push({e:null,name:tok,einst:"neutral"}); return; }
    /* Funktionswort + Klammer mit MEHREREN Stoffen, z.B. „Antioxidans (Rosmarinextrakt, Tocopherole)"
       → in die Einzelstoffe aufteilen (das Funktionswort selbst ist keine Substanz). */
    var pm=tok.match(/^([^()]*)\(([^)]*)\)\s*$/);
    if(pm){
      var outer=pm[1].replace(/[:.]\s*$/,"").trim().toLowerCase();
      if(typeof ZUS_FUNKTION!=="undefined" && ZUS_FUNKTION[outer] && pm[2].indexOf(",")>=0){ pm[2].split(",").forEach(push); return; }
    }
    var em=tok.match(/\bE\s?\d{3,4}[a-z]?\b/i);
    var found=em?ZUSATZSTOFFE_MAP[em[0].replace(/\s/g,"").toLowerCase()]:null;
    /* Klammern weg + führendes „Funktionswort:" abtrennen (z.B. „Antioxidationsmittel: Extrakt aus Rosmarin"). */
    var nm=tok.replace(/\([^)]*\)/g,"").replace(/^([a-zäöüß][a-zäöüß\s]*?):\s*/i,function(m,w){ return (typeof ZUS_FUNKTION!=="undefined"&&ZUS_FUNKTION[w.trim().toLowerCase()])?"":m; }).replace(/\s+/g," ").trim().toLowerCase();
    if(!found) found=ZUSATZSTOFFE_MAP[nm];
    if(!found && typeof ZUS_SYN!=="undefined" && ZUS_SYN[nm]) found=ZUSATZSTOFFE_MAP[String(ZUS_SYN[nm]).toLowerCase()];
    if(!found){ var _in=(tok.match(/\(([^)]*)\)/)||[])[1]; if(_in){ var il=_in.trim().toLowerCase(); var iem=_in.match(/\bE\s?\d{3,4}[a-z]?\b/i);
      found=(iem?ZUSATZSTOFFE_MAP[iem[0].replace(/\s/g,"").toLowerCase()]:null) || ZUSATZSTOFFE_MAP[il] || ((typeof ZUS_SYN!=="undefined"&&ZUS_SYN[il])?ZUSATZSTOFFE_MAP[String(ZUS_SYN[il]).toLowerCase()]:null); } }
    if(!found) found=_zusFindStamm(nm);    
    /* Funktionswort davor abstreifen: „Trennmittel Natriumferrocyanid" -> E535, statt zweiter Geister-Eintrag */
    if(!found){ var _o=_zusOhneFunktionswort(tok);
      if(_o && _o!==nm){ found=ZUSATZSTOFFE_MAP[_o] || ((typeof ZUS_SYN!=="undefined"&&ZUS_SYN[_o])?ZUSATZSTOFFE_MAP[String(ZUS_SYN[_o]).toLowerCase()]:null) || _zusFindStamm(_o); } }
    var key = found ? ('e:'+String(found.e).toLowerCase()) : ('n:'+(nm||low));
    if(seen[key]) return; seen[key]=1;
    if(found) window._fgZus.push({e:found.e,name:found.name,einst:found.einstufung});
    else window._fgZus.push({e:null,name:tok,einst:(_istAroma(tok)?"neutral":"ungeprüft"),nf:(_istAroma(tok)?0:1)});
  };
  _zusSplitTop(t).forEach(push);
}
/* Auswahl → verstecktes fe_ztext (Speicher-Wahrheit) + abgeleiteter fe_zstatus. */
function zusSync(){
  var sel=window._fgZus||[];
  var ztext=document.getElementById("fe_ztext"), zstat=document.getElementById("fe_zstatus");
  if(!sel.length){
    var _bewusst = !!window._fgZusKeine;
    if(ztext) ztext.value = _bewusst ? "keine" : "";
    if(zstat) zstat.value = _bewusst ? "keine" : "";
  }
  else{
    if(ztext) ztext.value=sel.map(function(z){ return (_zusDe(z)||z.name)+(z.e?(" ("+z.e+")"):""); }).join(", ");
    var allNeutral=sel.every(function(z){ return /^(neutral|keine|unbedenklich)$/i.test(String(z.einst||"")); });
    if(zstat) zstat.value = allNeutral ? "neutral" : "enthalten";
  }
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  try{ if(typeof fgEnthaltenRender==="function") fgEnthaltenRender(); }catch(e){}   /* Referenz aktualisieren: als Zusatzstoff erfasste Stoffe werden dort grün */
}
/* zusRenderSel: eigener Auswahl-Kasten entfällt – die Auswahl steht (wie beim Zutaten-Picker)
   angehakt OBEN in derselben Liste. Diese Funktion synchronisiert nur noch das „Keine
   Zusatzstoffe"-Häkchen und zeichnet die Liste neu, damit alle alten Aufrufstellen weiter gelten. */
function zusRenderSel(){
  var kc=document.getElementById("fe_zusKeine"); if(kc) kc.checked=!!window._fgZusKeine;    
  var box=document.getElementById("fe_zusChosen");
  try{ _zusSynMaps(); }catch(e){}
  if(box){
    var arr=window._fgZus||[];
    box.innerHTML = arr.length ? arr.map(function(z,i){
      var f=zusFarbe(z.einst||z.einstufung);
      return '<div style="display:grid;grid-template-columns:12px 1fr auto 22px;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);font-size:13px"><span style="width:9px;height:9px;border-radius:50%;background:'+f.dot+'"></span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(_zusDe(z)||z.name)+(z.e?' <span style="color:var(--muted);font-size:11.5px">'+esc(z.e)+'</span>':'')+'</span><span style="font-size:11px;color:var(--muted);white-space:nowrap">'+(z.nf?"nicht im Stamm":f.label)+'</span><button type="button" onclick="zusDel('+i+')" title="entfernen" style="border:0;background:transparent;color:var(--k-dc2626);cursor:pointer;font-size:15px;line-height:1;padding:0">✕</button></div>';
    }).join('') : '<div style="padding:9px;color:var(--muted);font-size:12.5px">noch keine – über „+ Zusatzstoff“ hinzufügen (oder „keine“ anhaken)</div>';
  }
  zusRenderPick();
}
function _zusCap(s){ s=String(s||""); return s.charAt(0).toUpperCase()+s.slice(1); }
function _zusSynMaps(){ if(window.__zusSynDe) return; var m={}, all={}; if(typeof ZUS_SYN!=="undefined"){ for(var k in ZUS_SYN){ if(!ZUS_SYN.hasOwnProperty(k)) continue; var e=String(ZUS_SYN[k]).toLowerCase(); if(!m[e]) m[e]=k; (all[e]=all[e]||[]).push(k); } } window.__zusSynDe=m; window.__zusSynDeAll=all; }
function zusRenderPick(){
  var box=document.getElementById("fe_zusList"); if(!box) return;
  var kc=document.getElementById("fe_zusKeine"); if(kc) kc.checked=!!window._fgZusKeine;    
  var q=((document.getElementById("fe_zusSuche")||{}).value||"").trim().toLowerCase();
  var selE={}; (window._fgZus||[]).forEach(function(z){ if(z.e) selE[String(z.e).toLowerCase()]=1; });
  var all=(ZUSATZSTOFFE_STAMM||[]);
  _zusSynMaps(); var _synDe=window.__zusSynDe||{}, _synAll=window.__zusSynDeAll||{};   /* deutsche Namen (Anzeige+Suche) */
  var isSel=function(z){ return !!selE[String(z.e||"").toLowerCase()]; };
  var checked=all.filter(isSel), rest=all.filter(function(z){ return !isSel(z); });
  if(q){ var mm=function(z){ var _e=String(z.e||"").toLowerCase(); return _e.indexOf(q)>=0 || String(z.name||"").toLowerCase().indexOf(q)>=0 || String(z.name_de||"").toLowerCase().indexOf(q)>=0 || (_synAll[_e]||[]).join(" ").indexOf(q)>=0; }; checked=checked.filter(mm); rest=rest.filter(mm); }
  /* 28d (Mockup A): ohne Suchtext nur die ERFASSTEN Zusatzstoffe - nicht alle 518 E-Nummern. */
  var shown = q ? checked.concat(rest) : checked;
  var zusHintRow = q ? "" : '<div style="padding:8px;color:var(--muted);font-size:11.5px;text-align:center;border-top:1px dashed var(--line)">\ud83d\udd0e Tippen durchsucht alle '+all.length+' E-Nummern (deutsch/englisch/E-Nr.)</div>';
  var row=function(z){ var on=isSel(z); var f=zusFarbe(z.einstufung);
    /* 27y: bei ERFASSTEN Stoffen zusaetzlich den Verarbeitungswert der (automatisch gebundenen)
       Stamm-Zutat zeigen - beide Achsen an EINER Zeile lesbar (Prinzip 8, "1x anzeigen"). */
    var wertTxt='';
    if(on){ try{ var it=_fgZutZusIndex()[String(z.e||'').toUpperCase()]; if(it&&it.rating!=null) wertTxt=' <span style="color:var(--k-166534);font-weight:700;font-size:11px" title="Verarbeitungswert auf der Zutaten-Achse (automatisch gebunden)">· Wert '+it.rating+'</span>'; }catch(e){} }
    return '<label style="display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);cursor:pointer;'+(on?"background:var(--greenlt,#eef7f0)":"")+'">'
      +'<input type="checkbox" '+(on?"checked":"")+' onchange="zusToggle(\''+esc(z.e)+'\')" style="width:16px;height:16px;accent-color:var(--k-16a34a)">'
      +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">'+(function(){ var _de=z.name_de||_synDe[String(z.e||"").toLowerCase()]||z.name; return (_de&&_de!==z.name)?(esc(_de)+' <span style="color:var(--muted);font-size:11px">'+esc(z.name)+'</span>'):esc(z.name); })()+(z.e?' <span style="color:var(--muted);font-size:11.5px">'+esc(z.e)+'</span>':'')+wertTxt+'</span>'
      +'<span style="display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:11.5px;color:var(--muted)"><span style="width:9px;height:9px;border-radius:50%;background:'+f.dot+';flex:0 0 auto"></span>'+f.label+'</span>'
      +'</label>'; };
  var _freie=(window._fgZus||[]).map(function(z,i){ return {z:z,i:i}; }).filter(function(o){ return !o.z.e; });
  var _freiRows=_freie.map(function(o){ var z=o.z; var f=zusFarbe(z.einst||z.einstufung);
    /* 14.09.2026: Auch dieses Schild darf die Seite nicht selbst vergeben. Wenn der
       Server den Wortlaut aufgeloest hat (er steht nicht in unresolved_candidates),
       ist "nicht im Stamm" falsch - so entstand die Anzeige bei P73725 fuer
       "Emulgator Sonnenblumenlecithin". Ohne Serverantwort bleibt es beim Alten. */
    var _lbl=z.nf?'nicht im Stamm \u00b7 kein Index':(((z.einst||z.einstufung))?f.label:'nicht eingestuft \u00b7 kein Index');
    try{
      var _d=window._fgZusV2;
      if(_d && Array.isArray(_d.items)){
        var _offenTexte={};
        (Array.isArray(_d.unresolved_candidates)?_d.unresolved_candidates:[]).forEach(function(c){
          _offenTexte[String(c.text||'').trim().toLowerCase()]=1; });
        if(!_offenTexte[String(z.name||'').trim().toLowerCase()]) _lbl='vom Server erkannt';
      }
    }catch(e){}
    return '<div style="display:grid;grid-template-columns:12px 1fr auto 22px;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);font-size:13px;background:#f1f4f8">'
      +'<span style="width:9px;height:9px;border-radius:50%;background:'+f.dot+';flex:0 0 auto"></span>'
      +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(z.name||'?')+'</span>'
      +'<span style="font-size:11px;color:#475569;white-space:nowrap;font-weight:700">'+_lbl+'</span>'
      +'<button type="button" onclick="zusDel('+o.i+')" title="entfernen" style="border:0;background:transparent;color:var(--k-dc2626);cursor:pointer;font-size:15px;line-height:1;padding:0">\u2715</button></div>';
  }).join('');
  var _st=box.scrollTop;
  box.innerHTML=_freiRows+((shown.length)?shown.map(row).join(""):(_freie.length?'':'<div style="padding:14px;color:var(--muted);font-size:12.5px;text-align:center">'+(q?"Kein Treffer.":((all.length?"Keine Zusatzstoffe erfasst \u2013 im Suchfeld tippen (oder \u201ekeine\u201c anhaken).":"Stamm wird geladen\u2026")))+'</div>')) + zusHintRow;
  try{ box.scrollTop=_st; }catch(e){}
}
function zusToggle(e){
  var key=String(e||"").toLowerCase(); var z=ZUSATZSTOFFE_MAP[key]; if(!z) return;
  window._fgZus=window._fgZus||[];
  var idx=window._fgZus.findIndex(function(x){ return String(x.e||"").toLowerCase()===key; });
  /* 27y: Zutaten-Achse automatisch mitziehen (Prinzip 8) - anhaken bindet die Stamm-Zutat,
     abhaken entfernt sie. Der Mensch pflegt EINE Stelle, der Code haelt beide Achsen synchron. */
  if(idx>=0){ var raus=window._fgZus.splice(idx,1)[0]; try{ fgZusZutSync(false, raus); }catch(e2){} }
  else { window._fgZus.push({e:z.e,name:z.name,einst:z.einstufung}); try{ fgZusZutSync(true, z); }catch(e2){} }
  zusSync(); zusRenderSel(); zusRenderPick();
}
function zusDel(i){ if(window._fgZus&&i>=0&&i<window._fgZus.length){ var raus=window._fgZus.splice(i,1)[0]; try{ fgZusZutSync(false, raus); }catch(e2){} zusSync(); zusRenderSel(); zusRenderPick(); } }
function zusKeineToggle(ck){ window._fgZusKeine=!!ck;    
  if(ck){ var alte=window._fgZus||[]; window._fgZus=[]; alte.forEach(function(z){ try{ fgZusZutSync(false, z); }catch(e2){} }); } zusSync(); zusRenderSel(); zusRenderPick(); }
function zusAddNeu(){
  var inp=document.getElementById("fe_zusNeu"); var v=((inp||{}).value||"").trim(); if(!v) return;
  var em=v.match(/\bE\s?\d{3,4}[a-z]?\b/i);
  var found=em?ZUSATZSTOFFE_MAP[em[0].replace(/\s/g,"").toLowerCase()]:ZUSATZSTOFFE_MAP[v.toLowerCase()];
  if(!found){ try{ found=_zusFindStamm(v); }catch(e){ found=null; } }    
  window._fgZus=window._fgZus||[];
  if(found){ window._fgZus.push({e:found.e,name:found.name,einst:found.einstufung}); try{ fgZusZutSync(true, found); }catch(e2){} }
  else {
    var _zm2=(typeof ZUTATEN_MAP!=='undefined'&&ZUTATEN_MAP)?ZUTATEN_MAP[v.toLowerCase()]:null;
    if(_zm2 && _zm2.rating!=null){ alert('„'+v+'“ ist als ZUTAT im Stamm (Wert '+_zm2.rating+') – bitte links in der Zutaten-Karte erfassen. Als freier Zusatzstoff würde der Eintrag den Index blockieren.'); if(inp) inp.value=""; return; }
    window._fgZus.push({e:null,name:v,einst:(_istAroma(v)?"neutral":"ungeprüft")});
  }
  if(inp) inp.value="";
  zusSync(); zusRenderSel(); zusRenderPick();
}
var ZUS_FUNKTION={"antioxidationsmittel":1,"antioxidans":1,"stabilisator":1,"stabilisatoren":1,"farbstoff":1,"farbstoffe":1,"säuerungsmittel":1,"saeuerungsmittel":1,"säureregulator":1,"saeureregulator":1,"konservierungsmittel":1,"konservierungsstoff":1,"emulgator":1,"emulgatoren":1,"verdickungsmittel":1,"geliermittel":1,"trennmittel":1,"süßungsmittel":1,"suessungsmittel":1,"süssungsmittel":1,"backtriebmittel":1,"trägerstoff":1,"traegerstoff":1,"feuchthaltemittel":1,"geschmacksverstärker":1,"geschmacksverstaerker":1,"aroma":1,"aromen":1,"überzugsmittel":1,"ueberzugsmittel":1,"festigungsmittel":1,"mehlbehandlungsmittel":1,"schaumverhüter":1,"komplexbildner":1,"packgas":1,"treibgas":1,"füllstoff":1,
  "emulsifier":1,"emulsifiers":1,"stabiliser":1,"stabilizer":1,"stabilisers":1,"stabilizers":1,"antioxidant":1,"antioxidants":1,"preservative":1,"preservatives":1,"colour":1,"color":1,"colours":1,"colors":1,"thickener":1,"thickeners":1,"acid":1,"acidity regulator":1,"anticaking agent":1,"anti-caking agent":1,"sweetener":1,"sweeteners":1,"raising agent":1,"humectant":1,"flavour enhancer":1,"flavor enhancer":1,"firming agent":1,"glazing agent":1,"carrier":1,"bulking agent":1,"propellant":1,"packaging gas":1,"foaming agent":1,"gelling agent":1,"flour treatment agent":1,"sequestrant":1,"modified starch":1,
  "konservierungsstoffe":1,"säureregulatoren":1,"saeureregulatoren":1,"säuerungsmittel":1,
  "antioxidantien":1,"trägerstoffe":1,"traegerstoffe":1,"füllstoffe":1,"fuellstoffe":1,
  "geliermittel":1,"verdickungsmittel":1,"festigungsmittel":1,"backtriebmittel":1,
  "feuchthaltemittel":1,"überzugsmittel":1,"ueberzugsmittel":1,"schaumverhüter":1,"schaumverhueter":1,
  "komplexbildner":1,"mehlbehandlungsmittel":1,"aromastoffe":1,"backtriebmittelmischung":1};
/* Häufige DEUTSCHE Zusatzstoff-Namen → E-Nummer (der Stamm führt englische Namen).
   Damit „Natriumnitrit" nicht als eigener grauer Eintrag neben „E250" landet. Erweiterbar. */
var ZUS_SYN={"e960a":"E960","essigsäure":"E260","essigsaeure":"E260","steviolglycoside":"E960","steviolglykoside":"E960","steviolglycosid":"E960","sucralose":"E955","acesulfam":"E950","acesulfam-k":"E950","acesulfam k":"E950","aspartam":"E951","saccharin":"E954","cyclamat":"E952","natriumnitrit":"E250","kaliumnitrit":"E249","natriumnitrat":"E251","kaliumnitrat":"E252","natriumascorbat":"E301","ascorbinsäure":"E300","ascorbinsaeure":"E300","citronensäure":"E330","citronensaeure":"E330","zitronensäure":"E330","natriumcitrat":"E331","rosmarinextrakt":"E392","extrakt aus rosmarin":"E392","carotin":"E160a","beta-carotin":"E160a","betacarotin":"E160a","alpha-carotin":"E160a","gamma-carotin":"E160a","carotine":"E160a","carotene":"E160a","alpha-carotene":"E160a","beta-carotene":"E160a","gamma-carotene":"E160a","lecithin":"E322","sojalecithin":"E322","lecithine":"E322","guarkernmehl":"E412","xanthan":"E415","carrageen":"E407","natriumcarbonat":"E500","diphosphate":"E450","triphosphate":"E451","polyphosphate":"E452","polyphosphates":"E452","natriumferrocyanid":"E535","kaliumferrocyanid":"E536","calciumferrocyanid":"E538","mononatriumglutamat":"E621","kaliumsorbat":"E202","natriumbenzoat":"E211","schwefeldioxid":"E220","tocopherol":"E306","tocopherole":"E306","gemischte tocopherole":"E306","natürliche gemischte tocopherole":"E306","natürliche tocopherole":"E306","alpha-tocopherol":"E307","calciumchlorid":"E509","pektin":"E440","natriumphosphat":"E339","kaliumphosphat":"E340"};
async function zusFromRiki(zObj){
  if(!zObj) return;
  try{ await loadZusatzstoffeStamm(); }catch(e){}
  var toks=[];
  if(Array.isArray(zObj.e_nummern)) zObj.e_nummern.forEach(function(e){ if(e) toks.push(String(e)); });
  if(zObj.text && !/^\s*keine\s*$/i.test(String(zObj.text))){
    /* Klammern zu Kommata (löst „Antioxidationsmittel (Extrakt aus Rosmarin, Natriumascorbat)"
       sauber in einzelne Einträge auf, statt am Komma in der Klammer zu zerbrechen). */
    String(zObj.text).replace(/[()\[\]]/g,",").split(/[,;]/).forEach(function(t){ t=t.trim(); if(t) toks.push(t); });
  }
  if(!toks.length){ if(zObj.suessstoffe){ var su0=document.getElementById("fe_suess"); if(su0&&su0.value==="nein") su0.value="ja"; } return; }
  window._fgZus=window._fgZus||[];
  var hasKey=function(k){ return window._fgZus.some(function(x){ return String(x.e||x.name||"").toLowerCase()===String(k).toLowerCase(); }); };
  toks.forEach(function(tok){
    tok=String(tok||"").replace(/\s+/g," ").trim(); if(!tok) return;
    if(_zusIstLeer(tok)) return;   /* Phantom-„keine" gar nicht erst anlegen */
    /* nackter Name ohne Klammer/E-Nummer für Funktionswort-Test + Synonym-Lookup */
    var namePur=tok.replace(/\bE\s?\d{3,4}[a-z]?\b/ig,"").replace(/[().]/g,"").replace(/\s+/g," ").trim();
    var low=namePur.toLowerCase();
    if(!low || ZUS_FUNKTION[low]) return;                 /* reines Funktionswort → weglassen */
    /* E-Nummer bestimmen: direkt im Token, sonst über die Synonym-Tabelle. */
    var em=tok.match(/\bE\s?\d{3,4}[a-z]?\b/i);
    var eNr=em?em[0].replace(/\s/g,"").toUpperCase():(ZUS_SYN[low]||null);
    var found=eNr?ZUSATZSTOFFE_MAP[eNr.toLowerCase()]:ZUSATZSTOFFE_MAP[low];
    if(!found) found=_zusFindStamm(namePur);    
    if(!found){ var _o2=_zusOhneFunktionswort(tok);
      if(_o2 && _o2!==low){ found=ZUSATZSTOFFE_MAP[_o2] || ((typeof ZUS_SYN!=="undefined"&&ZUS_SYN[_o2])?ZUSATZSTOFFE_MAP[String(ZUS_SYN[_o2]).toLowerCase()]:null) || _zusFindStamm(_o2);
        if(found && !eNr) eNr=String(found.e||"").toUpperCase()||null; } }
    if(!found && !eNr) eNr=null;
    var dedup=(eNr||low);
    if(hasKey(eNr||"")||hasKey(low)||(found&&hasKey(String(found.e||"")))) return;   /* schon drin */
    if(found){ window._fgZus.push({e:found.e,name:found.name,einst:found.einstufung}); try{ fgZusZutSync(true, found); }catch(e2){} }   /* 27y: Zutaten-Achse mitziehen (Prinzip 8) */
    else {
      var _zm=(typeof ZUTATEN_MAP!=='undefined'&&ZUTATEN_MAP)?ZUTATEN_MAP[low]:null;
      if(_zm && _zm.rating!=null) return;
      window._fgZus.push({e:eNr,name:namePur,einst:(_istAroma(namePur)?"neutral":"ungeprüft"),nf:(_istAroma(namePur)?0:1)});   /* nf=1: gar nicht im Stamm gefunden – anderer Zustand als „im Stamm, aber unbewertet" */
    }
  });
  if(zObj.suessstoffe){ var su=document.getElementById("fe_suess"); if(su&&su.value==="nein") su.value="ja"; }
  try{ zusSync(); zusRenderSel(); zusRenderPick(); }catch(e){}
}
if(typeof window!=='undefined'){ window.zusToggle=zusToggle; window.zusDel=zusDel; window.zusKeineToggle=zusKeineToggle; window.zusAddNeu=zusAddNeu; window.zusRenderPick=zusRenderPick; }
function zusNeuKey(e){ if(e&&e.key==='Enter'){ e.preventDefault(); zusAddNeu(); } }
function zusModalOpen(){
  var si=document.getElementById('fe_zusSuche');
  if(si){ try{ si.focus(); si.scrollIntoView({block:'nearest'}); }catch(e){} }
  try{ zusRenderPick(); }catch(e){}
  return;
}
function zusModalClose(){ var ov=document.getElementById('fe_zusOv'); if(ov) ov.style.display='none'; }
if(typeof window!=='undefined'){ window.zusModalOpen=zusModalOpen; window.zusModalClose=zusModalClose; window.zusNeuKey=zusNeuKey; window.zusRenderSel=zusRenderSel; }
/* Welche E-Nummer steckt hinter einem Zutaten-Namen? (Klammer-E, Synonym, Katalog, Schreibvariante) */
function fgZutZusE(name){
  var low=String(name||'').toLowerCase().replace(/\s+/g,' ').trim(); if(!low) return null;
  var em=low.match(/\be\s?\d{3,4}[a-z]?\b/i);
  if(em) return em[0].replace(/\s/g,'').toUpperCase();
  var nm=low.replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim();
  if(typeof ZUS_SYN!=='undefined' && ZUS_SYN[nm]) return String(ZUS_SYN[nm]).toUpperCase();
  if(typeof ZUSATZSTOFFE_MAP!=='undefined' && ZUSATZSTOFFE_MAP && ZUSATZSTOFFE_MAP[nm]) return String(ZUSATZSTOFFE_MAP[nm].e||'').toUpperCase()||null;
  try{ var f=_zusFindStamm(nm); if(f) return String(f.e||'').toUpperCase()||null; }catch(e){}
  return null;
}
/* E-Nummer -> Stamm-Zutat (fuer die automatische Bindung). Einmal je Stamm-Stand aufgebaut. */
function _fgZutZusIndex(){
  var st=(typeof ZUTATEN_STAMM!=='undefined'&&Array.isArray(ZUTATEN_STAMM))?ZUTATEN_STAMM:[];
  if(window.__zutZusIdx && window.__zutZusIdxN===st.length) return window.__zutZusIdx;
  var idx={};
  st.forEach(function(it){ var e=fgZutZusE(it&&it.name); if(e && !idx[e]) idx[e]=it; });
  window.__zutZusIdx=idx; window.__zutZusIdxN=st.length; return idx;
}
/* Zusatzstoff hinzugefuegt/entfernt -> Zutaten-Achse automatisch mitziehen (Prinzip 8,
   ohne Handarbeit). add=true: passende Stamm-Zutat binden (falls vorhanden und noch nicht da).
   add=false: die gebundene Zutat dieses Stoffs entfernen. */
function fgZusZutSync(add, z){
  try{
    if(!z||!z.e) return;
    var c=document.getElementById('fe_zutRows'); if(!c) return;
    var eU=String(z.e).toUpperCase();
    if(add){
      var it=_fgZutZusIndex()[eU]; if(!it) return;   /* kein Stamm-Zutat-Gegenstueck -> nur Zusatzstoff-Achse */
      var key=String(it.name||'').toLowerCase();
      var exists=[].some.call(c.querySelectorAll('.fgZutRow'),function(r){ return ((r.querySelector('.fgzName')||{}).value||'').trim().toLowerCase()===key; });
      if(!exists) c.insertAdjacentHTML('beforeend', fgZutRow(it.name, it.rating, it.kritisch||'nein'));
    } else {
      [].forEach.call(c.querySelectorAll('.fgZutRow'),function(r){
        var n=((r.querySelector('.fgzName')||{}).value||'').trim();
        if(n && fgZutZusE(n)===eU){ var inf=r.nextElementSibling; if(inf&&inf.classList&&inf.classList.contains('fgRikiInfo')) inf.remove(); r.remove(); }
      });
    }
    try{ fgPickRender(); }catch(e){}
    try{ if(typeof fePlaus==='function') fePlaus(); }catch(e){}
  }catch(e){}
}
if(typeof window!=='undefined'){ window.fgZusZutSync=fgZusZutSync; window.fgZutZusE=fgZutZusE; }
async function fgZutAdditiveRoute(){
  var c=document.getElementById('fe_zutRows'); if(!c) return;
  try{ if(typeof loadZusatzstoffeStamm==='function') await loadZusatzstoffeStamm(); }catch(e){}
  if(typeof ZUSATZSTOFFE_MAP==='undefined') return;
  window._fgZus=window._fgZus||[];
  var rows=[].slice.call(c.querySelectorAll('.fgZutRow')), moved=0;
  rows.forEach(function(row){
    var inp=row.querySelector('.fgzName'); var nm=inp?String(inp.value||'').trim():''; if(!nm) return;
    var funk=false, pm=nm.match(/\(([^)]*)\)/);
    if(pm){ var inner=pm[1].replace(/[:.]/g,'').trim().toLowerCase(); if(typeof ZUS_FUNKTION!=='undefined' && ZUS_FUNKTION[inner]) funk=true; }
    var namePur=nm.replace(/\([^)]*\)/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    var em=nm.match(/\bE\s?\d{3,4}[a-z]?\b/i);
    var eNr=em?em[0].replace(/\s/g,'').toUpperCase():((typeof ZUS_SYN!=='undefined'&&ZUS_SYN[namePur])?ZUS_SYN[namePur]:null);
    var found=eNr?ZUSATZSTOFFE_MAP[String(eNr).toLowerCase()]:ZUSATZSTOFFE_MAP[namePur];
    if(!found && typeof ZUS_SYN!=='undefined' && ZUS_SYN[namePur]) found=ZUSATZSTOFFE_MAP[String(ZUS_SYN[namePur]).toLowerCase()];
    if(!(funk || found || em)) return;   /* keine klare Zusatzstoff-Kennung -> bleibt Zutat */
    var key=String((found&&found.e)||eNr||namePur).toLowerCase();
    var drin=window._fgZus.some(function(z){ return (String(z.e||'').toLowerCase()===key && key) || String(z.name||'').trim().toLowerCase()===namePur; });
    if(!drin){ if(found) window._fgZus.push({e:found.e,name:found.name,einst:found.einstufung}); else window._fgZus.push({e:eNr||null,name:nm,einst:'ungepr\u00fcft'}); moved++; }
    /* 27y (Prinzip 8): Ist die Zeile bereits die KANONISCHE Stamm-Zutat (gebunden, bewertet),
       bleibt sie - sie IST die Zutaten-Achse dieses Stoffs. Nur rohe Riki-Tokens
       ("Natriumferrocyanid (Trennmittel)") werden entfernt und durch die Stamm-Zutat ersetzt. */
    var _map=(typeof ZUTATEN_MAP!=='undefined'&&ZUTATEN_MAP)?ZUTATEN_MAP:{};
    var istStammZutat=!!(_map[nm.toLowerCase()]||_map[namePur]);
    if(!istStammZutat){
      if(row.parentNode) row.parentNode.removeChild(row);
      moved++;
      if(found) try{ fgZusZutSync(true,{e:found.e}); }catch(e){}   /* kanonische Zutat nachbinden */
    }
  });
  if(moved){ try{ zusSync(); }catch(e){} try{ zusRenderPick(); }catch(e){} try{ fgEnthaltenRender(); }catch(e){} try{ fePlaus(); }catch(e){} }
}
if(typeof window!=='undefined'){ window.fgZutAdditiveRoute=fgZutAdditiveRoute; }
window._fmEinheiten=window._fmEinheiten||null;
async function fmMikroLoad(pid){
  try{
    if(!window._fmEinheiten){ var e=await client.rpc('cb_mikro_einheiten',{p_mit_formen:true});     if(!e.error&&e.data) window._fmEinheiten=e.data; }
    var sel=document.getElementById('fm_mikroStoff');
    if(sel && window._fmEinheiten){ sel.innerHTML='<option value="">N\u00e4hrstoff\u2026</option>'+window._fmEinheiten.map(function(x){
      var txt=x.anzeige||((x.naehrstoff||'')+' ('+(x.einheit||'')+')');
      return '<option value="'+esc(x.naehrstoff)+'" data-einheit="'+esc(x.einheit)+'" data-form="'+esc(x.form||'')+'">'+esc(txt)+'</option>'; }).join(''); fmMikroStoffChange(); }
    var box=document.getElementById('fm_mikroRows');
    if(!pid){ window._fmMikro=[]; if(box) box.innerHTML='<span style="color:var(--muted);font-size:12.5px">Produkt zuerst speichern, dann Mikros erfassen.</span>'; return; }
    var r=await client.rpc('cb_produkt_mikro_liste_v2',{p_id:pid}); window._fmMikro=(!r.error&&r.data)?r.data:[];
    fmMikroRender();
  }catch(e){}
}
function fmMikroRender(){
  /* Die Kacheln unter der Maske haengen an denselben Daten - ein Eintrag hier
     muss dort sofort sichtbar werden, sonst arbeitet man gegen eine Anzeige,
     die den Stand von vorhin zeigt (§1.11n-f: was asynchron nachlaedt, muss
     alles neu zeichnen, was davon abhaengt). */
  try{ feNaehrKachelnSync(); }catch(e){}
  var box=document.getElementById('fm_mikroRows'); if(!box) return; var arr=window._fmMikro||[];
  var kopf=(function(){ if(!arr.length) return '';
    var e=0,a=0,u=0; arr.forEach(function(m){ if(m.herkunft==='etikett')e++; else if(m.herkunft==='abgeleitet')a++; else u++; });
    return '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--muted);padding:0 0 5px 0;border-bottom:1px solid var(--line);margin-bottom:4px">'
      +'<span><b style="color:var(--k-166534)">'+e+'</b> vom Etikett</span>'
      +'<span><b>'+a+'</b> abgeleitet</span>'
      +(u?'<span style="color:var(--k-dc2626)"><b>'+u+'</b> Quelle unklar</span>':'')+'</div>'; })();
  box.innerHTML = arr.length ? kopf+arr.map(function(m){
    var hk=m.herkunft||'unbekannt';
    var chip = hk==='etikett'
      ? '<span title="Auf der Packung deklariert. Quelle: '+esc(m.quelle||'')+'" style="border:1px solid var(--k-bcd9be);background:var(--k-ecfdf5);color:var(--k-166534);border-radius:99px;padding:1px 7px;font-size:10px;white-space:nowrap">Etikett</span>'
      : hk==='abgeleitet'
      ? '<span title="Aus dem Nachschlagewerk uebernommen \u2013 KEIN Produktbeleg (\u00a78.3). Quelle: '+esc(m.quelle||'')+(m.herkunft_detail?' \u00b7 '+esc(m.herkunft_detail):'')+'" style="border:1px dashed var(--line);color:var(--muted);border-radius:99px;padding:1px 7px;font-size:10px;white-space:nowrap">abgeleitet</span>'
      : '<span title="Quellenart steht nicht in der Positivliste (\u00a73.3): '+esc(m.quelle||'(leer)')+'" style="border:1px solid var(--k-dc2626);color:var(--k-dc2626);border-radius:99px;padding:1px 7px;font-size:10px;white-space:nowrap">Quelle unklar</span>';
    var _s=String(m.naehrstoff).replace(/'/g,"\\'"), _f=String(m.form||'').replace(/'/g,"\\'");
    var _ed=window._fmMikroEdit;
    var _istEd=!!(_ed && _ed.stoff===String(m.naehrstoff) && _ed.form===String(m.form||''));
    var _name='<span style="flex:1;min-width:0">'+esc(m.anzeige||m.form||m.naehrstoff)+(m.form&&m.form!==m.naehrstoff?'<span style="color:var(--muted);font-size:11px"> · zählt als '+esc(m.naehrstoff)+'</span>':'')+'</span>';
    if(_istEd){
      return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13px;background:var(--k-fffbeb,#fffbeb)">'
        +_name
        +'<input id="fm_editMenge" type="number" step="any" value="'+esc(String(m.menge_100g))+'" onkeydown="if(event.key===\'Enter\'){event.preventDefault();fmMikroEditSave();}if(event.key===\'Escape\'){fmMikroEditAbbruch();}" style="width:82px;padding:5px 6px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);font-size:13px">'
        +'<select id="fm_editEinheit" style="padding:5px 6px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);font-size:13px"></select>'
        +chip
        +'<button type="button" onclick="fmMikroEditSave()" title="Änderung speichern" style="border:1px solid var(--k-16a34a);background:var(--greenlt,#ecfdf5);color:var(--k-166534);border-radius:7px;padding:4px 9px;cursor:pointer;font-size:12px;font-weight:700">Speichern</button>'
        +'<button type="button" onclick="fmMikroEditAbbruch()" title="Abbrechen" style="border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:15px;line-height:1">✕</button>'
        +'<span id="fm_editMsg" style="flex:1 1 100%;font-size:11px"></span>'
      +'</div>';
    }
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:13px'+(hk==='etikett'?'':';opacity:.72')+'">'+_name+'<span style="color:var(--ink)">'+(m.operator?esc(String(m.operator))+' ':'')+esc(String(m.menge_100g))+' '+esc(m.einheit)+'</span>'+chip
      +'<button type="button" onclick="fmMikroEdit(\''+esc(_s)+'\',\''+esc(_f)+'\')" title="Menge oder Einheit ändern" style="border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:13px;line-height:1">✎</button>'
      +'<button type="button" onclick="fmMikroDel(\''+esc(_s)+'\',\''+esc(_f)+'\')" title="entfernen" style="border:0;background:transparent;color:var(--k-dc2626);cursor:pointer;font-size:15px;line-height:1">✕</button></div>'; }).join('') : '<span style="color:var(--muted);font-size:12.5px">keine – unten hinzufügen (z. B. Jod, Selen, Fluorid)</span>';
  if(window._fmMikroEdit){
    var _cur=(arr||[]).filter(function(x){ return String(x.naehrstoff)===window._fmMikroEdit.stoff
        && String(x.form||'')===window._fmMikroEdit.form; })[0];
    if(_cur) _fmEinheitFuellen(document.getElementById('fm_editEinheit'), _cur.einheit);
  }
}
/* ═══════════════════════════════════════════════════════════════════════════
   WORK #18 — DIE EINHEIT IST EINE WAHL, KEIN URTEIL   (Ralph 15.08.2026)

   BEFUND: Ralph hatte am Etikett von P73617 „Natrium 4,0 g" und konnte es nicht
   eintragen — die Maske bot nur mg an. Er hat selbst auf 4000 mg umgerechnet.

   GEMESSENE URSACHE: die Einheit kam aus `data-einheit` am <option> und wurde per
   `textContent` in ein <span> geschrieben. Es war nie ein Eingabefeld.

   🎯 §22, das WERKZEUG WAR DA: `cb_produkt_mikro_setzen` nimmt `p_einheit` seit
   jeher als Parameter entgegen — der Server war nie festgelegt. Nur das Frontend
   hat sich selbst festgelegt. Und `WIRK_EINHEITEN` (Z. 8429) ist die bereits
   bestehende Liste mit echtem <select>; sie wird hier WIEDERVERWENDET statt eine
   zweite anzulegen (§4.2). Keine DB-Aenderung noetig, keine neue RPC.

   Die hinterlegte Einheit des Naehrstoffs bleibt die VORAUSWAHL — sie stimmt in
   den allermeisten Faellen. Sie ist ab jetzt nur kein Riegel mehr.
   ═══════════════════════════════════════════════════════════════════════════ */
function _fmEinheitFuellen(el, vorgabe){
  if(!el) return;
  var v=String(vorgabe||'mg');
  if(String(el.tagName).toUpperCase()!=='SELECT'){ el.textContent=v; return; }   /* Rueckfall: altes <span> */
  var liste=WIRK_EINHEITEN.slice();
  if(v && liste.indexOf(v)<0) liste.unshift(v);
  el.innerHTML=liste.map(function(u){ return '<option'+(u===v?' selected':'')+'>'+esc(u)+'</option>'; }).join('');
  el.value=v;
}
function _fmEinheitLesen(el, rueckfall){
  if(!el) return rueckfall||'mg';
  var v=(String(el.tagName).toUpperCase()==='SELECT') ? el.value : el.textContent;
  return String(v||'').trim() || rueckfall || 'mg';
}
function fmMikroStoffChange(){ var sel=document.getElementById('fm_mikroStoff'), u=document.getElementById('fm_mikroEinheit'); if(!sel||!u) return; var o=sel.options[sel.selectedIndex]; _fmEinheitFuellen(u,(o&&o.getAttribute('data-einheit'))||'mg'); }
async function fmMikroAdd(){
  var msg=document.getElementById('fm_mikroMsg'); var pid=(window._fgEdit&&window._fgEdit.id);
  if(!pid){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Bitte das Produkt zuerst speichern.'; } return; }
  var sel=document.getElementById('fm_mikroStoff'), mg=document.getElementById('fm_mikroMenge');
  var stoff=sel?sel.value:'', o=sel?sel.options[sel.selectedIndex]:null,
      einh=_fmEinheitLesen(document.getElementById('fm_mikroEinheit'), (o&&o.getAttribute('data-einheit'))||'mg');
  var frm=(o&&o.getAttribute('data-form'))||'';   /* Etikett-Form, z. B. "Vitamin D3" */
  var menge=(mg&&mg.value!=='')?Number(String(mg.value).replace(',','.')):null;
  if(!stoff){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='N\u00e4hrstoff w\u00e4hlen.'; } return; }
  if(menge==null||!isFinite(menge)||menge<=0){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Menge pro 100\u202fg eingeben.'; } return; }
  try{ var r=await client.rpc('cb_produkt_mikro_setzen',{p_id:pid,p_stoff:stoff,p_menge:menge,p_einheit:einh,p_form:frm||null}); if(r&&r.error) throw new Error(r.error.message);
    if(mg) mg.value=''; if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='\u2713 gespeichert'; } fmMikroLoad(pid);
  }catch(e){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+((e&&e.message)||e); } }
}
function fmMikroEdit(stoff, form){
  var arr=window._fmMikro||[];
  var m=arr.filter(function(x){ return String(x.naehrstoff)===String(stoff)
      && String(x.form||'')===String(form||''); })[0];
  if(!m) return;
  window._fmMikroEdit={stoff:String(stoff), form:String(form||'')};
  fmMikroRender();
  try{ var f=document.getElementById('fm_editMenge'); if(f){ f.focus(); f.select(); } }catch(e){}
}
function fmMikroEditAbbruch(){ window._fmMikroEdit=null; fmMikroRender(); }
async function fmMikroEditSave(){
  var st=window._fmMikroEdit; if(!st) return;
  var pid=(window._fgEdit&&window._fgEdit.id); if(!pid) return;
  var mgEl=document.getElementById('fm_editMenge'), eiEl=document.getElementById('fm_editEinheit');
  var msg=document.getElementById('fm_editMsg');
  var alt=(window._fmMikro||[]).filter(function(x){ return String(x.naehrstoff)===st.stoff
      && String(x.form||'')===st.form; })[0];
  if(!alt) return;
  var menge=(mgEl&&mgEl.value!=='')?Number(String(mgEl.value).replace(',','.')):null;
  var einh=_fmEinheitLesen(eiEl, alt.einheit);
  if(menge==null||!isFinite(menge)||menge<=0){
    if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Menge eingeben – zum Entfernen das ✕ nutzen.'; }
    return;   /* 0 ist keine Korrektur, sondern eine Loeschung. Die hat ihren eigenen Knopf. */
  }
  if(Number(alt.menge_100g)===menge && String(alt.einheit)===einh){ fmMikroEditAbbruch(); return; }
  try{
    var r=await client.rpc('cb_produkt_mikro_setzen',{
      p_id:pid, p_stoff:st.stoff, p_menge:menge, p_einheit:einh,
      p_form:st.form||null,
      p_quelle:(alt.quelle||null),
      p_operator:(alt.operator||null)
    });
    if(r&&r.error) throw new Error(r.error.message);
    window._fmMikroEdit=null;
    fmMikroLoad(pid);
    var mc=document.getElementById('fm_mikroMsg');
    if(mc){ mc.style.color='var(--k-16a34a)';
      mc.textContent='✓ '+(alt.anzeige||st.stoff)+' geändert: '+menge+' '+einh; }
  }catch(e){
    if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+((e&&e.message)||e); }
  }
}
if(typeof window!=='undefined'){ window.fmMikroEdit=fmMikroEdit;
  window.fmMikroEditAbbruch=fmMikroEditAbbruch; window.fmMikroEditSave=fmMikroEditSave;
  window._fmEinheitFuellen=_fmEinheitFuellen; window._fmEinheitLesen=_fmEinheitLesen; }

async function fnkRegeln(){
  if(window._fnkRegeln) return window._fnkRegeln;
  try{
    var r=await client.rpc('cb_source_section_routing_rules');
    if(r&&r.error) throw r.error;
    window._fnkRegeln=Array.isArray(r&&r.data)?r.data:[];
  }catch(e){
    window._fnkRegeln=[];
    window._fnkRegelFehler=(e&&e.message)?String(e.message):String(e);
    try{ console.error('[Naehrstoffklassen] cb_source_section_routing_rules:',e); }catch(_){}
  }
  return window._fnkRegeln;
}
async function fnkLaden(pid){
  var box=document.getElementById('fnkWrap'); if(!box) return;
  window._fnkZeilen=null; window._fnkFehler='';
  if(!pid){ box.innerHTML=''; return; }
  await fnkRegeln();
  try{
    var r=await client.rpc('cb_admin_produkt_naehrstoff_klassen',{p_produkt_id:pid});
    if(r&&r.error) throw r.error;
    window._fnkZeilen=Array.isArray(r&&r.data)?r.data:[];
  }catch(e){
    window._fnkFehler=(e&&e.message)?String(e.message):String(e);
    try{ console.error('[Naehrstoffklassen] cb_admin_produkt_naehrstoff_klassen:',e); }catch(_){}
  }
  fnkRender();
}
function fnkRender(){
  var box=document.getElementById('fnkWrap'); if(!box) return;
  if(window._fnkFehler){
    box.innerHTML='<div style="font-size:12px;color:var(--k-dc2626)"><b>Nährstoffklassen nicht abrufbar.</b> '
      +esc(window._fnkFehler)+'</div>';
    return;
  }
  var zeilen=window._fnkZeilen; if(!Array.isArray(zeilen)||!zeilen.length){ box.innerHTML=''; return; }
  var regeln=window._fnkRegeln||[];

  var rest=zeilen;

  var rangVon={}, textVon={};
  regeln.forEach(function(r,i){
    if(r.semantic_class && rangVon[r.semantic_class]==null){ rangVon[r.semantic_class]=i; }
    if(r.semantic_class && r.rule_text && !textVon[r.semantic_class]) textVon[r.semantic_class]=r.rule_text;
    if(r.exception_semantic_class && rangVon[r.exception_semantic_class]==null) rangVon[r.exception_semantic_class]=i;
  });
  var gruppen={};
  rest.forEach(function(z){ var k=z.semantic_class||'(ohne Klasse)'; (gruppen[k]=gruppen[k]||[]).push(z); });
  var namen=Object.keys(gruppen).sort(function(a,b){
    var ra=(rangVon[a]==null?999:rangVon[a]), rb=(rangVon[b]==null?999:rangVon[b]);
    return ra-rb || a.localeCompare(b);
  });

  box.innerHTML=namen.map(function(k){
    var arr=gruppen[k].slice().sort(function(x,y){ return String(x.stoffname).localeCompare(String(y.stoffname)); });
    var abschnitte={}; arr.forEach(function(z){ if(z.source_section_key) abschnitte[z.source_section_key]=1; });
    var absTxt=Object.keys(abschnitte).join(', ');
    var erkl=textVon[k]||'';
    /* Zeilen, die schon in der Mikro-Karte darüber stehen, werden hier gezählt und
       verortet statt wiederholt. */
    var oben=arr.filter(function(z){ return z.source_table==='Produkt_Mikronaehrstoffe'; });
    var hier=arr.filter(function(z){ return z.source_table!=='Produkt_Mikronaehrstoffe'; });
    return '<div style="margin-top:9px;border:1px solid var(--line);border-radius:9px;background:var(--card);padding:8px 10px">'
      +'<div style="display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-bottom:5px">'
      +'<b style="font-size:12.5px">'+esc(k)+'</b>'
      +'<span style="font-size:11px;color:var(--muted)">'+esc(String(arr.length))+' Zeilen'
      +(absTxt?' · Quellabschnitt '+esc(absTxt):'')+'</span></div>'
      +(erkl?'<div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:6px">'+esc(erkl)+'</div>':'')
      +(oben.length?'<div style="font-size:11px;color:var(--muted);font-style:italic;padding:3px 0">'
         +esc(String(oben.length))+' davon stehen oben in der Karte „Mikronährstoffe" und werden hier nicht wiederholt.</div>':'')
      +hier.map(function(z){
        return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid var(--line);font-size:12.5px">'
          +'<span style="flex:1">'+esc(String(z.stoffname||''))+'</span>'
          +'<span>'+(z.vergleichsoperator?esc(String(z.vergleichsoperator))+' ':'')
          +esc(String(z.menge))+' '+esc(String(z.einheit||''))+'</span>'
          +(z.bezug?'<span style="font-size:10.5px;color:var(--muted)">'+esc(String(z.bezug))+'</span>':'')
          +(z.nrv_prozent!=null?'<span style="font-size:10.5px;color:var(--muted)">'+esc(String(z.nrv_prozent))+' % NRV</span>':'')
          +'</div>';
      }).join('')
      +'</div>';
  }).join('');
}
if(typeof window!=='undefined'){ window.fnkLaden=fnkLaden; window.fnkRender=fnkRender; window.fnkRegeln=fnkRegeln; }
/* Form MUSS mit: ein Produkt kann "Vitamin D" und "Vitamin D3" nebeneinander fuehren.
   Ohne Form loeschte das rote X beide Zeilen - stiller Datenverlust. */
async function fmMikroDel(stoff, form){
  var pid=(window._fgEdit&&window._fgEdit.id); if(!pid) return;
  if(!confirm(stoff+' entfernen?')) return;
  try{ var r=await client.rpc('cb_produkt_mikro_del',{p_id:pid,p_stoff:stoff,p_form:form||null}); if(r&&r.error) throw new Error(r.error.message); fmMikroLoad(pid); }catch(e){}
}
if(typeof window!=='undefined'){ window.fmMikroLoad=fmMikroLoad; window.fmMikroRender=fmMikroRender; window.fmMikroStoffChange=fmMikroStoffChange; window.fmMikroAdd=fmMikroAdd; window.fmMikroDel=fmMikroDel; }
async function fmUsdaSuchen(){
  var box=document.getElementById('fm_usdaErg'); if(!box) return;
  var q=String(((document.getElementById('fm_usdaSuche')||{}).value)||'').trim();
  if(!q){ box.innerHTML=''; return; }
  box.innerHTML='<span style="color:var(--muted);font-size:12px">sucht…</span>';
  try{
    var r=await client.rpc('cb_usda_suche',{p_text:q,p_limit:8});
    if(r.error) throw new Error(r.error.message);
    var rows=r.data||[];
    window._fmUsda={}; rows.forEach(function(x){ window._fmUsda[String(x.fdc_id)]=x; });
    box.innerHTML = rows.length ? rows.map(function(x){
      var mk=Array.isArray(x.mikros)?x.mikros:[];
      var chips=mk.map(function(m){
        return '<button type="button" onclick="fmUsdaUebernehmen(\''+esc(String(x.fdc_id))+'\',\''+esc(String(m.naehrstoff).replace(/'/g,"\\'"))+'\')" title="Diesen Wert je 100 g für DIESES Produkt übernehmen" style="border:1px solid var(--k-bcd9be);border-radius:99px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);padding:2px 8px;font-size:11px;cursor:pointer">'+esc(m.naehrstoff)+' '+esc(String(m.menge_100g))+'\u202f'+esc(m.einheit)+' ⤵</button>';
      }).join('');
      var name = x.name_de
        ? '<b>'+esc(x.name_de)+'</b> <span style="color:var(--muted)">· '+esc(x.name_en)+'</span>'
        : esc(x.name_en)+' <span style="color:var(--muted);font-size:10.5px" title="deutscher Name noch nicht kuratiert">(EN)</span>';
      return '<div style="padding:6px 0;border-bottom:1px solid var(--line)">'
        +'<div style="font-size:12.5px;color:var(--ink);line-height:1.3">'+name+'</div>'
        +'<div style="font-size:10.5px;color:var(--muted)">'+(x.kcal!=null?(Math.round(Number(x.kcal))+' kcal'):'')+(x.protein!=null?(' · EW '+esc(String(x.protein))+' g'):'')+(x.salz_g!=null?(' · Salz '+esc(String(x.salz_g))+' g'):'')+' je 100 g · '+esc(x.quelle||'')+'</div>'
        +(chips?'<div style="margin-top:3px;display:flex;gap:5px;flex-wrap:wrap">'+chips+'</div>':'<div style="font-size:10.5px;color:var(--muted)">keine Selen-/Cholin-Werte hinterlegt</div>')
      +'</div>';
    }).join('') : '<span style="color:var(--muted);font-size:12px">nichts gefunden – englisch suchen hilft (USDA-Namen sind englisch)</span>';
  }catch(e){ box.innerHTML='<span style="color:var(--k-dc2626);font-size:12px">Fehler: '+esc((e&&e.message)||String(e))+'</span>'; }
}
async function fmUsdaUebernehmen(fdcId, stoff){
  var msg=document.getElementById('fm_mikroMsg'); var pid=(window._fgEdit&&window._fgEdit.id);
  if(!pid){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Bitte das Produkt zuerst speichern.'; } return; }
  var x=(window._fmUsda||{})[String(fdcId)]; if(!x) return;
  var m=(Array.isArray(x.mikros)?x.mikros:[]).find(function(y){ return y.naehrstoff===stoff; }); if(!m) return;
  try{
    var r=await client.rpc('cb_produkt_mikro_setzen',{p_id:pid,p_stoff:m.naehrstoff,p_menge:Number(m.menge_100g),p_einheit:m.einheit,p_form:null,p_quelle:String(x.quelle||'USDA')+' · '+String(x.name_en||'')});
    if(r&&r.error) throw new Error(r.error.message);
    if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='\u2713 '+m.naehrstoff+' '+m.menge_100g+'\u202f'+m.einheit+' aus USDA übernommen'; }
    fmMikroLoad(pid);
  }catch(e){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+((e&&e.message)||e); } }
}
if(typeof window!=='undefined'){ window.fmUsdaSuchen=fmUsdaSuchen; window.fmUsdaUebernehmen=fmUsdaUebernehmen; }

function fgQuickParse(v){
  v=String(v||'').trim();
  var m=v.match(/^(.*?)[\s:]+([0-9]+(?:[.,][0-9]+)?)\s*(µg|ug|mcg|mg|g|ml|%)?\s*$/i);
  if(m && m[1].trim()){
    var e=(m[3]||'').toLowerCase(); if(e==='ug'||e==='mcg') e='µg';
    return { name:m[1].trim().replace(/[,;:]+$/,''), menge:Number(m[2].replace(',','.')), einheit:e||null };
  }
  return { name:v.replace(/[,;:]+$/,''), menge:null, einheit:null };
}
function fgQuickMsg(html){ var b=document.getElementById('fe_quickMsg'); if(b) b.innerHTML=html||''; }
function _fgQuickChip(route,label){
  return '<button type="button" onclick="fgQuickDo(\''+route+'\')" style="margin:2px 6px 2px 0;padding:6px 12px;border:1px solid var(--k-cecbf6);border-radius:8px;background:var(--card);color:var(--k-534ab7);font-weight:700;font-size:12.5px;cursor:pointer">'+label+'</button>';
}
function fgQuickGo(){
  var inp=document.getElementById('fe_quickIn'); var raw=((inp||{}).value||'').trim();
  if(!raw){ fgQuickMsg(''); return; }
  var p=fgQuickParse(raw); var nl=p.name.toLowerCase();
  var isSupp=(((document.getElementById('fe_kat')||{}).value||'').trim().toLowerCase()==='supplement');
  /* Zusatzstoff: E-Nummer im Text ODER Stamm-Name/Synonym (gleiche Nachschlage-Reihenfolge wie zusAddNeu) */
  var zus=null;
  try{
    var em=p.name.match(/\bE\s?[0-9]{3,4}[a-z]?\b/i);
    zus=(em?ZUSATZSTOFFE_MAP[em[0].replace(/\s/g,'').toLowerCase()]:null)
      || (typeof ZUSATZSTOFFE_MAP!=='undefined'?ZUSATZSTOFFE_MAP[nl]:null)
      || ((typeof ZUS_SYN!=='undefined'&&ZUS_SYN[nl])?ZUSATZSTOFFE_MAP[String(ZUS_SYN[nl]).toLowerCase()]:null) || null;
  }catch(e){}
  /* Zutat: EXAKTER Stamm-Treffer (kein Teilstring - deterministisch statt geraten) */
  var zt=null;
  try{
    if(typeof ZUTATEN_MAP!=='undefined' && ZUTATEN_MAP[nl]){
      var stEintrag=((typeof ZUTATEN_STAMM!=='undefined'&&ZUTATEN_STAMM)||[]).filter(function(z){ return String(z.name||'').trim().toLowerCase()===nl; })[0];
      zt={ name:ZUTATEN_MAP[nl].kanon||(stEintrag&&stEintrag.name)||p.name, rating:ZUTATEN_MAP[nl].rating, krit:ZUTATEN_MAP[nl].kritisch||'nein' };   /* 28z7: Synonym -> kanonischer Name */
    }
  }catch(e){}
  /* Mikronährstoff: Stammliste der Mikro-Karte (Stammname, Etikett-Form oder Anzeige) */
  var mk=null;
  try{
    mk=(window._fmEinheiten||[]).filter(function(x){
      var kand=[x.naehrstoff,x.anzeige,x.form,String(x.anzeige||'').replace(/\s*\(.*\)\s*$/,'')];
      return kand.some(function(t){ return String(t||'').trim().toLowerCase()===nl; });
    })[0]||null;
  }catch(e){}
  /* 28x: Etikett-Kopien kleben oft Zahl an Name ("Kreatin-Monohydrat3500 mg"). NICHT still
     trennen - bei "Vitamin D325 µg" ist unentscheidbar, ob D3+25 oder D+325 gemeint ist.
     Stattdessen den gelesenen Vorschlag ZEIGEN und bestätigen lassen (nie raten). */
  if(p.menge==null){
    var g=p.name.match(/^(.*[^0-9\s])([0-9]+(?:[.,][0-9]+)?)\s*(µg|ug|mcg|mg|g|ml)$/i);
    if(g){
      var ge=g[3].toLowerCase(); if(ge==='ug'||ge==='mcg') ge='µg';
      window._fgQuickP={ p:p, split:{name:g[1].trim(), menge:g[2].replace(',','.'), einheit:ge}, isSupp:isSupp };
      fgQuickMsg('Die Menge klebt am Namen. Ich lese daraus: <b>'+esc(g[1].trim())+'</b> + <b>'+esc(g[2])+' '+esc(ge)+'</b> – stimmt das? '
        +_fgQuickChip('splitOk','Ja, so übernehmen')
        +'<span style="color:var(--muted)"> · sonst mit Leerzeichen neu tippen (z. B. „Kreatin-Monohydrat 3500 mg")</span>');
      return;
    }
  }
  window._fgQuickP={ p:p, zus:zus, zt:zt, mk:mk, isSupp:isSupp };
  var routes=[]; if(zus) routes.push('zus'); if(zt) routes.push('zutat'); if(mk) routes.push('mikro');
  if(routes.length===0){
    var chips=_fgQuickChip('zutatNeu','Als ZUTAT aufnehmen (Riki bewertet)')+_fgQuickChip('zusNeu','Als ZUSATZSTOFF (ungeprüft)');
    if(isSupp) chips=_fgQuickChip('wirk','Als WIRKSTOFF – Tagesdosis (Reiter 1)')+chips;
    fgQuickMsg('„'+esc(p.name)+'" steht in keinem Stamm. Wie aufnehmen? '+chips);
    return;
  }
  if(routes.length===1 && !isSupp){ fgQuickDo(routes[0]); return; }
  var teile=[];
  if(isSupp) teile.push(_fgQuickChip('wirk','WIRKSTOFF – Tagesdosis (Reiter 1)'));
  if(zus) teile.push(_fgQuickChip('zus','ZUSATZSTOFF: '+esc(zus.name)+(zus.e?' ('+esc(zus.e)+')':'')));
  if(mk) teile.push(_fgQuickChip('mikro','MIKRONÄHRSTOFF je 100 g: '+esc(mk.anzeige||mk.naehrstoff)));
  if(zt) teile.push(_fgQuickChip('zutat','ZUTAT: '+esc(zt.name)+(zt.rating!=null?' (Note '+zt.rating+')':'')));
  fgQuickMsg('„'+esc(p.name)+'" passt auf mehrere Ziele – bitte wählen: '+teile.join(''));
}
function fgQuickDo(route){
  var P=window._fgQuickP; if(!P) return; var p=P.p; var fertig=true;
  if(route==='splitOk' && P.split){ var qi=document.getElementById('fe_quickIn');
    if(qi){ qi.value=P.split.name+' '+P.split.menge+' '+P.split.einheit; window._fgQuickP=null; fgQuickGo(); }
    return; }
  if(route==='zus' && P.zus){
    var z=P.zus; window._fgZus=window._fgZus||[];
    var key=String(z.e||z.name||'').toLowerCase();
    var schon=window._fgZus.some(function(x){ return String(x.e||x.name||'').toLowerCase()===key; });
    if(schon){ fgQuickMsg('„'+esc(z.name)+'" ist bereits als Zusatzstoff erfasst.'); }
    else{ window._fgZus.push({e:z.e,name:z.name,einst:z.einstufung}); try{ fgZusZutSync(true,z); }catch(e){}
      zusSync(); zusRenderSel(); zusRenderPick();
      fgQuickMsg('<span style="color:var(--k-166534)">✓ als <b>Zusatzstoff</b> erfasst: '+esc(z.name)+(z.e?' ('+esc(z.e)+')':'')+'</span>'); }
  } else if(route==='zutat' && P.zt){
    var c=document.getElementById('fe_zutRows');
    if(c){ var key2=P.zt.name.toLowerCase();
      var ex=[].some.call(c.querySelectorAll('.fgZutRow'),function(r){ return ((r.querySelector('.fgzName')||{}).value||'').trim().toLowerCase()===key2; });
      if(ex){ fgQuickMsg('„'+esc(P.zt.name)+'" ist bereits als Zutat gebunden.'); }
      else{ c.insertAdjacentHTML('beforeend', fgZutRow(P.zt.name, P.zt.rating, P.zt.krit));
        try{ fgPickRender(); }catch(e){} try{ fePlaus(); }catch(e){}
        fgQuickMsg('<span style="color:var(--k-166534)">✓ als <b>Zutat</b> gebunden: '+esc(P.zt.name)+(P.zt.rating!=null?' (Note '+P.zt.rating+')':' – noch ohne Note')+'</span>'); } }
  } else if(route==='zutatNeu'){
    var i2=document.getElementById('fe_zutNeu');
    if(i2){ i2.value=p.name; try{ fgPickAddNeu(); }catch(e){}
      fgQuickMsg('→ Riki bewertet „'+esc(p.name)+'" – Vorschlag unten in der Zutaten-Karte bestätigen (nichts wird ungeprüft übernommen).'); }
  } else if(route==='zusNeu'){
    window._fgZus=window._fgZus||[];
    window._fgZus.push({e:null,name:p.name,einst:(typeof _istAroma==='function'&&_istAroma(p.name))?'neutral':'ungeprüft'});
    zusSync(); zusRenderSel(); zusRenderPick();
    fgQuickMsg('✓ als <b>Zusatzstoff (ungeprüft)</b> erfasst – die Einstufung folgt im Stamm; bis dahin blockiert er den Index (§1.11k).');
  } else if(route==='mikro' && P.mk){
    var sel=document.getElementById('fm_mikroStoff'), mg=document.getElementById('fm_mikroMenge');
    if(sel){ sel.value=P.mk.naehrstoff; try{ fmMikroStoffChange(); }catch(e){} }
    if(p.menge!=null && p.einheit && P.mk.einheit && p.einheit!=='%' && p.einheit!==String(P.mk.einheit).toLowerCase()){
      if(mg){ mg.value=''; mg.focus(); } fertig=false;
      fgQuickMsg('⚠ Einheit passt nicht: Der Stamm führt „'+esc(P.mk.anzeige||P.mk.naehrstoff)+'" in <b>'+esc(P.mk.einheit)+'</b>, du hast '+esc(p.einheit)+' getippt. Bitte die Menge je 100 g in '+esc(P.mk.einheit)+' eintragen – es wird nichts umgerechnet.');
    } else if(p.menge!=null){
      if(mg) mg.value=String(p.menge);
      try{ fmMikroAdd(); }catch(e){}
      fgQuickMsg('<span style="color:var(--k-166534)">✓ als <b>Mikronährstoff</b> gespeichert: '+esc(P.mk.anzeige||P.mk.naehrstoff)+' '+esc(String(p.menge))+' '+esc(P.mk.einheit||'')+' je 100 g.</span>');
    } else {
      if(mg){ mg.focus(); } fertig=false;
      fgQuickMsg('Nährstoff vorgewählt: „'+esc(P.mk.anzeige||P.mk.naehrstoff)+'". Menge <b>je 100 g</b> in der Mikro-Karte eintragen und „+ setzen".');
    }
  } else if(route==='wirk'){
    var wname=(P.mk&&(P.mk.anzeige||P.mk.naehrstoff))||p.name;
    try{ feWirkAdd({naehrstoff:wname, menge:(p.menge==null?'':p.menge), einheit:p.einheit||((P.mk&&P.mk.einheit)||'mg')}); }catch(e){}
    try{ fePlaus(); }catch(e){}
    fgQuickMsg('<span style="color:var(--k-166534)">✓ als <b>Wirkstoff (Tagesdosis)</b> eingetragen – Reiter 1, Karte „Wirkstoffe &amp; Dosis"'+(p.menge==null?' – Menge dort ergänzen':'')+'.</span>');
  } else { fgQuickMsg(''); }
  if(fertig){ var q=document.getElementById('fe_quickIn'); if(q){ q.value=''; try{ q.focus(); }catch(e){} } window._fgQuickP=null; }
}
if(typeof window!=='undefined'){ window.fgQuickGo=fgQuickGo; window.fgQuickDo=fgQuickDo; window.fgQuickParse=fgQuickParse; }
function fmMikroModalOpen(){
  var pid=(window._fgEdit&&window._fgEdit.id);
  if(!pid){ var mc=document.getElementById('fm_mikroMsg'); if(mc){ mc.style.color='var(--k-dc2626)'; mc.textContent='Bitte das Produkt zuerst speichern.'; } return; }
  var ov=document.getElementById('fmMikroOv');
  if(!ov){ ov=document.createElement('div'); ov.id='fmMikroOv'; ov.style.cssText='position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-start;justify-content:center;background:rgba(20,32,48,.45);overflow:auto;padding:24px 12px'; document.body.appendChild(ov); }
  ov.style.display='flex';
  var opts='<option value="">Nährstoff…</option>'+((window._fmEinheiten||[]).map(function(x){ return '<option value="'+esc(x.naehrstoff)+'" data-einheit="'+esc(x.einheit)+'">'+esc(x.naehrstoff)+' ('+esc(x.einheit)+')</option>'; }).join(''));
  ov.innerHTML='<div style="background:var(--card,#fff);color:var(--ink);border-radius:16px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(20,40,70,.32);padding:20px;margin:auto">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px"><div style="font-weight:800;font-size:16px">Mikronährstoff hinzufügen</div><button type="button" onclick="fmMikroModalClose()" style="border:0;background:var(--bg,#eef2f5);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px">✕</button></div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Deklarierte Menge <b>pro 100 g</b> (z. B. Jod, Selen, Fluorid). Wird sofort gespeichert.</div>'
    +'<label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">Nährstoff</label>'
    +'<select id="fm_mikroStoff" onchange="fmMikroStoffChange()" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:13px;margin-bottom:10px">'+opts+'</select>'
    +'<label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">Menge pro 100 g</label>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><input id="fm_mikroMenge" type="number" step="any" placeholder="z. B. 25" style="flex:1;min-width:0;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:13px"><select id="fm_mikroEinheit" title="Einheit laut Etikett – Vorauswahl ist die hinterlegte Einheit des Nährstoffs (Work #18)" style="font-size:13px;color:var(--ink);min-width:64px;padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--bg)"></select></div>'
    +'<div id="fm_mikroModalMsg" style="font-size:12px;color:var(--muted);min-height:16px;margin-bottom:8px"></div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" onclick="fmMikroModalClose()" style="padding:8px 14px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);cursor:pointer;font-size:13px">Abbrechen</button><button type="button" onclick="fmMikroModalSave()" style="padding:8px 16px;border:1px solid var(--k-16a34a);border-radius:8px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);cursor:pointer;font-size:13px;font-weight:700">Speichern</button></div>'
  +'</div>';
  try{ fmMikroStoffChange(); }catch(e){}
  try{ var mi=document.getElementById('fm_mikroMenge'); if(mi) mi.focus(); }catch(e){}
}
async function fmMikroModalSave(){
  var pid=(window._fgEdit&&window._fgEdit.id); var msg=document.getElementById('fm_mikroModalMsg');
  if(!pid){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Bitte das Produkt zuerst speichern.'; } return; }
  var sel=document.getElementById('fm_mikroStoff'), mg=document.getElementById('fm_mikroMenge');
  var stoff=sel?sel.value:'', o=sel?sel.options[sel.selectedIndex]:null,
      einh=_fmEinheitLesen(document.getElementById('fm_mikroEinheit'), (o&&o.getAttribute('data-einheit'))||'mg');
  var menge=(mg&&mg.value!=='')?Number(String(mg.value).replace(',','.')):null;
  if(!stoff){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Nährstoff wählen.'; } return; }
  if(menge==null||!isFinite(menge)||menge<=0){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Menge pro 100 g eingeben.'; } return; }
  try{ var r=await client.rpc('cb_produkt_mikro_setzen',{p_id:pid,p_stoff:stoff,p_menge:menge,p_einheit:einh}); if(r&&r.error) throw new Error(r.error.message);
    fmMikroModalClose(); try{ fmMikroLoad(pid); }catch(e){}
    var mc=document.getElementById('fm_mikroMsg'); if(mc){ mc.style.color='var(--k-16a34a)'; mc.textContent='✓ '+stoff+' gespeichert'; }
  }catch(e){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+((e&&e.message)||e); } }
}
function fmMikroModalClose(){ var ov=document.getElementById('fmMikroOv'); if(ov) ov.style.display='none'; }
if(typeof window!=='undefined'){ window.fmMikroModalOpen=fmMikroModalOpen; window.fmMikroModalSave=fmMikroModalSave; window.fmMikroModalClose=fmMikroModalClose; }
function fmMikroVorschlag(list){
  var box=document.getElementById('fm_mikroVorschlag'); if(!box) return;
  var einh=window._fmEinheiten||[];
  var norm=(list||[]).map(function(m){ var nm=String((m.name||m.naehrstoff||m.stoff||'')).trim(); if(!nm) return null; var menge=(m.menge!=null?m.menge:(m.wert!=null?m.wert:null)); if(menge==null||!isFinite(Number(menge))) return null; var canon=null; for(var i=0;i<einh.length;i++){ if(String(einh[i].naehrstoff).toLowerCase()===nm.toLowerCase()){ canon=einh[i]; break; } } return { name:(canon?canon.naehrstoff:nm), menge:Number(menge), einheit:(canon?canon.einheit:(m.einheit||m.unit||'mg')), bekannt:!!canon }; }).filter(Boolean);
  window._fmVorschlag=norm;
  try{ if(typeof fgEnthaltenRender==='function') fgEnthaltenRender(); }catch(e){} /* 28d: Arbeitslisten-Kopf zaehlt die offenen Mikro-Vorschlaege mit */
  if(!norm.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.style.display='';
  box.innerHTML='<div style="border:1px solid #cbc7f2;border-radius:9px;background:var(--k-f6f5fd,#f6f5fd);padding:9px 11px;font-size:12px;line-height:1.5;color:var(--k-534ab7)"><b>\ud83e\udd16 Riki hat '+norm.length+' Mikron\u00e4hrstoff(e) je 100\u202fg gelesen:</b> '+norm.map(function(m){ return esc(m.name)+' '+esc(String(m.menge))+'\u202f'+esc(m.einheit)+(m.bekannt?'':' <span title="Name nicht im N\u00e4hrstoff-Stamm \u2013 wird gespeichert, z\u00e4hlt aber evtl. nicht in der N\u00e4hrstoff-\u00dcbersicht" style="color:var(--k-b45309)">?</span>'); }).join(', ')+' <button type="button" onclick="fmMikroVorschlagUebernehmen()" style="margin-left:4px;padding:4px 10px;border:1px solid var(--k-16a34a);border-radius:7px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);cursor:pointer;font-size:12px;font-weight:700">alle \u00fcbernehmen</button></div>';
}
async function fmMikroVorschlagUebernehmen(){
  var pid=(window._fgEdit&&window._fgEdit.id), msg=document.getElementById('fm_mikroMsg');
  if(!pid){ if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Bitte das Produkt zuerst speichern.'; } return; }
  var list=window._fmVorschlag||[]; var ok=0;
  for(var i=0;i<list.length;i++){ try{ var r=await client.rpc('cb_produkt_mikro_setzen',{p_id:pid,p_stoff:list[i].name,p_menge:list[i].menge,p_einheit:list[i].einheit,p_form:null}); /* 28b: p_form MUSS mit - ohne es traf der Aufruf zwei Ueberladungen (42725); die 4-Param-Altfassung ist per Migration entfernt, der explizite Parameter haelt den Aufruf eindeutig. */ if(!(r&&r.error)) ok++; }catch(e){} }
  window._fmVorschlag=[]; var box=document.getElementById('fm_mikroVorschlag'); if(box){ box.style.display='none'; box.innerHTML=''; }
  try{ if(typeof fgEnthaltenRender==='function') fgEnthaltenRender(); }catch(e){} /* 28d: Zaehler im Arbeitslisten-Kopf zuruecksetzen */
  try{ fmMikroLoad(pid); }catch(e){}
  if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='\u2713 '+ok+' Mikron\u00e4hrstoff(e) \u00fcbernommen'; }
}
if(typeof window!=='undefined'){ window.fmMikroVorschlag=fmMikroVorschlag; window.fmMikroVorschlagUebernehmen=fmMikroVorschlagUebernehmen; }
function fgZutRow(name,rating,kritisch){
  const kr=(String(kritisch||"nein").toLowerCase()==="ja");
  const hasR=!(rating===null||rating===undefined||rating==="");
  const bound=(name && typeof ZUTATEN_MAP!=="undefined" && ZUTATEN_MAP && ZUTATEN_MAP[(name||"").trim().toLowerCase()]!=null);
  /* Bewertung ist READONLY (an den Stamm gebunden, keine Willkuer). Unbekannte Zutat -> "→ Riki".
     Tabellen-Layout: jede Zeile ein eigenes Grid mit IDENTISCHEN Spalten (Name | Bewertung |
     kritisch | Aktion) -> saubere Tabellen-Optik wie im Raster oben. Kein <table>, damit die
     Riki-Info-Zeile (fgRikiInfo) weiterhin als volle Zeile dazwischenpasst. */
  return `<div class="fgZutRow" style="display:grid;grid-template-columns:1fr 62px 30px 78px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)">
    <span class="fgzWrap" style="position:relative;min-width:0"><input class="fgzName" value="${esc(name||"")}" oninput="fgZutAuto(this);fgzMenu(this)" onfocus="fgzMenu(this)" onblur="fgzMenuBlur(this)" autocomplete="off" placeholder="Zutat wählen oder neu tippen" style="width:100%;box-sizing:border-box;padding:7px;border:1px solid var(--line);border-radius:8px;font-size:13px;background:var(--card);color:var(--ink)"><div class="fgzMenu" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 3px);z-index:60;background:var(--card);border:1px solid var(--line);border-radius:8px;max-height:210px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.22)"></div></span>
    <input class="fgzRate" type="number" min="0" max="10" step="1" value="${hasR?rating:""}" readonly tabindex="-1" placeholder="–" title="Bewertung ist an die Zutat (Stamm) gebunden – nicht von Hand änderbar. Unbekannt? „→ Riki" bewerten lassen." style="width:100%;box-sizing:border-box;padding:7px 4px;border:1px solid var(--line);border-radius:8px;font-size:13px;text-align:center;background:var(--k-f2f5f3);color:var(--ink);cursor:not-allowed">
    <label style="justify-self:center;display:flex;align-items:center" title="kritisch"><input class="fgzKrit" type="checkbox" ${kr?"checked":""} style="width:15px;height:15px;accent-color:var(--k-dc2626)"></label>
    <span style="display:flex;gap:4px;justify-content:flex-end;align-items:center">
      <button type="button" class="fgzRiki" onclick="fgZutRiki(this)" title="Riki stuft die Zutat ein + zwei Wächter prüfen, dann in den Stamm aufnehmen" style="flex:0 0 auto;padding:5px 7px;border:1px solid var(--k-16a34a);border-radius:8px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);cursor:pointer;font-size:11px;white-space:nowrap;${bound?"display:none":""}">→ Riki</button>
      <button type="button" onclick="fgZutRowDel(this)" title="Zutat entfernen" style="border:0;background:var(--k-fee2e2);color:var(--k-b91c1c);border-radius:8px;width:28px;height:28px;cursor:pointer;flex:0 0 auto">✕</button>
    </span>
  </div>`;
}
function fgZutRowDel(b){ var row=b.closest(".fgZutRow"); if(!row) return; var inf=row.nextElementSibling; if(inf&&inf.classList&&inf.classList.contains("fgRikiInfo")) inf.remove(); row.remove(); try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){} }
function fgZutAuto(inp){
  const row=inp.closest(".fgZutRow"); if(!row) return;
  const r=row.querySelector(".fgzRate"), k=row.querySelector(".fgzKrit"), rk=row.querySelector(".fgzRiki");
  const inf=row.nextElementSibling; if(inf&&inf.classList&&inf.classList.contains("fgRikiInfo")) inf.remove();
  if(rk){ delete rk.dataset.mode; delete rk.dataset.stufe; delete rk.dataset.gesamt; rk.textContent="→ Riki"; }
  const m=ZUTATEN_MAP[(inp.value||"").trim().toLowerCase()];
  if(m){
    if(r){ r.value=m.rating; r.style.color="var(--ink)"; }
    if(k) k.checked=(String(m.kritisch).toLowerCase()==="ja");
    if(rk) rk.style.display="none";
  } else {
    if(r){ r.value=""; r.style.color="var(--ink)"; }
    if(rk) rk.style.display=(inp.value.trim()? "" : "none");
  }
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
}
/* Eigenes Zutaten-Auswahlmenue statt <datalist>. Grund: das native datalist-Popup
   ignoriert im Dark-Mode das color-scheme des Inputs und zeigt schwarzen Text auf
   schwarzem Grund. Ein eigenes Menue nutzt --card/--ink -> helle Schrift auf dunkel. */
/* Bei Supplements sollen im Zutaten-/Wirkstoff-Feld keine Lebensmittel vorgeschlagen werden
   (kein „Paprika"). Wir blenden die klaren Lebensmittel-Kategorien aus; Wirkstoffe, Extrakte,
   Vitamine/Mineralstoffe, Füllstoffe und Unbekanntes bleiben. Tippen funktioniert immer. */
var FG_FOOD_KATS={'Gemüse':1,'Getreide':1,'Obst':1,'Fleisch':1,'Milchprodukt':1,'Fisch & Meeresfrüchte':1,'Gewürze & Kräuter':1,'Hülsenfrüchte/Nüsse':1,'Käse':1,'Nüsse & Samen':1,'Pilze':1,'Ei':1,'Teigwaren':1,'Essig':1,'einfache Küchenzutat':1,'Hülsenfrüchte':1,'Gemüse, Obst':1,'Nüsse & Hülsenfrüchte':1,'Obst & Gemüse':1,'Milchprodukte & Eier':1,'Fleisch & Fisch':1,'Frucht/Nuss':1,'Gemüse, Obst, Hülsenfrüchte':1,'Frucht-/Gemüsekonzentrat':1};
var _fgzV2={q:"", treffer:null, laeuft:false, timer:0, fehler:""};
async function _fgzV2Suchen(q, danach){
  q=String(q||"").trim();
  if(q.length<2){ _fgzV2={q:q, treffer:[], laeuft:false, timer:0, fehler:""}; if(danach) danach(); return; }
  if(_fgzV2.q===q && _fgzV2.treffer){ if(danach) danach(); return; }
  _fgzV2.laeuft=true; _fgzV2.q=q;
  try{
    var r=await client.rpc("cb_admin_zutaten_suchen_v2",{p_suche:q, p_limit:8});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    _fgzV2.treffer=Array.isArray(d)?d:[]; _fgzV2.fehler="";
  }catch(e){
    console.error("[Canonical-Suche] cb_admin_zutaten_suchen_v2:", e);
    _fgzV2.treffer=null; _fgzV2.fehler=(e&&e.message)?String(e.message):String(e);
  }
  _fgzV2.laeuft=false;
  if(danach) danach();
}
function _fgzKontextHtml(t, c){
  var hatZahl=(c && c.rating!=null && isFinite(c.rating));
  var farbe=hatZahl?"var(--k-166534,#166534)":"var(--muted)";
  var zahl=hatZahl?String(c.rating):"nicht belegt";
  return '<div onmousedown="fgzCanonPick(this)"'
    +' data-eid="'+esc(String(t.entity_id||""))+'"'
    +' data-mod="'+esc(String(c.modifier||"unspecified_processing"))+'"'
    +' data-name="'+esc(String(t.name||""))+'"'
    +' data-rating="'+(hatZahl?String(c.rating):"")+'"'
    +' title="'+esc(String(c.reason||""))+'"'
    +' onmouseenter="this.style.background=\'var(--k-f2f5f3)\'" onmouseleave="this.style.background=\'\'"'
    +' style="display:flex;justify-content:space-between;gap:10px;padding:6px 10px 6px 20px;font-size:12.5px;color:var(--ink);cursor:pointer;border-bottom:1px solid var(--line)">'
    +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(c.processing_context||c.modifier||""))+'</span>'
    +'<b style="flex:0 0 auto;color:'+farbe+'">'+esc(zahl)+'</b></div>';
}
function _fgzV2Render(menu){
  var t=_fgzV2.treffer;
  if(_fgzV2.laeuft){ menu.innerHTML='<div style="padding:8px 10px;font-size:12px;color:var(--muted)">Canonical-Suche läuft …</div>'; menu.style.display="block"; return true; }
  if(t===null){
    menu.innerHTML='<div style="padding:7px 10px;font-size:11.5px;color:var(--k-b45309,#b45309);border-bottom:1px solid var(--line)">⚠ Canonical-Suche nicht erreichbar – alte Stammliste als Rückfall. '+esc(_fgzV2.fehler)+'</div>';
    return false;   /* Aufrufer hängt die Legacy-Liste an */
  }
  if(!t.length){
    menu.innerHTML='<div style="padding:8px 10px;font-size:12px;color:var(--muted);line-height:1.5">'
      +'Keine <b>Canonical-Identität</b> zu „'+esc(_fgzV2.q)+'".'
      +'<br><span style="font-size:11.5px">Tippen und speichern geht weiter – die Zeile läuft dann über den bisherigen Weg. '
      +'Die alten Schreibweisen werden bewusst nicht mehr vorgeschlagen.</span></div>';
    menu.style.display="block";
    return true;
  }
  menu.innerHTML='<div style="padding:5px 10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--line)">Canonical · Identität wählen, dann Verarbeitung</div>'
    +t.map(function(x){
      return '<div style="padding:7px 10px 3px;font-size:13px;font-weight:700;color:var(--ink)">'+esc(String(x.name||""))
        +' <span style="font-weight:400;font-size:11.5px;color:var(--muted)">'+esc(String(x.category||""))+'</span></div>'
        +(Array.isArray(x.contexts)?x.contexts.map(function(c){ return _fgzKontextHtml(x,c); }).join(""):"");
    }).join("");
  menu.style.display="block";
  return true;
}
async function fgzCanonPick(el){
  var wrap=el.closest(".fgzWrap"), inp=wrap&&wrap.querySelector(".fgzName");
  var menu=el.closest(".fgzMenu"); if(menu) menu.style.display="none";
  var eid=el.getAttribute("data-eid"), mod=el.getAttribute("data-mod");
  var nm=el.getAttribute("data-name"), rt=el.getAttribute("data-rating");
  if(inp){
    inp.value=nm||"";
    var row=inp.closest(".fgZutRow"), rate=row&&row.querySelector(".fgzRate");
    if(rate) rate.value=(rt===""?"":rt);
    var rk=row&&row.querySelector(".fgzRiki"); if(rk) rk.style.display="none";
  }
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid || !eid){
    /* Ohne Produkt_ID kann nicht gebunden werden — der Name steht trotzdem im
       Feld und wird beim Speichern über den bisherigen Weg verarbeitet. */
    try{ toast&&toast("Ohne Produkt-Nummer wird noch nicht gebunden – beim Speichern entsteht sie."); }catch(e){}
    return;
  }
  var refId=null;
  try{
    var pz=(((window._fgRefV2||{}).d)||{}).pruefzeilen||[];
    var k=String(nm||"").trim().toLowerCase();
    var kand=pz.filter(function(p){
      return p && String(p.Manueller_Status||"OFFEN")==="OFFEN"
        && (String(p.Erkannter_Name||"").trim().toLowerCase()===k
         || String(p.Original_Text||"").trim().toLowerCase()===k);
    });
    if(kand.length===1) refId=kand[0].Referenz_ID;
  }catch(e){ console.error("[Canonical] Referenzzeile bestimmen:", e); }
  try{
    var r=await client.rpc("cb_admin_canonical_zutat_binden",
      {p_produkt_id:pid, p_entity_id:eid, p_processing_modifier:mod||"unspecified_processing", p_referenz_id:refId});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(!d||d.ok!==true) throw new Error((d&&(d.fehler||d.grund))||"Der Server hat die Bindung nicht bestätigt.");
    try{ toast&&toast("Gebunden: "+(d.canonical_name||nm)+" · "+(d.processing_modifier||mod)
      +(d.rating!=null?(" · Rating "+d.rating):" · Rating nicht belegt")); }catch(e){}
    var row2=inp&&inp.closest(".fgZutRow"), rate2=row2&&row2.querySelector(".fgzRate");
    if(rate2) rate2.value=(d.rating!=null?String(d.rating):"");
    try{ if(typeof fgRefV2Laden==="function") await fgRefV2Laden(); }catch(e){}
    try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  }catch(e){
    console.error("[Canonical] cb_admin_canonical_zutat_binden:", e);
    alert("Die Bindung wurde NICHT gespeichert.\n\n"+((e&&e.message)||e)
      +"\n\nDer Name steht im Feld und geht beim Speichern den bisherigen Weg.");
  }
}
/* ────────────────────────────────────────────────────────────────────────────
   WORK #308 — WELCHE GEBUNDENE ZUTAT FEHLT IN DER ARBEITSLISTE?
   Vergleicht den serverseitigen Bestand (window._fgCanon) mit dem, was beim
   Speichern rausginge. Beide Namen zaehlen: der sichtbare Legacy-Name UND der
   canonical Name - sie duerfen auseinanderlaufen ("Datteln" / "Dattel"), und
   ein zu strenger Vergleich wuerde jedes Speichern blockieren.
   Kennt der Browser den Serverstand nicht, wird NICHTS behauptet: eine leere
   Rueckgabe heisst hier "kein belegter Verlust", nicht "alles in Ordnung".
   ────────────────────────────────────────────────────────────────────────── */
function _fgGebundeneFehlen(zut){
  try{
    var canon=window._fgCanon;
    if(!Array.isArray(canon)||!canon.length) return [];
    var da={};
    (Array.isArray(zut)?zut:[]).forEach(function(z){
      var n=String((z&&z.name)||"").trim().toLowerCase(); if(n) da[n]=true; });
    var fehlt=[];
    canon.forEach(function(c){
      if(!c) return;
      var sicht=String(c.sichtbarer_name||"").trim();
      var kanon=String(c.canonical_name||"").trim();
      if(!sicht && !kanon) return;
      if(da[sicht.toLowerCase()] || da[kanon.toLowerCase()]) return;
      var zeig=kanon||sicht;
      if(fehlt.indexOf(zeig)===-1) fehlt.push(zeig);
    });
    return fehlt;
  }catch(e){ console.error("[#308 Bestandsprobe]",e); return []; }
}
if(typeof window!=="undefined"){ window._fgGebundeneFehlen=_fgGebundeneFehlen; }
/* Gebundene Zeilen zeigen den serverseitigen Canonical-Wert; Legacy-Namen sind kein Default. */
async function fgCanonLaden(pid){
  window._fgCanon=null; window._fgCanonFehler="";
  if(!pid) return;
  try{
    var r=await client.rpc("cb_admin_produkt_zutaten",{p_produkt_id:pid});
    if(r&&r.error) throw r.error;
    window._fgCanon=Array.isArray(r&&r.data)?r.data:[];
  }catch(e){
    console.error("[Canonical] cb_admin_produkt_zutaten:", e);
    window._fgCanonFehler=(e&&e.message)?String(e.message):String(e);
  }
}
/* ────────────────────────────────────────────────────────────────────────────
   ZUORDNUNGSSTAND DER ZUTATEN — Work #181 Stufe 5, Serververtrag aus Work #191
   ----------------------------------------------------------------------------
   Der Editor entscheidet NICHT mehr selbst, ob eine Zutat im Stamm steht.
   cb_admin_zutat_zuordnungsstatus liefert je Zeile genau einen von vier Zustaenden:
     gebunden         fest mit dem Stamm verknuepft
     vorschlag_offen  Server hat einen Treffer (auch ueber Synonyme), nicht bestaetigt
     kein_treffer     Server hat gesucht und nichts gefunden
     nicht_gefragt    Server wurde nicht erreicht
   Verifiziert an P32667: 4 gebunden + "White Tiger Garnelen" -> vorschlag_offen,
   Garnele, synonym, 0,95. Genau der Fall, der vorher zwei Antworten gleichzeitig gab.

   ⚠ Faellt der Abruf aus, bleibt window._fgZuordnung null und der Editor sagt NICHTS
   ueber die Zuordnung - er behauptet nicht ersatzweise "alles in Ordnung". Ein stiller
   Rueckfall auf den alten Textvergleich waere die zweite Wahrheit zurueck.
   ──────────────────────────────────────────────────────────────────────────── */
async function fgZuordnungLaden(pid){
  window._fgZuordnung=null; window._fgZuordnungFehler="";
  /* 🔴 26.08.2026, P73652 — "laeuft noch" ist NICHT dasselbe wie "ging schief".
     Vorher gab es nur einen Zustand: kein Stand da. Die Leiste meldete deshalb
     "Zuordnungsstand nicht geladen", solange der Abruf noch unterwegs war — und
     blieb dabei stehen, weil niemand nach der Antwort neu rendert. Ab hier sind
     es zwei Zustaende, und der Renderweg wird nachgezogen. */
  window._fgZuordnungLaeuft=true;
  if(!pid){ window._fgZuordnungLaeuft=false; return; }
  try{
    var r=await client.rpc("cb_admin_zutat_zuordnungsstatus",{p_produkt_id:pid});
    if(r&&r.error) throw r.error;
    window._fgZuordnung={ produkt_id:pid, zeilen:Array.isArray(r&&r.data)?r.data:[], stand:Date.now() };
  }catch(e){
    console.error("[Zuordnung] cb_admin_zutat_zuordnungsstatus:", e);
    window._fgZuordnungFehler=(e&&e.message)?String(e.message):String(e);
  }
  /* 🔴 23.08.2026, Nachzug zu Stufe 5 — GEMESSEN, nicht vermutet.
     Die Antwort kommt asynchron. Der Schrittstreifen wird aber gebaut, BEVOR sie da
     ist, und danach nicht mehr. Folge, live an P32667 gesehen: oben im Statusband
     stand bereits "1 Zutat mit offenem Vorschlag", im Streifen links weiter
     "1 Zutat nicht im Stamm" — zwei Wortlaute fuer denselben Zustand, also genau
     der Widerspruch, den Stufe 5 beseitigen sollte, nur eine Ebene tiefer.
     Der Wert war richtig (zVorschlagOffen=1) und fgZuordnungWort lieferte den
     richtigen Satz; nur las ihn niemand mehr.
     Deshalb: sobald die Antwort da ist, den Status neu rechnen und die Schrittknoepfe
     neu bauen. Beides sind vorhandene Funktionen - hier wird nichts nachgebaut. */
  window._fgZuordnungLaeuft=false;
  try{
    if(typeof getErfassungsStatus==="function") getErfassungsStatus();
    if(typeof feFokusAn==="function" && feFokusAn() && typeof feFokusNavBauen==="function") feFokusNavBauen();
    if(typeof feStatusStreifen==="function") feStatusStreifen();
    /* Die Bestandteilliste haengt am selben Stand: ohne sie bleibt die Sammelleiste
       auf dem Satz stehen, den sie vor der Antwort gebaut hat. */
    if(typeof fgPickRender==="function") fgPickRender();
  }catch(e){ console.error("[Zuordnung] Anzeige nachziehen:", e); }
}
if(typeof window!=="undefined"){ window.fgZuordnungLaden=fgZuordnungLaden; }
/* DER EINE ORT FUER DEN WORTLAUT — Work #181 Stufe 5.
   "nicht im Stamm" war der alte Sammelbegriff fuer alles, was nicht gebunden ist.
   Seit #191 unterscheidet der Server zwei Faelle, und die brauchen zwei Woerter:
     vorschlag_offen  Treffer da (auch ueber Synonyme), nur nicht bestaetigt  -> "Vorschlag offen"
     kein_treffer     Server hat gesucht und nichts gefunden                  -> "nicht im Stamm"
   Genau hier entstand Ralphs Widerspruch: "White Tiger Garnelen" wurde als
   "nicht im Stamm" gezaehlt, waehrend die Zeile darunter den Synonymtreffer zeigte.
   Die ZAHL war nach Teil A schon richtig - nur das WORT war es nicht.
   Faellt die Serverantwort aus, bleibt der alte Sammelbegriff: lieber ungenau
   als still falsch. */
function fgZuordnungWort(anzahl){
  var n=Number(anzahl)||0;
  var z="Zutat"+(n===1?"":"en");
  var R=window._fgStatusRoh;
  if(!R || R.zVorschlagOffen==null || R.zKeinTreffer==null) return n+" "+z+" nicht im Stamm";
  var v=R.zVorschlagOffen, k=R.zKeinTreffer;
  if(v>0 && k>0) return v+" "+(v===1?"Vorschlag":"Vorschläge")+" offen · "+k+" ohne Treffer";
  if(v>0)        return v+" "+("Zutat"+(v===1?"":"en"))+" mit offenem Vorschlag";
  if(k>0)        return k+" "+("Zutat"+(k===1?"":"en"))+" nicht im Stamm";
  return n+" "+z+" offen";
}
if(typeof window!=="undefined"){ window.fgZuordnungWort=fgZuordnungWort; }
function fgCanonAnwenden(){
  var rows=window._fgCanon; if(!Array.isArray(rows)||!rows.length) return 0;
  var nach={};
  rows.forEach(function(z){
    [z.canonical_name, z.sichtbarer_name].forEach(function(n){
      var k=String(n||"").trim().toLowerCase(); if(k && !nach[k]) nach[k]=z;
    });
  });
  var n=0;
  [].forEach.call(document.querySelectorAll("#fe_zutRows .fgZutRow"), function(row){
    var inp=row.querySelector(".fgzName"); if(!inp) return;
    var z=nach[String(inp.value||"").trim().toLowerCase()]; if(!z) return;
    var rate=row.querySelector(".fgzRate");
    /* Nur setzen, wenn der Vertrag wirklich eine Zahl hat. NULL heißt „nicht
       belegt" und darf die vorhandene Anzeige nicht mit einer 0 überschreiben. */
    if(rate && z.resolved_rating!=null) rate.value=String(z.resolved_rating);
    var alt=row.nextElementSibling;
    if(alt && alt.classList && alt.classList.contains("fgCanonZeile")) alt.remove();
    var mod=String(z.processing_modifier||"").trim();
    var txt=(mod && mod!=="unspecified_processing")?mod:"Verarbeitung nicht belegt";
    var zahl=(z.resolved_rating!=null)?String(z.resolved_rating):"nicht belegt";
    var grau=(z.resolved_rating==null);
    row.insertAdjacentHTML("afterend",
      '<div class="fgCanonZeile" style="padding:0 0 5px 2px;margin-top:-3px;font-size:11.5px;color:'
      +(grau?"var(--muted)":"var(--k-166534,#166534)")+'">'+esc(txt)+' · '+esc(zahl)
      +(z.canonical_name?' <span style="color:var(--muted)">· '+esc(String(z.canonical_name))+'</span>':'')+'</div>');
    n++;
  });
  return n;
}
async function fgZusV2Laden(pid){
  window._fgZusV2=null; window._fgZusV2Fehler="";
  if(!pid) return;
  try{
    var r=await client.rpc("cb_app_produkt_zusatzstoffe",{p_produkt_id:pid});
    if(r&&r.error) throw r.error;
    window._fgZusV2=(r&&r.data)||null;
  }catch(e){
    console.error("[Bestandteile] cb_app_produkt_zusatzstoffe:", e);
    window._fgZusV2Fehler=(e&&e.message)?String(e.message):String(e);
  }
}
/* Offene Etikettbestandteile bleiben als Referenzprüfung sichtbar; fehlende Bindung nicht als Verlust darstellen. */
async function fgZutOffenLaden(pid){
  /* Work #299: der Bestand traegt jetzt seine Produkt-ID mit — so wie _fgZuordnung
     das seit #218 tut. Ohne sie kann der Renderer nicht unterscheiden, ob die Liste
     zum offenen Produkt gehoert oder noch vom vorherigen stammt. Gemessen 26.08. an
     P73652/P73653: die Kakaonibs standen serverseitig korrekt an P73652, im Browser
     aber am Magnesium-Produkt. */
  window._fgZutOffen=null; window._fgZutOffenFehler=""; window._fgZutOffenVorschlag={};
  window._fgZutOffenPid=String(pid||"");
  if(!pid) return;
  try{
    var r=await client.rpc("cb_admin_zutat_offen_mit_riki",{p_product_id:pid});
    if(r&&r.error) throw r.error;
    var rows=Array.isArray(r&&r.data)?r.data:[];
    /* 🔴 28.08.2026, Ralphs Fund: "die blauen wurden aufgebrochen und sind in
       den zutaten. warum werden sie dann noch angezeigt?"
       GEMESSEN: cb_admin_zutat_offen_mit_riki liefert NICHT nur offene Zeilen,
       sondern ALLE gelesenen - auch die laengst entschiedenen. Die alte Annahme
       "der neue Leseweg liefert nur offene" setzte deshalb ist_offen=true fuer
       jede Zeile und liess erledigte Zeilen ewig stehen; sie blockierten zu
       Unrecht die Freigabe. Der Zustand wird jetzt aus den Serverfeldern
       abgeleitet, nicht behauptet:
         target_id            -> die Zeile ist einer Produktzutat zugeordnet
         manual_decision_kind -> ein Mensch hat sie entschieden (zerlegt/keine)
       Beides heisst erledigt. Nur was keins von beidem hat, ist offen. */
    /* Den Zustand liefert cb_admin_zutat_offen - sie kennt ALLE fuenf Wege,
       auf denen eine Etikettzeile erledigt sein kann (gebunden ueber Name,
       ueber Synonym, ueber Canonical, erledigt_am, Handentscheid). Die
       Riki-Sicht fuehrt das Feld nicht mit; sie wird deshalb damit ergaenzt.
       Zwei Abfragen, EIN Urteil - der Zustand wird geholt, nicht geraten.
       (28.08.: vorher stand hier ist_offen=true fuer jede Zeile, danach eine
       eigene Ableitung aus target_id/Entscheid - beides erkannte "laengst
       gebunden" nicht und liess erledigte Zeilen die Freigabe blockieren.) */
    var _zustand = {};
    try{
      var rz = await client.rpc("cb_admin_zutat_offen", {p_produkt_id: pid});
      if(!(rz && rz.error) && Array.isArray(rz && rz.data)){
        rz.data.forEach(function(x){
          if(x && x.zutat_text!=null) _zustand[String(x.zutat_text).trim().toLowerCase()] = !!x.ist_offen;
        });
      }
    }catch(e){ console.error("[Offene Zutaten] Zustand:", e); }
    rows.forEach(function(z){
      if(!z) return;
      var k = String(z.zutat_text||"").trim().toLowerCase();
      if(Object.prototype.hasOwnProperty.call(_zustand, k)) z.ist_offen = _zustand[k];
      else if(z.ist_offen===undefined)  z.ist_offen = !z.target_id && !z.manual_decision_kind;
    });
    window._fgZutOffen=rows;
    await _fgZutOffenVorschlaegeLaden(rows);
  }catch(e){
    console.error("[Offene Zutaten] cb_admin_zutat_offen_mit_riki:", e);
    window._fgZutOffenFehler=(e&&e.message)?String(e.message):String(e);
  }
}
function _fgOffVorschlagKey(z){
  /* item_id ist nicht an jeder Zeile gesetzt (Zutat_Offen ohne Bruecke). Der
     Text ist der zweite Teil des Schluessels, weil er der Aufrufparameter ist. */
  return String((z&&z.item_id)||"")+"|"+String((z&&z.zutat_text)||"").trim().toLowerCase();
}
async function _fgZutOffenVorschlaegeLaden(rows){
  window._fgZutOffenVorschlag={};
  if(!Array.isArray(rows)||!rows.length) return;
  var zeilen=rows.filter(function(z){
    return z && z.ist_offen===true && !z.manual_decision_kind && String(z.zutat_text||"").trim();
  });
  if(!zeilen.length) return;
  await Promise.all(zeilen.map(async function(z){
    var k=_fgOffVorschlagKey(z), txt=String(z.zutat_text||"").trim();
    try{
      /* Work #291: derselbe Vorschlag, aber mit canonical entity_id je Kandidat.
         Ohne die war jeder Kandidat nur Text - binden liess sich keiner. */
      var r=await client.rpc("cb_admin_zutat_zeile_bearbeiten",{p_zutat_text:txt});
      if(r&&r.error) throw r.error;
      var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e2){} }
      window._fgZutOffenVorschlag[k]={d:(d&&typeof d==="object")?d:null,fehler:""};
    }catch(e){
      /* Je Zeile eigener Fangblock: ein gescheiterter Vorschlag darf die
         uebrigen Zeilen nicht mitreissen und die Maske nicht blockieren. */
      console.error("[#139 Stammvorschlag]",txt,e);
      window._fgZutOffenVorschlag[k]={d:null,fehler:(e&&e.message)?String(e.message):String(e)};
    }
  }));
}
function _fgOffVorschlagHtml(z){
  var st=(window._fgZutOffenVorschlag||{})[_fgOffVorschlagKey(z)];
  if(!st) return "";
  var W='<span class="fgOffVorschlag" style="display:block;margin-top:3px;font-size:11px;line-height:1.45">';
  if(st.fehler){
    return W+'<span style="color:var(--k-b45309,#b45309)">⚠ Stammvorschlag nicht abrufbar</span>'
      +'<span style="color:var(--muted)"> · '+esc(st.fehler)
      +' · Die Zeile bleibt bedienbar; es wird NICHT behauptet, der Stamm kenne sie nicht.</span></span>';
  }
  var d=st.d; if(!d) return "";
  if(d.ok===false){
    return W+'<span style="color:var(--k-b45309,#b45309)">⚠ Stamm nicht befragt</span>'
      +'<span style="color:var(--muted)"> · '+esc(String(d.grund||"ohne Angabe"))+'</span></span>';
  }
  var s=String(d.status||""), kopf;
  if(s==="OK"){
    kopf='<span style="color:var(--k-166534,#166534)">✓ im Stamm gefunden: <b>'+esc(String(d.stammname||"ohne Stammnamen"))+'</b></span>';
  }else if(s==="UNBEKANNT"){
    kopf='<span style="color:var(--k-b45309,#b45309)">✕ im Stamm nicht gefunden</span>';
  }else if(s){
    kopf='<span style="color:var(--k-b45309,#b45309)">⚠ Stamm: '+esc(s)+'</span>';
  }else{
    kopf='<span style="color:var(--muted)">Stammvorschlag ohne Status</span>';
  }
  /* Genau die Felder, die zurueckkamen. „nicht belegt" ist eine Aussage ueber
     die Antwort, keine ersatzweise Zahl. */
  var t=[];
  t.push('Note '+(d.note!=null?esc(String(d.note)):'nicht belegt'));
  t.push('Sicherheit '+(d.sicherheit!=null?esc(String(d.sicherheit)):'nicht belegt'));
  if(d.treffer_art) t.push('Treffer '+esc(String(d.treffer_art)));
  if(d.zutat_id) t.push('Stamm-ID '+esc(String(d.zutat_id)));
  if(d.grund) t.push('grund: '+esc(String(d.grund)));
  /* 🔴 WORK #309, Ralph 26.08.: "darstellung ist scheisse, viel zuviel text."
     Er hatte recht. Hier stand eine Debugzeile - Note, Sicherheit, Treffer-Art,
     Stamm-ID und Grund als Fliesstext, jedes Mal, auch wenn darunter fuenf
     brauchbare Vorschlaege standen. Die Zahlen sind nicht falsch, sie sind nur
     nicht die Arbeit. Sie liegen jetzt hinter "Details" und sind dort
     VOLLSTAENDIG - nichts wird weggelassen, nur weggeklappt.
     Gibt es bindbare Vorschlaege, verschwindet auch der Kopf "im Stamm nicht
     gefunden": er widerspricht der Liste darunter, die sehr wohl etwas gefunden
     hat. */
  var _kdAlle=Array.isArray(d.kandidaten)?d.kandidaten:[];
  var _kdBind=_kdAlle.filter(function(k){ return k && k.entity_id; });
  var H=W;
  if(!(s==="UNBEKANNT" && _kdBind.length)) H+=kopf;
  if(t.length){
    H+='<span style="color:var(--muted);font-size:10.5px"> '
      +'<span class="fgOffDetTgl" onclick="fgOffDetails(this)" style="cursor:pointer;text-decoration:underline dotted"'
      +' title="Die vollständige Serverantwort zu dieser Zeile">Details</span>'
      +'<span class="fgOffDet" style="display:none"> · '+t.join(' · ')+'</span></span>';
  }
  var wn=Array.isArray(d.warnungen)?d.warnungen:[];
  if(wn.length){
    H+='<span style="display:block;color:var(--k-b45309,#b45309)">⚠ '
      +esc(wn.map(function(w){ return (w&&typeof w==="object")?JSON.stringify(w):String(w); }).join(" · "))+'</span>';
  }
  /* ──────────────────────────────────────────────────────────────────────────
     WORK #291, 26.08.2026 — RALPH: "buttons nicht sinnvoll und ohne funktion,
     ich kann hier garnichts machen".
     Hier stand die Kandidatenliste als Fliesstext mit dem Zusatz "KEINE Zuordnung".
     Das war damals richtig: der Vorschlag lieferte nur die LEGACY-Id (ZG-…), und
     cb_admin_canonical_zutat_binden braucht die canonical entity_id. Es gab also
     schlicht keinen Weg vom Kandidaten zur Bindung — der Satz beschrieb eine Luecke,
     keine Regel.
     Die Bruecke lag seit dem 11.08. in shadow_v1.legacy_ingredient_binding und war
     nicht angeschlossen. Seit #291 liefert der Leseweg die entity_id mit, und der
     Kandidat wird zu dem, was er immer sein sollte: ein Knopf.
     Was NICHT passiert: nichts bindet sich von allein, der Server entscheidet weiter
     allein ueber Identitaet und Note, und ein Kandidat ohne entity_id sagt das
     ausdruecklich, statt einen toten Knopf anzubieten.
     ────────────────────────────────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────────────────────────────────
     WORK #309 — RALPH: "viel zuviel text, herleitung warum dattel passt nicht
     ersichtlich, wie es durch das regelwerk laeuft."
     Was hier stand und warum es weg ist:
       · "Ähnlichkeit 0.69 · aehnlichkeit"  — die Art hiess wie die Zahl daneben,
         das Wort stand also doppelt. Jetzt: "ähnlich 0.69", die Art im title.
       · Die Begruendung war bei allen fuenf Kandidaten WORTGLEICH ("Aehnlichkeit
         nach Entfernen beschreibender Praefixe") und stand fuenfmal untereinander.
         Jetzt einmal ueber der Liste, wenn sie sich nicht unterscheidet.
       · Nicht bindbare Kandidaten standen gleichberechtigt zwischen den bindbaren.
         Jetzt liegen sie hinter einem Aufklapper - sie sind kein Arbeitsweg.
     🔴 DIE HERLEITUNG: Ralph will sehen, WARUM Dattel eine 10 bekommt. Die Regel
     dazu existiert (Dattel → "Stufe 10 - roh", Kakaopulver → BR-STAFFEL-KAKAO),
     aber cb_admin_zutat_zeile_bearbeiten liefert je Kandidat weder rule_id noch
     Titel. Das Feld steht hier bereit und bleibt LEER, solange der Server nichts
     schickt - geraten wird nichts (Work #310 an chatgpt).
     ────────────────────────────────────────────────────────────────────────── */
  /* 🔴 WORK #312 — RALPH, 26.08.: "nibs sind bereits bewertet, also darf der
     button garnicht erscheinen."
     Er hat recht, und der Fehler war meiner. Die Dublettenprobe gab es seit
     #291 - aber sie lief ERST BEIM KLICK. Der Knopf wurde angeboten, Ralph
     klickte, und dann erst kam "Steht bereits als Kakao-Nibs am Produkt".
     Ein Knopf, der nur da ist, um beim Druecken abzulehnen, ist kein Knopf.
     Dieselbe Probe, dieselbe Quelle (window._fgCanon), nur beim Rendern. */
  var _amProdukt={};
  try{
    (Array.isArray(window._fgCanon)?window._fgCanon:[]).forEach(function(c){
      var e=String((c&&c.canonical_entity_id)||""); if(e) _amProdukt[e]=c;
    });
  }catch(e){ console.error("[#312 Bestandsprobe]",e); }
  var kd=_kdAlle;
  if(kd.length){
    var _bind=_kdBind.filter(function(k){ return !_amProdukt[String(k.entity_id)]; });
    var _schon=_kdBind.filter(function(k){ return !!_amProdukt[String(k.entity_id)]; });
    var _tot=kd.filter(function(k){ return !(k&&k.entity_id); });
    /* Eine Begruendung, die bei allen gleich ist, ist eine Aussage ueber das
       Verfahren - nicht ueber den einzelnen Kandidaten. Also einmal, nicht n-mal. */
    var _gr=kd.map(function(k){ return String((k&&k.begruendung)||"").trim(); }).filter(Boolean);
    var _grGleich=(_gr.length===kd.length && _gr.length>1 && _gr.every(function(x){ return x===_gr[0]; }));
    function _kandZeile(k, tot){
      var nm=String((k&&k.zutat)||"").trim();
      var eid=String((k&&k.entity_id)||"");
      var note=((k&&k.note!=null)?String(k.note):null);
      var nf=(note==null)?"var(--muted)":(Number(note)>=7?"var(--k-2e9e57,#2e9e57)":(Number(note)>=4?"var(--k-c88616,#c88616)":"var(--k-cf5442,#cf5442)"));
      var zeile='<span style="display:flex;align-items:baseline;gap:7px;margin-top:3px;padding-left:8px;flex-wrap:wrap">';
      if(eid && !tot){
        zeile+='<button type="button" class="fgOffBtn fgOffPrimaer" '
          +'onclick="fgOffKandidatBinden(\''+esc(eid)+'\',\''+esc(nm.replace(/'/g,"\\'"))+'\',\''
            +esc(String((z&&z.zutat_text)||"").replace(/'/g,"\\'"))+'\',this)" '
          +'title="Diese Zeile an den Stammeintrag '+esc(nm)+' binden. Die Note kommt danach vom Server, nicht von hier.">'
          +esc(nm)+'</button>';
      }else{
        zeile+='<span style="color:var(--muted)">'+esc(nm)+'</span>';
      }
      zeile+='<span style="font-weight:700;color:'+nf+'">'+(note==null?'–':esc(note))+'</span>';
      /* 🔴 Die Regel-Herleitung, sobald der Server sie mitschickt. Kein Ersatztext,
         keine geratene Regel - fehlt sie, steht hier nichts. */
      var rt=String((k&&(k.regel_titel||k.rule_titel))||"").trim();
      var rid=String((k&&(k.rule_id||k.regel_id))||"").trim();
      var rh=String((k&&(k.regel_herleitung||k.regel_inhalt))||"").trim();
      if(rt||rid){
        zeile+='<span style="color:var(--k-534ab7,#534ab7);font-size:10.5px"'
          +(rh?(' title="'+esc(rh)+'"'):'')+'>nach Regel: '+esc(rt||rid)+'</span>';
      }
      if(k&&k.aehnlichkeit!=null){
        zeile+='<span style="color:var(--muted);font-size:10.5px"'
          +((k&&k.art)?(' title="Trefferart: '+esc(String(k.art))+'"'):'')
          +'>ähnlich '+esc(String(k.aehnlichkeit))+'</span>';
      }
      if(tot) zeile+='<span style="color:var(--k-b45309,#b45309);font-size:10.5px" '
        +'title="Zu diesem Stammnamen gibt es keine canonical Identitaet. Binden wuerde ins Leere greifen.">nicht bindbar</span>';
      zeile+='</span>';
      if(!_grGleich && k && k.begruendung)
        zeile+='<span style="display:block;padding-left:16px;color:var(--muted);font-size:10.5px">'+esc(String(k.begruendung))+'</span>';
      return zeile;
    }
    if(_bind.length){
      H+='<span style="display:block;color:var(--muted);margin-top:4px">'
        +_bind.length+' Vorschlag'+(_bind.length===1?"":"e")+' aus dem Stamm – anklicken ordnet zu'
        +(_grGleich?('<span style="font-size:10.5px"> · '+esc(_gr[0])+'</span>'):'')+':</span>'
        +_bind.map(function(k){ return _kandZeile(k,false); }).join("");
    }
    /* ──────────────────────────────────────────────────────────────────────
       WORK #316 — RALPH: "nibs sind gebunden, kasten steht immer noch auf
       1 zutat nicht gebunden. für mich ist das vollständig."
       Er hatte recht, und #312 war nur die halbe Antwort: der Knopf war weg,
       die Zeile blieb offen. GEMESSEN, warum:
         cb_zutat_match_id_schnell('Rohe Bio-Kakaonibs')  ->  NULL
         cb_admin_zutat_offen_vorschlag findet "Kakao-Nibs", Ähnlichkeit 0.615
       Zwei Matcher, ein Widerspruch. cb_admin_zutat_offen kennt vier Wege,
       eine Zeile als gebunden zu erkennen - alle vier hängen am scharfen
       Matcher. Der fünfte fehlte: der Mensch, der sagt "das ist dieselbe".
       Diese Aussage hat jetzt einen Ort (Zutat_Offen.zutat_id + erledigt_am)
       und hier ihren Knopf. Danach greift Weg 1 der unveränderten Lesefunktion.
       ────────────────────────────────────────────────────────────────────── */
    /* ──────────────────────────────────────────────────────────────────────
       27.08.2026, RALPH: "beim klick auf zerlegt erhalte ich eine meldung ...
       und die darstellung im gelben kasten gefaellt mir nicht."
       GEMESSEN an P73634 "Trockenobst (78 % getrocknete Datteln, 12 %
       Kakaopulver)": der Kasten bot ZWEIMAL "ist dieselbe - erledigt" an,
       einmal fuer Dattel, einmal fuer Kakaopulver. Beides ist fachlich falsch:
       eine Zeile kann nicht gleichzeitig zwei verschiedene Zutaten SEIN. Sie
       ist die Summe - der richtige Abschluss heisst "ist zerlegt".
       Ab jetzt entscheidet die ANZAHL der bereits gebundenen Teile, welcher
       Weg angeboten wird. Ein Teil -> "ist dieselbe". Mehrere Teile -> ruhige
       Chipliste und der Zerlegt-Abschluss als einziger Primaerweg.
       ────────────────────────────────────────────────────────────────────── */
    if(_schon.length){
      var _mehr = _schon.length > 1;
      if(_mehr){
        H+='<span style="display:block;margin-top:6px;font-size:11.5px;color:var(--muted)">'
          +'Diese Zeile beschreibt eine Zusammensetzung. Ihre Teile stehen bereits am Produkt:</span>'
          +'<span style="display:block;margin-top:4px">'
          + _schon.map(function(k){
              var c=_amProdukt[String(k.entity_id)]||{};
              var nm=String(c.canonical_name||c.sichtbarer_name||k.zutat||"").trim();
              return '<span style="display:inline-block;background:var(--k-e6f4ea,#e6f4ea);'
                +'border:1px solid var(--k-2e9e57,#2e9e57);border-radius:12px;padding:2px 9px;'
                +'margin:2px 4px 2px 0;font-size:11.5px">✓ '+esc(nm)
                +((c.resolved_rating!=null)?('<span style="color:var(--muted)"> · Wert '+esc(String(c.resolved_rating))+'</span>'):'')
                +'</span>';
            }).join('')
          +'</span>'
          +'<span style="display:block;margin-top:3px;font-size:11px;color:var(--muted)">'
          +'Passt das? Dann unten auf <b>erledigt &ndash; ist zerlegt</b>.</span>';
      }else{
        H+='<span style="display:block;margin-top:4px;color:var(--k-166534,#166534)">'
        + _schon.map(function(k){
          var c=_amProdukt[String(k.entity_id)]||{};
          var nm=String(c.canonical_name||c.sichtbarer_name||k.zutat||"").trim();
          var pzid=String(c.produkt_zutat_id||"");
          var txt=String((z&&z.zutat_text)||"").trim();
          var zeile='✓ steht bereits als <b>'+esc(nm)+'</b> am Produkt'
            +((c.resolved_rating!=null)?('<span style="color:var(--muted)"> · Wert '+esc(String(c.resolved_rating))+'</span>'):'');
          if(pzid && txt){
            zeile+=' <button type="button" class="fgOffBtn fgOffPrimaer" '
              +'onclick="fgOffDieselbeZutat(\''+esc(txt.replace(/'/g,"\\'"))+'\',\''+esc(pzid)+'\',\''
                +esc(nm.replace(/'/g,"\\'"))+'\',this)" '
              +'title="Haelt fest, dass diese Etikettzeile dieselbe Zutat meint wie '+esc(nm)
              +'. Die Zeile ist danach erledigt.">'
              +'✓ ist dieselbe &ndash; erledigt</button>';
          }
          return zeile;
        }).join('<br>')
        +'</span>';
      }
    }
    if(_tot.length){
      H+='<span style="display:block;margin-top:3px;padding-left:8px">'
        +'<span class="fgOffDetTgl" onclick="fgOffDetails(this)" style="cursor:pointer;color:var(--muted);'
        +'font-size:10.5px;text-decoration:underline dotted" '
        +'title="Diese Stammnamen haben keine canonical Identitaet - binden wuerde ins Leere greifen.">'
        +_tot.length+' weitere'+(_tot.length===1?'r':'')+' ohne Stammidentität</span>'
        +'<span class="fgOffDet" style="display:none">'
        +_tot.map(function(k){ return _kandZeile(k,true); }).join("")+'</span></span>';
    }
  }
  return H+'</span>';
}
/* ────────────────────────────────────────────────────────────────────────────
   WORK #316 — "IST DIESELBE ZUTAT"
   Ein Aufruf, ein Serverweg: cb_admin_zutat_offen_dieselbe_zutat_setzen.
   🔴 Es wird NICHTS gebunden und NICHTS angelegt. Die Zutat hängt bereits am
   Produkt - festgehalten wird nur, dass die Etikettzeile sie meint.
   ────────────────────────────────────────────────────────────────────────── */
async function fgOffDieselbeZutat(zutatText, produktZutatId, name, btn){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid){ _fgOffMsg(btn,"Kein Produkt offen.","var(--k-b91c1c)"); return; }
  if(!zutatText||!produktZutatId){
    _fgOffMsg(btn,"Der Zeile fehlt die Zuordnung zur Produktzutat – nicht abschließbar.","var(--k-b45309)");
    return;
  }
  if(!confirm('Die gelesene Zeile\n\n  „'+zutatText+'"\n\nmeint dieselbe Zutat wie\n\n  '
    +String(name||'die gebundene Zutat')+'\n\nDie Zeile ist danach erledigt. '
    +'Es wird nichts neu gebunden und nichts doppelt angelegt.\n\n'
    +'Hinweis: Zurücknehmen geht zurzeit noch nicht über den Editor.')) return;
  if(btn){ btn.disabled=true; } _fgOffMsg(btn,"speichere …");
  try{
    var r=await client.rpc("cb_admin_zutat_offen_dieselbe_zutat_setzen",
      {p_produkt_id:pid, p_zutat_text:zutatText, p_produkt_zutat_id:produktZutatId});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(!d||d.ok!==true) throw new Error((d&&(d.fehler||d.grund))||"Der Server hat den Entscheid nicht bestätigt.");
    await _fgOffReload();
  }catch(e){
    console.error("[#316 dieselbe Zutat]",e);
    _fgOffMsgHtml(btn,_fgOffServerFehlerHtml(e));
    if(btn){ btn.disabled=false; }
  }
}
if(typeof window!=="undefined"){ window.fgOffDieselbeZutat=fgOffDieselbeZutat; }
/* Aufklapper fuer Details und nicht bindbare Kandidaten. Zeigt und verbirgt -
   mehr nicht; kein Zustand, der irgendwo gemerkt werden muesste. */
function fgOffDetails(el){
  try{
    var d=el&&el.parentNode?el.parentNode.querySelector(".fgOffDet"):null;
    if(!d) return;
    d.style.display=(d.style.display==="none")?"":"none";
  }catch(e){ console.error("[#309 Details]",e); }
}
if(typeof window!=="undefined"){ window.fgOffDetails=fgOffDetails; }
/* ────────────────────────────────────────────────────────────────────────────
   WORK #291 — EIN KLICK BINDET. Kein neuer Bindungsweg: es ist derselbe Aufruf
   cb_admin_canonical_zutat_binden, den die Verarbeitungsaenderung seit #218 nutzt.
   Die Verarbeitung bleibt zunaechst unspecified_processing; sie wird danach ueber
   die vorhandene Verarbeitungsspalte gesetzt, und die Note folgt daraus.
   ⚠ Die Note wird hier NICHT gesetzt oder geraten - sie kommt aus der Antwort.
   ──────────────────────────────────────────────────────────────────────────── */
async function fgOffKandidatBinden(entityId, name, zutatText, btn){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid){ _fgOffMsg(btn,"Kein Produkt offen.","var(--k-b91c1c)"); return; }
  if(!entityId){ _fgOffMsg(btn,"Dieser Vorschlag hat keine Identität – nicht bindbar.","var(--k-b45309)"); return; }
  /* 🔴 GEMESSEN, BEVOR GESCHRIEBEN WIRD — und zwar an genau dem Fall, der auf
     Ralphs Bild steht: P73652 hat "Kakao-Nibs" bereits gebunden, fuehrt dieselbe
     Zutat als Etikettzeile "Rohe Bio-Kakaonibs" aber weiter offen. Der Vorschlag
     bietet folgerichtig "Kakao-Nibs" an. Ein Klick haette die Zutat ein ZWEITES
     Mal an das Produkt gehaengt - mein eigener Knopf haette die Dublette gebaut,
     die er aufloesen soll. Deshalb zuerst der Bestand, dann die Bindung. */
  try{
    var schon=(Array.isArray(window._fgCanon)?window._fgCanon:[]).find(function(z){
      return String(z&&z.canonical_entity_id||"")===String(entityId);
    });
    if(schon){
      /* Work #323: hier stand nur ein Hinweis, der auf "keine eigene Zutat"
         verwies - das war der zweitbeste Weg. ChatGPT hat inzwischen den richtigen
         gebaut (#313): cb_admin_zutat_offen_dieselbe_zutat_setzen haelt fest, dass
         die Etikettzeile DIESELBE Zutat meint wie die gebundene, statt sie als
         "keine eigene Zutat" abzutun. Der Unterschied ist fachlich: das eine sagt
         "gehoert nicht dazu", das andere "ist schon da". Also wird hier der Knopf
         dafuer angeboten, statt den Benutzer auf den falschen zu schicken. */
      var _nm=String(schon.canonical_name||schon.sichtbarer_name||name);
      var _txt=String(zutatText||"");
      _fgOffMsgHtml(btn,'Steht bereits als <b>'+esc(_nm)+'</b> am Produkt – nicht doppelt zugeordnet. '
        +'<button type="button" class="fgOffBtn fgOffPrimaer" '
        +'onclick="fgOffDieselbeZutat(\''+esc(_txt.replace(/'/g,"\\'"))+'\',\''+esc(String(schon.produkt_zutat_id||""))+'\',this)" '
        +'title="Haelt fest, dass diese Etikettzeile dieselbe Zutat meint wie die bereits gebundene. Die Zeile ist danach erledigt, die Bindung bleibt unveraendert.">'
        +'ist dieselbe Zutat</button>');
      if(btn){ btn.disabled=false; }
      return;
    }
  }catch(e){ console.error("[#291 Dublettenprobe]",e); }
  if(btn){ btn.disabled=true; }
  _fgOffMsg(btn,"binde …");
  try{
    var r=await client.rpc("cb_admin_canonical_zutat_binden",
      {p_produkt_id:pid, p_entity_id:entityId, p_processing_modifier:"unspecified_processing", p_referenz_id:null});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(!d||d.ok!==true) throw new Error((d&&(d.fehler||d.grund))||"Der Server hat die Bindung nicht bestätigt.");
    _fgOffMsg(btn,"✓ zugeordnet: "+String(d.canonical_name||name)
      +(d.rating!=null?(" · Wert "+d.rating):" · Wert noch nicht belegt – Verarbeitung wählen"),"var(--k-166534)");
    /* 🔴 WORK #308 — DIE ZEILE MUSS IN DIE VERSTECKTE ALTLISTE.
       Ralph, 26.08., mit Bild: "ich habe dattel und kakaopulver zugeordnet und
       gespeichert. dann sind die beiden zutaten nicht mehr in der liste."
       GEMESSEN an P73634: die Bindung stand in der Datenbank, nach dem Speichern
       war sie weg. cb_produkt_speichern ruft cb_produkt_ingest mit
       zutaten_replace=true - die gesamte Zutatenliste wird durch das ersetzt,
       was in #fe_zutRows steht. Diese versteckte Liste wird beim Oeffnen EINMAL
       aus d.zutaten gefuellt (Zeile 4414) und von der Canonical-Bindung nie
       angefasst. Wer band und dann speicherte, loeschte seine eigene Bindung.
       Name und Note kommen aus der Serverantwort, nicht von hier. */
    try{
      var _c=document.getElementById("fe_zutRows");
      var _nm=String(d.canonical_name||name||"").trim();
      if(_c && _nm && typeof fgZutRow==="function"){
        var _key=_nm.toLowerCase();
        var _da=[].some.call(_c.querySelectorAll(".fgZutRow"),function(r){
          return ((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===_key; });
        if(!_da) _c.insertAdjacentHTML("beforeend",
          fgZutRow(_nm,(d.rating!=null?d.rating:null),"nein"));
      }
    }catch(e){ console.error("[#308 Altliste nachziehen]",e); }
    /* Vollstaendig neu laden: gebundene Liste, offene Liste, Zuordnungsstand.
       Alles vorhandene Lader - hier wird kein Zustand von Hand nachgezogen. */
    try{ if(typeof fgCanonLaden==="function") await fgCanonLaden(pid); }catch(e){}
    try{ if(typeof fgZutOffenLaden==="function") await fgZutOffenLaden(pid); }catch(e){}
    try{ if(typeof fgZuordnungLaden==="function") await fgZuordnungLaden(pid); }catch(e){}
    try{ if(typeof fgPickRender==="function") fgPickRender(); }catch(e){}
    try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  }catch(e){
    console.error("[#291 Kandidat binden]",e);
    _fgOffMsg(btn,"NICHT zugeordnet: "+((e&&e.message)||e),"var(--k-b91c1c)");
    if(btn){ btn.disabled=false; }
  }
}
if(typeof window!=="undefined"){ window.fgOffKandidatBinden=fgOffKandidatBinden; }
/* ────────────────────────────────────────────────────────────────────────────
   WORK #323 — "IST DIESELBE ZUTAT". Angeschlossen, nicht gebaut.
   Der Serverweg stammt aus #313 (ChatGPT): cb_admin_zutat_offen_dieselbe_zutat_setzen
   setzt Zutat_Offen.zutat_id und erledigt_am, danach greift der vorhandene Weg in
   cb_admin_zutat_offen. Die Bindung selbst wird NICHT angefasst - es wird nur
   festgehalten, dass die gelesene Etikettzeile dieselbe Zutat meint.
   Fachlich ist das etwas anderes als "keine eigene Zutat": das eine heisst
   "gehoert nicht dazu", das hier heisst "ist schon da".
   ──────────────────────────────────────────────────────────────────────────── */
async function fgOffDieselbeZutat(zutatText, produktZutatId, btn){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid){ _fgOffMsg(btn,"Kein Produkt offen.","var(--k-b91c1c)"); return; }
  if(!zutatText){ _fgOffMsg(btn,"Die Etikettzeile hat keinen Text – nichts festzuhalten.","var(--k-b45309)"); return; }
  if(btn){ btn.disabled=true; }
  _fgOffMsg(btn,"halte fest …");
  try{
    var r=await client.rpc("cb_admin_zutat_offen_dieselbe_zutat_setzen",
      {p_produkt_id:pid, p_zutat_text:String(zutatText), p_produkt_zutat_id:String(produktZutatId||"")||null});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(d&&d.ok===false) throw new Error(String(d.grund||"Der Server hat nichts bestätigt."));
    _fgOffMsg(btn,"✓ als dieselbe Zutat festgehalten","var(--k-166534)");
    try{ if(typeof fgZutOffenLaden==="function") await fgZutOffenLaden(pid); }catch(e){}
    try{ if(typeof fgPickRender==="function") fgPickRender(); }catch(e){}
    try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  }catch(e){
    console.error("[#323 dieselbe Zutat]",e);
    _fgOffMsg(btn,"NICHT festgehalten: "+((e&&e.message)||e),"var(--k-b91c1c)");
    if(btn){ btn.disabled=false; }
  }
}
if(typeof window!=="undefined"){ window.fgOffDieselbeZutat=fgOffDieselbeZutat; }
function _fgZutOffenFremd(){
  /* Work #299: gehoert der geladene Bestand zum gerade offenen Produkt?
     Nur wenn beide IDs gesetzt sind und auseinanderlaufen, ist er fremd —
     ein leeres _fgZutOffenPid heisst "noch nichts geladen", nicht "fremd". */
  var pid=String((window._fgEdit&&window._fgEdit.id)||"");
  var geladen=String(window._fgZutOffenPid||"");
  return !!(pid && geladen && pid!==geladen);
}
function _fgZutOffenListe(){
  var rows=window._fgZutOffen;
  if(!Array.isArray(rows)) return [];
  if(_fgZutOffenFremd()) return [];          /* Work #299: fremdes Produkt, nichts behaupten */
  return rows.filter(function(z){ return z && z.ist_offen===true; });
}
function _fgZutOffenHtml(){
  /* ════════════════════════════════════════════════════════════════════════
     28.08.2026, RALPH: "ich will keinen gelben kasten! zutaten die eine
     bewertung haben sind gruen in der zutatenliste. zutaten ohne wert sind
     dann blau in der liste." — und danach: "der kasten soll generell weg."
     Der Kasten ist ersatzlos entfallen. Die offenen Etikettzeilen erscheinen
     jetzt als BLAUE ZEILEN im selben Raster wie die gebundenen Zutaten:
     links der gelesene Text, rechts kein Wert. Die Wege (zerlegen, binden,
     Riki, kein-Zutat) haengen als schmale Knopfreihe an der Zeile - kein
     eigener Kasten, keine zweite Optik.
     Entschiedene Zeilen erscheinen GAR NICHT mehr: sie sind erledigt.
     ════════════════════════════════════════════════════════════════════════ */
  if(window._fgZutOffenFehler){
    return '<div style="padding:7px 9px;border-bottom:1px solid var(--line);background:var(--k-fef2f2,#fef2f2);font-size:11.5px">'
      +'<b style="color:var(--k-b91c1c,#b91c1c)">Offene Zutaten konnten nicht geladen werden</b> '
      +esc(window._fgZutOffenFehler)+' <span style="color:var(--muted)">– es wird NICHT behauptet, dass keine offen sind.</span></div>';
  }
  /* Work #299, 28.08. beim Umbau wieder eingezogen: ein FREMDER Produktstand
     (Editor zeigt A, geladene Liste gehoert zu B) darf nicht als "nichts
     offen" durchgehen - der Test hat den Verlust gefangen. */
  if(typeof _fgZutOffenFremd==="function" && _fgZutOffenFremd()){
    return '<div style="padding:7px 9px;border-bottom:1px solid var(--line);background:var(--k-eff6ff,#eff6ff);font-size:11.5px">'
      +'Die Liste der gelesenen Etikettzeilen gehoert noch zum vorherigen Produkt. '
      +'<span style="color:var(--muted)">Es wird NICHT behauptet, dass hier nichts offen ist.</span></div>';
  }
  var offen=_fgZutOffenListe();
  if(!offen.length) return "";
  var kopf='<div class="fgOffKopf" style="display:flex;align-items:center;gap:8px;padding:5px 8px;'
    +'border-bottom:1px solid var(--line);background:var(--k-eff6ff,#eff6ff);font-size:11.5px;color:var(--k-1e40af,#1e40af)">'
    +'<span>'+offen.length+' Zeile'+(offen.length===1?'':'n')+' vom Etikett gelesen, noch keiner Zutat zugeordnet</span>'
    +'<button type="button" class="fgOffBtn fgOffPrimaer" style="margin-left:auto" onclick="fgKetteAufbrechen(this)"'
    +' title="Zerlegt alle Klammerzeilen dieses Produkts und legt jede Unterzutat als eigene Zutat an.">'
    +'\u2699 Zutatenkette aufbrechen</button></div>'
    +'<div id="fgKetteMsg" style="padding:3px 9px;font-size:11px;color:var(--muted)"></div>';
  return kopf + offen.map(function(z){
    var nm=String(z.zutat_text||"").trim();
    var iid=String(z.item_id||"");
    var treffer=(z.resolution_status==='resolved'&&z.canonical_name)?String(z.canonical_name):"";
    return '<div class="fgOffZeile" data-item="'+esc(iid)+'" style="border-bottom:1px solid var(--line);'
      +'background:var(--k-eff6ff,#eff6ff)">'
      +'<div style="display:grid;grid-template-columns:22px 1fr 46px;gap:8px;align-items:center;padding:5px 8px">'
        +'<span style="width:12px;height:12px;border-radius:3px;background:var(--k-1e40af,#1e40af);opacity:.5"></span>'
        +'<span style="min-width:0;font-size:13px">'+esc(nm)
          +'<span style="display:block;font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
          +(treffer?('Riki-Vorschlag: '+esc(treffer)+' \u00b7 '):'')+'gelesen \u2013 noch nicht zugeordnet</span></span>'
        +'<span style="text-align:center;font-weight:700;font-size:13px;color:var(--muted)">\u2013</span>'
      +'</div>'
      /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
         M1, 29.08.2026 \u2014 RALPH: "wir haben doch jede menge zutaten bereits
         sauber im stamm. warum werden die auf der produkt erfassen seite nicht
         erkannt und gebunden?"
         GEMESSEN an P73664: _fgZutOffenVorschlaegeLaden holt fuer JEDE offene
         Zeile den Stammvorschlag (cb_admin_zutat_zeile_bearbeiten) und legt ihn
         in _fgZutOffenVorschlag ab. _fgOffVorschlagHtml baut daraus die Anzeige.
         Aufgerufen wurde sie nirgends - beim Umbau am 28.08., als der gelbe
         Kasten wegfiel, ist der Aufruf mit rausgeflogen. Der Server lieferte,
         der Browser warf weg: 17 von 21 Etikettzeilen haetten Stammnamen, Note
         und Regel-ID anzeigen koennen und zeigten "gelesen - noch nicht
         zugeordnet".
         Nur der Aufruf kommt zurueck. An der Bindung aendert sich hier nichts -
         die ist M2 und gehoert auf den Server.
         \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
      +'<div style="padding:0 8px 4px 38px">'
        +(function(){ try{ return _fgOffVorschlagHtml(z)||""; }catch(e){
            console.error("[Stammvorschlag] Anzeige:",e); return ""; } })()
      +'</div>'
      +'<div style="display:flex;gap:5px;flex-wrap:wrap;padding:0 8px 6px 38px">'
        +'<button type="button" class="fgOffBtn fgOffPrimaer" onclick="fgOffZerlegtFertig('+esc(iid)+',this)"'
        +' title="Die Zeile ist erledigt: ihre Bestandteile stehen als eigene Zutaten am Produkt.">\u2713 ist zerlegt</button>'
        +'<button type="button" class="fgOffBtn" onclick="fgOffBinden('+esc(iid)+',this)" title="Im Zutatenstamm suchen und binden.">im Stamm suchen</button>'
        +'<button type="button" class="fgOffBtn" onclick="fgOffRikiKette('+esc(iid)+',this)" title="Riki zerlegt, der Server loest auf, Riki bewertet nur mit Regelbeleg.">Riki einstufen</button>'
        +'<button type="button" class="fgOffBtn fgOffWeg" onclick="fgOffKeineZutat('+esc(iid)+',this)" title="Die Zeile ist keine eigene Produktzutat und wird gestrichen \u2013 mit Begruendung.">Zeile streichen</button>'
      +'</div>'
      +'<div class="fgOffMsg" style="display:block;font-size:11px;padding:0 8px 5px 38px"></div>'
      +'</div>';
  }).join("");
}
function _fgOffItem(iid){
  var rows=_fgZutOffenListe();
  return rows.find(function(z){ return String(z.item_id)===String(iid); })||null;
}
/* Begruendung inline abfragen statt per prompt(). Liefert den Text oder null
   bei Abbruch. Ralph 09.09.2026 - siehe Kommentar an fgOffKeineZutat. */
function _fgOffGrundFragen(btn, name){
  return new Promise(function(fertig){
    var zeile=null, box=null;
    try{ zeile=btn&&btn.closest(".fgOffZeile"); }catch(e){}
    if(!zeile){ fertig(null); return; }
    var alt=zeile.querySelector(".fgOffGrundBox");
    if(alt){ alt.remove(); }
    box=document.createElement("div");
    box.className="fgOffGrundBox";
    box.style.cssText="padding:6px 8px 8px 38px;display:flex;gap:6px;flex-wrap:wrap;align-items:center";
    box.innerHTML='<div style="flex:1 0 100%;font-size:11px;color:var(--muted);margin-bottom:3px">'
      +'„'+(window.esc?esc(name):name)+'" wird gestrichen. Warum ist das keine eigene Zutat?</div>'
      +'<input type="text" class="fgOffGrundFeld" placeholder="z. B. Erklärung der Kefir-Kulturen, keine eigenständige Zutat" '
      +'style="flex:1 1 320px;min-width:200px;font-size:12px;padding:4px 7px;border:1px solid var(--k-b9d2f0,#b9d2f0);border-radius:6px">'
      +'<button type="button" class="fgOffBtn fgOffWeg fgOffGrundOk">streichen</button>'
      +'<button type="button" class="fgOffBtn fgOffGrundAb">abbrechen</button>';
    btn.parentNode.insertAdjacentElement("afterend", box);
    var feld=box.querySelector(".fgOffGrundFeld");
    function schliessen(wert){ try{ box.remove(); }catch(e){} fertig(wert); }
    box.querySelector(".fgOffGrundOk").onclick=function(){ schliessen(feld.value); };
    box.querySelector(".fgOffGrundAb").onclick=function(){ schliessen(null); };
    feld.onkeydown=function(ev){
      if(ev.key==="Enter"){ ev.preventDefault(); schliessen(feld.value); }
      if(ev.key==="Escape"){ ev.preventDefault(); schliessen(null); }
    };
    try{ feld.focus(); }catch(e){}
  });
}
function _fgOffMsg(btn, txt, farbe){
  try{ var z=btn.closest(".fgOffZeile"), m=z&&z.querySelector(".fgOffMsg");
       if(m){ m.textContent=txt||""; m.style.color=farbe||"var(--muted)"; } }catch(e){}
}
function _fgOffMsgHtml(btn, html){
  try{ var z=btn&&btn.closest(".fgOffZeile"), m=z&&z.querySelector(".fgOffMsg");
       if(m){ m.style.color=""; m.innerHTML=html||""; } }catch(e){}
}
function _fgOffServerFehlerHtml(e){
  var roh=String((e&&e.message)||e||"").trim();
  var k=roh.toLowerCase(), kurz, weg="";
  if(k.indexOf("composition")>=0){
    kurz='Der Entscheid „keine eigene Zutat" ist an dieser Zeile nicht zulässig.';
    weg='Der Server lässt ihn nur zu, wenn die Zeile eine Klammerrolle trägt – composition, explanation oder subingredients. '
       +'An dieser Zeile ist keine hinterlegt. Möglicher Weg: „Riki prüfen & bewerten" laufen lassen; die Zerlegung kann die Rolle setzen. '
       +'Bleibt sie leer, ist der Entscheid weiterhin gesperrt – das ist Absicht, nicht ein Fehler.';
  }else if(k.indexOf("nur zutaten-items")>=0){
    kurz='Diese Zeile ist beim Server nicht als Zutat geführt.';
    weg='Der Entscheid gilt nur für Zeilen mit semantic_class „ingredient". Diese Zeile hat eine andere Einstufung.';
  }else if(k.indexOf("ungeklaerte extraktion")>=0||k.indexOf("ungeklärte extraktion")>=0){
    kurz='Die Zerlegung dieser Zeile ist noch ungeklärt.';
    weg='Solange extraction_status auf „unresolved" steht, nimmt der Server keinen Handentscheid an. Erst „Riki prüfen & bewerten", dann erneut.';
  }else if(k.indexOf("extraktionszeile nicht gefunden")>=0){
    kurz='Zu dieser Zeile gibt es beim Server keine Extraktionszeile.';
    weg='Ohne sie ist kein Handentscheid möglich – die Zeile stammt aus einer Quelle ohne Riki-Extraktionslauf.';
  }else if(k.indexOf("klammerbestandteil")>=0){
    kurz='Der angegebene Klammerbestandteil steht nicht in der Zerlegung.';
    weg='Der Server prüft ihn gegen parenthetical_items dieser Zeile.';
  }else if(k.indexOf("nur admins")>=0){
    kurz='Für diesen Schritt fehlt die Admin-Berechtigung.';
  }else{
    kurz='Der Schritt ist fehlgeschlagen.';
  }
  return '<span style="color:var(--k-b91c1c,#b91c1c);font-weight:600">'+esc(kurz)+'</span>'
    +(weg?('<span style="display:block;color:var(--ink)">'+esc(weg)+'</span>'):'')
    +'<span style="display:block;color:var(--muted)">Serverantwort: '+esc(roh)+'</span>';
}
async function _fgOffReload(){
  try{ var pid=(window._fgEdit&&window._fgEdit.id);
       if(pid){ await fgZutOffenLaden(pid); }
       if(typeof fgBestandteileRender==="function") fgBestandteileRender();
       if(typeof fePlaus==="function") fePlaus();
  }catch(e){ console.error("[#81] Neuladen:",e); }
}
/* WEG 1 — BINDEN: kein neuer Suchweg. Das vorhandene Stammsuchfeld wird mit dem
   besten bekannten Namen vorbefuellt und fokussiert; die Trefferliste des Pickers
   uebernimmt (§22 — angeschlossen, nicht neu gebaut). base_ingredient schlaegt
   zutat_text, weil er der bereinigte Suchbegriff aus der Zerlegung ist. */
function fgOffBinden(iid, btn){
  var z=_fgOffItem(iid); if(!z) return;
  var s=document.getElementById("fe_zutSuche");
  if(!s){ _fgOffMsg(btn,"Suchfeld nicht gefunden.","var(--k-b91c1c)"); return; }
  s.value=String(z.base_ingredient||z.zutat_text||"").trim();
  try{ s.dispatchEvent(new Event("input",{bubbles:true})); }catch(e){}
  s.focus(); try{ s.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
}
/* WEG 2 — ZERLEGUNG: RIKI (modus zutaten, v9+) liefert die #78-Felder; gespeichert
   wird AM ITEM ueber cb_riki_zutat_offen_struktur_speichern (#94). Kein Umweg ueber
   eine zweite Frontend-Zuordnung — item_id rein, Struktur raus, Block neu laden. */
async function fgOffZerlegen(iid, btn){
  var z=_fgOffItem(iid); if(!z) return;
  if(btn){ btn.disabled=true; } _fgOffMsg(btn,"Riki zerlegt …");
  try{
    var s=await client.auth.getSession();
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok) throw new Error("Nicht angemeldet.");
    var resp=await fetch(client.supabaseUrl+"/functions/v1/riki-analyse",{method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},
      body:JSON.stringify({modus:"zutaten", modell:RIKI_LESE_MODELL, text:String(z.zutat_text||""),
                           produkt_id:(window._fgEdit&&window._fgEdit.id)||null})});
    var d=await resp.json();
    if(!resp.ok||d.error) throw new Error(d.error||("HTTP "+resp.status));
    var zt=(d.vorschlag&&Array.isArray(d.vorschlag.zutaten)&&d.vorschlag.zutaten[0])||null;
    if(!zt) throw new Error("Riki hat keine Zutat geliefert.");
    var r2=await client.rpc("cb_riki_zutat_offen_struktur_speichern",{
      p_item_id:Number(iid),
      p_base_ingredient:zt.base_ingredient||zt.name||null,
      p_processing_modifiers:Array.isArray(zt.processing_modifiers)?zt.processing_modifiers:null,
      p_attributes:zt.attributes||null,
      p_parenthetical_role:zt.parenthetical_role||null,
      p_parenthetical_items:Array.isArray(zt.parenthetical_items)?JSON.parse(JSON.stringify(zt.parenthetical_items)):null,
      p_confidence:null,
      p_extraction_status:"extracted"});
    if(r2&&r2.error) throw r2.error;
    await _fgOffReload();
  }catch(e){
    console.error("[#81 Zerlegung]",e);
    _fgOffMsg(btn,"Zerlegung fehlgeschlagen: "+((e&&e.message)||e),"var(--k-b91c1c)");
    if(btn){ btn.disabled=false; }
  }
}
/* ────────────────────────────────────────────────────────────────────────────
   WORK #309 — "ERLEDIGT, IST ZERLEGT"
   Ralph, 26.08.: er hatte Dattel und Kakaopulver aus der Zeile "Trockenobst
   (78 % getrocknete Datteln, 12 % Kakaopulver)" gebunden - und der gelbe Kasten
   blieb trotzdem stehen. GEMESSEN, warum: cb_admin_zutat_offen_mit_riki prueft,
   ob die ZEILE selbst gebunden ist. Ihre Bestandteile zu binden schliesst sie
   nicht - fachlich richtig, denn die Zeile ist eine zusammengesetzte Zutat.
   Was fehlte, war der Abschluss "sie ist zerlegt, ihre Teile stehen da".
   🔴 KEIN NEUER SERVERWEG. Derselbe Aufruf wie "keine eigene Zutat", nur mit
   vorbereiteter Begruendung. Und: der Dialog BEHAUPTET nicht, dass die Teile
   gebunden sind - er zeigt, was gerade am Produkt steht, und Ralph entscheidet.
   ────────────────────────────────────────────────────────────────────────── */
async function fgOffZerlegtFertig(iid, btn){
  var z=_fgOffItem(iid); if(!z) return;
  var txt=String(z.zutat_text||"").trim();
  var canon=Array.isArray(window._fgCanon)?window._fgCanon:null;
  var liste;
  if(canon===null){
    liste='Was am Produkt gebunden ist, konnte gerade nicht gelesen werden.\n'
      +'Es wird deshalb NICHT behauptet, die Bestandteile stünden schon da.';
  }else if(!canon.length){
    liste='Am Produkt steht derzeit KEINE gebundene Zutat.\n'
      +'Prüfe, ob die Bestandteile wirklich schon zugeordnet sind.';
  }else{
    liste='Am Produkt stehen zurzeit:\n'
      +canon.slice(0,12).map(function(c){
          return '  · '+String((c&&(c.canonical_name||c.sichtbarer_name))||'?')
            +((c&&c.resolved_rating!=null)?('  Note '+c.resolved_rating):'  Note offen'); }).join('\n')
      +(canon.length>12?('\n  · … und '+(canon.length-12)+' weitere'):'');
  }
  if(!confirm('„'+txt+'" als ZERLEGT abschließen?\n\n'
    +'Die Zeile wird dann keine eigene Produktzutat – ihre Bestandteile sind es.\n\n'
    +liste+'\n\nDer Entscheid ist widerrufbar.')) return;
  if(btn){ btn.disabled=true; }
  /* ────────────────────────────────────────────────────────────────────────
     27.08.2026, Ralphs Fund an P73634: der Klick endete in
     "Der Handentscheid ist nur fuer composition, explanation oder
     subingredients zulaessig." GEMESSEN: item 190 hatte parenthetical_role
     NULL, weil die Zeile nie zerlegt worden war. Der Serverriegel ist richtig
     (fail-closed) - die Sackgasse war unsere. Fehlt die Rolle, laeuft jetzt
     ERST die vorhandene Riki-Zerlegung (setzt Struktur samt Rolle), dann der
     Abschluss. Kein neuer Serverweg, nur die richtige Reihenfolge.
     ──────────────────────────────────────────────────────────────────────── */
  if(!z.parenthetical_role){
    _fgOffMsg(btn,"Die Klammerrolle fehlt noch – Riki zerlegt die Zeile zuerst …");
    try{
      await fgOffZerlegen(iid, null);
      z=_fgOffItem(iid)||z;
    }catch(e){ console.error("[zerlegt: Vorlauf]",e); }
    if(!z.parenthetical_role){
      _fgOffMsg(btn,"Riki konnte keine Klammerrolle bestimmen. Weg: „Riki einstufen“ unter „weitere Wege“ – oder „anderer Grund …“ mit eigener Begründung.","var(--k-b45309)");
      if(btn){ btn.disabled=false; }
      return;
    }
  }
  _fgOffMsg(btn,"speichere Entscheid …");
  try{
    var r=await client.rpc("cb_source_extraction_item_keine_eigene_zutat_setzen",
      {p_item_id:Number(iid),
       p_reason:'Zusammengesetzte Zeile – in ihre Bestandteile zerlegt, diese sind als eigene Zutaten gebunden.',
       p_parenthetical_item:null});
    if(r&&r.error) throw r.error;
    await _fgOffReload();
  }catch(e){
    console.error("[#309 zerlegt fertig]",e);
    _fgOffMsgHtml(btn,_fgOffServerFehlerHtml(e));
    if(btn){ btn.disabled=false; }
  }
}
if(typeof window!=="undefined"){ window.fgOffZerlegtFertig=fgOffZerlegtFertig; }
/* ══════════════════════════════════════════════════════════════════════════
   RALPH 09.09.2026: "wenn ich auf keine zutat klicke, passiert nichts."
   GEMESSEN: die Funktion stieg an zwei Stellen STILL aus - `if(!z) return`
   ohne Meldung, und `if(grund===null) return`, wenn prompt() nichts liefert.
   Genau das tut prompt() in Safari und Chrome, sobald der Dialog unterdrueckt
   ist; der Browser meldet das nicht, er gibt null zurueck. Ergebnis: Klick,
   nichts passiert, keine Spur.
   prompt() ist raus. Die Begruendung wird jetzt inline abgefragt, und jeder
   Abbruchweg schreibt eine sichtbare Meldung in die Zeile.
   ══════════════════════════════════════════════════════════════════════════ */
async function fgOffKeineZutat(iid, btn){
  var z=_fgOffItem(iid);
  if(!z){ _fgOffMsg(btn,"Zeile nicht mehr in der Liste - bitte neu laden.","var(--k-b91c1c)"); return; }
  var grund=await _fgOffGrundFragen(btn, String(z.zutat_text||""));
  if(grund===null){ _fgOffMsg(btn,"Abgebrochen - die Zeile bleibt offen."); return; }
  grund=String(grund).trim();
  if(!grund){ _fgOffMsg(btn,"Ohne Begründung kein Entscheid.","var(--k-b45309)"); return; }
  if(btn){ btn.disabled=true; } _fgOffMsg(btn,"speichere Entscheid …");
  try{
    var r=await client.rpc("cb_source_extraction_item_keine_eigene_zutat_setzen",
      {p_item_id:Number(iid), p_reason:grund, p_parenthetical_item:null});
    if(r&&r.error) throw r.error;
    await _fgOffReload();
  }catch(e){
    console.error("[#81 keine Zutat]",e);
    _fgOffMsgHtml(btn,_fgOffServerFehlerHtml(e));
    if(btn){ btn.disabled=false; }
  }
}
async function fgOffWiderruf(iid, btn){
  if(!confirm("Handentscheid zurücknehmen? Die Zeile wird wieder als offen geführt.")) return;
  if(btn){ btn.disabled=true; }
  try{
    var r=await client.rpc("cb_source_extraction_item_entscheidung_widerrufen",
      {p_item_id:Number(iid), p_reason:"Widerruf im Editor"});
    if(r&&r.error) throw r.error;
    await _fgOffReload();
  }catch(e){
    console.error("[#81 Widerruf]",e);
    alert("Widerruf fehlgeschlagen: "+((e&&e.message)||e));
    if(btn){ btn.disabled=false; }
  }
}
function fgOffNeu(iid, btn){
  var z=_fgOffItem(iid); if(!z) return;
  if(!confirm('„'+String(z.zutat_text||"")+'" wirklich als NEUE Stammzutat anlegen?\n\nErst sinnvoll, wenn Suchen, Zerlegung und „keine eigene Zutat" nichts ergeben haben.')) return;
  var i2=document.getElementById("fe_zutNeu");
  if(!i2){ _fgOffMsg(btn,"Anlagefeld nicht gefunden.","var(--k-b91c1c)"); return; }
  i2.value=String(z.base_ingredient||z.zutat_text||"").trim();
  try{ fgPickAddNeu(); }catch(e){ console.error("[#81 Neuanlage]",e); }
  try{ i2.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
}
if(typeof window!=="undefined"){
  window.fgOffBinden=fgOffBinden; window.fgOffZerlegen=fgOffZerlegen;
  window.fgOffKeineZutat=fgOffKeineZutat; window.fgOffWiderruf=fgOffWiderruf;
  window.fgOffNeu=fgOffNeu;
}
/* Riki-Schritte je Item sequenziell über die bestehenden Serververträge ausführen. */
async function _fgRikiBewerten(z, tok){
  var resp=await fetch(client.supabaseUrl+"/functions/v1/riki-analyse",{method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},
    body:JSON.stringify({modus:"bewerten", modell:RIKI_LESE_MODELL,
      name:String(z.base_ingredient||z.zutat_text||""),
      struktur:{processing_modifiers:z.processing_modifiers||null,
                attributes:z.attributes||null,
                parenthetical_role:z.parenthetical_role||null},
      produkt_id:(window._fgEdit&&window._fgEdit.id)||null})});
  var d=await resp.json();
  if(!resp.ok||d.error) throw new Error(d.error||("HTTP "+resp.status));
  return (d.vorschlag&&typeof d.vorschlag==="object")?d.vorschlag:null;
}
async function fgOffRikiKette(iid, btn){
  var z=_fgOffItem(iid); if(!z) return;
  if(btn){ btn.disabled=true; }
  try{
    var s=await client.auth.getSession();
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok) throw new Error("Nicht angemeldet.");
    /* 1 — Zerlegung nur, wenn sie fehlt. Eine vorhandene Struktur wird nicht
       ueberschrieben; dafuer gibt es den Knopf "Zerlegung erneut pruefen". */
    if(!z.base_ingredient){ _fgOffMsg(btn,"1/4 Riki zerlegt …"); await fgOffZerlegen(iid, null); z=_fgOffItem(iid)||z; }
    /* 2 — Server loest auf. */
    _fgOffMsg(btn,"2/4 Canonical wird aufgelöst …");
    var r1=await client.rpc("cb_riki_ingredient_resolution_erheben",{p_item_id:Number(iid)});
    if(r1&&r1.error) throw r1.error;
    var res=r1&&r1.data||{};
    if(res.status!=="resolved"){
      _fgOffMsg(btn,"Auflösung: "+String(res.status||"?")+" — "+String(res.reason||"")+" Bleibt sichtbar offen.","var(--k-b45309)");
      await _fgOffReload(); return;
    }
    /* 3 — Bewertung gegen die aktive Regel-SSOT. */
    _fgOffMsg(btn,"3/4 Riki bewertet nach aktivem Regelwerk …");
    var bw=await _fgRikiBewerten(z, tok);
    if(!bw || bw.status!=="proposed" || !bw.regel_id || bw.rating==null){
      _fgOffMsg(btn,"Keine anwendbare Regel — es wird KEIN Wert erfunden (§1.1). "+String((bw&&bw.begruendung)||""),"var(--k-b45309)");
      await _fgOffReload(); return;
    }
    /* 4 — Vorschlag speichern; der Waechter prueft serverseitig gegen. */
    _fgOffMsg(btn,"4/4 Vorschlag wird gespeichert …");
    var r2=await client.rpc("cb_riki_ingredient_assessment_speichern",{
      p_item_id:Number(iid), p_target_entity_id:res.entity_id,
      p_rule_id:String(bw.regel_id), p_rating:Number(bw.rating),
      p_confidence:String(bw.confidence||"mittel"), p_rationale:String(bw.begruendung||""),
      p_status:"proposed"});
    if(r2&&r2.error) throw r2.error;
    /* 5 — Kategorie nur bei needs_review und nur aus der Positivliste. */
    if(res.category_status==="needs_review" && bw.kategorie_vorschlag){
      try{ await client.rpc("cb_riki_ingredient_kategorie_setzen",{p_item_id:Number(iid),
             p_category:String(bw.kategorie_vorschlag), p_confidence:String(bw.confidence||"mittel"),
             p_reason:"RIKI-Vorschlag nach Zerlegung"}); }catch(e){ console.error("[#93 Kategorie]",e); }
    }
    await _fgOffReload();
  }catch(e){
    console.error("[#93 Kette]",e);
    _fgOffMsg(btn,"Kette abgebrochen: "+((e&&e.message)||e),"var(--k-b91c1c)");
    if(btn){ btn.disabled=false; }
  }
}
async function fgRohtextLauf(){
  var inp=document.getElementById("fe_rohtextIn"); if(!inp) return;
  var txt=String(inp.value||"").trim();
  var pid=(window._fgEdit&&window._fgEdit.id)||null;
  var msg=document.getElementById("fe_pullMsg");
  var sag=function(t,f){ if(msg){ msg.textContent=t; msg.style.color=f||"var(--muted)"; } };
  if(!txt){ sag("Kein Text im Feld.","var(--k-b45309)"); return; }
  if(!pid){ sag("Erst speichern – der Lauf braucht eine P-Nummer.","var(--k-b45309)"); return; }
  try{
    sag("Riki liest den Text …");
    var s=await client.auth.getSession();
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok) throw new Error("Nicht angemeldet.");
    var resp=await fetch(client.supabaseUrl+"/functions/v1/riki-analyse",{method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},
      body:JSON.stringify({modus:"rohtext", modell:RIKI_LESE_MODELL, text:txt, produkt_id:pid,
                           quelle:((document.getElementById("fe_url")||{}).value||"eingefügter Text")})});
    var d=await resp.json();
    if(!resp.ok||d.error) throw new Error(d.error||("HTTP "+resp.status));
    var v=d.vorschlag||{};
    if(!Array.isArray(v.sections)||!Array.isArray(v.items)) throw new Error("Antwort ohne sections/items.");
    sag("Lauf wird gespeichert …");
    var r=await client.rpc("cb_riki_source_extraction_speichern",{
      p_product_id:pid, p_source_kind:"rawtext",
      p_source_ref:((document.getElementById("fe_url")||{}).value||"eingefügter Text"),
      p_sections:v.sections, p_items:v.items, p_status:"captured",
      p_metadata:{contract_version:String(v.contract_version||"riki_source_extraction_item_v1"),extractor:"riki",modus:"rohtext"}});
    if(r&&r.error) throw r.error;
    var runId=(r&&r.data!=null)?Number(r.data):null;
    var teil=v.sections.filter(function(x){return x.status==="partial"||x.status==="unresolved";}).length;
    var zeilen=v.sections.reduce(function(a,x){return a+(Number(x.extracted_rows)||0);},0);
    var basis="✓ "+v.sections.length+" Abschnitte, "+zeilen+" Zeilen gespeichert"
        +(teil?(" — "+teil+" Abschnitt"+(teil===1?"":"e")+" unvollständig/ungeklärt, bitte prüfen"):"");
    var farbe=teil?"var(--k-b45309)":"var(--k-166534)";
    var alg="";
    if(runId==null||!isFinite(runId)){
      alg=" — Fachwerte übersprungen: der Lauf gab keine Lauf-ID zurück";
      farbe="var(--k-b45309)";
    }else{
      sag("Fachwerte werden übernommen …");
      try{
        var rf=await client.rpc("cb_riki_fachwerte_persistieren",{p_run_id:runId});
        if(rf&&rf.error) throw rf.error;
        var f=(rf&&rf.data)||null;
        var fLauf=(f&&f.run_id!=null)?f.run_id:runId;
        var fGesp=" — der Extraktionslauf selbst ist gespeichert";
        if(!f||typeof f!=="object"){
          console.warn("[E2 Fachwerte] Lauf "+fLauf+": leere Antwort",rf&&rf.data);
          alg=" — Fachwerte NICHT übernommen (Lauf "+fLauf+"): der Server hat keine"
             +" Rückmeldung geliefert"+fGesp
             +". Nächster Schritt: den Lauf erneut übernehmen; bleibt es dabei, den"
             +" Vorgang mit der Lauf-Nummer melden";
          farbe="var(--k-b91c1c)";
        }else if(f.ok===false){
          console.warn("[E2 Fachwerte] Lauf "+fLauf+": abgelehnt",f);
          var fQ=String(f.quellart||"").trim();
          var fKlar={"existing_product_occurrence":"Rückwärtslauf – zeigt nur, wo ein Stoff in schon erfassten Produkten vorkommt"}[fQ.toLowerCase()]||"";
          var fQtxt=fQ?(", Quellart "+(fKlar?("„"+fKlar+"“, technisch: "+fQ):fQ)):"";
          var fGrund=String(f.grund||"").trim()
            ||("der Server hat die Übernahme abgelehnt, ohne einen Grund mitzuliefern —"
              +" der Vorgang steht in shadow_v1.audit_event zu Lauf "+fLauf);
          alg=" — "+(f.abgelehnt?"Fachwerte ABGELEHNT":"Fachwerte NICHT übernommen")
             +" (Lauf "+fLauf+fQtxt+"): "+fGrund+fGesp
             +". Nächster Schritt: eine Belegquelle erfassen – Etikettfoto oder"
             +" Herstellerseite – und den Lauf von dort wiederholen; nur daraus dürfen"
             +" Allergene, Zutaten, Makro- und Nährstoffwerte kommen";
          farbe="var(--k-b91c1c)";
        }else{
          var fTeile=[["Allergene",f.allergene],["Zutaten",f.zutaten],
                      ["Makro",f.makro],["Nährstoffe",f.naehrstoffe]];
          var fTxt=[], fOffen=0;
          fTeile.forEach(function(t){
            var q=t[1]||{}, ok=Number(q.persistiert)||0, pruef=Number(q.needs_review)||0;
            if(!ok&&!pruef) return;
            fOffen+=pruef;
            fTxt.push(t[0]+": "+ok+" übernommen"+(pruef?(", "+pruef+" offen"):""));
          });
          if(fTxt.length){
            alg=" — "+fTxt.join(" · ")
               +(fOffen?(" — "+fOffen+" Zeile"+(fOffen===1?"":"n")+" bleiben offen, bitte prüfen"):"");
            if(fOffen) farbe="var(--k-b45309)";
          }
        }
      }catch(ef){
        console.error("[E2 Fachwerte] Lauf "+runId,ef);
        alg=" — Fachwerte NICHT übernommen (Lauf "+runId+"): "+((ef&&ef.message)||ef)
           +" — der Extraktionslauf selbst ist gespeichert";
        farbe="var(--k-b91c1c)";
      }
    }
    sag(basis+alg+". Zutatenzeilen erscheinen unten als offene Zeilen.", farbe);
    inp.value="";
    await _fgOffReload();
  }catch(e){
    console.error("[#60 Rohtext]",e);
    sag("Fehlgeschlagen: "+((e&&e.message)||e),"var(--k-b91c1c)");
  }
}
if(typeof window!=="undefined"){ window.fgOffRikiKette=fgOffRikiKette; window.fgRohtextLauf=fgRohtextLauf; }
if(typeof window!=="undefined"){ window.fgZutOffenLaden=fgZutOffenLaden;
  window._fgZutOffenListe=_fgZutOffenListe; window._fgZutOffenHtml=_fgZutOffenHtml;
  window._fgZutOffenFremd=_fgZutOffenFremd; }
/* produkt_zutat_id → Zusatzstoff-Merkmal. Eine Zeile kann über produkt_zutat_ids
   auch mehrfach genannt sein; dann zählt sie für jede genannte ID. */
function _fgZusNachPz(){
  var out={}, d=window._fgZusV2;
  var items=(d&&Array.isArray(d.items))?d.items:[];
  items.forEach(function(it){
    var ids=Array.isArray(it.produkt_zutat_ids)&&it.produkt_zutat_ids.length
      ? it.produkt_zutat_ids : (it.produkt_zutat_id?[it.produkt_zutat_id]:[]);
    ids.forEach(function(id){ var k=String(id||"").trim(); if(k) (out[k]=out[k]||[]).push(it); });
  });
  return out;
}
var _ZUS_BEW={
  neutral:    {t:"neutral",    f:"var(--muted)"},
  abgewertet: {t:"abgewertet", f:"var(--k-cf5442,#cf5442)"},
  unbedenklich:{t:"unbedenklich",f:"var(--k-166534,#166534)"}
};
/* ══════════════════════════════════════════════════════════════════════════
   M3c, 29.08.2026 — RALPH: "farbige kennzeichnung zusatzstoffe und nährstoffe
   die zugesetzt sind".
   Bisher trug nur der Zusatzstoff ein Zeichen: ein gruenes ⚗. Gruen ist an
   dieser Stelle irrefuehrend - es liest sich wie ein Urteil ("in Ordnung"),
   ist aber nur eine Art-Angabe. Und der zugesetzte Naehrstoff hatte gar keins,
   obwohl der Server die Kategorie laengst mitliefert (canonical_category aus
   cb_admin_produkt_zutaten).
   Drei Arten, drei Farben, keine davon gruen oder rot - die Bewertungsfarbe
   steht rechts in der Wertspalte und soll nicht doppelt vorkommen:
     ⚗ Zusatzstoff        violett  (E-Nummer oder Kategorie "Zusatzstoff")
     ✚ zugesetzter Naehrstoff  blau (Kategorie "Vitamine & Mineralstoffe")
     ◆ Wirkstoff          tuerkis  (Kategorie "Wirkstoff")
   Gemessen im Stamm: 116 Zusatzstoffe, 63 Vitamine & Mineralstoffe,
   39 Wirkstoffe. Hier wird nichts entschieden und nichts bewertet - die Art
   kommt vom Server, die Farbe macht sie sichtbar.
   ══════════════════════════════════════════════════════════════════════════ */
var _FG_ART={
  zusatzstoff: {z:"⚗", f:"#6d28d9", bg:"#f5f3ff", r:"#c4b5fd", t:"Zusatzstoff"},
  naehrstoff:  {z:"✚", f:"#1d4ed8", bg:"#eff6ff", r:"#93c5fd", t:"zugesetzter Nährstoff"},
  wirkstoff:   {z:"◆", f:"#0f766e", bg:"#f0fdfa", r:"#5eead4", t:"Wirkstoff"}
};
/* Welche Art traegt diese Bestandteilzeile? Reine Ableitung aus dem, was der
   Server geliefert hat - keine Namensraterei. */
function _fgArtVon(z, zusListe){
  var kat=String((z&&(z.canonical_category||z.sichtbare_kategorie))||"").trim().toLowerCase();
  if((zusListe&&zusListe.length) || kat==="zusatzstoff") return "zusatzstoff";
  if(kat==="vitamine & mineralstoffe" || kat==="vitamine und mineralstoffe") return "naehrstoff";
  if(kat==="wirkstoff") return "wirkstoff";
  return "";
}
/* Die farbige Pille. Leerer String, wenn die Zeile keine der drei Arten ist -
   eine normale Zutat bekommt kein Zeichen. */
function _fgArtPille(z, zusListe){
  var k=_fgArtVon(z, zusListe); if(!k) return "";
  var a=_FG_ART[k];
  return ' <span style="font-size:11px;font-weight:600;color:'+a.f+';background:'+a.bg
    +';border:1px solid '+a.r+';border-radius:5px;padding:0 4px;white-space:nowrap"'
    +' title="'+esc(a.t)+' – die Art dieser Zeile, kein Urteil. Die Bewertung steht rechts.">'
    +a.z+' '+esc(a.t)+'</span>';
}
function _fgBestZeile(z, zusListe, gebunden){
  var nm=String(z.sichtbarer_name||z.canonical_name||"").trim();
  /* ══════════════════════════════════════════════════════════════════════
     A1, 29.08.2026 — RALPH: "aber bitte anders kennzeichnen und buttons weg."
     Eine HUELLE ist eine Zeile, deren Bestandteile inzwischen einzeln am
     Produkt stehen: "71% EIER-TEIGWAREN (HARTWEIZENGRIEß, Wasser, VOLLEI,
     Sonnenblumenöl)" - alle vier sind eigene Zutaten geworden. Die Zeile
     selbst traegt nur noch die Mengenangabe und den Etikett-Rohtext.
     Sie wurde NICHT geloescht (dann waeren 71 % und die Herkunft weg und ein
     falsches Aufbrechen nicht rueckholbar), sondern stillgelegt: der Server
     laesst sie aus der Bewertung heraus und sie blockiert den Score nicht
     mehr. Gemessen an P73615: vorher "kein Score - Zutat nicht bewertet
     (Teigwaren)", nachher nur noch "Naehrwerte fehlen".
     Hier steht deshalb: grau, kein Wert, keine Knoepfe, kein Haken. Nur was
     sie ist und warum sie nicht mehr zaehlt.
     Das Feld kommt vom Server: score_leaf=false heisst Huelle
     (cb_admin_produkt_zutaten), hierarchy_source traegt den Grund.
     ══════════════════════════════════════════════════════════════════════ */
  if(z && z.score_leaf===false){
    var _roh=String(z.zutatenliste_rohtext||"").trim();
    var _gr=String(z.hierarchy_source||"Die Bestandteile stehen einzeln am Produkt.").trim();
    return '<div data-pz="'+esc(String(z.produkt_zutat_id||""))+'" data-huelle="1"'
      +' title="Stillgelegt: '+esc(_gr)+' Die Zeile bleibt erhalten, weil sie die Mengenangabe und den Etikett-Rohtext traegt – sie zaehlt nur nicht mehr mit."'
      +' style="display:grid;grid-template-columns:22px 1fr 46px;gap:8px;align-items:start;'
      +'padding:6px 8px;border-bottom:1px solid var(--line);opacity:.6;background:var(--k-f2f5f3,#f2f5f3)">'
      +'<span style="text-align:center;color:var(--muted);font-size:12px">⊘</span>'
      +'<span style="min-width:0">'
        +'<span style="display:block;font-size:13px;color:var(--muted);text-decoration:line-through;overflow-wrap:anywhere">'+esc(nm)+'</span>'
        +'<span style="display:block;font-size:11px;color:var(--muted);line-height:1.45;margin-top:1px">'
          +'zusammengefasste Zeile – zählt nicht mit'+(_gr?(' · '+esc(_gr)):'')
          +(_roh?('<span style="display:block;opacity:.8">Etikett: '+esc(_roh)+'</span>'):'')
        +'</span>'
      +'</span>'
      +'<span style="text-align:center;color:var(--muted);font-size:13px">–</span>'
      +'</div>';
  }
  var rt=(z.resolved_rating==null)?"–":String(z.resolved_rating);
  var col=(z.resolved_rating==null)?"var(--muted)"
    :(z.resolved_rating>=7?"var(--k-2e9e57,#2e9e57)":(z.resolved_rating>=4?"var(--k-c88616,#c88616)":"var(--k-cf5442,#cf5442)"));
  var mod=String(z.processing_modifier||"").trim();
  var unter=[];
  if(mod && mod!=="unspecified_processing") unter.push(esc(mod));
  /* M3b: "Note nicht belegt" war eine Sackgasse - richtig, aber ohne Ausweg.
     Ein Klick zeigt jetzt, was das Regelwerk zu diesem Namen hergibt. */
  if(z.resolved_rating==null){
    unter.push('<span class="fgNoteRahmenLnk" style="color:var(--k-2f6fd6,#2f6fd6);cursor:pointer;text-decoration:underline dotted"'
      +' data-eid="'+esc(String(z.canonical_entity_id||""))+'"'
      +' data-cn="'+esc(String(z.canonical_name||nm))+'"'
      +' onclick="fgNoteRahmenZeigen(this,event)"'
      +' title="Klicken: zeigt, welche Stufen das Regelwerk zulässt und wie ähnliche Stammzutaten bewertet sind.">'
      +'Note nicht belegt – Rahmen ansehen</span>');
  }
  (zusListe||[]).forEach(function(it){
    var b=_ZUS_BEW[String(it.evaluation||"").toLowerCase()]||{t:String(it.evaluation||"ungeprüft"),f:"var(--muted)"};
    var zn=String(it.name||"").trim();
    var gleich=(zn.toLowerCase()===nm.toLowerCase());
    unter.push('<span title="Zusatzstoff dieser Bestandteilzeile – zusammengeführt über die ID '+esc(String(it.produkt_zutat_id||""))+', nicht über den Namen">'
      +(gleich?'':'Zusatzstoff: '+esc(zn)+' · ')
      +(it.e_number?'<b>'+esc(String(it.e_number))+'</b> · ':'')
      +'<span style="color:'+b.f+'">Zusatzstoff '+esc(b.t)+'</span></span>');
  });
  var hatZus=(zusListe&&zusListe.length>0);
  if(typeof feFokusAn==="function" && feFokusAn()){
    var _rt=(z.resolved_rating==null)?"—":String(z.resolved_rating);
    var _rc=(z.resolved_rating==null)?"var(--muted)"
      :(z.resolved_rating>=7?"var(--k-2e9e57,#2e9e57)":(z.resolved_rating>=4?"var(--k-c88616,#c88616)":"var(--k-cf5442,#cf5442)"));
    var _mod2=(mod && mod!=="unspecified_processing")?esc(mod):'<span style="color:var(--muted)">–</span>';
    var _zus2=(zusListe||[]).map(function(it){
      var b=_ZUS_BEW[String(it.evaluation||"").toLowerCase()]||{t:String(it.evaluation||"ungeprüft"),f:"var(--muted)"};
      var zn=String(it.name||"").trim(), gleich=(zn.toLowerCase()===nm.toLowerCase());
      return (it.e_number?'<b>'+esc(String(it.e_number))+'</b> · ':'')
        +(gleich?'':esc(zn)+' · ')+'<span style="color:'+b.f+'">'+esc(b.t)+'</span>';
    }).join('<br>') || '<span style="color:var(--muted)">–</span>';
    var _orig=String(z.zutatenliste_rohtext||z.sichtbarer_name||"").trim();
    var _cn=String(z.canonical_name||"").trim();
    var _origHtml=(_cn && _orig && _orig.toLowerCase()!==_cn.toLowerCase())
      ? '<span style="display:block;font-size:10.5px;color:var(--muted);margin-top:1px">Etikett: '+esc(_orig)+'</span>' : '';
    var _eidZ=String(z.canonical_entity_id||"").trim();
    var _pzZ=String(z.produkt_zutat_id||"").trim();
    var _stZ=!gebunden ? ['○','var(--k-2f6fd6,#2f6fd6)','nicht gebunden – zählt noch nicht zum Produkt']
           : (z.resolved_rating==null ? ['●','var(--muted)','erfasst · noch keine belastbare Verarbeitungsnote']
                                      : ['✓','var(--k-16a34a,#16a34a)','erfasst und bewertet']);
    return '<label class="fgBestZeile" data-pz="'+esc(String(z.produkt_zutat_id||""))+'" data-note-offen="'+((z.resolved_rating==null)?"1":"0")+'">'
      +'<span class="fgbSt"><input type="checkbox" '+(gebunden?"checked":"")+' data-name="'+esc(nm)+'" data-rating="'+(z.resolved_rating==null?"":z.resolved_rating)+'" data-krit="'+(z.resolved_critical?"ja":"nein")+'" onchange="fgPickToggle(this)">'
        +'<span class="fgbIco" style="color:'+_stZ[1]+'" title="'+esc(_stZ[2])+'">'+_stZ[0]+'</span></span>'
      +'<span class="fgbName">'+esc(nm)+_fgArtPille(z, zusListe)+_origHtml+'</span>'
      +(_eidZ && _pzZ
        ? '<span class="fgbVerarb fgbVerarbEdit" data-eid="'+esc(_eidZ)+'" data-pz="'+esc(_pzZ)+'"'
          +' data-mod="'+esc(mod||"unspecified_processing")+'" data-cn="'+esc(String(z.canonical_name||nm))+'"'
          +' onclick="fgBestVerarbEdit(this,event)"'
          +' title="Klicken, um die Verarbeitung zu ändern. Die Note folgt daraus – sie wird nie von Hand gesetzt (§4.2).">'
          +_mod2+'<span class="fgbStift">✎</span></span>'
        : '<span class="fgbVerarb" title="Diese Zeile ist noch keiner Identität zugeordnet. Erst zuordnen, dann lässt sich die Verarbeitung ändern.">'+_mod2+'</span>')
      +'<span class="fgbZus">'+_zus2+'</span>'
      /* Work #291: die Note ist ab hier belegpflichtig. Ein Klick zeigt die Regel,
         aus der sie kommt - Regel-Id, Titel, Herleitung, Quelle und alle anderen
         Verarbeitungen derselben Zutat. Das ist die Regelpruefung von Hand, ohne
         Riki: der Server nennt die Regel laengst (resolved_rule_id), sie wurde nur
         nie angezeigt. */
      /* M3b: hat die Zeile eine Note, zeigt der Klick die Regel dahinter (#291).
         Hat sie KEINE, gibt es keine Regel zu zeigen - dann kommt der Rahmen:
         welche Stufen das Regelwerk zulaesst und wie Nachbarn bewertet sind. */
      +(_eidZ
        ? '<span class="fgbWert fgbWertPruef" style="color:'+_rc+';cursor:pointer;text-decoration:underline dotted"'
          +' data-eid="'+esc(_eidZ)+'" data-mod="'+esc(mod||"unspecified_processing")+'"'
          +' data-cn="'+esc(String(z.canonical_name||nm))+'"'
          +' onclick="'+(z.resolved_rating==null?'fgNoteRahmenZeigen':'fgWertRegelZeigen')+'(this,event)"'
          +' title="'+(z.resolved_rating==null
              ? 'Diese Zeile hat keine Note. Klicken: zeigt, welche Stufen das Regelwerk zulässt und wie ähnliche Stammzutaten bewertet sind.'
              : 'Klicken: zeigt die Bewertungsregel hinter diesem Wert und alle Verarbeitungsvarianten dieser Zutat.')+'">'
          +esc(_rt)+'</span>'
        : '<span class="fgbWert" style="color:'+_rc+'" title="Ohne zugeordnete Identitaet gibt es keine Regel zu zeigen.">'+esc(_rt)+'</span>')
    +'</label>';
  }
  var _ohneNote=(z.resolved_rating==null);
  var _bg = !gebunden ? ';background:var(--k-eef6ff,#eef6ff);box-shadow:inset 3px 0 0 var(--k-2f6fd6,#2f6fd6)'
          : (_ohneNote ? '' : ';background:var(--greenlt,#eef7f0)');
  return '<label data-pz="'+esc(String(z.produkt_zutat_id||""))+'" data-note-offen="'+(_ohneNote?"1":"0")+'"'
    +' title="'+(_ohneNote?'Bestandteil ist erfasst, aber ohne belastbare Verarbeitungsnote – bewusst offen, keine 0':'Bestandteil erfasst und bewertet')+'"'
    +' style="display:grid;grid-template-columns:22px 1fr 46px;gap:8px;align-items:start;padding:6px 8px;border-bottom:1px solid var(--line);cursor:pointer'
    +_bg+'">'
    +'<input type="checkbox" '+(gebunden?"checked":"")+' data-name="'+esc(nm)+'" data-rating="'+(z.resolved_rating==null?"":z.resolved_rating)+'" data-krit="'+(z.resolved_critical?"ja":"nein")+'" onchange="fgPickToggle(this)" style="width:16px;height:16px;margin-top:2px;accent-color:var(--k-16a34a)">'
    +'<span style="min-width:0">'
      +'<span style="display:block;font-size:13px;color:var(--ink);overflow-wrap:anywhere">'+esc(nm)
      /* M3c: ersetzt das gruene ⚗. Gruen las sich wie ein Urteil und gab es nur
         fuer Zusatzstoffe; jetzt tragen auch zugesetzte Naehrstoffe und
         Wirkstoffe ihre Farbe. Siehe _FG_ART. */
      +_fgArtPille(z, zusListe)
      +'</span>'
      /* Leere Unterzeilen nicht rendern; fehlender Zusatztext ist kein Ladefehler. */
      +(unter.length?'<span style="display:block;font-size:11.5px;color:var(--muted);line-height:1.45;margin-top:1px">'+unter.join(' · ')+'</span>':'')
    +'</span>'
    +'<span style="text-align:center;font-weight:700;font-size:13px;color:'+col+'">'+esc(rt)+'</span>'
  +'</label>';
}
/* ────────────────────────────────────────────────────────────────────────────
   WORK #291 — DIE REGEL HINTER DEM WERT. Ralph: "kein vergleich mit regelwerk".
   Gemessen an P73652: shadow_v1.ingredient_rating liefert zu Kakao-Nibs/roh die
   Note 8 UND die Regel BR-STAFFEL-KAKAOMASSE, und deren voller Text samt Quelle
   liegt im Regelwerk. Angezeigt wurde davon nichts - der Wert stand nackt da und
   war weder nachvollziehbar noch bestreitbar.
   Hier wird nichts gerechnet und nichts bewertet. cb_admin_zutat_regelbeleg fragt
   die drei vorhandenen Lesewege und legt die Antworten nebeneinander.
   ──────────────────────────────────────────────────────────────────────────── */
async function fgWertRegelZeigen(el, ev){
  /* Die Bestandteilzeile ist ein <label> mit der Bindungs-Checkbox darin. Ohne
     diese zwei Zeilen wuerde der Klick auf den Wert die Bindung umschalten - der
     Belegknopf haette also genau das zerstoert, was er belegen soll. */
  try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(e){}
  var eid=el&&el.dataset&&el.dataset.eid, mod=(el&&el.dataset&&el.dataset.mod)||null;
  if(!eid) return;
  var zeile=el.closest?el.closest(".fgBestZeile"):null;
  var alt=zeile&&zeile.nextElementSibling;
  if(alt&&alt.classList&&alt.classList.contains("fgRegelBeleg")){ alt.remove(); return; }  /* zweiter Klick schliesst */
  var lade=document.createElement("div");
  lade.className="fgRegelBeleg";
  lade.style.cssText="margin:-2px 0 8px;padding:9px 11px;border:1px solid var(--line);border-left:3px solid var(--k-2f6fd6,#2f6fd6);border-radius:8px;background:var(--k-f2f5f3,#f2f5f3);font-size:11.5px;line-height:1.55";
  lade.textContent="Regel wird geholt …";
  if(zeile&&zeile.parentNode) zeile.parentNode.insertBefore(lade, zeile.nextSibling);
  try{
    var r=await client.rpc("cb_admin_zutat_regelbeleg",{p_entity_id:eid, p_modifier:(mod==="unspecified_processing"?null:mod)});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(!d||d.ok!==true) throw new Error((d&&d.grund)||"Kein Beleg erhalten.");
    var g=d.regel||null;
    var H='<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">'
      +'<b>'+esc(String(d.name||"Zutat"))+(d.verarbeitung?' · '+esc(String(d.verarbeitung)):'')+'</b>'
      +'<span style="color:var(--muted);font-size:10.5px;cursor:pointer" onclick="this.closest(\'.fgRegelBeleg\').remove()">schließen ✕</span></div>';
    if(d.note==null){
      H+='<div style="color:var(--k-b45309,#b45309);margin-top:3px">Kein Wert – '+esc(String(d.ohne_note_grund||"keine Regel hinterlegt"))+'</div>';
    }else{
      H+='<div style="margin-top:3px">Wert <b>'+esc(String(d.note))+'</b>'
        +(d.regel_id?(' · Regel <b>'+esc(String(d.regel_id))+'</b>'):' · <span style="color:var(--k-b45309,#b45309)">ohne Regel-Kennung</span>')
        +(d.grundlage?('<span style="color:var(--muted)"> · Grundlage '+esc(String(d.grundlage))+'</span>'):'')
        +(d.kritisch?' · <span style="color:var(--k-cf5442,#cf5442)">kritisch</span>':'')+'</div>';
    }
    if(g){
      H+='<div style="margin-top:5px"><b>'+esc(String(g.titel||""))+'</b></div>'
        +'<div style="margin-top:2px;color:var(--ink)">'+esc(String(g.inhalt||""))+'</div>'
        +(g.quelle?('<div style="margin-top:4px;color:var(--muted);font-size:10.5px">Quelle: '+esc(String(g.quelle))+'</div>'):'');
    }else if(d.regel_id){
      H+='<div style="margin-top:4px;color:var(--k-b45309,#b45309)">Regeltext zu '+esc(String(d.regel_id))+' nicht gefunden – der Wert steht, der Beleg fehlt.</div>';
    }
    var vs=Array.isArray(d.verarbeitungen)?d.verarbeitungen:[];
    if(vs.length){
      H+='<div style="margin-top:6px;color:var(--muted)">Verarbeitungen dieser Zutat – zum Vergleichen:</div>'
        +vs.map(function(v){
          var an=(String(v.modifier||"")===String(d.verarbeitung||""));
          return '<div style="padding-left:8px'+(an?';font-weight:700':'')+'">'
            +(an?'▸ ':'· ')+esc(String(v.label||v.modifier||"ohne Angabe"))
            +' · Wert '+(v.rating==null?'–':esc(String(v.rating)))
            +(v.matrix_state?('<span style="color:var(--muted)"> · '+esc(String(v.matrix_state))+'</span>'):'')
            +'</div>'; }).join("");
    }
    lade.innerHTML=H;
  }catch(e){
    console.error("[#291 Regelbeleg]",e);
    lade.innerHTML='<span style="color:var(--k-b91c1c,#b91c1c)">Regel nicht abrufbar: '+esc((e&&e.message)||String(e))
      +'</span> <span style="color:var(--muted)">– der angezeigte Wert bleibt, er ist hier nur nicht belegt.</span>';
  }
}
if(typeof window!=="undefined"){ window.fgWertRegelZeigen=fgWertRegelZeigen; }
/* ────────────────────────────────────────────────────────────────────────────
   M3b, 29.08.2026 — DER NOTENRAHMEN. Ralph: "falls es doch dazu kommt, das eine
   zutat nicht sauber nach dem regelwerk aufgeloest wird, soll sie dort erscheinen
   mit vorschlag einer moeglichen bewertung."
   Das Gegenstueck zu fgWertRegelZeigen: dort steht die Regel HINTER einer Note,
   hier steht, was das Regelwerk ueber eine FEHLENDE Note hergibt.
   Gemessen an allen 926 unbewerteten Stammzutaten:
     Regelwerk laesst genau eine Stufe zu ..... 1 Fall
     fast gleicher Name (ab 0,85) ............. 5
     aehnlich (0,70 - 0,85) .................. 48
     nur Hinweis (0,45 - 0,70) .............. 559
     nichts .................................. 314
   Deshalb die Ampel: eine ZAHL gibt es nur bei gruen und gelb. Bei grau steht
   die Eingrenzung da, keine Note. Geraten wird nicht - das waere schlimmer als
   keine Zahl, weil es plausibel aussieht und bestaetigt wuerde.
   Hier wird nichts gespeichert. Der Server liest, mehr nicht.
   ──────────────────────────────────────────────────────────────────────────── */
var _FG_AMPEL={
  gruen:{f:"var(--k-166534,#166534)",r:"#16a34a",bg:"#f0fdf4",t:"belegt"},
  gelb: {f:"var(--k-b45309,#b45309)",r:"#f59e0b",bg:"#fffbeb",t:"wahrscheinlich – bitte prüfen"},
  grau: {f:"var(--muted)",r:"var(--line)",bg:"var(--k-f2f5f3,#f2f5f3)",t:"nur Eingrenzung"},
  keine:{f:"var(--muted)",r:"var(--line)",bg:"var(--k-f2f5f3,#f2f5f3)",t:"nichts gefunden"}
};
async function fgNoteRahmenZeigen(el, ev){
  try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(e){}
  var eid=(el&&el.dataset&&el.dataset.eid)||null;
  var nm=(el&&el.dataset&&el.dataset.cn)||"";
  if(!eid && !nm) return;
  var zeile=el.closest?(el.closest(".fgBestZeile")||el.closest("label")):null;
  var alt=zeile&&zeile.nextElementSibling;
  if(alt&&alt.classList&&alt.classList.contains("fgNoteRahmen")){ alt.remove(); return; }
  var box=document.createElement("div");
  box.className="fgNoteRahmen";
  box.style.cssText="margin:-2px 0 8px;padding:9px 11px;border:1px solid var(--line);border-left:3px solid var(--k-2f6fd6,#2f6fd6);border-radius:8px;background:var(--k-f2f5f3,#f2f5f3);font-size:11.5px;line-height:1.55";
  box.textContent="Regelwerk wird befragt …";
  if(zeile&&zeile.parentNode) zeile.parentNode.insertBefore(box, zeile.nextSibling);
  try{
    var r=await client.rpc("cb_admin_stamm_notenrahmen",{p_name:nm, p_entity_id:eid});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e2){} }
    if(!d||d.ok===false){
      box.innerHTML='<span style="color:var(--k-b45309,#b45309)">Kein Rahmen abrufbar</span>'
        +'<span style="color:var(--muted)"> · '+esc(String((d&&d.grund)||"ohne Angabe"))+'</span>';
      return;
    }
    var a=_FG_AMPEL[String(d.ampel||"keine")]||_FG_AMPEL.keine;
    var H='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">'
      +'<b>Was das Regelwerk über „'+esc(String(d.name||nm))+'" hergibt</b>'
      +'<span style="font-size:10.5px;color:'+a.f+';background:'+a.bg+';border:1px solid '+a.r
      +';border-radius:5px;padding:0 5px">'+esc(a.t)+'</span></div>';
    if(d.vorschlag!=null){
      H+='<div style="margin-top:5px;font-size:13px">Vorschlag: <b style="color:'+a.f+'">Note '+esc(String(d.vorschlag))+'</b>'
        +' <span style="font-size:10.5px;color:var(--muted)">('
        +(String(d.vorschlag_quelle||"")==="regelwerk"?"aus dem Regelwerk":"aus einem fast gleichen Stammnamen")
        +')</span></div>';
    }
    H+='<div style="margin-top:3px;color:var(--muted)">'+esc(String(d.vorschlag_grund||""))+'</div>';
    var erl=Array.isArray(d.erlaubte_stufen)?d.erlaubte_stufen:[];
    if(erl.length && erl.length<11){
      H+='<div style="margin-top:5px">Regelkonform bleiben die Stufen: <b>'+esc(erl.join(", "))+'</b></div>';
      var aus=Array.isArray(d.ausgeschlossen)?d.ausgeschlossen:[];
      if(aus.length){
        H+='<div style="margin-top:3px;color:var(--muted)">Ausgeschlossen: '
          +aus.map(function(x){ return esc(String(x.stufe))+' ('+esc((x.regeln||[]).join(", "))+')'; }).join(" · ")
          +'</div>';
      }
    }
    var nb=Array.isArray(d.nachbarn)?d.nachbarn:[];
    if(nb.length){
      H+='<div style="margin-top:6px;color:var(--muted)">Ähnliche Stammzutaten, die bewertet sind:</div>'
        +nb.map(function(x){
          return '<div style="padding-left:8px">· <b>'+esc(String(x.zutat||""))+'</b>'
            +' · Note '+(x.note==null?'–':esc(String(x.note)))
            +' · Ähnlichkeit '+esc(String(x.aehnlichkeit))
            +(x.regel_titel?('<span style="color:var(--muted)"> · '+esc(String(x.regel_titel))+'</span>'):'')
            +'</div>'; }).join("");
    }
    if(d.kategorie_noten && d.kategorie_noten.bewertete){
      var kn=d.kategorie_noten;
      H+='<div style="margin-top:5px;color:var(--muted)">Kategorie „'+esc(String(kn.kategorie))+'": '
        +esc(String(kn.bewertete))+' bewertete Zutaten, Noten '+esc(String(kn.note_min))+'–'+esc(String(kn.note_max))
        +', am häufigsten '+esc(String(kn.haeufigste_note))+'.</div>';
    }
    H+='<div style="margin-top:6px;font-size:10.5px;color:var(--muted)">'+esc(String(d.hinweis||""))+'</div>';
    box.innerHTML=H;
  }catch(e){
    console.error("[M3b Notenrahmen]",e);
    box.innerHTML='<span style="color:var(--k-b91c1c,#b91c1c)">Rahmen nicht abrufbar: '+esc((e&&e.message)||String(e))
      +'</span> <span style="color:var(--muted)">– es wird NICHT behauptet, das Regelwerk sage nichts.</span>';
  }
}
if(typeof window!=="undefined"){ window.fgNoteRahmenZeigen=fgNoteRahmenZeigen; }
/* Verarbeitung nur über den bestehenden Serverweg ändern; Ergebnis danach vollständig neu laden. */
var _fgVerarbLaeuft=false;

async function fgBestVerarbEdit(el, ev){
  /* 🔴 Diese zwei Zeilen sind kein Beiwerk. Die Bestandteilzeile ist ein <label>
     mit der Bindungs-Checkbox darin — ein Klick auf IRGENDEIN Kind schaltet sie um.
     Ohne preventDefault hätte der Bearbeitungsknopf beim ersten Klick die Bindung
     gelöst, also genau den Schaden angerichtet, gegen den er gebaut ist. */
  if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  if(_fgVerarbLaeuft) return;
  if(el.querySelector("select")) return;                 /* schon offen */

  var eid=el.getAttribute("data-eid")||"";
  var cn=el.getAttribute("data-cn")||"";
  var mod=el.getAttribute("data-mod")||"unspecified_processing";
  var alt=el.innerHTML;
  el.setAttribute("data-alt", alt);
  el.innerHTML='<span style="font-size:11px;color:var(--muted)">lädt …</span>';

  var ctx=null, fehler="";
  try{
    var r=await client.rpc("cb_admin_zutaten_suchen_v2",{p_suche:cn, p_limit:8});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    var t=(Array.isArray(d)?d:[]).filter(function(x){ return String(x.entity_id||"")===eid; });
    if(t.length && Array.isArray(t[0].contexts) && t[0].contexts.length) ctx=t[0].contexts;
  }catch(e){
    console.error("[Bestandteil] Verarbeitungen laden:", e);
    fehler=(e&&e.message)?String(e.message):String(e);
  }
  if(!ctx){
    el.innerHTML=alt
      +'<span style="display:block;font-size:10.5px;color:var(--k-b45309,#b45309);line-height:1.35;margin-top:1px">'
      +(fehler ? '⚠ nicht erreichbar' : '⚠ keine Stufen hinterlegt')
      +'</span>';
    if(fehler) console.error("[Bestandteil] Verarbeitungen laden fehlgeschlagen:", fehler);
    /* Nach 4 Sekunden zurück auf die reine Anzeige – der Hinweis soll die Tabelle
       nicht dauerhaft verbreitern, und beim nächsten Render ist er ohnehin weg. */
    setTimeout(function(){ if(el.isConnected && !el.querySelector("select")) el.innerHTML=alt; }, 4000);
    return;
  }

  var hat=ctx.some(function(c){ return String(c.modifier||"")===mod; });
  var opts=(hat?[]:[{modifier:mod, processing_context:mod+" (aktuell, nicht in der Serverliste)", rating:null}]).concat(ctx);

  el.innerHTML='<select class="fgbVerarbSel" onchange="fgBestVerarbSave(this)" onkeydown="if(event.key===\'Escape\')fgBestVerarbAbbruch(this)"'
    +' onclick="event.preventDefault();event.stopPropagation()" style="width:100%;font-size:11.5px;padding:2px 3px;border:1px solid var(--k-2f6fd6,#2f6fd6);border-radius:5px;background:var(--card);color:var(--ink)">'
    +opts.map(function(c){
        var m=String(c.modifier||"unspecified_processing");
        var lab=String(c.processing_context||m);
        var n=(c.rating==null)?"Note nicht belegt":("Note "+c.rating);
        return '<option value="'+esc(m)+'"'+(m===mod?" selected":"")+'>'+esc(lab)+' · '+esc(n)+'</option>';
      }).join("")
    +'</select>';
  var sel=el.querySelector("select");
  if(sel){ try{ sel.focus(); }catch(e){} sel.addEventListener("blur", function(){ setTimeout(function(){ if(sel.isConnected && !sel.dataset.gesendet) fgBestVerarbAbbruch(sel); },150); }); }
}

function fgBestVerarbAbbruch(sel){
  var el=sel&&sel.closest(".fgbVerarbEdit"); if(!el) return;
  var alt=el.getAttribute("data-alt"); if(alt!=null) el.innerHTML=alt;
}

async function fgBestVerarbSave(sel){
  var el=sel&&sel.closest(".fgbVerarbEdit"); if(!el) return;
  sel.dataset.gesendet="1";
  var neu=String(sel.value||"").trim();
  var alt=el.getAttribute("data-mod")||"unspecified_processing";
  if(!neu || neu===alt){ fgBestVerarbAbbruch(sel); return; }

  var eid=el.getAttribute("data-eid")||"";
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid || !eid){ fgBestVerarbAbbruch(sel); alert("Ohne Produkt-Nummer oder Identität wird nichts geändert."); return; }

  _fgVerarbLaeuft=true;
  sel.disabled=true;
  try{
    var r=await client.rpc("cb_admin_canonical_zutat_binden",
      {p_produkt_id:pid, p_entity_id:eid, p_processing_modifier:neu, p_referenz_id:null});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(!d||d.ok!==true) throw new Error((d&&(d.fehler||d.grund))||"Der Server hat die Änderung nicht bestätigt.");
    try{ toast&&toast("Verarbeitung geändert: "+(d.canonical_name||"")+" · "+(d.processing_modifier||neu)
      +(d.rating!=null?(" · Note "+d.rating):" · Note nicht belegt")); }catch(e){}
    try{ if(typeof fgCanonLaden==="function") await fgCanonLaden(pid); }catch(e){ console.error("[Bestandteil] Vertrag nachladen:", e); }
    /* Work #181 Stufe 5: der Zuordnungsstand wandert an JEDER Stelle mit, an der auch der
       Canonical-Stand neu geholt wird. Sonst zeigte der Zaehler einen Stand von vorhin. */
    try{ if(typeof fgZuordnungLaden==="function") await fgZuordnungLaden(pid); }catch(e){ console.error("[Zuordnung] nachladen:", e); }
    try{ if(typeof fgPickRender==="function") fgPickRender(); }catch(e){ console.error("[Bestandteil] neu rendern:", e); }
    try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  }catch(e){
    console.error("[Bestandteil] cb_admin_canonical_zutat_binden (Verarbeitung):", e);
    fgBestVerarbAbbruch(sel);
    alert("Die Verarbeitung wurde NICHT geändert.\n\n"+((e&&e.message)||e)
      +"\n\nDie Zeile steht unverändert da.");
  }
  _fgVerarbLaeuft=false;
}
if(typeof window!=="undefined"){ window.fgBestVerarbEdit=fgBestVerarbEdit;
  window.fgBestVerarbSave=fgBestVerarbSave; window.fgBestVerarbAbbruch=fgBestVerarbAbbruch; }

/* Bestandteilzahlen aus demselben Serververtrag ableiten; keine lokale zweite Zählregel. */
/* 14.09.2026, RALPH an P73725: "oben steht 6/6 gruen, in der uebersicht ist
   E414 offen ... bei 6/6 muss die wahrheit stehen."
   Er hat recht. Die Bilanz zaehlte nur Zutatenzeilen. Ein Zusatzstoff, den der
   Server erkennt, der aber KEINE Zeile in Produkt_Zutaten hat (E414 Gummi
   arabicum), war im Nenner unsichtbar - die Station stand auf 6/6 und gruen,
   obwohl ein Bestandteil fehlte. Dieselbe Sorte Fehler wie am 23.08. und am
   10.09.: die Information stand da, die Farbe sagte das Gegenteil.
   Die Liste wird NICHT neu erfunden: sie ist dieselbe, aus der auch der Kasten
   "Zusatzstoff ohne Bestandteilzeile" gebaut wird (frueher stand die Regel
   zweimal da, jetzt einmal hier). */
/* 🔴 14.09.2026, Ralph: "die produkt erfassen seite muss die infos aus der
   datenbank ziehen, nicht selber rechnen wie du gesagt hast, da kommen nur
   fehler raus."
   Er hat recht, und der Beleg ist P73725. Der Etikettentext lautet
   "Sucralose (E955), Emulgator Sonnenblumenlecithin, Emulgator
   Sonnenblumenecithin in Schokostreusel, Gummi arabicum (E414)".
   zusSeed() zerlegt ihn HIER im Browser mit einer eigenen kleinen Auflösung
   (ZUSATZSTOFFE_MAP, ZUS_SYN, _zusFindStamm) und schreibt bei jedem Fehlschlag
   einst:"ungeprüft". Die beiden Emulgator-Zeilen - eine davon mit Tippfehler
   und Ortszusatz - traf sie nicht und meldete "2 Zusatzstoffe nicht
   eingestuft". GEMESSEN am selben Produkt: cb_app_produkt_zusatzstoffe liefert
   resolution_status "identified", drei Stoffe (E322 neutral, E414 neutral,
   E955 abgewertet) und eine LEERE Liste offener Kandidaten. Der Server hatte
   recht, die Seite hat sich das Gegenteil ausgerechnet.

   Deshalb urteilt ab jetzt nur noch die Datenbank darüber, was uneingestuft
   ist. window._fgZus bleibt unberührt - daraus entsteht fe_ztext, also der
   gespeicherte Wortlaut des Etiketts; der darf nicht zu Stammnamen umgeschrieben
   werden. Solange die Serverantwort fehlt (neues, noch nicht gespeichertes
   Produkt), gilt weiter die alte Regel - dann gibt es nichts Besseres. */
function _fgZusUneingestuft(){
  var d=window._fgZusV2;
  if(d && Array.isArray(d.items)){
    var out=[];
    d.items.forEach(function(it){
      var e=String(it.evaluation||"").trim().toLowerCase();
      if(!e || e==="ungepr\u00fcft" || e==="ungeprueft")
        out.push({name:(it.name||it.e_number||""), e:it.e_number||null});
    });
    (Array.isArray(d.unresolved_candidates)?d.unresolved_candidates:[]).forEach(function(c){
      if(!_zusIstLeer(c.text)) out.push({name:String(c.text||""), e:null});
    });
    return out;
  }
  /* Rueckfall ohne Serverantwort - unveraendert die alte Regel */
  return (window._fgZus||[]).filter(function(z){
    return !/^(neutral|keine|unbedenklich|abgewertet|kritisch)$/i.test(String(z.einst||"")) && !_zusIstLeer(z.name);
  }).map(function(z){ return {name:z.name, e:z.e||null}; });
}
if(typeof window!=="undefined"){ window._fgZusUneingestuft=_fgZusUneingestuft; }
function _fgZusOhneZeile(){
  var d=window._fgZusV2, out=[];
  var items=(d&&Array.isArray(d.items))?d.items:[];
  items.forEach(function(it){
    var hat=(Array.isArray(it.produkt_zutat_ids)&&it.produkt_zutat_ids.length)||it.produkt_zutat_id;
    if(!hat) out.push(it);
  });
  return out;
}
function _fgBestandteilBilanz(){
  var rows=window._fgCanon;
  if(!Array.isArray(rows)||!rows.length) return null;   /* kein Vertrag ⇒ alte Anzeige */
  /* ══════════════════════════════════════════════════════════════════════
     29.08.2026, RALPH: "oben rechts steht 17/19, also zählen sie immer noch
     voll mit."
     Er hat recht. Eine HUELLE ist eine Zeile, deren Bestandteile einzeln am
     Produkt stehen ("71% EIER-TEIGWAREN (…)" - Hartweizengriess, Wasser,
     Vollei, Sonnenblumenoel sind eigene Zutaten geworden). Der Server laesst
     sie seit A1 aus der Bewertung heraus, aber dieser Zaehler kannte sie
     nicht und zaehlte sie als 19. Zeile mit.
     Eine Zeile, die nicht bewertet wird, darf auch nicht im Nenner stehen.
     Das Feld kommt vom Server: score_leaf===false heisst Huelle. */
  rows=rows.filter(function(z){ return !(z && z.score_leaf===false); });
  if(!rows.length) return null;
  var b={quelle:"vertrag", gesamt:rows.length, ohne_note:0, ohne_identitaet:0, benannt:0};
  rows.forEach(function(z){
    /* 🔴 27.08.2026, Ralphs Fund an P018: die Station meldete "4 von 10 offen",
       obwohl DREI der vier Zeilen (Stabilisator, Säureregulator, Vitamine) vom
       Server ausdruecklich als Sonderfall BENANNT sind - nur Calcium ist eine
       echte Luecke. Benannt ist nicht offen (Regel not_applicable_is_not_missing).
       Die Unterscheidung kommt aus dem gemeinsamen Kern riegel-kern.js, damit
       Editor und neue Seite dieselbe Zaehlregel benutzen. */
    var _lk = (typeof RIEGEL!=="undefined" && RIEGEL.luecke) ? RIEGEL.luecke(z)
            : (z.resolved_rating==null ? {typ:(z.disposition?0:1)} : null);
    if(_lk && _lk.typ===0){ b.benannt++; return; }   /* bewusst offen: zaehlt nicht als Luecke */
    if(z.resolved_rating==null) b.ohne_note++;
    if(!z.canonical_entity_id) b.ohne_identitaet++;
  });
  b.gebunden = rows.length;
  b.offen = 0;
  b.offen_unbekannt = false;
  try{
    if(window._fgZutOffenFehler){ b.offen_unbekannt = true; }
    else if(typeof _fgZutOffenListe === "function"){
      var _off = _fgZutOffenListe();
      b.offen = Array.isArray(_off) ? _off.length : 0;
    }
  }catch(e){ b.offen_unbekannt = true; console.error("Bestandteil-Bilanz, offene Zutaten:", e); }
  b.gesamt_alle = b.gebunden + b.offen;
  /* 14.09.2026: Zusatzstoffe ohne eigene Bestandteilzeile gehoeren in den
     Nenner - sonst meldet die Station "vollstaendig", waehrend ein Stoff
     nur im Warnkasten steht. */
  try{ b.zus_ohne_zeile = _fgZusOhneZeile().length; }
  catch(e){ b.zus_ohne_zeile = 0; console.error("Bestandteil-Bilanz, Zusatzstoffe:", e); }
  b.gesamt_wahr = b.gesamt + b.zus_ohne_zeile;
  return b;
}
if(typeof window!=="undefined"){ window._fgBestandteilBilanz=_fgBestandteilBilanz; }
/* ────────────────────────────────────────────────────────────────────────────
   RALPH 10.09.2026 — "so ist es scheisse, ehrlich."
   Er hatte recht. Was die Freigabe blockiert, stand rechts in einer zweiten
   Spalte, der Grund dafuer nochmal in den technischen Details, und der Abgleich
   ein drittes Mal unten drunter. Drei Orte fuer eine Sache.
   Ab jetzt steht das Blockierende dort, wo die Zutaten stehen: in derselben
   Liste, rot, mit dem Grund in einem Satz und demselben Menue wie rechts.
   Es wird NICHTS neu entschieden — dieselben Elemente, dieselben Pruefzeilen,
   dieselben Funktionen (fgRefV2Schnell / fgRefV2Menu). Nur der Ort ist neu.
   ──────────────────────────────────────────────────────────────────────────── */
function _fgBestGrundText(e){
  var st=String(e.status||"");
  var name=String(e.name||"");
  var worte=name.split(/\s+/).filter(Boolean).length;
  if(st==="MEHRDEUTIG") return "Der Name kann zwei verschiedene Dinge meinen. Solange das offen ist, bleibt das Produkt gesperrt.";
  if(st==="FRAGMENT")   return "Das ist nur ein Bruchstueck eines Namens, keine ganze Zutat.";
  if(st==="UNSICHER")   return "Die Zuordnung zum Stamm ist nicht sicher genug.";
  if(st==="KLAMMER_FEHLER") return "Die Klammern auf dem Etikett gehen nicht auf – die Zeile wurde falsch zerlegt.";
  if(st==="FALSCH_ZERLEGT") return "Die Zeile wurde falsch zerlegt.";
  if(st==="HERSTELLERANGABE_UNVOLLSTAENDIG") return "Der Hersteller nennt die Bestandteile dieser Gruppe nicht einzeln.";
  if(worte>=6) return "Diese Zeile steht nicht im Zutatenstamm – und sie liest sich wie ein Satz, nicht wie eine Zutat. Vermutlich Werbetext vom Etikett.";
  return "Diese Zutat steht nicht im Zutatenstamm. Solange sie offen ist, bleibt das Produkt gesperrt.";
}
/* 🔴 10.09.2026, NACHGEMESSEN NACH RALPHS FUND ("die 3 habe ich entfernt, aber
   die Meldung ist noch da"): meine erste Fassung hat jede Zeile ausgeblendet,
   deren Manueller_Status nicht mehr OFFEN war - also auch ABGELEHNTE. Das war
   falsch, und zwar auf die gefaehrlichste Art: die Liste sagte "nichts blockiert",
   waehrend die Sperre stand.
   GEMESSEN am Server: cb_referenz_pruefung_status zaehlt die effektiven Blocker,
   und cb_v2_manuell_uebersteuert hebt einen Blocker NUR bei BESTAETIGT oder
   IGNORIERT auf - ABGELEHNT nicht. Bei Automatik-Status UNBEKANNT greift die
   Uebersteuerung ueberhaupt nicht (cb_v2_status_ohne_zuordnung).
   Ab jetzt ist die Wahrheit die Liste des Servers (d.blockierende_fehler), nach
   derselben Regel gefiltert. Nicht meine eigene. */
function _fgBestBlockerListe(){
  var d=(window._fgRefV2||{}).d;
  if(!d||!Array.isArray(d.elemente)||!Array.isArray(d.blockierende_fehler)) return [];
  var elById={}; d.elemente.forEach(function(e){ if(e) elById[e.id]=e; });
  var pzById={}; (d.pruefzeilen||[]).forEach(function(p){ if(p) pzById[p.Parser_Element_ID]=p; });
  return d.blockierende_fehler.map(function(b){
    if(!b||b.id==null) return null;
    var pz=pzById[b.id]||null, ms=String((pz&&pz.Manueller_Status)||"OFFEN");
    if(ms==="BESTAETIGT"||ms==="IGNORIERT") return null;   /* dieselbe Regel wie der Server */
    return {id:b.id, el:elById[b.id]||{}, pz:pz, ms:ms, befund:String(b.befund||b.art||"")};
  }).filter(Boolean);
}
function _fgBestBlockerHtml(){
  var liste=_fgBestBlockerListe();
  if(!liste.length) return "";
  return liste.map(function(x){
    var e=x.el;
    var name=String(e.name||e.original_text||x.befund||"");
    var zusatz="";
    if(x.ms==="ABGELEHNT") zusatz='<div style="margin-top:5px;font-size:12px;color:#b45309;line-height:1.5">'
      +'⚠ Diese Zeile wurde als „falsch erkannt" markiert – <b>das räumt sie nicht weg</b>. '
      +'Nimm im Menü „···" den Punkt <b>Entfernen – ist keine Zutat</b>, dann sperrt sie nicht mehr.</div>';
    return '<div style="display:flex;gap:11px;align-items:flex-start;padding:11px 9px;border-top:1px solid var(--line);background:#fdeeec;border-left:4px solid #dc2626">'
      +'<span style="width:10px;height:10px;border-radius:50%;background:#dc2626;flex:none;margin-top:5px"></span>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:600;color:#c0392b;font-size:13px;line-height:1.4">'+esc(name)+'</div>'
        +'<div style="margin-top:5px;font-size:12px;color:#c0392b;line-height:1.5">⛔ '+esc(_fgBestGrundText(e))+'</div>'
        +zusatz
      +'</div>'
      +'<span style="flex:none;display:flex;gap:5px">'
        +'<button type="button" onclick="fgRefV2Schnell('+x.id+')" title="Zuordnung bestätigen (wie erkannt)" style="font-size:11px;padding:2px 7px;border:1px solid #bfe3cb;border-radius:6px;background:#e7f6ec;color:#1f7d43;cursor:pointer;line-height:1.6">✓</button>'
        +'<button type="button" onclick="fgRefV2Menu(event,'+x.id+')" title="Was soll damit passieren?" style="font-size:11px;padding:2px 7px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--muted);cursor:pointer;line-height:1.6">···</button>'
      +'</span>'
    +'</div>';
  }).join("");
}
function _fgBestKopfHtml(){
  var d=(window._fgRefV2||{}).d;
  var n=Array.isArray(window._fgCanon)?window._fgCanon.length:0;
  var bl=0;
  try{ bl=_fgBestBlockerListe().length; }catch(e){}
  var txt=n+(n===1?" Zutat erfasst":" Zutaten erfasst");
  if(bl) txt+=' · <b style="color:#c0392b">'+bl+(bl===1?' Zeile blockiert':' Zeilen blockieren')+' die Freigabe</b>';
  else   txt+=' · <b style="color:#166534">nichts blockiert die Freigabe</b>';
  return '<div style="padding:9px 10px;border-bottom:1px solid var(--line);background:var(--k-f6f8f7,#f6f8f7);font-size:12px;color:var(--muted);line-height:1.5">'+txt+'</div>';
}
if(typeof window!=="undefined"){ window._fgBestBlockerHtml=_fgBestBlockerHtml; }
/* Rendert die gemeinsame Liste. Gibt true zurück, wenn sie gerendert hat –
   sonst übernimmt der bestehende Picker (fgPickRender), unverändert (§17). */
function fgBestandteileRender(){
  var wrap=document.getElementById("fe_pickList"); if(!wrap) return false;
  var rows=window._fgCanon;
  if(!Array.isArray(rows)||!rows.length) return false;
  /* Bei aktiver Suche gilt der Picker: dort wird der STAMM durchsucht, und genau
     dafür ist das Suchfeld da. Die Bestandteilliste zeigt dieses Produkt. */
  var q=((document.getElementById("fe_zutSuche")||{}).value||"").trim();
  if(q) return false;

  var zusMap=_fgZusNachPz();
  var gebunden=(typeof _fgRowsSet==="function")?_fgRowsSet():{};
  var sortiert=rows.slice().sort(function(a,b){ return (Number(a.reihenfolge)||0)-(Number(b.reihenfolge)||0); });
  var gesehen={};
  var H=sortiert.map(function(z){
    var k=String(z.produkt_zutat_id||""); if(k) gesehen[k]=true;
    var nm=String(z.sichtbarer_name||z.canonical_name||"").trim().toLowerCase();
    var _gebunden = !!String(z.canonical_entity_id||"").trim() || !!gebunden[nm];
    return _fgBestZeile(z, zusMap[k], _gebunden);
  });
  var rest=[];
  Object.keys(zusMap).forEach(function(k){ if(!gesehen[k]) rest=rest.concat(zusMap[k]); });
  try{ rest = rest.concat(_fgZusOhneZeile()); }catch(e){ console.error("Zusatzstoffe ohne Zeile:", e); }
  if(rest.length){
    H.push('<div style="padding:7px 9px;border-bottom:1px solid var(--line);background:var(--k-fffbeb,#fffbeb)">'
      +'<div style="font-size:11px;font-weight:700;color:var(--k-92400e,#92400e)">Zusatzstoff ohne Bestandteilzeile</div>'
      +rest.map(function(it){ return '<div style="font-size:12px;color:var(--ink);margin-top:2px">'
          +(it.e_number?'<b>'+esc(String(it.e_number))+'</b> · ':'')+esc(String(it.name||""))
          +' <span style="color:var(--muted)">– zu diesem Zusatzstoff gibt es keine Zeile in Produkt_Zutaten. Er wird angezeigt, aber nicht zusammengeführt.</span></div>'; }).join("")
      +'</div>');
  }
  var _off=(typeof _fgZutOffenHtml==="function")?_fgZutOffenHtml():"";
  var st=wrap.scrollTop;
  wrap.innerHTML=_fgBestKopfHtml()+H.join("")+_off+_fgBestBlockerHtml()
    +'<div style="padding:8px;color:var(--muted);font-size:11.5px;text-align:center;border-top:1px dashed var(--line)">'
    +'🔎 Tippen durchsucht den Zutatenstamm</div>';
  try{ wrap.scrollTop=st; }catch(e){}
  try{ fgZutSammelLeiste(); }catch(e){}
  return true;
}
if(typeof window!=="undefined"){ window.fgzCanonPick=fgzCanonPick; window._fgzV2Suchen=_fgzV2Suchen;
  window.fgCanonLaden=fgCanonLaden; window.fgCanonAnwenden=fgCanonAnwenden;
  window.fgZusV2Laden=fgZusV2Laden; window.fgBestandteileRender=fgBestandteileRender; }

function fgzMenu(inp){
  var wrap=inp.closest(".fgzWrap"); if(!wrap) return;
  var menu=wrap.querySelector(".fgzMenu"); if(!menu) return;
  var q=(inp.value||"").trim().toLowerCase();
  /* V2 zuerst, entprellt (250 ms) — sonst ein RPC-Aufruf je Tastendruck.
     Liefert sie Treffer, ist das Menü fertig; sonst fällt es unten auf die
     alte Liste durch, die als ALTCODE bewusst stehen bleibt (§17). */
  if(q.length>=2){
    if(_fgzV2.timer) clearTimeout(_fgzV2.timer);
    if(_fgzV2.q===q && _fgzV2.treffer!==null && _fgzV2.treffer){ if(_fgzV2Render(menu)) return; }
    else {
      _fgzV2.timer=setTimeout(function(){ _fgzV2.timer=0;
        _fgzV2Suchen(q, function(){ try{ if(document.body.contains(menu)) { if(!_fgzV2Render(menu)) fgzMenuLegacy(inp); } }catch(e){} });
      }, 250);
      menu.innerHTML='<div style="padding:8px 10px;font-size:12px;color:var(--muted)">Canonical-Suche läuft …</div>';
      menu.style.display="block";
      return;
    }
  }
  fgzMenuLegacy(inp);
}
function fgzMenuLegacy(inp){
  var wrap=inp.closest(".fgzWrap"); if(!wrap) return;
  var menu=wrap.querySelector(".fgzMenu"); if(!menu) return;
  var q=(inp.value||"").trim().toLowerCase();
  var list=(typeof ZUTATEN_STAMM!=="undefined"&&ZUTATEN_STAMM)?ZUTATEN_STAMM:[];
  var supp=(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()==="supplement");
  var res=[];
  for(var i=0;i<list.length;i++){ var it=list[i]; var nm=(it&&it.name)||""; if(!nm) continue;
    if(supp && it.kategorie && FG_FOOD_KATS[it.kategorie]) continue;
    if(q===""||nm.toLowerCase().indexOf(q)>=0) res.push(nm); }
  if(q!==""){ res.sort(function(a,b){ var as=a.toLowerCase().indexOf(q)===0?0:1, bs=b.toLowerCase().indexOf(q)===0?0:1; return as-bs||a.length-b.length; }); }
  res=res.slice(0,14);
  if(!res.length){ menu.style.display="none"; return; }
  menu.innerHTML=res.map(function(n){ return '<div onmousedown="fgzPick(this)" data-n="'+esc(n)+'" onmouseenter="this.style.background=\'var(--k-f2f5f3)\'" onmouseleave="this.style.background=\'\'" style="padding:8px 10px;font-size:13px;color:var(--ink);cursor:pointer;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(n)+'</div>'; }).join('');
  menu.style.display="block";
}
function fgzPick(opt){
  var wrap=opt.closest(".fgzWrap"); var inp=wrap&&wrap.querySelector(".fgzName");
  if(inp){ inp.value=opt.getAttribute("data-n"); fgZutAuto(inp); }
  var menu=opt.closest(".fgzMenu"); if(menu) menu.style.display="none";
}
function fgzMenuBlur(inp){ setTimeout(function(){ var wrap=inp.closest(".fgzWrap"); var menu=wrap&&wrap.querySelector(".fgzMenu"); if(menu) menu.style.display="none"; }, 160); }
/* Unbekannte Zutat im Freigabe-Editor: Riki stuft ein + Waechter pruefen, dann in den Stamm.
   Kein Handeingriff der Zahl – identisch zum Scan-Fluss. */
function fgZutRiki(btn){
  var row=btn.closest(".fgZutRow"); if(!row) return;
  var nameInp=row.querySelector(".fgzName"), rate=row.querySelector(".fgzRate");
  var name=((nameInp&&nameInp.value)||"").trim();
  if(!name){ if(nameInp) nameInp.focus(); return; }
  if(btn.dataset.mode==="save"){
    var st=parseInt(btn.dataset.stufe,10); if(!(st>=0&&st<=10)) return;
    btn.disabled=true; btn.textContent="…";
    zutStammAnlegenMitKat({p_name:name,p_rating:st,p_quelle:"Riki + Verifikation ("+(btn.dataset.gesamt||"")+"), Freigabe"}).then(function(res){
      btn.disabled=false;
      if(res.error||!(res.data&&res.data.ok)){ btn.textContent="Fehler"; setTimeout(function(){btn.textContent="→ Riki";},1500); return; }
      var rr=res.data.rating;
      if(typeof ZUTATEN_MAP!=="undefined"&&ZUTATEN_MAP){ ZUTATEN_MAP[name.toLowerCase()]={rating:rr,kritisch:"nein"}; }
      if(Array.isArray(ZUTATEN_STAMM)){ ZUTATEN_STAMM.push({name:name,rating:rr,kritisch:"nein"}); var dl=document.getElementById("fgZutDL"); if(dl){ var op=document.createElement("option"); op.value=name; dl.appendChild(op);} }
      if(rate){ rate.value=rr; rate.style.color="var(--ink)"; }
      btn.style.display="none"; delete btn.dataset.mode;
      var inf=row.nextElementSibling; if(inf&&inf.classList&&inf.classList.contains("fgRikiInfo")) inf.remove();
      try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
    }, function(){ btn.disabled=false; btn.textContent="Fehler"; setTimeout(function(){btn.textContent="→ Riki";},1500); });
    return;
  }
  btn.disabled=true; btn.textContent="Riki…";
  client.auth.getSession().then(function(s){
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok){ btn.disabled=false; btn.textContent="Login?"; setTimeout(function(){btn.textContent="→ Riki";},1500); return null; }
    return fetch(client.supabaseUrl+"/functions/v1/riki-zutat-bewerten",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},body:JSON.stringify({name:name})}).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); });
  }).then(function(rr){
    if(!rr) return; btn.disabled=false;
    if(!rr.ok||typeof rr.d.stufe!=="number"){ btn.textContent="Fehler"; setTimeout(function(){btn.textContent="→ Riki";},1500); return; }
    var st=rr.d.stufe, v=rr.d.verifikation||{}, ges=v.gesamt||"KEIN_SIGNAL", w=v.waechter||{};
    var col=ges==="BESTAETIGT"?"var(--k-16a34a)":ges==="AUSNAHME"?"var(--k-b91c1c)":"var(--k-b45309)";
    var lbl=ges==="BESTAETIGT"?"bestätigt":ges==="AUSNAHME"?"Widerspruch – prüfen":ges==="PRUEFEN"?"grenzwertig":"kein Prüfsignal";
    if(rate){ rate.value=st; rate.style.color=col; }
    var old=row.nextElementSibling; if(old&&old.classList&&old.classList.contains("fgRikiInfo")) old.remove();
    var wn=(w.w_name||{}).urteil, wp=(w.w_peer||{}).urteil;
    var html='<div class="fgRikiInfo" style="margin:-2px 0 7px;padding:7px 9px;border:1px solid var(--line);border-left:3px solid '+col+';border-radius:7px;background:var(--k-f2f5f3);font-size:11.5px;line-height:1.5">'
      +'<b>Riki: Stufe '+st+'</b>'+(rr.d.begruendung?" — "+esc(rr.d.begruendung):"")
      +'<br><span style="color:'+col+';font-weight:700">'+lbl+'</span> · Name '+_wIcon(wn)+' · Statistik '+_wIcon(wp)
      +((w.w_peer&&w.w_peer.text)?'<br><span style="color:var(--muted)">'+esc(w.w_peer.text)+'</span>':"")+'</div>';
    row.insertAdjacentHTML("afterend",html);
    btn.textContent="✓ übernehmen"; btn.dataset.mode="save"; btn.dataset.stufe=st; btn.dataset.gesamt=ges;
  }, function(){ btn.disabled=false; btn.textContent="Fehler"; setTimeout(function(){btn.textContent="→ Riki";},1500); });
}
/* ────────────────────────────────────────────────────────────────────────────
   WORK #305 — VON DER TAGESDOSIS INS TAGEBUCH.
   Der Weg, der hier bedient wird, ist der bestehende: das Tagebuch liest
   Produkt_Mikronaehrstoffe je 100 g und multipliziert mit der gegessenen Menge.
   Neu ist nur, dass die Umrechnung ueberhaupt jemand anstoesst.
   Erst pruefen, dann uebernehmen - der Trockenlauf zeigt die Zahl, bevor sie steht.
   ──────────────────────────────────────────────────────────────────────────── */
function _feDosisMsg(txt, farbe){
  var m=document.getElementById("fe_dosisMsg");
  if(m){ m.textContent=txt||""; m.style.color=farbe||"var(--muted)"; }
}
async function _feDosisLauf(ausfuehren){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid){ _feDosisMsg("Erst speichern – ohne Produkt-Nummer gibt es nichts umzurechnen.","var(--k-b45309)"); return; }
  var el=document.getElementById("fe_portionG");
  var g=el?Number(String(el.value||"").replace(",",".")):NaN;
  if(!(g>0)){ _feDosisMsg("Bitte das Gewicht einer Tagesdosis eintragen – ohne Zahl wird nichts geschätzt.","var(--k-b45309)"); return; }
  _feDosisMsg(ausfuehren?"übernehme …":"rechne …");
  try{
    var r=await client.rpc("cb_admin_supplement_dosis_setzen",
      {p_produkt_id:pid, p_portion_g:g, p_bezug:"tagesdosis", p_ausfuehren:!!ausfuehren});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    if(!d||d.ok!==true) throw new Error((d&&d.grund)||"Der Server hat nichts bestätigt.");
    var a=d.ableitung||{};
    if(a.ok!==true){ _feDosisMsg("Nicht umgerechnet: "+String(a.grund||"ohne Angabe"),"var(--k-b45309)"); return; }
    var z=Array.isArray(a.zeilen)?a.zeilen:[];
    var txt=z.filter(function(x){ return x.status==="berechnet"; })
             .map(function(x){ return x.stoff+" "+x.je_tagesdosis+" → "+x.je_100g+" "+x.einheit+"/100 g"; }).join(" · ");
    var offen=z.filter(function(x){ return x.status!=="berechnet"; });
    _feDosisMsg((ausfuehren?"✓ übernommen: ":"Vorschau: ")+(txt||"nichts umzurechnen")
      +(offen.length?(" · "+offen.length+" nicht umrechenbar: "+offen.map(function(x){return x.stoff+" ("+x.status+")";}).join(", ")):""),
      ausfuehren?"var(--k-166534)":"var(--muted)");
  }catch(e){
    console.error("[#305 Dosis]",e);
    _feDosisMsg("Fehlgeschlagen: "+((e&&e.message)||e),"var(--k-b91c1c)");
  }
}
function feDosisPruefen(){ return _feDosisLauf(false); }
function feDosisUebernehmen(){ return _feDosisLauf(true); }
if(typeof window!=="undefined"){ window.feDosisPruefen=feDosisPruefen; window.feDosisUebernehmen=feDosisUebernehmen; }
function fgAddZutat(){ const c=document.getElementById("fe_zutRows"); if(c){ c.insertAdjacentHTML("beforeend", fgZutRow("",null,"nein")); if(window._fgDirtyArmed&&window._fgDirty) window._fgDirty.zut=true; } }
function _fgRowsSet(){ var set={}; var c=document.getElementById("fe_zutRows"); if(c)[].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){ var n=((r.querySelector(".fgzName")||{}).value||"").trim(); if(n) set[n.toLowerCase()]=true; }); return set; }
function _fgRowsInfo(){ var out={}; var c=document.getElementById("fe_zutRows"); if(c)[].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){
  var n=((r.querySelector(".fgzName")||{}).value||"").trim(); if(!n) return;
  var rv=(r.querySelector(".fgzRate")||{}).value; var kr=!!((r.querySelector(".fgzKrit")||{}).checked);
  out[n.toLowerCase()]={name:n, rating:(rv===""||rv==null)?null:Number(rv), krit:kr?"ja":"nein"}; }); return out; }
function _fgRowsNames(){ var out=[]; var c=document.getElementById("fe_zutRows"); if(c)[].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){ var n=((r.querySelector(".fgzName")||{}).value||"").trim(); if(n) out.push(n); }); return out; }
function fgPickRender(){
  var wrap=document.getElementById("fe_pickList"); if(!wrap) return;
  try{ if(fgBestandteileRender()) return; }catch(e){ console.error("[Bestandteile] rendern:", e); }
  var q=((document.getElementById("fe_zutSuche")||{}).value||"").trim().toLowerCase();
  var supp=(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()==="supplement");
  var sel=_fgRowsSet();
  var all=(ZUTATEN_STAMM||[]).filter(function(it){ if(supp && it.kategorie && FG_FOOD_KATS[it.kategorie]) return false; return true; });
  var isSel=function(it){ return !!sel[(it.name||"").trim().toLowerCase()]; };
  var checked=all.filter(isSel), rest=all.filter(function(it){return !isSel(it);});
  /* #746 (16.09.2026): "nicht im Stamm" sagt der SERVER, nicht der Namensvergleich im
     Browser. Gemessen an P73675: Mangopueree und Ananassaftkonzentrat standen rot, obwohl
     die Referenzpruefung beide gebunden hatte. _fgServerKennt() fragt Stammliste,
     Produktstand, Zuordnungsstand und Pruefzeilen - kennt keiner den Namen, ist er frei. */
  var _frei=[]; var _ri=_fgRowsInfo();
  Object.keys(_ri).forEach(function(k){ if(!_fgServerKennt(k)) _frei.push({name:_ri[k].name, rating:_ri[k].rating, kritisch:_ri[k].krit, _frei:true}); });
  if(q){ var mm=function(it){return (it.name||"").toLowerCase().indexOf(q)>=0;}; checked=checked.filter(mm); rest=rest.filter(mm); _frei=_frei.filter(mm); }
  var shown = _frei.concat(q ? checked.concat(rest) : checked);
  var hintRow = q ? "" : '<div style="padding:8px;color:var(--muted);font-size:11.5px;text-align:center;border-top:1px dashed var(--line)">\ud83d\udd0e Tippen durchsucht alle '+all.length+' Stamm-Zutaten</div>';
  /* 27y ("1x reicht"): Stoffe, die als ZUSATZSTOFF erfasst sind, erscheinen hier nicht mehr als
     normale Doppel-Zeile - nur als schmaler ⚗-Verweis. Die Bindung selbst bleibt bestehen
     (Prinzip 8, beide Achsen); geaendert wird sie ueber die Zusatzstoff-Karte. */
  var zusE={}; (window._fgZus||[]).forEach(function(z){ if(z.e) zusE[String(z.e).toUpperCase()]=z; });
  /* 🔴 26.08.2026, gemessen an P73652 "Rohe Bio-Kakaonibs".
     Die Zeile stand richtig als "gelesen – noch nicht zugeordnet" da und zeigte
     daneben WERT 9. Gemessen: fuer P73652 gibt es KEINE gebundene Produkt-Zutat
     (Produkt_Zutaten leer, v_product_ingredient_resolution leer), die Zutat liegt
     offen in Zutat_Offen ohne Zutat_ID. Die 9 kam also nicht aus einer Zuordnung,
     sondern aus dem Eingabefeld der Editorzeile — dort hatte RIKI beim Lesen seinen
     Vorschlag hinterlassen. Eine EXTRAHIERTE Zahl wurde als BEWERTUNG angezeigt;
     genau die Zustandsvermischung, die state_separation verbietet.
     Ohne Zuordnung gibt es keinen Wert, also steht hier "–". Der Vorschlag bleibt
     im Eingabefeld der Zeile erhalten, er wird nur nicht mehr als Ergebnis gezeigt.
     Gebundene Zeilen laufen ueber _fgBestZeile mit resolved_rating vom Server und
     sind davon nicht beruehrt. */
  var row=function(it){ var nm=it.name||"", chk=isSel(it);
    var _wert=it._frei?null:it.rating;
    var rt=(_wert==null?"–":_wert);
    var col=(_wert==null)?"var(--muted)":(_wert>=7?"#2e9e57":_wert>=4?"#c88616":"#cf5442");
    var ze=fgZutZusE(nm);
    if(ze && zusE[ze]){
      return '<div title="Zählt auf beiden Achsen (§4.6) – der Haken bindet die ZUTAT, den Zusatzstoff pflegst du in der Zusatzstoff-Karte" style="display:grid;grid-template-columns:22px 1fr 46px;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);background:'+(chk?"var(--greenlt,#eef7f0)":"var(--bg)")+'">'
        +'<input type="checkbox" '+(chk?"checked":"")+' data-name="'+esc(nm)+'" data-rating="'+(it.rating==null?"":it.rating)+'" data-krit="'+esc(it.kritisch||"nein")+'" onchange="fgPickToggle(this)" style="width:16px;height:16px;accent-color:var(--k-16a34a)">'
        +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--ink)">'
          +'<span style="font-size:11px;color:var(--k-166534,#166534);background:var(--greenlt,#ecfdf5);border:1px solid var(--k-16a34a,#16a34a);border-radius:5px;padding:1px 4px" title="als Zusatzstoff erfasst">⚗</span> '+esc(nm)
          +' <span onclick="zusModalOpen()" style="color:var(--k-166534,#166534);font-size:11px;white-space:nowrap;cursor:pointer;text-decoration:underline">· bearbeiten in Zusatzstoffe ›</span></span>'
        +'<span style="text-align:center;font-weight:700;font-size:13px;color:'+col+'">'+rt+'</span>'
      +'</div>';
    }
    var _blau=!!it._frei;
    var _bg = _blau ? "background:var(--k-eef6ff,#eef6ff);box-shadow:inset 3px 0 0 var(--k-2f6fd6,#2f6fd6)"
                    : (chk?"background:var(--greenlt,#eef7f0)":"");
    return '<label style="display:grid;grid-template-columns:22px 1fr 46px;gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--line);cursor:pointer;'+_bg+'">'
      +'<input type="checkbox" '+(chk?"checked":"")+' data-name="'+esc(nm)+'" data-rating="'+(it.rating==null?"":it.rating)+'" data-krit="'+esc(it.kritisch||"nein")+'" onchange="fgPickToggle(this)" style="width:16px;height:16px;accent-color:'+(_blau?'var(--k-2f6fd6,#2f6fd6)':'var(--k-16a34a)')+'">'
      +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">'+esc(nm)+(it._frei?' <span style="color:var(--k-1e40af,#1e40af);font-size:11px;font-weight:600" title="Diese Zutat ist vom Etikett gelesen und bleibt als Pruefzeile erhalten, ist aber noch keiner Stammzutat zugeordnet. Erst nach dem Zuordnen zaehlt sie zum Produkt.">· gelesen – noch nicht zugeordnet</span>':'')+'</span>'
      +'<span style="text-align:center;font-weight:700;font-size:13px;color:'+col+'">'+rt+'</span>'
      +'</label>'; };
  var _offP=(q||typeof _fgZutOffenHtml!=="function")?"":_fgZutOffenHtml();
  var _st=wrap.scrollTop;
  wrap.innerHTML = (shown.length?shown.map(row).join(""):(_offP?'':'<div style="padding:14px;color:var(--muted);font-size:12.5px;text-align:center">'+(q?"Kein Treffer.":"Noch keine Zutat gebunden \u2013 im Suchfeld tippen oder Riki lesen lassen.")+'</div>')) + _offP + hintRow;
  try{ wrap.scrollTop=_st; }catch(e){}
  fgZutSammelLeiste();
}
/* Alle Zeilen aus #fe_zutRows, zu denen es KEINEN Stamm-Eintrag gibt - ungefiltert,
   gegen den vollstaendigen ZUTATEN_STAMM. Quelle fuer Sammelknopf und Sammellauf. */
/* ────────────────────────────────────────────────────────────────────────────
   KANDIDATEN FÜR DEN SAMMELLAUF — Work #218, 23.08.2026
   ----------------------------------------------------------------------------
   🔴 WARUM DAS UMGEBAUT WURDE. Hier stand ein Textvergleich im Browser: die Namen
   der Editorzeilen wurden kleingeschrieben gegen ZUTATEN_STAMM gehalten. Er kannte
   keine Synonyme — für "White Tiger Garnelen" hätte er angeboten, eine Zutat
   einstufen und ANLEGEN zu lassen, die der Server längst als "Garnele" führt
   (Treffer synonym, Sicherheit 0,95). Der Zähler in #181 hat nur falsch gezählt;
   dieser Knopf handelt — er hätte eine überflüssige Zutat in den Stamm gebracht.

   WAS SICH GEÄNDERT HAT UND WAS NICHT:
   · Die MENGE kommt weiter aus dem DOM. Das ist richtig: es geht um den aktuellen
     Arbeitsstand, und der Server kennt nur Gespeichertes. Eine gerade eingetippte
     Zeile muss ein Kandidat sein dürfen.
   · Die ENTSCHEIDUNG "kennt der Stamm das schon?" trifft der Browser nicht mehr.
     Sie kommt aus cb_admin_zutat_zuordnungsstatus (#191, verifiziert). Abgeglichen
     wird gegen die Schreibweisen, die der SERVER selbst mitliefert — das ist das
     Anwenden seiner Antwort, kein Nachbau seiner Regel.
   · gebunden und vorschlag_offen fliegen raus. Bei vorschlag_offen ist der richtige
     Weg, den vorhandenen Treffer zu bestätigen — nicht daneben etwas Neues anzulegen.

   ⚠ OHNE SERVERANTWORT WIRD NICHT GERATEN. Fehlt _fgZuordnung, gibt die Funktion
   null zurück statt einer Liste. Der Knopf sagt dann, dass er es nicht weiß, und
   startet nichts. Ein Sammellauf auf Verdacht legt echte Zutaten an.

   OFFEN, ausdrücklich nicht hier gelöst: sauber wäre, wenn jede Zeile beim Anlegen
   ihre Herkunft mitbekäme (aus dem Stamm gewählt / eingetippt / geladen) — dann
   bräuchte es überhaupt keinen Namensabgleich. Gemessen bauen 12 Stellen eine Zeile,
   alle über die eine Funktion fgZutRow(). Das ist ein eigener Durchgang.
   ──────────────────────────────────────────────────────────────────────────── */
/* #746 (16.09.2026): EINE Frage, EIN Ort - "kennt der Server diesen Namen?"
   Quellen, alle vom Server: Stammliste (cb_zutaten_liste), Produktstand (cb_produkt_edit_get,
   zutaten[].name), Zuordnungsstand (cb_admin_zutat_zuordnungsstatus, ausser kein_treffer)
   und die Pruefzeilen der Referenzpruefung (Ziel_ID gesetzt, Status OK oder entschieden).
   Kein Raten: ist der Name nirgends bekannt, ist er frei. */
function _fgServerKennt(k){
  k=String(k||"").trim().toLowerCase(); if(!k) return true;
  try{ if(typeof ZUTATEN_MAP!=="undefined" && ZUTATEN_MAP && ZUTATEN_MAP[k]!=null) return true; }catch(e){}
  try{
    var zt=(window._fgEdit&&Array.isArray(window._fgEdit.zutaten))?window._fgEdit.zutaten:[];
    if(zt.some(function(z){ return z && String(z.name||"").trim().toLowerCase()===k && (z.canonical_entity_id||z.zutat_id); })) return true;
  }catch(e){}
  try{
    var zu=window._fgZuordnung, pid=(window._fgEdit&&window._fgEdit.id)||"";
    if(zu && zu.produkt_id===pid && Array.isArray(zu.zeilen)){
      if(zu.zeilen.some(function(z){ return z && z.status!=="kein_treffer"
        && (String(z.zutat_text||"").trim().toLowerCase()===k || String(z.stammname||"").trim().toLowerCase()===k); })) return true;
    }
  }catch(e){}
  try{
    var pz=(((window._fgRefV2||{}).d)||{}).pruefzeilen||[];
    if(pz.some(function(p){ return p
      && (String(p.Erkannter_Name||"").trim().toLowerCase()===k || String(p.Original_Text||"").trim().toLowerCase()===k)
      && (p.Ziel_ID || String(p.Automatischer_Status||"")==="OK" || String(p.Manueller_Status||"OFFEN")!=="OFFEN"); })) return true;
  }catch(e){}
  return false;
}
if(typeof window!=="undefined"){ window._fgServerKennt=_fgServerKennt; }
function _fgFreieZutaten(){
  var zu=window._fgZuordnung;
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!zu || zu.produkt_id!==pid || !Array.isArray(zu.zeilen)) return null;   /* unbekannt, nicht leer */
  /* Alles, wozu der Server bereits etwas sagt, kommt NICHT in den Sammellauf (#746: eine Frage, ein Ort). */
  var ri=_fgRowsInfo(), out=[];
  Object.keys(ri).forEach(function(k){ if(!_fgServerKennt(k)) out.push(ri[k].name); });
  return out;
}
function fgZutSammelLeiste(){
  var el=document.getElementById("fe_zutSammelLeiste"); if(!el) return;
  if(window._fgSammel && window._fgSammel.laeuft) return;   /* Lauf nicht unter den Fuessen wegrendern */
  var frei=_fgFreieZutaten();
  /* Work #218: null heisst "der Serverstand fehlt", nicht "nichts zu tun".
     Der Knopf sagt das und startet nichts — ein Sammellauf auf Verdacht legt
     echte Zutaten im Stamm an. */
  if(frei===null){
    /* Noch unterwegs ist kein Fehler. Erst wenn der Abruf durch ist und trotzdem
       kein Stand vorliegt, ist er wirklich "nicht geladen". */
    if(window._fgZuordnungLaeuft===true){
      el.innerHTML='<div class="feSammelMeta" style="color:var(--muted)">'
        +'⏳ Zuordnungsstand wird geladen …</div>';
      return;
    }
    el.innerHTML='<div class="feSammelMeta" style="color:var(--k-b45309,#b45309)">'
      +'⚠ Zuordnungsstand nicht geladen – es ist unbekannt, welche Zutaten dem Stamm fehlen. '
      +(window._fgZuordnungFehler?(esc(String(window._fgZuordnungFehler))+' '):'')
      +'Seite neu laden; bis dahin wird nichts an Riki geschickt.</div>';
    return;
  }
  if(!frei.length){ el.innerHTML=""; return; }
  el.innerHTML='<button type="button" class="feSammelBtn" onclick="fgZutSammelStart()" title="Riki stuft jede dieser Zutaten gegen unser Regelwerk ein, zwei Waechter pruefen mit. Angelegt wird erst nach deiner Bestaetigung.">'
    +'\ud83e\udd16 '+frei.length+' Zutat'+(frei.length===1?"":"en")+' nicht im Stamm \u2013 von Riki einstufen lassen</button>';
}
function fgPickToggle(cb){
  var name=(cb.dataset.name||"").trim(); if(!name) return;
  var rating=(cb.dataset.rating===""?null:Number(cb.dataset.rating));
  var krit=cb.dataset.krit||"nein";
  var c=document.getElementById("fe_zutRows"); if(!c) return;
  var key=name.toLowerCase();
  if(cb.checked){
    var exists=[].some.call(c.querySelectorAll(".fgZutRow"),function(r){ return ((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===key; });
    if(!exists) c.insertAdjacentHTML("beforeend", fgZutRow(name, rating, krit));
  } else {
    [].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){ if(((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===key){ var inf=r.nextElementSibling; if(inf&&inf.classList&&inf.classList.contains("fgRikiInfo")) inf.remove(); r.remove(); } });
  }
  try{
    var _zeile=(cb.closest?cb.closest(".fgBestZeile"):null);
    var _ico=_zeile?_zeile.querySelector(".fgbIco"):null;
    if(_ico){
      if(cb.checked){
        _ico.textContent="◍";
        _ico.style.color="var(--k-c88616,#c88616)";
        _ico.title="erfasst · noch nicht gespeichert – erst „Speichern\" bindet die Zutat an das Produkt";
      }else{
        _ico.textContent="○";
        _ico.style.color="var(--k-2f6fd6,#2f6fd6)";
        _ico.title="entfernt · noch nicht gespeichert – erst „Speichern\" löst die Bindung";
      }
    }
  }catch(e){ console.error("fgPickToggle Statuszeichen:",e); }
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}   /* fePlaus stoesst auch feScorePreview an */
}
/* „+ hinzufügen": Steht die Zutat schon im Stamm → direkt gebunden übernehmen (grün).
   Sonst lässt Riki sie gegen unser Regelwerk BEWERTEN (mit Wächter-Verifikation) und schlägt einen
   Wert vor – erst nach Bestätigung wandert er MIT Quelle in den Stamm. Kein stiller unbewerteter
   Eintrag mehr, keine erfundene Zahl (der Wert kommt aus Rikis Einstufung + Verifikation). */
function fgPickAddNeu(){
  var inp=document.getElementById("fe_zutNeu"); if(!inp) return;
  var name=(inp.value||"").trim(); if(!name) return;
  var c=document.getElementById("fe_zutRows"); if(!c) return;
  var key=name.toLowerCase();
  var exists=[].some.call(c.querySelectorAll(".fgZutRow"),function(r){ return ((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===key; });
  var m=(typeof ZUTATEN_MAP!=="undefined"&&ZUTATEN_MAP)?ZUTATEN_MAP[key]:null;
  if(m){
    /* 28z7: Synonym-Treffer werden KANONISCH beschriftet ("Tapioka" -> Zeile "Tapiokastärke"),
       damit Referenz-Abgleich und Stamm dieselbe Sprache sprechen. */
    var zeigName=m.kanon||name; var zeigKey=zeigName.toLowerCase();
    var exists2=exists||[].some.call(c.querySelectorAll(".fgZutRow"),function(r){ return ((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===zeigKey; });
    if(!exists2) c.insertAdjacentHTML("beforeend", fgZutRow(zeigName, m.rating, m.kritisch));
    inp.value=""; var b0=document.getElementById("fe_zutNeuInfo"); if(b0) b0.innerHTML=""; fgPickRender(); try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){} return; }
  fgPickRikiPanel(name);
}
/* Riki bewertet eine noch unbekannte Zutat und zeigt Vorschlag + Verifikation. Nichts wird
   automatisch gespeichert – erst „In den Stamm übernehmen" schreibt (fgPickRikiUebernehmen). */
function fgPickRikiPanel(name){
  var box=document.getElementById("fe_zutNeuInfo"); if(!box) return;
  box.innerHTML='<div style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--k-f4f1fb,#f4f1fb);font-size:12.5px;color:var(--ink)">🤖 Riki bewertet „'+esc(name)+'" gegen unser Regelwerk…</div>';
  client.auth.getSession().then(function(s){
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok){ box.innerHTML='<div style="color:var(--k-b45309);font-size:12.5px">Bitte anmelden.</div>'; return null; }
    return fetch(client.supabaseUrl+"/functions/v1/riki-zutat-bewerten",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},body:JSON.stringify({name:name})}).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); });
  }).then(function(rr){
    if(!rr) return;
    if(!rr.ok||typeof rr.d.stufe!=="number"){ box.innerHTML='<div style="color:var(--k-b45309);font-size:12.5px">Riki konnte „'+esc(name)+'" nicht bewerten – anders schreiben oder von Hand prüfen.</div>'; return; }
    var st=rr.d.stufe, v=rr.d.verifikation||{}, ges=v.gesamt||"KEIN_SIGNAL";
    var col=ges==="BESTAETIGT"?"#1f7d43":ges==="AUSNAHME"?"#b91c1c":"#b45309";
    var lbl=ges==="BESTAETIGT"?"bestätigt":ges==="AUSNAHME"?"Widerspruch – prüfen":ges==="PRUEFEN"?"grenzwertig":"kein Prüfsignal";
    window._fgNeuVorschlag={name:name, stufe:st, ges:ges};
    box.innerHTML='<div style="padding:9px 11px;border:1px solid var(--line);border-left:3px solid '+col+';border-radius:8px;background:var(--k-f2f5f3,#f2f5f3);font-size:12.5px;line-height:1.5;color:var(--ink)">'
      +'<b>Riki: „'+esc(name)+'" → Stufe '+st+'</b>'+(rr.d.begruendung?" — "+esc(rr.d.begruendung):"")
      +'<br><span style="color:'+col+';font-weight:700">'+lbl+'</span>'
      +'<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'
        +'<button type="button" onclick="fgPickRikiUebernehmen()" style="padding:6px 11px;border:0;border-radius:8px;background:#2e9e57;color:#fff;font-weight:700;font-size:12.5px;cursor:pointer">'
        +((typeof _fgRefV2ElByName==="function"&&_fgRefV2IstUnterzutat(_fgRefV2ElByName(name)))
            ?'✓ In den Stamm übernehmen &amp; als Unterzutat bestätigen'
            :'✓ In den Stamm übernehmen &amp; am Produkt anhaken')
        +'</button>'
        +'<button type="button" onclick="var b=document.getElementById(\'fe_zutNeuInfo\');if(b)b.innerHTML=\'\'" style="padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:12.5px;cursor:pointer">Abbrechen</button>'
      +'</div>'
      +(ges!=="BESTAETIGT"?'<div style="color:var(--muted);margin-top:6px;font-size:11.5px">Kein klares „bestätigt" – bitte den Wert gegen Etikett/Regelwerk prüfen, bevor du übernimmst.</div>':'')
    +'</div>';
  }, function(){ box.innerHTML='<div style="color:var(--k-b45309);font-size:12.5px">Riki-Fehler – nochmal versuchen.</div>'; });
}
function fgPickRikiUebernehmen(){
  var vs=window._fgNeuVorschlag; if(!vs) return;
  var box=document.getElementById("fe_zutNeuInfo");
  zutStammAnlegenMitKat({p_name:vs.name,p_rating:vs.stufe,p_quelle:"Riki + Verifikation ("+(vs.ges||"")+"), Produkt-Erfassung"}).then(function(res){
    if(res.error||!(res.data&&res.data.ok)){ if(box) box.innerHTML='<div style="color:var(--k-b45309);font-size:12.5px">Konnte nicht übernehmen: '+esc((res.error&&res.error.message)||"")+'</div>'; return; }
    var rr=res.data.rating;
    if(typeof ZUTATEN_MAP!=="undefined"&&ZUTATEN_MAP){ ZUTATEN_MAP[vs.name.toLowerCase()]={rating:rr,kritisch:"nein"}; }
    if(Array.isArray(ZUTATEN_STAMM)){
      var _neu={name:vs.name,rating:rr,kritisch:"nein"};
      var _pos=ZUTATEN_STAMM.findIndex(function(z){
        return String(z&&z.name||"").localeCompare(String(vs.name||""),"de") > 0; });
      if(_pos<0) ZUTATEN_STAMM.push(_neu); else ZUTATEN_STAMM.splice(_pos,0,_neu);
    }
    var eb2El=(typeof _fgRefV2ElByName==="function")?_fgRefV2ElByName(vs.name):null;
    var istUnter=(typeof _fgRefV2IstUnterzutat==="function")&&_fgRefV2IstUnterzutat(eb2El);
    if(!istUnter){
      var c=document.getElementById("fe_zutRows"); var key=vs.name.toLowerCase();
      var exists=c&&[].some.call(c.querySelectorAll(".fgZutRow"),function(r){ return ((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===key; });
      if(c&&!exists) c.insertAdjacentHTML("beforeend", fgZutRow(vs.name, rr, "nein"));
    }
    var inp=document.getElementById("fe_zutNeu"); if(inp) inp.value="";
    if(box) box.innerHTML='<div style="color:#1f7d43;font-size:12.5px">✓ „'+esc(vs.name)+'" mit Stufe '+rr+' in den Stamm übernommen'
      +(istUnter?' – als <b>Unterzutat</b> bestätigt, keine eigene Produktbindung.':' und angehakt.')+'</div>';
    window._fgNeuVorschlag=null; fgPickRender(); try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
    /* Referenzansicht in jedem Fall nachziehen, wenn V2-Daten geladen sind (Punkt 1) */
    try{ if(window._fgRefV2&&window._fgRefV2.d&&typeof fgRefV2NachNeuanlage==="function") fgRefV2NachNeuanlage(vs.name, istUnter); }catch(e){}
  }, function(){ if(box) box.innerHTML='<div style="color:var(--k-b45309);font-size:12.5px">Fehler beim Übernehmen.</div>'; });
}
var FG_SAMMEL_MAX=25;   /* Riegel: ein Lauf ruft hoechstens 25x riki-zutat-bewerten */
function _fgSammelGrund(res){
  if(res && res.error && res.error.message) return res.error.message;
  var d=(res&&res.data)||{};
  if(d.grund) return d.grund + (Array.isArray(d.regeln)&&d.regeln.length ? (" ("+d.regeln.join("; ")+")") : "");
  if(d.status==="PRUEFEN"){
    var k=(d.kandidaten||[]).map(function(x){
      return (x.name||"?") + (x.aehnlichkeit!=null ? (" "+Math.round(Number(x.aehnlichkeit)*100)+" %") : "");
    });
    return "Dublettenverdacht – nicht angelegt."
      + (k.length ? (" Im Stamm steht schon: "+k.join(" · ")+".") : "")
      + " Bitte von Hand entscheiden: binden, umbenennen oder als eigene Zutat anlegen.";
  }
  return "abgelehnt" + (d.status ? (" (Status "+d.status+")") : "");
}
function fgZutSammelAbbruch(){
  window._fgSammel=null;
  var box=document.getElementById("fe_zutSammelBox"); if(box) box.innerHTML="";
  fgZutSammelLeiste();
}
function fgZutSammelStart(){
  var box=document.getElementById("fe_zutSammelBox"); if(!box) return;
  /* Work #218: ohne Serverstand wird nicht gestartet. Der Lauf legt Zutaten an. */
  var namen=_fgFreieZutaten(); if(namen===null || !namen.length){ fgZutSammelLeiste(); return; }
  var gekappt=0;
  if(namen.length>FG_SAMMEL_MAX){ gekappt=namen.length-FG_SAMMEL_MAX; namen=namen.slice(0,FG_SAMMEL_MAX); }
  window._fgSammel={laeuft:true, items:[], gekappt:gekappt};
  var leiste=document.getElementById("fe_zutSammelLeiste");
  if(leiste) leiste.innerHTML='<button type="button" class="feSammelBtn" disabled>🤖 Riki liest… 0 von '+namen.length+'</button>';
  box.innerHTML='<div class="feSammelKasten"><div class="feSammelKopf">Riki stuft ein…</div>'
    +'<div class="feSammelHinweis">Es wird noch nichts gespeichert.</div></div>';

  client.auth.getSession().then(function(s){
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok){ throw new Error("Nicht angemeldet – bitte neu einloggen."); }
    return zutKatListe().then(function(kats){ return {tok:tok, kats:kats||[]}; });
  }).then(function(ctx){
    var erg=[];
    /* NACHEINANDER, nicht parallel: die Edge Function hat einen Budget-Riegel, und ein
       Schwall von 25 gleichzeitigen Anfragen wuerde ihn ohne Not ausloesen (§24: Budget-
       Logik nicht anfassen - also auch nicht umgehen). */
    var kette=namen.reduce(function(p,name,i){
      return p.then(function(){
        return fetch(client.supabaseUrl+"/functions/v1/riki-zutat-bewerten",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+ctx.tok,"apikey":client.supabaseKey},
          body:JSON.stringify({name:name})
        }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
         .then(function(rr){
           if(!rr.ok||typeof rr.d.stufe!=="number"){
             erg.push({name:name, fehler:(rr.d&&(rr.d.error||rr.d.message))||"Riki konnte nicht einstufen"});
           } else {
             var v=rr.d.verifikation||{}, w=v.waechter||{};
             erg.push({name:name, stufe:rr.d.stufe, grund:rr.d.begruendung||"",
                       ges:v.gesamt||"KEIN_SIGNAL",
                       wn:(w.w_name||{}).urteil, wp:(w.w_peer||{}).urteil,
                       wtext:(w.w_peer&&w.w_peer.text)||""});
           }
         }, function(e){ erg.push({name:name, fehler:(e&&e.message)||"Netzwerkfehler"}); })
         .then(function(){
           var lb=document.getElementById("fe_zutSammelLeiste");
           if(lb) lb.innerHTML='<button type="button" class="feSammelBtn" disabled>🤖 Riki liest… '+(i+1)+' von '+namen.length+'</button>';
         });
      });
    }, Promise.resolve());
    return kette.then(function(){ return {erg:erg, kats:ctx.kats}; });
  }).then(function(res){
    window._fgSammel={laeuft:false, items:res.erg, kats:res.kats, gekappt:gekappt};
    fgZutSammelRender();
  }, function(e){
    window._fgSammel=null;
    box.innerHTML='<div class="feSammelKasten"><div class="feSammelKopf" style="color:var(--k-b45309)">Sammellauf abgebrochen</div>'
      +'<div>'+esc((e&&e.message)||"Unbekannter Fehler")+'</div>'
      +'<div class="feSammelFuss"><button type="button" class="feSammelAbb" onclick="fgZutSammelAbbruch()">Schließen</button></div></div>';
  });
}
function fgZutSammelRender(){
  var box=document.getElementById("fe_zutSammelBox"), S=window._fgSammel; if(!box||!S) return;
  var opt='<option value="">– Kategorie wählen –</option>';
  (S.kats||[]).forEach(function(k){ opt+='<option value="'+esc(k)+'">'+esc(k)+'</option>'; });
  var zeilen=S.items.map(function(it,i){
    if(it.fehler){
      return '<div class="feSammelZeile"><span></span><div><div class="feSammelName">'+esc(it.name)+'</div>'
        +'<div class="feSammelMeta" style="color:var(--k-b45309)">'+esc(it.fehler)+' – von Hand prüfen.</div></div></div>';
    }
    var col=it.ges==="BESTAETIGT"?"var(--k-16a34a)":it.ges==="AUSNAHME"?"var(--k-b91c1c)":"var(--k-b45309)";
    var lbl=it.ges==="BESTAETIGT"?"bestätigt":it.ges==="AUSNAHME"?"Widerspruch – prüfen":it.ges==="PRUEFEN"?"grenzwertig":"kein Prüfsignal";
    var vor=(it.ges==="BESTAETIGT");
    return '<div class="feSammelZeile">'
      +'<input type="checkbox" data-idx="'+i+'" '+(vor?"checked":"")+' onchange="fgZutSammelZaehl()">'
      +'<div><div class="feSammelName">'+esc(it.name)+' – Stufe '+it.stufe+'</div>'
      +'<div class="feSammelMeta"><span style="color:'+col+';font-weight:700">'+lbl+'</span>'
        +' · Name '+_wIcon(it.wn)+' · Statistik '+_wIcon(it.wp)+'</div>'
      +(it.grund?'<div class="feSammelMeta">'+esc(it.grund)+'</div>':'')
      +(it.wtext?'<div class="feSammelMeta">'+esc(it.wtext)+'</div>':'')
      +'<select class="feSammelKat" data-idx="'+i+'" onchange="fgZutSammelZaehl()">'+opt+'</select>'
      +'</div></div>';
  }).join("");
  var fehl=S.items.filter(function(x){return x.fehler;}).length;
  var schwach=S.items.filter(function(x){return !x.fehler && x.ges!=="BESTAETIGT";}).length;
  box.innerHTML='<div class="feSammelKasten">'
    +'<div class="feSammelKopf">Rikis Vorschläge – nichts ist gespeichert</div>'
    +(window._zutKatRueckfall?'<div class="feSammelHinweis" style="color:var(--k-b45309)">⚠ Kategorienliste konnte nicht geladen werden – Notfall-Liste aus dem Code. Der Server kann eine Auswahl daraus ablehnen.</div>':'')
    +'<div class="feSammelHinweis">Vorgehakt ist nur, was beide Wächter bestätigt haben'
      +(schwach?' – '+schwach+' ohne klare Bestätigung, bitte erst die Begründung lesen':'')
      +(fehl?' · '+fehl+' konnte Riki nicht einstufen':'')
      +(S.gekappt?' · '+S.gekappt+' weitere nicht geladen (Riegel bei '+FG_SAMMEL_MAX+')':'')
      +'. Ohne Kategorie wird nicht angelegt.</div>'
    +zeilen
    +'<div class="feSammelFuss">'
      +'<button type="button" class="feSammelOk" id="fe_sammelOk" onclick="fgZutSammelUebernehmen()">✓ übernehmen</button>'
      +'<button type="button" class="feSammelAbb" onclick="fgZutSammelAbbruch()">Abbrechen</button>'
    +'</div>'
    +'<div id="fe_sammelMsg" class="feSammelMeta" style="margin-top:7px"></div>'
  +'</div>';
  fgZutSammelZaehl();
}
function fgZutSammelZaehl(){
  var box=document.getElementById("fe_zutSammelBox"), ok=document.getElementById("fe_sammelOk"); if(!box||!ok) return;
  var an=0, ohneKat=0;
  box.querySelectorAll('input[type=checkbox][data-idx]').forEach(function(cb){
    if(!cb.checked) return; an++;
    var sel=box.querySelector('select.feSammelKat[data-idx="'+cb.dataset.idx+'"]');
    if(!sel||!sel.value) ohneKat++;
  });
  ok.disabled=(an===0||ohneKat>0);
  ok.textContent = an===0 ? "✓ nichts ausgewählt"
    : ohneKat>0 ? ("Kategorie fehlt bei "+ohneKat)
    : ("✓ "+an+" in den Stamm übernehmen");
}
function fgZutSammelUebernehmen(){
  var box=document.getElementById("fe_zutSammelBox"), S=window._fgSammel; if(!box||!S) return;
  var msg=document.getElementById("fe_sammelMsg"), ok=document.getElementById("fe_sammelOk");
  var wahl=[];
  box.querySelectorAll('input[type=checkbox][data-idx]').forEach(function(cb){
    if(!cb.checked) return;
    var i=Number(cb.dataset.idx), it=S.items[i]; if(!it||it.fehler) return;
    var sel=box.querySelector('select.feSammelKat[data-idx="'+i+'"]');
    var kat=(sel&&sel.value)||""; if(!kat) return;
    wahl.push({it:it, kat:kat});
  });
  if(!wahl.length) return;
  if(ok){ ok.disabled=true; ok.textContent="…"; }
  var gut=[], schlecht=[];
  wahl.reduce(function(p,w){
    return p.then(function(){
      return zutStammAnlegenMitKat({p_name:w.it.name, p_rating:w.it.stufe, p_kategorie:w.kat,
        p_quelle:"Riki + Verifikation ("+(w.it.ges||"")+"), Sammellauf Produkt-Erfassung"})
      .then(function(res){
        if(res.error||!(res.data&&res.data.ok)){
          schlecht.push(w.it.name+": "+_fgSammelGrund(res));
          return;
        }
        var rr=res.data.rating;
        var kanon=(res.data.name||w.it.name), kkey=kanon.toLowerCase();
        var warNeu=(res.data.neu!==false);
        gut.push(kanon + (kkey!==w.it.name.toLowerCase() ? (' (als „'+w.it.name+'" erkannt)') : '')
                       + (warNeu?'':' – gab es schon'));
        if(typeof ZUTATEN_MAP!=="undefined"&&ZUTATEN_MAP){
          ZUTATEN_MAP[kkey]={rating:rr,kritisch:"nein"};
          /* Schreibweise vom Etikett ebenfalls merken, damit die Pickliste sie nicht
             erneut als "nicht im Stamm" fuehrt - kanonisch bleibt der Servername. */
          if(kkey!==w.it.name.toLowerCase()) ZUTATEN_MAP[w.it.name.toLowerCase()]={rating:rr,kritisch:"nein",kanon:kanon};
        }
        if(Array.isArray(ZUTATEN_STAMM) && !ZUTATEN_STAMM.some(function(z){ return String(z&&z.name||"").trim().toLowerCase()===kkey; })){
          var neu={name:kanon, rating:rr, kritisch:"nein", kategorie:w.kat};
          var pos=ZUTATEN_STAMM.findIndex(function(z){ return String(z&&z.name||"").localeCompare(kanon,"de")>0; });
          if(pos<0) ZUTATEN_STAMM.push(neu); else ZUTATEN_STAMM.splice(pos,0,neu);
          var dl=document.getElementById("fgZutDL");
          if(dl){ var op=document.createElement("option"); op.value=kanon; dl.appendChild(op); }
        }
        var c=document.getElementById("fe_zutRows"), key=w.it.name.toLowerCase();
        if(c) [].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){
          var ni=r.querySelector(".fgzName");
          if(((ni&&ni.value)||"").trim().toLowerCase()!==key) return;
          if(ni && kkey!==key) ni.value=kanon;
          var rate=r.querySelector(".fgzRate"); if(rate){ rate.value=rr; rate.style.color="var(--ink)"; }
          var rb=r.querySelector(".fgzRiki"); if(rb) rb.style.display="none";
        });
        try{
          if(window._fgRefV2&&window._fgRefV2.d&&typeof fgRefV2NachNeuanlage==="function"){
            var el=(typeof _fgRefV2ElByName==="function")?_fgRefV2ElByName(kanon):null;
            var unter=(typeof _fgRefV2IstUnterzutat==="function")&&_fgRefV2IstUnterzutat(el);
            fgRefV2NachNeuanlage(kanon, unter);
          }
        }catch(e){ schlecht.push(kanon+": Referenzansicht nicht nachgezogen ("+((e&&e.message)||"")+")"); }
      }, function(e){ schlecht.push(w.it.name+": "+((e&&e.message)||"Fehler beim Anlegen")); });
    });
  }, Promise.resolve()).then(function(){
    window._fgSammel=null;
    /* Work #218: nach dem Lauf ist der Serverstand veraltet — die eben angelegten
       Zutaten kennt er noch nicht. Die Restzahl steht deshalb NICHT sofort da:
       sie wird nachgereicht, sobald der neue Stand geladen ist (unten im .then).
       Ein sofortiger Wert waere der Stand von vorher — also eine Zahl, die stimmt
       aussieht und falsch ist. */
    var _restId="fgSammelRest"+Date.now();
    box.innerHTML='<div class="feSammelKasten">'
      +'<div class="feSammelKopf" style="color:'+(schlecht.length?"var(--k-b45309)":"#1f7d43")+'">'
        +(gut.length?('✓ '+gut.length+' in den Stamm übernommen'):'Nichts übernommen')
        +(schlecht.length?(' · '+schlecht.length+' fehlgeschlagen'):'')+'</div>'
      +(gut.length?'<div class="feSammelMeta">'+esc(gut.join(" · "))+'</div>':'')
      +(schlecht.length?'<div class="feSammelMeta" style="color:var(--k-b45309)">'+schlecht.map(esc).join("<br>")+'</div>':'')
      +'<div class="feSammelMeta" style="margin-top:5px"><span id="'+_restId+'">Zuordnungsstand wird neu geladen …</span>'
        +' <b>Noch nicht gespeichert</b> – dafür unten auf Speichern.</div>'
      +'<div class="feSammelFuss"><button type="button" class="feSammelAbb" onclick="fgZutSammelAbbruch()">Schließen</button></div>'
    +'</div>';
    if(window._fgDirtyArmed&&window._fgDirty&&gut.length) window._fgDirty.zut=true;
    fgPickRender(); fgPickRefreshView();
    try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
    /* Work #218: erst den Serverstand neu holen, DANN die Restzahl schreiben.
       Schlaegt das fehl, steht dort, dass es unbekannt ist — nicht "alles erledigt". */
    (function(){
      var _pid=(window._fgEdit&&window._fgEdit.id)||"";
      var _setz=function(txt){ var e=document.getElementById(_restId); if(e) e.textContent=txt; };
      var _fertig=function(){
        var r=_fgFreieZutaten();
        if(r===null){ _setz("Zuordnungsstand nicht verfügbar – bitte neu laden."); return; }
        _setz(r.length ? (r.length+" Zutat"+(r.length===1?"":"en")+" weiterhin ohne Stammzuordnung.")
                       : "Alle Zutaten dieses Produkts sind dem Stamm zugeordnet.");
        try{ fgZutSammelLeiste(); }catch(e){}
        try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
      };
      if(_pid && typeof fgZuordnungLaden==="function"){
        try{ fgZuordnungLaden(_pid).then(_fertig, function(){ _setz("Zuordnungsstand nicht verfügbar – bitte neu laden."); }); }
        catch(e){ _setz("Zuordnungsstand nicht verfügbar – bitte neu laden."); }
      } else { _fertig(); }
    })();
  });
}

/* Textbox + Haekchen aus #fe_zutRows spiegeln – vom Observer aufgerufen, egal wer die Rows aendert. */
function fgPickRefreshView(){
  var names=_fgRowsNames(), set={}; names.forEach(function(n){ set[n.toLowerCase()]=true; });
  try{ fgEnthaltenRender(); }catch(e){}
  document.querySelectorAll("#fe_pickList input[type=checkbox]").forEach(function(cb){ cb.checked=!!set[(cb.dataset.name||"").trim().toLowerCase()]; });
}
function _fgWorkSet(){ var set={}; var c=document.getElementById("fe_zutRows"); if(c)[].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){ var n=((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase(); if(n) set[n]=true; }); return set; }
/* Schlüssel der aktuellen Zusatzstoff-Auswahl (E-Nummer + Name), damit die Referenz einen Stoff
   auch dann als „übernommen" erkennt, wenn er in der ZUSATZSTOFF-Liste steht (nicht bei den Zutaten). */
function _fgZusKeys(){ var k={};
  var add=function(v){ if(!v) return; k[String(v).trim().toLowerCase()]=1; try{ var n=_zusNorm(v); if(n&&n.length>=4) k["~"+n]=1; }catch(e){} };
  (window._fgZus||[]).forEach(function(z){
    if(z.e) k[String(z.e).toLowerCase()]=1;
    add(z.name);
    var st=(typeof ZUSATZSTOFFE_MAP!=="undefined"&&z.e)?ZUSATZSTOFFE_MAP[String(z.e).toLowerCase()]:null;
    if(st){ add(st.name); add(st.name_de); }
  });
  return k; }
function _fgZusUnklarKeys(){ var k={};
  var add=function(v){ if(!v) return; k[String(v).trim().toLowerCase()]=1; try{ var n=_zusNorm(v); if(n&&n.length>=4) k["~"+n]=1; }catch(e){} };
  (window._fgZus||[]).forEach(function(z){
    var e=String(z.einst||z.einstufung||"").toLowerCase();
    var unklar = z.nf || !e || e==="ungeprüft" || e==="ungeprueft";
    if(!unklar) return;
    if(z.e) k[String(z.e).toLowerCase()]=1;
    add(z.name);
    var st=(typeof ZUSATZSTOFFE_MAP!=="undefined"&&z.e)?ZUSATZSTOFFE_MAP[String(z.e).toLowerCase()]:null;
    if(st){ add(st.name); add(st.name_de); }
  });
  return k; }
function _fgRefStatus(raw, work, zk){
  var low=String(raw||"").trim().toLowerCase();
  var _np=low.replace(/\([^)]*\)/g,"").replace(/\s+/g," ").trim();
  /* fuehrendes Funktionswort abstreifen: „Trennmittel Natriumferrocyanid" ist der Stoff dahinter
     (das Funktionswort allein faengt schon _zusIstLeer ab). */
  var _ohne=_zusOhneFunktionswort(raw)||_np;
  var em=String(raw||"").match(/\bE\s?\d{3,4}[a-z]?\b/i);
  var eNr=em?em[0].replace(/\s/g,"").toLowerCase()
          :((typeof ZUS_SYN!=="undefined"&&(ZUS_SYN[low]||ZUS_SYN[_np]||ZUS_SYN[_ohne]))?String(ZUS_SYN[low]||ZUS_SYN[_np]||ZUS_SYN[_ohne]).toLowerCase():null);
  /* letzte Instanz: ueber die Schreibweise eindeutig im Stamm aufloesen (nie raten – §1.11n-e) */
  if(!eNr){ try{ var st=_zusFindStamm(_ohne)||_zusFindStamm(_np); if(st&&st.e) eNr=String(st.e).toLowerCase(); }catch(e){} }
  var isZus=(typeof ZUSATZSTOFFE_MAP!=="undefined") && !!((eNr&&ZUSATZSTOFFE_MAP[eNr])||ZUSATZSTOFFE_MAP[low]||ZUSATZSTOFFE_MAP[_np]||ZUSATZSTOFFE_MAP[_ohne]);
  /* 28z7: Referenz "Tapioka" trifft die kanonisch beschriftete Zeile "Tapiokastärke" über das
     kuratierte Synonym-Verzeichnis (nur belegte Gleichsetzungen, kein Raten). */
  var kan=null; try{ var zsyn=(typeof ZUTATEN_MAP!=="undefined")?(ZUTATEN_MAP[low]||ZUTATEN_MAP[_np]||ZUTATEN_MAP[_ohne]):null; if(zsyn&&zsyn.kanon) kan=String(zsyn.kanon).trim().toLowerCase(); }catch(e){}
  var inList=!!(work&&(work[low]||work[_np]||work[_ohne]||(kan&&work[kan]))), asZusatz=false;
  if(!inList && zk){
    var nk=null; try{ var n=_zusNorm(_ohne); if(n&&n.length>=4) nk="~"+n; }catch(e){}
    if((eNr&&zk[eNr])||zk[low]||zk[_np]||zk[_ohne]||(nk&&zk[nk])){ inList=true; asZusatz=true; }
  }
  var unklar=false;
  if(inList && asZusatz){
    var uk=_fgZusUnklarKeys(), nk2=null; try{ var n2=_zusNorm(_ohne); if(n2&&n2.length>=4) nk2="~"+n2; }catch(e){}
    unklar = !!((eNr&&uk[eNr])||uk[low]||uk[_np]||uk[_ohne]||(nk2&&uk[nk2]));
  }
  return {inList:inList, asZusatz:asZusatz, isZus:isZus, eNr:eNr, unklar:unklar};
}
function feEinheitPrefill(d){
  var sel=document.getElementById("fe_mengenEinheit"); if(!sel) return;
  var e=(d&&(d.mengen_einheit||d.Mengen_Einheit))||"";
  sel.value=(String(e).toLowerCase()==="ml")?"ml":(String(e).toLowerCase()==="g"?"g":"");
  window._fgEinheitQuelle=(d&&(d.mengen_einheit_quelle||d.Mengen_Einheit_Quelle))||"";
  feEinheitHint();
}
function feEinheitHint(){
  var h=document.getElementById("fe_ehHint"); if(!h) return;
  var q=String(window._fgEinheitQuelle||"");
  var sel=document.getElementById("fe_mengenEinheit");
  if(!sel || !sel.value){ h.textContent=""; h.style.color="var(--muted)"; return; }
  if(/^Annahme/i.test(q)){ h.textContent="\u26a0 "+q+" \u2013 bitte am Etikett pr\u00fcfen"; h.style.color="var(--k-b45309,#b45309)"; }
  else if(q){ h.textContent="\u2713 "+q; h.style.color="var(--k-16a34a)"; }
  else { h.textContent=""; }
}
/* Von Hand geaendert = jemand hat nachgesehen. Die Quelle wird dann zu "Etikett". */
function feEinheitChange(){ window._fgEinheitQuelle="Etikett"; feEinheitHint(); }

function feBioPrefill(d){
  var sel=document.getElementById("fe_bio"); if(!sel) return;
  var b=(d&&(d.bio!==undefined?d.bio:d.Bio));
  sel.value=(b===true)?"ja":((b===false)?"nein":"");
  window._fgBioQuelle=(d&&(d.bio_quelle||d.Bio_Quelle))||"";
  window._fgBioQuelleOriginal=window._fgBioQuelle;
  feBioHint();
  try{
    window._fgEdit = window._fgEdit || {};
    var _efManuell = (d && String(d.ernaehrungsform_herkunft||"automatik")==="manuell");
    window._fgEdit.ernaehrAuto = _efManuell ? "" : ((d&&d.ernaehrungsform)||"");
    window._fgEdit.ernaehrWahl = _efManuell ? ((d&&d.ernaehrungsform)||"") : "";
    feErnaehrRender();
  }catch(e){ console.error("Ernährungsform-Chips konnten nicht gezeichnet werden:", e); }
}
function fePill(o){
  var an=!!o.an, aus=!!o.aus;
  var st = an ? ("background:"+o.bg+";color:"+o.fg+";border:1.5px solid "+o.fg)
              : ("background:var(--card);color:var(--muted);border:1px solid var(--line)");
  return '<button type="button"'+(aus?' disabled':'')
    + (o.klick&&!aus ? (' onclick="'+o.klick+'"') : '')
    + ' title="'+esc(o.titel||"")+'"'
    + ' style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;'
    + 'padding:4px 11px;border-radius:999px;cursor:'+(aus?'not-allowed':'pointer')+';'
    + (aus?'opacity:.45;':'') + st + '">'
    + '<span aria-hidden="true">'+o.ico+'</span>'+esc(o.kurz)+'</button>';
}
/* Ein Chip, der nur ANZEIGT: die Quelle einer Angabe oder einen abgeleiteten
   Zustand. Bewusst KEIN <button> - er ist nicht klickbar und darf auch per
   Tastatur nicht angesteuert werden, sonst sieht eine Feststellung aus wie
   eine Wahlmoeglichkeit. */
function feInfoPill(ico,text,titel,bg,fg,strich){
  return '<span title="'+esc(titel||"")+'" style="display:inline-flex;align-items:center;gap:4px;'
    + 'font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;background:'+bg+';color:'+fg
    + ';border:'+(strich?'1px dashed ':'1.5px solid ')+fg+'">'
    + '<span aria-hidden="true">'+ico+'</span>'+esc(text)+'</span>';
}
/* Der senkrechte Strich zwischen Wahl und Anzeige - wortgleich aus
   feErnaehrRender (Z. 14847). */
function feTrenner(){
  return '<span style="display:inline-block;width:1px;height:19px;background:var(--line);margin:0 3px;vertical-align:middle"></span>';
}
var FE_BIO_STUFEN=[
  {v:"",     ico:"?",  kurz:"ungeprüft", bg:"var(--k-eef2f6)", fg:"var(--k-475569)",
   titel:"Noch nicht angesehen. Das ist NICHT dasselbe wie „kein Bio“."},
  {v:"ja",   ico:"🌱", kurz:"Bio",       bg:"var(--k-e7f4ec)", fg:"var(--k-1f5e34)",
   titel:"Trägt eine Bio-Kennzeichnung nach EU-Öko-VO 2018/848. Gibt keine Punkte im Index."},
  {v:"nein", ico:"✗",  kurz:"kein Bio",  bg:"var(--k-eef2f6)", fg:"var(--k-475569)",
   titel:"Geprüft: trägt keine Bio-Kennzeichnung."}
];
function feBioSwRender(){
  var box=document.getElementById("fe_bioSw");
  if(!box){ console.warn("fe_bioSw nicht im DOM – Bio-Chips werden nicht gezeichnet."); return; }
  var sel=document.getElementById("fe_bio"); var akt=sel?String(sel.value||""):"";
  var h=FE_BIO_STUFEN.map(function(s){
    return fePill({an:(s.v===akt), ico:s.ico, kurz:s.kurz, bg:s.bg, fg:s.fg,
      titel:s.titel, klick:"feBioSw('"+s.v+"')"});
  }).join("");
  var q=String(window._fgBioQuelle||"");
  if(akt && q){
    h += feTrenner();
    h += /^Annahme/i.test(q)
      ? feInfoPill("⚠", q, "Aus dem Produktnamen abgeleitet, noch nicht am Etikett geprüft.", "var(--k-fff7e6)", "var(--k-b45309)", true)
      : feInfoPill("📷", q, "Belegt über: "+q+". Bio ist Merkmal und Filter – es gibt keine Punkte im Index.", "var(--k-eef2f6)", "var(--k-475569)", false);
  }
  box.innerHTML=h;
}
/* Bio-Status und Bio-Quelle gemeinsam laden; ein Statuswechsel darf den Beleg nicht ersetzen. */
function feBioQuelleBeiHand(v){
  if(!v) return "";                                    /* ungeprueft = keine Quelle */
  return String(window._fgBioQuelle||"")               /* noch gesetzt? gewinnt */
      || String(window._fgBioQuelleOriginal||"")       /* sonst die geladene */
      || "Etikett";                                    /* nie eine dagewesen */
}
if(typeof window!=="undefined"){ window.feBioQuelleBeiHand=feBioQuelleBeiHand; }
/* Klick = jemand hat entschieden. Die QUELLE bleibt dabei, was sie war (siehe oben);
   zurueck auf ungeprueft loescht auch die Quelle. */
function feBioSw(v){
  var sel=document.getElementById("fe_bio"); if(!sel) return;
  sel.value=v;
  window._fgBioQuelle=feBioQuelleBeiHand(v);
  feBioSwRender(); feBioHint();
}
function feBioHint(){
  try{ feBioSwRender(); }catch(e){}
  var h=document.getElementById("fe_bioHint"); if(!h) return;
  var sel=document.getElementById("fe_bio"); if(!sel){ h.textContent=""; return; }
  var q=String(window._fgBioQuelle||"");
  if(!sel.value){ h.textContent="Leer = nicht geprüft (nicht „kein Bio“). Bio gibt keine Punkte im Index."; h.style.color="var(--muted)"; return; }
  if(/^Annahme/i.test(q)){ h.textContent="⚠ "+q+" – bitte am Etikett prüfen. Bio gibt keine Punkte."; h.style.color="var(--k-b45309,#b45309)"; }
  else if(q){ h.textContent="✓ "+q+" · Merkmal und Filter, keine Punkte im Index."; h.style.color="var(--k-16a34a)"; }
  else { h.textContent="Merkmal und Filter, keine Punkte im Index."; h.style.color="var(--muted)"; }
}
function feBioChange(){
  var sel=document.getElementById("fe_bio");
  window._fgBioQuelle=feBioQuelleBeiHand(sel && sel.value);    
  feBioHint();
}

var FE_EF_STUFEN=[
  {v:"vegan",                ico:"🌱", kurz:"vegan",       bg:"var(--k-e7f4ec)", fg:"var(--k-1f5e34)"},
  {v:"vegetarisch",          ico:"🥚", kurz:"vegetarisch", bg:"var(--k-eef6e9)", fg:"var(--k-4d7c0f)"},
  {v:"enthält Tierprodukte", ico:"🥩", kurz:"tierisch",    bg:"var(--k-f3eee6)", fg:"var(--k-7c5e3a)"}
];
function feErnaehrRender(){
  var box=document.getElementById("fe_ernaehrChips");
  if(!box){ console.warn("fe_ernaehrChips nicht im DOM – Chips werden nicht gezeichnet. Läuft feBioPrefill vor dem Einfügen der Maske?"); return; }
  var akt=String((window._fgEdit&&window._fgEdit.ernaehrWahl)||"");
  var auto=String((window._fgEdit&&window._fgEdit.ernaehrAuto)||"");
  var h=FE_EF_STUFEN.map(function(s){
    var an=(s.v===akt);
    var st=an?("background:"+s.bg+";color:"+s.fg+";border:1.5px solid "+s.fg)
             :("background:var(--card);color:var(--muted);border:1px solid var(--line)");
    return '<button type="button" onclick="feErnaehrWahl(\''+s.v.replace(/'/g,"\\'")+'\')"'
      + ' title="'+esc(s.v)+' – von Hand setzen. Überschreibt die Automatik dauerhaft."'
      + ' style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;'
      + 'padding:4px 11px;border-radius:999px;cursor:pointer;'+st+'">'
      + '<span aria-hidden="true">'+s.ico+'</span>'+esc(s.kurz)+'</button>';
  }).join('');
  var manuell=(akt!=="");
  h += '<span style="display:inline-block;width:1px;height:19px;background:var(--line);margin:0 3px;vertical-align:middle"></span>';
  h += '<button type="button" onclick="feErnaehrWahl(\'\')"'
     + ' title="Zurück an die Automatik. Sie rechnet aus den gebundenen Zutaten und schreibt den Wert sofort neu – es bleibt kein leeres Feld stehen."'
     + ' style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;cursor:pointer;'
     + (manuell?'background:var(--card);color:var(--muted);border:1px dashed var(--line)'
               :'background:var(--k-eef2f6);color:var(--k-475569);border:1.5px solid var(--k-475569)')+'">'
     + '<span aria-hidden="true">⚙</span>Automatik'+(auto?(' · '+esc(FE_EF_KURZ(auto))):'')+'</button>';
  if(manuell) h += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;background:var(--k-eef2f6);color:var(--k-475569);border:1.5px solid var(--k-475569)"><span aria-hidden="true">✋</span>von dir</span>';
  box.innerHTML=h;
  feErnaehrHint();
}
function FE_EF_KURZ(v){ for(var i=0;i<FE_EF_STUFEN.length;i++) if(FE_EF_STUFEN[i].v===v) return FE_EF_STUFEN[i].kurz; return v; }
function feErnaehrWahl(v){
  window._fgEdit=window._fgEdit||{}; window._fgEdit.ernaehrWahl=String(v||"");
  feErnaehrRender();
}
function feErnaehrHint(){
  var h=document.getElementById("fe_ernaehrHint"); if(!h) return;
  var akt=String((window._fgEdit&&window._fgEdit.ernaehrWahl)||"");
  var auto=(window._fgEdit&&window._fgEdit.ernaehrAuto)||"";
  if(akt===""){
    h.innerHTML = auto
      ? ("Aus den <b>gebundenen</b> Zutaten gerechnet. Steht eine tierische Zutat nicht im Stamm, "
        +"wird sie nicht gebunden und fehlt in dieser Rechnung.")
      : "Wird aus den gebundenen Zutaten berechnet, sobald welche gebunden sind.";
  }else{
    h.innerHTML = "<b>Von dir gesetzt</b> – überschreibt die Automatik dauerhaft"
      + (auto?(", die hier <b>"+esc(FE_EF_KURZ(auto))+"</b> rechnet"):"")
      + ". Klick auf <b>⚙ Automatik</b> widerruft.";
  }
}
if(typeof window!=="undefined"){ window.feBioPrefill=feBioPrefill; window.feBioHint=feBioHint; window.feBioChange=feBioChange; window.feBioSw=feBioSw; window.feBioSwRender=feBioSwRender; }
/* Riki-Vorbelegung: liest Riki eine Naehrwert-Basis vom Etikett/der Herstellerseite,
   wird die Auswahl vorbelegt - aber NUR wenn noch nichts gesetzt ist. Ein bereits vom
   Menschen gesetzter Wert wird nie ueberschrieben. */
function feEinheitAusRiki(obj){
  var sel=document.getElementById("fe_mengenEinheit"); if(!sel) return;
  if(sel.value) return;                     /* nichts ueberschreiben */
  if(!obj) return;
  var vs=obj.vorschlag||{};
  var t=[obj.bezug, vs.bezug, obj.basis, obj.naehrwerte_basis, obj.einheit, obj.pro, obj.grundlage]
          .filter(Boolean).join(" ").toLowerCase();
  if(!t) return;
  /* "pro 100 g/ml" ist der PLATZHALTER-Text und sagt ausdruecklich NICHTS - er darf nichts
     vorbelegen. In der DB-Migration war er ausgeschlossen, hier hatte ich ihn zuerst uebersehen;
     der eigene Test hat es gefunden. Wieder derselbe Fall an zwei Orten (§1.11n-h). */
  if(/\bg\s*\/\s*ml\b|\bml\s*\/\s*g\b|100\s*g\s*\/\s*100\s*ml/.test(t)) return;
  var istMl=/100\s*ml|je\s*ml|pro\s*ml|\bml\b/.test(t);
  var istG =/100\s*g\b|je\s*g\b|pro\s*g\b/.test(t) && !/ml/.test(t);
  if(istMl){ sel.value="ml"; window._fgEinheitQuelle="Riki (Etikett/Herstellerseite)"; }
  else if(istG){ sel.value="g"; window._fgEinheitQuelle="Riki (Etikett/Herstellerseite)"; }
  else return;
  feEinheitHint();
}
if(typeof window!=="undefined"){ window.feEinheitChange=feEinheitChange; window.feEinheitPrefill=feEinheitPrefill; window.feEinheitAusRiki=feEinheitAusRiki; }

function feBioAusRiki(obj, quelle){
  var sel=document.getElementById("fe_bio"); if(!sel) return;
  if(sel.value) return;                     /* nichts ueberschreiben */
  if(!obj) return;
  var vs=obj.vorschlag||{};
  var b=(obj.bio!==undefined&&obj.bio!==null)?obj.bio:vs.bio;
  if(b===true){ sel.value="ja"; }
  else if(b===false){ sel.value="nein"; }
  else { return; }                          /* null/undefined = nicht geprueft, nichts eintragen */
  window._fgBioQuelle=(quelle==="Herstellerseite")?"Herstellerseite":"Etikett";
  try{ feBioHint(); }catch(e){}
}
if(typeof window!=="undefined"){ window.feBioAusRiki=feBioAusRiki; }
function fgRefFokus(el){
  if(!el) return;
  var raw=String(el.getAttribute('data-name')||'').trim(); if(!raw) return;
  var such=raw.replace(/\bE\s?\d{3,4}[a-z]?\b/ig,'').replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
  try{ var o=_zusOhneFunktionswort(raw); if(o && o.length>=3) such=o; }catch(e){}
  if(!such) such=raw;
  var istZus=false;
  try{ istZus=!!_fgRefStatus(raw, _fgWorkSet(), _fgZusKeys()).isZus; }catch(e){}
  if(istZus){
    try{ if(typeof zusModalOpen==='function') zusModalOpen(); }catch(e){}
    var zs=document.getElementById('fe_zusSuche');
    if(zs){ zs.value=such; try{ zusRenderPick(); }catch(e){} try{ zs.focus(); }catch(e){} }
    return;
  }
  var el2=document.getElementById('fe_zutSuche');
  if(el2){ el2.value=such; try{ fgPickRender(); }catch(e){}
    try{ el2.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
    try{ el2.focus(); }catch(e){} }
}
if(typeof window!=='undefined'){ window.fgRefFokus=fgRefFokus; }

function fgRefV2An(){ try{ return localStorage.getItem("ri_referenz_v2")!=="aus"; }catch(e){ return true; } }
function fgRefV2Set(an){
  try{ localStorage.setItem("ri_referenz_v2", an?"an":"aus"); }catch(e){}
  fgRefV2Anzeigen();
  if(an) fgRefV2Laden();
}
function fgRefV2Umschalten(){ fgRefV2Set(!fgRefV2An()); }
function fgRefV2Anzeigen(){
  var an=fgRefV2An();
  var alt=document.getElementById("fe_refFront"), neu=document.getElementById("fe_refV2");
  var btn=document.getElementById("fe_refV2Btn");
  if(alt) alt.style.display = an?"none":"";
  if(neu) neu.style.display = an?"":"none";
  if(btn) btn.textContent = an?"⇦ Klassisch":"Referenz V2 ⇨";
  var fl=document.getElementById("fe_refFlipBtn");
  if(fl) fl.style.display = an?"none":"";
  /* Spaltenbreiten haengen am V2-Zustand (P4) - nach jedem Umschalten neu setzen.
     Rueckweg mitgedacht (§1.11n-nn): Klassisch stellt die Normalbreiten wieder her. */
  try{ feGridHoeheSync(); }catch(e){}
}
function fgRefV2Init(){
  var btn=document.getElementById("fe_refV2Btn");
  var adm=(typeof ME!=="undefined" && ME && ME.is_admin);
  if(btn) btn.style.display = adm?"":"none";
  if(!adm){ try{ localStorage.setItem("ri_referenz_v2","aus"); }catch(e){} }
  fgRefV2Anzeigen();
  if(adm && fgRefV2An()) fgRefV2Laden();
}
function fgRefV2Kopieren(){
  var t=(window._fgRefV2 && window._fgRefV2.rohtext) || "";
  if(!t) return;
  try{ navigator.clipboard.writeText(t); toast && toast("Originaltext kopiert"); }
  catch(e){ try{ var ta=document.getElementById("fe_refV2Roh"); if(ta){ ta.select(); document.execCommand("copy"); } }catch(_){} }
}
function fgRefV2RohGross(){
  var ta=document.getElementById("fe_refV2Roh"), b=document.getElementById("fe_refV2RohBtn");
  if(!ta) return;
  if(ta.dataset.gross==="1"){
    ta.style.height="150px"; ta.dataset.gross="0"; if(b) b.textContent="Ganz anzeigen";
  }else{
    ta.style.height=Math.max(150, ta.scrollHeight+10)+"px"; ta.dataset.gross="1"; if(b) b.textContent="Einklappen";
  }
}
function _fgRefV2Ctx(){
  var w=window._fgRefV2||{}, d=w.d||{};
  return {pid:d.produkt_id||((window._fgEdit||{}).id)||"", hash:d.originaltext_hash||"", d:d, st:w.st};
}
function _fgRefV2El(elId){ var d=(window._fgRefV2||{}).d||{}; return (d.elemente||[]).find(function(x){ return x&&x.id===elId; })||null; }
function _fgRefV2Pz(elId){ var d=(window._fgRefV2||{}).d||{}; return (d.pruefzeilen||[]).find(function(p){ return p&&p.Parser_Element_ID===elId; })||null; }
async function _fgRefV2Rpc(name, args, erfolgTxt){
  try{
    var r=await client.rpc(name, args);
    if(r&&r.error) throw r.error;
    var a=r&&r.data; if(typeof a==="string"){ try{ a=JSON.parse(a); }catch(e){} }
    if(!a || a.ok!==true){
      var gr=[String((a&&(a.fehler||a.grund))||"Keine Antwort vom Server.")];
      if(a&&Array.isArray(a.gruende)) gr=gr.concat(a.gruende.map(String));
      fgRefV2Ergebnis("Vom Server abgelehnt", gr, false);
      return null;
    }
    if(erfolgTxt){ try{ toast&&toast(erfolgTxt); }catch(e){} }
    return a;
  }catch(e){
    console.error("[Referenz V2] "+name, e);
    fgRefV2Ergebnis("Fehler bei "+name, [String((e&&e.message)||e)], false);
    return null;
  }
}
/* Schwebende Ergebnis-Meldung: zeigt ALLE Serverzeilen, schliesst nur per Klick. */
function fgRefV2Ergebnis(titel, zeilen, ok){
  fgRefV2MenuZu();
  var alt=document.getElementById("fgRefV2Ergebnis"); if(alt) alt.remove();
  var b=document.createElement("div"); b.id="fgRefV2Ergebnis";
  b.style.cssText="position:fixed;top:76px;left:50%;transform:translateX(-50%);z-index:96;background:#fff;color:#1d2733;border:2px solid "+(ok?"#16a34a":"#dc2626")+";border-radius:12px;box-shadow:0 18px 50px rgba(20,40,70,.3);padding:12px 14px;max-width:560px;width:calc(100vw - 40px);font-size:12.5px;line-height:1.55;max-height:60vh;overflow:auto";
  b.innerHTML='<b style="color:'+(ok?"#166534":"#dc2626")+'">'+esc(titel)+'</b>'
    +'<div style="margin-top:6px">'+(zeilen||[]).map(function(z){ return '<div>• '+esc(String(z))+'</div>'; }).join('')+'</div>'
    +'<button type="button" onclick="document.getElementById(\'fgRefV2Ergebnis\').remove()" style="margin-top:8px;padding:5px 14px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);cursor:pointer;font-size:12px">OK</button>';
  document.body.appendChild(b);
}
async function fgRefV2Erheben(){
  var c=_fgRefV2Ctx(); if(!c.pid) return;
  var a=await _fgRefV2Rpc("cb_referenz_pruefung_erheben_admin",{p_produkt_id:c.pid},"Prüfzeilen erhoben");
  if(a) fgRefV2Laden();
}
async function fgRefV2Aktion(refId, status, entscheidung, kommentar, zielTabelle, zielId){
  var c=_fgRefV2Ctx(); if(!c.pid||!refId) return;
  var args={p_referenz_id:refId, p_produkt_id:c.pid, p_originaltext_hash:c.hash,
            p_status:status, p_entscheidung:entscheidung||null, p_kommentar:kommentar||null};
  if(zielId){ args.p_ziel_tabelle=zielTabelle||"Zutaten_Stamm"; args.p_ziel_id=zielId; }
  var a=await _fgRefV2Rpc("cb_referenz_pruefung_entscheiden_admin", args, "Gespeichert: "+status);
  if(a){
    if(String(status)==="BESTAETIGT"){
      try{
        var _b=await client.rpc("cb_referenz_bestaetigt_binden",{p_produkt_id:c.pid});
        if(_b&&_b.error) throw _b.error;
        var _bd=_b&&_b.data; if(typeof _bd==="string"){ try{ _bd=JSON.parse(_bd); }catch(e){} }
        if(_bd&&_bd.neu_gebunden>0){
          try{ toast&&toast(_bd.neu_gebunden+" Zutat(en) gebunden ("+_bd.vorher+" → "+_bd.nachher+")"); }catch(e){}
        }
      }catch(e){
        fgRefV2Ergebnis("Bestätigt, aber nicht gebunden",
          [String((e&&e.message)||e),
           "Die Bestätigung selbst ist gespeichert. Die Zutatenliste links ist unverändert."], false);
      }
    }
    fgRefV2MenuZu(); fgRefV2Laden();
  }
}
async function fgRefV2Widerruf(refId){
  var c=_fgRefV2Ctx(); if(!c.pid||!refId) return;
  var a=await _fgRefV2Rpc("cb_referenz_pruefung_widerrufen",
    {p_referenz_id:refId, p_produkt_id:c.pid, p_grund:"Vom Admin widerrufen (Referenzansicht V2)"},
    "Entscheidung widerrufen");
  if(a){ fgRefV2MenuZu(); fgRefV2Laden(); }
}
async function fgRefV2Abschliessen(){
  var c=_fgRefV2Ctx(); if(!c.pid) return;
  var a=await _fgRefV2Rpc("cb_produkt_freigabebereit_setzen",{p_produkt_id:c.pid},null);
  if(a){
    fgRefV2Ergebnis("Prüfung abgeschlossen", [String(a.hinweis||a.meldung||("Freigabe-Status: "+(a.freigabe_status||"FREIGABEBEREIT")))], true);
    fgRefV2Laden();
  }
}
function fgRefV2Schnell(elId){
  var e=_fgRefV2El(elId), pz=_fgRefV2Pz(elId); if(!e||!pz) return;
  var st=String(e.status||"");
  if(st==="MEHRDEUTIG"||st==="FRAGMENT"||st==="KLAMMER_FEHLER"||st==="FALSCH_ZERLEGT"||st==="HERSTELLERANGABE_UNVOLLSTAENDIG") return;
  var ent="BESTAETIGT wie erkannt: "+String(e.typ||"zutat")
    +(e.stammname?(" → Stamm: "+e.stammname):"")+(e.zutat_id?(" ["+e.zutat_id+"]"):"");
  /* Ist die automatische Zuordnung eine Stammzutat, geht sie auch STRUKTURIERT mit. */
  fgRefV2Aktion(pz.Referenz_ID, "BESTAETIGT", ent, null,
    e.zutat_id?"Zutaten_Stamm":null, e.zutat_id||null);
}
function fgRefV2KandWahl(elId, i){
  var e=_fgRefV2El(elId), pz=_fgRefV2Pz(elId); if(!e||!pz) return;
  var kd=(e.kandidaten||[])[i]; if(!kd) return;
  fgRefV2Aktion(pz.Referenz_ID, "BESTAETIGT",
    "KANDIDAT="+String(kd.zutat)+" ("+String(kd.art)+", "+String(kd.aehnlichkeit).slice(0,4)+")", null,
    "Zutaten_Stamm", kd.zutat_id||null);
}
/* 🔴 Work #224, 23.08.2026 — fgRefV2Typ, fgRefV2Beziehung und fgRefV2ParentWahl
   sind ERSATZLOS ENTFERNT. Sie schrieben Freitextvermerke (TYP=, BEZIEHUNG=,
   PARENT=) in Manuelle_Entscheidung, die serverseitig nie gelesen wurden —
   gemessen ueber alle Funktionsrümpfe in public und shadow_v1: null Treffer.
   Auch benutzt hat sie nie jemand: 0 von 1.771 manuellen Entscheidungen tragen
   einen solchen Vermerk. Details und Zahlen im Kommentar bei fgRefV2Menu. */
function fgRefV2Ablehnen(elId){
  var pz=_fgRefV2Pz(elId); if(!pz) return;
  fgRefV2Aktion(pz.Referenz_ID, "ABGELEHNT", "ABGELEHNT: falsch erkannt oder falsch zerlegt", null);
}
/* 🔴 10.09.2026, RALPH: "ignorieren ist doch der falsche Text, oder? … aber
   ablehnen und ist dann doch nicht weg ist auch doof."
   Er hat beide Male recht. Im Menue standen zwei Punkte, die dasselbe zu
   versprechen schienen, aber nur einer raeumt die Zeile weg:
     ABGELEHNT  - Signal "falsch erkannt", hebt die Sperre NICHT auf (gemessen:
                  cb_v2_manuell_uebersteuert kennt nur BESTAETIGT und IGNORIERT)
     IGNORIERT  - hebt die Sperre auf
   Statt zwei Woerter zu erklaeren, gibt es jetzt EINE Aktion mit dem Wort, das
   der Sache entspricht: entfernen. Sie schreibt IGNORIERT - der Datenweg bleibt
   also unveraendert, nur die Begruendung sagt jetzt, WARUM entfernt wurde. */
function fgRefV2Entfernen(elId){
  var pz=_fgRefV2Pz(elId); if(!pz) return;
  fgRefV2Aktion(pz.Referenz_ID, "IGNORIERT",
    "ENTFERNT: keine Zutat (Werbetext, Hinweis oder falsch zerlegt)", null);
}
if(typeof window!=="undefined"){ window.fgRefV2Entfernen=fgRefV2Entfernen; }
function fgRefV2Ignorieren(elId){
  var pz=_fgRefV2Pz(elId); if(!pz) return;
  fgRefV2Aktion(pz.Referenz_ID, "IGNORIERT", "IGNORIERT: bewusst übergangen", null);
}
function fgRefV2MenuZu(){ var m=document.getElementById("fgRefV2Menu"); if(m) m.remove(); }
function _fgRefV2ElByName(name){
  var d=(window._fgRefV2||{}).d; if(!d||!Array.isArray(d.elemente)) return null;
  var k=String(name||"").trim().toLowerCase(); if(!k) return null;
  return d.elemente.find(function(e){
    return e && (String(e.name||"").trim().toLowerCase()===k
              || String(e.original_text||"").trim().toLowerCase()===k);
  })||null;
}
function _fgRefV2IstUnterzutat(e){ return !!e && (Number(e.ebene)===2 || e.beziehung==="quelle"); }
async function fgRefV2NachNeuanlage(name, alsUnterzutat){
  var c=_fgRefV2Ctx(); if(!c.pid) return;
  try{
    if(c.d && c.d.pruefzeilen_vorhanden){
      await client.rpc("cb_referenz_pruefung_erheben_admin",{p_produkt_id:c.pid});
    }
    await fgRefV2Laden();
    if(!alsUnterzutat) return;
    var e=_fgRefV2ElByName(name); if(!e||!_fgRefV2IstUnterzutat(e)) return;
    var pz=_fgRefV2Pz(e.id); if(!pz) return;
    if(String(pz.Manueller_Status||"OFFEN")!=="OFFEN") return;   /* bestehende Entscheidung nie ueberschreiben */
    if(!e.zutat_id) return;
    await fgRefV2Aktion(pz.Referenz_ID, "BESTAETIGT",
      "STAMM-NEUANLAGE bestätigt als Unterzutat: "+String(e.stammname||name)+" ["+e.zutat_id+"]",
      null, "Zutaten_Stamm", e.zutat_id);
  }catch(err){ console.error("[Referenz V2] Nach Neuanlage", err); }
}
/* Untermenue-Ersatz (kompakt, ein Menue): Parent-Auswahl ersetzt den Menueinhalt. */
/* fgRefV2ParentListe entfernt — Work #224, siehe Kommentar oben. */
function fgRefV2KommentarFeld(elId){
  var m=document.getElementById("fgRefV2Menu"); if(!m) return;
  var pz=_fgRefV2Pz(elId); if(!pz) return;
  m.innerHTML='<div style="padding:2px 4px 6px"><b>Kommentar zu „'+esc((_fgRefV2El(elId)||{}).name||"")+'“</b></div>'
    +'<textarea id="fgRefV2KomTxt" style="width:100%;box-sizing:border-box;height:74px;padding:6px;border:1px solid #d3dbe6;border-radius:8px;font-size:12.5px;background:#fff;color:#1d2733">'+esc(pz.Kommentar||"")+'</textarea>'
    +'<div style="display:flex;gap:6px;margin-top:6px">'
    +'<button type="button" onclick="fgRefV2KommentarSenden('+elId+')" style="flex:1;padding:6px;border:1px solid #bfe3cb;border-radius:8px;background:#e7f6ec;color:#1f7d43;cursor:pointer;font-size:12px;font-weight:700">Speichern</button>'
    +'<button type="button" onclick="fgRefV2MenuZu()" style="flex:1;padding:6px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">Abbrechen</button>'
    +'</div>';
  try{ document.getElementById("fgRefV2KomTxt").focus(); }catch(e){}
}
function fgRefV2KommentarSenden(elId){
  var pz=_fgRefV2Pz(elId); if(!pz) return;
  var txt=String(((document.getElementById("fgRefV2KomTxt")||{}).value)||"").trim();
  /* Status bleibt, wie er ist - ein Kommentar ist keine Entscheidung. */
  fgRefV2Aktion(pz.Referenz_ID, String(pz.Manueller_Status||"OFFEN"), null, txt||null);
}
/* ────────────────────────────────────────────────────────────────────────────
   RALPH 10.09.2026 — "auch ein Button Zutat durch die Maschine bewerten lassen,
   also Regelwerk und Staffeln."
   Kein neuer Weg (B2): das ist genau die Kette, die der Knopf "→ Riki" in der
   linken Zutatenzeile seit jeher benutzt — Edge riki-zutat-bewerten stuft nach
   Regelwerk und Staffeln ein, die Waechter gegenpruefen, dann geht die Zutat
   ueber zutStammAnlegenMitKat in den Stamm. Neu ist nur, dass man sie AUCH von
   einer blockierenden Pruefzeile aus anstossen kann, statt den Namen erst
   drueben abzutippen.
   ──────────────────────────────────────────────────────────────────────────── */
/* 🔴 11.09.2026 GEMESSEN: die Edge-Funktion liefert zwar ein Feld verifikation,
   aber es steht auf {deprecated:true, ok:false, grund:"Legacy-Verifikation
   deaktiviert"}. Die Anzeige machte daraus ein "kein Pruefsignal" und sah damit
   aus wie eine Gegenprobe, die es nicht gibt. Sie ist raus.
   Die Gegenprobe macht jetzt cb_zutat_vorschlag_pruefen (Ralph 11.09.):
   1. aktive Regel aus Bewertungsregeln  2. sonst Familienabgleich ueber die
   Kategorie  3. weicht es ab: nicht schreiben, vorlegen. */
function _fgRefV2MaschErgebnis(elId, d){
  var m=document.getElementById("fgRefV2Menu"); if(!m) return;
  var e=_fgRefV2El(elId)||{};
  m.innerHTML='<div style="padding:2px 4px 8px"><b>'+esc(e.name||"")+'</b></div>'
    +'<div style="padding:8px 9px;border:1px solid #eef2f7;border-left:3px solid #6b4fbb;border-radius:8px;background:#f6f8fa;font-size:12.5px;line-height:1.55">'
      +'<b>Die Maschine sagt: Stufe '+esc(String(d.stufe))+'</b>'
      +(d.begruendung?'<br>'+esc(String(d.begruendung)):'')
    +'</div>'
    +'<div style="margin-top:7px;font-size:11.5px;color:#6b7280;line-height:1.5">'
      +'Beim Übernehmen wird der Wert gegen das Regelwerk geprüft. Weicht er ab, wird er nicht geschrieben.</div>'
    +'<button type="button" onclick="fgRefV2MaschUebernehmen('+elId+','+Number(d.stufe)+')" '
      +'style="display:block;width:100%;margin-top:8px;padding:8px;border:1px solid #bfe3cb;border-radius:8px;background:#e7f6ec;color:#1f7d43;cursor:pointer;font-size:12.5px;font-weight:700">'
      +'✓ Prüfen und übernehmen</button>'
    +'<button type="button" onclick="fgRefV2MenuZu()" '
      +'style="display:block;width:100%;margin-top:6px;padding:7px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">Abbrechen</button>';
}
function fgRefV2Maschine(elId){
  var e=_fgRefV2El(elId); if(!e) return;
  var name=String(e.name||e.original_text||"").trim();
  if(!name) return;
  var m=document.getElementById("fgRefV2Menu");
  if(m) m.innerHTML='<div style="padding:12px 10px;font-size:12.5px;color:#6b7280">Die Maschine liest Regelwerk und Staffeln …</div>';
  client.auth.getSession().then(function(s){
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok) throw new Error("Nicht angemeldet.");
    return fetch(client.supabaseUrl+"/functions/v1/riki-zutat-bewerten",
      {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},
       body:JSON.stringify({name:name})})
      .then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d&&d.error||"Die Maschine hat nicht geantwortet."); return d; }); });
  }).then(function(d){
    if(!d||typeof d.stufe!=="number") throw new Error("Die Maschine hat keine Stufe geliefert.");
    _fgRefV2MaschErgebnis(elId, d);
  }).catch(function(err){
    var m2=document.getElementById("fgRefV2Menu");
    if(m2) m2.innerHTML='<div style="padding:12px 10px;font-size:12.5px;color:#b91c1c">'+esc(String(err&&err.message||err))+'</div>'
      +'<button type="button" onclick="fgRefV2MenuZu()" style="display:block;width:100%;margin-top:6px;padding:7px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">Schliessen</button>';
    console.error("[Referenz V2] Maschine", err);
  });
}
function fgRefV2MaschUebernehmen(elId, stufe){
  var e=_fgRefV2El(elId); if(!e) return;
  var name=String(e.name||e.original_text||"").trim(); if(!name) return;
  var m=document.getElementById("fgRefV2Menu");
  var zeig=function(html){ var x=document.getElementById("fgRefV2Menu"); if(x) x.innerHTML=html; };
  /* Die Kategorie wird ohnehin gebraucht - und der Riegel misst an ihr die Familie.
     Deshalb zuerst fragen, dann pruefen, dann erst schreiben. */
  Promise.resolve(zutKatFrage(name)).then(function(kat){
    if(!kat) { fgRefV2MenuZu(); return null; }
    zeig('<div style="padding:12px 10px;font-size:12.5px;color:#6b7280">prüfe gegen das Regelwerk …</div>');
    return client.rpc("cb_zutat_vorschlag_pruefen",
      {p_name:name, p_stufe:stufe, p_regel_id:null, p_kategorie:kat}).then(function(r){
        if(r&&r.error) throw r.error;
        var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e2){} }
        if(!d||d.ok!==true) throw new Error((d&&d.grund)||"Die Prüfung hat nichts geliefert.");
        if(!d.schreibbar){
          zeig('<div style="padding:2px 4px 8px"><b>'+esc(name)+'</b></div>'
            +'<div style="padding:9px 10px;border:1px solid #f0dcb4;border-left:3px solid #b45309;border-radius:8px;background:#fff8ec;font-size:12.5px;line-height:1.6;color:#8a5a0b">'
              +'<b>Nicht übernommen.</b><br>'+esc(String(d.begruendung||""))
            +'</div>'
            +'<button type="button" onclick="fgRefV2MenuZu()" style="display:block;width:100%;margin-top:8px;padding:7px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">Schliessen</button>');
          return null;
        }
        zeig('<div style="padding:12px 10px;font-size:12.5px;color:#6b7280">lege an …</div>');
        return zutStammAnlegenMitKat({p_name:name, p_rating:stufe, p_kategorie:kat,
          p_quelle:"Maschine + Regelwerk-Prüfung ("+String(d.quelle||"")+", Soll "+String(d.soll==null?"-":d.soll)+"), aus der Etikettprüfung"})
          .then(function(res){
            if(res&&res.error) throw res.error;
            if(!(res&&res.data&&res.data.ok)) throw new Error((res&&res.data&&res.data.grund)||"Der Stamm hat die Zutat nicht angenommen.");
            fgRefV2MenuZu();
            return fgRefV2NachNeuanlage(name, true);
          });
      });
  }).catch(function(err){
    zeig('<div style="padding:12px 10px;font-size:12.5px;color:#b91c1c">'+esc(String(err&&err.message||err))+'</div>'
      +'<button type="button" onclick="fgRefV2MenuZu()" style="display:block;width:100%;margin-top:6px;padding:7px;border:1px solid #d3dbe6;border-radius:8px;background:#f4f7fa;cursor:pointer;font-size:12px">Schliessen</button>');
    console.error("[Referenz V2] Maschine uebernehmen", err);
  });
}
if(typeof window!=="undefined"){ window.fgRefV2Maschine=fgRefV2Maschine; window.fgRefV2MaschUebernehmen=fgRefV2MaschUebernehmen; }
function fgRefV2Menu(ev, elId){
  try{ ev.stopPropagation(); }catch(e){}
  var offen=document.getElementById("fgRefV2Menu");
  if(offen){ var same=(offen.getAttribute("data-el")===String(elId)); offen.remove(); if(same) return; }
  var e=_fgRefV2El(elId), pz=_fgRefV2Pz(elId); if(!e||!pz) return;
  var st=String(pz.Manueller_Status||"OFFEN");
  var K=function(txt, js, farbe){
    return '<button type="button" onclick="'+js+'" style="display:block;width:100%;text-align:left;padding:6px 8px;border:0;border-top:1px solid #eef2f7;background:none;cursor:pointer;font-size:12.5px;color:'+(farbe||"#1d2733")+'">'+txt+'</button>';
  };
  var html='<div style="padding:2px 4px 6px"><b>'+esc(e.name||"")+'</b> <span style="color:#9aa7b2">· Status: '+esc(st)+'</span></div>';
  var eStA=String(e.status||"");
  var kein_wie_erkannt=(eStA==="MEHRDEUTIG"||eStA==="FRAGMENT"||eStA==="KLAMMER_FEHLER"||eStA==="FALSCH_ZERLEGT"||eStA==="HERSTELLERANGABE_UNVOLLSTAENDIG");
  if(!e.zutat_id) html+=K('⚙ <b>Von der Maschine bewerten lassen</b><br><span style="color:#9aa7b2">Regelwerk und Staffeln anwenden, Zutat anlegen und Note setzen</span>', 'fgRefV2Maschine('+elId+')', '#6b4fbb');
  if(!kein_wie_erkannt) html+=K('✓ Zuordnung bestätigen (wie erkannt)', 'fgRefV2Schnell('+elId+')', '#166534');
  (e.kandidaten||[]).forEach(function(kd,i){
    html+=K('→ Kandidat wählen: <b>'+esc(kd.zutat)+'</b> <span style="color:#9aa7b2">('+esc(kd.art)+', '+esc(String(kd.aehnlichkeit).slice(0,4))+')</span>', 'fgRefV2KandWahl('+elId+','+i+')');
  });
  /* 🔴 23.08.2026, Work #224 — HIER STANDEN SECHS MENUEPUNKTE OHNE WIRKUNG.
     "Typ ändern → Zutat/Gruppe/Mikronährstoff/Wirkstoff/Zusatzstoff",
     "Als Unterzutat markieren (Parent wählen) …" und
     "Als Quelle markieren (gewonnen aus)".
     Alle drei schrieben ihren Wert als FREITEXT in Manuelle_Entscheidung
     ("TYP=gruppe", "BEZIEHUNG=quelle", "PARENT=…") und bestaetigten die Zeile.
     GEMESSEN: keine einzige Funktion in public oder shadow_v1 liest jemals TYP=,
     BEZIEHUNG= oder PARENT= — die Suche ueber alle Funktionsrümpfe lieferte null
     Treffer. Der gewaehlte Typ hatte bei der Bindung dieselbe Wirkung wie ein
     schlichtes "Zuordnung bestaetigen": keine.
     GEMESSEN, dass nichts verlorengeht: von 6.882 Pruefzeilen tragen 1.771 eine
     manuelle Entscheidung — davon 0 mit TYP=, 0 mit BEZIEHUNG=, 0 mit PARENT=.
     Die Punkte wurden nie benutzt.
     Ralph-Entscheid 23.08.: entfernen statt verstaendlicher beschriften. Ein Knopf,
     der nichts tut, wird durch einen besseren Namen nicht besser.
     ⚠ FALLS DAS JEMALS GEWOLLT IST: die richtigen Felder gibt es bereits.
     Automatischer_Typ ist in ALLEN 6.882 Zeilen gefuellt, Parent_Element_Key in
     2.365. Ein kuenftiger Umbau schreibt dorthin — nicht in einen Freitext daneben. */
  html+=K('🗑 <b>Entfernen – ist keine Zutat</b><br><span style="color:#9aa7b2">Werbetext, Hinweis oder falsch zerlegt. Die Zeile verschwindet und sperrt nicht mehr.</span>', 'fgRefV2Entfernen('+elId+')', '#dc2626');
  html+=K('💬 Kommentar …', 'fgRefV2KommentarFeld('+elId+')');
  if(st!=="OFFEN") html+=K('↩ Entscheidung widerrufen (zurück auf OFFEN)', 'fgRefV2Widerruf('+pz.Referenz_ID+')', '#b45309');
  var m=document.createElement("div"); m.id="fgRefV2Menu"; m.setAttribute("data-el", String(elId));
  m.style.cssText="position:absolute;z-index:95;background:#fff;color:#1d2733;border:1px solid #d3dbe6;border-radius:11px;box-shadow:0 14px 40px rgba(20,40,70,.22);padding:8px;width:320px;max-height:60vh;overflow:auto";
  var t=ev.target&&ev.target.closest?ev.target.closest("button"):null; var r=(t||ev.target).getBoundingClientRect();
  m.style.top=(window.scrollY+r.bottom+4)+"px";
  m.style.left=(window.scrollX+Math.min(r.left, Math.max(6, innerWidth-332)))+"px";
  m.innerHTML=html;
  document.body.appendChild(m);
  setTimeout(function(){ var zu=function(e2){ if(!m.contains(e2.target)){ m.remove(); document.removeEventListener("mousedown",zu); } }; document.addEventListener("mousedown",zu); },0);
}
function _fgRefV2Farbe(e, pz, ctx){
  ctx=ctx||{};
  var st=String(e.status||""), typ=String(e.typ||"");
  var bestaetigt = pz && (pz.Manueller_Status==="BESTAETIGT" || pz.Manueller_Status==="IGNORIERT");
  var eb2 = (Number(e.ebene)===2 || e.beziehung==="quelle");
  function ROT(t){ return {f:"rot", c:"#dc2626", bg:"#fef2f2", t:t}; }
  function GELB(t){ return {f:"gelb", c:"#b45309", bg:"#fffbeb", t:t}; }
  function BLAU(t){ return {f:"blau", c:"#1d4ed8", bg:"#eff6ff", t:t}; }
  function GRUEN(t){ return {f:"gruen", c:"#166534", bg:"#ecfdf5", t:t}; }
  function GRAU(t){ return {f:"grau", c:"#94a3b8", bg:"var(--k-f6f8f7,#f6f8f7)", t:t}; }
  if(typ==="kennzeichnungstext") return {f:"grau", c:"#94a3b8", bg:"var(--k-f6f8f7,#f6f8f7)", t:"Kennzeichnungstext – bewusst nicht als Zutat gewertet"};
  var HART={FRAGMENT:1, KLAMMER_FEHLER:1, FALSCH_ZERLEGT:1, HERSTELLERANGABE_UNVOLLSTAENDIG:1};
  if(HART[st]){
    if(st==="FRAGMENT") return ROT("Fragment – blockiert (Strukturfehler, braucht Korrektur oder Ablehnung)");
    if(st==="HERSTELLERANGABE_UNVOLLSTAENDIG") return ROT("Klammern unausgeglichen – blockiert (Strukturfehler)");
    return ROT(st+" – blockiert (Strukturfehler, braucht Korrektur oder Ablehnung)");
  }
  var mSt=pz?String(pz.Manueller_Status||"OFFEN"):"OFFEN";
  if(mSt==="BESTAETIGT"){
    var ent=String(pz.Manuelle_Entscheidung||"");
    var km=ent.match(/KANDIDAT=([^(]+)[(]/);
    var ziel=pz.Ziel_ID?(" → Stamm: "+((km&&km[1].trim())||pz.Ziel_ID)):(ent?(" → "+ent.slice(0,60)):"");
    return GRUEN("Manuell bestätigt"+ziel+((st&&st!=="OK")?(" · Parserhinweis: ursprünglich "+st):""));
  }
  if(mSt==="IGNORIERT")
    return {f:"grau", c:"#94a3b8", bg:"var(--k-f6f8f7,#f6f8f7)", t:"Manuell ignoriert – bewusst übergangen"+((st&&st!=="OK")?(" · ursprünglich "+st):"")};
  if(mSt==="ABGELEHNT" && !(ctx.blocker&&ctx.blocker[e.id]))
    return {f:"grau", c:"#94a3b8", bg:"var(--k-f6f8f7,#f6f8f7)", t:"Manuell abgelehnt – falsch erkannt (wartet auf Korrektur/Neuzerlegung)"};
  if(ctx.blocker && ctx.blocker[e.id]) return ROT("⛔ "+ctx.blocker[e.id]);
  if(st==="MEHRDEUTIG")                      return ROT("Mehrere Kandidaten – Kandidat wählen (⋯-Menü)");
  if(eb2){
    if(st==="UNSICHER")  return GELB("Stammzuordnung unsicher – bestätigen");
    if(st==="UNBEKANNT") return GELB("Nicht im Stamm – prüfen (blockiert nicht)");
    if(bestaetigt)       return GRUEN("Bestätigt");
    var p=ctx.parent;
    if(p && ctx.blocker && ctx.blocker[p.id])
      return GELB("Parent „"+(p.name||"")+"“ ist blockiert – erst den Parent klären");
    if(p && (st==="OK") && ["MEHRDEUTIG","UNSICHER","UNBEKANNT","FRAGMENT","HERSTELLERANGABE_UNVOLLSTAENDIG"].indexOf(String(p.status||""))>=0)
      return GRAU("Nichts zu tun – erst „"+(p.name||"die Zeile darüber")+"“ oben klären");
    if(p && p.db_gebunden===true) return GRAU("✓ Nichts zu tun – gehört zu „"+(p.name||"der Zeile darüber")+"“");
    if(p && ctx.parentBest)       return GRAU("✓ Nichts zu tun – gehört zu „"+(p.name||"der Zeile darüber")+"“");
    if(p) return GRAU("Nichts zu tun – erst „"+(p.name||"die Zeile darüber")+"“ oben klären");
    return GRAU("Nichts zu tun – gehört zu der Zeile darüber");
  }
  if(typ==="mikronaehrstoff" || typ==="wirkstoff"){
    if(bestaetigt) return GRUEN("Bestätigt");
    if(st==="UNBEKANNT") return GELB("Diesen Namen kennen wir noch nicht – sag Bescheid, ich lege ihn an");
    return GRAU("✓ Nichts zu tun – zählt als "+(typ==="wirkstoff"?"Wirkstoff":"Mikronährstoff")+", nicht als Zutat");
  }
  if(st==="UNBEKANNT" && (e.zaehlt_als_hauptzutat===true || typ==="gruppe"))
                       return ROT("Diesen Namen kennen wir nicht – blockiert die Freigabe. Sag Bescheid, ich lege ihn an");
  if(st==="UNSICHER")  return GELB("Nur ein Vorschlag – bestätigen");
  if(st==="UNBEKANNT") return GELB("Nicht im Stamm – zu prüfen");
  if(!bestaetigt)      return GELB("Erkannt, noch nicht bestätigt");
  return GRUEN("Erkannt und bestätigt");
}
function _fgRefV2TypLabel(e){
  var t=String(e.typ||"");
  if(t==="gruppe")          return "Gruppe";
  if(t==="mikronaehrstoff") return "Mikronährstoff";
  if(t==="wirkstoff")       return "Wirkstoff";
  if(t==="zusatzstoff")     return "Zusatzstoff";
  if(t==="kennzeichnungstext") return "Hinweis";
  if(Number(e.ebene)===2)   return (e.beziehung==="quelle")?"Quelle":"Unterzutat";
  return e.zaehlt_als_hauptzutat?"Hauptzutat":"Zutat";
}
async function fgRefV2Laden(){
  var box=document.getElementById("fe_refV2"); if(!box) return;
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid){ box.innerHTML='<div style="color:var(--muted);font-size:12.5px;padding:6px">Referenz V2 gibt es erst, wenn das Produkt gespeichert ist – vorher fehlt die Produkt-Nummer.</div>'; return; }
  box.innerHTML='<div style="color:var(--muted);font-size:12.5px;padding:6px">Referenz V2 wird geladen …</div>';
  var d=null, st=null, fehler="";
  try{
    var r1=await client.rpc("cb_referenz_pruefung_laden",{p_produkt_id:pid});
    if(r1&&r1.error) throw r1.error; d=r1&&r1.data;
    var r2=await client.rpc("cb_referenz_pruefung_status",{p_produkt_id:pid});
    if(r2&&r2.error) throw r2.error; st=r2&&r2.data;
  }catch(e){ fehler=(e&&e.message)?String(e.message):String(e); }
  /* Work #371 (KP-4): Der Bindungsstand kommt vom Server, nicht aus dieser Datei.
     Eigener Fangblock, weil eine fehlende Lueckenanzeige die Etikettkarte nicht
     kosten darf - der Grund steht dann in der Konsole und im Streifen. */
  var bind=null, bindFehler="";
  try{
    var r3=await client.rpc("cb_produkt_bindung_stand",{p_produkt_id:pid});
    if(r3&&r3.error) throw r3.error; bind=r3&&r3.data;
  }catch(e2){
    bindFehler=(e2&&e2.message)?String(e2.message):String(e2);
    console.error("[Bindungsstand] Laden fehlgeschlagen:", bindFehler);
  }
  window._fgBindung={stand:bind, fehler:bindFehler};
  /* Work #457 (Ralph-Entscheid 03.09., B mit Freigabesperre): Steht ein
     Dublettenverdacht offen, ist die Freigabe dieses Produkts serverseitig
     gesperrt - ein Riegel auf der Tabelle, nicht in einer Funktion. Der Mensch
     muss hier entscheiden koennen, sonst sieht er nur eine Fehlermeldung beim
     Freigeben und weiss nicht, warum. Eigener Fangblock wie beim Bindungsstand. */
  var dub=null, dubFehler="";
  try{
    var r4=await client.rpc("cb_riki_dublette_stand",{p_produkt_id:pid});
    if(r4&&r4.error) throw r4.error; dub=r4&&r4.data;
  }catch(e4){
    dubFehler=(e4&&e4.message)?String(e4.message):String(e4);
    console.error("[Dublettenverdacht] Laden fehlgeschlagen:", dubFehler);
  }
  window._fgDublette={stand:dub, fehler:dubFehler};
  /* Ralph 10.09.2026 (P9956 zeigte den Pizza-Text von P1204): Wer im Posteingang
     schnell weiterblättert, bekommt die Antworten des VORIGEN Produkts erst
     jetzt. Gehören sie nicht mehr zum geladenen Produkt, werden sie verworfen. */
  if(((window._fgEdit&&window._fgEdit.id)||"")!==pid){
    try{ console.warn("[Referenz V2] Antwort für "+pid+" verworfen – inzwischen ist "+((window._fgEdit&&window._fgEdit.id)||"–")+" geladen."); }catch(_){}
    return;
  }
  if(fehler){
    /* Kein leerer Fangblock (§1.13i): der Grund muss sichtbar sein. */
    console.error("[Referenz V2] Laden fehlgeschlagen:", fehler);
    box.innerHTML='<div style="color:var(--k-dc2626,#dc2626);font-size:12.5px;padding:6px">Referenz V2 konnte nicht geladen werden: '+esc(fehler)+'</div>';
    return;
  }
  window._fgRefV2={d:d, st:st, rohtext:(d&&d.rohtext)||""};
  fgRefV2Render(d, st);
  /* Ralph 10.09.2026: das Blockierende steht jetzt AUCH in der linken Liste.
     Ohne diesen Aufruf haette es dort erst nach dem naechsten Tastendruck gestanden. */
  try{ if(typeof fgBestandteileRender==="function") fgBestandteileRender(); }catch(e){ console.error("[Bestandteile] Neuzeichnen nach Referenz", e); }
  try{ if(FE_REF_KURZ && typeof fgEnthaltenRender==="function") fgEnthaltenRender(); }catch(e){ console.error("[Etikett] Kurzkarte nach Referenz", e); }
  /* Die Spaltenbreite haengt daran, OB der Parser Inhalt geliefert hat - das weiss man
     erst jetzt. Ohne diesen Aufruf bliebe die Karte nach dem Laden auf Normalbreite
     (bzw. eine leere breit). */
  try{ feGridHoeheSync(); }catch(e){}
}
/* Etikett- und Abgleichkarte teilen denselben aktuellen Quellen- und Referenzzustand. */
var _ETI_ST={
  uebernommen:{t:"übernommen",     f:"var(--k-166534,#166534)", b:"var(--k-dcfce7,#dcfce7)"},
  offen:      {t:"nicht zugeordnet",f:"var(--k-1d4ed8,#1d4ed8)", b:"var(--k-dbeafe,#dbeafe)"},
  pruefen:    {t:"Prüfung nötig",   f:"var(--k-92400e,#92400e)", b:"var(--k-fef3c7,#fef3c7)"},
  ignoriert:  {t:"ignoriert",       f:"var(--muted)",            b:"var(--k-eef1f4,#eef1f4)"}
};
function _etiGebunden(e){
  if(!e) return false;
  var f=function(v){ return v===true||String(v)==="true"; };
  return f(e.db_gebunden)||f(e.db_zusatzstoff_gebunden)||f(e.db_naehrstoff_gebunden);
}
function _etiStatus(e, pz){
  var man=String((pz&&pz.Manueller_Status)||e.manueller_status||"OFFEN").toUpperCase();
  if(man==="IGNORIERT"||man==="ABGELEHNT") return "ignoriert";
  if(String(e.blockiert)==="true"||e.blocker_aktiv===true) return "pruefen";
  if(man==="BESTAETIGT") return "uebernommen";
  if(_etiGebunden(e)) return "uebernommen";
  var ziel=(pz&&pz.Ziel_ID)||e.zutat_id||e.ziel_id_manuell;
  return ziel?"offen":"pruefen";
}
function fgEtikettZeile(e, pz, i){
  var _k=_etiStatus(e,pz);
  var s=_ETI_ST[_k]||_ETI_ST.pruefen;
  var _pill=(_k==="uebernommen")
    ? 'color:var(--k-166534,#166534);font-weight:600'
    : 'font-weight:700;padding:2px 7px;border-radius:999px;background:'+s.b+';color:'+s.f;
  var _txtSt=(_k==="uebernommen")?('✓ '+s.t):s.t;
  var txt=String(e.original_text||e.name||"");
  var en=String(e.e_nummer||"").trim();
  var unter=(Number(e.ebene)===2);
  return '<div class="etiZeile" data-eid="'+esc(String(e.id))+'"'
    +' onclick="fgEtikettKlick('+JSON.stringify(String(e.id)).replace(/"/g,'&quot;')+')"'
    +' title="Anklicken – die zugehörige Zeile links wird hervorgehoben"'
    +' style="display:flex;align-items:baseline;gap:8px;padding:7px 9px;border-bottom:1px solid var(--line);cursor:pointer'
    +(unter?';padding-left:22px':'')+'">'
    +'<span style="flex:1 1 auto;min-width:0;font-size:12.5px;color:var(--ink);overflow-wrap:anywhere">'+esc(txt)
    +(en?' <span style="color:var(--muted);font-size:11.5px">· '+esc(en)+'</span>':'')+'</span>'
    +'<span style="flex:0 0 auto;font-size:10.5px;'+_pill+'">'+esc(_txtSt)+'</span>'
    +'</div>';
}
/* Klick rechts → Zeile links hervorheben. Verglichen wird über den ORIGINALTEXT
   und den Stammnamen; getroffen wird nur, was wirklich übereinstimmt — geraten
   wird nichts (§1). Findet sich nichts, sagt die Karte das. */
function fgEtikettKlick(elId){
  var d=(window._fgRefV2||{}).d||{};
  var e=(d.elemente||[]).find(function(x){ return x && String(x.id)===String(elId); });
  if(!e) return;
  var kand=[e.original_text, e.name, e.stammname].map(function(x){ return String(x||"").trim().toLowerCase(); }).filter(Boolean);
  var treffer=null;
  [].forEach.call(document.querySelectorAll("#fe_zutRows .fgZutRow"), function(row){
    var inp=row.querySelector(".fgzName"); if(!inp||treffer) return;
    if(kand.indexOf(String(inp.value||"").trim().toLowerCase())>=0) treffer=row;
  });
  [].forEach.call(document.querySelectorAll("#fe_zutRows .fgZutRow"), function(r){ r.style.background=""; });
  if(!treffer){
    try{ toast&&toast("Links gibt es dazu noch keine Zeile: „"+String(e.original_text||e.name||"")+"\""); }catch(_){}
    return;
  }
  treffer.style.background="var(--k-fef3c7,#fef3c7)";
  try{ treffer.scrollIntoView({behavior:"smooth",block:"center"}); }catch(_){}
  try{ var inp2=treffer.querySelector(".fgzName"); if(inp2) inp2.focus(); }catch(_){}
  setTimeout(function(){ try{ treffer.style.background=""; }catch(_){} }, 2600);
}
if(typeof window!=="undefined"){ window.fgEtikettKlick=fgEtikettKlick; }

/* Work #371 (KP-4): Wie weit ist dieses Produkt gebunden, und was fehlt.
   Die Antwort kommt vollstaendig aus cb_produkt_bindung_stand. Hier wird nichts
   gerechnet und keine Serverentscheidung nachgebaut - nur angezeigt.
   Teilgebunden ist ein eigener Zustand und wird nie als gebunden dargestellt. */
var _BIND_ST={
  gebunden:    {t:"gebunden",     f:"var(--k-166534,#166534)", b:"var(--k-dcfce7,#dcfce7)", i:"✓"},
  teilgebunden:{t:"teilgebunden", f:"var(--k-92400e,#92400e)", b:"var(--k-fef3c7,#fef3c7)", i:"◐"},
  ungebunden:  {t:"ungebunden",   f:"var(--k-1d4ed8,#1d4ed8)", b:"var(--k-dbeafe,#dbeafe)", i:"○"},
  ungeprueft:  {t:"noch nicht geprüft", f:"var(--muted)",      b:"var(--k-eef1f4,#eef1f4)", i:"–"},
  ohne_quelle: {t:"ohne Quelle",  f:"var(--muted)",            b:"var(--k-eef1f4,#eef1f4)", i:"–"}
};
/* Work #457, 04.09.2026 — DER DUBLETTENVERDACHT UND WER IHN ENTSCHEIDET

   Ohne Barcode entsteht die Identitaet erst, wenn Riki den Namen gelesen hat.
   Trifft der Name plus Hersteller ein bestehendes Produkt ohne Barcode, setzt
   der Server einen Verdacht und sperrt die Freigabe (Ralph-Entscheid 03.09., B).

   🔴 Hier wird NICHTS nachgebaut: Zustand, Sperre und Entscheidung kommen aus
   cb_riki_dublette_stand und cb_riki_dublette_entscheiden. Diese Anzeige zeigt
   sie nur und gibt dem Menschen die zwei Knoepfe, die er braucht.
   Geloescht wird auch bei "Dublette" nichts - das Uebertragen bleibt Handarbeit. */
function fgDubletteStreifen(){
  var w=window._fgDublette||{};
  if(w.fehler){
    return '<div style="margin:0 2px 8px;padding:6px 9px;border:1px solid var(--k-dc2626,#dc2626);border-radius:8px;'
      +'background:var(--card);color:var(--k-dc2626,#dc2626);font-size:11.5px">'
      +'Dublettenverdacht konnte nicht geladen werden: '+esc(w.fehler)+'</div>';
  }
  var b=w.stand;
  if(!b || b.ok===false || b.verdacht!==true) return "";
  var offen=(b.entscheidung==null);
  var farbe=offen?'var(--k-92400e,#92400e)':'var(--muted)';
  var grund=offen?'var(--k-fef3c7,#fef3c7)':'var(--k-eef1f4,#eef1f4)';
  var H='<div style="margin:0 2px 8px;padding:8px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card)">'
    +'<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">'
    +'<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:'+grund+';color:'+farbe+'">'
    +(offen?'⚠️ Dublettenverdacht':'✓ entschieden')+'</span>'
    +'<span style="font-size:11.5px;color:var(--muted)">'+esc(String(b.erklaerung||""))+'</span></div>'
    +'<div style="margin-top:6px;font-size:11.5px">Trifft: <b>'+esc(String(b.trifft||""))+'</b>'
    +(b.trifft_name?(' – '+esc(String(b.trifft_name))+(b.trifft_marke?(' · '+esc(String(b.trifft_marke))):'')):'')+'</div>';
  if(offen){
    H+='<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
      +'<button onclick="fgDubletteEntscheiden(\'eigenes_produkt\')" style="padding:6px 11px;border:1px solid var(--k-16a34a,#16a34a);border-radius:8px;background:var(--k-ecfdf5,#ecfdf5);color:var(--k-166534,#166534);font-size:12px;font-weight:600;cursor:pointer">Eigenes Produkt</button>'
      +'<button onclick="fgDubletteEntscheiden(\'zusammenfuehren\')" style="padding:6px 11px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:12px;cursor:pointer">Ist dieselbe Ware</button>'
      +'</div>'
      +'<div style="margin-top:5px;font-size:11px;color:var(--muted)">Bis dahin bleibt die Freigabe gesperrt. Gelöscht wird nichts.</div>';
  }
  return H+'</div>';
}
async function fgDubletteEntscheiden(wahl){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!pid) return;
  try{
    var r=await client.rpc("cb_riki_dublette_entscheiden",{p_produkt_id:pid, p_entscheidung:wahl, p_notiz:null});
    if(r&&r.error) throw r.error;
    await fgRefV2Laden();
  }catch(e){
    /* Kein stiller Fangblock: der Grund gehoert vor die Augen des Menschen. */
    alert("Konnte nicht gespeichert werden: "+((e&&e.message)||e));
  }
}
if(typeof window!=="undefined"){ window.fgDubletteEntscheiden=fgDubletteEntscheiden; window.fgDubletteStreifen=fgDubletteStreifen; }
function fgBindungStreifen(){
  var w=window._fgBindung||{};
  if(w.fehler){
    return '<div style="margin:0 2px 8px;padding:6px 9px;border:1px solid var(--k-dc2626,#dc2626);border-radius:8px;'
      +'background:var(--card);color:var(--k-dc2626,#dc2626);font-size:11.5px">'
      +'Bindungsstand konnte nicht geladen werden: '+esc(w.fehler)+'</div>';
  }
  var b=w.stand; if(!b || b.ok===false) return "";
  var s=_BIND_ST[String(b.zustand||"")]||_BIND_ST.ungeprueft;
  var H='<div style="margin:0 2px 8px;padding:8px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card)">'
    +'<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">'
    +'<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:'+s.b+';color:'+s.f+'">'
    +s.i+' '+esc(s.t)+'</span>'
    +'<span style="font-size:11.5px;color:var(--muted)">'+esc(String(b.erklaerung||""))+'</span></div>';
  /* #746: die drei Serverzahlen ausdruecklich, nicht nur im Satz. */
  H+='<div id="fe_bindZahlen" style="margin-top:5px;font-size:11.5px;color:var(--ink)">'
    +'<b>'+Number(b.gebunden||0)+'</b> gebunden · <b>'+Number(b.offen||0)+'</b> offen · <b>'+Number(b.ignoriert||0)+'</b> gestrichen'
    +' <span style="color:var(--muted)">(von '+Number(b.erkannt||0)+' erkannt, Stand aus cb_produkt_bindung_stand)</span></div>';
  var lk=Array.isArray(b.luecken)?b.luecken:[];
  if(lk.length){
    H+='<div style="margin-top:6px;font-size:11.5px;line-height:1.6">'
      +'<b style="color:var(--ink)">Diese Zutaten fehlen noch:</b><ul style="margin:4px 0 0;padding-left:18px">'
      +lk.map(function(l){
          return '<li>'+esc(String((l&&l.name)||""))
            +' <span style="color:var(--muted)">– '+esc(String((l&&l.grund)||""))+'</span></li>';
        }).join('')
      +'</ul></div>';
  }
  if(b.bewertung_status && b.clean_score==null){
    H+='<div style="margin-top:6px;font-size:11px;color:var(--muted)">'
      +'Bewertung: '+esc(String(b.bewertung_status))+'. Eine Bindung allein ergibt noch keinen Score.</div>';
  }
  return H+'</div>';
}
var FE_REF_KURZ = true;
function fgRefV2RenderKurz(d, st, box){
  var H="";
  var fotos=0;
  try{ fotos=Number(window._fgEtikettAnzahl||0)||0; }catch(e){}
  H+='<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding:0 2px 9px">'
    +'<b style="font-size:12px;letter-spacing:.04em;color:var(--ink)">ETIKETT</b>'
    +(fotos
      ? '<button type="button" onclick="fgRefFlip(true)" style="font-size:11.5px;font-weight:700;padding:4px 11px;border:1px solid var(--k-16a34a);border-radius:8px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);cursor:pointer">⇄ Etikettfoto ansehen ('+fotos+')</button>'
      : '<span style="font-size:11.5px;color:var(--muted)">Kein Etikettfoto hinterlegt – es gibt nur den Text unten.</span>')
    +'</div>';
  H+='<div style="font-size:11.5px;color:var(--muted);padding:0 2px 5px">Originaltext vom Etikett'
    +(d.rohtext_quelle?(' <span style="color:var(--muted)">– '+esc(String(d.rohtext_quelle))+'</span>'):'')+'</div>'
    +'<textarea id="fe_refV2Roh" readonly style="width:100%;box-sizing:border-box;height:170px;padding:8px;border:1px solid var(--line);border-radius:9px;font-size:12px;line-height:1.5;background:var(--k-f6f8f7,#f6f8f7);color:var(--ink);resize:vertical">'
    +esc(String(d.rohtext||""))+'</textarea>'
    +'<button type="button" onclick="fgRefV2Kopieren()" style="margin-top:6px;padding:4px 10px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--ink);cursor:pointer;font-size:11.5px">Kopieren</button>';
  H+='<div style="font-size:11px;color:var(--muted);padding:8px 2px 0;line-height:1.5">'
    +'Was daraus gelesen wurde, steht links in der Zutatenliste – auch das, was die Freigabe blockiert.</div>';
  H+='<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11.5px;color:var(--muted);padding:4px 2px">Details für den Fehlerfall (Parser '
    +esc(String(d.parser_version||"?"))+', Hash '+esc(String(d.originaltext_hash||"").slice(0,8))+' …)</summary>'
    +'<div id="fe_refV2Tech" style="margin-top:6px"></div></details>';
  box.innerHTML=H;
  try{ fgRefV2RenderTechnik(d, st, document.getElementById("fe_refV2Tech")); }catch(e){ console.error("[Etikett] Technikbereich:", e); }
}
function fgRefV2Render(d, st){
  var box=document.getElementById("fe_refV2"); if(!box) return;
  if(!d || d.ok===false){
    box.innerHTML='<div style="color:var(--k-dc2626,#dc2626);font-size:12.5px;padding:6px">'+esc((d&&d.fehler)||"Keine Daten.")+'</div>';
    return;
  }
  var BIND=""; try{ BIND=fgBindungStreifen(); }catch(eB){ console.error("[Bindungsstand] Anzeige:", eB); }
  try{ BIND=fgDubletteStreifen()+BIND; }catch(eD){ console.error("[Dublettenverdacht] Anzeige:", eD); }
  var el=Array.isArray(d.elemente)?d.elemente:[];
  if(!el.length){
    fgRefV2RenderTechnik(d, st, box);          /* ehrlicher Leerzustand steht dort */
    if(BIND) box.innerHTML=BIND+box.innerHTML; /* der Bindungsstand gilt auch ohne Parserbaum */
    return;
  }
  /* 🔴 10.09.2026, RALPH: "das rechte kann eigentlich weg, oder? … wenn dann ist
     das Produktbild interessant zum Abgleich was draufsteht, wenn vorhanden."
     Fast alles rechts stand seit dem Umbau der Zutatenliste doppelt: dieselben
     Elemente, dieselben Pruefzeilen, dieselben Entscheidungen. Uebrig bleibt, was
     es NUR hier gibt und was beim Vergleich hilft:
       1. das Etikettfoto (Knopf "⇄ Etikett" dreht die Karte um - gab es schon,
          nur hat es niemand gefunden),
       2. der Originaltext vom Etikett,
       3. die technischen Details.
     Die gespiegelte Liste (fgEtikettZeile) und der Bindungsstreifen bleiben im
     Code stehen - abgeschaltet, nicht geloescht, eine Zeile zurueck. */
  /* #746 (16.09.2026, Abnahme-Befund): der Bindungsstreifen wurde aufgebaut und in der
     Kurzkarte verworfen. Die drei Zahlen des Servers (gebunden / offen / gestrichen)
     muessen sichtbar sein - sonst zeigt die Seite weniger, als der Server weiss. */
  if(FE_REF_KURZ){ fgRefV2RenderKurz(d, st, box); if(BIND) box.insertAdjacentHTML("afterbegin", BIND); return; }
  var pzMap={}; (d.pruefzeilen||[]).forEach(function(p){ if(p&&p.Parser_Element_ID!=null) pzMap[p.Parser_Element_ID]=p; });
  var zaehl={uebernommen:0,offen:0,pruefen:0,ignoriert:0};
  el.forEach(function(e){ zaehl[_etiStatus(e,pzMap[e.id])]++; });
  var _alleUeb=(zaehl.uebernommen===el.length);
  var H=BIND
    +'<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:0 2px 7px">'
    +'<b style="font-size:12px;letter-spacing:.04em;color:var(--ink)">ETIKETT</b>'
    +'<span style="font-size:11px;color:var(--muted)">'+el.length+' Zeile'+(el.length===1?'':'n')+' vom Etikett</span></div>';
  H+='<div style="display:flex;gap:5px;flex-wrap:wrap;padding:0 2px 8px">'
    +(_alleUeb
      ? '<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--k-dcfce7,#dcfce7);color:var(--k-166534,#166534)">✓ alle '+el.length+' übernommen</span>'
      : Object.keys(zaehl).filter(function(k){ return zaehl[k]>0 && k!=="uebernommen"; }).map(function(k){
          var s=_ETI_ST[k];
          return '<span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:'+s.b+';color:'+s.f+'">'+zaehl[k]+' '+esc(s.t)+'</span>';
        }).join(''))
    +'</div>';
  H+='<div style="border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--card)">'
    +el.map(function(e,i){ return fgEtikettZeile(e, pzMap[e.id], i); }).join('')+'</div>';
  H+='<div style="font-size:10.5px;color:var(--muted);padding:6px 2px 0;line-height:1.45">'
    +'Das ist die <b>Quelle</b> – Originaltext vom Etikett. Links steht unsere Interpretation. '
    +'Zeile anklicken: die passende Zeile links wird hervorgehoben.</div>';
  H+='<details style="margin-top:8px"><summary style="cursor:pointer;font-size:11.5px;color:var(--muted);padding:4px 2px">Technische Details (Parser '
    +esc(String(d.parser_version||"?"))+', Hash '+esc(String(d.originaltext_hash||"").slice(0,8))+' …)</summary>'
    +'<div id="fe_refV2Tech" style="margin-top:6px"></div></details>';
  box.innerHTML=H;
  try{ fgRefV2RenderTechnik(d, st, document.getElementById("fe_refV2Tech")); }catch(e){ console.error("[Etikett] Technikbereich:", e); }
}
/* ALTCODE, unverändert: der vollständige Parserbaum mit allen Aktionen. Er ist
   jetzt der Inhalt des Aufklappbereichs und der technische Rückfall (§17). */
function fgRefV2RenderTechnik(d, st, box){
  if(!box) return;
  if(!d || d.ok===false){
    box.innerHTML='<div style="color:var(--k-dc2626,#dc2626);font-size:12.5px;padding:6px">'+esc((d&&d.fehler)||"Keine Daten.")+'</div>';
    return;
  }
  var el=Array.isArray(d.elemente)?d.elemente:[];
  if(!el.length){
    var gr=(d.blockierende_fehler||[]).map(function(b){ return esc((b&&b.befund)||""); }).filter(Boolean);
    box.innerHTML='<div style="padding:10px;font-size:12.5px;line-height:1.6;color:var(--muted)">'
      +'Für dieses Produkt gibt es noch <b>keine Parseranalyse</b>'
      +(d.rohtext?' mit Elementen':' – es ist kein Zutaten-Rohtext hinterlegt')+'.'
      +(gr.length?('<br><span style="color:#dc2626">'+gr.join(' · ')+'</span>'):'')
      +'<br>Die Riki-Referenz dieses Produkts zeigt die <b>klassische Ansicht</b> (Umschalter oben rechts).</div>';
    return;
  }
  var pzMap={}; (d.pruefzeilen||[]).forEach(function(p){ if(p&&p.Parser_Element_ID!=null) pzMap[p.Parser_Element_ID]=p; });
  /* Blocker-IDs aus der RPC: Baumfarben und Zaehler lesen DIESELBE Menge (§1.11i) */
  var blockMap={}; (d.blockierende_fehler||[]).forEach(function(b){ if(b&&b.id!=null) blockMap[b.id]=String(b.befund||b.art||"blockiert"); });
  var zus=d.zusammenfassung||{};
  var H=[];

  /* --- Kennzeichnung: technisch aktiv, fachlich offen --- */
  if(d.freigabe_status==="IMPORT_OFFEN"){
    H.push('<div style="margin-bottom:8px;padding:7px 9px;border:1px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:12px;font-weight:600">⚠ Technisch aktiv, fachliche Prüfung offen <span style="font-weight:400">(Freigabe-Status IMPORT_OFFEN)</span></div>');
  } else if(d.freigabe_status){
    H.push('<div style="margin-bottom:8px;font-size:11.5px;color:var(--muted)">Freigabe-Status: <b>'+esc(d.freigabe_status)+'</b></div>');
  }

  var pruefListe=(d.zu_pruefen||[]);
  var arts={}; pruefListe.forEach(function(z){ if(z) arts[z.art]=(arts[z.art]||0)+1; });
  function istBest(e){ var p=pzMap[e.id]; return !!(p&&(p.Manueller_Status==="BESTAETIGT"||p.Manueller_Status==="IGNORIERT")); }
  function istEb1(e){ return Number(e.ebene)!==2 && e.beziehung!=="quelle"; }
  var blocker=(d.blockierende_fehler||[]).length;
  var unsichere=(arts.unsicherer_vorschlag||0);
  var struktur=(arts.ohne_kategorie||0)+(arts.unbekannte_unterzutat||0);
  var unbHaupt=el.filter(function(e){ return istEb1(e)&&(e.zaehlt_als_hauptzutat===true||e.typ==="gruppe")&&!istBest(e)&&!blockMap[e.id]; }).length;
  var unbMikro=el.filter(function(e){ return e.typ==="mikronaehrstoff"&&!istBest(e)&&!blockMap[e.id]; }).length;
  var unbWirk=el.filter(function(e){ return e.typ==="wirkstoff"&&!istBest(e)&&!blockMap[e.id]; }).length;
  var entsch=(d.pruefzeilen||[]).length;
  var hzListe=el.filter(function(e){ return istEb1(e)&&e.zaehlt_als_hauptzutat===true; })
    .map(function(e){ return esc(e.name)+(e.typ==="gruppe"?' <span style="color:#1d4ed8">[Gruppe]</span>':''); });
  var nichtHzWirk=el.filter(function(e){ return istEb1(e)&&e.zaehlt_als_hauptzutat!==true&&e.typ==="wirkstoff"; })
    .map(function(e){ return esc(e.name); });
  var nMikroEb1=el.filter(function(e){ return istEb1(e)&&e.typ==="mikronaehrstoff"; }).length;
  H.push('<div style="margin-bottom:8px;padding:8px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);font-size:12px;line-height:1.65">'
    +'<details><summary style="cursor:pointer"><b>'+hzListe.length+' Hauptzutaten</b> (davon '+esc(zus.gruppen||0)+' Gruppen)'
    +' · '+esc(zus.unterzutaten||0)+' Unterzutaten · '+esc(zus.wirkstoffe||0)+' Wirk-/Mikronährstoffe · '+esc(zus.zusatzstoffe||0)+' Zusatzstoffe'
    +' <span style="color:var(--muted);font-weight:400">– aufklappen: welche zählen</span></summary>'
    +'<div style="margin:5px 0 3px 6px;font-size:11.5px;line-height:1.7">'+hzListe.join(' · ')+'</div>'
    +((nichtHzWirk.length||nMikroEb1)?('<div style="margin:0 0 3px 6px;font-size:11px;color:var(--muted)">In der Zutatenliste auf oberster Ebene, zählt aber bewusst NICHT als Hauptzutat: '
      +nichtHzWirk.map(function(n){return n+" (Wirkstoff)";}).join(' · ')
      +(nMikroEb1?((nichtHzWirk.length?' · ':'')+nMikroEb1+' Mikronährstoffe'):'')+'</div>'):'')
    +'</details>'
    +'<div style="margin-top:4px"><span style="color:'+(blocker?'#dc2626':'#166534')+';font-weight:700">'
    +(blocker?('⛔ '+blocker+' blockierende Fehler'):'✓ keine blockierenden Fehler')+'</span>'
    +(unsichere?(' · <span style="color:#b45309">'+unsichere+' unsichere Treffer</span>'):'')+'</div>'
    +'<div>Unbestätigt: <span style="color:#b45309">'+unbHaupt+' Hauptzutaten/Gruppen · '+unbMikro+' Mikronährstoffe · '+unbWirk+' Wirkstoffe</span></div>'
    +'<div style="color:var(--muted)">Strukturkontrolle (blockiert nichts): '+struktur+' Punkte – Unterzutaten ohne Stammtreffer oder Stammzutat ohne Kategorie</div>'
    +'<div style="margin-top:4px;color:var(--muted);font-size:11px">Parseranalyse: vorhanden ('+esc(d.parser_version||"?")+')'
    +' · Prüfentscheidungen: '+(entsch?(entsch+' von '+el.length+' erhoben'):'noch keine erhoben')
    +((d.veraltete_zeilen)?(' · '+d.veraltete_zeilen+' veraltet'):'')
    /* Zug 2: Erheben-Knopf inline in der vorhandenen Statuszeile (kein Layout-Eingriff) */
    +((!d.pruefzeilen_vorhanden||entsch===0||d.veraltete_zeilen)?(' · <button type="button" onclick="fgRefV2Erheben()" style="font-size:10.5px;padding:1px 8px;border:1px solid #c3ccf0;border-radius:6px;background:#eef1fb;color:#3b56b0;cursor:pointer">Prüfzeilen '+(entsch?'aktualisieren':'erheben')+'</button>'):'')
    +(st?(' · '+(st.pruefung_abschliessbar?'<span style="color:#166534;font-weight:700">Prüfung abschließbar</span>':'noch nicht abschließbar')):'')
    /* Zug 2 (#16): Abschluss-Knopf - der Server wiederholt ALLE Bedingungen (§1.13ll)
       und liefert bei Ablehnung die Gruende, die vollstaendig angezeigt werden. */
    +(st?(' · <button type="button" onclick="fgRefV2Abschliessen()" title="Serverseitige Prüfung aller Bedingungen – Ablehnungsgründe werden vollständig angezeigt" style="font-size:10.5px;padding:1px 8px;border:1px solid #bfe3cb;border-radius:6px;background:#e7f6ec;color:#1f7d43;cursor:pointer">Prüfung abschließen</button>'):'')
    +'</div></div>');
  if(st && Array.isArray(st.gruende) && st.gruende.length){
    H.push('<div style="margin-bottom:8px;font-size:11.5px;color:var(--muted)">Für die Freigabe offen: '+esc(st.gruende.join(" · "))+'</div>');
  }

  /* --- Originaletikett: vollständig, unverändert, kopierbar --- */
  H.push('<details style="margin-bottom:8px"><summary style="cursor:pointer;font-size:11.5px;color:var(--green);font-weight:700">Originaletikett'
    +' <span style="font-weight:400;color:var(--muted);text-transform:none">– '+esc(d.rohtext_quelle||"")+'</span></summary>'
    +'<textarea id="fe_refV2Roh" readonly style="width:100%;box-sizing:border-box;margin-top:6px;height:150px;padding:6px;border:1px solid var(--line);border-radius:8px;font-size:11.5px;line-height:1.45;background:var(--k-f6f8f7,#f6f8f7);color:var(--ink);resize:vertical">'+esc(d.rohtext||"")+'</textarea>'
    +'<button type="button" onclick="fgRefV2Kopieren()" style="margin-top:5px;padding:4px 10px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--ink);cursor:pointer;font-size:11.5px">Kopieren</button>'
    +'<button type="button" id="fe_refV2RohBtn" onclick="fgRefV2RohGross()" style="margin-top:5px;margin-left:6px;padding:4px 10px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--ink);cursor:pointer;font-size:11.5px">Ganz anzeigen</button>'
    +((d.rohtext_zusammengesetzt)?'<div style="margin-top:5px;font-size:11px;color:#b45309">⚠ Keine Originalfassung – aus Einzelangaben zusammengesetzt. Reihenfolge und Gruppierung können abweichen.</div>':'')
    +'</details>');

  /* --- Baum --- */
  var kinder={}; el.forEach(function(e){ if(e.parent_id!=null){ (kinder[e.parent_id]=kinder[e.parent_id]||[]).push(e); } });
  function zeile(e, tief, parentEl){
    var f=_fgRefV2Farbe(e, pzMap[e.id], {blocker:blockMap, parent:parentEl,
      parentBest: parentEl?istBest(parentEl):false});
    var pz=pzMap[e.id];
    var kandidaten=(e.kandidaten||[]).map(function(k){ return esc(k.zutat)+" ("+String(k.aehnlichkeit).slice(0,4)+", "+esc(k.art)+")"; }).join(" · ");
    var akt='';
    if(pz){
      var stM=String(pz.Manueller_Status||'OFFEN');
      var kein_haken=(function(){ var s=String(e.status||''); return s==='MEHRDEUTIG'||s==='FRAGMENT'||s==='KLAMMER_FEHLER'||s==='FALSCH_ZERLEGT'||s==='HERSTELLERANGABE_UNVOLLSTAENDIG'; })();
      akt='<span style="float:right;white-space:nowrap;margin-left:6px">'
        +((stM==='OFFEN'&&!kein_haken)?'<button type="button" onclick="fgRefV2Schnell('+e.id+')" title="Zuordnung bestätigen (wie erkannt)" style="font-size:10.5px;padding:0 6px;border:1px solid #bfe3cb;border-radius:6px;background:#e7f6ec;color:#1f7d43;cursor:pointer;line-height:1.5">✓</button>':'')
        +'<button type="button" onclick="fgRefV2Menu(event,'+e.id+')" title="Aktionen (Kandidat, Typ, Parent, Ablehnen, Ignorieren, Kommentar, Widerruf)" style="font-size:10.5px;padding:0 6px;margin-left:3px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);cursor:pointer;line-height:1.5">⋯</button>'
        +'</span>';
    }
    return '<div style="margin-left:'+(tief*16)+'px;margin-bottom:3px;padding:5px 8px;border-left:3px solid '+f.c+';border-radius:6px;background:'+f.bg+';font-size:12px;line-height:1.45">'
      +akt
      +(tief?'<span style="color:var(--muted)">└─ </span>':'')
      +'<b style="color:'+f.c+'">'+esc(e.name||"")+'</b>'
      +(e.anteil_prozent!=null?(' <span style="color:var(--muted)">'+esc(e.anteil_prozent)+' %</span>'):'')
      +' <span style="font-size:10.5px;color:var(--muted)">'+esc(_fgRefV2TypLabel(e))+'</span>'
      +(e.beziehung_klartext?(' <span style="font-size:10.5px;color:#1d4ed8">· '+esc(e.beziehung_klartext)+'</span>'):'')
      +(e.naehrstoff?(' <span style="font-size:10.5px;color:#1d4ed8">· zählt als '+esc(e.naehrstoff)+'</span>'):'')
      +(e.e_nummer?(' <span style="font-size:10.5px;color:#1d4ed8">· '+esc(e.e_nummer)+'</span>'):'')
      +'<br><span style="font-size:10.5px;color:var(--muted)">'+esc(f.t)
      +(e.stammname?(' · Stamm: '+esc(e.stammname)+(e.note!=null?(' ('+esc(e.note)+')'):'')):'')
      +((e.db_gebunden===false&&e.zutat_id&&!(Number(e.ebene)===2||e.beziehung==="quelle"))?' · <span style="color:#dc2626">nicht gebunden</span>':'')
      +((e.db_gebunden===true&&(Number(e.ebene)===2||e.beziehung==="quelle"))?' · <span style="color:#b45309">⚠ Steht doppelt drin – einmal hier, einmal als eigene Zutat. Sag Bescheid, ich räume es auf</span>':'')
      +(pz&&pz.Manueller_Status&&pz.Manueller_Status!=="OFFEN"?(' · <b>'+esc(pz.Manueller_Status)+'</b>'+(pz.Entschieden_Von?(' von '+esc(pz.Entschieden_Von)):'')):'')
      +'</span>'
      +(kandidaten?('<br><span style="font-size:10.5px;color:#b45309">Kandidaten: '+kandidaten+'</span>'):'')
      +'</div>';
  }
  var baum=[];
  el.filter(function(e){ return e.parent_id==null; }).forEach(function(e){
    baum.push(zeile(e,0,null));
    (kinder[e.id]||[]).forEach(function(k){ baum.push(zeile(k,1,e)); });
  });
  H.push('<div>'+(baum.length?baum.join(""):'<span style="color:var(--muted);font-size:12.5px">Keine Elemente.</span>')+'</div>');

  /* --- Legende --- */
  H.push('<div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center;font-size:10.5px;color:var(--muted);margin-top:8px;line-height:1.35">'
    +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#166534;vertical-align:middle;margin-right:4px"></span>bestätigt</span>'
    +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#b45309;vertical-align:middle;margin-right:4px"></span>zu bestätigen</span>'
    +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#dc2626;vertical-align:middle;margin-right:4px"></span>blockierend</span>'
    +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#1d4ed8;vertical-align:middle;margin-right:4px"></span>Nebenrolle – über Parent abgedeckt bzw. Wirk-/Mikronährstoff</span>'
    +'<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#94a3b8;vertical-align:middle;margin-right:4px"></span>Hinweis</span>'
    +'<span style="margin-left:auto">Entscheidungen ändern nur die Prüftabelle – Bindungen bleiben unberührt</span></div>');

  box.innerHTML=H.join("");
}
if(typeof window!=='undefined'){
  window.fgRefV2An=fgRefV2An; window.fgRefV2Set=fgRefV2Set; window.fgRefV2Umschalten=fgRefV2Umschalten;
  window.fgRefV2Init=fgRefV2Init; window.fgRefV2Laden=fgRefV2Laden; window.fgRefV2Render=fgRefV2Render;
  window.fgRefV2Kopieren=fgRefV2Kopieren; window.fgRefV2Anzeigen=fgRefV2Anzeigen;
  window.fgRefV2RohGross=fgRefV2RohGross;
  /* Zug 2 */
  window.fgRefV2Erheben=fgRefV2Erheben; window.fgRefV2Aktion=fgRefV2Aktion;
  window.fgRefV2Widerruf=fgRefV2Widerruf; window.fgRefV2Abschliessen=fgRefV2Abschliessen;
  window.fgRefV2Schnell=fgRefV2Schnell; window.fgRefV2KandWahl=fgRefV2KandWahl;
  
  
  window.fgRefV2Ablehnen=fgRefV2Ablehnen; window.fgRefV2Ignorieren=fgRefV2Ignorieren;
  window.fgRefV2KommentarFeld=fgRefV2KommentarFeld; window.fgRefV2KommentarSenden=fgRefV2KommentarSenden;
  window.fgRefV2Menu=fgRefV2Menu; window.fgRefV2MenuZu=fgRefV2MenuZu; window.fgRefV2Ergebnis=fgRefV2Ergebnis;
  window.fgRefV2NachNeuanlage=fgRefV2NachNeuanlage;
}

/* ══════════════════════════════════════════════════════════════════════════
   29.08.2026, RALPH: "produkte wir wir obsolet setzten wollten, sind immer
   noch da." Er meinte die Huellzeile "Teigwaren", die rechts in der Referenz
   weiterstand, obwohl der Server sie stillgelegt hat.
   Die Referenzliste wird beim Oeffnen aus den gebundenen Zutatennamen
   vorbelegt (d.zutaten) - dort steht die Huelle mit drin, denn sie IST eine
   gebundene Zutat. Erst _fgCanon weiss, welche davon Huelle ist
   (score_leaf===false vom Server). Die Anzeige fragt das jetzt ab.
   Ist _fgCanon noch nicht geladen, wird NICHTS gefiltert - eine fehlende
   Antwort darf keine Zeile verschwinden lassen.
   ══════════════════════════════════════════════════════════════════════════ */
function _fgIstHuellenName(raw){
  var rows=window._fgCanon;
  if(!Array.isArray(rows)||!rows.length) return false;
  var k=String(raw||"").trim().toLowerCase();
  if(!k) return false;
  return rows.some(function(z){
    if(!z || z.score_leaf!==false) return false;
    return String(z.sichtbarer_name||"").trim().toLowerCase()===k
        || String(z.canonical_name||"").trim().toLowerCase()===k;
  });
}
if(typeof window!=="undefined"){ window._fgIstHuellenName=_fgIstHuellenName; }
function fgEnthaltenRender(){
  var box=document.getElementById("fe_enthalten"); if(!box) return;
  /* 🔴 10.09.2026, RALPH: "und noch nicht geprüft ist auch noch da."
     Richtig - die gespiegelte Liste, die ich abgeschaltet hatte, war die der
     Referenz V2. Er stand auf der KLASSISCHEN Ansicht, und die hat ihre eigene.
     Beide Ansichten zeigen jetzt dieselbe kurze Karte. Der alte Aufbau steht
     darunter unveraendert weiter, fuer den Fall dass FE_REF_KURZ zurueckgestellt wird. */
  if(FE_REF_KURZ){
    var w=window._fgRefV2||{};
    if(w.d){ try{ fgRefV2RenderKurz(w.d, w.st, box); return; }catch(eK){ console.error("[Etikett] Kurzkarte:", eK); } }
    else {
      box.innerHTML='<div style="padding:10px;font-size:12.5px;color:var(--muted)">Etikett wird geladen …</div>';
      try{ if(typeof fgRefV2Laden==="function") fgRefV2Laden(); }catch(eL){ console.error("[Etikett] Laden:", eL); }
      return;
    }
  }
  var ref=(window._fgRef&&window._fgRef.length)?window._fgRef:[];
  ref=ref.filter(function(n){ return !_fgIstHuellenName(n); });
  if(!ref.length){ box.innerHTML='<span style="color:var(--muted);font-size:12.5px">Noch keine Referenz – lass Riki die <b>Herstellerseite</b> oder das <b>Etikett</b> lesen (oder die Zutatenliste analysieren).</span>'; return; }
  var work=_fgWorkSet(); var zk=_fgZusKeys();
  var _gel=window._fgRefGelesen||null;
  var _istGelesen=function(raw){ return !_gel || !!_gel[String(raw).trim().toLowerCase()]; };
  var html=ref.map(function(nm){
    var raw=String(nm).trim(); var low=raw.toLowerCase();
    if((typeof ZUS_FUNKTION!=="undefined" && ZUS_FUNKTION[low]) || _zusIstLeer(raw)) return "";   /* Funktionswort (Antioxidationsmittel, Stabilisator …) → keine Substanz, nicht anzeigen */
    var _st=_fgRefStatus(raw, work, zk);
    var inList=_st.inList, asZusatz=_st.asZusatz, isZus=_st.isZus, unklar=_st.unklar;
    var chip='<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;margin-right:6px;flex:0 0 auto;background:'+(isZus?"#ede9fe;color:#5b21b6":"#e0f2fe;color:#075985")+'">'+(isZus?"Zusatzstoff":"Zutat")+'</span>';
    var tag = !inList ? ' <span style="font-size:11px;opacity:.85">– noch nicht übernommen</span>'
            : (unklar ? ' <span style="font-size:11px;font-weight:700">– erfasst, aber nicht eingestuft</span><span style="font-size:11px;opacity:.85"> · kein Index</span>'
            : (asZusatz ? ' <span style="font-size:11px;opacity:.85">– als Zusatzstoff erfasst</span>' : ''));
    /* ══════════════════════════════════════════════════════════════════════
       29.08.2026, RALPH: "wenn sie vorbelegt und grün sind, suggeriert das
       etwas anderes. zudem hat riki nichts gelesen laut text. das heisst, ich
       muss immer den text lesen und unten ist alles grün."
       Er hat recht. Gruen mit Haken heisst in dieser Oberflaeche ueberall
       "geprueft und in Ordnung". Eine VORBELEGTE Zeile ist aber nichts
       geprueft: sie stammt aus denselben gebundenen Zutaten, gegen die sie
       angeblich prueft. Der Vergleich haette immer 100 % ergeben.
       Die Farbe hing bisher nur an "steht die Zeile in der Liste" - ob sie
       gelesen oder vorbelegt war, stand nur klein daneben. Jetzt entscheidet
       zuerst die HERKUNFT: vorbelegt ist grau und traegt kein Haekchen.
       Gruen gibt es erst, wenn Riki wirklich etwas gelesen hat.
       ══════════════════════════════════════════════════════════════════════ */
    var _gelesen = _istGelesen(raw);
    if(!_gelesen) tag += ' <span style="font-size:10.5px;font-weight:700" title="Diese Zeile stammt aus den bereits gebundenen Zutaten, nicht aus einer gelesenen Quelle. Sie beweist nichts.">· nicht geprüft</span>';
    var _bg = !_gelesen ? "#f1f5f9" : (!inList ? "#fbf3e2" : (unklar ? "#f1f4f8" : "#e7f6ec"));
    var _fg = !_gelesen ? "#64748b" : (!inList ? "#8a5a0b" : (unklar ? "#475569" : "#1f7d43"));
    var _br = (!_gelesen || unklar) ? ";border:1px dashed #94a3b8" : "";
    var _ic = !_gelesen ? "·" : (!inList ? "○" : (unklar ? "⚠" : "✓"));
    return '<div onclick="fgRefFokus(this)" data-name="'+esc(raw)+'" title="anklicken: rechts danach suchen" '
      +'style="display:flex;align-items:center;gap:6px;padding:3px 6px 3px 8px;border-radius:6px;margin-bottom:3px;cursor:pointer;background:'+_bg+';color:'+_fg+_br+'">'
      +chip
      +'<span style="flex:1;min-width:0">'+_ic+" "+esc(raw)+tag+'</span>'
      +'<button onclick="fgEnthaltenDel(this)" data-name="'+esc(raw)+'" title="aus der Referenz entfernen (z. B. Riki-Fehllesung)" style="border:0;background:transparent;color:#b91c1c;cursor:pointer;font-size:15px;line-height:1;padding:0 3px;flex:0 0 auto">✕</button>'
      +'</div>';
  }).filter(Boolean).join("");
  /* 28d (Mockup B "Die Referenz fuehrt"): Fortschritts-Kopf ueber der Arbeitsliste - wie viele
     Referenz-Eintraege sind schon sauber uebernommen, wie viele offen, wie viele blockieren den
     Index. Die REIHENFOLGE der Zeilen bleibt die des Etiketts (sie traegt Information: Zutaten
     stehen nach Menge sortiert) - deshalb wird NICHT umsortiert, nur gezaehlt. Zaehlt auch die
     offenen Riki-Mikro-Vorschlaege mit und verweist auf die Mikro-Karte - die UEBERNAHME
     bleibt dort (eine Stelle, ein Weg, par. 1.11i). */
  var _cnt={done:0,offen:0,unklar:0}, _vorbelegt=0;
  ref.forEach(function(nm){ var raw=String(nm).trim();
    if((typeof ZUS_FUNKTION!=="undefined" && ZUS_FUNKTION[raw.toLowerCase()]) || _zusIstLeer(raw)) return;
    if(!_istGelesen(raw)){ _vorbelegt++; return; }
    var s=_fgRefStatus(raw, work, zk);
    if(!s.inList) _cnt.offen++; else if(s.unklar) _cnt.unklar++; else _cnt.done++;
  });
  var _tot=_cnt.done+_cnt.offen+_cnt.unklar;
  var _mv=(window._fmVorschlag||[]).length;
  try{ if(typeof feTabBadgeUpdate==='function') feTabBadgeUpdate(_cnt.offen+_cnt.unklar+_mv, _cnt.done); }catch(e){}   /* 28l/28r: Zaehler am Reiter - offen ODER uebernommen, gleiche Zaehlung wie hier */
  var kopf="";
  if(!_tot && _vorbelegt){
    /* 29.08.2026, RALPH: "ich muss immer den text lesen und unten ist alles
       gruen." Der Kasten stand hier in fuenf Zeilen Fliesstext und erklaerte,
       was die Liste darunter durch ihre Farbe widerlegte. Jetzt sagt die Liste
       es selbst (grau, kein Haken), und der Kopf ist ein Satz plus Knopf. */
    kopf='<div style="margin-bottom:7px;padding:7px 9px;border:1px dashed var(--line);border-radius:8px;'
      +'font-size:12px;line-height:1.5;background:#f1f5f9;display:flex;align-items:center;gap:9px;flex-wrap:wrap">'
      +'<b style="color:var(--ink)">Noch nichts gepr\u00fcft.</b>'
      +'<span style="color:var(--muted)">Die '+_vorbelegt+' Zeile'+(_vorbelegt===1?'':'n')+' unten stammen aus den erfassten Zutaten selbst.</span>'
      +'<span style="color:var(--muted);font-size:11px">Riki das Etikett oder die Herstellerseite lesen lassen \u2013 dann z\u00e4hlt hier etwas.</span>'
      +'</div>';
  }
  else if(_tot||_mv){
    var pct=_tot?Math.round(100*_cnt.done/_tot):0;
    kopf='<div style="margin-bottom:7px">'
      +'<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;margin-bottom:4px;flex-wrap:wrap">'
      +'<b style="color:var(--ink)">'+_cnt.done+' von '+_tot+' \u00fcbernommen</b>'
      +(_vorbelegt?'<span style="color:var(--muted)" title="aus den gebundenen Zutaten vorbelegt \u2013 z\u00e4hlt nicht mit, weil sie aus derselben Quelle stammen">+ '+_vorbelegt+' vorbelegt</span>':'')
      +(_cnt.offen?'<span style="color:#8a5a0b">\u25cb '+_cnt.offen+' offen</span>':'')
      +(_cnt.unklar?'<span style="color:#475569">\u26a0 '+_cnt.unklar+' nicht eingestuft \u00b7 kein Index</span>':'')
      +(_mv?'<span onclick="try{var b=document.getElementById(\'fm_mikroVorschlag\');if(b)b.scrollIntoView({behavior:\'smooth\',block:\'center\'});}catch(e){}" style="color:#5b21b6;cursor:pointer" title="zur Mikron\u00e4hrstoff-Karte">\ud83e\udd16 '+_mv+' Mikro-Vorschl'+(_mv>1?'\u00e4ge':'ag')+' offen \u2192</span>':'')
      +'</div>'
      +(_tot?'<div style="height:6px;border-radius:99px;background:#e8edf2;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct===100?'#2e9e57':'#e0a32e')+'"></div></div>':'')
      +'</div>';
  }
  box.innerHTML = kopf + (html || '<span style="color:#1f7d43;font-size:12.5px">✓ Alles vom Etikett ist erfasst – als Zutat oder als Zusatzstoff.</span>');
}
function _fgAbweichungRef(){
  var ref=(window._fgRef&&window._fgRef.length)?window._fgRef:[];
  if(!ref.length) return [];
  var work=_fgWorkSet(); var zk=_fgZusKeys(); var out=[];
  ref.forEach(function(nm){
    var raw=String(nm).trim(); var low=raw.toLowerCase();
    if((typeof ZUS_FUNKTION!=="undefined" && ZUS_FUNKTION[low]) || _zusIstLeer(raw)) return;    
    var inList=_fgRefStatus(raw, work, zk).inList;
    if(!inList) out.push(raw);
  });
  return out;
}
function _refIstLeer(k){ var s=String(k||"").replace(/[()]/g,"").trim().toLowerCase();
  return s===""||s==="keine"||s==="kein"||s==="keiner"||s==="keine zutaten"||s==="keine zusatzstoffe"||s==="none"||s==="-"||s==="–"||s==="n/a"; }
function fgRefSet(names, opt){
  var seen={}, out=[], eIdx={};
  var _gelSet=null;
  if(opt && Object.prototype.hasOwnProperty.call(opt,'gelesen')){
    _gelSet={};
    (opt.gelesen||[]).forEach(function(n){ var k=String(n||"").trim().toLowerCase(); if(k) _gelSet[k]=1; });
  }
  (names||[]).forEach(function(n){ n=String(n||"").trim(); if(!n) return; var k=n.toLowerCase();
    if(typeof ZUS_FUNKTION!=="undefined" && ZUS_FUNKTION[k]) return;   /* reines Funktionswort → nicht in die Referenz */
    if(_refIstLeer(k)||_zusIstLeer(n)) return;   /* „keine"/Statuswort → nie in die Referenz */
    if(seen[k]) return; seen[k]=1;
    var _np=k.replace(/\([^)]*\)/g,"").replace(/\s+/g," ").trim();
    var _em=n.match(/\bE\s?\d{3,4}[a-z]?\b/i);
    var _e=_em?_em[0].replace(/\s/g,"").toUpperCase():((typeof ZUS_SYN!=="undefined"&&(ZUS_SYN[k]||ZUS_SYN[_np]))?String(ZUS_SYN[k]||ZUS_SYN[_np]).toUpperCase():null);
    var _bare=/^e\s?\d{3,4}[a-z]?$/.test(k.replace(/\s/g,""));
    if(_e){ if(eIdx[_e]!==undefined){ if(eIdx[_e].bare && !_bare){ out[eIdx[_e].i]=n; eIdx[_e].bare=false; } return; } eIdx[_e]={i:out.length, bare:_bare}; }
    out.push(n); });
  window._fgRef=out;
  /* Herkunftskarte zur Liste: welcher Eintrag ist GELESEN, welcher nur vorbelegt.
     Ohne opt ist alles gelesen - so verhalten sich alle bestehenden Riki-Aufrufe unveraendert. */
  var _gel={};
  out.forEach(function(n){ var k=String(n).trim().toLowerCase();
    if(!_gelSet || _gelSet[k]) _gel[k]=1; });
  window._fgRefGelesen=_gel;
  try{ var _pid=(window._fgEdit&&window._fgEdit.id); if(_pid){
    window._fgRefMap=window._fgRefMap||{}; window._fgRefMap[_pid]=out.slice();
    /* Die Herkunft muss dasselbe ueberleben wie die Liste - sonst gilt nach dem
       Speichern wieder alles als vorbelegt und der Balken verstummt zu Unrecht. */
    window._fgRefGelesenMap=window._fgRefGelesenMap||{};
    window._fgRefGelesenMap[_pid]=Object.keys(_gel);
  } }catch(e){}
  try{ fgEnthaltenRender(); }catch(e){}
}
function fgFlattenZutaten(raw){
  var t=String(raw||""); if(!t.trim()) return [];
  /* „Zutaten:"/„Ingredients:" vorne abschneiden, Spuren-/Allergiehinweis hinten abtrennen. */
  t=t.replace(/^[\s\S]*?\b(?:zutaten|ingredients|composition)\b\s*:?/i,"");
  t=t.split(/\bkann\b[\s\S]{0,60}?enth[aä]lt|enth[aä]lt\s+spuren|\bspuren\s+von\b|may\s+contain|traces\s+of/i)[0];
  t=t.replace(/(\d)\s*,\s*(\d)/g,"$1.$2");
  /* Klammern = weitere kommagetrennte Unter-Zutaten → in Kommata wandeln (auch verschachtelt). */
  t=t.replace(/[()\[\]]/g,",");
  return t.split(/[,;]/).map(function(s){
    return String(s||"")
      .replace(/^\s*[\d.,]+\s*%\s*/,"")     /* führende Prozentangabe */
      .replace(/\b[\d.,]+\s*%/g,"")          /* eingebettete Prozentangabe */
      .replace(/\s+[\d.,]+\s*$/,"")          /* nackte Zahl am Ende (Rest einer Mengenangabe) */
      .replace(/^\s*(?:davon|inkl\.?|und|sowie)\s+/i,"")
      .replace(/[*.]/g,"")
      .replace(/\s+/g," ").trim();
  }).filter(function(s){
    if(!s || s.length<2) return false;
    if(/^[\d.,%\s]+$/.test(s)) return false;         /* reine Zahlen */
    if(/^aus\b/i.test(s)) return false;              /* Herkunftsnotiz „aus biologischem Anbau" */
    if(/^(?:enth[aä]lt|contains|mit)\b/i.test(s)) return false;
    return true;
  });
}
function fgFlattenZus(raw){
  var t=String(raw||"").trim();
  if(!t || (typeof _zusIstLeer==="function" && _zusIstLeer(t))) return [];
  /* Vor dem Trennen aufraeumen: ein abgeschnittener Katalogname laesst eine Klammer OFFEN
     ("… (Sodium hydroge… (E500)"). _zusSplitTop zaehlt dann dauerhaft depth>0 und trennt ab da
     nicht mehr - aus sechs Stoffen wurden drei. Klammern ohne E-Nummer tragen ohnehin keine
     Information, die wir brauchen. */
  for(var _r=0;_r<6;_r++){
    var _vor=t;
    t=t.replace(/\(([^()]*)\)/g, function(m,inner){ return /\bE\s?\d{3,4}[a-z]?\b/i.test(inner)?m:" "; });
    if(t===_vor) break;
  }
  t=t.replace(/\((?![^()]*\))[^()]*/g," ");   /* offene Klammer ohne Schluss */
  t=t.replace(/…/g," ").replace(/\s+/g," ").trim();
  var out=[], seen={};
  _zusSplitTop(t).forEach(function(tok){
    tok=String(tok||"").replace(/\s+/g," ").trim();
    if(!tok || _zusIstLeer(tok)) return;
    var em=tok.match(/\bE\s?\d{3,4}[a-z]?\b/i);
    var eNr=em?em[0].replace(/\s/g,"").toUpperCase():null;
    var st=null;
    if(eNr && typeof ZUSATZSTOFFE_MAP!=="undefined") st=ZUSATZSTOFFE_MAP[eNr.toLowerCase()]||null;
    if(!st){
      var ohne=(typeof _zusOhneFunktionswort==="function")?_zusOhneFunktionswort(tok):tok.toLowerCase();
      if(typeof ZUSATZSTOFFE_MAP!=="undefined") st=ZUSATZSTOFFE_MAP[ohne]||null;
      if(!st && typeof ZUS_SYN!=="undefined" && ZUS_SYN[ohne]) st=ZUSATZSTOFFE_MAP[String(ZUS_SYN[ohne]).toLowerCase()]||null;
      if(!st && typeof _zusFindStamm==="function") st=_zusFindStamm(ohne);
      if(st && !eNr) eNr=String(st.e||"").toUpperCase()||null;
    }
    var name;
    if(st) name=(st.name_de||st.name||"");
    else {
      /* nicht aufloesbar: Klammern und das Abschneide-Zeichen weg, Rest stehen lassen (nichts erfinden) */
      name=tok.replace(/\([^)]*\)/g," ").replace(/…/g,"").replace(/:\s*$/,"").replace(/\s+/g," ").trim();
      if(!name) name=tok;
    }
    var key=String(eNr||name).toLowerCase();
    if(seen[key]) return; seen[key]=1;
    out.push(name+(eNr?(" ("+eNr+")"):""));
  });
  return out;
}
/* Referenz aus der rohen Etikett-Liste (bevorzugt) – fällt auf Rikis Namensliste zurück,
   wenn kein Rohtext da ist. EIN Weg für alle Riki-Pfade (Analyse/Herstellerseite/Etikett/OFF). */
function fgRefFromLabel(rawText, fallbackNames){
  var flat=fgFlattenZutaten(rawText);
  if(flat.length) fgRefSet(flat); else fgRefSet(fallbackNames||[]);
}
/* ✕ in der Referenz: entfernt den Eintrag aus der Referenz UND – falls vorhanden – aus der
   Arbeitsliste (#fe_zutRows), damit z. B. eine Riki-Fehllesung „gegarter Reis" komplett weg ist. */
function fgEnthaltenDel(btn){
  var name=(btn&&btn.dataset&&btn.dataset.name!=null)?String(btn.dataset.name):""; if(!name) return;
  var key=name.trim().toLowerCase();
  if(Array.isArray(window._fgRef)) window._fgRef=window._fgRef.filter(function(n){ return String(n).trim().toLowerCase()!==key; });
  try{ var _pid=(window._fgEdit&&window._fgEdit.id); if(_pid&&window._fgRefMap) window._fgRefMap[_pid]=(window._fgRef||[]).slice(); }catch(e){}
  var c=document.getElementById("fe_zutRows");
  if(c)[].forEach.call(c.querySelectorAll(".fgZutRow"),function(r){
    if(((r.querySelector(".fgzName")||{}).value||"").trim().toLowerCase()===key){
      var inf=r.nextElementSibling; if(inf&&inf.classList&&inf.classList.contains("fgRikiInfo")) inf.remove(); r.remove();
    }
  });
  try{ fgEnthaltenRender(); }catch(e){}
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
}
function fgRefAdd(){
  var inp=document.getElementById("fe_refNeu"); if(!inp) return;
  var v=(inp.value||"").trim(); if(!v) return;
  if(_refIstLeer(v)){ inp.value=""; return; }   /* „keine" o. Ä. nicht in die Referenz */
  window._fgRef=window._fgRef||[];
  var low=v.toLowerCase();
  if(!window._fgRef.some(function(n){ return String(n).trim().toLowerCase()===low; })) window._fgRef.push(v);
  try{ var _pid=(window._fgEdit&&window._fgEdit.id); if(_pid){ window._fgRefMap=window._fgRefMap||{}; window._fgRefMap[_pid]=window._fgRef.slice(); } }catch(e){}
  inp.value="";
  try{ fgEnthaltenRender(); }catch(e){}
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
}
if(typeof window!=='undefined'){ window.fgRefAdd=fgRefAdd; }
function fgPickObserve(){
  try{ if(window._fgPickObs) window._fgPickObs.disconnect(); }catch(e){}
  var c=document.getElementById("fe_zutRows"); if(!c||typeof MutationObserver==="undefined") return;
  window._fgPickObs=new MutationObserver(function(){ if(window._fgPickRaf) return; window._fgPickRaf=requestAnimationFrame(function(){ window._fgPickRaf=0; try{ fgEnthaltenRender(); fgPickRender(); }catch(e){} }); });
  window._fgPickObs.observe(c,{childList:true,subtree:true});
}
/* ---- OFF-Gegenprobe: Zutatenliste per EAN aus Open Food Facts holen ----
   NUR Vorschlag: OFF ist community-gepflegt und kennt Nischenprodukte oft nicht.
   Nichts wird automatisch uebernommen/ueberschrieben - der Admin klickt je Zutat. */
function fgSplitZutaten(t){
  t=(t||'').replace(/^\s*zutaten\s*:?/i,'');
  var out=[],depth=0,cur='';
  for(var i=0;i<t.length;i++){ var c=t[i];
    if(c==='('||c==='[')depth++; else if(c===')'||c===']')depth=Math.max(0,depth-1);
    var sep=(c===','||c===';')&&depth===0;
    /* Dezimalkomma (Ziffer,Ziffer) ist KEIN Trenner: "0,1%" bleibt zusammen. */
    if(c===',' && /\d/.test(t[i-1]||'') && /\d/.test(t[i+1]||'')) sep=false;
    if(sep){ out.push(cur); cur=''; } else cur+=c; }
  if(cur.trim())out.push(cur);
  return out.map(function(s){ return s
      .replace(/\s+-\s+/g,'')                 /* Zeilenumbruch-Trennstriche joinen: "Reis - stärke" -> "Reisstärke" */
      .replace(/^\s*(süßungsmittel|stabilisator(?:en)?|emulgator(?:en)?|farbstoffe?|säuerungsmittel|konservierungsstoffe?|antioxidationsmittel|verdickungsmittel|geliermittel|trennmittel|geschmacksverst[aä]rker|s[aä]ureregulator)\s*:\s*/i,'')  /* Funktionsklasse weg: "Süßungsmittel: Sucralose" -> "Sucralose" */
      .replace(/[*_]+/g,'')
      .replace(/\s*[\d.,]+\s*%/g,'')           /* Prozentangaben (auch "0,1%") entfernen */
      .replace(/\s+/g,' ')
      .replace(/[.,;:\s]+$/,'')                /* Satzzeichen am Ende ("Laktase." -> "Laktase") */
      .trim(); })
      .filter(function(s){ return s && s.length>1 && !/^(davon|kann spuren|enth[aä]lt|hergestellt)/i.test(s); });
}
async function fgOffZutaten(){
  var box=document.getElementById('fgOffBox'); if(!box) return;
  var ean=(((document.getElementById('fe_ean')||{}).value)||'').replace(/\D/g,'');
  if(ean.length<8){ box.innerHTML='<span style="color:var(--k-b45309);font-size:12.5px">Erst eine gültige EAN eintragen.</span>'; return; }
  box.innerHTML='<span style="color:var(--muted);font-size:12.5px">Open Food Facts wird abgefragt…</span>';
  try{
    /* Direkt bei OFF holen (CORS erlaubt), damit wir die Rohfelder selbst auswerten. */
    var r=await fetch('https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(ean)+'.json?fields=product_name,product_name_de,brands,ingredients_text_de,ingredients_text',{headers:{'Accept':'application/json'}});
    var j=await r.json();
    var p=(j&&j.status===1)?j.product:null;
    if(!p){ box.innerHTML='<span style="color:var(--k-b45309);font-size:12.5px">OFF kennt diese EAN nicht – normal bei Nischenprodukten. Dann über Etikett/Riki.</span>'; return; }
    var d={ name:(p.product_name_de||p.product_name||''), marke:(p.brands||'') };
    /* WICHTIG: || statt ?? – OFF hat bei deutschen Produkten oft ingredients_text_de="" (leer),
       die Liste steht dann nur in ingredients_text. Mit ?? ginge sie verloren. */
    var ztext=(p.ingredients_text_de||p.ingredients_text||'').trim();
    if(!ztext){ box.innerHTML='<span style="color:var(--k-b45309);font-size:12.5px">OFF hat „'+esc(d.name||'?')+'", aber keine Zutatenliste hinterlegt. Dann über Etikett/Riki.</span>'; return; }
    var parts=fgSplitZutaten(ztext);
    if(!parts.length){ box.innerHTML='<span style="color:var(--k-b45309);font-size:12.5px">OFF-Zutatenliste nicht auswertbar.</span>'; return; }
    var rows=parts.map(function(nm){
      var m=ZUTATEN_MAP[nm.trim().toLowerCase()];
      var badge=m?('<span style="flex:0 0 auto;color:var(--k-166534);font-weight:700">Stamm '+m.rating+'</span>'):'<span style="flex:0 0 auto;color:var(--k-b45309)">neu</span>';
      var safe=nm.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<div style="display:flex;gap:7px;align-items:center;margin:3px 0;font-size:12.5px">'
        +'<button type="button" onclick="fgOffUebernehmen(this,\''+safe+'\')" style="flex:0 0 auto;border:1px solid var(--k-16a34a);background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);border-radius:7px;padding:3px 9px;cursor:pointer;font-size:11.5px">+ übernehmen</button>'
        +'<span style="flex:1;min-width:0">'+esc(nm)+'</span>'+badge+'</div>';
    }).join('');
    var offLabel=esc(d.name||'?')+(d.marke?(' · '+esc(d.marke)):'');
    var mism=fgNameMismatch((((document.getElementById('fe_name')||{}).value)||''), d.name, d.marke);
    var kopf = mism
      ? '<div style="color:var(--k-b91c1c);font-weight:700;font-size:12px;margin-bottom:6px;line-height:1.4">⚠️ OFF-Produkt weicht ab – evtl. falscher Barcode:<br>OFF: '+offLabel+'</div>'
      : '<div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">OFF-Produkt: <b style="color:var(--ink)">'+offLabel+'</b></div>';
    box.innerHTML='<div style="border:1px solid var(--line);border-left:3px solid '+(mism?'var(--k-b91c1c)':'var(--k-2e7d32)')+';border-radius:8px;padding:9px 11px;background:var(--k-f2f5f3)">'
      +kopf
      +'<div style="font-size:11.5px;color:var(--muted);margin-bottom:6px"><b>OFF-Gegenprobe</b> · '+parts.length+' Zutaten · community-gepflegt, gegen das Etikett prüfen. '
      +'<button type="button" onclick="fgOffAlle()" style="border:0;background:transparent;color:var(--k-534ab7);cursor:pointer;font-size:11.5px;text-decoration:underline;padding:0">alle übernehmen</button></div>'
      +rows+'</div>';
  }catch(e){ box.innerHTML='<span style="color:var(--k-dc2626);font-size:12.5px">Abruf fehlgeschlagen: '+esc(e.message)+'</span>'; }
}
function fgOffUebernehmen(btn,name){
  var c=document.getElementById('fe_zutRows'); if(!c) return;
  var exists=[].some.call(c.querySelectorAll('.fgzName'),function(i){ return (i.value||'').trim().toLowerCase()===(name||'').trim().toLowerCase(); });
  if(!exists){
    c.insertAdjacentHTML('beforeend', fgZutRow(name,null,'nein'));
    var rows=c.querySelectorAll('.fgZutRow'); var last=rows[rows.length-1]; var inp=last&&last.querySelector('.fgzName');
    if(inp) fgZutAuto(inp);
  }
  if(btn){ btn.textContent='✓'; btn.disabled=true; btn.style.opacity='.55'; btn.style.cursor='default'; }
}
function fgOffAlle(){ [].forEach.call(document.querySelectorAll('#fgOffBox button[onclick^="fgOffUebernehmen"]'),function(b){ if(!b.disabled) b.click(); }); }
/* Grober Namensabgleich: hat OFF ein GANZ anderes Produkt zurueckgegeben (falscher Barcode)?
   Wenn Editor-Name und OFF-Name/Marke KEIN gemeinsames Wort (>=3 Zeichen) haben -> Warnung. */
function fgTokens(s){ return ((s||'')+'').toLowerCase().replace(/[^a-z0-9äöüß ]/g,' ').split(/\s+/).filter(function(w){ return w.length>=3; }); }
function fgNameMismatch(editName, offName, offBrand){
  var e=fgTokens(editName); var o=fgTokens((offName||'')+' '+(offBrand||''));
  if(!e.length || !o.length) return false;  /* nichts zu vergleichen -> keine Warnung */
  return !e.some(function(w){ return o.indexOf(w)>=0; });
}
/* ================= RIKI – Root Index KI =================
   Ruft die Edge Function „riki-analyse" auf. Der API-Key liegt als Supabase-Secret und
   verlässt den Server NIE. Riki befüllt nur das Formular – gespeichert wird erst per Klick. */
async function rikiAnalyse(){
  const msg=document.getElementById("rikiMsg");
  const txt=(document.getElementById("rikiText")||{}).value||"";
  if(txt.trim().length<10){ msg.style.color="var(--k-b45309)"; msg.textContent="Bitte die Zutatenliste einfügen."; return; }
  msg.style.color="var(--k-534ab7)"; msg.textContent="🤖 Riki denkt nach…";
  try{ feBusy(true,"🤖 Riki analysiert die Zutatenliste…","Zutaten zerlegen & bewerten – einen Moment."); }catch(e){}
  const nw={};
  ["kcal","protein","kh","zucker","fett","ges_fett","ballaststoffe","salz"].forEach(function(k){
    const v=parseFloat((document.getElementById("fe_"+k)||{}).value); if(!isNaN(v)) nw[k]=v;
  });
  try{
    /* Direkter Fetch erhält den Fehlertext der Edge Function; Fehler müssen sichtbar bleiben. */
    const {data:{session}}=await client.auth.getSession();
    if(!session){ msg.style.color="var(--k-dc2626)"; msg.textContent="Nicht angemeldet."; return; }
    const resp=await fetch(SUPABASE_URL+"/functions/v1/riki-analyse",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "apikey":SUPABASE_KEY,
                "Authorization":"Bearer "+session.access_token },
      body: JSON.stringify({ modus:"zutaten", modell:RIKI_LESE_MODELL, text:txt,
        name:(document.getElementById("fe_name")||{}).value||null,
        naehrwerte:Object.keys(nw).length?nw:null,
        produkt_id:(window._fgEdit&&window._fgEdit.id)||null })
    });
    let data=null;
    try{ data=await resp.json(); }catch(e){ data={error:"Antwort war kein JSON ("+resp.status+")"}; }
    if(!resp.ok || (data&&data.error)){
      msg.style.color="var(--k-dc2626)";
      msg.innerHTML="<b>Fehler "+resp.status+":</b> "+esc((data&&(data.error||JSON.stringify(data.detail||data)))||"unbekannt");
      return;
    }
    const v=data.vorschlag||{};
    if(v.fehler){ msg.style.color="var(--k-dc2626)"; msg.textContent="Riki-Antwort unbrauchbar: "+v.fehler; return; }
    /* Zutaten ins Formular übernehmen – nur Vorschlag, nichts gespeichert. */
    if(Array.isArray(v.zutaten)&&v.zutaten.length){
      const c=document.getElementById("fe_zutRows");
      if(c) c.innerHTML=v.zutaten.map(function(z){ return fgZutRow(z.name, z.rating, z.kritisch?"ja":"nein"); }).join("");
      try{ if(typeof fgRefFromLabel==="function") fgRefFromLabel(txt, v.zutaten.map(function(z){return z.name;})); }catch(e){}  /* rechte Referenz = VOLLSTÄNDIGE rohe Etikett-Liste */
    }
    /* Rikis erkannte Zusatzstoffe (inkl. E-Nummern aus den Salami-/Wurst-Klammern) automatisch
       in die Liste übernehmen – du tippst nichts nach. */
    if(v.zusatzstoffe){ try{ zusFromRiki(v.zusatzstoffe); }catch(e){} } try{ fgZutAdditiveRoute(); }catch(e){} try{ feEinheitAusRiki(v); }catch(e){}    
    const n=v.naehrwerte_100g||{};
    var _nwGesetzt=false;
    Object.keys(n).forEach(function(k){
      const el=document.getElementById("fe_"+(k==="ballaststoffe"?"ballaststoffe":k));
      if(el && !el.value && n[k]!=null){ el.value=n[k]; _nwGesetzt=true; }
    });
    if(_nwGesetzt && window._fgDirtyArmed && window._fgDirty) window._fgDirty.makro=true;   /* DOM-Insert loest kein input-Event aus */
    let h='<div style="color:var(--k-166534)"><b>✓ Vorschlag eingefügt</b> · '+(v.zutaten||[]).length+' Zutaten · '
      +(data.meta?('Kosten: $'+Number(data.meta.kosten_usd).toFixed(4)+' · '+data.meta.dauer_ms+' ms'):'')+'</div>';
    if(v.unsicher) h+='<div style="color:var(--k-b45309);margin-top:3px">⚠️ <b>Riki ist unsicher:</b> '+esc(v.unsicher_warum||'')+' – nicht ungeprüft freigeben.</div>';
    if(Array.isArray(v.warnungen)&&v.warnungen.length)
      h+='<div style="color:var(--k-dc2626);margin-top:3px"><b>Plausibilitäts-Warnungen:</b><br>• '+v.warnungen.map(esc).join('<br>• ')+'</div>';
    if(Array.isArray(v.zutaten)&&v.zutaten.length)
      h+='<details style="margin-top:5px"><summary style="cursor:pointer;color:var(--k-534ab7);font-size:12px">Begründungen anzeigen</summary>'
        +'<div style="font-size:11.5px;color:var(--muted);margin-top:4px">'
        +v.zutaten.map(function(z){ return '<b>'+esc(z.name)+'</b> → '+z.rating+': '+esc(z.begruendung||''); }).join('<br>')
        +'</div></details>';
    h+='<div style="color:var(--muted);margin-top:5px;font-size:11.5px">Das ist ein <b>Vorschlag</b>, keine Verifizierung. Gegen das Etikett prüfen, bevor du freigibst.</div>';
    msg.style.color="var(--ink)"; msg.innerHTML=h;
  }catch(e){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+e.message; }
  finally{ try{ feBusy(false); }catch(e){} }
}
async function rikiAudit(limit, anwenden){
  const box=document.getElementById("fgRikiAudit"); if(!box) return;
  const {data:{session}}=await client.auth.getSession();
  if(!session){ box.innerHTML='<span style="color:var(--k-dc2626)">Nicht angemeldet.</span>'; return; }

  box.innerHTML='<div style="color:var(--muted)">Lade Zutaten…</div>';
  await loadZutatenStamm();
  /* Nur Zutaten prüfen, die in aktiven Produkten wirklich vorkommen. */
  const {data:zut,error}=await client.rpc("cb_zutaten_audit_liste",{p_limit:limit||60});
  if(error){ box.innerHTML='<span style="color:var(--k-dc2626)">Fehler: '+esc(error.message)+'</span>'; return; }
  if(!zut||!zut.length){ box.innerHTML='<span style="color:var(--muted)">Keine Zutaten gefunden.</span>'; return; }

  const paket=40; const abw=[]; let geprueft=0, kosten=0;
  for(let i=0;i<zut.length;i+=paket){
    const teil=zut.slice(i,i+paket);
    box.innerHTML='<div style="color:var(--muted)">🤖 Riki prüft '+(i+1)+'–'+Math.min(i+paket,zut.length)+' von '+zut.length+' Zutaten…</div>';
    const liste=teil.map(function(z){ return z.zutat; }).join(', ');
    try{
      const resp=await fetch(SUPABASE_URL+"/functions/v1/riki-analyse",{
        method:"POST",
        headers:{ "Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token },
        body: JSON.stringify({ modus:"zutaten", modell:RIKI_LESE_MODELL, text:liste })
      });
      const data=await resp.json();
      if(!resp.ok||data.error){ box.innerHTML='<div style="color:var(--k-dc2626)">Fehler: '+esc(data.error||resp.status)+'</div>'; return; }
      kosten += (data.meta&&data.meta.kosten_usd)||0;
      const rz=(data.vorschlag&&data.vorschlag.zutaten)||[];
      teil.forEach(function(z){
        const treffer=rz.find(function(r){ return String(r.name||'').toLowerCase().trim()===String(z.zutat).toLowerCase().trim(); });
        geprueft++;
        if(!treffer||treffer.rating==null) return;
        const diff=Math.abs(Number(treffer.rating)-Number(z.bewertung));
        if(diff>=2) abw.push({zutat:z.zutat, unser:z.bewertung, riki:treffer.rating, diff:diff,
                              produkte:z.produkte, grund:treffer.begruendung||''});
      });
    }catch(e){ box.innerHTML='<div style="color:var(--k-dc2626)">Fehler: '+esc(e.message)+'</div>'; return; }
  }
  abw.sort(function(a,b){ return (b.diff*100+b.produkte)-(a.diff*100+a.produkte); });
  box.innerHTML='<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px">'
    +'<div style="font-weight:700;margin-bottom:6px">🤖 Riki-Audit · '+geprueft+' Zutaten geprüft · Kosten $'+kosten.toFixed(4)+'</div>'
    +'<div style="font-size:13px;color:'+(abw.length?'var(--k-b45309)':'var(--k-166534)')+';margin-bottom:8px"><b>'+abw.length+'</b> Abweichungen (≥ 2 Punkte) zwischen unserem Stamm und dem Regelwerk.</div>'
    +'<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Es wurde <b>nichts geändert</b>. Riki hat die Zutaten nur nach dem Regelwerk neu bewertet. Prüfe jede Zeile – bei einer Abweichung hat entweder unser Stamm einen Fehler (wie heute beim Olivenöl) oder Riki liegt daneben.</div>'
    +(abw.length? '<div style="max-height:400px;overflow:auto;border-top:1px solid var(--line);padding-top:8px">'
        +abw.map(function(a){ return '<div style="font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--line)">'
            +'<b>'+esc(a.zutat)+'</b> <span style="color:var(--muted)">· '+a.produkte+' Produkte</span><br>'
            +'wir: <b style="color:var(--k-0369a1)">'+a.unser+'</b> · Riki: <b style="color:var(--k-b45309)">'+a.riki+'</b>'
            +'<div style="color:var(--muted);margin-top:2px">'+esc(a.grund)+'</div></div>'; }).join('')
      +'</div>' : '')
    +'</div>';
}
async function rikiBudget(){
  const msg=document.getElementById("rikiMsg");
  try{
    const {data}=await client.rpc("cb_riki_budget_check");
    const b=Array.isArray(data)?data[0]:data;
    if(!b){ msg.textContent="—"; return; }
    msg.style.color=b.erlaubt?"var(--ink)":"var(--k-dc2626)";
    msg.innerHTML='Diesen Monat: <b>$'+Number(b.verbraucht_usd).toFixed(4)+'</b> von $'+b.limit_usd
      +' · '+b.aufrufe_monat+' Aufrufe'+(b.erlaubt?'':' <b>· LIMIT ERREICHT</b>');
  }catch(e){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+e.message; }
}
function feUrlOeffnen(){
  var u=((document.getElementById('fe_url')||{}).value||'').trim();
  if(/^https?:\/\//i.test(u)){ try{ window.open(u,'_blank','noopener'); }catch(e){} }
}
function feUrlLblSync(){
  var l=document.getElementById('fe_urlLbl'); if(!l) return;
  var u=((document.getElementById('fe_url')||{}).value||'').trim();
  var ok=/^https?:\/\//i.test(u);
  l.style.textDecoration=ok?'underline':'none';
  l.style.cursor=ok?'pointer':'default';
  l.title=ok?('Öffnet in neuem Fenster: '+u):'Link ins Feld einfügen, dann wird „Weblink" klickbar';
}
if(typeof window!=='undefined'){ window.feUrlOeffnen=feUrlOeffnen; window.feUrlLblSync=feUrlLblSync; }
async function openFgEditor(id, prefill, targetEl){
  window._feAlleBereiche=false; window._feQuelleOffen=false;
  /* targetEl (optional): rendert den Editor INLINE in einen Container (z. B. Master-Detail-
     Seite „Produkt-Erfassung") statt ins Vollbild-Overlay. Ohne targetEl unveraendert. */
  const panel=targetEl||document.getElementById("panel");
  window._fgEditorTarget=targetEl||null;
  window._fgDirtyArmed=false;
  window._fgDirty={makro:false,wirk:false,zut:false};
  /* Quellenliste vor dem Zeichnen holen - das Auswahlfeld entsteht in einem Template-String
     und kann nicht auf ein spaeteres Ergebnis warten. Beim zweiten Oeffnen kommt sie aus
     dem Speicher, kostet also nur einmal. */
  try{ await loadQuellenTypen(); }catch(e){}
  let d={id:null,name:"",marke:"",kategorie:"",unterkategorie:"",ean:"",basis:"100g",bild_url:"",bild_url_off:"",status:"",
    naehrwerte:{},zusatzstoffe_text:"keine",zusatzstoffe_status:"keine",suessstoffe:"nein",zutaten:[]};
  if(id){
    const {data,error}=await client.rpc("cb_produkt_edit_get",{p_id:id});
    if(error){ alert("Fehler: "+error.message); return; }
    d=data||d; d.naehrwerte=d.naehrwerte||{}; d.zutaten=d.zutaten||[];
    var _mz=function(v){ return (v==null?null:Number(v)); };
    window._fgScoreGespeichert={
      produkt_id:id,
      clean_score:_mz(d.clean_score),
      bewertung:(d.bewertung==null?"":String(d.bewertung)),
      vollstaendig:(d.vollstaendig===true),
      achsen:{zutaten:_mz(d.p_zutaten), zusatzstoffe:_mz(d.p_zusatzstoffe),
              nova:_mz(d.p_nova), naehrwert:_mz(d.p_naehrwert)},
      achsen_na:Array.isArray(d.achsen_na)?d.achsen_na.slice():[],
      achsen_fehlend:Array.isArray(d.achsen_fehlend)?d.achsen_fehlend.slice():[],
      quelle:"cb_produkt_edit_get"
    };
    window._fgScoreServer=null;
    if(prefill){
      if((!d.zutaten||!d.zutaten.length) && prefill.zutaten && prefill.zutaten.length) d.zutaten=prefill.zutaten;
      if((!d.zusatzstoffe_text||d.zusatzstoffe_text==="keine") && prefill.zusatzstoffe_text) d.zusatzstoffe_text=prefill.zusatzstoffe_text;
      window._fgPrefillHinweis=prefill.hinweis||"";
    }
  } else if(prefill){
    d.name=prefill.name||d.name; d.marke=prefill.marke||d.marke; d.ean=prefill.ean||d.ean;
    d.kategorie=prefill.kategorie||d.kategorie;
    if(prefill.naehrwerte) d.naehrwerte=prefill.naehrwerte;
    if(prefill.zutaten&&prefill.zutaten.length) d.zutaten=prefill.zutaten;
    if(prefill.zusatzstoffe_text) d.zusatzstoffe_text=prefill.zusatzstoffe_text;
    window._fgPrefillHinweis=prefill.hinweis||"";
  } else { window._fgPrefillHinweis=""; }
  /* Etikettfotos: beim Anlegen kommen sie aus dem Scan mit, bei einem bestehenden
     Produkt werden sie ueber die Verknuepfung nachgeladen. Nie kopiert - sie liegen
     weiterhin nur in Scan_Warteschlange. Fehlschlag ist unkritisch: dann eben keine Belege. */
  let _etikett = (prefill && prefill.fotos) ? prefill.fotos.slice() : [];
  window._fgEtikettFehler="";
  window._fgEtikettAnzahl=null;    
  if(!_etikett.length){
    try{
      let ef=null;
      if(id){
        const r=await client.rpc("cb_produkt_etikettfotos",{p_id:id});
        if(r.error) throw r.error; ef=r.data;
      } else {
        /* Nur mit EAN suchen. Ohne sie gibt es nichts zu finden - und ein leerer Wert
           darf keine fremden Fotos holen (die RPC lehnt ihn zusaetzlich selbst ab). */
        const _ean=String((d&&d.ean)||"").trim();
        if(_ean){ const r=await client.rpc("cb_etikettfotos_zu_ean",{p_ean:_ean});
                  if(r.error) throw r.error; ef=r.data; }
      }
      /* Fotoanzahl separat merken; null Fotos, Ladefehler und fehlende Bildkarte sind verschiedene Zustände. */
      try{ window._fgEtikettAnzahl = (ef && ef.ok && Array.isArray(ef.fotos)) ? ef.fotos.length : 0; }catch(_z){}
      if(ef && ef.ok && Array.isArray(ef.fotos)){
        /* Dieselbe EAN kann mehrfach in der Warteschlange stehen (z. B. zweimal gesendet) -
           dann kaeme jedes Bild doppelt. Entdoppeln, sonst zaehlt die Karte falsch. */
        var _seen={}; _etikett=ef.fotos.filter(function(s){
          if(typeof s!=="string"||!s||_seen[s]) return false; _seen[s]=1; return true; });
      }
    }catch(e){
      window._fgEtikettFehler=(e&&e.message)?String(e.message):String(e);
      console.error("[Editor] Etikettfotos konnten nicht geladen werden:", e);
    }
  }
  window._fgEdit={ id:id, bild_url:d.bild_url||"", status:String(d.status||""),
                   bratenEignung:String(d.braten_eignung||""),
                   bratenGrund:String(d.braten_grund||""),
                   bratenBeleg:String(d.braten_beleg||""),
                   bratenStand:String(d.braten_stand||""),
                   etikett:_etikett,
                   etikettGeladen:_etikett.slice(),
                   scanIds:(prefill&&prefill.scanIds)||[], kcalOk:!!((d.naehrwerte||{}).kcal_ok),
                   score:(d.clean_score!=null?Number(d.clean_score):null),
                   ean_status:String(d.ean_status||d.EAN_Status||""),
                   ean_ampel:String(d.ean_ampel||"") };
  var _savedRef=(id && window._fgRefMap && Array.isArray(window._fgRefMap[id]) && window._fgRefMap[id].length)?window._fgRefMap[id].slice():null;
  var _boundNames=(d.zutaten||[]).map(function(z){ return z&&z.name; }).filter(Boolean);
  var _boundZus=(typeof fgFlattenZus==="function")?fgFlattenZus(String(d.zusatzstoffe_text||"")):[];    
  var _gelesenVorher=[];
  try{ if(id && window._fgRefGelesenMap && Array.isArray(window._fgRefGelesenMap[id])) _gelesenVorher=window._fgRefGelesenMap[id].slice(); }catch(_e){}
  try{ fgRefSet((_savedRef||_boundNames).concat(_boundNames).concat(_boundZus), {gelesen:_gelesenVorher}); }
  catch(_e){ var _refSeen={}; window._fgRef=[]; window._fgRefGelesen={}; (_savedRef||_boundNames).concat(_boundNames).concat(_boundZus).forEach(function(n){ var k=String(n||"").trim().toLowerCase(); if(!k||_refSeen[k]||_refIstLeer(k)) return; _refSeen[k]=1; window._fgRef.push(n); }); }
  await loadZutatenStamm();
  const nw=d.naehrwerte||{};
  /* 🔴 23.08.2026, Work #181 Stufe 4 — Ralphs Punkt 3: "Wertefelder schmaler und näher
     an ihren Beschriftungen".
     WAS HIER STAND: justify-content:space-between — das heißt wörtlich "drück beide so
     weit auseinander wie möglich". Nicht das Feld war zu breit (110px), der ABSTAND war
     es. Dazu lag die ganze Optik inline im JavaScript und war damit nirgends zentral
     änderbar.
     JETZT: nur noch Struktur, die Optik steht in ui.css unter .feNwRaster / .feNwFeld.
     Die Einheit wandert aus der Klammer in ein eigenes <i> — "Fett g" liest sich neben
     einem Zahlenfeld besser als "Fett (g)" und spart Breite. */
  const NF_UNTER={zucker:1,polyole:1,ges_fett:1,einfach_unges:1,mehrfach_unges:1,transfette:1};
  const nf=(k,label,unit)=>`<label class="feNwFeld${NF_UNTER[k]?" unter":""}"><span>${label}${unit?` <i>${unit}</i>`:""}</span><input id="fe_${k}" type="number" step="any" value="${nw[k]??""}" oninput="fePlaus()"></label>`;
  /* Fehlende Bewertung bleibt leer; niemals auf 5 vorbelegen. */
  const zText=(d.zutaten||[]).map(z=>`${z.name}; ${(z.rating===null||z.rating===undefined)?"":z.rating}; ${(String(z.kritisch||"nein").toLowerCase()==="ja")?"j":"n"}`).join("\n");
  const inp=(id2,val)=>`<input id="${id2}" value="${esc(val||"")}" oninput="try{feDubPruefen()}catch(e){}" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px">`;    
  /* Das <select> löst die Plausibilitätsprüfung aus. Unbekannte Ist-Werte bleiben als sichtbare <option> erhalten. */
  const sel=(id2,cur,opts,onch)=>{ var _c=(cur==null?"":String(cur)); var _o=opts.slice();
    if(_c && _o.indexOf(_c)<0) _o.push(_c);
    return `<select id="${id2}" ${onch?`onchange="${onch}"`:""} style="width:100%;padding:8px;border:1px solid var(--line);border-radius:8px">`
      + _o.map(function(o){ var unbek=(o!=="" && opts.indexOf(o)<0);
          return `<option value="${esc(o)}" ${(_c===o)?"selected":""}>${esc(o)}${unbek?" (nicht in der Liste)":""}</option>`; }).join("")
      + `</select>`; };
  const card=(title,inner)=>`<div class="feKarte"><div class="feKartenTitel">${title}</div>${inner}</div>`;
  /* Dieselbe Karte, nur als Flex-Spalte fuer die Spaltenansicht in Station 3:
     der Titel behaelt seine Hoehe, der Inhalt nimmt den Rest und scrollt.
     cardFB bleibt als Klassenname bestehen - "#fe_gridA .cardFB > *" haengt
     daran (Z. 23245 f.), und ein umbenannter Selektor waere ein stiller Bruch. */
  const cardF=(title,inner)=>`<div class="feKarte feKarteFlex"><div class="feKartenTitel">${title}</div><div class="cardFB">${inner}</div></div>`;
  /* Kopfleiste der Vollbild-Maske: zurueck zum Posteingang + vor/zurueck durch die
     „Zu verifizieren"-Liste + persistentes Markieren. Vor/Zurueck nur, wenn das Produkt
     in der aktuellen Liste steht (window._verifRows). */
  const _refCard = `<div id="fe_flipWrap" style="height:100%;min-height:0;perspective:1400px"><div id="fe_flipInner" style="position:relative;width:100%;height:100%;min-height:0;transition:transform .5s;transform-style:preserve-3d">`
    +`<div style="position:absolute;inset:0;min-height:0;display:flex;backface-visibility:hidden;-webkit-backface-visibility:hidden">`
    +cardF(`Referenz <span style="text-transform:none;color:var(--muted)">– von Riki gelesen (Herstellerseite/Etikett)</span><button type="button" id="fe_refV2Btn" onclick="fgRefV2Umschalten()" title="Referenzansicht V2 (hierarchischer Parser) – nur Anzeige, Rückfall bleibt die klassische Liste" style="display:none;float:right;margin-left:6px;text-transform:none;letter-spacing:0;border:1px solid var(--k-16a34a);border-radius:7px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);padding:3px 9px;font-size:11.5px;font-weight:700;cursor:pointer;line-height:1.3">Referenz V2 ⇨</button><button type="button" id="fe_refFlipBtn" onclick="fgRefFlip(true)" title="Karte umdrehen – Etikett zum Ablesen" style="float:right;text-transform:none;letter-spacing:0;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--ink);padding:3px 9px;font-size:11.5px;font-weight:700;cursor:pointer;line-height:1.3">⇄ Etikett</button><button type="button" id="fe_naehrBtn" onclick="feNaehrPopupOpen()" title="Zeigt dieselbe Nährstoff-Anzeige wie später die Produktkarte – Bedarf und Sicherheitsgrenze je Wirkstoff" style="display:none;float:right;margin-right:6px;text-transform:none;letter-spacing:0;border:1px solid var(--k-16a34a);border-radius:7px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);padding:3px 9px;font-size:11.5px;font-weight:700;cursor:pointer;line-height:1.3">🧪 Nährstoffe</button>`, `<div id="fe_refFront"><div id="fe_enthalten" data-note="Konzept D: fuellt die Kartenhoehe" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:13px;line-height:1.5;background:var(--k-f6f8f7,#f6f8f7);color:var(--ink);flex:1 1 auto;min-height:0;overflow:auto"></div><div style="display:flex;gap:6px;margin-top:8px;flex:0 0 auto"><input id="fe_refNeu" onkeydown="if(event.key==='Enter'){event.preventDefault();fgRefAdd();}" placeholder="Riki hat etwas übersehen? Name eintippen…" style="flex:1;min-width:0;padding:7px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--card);color:var(--ink)"><button type="button" onclick="fgRefAdd()" style="padding:7px 11px;border:1px solid var(--k-16a34a);border-radius:8px;background:var(--greenlt,var(--k-ecfdf5));color:var(--k-166534);cursor:pointer;font-size:12.5px;white-space:nowrap">+ einfügen</button></div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:10.5px;color:var(--muted);margin-top:6px;line-height:1.35;flex:0 0 auto"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#2e9e57;vertical-align:middle;margin-right:4px"></span>übernommen</span><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#e0a32e;vertical-align:middle;margin-right:4px"></span>noch offen</span><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#94a3b8;vertical-align:middle;margin-right:4px"></span>nicht eingestuft</span><span style="margin-left:auto">Zeile anklicken → links suchen</span></div></div><div id="fe_refV2" data-note="Referenz V2, Zug 1: reine Anzeige. Rueckfall ist fe_refFront." style="display:none;width:100%;box-sizing:border-box;flex:1 1 auto;min-height:0;overflow:auto"></div>`)
    +`</div>`
    +`<div id="fe_refBack" style="position:absolute;inset:0;min-height:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);display:flex;flex-direction:column;gap:6px">`
    +`<div style="display:flex;justify-content:flex-end;flex:0 0 auto"><button type="button" onclick="fgRefFlip(false)" title="zurück zur Referenz-Arbeitsliste" style="border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);padding:4px 11px;font-size:11.5px;font-weight:700;cursor:pointer">⇄ Referenz</button></div>`
    +`<div id="fe_fotoMount" data-note="28h: Etikett lebt auf der RUECKSEITE der Flipkarte. fgFotoPlatzieren haengt die Foto-Karte unveraendert hier ein (bzw. bei Supplements neben die Dosis-Tabelle)." style="flex:1 1 auto;min-height:0;display:flex;flex-direction:column"></div>`
    +`<div id="fe_fotoLeerHinweis" style="flex:1;align-items:center;justify-content:center;text-align:center;color:var(--muted);font-size:12.5px;line-height:1.6;padding:14px;border:1px dashed var(--line);border-radius:12px;background:var(--card)">Das Etikett steht in Station 2<br>„Nährwerte &amp; Wirkstoffe", rechts neben den Nährwerten.<br>Zurück mit ⇄.</div>`
    +`</div></div></div>`;
  var _rows=Array.isArray(window._verifRows)?window._verifRows:[];
  var _idx=id?_rows.findIndex(function(r){return String(r.id)===String(id);}):-1;
  /* 🔴 24.08.2026, Ralph: "buttons sind alle irgendwie verschoben".
     Gemessen im Browser an P73650: in EINER Zeile standen Hoehen von 24, 27, 28
     und 29 px und Schriftgroessen von 10, 11.5, 12 und 13 px nebeneinander —
     jeder Knopf brachte seinen eigenen Inline-Stil mit. Genau der Zustand, der
     im Fahrplan schon dreimal Aerger gemacht hat: inline schlaegt jede Regel,
     also laesst sich das nicht mit einer Stylesheet-Zeile daruebergehen.
     Deshalb tragen die Knoepfe der Kopfleiste jetzt die Klasse .feNavBtn, und
     die Hoehe steht EINMAL in ui.css — zusammen mit .feSegBtn, damit Knoepfe
     und Chips derselben Zeile gleich hoch sind.
     Ausserdem Ralph: "vorherig und naechster wuerde ein kleiner pfeil reichen." */
  var _nbtn=function(txt,act,on,titel,pfeil){
    return '<button type="button" class="feNavBtn'+(pfeil?' pfeil':'')+(on?'':' aus')+'"'
      +(on?' onclick="'+act+'"':' disabled')
      +(titel?' title="'+esc(titel)+'"':'')+'>'+txt+'</button>'; };
  var _navInner='<button type="button" id="feNavPost" class="feNavBtn" onclick="closeP()">← Posteingang</button>';
  if(_idx>=0){
    var _prev=_idx>0?_rows[_idx-1].id:null, _next=_idx<_rows.length-1?_rows[_idx+1].id:null, _mk=!!_rows[_idx].markiert;
    _navInner+= '<span id="feNavBlaett" style="display:flex;align-items:center;gap:8px">'
      + _nbtn('‹', "openFgEditor('"+_prev+"')", !!_prev, 'Vorheriges Produkt', true)
      + '<span style="font-size:13px;color:var(--muted);white-space:nowrap">'+(_idx+1)+' / '+_rows.length+'</span>'
      + _nbtn('›', "openFgEditor('"+_next+"')", !!_next, 'Nächstes Produkt', true)
      + '</span>'
      + '<span id="fe_frgSlot" style="margin-left:auto;display:flex;align-items:center;min-width:0"></span>'
      + '<label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink);cursor:pointer;white-space:nowrap"><input type="checkbox" '+(_mk?'checked':'')+' onclick="fgEditMark(\''+esc(id)+'\',this.checked)" style="width:17px;height:17px;accent-color:var(--k-16a34a)">🚩 markiert <span style="color:var(--muted);font-weight:400">(gespeichert)</span></label>';
  }
  if(_navInner.indexOf('fe_frgSlot')<0) _navInner+='<span id="fe_frgSlot" style="margin-left:auto;display:flex;align-items:center;min-width:0"></span>';   /* 28i: Slot auch ohne Listen-Navigation */
  if(window.__ADMIN_PAGE){ _navInner+='<button type="button" class="feNavBtn" onclick="adminNeuLaden(this)" title="Neueste Version holen – leert Cache &amp; Service-Worker und lädt hart neu">🔄 '+((typeof APP_BUILD!=="undefined"&&APP_BUILD)?esc(String(APP_BUILD).split("-").pop()):"")+'</button>'; }
  var _navBar='<div id="feNavLeiste">'+_navInner+'</div>';
  if(targetEl) _navBar='';   /* Inline-Modus: die Master-Detail-Liste ersetzt die Kopf-Navigation */
  panel.innerHTML=`
    ${_navBar}
    ${""}
    ${''/* 🔴 23.08.2026, Work #181 — EIN RAHMEN UM DEN GANZEN KOPF.
         Ralph: "grauer balken oben, menue oben ist getrennt, soll ja eins sein."

         VORGESCHICHTE, weil sie die Lehre enthaelt: ich hatte Kopfband,
         Statusstreifen und Bedienzeile EINZELN fixiert (position:sticky) und
         ihnen gestaffelte Abstaende von oben gegeben. Live gemessen kam dabei
         heraus: Band endet bei 78, Streifen klebt bei 122, Zeile bei 149 - eine
         44px hohe helle Luecke dazwischen (Ralphs "grauer balken") und darunter
         eine Ueberlappung.

         WARUM DAS NIE FUNKTIONIEREN KONNTE: ein sticky-Element klebt an SEINER
         eigenen Position. Drei davon nebeneinanderzustellen ergibt drei Balken,
         die unabhaengig voneinander haengenbleiben - nie einen Block. Man kann
         die Abstaende so lange nachrechnen, bis es bei EINER Fensterbreite und
         EINEM Produkt passt; beim naechsten steht die Luecke wieder da.

         Sie liegen jetzt in einem gemeinsamen Rahmen, und NUR der ist fixiert.
         Damit gibt es die Luecke nicht mehr - nicht, weil sie wegberechnet
         wurde, sondern weil es nichts mehr gibt, wozwischen sie entstehen
         koennte. */}
    <div id="feKopfFix">
    <div id="feKopfband">
      ${''/* 🔴 23.08.2026, Work #181 — ZEILE A AUS DEM MOCKUP: Bild links, Index rechts.
           Beides fehlte bisher im Kopf. Das Bild kam gar nicht vor, obwohl _fgEdit ein
           Feld bild_url fuehrt; der Index stand nur als Text im Statusstreifen.
           Der Platzhalter bleibt sichtbar, wenn kein Bild da ist - ein leerer Rahmen
           sagt "hier fehlt eins", eine weggelassene Flaeche sagt gar nichts. */}
      <div class="fkbBild" id="feKbBild">${d.bild_url
        ? '<img src="'+esc(d.bild_url)+'" alt="">'
        : '<span>kein<br>Bild</span>'}</div>
      <div class="fkbLinks">
        <div class="fkbMarke" id="feKbMarke">${esc(d.marke||"")}${d.kategorie?(d.marke?" · ":"")+esc(d.kategorie):""}</div>
        <div class="fkbName" id="feKbName">${esc(d.name||(id?"":"Neues Produkt"))}<span id="feDubChip" style="display:none"></span></div>
      </div>
      ${''/* Die Index-Zahl fuellt feStatusStreifen aus derselben Quelle wie bisher -
           hier steht nur die Huelle. Ohne Wert bleibt sie leer statt eine Null zu
           zeigen: kein Index ist etwas anderes als Index null. */}
      <div class="fkbIndex" id="feKbIndex"></div>
      <div class="fkbStatus" id="feKbStatus">${esc(d.status||"Entwurf")}</div>
      ${''/* 09.09.2026 (#217, Ralph): "durch die Maschine laufen lassen inkl. Ampel fuer die
           einzelnen Knoten." Eigene Seite maschine-lauf.html?p=<id> - sie misst mit derselben
           Regel wie das Kern-Poster und ruft nur vorhandene Werkzeuge (E48). Nur mit P-Nummer. */}
      <span id="fePNrInfo" class="fkbId">${id?(esc(d.id)+" · "+esc(d.status||"Entwurf")):"P-Nummer kommt beim ersten Speichern"}${d.erfasst_am?(" · erfasst "+esc(d.erfasst_am)):""}</span>
      <h2 style="margin:0;display:none">${id?"Produkt bearbeiten":"Neues Produkt"}</h2>
      ${''/* 09.09.2026 (#217, Ralph): die Maschine als Punktreihe IM Kopfband, nicht als
           eigene Seite. Erst nach Klick auf "Maschine" gemessen (cb_produkt_maschine_stand,
           dieselbe Regel wie das Kern-Poster). Gelber Punkt -> Popup mit Grund und Knopf. */}
      ${id?'<div class="fkbMaschineZeile" id="feMaschineZeile"><button type="button" class="fkbMaschine" id="feMaschineBtn" onclick="feMaschineLauf()" title="Dieses Produkt durch die Maschine laufen lassen">▶ Maschine</button><span id="feMaschineDots" class="fkbMaschineDots"><span class="fkbMaschineLeer">noch nicht gemessen</span></span></div>':''}
    </div>
    <div id="fe_gesamtstatus" data-note="P1: EIN Gesamtstatus. Gefüllt von feStatusStreifen() aus getErfassungsStatus() – keine eigene Rechnung."></div>
    ${window._fgPrefillHinweis?`<div style="background:var(--k-fff7ea);border:1px solid var(--k-e4a343);color:var(--k-8a5a0b);border-radius:10px;padding:9px 11px;font-size:12.5px;line-height:1.5;margin-bottom:10px">${esc(window._fgPrefillHinweis)}</div>`:""}
    ${''}
    ${''/* Editor-Geometrie liegt in ui.css; nur gemessene Laufzeitgrößen bleiben im JavaScript. */}
    ${''/* Topbar bleibt im Template leer und wird vom bestehenden Renderer gefüllt. */}
    <div id="feTopbar" style="display:none"></div>
    ${''/* 🔴 23.08.2026, Work #181 — DIE FIXIERTE KOPFZONE.
         Ralph: "die navi soll auch oben sein und fixiert beim scrollen ... ich meinte
         auch die eigenschaften und die freigabe."
         Hier ziehen die drei Bloecke ein, die bisher im linken Streifen standen:
         feRailNav (Posteingang + Blaettern), feProdKopf (Status, Aktionen, Bio,
         Ernaehrungsform) und feFokusNav (die drei Stationen).
         WICHTIG FUER DEN UMBAU: die Bloecke werden NICHT nachgebaut. Die drei
         vorhandenen Funktionen haengen sie weiterhin selbst ein - sie fragen ab
         jetzt nur ueber _feZielZone(), WOHIN. Deshalb kann kein Knopf verlorengehen:
         es zieht der ganze Block um, nicht zwanzig Einzelteile.
         Solange die Rail noch existiert, ist sie der Rueckfall. */}
    <div id="feKopfZone"></div>
    </div>${''/* Ende #feKopfFix - der Rahmen umschliesst Kopfband, Statusstreifen
         und Bedienzeile. Was danach kommt, scrollt. */}
    <div id="feRahmen">
      <div id="feRail">
        ${''/* 🔴 23.08.2026, Work #181 — WARUM DIESER STREIFEN STEHENBLEIBT.
             In meinem Plan stand "feRail aus dem DOM entfernen". Vor dem Ausbauen
             gemessen, und die Messung sagt: nicht ausbauen. Der Reihe nach.

             WAS ER KOSTET: nichts. Im Fokusmodus steht er auf display:none, live
             gemessen 0px Hoehe. Ihn zu entfernen macht keinen einzigen Pixel frei.

             WAS ER TRAEGT: nur noch die drei Schritt-Knoepfe feTabBtn1..3 mit ihren
             Abzeichen. An denen haengen FUENF Stellen im Code - feTabWechsel setzt
             ihren Aktiv-Zustand (Z. ~4956), zwei Stellen fuellen Abzeichen (Z. ~5996,
             ~6021), eine Schleife fasst alle drei an (Z. ~6062). Wer sie entfernt,
             muss alle fuenf umbauen; wer eine uebersieht, bekommt keinen Fehler,
             sondern einen Setzer, der ins Leere laeuft. Still.

             VERSCHLUCKT ER ETWAS? Das war die einzige Frage, die wirklich zaehlt -
             unsichtbare Warnungen waeren ein echter Fehler. Nachgesehen an P73634
             und P32667: die Abzeichen enthalten ein "✓" und sonst nichts, und die
             Stationen oben sagen dasselbe in Worten ("erfuellt · Snacks").
             Keine Information geht verloren.

             ERGEBNIS: Ausbauen kostet fuenf Eingriffe und bringt null Pixel.
             "Interessant ist kein Grund. Fertig ist ein Grund." Er bleibt, bis
             jemand die Schritt-Knoepfe ohnehin anfasst - dann faellt er nebenbei. */}
        <div id="feTabBar">
          <div class="feStTitel">Stationen</div>
          <button type="button" id="feTabBtn1" class="feSt" onclick="feTabWechsel(1)"><span class="feStNr">1</span><span class="feStTxt">📋 Kopfdaten <span id="feTab1Badge" class="feStBadge"></span><span id="feTab1Ean" class="feStBadge"></span></span></button>
          <button type="button" id="feTabBtn2" class="feSt" onclick="feTabWechsel(2)"><span class="feStNr">2</span><span class="feStTxt">🧪 Nährwerte &amp; Wirkstoffe <span id="feTab2Badge" class="feStBadge warn"></span></span></button>
          <button type="button" id="feTabBtn3" class="feSt" onclick="feTabWechsel(3)"><span class="feStNr">3</span><span class="feStTxt">🥣 Zutaten &amp; Referenz <span id="feTab3Badge" class="feStBadge"></span></span></button>
        </div>
        ${''/* Supplemente verwenden im zweiten Schritt die vorhandene Dosis-Ansicht. */}
        ${card(`<span id="fe_indexTitel">Root Index</span> <span id="fe_indexTitelZusatz" style="text-transform:none;color:var(--muted)">(live berechnet)</span>`,`<div id="fe_index"><div style="color:var(--muted);font-size:12.5px">Wird berechnet, sobald Titel, Nährwerte und Zutaten stehen.</div></div><div style="font-size:11.5px;color:var(--muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">Vorschau über dieselbe Rechnung wie im Produkt – hier wird <b>nichts gespeichert</b>.</div>`)}
        <div class="feRailKarte"><div class="feRailKarteTitel">Freigabe</div><div id="feRailAmpel">wird geprüft…</div></div>
        ${''/* 🔴 22.08.2026, Work #181 Stufe 2 (Ralph-Entscheid F1): die Karte "Quelle & Beleg"
             stand HIER, im linken Streifen — und war dadurch im Fokusmodus IMMER unsichtbar.
             Ursache: feRailAufraeumen() (Z. ~5364) blendet jedes direkte Kind von #feRail aus,
             dessen id nicht in FE_RAIL_ERLAUBT steht. Erlaubt sind genau drei: feRailNav,
             feProdKopf, feFokusNav. card() vergibt GAR KEINE id -> c.id ist "" -> none.
             Deshalb konnte Ralph den Quelle-Typ nicht mehr waehlen, obwohl der Server ihn
             fuer jede Freigabe verlangt (cb_quelle_belegt).
             Die Karte steht jetzt im mittleren Arbeitsbereich als erster Kasten von Schritt 1.
             Dort greift feRailAufraeumen nicht — es fasst ausschliesslich Kinder von #feRail an.
             KEIN Sonderfall in FE_RAIL_ERLAUBT: eine Ausnahme dort waere eine zweite
             Sichtbarkeitsregel geworden. Ein Ortswechsel, keine neue Quellenlogik. */}
      </div>
      <div id="feEditorBody" style="min-width:0">
        ${''/* Schrittkopf und -fuß werden aus dem aktuellen Fokuszustand gerendert. */}
        <div id="feSchrittKopf"></div>
        <div id="feTab1">
    ${''/* Work #181 Stufe 2: erster Kasten von Schritt 1 — erst die Quelle, dann die Daten.
         Der Wrapper traegt die id, damit die Schrittlogik die GANZE Karte schalten kann;
         card() selbst bleibt unveraendert, damit kein anderer Aufrufer mitgeaendert wird. */}
    <div id="fe_quelleCard">${card(`Quelle &amp; Beleg <span class="feKartenZusatz">– ohne Beleg keine Freigabe</span>`,`<div class="feQuelleGrid"><label>Quelle-Typ${sel("fe_quelle_typ",d.quelle_typ||"",quellenTypOptionen(),"try{fePlaus()}catch(e){}")}</label><label>Beleg (Seite/EAN)${inp("fe_beleg",d.beleg)}</label></div>${quellenTypHinweis()}<div id="fe_sichtpruefung"></div>`)}</div>
    <div id="feKopfLayout">
      <!-- 02.08. (Ralph): Riki-Zeile schlank. Vorher ~280px Hoehe fuer drei gleich grosse
           Kaesten - dabei nutzt Ralph fast immer Weblink oder Screenshot; der Datei-Upload
           laeuft bei ihm ueber "Angehaengte Fotos". Also: die zwei Hauptwege gross und
           nebeneinander, alles andere als Chip-Zeile darunter. Kein Element geloescht
           (§1.11n-j) - alle IDs und Aufrufe bleiben, nur Anordnung und Groesse. -->
      <div class="feHolBox">
      <div class="feHolKopf">
        <div class="feHolTitel">Daten holen <span class="feHolTitelZus">— Riki füllt, du prüfst</span></div>
        <label title="Ein neuer Lese-Vorgang überschreibt vorhandene Werte dann nicht — zum Nachfüllen fehlender Angaben." class="feNurLeerLbl"><input type="checkbox" id="fe_nurLeer" ${window._fgNurLeer?"checked":""} onchange="window._fgNurLeer=this.checked">nur <b>leere</b> Felder füllen</label>
      </div>
      <div class="feHolGrid">
        <div class="feHolZeile">
          <span id="fe_urlLbl" onclick="feUrlOeffnen()" title="Seite in neuem Fenster öffnen" style="cursor:default">🔗</span>
          <input id="fe_url" oninput="feUrlLblSync()" value="${esc(d.produktlink||"")}" placeholder="https://… Herstellerseite">
          <button type="button" onclick="fgPullHersteller()" class="feBtnLila">Riki liest ▸</button>
        </div>
        <div id="fe_pasteZone" tabindex="0" onpaste="fePasteImg(event)" onclick="this.focus()" title="Bild aus der Zwischenablage (z. B. Nährwert-Tabelle). Riki liest daraus; das Bild wird auch bei den angehängten Fotos gemerkt."><span class="feFlex0">📷</span><span class="feEllipsis"><b>Screenshot:</b> hier klicken, dann Strg+V</span></div>
        ${''}
        <div class="feHolZeile2">
          ${''}
          <textarea id="fe_jsonIn" rows="1" wrap="off" placeholder='📋 JSON aus der Produktseite hier einfügen…' title="JSON aus dem Lesezeichen-Skript einfügen, dann auf Übernehmen klicken" style="border:2px dashed #9fc6a8;background:var(--k-f4faf5,#f4faf5)"></textarea>
          <button type="button" onclick="fgJsonUebernehmen()" class="feBtnGruenHell">Übernehmen ▸</button>
        </div>
        ${''/* Eingefügter Zutatenrohtext nutzt den bestehenden Analyseweg. */}
        <div class="feHolZeile2">
          <textarea id="fe_rohtextIn" rows="1" wrap="off" placeholder='📄 Zutaten/Nährwerte als TEXT hier einfügen…' title="Kopierten Text von Etikett oder Homepage einfügen – Riki zerlegt ihn in Abschnitte und Zeilen, nichts wird ohne dein Zutun gespeichert" style="border:2px dashed #b9b3e8;background:var(--k-f6f5fd,#f6f5fd)"></textarea>
          <button type="button" onclick="fgRohtextLauf()" class="feBtnLila">Text lesen ▸</button>
        </div>
        <div id="fe_jsonMsg"></div>
      </div>
      <div class="feHolAuch">
        <span class="feFlex0">Auch:</span>
        ${''}
        <button type="button" id="feQuelleEtikettBtn" onclick="document.getElementById('fe_eti_up').click()" title="Etikett-Foto vom Rechner wählen — Riki liest es" class="feChipLila">🏷 Etikett-Foto</button>
        <button type="button" onclick="fgUseKundenfoto('e')" title="Foto aus der Scan-Warteschlange dieses Nutzers verwenden" class="feChipHell">🗂 Kundenfoto</button>
        <button type="button" onclick="fgPullOff()" title="Open Food Facts über die EAN abfragen" class="feChipGruen">🏷 OFF</button>
        <button type="button" onclick="fgPullUsda()" title="Generische Nährwerte aus USDA FoodData Central (englischer Name)" class="feChipBg">USDA</button>
        <button type="button" onclick="document.getElementById('fe_res_up').click()" title="Foto → Riki sucht die passende Herstellerseite" class="feChipHell">📸 Foto → Seite</button>
      </div>
      <input type="file" id="fe_res_up" accept="image/*" multiple class="feVersteckt" onchange="fgPullResearch(this.files)">
      <input type="file" id="fe_eti_up" accept="image/*" multiple class="feVersteckt" onchange="fgPullEtikett(this.files)">
      <!-- fe_pullMsg bleibt (mehrere Lesewege schreiben ihren Status hierher, §1.11n-j),
           startet aber LEER: der Erklaersatz stand bei jedem Produkt und war laengst gelesen. -->
      <div id="fe_pullMsg" style="color:var(--muted)"></div>
    </div>
      ${''}
      ${''}
      <div id="feKopfGrid">
        ${''}
        <div class="feKartenTitel feKopfTitel">Kopfdaten<span class="feKartenZusatz">Pflicht: Name und Kategorie</span></div>
        <div class="mzr">
          <div class="mz mz-2"><k>Produktname *</k><input id="fe_name" value="${esc(d.name||"")}" oninput="try{fePlaus()}catch(e){};try{feDubPruefen()}catch(e){};try{feKopfbandSync()}catch(e){}" placeholder="Produktname…"></div>
          <div class="mz"><k>EAN / Barcode</k><input id="fe_ean" class="fld" value="${esc(d.ean||"")}" oninput="try{feEanSync()}catch(e){};try{feDubPruefen()}catch(e){}" placeholder="z. B. 4001724040842"></div>
          ${''/* Das versteckte EAN-Status-<select> bleibt die einzige Speicherquelle für die sichtbaren Chips. */}
          <div class="mz"><k>EAN-Status</k>
            <select id="fe_ean_status" class="feVersteckt" onchange="try{feEanRender()}catch(e){};try{fePlaus()}catch(e){}">
            <option value=""${feEanVorwahl(d)===""?" selected":""}>— noch nicht entschieden —</option>
            <option value="noch_nicht_erfasst"${feEanVorwahl(d)==="noch_nicht_erfasst"?" selected":""}>Barcode gibt es, wir haben ihn noch nicht</option>
            <option value="kein_barcode"${feEanVorwahl(d)==="kein_barcode"?" selected":""}>Produkt hat keinen Barcode</option>
            <option value="generisch"${feEanVorwahl(d)==="generisch"?" selected":""}>Generisches Produkt ohne Marken-Barcode (Auslaufwert)</option>
          </select>
            <div id="fe_eanChips" title="Nur wichtig, wenn oben keine EAN steht. Keine dieser Angaben blockiert die Freigabe – sie sagen nur, WARUM keine da ist."></div>
            <div id="fe_eanHint" class="mzHint"></div>
          </div>
          <div class="mz"><k>Marke</k>${inp("fe_marke",d.marke)}</div>
          <div class="mz"><k>Kategorie *</k>${katSelectHtml("fe_kat",d.kategorie,"width:100%;box-sizing:border-box;height:34px;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font-size:13px")}</div>
          ${''/* Die Unterkategorie steuert die Mineralwasser-Darstellung über den bestehenden Kategorievertrag. */}
          <div class="mz"><k>Unterkategorie</k><input id="fe_ukat" class="fld" value="${esc(d.unterkategorie||"")}" oninput="try{feWirkAnsicht()}catch(e){}" placeholder="nicht erfasst"></div>
          <div class="mz"><k>Bezugsbasis</k><input id="fe_basis" class="fld" value="${esc(d.basis||"100g")}" placeholder="100g"></div>
          <div class="mz mz-2"><k>Bio / Öko</k>
            <select id="fe_bio" onchange="feBioChange()" class="feVersteckt"><option value="">nicht geprüft</option><option value="ja">Bio (EU-Öko-VO)</option><option value="nein">kein Bio</option></select>
            <div id="fe_bioSw" title="Trägt das Produkt eine Bio-Kennzeichnung nach EU-Öko-Verordnung 2018/848? Merkmal und Filter – es gibt KEINE Punkte im Index (Prinzip 4)."></div>
          </div>
          ${''/* Das versteckte Bio-<select> bleibt Speicherquelle; die sichtbaren Chips bedienen es. */}
          <div class="mz mz-2"><k>Ernährungsform</k>
            <div id="fe_ernaehrChips" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"></div>
            <div id="fe_ernaehrHint" class="mzHint"></div>
          </div>
          <div class="mz mz-4"><k>Verzehrempfehlung / Tagesdosis</k>${inp("fe_verzehr",d.dosis_text||"")}
            <div class="mzHint" title="Worauf sich die Werte beziehen – z. B. „2 Kapseln pro Tag“, „1 Portion = 6 g“. Bei Nahrungsergänzung wichtig: Der EFSA-Grenzwert ist ein Tageswert; ohne diese Angabe weiß niemand, worauf sich die Prozente beziehen. Leer lassen, wenn nichts angegeben ist.">z. B. „2 Kapseln pro Tag“ · bei Supplements wichtig (EFSA = Tageswert) · leer = nicht angegeben</div>
          </div>
        </div>
        <div id="fe_bioHint"></div>
      </div>
      <div class="feMinw0">
        ${card(`Produktbild <span class="feKartenZusatz">(optional, wird öffentlich gezeigt)</span>`,`<div id="fe_bildPreview">${d.bild_url?`<img src="${esc(d.bild_url)}" class="feBildVorschau">`:'<span class="feHinweisGrau">kein Bild</span>'}</div><input type="file" accept="image/*" onchange="fgImgUpload(this)" class="feDateiFeld"><button type="button" onclick="fgBildLoeschen()" class="feBtnRot">🗑 Bild löschen</button><div id="fe_bildMsg" style="color:var(--muted)"></div>`
          + ((!d.bild_url && d.bild_url_off) ? `<div id="fe_bildOff"><div class="feKastenTitel">Bild von OpenFoodFacts – nur intern</div><img src="${esc(d.bild_url_off)}" class="feBildOffImg" alt=""><div class="feKastenFuss"><b>Wird dem Nutzer NICHT gezeigt.</b> Lizenz (CC-BY-SA) noch nicht geklärt – siehe FAHRPLAN. Nur zum Abgleich beim Erfassen.</div></div>` : "")
          + `<div class="feEtikettBox"><div class="feEtikettKopf"><div class="feEtikettTitel">Angehängte Fotos <span id="fe_etikettCount"></span> – zum Nachschauen</div><button type="button" onclick="document.getElementById('fe_etikett_up').click()" class="feBtnLilaKlein">+ Foto</button></div><input type="file" id="fe_etikett_up" accept="image/*" multiple class="feVersteckt" onchange="fgEtikettAddUpload(this.files)"><div id="fe_etikettGrid" style="display:flex"></div><div class="feKastenFuss">Vom Nutzer im Laden erfasst oder selbst hochgeladen. <b>Werden nicht veröffentlicht</b> – nur zum Abgleich. <b>Klick</b> = groß · <b>Rechtsklick</b> = Riki-Menü.</div></div>`
        )}
        ${''}
      </div>
    </div>
        ${''/* Flex-Kinder müssen schrumpfen dürfen; scrollende Listen behalten ihren eigenen Flex-Vertrag. */}
<style>#fe_gridA .cardFB > *{flex-shrink:0}
/* 05.08. (Ralphs Fund „der rechte container wurde einfach abgeschnitten"): Zug 1 hat die
   Referenz-Inhalte in den Wrapper fe_refFront gewickelt. Als direktes cardFB-Kind fiel der
   unter die flex-shrink:0-Schutzregel eine Zeile hoeher und wuchs als display:block auf seine
   Inhaltshoehe (gemessen 1308px in einer 430px-Karte) – die Liste konnte nie intern scrollen,
   der Rest lief unsichtbar unter den Kachel-Streifen. Diese Regel macht den Wrapper zur
   Flex-Durchreiche; seine Kinder tragen ihr flex bereits inline (fe_enthalten 1 1 auto,
   Eingabezeile und Legende 0 0 auto – dafuer waren sie gebaut, bevor Zug 1 sie wickelte).
   BEWUSST als CSS-Regel statt inline: fgRefV2Anzeigen schaltet mit style.display=leer/none
   um, und ein Inline-display:flex waere beim ersten Umschalten geloescht worden (§1.11n-dd).
   05.08., zweiter Anlauf (Ralph: „referenz ist auch noch abgeschnitten und nicht scrollbar"):
   Der erste Selektor hiess nur fe_refFront (Spezifitaet 1-0-0) und VERLOR das flex-shrink
   gegen die Schutzregel eine Zeile hoeher (1-1-1) – computed stand flex auf 1 0 auto, der
   Wrapper schrumpfte nie. Im Prototyp fiel das nicht auf, weil dort Inline-Styles galten
   und Inline immer gewinnt. Darum jetzt fe_gridA davor (2-1-0). Diesmal an der Live-Seite
   als CSS-REGEL nachgemessen, nicht als Inline-Prototyp. */
#fe_gridA #fe_refFront{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
#fe_colZus > div > *{flex:1 1 auto;min-width:0}
#fe_flipInner.geflippt{transform:rotateY(180deg)}
/* 05.08. (Ralph: „referenz nicht, auch nicht klassisch" - Rad tot NUR auf der Referenzkarte):
   fe_refBack liegt mit position:absolute;inset:0 DAUERHAFT ueber der ganzen Karte, nur per
   backface-visibility unsichtbar. Das nimmt aber die KINDER (Etikett-Zoombox mit
   wheel-preventDefault) nicht zuverlaessig aus dem Hit-Test - Chrome-Grauzone, backface
   vererbt nicht. Ergebnis: das Rad traf die unsichtbare Rueckseite statt der Liste.
   Darum: solange NICHT geflippt, ist die Rueckseite komplett raus (visibility nimmt auch
   alle Kinder aus dem Hit-Test, aendert kein Layout); beim Flip wird sie wieder aktiv -
   Rueckweg mitgedacht (§1.11n-nn). */
#fe_flipInner:not(.geflippt) #fe_refBack{visibility:hidden;pointer-events:none}
#fe_flipInner.geflippt #fe_refBack{visibility:visible;pointer-events:auto}
#fe_fotoMount > div{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;margin-bottom:0}
#fe_fotoMount > div > *{flex:0 0 auto;min-height:0}
#fe_fotoMount #fe_wirkFotoBox{flex:1 1 auto;height:auto;min-height:280px}
#fe_fotoLeerHinweis{display:none}
#fe_fotoMount:empty + #fe_fotoLeerHinweis{display:flex}</style>
</div>
<div id="feTab2">
  <div id="feNwOben">
  <div id="feNwLinks">
        <div id="fe_nwCard" style="display:block">${card("Nährwerte pro 100 g/ml",`<label class="feNwKeine" id="fe_nwKeineLbl" style="display:none"><input type="checkbox" id="fe_nw_none" ${d.naehrwerte_nicht_verfuegbar?"checked":""} onchange="try{feNwNoneToggle(this.checked)}catch(e){}" >auf dem Etikett stehen keine Nährwerte (blockiert die Freigabe dann nicht)</label><div class="feNwEinheit"><span>Die Werte gelten je</span><select id="fe_mengenEinheit" onchange="feEinheitChange()" title="Worauf beziehen sich die Nährwerte? Steht auf dem Etikett – bei Flüssigem meist 100 ml. Riki trägt es ein, wenn er es liest." ><option value="">100 g / ml – nicht festgelegt</option><option value="g">100 g</option><option value="ml">100 ml (flüssig)</option></select><span id="fe_ehHint" ></span></div><div class="feNwRaster">${nf("kcal","Energie","kcal")}${nf("fett","Fett","g")}${nf("ges_fett","davon gesättigte","g")}${nf("einfach_unges","davon einfach ungesättigte","g")}${nf("mehrfach_unges","davon mehrfach ungesättigte","g")}${nf("transfette","davon Transfettsäuren","g")}${nf("kh","Kohlenhydrate","g")}${nf("zucker","davon Zucker","g")}${nf("polyole","davon mehrwertige Alkohole","g")}${nf("ballaststoffe","Ballaststoffe","g")}<label class="feNwBallast"><input type="checkbox" id="fe_ballast_nd" ${nw.ballast_nichtdekl?"checked":""} onchange="var b=document.getElementById('fe_ballaststoffe'); if(this.checked&&b&&(b.value===''||b.value==null))b.value='0'; try{fePlaus()}catch(e){}" >laut Etikett nicht angegeben</label>${nf("protein","Eiweiß","g")}${nf("salz","Salz","g")}</div><div id="fe_plaus" ></div>`)}</div>
        <span id="fe_wirkAnker"  data-note="06.08.2026: Die Wirkstoff-Karte hat einen FESTEN Ort im Reiter Naehrwerte. Nichts wird mehr verschoben - der Anker bleibt nur als Sprungmarke."></span><div id="fe_wirkCard">
          <div id="fe_wirkGrid">
            ${''/* Mineralwasser verwendet die bestehende Mineralstoffanalyse-Karte. */}
            <div id="fe_wirkTblCol">${card(`<span id="fe_wirkTitel">Wirkstoffe &amp; Dosis</span> <span id="fe_wirkTitelZusatz" class="feKartenZusatz">(Nahrungsergänzung – für den Dosis-Check)</span>`,`
          <div class="feWirkHinweis" id="fe_wirkHinweis">Mengen <b>pro Tagesdosis</b> laut Etikett (worauf sich die Verzehrempfehlung oben bezieht). Damit rechnet der Dosis-Check gegen <b>Tagesbedarf (NRV)</b> und <b>EFSA-Grenze</b>. Schreibweise wie auf dem Etikett, z. B. „Vitamin C“, „Zink“, „Vitamin B7 (Biotin)“.</div>
          ${''/* 🔴 WORK #305, 26.08.2026 — RALPH: "meine frau hat 6 g angegeben, der
                 magnesiumanteil wird nicht in den naehrwerten erfasst."
                 GEMESSEN, warum: cb_tagebuch_mikro hat vier Quellen, und nur EINE
                 kennt die eingetragene Menge - sie liest Produkt_Mikronaehrstoffe
                 JE 100 G. Fuer P1045 war die Tabelle leer, also ergaben 6 g Pulver
                 0 mg Magnesium. Die Bezugsgroesse "3,5 g" stand nur als Fliesstext.
                 Ohne diese Zahl kann niemand umrechnen - deshalb steht sie ab hier
                 als Zahl hier, direkt neben den Mengen, auf die sie sich bezieht. */}
          <div class="feWirkHinweis" id="fe_wirkDosisBox" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px">
              <b>Eine Tagesdosis wiegt</b>
              <input type="number" id="fe_portionG" step="0.01" min="0" style="width:88px;padding:5px 6px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);text-align:right"
                     title="Die Menge, auf die sich die Mengen unten beziehen - als ZAHL, nicht als Satz. Erst damit kann das Tagebuch aus einer gegessenen Menge den Wirkstoffanteil ausrechnen.">
              <span>g</span>
            </label>
            <button type="button" class="feBtnAdd" style="margin:0" onclick="feDosisPruefen()"
              title="Rechnet die Mengen unten auf 100 g um und zeigt zuerst, was dabei herauskaeme. Es wird nichts geschrieben.">
              Umrechnung prüfen</button>
            <button type="button" class="feBtnAdd" style="margin:0" onclick="feDosisUebernehmen()"
              title="Schreibt die umgerechneten Werte, damit Eintraege im Tagebuch den Wirkstoffanteil mitzaehlen.">
              ✓ fürs Tagebuch übernehmen</button>
            <span id="fe_dosisMsg" style="font-size:11.5px;color:var(--muted)"></span>
          </div>
          <div class="feWirkKopf"><span>Stoff</span><span title="Steht auf dem Etikett ein Kleiner-als-Zeichen (z. B. „< 0,5 g“), gehört es hierher. Leer heißt: der Wert gilt genau so.">Zeichen</span><span class="feRe">Menge</span><span id="fe_wirkKopfEinheit">Einheit</span><span class="feRe">%NRV</span><span></span></div>
          <div id="fe_wirkRows"></div>
          <button type="button" onclick="feWirkAdd()" class="feBtnAdd">+ Wirkstoff</button>
          ${''/* Legende und Dosisstatus gehören zur Wirkstoffkarte und werden nicht separat dupliziert. */}
          <div id="fe_wirkWasserHinweis" style="display:none"></div>
          <div class="feWirkLegBox" id="fe_wirkLegBox">
            <div class="feWirkLegReihe">
              <span><span class="feAmpelGr"></span>wirksame Menge (≥ 15 % Tagesbedarf)</span>
              <span><span class="feAmpelGe"></span>EU-Nutzen, aber Dosis &lt; 15 %</span>
              <span><span class="feAmpelGra"></span>keine zugelassene EU-Aussage</span>
            </div>
            <div class="feWirkLegText">Der Balken links zeigt, ob die Menge einen <b>EU-anerkannten Nutzen</b> erreicht (gesundheitsbezogene Aussage nach VO&nbsp;432/2012 ab 15 % NRV). <b>Grün heißt „wirksame Menge", nicht „gesund".</b> Aminosäuren/Pflanzenstoffe (z. B. Glycin) haben keine zugelassene Aussage → grau.</div>
          </div>
          <label class="feWirkNone" id="fe_wirkNoneLbl"><input type="checkbox" id="fe_wirk_none" onchange="feWirkNoneToggle(this.checked)" >keine Wirkstoff-Mengen auf dem Etikett (Dosis-Check nicht möglich – blockiert die Freigabe dann nicht)</label>
          <datalist id="feWirkDL">${wirkDLOptions()}</datalist>
            `)}</div>
          </div>
        </div>
    <div id="fe_naehrKacheln" style="margin-top:10px"></div>
  <div id="fe_mikroWrap" style="display:flex" data-note="MIKRO in Spalte 2, fester Anteil der Spaltenhoehe">${cardF(`Mikronährstoffe <span class="feKartenZusatz">– je 100 g, Herkunft je Zeile</span>`,`<div class="feMikroHinweis" title="Mineralstoffe/Vitamine je 100 g. ETIKETT = auf der Packung deklariert. ABGELEITET = aus dem BLS-/USDA-Nachschlagewerk übernommen, also KEIN Beleg für DIESES Produkt (CLAUDE.md §3.2, §8.3). Bis 08.08.2026 hieß die Karte „vom Etikett deklariert“ – falsch: 16.337 von 16.354 Zeilen sind abgeleitet.">Werte <b>pro 100 g</b> · Herkunft je Zeile · <b>speichert sofort</b></div><div id="fm_mikroVorschlag" style="display:none"></div><div id="fm_mikroRows" ><span class="feMikroLaedt">lädt…</span></div><div class="feMikroAddZeile"><select id="fm_mikroStoff" onchange="fmMikroStoffChange()" ><option value="">Nährstoff…</option></select><input id="fm_mikroMenge" type="number" step="any" placeholder="pro 100g" ><select id="fm_mikroEinheit" title="Einheit laut Etikett – Vorauswahl ist die hinterlegte Einheit des Nährstoffs (Work #18)"></select><button type="button" onclick="fmMikroAdd()" class="feMikroBtn">+ setzen</button></div><div id="fm_mikroMsg" style="color:var(--muted)"></div><div class="feUsdaZeile"><input id="fm_usdaSuche" placeholder="USDA nachschlagen (z. B. brazilnut, arugula) …" onkeydown="if(event.key==='Enter'){event.preventDefault();fmUsdaSuchen();}" ><button type="button" onclick="fmUsdaSuchen()" title="Im USDA-Nachschlagewerk suchen (8.262 Lebensmittel, Selen/Cholin je 100 g)" class="feUsdaBtn">🔎 USDA</button></div><div id="fm_usdaErg" ></div>`)}<div id="fnkWrap" style="margin-top:10px"></div></div>
  </div>
  <div id="feNwFotoSlot">
            <div id="fe_wirkFotoCol">${card(`Etikett zum Ablesen <span class="feKartenZusatz">(zoombar – Mausrad / ziehen)</span>`,`
          <div class="feFotoWerkzeuge">
            <button type="button" onclick="fgWirkFotoZoomBtn(1)" title="näher heranzoomen" class="feFotoZoom">+</button>
            <button type="button" onclick="fgWirkFotoZoomBtn(-1)" title="weiter weg" class="feFotoZoom">−</button>
            <button type="button" onclick="fgWirkFotoReset()" class="feFotoBtn">Einpassen</button>
            <button type="button" onclick="fgEtikettAlsProduktbild(this)" title="Das gerade angezeigte Etikettfoto als Produktbild übernehmen" class="feFotoBtn">🖼 Als Produktbild</button>
            <button type="button" onclick="fgWirkFotoRiki(this)" title="Riki liest das angezeigte Bild aus (Nährwerte/Zutaten/Wirkstoffe)" class="feBtnRiki">🤖 Riki liest das Bild</button>
            <span id="fe_wirkFotoNav" ></span>
          </div>
          <div id="fe_wirkFotoBox" data-note="28p: Hintergrund dunkler in Flieder (Ralph: mehr Kontrast zu hellen Etiketten). Hoehe: ausserhalb der Flip-Rueckseite clamp wie gehabt; AUF der Rueckseite dehnt die CSS-Regel #fe_fotoMount die Box auf die Resthoehe." style="height:clamp(150px,18vh,250px)"><div id="fe_wirkFotoLeer" style="display:flex">Kein Etikett angehängt.<br>Über den Foto-Tab oben oder „+ Foto" (Bild-Karte) ein Etikett hinzufügen – es erscheint dann hier zum Ablesen.</div><img id="fe_wirkFotoImg" alt="Etikett" draggable="false" style="transform-origin:0 0;display:none"></div>
          <div class="feFotoFuss">Mausrad = zoomen · ziehen = verschieben · Doppelklick = großes Vollbild.</div>
            `)}</div>
  </div>
  </div>
</div>
<div id="feTab3"><div id="fe_quickBar" data-note="30.07. (Ralph: 'die zuordnungszeile kannst du ausblenden, nutze ich nicht'): Schnelleingabe VERSTECKT, nicht geloescht - fgQuickGo und das Eingabefeld bleiben erreichbar (§1.11n-j), und wer sie zurueckwill, setzt display auf flex."><span class="feQuickIcon" title="Schnelleingabe">⚡</span><input id="fe_quickIn" onkeydown="if(event.key==='Enter'){event.preventDefault();fgQuickGo();}" placeholder="Schnelleingabe – egal was: „Kaliumsorbat“, „E202“, „Jod 200 µg“, „Kreatin-Monohydrat 3500 mg“ … die Maske ordnet selbst zu"><button type="button" onclick="fgQuickGo()" class="feBtnZuordnen">Zuordnen</button></div><div id="fe_quickMsg"></div><div id="fe_gridA" data-note="KONZEPT D (Ralph-Entscheid 26.07.): DREI Spalten mit fester Bildschirmhoehe. Jede Spalte scrollt fuer sich, die SEITE scrollt nie - dadurch verschiebt sich nichts mehr und alles hat einen festen Ort. Spalte 1 Zutaten, Spalte 2 Zusatzstoffe + Mikros, Spalte 3 Etikett + Referenz. Kein sticky mehr: nichts legt sich mehr ueber etwas anderes." style="grid-template-columns:minmax(0,1fr) minmax(340px,1.18fr);height:calc(100vh - ${FE_GRID_BASIS}px);min-height:430px" data-note13="13.08.2026: ZWEI Spalten statt drei. Die mittlere war der Zusatzstoff-Kasten; er ist jetzt display:none und damit KEIN Rasterkind mehr. Bliebe die Vorlage dreispaltig, rutschte die Etikettkarte in die schmale 1fr-Spalte und die 340px-Spalte bliebe leer – die Karte wurde am 26.07. ausdruecklich breiter gebaut." data-note28w="30.07.: Basis 289 -> FE_GRID_BASIS (217), weil die Schnelleingabe-Leiste (~54px) und die Ueberschrift (~18px) auf Ralphs Wunsch weg sind. Steht der Kachel-Streifen darunter, zieht feNaehrKachelnSync seine GEMESSENE Hoehe zusaetzlich ab - kein geratener Pixelwert, und er passt sich an, wenn eine Kachel mehr dazukommt."><div id="fe_colZut">${cardF(`<span id="fe_zutLabel">Produktbestandteile</span> <span id="fe_zutLabelZusatz" class="feKartenZusatz">(eine Zeile je Bestandteil – Zusatzstoff inbegriffen)</span>`,`
          <details class="feRikiBox">
            <summary class="feRikiTitel">🤖 Riki – Zutatenliste analysieren</summary>
            <div class="feMt8">
            <textarea id="rikiText" rows="2" placeholder="Zutatenliste vom Etikett hier einfügen…"></textarea>
            <div class="feBtnReihe">
              <button type="button" onclick="rikiAnalyse()" class="feBtnLilaVoll">Analysieren</button>
              <button type="button" onclick="fgOffZutaten()" class="feBtnGruenRand">OFF-Gegenprobe</button>
              <button type="button" onclick="rikiBudget()" class="feBtnLilaHell">Verbrauch</button>
            </div>
            <div id="rikiMsg"></div>
            </div>
          </details>
          <datalist id="fgZutDL">${(ZUTATEN_STAMM||[]).map(z=>`<option value="${esc(z.name)}"></option>`).join("")}</datalist>
          <input id="fe_zutSuche" oninput="fgPickRender()" placeholder="🔍 Zutat / Wirkstoff im Stamm suchen…">
          ${''}
          <div id="fe_zutSammelLeiste"></div>
          <div id="fe_zutSammelBox"></div>
          ${''}
          <div class="feListKopf fgBestKopf"><span title="enthalten / Status">STATUS</span><span>BESTANDTEIL</span><span>VERARBEITUNG</span><span>ZUSATZSTOFF</span><span class="feRe">WERT</span></div>
          <div id="fe_pickList" data-note="Konzept D: fuellt die Kartenhoehe und scrollt selbst - vorher feste 420px, die zusammen mit Riki-Block und Suchfeld die Karte zu hoch machten"></div>
          <div class="feNeuZeile">
            <input id="fe_zutNeu" onkeydown="if(event.key==='Enter'){event.preventDefault();fgPickAddNeu();}" placeholder="nicht im Stamm? Name eintippen…">
            <button type="button" onclick="fgPickAddNeu()" class="feBtnStamm">+ hinzufügen</button>
          </div>
          <div id="fe_zutNeuInfo"></div>
          ${''/* Offene Referenzzeilen bleiben innerhalb der Referenzkarte sichtbar. */}
          <div id="fe_zusKeineSlot"></div>
          <div id="fe_zutRows" class="feVersteckt">${(d.zutaten||[]).map(z=>fgZutRow(z.name,z.rating,z.kritisch)).join("")}</div>
          <button type="button" id="fe_addZutBtn" onclick="fgAddZutat()" class="feVersteckt">+ Zutat</button>
          <div id="fgOffBox"></div>`)}</div>${''/* Der separate Zusatzstoffkasten bleibt aus der Ansicht; die Daten bleiben im bestehenden Zutatenbereich. */}<div id="fe_colZus" style="display:none" data-note="13.08.2026 ausgeblendet (Ralph P2): Zusatzstoffe sind jetzt Merkmal der Bestandteilzeile links. DOM bleibt, weil fgEditSave die versteckten Felder liest." id="fe_colZusMik"><div class="feSpalteFlex">${cardF("Zusatzstoffe",`
          <label class="feZusKeineLbl"><input type="checkbox" id="fe_zusKeine" onchange="zusKeineToggle(this.checked)">Keine Zusatzstoffe im Produkt</label>
          ${''}
          ${''}
          <input id="fe_zusSuche" oninput="zusRenderPick()" placeholder="🔍 Zusatzstoff / E-Nummer suchen…">
          <div id="fe_zusList"></div>
          <div class="feNeuZeile2"><input id="fe_zusNeu" onkeydown="zusNeuKey(event)" placeholder="nicht im Stamm? Name / E-Nummer…"><button type="button" onclick="zusAddNeu()" class="feBtnStamm">+ hinzufügen</button></div>
          <div class="feZusLegende"><span><span class="feZusPunktGr"></span>unbedenklich</span><span><span class="feZusPunktRt"></span>abgewertet (drückt den Index)<span><span class="feZusPunktGrau"></span>ungeprüft</span></div>
          <input type="hidden" id="fe_ztext" value="${esc(d.zusatzstoffe_text)}">
          <input type="hidden" id="fe_zstatus" value="${esc(d.zusatzstoffe_status)}">
          ${''/* Das gespeicherte Süßstofffeld bleibt erhalten, obwohl keine separate Handeingabe angezeigt wird. */}
          <input type="hidden" id="fe_suess" value="${esc(d.suessstoffe||"nein")}">
        `)}</div></div><div id="fe_colRef">${_refCard}</div></div></div>
        ${''}
        ${''}
        <div id="feAbgleich" style="display:none"></div>
        <div id="feAbschluss" style="display:none"></div>
        <div id="feSchrittFuss"></div></div>
      ${''/* Die Kontextspalte wird schrittabhängig vom bestehenden Renderer gefüllt. */}
      <div id="feKontext" style="display:none"></div></div>
    ${/* Der Nährstoffstreifen erscheint nur für Produktarten mit vorhandener fachlicher Quelle. */""}
    ${''}

    <div id="fe_fussLeiste">
      <div id="fe_msg" style="font-weight:600"></div>
      <div id="fe_riegelRow" style="display:flex">
        <span class="feFussLabel">Freigabe</span>
        <div id="fe_riegel"></div>
      </div>
      <div class="feFussZeile">
      <div class="feFussLinks">
        <div id="fe_ready"></div>
        ${targetEl?`<button onclick="try{feScorePreview()}catch(e){}" class="feFussBtn">↻ Index neu</button>
        ${id?`<button onclick="peAlsNutzer('${esc(id)}')" class="feFussBtn">👁 Als Nutzer</button>`:""}`:""}
      </div>
      <div class="feFussRechts">
        ${targetEl&&id?`<button onclick="fgProduktLoeschen()" class="feFussBtnRot">Löschen</button>`:""}
        ${targetEl?`<button onclick="peNeu()" class="feFussBtnGross">Neu</button>`:""}
        ${''}
        ${targetEl?`<button onclick="peClose()" class="feFussBtnZu">Schließen</button>`:""}
      </div>
      </div>
    </div>`;
    /* Vollbildmodus nutzt dasselbe Overlay; die Klasse besitzt den Layoutvertrag. */
    if(!targetEl){
    var _ov=document.getElementById("overlay"), _pn=document.getElementById("panel");
    if(_ov){ _ov.classList.add("fgEditorFull"); _ov.style.background="var(--bg)"; _ov.style.backdropFilter="none"; _ov.style.padding="0"; _ov.style.alignItems="stretch"; _ov.style.justifyContent="stretch"; _ov.style.left="0"; _ov.style.zIndex="70"; }
    if(_pn){ _pn.style.maxWidth="none"; _pn.style.width="100%"; _pn.style.height="100vh"; _pn.style.maxHeight="100vh"; _pn.style.borderRadius="0"; _pn.style.background="var(--bg)"; _pn.scrollTop=0; }   /* Panelgrund bleibt transparent zum Vollbildhintergrund. */
    }
    try{ var _katEl=document.getElementById("fe_kat"); if(_katEl) _katEl.addEventListener("change", feKatChange); }catch(e){}
    try{ await katKonfigLoad(); }catch(e){}    
    try{ feEinheitPrefill(d); }catch(e){}    
    try{ feBioPrefill(d); }catch(e){}        
    try{ feKatChange(); }catch(e){}
    try{ feDreiReiterInit(); feStationBeobachten(); }catch(e){ console.error("One-Page-Layout:",e); }
    /* 27.08.2026: Riegel messen (additiv, lesend, Anzeige in Editor-Optik). */
    try{ feRiegelLauf((window._fgEdit&&window._fgEdit.id)||id); }catch(e){ console.error("Riegel:",e); }
    try{ feUrlLblSync(); }catch(e){}
    try{ keinScoreKatsLaden().then(function(){ try{ feKatChange(); }catch(e){} }); }catch(e){}   /* 28z3: Kein-Score-Liste nachladen, Layout+Pflichten dann korrekt */
    try{ fmMikroLoad((window._fgEdit&&window._fgEdit.id)||''); }catch(e){}   /* setzt Label „Wirkstoffe" bei Supplement + fePlaus */
    try{ fnkLaden((window._fgEdit&&window._fgEdit.id)||''); }catch(e){ console.error('[Naehrstoffklassen] Laden:',e); }    
    try{ feWirkLoad(d.wirkstoffe, d.wirkstoffe_nicht_verfuegbar); }catch(e){}   /* Wirkstoff-Mengen (Dosis) laden */
    try{ feWirkHerkunft((window._fgEdit&&window._fgEdit.id)||''); }catch(e){}    
    try{ fgPickRender(); fgPickRefreshView(); fgPickObserve(); }catch(e){}   /* Picker + Textbox aus #fe_zutRows aufbauen */
    /* Zusatzstoff-Liste (neu): Stamm laden, Auswahl aus dem gespeicherten Text ableiten, farbig rendern. */
    try{ feZusKeineUmhaengen(); }catch(e){ console.error("[Zusatzstoffe] Haken:", e); }    
    (async function(){ try{ await loadZusatzstoffeStamm(); zusSeed(d.zusatzstoffe_text||""); zusRenderSel(); zusRenderPick();
      try{ feZusKeineUmhaengen(); }catch(e){}   /* zusRenderSel kann die Spalte neu zeichnen – dann erneut umhängen */
      try{ fgEnthaltenRender(); }catch(e){}
      try{ fePlaus(); }catch(e){}
    }catch(e){} })();
    try{ fgEtikettRender(); }catch(e){}   /* angehängte Fotos (Laden + selbst hochgeladen) rendern */
    try{ feEanSync(); }catch(e){}   /* fehlt die EAN, „offen"-Haken automatisch setzen */
    try{ fgRefV2Init(); }catch(e){ console.error("[Referenz V2] Init:", e); }   /* Etappe 4 Zug 1: Umschalter setzen, bei V2 die beiden LESE-RPCs rufen */
    try{
      if(typeof feFokusNavBauen==="function"){
        feFokusNavBauen();
        feFokusSchritt(1);
      }
    }catch(e){ console.error("[Fokus-Editor] Init:", e); }
    try{ if(id && typeof fgCanonLaden==="function"){
      /* 🔴 23.08.2026, Work #227 — fgZuordnungLaden ist hier ABSICHTLICH NICHT MEHR
         im Promise.all. Gemessen mit EXPLAIN ANALYZE an P51114:
           cb_admin_zutat_zuordnungsstatus   5.183 ms
           cb_admin_zutat_offen_mit_riki     2.325 ms
         In einem Promise.all bestimmt der LANGSAMSTE, wann gerendert wird - der
         Editor stand also gut fuenf Sekunden, bevor ueberhaupt etwas zu sehen war.
         Eingebaut habe ich diesen Aufruf selbst in Stufe 5, ohne die Laufzeit zu
         messen; ich hatte nur geprueft, ob die Antwort stimmt.
         Jetzt: die drei schnellen Lader rendern sofort, der Zuordnungsstand kommt
         nach. Das ist gefahrlos, weil alle Leser den fehlenden Stand bereits als
         UNBEKANNT behandeln (_fgFreieZutaten gibt null zurueck, zOhneStamm bleibt
         null, fgZuordnungWort faellt auf den Sammelbegriff) - und weil
         fgZuordnungLaden die Anzeige selbst nachzieht, sobald die Antwort da ist.
         Die eigentliche Langsamkeit gehoert damit nicht behoben, nur die Wartezeit.
         Serverseitig liegt sie als #227 bei ChatGPT. */
      Promise.all([ fgCanonLaden(id),
                    (typeof fgZusV2Laden==="function")?fgZusV2Laden(id):Promise.resolve(),
                    (typeof fgZutOffenLaden==="function")?fgZutOffenLaden(id):Promise.resolve() ])
        .then(function(){
          try{ fgCanonAnwenden(); }catch(e){ console.error("[Canonical] anwenden:",e); }
          try{ if(typeof fgPickRender==="function") fgPickRender(); }catch(e){ console.error("[Bestandteile] Erstaufbau:",e); }
          /* 29.08.2026, Ralphs Fund: die Huelle "Teigwaren" stand rechts in der
             Referenz weiter, obwohl der Filter gebaut war. GEMESSEN: die
             Referenz wird beim Oeffnen gerendert, _fgCanon kommt erst danach -
             und nur _fgCanon weiss, welche Zeile eine Huelle ist. Der Filter
             lief also gegen eine leere Liste und liess alles durch.
             Hier wird sie nachgezogen, sobald der Vertrag da ist. */
          try{ if(typeof fgEnthaltenRender==="function") fgEnthaltenRender(); }catch(e){ console.error("[Referenz] Nachlauf:",e); }
          try{ fePlaus(); }catch(e){}
        });
      /* Laeuft daneben, blockiert die erste Anzeige nicht. */
      if(typeof fgZuordnungLaden==="function"){
        fgZuordnungLaden(id).catch(function(e){ console.error("[Zuordnung] Nachlauf:", e); });
      }
    } }catch(e){ console.error("[Canonical] Init:", e); }
    try{ if(id && typeof fgRefStatusLaden==="function"){ fgRefStatusLaden(id).then(function(){ try{ fePlaus(); }catch(e){} }); } }catch(e){ console.error("[Status] Init:", e); }
    try{ if(typeof feAnsichtGet==="function" && feAnsichtGet()==="vorgang") feVorgangApply(); }catch(e){}    
  try{
    window._fgEdit=window._fgEdit||{};
    /* Work #305: portion_g kommt aus cb_produkt_edit_get laengst mit - es wurde nur
       nirgends angezeigt. Fehlt die Zahl, wird der Fliesstext DANEBEN gestellt, nicht
       daraus geparst: "3,5 g Pulver (ca. ein gehaeufter Teeloeffel)" laesst sich raten,
       und geraten wird hier nicht. Ralph liest den Satz und traegt die Zahl ein. */
    try{
      var _pg=document.getElementById("fe_portionG");
      if(_pg){
        if(d.portion_g!=null && d.portion_g!=="") _pg.value=String(d.portion_g);
        var _pt=String(d.portionsgroesse_text||d.Portionsgroesse_Text||"").trim();
        if(_pt) _pg.title="Laut Etikett: „"+_pt+"“ – trag die Zahl daraus hier ein.";
        if(!_pg.value && _pt && typeof _feDosisMsg==="function"){
          _feDosisMsg("Etikett sagt: „"+_pt+"“ – als Zahl fehlt sie noch, deshalb zählt das Produkt im Tagebuch mit 0.","var(--k-b45309)");
        }
      }
    }catch(e){ console.error("[#305 Portion_g anzeigen]",e); }
    window._fgEdit.hatteWirkstoffe=Array.isArray(d.wirkstoffe)&&d.wirkstoffe.length>0;
    window._fgEdit.hatteZutaten=Array.isArray(d.zutaten)&&d.zutaten.length>0;
    window._fgEdit.zutStart=Array.isArray(d.zutaten)?d.zutaten.map(function(z){
      return {name:z.name, rating:z.rating, kritisch:z.kritisch}; }):[];
    window._fgEdit.hatMakros=!!(d.naehrwerte&&Object.keys(d.naehrwerte).some(function(k){ return d.naehrwerte[k]!=null&&d.naehrwerte[k]!==""; }));
    window._fgEdit.zusStart={ text:String(d.zusatzstoffe_text||""), status:String(d.zusatzstoffe_status||"") };
    var _dirtyHook=function(id,bereich){ var el=document.getElementById(id); if(!el||el._fgDirtyHooked) return; el._fgDirtyHooked=true;
      el.addEventListener("input",function(){ if(window._fgDirtyArmed&&window._fgDirty) window._fgDirty[bereich]=true; });
      el.addEventListener("change",function(){ if(window._fgDirtyArmed&&window._fgDirty) window._fgDirty[bereich]=true; }); };
    _dirtyHook("fe_wirkRows","wirk"); _dirtyHook("fe_wirk_none","wirk");
    _dirtyHook("fe_nwCard","makro");
    _dirtyHook("fe_zutRows","zut"); _dirtyHook("fe_pickList","zut"); _dirtyHook("fe_zutNeu","zut");
    try{
      var _zc=document.getElementById("fe_zutRows");
      if(_zc && !_zc._fgZutObs && typeof MutationObserver!=="undefined"){
        _zc._fgZutObs=new MutationObserver(function(){
          if(window._fgDirtyArmed && window._fgDirty) window._fgDirty.zut=true;
        });
        _zc._fgZutObs.observe(_zc,{childList:true,subtree:true});
      }
    }catch(e){ console.error("Zutaten-Beobachter:",e); }
    setTimeout(function(){ window._fgDirtyArmed=true; },0);
  }catch(e){ console.error("Dirty-Init:",e); }
  if(!targetEl) document.getElementById("overlay").classList.add("open");
}
async function keinScoreKatsLaden(){
  if(window._ksKats) return window._ksKats;
  try{ var r=await client.rpc('cb_kein_score_kategorien');
    if(r && !r.error && Array.isArray(r.data)) window._ksKats=new Set(r.data.map(function(x){ return String(x||'').toLowerCase(); }));
  }catch(e){}
  return window._ksKats||null;
}
/* Kategorie-Wechsel im Editor: bei „Supplement" heisst die Zutaten-Sektion „Wirkstoffe"
   (da stehen die Wirkstoffe drin, nicht Lebensmittel-Zutaten) und die Vorschlagsliste
   blendet Lebensmittel aus. Sonst normal „Zutaten". */
function feKatChange(){
  try{ if(typeof feBallastPruefen==="function") feBallastPruefen(); }catch(e){}
  var kat=(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase());
  var supp=(kat==="supplement"), salz=(kat==="salze");
  var lbl=document.getElementById("fe_zutLabel"); if(lbl) lbl.textContent="Produktbestandteile";
  var lblz=document.getElementById("fe_zutLabelZusatz");
  if(lblz) lblz.textContent="(eine Zeile je Bestandteil · Zusatzstoffe integriert)";
  var ab=document.getElementById("fe_addZutBtn"); if(ab) ab.textContent=supp?"+ Wirkstoff":"+ Zutat";
  try{ feNaehrBtnSync(); }catch(e){}
  window._feDub=undefined; try{ feDubPruefen(); }catch(e){}
  window._feBallast=undefined; try{ feBallastPruefen(); }catch(e){}
  try{ feNaehrKachelnSync(); }catch(e){}

  try{ feDreiReiterInit(); }catch(e){}
  var nw=document.getElementById("fe_nwCard");
  var _nwP=(typeof feNaehrwertPflicht==="function")?feNaehrwertPflicht():{art:"lebensmittel"};
  if(nw) nw.style.display=(_nwP.art==="mineralwasser")?"none":"block";
  /* Work #576: Der Haken "keine Naehrwerte" gehoert nur dorthin, wo das
     vorkommt - Supplement (Kapsel, Tropfen) und die Kategorien ohne Index.
     Bei einem Lebensmittel ist eine fehlende Naehrwerttabelle keine Variante,
     sondern eine Luecke; dort bleibt er weg. */
  try{ feNwKeineSicht(); }catch(e){}
  var wc=document.getElementById("fe_wirkCard");
  if(wc) wc.style.display="";
  var mw=document.getElementById("fe_mikroWrap"); if(mw) mw.style.display="flex";
  try{ bezugLaden().then(function(){ try{ feWirkFarbeAll(); }catch(e){} try{ feWirkAnsicht(); }catch(e){} }); }catch(e){}
  try{ feWirkAnsicht(); }catch(e){ console.error("[Wirkstoff-Ansicht]", e); }
  try{ ladeWirkDB(); }catch(e){}   /* Auswahlliste in jeder Kategorie - die Funktion cached (window._wirkDBGeladen) */
  try{ fgFotoPlatzieren(); }catch(e){}
  try{ if(typeof fgPickRender==="function") fgPickRender(); }catch(e){}
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
}
/* ===== Wirkstoff-Mengen (Supplements) – Eingabe für den Dosis-Check =====
   Eine Zeile je Wirkstoff: Stoff · Menge · Einheit · %NRV. Wird beim Speichern über
   cb_produkt_wirkstoffe_setzen in Produkt_Naehrstoffe geschrieben. Erst damit zeigt die
   Produktkarte den Dosis-Kreis + die zwei Balken (Tagesbedarf/EFSA-Grenze). */
function feWirkRow(w){ w=w||{};
  var opt=WIRK_EINHEITEN.map(function(u){ return '<option'+(String(w.einheit||"mg")===u?' selected':'')+'>'+u+'</option>'; }).join("");
  var _bez=String(w.bezug||"").trim();
  var _neu=";try{feWirkNrvRow(this.closest('.feWirkRow'), feIstMineralwasser())}catch(e){}";
  var _op=String(w.operator==null?"":w.operator).trim();
  var _OPS=[["","–","Wert gilt genau so, wie er dasteht"],
            ["<","<","kleiner als – der Wert ist eine Obergrenze"],
            ["<=","≤","kleiner oder gleich"],
            [">",">","größer als – der Wert ist eine Untergrenze"],
            [">=","≥","größer oder gleich"],
            ["~","≈","ungefähr / Durchschnittswert"]];
  if(_op && !_OPS.some(function(o){ return o[0]===_op; })) _OPS.push([_op,_op,"unbekanntes Zeichen aus der Datenbank – bleibt erhalten"]);
  var _opOpt=_OPS.map(function(o){
    return '<option value="'+esc(o[0])+'" title="'+esc(o[2])+'"'+(_op===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';
  }).join("");
  return '<div class="feWirkRow" data-bezug="'+esc(_bez)+'" style="display:grid;grid-template-columns:var(--wirk-spalten,1fr 48px 70px 62px 56px 26px);gap:6px 6px;margin-bottom:6px;align-items:center">'
    +'<div class="fwNameCell" style="position:relative;min-width:0">'
      +'<input class="fwName" list="feWirkDL" value="'+esc(w.naehrstoff||"")+'" oninput="try{feWirkFarbeRow(this)}catch(e){};try{fePlaus()}catch(e){}'+_neu+'" placeholder="z. B. Vitamin C" style="padding:6px 22px 6px 7px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;background:var(--card);color:var(--ink);min-width:0;width:100%;box-sizing:border-box">'
      +'<span class="fwHerk" style="position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:12px;line-height:1;pointer-events:none;color:var(--muted)"></span>'
    +'</div>'
    +'<select class="fwOp" title="Vergleichszeichen vom Etikett. Leer = der Wert gilt genau so." onchange="if(window._fgDirtyArmed&&window._fgDirty) window._fgDirty.wirk=true;" style="padding:6px 2px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;text-align:center;background:var(--card);color:var(--ink);min-width:0;width:100%;box-sizing:border-box">'+_opOpt+'</select>'
    +'<input class="fwMenge" type="number" step="any" value="'+esc(w.menge==null?"":String(w.menge))+'" oninput="try{fePlaus()}catch(e){}'+_neu+'" style="padding:6px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;text-align:right;background:var(--card);color:var(--ink);min-width:0;width:100%;box-sizing:border-box">'
    +'<select class="fwEinheit" onchange="try{feWirkFarbeRow(this)}catch(e){}'+_neu+'" style="padding:6px 4px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;background:var(--card);color:var(--ink);min-width:0;width:100%;box-sizing:border-box">'+opt+'</select>'
    +'<input class="fwNrv" type="text" inputmode="decimal" value="'+esc(w.nrv==null?"":String(w.nrv).replace(".",","))+'" oninput="try{feWirkFarbeRow(this)}catch(e){}" placeholder="%" style="padding:6px;border:1px solid var(--line);border-radius:7px;font-size:12.5px;text-align:right;background:var(--card);color:var(--ink);min-width:0;width:100%;box-sizing:border-box">'
    +'<button type="button" onclick="feWirkDel(this)" title="entfernen" style="border:0;background:var(--k-fee2e2);color:var(--k-b91c1c);border-radius:7px;width:26px;height:28px;cursor:pointer;flex:0 0 auto">✕</button>'
    +'<div class="fwNote" style="grid-column:1/-1;font-size:11px;color:var(--muted);line-height:1.4;margin-top:-3px"></div>'
    +'</div>';
}
window._bezug = window._bezug || null;

async function bezugLaden(){
  if(window._bezug) return window._bezug;
  try{
    var r = await client.rpc('cb_bezugswerte');
    if(r && !r.error && r.data){
      var d = r.data;
      var mapMuster = {};
      (d.muster||[]).forEach(function(m){ mapMuster[String(m.muster||'').toLowerCase()] = m.naehrstoff; });
      var mapWert = {};
      (d.werte||[]).forEach(function(w){
        var k = w.naehrstoff;
        (mapWert[k] = mapWert[k] || {})[w.art] = w;
      });
      window._bezug = { muster: mapMuster, werte: mapWert };
    }
  }catch(e){}
  return window._bezug;
}

/* Schreibweise -> Stammname. "– davon EPA" -> "epa" -> "Omega-3 (EPA+DHA)".
   Dieselbe Vorbehandlung wie in cb_tagebuch_mikro: fuehrendes "davon" faellt weg. */
function bezugNaehrstoff(name){
  var b = window._bezug; if(!b) return null;
  var k = String(name||'').trim().toLowerCase().replace(/^[\s\-–—]*davon\s+/,'').trim();
  if(!k) return null;
  return b.muster[k] || (b.werte[name] ? name : null);
}

/* Einheiten auf eine Basis bringen. IU nur fuer Vitamin D belegt (1 µg = 40 IU),
   sonst wird NICHT umgerechnet - lieber keine Farbe als eine falsche. */
function bezugInMg(menge, einheit, naehrstoff){
  var e = String(einheit||'').toLowerCase(), m = Number(menge);
  if(!isFinite(m)) return null;
  if(e==='mg') return m;
  if(e==='µg'||e==='ug'||e==='mcg') return m/1000;
  if(e==='g') return m*1000;
  if((e==='iu'||e==='ie'||e==='i.e.') && naehrstoff==='Vitamin D') return (m/40)/1000;
  return null;
}

/* Summe aller Wirkstoff-Zeilen, die auf denselben Stammnamen zeigen.
   Gebraucht fuer EPA+DHA: die 250 mg der EFSA und der VO 432/2012 gelten fuer BEIDE
   ZUSAMMEN, auf dem Etikett stehen sie getrennt. Die Sammelzeile "Omega-3-Fettsaeuren"
   zaehlt NICHT mit - sie enthaelt auch ALA und ist nicht dasselbe. */
function bezugSummeMg(naehrstoff){
  var summe = 0, gefunden = false;
  [].forEach.call(document.querySelectorAll("#fe_wirkRows .feWirkRow"), function(r){
    var nm = ((r.querySelector(".fwName")||{}).value||"").trim();
    if(bezugNaehrstoff(nm) !== naehrstoff) return;
    /* Nur echte Einzelstoffe addieren. Eine Zeile, die den Sammelbegriff traegt
       ("Omega-3", "Omega-3-Fettsaeuren"), ist die SUMME inkl. ALA - sie mitzuzaehlen
       waere doppelt und zu hoch. */
    if(/^[\s\-–—]*omega[\s-]*3/i.test(nm)) return;
    var mg = bezugInMg(((r.querySelector(".fwMenge")||{}).value||"").replace(",","."),
                       ((r.querySelector(".fwEinheit")||{}).value||""), naehrstoff);
    if(mg!=null){ summe += mg; gefunden = true; }
  });
  return gefunden ? summe : null;
}
function feWirkFarbe(r){
  if(!r||!r.style) return;
  var nameEl=r.querySelector(".fwName"), nrvEl=r.querySelector(".fwNrv"), mgEl=r.querySelector(".fwMenge"), ehEl=r.querySelector(".fwEinheit");
  var nm=nameEl?String(nameEl.value||"").trim():"";
  var raw=nrvEl?String(nrvEl.value||"").trim().replace(",","."):"";
  var nrv=(raw===""?null:parseFloat(raw));
  var col="transparent", tip="";
  if(nm!==""){
    /* 1. Handfeld hat Vorrang: steht auf dem Etikett ein %-Wert, ist DER der belegte. */
    if(nrv!=null && isFinite(nrv) && nrv>0){
      if(nrv>=15){ col="#2e9e57"; tip="Grün: in EU-anerkannter wirksamer Menge (≥ 15 % Tagesbedarf – Aussage nach VO 432/2012 zulässig). Quelle: %NRV vom Etikett."; }
      else { col="#e0a32e"; tip="Gelb: Nährstoff mit EU-Nutzen, aber Dosis unter 15 % des Tagesbedarfs. Quelle: %NRV vom Etikett."; }
    } else {
      /* 2. Sonst selbst rechnen – aus der Menge und dem hinterlegten Bezugswert. */
      var stoff = bezugNaehrstoff(nm);
      var eintrag = (stoff && window._bezug) ? window._bezug.werte[stoff] : null;
      var mg = bezugInMg((mgEl?mgEl.value:"").replace(",","."), ehEl?ehEl.value:"", stoff);
      if(!eintrag || mg==null){
        /* 3. Kein belegter Bezugswert (Aminosäuren, Pflanzenstoffe, Gesamt-Omega-3) oder
              Einheit nicht umrechenbar → grau. Hier IST Grau die richtige Aussage. */
        col="#9aa7b2";
        tip = stoff ? "Grau: für „"+stoff+"“ ist keine Empfehlung in mg/µg belegt – deshalb keine Farbe."
                    : "Grau: kein Nährstoffbezugswert / keine zugelassene EU-Aussage (z. B. Aminosäure, Pflanzenstoff).";
      } else if(eintrag.tagesbedarf){
        var b = eintrag.tagesbedarf;
        var bmg = bezugInMg(b.wert, b.einheit, stoff);
        var pct = (bmg>0) ? (mg/bmg*100) : null;
        if(pct==null){ col="#9aa7b2"; tip="Grau: Bezugswert nicht umrechenbar."; }
        else if(pct>=15){ col="#2e9e57"; tip="Grün: "+Math.round(pct)+" % des Tagesbedarfs ("+b.wert+" "+b.einheit+") – ab 15 % ist eine Aussage nach VO 432/2012 zulässig. Berechnet, nicht vom Etikett."; }
        else { col="#e0a32e"; tip="Gelb: "+Math.round(pct)+" % des Tagesbedarfs ("+b.wert+" "+b.einheit+") – unter der 15-%-Schwelle. Berechnet, nicht vom Etikett."; }
      } else {
        /* 4. Kein Tagesbedarf, aber eine belegte Mengen-Empfehlung (EPA/DHA, ALA).
              Hier wird NIE in Prozent gerechnet – es gibt keinen Bedarf, auf den man
              sich beziehen könnte. Verglichen wird die absolute Menge. */
        var s = eintrag.zufuhrempfehlung || eintrag.aussage_schwelle;
        var smg = s ? bezugInMg(s.wert, s.einheit, stoff) : null;
        /* EPA und DHA stehen getrennt auf dem Etikett, die Empfehlung gilt für beide
           ZUSAMMEN → summieren. Bei allen anderen Stoffen ist die Summe die Zeile selbst. */
        var ist = bezugSummeMg(stoff); if(ist==null) ist = mg;
        if(smg==null){ col="#9aa7b2"; tip="Grau: Empfehlung nicht umrechenbar."; }
        else if(ist>=smg){ col="#2e9e57"; tip="Grün: "+Math.round(ist)+" mg von "+s.wert+" "+s.einheit+" empfohlener Tagesmenge"+(ist>mg?" (EPA+DHA zusammen)":"")+". "+(s.aussage||"")+" Quelle: "+(s.quelle||"")+"."; }
        else { col="#e0a32e"; tip="Gelb: "+Math.round(ist)+" mg – unter der empfohlenen Tagesmenge von "+s.wert+" "+s.einheit+". Quelle: "+(s.quelle||"")+"."; }
      }
    }
  }
  r.style.borderLeft="4px solid "+col; r.style.paddingLeft="8px"; r.title=tip;
}

function feWirkFarbeRow(el){ var r=el&&el.closest?el.closest(".feWirkRow"):null; feWirkFarbe(r); }
function feWirkFarbeAll(){ [].forEach.call(document.querySelectorAll("#fe_wirkRows .feWirkRow"), feWirkFarbe); }
function feWirkAdd(w){ var c=document.getElementById("fe_wirkRows"); if(!c) return;
  if(window._fgDirtyArmed&&window._fgDirty) window._fgDirty.wirk=true;   /* DOM-Insert loest kein input-Event aus */
  c.insertAdjacentHTML("beforeend", feWirkRow(w));
  var none=document.getElementById("fe_wirk_none"); if(none&&none.checked){ none.checked=false; feWirkNoneToggle(false); }
  try{ feWirkFarbe(c.lastElementChild); }catch(e){}
  try{fePlaus()}catch(e){}
}
function feWirkDel(btn){ var r=btn&&btn.closest?btn.closest(".feWirkRow"):null; if(r){ r.remove(); if(window._fgDirtyArmed&&window._fgDirty) window._fgDirty.wirk=true; } try{fePlaus()}catch(e){} }
function feWirkCollect(){ var out=[];
  var wasser=(typeof feIstMineralwasser==="function")&&feIstMineralwasser();
  [].forEach.call(document.querySelectorAll("#fe_wirkRows .feWirkRow"),function(r){
    var nm=((r.querySelector(".fwName")||{}).value||"").trim();
    var mgRaw=((r.querySelector(".fwMenge")||{}).value||"").trim();
    if(!nm||mgRaw==="") return;
    var nrvEl=r.querySelector(".fwNrv");
    var nrvRaw=((nrvEl||{}).value||"").trim();
    var berechnet=(nrvEl&&nrvEl.getAttribute("data-berechnet")==="1");
    var o={ naehrstoff:nm, menge:Number(mgRaw.replace(",",".")),
      einheit:((r.querySelector(".fwEinheit")||{}).value||"mg"),
      nrv:((berechnet||nrvRaw==="")?null:Number(nrvRaw.replace(",","."))) };
    var opRaw=((r.querySelector(".fwOp")||{}).value||"").trim();
    if(opRaw) o.operator=opRaw;
    var bez=String(r.getAttribute("data-bezug")||"").trim() || (wasser?"pro_liter":"");
    if(bez) o.bezug=bez;
    out.push(o);
  });
  return out;
}
function feWirkCount(){ return [].slice.call(document.querySelectorAll("#fe_wirkRows .feWirkRow")).filter(function(r){
  return ((r.querySelector(".fwName")||{}).value||"").trim()!=="" && ((r.querySelector(".fwMenge")||{}).value||"").trim()!==""; }).length; }
function feWirkNoneToggle(on){ var c=document.getElementById("fe_wirkRows"); if(c){ c.style.opacity=on?"0.4":""; c.style.pointerEvents=on?"none":""; } try{fePlaus()}catch(e){} }
/* Wirkstoffe in die Tabelle laden (aus cb_produkt_edit_get.wirkstoffe) + Flag setzen. */
function feWirkLoad(liste, none){
  var c=document.getElementById("fe_wirkRows"); if(!c) return;
  c.innerHTML=(Array.isArray(liste)?liste:[]).map(function(w){ return feWirkRow(w); }).join("");
  var n=document.getElementById("fe_wirk_none"); if(n){ n.checked=!!none; feWirkNoneToggle(!!none); }
  try{ feWirkFarbeAll(); }catch(e){}
  try{ feWirkAnsicht(); }catch(e){ console.error("[Wirkstoff-Ansicht] laden:", e); }
}
/* NRV nur aus vorhandenem Serverbezug berechnen; fehlende Empfehlung bleibt leer. */
function feZusKeineUmhaengen(){
  try{
    var slot=document.getElementById("fe_zusKeineSlot");
    var box=document.getElementById("fe_zusKeine");
    if(!slot||!box) return;
    var lbl=box.closest?box.closest("label"):null; if(!lbl) return;
    if(lbl.parentNode===slot) return;                 /* schon umgehängt */
    lbl.style.marginTop="8px";
    lbl.title="Belegt, dass auf dem Etikett keine Zusatzstoffe stehen. Erst damit kann der Server die Zusatzstoff-Achse (15 P.) rechnen – ohne Beleg bleibt sie leer (§3.4).";
    slot.appendChild(lbl);
  }catch(e){ console.error("[Zusatzstoffe] Haken umhängen:", e); }
}
if(typeof window!=="undefined"){ window.feZusKeineUmhaengen=feZusKeineUmhaengen; }
/* Übergangsvertrag: Produktart nur über Kategorie plus Positivliste bestimmen; keine Namensheuristik ergänzen. */
var MW_UNTERKAT={"mineralwasser":1, "natürliches mineralwasser":1, "naturliches mineralwasser":1};
function feIstMineralwasser(){
  var k=((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase();
  var u=((document.getElementById("fe_ukat")||{}).value||"").trim().toLowerCase();
  if(k!=="getränk" && k!=="getraenk") return false;
  return !!MW_UNTERKAT[u];
}
function feNaehrwertPflicht(){
  var kat=((document.getElementById("fe_kat")||{}).value||"").trim();
  var k=kat.toLowerCase();
  var supp=(k==="supplement"), salz=(k==="salze");
  var keinScore=!!(window._ksKats && window._ksKats.has(k));
  if(feIstMineralwasser()) return {makros_erforderlich:false, art:"mineralwasser",
    kurz:"Mineralstoffanalyse", grund:"Mineralwasser hat kein Makronährstoffprofil – gefragt ist die Mineralstoffanalyse pro Liter."};
  /* 🔴 06.09.2026, Work #576 — "eine Kapsel hat kein Makro-Profil" galt zu breit.
     Ralph, an P73700: "nicht jedes supplement hat keine nährwerte". Nachgezaehlt:
     154 von 249 Supplements tragen bereits kcal-Werte. Ein Mahlzeitenersatz mit
     600 g Pulver und voller Tabelle je 100 g ist keine Kapsel.
     Die Kategorie entscheidet das jetzt nicht mehr. Entweder es stehen Werte da,
     oder jemand hat den Haken "keine Naehrwerte deklariert" gesetzt - dann ist
     das Fehlen eine Entscheidung und keine Luecke. Solange weder das eine noch
     das andere zutrifft, bleibt Schritt 2 offen, so wie bei Lebensmitteln. */
  if(supp){
    var _nd=!!(document.getElementById("fe_nw_none")||{}).checked;
    if(_nd) return {makros_erforderlich:false, art:"supplement_ohne_nw",
      kurz:"Wirkstoffe", grund:"Ohne Nährwerte – so am Etikett angehakt."};
    return {makros_erforderlich:true, art:"supplement",
      kurz:"Nährwerte", grund:"Supplement mit Nährwerttabelle – die Werte gehören erfasst. Steht auf dem Etikett keine, den Haken setzen."};
  }
  if(salz||keinScore) return {makros_erforderlich:false, art:"kein_score",
    kurz:"Nährwerte optional", grund:"Kategorie ohne Lebensmittel-Index – Nährwerte sind hier nicht Pflicht."};
  return {makros_erforderlich:true, art:"lebensmittel", kurz:"Nährwerte", grund:""};
}
if(typeof window!=="undefined"){ window.feNaehrwertPflicht=feNaehrwertPflicht; }
/* ===== Work #576 · 06.09.2026 — Haken "keine Naehrwerte auf dem Etikett" =====
   Er ersetzt die alte Pauschale "Supplement braucht keine Naehrwerte". Sichtbar
   ist er nur, wo das wirklich vorkommt: Supplement und Kategorien ohne Index.
   Gesetzt schaltet er die Makro-Pflicht ab und leert die Felder NICHT - ein
   versehentlicher Klick soll keine Werte vernichten. */
function feNwKeineSicht(){
  var lbl=document.getElementById("fe_nwKeineLbl"); if(!lbl) return;
  var k=((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase();
  var zeigen=(k==="supplement" || k==="salze" || !!(window._ksKats && window._ksKats.has(k)));
  lbl.style.display = zeigen ? "flex" : "none";
  if(!zeigen){
    var cb=document.getElementById("fe_nw_none");
    if(cb && cb.checked){ cb.checked=false; }
  }
}
function feNwNoneToggle(an){
  /* Nur den Status nachziehen. Die Werte bleiben stehen: nimmt Ralph den Haken
     wieder raus, ist alles noch da. */
  try{ feNwKeineSicht(); }catch(e){}
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  try{ if(typeof feVorgangSync==="function") feVorgangSync(); }catch(e){}
}
if(typeof window!=="undefined"){ window.feNwKeineSicht=feNwKeineSicht; window.feNwNoneToggle=feNwNoneToggle; }
function feNrvText(pct){
  if(pct==null||!isFinite(pct)) return "";
  if(pct>0 && pct<0.01) return "< 0,01";
  var s=(pct<1)?pct.toFixed(2):pct.toFixed(1);
  s=s.replace(/(\.\d*?)0+$/,"$1").replace(/\.$/,"");
  return s.replace(".",",");
}
/* Eine Zeile: %NRV rechnen, Feld sperren, Notenzeile darunter setzen. */
function feWirkNrvRow(r, wasser){
  if(!r||!r.querySelector) return;
  var nameEl=r.querySelector(".fwName"), mgEl=r.querySelector(".fwMenge"),
      ehEl=r.querySelector(".fwEinheit"), nrvEl=r.querySelector(".fwNrv"),
      note=r.querySelector(".fwNote");
  if(!nameEl||!nrvEl) return;
  var nm=String(nameEl.value||"").trim();
  var eh=ehEl?String(ehEl.value||"mg"):"mg";
  var mengeRoh=mgEl?String(mgEl.value||"").trim():"";
  var einheitTxt=wasser?(eh+"/l"):eh;

  /* Handwert vom Etikett: unangetastet lassen, nur die Sperre wieder aufheben. */
  var berechnet=(nrvEl.getAttribute("data-berechnet")==="1");
  var handWert=(!berechnet && String(nrvEl.value||"").trim()!=="");
  if(handWert){
    nrvEl.readOnly=false; nrvEl.style.background="";
    nrvEl.title="%NRV vom Etikett – von Hand eingetragen, hat Vorrang vor der Rechnung.";
    if(note) note.innerHTML=(mengeRoh?esc(mengeRoh.replace(".",","))+" "+esc(einheitTxt)+" · ":"")
      +'<span style="color:var(--muted)">%NRV laut Etikett</span>';
    return;
  }

  var stoff=(typeof bezugNaehrstoff==="function")?bezugNaehrstoff(nm):null;
  var eintrag=(stoff && window._bezug)?window._bezug.werte[stoff]:null;
  var mg=(typeof bezugInMg==="function")?bezugInMg(mengeRoh.replace(",","."), eh, stoff):null;

  var setz=function(wert, tip, notizHtml){
    nrvEl.value=(wert==null?"—":wert);
    nrvEl.setAttribute("data-berechnet","1");
    nrvEl.readOnly=true;
    nrvEl.style.background="var(--k-f6f8f7,#f6f8f7)";
    nrvEl.style.color=(wert==null?"var(--muted)":"");
    nrvEl.title=tip;
    if(note) note.innerHTML=notizHtml;
  };
  var kopf=(mengeRoh!=="")?(esc(mengeRoh.replace(".",","))+" "+esc(einheitTxt)+" · "):"";

  if(!eintrag){
    setz(null, "Für „"+nm+"“ gibt es keinen EU-Referenzwert. Es wird bewusst nichts gerechnet.",
      kopf+'<span style="color:var(--muted)">kein EU-NRV</span>');
    return;
  }
  if(eintrag.tagesbedarf){
    var b=eintrag.tagesbedarf;
    var bmg=(typeof bezugInMg==="function")?bezugInMg(b.wert, b.einheit, stoff):null;
    if(mg==null||bmg==null||!(bmg>0)){
      setz(null, "Menge oder Bezugswert nicht umrechenbar – deshalb kein Prozentwert.",
        kopf+'<span style="color:var(--muted)">%NRV nicht berechenbar</span>');
      return;
    }
    var pct=mg/bmg*100, txt=feNrvText(pct);
    setz(txt,
      "Berechnet: "+mengeRoh+" "+eh+" von "+b.wert+" "+b.einheit+" ("+(b.quelle||"")+"). Kein Etikettwert.",
      kopf+'<span style="color:var(--muted)">'+esc(txt)+' % NRV · berechnet aus '
        +esc(String(b.wert))+' '+esc(String(b.einheit))+' ('+esc(String(b.quelle||""))+')</span>');
    return;
  }
  var s=eintrag.zufuhrempfehlung||eintrag.aussage_schwelle;
  var smg=(s&&typeof bezugInMg==="function")?bezugInMg(s.wert, s.einheit, stoff):null;
  var anteil=(mg!=null&&smg!=null&&smg>0)?feNrvText(mg/smg*100):null;
  var _wertTxt=String(s.wert);
  if(Number(s.wert)>=1000) _wertTxt=Number(s.wert).toLocaleString("de-DE");
  setz(null,
    "Für „"+stoff+"“ gibt es KEINEN EU-NRV. Belegt ist "+_wertTxt+" "+s.einheit+" ("+(s.quelle||"")+") – das ist eine Referenz, kein Kennzeichnungswert.",
    kopf+'<span style="color:var(--muted)"><b>kein EU-NRV</b> · EFSA-Referenz '
      +esc(_wertTxt)+' '+esc(String(s.einheit))+'/Tag'
      +(anteil?' · '+esc(anteil)+' % der EFSA-Referenz':'')+'</span>');
}
function feWirkNrvAlle(){
  var wasser=feIstMineralwasser();
  [].forEach.call(document.querySelectorAll("#fe_wirkRows .feWirkRow"), function(r){ feWirkNrvRow(r, wasser); });
}
/* Titel, Untertitel und Spaltenkopf je Kategorie/Unterkategorie + %NRV neu rechnen. */
function feWirkAnsicht(){
  var wasser=feIstMineralwasser();
  var kat=(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase());
  var t=document.getElementById("fe_wirkTitel"),
      tz=document.getElementById("fe_wirkTitelZusatz"),
      h=document.getElementById("fe_wirkHinweis"),
      ke=document.getElementById("fe_wirkKopfEinheit"),
      leg=document.getElementById("fe_wirkLegBox"),
      non=document.getElementById("fe_wirkNoneLbl"),
      wh=document.getElementById("fe_wirkWasserHinweis");
  if(wasser){
    if(t)  t.textContent="Mineralstoffanalyse";
    if(tz) tz.textContent="";
    if(ke) ke.textContent="Einheit";
    if(h)  h.innerHTML='Angaben <b>laut Etikett pro Liter</b>. Gespeichert wird die Einheit fachlich als '
      +'<code>mg</code> mit dem Bezug <code>pro_liter</code> – angezeigt als <b>mg/l</b>.';
    /* 🔴 Supplement-Reste ausblenden, NICHT löschen (§17). feWirkCount und
       feWirkNoneToggle lesen fe_wirk_none weiter; ein entferntes Element hätte den
       Supplement-Zweig von fePlaus mitgenommen. */
    if(leg) leg.style.display="none";
    if(non) non.style.display="none";
    if(wh){ wh.style.display="";
      wh.innerHTML='<div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted);line-height:1.5">'
        +'<b>Vergleich mit dem EU-NRV; keine Verzehrempfehlung.</b> Der Prozentwert sagt, wie viel '
        +'ein Liter zur Tagesreferenz beiträgt – er ist <b>keine Dosisempfehlung</b> und keine Aussage '
        +'über Wirksamkeit. Stoffe ohne EU-Referenzwert (z. B. Sulfat, Nitrat, Hydrogencarbonat) '
        +'stehen bewusst ohne Prozentwert; das ist eine Grenze der Rechtsgrundlage, kein Mangel am Produkt.</div>';
    }
  } else {
    if(t)  t.textContent="Wirkstoffe & Dosis";
    if(tz) tz.textContent=(kat==="supplement")?"(Nahrungsergänzung – für den Dosis-Check)":"(Mengen laut Etikett)";
    if(ke) ke.textContent="Einheit";
    if(h)  h.innerHTML='Mengen <b>pro Tagesdosis</b> laut Etikett (worauf sich die Verzehrempfehlung oben bezieht). '
      +'Damit rechnet der Dosis-Check gegen <b>Tagesbedarf (NRV)</b> und <b>EFSA-Grenze</b>. '
      +'Schreibweise wie auf dem Etikett, z. B. „Vitamin C“, „Zink“, „Vitamin B7 (Biotin)“.';
    if(leg) leg.style.display="";
    if(non) non.style.display="";
    if(wh)  wh.style.display="none";
  }
  var it=document.getElementById("fe_indexTitel"), iz=document.getElementById("fe_indexTitelZusatz");
  if(it) it.textContent=(kat==="supplement")?"Dosis-Check":"Root Index";
  if(iz) iz.textContent=(kat==="supplement")?"(Wirkstoffe in wirksamer Menge)":"(live berechnet)";
  try{ feWirkNrvAlle(); }catch(e){ console.error("[%NRV] rechnen:", e); }
  var _mk=document.getElementById("fe_nwCard");
  if(_mk) _mk.style.display=wasser?"none":"block";
  try{ if(typeof feNaehrKachelnSync==="function") feNaehrKachelnSync(); }catch(e){ console.error("[Kachelstreifen]", e); }
  try{ if(typeof feNaehrBtnSync==="function") feNaehrBtnSync(); }catch(e){}
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
}
if(typeof window!=="undefined"){ window.feWirkAnsicht=feWirkAnsicht; window.feIstMineralwasser=feIstMineralwasser;
  window.feWirkNrvAlle=feWirkNrvAlle; window.feWirkNrvRow=feWirkNrvRow; window.feNrvText=feNrvText; }
async function feWirkHerkunft(pid){
  var c=document.getElementById("fe_wirkRows"); if(!c) return;
  [].forEach.call(c.querySelectorAll(".fwHerk"), function(s){ s.textContent=""; s.removeAttribute("title"); });
  if(!pid) return;
  var rows;
  try{
    var res = await client.rpc("cb_produkt_wirkstoff_herkunft", { p_id: pid });
    if(res && res.error){ console.warn("Wirkstoff-Herkunft:", res.error.message||res.error); return; }
    rows = (res && res.data) || [];
  }catch(e){ console.warn("Wirkstoff-Herkunft:", e); return; }
  if(!Array.isArray(rows) || !rows.length) return;
  var karte={};
  rows.forEach(function(r){ var k=String(r.naehrstoff||"").trim().toLowerCase(); if(k) karte[k]=r; });
  [].forEach.call(c.querySelectorAll(".feWirkRow"), function(r){
    var nm=((r.querySelector(".fwName")||{}).value||"").trim().toLowerCase();
    var sp=r.querySelector(".fwHerk"); if(!sp) return;
    var h=karte[nm]; if(!h) return;
    if(h.herkunft==="zugesetzt"){
      sp.textContent="⊕";
      sp.title="Zugesetzt – als isolierte Zutat auf dem Etikett: "+(h.beleg_zutat||"?")+(h.beleg_quelle?" ("+h.beleg_quelle+")":"");
    } else if(h.herkunft==="unbekannt"){
      sp.textContent="?";
      sp.title="Nicht bestimmbar – für diesen Nährstoff ist keine Zutatenform hinterlegt. Es wird bewusst nichts behauptet.";
    } else {
      sp.textContent="";
      sp.title="Aus den Lebensmittelzutaten – keine isolierte Zutat auf dem Etikett";
    }
  });
}
if(typeof window!=='undefined'){ window.feWirkAdd=feWirkAdd; window.feWirkDel=feWirkDel; window.feWirkNoneToggle=feWirkNoneToggle; window.feWirkHerkunft=feWirkHerkunft; }
/* Fehlt die EAN, wird der „offen"-Haken automatisch gesetzt (blockiert die Freigabe nicht) –
   AUSSER das Produkt ist legitim ohne Barcode (Status „generisch"/„kein_barcode"): das nicht anfassen,
   sonst würde es beim Speichern auf „offen" heruntergestuft und tauchte fälschlich in „Zu erledigen" auf.
   Gültige EAN → Haken raus (dann macht „offen" keinen Sinn). */
function feReqBorders(){
  var mark=function(id){ var el=document.getElementById(id); if(!el) return;
    var empty=!((el.value==null?"":String(el.value)).trim());
    el.style.borderColor=empty?"#e0a32e":""; el.style.borderWidth=empty?"1.5px":"";
  };
  mark("fe_name"); mark("fe_kat"); mark("fe_quelle_typ");
}
function feEanBewusstOhne(){
  var a=String((window._fgEdit&&window._fgEdit.ean_ampel)||"");
  if(a) return a==="blau";
  /* Rueckfallweg, wenn die Ampel (cb_ean_ampel) nicht mitgeliefert wurde. Dieselben Werte
     wie dort. 'offen' bleibt nur als Altlast stehen: der CHECK auf der Tabelle laesst ihn
     nicht zu, es kann ihn also gar nicht geben - schaden kann er hier aber auch nicht.
     'noch_nicht_erfasst' zaehlt bewusst NICHT dazu: das heisst "kennen wir noch nicht",
     nicht "gibt es nicht". */
  return /^(offen|generisch|kein_barcode)$/i.test(String((window._fgEdit&&window._fgEdit.ean_status)||""));
}
if(typeof window!=='undefined'){ window.feEanBewusstOhne=feEanBewusstOhne; }
function feEanStatusWahl(){
  var s=document.getElementById("fe_ean_status");
  var v=s?String(s.value||"").trim():"";
  /* Positivliste, wortgleich mit dem CHECK auf Produkte und mit der Liste in
     cb_produkt_ean_status_setzen. 'vorhanden' steht bewusst NICHT darin: dieser
     Zustand wird aus dem EAN-Feld ABGELEITET und nie von Hand gesendet. */
  if(v!=="kein_barcode" && v!=="noch_nicht_erfasst" && v!=="generisch") return "";
  /* Bei vorhandener EAN keinen leeren Status senden; der Server würde sonst die EAN löschen. */
  var e=document.getElementById("fe_ean");
  var voll=((((e&&e.value)||"").replace(/\D/g,"")).length>=8);
  return voll ? "" : v;
}
if(typeof window!=='undefined'){ window.feEanStatusWahl=feEanStatusWahl; }
var FE_EAN_STUFEN=[
  {v:"noch_nicht_erfasst", ico:"🕓", kurz:"noch nicht erfasst", bg:"var(--k-fff7e6)", fg:"var(--k-b45309)",
   titel:"Das Produkt hat einen Barcode – wir haben ihn nur noch nicht erfasst."},
  {v:"kein_barcode",       ico:"🚫", kurz:"kein Barcode",       bg:"var(--k-eef2f6)", fg:"var(--k-475569)",
   titel:"Dieses Stück trägt keinen Barcode. Achtung: setzt eine gespeicherte EAN zurück."}
];
function feEanVorwahl(d){
  var st=String((d&&d.ean_status)||"");
  if(st==="noch_nicht_erfasst"||st==="kein_barcode"||st==="generisch") return st;
  return (String((d&&d.ean)||"").replace(/\D/g,"").length>=8) ? "" : "noch_nicht_erfasst";
}
function feEanRender(){
  var box=document.getElementById("fe_eanChips");
  if(!box){ console.warn("fe_eanChips nicht im DOM – EAN-Chips werden nicht gezeichnet."); return; }
  var e=document.getElementById("fe_ean"), s=document.getElementById("fe_ean_status");
  if(!s){ console.warn("fe_ean_status fehlt – ohne den Speicherort wird nichts gezeichnet."); return; }
  var voll=((((e&&e.value)||"").replace(/\D/g,"")).length>=8);
  var akt=String(s.value||"");
  var h="";
  if(voll){
    /* Abgeleitet, nicht gewaehlt - deshalb ein Anzeige-Chip und kein Knopf. */
    h += feInfoPill("✓","vorhanden","Oben steht eine EAN – der Status ergibt sich daraus und wird nicht von Hand gesetzt.","var(--k-e7f4ec)","var(--k-1f5e34)",false);
    h += feTrenner();
  }
  h += FE_EAN_STUFEN.map(function(st){
    return fePill({an:(!voll && st.v===akt), aus:voll, ico:st.ico, kurz:st.kurz, bg:st.bg, fg:st.fg,
      titel: voll ? ("Nicht wählbar, solange oben eine EAN steht – „"+st.kurz+"“ würde sie löschen.") : st.titel,
      klick:"feEanWahl('"+st.v+"')"});
  }).join("");
  /* Auslaufmodell 'generisch': nur sichtbar, wenn dieses Produkt ihn wirklich
     gespeichert hat - und dann nicht als Knopf, sondern als Feststellung. So
     entsteht er nie neu, verschwindet aber auch nicht aus der Anzeige. */
  if(akt==="generisch"){
    h += feTrenner();
    h += feInfoPill("📦","generisch",
      "Gespeicherter Altwert: ein allgemeines Produkt ohne Marken-Barcode. Wird nicht mehr neu vergeben – ein Klick auf „kein Barcode“ oder eine eingetragene EAN ersetzt ihn.",
      "var(--k-eef2f6)","var(--k-475569)",true);
  }
  box.innerHTML=h;
  feEanHint(voll,akt);
}
function feEanWahl(v){
  var s=document.getElementById("fe_ean_status"); if(!s) return;
  s.value=(String(s.value||"")===String(v))?"":String(v);
  feEanRender();
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e2){}
}
function feEanHint(voll,akt){
  var h=document.getElementById("fe_eanHint"); if(!h) return;
  if(voll){
    h.textContent="Folgt dem Feld: „vorhanden“. Die drei Angaben würden die EAN löschen und sind deshalb gesperrt.";
    h.style.color="var(--muted)"; return;
  }
  if(!akt){
    h.textContent="Noch nicht entschieden. Blockiert die Freigabe nicht – sagt nur nicht, WARUM keine EAN da ist.";
    h.style.color="var(--muted)"; return;
  }
  h.textContent="Von dir gesetzt. Nochmal auf denselben Chip nimmt es zurück.";
  h.style.color="var(--k-16a34a)";
}
if(typeof window!=='undefined'){ window.feEanRender=feEanRender; window.feEanWahl=feEanWahl; window.fePill=fePill; window.feInfoPill=feInfoPill; }
function feEanSync(){
  var e=document.getElementById("fe_ean"), s=document.getElementById("fe_ean_status"); if(!e||!s) return;
  var voll=(((e.value||"").replace(/\D/g,"")).length>=8);
  s.disabled=voll;
  s.style.opacity=voll?"0.5":"";
  try{ feEanRender(); }catch(e3){ console.error("EAN-Chips konnten nicht gezeichnet werden:", e3); }
  try{ if(typeof fePlaus==="function") fePlaus(); }catch(e2){}
}
/* Etikettfoto gross ansehen - beim Abtippen der Naehrwerte ist das der eigentliche Zweck. */
function fgEtikettZoom(j){
  const arr=(window._fgEdit&&window._fgEdit.etikett)||[]; const src=arr[j]; if(!src) return;
  let ov=document.getElementById("etikettOv"); if(ov) ov.remove();
  ov=document.createElement("div"); ov.id="etikettOv";
  /* Scrollbarer Overlay: Klick aufs Bild zoomt stufenweise (passend → 1,6× → 2,6× → 4×),
     dann kann man zum Lesen scrollen. Klick DANEBEN schließt. */
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;overflow:auto;padding:16px;text-align:center;cursor:zoom-out";
  ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
  var img=document.createElement("img"); img.src=src; img.dataset.z="0";
  img.style.cssText="border-radius:10px;cursor:zoom-in;max-width:100%;max-height:calc(100vh - 32px);width:auto;vertical-align:middle";
  img.onclick=function(e){ e.stopPropagation();
    var z=(Number(img.dataset.z)||0)+1; if(z>3) z=0; img.dataset.z=String(z);
    if(z===0){ img.style.maxWidth="100%"; img.style.maxHeight="calc(100vh - 32px)"; img.style.width="auto"; img.style.cursor="zoom-in"; }
    else { var f=[0,1.6,2.6,4][z]; img.style.maxWidth="none"; img.style.maxHeight="none"; img.style.width=Math.round(window.innerWidth*f)+"px"; img.style.cursor=(z===3?"zoom-out":"zoom-in"); }
  };
  ov.appendChild(img);
  var hint=document.createElement("div");
  hint.textContent="Klick aufs Bild = näher heranzoomen · Klick daneben = schließen";
  hint.style.cssText="position:fixed;bottom:10px;left:0;right:0;text-align:center;color:#fff;font-size:12px;opacity:.85;pointer-events:none";
  ov.appendChild(hint);
  document.body.appendChild(ov);
}
function fgEtikettRender(){
  var box=document.getElementById('fe_etikettGrid'); if(!box) return;
  var arr=(window._fgEdit&&window._fgEdit.etikett)||[];
  var cnt=document.getElementById('fe_etikettCount');
  if(cnt){
    /* Alte Fehleranzeige vor jedem Render entfernen, damit Reloads keine Meldungen stapeln. */
    var _old=document.querySelectorAll('.fgEtikErr');
    for(var _i=0;_i<_old.length;_i++) _old[_i].remove();
    cnt.textContent='('+arr.length+')';
    var _fehl=window._fgEtikettFehler||"";
    if(_fehl && !arr.length){
      cnt.insertAdjacentHTML('afterend',
        '<span class="fgEtikErr" style="color:var(--k-dc2626);font-weight:600;text-transform:none;letter-spacing:0"> · konnten nicht geladen werden: '+esc(_fehl)+'</span>');
    }
  }
  var g=window._fgEtikGross=window._fgEtikGross||{idx:0,scale:1,x:0,y:0,baseFit:1};
  if(g.idx>=arr.length) g.idx=0;
  box.style.display='block';
  box.innerHTML = arr.length
    ? ('<div style="display:flex;gap:6px;flex-wrap:wrap">'+arr.map(function(s,j){ var on=(j===((window._fgWirkFoto&&window._fgWirkFoto.idx)||0));
        return '<img src="'+s+'" onclick="fgEtikettZuLesebox('+j+')" oncontextmenu="fgEtikettCtx(event,'+j+')" title="Klick = im Lesekasten „Etikett zum Ablesen“ zeigen · Rechtsklick = Riki-Menü" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid '+(on?'var(--k-16a34a)':'var(--line)')+';cursor:pointer'+(on?'':';opacity:.8')+'">'; }).join('')+'</div>')
    : '<span style="color:var(--muted);font-size:12.5px">keine – über „+ Foto" ein Bild hinzufügen</span>';
  try{ fgWirkFotoRender(); }catch(e){}   /* die Lesebox neben der Wirkstoff-Tabelle mitziehen */
}
/* ===== 28z35: Zoom-Kasten der Angehaengte-Fotos-Karte (gleiches Muster wie fgWirkFoto*) ===== */
function fgEtikGrossApply(){ var img=document.getElementById('fe_etikGrossImg'); if(!img) return; var s=window._fgEtikGross; img.style.transform='translate('+Math.round(s.x)+'px,'+Math.round(s.y)+'px) scale('+s.scale+')'; }
function fgEtikGrossReset(){
  var s=window._fgEtikGross, box=document.getElementById('fe_etikGrossBox'), img=document.getElementById('fe_etikGrossImg');
  if(!s) return; s.x=0; s.y=0; s.scale=1; s.baseFit=1;
  if(box&&img&&img.naturalWidth&&box.clientWidth){ var fit=Math.min(box.clientWidth/img.naturalWidth, box.clientHeight/img.naturalHeight); if(fit>0){ s.scale=fit; s.baseFit=fit; s.x=(box.clientWidth-img.naturalWidth*fit)/2; s.y=(box.clientHeight-img.naturalHeight*fit)/2; } }
  fgEtikGrossApply();
}
function fgEtikGrossZoomAt(factor, cx, cy){
  var s=window._fgEtikGross, box=document.getElementById('fe_etikGrossBox'); if(!s||!box) return;
  var lo=(s.baseFit||0.1)*0.4, hi=(s.baseFit||1)*10;
  var ns=Math.max(lo, Math.min(hi, s.scale*factor)); if(ns===s.scale) return;
  var r=box.getBoundingClientRect(), px=cx-r.left, py=cy-r.top;
  s.x = px - (px - s.x)*(ns/s.scale);
  s.y = py - (py - s.y)*(ns/s.scale);
  s.scale=ns; fgEtikGrossApply();
}
function fgEtikGrossFit(){
  /* Einpassen erst, wenn das Bild wirklich dekodiert UND der Kasten gemessen ist. */
  var img=document.getElementById('fe_etikGrossImg'); if(!img||!img.src) return;
  var los=function(){ requestAnimationFrame(function(){ fgEtikGrossReset(); }); };
  if(img.decode){ img.decode().then(los).catch(los); } else los();
}
function fgEtikGrossZoomBtn(dir){
  var box=document.getElementById('fe_etikGrossBox'); if(!box) return;
  var r=box.getBoundingClientRect();
  fgEtikGrossZoomAt(dir>0?1.3:0.77, r.left+r.width/2, r.top+r.height/2);
}
function fgEtikGrossShow(j){ var s=window._fgEtikGross=window._fgEtikGross||{idx:0,scale:1,x:0,y:0,baseFit:1}; s.idx=j; try{ fgEtikettRender(); }catch(e){} try{ fgEtikGrossFit(); }catch(e){} }
function fgEtikettZuLesebox(j){
  var s=window._fgWirkFoto=window._fgWirkFoto||{idx:0,scale:1,x:0,y:0,baseFit:1};
  s.idx=j;
  try{ fgWirkFotoRender(); }catch(e){ console.error('fgWirkFotoRender', e); }
  try{ fgEtikettRender(); }catch(e){ console.error('fgEtikettRender', e); }   /* gruener Rahmen mitziehen */
}
if(typeof window!=='undefined'){ window.fgEtikettZuLesebox=fgEtikettZuLesebox; }
function fgEtikGrossBind(){
  var box=document.getElementById('fe_etikGrossBox'); if(!box||box._fgB) return; box._fgB=true;
  box.addEventListener('wheel', function(e){ e.preventDefault(); fgEtikGrossZoomAt(e.deltaY<0?1.12:0.89, e.clientX, e.clientY); }, {passive:false});
  var drag=null;
  box.addEventListener('mousedown', function(e){ var s=window._fgEtikGross; drag={sx:e.clientX,sy:e.clientY,ox:s.x,oy:s.y}; box.style.cursor='grabbing'; e.preventDefault(); });
  document.addEventListener('mousemove', function(e){ if(!drag) return; var s=window._fgEtikGross; s.x=drag.ox+(e.clientX-drag.sx); s.y=drag.oy+(e.clientY-drag.sy); fgEtikGrossApply(); });
  document.addEventListener('mouseup', function(){ if(drag){ drag=null; box.style.cursor='grab'; } });
  box.addEventListener('dblclick', function(){ try{ fgEtikettZoom(window._fgEtikGross.idx); }catch(e){} });
}
if(typeof window!=='undefined'){ window.fgEtikGrossShow=fgEtikGrossShow; window.fgEtikGrossZoomBtn=fgEtikGrossZoomBtn; window.fgEtikGrossReset=fgEtikGrossReset; }
window._fgWirkFoto = window._fgWirkFoto || { idx:0, scale:1, x:0, y:0, baseFit:1 };
function fgWirkFotoArr(){
  var arr=(window._fgEdit&&Array.isArray(window._fgEdit.etikett))?window._fgEdit.etikett.slice():[];
  var bp=document.getElementById('fe_bildPreview'); var bimg=bp?bp.querySelector('img'):null;
  var bu=(bimg&&bimg.getAttribute('src'))||((window._fgEdit&&window._fgEdit.bild_url)||'');
  if(bu && arr.indexOf(bu)<0) arr.push(bu);
  return arr;
}
async function fgWirkFotoRiki(btn){
  var arr=fgWirkFotoArr(); var src=arr[(window._fgWirkFoto&&window._fgWirkFoto.idx)||0];
  if(!src){ return; }
  var old=btn?btn.innerHTML:''; if(btn){ btn.disabled=true; btn.style.opacity='.6'; btn.innerHTML='⏳ Riki liest…'; }
  try{
    var b64=src;
    if(!/^data:image\//.test(src)){
      var resp=await fetch(src); var blob=await resp.blob();
      b64=await new Promise(function(res,rej){ var fr=new FileReader(); fr.onload=function(){res(fr.result);}; fr.onerror=rej; fr.readAsDataURL(blob); });
    }
    if(typeof fgPullEtikett==='function') await fgPullEtikett(null,[b64]);
  }catch(e){}
  finally{ if(btn){ btn.disabled=false; btn.style.opacity=''; btn.innerHTML=old; } }
}
if(typeof window!=='undefined'){ window.fgWirkFotoRiki=fgWirkFotoRiki; }
async function fgDubletteOkSetzen(v){
  var pid=(window._fgEdit&&window._fgEdit.id)||null;
  if(!pid){ alert("Bitte das Produkt zuerst speichern."); return; }
  try{
    var r=await client.rpc("cb_produkt_dublette_ok_setzen",{p_id:pid, p_ok:!!v});
    if(r.error) throw new Error(r.error.message);
    await feDubPruefenSofort();
  }catch(e){
    alert("Konnte nicht speichern: "+((e&&e.message)||e));   /* nie stumm scheitern (§1.13i) */
  }
}
/* Wie feDubPruefen, aber ohne die 450-ms-Entprellung: nach einem Klick will man das Ergebnis
   sofort sehen, nicht eine halbe Sekunde später. Ruft dieselbe RPC - kein zweiter Prüfweg. */
async function feDubPruefenSofort(){
  var f=(typeof feDubFelder==="function")?feDubFelder():null; if(!f) return;
  try{
    var r=await client.rpc("cb_dubletten_pruefen",{p_id:f.id,p_ean:f.ean||null,p_name:f.name||null,p_marke:f.marke||null});
    if(r.error) throw new Error(r.error.message);
    window._feDub=r.data||{treffer:[],anzahl:0};
    try{ feDubChipRender(); }catch(e){}
    try{ if(typeof fePlaus==="function") fePlaus(); }catch(e){}
  }catch(e){ if(typeof console!=="undefined") console.warn("Dubletten-Prüfung:", e&&e.message?e.message:e); }
}
if(typeof window!=='undefined'){ window.fgDubletteOkSetzen=fgDubletteOkSetzen; window.feDubPruefenSofort=feDubPruefenSofort; }
function fgKcalOkSet(v){ if(!window._fgEdit){ window._fgEdit={}; } window._fgEdit.kcalOk=!!v; try{ fePlaus(); }catch(e){} }
if(typeof window!=='undefined'){ window.fgKcalOkSet=fgKcalOkSet; }

function _fgIstSpecial(){ var k=(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()); var cfg=window._katKonfig; if(cfg&&cfg[k]) return cfg[k].darstellung==="supplement"; return (k==="supplement"); }    
/* 28l: Reiter-Wechsel im Vollbild-Editor. Reine Anzeige (display an/aus) - beide Reiter sind
   IMMER im DOM, alle IDs existieren weiter, kein Feld wird neu gebaut oder geleert. */
function feDreiReiterInit(){
  try{ fgFotoPlatzieren(); }catch(e){}
  var wt=document.getElementById('fe_wirkTblCol'); if(wt) wt.style.minWidth='0';
  var fbox=document.getElementById('fe_wirkFotoBox'); if(fbox) fbox.style.height='clamp(360px,52vh,680px)';
  try{ feEtikettPasteHinweis(); }catch(e){}
}

function feTabWechsel(n){
  n=(n===2||n===3)?n:1; window._feTab=n;
  var ziel=document.getElementById('feTab'+n);
  if(ziel && ziel.scrollIntoView){ try{ ziel.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){ ziel.scrollIntoView(); } }
  var st=function(btn,on){ if(!btn) return; btn.classList.toggle("on", !!on); };
  st(document.getElementById('feTabBtn1'),n===1); st(document.getElementById('feTabBtn2'),n===2); st(document.getElementById('feTabBtn3'),n===3);
  if(n===2){ try{ fgFotoPlatzieren(); fgWirkFotoRender(); }catch(e){} }
  if(n===3){ try{ fgFotoPlatzieren(); fgRefV2Init(); }catch(e){} }    
  try{ feGridHoeheSync(); }catch(e){}
}
/* Fokus-Editor: sieben Schritte auf einer Seite; Navigation ändert den Fokus, nicht die Fachzustände. */
/* Etikett- und Abgleichkarte teilen denselben aktuellen Quellen- und Referenzzustand. */
var FE_SCHRITTE=[
 {nr:1, id:'kopf',    t:'Kopf & Quelle',       tab:1,
  kurz:'Quelle geben, Identität prüfen',
  /* 'fe_quelleCard' schaltet die GANZE Quellenkarte (Work #181 Stufe 2). Die beiden Felder
     bleiben zusaetzlich in 'zelle' stehen — nicht doppelt gemoppelt, sondern ein zweiter
     Zweck: Z. ~5527 sucht ueber 'zelle' den Schritt zu einem Sprungziel. Nimmt man sie dort
     heraus, findet der Klick auf den Freigabegrund "Quelle-Typ fehlt" seinen Schritt nicht mehr. */
  el:['fe_quelleCard','fe_urlLbl','fe_url','fe_pasteZone','fe_jsonIn','fe_jsonMsg','fe_nurLeer','fe_rohtextIn'],
  zelle:['fe_name','fe_marke','fe_ean','fe_ean_status','fe_eanChips','fe_eanHint',
         'fe_kat','fe_ukat','fe_basis','fe_verzehr','fe_quelle_typ','fe_beleg']},
 {nr:2, id:'analyse', t:'Nährwerte / Analyse', tab:2,
  kurz:'je Produktart: Makros · Wirkstoffe · Mineralstoffe'},
 {nr:3, id:'bestand', t:'Produktbestandteile & Abgleich', tab:3,
  kurz:'Zuordnung, Referenz und Etikettabgleich in einem',
  nur:['fe_colZut'], zelle:['fe_bioSw','fe_ernaehrChips']}
];
function feAbschlussRender(){
  var box=document.getElementById("feAbschluss"); if(!box) return;
  var S=null; try{ S=(typeof getErfassungsStatus==="function")?getErfassungsStatus():null; }catch(e){}
  if(!S||!S.bekannt){ box.innerHTML='<div class="feAbSp">Der Status wird geladen …</div>'; return; }
  var sg=window._fgScoreGespeichert, pid=(window._fgEdit&&window._fgEdit.id)||"";
  var supp=(String((document.getElementById("fe_kat")||{}).value||"").toLowerCase()==="supplement");
  var H="";

  /* ── A) BEWERTUNG ───────────────────────────────────────────────── */
  H+='<div class="feAbGr"><div class="feAbTit">Bewertung</div>';
  if(supp){
    H+='<div class="feAbZeile"><span>Dosis-Check</span><b>siehe Wirkstoffe &amp; Dosis</b></div>'
      +'<div class="feAbSp">Nahrungsergänzung bekommt keinen Lebensmittel-Index – eine Kapsel hat kein Nährwertprofil.</div>';
  } else if(sg && sg.produkt_id===pid){
    var _f=(typeof farbe==="function")?farbe(sg.bewertung):"var(--ink)";
    var A=[["zutaten","Zutaten",30],["zusatzstoffe","Zusatzstoffe",15],["nova","NOVA",15],["naehrwert","Nährwerte",40]];
    var _na=Array.isArray(sg.achsen_na)?sg.achsen_na:[], _fh=Array.isArray(sg.achsen_fehlend)?sg.achsen_fehlend:[], _ac=sg.achsen||{};
    H+=(sg.clean_score!=null
        ? '<div class="feAbScore"><div class="feAbZahl" style="color:'+_f+'">'+esc(String(Math.round(sg.clean_score)))+'</div>'
          +'<div class="feAbBew" style="color:'+_f+'">'+esc(sg.bewertung||"")+'</div></div>'
        : '<div class="feAbScore"><div class="feAbZahl" style="color:var(--muted)">–</div>'
          +'<div class="feAbBew" style="color:var(--muted)">kein Index – eine Achse fehlt</div></div>')
      +'<div class="feAbAchsen">'+A.map(function(a){
        var v=_ac[a[0]], txt, col;
        if(_na.indexOf(a[0])>=0){ txt="nicht anwendbar"; col="var(--muted)"; }
        else if(v==null||_fh.indexOf(a[0])>=0){ txt=(_fh.indexOf(a[0])>=0?"fehlt":"nicht belegt"); col="var(--k-cf5442,#cf5442)"; }
        else { txt=String(v).replace(".",",")+"/"+a[2]; col="var(--ink)"; }
        return '<div class="feAbZeile"><span>'+esc(a[1])+'</span><b style="color:'+col+'">'+esc(txt)+'</b></div>';
      }).join('')+'</div>';
  } else {
    H+='<div class="feAbSp">Noch kein gespeicherter Index – er entsteht beim Speichern.</div>';
  }
  H+='</div>';

  /* ── B) PRÜFSTATUS ──────────────────────────────────────────────── */
  var _z=function(t,w,c){ return '<div class="feAbZeile"><span>'+esc(t)+'</span><b'+(c?' style="color:'+c+'"':'')+'>'+esc(w)+'</b></div>'; };
  var _ROT="var(--k-cf5442,#cf5442)";
  H+='<div class="feAbGr"><div class="feAbTit">Prüfstatus</div>'
    +_z("Quelle", S.quelle_ok?"vorhanden":"fehlt", S.quelle_ok?"":_ROT)
    +_z("Nährwerte", S.naehrwerte_ok===null?"nicht nötig":(S.naehrwerte_ok?"vollständig":"unvollständig"),
        S.naehrwerte_ok===null?"var(--muted)":(S.naehrwerte_ok?"":_ROT))
    +_z("Bestandteile", S.bestandteile_gesamt?((S.bestandteile_gesamt-S.bestandteile_offen)+"/"+S.bestandteile_gesamt):"keine erfasst",
        S.bestandteile_gesamt?"":"var(--muted)")
    +((typeof _fgZutOffenListe==="function" && _fgZutOffenListe().length)
        ? _z("Nicht im Stamm", _fgZutOffenListe().length+" gelesen, nicht gebunden", "var(--k-1e40af,#1e40af)")
        : "")
    +_z("Etikettprüfung",
        (S.referenz_gueltige_zeilen||0)>0 ? (S.referenz_blocker>0?(S.referenz_blocker+" Blocker"):"geprüft") : "noch nicht erhoben",
        (S.referenz_gueltige_zeilen||0)>0 ? (S.referenz_blocker>0?"var(--k-dc2626,#dc2626)":"") : "var(--muted)")
    +_z("Dublette", (window._feDub&&window._feDub.anzahl)?((window._feDub.anzahl)+" Treffer"):"keine",
        (window._feDub&&window._feDub.freigabe_blockiert)?"var(--k-dc2626,#dc2626)":"var(--muted)")
    +'</div>';

  /* ── C) FREIGABE ────────────────────────────────────────────────── */
  var _ps=String((window._fgEdit&&window._fgEdit.status)||"").toLowerCase();
  var _frei=(_ps==="aktiv"||_ps==="aktiv ohne index");
  H+='<div class="feAbGr"><div class="feAbTit">Freigabe</div>';
  if(_frei){
    H+='<div class="feAbSatz ok">Dieses Produkt ist freigegeben.</div>';
  } else if(S.freigabe_moeglich){
    H+='<div class="feAbSatz ok">Produkt kann freigegeben werden.</div>';
  } else {
    H+='<div class="feAbSatz rot">Freigabe nicht möglich.</div>'
      +'<ul class="feAbListe">'+S.freigabe_gruende.map(function(g){
         return '<li><b>'+esc(g.t)+'</b>'+(g.d?'<span>'+esc(g.d)+'</span>':'')+'</li>'; }).join('')+'</ul>';
  }
  if(S.hinweise && S.hinweise.length)
    H+='<details class="feAbDet"><summary>Hinweise, die nicht blockieren ('+S.hinweise.length+')</summary><ul class="feAbListe">'
      +S.hinweise.map(function(x){ return '<li><b>'+esc(x.t)+'</b>'+(x.d?'<span>'+esc(x.d)+'</span>':'')+'</li>'; }).join('')+'</ul></details>';
  H+='<div class="feAbBtns">'
    +'<button type="button" class="feAbBtnPrim" onclick="try{fgEditSave(true)}catch(e){alert(e&&e.message||e)}"'+(S.freigabe_moeglich||_frei?'':' disabled')+'>Freigeben</button>'
    +'<button type="button" class="feAbBtnSek" onclick="try{fgEditSave(false)}catch(e){alert(e&&e.message||e)}">Als Entwurf speichern</button>'
    +'</div>'
    +'<details class="feAbDet"><summary>Alle Bedingungen im Einzelnen</summary><div id="feAbDetail">siehe Freigabe-Karte im Seitenstreifen</div></details>'
    +'</div>';
  box.innerHTML=H;
}
if(typeof window!=="undefined"){ window.feAbschlussRender=feAbschlussRender; }
function feFokusQuelle(an){
  var box=document.querySelector(".feHolBox"); if(!box) return;
  var q=function(sel){ return box.querySelector(sel); };
  var grid=q(".feHolGrid"), auch=q(".feHolAuch"), json=q(".feHolZeile2"),
      titel=q(".feHolTitel"), nurLeer=q(".feNurLeerLbl"), jsonMsg=document.getElementById("fe_jsonMsg");
  if(!an){
    /* Rückweg: alles wieder so, wie es die Vorlage baut. */
    [auch,json,nurLeer].forEach(function(e){ if(e) e.style.display=""; });
    if(jsonMsg) jsonMsg.style.display="";
    if(titel) titel.innerHTML='Daten holen <span class="feHolTitelZus">— Riki füllt, du prüfst</span>';
    var eb=box.querySelector("#feQuelleEtikettBtn")||document.getElementById("feQuelleEtikettBtn");
    if(eb && auch && eb.parentNode!==auch){
      eb.className="feChipLila"; eb.textContent="🏷 Etikett-Foto";
      auch.insertBefore(eb, auch.children[1]||null);
    }
    if(grid){ grid.classList.remove("feQuelleFokus"); grid.style.display=""; }
    var fz=box.querySelector("#feQuelleFertig")||document.getElementById("feQuelleFertig");
    if(fz) fz.remove();
    window._feQuelleOffen=false;
    return;
  }
  if(titel) titel.innerHTML='Quelle hinzufügen <span class="feHolTitelZus">— Riki liest, du prüfst</span>';
  [auch,json,nurLeer].forEach(function(e){ if(e) e.style.display="none"; });
  if(jsonMsg) jsonMsg.style.display="none";
  /* Den vorhandenen Etikett-Foto-Knopf zum dritten Haupteingang machen — verschieben,
     nicht nachbauen. Er behält seinen onclick auf den versteckten fe_eti_up. */
  /* Gezielt über die eigene ID — keine Annahme über die Reihenfolge in der Zeile. */
  var btn=box.querySelector("#feQuelleEtikettBtn")||document.getElementById("feQuelleEtikettBtn");
  if(btn && grid && btn.parentNode!==grid){
    btn.className="feQuelleBtn";
    btn.textContent="🖼 Bild hochladen";
    grid.appendChild(btn);
  }
  if(grid) grid.classList.add("feQuelleFokus");
  var qt=((document.getElementById("fe_quelle_typ")||{}).value||"").trim();
  var alt=document.getElementById("feQuelleFertig"); if(alt) alt.remove();
  if(qt && !window._feQuelleOffen){
    var d=document.createElement("div");
    d.id="feQuelleFertig"; d.className="feQuelleFertig";
    d.innerHTML='<span class="feQuelleHaken">✓</span><span><b>Quelle</b><span>'+esc(qt)+'</span></span>'
      +'<button type="button" class="feQuelleWechsel" onclick="feQuelleAufklappen(true)">ändern</button>';
    box.insertBefore(d, box.firstChild);
    if(grid) grid.style.display="none";
  } else {
    if(grid) grid.style.display="";
    if(qt){
      var d2=document.createElement("div");
      d2.id="feQuelleFertig"; d2.className="feQuelleFertig offen";
      d2.innerHTML='<span class="feQuelleHaken">✓</span><span><b>Quelle</b><span>'+esc(qt)+'</span></span>'
        +'<button type="button" class="feQuelleWechsel" onclick="feQuelleAufklappen(false)">fertig</button>';
      box.insertBefore(d2, box.firstChild);
    }
  }
}
function feQuelleAufklappen(an){
  window._feQuelleOffen=!!an;
  try{ feFokusQuelle(true); }catch(e){ console.error("[Quelle] Aufklappen:", e); }
  if(an){ var u=document.getElementById("fe_url"); if(u&&u.focus) try{ u.focus(); }catch(e){} }
}
if(typeof window!=="undefined"){ window.feQuelleAufklappen=feQuelleAufklappen; }
if(typeof window!=="undefined"){ window.feFokusQuelle=feFokusQuelle; }
function feTopbarRender(){
  var t=document.getElementById("feTopbar"); if(!t) return;
  t.innerHTML=""; t.style.display="none";
}
function feTopbarRenderAlt(){
  var t=document.getElementById("feTopbar"); if(!t) return;
  t.style.display="";
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  var nm=((document.getElementById("fe_name")||{}).value||"").trim();
  var ps=String((window._fgEdit&&window._fgEdit.status)||"Entwurf");
  var sv=window._fgSaveState||(pid?"saved":"neu");
  var zt={neu:["noch nicht gespeichert","var(--muted)"],saving:["Speichert …","var(--k-2f6fd6,#2f6fd6)"],
          saved:["Gespeichert","var(--k-166534,#166534)"],error:["Speichern fehlgeschlagen","var(--k-dc2626,#dc2626)"]}[sv]
        ||["Gespeichert","var(--k-166534,#166534)"];
  t.innerHTML='<div class="feTbLinks">'
      +(pid?'<span class="feTbId">'+esc(pid)+'</span>':'')
      +'<span class="feTbName">'+esc(nm||"Neues Produkt")+'</span>'
      +'<span class="feTbZust">'+esc(ps)+' · <span style="color:'+zt[1]+'">'+esc(zt[0])+'</span></span>'
    +'</div>'
    +'<div class="feTbRechts">'
      +'<button type="button" class="feTbBtn" onclick="try{fgEditSave(false)}catch(e){alert(e&&e.message||e)}">Speichern</button>'
    +'</div>';
}
if(typeof window!=="undefined"){ window.feTopbarRender=feTopbarRender; window.feTopbarRenderAlt=feTopbarRenderAlt; }
function _feKtxQuelle(){
  var typ=((document.getElementById("fe_quelle_typ")||{}).value||"").trim();
  var beleg=((document.getElementById("fe_beleg")||{}).value||"").trim();
  var url=((document.getElementById("fe_url")||{}).value||"").trim();
  if(!typ && !beleg && !url) return "";
  return '<div class="feKtxBlock"><div class="feKtxTit">Quelle</div>'
    +(typ?'<div class="feKtxWert">'+esc(typ)+'</div>':'')
    +(beleg?'<div class="feKtxSub">'+esc(beleg)+'</div>':'')
    +(url?'<a class="feKtxLink" href="'+esc(url)+'" target="_blank" rel="noopener">Seite öffnen ↗</a>':'')
    +'</div>';
}
function _feKtxBild(titel){
  var u=String((window._fgEdit&&window._fgEdit.bild_url)||"").trim();
  if(!u) return "";
  return '<div class="feKtxBlock"><div class="feKtxTit">'+esc(titel||"Produktbild")+'</div>'
    +'<img class="feKtxImg" src="'+esc(u)+'" alt="Produktbild" loading="lazy"></div>';
}
function _feKtxEtikett(){
  var e=(window._fgEdit&&window._fgEdit.etikett)||[];
  if(!Array.isArray(e)||!e.length) return "";
  return '<div class="feKtxBlock"><div class="feKtxTit">Etikett</div>'
    +'<img class="feKtxImg" src="'+esc(String(e[0]))+'" alt="Etikett" loading="lazy">'
    +(e.length>1?'<div class="feKtxSub">'+e.length+' Bilder angehängt</div>':'')+'</div>';
}
function _feKtxRohtext(){
  var r=String((window._fgRefV2&&window._fgRefV2.rohtext)||"").trim();
  if(!r) return '<div class="feKtxBlock"><div class="feKtxTit">Original-Zutatenliste</div>'
    +'<div class="feKtxLeer">Für dieses Produkt ist kein Etiketttext hinterlegt.</div></div>';
  return '<div class="feKtxBlock"><div class="feKtxTit">Original-Zutatenliste</div>'
    +'<div class="feKtxRoh">'+esc(r)+'</div>'
    +'<div class="feKtxSub">So steht es auf der Quelle. Links unsere Zuordnung.</div></div>';
}
var FE_KTX_REITER={
  kopf:     [["quelle","Quelle"],["bild","Produktbild"]],
  analyse:  [["etikett","Etikett"],["quelle","Quelle"]],
  bestand:  [["referenz","Referenz"],["etikett","Etikett"],["rohtext","Rohtext"]]
};
function _feKtxLesekastenHeim(){
  var lk=document.getElementById("fe_wirkFotoCol"); if(!lk) return;
  var heim=document.getElementById("feNwFotoSlot");
  if(heim && lk.parentNode!==heim) heim.appendChild(lk);
  lk.style.display="";
}
function _feKtxReferenzHeim(){
  var rk=document.getElementById("fe_colRef"); if(!rk) return;
  var heim=document.getElementById("fe_gridA");
  if(heim && rk.parentNode!==heim) heim.appendChild(rk);
}
/* EIN Aufraeumer fuer beide ausgeliehenen Karten — damit nie eine haengenbleibt. */
function _feKtxAllesHeim(){ _feKtxLesekastenHeim(); _feKtxReferenzHeim(); }
function feKontextReiter(id){
  window._feKtxReiter=id;
  var sid=window._feKtxSchritt;
  var s=FE_SCHRITTE.find(function(x){ return x.id===sid; })
     || FE_SCHRITTE.find(function(x){ return x.nr===(window._feSchritt||1); });
  try{ feKontextRender(s); }catch(e){ console.error("[Kontextreiter]", e); }
}
function _feKtxSpalte(an){
  var r=document.getElementById("feRahmen");
  if(r && r.classList) r.classList.toggle("riDrei", !!an);
}
function _feKtxReiterZustand(id){
  try{
    if(id==="etikett"){
      var n=window._fgEtikettAnzahl;
      if(window._fgEtikettFehler) return {marke:"?", leer:false, titel:"Etikettbilder konnten nicht geladen werden"};
      if(n===0) return {marke:"keins", leer:true, titel:"Kein Etikettbild vorhanden"};
      if(n>0)   return {marke:String(n), leer:false, titel:n+" Etikettbild"+(n===1?"":"er")+" vorhanden"};
      return {marke:"", leer:false, titel:"Etikettbilder noch nicht nachgesehen"};
    }
    if(id==="rohtext"){
      var r=String((window._fgRefV2&&window._fgRefV2.rohtext)||"").trim();
      return r ? {marke:"", leer:false, titel:"Etiketttext hinterlegt ("+r.length+" Zeichen)"}
               : {marke:"kein Text", leer:true, titel:"Für dieses Produkt ist kein Etiketttext hinterlegt"};
    }
    if(id==="quelle"){
      var typ=((document.getElementById("fe_quelle_typ")||{}).value||"").trim();
      var beleg=((document.getElementById("fe_beleg")||{}).value||"").trim();
      var url=((document.getElementById("fe_url")||{}).value||"").trim();
      if(!typ && !beleg && !url) return {marke:"offen", leer:true, titel:"Noch keine Quelle hinterlegt – sie ist Freigabe-Pflicht"};
      return {marke:"", leer:false, titel:typ||beleg||url};
    }
    if(id==="bild"){
      var pv=document.getElementById("fe_bildPreview");
      var hat=!!(pv && pv.querySelector && pv.querySelector("img"));
      return hat ? {marke:"", leer:false, titel:"Produktbild hinterlegt"}
                 : {marke:"keins", leer:true, titel:"Kein Produktbild hinterlegt"};
    }
    if(id==="referenz"){
      var rk=document.getElementById("fe_colRef");
      if(!rk) return {marke:"", leer:false, titel:""};
      var n2=rk.querySelectorAll ? rk.querySelectorAll(".fgRefZeile, .fgRefRow, tr[data-ref]").length : 0;
      if(n2>0) return {marke:String(n2), leer:false, titel:n2+" Prüfzeile"+(n2===1?"":"n")};
      var txt=String(rk.textContent||"");
      if(/keine Parseranalyse|kein Zutaten-Rohtext/i.test(txt))
        return {marke:"offen", leer:true, titel:"Noch keine Parseranalyse – der Abgleich kann nicht laufen"};
      return {marke:"", leer:false, titel:""};
    }
  }catch(e){}
  return {marke:"", leer:false, titel:""};
}
if(typeof window!=="undefined"){ window._feKtxReiterZustand=_feKtxReiterZustand; }
function feKontextRender(s){
  var box=document.getElementById("feKontext"); if(!box) return;
  if(!feFokusAn() || !s){ box.style.display="none"; box.innerHTML=""; _feKtxSpalte(false); _feKtxAllesHeim(); return; }
  if(window._feKtxSchritt!==s.id){ window._feKtxReiter=null; window._feKtxSchritt=s.id; }
  var R=FE_KTX_REITER[s.id]||[];
  if(!R.length){ box.style.display="none"; box.innerHTML=""; _feKtxSpalte(false); _feKtxAllesHeim(); return; }
  var akt=window._feKtxReiter;
  if(!akt || !R.some(function(r){ return r[0]===akt; })) akt=R[0][0];
  window._feKtxReiter=akt;
  var H='<div class="feKtxTabs">'+R.map(function(r){
    var z=_feKtxReiterZustand(r[0]);
    return '<button type="button" class="feKtxTab'+(r[0]===akt?' akt':'')+(z.leer?' leer':'')+'"'
      +(z.titel?' title="'+esc(z.titel)+'"':'')
      +' onclick="feKontextReiter(\''+r[0]+'\')">'+esc(r[1])
      +(z.marke?'<span class="feKtxMarke'+(z.leer?' leer':'')+'">'+esc(z.marke)+'</span>':'')
      +'</button>';
  }).join('')+'</div><div class="feKtxInhalt" id="feKtxInhalt"></div>';
  /* Fotokarte vor dem innerHTML-Reset zurückhängen, sonst wird das ausgeliehene DOM-Element zerstört. */
  if(akt!=="etikett")  _feKtxLesekastenHeim();
  if(akt!=="referenz") _feKtxReferenzHeim();
  box.style.display=""; box.innerHTML=H; _feKtxSpalte(true);
  var ziel=document.getElementById("feKtxInhalt");
  if(akt==="etikett"){
    var lk=document.getElementById("fe_wirkFotoCol");
    if(lk && ziel){ ziel.appendChild(lk); lk.style.display=""; }
    else if(ziel){
      /* Leerzustand, Ladefehler und fehlende Bildkarte unterscheiden; Ladefehler nicht als kein Bild ausgeben. */
      var _n=window._fgEtikettAnzahl, _f=window._fgEtikettFehler||"";
      var _txt;
      if(_f) _txt='Etikettbilder konnten nicht geladen werden.<br><span style="opacity:.75">'+esc(_f)+'</span>';
      else if(_n===0) _txt='Kein Etikettbild vorhanden.';
      else if(_n>0)  _txt='<b>'+_n+' Etikettbild'+(_n===1?'':'er')+' vorhanden</b>, aber die Bildkarte ist gerade nicht da.'
                          +'<br><span style="opacity:.75">Bitte den Editor einmal neu öffnen – und mir sagen, ob es dann geht.</span>';
      else _txt='Etikettbilder noch nicht nachgesehen.';
      ziel.innerHTML='<div class="feKtxLeer">'+_txt+'</div>';
    }
    return;
  }
  if(akt==="referenz"){
    /* Die echte Referenzkarte, nicht ihre Beschreibung. Sie bringt ihre Riki-Liste,
       den V2-Umschalter und das Nachtragsfeld mit — alles bestehende Funktionen. */
    var rk=document.getElementById("fe_colRef");
    if(rk && ziel){ rk.style.display=""; ziel.appendChild(rk); }
    else if(ziel) ziel.innerHTML='<div class="feKtxLeer">Referenzkarte nicht geladen.</div>';
    return;
  }
  var inh="";
  if(akt==="quelle")   inh=_feKtxQuelle()||'<div class="feKtxBlock"><div class="feKtxLeer">Noch keine Quelle. Weblink, Screenshot oder Bild – Riki liest daraus.</div></div>';
  if(akt==="bild")     inh=_feKtxBild()||'<div class="feKtxBlock"><div class="feKtxLeer">Kein Produktbild hinterlegt. Es ist Publikationsinformation, keine Arbeitsquelle.</div></div>';
  if(akt==="rohtext")  inh=_feKtxRohtext();
  if(akt==="produkt")  inh=_feKtxBild()+'<div class="feKtxBlock"><div class="feKtxTit">Produktstatus</div>'
      +'<div class="feKtxWert">'+esc(String((window._fgEdit&&window._fgEdit.status)||"Entwurf"))+'</div></div>';
  if(ziel) ziel.innerHTML=inh||'<div class="feKtxStill"></div>';
}
if(typeof window!=="undefined"){ window.feKontextReiter=feKontextReiter; window.FE_KTX_REITER=FE_KTX_REITER;
  window._feKtxSpalte=_feKtxSpalte; }
if(typeof window!=="undefined"){ window.feKontextRender=feKontextRender; }
var _ABG_ST={
  uebernommen:{t:"übereinstimmend",  k:"ok",    ico:"✓"},
  offen:      {t:"nicht zugeordnet", k:"info",  ico:"·"},
  pruefen:    {t:"Prüfung nötig",    k:"warn",  ico:"!"},
  ignoriert:  {t:"ignoriert",        k:"still", ico:"–"}
};
function _abgZeilen(){
  var w=window._fgRefV2||{}, d=w.d||{};
  var el=Array.isArray(d.elemente)?d.elemente:[];
  var pzMap={}; (d.pruefzeilen||[]).forEach(function(p){ if(p&&p.Parser_Element_ID!=null) pzMap[p.Parser_Element_ID]=p; });
  return el.map(function(e){
    var st=(typeof _etiStatus==="function")?_etiStatus(e, pzMap[e.id]):"pruefen";
    /* Wo ist das Element bei uns gelandet? Steht als Feld im Vertrag, wird nicht geraten. */
    var wo=[];
    if(e.db_gebunden) wo.push("Zutat");
    if(e.db_zusatzstoff_gebunden) wo.push("Zusatzstoff");
    if(e.db_naehrstoff_gebunden) wo.push("Nährstoff");
    var unser=String(e.stammname||e.name||"").trim();
    var quelle=String(e.original_text||e.name||"").trim();
    /* Eine ABWEICHUNG im Sinne dieser Ansicht ist: nicht übernommen, nicht gebunden,
       blockiert, doppelt oder mit Regelverstoss. Alles aus Vertragsfeldern. */
    var abw = (st!=="uebernommen") || !wo.length
            || String(e.blockiert)==="true" || e.blocker_aktiv===true
            || !!e.db_doppelt || (Array.isArray(e.db_regelverstoesse)&&e.db_regelverstoesse.length>0);
    return {e:e, st:st, unser:unser, quelle:quelle, wo:wo, abw:abw,
            ebene:(Number(e.ebene)===2?"Unterzutat":"Bestandteil"),
            note:(e.note==null?null:e.note)};
  });
}
/* 🔴 RALPH 10.09.2026: "damit muessten auch die unteren Abweichungen wegfallen,
   da diese dann auch in der Liste sind, richtig?" — Richtig. Der Block zeigte
   dieselben Pruefzeilen ein drittes Mal ("0 von 3 Etikett-Zutaten zugeordnet").
   Er wird nicht geloescht, sondern abgeschaltet: eine Zeile zurueck, falls sich
   im Alltag zeigt, dass etwas fehlt. */
var FE_ABGLEICH_AUS = true;
function feAbgleichRender(nurAbw){
  var box=document.getElementById("feAbgleich"); if(!box) return;
  if(FE_ABGLEICH_AUS){ box.style.display="none"; box.innerHTML=""; return; }
  var w=window._fgRefV2||{}, d=w.d||{}, st=w.st||{};
  var gueltig=Number(st.pruefzeilen_gueltig||0)||0, blocker=Number(st.blocker||0)||0;
  var Z=_abgZeilen();
  var _abwN=Z.filter(function(z){ return z.abw; }).length;
  /* Ohne ausdrueckliche Angabe entscheidet der Befund, nicht der Aufrufer. */
  if(nurAbw===undefined||nurAbw===null) nurAbw=(_abwN>0);
  var _uebN=Z.length-_abwN;
  var _fazit=Z.length
    ? (_abwN
        ? '<div class="feAbgFazit warn">⚠ '+_abwN+' Punkt'+(_abwN===1?'':'e')+' prüfen'
          +'<span>'+_uebN+' von '+Z.length+' Etikett-Zutaten zugeordnet</span></div>'
        : '<div class="feAbgFazit ok">✓ '+Z.length+' von '+Z.length+' Etikett-Zutaten zugeordnet'
          +'<span>Keine offenen Abweichungen</span></div>')
    : '';
  var H=_fazit+'<div class="feAbgTabs">'
    +'<button type="button" class="feAbgTab'+(nurAbw?'':' akt')+'" onclick="feAbgleichRender(false)">Gegenüberstellung</button>'
    +'<button type="button" class="feAbgTab'+(nurAbw?' akt':'')+'" onclick="feAbgleichRender(true)">Nur Abweichungen'
      +(_abwN?' <span class="feAbgZahl">'+_abwN+'</span>':'')
    +'</button></div>';

  if(!Z.length){
    /* 🔴 #212, 24.08.2026 — Ralph: "zeigt trotz Etikettbild keine erhobene Pruefung".
       Gemessen an P73647: der Server sagt seit jeher, WARUM. In
       cb_referenz_pruefung_laden steht
         blockierende_fehler:[{art:"kein_rohtext",
           befund:"Es gibt keinen Zutaten-Rohtext - der Abgleich ist unmoeglich."}]
       und das Ergebnis liegt im Browser bereits in window._fgRefV2.d. Der Satz war
       also da und wurde nur nicht angezeigt (§22).
       Der alte Text nannte das SYMPTOM ("keine Pruefzeilen") und klang wie ein
       vergessener Arbeitsschritt. Die Ursache ist eine andere: ein FOTO ist kein
       TEXT. Solange niemand das Etikett hat lesen lassen, gibt es nichts zu
       vergleichen — und kein Knopfdruck der Welt erhebt Pruefzeilen aus nichts.
       Hier wird NICHTS abgeleitet: es wird der Befund des Servers gezeigt. */
    var _blk=(d&&Array.isArray(d.blockierende_fehler))?d.blockierende_fehler:[];
    var _kein=_blk.filter(function(b){ return b&&b.art==='kein_rohtext'; }).length>0;
    H+='<div class="feAbgLeer"><b>'
      +(_kein?'Kein Zutatentext vorhanden – ein Abgleich ist nicht möglich.'
             :'Etikettprüfung noch nicht erhoben.')+'</b>';
    if(_blk.length){
      H+='<div>'+_blk.map(function(b){ return esc(String((b&&b.befund)||'')); })
         .filter(Boolean).join('<br>')+'</div>';
    }
    if(_kein){
      /* Der naechste Schritt, in Ralphs Worten - kein Fachbegriff. */
      H+='<div style="margin-top:6px">Ein Etikett<b>bild</b> reicht dafür nicht: '
        +'Riki muss es erst lesen, damit ein Text entsteht. '
        +'Dafür oben in Station 1 „Riki liest das Bild“ – oder den Text von Hand eintragen.</div>';
    }else{
      H+='<div>Für dieses Produkt liegen keine Prüfzeilen vor. Das ist kein Blocker – '
        +'die Referenzprüfung ist eine Kontrollhilfe.</div>';
    }
    H+='</div>';
    box.innerHTML=H; return;
  }
  var zeig=nurAbw?Z.filter(function(z){ return z.abw; }):Z;
  if(nurAbw && !zeig.length){
    H+='<div class="feAbgLeer"><b>Keine Abweichungen gefunden.</b>'
      +'<div>Alle '+Z.length+' Zeilen der Quelle sind übernommen.</div></div>';
    box.innerHTML=H; return;
  }
  /* Kopfzeilen: bewusst NUR als neutrale Einordnung. Die Quelle liefert dafür
     keine strukturierte Entsprechung — das wird gesagt, nicht behauptet (§1). */
  var kopf="";
  if(!nurAbw){
    var nm=((document.getElementById("fe_name")||{}).value||"").trim();
    var kt=((document.getElementById("fe_kat")||{}).value||"").trim();
    var uk=((document.getElementById("fe_ukat")||{}).value||"").trim();
    kopf='<tr class="feAbgKopfZ"><td>Produkt</td><td>'+esc(nm||"—")+'</td>'
      +'<td class="feAbgStill">nicht als Prüfzeile erfasst</td><td><span class="feAbgSt still">–</span></td></tr>'
      +'<tr class="feAbgKopfZ"><td>Kategorie</td><td>'+esc(kt+(uk?(" / "+uk):""))+'</td>'
      +'<td class="feAbgStill">nicht aus der Quelle ableitbar</td><td><span class="feAbgSt still">–</span></td></tr>';
  }
  var _zu=(_abwN===0 && !nurAbw);
  if(_zu) H+='<details class="feAbgAlle"><summary>Alle '+Z.length+' Zeilen im Detail zeigen</summary>';
  H+='<table class="feAbgTab"><thead><tr>'
    +'<th>Bereich</th><th>Unsere Erfassung</th><th>Quelle</th><th>Status</th></tr></thead><tbody>'
    +kopf
    +zeig.map(function(z){
      var s=_ABG_ST[z.st]||_ABG_ST.pruefen;
      /* Echter Blocker nur, wenn der Server-Guard wirklich greifen würde. */
      var echt=(gueltig>0 && blocker>0 && (String(z.e.blockiert)==="true"||z.e.blocker_aktiv===true));
      var kl=echt?"rot":s.k;
      var gleich=(z.unser && z.quelle && z.unser.toLowerCase()===z.quelle.toLowerCase());
      return '<tr class="feAbgZ'+(z.abw?" abw":"")+'" data-eid="'+esc(String(z.e.id))+'"'
        +(typeof fgEtikettKlick==="function"?' onclick="try{fgEtikettKlick(\''+esc(String(z.e.id))+'\')}catch(e){}"':'')
        +' title="Anklicken – die passende Zeile in den Produktbestandteilen wird hervorgehoben">'
        +'<td class="feAbgBer">'+esc(z.ebene)+(z.wo.length?'<span>'+esc(z.wo.join(" · "))+'</span>':'<span class="feAbgWarn">nicht gebunden</span>')+'</td>'
        +'<td>'+(z.unser?esc(z.unser):'<span class="feAbgStill">—</span>')
          +(z.note!=null?'<span class="feAbgNote">Note '+esc(String(z.note))+'</span>':'')+'</td>'
        +'<td>'+(gleich?'<span class="feAbgStill">gleich</span>':esc(z.quelle||"—"))
          +(z.e.e_nummer?'<span class="feAbgNote">'+esc(String(z.e.e_nummer))+'</span>':'')+'</td>'
        +'<td><span class="feAbgSt '+kl+'">'+s.ico+' '+esc(echt?"Blocker":s.t)+'</span></td></tr>';
    }).join('')
    +'</tbody></table>';
  if(_zu) H+='</details>';
  var roh=String(w.rohtext||"").trim();
  if(roh) H+='<details class="feAbgRoh"><summary>Originalquelle anzeigen</summary>'
    +'<div class="feAbgRohTxt">'+esc(roh)+'</div></details>';
  box.innerHTML=H;
}
if(typeof window!=="undefined"){ window.feAbgleichRender=feAbgleichRender; }
var FE_MITTE={
  kopf:     [".feHolBox","feKopfGrid"],
  analyse:  ["feNwLinks","fe_naehrKacheln","fe_mikroWrap"],
  /* Schritt 3 traegt Tabelle UND Gegenueberstellung. `feAbgleich` liegt ausserhalb
     der Tabs und bekommt eine eigene Rasterzeile — sonst laege es UEBER dem
     Tabelleninhalt, weil beide sich `grid-area: 2/1` teilen. */
  bestand:  ["fe_gridA"]
};
function feFokusMitte(s){
  var erlaubt={}; (FE_MITTE[s.id]||[]).forEach(function(x){ erlaubt[x]=1; });
  var setz=function(el, an){ if(el&&el.style) el.style.display=an?"":"none"; };
  /* Reiter 1 — feKopfLayout traegt Quellbox, Kopfraster und die Bildkarten. */
  var kl=document.getElementById("feKopfLayout");
  if(kl) [].forEach.call(kl.children, function(c){
    var kenn=c.id||(c.className?("."+String(c.className).split(/\s+/)[0]):"");
    setz(c, !!erlaubt[kenn]||!!erlaubt[c.id]);
  });
  /* Reiter 2 — Naehrwerte/Wirkstoffe links, Etikettspalte rechts. */
  var no=document.getElementById("feNwOben");
  if(no) [].forEach.call(no.children, function(c){ setz(c, !!erlaubt[c.id]); });
  ["fe_naehrKacheln","fe_mikroWrap"].forEach(function(id){
    var e=document.getElementById(id); if(!e) return;
    e.style.display = erlaubt[id] ? (id==="fe_mikroWrap"?"flex":"") : "none";
  });
  /* Reiter 3 — Bestandteile und Etikettkarte. */
  var qb=document.getElementById("fe_quickBar"); setz(qb,false);
  var ga=document.getElementById("fe_gridA"); setz(ga, !!erlaubt["fe_gridA"]);
}
/* Der Rueckweg macht alles wieder sichtbar — die alte One-Page ist vollstaendig. */
function feFokusMitteZurueck(){
  ["feKopfLayout","feNwOben"].forEach(function(id){
    var p=document.getElementById(id); if(!p) return;
    [].forEach.call(p.children, function(c){ if(c.style) c.style.display=""; });
  });
  ["fe_naehrKacheln","fe_gridA","fe_quickBar"].forEach(function(id){
    var e=document.getElementById(id); if(e) e.style.display=""; });
  var mw=document.getElementById("fe_mikroWrap"); if(mw) mw.style.display="flex";
}
if(typeof window!=="undefined"){ window.feFokusMitte=feFokusMitte; window.FE_MITTE=FE_MITTE; }
function feFokusAn(){ return !window._feAlleBereiche; }
try{ if(localStorage.getItem("ri_fokus")==="aus")
       console.info("[Fokus] Alter Schalter ri_fokus=aus gefunden und ignoriert — "
         +"der Fokuseditor ist seit 14.08. die Hauptansicht. Kein Handeln nötig."); }catch(e){}

function feFokusSet(an){
  window._feAlleBereiche = !an;
  if(!an){
    feFokusAlleZeigen();
    /* HIER wird der Modus wirklich verlassen — und nur hier. */
    try{ document.body.classList.remove("riFokus"); }catch(e){}
    try{ document.body.removeAttribute("data-fe-schritt"); }catch(e){}
  }
  try{ feFokusNavBauen(); }catch(e){}
  try{ feFokusSchritt(window._feSchritt||1); }catch(e){}
  try{ feAlleBereicheLeiste(); }catch(e){}
}
function feAlleBereicheLeiste(){
  var body=document.getElementById("feEditorBody"); if(!body) return;
  var alt=document.getElementById("feZurueckFokus");
  if(feFokusAn()){ if(alt) alt.remove(); return; }
  if(!alt){
    alt=document.createElement("div"); alt.id="feZurueckFokus"; alt.className="feZurueckFokus";
    alt.innerHTML='<button type="button" onclick="feFokusSet(true)">← Zur Fokusansicht</button>'
      +'<span>Komplettansicht – alle Bereiche gleichzeitig. Sie gilt nur jetzt; '
      +'beim nächsten Produkt und nach dem Neuladen ist die Fokusansicht wieder da.</span>';
    body.insertBefore(alt, body.firstChild);
  }
  alt.style.display="";
}
if(typeof window!=="undefined"){ window.feAlleBereicheLeiste=feAlleBereicheLeiste; }
/* Alles wieder sichtbar machen — der Rückweg in die alte Reiteransicht.
   Er muss existieren: ein Modus ohne Ausgang ist eine Falle (§1.11h). */
function feFokusAlleZeigen(){
  var alle=[]; FE_SCHRITTE.forEach(function(s){
    (s.el||[]).forEach(function(x){ alle.push(x); });
    (s.zelle||[]).forEach(function(x){ alle.push(x); });
    (s.nur||[]).forEach(function(x){ alle.push(x); });
  });
  alle.forEach(function(id){
    var e=document.getElementById(id); if(!e) return;
    var z=e.closest?e.closest(".mz"):null;
    if(z) z.style.display=""; e.style.display="";
  });
  ["fe_nwCard","fe_wirkCard"].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=""; });
  var mw=document.getElementById("fe_mikroWrap"); if(mw) mw.style.display="flex";
  try{ if(typeof feWirkAnsicht==="function") feWirkAnsicht(); }catch(e){}
  /* Auch die Fokus-eigenen Bereiche zurückstellen — sonst bliebe die Abschlussansicht
     stehen oder die Root-Index-Karte im Streifen verschwunden. Der Rückweg muss den
     Zustand VOR dem Fokus wiederherstellen, nicht irgendeinen. */
  var ab=document.getElementById("feAbschluss"); if(ab){ ab.style.display="none"; ab.innerHTML=""; }
  var kg=document.getElementById("feKopfGrid"); if(kg) kg.style.display="";
  var ik=document.getElementById("fe_index");
  if(ik){ var kar=ik.closest?ik.closest(".feKarte,.feRailKarte"):null; if(kar) kar.style.display=""; else ik.style.display=""; }
  ["fe_bioSw","fe_ernaehrChips"].forEach(function(id){
    var e=document.getElementById(id); if(!e) return;
    var z=e.closest?e.closest(".mz"):null; if(z&&z.classList) z.classList.remove("feFokusBreit"); });
  var hb=document.querySelector(".feHolBox"); if(hb) hb.style.display="";
  try{ feFokusQuelle(false); }catch(e){}
  try{ feRailNav(false); }catch(e){}
  try{ feRailAufraeumen(false); }catch(e){}
  try{ feFokusMitteZurueck(); }catch(e){}
  try{ _feKtxAllesHeim(); }catch(e){}
  try{ window._feKtxReiter=null; }catch(e){}
  try{ document.body.removeAttribute("data-fe-schritt"); }catch(e){}
  var pk=document.getElementById("feProdKopf"); if(pk) pk.style.display="none";
  var lk=document.getElementById("fe_wirkFotoCol"); if(lk) lk.style.display="";
  var pv=document.getElementById("fe_bildPreview");
  if(pv){ var pvk=pv.closest?pv.closest(".feKarte"):null; if(pvk) pvk.style.display=""; }
  var tp=document.getElementById("feTopbar"); if(tp){ tp.innerHTML=""; tp.style.display="none"; }
  var kx=document.getElementById("feKontext"); if(kx){ kx.innerHTML=""; kx.style.display="none"; }
  try{ _feKtxSpalte(false); }catch(e){}
  var ag=document.getElementById("feAbgleich"); if(ag){ ag.innerHTML=""; ag.style.display="none"; }
  var ga=document.getElementById("fe_gridA"); if(ga) ga.style.display="";
  var sk=document.getElementById("feSchrittKopf"); if(sk) sk.innerHTML="";
  var sf=document.getElementById("feSchrittFuss"); if(sf) sf.innerHTML="";
  var tb=document.getElementById("feTabBar"); if(tb) tb.style.display="";
  var nv=document.getElementById("feFokusNav"); if(nv) nv.style.display="none";
}
function feFokusStand(s){
  var R=window._fgStatusRoh||null, S=null;
  try{ S=(typeof getErfassungsStatus==="function")?getErfassungsStatus():null; }catch(e){}
  if(!R||!S||!S.bekannt) return {z:"offen", txt:""};
  var g=function(id){ return ((document.getElementById(id)||{}).value||"").trim(); };
  switch(s.id){
    case 'kopf':     if(!R.quelleTyp) return {z:"offen", txt:"noch keine Quelle"};
                     return (g("fe_name") && R.kat)
                       ? {z:"fertig", txt:(g("fe_ukat")||R.kat)}
                       : {z:"offen", txt:(!g("fe_name")?"Name fehlt":"Kategorie fehlt")};
    /* 29.08.2026, RALPH: "nährwerte 3 offen, aber leider keine angabe welche."
       Die Namen lagen längst in R.nwFehlt - angezeigt wurde nur ihre Anzahl.
       Bis zu drei stehen jetzt im Klartext, darüber die ersten zwei und wie
       viele noch folgen. Eine Zahl allein sagt nicht, was zu tun ist. */
    case 'analyse':  return (S.naehrwerte_ok===null) ? {z:"fertig", txt:"nicht erforderlich"}
                       : (S.naehrwerte_ok ? {z:"fertig", txt:"vollständig"}
                                          : {z:"entscheid", txt:(function(){
                                              var f=R.nwFehlt||[];
                                              if(!f.length) return "offen";
                                              if(f.length<=3) return "fehlt: "+f.join(", ");
                                              return "fehlt: "+f.slice(0,2).join(", ")+" +"+(f.length-2)+" weitere";
                                            })()});
    case 'bestand':  var b=(typeof _fgBestandteilBilanz==="function")?_fgBestandteilBilanz():null;
                     if(!b) return {z:"offen", txt:"noch nichts erfasst"};
                     if(b.gesamt===0) return {z:"offen", txt:"noch nichts erfasst"};
                     /* 🔴 10.09.2026, RALPH an P73669: "oben rechts steht noch 6/6 was ja
                        passt, somit waere es egal, was ich mit den 3 Fehlern mache, weil
                        sie nicht blockieren."
                        Es war NICHT egal. Gemessen: P73669 stand auf BLOCKIERT_RIKI, im
                        Protokoll "3 blockierende Befunde". Die 6/6 zaehlt die gebundenen
                        Zutaten - eine richtige Zahl, die eine falsche Farbe traegt, weil
                        die Etikettbefunde in derselben Station stecken, seit es keinen
                        eigenen Schritt "Etikett" mehr gibt.
                        Dieselbe Sorte Fehler wie am 23.08. (siehe unten): die Information
                        stand da, die Farbe sagte das Gegenteil - und gelesen wird die Farbe.
                        Der Zustand wird nicht neu erfunden: S.referenz_blocker ist die Zahl,
                        aus der auch der rote Streifen unter der Karte gebaut wird. */
                     if((S.referenz_blocker||0)>0 && (S.referenz_gueltige_zeilen||0)>0)
                       return {z:"blocker", codes:["etikett_blocker"],
                               txt:(b.gebunden+" Zutaten gebunden · "+S.referenz_blocker
                                    +" Zeile"+(S.referenz_blocker===1?"":"n")+" blockiert die Freigabe")};
                     if(b.offen_unbekannt) return {z:"entscheid", txt:(b.gebunden+" gebunden · offene unbekannt")};
                     if(b.offen>0) return {z:"entscheid",
                        txt:(b.gebunden+"/"+b.gesamt_alle+" · "+fgZuordnungWort(b.offen))};
                     if(b.ohne_identitaet>0) return {z:"entscheid",
                        txt:(b.ohne_identitaet+" von "+b.gesamt+" offen"
                             +(b.benannt?(" · "+b.benannt+" bewusst offen"):""))};
                     /* 🔴 23.08.2026, Ralph-Entscheid: "3 produktbestandteile darf
                        nicht gruen sein, weil dieser punkt noch offen ist."
                        Hier stand z:"fertig" - IMMER, auch wenn ohne_note>0. Die Zahl
                        wurde im Text genannt ("4/4 · 1 ohne Note") und die Station war
                        trotzdem gruen und hiess "erfuellt". Live an P32667 gesehen.
                        Das ist die gefaehrlichste Sorte Anzeigefehler: die Information
                        stand da, aber die Farbe sagte das Gegenteil - und gelesen wird
                        die Farbe. Ein offener Punkt, der gruen leuchtet, wird nicht
                        bearbeitet.
                        ⚠ Der Zustand wird hier nicht neu erfunden: b.ohne_note kommt
                        unveraendert aus _fgBestandteilBilanz(). Geaendert ist nur, ob
                        eine Zahl groesser null als "erledigt" gilt. */
                     /* 🔴 #231: codes sagt, WELCHE Sachverhalte diese Station
                        bereits sichtbar macht. Wer denselben Code anderswo
                        anzeigen will, kann ihn daran erkennen - unabhaengig
                        davon, wie der Text gerade formuliert ist. */
                     if(b.ohne_note>0) return {z:"entscheid",
                        codes:["bestandteil_ohne_verarbeitungsnote"],
                        txt:(b.gesamt+"/"+b.gesamt+" · "+b.ohne_note+" ohne Verarbeitungsnote")};
                     /* 14.09.2026 Ralph: ein Zusatzstoff ohne Bestandteilzeile darf die
                        Station nicht gruen werden lassen - er ist ein Bestandteil, der
                        nicht zusammengefuehrt ist. Die Zahl nennt jetzt beide Seiten. */
                     if(b.zus_ohne_zeile>0) return {z:"entscheid",
                        codes:["zusatzstoff_ohne_bestandteilzeile"],
                        txt:(b.gesamt+"/"+b.gesamt_wahr+" · "+b.zus_ohne_zeile
                             +" Zusatzstoff"+(b.zus_ohne_zeile===1?"":"e")+" ohne Bestandteilzeile")};
                     return {z:"fertig", codes:[], txt:(b.gesamt+"/"+b.gesamt)};
    case 'eigen':    return {z:"neutral", txt:""};
    case 'etikett':  return (S.referenz_blocker>0 && (S.referenz_gueltige_zeilen||0)>0)
                       ? {z:"blocker", txt:(S.referenz_blocker+" Blocker")}
                       : ((S.referenz_gueltige_zeilen||0)>0 ? {z:"fertig", txt:"geprüft"}
                                                            : {z:"neutral", txt:"nicht erhoben"});
    case 'freigabe':
      var _ps=String((window._fgEdit&&window._fgEdit.status)||"").toLowerCase();
      var _frei=(_ps==="aktiv"||_ps==="aktiv ohne index");
      if(_frei) return {z:"fertig", txt:"freigegeben"};
      return S.freigabe_moeglich ? {z:"offen", txt:"Freigabe möglich"}
        : {z:"blocker", txt:(S.freigabe_gruende.length+" Punkt"+(S.freigabe_gruende.length===1?"":"e"))};
  }
  return {z:"offen", txt:""};
}
function _feStandPruef(s, st){
  try{
    var voll=/^(\d+)\/(\1)\b/.exec(String(st.txt||""));
    if(voll && (st.z==="entscheid"||st.z==="blocker"))
      console.warn("[Fokus] Widerspruch am Schritt „"+s.t+"“: Zustand "+st.z+" bei vollständiger Bilanz "+st.txt);
    if(st.z==="fertig" && /offen|fehlt|Blocker/i.test(String(st.txt||"")))
      console.warn("[Fokus] Widerspruch am Schritt „"+s.t+"“: fertig, aber Text sagt "+st.txt);
  }catch(e){}
  return st;
}
var _FEZ={fertig:["✓","var(--k-16a34a,#16a34a)"], aktuell:["●","var(--k-2f6fd6,#2f6fd6)"],
          offen:["○","var(--muted)"], entscheid:["!","var(--k-e0a32e,#e0a32e)"],
          blocker:["!","var(--k-dc2626,#dc2626)"], neutral:["·","var(--muted)"]};
var FE_RAIL_ERLAUBT={ feRailNav:1, feProdKopf:1, feFokusNav:1 };
function feRailAufraeumen(an){
  var rail=document.getElementById("feRail"); if(!rail) return;
  [].forEach.call(rail.children, function(c){
    if(!c || !c.style) return;
    if(an) c.style.display = FE_RAIL_ERLAUBT[c.id] ? "" : "none";
    else   c.style.display = FE_RAIL_ERLAUBT[c.id] ? c.style.display : "";
  });
}
if(typeof window!=="undefined"){ window.FE_RAIL_ERLAUBT=FE_RAIL_ERLAUBT; }
/* ────────────────────────────────────────────────────────────────────────────
   DIE WEICHE — Work #181, 23.08.2026
   ----------------------------------------------------------------------------
   Bis heute hingen drei Bloecke fest im linken Streifen: feRailNav (Posteingang und
   Blaettern), feProdKopf (Statuswechsel, Speichern, Mehr-Menue, Bio, Ernaehrungsform)
   und feFokusNav (die drei Stationen). Ralph will sie oben und beim Scrollen fixiert -
   samt Eigenschaften und Freigabe.
   STATT ZWANZIG KNOEPFE UMZUZIEHEN, WIRD HIER NUR DAS ZIEL GEAENDERT. Die drei
   Funktionen bauen ihre Bloecke unveraendert weiter; sie fragen nur noch, WOHIN.
   Damit kann kein Bedienelement verlorengehen - es zieht der ganze Block um.
   Gemessen waren es 17 Bedienelemente plus 3 im Mehr-Menue; nach dem Umbau muessen
   es dieselben sein, und genau das wird nachgezaehlt.
   RUECKFALL: gibt es die Kopfzone nicht (alte Ansicht, Fehler beim Aufbau), liefert
   die Weiche die Rail zurueck. Dann steht alles wie vorher - nichts verschwindet. */
function _feZielZone(){
  return document.getElementById("feKopfZone") || document.getElementById("feRail");
}
if(typeof window!=="undefined"){ window._feZielZone=_feZielZone; }
function feRailNav(an){
  var rail=_feZielZone(); if(!rail) return;
  var leiste=document.getElementById("feNavLeiste");
  var post=document.getElementById("feNavPost"), blaett=document.getElementById("feNavBlaett");
  /* 🔴 23.08.2026 — DER KNOPF, DEN DER UMZUG VERGESSEN HAT.
     Ralphs Auflage lautete "bitte keine buttons und funktionen vergessen".
     Beim Nachzaehlen gefunden: diese Funktion holt post und blaett in die
     Kopfzone und setzt die alte Leiste danach auf display:none. Der
     Neuladen-Knopf ("🔄 <Buildnummer>", leert Cache und Service-Worker) stand
     ebenfalls in dieser Leiste - und wurde nie mitgenommen. Er ist seit dem
     Umzug unsichtbar.
     Besonders bitter: es ist der Knopf, mit dem man einen neuen Stand holt.
     Ausgerechnet der faellt bei einem Umbau aus, der neue Staende ausliefert.
     Warum es niemandem auffiel: er trug keine Aufgabe, die etwas anzeigt -
     er fehlte einfach, und Fehlen sieht aus wie Ordnung. */
  var neuladen=leiste?leiste.querySelector('button[onclick^="adminNeuLaden"]'):null;
  var kasten=document.getElementById("feRailNav");
  if(!an){
    /* Rueckweg: die Bloecke gehen an ihren Platz in der Kopfleiste zurueck. */
    if(leiste){
      if(post && post.parentNode!==leiste) leiste.insertBefore(post, leiste.firstChild);
      if(blaett && blaett.parentNode!==leiste) leiste.insertBefore(blaett, post?post.nextSibling:leiste.firstChild);
      if(neuladen && neuladen.parentNode!==leiste) leiste.appendChild(neuladen);
      leiste.style.display="";
    }
    if(kasten) kasten.remove();
    return;
  }
  if(!kasten){
    kasten=document.createElement("div"); kasten.id="feRailNav";
    rail.insertBefore(kasten, rail.firstChild);
    var t=document.createElement("div"); t.className="feRailGrpTit";
    t.textContent="Navigation"; kasten.appendChild(t);
  }
  /* Immer ganz oben — auch wenn der Produktkopf zwischenzeitlich neu gebaut wurde. */
  if(rail.firstChild!==kasten) rail.insertBefore(kasten, rail.firstChild);
  if(post && post.parentNode!==kasten) kasten.appendChild(post);
  if(blaett && blaett.parentNode!==kasten) kasten.appendChild(blaett);
  if(neuladen && neuladen.parentNode!==kasten) kasten.appendChild(neuladen);
  /* Die Kopfleiste verschwindet erst, wenn ihre Knoepfe umgezogen sind. */
  if(leiste) leiste.style.display="none";
}
if(typeof window!=="undefined"){ window.feRailNav=feRailNav; }
function feProduktKopf(){
  var rail=_feZielZone(); if(!rail) return;
  var k=document.getElementById("feProdKopf");
  if(!feFokusAn()){ if(k) k.style.display="none"; return; }
  if(!k){ k=document.createElement("div"); k.id="feProdKopf"; rail.insertBefore(k, rail.firstChild); }
  k.style.display="";
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  var nm=((document.getElementById("fe_name")||{}).value||"").trim();
  var ps=String((window._fgEdit&&window._fgEdit.status)||"Entwurf");
  var sv=window._fgSaveState||(pid?"saved":"neu");
  var zt={neu:"noch nicht gespeichert",saving:"speichert …",saved:"gespeichert",error:"Speichern fehlgeschlagen"}[sv]||"gespeichert";
  /* Freigabefaehigkeit kommt aus derselben Struktur wie der Streifen — nicht neu beurteilt. */
  var S=null; try{ S=(typeof getErfassungsStatus==="function")?getErfassungsStatus():null; }catch(e){}
  var frei=(ps.toLowerCase()==="aktiv"||ps.toLowerCase()==="aktiv ohne index");
  var moeglich=!!(S&&S.bekannt&&S.freigabe_moeglich);
  var stAlt=frei?"Aktiv":"Entwurf";
  var stZiel=frei?"Entwurf":"Aktiv";
  k.innerHTML='<div class="feRailGrpTit">Produkt</div>'
    /* Status als Umschalter: er zeigt den IST-Wert und nennt im Titel das Ziel. */
    +'<button type="button" class="feProdStatus '+(frei?'aktiv':'entwurf')+'"'
      +(pid?'':' disabled')
      +' onclick="feRailStatus()" title="'+esc(stAlt+' → '+stZiel
          +(frei?' (aus dem Katalog nehmen)':' (über die geprüfte Freigabe)'))+'">'
      +esc(stAlt)+' <span class="feProdStatusPfeil">⇄</span></button>'
    +'<div class="feProdZust">'+esc(zt)+'</div>'
    +'<div class="feRailGrpTit feKzTrenn">Aktionen</div>'
    +'<div class="feProdAkt">'
      +'<button type="button" class="feProdSave" onclick="try{fgEditSave(false)}catch(e){alert(e&&e.message||e)}">Speichern</button>'
      /* 🔴 23.08.2026, Ralph-Entscheid: "den freigabe button koennte man aendern,
         er sollte so sein wie der blockiert button und blockiert sein, erst wenn
         alles passt umschalten auf freigabe und klickbar machen."
         Hier stand ein gruener "Freigeben"-Knopf, der bei Blockade einfach
         ausgegraut war - und zwei Handbreit weiter stand ein roter Chip
         "● blockiert" mit den Gruenden. Zwei Elemente fuer einen Zustand: das
         eine sagte, was man tun koennte, das andere, warum nicht.
         Sie sind jetzt EINS. Der Knopf steht in der Freigabe-Gruppe (weiter
         unten) und wechselt Farbe, Text und Klickbarkeit mit dem Zustand.
         Ein ausgegrauter Knopf sagt "geht nicht"; ein roter sagt "geht nicht,
         und hier steht warum". */
      +'<button type="button" class="feProdMehr" onclick="feProdMenu(this)" title="Weitere Aktionen">⋯</button>'
    +'</div>'
    +'<div class="feRailGrpTit feKzTrenn">Eigenschaften</div>'
    +_feRailEigen()
    /* 🔴 23.08.2026, Work #181 Schritt 2 — DIE FREIGABE GEHOERT IN DIE KOPFZONE.
       Ralph: "ich meinte auch die eigenschaften und die freigabe."
       Bisher stand hier nur ein Satz ("Freigabe nicht möglich · N Punkte"); der KNOPF
       lag ausschliesslich in der Abschlusskarte am Ende von Station 3. Wer freigeben
       wollte, musste dorthin scrollen - und die Ampel war im Fokusmodus gar nicht zu
       sehen, weil ihre Rail-Karte ausgeblendet wurde.
       HIER WIRD KEINE LOGIK NACHGEBAUT: frei, moeglich und S.freigabe_gruende liegen
       in dieser Funktion bereits vor, und der Knopf ruft dasselbe fgEditSave(true)
       wie der in der Abschlusskarte. Es ist eine zweite ANZEIGE desselben Zustands,
       keine zweite Entscheidung - der Server entscheidet ohnehin allein. */
    /* 🔴 23.08. eigene Klasse feKzFrgTit. Grund, live gemessen und peinlich:
       ich hatte per CSS "alle Gruppenwoerter ausser .feKzTrenn ausblenden"
       geschrieben - in der Annahme, nur FREIGABE trage diese Klasse. Nachgesehen
       tragen sie AKTIONEN, EIGENSCHAFTEN und FREIGABE gleichermassen; feKzTrenn
       ist der senkrechte Trennstrich, kein Name. Nach dem Deploy standen drei
       Woerter da, die weg sein sollten.
       Eine Annahme ueber eine Klasse, die man in zehn Sekunden nachsehen kann,
       ist keine Annahme, sondern Faulheit. */
    /* 🔴 23.08.2026, Ralph-Entscheid: "die information ist gut, aber gehoert zu
       blockiert als begruendung neben den roten blockiert button. dann kann die
       zeile komplett weg."
       Gemeint war der Zwischenbalken mit "· 1 Bestandteil(e) ohne
       Verarbeitungsnote". Der Satz stammt aus S.hinweise, nicht aus
       S.freigabe_gruende - beides sind Listen vom selben Status, die bisher an
       zwei verschiedenen Orten landeten. Ab hier stehen sie zusammen neben dem
       Chip, und der Balken darueber entfaellt.
       ⚠ Reihenfolge: erst die echten Blockadegruende, dann die Hinweise. Ein
       Hinweis ist kein Blocker, und wer zuerst liest, soll den Blocker lesen. */
    +(function(){
       /* 🔴 #231: DEDUPLIZIERT WIRD NACH CODE, NIE NACH WORTLAUT.
          Vorher stand hier ein Textvergleich. Er hat den belegten Fall nicht
          erkannt: "1 Bestandteil(e) ohne Verarbeitungsnote" gegen "1 ohne Note"
          - inhaltlich dasselbe, im Wortlaut verschieden.
          Ein Textfilter geht ausserdem still kaputt, sobald jemand eine
          Formulierung verbessert; der Fehler sieht dann aus wie ein Satz zu
          viel, und niemand sucht danach.
          Faellt ein Code (aelterer Eintrag ohne code), wird der Text als
          Rueckfall genommen - lieber einmal zu viel angezeigt als etwas
          verschluckt. */
       var G=[], Hn=[];
       try{ G=(S&&S.bekannt&&S.freigabe_gruende)?S.freigabe_gruende:[]; }catch(e){}
       try{ Hn=(S&&S.bekannt&&S.hinweise)?S.hinweise:[]; }catch(e){}
       var schluessel=function(x){ return (x&&x.code)?("#"+x.code):((x&&x.t)?x.t:String(x)); };
       var text=function(x){ return (x&&x.t)?x.t:String(x); };
       var gesehen={}, gTexte=[], hTexte=[];
       G.forEach(function(x){ var k=schluessel(x); if(gesehen[k]) return; gesehen[k]=1; gTexte.push(text(x)); });
       Hn.forEach(function(x){ var k=schluessel(x); if(gesehen[k]) return; gesehen[k]=1; hTexte.push(text(x)); });
       window._feFrgTexte=gTexte.concat(hTexte);
       window._feFrgBlocker=gTexte.length;
       return '';
     })()
    +'<div class="feRailGrpTit feKzTrenn feKzFrgTit">Freigabe</div>'
    +'<div class="feProdFrg">'
      /* 🔴 23.08. nachgebessert — HIER STAND NUR "✓ freigegeben".
         Live gemessen an P32667: Produktstatus Aktiv, also freigegeben. Gleichzeitig
         freigabe_moeglich=false mit dem Grund "Score nicht vollständig". Oben rechts
         meldete der Statusstreifen deshalb "Freigabe blockiert", waehrend mein Chip
         daneben "✓ freigegeben" sagte. Beides ist fuer sich richtig - sie beantworten
         zwei verschiedene Fragen: IST es freigegeben gegen KOENNTE es erneut freigegeben
         werden. Nebeneinander liest es sich als Widerspruch, und mein Chip verschwieg
         den offenen Punkt.
         Jetzt steht beides da: der Zustand UND was noch offen ist. Ein freigegebenes
         Produkt mit offenem Punkt ist ein echter Fall - er darf nicht wie ein sauberer
         aussehen. */
      +(function(){
         var T=window._feFrgTexte||[], nB=window._feFrgBlocker||0;
         /* Der Begruendungstext neben dem Chip: alle Punkte im Titel zum
            Nachlesen, die ersten beiden sichtbar, der Rest als Zahl. */
         /* 🔴 06.09.2026, Ralph: der Grund war auf zwei Punkte gekuerzt und der Rest
            stand nur als "+3" da. Jetzt stehen ALLE offenen Punkte, jeder in einer
            eigenen Zeile mit Nummer - man soll lesen koennen, wonach man sucht. */
         var grund=T.length
           ? '<span class="feKzGrund" title="'+esc(T.join(' · '))+'">'
             +T.map(function(t,i){ return (T.length>1?(i+1)+'. ':'')+esc(t); }).join('<br>')
             +'</span>'
           : '';
         /* 🔴 EIN Element fuer den Zustand UND die Handlung (Ralph-Entscheid):
            blockiert -> rot und nicht klickbar, mit dem Grund daneben
            moeglich  -> gruen und klickbar, "Freigeben"
            freigegeben -> gruen und ruhig, kein Knopf noetig
            Der Knopf ist immer dasselbe DOM-Element. Er wechselt nur Farbe,
            Beschriftung und ob er reagiert - deshalb kann er nicht an zwei
            Stellen etwas anderes behaupten. */
         if(frei){
           return '<span class="feKzChip ok">✓ freigegeben</span>'
             +(T.length
                ? '<span class="feKzChip warn" title="'+esc(T.join(' · '))+'">⚠ '
                  +T.length+' offener Punkt'+(T.length===1?'':'e')+'</span>'+grund
                : '');
         }
         if(moeglich){
           return '<button type="button" class="feFrgKnopf ok"'
             +' title="Der Server prüft beim Klick alles erneut."'
             +' onclick="try{fgEditSave(true)}catch(e){alert(e&&e.message||e)}">'
             +'✓ Freigeben</button>'+grund;
         }
         return '<button type="button" class="feFrgKnopf rot" disabled'
           +' title="'+esc(T.length?T.join(' · '):'Freigabe noch nicht möglich')+'">'
           +'● blockiert</button>'+grund;
       })()
      /* 🔴 DIE GESCHICHTE DIESER STELLE, in drei Schritten an EINEM Tag - sie
         erklaert, warum hier jetzt genau ein Knopf steht:
         1. Morgens gab es zwei "✓ Freigeben" in der Kopfzone: feProdFrei im
            Aktionsblock und einen zweiten hier. Beide riefen fgEditSave(true).
            Zwei Knoepfe fuer dieselbe Handlung sind kein Angebot, sondern eine
            Frage - welcher ist der richtige? Der hiesige flog raus.
         2. Damit stand der Zustand ("● blockiert", rot, mit Gruenden) hier und
            die Handlung (gruener Knopf, ausgegraut) zwei Handbreit weiter. Das
            eine sagte, was man tun koennte, das andere, warum nicht.
         3. Ralph: "er sollte so sein wie der blockiert button und blockiert
            sein, erst wenn alles passt umschalten auf freigabe und klickbar
            machen." Genau das ist jetzt gebaut - und feProdFrei ist entfallen,
            weil dieser Knopf seine Aufgabe uebernommen hat.
         Ergebnis: ein Element, das Zustand UND Handlung ist. Es kann nicht mehr
         an zwei Stellen etwas Verschiedenes behaupten. */
    +'</div>';
}
function _feRailEigen(){
  var bio=String(((document.getElementById("fe_bio")||{}).value||"")).trim();
  var wahl=String((window._fgEdit&&window._fgEdit.ernaehrWahl)||"").trim();
  var auto=String((window._fgEdit&&window._fgEdit.ernaehrAuto)||"").trim();
  /* 🔴 24.08.2026: der Helfer kurz() ist hier ENTFALLEN. Er formatierte den
     berechneten Wert fuer den Texthinweis daneben — und den gibt es nicht mehr,
     seit der Chip selbst markiert wird. Eine Funktion, die niemand ruft, sieht
     beim naechsten Lesen aus wie ein vergessener Aufruf.
     FE_EF_KURZ selbst bleibt unangetastet, sie wird anderswo gebraucht. */
  /* 🔴 24.08.2026, Ralph: "bei auto oder manuell soll der entsprechende chip
     ausgewaehlt werden, aber nicht weiss sondern ein helleres gruen."
     seg() kennt deshalb eine dritte Lage. Bisher gab es nur "gewaehlt" und
     "nicht gewaehlt"; im Automatikbetrieb war NUR der Knopf "auto" markiert und
     das Ergebnis stand als Text daneben. Jetzt traegt der Ergebnis-Chip selbst
     die Markierung — der Text daneben faellt damit weg, weil der Chip ihn sagt.
     'abgeleitet' sieht aus wie 'gewaehlt' (Ralphs Vorgabe), der Unterschied
     steht im Tooltip. Beides gruen, damit die Zeile im dunklen Kopfband nicht
     weiss aufblitzt. */
  var seg=function(akt, wert, txt, titel, abgeleitet){
    var kl='feSegBtn';
    if(String(akt)===String(wert)) kl+=' akt';
    else if(abgeleitet) kl+=' akt autoakt';
    return '<button type="button" class="'+kl+'"'
      +' title="'+esc(titel||"")+'" data-wert="'+esc(String(wert))+'">'+esc(txt)+'</button>';
  };
  /* BIO — genau die drei Werte des vorhandenen <select>, kein neuer Status. */
  var B='<div class="feSegTitel">Bio</div><div class="feSeg" data-feld="bio">'
    + seg(bio,'', '? ungeprüft','Niemand hat nachgesehen. Das ist NICHT „kein Bio".')
    + seg(bio,'ja','🌱 Bio','Bio-Kennzeichnung nach EU-Öko-VO 2018/848. Merkmal und Filter, keine Punkte im Index.')
    /* 🔴 23.08. "× kein" statt "× kein Bio". Es steht in der Gruppe "Bio",
       zwischen "? ungeprüft" und "🌱 Bio" - das Wort dahinter wiederholt nur
       die Ueberschrift und kostet Breite in einer Zeile, die ohnehin knapp ist.
       Der Titeltext bleibt vollstaendig, dort ist Platz. */
    + seg(bio,'nein','× kein','Geprüft und ohne Bio-Kennzeichnung.')
    +'</div>';
  /* ERNAEHRUNGSFORM — die Stufen kommen aus FE_EF_STUFEN, nicht aus einer Kopie. */
  var stufen=[];
  try{ stufen=(FE_EF_STUFEN||[]).map(function(x){ return [x.v, (x.ico?x.ico+' ':'')+x.kurz]; }); }catch(e){}
  /* 🔴 23.08. "Ernährung" statt "Ernährungsform" - 102px gegen 69px in einer
     Zeile, die um jede Stelle kaempft. Gemeint ist dasselbe, und die Chips
     daneben (vegan, vegetarisch, tierisch) sagen ohnehin, worum es geht. */
  var E='<div class="feSegTitel">Ernährung</div><div class="feSeg" data-feld="ef">'
    + stufen.map(function(x){
        /* Automatikbetrieb heisst wahl==='' — dann markiert der berechnete Wert
           seinen eigenen Chip. Von Hand gesetzt heisst wahl===x[0]. */
        var abgeleitet = (wahl==='' && auto!=='' && String(auto)===String(x[0]));
        return seg(wahl, x[0], x[1],
          abgeleitet ? 'Automatisch aus den gebundenen Zutaten gerechnet. Anklicken setzt ihn von Hand fest.'
                     : 'Von dir gesetzt – überschreibt die Automatik.',
          abgeleitet);
      }).join('')
    + seg(wahl,'','auto','Automatisch aus den GEBUNDENEN Zutaten gerechnet. Steht eine tierische Zutat nicht im Stamm, fehlt sie in dieser Rechnung.')
    +'</div>'
    /* 🔴 24.08.2026, Ralph, in zwei Schritten:
       (1) "der text 'wird berechnet, sobald Zutaten gebunden sind' kann weg,
            daneben erscheint dann der automatische ausgewaehlte."
       (2) "bei auto oder manuell soll der entsprechende chip ausgewaehlt werden."
       Damit ist der Text VOLLSTAENDIG ueberfluessig: was er sagte, sagt jetzt der
       markierte Chip selbst. Zwei Anzeigen fuer dieselbe Aussage waeren die
       Doppelung, die hier ohnehin verboten ist — und die schmalste Zeile der
       Maske gewinnt eine Handbreit Platz. */
    ;
  var _brE=String((window._fgEdit&&window._fgEdit.bratenEignung)||"").trim();
  var _brKat=String(((document.getElementById("fe_kat")||{}).value||"")).trim();
  var _brZeigen=(_brE==="geeignet"||_brE==="nicht_scharf_anbraten")
             || (_brE==="ungeprueft" && _brKat==="Öle & Fette");
  var BR="";
  if(_brZeigen){
    var _brT={
      geeignet:              ["✅ zum Braten geeignet","gut"],
      nicht_scharf_anbraten: ["⚠️ nicht scharf anbraten","warn"],
      ungeprueft:            ["○ noch nicht geprüft","offen"]
    }[_brE]||["○ noch nicht geprüft","offen"];
    var _brTip=(window._fgEdit&&window._fgEdit.bratenGrund)||"";
    var _brBel=(window._fgEdit&&window._fgEdit.bratenBeleg)||"";
    var _brSt =(window._fgEdit&&window._fgEdit.bratenStand)||"";
    var _brTitel=(_brTip||"Kein Grund hinterlegt.")
      +(_brBel?("\n\nBeleg: "+_brBel):"\n\nKein Beleg hinterlegt.")
      +(_brSt?("\nStand: "+_brSt):"")
      +"\n\nServerurteil – im Editor nicht änderbar.";
    BR='<div class="feSegTitel">Erhitzen</div>'
      +'<div class="feRailBraten '+_brT[1]+'" title="'+esc(_brTitel)+'">'+esc(_brT[0])+'</div>';
  }
  return '<div class="feRailEigen">'+B+E+BR+'</div>';
}
function feRailEigenSetz(feld, wert){
  try{
    if(feld==='bio'){
      var sel=document.getElementById("fe_bio");
      if(sel){ sel.value=wert; }
      try{ if(typeof feBioChange==="function") feBioChange(); }catch(e){}
      /* KORREKTUR beim Bauen: `feBioPrefillSw` gibt es nicht — gemessen heisst der
         Renderer des Bio-Schalters `feBioSwRender`. Ein Aufruf auf einen erfundenen
         Namen waere still fehlgeschlagen und der grosse Schalter haette den neuen
         Wert nicht gezeigt. */
      try{ if(typeof feBioSwRender==="function") feBioSwRender(); }catch(e){}
    } else {
      /* feErnaehrWahl ist der zentrale Setter — er pflegt `_fgEdit.ernaehrWahl`
         und zeichnet die grossen Chips selbst nach. */
      if(typeof feErnaehrWahl==="function") feErnaehrWahl(wert);
    }
    if(window._fgDirtyArmed && window._fgDirty) window._fgDirty.kopf=true;
    try{ feProduktKopf(); }catch(e){}   /* Rail sofort nachziehen */
    try{ fePlaus(); }catch(e){}
  }catch(e){ console.error("[Rail-Eigenschaften] setzen:", e); }
}
/* Ein Klickhorcher statt Inline-onclick je Knopf: die Werte enthalten Leerzeichen
   und Umlaute („enthält Tierprodukte"), und die Reihenfolge der Stufen kann sich
   aendern. Ein Attribut ist dafuer robuster als ein zusammengebauter Aufruf. */
if(typeof document!=="undefined") document.addEventListener("click", function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest(".feSeg .feSegBtn"):null;
  if(!b) return;
  var seg=b.closest(".feSeg"); if(!seg) return;
  ev.preventDefault();
  feRailEigenSetz(seg.getAttribute("data-feld"), b.getAttribute("data-wert")||"");
});
if(typeof window!=="undefined") window.feRailEigenSetz=feRailEigenSetz;
/* Der Klick oeffnet den BESTEHENDEN Bereich und springt hin — er baut keinen
   zweiten Editor. Die Felder gehoeren zu Schritt 3; von dort sind sie erreichbar. */
function feRailEigenOeffnen(zielId){
  try{
    var z=FE_SCHRITTE.find(function(x){ return (x.zelle||[]).indexOf(zielId)>=0; });
    if(z && window._feSchritt!==z.nr) feFokusSchritt(z.nr);
    var e=document.getElementById(zielId); if(!e) return;
    var k=e.closest?e.closest(".mz"):null; if(k) k.style.display="";
    e.style.display="";
    if(e.scrollIntoView) e.scrollIntoView({block:"center"});
    if(k&&k.classList){ k.classList.add("feEigBlink");
      setTimeout(function(){ k.classList.remove("feEigBlink"); }, 1600); }
  }catch(e){ console.error("[Rail-Eigenschaften]", e); }
}
if(typeof window!=="undefined"){ window._feRailEigen=_feRailEigen;
  window.feRailEigenOeffnen=feRailEigenOeffnen; }
async function feRailStatus(){
  var pid=(window._fgEdit&&window._fgEdit.id)||""; if(!pid) return;
  var ps=String((window._fgEdit&&window._fgEdit.status)||"Entwurf");
  var nm=((document.getElementById("fe_name")||{}).value||"").trim();
  var cur=(ps.toLowerCase()==="aktiv"||ps.toLowerCase()==="aktiv ohne index")?"Aktiv":"Entwurf";
  await feStatusWechsel(pid, cur, nm||pid, function(){
    try{ openFgEditor(pid); }catch(e){ location.reload(); }
  });
}
if(typeof window!=="undefined"){ window.feRailStatus=feRailStatus; }
function feProdMenu(btn){
  var alt=document.getElementById("feProdMenuBox"); if(alt){ alt.remove(); return; }
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  var m=document.createElement("div"); m.id="feProdMenuBox"; m.className="feProdMenuBox";
  m.innerHTML=(pid?'<button type="button" onclick="document.getElementById(\'feProdMenuBox\').remove();try{peMarkieren(\''+esc(pid)+'\')}catch(e){try{feMarkieren()}catch(_){}}">Markieren</button>':'')
    +(pid?'<button type="button" class="rot" onclick="document.getElementById(\'feProdMenuBox\').remove();fgProduktLoeschen()">Produkt löschen</button>':'')
    +'<button type="button" title="Öffnet die komplette Altansicht – nur für jetzt. Beim nächsten Produkt und nach dem Neuladen ist die Fokusansicht wieder da." onclick="document.getElementById(\'feProdMenuBox\').remove();feFokusSet(false)">Alle Bereiche zeigen</button>';
  btn.parentNode.appendChild(m);
}
if(typeof window!=="undefined"){ window.feProdMenu=feProdMenu; window.feProduktKopf=feProduktKopf;
  window.feRailAufraeumen=feRailAufraeumen; }
function feFokusNavBauen(){
  var rail=_feZielZone(); if(!rail) return;
  /* 🔴 23.08. Die Stationen haengen NEBEN dem dunklen Kasten, nicht darin.
     Im Entwurf sind sie drei helle Karten unter dem Kasten - mitfixiert, aber
     optisch getrennt. Solange sie in #feKopfZone standen, konnte der Kasten
     unten nicht rund enden: das letzte Element darin war hell und hat die
     Rundung verdeckt.
     Sie ziehen deshalb in den gemeinsamen Rahmen #feKopfFix, gleich neben die
     Bedienzeile statt hinein. Gibt es den Rahmen nicht (aelterer Aufbau, oder
     die Rail als Rueckfall), bleibt alles wie bisher. */
  var ziel=document.getElementById("feKopfFix")||rail;
  var nav=document.getElementById("feFokusNav");
  if(!nav){
    nav=document.createElement("div"); nav.id="feFokusNav";
    ziel.appendChild(nav);
  }
  if(nav.parentNode!==ziel) ziel.appendChild(nav);
  if(!feFokusAn()){ nav.style.display="none"; feRailNav(false); feRailAufraeumen(false); feProduktKopf(); return; }
  nav.style.display="";
  feRailAufraeumen(true); feRailNav(true); feProduktKopf();
  var akt=window._feSchritt||1;
  nav.innerHTML='<div class="feRailGrpTit">Arbeitsfluss</div>'
    +FE_SCHRITTE.map(function(s){
      var st=_feStandPruef(s, feFokusStand(s));
      var _wort={fertig:"erfüllt", offen:"offen", entscheid:"zu prüfen",
                 blocker:"blockiert", neutral:""}[st.z];
      var _farbe=(_FEZ[st.z]||_FEZ.offen)[1];
      var _det=String(st.txt||"").trim();
      if(_wort && _det && _det.toLowerCase()===_wort.toLowerCase()) _det="";
      var _unter=(_wort?'<b class="feFokusWort" style="color:'+_farbe+'">'+esc(_wort)+'</b>':'')
               +((_wort&&_det)?'<span class="feFokusDet"> · '+esc(_det)+'</span>'
                              :(_det?'<span class="feFokusDet">'+esc(_det)+'</span>':''));
      var _gr=[];
      try{ var _S=(typeof getErfassungsStatus==="function")?getErfassungsStatus():null;
           _gr=((_S&&_S.freigabe_gruende)||[]).filter(function(g){ return g && g.s===s.id; }); }catch(e){}
      var _grHtml=_gr.length
        ? '<span class="feFokusGruende">'+_gr.map(function(g){
            return '<span class="feFokusGrund" title="'+esc(g.d||"")+'">'+esc(g.t)+'</span>'; }).join('')+'</span>'
        : '';
      return '<button type="button" class="feFokusSt'+(s.nr===akt?" akt":"")+'" onclick="feFokusSchritt('+s.nr+')" title="'+esc(s.kurz)+'">'
        +'<span class="feFokusTxt"><b>'+s.nr+' '+esc(s.t)+'</b>'
        +(_unter?'<span class="feFokusSub">'+_unter+'</span>':'')
        +_grHtml+'</span></button>';
    }).join("")
    ;
}
function feFokusSchritt(n){
  window._feSchritt=n;
  var s=FE_SCHRITTE.find(function(x){ return x.nr===n; }); if(!s) return;
  /* Die Klasse am <body> schaltet das Fokus-Raster in ui.css (alle Schrittcontainer
     in derselben Zelle). Ohne sie gilt die alte One-Page unveraendert. */
  try{ document.body.classList.toggle("riFokus", !!feFokusAn()); }catch(e){}
  if(!feFokusAn()){ try{ feTabWechsel(s.tab); }catch(e){} return; }
  var tb=document.getElementById("feTabBar"); if(tb) tb.style.display="none";
  try{ feTabWechsel(s.tab); }catch(e){}
  /* Erst alles des betroffenen Reiters zeigen, dann gezielt ausblenden — so bleibt
     ein Feld, das keiner Zuordnung angehört, sichtbar statt still zu verschwinden. */
  feFokusAlleZeigen();
  var tb2=document.getElementById("feTabBar"); if(tb2) tb2.style.display="none";
  var nv=document.getElementById("feFokusNav"); if(nv) nv.style.display="";
  var zeig={}; (s.el||[]).concat(s.zelle||[], s.nur||[]).forEach(function(x){ zeig[x]=1; });
  /* Kopfzellen: alles ausblenden, was einem ANDEREN Schritt gehört. */
  var fremd={};
  FE_SCHRITTE.forEach(function(o){ if(o.nr===n) return;
    (o.zelle||[]).forEach(function(x){ if(!zeig[x]) fremd[x]=1; });
    (o.el||[]).forEach(function(x){ if(!zeig[x]) fremd[x]=1; }); });
  Object.keys(fremd).forEach(function(id){
    var e=document.getElementById(id); if(!e) return;
    var z=e.closest?e.closest(".mz"):null;
    if(z) z.style.display="none"; else e.style.display="none";
  });
  if(s.id==='analyse'){
    var _p=(typeof feNaehrwertPflicht==="function")?feNaehrwertPflicht():{art:"lebensmittel",makros_erforderlich:true};
    var _z=function(id,an){ var e=document.getElementById(id); if(e) e.style.display=an?"":"none"; };
    /* 🔴 06.09.2026, Work #576 — die Naehrwertkarte war in Schritt 2 fuer alles
       ausser Lebensmitteln weg. Damit konnte Ralph bei einem Supplement gar
       keine Naehrwerte eintragen, auch wenn sie auf dem Etikett standen -
       gemessen bei 154 von 249 Supplements der Fall. Jetzt bleibt sie ueberall
       da, wo Naehrwerte vorkommen koennen; nur Mineralwasser hat wirklich keine
       Makrotabelle und behaelt seine Mineralstoffanalyse. */
    var _nwZeigen=(_p.art!=="mineralwasser");
    _z("fe_nwCard",   _nwZeigen);
    _z("fe_wirkCard", true);                       /* trägt Wirkstoffe UND Mineralstoffanalyse */
    _z("fe_mikroWrap",_p.art==="lebensmittel");
    if(_nwZeigen){ try{ feNwKeineSicht(); }catch(e){} }
    if(_p.art==="lebensmittel"){ var _mw=document.getElementById("fe_mikroWrap"); if(_mw) _mw.style.display="flex"; }
  } else if(s.tab===2){
    ["fe_nwCard","fe_wirkCard"].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display=""; });
    var _mw2=document.getElementById("fe_mikroWrap"); if(_mw2) _mw2.style.display="flex";
  }
  var agb=document.getElementById("feAbgleich");
  if(agb){
    if(s.id==='bestand'){
      agb.style.display="";
      try{ feAbgleichRender(); }catch(e){ console.error("[Abgleich]", e); }
    } else {
      agb.style.display="none"; agb.innerHTML="";
    }
    var gr=document.getElementById("fe_gridA");
    if(gr) gr.style.display=(s.id==='bestand')?"":"none";
  }
  /* `nur` heisst: in diesem Reiter zaehlt genau diese Spalte. */
  if(s.nur && s.nur.length){
    ["fe_colZut","fe_colZus","fe_colRef"].forEach(function(id){
      var e=document.getElementById(id); if(!e) return;
      e.style.display=(s.nur.indexOf(id)>=0)?"":"none";
    });
    var g=document.getElementById("fe_gridA");
    if(g){ g.style.gridTemplateColumns=""; g.style.height=""; g.style.minHeight=""; }
  } else {
    var g2=document.getElementById("fe_gridA");
    if(g2) g2.style.gridTemplateColumns="minmax(0,1fr) minmax(340px,1.18fr)";
    var z2=document.getElementById("fe_colZut"); if(z2) z2.style.display="";
    var r2=document.getElementById("fe_colRef"); if(r2) r2.style.display="";
  }
  ["fe_bioSw","fe_ernaehrChips"].forEach(function(id){
    var e=document.getElementById(id); if(!e) return;
    var z=e.closest?e.closest(".mz"):null; if(!z||!z.classList) return;
    z.classList.toggle("feFokusBreit", false);   /* Bio/Ernaehrung stehen in der Rail */
  });

  var ab=document.getElementById("feAbschluss");
  if(ab){ ab.style.display="none"; ab.innerHTML=""; }
  /* Die Root-Index-Karte der Rail bleibt im Fokus aus — der Score steht jetzt
     kompakt im oberen Statusstreifen (Punkt 4), und zweimal ist einmal zu viel. */
  var ik=document.getElementById("fe_index");
  if(ik){ var kar=ik.closest?ik.closest(".feKarte,.feRailKarte"):null;
    if(kar) kar.style.display="none"; else ik.style.display="none"; }

  /* ── SCHRITT 1: nur die drei Eingänge. Die feHolBox gehört zu Schritt 1 und
     verschwindet in allen anderen Schritten — sie ist Werkzeug, nicht Inhalt. */
  var hb=document.querySelector(".feHolBox");
  try{ feFokusQuelle(s.id==='kopf'); }catch(e){ console.error("[Fokus] Quelle:", e); }

  try{ feFokusMitte(s); }catch(e){ console.error("[Fokus] Mitte:", e); }
  try{ document.body.setAttribute("data-fe-schritt", s.id); }catch(e){}


  try{ feFokusKopfFuss(s); }catch(e){ console.error("[Fokus] Kopf/Fuss:", e); }
  try{ feKontextRender(s); }catch(e){ console.error("[Kontextspalte]", e); }
  try{ feTopbarRender(); }catch(e){ console.error("[Topbar]", e); }
  try{ var _fs=document.getElementById("fe_frgSlot"); if(_fs) _fs.innerHTML=""; }catch(e){}
  try{ feFokusNavBauen(); }catch(e){}
  try{
    var _r=document.getElementById("feRahmen");
    if(_r && _r.scrollIntoView) _r.scrollIntoView({block:"start"});
    var _ov=document.getElementById("panel"); if(_ov) _ov.scrollTop=0;
    var _eb=document.getElementById("feEditorBody"); if(_eb) _eb.scrollTop=0;
  }catch(e){}
}
function feFokusKopfFuss(s){
  var k=document.getElementById("feSchrittKopf"), fz=document.getElementById("feSchrittFuss");
  /* 🔴 23.08.2026, Work #181 — DER SCHRITTKOPF IST IM FOKUSMODUS WEG.
     Ralph: "zeile unter den drei buttons 1 kopf & quelle kann weg, das waere
     doppelt."
     Er hat recht: die Stationskarte direkt darueber sagt "1 Kopf & Quelle ·
     erfuellt · Fleisch & Fisch", und zehn Pixel darunter stand nochmal
     "1 Kopf & Quelle · Quelle geben, Identitaet pruefen". Dieselbe
     Ueberschrift zweimal, nur die zweite ohne Status.
     ⚠ Ich hatte hier zuerst geschrieben "entfaellt nur im Fokusmodus" und
     trotzdem bedingungslos geleert - Kommentar und Code sagten Verschiedenes.
     Nachgesehen: die alte Zeile lautete `feFokusAn() ? '<div…>' : ""`, der Kopf
     war also ohnehin NUR im Fokusmodus gefuellt. Ausserhalb war er immer leer.
     Bedingungslos leeren ist deshalb richtig - und die Bedingung waere eine
     gewesen, die nie greift. Ein Kommentar, der mehr verspricht als der Code
     tut, ist beim naechsten Lesen schlimmer als gar keiner. */
  if(k){ k.innerHTML=""; }
  if(fz){
    if(!feFokusAn()){ fz.innerHTML=""; return; }
    var vor=FE_SCHRITTE.find(function(x){ return x.nr===s.nr-1; });
    var nach=FE_SCHRITTE.find(function(x){ return x.nr===s.nr+1; });
    fz.innerHTML='<div class="feSchrittFuss">'
      +(vor?'<button type="button" class="feSchrittBtnSek" onclick="feFokusSchritt('+vor.nr+')">← Zurück</button>':'<span></span>')
      +(nach?'<button type="button" class="feSchrittBtnPrim" onclick="feFokusSchritt('+nach.nr+')">Weiter: '+esc(nach.t)+' →</button>':'<span></span>')
      +'</div>';
  }
}
if(typeof window!=="undefined"){ window.feFokusKopfFuss=feFokusKopfFuss;
  window.feFokusSchritt=feFokusSchritt; window.feFokusSet=feFokusSet;
  window.feFokusNavBauen=feFokusNavBauen; window.feFokusAn=feFokusAn; window.FE_SCHRITTE=FE_SCHRITTE; }
function feTabBadgeUpdate(off, done){
  var b=document.getElementById('feTab3Badge'); if(!b) return;
  var n=Number(off)||0, d=Number(done)||0;
  b.className='feStBadge'+(n?' warn':(d?' ok':''));
  b.textContent=n?(n+' offen'):(d?(d+'/'+d):'');
  b.title=n?(n+' Bestandteil(e) noch offen'):(d?(d+' Bestandteile erfasst'):'');
  var t3=document.getElementById('feTabBtn3');
  var t3t=t3?t3.querySelector('.feStTxt'):null;
  if(t3t && t3t.innerHTML.indexOf('Produktbestandteile')<0){
    t3t.innerHTML='\ud83e\udd63 Produktbestandteile ';
    t3t.appendChild(b);
  }
}
function feTab1BadgeUpdate(off, ean){
  var b=document.getElementById('feTab1Badge');
  if(b){ var n=Number(off)||0; b.className='feStBadge'+(n?' warn':' ok'); b.textContent=n?(n+' offen'):'\u2713'; }
  var e=document.getElementById('feTab1Ean');
  if(e){
    var _eanTxt=(ean==='da')?'EAN erfasst':((ean==='offen')?'EAN bewusst offen':'EAN fehlt \u2013 blockiert die Freigabe nicht');
    if(ean==='da'){ e.style.display='none'; e.textContent=''; e.removeAttribute('title'); }
    else {
      e.style.display='';
      e.className='feStBadge'+(ean==='offen'?' gelb':' warn');
      e.textContent=(ean==='offen')?'EAN offen':'EAN fehlt';
      e.title=_eanTxt;
    }
    if(b) b.title=(Number(off)||0)?((Number(off))+' offene Pflichtpunkte auf dieser Station \u00b7 '+_eanTxt):('Station vollst\u00e4ndig \u00b7 '+_eanTxt);
  }
  /* Der bisherige Pflichtzähler enthält Kopf- und Nährwertpunkte. Als Gesamtstatus zusätzlich am
     Nährwertreiter zeigen, damit der Arbeitsort sichtbar bleibt, ohne Fachlogik zu duplizieren. */
  var P=(typeof feNaehrwertPflicht==="function")?feNaehrwertPflicht():{makros_erforderlich:true,art:"lebensmittel"};
  var t2=document.getElementById('feTabBtn2');
  var t2txt=t2?t2.querySelector('.feStTxt'):null;
  var nb=document.getElementById('feTab2Badge');
  if(t2txt){
    var _titel=(P.art==="mineralwasser")?'🧪 Mineralstoffanalyse'
             :(P.art==="supplement")   ?'🧪 Wirkstoffe &amp; Dosis'
             :'🧪 Nährwerte &amp; Wirkstoffe';
    var _b=nb||document.getElementById('feTab2Badge');
    t2txt.innerHTML=_titel+' ';
    if(_b) t2txt.appendChild(_b);
    nb=_b;
  }
  if(nb){
    if(!P.makros_erforderlich){
      /* Kein Pflichtzähler – stattdessen, was hier wirklich zählt. Bei Mineralwasser
         die Zahl der erfassten Mineralstoffe; sie steht in den Wirkstoffzeilen. */
      var _n=(typeof feWirkCount==="function")?feWirkCount():0;
      nb.style.display='';
      nb.className='feStBadge ok';
      nb.textContent=(P.art==="mineralwasser")?(_n?(_n+' erfasst'):'✓'):'✓';
      nb.title=P.grund||"";
    } else {
      var z=Number(off)||0;
      nb.className='feStBadge'+(z?' warn':' ok');
      nb.style.display=z?'':'none';
      nb.textContent=z?(z+' prüfen'):'';
      nb.title="";
    }
  }
}
function feStationBeobachten(){
  try{
    if(window._feStObs){ window._feStObs.disconnect(); window._feStObs=null; }
    var ziele=[document.getElementById('feTab1'),document.getElementById('feTab2'),document.getElementById('feTab3')].filter(Boolean);
    if(!ziele.length || typeof IntersectionObserver!=='function') return;
    var sichtbar={};
    window._feStObs=new IntersectionObserver(function(eintraege){
      eintraege.forEach(function(e){ sichtbar[e.target.id]=e.isIntersecting; });
      var n=1;
      if(sichtbar.feTab3) n=3; else if(sichtbar.feTab2) n=2; else n=1;
      window._feTab=n;
      ['feTabBtn1','feTabBtn2','feTabBtn3'].forEach(function(id,i){
        var b=document.getElementById(id); if(b) b.classList.toggle('on', i+1===n);
      });
    }, { rootMargin:'-45% 0px -45% 0px', threshold:0 });
    ziele.forEach(function(z){ window._feStObs.observe(z); });
  }catch(e){ console.error('[Editor] Stationsbeobachter:', e); }
}
if(typeof window!=='undefined'){ window.feStationBeobachten=feStationBeobachten; window.feDreiReiterInit=feDreiReiterInit; window.feTabWechsel=feTabWechsel; window.feTabBadgeUpdate=feTabBadgeUpdate; window.feTab1BadgeUpdate=feTab1BadgeUpdate; }
function fgFotoPlatzieren(){
  var col=document.getElementById('fe_wirkFotoCol');
  if(!col) return;
  var ziel=document.getElementById('feNwFotoSlot');
  if(ziel && col.parentNode!==ziel) ziel.appendChild(col);
  col.style.display='block';
  /* Auf der Rueckseite dehnt die CSS-Regel #fe_fotoMount #fe_wirkFotoBox die Box
     auf die Resthoehe (Z. 15836). Dafuer muss der Inline-Wert WEG - ein Inline-Stil
     schlaegt jede Regel, sonst bliebe die Box auf der Rueckseite zu hoch. */
  var box=document.getElementById('fe_wirkFotoBox');
  if(box) box.style.height = 'clamp(360px,52vh,680px)';
  try{ fgWirkFotoRender(); }catch(e){}
}
if(typeof window!=="undefined"){ window.fgFotoPlatzieren=fgFotoPlatzieren; }
function fgRefMountFoto(){ fgFotoPlatzieren(); }
function fgRefFlip(toBack){
  var inner=document.getElementById('fe_flipInner'); if(!inner) return;
  var back=(toBack===undefined)?!inner.classList.contains('geflippt'):!!toBack;
  inner.classList.toggle('geflippt', back);
  if(back){ try{ fgRefMountFoto(); }catch(e){} setTimeout(function(){ try{ fgWirkFotoRender(); }catch(e){} }, 60); }
}
function fgRefShowFoto(j){
  window._fgWirkFoto=window._fgWirkFoto||{ idx:0, scale:1, x:0, y:0, baseFit:1 };
  window._fgWirkFoto.idx=(j||0);
  /* 28z33: auf Reiter 1 ist die Referenz-Karte unsichtbar - dann direkt die Grossansicht */
  var _box=document.getElementById('fe_wirkFotoBox');
  if(!(_box && _box.offsetParent!==null)){ try{ fgEtikettZoom(j||0); }catch(e){} return; }
  var special=false; try{ special=_fgIstSpecial(); }catch(e){}
  if(special){ /* Foto haengt neben der Dosis-Tabelle - dorthin scrollen wie bisher */
    try{ fgRefMountFoto(); }catch(e){}
    try{ var c=document.getElementById('fe_wirkFotoCol'); if(c&&c.scrollIntoView) c.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){}
  } else { try{ fgRefFlip(true); }catch(e){} }   /* 28h: Karte umdrehen statt scrollen */
}
if(typeof window!=='undefined'){ window.fgRefMountFoto=fgRefMountFoto; window.fgRefFlip=fgRefFlip; window.fgRefShowFoto=fgRefShowFoto; }
function fgWirkFotoApply(){ var img=document.getElementById('fe_wirkFotoImg'); if(!img) return; var s=window._fgWirkFoto; img.style.transform='translate('+Math.round(s.x)+'px,'+Math.round(s.y)+'px) scale('+s.scale+')'; }
function fgWirkFotoReset(){
  var s=window._fgWirkFoto, box=document.getElementById('fe_wirkFotoBox'), img=document.getElementById('fe_wirkFotoImg');
  s.x=0; s.y=0; s.scale=1; s.baseFit=1;
  if(box&&img&&img.naturalWidth&&box.clientWidth){ var fit=box.clientWidth/img.naturalWidth; if(fit>0){ s.scale=fit; s.baseFit=fit; } }
  fgWirkFotoApply();
}
function fgWirkFotoZoomAt(factor, cx, cy){
  var s=window._fgWirkFoto, box=document.getElementById('fe_wirkFotoBox'); if(!box) return;
  var lo=(s.baseFit||0.1)*0.4, hi=(s.baseFit||1)*10;
  var ns=Math.max(lo, Math.min(hi, s.scale*factor)); if(ns===s.scale) return;
  var r=box.getBoundingClientRect(), px=cx-r.left, py=cy-r.top;
  s.x = px - (px - s.x)*(ns/s.scale);
  s.y = py - (py - s.y)*(ns/s.scale);
  s.scale=ns; fgWirkFotoApply();
}
function fgWirkFotoZoomBtn(dir){ var box=document.getElementById('fe_wirkFotoBox'); if(!box) return; var r=box.getBoundingClientRect(); fgWirkFotoZoomAt(dir>0?1.3:0.77, r.left+r.width/2, r.top+r.height/2); }
function fgWirkFotoNav(d){ var arr=fgWirkFotoArr(); if(arr.length<2) return; var s=window._fgWirkFoto; s.idx=(s.idx+d+arr.length)%arr.length; fgWirkFotoRender(); }
function fgWirkFotoRender(){
  var box=document.getElementById('fe_wirkFotoBox'); if(!box) return;
  var img=document.getElementById('fe_wirkFotoImg'), leer=document.getElementById('fe_wirkFotoLeer'), nav=document.getElementById('fe_wirkFotoNav');
  var arr=fgWirkFotoArr(), s=window._fgWirkFoto; if(s.idx>=arr.length) s.idx=0;
  if(!arr.length){ if(img) img.style.display='none'; if(leer) leer.style.display='flex'; if(nav) nav.innerHTML=''; return; }
  if(leer) leer.style.display='none';
  if(img){ img.style.display='block'; img.onload=function(){ fgWirkFotoReset(); }; if(img.getAttribute('src')!==arr[s.idx]) img.src=arr[s.idx]; else fgWirkFotoReset(); }
  if(nav){ nav.innerHTML = arr.length>1
    ? '<button type="button" onclick="fgWirkFotoNav(-1)" style="width:28px;height:28px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);cursor:pointer">‹</button><span style="font-size:12px;color:var(--muted)">'+(s.idx+1)+' / '+arr.length+' Foto</span><button type="button" onclick="fgWirkFotoNav(1)" style="width:28px;height:28px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);cursor:pointer">›</button>'
    : ''; }
  fgWirkFotoBind();
}
function fgWirkFotoBind(){
  var box=document.getElementById('fe_wirkFotoBox'); if(!box||box._fgBound) return; box._fgBound=true;
  box.addEventListener('wheel', function(e){ e.preventDefault(); fgWirkFotoZoomAt(e.deltaY<0?1.12:0.89, e.clientX, e.clientY); }, {passive:false});
  var drag=null, moved=false;
  box.addEventListener('mousedown', function(e){ var s=window._fgWirkFoto; drag={sx:e.clientX,sy:e.clientY,ox:s.x,oy:s.y}; moved=false; box.style.cursor='grabbing'; e.preventDefault(); });
  document.addEventListener('mousemove', function(e){ if(!drag) return; var s=window._fgWirkFoto; s.x=drag.ox+(e.clientX-drag.sx); s.y=drag.oy+(e.clientY-drag.sy); if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)>3) moved=true; fgWirkFotoApply(); });
  document.addEventListener('mouseup', function(){ if(drag){ drag=null; box.style.cursor='grab'; } });
  box.addEventListener('dblclick', function(){ if(typeof fgEtikettZoom==='function') fgEtikettZoom(window._fgWirkFoto.idx); });
}
/* Fotos vor dem Upload proportional verkleinern; Originaldaten erst nach erfolgreicher Verarbeitung ersetzen. */
var FE_FOTO_KANTE = 1600;      /* lange Kante in Pixeln */
var FE_FOTO_QUALI = 0.82;      /* JPEG-Qualitaet */
function _bildVerkleinern(b64){
  return new Promise(function(fertig){
    try{
      var img=new Image();
      img.onerror=function(){ console.warn("Foto konnte zum Verkleinern nicht gelesen werden – Original wird verwendet."); fertig(b64); };
      img.onload=function(){
        try{
          var w=img.naturalWidth, h=img.naturalHeight;
          if(!w || !h){ fertig(b64); return; }
          var f=Math.min(1, FE_FOTO_KANTE/Math.max(w,h));
          if(f>=1){ fertig(b64); return; }          /* schon klein genug: nicht anfassen */
          var c=document.createElement("canvas");
          c.width=Math.round(w*f); c.height=Math.round(h*f);
          var ctx=c.getContext("2d");
          ctx.imageSmoothingQuality="high";
          ctx.drawImage(img,0,0,c.width,c.height);
          var neu=c.toDataURL("image/jpeg", FE_FOTO_QUALI);
          /* Sicherung gegen den Fall, dass die Umwandlung groesser wird als das
             Original (kommt bei kleinen PNG-Screenshots vor). */
          fertig((neu && neu.length < b64.length) ? neu : b64);
        }catch(e){ console.warn("Verkleinern fehlgeschlagen, Original wird verwendet:", e); fertig(b64); }
      };
      img.src=b64;
    }catch(e){ console.warn("Verkleinern fehlgeschlagen, Original wird verwendet:", e); fertig(b64); }
  });
}
if(typeof window!=="undefined"){ window._bildVerkleinern=_bildVerkleinern; }
async function fgEtikettAddUpload(files){
  var list=files?Array.prototype.slice.call(files):[]; if(!list.length) return;
  if(!window._fgEdit) window._fgEdit={};
  if(!Array.isArray(window._fgEdit.etikett)) window._fgEdit.etikett=[];
  var _vorher=0, _nachher=0;
  for(var i=0;i<list.length;i++){
    try{
      var b64=await _fileZuBase64(list[i]);
      if(!/^data:image\//.test(b64)) continue;
      _vorher += b64.length;
      var klein=await _bildVerkleinern(b64);
      _nachher += klein.length;
      window._fgEdit.etikett.push(klein);
    }catch(e){ console.error("Foto konnte nicht angehängt werden:", e); }
  }
  if(_vorher>0){
    var mbV=(_vorher/1048576).toFixed(1), mbN=(_nachher/1048576).toFixed(1);
    if(_nachher < _vorher*0.95){
      try{ fgEtikettMeldung(""); }catch(e){}
      console.info("Etikettfotos verkleinert: "+mbV+" MB → "+mbN+" MB (lange Kante "+FE_FOTO_KANTE+" px)");
    }
  }
  try{ fgEtikettRender(); }catch(e){}
}
function fgEtikettMeldung(txt){
  var cnt=document.getElementById('fe_etikettCount'); if(!cnt) return;
  var _old=document.querySelectorAll('.fgEtikErr');
  for(var _i=0;_i<_old.length;_i++) _old[_i].remove();
  if(!txt) return;
  cnt.insertAdjacentHTML('afterend',
    '<span class="fgEtikErr" style="color:var(--k-dc2626);font-weight:600;text-transform:none;letter-spacing:0"> · '+esc(txt)+'</span>');
}
async function fgEtikettDel(idx){
  var arr=(window._fgEdit&&window._fgEdit.etikett)||[]; if(idx<0||idx>=arr.length) return;
  var foto=arr[idx];
  var gel=(window._fgEdit&&window._fgEdit.etikettGeladen)||[];
  var pid=(window._fgEdit&&window._fgEdit.id)||null;
  if(gel.indexOf(foto)>=0){                       /* kam aus der Datenbank */
    if(!pid){ fgEtikettMeldung('nicht entfernt – keine Produkt-ID'); return; }
    try{
      var _r=await client.rpc("cb_produkt_etikettfoto_entfernen",{p_id:pid, p_foto:foto});
      if(_r&&_r.error) throw _r.error;
      var _d=_r&&_r.data;
      if(!_d||_d.ok!==true){ fgEtikettMeldung('nicht entfernt – in der Datenbank nicht gefunden'); return; }
    }catch(e){ fgEtikettMeldung('nicht entfernt: '+((e&&e.message)||e)); return; }
    var _gi=gel.indexOf(foto); if(_gi>=0) gel.splice(_gi,1);
  }
  arr.splice(idx,1);
  fgEtikettMeldung('');
  try{ fgEtikettRender(); }catch(e){}
}
function fgEtikettAnalyse(idx){
  var arr=(window._fgEdit&&window._fgEdit.etikett)||[]; var src=arr[idx]; if(!src) return;
  if(typeof fgSrcToggle==='function'){ /* falls Foto-Bereich zu ist, egal */ }
  if(typeof fgPullEtikett==='function') fgPullEtikett(null,[src]);
}
function fgEtikettCtxHide(){ var m=document.getElementById('fgEtikettCtxMenu'); if(m) m.remove(); document.removeEventListener('click',fgEtikettCtxHide); }
function fgEtikettCtx(ev, idx){
  ev.preventDefault(); ev.stopPropagation();
  fgEtikettCtxHide();
  var m=document.createElement('div'); m.id='fgEtikettCtxMenu';
  m.style.cssText='position:fixed;z-index:10000;background:#fff;border:1px solid #d3dbe6;border-radius:10px;padding:5px;min-width:220px;box-shadow:0 14px 38px rgba(20,40,70,.18)';
  var it=function(txt,fn,danger){ return '<button onclick="fgEtikettCtxHide();'+fn+'" style="display:block;width:100%;text-align:left;background:none;border:0;color:'+(danger?'#cf5442':'#1f2a44')+';padding:8px 11px;border-radius:7px;font-size:13px;cursor:pointer">'+txt+'</button>'; };
  m.innerHTML = it('🔍 Vergrößern','fgEtikettZoom('+idx+')')
    + it('🤖 Riki: dieses Bild auslesen','fgEtikettAnalyse('+idx+')')
    + '<div style="height:1px;background:#e2e8ef;margin:4px 6px"></div>'
    + it('🗑 Entfernen','fgEtikettDel('+idx+')', true);
  document.body.appendChild(m);
  var w=m.offsetWidth,h=m.offsetHeight;
  m.style.left=Math.min(ev.clientX, innerWidth-w-6)+'px'; m.style.top=Math.min(ev.clientY, innerHeight-h-6)+'px';
  setTimeout(function(){ document.addEventListener('click', fgEtikettCtxHide); },0);
}
async function fgImgUpload(inpEl){
  const f=inpEl.files&&inpEl.files[0]; if(!f) return;
  const msg=document.getElementById("fe_bildMsg"); msg.style.color="var(--k-374151)"; msg.textContent="⏳ lade hoch…";
  try{
    const dataUrl=await new Promise(function(ok,fail){
      var r=new FileReader();
      r.onload=function(){ ok(String(r.result||"")); };
      r.onerror=function(){ fail(new Error("Datei konnte nicht gelesen werden.")); };
      r.readAsDataURL(f);
    });
    if(/^data:image\//i.test(dataUrl)){
      msg.textContent="";
      try{ inpEl.value=""; }catch(_){}   /* dieselbe Datei soll erneut waehlbar sein */
      bildEditorOeffnen(dataUrl, function(fertig){ fgProduktbildHochladen(fertig, null); });
      return;
    }
  }catch(e){
    msg.style.color="var(--k-b45309)";
    msg.textContent="Bearbeiten nicht möglich ("+((e&&e.message)||e)+") – lade unbearbeitet hoch…";
  }
  const ext=(f.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path="p/"+Date.now()+"_"+Math.random().toString(36).slice(2,8)+"."+ext;
  const up=await client.storage.from("produktbilder").upload(path,f,{upsert:true,contentType:f.type||"image/jpeg"});
  if(up.error){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+up.error.message; return; }
  const pub=client.storage.from("produktbilder").getPublicUrl(path);
  const url=pub.data.publicUrl;
  window._fgEdit.bild_url=url;
  document.getElementById("fe_bildPreview").innerHTML=`<img src="${esc(url)}" style="max-height:120px;border-radius:8px">`;
  msg.style.color="var(--k-16a34a)"; msg.textContent="✓ Bild hochgeladen";
  try{ if(typeof fgWirkFotoRender==='function') fgWirkFotoRender(); }catch(e){}    
}
/* Bild vor dem Upload bearbeiten; beide Bildwege verwenden denselben Editor.
   Vorschau und Ausgabe müssen übereinstimmen; Ausschnitt durch Zoomen und Verschieben, nicht durch Griff-Logik.
   Keine Bildbearbeitung versprechen, die der Editor nicht ausführt. */
var BE={ src:null, img:null, zoom:1, x:0, y:0, winkel:0, hell:100, kontrast:100, tiefen:0,
         zieht:false, zx:0, zy:0, nachher:null };
function beOffen(){ return !!document.getElementById('beOverlay'); }
function bildEditorOeffnen(src, nachher){
  if(!src){ return; }
  BE={ src:src, img:null, zoom:1, x:0, y:0, winkel:0, hell:100, kontrast:100, tiefen:0,
       zieht:false, zx:0, zy:0, nachher:(typeof nachher==='function')?nachher:null };
  var o=document.createElement('div');
  o.id='beOverlay';
  o.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(15,22,30,.72);'
    +'display:flex;align-items:center;justify-content:center;padding:16px';
  o.innerHTML=
     '<div style="background:#fff;border-radius:14px;max-width:min(760px,96vw);width:100%;max-height:94vh;overflow:auto;padding:14px 16px 16px">'
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
    +  '<b style="flex:1;font-size:15px;color:#1f2a44">Bild zuschneiden und aufhellen</b>'
    +  '<button onclick="bildEditorSchliessen()" aria-label="Abbrechen" style="border:0;background:none;font-size:22px;line-height:1;color:#7b8698;cursor:pointer;padding:0 4px">&times;</button>'
    +'</div>'
    /* Vorschau quadratisch halten; sie muss denselben Ausschnitt wie die 1024×1024-Ausgabe zeigen. */
    +'<div id="beBuehne" style="position:relative;width:min(100%,52vh);aspect-ratio:1/1;margin:0 auto;background:#eef1f4;'
    +  'border:1px solid #d3dbe6;border-radius:10px;overflow:hidden;touch-action:none;cursor:grab">'
    +  '<canvas id="beCanvas" style="position:absolute;inset:0;width:100%;height:100%"></canvas>'
    +'</div>'
    +'<div style="font-size:11.5px;color:#7b8698;margin:6px 2px 10px">Ziehen verschiebt · Mausrad zoomt · der sichtbare Ausschnitt wird übernommen.</div>'
    +beRegler('Zoom','zoom',100,400,100,'%')
    +beRegler('Geraderichten','winkel',-15,15,0,'°')
    +beRegler('Helligkeit','hell',60,160,100,'%')
    +beRegler('Kontrast','kontrast',60,160,100,'%')
    /* Der Name sagt, was passiert. "Schatten entfernen" waere gelogen. */
    +beRegler('Tiefen aufhellen','tiefen',0,80,0,'')
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 12px">'
    +  '<button onclick="beDrehen(-90)" style="border:1px solid #d3dbe6;background:#fff;border-radius:8px;padding:6px 11px;font-size:12.5px;cursor:pointer">↺ 90°</button>'
    +  '<button onclick="beDrehen(90)" style="border:1px solid #d3dbe6;background:#fff;border-radius:8px;padding:6px 11px;font-size:12.5px;cursor:pointer">↻ 90°</button>'
    +  '<button onclick="beZuruecksetzen()" style="border:1px solid #d3dbe6;background:#fff;border-radius:8px;padding:6px 11px;font-size:12.5px;cursor:pointer">Zurücksetzen</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;justify-content:flex-end">'
    +  '<button onclick="bildEditorSchliessen()" style="border:1px solid #d3dbe6;background:#fff;border-radius:9px;padding:9px 14px;font-size:13.5px;cursor:pointer">Abbrechen</button>'
    +  '<button id="beOk" onclick="beUebernehmen()" style="border:0;background:#16a34a;color:#fff;border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer">Übernehmen</button>'
    +'</div>'
    +'<div id="beMsg" style="font-size:12px;color:#7b8698;margin-top:8px;min-height:16px"></div>'
    +'</div>';
  document.body.appendChild(o);
  var im=new Image();
  im.onload=function(){ BE.img=im; beAnpassen(); beZeichnen(); };
  im.onerror=function(){ var m=document.getElementById('beMsg'); if(m){ m.style.color='#cf5442'; m.textContent='Das Bild konnte nicht geladen werden.'; } };
  im.src=src;
  beBinden();
}
function beRegler(titel,feld,min,max,wert,einheit){
  return '<div style="display:flex;align-items:center;gap:10px;margin:5px 0">'
    +'<span style="width:132px;flex:0 0 auto;font-size:12.5px;color:#4a5768">'+titel+'</span>'
    +'<input type="range" min="'+min+'" max="'+max+'" value="'+wert+'" id="be_'+feld+'" '
    +'oninput="beRegelt(\''+feld+'\',this.value)" style="flex:1;min-width:0">'
    +'<span id="beW_'+feld+'" style="width:52px;text-align:right;font-size:12px;color:#7b8698">'+wert+einheit+'</span>'
    +'</div>';
}
function beRegelt(feld,wert){
  var v=Number(wert);
  if(feld==='zoom') BE.zoom=v/100; else BE[feld]=v;
  var w=document.getElementById('beW_'+feld);
  if(w) w.textContent=v+({zoom:'%',winkel:'°',hell:'%',kontrast:'%',tiefen:''}[feld]||'');
  beZeichnen();
}
function beDrehen(g){ BE.winkel=(BE.winkel+g)%360; beZeichnen(); }
function beZuruecksetzen(){
  BE.zoom=1; BE.x=0; BE.y=0; BE.winkel=0; BE.hell=100; BE.kontrast=100; BE.tiefen=0;
  [['zoom',100],['winkel',0],['hell',100],['kontrast',100],['tiefen',0]].forEach(function(p){
    var el=document.getElementById('be_'+p[0]); if(el) el.value=p[1];
    var w=document.getElementById('beW_'+p[0]);
    if(w) w.textContent=p[1]+({zoom:'%',winkel:'°',hell:'%',kontrast:'%',tiefen:''}[p[0]]||'');
  });
  beAnpassen(); beZeichnen();
}
/* Startzoom so, dass das Bild die Buehne fuellt - sonst sieht der Nutzer beim
   Oeffnen graue Raender und haelt das fuer den Ausschnitt. */
function beAnpassen(){
  if(!BE.img) return;
  BE.zoom=1; BE.x=0; BE.y=0;
  var z=document.getElementById('be_zoom'); if(z) z.value=100;
  var w=document.getElementById('beW_zoom'); if(w) w.textContent='100%';
}
function beZeichnen(){
  var c=document.getElementById('beCanvas'); if(!c||!BE.img) return;
  var b=c.parentNode.getBoundingClientRect();
  var S=Math.max(80,Math.round(Math.min(b.width,b.height)));
  if(c.width!==S){ c.width=S; c.height=S; }
  var ctx=c.getContext('2d');
  ctx.save();
  ctx.clearRect(0,0,S,S);
  ctx.filter='brightness('+BE.hell+'%) contrast('+BE.kontrast+'%)';
  ctx.translate(S/2+BE.x, S/2+BE.y);
  ctx.rotate(BE.winkel*Math.PI/180);
  /* "cover": die kurze Seite fuellt die Buehne, nichts wird verzerrt. */
  var deck=Math.max(S/BE.img.width, S/BE.img.height)*BE.zoom;
  var w=BE.img.width*deck, h=BE.img.height*deck;
  ctx.drawImage(BE.img,-w/2,-h/2,w,h);
  ctx.restore();
  if(BE.tiefen>0) beTiefen(ctx,S);
}
/* 🔴 TIEFEN AUFHELLEN, nicht Schatten entfernen. Dunkle Bildbereiche werden ueber
   eine Gammakurve angehoben, helle bleiben, wo sie sind. Damit verliert ein
   Schatten seine Haerte - er verschwindet NICHT, und ein Daumen im Bild bleibt
   ein Daumen im Bild. Wer mehr will, braucht einen Freisteller-Dienst. */
function beTiefen(ctx,S){
  try{
    var d=ctx.getImageData(0,0,S,S), p=d.data;
    var staerke=BE.tiefen/100;                 // 0 .. 0,8
    var lut=new Uint8Array(256);
    for(var i=0;i<256;i++){
      var v=i/255;
      var gamma=1-staerke*0.7;                 // 1,0 .. ~0,44
      var neu=Math.pow(v,gamma);
      /* Nur die Tiefen anheben: der Effekt laeuft bei hellen Werten aus. */
      var mix=1-v;
      lut[i]=Math.max(0,Math.min(255,Math.round(255*(v+(neu-v)*mix))));
    }
    for(var k=0;k<p.length;k+=4){ p[k]=lut[p[k]]; p[k+1]=lut[p[k+1]]; p[k+2]=lut[p[k+2]]; }
    ctx.putImageData(d,0,0);
  }catch(e){ /* getImageData kann bei fremder Herkunft scheitern - dann bleibt das Bild wie es ist */ }
}
function beBinden(){
  var b=document.getElementById('beBuehne'); if(!b) return;
  b.addEventListener('pointerdown',function(e){ BE.zieht=true; BE.zx=e.clientX-BE.x; BE.zy=e.clientY-BE.y;
    b.style.cursor='grabbing'; try{ b.setPointerCapture(e.pointerId); }catch(_){} });
  b.addEventListener('pointermove',function(e){ if(!BE.zieht) return; BE.x=e.clientX-BE.zx; BE.y=e.clientY-BE.zy; beZeichnen(); });
  b.addEventListener('pointerup',function(){ BE.zieht=false; b.style.cursor='grab'; });
  b.addEventListener('pointercancel',function(){ BE.zieht=false; b.style.cursor='grab'; });
  b.addEventListener('wheel',function(e){ e.preventDefault();
    var n=Math.max(1,Math.min(4,BE.zoom*(e.deltaY<0?1.1:0.9)));
    BE.zoom=n; var z=document.getElementById('be_zoom'); if(z) z.value=Math.round(n*100);
    var w=document.getElementById('beW_zoom'); if(w) w.textContent=Math.round(n*100)+'%';
    beZeichnen(); },{passive:false});
}
function bildEditorSchliessen(){ var o=document.getElementById('beOverlay'); if(o) o.remove(); }
/* Uebernehmen rendert den SICHTBAREN Ausschnitt in voller Kantenlaenge neu - die
   Buehne ist nur die Vorschau. Sonst haenge die Qualitaet des Produktbilds an der
   Fenstergroesse, was niemand erwartet. */
function beUebernehmen(){
  if(!BE.img){ return; }
  var ok=document.getElementById('beOk'); if(ok) ok.disabled=true;
  try{
    var Z=1024;
    var c=document.createElement('canvas'); c.width=Z; c.height=Z;
    var ctx=c.getContext('2d');
    var b=document.getElementById('beBuehne');
    var S=b?Math.max(80,Math.round(Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height))):Z;
    var f=Z/S;                                  // Vorschau -> Ausgabe
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,Z,Z);
    ctx.save();
    ctx.filter='brightness('+BE.hell+'%) contrast('+BE.kontrast+'%)';
    ctx.translate(Z/2+BE.x*f, Z/2+BE.y*f);
    ctx.rotate(BE.winkel*Math.PI/180);
    var deck=Math.max(Z/BE.img.width, Z/BE.img.height)*BE.zoom;
    var w=BE.img.width*deck, h=BE.img.height*deck;
    ctx.drawImage(BE.img,-w/2,-h/2,w,h);
    ctx.restore();
    if(BE.tiefen>0) beTiefen(ctx,Z);
    var out=c.toDataURL('image/jpeg',0.9);
    var weiter=BE.nachher;
    bildEditorSchliessen();
    if(weiter) weiter(out);
  }catch(e){
    var m=document.getElementById('beMsg'); if(m){ m.style.color='#cf5442'; m.textContent='Konnte nicht übernommen werden: '+((e&&e.message)||e); }
    if(ok) ok.disabled=false;
  }
}
/* ============================================================================
   WORK #129 — ETIKETTFOTO ALS PRODUKTBILD (Ralph-Auftrag 19.08.2026)

   §22: der Upload-Weg existiert schon. fgImgUpload direkt darueber laedt in den
   Bucket produktbilder, holt die oeffentliche URL und setzt _fgEdit.bild_url.
   Diese Funktion geht denselben Weg — sie bringt nur das Bild aus einer anderen
   Quelle mit. KEIN zweiter Upload-Weg (§4.2).

   🔴 IN Bild_URL KOMMT DIE URL, NIEMALS DAS BILD SELBST. Gemessen 19.08.: alle 17
   vorhandenen Produktbilder sind URLs, im Schnitt 98 Zeichen. Ein Etikettfoto hat
   75.000 bis 172.000 Zeichen — und cb_produkte_suchen liefert Bild_URL als Spalte
   "bild" in JEDER Trefferliste. Ein eingebettetes Bild wuerde die Produktsuche um
   das Tausendfache aufblaehen.

   NACHGEZOGEN 19.08.: Zuschneiden und Bildkorrektur SIND seit B2/B3 dabei (Ralph-Go
   "klingt gut"). Der Knopf oeffnet erst bildEditorOeffnen und laedt danach ueber
   fgProduktbildHochladen hoch - Bearbeitung VOR dem Hochladen. Der Satz "noch nicht
   Teil dieser Stufe" stand hier bis 4020 und war ab 4030 falsch; ein Kommentar, der
   nicht mehr stimmt, ist eine Luege im Code.
   ============================================================================ */
async function fgEtikettAlsProduktbild(btn){
  var msg=document.getElementById("fe_bildMsg");
  var sag=function(t,f){ if(msg){ msg.style.color=f||"var(--k-374151)"; msg.textContent=t; } };
  try{
    var arr=(typeof fgWirkFotoArr==='function')?fgWirkFotoArr():[];
    var idx=(window._fgWirkFoto&&window._fgWirkFoto.idx)||0;
    var src=arr[idx];
    if(!src){ sag("Kein Bild angezeigt, das übernommen werden könnte.","var(--k-b45309)"); return; }
    /* Ist es bereits eine hochgeladene Datei, gibt es nichts zu tun - dann waere ein
       zweiter Upload derselben Datei nur eine Dublette im Bucket. */
    if(/^https?:/i.test(src)){
      if(window._fgEdit && window._fgEdit.bild_url===src){ sag("Dieses Bild ist bereits das Produktbild.","var(--k-16a34a)"); return; }
      window._fgEdit=window._fgEdit||{}; window._fgEdit.bild_url=src;
      var vp0=document.getElementById("fe_bildPreview");
      if(vp0) vp0.innerHTML='<img src="'+esc(src)+'" style="max-height:120px;border-radius:8px">';
      sag("✓ Als Produktbild gesetzt – noch nicht gespeichert.","var(--k-16a34a)");
      return;
    }
    var m=String(src).match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if(!m){ sag("Das angezeigte Bild hat ein unbekanntes Format.","var(--k-dc2626)"); return; }
    sag("");
    bildEditorOeffnen(src, function(fertig){ fgProduktbildHochladen(fertig, btn); });
    return;
  }catch(e){
    sag("Konnte nicht geöffnet werden: "+((e&&e.message)||e),"var(--k-dc2626)");
    return;
  }
}
async function fgProduktbildHochladen(dataUrl, btn){
  var msg=document.getElementById("fe_bildMsg");
  var sag=function(t,f){ if(msg){ msg.style.color=f||"var(--k-374151)"; msg.textContent=t; } };
  try{
    var m=String(dataUrl||"").match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
    if(!m){ sag("Das bearbeitete Bild hat ein unbekanntes Format.","var(--k-dc2626)"); return; }
    if(btn){ btn.disabled=true; }
    sag("⏳ lade hoch…");
    var src=dataUrl;
    /* data:-URL in eine echte Datei wandeln. fetch auf eine data:-URL ist der kurze
       Weg dorthin und braucht kein Netz. */
    var blob=await (await fetch(src)).blob();
    var ext=(m[1].split("/")[1]||"jpg").replace(/[^a-z0-9]/g,"")||"jpg";
    if(ext==="jpeg") ext="jpg";
    var path="p/"+Date.now()+"_"+Math.random().toString(36).slice(2,8)+"."+ext;
    var up=await client.storage.from("produktbilder").upload(path,blob,{upsert:true,contentType:m[1]});
    if(up.error){ sag("Fehler beim Hochladen: "+up.error.message,"var(--k-dc2626)"); return; }
    var url=client.storage.from("produktbilder").getPublicUrl(path).data.publicUrl;
    window._fgEdit=window._fgEdit||{}; window._fgEdit.bild_url=url;
    var vp=document.getElementById("fe_bildPreview");
    if(vp) vp.innerHTML='<img src="'+esc(url)+'" style="max-height:120px;border-radius:8px">';
    /* 🔴 "noch nicht gespeichert" gehoert in die Meldung. bild_url steht bis zum
       Speichern nur im Browser; wer den Editor jetzt schliesst, verliert es. Ohne
       diesen Halbsatz sieht es aus wie erledigt (§1.7). */
    sag("✓ Als Produktbild übernommen – noch nicht gespeichert.","var(--k-16a34a)");
    try{ if(typeof fgWirkFotoRender==='function') fgWirkFotoRender(); }catch(e){}
  }catch(e){
    sag("Konnte nicht übernommen werden: "+((e&&e.message)||e),"var(--k-dc2626)");
  }finally{
    if(btn){ btn.disabled=false; }
  }
}
/* Live-Index im Editor als Fluxkompensator (etwas dickere Balken als in der Produktliste).
   Liest die Achsen aus dem Vorschau-Objekt der DB (cb_score_vorschau), nicht selbst gerechnet -
   damit hier exakt derselbe Score steht wie spaeter im Produkt. */
function feFluxWidget(v){
  if(!v) return '';
  var s=(v.clean_score!=null&&isFinite(v.clean_score))?Number(v.clean_score):null;
  var A=[
    {v:(v.p_zutaten!=null?Number(v.p_zutaten):null),          max:30, f:"#16a34a"},
    {v:(v.p_zusatzstoffe!=null?Number(v.p_zusatzstoffe):null), max:15, f:"#3987e5"},
    {v:(v.p_nova!=null?Number(v.p_nova):null),                max:15, f:"#7c6fe0"},
    {v:(v.p_naehrwert!=null?Number(v.p_naehrwert)*2:null),    max:40, f:"#d97706"}
  ].map(function(a){ a.pct=(a.v==null)?null:Math.max(0,Math.min(1,a.v/a.max)); return a; });
  var uid="fef"+(Math.random().toString(36).slice(2,7)), L=92;
  /* gleiche Ring-Fix-Geometrie wie pkFlux: Balken enden knapp ausserhalb der Ringkante (r42). */
  var bahn=["M26 34 H74 L106 64","M274 34 H226 L194 64","M26 142 H74 L106 112","M274 142 H226 L194 112"];
  var kap=[[26,34],[274,34],[26,142],[274,142]];
  var fCol=(typeof farbe==="function")?farbe(v.bewertung):"#9aa7a0";
  var core=(s==null)?"–":String(Math.round(s));
  var svg='<svg viewBox="0 0 300 176" style="width:100%;display:block" role="img" aria-label="Index '+core+', vier Achsen">'
    +'<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">'
    + bahn.map(function(dd){ return '<path d="'+dd+'" stroke="rgba(120,120,120,.16)"/>'; }).join('')
    + A.map(function(a,i){ var off=(a.pct==null)?L:L*(1-a.pct);
        return '<path d="'+bahn[i]+'" stroke="'+(a.pct==null?"rgba(120,120,120,.28)":a.f)+'" stroke-dasharray="'+L+'" stroke-dashoffset="'+L+'" style="transition:stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)" data-ziel="'+off.toFixed(1)+'" class="'+uid+'-b"/>'; }).join('')
    +'</g>'
    + A.map(function(a,i){ return '<circle cx="'+kap[i][0]+'" cy="'+kap[i][1]+'" r="7" fill="'+(a.pct==null?"#9aa7a0":a.f)+'"/>'; }).join('')
    +'<circle cx="150" cy="88" r="42" fill="none" stroke="'+(s==null?"#9aa7a0":fCol)+'" stroke-width="5"/>'
    +'<text x="150" y="101" text-anchor="middle" style="font-size:42px;font-weight:800" fill="var(--ink)">'+core+'</text>'
    +'</svg>';
  setTimeout(function(){ document.querySelectorAll("."+uid+"-b").forEach(function(el){ el.style.strokeDashoffset=el.getAttribute("data-ziel"); }); }, 60);
  return svg;
}
var RI_GRUEN="var(--ri-gruen,#4d7c3a)", RI_GELB="var(--ri-gelb,#e8920c)",
    RI_GRAU ="var(--ri-grau,#c9c4bb)",  RI_TRACK="var(--ri-track,#f0ece3)";
/* Supplement-Donut „Wirkstoffe in wirksamer Menge" (X von Y) – dieselbe Anzeige wie in der
   Produktansicht (suppKarteFill). Supplements bekommen KEINEN Lebensmittel-Index; im Editor
   steht deshalb dieser Donut statt des Flux-Rings. Daten: a.bilanz aus cb_supplement_karte. */
function feSuppBilanzDonut(bil){
  var g=Number(bil.gesamt)||0, wk=Number(bil.wirksam)||0, zg=Number(bil.zu_gering)||0, kr=Number(bil.kein_ref)||0;
  if(g<=0) return "";
  var CX=60,CY=60,RO=52,RI=41,GAP=(g>1?6:0),SEG=360/g,ring="";
  ring='<circle cx="60" cy="60" r="46.5" fill="none" stroke="'+RI_TRACK+'" stroke-width="11"/>';
  if(g===1){
    var c1=(wk>0)?RI_GRUEN:((zg>0)?RI_GELB:RI_GRAU);
    ring+='<circle cx="60" cy="60" r="46.5" fill="none" stroke="'+c1+'" stroke-width="11"/>';
  } else {
    for(var i=0;i<g;i++){
      var col=(i<wk)?RI_GRUEN:((i<wk+zg)?RI_GELB:RI_GRAU);
      var a0=(-90+i*SEG+GAP/2)*Math.PI/180, a1=(-90+(i+1)*SEG-GAP/2)*Math.PI/180, lg=(SEG-GAP)>180?1:0;
      ring+='<path d="M'+(CX+RO*Math.cos(a0)).toFixed(2)+' '+(CY+RO*Math.sin(a0)).toFixed(2)
        +' A'+RO+' '+RO+' 0 '+lg+' 1 '+(CX+RO*Math.cos(a1)).toFixed(2)+' '+(CY+RO*Math.sin(a1)).toFixed(2)
        +' L'+(CX+RI*Math.cos(a1)).toFixed(2)+' '+(CY+RI*Math.sin(a1)).toFixed(2)
        +' A'+RI+' '+RI+' 0 '+lg+' 0 '+(CX+RI*Math.cos(a0)).toFixed(2)+' '+(CY+RI*Math.sin(a0)).toFixed(2)
        +' Z" fill="'+col+'"/>';
    }
  }
  var xtra=""; if(zg>0) xtra+='<br><span style="color:'+RI_GELB+'">■</span> '+zg+' zu gering dosiert';
  if(kr>0) xtra+='<br><span style="color:'+RI_GRAU+'">■</span> '+kr+' ohne offiziellen Referenzwert';
  return '<div style="display:flex;align-items:center;gap:15px">'
    +'<div style="position:relative;width:104px;height:104px;flex:0 0 auto">'
      +'<svg viewBox="0 0 120 120" style="width:100%;height:100%;display:block">'+ring+'</svg>'
      +'<div style="position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center">'
        +'<div style="font-size:27px;font-weight:800;line-height:1;color:var(--ink)">'+wk+'</div>'
        +'<div style="font-size:11px;color:var(--muted);margin-top:1px">von '+g+'</div>'
      +'</div>'
    +'</div>'
    +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:13px;font-weight:700;color:var(--ink);line-height:1.3;margin-bottom:6px">Wirkstoffe in wirksamer Menge</div>'
      +'<div style="font-size:11px;color:var(--muted);line-height:1.6"><span style="color:'+RI_GRUEN+'">■</span> '+wk+' mit belegtem EU-Nutzen (≥ 15 % Tagesbedarf)'+xtra+'</div>'
    +'</div>'
  +'</div>';
}
var _feScoreSeq=0, _feScoreTimer=null;
function feScorePreview(){
  var box=document.getElementById("fe_index"); if(!box) return;
  if(_feScoreTimer){ clearTimeout(_feScoreTimer); }
  _feScoreTimer=setTimeout(function(){ _feScoreRun(box); }, 450);
}
async function _feScoreRun(box){
  var g=function(id){ return document.getElementById(id); };
  var numv=function(v){ v=(v==null?"":String(v)).trim(); return v===""?undefined:Number(v.replace(",",".")); };
  var name=((g("fe_name")||{}).value||"").trim();
  if(!name){ box.innerHTML='<div style="color:var(--muted);font-size:12.5px">Titel eintragen, dann rechnet der Index.</div>'; return; }
  var _kat=((g("fe_kat")||{}).value||"").trim().toLowerCase();
  if(_kat==='supplement'){
    var _sid=(window._fgEdit&&window._fgEdit.id)?window._fgEdit.id:null;
    if(!_sid){ box.innerHTML='<div style="color:var(--muted);font-size:12.5px;line-height:1.5">Supplement – kein Lebensmittel-Index. Die Anzeige „Wirkstoffe in wirksamer Menge" erscheint, sobald das Produkt mit seinen Wirkstoffen gespeichert ist.</div>'; return; }
    var seqS=(++_feScoreSeq);
    box.innerHTML='<div style="color:var(--muted);font-size:12.5px">⏳ Wirkstoffe werden geprüft…</div>';
    /* Work #575: den Reinheits-Index derselben Gelegenheit mitnehmen. Er kommt
       aus cb_supplement_index - der einzigen Stelle, die ihn rechnet. Hier wird
       nichts gerechnet, nur geholt und abgelegt; das Kopfband zeigt ihn dann.
       Faellt die RPC aus, bleibt _fgSuppIndex leer und der Kopf zeigt wieder
       "Dosis-Check". Kein Grund, deshalb die Wirkstoffkarte zu verlieren. */
    try{
      var ri=await client.rpc("cb_supplement_index",{p_id:_sid});
      var rid=ri&&ri.data; if(Array.isArray(rid)) rid=rid[0];
      if(rid && rid.gilt===true && rid.index!=null){
        window._fgSuppIndex={produkt_id:_sid, index:rid.index, achsen:rid.achsen||null,
                             regelversion:rid.regelversion||null};
      } else { window._fgSuppIndex=null; }
    }catch(e){ window._fgSuppIndex=null; console.warn("[Supp] Reinheits-Index:", e); }
    try{ feKopfIndex(); }catch(e){}
    try{
      var rk=await client.rpc("cb_supplement_karte",{p_produkt_id:_sid});
      if(seqS!==_feScoreSeq) return;
      var ak=rk.data; if(Array.isArray(ak)) ak=ak[0];
      var bil=ak&&ak.bilanz;
      if(bil && Number(bil.gesamt)>0){
        box.innerHTML='<div>'+feSuppBilanzDonut(bil)+'</div>'
          +'<div style="font-size:11px;color:var(--muted);line-height:1.5;margin-top:9px;padding-top:8px;border-top:1px solid var(--line)">Supplement – <b>kein Lebensmittel-Index</b>. Der volle <b>Dosis-Check</b> (EFSA-Grenzwerte) steht in der Produktansicht.</div>';
      } else {
        box.innerHTML='<div style="color:var(--muted);font-size:12.5px;line-height:1.5">Supplement – kein Lebensmittel-Index. Für „Wirkstoffe in wirksamer Menge" fehlen noch Wirkstoffe mit Menge (nach dem Speichern sichtbar).</div>';
      }
    }catch(e){ if(seqS===_feScoreSeq) box.innerHTML='<div style="color:var(--muted);font-size:12.5px">Supplement – kein Lebensmittel-Index.</div>'; }
    return;
  }
  var _sg=window._fgScoreGespeichert;
  var _pid=(window._fgEdit&&window._fgEdit.id)||null;
  if(_pid && _sg && _sg.produkt_id===_pid){
    var _cs=_sg.clean_score;
    if(_cs==null){
      box.innerHTML='<div style="color:var(--muted);font-size:12.5px;line-height:1.5">Gespeicherter Stand: <b>kein Index</b>'
        +(_sg.vollstaendig?'':' – der Server führt den Score als nicht vollständig')
        +'.<div style="margin-top:6px">Nach dem Speichern rechnet der Server neu und dieser Kasten zieht mit.</div></div>';
    } else {
      var _f=(typeof farbe==="function")?farbe(_sg.bewertung):"var(--ink)";
      var _A=[["zutaten","Zutaten",30],["zusatzstoffe","Zusatzstoffe",15],
              ["nova","NOVA",15],["naehrwert","Nährwerte",40]];
      var _achsHtml=_A.map(function(a){
        var _ac=_sg.achsen||{}, _na=Array.isArray(_sg.achsen_na)?_sg.achsen_na:[],
            _fh=Array.isArray(_sg.achsen_fehlend)?_sg.achsen_fehlend:[];
        var v=_ac[a[0]], na=(_na.indexOf(a[0])>=0), fehlt=(_fh.indexOf(a[0])>=0);
        var txt, col;
        if(na){ txt="nicht anwendbar"; col="var(--muted)"; }
        else if(v==null||fehlt){ txt=fehlt?"fehlt":"nicht belegt"; col="var(--k-cf5442,#cf5442)"; }
        else { txt=String(v).replace(".",",")+"/"+a[2]; col="var(--ink)"; }
        return '<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0">'
          +'<span style="color:var(--muted)">'+esc(a[1])+'</span>'
          +'<span style="font-weight:700;color:'+col+'">'+esc(txt)+'</span></div>';
      }).join("");
      box.innerHTML='<div style="text-align:center;padding:6px 0">'
        +'<div style="font-size:44px;font-weight:800;line-height:1;color:'+_f+'">'+esc(String(Math.round(_cs)))+'</div>'
        +'<div style="font-size:13px;font-weight:700;color:'+_f+';margin-top:3px">'+esc(_sg.bewertung||"")+'</div>'
        +'</div>'
        +'<div style="font-size:11.5px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">'+_achsHtml+'</div>'
        +'<details style="margin-top:8px;padding-top:6px;border-top:1px solid var(--line)">'
        +'<summary style="cursor:pointer;font-size:10.5px;color:var(--muted)">Gespeicherter Score · Details</summary>'
        +'<div style="font-size:11px;color:var(--muted);line-height:1.5;margin-top:5px">'
        +'Gelesen aus <code>cb_score_achsen_status</code> über <code>cb_produkt_edit_get</code> – keine Simulation. '
        +'Nach dem Speichern rechnet der Server neu und dieser Kasten zieht mit.</div></details>';
    }
    return;
  }
  var nw={}; ["kcal","protein","kh","zucker","polyole","fett","ges_fett","ballaststoffe","salz"].forEach(function(k){ var v=numv((g("fe_"+k)||{}).value); if(v!==undefined&&!isNaN(v)) nw[k]=v; });
  var zut=[].slice.call(document.querySelectorAll("#fe_zutRows .fgZutRow")).map(function(row){
    var nm=((row.querySelector(".fgzName")||{}).value||"").trim();
    var roh=((row.querySelector(".fgzRate")||{}).value||"").trim();
    var rt=(roh==="")?null:Number(roh);
    return { name:nm, rating:(rt===null||isNaN(rt))?null:rt, kritisch:(row.querySelector(".fgzKrit")||{}).checked?"ja":"nein" };
  }).filter(function(z){ return z.name; });
  var payload={ name:name, marke:((g("fe_marke")||{}).value||"").trim(), kategorie:((g("fe_kat")||{}).value||"").trim()||"Lebensmittel",
    basis:((g("fe_basis")||{}).value||"").trim()||"100g", naehrwerte:nw,
    zusatzstoffe_text:((g("fe_ztext")||{}).value||"").trim(),    
    zusatzstoffe_status:((g("fe_zstatus")||{}).value||null), suessstoffe:((g("fe_suess")||{}).value||"nein"), zutaten:zut };
  var seq=(++_feScoreSeq);
  box.innerHTML='<div style="color:var(--muted);font-size:12.5px">⏳ Index wird berechnet…</div>';
  try{
    var res=await client.rpc("cb_score_vorschau",{p:payload});
    if(seq!==_feScoreSeq) return; /* eine neuere Anfrage laeuft schon */
    if(res.error){ box.innerHTML='<div style="color:var(--muted);font-size:12.5px">Index nicht berechenbar.</div>'; return; }
    var v=res.data; if(Array.isArray(v)) v=v[0];
    if(!v){ box.innerHTML='<div style="color:var(--muted);font-size:12.5px">Index nicht berechenbar.</div>'; return; }
    if(window._fgEdit && window._fgEdit.id){
      window._fgScoreServer=null;
      try{ feStatusStreifen(); }catch(e){}
    } else {
    window._fgScoreServer={
      vollstaendig:(v.vollstaendig===true), status:String(v.status||""),
      achsen_na:[],
      achsen_fehlend:[["Zutaten",v.p_zutaten],["Zusatzstoffe",v.p_zusatzstoffe],
                      ["Nährwerte",v.p_naehrwert]]
        .filter(function(a){ return a[1]==null; }).map(function(a){ return a[0]; })
    };
    try{ feStatusStreifen(); }catch(e){}
    }
    var voll=(v.vollstaendig!==false && v.clean_score!=null);
    box.innerHTML='<div style="max-width:230px;margin:0 auto">'+feFluxWidget(v)+'</div>'
      +'<div style="text-align:center;font-size:12.5px;margin-top:2px;color:'+((typeof farbe==="function")?farbe(v.bewertung):"var(--muted)")+';font-weight:700">'+esc(v.bewertung||"")+'</div>'
      +(voll?'':'<div style="text-align:center;font-size:11.5px;color:var(--k-b45309);margin-top:4px">Noch kein voller Index – siehe „Fehlt für den Index" unten.</div>');
  }catch(e){ if(seq===_feScoreSeq) box.innerHTML='<div style="color:var(--muted);font-size:12.5px">Index nicht berechenbar.</div>'; }
}
/* Live-Plausibilität im Editor (Polyol-Spanne) + Freigabe-Check. */
/* Nährwert-Rechenprobe folgt dem bestehenden Serververtrag; keine zweite Formel ergänzen. */
function feNaehrBefund(){
  var gv=function(id){ var e=document.getElementById(id); var v=e&&e.value!==""?Number(String(e.value).replace(",",".")):null; return (v!=null&&isFinite(v))?v:null; };
  return feNaehrBefundAus({
    kcal:gv("fe_kcal"), p:gv("fe_protein"), kh:gv("fe_kh"), f:gv("fe_fett"),
    b:gv("fe_ballaststoffe"), poly:gv("fe_polyole"), zucker:gv("fe_zucker"), gesf:gv("fe_ges_fett")
  });
}

function fePlaus(){
  var box=document.getElementById("fe_plaus"); if(!box) return;
  var B=feNaehrBefund();
  if(B.hart){
    box.innerHTML='<span class="pRot">&#9888; '+esc(B.texte.filter(function(_,i){ return !(i===0&&B.n1); }).join(" · "))+'</span>';
    return;
  }
  if(!B.rechenbar){ box.innerHTML='<span class="pGrau">Für die Plausibilität: kcal, Eiweiß, KH, Fett.</span>'; }
  else {
    var kcal=B.berMin!=null ? (function(){ var e=document.getElementById("fe_kcal"); return e&&e.value!==""?Number(String(e.value).replace(",",".")):0; })() : 0;
    var spanne=B.spanne;
    if(B.n1){
      if(window._fgEdit && window._fgEdit.kcalOk) box.innerHTML='<span class="pWarn">&#9888; kcal ('+Math.round(kcal)+') weicht ab (rechnerisch '+spanne+') &ndash; <b>von der Quelle best&auml;tigt, W&auml;chter &uuml;bersteuert</b>. <a href="#" onclick="fgKcalOkSet(false);return false" class="pLila">r&uuml;ckg&auml;ngig</a></span>';
      else box.innerHTML='<span class="pRot">&#9888; kcal ('+Math.round(kcal)+') passt nicht &ndash; plausibel w&auml;ren '+spanne+'.</span> <button type="button" onclick="fgKcalOkSet(true)" class="pBtnLila">Quelle gepr&uuml;ft &rarr; &uuml;bersteuern</button>';
    }
    else box.innerHTML='<span class="pGruen">&#10003; Plausibel · rechnerisch '+spanne+'.</span>';
  }
  var rd=document.getElementById("fe_ready");
  if(rd){
    /* Feldgenauer Freigabe-Check: zeigt exakt, was den Score blockiert –
       gespiegelt an der DB-Regel (Nährwert-Achse braucht diese Werte, sonst kein Score).
       Kein Auto-Ausfüllen: der Admin trägt 0 oder den echten Wert selbst ein. */
    var fehlt=[];
    var gv=function(id){ var e=document.getElementById(id); var v=e&&e.value!==""?Number(String(e.value).replace(",",".")):null; return (v!=null&&isFinite(v))?v:null; };
    /* SUPPLEMENTS: keine Nährwert-Pflicht. Eine Kapsel hat kein Makro-Profil pro 100 g –
       sie bekommt bewusst keinen Lebensmittel-Score (§1.11j). Die Nährwerte hier zu
       verlangen hätte Supplements dauerhaft von der Freigabe ausgesperrt. Sie brauchen
       stattdessen Wirkstoffe/Zutaten, eine Quelle und die Verzehrempfehlung. */
    var _kat=((document.getElementById("fe_kat")||{}).value||"").trim();
    if(!_kat) fehlt.push("Kategorie");
    var _istSupp = (_kat.toLowerCase()==="supplement");
    var _istSalz = (_kat.toLowerCase()==="salze");
    var _istKeinScore = _istSupp || _istSalz || !!(window._ksKats && window._ksKats.has(_kat.toLowerCase()));
    var _nwFehltListe=[];
    var _nwPflicht=(typeof feNaehrwertPflicht==="function")?feNaehrwertPflicht():{makros_erforderlich:!_istKeinScore,art:"lebensmittel"};
    if(_nwPflicht.makros_erforderlich){
      var _bndChk=!!((document.getElementById("fe_ballast_nd")||{}).checked);
      var nwReq=[["fe_kcal","Energie"],["fe_fett","Fett"],["fe_ges_fett","ges. Fett"],["fe_kh","Kohlenhydrate"],["fe_zucker","Zucker"],["fe_protein","Eiweiß"],["fe_salz","Salz"],["fe_ballaststoffe","Ballaststoffe"]];
      nwReq.forEach(function(r){
        if(r[0]==="fe_ballaststoffe" && _bndChk) return;
        if(gv(r[0])==null){ fehlt.push(r[1]); _nwFehltListe.push(r[1]); }
      });
    }
    var zRows=[].slice.call(document.querySelectorAll("#fe_zutRows .fgZutRow"));
    var zMit=zRows.filter(function(row){ return ((row.querySelector(".fgzName")||{}).value||"").trim()!==""; });
    var zOhneNote=zMit.filter(function(row){ return ((row.querySelector(".fgzRate")||{}).value||"").trim()===""; }).length;
    if(zMit.length===0) fehlt.push(_istSupp?"mind. 1 Wirkstoff/Zutat":"mind. 1 Zutat");
    if(zOhneNote>0) fehlt.push(zOhneNote+(_istSupp?" Wirkstoff(e)/Zutat(en) ohne Bewertung":" Zutat(en) ohne Bewertung"));
    /* 🔴 22.08.2026, Work #181 Stufe 5 — DER BROWSER ZAEHLT HIER NICHT MEHR SELBST.
       WAS HIER STAND: ein reiner Textvergleich, kleingeschrieben und auf Gleichheit,
       gegen ZUTATEN_STAMM und window._fgCanon. Der kannte keine Synonyme.
       WAS DABEI HERAUSKAM (Ralphs Screenshot, Pflichtfall P32667): "White Tiger Garnelen"
       wurde oben als "1 Zutat nicht im Stamm" gezaehlt, waehrend die Zeile darunter die
       Server-Antwort zeigte: "im Stamm gefunden: Garnele · Treffer synonym · 0,95".
       Beide Aussagen waren fuer sich richtig - falsch war, dass es zwei gab.
       JETZT: die eine Wahrheit ist cb_admin_zutat_zuordnungsstatus (Work #191, verifiziert).
       Sie kennt Synonyme und liefert je Zeile genau einen von vier Zustaenden.
       ⚠ null heisst UNBEKANNT, nicht null Stueck: solange die Antwort nicht da ist, wird
       nichts behauptet. Alle Leser unten pruefen auf >0, null ist damit still. */
    var zOhneStamm=null, zKeinTreffer=null, zVorschlagOffen=null, zGebunden=null;
    try{
      var _zu=window._fgZuordnung;
      if(_zu && _zu.produkt_id===((window._fgEdit&&window._fgEdit.id)||"") && Array.isArray(_zu.zeilen)){
        var _z=function(st){ return _zu.zeilen.filter(function(x){ return x && x.status===st; }).length; };
        zGebunden       = _z("gebunden");
        zVorschlagOffen = _z("vorschlag_offen");
        zKeinTreffer    = _z("kein_treffer");
        /* ⚠ zOhneStamm heisst fuer alle Leser unten: "wird beim Speichern NICHT gebunden".
           Das ist NICHT dasselbe wie "kein Treffer". Eine Zeile mit offenem Vorschlag hat
           zwar einen Treffer, ist aber ebenso wenig gebunden - sie ginge genauso verloren.
           Wer hier nur kein_treffer zaehlt, verliert eine Warnung, die es vorher gab. */
        zOhneStamm = zVorschlagOffen + zKeinTreffer;
      }
    }catch(e){ console.error("[Zuordnung] Serverstand nicht lesbar:",e); zOhneStamm=null; }
    if(zOhneStamm>0) fehlt.push(zOhneStamm+" Zutat(en) nicht zugeordnet – werden NICHT gespeichert");
    var qt=((document.getElementById("fe_quelle_typ")||{}).value||"").trim();
    if(!qt) fehlt.push("Quelle-Typ");
    var _eanV=((document.getElementById("fe_ean")||{}).value||"").trim();
    var _eanSt=(typeof feEanStatusWahl==="function")?feEanStatusWahl():"";
    var _eanOffen=(_eanSt==="kein_barcode");
    var _dosisLeer = _istSupp && !(((document.getElementById("fe_verzehr")||{}).value||"").trim());
    var _wCount = _istSupp && typeof feWirkCount==="function" ? feWirkCount() : 0;
    var _wNone  = _istSupp && !!((document.getElementById("fe_wirk_none")||{}).checked);
    if(_istSupp && _wCount===0 && !_wNone) fehlt.push("Wirkstoff-Mengen (Dosis-Check)");
    if(window._feDub && window._feDub.freigabe_blockiert) fehlt.push("Namenszwilling ungeklärt");
    /* 28t: Reiter-1-Haken - nur Punkte, die WIRKLICH auf Reiter 1 liegen. Quelle-Typ steht im
       Seitenstreifen (beide Reiter sichtbar), Zutaten-Punkte zaehlt der Reiter-2-Badge, EAN hat
       den eigenen Chip. indexOf("Zutat") faengt beide Zutaten-Texte, laesst "Wirkstoff-Mengen" stehen. */
    try{ if(typeof feTab1BadgeUpdate==="function"){
      var _t1=fehlt.filter(function(x){ return x!=="Quelle-Typ" && x.indexOf("EAN")<0 && x.indexOf("Zutat")<0; });
      feTab1BadgeUpdate(_t1.length, _eanV?"da":(_eanOffen?"offen":"fehlt"));
    } }catch(e){}
    if(fehlt.length===0){
      rd.innerHTML='<span class="rReady">✓ Bereit zur Freigabe'
        +(_istSupp?' – Supplement (kein Lebensmittel-Index, Nährwerte nicht nötig)':(_istSalz?' – reines Salz (kein Index, Nährwerte nicht nötig)':(_istKeinScore?' – Kategorie ohne Lebensmittel-Index (Nährwerte optional)':' – alle Achsen belegt')))+'.</span>'
        +(_dosisLeer?'<div class="rHintWarn">Ohne <b>Verzehrempfehlung</b> ist unklar, worauf sich der Dosis-Check bezieht – wenn möglich nachtragen.</div>':'');
    } else {
      rd.innerHTML='<span class="rFehlt">Fehlt '+((_istSupp||_istSalz)?'für die Freigabe':'für den Index')+': <b>'+fehlt.join(", ")+'</b>'
        +(fehlt.indexOf("Ballaststoffe")>=0?' <span class="rGrauEinfach">· hat das Produkt keine, trag 0 ein</span>':'')+'</span>'
        +(_dosisLeer?'<div class="rHintGrau">Verzehrempfehlung fehlt ebenfalls – blockiert die Freigabe nicht, fehlt aber für den Dosis-Check.</div>':'');
    }
    var rg=document.getElementById("fe_riegel");
    if(rg){
      var ok=function(t){ return '<span class="rOk">&#10003; '+t+'</span>'; };
      var no=function(t){ return '<span class="rWarnF">&#9888; '+t+'</span>'; };
      var nwFehlt=_nwFehltListe;
      var h="";
      h+= _kat ? ok("Kategorie gewählt") : no("Kategorie fehlt (Pflicht)");
      if(_istSupp) h+='<span class="rGrau">– Nährwerte (Supplement, nicht nötig)</span>';
      else if(_istSalz) h+='<span class="rGrau">– Nährwerte (Salz, nicht nötig)</span>';
      else if(_istKeinScore) h+='<span class="rGrau">– Nährwerte (Kategorie ohne Index – optional)</span>';
      else h+= nwFehlt.length ? no(nwFehlt.length+" Nährwert(e) fehlen") : ok("Nährwerte vollständig");
      var _bb=(typeof _fgBestandteilBilanz==="function")?_fgBestandteilBilanz():null;
      var neutral=function(t){ return '<span class="rGrau">– '+t+'</span>'; };
      if(_bb){
        h+= (_bb.gesamt===0) ? no("kein Bestandteil erfasst")
           : ok(_bb.gesamt+(_bb.gesamt===1?" Bestandteil erfasst":" Bestandteile erfasst"));
        h+= (_bb.ohne_note>0)
          ? neutral(_bb.ohne_note+" ohne belastbare Verarbeitungsnote (blockiert die Freigabe nicht)")
          : ok("alle Bestandteile mit Verarbeitungsnote");
        if(_bb.ohne_identitaet>0) h+= neutral(_bb.ohne_identitaet+" ohne geklärte Identität – noch keiner Canonical-Zutat zugeordnet");
      } else {
        h+= (zMit.length===0) ? no(_istSupp?"kein Wirkstoff/keine Zutat erfasst":"keine Zutat erfasst") : ok(zMit.length+(_istSupp?" Wirkstoffe/Zutaten erfasst":" Zutaten erfasst"));
        h+= (zOhneNote>0) ? no(zOhneNote+(_istSupp?" Wirkstoff(e)/Zutat(en) unbewertet":" Zutat(en) unbewertet")) : ok(_istSupp?"alle Wirkstoffe/Zutaten bewertet":"alle Zutaten bewertet");
      }
      if(zOhneStamm>0) h+= no(fgZuordnungWort(zOhneStamm)+' – sie werden beim Speichern NICHT gebunden und gehen verloren');
      h+= qt ? ok("Quelle belegt") : no("Quelle-Typ fehlt");
      h+= _eanV ? ok("EAN erfasst")
          : (_eanSt==='kein_barcode'
              ? '<span class="rBlau">&#9679; Produkt hat keinen Barcode – entschieden (blockiert die Freigabe nicht)</span>'
              : (_eanSt==='noch_nicht_erfasst'
                  ? '<span style="color:#8a5a0b">&#9679; Barcode noch nicht erfasst (blockiert die Freigabe nicht)</span>'
                  : '<span style="color:#8a5a0b">&#9679; EAN-Status nicht entschieden (blockiert die Freigabe nicht)</span>'));
      try{
        var _dub=window._feDub;
        if(_dub===undefined||_dub===null){
          h+='<span class="rGrau">… Dubletten-Prüfung läuft</span>';
        } else if(_dub.fehler){
          h+='<span class="rWarn">&#9888; Dubletten-Prüfung nicht erreichbar</span>';
        } else if(!_dub.anzahl){
          h+= ok("keine Dublette");
        } else {
          var _rang={sicher:1,wahrscheinlich:2,ansehen:3,variante:4}, _s="variante";
          (_dub.treffer||[]).forEach(function(t){ if(_rang[t.stufe]<_rang[_s]) _s=t.stufe; });
          var _btn=function(txt,klasse){ return '<span onclick="try{feDubOeffnen()}catch(e){}" title="Ähnliche Produkte ansehen" class="rDub '+klasse+'">'+txt+'</span>'; };
          if(_s==="sicher")             h+=_btn("&#9888; Dublette: diese EAN gibt es schon – Speichern wird abgewiesen ›","rDubRoh");
          else if(_s==="variante")      h+=_btn("&#8250; "+_dub.anzahl+" Geschmacksvariante(n) – keine Dublette","rDubGrau");
          else                          h+=_btn("&#9888; "+_dub.anzahl+"&times; sehr ähnlich – ansehen ›","rDubWarn");
        }
      }catch(e){}
      try{
        var _fd=window._feDub;
        if(_fd && _fd.freigabe_blockiert){
          var _zw=(_fd.freigabe_zwillinge||[]).map(function(x){ return x.id; }).join(", ");
          h+='<span class="rRot">&#9888; Namenszwilling ungeklärt ('+esc(_zw||"?")+')</span>'
            +'<button type="button" onclick="fgDubletteOkSetzen(true)" title="Bestätigen, dass dies ein eigenes Produkt ist – dann ist die Freigabe frei" '
            +'class="rBtnLila">ist ein eigenes Produkt</button>';
        } else if(_fd && _fd.freigabe_geprueft){
          h+='<span class="rOk">&#10003; Namenszwilling geprüft '
            +'<a href="#" onclick="fgDubletteOkSetzen(false);return false" class="rLinkGrau">rückgängig</a></span>';
        }
      }catch(e){}
      if(_istSupp) h+= _dosisLeer ? no("Verzehrempfehlung fehlt") : ok("Verzehrempfehlung da");
      if(_istSupp) h+= (_wCount>0) ? ok(_wCount+" Wirkstoff-Menge(n) für Dosis-Check")
                        : (_wNone ? '<span class="rGrau">– Wirkstoff-Mengen (bewusst ohne)</span>'
                                  : no("Wirkstoff-Mengen fehlen (Dosis-Check)"));
      try{
        var _pn=((document.getElementById("fe_name")||{}).value||"").toLowerCase();
        if(/vegan|vegetarisch/.test(_pn)){
          var _meatRe=/(salami|schinken|\bspeck|\bwurst|hackfleisch|\bmett\b|\bfleisch|rindfleisch|\brind|rinder|schweine|h[aä]hnchen|puten|\bpute\b|thunfisch|\blachs|forelle|garnele|krabbe|sardelle|anchovi|gelatine|\bbacon|\bkalb|\blamm|hirsch|geflügel|\bfisch)/;
          var _exRe=/(vegan|vegetarisch|pflanzlich|ersatz|alternativ|analog|tofu|seitan|\bsoja|erbsenprotein|frucht|tomate|kokos)/;
          var _tier=[];
          zMit.forEach(function(row){ var _rawnm=((row.querySelector(".fgzName")||{}).value||"").trim(); var _ln=_rawnm.toLowerCase(); if(_ln && _meatRe.test(_ln) && !_exRe.test(_ln)) _tier.push(_rawnm); });
          if(_tier.length) h='<div class="rTierWarnung">&#9888; Produkt heißt „vegan/vegetarisch“, enthält aber tierische Zutat: '+esc(_tier.join(", "))+' — falsches Produkt?</div>'+h;
        }
      }catch(e){}
      try{
        var _bs=(document.getElementById("fe_ballaststoffe")||{}).value;
        var _bsND=!!((document.getElementById("fe_ballast_nd")||{}).checked);
        if((_bs===""||_bs==null) && !_bsND && !_istSupp && !_istSalz){
          var _bp=window._feBallast;
          if(_bp && _bp.stand==="plausibel"){
            h+='<span title="'+esc(_bp.grund||"")+'" class="rWarn">&#9888; Ballaststoffe fehlen — bei dieser Warenart ist <b>0</b> belegt '
              +'<button type="button" onclick="feBallastNull()" class="rBtn0">0 eintragen</button></span>';
          } else if(_bp && _bp.stand==="luecke"){
            h+='<span title="'+esc(_bp.grund||"")+'" class="rWarnF">&#9888; Ballaststoffe fehlen — diese Warenart hat welche, vom Etikett nachtragen (keine 0!)</span>';
          } else if(_bp){
            h+='<span title="'+esc(_bp.grund||"")+'" class="rGrau">&#9888; Ballaststoffe fehlen — am Etikett entscheiden</span>';
          }
        }
      }catch(e){}
      try{
        var _abwR=_fgAbweichungRef();
        if(_abwR.length) h += no(_abwR.length+" Zutat(en) laut Etikett noch nicht übernommen – Freigabe nur mit Bestätigung");
      }catch(e){}
      try{
        var _zUngR=_fgZusUneingestuft();   /* 14.09.2026: Urteil aus der Datenbank, nicht selbst gerechnet */
        if(_zUngR.length) h += no(_zUngR.length+" Zusatzstoff(e) noch nicht eingestuft → kein Index ("+esc(_zUngR.map(function(z){return z.name+(z.e?(" "+z.e):"");}).slice(0,3).join(", "))+(_zUngR.length>3?" …":"")+")");
      }catch(e){}
      try{
        var S=getErfassungsStatus();
        var K=S.freigabe_moeglich
          ? '<div style="display:flex;align-items:center;gap:7px;padding:6px 2px 8px"><span style="width:9px;height:9px;border-radius:50%;background:var(--k-16a34a,#16a34a);flex:0 0 auto"></span>'
            +'<b style="font-size:13px;color:var(--k-166534,#166534)">Freigabe möglich</b>'
            +'<span style="font-size:11.5px;color:var(--muted)">Alle Pflichtprüfungen bestanden</span></div>'
          : '<div style="display:flex;align-items:center;gap:7px;padding:6px 2px 4px"><span style="width:9px;height:9px;border-radius:50%;background:var(--k-dc2626,#dc2626);flex:0 0 auto"></span>'
            +'<b style="font-size:13px;color:var(--k-b91c1c,#b91c1c)">Freigabe blockiert · '+S.freigabe_gruende.length+' Punkt'+(S.freigabe_gruende.length===1?'':'e')+'</b></div>'
            +'<div style="padding:0 2px 8px;font-size:12px;line-height:1.6;color:var(--k-b91c1c,#b91c1c)">'
            +S.freigabe_gruende.map(function(g){ return '• <b>'+esc(g.t)+'</b>'+(g.d?'<br><span style="color:var(--muted);font-size:11.5px;padding-left:11px">'+esc(g.d)+'</span>':''); }).join('<br>')
            +'</div>';
        if(S.hinweise.length){
          K+='<div style="padding:0 2px 8px;font-size:11.5px;line-height:1.55;color:var(--muted)">'
            +S.hinweise.map(function(x){ return '· '+esc(x.t); }).join('<br>')
            +'<br><span style="font-size:10.5px">Diese Punkte blockieren die Freigabe nicht.</span></div>';
        }
        K+='<details><summary style="cursor:pointer;font-size:11.5px;color:var(--muted);padding:3px 2px">Alle Bedingungen im Einzelnen</summary><div style="margin-top:5px">'+h+'</div></details>';
        rg.innerHTML=K;
      }catch(e){ console.error("[Freigabe-Box]", e); rg.innerHTML=h; }
    }
    try{
      var _it=[]; var _pi=function(c,t,hh){ _it.push({c:c,t:t,h:hh||""}); };
      var _nwF=_nwFehltListe;
      _pi(_kat?'g':'r', _kat?'Kategorie gewählt':'Kategorie fehlt', _kat?'':'Pflichtfeld');
      if(_istSupp) _pi('x','Nährwerte','Supplement – nicht nötig');
      else if(_nwF.length) _pi('r',_nwF.length+' Nährwert(e) fehlen', _nwF.slice(0,4).join(', '));
      else _pi('g','Nährwerte vollständig');
      var _bbP=(typeof _fgBestandteilBilanz==="function")?_fgBestandteilBilanz():null;
      if(_bbP){
        _pi(_bbP.gesamt===0?'r':'g', _bbP.gesamt===0?'Kein Bestandteil erfasst':(_bbP.gesamt+(_bbP.gesamt===1?' Bestandteil erfasst':' Bestandteile erfasst')));
        _pi(_bbP.ohne_note>0?'x':'g', _bbP.ohne_note>0?(_bbP.ohne_note+' ohne Verarbeitungsnote'):'alle mit Verarbeitungsnote',
            _bbP.ohne_note>0?'bewusst offen – blockiert die Freigabe nicht':'');
      } else {
        _pi(zMit.length===0?'r':'g', zMit.length===0?(_istSupp?'Kein Wirkstoff/Zutat erfasst':'Keine Zutat erfasst'):(zMit.length+(_istSupp?' Wirkstoffe/Zutaten erfasst':' Zutaten erfasst')));
        _pi(zOhneNote>0?'r':'g', zOhneNote>0?(zOhneNote+(_istSupp?' Wirkstoff(e)/Zutat(en) unbewertet':' Zutat(en) unbewertet')):(_istSupp?'alle Wirkstoffe/Zutaten bewertet':'alle Zutaten bewertet'));
      }
      if(zOhneStamm>0) _pi('r',fgZuordnungWort(zOhneStamm),'werden beim Speichern nicht gebunden – Vorschlag bestätigen oder anlegen lassen');
      _pi(qt?'g':'r', qt?'Quelle belegt':'Quelle-Typ fehlt', qt?'':'Quelle-Typ im Editor setzen');
      if(_eanV) _pi('g','EAN erfasst');
      else if(_eanSt==='kein_barcode')       _pi('b','Produkt hat keinen Barcode','entschieden – blockiert die Freigabe nicht');
      else if(_eanSt==='noch_nicht_erfasst') _pi('y','Barcode noch nicht erfasst','offen – blockiert die Freigabe nicht');
      else _pi('y','EAN-Status nicht entschieden','im Kopf auswählen – blockiert die Freigabe nicht');
      if(_istSupp){ if(_dosisLeer) _pi('y','Verzehrempfehlung fehlt','Bezug des Dosis-Checks – blockiert nicht'); else _pi('g','Verzehrempfehlung da'); }
      if(_istSupp){ if(_wCount>0) _pi('g',_wCount+' Wirkstoff-Menge(n) für Dosis-Check'); else if(_wNone) _pi('x','Wirkstoff-Mengen','bewusst ohne'); else _pi('r','Wirkstoff-Mengen fehlen','für den Dosis-Check'); }
      try{ var _abw2=_fgAbweichungRef(); if(_abw2 && _abw2.length) _pi('y',_abw2.length+' Zutat(en) laut Etikett offen','Freigabe nur mit Bestätigung'); }catch(e){}
      try{ var _zu2=_fgZusUneingestuft();   /* 14.09.2026: Urteil aus der Datenbank */ if(_zu2.length) _pi('y',_zu2.length+' Zusatzstoff(e) nicht eingestuft','→ kein Index: '+_zu2.map(function(z){return z.name;}).slice(0,3).join(", ")); }catch(e){}
      window._fgStatusRoh={
        kat:_kat, istSupp:_istSupp, istSalz:_istSalz, istKeinScore:_istKeinScore,
        nwPflicht:_nwPflicht,
        nwFehlt:_nwFehltListe.slice(), fehlt:fehlt.slice(),
        zMit:zMit.length, zOhneNote:zOhneNote, zOhneStamm:zOhneStamm,
        /* Work #181 Stufe 5: die drei Serverzustaende einzeln, damit die Anzeige spaeter
           "4 gebunden · 1 Vorschlag offen · 0 ohne Treffer" sagen kann, ohne neu zu rechnen.
           null heisst: Antwort noch nicht da. Nicht null Stueck. */
        zGebunden:zGebunden, zVorschlagOffen:zVorschlagOffen, zKeinTreffer:zKeinTreffer,
        quelleTyp:qt, eanWert:_eanV, eanStatus:_eanSt,
        dosisLeer:_dosisLeer, wCount:_wCount, wNone:_wNone,
        punkte:_it.slice()
      };
      feFreigabeLeiste(_it, _fgBlockiert());
    }catch(e){ console.error("[Freigabe-Check] fePlaus abgebrochen – keine Freigabeleiste:", e); }
  }
  try{ feReqBorders(); }catch(e){}
  try{ if(typeof feScorePreview==="function") feScorePreview(); }catch(e){}
  try{ if(typeof feVorgangSync==="function") feVorgangSync(); }catch(e){}   /* Vorgangs-Ansicht (falls aktiv): Phasenleiste + Ampel live mitziehen */
  try{ feStatusStreifen(); }catch(e){ console.error("[Gesamtstatus]", e); }
}

/* Eine Statusstruktur für alle Anzeigen; sie sammelt Serverzustände und bewertet nicht selbst. */
function getErfassungsStatus(){
  var roh=window._fgStatusRoh||null;
  var ref=window._fgRefDaten||null;
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  var S={
    produkt_id:pid,
    gespeichert:(window._fgSaveState||(pid?"saved":"neu")),
    quelle_ok:null, naehrwerte_ok:null,
    bestandteile_gesamt:0, bestandteile_offen:0,
    referenz_blocker:0, referenz_gruende:[],
    freigabe_moeglich:false, freigabe_gruende:[], hinweise:[],
    bekannt:!!roh
  };
  if(!roh) return S;
  /* --- Quelle: Feld gefüllt. Ob sie die Freigabe SPERRT, hängt vom Zweig ab (b). */
  S.quelle_ok=!!roh.quelleTyp;
  var _P=roh.nwPflicht||{makros_erforderlich:!(roh.istSupp||roh.istSalz||roh.istKeinScore),art:"lebensmittel"};
  S.makros_erforderlich=!!_P.makros_erforderlich;
  S.produktart=_P.art;
  S.naehrwerte_ok=_P.makros_erforderlich?(roh.nwFehlt.length===0):null;
  var _sgA=window._fgScoreGespeichert;
  if(_sgA && _sgA.produkt_id===pid){
    var _na=Array.isArray(_sgA.achsen_na)?_sgA.achsen_na:[];
    var _fh=Array.isArray(_sgA.achsen_fehlend)?_sgA.achsen_fehlend:[];
    var _ac=_sgA.achsen||{};
    if(_na.indexOf("naehrwert")>=0)      S.naehrwerte_ok=null;
    else if(_fh.indexOf("naehrwert")>=0) S.naehrwerte_ok=false;
    else if(_ac.naehrwert!=null)         S.naehrwerte_ok=true;
  }
  var canon=Array.isArray(window._fgCanon)?window._fgCanon:null;
  var bb=(typeof _fgBestandteilBilanz==="function")?_fgBestandteilBilanz():null;
  S.bestandteile_gesamt=bb?bb.gesamt_alle:(canon?canon.length:roh.zMit);
  S.bestandteile_offen=bb?(bb.ohne_identitaet+bb.offen):(roh.zOhneStamm||0);
  S.bestandteile_ohne_note=bb?bb.ohne_note:(roh.zOhneNote||0);
  if(ref){
    S.referenz_blocker=Number(ref.blocker||0)||0;
    S.referenz_gueltige_zeilen=Number(ref.pruefzeilen_gueltig||0)||0;
    S.referenz_gruende=Array.isArray(ref.gruende)?ref.gruende.slice():[];
  }
  /* --- Was die Freigabe WIRKLICH verhindert (Serverbedingungen, in der
         Reihenfolge, in der produkt_pruefen_freigeben sie prüft). */
  var G=[];
  if(!roh.kat) G.push({code:"kategorie_fehlt", t:"Kategorie fehlt", s:"kopf", d:"Pflichtfeld – der Server bricht hier zuerst ab."});
  if(S.referenz_blocker>0 && (S.referenz_gueltige_zeilen||0)>0){
    G.push({code:"etikett_blocker", t:S.referenz_blocker+" blockierende Befunde am Etikett", s:"bestand",
            d:(S.referenz_gruende[0]||"cb_referenz_freigabe_guard sperrt.")});
  }
  if(window._feDub && window._feDub.freigabe_blockiert) G.push({code:"namenszwilling", t:"Namenszwilling ungeklärt", s:"kopf", d:"Im Editor bestätigen, dass es ein eigenes Produkt ist."});
  if(roh.istSupp){
    if(roh.wCount===0 && !roh.wNone && roh.zMit===0) G.push({code:"supplement_ohne_inhalt", t:"Supplement ohne Inhalt", s:"analyse", d:"Weder Wirkstoffe noch Zutaten."});
    else if(roh.wCount===0 && !roh.wNone) G.push({code:"wirkstoffmengen_fehlen", t:"Wirkstoff-Mengen fehlen", s:"analyse", d:"Dosis-Check kann nichts anzeigen – oder Haken „keine Mengen auf dem Etikett\" setzen."});
    if(!roh.quelleTyp) G.push({code:"quelle_typ_fehlt", t:"Quelle-Typ fehlt", s:"kopf", d:"Bei Supplements verlangt der Server ihn."});
  } else if(roh.istKeinScore || roh.istSalz){
    if(roh.zMit===0) G.push({code:"keine_zutat", t:"mindestens eine Zutat nötig", s:"bestand", d:"Kategorie ohne Lebensmittel-Index."});
    if(!roh.quelleTyp) G.push({code:"quelle_typ_fehlt", t:"Quelle-Typ fehlt", s:"kopf", d:"In dieser Kategorie verlangt der Server ihn."});
  } else {
    var _hatAchsen=!!(window._fgScoreGespeichert && window._fgScoreGespeichert.produkt_id===pid);
    if(S.naehrwerte_ok===false && !_hatAchsen) G.push({code:"naehrwerte_unvollstaendig", t:"Nährwerte unvollständig", s:"analyse", d:roh.nwFehlt.join(", ")});
    if(roh.zMit===0) G.push({code:"keine_zutat", t:"keine Zutat erfasst", s:"bestand", d:"Ohne Zutaten ist der Score nicht vollständig."});
    var _sg=window._fgScoreGespeichert;
    if(_sg && _sg.produkt_id===pid){
      S.score_quelle="gespeichert";
      S.clean_score=_sg.clean_score;
      S.score_vollstaendig=_sg.vollstaendig;
      S.achsen=_sg.achsen||{};
      S.achsen_na=Array.isArray(_sg.achsen_na)?_sg.achsen_na:[];
      S.achsen_fehlend=Array.isArray(_sg.achsen_fehlend)?_sg.achsen_fehlend:[];
      if(_sg.vollstaendig===false){
        /* Der Server nennt die fehlende Achse jetzt selbst (`achsen_fehlend`) —
           nichts wird abgeleitet oder geraten (§1). */
        var _AN={zutaten:"Zutaten", zusatzstoffe:"Zusatzstoffe", nova:"NOVA", naehrwert:"Nährwerte"};
        var _fl=(S.achsen_fehlend||[]).map(function(a){ return _AN[a]||a; });
        G.push({code:"score_unvollstaendig", t:(_fl.length===1?("Achse „"+_fl[0]+"“ fehlt"):"Score nicht vollständig"),
                d:(_fl.length?("Der Server meldet als fehlend: "+_fl.join(", ")+". "):"")
                  +((_fl.indexOf("Nährwerte")>=0 && roh.nwFehlt.length)?("Offene Felder: "+roh.nwFehlt.join(", ")+". "):"")
                  +(S.achsen_na.length?("Nicht anwendbar für dieses Produkt: "
                     +S.achsen_na.map(function(a){ return _AN[a]||a; }).join(", ")+". "):"")
                  +"Gespeicherter Stand aus cb_score_achsen_status."});
      }
    }
    var _sv=(_sg && _sg.produkt_id===pid) ? null : window._fgScoreServer;
    if(_sv && _sv.vollstaendig===false && !(S.naehrwerte_ok===false && _sv.achsen_fehlend.length===1 && _sv.achsen_fehlend[0]==="Nährwerte")){
      var _fa=_sv.achsen_fehlend||[];
      if(_fa.length===1 && _fa[0]==="Zusatzstoffe"){
        G.push({code:"zusatzstoffstatus_offen", t:"Zusatzstoffstatus noch nicht bestätigt", s:"bestand",
                d:"Letzte offene Score-Achse (15 P.). Entweder die Zusatzstoffe erfassen oder „Keine Zusatzstoffe im Produkt\" anhaken – ohne Beleg bleibt die Achse leer (§3.4)."});
      } else {
        G.push({code:"score_unvollstaendig", t:"Server: Score nicht vollständig",
                d:(_fa.length?("Es fehlt die Achse "+_fa.join(", ")+". "):"")
                  +(_sv.achsen_na&&_sv.achsen_na.length?("Nicht anwendbar für diese Produktart: "+_sv.achsen_na.join(", ")+". "):"")
                  +"Simulation aus dem Formular (cb_score_vorschau) – dieses Produkt ist noch nicht gespeichert, "
                  +"es gibt also noch keinen gespeicherten Scorestand."});
      }
    }
    if(!roh.quelleTyp) G.push({code:"quelle_typ_fehlt", t:"Quelle-Typ fehlt", s:"kopf", d:"Seit 13.08. verlangt der Server ihn in JEDER Kategorie (cb_quelle_belegt)."});
  }
  S.freigabe_gruende=G;
  S.freigabe_moeglich=(G.length===0);
  /* --- Hinweise: wahr, aber KEIN Riegel. */
  /* ==========================================================================
     🔴 JEDER HINWEIS TRAEGT EINEN CODE  ·  Work #231, 23.08.2026
     --------------------------------------------------------------------------
     ChatGPT-Entscheid nach meiner Meldung: "gemeinsamer stabiler Fachcode statt
     Textvergleich". Auslöser war ein Fall, in dem derselbe Sachverhalt zweimal
     auf dem Schirm stand: der Streifen sagte "1 Bestandteil(e) ohne
     Verarbeitungsnote", Station 3 sagte "1 ohne Note". Inhaltlich dasselbe, im
     Wortlaut verschieden - ein Textfilter kann das nicht erkennen.

     WARUM NICHT MIT WOERTERN VERGLEICHEN: jede Umformulierung, die jemand
     spaeter fuer verstaendlicher haelt, macht den Filter still kaputt. Der
     Fehler faellt nicht auf - er zeigt einen Satz zweimal, und das sieht
     harmlos aus. Ein Code aendert sich nicht, wenn der Text schoener wird.

     ⚠ DER CODE IST EINE KENNUNG, KEINE BEWERTUNG. Er sagt nur, WOVON die Rede
     ist, nicht ob es blockiert. Das steht weiter allein in der Liste, in der
     der Eintrag landet: G blockiert, H nicht.
     ========================================================================== */
  var H=[];
  if(S.bestandteile_ohne_note>0) H.push({code:"bestandteil_ohne_verarbeitungsnote",
    t:S.bestandteile_ohne_note+" Bestandteil(e) ohne Verarbeitungsnote",
    d:"Bewusst offen (NULL), keine 0. Blockiert die Freigabe nicht; wirkt nur mittelbar über den Score."});
  if(roh.zOhneStamm>0) H.push({code:"zutat_nicht_im_stamm",
    t:fgZuordnungWort(roh.zOhneStamm), d:"Werden beim Speichern nicht gebunden."});
  if(S.referenz_blocker>0 && (S.referenz_gueltige_zeilen||0)===0)
    H.push({code:"etikettpruefung_nicht_erhoben", t:"Etikettprüfung noch nicht erhoben",
      d:"Die Referenzprüfung ist eine Kontrollhilfe. Sie sperrt eine sauber von Hand erfasste "
        +"Aufnahme nicht allein deshalb, weil noch keine Parser-Prüfzeile vorliegt "
        +"(cb_referenz_freigabe_guard wirft erst ab einer gültigen Zeile)."});
  if(!roh.eanWert && roh.eanStatus!=="kein_barcode") H.push({code:"ean_offen",
    t:"EAN offen", d:"Blockiert die Freigabe nicht."});
  if(roh.dosisLeer) H.push({code:"verzehrempfehlung_fehlt",
    t:"Verzehrempfehlung fehlt", d:"Blockiert nicht, fehlt aber für den Dosis-Check."});
  S.hinweise=H;
  return S;
}
function _fgBlockiert(){ try{ var S=getErfassungsStatus(); return S.bekannt?!S.freigabe_moeglich:true; }catch(e){ return true; } }
/* Die Referenzdaten heissen _fgRefDaten. Der aehnliche Name gehoert einer Funktion
   weiter oben; eine Belegung unter jenem Namen wuerde sie ueberschreiben. */
async function fgRefStatusLaden(pid){
  window._fgRefDaten=null;
  if(!pid) return;
  try{
    var r=await client.rpc("cb_referenz_pruefung_status",{p_produkt_id:pid});
    if(r&&r.error) throw r.error;
    var d=r&&r.data; if(typeof d==="string"){ try{ d=JSON.parse(d); }catch(e){} }
    window._fgRefDaten=d||null;
  }catch(e){ console.error("[Status] cb_referenz_pruefung_status:", e); }
}
/* ---- Der Gesamtstreifen oben ------------------------------------------------ */
function _stChip(txt, art, sub){
  var F={ok:["var(--k-dcfce7,#dcfce7)","var(--k-166534,#166534)"],
          rot:["var(--k-fee2e2,#fee2e2)","var(--k-b91c1c,#b91c1c)"],
          gelb:["var(--k-fef3c7,#fef3c7)","var(--k-92400e,#92400e)"],
          blau:["var(--k-dbeafe,#dbeafe)","var(--k-1d4ed8,#1d4ed8)"],
          grau:["var(--k-eef1f4,#eef1f4)","var(--muted)"],
          still:["transparent","var(--muted)"]}[art]||["var(--k-eef1f4,#eef1f4)","var(--muted)"];
  return '<span title="'+esc(sub||"")+'" style="display:inline-flex;align-items:baseline;gap:5px;padding:3px 9px;border-radius:999px;background:'+F[0]+';color:'+F[1]+';font-size:11.5px;font-weight:'+(art==="still"?"600":"700")+';white-space:nowrap">'+esc(txt)+'</span>';
}
function feKopfbandSync(){
  var n=document.getElementById('feKbName'); if(!n) return;
  var f=document.getElementById('fe_name');
  var txt=f?String(f.value||'').trim():'';
  /* Der Dublettenchip haengt IM Namensfeld des Bandes - beim Ersetzen des Textes
     wuerde er verlorengehen. Deshalb nur den Textknoten davor anfassen. */
  var chip=document.getElementById('feDubChip');
  n.textContent=txt||'Neues Produkt';
  if(chip) n.appendChild(chip);
  var mk=document.getElementById('feKbMarke');
  if(mk){
    var m=((document.getElementById('fe_marke')||{}).value||'').trim();
    var k=document.getElementById('fe_kat');
    var kt=k?String((k.options&&k.selectedIndex>=0&&k.options[k.selectedIndex]&&k.options[k.selectedIndex].text)||k.value||'').trim():'';
    /* "alle Kategorien" und aehnliche Platzhalter sind keine Kategorie. */
    if(kt==='—'||kt==='-') kt='';
    mk.textContent=m+(m&&kt?' · ':'')+kt;
  }
  var st=document.getElementById('feKbStatus');
  if(st) st.textContent=String((window._fgEdit&&window._fgEdit.status)||'Entwurf');
  var pn=document.getElementById('fePNrInfo');
  if(pn){
    var pid=(window._fgEdit&&window._fgEdit.id)||'';
    var dt=(typeof _feDatumDE==='function')?_feDatumDE(window._fgEdit&&window._fgEdit.erfasst_am):'';
    /* 🔴 23.08. der SPEICHERZUSTAND steht ab jetzt hier, wie im Mockup
       ("P32667 · gespeichert · erfasst 12.08.2026"). Vorher war er ein eigener
       Chip im Statusstreifen - und der Streifen kostete 159px fuer acht
       Angaben, von denen sieben woanders standen.
       ⚠ Nicht verwechseln: "Entwurf/Aktiv" ist der PRODUKTSTATUS und steht als
       Pille daneben. "gespeichert" beantwortet eine andere Frage - sind meine
       Eingaben drin? Deshalb stehen beide da, nicht eins statt des anderen. */
    /* Dieselbe Quelle, aus der auch getErfassungsStatus() den Wert nimmt
       (Zeile 6977: gespeichert:(window._fgSaveState||...)). Nicht der Status
       selbst wird hier nachgebaut, nur seine Beschriftung - und getErfassungs-
       Status() wird bewusst NICHT aufgerufen: feStatusStreifen() ruft diese
       Funktion hier auf, das waere eine Berechnung im Kreis. */
    var sp={neu:'noch nicht gespeichert', saving:'speichert …',
            saved:'gespeichert', error:'Speichern fehlgeschlagen'
           }[window._fgSaveState||(pid?'saved':'neu')] || '';
    pn.textContent = pid
      ? (pid+(sp?' · '+sp:'')+(dt?' · erfasst am '+dt:''))
      : 'P-Nummer kommt beim ersten Speichern';
  }
}
if(typeof window!=='undefined'){ window.feKopfbandSync=feKopfbandSync; }
/* ============================================================================
   🔴 feKopfMassSync — der Kopf richtet sich am Inhalt aus  ·  23.08.2026, #181
   ----------------------------------------------------------------------------
   Ralph: "der obere bereich ist immer noch viel zu breit, maximal so breit wie
   der untere bereich. beim scrollen schieben sich die balken uebereinander.
   der obere bereich soll aber fix sein."

   Drei Befunde, zwei Ursachen:

   BREITE. Der Kopf lief ueber die volle Rahmenbreite (1662px), der Inhalt
   darunter begann erst bei 228px. Die Luecke war die Spalte des versteckten
   linken Streifens. Sie ist im Stylesheet auf 0 gesetzt; was bleibt, ist der
   Spaltenabstand - und der aendert sich mit der Fensterbreite.

   WARUM GEMESSEN UND NICHT GERECHNET: die Spaltenbreiten sind minmax-Werte mit
   Ober- und Untergrenzen, dazu drei Umbruchpunkte. Eine nachgerechnete Zahl
   waere an genau einer Fensterbreite richtig. Diese Funktion nimmt die linke
   Kante des ersten und die rechte Kante des letzten sichtbaren Blocks - das
   stimmt bei jeder Breite, auch bei der naechsten, die noch niemand ausprobiert
   hat. Ein Mechanismus statt einer Regel, die jemand nachpflegen muss.

   HOEHE. Kopfband und Bedienzeile schoben sich beim Scrollen uebereinander:
   die Bedienzeile war fixiert (position:sticky, top:0), das Kopfband darueber
   nicht. Beide sind jetzt fixiert, und die Bedienzeile bekommt als Abstand von
   oben die gemessene Hoehe des Kopfbands - sonst wuerde sie es verdecken.
   ========================================================================== */
function feKopfMassSync(){
  var panel=document.getElementById("panel"); if(!panel) return;
  var rahmen=document.getElementById("feRahmen"); if(!rahmen) return;
  var rs=window.getComputedStyle(rahmen);
  /* 🔴 23.08. ZWEITE FASSUNG. Die erste mass die linke und rechte Kante der
     SICHTBAREN Kinder des Rahmens. Ralph: "auf naehrwerte aendert sich auch die
     breite des oberen bereichs" - und er hat recht: in Station 1 stehen zwei
     Spalten nebeneinander, in Station 2 baut sich die rechte erst auf. Die
     Messung traf also den Zustand einer Sekunde und der Kopf zuckte beim
     Stationswechsel.
     Jetzt wird das RASTER gemessen, nicht sein Inhalt: die Spaltenbreiten
     stehen fest, egal welches Kind gerade gefuellt ist. Leere Spuren (die
     Spalte des versteckten Streifens ist 0) zaehlen nicht mit, ihr Abstand
     ebenso wenig. */
  var spalten=String(rs.gridTemplateColumns||"").trim().split(/\s+/)
    .map(parseFloat).filter(function(n){ return isFinite(n) && n>0; });
  if(!spalten.length) return;
  var abstand=parseFloat(rs.columnGap||rs.gap||0)||0;
  var breite=spalten.reduce(function(a,b){ return a+b; },0)+abstand*(spalten.length-1);
  var setz=function(name,wert){
    if(panel.style.getPropertyValue(name)!==wert) panel.style.setProperty(name,wert); };
  setz("--fe-kopf-breite", Math.round(breite)+"px");
  var band=document.getElementById("feKopfband");
  /* Die Hoehe zaehlt nur, solange das Band wirklich steht. Ist es ausgeblendet,
     waere 0 richtig - eine alte Zahl wuerde die Bedienzeile nach unten schieben. */
  setz("--fe-kopf-hoehe",
       (band && band.getClientRects().length ? Math.ceil(band.getBoundingClientRect().height) : 0)+"px");
}
if(typeof window!=="undefined"){ window.feKopfMassSync=feKopfMassSync; }
function feStickyKopfBinden(){
  var box=document.getElementById('fe_gesamtstatus');
  var panel=document.getElementById('panel');
  if(!box || !panel) return;
  /* 16.09.2026 (Ralph: "der rechte Container wird beim Scrollen zu weit nach oben
     geschoben"). Gemessen: im Fokusmodus liegt der Status IN #feKopfFix, und der
     ganze Kopf (240 px) klebt oben. Gemessen wurde aber nur der Status -> 0 px,
     die Referenzkarte (#feKontext, top:var(--fe-sticky-kopf)) rutschte unter den
     Kopf. Im Fokusmodus zaehlt deshalb die Hoehe von #feKopfFix. */
  var fix=document.getElementById('feKopfFix');
  var sync=function(){
    var quelle=(fix && document.body.classList.contains('riFokus') && fix.getClientRects().length)?fix:box;
    var h=Math.ceil(quelle.getBoundingClientRect().height)+(quelle===fix?8:0);
    var wert=h+'px';
    if(panel.style.getPropertyValue('--fe-sticky-kopf')!==wert)
      panel.style.setProperty('--fe-sticky-kopf',wert);
  };
  sync();
  if(!box._feStickyKopfObserver && typeof ResizeObserver==='function'){
    box._feStickyKopfObserver=new ResizeObserver(sync);
    box._feStickyKopfObserver.observe(box);
    if(fix) box._feStickyKopfObserver.observe(fix);
  }
  /* 🔴 23.08. Die Kopfmasse haengen am selben Beobachter-Prinzip: einmal jetzt,
     und danach bei jeder Groessenaenderung von Rahmen oder Kopfband. Ein Wert,
     der nur beim Aufbau gesetzt wird, ist nach dem ersten Fenstergroessen-
     wechsel falsch - und zwar unauffaellig, weil er ja mal gestimmt hat. */
  try{ feKopfMassSync(); }catch(e){}
  var rahmen=document.getElementById('feRahmen');
  var band=document.getElementById('feKopfband');
  if(typeof ResizeObserver==='function'){
    [rahmen,band].forEach(function(el){
      if(el && !el._feMassObserver){
        el._feMassObserver=new ResizeObserver(function(){ try{ feKopfMassSync(); }catch(e){} });
        el._feMassObserver.observe(el);
      }
    });
  }
}
if(typeof window!=='undefined'){ window.feStickyKopfBinden=feStickyKopfBinden; }
/* 🔴 23.08.2026, Work #181 — die Index-Zahl im Kopf (Mockup Zeile A).
   ----------------------------------------------------------------------------
   ERSTE FASSUNG WAR FALSCH, und zwar auf die stille Art. Sie las
   _fgScoreGespeichert selbst und baute eine eigene kleine Fallunterscheidung:
   Zahl oder "kein Index". Live an P73634 gemessen stand die 61 danach ZWEIMAL
   auf dem Schirm - einmal hier im Kopfband, einmal im Statusstreifen darunter.
   Zwei Anzeigen derselben Zahl sind kein Fehler, solange sie einig sind. Sie
   waren es nicht: _feStreifenBewertung() unterscheidet vier Faelle - Supplement
   (Dosis-Check), kein gespeicherter Index, unvollstaendiger Index mit fehlender
   Achse, und den fertigen Wert. Meine Fassung kannte zwei davon. Bei einem
   Supplement haette hier "kein Index" gestanden, waehrend darunter korrekt
   "Dosis-Check" stand - und beides sah wie eine Aussage ueber dasselbe aus.
   Das ist genau die Frontend-Ersatzlogik, die der Kernvertrag verbietet.
   Jetzt ruft der Kopf die vorhandene Funktion auf. Eine Regel, ein Ort
   (Merkkarte 4). Der Streifen zeigt sie dafuer nicht mehr - die Zahl steht
   einmal, oben rechts, wie im Mockup. */
function feKopfIndex(){
  var el=document.getElementById("feKbIndex"); if(!el) return;
  try{ el.innerHTML=_feStreifenBewertung(); }
  catch(e){ el.innerHTML=""; console.error("[Kopf] Index:", e); }
}
if(typeof window!=="undefined"){ window.feKopfIndex=feKopfIndex; }
function feStatusStreifen(){
  try{ feKopfIndex(); }catch(e){ console.error("[Kopf] Index:", e); }
  var box=document.getElementById("fe_gesamtstatus"); if(!box) return;
  var S=getErfassungsStatus();
  if(!S.bekannt){ box.innerHTML=""; feStickyKopfBinden(); return; }
  /* ==========================================================================
     🔴 23.08.2026, Work #181 — DER STREIFEN ZEIGT NUR NOCH, WAS SONST NIRGENDS STEHT
     --------------------------------------------------------------------------
     Ralph: "oberer balken noch nicht wie im mockup". Nachgemessen an P73634,
     und er hat recht - aus einem Grund, den ich vorher nicht benannt hatte:
     der Kopf ist 380px hoch, das Mockup rund 150. Allein dieser Streifen sind
     159px davon. Und was steht drin?

       Chip                     steht ausserdem
       Gespeichert              Zeile A (jetzt: "P73634 · Entwurf · gespeichert")
       Quelle ✓                 Station 1 "Kopf & Quelle · erfüllt"
       Nährwerte ✓              Station 2 "Nährwerte / Analyse · erfüllt"
       Bestandteile 2/3         Station 3 "zu prüfen · 2/3"
       Etikettprüfung geprüft   nirgends - aber es ist eine Meldung, dass nichts
                                los ist. Ein Balken, der Ruhe meldet, kostet
                                Platz und traegt nichts.
       Freigabe möglich         Zeile B, Gruppe Freigabe
       1 Dublettentreffer       Zeile A, Chip "⚠ 1× ähnlich"
       1 Zutat nicht im Stamm   Station 3, hinter dem Zähler

     Sechs von acht Angaben doppelt, die siebte ist eine Beruhigung. 159px.

     🔴 WAS ICH NICHT GEMACHT HABE: den Streifen loeschen. Er stammt aus Work
     #133, ist abgenommen und von zwei Tests geschuetzt - Merkkarte 7. Sein
     Aufbau, seine Klassen und seine Funktion bleiben unveraendert bestehen.
     Geaendert ist nur, WAS hineingelegt wird: ausschliesslich Punkte, die es
     an keiner anderen Stelle gibt. Bleibt nichts uebrig, ist er leer und das
     Stylesheet blendet ihn aus. Kommt ein Blocker dazu, ist er sofort wieder
     da. Rueckbau: eine Zeile, kein Wiederaufbau.
     ========================================================================== */
  var C=[];
  /* Blocker aus der Etikettpruefung. Der EINZIGE Punkt ohne zweiten Anzeigeort -
     deshalb bleibt er. Die beruhigenden Gegenstuecke ("geprüft", "noch nicht
     erhoben") sind weg: sie melden, dass nichts zu tun ist. */
  if(S.referenz_blocker>0 && (S.referenz_gueltige_zeilen||0)>0)
    C.push(_stChip(S.referenz_blocker+" Blocker am Etikett","rot",S.referenz_gruende.join(" · ")));
  /* Der Speicherfehler ist kein Status, sondern ein Unfall - der muss stehen
     bleiben, und zwar rot. "Gespeichert" und "Speichert …" stehen in Zeile A. */
  if(S.gespeichert==="error") C.push(_stChip("Speichern fehlgeschlagen","rot"));
  /* Nährwerte sind der einzige Datenstatus, der ROT werden kann und dessen
     Grund (welche Felder fehlen) nur hier im Titel steht. Station 2 sagt nur
     "unvollständig". Grün oder "nicht nötig" braucht keinen Platz. */
  if(S.naehrwerte_ok===false)
    C.push(_stChip("Nährwerte unvollständig","rot",
                   (window._fgStatusRoh&&window._fgStatusRoh.nwFehlt.join(", "))||""));
  /* 🔴 Der Freigabe-Chip wird unten mit C.pop() geholt. Er MUSS deshalb der
     letzte im Array sein - und er muss immer da sein, auch wenn sonst nichts
     drin steht, sonst holt pop() den Etikett-Blocker heraus und zeigt ihn als
     Freigabezustand an. Das waere eine falsche Aussage aus einer richtigen Zahl. */
  C.push(S.freigabe_moeglich ? _stChip("Freigabe möglich","ok")
        : (S.freigabe_gruende.length===1
            ? _stChip("Freigabe blockiert · "+S.freigabe_gruende[0].t,"rot",S.freigabe_gruende[0].d||"")
            : _stChip("Freigabe blockiert · "+S.freigabe_gruende.length+" Punkte","rot",
                      S.freigabe_gruende.map(function(g){return g.t;}).join(" · "))));
  /* Freigabegründe nur an ihren bestehenden Anzeigeorten zeigen; keine zusätzliche Punkteliste duplizieren. */
  var _detail = '';
  var _hw="", _dub=window._feDub;
  /* 🔴 23.08. der Dublettenhinweis steht nur noch hier, wenn er die Freigabe
     BLOCKIERT. Der harmlose Fall ("· 1 möglicher Dublettentreffer") steht seit
     Work #133 als Chip "⚠ 1× ähnlich ›" im Kopfband - dort ist er anklickbar
     und fuehrt zum Treffer. Der Satz hier konnte das nicht und kostete eine
     eigene Fusszeile. */
  if(_dub && _dub.anzahl && _dub.freigabe_blockiert){
    _hw+='<div class="feStDub rot">⛔ '+esc(String(_dub.anzahl))
      +' möglicher Dublettentreffer'+(_dub.anzahl===1?'':'e')
      +' – blockiert die Freigabe</div>';
  }
  if(S.hinweise && S.hinweise.length){
    /* 🔴 23.08. NACHGEBESSERT nach der Live-Abnahme von Build 4383.
       Ich hatte gemeldet, der Streifen verschwinde bei einem sauberen Produkt.
       Gemessen an P73634 war er 75px hoch - alle Chips leer, aber diese
       Hinweiszeile stand noch da: "· 1 Zutat nicht im Stamm".
       Nachgesehen, wo der Satz sonst steht: Station 3 zeigt ihn WOERTLICH
       ("zu prüfen · 2/3 · 1 Zutat nicht im Stamm"). Also dieselbe Doppelung,
       die ich zwei Absaetze weiter oben gerade beseitigt hatte - nur an einer
       Stelle, an die ich nicht geschaut habe.
       Der Filter vergleicht deshalb ab jetzt auch gegen den Text der Stationen.
       Nicht gegen eine Liste bekannter Saetze: die waere beim naechsten neuen
       Hinweis wieder unvollstaendig, und zwar unbemerkt. */
    /* 🔴 #231 nachgezogen: auch hier zaehlt der CODE, nicht der Wortlaut.
       Die Stationen melden ueber feFokusStand().codes, welche Sachverhalte sie
       schon zeigen. Der Textvergleich bleibt als zweites Netz stehen - er
       schadet nicht und faengt Eintraege, die noch keinen Code haben. */
    var _navEl=document.getElementById("feFokusNav");
    var _navTxt=_navEl?String(_navEl.textContent||""):"";
    var _navCodes=[];
    try{
      (typeof FE_SCHRITTE!=="undefined"?FE_SCHRITTE:[]).forEach(function(s){
        var st=feFokusStand(s);
        if(st && Array.isArray(st.codes)) _navCodes=_navCodes.concat(st.codes);
      });
    }catch(e){}
    var _chipTxt=C.join(" ");
    var _hwRest=S.hinweise.filter(function(x){
      if(x&&x.code&&_navCodes.indexOf(x.code)>=0) return false;
      return _chipTxt.indexOf(esc(x.t))<0 && _navTxt.indexOf(x.t)<0; });
    if(_hwRest.length){
      _hw+='<div style="flex:1 1 100%;font-size:11px;color:var(--muted);line-height:1.5;padding-top:2px">'
        +_hwRest.map(function(x){ return '<span title="'+esc(x.d||"")+'">· '+esc(x.t)+'</span>'; }).join('&nbsp;&nbsp;')
        +'</div>';
    }
  }
  /* 🔴 23.08. C.pop() holt den Freigabe-Chip heraus - aber angezeigt wird er
     hier nur noch, wenn die Freigabe BLOCKIERT ist. "Freigabe möglich" steht
     seit dem Kopfzonen-Umbau in Zeile B, Gruppe "Freigabe", zusammen mit den
     Gruenden und dem Knopf. Zweimal dieselbe gruene Meldung ist kein doppelter
     Trost, sondern doppelte Hoehe. Die Blockade bleibt hier stehen: eine
     Sperre darf ruhig zweimal auffallen. */
  var _frgChip=C.pop();
  /* 🔴 23.08. NACHGEBESSERT. Hier stand: nur "Freigabe moeglich" ausblenden,
     die BLOCKADE aber stehen lassen - mit der Begruendung "eine Sperre darf
     ruhig zweimal auffallen". Ralphs Bildschirmfoto von P32667 zeigt, warum das
     falsch war: oben "Freigabe blockiert · Score nicht vollstaendig", zehn
     Pixel darunter in der Bedienzeile "⚠ 1 offener Punkt · Score nicht
     vollstaendig". Dieselbe Sperre, derselbe Grund, zweimal - und der obere
     Balken war weiss und ueber die volle Breite, also der auffaelligste Teil
     der ganzen Seite.
     Zweimal dieselbe Warnung macht sie nicht dringlicher. Sie macht die Seite
     unruhig und laesst offen, ob zwei verschiedene Dinge gemeint sind.
     Der Freigabezustand steht ab jetzt an EINER Stelle: Zeile B, mit Gruenden
     und Knopf. */
  _frgChip="";
  try{ feKopfbandSync(); }catch(e){}
  box.innerHTML='<div class="feStStreifen">'
      +'<div class="feStLinks">'
        +'<div class="feStGrp"><span class="feStGrpTit">Datenstatus</span>'
          +'<div class="feStGrpChips">'+C.slice(0,-1).join("")+'</div></div>'
        +'<div class="feStGrp"><span class="feStGrpTit">Prüfung</span>'
          +'<div class="feStGrpChips">'+C.slice(-1).join("")+'</div></div>'
      +'</div>'
      /* 🔴 23.08. die Index-Zahl ist hier RAUS und steht nur noch im Kopfband
         oben rechts (feKopfIndex). Vorher stand sie an beiden Stellen. Der
         Freigabe-Chip bleibt hier - er gehoert zum Status, nicht zum Index. */
      +'<div class="feStRechts">'
        +'<div class="feStFrg">'+_frgChip+'</div></div>'
      +(_detail||_hw ? '<div class="feStFuss">'+_detail+_hw+'</div>' : '')
    +'</div>';
  /* 🔴 23.08. Ist nach dem Aussortieren nichts uebrig, verschwindet der
     Streifen - er behaelt seinen Aufbau, nimmt aber keine Hoehe mehr.
     Gemessen an P73634 waren das 159px fuer acht Angaben, von denen sieben
     woanders standen.
     ⚠ Er wird NICHT geleert, nur unsichtbar: kommt beim naechsten Speichern
     ein Blocker dazu, ist er in derselben Sekunde wieder da. Ein Streifen, den
     man erst neu aufbauen muesste, waere im Fehlerfall genau der, der fehlt. */
  box.classList.toggle("leer", C.length===0 && !_frgChip && !_hw && !_detail);
  feStickyKopfBinden();
}
function _feDatumDE(v){
  var t=String(v||"").trim(); if(!t) return "";
  var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? (m[3]+"."+m[2]+"."+m[1]) : t;
}
if(typeof window!=="undefined"){ window._feDatumDE=_feDatumDE; }
/* 🔴 06.09.2026, Work #575 — der Reinheits-Index stand da, nur sah ihn keiner.
   ----------------------------------------------------------------------------
   Ralph, an P73700: "wenn er rechnet ist das gut, aber angezeigt wird nichts."
   Genau so war es. cb_supplement_index rechnet seit work338-v1 vier Achsen
   (Dosis 35 · Wirkform 25 · Transparenz 20 · Zusatzstoffe 20) und lieferte fuer
   P73700 die 42,1 - das Kopfband schrieb trotzdem stur "Dosis-Check / siehe
   Schritt 2". Der Trigger cb_supplement_kein_score leert Clean_Score fuer
   Supplements, und das Frontend las nur diese eine leere Spalte.
   Jetzt liest der Kopf die Zahl da, wo sie entsteht. Keine Frontend-Rechnung:
   _feScoreRun holt sie per RPC und legt sie nach window._fgSuppIndex, hier wird
   nur gezeigt. Faellt die RPC aus, steht wieder der alte Satz da.
   OPTIK: bewusst NICHT wie der Lebensmittel-Index (Ralph). Anderes Label,
   andere Farbe, "von 100" dahinter - damit niemand die 42 fuer einen Root Index
   haelt. Zwei Skalen, zwei Bilder. */
function _feStreifenBewertung(){
  var sg=window._fgScoreGespeichert, pid=(window._fgEdit&&window._fgEdit.id)||"";
  var supp=(String((document.getElementById("fe_kat")||{}).value||"").toLowerCase()==="supplement");
  if(supp){
    var si=window._fgSuppIndex;
    if(si && si.produkt_id===pid && si.index!=null){
      var _a=si.achsen||{};
      var _t=function(k,lbl,max){ var o=_a[k]; if(!o) return "";
        return lbl+": "+String(Math.round(Number(o.punkte)*10)/10).replace(".",",")+" von "+max+"\n"; };
      return '<span class="feStBew supp" title="'+esc(
          "Reinheits-Index fuer Nahrungsergaenzung, Regelversion "+(si.regelversion||"")+".\n"
          +"Nicht der Root Index - eigene Skala, eigene Achsen.\n\n"
          +_t("dosis","Dosis",35)+_t("wirkform","Wirkform",25)
          +_t("transparenz","Transparenz",20)+_t("zusatzstoffe","Zusatzstoffe",20))+'">'
        +'<em>Reinheits-Index</em>'
        +'<b>'+esc(String(Math.round(Number(si.index))))+'</b>'
        +'<i>von 100</i></span>';
    }
    return '<span class="feStBew still" title="Nahrungsergänzung bekommt keinen Lebensmittel-Index. Die Bewertung steht als Dosis-Check bei Wirkstoffe &amp; Dosis.">'
      +'<b>Dosis-Check</b><i>siehe Schritt 2</i></span>';
  }
  if(!sg || sg.produkt_id!==pid)
    return '<span class="feStBew still" title="Der Index entsteht beim Speichern.">'
      +'<b>–</b><i>noch kein gespeicherter Index</i></span>';
  if(sg.clean_score==null){
    var _fh=Array.isArray(sg.achsen_fehlend)?sg.achsen_fehlend:[];
    return '<span class="feStBew fehlt" title="'+esc(_fh.length?("fehlende Achse: "+_fh.join(", ")):"")+'">'
      +'<b>Index unvollständig</b>'+(_fh.length?'<i>'+esc(_fh.join(", "))+' fehlt</i>':'')+'</span>';
  }
  var _f=(typeof farbe==="function")?farbe(sg.bewertung):"var(--ink)";
  return '<span class="feStBew" style="color:'+_f+'"><em>Root Index</em>'
    +'<b>'+esc(String(Math.round(sg.clean_score)))+'</b>'
    +'<i style="color:'+_f+'">'+esc(sg.bewertung||"")+'</i></span>';
}
if(typeof window!=="undefined"){ window._feStreifenBewertung=_feStreifenBewertung; }
if(typeof window!=="undefined"){ window.getErfassungsStatus=getErfassungsStatus;
  window.feStatusStreifen=feStatusStreifen; window.fgRefStatusLaden=fgRefStatusLaden; window._fgBlockiert=_fgBlockiert; }

var _FRG_COL={g:'var(--frg-gruen)',y:'var(--frg-gelb)',r:'var(--frg-rot)',b:'var(--frg-blau)'};
var _FRG_IC={g:'✓',y:'!',r:'✕',x:'–',b:'●'};
var _FRG_PR={r:0,y:1,b:2,g:3,x:4};
function feFreigabeOpen(o){
  window._frgOpenState=false;
}
async function fgOhneIndexFreigeben(){
  var id=(window._fgEdit&&window._fgEdit.id); if(!id){ alert('Kein Produkt geladen.'); return; }
  if(!confirm('Dieses Produkt BEWUSST OHNE Index in den Katalog stellen?\n\nFuer Produkte ohne belegbare Naehrwerte (z. B. frische Sprossen/Keimlinge). Es erscheint im Katalog und beim Scannen, zeigt aber ehrlich KEINE Zahl. Die Wochenpruefung sucht dann nicht mehr nach Naehrwerten.\n\n(Rueckgaengig: Status wieder auf Entwurf setzen.)')) return;
  try{
    var r=await client.rpc('cb_produkt_ohne_index',{p_id:id,p_an:true});
    var d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} }
    if(r.error||!(d&&d.ok)) throw new Error((r.error&&r.error.message)||(d&&d.grund)||'unbekannt');
    alert('\u2713 „Aktiv ohne Index" gesetzt - das Produkt ist im Katalog sichtbar, ohne Zahl.');
    try{ closeP(); }catch(e){}
    try{ if(typeof loadProduktErfassung==='function') loadProduktErfassung(); }catch(e){}
    try{ if(typeof loadScans==='function') loadScans(); }catch(e){}
  }catch(e){ alert('Fehler: '+((e&&e.message)||e)); }
}
if(typeof window!=='undefined'){ window.fgOhneIndexFreigeben=fgOhneIndexFreigeben; }
var _FGST={
  'Entwurf':          {dot:'#e0a32e', bg:'#fff7ea', fg:'#92400e', bd:'#e0a32e', hint:'unsichtbar für Nutzer, in Bearbeitung'},
  'Aktiv':            {dot:'#2e9e57', bg:'#eaf5ee', fg:'#166534', bd:'#2e9e57', hint:'sichtbar im Katalog, mit Index'},
  'Aktiv ohne Index': {dot:'#8a5a0b', bg:'#fffaf0', fg:'#8a5a0b', bd:'#e0a32e', hint:'sichtbar im Katalog, ehrlich ohne Zahl'},
  'Inaktiv':          {dot:'#9aa7b2', bg:'#eef1f4', fg:'#5b6b7e', bd:'#c3ccd4', hint:'aus dem Katalog genommen, bleibt erhalten'}
};
/* ===== SICHTPRUEFUNG JE QUELLENART (Work #372 Etappe 2, Ralph-Entscheid E20) ===========
   Ralph hat am 31.08. festgelegt: Etikettfoto und Amazon/Haendler verlangen, dass ein
   Mensch die konkrete Quelle angesehen hat. Herstellerseite, OpenFoodFacts, BLS und USDA
   laufen im Standard durch.

   ENTSCHEIDEN tut das der Server, nicht diese Anzeige (Kernvertrag B1): gelesen wird
   cb_produkt_quellenpruefung_status, gesetzt wird cb_quellen_sichtpruefung_setzen. Hier
   wird KEINE Quellenart, KEINE Prueftiefe und KEIN Grundtext nachgebaut - alles, was hier
   steht, kommt aus der Antwort des Servers. Faellt der Aufruf aus, bleibt der Kasten leer
   und die Freigabe haengt weiter am serverseitigen Riegel; eine Anzeige darf nichts
   erlauben, was der Server verbietet. */
async function feSichtpruefungLaden(){
  var box=document.getElementById('fe_sichtpruefung'); if(!box) return;
  var id=(window._fgEdit&&window._fgEdit.id);
  if(!id){ box.innerHTML=''; return; }
  var d=null;
  try{
    var r=await client.rpc('cb_produkt_quellenpruefung_status',{p_id:id});
    d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d); }catch(e){} }
  }catch(e){ d=null; }
  window._feQuellenpruefung=d;
  if(!d||!d.sichtpruefung_noetig){ box.innerHTML=''; return; }
  var ok=!!d.sichtpruefung_gueltig;
  var wann=d.sichtpruefung_am?(' – '+esc(String(d.sichtpruefung_am).slice(0,16).replace('T',' '))+(d.sichtpruefung_von?(' von '+esc(d.sichtpruefung_von)):'')):'';
  box.innerHTML='<div style="margin-top:8px;padding:8px 10px;border:1px solid '+(ok?'#86c9a4':'#f59e0b')+';border-radius:8px;background:'+(ok?'#f0f9f4':'#fffbeb')+';font-size:12px;color:'+(ok?'#1f5e34':'#92400e')+'">'
    +'<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">'
    +'<input type="checkbox" id="fe_sichtpruefung_box" '+(ok?'checked':'')+' onchange="try{feSichtpruefungSetzen(this.checked)}catch(e){}">'
    +'<span><b>Ich habe diese Quelle selbst angesehen.</b><br>'
    +esc(d.quelle_typ||'')+' verlangt den Blick eines Menschen auf die Quelle. Ohne dieses Häkchen gibt der Server das Produkt nicht automatisch frei.'
    +(ok?('<br><span style="font-weight:600">Bestätigt'+wann+'</span>'):'')
    +'</span></label></div>';
}
async function feSichtpruefungSetzen(bestaetigt){
  var id=(window._fgEdit&&window._fgEdit.id); if(!id) return;
  var cb=document.getElementById('fe_sichtpruefung_box');
  if(cb) cb.disabled=true;
  try{ await client.rpc('cb_quellen_sichtpruefung_setzen',{p_id:id,p_bestaetigt:!!bestaetigt}); }
  catch(e){ if(typeof console!=='undefined') console.warn('Sichtprüfung nicht gesetzt:',e&&e.message?e.message:e); }
  /* Neu lesen statt lokal umschalten: gueltig ist die Sichtpruefung nur, solange die Quelle
     unveraendert bleibt - das entscheidet der Fingerabdruck auf dem Server, nicht das Haekchen. */
  try{ await feSichtpruefungLaden(); }catch(e){}
  try{ if(typeof fePlaus==='function') fePlaus(); }catch(e){}
}
if(typeof window!=='undefined'){ window.feSichtpruefungLaden=feSichtpruefungLaden; window.feSichtpruefungSetzen=feSichtpruefungSetzen; }

async function fgStatusLoad(){
  try{ feSichtpruefungLaden(); }catch(e){}
  var el=document.getElementById('frgStatusPill'); if(!el) return;
  var id=(window._fgEdit&&window._fgEdit.id);
  try{
    var _dl=document.getElementById('frgDelTop');
    if(_dl){
      if(id){
        _dl.style.display='flex';
        _dl.title='Produkt endgültig löschen';
        _dl.setAttribute('onclick','try{fgProduktLoeschen()}catch(e){}');
        _dl.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
      } else {
        _dl.style.display='none';
        _dl.removeAttribute('onclick');
      }
    }
  }catch(e){}
  if(!id){ el.innerHTML=''; return; }
  var st=null;
  try{ var r=await client.rpc('cb_produkt_status',{p_id:id}); var d=r&&r.data; if(typeof d==='string'){ try{ d=JSON.parse(d);}catch(e){} } if(d&&d.ok) st=d.status; }catch(e){}
  window._fgStatus=st;
  var c=_FGST[st]||{dot:'#9aa7b2',bg:'#eef1f4',fg:'#5b6b7e',bd:'#c3ccd4',hint:''};
  el.innerHTML='<span onclick="fgStatusMenu(this)" title="'+esc((c.hint||'')+' – klicken zum Ändern')+'" style="display:inline-flex;align-items:center;gap:7px;border:1.5px solid '+c.bd+';background:'+c.bg+';color:'+c.fg+';border-radius:999px;padding:6px 12px;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap">'
    +'<span style="width:9px;height:9px;border-radius:50%;background:'+c.dot+';flex:0 0 auto"></span>'+esc(st==='Aktiv ohne Index'?'🌱 ohne Index':(st||'?'))+' <span style="opacity:.55">▾</span></span>';
}
/* Loeschen aus dem Editor heraus. Die eigentliche Arbeit macht peDeaktiv (Nachfrage,
   admin-only RPC cb_produkt_loeschen, Tagebuch-Schutz mit Archivier-Angebot) - hier wird
   nur die ID besorgt und hinterher der Editor geschlossen, damit man nicht auf einer
   Karte sitzenbleibt, deren Produkt es nicht mehr gibt. */
async function fgProduktLoeschen(){
  var id=(window._fgEdit&&window._fgEdit.id);
  if(!id){ alert('Dieses Produkt ist noch nicht gespeichert – es gibt nichts zu löschen.'); return; }
  var erg;
  try{ erg=await peDeaktiv(id); }catch(e){ alert('Konnte nicht löschen: '+((e&&e.message)||e)); return; }
  /* Nicht mehr aus einer lokalen Liste erraten, was der Server getan hat. peDeaktiv
     liefert den bereits serverseitig bestaetigten Ausgang erst NACH dem Listenreload.
     Ablehnung oder Abbruch lassen den Editor offen; Loeschen und Archivieren schliessen
     ihn, damit dahinter der frisch geladene Serverstand sichtbar ist. */
  if(!erg || !erg.ok) return;
  if(erg.aktion==='geloescht' || erg.aktion==='archiviert'){
    try{ closeP(); }catch(e){}
    try{ if(typeof peClose==='function') peClose(); }catch(e){}
  }
}
/* Verwerfen = nur die Maske schliessen. Es wird NICHTS geschrieben und nichts geloescht -
   das Produkt gibt es ja noch gar nicht. Trotzdem mit Nachfrage: bei einer halb ausgefuellten
   Maske ist die Arbeit weg, und das merkt man erst hinterher. */
function fgEditorVerwerfen(){
  if(!confirm('Eingaben verwerfen und schließen?\n\nGespeichert wurde noch nichts – alles in dieser Maske geht verloren.')) return;
  try{ closeP(); }catch(e){}
  try{ if(typeof peClose==='function') peClose(); }catch(e){}
}
if(typeof window!=='undefined'){ window.fgProduktLoeschen=fgProduktLoeschen; window.fgEditorVerwerfen=fgEditorVerwerfen; }
function fgStatusMenuHide(){ var m=document.getElementById('fgStatusMenuBox'); if(m) m.remove(); document.removeEventListener('click',fgStatusMenuHide); }
function fgStatusMenu(anker){
  fgStatusMenuHide();
  var r=anker.getBoundingClientRect();
  var cur=window._fgStatus||'';
  var it=function(st,label,hint,oc){ var c=_FGST[st]||{}; var on=(st===cur);
    return '<div onclick="fgStatusMenuHide();'+(on?'':oc)+'" style="display:flex;gap:10px;padding:9px 11px;border-radius:9px;align-items:flex-start;cursor:'+(on?'default':'pointer')+';'+(on?'background:var(--bg,#f4f2f9)':'')+'" onmouseover="if(!'+on+')this.style.background=\'var(--bg,#f4f2f9)\'" onmouseout="this.style.background=\''+(on?'var(--bg,#f4f2f9)':'')+'\'">'
      +'<span style="width:11px;height:11px;border-radius:50%;background:'+(c.dot||'#9aa7b2')+';margin-top:3px;flex:0 0 auto"></span>'
      +'<span style="min-width:0"><b style="font-size:13px;display:block;color:var(--ink,#1d2733)">'+label+(on?' <span style="font-weight:400;color:var(--muted,#7b8698)">· aktuell</span>':'')+'</b>'
      +'<span style="font-size:11px;color:var(--muted,#7b8698);line-height:1.4">'+hint+'</span></span></div>'; };
  var m=document.createElement('div'); m.id='fgStatusMenuBox';
  m.style.cssText='position:fixed;top:'+Math.round(r.bottom+6)+'px;left:'+Math.max(8,Math.round(r.right-330))+'px;width:330px;z-index:10000;background:var(--card,#fff);border:1px solid var(--line,#e2e8ef);border-radius:12px;box-shadow:0 10px 30px rgba(20,40,70,.22);padding:6px';
  m.innerHTML=
     it('Entwurf','Entwurf','unsichtbar für Nutzer, in Bearbeitung',"fgStatusSet('Entwurf')")
    +it('Aktiv','Aktiv','über die geprüfte Freigabe — Blocker müssen grün sein',"fgStatusSet('Aktiv')")
    +it('Aktiv ohne Index','Aktiv ohne Index 🌱','sichtbar im Katalog, ehrlich ohne Zahl — für Frischware ohne belegbare Nährwerte',"fgStatusSet('Aktiv ohne Index')")
    +it('Inaktiv','Inaktiv','aus dem Katalog nehmen, bleibt erhalten',"fgStatusSet('Inaktiv')")
    +'<div style="border-top:1px solid var(--line,#e2e8ef);margin:6px 4px 4px"></div>'
    +'<div onclick="fgStatusMenuHide();fgProduktLoeschen()" style="display:flex;gap:10px;padding:9px 11px;border-radius:9px;align-items:flex-start;cursor:pointer" onmouseover="this.style.background=\'#fdeceb\'" onmouseout="this.style.background=\'\'">'
      +'<span style="width:11px;height:11px;border-radius:50%;background:#b91c1c;margin-top:3px;flex:0 0 auto"></span>'
      +'<span style="min-width:0"><b style="font-size:13px;display:block;color:#b91c1c">Produkt löschen</b>'
      +'<span style="font-size:11px;color:var(--muted,#7b8698);line-height:1.4">endgültig aus der Datenbank &ndash; steht es in einem Nutzer-Tagebuch, wird stattdessen archiviert</span></span></div>';
  document.body.appendChild(m);
  setTimeout(function(){ document.addEventListener('click',fgStatusMenuHide); },0);
}
async function fgStatusSet(ziel){
  var id=(window._fgEdit&&window._fgEdit.id); if(!id) return;
  try{
    if(ziel==='Aktiv'){
      var fr=await client.rpc('produkt_pruefen_freigeben',{p_id:id});
      if(fr.error){ alert('Kann NICHT auf „Aktiv" – die geprüfte Freigabe blockiert:\n\n'+fr.error.message); return; }
    } else if(ziel==='Aktiv ohne Index'){
      if(!confirm('Bewusst OHNE Index in den Katalog stellen?\n\nFür Produkte ohne belegbare Nährwerte (z. B. frische Sprossen). Sichtbar im Katalog, ehrlich ohne Zahl; die Wochenprüfung sucht keine Nährwerte mehr.')) return;
      var r1=await client.rpc('cb_produkt_ohne_index',{p_id:id,p_an:true});
      var d1=r1&&r1.data; if(typeof d1==='string'){ try{ d1=JSON.parse(d1);}catch(e){} }
      if(r1.error||!(d1&&d1.ok)){ alert('Fehler: '+((r1.error&&r1.error.message)||(d1&&d1.grund)||'unbekannt')); return; }
    } else {
      if(!confirm('Status auf „'+ziel+'" setzen?'+(ziel==='Entwurf'?'\n\nDas Produkt verschwindet aus dem Katalog, bleibt aber erhalten.':''))) return;
      var r2=await client.rpc('cb_produkt_status_setzen',{p_id:id,p_status:ziel});
      if(r2.error){ alert('Fehler: '+r2.error.message); return; }
    }
    try{ fgStatusLoad(); }catch(e){}
    try{ if(typeof loadProduktErfassung==='function') loadProduktErfassung(); }catch(e){}
    try{ if(typeof loadScans==='function') loadScans(); }catch(e){}
  }catch(e){ alert('Fehler: '+((e&&e.message)||e)); }
}
if(typeof window!=='undefined'){ window.fgStatusLoad=fgStatusLoad; window.fgStatusMenu=fgStatusMenu; window.fgStatusMenuHide=fgStatusMenuHide; window.fgStatusSet=fgStatusSet; }
function feFreigabeLeisteHide(){
  var p=document.getElementById('frgPanel'); if(p) p.style.transform='translateX(100%)';   /* eingeklappt lassen fürs nächste Öffnen */
  var r=document.getElementById('frgRail'); if(r) r.style.transform='translateX(0)';
  ['frgRail','frgPanel'].forEach(function(id){ var e=document.getElementById(id); if(e) e.style.display='none'; });
  window._frgBlocked=undefined; window._frgOpenState=false;
}
function feFreigabeLeiste(items, blocked){
  items=items||[];
  if(!document.getElementById('frgStyle')){ var _st=document.createElement('style'); _st.id='frgStyle';
    _st.textContent='@keyframes frgPulse{0%,100%{box-shadow:-7px 8px 24px -12px rgba(20,40,70,.4)}50%{box-shadow:0 0 0 6px rgba(46,158,87,.32),-7px 8px 24px -12px rgba(20,40,70,.4)}}';
    document.head.appendChild(_st); }
  var rail=document.getElementById('frgRail'), panel=document.getElementById('frgPanel');
  if(!rail){
    rail=document.createElement('div'); rail.id='frgRail';
    rail.style.cssText='position:fixed;top:120px;right:0;z-index:9992;display:flex;flex-direction:column;align-items:center;gap:10px;background:#ffffff;border:1px solid #e2e8ef;border-right:0;border-radius:14px 0 0 14px;padding:12px 11px;box-shadow:-7px 8px 24px -12px rgba(20,40,70,.4);cursor:pointer;transition:transform .28s ease;min-width:48px';
    /* 28q: kein Klick-Ziel mehr - das Panel ist abgeschafft, der Klartext steht im Streifen. */
    rail.innerHTML='<span id="frgLbl" style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9.5px;font-weight:800;letter-spacing:.12em;color:#8a94a0;text-transform:uppercase;text-align:center">Freigabe</span>'
      +'<div id="frgDots" style="display:flex;flex-direction:column;gap:9px;align-items:center"></div>'
      +'<span id="frgSum" style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:7px;white-space:nowrap;text-align:center"></span>';
    document.body.appendChild(rail);
  }
  if(!panel){
    panel=document.createElement('aside'); panel.id='frgPanel';
    panel.style.cssText='position:fixed;top:0;right:0;bottom:0;width:344px;max-width:88vw;z-index:9993;background:#ffffff;border-left:1px solid #e2e8ef;box-shadow:-14px 0 40px -18px rgba(20,40,70,.4);transform:translateX(100%);transition:transform .28s ease;display:flex;flex-direction:column;color:#1d3c24';
    panel.innerHTML=''
      +'<div style="display:flex;align-items:center;gap:10px;padding:15px 16px 13px;border-bottom:1px solid #e2e8ef"><span id="frgPdot" style="width:12px;height:12px;border-radius:50%;flex:0 0 auto"></span><b id="frgTitle" style="font-size:15px;color:#1d3c24"></b><span id="frgPill" style="margin-left:auto;font-size:11.5px;font-weight:800;padding:4px 11px;border-radius:999px"></span><button onclick="feFreigabeOpen(false)" title="einklappen" style="border:0;background:none;font-size:19px;color:#6b7280;cursor:pointer;line-height:1;padding:2px 4px">&rsaquo;</button></div>'
      +'<div id="frgList" style="flex:1;overflow:auto;padding:6px 16px"></div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:8px 14px;padding:10px 16px;border-top:1px solid #e2e8ef;font-size:11px;color:#6b7280">'
        +'<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2e9e57;margin-right:5px;vertical-align:middle"></i>erfüllt</span>'
        +'<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e0a32e;margin-right:5px;vertical-align:middle"></i>offen · kein Blocker</span>'
        +'<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#cf5442;margin-right:5px;vertical-align:middle"></i>blockiert</span>'
        +'<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:transparent;border:2px solid #c3ccd4;margin-right:5px;vertical-align:middle"></i>nicht nötig</span>'
      +'</div>'
      +'<div style="padding:12px 16px 16px;border-top:1px solid #e2e8ef;background:#ffffff"><button id="frgGo" style="display:block;width:100%;border:0;border-radius:11px;color:#fff;font-weight:800;font-size:14px;padding:12px;cursor:pointer">✓ Speichern &amp; freigeben</button><button onclick="try{fgEditSave(false)}catch(e){}" style="display:block;width:100%;border:1px solid #e2e8ef;border-radius:11px;background:#ffffff;color:#1d3c24;font-weight:600;font-size:13px;padding:10px;cursor:pointer;margin-top:7px">💾 Nur speichern</button>'
      +'<button onclick="try{fgOhneIndexFreigeben()}catch(e){}" title="Für Produkte ohne belegbare Nährwerte (z. B. frische Sprossen): sichtbar im Katalog, ehrlich ohne Zahl" style="display:block;width:100%;border:1px dashed #e0a32e;border-radius:11px;background:#fffaf0;color:#92400e;font-weight:600;font-size:12.5px;padding:9px;cursor:pointer;margin-top:7px">🌱 Ohne Index freigeben (keine belegbaren Nährwerte)</button></div>';
    document.body.appendChild(panel);
  }
  var _slot=document.getElementById('fe_frgSlot');
  var _lbl=document.getElementById('frgLbl'), _dotsEl=document.getElementById('frgDots');
  if(_slot){
    if(rail.parentNode!==_slot) _slot.appendChild(rail);
    rail._frgInline=true;
    rail.style.cssText='display:none';
    if(_lbl) _lbl.style.cssText='writing-mode:horizontal-tb;font-size:9.5px;font-weight:800;letter-spacing:.12em;color:#8a94a0;text-transform:uppercase;white-space:nowrap';
    if(_dotsEl) _dotsEl.style.cssText='display:flex;flex-direction:row;gap:5px;align-items:center';
  } else {
    if(rail.parentNode!==document.body) document.body.appendChild(rail);
    rail._frgInline=false;
    rail.style.cssText='position:fixed;top:120px;right:0;z-index:9992;display:flex;flex-direction:column;align-items:center;gap:10px;background:#ffffff;border:1px solid #e2e8ef;border-right:0;border-radius:14px 0 0 14px;padding:12px 11px;box-shadow:-7px 8px 24px -12px rgba(20,40,70,.4);cursor:pointer;transition:transform .28s ease;min-width:48px';
    if(_lbl) _lbl.style.cssText='writing-mode:vertical-rl;transform:rotate(180deg);font-size:9.5px;font-weight:800;letter-spacing:.12em;color:#8a94a0;text-transform:uppercase;text-align:center';
    if(_dotsEl) _dotsEl.style.cssText='display:flex;flex-direction:column;gap:9px;align-items:center';
  }
  if(!rail._frgInline) rail.style.display='flex';   /* nur die alte Rand-Fahne zeigen; inline ist der Chip versteckt */
  panel.style.display='';
  rail.style.animation = (blocked || rail._frgInline) ? '' : 'frgPulse 1.8s ease-in-out infinite';
  document.getElementById('frgDots').innerHTML=items.map(function(it){
    var st=(it.c==='x')?'background:transparent;border:2px solid #c3ccd4':('background:'+(_FRG_COL[it.c]||'#c3ccd4')+(it.c==='r'?';box-shadow:0 0 0 4px rgba(207,68,66,.16)':''));
    return '<span title="'+esc((_FRG_IC[it.c]||'')+' '+it.t)+'" style="width:13px;height:13px;border-radius:50%;flex:0 0 auto;'+st+'"></span>';
  }).join('');
  var rot=items.filter(function(i){return i.c==='r';}).length, gelb=items.filter(function(i){return i.c==='y';}).length;
  var sum=document.getElementById('frgSum');
  sum.textContent=blocked?(rot+'✕'):'bereit';
  sum.style.background=blocked?'#fcf3e3':'#e7f4ec'; sum.style.color=blocked?'#92400e':'#1f5e34';
  rail.style.borderColor=blocked?'#e0a32e':'#e2e8ef';
  var list=items.slice().sort(function(a,b){ return _FRG_PR[a.c]-_FRG_PR[b.c]; });
  document.getElementById('frgList').innerHTML=list.map(function(it){
    var icBg={g:'#e7f4ec',y:'#fcf3e3',r:'#fdeceb'}[it.c]||'#eef2f6', icFg={g:'#1f5e34',y:'#92400e',r:'#cf5442'}[it.c]||'#6b7280';
    var icst=(it.c==='x')?'background:transparent;border:2px solid #c3ccd4;color:#c3ccd4':('background:'+icBg+';color:'+icFg);
    var tc=(it.c==='r')?'color:#cf5442;font-weight:600':((it.c==='y')?'color:#92400e':((it.c==='x')?'color:#6b7280':''));
    return '<div style="display:flex;align-items:center;gap:11px;padding:9px 0;font-size:13px;border-top:1px solid #e2e8ef;'+tc+'"><span style="width:21px;height:21px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:0 0 auto;'+icst+'">'+(_FRG_IC[it.c]||'')+'</span><span>'+esc(it.t)+(it.h?'<span style="display:block;font-size:11px;color:#6b7280;font-weight:400;margin-top:1px">'+esc(it.h)+'</span>':'')+'</span></div>';
  }).join('');
  try{
    var _slot2=document.getElementById('fe_frgSlot');
    if(_slot2){
      var tbx=document.getElementById('frgTopBtns');
      if(!tbx){
        tbx=document.createElement('span'); tbx.id='frgTopBtns';
        tbx.innerHTML='<button type="button" id="frgSaveTop" onclick="try{fgEditSave(false)}catch(e){}" title="Nur speichern"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg></button>'
          +'<button type="button" id="frgGoTop">✓ freigeben</button>'
          +'<button type="button" id="frgDelTop" onclick="try{fgProduktLoeschen()}catch(e){}" title="Produkt endgültig löschen"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>';
        var pil=document.createElement('span'); pil.id='frgStatusPill';
        tbx.insertBefore(pil, tbx.firstChild);
        try{ fgStatusLoad(); }catch(e){}
        _slot2.appendChild(tbx);
      }
      if(!document.getElementById('frgDelTop')){
        var _dz=document.createElement('button'); _dz.type='button'; _dz.id='frgDelTop';
        (document.getElementById('frgTopBtns')||_slot2).appendChild(_dz);
        try{ fgStatusLoad(); }catch(e){}   /* fuellt Symbol, Titel und Klick je nach Lage */
      }
      var gt=document.getElementById('frgGoTop');
      if(gt){
        var _S=null; try{ _S=getErfassungsStatus(); }catch(e){}
        var _n=(_S&&_S.bekannt)?_S.freigabe_gruende.length:rot;
        if(blocked){
          gt.disabled=true;
          gt.title='Freigabe blockiert: '+_n+' offene'+(_n===1?'r Befund':' Punkte')
            +((_S&&_S.freigabe_gruende.length)?('\n• '+_S.freigabe_gruende.map(function(g){return g.t;}).join('\n• ')):'');
          gt.onclick=null;
        }
        else { gt.disabled=false; gt.title='Speichern & freigeben'; gt.onclick=function(){ try{fgEditSave(true)}catch(e){} }; }
      }
    }
  }catch(e){}
  /* 28l: Klartext-Ampel im Seitenstreifen - dieselbe (bereits sortierte) Liste wie frgList,
     nur kompakt. Keine zweite Pruefung, nur eine zweite Ansicht (par. 1.11i). */
  try{ var railA=document.getElementById('feRailAmpel');
    if(railA){ railA.innerHTML=list.map(function(it){
      return '<div class="raZ ra-'+it.c+'"><span class="raPunkt"></span><span class="raTxt">'+esc(it.t)+(it.h?'<span class="raSub">'+esc(it.h)+'</span>':'')+'</span></div>'; }).join(''); }
  }catch(e){}
  document.getElementById('frgPdot').style.cssText='width:12px;height:12px;border-radius:50%;flex:0 0 auto;background:'+(blocked?'#e0a32e':'#2e9e57')+';box-shadow:0 0 0 4px '+(blocked?'rgba(224,163,46,.18)':'rgba(46,158,87,.16)');
  document.getElementById('frgTitle').textContent=blocked?('Noch '+rot+' Punkt'+(rot>1?'e':'')+' offen'):'Bereit zur Freigabe';
  var pill=document.getElementById('frgPill');
  pill.textContent=blocked?(rot+' Blocker'):('bereit'+(gelb?' · '+gelb+' gelb':''));
  pill.style.background=blocked?'#fcf3e3':'#e7f4ec'; pill.style.color=blocked?'#92400e':'#1f5e34';
  var go=document.getElementById('frgGo');
  if(blocked){
    var _S2=null; try{ _S2=getErfassungsStatus(); }catch(e){}
    var _n2=(_S2&&_S2.bekannt)?_S2.freigabe_gruende.length:rot;
    go.disabled=true; go.style.background='#c7d2cc'; go.style.cursor='not-allowed';
    go.textContent='Freigabe blockiert: '+_n2+' offene'+(_n2===1?'r Befund':' Punkte');
    go.title=(_S2&&_S2.freigabe_gruende.length)?('• '+_S2.freigabe_gruende.map(function(g){return g.t+(g.d?' – '+g.d:'');}).join('\n• ')):'';
    go.onclick=null;
  }
  else { go.disabled=false; go.style.background='#2e9e57'; go.style.cursor='pointer'; go.innerHTML='✓ Speichern &amp; freigeben'; go.title='Der Server prüft beim Klick alles erneut.'; go.onclick=function(){ try{fgEditSave(true)}catch(e){} }; }
  window._frgBlocked=blocked;
  try{ var _rr=document.getElementById('fe_riegelRow'); if(_rr) _rr.style.display='none'; }catch(e){}
  try{ fgStatusLoad(); }catch(e){}   /* Status-Pille bei jedem Editor-Aufbau frisch */
}

function feAnsichtGet(){ try{ return localStorage.getItem("ri_editor_ansicht")==="vorgang"?"vorgang":"klassisch"; }catch(e){ return "klassisch"; } }
function feAnsichtSet(v){
  v=(v==="vorgang")?"vorgang":"klassisch";
  try{ localStorage.setItem("ri_editor_ansicht",v); }catch(e){}
  /* Ist gerade ein Editor offen, den Rahmen LIVE ein-/ausblenden – ohne Neu-Öffnen, damit
     laufende Eingaben erhalten bleiben (es werden nur DOM-Knoten verschoben, keine neu gebaut). */
  try{ if(document.getElementById("feEditorBody")){ if(v==="vorgang") feVorgangApply(); else feVorgangRemove(); } }catch(e){}
}
/* Phasenleiste oben – Zustand rein aus den Feldern abgeleitet (grün = erledigt, dunkel = aktuell,
   grau = offen). Nichts erfunden: nur, was wirklich ausgefüllt ist. */
function feVorgangStepperHtml(){
  var val=function(id){ return ((document.getElementById(id)||{}).value||"").trim(); };
  var kat=val("fe_kat"); var supp=(kat.toLowerCase()==="supplement");
  var zN=[].slice.call(document.querySelectorAll("#fe_zutRows .fgzName")).filter(function(e){return (e.value||"").trim();}).length;
  /* Work #576: "Supplement" allein macht die Phase nicht mehr fertig. Entweder
     die vier Grundwerte stehen da, oder der Haken sagt, dass das Etikett keine
     nennt. Vorher war jedes Supplement automatisch gruen - auch die 154, die
     eine volle Naehrwerttabelle haben und sie nur nie zu sehen bekamen. */
  var nwKeine=!!((document.getElementById("fe_nw_none")||{}).checked);
  var nwOk=nwKeine||(val("fe_kcal")&&val("fe_kh")&&val("fe_fett")&&val("fe_protein"));
  var zusEl=document.getElementById("fe_ztext"); var zusOk=!!(zusEl&&(zusEl.value||"").trim()!=="");
  var readyEl=document.getElementById("fe_ready"); var bewOk=!!(readyEl&&/Bereit/.test(readyEl.textContent||""));
  var status=((window._fgEdit&&window._fgEdit.status)||"").toLowerCase(); var freiOk=/aktiv/.test(status);
  var phases=[
    {nm:"Stammdaten",ic:"📋",done:!!(val("fe_name")&&val("fe_marke")&&kat)},
    {nm:(supp?"Wirkstoffe":"Zutaten"),ic:"🥣",done:zN>0},
    {nm:(nwKeine?"Nährwerte n.a.":"Nährwerte"),ic:"🔬",done:!!nwOk},
    {nm:"Zusatzstoffe",ic:"⚗️",done:zusOk},
    {nm:"Bewertung",ic:"📊",done:bewOk},
    {nm:"Freigabe",ic:"✅",done:freiOk}
  ];
  var act=-1; for(var i=0;i<phases.length;i++){ if(!phases[i].done){ act=i; break; } }
  return phases.map(function(p,i){
    var active=(i===act);
    var bg=active?"var(--green,#1D3C24)":(p.done?"#eaf5ee":"#fff");
    var col=active?"#fff":(p.done?"#2f6f47":"var(--muted)");
    return '<div style="flex:1;text-align:center;padding:10px 6px;background:'+bg+';color:'+col+';min-width:0">'
      +'<div style="font-size:17px;line-height:1">'+p.ic+'</div>'
      +'<div style="font-weight:700;font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+((p.done&&!active)?"✓ ":"")+p.nm+'</div>'
      +'</div>';
  }).join("");
}
/* Ampel-Schiene links – spiegelt NUR die bereits berechnete Freigabe-Zeile (#fe_riegel).
   Eine Regel, ein Ort: fePlaus bleibt die einzige Wahrheit; hier wird nichts neu geprüft. */
function feVorgangRailHtml(){
  return '<div id="feVorgangKarte" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;position:sticky;top:8px;transition:box-shadow .28s ease,border-color .28s ease">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
      +'<span style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800">Freigabe</span>'
      +'<span id="feVorgangBadge" style="margin-left:auto;font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px;white-space:nowrap;display:none"></span>'
    +'</div>'
    +'<div id="feVorgangAmpel" style="font-size:12px;line-height:1.4"></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:10px;padding-top:8px;border-top:1px solid var(--line);line-height:1.4">Alles ✓ und grün → die Freigabe unten ist frei. ⚠ zeigt, was noch fehlt.</div>'
    +'</div>';
}
function feVorgangSync(){
  try{ var st=document.getElementById("feVorgangStepper"); if(st) st.innerHTML=feVorgangStepperHtml(); }catch(e){}
  try{
    var rg=document.getElementById("fe_riegel"), amp=document.getElementById("feVorgangAmpel");
    if(rg&&amp){
      var kids=[].slice.call(rg.children);
      amp.innerHTML = kids.length
        ? kids.map(function(sp){ return '<div style="padding:6px 0;border-bottom:1px dashed #eef1f3">'+sp.outerHTML+'</div>'; }).join("")
        : '<span style="color:var(--muted)">Trag zuerst die Basisdaten ein.</span>';
    }
    var _b=window._frgBlocked, _bd=document.getElementById("feVorgangBadge"),
        _kt=document.getElementById("feVorgangKarte");
    if(_bd){
      if(_b===undefined||_b===null){ _bd.style.display='none'; }
      else if(_b){ _bd.style.display=''; _bd.textContent='offen';
                   _bd.style.background='#fcf3e3'; _bd.style.color='#92400e'; }
      else { _bd.style.display=''; _bd.textContent='bereit';
             _bd.style.background='#e7f4ec'; _bd.style.color='#1f5e34'; }
    }
    if(_kt){
      if(!document.getElementById("feVorgangStyle")){
        var _vs=document.createElement("style"); _vs.id="feVorgangStyle";
        _vs.textContent='@keyframes feVorgangPulse{0%,100%{box-shadow:0 0 0 0 rgba(46,158,87,.30)}50%{box-shadow:0 0 0 7px rgba(46,158,87,0)}}';
        document.head.appendChild(_vs);
      }
      var frei=(_b===false);
      _kt.style.boxShadow  = frei ? '0 0 0 3px rgba(46,158,87,.22)' : '';
      _kt.style.borderColor= frei ? '#2e9e57' : 'var(--line)';
      _kt.style.animation  = frei ? 'feVorgangPulse 2s ease-in-out infinite' : '';
    }
  }catch(e){}
}
function feVorgangApply(){
  var grid=document.getElementById("feEditorBody"); if(!grid) return;
  if(document.getElementById("feVorgangWrap")){ feVorgangSync(); return; }   /* schon aktiv */
  var step=document.createElement("div"); step.id="feVorgangStepper";
  step.style.cssText="display:flex;border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:12px;background:#fff";
  var wrap=document.createElement("div"); wrap.id="feVorgangWrap";
  var narrow=(window.innerWidth<1100);
  wrap.style.cssText="display:grid;grid-template-columns:"+(narrow?"1fr":"236px minmax(0,1fr)")+";gap:14px;align-items:start";
  var rail=document.createElement("div"); rail.id="feVorgangRail"; rail.innerHTML=feVorgangRailHtml();
  var parent=grid.parentNode; if(!parent) return;
  parent.insertBefore(step, grid);   /* Phasenleiste vor das Raster */
  parent.insertBefore(wrap, grid);   /* Wrapper an die Stelle des Rasters … */
  wrap.appendChild(rail); wrap.appendChild(grid);   /* … und Schiene + UNVERÄNDERTES Raster hineinziehen */
  feVorgangSync();
}
function feVorgangRemove(){
  var wrap=document.getElementById("feVorgangWrap"), grid=document.getElementById("feEditorBody"), step=document.getElementById("feVorgangStepper");
  try{ if(wrap&&grid){ wrap.parentNode.insertBefore(grid, wrap); wrap.remove(); } }catch(e){}   /* Raster zurück an seinen Platz */
  try{ if(step) step.remove(); }catch(e){}
}
if(typeof window!=="undefined"){ window.feAnsichtSet=feAnsichtSet; window.feAnsichtGet=feAnsichtGet; window.feVorgangApply=feVorgangApply; window.feVorgangRemove=feVorgangRemove; window.feVorgangSync=feVorgangSync; }

/* Kaskade 1: Nährwerte + Name + Zutaten-Text aus OFF holen (OFF wird vertraut -> Quelle_Typ gesetzt). */
function _fgBallastAutoND(){
  var b=document.getElementById('fe_ballaststoffe'), cb=document.getElementById('fe_ballast_nd');
  if(!b||!cb) return;
  var gv=function(id){ var e=document.getElementById(id); var x=e?parseFloat(e.value):NaN; return isFinite(x)?x:null; };
  var hatBallast=(b.value!==''&&b.value!=null&&isFinite(parseFloat(b.value)));
  var kcal=gv('fe_kcal'); var rest=[gv('fe_protein'),gv('fe_kh'),gv('fe_fett')].filter(function(x){return x!=null;}).length;
  if(!hatBallast && kcal!=null && rest>=2){ b.value='0'; cb.checked=true; }
}
if(typeof window!=='undefined'){ window._fgBallastAutoND=_fgBallastAutoND; }
function fgSetNW(id,x){
  var e=document.getElementById(id);
  if(!(e && x!=null && isFinite(x))) return false;
  if(window._fgNurLeer && String(e.value).trim()!=="") return false;
  e.value=Math.round(x*100)/100;
  if(window._fgDirtyArmed && window._fgDirty) window._fgDirty.makro=true;   /* DOM-Insert loest kein input-Event aus */
  return true;
}
if(typeof window!=='undefined'){ window.fgSetNW=fgSetNW; }
async function fgPullOff(){
  var msg=document.getElementById("fe_pullMsg");
  var ean=((document.getElementById("fe_ean")||{}).value||"").replace(/\D/g,"");
  if(ean.length<8){ if(msg){ msg.style.color="var(--k-b45309)"; msg.textContent="Erst eine gültige EAN eintragen."; } return; }
  if(msg){ msg.style.color="var(--muted)"; msg.textContent="Open Food Facts wird abgefragt…"; }
  try{ feBusy(true,"🏷 Open Food Facts wird abgefragt…","Nährwerte & Zutaten zur EAN – einen Moment."); }catch(e){}
  try{
    var r=await fetch('https://world.openfoodfacts.org/api/v2/product/'+ean+'.json?fields=product_name,product_name_de,brands,ingredients_text_de,ingredients_text,nutriments',{headers:{'Accept':'application/json'}});
    var j=await r.json(); var p=(j&&j.status===1)?j.product:null;
    if(!p){ if(msg){ msg.style.color="var(--k-b45309)"; msg.textContent="OFF kennt diese EAN nicht – Herstellerseite oder Etikett nutzen."; } return; }
    var n=p.nutriments||{}, sv=fgSetNW;    
    var nm=(p.product_name_de||p.product_name||"").trim(), mk=(p.brands||"").split(",")[0].trim();
    var ne=document.getElementById("fe_name"); if(ne&&nm&&!ne.value) ne.value=nm;
    var me=document.getElementById("fe_marke"); if(me&&mk&&!me.value) me.value=mk;
    sv("fe_kcal",n["energy-kcal_100g"]); sv("fe_protein",n["proteins_100g"]); sv("fe_kh",n["carbohydrates_100g"]);
    sv("fe_zucker",n["sugars_100g"]); sv("fe_polyole",n["polyols_100g"]); sv("fe_fett",n["fat_100g"]); sv("fe_ges_fett",n["saturated-fat_100g"]);
    sv("fe_ballaststoffe",n["fiber_100g"]); sv("fe_salz",n["salt_100g"]); _fgBallastAutoND();
    var zt=(p.ingredients_text_de||p.ingredients_text||"").trim(); var rt=document.getElementById("rikiText"); if(rt&&zt&&!rt.value) rt.value=zt;
    var qt=document.getElementById("fe_quelle_typ"); if(qt) qt.value="OpenFoodFacts";
    feBelegAdd("OpenFoodFacts (EAN "+ean+")");
    try{ fePlaus(); }catch(e){}
    if(msg){ msg.style.color="var(--k-166534)"; msg.innerHTML="&#10003; Werte aus OFF übernommen (je 100 g) – <b>prüfen</b>. Zutaten im Riki-Feld, dann Analysieren."; }
  }catch(e){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Abruf fehlgeschlagen: "+e.message; } }
  finally{ try{ feBusy(false); }catch(e){} }
}
function feBelegAdd(text){
  var bl=document.getElementById("fe_beleg"); if(!bl||!text) return;
  var cur=(bl.value||"").trim();
  if(cur.indexOf(text)>=0) return;          /* schon vermerkt - nicht doppeln */
  bl.value = cur ? (cur+" · "+text) : text;
}
/* ============================================================================
   🔴 fgQuelleErfassen — die eine Uebergabe an den Server  ·  #222/#225/#229
   ----------------------------------------------------------------------------
   Bis heute fuellten fgPullHersteller/Etikett/Off/Usda die Formularfelder und
   sonst nichts. Was die Quelle geliefert hat, war danach nirgends nachlesbar -
   nicht welche Zutaten sie nannte, nicht welche Zusatzstoffe, nicht welche
   Naehrwerte. Wer spaeter fragte "woher kommt dieser Wert", bekam keine Antwort.

   ChatGPT hat dafuer den Serveradapter cb_riki_feldpayload_extraction_speichern
   gebaut (#222/#225). Er nimmt die HEUTIGE Feldantwort der jeweiligen Quelle
   unveraendert entgegen und zerlegt sie serverseitig in Extraktions-Items.

   ⚠ WAS DIESE FUNKTION AUSDRUECKLICH NICHT TUT: nichts umformen, nichts
   zuordnen, nichts bewerten. Sie reicht die Antwort durch, wie sie kam. Jede
   Zeile Umbau hier waere der zweite Parser, den Kernvertrag #214 verbietet -
   und der Grund, warum der Server diesen Adapter ueberhaupt bekommen hat.

   VOM SERVER GEGENGEPRUEFT (Rollback-Transaktion, P32667, Herstellerpayload):
     Aufruf zweimal -> dieselbe run_id (116), also idempotent
     9 Items: 4 macro_nutrient, 3 ingredient, 2 additive (E330, E223)

   FEHLER BLOCKIEREN NICHTS: schlaegt die Uebergabe fehl, sind die Felder
   trotzdem gefuellt. Das Erfassen der Quelle ist eine Beigabe, keine
   Voraussetzung - ein Serverfehler darf Ralph nicht die Eingabe kosten. */
async function fgQuelleErfassen(sourceKind, sourceRef, payload){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  /* Ohne P-Nummer gibt es kein Produkt, an dem die Quelle haengen koennte.
     Beim allerersten Speichern ist das der Normalfall, kein Fehler. */
  if(!pid) return null;
  if(!payload || typeof payload!=="object") return null;
  try{
    var r=await client.rpc('cb_riki_feldpayload_extraction_speichern',{
      p_product_id: pid,
      p_source_kind: sourceKind,
      p_source_ref: String(sourceRef||""),
      p_payload: payload
    });
    if(r && r.error){ console.warn("[Quelle] "+sourceKind+": "+r.error.message); return null; }
    var run=(r&&r.data!=null)?r.data:null;
    if(run!=null) console.info("[Quelle] "+sourceKind+" erfasst, Lauf "+run);
    return run;
  }catch(e){ console.warn("[Quelle] "+sourceKind+" nicht erfasst:", e&&e.message||e); return null; }
}
if(typeof window!=="undefined"){ window.fgQuelleErfassen=fgQuelleErfassen; }

/* Kaskade 2: Herstellerseite via Edge-Function riki-herstellerseite lesen.
   Die URL kommt aus dem EIGENEN Feld fe_url. Frueher wurde sie aus fe_beleg gelesen -
   das machte das Beleg-Feld zum Eingabefeld und zerstoerte einen bereits eingetragenen
   OFF-Beleg, sobald dieser (korrekterweise) keine URL mehr war. */
async function fgPullHersteller(){
  var msg=document.getElementById("fe_pullMsg");
  var ue=document.getElementById("fe_url");
  var url=((ue||{}).value||"").trim();
  if(!/^https?:\/\//i.test(url)){ url=prompt("URL der Hersteller-Produktseite:",""); if(!url) return; url=url.trim(); if(ue) ue.value=url; }
  if(msg){ msg.style.color="var(--muted)"; msg.textContent="Herstellerseite wird gelesen…"; }
  try{ feBusy(true,"🔗 Riki liest die Herstellerseite…","Nährwerte, Zutaten & Zusatzstoffe werden ausgelesen."); }catch(e){}
  try{
    var s=await client.auth.getSession(); var tok=(s&&s.data&&s.data.session)?s.data.session.access_token:client.supabaseKey;
    var r=await fetch(client.supabaseUrl+'/functions/v1/riki-herstellerseite',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':client.supabaseKey},body:JSON.stringify({url:url, product_id:(window._fgEdit&&window._fgEdit.id)||null})});
    var d=await r.json();
    if(d.leer){ if(msg){ msg.style.color="var(--k-b45309)"; msg.textContent=d.hinweis||"Keine Werte gefunden – Screenshot/Etikett nutzen."; } return; }
    if(d.error){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent=d.error; } return; }
    var v=d.vorschlag||{}, n=v.naehrwerte_100g||{}, sv=fgSetNW;
    /* 🔴 24.08.2026, Ralph-Entscheid N = A: HIER WIRD NICHT MEHR GESPEICHERT.
       Seit v21 legt die Edge Function den Herstellerbefund selbst im
       source_extraction-Vertrag ab - sie bekommt dafuer oben die product_id.
       Wuerde der Browser zusaetzlich fgQuelleErfassen rufen, schrieben ZWEI
       Wege denselben Befund mit verschiedenen Metadaten. Genau das verbietet
       der Kernvertrag ("kein zweiter Statusweg"), und welcher gewinnt, waere
       nicht bestimmbar.
       Der Server entscheidet. Der Browser fuellt nur noch die Felder.
       fgQuelleErfassen bleibt fuer Etikett/OFF/USDA zustaendig (#225), solange
       die ihren Befund nicht selbst serverseitig ablegen.
       Beleg, dass es angekommen ist: d.source_run_id in der Antwort. */
    try{ if(d && d.source_run_id) console.info("[Quelle] herstellerseite serverseitig erfasst, Lauf "+d.source_run_id); }catch(_e){}
    var ne=document.getElementById("fe_name"); if(ne&&v.name&&!ne.value) ne.value=v.name;
    var me=document.getElementById("fe_marke"); if(me&&v.marke&&!me.value) me.value=v.marke;
    /* Verzehrempfehlung: die Bezugsmenge, ohne die unsere EFSA-Prozente in der Luft hängen. */
    var vz=document.getElementById("fe_verzehr"); if(vz&&v.verzehrempfehlung&&!vz.value) vz.value=v.verzehrempfehlung;
    var keH=document.getElementById("fe_kat"); if(keH&&!keH.value){ var _kvH=katVorschlagPruefen(v.kategorie_vorschlag); if(_kvH){ keH.value=_kvH; try{ feKatChange(); }catch(e){} } }   /* 28z12: wie beim Etikett - nur gueltige Werte, nur wenn leer */
    /* EAN nur, wenn sie ausgewiesen war UND die Prüfziffer stimmt UND das Feld leer ist.
       Eine EAN ist eine Identität – lieber leer und später gescannt als falsch verknüpft. */
    var ee=document.getElementById("fe_ean"); if(ee&&v.ean&&!ee.value.trim()) ee.value=v.ean;
    sv("fe_kcal",n.kcal); sv("fe_protein",n.protein); sv("fe_kh",n.kh); sv("fe_zucker",n.zucker); sv("fe_fett",n.fett); sv("fe_ges_fett",n.ges_fett); sv("fe_ballaststoffe",n.ballaststoffe); sv("fe_salz",n.salz); _fgBallastAutoND();
    try{ feEinheitAusRiki(v); }catch(e){}       try{ feBioAusRiki(v,"Herstellerseite"); }catch(e){}    
    if(Array.isArray(v.zutaten)&&v.zutaten.length){ var c=document.getElementById("fe_zutRows"); if(c) c.innerHTML=v.zutaten.map(function(z){ return fgZutRow(z.name,z.rating,z.kritisch?"ja":"nein"); }).join(""); try{ if(typeof fgRefFromLabel==="function") fgRefFromLabel((v.zutaten_text||v.zutatentext||v.zutaten_roh||"")+((v.zusatzstoffe&&v.zusatzstoffe.text)?(", "+v.zusatzstoffe.text):""), v.zutaten.map(function(z){return z.name;})); }catch(e){} } try{ if(v.zusatzstoffe) zusFromRiki(v.zusatzstoffe); }catch(e){} try{ fgZutAdditiveRoute(); }catch(e){}
    try{ if(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()==="supplement"){
      var _wqH=v.wirkstoffe||null;
      var _hatZeilen=[].slice.call(document.querySelectorAll("#fe_wirkRows .feWirkRow")).some(function(r){ return (((r.querySelector(".fwName")||{}).value)||"").trim()!==""; });
      if(Array.isArray(_wqH)&&_wqH.length&&typeof feWirkLoad==="function" && !(window._fgNurLeer && _hatZeilen)){
        feWirkLoad(_wqH.map(function(w){ return {naehrstoff:(w.name||w.naehrstoff||""), menge:(w.menge!=null?w.menge:w.wert), einheit:(w.einheit||w.unit||"mg"), nrv:(w.nrv!=null?w.nrv:w.nrv_prozent)}; }).filter(function(w){ return w.naehrstoff&&w.menge!=null; }), false);
      }
    } }catch(e){}
    try{  
      var _wqM2=v.mikronaehrstoffe_100g||null; if(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()!=="supplement" && Array.isArray(_wqM2)&&_wqM2.length && typeof fmMikroVorschlag==="function") fmMikroVorschlag(_wqM2); }catch(e){}
    var qt=document.getElementById("fe_quelle_typ"); if(qt) qt.value="Herstellerseite";
    feBelegAdd(url);
    try{ fePlaus(); }catch(e){}
    var warn=(Array.isArray(d.warnungen)&&d.warnungen.length)?(" &#9888; "+d.warnungen.map(esc).join(" · ")):"";
    if(msg){ msg.style.color="var(--k-166534)"; msg.innerHTML="&#10003; Von der Herstellerseite gelesen – <b>gegen das Etikett prüfen</b>."+warn; }
  }catch(e){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+e.message; } }
  finally{ try{ feBusy(false); }catch(e){} }
}
/* Riki_Research (Beta, Admin): Foto -> Riki erkennt Produkt, SUCHT die Herstellerseite,
   liest Nährwerte+Zutaten und füllt die Maske. Wasserfall: Barcode->OFF (frei) + Claude-Websuche.
   Ergebnis ist ein VORSCHLAG in einem ENTWURF – du prüfst und gibst frei. */
function fgResearchPick(){ var f=document.getElementById("fe_researchFile"); if(f){ f.value=""; f.click(); } }
function _fileZuBase64(file){ return new Promise(function(res,rej){ var r=new FileReader(); r.onload=function(){ res(String(r.result)); }; r.onerror=function(){ rej(r.error); }; r.readAsDataURL(file); }); }
function _fgEtikettAnhaengen(bilder){
  try{
    if(!Array.isArray(bilder) || !bilder.length) return 0;
    window._fgEdit = window._fgEdit || {};
    if(!Array.isArray(window._fgEdit.etikett)) window._fgEdit.etikett = [];
    var ziel = window._fgEdit.etikett, neu = 0;
    bilder.slice().forEach(function(b){
      if(b && ziel.indexOf(b) < 0){ ziel.push(b); neu++; }
    });
    if(neu && typeof fgEtikettRender === "function") fgEtikettRender();
    if(neu){
      try{
        if(window._fgWirkFoto && typeof fgWirkFotoArr==="function"){
          var a=fgWirkFotoArr()||[];
          if(a.length) window._fgWirkFoto.idx=a.length-1;   /* das zuletzt angehaengte */
        }
        if(typeof fgWirkFotoRender==="function") fgWirkFotoRender();
      }catch(e){ console.error("[Etikett] Lesekasten nach Paste:", e); }
    }
    return neu;
  }catch(e){
    console.error("[Editor] Bild konnte nicht an das Produkt angehaengt werden:", e);
    return 0;
  }
}
if(typeof window!=='undefined') window._fgEtikettAnhaengen=_fgEtikettAnhaengen;
async function fgPullResearch(files, b64arr){
  var msg=document.getElementById("fe_pullMsg");
  var list=files?Array.prototype.slice.call(files,0,3):[];
  if(!list.length && !(b64arr&&b64arr.length)){ return; }
  if(msg){ msg.style.color="var(--muted)"; msg.textContent="Riki recherchiert (Foto erkennen · Herstellerseite suchen · lesen)… das kann ~15–30 s dauern."; }
  try{ feBusy(true,"📸 Riki recherchiert zum Foto…","Produkt erkennen · Herstellerseite suchen · lesen (~15–30 s)."); }catch(e){}
  try{
    var bilder=(b64arr&&b64arr.length)?b64arr.slice(0,3):await Promise.all(list.map(_fileZuBase64));
    bilder=bilder.filter(function(b){ return /^data:image\//.test(b); });
    if(!bilder.length){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Bild konnte nicht gelesen werden."; } return; }
    _fgEtikettAnhaengen(bilder);    
    var ean=((document.getElementById("fe_ean")||{}).value||"").trim();
    var s=await client.auth.getSession(); var tok=(s&&s.data&&s.data.session)?s.data.session.access_token:client.supabaseKey;
    var r=await fetch(client.supabaseUrl+'/functions/v1/riki-research',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':client.supabaseKey},body:JSON.stringify({bilder:bilder, ean:ean||undefined, modell:RIKI_LESE_MODELL})});
    var d=await r.json();
    if(d.leer){ if(msg){ msg.style.color="var(--k-b45309)"; msg.textContent=d.hinweis||"Riki hat das Produkt nicht eindeutig gefunden."; } return; }
    if(d.error){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent=d.error; } return; }
    var v=d.vorschlag||{}, n=v.naehrwerte_100g||{}, sv=fgSetNW;    
    var ne=document.getElementById("fe_name"); if(ne&&v.name&&!ne.value) ne.value=v.name;
    var me=document.getElementById("fe_marke"); if(me&&v.marke&&!me.value) me.value=v.marke;
    var vz=document.getElementById("fe_verzehr"); if(vz&&v.verzehrempfehlung&&!vz.value) vz.value=v.verzehrempfehlung;
    var ee=document.getElementById("fe_ean"); if(ee&&v.ean&&!ee.value.trim()) ee.value=v.ean;
    var ke=document.getElementById("fe_kat"); if(ke&&!ke.value){ var _kv=katVorschlagPruefen(v.kategorie_vorschlag); if(_kv) ke.value=_kv; }    
    var ue=document.getElementById("fe_url"); if(ue&&d.quelle_url&&!ue.value.trim()) ue.value=d.quelle_url;
    sv("fe_kcal",n.kcal); sv("fe_protein",n.protein); sv("fe_kh",n.kh); sv("fe_zucker",n.zucker); sv("fe_fett",n.fett); sv("fe_ges_fett",n.ges_fett); sv("fe_ballaststoffe",n.ballaststoffe); sv("fe_salz",n.salz); _fgBallastAutoND();
    try{ feEinheitAusRiki(v); }catch(e){}    
    if(Array.isArray(v.zutaten)&&v.zutaten.length){ var c=document.getElementById("fe_zutRows"); if(c) c.innerHTML=v.zutaten.map(function(z){ return fgZutRow(z.name,z.rating,z.kritisch?"ja":"nein"); }).join(""); try{ if(typeof fgRefFromLabel==="function") fgRefFromLabel((v.zutaten_text||v.zutatentext||v.zutaten_roh||"")+((v.zusatzstoffe&&v.zusatzstoffe.text)?(", "+v.zusatzstoffe.text):""), v.zutaten.map(function(z){return z.name;})); }catch(e){} } try{ if(v.zusatzstoffe) zusFromRiki(v.zusatzstoffe); }catch(e){} try{ fgZutAdditiveRoute(); }catch(e){}
    /* Quelle-Typ nach Domain: großer Händler -> Amazon/Händler, sonst Herstellerseite. Beleg = die echte URL. */
    var url=String(d.quelle_url||"");
    var haendler=/amazon\.|rewe\.|edeka\.|dm\.de|rossmann\.|kaufland\.|lidl\.|aldi\.|mueller\.|müller\./i.test(url);
    var qt=document.getElementById("fe_quelle_typ"); if(qt) qt.value=haendler?"Amazon/Haendler":"Herstellerseite";   /* 27l: "Amazon/Händler" mit ae-Umlaut steht nicht im Quellen_Stamm -> wurde verschluckt. */
    if(url) feBelegAdd(url);
    try{ fePlaus(); }catch(e){}
    var warn=(Array.isArray(d.warnungen)&&d.warnungen.length)?(" &#9888; "+d.warnungen.map(esc).join(" · ")):"";
    var kost=(d.meta&&d.meta.kosten_usd!=null)?(" · ~$"+d.meta.kosten_usd):"";
    if(msg){ msg.style.color="var(--k-166534)"; msg.innerHTML="&#10003; Riki hat recherchiert"+(url?(" (Quelle: "+esc(url)+")"):"")+" – <b>gegen die Quelle/das Etikett prüfen</b>, dann als Entwurf speichern."+warn+kost; }
  }catch(e){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+(e&&e.message?e.message:e); } }
  finally{ try{ feBusy(false); }catch(e){} }
}
function fePasteImg(ev){
  try{
    var items=(ev&&ev.clipboardData&&ev.clipboardData.items)||[];
    var files=[];
    for(var i=0;i<items.length;i++){ if(items[i].type&&items[i].type.indexOf("image")===0){ var f=items[i].getAsFile(); if(f) files.push(f); } }
    if(!files.length) return;   /* kein Bild in der Ablage → normalen (Text-)Paste zulassen */
    if(ev.preventDefault) ev.preventDefault();
    var zone=document.getElementById("fe_pasteZone"); if(zone) zone.innerHTML='📋 Bild übernommen – Riki liest…';
    Promise.all(files.slice(0,3).map(_fileZuBase64)).then(function(b64){
      _fgEtikettAnhaengen(b64);
      fgPullEtikett([], b64);    
    });
  }catch(e){ try{console.log("fePasteImg:",e);}catch(_){} }
}
if(typeof window!=='undefined') window.fePasteImg=fePasteImg;
function _feIstEingabe(el){
  if(!el) return false;
  var tag=String(el.tagName||"").toLowerCase();
  if(tag==="input"||tag==="textarea"||tag==="select") return true;
  if(el.isContentEditable) return true;
  return false;
}
function feEtikettPaste(ev){
  try{
    if(_feIstEingabe(document.activeElement)) return;
    /* 2. Nur im geoeffneten Editor — sonst hat der Paste hier nichts zu suchen. */
    if(!document.getElementById("feRahmen")) return;
    /* 3. Nur wenn wirklich ein BILD in der Ablage liegt. Text laeuft normal weiter;
          das entscheidet fePasteImg selbst (es kehrt bei „kein Bild" zurueck). */
    var items=(ev&&ev.clipboardData&&ev.clipboardData.items)||[];
    var hatBild=false;
    for(var i=0;i<items.length;i++){ if(items[i].type&&items[i].type.indexOf("image")===0){ hatBild=true; break; } }
    if(!hatBild) return;
    /* 4. Der EINE bestehende Weg. */
    fePasteImg(ev);
  }catch(e){ console.error("[Etikett-Paste]", e); }
}
if(typeof document!=="undefined") document.addEventListener("paste", feEtikettPaste, true);
function feEtikettPasteHinweis(){
  var col=document.getElementById("fe_wirkFotoCol"); if(!col) return;
  var alt=document.getElementById("feEtikettPasteTip"); if(alt) alt.remove();
  var mac=false;
  try{ mac=/Mac|iPhone|iPad/i.test((navigator.platform||"")+" "+(navigator.userAgent||"")); }catch(e){}
  var d=document.createElement("div");
  d.id="feEtikettPasteTip"; d.className="feEtikettPasteTip";
  d.innerHTML=(mac?"⌘V":"Strg+V")+" Screenshot einfügen"
    +'<span> – nicht, während ein Feld aktiv ist</span>';
  col.appendChild(d);
}
if(typeof window!=='undefined') window.feEtikettPasteHinweis=feEtikettPasteHinweis;
if(typeof window!=='undefined'){ window.feEtikettPaste=feEtikettPaste; window._feIstEingabe=_feIstEingabe; }
/* „Foto → Etikett auslesen": Riki liest die Naehrwerte/Zutaten direkt vom Etikettfoto
   (riki-etikett) und fuellt die Maske – analog zu fgPullResearch, nur ohne Web-Suche.
   Foto-Quelle: Datei/Kamera (files) ODER hinterlegte Kundenfotos (b64arr). */
async function fgPullEtikett(files, b64arr){
  var msg=document.getElementById("fe_pullMsg");
  var list=files?Array.prototype.slice.call(files,0,3):[];
  if(!list.length && !(b64arr&&b64arr.length)){ return; }
  if(msg){ msg.style.color="var(--muted)"; msg.textContent="Riki liest das Etikett vom Foto…"; }
  try{ feBusy(true,"🏷 Riki liest das Etikett vom Foto…","Nährwerte, Zutaten & Zusatzstoffe werden ausgelesen."); }catch(e){}
  try{
    var bilder=(b64arr&&b64arr.length)?b64arr.slice(0,3):await Promise.all(list.map(_fileZuBase64));
    bilder=bilder.filter(function(b){ return /^data:image\//.test(b); });
    if(!bilder.length){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Bild konnte nicht gelesen werden."; } return; }
    _fgEtikettAnhaengen(bilder);    
    var ean=((document.getElementById("fe_ean")||{}).value||"").trim();
    var s=await client.auth.getSession(); var tok=(s&&s.data&&s.data.session)?s.data.session.access_token:client.supabaseKey;
    var r=await fetch(client.supabaseUrl+"/functions/v1/riki-etikett",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok,"apikey":client.supabaseKey},body:JSON.stringify({bilder:bilder, ean:ean||undefined, modell:RIKI_LESE_MODELL})});
    var d=await r.json();
    if(!r.ok||d.error){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent=d.error||"Riki konnte das Etikett nicht lesen."; } return; }
    var v=d.vorschlag||{}, n=v.naehrwerte_100g||{}, sv=fgSetNW;
    /* 🔴 #225, 24.08.2026 — die zweite der vier Quellen ist angeschlossen.
       riki-etikett liefert DIESELBE Feldstruktur wie die Herstellerseite
       (zutaten · naehrwerte_100g · mikronaehrstoffe_100g · wirkstoffe ·
       zusatzstoffe). Deshalb geht der Befund hier UNVERAENDERT an den
       Serveradapter - kein Umformen, kein Zusammenbauen, kein zweiter Parser.
       Gegengeprueft am Adapter cb_riki_feldpayload_extraction_speichern:
       'etikettfoto' ist einer der vier erlaubten source_kind-Werte.
       Als Quellenkennung dient die EAN, wenn eine dasteht - ein Foto hat keine
       Adresse, und ein leerer String waere eine Herkunftsangabe, die es nicht gibt.
       Reihenfolge wie beim Hersteller: ERST festhalten, was die Quelle gesagt
       hat, dann die Felder fuellen. Kein await - laeuft nebenher. */
    fgQuelleErfassen("etikettfoto", ean ? ("ean:"+ean) : null, v);    
    var ne=document.getElementById("fe_name"); if(ne&&v.name&&!ne.value) ne.value=v.name;
    var me=document.getElementById("fe_marke"); if(me&&v.marke&&!me.value) me.value=v.marke;
    var ee=document.getElementById("fe_ean"); if(ee&&v.ean&&!ee.value.trim()) ee.value=v.ean;
    var ke=document.getElementById("fe_kat"); if(ke&&!ke.value){ var _kv=katVorschlagPruefen(v.kategorie_vorschlag); if(_kv) ke.value=_kv; }    
    sv("fe_kcal",n.kcal); sv("fe_protein",n.protein); sv("fe_kh",n.kh); sv("fe_zucker",n.zucker); sv("fe_fett",n.fett); sv("fe_ges_fett",n.ges_fett); sv("fe_ballaststoffe",n.ballaststoffe); sv("fe_salz",n.salz); _fgBallastAutoND();
    try{ feEinheitAusRiki(v); }catch(e){}       try{ feBioAusRiki(v,"Etikett"); }catch(e){}    
    if(Array.isArray(v.zutaten)&&v.zutaten.length){ var c=document.getElementById("fe_zutRows"); if(c) c.innerHTML=v.zutaten.map(function(z){ return fgZutRow(z.name,z.rating,z.kritisch?"ja":"nein"); }).join(""); try{ if(typeof fgRefFromLabel==="function") fgRefFromLabel((v.zutaten_text||v.zutatentext||v.zutaten_roh||"")+((v.zusatzstoffe&&v.zusatzstoffe.text)?(", "+v.zusatzstoffe.text):""), v.zutaten.map(function(z){return z.name;})); }catch(e){} } try{ if(v.zusatzstoffe) zusFromRiki(v.zusatzstoffe); }catch(e){} try{ fgZutAdditiveRoute(); }catch(e){}
    /* Supplements: liefert Riki Wirkstoff-Mengen mit (name/menge/einheit/nrv), direkt in die
       Wirkstoff-Tabelle übernehmen. Fehlen sie im Riki-Ergebnis, bleibt die Tabelle wie sie ist
       (dann von Hand füllen) – nichts wird erfunden. */
    try{ if(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()==="supplement"){
      var _wq=v.wirkstoffe||v.naehrstoffe||null;
      if(Array.isArray(_wq)&&_wq.length&&typeof feWirkLoad==="function"){
        feWirkLoad(_wq.map(function(w){ return {naehrstoff:(w.name||w.naehrstoff||w.stoff||""), menge:(w.menge!=null?w.menge:w.wert), einheit:(w.einheit||w.unit||"mg"), nrv:(w.nrv!=null?w.nrv:w.nrv_prozent)}; }).filter(function(w){ return w.naehrstoff&&w.menge!=null; }), false);
      }
    } }catch(e){}
    try{ /* 28b: siehe Herstellerseiten-Pfad - nur echte 100-g-Werte, nie die Portions-"wirkstoffe". */
      var _wqM=v.mikronaehrstoffe_100g||null; if(((document.getElementById("fe_kat")||{}).value||"").trim().toLowerCase()!=="supplement" && Array.isArray(_wqM)&&_wqM.length && typeof fmMikroVorschlag==="function") fmMikroVorschlag(_wqM); }catch(e){}
    var qt=document.getElementById("fe_quelle_typ"); if(qt) qt.value="Etikettfoto";   /* 27l: war "Etikettfoto (Nutzer)" - steht NICHT im Quellen_Stamm, das <select> verschluckte es still. Das "(Nutzer)" steht im Beleg. */
    try{ feBelegAdd("Etikettfoto (Nutzer)"+(ean?(" · EAN "+ean):"")); }catch(e){}
    try{ fePlaus(); }catch(e){}
    var warn=(Array.isArray(d.warnungen)&&d.warnungen.length)?(" &#9888; "+d.warnungen.map(esc).join(" · ")):"";
    var kost=(d.meta&&d.meta.kosten_usd!=null)?(" · ~$"+d.meta.kosten_usd):"";
    if(msg){ msg.style.color="var(--k-166534)"; msg.innerHTML="&#10003; Etikett gelesen – <b>gegen das Foto prüfen</b>, dann als Entwurf speichern."+warn+kost; }
  }catch(e){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+(e&&e.message?e.message:e); } }
  finally{ try{ feBusy(false); }catch(e){} }
}
/* Foto-Quellen-Auswahl unter den zwei „Foto →"-Knoepfen auf-/zuklappen. */
function fgSrcToggle(k){ ['r','e'].forEach(function(x){ var el=document.getElementById('fe_src_'+x); if(!el)return; if(x===k){ el.style.display=(el.style.display==='flex')?'none':'flex'; } else el.style.display='none'; }); }
function feSrcTab(which){
  window._feSrc=which;
  ['url','ean','foto'].forEach(function(k){ var p=document.getElementById('feSrc_'+k); if(p) p.style.display=(k===which?'':'none'); });
  try{ document.querySelectorAll('.peSrcTab').forEach(function(b){ var on=b.getAttribute('data-src')===which;
    b.style.background=on?'#fff':'transparent'; b.style.color=on?'#3b56b0':'var(--muted)';
    b.style.boxShadow=on?'0 1px 3px rgba(20,40,70,.12)':'none'; b.style.fontWeight=on?'700':'600'; }); }catch(e){}
}
if(typeof window!=='undefined') window.feSrcTab=feSrcTab;
function feBusy(show, msg, sub){
  if(!document.getElementById('feBusyCss')){
    var st=document.createElement('style'); st.id='feBusyCss';
    st.textContent='@keyframes feSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  var ov=document.getElementById('feBusyOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='feBusyOverlay';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(20,32,48,.42)';
    ov.innerHTML='<div style="background:#fff;border-radius:16px;padding:22px 26px;box-shadow:0 20px 60px rgba(20,40,70,.32);display:flex;align-items:center;gap:16px;max-width:400px">'
      +'<div style="width:34px;height:34px;border:3px solid #e6e9f2;border-top-color:#534ab7;border-radius:50%;animation:feSpin .8s linear infinite;flex:0 0 auto"></div>'
      +'<div><div id="feBusyMsg" style="font-weight:700;color:#1f2a44;font-size:14px">🤖 Riki arbeitet…</div>'
      +'<div id="feBusySub" style="color:#7b8698;font-size:12.5px;margin-top:2px">Einen Moment – Riki füllt die Maske, du prüfst danach.</div></div>'
      +'</div>';
    document.body.appendChild(ov);
  }
  if(show){
    var m=document.getElementById('feBusyMsg'); if(m) m.textContent=msg||'🤖 Riki arbeitet…';
    var s=document.getElementById('feBusySub'); if(s) s.textContent=sub||'Einen Moment – Riki füllt die Maske, du prüfst danach.';
    ov.style.display='flex';
  } else { ov.style.display='none'; }
}
if(typeof window!=='undefined') window.feBusy=feBusy;
/* Hinterlegtes Kundenfoto als Quelle nutzen (statt Kamera/Upload). */
function fgUseKundenfoto(mode){
  var fotos=(window._fgEdit&&window._fgEdit.etikett)||[]; var m=document.getElementById('fe_pullMsg');
  if(!fotos.length){ if(m){ m.style.color='var(--k-b45309)'; m.textContent='Kein hinterlegtes Kundenfoto vorhanden – nimm eins auf oder lade es hoch.'; } return; }
  if(mode==='e') fgPullEtikett(null, fotos); else fgPullResearch(null, fotos);
}
/* Kaskade 3: USDA FoodData Central – generische Nährwerte je 100 g (rohe Pilze/Gemüse/Getreide).
   Englischer, generischer Name. Läuft serverseitig (usda-lookup), Key als Secret USDA_FDC_KEY. */
async function fgPullUsda(){
  var msg=document.getElementById("fe_pullMsg");
  var vor=((document.getElementById("fe_name")||{}).value||"").trim();
  var q=prompt("USDA-Suche – englischer, generischer Lebensmittelname\n(z. B. „king oyster mushroom raw\", „rye bran\", „ground beef raw\"):", vor);
  if(!q) return; q=q.trim(); if(!q) return;
  if(msg){ msg.style.color="var(--muted)"; msg.textContent="USDA FoodData Central wird abgefragt…"; }
  try{ feBusy(true,"🔎 USDA wird abgefragt…","Generische Nährwerte je 100 g – einen Moment."); }catch(e){}
  try{
    var s=await client.auth.getSession(); var tok=(s&&s.data&&s.data.session)?s.data.session.access_token:client.supabaseKey;
    var r=await fetch(client.supabaseUrl+'/functions/v1/usda-lookup',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok,'apikey':client.supabaseKey},body:JSON.stringify({query:q})});
    var d=await r.json();
    if(d.fehler){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="USDA: "+d.fehler; } return; }
    if(!d.gefunden){ if(msg){ msg.style.color="var(--k-b45309)"; msg.textContent="Kein USDA-Treffer für „"+q+"\" – USDA kennt nur generische, englische Namen."; } return; }
    var n=d.naehrwerte||{}, sv=fgSetNW;    
    sv("fe_kcal",n.kcal); sv("fe_protein",n.protein); sv("fe_kh",n.kh); sv("fe_zucker",n.zucker); sv("fe_fett",n.fett); sv("fe_ges_fett",n.ges_fett); sv("fe_ballaststoffe",n.ballaststoffe); sv("fe_salz",n.salz); _fgBallastAutoND();
    var qt=document.getElementById("fe_quelle_typ"); if(qt) qt.value="USDA FoodData Central";
    feBelegAdd("USDA FoodData Central: "+(d.name||q)+(d.fdc_id?(" (FDC "+d.fdc_id+")"):""));
    try{ fePlaus(); }catch(e){}
    var warn=(Array.isArray(d.warnungen)&&d.warnungen.length)?(" &#9888; "+d.warnungen.map(esc).join(" · ")):"";
    var demo=d.key_demo?" <span style=\"color:var(--k-b45309)\">(DEMO_KEY – knappes Limit; eigenen Key als Secret USDA_FDC_KEY setzen)</span>":"";
    if(msg){ msg.style.color="var(--k-166534)"; msg.innerHTML="&#10003; USDA: <b>"+esc(d.name||q)+"</b> (je 100 g) übernommen – <b>gegen das Etikett prüfen</b>."+warn+demo; }
  }catch(e){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+e.message; } }
  finally{ try{ feBusy(false); }catch(e){} }
}
async function fgEditSave(alsoFreigeben){
  const g=id=>document.getElementById(id);
  const msg=g("fe_msg");
  window._fgSaveState="saving";
  try{ feStatusStreifen(); }catch(e){}
  if(alsoFreigeben){
    try{
      var _abw=_fgAbweichungRef();
      if(_abw.length){
        var _liste=_abw.slice(0,8).map(function(x){return "• "+x;}).join("\n")+(_abw.length>8?"\n• …":"");
        var _ok=confirm("⚠ Zutaten-Abweichung\n\n"+_abw.length+" Zutat(en) stehen laut Etikett-Referenz, sind aber NOCH NICHT übernommen:\n\n"+_liste+"\n\nTrotzdem FREIGEBEN?\n(Abbrechen = nur speichern, nicht freigeben)");
        if(!_ok){ alsoFreigeben=false; }
      }
    }catch(e){ console.error("[Freigabe] Abweichungspruefung uebersprungen:", e); }
  }
  msg.style.color="var(--k-374151)"; msg.style.fontWeight="400"; msg.textContent="⏳ speichern…";
  const numv=v=>{ v=(v==null?"":String(v)).trim(); return v===""?undefined:Number(v.replace(",",".")); };
  const nw={}; ["kcal","protein","kh","zucker","polyole","fett","ges_fett","einfach_unges","mehrfach_unges","transfette","ballaststoffe","salz"].forEach(k=>{ const v=numv(g("fe_"+k).value); if(v!==undefined&&!isNaN(v)) nw[k]=v; });
  const zut=[...document.querySelectorAll("#fe_zutRows .fgZutRow")].map(row=>{
    const nm=(row.querySelector(".fgzName").value||"").trim();
    const roh=(row.querySelector(".fgzRate").value||"").trim();
    const rt=(roh==="")?null:Number(roh);
    return { name:nm, rating:(rt===null||isNaN(rt))?null:rt, kritisch:row.querySelector(".fgzKrit").checked?"ja":"nein" };
  }).filter(z=>z.name);
  const name=(g("fe_name").value||"").trim();
  if(!name){ window._fgSaveState="error"; try{ feStatusStreifen(); }catch(e){} msg.style.color="var(--k-dc2626)"; msg.textContent="Titel fehlt."; return; }
  const _kat=(g("fe_kat").value||"").trim();
  /* Kategorie ist Pflicht ZUR FREIGABE (nicht beim reinen Zwischenspeichern). Kein stilles
     Default-"Lebensmittel" mehr – der Admin waehlt bewusst, sonst kippen Produkte falsch einsortiert rein. */
  if(alsoFreigeben && !_kat){ msg.style.color="var(--k-dc2626)"; msg.textContent="Kategorie fehlt – für die Freigabe bitte eine Kategorie wählen."; try{ fePlaus(); }catch(e){} return; }
  const _qt=(g("fe_quelle_typ")&&g("fe_quelle_typ").value||"").trim();
  const _beleg=(g("fe_beleg")&&g("fe_beleg").value||"").trim();
  const _warNeu=!(window._fgEdit&&window._fgEdit.id);
  const _dirty=window._fgDirty||{makro:true,wirk:true,zut:true};
  const _fehler=[];
  if((_warNeu||_dirty.makro) && nw.protein!=null && nw.protein>60){
    if(!confirm("⚠ Protein "+nw.protein+" g je 100 g ist ungewöhnlich hoch.\nMöglich: mit einem anderen Feld vertauscht oder Quellenfehler.\n\nWert bewusst bestätigen und speichern?")){
      msg.style.color="var(--k-b45309)"; msg.textContent="Abgebrochen – Nährwerte prüfen."; return;
    }
  }
  /* Punkt 7: kanonische Dubletten in der Zutatenliste (Sucralose↔E955, Steviolglykoside↔E960,
     doppelte Namen). Altbestand wird NICHT bereinigt - nur Hinweis mit bewusster Bestätigung. */
  try{
    var _kan={}, _dup=[];
    zut.forEach(function(z){
      var kk=String(z.name||"").toLowerCase().trim();
      try{ if(typeof _zusNorm==="function") kk=_zusNorm(z.name)||kk; }catch(_){ }
      try{ if(typeof ZUS_SYN!=="undefined"&&ZUS_SYN[kk]) kk="e:"+String(ZUS_SYN[kk]).toLowerCase().replace(/\s+/g,""); }catch(_){ }
      if(/^e ?\d{3,4}[a-z]?$/.test(kk)) kk="e:"+kk.replace(/\s+/g,"");
      if(_kan[kk]) _dup.push(z.name+" ↔ "+_kan[kk]); else _kan[kk]=z.name;
    });
    if(_dup.length){
      if(!confirm("⚠ Mögliche doppelte Zutatenbindung (derselbe kanonische Stoff):\n\n• "+_dup.join("\n• ")+"\n\nTrotzdem speichern? Bestehende Altdaten werden nicht automatisch bereinigt.")){
        msg.style.color="var(--k-b45309)"; msg.textContent="Abgebrochen – Zutatenliste prüfen."; return;
      }
    }
  }catch(e){}
  const payload={ name, marke:g("fe_marke").value.trim(), kategorie:_kat,
    unterkategorie:g("fe_ukat").value.trim(), ean:g("fe_ean").value.trim(), basis:g("fe_basis").value.trim()||"100g",
    suessstoffe:g("fe_suess").value,
    quelle:_beleg||"Admin-Editor" };
  var _zusJetzt={ text:String((g("fe_ztext")||{}).value||"").trim(),
                  status:String((g("fe_zstatus")||{}).value||"") };
  var _zusStart=(window._fgEdit&&window._fgEdit.zusStart)||{text:"",status:""};
  var _zusGeaendert = _warNeu
        || _zusJetzt.text   !== String(_zusStart.text||"").trim()
        || _zusJetzt.status !== String(_zusStart.status||"");
  if(_zusGeaendert){
    payload.zusatzstoffe_text   = _zusJetzt.text;     
    payload.zusatzstoffe_status = _zusJetzt.status;
  }
  if(_warNeu||_dirty.makro) payload.naehrwerte=nw;
  var _zutLeerungAbgewehrt=false;
  if((_warNeu||_dirty.zut) && zut.length===0 && !_warNeu
     && !!(window._fgEdit&&window._fgEdit.hatteZutaten)){
    _zutLeerungAbgewehrt=true;
    _fehler.push("Zutaten: NICHT geleert. Der Server nimmt keine leere Zutatenliste an "
      + "(Schutz gegen versehentliches Leerschreiben). Einzelne Zutaten entfernst du, indem "
      + "mindestens eine stehen bleibt; alle auf einmal zu loeschen ist bewusst nicht vorgesehen. "
      + "Die Liste steht wieder wie vorher - ein zweiter Klick auf Speichern aendert daran nichts.");
  } else if((_warNeu||_dirty.zut) && !_warNeu && _fgGebundeneFehlen(zut).length){
    /* 🔴 WORK #308 — RIEGEL GEGEN DEN STILLEN VERLUST EINER BINDUNG.
       Der Einzelfix zieht die gebundene Zeile in #fe_zutRows nach. Dieser Riegel
       faengt jeden ANDEREN Weg, der die versteckte Altliste umgeht - heute und
       beim naechsten Knopf, den jemand baut. Der Kernvertrag sagt: manuelle
       gueltige Entscheidungen sind geschuetzt, Speichern und Neuladen sind
       idempotent, kein stiller Zustandsverlust. Ein Speichern, das eine
       serverseitig gebundene Zutat aus der Liste wirft, verletzt genau das. */
    var _fehlt=_fgGebundeneFehlen(zut);
    _fehler.push("Zutaten: NICHT ersetzt. Diese am Produkt gebundene"
      + (_fehlt.length===1?" Zutat steht":"n Zutaten stehen")
      + " nicht in der Arbeitsliste und wuerde"+(_fehlt.length===1?"":"n")+" beim Speichern geloescht: "
      + _fehlt.join(", ") + ". Alles andere ist gespeichert. Lade die Seite neu - "
      + "danach steht die Bindung in der Liste und Speichern geht durch.");
  } else if(_warNeu||_dirty.zut) payload.zutaten=zut;
  if(_qt) payload.quelle_typ=_qt;
  if(window._fgEdit&&window._fgEdit.id) payload.produkt_id=window._fgEdit.id;
  const {data,error}=await client.rpc("cb_produkt_speichern",{p:payload});
  if(error){ window._fgSaveState="error"; try{ feStatusStreifen(); }catch(e){} msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+error.message; return; }
  const pid=data&&data.produkt_id;
  if(pid){ window._fgEdit=window._fgEdit||{}; window._fgEdit.id=pid; try{ fmMikroLoad(pid); }catch(e){}
    try{ var _pn=document.getElementById("fePNrInfo"); if(_pn&&_warNeu) _pn.textContent=pid+" · Entwurf angelegt"; }catch(e){} }    
  /* Verzehrempfehlung + Quelle-Link nachziehen. Bewusst über dieselbe enge Funktion wie der
     Riki-Import statt über einen zweiten Pfad in cb_produkt_speichern – ein Feld, ein Schreibweg. */
  if(pid){
    const _vz=(g("fe_verzehr")&&g("fe_verzehr").value||"").trim();
    const _u=(g("fe_url")&&g("fe_url").value||"").trim();
    const _lnk=/^https?:\/\//i.test(_u)?_u:(/^https?:\/\//i.test(_beleg)?_beleg.split(" · ").filter(function(x){return /^https?:\/\//i.test(x);})[0]||null:null);
    if(_vz||_lnk){ try{ var _r1=await client.rpc("cb_produkt_bezug_setzen",{p_id:pid, p_verzehr:_vz||null, p_form:null, p_link:_lnk}); if(_r1&&_r1.error) throw _r1.error; }catch(e){ _fehler.push("Verzehr/Link: "+((e&&e.message)||e)); } }
    /* EAN-Status festhalten: „offen" wenn bewusst ohne EAN angehakt, sonst „vorhanden" wenn
       eine EAN eingetragen ist. Leer+nicht angehakt: nichts ueberschreiben. */
    try{
      var _eanWahl=(typeof feEanStatusWahl==="function")?feEanStatusWahl():"";
      var _eanV=(g("fe_ean")&&g("fe_ean").value||"").trim();
      /* Eine EAN im Feld schlaegt jede Auswahl. Sonst gilt die Auswahl; ohne Auswahl
         wird NICHTS geschrieben - "nicht entschieden" ueberschreibt keinen frueheren Wert. */
      var _st=_eanV?"vorhanden":(_eanWahl||null);
      if(_st){ var _r2=await client.rpc("cb_produkt_ean_status_setzen",{p_id:pid, p_status:_st}); if(_r2&&_r2.error) throw _r2.error; }
    }catch(e){ _fehler.push("EAN-Status: "+((e&&e.message)||e)); }
    /* Bezugseinheit der Naehrwerte (g|ml) samt Quelle - eigener, enger Schreibweg wie beim
       EAN-Status. Leere Auswahl bedeutet ausdruecklich "wissen wir nicht" und loescht auch die Quelle. */
    try{
      var _eh=(g("fe_mengenEinheit")&&g("fe_mengenEinheit").value||"").trim();
      var _ehq=window._fgEinheitQuelle||"Etikett";
      var _r3=await client.rpc("cb_produkt_mengen_einheit_setzen",{p_id:pid, p_einheit:_eh||null, p_quelle:_eh?_ehq:null});
      if(_r3&&_r3.error) throw _r3.error;
    }catch(e){ _fehler.push("Bezugseinheit: "+((e&&e.message)||e)); }
    try{
      var _bioV=(g("fe_bio")&&g("fe_bio").value||"").trim();
      var _bio=(_bioV==="ja")?true:((_bioV==="nein")?false:null);
      var _r4=await client.rpc("cb_produkt_bio_setzen",{p_id:pid, p_bio:_bio, p_quelle:(_bio===null)?null:feBioQuelleBeiHand(_bioV)});
      if(_r4&&_r4.error) throw _r4.error;
    }catch(e){ _fehler.push("Bio: "+((e&&e.message)||e)); }
    try{
      var _efV=String((window._fgEdit&&window._fgEdit.ernaehrWahl)||"").trim();
      var _r4b=await client.rpc("cb_produkt_ernaehrungsform_setzen",{p_id:pid, p_form:_efV||null});
      if(_r4b&&_r4b.error) throw _r4b.error;
    }catch(e){ _fehler.push("Ernährungsform: "+((e&&e.message)||e)); }
    try{
      var _bnd=!!(g("fe_ballast_nd")&&g("fe_ballast_nd").checked);
      var _r5=await client.rpc("cb_produkt_ballast_nichtdekl_setzen",{p_id:pid, p_flag:_bnd});
      if(_r5&&_r5.error) throw _r5.error;
    }catch(e){ _fehler.push("Ballast-Vermerk: "+((e&&e.message)||e)); }
    try{ var _r6=await client.rpc("cb_produkt_kcal_ok_setzen",{p_id:pid, p_flag:!!(window._fgEdit&&window._fgEdit.kcalOk)}); if(_r6&&_r6.error) throw _r6.error; }catch(e){ _fehler.push("kcal-Übersteuerung: "+((e&&e.message)||e)); }
    /* Work #576: der Haken "keine Naehrwerte auf dem Etikett". Er wird immer
       mitgeschrieben, auch wenn er nicht gesetzt ist - sonst bliebe ein einmal
       gesetzter Haken stehen, nachdem Ralph ihn wieder entfernt hat. */
    try{ var _r6b=await client.rpc("cb_produkt_naehrwerte_nicht_verfuegbar_setzen",
           {p_id:pid, p_flag:!!(g("fe_nw_none")&&g("fe_nw_none").checked)});
         if(_r6b&&_r6b.error) throw _r6b.error; }
    catch(e){ _fehler.push("Haken „keine Nährwerte“: "+((e&&e.message)||e)); }
    if(_warNeu ? true : _dirty.wirk){
      var _wl=(typeof feWirkCollect==="function")?feWirkCollect():[];
      var _wnone=!!(g("fe_wirk_none")&&g("fe_wirk_none").checked);
      var _hatte=!!(window._fgEdit&&window._fgEdit.hatteWirkstoffe);
      var _wirkSenden=true;
      if(_wl.length===0 && !_wnone){
        if(_hatte){
          _wirkSenden=confirm("⚠ Die Wirkstoff-Tabelle ist leer, in der Datenbank sind aber Wirkstoffe gespeichert.\n\nWirklich ALLE Wirkstoffe dieses Produkts löschen?\n(Abbrechen = Wirkstoffe behalten)");
          if(!_wirkSenden) _fehler.push("Wirkstoffe: unverändert gelassen (leere Tabelle nicht gespeichert)");
        } else if(_warNeu){ _wirkSenden=false; }   /* Neuanlage ohne Wirkstoffe: nichts zu schreiben */
      }
      if(_wirkSenden){
        try{
          var _wr=await client.rpc("cb_produkt_wirkstoffe_setzen",{p_id:pid, p_liste:_wl, p_nicht_verfuegbar:_wnone});
          if(_wr&&_wr.error) throw _wr.error;
        }catch(e){ _fehler.push("Wirkstoffe: "+String((e&&e.message)||e)); }
      }
    }
  }
  if(pid && window._fgEdit && window._fgEdit.bild_url){
    try{ var _r7=await client.rpc("cb_produkt_bild_setzen",{p_id:pid, p_url:window._fgEdit.bild_url}); if(_r7&&_r7.error) throw _r7.error; }catch(e){ _fehler.push("Produktbild: "+((e&&e.message)||e)); }
  }
  if(pid && window._fgEdit && Array.isArray(window._fgEdit.etikett)){
    var _alt=window._fgEdit.etikettGeladen||[];
    var _neu=window._fgEdit.etikett.filter(function(b){ return b && _alt.indexOf(b)<0; });
    if(_neu.length){
      try{
        var _r9=await client.rpc("cb_foto_vormerken",{p_fotos:_neu, p_produkt_id:pid, p_quelle:"Editor-Einfuegen"});
        if(_r9&&_r9.error) throw _r9.error;
        window._fgEdit.etikettGeladen=window._fgEdit.etikett.slice();   /* jetzt sind sie gesichert */
      }catch(e){ _fehler.push("Angehängte Fotos ("+_neu.length+"): "+((e&&e.message)||e)); }
    }
  }
  if(pid && window._fgEdit && (window._fgEdit.scanIds||[]).length){
    try{ var _r8=await client.rpc("cb_scan_produkt_verknuepfen",{p_ids:window._fgEdit.scanIds, p_produkt_id:pid}); if(_r8&&_r8.error) throw _r8.error; }catch(e){ _fehler.push("Etikettfoto-Verknüpfung: "+((e&&e.message)||e)); }
  }
  if(alsoFreigeben && pid){
    const fr=await client.rpc("produkt_pruefen_freigeben",{p_id:pid});
    if(fr.error){
      msg.style.color="var(--k-b45309)"; msg.style.fontWeight="700";
      msg.textContent="💾 Gespeichert – aber NICHT freigegeben: "+fr.error.message;
      window._fgSaveState="saved";
      try{ var _p=(window._fgEdit&&window._fgEdit.id);
        if(_p){
          Promise.all([
            (typeof fgRefStatusLaden==="function")?fgRefStatusLaden(_p):Promise.resolve(),
            (typeof fgCanonLaden==="function")?fgCanonLaden(_p):Promise.resolve(),
            (typeof fgZuordnungLaden==="function")?fgZuordnungLaden(_p):Promise.resolve(),
            (typeof fgZusV2Laden==="function")?fgZusV2Laden(_p):Promise.resolve(),
            (typeof fgZutOffenLaden==="function")?fgZutOffenLaden(_p):Promise.resolve()
          ]).then(function(){
            try{ if(typeof fgPickRender==="function") fgPickRender(); }catch(e){ console.error("[Bestandteile] nach Freigabe-Ablehnung:", e); }
            try{ fePlaus(); }catch(e){}
          });
        }
      }catch(e){ console.error("[Status] nach Freigabe-Ablehnung:", e); }
      try{ fePlaus(); }catch(e){}
      try{ msg.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
      loadFreigabe(); return;
    }
    /* Freigabe erfolgreich → weiter zum Erfolgshinweis; kein Score-Warnhinweis mehr. */
  } else if(data && data.vollstaendig===false){
    /* Nur beim REINEN Speichern (Entwurf, nicht freigeben): zeigen, was für den Score fehlt.
       Bei Supplements gibt es bewusst keinen Lebensmittel-Score – dort ist das kein Mangel. */
    var _katSave=((g("fe_kat")||{}).value||"").trim().toLowerCase();
    if(_katSave!=="supplement"){
      msg.style.color="var(--k-b45309)"; msg.style.fontWeight="700";
      var _zUng=_fgZusUneingestuft();   /* 14.09.2026: Urteil aus der Datenbank */
      if(_zUng.length){
        var _zTxt=_zUng.map(function(z){ return z.name+(z.e?(" "+z.e):""); }).join(", ");
        msg.innerHTML="💾 Gespeichert – aber noch KEIN Index. Grund: <b>"+_zUng.length+" Zusatzstoff(e) noch nicht wissenschaftlich eingestuft</b> ("+esc(_zTxt)+"). Bis eine EFSA-/EU-Quelle vorliegt, zeigen wir bewusst keine Zahl – nichts erfinden. (Nicht die Nährwerte sind schuld.)";
      } else {
        var _bsV=((g("fe_ballaststoffe")||{}).value||"").trim();
        var _bsNDs=!!(g("fe_ballast_nd")&&g("fe_ballast_nd").checked);
        msg.textContent="💾 Gespeichert – aber noch KEIN Index. Siehe die Freigabe-Zeile oben; trag den fehlenden Wert ein"
          +((_bsV===""&&!_bsNDs)?" (fehlt nur Ballaststoffe? 0 eintragen)":"")+".";
      }
      try{ fePlaus(); }catch(e){}
      try{ msg.scrollIntoView({behavior:"smooth",block:"center"}); }catch(e){}
      loadFreigabe(); return;
    }
  }
  window._fgSaveState="saved"; try{ feStatusStreifen(); }catch(e){}
  msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"+(alsoFreigeben?" & freigegeben":"");
  try{ const aa=await fetchAlleProdukte(); if(aa) ALL=aa.map(x=>({...x, clean_score:num(x.clean_score)})); }catch(e){}
  /* Nach dem Speichern kennt der Editor jetzt die Produkt-ID. Wichtig beim reinen Speichern,
     weil das Fenster jetzt OFFEN bleibt: ohne diese Zeile würde ein zweites „Speichern"
     ein DUPLIKAT anlegen (bisher fiel das nur nicht auf, weil sich das Fenster schloss). */
  if(pid && window._fgEdit) window._fgEdit.id = pid;
  if(!alsoFreigeben && pid){
    var _mAlt=msg.textContent;
    /* Foto-Teilfehler blockieren den Abschluss; Anhänge dürfen nicht still verloren gehen. */
    if(_fehler.length){
      console.warn("Reload nach Speichern ÜBERSPRUNGEN – es gab Teil-Fehler, "
        + "der Editorstand bleibt erhalten:", _fehler);
      if(_zutLeerungAbgewehrt){
        try{
          var _zs=(window._fgEdit&&Array.isArray(window._fgEdit.zutStart))?window._fgEdit.zutStart:[];
          var _zc=document.getElementById("fe_zutRows");
          if(_zc&&_zs.length){
            _zc.innerHTML=_zs.map(function(z){ return fgZutRow(z.name, z.rating, z.kritisch?"ja":"nein"); }).join("");
            if(typeof fgPickRender==="function") fgPickRender();
            if(typeof feFreigabeLeiste==="function") feFreigabeLeiste();
          }
        }catch(e){ console.error("Zutatenliste nach abgewehrtem Leeren wiederherstellen:", e); }
      }
    } else {
      try{ await openFgEditor(pid, null, window._fgEditorTarget||undefined); }catch(e){ console.error("Reload nach Speichern:", e); }
    }
    try{
      var _m2=document.getElementById("fe_msg");
      if(_m2){
        if(_fehler.length){ _m2.style.color="var(--k-b45309)"; _m2.style.fontWeight="700";
          /* Der Zusatzsatz ist kein Trost, sondern eine Anweisung: der Editorstand
             steht noch, also ist ein zweiter Klick der richtige naechste Schritt. */
          _m2.textContent="💾 Gespeichert, aber mit Teil-Fehlern: "+_fehler.join(" · ")
            +" — nichts ist verloren, dein Stand bleibt stehen. Nochmal auf Speichern klicken versucht genau diese Teile erneut."; }
        else { _m2.style.color="var(--k-16a34a)"; _m2.textContent="✓ gespeichert – aus der Datenbank neu geladen"; }
      }
    }catch(e){}
    window._fgSaveState=_fehler.length?"error":"saved";
    try{ feStatusStreifen(); }catch(e){}
    return;
  }
  if(alsoFreigeben && window._rkSchnell && pid){
    window._rkSchnell=false;
    msg.style.color="var(--k-16a34a)";
    msg.innerHTML='&#10003; Angelegt &amp; freigegeben als <b>'+esc(pid)+'</b> &ndash; das Produkt bleibt offen, du kannst weiter pr&uuml;fen und anpassen.';
    setTimeout(()=>{ try{ openFgEditor(pid); }catch(e){} try{ loadFreigabe(); }catch(e){} }, 600);
    return;
  }
  if(alsoFreigeben){
    setTimeout(()=>{
      /* Inline-Modus (Produkt-Erfassung): der Editor sitzt in #peDetail → nur die Produktliste
         neu laden (aktualisiert Status/Score der gespeicherten Zeile), Editor schließt sich dabei.
         Sonst der alte Vollbild-Weg (Posteingang). */
      try{ feFreigabeLeisteHide(); }catch(e){}
      var det=document.getElementById("peDetail"), nm=document.getElementById("fe_name");
      if(det && nm && det.contains(nm)){ try{ loadProduktErfassung(); }catch(e){} }
      else {
        closeP();
        if(document.getElementById("peGrid")){ try{ loadProduktErfassung(); }catch(e){} }
        else { loadFreigabe(); if(typeof render==="function") render(); }
      }
    }, 700);
  } else {
    /* Reines Speichern: Freigabe-Zeile aktualisieren, Fenster bleibt offen. */
    try{ fePlaus(); }catch(e){}
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   RIEGEL IM ALTEN EDITOR · 27.08.2026, Ralph-Auftrag
   ----------------------------------------------------------------------------
   "kannst du deine rechenlogik, vorgehensweise von diesem neuen vorgehen in die
   alte datenerfassung übernehmen? optik soll beim alten erhalten bleiben."

   🔴 ADDITIV. Kein bestehender Handler, kein Feld, keine Speicherlogik wird
   angefasst. Der Riegel hängt sich nach dem Aufbau OBEN in #feRahmen ein und
   nutzt die vorhandenen Editor-Farben und Kartenformen.
   🔴 KEINE ZWEITE WAHRHEIT. Die zehn Prüfungen und die Aufgabenliste kommen aus
   webseite/riegel-kern.js — derselben Datei, die auch die neue Erfassungsseite
   lädt. Hier steht nur die Anzeige.
   🔴 LESEND. Der Riegel schreibt nichts. Zum Erledigen führen die vorhandenen
   Wege (gelber Kasten, Karten) bzw. die neue Seite.
   ══════════════════════════════════════════════════════════════════════════ */
function feRiegelBox(){
  var b=document.getElementById("feRiegelBox");
  if(b) return b;
  var rahmen=document.getElementById("feRahmen");
  if(!rahmen) return null;
  b=document.createElement("div");
  b.id="feRiegelBox";
  b.style.cssText="grid-column:1/-1;margin:0 0 8px 0;font-size:12.5px";
  rahmen.insertBefore(b, rahmen.firstChild);
  return b;
}

async function feRiegelLauf(pid, voll){
  pid = pid || (window._fgEdit && window._fgEdit.id);
  var box = feRiegelBox();
  if(!box || !pid) return;
  if(typeof RIEGEL === "undefined"){
    box.innerHTML = '<div style="padding:7px 10px;border-radius:8px;background:var(--k-fdf3d7,#fdf3d7);'
      + 'border:1px solid var(--k-e0a32e,#e0a32e)">Prüf-Kern nicht geladen (riegel-kern.js fehlt im HTML).</div>';
    return;
  }
  box.innerHTML = '<div style="padding:7px 10px;color:var(--muted)">' + (voll ? 'Riegel prüft alle Achsen …' : 'Riegel misst …') + '</div>';
  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  try{
    /* Selbstpruefung Punkt 3: beim Oeffnen nur die zwei billigen Achsen.
       Die volle Pruefung (sechs Abfragen) laeuft erst auf Klick. */
    var d = await RIEGEL.messen(client, pid, {schnell: !voll});
    var z = RIEGEL.zaehler(d);
    var A = RIEGEL.aufgaben(d);
    var befunde = voll ? await RIEGEL.pruefen(d, client) : null;
    var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
    var ms = Math.round(t1 - t0);
    var ok = voll ? (befunde.length === 0) : (A.length === 0);
    var farbe = ok ? {bg:"#e6f4ea", rand:"#2e9e57"} : {bg:"#fde8e4", rand:"#cf5442"};
    var kopf = voll
      ? (ok ? ('✓ Riegel: ' + RIEGEL.ANZAHL + ' von ' + RIEGEL.ANZAHL + ' Prüfungen bestanden')
            : ('✗ Riegel: ' + befunde.length + ' Befund' + (befunde.length===1?'':'e')))
      : (ok ? '✓ Nichts offen' : ('⚠ ' + A.length + ' Aufgabe' + (A.length===1?'':'n') + ' offen'));
    var h = '<div style="background:'+farbe.bg+';border:1px solid '+farbe.rand+';border-radius:10px;padding:8px 12px">'
      + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
      + '<b>' + kopf + '</b>'
      + '<span style="color:#55507a">' + z.mit + '/' + z.n + ' Zutaten mit Note und Regel'
      + (z.l0 ? (' · ' + z.l0 + ' bewusst offen') : '')
      + (z.offen ? (' · ' + z.offen + ' Etikettzeile' + (z.offen===1?'':'n') + ' nicht zugeordnet') : '')
      + '</span>'
      + '<span style="color:#8a85ad;font-size:11px">' + ms + ' ms' + (voll ? ' · volle Prüfung' : ' · Schnellmessung') + '</span>';
    if(A.length)
      h += '<button type="button" onclick="feRiegelKlappe()" style="padding:3px 10px;'
        + 'border:1px solid ' + farbe.rand + ';border-radius:6px;background:#fff;cursor:pointer;font:inherit;font-size:12px">'
        + A.length + ' Aufgabe' + (A.length===1?'':'n') + ' anzeigen</button>';
    if(!voll)
      h += '<button type="button" onclick="feRiegelLauf(null,true)" style="margin-left:auto;padding:3px 10px;'
        + 'border:1px solid ' + farbe.rand + ';border-radius:6px;background:#fff;cursor:pointer;font:inherit;font-size:12px" '
        + 'title="Prüft zusätzlich Zusatzstoffe, Wirkstoffe, Nährwerte, Zwillinge und die Lesestabilität (vier weitere Abfragen).">'
        + 'alle Achsen prüfen</button>';
    h += '</div>';
    h += '<div id="feRiegelListe" style="display:none;margin-top:8px">';
    if(A.length){
      /* Binden, Riki-Kette und "keine Zutat" kann der alte Editor laengst.
         Was ihm fehlte: Zwillinge aufloesen und einen Befund uebergeben -
         beides hier, in einem NEUEN Bereich, ohne bestehende Ansicht anzufassen. */
      h += '<ol style="margin:0 0 0 18px;padding:0">';
      A.forEach(function(a){
        h += '<li style="margin:6px 0"><b>' + esc(a.titel) + '</b><br>'
          + '<span style="color:#55507a">' + esc(a.was || "") + '</span>';
        if(a.typ === "zwilling" && a.rows && a.rows.length > 1){
          /* Selbstpruefung 8+9: beliebig viele Zeilen, und ZUSAMMENFUEHREN
             statt Loeschen - Rohtext und Anteil der entfernten Zeile wandern
             in die bleibende, sofern dort leer. */
          var _ids = a.rows.map(function(r){ return String(r.produkt_zutat_id); }).join('|');
          h += '<div style="margin-top:3px">' + a.rows.map(function(rB){
            return '<button type="button" class="fgOffBtn" style="margin-right:5px" '
              + 'onclick="feRiegelZwilling(\'' + esc(String(rB.produkt_zutat_id)) + '\',\''
              + esc(_ids) + '\',\''
              + esc(String(rB.sichtbarer_name || "").replace(/'/g, "\\'")) + '\',this)">'
              + '„' + esc(String(rB.sichtbarer_name || "")) + '" behalten</button>';
          }).join('') + '</div>';
        }
        if(a.typ === "luecke" && a.r){
          h += '<div style="margin-top:3px"><a href="pruefblatt.html?p=' + encodeURIComponent(pid)
            + '" target="_blank" style="font-size:12px">Brücke im Aufgabenmodus setzen →</a></div>';
        }
        if(a.typ === "etikett"){
          h += '<div style="margin-top:3px"><button type="button" class="fgOffBtn" '
            + 'onclick="try{document.getElementById(\'fgOffBox\').scrollIntoView({block:\'center\'})}catch(e){}">'
            + 'zur Zeile springen</button></div>';
        }
        h += '</li>';
      });
      h += '</ol>';
      h += '<div style="margin-top:6px"><a href="pruefblatt.html?p=' + encodeURIComponent(pid) + '" target="_blank" '
        + 'style="font-size:12px">Aufgabenmodus öffnen (alle Wege auf einer Seite) →</a></div>';
    }else{
      h += '<div style="color:#55507a">Keine ableitbare Aufgabe.</div>';
    }
    if(voll && befunde && befunde.length){
      h += '<div style="margin-top:8px"><b>Befunde des Riegels</b><ul style="margin:4px 0 0 18px;padding:0">'
        + befunde.map(function(b){ return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
    }
    h += '</div></div>';
    box.innerHTML = h;
  }catch(e){
    console.error("[Riegel im Editor]", e);
    box.innerHTML = '<div style="padding:7px 10px;border-radius:8px;background:#fdf3d7;border:1px solid #e0a32e">'
      + 'Riegel konnte nicht messen: ' + esc(String((e && e.message) || e)) + '</div>';
  }
}
function feRiegelKlappe(){
  var l=document.getElementById("feRiegelListe");
  if(l) l.style.display = (l.style.display==="none") ? "block" : "none";
}
if(typeof window!=="undefined"){
  window.feRiegelLauf=feRiegelLauf; window.feRiegelKlappe=feRiegelKlappe;
}

/* Zwilling im alten Editor aufloesen - gleicher Serverweg wie die neue Seite
   (zeilengenaues Loeschen mit Grundpflicht und Audit-Sicherung). */
async function feRiegelZwilling(pzidBleibt, alleIds, nameBleibt, btn){
  var weg = String(alleIds||"").split("|").filter(function(x){ return x && x!==pzidBleibt; });
  if(!weg.length) return;
  if(!confirm('Zusammenführen:\n\nBLEIBT:       '+nameBleibt+' ('+pzidBleibt+')\n'
    +'WIRD VEREINT: '+weg.join(', ')
    +'\n\nFehlende Angaben (Rohtext, Anteil, Quelle) werden übernommen, die Zeilen im Audit gesichert. Fortfahren?')) return;
  if(btn){ btn.disabled=true; btn.textContent='führt zusammen …'; }
  try{
    for(var i=0;i<weg.length;i++){
      var r=await client.rpc("cb_admin_produkt_zutat_zwilling_zusammenfuehren",
        {p_behalten:pzidBleibt, p_entfernen:weg[i],
         p_grund:'Doppelzeile zu "'+nameBleibt+'" - Etikett und Referenzprüfung, zusammengeführt im Editor-Riegel.'});
      if(r&&r.error) throw r.error;
    }
    await feRiegelLauf(null, true);
    var l=document.getElementById("feRiegelListe"); if(l) l.style.display="block";
    var pid=(window._fgEdit&&window._fgEdit.id);
    if(pid && typeof openFgEditor==="function" &&
       confirm('Zusammengeführt. Editor neu laden, damit die Zutatenliste stimmt?')) openFgEditor(pid);
  }catch(e){
    console.error("[Riegel Zwilling]",e);
    alert("Zusammenführen fehlgeschlagen: "+((e&&e.message)||e));
    if(btn){ btn.disabled=false; btn.textContent='erneut versuchen'; }
  }
}

/* Stamm-Luecke als Work Item an ChatGPT - der gemessene Befund geht in die
   Queue statt in Ralphs Gedaechtnis. */
async function feRiegelUebergeben(pzid, name, art, btn){
  var pid=(window._fgEdit&&window._fgEdit.id)||"";
  if(!confirm('Befund an ChatGPT übergeben?\n\nZutat: '+name+'\nProdukt: '+pid+'\nLücke: '+art)) return;
  if(btn){ btn.disabled=true; btn.textContent='übergibt …'; }
  try{
    var r=await client.rpc("cb_admin_agent_work_setzen",{
      p_actor:'claude', p_owner:'chatgpt', p_area:'zutaten-bewertung',
      p_title:('Stamm-Luecke aus Editor-Riegel: "'+name+'" ('+pid+') - '+art).slice(0,120),
      p_description:('Gemessen im Produkteditor: Zeile '+pzid+' an Produkt '+pid+' hat keine Note. Luecke: '+art
        +'. Behebung liegt am Stamm (Bruecke/Beleg/Regel) und damit bei ChatGPT.').slice(0,590),
      p_acceptance_criteria:'Zeile '+pzid+' zeigt in v_product_ingredient_rating_resolution Note+Regel oder eine benannte Disposition.',
      p_product_id:pid, p_priority:80});
    if(r&&r.error) throw r.error;
    if(btn){ btn.textContent='✓ Work #'+((r&&r.data)||'?')+' angelegt'; }
  }catch(e){
    console.error("[Riegel Uebergabe]",e);
    alert("Übergabe fehlgeschlagen: "+((e&&e.message)||e));
    if(btn){ btn.disabled=false; btn.textContent='erneut versuchen'; }
  }
}
if(typeof window!=="undefined"){
  window.feRiegelZwilling=feRiegelZwilling; window.feRiegelUebergeben=feRiegelUebergeben;
}

/* ════════════════════════════════════════════════════════════════════════════
   ZUTATENKETTE AUFBRECHEN · 28.08.2026, Ralph-Ziel
   "zutatenkette aufbrechen als einzelzutaten, zutaten die im stamm sind
    bewerten, im stamm fehlende anzeigen mit vorschlaege."
   Erst Trockenlauf (zeigt nur), dann auf Bestaetigung scharf. Die gesamte
   Fachlogik steht im Server (cb_admin_zutatenkette_aufloesen) - hier nur
   Knopf, Rueckfrage und Bericht. Nichts wird geraten: mehrdeutige oder
   unbekannte Namen bleiben stehen und werden benannt.
   ══════════════════════════════════════════════════════════════════════════ */
async function fgKetteAufbrechen(btn){
  var pid=(window._fgEdit&&window._fgEdit.id); if(!pid) return;
  var msg=document.getElementById("fgKetteMsg");
  if(btn){ btn.disabled=true; }
  if(msg) msg.textContent="Trockenlauf: zerlege die Klammerzeilen …";
  try{
    var r=await client.rpc("cb_admin_zutatenkette_aufloesen",{p_produkt_id:pid, p_ausfuehren:false});
    if(r&&r.error) throw r.error;
    var d=r&&r.data||{};
    var offen=(d.offen||[]).map(function(o){
      return o.blatt+(o.treffer>1?(" ("+o.treffer+" Treffer - bitte selbst waehlen)"):" (nicht im Stamm)"); });
    /* M3a, 29.08.2026: eine gebundene Zutat KANN im Stamm stehen und trotzdem
       unbewertet sein - "geräuchertes Speisesalz" bindet sauber an Rauchsalz,
       und Rauchsalz hat keine Note. Gemessen: 926 von 2568 Stammzutaten sind
       unbewertet. Frueher verschwand so eine Zeile aus der Offen-Liste und sah
       fertig aus. Der Server liefert sie jetzt unter ohne_note mit; sie wird
       hier genannt, damit das Binden nicht mehr aussieht als waere es fertig. */
    var ohneNote=(d.ohne_note||[]).map(function(o){ return o.canonical||o.blatt; });
    var txt=d.etikettzeilen+" Klammerzeile(n) ergeben "+(d.gebunden_anzahl+d.offen_anzahl)+" Einzelzutaten.\n\n"
      +"Automatisch erfassbar: "+d.gebunden_anzahl+"\n"
      +"Bleibt offen: "+d.offen_anzahl+(offen.length?("\n  · "+offen.join("\n  · ")):"")
      +(ohneNote.length?("\n\nWird gebunden, hat aber KEINE Bewertung im Stamm: "
        +ohneNote.length+"\n  · "+ohneNote.join("\n  · ")
        +"\n(Diese Zutaten zaehlen erst mit, wenn sie eine Note haben.)"):"")
      +"\n\nJetzt ausfuehren?";
    if(!confirm(txt)){ if(msg) msg.textContent="abgebrochen"; if(btn) btn.disabled=false; return; }
    if(msg) msg.textContent="breche auf und erfasse …";
    var r2=await client.rpc("cb_admin_zutatenkette_aufloesen",{p_produkt_id:pid, p_ausfuehren:true});
    if(r2&&r2.error) throw r2.error;
    var d2=r2&&r2.data||{};
    if(msg) msg.textContent="✓ "+d2.gebunden_anzahl+" Zutaten erfasst"
      +(d2.offen_anzahl?(" · "+d2.offen_anzahl+" bleiben offen: "
        +(d2.offen||[]).map(function(o){return o.blatt;}).join(", ")):" · nichts offen")
      +(d2.ohne_note_anzahl?(" · "+d2.ohne_note_anzahl+" ohne Bewertung im Stamm: "
        +(d2.ohne_note||[]).map(function(o){return o.canonical||o.blatt;}).join(", ")):"")
      +" – Editor wird neu geladen.";
    if(typeof openFgEditor==="function") setTimeout(function(){ openFgEditor(pid); }, 600);
  }catch(e){
    console.error("[Kette aufbrechen]",e);
    if(msg) msg.textContent="Fehlgeschlagen: "+((e&&e.message)||e);
    if(btn) btn.disabled=false;
  }
}
if(typeof window!=="undefined"){ window.fgKetteAufbrechen=fgKetteAufbrechen; }

/* ============================================================================
   MASCHINE IM KOPFBAND  (Ralph 09.09.2026, #217; 10.09.: 8 Stationen statt 27, Ralph A)
   8 Stationen als Punkte: Eingang, Gelesen, Herkunft, Zerlegt, Gebunden, Bewertet,
   Waechter, Freigegeben. Messung: cb_produkt_leiste fasst cb_produkt_maschine_stand
   (27 Kaesten, dieselbe Regel wie das Kern-Poster) zusammen - nichts wird hier gerechnet. Klick auf einen Punkt: Popup mit Grund und Knoepfen, die nur
   vorhandene Werkzeuge rufen (E48): Anstossen, Websuche mit Riki, Neu messen.
   ========================================================================== */
window._feMaschine=null;
async function feMaschineLauf(){
  const id=window._fgEdit&&window._fgEdit.id; if(!id) return;
  const btn=document.getElementById("feMaschineBtn"), box=document.getElementById("feMaschineDots");
  if(btn) btn.disabled=true; if(box) box.innerHTML='<span class="fkbMaschineLeer">misst…</span>';
  try{
    const {data,error}=await client.rpc("cb_produkt_leiste",{p_id:id});
    if(error) throw error;
    const r=(typeof data==="string")?JSON.parse(data):data;
    if(!r||r.ok===false) throw new Error((r&&r.grund)||"keine Antwort");
    window._feMaschine=r; feMaschineRender();
  }catch(e){ if(box) box.innerHTML='<span class="fkbMaschineLeer">Messung fehlgeschlagen: '+esc((e&&e.message)||String(e))+'</span>'; }
  if(btn) btn.disabled=false;
}
function feMaschineRender(){
  const r=window._feMaschine, box=document.getElementById("feMaschineDots"); if(!r||!box) return;
  const ks=(r.kaesten||[]).slice().sort((a,b)=>(a.rang||0)-(b.rang||0));
  box.innerHTML=ks.map((k,i)=>'<span class="fkbDot fkbDot-'+esc(k.status||"leer")+'" data-i="'+i+'" title="'+esc((k.rang||"")+" "+(k.titel||"")+(k.notiz?" - "+k.notiz:""))+'" onclick="feMaschinePopup('+i+')">'+esc(k.titel||String(k.rang||""))+'</span>').join("")
    +'<span class="fkbMaschineSumme">'+(r.durch||0)+' durch · <b>'+(r.haengt||0)+' hängt</b> · '+(r.uebersprungen||0)+' nicht auf dem Weg</span>';
}
const FE_MASCHINE_TIPP={
  eingang:"Wie das Produkt hereinkam: Barcode, Foto oder Link. Haengt es hier, ist der Auftrag nicht fertig - 'Anstossen'.",
  gelesen:"Wortlaut und Naehrwerte da? Quellen: Portale (OFF, dm, EDEKA), Foto, Herstellerseite. Ohne EAN kann Riki im Web suchen (~3 ct).",
  herkunft:"Keine belegte Herkunft (Etikett, Portal oder Herstellerseite).",
  zerlegt:"Kein Zutaten-Wortlaut - Zutatenliste fotografieren oder Quelle holen.",
  gebunden:"Zutaten nicht alle an den Stamm gebunden oder Stammzutat ohne Note - in 'Zutaten & Referenz' loesen.",
  bewertet:"Kein vollstaendiger Score - meist fehlen Naehrwerte oder Bindungen.",
  waechter:"Ein Waechter meldet: Belegpruefung, Naehrwerte, Dublette. Befund im Freigabe-Check unten links.",
  frei:"Nicht freigegeben - der Freigabe-Check unten links nennt die Blocker.",
  ein_ean:"Kein Barcode am Auftrag. Normalweg ist der Scan; ohne Barcode geht es nur ueber 'Produkt hat keinen Barcode'.",
  off:"Barcode ist nicht in den Portalen (OFF, dm, EDEKA). Websuche greift nur ohne EAN.",
  offd:"Open Food Facts kennt den Barcode nicht oder liefert keine Zutaten.",
  adr:"Es fehlt eine Adresse (Produktlink). Ohne EAN kann Riki im Web suchen - kostet ca. 3 Cent.",
  herst:"Herstellerseite noch nicht gelesen. 'Anstossen' liest die Seite sofort, wenn ein Link da ist.",
  quelle:"Keine belegte Herkunft (Etikett, Portal oder Herstellerseite).",
  zerl:"Kein Zutaten-Wortlaut da - Zutatenliste fotografieren oder Quelle holen.",
  bindung:"Zutaten nicht alle an den Stamm gebunden - in Station 3 'Zutaten & Referenz' loesen.",
  ohnenote:"Stammzutat ohne Bewertung - Zutaten-Stamm (Regelwerk).",
  bew:"Kein Score - meist fehlen Naehrwerte oder Bindungen.",
  naehr:"Naehrwerte fehlen oder Waechter meldet einen Treffer - Station 2 oder Naehrwerttabelle fotografieren.",
  nachlauf:"Score-Nachlauf offen - laeuft im Takt (w217-ballast-nachrechnen).",
  sperre:"Waechter blockiert - Befund im Freigabe-Check unten links.",
  frei:"Nicht freigegeben - Freigabe-Check unten links nennt die Blocker.",
  ausgabe:"Produkt ist nicht Aktiv - erst Freigabe."
};
function feMaschinePopup(i){
  const r=window._feMaschine; if(!r) return; const ks=(r.kaesten||[]).slice().sort((a,b)=>(a.rang||0)-(b.rang||0)); const k=ks[i]; if(!k) return;
  let ov=document.getElementById("feMaschineOv");
  if(!ov){ ov=document.createElement("div"); ov.id="feMaschineOv"; ov.onclick=function(e){ if(e.target===ov) ov.style.display="none"; }; document.body.appendChild(ov); }
  const farbe={durch:"#22c55e",haengt:"#eab308",uebersprungen:"#6b7280"}[k.status]||"#6b7280";
  const wort={durch:"durch",haengt:"hängt",uebersprungen:"nicht auf dem Weg"}[k.status]||"nicht gemessen";
  const tipp=FE_MASCHINE_TIPP[k.kasten_id]||"";
  const ohneEan=!r.ean, ohneLink=!r.produktlink;
  let kn='';
  if(k.status==="haengt"){
    kn+='<button type="button" onclick="feMaschineAktion(\'anstossen\')">▶ Anstoßen</button>';
    if(["gelesen","herkunft","zerlegt","foto","adr","herst","quelle","zerl","off","offd"].includes(k.kasten_id) && ohneEan && ohneLink) kn+='<button type="button" onclick="feMaschineAktion(\'websuche\')">🔎 Websuche mit Riki (~3 ct)</button>';
    if(["zerlegt","gebunden","bewertet","zerl","bindung","ohnenote","bew"].includes(k.kasten_id)) kn+='<button type="button" onclick="document.getElementById(\'feMaschineOv\').style.display=\'none\';feTabWechsel(3)">→ Zutaten &amp; Referenz</button>';
    if(["bewertet","naehr","bew"].includes(k.kasten_id)) kn+='<button type="button" onclick="document.getElementById(\'feMaschineOv\').style.display=\'none\';feTabWechsel(2)">→ Nährwerte</button>';
  }
  ov.innerHTML='<div class="feMaschineKarte">'
    +'<div class="feMaschineKopf"><span class="fkbDot fkbDot-'+esc(k.status||"leer")+'">'+esc(String(k.rang||""))+'</span><b>'+esc(k.titel||k.kasten_id)+'</b><span style="color:'+farbe+';font-weight:700;margin-left:auto">'+wort+'</span><button type="button" onclick="document.getElementById(\'feMaschineOv\').style.display=\'none\'" class="feMaschineX">✕</button></div>'
    +'<div class="feMaschineGrund"><b>Messung:</b> '+esc(k.notiz||"–")+'</div>'
    +(tipp?'<div class="feMaschineTipp">'+esc(tipp)+'</div>':'')
    +feMaschineVersucheHtml(k)
    +'<div class="feMaschineKnoepfe">'+kn+'<button type="button" onclick="feMaschineAktion(\'messen\')">↻ Neu messen</button></div>'
    +'<div id="feMaschineMsg" class="feMaschineMsg"></div>'
    +'</div>';
  ov.style.display="flex";
}
/* Was die Maschine schon versucht hat - und woran es hing. Ralph 09.09.: "bei den
   gelben ist mir nicht klar, was jetzt bremst". Die Antwort steht in den Abrufversuchen:
   z.B. Websuche "ambiguous - Hersteller ist Foodloose, nicht Vego". */
function feMaschineVersucheHtml(k){
  const r=window._feMaschine; const v=(r&&r.versuche)||[]; if(!v.length) return '';
  const zeig=["gelesen","herkunft","zerlegt","bewertet","adr","herst","quelle","zerl","off","offd","foto","naehr","bew"].includes(k.kasten_id) ? v.slice(0,4) : [];
  if(!zeig.length) return '';
  const korr=v.find(x=>x.marke_korrektur);
  return '<div class="feMaschineVersuche"><b>Schon versucht:</b>'
    +zeig.map(x=>'<div>· '+esc(x.wann||"")+' '+esc(x.weg||"")+' → <b>'+esc(x.status||"")+'</b>'+(x.detail?' – '+esc(x.detail):'')+'</div>').join('')
    +(korr?'<div class="feMaschineKorr">Riki meint: Hersteller ist <b>'+esc(korr.marke_korrektur)+'</b>, nicht „'+esc(r.marke||"")+'". <button type="button" onclick="feMaschineMarke(\''+esc(korr.marke_korrektur).replace(/'/g,"\\'")+'\')">Marke übernehmen</button></div>':'')
    +(r.vorrang_bis?'<div style="color:var(--muted);font-size:12px;margin-top:4px">Vorrang aktiv bis '+esc(new Date(r.vorrang_bis).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}))+' – die Takte holen dieses Produkt zuerst.</div>':'')
    +'</div>';
}
function feMaschineMarke(m){
  const f=document.getElementById("fe_marke"); if(!f) return;
  f.value=m; try{ f.dispatchEvent(new Event("input",{bubbles:true})); f.dispatchEvent(new Event("change",{bubbles:true})); }catch(e){}
  const ov=document.getElementById("feMaschineOv"); if(ov) ov.style.display="none";
  try{ feTabWechsel(1); }catch(e){}
  const msg=document.getElementById("fe_msg"); if(msg){ msg.style.color="var(--k-b45309)"; msg.textContent="Marke auf „"+m+"“ gesetzt – jetzt Speichern, dann „Websuche mit Riki“ im Maschinen-Popup."; }
}
async function feMaschineAktion(was){
  const id=window._fgEdit&&window._fgEdit.id; if(!id) return;
  const m=document.getElementById("feMaschineMsg"); const say=t=>{ if(m) m.innerHTML=t; };
  try{
    if(was==="anstossen"){
      say("⏳ stößt an…");
      const {data,error}=await client.rpc("cb_produkt_maschine_anstossen",{p_id:id}); if(error) throw error;
      const r=(typeof data==="string")?JSON.parse(data):data;
      say((r&&r.ok?"✅ ":"⚠ ")+esc((r&&r.hinweis)||(r&&r.grund)||""));
    }else if(was==="websuche"){
      say("⏳ Riki sucht (bis 60 s)…");
      const {data,error}=await client.rpc("cb_produkt_websuche_jetzt",{p_id:id}); if(error) throw error;
      const r=(typeof data==="string")?JSON.parse(data):data;
      if(!r||r.ok===false){ say("⚠ "+esc((r&&r.grund)||"nicht gesucht")); return; }
      const b=((r.ergebnis||{}).beispiele||[])[0]||{};
      say("✅ gesucht: "+esc(b.status||"?")+(b.url?" · "+esc(b.url):"")+(b.ean?" · EAN "+esc(b.ean):"")+" · Kosten "+esc(String((r.ergebnis||{}).kosten_usd||0))+" $");
    }
    say((m&&m.innerHTML||"")+"<br>↻ messe neu…");
    await feMaschineLauf();
    const ov=document.getElementById("feMaschineOv"); if(ov) ov.style.display="none";
  }catch(e){ say("Fehler: "+esc((e&&e.message)||String(e))); }
}
if(typeof window!=="undefined"){ window.feMaschineLauf=feMaschineLauf; window.feMaschinePopup=feMaschinePopup; window.feMaschineAktion=feMaschineAktion; }
