# Wiederherstellung: was es braucht, wenn alles weg ist

Stand 14.09.2026, gemessen. Gehört zu Go-Live m7 „Backup und Restore echt testen".

## Der Befund vorweg

**Die Datenbank ist der kleinste Teil des Problems.** Sie ist in Supabases
täglichem Backup. Was NICHT darin steckt, entscheidet darüber, ob die Seite nach
einer Wiederherstellung wirklich wieder läuft.

## Bestandsaufnahme (gemessen 14.09.2026)

| Teil | Umfang | im Supabase-Backup? | sonst wo? |
|---|---|---|---|
| Tabellen (public, shadow_v1, control) | 574 | ja | – |
| Funktionen | 923 | ja | – |
| RLS-Regeln | 33 | ja | – |
| Takte (pg_cron) | 43, davon 42 aktiv | ja (`cron.job` ist eine gewöhnliche Tabelle) | – |
| Vault-Geheimnis `service_role_key` | 1 | ja | – |
| **Speicher-Dateien (Storage)** | **6 Dateien, 3,2 MB** | **NEIN** | nirgends |
| Edge-Funktionen | 9 | nein | **ja, im Repo** seit 13.09. |
| Webseite | – | nein | **ja, im Repo** (GitHub Pages) |
| **`ANTHROPIC_API_KEY`** | – | **NEIN** | **nirgends aufgeschrieben** |
| **`SUPABASE_ACCESS_TOKEN`** (GitHub Actions) | – | **NEIN** | nur als GitHub-Secret |

### Die drei echten Lücken

1. **`ANTHROPIC_API_KEY`** steht nur in den Supabase-Funktionseinstellungen. Geht
   das Projekt verloren, steht die Maschine still, bis ein neuer Schlüssel
   angelegt ist. Der Schlüssel gehört NICHT ins Repo — er gehört in Ralphs
   Passwortverwaltung, zusammen mit dem Supabase-Zugangstoken.
2. **Die Speicher-Dateien** (`produktbilder`, `rezeptbilder`) sind in keinem
   Datenbank-Backup. Heute sind es sechs Dateien; nach dem Go-Live werden es
   mehr. Eine eigene Sicherung fehlt.
3. **Es hat noch nie jemand wiederhergestellt.** Ein ungetestetes Backup ist
   kein Backup. Ein echter Test heißt: Supabase-Projekt aus dem Backup in ein
   zweites Projekt zurückspielen und die Seite dagegen starten. Das kostet Geld
   und muss Ralph entscheiden.

## Die Etikettfotos liegen in der Datenbank, nicht im Speicher

Gemessen: `public."Scan_Warteschlange"` ist **125 MB bei 404 Zeilen** —
`Foto_Base64` (text) und `Fotos_Base64` (jsonb) tragen **84 MB Fotos** direkt in
der Tabelle. Der Editor zeigt sie von dort (`cb_produkt_etikettfotos` liest
`Scan_Warteschlange`), sie sind also **Beleg, nicht Abfall** — nicht löschen.

Für die Wiederherstellung ist das gut: die Fotos sind im Datenbank-Backup.
Für den Betrieb ist es teuer: jeder Scan legt rund 450 KB Base64 in die
Datenbank, Base64 ist ein Drittel größer als das Bild selbst, und 115 bereits
erledigte Einträge tragen ihr Foto weiter mit (52 MB). Nach dem Go-Live wächst
das mit jedem Nutzer. **Entscheidung für nach dem Go-Live:** Fotos in den
Speicher auslagern und in der Tabelle nur den Verweis halten — dann braucht der
Speicher aber eine eigene Sicherung (Lücke 2).

## Reihenfolge einer Wiederherstellung

1. Supabase-Projekt aus dem Backup zurückspielen (Datenbank, Auth, Vault).
2. `ANTHROPIC_API_KEY` in den Funktionseinstellungen neu setzen.
3. Prüfen, ob die Takte mitgekommen sind: `select count(*) from cron.job where active;`
   müssen 42 sein. Fehlen sie, aus einem älteren Abzug neu anlegen — siehe unten,
   wie man einen erzeugt.
4. Edge-Funktionen: einmal `Actions -> Edge-Funktionen ausliefern -> alle`
   drücken. Projekt-Referenz in `.github/workflows/edge-funktionen.yml` prüfen.
5. `SUPABASE_ACCESS_TOKEN` in den GitHub-Secrets neu setzen (neue Projekt-Ref).
6. Speicher-Dateien wieder einspielen (Lücke 2 — heute gibt es dafür nichts).
7. Gegenmessen: `select public.cb_waechter_system_erheben();` muss 26 PASS
   liefern, und `select count(*) from public.v_web_produkte;` rund 37.400.

## Takte als Skript herausziehen

Bewusst **kein** `takte-neu-anlegen.sql` im Repo: `cron.job` liegt im
Datenbank-Backup, eine zweite Kopie im Repo würde still veralten und beim
Wiederherstellen den falschen Stand einspielen. Wer einen Abzug braucht,
erzeugt ihn im Moment, in dem er ihn braucht:

```sql
select string_agg(format('select cron.schedule(%L, %L, %L);', jobname, schedule, command),
                  E'\n' order by jobid)
from cron.job where active;
```
