import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode, RouteSummary } from '../src/models';
import {
  analyzeDayWarnings,
  calculateDayCost,
  moveNodeToDay,
  rollbackItineraryNodes,
  sortItineraryNodes,
  summarizeDay,
  validatePlannerDraft,
} from '../src/services/planning/dayAnalysis';

const route: RouteSummary = {
  distanceMeters: 420_000,
  durationSeconds: 21_000,
  provider: 'offline',
};

function node(overrides: Partial<ItineraryNode>): ItineraryNode {
  const now = '2026-06-11T10:00:00.000Z';
  return {
    id: overrides.id ?? crypto.randomUUID(),
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: overrides.type ?? 'activity',
    title: overrides.title ?? 'Stopp',
    startsAt: overrides.startsAt ?? now,
    endsAt: overrides.endsAt ?? null,
    timezone: 'Europe/Stockholm',
    location: overrides.location ?? { latitude: 59.3, longitude: 18.0 },
    sortOrder: overrides.sortOrder ?? 100,
    transportMode: 'driving',
    reservation: overrides.reservation ?? {},
    equipment: [],
    facilities: {},
    metadata: overrides.metadata ?? { cost: '1200' },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('calculateDayCost sums known node costs', () => {
  const total = calculateDayCost([
    node({ metadata: { cost: '100 SEK' } }),
    node({ metadata: { lodgingCostSek: 1200, activityCostSek: '300', parkingCostSek: '120' } }),
  ]);

  assert.equal(total, 1720);
});

test('validatePlannerDraft rejects impossible calendar dates and invalid coordinates', () => {
  const result = validatePlannerDraft({
    title: 'Bad map stop',
    type: 'activity',
    date: '2026-02-30',
    latitude: '91,5',
    longitude: 'not-a-number',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith('Datum ska anges')));
  assert.ok(result.errors.some((error) => error.startsWith('Longitud')));
});

test('summarizeDay returns day overview fields', () => {
  const summary = summarizeDay([
    node({ id: 'start', title: 'Start', metadata: { place: 'München', cost: 100 } }),
    node({ id: 'hotel', title: 'Hotell', type: 'lodging', metadata: { place: 'Cortina', cost: 1200 } }),
  ], '2026-06-11', 1);

  assert.equal(summary.dayNumber, 1);
  assert.equal(summary.startPlace, 'München');
  assert.equal(summary.endPlace, 'Cortina');
  assert.equal(summary.lodging, 'Hotell');
  assert.equal(summary.costSek, 1300);
});

test('sortItineraryNodes orders by time then sort order', () => {
  const sorted = sortItineraryNodes([
    node({ id: 'late', startsAt: '2026-06-11T18:00:00.000Z', sortOrder: 100 }),
    node({ id: 'early-b', startsAt: '2026-06-11T08:00:00.000Z', sortOrder: 200 }),
    node({ id: 'early-a', startsAt: '2026-06-11T08:00:00.000Z', sortOrder: 100 }),
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['early-a', 'early-b', 'late']);
});

test('analyzeDayWarnings reports missing lodging, long drive, missing cost, overlap and location problems', () => {
  const warnings = analyzeDayWarnings([
    node({
      id: 'activity-1',
      title: 'Vandring',
      startsAt: '2026-06-11T10:00:00.000Z',
      endsAt: '2026-06-11T12:00:00.000Z',
      location: null,
      metadata: {},
    }),
    node({
      id: 'activity-2',
      title: 'Lunch',
      type: 'gastronomy',
      startsAt: '2026-06-11T11:30:00.000Z',
      endsAt: '2026-06-11T12:30:00.000Z',
      metadata: { cost: 5000 },
    }),
  ], route);

  const codes = warnings.map((warning) => warning.code);
  assert.ok(codes.includes('missing_lodging'));
  assert.ok(codes.includes('long_drive'));
  assert.ok(codes.includes('missing_cost'));
  assert.ok(codes.includes('overlapping_times'));
  assert.ok(codes.includes('activity_without_location'));
  assert.ok(codes.includes('daily_budget_exceeded'));
});

test('zero cost validates and is not a missing-cost warning', () => {
  const validation = validatePlannerDraft({
    title: 'Free activity',
    type: 'activity',
    cost: '0',
    parkingCost: '0',
  });
  const warnings = analyzeDayWarnings([
    node({ id: 'free-stop', title: 'Gratis aktivitet', metadata: { cost: '0' } }),
  ], { ...route, durationSeconds: 0 });

  assert.equal(validation.valid, true);
  assert.equal(calculateDayCost([node({ metadata: { cost: '0' } })]), 0);
  assert.equal(warnings.some((warning) => warning.code === 'missing_cost'), false);
});

test('empty parking cost is optional and invalid parking cost is rejected', () => {
  const optional = validatePlannerDraft({
    title: 'Activity',
    type: 'activity',
    parkingCost: '',
  });
  const invalid = validatePlannerDraft({
    title: 'Activity',
    type: 'activity',
    parkingCost: '-1',
  });

  assert.equal(optional.valid, true);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('Parkeringspris behöver vara 0 eller ett positivt tal.'));
});

test('moveNodeToDay changes date and keeps stable ordering', () => {
  const moved = moveNodeToDay([
    node({ id: 'a', startsAt: '2026-06-11T09:00:00.000Z', endsAt: '2026-06-11T11:30:00.000Z', sortOrder: 100 }),
    node({ id: 'b', startsAt: '2026-06-12T10:00:00.000Z', sortOrder: 100 }),
  ], 'a', '2026-06-12');

  const movedNode = moved.find((item) => item.id === 'a');
  assert.equal(movedNode?.startsAt?.slice(0, 10), '2026-06-12');
  assert.equal(movedNode?.endsAt?.slice(0, 10), '2026-06-12');
  assert.equal(movedNode?.sortOrder, 200);
  assert.equal(movedNode?.version, 2);
});

test('moveNodeToDay preserves node details and unrelated stops', () => {
  const original = node({
    id: 'a',
    title: 'Museum',
    startsAt: '2026-06-11T09:00:00.000Z',
    sortOrder: 100,
    reservation: { status: 'confirmed', reference: 'ABC123' },
    location: { latitude: 46.5, longitude: 11.7 },
    metadata: { place: 'Bolzano', cost: '450', currency: 'EUR', custom: { source: 'manual' } },
    notes: 'Keep this note',
  });
  const untouched = node({ id: 'c', startsAt: '2026-06-13T10:00:00.000Z', sortOrder: 100 });

  const moved = moveNodeToDay([
    original,
    node({ id: 'b', startsAt: '2026-06-12T10:00:00.000Z', sortOrder: 100 }),
    untouched,
  ], 'a', '2026-06-12');

  const movedNode = moved.find((item) => item.id === 'a');
  assert.equal(moved.length, 3);
  assert.equal(movedNode?.title, original.title);
  assert.equal(movedNode?.endsAt, null);
  assert.deepEqual(movedNode?.reservation, original.reservation);
  assert.deepEqual(movedNode?.location, original.location);
  assert.deepEqual(movedNode?.metadata, original.metadata);
  assert.equal(movedNode?.notes, original.notes);
  assert.deepEqual(moved.find((item) => item.id === 'c'), untouched);
});

test('rollbackItineraryNodes restores the previous sorted snapshot', () => {
  const previous = [
    node({ id: 'previous-b', startsAt: '2026-06-11T12:00:00.000Z' }),
    node({ id: 'previous-a', startsAt: '2026-06-11T08:00:00.000Z' }),
  ];
  const current = [node({ id: 'broken-save' })];

  const rolledBack = rollbackItineraryNodes(current, previous);
  assert.deepEqual(rolledBack.map((item) => item.id), ['previous-a', 'previous-b']);
});

test('validatePlannerDraft returns Swedish validation errors', () => {
  const result = validatePlannerDraft({
    title: '',
    type: 'activity',
    date: '2026/06/11',
    startTime: '9',
    cost: '-',
    latitude: '59.3',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('Titel måste fyllas i.'));
  assert.ok(result.errors.includes('Datum ska anges som ÅÅÅÅ-MM-DD.'));
  assert.ok(result.errors.includes('Starttid ska anges som TT:MM.'));
  assert.ok(result.errors.includes('Kostnad behöver vara 0 eller ett positivt tal.'));
  assert.ok(result.errors.includes('Ange både latitud och longitud, eller lämna båda tomma.'));
});
