/* fachleute-fl5.js · 11.11.2026 · FL-5
   Arbeiten mit einem Klienten: Bericht (Drucken/PDF), Ernährungspläne mit
   Ist gegen Plan, Rezepte teilen. Wird von therapeut.html über dem Dashboard
   (fachleute-dashboard.js) eingehängt – echte Klienten und Musterpraxis.
   Alle Zahlen kommen vom Server: Bericht = FL-4-Dashboard (cb_fp_klient_dashboard
   bzw. cb_fl_muster_dashboard, darin FL-2 Ist-Soll mit Quellen); Pläne =
   cb_fp_plaene / cb_fl5_muster_plaene. Diese Datei rechnet nur Durchschnitte
   je erfasstem Tag aus den Summen (Summe ÷ erfasste Tage) und zeigt an.

   FL5.mount(element, {
     muster: true|false, code, nr, token (Vorschau-Link), heute: 'YYYY-MM-DD',
     praxis, fachperson,                       // Kopf des Berichts
     rpc: async (name, args) => data,          // wirft bei Fehler
     ladeDashboard: async (von, bis) => json,  // wie FLDash
     klienten: [{code, name}],                 // verbundene Klienten (zum Teilen mit mehreren)
     nurTab: 'bericht'|'plaene'|'rezepte'      // optional: nur diesen Teil zeigen, ohne eigene Reiter
   })                                           // (für Menüpunkte „Berichte“, „Pläne“, „Rezepte“) */
(function(){
'use strict';
const CSS = `
/* Farben nur aus den gemeinsamen Variablen von therapeut.html (FL-4, Optik Content Studio); Werte hinter dem Komma nur als Ersatz */
.f5{--f5-gruen:var(--blau,#2e7d46);--f5-gruen-h:var(--blau-h,#25683a);--f5-dunkel:var(--ink,#133521);--f5-creme:var(--blau-zart,#F3EEDC);--f5-muted:var(--muted,#5d6b61);--f5-linie:var(--line,#dfe6df);--f5-rot:var(--bad,#b42318);--f5-orange:var(--warn,#e8920c);--f5-panel:var(--panel,#fff);--f5-ok-zart:var(--ok-zart,#dff3e5);--f5-warn-zart:var(--warn-zart,#fff1dc);--f5-bad-zart:var(--bad-zart,#fde7e5);color:var(--ink,inherit)}
.f5 .f5-karte{background:var(--f5-panel);border:2px solid var(--f5-gruen);border-radius:16px;padding:14px 16px;margin:14px 0}
.f5 h2{font-size:18px;margin:0 0 4px;color:var(--f5-dunkel)} .f5 h3{font-size:15px;margin:14px 0 6px;color:var(--f5-dunkel)}
.f5 .f5-k{font-size:13px;color:var(--f5-muted)}
.f5 .f5-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.f5 .f5-tabs button{flex:1;min-width:150px;border:1px solid var(--f5-linie);background:var(--f5-panel);border-radius:11px;padding:10px 8px;font:inherit;font-size:15px;font-weight:800;color:var(--f5-dunkel);cursor:pointer}
.f5 .f5-tabs button.an{background:var(--f5-gruen);color:#fff;border-color:var(--f5-gruen)}
.f5 .f5-panel{margin-top:12px}
.f5 .f5-reihe{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:8px 0}
.f5 .f5-reihe > label{font-size:13px;font-weight:800;display:flex;flex-direction:column;gap:3px}
.f5 input,.f5 select,.f5 textarea{padding:8px 9px;border:1px solid var(--f5-linie);border-radius:9px;font:inherit;font-size:15px;background:var(--f5-panel);color:inherit}
.f5 textarea{width:100%;min-height:80px;resize:vertical}
.f5 .f5-b{border:1px solid var(--f5-linie);background:var(--f5-panel);border-radius:9px;padding:7px 11px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;color:var(--f5-dunkel)}
.f5 .f5-b.gruen{background:var(--f5-gruen);border-color:var(--f5-gruen);color:#fff}
.f5 .f5-b.rot{color:var(--f5-rot);border-color:#f0c6c2}
.f5 .f5-b.gruen:hover{background:var(--f5-gruen-h)} .f5 .f5-b.an{background:var(--f5-gruen);border-color:var(--f5-gruen);color:#fff}
.f5 .f5-b:disabled{opacity:.5;cursor:default}
.f5 .f5-chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:800;background:var(--f5-creme);color:var(--f5-dunkel);margin:2px 4px 2px 0}
.f5 .f5-chip.gruen{background:var(--f5-ok-zart);color:var(--ok,#2e7d46)} .f5 .f5-chip.grau{background:var(--f5-linie);color:var(--f5-muted)} .f5 .f5-chip.blau{background:var(--f5-creme);color:var(--f5-gruen)}
.f5 .f5-plan{border:1px solid var(--f5-linie);border-radius:14px;padding:12px;margin-top:10px}
.f5 .f5-tab-wrap{overflow-x:auto;margin-top:8px}
.f5 table.f5-raster{border-collapse:collapse;width:100%;min-width:620px;font-size:13px}
.f5 .f5-raster th,.f5 .f5-raster td{border-bottom:1px solid var(--f5-linie);padding:5px;vertical-align:top;text-align:left}
.f5 .f5-raster th{font-size:12px;color:var(--f5-muted)}
.f5 .f5-raster td.z{text-align:right;white-space:nowrap}
.f5 .f5-e{border-radius:7px;padding:3px 6px;margin:2px 0;background:var(--f5-creme);line-height:1.25}
.f5 .f5-e small{display:block;color:var(--f5-muted)}
.f5 .f5-e.wie_geplant{background:var(--f5-ok-zart)} .f5 .f5-e.anders{background:var(--f5-warn-zart)} .f5 .f5-e.nichts_eingetragen{background:var(--f5-bad-zart)} .f5 .f5-e.eingetragen{background:var(--f5-creme)}
.f5 .f5-e button{border:0;background:none;color:var(--f5-rot);cursor:pointer;font-size:13px;padding:0 0 0 4px}
.f5 .f5-plus{border:1px dashed var(--f5-linie);background:var(--f5-panel);border-radius:7px;width:100%;padding:3px;font-size:13px;color:var(--f5-gruen);cursor:pointer;margin-top:2px}
.f5 .f5-wahl{border:1px solid var(--f5-gruen);border-radius:12px;padding:10px;margin:8px 0;background:var(--f5-panel)}
.f5 .f5-treffer{max-height:220px;overflow:auto;border:1px solid var(--f5-linie);border-radius:9px;margin-top:6px;background:var(--f5-panel)}
.f5 .f5-treffer div{padding:7px 9px;border-bottom:1px solid var(--f5-linie);cursor:pointer;font-size:14px}
.f5 .f5-treffer div:hover,.f5 .f5-treffer div.an{background:var(--f5-creme)}
.f5 .f5-legende{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--f5-muted);margin-top:6px}
.f5 .f5-legende i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.f5 .f5-rez{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--f5-linie)}
.f5 .f5-rez img,.f5 .f5-rez .ph{width:44px;height:44px;border-radius:10px;object-fit:cover;background:var(--f5-creme);flex:0 0 44px}
.f5 .f5-hinweis{background:var(--f5-warn-zart);border:1px solid var(--f5-linie);border-radius:12px;padding:10px 12px;font-size:13px;color:var(--f5-dunkel);margin-top:10px}
.f5 .f5-meld{font-size:14px;margin-top:6px} .f5 .f5-meld.f{color:var(--f5-rot)} .f5 .f5-meld.ok{color:var(--ok,#2e7d46)}
/* Bericht */
#fl5Bericht{--f5b-akzent:var(--blau,#1f4fd1);position:fixed;inset:0;z-index:1000;background:var(--paper,#e9ece9);overflow:auto;padding:16px}
#fl5Bericht .f5-leiste{max-width:820px;margin:0 auto 10px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
#fl5Bericht .f5-blatt{max-width:820px;margin:0 auto;background:#fff;padding:28px 32px;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.12);color:#1f2a22;font:14px/1.45 Inter,-apple-system,Helvetica,Arial,sans-serif}
#fl5Bericht .bk{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid var(--f5b-akzent);padding-bottom:10px;margin-bottom:12px;flex-wrap:wrap}
#fl5Bericht .bk .p{font-size:18px;font-weight:800;color:#111} #fl5Bericht .bk .r{text-align:right}
#fl5Bericht h1{font-size:22px;margin:0;color:#111;letter-spacing:-.015em} #fl5Bericht h2{font-size:16px;margin:18px 0 6px;color:var(--f5b-akzent);border-bottom:1px solid #d9d9d9;padding-bottom:3px;letter-spacing:-.015em}
#fl5Bericht table{width:100%;border-collapse:collapse;font-size:13px} #fl5Bericht th,#fl5Bericht td{padding:4px 6px;border-bottom:1px solid #e6e6e6;text-align:left;vertical-align:top}
#fl5Bericht th{font-size:11.5px;color:#666} #fl5Bericht td.z,#fl5Bericht th.z{text-align:right;white-space:nowrap}
#fl5Bericht .kl{font-size:11.5px;color:#666} #fl5Bericht .ok{color:#111;font-weight:800} #fl5Bericht .nein{color:#111;font-weight:800;text-decoration:underline}
#fl5Bericht .sc{display:inline-block;min-width:28px;text-align:center;border-radius:6px;padding:1px 5px;font-weight:800;color:#fff;font-size:12px}
#fl5Bericht .notiz{border:1px solid #cfcfcf;border-radius:8px;padding:10px;min-height:110px;white-space:pre-wrap}
#fl5Bericht .linien{background:repeating-linear-gradient(#fff,#fff 27px,#d9d9d9 28px);min-height:170px}
#fl5Bericht .zw{display:grid;grid-template-columns:1fr 1fr;gap:16px} @media (max-width:640px){#fl5Bericht .zw{grid-template-columns:1fr} #fl5Bericht .f5-blatt{padding:18px 12px;font-size:13px} #fl5Bericht table{display:block;overflow-x:auto} #fl5Bericht .bk .r{text-align:left}}
@media print{
  @page{size:A4;margin:14mm}
  body.fl5-druck > *:not(#fl5Bericht){display:none!important}
  body.fl5-druck #druck{display:none!important}
  body.fl5-druck #fl5Bericht{display:block!important;position:static;background:#fff;padding:0;overflow:visible}
  body.fl5-druck #fl5Bericht .f5-leiste{display:none!important}
  body.fl5-druck #fl5Bericht .f5-blatt{box-shadow:none;max-width:none;padding:0;border-radius:0}
  #fl5Bericht h2{break-after:avoid} #fl5Bericht tr,#fl5Bericht .notiz{break-inside:avoid}
}`;
function css(){ if(document.getElementById('f5-css')) return; const s = document.createElement('style'); s.id = 'f5-css'; s.textContent = CSS; document.head.appendChild(s); }
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const D = s => new Date(String(s).slice(0,10) + 'T12:00:00Z');
const iso = d => d.toISOString().slice(0,10);
const plus = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate()+n); return iso(d); };
const montag = s => { const d = D(s); const w = (d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-w); return iso(d); };
const tageZw = (a, b) => Math.round((D(b) - D(a)) / 86400000);
const WT = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const dt = s => s ? D(s).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC'}) : '–';
const tk = s => WT[D(s).getUTCDay()] + ' ' + D(s).getUTCDate() + '.' + (D(s).getUTCMonth()+1) + '.';
const z = (x, st) => x==null || x==='' || isNaN(Number(x)) ? '–' : Number(x).toLocaleString('de-DE', {maximumFractionDigits: st==null?0:st});
const SLOTS = ['Frühstück','Mittag','Abendessen','Snack'];
/* Plätze je Tag (FL-5b): Slot bleibt 'Snack', die Tageszeit steht in snack_zeit (alte Apps zeigen einfach mehrere Snacks) */
const PLAETZE = [
  {k:'Frühstück', slot:'Frühstück', sz:null, l:'Frühstück'}, {k:'Snack:vormittags', slot:'Snack', sz:'vormittags', l:'Snack vormittags'},
  {k:'Mittag', slot:'Mittag', sz:null, l:'Mittag'}, {k:'Snack:nachmittags', slot:'Snack', sz:'nachmittags', l:'Snack nachmittags'},
  {k:'Abendessen', slot:'Abendessen', sz:null, l:'Abendessen'}, {k:'Snack:abends', slot:'Snack', sz:'abends', l:'Snack abends'},
  {k:'Snack:spaet', slot:'Snack', sz:'spaet', l:'Spätsnack'}];
const platzVon = y => y.slot==='Snack' ? 'Snack:' + (y.snack_zeit || 'nachmittags') : y.slot;
const plaetzeFuer = (eintraege, spaet) => PLAETZE.filter(p => p.k!=='Snack:spaet' || spaet || (eintraege||[]).some(y => platzVon(y)==='Snack:spaet'));
const KZ = {kcal:'Energie', protein:'Eiweiß', kh:'Kohlenhydrate', fett:'Fett', zucker:'Zucker', ballaststoffe:'Ballaststoffe', salz:'Salz',
            ges_fett:'Gesättigte Fettsäuren', 'gruppe:gemuese':'Gemüse', 'gruppe:obst':'Obst', 'gruppe:gemuese+obst':'Obst und Gemüse'};
const ART = {mindestens:'mind.', hoechstens:'höchstens', etwa:'etwa', bereich:''};
const BEW = {'Sehr gut':'#15803d','Gut':'#4d7c0f','Mittel':'#b45309','Schwach':'#b91c1c'};
const bewFarbe = (b, s) => BEW[b] || (s==null ? '#78716c' : s>=80 ? '#15803d' : s>=65 ? '#4d7c0f' : s>=50 ? '#b45309' : '#b91c1c');
const STATUS = {wie_geplant:'wie geplant', anders:'anders gegessen', nichts_eingetragen:'kein Eintrag', eingetragen:'eingetragen', offen:'offen'};
/* Vorführung (Demo): Änderungen bleiben nur in diesem Browser-Tab (sessionStorage), FL-4 leert 'fl-demo*' beim Zurücksetzen */
const DEMO_KEY = 'fl-demo-fl5';
const demoLaden = () => { try{ return JSON.parse(sessionStorage.getItem(DEMO_KEY) || '{}') || {}; }catch(e){ return {}; } };
const demoSchreiben = d => { try{ sessionStorage.setItem(DEMO_KEY, JSON.stringify(d)); }catch(e){} };
const herk = h => ({'Vorgabe Therapeutin':'Praxis', 'Ziel im Profil':'App'})[h] || h || '';
const kuerzel = n => String(n||'').trim().split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + '.').join(' ') || '–';

function mount(el, opt){
  css();
  const heute = opt.heute || iso(new Date());
  const st = { tab: null, plaene: null, rezepte: null, alleRezepte: null, edit: null };
  el.classList.add('f5');
  el.innerHTML = '<div class="f5-karte"><h2>Arbeiten mit ' + esc(opt.name || 'dieser Person') + '</h2>' +
    '<div class="f5-k">' + (opt.muster ? 'Musterpraxis mit erfundenen Personen.' : 'Alles hier gilt nur, solange der Key läuft und die Einwilligung besteht.') + '</div>' +
    '<div class="f5-tabs"><button data-t="bericht" type="button">Bericht</button><button data-t="plaene" type="button">Pläne</button>' +
    '<button data-t="rezepte" type="button">Rezepte</button></div><div class="f5-panel" hidden></div></div>';
  if(opt.nurTab){ el.innerHTML = '<div class="f5-panel"></div>'; }
  const $p = el.querySelector('.f5-panel');
  el.querySelectorAll('.f5-tabs button').forEach(b => b.onclick = () => { st.tab = st.tab===b.dataset.t ? null : b.dataset.t; zeigeTab(); });
  function zeigeTab(){
    el.querySelectorAll('.f5-tabs button').forEach(b => b.classList.toggle('an', b.dataset.t===st.tab));
    $p.hidden = !st.tab;
    if(st.tab==='bericht') berichtPanel();
    else if(st.tab==='plaene'){ st.edit = null; plaenePanel(); }
    else if(st.tab==='rezepte') rezeptePanel();
  }
  const meld = (sel, t, art) => { const m = $p.querySelector(sel); if(m){ m.textContent = t || ''; m.className = 'f5-meld' + (art ? ' ' + art : ''); } };

  /* =================== Bericht =================== */
  function berichtPanel(){
    const lw = plus(montag(heute), -7);
    const lm = (() => { const d = D(heute); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()-1); return iso(d); })();
    const lmEnde = plus(heute.slice(0,8) + '01', -1);
    $p.innerHTML = '<div class="f5-reihe" data-zr><button class="f5-b" data-von="' + lw + '" data-bis="' + plus(lw, 6) + '" type="button">Letzte Woche</button>' +
      '<button class="f5-b" data-von="' + montag(heute) + '" data-bis="' + plus(heute, -1) + '" type="button">Diese Woche bis gestern</button>' +
      '<button class="f5-b" data-von="' + lm + '" data-bis="' + lmEnde + '" type="button">Letzter Monat</button>' +
      '<button class="f5-b" data-von="' + plus(heute, -28) + '" data-bis="' + plus(heute, -1) + '" type="button">Letzte 4 Wochen</button></div>' +
      '<div class="f5-reihe"><label>Von<input type="date" data-bv value="' + lw + '" max="' + plus(heute, -1) + '"></label>' +
      '<label>Bis<input type="date" data-bb value="' + plus(lw, 6) + '" max="' + plus(heute, -1) + '"></label>' +
      '<label>Kopfzeile<select data-bn><option value="k">Kürzel und Code</option><option value="n">Name und Code</option></select></label>' +
      '<label style="flex-direction:row;align-items:center;gap:6px;font-weight:400"><input type="checkbox" data-bp checked> Profilangaben</label>' +
      (opt.muster ? '' : '<label style="flex-direction:row;align-items:center;gap:6px;font-weight:400"><input type="checkbox" data-bm> Vitamine und Mineralstoffe</label>') + '</div>' +
      '<label style="font-size:13px;font-weight:800">Notiz</label>' +
      '<textarea data-bt maxlength="3000" placeholder="Leer lassen für handschriftliche Notizen"></textarea>' +
      '<div class="f5-reihe"><button class="f5-b gruen" data-blos type="button">Bericht anzeigen</button></div><div class="f5-meld" data-bmeld></div>' +
      '<div class="f5-k">Die Notiz wird nicht gespeichert. Ein Bericht umfasst höchstens 3 Monate.</div>';
    $p.querySelectorAll('[data-zr] button').forEach(b => b.onclick = () => { $p.querySelector('[data-bv]').value = b.dataset.von; $p.querySelector('[data-bb]').value = b.dataset.bis; });
    $p.querySelector('[data-blos]').onclick = async function(){
      const von = $p.querySelector('[data-bv]').value, bis = $p.querySelector('[data-bb]').value;
      if(!von || !bis || bis < von) return meld('[data-bmeld]', 'Zeitraum ungültig.', 'f');
      if(tageZw(von, bis) > 92) return meld('[data-bmeld]', 'Ein Bericht umfasst höchstens 3 Monate.', 'f');
      this.disabled = true; meld('[data-bmeld]', 'Bericht wird erstellt …');
      try{
        const [d, pl] = await Promise.all([opt.ladeDashboard(von, bis > heute ? heute : bis), ladePlaene().catch(() => [])]);
        zeigeBericht(d, pl, { von, bis, name: $p.querySelector('[data-bn]').value, profil: $p.querySelector('[data-bp]').checked,
                              mikro: !!($p.querySelector('[data-bm]') && $p.querySelector('[data-bm]').checked), notiz: $p.querySelector('[data-bt]').value.trim() });
        meld('[data-bmeld]', '');
      }catch(e){ meld('[data-bmeld]', 'Laden fehlgeschlagen: ' + (e.message || e), 'f'); }
      this.disabled = false;
    };
  }

  function zeigeBericht(d, plaene, o){
    const p = d.profil || {}, n = d.tage_erfasst || 0, tage = d.tage || [], s = d.summe || {};
    const wer = o.name === 'n' ? (p.name || '–') : kuerzel(p.name);
    const quellen = [];
    const qNr = (titel, url, stand) => { if(!titel && !url) return ''; const k = (titel||'') + '|' + (url||''); let i = quellen.findIndex(q => q.k===k);
      if(i < 0){ quellen.push({k, titel, url, stand}); i = quellen.length - 1; } return ' [' + (i+1) + ']'; };
    const is = (d.ist_soll || []).filter(x => o.mikro || !String(x.kennzahl).startsWith('mikro:'));
    const zeileIs = x => {
      const name = (KZ[x.kennzahl] || x.name || x.kennzahl) + (x.einheit==='en%' ? ' (Anteil Energie)' : '');
      const einh = x.einheit==='en%' ? '%' : (x.einheit||'');
      const soll = x.soll==null ? '–' : (x.art==='bereich' ? z(x.soll,1) + '–' + z(x.soll_bis,1) : (ART[x.art]||'') + ' ' + z(x.soll, 1)) + ' ' + einh + (x.bezug==='woche' ? '/Woche' : '');
      const grund = x.soll_herkunft==='Vorgabe Therapeutin' ? 'Praxis' + (x.quelle ? ' (' + esc(x.quelle) + ')' : '')
                  : x.soll_herkunft==='Ziel im Profil' ? 'App'
                  : esc(x.soll_herkunft || '') + qNr(x.quelle, x.quelle_url, x.quelle_stand);
      return '<tr><td>' + esc(name) + '</td><td class="z">' + (x.ist==null ? '–' : z(x.ist, 1) + ' ' + esc(einh) + (x.bezug==='woche' ? '/Woche' : '')) + '</td><td class="z">' + esc(soll) + '</td>' +
        '<td class="z">' + (x.soll ? z(x.ist_prozent_vom_soll) + ' %' : '') + '</td>' +
        '<td>' + (x.erfuellt==null ? '<span class="kl">–</span>' : x.erfuellt ? '<span class="ok">ja</span>' : '<span class="nein">nein</span>') + '</td><td class="kl">' + grund + (x.hinweis && x.soll_herkunft==='Vorgabe Therapeutin' ? '. ' + esc(x.hinweis) : '') + '</td></tr>';
    };
    const makro = ['kcal','protein','kh','fett','ges_fett','zucker','ballaststoffe','salz'];
    const isM = is.filter(x => makro.includes(x.kennzahl)).sort((a, b) => makro.indexOf(a.kennzahl) - makro.indexOf(b.kennzahl) || (a.einheit==='en%') - (b.einheit==='en%'));
    const isG = is.filter(x => String(x.kennzahl).startsWith('gruppe:'));
    const isMi = is.filter(x => String(x.kennzahl).startsWith('mikro:'));
    const tabIs = rows => rows.length ? '<table><thead><tr><th>Kennzahl</th><th class="z">Ist Ø</th><th class="z">Soll</th><th class="z">Anteil</th><th>Erfüllt</th><th>Grundlage</th></tr></thead><tbody>' + rows.map(zeileIs).join('') + '</tbody></table>' : '<p class="kl">Keine Werte.</p>';
    // Gemüse und Obst je Tag
    let maxG = 1; tage.forEach(t => { const g = (Number(t.gemuese_g)||0) + (Number(t.obst_g)||0); if(g > maxG) maxG = g; });
    const go = isG.find(x => x.kennzahl==='gruppe:gemuese+obst'); const linie = go && go.soll ? Number(go.soll) : null; if(linie && linie > maxG) maxG = linie;
    const bw = Math.max(4, Math.min(60, Math.floor(740 / Math.max(1, tage.length)) - 2)), H = 120, W = tage.length * (bw + 2) + 4;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 16) + '" width="' + W + '" height="' + (H + 16) + '" style="max-width:100%;height:auto" role="img" aria-label="Gemüse und Obst je Tag">';
    tage.forEach((t, i) => { const x = 2 + i * (bw + 2); const g = (Number(t.gemuese_g)||0) * H / maxG, o2 = (Number(t.obst_g)||0) * H / maxG;
      if(t.leer) svg += '<rect x="' + x + '" y="' + (H - 3) + '" width="' + bw + '" height="3" fill="#ddd"/>';
      else svg += '<rect x="' + x + '" y="' + (H - g) + '" width="' + bw + '" height="' + g + '" fill="var(--f5b-akzent)"/><rect x="' + x + '" y="' + (H - g - o2) + '" width="' + bw + '" height="' + o2 + '" fill="#9a9a9a"/>';
      if(tage.length <= 31 && (tage.length <= 14 || i % 3 === 0)) svg += '<text x="' + (x + bw/2) + '" y="' + (H + 12) + '" font-size="9" text-anchor="middle" fill="#5d6b61">' + D(t.datum).getUTCDate() + '.</text>'; });
    if(linie) svg += '<line x1="0" x2="' + W + '" y1="' + (H - linie * H / maxG) + '" y2="' + (H - linie * H / maxG) + '" stroke="#111" stroke-dasharray="4 3" stroke-width="1.5"/>';
    svg += '</svg>';
    const gj = g => { const r = (d.gruppen||[]).find(x => x.gruppe===g); return r ? r.gramm_je_tag : null; };
    const tagTab = tage.length <= 31 ? '<table style="margin-top:6px"><thead><tr><th>Tag</th><th class="z">Gemüse</th><th class="z">Obst</th><th class="z">zusammen</th><th class="z">kcal</th><th class="z">Eiweiß</th><th class="z">KH</th><th class="z">Fett</th></tr></thead><tbody>' +
      tage.map(t => t.leer ? '<tr><td>' + tk(t.datum) + '</td><td colspan="7" class="kl">nichts eingetragen</td></tr>'
        : '<tr><td>' + tk(t.datum) + '</td><td class="z">' + z(t.gemuese_g) + ' g</td><td class="z">' + z(t.obst_g) + ' g</td><td class="z">' + z((Number(t.gemuese_g)||0) + (Number(t.obst_g)||0)) + ' g</td>' +
          '<td class="z">' + z(t.kcal) + '</td><td class="z">' + z(t.protein, 1) + ' g</td><td class="z">' + z(t.kh, 1) + ' g</td><td class="z">' + z(t.fett, 1) + ' g</td></tr>').join('') + '</tbody></table>' : '';
    // Makros Ø je erfasstem Tag (Summe ÷ erfasste Tage, Summen vom Server)
    const je = k => n && s[k]!=null ? Number(s[k]) / n : null;
    const makTab = '<table><tbody>' + [['Energie', je('kcal'), 'kcal', 0], ['Eiweiß', je('protein'), 'g', 1], ['Kohlenhydrate', je('kh'), 'g', 1], ['davon Zucker', je('zucker'), 'g', 1],
      ['Fett', je('fett'), 'g', 1], ['Ballaststoffe', je('ballaststoffe'), 'g', 1], ['Salz', je('salz'), 'g', 2]].map(r => '<tr><td>' + r[0] + '</td><td class="z">' + z(r[1], r[3]) + ' ' + r[2] + '</td></tr>').join('') +
      '<tr><td>Root-Index-Score Ø (nach Menge)</td><td class="z">' + z(s.score) + '</td></tr></tbody></table>';
    // Auffällige Produkte: Bewertung Schwach oder Mittel, nach Menge
    const prod = (d.produkte || []);
    const auff = prod.filter(x => x.bewertung==='Schwach' || x.bewertung==='Mittel').sort((a, b) => (b.gramm||0) - (a.gramm||0)).slice(0, 12);
    const top = prod.slice().sort((a, b) => (b.gramm||0) - (a.gramm||0)).slice(0, 8);
    const prodTab = rows => '<table><thead><tr><th>Produkt</th><th class="z">Menge</th><th class="z">Tage</th><th class="z">Score</th></tr></thead><tbody>' +
      rows.map(x => '<tr><td>' + esc(x.name) + (x.marke && x.marke!=='Generisch' ? ' <span class="kl">' + esc(x.marke) + '</span>' : '') + '</td><td class="z">' + z(x.gramm) + ' g</td><td class="z">' + z(x.tage) + '</td>' +
        '<td class="z">' + (x.score==null ? '–' : '<span class="sc" style="background:' + bewFarbe(x.bewertung, x.score) + '">' + Math.round(x.score) + '</span> <span class="kl">' + esc(x.bewertung||'') + '</span>') + '</td></tr>').join('') + '</tbody></table>';
    // Ist gegen Plan: Pläne, die den Zeitraum berühren
    const pl = (plaene || []).filter(x => x.von <= o.bis && x.bis >= o.von && x.ist);
    const planTxt = pl.length ? '<table><tbody>' + pl.map(x => '<tr><td><b>' + esc(x.titel) + '</b> <span class="kl">' + dt(x.von) + ' – ' + dt(x.bis) + '</span></td><td>' +
        z(x.ist.wie_geplant) + ' von ' + z(x.ist.eintraege_vorbei) + ' Mahlzeiten wie geplant, ' + z(x.ist.anders) + ' anders, ' + z(x.ist.nichts_eingetragen) + ' ohne Eintrag.</td></tr>').join('') +
        '</tbody></table><div class="kl">Stand gestern. Wie geplant heißt: gleiche Mahlzeit, gleiches Rezept oder Produkt.</div>' : '';
    const prof = [p.alter && p.alter + ' Jahre', p.geschlecht, p.groesse_cm && z(p.groesse_cm) + ' cm', p.gewicht_kg && z(p.gewicht_kg, 1) + ' kg', p.ernaehrungsform,
                  (p.unvertraeglichkeiten||[]).length && 'ohne ' + p.unvertraeglichkeiten.join(', '), p.diabetes_typ && 'Diabetes ' + String(p.diabetes_typ).replace('typ', 'Typ ')].filter(Boolean);

    let h = '<div class="f5-leiste"><button class="f5-b" data-bzu type="button">Schließen</button><button class="f5-b gruen" data-bdruck type="button">Drucken oder PDF</button></div><div class="f5-blatt">' +
      '<div class="bk"><div><div class="p">' + esc(opt.praxis || '') + '</div><div class="kl">' + esc(opt.fachperson || '') + '</div></div>' +
      '<div class="r"><h1>Ernährungsbericht</h1><div><b>' + dt(o.von) + ' – ' + dt(o.bis) + '</b></div><div>Person: <b>' + esc(wer) + '</b>, Code ' + esc(d.code || opt.code || '') + '</div>' +
      '<div class="kl">Erstellt am ' + dt(heute) + '. Einträge an ' + n + ' von ' + tage.length + ' Tagen.' + (d.muster ? ' Erfundene Person aus der Musterpraxis.' : '') + '</div></div></div>';
    if(d.leer) h += '<p>' + esc(d.grund || 'Keine freigegebenen Einträge in diesem Zeitraum.') + '</p>';
    if(o.profil && prof.length) h += '<div class="kl" style="font-size:13px">' + esc(prof.join(', ')) + '</div>';
    if(!d.leer){
      h += '<h2>Kennzahlen</h2><div class="kl">Ist ist der Schnitt der Tage mit Einträgen. Soll kommt von der Praxis, sonst aus der App, sonst von der DGE.</div>' + tabIs(isM);
      h += '<h2>Lebensmittelgruppen</h2><div class="kl">Fisch und Fleisch zählen je Woche, alles andere je Tag.</div><div class="zw"><div>' + tabIs(isG) + '</div><div><table><tbody><tr><td>Gemüse je Tag mit Einträgen</td><td class="z">' + z(gj('gemuese')) + ' g</td></tr>' +
           '<tr><td>Obst je Tag mit Einträgen</td><td class="z">' + z(gj('obst')) + ' g</td></tr></tbody></table></div></div>' +
           '<div style="margin-top:8px">' + svg + '</div><div class="kl"><span style="color:var(--f5b-akzent)">■</span> Gemüse und Pilze&nbsp;&nbsp; <span style="color:#9a9a9a">■</span> Obst' + (linie ? '&nbsp;&nbsp; - - Soll für beides: ' + z(linie) + ' g.' : '') + ' Grau heißt kein Eintrag.</div>' + tagTab;
      h += '<h2>Makronährstoffe</h2><div class="zw"><div>' + makTab + '</div><div class="kl">Schnitt der Tage mit Einträgen.</div></div>';
      h += '<h2>Auffällige Produkte</h2><div class="kl">Bewertung Mittel oder Schwach, nach Menge sortiert.</div>' +
           (auff.length ? prodTab(auff) : '<p class="kl">Keine.</p>') +
           (top.length ? '<h2>Am meisten gegessen</h2>' + prodTab(top) : '');
      if(isMi.length) h += '<h2>Vitamine und Mineralstoffe</h2>' + tabIs(isMi);
      if(planTxt) h += '<h2>Ist gegen Plan</h2>' + planTxt;
    }
    h += '<h2>Notiz</h2><div class="notiz' + (o.notiz ? '' : ' linien') + '">' + esc(o.notiz) + '</div>';
    h += '<h2>Quellen und Hinweise</h2><div class="kl">' +
      quellen.map((q, i) => '[' + (i+1) + '] ' + esc(q.titel || '') + (q.stand ? ', Stand ' + esc(q.stand) : '') + (q.url ? ' – ' + esc(q.url) : '')).join('<br>') + (quellen.length ? '<br>' : '') +
      'DGE-Werte sind Orientierungswerte für gesunde Erwachsene. Laut DGE eignen sie sich nicht, den Verzehr einzelner Personen zu bewerten. Sie stehen hier zum Vergleich, nicht als Note.<br>' +
      'Grundlage ist das Ernährungstagebuch der Person. Nährwerte und Scores aus dem Root Index, Stand ' + dt(heute) + '. Erstellt mit Root Index Pro (root-index.de).</div></div>';

    let box = document.getElementById('fl5Bericht');
    if(!box){ box = document.createElement('div'); box.id = 'fl5Bericht'; document.body.appendChild(box); }
    box.innerHTML = h; box.hidden = false; box.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    const zu = () => { box.remove(); document.body.style.overflow = ''; document.body.classList.remove('fl5-druck'); };
    box.querySelector('[data-bzu]').onclick = zu;
    box.querySelector('[data-bdruck]').onclick = () => {
      document.body.classList.add('fl5-druck');
      const alt = document.title; document.title = 'Ernaehrungsbericht ' + (wer||'').replace(/[^A-Za-z0-9ÄÖÜäöüß .-]/g, '') + ' ' + o.von + ' bis ' + o.bis;
      setTimeout(() => { window.print(); document.title = alt; document.body.classList.remove('fl5-druck'); }, 80);
    };
  }

  /* =================== Pläne =================== */
  async function ladePlaene(){
    const r = opt.muster ? await opt.rpc('cb_fl5_muster_plaene', {p_token: opt.token || null, p_nr: opt.nr}) : await opt.rpc('cb_fp_plaene', {p_code: opt.code});
    st.plaene = (r && r.plaene) || [];
    if(opt.muster){ const d = demoLaden(); st.plaene = ((d.plaene || {})[opt.nr] || []).map(x => Object.assign({}, x, {lokal: true})).concat(st.plaene); }
    return st.plaene;
  }
  async function plaenePanel(){
    if(st.edit) return editor();
    $p.innerHTML = '<div class="f5-k">Lädt …</div>';
    try{ await ladePlaene(); }catch(e){ $p.innerHTML = '<div class="f5-meld f">Laden fehlgeschlagen: ' + esc(e.message || e) + '</div>'; return; }
    let h = opt.muster ? '' : '<div class="f5-k">Die Person sieht einen Plan erst, wenn er geteilt ist.</div>';
    h += '<div class="f5-reihe"><button class="f5-b gruen" data-pneu type="button">' + (opt.muster ? 'Vorschlag für nächste Woche' : 'Plan anlegen') + '</button>' +
         (opt.muster ? '<span class="f5-k">Vorführung. Änderungen bleiben in diesem Browser-Tab.</span>' : '') + '</div>';
    h += st.plaene.length ? st.plaene.map(planKarte).join('') : '<p class="f5-k">Noch kein Plan. Plan anlegen.</p>';
    h += '<div class="f5-legende"><span><i style="background:var(--f5-ok-zart)"></i>wie geplant</span><span><i style="background:var(--f5-warn-zart)"></i>anders gegessen</span><span><i style="background:var(--f5-bad-zart)"></i>kein Eintrag</span><span><i style="background:var(--f5-creme)"></i>offen</span></div>';
    $p.innerHTML = h;
    const neu = $p.querySelector('[data-pneu]'); if(neu) neu.onclick = () => { const v = plus(montag(heute), 7);
      st.edit = {titel: opt.muster ? 'Vorschlag für ' + (opt.name || '') : '', notiz:'', von:v, bis:plus(v, 6), eintraege:[], demo: !!opt.muster};
      editor(); if(opt.muster) vorschlagen('leer'); };
    $p.querySelectorAll('[data-pakt]').forEach(b => b.onclick = () => planAktion(b.dataset.pakt, b.dataset.id, b));
  }
  function planKarte(x){
    const e = x.eintraege || [], tage = [];
    for(let t = x.von; t <= x.bis; t = plus(t, 1)) tage.push(t);
    const kT = {}; (x.tage || []).forEach(t => kT[t.datum] = t);
    const chips = (x.geteilt ? '<span class="f5-chip gruen">geteilt</span>' : '<span class="f5-chip grau">Entwurf</span>') +
      (x.uebernommen_am ? '<span class="f5-chip blau">übernommen am ' + new Date(x.uebernommen_am).toLocaleDateString('de-DE') + '</span>' : (x.geteilt && !opt.muster ? '<span class="f5-chip grau">nicht übernommen</span>' : ''));
    const ist = x.ist && x.ist.eintraege_vorbei ? '<div style="margin-top:6px;font-size:14px"><b>Bis gestern:</b> ' + z(x.ist.wie_geplant) + ' von ' + z(x.ist.eintraege_vorbei) +
      ' Mahlzeiten wie geplant, ' + z(x.ist.anders) + ' anders, ' + z(x.ist.nichts_eingetragen) + ' ohne Eintrag.</div>' : '';
    let h = '<div class="f5-plan"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b style="font-size:16px">' + esc(x.titel) + '</b>' +
      '<div class="f5-k">' + dt(x.von) + ' bis ' + dt(x.bis) + ', ' + e.length + ' Einträge</div></div><div>' + chips + '</div></div>' +
      (x.notiz ? '<div style="font-size:14px;margin-top:4px">' + esc(x.notiz) + '</div>' : '') + ist +
      (x.ziel_kcal ? '<div class="f5-k" style="margin-top:4px">Kalorienziel ' + z(x.ziel_kcal) + ' kcal je Tag (' + esc(herk(x.ziel_herkunft)) + ')</div>' : '') +
      '<div class="f5-tab-wrap"><table class="f5-raster" style="min-width:' + (140 + 120 * plaetzeFuer(e).length) + 'px"><thead><tr><th>Tag</th>' + plaetzeFuer(e).map(p => '<th>' + p.l + '</th>').join('') + '<th class="z">kcal Plan</th>' + (x.tage ? '<th class="z">kcal Ist</th>' : '') + '</tr></thead><tbody>' +
      tage.map(t => { const et = e.filter(y => y.datum===t); const kp = et.reduce((a, y) => a + (Number(y.kcal_plan)||0), 0);
        return '<tr' + (t===heute ? ' style="outline:2px solid var(--f5-gruen)"' : '') + '><td><b>' + tk(t) + '</b></td>' + plaetzeFuer(e).map(pz => '<td>' + et.filter(y => platzVon(y)===pz.k).map(y =>
          '<div class="f5-e ' + esc(y.status) + '" title="' + esc(STATUS[y.status] || '') + (y.gegessen ? ': ' + esc(y.gegessen.join(', ')) : '') + '">' + esc(y.titel || '') +
          '<small>' + [y.portionen && Number(y.portionen)!==1 ? z(y.portionen, 1) + ' Portionen' : '', y.menge_g ? z(y.menge_g) + ' g' : '', y.kcal_plan ? z(y.kcal_plan) + ' kcal' : ''].filter(Boolean).join(', ') + '</small>' +
          (y.status==='anders' && y.gegessen ? '<small>gegessen: ' + esc(y.gegessen.join(', ')) + '</small>' : '') + (y.hinweis ? '<small>' + esc(y.hinweis) + '</small>' : '') + '</div>').join('') + '</td>').join('') +
          '<td class="z">' + (kp ? z(kp) + (x.ziel_kcal ? '<small style="display:block;color:var(--f5-muted)">' + z(Math.round(100 * kp / x.ziel_kcal)) + ' % vom Ziel</small>' : '') : '–') + '</td>' + (x.tage ? '<td class="z">' + (kT[t] && kT[t].kcal_ist!=null ? z(kT[t].kcal_ist) : (t < heute ? '–' : '')) + '</td>' : '') + '</tr>'; }).join('') +
      '</tbody></table></div>';
    if(!opt.muster || x.lokal) h += (x.lokal ? '<div class="f5-k" style="margin-top:6px">Nur in diesem Browser-Tab gespeichert.</div>' : '') + '<div class="f5-reihe"><button class="f5-b" data-pakt="bearbeiten" data-id="' + x.id + '" type="button">Bearbeiten</button>' +
      '<button class="f5-b' + (x.geteilt ? '' : ' gruen') + '" data-pakt="' + (x.geteilt ? 'zurueck' : 'teilen') + '" data-id="' + x.id + '" type="button">' + (x.geteilt ? 'Teilen beenden' : 'Mit ' + esc(opt.name || 'Klient') + ' teilen') + '</button>' +
      '<button class="f5-b" data-pakt="vorlage" data-id="' + x.id + '" type="button">Als Vorlage nutzen</button>' +
      '<button class="f5-b rot" data-pakt="loeschen" data-id="' + x.id + '" type="button">Löschen</button></div><div class="f5-meld" data-pm="' + x.id + '"></div>';
    return h + '</div>';
  }
  async function planAktion(akt, id, b){
    const x = st.plaene.find(y => String(y.id)===String(id)); if(!x) return;
    if(x.lokal && akt!=='bearbeiten' && akt!=='vorlage'){                       // Vorführung: nur lokal
      const d = demoLaden(); d.plaene = d.plaene || {}; const l = d.plaene[opt.nr] || [];
      if(akt==='loeschen'){ if(!confirm('Plan „' + x.titel + '“ löschen?')) return; d.plaene[opt.nr] = l.filter(y => y.id!==x.id); }
      else l.forEach(y => { if(y.id===x.id) y.geteilt = akt==='teilen'; });
      demoSchreiben(d); return plaenePanel();
    }
    const m = t => { const el2 = $p.querySelector('[data-pm="' + id + '"]'); if(el2){ el2.textContent = t; el2.className = 'f5-meld f'; } };
    if(akt==='bearbeiten'){ st.edit = {id:x.id, demo: !!x.lokal, titel:x.titel, notiz:x.notiz||'', von:x.von, bis:x.bis, eintraege:x.eintraege.map(kopEintrag), ziel:x.ziel_kcal, ziel_her:x.ziel_herkunft}; return editor(); }
    if(akt==='vorlage'){ const n = tageZw(x.von, x.bis) + 1, v = plus(x.bis, 1) > heute ? plus(x.bis, 1) : montag(plus(heute, 7)), dv = tageZw(x.von, v);
      st.edit = {titel:x.titel, notiz:x.notiz||'', von:v, bis:plus(v, n-1), eintraege:x.eintraege.map(y => Object.assign(kopEintrag(y), {datum:plus(y.datum, dv)}))}; return editor(); }
    if(akt==='loeschen' && !confirm('Plan „' + x.titel + '“ löschen? Bereits Übernommenes bleibt im Wochenplan der Person.')) return;
    b.disabled = true;
    try{
      const r = akt==='loeschen' ? await opt.rpc('cb_fp_plan_loeschen', {p_plan:id}) : await opt.rpc('cb_fp_plan_teilen', {p_plan:id, p_an: akt==='teilen'});
      if(r && r.ok===false){ b.disabled = false; return m(r.grund || 'Fehlgeschlagen.'); }
      plaenePanel();
    }catch(e){ b.disabled = false; m(e.message || e); }
  }
  const kopEintrag = y => ({datum:y.datum, slot:y.slot, snack_zeit:y.slot==='Snack' ? (y.snack_zeit || null) : null, typ:y.typ, rezept_id:y.rezept_id, produkt_id:y.produkt_id, portionen:y.portionen, menge_g:y.menge_g,
                            titel: y.titel, hinweis:y.hinweis, kcal_plan:y.kcal_plan});

  /* ---------- Plan-Editor (mit Vorschlag, Tauschen, Festhalten) ---------- */
  const eintragZeile = (y, i, mitKnoepfen) => '<div class="f5-e"' + (y.fest ? ' style="outline:2px solid var(--f5-gruen)"' : '') + '>' + esc(y.titel || '') +
    (mitKnoepfen ? '<span style="float:right;white-space:nowrap"><button data-fest="' + i + '" type="button" title="' + (y.fest ? 'Nicht mehr festhalten' : 'Festhalten') + '" style="color:var(--f5-gruen)">' + (y.fest ? '📌' : '📍') + '</button>' +
      '<button data-tausch="' + i + '" type="button" title="Tauschen" style="color:var(--f5-gruen)">↻</button><button data-weg="' + i + '" type="button" aria-label="entfernen">✕</button></span>' : '') +
    '<small>' + [y.portionen && Number(y.portionen)!==1 ? z(y.portionen, 1) + ' Portionen' : '', y.menge_g ? z(y.menge_g) + ' g' : '', y.kcal_plan ? z(y.kcal_plan) + ' kcal' : ''].filter(Boolean).join(', ') + '</small>' +
    (y.grund ? '<small>' + esc(y.grund) + '</small>' : '') + (y.hinweis ? '<small>' + esc(y.hinweis) + '</small>' : '') + '</div>';
  function editor(){
    const E = st.edit; const tage = []; for(let t = E.von; t <= E.bis && tage.length < 42; t = plus(t, 1)) tage.push(t);
    const pl = plaetzeFuer(E.eintraege, E.spaet);
    let h = '<h3>' + (E.demo ? 'Vorschlag für ' + esc(opt.name || '') : E.id ? 'Plan für ' + esc(opt.name || '') + ' bearbeiten' : 'Neuer Plan für ' + esc(opt.name || '')) + '</h3>' +
      '<div class="f5-reihe"><label style="flex:2;min-width:200px">Titel<input data-et maxlength="80" value="' + esc(E.titel) + '" placeholder="z. B. Woche 1: mehr Gemüse"></label>' +
      '<label>Von<input type="date" data-ev value="' + E.von + '"></label><label>Bis<input type="date" data-eb value="' + E.bis + '"></label></div>' +
      '<div class="f5-reihe"><button class="f5-b" data-zr="tag" type="button">1 Tag</button><button class="f5-b" data-zr="woche" type="button">1 Woche</button><button class="f5-b" data-zr="monat" type="button">4 Wochen</button>' +
      '<label style="flex-direction:row;align-items:center;gap:6px;font-weight:400"><input type="checkbox" data-spaet' + (E.spaet || pl.some(p => p.k==='Snack:spaet') ? ' checked' : '') + '> Spätsnack</label></div>' +
      '<label style="font-size:13px;font-weight:800">Hinweis für die Person</label><textarea data-en maxlength="1000" style="min-height:54px">' + esc(E.notiz) + '</textarea>' +
      '<div class="f5-karte" style="border-width:1px;margin:10px 0;padding:10px 12px"><b>Vorschlag</b>' +
      '<div class="f5-k">Aus Rezepten und gut bewerteten Produkten, die die Person gern isst. Allergene, Laktose, Ernährungsform, Diabetes und Kalorienziel sind berücksichtigt. <b>Bitte fachlich prüfen.</b></div>' +
      '<label class="f5-reihe" style="gap:6px;align-items:center;font-size:14px;font-weight:400;margin:4px 0"><input type="checkbox" data-nurrez' + (E.nurRezepte ? ' checked' : '') + '> Nur Rezepte, keine Markenprodukte</label>' +
      (E.beachtet && E.beachtet.length ? '<div style="margin-top:6px">' + E.beachtet.map(b => '<span class="f5-chip blau">' + esc(b) + '</span>').join('') + '</div>' : '') +
      (E.hinweise && E.hinweise.length ? '<div class="f5-k" style="margin-top:4px">' + E.hinweise.map(esc).join(' ') + '</div>' : '') +
      '<div class="f5-reihe"><button class="f5-b gruen" data-vor="leer" type="button">Leere Plätze füllen</button><button class="f5-b" data-vor="neu" type="button" title="Festgehaltene bleiben">Neu vorschlagen</button>' +
      (opt.ki && !E.demo ? '<button class="f5-b" data-riki type="button">Rezeptideen von Riki</button>' : '') + '</div><div class="f5-meld" data-vm></div><div data-rikibox></div></div>' +
      (E.ziel ? '<div class="f5-k">Kalorienziel ' + z(E.ziel) + ' kcal je Tag' + (E.ziel_her ? ' (' + esc(herk(E.ziel_her)) + ')' : '') + '</div>' : '') +
      '<div class="f5-tab-wrap"><table class="f5-raster" style="min-width:' + (140 + 130 * pl.length) + 'px"><thead><tr><th>Tag</th>' + pl.map(p => '<th>' + p.l + '</th>').join('') + '<th class="z">kcal</th></tr></thead><tbody>' +
      tage.map((t, ti) => { const et = E.eintraege.filter(y => y.datum===t); const kp = et.reduce((a, y) => a + (Number(y.kcal_plan)||0), 0);
        return '<tr><td><b>' + tk(t) + '</b>' + (ti ? '<div><button class="f5-plus" data-vortag="' + t + '" type="button" title="Alles vom Vortag übernehmen">wie Vortag</button></div>' : '') + '</td>' +
        pl.map(pz => '<td>' + et.filter(y => platzVon(y)===pz.k).map(y => eintragZeile(y, E.eintraege.indexOf(y), true)).join('') +
          '<button class="f5-plus" data-plus="' + t + '|' + pz.k + '" type="button">＋</button></td>').join('') +
        '<td class="z">' + (kp ? z(kp) + (E.ziel ? '<small style="display:block;color:var(--f5-muted)">' + z(Math.round(100 * kp / E.ziel)) + ' %</small>' : '') : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><div data-wahl></div>' +
      (E.demo ? '<div class="f5-hinweis">Vorführung. Gespeichert wird nur in diesem Browser-Tab.</div>' +
         '<div class="f5-reihe"><button class="f5-b gruen" data-demosp="1" type="button">Speichern und teilen</button><button class="f5-b" data-demosp="0" type="button">Als Entwurf speichern</button><button class="f5-b" data-eab type="button">Schließen</button></div>'
       : '<div class="f5-reihe"><button class="f5-b gruen" data-es="teilen" type="button">Speichern und teilen</button><button class="f5-b" data-es="entwurf" type="button">Als Entwurf speichern</button>' +
         '<button class="f5-b" data-eab type="button">Abbrechen</button></div>') + '<div class="f5-meld" data-em></div>' +
      '<div class="f5-k">Portionen richten sich nach dem Kalorienziel: Frühstück 25 %, Mittag 30 %, Abendessen 25 %, Snacks 20 %.</div>';
    $p.innerHTML = h;
    const lies = () => { E.titel = $p.querySelector('[data-et]').value; E.notiz = $p.querySelector('[data-en]').value; };
    const setzeZeit = (v, b) => {
      if(!v || !b || b < v) return meld('[data-em]', 'Das Ende liegt vor dem Anfang.', 'f'); if(tageZw(v, b) > 41) return meld('[data-em]', 'Höchstens 6 Wochen.', 'f');
      const raus = E.eintraege.filter(y => y.datum < v || y.datum > b).length;
      if(raus && !confirm(raus + ' Einträge fallen heraus. Weiter?')){ $p.querySelector('[data-ev]').value = E.von; $p.querySelector('[data-eb]').value = E.bis; return; }
      E.von = v; E.bis = b; E.eintraege = E.eintraege.filter(y => y.datum >= v && y.datum <= b); editor(); };
    const zeit = () => { lies(); setzeZeit($p.querySelector('[data-ev]').value, $p.querySelector('[data-eb]').value); };
    $p.querySelector('[data-ev]').onchange = zeit; $p.querySelector('[data-eb]').onchange = zeit;
    $p.querySelectorAll('[data-zr]').forEach(b => b.onclick = () => { lies(); setzeZeit(E.von, plus(E.von, {tag:0, woche:6, monat:27}[b.dataset.zr])); });
    $p.querySelector('[data-spaet]').onchange = ev => { lies(); E.spaet = ev.target.checked; if(!E.spaet) E.eintraege = E.eintraege.filter(y => platzVon(y)!=='Snack:spaet'); editor(); };
    $p.querySelectorAll('[data-weg]').forEach(b => b.onclick = () => { lies(); E.eintraege.splice(Number(b.dataset.weg), 1); editor(); });
    $p.querySelectorAll('[data-fest]').forEach(b => b.onclick = () => { lies(); const y = E.eintraege[Number(b.dataset.fest)]; y.fest = !y.fest; editor(); });
    $p.querySelectorAll('[data-tausch]').forEach(b => b.onclick = () => { lies(); const y = E.eintraege[Number(b.dataset.tausch)]; vorschlagen('tausch', y); });
    $p.querySelectorAll('[data-vor]').forEach(b => b.onclick = () => { lies(); vorschlagen(b.dataset.vor); });
    const rk = $p.querySelector('[data-riki]'); if(rk) rk.onclick = () => { lies(); rikiForm(); };
    const nr = $p.querySelector('[data-nurrez]'); if(nr) nr.onchange = () => { E.nurRezepte = nr.checked; };
    $p.querySelectorAll('[data-vortag]').forEach(b => b.onclick = () => { lies(); const t = b.dataset.vortag, v = plus(t, -1);
      E.eintraege = E.eintraege.filter(y => y.datum!==t).concat(E.eintraege.filter(y => y.datum===v).map(y => Object.assign({}, y, {datum:t, fest:false}))); editor(); });
    $p.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => { lies(); const [t, k] = b.dataset.plus.split('|'); wahl(t, k); });
    $p.querySelector('[data-eab]').onclick = () => { st.edit = null; plaenePanel(); };
    $p.querySelectorAll('[data-demosp]').forEach(b => b.onclick = () => {
      lies(); if(!E.titel.trim()) return meld('[data-em]', 'Titel fehlt.', 'f');
      const d = demoLaden(); d.plaene = d.plaene || {}; const l = (d.plaene[opt.nr] = d.plaene[opt.nr] || []);
      const id = (typeof E.id==='string' && E.id.startsWith('d')) ? E.id : 'd' + Date.now();
      const plan = {id, titel: E.titel, notiz: E.notiz, von: E.von, bis: E.bis, geteilt: b.dataset.demosp==='1', ziel_kcal: E.ziel || null, ziel_herkunft: E.ziel_her || null,
                    eintraege: E.eintraege.map(y => Object.assign(kopEintrag(y), {status: 'offen'}))};
      const i = l.findIndex(y => y.id===id); if(i >= 0) l[i] = plan; else l.unshift(plan);
      demoSchreiben(d); st.edit = null; plaenePanel();
    });
    $p.querySelectorAll('[data-es]').forEach(b => b.onclick = async () => {
      lies(); if(!E.titel.trim()) return meld('[data-em]', 'Titel fehlt.', 'f');
      $p.querySelectorAll('[data-es]').forEach(x => x.disabled = true); meld('[data-em]', 'Wird gespeichert …');
      try{
        const r = await opt.rpc('cb_fp_plan_speichern', {p_code: opt.code, p_plan: {id: E.id || null, titel: E.titel, notiz: E.notiz, von: E.von, bis: E.bis,
          eintraege: E.eintraege.map(y => ({datum:y.datum, slot:y.slot, snack_zeit: y.slot==='Snack' ? (y.snack_zeit || null) : null, typ:y.typ, rezept_id:y.rezept_id||null, produkt_id:y.produkt_id||null,
                                            portionen:y.portionen||null, menge_g:y.menge_g||null, titel: y.typ==='frei' ? y.titel : null, hinweis:y.hinweis||null}))}});
        if(!r || !r.ok) throw new Error((r && r.grund) || 'Speichern fehlgeschlagen.');
        if(b.dataset.es==='teilen'){ const r2 = await opt.rpc('cb_fp_plan_teilen', {p_plan: r.id, p_an: true}); if(r2 && r2.ok===false) throw new Error(r2.grund); }
        st.edit = null; plaenePanel();
      }catch(e){ $p.querySelectorAll('[data-es]').forEach(x => x.disabled = false); meld('[data-em]', e.message || String(e), 'f'); }
    });
  }
  /* Vorschlag vom Server (cb_fp_plan_vorschlag / cb_fl5_muster_plan_vorschlag) – speichert nichts.
     art: 'leer' = nur freie Plätze, 'neu' = alles außer 📌 neu, 'tausch' = genau dieser Eintrag */
  async function vorschlagen(art, eintrag){
    const E = st.edit; E.seed = (E.seed || 0) + 1;
    const pl = plaetzeFuer(E.eintraege, E.spaet);
    const ort = y => ({datum: y.datum, slot: y.slot, snack_zeit: y.slot==='Snack' ? (y.snack_zeit || 'nachmittags') : null});
    let o;
    if(art==='tausch') o = {plaetze: pl.map(p => p.k), seed: E.seed, nur: [ort(eintrag)], nur_rezepte: !!E.nurRezepte};
    else { if(art==='neu') E.eintraege = E.eintraege.filter(y => y.fest);
           o = {plaetze: pl.map(p => p.k), seed: E.seed, belegt: E.eintraege.map(ort), nur_rezepte: !!E.nurRezepte}; }
    meld('[data-vm]', 'Vorschläge werden gesucht …');
    try{
      const r = opt.muster ? await opt.rpc('cb_fl5_muster_plan_vorschlag', {p_token: opt.token || null, p_nr: opt.nr, p_von: E.von, p_bis: E.bis, p_optionen: o})
                           : await opt.rpc('cb_fp_plan_vorschlag', {p_code: opt.code, p_von: E.von, p_bis: E.bis, p_optionen: o});
      E.ziel = r.ziel_kcal || E.ziel; E.ziel_her = r.ziel_herkunft || E.ziel_her; E.beachtet = r.beachtet || []; E.hinweise = r.hinweise || [];
      const kd = r.kandidaten || {};
      ['Mittag','Abendessen','Frühstück','Snack'].forEach(sl => { if(kd[sl]!=null && kd[sl] < 4) E.hinweise.push('Für ' + sl + ' passen nur ' + kd[sl] + ' Gerichte. Deshalb wiederholen sie sich.' + (opt.ki && !E.demo ? ' Mehr Auswahl gibt es über Rezeptideen von Riki.' : '')); });
      const neu = (r.eintraege || []).map(y => Object.assign(kopEintrag(y), {grund: y.grund || null}));
      if(art==='tausch'){
        const i = E.eintraege.indexOf(eintrag);
        const anders = neu.filter(y => (y.rezept_id || y.produkt_id) !== (eintrag.rezept_id || eintrag.produkt_id));
        if(anders.length && i >= 0) E.eintraege.splice(i, 1, anders[0]);
        else if(!neu.length) E.hinweise = (E.hinweise || []).concat('Kein weiterer Vorschlag für diesen Platz.');
        else if(i >= 0) E.eintraege.splice(i, 1, neu[0]);
      } else E.eintraege = E.eintraege.concat(neu);
      editor();
      meld('[data-vm]', (art==='tausch' ? 'Getauscht.' : neu.length + ' Vorschläge eingetragen.'), 'ok');
    }catch(e){ meld('[data-vm]', 'Vorschlag fehlgeschlagen: ' + (e.message || e), 'f'); }
  }
  /* Riki-Rezeptideen (Edge-Funktion fl5-riki-rezeptideen): nur bestätigte Angaben, keine Namen/Kennungen */
  function rikiForm(){
    const E = st.edit, box = $p.querySelector('[data-rikibox]'); if(!box) return;
    const b = (E.beachtet || []).join(' | ');
    const ohneVor = ((b.match(/ohne ([^|]+)/) || [])[1] || '').split(',').map(x => x.trim()).filter(Boolean);
    const ef = /vegan/.test(b) ? 'vegan' : /vegetarisch/.test(b) ? 'vegetarisch' : '';
    const OHNE = ['milch','laktose','gluten','ei','soja','fisch','krebstiere','weichtiere','schalenfruechte','erdnuss','sellerie','senf','sesam','sulfite','lupinen'];
    const kcalVor = E.ziel ? Math.round(E.ziel * 0.3 / 10) * 10 : '';
    box.innerHTML = '<div class="f5-wahl"><b>Rezeptideen von Riki</b><div class="f5-k">An die KI gehen nur die Angaben unten. Keine Namen, keine Kennungen, kein Tagebuch. Ein Rezept wird erst mit „Speichern“ angelegt. Es bleibt privat und ist nur für die Praxis und die Personen sichtbar, mit denen es geteilt wird.</div>' +
      '<div class="f5-reihe"><label>Mahlzeit<select data-rm><option>Frühstück</option><option selected>Mittag</option><option>Abendessen</option><option>Snack</option></select></label>' +
      '<label>kcal je Portion<input type="number" data-rk min="50" max="2000" step="10" value="' + kcalVor + '" style="width:110px"></label>' +
      '<label>Ernährungsform<select data-ref><option value="">keine Vorgabe</option><option value="vegetarisch"' + (ef==='vegetarisch' ? ' selected' : '') + '>vegetarisch</option><option value="vegan"' + (ef==='vegan' ? ' selected' : '') + '>vegan</option></select></label>' +
      '<label style="flex-direction:row;align-items:center;gap:6px;font-weight:400"><input type="checkbox" data-rd' + (/Diabetes/.test(b) ? ' checked' : '') + '> zuckerarm (Diabetes)</label></div>' +
      '<div style="font-size:13px;font-weight:800">Ohne</div><div class="f5-reihe" style="gap:4px 10px">' + OHNE.map(o => '<label style="flex-direction:row;align-items:center;gap:4px;font-weight:400;font-size:14px"><input type="checkbox" data-ro value="' + o + '"' + (ohneVor.includes(o) ? ' checked' : '') + '> ' + o + '</label>').join('') + '</div>' +
      '<label style="font-size:13px;font-weight:800">Wünsche (ohne Namen)</label><input data-rw maxlength="300" style="width:100%" placeholder="z. B. schnell, mit Hülsenfrüchten, mag keinen Koriander">' +
      '<div class="f5-reihe"><button class="f5-b gruen" data-rlos type="button">Ideen holen</button><button class="f5-b" data-rzu type="button">Schließen</button></div><div class="f5-meld" data-rmeld></div><div data-rerg></div></div>';
    box.scrollIntoView({behavior:'smooth', block:'nearest'});
    const m = (t, a) => { const x = box.querySelector('[data-rmeld]'); x.textContent = t; x.className = 'f5-meld' + (a ? ' ' + a : ''); };
    box.querySelector('[data-rzu]').onclick = () => { box.innerHTML = ''; };
    box.querySelector('[data-rlos]').onclick = async function(){
      const body = { mahlzeit: box.querySelector('[data-rm]').value, kcal_portion: Number(box.querySelector('[data-rk]').value) || null,
        ernaehrungsform: box.querySelector('[data-ref]').value || null, diabetes: box.querySelector('[data-rd]').checked,
        ohne: Array.from(box.querySelectorAll('[data-ro]:checked')).map(x => x.value), wuensche: box.querySelector('[data-rw]').value.trim(), anzahl: 3 };
      this.disabled = true; m('Riki sucht Ideen. Das dauert etwa 15 Sekunden.');
      let r; try{ r = await opt.ki(body); }catch(e){ this.disabled = false; return m(e.message || String(e), 'f'); }
      this.disabled = false;
      if(!r || !r.ok) return m((r && r.grund) || 'Fehlgeschlagen.', 'f');
      m((r.hinweis || '') + (r.meta && r.meta.limit ? ' Heute ' + r.meta.heute + ' von ' + r.meta.limit + ' Anfragen.' : ''), 'ok');
      const erg = box.querySelector('[data-rerg]');
      erg.innerHTML = r.vorschlaege.map((v, i) => '<div class="f5-plan" style="margin-top:8px"><b>' + esc(v.name) + '</b> <span class="f5-k">' +
        [v.kcal_geschaetzt ? 'etwa ' + z(v.kcal_geschaetzt) + ' kcal je Portion' : '', v.zeit_min ? v.zeit_min + ' Minuten' : '', v.ernaehrungsform || ''].filter(Boolean).join(', ') + '</span>' +
        (v.kurz ? '<div style="font-size:14px">' + esc(v.kurz) + '</div>' : '') +
        '<div class="f5-k" style="margin-top:4px">' + (v.zutaten || []).map(zt => esc((zt.menge ? zt.menge + ' ' : '') + zt.name)).join(', ') + '</div>' +
        '<details><summary class="f5-k" style="cursor:pointer">Zubereitung</summary><div style="font-size:14px;white-space:pre-wrap">' + esc(v.zubereitung || '') + '</div></details>' +
        '<div class="f5-reihe"><button class="f5-b gruen" data-ruebern="' + i + '" type="button">Als Rezept speichern</button><span class="f5-meld" data-rum="' + i + '"></span></div></div>').join('');
      erg.querySelectorAll('[data-ruebern]').forEach(btn => btn.onclick = async () => {
        const v = r.vorschlaege[Number(btn.dataset.ruebern)], mm = erg.querySelector('[data-rum="' + btn.dataset.ruebern + '"]');
        btn.disabled = true; mm.textContent = 'Wird gespeichert …';
        try{
          const id = await opt.rpc('cb_rezept_anlegen', {p_payload: {name: String(v.name || 'Rezeptidee').slice(0, 120), portionen: v.portionen || 2,
            zeit: v.zeit_min || null, zubereitung: v.zubereitung || '', ernaehrungsform: v.ernaehrungsform || null,
            ziel: 'Idee von Riki (KI), von der Praxis geprüft', mahlzeiten: [r.mahlzeit],
            zutaten: (v.zutaten || []).map(zt => ({name: zt.name, menge: zt.menge || null, menge_g: zt.menge_g || null}))}});
          st.alleRezepte = null;
          mm.textContent = 'Gespeichert. Nährwerte und Score folgen, sobald die Zutaten zugeordnet sind.'; mm.className = 'f5-meld ok';
        }catch(e){ btn.disabled = false; mm.textContent = e.message || String(e); mm.className = 'f5-meld f'; }
      });
    };
  }
  async function alleRezepte(){
    if(st.alleRezepte) return st.alleRezepte;
    const r = await opt.rpc('cb_rezepte_list', {});
    st.alleRezepte = (Array.isArray(r) ? r : []).filter(x => !x.gesperrt);
    return st.alleRezepte;
  }
  function wahl(t, k){
    const E = st.edit, box = $p.querySelector('[data-wahl]');
    const pz = PLAETZE.find(p => p.k===k) || PLAETZE[0], sl = pz.slot;
    let art = 'rezept', gewaehlt = null, timer = null;
    box.innerHTML = '<div class="f5-wahl"><b>' + tk(t) + ', ' + esc(pz.l) + '</b><div class="f5-reihe">' +
      '<button class="f5-b an" data-wa="rezept" type="button">Rezept</button><button class="f5-b" data-wa="produkt" type="button">Produkt</button><button class="f5-b" data-wa="frei" type="button">Text</button></div>' +
      '<input data-ws style="width:100%" placeholder="Rezept suchen …"><div class="f5-treffer" data-wt></div>' +
      '<div class="f5-reihe"><label data-wml>Portionen<input type="number" data-wm min="0.5" max="20" step="0.5" value="1" style="width:100px"></label>' +
      '<label style="flex:1;min-width:180px">Hinweis (optional)<input data-wh maxlength="200" placeholder="z. B. mit extra Gemüse"></label></div>' +
      '<div class="f5-reihe"><button class="f5-b gruen" data-wok type="button">Hinzufügen</button><button class="f5-b" data-wzu type="button">Schließen</button></div><div class="f5-meld" data-wmeld></div></div>';
    box.scrollIntoView({behavior:'smooth', block:'nearest'});
    const $s = box.querySelector('[data-ws]'), $t = box.querySelector('[data-wt]');
    const setArt = a => { art = a; gewaehlt = null; box.querySelectorAll('[data-wa]').forEach(b => b.classList.toggle('an', b.dataset.wa===a));
      $s.value = ''; $s.placeholder = a==='rezept' ? 'Rezept suchen …' : a==='produkt' ? 'Produkt suchen (Name oder Marke) …' : 'Text, z. B. „1 Handvoll Nüsse“';
      $t.hidden = a==='frei'; box.querySelector('[data-wml]').hidden = a==='frei';
      box.querySelector('[data-wml]').firstChild.textContent = a==='produkt' ? 'Gramm' : 'Portionen';
      const m = box.querySelector('[data-wm]'); m.value = a==='produkt' ? 100 : 1; m.step = a==='produkt' ? 5 : 0.5; m.max = a==='produkt' ? 3000 : 20;
      such(); $s.focus(); };
    const such = async () => {
      if(art==='frei'){ $t.innerHTML = ''; return; }
      const q = $s.value.trim().toLowerCase();
      if(art==='rezept'){
        $t.innerHTML = '<div class="f5-k">Lädt …</div>';
        let l; try{ l = await alleRezepte(); }catch(e){ $t.innerHTML = '<div>' + esc(e.message) + '</div>'; return; }
        const tr = l.filter(x => !q || String(x.name||'').toLowerCase().includes(q)).sort((a, b) => (b.is_own - a.is_own) || String(a.name).localeCompare(String(b.name), 'de')).slice(0, 40);
        $t.innerHTML = tr.map(x => '<div data-id="' + esc(x.id) + '">' + esc(x.name) + ' <span class="f5-k">' + [x.kcal && z(x.kcal) + ' kcal je Portion', x.is_own ? (x.sichtbarkeit==='privat' ? 'eigenes Rezept, privat' : 'eigenes Rezept') : x.quelle==='CleanBase' ? 'Root Index' : ''].filter(Boolean).join(', ') + '</span></div>').join('') || '<div class="f5-k">Kein Treffer.</div>';
        $t.querySelectorAll('[data-id]').forEach(d2 => d2.onclick = () => { const x = l.find(y => y.id===d2.dataset.id); gewaehlt = {rezept_id:x.id, titel:x.name, kcal:x.kcal};
          $t.querySelectorAll('div').forEach(y => y.classList.toggle('an', y===d2)); });
      } else {
        if(q.length < 2){ $t.innerHTML = '<div class="f5-k">Mindestens 2 Buchstaben.</div>'; return; }
        clearTimeout(timer); timer = setTimeout(async () => {
          let l; try{ l = await opt.rpc('cb_rezept_produktliste', {p_suche: q}); }catch(e){ $t.innerHTML = '<div>' + esc(e.message) + '</div>'; return; }
          l = (Array.isArray(l) ? l : []).slice(0, 40);
          $t.innerHTML = l.map(x => '<div data-id="' + esc(x.produkt_id) + '">' + esc(x.name) + ' <span class="f5-k">' + esc([x.marke, x.kcal!=null ? z(x.kcal) + ' kcal je 100 g' : ''].filter(Boolean).join(', ')) + '</span></div>').join('') || '<div class="f5-k">Kein Treffer.</div>';
          $t.querySelectorAll('[data-id]').forEach(d2 => d2.onclick = () => { const x = l.find(y => y.produkt_id===d2.dataset.id); gewaehlt = {produkt_id:x.produkt_id, titel:x.name, kcal100:x.kcal};
            $t.querySelectorAll('div').forEach(y => y.classList.toggle('an', y===d2)); });
        }, 300);
      }
    };
    box.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => setArt(b.dataset.wa));
    $s.oninput = such;
    box.querySelector('[data-wzu]').onclick = () => { box.innerHTML = ''; };
    box.querySelector('[data-wok]').onclick = () => {
      const menge = Number(String(box.querySelector('[data-wm]').value).replace(',', '.')), hin = box.querySelector('[data-wh]').value.trim() || null;
      const m = t2 => { const x = box.querySelector('[data-wmeld]'); x.textContent = t2; x.className = 'f5-meld f'; };
      let e2;
      if(art==='frei'){ const tx = $s.value.trim(); if(!tx) return m('Text fehlt.'); e2 = {typ:'frei', titel:tx}; }
      else if(!gewaehlt) return m('Treffer auswählen.');
      else if(art==='rezept'){ if(!(menge > 0 && menge <= 20)) return m('Portionen zwischen 0,5 und 20.');
        e2 = {typ:'rezept', rezept_id:gewaehlt.rezept_id, titel:gewaehlt.titel, portionen:menge, kcal_plan: gewaehlt.kcal ? Math.round(gewaehlt.kcal * menge) : null}; }
      else { if(!(menge > 0 && menge <= 3000)) return m('Gramm zwischen 1 und 3000.');
        e2 = {typ:'produkt', produkt_id:gewaehlt.produkt_id, titel:gewaehlt.titel, menge_g:menge, kcal_plan: gewaehlt.kcal100!=null ? Math.round(gewaehlt.kcal100 * menge / 100) : null}; }
      E.eintraege.push(Object.assign({datum:t, slot:sl, snack_zeit:pz.sz, hinweis:hin}, e2));
      editor();
    };
    setArt('rezept');
  }

  /* =================== Rezepte teilen =================== */
  async function rezeptePanel(){
    if(opt.muster){
      // Vorführung: Rezepte der Musterperson aus dem FL-4-Dashboard (fl_muster_rezept), nur ansehen
      $p.innerHTML = '<div class="f5-k">Lädt …</div>';
      let d; try{ d = await opt.ladeDashboard(plus(heute, -7), plus(heute, -1)); }catch(e){ $p.innerHTML = '<div class="f5-meld f">Laden fehlgeschlagen: ' + esc(e.message || e) + '</div>'; return; }
      const alle = d.rezepte || [], empf = alle.filter(x => x.herkunft==='empfohlen'), eig = alle.filter(x => x.herkunft!=='empfohlen'), geg = d.rezepte_gegessen || [];
      const zeile = (x, chip) => '<div class="f5-rez">' + (x.bild ? '<img src="' + esc(x.bild) + '" alt="" loading="lazy">' : '<div class="ph"></div>') +
        '<div style="flex:1"><b>' + esc(x.name) + '</b><div class="f5-k">' + [x.kcal_portion && z(x.kcal_portion) + ' kcal je Portion', x.protein_portion && z(x.protein_portion, 1) + ' g Eiweiß', x.mahlzeit].filter(Boolean).map(esc).join(', ') + '</div></div>' + chip + '</div>';
      const dl = demoLaden(), lok = ((dl.geteilt || {})[opt.nr] || []);
      $p.innerHTML = '<div class="f5-hinweis">Vorführung. Geteilt wird nur in diesem Browser-Tab.</div>' +
        '<h3>Mit ' + esc(opt.name || 'dieser Person') + ' geteilt (' + (empf.length + lok.length) + ')</h3>' +
        lok.map((x, i) => zeile(x, '<span class="f5-chip gruen">Vorführung</span><button class="f5-b rot" data-lokweg="' + i + '" type="button">Teilen beenden</button>')).join('') +
        (empf.length || lok.length ? empf.map(x => zeile(x, '<span class="f5-chip blau">Empfehlung</span>')).join('') : '<p class="f5-k">Noch nichts geteilt. Rezept unten suchen und teilen.</p>') +
        '<h3>Rezepte der Person (' + eig.length + ')</h3>' +
        (eig.length ? eig.map(x => zeile(x, '<span class="f5-chip">' + (x.herkunft==='gespeichert' ? 'gespeichert' : 'eigenes') + '</span>')).join('') : '<p class="f5-k">Keine.</p>') +
        (geg.length ? '<h3>In den letzten 7 Tagen gekocht</h3><p class="f5-k">' + geg.map(x => esc(x.name) + ' (' + x.mal + '×)').join(', ') + '</p>' : '') +
        '<h3>Rezept teilen</h3><input data-ds style="width:100%" placeholder="Rezept suchen …"><div class="f5-treffer" data-dt></div>' +
        '<input data-dn maxlength="300" style="width:100%;margin-top:6px" placeholder="Notiz für die Person, z. B. passt bei Laktoseintoleranz">' +
        '<div class="f5-reihe"><button class="f5-b gruen" data-dlos type="button">Teilen</button></div><div class="f5-meld" data-dm></div>';
      $p.querySelectorAll('[data-lokweg]').forEach(b => b.onclick = () => { const d2 = demoLaden(); (d2.geteilt[opt.nr] || []).splice(Number(b.dataset.lokweg), 1); demoSchreiben(d2); rezeptePanel(); });
      let wahlR = null; const $ds = $p.querySelector('[data-ds]'), $dt = $p.querySelector('[data-dt]');
      const suche = async () => { const q = $ds.value.trim().toLowerCase(); let l; try{ l = await alleRezepte(); }catch(e){ $dt.innerHTML = '<div>' + esc(e.message) + '</div>'; return; }
        const tr = l.filter(x => !q || String(x.name||'').toLowerCase().includes(q)).slice(0, 30);
        $dt.innerHTML = tr.map(x => '<div data-id="' + esc(x.id) + '">' + esc(x.name) + ' <span class="f5-k">' + (x.kcal ? z(x.kcal) + ' kcal' : '') + '</span></div>').join('') || '<div class="f5-k">Kein Treffer.</div>';
        $dt.querySelectorAll('[data-id]').forEach(d3 => d3.onclick = () => { wahlR = l.find(y => y.id===d3.dataset.id); $dt.querySelectorAll('div').forEach(y => y.classList.toggle('an', y===d3)); }); };
      $ds.oninput = suche; suche();
      $p.querySelector('[data-dlos]').onclick = () => {
        if(!wahlR) return meld('[data-dm]', 'Rezept auswählen.', 'f');
        const d2 = demoLaden(); d2.geteilt = d2.geteilt || {}; (d2.geteilt[opt.nr] = d2.geteilt[opt.nr] || []).unshift({rezept_id: wahlR.id, name: wahlR.name, kcal_portion: wahlR.kcal, bild: wahlR.bild, mahlzeit: wahlR.mahlzeiten, notiz: $p.querySelector('[data-dn]').value.trim() || null});
        demoSchreiben(d2); rezeptePanel();
      };
      return;
    }
    $p.innerHTML = '<div class="f5-k">Lädt …</div>';
    try{ st.rezepte = await opt.rpc('cb_fp_rezepte', {p_code: opt.code}); }catch(e){ $p.innerHTML = '<div class="f5-meld f">Laden fehlgeschlagen: ' + esc(e.message || e) + '</div>'; return; }
    const g = st.rezepte.geteilt || [];
    let h = '<h3>Mit ' + esc(opt.name || 'dieser Person') + ' geteilt (' + g.length + ')</h3>' +
      (g.length ? g.map(x => '<div class="f5-rez">' + (x.bild ? '<img src="' + esc(x.bild) + '" alt="" loading="lazy">' : '<div class="ph"></div>') +
        '<div style="flex:1"><b>' + esc(x.name) + '</b><div class="f5-k">' + [x.kcal_portion && z(x.kcal_portion) + ' kcal je Portion', 'geteilt seit ' + new Date(x.seit).toLocaleDateString('de-DE')].filter(Boolean).join(', ') + '</div>' +
        (x.notiz ? '<div style="font-size:13px">' + esc(x.notiz) + '</div>' : '') + '</div>' +
        '<span class="f5-chip ' + (x.mitbearbeiten ? 'gruen' : '') + '">' + (x.mitbearbeiten ? 'gemeinsam bearbeiten' : 'Empfehlung') + '</span>' +
        '<button class="f5-b rot" data-rende="' + esc(x.rezept_id) + '" type="button">Teilen beenden</button></div>').join('')
        : '<p class="f5-k">Noch nichts geteilt. Rezept unten suchen und teilen.</p>') +
      '<h3>Rezept teilen</h3><input data-rs style="width:100%" placeholder="Rezept suchen …"><div class="f5-treffer" data-rt></div>' +
      '<div data-rform hidden><div style="margin-top:8px"><b data-rname></b></div>' +
      '<label class="f5-reihe" style="gap:6px;align-items:center;font-size:14px"><input type="checkbox" data-rmit> Gemeinsam bearbeiten (nur eigene Rezepte)</label>' +
      '<label style="font-size:13px;font-weight:800">Notiz für die Person</label><input data-rnotiz maxlength="300" style="width:100%" placeholder="z. B. passt bei Laktoseintoleranz">' +
      '<div style="font-size:13px;font-weight:800;margin-top:8px">Teilen mit</div><div data-rkl></div>' +
      '<div class="f5-reihe"><button class="f5-b gruen" data-rlos type="button">Teilen</button></div></div><div class="f5-meld" data-rmeld></div>' +
      '<div class="f5-hinweis">Neue Rezepte werden in der <a href="https://root-index.de/" target="_blank" rel="noopener">Root-Index-App</a> unter Rezepte angelegt. Sie bleiben privat, bis sie geteilt oder veröffentlicht werden. ' +
      'Geteilte Rezepte sieht die Person nur, solange ihr Key läuft und die Einwilligung besteht. Eine eigene Kopie, die sie sich speichert, bleibt bei ihr.</div>';
    $p.innerHTML = h;
    $p.querySelectorAll('[data-rende]').forEach(b => b.onclick = async () => {
      if(!confirm('Teilen beenden? Eigene Kopien der Person bleiben erhalten.')) return;
      b.disabled = true;
      try{ const r = await opt.rpc('cb_fp_rezept_teilen_beenden', {p_rezept: b.dataset.rende, p_code: opt.code}); if(r && r.ok===false) throw new Error(r.grund); rezeptePanel(); }
      catch(e){ b.disabled = false; meld('[data-rmeld]', e.message || String(e), 'f'); }
    });
    const $s = $p.querySelector('[data-rs]'), $t = $p.querySelector('[data-rt]');
    let sel = null;
    const such = async () => {
      const q = $s.value.trim().toLowerCase();
      let l; try{ l = await alleRezepte(); }catch(e){ $t.innerHTML = '<div>' + esc(e.message) + '</div>'; return; }
      const tr = l.filter(x => !q || String(x.name||'').toLowerCase().includes(q)).sort((a, b) => (b.is_own - a.is_own) || String(a.name).localeCompare(String(b.name), 'de')).slice(0, 40);
      $t.innerHTML = tr.map(x => '<div data-id="' + esc(x.id) + '">' + esc(x.name) + ' <span class="f5-k">' + [x.kcal && z(x.kcal) + ' kcal', x.is_own ? (x.sichtbarkeit==='privat' ? 'eigenes Rezept, privat' : 'eigenes Rezept, öffentlich') : x.quelle==='CleanBase' ? 'Root Index' : 'öffentlich'].filter(Boolean).join(', ') + '</span></div>').join('') || '<div class="f5-k">Kein Treffer.</div>';
      $t.querySelectorAll('[data-id]').forEach(d2 => d2.onclick = () => {
        sel = l.find(y => y.id===d2.dataset.id); $t.querySelectorAll('div').forEach(y => y.classList.toggle('an', y===d2));
        const f = $p.querySelector('[data-rform]'); f.hidden = false; $p.querySelector('[data-rname]').textContent = sel.name;
        const mit = $p.querySelector('[data-rmit]'); mit.disabled = !sel.is_own; mit.checked = !!sel.is_own;
        const kl = (opt.klienten && opt.klienten.length ? opt.klienten : [{code: opt.code, name: opt.name}]);
        $p.querySelector('[data-rkl]').innerHTML = kl.map(k => '<label style="display:flex;gap:6px;align-items:center;font-size:14px;font-weight:400;margin:3px 0"><input type="checkbox" value="' + esc(k.code) + '"' + (k.code===opt.code ? ' checked' : '') + '> ' + esc(k.name || k.code) + ' <span class="f5-k">' + esc(k.code) + '</span></label>').join('');
      });
    };
    $s.oninput = such; such();
    $p.querySelector('[data-rlos]').onclick = async function(){
      if(!sel) return meld('[data-rmeld]', 'Rezept auswählen.', 'f');
      const codes = Array.from($p.querySelectorAll('[data-rkl] input:checked')).map(x => x.value);
      if(!codes.length) return meld('[data-rmeld]', 'Mindestens eine Person auswählen.', 'f');
      this.disabled = true; meld('[data-rmeld]', 'Wird geteilt …');
      const mit = $p.querySelector('[data-rmit]').checked, notiz = $p.querySelector('[data-rnotiz]').value.trim() || null, fehler = [];
      for(const c of codes){
        try{ const r = await opt.rpc('cb_fp_rezept_teilen', {p_rezept: sel.id, p_code: c, p_mitbearbeiten: mit, p_notiz: notiz}); if(r && r.ok===false) fehler.push(c + ': ' + r.grund); }
        catch(e){ fehler.push(c + ': ' + (e.message || e)); }
      }
      this.disabled = false;
      if(fehler.length){ meld('[data-rmeld]', fehler.join('; '), 'f'); return; }
      await rezeptePanel(); meld('[data-rmeld]', 'Mit ' + codes.length + (codes.length===1 ? ' Person geteilt.' : ' Personen geteilt.'), 'ok');
    };
  }
  if(opt.nurTab){ st.tab = opt.nurTab; zeigeTab(); }
  return { tab: t => { st.tab = t; zeigeTab(); } };
}
window.FL5 = { mount };

/* Anbindung an die Arbeitsoberfläche von therapeut.html (FL-4: window.FLShell, Menüpunkte
   „Pläne“, „Rezepte“, „Berichte“). Person = aktuelle Wahl unter Klienten, sonst Auswahlfeld. */
function shellRender(id, el, ctx){
  css(); el.classList.add('f5');
  const tab = {plaene:'plaene', rezepte:'rezepte', berichte:'bericht'}[id];
  const rpc = async (n, a) => { const {data, error} = await ctx.client.rpc(n, a); if(error) throw new Error(error.message); return typeof data==='string' ? JSON.parse(data) : data; };
  const verb = ctx.demo ? [] : (ctx.keys || []).filter(k => k.status==='laeuft' && k.einwilligung==='erteilt');
  const nm = k => k.klient_name || k.bezeichnung || k.code;
  const ich = ctx.ich || {};
  el.innerHTML = '<div class="f5-reihe"><label>Person<select data-f5p><option value="">Lädt …</option></select></label></div><div data-f5z></div>';
  const $s = el.querySelector('[data-f5p]'), $z = el.querySelector('[data-f5z]');
  let muster = null;
  const tok = ctx.demo ? (ctx.musterToken || null) : null;          // Demo-Modus: nur Musterpraxis, mit Demo-Passwort
  const zeige = w => {
    $z.innerHTML = ''; $z.className = '';
    if(!w){ $z.innerHTML = '<p class="f5-k">Noch keine Klienten. Unter Keys einen Key anlegen.</p>'; return; }
    if(w.startsWith('muster-')){
      const nr = Number(w.slice(7)), k = muster && (muster.klienten || []).find(x => x.nr===nr) || {};
      mount($z, { nurTab: tab, muster: true, nr, token: tok, code: k.code, name: k.name, heute: (muster && muster.heute) || ctx.heute, praxis: (muster && muster.praxis) || 'Praxis Muster',
                  fachperson: 'Musterpraxis (erfundene Daten)', rpc, ladeDashboard: (von, bis) => rpc('cb_fl_muster_dashboard', {p_token: tok, p_nr: nr, p_von: von, p_bis: bis}) });
    } else {
      const k = verb.find(x => x.code===w) || {code: w};
      mount($z, { nurTab: tab, muster: false, code: w, name: nm(k), heute: ctx.heute, praxis: ich.praxis || ich.name, fachperson: ich.name, rpc,
                  ki: async body => { const {data, error} = await ctx.client.functions.invoke('fl5-riki-rezeptideen', {body});
                                      if(error){ let d = null; try{ d = await error.context.json(); }catch(e){} return d || {ok:false, grund: error.message}; } return data; },
                  ladeDashboard: (von, bis) => rpc('cb_fp_klient_dashboard', {p_code: w, p_von: von, p_bis: bis}),
                  klienten: verb.map(x => ({code: x.code, name: nm(x)})) });
    }
  };
  // Musterdaten nur im Demo-Modus (Ralph 11.11.: nach echter Anmeldung keine Musterdaten)
  return (ctx.demo ? rpc('cb_fl_muster', {p_token: tok}).catch(() => null) : Promise.resolve(null)).then(m => {
    muster = m;
    const opts = verb.map(k => '<option value="' + esc(k.code) + '">' + esc(nm(k)) + ' (' + esc(k.code) + ')</option>').join('') +
      (muster ? '<optgroup label="Musterpraxis (erfunden)">' + (muster.klienten || []).map(k => '<option value="muster-' + k.nr + '">' + esc(k.name) + '</option>').join('') + '</optgroup>' : '');
    $s.innerHTML = opts || '<option value="">keine Person</option>';
    let w = ctx.klient || (ctx.muster && ctx.musterNr ? 'muster-' + ctx.musterNr : '') || (verb[0] ? verb[0].code : (muster ? 'muster-1' : ''));
    $s.value = w; if($s.value !== w) w = $s.value;
    $s.onchange = () => zeige($s.value);
    zeige(w);
  });
}
function anbinden(){
  if(!window.FLShell || window.FLShell._fl5) return !!window.FLShell;
  window.FLShell._fl5 = true;
  ['plaene','rezepte','berichte'].forEach(id => window.FLShell.bereich(id, { render: (el, ctx) => shellRender(id, el, ctx) }));
  return true;
}
if(!anbinden()) document.addEventListener('DOMContentLoaded', anbinden);
})();
