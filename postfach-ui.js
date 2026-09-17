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
   17.09.2026 (v3), Ralph: "neu mail verfassen fehlt und ein kontaktbuch."
   "Neu"-Knopf oeffnet dasselbe Formular wie eine Antwort, nur mit leerem,
   editierbarem An-Feld (pfComposeBlock() ist jetzt fuer beides gemeinsam).
   Kontaktbuch ist ein eigenes Overlay (Tabelle Postfach_Kontakte in Supabase,
   nur ueber die Edge Function erreichbar) - Kontakte fuellen per Klick das
   An-Feld und stehen zusaetzlich als Vorschlagsliste (datalist) am Feld selbst.
   Server-Teil unveraendert im Prinzip: Edge Function "mail-postfach" (IMAP
   lesen/verschieben, SMTP senden, Kontaktbuch), Zugangsdaten als Supabase-
   Secrets. Seite wird dynamisch erzeugt (kein neuer Container in admin.html -
   dort liegen andere, unabhaengige Aenderungen von Ralph). Die Seite haengt
   sich in setMode() ein (app.js, isolierte eine Zeile), genau wie jede andere
   Admin-Ansicht (A4.2). */

var POSTFACH_SIGNATUR_HTML =
  '<div><br></div><div>Dein Root-Index-Team</div>'
  + '<div style="color:#5b6d73;font-size:11.5px">wissenschaftsbasiert. sponsorenfrei. unabhängig.</div>'
  + '<div style="color:#5b6d73;font-size:11.5px">root-index.de</div>';

var PF_ORDNER = [
  { kind:'inbox',   label:'Posteingang' },
  { kind:'sent',    label:'Gesendet' },
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
    +'<div style="display:flex;align-items:center;gap:10px;margin:0 2px 12px;flex-wrap:wrap">'
      +'<div style="font-weight:800;font-size:20px;flex:1">✉️ Postfach · kontakt@root-index.de</div>'
      +'<button onclick="postfachNeuVerfassen()" style="border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);font-weight:700;font-size:12.5px;padding:8px 14px;cursor:pointer">✏️ Neu verfassen</button>'
      +'<button onclick="pfKontaktbuchOeffnen()" style="border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:8px;font-weight:700;font-size:12.5px;padding:8px 14px;cursor:pointer">👤 Kontakte</button>'
    +'</div>'
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
  +'</div>'
  +'<datalist id="pfKontakteDatalist"></datalist>';
  postfachSeiteListeLaden();
  postfachKontakteLaden();
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

/* ---- Verfassen (Antwort UND neue Nachricht teilen sich dieses Formular) --- */
function pfComposeBlock(opts){
  var an=opts.an||'', anEditierbar=!!opts.anEditierbar, betreff=opts.betreff||'';
  var anZeile = anEditierbar
    ? '<input id="pfAntwAn" list="pfKontakteDatalist" value="'+esc(an)+'" placeholder="An: name@beispiel.de" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-bottom:8px;background:var(--bg);color:var(--ink)">'
    : '<div style="font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:6px">Antworten an '+esc(an)+'</div>'
      +'<input id="pfAntwAn" type="hidden" value="'+esc(an)+'">';
  return anZeile
    +'<input id="pfAntwBetreff" value="'+esc(betreff)+'" placeholder="Betreff" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:13px;margin-bottom:8px;background:var(--bg);color:var(--ink)">'
    +'<div style="display:flex;gap:5px;margin-bottom:6px">'
      +pfToolbarBtn('bold','B')+pfToolbarBtn('italic','I')+pfToolbarBtn('underline','U')
      +pfToolbarBtn('insertUnorderedList','•')+pfToolbarBtn('insertOrderedList','1.')
      +'<button type="button" onmousedown="event.preventDefault()" onclick="var u=prompt(\'Link-Adresse:\',\'https://\');if(u)document.execCommand(\'createLink\',false,u);document.getElementById(\'pfAntwHtml\').focus()" '
        +'title="Link" style="border:1px solid var(--line);background:var(--bg);color:var(--ink);width:28px;height:26px;border-radius:6px;cursor:pointer;font-size:12.5px">🔗</button>'
    +'</div>'
    +'<div id="pfAntwHtml" contenteditable="true" style="min-height:140px;max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:8px;'
      +'padding:9px 11px;font-size:13px;line-height:1.5;background:var(--bg);color:var(--ink)"><div><br></div>'+POSTFACH_SIGNATUR_HTML+'</div>'
    +'<div id="pfAntwMsg" style="font-size:11.5px;margin:6px 0"></div>'
    +'<button onclick="postfachSeiteSenden()" style="padding:8px 16px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);font-weight:700;font-size:13px;cursor:pointer">Senden</button>';
}
function pfComposeCursorSetzen(){
  var box=document.getElementById('pfAntwHtml');
  if(box && box.firstChild){
    try{
      var range=document.createRange(), sel=window.getSelection();
      range.setStart(box.firstChild,0); range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range);
    }catch(e){}
  }
}
function postfachNeuVerfassen(){
  var d=document.getElementById('pfDetail'); if(!d) return;
  d.innerHTML='<div style="font-weight:800;font-size:16px;margin-bottom:14px">✏️ Neue Nachricht</div>'
    +pfComposeBlock({ an:'', anEditierbar:true, betreff:'' });
  pfComposeCursorSetzen();
  var an=document.getElementById('pfAntwAn'); if(an) an.focus();
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
      +(kind==='sent' ? '' : pfComposeBlock({ an:adr, anEditierbar:false, betreff:betreff }));
    pfComposeCursorSetzen();
    if(m.seen===false){ var it=(window._postfach||[]).find(function(x){return x.uid===uid;}); if(it) it.seen=true; postfachSeiteListeZeichnen(); postfachBadgeAktualisieren(); }
  }catch(e){
    d.innerHTML='<div style="color:var(--k-dc2626);font-size:13px">Fehler: '+esc(e.message)+'</div>';
  }
}
function postfachHtmlZuText(html){
  /* 17.09.2026: textContent allein schluckt die Zeilenumbrueche zwischen den
     <div>-Bloecken des contenteditable-Felds - ohne diesen Schritt kommt
     "ZeileZeileZeile" statt "Zeile\nZeile\nZeile" beim Empfaenger an. Erst
     <br>/</div>/</p> in \n uebersetzen, dann erst die Tags entfernen. */
  var mitUmbruechen = String(html||'')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n');
  var tmp=document.createElement('div'); tmp.innerHTML=mitUmbruechen;
  return (tmp.textContent||tmp.innerText||'').replace(/\n{3,}/g,'\n\n').trim();
}
async function postfachSeiteSenden(){
  var msg=document.getElementById('pfAntwMsg');
  var an=(document.getElementById('pfAntwAn')||{}).value||'';
  var betreff=(document.getElementById('pfAntwBetreff')||{}).value||'';
  var box=document.getElementById('pfAntwHtml');
  var html=box?box.innerHTML:'';
  var text=postfachHtmlZuText(html);
  if(!an.trim()){ if(msg){msg.style.color='var(--k-dc2626)';msg.textContent='Empfänger fehlt.';} return; }
  if(!text.trim()){ if(msg){msg.style.color='var(--k-dc2626)';msg.textContent='Text fehlt.';} return; }
  if(msg){ msg.style.color='var(--muted)'; msg.textContent='Sende …'; }
  try{
    await postfachFetch('', { method:'POST', body: JSON.stringify({ action:'send', to:an, subject:betreff, text:text, html:html }) });
    if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='✓ gesendet'; }
  }catch(e){
    if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+e.message; }
  }
}

/* ---- Kontaktbuch (Overlay) -------------------------------------------------
   17.09.2026, Ralph: "ein kontaktbuch". Eigene Tabelle (Postfach_Kontakte),
   nur ueber die Edge Function erreichbar (kein RLS-Policy, Service-Role-Key).
   Kontakte fuellen per Klick das An-Feld einer offenen Antwort/neuen Nachricht
   und stehen zusaetzlich als Tipphilfe (datalist) am Feld selbst. */
async function postfachKontakteLaden(){
  try{
    var j=await postfachFetch('?action=contacts');
    window._pfKontakte=j.kontakte||[];
    var dl=document.getElementById('pfKontakteDatalist');
    if(dl) dl.innerHTML=window._pfKontakte.map(function(k){
      return '<option value="'+esc(k.email)+'">'+esc(k.name||k.email)+'</option>';
    }).join('');
    var l=document.getElementById('pfKontaktListe');
    if(l) pfKontaktbuchZeichnen();
  }catch(e){ /* still - Kontaktbuch ist kein Grund, das Postfach zu blockieren */ }
}
function pfKontaktbuchModalEl(){
  var m=document.getElementById('pfKontaktModal');
  if(m) return m;
  m=document.createElement('div'); m.id='pfKontaktModal'; m.style.cssText='display:none;position:fixed;inset:0;z-index:9600;background:rgba(20,30,40,.35);align-items:center;justify-content:center;padding:16px';
  m.innerHTML='<div style="background:var(--card,#fff);color:var(--ink);border-radius:14px;max-width:420px;width:100%;max-height:80vh;overflow:auto;padding:18px;box-shadow:0 18px 46px rgba(20,40,70,.3)">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
      +'<span style="font-weight:800;font-size:16px;flex:1">👤 Kontakte</span>'
      +'<button onclick="pfKontaktbuchSchliessen()" style="border:0;background:transparent;color:var(--muted);font-size:18px;cursor:pointer;padding:0 4px">✕</button>'
    +'</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:12px">'
      +'<input id="pfKontaktName" placeholder="Name" style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--bg);color:var(--ink)">'
      +'<input id="pfKontaktEmail" placeholder="E-Mail" style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;background:var(--bg);color:var(--ink)">'
    +'</div>'
    +'<button onclick="postfachKontaktHinzufuegen()" style="width:100%;padding:8px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);font-weight:700;font-size:12.5px;cursor:pointer;margin-bottom:6px">+ Kontakt hinzufügen</button>'
    +'<div id="pfKontaktMsg" style="font-size:11.5px;margin-bottom:8px"></div>'
    +'<div id="pfKontaktListe"></div>'
  +'</div>';
  document.body.appendChild(m);
  m.addEventListener('click', function(ev){ if(ev.target===m) pfKontaktbuchSchliessen(); });
  return m;
}
function pfKontaktbuchOeffnen(){
  var m=pfKontaktbuchModalEl();
  m.style.display='flex';
  pfKontaktbuchZeichnen();
}
function pfKontaktbuchSchliessen(){
  var m=document.getElementById('pfKontaktModal'); if(m) m.style.display='none';
}
function pfKontaktbuchZeichnen(){
  var l=document.getElementById('pfKontaktListe'); if(!l) return;
  var arr=window._pfKontakte||[];
  if(!arr.length){ l.innerHTML='<div style="color:var(--muted);font-size:12px;padding:6px 0">Noch keine Kontakte.</div>'; return; }
  l.innerHTML=arr.map(function(k){
    var istKunde = k.quelle==='kunde';
    return '<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid var(--line)">'
      +'<div onclick="pfKontaktUebernehmen(\''+esc(k.email)+'\')" style="flex:1;min-width:0;cursor:pointer">'
        +'<div style="font-weight:700;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(k.name||'(ohne Namen)')
          +(istKunde?' <span style="font-weight:600;color:var(--muted);font-size:10px">· Kunde</span>':'')+'</div>'
        +'<div style="color:var(--muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(k.email)+'</div>'
      +'</div>'
      +(istKunde?'' : '<button onclick="postfachKontaktLoeschen('+k.id+')" title="löschen" style="border:0;background:transparent;color:var(--muted);font-size:14px;cursor:pointer;padding:2px 4px">🗑</button>')
    +'</div>';
  }).join('');
}
function pfKontaktUebernehmen(email){
  var an=document.getElementById('pfAntwAn');
  if(an){ an.value=email; pfKontaktbuchSchliessen(); an.focus(); return; }
  /* Kein offenes Formular - "Neu verfassen" oeffnen und dann uebernehmen. */
  postfachNeuVerfassen();
  var an2=document.getElementById('pfAntwAn'); if(an2) an2.value=email;
  pfKontaktbuchSchliessen();
}
async function postfachKontaktHinzufuegen(){
  var msg=document.getElementById('pfKontaktMsg');
  var name=(document.getElementById('pfKontaktName')||{}).value||'';
  var email=(document.getElementById('pfKontaktEmail')||{}).value||'';
  if(!email.trim()){ if(msg){msg.style.color='var(--k-dc2626)';msg.textContent='E-Mail-Adresse fehlt.';} return; }
  try{
    await postfachFetch('', { method:'POST', body: JSON.stringify({ action:'contact_add', name:name, email:email }) });
    document.getElementById('pfKontaktName').value='';
    document.getElementById('pfKontaktEmail').value='';
    if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='✓ hinzugefügt'; }
    postfachKontakteLaden();
  }catch(e){
    if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+e.message; }
  }
}
async function postfachKontaktLoeschen(id){
  if(!confirm('Kontakt löschen?')) return;
  try{
    await postfachFetch('', { method:'POST', body: JSON.stringify({ action:'contact_delete', id:id }) });
    postfachKontakteLaden();
  }catch(e){
    alert('Fehler: '+e.message);
  }
}
