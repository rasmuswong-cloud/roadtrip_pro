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

drop policy if exists "trip members can read trips" on public.trips;
drop policy if exists "members can read membership" on public.trip_members;
drop policy if exists "owners manage membership" on public.trip_members;
drop policy if exists "members read pois" on public.pois;
drop policy if exists "editors manage trip data" on public.pois;
drop policy if exists "members manage itinerary" on public.itinerary_nodes;
drop policy if exists "members manage expenses" on public.expenses;
drop policy if exists "members manage budgets" on public.budgets;
drop policy if exists "members manage route cache" on public.route_cache;
drop policy if exists "members read sync events" on public.sync_events;

create policy "trip members can read trips" on public.trips
for select using (owner_id = auth.uid() or public.is_trip_member(id));

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

create policy "members manage route cache" on public.route_cache
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

create policy "members read sync events" on public.sync_events
for select using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));
