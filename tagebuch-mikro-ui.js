/* ===== TAGEBUCH · MIKRONÄHRSTOFFE (Ralph 25.07.) =====
   Kacheln je Nährstoff für den gewählten Tag: gegessen/Tagesbedarf; Farbe 0%=blau, 1-99%=orange, >=100%=grün.
   ★ = für DIESES Profil (Alter/Geschlecht/Zustand/Ernaehrungsform) besonders wichtig.

   25.09.2026 (Ralph: „ja, du kannst beides bauen"): Sollwerte sind jetzt
   PERSÖNLICH (D-A-CH/DGE nach Geschlecht, Alter, Schwangerschaft/Stillzeit).
   Vorher stand hier eine feste Tabelle MIKRO_REF im Frontend – dieselbe Zahl
   für jeden, und obendrein waren es EU-Referenzmengen (NRV), während daneben
   „laut DGE" stand. Beides ist weg: Ist, Soll, Prozent, ★ und die Quelle
   kommen jetzt aus EINEM Aufruf (cb_tagebuch_naehrstoffe), genau wie in der
   App. Das Frontend rechnet nichts und kennt keine Referenz mehr (§8.1). */
function _mkNum(x){ x=Number(x)||0; if(x>=100) return Math.round(x); if(x>=10) return Math.round(x*10)/10; return Math.round(x*100)/100; }
function _mkDe(x){ return String(x).replace(".",","); }
function openTbMikro(){
  closeTbMikro();
  const sb=document.getElementById("tbStatBox"); if(sb) sb.style.display="none";
  const ov=document.createElement("div"); ov.id="tbMikroOverlay";
  ov.style.cssText="position:fixed;inset:0;background:rgba(15,30,35,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:32px 12px;overflow:auto";
  ov.onclick=function(e){ if(e.target.id==="tbMikroOverlay") closeTbMikro(); };
  ov.innerHTML='<div style="--tb-card:var(--k-ffffff);--tb-card2:var(--k-e7eef8);--tb-line:var(--k-d8e2f0);--tb-text:var(--k-15304f);--tb-muted:var(--k-5b6b7e);--tb-track:var(--k-dbe6f4);background:var(--tb-card);color:var(--tb-text);border-radius:16px;max-width:560px;width:100%;padding:14px 18px 20px;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.45)">'
    +'<div style="display:flex;justify-content:flex-end;margin:-2px -6px 2px 0"><button onclick="closeTbMikro()" aria-label="Schließen" style="border:0;background:var(--tb-track,#ece7db);border-radius:9px;width:32px;height:32px;font-size:15px;cursor:pointer;color:var(--tb-text)">✕</button></div>'
    +'<div id="tbMikroBody"></div></div>';
  document.body.appendChild(ov);
  document.addEventListener("keydown", _tbMikroEsc);
  loadTbMikro();
}
function closeTbMikro(){ const ov=document.getElementById("tbMikroOverlay"); if(ov) ov.remove(); document.removeEventListener("keydown", _tbMikroEsc); }
function _tbMikroEsc(e){ if(e.key==="Escape") closeTbMikro(); }
async function loadTbMikro(){
  const box=document.getElementById("tbMikroBody"); if(!box) return;
  box.innerHTML='<div style="color:var(--tb-muted);font-size:13px">Lade Nährstoffe…</div>';
  const datum=(document.getElementById("tbDatum")||{}).value || tbToday();
  const {data,error}=await client.rpc("cb_tagebuch_naehrstoffe",{p_datum:datum});
  if(error||!data||data.ok===false){
    box.innerHTML='<div style="color:var(--tb-muted);font-size:13px">Nährstoffe konnten nicht geladen werden.</div>'; return;
  }
  renderTbMikro(data, datum);
}
function renderTbMikro(tag, datum){
  const box=document.getElementById("tbMikroBody"); if(!box) return;
  var _dl=datum||""; try{ var _dd=new Date((datum||"")+"T00:00:00"); _dl=_dd.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"long"}); }catch(e){}
  const rows=(tag&&tag.naehrstoffe)||[];
  function chip(n){
    const name=String(n.naehrstoff||""), eR=n.einheit||"", soll=Number(n.soll)||0;
    const star=n.wichtig?'<span class="mkstar">★</span>':'';
    const crit=n.wichtig?' mkcrit':'';
    const supKz=(n.gruppe==='wirk')?'<span class="mkteil" title="Zählt NUR Supplemente – Lebensmittel-Anteile (z. B. Fleisch/Fisch bei Kreatin) enthält die Datenquelle nicht. Zielmarke = Schwelle der zugelassenen EU-Wirkaussage (VO 432/2012), KEIN Tagesbedarf.">Ⓢ</span>':'';
    /* Kein Ist-Wert, aber ein Hinweis (z. B. Selen): ehrlich „keine Angabe". */
    if(n.ist==null && n.hinweis){
      return '<div class="mkchip mkna'+crit+'">'+star+'<div class="mkn">'+name+'</div><div class="mkp">keine&nbsp;Angabe</div><div class="mkm">Soll '+_mkDe(_mkNum(soll))+' '+eR+'/Tag</div></div>';
    }
    if(n.ist==null){
      return '<div class="mkchip mkleer'+crit+'">'+star+'<div class="mkn">'+name+supKz+'</div><div class="mkp">–</div><div class="mkm">0 / '+_mkDe(_mkNum(soll))+' '+eR+'</div></div>';
    }
    const p=(n.prozent==null)?0:Number(n.prozent);
    const stufe=p<=0?'mkzero':(p>=100?'mkfull':'mkmid');
    const done=p>=100?' mkdone':'';
    const teil=n.unvollstaendig?'<span class="mkteil" title="Nicht alle Lebensmittel des Tages haben Nährstoff-Daten">*</span>':'';
    return '<div class="mkchip '+stufe+crit+done+'">'+star+'<div class="mkn">'+name+teil+supKz+'</div><div class="mkp">'+p+'%</div><div class="mkm">'+_mkDe(_mkNum(n.ist))+' / '+_mkDe(_mkNum(soll))+' '+eR+'</div></div>';
  }
  function grp(kind){
    return rows.filter(function(n){ return n.gruppe===kind; })
               .sort(function(a,b){ return (b.prozent==null?-1:b.prozent)-(a.prozent==null?-1:a.prozent); })
               .map(chip).join("");
  }
  const liste=((tag&&tag.wichtig)||[]).join(", ");
  /* Sagt geradeheraus, woher der Sollwert kommt. Ohne Profil sind es die
     EU-Referenzmengen – und dann steht das auch so da. */
  let quelle;
  if(!tag.persoenlich){
    quelle='<b>Sollwerte: EU-Referenzmengen (NRV)</b> – dieselbe Zahl für alle. Trag Geschlecht und Alter in deinem Profil ein, dann rechnen wir mit den Werten der DGE für dich.';
  } else if(tag.zustand==='schwanger'){
    quelle='Sollwerte nach <b>D-A-CH (DGE)</b> für dein Profil – Schwangerschaft berücksichtigt.';
  } else if(tag.zustand==='stillend'){
    quelle='Sollwerte nach <b>D-A-CH (DGE)</b> für dein Profil – Stillzeit berücksichtigt.';
  } else {
    quelle='Sollwerte nach <b>D-A-CH (DGE)</b> für dein Profil (Geschlecht und Alter).';
  }
  box.innerHTML=
    '<div class="mkhead"><div style="font-weight:700">🥗 Nährstoffe · '+_dl+'</div>'
    +'<div class="mklg"><span><i style="background:#5b86b0"></i>0&nbsp;%</span><span><i style="background:#cf9a2e"></i>1–99&nbsp;%</span><span><i style="background:#3f9d6b"></i>≥100&nbsp;% ✓</span></div></div>'
    +'<div class="mksub">Zahl unter dem Prozent = <b>gegessen / Tagesbedarf</b>. <span style="color:#7d3ea6">★</span> = für <b>dich</b> besonders wichtig'+(liste?': '+liste:'')+'.</div>'
    +'<div class="mksub">'+quelle+'</div>'
    +'<div class="mkgt">Vitamine</div><div class="mkgrid">'+grp("vit")+'</div>'
    +'<div class="mkgt">Mineralstoffe &amp; Spurenelemente</div><div class="mkgrid">'+grp("min")+'</div>'
    +'<div class="mkgt">Omega-3 (Fettsäuren)</div><div class="mkgrid">'+grp("omega")+'</div>'
    +'<div class="mkgt">Wirkstoffe (aus Supplementen) Ⓢ</div><div class="mkgrid">'+grp("wirk")+'</div>'
    +'<div class="mknote">Mengen aus dem Bundeslebensmittelschlüssel (amtliche Nährwert-Datenbank), auf deine Portionen hochgerechnet – sie zeigen, was das Essen <b>geliefert</b> hat, nicht was dein Körper braucht. <b>*</b> = nicht alle Lebensmittel des Tages haben Nährstoff-Daten. <b>Selen</b> führt unsere Quelle nicht (nur Empfehlung). <b>Omega-3</b>: Ziel 250 mg EPA+DHA (EU-Referenz, kein NRV). <b>Ⓢ Wirkstoffe (z. B. Kreatin)</b>: zählen NUR Supplemente – Lebensmittel-Anteile (Fleisch/Fisch) enthält die Datenquelle nicht; die Zielmarke (Kreatin 3 g/Tag) ist die Schwelle der zugelassenen EU-Wirkaussage nach VO 432/2012, <b>kein Tagesbedarf</b> – ohne Krafttraining-Kontext keine Wirkaussage. <b>Sollwerte</b>: D-A-CH-Referenzwerte (DGE/ÖGE/SGE), soweit dein Profil sie zulässt, sonst EU-Referenzmengen. Einige sind Schätzwerte (Kupfer, Mangan, Chrom, Molybdän) – dort steht der untere Rand der Spanne. Keine medizinische Beratung.</div>';
}
