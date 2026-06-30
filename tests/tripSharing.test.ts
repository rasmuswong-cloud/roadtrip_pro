import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShareInviteLink, normalizeShareCode, readShareCodeFromLocation } from '../src/services/sharing/tripSharing';

test('normalizeShareCode accepts raw codes and full invite links', () => {
  assert.equal(normalizeShareCode(' ab cd 1234 '), 'ABCD1234');
  assert.equal(normalizeShareCode('https://roadtrip.example/app?invite=efgh5678'), 'EFGH5678');
});

test('buildShareInviteLink creates a private invite URL without changing the path', () => {
  assert.equal(
    buildShareInviteLink(' abcd1234 ', 'https://roadtrip.example/planner?view=days'),
    'https://roadtrip.example/planner?view=days&invite=ABCD1234',
  );
});

test('readShareCodeFromLocation returns an empty string when no invite is present', () => {
  assert.equal(readShareCodeFromLocation('https://roadtrip.example/planner'), '');
  assert.equal(readShareCodeFromLocation('https://roadtrip.example/planner?invite=joinme42'), 'JOINME42');
});
