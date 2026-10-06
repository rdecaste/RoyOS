import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workToSend, isWeekday, adminCookie } from '../src/work.js';

test('work sync: a catch-up only fills what the admin board leaves empty', () => {
  const desk = [
    { date: '2026-09-28', am: '🇧🇪 Beerse', pm: '🇧🇪 Ghent', commute: '🚲 E-bike' },
    { date: '2026-10-05', am: '🇧🇪 Ghent', pm: '🇧🇪 Ghent', commute: '🚗 Car' },
    { date: '2026-10-06', am: '🇧🇪 Ghent', pm: '🇧🇪 Ghent', commute: '🚗 Car' },
    { date: '2026-10-04', am: '🇳🇱 Home' }
  ];
  const rows = [{ date: '2026-09-28', am: null, pm: null, commute: null }, { date: '2026-10-05', am: '🇳🇱 Home', pm: '🇳🇱 Home', commute: 'N/A' }, { date: '2026-10-06', am: '', pm: '', commute: '' }];
  const out = workToSend(desk, rows);
  assert.deepEqual(out.days, [
    { date: '2026-09-28', am: '🇧🇪 Beerse', pm: '🇧🇪 Ghent', commute: '🚲 E-bike' },
    { date: '2026-10-06', am: '🇧🇪 Ghent', pm: '🇧🇪 Ghent', commute: '🚗 Car' }
  ]);
  assert.deepEqual(out.done, ['2026-10-05'], 'the board already has that day: Roy OS drops its copy');
});

test('work sync: a change Roy just made overwrites, and weekends never go', () => {
  const out = workToSend([{ date: '2026-10-05', commute: '🚗 Car' }, { date: '2026-10-04', am: '🇳🇱 Home' }], [{ date: '2026-10-05', am: '🇳🇱 Home', pm: '🇳🇱 Home', commute: 'N/A' }], { overwrite: true });
  assert.deepEqual(out.days, [{ date: '2026-10-05', commute: '🚗 Car' }]);
  assert.equal(isWeekday('2026-10-04'), false); assert.equal(isWeekday('2026-10-05'), true);
});

test('work sync: the admin board cookie is its own scheme', async () => {
  const c = await adminCookie('pw', 1791300000000);
  assert.match(c, /^admin_session=1791300600\.[0-9a-f]{64}$/);
});
