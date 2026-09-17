/* ---- POSTFACH (eigene Seite) ----------------------------------------------
   17.09.2026, Ralph: "soll aber wie ein mail programm sein wie z.b. outlook
   mit textformatierung, signatur usw., nicht nur popup." Aus dem kleinen
   Dock (erste Fassung) wird eine eigene Seite (m==="postfach"): Liste links,
   Lesen+Antworten rechts, Formatierungsleiste (fett/kursiv/Liste/Link) per
   contenteditable, feste Signatur wird beim Oeffnen einer Antwort automatisch
   eingefuegt.
   17.09.2026 (v2), Ralph: "weiter ausbauen mit löschen, papierkorb,
   postausgang, ablage usw, alles was ein postfach braucht." Ordner-Reiter
   oben (Posteingang/Postausgang/Papierkorb/Ablage) + Loeschen (-> Papierkorb),
   Endgueltig loeschen (nur im Papierkorb) und Ablegen (-> Archiv). Serverseitig
   loest die Edge Function die echten IMAP-Ordnernamen selbst auf (v3).
   Server-Teil unveraendert im Prinzip: Edge Function "mail-postfach" (IMAP
   lesen/verschieben, SMTP senden), Zugangsdaten als Supabase-Secrets. Seite
   wird dynamisch erzeugt (kein neuer Container in admin.html - dort liegen
   andere, unabhaengige Aenderungen von Ralph). Die Seite haengt sich in
   setMode() ein (app.js, isolierte eine Zeile), genau wie jede andere
   Admin-Ansicht (A4.2). */

var POSTFACH_SIGNATUR_HTML =
  '<div><br></div><div>Dein Root-Index-Team</div>'
  + '<div style="color:#5b6d73;font-size:11.5px">wissenschaftsbasiert. sponsorenfrei. unabhängig.</div>'
  + '<div style="color:#5b6d73;font-size:11.5px">root-index.de</div>';

var PF_ORDNER = [
  { kind:'inbox',   label:'Posteingang' },
  { kind:'sent',    label:'Postausgang' },
  { kind:'trash',   label:'Papierkorb' },
  { kind:'archive', label:'Ablage' }
];

async function postfachFetch(pfad, opt){
  const { data:{ session } } = await client.auth.getSession();
  if(!session) throw new Error("Bitte neu anmelden.");
  const r=await fetch(SUPABASE_URL+"/functions/v1/mail-postfach"+pfad, Object.assign({
    headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey":SUPABASE_KEY }
  }, opt||{}));
  const j=await r.json().catch(()=>({}));
  if(!r.ok || j.error) throw new Error(j.error||("HTTP "+r.status));
  return j;
}
function postfachKurz(adr){
  var m=String(adr||'').match(/^"?([^"<]*)"?\s*<([^>]+)>/);
  if(m) return (m[1].trim()||m[2]);
  return adr||'(unbekannt)';
}

/* ---- Kopfleisten-Abzeichen (ungelesene Mails) - laeuft unabhaengig von der
   Seite selbst, alle 60s (adminnav.js), damit man es auch sieht, ohne die
   Seite offen zu haben. Zaehlt bewusst nur den Posteingang. */
async function postfachBadgeAktualisieren(){
  try{
    var j=await postfachFetch('?action=list&limit=20&folder=inbox');
    var items=j.items||[];
    var n=items.filter(function(m){return !m.seen;}).length;
    var b=document.getElementById('riMailN'); if(!b) return;
    b.textContent=n?String(n):''; b.style.display=n?'':'none';
  }catch(e){ /* still, kein Alarm im Hintergrund */ }
}

/* ---- Seite -------------------------------------------------------------- */
function postfachViewEl(){
  var v=document.getElementById('postfachView');
  if(v) return v;
  v=document.createElement('div'); v.id='postfachView'; v.style.display='none';
  document.body.appendChild(v);
  return v;
}
function pfOrdnerReiter(){
  var akt=window._pfFolder||'inbox';
  return PF_ORDNER.map(function(o){
    var an=o.kind===akt;
    return '<button onclick="postfachOrdnerWechseln(\''+o.kind+'\')" style="flex:0 0 calc(50% - 2px);box-sizing:border-box;border:0;border-radius:7px;'
      +'background:'+(an?'rgba(23,80,92,.10)':'transparent')+';color:'+(an?'var(--ink)':'var(--muted)')+';font-weight:'+(an?'800':'600')
      +';font-size:12px;padding:7px 4px;cursor:pointer;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+o.label+'</button>';
  }).join('');
}
function postfachSeiteRender(){
  var v=postfachViewEl();
  v.style.display='';
  window._pfFolder = window._pfFolder || 'inbox';
  v.innerHTML='<div style="max-width:1100px;margin:0 auto;padding:14px 6px 40px">'
    +'<div style="font-weight:800;font-size:20px;margin:0 2px 12px">✉️ Postfach · kontakt@root-index.de</div>'
    +'<div style="display:flex;gap:14px;align-items:flex-start;min-height:60vh">'
      +'<div style="width:320px;flex:0 0 auto;background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;overflow:hidden">'
        +'<div style="display:flex;flex-wrap:wrap;gap:2px;padding:4px 6px;border-bottom:1px solid var(--line)" id="pfReiter">'+pfOrdnerReiter()+'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line)">'
          +'<span id="pfOrdnerName" style="font-weight:700;font-size:12.5px;flex:1"></span>'
          +'<button onclick="postfachSeiteListeLaden()" title="aktualisieren" style="border:0;background:transparent;color:var(--muted);font-size:14px;cursor:pointer">⟳</button>'
        +'</div>'
        +'<div id="pfListe" style="max-height:70vh;overflow:auto"></div>'
      +'</div>'
      +'<div id="pfDetail" style="flex:1;min-width:0;background:var(--card,#fff);border:1px solid var(--line);border-radius:12px;padding:18px">'
        +'<div style="color:var(--muted);font-size:13px">Nachricht links auswählen.</div>'
      +'</div>'
    +'</div>'
  +'</div>';
  postfachSeiteListeLaden();
}
function postfachOrdnerWechseln(kind){
  window._pfFolder=kind;
  var r=document.getElementById('pfReiter'); if(r) r.innerHTML=pfOrdnerReiter();
  var d=document.getElementById('pfDetail'); if(d) d.innerHTML='<div style="color:var(--muted);font-size:13px">Nachricht links auswählen.</div>';
  postfachSeiteListeLaden();
}
async function postfachSeiteListeLaden(){
  var l=document.getElementById('pfListe'); if(!l) return;
  var kind=window._pfFolder||'inbox';
  var titel=(PF_ORDNER.filter(function(o){return o.kind===kind;})[0]||{}).label||kind;
  var t=document.getElementById('pfOrdnerName'); if(t) t.textContent=titel;
  l.innerHTML='<div style="padding:14px;color:var(--muted);font-size:12.5px">Lade …</div>';
  try{
    var j=await postfachFetch('?action=list&limit=30&folder='+encodeURIComponent(kind));
    window._postfach=j.items||[];
    postfachBadgeAktualisieren();
    postfachSeiteListeZeichnen();
  }catch(e){
    l.innerHTML='<div style="padding:14px;color:var(--k-dc2626);font-size:12.5px">Fehler: '+esc(e.message)+'</div>';
  }
}
function postfachSeiteListeZeichnen(){
  var l=document.getElementById('pfListe'); if(!l) return;
  var arr=window._postfach||[];
  var kind=window._pfFolder||'inbox';
  if(!arr.length){ l.innerHTML='<div style="padding:14px;color:var(--muted);font-size:12.5px">Leer.</div>'; return; }
  l.innerHTML=arr.map(function(m){
    var wer = kind==='sent' ? postfachKurz(m.to) : postfachKurz(m.from);
    return '<div onclick="postfachSeiteOeffnen('+m.uid+')" id="pfZeile'+m.uid+'" style="padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer'
      +(m.seen?'':';background:rgba(23,80,92,.06)')+'">'
      +'<div style="display:flex;gap:6px;align-items:baseline">'
        +'<span style="font-weight:'+(m.seen?'600':'800')+';flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">'+esc(m.subject||'(kein Betreff)')+'</span>'
        +'<span style="font-size:10.5px;color:var(--muted);flex:0 0 auto">'+esc((m.date||'').replace(/^\w+,\s*/,'').slice(0,17))+'</span>'
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(wer)+'</div>'
    +'</div>';
  }).join('');
}
function pfToolbarBtn(cmd, label, arg){
  return '<button type="button" onmousedown="event.preventDefault()" onclick="document.execCommand(\''+cmd+'\',false,'
    +(arg?('\''+arg+'\''):'null')+');document.getElementById(\'pfAntwHtml\').focus()" '
    +'title="'+esc(label)+'" style="border:1px solid var(--line);background:var(--bg);color:var(--ink);'
    +'width:28px;height:26px;border-radius:6px;cursor:pointer;font-size:12.5px;font-weight:700">'+label+'</button>';
}
function pfAktionLeiste(uid){
  var kind=window._pfFolder||'inbox';
  var btns='';
  if(kind==='trash'){
    btns+='<button onclick="postfachAktion(\'purge\','+uid+',true)" style="border:1px solid var(--k-dc2626,#dc2626);background:transparent;color:var(--k-dc2626,#dc2626);border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer">🗑 Endgültig löschen</button>';
  }else{
    btns+='<button onclick="postfachAktion(\'delete\','+uid+')" style="border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;margin-right:6px">🗑 Löschen</button>';
    if(kind!=='archive'){
      btns+='<button onclick="postfachAktion(\'archive\','+uid+')" style="border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer">🗄 Ablegen</button>';
    }
  }
  return '<div style="margin-bottom:14px">'+btns+'</div>';
}
async function postfachAktion(action, uid, mitConfirm){
  if(mitConfirm && !confirm('Diese Nachricht endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
  var d=document.getElementById('pfDetail');
  try{
    await postfachFetch('', { method:'POST', body: JSON.stringify({ action:action, folder:window._pfFolder||'inbox', uid:uid }) });
    if(d) d.innerHTML='<div style="color:var(--muted);font-size:13px">Nachricht links auswählen.</div>';
    postfachSeiteListeLaden();
  }catch(e){
    alert('Fehler: '+e.message);
  }
}
async function postfachSeiteOeffnen(uid){
  var d=document.getElementById('pfDetail'); if(!d) return;
  var kind=window._pfFolder||'inbox';
  d.innerHTML='<div style="color:var(--muted);font-size:13px">Lade …</div>';
  var z=document.getElementById('pfZeile'+uid); if(z) z.style.background='';
  try{
    var j=await postfachFetch('?action=read&uid='+uid+'&folder='+encodeURIComponent(kind));
    var m=j.message||{};
    var von=m.from||'', adr=(String(von).match(/<([^>]+)>/)||[])[1]||von;
    var betreff=/^re:/i.test(m.subject||'')?m.subject:('Re: '+(m.subject||''));
    var kopfZeile2 = kind==='sent' ? ('An: '+esc(m.to||'')+' · '+esc(m.date||'')) : (esc(von)+' · '+esc(m.date||''));
    d.innerHTML=pfAktionLeiste(uid)
      +'<div style="font-weight:800;font-size:16px;margin-bottom:2px">'+esc(m.subject||'(kein Betreff)')+'</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">'+kopfZeile2+'</div>'
      +'<div style="white-space:pre-wrap;font-size:13.5px;line-height:1.55;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:16px">'+esc(m.text||'(kein Text)')+'</div>'
      +(kind==='sent' ? '' :
      '<div style="font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px">Antworten an '+esc(adr)+'</div>'
      +'<input id="pfAntwBetreff" value="'+esc(betreff)+'" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-bottom:8px;background:var(--bg);color:var(--ink)">'
      +'<div style="display:flex;gap:5px;margin-bottom:6px">'
        +pfToolbarBtn('bold','B')+pfToolbarBtn('italic','I')+pfToolbarBtn('underline','U')
        +pfToolbarBtn('insertUnorderedList','•')+pfToolbarBtn('insertOrderedList','1.')
        +'<button type="button" onmousedown="event.preventDefault()" onclick="var u=prompt(\'Link-Adresse:\',\'https://\');if(u)document.execCommand(\'createLink\',false,u);document.getElementById(\'pfAntwHtml\').focus()" '
          +'title="Link" style="border:1px solid var(--line);background:var(--bg);color:var(--ink);width:28px;height:26px;border-radius:6px;cursor:pointer;font-size:12.5px">🔗</button>'
      +'</div>'
      +'<div id="pfAntwHtml" contenteditable="true" style="min-height:140px;max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:8px;'
        +'padding:9px 11px;font-size:13px;line-height:1.5;background:var(--bg);color:var(--ink)"><div><br></div>'+POSTFACH_SIGNATUR_HTML+'</div>'
      +'<div id="pfAntwMsg" style="font-size:11.5px;margin:6px 0"></div>'
      +'<button onclick="postfachSeiteSenden(\''+esc(adr)+'\')" style="padding:8px 16px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);font-weight:700;font-size:13px;cursor:pointer">Senden</button>');
    /* Cursor an den Anfang setzen (vor der Signatur), nicht ins Signatur-Ende. */
    var box=document.getElementById('pfAntwHtml');
    if(box && box.firstChild){
      try{
        var range=document.createRange(), sel=window.getSelection();
        range.setStart(box.firstChild,0); range.collapse(true);
        sel.removeAllRanges(); sel.addRange(range);
      }catch(e){}
    }
    if(m.seen===false){ var it=(window._postfach||[]).find(function(x){return x.uid===uid;}); if(it) it.seen=true; postfachSeiteListeZeichnen(); postfachBadgeAktualisieren(); }
  }catch(e){
    d.innerHTML='<div style="color:var(--k-dc2626);font-size:13px">Fehler: '+esc(e.message)+'</div>';
  }
}
function postfachHtmlZuText(html){
  var tmp=document.createElement('div'); tmp.innerHTML=html;
  return (tmp.textContent||tmp.innerText||'').replace(/\n{3,}/g,'\n\n').trim();
}
async function postfachSeiteSenden(an){
  var msg=document.getElementById('pfAntwMsg');
  var betreff=(document.getElementById('pfAntwBetreff')||{}).value||'';
  var box=document.getElementById('pfAntwHtml');
  var html=box?box.innerHTML:'';
  var text=postfachHtmlZuText(html);
  if(!text.trim()){ if(msg){msg.style.color='var(--k-dc2626)';msg.textContent='Text fehlt.';} return; }
  if(msg){ msg.style.color='var(--muted)'; msg.textContent='Sende …'; }
  try{
    await postfachFetch('', { method:'POST', body: JSON.stringify({ action:'send', to:an, subject:betreff, text:text, html:html }) });
    if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='✓ gesendet'; }
  }catch(e){
    if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+e.message; }
  }
}
