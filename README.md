# Roadtrip Pro

Roadtrip Pro är en webbaserad reseplanerare för roadtrips. Appen samlar resans dagar, destinationer, aktiviteter, boenden, tider, kostnader, bokningsinformation och anteckningar i en gemensam plan.

**Liveversion:**
https://roadtrip-pro-sy5y.vercel.app/

## Projektets mål

Målet är att skapa en lättanvänd app där en roadtrip kan planeras före avresa.

Appen ska hjälpa användaren att:

* planera resan dag för dag
* lägga till destinationer, aktiviteter, boenden och transportstopp
* hålla reda på tider, bokningar, kostnader och anteckningar
* se stopp och rutter på karta
* dela en resa med andra användare
* upptäcka problem som saknade boenden, långa kördagar och budgetavvikelser
* redigera resplanen snabbt och intuitivt direkt i dagkortet
* använda appen på både mobil och dator

## Nuvarande status

Roadtrip Pro är en fungerande MVP under aktiv utveckling.

Det centrala planeringsflödet finns på plats:

1. Användaren kan logga in eller använda appens tillgängliga resläge.
2. En resa kan skapas eller öppnas.
3. Resan visas som en dag-för-dag-planering.
4. Stopp kan skapas, redigeras, flyttas och tas bort.
5. Resedata sparas i Supabase.
6. Dagkort visar sammanfattningar, aktiviteter, boende, körning, kostnader och planeringsvarningar.
7. Relevanta fält kan redigeras inline direkt i dagkortet.
8. Flytt av stopp uppåt och nedåt inom samma dag sker atomiskt via Supabase RPC.

Projektet är ännu inte färdigt för generell produktion. Framför allt behöver mobilupplevelse, integrationstester, RLS-verifiering, realtime, offlinefunktioner och CI byggas ut ytterligare.

## Funktioner

### Dag-för-dag-planering

* schemalagda och oschemalagda stopp
* aktiviteter, boenden, matstopp och transportstopp
* tider, platser, kostnader och anteckningar
* dagsammanfattning med antal stopp, körning och kostnad
* smarta planeringsvarningar
* checklistor och packningsinformation
* kompakt stoppkort med tydlig reseinformation
* sekundära fält bakom detaljpanel
* meny för fler åtgärder

Dagkortets presentation finns i:

```text
src/components/planning/DayCard.tsx
```

DayCard-specifika styles finns i:

```text
src/components/planning/DayCard.styles.ts
```

### Inline editing

Stopp kan redigeras direkt i dagkortet utan separat formulär.

Följande fält stödjer inline-redigering:

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

Designprincipen är att stoppkortet ska se ut som vanlig reseinformation i normalläge. Endast det fält användaren klickar på visas som input, select eller textarea.

Inline editing har stöd för:

* globalt aktivt fält i planeringsvyn
* spara och avbryt
* validering
* skydd mot dubbla sparningar
* bevarad draft vid fel
* server-first-sparning
* uppdatering av lokal state först efter lyckat Supabase-anrop

Platsändring ändrar inte koordinater automatiskt. Om platsnamnet ändras medan koordinater finns kvar visas en varning om att kartpositionen bör kontrolleras.

### Atomisk flytt av stopp

Flytt av stopp uppåt och nedåt inom samma dag sker genom en Supabase RPC-funktion och en atomisk PostgreSQL-transaktion.

Det innebär att:

* hela flytten lyckas eller rullas tillbaka
* flytten görs med ett serveranrop
* stopp flyttas inte automatiskt mellan olika dagar
* datum och tider ändras inte vid omordning
* behörighet kontrolleras server-side
* lokal state uppdateras först efter lyckat RPC-anrop
* första stoppet uppåt och sista stoppet nedåt hanteras som no-op

Flytt mellan olika dagar är en separat framtida funktion och ingår inte i Upp/Ner-knapparnas nuvarande beteende.

Migrationen finns i:

```text
supabase/migrations/202606120001_atomic_move_itinerary_node.sql
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
* formulärvalidering
* smarta planeringsvarningar
* lokal rollback-hjälpare

### Inline edit-logik

Inline editing-logik finns i:

```text
src/services/planning/inlineEdit.ts
```

Den hanterar bland annat:

* fältmappning
* visningsvärden
* validering
* datum- och tidshantering
* patchning av `ItineraryNode`
* kostnad, valuta och bokningsmetadata

### Budget

* kostnader per stopp
* dagskostnad
* kostnadskategorier
* markering av stopp som saknar kostnad
* budgetöversikt
* inline-redigerad kostnad påverkar dagbudget och summeringar

### Karta och routing

* kartkomponent
* koordinater för stopp
* lokal waypoint-struktur
* stödstruktur för ruttcache och extern routing

Faktiska restider, vägsträckor och väggeometrier behöver fortfarande hämtas från en extern routingtjänst för ett fullständigt produktionsflöde.

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

Edge Functionen returnerar generiska serverfel till klienten för att undvika informationsläckage via stack traces, medan detaljer kan loggas server-side.

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
    planning/            Dagkort, inline editing och planeringskomponenter
  data/                  Seed- och demodata
  models/                Domänmodeller och delade TypeScript-typer
  services/
    ai/                  AI-tolkning och mutationsplaner
    auth/                Inloggning och användarsession
    database/            Supabase repositories och mappers
    offline/             Lokal SQLite-cache
    planning/            Dagsanalys, inline editing, validering och varningar
    routing/             Rutt- och waypointlogik
    sync/                Synkroniseringskö
  store/                 Zustand-store
supabase/
  functions/             Supabase Edge Functions
  migrations/            Supabase/Postgres-migrationer
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
* flytt av stopp mellan dagar på hjälpfunktionsnivå
* atomisk `moveStop` på kontrakts-/helpernivå
* formulärvalidering
* lokal rollback-hjälpare
* inline editing-validering
* datum- och tidshantering för inline editing
* kostnad och metadata för inline editing

Vissa tester är helper- och kontraktstester. Verkliga PostgreSQL-tester för RLS, samtidighet och transaktionsrollback återstår.

## Supabase

1. Skapa ett Supabase-projekt.
2. Kör relevanta SQL-filer i `supabase/`.
3. Kör migrationer i `supabase/migrations/`.
4. Aktivera RLS för användardata.
5. Aktivera Realtime för de tabeller som ska synkroniseras.
6. Konfigurera tillåtna Site URL- och redirect-adresser.
7. Lägg `GEMINI_API_KEY` som en Supabase Edge Function-secret.

Exempel:

```bash
supabase secrets set GEMINI_API_KEY=...
```

RPC-funktionen för atomisk flytt finns i:

```text
public.move_itinerary_node(uuid, integer)
```

Den använder:

* `SECURITY INVOKER`
* explicit `search_path`
* kontroll av `auth.uid()`
* kontroll av redigeringsbehörighet
* explicita `REVOKE`/`GRANT`-rättigheter

## Säkerhet

* privata API-nycklar får inte committas
* `.env` och relaterade lokala filer ignoreras av Git och Vercel
* AI-nycklar ska endast finnas i betrodd servermiljö
* Supabase RLS ska begränsa åtkomst till resor som användaren äger eller delar
* användardata ska valideras innan den sparas
* klienten får inte betraktas som en betrodd säkerhetsgräns
* serverfel ska inte exponera stack traces eller interna felmeddelanden till klienten

Att en `.env`-fil är ignorerad av Git innebär inte att en nyckel är säker om den används eller bäddas in i klientkoden.

## Kända begränsningar

* verkliga automatiserade PostgreSQL-tester för RLS, rollback och samtidighet återstår
* fullständig integrationstestning mot Supabase saknas
* realtime och samarbete mellan flera samtidiga användare behöver verifieras mer
* offlineflödet är inte fullständigt verifierat
* faktisk körsträcka och körtid behöver hämtas från en routingtjänst
* mobil-QA behöver fortsätta, särskilt kring detaljpaneler, tangentbord och overflow
* end-to-end-tester och CI återstår
* flytt av stopp mellan olika dagar är ännu inte implementerad som separat funktion
* komponenttester för faktisk React Native-rendering saknas

## Nästa prioriterade steg

1. Genomför en strukturerad mobil-, surfplatta- och desktop-QA.
2. Lägg till GitHub Actions för typecheck, lint, tester och web-export.
3. Lägg till integrationstester för Supabase, RLS och realtime.
4. Bygg separat funktion för att flytta stopp mellan dagar.
5. Fortsätt förbättra routing och faktisk kördata.
6. Bygg ut offlineflödet och konflikthantering.

Se [ROADMAP.md](./ROADMAP.md) för den fullständiga utvecklingsplanen.

## Produktionsstatus

Roadtrip Pro är en fungerande MVP under utveckling. Appen kan användas och testas, men bör inte betraktas som fullt produktionsklar förrän de kvarstående data-, säkerhets-, test- och kvalitetsstegen har genomförts.
