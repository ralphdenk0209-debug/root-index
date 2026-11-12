#!/bin/bash
# =============================================================================
#  Root Index · Produktseiten, Sitemap und robots.txt nachts auf dem Mac bauen
#  (11.11.2026, Ralph: Variante 1 „GitHub nur Backup“; ersetzt produktseiten.yml)
# -----------------------------------------------------------------------------
#  Laeuft einmal pro Nacht ueber launchd (verpasst der Mac die Zeit, weil er
#  schlaeft, holt launchd den Lauf nach dem Aufwachen nach). Baut im
#  Auslieferungs-Worktree, committet nur bei Aenderungen, pusht auf main und
#  ruft danach den Webspace-Waechter, der die geaenderten Seiten hochlaedt.
#  Schlaegt der Generator fehl, wird nichts committet.
# =============================================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="${RI_REPO:-$HOME/cleanbase-web}"
BASIS="$HOME/Library/Application Support/RootIndex-Deploy"
WT="$BASIS/stand"
LOG="$HOME/Library/Logs/root-index-produktseiten.log"
SPERRE="$BASIS/sperre"
HIER="$(cd "$(dirname "$0")" && pwd)"

log(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; [ -t 1 ] && echo "$*"; return 0; }
melden(){ log "FEHLER: $*"; osascript -e "display notification \"$*\" with title \"Root Index Produktseiten\"" >/dev/null 2>&1 || true; }

# Sperre teilen mit dem Waechter (bis 10 Minuten warten, falls er gerade laeuft)
for i in $(seq 1 60); do mkdir "$SPERRE" 2>/dev/null && break; sleep 10; done
[ -d "$SPERRE" ] || { melden "Sperre belegt - Lauf ausgelassen"; exit 1; }
trap 'rmdir "$SPERRE" 2>/dev/null' EXIT

git -C "$REPO" fetch -q origin main || { melden "git fetch fehlgeschlagen"; exit 1; }
[ -e "$WT/.git" ] || git -C "$REPO" worktree add -q -f --detach "$WT" origin/main || { melden "Worktree fehlt"; exit 1; }
git -C "$WT" checkout -q -f --detach origin/main || exit 1
START=$(date +%s)
log "Start auf $(git -C "$WT" rev-parse --short=12 HEAD)"

cd "$WT"
if ! node _werkzeuge/produktseiten-generieren.mjs >> "$LOG" 2>&1; then melden "Generator fehlgeschlagen - nichts veroeffentlicht"; exit 1; fi
node _werkzeuge/produktseiten-international.mjs >> "$LOG" 2>&1 || log "International fehlgeschlagen - deutsche Seiten laufen weiter."

# Gegenmessen: nichts Leeres veroeffentlichen (wie bisher im Workflow)
# find statt ls produkt/*.html: bei ueber 60.000 Dateien ist die Argumentliste
# fuer ls zu lang, ls scheitert still und zaehlt 0 (Nachtlauf 12.11. 03:55)
SEITEN=$(find produkt -maxdepth 1 -name '*.html' 2>/dev/null | wc -l | tr -d ' ')
URLS=$(grep -c "<loc>" sitemap-top.xml 2>/dev/null || echo 0)
if [ "$SEITEN" -lt 1000 ] || [ "$URLS" -lt 1000 ] || [ ! -s robots.txt ]; then
  melden "Gegenmessung fehlgeschlagen (Seiten $SEITEN, Sitemap $URLS) - nichts veroeffentlicht"; git checkout -q -f HEAD; exit 1
fi

git add -A produkt sitemap.xml sitemap-top.xml robots.txt
git add -A -- 'sitemap-de-*.xml' 2>/dev/null || true
git add -A en/product fr/produit sitemap-int.xml 2>/dev/null || true
if git diff --cached --quiet; then log "Nichts geaendert (Seiten $SEITEN) in $(( $(date +%s)-START )) s"; exit 0; fi
N=$(git diff --cached --name-only | wc -l | tr -d ' ')
git -c user.name="root-index-bot" -c user.email="bot@root-index.de" commit -q -m "Produktseiten und Sitemap neu gebaut (Mac, nachts)" || exit 1

# Pushen; wurde inzwischen von anderen gepusht, die eigenen Commits obendrauf setzen
ok=0
for versuch in 1 2 3 4 5 6; do
  if git push -q origin HEAD:main 2>>"$LOG"; then ok=1; break; fi
  git fetch -q origin main && git rebase -q origin/main >>"$LOG" 2>&1 || { git rebase --abort 2>/dev/null; melden "Rebase fehlgeschlagen"; exit 1; }
  sleep $((versuch * 10))
done
[ "$ok" = 1 ] || { melden "Push nach 6 Versuchen nicht durchgekommen"; exit 1; }
log "Gebaut und gepusht: $N Dateien geaendert, Seiten $SEITEN, $(( $(date +%s)-START )) s"

# Sperre freigeben und gleich ausliefern
rmdir "$SPERRE" 2>/dev/null; trap - EXIT
bash "$HIER/webspace-waechter.sh"
