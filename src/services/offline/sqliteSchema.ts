export const OFFLINE_SCHEMA_SQL = `
create table if not exists offline_entities (
  table_name text not null,
  row_id text not null,
  trip_id text,
  payload text not null,
  version integer not null default 1,
  sync_status text not null default 'synced',
  updated_at text not null,
  deleted_at text,
  primary key (table_name, row_id)
);

create table if not exists pending_mutations (
  id text primary key,
  trip_id text not null,
  table_name text not null,
  operation text not null,
  row_id text not null,
  payload text not null,
  base_version integer,
  attempts integer not null default 0,
  created_at text not null
);

create table if not exists route_cache (
  id text primary key,
  trip_id text not null,
  profile text not null,
  waypoint_hash text not null,
  payload text not null,
  expires_at text,
  created_at text not null
);

create table if not exists fx_rates (
  base_currency text not null,
  quote_currency text not null,
  rate_date text not null,
  rate real not null,
  source text not null,
  fetched_at text not null,
  primary key (base_currency, quote_currency, rate_date)
);

create index if not exists offline_entities_trip_idx on offline_entities (trip_id, table_name);
create index if not exists pending_mutations_trip_idx on pending_mutations (trip_id, created_at);
create unique index if not exists route_cache_lookup_idx on route_cache (trip_id, profile, waypoint_hash);
`;
