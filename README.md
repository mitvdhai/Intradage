# Intradage

Het interne platform van Bram Ladage: één app voor nieuws, chat, leren, het handboek met AI-assistent, rooster en documenten, en een functiehuis met gewogen beoordelingen. Daarnaast een beheeromgeving voor HQ en franchisenemers.

![Schermen](docs/schermen.png)

> **Status: werkend prototype.** Alle schermen en flows werken, maar op demodata in het geheugen. HorecaManager (Staff) is gesimuleerd achter een adapter. Zie [docs/architectuur.md](docs/architectuur.md) voor de weg naar productie.

## Starten

```bash
npm install
npm run dev          # http://localhost:3000
```

Op het startscherm kies je een persoon:

| Persoon | Rol | Laat zien |
|---|---|---|
| Sanne | Medewerker | Startscherm, verplicht bericht bevestigen, leren, handboek-assistent, rooster, functie en profiel, documenten met sms-code (demo: `123456`) |
| Yara | Shiftleider | Zelfde app, ander functieprofiel |
| Erik | Franchisenemer | Team, challenges beoordelen, ruil goedkeuren, beoordeling invullen met live salarisadvies, besluit vastleggen |
| Lisa | HQ Kwaliteit | Beheer: overzicht per franchisenemer, berichten met doelgroep en bereik |
| Joost | HQ HR | Beheer: functiehuis (wegingen), beloningsregeling, beoordelingen, logboek |

De demodata staat in het geheugen van de server. Herstart de server om opnieuw te beginnen.

### Optioneel: AI-antwoorden

Zonder sleutel geeft de handboek-assistent een extractief antwoord: de best passende passage, met bron. Met een sleutel formuleert een taalmodel het antwoord, maar alleen op basis van die passages:

```bash
ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=claude-sonnet-5-5 npm run dev
```

## Controleren

```bash
npm test             # unit tests (functiehuis-berekening, handboek-zoeken)
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
    data.ts                  leesfuncties, gefilterd per gebruiker
    store.ts                 in-memory opslag (te vervangen door PostgreSQL)
    staff/adapter.ts         HorecaManager-koppeling (nu: MockStaffAdapter)
    functiehuis/             functies, profielen, weging, beoordeling → salarisadvies
    handboek/                zoeken in passages + assistent met bronvermelding
docs/
  architectuur.md            keuzes, productiepad, open punten
  functiehuis.md             rekenregels en spelregels van het functiehuis
  voorstel/                  het voorstel (PDF)
```

## Ontwerpprincipes

- **Blauw voor structuur, rood voor actie.** Rood alleen als iets aandacht of een handeling vraagt: verplicht bericht, te beoordelen, versturen.
- **Eén lijststijl, één kaartstijl.** Elk scherm bestaat uit secties met lijstrijen. Dat maakt het voorspelbaar voor een 16-jarige parttimer.
- **Eén hoofdactie per scherm**, onderaan en duidelijk.
- **Tikvlakken van minimaal 44 px.**
