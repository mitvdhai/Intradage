# Functiehuis, beoordeling en salarisadvies

## Opbouw

- **Functie**: naam, functiegroep (volgens het Handboek Referentiefuncties Horeca), doel, kerntaken, verantwoordelijkheden en plaats in de organisatie.
- **Profiel**: per functie een set onderdelen uit drie categorieën:
  - *Competenties*: gedrag, bijvoorbeeld gastgerichtheid of hygiënebewustzijn.
  - *Vaardigheden*: vakmanschap, bijvoorbeeld bakken of kassa.
  - *Kennis & skills*: meetbaar, vaak een certificaat (HACCP, allergenen, BHV).
- Elk onderdeel heeft per functie:
  - een **weging** in procenten. Alle wegingen van een functie tellen op tot 100%.
  - een **vereist niveau**, van 1 tot 4.
  - optioneel de markering **voorwaarde**.
- Niveaus zijn per onderdeel beschreven in gedrag: 1 = leert het, 2 = zelfstandig, 3 = ervaren, 4 = kan het anderen leren.

## Zichtbaarheid

| Wie | Ziet |
|---|---|
| Medewerker | Alleen de eigen functie, het eigen profiel, het eigen niveau en de eigen beoordelingen |
| Franchisenemer / manager | Profielen en beoordelingen van medewerkers in de eigen vestigingen. Salarisgegevens ziet alleen de franchisenemer, omdat die de werkgever is |
| HQ | Beheert het functiehuis. HQ HR beheert de beloningsregeling. Overige HQ-gebruikers zien beoordelingen zonder salarisbedragen |

## Rekenregels (`src/lib/functiehuis/score.ts`)

1. De beoordelaar kiest per onderdeel het **behaalde niveau** (1–4). Een zelfbeoordeling gaat vooraf.
2. Itemscore = 3 + (behaald − vereist), begrensd op 1..5. Op niveau is dus altijd een 3.
3. Gewogen totaal = Σ(weging × itemscore) / 100.
4. Het totaal bepaalt via de banden van de beloningsregeling de **uitkomst** (onvoldoende … uitstekend).
5. Is een **voorwaarde** niet behaald, dan is de uitkomst maximaal de ingestelde grens (standaard "matig").
6. De uitkomst geeft een **adviespercentage**. Het nieuwe uurloon komt nooit onder het basisloon en nooit boven het eindloon van de functiegroep. Bovenschaligen krijgen geen verhoging.
7. De **franchisenemer beslist**. Wie afwijkt van het advies, moet een toelichting geven. Het besluit komt in het logboek en wordt doorgezet naar HorecaManager. In het prototype gebeurt dat doorzetten nog handmatig.

## Spelregels en juridische aandachtspunten

- **Horeca-cao**: een eigen systematiek voor prestatieverhoging mag, mits de wettelijke medezeggenschap heeft ingestemd (art. 4.11). Leg de regeling voor aan de OR/PVT.
- **AVG art. 22**: geen besluit dat uitsluitend geautomatiseerd tot stand komt. De score is een advies, een mens beslist.
- **Loontransparantie (EU-richtlijn 2023/970)**: werknemers moeten de criteria voor loonontwikkeling kunnen inzien. Het functiehuis maakt die per functie zichtbaar. De Nederlandse invoering is gepland per 1 januari 2027.
- **Kalibratie**: vergelijk vóór de besluiten de verdeling van uitkomsten tussen franchisenemers (Beheer → Beoordelingen).

Laat de regeling, de banden en de percentages juridisch en door HR toetsen. De waarden in `seed.ts` zijn voorbeelden.
