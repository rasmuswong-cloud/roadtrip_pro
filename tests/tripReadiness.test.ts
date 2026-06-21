import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIP_READINESS_TARGETS, buildTripReadiness } from '../src/services/planning/tripReadiness';

const validTargets = new Set<string>(TRIP_READINESS_TARGETS);

test('trip readiness sends incomplete routes to day planning first', () => {
  const readiness = buildTripReadiness({
    stopCount: 1,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
  });

  assert.equal(readiness.nextStep.target, 'days');
  assert.equal(validTargets.has(readiness.nextStep.target), true);
  assert.equal(readiness.nextStep.label, 'Granska dagarna');
  assert.equal(readiness.items.find((item) => item.label === 'Rutt')?.status, 'warning');
});

test('trip readiness prioritizes missing coordinates before budget cleanup and opens route tab', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    missingCoordinateCount: 2,
    missingCostCount: 4,
    missingBookingCount: 1,
  });

  assert.equal(readiness.nextStep.target, 'route');
  assert.match(readiness.nextStep.label, /^Granska rutt(en)?$/);
  assert.equal(validTargets.has(readiness.nextStep.target), true);
  assert.equal(readiness.items.find((item) => item.label === 'Karta')?.detail, '2 saknar kartposition');
});

test('trip readiness sends complete map with missing costs to budget', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    missingCoordinateCount: 0,
    missingCostCount: 3,
    missingBookingCount: 0,
  });

  assert.equal(readiness.nextStep.target, 'budget');
  assert.equal(validTargets.has(readiness.nextStep.target), true);
  assert.equal(readiness.nextStep.label, 'Komplettera budget');
});

test('trip readiness marks complete trips ready to travel', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
  });

  assert.equal(readiness.nextStep.label, 'Res');
  assert.equal(validTargets.has(readiness.nextStep.target), true);
  assert.ok(readiness.items.every((item) => item.status === 'ready'));
});

test('trip readiness next step targets are always internal app view keys', () => {
  const scenarios = [
    { stopCount: 0, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 0 },
    { stopCount: 9, missingCoordinateCount: 1, missingCostCount: 0, missingBookingCount: 0 },
    { stopCount: 9, missingCoordinateCount: 0, missingCostCount: 1, missingBookingCount: 0 },
    { stopCount: 9, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 1 },
    { stopCount: 9, missingCoordinateCount: 0, missingCostCount: 0, missingBookingCount: 0 },
  ];

  scenarios.forEach((scenario) => {
    const readiness = buildTripReadiness(scenario);
    const target = readiness.nextStep.target;
    assert.equal(validTargets.has(target), true);
    assert.doesNotMatch(target, /\s/);
    assert.notEqual(target, readiness.nextStep.label);
  });
});
