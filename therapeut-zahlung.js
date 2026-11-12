/* therapeut-zahlung.js – ENTWURF 11.11.2026 (FL-1, Stripe-Abrechnung der Fachleute)
   Eigener Baustein, damit therapeut.html (FL-4) kaum angefasst wird.
   Einbinden beim Ausrollen mit EINER Zeile am Ende von therapeut.html:
     <script src="therapeut-zahlung.js?v=1"></script>
   Nutzt die globalen `client` und `$` der Seite. Zeigt im Bereich
   Einstellungen › Abrechnung: Zahlungsart, Knopf hinterlegen/ändern,
   Rechnungen (Stripe-Kundenportal) und die Liste der Monatsrechnungen.
   Daten: cb_fp_zahlung_stand (RPC), Edge-Funktion fp-zahlung. */
(function () {
  if (typeof client === 'undefined') return;
  const ESC = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EUR = c => ((c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const MON = iso => new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const STATUS = { angelegt: 'in Arbeit', offen: 'wird eingezogen', bezahlt: 'bezahlt', fehlgeschlagen: 'Zahlung fehlgeschlagen',
                   ohne_zahlungsart: 'keine Zahlungsart hinterlegt', fehler: 'in Klärung', storniert: 'storniert' };
  let geladen = false;

  function feld() {
    let f = document.getElementById('fpZahlung');
    if (f) return f;
    // bevorzugt: eigene Karte auf der Seite "Abrechnung" (nach "Preis und Modell")
    const inhalt = document.querySelector('section[data-v="abrechnung"] .seite-inhalt');
    if (inhalt) {
      const k = document.createElement('div'); k.className = 'karte2 nicht-demo';
      k.innerHTML = '<div class="k2-kopf"><h3>Zahlung und Rechnungen</h3></div><div id="fpZahlung"></div>';
      const erste = inhalt.querySelector('.karte2');
      erste ? erste.insertAdjacentElement('afterend', k) : inhalt.prepend(k);
      return document.getElementById('fpZahlung');
    }
    const anker = document.getElementById('zRegel2');   // aeltere Seite: Einstellungen
    if (!anker) return null;
    f = document.createElement('div'); f.id = 'fpZahlung'; f.className = 'nicht-demo'; f.style.maxWidth = '620px';
    anker.insertAdjacentElement('afterend', f);
    return f;
  }

  async function edge(aktion, extra) {
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('Bitte neu anmelden.');
    const r = await client.functions.invoke('fp-zahlung', { body: { aktion, basis: location.origin, ...(extra || {}) } });
    const d = r.data || {};
    if (r.error || !d.ok) {
      let grund = d.grund;
      try { if (!grund && r.error?.context) grund = (await r.error.context.json()).grund; } catch (_) { }
      throw new Error(grund || 'Das hat nicht geklappt. Bitte später noch einmal.');
    }
    return d;
  }

  function zeichne(st, hinweis, art) {
    const f = feld(); if (!f) return;
    const rech = (st.rechnungen || []).map(r => `<tr><td>${ESC(MON(r.monat))}</td><td>${r.keys} Keys</td><td style="text-align:right">${EUR(r.betrag_cent)}</td>
      <td>${ESC(STATUS[r.status] || r.status)}</td><td>${r.rechnung_url ? `<a href="${ESC(r.rechnung_url)}" target="_blank" rel="noopener">ansehen</a>` : ''}${r.pdf_url ? ` · <a href="${ESC(r.pdf_url)}" download>PDF laden</a>` : ''}</td></tr>`).join('');
    f.innerHTML = `
      ${st.modus === 'test' ? '<p class="fuss" style="color:var(--rot)">Testbetrieb: Es wird nichts echt abgebucht.</p>' : ''}
      <p style="margin:6px 0">Am 1. jedes Monats kommt die Rechnung für den Vormonat und wird automatisch eingezogen. Ohne Umsatzsteuer (§ 19 UStG).</p>
      <table class="tab schmal"><tr><td>Zahlungsart</td><td>${st.zahlungsart ? ESC(st.zahlungsart) : '<b>noch keine hinterlegt</b>'}</td></tr></table>
      <div class="reihe-k" style="margin-top:10px;gap:8px;display:flex;flex-wrap:wrap">
        <button class="tb haupt" type="button" id="fpZEinrichten">${st.zahlungsart ? 'Zahlungsart ändern' : 'Zahlungsart hinterlegen'}</button>
        ${st.zahlungsart ? '<button class="tb" type="button" id="fpZPortal">Rechnungen und Rechnungsadresse</button>' : ''}
      </div>
      <div class="meld" id="meldZahlung"></div>
      ${rech ? `<h3 style="margin:16px 0 6px;font-size:16px">Monatsrechnungen</h3><div class="tabwrap"><table class="tab"><tr><th>Monat</th><th>Keys</th><th style="text-align:right">Betrag</th><th>Stand</th><th>Rechnung</th></tr>${rech}</table></div>` : ''}`;
    if (hinweis) meld('meldZahlung', hinweis, art);
    $('fpZEinrichten').onclick = async function () {
      this.disabled = true; meld('meldZahlung', '⏳ Stripe wird geöffnet …');
      try { location.href = (await edge('einrichten')).url; }
      catch (e) { this.disabled = false; meld('meldZahlung', e.message, 'fehler'); }
    };
    if ($('fpZPortal')) $('fpZPortal').onclick = async function () {
      this.disabled = true; meld('meldZahlung', '⏳ Einen Moment …');
      try { location.href = (await edge('portal')).url; }
      catch (e) { this.disabled = false; meld('meldZahlung', e.message, 'fehler'); }
    };
  }

  async function laden() {
    if (typeof DEMO !== 'undefined' && DEMO) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session) return;
    let hinweis = '', art = '';
    const q = new URLSearchParams(location.search);
    if (q.get('zahlung') === 'ok' && q.get('sid')) {
      try { const d = await edge('bestaetigen', { sid: q.get('sid') }); hinweis = 'Gespeichert: ' + d.zahlungsart + '. Ab jetzt läuft die Abrechnung automatisch.'; art = 'ok'; }
      catch (e) { hinweis = e.message; art = 'fehler'; }
      history.replaceState(null, '', location.pathname + location.hash);
    } else if (q.get('zahlung') === 'abbruch') {
      hinweis = 'Abgebrochen – es wurde nichts gespeichert.';
      history.replaceState(null, '', location.pathname + location.hash);
    }
    const { data: st, error } = await client.rpc('cb_fp_zahlung_stand');
    if (error || !st) return;               // keine (freigeschaltete) Fachperson
    if ((st.rechnungen || []).some(r => r.status === 'angelegt' || r.status === 'offen')) {
      try { await edge('auffrischen'); const n = await client.rpc('cb_fp_zahlung_stand'); if (n.data) Object.assign(st, n.data); } catch (_) { }
    }
    geladen = true;
    zeichne(st, hinweis, art);
  }

  client.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_OUT') { geladen = false; const f = document.getElementById('fpZahlung'); if (f) f.innerHTML = ''; }
    else if (!geladen && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) setTimeout(laden, 0);
  });
})();
