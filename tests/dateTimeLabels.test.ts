import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateLabel, formatTimeLabel } from '../src/utils/dateTimeLabels';

test('date label formatter does not throw for missing or invalid dates', () => {
  assert.doesNotThrow(() => formatDateLabel(null));
  assert.doesNotThrow(() => formatDateLabel(undefined));
  assert.doesNotThrow(() => formatDateLabel('unscheduled'));
  assert.doesNotThrow(() => formatDateLabel('not-a-date'));

  assert.equal(formatDateLabel(null), 'Datum saknas');
  assert.equal(formatDateLabel('unscheduled'), 'Datum saknas');
  assert.equal(formatDateLabel('not-a-date'), 'Datum saknas');
});

test('time label formatter does not throw for missing or invalid timestamps', () => {
  assert.doesNotThrow(() => formatTimeLabel(null));
  assert.doesNotThrow(() => formatTimeLabel(undefined));
  assert.doesNotThrow(() => formatTimeLabel('not-a-time'));

  assert.equal(formatTimeLabel(null), 'Tid saknas');
  assert.equal(formatTimeLabel('not-a-time'), 'Tid saknas');
});

test('route stop metadata can combine invalid imported date values safely', () => {
  const parts = [
    formatDateLabel('unscheduled'),
    formatTimeLabel('invalid-imported-time'),
    'saknar kartposition',
  ].filter(Boolean);

  assert.equal(parts.join(' / '), 'Datum saknas / Tid saknas / saknar kartposition');
});
