# Intradage

Het interne platform van Bram Ladage: één app voor communicatie, waardering en werkbeleving. Nieuws en een tijdlijn met posts, chat, waardering op kernwaarden met punten en beloningen, peilingen (pulse, eNPS, polls), evenementen, smoelenboek, leren, het handboek met AI-assistent, dagchecklists en vestigingsevaluaties, rooster en documenten, en een functiehuis met gewogen beoordelingen. Daarnaast een beheeromgeving voor HQ en franchisenemers.

![Schermen](docs/schermen.png)

> **Status: werkend prototype op PostgreSQL.** Alle schermen en flows werken en worden opgeslagen in de database. HorecaManager (Staff) is nog gesimuleerd achter een adapter.
>
> - Handleiding voor gebruikers: [docs/handleiding-gebruikers.pdf](docs/handleiding-gebruikers.pdf) · [docs/handleiding.md](docs/handleiding.md)
> - Live zetten op Railway: [docs/deploy.md](docs/deploy.md)
> - Keuzes en het pad naar productie: [docs/architectuur.md](docs/architectuur.md)
> - Voorstel met marktverkenning (6 platforms): [docs/voorstel/voorstel-v4.pdf](docs/voorstel/voorstel-v4.pdf)

## Starten

```bash
npm install
npm run dev          # http://localhost:3000
```

Op het startscherm kies je een persoon:

| Persoon | Rol | Laat zien |
|---|---|---|
| Sanne | Medewerker | Startscherm en tijdlijn (posten, brammies geven), verplicht bericht bevestigen, waarderen, beloningen, pulse, evenementen, smoelenboek, leren, handboek-assistent, rooster, functie, documenten met sms-code (demo: `123456`) |
| Yara | Shiftleider | Dagchecklists openen, sluiten en HACCP invullen |
| Erik | Franchisenemer | Team, challenges beoordelen, ruil goedkeuren, beoordeling invullen met live salarisadvies, besluit vastleggen |
| Lisa | HQ Kwaliteit | Vestigingsevaluatie uitvoeren met knock-outs en actiepunten; beheer: overzicht, berichten, evaluaties |
| Joost | HQ HR | Beheer: betrokkenheid (eNPS, peiling starten, beloningen uitreiken), functiehuis, beloningsregeling, beoordelingen, logboek |

### Database

- **Lokaal** heb je niets nodig: zonder `DATABASE_URL` gebruikt de app PGlite, een volwaardige PostgreSQL die in het proces draait. De data staat in `.data/pglite`. Verwijder die map om opnieuw te beginnen.
- **Met een eigen PostgreSQL** zet je `DATABASE_URL=postgres://…`.
- Bij de eerste start voert de app de migraties uit (`drizzle/`) en laadt hij demodata als de database leeg is. Daarna kan HQ via **Logboek → Demodata herstellen** terug naar de beginstand.
- Pas je het schema aan (`src/lib/db/schema.ts`)? Maak dan een migratie met `npm run db:generate` en commit de nieuwe bestanden in `drizzle/`.

### Omgevingsvariabelen

| Variabele | Nodig | Doel |
|---|---|---|
| `DATABASE_URL` | productie | PostgreSQL-verbinding (op Railway: `${{Postgres.DATABASE_URL}}`) |
| `DATABASE_SSL` | soms | `true` bij een publieke database-URL met SSL |
| `DEMO_WACHTWOORD` | aanbevolen | Wachtwoord op het demo-inlogscherm |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | nee | Taalmodel voor handboekantwoorden |
| `RAILPACK_NODE_VERSION` | Railway | `22` |

### Optioneel: AI-antwoorden

Zonder sleutel geeft de handboek-assistent een extractief antwoord: de best passende passage, met bron. Met een sleutel formuleert een taalmodel het antwoord, maar alleen op basis van die passages:

```bash
ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=claude-sonnet-5-5 npm run dev
```

## Controleren

```bash
npm test             # unit tests + databasetests (PGlite, echte migraties)
npm run typecheck
npm run lint
npm run build && PORT=3100 npm start   # daarna in een tweede terminal:
npm run e2e          # end-to-end flows in headless Chrome (CHROME_PATH instelbaar)
```

## Structuur

```
src/
  app/
    page.tsx                 inloggen (demo: persoon kiezen)
    app/                     medewerker-app (mobiel): home, berichten, chat, leren,
                             handboek, werk (rooster/functie/documenten), team (FN/manager)
    beheer/                  beheeromgeving (desktop): overzicht, berichten,
                             beoordelingen, functiehuis, beloningsregeling, logboek
  components/                UI-bouwstenen (lijstrij, segmenten, niveau, formulieren)
  lib/
    types.ts                 domeinmodel
    access.ts                rechtenmodel: rol × scope × doelgroep
    acties.ts                alle schrijfacties (server actions), met rechtencheck en logboek
    data.ts                  leesfuncties (SQL via Drizzle), gefilterd per gebruiker
    org.ts                   organisatie/functiehuis per request in één keer geladen
    db/schema.ts             PostgreSQL-schema (25 tabellen, enums, constraints)
    db/client.ts             verbinding (pg of PGlite), migraties, seed bij lege database
    db/seed.ts               demodata
    staff/adapter.ts         HorecaManager-koppeling (nu: MockStaffAdapter)
    functiehuis/             functies, profielen, weging, beoordeling → salarisadvies
    handboek/                zoeken in passages + assistent met bronvermelding
drizzle/                     SQL-migraties
docs/
  handleiding.md / .pdf      handleiding voor gebruikers, per rol, met screenshots
  deploy.md                  live zetten op Railway
  architectuur.md            keuzes, productiepad, open punten
  functiehuis.md             rekenregels en spelregels van het functiehuis
  voorstel/                  het voorstel (PDF)
```

## Ontwerpprincipes

- **Blauw voor structuur, rood voor actie.** Rood alleen als iets aandacht of een handeling vraagt: verplicht bericht, te beoordelen, versturen.
- **Eén lijststijl, één kaartstijl.** Elk scherm bestaat uit secties met lijstrijen. Dat maakt het voorspelbaar voor een 16-jarige parttimer.
- **Eén hoofdactie per scherm**, onderaan en duidelijk.
- **Tikvlakken van minimaal 44 px.**
