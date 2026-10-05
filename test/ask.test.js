import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyActions, askPrompt } from '../src/ask.js';
import { emptyDay } from '../src/day.js';

const NOON = Date.parse('2026-10-05T10:00:00Z'); // 12:00 Amsterdam

test('actions: ticks, adds, habits, moods and work land in the day', () => {
  const d = emptyDay();
  const n = applyActions(d, [
    { type: 'todo_tick', text: 'Finish deck', done: true },
    { type: 'todo_add', text: 'Call the garage', list: 'can' },
    { type: 'habit_done', name: 'Supplements' },
    { type: 'habit', name: 'Weigh-in', done: false },
    { type: 'mood_log', mood: 4, note: 'Focused' },
    { type: 'mood_log', mood: 9 },
    { type: 'work_set', am: 'home', ride: 'car' },
    { type: 'nonsense' }
  ], NOON);
  assert.equal(n, 6);
  assert.equal(d.ticks['Finish deck'], true);
  assert.deepEqual(d.added, [{ t: 'Call the garage', g: 'can' }]);
  assert.equal(d.habits.Supplements, '12:00');
  assert.equal(d.habits['Weigh-in'], false);
  assert.deepEqual(d.moods, [{ at: 720, m: 4, note: 'Focused' }]);
  assert.deepEqual(d.work, { am: '🇳🇱 Home', commute: '🚗 Car' });
});

test('actions: events are validated, updated and deleted by id; a plan replaces the day', () => {
  const d = emptyDay();
  assert.equal(applyActions(d, [{ type: 'event_add', who: 'kids', from: '08:30', to: '15:15', t: 'Home', k: 'fam' }], NOON), 1);
  assert.equal(applyActions(d, [{ type: 'event_add', who: 'kids', from: '15:00', to: '14:00', t: 'Backwards' }], NOON), 0);
  const id = d.events[0].id;
  assert.equal(applyActions(d, [{ type: 'event_update', id, to: '16:00', k: 'bogus' }], NOON), 1);
  assert.equal(d.events[0].to, '16:00'); assert.equal(d.events[0].k, 'fam');
  assert.equal(applyActions(d, [{ type: 'plan', events: [{ id: 'a', who: 'roy', from: '09:00', to: '10:00', t: 'Standup', k: 'work' }, { from: 'x', to: 'y', t: 'bad' }] }], NOON), 1);
  assert.equal(d.events.length, 1); assert.equal(d.events[0].ic, '💼');
  assert.equal(applyActions(d, [{ type: 'event_delete', id: 'a' }], NOON), 1);
  assert.deepEqual(d.events, []);
});

test('prompt: the board goes in as JSON, the main quest never does', () => {
  const data = {
    today: '2026-10-05', now: '12:00', edits: { ...emptyDay(), ticks: { 'Finish deck': true } },
    journal: { win_if: 'Finish the deck', must: [{ t: 'Finish deck', done: false }], can: [], steph: [], work: null, border: { be: 1, nl: 0 } },
    main: [{ name: 'Supplements', done: false, usual: '07:00', streak: 3 }],
    fitness: { recovery: { score: 56, verdict: 'steady', sleep: 6.6, hrv: 48, rhr: 53 }, clal: [{ cl: 33, al: 33 }], week: { hours: .5, target: 6 } },
    quest: { title: 'Run a Half Marathon', next_move: 'Long run', days_left: 46 }
  };
  const msgs = askPrompt(data, 'kids are home "today"');
  assert.equal(msgs.length, 2);
  const user = msgs[1].content;
  assert.ok(user.includes('"Finish deck","done":true'));
  assert.ok(user.includes("Roy says: \"kids are home 'today'\""));
  assert.ok(!/pmo|fap/i.test(msgs[0].content + user));
});
