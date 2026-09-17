/* Root Index Service-Worker – App-Shell-Cache + Offline-Fallback.
   NUR same-origin wird gecacht. Supabase/API laufen immer übers Netz.

   2026-07-13: Cache-Version an den Build gekoppelt.
   Vorher hiess der Cache dauerhaft 'cleanbase-v1' und wurde bei einem Deploy
   nie verworfen. Zusammen mit einer offen gelassenen App fuehrte das dazu,
   dass Nutzer weiter mit altem Code arbeiteten.
   BEI JEDEM DEPLOY DIESE ZAHL HOCHZAEHLEN – dann wirft activate den alten Cache weg. */
const CACHE = 'rootindex-2026-09-17-7';
/* 🔴 DIESE ZEILE WIRD VOM DEPLOY-SKRIPT NEU GESCHRIEBEN (Work #144, 20.08.2026).
   Sie war bis heute von Hand gepflegt — und `./ui.css` fehlte darin, seit es die
   Datei gibt. Sobald app.js in Module zerfällt, hätte dort jedes neue Modul
   gefehlt: der Service Worker lädt beim Installieren nur vor, was hier steht,
   und bedient alles Übrige aus seinem Cache-first-Zweig.
   deploy.command leitet den Inhalt aus den <script src>/<link href> der beiden
   HTML-Dateien ab. Wer hier von Hand etwas einträgt, das dort nicht eingebunden
   ist, verliert es beim nächsten Deploy — das ist Absicht (§4.2). */
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './ui.css', './ladestelle.js', './training-ui.js', './intro-ui.js', './wasser-ui.js', './supplementplan-ui.js', './riki-ui.js', './app.js', './tagebuch-mikro-ui.js', './riegel-kern.js', './adminnav.js', './admin-benutzer-ui.js', './fotostudio-ui.js', './dashboard-ui.js', './notiz-dock-ui.js', './mikro-zuordnung-ui.js', './riki-import-ui.js', './benchmark-ui.js', './staffel-ui.js', './bewertung-ui.js', './produktliste.js', './produkteditor.js', './kern-fluss.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // externe (Supabase) nie abfangen

  // index.html IMMER frisch aus dem Netz – sonst sieht der Nutzer nie ein Update.
  // Nur wenn das Netz weg ist, kommt die Kopie aus dem Cache.
  // GEFIXT 27.08.2026: Vorher wurde JEDE Navigations-Antwort als './index.html'
  // gecacht – seit es /produkt/-Seiten gibt, haette offline eine Produktseite
  // die App-Shell ersetzt. Als Shell gilt nur noch '/' bzw. '/index.html'.
  const istShell = url.pathname === '/' || url.pathname === '/index.html';
  if (istShell) {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((r) => {
          const cp = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', cp));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  if (req.mode === 'navigate') {
    // Andere Seiten (z. B. /produkt/...) immer frisch; offline faellt die
    // Navigation auf die App-Shell zurueck, ohne den Cache zu veraendern.
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('./index.html')));
    return;
  }

  // Sonstige same-origin Assets (Icons, Bilder): Cache-first, das ist unkritisch.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req)
        .then((r) => {
          if (r && r.ok) {
            const cp = r.clone();
            caches.open(CACHE).then((c) => c.put(req, cp));
          }
          return r;
        })
        .catch(() => hit)
    )
  );
});

/* 28z24: WEB-PUSH (Haushalts-Mitteilungen, z. B. "Einkaufsliste geändert").
   Der Server schickt {title, body, url}; Klick öffnet die App an der Ziel-Stelle. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Root Index', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const ziel = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) { if ('focus' in w) { w.focus(); try { w.navigate(ziel); } catch (_) {} return; } }
    return clients.openWindow(ziel);
  }));
});
