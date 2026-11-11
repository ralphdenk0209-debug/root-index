#!/bin/bash
# =============================================================================
#  Root Index · Mac-Auslieferung einschalten / ausschalten (launchd)
#  (11.11.2026, Variante 1 „GitHub nur Backup“)
#
#    einrichten.sh an     Waechter alle 2 Min + Produktseiten nachts 03:40
#    einrichten.sh aus    beides abschalten
#    einrichten.sh stand  zeigen, ob es laeuft, und die letzten Protokollzeilen
#
#  Die Skripte laufen aus einer festen Kopie in ~/Library/Application Support/
#  RootIndex-Deploy/werkzeug, damit ein Branchwechsel in ~/cleanbase-web sie
#  nicht verschwinden laesst. Nach Aenderungen an den Skripten: erneut „an“.
# =============================================================================
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"
BASIS="$HOME/Library/Application Support/RootIndex-Deploy"
WZ="$BASIS/werkzeug"
LA="$HOME/Library/LaunchAgents"
W=de.root-index.webspace-waechter
P=de.root-index.produktseiten

plist(){ # $1 label  $2 skript  $3 zeitplan-xml
cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$WZ/$2</string></array>
  $3
  <key>StandardOutPath</key><string>$HOME/Library/Logs/$1.out</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/$1.out</string>
  <key>ProcessType</key><string>Background</string>
</dict></plist>
EOF
}

case "${1:-stand}" in
  an)
    mkdir -p "$WZ" "$LA"
    cp "$HIER/webspace-waechter.sh" "$HIER/produktseiten-nachts.sh" "$WZ/"
    plist $W webspace-waechter.sh '<key>StartInterval</key><integer>120</integer><key>RunAtLoad</key><true/>' > "$LA/$W.plist"
    plist $P produktseiten-nachts.sh '<key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>40</integer></dict>' > "$LA/$P.plist"
    for l in $W $P; do launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; launchctl bootstrap "gui/$(id -u)" "$LA/$l.plist"; done
    echo "An: Waechter alle 2 Minuten, Produktseiten taeglich 03:40."
    ;;
  aus)
    for l in $W $P; do launchctl bootout "gui/$(id -u)/$l" 2>/dev/null || true; rm -f "$LA/$l.plist"; done
    echo "Aus."
    ;;
  stand)
    for l in $W $P; do launchctl print "gui/$(id -u)/$l" >/dev/null 2>&1 && echo "$l: an" || echo "$l: aus"; done
    tail -5 "$HOME/Library/Logs/root-index-deploy.log" 2>/dev/null || true
    tail -3 "$HOME/Library/Logs/root-index-produktseiten.log" 2>/dev/null || true
    ;;
esac
