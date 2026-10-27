/* Admin: Premium-Stufen, Feature-Flags und Benutzerverwaltung. */
async function loadStufen(){
  const gate=document.getElementById("stufenGate"), inner=document.getElementById("stufenInner");
  if(!(ME&&ME.is_admin)){ if(inner)inner.style.display="none"; if(gate){gate.style.display="";gate.innerHTML='<div class="gatebox"><h3>Nur für Admins</h3><p>Dieser Bereich ist Administratoren vorbehalten.</p></div>';} return; }
  if(gate)gate.style.display="none"; if(inner)inner.style.display="";
  const {data,error}=await client.rpc("cb_features_matrix");
  if(error){ document.getElementById("stufenMatrix").innerHTML='<div style="color:var(--k-dc2626)">Fehler: '+esc(error.message)+'</div>'; return; }
  renderStufenMatrix(data||[]);
  loadBetaFlags();
}
/* Tarif- und Benutzerschalter verwenden dieselbe Darstellungs- und Schaltlogik. */
function ensureRpillCss(){
  if(typeof document==='undefined' || document.getElementById('rpillCss')) return;
  var s=document.createElement('style'); s.id='rpillCss';
  s.textContent='.rpill{display:inline-flex;border:1px solid var(--line);border-radius:20px;overflow:hidden;font-size:11px;font-weight:700;cursor:pointer;user-select:none;vertical-align:middle;line-height:1}.rpill span{padding:5px 12px;color:var(--muted);transition:.12s}.rpill.on .rpy{background:var(--k-16a34a);color:#fff}.rpill.off .rpn{background:#8a9a9f;color:#fff}'
    +'.rseg{display:inline-flex;border:1px solid var(--line);border-radius:20px;overflow:hidden;font-size:11px;font-weight:700;cursor:pointer;user-select:none;vertical-align:middle;line-height:1}.rseg .rs{padding:5px 12px;color:var(--muted);transition:.12s;border-left:1px solid var(--line)}.rseg .rs:first-child{border-left:0}.rseg .rs.on[data-s=aus]{background:#8a9a9f;color:#fff}.rseg .rs.on[data-s=beta]{background:var(--k-b45309);color:#fff}.rseg .rs.on[data-s=alle]{background:var(--k-16a34a);color:#fff}';
  document.head.appendChild(s);
}
function rpill(on,onclick){ return '<span class="rpill '+(on?'on':'off')+'" onclick="'+onclick+'"><span class="rpy">Ja</span><span class="rpn">Nein</span></span>'; }
function rpillSet(el,on){ el.classList.toggle('on',!!on); el.classList.toggle('off',!on); }
function stufenPill(el,tier,key){ var on=!el.classList.contains('on'); rpillSet(el,on); toggleFeature(tier,key,on); }
function userPill(el,bid,which){ var on=!el.classList.contains('on'); rpillSet(el,on); if(which==='premium') setUserPremium(bid,on); else setUserAdmin(bid,on); }
if(typeof window!=='undefined'){ window.stufenPill=stufenPill; window.userPill=userPill; }
function renderStufenMatrix(rows){
  ensureRpillCss();
  const tiers=[],tseen={},feats=[],fseen={},en={};
  rows.forEach(r=>{
    if(!tseen[r.tier]){ tseen[r.tier]=1; tiers.push({tier:r.tier,label:r.tier_label,sort:r.tier_sort}); }
    if(!fseen[r.feature_key]){ fseen[r.feature_key]=1; feats.push({key:r.feature_key,label:r.feature_label,sort:r.feature_sort}); }
    en[r.feature_key+"|"+r.tier]=r.enabled;
  });
  tiers.sort((a,b)=>a.sort-b.sort); feats.sort((a,b)=>a.sort-b.sort);
  let h='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden">';
  h+='<tr style="background:var(--bg)"><th style="text-align:left;padding:11px 13px;font-size:13px">Funktion</th>';
  tiers.forEach(t=>{ h+='<th style="padding:11px 13px;font-size:13px;text-align:center;min-width:96px">'+esc(t.label)+'</th>'; });
  h+='</tr>';
  feats.forEach(f=>{
    h+='<tr style="border-top:1px solid var(--line)"><td style="padding:11px 13px;font-size:14px;font-weight:600">'+esc(f.label)+'</td>';
    tiers.forEach(t=>{
      const on=!!en[f.key+"|"+t.tier];
      h+='<td style="padding:11px 13px;text-align:center">'+rpill(on,"stufenPill(this,'"+t.tier+"','"+f.key+"')")+'</td>';
    });
    h+='</tr>';
  });
  h+='</table></div><div id="stufenMsg" style="font-size:13px;margin-top:8px;height:18px"></div>';
  document.getElementById("stufenMatrix").innerHTML=h;
}
async function toggleFeature(tier,key,enabled){
  const msg=document.getElementById("stufenMsg");
  const {error}=await client.rpc("cb_feature_set",{p_tier:tier,p_feature:key,p_enabled:enabled});
  if(error){ if(msg){msg.style.color="var(--k-dc2626)";msg.textContent="Fehler: "+error.message;} return; }
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; setTimeout(()=>{ if(msg) msg.textContent=""; },1400); }
  await refreshMyFeatures(); await ladeTierSets(); updateGate();
}
/* Feature-Flags erscheinen aus dem vorhandenen Serverbestand. */
async function loadBetaFlags(){
  ensureRpillCss();
  var inner=document.getElementById("stufenInner"); if(!inner) return;
  var host=document.getElementById("stufenBeta");
  if(!host){ host=document.createElement("div"); host.id="stufenBeta"; host.style.marginTop="28px"; inner.appendChild(host); }
  host.innerHTML='<div style="font-size:13px;color:var(--muted)">Beta-Freigabe lädt…</div>';
  var r=await client.rpc("cb_feature_flags_list");
  if(r.error){ host.innerHTML='<div style="color:var(--k-dc2626)">Beta-Freigabe: '+esc(r.error.message)+'</div>'; return; }
  renderBetaFlags(r.data||[]);
}
function _betaSeg(key,state){
  function seg(s,lab){ return '<span class="rs'+(state===s?' on':'')+'" data-s="'+s+'" onclick="betaSet(this,\''+key+'\',\''+s+'\')">'+lab+'</span>'; }
  return '<span class="rseg">'+seg('aus','Aus')+seg('beta','Nur Beta')+seg('alle','Für alle')+'</span>';
}
/* Reine Admin-Flags bleiben getrennt sichtbar; Entfernen würde den Menüpunkt samt Rückweg ausblenden. */
function _betaTabelle(rows, adminBlock){
  var h='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden">';
  h+='<tr style="background:var(--bg)"><th style="text-align:left;padding:11px 13px;font-size:13px">Funktion</th><th style="padding:11px 13px;font-size:13px;text-align:center;white-space:nowrap">'+(adminBlock?'Sichtbar für Admins':'Sichtbarkeit')+'</th></tr>';
  rows.forEach(function(f){
    var state = f.Fuer_Alle ? 'alle' : (f.Fuer_Beta ? 'beta' : 'aus');
    h+='<tr style="border-top:1px solid var(--line)"><td style="padding:11px 13px"><div style="font-weight:600;font-size:14px">'+esc(f.Schluessel)+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px;max-width:520px">'+esc(f.Beschreibung||"")+'</div></td>';
    h+='<td style="padding:11px 13px;text-align:center">'+_betaSeg(f.Schluessel,state)+'</td></tr>';
  });
  return h+'</table></div>';
}
function renderBetaFlags(rows){
  var nutzer=[], admin=[];
  (rows||[]).forEach(function(f){ (f.Nur_Admin?admin:nutzer).push(f); });
  var h='<h3 style="font-size:16px;margin:0 0 4px">Beta-Freigabe — welche Funktion ist schon für alle?</h3>';
  h+='<p style="font-size:12.5px;color:var(--muted);margin:0 0 12px;max-width:660px">Neue Funktionen starten „Nur Beta" — nur du und Beta-Tester sehen sie. „Für alle" schaltet öffentlich frei (sofort, ohne Deploy). „Aus" versteckt sie für alle. Es erscheint jede Funktion, die im Code an einen Schalter angeschlossen ist.</p>';
  h+= nutzer.length ? _betaTabelle(nutzer,false)
    : '<div style="padding:14px 13px;color:var(--muted);font-size:13px;border:1px solid var(--line);border-radius:12px;background:var(--card)">Noch keine schaltbaren Nutzer-Funktionen registriert.</div>';
  if(admin.length){
    h+='<h3 style="font-size:15px;margin:26px 0 4px">Nur Admin-Ansichten</h3>';
    h+='<p style="font-size:12.5px;color:var(--muted);margin:0 0 10px;max-width:660px">Diese Funktionen erreicht <b>kein</b> Nutzer – sie leben im Admin-Bereich. „Für alle" heißt hier deshalb <b>für alle Admins</b>, nicht für die Öffentlichkeit. Sie stehen getrennt, damit der Schalter oben kein Versprechen macht, das er nicht halten kann.</p>';
    h+=_betaTabelle(admin,true);
  }
  h+='<div id="betaMsg" style="font-size:13px;margin-top:8px;height:18px"></div>';
  document.getElementById("stufenBeta").innerHTML=h;
}
function betaSet(el,key,state){
  var seg=el.parentNode, kids=seg.querySelectorAll(".rs");
  for(var i=0;i<kids.length;i++){ kids[i].classList.toggle("on", kids[i].getAttribute("data-s")===state); }
  var beta=(state!=="aus"), alle=(state==="alle"), msg=document.getElementById("betaMsg");
  client.rpc("cb_feature_flag_set",{p_key:key,p_fuer_beta:beta,p_fuer_alle:alle}).then(function(r){
    if(r.error){ if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent="Fehler: "+r.error.message; } return; }
    if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; setTimeout(function(){ if(msg) msg.textContent=""; },1400); }
    try{ ladeFeatures(); }catch(e){}
  });
}
if(typeof window!=='undefined'){ window.betaSet=betaSet; window.loadBetaFlags=loadBetaFlags; }
/* Admin-Benutzerübersicht. */
const TIERS=[["basis","Basis"],["vital","Vital"],["performance","Performance"],["komplett","Komplett"]];
async function loadUsers(){
  const gate=document.getElementById("usersGate"), inner=document.getElementById("usersInner");
  if(!(ME&&ME.is_admin)){ if(inner)inner.style.display="none"; if(gate){gate.style.display="";gate.innerHTML='<div class="gatebox"><h3>Nur für Admins</h3><p>Dieser Bereich ist Administratoren vorbehalten.</p></div>';} return; }
  if(gate)gate.style.display="none"; if(inner)inner.style.display="";
  const {data,error}=await client.rpc("cb_users_list");
  if(error){ document.getElementById("usersTable").innerHTML='<div style="color:var(--k-dc2626)">Fehler: '+esc(error.message)+'</div>'; return; }
  /* 25.10.2026, Ralph: "ob web oder apple anmeldung oder ggf dann play store". Eigene Abfrage
     (Geraete aus den Anmelde-Sitzungen, Play-App meldet sich selbst) - cb_users_list bleibt unveraendert. */
  try{ const pl=await client.rpc("cb_admin_nutzer_plattform"); var pm={}; (pl.data||[]).forEach(function(x){ pm[x.benutzer_id]=x; });
    (data||[]).forEach(function(u){ u._pl=pm[u.benutzer_id]||null; }); }catch(e){}
  /* 27.10.2026, Ralph: Spalte Tagebuch - Tage mit mindestens einem Eintrag, nicht die Eintraege. */
  try{ const tb=await client.rpc("cb_admin_nutzer_tagebuchtage"); var tm={}; (tb.data||[]).forEach(function(x){ tm[x.benutzer_id]=x; });
    (data||[]).forEach(function(u){ u._tb=tm[u.benutzer_id]||null; }); }catch(e){}
  /* 27.10.2026, Ralph: "die tabelle mittig ausrichten" */
  try{ if(inner){ inner.style.maxWidth='1240px'; inner.style.margin='0 auto'; } }catch(e){}
  renderUsers(data||[]);
}
var _UP_FARBE={'iPhone-App':['#0a84ff','📱'],'Play-App':['#1a9c4a','🤖'],'Android':['#5f7f6a','🤖'],'iPhone-Browser':['#6b7280','🌐'],'Web':['#6b7280','🌐']};
function _uUeber(u){
  var p=u._pl; if(!p) return '<span style="color:var(--k-c7c2b8)">\u2013</span>';
  var g=(p.geraete||[]).map(function(k){ var f=_UP_FARBE[k]||['#6b7280','']; var name=(k==='Android'?'Android (Browser/App)':k);
    return '<span title="'+esc(name)+(k===p.zuerst?' – zuerst gesehen':'')+'" style="display:inline-block;margin:0 3px 3px 0;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;color:#fff;background:'+f[0]+(k===p.zuerst?';box-shadow:0 0 0 2px var(--card),0 0 0 3px '+f[0]:'')+'">'+f[1]+' '+esc(k)+'</span>'; }).join('');
  return '<div>'+(g||'<span style="color:var(--k-c7c2b8)">\u2013</span>')+'</div><div style="font-size:11px;color:var(--muted)">'+esc(p.anmeldung||'')+'</div>';
}
function _uTb(u){
  var t=u._tb; if(!t||!t.tage) return '<span style="color:var(--k-c7c2b8)">\u2013</span>';
  return '<div style="font-weight:700">'+t.tage+' Tage</div><div style="font-size:11px;color:var(--muted)">'+(t.tage_7?t.tage_7+' in 7 Tagen':'zuletzt '+_uDate(t.letzter))+'</div>';
}
function _uDate(s){ if(!s) return '–'; try{ return new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); }catch(e){ return '–'; } }
/* Ralph-Auftrag 06.09.2026: sichtbar machen, wer Produkte erfasst hat.
   Die Zahl kommt aus cb_users_list (Produkte.Angelegt_Von), NICHT aus Daten_Quelle -
   die sagt, WOHER die Daten stammen, nicht WER sie eingetragen hat. Wer nichts
   erfasst hat, bekommt einen Strich statt einer Null: eine 0 laese sich als
   Bewertung lesen, der Strich sagt schlicht "nichts dabei". */
function _uErf(u){
  var n=Number(u&&u.produkte_erfasst||0);
  if(!n) return '<span style="color:var(--k-c7c2b8)">\u2013</span>';
  var a=Number(u.produkte_erfasst_aktiv||0);
  return '<b style="font-variant-numeric:tabular-nums">'+n+'</b>'
    +(a!==n?'<div style="font-size:11px;color:var(--muted);white-space:nowrap">'+a+' aktiv</div>':'');
}
/* Ralph-Auftrag 06.09.2026: sichtbar machen, wann jemand zuletzt in der App war.
   Die Zeit kommt aus cb_users_list und ist dort das Spaeteste aus drei Messungen:
   letzte_aktivitaet (setzt cb_me bei jedem App-Start), letzte Anmeldung und letzter
   Tagebuch-Eintrag. Angezeigt wird der Abstand zu heute - "vor 3 Tagen" sagt mehr als
   ein Datum, das man erst nachrechnen muss. */
function _uAktiv(s){
  if(!s) return '<span style="color:var(--k-c7c2b8)">nie</span>';
  var d=new Date(s); if(isNaN(d)) return '<span style="color:var(--k-c7c2b8)">–</span>';
  var min=Math.floor((Date.now()-d.getTime())/60000), txt, farbe='var(--muted)';
  if(min<60){ txt=(min<2?'gerade eben':'vor '+min+' Min.'); farbe='var(--greendk)'; }
  else if(min<1440){ txt='vor '+Math.floor(min/60)+' Std.'; farbe='var(--greendk)'; }
  else { var t=Math.floor(min/1440);
    txt = t===1?'gestern':('vor '+t+' Tagen');
    if(t>90) farbe='var(--k-c7c2b8)';
  }
  return '<div style="color:'+farbe+';white-space:nowrap">'+txt+'</div>'
    +'<div style="font-size:11px;color:var(--k-c7c2b8);white-space:nowrap">'+_uDate(s)+'</div>';
}
/* Premium-Gueltigkeit. Zwei Quellen, die nicht vermischt werden duerfen:
   Stripe entscheidet beim Abo (current_period_end / trial_bis), Ralph entscheidet
   beim manuellen Premium (premium_bis). Nur das Manuelle ist hier editierbar -
   ein Stripe-Datum von Hand zu aendern waere eine zweite Wahrheit. */
function _uPremBis(u){
  var stripe = (u.subscription_status==='active'||u.subscription_status==='trialing');
  if(stripe){
    var ende = u.subscription_status==='trialing' ? u.trial_bis : u.current_period_end;
    return '<div style="white-space:nowrap;color:var(--muted)">'+(ende?_uDate(ende):'läuft')+'</div>'
      +'<div style="font-size:11px;color:var(--k-c7c2b8)">über Stripe</div>';
  }
  if(!u.is_premium) return '<span style="color:var(--k-c7c2b8)">–</span>';
  var abgelaufen = u.premium_bis && new Date(u.premium_bis)<=new Date();
  var lab = u.premium_bis ? _uDate(u.premium_bis) : 'unbegrenzt';
  var farbe = abgelaufen ? 'var(--k-dc2626)' : (u.premium_bis?'var(--ink)':'var(--muted)');
  return '<button onclick="setUserPremiumBis(\''+u.benutzer_id+'\',\''+(u.premium_bis||'')+'\')" '
    +'title="Gültigkeit ändern" style="padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:'+farbe+';cursor:pointer;font-size:12.5px;white-space:nowrap">'
    +esc(lab)+' ✏️</button>'
    +(abgelaufen?'<div style="font-size:11px;color:var(--k-dc2626)">abgelaufen</div>':'');
}
/* Eingabe bewusst tolerant: TT.MM.JJJJ, JJJJ-MM-TT, "3m"/"14t" ab heute, leer = unbegrenzt. */
function _uParseBis(s){
  s=(s||'').trim();
  if(!s) return {ok:true, wert:null};
  var m=s.match(/^(\d+)\s*([tmj])$/i);
  if(m){ var n=parseInt(m[1],10), d=new Date();
    if(/t/i.test(m[2])) d.setDate(d.getDate()+n);
    else if(/m/i.test(m[2])) d.setMonth(d.getMonth()+n);
    else d.setFullYear(d.getFullYear()+n);
    d.setHours(23,59,59,0); return {ok:true, wert:d.toISOString()};
  }
  m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(m) s=m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return {ok:false};
  var dd=new Date(s+'T23:59:59');
  if(isNaN(dd)) return {ok:false};
  return {ok:true, wert:dd.toISOString()};
}
async function setUserPremiumBis(bid, aktuell){
  /* 🔴 06.09.2026, Ralph: "datum bis nicht eingabe 3m". Das Feld war mit dem
     bestehenden DATUM vorbelegt - man musste es loeschen, um eine Dauer zu tippen.
     Jetzt steht die Dauer im Feld, das aktuelle Datum nur noch als Hinweis im Text.
     Ein Datum bleibt weiter erlaubt; _uParseBis versteht beides unveraendert. */
  var stand = aktuell ? ('Steht jetzt auf: '+new Date(aktuell).toLocaleDateString('de-DE')) : 'Steht jetzt auf: unbegrenzt';
  var ein = prompt('Premium gültig wie lange?\n\n'+stand+'\n\n„3m" = 3 Monate ab heute  ·  „14t" = 14 Tage  ·  „1j" = 1 Jahr\nEin Datum geht auch: TT.MM.JJJJ\nLeer lassen = unbegrenzt.', '3m');
  if(ein===null) return;
  var p=_uParseBis(ein);
  if(!p.ok){ alert('Datum nicht erkannt. Bitte TT.MM.JJJJ oder z. B. „3m".'); return; }
  const msg=document.getElementById("usersMsg");
  const {error}=await client.rpc("cb_user_premium_bis_set",{p_bid:bid,p_bis:p.wert});
  if(error){ userErr(msg,error); return; }
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; setTimeout(()=>{ if(msg) msg.textContent=""; },1400); }
  loadUsers();
}
if(typeof window!=='undefined'){ window.setUserPremiumBis=setUserPremiumBis; }
function renderUsers(rows){
  ensureRpillCss();
  const th='padding:8px 7px;font-size:11.5px;text-align:left;white-space:nowrap';
  let h='<div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">'+rows.length+' registrierte Nutzer. Premium-Häkchen = manuell freischalten; Abo/Test kommt automatisch über Stripe. „Premium bis" ist nur beim manuellen Premium änderbar (z. B. 3 Monate für Testnutzer) — nach Ablauf gilt der Nutzer serverseitig als nicht mehr Premium.</div>';
  /* 🔴 06.09.2026, Ralph: "fenster ist scrollbar, soll breiter sein."
     Die Tabelle steckte in einem Kasten, der nur so breit war wie die Inhaltsspalte.
     Sie darf jetzt bis an den Fensterrand - width:100vw mit einem Ausbruch aus der
     Spalte (margin-left auf die halbe Differenz). Der Scroll bleibt als Notnagel
     fuer sehr schmale Fenster, greift aber im Regelfall nicht mehr. */
  /* 🔴 06.09.2026, Ralph: "fenster ist scrollbar, soll breiter sein." - und dann
     "zu breit, abgeschnitten". Der erste Versuch brach mit 100vw aus der Spalte
     aus und schob die Tabelle unter das linke Menue. Richtig ist: in der Spalte
     bleiben und die feste Mindestbreite von 820px fallen lassen, die den Scroll
     ueberhaupt erst ausgeloest hat. Die Tabelle nimmt jetzt die Breite, die da
     ist, und die Spalten teilen sie sich. */
  /* 🔴 06.09.2026, Ralph in drei Schritten: erst "scrollbar, soll breiter sein",
     dann "zu breit, abgeschnitten" (mein 100vw-Ausbruch schob sie unters Menue),
     jetzt "vollstaendige Sicht, aber nicht ueber den ganzen Bildschirm".
     Loesung ohne Ausbruch und ohne Scroll: die zehn Spalten muessen in die
     vorhandene Breite passen. Dafuer engeres Innenmass und kleinere Schrift -
     die Tabelle bleibt in ihrer Spalte, zeigt aber alles. */
  h+='<div style="width:100%">'
   +'<table class="usrTab" style="width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;table-layout:auto;font-size:12.5px">';
  h+='<tr style="background:var(--bg)"><th style="'+th+'">Nutzer</th><th style="'+th+'" title="Geräte aus den Anmeldungen, das zuerst gesehene ist umrandet">Über</th><th style="'+th+';text-align:center">Premium</th><th style="'+th+'">Abo /<br>Test</th><th style="'+th+';text-align:center">Erfasst</th><th style="'+th+';text-align:center" title="Tage mit mindestens einem Tagebuch-Eintrag">Tage­buch</th><th style="'+th+'">Zuletzt<br>aktiv</th><th style="'+th+'">Regis&shy;triert</th><th style="'+th+'">Premium<br>seit</th><th style="'+th+'">Premium<br>bis</th><th style="'+th+';text-align:center">Admin</th><th style="'+th+';text-align:center">Passwort</th></tr>';
  rows.forEach(u=>{
    const trial = u.subscription_status==='trialing' && u.trial_bis && new Date(u.trial_bis)>new Date();
    let abo;
    if(trial) abo='<span style="font-size:11px;font-weight:700;background:var(--greenlt);color:var(--greendk);padding:2px 8px;border-radius:999px;white-space:nowrap">🎁 Test bis '+_uDate(u.trial_bis)+'</span>';
    else if(u.subscription_status==='active') abo='<span style="font-size:11.5px;color:var(--greendk);font-weight:600">Abo aktiv</span>';
    else if(u.subscription_status==='canceled') abo='<span style="font-size:11.5px;color:var(--k-b45309)">gekündigt</span>';
    else abo='<span style="color:var(--k-c7c2b8)">–</span>';
    const td='padding:8px 7px;font-size:12.5px;vertical-align:top';
    h+='<tr style="border-top:1px solid var(--line)">'
      +'<td style="'+td+'"><div style="font-weight:600">'+esc(u.name||u.benutzer_id)+'</div><div style="font-size:12px;color:var(--muted)">'+esc(u.email||"")+'</div></td>'
      +'<td style="'+td+';min-width:120px">'+_uUeber(u)+'</td>'
      +'<td style="'+td+';text-align:center">'+rpill(!!u.is_premium,"userPill(this,'"+u.benutzer_id+"','premium')")+'</td>'
      +'<td style="'+td+'">'+abo+'</td>'
      +'<td style="'+td+';text-align:center;white-space:nowrap">'+_uErf(u)+'</td>'
      +'<td style="'+td+';text-align:center;white-space:nowrap">'+_uTb(u)+'</td>'
      +'<td style="'+td+';font-size:12.5px">'+_uAktiv(u.letzte_aktivitaet)+'</td>'
      +'<td style="'+td+';color:var(--muted);white-space:nowrap">'+_uDate(u.angelegt_am)+'</td>'
      +'<td style="'+td+';color:var(--muted);white-space:nowrap">'+(u.is_premium?_uDate(u.premium_since):'–')+'</td>'
      +'<td style="'+td+';font-size:12.5px">'+_uPremBis(u)+'</td>'
      +'<td style="'+td+';text-align:center">'+rpill(!!u.is_admin,"userPill(this,'"+u.benutzer_id+"','admin')")+'</td>'
      +'<td style="'+td+';text-align:center;white-space:nowrap"><button onclick="adminSetPassword(\''+u.benutzer_id+'\',\''+esc((u.name||u.email||u.benutzer_id)).replace(/\x27/g,"")+'\')" style="padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);cursor:pointer;font-size:12.5px">🔑</button>'
      +(u.is_admin?'':'<button title="Nutzer löschen" onclick="adminDeleteUser(\''+u.benutzer_id+'\',\''+esc((u.name||u.email||u.benutzer_id)).replace(/\x27/g,"")+'\')" style="margin-left:6px;padding:6px 9px;border:1px solid var(--k-fca5a5);border-radius:8px;background:var(--card);color:var(--k-dc2626);cursor:pointer;font-size:12.5px">🗑️</button>')
      +'</td>'
      +'</tr>';
  });
  h+='</table></div><style>.usrTab th,.usrTab td{text-align:center!important;vertical-align:middle!important}.usrTab th:first-child,.usrTab td:first-child{text-align:left!important}</style><div id="usersMsg" style="font-size:13px;margin-top:8px;height:18px"></div>';
  document.getElementById("usersTable").innerHTML=h;
}
async function setUserPremium(bid,val){
  const msg=document.getElementById("usersMsg");
  const {error}=await client.rpc("cb_user_premium_set",{p_bid:bid,p_premium:val});
  if(error){ userErr(msg,error); loadUsers(); return; }
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; setTimeout(()=>{ if(msg) msg.textContent=""; },1200); }
  loadUsers();
}
async function adminDeleteUser(bid,name){
  if(!confirm('Nutzer „'+name+'" wirklich unwiderruflich löschen? Konto + Tagebuch/Gewichtsverlauf werden entfernt.')) return;
  const msg=document.getElementById("usersMsg");
  const {data,error}=await client.rpc("cb_user_delete",{p_bid:bid});
  if(error){ userErr(msg,error); return; }
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ Nutzer gelöscht"; setTimeout(()=>{ if(msg) msg.textContent=""; },1500); }
  loadUsers();
}
async function adminSetPassword(bid,name){
  const pass=prompt('Neues Passwort für '+name+' (mind. 6 Zeichen):');
  if(pass===null) return;
  if((pass||"").length<6){ alert("Mindestens 6 Zeichen."); return; }
  const msg=document.getElementById("usersMsg");
  try{
    const { data:{ session } } = await client.auth.getSession();
    if(!session){ alert("Bitte neu anmelden."); return; }
    const r=await fetch(SUPABASE_URL+"/functions/v1/admin-set-password",{ method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey":SUPABASE_KEY },
      body: JSON.stringify({ benutzer_id:bid, passwort:pass }) });
    const j=await r.json().catch(()=>({}));
    if(j&&j.ok){ if(msg){msg.style.color="var(--k-16a34a)";msg.textContent="✓ Passwort gesetzt.";} alert("✓ Passwort gesetzt – "+(j.name||name)+" kann sich jetzt mit E-Mail + Passwort anmelden."); }
    else { alert("Fehler: "+((j&&j.error)||("HTTP "+r.status))); }
  }catch(e){ alert("Fehler: "+e.message); }
}
function userErr(msg,e){
  const auth=/Nur Admins|Nicht angemeldet|JWT|auth/i.test(e.message||"");
  if(msg){ msg.style.color="var(--k-dc2626)"; msg.textContent=auth?"Sitzung abgelaufen – bitte neu anmelden und erneut versuchen.":("Fehler: "+e.message); }
}
async function setUserTier(bid,tier){
  const msg=document.getElementById("usersMsg");
  if(!(ME&&ME.is_admin)){ if(msg){msg.style.color="var(--k-dc2626)";msg.textContent="Bitte als Admin anmelden.";} return; }
  const {error}=await client.rpc("cb_user_set_tier",{p_benutzer:bid,p_tier:tier});
  if(error){ userErr(msg,error); return; }
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ Stufe gespeichert"; setTimeout(()=>{if(msg)msg.textContent="";},1400); }
  loadUsers();
}
async function setUserAdmin(bid,val){
  const msg=document.getElementById("usersMsg");
  if(!(ME&&ME.is_admin)){ if(msg){msg.style.color="var(--k-dc2626)";msg.textContent="Bitte als Admin anmelden.";} loadUsers(); return; }
  const {error}=await client.rpc("cb_user_set_admin",{p_benutzer:bid,p_is_admin:val});
  if(error){ userErr(msg,error); loadUsers(); return; }
  if(msg){ msg.style.color="var(--k-16a34a)"; msg.textContent="✓ gespeichert"; setTimeout(()=>{if(msg)msg.textContent="";},1400); }
  loadUsers();
}
