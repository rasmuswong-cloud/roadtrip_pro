-- Emergency RLS hardening for the public app tables.
-- Run this in the Supabase SQL editor for project gfirgrfslgyewzoyflvm.
-- It is safe to re-run.

create or replace function public.is_trip_owner(check_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = check_trip_id
      and t.owner_id = auth.uid()
      and t.deleted_at is null
  );
$$;

create or replace function public.is_trip_member(check_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = check_trip_id
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_editor(check_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_trip_owner(check_trip_id)
    or exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = check_trip_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'editor')
    );
$$;

alter table if exists public.user_profiles enable row level security;
alter table if exists public.trips enable row level security;
alter table if exists public.trip_members enable row level security;
alter table if exists public.pois enable row level security;
alter table if exists public.itinerary_nodes enable row level security;
alter table if exists public.expenses enable row level security;
alter table if exists public.budgets enable row level security;
alter table if exists public.fx_rates enable row level security;
alter table if exists public.route_cache enable row level security;
alter table if exists public.sync_events enable row level security;
alter table if exists public.trip_invites enable row level security;

drop policy if exists "profiles are visible to self" on public.user_profiles;
drop policy if exists "profiles insert self" on public.user_profiles;
drop policy if exists "profiles update self" on public.user_profiles;
drop policy if exists "trip members can read trips" on public.trips;
drop policy if exists "owners can manage trips" on public.trips;
drop policy if exists "members can read membership" on public.trip_members;
drop policy if exists "owners manage membership" on public.trip_members;
drop policy if exists "members read pois" on public.pois;
drop policy if exists "editors manage trip data" on public.pois;
drop policy if exists "members manage itinerary" on public.itinerary_nodes;
drop policy if exists "members manage expenses" on public.expenses;
drop policy if exists "members manage budgets" on public.budgets;
drop policy if exists "authenticated users read fx rates" on public.fx_rates;
drop policy if exists "members manage route cache" on public.route_cache;
drop policy if exists "members read sync events" on public.sync_events;
drop policy if exists "owners manage trip invites" on public.trip_invites;

create policy "profiles are visible to self" on public.user_profiles
for select using (auth.uid() = id);

create policy "profiles insert self" on public.user_profiles
for insert with check (auth.uid() = id);

create policy "profiles update self" on public.user_profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "trip members can read trips" on public.trips
for select using (owner_id = auth.uid() or public.is_trip_member(id));

create policy "owners can manage trips" on public.trips
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "members can read membership" on public.trip_members
for select using (user_id = auth.uid() or public.is_trip_owner(trip_id));

create policy "owners manage membership" on public.trip_members
for all using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

create policy "members read pois" on public.pois
for select using (trip_id is null or public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));

create policy "editors manage trip data" on public.pois
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy "members manage itinerary" on public.itinerary_nodes
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy "members manage expenses" on public.expenses
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy "members manage budgets" on public.budgets
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy "authenticated users read fx rates" on public.fx_rates
for select using (auth.role() = 'authenticated');

create policy "members manage route cache" on public.route_cache
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy "members read sync events" on public.sync_events
for select using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));

create policy "owners manage trip invites" on public.trip_invites
for all using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- Diagnostic: this should return zero rows for app tables after the script runs.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'user_profiles',
    'trips',
    'trip_members',
    'pois',
    'itinerary_nodes',
    'expenses',
    'budgets',
    'fx_rates',
    'route_cache',
    'sync_events',
    'trip_invites'
  )
  and rowsecurity = false
order by tablename;

-- Broader diagnostic for Supabase's "rls_disabled_in_public" warning.
-- Extension-owned reference tables, such as PostGIS spatial_ref_sys, may be intentionally public.
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by tablename;
