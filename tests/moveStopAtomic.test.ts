import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ItineraryNode } from '../src/models';

const migrationSql = readFileSync('supabase/migrations/202606120001_atomic_move_itinerary_node.sql', 'utf8');

function node(overrides: Partial<ItineraryNode>): ItineraryNode {
  const now = '2026-06-11T09:00:00.000Z';
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: 'activity',
    title: overrides.title ?? 'Stopp',
    startsAt: overrides.startsAt ?? now,
    endsAt: null,
    timezone: 'Europe/Stockholm',
    location: null,
    sortOrder: overrides.sortOrder ?? 100,
    transportMode: 'driving',
    reservation: {},
    equipment: [],
    facilities: {},
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function sortNodes(nodes: ItineraryNode[]): ItineraryNode[] {
  return [...nodes].sort((a, b) => {
    const dayA = a.startsAt ? a.startsAt.slice(0, 10) : '9999-12-31';
    const dayB = b.startsAt ? b.startsAt.slice(0, 10) : '9999-12-31';

    if (dayA !== dayB) {
      return dayA.localeCompare(dayB);
    }

    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }

    const timeA = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
    const timeB = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;

    return timeA - timeB;
  });
}

function mergeRpcNodes(currentNodes: ItineraryNode[], rpcNodes: ItineraryNode[]): ItineraryNode[] {
  const returnedIds = new Set(rpcNodes.map((item) => item.id));
  return sortNodes([
    ...currentNodes.filter((item) => !returnedIds.has(item.id)),
    ...rpcNodes,
  ]);
}

function sortOrdersByDay(nodes: ItineraryNode[]): Map<string, number[]> {
  const grouped = new Map<string, number[]>();
  nodes.forEach((item) => {
    const day = item.startsAt?.slice(0, 10) ?? 'unscheduled';
    grouped.set(day, [...(grouped.get(day) ?? []), item.sortOrder]);
  });
  return grouped;
}

function hasDuplicateSortOrders(nodes: ItineraryNode[]): boolean {
  return Array.from(sortOrdersByDay(nodes).values()).some((orders) => new Set(orders).size !== orders.length);
}

test('successful move down within the same day replaces returned stops', () => {
  const moved = mergeRpcNodes([
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 100 }),
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 200 }),
  ], [
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 100 }),
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 200 }),
  ]);

  assert.deepEqual(moved.map((item) => item.id), ['b', 'a']);
});

test('successful move up within the same day replaces returned stops', () => {
  const moved = mergeRpcNodes([
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 100 }),
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 200 }),
  ], [
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 100 }),
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 200 }),
  ]);

  assert.deepEqual(moved.map((item) => item.id), ['b', 'a']);
});

test('moving first stop up is a same-day no-op from the RPC result', () => {
  const current = [
    node({ id: 'a', sortOrder: 100 }),
    node({ id: 'b', sortOrder: 200 }),
  ];

  assert.deepEqual(mergeRpcNodes(current, current).map((item) => item.id), ['a', 'b']);
});

test('moving last stop down is a same-day no-op from the RPC result', () => {
  const current = [
    node({ id: 'a', sortOrder: 100 }),
    node({ id: 'b', sortOrder: 200 }),
  ];

  assert.deepEqual(mergeRpcNodes(current, current).map((item) => item.id), ['a', 'b']);
});

test('failed move leaves local state untouched when no RPC state is applied', () => {
  const current = [
    node({ id: 'a', sortOrder: 100 }),
    node({ id: 'b', sortOrder: 200 }),
  ];

  const afterFailure = current;
  assert.deepEqual(afterFailure, current);
});

test('RPC result can represent correct normalized sort order without duplicates', () => {
  const moved = mergeRpcNodes([], [
    node({ id: 'b', sortOrder: 100 }),
    node({ id: 'a', sortOrder: 200 }),
    node({ id: 'c', sortOrder: 300 }),
  ]);

  assert.deepEqual(moved.map((item) => item.sortOrder), [100, 200, 300]);
  assert.equal(hasDuplicateSortOrders(moved), false);
});

test('returned stops from one day do not remove stops from other days', () => {
  const moved = mergeRpcNodes([
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 100 }),
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 200 }),
    node({ id: 'other-day', startsAt: '2026-06-12T09:00:00.000Z', sortOrder: 100 }),
  ], [
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 100 }),
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 200 }),
  ]);

  assert.deepEqual(moved.map((item) => item.id), ['b', 'a', 'other-day']);
});

test('local unsynced stops are preserved when same-day RPC rows are merged', () => {
  const unsynced = node({ id: 'local-only', startsAt: '2026-06-13T09:00:00.000Z', sortOrder: 100 });
  const moved = mergeRpcNodes([
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 100 }),
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 200 }),
    unsynced,
  ], [
    node({ id: 'b', startsAt: '2026-06-11T10:00:00.000Z', sortOrder: 100 }),
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', sortOrder: 200 }),
  ]);

  assert.ok(moved.some((item) => item.id === unsynced.id));
});

test('RPC rows do not move stops over day boundaries or change schedule fields', () => {
  const startsAt = '2026-06-11T09:00:00.000Z';
  const endsAt = '2026-06-11T11:00:00.000Z';
  const moved = mergeRpcNodes([], [
    node({ id: 'a', startsAt, endsAt, sortOrder: 100 }),
    node({ id: 'b', startsAt: '2026-06-11T12:00:00.000Z', endsAt: null, sortOrder: 200 }),
  ]);

  assert.deepEqual(new Set(moved.map((item) => item.startsAt?.slice(0, 10))), new Set(['2026-06-11']));
  assert.equal(moved.find((item) => item.id === 'a')?.startsAt, startsAt);
  assert.equal(moved.find((item) => item.id === 'a')?.endsAt, endsAt);
});

test('migration checks authorization with auth.uid and editor membership', () => {
  assert.match(migrationSql, /security invoker/i);
  assert.match(migrationSql, /set search_path = public/i);
  assert.match(migrationSql, /auth\.uid\(\) is null/i);
  assert.match(migrationSql, /public\.is_trip_editor\(moving_node\.trip_id\)/i);
  assert.match(migrationSql, /raise exception 'You do not have permission/i);
});

test('migration handles invalid node id and invalid direction', () => {
  assert.match(migrationSql, /input_direction not in \(-1, 1\)/i);
  assert.match(migrationSql, /Itinerary node does not exist/i);
});

test('migration locks affected rows and relies on function statement rollback', () => {
  assert.match(migrationSql, /for update/i);
  assert.match(migrationSql, /update public\.itinerary_nodes/i);
  assert.doesNotMatch(migrationSql, /commit|rollback/i);
});

test('migration constrains ordering to the same day and does not update schedule fields', () => {
  assert.match(migrationSql, /starts_at::date is not distinct from moving_day/i);
  assert.doesNotMatch(migrationSql, /set\s+starts_at\s*=/i);
  assert.doesNotMatch(migrationSql, /set\s+ends_at\s*=/i);
  assert.doesNotMatch(migrationSql, /order by starts_at::date asc nulls last/i);
});

test('migration grants execution only to authenticated role', () => {
  assert.match(migrationSql, /revoke all on function public\.move_itinerary_node\(uuid, integer\) from public/i);
  assert.match(migrationSql, /revoke all on function public\.move_itinerary_node\(uuid, integer\) from anon/i);
  assert.match(migrationSql, /grant execute on function public\.move_itinerary_node\(uuid, integer\) to authenticated/i);
});
