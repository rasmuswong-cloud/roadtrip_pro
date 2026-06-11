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

**Status: Delvis klar**

### Mål

Säkerställa att data sparas, uppdateras och laddas om utan att försvinna, dupliceras eller hamna i fel ordning.

### Implementerat

* server-first-flöde för att skapa stopp
* server-first-flöde för att redigera stopp
* server-first-flöde för att ta bort stopp
* testbar sorteringslogik
* lokal rollback-hjälpare
* formulärvalidering före sparning
* repositories för Supabase-data
* struktur för Zustand-state och optimistic updates

### Återstår

* atomisk flytt av stopp via Supabase RPC
* verifiering av stabila ID:n genom hela dataflödet
* skydd mot realtime-dubbletter
* konsekvent hantering av `null` och `undefined`
* integrationstestning av:

```text
UI → Zustand → repository → Supabase → reload → UI
```

* verifiering av samtidiga ändringar från flera klienter
* riktig automatisk rollback där optimistic updates används

### Känd risk

`moveStop` använder flera separata databasoperationer. Om den första lyckas och nästa misslyckas kan sorteringsordningen bli delvis uppdaterad i Supabase.

### Acceptanskriterier

* en flytt av stopp genomförs som en enda atomisk operation
* misslyckad flytt lämnar både lokal state och databas oförändrade
* inga duplicerade stopp skapas
* sorteringsordningen är identisk efter omladdning
* användaren får ett tydligt felmeddelande vid misslyckad sparning

### Beroenden

* Supabase RPC eller annan Postgres-transaktion
* verifierade RLS- och behörighetskontroller

---

## Fas 2 – Komplett dagplanering

**Status: Delvis klar**

### Mål

Användaren ska kunna planera och redigera en hel resa direkt i dagvyn.

### Implementerat

* schemalagda och oschemalagda stopp
* dagkort
* aktiviteter
* boenden
* transportstopp
* tider
* platser
* kostnader
* anteckningar
* skapa stopp
* redigera stopp
* ta bort stopp
* flytta stopp upp och ned
* dagsammanfattning
* smarta planeringsvarningar
* checklistor och packningsinformation
* separat `DayCard`-komponent

### Återstår

* sluttid som separat fullständigt redigerbart fält
* valuta som separat fullständigt redigerbart fält
* bokningsreferens som separat fullständigt redigerbart fält
* tydligare bekräftelse vid borttagning
* robust flytt av stopp mellan dagar
* förbättrad hantering av oschemalagda stopp
* tydligare sparstatus
* bättre hantering av valideringsfel direkt vid respektive fält

### Acceptanskriterier

* alla stödda fält kan redigeras utan att lämna dagvyn
* redan inskriven information försvinner inte vid valideringsfel
* användaren kan skapa, redigera, flytta och ta bort stopp
* alla ändringar finns kvar efter omladdning
* inga dubbla sparningar uppstår

### Beroenden

* Fas 1 för atomisk och stabil datalagring

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

### Återstår

* fullständig reseöversikt över alla dagar
* summering av total körsträcka
* summering av total körtid
* total resebudget
* tydlig prioritering av viktiga varningar
* möjlighet att filtrera eller dölja varningar
* verifiering mot verklig ruttdata
* tester av fler gränsfall

### Princip

Varningar ska hjälpa användaren men inte blockera sparning eller redigering.

### Acceptanskriterier

* varje varning har en tydlig orsak
* samma indata ger samma varning
* falska positiva varningar är begränsade
* användaren kan förstå vilken dag och vilket stopp som berörs

---

## Fas 4 – Responsiv design och visuell QA

**Status: Pågående**

### Mål

Appen ska fungera bra på mobil, surfplatta och desktop.

### Implementerat

* webbversion via Expo och Vercel
* responsiv grundlayout
* separat dagkortskomponent
* tekniskt fungerande web-export
* manuell visuell kontroll av nuvarande dagkort efter refaktorering

### Återstår

#### Mobil, cirka 375 px

* kontroll av horisontell overflow
* kontroll av tryckytor
* kontroll av formulär med mobilt tangentbord
* kontroll av modaler och paneler
* kontroll av dagkort med mycket innehåll
* test på verklig mobil enhet

#### Surfplatta

* kontroll av mellanbredder
* balans mellan karta och planering
* kontroll av navigering och paneler

#### Desktop, cirka 1440 px

* tydlig visuell hierarki
* effektiv användning av skärmbredd
* balans mellan dagplanering och karta
* kontroll av långa listor och stora resor

### Acceptanskriterier

* ingen oavsiktlig horisontell scroll
* primära funktioner är lätta att nå
* formulär går att använda på mobil
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

* delade dagkortstyper finns i:

```text
src/models/dayPlan.ts
```

### Återstår

* bryt ut inline-editorn
* bryt ut platssökningen
* bryt ut oschemalagda stopp
* bryt ut större modaler
* bryt ut planerhuvudet
* flytta rent visuella hjälpfunktioner när det är säkert
* minska mängden callbacks som skickas till `DayCard`
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

### Återstår

* stabil platssökning
* automatisk hämtning av koordinater
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

### Acceptanskriterier

* en tidigare laddad resa kan öppnas utan internet
* ändringar kan göras offline
* ändringarna synkroniseras när anslutningen återkommer
* användaren ser om något väntar på synkronisering

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

### Acceptanskriterier

* inga privata AI-nycklar exponeras i klienten
* samtliga mutationer valideras
* användaren godkänner ändringar
* rate limits och fel hanteras tydligt

---

## Fas 10 – Kvalitet och produktion

**Status: Pågående**

### Implementerat

* TypeScript-kontroll
* ESLint
* automatiserade enhetstester
* Expo web-export
* Vercel production-deploy
* test av dagsammanfattning
* test av dagskostnad
* test av sorteringsordning
* test av smarta varningar
* test av flytt mellan dagar
* test av formulärvalidering
* test av lokal rollback-hjälpare

### Återstår

* GitHub Actions eller annan CI
* integrationstester mot Supabase
* end-to-end-tester
* säkerhetsgranskning
* verifiering av RLS
* tillgänglighetskontroll
* prestandamätning
* felövervakning
* strukturerad loggning
* backup- och återställningsplan
* dokumenterad releaseprocess

### Acceptanskriterier

* CI kör typecheck, lint, tester och web-export
* kritiska användarflöden har integrationstester
* centrala användarflöden har end-to-end-tester
* RLS är verifierat
* inga hemligheter finns i klient eller repository
* produktionen har felövervakning

---

# Releasekriterier för MVP

MVP:n kan betraktas som stabil när:

* skapa, öppna och redigera resa fungerar
* stopp kan skapas, flyttas och tas bort
* `moveStop` är atomisk
* ändringar finns kvar efter omladdning
* inga kända datadubbletter finns
* sorteringsordningen är stabil
* budget och dagskostnad beräknas korrekt
* smarta varningar fungerar
* mobil och desktop är visuellt verifierade
* delning fungerar mellan två användare
* typecheck, lint, tester och web-export passerar
* inga privata API-nycklar exponeras
* Supabase RLS är verifierat

# Närmaste prioriteringar

1. Implementera atomisk `moveStop` via Supabase RPC.
2. Slutför inline-redigering för sluttid, valuta och bokningsreferens.
3. Genomför visuell QA på mobil, surfplatta och desktop.
4. Bryt ut nästa tydligt avgränsade UI-del ur `App.tsx`.
5. Lägg till integrationstester för Supabase och realtime.
6. Konfigurera CI.
