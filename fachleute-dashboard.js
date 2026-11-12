/* fachleute-dashboard.js · 11.11.2026 · FL-4
   Dashboard je Klient für Ernährungsfachleute (Tag / Woche / Monat).
   Wird von therapeut.html (echte Klienten, über den Key-Code) und von
   fachleute-muster.html (Musterpraxis, nur lesen) benutzt.
   Alle Zahlen kommen vom Server (_fl4_dashboard → FL-2-Bausteine). Diese
   Datei rechnet nichts nach, sie zeigt nur an.

   FLDash.mount(element, {
     laden: async (von, bis) => json,          // Pflicht
     heute: 'YYYY-MM-DD',                      // Bezugstag (Server)
     nurLesen: true|false,                     // Musterpraxis: true
     vorgabeSetzen: async (kennzahl, wert, art, notiz) => {ok, grund}   // nur echte Klienten
   }) */
(function(){
'use strict';
const CSS = `
.fd{--fd-gruen:#2e7d46;--fd-dunkel:#133521;--fd-creme:#F3EEDC;--fd-muted:#5d6b61;--fd-linie:#dfe6df;--fd-obst:#e8920c;--fd-gemuese:#2e7d46;--fd-rot:#b42318}
.fd .fd-karte{background:#fff;border:1px solid var(--fd-linie);border-radius:16px;padding:16px;margin:14px 0}
.app-an .fd .fd-karte{border:0;box-shadow:0 1px 2px rgba(19,53,33,.05),0 6px 20px rgba(19,53,33,.06);padding:18px 20px}
.fd h2{font-size:18px;margin:0 0 6px;color:var(--fd-dunkel)}
.fd h3{font-size:15px;margin:14px 0 6px;color:var(--fd-dunkel)}
.fd .fd-klein{font-size:13px;color:var(--fd-muted)}
.fd .fd-profil{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.fd .fd-chip{display:inline-block;border-radius:999px;padding:3px 10px;font-size:13px;font-weight:800;background:var(--fd-creme);color:var(--fd-dunkel)}
.fd .fd-chip.dunkel{background:var(--fd-dunkel);color:#fff}
.fd .fd-chip.hell{background:#eef1f7;color:#3a4a6b}
.fd .fd-zeit{display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:sticky;top:0;z-index:5;background:var(--fd-creme);padding:10px 0}
.fd .fd-modus{display:flex;border:1px solid var(--fd-linie);border-radius:11px;overflow:hidden;background:#fff}
.fd .fd-modus button{border:0;background:#fff;padding:8px 14px;font:inherit;font-size:15px;font-weight:800;color:var(--fd-muted);cursor:pointer}
.fd .fd-modus button.an{background:var(--fd-dunkel);color:#fff}
.fd .fd-pfeil{border:1px solid var(--fd-linie);background:#fff;border-radius:10px;width:38px;height:38px;font-size:18px;cursor:pointer;color:var(--fd-dunkel)}
.fd .fd-pfeil:disabled{opacity:.35;cursor:default}
.fd .fd-label{font-weight:800;color:var(--fd-dunkel);flex:1;min-width:140px}
.fd .fd-kacheln{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.fd .fd-kachel{background:var(--fd-creme);border-radius:12px;padding:10px 12px}
.fd .fd-kachel b{display:block;font-size:22px;color:var(--fd-dunkel);line-height:1.2}
.fd .fd-kachel span{font-size:13px;color:var(--fd-muted)}
.fd .fd-kachel i{font-style:normal;font-size:12px;color:var(--fd-muted);display:block;margin-top:2px}
.fd .fd-balken{display:flex;align-items:flex-end;gap:3px;height:150px;position:relative;margin:8px 0 2px;padding-top:6px}
.fd .fd-balken .s{flex:1;display:flex;flex-direction:column-reverse;align-items:stretch;min-width:4px;height:100%;cursor:pointer;position:relative}
.fd .fd-balken .s .t{border-radius:3px 3px 0 0}
.fd .fd-balken .s.leer{background:repeating-linear-gradient(45deg,#f3f3f3,#f3f3f3 4px,#fff 4px,#fff 8px);border-radius:3px}
.fd .fd-balken .s:hover{filter:brightness(1.1)}
.fd .fd-linie{position:absolute;left:0;right:0;border-top:2px dashed #133521;pointer-events:none}
.fd .fd-linie span{position:absolute;right:0;top:-18px;font-size:11px;font-weight:800;background:#fff;padding:0 4px;color:var(--fd-dunkel)}
.fd .fd-achse{display:flex;gap:3px;font-size:11px;color:var(--fd-muted)}
.fd .fd-achse span{flex:1;text-align:center;min-width:4px;overflow:hidden;white-space:nowrap}
.fd .fd-legende{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--fd-muted);margin-top:6px}
.fd .fd-legende i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.fd .fd-is{display:grid;grid-template-columns:minmax(120px,1.3fr) 2fr minmax(90px,auto);gap:4px 10px;align-items:center;font-size:15px}
.fd .fd-is .n{font-weight:800;color:var(--fd-dunkel)}
.fd .fd-is .n small{display:block;font-weight:400;font-size:12px;color:var(--fd-muted)}
.fd .fd-is .w{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.fd .fd-is .w small{display:block;font-size:12px;color:var(--fd-muted)}
.fd .fd-bar{height:12px;background:#eef0ee;border-radius:99px;position:relative;overflow:visible}
.fd .fd-bar .f{height:100%;border-radius:99px;max-width:100%}
.fd .fd-bar .m{position:absolute;top:-3px;bottom:-3px;border-left:2px solid var(--fd-dunkel)}
.fd .fd-is .her{grid-column:1/-1;font-size:12px;color:var(--fd-muted);margin:-2px 0 6px}
.fd .fd-is .her a{color:var(--fd-muted)}
.fd .fd-hinweis{background:#fff8e6;border:1px solid #f3d27a;border-radius:12px;padding:10px 12px;font-size:13px;color:#5b4500;margin-top:10px}
.fd .fd-tab{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}
.fd .fd-tab button{border:1px solid var(--fd-linie);background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:14px;cursor:pointer;color:var(--fd-muted)}
.fd .fd-tab button.an{background:var(--fd-dunkel);border-color:var(--fd-dunkel);color:#fff}
.fd table{width:100%;border-collapse:collapse;font-size:14px}
.fd td,.fd th{padding:7px 6px;border-bottom:1px solid #eef0ee;text-align:left;vertical-align:top}
.fd th{font-size:12px;color:var(--fd-muted);font-weight:800}
.fd td.z{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.fd .fd-score{display:inline-block;min-width:34px;text-align:center;border-radius:8px;padding:2px 6px;font-weight:800;color:#fff;font-size:13px}
.fd .fd-mz{margin-top:10px}
.fd .fd-mz h4{margin:0 0 4px;font-size:14px;color:var(--fd-dunkel)}
.fd .fd-plan{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.fd .fd-plan .tag{background:var(--fd-creme);border-radius:10px;padding:6px;min-height:70px;font-size:12px}
.fd .fd-plan .tag b{display:block;font-size:12px;color:var(--fd-dunkel)}
.fd .fd-plan .tag.heute{outline:2px solid var(--fd-gruen)}
.fd .fd-plan .e{background:#fff;border-radius:7px;padding:3px 5px;margin-top:4px;line-height:1.25}
.fd .fd-plan .e small{display:block;color:var(--fd-muted)}
.fd .fd-plan .e.leer{background:transparent;border:1px dashed var(--fd-linie);color:var(--fd-muted)}
.fd .fd-plan-kcal{float:right;font-weight:400;color:var(--fd-muted);font-size:11px}
.fd .fd-rez{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #eef0ee}
.fd .fd-rez img{width:48px;height:48px;border-radius:10px;object-fit:cover;background:var(--fd-creme)}
.fd .fd-rez .ph{width:48px;height:48px;border-radius:10px;background:var(--fd-creme)}
.fd .fd-vg-form{display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin-top:10px}
.fd .fd-vg-form select,.fd .fd-vg-form input{padding:8px;border:1px solid var(--fd-linie);border-radius:9px;font:inherit;font-size:15px;background:#fff}
.fd .fd-vg-form input[type=number]{width:96px}
.fd .fd-vg-form input[type=text]{flex:1;min-width:140px}
.fd .fd-k{background:#fff;color:var(--fd-dunkel);border:1px solid var(--fd-linie);border-radius:9px;padding:7px 11px;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
.fd .fd-k.gruen{background:var(--fd-gruen);border-color:var(--fd-gruen);color:#fff}
.fd .fd-k:disabled{opacity:.5;cursor:default}
.fd .fd-ziele{width:100%;border-collapse:collapse;font-size:14px}
.fd .fd-ziele th{font-size:12px;color:var(--fd-muted);font-weight:800;text-align:left;padding:6px;border-bottom:1px solid var(--fd-linie);white-space:nowrap}
.fd .fd-ziele td{padding:8px 6px;border-bottom:1px solid #eef0ee;vertical-align:middle}
.fd .fd-ziele td.z,.fd .fd-ziele th.z{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.fd .fd-her{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11.5px;font-weight:800;white-space:nowrap;margin-top:3px}
.fd .fd-her.vorgabe{background:#133521;color:#fff} .fd .fd-her.profil{background:#e6effa;color:#1d4f91} .fd .fd-her.dge{background:#F3EEDC;color:#5b4a1e} .fd .fd-her.leer{background:#f1f1f1;color:#777}
.fd .fd-ist{border-radius:8px;padding:2px 7px} .fd .fd-ist.ja{background:#DDEFE2} .fd .fd-ist.nein{background:#FCEBD3} .fd .fd-ist.ueber{background:#F8D7D0}
.fd .fd-ziel-edit{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.fd .fd-ziel-zeile td{background:#F7F9F5}
.fd .fd-ziel-edit select,.fd .fd-ziel-edit input{padding:6px 7px;border:1px solid var(--fd-linie);border-radius:8px;font:inherit;font-size:14px;background:#fff}
.fd .fd-ziel-edit input{width:90px!important}
.fd .fd-ziel-edit select{width:auto!important}
.fd .fd-vg-form select{width:auto}
.fd details summary{cursor:pointer;font-weight:800;color:var(--fd-dunkel);font-size:15px}
.fd .fd-laden{color:var(--fd-muted);padding:30px 0;text-align:center}
.fd .fd-kopfzeile{display:flex;justify-content:space-between;align-items:center;gap:10px}
.fd .fd-akte-txte{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;margin-top:6px}
.fd .fd-akte-txt{background:var(--fd-hell,#f6f7f8);border-radius:10px;padding:9px 11px;font-size:14px;line-height:1.45;min-width:0;overflow-wrap:anywhere}
.fd .fd-akte-txt small{display:block;font-size:12px;font-weight:800;color:var(--fd-muted);margin-bottom:2px}
.fd .fd-akte-form{margin-top:14px;border-top:1px solid var(--fd-linie);padding-top:12px}
.fd .fd-akte-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:10px}
.fd .fd-akte-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:var(--fd-muted);min-width:0}
.fd .fd-akte-form input:not([type=checkbox]),.fd .fd-akte-form select,.fd .fd-akte-form textarea{font:inherit;font-size:14px;font-weight:400;color:var(--fd-dunkel);border:1px solid var(--fd-linie);border-radius:9px;padding:7px 9px;background:var(--fd-weiss,#fff);width:100%!important;box-sizing:border-box}
.fd .fd-akte-lang{margin-top:10px}
.fd .fd-akte-unv{border:1px solid var(--fd-linie);border-radius:10px;margin:12px 0 0;padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px 14px}
.fd .fd-akte-unv legend{font-size:12px;font-weight:800;color:var(--fd-muted);padding:0 4px}
.fd .fd-akte-unv label{flex-direction:row;align-items:center;gap:6px;font-weight:400;font-size:14px;color:var(--fd-dunkel);width:auto!important;flex:0 0 auto;white-space:nowrap}
.fd .fd-akte-unv input{width:16px!important;height:16px;margin:0;flex:0 0 auto}
.fd .fd-akte-knoepfe{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
.fd .fd-wenig{color:var(--muted,#737373);font-style:italic}
.fd .fd-privat{margin-top:14px;border:1px dashed var(--fd-linie);border-radius:12px;padding:10px 12px}
.fd .fd-chip.sw{background:var(--blau-zart,#eaf1ff);color:var(--blau,#0b2ff2)}
.fd .fd-akte-prot{margin-top:12px;font-size:14px} .fd .fd-akte-prot summary{cursor:pointer;font-weight:800;color:var(--fd-muted)}
.fd .fd-bald{border:1px dashed #b7c4b9;border-radius:12px;padding:10px 12px;font-size:14px;color:var(--fd-muted);margin-top:10px}
@media (max-width:560px){ .fd .fd-modus{order:0} .fd .fd-pfeil[data-p="-1"]{order:1} .fd .fd-pfeil[data-p="1"]{order:2} .fd .fd-label{order:3;flex-basis:100%} .fd .fd-plan{grid-template-columns:repeat(2,1fr)} .fd .fd-is{grid-template-columns:1fr auto} .fd .fd-is .bw{grid-column:1/-1} }

.fd .fd-block{position:relative}
.fd .fd-ctl{position:absolute;top:10px;right:10px;display:flex;gap:2px;z-index:2}
.app-an .fd .fd-ctl{top:12px;right:12px}
.fd .fd-ctl button{width:28px;height:28px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--fd-muted);font:inherit;font-size:15px;line-height:1;cursor:pointer;padding:0}
.fd .fd-ctl button:hover:not(:disabled){border-color:var(--fd-linie);background:var(--fd-creme);color:var(--fd-dunkel)}
.fd .fd-ctl button:focus-visible{outline:2px solid var(--blau,#0b2ff2);outline-offset:1px}
.fd .fd-ctl button:disabled{opacity:.25;cursor:default}
.fd .fd-ctl [data-a="zieh"]{cursor:grab}
.fd .fd-block .fd-karte > h2:first-child,.fd .fd-block .fd-karte > .fd-kopfzeile:first-child,.fd .fd-block .fd-karte > b:first-child{margin-right:122px;display:block}
.fd .fd-block .fd-karte > .fd-kopfzeile:first-child{display:flex}
.fd .fd-stub{display:none;cursor:pointer;padding-top:14px!important;padding-bottom:14px!important}
.fd .fd-stub h2{margin:0;color:var(--fd-muted)}
.fd .fd-block.zu .fd-stub{display:block}
.fd .fd-block.zu .fd-ik{display:none}
.fd .fd-block.zieht{opacity:.45}
.fd .fd-block.vor::before,.fd .fd-block.nach::after{content:"";display:block;height:3px;border-radius:3px;background:var(--blau,#0b2ff2)}
.fd .fd-ansicht-fuss{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:6px 0 24px}
@media print{.fd .fd-ctl,.fd .fd-ansicht-fuss,.fd .fd-stub{display:none!important}}
@media (pointer:coarse){.fd .fd-ctl [data-a="zieh"]{display:none}.fd .fd-ctl button{width:36px;height:36px;font-size:17px}.fd .fd-block .fd-karte > h2:first-child,.fd .fd-block .fd-karte > .fd-kopfzeile:first-child,.fd .fd-block .fd-karte > b:first-child{margin-right:116px}}

.fd .fd-balken .s.aktiv{outline:2px solid var(--fd-dunkel);outline-offset:2px;border-radius:3px}
.fd .fd-achse span.an{font-weight:800;color:var(--fd-dunkel)}
.fd .fd-kachel em.fd-delta{display:block;font-style:normal;font-size:12px;font-weight:700;margin-top:4px;color:var(--fd-muted)}
.fd .fd-kachel em.fd-delta.auf{color:var(--ok,#16a34a)}
.fd .fd-kachel em.fd-delta.ab{color:var(--warn,#d97706)}
.fd .fd-balken .t{position:relative}
.fd .fd-balken .t .w{position:absolute;top:4px;left:0;right:0;text-align:center;font-size:12px;font-weight:800;color:#fff}
.fd .fd-nw-wahl{display:flex;align-items:center;gap:8px;margin:2px 0 6px}
.fd .fd-nw-wahl select{font:inherit;font-size:14px;padding:5px 8px;border-radius:9px;border:1px solid var(--fd-linie);background:var(--fd-weiss,#fff);color:inherit}
`;
function css(){ if(document.getElementById('fd-css')) return; const s=document.createElement('style'); s.id='fd-css'; s.textContent=CSS; document.head.appendChild(s); }

const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso = d => d.toISOString().slice(0,10);
const D = s => new Date(s + 'T12:00:00Z');
const plus = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate()+n); return iso(d); };
const montag = s => { const d = D(s); const w = (d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-w); return iso(d); };
const monatsAnfang = s => s.slice(0,8) + '01';
const monatsEnde = s => { const d = D(monatsAnfang(s)); d.setUTCMonth(d.getUTCMonth()+1); d.setUTCDate(0); return iso(d); };
const WT = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const MON = ['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sep.','Okt.','Nov.','Dez.'];
const MON_LANG = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const tm = s => { const d = D(s); return d.getUTCDate() + '.' + (d.getUTCMonth()+1) + '.'; };
const lang = s => { const d = D(s); return WT[d.getUTCDay()] + ', ' + d.getUTCDate() + '. ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const z = (x, st) => x==null || x==='' || isNaN(Number(x)) ? '–' : Number(x).toLocaleString('de-DE', {maximumFractionDigits: st==null?0:st, minimumFractionDigits: 0});
const BEW = {'Sehr gut':'#15803d','Gut':'#4d7c0f','Mittel':'#b45309','Schwach':'#b91c1c'};
const bewFarbe = (b, s) => BEW[b] || (s==null ? '#78716c' : s>=80 ? '#15803d' : s>=65 ? '#4d7c0f' : s>=50 ? '#b45309' : '#b91c1c');
const scoreBadge = (s, b) => s==null ? '<span class="fd-klein">–</span>' : '<span class="fd-score" style="background:' + bewFarbe(b, s) + '" title="' + esc(b||'') + '">' + Math.round(s) + '</span>';
const KZ = {kcal:['Energie','kcal'], protein:['Eiweiß','g'], kh:['Kohlenhydrate','g'], fett:['Fett','g'], zucker:['Zucker','g'],
            ballaststoffe:['Ballaststoffe','g'], salz:['Salz','g'], 'gruppe:gemuese':['Gemüse','g'], 'gruppe:obst':['Obst','g'],
            'gruppe:gemuese+obst':['Obst und Gemüse','g']};
const ART = {mindestens:'mind.', hoechstens:'höchstens', etwa:'etwa', bereich:''};
const MAHLZEITEN = ['Frühstück','Mittag','Abendessen','Snack'];
/* Teller nach FET-Tellermodell: gleiche Zuordnung wie im Tagebuch (TELLER_SEG in app.js,
   Branch claude/busy-kalam-4b187a, App tellerVorlage). Nach Gramm; FET nur als Strich (Orientierung). */
const TELLER_FET = {g:50, e:25, k:25};
const TELLER_SEG = [
  {k:'g', n:'Gemüse & Obst', col:'#4f9a3a', gruppen:['gemuese','obst']},
  {k:'e', n:'Eiweiß',        col:'#c0583a', gruppen:['fleisch','fisch','eier','huelsenfruechte','milch']},
  {k:'k', n:'Kohlenhydrate', col:'#d4a12c', gruppen:['vollkorn','getreide','kartoffeln']}
];

/* Ansicht je Fachperson (Ralph 12.11.: Karten zuklappen und verschieben, gilt für alle Personen).
   opt.ansicht = {laden: () => layout|null, speichern: (layout|null) => …}; layout = {reihenfolge:[schlüssel], zu:[schlüssel]} */
const ANSICHT_STANDARD = ['profil','akte','leer','kacheln','ziele','verlauf','kalorien','gemuese','score','naehrwerte','tagebuch','teller','istsoll','produkte','rezepte','plan'];
const ANSICHT_TITEL = {profil:'Person', akte:'Akte', leer:'Hinweis', kacheln:'Kennzahlen', ziele:'Ziele', verlauf:'Verlauf der letzten 8 Wochen',
  kalorien:'Kalorien', gemuese:'Gemüse und Obst', score:'Root-Index-Score', naehrwerte:'Nährwerte', tagebuch:'Tagebuch', teller:'Teller', istsoll:'Ist und Soll',
  produkte:'Gegessene Produkte', rezepte:'Rezepte', plan:'Wochenplanung'};
let ANSICHT = null, ANSICHT_LADEN = null, NW_WAHL = 'protein';
function ansichtNorm(a){
  const liste = x => Array.isArray(x) ? x.filter(k => typeof k==='string' && ANSICHT_TITEL[k]).slice(0, 40) : [];
  return {reihenfolge: liste(a && a.reihenfolge), zu: liste(a && a.zu)};
}
function ansichtBereit(store){
  if(ANSICHT) return Promise.resolve();
  if(!ANSICHT_LADEN) ANSICHT_LADEN = Promise.resolve().then(() => store ? store.laden() : null).catch(() => null).then(a => { ANSICHT = ansichtNorm(a); });
  return ANSICHT_LADEN;
}
function ansichtOrdnung(){
  const r = (ANSICHT ? ANSICHT.reihenfolge : []).filter((k, i, a) => a.indexOf(k)===i);
  ANSICHT_STANDARD.forEach((k, i) => {
    if(r.includes(k)) return;
    let p = -1; for(let j = i - 1; j >= 0; j--){ p = r.indexOf(ANSICHT_STANDARD[j]); if(p >= 0) break; }
    r.splice(p + 1, 0, k);
  });
  return r;
}

function mount(el, opt){
  css();
  const heute = opt.heute || iso(new Date());
  const st = { modus:'woche', anker: plus(montag(heute), -7), daten:null, prodSort:'menge', reqNr:0 };
  el.classList.add('fd');
  el.innerHTML = '<div class="fd-zeit">' +
      '<div class="fd-modus"><button data-m="tag" type="button">Tag</button><button data-m="woche" type="button">Woche</button><button data-m="monat" type="button">Monat</button></div>' +
      '<button class="fd-pfeil" data-p="-1" type="button" aria-label="zurück">‹</button><div class="fd-label"></div>' +
      '<button class="fd-pfeil" data-p="1" type="button" aria-label="weiter">›</button></div><div class="fd-inhalt"><div class="fd-laden">Lädt …</div></div>';
  const $l = el.querySelector('.fd-label'), $in = el.querySelector('.fd-inhalt');
  el.querySelectorAll('.fd-modus button').forEach(b => b.onclick = () => {
    const m = b.dataset.m; if(m===st.modus) return;
    // Anker sinnvoll umsetzen: Woche/Monat → letzter Tag mit Daten bzw. gestern
    if(m==='tag') st.anker = bereich().bis < heute ? bereich().bis : plus(heute, -1);
    else st.anker = st.anker;
    st.modus = m; laden();
  });
  el.querySelectorAll('.fd-pfeil').forEach(b => b.onclick = () => {
    const r = Number(b.dataset.p);
    st.anker = st.modus==='tag' ? plus(st.anker, r) : st.modus==='woche' ? plus(montag(st.anker), 7*r)
             : (() => { const d = D(monatsAnfang(st.anker)); d.setUTCMonth(d.getUTCMonth()+r); return iso(d); })();
    laden();
  });
  function bereich(){
    if(st.modus==='tag') return {von:st.anker, bis:st.anker};
    if(st.modus==='woche'){ const v = montag(st.anker); return {von:v, bis:plus(v,6)}; }
    return {von:monatsAnfang(st.anker), bis:monatsEnde(st.anker)};
  }
  function kopf(){
    const b = bereich();
    el.querySelectorAll('.fd-modus button').forEach(x => x.classList.toggle('an', x.dataset.m===st.modus));
    $l.textContent = st.modus==='tag' ? lang(b.von) : st.modus==='woche' ? 'Woche ' + tm(b.von) + '–' + tm(b.bis) + D(b.bis).getUTCFullYear()
                   : MON[D(b.von).getUTCMonth()] + ' ' + D(b.von).getUTCFullYear();
    el.querySelector('.fd-pfeil[data-p="1"]').disabled = b.bis >= heute;
  }
  async function laden(){
    kopf();
    const b = bereich(), nr = ++st.reqNr;
    const bis = b.bis > heute ? heute : b.bis;
    $in.innerHTML = '<div class="fd-laden">Lädt …</div>';
    try{
      const [d] = await Promise.all([opt.laden(b.von, bis), ansichtBereit(opt.ansicht)]);
      if(nr !== st.reqNr) return;
      st.daten = d; st.bereich = {von:b.von, bis:b.bis};
      if(st.modus!=='tag') await serieLaden(d).catch(e => console.warn('Verlauf nicht geladen', e));
      await nwLaden(d).catch(e => { console.warn('Nährwerte nicht geladen', e); st.nw = null; });
      if(nr !== st.reqNr) return;
      zeichne();
    }catch(e){
      if(nr !== st.reqNr) return;
      $in.innerHTML = '<div class="fd-karte"><b>Konnte nicht laden.</b><p class="fd-klein">' + esc(e && e.message || e) + '</p></div>';
    }
  }

  function zeichne(){
    const d = st.daten;
    if(d.leer){ $in.innerHTML = '<div class="fd-karte">' + esc(d.grund || 'Für diesen Zeitraum gibt es keine freigegebenen Einträge.') + '</div>'; return; }
    const is = d.ist_soll || [];
    const isK = k => is.find(x => x.kennzahl===k && x.einheit!=='en%');
    const tage = d.tage || [];
    const n = d.tage_erfasst || 0;
    const nTage = tage.length;
    const teile = [], add = (k, html) => { if(html) teile.push([k, html]); };
    add('profil', profilKarte(d)); add('akte', akteKarte(d));
    if(!n){
      add('leer', '<div class="fd-karte"><b>Keine Einträge in diesem Zeitraum.</b><p class="fd-klein" style="margin:4px 0 0">' +
           (st.modus==='tag' ? 'An diesem Tag wurde nichts eingetragen.' : 'Mit den Pfeilen oben zurückblättern.') + '</p></div>');
      add('ziele', zieleKarte(d)); add('rezepte', rezepteKarte(d)); add('plan', planKarte(d));
      return zeigeTeile(teile);
    }
    // Kacheln
    const kcal = isK('kcal'), gem = isK('gruppe:gemuese'), go = isK('gruppe:gemuese+obst'), obst = isK('gruppe:obst');
    const proTag = (x) => n ? x / n : null;
    const grJeTag = g => { const r = (d.gruppen||[]).find(x => x.gruppe===g); return r ? r.gramm_je_tag : 0; };
    const per = st.modus!=='tag' ? perioden() : null, vg = per ? vergleich(per) : null;
    const dl = (k, einh, gut) => vg ? delta(vg, k, einh, gut) : '';
    add('kacheln', '<div class="fd-karte"><h2>Kennzahlen</h2><div class="fd-kacheln">' +
      kachel(z(kcal ? kcal.ist : proTag(d.summe.kcal)), 'kcal Ø je Tag', kcal && kcal.soll ? 'Soll ' + (ART[kcal.art]||'') + ' ' + z(kcal.soll) + ' · ' + herkunftKurz(kcal) : '', dl('kcal', ' kcal', 0)) +
      kachel(z(grJeTag('gemuese')) + ' g', 'Gemüse Ø je Tag', gem && gem.soll ? 'Soll ' + (ART[gem.art]||'') + ' ' + z(gem.soll) + ' g · ' + herkunftKurz(gem) : '', dl('gem', ' g', 1)) +
      kachel(z(grJeTag('obst')) + ' g', 'Obst Ø je Tag', go && go.soll ? 'Obst+Gemüse: ' + z(go.ist) + ' von ' + z(go.soll) + ' g' : (obst && obst.soll ? 'Orientierung ' + z(obst.soll) + ' g' : ''), dl('obst', ' g', 1)) +
      kachel(d.summe.score==null ? '–' : z(d.summe.score), 'Root-Index-Score Ø', 'nach Menge gewichtet', dl('score', '', 1)) +
      kachel(n + ' / ' + nTage, 'Tage erfasst', st.modus==='tag' ? '' : 'Werte im Schnitt dieser Tage', '') +
    '</div></div>');
    add('ziele', zieleKarte(d));
    if(opt.verlauf && !per) add('verlauf', '<div class="fd-verlauf"></div>');

    if(per){
      // Woche/Monat: ein Balken je Woche bzw. Monat über den Behandlungszeitraum (Ralph 12.11.)
      const je = st.modus==='woche' ? 'je Woche' : 'je Monat', aktiv = per.aktiv;
      const unter = txt => '<div class="fd-klein">' + txt + '</div>';
      add('kalorien', '<div class="fd-karte"><h2>Kalorien ' + je + '</h2>' + unter(vgText(vg, [['kcal', ' kcal', 'Kalorien']])) +
           periodenBalken(per.liste, p => [[p.kcal, 'var(--fd-akzent,#2e7d46)']], kcal && kcal.soll, 'Soll ' + z(kcal && kcal.soll), aktiv) +
           '<div class="fd-klein">Durchschnitt der Tage mit Einträgen. Schraffiert: keine Einträge.</div></div>');
      const linie = go && go.soll ? go.soll : null;
      add('gemuese', '<div class="fd-karte"><h2>Gemüse und Obst ' + je + '</h2>' + unter(vgText(vg, [['gem', ' g', 'Gemüse'], ['obst', ' g', 'Obst']])) +
           periodenBalken(per.liste, p => [[p.gem, 'var(--fd-gemuese)'], [p.obst, 'var(--fd-obst)']], linie, (go && go.soll_herkunft==='Vorgabe Therapeutin' ? 'Vorgabe ' : 'DGE ') + z(linie) + ' g', aktiv) +
           '<div class="fd-legende"><span><i style="background:var(--fd-gemuese)"></i>Gemüse &amp; Pilze</span><span><i style="background:var(--fd-obst)"></i>Obst</span>' +
           (linie ? '<span>- - Obst und Gemüse zusammen</span>' : '') + '</div></div>');
      add('score', '<div class="fd-karte"><h2>Root-Index-Score ' + je + '</h2>' + unter(vgText(vg, [['score', '', 'Score']])) +
           periodenBalken(per.liste, p => [[p.score, '#a78bfa']], null, '', aktiv, true) +
           '<div class="fd-klein">Nach Menge gewichtet.</div></div>');
    } else if(st.modus!=='tag'){
      add('kalorien', '<div class="fd-karte"><h2>Kalorien je Tag</h2>' + balken(tage, t => [[t.kcal, 'var(--fd-akzent,#2e7d46)']], kcal && kcal.soll, 'Soll ' + z(kcal && kcal.soll)) +
           '<div class="fd-klein">Schraffiert: keine Einträge.</div></div>');
      const linie = go && go.soll ? go.soll : null;
      add('gemuese', '<div class="fd-karte"><h2>Gemüse und Obst je Tag</h2>' +
           balken(tage, t => [[t.gemuese_g, 'var(--fd-gemuese)'], [t.obst_g, 'var(--fd-obst)']], linie, (go && go.soll_herkunft==='Vorgabe Therapeutin' ? 'Vorgabe ' : 'DGE ') + z(linie) + ' g') +
           '<div class="fd-legende"><span><i style="background:var(--fd-gemuese)"></i>Gemüse &amp; Pilze</span><span><i style="background:var(--fd-obst)"></i>Obst</span>' +
           (linie ? '<span>- - Obst und Gemüse zusammen</span>' : '') + '</div></div>');
    } else {
      add('tagebuch', tagebuchKarte(d));
    }
    add('naehrwerte', nwKarte(d, is));
    add('teller', tellerKarte(d));
    add('istsoll', istSollKarte(d, is));
    add('produkte', produkteKarte(d));
    add('rezepte', rezepteKarte(d)); add('plan', planKarte(d));
    zeigeTeile(teile);
    const v = $in.querySelector('.fd-block:not(.zu) .fd-verlauf');
    if(v && window.FLStat) FLStat.verlauf(v, opt.verlauf, heute, opt.verlaufKey);
  }
  // Karten in der gespeicherten Reihenfolge, mit Zuklappen und Verschieben
  function zeigeTeile(teile){
    const ord = ansichtOrdnung(), zu = (ANSICHT && ANSICHT.zu) || [];
    teile.sort((a, b) => ord.indexOf(a[0]) - ord.indexOf(b[0]));
    const knopf = (a, t, txt, extra) => '<button type="button" data-a="' + a + '" title="' + t + '" aria-label="' + t + '"' + (extra||'') + '>' + txt + '</button>';
    $in.innerHTML = teile.map(([k, html], i) => {
      const istZu = zu.includes(k), titel = ANSICHT_TITEL[k] || k;
      return '<div class="fd-block' + (istZu ? ' zu' : '') + '" data-k="' + k + '"><div class="fd-ctl">' +
        knopf('zieh', 'Ziehen zum Verschieben', '⠿', ' draggable="true"') +
        knopf('hoch', titel + ' nach oben', '↑', i===0 ? ' disabled' : '') +
        knopf('runter', titel + ' nach unten', '↓', i===teile.length-1 ? ' disabled' : '') +
        knopf('klapp', istZu ? titel + ' aufklappen' : titel + ' zuklappen', istZu ? '▸' : '▾', ' aria-expanded="' + !istZu + '"') + '</div>' +
        '<div class="fd-karte fd-stub" data-a="klapp"><h2>' + esc(titel) + '</h2></div>' +
        '<div class="fd-ik">' + html + '</div></div>';
    }).join('') +
    '<div class="fd-ansicht-fuss"><button type="button" class="fd-k" data-ansicht-zurueck>Ansicht zurücksetzen</button>' +
    '<span class="fd-klein">Reihenfolge und zugeklappte Karten gelten für alle Personen.</span></div>';
    binde(); bindeAnsicht();
  }
  function ansichtSichern(ord, zu){
    ANSICHT = {reihenfolge: ord, zu: zu};
    if(opt.ansicht) Promise.resolve().then(() => opt.ansicht.speichern(ANSICHT)).catch(e => console.warn('Ansicht nicht gespeichert', e));
    zeichne();
  }
  function verschiebe(k, ziel, vor){
    if(!k || k===ziel) return;
    const ord = ansichtOrdnung().filter(x => x!==k);
    const i = ord.indexOf(ziel); ord.splice(vor ? i : i + 1, 0, k);
    ansichtSichern(ord, (ANSICHT && ANSICHT.zu) || []);
  }
  function bindeAnsicht(){
    const bl = [...$in.querySelectorAll('.fd-block')], sicht = bl.map(b => b.dataset.k);
    bl.forEach(b => {
      const k = b.dataset.k, i = sicht.indexOf(k);
      b.querySelectorAll('[data-a="klapp"]').forEach(x => x.onclick = () => {
        const zu = ((ANSICHT && ANSICHT.zu) || []).filter(y => y!==k); if(!b.classList.contains('zu')) zu.push(k);
        ansichtSichern(ansichtOrdnung(), zu);
      });
      b.querySelector('[data-a="hoch"]').onclick = () => verschiebe(k, sicht[i-1], true);
      b.querySelector('[data-a="runter"]').onclick = () => verschiebe(k, sicht[i+1], false);
      const g = b.querySelector('[data-a="zieh"]');
      g.addEventListener('dragstart', e => { st.zieh = k; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', k);
        try{ e.dataTransfer.setDragImage(b, 24, 24); }catch(_){} b.classList.add('zieht'); });
      g.addEventListener('dragend', () => { st.zieh = null; bl.forEach(x => x.classList.remove('zieht', 'vor', 'nach')); });
      b.addEventListener('dragover', e => { if(!st.zieh || st.zieh===k) return; e.preventDefault();
        const r = b.getBoundingClientRect(), vor = e.clientY < r.top + r.height / 2; b.classList.toggle('vor', vor); b.classList.toggle('nach', !vor); });
      b.addEventListener('dragleave', () => b.classList.remove('vor', 'nach'));
      b.addEventListener('drop', e => { if(!st.zieh) return; e.preventDefault(); const vor = b.classList.contains('vor'), was = st.zieh; st.zieh = null; verschiebe(was, k, vor); });
    });
    const zr = $in.querySelector('[data-ansicht-zurueck]');
    if(zr) zr.onclick = () => {
      ANSICHT = {reihenfolge: [], zu: []};
      if(opt.ansicht) Promise.resolve().then(() => opt.ansicht.speichern(null)).catch(e => console.warn(e));
      zeichne();
    };
  }
  function kachel(w, t, u, dl){ return '<div class="fd-kachel"><b>' + w + '</b><span>' + esc(t) + '</span>' + (u ? '<i>' + esc(u) + '</i>' : '') + (dl || '') + '</div>'; }

  /* ---- Woche/Monat über den Behandlungszeitraum (Ralph 12.11.) ---- */
  // Tageswerte von Behandlungsbeginn (daten_ab) bzw. bis zu 26 Wochen zurück bis heute, einmal je Person geladen
  async function serieLaden(d){
    if(!opt.verlauf) return;
    const ab = d.daten_ab && d.daten_ab > '1900-01-01' ? d.daten_ab : null;
    const von = ab && ab > plus(heute, -400) ? ab : plus(heute, ab ? -400 : -182);
    const key = (opt.verlaufKey || '') + '|' + von + '|' + heute;
    if(st.serie && st.serie.key===key) return;
    // der Server liefert höchstens 3 Monate am Stück: in Stücken zu 90 Tagen parallel laden
    const stuecke = []; for(let a = von; a <= heute; a = plus(a, 90)){ const e = plus(a, 89); stuecke.push([a, e < heute ? e : heute]); }
    const teile = await Promise.all(stuecke.map(async ([a, e]) => {
      const r = await opt.verlauf(a, e);
      if(r && r.error) throw new Error(r.error.message || r.error);
      const dd = r && r.data !== undefined ? (typeof r.data==='string' ? JSON.parse(r.data) : r.data) : r;
      return (dd && dd.tage) || [];
    }));
    st.serie = {key, ab, tage: [].concat(...teile)};
  }
  const mittel = a => { const b = a.filter(x => x!=null && !isNaN(Number(x))).map(Number); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
  const naechste = k => st.modus==='woche' ? plus(k, 7) : (() => { const x = D(k); x.setUTCMonth(x.getUTCMonth() + 1); return iso(x).slice(0, 8) + '01'; })();
  function perioden(){
    const s = st.serie; if(!s) return null;
    const schl = st.modus==='woche' ? montag : monatsAnfang, m = new Map();
    s.tage.forEach(t => { const k = schl(t.datum); if(!m.has(k)) m.set(k, []); if(!t.leer) m.get(k).push(t); });
    const erste = s.tage.find(t => !t.leer);
    let k = schl(s.ab || (erste ? erste.datum : heute)); const ende = schl(heute), liste = [];
    while(k <= ende && liste.length < 80){ const t = m.get(k) || [];
      liste.push({von: k, erfasst: t.length, kcal: mittel(t.map(x => x.kcal)), gem: mittel(t.map(x => x.gemuese_g)), obst: mittel(t.map(x => x.obst_g)), score: mittel(t.map(x => x.score))});
      k = naechste(k); }
    const aktiv = schl(st.bereich.von);
    return {liste: liste.slice(-(st.modus==='woche' ? 16 : 12)), alle: liste, aktiv};
  }
  const perName = von => st.modus==='tag' ? lang(von) : st.modus==='woche' ? 'Woche ' + tm(von) + '–' + tm(plus(von, 6)) : MON_LANG[D(von).getUTCMonth()] + ' ' + D(von).getUTCFullYear();
  function vergleich(per){
    const i = per.alle.findIndex(p => p.von===per.aktiv); if(i < 1) return null;
    const cur = per.alle[i], prev = per.alle[i-1];
    if(!cur.erfasst || !prev.erfasst) return {cur, prev, leer: true, name: st.modus==='woche' ? 'Vorwoche' : MON_LANG[D(prev.von).getUTCMonth()]};
    return {cur, prev, name: st.modus==='woche' ? 'Vorwoche' : MON_LANG[D(prev.von).getUTCMonth()]};
  }
  // gut: 1 = mehr ist besser (grün), 0 = neutral (Kalorien hängen vom Ziel ab)
  function delta(vg, k, einh, gut){
    if(vg.leer) return '';
    const a = vg.cur[k], b = vg.prev[k]; if(a==null || b==null) return '';
    const dlt = a - b, r = Math.abs(dlt) < (k==='score' ? 0.5 : k==='erfasst' ? 0.5 : 1);
    const kl = r || !gut ? 'gleich' : dlt > 0 ? 'auf' : 'ab';
    return '<em class="fd-delta ' + kl + '">' + (r ? 'gleich wie ' + esc(vg.name) : (dlt > 0 ? '▲ ' : '▼ ') + z(Math.abs(dlt)) + einh + ' gegenüber ' + esc(vg.name)) + '</em>';
  }
  function vgText(vg, felder){
    if(!vg) return st.modus==='woche' ? 'Je Balken eine Woche.' : 'Je Balken ein Monat.';
    if(vg.leer) return esc(perName(vg.prev.von)) + ' hat keine Einträge, kein Vergleich.';
    const teile = felder.map(([k, einh, name]) => { const a = vg.cur[k], b = vg.prev[k]; if(a==null || b==null) return null;
      const dlt = Math.round(a - b); return name + ' ' + (dlt > 0 ? '+' : dlt < 0 ? '−' : '±') + z(Math.abs(dlt)) + einh; }).filter(Boolean);
    return teile.length ? 'Gegenüber ' + esc(vg.name) + ': ' + teile.join(', ') + '.' : '';
  }
  function periodenBalken(liste, teile, linie, linieText, aktiv, mitWert){
    let max = 0;
    liste.forEach(p => { const s = teile(p).reduce((a, x) => a + (Number(x[0])||0), 0); if(s > max) max = s; });
    if(linie && linie > max) max = linie;
    max = max * 1.08 || 1;
    let h = '<div class="fd-balken">';
    liste.forEach(p => {
      const kl = 's' + (p.erfasst ? '' : ' leer') + (p.von===aktiv ? ' aktiv' : '');
      if(!p.erfasst){ h += '<div class="' + kl + '" data-per="' + p.von + '" title="' + esc(perName(p.von)) + ': keine Einträge"></div>'; return; }
      const tt = teile(p);
      h += '<div class="' + kl + '" data-per="' + p.von + '" title="' + esc(perName(p.von) + ': ' + tt.map(x => z(x[0])).join(' + ') + ' (' + p.erfasst + ' Tage)') + '">' +
        tt.map(x => '<div class="t" style="height:' + (100 * (Number(x[0])||0) / max).toFixed(1) + '%;background:' + x[1] + '">' + (mitWert ? '<span class="w">' + z(x[0]) + '</span>' : '') + '</div>').join('') + '</div>';
    });
    if(linie) h += '<div class="fd-linie" style="bottom:' + (100 * linie / max).toFixed(1) + '%"><span>' + esc(linieText) + '</span></div>';
    const jede = liste.length > 12 ? 2 : 1;
    h += '</div><div class="fd-achse">' + liste.map((p, i) => '<span' + (p.von===aktiv ? ' class="an"' : '') + '>' +
      ((i % jede===0 || p.von===aktiv) ? (st.modus==='monat' ? MON[D(p.von).getUTCMonth()] : tm(p.von)) : '') + '</span>').join('') + '</div>';
    return h;
  }
  function herkunftKurz(x){ return x.soll_herkunft==='Vorgabe Therapeutin' ? 'Praxis' : x.soll_herkunft==='Ziel im Profil' ? 'App' : istModell(x) ? 'DGE-Rechenmodell' : /DGE/.test(x.soll_herkunft||'') ? 'DGE' : (x.soll_herkunft||''); }
  /* Gemüse 245 g und Obst 300 g sind Modellwerte der DGE-Berechnung (Schäfer 2024), keine eigene DGE-Empfehlung (Prüfer 11.11.) */
  function istModell(x){ return /Modellwert/i.test((x && x.hinweis) || '') || /Schäfer/i.test((x && x.quelle) || ''); }

  function profilKarte(d){
    const p = d.profil || {};
    const chips = [];
    if(p.alter) chips.push(p.alter + ' Jahre');
    if(p.geschlecht) chips.push(p.geschlecht);
    if(p.groesse_cm) chips.push(z(p.groesse_cm) + ' cm');
    if(p.gewicht_kg) chips.push(z(p.gewicht_kg,1) + ' kg');
    if(p.ernaehrungsform) chips.push(p.ernaehrungsform);
    (p.unvertraeglichkeiten||[]).forEach(u => chips.push('ohne ' + u));
    if(p.diabetes_typ) chips.push('Diabetes ' + String(p.diabetes_typ).replace('typ','Typ '));
    const ziele = [p.ziel_kcal && z(p.ziel_kcal) + ' kcal', p.ziel_protein && z(p.ziel_protein) + ' g Eiweiß', p.ziel_kh && z(p.ziel_kh) + ' g KH', p.ziel_fett && z(p.ziel_fett) + ' g Fett'].filter(Boolean);
    return '<div class="fd-karte"><h2>' + esc(p.name || 'Person') + (d.code ? ' <span class="fd-chip hell">' + esc(d.code) + '</span>' : '') + '</h2>' +
      (p.steckbrief ? '<div class="fd-klein">' + esc(p.steckbrief) + '</div>' : '') +
      '<div class="fd-profil">' + chips.map(c => '<span class="fd-chip">' + esc(c) + '</span>').join('') + '</div>' +
      (ziele.length ? '<div class="fd-klein" style="margin-top:8px">Ziele aus der App: ' + esc(ziele.join(', ')) + '</div>' : '') +
      (d.daten_ab ? '<div class="fd-klein" style="margin-top:4px">Einträge freigegeben ab ' + esc(D(d.daten_ab).toLocaleDateString('de-DE')) + '.</div>' : '') +
      '</div>';
  }

  /* Persönliche Daten gemeinsam bearbeiten (Ralph 11.11.: „zusammen mit der Patientin anlegen und bearbeiten“).
     Schreibt über cb_fp_akte_setzen nur mit Einwilligung „Bearbeiten“; jede Änderung wird protokolliert. */
  const AKTE_FELD = {geschlecht:'Geschlecht', geburtsdatum:'Geburtsdatum', groesse_cm:'Größe', gewicht_kg:'Gewicht', aktivitaet:'Aktivität',
    ernaehrungsform:'Ernährungsform', diabetes_typ:'Diabetes', unvertraeglichkeiten:'Unverträglichkeiten', ziel_text:'Ziel', sport_text:'Sport und Bewegung', notiz_text:'Notiz'};
  const DIAB = {typ1:'Typ 1', typ2:'Typ 2', praediabetes:'Prädiabetes', gestationsdiabetes:'Schwangerschaftsdiabetes', sonstiger:'Sonstiger'};
  const UNV = {laktose:'Laktose', gluten:'Gluten', krebstiere:'Krebstiere', ei:'Ei', fisch:'Fisch', erdnuss:'Erdnüsse', soja:'Soja', milch:'Milch (Milcheiweiß)',
    schalenfruechte:'Schalenfrüchte (Nüsse)', sellerie:'Sellerie', senf:'Senf', sesam:'Sesam', sulfite:'Schwefeldioxid/Sulfite', lupinen:'Lupinen', weichtiere:'Weichtiere'};
  function akteWert(f, v){
    if(v==null || v==='' || (Array.isArray(v) && !v.length)) return '–';
    if(f==='diabetes_typ') return DIAB[v] || v;
    if(f==='unvertraeglichkeiten') return v.map(x => UNV[x] || x).join(', ');
    if(f==='geburtsdatum') return D(v).toLocaleDateString('de-DE');
    if(f==='groesse_cm') return z(v) + ' cm';
    if(f==='gewicht_kg') return z(v,1) + ' kg';
    return String(v);
  }
  function akteKarte(d){
    const a = d.akte; if(!a) return '';
    const f = a.felder || {};
    const txt = (t, k) => '<div class="fd-akte-txt"><small>' + t + '</small>' + (a[k] ? esc(a[k]).replace(/\n/g, '<br>') : '<span class="fd-klein">noch nichts festgehalten</span>') + '</div>';
    let h = '<div class="fd-karte" id="fd-akte"><div class="fd-kopfzeile"><h2>Akte</h2>' +
      (a.darf_bearbeiten ? '<button class="fd-k" type="button" data-akte-auf>Gemeinsam bearbeiten</button>' : '') + '</div>' +
      '<div class="fd-akte-txte">' + txt('Ziel', 'ziel_text') + txt('Sport und Bewegung', 'sport_text') + txt('Notiz', 'notiz_text') + '</div>';
    if(!a.darf_bearbeiten) h += '<p class="fd-klein" style="margin:8px 0 0">' + esc(a.bearbeiten_hinweis || '') + '</p>';
    if(a.darf_bearbeiten){
      const sel = (k, opts, leer) => '<select data-af="' + k + '"><option value="">' + (leer || '–') + '</option>' +
        opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (f[k]===v ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>';
      const inp = (k, typ, wert, extra) => '<input data-af="' + k + '" type="' + typ + '" value="' + esc(wert==null ? '' : wert) + '"' + (extra || '') + '>';
      const unv = f.unvertraeglichkeiten || [];
      h += '<form class="fd-akte-form" data-akte-form hidden>' +
        '<p class="fd-klein" style="margin:0 0 10px">Gemeinsam mit der Person ausfüllen. Profilangaben gelten danach auch in ihrer App; jede Änderung wird mit Datum gespeichert.</p>' +
        '<div class="fd-akte-grid">' +
          '<label>Geschlecht' + sel('geschlecht', ['weiblich','männlich','divers']) + '</label>' +
          (opt.nurLesen ? '<label>Alter' + inp('alter', 'text', f.alter ? f.alter + ' Jahre' : '', ' disabled') : '<label>Geburtsdatum' + inp('geburtsdatum', 'date', f.geburtsdatum)) + '</label>' +
          '<label>Größe (cm)' + inp('groesse_cm', 'number', f.groesse_cm, ' min="50" max="250" step="1"') + '</label>' +
          '<label>Gewicht (kg)' + inp('gewicht_kg', 'number', f.gewicht_kg, ' min="20" max="400" step="0.1"') + '</label>' +
          '<label>Aktivität' + sel('aktivitaet', ['Sitzend','Leicht aktiv','Mäßig aktiv','Sehr aktiv']) + '</label>' +
          '<label>Ernährungsform' + sel('ernaehrungsform', ['Omnivor','Flexitarisch','Pescetarisch','Vegetarisch','Vegan']) + '</label>' +
          '<label>Diabetes' + sel('diabetes_typ', Object.entries(DIAB), 'Keine Angabe') + '</label>' +
        '</div>' +
        '<fieldset class="fd-akte-unv"><legend>Unverträglichkeiten und Allergien</legend>' +
          Object.entries(UNV).map(([k, t]) => '<label><input type="checkbox" data-unv value="' + k + '"' + (unv.includes(k) ? ' checked' : '') + '>' + esc(t) + '</label>').join('') +
        '</fieldset>' +
        '<label class="fd-akte-lang">Ziel<textarea data-af="ziel_text" rows="2" maxlength="2000" placeholder="z. B. bis Sommer 5 kg leichter">' + esc(a.ziel_text || '') + '</textarea></label>' +
        '<label class="fd-akte-lang">Sport und Bewegung<textarea data-af="sport_text" rows="2" maxlength="2000" placeholder="z. B. 2× Schwimmen, täglich 30 Minuten zu Fuß">' + esc(a.sport_text || '') + '</textarea></label>' +
        '<label class="fd-akte-lang">Notiz<textarea data-af="notiz_text" rows="3" maxlength="4000">' + esc(a.notiz_text || '') + '</textarea></label>' +
        '<div class="fd-akte-knoepfe"><button class="fd-k gruen" type="submit" data-akte-los' + (opt.nurLesen ? ' disabled' : '') + '>Speichern</button>' +
        '<button class="fd-k" type="button" data-akte-zu>Abbrechen</button><span class="fd-klein" data-akte-m>' + (opt.nurLesen ? 'In der Musterpraxis nur zum Ansehen.' : '') + '</span></div>' +
      '</form>';
    }
    // Nur für die Fachkraft: Diagnose-Stichworte und private Notiz (die Person sieht das nicht)
    const sw = a.stichworte || [];
    h += '<div class="fd-privat"><div class="fd-kopfzeile"><b>Nur für mich</b>' + (opt.privatSetzen ? '<button class="fd-k" type="button" data-pv-auf>Bearbeiten</button>' : '') + '</div>' +
      '<div class="fd-klein" style="margin:2px 0 6px">Sieht nur die Praxis. Planvorschläge beachten Diabetes, Laktose, Gluten, vegan und vegetarisch.</div>' +
      '<div class="fd-profil">' + (sw.length ? sw.map(x => '<span class="fd-chip sw">' + esc(x) + '</span>').join('') : '<span class="fd-klein">Noch keine Stichworte.</span>') + '</div>' +
      (a.privat_notiz ? '<div class="fd-akte-txt" style="margin-top:8px">' + esc(a.privat_notiz).replace(/\n/g, '<br>') + '</div>' : '') +
      (opt.privatSetzen ? '<form class="fd-akte-form" data-pv-form hidden>' +
        '<label>Stichworte (mit Komma trennen, höchstens 20)<input data-pv-sw list="fd-sw-liste" value="' + esc(sw.join(', ')) + '" placeholder="z. B. Diabetes Typ 2, Bluthochdruck"></label>' +
        '<datalist id="fd-sw-liste">' + ['Übergewicht','Adipositas','Diabetes Typ 1','Diabetes Typ 2','Prädiabetes','Bluthochdruck','Fettstoffwechselstörung','Gicht',
          'Reizdarm','Laktoseintoleranz','Fruktoseintoleranz','Zöliakie','Histaminintoleranz','Nierenerkrankung','Eisenmangel','Schwangerschaft','Stillzeit',
          'Essstörung','Leistungssport','Vegetarisch','Vegan','Schichtdienst'].map(x => '<option value="' + x + '">').join('') + '</datalist>' +
        '<label class="fd-akte-lang">Private Notiz<textarea data-pv-notiz rows="4" maxlength="8000">' + esc(a.privat_notiz || '') + '</textarea></label>' +
        '<div class="fd-akte-knoepfe"><button class="fd-k gruen" type="submit">Speichern</button><button class="fd-k" type="button" data-pv-zu>Abbrechen</button><span class="fd-klein" data-pv-m></span></div>' +
      '</form>' : '') + '</div>';
    const pr = a.protokoll || [];
    if(pr.length) h += '<details class="fd-akte-prot"><summary>Änderungen (' + pr.length + ')</summary><table class="fd-ziele"><tbody>' +
      pr.map(x => '<tr><td>' + esc(D(String(x.am).slice(0,10)).toLocaleDateString('de-DE')) + '</td><td>' + esc(AKTE_FELD[x.feld] || x.feld) + '</td><td>' +
        esc(akteWert(x.feld, x.alt)) + ' → ' + esc(akteWert(x.feld, x.neu)) + '</td></tr>').join('') + '</tbody></table></details>';
    return h + '</div>';
  }
  function akteBinde(){
    const pf = $in.querySelector('[data-pv-form]'), pa = $in.querySelector('[data-pv-auf]');
    if(pf && pa){
      pa.onclick = () => { pf.hidden = !pf.hidden; pa.textContent = pf.hidden ? 'Bearbeiten' : 'Schließen'; };
      pf.querySelector('[data-pv-zu]').onclick = () => { pf.hidden = true; pa.textContent = 'Bearbeiten'; };
      pf.onsubmit = async ev => {
        ev.preventDefault();
        const m = t => { pf.querySelector('[data-pv-m]').textContent = t; };
        const sw = pf.querySelector('[data-pv-sw]').value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
        if(sw.length > 20) return m('Höchstens 20 Stichworte.');
        m('⏳ Speichert …');
        try{ const r = await opt.privatSetzen(pf.querySelector('[data-pv-notiz]').value, sw); if(r && r.ok === false) return m(r.grund || 'Ging nicht.'); m('✓ Gespeichert.'); setTimeout(laden, 500); }
        catch(e){ m(e.message || String(e)); }
      };
    }
    const form = $in.querySelector('[data-akte-form]'); if(!form) return;
    const a = st.daten.akte || {}, f = a.felder || {};
    const auf = $in.querySelector('[data-akte-auf]');
    if(auf) auf.onclick = () => { form.hidden = !form.hidden; auf.textContent = form.hidden ? 'Gemeinsam bearbeiten' : 'Bearbeiten schließen'; };
    const zu = form.querySelector('[data-akte-zu]'); if(zu) zu.onclick = () => { form.hidden = true; if(auf) auf.textContent = 'Gemeinsam bearbeiten'; };
    const m = t => { const x = form.querySelector('[data-akte-m]'); if(x) x.textContent = t; };
    form.onsubmit = async ev => {
      ev.preventDefault();
      if(opt.nurLesen) return m('In der Musterpraxis nur zum Ansehen.');
      const neu = {}, gleich = (x, y) => String(x==null ? '' : x) === String(y==null ? '' : y);
      form.querySelectorAll('[data-af]').forEach(i => {
        const k = i.dataset.af, v = i.value.trim();
        const alt = ['ziel_text','sport_text','notiz_text'].includes(k) ? a[k] : f[k];
        if(['groesse_cm','gewicht_kg'].includes(k) ? !(v==='' && alt==null) && Number(v) !== Number(alt) : !gleich(v, alt)) neu[k] = v;
      });
      const unv = [...form.querySelectorAll('[data-unv]:checked')].map(x => x.value).sort();
      if(unv.join() !== [...(f.unvertraeglichkeiten || [])].sort().join()) neu.unvertraeglichkeiten = unv;
      if(!Object.keys(neu).length) return m('Nichts geändert.');
      const b = form.querySelector('[data-akte-los]'); b.disabled = true; m('⏳ Speichert …');
      try{ const r = await opt.akteSetzen(neu); m('✓ Gespeichert (' + (r && r.geaendert) + ' Änderungen).'); setTimeout(laden, 700); }
      catch(e){ b.disabled = false; m(e.message || String(e)); }
    };
  }

  function balken(tage, teile, linie, linieText){
    let max = 0;
    tage.forEach(t => { const s = teile(t).reduce((a, x) => a + (Number(x[0])||0), 0); if(s > max) max = s; });
    if(linie && linie > max) max = linie;
    max = max * 1.08 || 1;
    let h = '<div class="fd-balken">';
    tage.forEach(t => {
      if(t.leer){ h += '<div class="s leer" data-tag="' + t.datum + '" title="' + esc(lang(t.datum)) + ': nichts eingetragen"></div>'; return; }
      const tt = teile(t);
      h += '<div class="s" data-tag="' + t.datum + '" title="' + esc(lang(t.datum) + ': ' + tt.map(x => z(x[0])).join(' + ')) + '">' +
        tt.map(x => '<div class="t" style="height:' + (100 * (Number(x[0])||0) / max).toFixed(1) + '%;background:' + x[1] + '"></div>').join('') + '</div>';
    });
    if(linie) h += '<div class="fd-linie" style="bottom:' + (100 * linie / max).toFixed(1) + '%"><span>' + esc(linieText) + '</span></div>';
    h += '</div><div class="fd-achse">' + tage.map((t, i) => '<span>' + (tage.length <= 7 ? WT[D(t.datum).getUTCDay()] + ' ' + tm(t.datum) : (i % 5 === 0 || i === tage.length-1 ? tm(t.datum) : '')) + '</span>').join('') + '</div>';
    return h;
  }

  /* ---- Nährwerte als Diagramm je Tag/Woche/Monat (Ralph 12.11.), gerechnet von FL-2 ---- */
  const NW = [['protein','Eiweiß','g'],['fett','Fett','g'],['ges_fett','Gesättigte Fettsäuren','g'],['kh','Kohlenhydrate','g'],
              ['zucker','Zucker','g'],['ballaststoffe','Ballaststoffe','g'],['salz','Salz','g']];
  async function nwLaden(d){
    if(!opt.naehrwerte) return;
    const raster = st.modus, bis = st.modus==='tag' ? st.anker : heute;
    let von;
    if(raster==='tag') von = plus(st.anker, -13);
    else { const ab = d.daten_ab && d.daten_ab > '1900-01-01' ? d.daten_ab : null;
           von = ab && ab > plus(heute, -400) ? ab : plus(heute, ab ? -400 : -182);
           von = raster==='woche' ? montag(von) : monatsAnfang(von); }
    const key = (opt.verlaufKey || '') + '|' + raster + '|' + von + '|' + bis;
    if(st.nw && st.nw.key===key) return;
    const zeilen = await opt.naehrwerte(von, bis, raster);
    st.nw = {key, raster, von, bis, zeilen: zeilen || []};
  }
  function nwKarte(d, is){
    const nw = st.nw; if(!nw || nw.raster !== st.modus) return '';
    const schritt = k => nw.raster==='tag' ? plus(k, 1) : naechste(k);
    const schl = nw.raster==='tag' ? (x => x) : nw.raster==='woche' ? montag : monatsAnfang;
    const aktiv = schl(st.modus==='tag' ? st.anker : st.bereich.von);
    // Auswahl: Makros immer, Mikros nur mit Werten für mindestens die Hälfte des Gegessenen im gewählten Zeitraum
    const mikro = nw.zeilen.filter(z0 => z0.k.startsWith('mikro:') && z0.von===aktiv && Number(z0.abdeckung) >= 50 && !/Kreatin/i.test(z0.name||''));
    const wahl = [...NW.map(([k, n, e]) => ({k, n, e})), ...mikro.map(z0 => ({k: z0.k, n: z0.name || z0.k.slice(6), e: z0.einheit || ''}))];
    if(!wahl.find(w => w.k===NW_WAHL)) NW_WAHL = 'protein';
    const w = wahl.find(x => x.k===NW_WAHL);
    const m = new Map(nw.zeilen.filter(z0 => z0.k===w.k).map(z0 => [z0.von, z0]));
    const liste = []; for(let k = schl(nw.von); k <= schl(nw.bis) && liste.length < 120; k = schritt(k)){
      const z0 = m.get(k); liste.push({von: k, erfasst: z0 ? Number(z0.erfasst)||0 : 0, wert: z0 ? Number(z0.je_tag) : null, abd: z0 ? z0.abdeckung : null}); }
    // ohne bekannten Behandlungsbeginn erst ab den ersten Einträgen (wie die übrigen Diagramme)
    const ersteMit = liste.findIndex(p => p.wert!=null);
    if(!(d.daten_ab && d.daten_ab > '1900-01-01') && ersteMit > 0 && nw.raster!=='tag') liste.splice(0, ersteMit);
    const zeig = liste.slice(nw.raster==='tag' ? -14 : nw.raster==='woche' ? -16 : -12);
    const soll = is.find(x => x.kennzahl===w.k && x.einheit!=='en%');
    const i = liste.findIndex(p => p.von===aktiv), cur = liste[i], prev = i > 0 ? liste[i-1] : null;
    const vorName = nw.raster==='tag' ? 'Vortag' : nw.raster==='woche' ? 'Vorwoche' : prev ? MON_LANG[D(prev.von).getUTCMonth()] : '';
    let vg = '';
    if(cur && prev && cur.erfasst && prev.erfasst && cur.wert!=null && prev.wert!=null){
      const dlt = cur.wert - prev.wert, st0 = Math.abs(dlt) < 10 ? 1 : 0;
      vg = 'Gegenüber ' + vorName + ': ' + w.n + ' ' + (Math.abs(dlt) < 0.05 ? '±0' : (dlt > 0 ? '+' : '−') + z(Math.abs(dlt), st0)) + ' ' + w.e + ' am Tag.';
    } else if(prev && !prev.erfasst) vg = vorName + ' ohne Einträge, kein Vergleich.';
    const farbe = p => p.abd!=null && p.abd < 50 && w.k.startsWith('mikro:') ? 'var(--fd-leer-balken,#9aa7a0)' : 'var(--fd-akzent,#2e7d46)';
    const je = nw.raster==='tag' ? 'je Tag' : nw.raster==='woche' ? 'je Woche' : 'je Monat';
    return '<div class="fd-karte"><h2>Nährwerte ' + je + '</h2>' +
      '<label class="fd-nw-wahl"><span class="fd-klein">Nährwert</span> <select data-nw-wahl>' +
      wahl.map(x => '<option value="' + esc(x.k) + '"' + (x.k===w.k ? ' selected' : '') + '>' + esc(x.n) + '</option>').join('') + '</select></label>' +
      (vg ? '<div class="fd-klein">' + esc(vg) + '</div>' : '') +
      periodenBalken(zeig.map(p => Object.assign({}, p, {erfasst: p.wert==null ? 0 : p.erfasst})), p => [[p.wert, farbe(p)]],
                     soll && soll.soll, soll ? 'Soll ' + (ART[soll.art]||'') + ' ' + z(soll.soll, soll.soll < 20 ? 1 : 0) + ' ' + w.e : '', aktiv, true) +
      '<div class="fd-klein">Durchschnitt je Tag mit Einträgen' + (w.k.startsWith('mikro:') ? '. Grau: Werte für weniger als die Hälfte des Gegessenen.' : '.') + ' Schraffiert: keine Einträge.</div></div>';
  }

  function istSollKarte(d, is){
    const zeile = x => {
      const name = (KZ[x.kennzahl] ? KZ[x.kennzahl][0] : x.name) + (x.einheit==='en%' ? ' (Anteil Energie)' : '');
      const einh = x.einheit==='en%' ? '%' : x.einheit;
      const bez = x.bezug==='woche' ? ' je Woche' : ' je Tag';
      const p = x.soll ? Math.min(150, Math.max(0, x.ist_prozent_vom_soll||0)) : 0;
      const farbe = x.erfuellt==null ? 'var(--fd-leer-balken,#9aa7a0)' : x.erfuellt ? 'var(--ok,#2e7d46)' : (x.art==='hoechstens' ? 'var(--bad,#b42318)' : 'var(--warn,#e8920c)');
      const soll = x.soll==null ? '–' : (x.art==='bereich' ? z(x.soll, 1) + '–' + z(x.soll_bis, 1) : (ART[x.art]||'') + ' ' + z(x.soll, x.einheit==='en%'?0:1));
      const her = x.soll_herkunft==='Vorgabe Therapeutin' ? '<b>Vorgabe</b>' + (x.quelle ? ' · ' + esc(x.quelle) : '') + (x.hinweis ? ' · ' + esc(x.hinweis) : '')
                : x.soll_herkunft==='Ziel im Profil' ? 'Ziel aus dem Profil der Person'
                : esc(x.soll_herkunft||'') + (x.quelle_url ? ' · <a href="' + esc(x.quelle_url) + '" target="_blank" rel="noopener">' + esc(x.quelle||'Quelle') + '</a>' : x.quelle ? ' · ' + esc(x.quelle) : '');
      return '<div class="n">' + esc(name) + '<small>' + esc(soll) + ' ' + esc(einh) + bez + '</small></div>' +
        '<div class="bw"><div class="fd-bar"><div class="f" style="width:' + (p/1.5).toFixed(1) + '%;background:' + farbe + '"></div>' +
        (x.soll ? '<div class="m" style="left:' + (100/1.5).toFixed(1) + '%"></div>' : '') + '</div></div>' +
        '<div class="w">' + (x.ist==null ? '–' : z(x.ist, x.einheit==='en%'?0:1) + ' ' + esc(einh)) + '<small>' + (x.soll ? z(x.ist_prozent_vom_soll) + ' %' : '') + '</small></div>' +
        '<div class="her">' + her + (x.kennzahl.startsWith('mikro:') ? ' · <span class="' + (x.abdeckung!=null && x.abdeckung >= 50 ? '' : 'fd-wenig') + '">' +
          (x.abdeckung==null ? 'Datenlage unbekannt' : 'Werte für ' + z(x.abdeckung) + ' % der gegessenen Menge' + (x.abdeckung < 50 ? ', zu wenig für eine Aussage' : '')) + '</span>' : '') + '</div>';
    };
    const makro = ['kcal','protein','kh','fett','zucker','ballaststoffe','salz'];
    const m = is.filter(x => makro.includes(x.kennzahl)).sort((a, b) => makro.indexOf(a.kennzahl) - makro.indexOf(b.kennzahl) || (a.einheit==='en%') - (b.einheit==='en%'));
    const g = is.filter(x => x.kennzahl.startsWith('gruppe:'));
    // Vitamine und Mineralstoffe: nur echte Bedarfswerte (keine Werbeaussage-Werte wie Kreatin, EU-VO 432/2012);
    // bei wenig Daten grau statt Ampel (Prüfer 11.11.: Jod 10 von 200 µg ist meist fehlende Angabe, nicht Mangel)
    const ABD = d.mikro_abdeckung || {};
    const mi = is.filter(x => x.kennzahl.startsWith('mikro:') && !/432\/2012/.test((x.soll_herkunft||'') + (x.quelle||'')))
                 .map(x => { const a = ABD[x.kennzahl]; const y = Object.assign({}, x, {abdeckung: a==null ? null : Number(a)});
                   if(y.abdeckung==null || y.abdeckung < 50) y.erfuellt = null; return y; });
    let h = '<div class="fd-karte"><h2>Ist und Soll</h2><div class="fd-klein">Ist ist der Durchschnitt der Tage mit Einträgen' + (st.modus==='tag' ? '' : ' (' + (d.tage_erfasst||0) + ' Tage)') +
      '. Das Soll kommt von der Praxis, aus der App oder von der DGE. Der Strich markiert 100 %.</div>' +
      '<h3>Kalorien und Makros</h3><div class="fd-is">' + m.map(zeile).join('') + '</div>' +
      '<h3>Lebensmittelgruppen</h3><div class="fd-is">' + g.map(zeile).join('') + '</div>' +
      '<div class="fd-hinweis">Die DGE-Werte sind Orientierungswerte für gesunde Erwachsene. Laut DGE eignen sie sich nicht, den Verzehr einzelner Personen zu bewerten. Darum zeigen wir sie zum Vergleich, nicht als Note.</div>';
    if(mi.length) h += '<details style="margin-top:12px"><summary>Vitamine und Mineralstoffe (' + mi.length + ')</summary>' +
      '<div class="fd-klein" style="margin-top:6px">Viele Etiketten nennen keine Vitamine und Mineralstoffe, Jodsalz und Leitungswasser fehlen meist im Tagebuch. Darum steht bei jedem Wert, für wie viel der gegessenen Menge Angaben vorliegen; unter 50 % bleibt der Balken grau.</div>' +
      '<div class="fd-is" style="margin-top:8px">' + mi.map(zeile).join('') + '</div></details>';
    else if(d.muster) h += '<div class="fd-bald">Vitamine und Mineralstoffe: in echten Konten sichtbar, in der Musterpraxis ausgeblendet.</div>';
    return h + '</div>';
  }

  function tellerKarte(d){
    const zu = {}; TELLER_SEG.forEach(x => x.gruppen.forEach(g => zu[g] = x.k));
    const seg = TELLER_SEG.map(x => ({k:x.k, n:x.n, col:x.col, g:0, teile:[]}));
    const aus = []; let ausG = 0;
    (d.gruppen||[]).forEach(r => {
      const g = Number(r.gramm)||0; if(!(g > 0)) return;
      const k = zu[r.gruppe];
      if(k){ const x = seg.find(y => y.k===k); x.g += g; x.teile.push(r.name + ' ' + z(g) + ' g'); }
      else { aus.push(r.name + ' ' + z(g) + ' g'); ausG += g; }
    });
    const sum = seg.reduce((a, x) => a + x.g, 0);
    if(!(sum > 0)) return '';
    seg.forEach(x => x.p = x.g / sum * 100);
    let a = 0, svg = '';
    const pt = t => (60 + 56*Math.sin(t*2*Math.PI)).toFixed(2) + ',' + (60 - 56*Math.cos(t*2*Math.PI)).toFixed(2);
    seg.forEach(x => {
      const b = x.p/100; if(!(b > 0)) return;
      if(b >= 0.9999){ svg += '<circle cx="60" cy="60" r="56" fill="' + x.col + '"/>'; a += b; return; }
      svg += '<path d="M60,60 L' + pt(a) + ' A56,56 0 ' + (b > 0.5 ? 1 : 0) + ' 1 ' + pt(a+b) + ' Z" fill="' + x.col + '" stroke="#fff" stroke-width="1.5"/>';
      if(b > 0.07){ const m = a + b/2; svg += '<text x="' + (60 + 33.6*Math.sin(m*2*Math.PI)).toFixed(1) + '" y="' + (64 - 33.6*Math.cos(m*2*Math.PI)).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">' + Math.round(x.p) + '%</text>'; }
      a += b;
    });
    return '<div class="fd-karte"><h2>Teller</h2><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      '<svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label="Teller nach Gramm">' + svg + '</svg>' +
      '<div style="flex:1;min-width:200px;font-size:15px"><b>' + Math.round(seg[0].p) + ' %</b> Gemüse und Obst, <b>' + Math.round(seg[1].p) + ' %</b> Eiweiß, <b>' + Math.round(seg[2].p) + ' %</b> Kohlenhydrate' +
      '<div class="fd-klein">nach Gramm, ' + z(sum) + ' g auf dem Teller' + (st.modus==='tag' ? '' : ', an ' + (d.tage_erfasst||0) + ' von ' + (d.tage||[]).length + ' Tagen erfasst') + '</div></div></div>' +
      seg.map(x => '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;font-weight:800"><span>' + x.n + '</span><span>' + Math.round(x.p) + ' % <span class="fd-klein">· ' + z(x.g) + ' g</span></span></div>' +
        '<div class="fd-bar" style="margin-top:4px"><div class="f" style="width:' + Math.min(100, x.p).toFixed(1) + '%;background:' + x.col + '"></div><div class="m" style="left:' + TELLER_FET[x.k] + '%" title="FET etwa ' + TELLER_FET[x.k] + ' %"></div></div>' +
        '<div class="fd-klein" style="display:flex;justify-content:space-between;gap:8px;margin-top:3px"><span>' + esc(x.teile.join(', ') || 'nichts erfasst') + '</span><span style="white-space:nowrap">FET ~' + TELLER_FET[x.k] + ' %</span></div></div>').join('') +
      '<div class="fd-klein" style="margin-top:12px;padding-top:8px;border-top:1px dashed var(--fd-linie)">' + (aus.length ? '<b>Außerhalb des Tellers: ' + z(ausG) + ' g</b> – ' + esc(aus.join(', ')) + '. Nicht in der Torte.' : 'Außerhalb des Tellers: nichts.') + '</div>' +
      '<div class="fd-klein" style="margin-top:8px">Strich = <a href="https://fet-ev.eu/tellermodell/" target="_blank" rel="noopener">FET-Tellermodell</a> (etwa ½ Gemüse und Obst, ¼ Eiweiß, ¼ Kohlenhydrate) – Orientierung je Mahlzeit, nach Tellerfläche gedacht, nicht nach Gramm.</div></div>';
  }

  function produkteKarte(d){
    const p = (d.produkte||[]).slice();
    if(!p.length) return '';
    if(st.prodSort==='score') p.sort((a, b) => (a.score==null) - (b.score==null) || (a.score||0) - (b.score||0));
    const zeig = st.prodAlle ? p : p.slice(0, 25);
    return '<div class="fd-karte"><h2>Gegessene Produkte</h2><div class="fd-klein">' + p.length + ' verschiedene Produkte mit Root-Index-Score.</div>' +
      '<div class="fd-tab" data-sort><button data-s="menge" class="' + (st.prodSort==='menge'?'an':'') + '" type="button">Meiste Menge</button>' +
      '<button data-s="score" class="' + (st.prodSort==='score'?'an':'') + '" type="button">Niedrigster Score zuerst</button></div>' +
      '<table><thead><tr><th>Produkt</th><th class="z">Menge</th><th class="z">' + (st.modus==='tag' ? 'mal' : 'Tage') + '</th><th class="z">Score</th></tr></thead><tbody>' +
      zeig.map(x => '<tr><td>' + esc(x.name) + (x.marke && x.marke!=='Generisch' ? '<div class="fd-klein">' + esc(x.marke) + '</div>' : '') + '</td><td class="z">' + z(x.gramm) + ' g</td>' +
        '<td class="z">' + (st.modus==='tag' ? x.mal : x.tage) + '</td><td class="z">' + scoreBadge(x.score, x.bewertung) + '</td></tr>').join('') +
      '</tbody></table>' + (p.length > 25 && !st.prodAlle ? '<button class="fd-k" data-alle type="button" style="margin-top:8px">Alle ' + p.length + ' zeigen</button>' : '') + '</div>';
  }

  function tagebuchKarte(d){
    const e = d.eintraege || [];
    let h = '<div class="fd-karte"><h2>Tagebuch</h2>';
    MAHLZEITEN.forEach(mz => {
      const x = e.filter(y => y.mahlzeit===mz);
      if(!x.length) return;
      // Rezept-Zutaten zusammenfassen
      const zeilen = []; const rez = {};
      x.forEach(y => {
        if(y.rezept_id){ if(!rez[y.rezept_id]){ rez[y.rezept_id] = {rezept:y.rezept, zut:[]}; zeilen.push(rez[y.rezept_id]); } rez[y.rezept_id].zut.push(y); }
        else zeilen.push(y);
      });
      h += '<div class="fd-mz"><h4>' + esc(mz) + ' · ' + z(x.reduce((a, y) => a + (Number(y.kcal)||0), 0)) + ' kcal</h4><table><tbody>' +
        zeilen.map(y => y.zut ? '<tr><td colspan="4"><b>Rezept: ' + esc(y.rezept||'') + '</b><div class="fd-klein">' +
             y.zut.map(q => esc(q.name) + ' ' + z(q.menge_g) + ' g').join(' · ') + '</div></td></tr>' +
             '<tr><td></td><td class="z">' + z(y.zut.reduce((a, q) => a + Number(q.menge_g||0), 0)) + ' g</td><td class="z">' + z(y.zut.reduce((a, q) => a + Number(q.kcal||0), 0)) + ' kcal</td><td></td></tr>'
          : '<tr><td>' + esc(y.name) + (y.marke && y.marke!=='Generisch' ? '<div class="fd-klein">' + esc(y.marke) + '</div>' : '') + '</td><td class="z">' + z(y.menge_g) + ' g</td><td class="z">' + z(y.kcal) + ' kcal</td><td class="z">' + scoreBadge(y.score, y.bewertung) + '</td></tr>').join('') +
        '</tbody></table></div>';
    });
    return h + '</div>';
  }

  /* Ziele der Person: vorbelegt aus Profil (Rechner der App) bzw. DGE-Orientierung, korrigierbar durch die Fachperson.
     Grundlage ist das Ist-Soll des Servers (Vorrang: Vorgabe > Profilziel > Richtwert). */
  const ZIELE = [['kcal','Kalorien','kcal'], ['protein','Eiweiß','g'], ['kh','Kohlenhydrate','g'], ['fett','Fett','g'],
                 ['ballaststoffe','Ballaststoffe','g'], ['zucker','Zucker','g'], ['salz','Salz','g'],
                 ['gruppe:gemuese','Gemüse','g'], ['gruppe:obst','Obst','g'], ['gruppe:gemuese+obst','Obst und Gemüse','g']];
  const HERKUNFT = x => !x || x.soll==null ? ['kein Ziel', 'leer'] : x.soll_herkunft==='Vorgabe Therapeutin' ? ['Praxis', 'vorgabe']
                     : x.soll_herkunft==='Ziel im Profil' ? ['App', 'profil'] : [istModell(x) ? 'DGE-Rechenmodell' : /DGE/.test(x.soll_herkunft||'') ? 'DGE' : (x.soll_herkunft||'Richtwert'), 'dge'];
  function zieleKarte(d){
    const is = d.ist_soll || [];
    const zeilen = ZIELE.map(z0 => {
      const k = z0[0], x = is.find(y => y.kennzahl===k && y.einheit!=='en%'), her = HERKUNFT(x);
      const soll = x && x.soll!=null ? Number(x.soll) : null, woche = x && x.bezug==='woche';
      const ist = x && x.ist!=null ? z(x.ist, 0) + ' ' + z0[2] : '–';
      const cls = !x || x.erfuellt==null ? '' : x.erfuellt ? 'ja' : (x.art==='hoechstens' ? 'ueber' : 'nein');
      const sollTxt = soll==null ? '–' : (ART[x.art]||'') + ' ' + z(soll, 0) + ' ' + z0[2] + (woche ? ' je Woche' : '');
      const edit = opt.nurLesen ? '' :
        '<span class="fd-ziel-edit"><select data-z-art="' + k + '" aria-label="Art"><option value="mindestens"' + (x && x.art==='mindestens' ? ' selected' : '') + '>mind.</option>' +
        '<option value="etwa"' + (x && x.art==='etwa' ? ' selected' : '') + '>etwa</option><option value="hoechstens"' + (x && x.art==='hoechstens' ? ' selected' : '') + '>höchstens</option></select>' +
        '<input type="number" min="1" step="1" inputmode="decimal" data-z-wert="' + k + '" value="' + (soll!=null && !woche ? Math.round(soll) : '') + '" aria-label="Ziel ' + esc(z0[1]) + ' in ' + z0[2] + ' je Tag">' +
        '<button class="fd-k gruen" type="button" data-z-los="' + k + '">Übernehmen</button>' +
        (her[1]==='vorgabe' ? '<button class="fd-k" type="button" data-z-weg="' + k + '" title="Zurück auf Profil bzw. DGE">Zurücksetzen</button>' : '') + '</span>';
      return '<tr><td><b>' + esc(z0[1]) + '</b><br><span class="fd-her ' + her[1] + '">' + esc(her[0]) + '</span>' + (x && x.hinweis && her[1]==='vorgabe' ? '<div class="fd-klein">' + esc(x.hinweis) + '</div>' : '') + '</td>' +
        '<td class="z">' + esc(sollTxt) + '</td><td class="z"><span class="fd-ist ' + cls + '">' + ist + '</span></td>' +
        (opt.nurLesen ? '' : '<td class="z"><button class="fd-k" type="button" data-z-auf="' + k + '">Ändern</button></td>') + '</tr>' +
        (opt.nurLesen ? '' : '<tr class="fd-ziel-zeile" data-z-zeile="' + k + '" hidden><td colspan="4">' + edit + '</td></tr>');
    }).join('');
    return '<div class="fd-karte"><h2>Ziele</h2><div class="fd-klein">Die Ziele kommen aus der App oder von der DGE. ' +
      (opt.nurLesen ? 'In der Musterpraxis nur zum Ansehen.' : 'Eine Änderung gilt ab heute.') + '</div>' +
      '<div style="overflow-x:auto;margin-top:8px"><table class="fd-ziele"><thead><tr><th>Ziel und Herkunft</th><th class="z">Soll je Tag</th><th class="z">Ist Ø</th>' + (opt.nurLesen ? '' : '<th></th>') + '</tr></thead><tbody>' + zeilen + '</tbody></table></div>' +
      '<div class="fd-klein" data-z-m style="margin-top:6px"></div></div>';
  }

  function vorgabenKarte(d){
    const v = d.vorgaben || [];
    const txt = x => (KZ[x.kennzahl] ? KZ[x.kennzahl][0] : x.kennzahl) + ' ' + (ART[x.art]||'') + ' ' + z(x.wert, 1) + ' ' + (x.einheit==='g/kg' ? 'g je kg Körpergewicht' : x.einheit) + ' je Tag';
    let h = '<div class="fd-karte"><h2>Vorgaben</h2><div class="fd-klein">Eine Vorgabe ersetzt im Ist-Soll das Profilziel und den DGE-Richtwert.</div>';
    h += v.length ? '<table style="margin-top:6px"><tbody>' + v.map(x => '<tr><td><b>' + esc(txt(x)) + '</b>' + (x.notiz ? '<div class="fd-klein">' + esc(x.notiz) + '</div>' : '') + '</td>' +
          (opt.nurLesen ? '' : '<td class="z"><button class="fd-k" data-vg-weg="' + esc(x.kennzahl) + '" type="button">Entfernen</button></td>') + '</tr>').join('') + '</tbody></table>'
       : '<p class="fd-klein">Noch keine Vorgaben.</p>';
    if(opt.nurLesen){
      h += '<div class="fd-bald">In der Musterpraxis nur zum Ansehen. Im eigenen Konto lassen sich hier Kalorien, Eiweiß, Kohlenhydrate, Fett, Zucker, Ballaststoffe, Salz, Gemüse und Obst je Person einstellen.</div>';
    } else {
      h += '<div class="fd-vg-form"><select data-vg-k>' + Object.keys(KZ).map(k => '<option value="' + k + '">' + KZ[k][0] + ' (' + KZ[k][1] + ')</option>').join('') + '</select>' +
           '<select data-vg-a><option value="">Art: Standard</option><option value="mindestens">mindestens</option><option value="etwa">etwa (±10 %)</option><option value="hoechstens">höchstens</option></select>' +
           '<input type="number" min="1" step="1" placeholder="Wert" data-vg-w><input type="text" maxlength="200" placeholder="Notiz (optional)" data-vg-n>' +
           '<button class="fd-k gruen" data-vg-los type="button">Speichern</button></div><div class="fd-klein" data-vg-m style="margin-top:6px"></div>';
    }
    return h + '</div>';
  }

  function rezepteKarte(d){
    const r = d.rezepte || [], g = d.rezepte_gegessen || [];
    let h = '<div class="fd-karte"><h2>Rezepte</h2>';
    if(g.length) h += '<div class="fd-klein" style="margin-bottom:6px">Im Zeitraum gekocht: ' + g.map(x => esc(x.name) + ' (' + x.mal + '×)').join(' · ') + '</div>';
    h += r.length ? r.map(x => '<div class="fd-rez">' + (x.bild ? '<img src="' + esc(x.bild) + '" alt="" loading="lazy">' : '<div class="ph"></div>') +
          '<div style="flex:1"><b>' + esc(x.name) + '</b><div class="fd-klein">' + [x.kcal_portion && z(x.kcal_portion) + ' kcal je Portion', x.protein_portion && z(x.protein_portion,1) + ' g Eiweiß', x.mahlzeit].filter(Boolean).map(esc).join(' · ') + '</div></div>' +
          '<span class="fd-chip ' + (x.herkunft==='empfohlen' ? 'dunkel' : '') + '">' + (x.herkunft==='empfohlen' ? 'empfohlen' : x.herkunft==='gespeichert' ? 'gespeichert' : 'eigenes Rezept') + '</span></div>').join('')
       : '<p class="fd-klein">Keine eigenen Rezepte.</p>';
    return h + '</div>';
  }

  /* Wochenplanung: je Tag feste Plätze wie im Tagebuch der App (Ralph 12.11.2026: „ein Snack“), leere Plätze dezent. */
  const SLOTS = ['Frühstück','Mittag','Abendessen','Snack'];
  const slotVon = y => SLOTS.includes(y.slot) ? y.slot : 'Snack';
  function planKarte(d){
    if(!d.wochenplan) return '<div class="fd-karte"><h2>Wochenplanung</h2><p class="fd-klein">' + esc(d.wochenplan_hinweis || 'Kein Wochenplan.') + '</p></div>';
    const von = d.wochenplan_von || montag(heute);
    const plaetze = SLOTS;
    const kurz = {'Frühstück':'Frühstück','Mittag':'Mittag','Abendessen':'Abend','Snack':'Snack'};
    let h = '<div class="fd-karte"><h2>Wochenplanung</h2><div class="fd-klein">Was für diese und nächste Woche geplant ist, je Tag mit allen Mahlzeiten und dem Snack.</div>';
    for(let w = 0; w < 2; w++){
      h += '<h3>' + (w ? 'Nächste Woche' : 'Diese Woche') + '</h3><div class="fd-plan">';
      for(let i = 0; i < 7; i++){
        const t = plus(von, w*7 + i), e = d.wochenplan.filter(x => x.datum===t);
        const kcal = e.reduce((a, x) => a + (Number(x.kcal_portion)||0), 0);
        h += '<div class="tag' + (t===heute ? ' heute' : '') + '"><b>' + WT[D(t).getUTCDay()] + ' ' + tm(t) + (kcal ? '<span class="fd-plan-kcal">' + z(kcal) + ' kcal</span>' : '') + '</b>' +
             plaetze.map(sl => { const x = e.filter(y => slotVon(y)===sl);
               return x.length ? x.map(y => '<div class="e"><small>' + esc(kurz[sl]) + '</small>' + esc(y.titel||'') + (y.kcal_portion ? '<small>' + z(y.kcal_portion) + ' kcal</small>' : '') + '</div>').join('')
                               : '<div class="e leer"><small>' + esc(kurz[sl]) + '</small>–</div>'; }).join('') + '</div>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  function binde(){
    akteBinde();
    $in.querySelectorAll('[data-z-auf]').forEach(b => b.onclick = () => {
      const z = $in.querySelector('[data-z-zeile="' + b.dataset.zAuf + '"]'); z.hidden = !z.hidden;
      if(!z.hidden){ const i = z.querySelector('input'); if(i) i.focus(); }
    });
    const zm = t => { const m = $in.querySelector('[data-z-m]'); if(m) m.textContent = t; };
    $in.querySelectorAll('[data-z-los]').forEach(b => b.onclick = async () => {
      const k = b.dataset.zLos, w = Number(String($in.querySelector('[data-z-wert="' + k + '"]').value).replace(',', '.')), a = $in.querySelector('[data-z-art="' + k + '"]').value;
      if(!(w > 0)) return zm('Bitte einen Wert eintragen.');
      b.disabled = true; zm('⏳ …');
      try{ const r = await opt.vorgabeSetzen(k, w, a, null); if(r && r.ok === false){ b.disabled = false; return zm(r.grund || 'Ging nicht.'); } laden(); }
      catch(e){ b.disabled = false; zm(e.message || String(e)); }
    });
    $in.querySelectorAll('[data-z-weg]').forEach(b => b.onclick = async () => {
      if(!confirm('Vorgabe der Praxis entfernen? Ab heute gilt wieder das Ziel aus der App oder der DGE.')) return;
      b.disabled = true;
      try{ await opt.vorgabeSetzen(b.dataset.zWeg, null, null, null); laden(); } catch(e){ b.disabled = false; zm(e.message || String(e)); }
    });
    $in.querySelectorAll('.fd-balken .s[data-tag]').forEach(s => s.onclick = () => { st.modus = 'tag'; st.anker = s.dataset.tag; laden(); });
    $in.querySelectorAll('.fd-balken .s[data-per]').forEach(s => s.onclick = () => { st.anker = s.dataset.per; laden(); });
    const nwS = $in.querySelector('[data-nw-wahl]'); if(nwS) nwS.onchange = () => { NW_WAHL = nwS.value; zeichne(); };
    $in.querySelectorAll('[data-sort] button').forEach(b => b.onclick = () => { st.prodSort = b.dataset.s; zeichne(); });
    const alle = $in.querySelector('[data-alle]'); if(alle) alle.onclick = () => { st.prodAlle = true; zeichne(); };
    const los = $in.querySelector('[data-vg-los]');
    const msg = t => { const m = $in.querySelector('[data-vg-m]'); if(m) m.textContent = t; };
    if(los) los.onclick = async () => {
      const k = $in.querySelector('[data-vg-k]').value, a = $in.querySelector('[data-vg-a]').value || null;
      const w = Number(String($in.querySelector('[data-vg-w]').value).replace(',', '.')), n = $in.querySelector('[data-vg-n]').value;
      if(!(w > 0)) return msg('Bitte einen Wert eintragen.');
      los.disabled = true; msg('⏳ …');
      try{ const r = await opt.vorgabeSetzen(k, w, a, n); if(r && r.ok === false) { los.disabled = false; return msg(r.grund || 'Ging nicht.'); } laden(); }
      catch(e){ los.disabled = false; msg(e.message || String(e)); }
    };
    $in.querySelectorAll('[data-vg-weg]').forEach(b => b.onclick = async () => {
      if(!confirm('Vorgabe entfernen? Ab heute gilt wieder Profilziel bzw. Richtwert.')) return;
      b.disabled = true;
      try{ await opt.vorgabeSetzen(b.dataset.vgWeg, null, null, null); laden(); } catch(e){ b.disabled = false; alert(e.message || e); }
    });
  }
  laden();
  return { neu: laden };
}
window.FLDash = { mount };
})();
