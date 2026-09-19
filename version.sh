#!/bin/bash
# Versionsnummer setzen - Ralph, 13.09.2026.
#
# WARUM ES DAS GIBT: die ?v=-Werte standen in acht verschiedenen Faessungen in
# den HTML-Dateien, und index.html hing auf 2026-09-07, obwohl app.js taeglich
# geaendert wurde. Wirkung: der Browser holte die alte Datei aus seinem Speicher
# und die Nutzer bekamen die Aenderungen nie zu sehen. Ein Cache-Brecher, der
# nicht mitwaechst, ist schlimmer als gar keiner - er taeuscht Frische vor.
#
# Neue Schreibweise (Ralphs Entscheid): 1.4 (212) - Zahl fuer Menschen,
# Bau-Nummer fortlaufend. Im Web steht beides zusammengezogen: 1.4.212
#
# Aufruf:
#   ./version.sh            eine Bau-Nummer weiter
#   ./version.sh 1.1        auf Version 1.1, Bau-Nummer weiter
set -e
cd "$(dirname "$0")"

ALT=$(grep -ho '?v=[0-9]\+\.[0-9]\+\.[0-9]\+' index.html | head -1 | sed 's/?v=//')
if [ -z "$ALT" ]; then ALT="1.0.1"; fi

VERSION="${1:-$(echo "$ALT" | cut -d. -f1-2)}"
BAU=$(( $(echo "$ALT" | cut -d. -f3) + 1 ))
NEU="$VERSION.$BAU"

# pruefblatt.html haelt bewusst eine eigene Reihe (PB-...) - die bleibt.
for f in index.html admin.html fahrplan.html maschine.html maschine-lauf.html \
         marken-domains.html riki-kosten.html steuerung.html; do
  [ -f "$f" ] || continue
  perl -pi -e "s/\?v=(?!PB-)[0-9A-Za-z.-]+/?v=$NEU/g" "$f"
done

echo "Web steht jetzt auf $NEU (vorher $ALT)"
echo "Nicht vergessen: in Xcode MARKETING_VERSION=$VERSION und CURRENT_PROJECT_VERSION=$BAU"
