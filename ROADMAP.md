# Roadtrip Pro – Roadmap

## Övergripande mål

Roadtrip Pro ska bli en stabil och användarvänlig app för att planera en roadtrip före avresa.

Utvecklingen prioriteras i följande ordning:

1. korrekt och stabil datalagring
2. komplett dagplanering
3. tydlig och responsiv användarupplevelse
4. routing, delning och offlinefunktioner
5. säkert AI-stöd
6. produktionskvalitet

Statusvärden:

* **Ej påbörjad**
* **Pågående**
* **Delvis klar**
* **Klar**

---

## Fas 1 – Stabilt dataflöde

**Status: Delvis klar – atomisk flytt inom samma dag implementerad**

### Mål

Säkerställa att data sparas, uppdateras och laddas om utan att försvinna, dupliceras eller hamna i fel ordning.

### Implementerat

* server-first-flöde för att skapa stopp
* server-first-flöde för att redigera stopp
* server-first-flöde för att ta bort stopp
* atomisk flytt uppåt och nedåt inom samma dag via Supabase RPC
* ett enda serveranrop per stoppflytt
* PostgreSQL-transaktion med automatisk rollback
* server-side kontroll av `auth.uid()` och redigeringsbehörighet
* `SECURITY INVOKER`
* explicit säker `search_path`
* `EXECUTE` återkallat från `public` och `anon`
* `EXECUTE` tilldelat `authenticated`
* lokal state uppdateras först efter lyckad RPC
* stopp från andra dagar och lokala osynkade stopp bevaras
* datum och tider ändras inte vid omordning
* första och sista stoppet hanteras som no-op vid ogiltig flyttriktning
* testbar sorteringslogik
* formulärvalidering före sparning
* repositories för Supabase-data
* struktur för Zustand-state och optimistic updates

### Återstår

* verifiering av stabila ID:n genom hela dataflödet
* skydd mot realtime-dubbletter
* konsekvent hantering av `null` och `undefined`
* integrationstestning av:

```text
UI → Zustand/App state → repository → Supabase → reload → UI
```

* verifiering av samtidiga ändringar från flera klienter
* verkliga PostgreSQL-tester för rollback, RLS och samtidighet
* tydligare strategi för konflikter mellan offline, realtime och server-state

### Kvarstående verifiering

RPC-funktionen är applicerad i Supabase och har testats manuellt via den deployade webbappen. Flytt uppåt och nedåt fungerar och ordningen består efter omladdning.

Automatiserade PostgreSQL-tester för faktisk RLS-exekvering, samtidighet och transaktionsrollback återstår.

### Acceptanskriterier

Fasen kan markeras som klar när:

* alla centrala CRUD-flöden är integrationstestade mot Supabase
* inga duplicerade stopp skapas
* sorteringsordningen är identisk efter omladdning
* obehöriga användare nekas åtkomst
* realtime inte skapar dubbletter
* användaren får tydliga felmeddelanden vid misslyckad sparning
* RLS är verifierat med tester eller dokumenterad manuell testplan

### Beroenden

* Supabase-testmiljö
* integrationsteststrategi
* verifierade RLS- och behörighetskontroller

---

## Fas 2 – Komplett dagplanering

**Status: Delvis klar**

### Mål

Användaren ska kunna planera och redigera en hel resa direkt i dagvyn.

### Implementerat

* schemalagda och oschemalagda stopp
* dagkort
* kompakt stoppkort
* aktiviteter
* boenden
* transportstopp
* tider
* platser
* kostnader
* valuta
* bokningsstatus
* bokningsreferens
* anteckningar
* skapa stopp
* redigera stopp
* ta bort stopp
* flytta stopp upp och ned inom samma dag
* dagsammanfattning
* smarta planeringsvarningar
* checklistor och packningsinformation
* separat `DayCard`-komponent
* separat `DayCard.styles.ts`
* inline editing för alla relevanta stoppfält
* detaljpanel för sekundära fält
* menyknapp för fler åtgärder

### Inline editing

Följande fält är inline-redigerbara:

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

Inline editing stödjer:

* globalt aktivt fält
* save/cancel
* validering
* bevarad draft vid fel
* skydd mot dubbla sparningar
* server-first-sparning
* uppdaterad dagssammanfattning och budget efter lyckad sparning

### Återstår

* separat funktion för att flytta stopp mellan olika dagar
* bättre hantering av stora mängder stopp i samma dag
* förbättrad tangentbordsupplevelse på mobil
* mer visuell QA av detaljpaneler
* tydligare status för sparning och fel i vissa edge cases
* komponenttester för verklig React Native-rendering
* bättre hantering av konflikter när två användare redigerar samma stopp

### Acceptanskriterier

Fasen kan markeras som klar när:

* alla stödda fält kan redigeras utan att lämna dagvyn
* redan inskriven information försvinner inte vid valideringsfel eller serverfel
* användaren kan skapa, redigera, flytta och ta bort stopp
* ändringar finns kvar efter omladdning
* inga dubbla sparningar uppstår
* mobil och desktop är visuellt verifierade
* flytt mellan dagar finns som separat tydlig användarhandling

### Beroenden

* Fas 1 för stabil datalagring
* mobil-QA
* integrationstester

---

## Fas 3 – Smart reseöverblick

**Status: Delvis klar**

### Mål

Appen ska hjälpa användaren att upptäcka problem och luckor i planeringen.

### Implementerat

Testbar logik finns för bland annat:

* dagsammanfattning
* dagskostnad
* sorteringsordning
* saknade kostnader
* lång kördag
* saknat boende
* överlappande tider
* stora tidsluckor
* aktivitet utan plats
* boende utan plats
* ofullständiga koordinater
* budgetvarningar
* begränsad visning av smarta varningar med möjlighet att visa fler

### Återstår

* fullständig reseöversikt över alla dagar
* summering av total körsträcka
* summering av total körtid
* total resebudget
* tydlig prioritering av viktiga varningar
* möjlighet att filtrera eller dölja varningar
* verifiering mot verklig ruttdata
* tester av fler gränsfall
* bättre UX för många varningar samtidigt

### Princip

Varningar ska hjälpa användaren men inte blockera sparning eller redigering.

### Acceptanskriterier

* varje varning har en tydlig orsak
* samma indata ger samma varning
* falska positiva varningar är begränsade
* användaren kan förstå vilken dag och vilket stopp som berörs
* varningar fungerar med verklig rutt- och kostnadsdata

---

## Fas 4 – Responsiv design och visuell QA

**Status: Pågående**

### Mål

Appen ska fungera bra på mobil, surfplatta och desktop.

### Implementerat

* webbversion via Expo och Vercel
* responsiv grundlayout
* separat dagkortskomponent
* kompaktare stoppkort
* sekundära fält bakom detaljpanel
* kollapsbara checklistor och packlistor
* tekniskt fungerande web-export
* manuell visuell kontroll av dagkort efter refaktoreringar

### Återstår

#### Mobil, cirka 375 px

* systematisk kontroll av horisontell overflow
* kontroll av tryckytor
* kontroll av inline editing med mobilt tangentbord
* kontroll av detaljpaneler
* kontroll av menyknapp
* kontroll av långa anteckningar
* kontroll av dagkort med många stopp
* test på verklig mobil enhet

#### Surfplatta

* kontroll av mellanbredder
* balans mellan karta och planering
* kontroll av navigering och paneler
* kontroll av inline editing

#### Desktop, cirka 1440 px

* tydlig visuell hierarki
* effektiv användning av skärmbredd
* balans mellan dagplanering och karta
* kontroll av långa listor och stora resor

### Acceptanskriterier

* ingen oavsiktlig horisontell scroll
* primära funktioner är lätta att nå
* inline editing går att använda på mobil
* formulär och detaljpaneler fungerar med tangentbord
* layouten fungerar vid minst 375, 768 och 1440 px
* kritiska funktioner är visuellt verifierade

---

## Fas 5 – UI-refaktorering

**Status: Pågående**

### Mål

Minska komplexiteten i `App.tsx` utan att ändra beteendet.

### Implementerat

* dagkortet är utbrutet till:

```text
src/components/planning/DayCard.tsx
```

* DayCard-specifika styles är utbrutna till:

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

### Återstår

* bryt ut platssökningen
* bryt ut oschemalagda stopp
* bryt ut större modaler
* bryt ut planerhuvudet
* flytta rent visuella hjälpfunktioner när det är säkert
* minska mängden callbacks som skickas till `DayCard`
* överväg komponenttester för `DayCard`
* behåll data- och affärslogik utanför presentationskomponenterna

### Principer

* en refaktorering per commit
* ingen beteendeförändring i mekaniska extraktioner
* ingen databaslogik i UI-komponenter
* inga nya lokala kopior av global state
* inga `any`
* inga nya beroenden utan tydligt behov

### Acceptanskriterier

* `App.tsx` har tydligare ansvar
* komponenterna är begripliga och testbara
* mutationer och datalagring ligger kvar i services, repositories eller parent-flöden
* typecheck, lint, tester och web-export passerar efter varje extraktion

---

## Fas 6 – Plats och routing

**Status: Delvis klar**

### Mål

Göra det enkelt att hitta platser och skapa en realistisk körplan.

### Implementerat

* kartkomponent
* koordinater för stopp
* platsrelaterad struktur
* lokal waypoint-optimering
* ruttcache-struktur
* koordinater bevaras vid textbaserad platsändring

### Återstår

* stabil platssökning
* automatisk hämtning av koordinater
* möjlighet att uppdatera kartposition efter ändrat platsnamn
* faktisk körsträcka
* faktisk körtid
* väggeometri
* optimering via extern routingtjänst
* möjlighet att behålla manuell ordning
* cacheinvalidering
* felhantering vid misslyckad routingtjänst
* kostnads- och rate-limit-hantering

### Acceptanskriterier

* varje stopp kan visas korrekt på kartan
* användaren kan se när platsnamn och koordinater kan skilja sig åt
* faktisk rutt kan beräknas
* användaren kan välja mellan föreslagen och manuell ordning
* appen hanterar att routingtjänsten är otillgänglig

---

## Fas 7 – Delning och samarbete

**Status: Delvis klar**

### Mål

Flera användare ska kunna planera samma resa utan att skapa konflikter eller dubbletter.

### Implementerat

* Supabase-inloggning
* grundstruktur för delade resor
* delningskoder
* realtime-struktur
* repositories
* lokal synkroniseringsstruktur

### Återstår

* test mellan två riktiga användarsessioner
* tydlig visning av vilka som har åtkomst
* hantering av samtidiga ändringar
* konflikthantering
* skydd mot dubbletter
* möjlighet att lämna en resa
* felstatus när synkronisering misslyckas
* verifiering av RLS-regler

### Acceptanskriterier

* två användare kan redigera samma resa
* ändringar visas utan duplicering
* obehöriga användare nekas åtkomst
* konflikter hanteras eller visas tydligt
* realtime fungerar utan att skriva över lokal draft

---

## Fas 8 – Offline och synkronisering

**Status: Delvis klar**

### Mål

Grundläggande reseplanering ska fungera utan internetanslutning.

### Implementerat

* SQLite-baserad lokal cache
* struktur för väntande mutationer
* synkroniseringskö
* struktur för återanslutning

### Återstår

* läsa tidigare resor helt offline
* redigera offline
* köa samtliga mutationstyper
* synkronisera efter återanslutning
* visa synkroniseringsstatus
* konfliktlösning
* återförsök med backoff
* integrationstester för offline → online
* definiera hur inline editing ska bete sig offline

### Acceptanskriterier

* en tidigare laddad resa kan öppnas utan internet
* ändringar kan göras offline
* ändringarna synkroniseras när anslutningen återkommer
* användaren ser om något väntar på synkronisering
* konflikter hanteras utan dataförlust

---

## Fas 9 – Säkert AI-stöd

**Status: Delvis klar**

### Mål

AI ska göra planeringen snabbare utan att få okontrollerad åtkomst till användardata eller databas.

### Implementerat

* klientservice för AI-kommandon
* Supabase Edge Function
* Zod-validerad mutationsplan
* Gemini-anrop från servermiljö
* klienten skickar Supabase-session och anon key
* `.vercelignore` skyddar lokala miljöfiler vid deploy
* generiskt 500-fel till klienten för att undvika informationsläckage via stack trace

### Återstår

* verifiera att alla privata AI-nycklar endast finns som Supabase secrets
* ta bort all oanvänd AI-konfiguration
* användarbekräftelse före samtliga AI-mutationer
* rate limiting
* kostnadskontroll
* bättre felhantering
* loggning utan känslig data
* tester för ogiltiga och skadliga AI-svar

### Säkerhetskrav

* privata AI-nycklar får aldrig finnas i klientbundle
* AI får inte skriva direkt till databasen utan validering
* användaren ska kunna se föreslagna ändringar innan de genomförs
* AI-svar ska betraktas som opålitlig indata
* serverfel får inte exponera stack traces eller interna felmeddelanden

### Acceptanskriterier

* inga privata AI-nycklar exponeras i klienten
* samtliga mutationer valideras
* användaren godkänner ändringar
* rate limits och fel hanteras tydligt
* känsliga felmeddelanden loggas endast server-side

---

## Fas 10 – Kvalitet och produktion

**Status: Pågående**

### Implementerat

* TypeScript-kontroll
* ESLint
* automatiserade helper-/unit-tester
* Expo web-export
* Vercel production-deploy
* Dependabot-uppdatering av `esbuild`
* test av dagsammanfattning
* test av dagskostnad
* test av sorteringsordning
* test av smarta varningar
* test av flyttlogik
* test av formulärvalidering
* test av lokal rollback-hjälpare
* test av inline editing-hjälpare
* kontraktstester för atomisk moveStop-migration

### Återstår

* GitHub Actions eller annan CI
* integrationstester mot Supabase
* verkliga PostgreSQL-tester för RLS, samtidighet och rollback
* end-to-end-tester
* säkerhetsgranskning
* verifiering av RLS
* tillgänglighetskontroll
* prestandamätning
* felövervakning
* strukturerad loggning
* backup- och återställningsplan
* dokumenterad releaseprocess
* komponenttester för React Native Web

### Acceptanskriterier

* CI kör typecheck, lint, tester och web-export
* kritiska användarflöden har integrationstester
* centrala användarflöden har end-to-end-tester
* RLS är verifierat
* inga hemligheter finns i klient eller repository
* produktionen har felövervakning
* mobil- och desktopflöden är testade

---

# Releasekriterier för MVP

MVP:n kan betraktas som stabil när:

* skapa, öppna och redigera resa fungerar
* stopp kan skapas, flyttas och tas bort
* stopp kan inline-redigeras utan dataförlust
* `moveStop` är atomisk inom samma dag
* flytt mellan dagar finns som separat tydlig funktion eller är tydligt avgränsad
* ändringar finns kvar efter omladdning
* inga kända datadubbletter finns
* sorteringsordningen är stabil
* budget och dagskostnad beräknas korrekt
* smarta varningar fungerar
* mobil och desktop är visuellt verifierade
* delning fungerar mellan två användare
* typecheck, lint, tester och web-export passerar
* CI är konfigurerad
* inga privata API-nycklar exponeras
* Supabase RLS är verifierat

# Närmaste prioriteringar

1. Genomför strukturerad mobil-, surfplatta- och desktop-QA.
2. Lägg till GitHub Actions för typecheck, lint, tester och web-export.
3. Lägg till integrationstester för Supabase, RLS och realtime.
4. Bygg separat funktion för att flytta stopp mellan olika dagar.
5. Förbättra plats- och routingflödet.
6. Bygg ut offline- och konflikthantering.
