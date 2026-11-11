#!/bin/bash
# =============================================================================
#  Root Index · Mac-Waechter: main -> INWX-Webspace und Supabase-Funktionen
#  (11.11.2026, Ralph: Variante 1 „GitHub nur Backup“)
# -----------------------------------------------------------------------------
#  WARUM: GitHub Actions verbrauchte 1.743 Minuten in 6,6 Tagen; privat gibt es
#  nur 2.000 im Monat gratis. Dieser Waechter ersetzt die Workflows
#  webspace-deploy.yml und edge-funktionen.yml. Fuer die Chats aendert sich
#  nichts: weiter auf main pushen, der Mac liefert aus.
#
#  WIE: launchd ruft das Skript alle 2 Minuten. Es holt origin/main, liest
#  .deploy-sha vom Webspace und laedt nur die seitdem geaenderten Dateien hoch
#  (6 Verbindungen gleichzeitig), entfernt geloeschte, liefert geaenderte
#  Edge-Funktionen per Supabase-CLI aus und schreibt zuletzt .deploy-sha.
#  Ist der Mac aus oder im Ruhezustand, passiert nichts; danach holt er nach.
#
#  Zugang: Schluesselbund-Dienst „root-index-ftp“ (wie Skill inwx-ftp),
#  Supabase-CLI-Anmeldung des Macs. Nichts davon steht in dieser Datei.
#
#  Aufruf:  webspace-waechter.sh            normaler Lauf
#           webspace-waechter.sh --trocken  nur zeigen, was passieren wuerde
#  Protokoll: ~/Library/Logs/root-index-deploy.log
# =============================================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO="${RI_REPO:-$HOME/cleanbase-web}"
BASIS="$HOME/Library/Application Support/RootIndex-Deploy"
WT="$BASIS/stand"                       # eigener Worktree, nur fuer die Auslieferung
LOG="$HOME/Library/Logs/root-index-deploy.log"
SPERRE="$BASIS/sperre"
PROJEKT_REF="haurbpfkfaaehorirzee"
PARALLEL=6
TROCKEN=0; [ "${1:-}" = "--trocken" ] && TROCKEN=1

mkdir -p "$BASIS" "$(dirname "$LOG")"
log(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; [ -t 1 ] && echo "$*"; return 0; }
melden(){ log "FEHLER: $*"; osascript -e "display notification \"$*\" with title \"Root Index Deploy\"" >/dev/null 2>&1 || true; }

# Nur ein Lauf gleichzeitig (auch nicht parallel zum Produktseiten-Lauf)
if ! mkdir "$SPERRE" 2>/dev/null; then
  # Sperre aelter als 3 Stunden = haengengebliebener Lauf
  if [ -n "$(find "$SPERRE" -maxdepth 0 -mmin +180 2>/dev/null)" ]; then rmdir "$SPERRE" 2>/dev/null; mkdir "$SPERRE" || exit 0
  else exit 0; fi
fi
trap 'rmdir "$SPERRE" 2>/dev/null' EXIT

# --- Zugang -------------------------------------------------------------------
kc(){ security find-generic-password -s root-index-ftp -a "$1" -w 2>/dev/null || true; }
H="$(kc server)"; H="${H:-ftp.webspace.bz}"
U="$(kc benutzer)"; U="${U:-kd253566}"
D="$(kc ordner)"; D="${D:-/}"; D="${D%/}"
PROTO="$(kc proto)"; PROTO="${PROTO:-sftp}"
LFTP_PASSWORD="$(kc passwort)"; export LFTP_PASSWORD
[ -z "$LFTP_PASSWORD" ] && { melden "Kein Webspace-Passwort im Schluesselbund (root-index-ftp)."; exit 2; }
ZIEL="$PROTO://$H"
LF_SET="set sftp:auto-confirm yes; set net:max-retries 3; set net:timeout 30; set net:reconnect-interval-base 5; set cmd:fail-exit yes"
[ "$PROTO" = "ftp" ] && LF_SET="$LF_SET; set ftp:ssl-force true; set ftp:ssl-protect-data true"
lf(){ lftp --env-password -u "$U" -e "$LF_SET; $1; bye" "$ZIEL"; }

# --- Was ist neu? ---------------------------------------------------------------
git -C "$REPO" fetch -q origin main 2>>"$LOG" || { melden "git fetch fehlgeschlagen (Netz?)"; exit 1; }
NEU="$(git -C "$REPO" rev-parse origin/main)"
ALT="$(lftp --env-password -u "$U" -e "$LF_SET; cat $D/.deploy-sha; bye" "$ZIEL" 2>/dev/null | tr -dc '0-9a-f' || true)"
# Nur zum Testen: RI_ALT gibt im Trockenlauf einen anderen Ausgangsstand vor
[ "$TROCKEN" = 1 ] && [ -n "${RI_ALT:-}" ] && ALT="$(git -C "$REPO" rev-parse "$RI_ALT")"
if [ -z "$ALT" ]; then melden "Konnte .deploy-sha nicht lesen (Webspace erreichbar?)"; exit 1; fi
[ "$ALT" = "$NEU" ] && exit 0
if ! git -C "$REPO" cat-file -e "$ALT^{commit}" 2>/dev/null || ! git -C "$REPO" merge-base --is-ancestor "$ALT" "$NEU"; then
  melden "Webspace-Stand $ALT ist kein Vorgaenger von main - bitte von Hand pruefen (nichts hochgeladen)."
  exit 1
fi

# --- Eigenen Worktree auf den neuen Stand bringen ----------------------------
if [ ! -e "$WT/.git" ]; then
  log "Lege Auslieferungs-Worktree an: $WT"
  git -C "$REPO" worktree add -f --detach "$WT" "$NEU" >>"$LOG" 2>&1 || { melden "Worktree anlegen fehlgeschlagen"; exit 1; }
fi
git -C "$WT" checkout -q -f --detach "$NEU" 2>>"$LOG" || { melden "Worktree auf $NEU fehlgeschlagen"; exit 1; }

# --- Aenderungsliste ------------------------------------------------------------
AUSSCHLUSS='^(\.git/|\.github/|_werkzeuge/|_to_delete/|supabase/|node_modules/|XXoxtEqm|README\.md$|Links\.md$|CNAME$|version\.sh$|.*\.zip$|.*\.DS_Store$|.*\.fuse_hidden.*|\.gitignore$)'
ARB="$(mktemp -d "$BASIS/lauf.XXXXXX")"
git -C "$WT" diff --name-status --no-renames "$ALT" "$NEU" > "$ARB/alle.txt"
awk -F'\t' '$1!="D"{print $2}' "$ARB/alle.txt" | grep -Ev "$AUSSCHLUSS" > "$ARB/hoch.txt" || true
awk -F'\t' '$1=="D"{print $2}' "$ARB/alle.txt" | grep -Ev "$AUSSCHLUSS" > "$ARB/weg.txt" || true
cut -f2 "$ARB/alle.txt" | grep -E '^supabase/functions/[^_/][^/]*/' | awk -F/ '{print $3}' | sort -u > "$ARB/funktionen.txt" || true
# Geteilter Code (_shared) geaendert -> alle Funktionen, die ihn benutzen
if grep -q '^supabase/functions/_' <(cut -f2 "$ARB/alle.txt"); then
  grep -rl '\.\./_' "$WT/supabase/functions"/*/index.ts 2>/dev/null | awk -F/ '{print $(NF-1)}' >> "$ARB/funktionen.txt"
  sort -u -o "$ARB/funktionen.txt" "$ARB/funktionen.txt"
fi
N_HOCH=$(wc -l < "$ARB/hoch.txt" | tr -d ' '); N_WEG=$(wc -l < "$ARB/weg.txt" | tr -d ' '); N_FN=$(wc -l < "$ARB/funktionen.txt" | tr -d ' ')
log "Lauf ${ALT:0:12} -> ${NEU:0:12}: $N_HOCH hoch, $N_WEG weg, $N_FN Funktion(en)$([ $TROCKEN = 1 ] && echo ' [TROCKEN]')"

if [ "$TROCKEN" = 1 ]; then
  head -20 "$ARB/hoch.txt" | sed 's/^/  hoch: /'; head -5 "$ARB/weg.txt" | sed 's/^/  weg:  /'; sed 's/^/  Funktion: /' "$ARB/funktionen.txt"
  rm -rf "$ARB"; exit 0
fi

START=$(date +%s); FEHLER=0

# --- Hochladen: Ordner anlegen, dann in $PARALLEL Verbindungen -----------------
if [ "$N_HOCH" -gt 0 ]; then
  # Ordner einmal anlegen (nur die, in denen sich etwas aendert)
  { echo "$LF_SET"; echo "open --env-password -u \"$U\" $ZIEL"; echo "set cmd:fail-exit no"
    sed -n 's#/[^/]*$##p' "$ARB/hoch.txt" | sort -u | sed "s#.*#mkdir -p -f \"$D/&\"#"; echo bye; } > "$ARB/ordner.lftp"
  lftp -f "$ARB/ordner.lftp" >>"$LOG" 2>&1 || true
  # Liste reihum auf $PARALLEL Verbindungen verteilen
  awk -v n="$PARALLEL" -v d="$ARB" -v D="$D" -v W="$WT" '{
      p=$0; o=p; if (sub(/\/[^\/]*$/, "", o) == 0) o=".";
      printf "put -O \"%s/%s\" \"%s/%s\"\n", D, o, W, p > (d "/teil." (NR % n)) }' "$ARB/hoch.txt"
  for t in "$ARB"/teil.*; do
    { echo "$LF_SET"; echo "open --env-password -u \"$U\" $ZIEL"; cat "$t"; echo bye; } > "$t.lftp"
    ( lftp -f "$t.lftp" >>"$LOG" 2>&1 || echo "$t" >> "$ARB/fehler.txt" ) &
  done
  wait
  [ -s "$ARB/fehler.txt" ] && { FEHLER=1; melden "Hochladen teilweise fehlgeschlagen ($(wc -l < "$ARB/fehler.txt" | tr -d ' ') von $PARALLEL Verbindungen)"; }
fi

# --- Entfernen ------------------------------------------------------------------
if [ "$FEHLER" = 0 ] && [ "$N_WEG" -gt 0 ]; then
  { echo "$LF_SET"; echo "open --env-password -u \"$U\" $ZIEL"; echo "set cmd:fail-exit no"; sed "s#.*#rm -f \"$D/&\"#" "$ARB/weg.txt"; echo bye; } > "$ARB/weg.lftp"
  lftp -f "$ARB/weg.lftp" >>"$LOG" 2>&1 || log "Hinweis: einige Dateien zum Entfernen fehlten schon."
fi

# --- Edge-Funktionen ------------------------------------------------------------
if [ "$FEHLER" = 0 ] && [ "$N_FN" -gt 0 ]; then
  while read -r fn; do
    [ -z "$fn" ] && continue
    if [ ! -d "$WT/supabase/functions/$fn" ]; then log "Funktion $fn im Repo geloescht - bleibt bei Supabase (von Hand entfernen)"; continue; fi
    if (cd "$WT" && supabase functions deploy "$fn" --project-ref "$PROJEKT_REF" --yes >>"$LOG" 2>&1); then log "Funktion $fn ausgeliefert"
    else FEHLER=1; melden "Funktion $fn konnte nicht ausgeliefert werden"; fi
  done < "$ARB/funktionen.txt"
fi

# --- Stand festhalten (nur wenn alles geklappt hat) ---------------------------
if [ "$FEHLER" = 0 ]; then
  echo "$NEU" > "$ARB/.deploy-sha"
  if lf "put -O \"$D/\" \"$ARB/.deploy-sha\"" >>"$LOG" 2>&1; then log "Fertig ${NEU:0:12} in $(( $(date +%s) - START )) s"
  else melden ".deploy-sha konnte nicht geschrieben werden"; fi
else
  log "Abgebrochen - .deploy-sha bleibt auf ${ALT:0:12}, naechster Lauf versucht es erneut."
fi
rm -rf "$ARB"
exit $FEHLER
