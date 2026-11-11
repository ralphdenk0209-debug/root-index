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
.fd details summary{cursor:pointer;font-weight:800;color:var(--fd-dunkel);font-size:15px}
.fd .fd-laden{color:var(--fd-muted);padding:30px 0;text-align:center}
.fd .fd-bald{border:1px dashed #b7c4b9;border-radius:12px;padding:10px 12px;font-size:14px;color:var(--fd-muted);margin-top:10px}
@media (max-width:560px){ .fd .fd-modus{order:0} .fd .fd-pfeil[data-p="-1"]{order:1} .fd .fd-pfeil[data-p="1"]{order:2} .fd .fd-label{order:3;flex-basis:100%} .fd .fd-plan{grid-template-columns:repeat(2,1fr)} .fd .fd-is{grid-template-columns:1fr auto} .fd .fd-is .bw{grid-column:1/-1} }
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
      const d = await opt.laden(b.von, bis);
      if(nr !== st.reqNr) return;
      st.daten = d; st.bereich = {von:b.von, bis:b.bis};
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
    let h = '';
    h += profilKarte(d);
    if(!n){
      h += '<div class="fd-karte"><b>Keine Einträge in diesem Zeitraum.</b><p class="fd-klein" style="margin:4px 0 0">' +
           (st.modus==='tag' ? 'An diesem Tag wurde nichts eingetragen.' : 'Mit den Pfeilen oben zurückblättern.') + '</p></div>';
      h += vorgabenKarte(d) + rezepteKarte(d) + planKarte(d);
      $in.innerHTML = h; binde(); return;
    }
    // Kacheln
    const kcal = isK('kcal'), gem = isK('gruppe:gemuese'), go = isK('gruppe:gemuese+obst'), obst = isK('gruppe:obst');
    const proTag = (x) => n ? x / n : null;
    const grJeTag = g => { const r = (d.gruppen||[]).find(x => x.gruppe===g); return r ? r.gramm_je_tag : 0; };
    h += '<div class="fd-karte"><div class="fd-kacheln">' +
      kachel(z(kcal ? kcal.ist : proTag(d.summe.kcal)), 'kcal Ø je Tag', kcal && kcal.soll ? 'Soll ' + (ART[kcal.art]||'') + ' ' + z(kcal.soll) + ' · ' + herkunftKurz(kcal) : '') +
      kachel(z(grJeTag('gemuese')) + ' g', 'Gemüse Ø je Tag', gem && gem.soll ? 'Soll ' + (ART[gem.art]||'') + ' ' + z(gem.soll) + ' g · ' + herkunftKurz(gem) : '') +
      kachel(z(grJeTag('obst')) + ' g', 'Obst Ø je Tag', go && go.soll ? 'Obst+Gemüse: ' + z(go.ist) + ' von ' + z(go.soll) + ' g' : (obst && obst.soll ? 'Orientierung ' + z(obst.soll) + ' g' : '')) +
      kachel(d.summe.score==null ? '–' : z(d.summe.score), 'Root-Index-Score Ø', 'nach Menge gewichtet') +
      kachel(n + ' / ' + nTage, 'Tage erfasst', st.modus==='tag' ? '' : 'Ø-Werte je erfasstem Tag') +
    '</div></div>';
    if(opt.verlauf) h += '<div class="fd-verlauf"></div>';

    if(st.modus!=='tag'){
      h += '<div class="fd-karte"><h2>Kalorien je Tag</h2>' + balken(tage, t => [[t.kcal, '#2e7d46']], kcal && kcal.soll, 'Soll ' + z(kcal && kcal.soll)) +
           '<div class="fd-klein">Auf einen Tag tippen öffnet die Tagesansicht. Schraffiert = nichts eingetragen.</div></div>';
      const linie = go && go.soll ? go.soll : null;
      h += '<div class="fd-karte"><h2>Gemüse und Obst je Tag</h2>' +
           balken(tage, t => [[t.gemuese_g, 'var(--fd-gemuese)'], [t.obst_g, 'var(--fd-obst)']], linie, (go && go.soll_herkunft==='Vorgabe Therapeutin' ? 'Vorgabe ' : 'DGE ') + z(linie) + ' g') +
           '<div class="fd-legende"><span><i style="background:var(--fd-gemuese)"></i>Gemüse &amp; Pilze</span><span><i style="background:var(--fd-obst)"></i>Obst</span>' +
           (linie ? '<span>- - Obst und Gemüse zusammen</span>' : '') + '</div></div>';
    } else {
      h += tagebuchKarte(d);
    }
    h += tellerKarte(d);
    h += istSollKarte(d, is);
    h += produkteKarte(d);
    if(st.modus!=='tag' && n) h += '';
    h += vorgabenKarte(d) + rezepteKarte(d) + planKarte(d);
    $in.innerHTML = h;
    binde();
    const v = $in.querySelector('.fd-verlauf');
    if(v && window.FLStat) FLStat.verlauf(v, opt.verlauf, heute, opt.verlaufKey);
  }
  function kachel(w, t, u){ return '<div class="fd-kachel"><b>' + w + '</b><span>' + esc(t) + '</span>' + (u ? '<i>' + esc(u) + '</i>' : '') + '</div>'; }
  function herkunftKurz(x){ return x.soll_herkunft==='Vorgabe Therapeutin' ? 'Vorgabe' : x.soll_herkunft==='Ziel im Profil' ? 'Profilziel' : /DGE/.test(x.soll_herkunft||'') ? 'DGE-Orientierung' : (x.soll_herkunft||''); }

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
    return '<div class="fd-karte"><h2>' + esc(p.name || 'Klient/in') + (d.code ? ' <span class="fd-chip hell">' + esc(d.code) + '</span>' : '') + '</h2>' +
      (p.steckbrief ? '<div class="fd-klein">' + esc(p.steckbrief) + '</div>' : '') +
      '<div class="fd-profil">' + chips.map(c => '<span class="fd-chip">' + esc(c) + '</span>').join('') + '</div>' +
      (ziele.length ? '<div class="fd-klein" style="margin-top:8px">Eigene Ziele im Profil: ' + esc(ziele.join(' · ')) + '</div>' : '') +
      (d.daten_ab ? '<div class="fd-klein" style="margin-top:4px">Einträge freigegeben ab ' + esc(D(d.daten_ab).toLocaleDateString('de-DE')) + '.</div>' : '') +
      '</div>';
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

  function istSollKarte(d, is){
    const zeile = x => {
      const name = (KZ[x.kennzahl] ? KZ[x.kennzahl][0] : x.name) + (x.einheit==='en%' ? ' (Anteil Energie)' : '');
      const einh = x.einheit==='en%' ? '%' : x.einheit;
      const bez = x.bezug==='woche' ? ' je Woche' : ' je Tag';
      const p = x.soll ? Math.min(150, Math.max(0, x.ist_prozent_vom_soll||0)) : 0;
      const farbe = x.erfuellt==null ? '#9aa7a0' : x.erfuellt ? '#2e7d46' : (x.art==='hoechstens' ? '#b42318' : '#e8920c');
      const soll = x.soll==null ? '–' : (x.art==='bereich' ? z(x.soll, 1) + '–' + z(x.soll_bis, 1) : (ART[x.art]||'') + ' ' + z(x.soll, x.einheit==='en%'?0:1));
      const her = x.soll_herkunft==='Vorgabe Therapeutin' ? '<b>Vorgabe</b>' + (x.quelle ? ' · ' + esc(x.quelle) : '') + (x.hinweis ? ' · ' + esc(x.hinweis) : '')
                : x.soll_herkunft==='Ziel im Profil' ? 'Ziel aus dem Profil der Person'
                : esc(x.soll_herkunft||'') + (x.quelle_url ? ' · <a href="' + esc(x.quelle_url) + '" target="_blank" rel="noopener">' + esc(x.quelle||'Quelle') + '</a>' : x.quelle ? ' · ' + esc(x.quelle) : '');
      return '<div class="n">' + esc(name) + '<small>' + esc(soll) + ' ' + esc(einh) + bez + '</small></div>' +
        '<div class="bw"><div class="fd-bar"><div class="f" style="width:' + (p/1.5).toFixed(1) + '%;background:' + farbe + '"></div>' +
        (x.soll ? '<div class="m" style="left:' + (100/1.5).toFixed(1) + '%"></div>' : '') + '</div></div>' +
        '<div class="w">' + (x.ist==null ? '–' : z(x.ist, x.einheit==='en%'?0:1) + ' ' + esc(einh)) + '<small>' + (x.soll ? z(x.ist_prozent_vom_soll) + ' %' : '') + '</small></div>' +
        '<div class="her">' + her + '</div>';
    };
    const makro = ['kcal','protein','kh','fett','zucker','ballaststoffe','salz'];
    const m = is.filter(x => makro.includes(x.kennzahl)).sort((a, b) => makro.indexOf(a.kennzahl) - makro.indexOf(b.kennzahl) || (a.einheit==='en%') - (b.einheit==='en%'));
    const g = is.filter(x => x.kennzahl.startsWith('gruppe:'));
    const mi = is.filter(x => x.kennzahl.startsWith('mikro:'));
    let h = '<div class="fd-karte"><h2>Ist und Soll</h2><div class="fd-klein">Ist = Durchschnitt je erfasstem Tag' + (st.modus==='tag' ? '' : ' (' + (d.tage_erfasst||0) + ' Tage)') +
      '. Soll in dieser Reihenfolge: Vorgabe der Therapeutin, Ziel im Profil, Richtwert. Strich = 100 %.</div>' +
      '<h3>Kalorien und Makros</h3><div class="fd-is">' + m.map(zeile).join('') + '</div>' +
      '<h3>Lebensmittelgruppen</h3><div class="fd-is">' + g.map(zeile).join('') + '</div>' +
      '<div class="fd-hinweis">Die DGE-Werte sind Orientierungswerte für gesunde Erwachsene. Laut DGE eignen sie sich nicht, den Verzehr einzelner Personen zu bewerten. Darum zeigen wir sie zum Vergleich, nicht als Note.</div>';
    if(mi.length) h += '<details style="margin-top:12px"><summary>Vitamine und Mineralstoffe (' + mi.length + ')</summary><div class="fd-is" style="margin-top:8px">' + mi.map(zeile).join('') + '</div></details>';
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

  function vorgabenKarte(d){
    const v = d.vorgaben || [];
    const txt = x => (KZ[x.kennzahl] ? KZ[x.kennzahl][0] : x.kennzahl) + ' ' + (ART[x.art]||'') + ' ' + z(x.wert, 1) + ' ' + (x.einheit==='g/kg' ? 'g je kg Körpergewicht' : x.einheit) + ' je Tag';
    let h = '<div class="fd-karte"><h2>Vorgaben</h2><div class="fd-klein">Eine Vorgabe ersetzt im Ist-Soll das Profilziel und den DGE-Richtwert.</div>';
    h += v.length ? '<table style="margin-top:6px"><tbody>' + v.map(x => '<tr><td><b>' + esc(txt(x)) + '</b>' + (x.notiz ? '<div class="fd-klein">' + esc(x.notiz) + '</div>' : '') + '</td>' +
          (opt.nurLesen ? '' : '<td class="z"><button class="fd-k" data-vg-weg="' + esc(x.kennzahl) + '" type="button">Entfernen</button></td>') + '</tr>').join('') + '</tbody></table>'
       : '<p class="fd-klein">Noch keine Vorgaben.</p>';
    if(opt.nurLesen){
      h += '<div class="fd-bald">In der Musterpraxis nur zum Ansehen. Im eigenen Konto lassen sich hier Kalorien, Eiweiß, Kohlenhydrate, Fett, Zucker, Ballaststoffe, Salz, Gemüse und Obst je Klient einstellen.</div>';
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
    h += '<div class="fd-bald"><b>Bald:</b> Rezepte gemeinsam mit der Klientin anlegen und mit ihr teilen.</div>';
    return h + '</div>';
  }

  function planKarte(d){
    if(!d.wochenplan) return '<div class="fd-karte"><h2>Wochenplanung</h2><p class="fd-klein">' + esc(d.wochenplan_hinweis || 'Kein Wochenplan.') + '</p></div>';
    const von = d.wochenplan_von || montag(heute);
    let h = '<div class="fd-karte"><h2>Wochenplanung</h2><div class="fd-klein">Was die Person für diese und nächste Woche geplant hat.</div>';
    for(let w = 0; w < 2; w++){
      h += '<h3>' + (w ? 'Nächste Woche' : 'Diese Woche') + '</h3><div class="fd-plan">';
      for(let i = 0; i < 7; i++){
        const t = plus(von, w*7 + i), e = d.wochenplan.filter(x => x.datum===t);
        h += '<div class="tag' + (t===heute ? ' heute' : '') + '"><b>' + WT[D(t).getUTCDay()] + ' ' + tm(t) + '</b>' +
             e.map(x => '<div class="e">' + esc(x.titel||'') + '<small>' + esc(x.slot) + (x.kcal_portion ? ' · ' + z(x.kcal_portion) + ' kcal' : '') + '</small></div>').join('') + '</div>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  function binde(){
    $in.querySelectorAll('.fd-balken .s[data-tag]').forEach(s => s.onclick = () => { st.modus = 'tag'; st.anker = s.dataset.tag; laden(); });
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
