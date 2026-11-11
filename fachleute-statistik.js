/* fachleute-statistik.js · 11.11.2026 · FL-4
   Praxis-Statistik für die Fachleute-Oberfläche (therapeut.html): Kennzahlen mit Verlauf,
   Gemüse und Obst je Woche, Vergleich der Personen, Ziel-Übersicht, Teller der Praxis,
   Verlauf je Person. Alle Zahlen kommen vom Server (cb_fp_klient_dashboard bzw.
   cb_fl_muster_dashboard); hier wird nur zusammengefasst (Durchschnitte) und gezeichnet.
   Diagramme: Chart.js (window.Chart), Vergleichsbalken als HTML. */
(function(){
'use strict';
const F = {gem:'#3f8f4f', obst:'#e8a33a', eiw:'#c0583a', kh:'#d4a12c', aus:'#cdd3cc', tanne:'#133521', gruen:'#2e7d46', grau:'#8a968d', linie:'#e7eae5', rot:'#c2412d', orange:'#d98a0b'};
const TELLER = [
  {k:'g', n:'Gemüse & Obst', col:'#4f9a3a', gruppen:['gemuese','obst']},
  {k:'e', n:'Eiweiß', col:'#c0583a', gruppen:['fleisch','fisch','eier','huelsenfruechte','milch']},
  {k:'k', n:'Kohlenhydrate', col:'#d4a12c', gruppen:['vollkorn','getreide','kartoffeln']}
];
const DGE_GEMUESE = 245, DGE_OG = 550;   // Richtwert-Tabelle (FL-2): Gemüse 245 g, Obst und Gemüse 550 g je Tag
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const z = (x, st) => x==null || isNaN(x) ? '–' : Number(x).toLocaleString('de-DE', {maximumFractionDigits: st||0});
const D = s => new Date(s + 'T12:00:00Z');
const iso = d => d.toISOString().slice(0,10);
const plus = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate()+n); return iso(d); };
const montag = s => { const d = D(s); d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7); return iso(d); };
const tm = s => { const d = D(s); return d.getUTCDate() + '.' + (d.getUTCMonth()+1) + '.'; };
const mittel = a => { const b = a.filter(x => x!=null && !isNaN(x)); return b.length ? b.reduce((s, x) => s + Number(x), 0) / b.length : null; };
const json = d => typeof d==='string' ? JSON.parse(d) : d;

function chartStil(){
  if(!window.Chart || chartStil.ok) return; chartStil.ok = true;
  Chart.defaults.font.family = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  Chart.defaults.font.size = 12; Chart.defaults.color = '#5d6b61';
  Chart.defaults.plugins.legend.labels.usePointStyle = true; Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.tooltip.backgroundColor = '#133521'; Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8; Chart.defaults.plugins.tooltip.titleFont = {weight: '800'};
}
const CH = new Map();
function chart(canvas, cfg){
  if(!window.Chart || !canvas) return null;
  chartStil();
  const alt = CH.get(canvas); if(alt) alt.destroy();
  const c = new Chart(canvas, cfg); CH.set(canvas, c); return c;
}

/* ---------- Daten ---------- */
// Tagesliste (aus dem Dashboard) → Wochen (Mo–So): Ø je erfasstem Tag
function wochen(tage){
  const w = new Map();
  (tage||[]).forEach(t => {
    const m = montag(t.datum); if(!w.has(m)) w.set(m, {von: m, tage: [], n: 0});
    const x = w.get(m); x.n++; if(!t.leer) x.tage.push(t);
  });
  return [...w.values()].map(x => ({von: x.von, erfasst: x.tage.length, tageGesamt: x.n,
    gem: mittel(x.tage.map(t => t.gemuese_g)), obst: mittel(x.tage.map(t => t.obst_g)),
    kcal: mittel(x.tage.map(t => t.kcal)), score: mittel(x.tage.map(t => t.score))}));
}
function zeitraum(tage, von, bis){
  const t = (tage||[]).filter(x => x.datum >= von && x.datum <= bis), e = t.filter(x => !x.leer);
  return {tage: t.length, erfasst: e.length, gem: mittel(e.map(x => x.gemuese_g)), obst: mittel(e.map(x => x.obst_g)),
          kcal: mittel(e.map(x => x.kcal)), score: mittel(e.map(x => x.score))};
}
const CACHE = new Map();
// personen: [{key, name, code, muster, ziel, rpc:(von,bis)=>Promise<{data,error}>}]
async function laden(personen, heute, nTage){
  const bis = plus(heute, -1), vonLang = plus(montag(bis), -49), vonKurz = plus(bis, -(nTage-1));
  return Promise.all(personen.map(async p => {
    const kLang = p.key + '|' + vonLang + '|' + bis, kKurz = p.key + '|' + vonKurz + '|' + bis;
    const hol = async (k, von) => { if(!CACHE.has(k)) CACHE.set(k, p.rpc(von, bis).then(r => r.error ? {fehler: r.error.message} : json(r.data)).catch(e => ({fehler: e.message}))); return CACHE.get(k); };
    const [lang, kurz] = await Promise.all([hol(kLang, vonLang), hol(kKurz, vonKurz)]);
    const tl = (lang && lang.tage) || [];
    return {p, lang, kurz, wochen: wochen(tl), jetzt: zeitraum(tl, vonKurz, bis), vorher: zeitraum(tl, plus(vonKurz, -nTage), plus(vonKurz, -1)), nTage};
  }));
}
function leeren(){ CACHE.clear(); VERLAUF.clear(); }

/* ---------- Bausteine ---------- */
function kpi(id, titel, wert, einheit, delta, deltaGut, fuss){
  const pfeil = delta==null || Math.abs(delta) < 0.5 ? '' :
    '<span class="kpi-delta ' + ((delta > 0) === deltaGut ? 'gut' : 'schlecht') + '">' + (delta > 0 ? '▲' : '▼') + ' ' + z(Math.abs(delta)) + '</span>';
  return '<div class="kpi"><div class="kpi-titel">' + esc(titel) + '</div><div class="kpi-wert">' + wert + '<small>' + esc(einheit) + '</small>' + pfeil + '</div>' +
    '<canvas class="kpi-spark" id="' + id + '" height="38"></canvas><div class="kpi-fuss">' + fuss + '</div></div>';
}
function spark(id, werte, farbe){
  chart(document.getElementById(id), {type: 'line', data: {labels: werte.map((_, i) => i), datasets: [{data: werte, borderColor: farbe, borderWidth: 2,
      backgroundColor: farbe + '22', fill: true, tension: .35, pointRadius: 0, spanGaps: true}]},
    options: {responsive: true, maintainAspectRatio: false, animation: false, plugins: {legend: {display: false}, tooltip: {enabled: false}},
      scales: {x: {display: false}, y: {display: false}}}});
}
function balkenZeile(name, sub, werte, max, marken, rechts){
  // werte: [[wert, farbe]], marken: [[wert, titel]]
  const w = v => Math.max(0, Math.min(100, 100 * (v||0) / max)).toFixed(1);
  return '<div class="bz"><div class="bz-name">' + esc(name) + (sub ? '<small>' + sub + '</small>' : '') + '</div>' +
    '<div class="bz-spur">' + werte.map(x => '<i style="width:' + w(x[0]) + '%;background:' + x[1] + '"></i>').join('') +
    marken.map(m => '<b class="bz-marke" style="left:' + w(m[0]) + '%" title="' + esc(m[1]) + '"></b>').join('') + '</div>' +
    '<div class="bz-wert">' + rechts + '</div></div>';
}
function tellerAus(gruppen){
  const zu = {}; TELLER.forEach(s => s.gruppen.forEach(g => zu[g] = s.k));
  const seg = TELLER.map(s => ({k: s.k, n: s.n, col: s.col, g: 0})); let aus = 0;
  (gruppen||[]).forEach(r => { const g = Number(r.gramm)||0; if(!(g > 0)) return; const k = zu[r.gruppe]; if(k) seg.find(x => x.k===k).g += g; else aus += g; });
  return {seg, aus};
}

/* ---------- Übersicht: Praxis auf einen Blick ---------- */
function uebersicht(el, daten, info){
  const ok = daten.filter(d => !d.lang.fehler);
  if(!ok.length){ el.innerHTML = '<div class="karte2"><p class="fuss">Noch keine Daten.</p></div>'; return; }
  const n = daten[0].nTage;
  const m = k => mittel(ok.map(d => d.jetzt[k])), mv = k => mittel(ok.map(d => d.vorher[k]));
  const erf = mittel(ok.map(d => d.jetzt.tage ? 100 * d.jetzt.erfasst / d.jetzt.tage : null)), erfV = mittel(ok.map(d => d.vorher.tage ? 100 * d.vorher.erfasst / d.vorher.tage : null));
  const wo = ok[0].wochen.map((w, i) => ({von: w.von, gem: mittel(ok.map(d => d.wochen[i] && d.wochen[i].gem)), obst: mittel(ok.map(d => d.wochen[i] && d.wochen[i].obst)),
    score: mittel(ok.map(d => d.wochen[i] && d.wochen[i].score)), erf: mittel(ok.map(d => d.wochen[i] && d.wochen[i].tageGesamt ? 100 * d.wochen[i].erfasst / d.wochen[i].tageGesamt : null))}));
  while(wo.length > 1 && wo[0].gem==null && wo[0].obst==null) wo.shift();   // Wochen vor dem ersten Eintrag weglassen
  const gem = m('gem'), obst = m('obst'), sc = m('score');
  el.innerHTML = (info ? '<div class="hinweis-band">' + info + '</div>' : '') +
    '<div class="kpis">' +
      kpi('spGem', 'Gemüse Ø je Tag', z(gem), ' g', gem!=null && mv('gem')!=null ? gem - mv('gem') : null, true, 'DGE-Orientierung ' + DGE_GEMUESE + ' g · ' + (gem!=null ? Math.round(100*gem/DGE_GEMUESE) + ' %' : '–')) +
      kpi('spObst', 'Obst Ø je Tag', z(obst), ' g', obst!=null && mv('obst')!=null ? obst - mv('obst') : null, true, 'Obst + Gemüse ' + z((gem||0) + (obst||0)) + ' von ' + DGE_OG + ' g') +
      kpi('spScore', 'Root-Index-Score Ø', z(sc), '', sc!=null && mv('score')!=null ? sc - mv('score') : null, true, 'nach Menge gewichtet, je Tag') +
      kpi('spErf', 'Tage erfasst', z(erf), ' %', erf!=null && erfV!=null ? erf - erfV : null, true, 'Anteil der Tage mit Einträgen') +
    '</div>' +
    '<div class="raster2">' +
      '<div class="karte2 breit"><div class="k2-kopf"><h3>Gemüse und Obst je Woche</h3><span>Ø je erfasstem Tag, alle Personen</span></div><div class="ch-h"><canvas id="chWochen"></canvas></div></div>' +
      '<div class="karte2"><div class="k2-kopf"><h3>Teller der Praxis</h3><span>letzte ' + n + ' Tage, nach Gramm</span></div><div class="ch-h klein"><canvas id="chTeller"></canvas></div><div class="fuss" id="tellerFuss"></div></div>' +
    '</div>' +
    '<div class="karte2"><div class="k2-kopf"><h3>Im Ziel</h3><span>letzte ' + n + ' Tage, Ø je erfasstem Tag gegen Vorgabe, Profilziel oder DGE-Orientierung</span></div>' + zielMatrix(daten) + '</div>';
  spark('spGem', wo.map(w => w.gem), F.gem); spark('spObst', wo.map(w => w.obst), F.obst); spark('spScore', wo.map(w => w.score), F.tanne); spark('spErf', wo.map(w => w.erf), F.grau);
  chart(document.getElementById('chWochen'), {type: 'bar',
    data: {labels: wo.map(w => tm(w.von)), datasets: [
      {label: 'Gemüse', data: wo.map(w => w.gem && Math.round(w.gem)), backgroundColor: F.gem, borderRadius: 6, stack: 's', maxBarThickness: 46},
      {label: 'Obst', data: wo.map(w => w.obst && Math.round(w.obst)), backgroundColor: F.obst, borderRadius: 6, stack: 's', maxBarThickness: 46},
      {label: 'DGE Obst + Gemüse (' + DGE_OG + ' g)', data: wo.map(() => DGE_OG), type: 'line', stack: 'dge', borderColor: F.tanne, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0}]},
    options: {responsive: true, maintainAspectRatio: false, interaction: {mode: 'index', intersect: false},
      plugins: {legend: {position: 'bottom'}, tooltip: {callbacks: {title: t => 'Woche ab ' + t[0].label, label: c => ' ' + c.dataset.label.split(' (')[0] + ': ' + z(c.parsed.y) + ' g'}}},
      scales: {x: {stacked: true, grid: {display: false}}, y: {stacked: true, beginAtZero: true, grid: {color: F.linie}, ticks: {callback: v => v + ' g'}}}}});
  const gr = {}; ok.forEach(d => (d.kurz.gruppen||[]).forEach(g => { gr[g.gruppe] = gr[g.gruppe] || {gruppe: g.gruppe, gramm: 0}; gr[g.gruppe].gramm += Number(g.gramm)||0; }));
  const t = tellerAus(Object.values(gr)), sum = t.seg.reduce((a, s) => a + s.g, 0);
  chart(document.getElementById('chTeller'), {type: 'doughnut',
    data: {labels: t.seg.map(s => s.n), datasets: [{data: t.seg.map(s => Math.round(s.g)), backgroundColor: t.seg.map(s => s.col), borderWidth: 2, borderColor: '#fff'}]},
    options: {responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: {legend: {position: 'bottom'},
      tooltip: {callbacks: {label: c => ' ' + c.label + ': ' + Math.round(100 * c.parsed / (sum||1)) + ' %'}}}}});
  document.getElementById('tellerFuss').innerHTML = 'FET-Tellermodell als Orientierung: etwa ½ Gemüse und Obst, ¼ Eiweiß, ¼ Kohlenhydrate (je Mahlzeit, nach Fläche).' + (t.aus ? ' Außerhalb des Tellers: ' + z(t.aus) + ' g.' : '');
  bindeZiel(el);
}
const ZIEL = [['kcal','Kalorien'], ['protein','Eiweiß'], ['kh','Kohlenhydrate'], ['fett','Fett'], ['ballaststoffe','Ballaststoffe'], ['zucker','Zucker'], ['salz','Salz'], ['gruppe:gemuese','Gemüse'], ['gruppe:gemuese+obst','Obst + Gemüse']];
function zielMatrix(daten){
  return '<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>' + ZIEL.map(k => '<th>' + k[1] + '</th>').join('') + '</tr></thead><tbody>' +
    daten.map(d => '<tr data-ziel="' + esc(d.p.ziel) + '"><th>' + esc(d.p.name) + (d.p.muster ? ' <span class="mini-muster">erfunden</span>' : '') + '</th>' + ZIEL.map(k => {
      const x = (d.kurz.ist_soll||[]).find(y => y.kennzahl===k[0] && y.einheit!=='en%');
      if(d.kurz.fehler || !x || x.soll==null) return '<td class="mz leer">–</td>';
      const cls = x.erfuellt==null ? 'leer' : x.erfuellt ? 'ja' : (x.art==='hoechstens' ? 'ueber' : 'nein');
      return '<td class="mz ' + cls + '" title="' + esc(k[1] + ': ' + z(x.ist,1) + ' ' + x.einheit + ' von ' + (x.art==='mindestens' ? 'mind. ' : x.art==='hoechstens' ? 'höchstens ' : 'etwa ') + z(x.soll,1) + ' ' + x.einheit + ' (' + (x.soll_herkunft||'') + ')') + '">' + z(x.ist_prozent_vom_soll) + ' %</td>';
    }).join('') + '</tr>').join('') +
    '</tbody></table></div><div class="legende2"><span><i class="ja"></i>im Ziel</span><span><i class="nein"></i>darunter oder daneben</span><span><i class="ueber"></i>über der Höchstgrenze</span><span><i class="leer"></i>kein Soll</span></div>';
}
function bindeZiel(el){ el.querySelectorAll('tr[data-ziel]').forEach(tr => tr.style.cursor = 'pointer'); }

/* ---------- Auswertungen: Personen im Vergleich ---------- */
function vergleich(el, daten){
  const ok = daten.filter(d => !d.lang.fehler);
  const n = daten[0] ? daten[0].nTage : 7;
  const maxG = Math.max(DGE_OG, ...ok.map(d => (d.jetzt.gem||0) + (d.jetzt.obst||0))) * 1.08;
  const kcalZ = d => (d.kurz.ist_soll||[]).find(x => x.kennzahl==='kcal' && x.einheit!=='en%');
  const maxK = Math.max(...ok.map(d => Math.max(d.jetzt.kcal||0, (kcalZ(d)||{}).soll||0)), 1) * 1.08;
  el.innerHTML =
    '<div class="raster2 gleich">' +
      '<div class="karte2"><div class="k2-kopf"><h3>Gemüse und Obst je Person</h3><span>Ø je erfasstem Tag, letzte ' + n + ' Tage</span></div>' +
        ok.map(d => balkenZeile(d.p.name, d.p.muster ? 'erfunden' : '', [[d.jetzt.gem, F.gem], [d.jetzt.obst, F.obst]], maxG,
          [[DGE_GEMUESE, 'DGE Gemüse ' + DGE_GEMUESE + ' g'], [DGE_OG, 'DGE Obst + Gemüse ' + DGE_OG + ' g']],
          '<b>' + z(d.jetzt.gem) + '</b> + ' + z(d.jetzt.obst) + ' g')).join('') +
        '<div class="legende2"><span><i style="background:' + F.gem + '"></i>Gemüse</span><span><i style="background:' + F.obst + '"></i>Obst</span><span><i class="strich"></i>DGE ' + DGE_GEMUESE + ' g Gemüse und ' + DGE_OG + ' g Obst + Gemüse</span></div></div>' +
      '<div class="karte2"><div class="k2-kopf"><h3>Kalorien gegen Soll</h3><span>Ø je erfasstem Tag, letzte ' + n + ' Tage</span></div>' +
        ok.map(d => { const k = kcalZ(d); const farbe = !k || k.erfuellt==null ? F.grau : k.erfuellt ? F.gruen : F.orange;
          return balkenZeile(d.p.name, k && k.soll ? 'Soll ' + z(k.soll) + ' kcal' : 'ohne Soll', [[d.jetzt.kcal, farbe]], maxK, k && k.soll ? [[k.soll, 'Soll']] : [], '<b>' + z(d.jetzt.kcal) + '</b> kcal'); }).join('') +
        '<div class="legende2"><span><i style="background:' + F.gruen + '"></i>im Ziel (±10 %)</span><span><i style="background:' + F.orange + '"></i>daneben</span><span><i class="strich"></i>Soll</span></div></div>' +
    '</div>' +
    '<div class="karte2"><div class="k2-kopf"><h3>Root-Index-Score je Woche</h3><span>Ø je erfasstem Tag, nach Menge gewichtet</span></div><div class="ch-h"><canvas id="chScore"></canvas></div></div>';
  const farben = ['#2e7d46', '#d98a0b', '#3a6ea5', '#a8457a', '#6b7a2e', '#c0583a', '#5b5fb0', '#1f8a8a'];
  const w0 = ok[0] ? ok[0].wochen : [];
  let ab = 0; while(ab < w0.length - 1 && ok.every(d => !d.wochen[ab] || d.wochen[ab].score==null)) ab++;
  const lab = w0.slice(ab).map(w => tm(w.von));
  chart(document.getElementById('chScore'), {type: 'line',
    data: {labels: lab, datasets: ok.map((d, i) => ({label: d.p.name, data: d.wochen.slice(ab).map(w => w.score && Math.round(w.score)), borderColor: farben[i % farben.length],
      backgroundColor: farben[i % farben.length], tension: .3, borderWidth: 2, pointRadius: 3, spanGaps: true}))},
    options: {responsive: true, maintainAspectRatio: false, interaction: {mode: 'index', intersect: false}, plugins: {legend: {position: 'bottom'}},
      scales: {x: {grid: {display: false}}, y: {suggestedMin: 40, suggestedMax: 100, grid: {color: F.linie}}}}});
}

/* ---------- Verlauf einer Person (für die Auswertung je Klient) ---------- */
const VERLAUF = new Map();
async function verlauf(el, rpc, heute, key){
  const bis = plus(heute, -1), von = plus(montag(bis), -49);
  el.innerHTML = '<div class="fd-karte"><h2>Verlauf der letzten 8 Wochen</h2><div class="fd-klein">Ø je erfasstem Tag und Woche</div><div style="position:relative;height:240px;margin-top:8px"><canvas></canvas></div></div>';
  let d; try{ const k = (key||'') + '|' + von; if(!VERLAUF.has(k)) VERLAUF.set(k, rpc(von, bis)); const r = await VERLAUF.get(k); if(r.error) throw new Error(r.error.message); d = json(r.data); }catch(e){ el.innerHTML = ''; return; }
  const wo = wochen(d.tage);
  while(wo.length > 1 && wo[0].gem==null && wo[0].obst==null) wo.shift();
  chart(el.querySelector('canvas'), {type: 'bar',
    data: {labels: wo.map(w => tm(w.von)), datasets: [
      {label: 'Gemüse g', data: wo.map(w => w.gem && Math.round(w.gem)), backgroundColor: F.gem, borderRadius: 6, stack: 's', yAxisID: 'y', maxBarThickness: 40},
      {label: 'Obst g', data: wo.map(w => w.obst && Math.round(w.obst)), backgroundColor: F.obst, borderRadius: 6, stack: 's', yAxisID: 'y', maxBarThickness: 40},
      {label: 'Score', data: wo.map(w => w.score && Math.round(w.score)), type: 'line', borderColor: F.tanne, backgroundColor: F.tanne, yAxisID: 'y2', tension: .3, pointRadius: 3, spanGaps: true},
      {label: 'DGE Obst + Gemüse', data: wo.map(() => DGE_OG), type: 'line', stack: 'dge', borderColor: '#9aa79e', borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, yAxisID: 'y'}]},
    options: {responsive: true, maintainAspectRatio: false, interaction: {mode: 'index', intersect: false}, plugins: {legend: {position: 'bottom'}},
      scales: {x: {stacked: true, grid: {display: false}}, y: {stacked: true, beginAtZero: true, grid: {color: F.linie}, ticks: {callback: v => v + ' g'}},
               y2: {position: 'right', min: 0, max: 100, grid: {display: false}, title: {display: true, text: 'Score'}}}}});
}

window.FLStat = { laden, leeren, uebersicht, vergleich, verlauf };
})();
