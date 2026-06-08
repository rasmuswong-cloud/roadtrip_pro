# ReseApp

Initial production scaffold for a private travel planning and navigation app.

This first slice includes:

- Supabase PostgreSQL schema for trips, profiles, itinerary nodes, POIs, expenses, budgets, route cache, and sync metadata.
- Core TypeScript domain models.
- Zustand store architecture with optimistic mutations and sync queue support.
- Supabase client helpers and realtime subscription wiring.
- Mapbox navigation component skeleton for React Native.
- AI itinerary mutation parser with JSON-schema validation.
- Expo app entry screen with map, timeline, budget metrics, and AI command surface.
- Offline SQLite mirror schema for cached entities, pending mutations, routes, and FX rates.
- Repository/mapping layer between Supabase rows and TypeScript domain models.
- Client-side waypoint optimization using nearest-neighbor plus 2-opt improvement.

## Structure

```text
supabase/schema.sql          PostgreSQL DDL and RLS policies
src/models                   Shared TypeScript domain models
src/store                    Zustand trip store and optimistic sync queue
src/services                 Supabase, sync, FX, and AI service helpers
src/components/map           Mapbox navigation component
src/services/database        Supabase repositories and row mappers
src/services/offline         SQLite cache schema and helpers
src/services/routing         Waypoint optimization utilities
```

## Run Locally

Install dependencies, then start Expo:

```bash
npm install
npm run start
```

Run type checking:

```bash
npm run typecheck
```

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Run `supabase/rls_fix.sql` if upgrading an existing local database.
4. Run `supabase/share_codes.sql` to enable couple/shared-trip invite codes.
5. Enable Realtime for the collaborative tables: `trips`, `pois`, `itinerary_nodes`, `expenses`, and `budgets`.
6. Add the Expo public Supabase values to your environment.

For hosted web usage, enable Supabase email login and set the production Site URL to your hosted app URL.

## Implementation Notes

- `src/services/sync/syncQueue.ts` implements a Last-Write-Wins compatible queue with version checks for conflict detection.
- `src/services/offline/offlineStore.ts` is the local cache foundation for offline reads and replaying pending mutations.
- `src/services/ai/agent.ts` parses natural language into a Zod-validated mutation plan. In production, call this through a trusted backend or Supabase Edge Function.
- `src/services/routing/waypointOptimizer.ts` provides a local fallback optimizer. Production routing should still hydrate final travel times and geometries from Mapbox Directions or OSRM.

## Environment

Create an Expo app around this scaffold and provide these values:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
```

Set `OPENAI_API_KEY` as a Supabase Edge Function secret for `supabase/functions/parse-itinerary-command`; do not expose it through Expo or Vercel client environment variables.
