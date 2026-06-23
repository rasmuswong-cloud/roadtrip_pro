# Roadtrip Pro - Roadmap

## Overgripande mal

Roadtrip Pro ska bli en stabil och anvandarvanlig app for att planera en roadtrip fore avresa.

Utvecklingen prioriteras i foljande ordning:

1. korrekt och stabil datalagring
2. komplett dagplanering
3. tydlig och responsiv anvandarupplevelse
4. routing, delning och offlinefunktioner
5. sakert AI-stod
6. produktionskvalitet

Statusvarden:

* **Ej paborjad**
* **Pagaende**
* **Delvis klar**
* **Klar**

---

## Fas 1 - Stabilt dataflode

**Status: Delvis klar - Supabase-floden och atomisk flytt finns, djupare integrationstester aterstar**

### Implementerat

* server-first-flode for att skapa stopp
* server-first-flode for att redigera stopp
* server-first-flode for att ta bort stopp
* Supabase-repositories och mappers
* ansluten resa kan laddas och sparas
* Utforska-poster kan sparas i Supabase for anslutna resor
* atomisk flytt uppat och nedat inom samma dag via Supabase RPC
* PostgreSQL-transaktion med automatisk rollback
* server-side kontroll av `auth.uid()` och redigeringsbehorighet
* `SECURITY INVOKER` for move-RPC
* explicita `REVOKE`/`GRANT`-rattigheter
* lokal state uppdateras forst efter lyckad servermutation
* testbar sorterings-, rollback- och kontraktslogik

### Aterstar

* verifiering av stabila ID:n genom hela dataflodet
* skydd mot realtime-dubbletter
* konsekvent hantering av `null` och `undefined`
* integrationstestning av:

```text
UI -> Zustand/App state -> repository -> Supabase -> reload -> UI
```

* verifiering av samtidiga andringar fran flera klienter
* verkliga PostgreSQL-tester for rollback, RLS och samtidighet
* tydligare strategi for konflikter mellan offline, realtime och server-state

---

## Fas 2 - Komplett dagplanering

**Status: Delvis klar - dag-for-dag-editorn ar pa plats**

### Implementerat

* schemalagda och oschemalagda stopp
* dagkort
* kompakt stoppkort
* aktiviteter, boenden, transportstopp och matstopp
* tider, platser, kostnader, valuta och bokningsinformation
* skapa stopp
* redigera stopp
* ta bort stopp
* flytta stopp upp och ned inom samma dag
* dagsammanfattning
* smarta planeringsvarningar
* checklistor och packningsinformation
* separat `DayCard`-komponent
* separat `DayCard.styles.ts`
* inline editing for relevanta stoppfalt
* add-formular direkt i vald dag
* edit-formular direkt i eller under valt stopp
* Dagar E2E smoke coverage for add/edit-editorplacering

### Aterstar

* separat funktion for att flytta stopp mellan olika dagar
* battre hantering av stora mangder stopp i samma dag
* forbattrad tangentbordsupplevelse pa mobil
* mer visuell QA av detaljpaneler
* tydligare status for sparning och fel i vissa edge cases
* komponenttester for verklig React Native-rendering
* battre hantering av konflikter nar tva anvandare redigerar samma stopp

---

## Fas 3 - Smart reseoverblick

**Status: Delvis klar**

### Implementerat

* Trip Readiness
* workspace-atgarder fran readiness-issues
* dagsammanfattning
* dagskostnad
* sorteringsordning
* saknade kostnader
* lang kordag
* saknat boende
* overlappande tider
* stora tidsluckor
* aktivitet utan plats
* boende utan plats
* ofullstandiga koordinater
* budgetvarningar
* begransad visning av smarta varningar med mojlighet att visa fler

### Aterstar

* verifiering mot verklig ruttdata
* tester av fler gransfall
* battre UX for manga varningar samtidigt
* tydligare prioritering nar flera readiness-issues finns samtidigt

---

## Fas 4 - Responsiv design och visuell QA

**Status: Pagaende - map-first-layout och mobil smoke coverage finns**

### Implementerat

* webbversion via Expo och Vercel
* responsiv grundlayout
* map-first desktop-layout
* en primar persistent kartpanel pa desktop
* inga duplicerade stora centerkartor nar desktop map rail visas
* inbaddad karta i relevanta mobilfloden nar hoger rail saknas
* separat dagkortskomponent
* kompaktare stoppkort
* sekundara falt bakom detaljpanel
* kollapsbara checklistor och packlistor
* tekniskt fungerande web-export
* Playwright smoke tests for desktop one-map layout och mobil 375px overflow

### Aterstar

#### Mobil, cirka 375 px

* fortsatt systematisk kontroll av horisontell overflow
* kontroll av tryckytor
* kontroll av inline editing med mobilt tangentbord
* kontroll av detaljpaneler
* kontroll av menyknapp
* kontroll av langa anteckningar
* kontroll av dagkort med manga stopp
* test pa verklig mobil enhet

#### Surfplatta

* kontroll av mellanbredder
* balans mellan karta och planering
* kontroll av navigering och paneler
* kontroll av inline editing

#### Desktop, cirka 1440 px

* fortsatt kontroll av visuell hierarki
* effektiv anvandning av skarmbredd
* kontroll av langa listor och stora resor

---

## Fas 5 - UI-refaktorering

**Status: Pagaende - forsta workspace-extraktionen ar gjord**

### Implementerat

* dagkortet ar utbrutet till:

```text
src/components/planning/DayCard.tsx
```

* DayCard-specifika styles ar utbrutna till:

```text
src/components/planning/DayCard.styles.ts
```

* delade dagkortstyper finns i:

```text
src/models/dayPlan.ts
```

* inline editing-logik finns i:

```text
src/services/planning/inlineEdit.ts
```

* workspace-rendering har extraherats fran `App.tsx` till:

```text
src/components/workspaces/OverviewWorkspace.tsx
src/components/workspaces/ExploreWorkspace.tsx
src/components/workspaces/DaysWorkspace.tsx
src/components/workspaces/RouteWorkspace.tsx
src/components/workspaces/BudgetWorkspace.tsx
src/components/workspaces/ToolsWorkspace.tsx
src/components/workspaces/WorkspaceBits.tsx
```

### Aterstar

* behall `App.tsx` som orkestrator tills mindre, sakra extraktioner ar planerade
* typa workspace props striktare
* bryt ut platssokning
* bryt ut Dagar editor-state i hook eller fokuserad komponent
* bryt ut Utforska-kort och visuella helperkomponenter
* minska mangden callbacks som skickas till `DayCard`
* minska `any` i layout- och workspace-komponenter
* overvaga komponenttester for `DayCard`
* behall data- och affarslogik utanfor presentationskomponenterna

### Principer

* en refaktorering per commit
* ingen beteendeforandring i mekaniska extraktioner
* ingen databaslogik i UI-komponenter
* inga nya lokala kopior av global state
* inga nya beroenden utan tydligt behov
* typecheck, lint, tester och web-export ska passera efter varje storre extraktion

---

## Fas 6 - Plats och routing

**Status: Delvis klar**

### Implementerat

* Google Maps-rendering
* koordinater for stopp
* platsrelaterad struktur
* Google Places-sokning
* lokal waypoint-optimering
* ruttcache-struktur
* koordinater bevaras vid textbaserad platsandring
* bulkflode for saknade koordinater

### Aterstar

* faktisk korstracka
* faktisk kortid
* vaggeometri
* optimering via extern routingtjanst
* mojlighet att behalla manuell ordning
* cacheinvalidering
* felhantering vid misslyckad routingtjanst
* kostnads- och rate-limit-hantering

---

## Fas 7 - Delning och samarbete

**Status: Delvis klar**

### Implementerat

* Supabase-inloggning
* grundstruktur for delade resor
* delningskoder
* realtime-struktur
* repositories
* lokal synkroniseringsstruktur

### Aterstar

* test mellan tva riktiga anvandarsessioner
* tydlig visning av vilka som har atkomst
* hantering av samtidiga andringar
* konflikthantering
* skydd mot dubbletter
* mojlighet att lamna en resa
* felstatus nar synkronisering misslyckas
* verifiering av RLS-regler

---

## Fas 8 - Offline och synkronisering

**Status: Delvis klar**

### Implementerat

* SQLite-baserad lokal cache
* struktur for vantande mutationer
* synkroniseringsko
* struktur for ateranslutning

### Aterstar

* lasa tidigare resor helt offline
* redigera offline
* koa samtliga mutationstyper
* synkronisera efter ateranslutning
* visa synkroniseringsstatus
* konfliktlosning
* aterforsok med backoff
* integrationstester for offline -> online
* definiera hur inline editing ska bete sig offline

---

## Fas 9 - Sakert AI-stod

**Status: Delvis klar**

### Implementerat

* klientservice for AI-kommandon
* Supabase Edge Function
* Zod-validerad mutationsplan
* Gemini-anrop fran servermiljo
* klienten skickar Supabase-session och anon key
* `.vercelignore` skyddar lokala miljofiler vid deploy
* generiskt 500-fel till klienten for att undvika informationslackage via stack trace

### Aterstar

* verifiera att alla privata AI-nycklar endast finns som Supabase secrets
* ta bort all oanvand AI-konfiguration
* anvandarbekraftelse fore samtliga AI-mutationer
* rate limiting
* kostnadskontroll
* battre felhantering
* loggning utan kanslig data
* tester for ogiltiga och skadliga AI-svar

---

## Fas 10 - Kvalitet och produktion

**Status: Pagaende - CI och E2E smoke tests finns**

### Implementerat

* TypeScript-kontroll
* ESLint
* automatiserade helper-/unit-tester
* Expo web-export
* GitHub Actions CI for typecheck, lint, unit tests och web-export
* Playwright E2E smoke tests
* Vercel production-deploy
* Dependabot-uppdatering av `esbuild`
* test av dagsammanfattning
* test av dagskostnad
* test av sorteringsordning
* test av smarta varningar
* test av Trip Readiness
* test av Utforska-mappning
* test av Google Places-helperlogik
* test av kartdata
* test av flyttlogik
* test av formularvalidering
* test av lokal rollback-hjalpare
* test av inline editing-hjalpare
* kontraktstester for atomisk moveStop-migration
* RLS SQL-audit-tester for projektets SQL-filer

### Aterstar

* integrationstester mot Supabase
* verkliga PostgreSQL-tester for RLS, samtidighet och rollback
* eventuell Playwright-korning i CI nar kormiljon ar stabil
* sakerhetsgranskning utover SQL-audit
* tillganglighetskontroll
* prestandamatning
* felovervakning
* strukturerad loggning
* backup- och aterstallningsplan
* dokumenterad releaseprocess
* komponenttester for React Native Web

### Acceptanskriterier

* CI kor typecheck, lint, tester och web-export
* kritiska anvandarfloden har integrationstester
* centrala anvandarfloden har end-to-end smoke coverage
* RLS ar verifierat med verklig databasexekvering eller dokumenterad manuell testplan
* inga hemligheter finns i klient eller repository
* produktionen har felovervakning
* mobil- och desktopfloden ar testade

---

# Releasekriterier for MVP

MVP:n kan betraktas som stabil nar:

* skapa, oppna och redigera resa fungerar
* stopp kan skapas, flyttas och tas bort
* stopp kan inline-redigeras utan dataforlust
* Dagar add/edit-editorer ligger nara vald dag eller valt stopp
* `moveStop` ar atomisk inom samma dag
* flytt mellan dagar finns som separat tydlig funktion eller ar tydligt avgransad
* andringar finns kvar efter omladdning
* Utforska-data finns kvar for anslutna resor
* inga kanda datadubbletter finns
* sorteringsordningen ar stabil
* budget och dagskostnad beraknas korrekt
* smarta varningar fungerar
* desktop har en tydlig one-map-layout
* mobil och desktop ar visuellt verifierade
* delning fungerar mellan tva anvandare
* typecheck, lint, tester, web-export och E2E smoke tests passerar lokalt
* CI ar konfigurerad
* inga privata API-nycklar exponeras
* Supabase RLS ar verifierat

# Narmaste prioriteringar

1. Genomfor strukturerad mobil-, surfplatta- och desktop-QA.
2. Lagg till integrationstester for Supabase, RLS och realtime.
3. Overvag Playwright E2E i CI nar kormiljon ar stabil.
4. Bygg separat funktion for att flytta stopp mellan olika dagar.
5. Fortsatt stabilisera `App.tsx` genom sma beteendebevarande extraktioner.
6. Forbattra plats- och routingflodet.
7. Bygg ut offline- och konflikthantering.
