# Roadtrip Pro RLS Security Audit

Audit date: 2026-06-17

## Scope

Reviewed Supabase schema and SQL under `supabase/`, database repositories under `src/services/database/`, sync/offline code, and the `parse-itinerary-command` Edge Function.

Public app tables identified:

| Table | RLS | Select | Insert/update/delete | Scope |
| --- | --- | --- | --- | --- |
| `user_profiles` | Enabled in `schema.sql` | Own profile only via `auth.uid() = id` | Insert/update own profile only | User-owned |
| `trips` | Enabled in `schema.sql` | Owner or trip member | Owner only | Trip owner/member |
| `trip_members` | Enabled in `schema.sql` | Own membership rows or trip owner | Trip owner only | Trip owner/member |
| `pois` | Enabled in `schema.sql` | Trip owner/member; `trip_id is null` global POIs are readable | Trip editor only | Trip editor/member, with intentional global POI read |
| `itinerary_nodes` | Enabled in `schema.sql` | Trip editor through `for all` policy | Trip editor only | Trip editor |
| `expenses` | Enabled in `schema.sql` | Trip editor through `for all` policy | Trip editor only | Trip editor |
| `budgets` | Enabled in `schema.sql` | Trip editor through `for all` policy | Trip editor only | Trip editor |
| `fx_rates` | Enabled in `schema.sql` | Authenticated users | No client write policy | Shared reference data |
| `route_cache` | Enabled in `schema.sql` | Trip editor through `for all` policy | Trip editor only | Trip editor |
| `sync_events` | Enabled in `schema.sql` | Trip owner/member | No client write policy | Trip owner/member |
| `trip_invites` | Enabled in `share_codes.sql` and emergency fix | Trip owner through `for all` policy | Trip owner only, plus controlled RPCs | Trip owner/RPC-mediated join |

## Findings

No Roadtrip user-data table was found without RLS in the project SQL. The app repositories access `user_profiles`, `trips`, `trip_members`, `pois`, `itinerary_nodes`, and `expenses` directly, and sync code can target the same trip-scoped tables. RLS policies scope user data through `auth.uid()`, `is_trip_owner`, `is_trip_member`, or `is_trip_editor`.

The invite RPCs in `share_codes.sql` use `SECURITY DEFINER` with an explicit `search_path`, but did not explicitly revoke default function execute privileges. A hardening migration now recreates those functions with authenticated-user checks and grants execute only to `authenticated`.

The `move_itinerary_node` RPC already uses `SECURITY INVOKER`, an explicit `search_path`, `auth.uid()` checks, trip editor authorization, and authenticated-only execute grants.

The `parse-itinerary-command` Edge Function requires an `Authorization` header and validates it against Supabase Auth before calling Gemini. It returns normalized mutation plans rather than writing app tables directly.

## `public.spatial_ref_sys`

`public.spatial_ref_sys` is a PostGIS spatial reference table created by the PostGIS extension. It is not a Roadtrip app table, is not referenced by the app repositories, and may be owned/managed by Supabase/PostGIS such as `supabase_admin`. The Supabase Advisor `rls_disabled_in_public` warning for this table is documented as an extension-owned reference table exception. Do not alter it unless Supabase/PostGIS documentation or a project-specific requirement proves a safe need.

## Intentional Non-Changes

No UI behavior was changed.

No broad `using (true)` policies were added.

No changes were made to `public.spatial_ref_sys`.

No table-level RLS migration was added because every identified Roadtrip app table already has RLS enabled in project SQL.
