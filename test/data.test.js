import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainHabits, bossView, power, safeText, gameDay, recoveryView, weatherView, previewWeather, previewAt, missingDays, mergeWork, winToday, focusSession, vaultView, MAIN_HABITS } from '../src/data.js';

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

test('boss widget: the boss\'s HP and Goku\'s front-of-card metrics, read from the engine', () => {
  const boss = { boss_name: 'Android 18', epithet: 'The Infinite', boss_level: 6, current_hp: 412.4, max_hp: 900, status: 'Active', hero_hp: 210, hero_max_hp: 300 };
  const mq = { level: 5.75, level_xp: 1200, level_xp_max: 2000, current_hp: 99, max_hp: 300, power: { power_level: 4100, shield: { amount: 24.6 }, ki: { level: 3, peak: 5 } } };
  const v = bossView({}, boss, mq, { now: { form: 'Super Saiyan 3' } });
  assert.deepEqual(v.boss, { name: 'Android 18', epithet: 'The Infinite', level: 6, hp: 412.4, max: 900, status: 'Active' });
  assert.deepEqual(v.goku, { form: 'Super Saiyan 3', level: 5, hp: 210, max_hp: 300, shield: 25, xp: 1200, xp_max: 2000, power: 4100, ki: { level: 3, peak: 5 } }, 'live hero HP from the boss card wins');
  assert.equal(bossView({}, null, mq, null).goku.hp, 99, 'without the boss card, the Goku card\'s own HP');
  assert.equal(bossView({}, null, null, null), null);
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
  assert.equal(P.load.long.length, 30, 'the engine\'s load series is passed through for the Goku card\'s chart');
  assert.deepEqual(power(null, null, null), { clal: [], peak: null, ki: null, now: null, ratio: null, load: null, moves: [] });
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

test('weather: Open-Meteo shaped for the tile, the strip starting at the current hour', () => {
  const time = Array.from({ length: 48 }, (_, i) => '2026-10-0' + (5 + Math.floor(i / 24)) + 'T' + String(i % 24).padStart(2, '0') + ':00');
  const w = weatherView({
    current: { temperature_2m: 14.4, apparent_temperature: 12.1, weather_code: 61, is_day: 1, wind_speed_10m: 18.2 },
    hourly: { time, temperature_2m: time.map((_, i) => 10 + (i % 24) / 2), precipitation_probability: time.map((_, i) => i % 5 * 20), weather_code: time.map(() => 3), is_day: time.map((_, i) => (i % 24 >= 7 && i % 24 < 19 ? 1 : 0)) },
    daily: { sunrise: ['2026-10-05T07:48'], sunset: ['2026-10-05T19:05'], precipitation_probability_max: [80], temperature_2m_max: [16.2], temperature_2m_min: [9.8] }
  }, NOW);
  assert.equal(w.temp, 14.4); assert.equal(w.day, true); assert.equal(w.sunset, '19:05'); assert.equal(w.hi, 16.2); assert.equal(w.rain, 80);
  assert.equal(w.hours.length, 12); assert.equal(w.hours[0].t, '12:00', '10:00 UTC is 12:00 in Amsterdam'); assert.equal(w.hours[11].t, '23:00'); assert.equal(w.hours[0].temp, 16);
});

test('missing days: past weekdays with no place, never today or weekends', () => {
  const ytd = [
    { date: '2026-09-24', am: '🇧🇪 Beerse', pm: '🇧🇪 Beerse', weekend: 0 },
    { date: '2026-09-25', am: '🏖️ Holiday', pm: '🇳🇱 Home', weekend: 0 },
    { date: '2026-09-28', am: null, pm: null, weekend: 0 },
    { date: '2026-09-29', am: '🇧🇪 Ghent', pm: '', weekend: 0 },
    { date: '2026-09-30', am: '', pm: null, weekend: 0 },
    { date: '2026-10-03', am: null, pm: null, weekend: 1 },
    { date: '2026-10-05', am: '🇳🇱 Home', pm: '🇳🇱 Home', weekend: 0 },
    { date: '2026-10-06', am: null, pm: null, weekend: 0 }
  ];
  // 1 and 2 Oct have no row at all: weekdays, so missing; 26 and 27 Sep are a weekend.
  assert.deepEqual(missingDays(ytd, '2026-10-06'), ['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-02']);
  assert.deepEqual(missingDays([], '2026-10-06'), []);
});

test('focus session: today or yesterday, a start time and 1 to 25 whole minutes', () => {
  assert.deepEqual(focusSession({ day: '2026-10-06', at: '09:10', min: 25, done: true }, '2026-10-06'), { day: '2026-10-06', at: '09:10', min: 25, done: true });
  assert.deepEqual(focusSession({ day: '2026-10-05', at: '23:50', min: '12.4', done: 'false' }, '2026-10-06'), { day: '2026-10-05', at: '23:50', min: 12, done: false }, 'one that ran past midnight');
  assert.equal(focusSession({ day: '2026-10-01', at: '09:10', min: 25 }, '2026-10-06'), null);
  assert.equal(focusSession({ day: '2026-10-06', at: '9:10', min: 25 }, '2026-10-06'), null);
  assert.equal(focusSession({ day: '2026-10-06', at: '09:10', min: 0 }, '2026-10-06'), null);
  assert.equal(focusSession({ day: '2026-10-06', at: '09:10', min: 40 }, '2026-10-06'), null);
});

test('desk work: a past day set on Roy OS fills in the journal, and wins over an empty row', () => {
  const ytd = [{ date: '2026-09-28', am: '', pm: '', weekend: 0 }, { date: '2026-09-29', am: '🇧🇪 Beerse', pm: '🇧🇪 Beerse', weekend: 0 }, { date: '2026-10-01', am: '🇳🇱 Home', pm: '🇳🇱 Home', weekend: 0 }];
  const merged = mergeWork(ytd, [{ date: '2026-09-28', am: '🇧🇪 Beerse', pm: '🇧🇪 Ghent', commute: '🚲 E-bike' }, { date: '2026-09-30', am: '🇳🇱 Home' }]);
  assert.deepEqual(merged.map(w => [w.date, w.am, w.pm]), [['2026-09-28', '🇧🇪 Beerse', '🇧🇪 Ghent'], ['2026-09-29', '🇧🇪 Beerse', '🇧🇪 Beerse'], ['2026-09-30', '🇳🇱 Home', '🇳🇱 Home'], ['2026-10-01', '🇳🇱 Home', '🇳🇱 Home']]);
  assert.deepEqual(missingDays(ytd, '2026-10-02'), ['2026-09-28', '2026-09-30']);
  assert.deepEqual(missingDays(merged, '2026-10-02'), [], 'both filled in on the screen');
});

test('today\'s win: the boss card\'s win (/boss `win`), Done on today\'s game day', () => {
  const boss = { habits: [], win: { day: '2026-10-05', done: 1, hit: { damage: 48 } } };
  assert.deepEqual(winToday(boss, NOW), { done: true, dmg: 48 });
  assert.deepEqual(winToday({ win: { ...boss.win, done: 0, hit: null } }, NOW), { done: false, dmg: null }, 'not ticked yet');
  assert.deepEqual(winToday(boss, Date.parse('2026-10-07T10:00:00Z')), { done: false, dmg: null }, 'yesterday\'s win is not today\'s');
  assert.deepEqual(winToday(null, NOW), { done: false, dmg: null });
});

test('preview time: Amsterdam wall time, ISO as is, within 60 days', () => {
  const now = Date.parse('2026-10-06T15:40:00Z');
  assert.equal(new Date(previewAt('2026-10-12T07:00', now)).toISOString(), '2026-10-12T05:00:00.000Z', 'CEST is UTC+2');
  assert.equal(new Date(previewAt('2026-11-02T07:00', now)).toISOString(), '2026-11-02T06:00:00.000Z', 'CET is UTC+1 after 25 Oct');
  assert.equal(new Date(previewAt('2026-10-12', now)).toISOString(), '2026-10-12T05:00:00.000Z', 'a bare day is 07:00');
  assert.equal(new Date(previewAt('2026-10-12T05:00:00Z', now)).toISOString(), '2026-10-12T05:00:00.000Z');
  assert.equal(previewAt('2027-10-12T07:00', now), null, 'too far');
  assert.equal(previewAt('next monday', now), null);
  assert.equal(previewAt('', now), null);
});

test('preview weather: "now" is the forecast at the previewed hour', () => {
  const at = Date.parse('2026-10-12T05:00:00Z');
  const w = { current: { temperature_2m: 20, weather_code: 0, is_day: 1 }, daily: { temperature_2m_max: [14], temperature_2m_min: [6], sunrise: ['2026-10-12T07:55'], sunset: ['2026-10-12T18:50'] },
    hourly: { time: ['2026-10-12T06:00', '2026-10-12T07:00', '2026-10-12T08:00'], temperature_2m: [7, 8, 9], apparent_temperature: [5, 6, 7], precipitation_probability: [10, 60, 20], weather_code: [3, 61, 3], is_day: [0, 0, 1], wind_speed_10m: [9, 12, 10] } };
  const v = previewWeather(w, at);
  assert.equal(v.temp, 8); assert.equal(v.feels, 6); assert.equal(v.code, 61); assert.equal(v.day, false); assert.equal(v.wind, 12);
  assert.equal(v.hours[0].t, '07:00'); assert.equal(v.hi, 14);
});

test('vault: core, shield and the week\'s watch from GET /vault, read only', () => {
  // Friday 9 Oct 2026, 09:00 Amsterdam: day 5 of the game week that began Monday 5 Oct.
  const now = Date.parse('2026-10-09T07:00:00Z');
  const state = {
    vault: { name: 'Iron Wallet', tier: 3, currency: 'EUR', balance: 4350, target: 12000, funding_pct: 36.3, funded: false, months_ahead: 1, projected_completion: '2027-08', started_at: '2026-06-01',
      breach: { week: '2026-09-28', count: 1, last_at: '2026-09-30T10:00:00Z' }, form: { name: 'Sandglass Bastion', rarity: 'Epic' }, next_form: { name: 'Ember Citadel' } },
    events: [{ type: 'BREACH', at: '2026-09-30T10:00:00Z' }],
    watch: { today_status: null, days: [{ day: '2026-10-05', status: 'held' }, { day: '2026-10-06', status: 'spent' }, { day: '2026-10-07', status: 'held' }, { day: '2026-10-08', status: 'held' }, { status: null }, { status: null }, { status: null }], streak: 2, held_week: 3, bonus_needed: 5 }
  };
  const v = vaultView({}, state, now);
  assert.equal(v.active, true); assert.equal(v.tier, 3); assert.equal(v.form, 'Sandglass Bastion'); assert.equal(v.rarity, 'Epic'); assert.equal(v.next_form, 'Ember Citadel');
  assert.deepEqual(v.shield, { integrity: 5, breached: false, armed: true }, 'last week\'s breach does not count');
  assert.equal(v.watch.today, 4); assert.deepEqual(v.watch.days.map(d => d.status), ['held', 'spent', 'held', 'held', null, null, null]);
  const hit = vaultView({}, { ...state, events: [{ type: 'BREACH', at: '2026-10-07T12:00:00Z' }] }, now);
  assert.deepEqual(hit.shield, { integrity: 0, breached: true, armed: true }, 'a breach this week breaks the shield');
  assert.equal(vaultView({}, { ...state, vault: { ...state.vault, started_at: '2026-10-12' } }, now).shield.armed, false, 'not armed before the campaign starts');
  assert.equal(vaultView({ DESK_HIDE: 'wallet' }, state, now).name, '', 'names go through safeText');
  assert.deepEqual(vaultView({}, { vault: null }, now), { active: false });
  assert.equal(vaultView({}, null, now), null);
  assert.equal(vaultView({}, { vault: state.vault }, now).watch, null, 'no watch before the engine has one');
});
