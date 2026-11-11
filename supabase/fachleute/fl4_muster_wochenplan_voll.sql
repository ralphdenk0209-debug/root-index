-- FL-4 (11.11.2026, Ralph): Musterpraxis-Wochenplan mit vollen Tagen – Frühstück, Snack vormittags,
-- Mittag, Snack nachmittags, Abendessen, Snack abends. Nur die Mustertabelle fl_muster_wochenplan
-- (erfundene Personen), echte Wochenpläne bleiben unberührt. Basiswochen 9.11.–29.11.2026,
-- angezeigt wochenweise verschoben wie das Mustertagebuch. Hauptmahlzeiten = öffentliche Rezepte,
-- Snacks = echte Index-Produkte mit Menge (Titel nennt die Menge).
delete from public.fl_muster_wochenplan;

do $plan$
declare
  d date; p int; sl text; opt text[]; wahl text; i int;
  plan jsonb := '{
    "1": {"Frühstück": ["R:RUed019620fdae4494bb1239134b39e65e","R:RUa8551a611043458d981835948b746b6b","P:P50849:150:Skyr natur mit Beeren"],
          "Snack vormittags": ["P:P190:150:Apfel","P:P195:120:Banane","P:P200:100:Kiwi"],
          "Mittag": ["R:RU7c4e8d2e9b604f7dbd410660d9921d0d","R:RUed8d26e55b1e41fbb75092be7ce443ac","R:R103"],
          "Snack nachmittags": ["P:P72457:150:Naturjoghurt","P:P286:100:Karotten-Sticks","P:P33754:20:Mandeln"],
          "Abendessen": ["R:RU556721c9e2d840dbbb66ea21f854c071","R:RUa1c57e78a1d14da5bc5fac615d754992","R:RU5c58a0cd555247379af2000b8dbf6908"],
          "Snack abends": ["R:RU37c7677cd2d24dfa8e9328b249ea859a","P:P211:150:Birne","P:P236:100:Clementine"]},
    "2": {"Frühstück": ["R:RUed019620fdae4494bb1239134b39e65e","R:RU6b28c43176d643d3bbfbbb56b3e1f75f","P:P53326:100:Vollkornbrot mit Frischkäse"],
          "Snack vormittags": ["P:P190:150:Apfel","P:P286:120:Karotten-Sticks","P:P361:20:Walnüsse"],
          "Mittag": ["R:RUed8d26e55b1e41fbb75092be7ce443ac","R:RUa1c57e78a1d14da5bc5fac615d754992","R:RU7c4e8d2e9b604f7dbd410660d9921d0d"],
          "Snack nachmittags": ["R:RU9307c2bd93ea4c5c85bd2f9edf53d8c2","P:P50849:150:Skyr natur","P:P211:150:Birne"],
          "Abendessen": ["R:RU556721c9e2d840dbbb66ea21f854c071","R:RU5c58a0cd555247379af2000b8dbf6908","R:R103"],
          "Snack abends": ["P:P33754:20:Mandeln","P:P292:150:Gurken-Sticks","P:P168:150:Erdbeeren"]},
    "3": {"Frühstück": ["R:RU6b28c43176d643d3bbfbbb56b3e1f75f","R:RU9d8aa1b6dcc94bd5bc167b0541e40506","R:RUa8551a611043458d981835948b746b6b"],
          "Snack vormittags": ["P:P195:120:Banane","P:P227:180:Orange","P:P200:100:Kiwi"],
          "Mittag": ["R:RUed8d26e55b1e41fbb75092be7ce443ac","R:RU7c4e8d2e9b604f7dbd410660d9921d0d","R:R103"],
          "Snack nachmittags": ["R:RU9307c2bd93ea4c5c85bd2f9edf53d8c2","P:P58907:60:Hummus mit Gemüse","P:P50849:150:Skyr natur"],
          "Abendessen": ["R:RU5c58a0cd555247379af2000b8dbf6908","R:RU556721c9e2d840dbbb66ea21f854c071","R:RUed8d26e55b1e41fbb75092be7ce443ac"],
          "Snack abends": ["R:RU37c7677cd2d24dfa8e9328b249ea859a","P:P33754:25:Mandeln","P:P180:125:Heidelbeeren"]},
    "4": {"Frühstück": ["R:RUed019620fdae4494bb1239134b39e65e","P:P395:40:Haferflocken mit laktosefreier Milch","P:P10706:60:Brötchen mit Frischkäse (laktosefrei)"],
          "Snack vormittags": ["P:P211:120:Birne","P:P236:80:Clementine","P:P195:100:Banane"],
          "Mittag": ["R:RUa1c57e78a1d14da5bc5fac615d754992","R:RU556721c9e2d840dbbb66ea21f854c071","P:P73762:200:Pellkartoffeln mit Ei"],
          "Snack nachmittags": ["P:P361:15:Walnüsse","P:P190:120:Apfel","P:P41672:100:Körniger Frischkäse (laktosefrei)"],
          "Abendessen": ["P:P53326:60:Vollkornbrot mit Kochschinken","R:R103","P:P281:150:Tomaten mit Ei"],
          "Snack abends": ["P:P236:80:Clementine","P:P200:100:Kiwi","P:P211:120:Birne"]}
  }'::jsonb;
begin
  for d in select generate_series(date '2026-11-09', date '2026-11-29', interval '1 day')::date loop
    for p in 1..4 loop
      i := 0;
      foreach sl in array array['Frühstück','Snack vormittags','Mittag','Snack nachmittags','Abendessen','Snack abends'] loop
        i := i + 1;
        select array_agg(x) into opt from jsonb_array_elements_text(plan->p::text->sl) x;
        -- an manchen Tagen ist ein Snack nicht geplant, wie im echten Leben
        continue when sl like 'Snack%' and abs(0::bigint + hashtext('plan-leer' || p || sl || d)) % 5 = 0;
        wahl := opt[1 + abs(0::bigint + hashtext('plan' || p || sl || d)) % array_length(opt, 1)];
        if wahl like 'R:%' then
          insert into public.fl_muster_wochenplan(benutzer_id, datum, slot, rezept_id, reihenfolge)
          values ('MUSTER-' || p, d, sl, split_part(wahl, ':', 2), i);
        else
          insert into public.fl_muster_wochenplan(benutzer_id, datum, slot, produkt_id, menge_g, titel, reihenfolge)
          values ('MUSTER-' || p, d, sl, split_part(wahl, ':', 2), split_part(wahl, ':', 3)::numeric,
                  split_part(wahl, ':', 4) || ' · ' || split_part(wahl, ':', 3) || ' g', i);
        end if;
      end loop;
    end loop;
  end loop;
end $plan$;
