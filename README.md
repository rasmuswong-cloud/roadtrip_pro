# Roadtrip Pro

Roadtrip Pro är en webbaserad reseplanerare för roadtrips. Appen samlar resans dagar, destinationer, aktiviteter, boenden, kostnader, bokningsinformation och anteckningar i en gemensam plan.

**Liveversion:**
https://roadtrip-pro-sy5y.vercel.app/

## Projektets mål

Målet är att skapa en lättanvänd app där en roadtrip kan planeras före avresa.

Appen ska hjälpa användaren att:

* planera resan dag för dag
* lägga till destinationer, aktiviteter och boenden
* hålla reda på tider, bokningar och kostnader
* se resans stopp och rutt på en karta
* dela en resa med andra användare
* upptäcka problem som saknade boenden, långa kördagar och budgetavvikelser
* använda planeringen på både mobil och dator

## Nuvarande status

Roadtrip Pro är en fungerande MVP under aktiv utveckling.

Det centrala planeringsflödet finns på plats:

1. Användaren kan logga in eller använda appens tillgängliga resläge.
2. En resa kan skapas eller öppnas.
3. Resan visas som en dag-för-dag-planering.
4. Stopp kan skapas, redigeras, flyttas och tas bort.
5. Resedata kan sparas i Supabase.
6. Dagkort visar sammanfattningar, aktiviteter, boende, körning, kostnader och planeringsvarningar.

Projektet är ännu inte färdigt för generell produktion. Framför allt behöver dataflöden, mobilupplevelse, routing, offlinefunktioner och samarbete mellan flera användare verifieras ytterligare.

## Funktioner

### Dag-för-dag-planering

* schemalagda och oschemalagda stopp
* aktiviteter, boenden och transportstopp
* tider, platser, kostnader och anteckningar
* snabbredigering direkt i dagplaneringen
* flytt av stopp uppåt och nedåt
* borttagning av stopp
* dagsammanfattning med antal stopp, körning och kostnad
* checklistor och packningsinformation

Dagkortets presentation är utbruten till:

```text
src/components/planning/DayCard.tsx
```

### Smart daganalys

Planeringslogiken finns i:

```text
src/services/planning/dayAnalysis.ts
```

Den innehåller testbar logik för bland annat:

* dagsammanfattning
* beräkning av dagskostnad
* sorteringsordning
* flytt av stopp mellan dagar
* formulärvalidering
* smarta planeringsvarningar
* rollback-hjälpare för lokal state

Rollback-hjälparen är testad isolerat men är ännu inte en ersättning för atomiska databastransaktioner.

### Budget

* kostnader per stopp
* dagskostnad
* kostnadskategorier
* markering av stopp som saknar kostnad
* budgetöversikt

### Karta och routing

* kartkomponent
* koordinater för stopp
* lokalt stöd för waypoint-optimering
* struktur för extern routing och ruttcache

Den lokala optimeringen är en fallback. Faktiska restider, vägsträckor och väggeometrier behöver hämtas från en extern routingtjänst för ett fullständigt produktionsflöde.

### Delning och synkronisering

Projektet innehåller struktur för:

* Supabase-inloggning
* delade resor och delningskoder
* realtime-uppdateringar
* repositories för datalagring
* kö för väntande synkronisering
* versionsbaserad konflikthantering

Dessa flöden behöver fortsatt integrationstestning mellan flera samtidiga användare.

### Offline

Projektet innehåller grundstruktur för:

* lokal SQLite-cache
* väntande mutationer
* lagrade rutter
* återuppspelning av ändringar efter återanslutning

Offlineflödet är inte ännu fullständigt verifierat som ett komplett användarflöde.

### AI-stöd

Användaren kan skicka naturliga språkkommandon som omvandlas till validerade ändringsförslag.

AI-flödet går genom:

```text
src/services/ai/agent.ts
supabase/functions/parse-itinerary-command/
```

Privata AI-nycklar ska endast finnas som Supabase Edge Function-secrets och får inte exponeras i Expo- eller Vercel-klienten.

## Teknik

* React Native
* Expo
* TypeScript
* React Native Web
* Zustand
* Supabase
* PostgreSQL
* SQLite
* Zod
* ESLint
* Node test runner
* Vercel

## Projektstruktur

```text
App.tsx
src/
  components/
    map/                 Kartkomponenter
    planning/            Dagkort och planeringskomponenter
  data/                  Seed- och demodata
  models/                Domänmodeller och delade TypeScript-typer
  services/
    ai/                  AI-tolkning och mutationsplaner
    auth/                Inloggning och användarsession
    database/            Supabase repositories och mappers
    offline/             Lokal SQLite-cache
    planning/            Dagsammanfattning, validering och varningar
    routing/             Rutt- och waypointlogik
    sync/                Synkroniseringskö
  store/                 Zustand-store
supabase/
  functions/             Supabase Edge Functions
  schema.sql             Databasschema och RLS
tests/                   Automatiserade tester
```

## Lokal installation

### 1. Installera beroenden

```bash
npm install
```

### 2. Skapa miljöfil

Skapa en lokal `.env` baserad på `.env.example`.

Exempel:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
```

Lägg aldrig privata AI-nycklar i klientens miljöfil.

### 3. Starta appen

```bash
npm run start
```

För webbversionen:

```bash
npx expo start --web
```

## Kvalitetskontroller

TypeScript:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Tester:

```bash
npm test
```

Webbexport:

```bash
npx expo export --platform web
```

Den nuvarande automatiserade testsviten täcker bland annat:

* dagsammanfattning
* dagskostnad
* sorteringsordning
* smarta varningar
* flytt av stopp mellan dagar
* formulärvalidering
* lokal rollback-hjälpare

## Supabase

1. Skapa ett Supabase-projekt.
2. Kör relevanta SQL-filer i `supabase/`.
3. Aktivera RLS för användardata.
4. Aktivera Realtime för de tabeller som ska synkroniseras.
5. Konfigurera tillåtna Site URL- och redirect-adresser.
6. Lägg `GEMINI_API_KEY` som en Supabase Edge Function-secret.

Exempel:

```bash
supabase secrets set GEMINI_API_KEY=...
```

## Säkerhet

* privata API-nycklar får inte committas
* `.env` och relaterade lokala filer ignoreras av Git och Vercel
* AI-nycklar ska endast finnas i en betrodd servermiljö
* Supabase RLS ska begränsa åtkomst till resor som användaren äger eller delar
* användardata ska valideras innan den sparas
* klienten får inte betraktas som en betrodd säkerhetsgräns

Att en `.env`-fil är ignorerad av Git innebär inte att en nyckel är säker om den används eller bäddas in i klientkoden.

## Kända begränsningar

* `moveStop` använder ännu inte en atomisk Supabase RPC-transaktion
* en flytt som kräver flera databasuppdateringar kan därför bli delvis genomförd om ett anrop misslyckas
* inline-redigeringen saknar fortfarande separata fullständiga fält för sluttid, valuta och bokningsreferens
* fullständig visuell QA på mobil återstår
* delar av UI- och applikationslogiken ligger fortfarande i den stora `App.tsx`
* offline- och realtimeflöden behöver fler integrationstester
* faktisk körsträcka och körtid behöver hämtas från en routingtjänst
* end-to-end-tester och CI återstår

## Nästa prioriterade steg

1. Gör flytt av stopp atomisk via Supabase RPC.
2. Slutför inline-redigeringens återstående fält.
3. Genomför visuell QA på mobil, surfplatta och desktop.
4. Bryt ut fler avgränsade UI-delar ur `App.tsx`.
5. Lägg till integrationstester och end-to-end-tester.

Se [ROADMAP.md](./ROADMAP.md) för den fullständiga utvecklingsplanen.

## Produktionsstatus

Roadtrip Pro är en fungerande MVP under utveckling. Appen kan användas och testas, men bör inte betraktas som fullt produktionsklar förrän de kvarstående data-, säkerhets- och kvalitetsstegen har genomförts.
