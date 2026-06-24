-- ReseApp initial Supabase schema.
-- Enable in Supabase SQL editor before running app clients.

create extension if not exists "uuid-ossp";
create extension if not exists postgis;

create type trip_role as enum ('owner', 'editor', 'viewer');
create type itinerary_node_type as enum ('lodging', 'camping', 'activity', 'gastronomy', 'fuel', 'transport', 'note', 'custom');
create type transport_mode as enum ('driving', 'walking', 'hiking', 'cycling', 'mtb', 'transit');
create type sync_origin as enum ('client', 'realtime', 'ai_agent', 'system');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  home_currency char(3) not null default 'SEK',
  preferred_units jsonb not null default '{"distance":"km","temperature":"celsius"}',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  description text,
  base_currency char(3) not null default 'SEK',
  starts_at timestamptz,
  ends_at timestamptz,
  home_location geography(point, 4326),
  settings jsonb not null default '{}',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role trip_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.pois (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id),
  name text not null,
  category text not null,
  location geography(point, 4326) not null,
  address text,
  source text not null default 'custom',
  external_ref text,
  rating numeric(3,2),
  opening_hours jsonb not null default '{}',
  contact jsonb not null default '{}',
  imagery jsonb not null default '[]',
  metadata jsonb not null default '{}',
  is_private boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (source, external_ref)
);

create table public.itinerary_nodes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  poi_id uuid references public.pois(id) on delete set null,
  created_by uuid not null references public.user_profiles(id),
  type itinerary_node_type not null,
  title text not null,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  location geography(point, 4326),
  sort_order numeric not null default 0,
  transport_mode transport_mode,
  route_to_next jsonb,
  reservation jsonb not null default '{}',
  equipment jsonb not null default '[]',
  facilities jsonb not null default '{}',
  metadata jsonb not null default '{}',
  version bigint not null default 1,
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  itinerary_node_id uuid references public.itinerary_nodes(id) on delete set null,
  paid_by uuid not null references public.user_profiles(id),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null,
  fx_rate_to_base numeric(18,8),
  base_amount numeric(12,2),
  occurred_at timestamptz not null default now(),
  split jsonb not null default '{}',
  receipt_url text,
  metadata jsonb not null default '{}',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null,
  warning_threshold numeric(4,3) not null default 0.8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, category)
);

create table public.fx_rates (
  base_currency char(3) not null,
  quote_currency char(3) not null,
  rate_date date not null,
  rate numeric(18,8) not null check (rate > 0),
  source text not null,
  fetched_at timestamptz not null default now(),
  primary key (base_currency, quote_currency, rate_date)
);

create table public.route_cache (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  profile transport_mode not null,
  waypoint_hash text not null,
  geometry jsonb not null,
  distance_meters numeric not null,
  duration_seconds numeric not null,
  elevation jsonb not null default '{}',
  instructions jsonb not null default '[]',
  provider text not null default 'mapbox',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, profile, waypoint_hash)
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  table_name text not null,
  row_id uuid not null,
  origin sync_origin not null default 'client',
  actor_id uuid references public.user_profiles(id),
  client_mutation_id uuid,
  row_version bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index pois_trip_location_idx on public.pois using gist (location);
create index itinerary_trip_time_idx on public.itinerary_nodes (trip_id, starts_at, sort_order) where deleted_at is null;
create index expenses_trip_time_idx on public.expenses (trip_id, occurred_at) where deleted_at is null;
create index sync_events_trip_created_idx on public.sync_events (trip_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.version = coalesce(old.version, 0) + 1;
  return new;
end;
$$;

create trigger trips_touch before update on public.trips
for each row execute function public.touch_updated_at();

create trigger pois_touch before update on public.pois
for each row execute function public.touch_updated_at();

create trigger itinerary_nodes_touch before update on public.itinerary_nodes
for each row execute function public.touch_updated_at();

create trigger expenses_touch before update on public.expenses
for each row execute function public.touch_updated_at();

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

alter table public.user_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.pois enable row level security;
alter table public.itinerary_nodes enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.fx_rates enable row level security;
alter table public.route_cache enable row level security;
alter table public.sync_events enable row level security;

create policy "profiles are visible to self" on public.user_profiles
for select using (auth.uid() = id);

create policy "profiles insert self" on public.user_profiles
for insert with check (auth.uid() = id);

create policy "profiles update self" on public.user_profiles
for update using (auth.uid() = id);

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
