# Reseapp - nästa steg

Senast klart:
- UI:t är nu mer samlat kring dagplanering i stället för separat Excel/tabell-vy.
- Dag 1, Dag 2 osv är huvudytan för att se, redigera och lägga till steg.
- Separat "Planeringstabell" är borttagen för att undvika kaka på kaka.
- Appen är på svenska i de viktigaste användarflödena.

Nästa fokus:
- Göra dagkorten ännu tydligare: boende, aktivitet, körning, kostnad och notis ska synas snabbt utan att öppna redigering.
- Förbättra inline-redigeringen i dagarna så alla viktiga fält känns enkla: titel, plats, tid, typ, kostnad, bokning, anteckningar och koordinater.
- Lägga till smarta funktioner som Excel inte ger:
  - varna för saknat boende per dag
  - varna för lång kördag
  - visa budgetavvikelse per dag
  - markera saknad kostnad
  - föreslå luckor i schemat
  - summera resan dag för dag
- Göra platsverktyget mer integrerat: sök plats och lägg direkt in i vald dag.
- Putsa mobil/desktop-layout så dagarna känns som en riktig reseapp, inte ett kalkylblad.

Bra start nästa gång:
1. Öppna appen och testa flödet: Anslut -> Ladda resplan -> Redigera ett steg i en dag -> Lägg till nytt steg.
2. Bygg nästa förbättring runt dagkortens överblick och smarta varningar.
3. Kör alltid `npm run typecheck` och `npx expo export --platform web` innan push.
