/* riki-geld-hinweis.js — 10.11.2026 (Ralph: „einen hinweis/popup wenn nur noch 2 dollar übrig sind“)
   Fragt alle 10 Minuten cb_riki_geld_hinweis() (nur Admins). Popup, wenn
   - von der Monatsgrenze (Riki_Config.monatslimit_usd) noch ≤ 2 $ übrig sind, oder
   - Anthropic „Guthaben leer“ meldet (Riki-Aufrufe scheitern wegen Abrechnung).
   „Verstanden“ blendet den Hinweis für heute aus (je Grund). Testansicht: ?geldtest=1
   Eingebettet (Cockpit im Admin-Reiter) zeigt nur die äußere Seite den Hinweis. */
(function(){
  if (window.__rikiGeldHinweis) return; window.__rikiGeldHinweis = true;
  try { if (window.top !== window) return; } catch(_) { return; }

  function sb(){ try { return (typeof client !== 'undefined') ? client : null; } catch(_) { return null; } }
  function heute(){ return new Date().toISOString().slice(0,10); }
  function weg(grund){ try { return localStorage.getItem('rikiGeldHinweis') === heute()+':'+grund; } catch(_) { return false; } }
  function merke(grund){ try { localStorage.setItem('rikiGeldHinweis', heute()+':'+grund); } catch(_) {} }
  function usd(x){ return Number(x||0).toFixed(2).replace('.', ',')+' $'; }

  function zeigen(d){
    if (document.getElementById('rikiGeldPopup')) return;
    var leer = d.grund === 'guthaben_leer';
    var titel = leer ? 'Riki hat kein Guthaben mehr' : 'Riki: nur noch '+usd(d.rest_usd)+' übrig';
    var text = leer
      ? 'Anthropic lehnt Rikis Aufrufe ab, weil das Guthaben leer ist. Neue Scans werden gerade nicht gelesen. Bitte Guthaben bei console.anthropic.com aufladen.'
      : 'Diesen Monat sind '+usd(d.verbraucht_usd)+' von '+usd(d.limit_usd)+' verbraucht. Ist die Grenze erreicht, liest Riki bis Monatsende keine neuen Scans mehr. Grenze erhöhen oder Monatsende abwarten.';
    var w = document.createElement('div');
    w.id = 'rikiGeldPopup';
    w.setAttribute('role','alertdialog');
    w.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,sans-serif';
    w.innerHTML =
      '<div style="background:#fff;color:#1a1a1a;max-width:420px;width:100%;border-radius:16px;padding:22px 22px 18px;box-shadow:0 12px 40px rgba(0,0,0,.3);border-top:6px solid #d9480f">'
      + '<div style="font-size:18px;font-weight:700;margin-bottom:8px">⚠️ '+titel+'</div>'
      + '<div style="font-size:14.5px;line-height:1.45;margin-bottom:16px">'+text+'</div>'
      + '<div style="text-align:right"><button type="button" style="background:#d9480f;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:14.5px;font-weight:600;cursor:pointer">Verstanden</button></div>'
      + '</div>';
    w.querySelector('button').onclick = function(){ merke(d.grund); w.remove(); };
    document.body.appendChild(w);
  }

  async function pruefen(){
    if (/[?&]geldtest=1/.test(location.search)) {
      zeigen({ grund:'monatsgrenze', rest_usd:1.84, verbraucht_usd:148.16, limit_usd:150 }); return;
    }
    var c = sb(); if (!c || !c.rpc) return;
    try {
      var r = await c.rpc('cb_riki_geld_hinweis');
      var d = r && r.data;
      if (d && d.alarm && d.grund && !weg(d.grund)) zeigen(d);
    } catch(_) {}
  }

  function start(){ setTimeout(pruefen, 4000); setInterval(pruefen, 600000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
