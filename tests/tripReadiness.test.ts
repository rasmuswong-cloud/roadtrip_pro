import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIP_READINESS_TARGETS, buildTripReadiness } from '../src/services/planning/tripReadiness';

const validTargets = new Set<string>(TRIP_READINESS_TARGETS);

test('complete trip returns ready state', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    dayCount: 7,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
    missingTimeCount: 0,
    planningGapCount: 0,
  });

  assert.equal(readiness.isReady, true);
  assert.equal(readiness.title, 'Resan är redo');
  assert.equal(readiness.nextStep.label, 'Klar för avresa');
  assert.equal(readiness.groups.length, 0);
  assert.ok(readiness.items.every((item) => item.status === 'ready'));
});

test('empty trip is not ready and points to route review', () => {
  const readiness = buildTripReadiness({
    stopCount: 0,
    dayCount: 0,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
    missingTimeCount: 0,
  });

  assert.equal(readiness.isReady, false);
  assert.equal(readiness.nextStep.target, 'route');
  assert.equal(readiness.issues.some((issue) => issue.id === 'route_missing'), true);
  assert.equal(readiness.issues.some((issue) => issue.id === 'days_missing'), true);
});

test('missing coordinates are detected and days is the next workspace', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    dayCount: 7,
    missingCoordinateCount: 4,
    missingCostCount: 2,
    missingBookingCount: 1,
    missingTimeCount: 0,
  });

  const issue = readiness.issues.find((candidate) => candidate.id === 'coordinates_missing');
  assert.equal(readiness.nextStep.target, 'days');
  assert.equal(readiness.nextStep.label, 'Fixa position i Dagar');
  assert.equal(issue?.label, '4 positioner att fixa');
  assert.equal(readiness.groups.find((group) => group.key === 'route_map')?.label, 'Rutt & karta');
});

test('missing costs are detected and budget is the next workspace', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    dayCount: 7,
    missingCoordinateCount: 0,
    missingCostCount: 6,
    missingBookingCount: 1,
    missingTimeCount: 0,
  });

  assert.equal(readiness.nextStep.target, 'budget');
  assert.equal(readiness.nextStep.label, 'Fyll i budget');
  assert.equal(readiness.issues.find((issue) => issue.id === 'costs_missing')?.count, 6);
});

test('missing booking references are detected and days is the next workspace', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    dayCount: 7,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 2,
    missingTimeCount: 0,
  });

  assert.equal(readiness.nextStep.target, 'days');
  assert.equal(readiness.nextStep.label, 'Fyll i bokningsreferenser');
  assert.equal(readiness.groups.find((group) => group.key === 'bookings')?.issues[0]?.label, '2 bokningar saknar referens');
});

test('missing times are detected and days is the next workspace', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    dayCount: 7,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
    missingTimeCount: 3,
  });

  assert.equal(readiness.nextStep.target, 'days');
  assert.equal(readiness.nextStep.label, 'Planera dagar');
  assert.equal(readiness.issues.find((issue) => issue.id === 'times_missing')?.label, '3 steg saknar tid');
});

test('planning gaps are grouped as other issues without crashing', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    dayCount: 7,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
    missingTimeCount: 0,
    planningGapCount: 1,
  });

  assert.equal(readiness.nextStep.target, 'days');
  assert.equal(readiness.groups.find((group) => group.key === 'other')?.issues[0]?.id, 'planning_gaps');
});

test('trip readiness next step targets are always internal app view keys', () => {
  const scenarios = [
    { stopCount: 0, dayCount: 0, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 0, missingTimeCount: 0 },
    { stopCount: 9, dayCount: 7, missingCoordinateCount: 1, missingCostCount: 0, missingBookingCount: 0, missingTimeCount: 0 },
    { stopCount: 9, dayCount: 7, missingCoordinateCount: 0, missingCostCount: 1, missingBookingCount: 0, missingTimeCount: 0 },
    { stopCount: 9, dayCount: 7, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 1, missingTimeCount: 0 },
    { stopCount: 9, dayCount: 7, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 0, missingTimeCount: 1 },
    { stopCount: 9, dayCount: 7, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 0, missingTimeCount: 0 },
  ];

  scenarios.forEach((scenario) => {
    const readiness = buildTripReadiness(scenario);
    const target = readiness.nextStep.target;
    assert.equal(validTargets.has(target), true);
    assert.doesNotMatch(target, /\s/);
    assert.notEqual(target, readiness.nextStep.label);
  });
});
