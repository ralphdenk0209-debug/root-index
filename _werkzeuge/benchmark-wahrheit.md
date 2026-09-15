# Der Benchmark als Ampel — und warum er vorher nichts gemessen hat

Stand 15.09.2026

## Befund: der Prüfling kannte die Lösung

Der Job-Payload für den Benchmark-Worker enthielt `expected_state` — den
vollständigen Sollwert. Der Worker hat ihn wörtlich in den Prompt geschrieben:

```
EXPECTED_STATE: {"gtin":"7622202356797","pack_size":"195 g", …}
```

Dazu der Satz „expected_state ist NUR die spätere Testvorgabe, KEINE
Faktenquelle". Das ist kein Riegel, das ist eine Bitte. **Jedes PASS der beiden
Capability-Fälle ist damit kein Beleg**, und das eine FAIL auch nicht.

Zwei weitere Löcher im selben Weg:

- Der Worker **benotete sich selbst**: er schickte `status` und eine eigene
  `grades`-Liste mit `grader_name: agent_expected_state_v1`.
- Sein Textvergleich war ein **Teilstring**-Vergleich (`b.includes(a)`). Eine
  lange Prosa, die das Sollwort irgendwo nennt, bestand.

## Was jetzt gilt

| | vorher | nachher |
|---|---|---|
| Sollwert im Job-Payload | ja | **verboten** (`benchmark_job_ohne_sollwert`) |
| Wer entscheidet bestanden | der Prüfling | **nur die Datenbank** |
| Textvergleich | Teilstring | **normalisiert, vollständig** |
| Fälle mit Messung | 4 (davon 2 mit Lösung im Prompt) | **2 ehrlich**, 2 offen |

- `alter table shadow_v1.benchmark_control_job add constraint
  benchmark_job_ohne_sollwert check (not (payload ? 'expected_state'))` — kein
  Weg, auch kein künftiger, kann den Sollwert mehr herausgeben. Der Agent
  bekommt stattdessen `zu_berichtende_schluessel`: die Namen, nicht die Werte.
- `public.cb_benchmark_agent_job_finish_v3(job, dimensions, evidence, …)` — der
  Kandidat berichtet Werte und Belege, sonst nichts. Status und Grades entstehen
  in der Datenbank.
- `cb_benchmark_agent_job_finish` und `…_v2` sind **stillgelegt** und werfen eine
  Ausnahme mit Verweis auf v3. Lieber ein lautes Scheitern als ein stilles PASS.
- Die 47 Läufe, die unter dem alten Vertrag entstanden sind, tragen jetzt
  `metadata.sollwert_lag_im_prompt = true`. Die Ampel zählt sie **nicht** als
  Messung.

## Die Vergleichsregel, aufgeschrieben

`shadow_v1.benchmark_wert_gleich(soll, ist)`:

- Zahlen exakt (`numeric`), Wahrheitswerte exakt, `null` nur gegen `null`.
- Text: klein, ohne Akzente, ohne Sonderzeichen — dann **gleich**, nicht
  enthalten. „Ja, Guarkernmehl vs Johannisbrotkernmehl, siehe Quelle" besteht
  gegen „Guarkernmehl vs Johannisbrotkernmehl" **nicht**.
- Objekte/Listen: jsonb-Gleichheit.
- Ein nicht-`null`-Wert ohne mindestens eine URL in `evidence_by_key` ist FAIL.
- Ein nicht berichteter Schlüssel ist FAIL, kein Schweigen.

Gegengemessen an einem Wegwerflauf (danach gelöscht): 1 Wert falsch → fail,
1 Beleg fehlt → fail, 1 Schlüssel verschwiegen → fail, alles richtig → pass.

### Die Falle dabei: dreiwertige Logik
`jsonb_typeof(NULL)` ist `NULL`, nicht `'null'`. Der erste Entwurf ergab für
einen fehlenden Beleg-Schlüssel `NULL`, und `if not NULL` ist nicht wahr — der
Fall wäre durchgerutscht und hätte bestanden. **Jede Prüfbedingung in ein
`coalesce(…, false)`.** Ohne die Gegenprobe wäre das nicht aufgefallen.

## Die Ampel

`public.cb_benchmark_ampel()`, gebunden in `pcc_root_index_status()->'benchmark'`.

- **rot**: ein kritischer Fall nicht bestanden, oder nie gemessen
- **gelb**: ein unkritischer Fall nicht bestanden · ein Fall ohne Messung ·
  ein Fall länger als 7 Tage nicht gemessen
- **grün**: alle Fälle gemessen, alle bestanden, jede Messung frisch

Das Alter zählt vom **ältesten** Fall, nicht vom neuesten. Sonst macht eine
frische Messung von zwei Fällen die beiden anderen mit frisch.

Stand heute: **gelb** — „2 von 4 Fällen ohne Messung — Schweigen ist kein
Bestehen". Die beiden Regressionsfälle (P73644, P73650) sind in der Datenbank
messbar, kosten nichts und stehen auf PASS.

## Der Grader kann jetzt eine Sache mehr

`nutrition_complete` hatte serverseitig keinen Messwert; der Grader verweigerte
deshalb korrekt das PASS („aus einem ungeprüften Sollwert darf kein PASS
abgeleitet werden"). Neu: `public.cb_naehrwerte_vollstaendig(produkt_id)` —
dieselben Felder, die der Wächter `v_score_achse_fehlt_offen` prüft: kcal,
Zucker, gesättigte Fettsäuren, Salz, Eiweiß, und Ballaststoffe außer die
Warenart sagt `darf_fehlen` oder die Zeile trägt „nicht deklariert".
Gegengemessen: 1.986 von 2.000 aktiven Produkten vollständig, 14 lückenhaft —
die Funktion ist kein Gummistempel.

**Eine Hausregel, zwei Leser.** Hätte ich für den Grader eine eigene Definition
von „vollständig" geschrieben, hätte die Maschine zwei Wahrheiten gehabt.

## Was noch offen ist

Der Worker selbst (`benchmark-control-worker`, Edge) ist **tot**: seine Config
steht auf `enabled=false`, und die RPC `cb_benchmark_agent_job_claim`, die er
ruft, existiert nicht. Für die beiden Capability-Fälle braucht es einen neuen
Worker gegen den v3-Vertrag: blind recherchieren, Werte und Belege melden,
nicht benoten. **Das ist eine Änderung an der Maschine und wartet auf Ralphs
„jaja".**
