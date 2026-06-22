import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schemaSql = readFileSync('supabase/schema.sql', 'utf8');
const shareCodesSql = readFileSync('supabase/share_codes.sql', 'utf8');
const inviteHardeningSql = readFileSync('supabase/migrations/202606170001_harden_trip_invite_rpcs.sql', 'utf8');
const moveNodeSql = readFileSync('supabase/migrations/202606120001_atomic_move_itinerary_node.sql', 'utf8');
const exploreItemsSql = readFileSync('supabase/migrations/202606220001_create_trip_explore_items.sql', 'utf8');

const appTables = [
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
];

test('schema enables RLS for every base Roadtrip app table', () => {
  for (const table of appTables) {
    assert.match(schemaSql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }

  assert.match(shareCodesSql, /alter table public\.trip_invites enable row level security/i);
});

test('trip-scoped policies reference auth identity or trip membership helpers', () => {
  for (const helper of ['is_trip_owner', 'is_trip_member', 'is_trip_editor']) {
    assert.match(schemaSql, new RegExp(`function public\\.${helper}`, 'i'));
  }

  assert.match(schemaSql, /auth\.uid\(\)/i);
  assert.match(schemaSql, /owner_id = auth\.uid\(\)/i);
  assert.match(schemaSql, /public\.is_trip_member\(id\)/i);
  assert.match(schemaSql, /public\.is_trip_editor\(trip_id\)/i);
  assert.doesNotMatch(schemaSql, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(schemaSql, /with check\s*\(\s*true\s*\)/i);
});

test('sensitive invite RPCs require authenticated users and do not execute for anon or public', () => {
  for (const fn of ['create_trip_invite\\(uuid\\)', 'join_trip_by_code\\(text\\)']) {
    assert.match(inviteHardeningSql, new RegExp(`revoke all on function public\\.${fn} from public`, 'i'));
    assert.match(inviteHardeningSql, new RegExp(`revoke all on function public\\.${fn} from anon`, 'i'));
    assert.match(inviteHardeningSql, new RegExp(`grant execute on function public\\.${fn} to authenticated`, 'i'));
  }

  assert.match(inviteHardeningSql, /security definer/i);
  assert.match(inviteHardeningSql, /set search_path = public/i);
  assert.match(inviteHardeningSql, /auth\.uid\(\) is null/i);
  assert.match(inviteHardeningSql, /public\.is_trip_owner\(input_trip_id\)/i);
});

test('move itinerary RPC remains invoker-scoped and authenticated-only', () => {
  assert.match(moveNodeSql, /security invoker/i);
  assert.match(moveNodeSql, /set search_path = public/i);
  assert.match(moveNodeSql, /auth\.uid\(\) is null/i);
  assert.match(moveNodeSql, /public\.is_trip_editor\(moving_node\.trip_id\)/i);
  assert.match(moveNodeSql, /revoke all on function public\.move_itinerary_node\(uuid, integer\) from anon/i);
  assert.match(moveNodeSql, /grant execute on function public\.move_itinerary_node\(uuid, integer\) to authenticated/i);
});

test('explore items migration is trip scoped and authenticated only', () => {
  assert.match(exploreItemsSql, /create table if not exists public\.trip_explore_items/i);
  assert.match(exploreItemsSql, /alter table public\.trip_explore_items enable row level security/i);
  assert.match(exploreItemsSql, /public\.is_trip_member\(trip_id\) or public\.is_trip_owner\(trip_id\)/i);
  assert.match(exploreItemsSql, /public\.is_trip_editor\(trip_id\)/i);
  assert.match(exploreItemsSql, /revoke all on public\.trip_explore_items from public/i);
  assert.match(exploreItemsSql, /revoke all on public\.trip_explore_items from anon/i);
  assert.match(exploreItemsSql, /grant select, insert, update, delete on public\.trip_explore_items to authenticated/i);
  assert.doesNotMatch(exploreItemsSql, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(exploreItemsSql, /with check\s*\(\s*true\s*\)/i);
});

test('PostGIS spatial_ref_sys is not treated as a Roadtrip app table', () => {
  assert.equal(appTables.includes('spatial_ref_sys'), false);
  assert.doesNotMatch(schemaSql, /alter table public\.spatial_ref_sys enable row level security/i);
  assert.doesNotMatch(inviteHardeningSql, /spatial_ref_sys/i);
});
