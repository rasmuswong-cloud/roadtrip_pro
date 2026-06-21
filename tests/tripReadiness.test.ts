import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripReadiness } from '../src/services/planning/tripReadiness';

test('trip readiness sends incomplete routes to day planning first', () => {
  const readiness = buildTripReadiness({
    stopCount: 1,
    missingCoordinateCount: 0,
    missingCostCount: 0,
    missingBookingCount: 0,
  });

  assert.equal(readiness.nextStep.target, 'days');
  assert.equal(readiness.nextStep.label, 'Granska dagarna');
  assert.equal(readiness.items.find((item) => item.label === 'Rutt')?.status, 'warning');
});

test('trip readiness prioritizes missing coordinates before budget cleanup', () => {
  const readiness = buildTripReadiness({
    stopCount: 9,
    missingCoordinateCount: 2,
    missingCostCount: 4,
    missingBookingCount: 1,
  });

  assert.equal(readiness.nextStep.target, 'route');
  assert.equal(readiness.nextStep.label, 'Granska rutten');
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
  assert.ok(readiness.items.every((item) => item.status === 'ready'));
});
