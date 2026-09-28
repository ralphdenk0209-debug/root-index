# Barcode-Listen für den .com-Import

Quelle: Open Food Facts, Gesamtexport `en.openfoodfacts.org.products.csv.gz` (Stand 28.09.2026), Lizenz ODbL – Daten © Open Food Facts contributors, https://world.openfoodfacts.org.

Je Land nur Produkte mit Zutatentext, Name, Marke und kcal-Wert; sortiert nach Beliebtheit (`unique_scans_n`, absteigend). US nur mit US/Kanada-Barcode (GS1 000–139).

- `ean_uk.txt` – United Kingdom (45.944)
- `ean_us.txt` – United States (40.623)
- `ean_ie.txt` – Ireland (6.034. ohne Barcodes aus ean_uk.txt)
- `ean_fr.txt` – France (306.416)

Die Datenbank holt die Listen über raw.githubusercontent.com (`shadow_v1._eu_import_liste_laden`) und lädt die Produktdetails je Barcode einzeln über die Open-Food-Facts-API – derselbe Weg wie bisher (Scan_Cache → cb_scan_sofort).
Ordner wird nicht auf den Webspace geladen (`_werkzeuge/` ist ausgeschlossen).
