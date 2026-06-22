create table if not exists public.trip_explore_items (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id),
  item_type text not null check (item_type in ('note', 'place', 'section')),
  title text not null default '',
  description text,
  category text,
  place_name text,
  formatted_address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  google_place_id text,
  google_maps_url text,
  google_rating numeric(3,2),
  google_primary_type text,
  photo_name text,
  photo_reference text,
  photo_url text,
  photo_attributions jsonb not null default '[]',
  image_source text not null default 'placeholder' check (image_source in ('google_place_photo', 'placeholder', 'manual')),
  sort_order numeric not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists trip_explore_items_trip_order_idx
  on public.trip_explore_items (trip_id, item_type, sort_order, created_at)
  where deleted_at is null;

create unique index if not exists trip_explore_items_one_note_per_trip_idx
  on public.trip_explore_items (trip_id)
  where item_type = 'note' and deleted_at is null;

drop trigger if exists trip_explore_items_touch on public.trip_explore_items;
create trigger trip_explore_items_touch before update on public.trip_explore_items
for each row execute function public.touch_updated_at();

alter table public.trip_explore_items enable row level security;

drop policy if exists "members read explore items" on public.trip_explore_items;
create policy "members read explore items" on public.trip_explore_items
for select using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));

drop policy if exists "editors manage explore items" on public.trip_explore_items;
create policy "editors manage explore items" on public.trip_explore_items
for all using (public.is_trip_editor(trip_id)) with check (public.is_trip_editor(trip_id));

revoke all on public.trip_explore_items from public;
revoke all on public.trip_explore_items from anon;
grant select, insert, update, delete on public.trip_explore_items to authenticated;
