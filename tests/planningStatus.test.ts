import assert from 'node:assert/strict';
import test from 'node:test';

import type { DayPlan, ItineraryNode, RouteSummary } from '@/models';
import { buildPlanningStatus } from '@/services/planning/planningStatus';

const route: RouteSummary = {
  distanceMeters: 0,
  durationSeconds: 0,
  provider: 'offline',
};

test('planning status prioritizes placeholders before other gaps', () => {
  const plans = [
    buildDayPlan('2026-07-12', 'Dag 1', [
      buildNode('placeholder-1', 'Övernattning mellan Malmö och München', 'lodging', {
        metadata: { isPlaceholder: true, placeholderType: 'overnight', placeholderIntent: 'Övernattning' },
        location: null,
      }),
      buildNode('missing-place', 'Malmö', 'custom', { location: null }),
      buildNode('missing-cost', 'Hotell', 'lodging', { metadata: { place: 'München' } }),
    ]),
  ];

  const status = buildPlanningStatus({
    dayPlans: plans,
    routeIsCalculated: false,
    routeSkippedStopCount: 1,
  });

  assert.equal(status.title, 'Planeringsstatus');
  assert.equal(status.items[0]?.id, 'placeholder:placeholder-1');
  assert.equal(status.items[0]?.action, 'smart_stop');
  assert.equal(status.items[1]?.id, 'location:missing-place');
  assert.equal(status.items[2]?.id, 'route:skipped-stops');
});

test('planning status stays calm when no important gaps remain', () => {
  const plans = [
    buildDayPlan('2026-07-12', 'Dag 1', [
      buildNode('ready-1', 'Camping', 'camping', {
        startsAt: '2026-07-12T18:00:00.000+02:00',
        metadata: { place: 'Camping', costSek: 500 },
      }),
      buildNode('ready-2', 'Lunch', 'gastronomy', {
        startsAt: '2026-07-12T12:00:00.000+02:00',
        metadata: { place: 'Lunch', costSek: 250 },
      }),
    ]),
  ];

  const status = buildPlanningStatus({
    dayPlans: plans,
    routeIsCalculated: true,
    routeSkippedStopCount: 0,
  });

  assert.deepEqual(status.items, []);
  assert.equal(status.subtitle, 'Resan ser redo ut för nästa genomgång.');
});

test('planning status treats zero cost as filled in', () => {
  const plans = [
    buildDayPlan('2026-07-12', 'Dag 1', [
      buildNode('free-activity', 'Gratis badplats', 'activity', {
        startsAt: '2026-07-12T14:00:00.000+02:00',
        metadata: { place: 'Badplats', costSek: 0 },
      }),
    ]),
  ];

  const status = buildPlanningStatus({
    dayPlans: plans,
    routeIsCalculated: true,
    routeSkippedStopCount: 0,
    maxItems: 10,
  });

  assert.equal(status.items.some((item) => item.id === 'cost:free-activity'), false);
});

function buildDayPlan(key: string, shortTitle: string, nodes: ItineraryNode[]): DayPlan {
  return {
    key,
    title: shortTitle,
    shortTitle,
    nodes,
    route,
    budget: { total: 0, categories: { lodging: 0, activity: 0, transport: 0, food: 0, other: 0 }, missingCostCount: 0, warnings: [] },
    summary: { dayKey: key, dayNumber: 1, startPlace: 'Start', endPlace: 'Mål', stopCount: nodes.length, lodging: 'Saknas', activityCount: 0, costSek: 0 },
    smartFlags: [],
    insight: {
      lodgingLabel: '',
      activitiesLabel: '',
      driveLabel: '',
      costLabel: '',
      nextAction: '',
      hasLodging: nodes.some((node) => node.type === 'lodging' || node.type === 'camping'),
      activityCount: 0,
      isLongDrive: false,
      checklist: [],
      packingItems: [],
      packedItems: [],
    },
  };
}

function buildNode(
  id: string,
  title: string,
  type: ItineraryNode['type'],
  overrides: Partial<ItineraryNode> = {},
): ItineraryNode {
  return {
    id,
    tripId: 'trip-1',
    createdBy: 'user-1',
    type,
    title,
    startsAt: null,
    endsAt: null,
    timezone: null,
    location: { latitude: 55, longitude: 13 },
    sortOrder: 1,
    transportMode: 'driving',
    reservation: {},
    equipment: [],
    facilities: {},
    metadata: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    ...overrides,
    metadata: { ...overrides.metadata },
  };
}
