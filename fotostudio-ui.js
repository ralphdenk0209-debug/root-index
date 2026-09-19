/* Das Fotostudio rendert exportfähiges SVG mit aufgelösten Farben.
   Achsen und Obergrenzen entsprechen der Produktdarstellung; Werte kommen unverändert
   aus Suche und v_web_produkte. Der Block speichert keine Produktdaten. */
var _fsSel={l:null,r:null};
var _fsTreffer={l:[],r:[]};
var _fsOpt={grund:'weiss', beschriftung:true, px:1600, format:'frei'};
/* Instagram-Stil (instagram/STIL.md): Startseiten-Gruen als Verlauf, Creme-Schrift, 1080x1080. */
var FS_INSTA={gruen1:'#263e27', gruen2:'#2c462e', creme:'#F3EEDC', px:1080};
function fsAufGruen(){ return _fsOpt.grund==='gruen' || _fsOpt.format==='insta'; }
var _fsFoto={l:null,r:null};   /* Produktfoto je Seite, nur im Browser, wird nirgends gespeichert */

/* Instagram-Produktbild 1080x1080: Foto gross oben, unten klein die Karte mit Flux,
   Name, Note und Fuellstand der vier Achsen - dieselben Werte und Obergrenzen wie fsTafel. */
function fsZeilen(s,max,n){ var w=String(s||'').split(/\s+/), z=[], a='';
  w.forEach(function(x){ if((a+' '+x).trim().length>max && a){ z.push(a); a=x; } else a=(a+' '+x).trim(); });
  if(a) z.push(a); if(z.length>n){ z=z.slice(0,n); z[n-1]=z[n-1].replace(/.?$/,'…'); } return z; }
function fsInstaProdukt(p, foto){
  var F='font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"', C=FS_INSTA.creme, CM='rgba(243,238,220,0.62)';
  var o='<rect x="0" y="0" width="1080" height="1080" fill="url(#fsG)"/>'
    +'<text x="1044" y="42" text-anchor="end" '+F+' font-size="20" fill="rgba(243,238,220,0.5)">@root_index.de</text>';
  o+= foto ? '<image href="'+foto+'" x="60" y="60" width="960" height="700" preserveAspectRatio="xMidYMid meet"/>'
           : '<rect x="60" y="60" width="960" height="700" rx="28" fill="none" stroke="rgba(243,238,220,0.25)" stroke-width="3" stroke-dasharray="14 10"/>'
             +'<text x="540" y="420" text-anchor="middle" '+F+' font-size="34" fill="rgba(243,238,220,0.45)">Produktfoto wählen</text>';
  o+='<rect x="60" y="790" width="960" height="230" rx="28" fill="rgba(10,23,16,0.74)" stroke="rgba(124,255,155,0.25)" stroke-width="2"/>';
  if(!p) return o+'<text x="540" y="915" text-anchor="middle" '+F+' font-size="26" fill="'+CM+'">Kein Produkt gewählt</text>';
  var s=fsNum(p.clean_score);
  var A=[
    {t:'Zutaten',      v:fsNum(p.p_zutaten),      max:30, f:'#16a34a'},
    {t:'Zusatzstoffe', v:fsNum(p.p_zusatzstoffe), max:15, f:'#3987e5'},
    {t:'Verarbeitung', v:fsNum(p.p_nova),         max:15, f:'#7c6fe0'},
    {t:'Nährwerte',    v:(fsNum(p.p_naehrwert)!=null ? fsNum(p.p_naehrwert)*2 : null), max:40, f:'#d97706'}
  ].map(function(a){ a.pct=(a.v==null)?null:Math.max(0,Math.min(1,a.v/a.max)); return a; });
  /* Flux-Ring: gleiche Geometrie wie fsTafel, verkleinert */
  var bahn=['M26 34 H74 L106 64','M274 34 H226 L194 64','M26 142 H74 L106 112','M274 142 H226 L194 112'];
  var kap=[[26,34],[274,34],[26,142],[274,142]], L=92, ringF=(s==null)?'#C9D1CC':fsNoteFarbe(p.bewertung);
  o+='<g transform="translate(78,824) scale(0.9)"><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">'
    + bahn.map(function(d){ return '<path d="'+d+'" stroke="rgba(243,238,220,0.14)"/>'; }).join('')
    + A.map(function(a,i){ var off=(a.pct==null)?L:L*(1-a.pct); return '<path d="'+bahn[i]+'" stroke="'+(a.pct==null?'rgba(243,238,220,0.3)':a.f)+'" stroke-dasharray="'+L+'" stroke-dashoffset="'+off.toFixed(1)+'"/>'; }).join('')
    +'</g>'+A.map(function(a,i){ return '<circle cx="'+kap[i][0]+'" cy="'+kap[i][1]+'" r="7" fill="'+(a.pct==null?'#9aa7a0':a.f)+'"/>'; }).join('')
    +'<circle cx="150" cy="88" r="42" fill="#0A1710" stroke="'+ringF+'" stroke-width="5"/>'
    +'<text x="150" y="102" text-anchor="middle" '+F+' font-size="'+((s!=null&&Math.round(s)>=100)?32:40)+'" font-weight="800" fill="'+C+'">'+(s==null?'–':String(Math.round(s)))+'</text></g>';
  var nz=fsZeilen(p.name,18,3), y=866;
  nz.forEach(function(z,k){ o+='<text x="370" y="'+(y+k*32)+'" '+F+' font-size="26" font-weight="800" fill="'+C+'">'+fsXml(z)+'</text>'; });
  y+=nz.length*32;
  if(p.marke) o+='<text x="370" y="'+(y+2)+'" '+F+' font-size="21" fill="'+CM+'">'+fsXml(p.marke)+'</text>';
  o+='<text x="370" y="'+(y+42)+'" '+F+' font-size="24" font-weight="800" fill="'+fsNoteFarbe(p.bewertung)+'">'+fsXml(p.bewertung||'keine Note')+'</text>';
  A.forEach(function(a,i){ var yy=858+i*38;
    o+='<text x="690" y="'+(yy+7)+'" '+F+' font-size="19" fill="rgba(243,238,220,0.8)">'+a.t+'</text>'
      +'<rect x="835" y="'+(yy-5)+'" width="100" height="11" rx="5.5" fill="rgba(243,238,220,0.14)"/>'
      +(a.pct==null?'':'<rect x="835" y="'+(yy-5)+'" width="'+(100*a.pct).toFixed(1)+'" height="11" rx="5.5" fill="'+a.f+'"/>')
      +'<text x="996" y="'+(yy+7)+'" text-anchor="end" '+F+' font-size="19" font-weight="700" fill="'+C+'">'+(a.v==null?'–':(Math.round(a.v)+'/'+a.max))+'</text>';
  });
  return o;
}
function fsInstaSvg(seiten){
  var defs='<defs><linearGradient id="fsG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+FS_INSTA.gruen1+'"/><stop offset="1" stop-color="'+FS_INSTA.gruen2+'"/></linearGradient></defs>';
  if(seiten!=='beide') return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">'+defs+fsInstaProdukt(_fsSel[seiten],_fsFoto[seiten])+'</svg>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2200 1080" width="2200" height="1080">'+defs
    +fsInstaProdukt(_fsSel.l,_fsFoto.l)+'<g transform="translate(1120,0)">'+fsInstaProdukt(_fsSel.r,_fsFoto.r)+'</g></svg>';
}
/* Foto laden und auf hoechstens 1400 px verkleinern; PNG behaelt die Transparenz. */
function fsFotoLaden(seite, input){
  var d=input&&input.files&&input.files[0]; if(!d) return;
  var r=new FileReader();
  r.onload=function(){ var i=new Image(); i.onload=function(){
      var k=Math.min(1,1400/Math.max(i.width,i.height)), c=document.createElement('canvas');
      c.width=Math.round(i.width*k); c.height=Math.round(i.height*k); c.getContext('2d').drawImage(i,0,0,c.width,c.height);
      _fsFoto[seite]=c.toDataURL('image/png'); fsBuehneZeichnen(); };
    i.src=r.result; };
  r.readAsDataURL(d);
}
function fsFotoWeg(seite){ _fsFoto[seite]=null; fsBuehneZeichnen(); }

function fsNum(v){ if(v===null||v===undefined||v==='') return null; var n=Number(v); return isFinite(n)?n:null; }
/* Farbwert einer CSS-Variablen zur Laufzeit aufloesen (wegen Hell-/Dunkelmodus).
   Faellt sie aus, gilt der Wert, der im Namen steckt (--k-16a34a -> #16a34a). */
function fsVar(n,fb){ try{ var v=getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v||fb; }catch(e){ return fb; } }
function fsNoteFarbe(b){
  /* Auf Gruen sind die Standardfarben zu dunkel - hellere Stufen, gleiche Reihenfolge. */
  if(fsAufGruen()) return ({'Sehr gut':'#7CFF9B','Gut':'#B8E36B','Mittel':'#FFB347','Schwach':'#FF7A7A'})[b]||'#C9D1CC';
  if(b==='Sehr gut') return fsVar('--k-16a34a','#16a34a');
  if(b==='Gut')      return fsVar('--k-65a30d','#65a30d');
  if(b==='Mittel')   return fsVar('--k-e8920c','#e8920c');
  if(b==='Schwach')  return fsVar('--k-dc2626','#dc2626');
  return fsVar('--k-9aa7a0','#9aa7a0');
}
function fsXml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* Eine Tafel: Flux-Ring plus Beschriftung, als SVG-Gruppe in einem 340x250-Feld. */
function fsTafel(p, dx, dy){
  var tinte=fsAufGruen()?FS_INSTA.creme:fsVar('--ink','#1d3c24'), grau=fsAufGruen()?'rgba(243,238,220,0.65)':fsVar('--muted','#6b6256');
  if(!p){
    return '<g transform="translate('+dx+','+dy+')">'
      +'<text x="170" y="120" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" fill="'+grau+'">Kein Produkt gewählt</text></g>';
  }
  var s=fsNum(p.clean_score);
  var A=[
    {v:fsNum(p.p_zutaten),      max:30, f:'#16a34a'},
    {v:fsNum(p.p_zusatzstoffe), max:15, f:'#3987e5'},
    {v:fsNum(p.p_nova),         max:15, f:'#7c6fe0'},
    {v:(fsNum(p.p_naehrwert)!=null ? fsNum(p.p_naehrwert)*2 : null), max:40, f:'#d97706'}
  ].map(function(a){ a.pct=(a.v==null)?null:Math.max(0,Math.min(1,a.v/a.max)); return a; });
  var bahn=['M26 34 H74 L106 64','M274 34 H226 L194 64','M26 142 H74 L106 112','M274 142 H226 L194 112'];
  var kap=[[26,34],[274,34],[26,142],[274,142]];
  var L=92, ringF=(s==null)?fsVar('--k-9aa7a0','#9aa7a0'):fsNoteFarbe(p.bewertung);
  var g='<g transform="translate('+dx+','+dy+')">'
    +'<g transform="translate(20,0)">'
      +'<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="9">'
      + bahn.map(function(d){ return '<path d="'+d+'" stroke="'+(fsAufGruen()?'rgba(243,238,220,0.14)':'rgba(120,120,120,0.16)')+'"/>'; }).join('')
      + A.map(function(a,i){ var off=(a.pct==null)?L:L*(1-a.pct);
          return '<path d="'+bahn[i]+'" stroke="'+(a.pct==null?'rgba(120,120,120,0.28)':a.f)+'" stroke-dasharray="'+L+'" stroke-dashoffset="'+off.toFixed(1)+'"/>'; }).join('')
      +'</g>'
      + A.map(function(a,i){ return '<circle cx="'+kap[i][0]+'" cy="'+kap[i][1]+'" r="7" fill="'+(a.pct==null?'#9aa7a0':a.f)+'"/>'; }).join('')
      +'<circle cx="150" cy="88" r="42" fill="none" stroke="'+ringF+'" stroke-width="5"/>'
      +'<text x="150" y="101" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="42" font-weight="800" fill="'+tinte+'">'+(s==null?'–':String(Math.round(s)))+'</text>'
    +'</g>';
  if(_fsOpt.beschriftung){
    var nm=String(p.name||''); if(nm.length>34) nm=nm.slice(0,33)+'…';
    var mk=String(p.marke||'');  if(mk.length>34) mk=mk.slice(0,33)+'…';
    g+='<text x="170" y="200" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="17" font-weight="700" fill="'+tinte+'">'+fsXml(nm)+'</text>';
    if(mk) g+='<text x="170" y="220" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="13" fill="'+grau+'">'+fsXml(mk)+'</text>';
    g+='<text x="170" y="242" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="15" font-weight="700" fill="'+fsNoteFarbe(p.bewertung)+'">'+fsXml(p.bewertung||'')+'</text>';
  }
  return g+'</g>';
}

/* Die ganze Buehne als eigenstaendiges SVG. seiten: 'l', 'r' oder 'beide'. */
function fsSvg(seiten){
  if(_fsOpt.format==='insta') return fsInstaSvg(seiten);
  /* Hoehe MIT Beschriftung: Ring endet bei y=196 (20 oben + 176), darunter Name 200,
     Marke 220, Note 242 - plus 26 Luft, sonst schneidet der Rand die Note an.
     OHNE Beschriftung reicht der Ring plus dieselbe Luft. Beides nachgemessen. */
  var H=_fsOpt.beschriftung?268:216;
  var eins=(seiten!=='beide');
  var W=eins?340:700;
  var inhalt = eins ? fsTafel(_fsSel[seiten], 0, 20)
                    : (fsTafel(_fsSel.l, 0, 20) + fsTafel(_fsSel.r, 360, 20));
  var defs='';
  if(fsAufGruen()) defs='<defs><linearGradient id="fsG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+FS_INSTA.gruen1+'"/><stop offset="1" stop-color="'+FS_INSTA.gruen2+'"/></linearGradient></defs>';
  var grund=(_fsOpt.grund==='weiss')?'<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#ffffff"/>'
           :(_fsOpt.grund==='gruen')?'<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="url(#fsG)"/>'
           :(_fsOpt.grund==='karte')?'<rect x="0" y="0" width="'+W+'" height="'+H+'" rx="16" fill="'+fsVar('--card','#ffffff')+'"/>':'';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+defs+grund+inhalt+'</svg>';
}

/* SVG -> PNG. Laeuft ohne Fremdbibliothek: das SVG wird als Datenadresse in ein
   Bild geladen und auf eine Leinwand gemalt. Die Breite bestimmt _fsOpt.px. */
async function fsPng(seiten){
  var msg=document.getElementById('fsMsg');
  var setz=function(t,rot){ if(msg){ msg.textContent=t; msg.style.color=rot?fsVar('--k-dc2626','#dc2626'):fsVar('--muted','#6b6256'); } };
  try{
    if(seiten==='beide' && (!_fsSel.l || !_fsSel.r)){ setz('Für ein Doppelbild müssen beide Seiten ein Produkt haben.',true); return; }
    if(seiten!=='beide' && !_fsSel[seiten]){ setz('Auf dieser Seite ist kein Produkt gewählt.',true); return; }
    if(_fsOpt.format==='insta' && seiten==='beide'){ await fsPng('l'); await fsPng('r'); return; }
    setz('Bild wird erzeugt…');
    var svg=fsSvg(seiten);
    var m=svg.match(/viewBox="0 0 (\d+) (\d+)"/), vw=Number(m[1]), vh=Number(m[2]);
    var breite=(_fsOpt.format==='insta')?FS_INSTA.px:Math.max(300, Math.round(_fsOpt.px)), hoehe=Math.round(breite*vh/vw);
    var url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    var bild=await new Promise(function(ok,fehl){ var i=new Image(); i.onload=function(){ok(i);}; i.onerror=function(){fehl(new Error('SVG nicht ladbar'));}; i.src=url; });
    var c=document.createElement('canvas'); c.width=breite; c.height=hoehe;
    var ctx=c.getContext('2d'); ctx.drawImage(bild,0,0,breite,hoehe);
    var teil=(seiten==='beide')?((_fsSel.l.id||'')+'_vs_'+(_fsSel.r.id||'')):(_fsSel[seiten].id||'produkt');
    var a=document.createElement('a');
    a.download='rootindex_'+String(teil).replace(/[^A-Za-z0-9_-]/g,'')+'_'+breite+'.png';
    a.href=c.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
    setz('Fertig: '+breite+' × '+hoehe+' px gespeichert.');
  }catch(e){ setz('Bild konnte nicht erzeugt werden: '+(e&&e.message?e.message:'unbekannt'),true); }
}

/* Suche im ganzen Katalog. Entprellt, mit Sequenz-Wache gegen spaete Antworten. */
var _fsSeq={l:0,r:0}, _fsTimer={l:null,r:null};
function fsSuche(seite, q){
  if(_fsTimer[seite]) clearTimeout(_fsTimer[seite]);
  _fsTimer[seite]=setTimeout(function(){ fsSucheLauf(seite, q); }, 280);
}
async function fsSucheLauf(seite, q){
  q=String(q||'').trim();
  var liste=document.getElementById('fsListe_'+seite); if(!liste) return;
  if(q.length<2){ _fsTreffer[seite]=[]; liste.innerHTML=''; return; }
  var seq=(++_fsSeq[seite]);
  liste.innerHTML='<div style="padding:8px 10px;font-size:12.5px;color:var(--muted)">⏳ suche…</div>';
  try{
    var r=await client.rpc('cb_produkte_suchen',{p_q:q, p_limit:12, p_offset:0});
    if(seq!==_fsSeq[seite]) return;
    if(r.error) throw r.error;
    var rows=r.data||[];
    _fsTreffer[seite]=rows;
    if(!rows.length){ liste.innerHTML='<div style="padding:8px 10px;font-size:12.5px;color:var(--muted)">Kein Treffer.</div>'; return; }
    liste.innerHTML=rows.map(function(p,i){
      return '<button onclick="fsWaehle(\''+seite+'\','+i+')" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);padding:8px 10px;font-size:13px;cursor:pointer">'
        +'<b>'+esc(p.name||'')+'</b>'+(p.marke?' <span style="color:var(--muted)">· '+esc(p.marke)+'</span>':'')
        +' <span style="color:var(--muted);font-size:11.5px">'+(p.clean_score==null?'ohne Index':('Index '+Math.round(Number(p.clean_score))))+'</span></button>';
    }).join('');
  }catch(e){
    if(seq!==_fsSeq[seite]) return;
    liste.innerHTML='<div style="padding:8px 10px;font-size:12.5px;color:var(--k-dc2626)">Suche fehlgeschlagen.</div>';
  }
}

/* Treffer uebernehmen: die vier Achsenwerte fehlen in der Suche und werden
   einzeln aus v_web_produkte nachgeladen. Ohne sie bleiben die Balken grau —
   dann fehlt der Wert wirklich, wir setzen keine Null ein. */
async function fsWaehle(seite, i){
  var t=(_fsTreffer[seite]||[])[i]; if(!t) return;
  var liste=document.getElementById('fsListe_'+seite); if(liste) liste.innerHTML='';
  var such=document.getElementById('fsQ_'+seite); if(such) such.value='';
  _fsSel[seite]={id:t.id, name:t.name, marke:t.marke, clean_score:t.clean_score, bewertung:t.bewertung};
  fsBuehneZeichnen();
  try{
    var r=await client.from('v_web_produkte')
      .select('id,name,marke,clean_score,bewertung,p_zutaten,p_zusatzstoffe,p_nova,p_naehrwert')
      .eq('id', t.id).limit(1);
    if(r.error) throw r.error;
    var p=(r.data||[])[0];
    if(p && _fsSel[seite] && _fsSel[seite].id===t.id){ _fsSel[seite]=p; fsBuehneZeichnen(); }
  }catch(e){ /* Achsen bleiben leer, der Ring zeigt trotzdem die Note */ }
}
function fsLeeren(seite){ _fsSel[seite]=null; fsBuehneZeichnen(); }
function fsTauschen(){ var x=_fsSel.l; _fsSel.l=_fsSel.r; _fsSel.r=x; fsBuehneZeichnen(); }
function fsOptSetzen(k,v){ _fsOpt[k]=(k==='px')?Number(v):v; fsBuehneZeichnen(); }
function fsOptSchalten(k,v){ _fsOpt[k]=!!v; fsBuehneZeichnen(); }

function fsBuehneZeichnen(){
  var b=document.getElementById('fsBuehne'); if(!b) return;
  /* Auf dem Schirm soll die Buehne die Breite fuellen; die festen Masse braucht nur
     der Export (dort bestimmen sie die Rasterhoehe). Darum hier herausgenommen. */
  b.innerHTML=fsSvg('beide').replace(/ width="\d+" height="\d+"/, ' style="width:100%;height:auto;display:block"');
  var kl=document.getElementById('fsGewaehlt_l'), kr=document.getElementById('fsGewaehlt_r');
  var txt=function(p){ return p?('<b>'+esc(p.name||'')+'</b>'+(p.marke?' · '+esc(p.marke):'')+' <span style="color:var(--muted)">('+esc(p.id||'')+')</span>'):'<span style="color:var(--muted)">nichts gewählt</span>'; };
  if(kl) kl.innerHTML=txt(_fsSel.l);
  if(kr) kr.innerHTML=txt(_fsSel.r);
}

function fsSeiteHtml(seite, titel){
  return '<div style="flex:1 1 300px;min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--card);padding:12px">'
    +'<div style="font-weight:800;font-size:14px;margin-bottom:8px">'+titel+'</div>'
    +'<input id="fsQ_'+seite+'" oninput="fsSuche(\''+seite+'\',this.value)" placeholder="🔍 Produkt suchen (mind. 2 Zeichen)…" '
      +'style="width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--ink);font-size:13.5px">'
    +'<div id="fsListe_'+seite+'" style="max-height:250px;overflow:auto;margin-top:6px;border-radius:9px"></div>'
    +'<div style="margin-top:10px;font-size:13px;line-height:1.5" id="fsGewaehlt_'+seite+'"></div>'
    +'<label style="display:inline-block;margin:8px 8px 0 0;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:12px;cursor:pointer">📷 Foto für Instagram'
      +'<input type="file" accept="image/*" style="display:none" onchange="fsFotoLaden(\''+seite+'\',this)"></label>'
    +'<button onclick="fsFotoWeg(\''+seite+'\')" style="margin:8px 8px 0 0;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--muted);font-size:12px;cursor:pointer">Foto weg</button>'
    +'<button onclick="fsLeeren(\''+seite+'\')" style="margin-top:8px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--muted);font-size:12px;cursor:pointer">Seite leeren</button>'
    +'</div>';
}

function fsRender(){
  var v=document.getElementById('fotoView'); if(!v) return;
  v.innerHTML='<div style="max-width:1040px;margin:0 auto">'
    +'<h2 style="font-size:20px;font-weight:800;margin:6px 0 2px">📸 Fotostudio</h2>'
    +'<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Links und rechts je ein Produkt wählen – beide zeigen ihren Root Index, wie ihn die Datenbank hat. Es wird nichts gerechnet und nichts gespeichert.</div>'
    +'<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">'
      + fsSeiteHtml('l','Linke Seite')
      + fsSeiteHtml('r','Rechte Seite')
    +'</div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0 10px">'
      +'<button onclick="fsTauschen()" style="padding:7px 11px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-size:12.5px;cursor:pointer">⇄ Seiten tauschen</button>'
      +'<label style="font-size:12.5px;color:var(--muted)">Hintergrund '
        +'<select onchange="fsOptSetzen(\'grund\',this.value)" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:12.5px">'
          +'<option value="weiss">Weiß</option><option value="transparent">Transparent</option><option value="karte">Kartenfarbe</option><option value="gruen">Grün (Instagram)</option></select></label>'
      +'<label style="font-size:12.5px;color:var(--muted)">Format '
        +'<select onchange="fsOptSetzen(\'format\',this.value)" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:12.5px">'
          +'<option value="frei">Frei (nach Breite)</option><option value="insta">Instagram-Produkt 1080 × 1080</option></select></label>'
      +'<label style="font-size:12.5px;color:var(--muted)">Breite '
        +'<select onchange="fsOptSetzen(\'px\',this.value)" style="padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:12.5px">'
          +'<option value="800">800 px</option><option value="1600" selected>1600 px</option><option value="2400">2400 px</option></select></label>'
      +'<label style="font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:6px">'
        +'<input type="checkbox" checked onchange="fsOptSchalten(\'beschriftung\',this.checked)"> Beschriftung</label>'
    +'</div>'
    +'<div id="fsBuehne" style="border:1px dashed var(--line);border-radius:12px;padding:10px;background:'
      +'repeating-conic-gradient(rgba(120,120,120,.10) 0% 25%, transparent 0% 50%) 50%/18px 18px"></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">'
      +'<button onclick="fsPng(\'beide\')" style="padding:9px 14px;border:0;border-radius:9px;background:var(--green);color:var(--auf-gruen);font-weight:700;font-size:13px;cursor:pointer">⬇ Beide als PNG</button>'
      +'<button onclick="fsPng(\'l\')" style="padding:9px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-size:13px;cursor:pointer">⬇ Nur links</button>'
      +'<button onclick="fsPng(\'r\')" style="padding:9px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-size:13px;cursor:pointer">⬇ Nur rechts</button>'
    +'</div>'
    +'<div id="fsMsg" style="margin-top:8px;font-size:12.5px;color:var(--muted);min-height:18px"></div>'
    +'<div style="margin-top:14px;font-size:11.5px;color:var(--muted);line-height:1.6">Achsen wie im Produkt: <span style="color:#16a34a">■</span> Zutaten (max 30) · <span style="color:#3987e5">■</span> Zusatzstoffe (15) · <span style="color:#7c6fe0">■</span> Verarbeitung/NOVA (15) · <span style="color:#d97706">■</span> Nährwert (20, doppelt gewichtet = 40). Ein <b>grauer</b> Balken heißt: für diese Achse liegt kein Wert vor – nicht Null.</div>'
    +'</div>';
  fsBuehneZeichnen();
}
if(typeof window!=='undefined'){
  window.fsRender=fsRender; window.fsSuche=fsSuche; window.fsWaehle=fsWaehle;
  window.fsLeeren=fsLeeren; window.fsTauschen=fsTauschen; window.fsPng=fsPng;
  window.fsOptSetzen=fsOptSetzen; window.fsFotoLaden=fsFotoLaden; window.fsFotoWeg=fsFotoWeg; window.fsOptSchalten=fsOptSchalten;
}
