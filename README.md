# Roadtrip Pro

Roadtrip Pro ar en webbaserad reseplanerare for roadtrips. Appen samlar resans dagar, destinationer, aktiviteter, boenden, tider, kostnader, bokningsinformation, kartpositioner och anteckningar i en gemensam plan.

**Liveversion:**
https://roadtrip-pro-sy5y.vercel.app/

## Projektets mal

Malet ar att skapa en latt anvand app dar en roadtrip kan planeras fore avresa.

Appen ska hjalpa anvandaren att:

* planera resan dag for dag
* lagga till destinationer, aktiviteter, boenden och transportstopp
* utforska platser i Utforska och lagga till dem i en vald dag
* halla reda pa tider, bokningar, kostnader och anteckningar
* se stopp och rutter pa karta
* dela en resa med andra anvandare
* upptacka problem som saknade boenden, langa kordagar och budgetavvikelser
* redigera resplanen snabbt och intuitivt direkt i dagvyn
* anvanda appen pa bade mobil och dator

## Nuvarande status

Roadtrip Pro ar en fungerande MVP under aktiv utveckling.

Det centrala planeringsflodet finns pa plats:

1. Anvandaren kan logga in eller anvanda appens tillgangliga reslage.
2. En resa kan skapas eller oppnas.
3. Resan visas som en dag-for-dag-planering.
4. Stopp kan skapas, redigeras, flyttas och tas bort.
5. Resedata sparas i Supabase.
6. Utforska-platser och anteckningar kan sparas for anslutna Supabase-resor.
7. Dagkort visar sammanfattningar, aktiviteter, boende, korning, kostnader och planeringsvarningar.
8. Dagar har en dag-for-dag-editor dar add/edit-formular visas nara vald dag eller valt stopp.
9. Relevanta falt kan redigeras inline direkt i dagkortet.
10. Flytt av stopp uppat och nedat inom samma dag sker atomiskt via Supabase RPC.
11. Desktop har en map-first-layout med en primar kartpanel till hoger och utan duplicerade stora kartor i centerarbetsytan.
12. Workspace-rendering ar utbruten fran `App.tsx` till fokuserade workspace-komponenter.

Projektet ar annu inte fardigt for generell produktion. Framfor allt aterstar djupare Supabase-integrationstester, RLS-exekveringstester, realtime-verifiering, offlinefloden, tillganglighet, prestanda och fortsatt mobil-QA.

## Funktioner

### Map-first-layout

Desktop-layouten ar uppdelad i:

* vanster sidonav och daglista
* centerarbetsyta for planering och redigering
* en stor persistent Google-karta till hoger

Nar den hogra kartpanelen visas anvands den som appens primara kartyta. Oversikt, Dagar och Rutt visar kompakt sammanfattningsinnehall i centerytan i stallet for att duplicera en stor karta. Pa mobil finns ingen persistent hogerpanel, sa relevanta arbetsytor kan visa en inbaddad karta i innehallet.

### Oversikt

Oversikt visar Trip Readiness, planeringsstatus, budget- och ruttindikatorer samt nasta rekommenderade steg. Varningsatgarder leder till ratt arbetsyta.

### Utforska

Utforska ar en separat workspace for reseideer, anteckningar och platsupptackt.

Utforska stodjer:

* anteckningar per resa
* platslistor grupperade efter kategori
* Google Places-sokning
* rekommenderade platser fran aktuell resplan
* "Lagg till i dag"-flode som forifyller vald dag i Dagar
* Supabase-persistens for anslutna resor via `trip_explore_items`
* soft delete av Utforska-poster

### Dag-for-dag-planering

* schemalagda och oschemalagda stopp
* aktiviteter, boenden, matstopp och transportstopp
* tider, platser, kostnader och anteckningar
* dagsammanfattning med antal stopp, korning och kostnad
* smarta planeringsvarningar
* checklistor och packningsinformation
* kompakt stoppkort med tydlig reseinformation
* sekundara falt bakom detaljpanel
* meny for fler atgarder
* add-formular nara vald dag
* edit-formular direkt i eller under valt stopp

Dagkortets presentation finns i:

```text
src/components/planning/DayCard.tsx
```

DayCard-specifika styles finns i:

```text
src/components/planning/DayCard.styles.ts
```

### Inline editing

Stopp kan redigeras direkt i dagkortet utan separat helsidesformular.

Foljande falt stodjer inline-redigering:

* titel
* plats
* datum
* starttid
* sluttid
* typ
* kostnad
* valuta
* bokningsstatus
* bokningsreferens
* anteckningar

Inline editing har stod for:

* globalt aktivt falt i planeringsvyn
* spara och avbryt
* validering
* skydd mot dubbla sparningar
* bevarad draft vid fel
* server-first-sparning
* uppdatering av lokal state forst efter lyckat Supabase-anrop

Platsandring andrar inte koordinater automatiskt. Om platsnamnet andras medan koordinater finns kvar visas en varning om att kartpositionen bor kontrolleras.

### Atomisk flytt av stopp

Flytt av stopp uppat och nedat inom samma dag sker genom en Supabase RPC-funktion och en atomisk PostgreSQL-transaktion.

Det innebar att:

* hela flytten lyckas eller rullas tillbaka
* flytten gors med ett serveranrop
* stopp flyttas inte automatiskt mellan olika dagar
* datum och tider andras inte vid omordning
* behorighet kontrolleras server-side
* lokal state uppdateras forst efter lyckat RPC-anrop
* forsta stoppet uppat och sista stoppet nedat hanteras som no-op

Migrationen finns i:

```text
supabase/migrations/202606120001_atomic_move_itinerary_node.sql
```

### Smart daganalys

Planeringslogiken finns i:

```text
src/services/planning/dayAnalysis.ts
```

Den innehaller testbar logik for bland annat:

* dagsammanfattning
* berakning av dagskostnad
* sorteringsordning
* formularvalidering
* smarta planeringsvarningar
* lokal rollback-hjalpare

### Budget

* kostnader per stopp
* dagskostnad
* kostnadskategorier
* markering av stopp som saknar kostnad
* budgetoversikt
* inline-redigerad kostnad paverkar dagbudget och summeringar

### Karta och routing

* Google Maps-rendering pa webben
* primar persistent kartpanel pa desktop
* inbaddad karta i relevanta mobilfloden
* koordinater for stopp
* lokal waypoint-struktur
* stodstruktur for ruttcache och extern routing

Faktiska restider, vagstrackor och vaggeometrier behover fortfarande hamtas fran en extern routingtjanst for ett fullstandigt produktionsflode.

### Delning och synkronisering

Projektet innehaller struktur for:

* Supabase-inloggning
* delade resor och delningskoder
* realtime-uppdateringar
* repositories for datalagring
* ko for vantande synkronisering
* versionsbaserad konflikthantering

Dessa floden behover fortsatt integrationstestning mellan flera samtidiga anvandare.

### Offline

Projektet innehaller grundstruktur for:

* lokal SQLite-cache
* vantande mutationer
* lagrade rutter
* ateruppspelning av andringar efter ateranslutning

Offlineflodet ar inte annu fullstandigt verifierat som ett komplett anvandarflode.

### AI-stod

Anvandaren kan skicka naturliga sprakkommandon som omvandlas till validerade andringsforslag.

AI-flodet gar genom:

```text
src/services/ai/agent.ts
supabase/functions/parse-itinerary-command/
```

Privata AI-nycklar ska endast finnas som Supabase Edge Function-secrets och far inte exponeras i Expo- eller Vercel-klienten.

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
* Playwright
* GitHub Actions
* Vercel

## Projektstruktur

```text
App.tsx                 Orkestrering, state och handlers
src/
  components/
    layout/             App-shell, sidebar, mobilnav och map rail
    map/                Kartkomponenter och kartdata
    planning/           Dagkort, inline editing och planeringskomponenter
    workspaces/         Oversikt, Utforska, Dagar, Rutt, Budget och Verktyg
  data/                 Seed- och demodata
  models/               Domanmodeller och delade TypeScript-typer
  services/
    ai/                 AI-tolkning och mutationsplaner
    auth/               Inloggning och anvandarsession
    database/           Supabase repositories och mappers
    offline/            Lokal SQLite-cache
    planning/           Dagsanalys, inline editing, Utforska, budget och varningar
    routing/            Rutt- och waypointlogik
    sync/               Synkroniseringsko
  store/                Zustand-store
supabase/
  functions/            Supabase Edge Functions
  migrations/           Supabase/Postgres-migrationer
  schema.sql            Databasschema och RLS
tests/
  e2e/                  Playwright smoke tests
  *.test.ts             Unit-, helper- och kontraktstester
```

## Lokal installation

### 1. Installera beroenden

```bash
npm install
```

### 2. Skapa miljofil

Skapa en lokal `.env` baserad pa `.env.example`.

Exempel:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Lagg aldrig privata AI-nycklar i klientens miljofil.

### 3. Starta appen

```bash
npm run start
```

For webbversionen:

```bash
npm run web
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

Unit-, helper- och kontraktstester:

```bash
npm test
```

Webbexport:

```bash
npx expo export --platform web
```

Playwright E2E smoke tests:

```bash
npm run test:e2e -- --reporter=list
```

GitHub Actions CI finns i:

```text
.github/workflows/ci.yml
```

CI kor idag:

* `npm run typecheck`
* `npm run lint`
* `npm test`
* `npx expo export --platform web`

Den lokala verifieringssviten anvander aven Playwright E2E smoke tests for kritiska webbflden som workspace-navigation, one-map desktop-layout, Dagar add/edit-editorer, mobil overflow och mobil Rutt-karta.

Den automatiserade testsviten tacker bland annat:

* dagsammanfattning
* dagskostnad
* sorteringsordning
* smarta varningar
* Trip Readiness
* Utforska-mappning och persistenskontrakt
* Google Places-helperlogik
* kartdata
* flytt av stopp mellan dagar pa hjalpfunktionsniva
* atomisk `moveStop` pa kontrakts-/helperniva
* formularvalidering
* lokal rollback-hjalpare
* inline editing-validering
* datum- och tidshantering for inline editing
* kostnad och metadata for inline editing
* RLS SQL-audit pa projektets SQL-filer

Vissa tester ar helper- och kontraktstester. Verkliga PostgreSQL-tester for RLS, samtidighet och transaktionsrollback aterstar.

## Supabase

1. Skapa ett Supabase-projekt.
2. Kor relevanta SQL-filer i `supabase/`.
3. Kor migrationer i `supabase/migrations/`.
4. Aktivera RLS for anvandardata.
5. Aktivera Realtime for de tabeller som ska synkroniseras.
6. Konfigurera tillatna Site URL- och redirect-adresser.
7. Lagg `GEMINI_API_KEY` som en Supabase Edge Function-secret.

Exempel:

```bash
supabase secrets set GEMINI_API_KEY=...
```

RPC-funktionen for atomisk flytt finns i:

```text
public.move_itinerary_node(uuid, integer)
```

Utforska-persistens finns i migrationen:

```text
supabase/migrations/202606220001_create_trip_explore_items.sql
```

## Sakerhet

* privata API-nycklar far inte committas
* `.env` och relaterade lokala filer ignoreras av Git och Vercel
* AI-nycklar ska endast finnas i betrodd servermiljo
* Supabase RLS ska begransa atkomst till resor som anvandaren ager eller delar
* anvandardata ska valideras innan den sparas
* klienten far inte betraktas som en betrodd sakerhetsgrans
* serverfel ska inte exponera stack traces eller interna felmeddelanden till klienten

Att en `.env`-fil ar ignorerad av Git innebar inte att en nyckel ar saker om den anvands eller baddas in i klientkoden.

## Kanda begransningar

* verkliga automatiserade PostgreSQL-tester for RLS, rollback och samtidighet aterstar
* fullstandig integrationstestning mot Supabase saknas
* realtime och samarbete mellan flera samtidiga anvandare behover verifieras mer
* offlineflodet ar inte fullstandigt verifierat
* faktisk korstracka och kortid behover hamtas fran en routingtjanst
* mobil-QA behover fortsatta, sarskilt kring detaljpaneler, tangentbord och overflow
* flytt av stopp mellan olika dagar ar annu inte implementerad som separat funktion
* komponenttester for faktisk React Native-rendering saknas
* Playwright E2E finns, men bor fortsatt hallas smoke-nara och kompletteras med lagre niva tester dar det passar

## Nasta prioriterade steg

1. Genomfor en strukturerad mobil-, surfplatta- och desktop-QA.
2. Lagg till integrationstester for Supabase, RLS och realtime.
3. Overvaga att lagga Playwright E2E i CI nar kormiljon ar stabil.
4. Bygg separat funktion for att flytta stopp mellan dagar.
5. Fortsatt forbattra routing och faktisk kordata.
6. Bygg ut offlineflodet och konflikthantering.
7. Fortsatt stabilisera `App.tsx` genom sma beteendebevarande extraktioner.

Se [ROADMAP.md](./ROADMAP.md) for den fullstandiga utvecklingsplanen.

## Produktionsstatus

Roadtrip Pro ar en fungerande MVP under utveckling. Appen kan anvandas och testas, men bor inte betraktas som fullt produktionsklar forran de kvarstaende data-, sakerhets-, test- och kvalitetsstegen har genomforts.
