import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFuelEstimate, parseFuelNumber } from '../src/services/routing/fuelEstimate';

test('fuel estimate calculates liters, total cost, and per-person cost', () => {
  const estimate = calculateFuelEstimate({
    distanceMeters: 1_920_000,
    consumptionLitersPer100Km: 6.5,
    fuelPricePerLiter: 20,
    travelerCount: 2,
  });

  assert.equal(estimate.distanceKm, 1920);
  assert.equal(estimate.liters, 124.8);
  assert.equal(estimate.totalCost, 2496);
  assert.equal(estimate.perPersonCost, 1248);
});

test('fuel number parser accepts comma decimals and safe fallbacks', () => {
  assert.equal(parseFuelNumber('6,5', 7), 6.5);
  assert.equal(parseFuelNumber('bad', 7), 7);
  assert.equal(parseFuelNumber('-1', 7), 7);
});
