import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  mergeManualDayKeys,
  normalizeDayKey,
  suggestNewDayKey,
} from '../src/services/planning/dayManagement';

test('manual day input accepts valid dates and rejects invalid dates', () => {
  assert.equal(normalizeDayKey('2026-07-16'), '2026-07-16');
  assert.equal(normalizeDayKey(' 2026-07-16 '), '2026-07-16');
  assert.equal(normalizeDayKey('2026-02-30'), null);
  assert.equal(normalizeDayKey('16 July 2026'), null);
});

test('missing-day suggestion fills the first gap before extending the trip', () => {
  assert.equal(suggestNewDayKey(['2026-07-15', '2026-07-17']), '2026-07-16');
  assert.equal(suggestNewDayKey(['2026-07-15', '2026-07-16']), '2026-07-17');
});

test('manual day keys are deduped, ordered, and keep unscheduled last', () => {
  assert.deepEqual(
    mergeManualDayKeys(['2026-07-15', 'unscheduled'], ['2026-07-17', '2026-07-16', '2026-07-15']),
    ['2026-07-15', '2026-07-16', '2026-07-17', 'unscheduled'],
  );
});

test('Dagar exposes the missing-day action with stable test ids', () => {
  const source = readFileSync('src/components/workspaces/DaysWorkspace.tsx', 'utf8');

  assert.match(source, /Lägg till dag/);
  assert.match(source, /testID="add-day-date-input"/);
  assert.match(source, /testID="add-day-button"/);
});

test('stop movement controls are visible directly on stop cards', () => {
  const source = readFileSync('src/components/planning/DayCard.tsx', 'utf8');

  assert.match(source, /testID="stop-move-up"/);
  assert.match(source, /testID="stop-move-down"/);
  assert.match(source, /onMoveStop\(node\.id, -1\)/);
  assert.match(source, /onMoveStop\(node\.id, 1\)/);
});
