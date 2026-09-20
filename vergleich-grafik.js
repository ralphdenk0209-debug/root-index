/* ---- VERGLEICHS-GRAFIK ----------------------------------------------------
   20.09.2026, Ralph: "kannst du die vorlage direkt in die seite einbauen, damit
   nur die bilder, der text, der flux usw automatisch in diesem format generiert
   wird je nach produkt?"

   Dieselbe Grafik wie instagram/vorlage-vergleich.py, nur hier im Browser auf
   einer Leinwand (canvas) statt in Python. 1080 x 1080, Stil aus STIL.md:
   Grund Verlauf #263E27 -> #2C462E, Akzent #7CFF9B, Schrift Creme #F3EEDC.

   WERTE KOMMEN AUS DER DATENBANK, NICHT VON HIER: clean_score, bewertung,
   p_zutaten/p_zusatzstoffe/p_nova/p_naehrwert und die Zutatenliste stehen in
   v_web_produkte. Gelb markiert wird, was die Datenbank mit rating < 10 fuehrt.
   Der Punkteunterschied in der Ueberschrift wird aus den gemessenen Scores
   gerechnet, nicht getippt.

   Fotos liegen im privaten Bucket; sie werden als Blob geholt, sonst waere die
   Leinwand "verunreinigt" und der Download ginge nicht. */

var VGG = {
  gruen1:"#263E27", gruen2:"#2C462E", creme:"#F3EEDC", akzent:"#7CFF9B",
  gelb:"#FFC24B", karte:"rgba(10,23,16,0.72)",
  achsen:[
    {k:"p_zutaten",      max:30, f:1, farbe:"#3DDB7A"},
    {k:"p_zusatzstoffe", max:15, f:1, farbe:"#5AB6FF"},
    {k:"p_nova",         max:15, f:1, farbe:"#B79BFF"},
    {k:"p_naehrwert",    max:40, f:2, farbe:"#FFC24B"}
  ],
  note:{ "Sehr gut":"#7CFF9B", "Gut":"#B8E36B", "Mittel":"#FFB347", "Schwach":"#FF7A7A" }
};
var VGG_LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">'
 +'<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="7.5">'
 +'<path d="M22 26 L44 26 L56 40" stroke="#3DDB7A"/><path d="M98 26 L76 26 L64 40" stroke="#5AB6FF"/>'
 +'<path d="M22 94 L44 94 L56 80" stroke="#B79BFF"/><path d="M98 94 L76 94 L64 80" stroke="#FFC24B"/></g>'
 +'<circle cx="20" cy="26" r="6.5" fill="#3DDB7A"/><circle cx="100" cy="26" r="6.5" fill="#5AB6FF"/>'
 +'<circle cx="20" cy="94" r="6.5" fill="#B79BFF"/><circle cx="100" cy="94" r="6.5" fill="#FFC24B"/>'
 +'<circle cx="60" cy="60" r="15" fill="#0A1710" stroke="#5EF2A0" stroke-width="3"/>'
 +'<circle cx="60" cy="60" r="5" fill="#7CFF9B"/></svg>';

function vggNum(v){ var n=Number(v); return isFinite(n)?n:null; }
function vggFont(groesse, fett){ return (fett?fett:400)+" "+groesse+"px Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"; }

/* Bild laden - als Blob, damit der Download der fertigen Grafik erlaubt bleibt. */
function vggBild(url){
  return new Promise(function(ok){
    if(!url) return ok(null);
    fetch(url).then(function(r){ return r.blob(); }).then(function(b){
      var u=URL.createObjectURL(b), i=new Image();
      i.onload=function(){ ok(i); }; i.onerror=function(){ ok(null); }; i.src=u;
    }).catch(function(){ ok(null); });
  });
}
function vggSvgBild(svg){
  return new Promise(function(ok){
    var i=new Image();
    i.onload=function(){ ok(i); }; i.onerror=function(){ ok(null); };
    i.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
  });
}

/* Zeilenumbruch nach gemessener Breite - nichts wird abgeschnitten. */
function vggUmbruch(ctx, woerter, breite){
  var zeilen=[], akt=[];
  woerter.forEach(function(w){
    var probe=akt.concat([w]).map(function(x){ return x.text; }).join(" · ");
    if(ctx.measureText(probe).width>breite && akt.length){ zeilen.push(akt); akt=[w]; }
    else akt.push(w);
  });
  if(akt.length) zeilen.push(akt);
  return zeilen;
}
function vggZeileMitFarben(ctx, zeile, mitte, y){
  /* Trennpunkte werden einzeln gesetzt, nicht als Teil des Wortes: fillText
     laesst fuehrende Leerzeichen weg, dadurch klebten die Namen aneinander. */
  ctx.textAlign="left";   /* Stueck fuer Stueck gesetzt - zentriert wuerde jedes Wort auf dieselbe Stelle fallen. */
  var lueck=7, sep="·", sepB=ctx.measureText(sep).width;
  var breiten=zeile.map(function(w){ return ctx.measureText(w.text).width; });
  var gesamt=breiten.reduce(function(a,b){ return a+b; },0) + (zeile.length-1)*(2*lueck+sepB);
  var x=mitte-gesamt/2;
  zeile.forEach(function(w,i){
    if(i){ ctx.fillStyle="rgba(243,238,220,.45)"; x+=lueck; ctx.fillText(sep,x,y); x+=sepB+lueck; }
    ctx.fillStyle = w.auff ? VGG.gelb : VGG.creme;
    ctx.fillText(w.text, x, y); x+=breiten[i];
  });
}

/* Flux: dieselbe Geometrie wie im Produkt, hier in Leinwand-Befehlen.
   Der Fuellstand einer Achse ist der gezeichnete Anteil der Bahn. */
function vggFlux(ctx, p, mx, my, skala){
  var bahnen=[[[26,34],[74,34],[106,64]],[[274,34],[226,34],[194,64]],[[26,142],[74,142],[106,112]],[[274,142],[226,142],[194,112]]];
  var punkte=[[26,34],[274,34],[26,142],[274,142]];
  var L=92;
  function pfad(b){ ctx.beginPath();
    ctx.moveTo(mx+b[0][0]*skala, my+b[0][1]*skala);
    ctx.lineTo(mx+b[1][0]*skala, my+b[1][1]*skala);
    ctx.lineTo(mx+b[2][0]*skala, my+b[2][1]*skala); }
  ctx.lineWidth=9*skala; ctx.lineCap="round"; ctx.lineJoin="round";
  bahnen.forEach(function(b){ pfad(b); ctx.strokeStyle="rgba(243,238,220,0.14)"; ctx.setLineDash([]); ctx.stroke(); });
  VGG.achsen.forEach(function(a,i){
    var v=vggNum(p[a.k]); v = (v==null?null:v*a.f);
    var anteil = (v==null) ? 0 : Math.max(0, Math.min(1, v/a.max));
    pfad(bahnen[i]);
    ctx.strokeStyle = (v==null) ? "rgba(243,238,220,0.3)" : a.farbe;
    ctx.setLineDash([L*skala*anteil, 100000]); ctx.stroke(); ctx.setLineDash([]);
  });
  punkte.forEach(function(pt,i){
    ctx.beginPath(); ctx.arc(mx+pt[0]*skala, my+pt[1]*skala, 7*skala, 0, Math.PI*2);
    ctx.fillStyle=VGG.achsen[i].farbe; ctx.fill();
  });
  var s=vggNum(p.clean_score), ring=VGG.note[p.bewertung]||"#C9D1CC";
  ctx.beginPath(); ctx.arc(mx+150*skala, my+88*skala, 42*skala, 0, Math.PI*2);
  ctx.fillStyle="#0A1710"; ctx.fill(); ctx.lineWidth=5*skala; ctx.strokeStyle=ring; ctx.stroke();
  ctx.fillStyle=VGG.creme; ctx.textAlign="center"; ctx.font=vggFont(Math.round(40*skala),800);
  ctx.fillText(s==null?"–":String(Math.round(s)), mx+150*skala, my+102*skala);
  ctx.textAlign="left";
}

function vggKarteRund(ctx,x,y,b,h,r,fuell,rand){
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+b,y,x+b,y+h,r); ctx.arcTo(x+b,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+b,y,r); ctx.closePath();
  if(fuell){ ctx.fillStyle=fuell; ctx.fill(); }
  if(rand){ ctx.strokeStyle=rand; ctx.lineWidth=2; ctx.setLineDash([]); ctx.stroke(); }
}

/* ---- Die Grafik ----------------------------------------------------------- */
async function vggBauen(r, pA, pB, fotoA, fotoB){
  var c=document.createElement("canvas"); c.width=1080; c.height=1080;
  var ctx=c.getContext("2d");
  var g=ctx.createLinearGradient(0,0,1080,1080); g.addColorStop(0,VGG.gruen1); g.addColorStop(1,VGG.gruen2);
  ctx.fillStyle=g; ctx.fillRect(0,0,1080,1080);

  /* Kopf */
  var logo=await vggSvgBild(VGG_LOGO);
  if(logo) ctx.drawImage(logo, 48, 44, 76, 76);
  ctx.fillStyle=VGG.creme; ctx.font=vggFont(38,800);
  ctx.fillText("Root", 136, 76); ctx.fillText("Index", 136, 116);
  ctx.font=vggFont(16,600); ctx.fillStyle="rgba(243,238,220,.7)";
  ctx.fillText("Die Vorderseite verkauft.", 48, 152);
  ctx.fillText("Wir lesen die Rückseite.", 48, 174);
  ctx.strokeStyle="rgba(243,238,220,.25)"; ctx.lineWidth=2; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(330,44); ctx.lineTo(330,186); ctx.stroke();

  ctx.font=vggFont(42,800); ctx.fillStyle=VGG.creme;
  ctx.fillText(String(r.Zeile1||"").toUpperCase(), 364, 92);
  ctx.fillStyle=VGG.akzent;
  ctx.fillText(String(r.Zeile2||"").toUpperCase(), 364, 146);

  /* Zwei Spalten */
  var spalten=[{p:pA,foto:fotoA,mitte:282},{p:pB,foto:fotoB,mitte:798}];
  for(var i=0;i<spalten.length;i++){
    var s=spalten[i], p=s.p||{}, m=s.mitte;
    if(s.foto){
      var maxB=380, maxH=300, k=Math.min(maxB/s.foto.width, maxH/s.foto.height);
      var bw=s.foto.width*k, bh=s.foto.height*k;
      ctx.drawImage(s.foto, m-bw/2, 210+(maxH-bh)/2, bw, bh);
    }else{
      ctx.setLineDash([12,9]); ctx.strokeStyle="rgba(243,238,220,.25)"; ctx.lineWidth=3;
      ctx.strokeRect(m-190, 210, 380, 300); ctx.setLineDash([]);
      ctx.textAlign="center"; ctx.fillStyle="rgba(243,238,220,.45)"; ctx.font=vggFont(20,600);
      ctx.fillText("Produktfoto fehlt", m, 365); ctx.textAlign="left";
    }
    ctx.textAlign="center";
    ctx.font=vggFont(17,600); ctx.fillStyle="rgba(243,238,220,.6)";
    ctx.fillText(String(p.marke||"").toUpperCase(), m, 552);
    ctx.font=vggFont(25,800); ctx.fillStyle=VGG.creme;
    var name=String(p.name||"");
    var zeilen=[]; var w=""; name.split(" ").forEach(function(t){
      var probe=(w?w+" ":"")+t;
      if(ctx.measureText(probe).width>430 && w){ zeilen.push(w); w=t; } else w=probe;
    }); if(w) zeilen.push(w);
    zeilen.slice(0,2).forEach(function(z,k2){ ctx.fillText(z, m, 586+k2*30); });
    /* Fester Platz fuer zwei Namenszeilen: sonst stuenden die Spalten auf
       unterschiedlicher Hoehe, sobald ein Name umbricht. */
    var yNach = 586 + 2*30;

    /* Pille */
    ctx.font=vggFont(14,700);
    var pt="IN DER ZUTATENLISTE", pb=ctx.measureText(pt).width+34;
    vggKarteRund(ctx, m-pb/2, yNach+6, pb, 30, 15, null, "rgba(124,255,155,.45)");
    ctx.fillStyle=VGG.akzent; ctx.fillText(pt, m, yNach+26);

    /* Zutaten, gelb = rating < 10 */
    ctx.font=vggFont(17,400);
    var liste=[];
    (p.zutaten||[]).forEach(function(z){
      if(!z || !z.name) return;
      liste.push({ text:String(z.name), auff:(vggNum(z.rating)!=null && vggNum(z.rating)<10) });
    });
    var zz=vggUmbruch(ctx, liste, 440);
    /* Hoechstens vier Zeilen - die fuenfte liefe in die Karte unten hinein.
       Wird gekuerzt, sagt ein Auslassungszeichen das auch. */
    if(zz.length>4){ zz=zz.slice(0,4); zz[3]=zz[3].concat([{text:"…",auff:false}]); }
    zz.forEach(function(zeile,k3){ vggZeileMitFarben(ctx, zeile, m, yNach+62+k3*24); });
    ctx.textAlign="left";
  }
  /* VS */
  ctx.strokeStyle="rgba(243,238,220,.18)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(540,215); ctx.lineTo(540,760); ctx.stroke();
  vggKarteRund(ctx, 512, 330, 56, 56, 28, VGG.gruen2, "rgba(124,255,155,.45)");
  ctx.textAlign="center"; ctx.font=vggFont(19,800); ctx.fillStyle=VGG.creme; ctx.fillText("VS", 540, 365);
  ctx.textAlign="left";

  /* Unten: je Produkt Flux und Urteil */
  [[pA,60],[pB,552],].forEach(function(paar){
    var p=paar[0]||{}, x=paar[1];
    vggKarteRund(ctx, x, 790, 468, 210, 26, VGG.karte, "rgba(124,255,155,.25)");
    vggFlux(ctx, p, x+10, 810, 0.62);
    var s=vggNum(p.clean_score), farbe=VGG.note[p.bewertung]||"#C9D1CC";
    ctx.font=vggFont(19,700); ctx.fillStyle="rgba(243,238,220,.65)";
    ctx.fillText("ROOT INDEX", x+215, 852);
    ctx.font=vggFont(46,800); ctx.fillStyle=farbe;
    ctx.fillText((s==null?"–":Math.round(s))+"/100", x+215, 903);
    ctx.font=vggFont(22,800); ctx.fillStyle=farbe;
    ctx.fillText(String(p.bewertung||"ohne Note").toUpperCase(), x+215, 940);
  });

  /* Fuss */
  ctx.font=vggFont(14,400); ctx.fillStyle="rgba(243,238,220,.7)";
  ctx.fillText("Bewertet wird die Zusammensetzung.", 60, 1026);
  ctx.fillText("Gelb = was über das Grundprodukt hinausgeht. Flux = Füllstand der vier Achsen.", 60, 1046);
  ctx.fillText("Produktfotos: Hersteller · Grafik automatisch aus der Datenbank.", 60, 1066);
  ctx.textAlign="right";
  var heute=new Date().toLocaleDateString("de-DE");
  ctx.fillText("Quellen: Root Index "+(pA&&pA.id||"?")+", "+(pB&&pB.id||"?")+" | Stand: "+heute, 1020, 1036);
  ctx.fillText("@root_index.de", 1020, 1058);
  ctx.textAlign="left";
  return c;
}

/* ---- Knopf in der Zeile ---------------------------------------------------- */
async function vgGrafik(id){
  var r = VG_ROWS.filter(function(x){ return x.id===id; })[0];
  if(!r) return;
  msg("Grafik wird gebaut …");
  try{
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    var ids=[r.Produkt_A, r.Produkt_B].filter(Boolean);
    var q = await vg.from("v_web_produkte")
      .select("id,name,marke,clean_score,bewertung,p_zutaten,p_zusatzstoffe,p_nova,p_naehrwert,zutaten")
      .in("id", ids);
    if(q.error) throw new Error(q.error.message);
    var byId={}; (q.data||[]).forEach(function(p){ byId[p.id]=p; });
    var pA=byId[r.Produkt_A], pB=byId[r.Produkt_B];
    if(!pA || !pB) throw new Error("Beide Produkte müssen gewählt sein.");

    var url=async function(pfad){
      if(!pfad) return null;
      var s=await vg.storage.from("vergleich-fotos").createSignedUrl(pfad, 600);
      return (s.error||!s.data)?null:s.data.signedUrl;
    };
    var fA=await vggBild(await url(r.Foto_A));
    var fB=await vggBild(await url(r.Foto_B));

    var c = await vggBauen(r, pA, pB, fA, fB);
    var box=document.getElementById("vgVorschau");
    var diff=Math.abs(Math.round(Number(pA.clean_score))-Math.round(Number(pB.clean_score)));
    box.innerHTML='<div class="vgKarte"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
      +'<b>Vorschau 1080 × 1080</b><span class="vgMini">gemessener Unterschied: '+diff+' Punkte</span>'
      +'<button class="vgBtn prim" id="vgDl">⬇ PNG herunterladen</button>'
      +'<button class="vgBtn" onclick="document.getElementById(\'vgVorschau\').innerHTML=\'\'">Schließen</button></div></div>';
    var karte=box.querySelector(".vgKarte");
    c.style.width="100%"; c.style.maxWidth="540px"; c.style.borderRadius="10px";
    karte.appendChild(c);
    document.getElementById("vgDl").onclick=function(){
      var a=document.createElement("a");
      a.download="vergleich-"+(pA.id)+"-"+(pB.id)+".png";
      a.href=c.toDataURL("image/png"); document.body.appendChild(a); a.click(); a.remove();
    };
    box.scrollIntoView({behavior:"smooth", block:"start"});
    msg("✓ Grafik gebaut. Unterschied "+diff+" Punkte – prüfe, ob die Überschrift dazu passt.");
  }catch(e){ msg("Grafik fehlgeschlagen: "+(e&&e.message?e.message:e), true); }
}
