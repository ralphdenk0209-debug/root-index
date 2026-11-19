-- 19.11.2026 (Ralph: Admin › Benutzer „canceling statement due to statement timeout“)
-- cb_users_list zählte je Nutzer die Produkte über "Angelegt_Von" ohne Index (137 × Seq-Scan über Produkte): 6,1 s,
-- unter Last über dem 8-s-Limit. Mit Index: 0,1 s. Live eingespielt per execute_sql (concurrently, keine Schreibsperre).
create index concurrently if not exists idx_produkte_angelegt_von on public."Produkte" ("Angelegt_Von") where "Angelegt_Von" is not null;
