// From Steph: Steph's reminders are open To-Dos tagged Steph in the quest D1
// (her page, family.quest-engine.workers.dev/steph). Roy OS only reads D1, so
// a tick here closes the reminder through the quest engine's POST /family/remind
// (action done; an untick sends open), over the QUEST_ENGINE service binding
// with QUEST_ENGINE_TOKEN (Roy, 7 Oct 2026: "link it").

export const isReminderId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));

// Answers {ok, code, message} from the engine, or why it could not be asked.
export async function tickReminder(env, id, done) {
  if (!isReminderId(id)) return { ok: 0, code: 'bad_id', message: 'Not a reminder id' };
  if (!env.QUEST_ENGINE_TOKEN) return { ok: 0, code: 'no_token', message: 'QUEST_ENGINE_TOKEN is not set' };
  const req = () => new Request(`${env.QUEST_ENGINE_URL}/family/remind`, {
    method: 'POST',
    headers: { 'X-Admin-Token': env.QUEST_ENGINE_TOKEN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ action: done ? 'done' : 'open', id: String(id) })
  });
  const r = await (env.QUEST_ENGINE ? env.QUEST_ENGINE.fetch(req()) : fetch(req()));
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && body.ok ? 1 : 0, code: body.code || String(r.status), message: body.message || '' };
}
