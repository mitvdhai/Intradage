# Architectuur

## Nu (prototype)

- **Next.js 16 (App Router) + TypeScript + Tailwind 4.** Eén codebase voor de mobiele app (`/app`) en de beheeromgeving (`/beheer`).
- **Server components en server actions.** Alle data blijft op de server. Elke schrijfactie (`src/lib/acties.ts`, `src/lib/acties-betrokkenheid.ts`) controleert eerst de rechten en schrijft waar nodig naar het logboek.
- **Rechtenmodel** in `src/lib/access.ts`: rol × scope (HQ → franchisenemer → vestiging) × doelgroep.
- **Opslag**: PostgreSQL via Drizzle ORM. Het schema (`src/lib/db/schema.ts`) is genormaliseerd:
  - **organisatie**: regio, franchisenemer, vestiging en gebruiker, met een koppeltabel voor gebruiker ↔ vestiging;
  - **functiehuis**: functie, profiel_item en functie_profiel, met weging en vereist niveau;
  - **beoordeling**: beoordeling en beoordeling_score (per onderdeel en bron), plus medewerker_niveau;
  - **communicatie, leren, documenten** en het **audit_log**;
  - **betrokkenheid**: `waarde` (kernwaarden), `waardering` (check: niet aan jezelf), `like` (de "brammie", op bericht of waardering), `beloning` en `beloning_aanvraag`, `enquete` met `enquete_deelname` (wie) en `enquete_antwoord` (wat, bij anonieme peilingen zonder gebruiker), `evenement` en `evenement_aanmelding`;
  - **personeelsbeheer**: `positie`, `gebruiker_positie`, `bezettingsnorm` (per vestiging, weekdag en positie), `beschikbaarheid` (vast weekpatroon), `dienst` (zonder gebruiker = open dienst; concept of gepubliceerd), `klok`, `verlof` (ook ziekte), `contract` (met hash en handtekeningen), `dossier_document`, `vacature`, `kandidaat`, `lifecycle_taak` (pre-, on- en offboarding). Op `gebruiker`: status, geboortedatum, persoonsgegevens (gemaskeerd), laatste werkdag, uitnodigings- en agendatoken;
  - **operatie**: `checklist_sjabloon` (onderdelen met weging en vragen als JSON, versie), `checklist_uitvoering` (antwoorden, score, knock-out) en `actiepunt`.

  Check-constraints bewaken niveaus (1–4) en wegingen. Een unieke sleutel zorgt voor maximaal één beoordeling per medewerker per periode. Geld wordt opgeslagen als `numeric`.
- **Migraties** staan als SQL in `drizzle/`. Ze draaien automatisch bij de eerste databaseverbinding. Een advisory lock voorkomt dat de seed dubbel loopt als meerdere instanties tegelijk starten.
- **Lokaal en in tests** draait PGlite: echte PostgreSQL, zonder server.
- **Rekenregels** staan los van de UI en zijn getest: `src/lib/functiehuis/score.ts` (gewogen beoordeling, salarisadvies) en `src/lib/checklist/score.ts` (cijfer 0–10 per onderdeel, gewogen eindcijfer, knock-out begrenst op 5,4). Het checklistformulier rekent live met dezelfde functie als de server.
- **Punten** worden niet opgeslagen maar berekend: 10 per ontvangen waardering, 2 per gegeven, 5 per afgerond leeritem, min ingewisselde beloningen.
- **Anonimiteit**: deelname en antwoord staan in aparte tabellen, zodat een anoniem antwoord niet aan een persoon te koppelen is. Resultaten tonen we pas vanaf 5 antwoorden.
- **Rooster**: staat in Intradage zelf. `src/lib/planning/atw.ts` bevat de regels van de Arbeidstijdenwet (jongeren, rusttijd, weekmaximum, pauze); `src/lib/planning/suggestie.ts` het roostervoorstel (pure functie, getest): moeilijkst te vullen diensten eerst, voorrang voor wie onder zijn minimum contracturen zit, nooit dubbel over vestigingen heen. Handmatig toewijzen en open diensten nemen gaan door dezelfde controle.
- **Contracten**: tekst uit een sjabloon (`src/lib/personeel/sjablonen.ts`), SHA-256 van de tekst bij opstellen; tekenen weigert als de tekst daarna is gewijzigd. Handtekening als SVG-pad, met tijdstip en ondertekenaar, en in het logboek.
- **Privacy**: IBAN en BSN worden gecontroleerd (elfproef) maar alleen gemaskeerd bewaard; in productie gaan ze versleuteld naar de loonadministratie. Dossierbestanden staan in het prototype in de database (max. 2 MB), in productie in EU-objectopslag. Elke download komt in het logboek.
- **Tijdzone**: `TZ=Europe/Amsterdam` wordt in `next.config.ts` gezet, zodat roosters ook op een UTC-server kloppen.
- **Rooster-adapter**: `src/lib/staff/adapter.ts` leest de gepubliceerde diensten uit de eigen database (de interface stamt uit de tijd van de geplande HorecaManager-koppeling).
- **Handboek-assistent**: retrieval over passages, met een drempel voor "weet ik niet". Een taalmodel wordt alleen gebruikt als er een API-sleutel is, en alleen op basis van de gevonden passages.
- **Cache Components** staat uit, omdat vrijwel elke pagina persoonsgebonden is. Bij de stap naar productie bekijken we per route of het toch winst oplevert.

## Naar productie

| Onderdeel | Stap |
|---|---|
| Database | ✓ PostgreSQL staat. Nog te doen: row-level security per franchisenemer/vestiging als extra slot; pgvector voor de handboekindex; back-ups en point-in-time recovery aanzetten |
| Inloggen | Mobiel nummer + sms-code; sessie per toestel; extra verificatie voor loonstrook/contract; HQ via Microsoft 365/Google SSO |
| Loonadministratie | ✓ CSV-export van goedgekeurde uren en mutaties. Volgende stap: directe koppeling met het salarispakket (Nmbrs, Loket of AFAS), inclusief loonstroken terug. Een koppeling met HorecaManager is niet meer nodig voor personeel |
| Tekenen | Nu een gewone elektronische handtekening met audit trail. Voor bijzondere bedingen (bijv. concurrentiebeding) eventueel een gekwalificeerde dienst |
| Bestanden | Object storage in de EU voor foto's (challenges, evaluaties) en video |
| Push | Web Push; later native via een Capacitor-schil (iOS/Android) |
| Realtime chat | WebSockets/SSE in plaats van verversen |
| Evaluaties en checklists | ✓ Staat. Nog te doen: sjablonen beheren in de beheeromgeving, offline invullen, foto's opslaan |
| Betrokkenheid | ✓ Tijdlijn, waardering, beloningen, peilingen, evenementen staan. Nog te doen (zie voorstel v4): vertaling, journeys, spaces, vrije formulieren |
| Beveiliging | ✓ Logboek staat in de database. Nog te doen: pentest, monitoring en echte authenticatie in plaats van persona-keuze |

## Open punten (afstemmen met Bram Ladage / Staff)

1. Welk salarispakket gebruiken de franchisenemers, en welk importformaat hoort daarbij?
2. Blijft HorecaManager in gebruik voor het financiële deel (omzet, kassa)? Zo ja: alleen omzet naar Intradage halen voor loonkosten als % van de omzet.
3. Wie is werkgever (FN of HQ), dus wie is verwerkingsverantwoordelijke en wie beslist over salaris?
4. Instemming OR/PVT voor de beoordelings- en beloningsregeling.
5. Officiële functiegroepen per functie en de definitieve beloningsregeling.
