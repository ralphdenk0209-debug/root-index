# Warum die Arbeitsfläche stehen blieb — und was noch bremst

Stand 15.09.2026

## Der Fehler, den Ralph gesehen hat

> Arbeitsfläche nicht verfügbar. Grund: canceling statement due to lock timeout

Zwei verschiedene Ursachen hintereinander, beide gefunden und zu:

**1. Der Sperrfehler.** `cb_waechter_system_erheben()` begann mit
`delete from "Waechter_System_Pruefung";`. Die Sperre daraus hielt den ganzen
Lauf über — über vier Minuten. Das Dashboard liest dieselbe Tabelle über
`v_waechter_system_qa_offen` und hat als `authenticated` **`lock_timeout = 8s`**.
Jeder Seitenaufruf während des Takts brach ab. Der `delete` steht jetzt am
**Ende** des Laufs und räumt nur ältere Zeilen.

**2. Der Zeitfehler.** `cb_netzplan()` las eine Zeile live:

```sql
'offen',(select count(*) from v_zusatzstoffe_unbekannt_offen),
```

Gemessen: **17.988 ms** für diese eine Sicht. Alle elf anderen live gelesenen
Sichten zusammen: 1,6 s. Die Sicht ruft `cb_enummern_lesefehler_aus_text` über
den ganzen Bestand — genau der Weg, den die Fehlermeldung nannte.

Der Cache-Schlüssel `wb_enummer` existierte längst und wurde vom Takt
`waechter-zaehler-takt` alle 15 Minuten gefüllt. Der Netzplan hatte nur nie auf
ihn umgestellt. Eine Zeile:

```sql
'offen',(select anzahl from "Waechter_Zaehler_Cache" where schluessel='wb_enummer'),'aus_cache',true,
```

## Gemessen, vorher und nachher

| | vorher | nachher |
|---|---|---|
| `v_zusatzstoffe_unbekannt_offen` im Netzplan | 17.988 ms live | aus dem Cache |
| `cb_netzplan()` unter 8-s-Grenze | Abbruch | **1,1 – 1,9 s** |
| Arbeitsfläche im Browser | „nicht verfügbar" | **lädt, 0 Fehler** |

Gegengemessen am echten Weg, nicht in der Datenbank: Seite neu geladen, 20
Sekunden gewartet, `performance.getEntriesByType('resource')` ausgelesen.

## Zwei Merksätze

**Die eigene Messung in einer belasteten Sitzung lügt.** `cb_dashboard_stamm`
maß 3–5,5 s; die Summe aller seiner Einzelanweisungen war 1,4 s. Die Differenz
war meine eigene parallele Last. `pg_stat_statements` ist die Wahrheit, nicht die
eigene Stoppuhr.

**Ein Zähler, der bereits im Cache steht, muss auch von dort gelesen werden.**
19 Wächterzahlen kamen aus dem Cache, zwei nicht — und eine davon kostete den
ganzen Seitenaufruf. Nach jedem neuen Zähler prüfen: füllt der Takt ihn, **und
liest der Netzplan ihn auch von dort?**

## Was noch bremst (gemessen, nicht geändert)

Ein Aufruf von `admin.html` macht **56 RPC-Aufrufe**, viele davon doppelt:

| RPC | Aufrufe je Seitenladung |
|---|---|
| cb_admin_meilensteine | 5 |
| cb_bundesland_zaehlung | 5 |
| cb_me · cb_features · cb_my_features · cb_link_me | je 3 |
| **cb_netzplan** | **3** |
| **cb_dashboard** | **3** |

`cb_admin_dashboard_cockpit_v2` ruft `cb_netzplan`, `cb_dashboard` und
`cb_dashboard_stamm` intern **noch einmal**. Ein Seitenaufruf lässt den Netzplan
also vier bis fünf Mal laufen, à 1,5 s. Cockpit_v2 selbst brauchte gemessen
**8.955 ms** — es überlebt die 8-s-Grenze nur, weil die Funktion ein eigenes
`statement_timeout` von 30 s trägt. Dieser Notnagel gehört weg, aber erst wenn
die Mehrfachaufrufe weg sind.

Das ist Arbeit in `app.js` / `dashboard-ui.js` und wartet, solange dort
fremde, nicht eingecheckte Änderungen liegen.
