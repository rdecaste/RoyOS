import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainHabits, power, safeText, gameDay, recoveryView, MAIN_HABITS } from '../src/data.js';

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
  const mq = { power: { fitness: 32.9, fatigue: 32.1, form_state: 'Steady', power_level: 4100, load_ratio: { value: .98, zone: 'Optimal', tsb: .8, state: 'Steady', yesterday: null, bands: { low: .8, optimal: 1.3, high: 1.5 } }, load: { from: '2026-09-06', long, short, form: [] }, ki: { level: 1, peak: 5, heal_cap: 60, recovery_bonus: .1 } } };
  const hero = { days: [{ events: [{ kind: 'boss', habit: 'Run', at: '2026-10-03T17:00:00Z', damage: 40 }] }] };
  const quest = { updatedAt: '2026-10-03', latestEvidence: '🏃 Completed 15.59 km in 1:33:25' };
  const P = power(mq, hero, quest);
  assert.equal(P.clal.length, 28);
  assert.equal(P.clal[27].date, '2026-10-05');
  assert.equal(P.peak.date, '2026-10-03'); assert.equal(P.peak.what, '15.6 km run'); assert.equal(P.peak.al, 38.2);
  assert.equal(P.ki.level, 1);
  assert.equal(P.clal[27].cl, 32.9, 'the scale is read off today\'s fitness');
  assert.deepEqual(P.now, { fitness: 32.9, fatigue: 32.1, form_state: 'Steady', power_level: 4100 });
  assert.equal(P.ratio.zone, 'Optimal', 'the ratio is the engine\'s, passed through');
  assert.deepEqual(power(null, null, null), { clal: [], peak: null, ki: null, now: null, ratio: null });
});

test('safe text: the main quest stays off the screen', () => {
  const env = {};
  assert.equal(safeText(env, 'Finish the deck'), 'Finish the deck');
  assert.equal(safeText(env, "do a workout and don't FAP!"), '');
  assert.equal(safeText({ DESK_HIDE: 'secret' }, 'a secret plan'), '');
  assert.equal(gameDay(Date.parse('2026-10-05T01:30:00Z')), '2026-10-04', 'before 04:00 Amsterdam it is still yesterday');
});

test('recovery: the engine\'s /recovery answer, shaped for the board', () => {
  const r = recoveryView({ ok: 1, date: '2026-10-05', measured: true, fresh: true, verdict: 'steady', verdict_text: 'Go steady', verdict_sub: 'Easy session only',
    sleep: { value: 6.6, usual: 7.1, low: true }, hrv: { value: 48, usual: 54, low: false }, rhr: { value: 53, usual: 52, low: false }, usual: { sleep: 7.1, hrv: 54, rhr: 52 },
    nights: [{ date: '2026-10-04', sleep: 8.8, hrv: 53, rhr: 55, verdict: 'good' }, { date: '2026-10-05', measured: true, sleep: 6.6, hrv: 48, rhr: 53, verdict: 'steady' }, { date: '2026-10-06', measured: false, verdict: null }] });
  assert.equal(r.last.score, 56); assert.equal(r.last.text, 'Go steady'); assert.equal(r.last.low.sleep, true); assert.equal(r.usual.hrv, 54);
  assert.deepEqual(r.nights.map(n => n.day), ['2026-10-04', '2026-10-05'], 'unmeasured mornings are left out');
  assert.deepEqual(recoveryView({ ok: 0, code: 'bad_token' }), { last: null, usual: {}, nights: [] });
});
