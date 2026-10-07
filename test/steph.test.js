// From Steph ticks close the reminder through the quest engine (src/steph.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tickReminder, isReminderId } from '../src/steph.js';

const ID = '05dbec3b-19d4-4a56-bc22-7fc5de289dce';
const engine = answer => {
  const seen = [];
  return { seen, env: { QUEST_ENGINE_URL: 'https://qe', QUEST_ENGINE_TOKEN: 'tok', QUEST_ENGINE: { fetch: async req => {
    seen.push({ url: req.url, token: req.headers.get('X-Admin-Token'), body: Object.fromEntries(new URLSearchParams(await req.text())) });
    return new Response(JSON.stringify(answer), { status: answer.ok ? 200 : 401 });
  } } } };
};

test('a tick sends done, an untick open, with the engine token over the binding', async () => {
  const e = engine({ ok: true, code: 'done', message: 'Afgevinkt', reminders: [] });
  assert.deepEqual(await tickReminder(e.env, ID, true), { ok: 1, code: 'done', message: 'Afgevinkt' });
  await tickReminder(e.env, ID, false);
  assert.deepEqual(e.seen.map(x => [x.url, x.token, x.body.action, x.body.id]), [['https://qe/family/remind', 'tok', 'done', ID], ['https://qe/family/remind', 'tok', 'open', ID]]);
});

test('a refusal or a bad id is reported, not thrown', async () => {
  assert.equal((await tickReminder(engine({ ok: 0, code: 'bad_passcode', message: 'Verkeerde gezinscode' }).env, ID, true)).code, 'bad_passcode');
  const e = engine({ ok: true });
  assert.equal((await tickReminder(e.env, 'Bel de tandarts', true)).code, 'bad_id');
  assert.equal(e.seen.length, 0);
  assert.equal((await tickReminder({ QUEST_ENGINE_URL: 'https://qe' }, ID, true)).code, 'no_token');
  assert.equal(isReminderId(ID), true);
});
