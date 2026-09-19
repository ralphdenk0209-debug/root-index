/* ===== WASSER-TRACKING (Ralph 25.07.) =====
   Startseiten-Widget bucht Glaeser des Vorwahl-Wassers; dessen Mineralstoffe
   fliessen ueber cb_tagebuch_mikro automatisch in die Naehrstoff-Uebersicht.
   Vorwahl (welches Wasser + Glasgroesse) steht im Profil. */
function _wLiter(ml){ ml=+ml||0; var l=ml/1000; var s=(Math.round(l*100)/100).toString().replace('.',','); return s+' l'; }
/* 28z23 (Sandra konnte gestern kein Wasser nachtragen): Tages-Navigation wie bei
   Schritte/Schlaf. _wasserTag ist der angezeigte/bebuchte Tag; Zukunft ist gesperrt. */
function wasserTagLbl(){
  var t=window._wasserTag||tbToday();
  if(t===tbToday()) return 'heute';
  var g=new Date(tbToday()+"T00:00:00"); g.setDate(g.getDate()-1);
  if(t===g.toISOString().slice(0,10)) return 'gestern';
  return new Date(t+"T00:00:00").toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"});
}
function wasserTagWechsel(delta){
  var t=new Date((window._wasserTag||tbToday())+"T00:00:00"); t.setDate(t.getDate()+delta);
  var neu=t.toISOString().slice(0,10);
  if(neu>tbToday()) neu=tbToday();
  window._wasserTag=neu; wasserWidgetLoad();
}
async function wasserWidgetLoad(){
  var el=document.getElementById("wasserWidget"); if(!el) return;
  if(!window._wasserTag) window._wasserTag=tbToday();
  try{ var r=await client.rpc("cb_wasser_log_heute",{p_datum:window._wasserTag}); window._wasserH=(r&&r.data&&r.data[0])||{}; }
  catch(e){ window._wasserH={_err:(e&&e.message)||"Fehler"}; }
  wasserWidgetRender();
}
function wasserWidgetRender(){
  /* 28z21 (Ralph): Wasser-Karte war eine weisse Insel zwischen den dunklen Glow-Kacheln.
     Jetzt derselbe Bento-Stil wie riGlowTile - in BLAU (Wasser). Position: nach der Einkaufsliste. */
  var el=document.getElementById("wasserWidget"); if(!el) return;
  var h=window._wasserH||{};
  var card='position:relative;overflow:hidden;border-radius:16px;padding:14px 16px;margin-bottom:12px;background:radial-gradient(120% 120% at 22% 12%, #143a63 0%, #0b1420 62%);box-shadow:0 8px 22px rgba(15,25,40,.25)';
  var glow='<div style="position:absolute;top:2px;left:2px;width:80px;height:80px;background:radial-gradient(circle,#5ab6ff99 0%,transparent 70%);filter:blur(7px)"></div>';
  var istHeute=(window._wasserTag||tbToday())===tbToday();
  var pfeil=function(d,dis){ return '<button onclick="wasserTagWechsel('+d+')" '+(dis?'disabled':'')+' style="width:24px;height:24px;border:0;border-radius:50%;background:rgba(255,255,255,'+(dis?'.06':'.14')+');color:'+(dis?'rgba(255,255,255,.25)':'#fff')+';font-size:13px;line-height:1;cursor:'+(dis?'default':'pointer')+'">'+(d<0?'‹':'›')+'</button>'; };
  var head='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;position:relative;z-index:2"><span style="font-weight:700;font-size:14.5px;color:#ffffff;filter:drop-shadow(0 0 6px #5ab6ff88)">💧 Wasser</span>'
    +pfeil(-1,false)+'<span style="font-size:12.5px;font-weight:700;color:#ffffff;min-width:52px;text-align:center">'+esc(wasserTagLbl())+'</span>'+pfeil(1,istHeute)
    +'<span style="margin-left:auto;font-weight:800;font-size:20px;color:#7cc4ff">'+_wLiter(h.ml)+'</span></div>';
  if(h._err){ el.innerHTML='<div style="'+card+'">'+glow+head+'<div style="position:relative;z-index:2;color:rgba(255,255,255,.6);font-size:13px">'+esc(h._err)+'</div></div>'; return; }
  if(!h.wasser_id){
    el.innerHTML='<div style="'+card+'">'+glow+head
      +'<div style="position:relative;z-index:2;font-size:12.5px;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:10px">Wähle einmal im Profil dein Wasser – dann zählen seine Mineralstoffe (z. B. Calcium, Magnesium) automatisch mit.</div>'
      +'<button onclick="navTo(\'profil\')" style="position:relative;z-index:2;padding:10px 14px;border:0;border-radius:10px;background:#5ab6ff;color:#0b1420;font-weight:700;cursor:pointer">Wasser im Profil wählen</button></div>';
    return;
  }
  var glaeser=h.glaeser||0, glas=h.glas_ml||500;
  var cnt=(glaeser===1)?'1 Glas':(glaeser+' Gläser');
  var chips=[200,300,500].map(function(ml){
    return '<button onclick="wasserAdd('+ml+')" style="padding:8px 12px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(255,255,255,.08);color:#ffffff;font-size:13px;cursor:pointer">+ '+_wLiter(ml)+'</button>';
  }).join("");
  el.innerHTML='<div style="'+card+'">'+glow+head
    +'<div style="position:relative;z-index:2;font-size:12px;color:rgba(255,255,255,.6);margin-bottom:10px">'+esc(h.name||"")+' · '+cnt+' '+esc(wasserTagLbl())+'</div>'
    +'<div style="position:relative;z-index:2;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    +'<button onclick="wasserAdd(null)" style="padding:10px 16px;border:0;border-radius:12px;background:#5ab6ff;color:#0b1420;font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 0 14px #5ab6ff55">+ Glas ('+_wLiter(glas)+')</button>'
    +chips
    +(glaeser>0?'<button onclick="wasserUndo()" title="Letztes Glas zurücknehmen" style="margin-left:auto;padding:8px 10px;border:0;background:transparent;color:rgba(255,255,255,.55);font-size:13px;cursor:pointer">↩︎ rückgängig</button>':'')
    +'</div>'
    +'<div id="wasserMsg" style="position:relative;z-index:2;font-size:12px;color:#ffb4a8;margin-top:8px"></div></div>';
}
async function wasserAdd(ml){
  try{ var r=await client.rpc("cb_wasser_log_add",{p_ml:(ml||null),p_datum:(window._wasserTag||tbToday())}); if(r&&r.error) throw new Error(r.error.message); }
  catch(e){ var m=document.getElementById("wasserMsg"); if(m) m.textContent="Konnte nicht buchen: "+((e&&e.message)||e); return; }
  await wasserWidgetLoad();
  try{ startWerteLaden(); }catch(e){}   /* 19.09.2026: Zahl auf der Wertekachel mitziehen */
}
async function wasserUndo(){
  try{ await client.rpc("cb_wasser_log_undo",{p_datum:(window._wasserTag||tbToday())}); }catch(e){}
  await wasserWidgetLoad();
  try{ startWerteLaden(); }catch(e){}
}
async function wasserPrefRender(){
  if(!ME) return;
  var box=document.getElementById("pfWasserBox"); if(!box) return;
  var liste=[], pref={};
  try{ var r=await client.rpc("cb_wasser_liste"); liste=(r&&r.data)||[]; }catch(e){}
  try{ var r2=await client.rpc("cb_wasser_pref_get"); pref=(r2&&r2.data&&r2.data[0])||{}; }catch(e){}
  var curW=pref.wasser_id||"", curGlas=pref.glas_ml||500;
  var opts='<option value="">– kein Wasser gewählt –</option>'+liste.map(function(w){
    var lbl=(w.name||"")+(w.marke?(' ('+w.marke+')'):'');
    return '<option value="'+esc(w.wasser_id)+'"'+(w.wasser_id===curW?' selected':'')+'>'+esc(lbl)+'</option>';
  }).join("");
  var sizes=[[200,'0,2 l'],[300,'0,3 l'],[500,'0,5 l'],[700,'0,7 l'],[1000,'1,0 l']];
  var sopts=sizes.map(function(s){ return '<option value="'+s[0]+'"'+(s[0]===curGlas?' selected':'')+'>'+s[1]+'</option>'; }).join("");
  box.innerHTML='<div style="margin-top:16px;background:var(--k-eff6ff,#eff6ff);border:1px solid var(--k-bfdbfe,#bfdbfe);border-radius:10px;padding:12px 14px">'
    +'<div style="font-weight:600;font-size:13.5px;margin-bottom:2px">💧 Mein Wasser</div>'
    +'<div style="font-size:11.5px;color:var(--muted);line-height:1.5;margin-bottom:10px">Welches Wasser trinkst du normalerweise? Seine Mineralstoffe (Calcium, Magnesium …) zählen dann über das Wasser-Widget auf der Startseite automatisch in deine Nährstoffe.</div>'
    +'<label style="font-size:12px;color:var(--ink)">Wasser</label>'
    +'<select id="pfWasserSel" style="width:100%;margin:4px 0 10px;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--k-ffffff);color:var(--ink)">'+opts+'</select>'
    +'<label style="font-size:12px;color:var(--ink)">Standard-Glasgröße</label>'
    +'<select id="pfWasserGlas" style="width:100%;margin:4px 0 10px;padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--k-ffffff);color:var(--ink)">'+sopts+'</select>'
    +'<div style="display:flex;align-items:center;gap:10px"><button onclick="wasserPrefSave()" style="padding:9px 16px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer">Speichern</button>'
    +'<span id="pfWasserMsg" style="font-size:12.5px"></span></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:8px">Dein Wasser ist nicht dabei? Fotografiere das Etikett mit der Analyse – dann trage ich es ein.</div>'
  +'</div>';
}
async function wasserPrefSave(){
  var sel=document.getElementById("pfWasserSel"), gl=document.getElementById("pfWasserGlas"), msg=document.getElementById("pfWasserMsg");
  if(!sel) return;
  var w=sel.value||null, ml=parseInt(gl&&gl.value)||500;
  try{ var r=await client.rpc("cb_wasser_pref_set",{p_wasser:w,p_glas_ml:ml}); if(r&&r.error) throw new Error(r.error.message);
    if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; }
  }catch(e){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+((e&&e.message)||e); } }
}
if(typeof window!=='undefined'){ window.wasserWidgetLoad=wasserWidgetLoad; window.wasserAdd=wasserAdd; window.wasserUndo=wasserUndo; window.wasserPrefRender=wasserPrefRender; window.wasserPrefSave=wasserPrefSave; }
