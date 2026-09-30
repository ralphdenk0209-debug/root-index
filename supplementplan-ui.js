async function suppPlanRender(){
  if(!ME) return;
  var box=document.getElementById("suppPlanBox"); if(!box) return;
  box.innerHTML='<div>'
    +'<div style="font-weight:700;font-size:16px;margin-bottom:2px">🔁 Meine Supplements</div>'
    +'<div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:14px">Supplements, die du regelmäßig nimmst. Aktive zählen automatisch jeden Tag in deine Nährstoffe – bei „alle N Tage“ wird die Dosis gleichmäßig auf die Tage verteilt.</div>'
    +'<div style="position:relative;margin-bottom:10px"><input id="suppSearch" autocomplete="off" oninput="suppSearch(this.value)" onfocus="suppSearch(this.value)" placeholder="Supplement suchen und antippen…" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--k-ffffff);color:var(--ink);font-size:14px"><div id="suppSug" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:40;background:var(--k-ffffff);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.15);max-height:260px;overflow:auto"></div></div>'
    +'<div id="suppMsg" style="font-size:12px;color:var(--k-dc2626);margin-bottom:8px"></div>'
    +'<div id="suppItems" style="font-size:13px;color:var(--muted)">Lade …</div>'
  +'</div>';
  window._suppFound=[]; suppLoad();
}
async function suppSearch(q){
  var sug=document.getElementById("suppSug"); if(!sug) return;
  var qq=(q&&q.trim())?q.trim():null;
  try{
    var r=await client.rpc("cb_supp_produkte",{p_q:qq}); window._suppFound=(r&&r.data)||[];
    var arr=window._suppFound;
    if(!arr.length){ sug.innerHTML='<div style="padding:10px 12px;color:var(--muted);font-size:12.5px">Kein passendes Supplement gefunden.</div>'; sug.style.display="block"; return; }
    sug.innerHTML=arr.map(function(p,i){
      return '<div onclick="suppAdd('+i+')" style="padding:10px 12px;cursor:pointer;border-top:1px solid var(--line);font-size:13.5px" onmouseover="this.style.background=\'var(--k-f3f4f6)\'" onmouseout="this.style.background=\'transparent\'"><b>'+esc(p.name)+'</b>'+(p.marke?' <span style="color:var(--muted);font-size:12px">'+esc(p.marke)+'</span>':'')+'</div>';
    }).join("");
    if(sug.firstChild) sug.firstChild.style.borderTop="none";
    sug.style.display="block";
  }catch(e){ sug.style.display="none"; }
}
async function suppAdd(i){
  var msg=document.getElementById("suppMsg"), inp=document.getElementById("suppSearch"), sug=document.getElementById("suppSug");
  var p=(window._suppFound||[])[i];
  if(!p){ if(msg) msg.textContent="Bitte ein Supplement aus der Liste antippen."; return; }
  if(msg) msg.textContent="";
  try{ var r=await client.rpc("cb_supp_add",{p_produkt:p.id}); if(r&&r.error) throw new Error(r.error.message);
    if(inp) inp.value=""; if(sug){ sug.style.display="none"; sug.innerHTML=""; } window._suppFound=[]; await suppLoad(); }
  catch(e){ if(msg) msg.textContent="Fehler: "+(e&&e.message?e.message:e); }
}
async function suppLoad(){
  var l=document.getElementById("suppItems"); if(!l) return;
  try{ var r=await client.rpc("cb_supp_list"); if(r&&r.error) throw new Error(r.error.message); window._supp=(r&&r.data)||[]; suppItemsRender(); }
  catch(e){ l.style.color="var(--k-dc2626)"; l.textContent="Konnte nicht laden: "+(e&&e.message?e.message:e); }
}
function suppItemsRender(){
  var l=document.getElementById("suppItems"); if(!l) return; var arr=window._supp||[];
  if(!arr.length){ l.style.color="var(--muted)"; l.innerHTML="Noch keine Supplements – such oben eins und füg es hinzu."; return; }
  l.style.color="var(--ink)";
  l.innerHTML=arr.map(function(o){
    /* 30.09.2026 (Webtest Supplements): "alle 1 Tag(e) (täglich)" -> Auswahl in Worten. */
    var h=+o.haeufigkeit_tage||1, opts=[[1,'täglich'],[2,'jeden 2. Tag'],[3,'alle 3 Tage'],[4,'alle 4 Tage'],[5,'alle 5 Tage'],[7,'1× pro Woche'],[14,'alle 2 Wochen'],[30,'1× im Monat']];
    if(!opts.some(function(x){return x[0]===h;})) opts.push([h,'alle '+h+' Tage']);
    var sel='<select class="suppHaeuf" onchange="suppSave(this)" style="padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:var(--k-ffffff);color:var(--ink)">'
      +opts.sort(function(a,b){return a[0]-b[0];}).map(function(x){ return '<option value="'+x[0]+'"'+(x[0]===h?' selected':'')+'>'+x[1]+'</option>'; }).join('')+'</select>';
    var verteil=(h>1)?'<span style="color:var(--muted)">→ zählt mit '+Math.round(100/h)+' % der Dosis pro Tag</span>':'';
    return '<div class="suppRow" data-pid="'+esc(o.produkt_id)+'" style="border:1px solid var(--line);border-radius:11px;padding:10px 12px;margin-bottom:8px;opacity:'+(o.aktiv?'1':'0.55')+'">'
      +'<div style="display:flex;align-items:center;gap:8px"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1"><input type="checkbox" class="suppAktiv" '+(o.aktiv?'checked':'')+' onchange="suppSave(this)" style="width:16px;height:16px;accent-color:var(--k-16a34a)"><b style="font-size:14px">'+esc(o.name)+'</b>'+(o.marke?' <span style="font-size:11.5px;color:var(--muted)">'+esc(o.marke)+'</span>':'')+'</label><span class="suppIdx" data-pid="'+esc(o.produkt_id)+'"></span><button onclick="try{detailById(\''+esc(o.produkt_id)+'\')}catch(e){}" title="Produktkarte öffnen" style="border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:7px;font-size:12px;padding:3px 8px;cursor:pointer">Details</button><button onclick="suppDel(this)" title="Entfernen" style="border:0;background:transparent;color:var(--muted);font-size:15px;cursor:pointer">✕</button></div>'
      +(o.wirkstoffe?'<div style="font-size:11px;color:var(--muted);margin:4px 0 0 22px">'+esc(o.wirkstoffe)+'</div>':'<div style="font-size:11px;color:var(--k-e8920c);margin:4px 0 0 22px">Keine Wirkstoffe hinterlegt – zählt noch nicht mit.</div>')
      +'<div style="font-size:12.5px;color:var(--ink);margin:6px 0 0 22px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">Einnahme: '+sel+' '+verteil+'</div>'
    +'</div>';
  }).join("");
  suppIndexLaden();
}
/* Reinheits-Index je Supplement - dieselbe abgelegte Zahl wie auf der Produktkarte (nur holen, nicht rechnen). */
function suppIndexLaden(){
  document.querySelectorAll('#suppItems .suppIdx').forEach(function(el){
    client.rpc("cb_supplement_index_gespeichert",{p_id:el.getAttribute('data-pid')}).then(function(ri){
      var v=ri&&ri.data; if(typeof v==="string"){ try{ v=JSON.parse(v); }catch(e){} }
      if(!v||v.index==null) return; var n=Math.round(Number(v.index)); if(!isFinite(n)) return;
      var f=n>=80?"#1f5e34":n>=60?"#92400e":"#6d28d9";
      el.innerHTML='<span title="Reinheits-Index (eigene Skala für Nahrungsergänzung)" style="font-size:12px;font-weight:800;color:'+f+';border:1px solid var(--line);border-radius:7px;padding:2px 7px;white-space:nowrap">'+n+' <span style="font-weight:500;color:var(--muted)">Reinheit</span></span>';
    },function(){});
  });
}
async function suppSave(el){
  var row=el.closest(".suppRow"); if(!row) return; var pid=row.getAttribute("data-pid");
  var aktiv=row.querySelector(".suppAktiv").checked;
  var haeuf=Math.max(1, parseInt(row.querySelector(".suppHaeuf").value)||1);
  try{ await client.rpc("cb_supp_set",{p_produkt:pid,p_aktiv:aktiv,p_haeufigkeit:haeuf}); await suppLoad(); }catch(e){}
}
async function suppDel(el){
  var row=el.closest(".suppRow"); if(!row) return; var pid=row.getAttribute("data-pid");
  try{ await client.rpc("cb_supp_del",{p_produkt:pid}); await suppLoad(); }catch(e){}
}
if(typeof window!=='undefined'){ window.suppPlanRender=suppPlanRender; window.suppSearch=suppSearch; window.suppAdd=suppAdd; window.suppSave=suppSave; window.suppDel=suppDel; }
