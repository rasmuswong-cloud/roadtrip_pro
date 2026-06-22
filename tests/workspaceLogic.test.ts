import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import {
  APP_TABS,
  APP_VIEW_KEYS,
  budgetCostEditorTarget,
  dayShortcutTarget,
  resolveSelectedDayKey,
} from '../src/components/layout/workspaceLogic';
import { TRIP_READINESS_TARGETS } from '../src/services/planning/tripReadiness';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-06-11T10:00:00.000Z';
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: overrides.type ?? 'activity',
    title: overrides.title ?? 'Stop',
    startsAt: overrides.startsAt ?? now,
    endsAt: overrides.endsAt ?? null,
    timezone: 'Europe/Stockholm',
    location: overrides.location ?? { latitude: 59.3, longitude: 18.0 },
    sortOrder: overrides.sortOrder ?? 100,
    transportMode: 'driving',
    reservation: overrides.reservation ?? {},
    equipment: [],
    facilities: {},
    metadata: overrides.metadata ?? {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('workspace navigation keys match supported readiness targets', () => {
  assert.deepEqual(APP_VIEW_KEYS, ['overview', 'explore', 'days', 'route', 'budget', 'tools']);
  assert.deepEqual(APP_TABS.map((tab) => tab.key), ['overview', 'explore', 'days', 'route', 'budget', 'tools']);

  const appViewSet = new Set(APP_VIEW_KEYS);
  TRIP_READINESS_TARGETS.forEach((target) => {
    assert.equal(appViewSet.has(target), true);
  });
});

test('day shortcut always opens Dagar with the requested day selected', () => {
  assert.deepEqual(dayShortcutTarget('2026-06-12'), {
    view: 'days',
    selectedDayKey: '2026-06-12',
  });
});

test('selected day stays stable, falls back to first visible day, or clears safely', () => {
  assert.equal(resolveSelectedDayKey(['2026-06-11', '2026-06-12'], '2026-06-12'), '2026-06-12');
  assert.equal(resolveSelectedDayKey(['2026-06-11', '2026-06-12'], '2026-06-13'), '2026-06-11');
  assert.equal(resolveSelectedDayKey(['2026-06-11'], null), '2026-06-11');
  assert.equal(resolveSelectedDayKey([], '2026-06-11'), null);
});

test('budget cost action targets Dagar and the node day', () => {
  assert.deepEqual(budgetCostEditorTarget([
    node({ id: 'hotel', startsAt: '2026-06-13T15:00:00.000Z' }),
  ], 'hotel'), {
    view: 'days',
    nodeId: 'hotel',
    title: 'Stop',
    selectedDayKey: '2026-06-13',
  });
});

test('budget cost action is safe for missing and unscheduled items', () => {
  assert.equal(budgetCostEditorTarget([node({ id: 'hotel' })], 'missing'), null);
  assert.deepEqual(budgetCostEditorTarget([
    node({ id: 'fuel', startsAt: null }),
  ], 'fuel'), {
    view: 'days',
    nodeId: 'fuel',
    title: 'Stop',
    selectedDayKey: 'unscheduled',
  });
});
