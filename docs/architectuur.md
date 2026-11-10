# Architectuur

## Nu (prototype)

- **Next.js 16 (App Router) + TypeScript + Tailwind 4.** Eén codebase voor de mobiele app (`/app`) en de beheeromgeving (`/beheer`).
- **Server components en server actions.** Alle data blijft op de server. Elke schrijfactie in `src/lib/acties.ts` controleert eerst de rechten en schrijft naar het logboek.
- **Rechtenmodel** in `src/lib/access.ts`: rol × scope (HQ → franchisenemer → vestiging) × doelgroep.
- **Opslag**: PostgreSQL via Drizzle ORM. Het schema (`src/lib/db/schema.ts`) is genormaliseerd:
  - **organisatie**: regio, franchisenemer, vestiging en gebruiker, met een koppeltabel voor gebruiker ↔ vestiging;
  - **functiehuis**: functie, profiel_item en functie_profiel, met weging en vereist niveau;
  - **beoordeling**: beoordeling en beoordeling_score (per onderdeel en bron), plus medewerker_niveau;
  - **communicatie, leren, documenten** en het **audit_log**.

  Check-constraints bewaken niveaus (1–4) en wegingen. Een unieke sleutel zorgt voor maximaal één beoordeling per medewerker per periode. Geld wordt opgeslagen als `numeric`.
- **Migraties** staan als SQL in `drizzle/`. Ze draaien automatisch bij de eerste databaseverbinding. Een advisory lock voorkomt dat de seed dubbel loopt als meerdere instanties tegelijk starten.
- **Lokaal en in tests** draait PGlite: echte PostgreSQL, zonder server.
- **Diensten** worden bewust niet opgeslagen. HorecaManager blijft de bron; we bewaren alleen ruilverzoeken met de dienst-id.
- **HorecaManager**: `StaffAdapter`-interface met een `MockStaffAdapter` die het rooster levert.
- **Handboek-assistent**: retrieval over passages, met een drempel voor "weet ik niet". Een taalmodel wordt alleen gebruikt als er een API-sleutel is, en alleen op basis van de gevonden passages.
- **Cache Components** staat uit, omdat vrijwel elke pagina persoonsgebonden is. Bij de stap naar productie bekijken we per route of het toch winst oplevert.

## Naar productie

| Onderdeel | Stap |
|---|---|
| Database | ✓ PostgreSQL staat. Nog te doen: row-level security per franchisenemer/vestiging als extra slot; pgvector voor de handboekindex; back-ups en point-in-time recovery aanzetten |
| Inloggen | Mobiel nummer + sms-code; sessie per toestel; extra verificatie voor loonstrook/contract; HQ via Microsoft 365/Google SSO |
| HorecaManager | `HttpStaffAdapter` zodra Staff API-documentatie en een testomgeving levert: sync van medewerkers/functies/vestigingen (on/offboarding), rooster live, documenten on-demand, ruil terugschrijven als de API dat toestaat |
| Bestanden | Object storage in de EU voor foto's (challenges, evaluaties) en video |
| Push | Web Push; later native via een Capacitor-schil (iOS/Android) |
| Realtime chat | WebSockets/SSE in plaats van verversen |
| Evaluaties | Module vestigingsevaluaties (checklists met weging, knock-outs, offline, actiepunten). Staat in het voorstel, nog niet gebouwd |
| Beveiliging | ✓ Logboek staat in de database. Nog te doen: pentest, monitoring en echte authenticatie in plaats van persona-keuze |

## Open punten (afstemmen met Bram Ladage / Staff)

1. API-documentatie, authenticatie en testomgeving van HorecaManager.
2. Waar staan loonstroken en contracten: in HorecaManager of in het salarispakket?
3. Wie is werkgever (FN of HQ), dus wie is verwerkingsverantwoordelijke en wie beslist over salaris?
4. Instemming OR/PVT voor de beoordelings- en beloningsregeling.
5. Officiële functiegroepen per functie en de definitieve beloningsregeling.
