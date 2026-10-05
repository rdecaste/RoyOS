import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainHabits, power, safeText, gameDay, MAIN_HABITS } from '../src/data.js';

const NOW = Date.parse('2026-10-05T10:00:00Z');

test('main habits: done on today\'s game day, with the last 14 days from the boss log', () => {
  const boss = { habits: [
    { name: 'Got up at 6', icon: '⏰', streak: 3, last_attack: '2026-10-05T04:00:31.000Z' },
    { name: 'Evening review', icon: '🌙', streak: 1, last_attack: '2026-10-04T18:50:04.800Z' },
    { name: 'Weigh-in', icon: '⚖️', streak: 10, last_attack: null }
  ] };
  const hero = { days: [{ events: [{ kind: 'boss', habit: 'Got up at 6', at: '2026-10-03T04:05:00Z' }, { kind: 'boss', habit: 'Got up at 6', at: '2026-10-05T04:00:31Z' }, { kind: 'hero', habit: 'Got up at 6', at: '2026-10-02T04:05:00Z' }] }] };
  const m = mainHabits(boss, hero, NOW);
  assert.deepEqual(m.map(x => x.name), ['Got up at 6', 'Weigh-in', 'Evening review']);
  assert.equal(m[0].done, true); assert.equal(m[0].at, '06:00'); assert.deepEqual(m[0].days, ['2026-10-03']);
  assert.equal(m[2].done, false, 'yesterday evening is not today');
  assert.equal(MAIN_HABITS.length, 5);
});

test('power: load per day, the week\'s peak with its workout, the ki charge', () => {
  const long = Array.from({ length: 30 }, (_, i) => 3000 + i * 10), short = long.map((v, i) => (i === 27 ? 3820 : v - 100));
  const mq = { power: { load: { from: '2026-09-06', long, short, form: [] }, ki: { level: 1, peak: 5, heal_cap: 60, recovery_bonus: .1 } } };
  const hero = { days: [{ events: [{ kind: 'boss', habit: 'Run', at: '2026-10-03T17:00:00Z', damage: 40 }] }] };
  const quest = { updatedAt: '2026-10-03', latestEvidence: '🏃 Completed 15.59 km in 1:33:25' };
  const P = power(mq, hero, quest);
  assert.equal(P.clal.length, 28);
  assert.equal(P.clal[27].date, '2026-10-05');
  assert.equal(P.peak.date, '2026-10-03'); assert.equal(P.peak.what, '15.6 km run'); assert.equal(P.peak.al, 38.2);
  assert.equal(P.ki.level, 1);
  assert.deepEqual(power(null, null, null), { clal: [], peak: null, ki: null });
});

test('safe text: the main quest stays off the screen', () => {
  const env = {};
  assert.equal(safeText(env, 'Finish the deck'), 'Finish the deck');
  assert.equal(safeText(env, "do a workout and don't FAP!"), '');
  assert.equal(safeText({ DESK_HIDE: 'secret' }, 'a secret plan'), '');
  assert.equal(gameDay(Date.parse('2026-10-05T01:30:00Z')), '2026-10-04', 'before 04:00 Amsterdam it is still yesterday');
});
