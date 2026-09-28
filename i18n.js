/* Sprache je Land (28.09.2026, Ralph „go“, I25 Schritt 1).
   Land aus der Laenderwahl (localStorage ri_markt): UK/US -> Englisch, FR -> Franzoesisch, sonst Deutsch.
   Bei Deutsch tut dieses Skript NICHTS – die deutsche Seite bleibt Zeichen fuer Zeichen gleich.
   Uebersetzt wird nur Anzeigetext (Textknoten + placeholder/title/aria-label), exakt nach dem deutschen Wortlaut.
   Zutaten- und Kategorienamen kommen aus der Datenbank (cb_anzeigenamen, Tabellen Zutat_Anzeigename /
   Kategorie_Anzeigename) und werden je Sitzung einmal geladen. Fachlogik und Bewertung bleiben unberuehrt. */
(function(){
  var m = 'DE';
  try { m = String(localStorage.getItem('ri_markt') || 'DE').toUpperCase(); } catch (e) {}
  var L = (m === 'UK' || m === 'US') ? 'en' : (m === 'FR' ? 'fr' : 'de');
  window.RI_LANG = L;
  if (L === 'de') return;
  try { document.documentElement.lang = L; } catch (e) {}
  var I = L === 'en' ? 0 : 1;

  /* deutsch : [englisch, französisch] */
  var D = {
    'Root Index – Echte Qualität, Transparenz & smarte Ernährung': ['Root Index – real quality, transparency & smart nutrition', 'Root Index – vraie qualité, transparence & alimentation intelligente'],
    'Die Vorderseite verkauft.': ['The front sells.', 'Le recto fait vendre.'],
    'Wir lesen die Rückseite.': ['We read the back.', 'Nous lisons le verso.'],
    'Überspringen ›': ['Skip ›', 'Passer ›'],
    'Zur Startseite': ['Home', 'Accueil'],
    'Echte Qualität, Transparenz & smarte Ernährung.': ['Real quality, transparency & smart nutrition.', 'Vraie qualité, transparence & alimentation intelligente.'],
    'Unabhängige, wissenschaftsbasierte Bewertung – der Root Index (0–100).': ['Independent, science-based rating – the Root Index (0–100).', 'Évaluation indépendante et scientifique – le Root Index (0–100).'],
    'Anmelden': ['Sign in', 'Se connecter'],
    '100 % unabhängig – nicht käuflich': ['100 % independent – not for sale', '100 % indépendant – pas à vendre'],
    'Wissenschaftlich – feste Regeln': ['Scientific – fixed rules', 'Scientifique – règles fixes'],
    'Transparent – wir raten nicht': ['Transparent – we don\'t guess', 'Transparent – nous ne devinons pas'],
    'Für dich – scannen, fertig': ['For you – scan, done', 'Pour vous – scannez, c\'est fait'],
    'Produkte': ['Products', 'Produits'],
    'Rezepte': ['Recipes', 'Recettes'],
    'Produkt erfassen': ['Add product', 'Ajouter un produit'],
    'Tagebuch': ['Diary', 'Journal'],
    'Planer': ['Planner', 'Planificateur'],
    'Training': ['Training', 'Entraînement'],
    'Mein Profil': ['My profile', 'Mon profil'],
    'Supplements': ['Supplements', 'Compléments'],
    'Produkt, Marke oder Kategorie suchen…': ['Search product, brand or category…', 'Rechercher un produit, une marque ou une catégorie…'],
    '📷 Barcode scannen': ['📷 Scan barcode', '📷 Scanner le code-barres'],
    'Barcode scannen': ['Scan barcode', 'Scanner le code-barres'],
    'Lade Daten…': ['Loading data…', 'Chargement des données…'],
    'Lade Rezepte…': ['Loading recipes…', 'Chargement des recettes…'],
    'Lade…': ['Loading…', 'Chargement…'],
    'Wird geladen …': ['Loading …', 'Chargement …'],
    '⏳ Produkte werden geladen …': ['⏳ Loading products …', '⏳ Chargement des produits …'],
    'Zutaten eingeben – Riki schlägt Rezepte passend zu deinem Kalorienbedarf vor': ['Enter ingredients – Riki suggests recipes matching your calorie needs', 'Saisissez des ingrédients – Riki propose des recettes adaptées à vos besoins caloriques'],
    '🍳 Was koche ich?': ['🍳 What should I cook?', '🍳 Que cuisiner ?'],
    'Rezept abfotografieren - Riki fuellt es aus': ['Photograph a recipe – Riki fills it in', 'Photographiez une recette – Riki la remplit'],
    '📷 Abfotografieren': ['📷 Take photo', '📷 Photographier'],
    '+ Eigenes Rezept': ['+ Own recipe', '+ Ma recette'],
    'Rezept suchen…': ['Search recipes…', 'Rechercher une recette…'],
    '♥ nur Favoriten anzeigen': ['♥ favourites only', '♥ favoris uniquement'],
    '🛒 Einkaufsliste': ['🛒 Shopping list', '🛒 Liste de courses'],
    '🛒 Zur Einkaufsliste': ['🛒 Add to shopping list', '🛒 Ajouter à la liste de courses'],
    'Produkte und Rezept-Zutaten sammeln, beim Einkauf abhaken. Aus dem Wochenplan lässt sie sich automatisch erzeugen.': ['Collect products and recipe ingredients, tick them off while shopping. It can be created automatically from the weekly plan.', 'Rassemblez produits et ingrédients, cochez-les pendant les courses. Elle peut être créée automatiquement à partir du planning.'],
    'oder Link einfügen – wir holen die Daten und legen das Produkt als': ['or paste a link – we fetch the data and create the product as a', 'ou collez un lien – nous récupérons les données et créons le produit en'],
    'Entwurf': ['draft', 'brouillon'],
    'an. Es wird geprüft, bevor es öffentlich erscheint.': ['. It is checked before it is published.', '. Il est vérifié avant publication.'],
    'Produkt-Link oder Barcode (EAN)…': ['Product link or barcode (EAN)…', 'Lien produit ou code-barres (EAN)…'],
    'Senden': ['Send', 'Envoyer'],
    'Produkt hat keinen Barcode?': ['Product has no barcode?', 'Le produit n\'a pas de code-barres ?'],
    'Etikett-Fotos – Zutatenliste ist Pflicht': ['Label photos – ingredient list required', 'Photos de l\'étiquette – liste des ingrédients obligatoire'],
    'Foto(s) erfassen': ['Take photo(s)', 'Prendre des photos'],
    'Scharf & formatfüllend. Riki liest die Zutatenliste und die Nährwerttabelle; die Vorderseite hilft beim Namen.': ['Sharp and filling the frame. Riki reads the ingredient list and the nutrition table; the front helps with the name.', 'Nette et plein cadre. Riki lit la liste des ingrédients et le tableau nutritionnel ; le recto aide pour le nom.'],
    '📊 Statistik': ['📊 Statistics', '📊 Statistiques'],
    '🥗 Nährstoffe': ['🥗 Nutrients', '🥗 Nutriments'],
    'Tag zurück': ['Previous day', 'Jour précédent'],
    'Heute': ['Today', 'Aujourd\'hui'],
    'Tag vor': ['Next day', 'Jour suivant'],
    '📅 Kalender': ['📅 Calendar', '📅 Calendrier'],
    'Kalender': ['Calendar', 'Calendrier'],
    '🔍 Lebensmittel, Marke suchen…': ['🔍 Search food, brand…', '🔍 Rechercher un aliment, une marque…'],
    'Gewicht': ['Weight', 'Poids'],
    'Speichern': ['Save', 'Enregistrer'],
    'Mahlzeiten': ['Meals', 'Repas'],
    'Woche': ['Week', 'Semaine'],
    'Tag': ['Day', 'Jour'],
    'Zum Plan hinzufügen': ['Add to plan', 'Ajouter au planning'],
    'Rezept': ['Recipe', 'Recette'],
    '– Rezept wählen –': ['– choose recipe –', '– choisir une recette –'],
    '— oder —': ['— or —', '— ou —'],
    'Produkt': ['Product', 'Produit'],
    'Produkt aus Liste…': ['Product from list…', 'Produit de la liste…'],
    'Hinzufügen': ['Add', 'Ajouter'],
    'Abbrechen': ['Cancel', 'Annuler'],
    'Mahlzeit': ['Meal', 'Repas'],
    'Sonstiges': ['Other', 'Autre'],
    'Daten': ['Data', 'Données'],
    'Ziele': ['Goals', 'Objectifs'],
    'Körpermaße': ['Body measurements', 'Mensurations'],
    '📐 Körpermaße': ['📐 Body measurements', '📐 Mensurations'],
    'App & Konto': ['App & account', 'Appli & compte'],
    'Persönliche Daten': ['Personal data', 'Données personnelles'],
    'E-Mail:': ['Email:', 'E-mail :'],
    'Name (wird oben angezeigt)': ['Name (shown at the top)', 'Nom (affiché en haut)'],
    'Dein Name': ['Your name', 'Votre nom'],
    'Geburtsdatum': ['Date of birth', 'Date de naissance'],
    'Alter': ['Age', 'Âge'],
    '(aus Geburtsdatum)': ['(from date of birth)', '(d\'après la date de naissance)'],
    'Geschlecht': ['Sex', 'Sexe'],
    'weiblich': ['female', 'femme'],
    'männlich': ['male', 'homme'],
    'divers': ['diverse', 'autre'],
    'Größe (cm)': ['Height (cm)', 'Taille (cm)'],
    'Gewicht (kg)': ['Weight (kg)', 'Poids (kg)'],
    'Aktivitätslevel': ['Activity level', 'Niveau d\'activité'],
    'Sitzend': ['Sedentary', 'Sédentaire'],
    'Leicht aktiv': ['Lightly active', 'Légèrement actif'],
    'Mäßig aktiv': ['Moderately active', 'Modérément actif'],
    'Sehr aktiv': ['Very active', 'Très actif'],
    'Ernährungsform': ['Diet', 'Régime alimentaire'],
    'Omnivor (isst alles, auch Fleisch & Fisch)': ['Omnivore (eats everything, incl. meat & fish)', 'Omnivore (mange de tout, viande & poisson inclus)'],
    'Flexitarisch (überwiegend pflanzlich, selten Fleisch/Fisch)': ['Flexitarian (mostly plant-based, rarely meat/fish)', 'Flexitarien (surtout végétal, rarement viande/poisson)'],
    'Pescetarisch (Fisch & Meeresfrüchte, kein Fleisch)': ['Pescatarian (fish & seafood, no meat)', 'Pescétarien (poisson & fruits de mer, pas de viande)'],
    'Vegetarisch (kein Fleisch & Fisch, aber Milch/Ei)': ['Vegetarian (no meat & fish, but dairy/eggs)', 'Végétarien (ni viande ni poisson, mais lait/œufs)'],
    'Vegan (keine tierischen Produkte)': ['Vegan (no animal products)', 'Végan (aucun produit animal)'],
    '(freiwillig)': ['(optional)', '(facultatif)'],
    'Keine Angabe': ['Not specified', 'Non précisé'],
    'Sonstiger': ['Other', 'Autre'],
    'Schwanger': ['Pregnant', 'Enceinte'],
    'Stillend': ['Breastfeeding', 'Allaitante'],
    'Schwangerschaft / Stillzeit': ['Pregnancy / breastfeeding', 'Grossesse / allaitement'],
    '💪 Trainingstage': ['💪 Training days', '💪 Jours d\'entraînement'],
    'Zuschlag': ['Surcharge', 'Supplément'],
    '% mehr Kalorien': ['% more calories', '% de calories en plus'],
    'Newsletter abonnieren – Infos zu neuen Produkten & Rezepten': ['Subscribe to the newsletter – news on products & recipes', 'S\'abonner à la newsletter – nouveaux produits & recettes'],
    '🔐 Konto & Sicherheit': ['🔐 Account & security', '🔐 Compte & sécurité'],
    'Passwort für die Anmeldung setzen oder ändern (mind. 6 Zeichen):': ['Set or change your sign-in password (min. 6 characters):', 'Définir ou modifier le mot de passe (6 caractères min.) :'],
    'Neues Passwort': ['New password', 'Nouveau mot de passe'],
    'Passwort speichern': ['Save password', 'Enregistrer le mot de passe'],
    'Keine medizinische Beratung.': ['Not medical advice.', 'Pas un conseil médical.'],
    'leicht': ['light', 'léger'],
    'mittel': ['medium', 'moyen'],
    'stark': ['heavy', 'fort'],
    'Wohlbefinden': ['Wellbeing', 'Bien-être'],
    '😣 schlecht': ['😣 bad', '😣 mauvais'],
    '😐 ok': ['😐 ok', '😐 ok'],
    '🙂 gut': ['🙂 good', '🙂 bien'],
    '😀 top': ['😀 great', '😀 top'],
    'Kalorienbedarf berechnen': ['Calculate calorie needs', 'Calculer les besoins caloriques'],
    'Zielgewicht (kg)': ['Target weight (kg)', 'Poids cible (kg)'],
    'Tempo': ['Pace', 'Rythme'],
    'Gewicht halten': ['Maintain weight', 'Maintenir le poids'],
    'Abnehmen – moderat (−15 %)': ['Lose weight – moderate (−15 %)', 'Perdre du poids – modéré (−15 %)'],
    'Abnehmen – zügig (−20 %)': ['Lose weight – fast (−20 %)', 'Perdre du poids – rapide (−20 %)'],
    'Aufbauen (+10 %)': ['Build up (+10 %)', 'Prise de masse (+10 %)'],
    'Eiweiß (g/kg)': ['Protein (g/kg)', 'Protéines (g/kg)'],
    'Zielgewicht': ['Target weight', 'Poids cible'],
    'Aktuelles Gewicht': ['Current weight', 'Poids actuel'],
    'Körperfett %': ['Body fat %', 'Masse grasse %'],
    'Berechnen': ['Calculate', 'Calculer'],
    'Als Tagesziel übernehmen': ['Use as daily goal', 'Utiliser comme objectif du jour'],
    'Tagesziele': ['Daily goals', 'Objectifs du jour'],
    'Eiweiß (g)': ['Protein (g)', 'Protéines (g)'],
    'KH max (g)': ['Carbs max (g)', 'Glucides max (g)'],
    'Fett max (g)': ['Fat max (g)', 'Lipides max (g)'],
    'Ziele speichern': ['Save goals', 'Enregistrer les objectifs'],
    'Frühstück %': ['Breakfast %', 'Petit-déjeuner %'],
    'Mittag %': ['Lunch %', 'Déjeuner %'],
    'Abendessen %': ['Dinner %', 'Dîner %'],
    'Snack %': ['Snack %', 'Collation %'],
    'Anteile speichern': ['Save shares', 'Enregistrer la répartition'],
    'Root Index hilft dir, bessere Entscheidungen zu treffen – schnell, einfach und vertrauenswürdig.': ['Root Index helps you make better choices – fast, simple and trustworthy.', 'Root Index vous aide à mieux choisir – vite, simplement et en toute confiance.'],
    'Root Index liefert Informationen zur Zusammensetzung von Lebensmitteln. Es ist': ['Root Index provides information on the composition of food. It is', 'Root Index fournit des informations sur la composition des aliments. Ce n\'est'],
    'keine medizinische oder ernährungstherapeutische Beratung': ['not medical or dietary advice', 'pas un conseil médical ou diététique'],
    'und ersetzt keine ärztliche Abklärung.': ['and does not replace seeing a doctor.', 'et ne remplace pas un avis médical.'],
    'Einkauf': ['Shopping', 'Courses'],
    'Scannen': ['Scan', 'Scanner'],
    'Menü': ['Menu', 'Menu'],
    'Schließen ✕': ['Close ✕', 'Fermer ✕'],
    'Ohne Passwort: wir schicken dir einen': ['No password: we send you a', 'Sans mot de passe : nous vous envoyons un'],
    '6-stelligen Code': ['6-digit code', 'code à 6 chiffres'],
    'an deine E-Mail.': ['by email.', 'par e-mail.'],
    'deine@email.de': ['you@email.com', 'vous@email.fr'],
    'Passwort': ['Password', 'Mot de passe'],
    'Mit Passwort anmelden': ['Sign in with password', 'Se connecter avec mot de passe'],
    'Passwort vergessen?': ['Forgot password?', 'Mot de passe oublié ?'],
    'Neu hier? Konto mit Passwort erstellen': ['New here? Create an account with password', 'Nouveau ? Créer un compte avec mot de passe'],
    'Code an E-Mail senden': ['Send code by email', 'Envoyer le code par e-mail'],
    '6-stelliger Code aus der E-Mail': ['6-digit code from the email', 'Code à 6 chiffres reçu par e-mail'],
    'Zurück': ['Back', 'Retour'],
    'Nach oben': ['Back to top', 'Haut de page'],
    'Produktverzeichnis – alle bewerteten Produkte': ['Product directory – all rated products', 'Répertoire – tous les produits évalués'],
    /* Produktansicht */
    'Alle Nährwerte': ['All nutrition values', 'Toutes les valeurs nutritionnelles'],
    'Angereicherte Mikronährstoffe laut Etikett.': ['Added micronutrients according to the label.', 'Micronutriments ajoutés selon l\'étiquette.'],
    'Bewertung jeder einzelnen Zutat': ['Rating of every single ingredient', 'Évaluation de chaque ingrédient'],
    'Blutzucker-Verlauf': ['Blood sugar curve', 'Courbe de glycémie'],
    '📈 Blutzucker-Verlauf': ['📈 Blood sugar curve', '📈 Courbe de glycémie'],
    'Details ›': ['Details ›', 'Détails ›'],
    'Die Bewertung ist und bleibt kostenlos.': ['The rating is and remains free.', 'L\'évaluation est et reste gratuite.'],
    'Die Werte konnten nicht geladen werden.': ['The values could not be loaded.', 'Les valeurs n\'ont pas pu être chargées.'],
    'Die vier Achsen mit Punkten': ['The four axes with points', 'Les quatre axes avec points'],
    'Die vier Achsen mit Punkten und Herleitung.': ['The four axes with points and derivation.', 'Les quatre axes avec points et justification.'],
    'Enthaltene Nährstoffe': ['Nutrients contained', 'Nutriments contenus'],
    'Enthält Alkohol': ['Contains alcohol', 'Contient de l\'alcool'],
    'Enthält künstliche Süßstoffe': ['Contains artificial sweeteners', 'Contient des édulcorants artificiels'],
    'Enthält synthetische Azo-Farbstoffe': ['Contains synthetic azo dyes', 'Contient des colorants azoïques'],
    'Erneut versuchen': ['Try again', 'Réessayer'],
    'Fettqualität': ['Fat quality', 'Qualité des graisses'],
    'Geschmacksvariante': ['Flavour variant', 'Variante de goût'],
    'Im Root Index': ['In the Root Index', 'Dans le Root Index'],
    'Inhalt:': ['Contents:', 'Contenu :'],
    'Kein Lebensmittel-Index': ['No food index', 'Pas d\'indice alimentaire'],
    'Kein Lebensmittel-Score': ['No food score', 'Pas de score alimentaire'],
    'Kostenlos anmelden': ['Sign up for free', 'S\'inscrire gratuitement'],
    'Künstliche Süßstoffe': ['Artificial sweeteners', 'Édulcorants artificiels'],
    'Mehr sehen – kostenlos': ['See more – free', 'Voir plus – gratuit'],
    'Menge': ['Amount', 'Quantité'],
    'Mit kostenlosem Konto sichtbar.': ['Visible with a free account.', 'Visible avec un compte gratuit.'],
    'Nahrungsergänzung – kein Lebensmittel-Index': ['Food supplement – no food index', 'Complément alimentaire – pas d\'indice alimentaire'],
    'Platz in der Kategorie und die Besten': ['Rank in the category and the best', 'Rang dans la catégorie et les meilleurs'],
    'Premium freischalten – 7 Tage gratis': ['Unlock Premium – 7 days free', 'Débloquer Premium – 7 jours gratuits'],
    'Produktvergleich': ['Product comparison', 'Comparaison de produits'],
    'Quelle & Beleg': ['Source & evidence', 'Source & preuve'],
    'Regeln, Deckel-Check und Herleitung': ['Rules, cap check and derivation', 'Règles, plafonds et justification'],
    'Reines Salz': ['Pure salt', 'Sel pur'],
    'Root Index Aufschlüsselung': ['Root Index breakdown', 'Détail du Root Index'],
    'Salz je 100 g': ['Salt per 100 g', 'Sel pour 100 g'],
    'Schwächen': ['Weaknesses', 'Points faibles'],
    'Spuren sind keine Zutat und fließen nicht in den Root Index ein.': ['Traces are not an ingredient and do not count towards the Root Index.', 'Les traces ne sont pas un ingrédient et ne comptent pas dans le Root Index.'],
    'Suchen': ['Search', 'Rechercher'],
    'Synthetische Azo-Farbstoffe': ['Synthetic azo dyes', 'Colorants azoïques'],
    'Tagesbedarf gedeckt:': ['Daily requirement covered:', 'Besoin quotidien couvert :'],
    'Tagesbedarfs-Deckung': ['Daily requirement coverage', 'Couverture du besoin quotidien'],
    'Warum empfohlen': ['Why recommended', 'Pourquoi recommandé'],
    'Warum nicht die volle Punktzahl?': ['Why not full marks?', 'Pourquoi pas la note maximale ?'],
    'Weitere Angaben konnten noch nicht eindeutig als Zusatzstoff eingeordnet werden.': ['Further entries could not yet be clearly classified as additives.', 'D\'autres mentions n\'ont pas encore pu être classées comme additifs.'],
    'Wie stark das Produkt den Blutzucker treibt': ['How strongly the product raises blood sugar', 'À quel point le produit fait monter la glycémie'],
    'Zusatzstoffe': ['Additives', 'Additifs'],
    'Zusatzstoffe konnten gerade nicht geladen werden.': ['Additives could not be loaded right now.', 'Les additifs n\'ont pas pu être chargés.'],
    'Zutaten': ['Ingredients', 'Ingrédients'],
    'Zutaten & Zusatzstoffe': ['Ingredients & additives', 'Ingrédients & additifs'],
    'Zutaten konnten gerade nicht geladen werden.': ['Ingredients could not be loaded right now.', 'Les ingrédients n\'ont pas pu être chargés.'],
    'Zutaten mit Verarbeitungs-Ampel + Zusatzstoffe': ['Ingredients with processing traffic light + additives', 'Ingrédients avec feu de transformation + additifs'],
    'Zutaten · Zusatzstoffe · Verarbeitung · Nährwerte als Grafik': ['Ingredients · additives · processing · nutrition as a chart', 'Ingrédients · additifs · transformation · nutrition en graphique'],
    'Zutatenqualität': ['Ingredient quality', 'Qualité des ingrédients'],
    'Verarbeitung': ['Processing', 'Transformation'],
    'Nährwerte': ['Nutrition', 'Valeurs nutritionnelles'],
    'bessere Alternativen': ['better alternatives', 'meilleures alternatives'],
    'Bessere Alternativen': ['Better alternatives', 'Meilleures alternatives'],
    'kein Bild': ['no image', 'pas d\'image'],
    'keine': ['none', 'aucun'],
    'keine Zutaten hinterlegt': ['no ingredients stored', 'aucun ingrédient enregistré'],
    'keine erfasst': ['none recorded', 'aucun enregistré'],
    'stark verarbeitet': ['highly processed', 'très transformé'],
    'unverifiziert': ['unverified', 'non vérifié'],
    'verifiziert': ['verified', 'vérifié'],
    'weiter ›': ['next ›', 'suivant ›'],
    '‹ zurück': ['‹ back', '‹ retour'],
    'Ähnliche Produkte im Katalog': ['Similar products in the catalogue', 'Produits similaires dans le catalogue'],
    'öffnen': ['open', 'ouvrir'],
    '– davon ungesättigte': ['– of which unsaturated', '– dont insaturés'],
    '– kalorienarm, aber umstritten.': ['– low in calories, but controversial.', '– peu calorique, mais controversé.'],
    '– tragen den EU-Pflichthinweis für Kinder.': ['– carry the mandatory EU warning for children.', '– portent l\'avertissement obligatoire UE pour les enfants.'],
    '⇔ alle vergleichen': ['⇔ compare all', '⇔ tout comparer'],
    '⇔ vergleichen': ['⇔ compare', '⇔ comparer'],
    '⚠︎ Allergiker-Hinweis vom Etikett:': ['⚠︎ Allergy note from the label:', '⚠︎ Mention allergènes de l\'étiquette :'],
    '🌱 Bewusst ohne Index.': ['🌱 Deliberately without index.', '🌱 Volontairement sans indice.'],
    '📊 Nährwerte pro 100 g/ml': ['📊 Nutrition per 100 g/ml', '📊 Valeurs nutritionnelles pour 100 g/ml'],
    '🧪 Was dieses Salz zusätzlich liefert': ['🧪 What this salt also provides', '🧪 Ce que ce sel apporte en plus'],
    'Energie': ['Energy', 'Énergie'],
    'Eiweiß': ['Protein', 'Protéines'],
    'Fett': ['Fat', 'Matières grasses'],
    'davon gesättigt': ['of which saturates', 'dont acides gras saturés'],
    'Kohlenhydrate': ['Carbohydrate', 'Glucides'],
    'davon Zucker': ['of which sugars', 'dont sucres'],
    'Ballaststoffe': ['Fibre', 'Fibres'],
    'Salz': ['Salt', 'Sel']
  };

  var map = new Map();
  Object.keys(D).forEach(function(k){ map.set(k, D[k][I]); });
  var namen = null;
  try { var c = sessionStorage.getItem('ri_namen_' + L); if (c) namen = JSON.parse(c); } catch (e) {}

  function tr(t){
    var v = map.get(t);
    if (v != null) return v;
    if (namen && Object.prototype.hasOwnProperty.call(namen, t)) return namen[t];
    return null;
  }
  function textKnoten(n){
    var roh = n.nodeValue; if (!roh) return;
    var t = roh.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 300) return;
    var v = tr(t);
    if (v != null && v !== t) {
      var vor = roh.match(/^\s*/)[0], nach = roh.match(/\s*$/)[0];
      n.nodeValue = vor + v + nach;
    }
  }
  var ATTR = ['placeholder', 'title', 'aria-label'];
  function element(e){
    for (var i = 0; i < ATTR.length; i++) {
      var a = ATTR[i], w = e.getAttribute && e.getAttribute(a);
      if (w) { var v = tr(w.trim()); if (v != null && v !== w) e.setAttribute(a, v); }
    }
  }
  function lauf(root){
    if (!root) return;
    if (root.nodeType === 3) { textKnoten(root); return; }
    if (root.nodeType !== 1) return;
    var tag = root.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
    element(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function(x){
        if (x.nodeType === 1) { var g = x.tagName; return (g === 'SCRIPT' || g === 'STYLE' || g === 'TEXTAREA') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = w.nextNode())) { if (n.nodeType === 3) textKnoten(n); else element(n); }
  }
  function alles(){ lauf(document.body); var t = tr(document.title); if (t) document.title = t; }

  var beob = new MutationObserver(function(ml){
    for (var i = 0; i < ml.length; i++) {
      var r = ml[i];
      if (r.type === 'characterData') textKnoten(r.target);
      else if (r.type === 'attributes') element(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) lauf(r.addedNodes[j]);
    }
  });
  function start(){
    alles();
    beob.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    if (!namen && typeof client !== 'undefined' && client && client.rpc) {
      client.rpc('cb_anzeigenamen', { p_sprache: L }).then(function(r){
        if (r && r.data && !r.error) {
          namen = r.data;
          try { sessionStorage.setItem('ri_namen_' + L, JSON.stringify(namen)); } catch (e) {}
          alles();
        }
      }, function(){});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
