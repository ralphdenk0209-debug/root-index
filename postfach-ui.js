/* ---- POSTFACH-DOCK --------------------------------------------------------
   17.09.2026, Ralph: Mini-Mail-Client (lesen+antworten) fuer kontakt@root-index.de,
   direkt im Dashboard. Server-Teil: Edge Function "mail-postfach" (IMAP zum
   Lesen, SMTP zum Senden - Zugangsdaten liegen dort als Supabase-Secrets,
   NIE im Frontend). Gleiches Auth-Muster wie admin-set-password (A4.2):
   client.auth.getSession() -> Bearer-Token, Server prueft is_admin selbst.
   Dock-Aufbau (fixes Panel, eigene IDs) nach dem Vorbild von notiz-dock-ui.js. */

function postfachDockEl(){
  var d=document.getElementById('postfachDock');
  if(d) return d;
  d=document.createElement('div'); d.id='postfachDock';
  d.style.cssText='position:fixed;right:12px;top:56px;width:380px;max-width:calc(100vw - 24px);'
    +'max-height:calc(100vh - 76px);display:none;flex-direction:column;z-index:9500;'
    +'background:var(--card,#fff);color:var(--ink);border:1px solid var(--line);border-radius:14px;'
    +'box-shadow:0 18px 46px rgba(20,40,70,.26);overflow:hidden';
  d.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);flex:0 0 auto">'
      +'<span style="font-weight:800;font-size:14px">✉️ kontakt@root-index.de</span>'
      +'<button onclick="postfachLoad()" title="aktualisieren" style="border:0;background:transparent;color:var(--muted);font-size:14px;cursor:pointer;padding:0 2px">⟳</button>'
      +'<button onclick="postfachDockToggle(false)" title="schließen" style="margin-left:auto;border:0;background:transparent;color:var(--muted);font-size:17px;line-height:1;cursor:pointer;padding:0 2px">✕</button>'
    +'</div>'
    +'<div id="postfachBody" style="flex:1 1 auto;min-height:0;overflow:auto;font-size:13px"></div>';
  document.body.appendChild(d);
  return d;
}
function postfachDockToggle(force){
  var d=postfachDockEl();
  var auf=(typeof force==='boolean')?force:(d.style.display==='none'||!d.style.display);
  d.style.display=auf?'flex':'none';
  try{ localStorage.setItem('ri_postfachDock', auf?'1':'0'); }catch(e){}
  if(auf) postfachLoad();
}
function postfachBadge(n){
  var b=document.getElementById('riMailN'); if(!b) return;
  b.textContent=n?String(n):''; b.style.display=n?'':'none';
}
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
async function postfachLoad(){
  var body=document.getElementById('postfachBody'); if(!body) return;
  body.innerHTML='<div style="padding:14px;color:var(--muted)">Lade …</div>';
  try{
    var j=await postfachFetch('?action=list&limit=20');
    window._postfach=j.items||[];
    postfachBadge(window._postfach.filter(function(m){return !m.seen;}).length);
    postfachRenderListe();
  }catch(e){
    body.innerHTML='<div style="padding:14px;color:var(--k-dc2626)">Fehler: '+esc(e.message)+'</div>';
  }
}
function postfachRenderListe(){
  var body=document.getElementById('postfachBody'); if(!body) return;
  var arr=window._postfach||[];
  if(!arr.length){ body.innerHTML='<div style="padding:14px;color:var(--muted)">Kein Posteingang oder leer.</div>'; return; }
  body.innerHTML=arr.map(function(m){
    return '<div onclick="postfachOeffnen('+m.uid+')" style="padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer'
      +(m.seen?'':';background:rgba(23,80,92,.06)')+'">'
      +'<div style="display:flex;gap:6px;align-items:baseline">'
        +'<span style="font-weight:'+(m.seen?'600':'800')+';flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(m.subject||'(kein Betreff)')+'</span>'
        +'<span style="font-size:10.5px;color:var(--muted);flex:0 0 auto">'+esc((m.date||'').replace(/^\w+,\s*/,'').slice(0,17))+'</span>'
      +'</div>'
      +'<div style="font-size:11.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(postfachKurz(m.from))+'</div>'
    +'</div>';
  }).join('');
}
async function postfachOeffnen(uid){
  var body=document.getElementById('postfachBody'); if(!body) return;
  body.innerHTML='<div style="padding:14px;color:var(--muted)">Lade …</div>';
  try{
    var j=await postfachFetch('?action=read&uid='+uid);
    var m=j.message||{};
    var von=m.from||'', adr=(String(von).match(/<([^>]+)>/)||[])[1]||von;
    var betreff=/^re:/i.test(m.subject||'')?m.subject:('Re: '+(m.subject||''));
    body.innerHTML='<div style="padding:10px 12px">'
      +'<button onclick="postfachRenderListe()" style="border:0;background:transparent;color:var(--muted);font-size:12px;cursor:pointer;padding:0 0 8px">← zurück</button>'
      +'<div style="font-weight:800;font-size:14px;margin-bottom:2px">'+esc(m.subject||'(kein Betreff)')+'</div>'
      +'<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">'+esc(von)+' · '+esc(m.date||'')+'</div>'
      +'<div style="white-space:pre-wrap;font-size:12.5px;line-height:1.5;border:1px solid var(--line);border-radius:9px;padding:9px 11px;margin-bottom:10px;max-height:220px;overflow:auto">'+esc(m.text||'(kein Text)')+'</div>'
      +'<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px">Antworten an '+esc(adr)+'</div>'
      +'<input id="pfAntwBetreff" value="'+esc(betreff)+'" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;margin-bottom:6px;background:var(--bg);color:var(--ink)">'
      +'<textarea id="pfAntwText" rows="5" placeholder="Antwort…" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;resize:vertical;background:var(--bg);color:var(--ink)"></textarea>'
      +'<div id="pfAntwMsg" style="font-size:11.5px;margin:4px 0"></div>'
      +'<button onclick="postfachAntworten(\''+esc(adr)+'\')" style="padding:7px 14px;border:0;border-radius:8px;background:var(--green);color:var(--auf-gruen);font-weight:700;font-size:12.5px;cursor:pointer">Senden</button>'
    +'</div>';
  }catch(e){
    body.innerHTML='<div style="padding:14px;color:var(--k-dc2626)">Fehler: '+esc(e.message)+'</div>';
  }
}
async function postfachAntworten(an){
  var msg=document.getElementById('pfAntwMsg');
  var betreff=(document.getElementById('pfAntwBetreff')||{}).value||'';
  var text=(document.getElementById('pfAntwText')||{}).value||'';
  if(!text.trim()){ if(msg){msg.style.color='var(--k-dc2626)';msg.textContent='Text fehlt.';} return; }
  if(msg){ msg.style.color='var(--muted)'; msg.textContent='Sende …'; }
  try{
    await postfachFetch('', { method:'POST', body: JSON.stringify({ to:an, subject:betreff, text:text }) });
    if(msg){ msg.style.color='var(--k-16a34a)'; msg.textContent='✓ gesendet'; }
  }catch(e){
    if(msg){ msg.style.color='var(--k-dc2626)'; msg.textContent='Fehler: '+e.message; }
  }
}
/* Beim Laden: war das Dock offen, bleibt es offen (gleiches Muster wie todoDock). */
try{
  if(localStorage.getItem('ri_postfachDock')==='1'){
    document.addEventListener('DOMContentLoaded', function(){ try{ postfachDockToggle(true); }catch(e){} });
  }
}catch(e){}
