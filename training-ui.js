/* ---- Trainingstage im Profil (Wochentag-Knoepfe) ----
   ISO-Wochentage: 1 = Montag ... 7 = Sonntag. Dieselbe Zaehlung nutzt der Server
   (extract(isodow)) - damit die beiden Seiten nicht auseinanderlaufen. */
const TT_TAGE = [[1,"Mo"],[2,"Di"],[3,"Mi"],[4,"Do"],[5,"Fr"],[6,"Sa"],[7,"So"]];
let TT_GEWAEHLT = new Set();
function renderTrainTage(tage, plus){
  const box=document.getElementById("pfTrainTage"); if(!box) return;
  TT_GEWAEHLT = new Set(String(tage||"").split(",").filter(Boolean).map(Number));
  const p=document.getElementById("pfTrainPlus"); if(p) p.value = (plus==null?20:plus);
  box.innerHTML = TT_TAGE.map(function(t){
    const an = TT_GEWAEHLT.has(t[0]);
    return '<button type="button" onclick="trainTagToggle('+t[0]+')" style="'
      + 'width:42px;padding:8px 0;border-radius:9px;cursor:pointer;font-size:12.5px;font-weight:600;'
      + 'border:1px solid '+(an?'var(--green,var(--k-16a34a))':'var(--line)')+';'
      + 'background:'+(an?'var(--greenlt,var(--k-eaf5ee))':'var(--card)')+';'
      + 'color:'+(an?'var(--greendk,var(--k-166534))':'var(--muted)')+'">'+t[1]+'</button>';
  }).join('');
}
function trainTagToggle(n){
  if(TT_GEWAEHLT.has(n)) TT_GEWAEHLT.delete(n); else TT_GEWAEHLT.add(n);
  const p=document.getElementById("pfTrainPlus");
  renderTrainTage([...TT_GEWAEHLT].sort((a,b)=>a-b).join(","), p?p.value:20);
}
async function saveTrainTage(){
  const p=document.getElementById("pfTrainPlus");
  const tage=[...TT_GEWAEHLT].sort((a,b)=>a-b).join(",");
  const plus=Math.max(0, Math.min(100, parseInt(p&&p.value,10) || 0));
  try{
    const {data}=await client.rpc("cb_trainingstage_profil",{p_tage:tage, p_plus:plus});
    return !!(data && data.ok);
  }catch(e){ return false; }
}

/* ============================================================
   TRAININGSTAG
   Der Nutzer hinterlegt seine Trainingstage (z. B. Mo/Mi/Fr) und einen Zuschlag
   (Standard +20 %). An diesen Tagen ist der Zuschlag VORBELEGT - aber er kann ihn
   jederzeit abwaehlen.
   >>> Ein Plan ist eine Absicht, kein Protokoll. <<<
   Wer montags trainieren WOLLTE und es nicht getan hat, bekommt keine 400 kcal
   geschenkt. Deshalb ist die Vorbelegung eine Vermutung - und der Nutzer hat das
   letzte Wort. Die Regel selbst liegt im Server (cb_trainingstag), nicht hier:
   eine Regel, ein Ort. */
let TT = null;   // {aktiv, vorbelegt, plus_prozent, kcal_basis, kcal_heute}

async function ladeTrainingstag(datum){
  TT = null;
  if(!ME) return;
  try{
    const {data} = await client.rpc("cb_trainingstag", {p_datum: datum || tbToday()});
    if(data && data.ok) TT = data;
  }catch(e){}
}
async function trainingstagUmschalten(){
  const d = (document.getElementById("tbDatum")||{}).value || tbToday();
  const neu = !(TT && TT.aktiv);
  try{
    const {data} = await client.rpc("cb_trainingstag_setzen", {p_datum: d, p_aktiv: neu});
    if(data && data.ok) TT = data;
  }catch(e){ alert("Konnte nicht umgestellt werden: "+e.message); return; }
  loadTagebuch();   // Ziel und Balken neu rechnen
}
function trainingstagBox(){
  if(!TT || !TT.ok) return "";
  const an = !!TT.aktiv, plus = TT.plus_prozent || 20;
  const abweichung = (TT.aktiv !== TT.vorbelegt);
  return '<div onclick="trainingstagUmschalten()" style="display:flex;align-items:center;gap:10px;margin-top:11px;padding:9px 11px;border-radius:10px;cursor:pointer;'
    + 'background:'+(an?'var(--k-eef6ee)':'var(--k-f4f5f4)')+';border:1px solid '+(an?'var(--k-bcd9be)':'var(--tb-line,var(--k-e7e0d4))')+'">'
    + '<div style="width:38px;height:22px;border-radius:999px;flex:0 0 auto;position:relative;transition:background .15s;'
      + 'background:'+(an?'var(--k-4d7c3a)':'var(--k-c9c4bb)')+'">'
      + '<div style="position:absolute;top:2px;left:'+(an?'18px':'2px')+';width:18px;height:18px;border-radius:50%;background:var(--k-ffffff);transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>'
    + '</div>'
    + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:600;color:'+(an?'var(--k-2f5d33)':'var(--tb-muted,var(--k-6b6256))')+'">'
        + '💪 Trainingstag'+(an?(' &nbsp;<span style="font-weight:700">+'+plus+'&thinsp;%</span>'):'')
      + '</div>'
      + '<div style="font-size:11px;color:var(--tb-muted,var(--k-6b6256));margin-top:1px">'
        + (an
            ? ('Ziel heute: <b>'+Math.round(TT.kcal_heute)+'</b> statt '+Math.round(TT.kcal_basis)+' kcal')
            : (TT.vorbelegt ? 'Laut Plan wäre heute Training – abgewählt.' : 'Antippen, wenn du heute doch trainiert hast.'))
      + '</div>'
    + '</div>'
    + (abweichung ? '<span style="font-size:10px;color:var(--k-8a8072);flex:0 0 auto">von dir gesetzt</span>' : '')
    + '</div>';
}

/* ================= TRAINING (Phase A) ================= */
let TRAIN=null, GERAETE_KAT=[];
const TF_SMILEYS=["😣","🙁","😐","🙂","😄"];
const MASS=[["po","Po","Po"],["huefte","Hüfte","Huefte"],["beine","Beine","Beine"],["oberarm","Oberarm","Oberarm"],["brust","Brust","Brust"],["taille","Taille","Taille"],["bauch","Bauch","Bauch"],["oberschenkel","Oberschenkel","Oberschenkel"]];
async function loadTraining(){
  const gate=document.getElementById("trainGate"), body=document.getElementById("trainBody");
  if(!ME || !hasFeat('fitness')){ gate.style.display=""; body.innerHTML=""; gate.innerHTML=gateHtml('training'); return; }
  gate.style.display="none"; body.innerHTML='<div style="color:var(--muted)">Lade…</div>';
  try{
    const [rp,rk,rh,rt,ra]=await Promise.all([
      client.rpc("cb_train_profil"),
      client.rpc("cb_geraete_katalog"),
      client.rpc("cb_mass_historie",{p_limit:1}),
      client.rpc("cb_tagesform_get",{}),
      client.rpc("cb_train_adherence")
    ]);
    TRAIN = Array.isArray(rp.data)?(rp.data[0]||{}):(rp.data||{});
    const _adh=(ra&&ra.data&&ra.data[0])||null;
    GERAETE_KAT = rk.data||[];
    const last=(rh.data&&rh.data[0])||{};
    renderTraining(TRAIN, last, (rt&&rt.data)||null);
  }catch(e){ body.innerHTML='<div style="color:var(--k-dc2626)">Fehler: '+esc(e.message)+'</div>'; }
}
let _trTab='plan', _trTf=null;
function renderTraining(p, last, tf){
  TRAIN=p; _trTf=tf;
  document.getElementById("trainBody").innerHTML=
   '<div style="max-width:760px;margin:0 auto">'
   +'<div id="trTabs" class="seg">'
   +'<button data-p="plan" onclick="trTab(\'plan\')">Plan</button>'
   +'<button data-p="tagebuch" onclick="trTab(\'tagebuch\')">Tagebuch</button>'
   +'<button data-p="uebungen" onclick="trTab(\'uebungen\')">Übungen</button>'
   +'<button data-p="geraete" onclick="trTab(\'geraete\')">Geräte</button>'
   +'<button data-p="statistik" onclick="trTab(\'statistik\')">Statistik</button>'
   +'</div><div id="trainPane"></div></div>';
  trTab(_trTab||'plan');
}
function trTab(name){
  _trTab=name;
  document.querySelectorAll('#trTabs button').forEach(b=>b.classList.toggle('active', b.dataset.p===name));
  if(!document.getElementById("trainPane")) return;
  if(name==='plan') renderTrainPlanPane();
  else if(name==='tagebuch') openTrainLog(null,'trainPane');
  else if(name==='uebungen') openUebungen('trainPane');
  else if(name==='geraete') renderTrainGeraete();
  else if(name==='statistik') openTrainStats('trainPane');
}
function renderTrainGeraete(){
  const pane=document.getElementById("trainPane"); if(!pane) return;
  pane.innerHTML='<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px"><h3 style="margin:0 0 10px;font-size:17px">🏋️ Meine Geräte zuhause</h3><div id="pfGeraete">…</div></div>';
  renderProfilGeraete();
}
function renderTrainPlanPane(){
  const p=TRAIN||{}, tf=_trTf, pane=document.getElementById("trainPane");
  const card='background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:14px', h2='margin:0 0 10px;font-size:17px';
  const tfHtml=TF_SMILEYS.map((s,i)=>'<button onclick="setTagesform('+(i+1)+')" id="tf_'+(i+1)+'" style="font-size:26px;line-height:1;padding:6px 8px;border:2px solid '+(tf===i+1?'var(--k-16a34a)':'transparent')+';border-radius:10px;background:'+(tf===i+1?'var(--greenlt,var(--k-ecfdf5))':'var(--k-f8fafc)')+';cursor:pointer">'+s+'</button>').join("");
  pane.innerHTML=
    '<div style="'+card+'"><h3 style="'+h2+'">🗓️ Trainingsplan</h3>'
    +(p.Plan?planSummaryHtml(p.Plan):'<div style="font-size:13px;color:var(--muted);margin-bottom:8px">Aus Geräten, Zeit und Ziel automatisch einen Plan erstellen.</div>')
    +'<button onclick="openPlanGen()" style="padding:9px 14px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);cursor:pointer;font-size:14px">'+(p.Plan?'Plan neu erstellen':'Plan erstellen')+'</button>'
    +(p.Plan?'<button onclick="uebernehmenPlan()" style="margin-left:8px;padding:9px 14px;border:1px solid var(--green);border-radius:8px;background:var(--greenlt,var(--k-ecfdf5));color:var(--greendk,var(--k-166534));cursor:pointer;font-size:14px">📒 Ins Trainingstagebuch übernehmen</button>':'')
    +(p.Plan_aktiv_ab?'<div style="margin-top:10px;background:var(--greenlt,var(--k-ecfdf5));border:1px solid var(--green);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--greendk,var(--k-166534))">✓ Im Tagebuch aktiv ab <b>'+new Date(p.Plan_aktiv_ab+"T00:00:00").toLocaleDateString("de-DE")+'</b>'+(_adh?' · Zielerreichung: <b>'+_adh.absolviert+'/'+_adh.geplant+'</b> Einheiten absolviert'+(_adh.verpasst>0?' · <span style="color:var(--k-b45309)">'+_adh.verpasst+' verpasst</span>':''):'')+'</div>':'')
    +(p.Plan?'<div style="margin-top:12px">'+renderPlanHtml(p.Plan)+'</div>':'')
    +'</div>'
    +'<div style="'+card+'"><h3 style="'+h2+'">⏱️ Zeitbudget pro Training</h3>'
    +'<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">'
    +'<label style="font-size:14px">Winter (Min) <input id="zWinter" type="number" value="'+(p.Zeit_Winter_Min??120)+'" style="width:90px;padding:7px;border:1px solid var(--line);border-radius:8px;margin-left:6px"></label>'
    +'<label style="font-size:14px">Sommer (Min) <input id="zSommer" type="number" value="'+(p.Zeit_Sommer_Min??90)+'" style="width:90px;padding:7px;border:1px solid var(--line);border-radius:8px;margin-left:6px"></label>'
    +'<button onclick="saveTrainZeit()" style="padding:8px 14px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);cursor:pointer;font-size:14px">Speichern</button></div>'
    +'<div id="trainMsg" style="font-size:13px;color:var(--k-16a34a);margin-top:6px"></div></div>'
    +'<div style="'+card+'"><h3 style="'+h2+'">😊 Tagesform heute</h3><div style="display:flex;gap:8px">'+tfHtml+'</div>'
    +'<div id="tfMsg" style="font-size:12px;color:var(--k-16a34a);margin-top:6px"></div></div>';
}
let UEBUNGEN=null;
async function openUebungen(target){
  const host=target?document.getElementById(target):document.getElementById("panel");
  host.innerHTML=(target?'':'<button class="close" onclick="closeP()">Schließen ✕</button>')+'<h2 style="margin-top:0">💪 Übungs-Datenbank</h2><div id="uebFilter"></div><div id="uebList" style="margin-top:10px;color:var(--muted)">Lade…</div>';
  if(!target){ document.getElementById("overlay").classList.add("open"); document.getElementById("panel").scrollTop=0; }
  if(!UEBUNGEN){ try{ const {data}=await client.rpc("cb_uebungen"); UEBUNGEN=data||[]; }catch(e){ document.getElementById("uebList").innerHTML='<div style="color:var(--k-dc2626)">Fehler: '+esc(e.message)+'</div>'; return; } }
  const groups=[...new Set(UEBUNGEN.map(u=>u.muskelgruppe))].sort();
  const geraete=[...new Set(UEBUNGEN.filter(u=>u.geraet).map(u=>u.geraet))].sort();
  document.getElementById("uebFilter").innerHTML=
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">'
    +'<select id="uebGrp" onchange="renderUebungen()" style="padding:8px;border:1px solid var(--line);border-radius:8px;font-size:14px"><option value="">Alle Muskelgruppen</option>'+groups.map(g=>'<option>'+esc(g)+'</option>').join("")+'</select>'
    +'<select id="uebGer" onchange="renderUebungen()" style="padding:8px;border:1px solid var(--line);border-radius:8px;font-size:14px"><option value="">Alle Geräte</option><option value="__none__">ohne Gerät</option>'+geraete.map(g=>'<option>'+esc(g)+'</option>').join("")+'</select>'
    +'<label style="font-size:13px"><input type="checkbox" id="uebMine" onchange="renderUebungen()"> nur mit meinen Geräten</label></div>';
  renderUebungen();
}
function renderUebungen(){
  const grp=document.getElementById("uebGrp").value;
  const gerEl=document.getElementById("uebGer"); const ger=gerEl?gerEl.value:"";
  const mine=document.getElementById("uebMine").checked;
  const owned=new Set(Array.isArray(TRAIN&&TRAIN.Geraete)?TRAIN.Geraete:[]);
  const list=(UEBUNGEN||[]).filter(u=> (!grp||u.muskelgruppe===grp)
    && (!ger || (ger==="__none__" ? u.ohne_geraet : u.geraet===ger))
    && (!mine || u.ohne_geraet || (u.geraet && owned.has(u.geraet))) );
  const el=document.getElementById("uebList");
  if(!list.length){ el.innerHTML='<div style="color:var(--muted)">Keine Übungen für diese Auswahl.</div>'; return; }
  el.innerHTML=list.map((u,i)=>{
    const tag=u.ohne_geraet?'ohne Gerät':esc(u.geraet||'');
    return '<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px">'
     +'<div onclick="uebToggle('+i+')" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;gap:8px">'
     +'<b style="font-size:14px">'+esc(u.name)+'</b>'
     +'<span style="font-size:11px;color:var(--muted);white-space:nowrap;text-align:right">'+esc(u.muskelgruppe)+'<br>'+tag+'</span></div>'
     +'<div id="ueb_d_'+i+'" style="display:none;margin-top:8px;font-size:13px;color:var(--ink);line-height:1.5">'
       +(u.medien_url?'<img src="'+esc(u.medien_url)+'" alt="" style="max-width:100%;border-radius:8px;margin-bottom:8px">':'')
       +esc(u.ausfuehrung||'')
       +(u.sekundaer?'<div style="font-size:12px;color:var(--muted);margin-top:6px">Auch beansprucht: '+esc(u.sekundaer)+'</div>':'')
       +'<div style="font-size:11px;color:var(--muted);margin-top:6px">Schwierigkeit: '+esc(u.schwierigkeit||'–')+(u.quelle?(' · Quelle: '+esc(u.quelle)):'')+'</div>'
     +'</div></div>';
  }).join("");
}
function uebToggle(i){ const d=document.getElementById("ueb_d_"+i); if(d) d.style.display=(d.style.display==="none"?"block":"none"); }

/* ---- Trainingstagebuch ---- */
let TLOG_DATE=null;
async function openTrainLog(d, target){
  TLOG_DATE = d || TLOG_DATE || tbToday();
  if(!UEBUNGEN){ try{ const {data}=await client.rpc("cb_uebungen"); UEBUNGEN=data||[]; }catch(e){} }
  const host=target?document.getElementById(target):document.getElementById("panel");
  const dl=(UEBUNGEN||[]).map(u=>'<option value="'+esc(u.name)+'">').join("");
  const onch=target?("openTrainLog(this.value,'"+target+"')"):"openTrainLog(this.value)";
  host.innerHTML=(target?'':'<button class="close" onclick="closeP()">Schließen ✕</button>')+'<h2 style="margin-top:0">📒 Trainingstagebuch</h2>'
   +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><label style="font-size:13px">Datum</label><input type="date" id="tlDate" value="'+TLOG_DATE+'" onchange="'+onch+'" style="padding:7px;border:1px solid var(--line);border-radius:8px"></div>'
   +'<datalist id="tlDL">'+dl+'</datalist>'
   +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:12px">'
     +'<div style="flex:1;min-width:140px"><div style="font-size:11px;color:var(--muted)">Übung</div><input id="tlUeb" list="tlDL" placeholder="Übung suchen…" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px"></div>'
     +'<div><div style="font-size:11px;color:var(--muted)">Wdh</div><input id="tlWdh" type="number" inputmode="numeric" style="width:70px;padding:8px;border:1px solid var(--line);border-radius:8px"></div>'
     +'<div><div style="font-size:11px;color:var(--muted)">Gewicht (kg)</div><input id="tlKg" type="number" step="0.5" inputmode="decimal" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:8px"></div>'
     +'<button onclick="addTrainSatz()" style="padding:9px 14px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);cursor:pointer;font-size:14px">+ Satz</button></div>'
   +'<div id="tlList"></div>'
   +'<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--k-eef2f5)"><button onclick="openTimer()" style="padding:9px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);cursor:pointer;font-size:14px">⏱️ Intervall-Taktgeber</button></div>';
  if(!target){ document.getElementById("overlay").classList.add("open"); document.getElementById("panel").scrollTop=0; }
  renderTrainLogList();
}
async function uebernehmenPlan(){
  if(!(TRAIN&&TRAIN.Plan)){ return; }
  var t=new Date(); t.setDate(t.getDate()+1); var ab=tbISO(t);
  const {error}=await client.rpc("cb_train_plan_aktivieren",{p_ab:ab});
  if(error){ alert("Fehler: "+error.message); return; }
  loadTraining();
}
/* Plan-Einheit für ein Datum (nur ab Plan_aktiv_ab und passendem Wochentag) */
function planDayFor(ds){
  var pl=TRAIN&&TRAIN.Plan; if(!pl||!pl.tageliste||!pl.tageliste.length) return null;
  var ab=TRAIN&&TRAIN.Plan_aktiv_ab; if(!ab || ds<ab) return null;
  var wd=['So','Mo','Di','Mi','Do','Fr','Sa'][new Date(ds+'T00:00:00').getDay()];
  return (pl.tageliste||[]).find(function(d){return d.wochentag===wd;}) || null;
}
async function addTrainSatz2(j){
  var ex=(window._tlPlanEx||[])[j]; if(!ex) return;
  var wdh=parseInt((document.getElementById('pl_wdh_'+j)||{}).value)||null;
  var kg=_numOrNullId('pl_kg_'+j);
  const {error}=await client.rpc("cb_train_log_add",{p_datum:TLOG_DATE,p_uebung:ex.name,p_wdh:wdh,p_gewicht:kg});
  if(error){ alert("Fehler: "+error.message); return; }
  renderTrainLogList();
}
async function renderTrainLogList(){
  let rows=[]; try{ const {data}=await client.rpc("cb_train_log_tag",{p_datum:TLOG_DATE}); rows=data||[]; }catch(e){}
  const el=document.getElementById("tlList"); if(!el) return;
  const grp={}; rows.forEach(r=>{(grp[r.uebung]=grp[r.uebung]||[]).push(r);});
  var pd=planDayFor(TLOG_DATE);
  var past=(TLOG_DATE<tbToday());
  var html='';
  if(pd){
    window._tlPlanEx=pd.uebungen||[];
    var offen=(pd.uebungen||[]).some(function(u){return !(grp[u.name]&&grp[u.name].length);});
    html+='<div style="border:1px solid '+((past&&offen)?'var(--k-f59e0b)':'var(--green)')+';border-radius:10px;padding:10px 12px;margin-bottom:12px;background:'+((past&&offen)?'var(--k-fffbeb)':'var(--greenlt,var(--k-ecfdf5))')+'">'
      +'<div style="font-weight:700;font-size:14px;margin-bottom:2px;color:'+((past&&offen)?'var(--k-b45309)':'var(--greendk,var(--k-166534))')+'">📋 Einheit laut Plan: '+esc(pd.name)+(past&&offen?' · ⚠️ teils verpasst':'')+'</div>'
      +'<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Trag ein, was du wirklich geschafft hast.</div>'
      +(pd.uebungen||[]).map(function(u,j){
        var done=(grp[u.name]||[]).length;
        var num=/^[0-9]+$/.test(String(u.wdh||"").trim())?String(u.wdh).trim():"";
        return '<div style="background:var(--k-ffffff);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:6px">'
          +'<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;gap:8px"><span><b>'+esc(u.name)+'</b> <span style="color:var(--muted);font-size:11px">'+esc(u.muskelgruppe||"")+'</span></span><span style="color:'+(done>=u.saetze?'var(--k-16a34a)':'var(--muted)')+';font-size:12px;white-space:nowrap">Ziel '+u.saetze+'×'+esc(u.wdh)+' · '+done+'/'+u.saetze+'</span></div>'
          +'<div style="display:flex;gap:6px;align-items:center"><input id="pl_wdh_'+j+'" type="number" inputmode="numeric" value="'+num+'" placeholder="Wdh" style="width:66px;padding:6px;border:1px solid var(--line);border-radius:7px"><input id="pl_kg_'+j+'" type="number" step="0.5" inputmode="decimal" placeholder="kg" style="width:74px;padding:6px;border:1px solid var(--line);border-radius:7px"><button onclick="addTrainSatz2('+j+')" style="padding:6px 12px;border:0;border-radius:7px;background:var(--green);color:var(--auf-gruen);cursor:pointer;font-size:13px">✓ Satz</button></div>'
          +'</div>';
      }).join('')
      +(pd.cardio?'<div style="font-size:12.5px;color:var(--greendk,var(--k-166534));margin-top:2px">+ '+esc(pd.cardio)+'</div>':'')
      +'</div>';
  }
  if(rows.length){
    html+=Object.entries(grp).map(function(e){ var ueb=e[0], sets=e[1];
      var vol=sets.reduce(function(a,s){return a+(s.wiederholungen||0)*(s.gewicht_kg||0);},0);
      return '<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px"><div style="font-weight:600;font-size:14px;margin-bottom:4px">'+esc(ueb)+' <span style="font-weight:400;color:var(--muted);font-size:12px">· '+sets.length+' Sätze · Vol '+Math.round(vol)+' kg</span></div>'
       +sets.map(function(s){return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13.5px;padding:3px 0"><span>Satz '+s.satz+': '+(s.wiederholungen==null?'–':s.wiederholungen)+' Wdh × '+(s.gewicht_kg==null?'–':s.gewicht_kg)+' kg</span><button onclick="delTrainSatz('+s.log_id+')" style="border:0;background:var(--k-f6f8f7);color:var(--k-dc2626);border-radius:6px;width:24px;height:24px;cursor:pointer">✕</button></div>';}).join("")
       +'</div>';
    }).join("");
  } else if(!pd){
    html='<div style="color:var(--muted);font-size:14px">Noch keine Sätze an diesem Tag.</div>';
  }
  el.innerHTML=html;
}
async function addTrainSatz(){
  const ueb=(document.getElementById("tlUeb").value||"").trim();
  if(!ueb){ alert("Bitte eine Übung wählen/eintragen."); return; }
  const wdh=parseInt(document.getElementById("tlWdh").value)||null;
  const kg=_numOrNullId("tlKg");
  const {error}=await client.rpc("cb_train_log_add",{p_datum:TLOG_DATE,p_uebung:ueb,p_wdh:wdh,p_gewicht:kg});
  if(error){ alert("Fehler: "+error.message); return; }
  document.getElementById("tlWdh").value=""; document.getElementById("tlKg").value=""; document.getElementById("tlUeb").focus();
  renderTrainLogList();
}
async function delTrainSatz(id){ await client.rpc("cb_train_log_del",{p_log:id}); renderTrainLogList(); }

/* ---- Statistik & Fortschritt ---- */
function sparkline(arr){
  const vals=arr.map(x=>x==null?null:Number(x)); const nums=vals.filter(x=>x!=null);
  if(nums.length<1) return '<span style="flex:1;color:var(--muted);font-size:12px">–</span>';
  const min=Math.min(...nums), max=Math.max(...nums), rng=(max-min)||1, w=160, h=34, n=vals.length;
  const pts=vals.map((x,i)=>{ const px=n>1?(i/(n-1))*w:0; const py=x==null?h:(h-((x-min)/rng)*(h-4)-2); return px.toFixed(1)+','+py.toFixed(1); });
  const line=pts.filter((p,i)=>vals[i]!=null).join(" ");
  return '<svg width="'+w+'" height="'+h+'" style="flex:0 0 auto"><polyline points="'+line+'" fill="none" stroke="var(--k-16a34a)" stroke-width="2"/></svg>';
}
async function openTrainStats(target){
  const host=target?document.getElementById(target):document.getElementById("panel");
  host.innerHTML=(target?'':'<button class="close" onclick="closeP()">Schließen ✕</button>')+'<h2 style="margin-top:0">📈 Statistik & Fortschritt</h2><div id="stArea" style="color:var(--muted)">Lade…</div>';
  if(!target){ document.getElementById("overlay").classList.add("open"); document.getElementById("panel").scrollTop=0; }
  let list=[]; try{ const {data}=await client.rpc("cb_train_log_uebungen"); list=data||[]; }catch(e){}
  let html='';
  if(list.length){ html+='<div style="margin-bottom:8px"><label style="font-size:13px">Übung </label><select id="stUeb" onchange="renderStatUeb()" style="padding:8px;border:1px solid var(--line);border-radius:8px">'+list.map(u=>'<option>'+esc(u.uebung)+'</option>').join("")+'</select></div><div id="stUebBox"></div>'; }
  else { html+='<div style="color:var(--muted);font-size:14px">Noch keine Trainingsdaten – trag erst ein paar Sätze ein.</div>'; }
  let ms=[]; try{ const {data}=await client.rpc("cb_mass_historie",{p_limit:20}); ms=(data||[]).slice().reverse(); }catch(e){}
  if(ms.length>=2){
    html+='<h3 style="font-size:15px;margin:16px 0 6px">Körpermaße-Trend</h3>';
    MASS.forEach(([k,label,col])=>{ const vals=ms.map(r=>r[col]).filter(v=>v!=null); if(vals.length>=2){ html+='<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="width:96px;font-size:13px;color:var(--ink)">'+label+'</span>'+sparkline(ms.map(r=>r[col]))+'<span style="font-size:12px;color:var(--muted)">'+vals[vals.length-1]+' cm</span></div>'; } });
  }
  document.getElementById("stArea").innerHTML=html;
  if(list.length) renderStatUeb();
}
async function renderStatUeb(){
  const ueb=document.getElementById("stUeb").value;
  let v=[]; try{ const {data}=await client.rpc("cb_train_verlauf",{p_uebung:ueb,p_limit:30}); v=data||[]; }catch(e){}
  const box=document.getElementById("stUebBox"); if(!box) return;
  if(v.length<1){ box.innerHTML='<div style="color:var(--muted)">Keine Daten.</div>'; return; }
  const maxG=v.map(x=>x.max_gewicht), vol=v.map(x=>x.volumen);
  const lastG=maxG[maxG.length-1], firstG=maxG.find(x=>x!=null);
  box.innerHTML='<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px">'
   +'<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="width:96px;font-size:13px">Max. Gewicht</span>'+sparkline(maxG)+'<span style="font-size:12px;color:var(--muted)">'+(lastG??'–')+' kg</span></div>'
   +'<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="width:96px;font-size:13px">Volumen</span>'+sparkline(vol)+'<span style="font-size:12px;color:var(--muted)">'+Math.round(vol[vol.length-1]||0)+'</span></div>'
   +'<div style="font-size:12px;color:var(--muted);margin-top:6px">'+v.length+' Trainingstage'+((lastG!=null&&firstG!=null)?(' · Δ '+(Math.round((lastG-firstG)*10)/10)+' kg'):'')+'</div></div>';
}

/* ---- Intervall-Taktgeber ---- */
let _timer={id:null,phase:null,rem:0,round:0,work:40,rest:20,rounds:8};
function openTimer(){
  const panel=document.getElementById("panel");
  panel.innerHTML='<button class="close" onclick="stopTimer();closeP()">Schließen ✕</button><h2 style="margin-top:0">⏱️ Intervall-Taktgeber</h2>'
   +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
   +'<label style="font-size:13px">Arbeit (s)<br><input id="tmWork" type="number" value="'+_timer.work+'" style="width:80px;padding:7px;border:1px solid var(--line);border-radius:8px"></label>'
   +'<label style="font-size:13px">Pause (s)<br><input id="tmRest" type="number" value="'+_timer.rest+'" style="width:80px;padding:7px;border:1px solid var(--line);border-radius:8px"></label>'
   +'<label style="font-size:13px">Runden<br><input id="tmRounds" type="number" value="'+_timer.rounds+'" style="width:80px;padding:7px;border:1px solid var(--line);border-radius:8px"></label></div>'
   +'<div id="tmDisplay" style="text-align:center;font-size:48px;font-weight:800;color:var(--k-16a34a);margin:10px 0">Bereit</div>'
   +'<div id="tmPhase" style="text-align:center;color:var(--muted);margin-bottom:12px"></div>'
   +'<div style="display:flex;gap:8px;justify-content:center"><button onclick="startTimer()" style="padding:11px 20px;border:0;border-radius:10px;background:var(--green);color:var(--auf-gruen);font-size:15px;cursor:pointer">Start</button><button onclick="stopTimer()" style="padding:11px 20px;border:0;border-radius:10px;background:var(--k-eef2f5);color:var(--ink);font-size:15px;cursor:pointer">Stop</button></div>';
  document.getElementById("overlay").classList.add("open");
}
function _beep(freq){ try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const o=ac.createOscillator(),g=ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value=freq||880; o.start(); g.gain.setValueAtTime(0.2,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.25); o.stop(ac.currentTime+0.26);}catch(e){} }
function stopTimer(){ if(_timer.id){ clearInterval(_timer.id); _timer.id=null; } const d=document.getElementById("tmDisplay"); if(d) d.textContent="Bereit"; const p=document.getElementById("tmPhase"); if(p) p.textContent=""; }
function updTimer(){ const d=document.getElementById("tmDisplay"),p=document.getElementById("tmPhase"); if(d){ d.textContent=_timer.rem+"s"; d.style.color=_timer.phase==="Pause"?"var(--k-e8920c)":"var(--k-16a34a)"; } if(p) p.textContent=_timer.phase+" · Runde "+_timer.round+"/"+_timer.rounds; }
function startTimer(){
  stopTimer();
  _timer.work=parseInt(document.getElementById("tmWork").value)||40;
  _timer.rest=parseInt(document.getElementById("tmRest").value)||20;
  _timer.rounds=parseInt(document.getElementById("tmRounds").value)||8;
  _timer.round=1; _timer.phase="Arbeit"; _timer.rem=_timer.work; _beep(880); updTimer();
  _timer.id=setInterval(()=>{
    _timer.rem--;
    if(_timer.rem<=0){
      if(_timer.phase==="Arbeit"){ _timer.phase="Pause"; _timer.rem=_timer.rest; _beep(440); }
      else { _timer.round++; if(_timer.round>_timer.rounds){ stopTimer(); const d=document.getElementById("tmDisplay"); if(d) d.textContent="Fertig 🎉"; _beep(1200); return; } _timer.phase="Arbeit"; _timer.rem=_timer.work; _beep(880); }
    }
    updTimer();
  },1000);
}
/* ---- Trainingsplan-Generator (Phase C) ---- */
let _genPlan=null;
function planTageTxt(pl){ return (pl&&pl.wochentage&&pl.wochentage.length)?pl.wochentage.join('/'):(String((pl&&pl.tage)||'')+' Tage/Woche'); }
function planSummaryHtml(pl){ if(!pl) return ''; return '<div style="font-size:13px;color:var(--ink);margin-bottom:8px">Aktuell: <b>'+esc(pl.ziel||'')+'</b> · '+esc(planTageTxt(pl))+' · '+esc(pl.schema||'')+'</div>'; }
function planSplit(t){
  if(t<=2) return Array.from({length:t},(_,i)=>({name:'Ganzkörper'+(t>1?(' '+String.fromCharCode(65+i)):''),gruppen:['Brust','Rücken','Beine','Schultern','Arme','Rumpf/Core']}));
  if(t===3) return [
    {name:'Push (Brust/Schultern/Trizeps)',gruppen:['Brust','Schultern','Arme']},
    {name:'Pull (Rücken/Bizeps)',gruppen:['Rücken','Arme']},
    {name:'Beine & Core',gruppen:['Beine','Rumpf/Core']}];
  if(t===4) return [
    {name:'Oberkörper A',gruppen:['Brust','Rücken','Schultern','Arme']},
    {name:'Unterkörper A',gruppen:['Beine','Rumpf/Core']},
    {name:'Oberkörper B',gruppen:['Brust','Rücken','Schultern','Arme']},
    {name:'Unterkörper B',gruppen:['Beine','Rumpf/Core']}];
  const ppl=[{name:'Push',gruppen:['Brust','Schultern','Arme']},{name:'Pull',gruppen:['Rücken','Arme']},{name:'Beine & Core',gruppen:['Beine','Rumpf/Core']}];
  return Array.from({length:t},(_,i)=>({name:ppl[i%3].name+' '+(Math.floor(i/3)+1),gruppen:ppl[i%3].gruppen}));
}
function pickExercises(pool,gruppen,n){
  const shuffle=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const inGroup=pool.filter(u=>gruppen.includes(u.muskelgruppe));
  const byG={}; gruppen.forEach(g=>{ byG[g]=shuffle(inGroup.filter(u=>u.muskelgruppe===g)); });
  const picks=[],used=new Set(); let added=true;
  while(picks.length<n && added){ added=false;
    for(const g of gruppen){ if(picks.length>=n) break;
      const arr=byG[g]; while(arr&&arr.length){ const u=arr.shift(); if(!used.has(u.name)){ used.add(u.name); picks.push(u); added=true; break; } }
    }
  }
  if(picks.length<n){ for(const u of shuffle(pool)){ if(picks.length>=n) break; if(!used.has(u.name)){ used.add(u.name); picks.push(u); } } }
  return picks;
}
async function openPlanGen(){
  if(!UEBUNGEN){ try{ const {data}=await client.rpc("cb_uebungen"); UEBUNGEN=data||[]; }catch(e){} }
  const m=new Date().getMonth()+1, sommer=(m>=4&&m<=9);
  const dauer = sommer ? ((TRAIN&&TRAIN.Zeit_Sommer_Min)||90) : ((TRAIN&&TRAIN.Zeit_Winter_Min)||120);
  const panel=document.getElementById("panel");
  panel.innerHTML='<button class="close" onclick="closeP()">Schließen ✕</button><h2 style="margin-top:0">🗓️ Trainingsplan erstellen</h2>'
   +'<div style="font-size:13px;margin-bottom:10px"><div style="margin-bottom:5px;font-weight:600">Trainingstage (anhaken)</div><div id="pgTageBox" style="display:flex;gap:5px;flex-wrap:wrap">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map((d,i)=>'<label style="display:inline-flex;align-items:center;gap:4px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;cursor:pointer"><input type="checkbox" class="pgTag" value="'+i+'" data-lbl="'+d+'"'+([0,2,4].indexOf(i)>=0?' checked':'')+' style="margin:0">'+d+'</label>').join("")+'</div></div>'
   +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
   +'<label style="font-size:13px">Ziel<br><select id="pgZiel" style="padding:8px;border:1px solid var(--line);border-radius:8px"><option>Muskelaufbau</option><option>Kraft</option><option>Abnehmen &amp; Ausdauer</option><option>Allgemein fit</option></select></label>'
   +'<label style="font-size:13px">Dauer/Einheit (Min)<br><input id="pgDauer" type="number" value="'+dauer+'" style="width:90px;padding:8px;border:1px solid var(--line);border-radius:8px"></label>'
   +'<label style="font-size:13px">Sätze<br><input id="pgSaetze" type="number" min="1" max="10" value="3" style="width:64px;padding:8px;border:1px solid var(--line);border-radius:8px"></label>'
   +'<label style="font-size:13px">Wiederholungen<br><input id="pgWdh" value="10" style="width:100px;padding:8px;border:1px solid var(--line);border-radius:8px"></label>'
   +'</div>'
   +'<label style="font-size:13px;display:block;margin-bottom:12px"><input type="checkbox" id="pgMine" checked> nur mit meinen Geräten</label>'
   +'<button onclick="genPlan()" style="padding:10px 16px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);cursor:pointer;font-size:14px">Plan erstellen</button>'
   +'<div id="pgResult" style="margin-top:14px"></div>';
  document.getElementById("overlay").classList.add("open"); panel.scrollTop=0;
}
function genPlan(){
  const tagCbs=[...document.querySelectorAll('.pgTag:checked')];
  if(!tagCbs.length){ alert("Bitte mindestens einen Trainingstag anhaken."); return; }
  const wochentage=tagCbs.map(c=>c.dataset.lbl);
  const tage=wochentage.length;
  const ziel=document.getElementById("pgZiel").value;
  const dauer=parseInt(document.getElementById("pgDauer").value)||90;
  const mine=document.getElementById("pgMine").checked;
  const uSaetze=Math.max(1,Math.min(10,parseInt(document.getElementById("pgSaetze").value)||3));
  const uWdh=(document.getElementById("pgWdh").value||"10").trim()||"10";
  const owned=new Set(Array.isArray(TRAIN&&TRAIN.Geraete)?TRAIN.Geraete:[]);
  const pool=(UEBUNGEN||[]).filter(u=> !mine || u.ohne_geraet || (u.geraet && owned.has(u.geraet)));
  const schema={'Muskelaufbau':{s:4,w:'8–12',c:0},'Kraft':{s:5,w:'4–6',c:0},'Abnehmen & Ausdauer':{s:3,w:'12–15',c:15},'Allgemein fit':{s:3,w:'10–12',c:10}}[ziel]||{s:3,w:'10–12',c:0};
  const cardioVerf = pool.some(u=>/Cardio/i.test(u.muskelgruppe||""));
  const cardioMin = (schema.c && cardioVerf)?schema.c:0;
  const nUeb=Math.max(3,Math.min(7,Math.floor((dauer-cardioMin)/12)));
  const plan={erstellt:tbToday(),ziel:ziel,tage:tage,wochentage:wochentage,dauer:dauer,schema:uSaetze+' Sätze × '+uWdh+' Wdh',tageliste:[]};
  const grpImPool=new Set((pool||[]).map(u=>u.muskelgruppe).filter(Boolean));
  const alleGrp=['Brust','Rücken','Beine','Schultern','Arme','Rumpf/Core'];
  let split=planSplit(tage);
  if(grpImPool.size<4){ split=Array.from({length:tage},(_,i)=>({name:'Ganzkörper'+(tage>1?(' '+String.fromCharCode(65+i)):''),gruppen:alleGrp})); }
  split.forEach((day,di)=>{
    const picks=pickExercises(pool,day.gruppen,nUeb);
    plan.tageliste.push({name:day.name,wochentag:wochentage[di]||'',uebungen:picks.map(u=>({name:u.name,muskelgruppe:u.muskelgruppe,saetze:uSaetze,wdh:uWdh})),cardio:(cardioMin?('Cardio '+cardioMin+' min'):null)});
  });
  _genPlan=plan; renderPlanPreview(plan);
}
function renderPlanHtml(pl){
  return (pl.tageliste||[]).map((d,i)=>'<div style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px"><div style="font-weight:700;font-size:14px;margin-bottom:6px">'+(d.wochentag?esc(d.wochentag):'Tag '+(i+1))+': '+esc(d.name)+'</div>'
    +(d.uebungen||[]).map(u=>'<div style="display:flex;justify-content:space-between;font-size:13.5px;padding:2px 0;gap:8px"><span>'+esc(u.name)+' <span style="color:var(--muted);font-size:11px">'+esc(u.muskelgruppe)+'</span></span><span style="color:var(--muted);white-space:nowrap">'+u.saetze+' × '+esc(u.wdh)+'</span></div>').join("")
    +(d.cardio?'<div style="font-size:13px;color:var(--k-16a34a);margin-top:4px">+ '+esc(d.cardio)+'</div>':'')+'</div>').join("");
}
function renderPlanPreview(pl){
  document.getElementById("pgResult").innerHTML='<div style="font-size:13px;color:var(--muted);margin:4px 0 8px">'+esc(pl.ziel)+' · '+esc(planTageTxt(pl))+' · '+esc(pl.schema)+'</div>'+renderPlanHtml(pl)
   +'<div style="display:flex;gap:8px;margin-top:6px"><button onclick="savePlan()" style="padding:10px 16px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);cursor:pointer;font-size:14px">Plan speichern</button><button onclick="genPlan()" style="padding:10px 16px;border:1px solid var(--line);border-radius:8px;background:var(--card);cursor:pointer;font-size:14px">Neu würfeln</button></div>';
}
async function savePlan(){
  if(!_genPlan) return;
  const {error}=await client.rpc("cb_train_plan_speichern",{p_plan:_genPlan});
  if(error){ alert("Fehler: "+error.message); return; }
  closeP(); loadTraining();
}
function openPlanView(){
  const pl=TRAIN&&TRAIN.Plan; if(!pl) return;
  const panel=document.getElementById("panel");
  panel.innerHTML='<button class="close" onclick="closeP()">Schließen ✕</button><h2 style="margin-top:0">🗓️ Mein Trainingsplan</h2><div style="font-size:13px;color:var(--muted);margin-bottom:8px">'+esc(pl.ziel||'')+' · '+esc(planTageTxt(pl))+' · '+esc(pl.schema||'')+'</div>'+renderPlanHtml(pl);
  document.getElementById("overlay").classList.add("open"); panel.scrollTop=0;
}
function personSvg(){
  return '<svg viewBox="0 0 80 170" width="110" height="200" aria-hidden="true">'
   +'<circle cx="40" cy="16" r="12" fill="var(--k-d1fae5)" stroke="var(--k-16a34a)"/>'
   +'<path d="M40 28 C24 30 22 44 24 60 L20 96 L28 96 L32 64 L32 150 L38 150 L40 100 L42 150 L48 150 L48 64 L52 96 L60 96 L56 60 C58 44 56 30 40 28 Z" fill="var(--k-ecfdf5)" stroke="var(--k-16a34a)"/>'
   +'</svg><div style="font-size:11px;color:var(--muted);margin-top:2px">Maße in cm</div>';
}
async function setTagesform(v){
  for(let i=1;i<=5;i++){ const b=document.getElementById("tf_"+i); if(b){ b.style.borderColor=(i===v)?"var(--k-16a34a)":"transparent"; b.style.background=(i===v)?"var(--greenlt,var(--k-ecfdf5))":"var(--k-f8fafc)"; } }
  const {error}=await client.rpc("cb_tagesform_setzen",{p_datum:null,p_wert:v});
  const m=document.getElementById("tfMsg"); if(m) m.textContent=error?("Fehler: "+error.message):"✓ Tagesform gespeichert";
}
async function saveTrainZeit(){
  const msg=document.getElementById("trainMsg");
  const {error}=await client.rpc("cb_train_zeit_speichern",{p_winter:parseInt(document.getElementById("zWinter").value)||120,p_sommer:parseInt(document.getElementById("zSommer").value)||90});
  if(msg){ msg.style.color=error?"var(--k-dc2626)":"var(--k-16a34a)"; msg.textContent=error?("Fehler: "+error.message):"✓ Gespeichert"; }
}
function _numOrNullId(id){ const el=document.getElementById(id); if(!el) return null; const v=(el.value||"").trim(); return v===""?null:parseFloat(v.replace(",",".")); }

/* ===== Profil: Geräte zuhause ===== */
async function renderProfilGeraete(){
  const box=document.getElementById("pfGeraete"); if(!box) return;
  let p={},kat=[];
  try{ const r=await client.rpc("cb_train_profil"); p=Array.isArray(r.data)?(r.data[0]||{}):(r.data||{}); }catch(e){}
  try{ const r=await client.rpc("cb_geraete_katalog"); kat=r.data||[]; }catch(e){}
  const owned=new Set(Array.isArray(p.Geraete)?p.Geraete:[]);
  const groups={}; kat.forEach(g=>{(groups[g.gruppe]=groups[g.gruppe]||[]).push(g.name);});
  const gh=Object.entries(groups).map(([grp,names])=>
    '<div style="margin-bottom:8px"><div style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">'+esc(grp)+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px">'+names.map(n=>{const on=owned.has(n);
      return '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid '+(on?'var(--k-16a34a)':'var(--line)')+';border-radius:999px;background:'+(on?'var(--greenlt,var(--k-ecfdf5))':'var(--k-ffffff)')+';cursor:pointer;font-size:13px"><input type="checkbox" class="pfGkChk" onchange="pfGkToggle(this)" value="'+esc(n)+'"'+(on?' checked':'')+' style="margin:0"> '+esc(n)+'</label>';
    }).join("")+'</div></div>').join("");
  box.innerHTML='<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Für den Trainingsplan-Generator (auch Multitower/Kabelzug).</div>'+gh
    +'<div style="margin-top:8px;font-size:12.5px;color:var(--muted)">Auswahl wird automatisch gespeichert. <span id="pfGkMsg" style="font-size:13px;margin-left:6px"></span></div>';
}
function pfGkToggle(cb){
  var lab=cb.closest('label');
  if(lab){ lab.style.borderColor=cb.checked?'var(--k-16a34a)':'var(--line)'; lab.style.background=cb.checked?'var(--greenlt,var(--k-ecfdf5))':'var(--k-ffffff)'; }
  saveProfilGeraete();
}
async function saveProfilGeraete(){
  const g=Array.from(document.querySelectorAll(".pfGkChk")).filter(c=>c.checked).map(c=>c.value);
  const msg=document.getElementById("pfGkMsg");
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; }
  const {error}=await client.rpc("cb_train_geraete_speichern",{p_geraete:g});
  if(msg){ msg.style.color=error?"var(--k-dc2626)":"var(--k-16a34a)"; msg.textContent=error?("Fehler: "+error.message):"✓ gespeichert"; }
}

/* ===== Profil: Körpermaße (Body-Map) ===== */
function _figFallback(img){ img.onerror=null; var d=document.createElement('div'); d.innerHTML=bodyFigureSvgFallback(); if(d.firstChild) img.replaceWith(d.firstChild); }
function bodyFigureSvg(){
  var sex=((document.getElementById('pfGeschlecht')||{}).value||'').toLowerCase();
  /* -t = freigestellte Variante mit transparentem Hintergrund */
  var src = sex==='männlich' ? 'figur-mann-t.webp' : (sex==='weiblich' ? 'figur-frau-t.webp' : '');
  if(src){
    return '<img src="'+src+'" alt="Körperfigur" height="380" style="display:block;margin:0 auto;height:380px;width:auto;object-fit:contain;background:transparent" onerror="_figFallback(this)">';
  }
  return bodyFigureSvgFallback();
}
function bodyFigureSvgFallback(){
  const f='var(--k-cdeed9)', s='var(--k-16a34a)';
  return '<svg viewBox="0 0 140 320" width="124" height="284" style="display:block;margin:0 auto">'
   +'<circle cx="70" cy="26" r="17" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="62" y="42" width="16" height="12" rx="5" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="46" y="52" width="48" height="120" rx="20" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="26" y="58" width="18" height="100" rx="9" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="96" y="58" width="18" height="100" rx="9" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="48" y="166" width="44" height="36" rx="14" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="50" y="196" width="18" height="112" rx="9" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'<rect x="72" y="196" width="18" height="112" rx="9" fill="'+f+'" stroke="'+s+'" stroke-width="2.5"/>'
   +'</svg>';
}
/* FE-1 (02.09.2026): Veraenderung sichtbar machen.
   _massVorwert sucht je Spalte den letzten Wert VOR der aktuellen Messung, der nicht leer ist.
   Ohne diese Suche waere das Delta falsch, sobald eine Messung nur einen Teil der Felder hat:
   Zeile n-1 kann bei "Oberarm" null sein, obwohl Zeile n-3 einen Wert hat. */
function _massVorwert(hist, col){
  for(let i=1;i<hist.length;i++){ const v=hist[i][col]; if(v!=null&&v!=='') return {wert:Number(v), datum:hist[i].Datum}; }
  return null;
}
/* Das Delta steht in DERSELBEN Zeile wie die Beschriftung, rechtsbuendig - nicht darunter.
   Gegenmessung 02.09. am Live-Stand: als eigene Zeile unter dem Feld waechst die Spalte um
   14 px und die Beschriftung des naechsten Masses wird ueberdeckt ("-1 cm" lag auf "Taille").
   In der Label-Zeile kostet es keine Hoehe, die Positionen bleiben unveraendert. */
function _massDeltaHtml(hist, col){
  if(!hist||!hist.length) return '';
  const akt=hist[0][col]; if(akt==null||akt==='') return '';
  const vor=_massVorwert(hist, col);
  if(!vor) return '<span style="font-size:9.5px;color:var(--muted);white-space:nowrap">neu</span>';
  const d=Math.round((Number(akt)-vor.wert)*10)/10;
  const farbe = d===0 ? 'var(--muted)' : (d<0 ? 'var(--k-16a34a)' : 'var(--k-b45309)');
  const txt = d===0 ? '±0' : ((d>0?'+':'−')+String(Math.abs(d)).replace('.',','));
  return '<span title="gegen die Messung vom '+esc(vor.datum)+' ('+String(vor.wert).replace('.',',')+' cm)" style="font-size:10px;font-weight:600;color:'+farbe+';white-space:nowrap">'+txt+'</span>';
}
function bodyMapHtml(last, hist){
  /* 02.09.2026 (FE-1, Ralphs Sichtpruefung): Die acht Bloecke lagen mit festen top-Pixeln
     auf position:absolute. Der Erklaertext darunter ist je Mass 1 bis 3 Zeilen lang, die
     Bloecke also verschieden hoch - Taille/Bauch stiessen zusammen, Bauch/Oberschenkel klaffte.
     Feste Pixel gegen variable Texthoehe zu rechnen geht nicht auf; jede neue Zeile bricht es
     wieder. Deshalb jetzt zwei Flex-Spalten links und rechts der Figur mit gleichem Abstand:
     Ueberlappung ist damit baulich unmoeglich, egal wie lang ein Text wird.
     Der lange Messhinweis steht als Tooltip am Block, die Kurzform bleibt sichtbar. */
  const links=['brust','taille','bauch','oberschenkel'], rechts=['oberarm','po','huefte','beine'];
  const labels={po:'Po',huefte:'Hüfte',beine:'Beine',oberarm:'Oberarm',brust:'Brust',taille:'Taille',bauch:'Bauch',oberschenkel:'Oberschenkel'};
  const cols={po:'Po',huefte:'Huefte',beine:'Beine',oberarm:'Oberarm',brust:'Brust',taille:'Taille',bauch:'Bauch',oberschenkel:'Oberschenkel'};
  /* Messpunkte: Taille = schmalste Stelle, Mitte zwischen unterster Rippe und Beckenkamm (WHO STEPS).
     Bauch = auf Nabelhöhe und liegt damit TIEFER als die Taille – deshalb die Reihenfolge oben. */
  const kurz={
    brust:'stärkste Stelle',
    taille:'schmalste Stelle',
    bauch:'auf Nabelhöhe',
    oberschenkel:'dickste Stelle',
    oberarm:'Mitte des Oberarms',
    po:'größter Umfang',
    huefte:'über dem Beckenkamm',
    beine:'Wade, stärkste Stelle'
  };
  const hints={
    brust:'stärkste Stelle, Band waagerecht über die Brustwarzen',
    taille:'schmalste Stelle – Mitte zwischen unterster Rippe und Beckenkamm',
    bauch:'auf Höhe des Bauchnabels',
    oberschenkel:'dickste Stelle, direkt unter der Gesäßfalte',
    oberarm:'Mitte zwischen Schulter und Ellenbogen, Arm entspannt',
    po:'größter Umfang des Gesäßes',
    huefte:'über den Hüftknochen (Beckenkamm)',
    beine:'Wade an der stärksten Stelle'
  };
  const h=hist||[];
  const block=k=>{ const v=(last[cols[k]]!=null?last[cols[k]]:'');
    return '<div title="'+esc(hints[k])+'">'
      +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:4px"><span style="font-size:11.5px;font-weight:600;color:var(--ink)">'+labels[k]+'</span>'+_massDeltaHtml(h, cols[k])+'</div>'
      +'<div style="font-size:9.5px;color:var(--muted);line-height:1.2;height:12px;overflow:hidden;margin:1px 0 3px">'+kurz[k]+'</div>'
      +'<input id="m_'+k+'" type="number" step="0.1" inputmode="decimal" value="'+v+'" placeholder="cm" style="width:100%;box-sizing:border-box;padding:6px;border:1px solid var(--line);border-radius:8px;text-align:center;font-size:13px"></div>';
  };
  const spalte=ks=>'<div style="display:flex;flex-direction:column;justify-content:space-between;gap:10px;min-width:0">'+ks.map(block).join('')+'</div>';
  return '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:stretch;max-width:430px;margin:0 auto">'
    +spalte(links)
    +'<div id="bodyFigWrap" style="display:flex;align-items:center;justify-content:center;pointer-events:none">'+bodyFigureSvg()+'</div>'
    +spalte(rechts)+'</div>'
    +'<div style="text-align:center;font-size:11px;color:var(--muted);margin-top:2px">Alle Maße in cm</div>'
    +'<div style="margin-top:10px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:11.5px;color:var(--muted);line-height:1.5">'
      +'<b style="color:var(--ink)">So misst du richtig:</b> Maßband waagerecht anlegen, nicht einschnüren, locker ausatmen – nicht die Luft anhalten oder den Bauch einziehen. Immer <b>zur selben Tageszeit</b> messen (am besten morgens, nüchtern), sonst vergleichst du Tagesform statt Fortschritt.'
      +'<div style="margin-top:5px"><b style="color:var(--ink)">Taille vs. Bauch:</b> Die Taille ist die <b>schmalste</b> Stelle (Mitte zwischen unterster Rippe und Beckenkamm), der Bauchumfang wird tiefer auf <b>Nabelhöhe</b> gemessen. Die Taille liegt also <b>über</b> dem Bauch.</div>'
      +'<div style="margin-top:5px">Der Taillenumfang ist der aussagekräftigste Einzelwert: Die WHO stuft ihn ab <b>94 cm</b> (Männer) bzw. <b>80 cm</b> (Frauen) als erhöht ein, ab <b>102</b> bzw. <b>88 cm</b> als deutlich erhöht. <i>Orientierungswerte, keine Diagnose.</i></div>'
    +'</div>';
}
/* ---- FE-1 Verlauf: Umschalter Diagramm | Tabelle (Ralph, 02.09.2026) ----
   MASS_HIST haelt die zuletzt geladene Historie, damit das Umschalten keinen neuen
   Serveraufruf braucht. Neueste Messung steht an Position 0, wie cb_mass_historie liefert. */
var MASS_HIST=[], MASS_ANSICHT='chart', MASS_REIHE='gesamt';
var MASS_SPALTEN=[["gesamt","Gesamtumfang"],["Brust","Brust"],["Taille","Taille"],["Bauch","Bauch"],["Huefte","Hüfte"],["Po","Po"],["Oberschenkel","Oberschenkel"],["Oberarm","Oberarm"],["Beine","Beine"]];
/* Gesamtumfang = Summe der acht Masse. Nur fuer Messungen, bei denen ALLE acht Werte
   vorliegen - sonst faellt die Summe ab, weil ein Feld leer war, und das saehe wie ein
   Erfolg aus. Unvollstaendige Messungen werden im Gesamtverlauf ausgelassen. */
function _massReihe(hist, key){
  const alle=["Brust","Taille","Bauch","Huefte","Po","Oberschenkel","Oberarm","Beine"];
  return hist.slice().reverse().map(r=>{
    let v=null;
    if(key==='gesamt'){ if(alle.every(c=>r[c]!=null&&r[c]!=='')) v=Math.round(alle.reduce((s,c)=>s+Number(r[c]),0)*10)/10; }
    else if(r[key]!=null&&r[key]!=='') v=Number(r[key]);
    return {datum:r.Datum, wert:v};
  }).filter(p=>p.wert!=null);
}
function _dTag(d){ const s=String(d||''); return s.length===10?(s.slice(8,10)+'.'+s.slice(5,7)+'.'):s; }
function massChartHtml(hist){
  const pts=_massReihe(hist, MASS_REIHE);
  const name=(MASS_SPALTEN.find(c=>c[0]===MASS_REIHE)||['','Maß'])[1];
  if(pts.length<2){
    return '<div style="padding:22px 12px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:10px">'
      +(MASS_REIHE==='gesamt'
        ? 'Für den Gesamtumfang braucht es mindestens zwei Messungen, bei denen alle acht Maße ausgefüllt sind.'
        : 'Für '+esc(name)+' liegen noch keine zwei Messungen vor.')+'</div>';
  }
  const W=640,H=230,L=46,R=14,T=16,B=30;
  const vals=pts.map(p=>p.wert);
  let min=Math.min(...vals), max=Math.max(...vals);
  if(max-min<1){ const m=(max+min)/2; min=m-0.5; max=m+0.5; }        /* flache Reihe nicht als Zickzack zeigen */
  const pad=(max-min)*0.15; min-=pad; max+=pad;
  const x=i=>L+(pts.length===1?0:i*(W-L-R)/(pts.length-1));
  const y=v=>T+(H-T-B)*(1-(v-min)/(max-min));
  const linie=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.wert).toFixed(1)).join(' ');
  const flaeche=linie+' L '+x(pts.length-1).toFixed(1)+' '+(H-B)+' L '+x(0).toFixed(1)+' '+(H-B)+' Z';
  let gitter='';
  for(let i=0;i<=3;i++){ const v=min+(max-min)*i/3, yy=y(v);
    gitter+='<line x1="'+L+'" y1="'+yy.toFixed(1)+'" x2="'+(W-R)+'" y2="'+yy.toFixed(1)+'" stroke="var(--k-eef2f5)" stroke-width="1"/>'
      +'<text x="'+(L-6)+'" y="'+(yy+3.5).toFixed(1)+'" text-anchor="end" font-size="10" fill="var(--muted)">'+(Math.round(v*10)/10).toFixed(1).replace('.',',')+'</text>'; }
  /* Bei vielen Messungen nicht jedes Datum schreiben - sonst kleben die Beschriftungen. */
  const schritt=Math.ceil(pts.length/6);
  let achse='';
  pts.forEach((p,i)=>{ if(i%schritt===0||i===pts.length-1) achse+='<text x="'+x(i).toFixed(1)+'" y="'+(H-B+16)+'" text-anchor="middle" font-size="10" fill="var(--muted)">'+esc(_dTag(p.datum))+'</text>'; });
  let punkte='';
  pts.forEach((p,i)=>{ const letzt=i===pts.length-1;
    punkte+='<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.wert).toFixed(1)+'" r="'+(letzt?4.5:3)+'" fill="var(--k-16a34a)" stroke="var(--k-ffffff)" stroke-width="1.5"><title>'+esc(p.datum)+': '+String(p.wert).replace('.',',')+' cm</title></circle>'; });
  const erster=pts[0].wert, letzter=pts[pts.length-1].wert;
  const d=Math.round((letzter-erster)*10)/10;
  const farbe=d===0?'var(--muted)':(d<0?'var(--k-16a34a)':'var(--k-b45309)');
  const dTxt=(d===0?'±0':((d>0?'+':'−')+String(Math.abs(d)).replace('.',',')))+' cm';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block" role="img" aria-label="Verlauf '+esc(name)+'">'
    +'<defs><linearGradient id="massFill" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="var(--k-16a34a)" stop-opacity="0.18"/><stop offset="100%" stop-color="var(--k-16a34a)" stop-opacity="0"/></linearGradient></defs>'
    +gitter+'<path d="'+flaeche+'" fill="url(#massFill)"/>'
    +'<path d="'+linie+'" fill="none" stroke="var(--k-16a34a)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
    +punkte+achse+'</svg>'
    +'<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;font-size:12px;color:var(--muted);margin-top:4px">'
    +'<span>'+esc(name)+' · '+pts.length+' Messungen</span>'
    +'<span>jetzt <b style="color:var(--ink)">'+String(letzter).replace('.',',')+' cm</b></span>'
    +'<span>seit '+esc(_dTag(pts[0].datum))+' <b style="color:'+farbe+'">'+dTxt+'</b></span></div>';
}
function massVerlaufBoxRender(){
  const box=document.getElementById('massVerlaufBox'); if(!box) return;
  box.innerHTML = MASS_ANSICHT==='chart' ? massChartHtml(MASS_HIST) : massVerlaufHtml(MASS_HIST);
  const sel=document.getElementById('massReiheWahl'); if(sel) sel.style.display = MASS_ANSICHT==='chart' ? '' : 'none';
  ['chart','tabelle'].forEach(v=>{ const b=document.getElementById('massTab_'+v); if(!b) return;
    const an=(MASS_ANSICHT===v);
    b.style.background=an?'var(--k-16a34a)':'var(--k-ffffff)'; b.style.color=an?'var(--k-ffffff)':'var(--ink)'; b.style.borderColor=an?'var(--k-16a34a)':'var(--line)'; });
}
function massAnsichtSet(v){ MASS_ANSICHT=v; massVerlaufBoxRender(); }
function massReiheSet(v){ MASS_REIHE=v; massVerlaufBoxRender(); }
if(typeof window!=='undefined'){ window.massAnsichtSet=massAnsichtSet; window.massReiheSet=massReiheSet; }
function massVerlaufRahmenHtml(hist){
  if(!hist||!hist.length) return '';
  const knopf=(v,txt)=>'<button id="massTab_'+v+'" onclick="massAnsichtSet(\''+v+'\')" style="padding:6px 12px;border:1px solid var(--line);border-radius:8px;background:var(--k-ffffff);color:var(--ink);cursor:pointer;font-size:12.5px">'+txt+'</button>';
  const opts=MASS_SPALTEN.map(c=>'<option value="'+c[0]+'"'+(c[0]===MASS_REIHE?' selected':'')+'>'+c[1]+'</option>').join('');
  return '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--k-eef2f5)">'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">'
    +'<span style="font-weight:600;font-size:13px;margin-right:4px">Verlauf</span>'
    +knopf('chart','📈 Diagramm')+knopf('tabelle','▦ Tabelle')
    +'<select id="massReiheWahl" onchange="massReiheSet(this.value)" style="margin-left:auto;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font-size:12.5px">'+opts+'</select>'
    +'</div><div id="massVerlaufBox"></div></div>';
}
/* FE-1: Verlauf als Tabelle - Datum je Zeile, Werte in cm, Gesamt-Delta in der Fusszeile.
   Ohne Datum ist eine gespeicherte Zahl nicht nachpruefbar (Kriterium: 8 Masse MIT Datum). */
function massVerlaufHtml(hist){
  if(!hist||!hist.length) return '';
  const cols=[["Brust","Brust"],["Taille","Taille"],["Bauch","Bauch"],["Huefte","Hüfte"],["Po","Po"],["Oberschenkel","Obersch."],["Oberarm","Oberarm"],["Beine","Beine"]];
  const z=v=>(v==null||v==='')?'–':String(v).replace('.',',');
  let kopf='<tr><th style="text-align:left;padding:4px 6px;font-weight:600">Datum</th>'+cols.map(c=>'<th style="text-align:right;padding:4px 6px;font-weight:600">'+c[1]+'</th>').join('')+'</tr>';
  let zeilen='';
  hist.forEach((r,i)=>{ zeilen+='<tr style="border-top:1px solid var(--k-eef2f5)'+(i===0?';font-weight:600':'')+'"><td style="padding:4px 6px">'+esc(r.Datum)+'</td>'
    +cols.map(c=>'<td style="text-align:right;padding:4px 6px">'+z(r[c[0]])+'</td>').join('')+'</tr>'; });
  /* Gesamt-Delta: aktuelle Messung gegen die aelteste geladene Messung, je Spalte einzeln. */
  let fuss='';
  if(hist.length>1){
    const alt=hist[hist.length-1];
    fuss='<tr style="border-top:2px solid var(--line);color:var(--muted)"><td style="padding:4px 6px">Δ gesamt</td>'
      +cols.map(c=>{ const a=hist[0][c[0]], b=alt[c[0]];
        if(a==null||b==null) return '<td style="text-align:right;padding:4px 6px">–</td>';
        const d=Math.round((Number(a)-Number(b))*10)/10;
        const farbe = d===0?'var(--muted)':(d<0?'var(--k-16a34a)':'var(--k-b45309)');
        return '<td style="text-align:right;padding:4px 6px;color:'+farbe+'">'+(d===0?'±0':((d>0?'+':'−')+String(Math.abs(d)).replace('.',',')))+'</td>'; }).join('')+'</tr>';
  }
  return '<div style="margin-top:14px"><div style="font-weight:600;font-size:13px;margin-bottom:6px">Verlauf (letzte '+hist.length+' Messung'+(hist.length>1?'en':'')+', cm)</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:520px">'+kopf+zeilen+fuss+'</table></div></div>';
}
async function renderProfilMass(){
  const box=document.getElementById("pfMass"); if(!box) return;
  let p={},last={},hist=[];
  try{ const r=await client.rpc("cb_train_profil"); p=Array.isArray(r.data)?(r.data[0]||{}):(r.data||{}); }catch(e){}
  /* FE-1: 12 statt 1 Messung laden. Fuer das Delta braucht es die Vormessung,
     fuer den Verlauf darunter die letzten Termine. Ein Leseweg, nicht zwei. */
  try{ const r=await client.rpc("cb_mass_historie",{p_limit:24}); hist=(r.data||[]); last=hist[0]||{}; }catch(e){}
  MASS_HIST=hist;
  /* 30.09.2026 Webtest PR7/PR11: deutsches Datum, und bei ueberfaelliger Messung, seit wann */
  const _faelligTage=p.Mass_Naechste?Math.round((new Date(tbToday())-new Date(p.Mass_Naechste))/86400000):null;
  const naechste=p.Mass_Naechste?('Nächste Messung: <b>'+esc(deDatum(p.Mass_Naechste))+'</b>'+(_faelligTage!=null&&_faelligTage>=0?' · <span style="color:var(--k-b45309)">'+(_faelligTage===0?'heute fällig':('fällig seit '+_faelligTage+(_faelligTage===1?' Tag':' Tagen')))+'</span>':'')):'';
  const standZeile = hist.length
    ? '<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:6px">Angezeigt: Messung vom <b style="color:var(--ink)">'+esc(deDatum(last.Datum))+'</b>'+(hist.length>1?(' · die farbige Zahl neben jedem Maß ist die Veränderung in cm gegen die vorige Messung')  :' · erste Messung')+'</div>'
    : '<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:6px">Noch keine Messung gespeichert.</div>';
  box.innerHTML=standZeile+bodyMapHtml(last, hist)+massVerlaufRahmenHtml(hist)
    +'<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:6px;padding-top:10px;border-top:1px solid var(--k-eef2f5)">'
    +'<label style="font-size:13px"><input type="checkbox" id="massAktiv"'+(p.Mass_Aktiv?' checked':'')+'> Regelmäßig messen</label>'
    +'<label style="font-size:13px">alle <input id="massIv" type="number" min="1" value="'+(p.Mass_Intervall_Tage??7)+'" style="width:60px;padding:6px;border:1px solid var(--line);border-radius:8px"> Tage</label>'
    +'<span style="font-size:12px;color:var(--muted)">'+naechste+'</span></div>'
    +'<div style="margin-top:10px"><button onclick="saveProfilMass()" style="padding:10px 16px;border:0;border-radius:8px;background:var(--k-16a34a);color:var(--k-ffffff);cursor:pointer">Maße speichern</button> <span id="pfMassMsg" style="font-size:13px"></span></div>';
  massVerlaufBoxRender();   /* fuellt den Verlauf in der zuletzt gewaehlten Ansicht */
}
async function saveProfilMass(){
  const order=["po","huefte","beine","oberarm","brust","taille","bauch","oberschenkel"];
  const args={}; order.forEach(k=>{ args["p_"+k]=_numOrNullId("m_"+k); });
  const msg=document.getElementById("pfMassMsg");
  let e1=null;
  if(order.some(k=>args["p_"+k]!=null)){ const {error}=await client.rpc("cb_mass_eintragen",args); e1=error; }
  const {error:e2}=await client.rpc("cb_mass_settings_speichern",{p_intervall:parseInt(document.getElementById("massIv").value)||7,p_aktiv:document.getElementById("massAktiv").checked});
  const err=e1||e2;
  if(msg){ msg.style.color=err?"var(--k-dc2626)":"var(--k-16a34a)"; msg.textContent=err?("Fehler: "+err.message):"✓ Gespeichert"; }
  if(!err) renderProfilMass();
}

/* ---- Produkt vorschlagen (Link/Barcode → Edge Function → Entwurf) ---- */
