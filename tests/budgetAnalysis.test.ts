import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import {
  buildTravelBudgetCenter,
  nodeCostTotal,
  parseCostValue,
  shouldTrackMissingCost,
} from '../src/services/planning/budgetAnalysis';

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

test('buildTravelBudgetCenter calculates total and per-person cost', () => {
  const budget = buildTravelBudgetCenter([
    node({ type: 'lodging', metadata: { lodgingCostSek: 2000 } }),
    node({ type: 'activity', metadata: { cost: '500' } }),
  ], 2);

  assert.equal(budget.total, 2500);
  assert.equal(budget.perPerson, 1250);
  assert.equal(budget.costItemCount, 2);
});

test('buildTravelBudgetCenter groups category totals and percentages', () => {
  const budget = buildTravelBudgetCenter([
    node({ type: 'lodging', metadata: { lodgingCostSek: 1200 } }),
    node({ type: 'activity', metadata: { activityCostSek: '300' } }),
    node({ type: 'gastronomy', metadata: { costSek: '500' } }),
    node({ type: 'fuel', metadata: { price: '250 SEK' } }),
    node({ type: 'transport', metadata: { cost: '750' } }),
    node({ type: 'custom', metadata: { cost: '100' } }),
  ], 2);

  const categories = Object.fromEntries(budget.categories.map((category) => [category.key, category]));
  assert.equal(categories.lodging?.total, 1200);
  assert.equal(categories.activity?.total, 300);
  assert.equal(categories.food?.total, 500);
  assert.equal(categories.fuel?.total, 250);
  assert.equal(categories.transport?.total, 750);
  assert.equal(categories.other?.total, 100);
  assert.equal(categories.lodging?.percentage, 1200 / 3100);
});

test('buildTravelBudgetCenter groups per-day totals and missing counts', () => {
  const budget = buildTravelBudgetCenter([
    node({ id: 'hotel', type: 'lodging', startsAt: '2026-06-11T12:00:00.000Z', metadata: { lodgingCostSek: 1000 } }),
    node({ id: 'dinner', type: 'gastronomy', startsAt: '2026-06-11T18:00:00.000Z', metadata: {} }),
    node({ id: 'fuel', type: 'fuel', startsAt: '2026-06-12T10:00:00.000Z', metadata: { cost: 400 } }),
  ], 2);

  assert.equal(budget.days.length, 2);
  assert.equal(budget.days[0]?.total, 1000);
  assert.equal(budget.days[0]?.missingCostCount, 1);
  assert.equal(budget.days[1]?.total, 400);
  assert.equal(budget.mostExpensiveDay?.key, '2026-06-11');
});

test('buildTravelBudgetCenter labels unscheduled costs as general budget items', () => {
  const budget = buildTravelBudgetCenter([
    node({ id: 'general', startsAt: null, metadata: { cost: 1200 } }),
  ], 2);

  assert.equal(budget.days[0]?.key, 'unscheduled');
  assert.equal(budget.days[0]?.label, 'Generella budgetposter');
});

test('missing cost detection focuses on cost-bearing itinerary types', () => {
  const missingHotel = node({ type: 'lodging', metadata: {} });
  const note = node({ type: 'note', metadata: {} });
  const budget = buildTravelBudgetCenter([missingHotel, note], 2);

  assert.equal(shouldTrackMissingCost(missingHotel), true);
  assert.equal(shouldTrackMissingCost(note), false);
  assert.equal(budget.missingCostCount, 1);
  assert.equal(budget.missingItems[0]?.title, missingHotel.title);
});

test('zero cost is known, counted, and not treated as missing', () => {
  const freeActivity = node({ type: 'activity', metadata: { cost: '0' } });
  const includedHotel = node({ type: 'lodging', metadata: { lodgingCostSek: 0 } });
  const missingFuel = node({ type: 'fuel', metadata: {} });
  const budget = buildTravelBudgetCenter([freeActivity, includedHotel, missingFuel], 2);

  assert.equal(parseCostValue('0'), 0);
  assert.equal(nodeCostTotal(freeActivity), 0);
  assert.equal(shouldTrackMissingCost(freeActivity), false);
  assert.equal(shouldTrackMissingCost(includedHotel), false);
  assert.equal(shouldTrackMissingCost(missingFuel), true);
  assert.equal(budget.total, 0);
  assert.equal(budget.costItemCount, 2);
  assert.equal(budget.missingCostCount, 1);
  assert.equal(budget.hasRegisteredCosts, true);
});

test('invalid and missing cost values are treated as zero', () => {
  const budget = buildTravelBudgetCenter([
    node({ type: 'transport', metadata: { cost: 'gratis' } }),
    node({ type: 'activity', metadata: { costSek: Number.NaN } }),
    node({ type: 'fuel', metadata: { cost: '-100' } }),
  ], 2);

  assert.equal(parseCostValue('gratis'), 0);
  assert.equal(nodeCostTotal(node({ metadata: { costSek: Number.NaN } })), 0);
  assert.equal(parseCostValue('-100'), 0);
  assert.equal(budget.total, 0);
  assert.equal(budget.missingCostCount, 3);
});

test('empty budget state is explicit', () => {
  const budget = buildTravelBudgetCenter([], 2);

  assert.equal(budget.hasItineraryItems, false);
  assert.equal(budget.hasRegisteredCosts, false);
  assert.equal(budget.total, 0);
  assert.equal(budget.perPerson, 0);
  assert.equal(budget.days.length, 0);
  assert.equal(budget.missingItems.length, 0);
});
