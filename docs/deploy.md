# Live zetten op Railway

Je hebt in je Railway-project al een **PostgreSQL**-database toegevoegd. Doe daarna het volgende:

1. **App toevoegen**
   - Klik in het project op **+ Create** → **GitHub Repo** → **mitvdhai/intradage**.
   - Er verschijnt een tegel voor de app naast de tegel van Postgres.
2. **Variabelen instellen**
   - Klik op de tegel van de **app** (niet die van Postgres) en open de tab **Variables**.
   - Klik op **+ New Variable** en voeg toe:

     | Naam | Waarde |
     |---|---|
     | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (letterlijk zo typen; heet je database-tegel anders, gebruik dan die naam) |
     | `RAILPACK_NODE_VERSION` | `22` |
     | `DEMO_WACHTWOORD` | een wachtwoord naar keuze (aanbevolen zodra je de link deelt) |
     | `ANTHROPIC_API_KEY` | optioneel: dan formuleert een taalmodel de handboekantwoorden |

   - Stel `PORT` en `NODE_ENV` **niet** in; Railway regelt die zelf.
3. **Domein aanmaken.** Ga naar de tab **Settings** → **Networking** → **Generate Domain**.
4. **Deployen.** Railway bouwt automatisch bij elke wijziging op `main`. Je hoeft geen build- of startcommando in te vullen.
5. **Database.** Bij de eerste start maakt de app zelf alle tabellen aan (migraties) en vult ze met demodata. In de tab **Data** van de Postgres-tegel kun je de tabellen bekijken.
6. **Replicas.** Laat dit op 1 staan; voor deze fase is dat ruim voldoende.

**Problemen oplossen**

- *Build faalt met "Node.js version >=20.9.0 is required"*: controleer `RAILPACK_NODE_VERSION=22`, wis de build-cache en deploy opnieuw.
- *De app start, maar geeft een databasefout*: controleer of `DATABASE_URL` naar je Postgres-tegel verwijst. Gebruik je de publieke URL, zet dan ook `DATABASE_SSL=true`.
- *Je wilt opnieuw beginnen*: log in als Lisa of Joost en kies **Logboek → Demodata herstellen**.
