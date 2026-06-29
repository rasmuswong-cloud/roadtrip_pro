import test from 'node:test';
import assert from 'node:assert/strict';
import { reseplanrareSeedRows } from '../src/data/reseplanrareSeed';
import { extractValidMapMarkers } from '../src/components/map/mapData';
import { buildTravelBudgetCenter } from '../src/services/planning/budgetAnalysis';
import type { ItineraryNode } from '../src/models';

function nodeFromRow(row: (typeof reseplanrareSeedRows)[number]): ItineraryNode {
  const now = '2026-06-11T09:00:00.000Z';
  const cost = row.cost ?? [row.lodgingCost, row.activityCost].filter(Boolean).join(' + ');
  return {
    id: `node-${row.sourceRow}`,
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: row.type,
    title: row.title ?? row.activity ?? row.hotel ?? row.place,
    startsAt: row.date ? `${row.date}T09:00:00.000Z` : null,
    endsAt: null,
    timezone: row.date ? 'Europe/Rome' : null,
    location: row.location ?? null,
    sortOrder: row.sourceRow * 100,
    transportMode: 'driving',
    reservation: row.hotel ? { provider: row.hotel } : {},
    equipment: [],
    facilities: {},
    metadata: {
      source: 'current-roadtrip-plan',
      sourceRow: row.sourceRow,
      place: row.place,
      hotel: row.hotel ?? null,
      activityName: row.activity ?? null,
      lodgingCostSek: row.lodgingCost ?? null,
      activityCostSek: row.activityCost ?? null,
      costSek: row.cost ?? null,
      cost,
      ...(row.placeholderType ? {
        isPlaceholder: true,
        placeholderType: row.placeholderType,
        placeholderIntent: row.placeholderIntent,
        preferredDriveTimeRange: row.preferredDriveTimeRange,
      } : {}),
    },
    notes: row.notes ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  };
}

test('current roadtrip import covers 12-25 July and preserves known spreadsheet rows', () => {
  const dates = new Set(reseplanrareSeedRows.filter((row) => row.date).map((row) => row.date));

  assert.equal(reseplanrareSeedRows.length, 45);
  assert.equal(new Set(reseplanrareSeedRows.map((row) => row.sourceRow)).size, 45);
  assert.deepEqual([...dates].sort(), [
    '2026-07-12',
    '2026-07-13',
    '2026-07-14',
    '2026-07-15',
    '2026-07-16',
    '2026-07-17',
    '2026-07-18',
    '2026-07-19',
    '2026-07-20',
    '2026-07-21',
    '2026-07-22',
    '2026-07-23',
    '2026-07-24',
    '2026-07-25',
  ]);
});

test('hotel rows preserve hotel names and accommodation costs', () => {
  const hotels = reseplanrareSeedRows.filter((row) => row.hotel);

  assert.deepEqual(hotels.map((row) => row.hotel), [
    'Hotel Restaurant Elbebrücke',
    'Ramada Encore by Wyndham Munich Messe',
    'Hotel alla Posta',
    'Hotel Doré',
    'Hotel Conteverde',
    'Hotel Villa Argentina',
  ]);
  assert.deepEqual(hotels.map((row) => row.lodgingCost), ['806', '805', '4625', '1300', '874', '1804']);
});

test('uncertain home-route items are explicit placeholders without coordinates', () => {
  const placeholders = reseplanrareSeedRows.filter((row) => row.placeholderType);

  assert.deepEqual(placeholders.map((row) => row.title), [
    'Como/Lugano/Maggiore',
    'Como/Lugano/Maggiore',
    'Lindau',
    'Schwarzwald',
  ]);
  assert.ok(placeholders.every((row) => !row.location));
  assert.ok(placeholders.every((row) => row.placeholderIntent?.length));
});

test('current roadtrip budget rows produce the spreadsheet total', () => {
  const nodes = reseplanrareSeedRows.map(nodeFromRow);
  const budget = buildTravelBudgetCenter(nodes, 2);

  assert.equal(budget.total, 35074);
  assert.equal(budget.categories.find((category) => category.key === 'lodging')?.total, 10214);
  assert.equal(budget.categories.find((category) => category.key === 'activity')?.total, 2814);
  assert.equal(budget.categories.find((category) => category.key === 'fuel')?.total, 6000);
  assert.equal(budget.categories.find((category) => category.key === 'transport')?.total, 4046);
  assert.equal(budget.categories.find((category) => category.key === 'food')?.total, 10000);
  assert.equal(budget.categories.find((category) => category.key === 'other')?.total, 2000);
});

test('known spreadsheet subtotals are preserved as a review note', () => {
  const totals = reseplanrareSeedRows.find((row) => row.title === 'Kalkylbladets totalsummor');

  assert.match(totals?.notes ?? '', /Boende cirka 14 440 SEK/);
  assert.match(totals?.notes ?? '', /Aktiviteter\/övrigt cirka 20 634 SEK/);
  assert.match(totals?.notes ?? '', /Totalt cirka 35 074 SEK/);
});

test('current roadtrip seed allows partial map markers without requiring all coordinates', () => {
  const nodes = reseplanrareSeedRows.map(nodeFromRow);
  const markers = extractValidMapMarkers(nodes);

  assert.equal(markers.length, 0);
});
