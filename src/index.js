// Roy OS: the desk screen next to Roy all day, with a new world every Monday.
//
// Routes (all need the desk cookie unless noted):
//   GET  /                 the board
//   GET  /login            sign-in page (no cookie)   POST /login (password, next)   POST /logout
//   GET  /data             everything the board shows, as JSON (the page polls it every minute)
//   GET  /?at=2026-10-12T07:00   a preview: the board at that time (Amsterdam), read only; /data?at= feeds it.
//                          Nothing is saved, no cache written, no world, critter or commute run started.
//   POST /act              one edit on the board: {type: todo_tick|todo_add|mood|work|plan|undo, ...}; work with a past `day` fills in that day,
//                          and places and ride go on to the admin board's work_location (src/work.js);
//                          or a finished focus session {type: focus, day, at, min, done} (kept in DeskState's focus table)
//   POST /ask              the Ask box: {text} → the assistant's reply and the edits it made
//   GET  /theme            this week's world (and next week's pick, and the week's critter when it has one)
//   POST /redo             {what: clip|all, week}: the menu's paid redo of a week's world (this week or the next only):
//                          `clip` keeps the still (and the critter) and makes a new clip, `all` a new still and clip
//                          with the same character. Refused while that week is being made.
//   GET  /card/boss, /card/goku   the boss card and the Goku card as on Roy's iPhone, for the boss widget's popup
//   GET  /status           no cookie: ok, week, theme status (for healthchecks)
//   Admin (X-Admin-Token):
//   GET  /theme/list       the last 12 weeks            POST /theme/run (week?, force=1, character?)   POST /theme/retry (week)
//
// Every hour (cron) the week's world is made if it is Monday 06:00 Amsterdam or later and
// the week has none yet; a failed week is retried on the next tick.
import { isSignedIn, sameText, sessionCookie, clearCookie } from './auth.js';
import { state } from './state.js';
import { board, themeView, gameDay, focusSession, previewAt } from './data.js';
import { loadCatalogue, pickTheme, loreFor, remakeDue, critterDue, isoWeek, weekAfter, ymd } from './themes.js';
import { chatJson } from './media.js';
import { deskPage, loginPage } from './page.js';
import { MOOD_ART } from './moodart.js';
import { applyActions, askPrompt } from './ask.js';
import { syncWork } from './work.js';

export { DeskState } from './state.js';
export { DeskTheme } from './workflows.js';

const PAGE_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
// The boss widget's popup shows the real cards. They are their own Workers (boss, mainquest)
// behind Cloudflare Access; a service binding reaches them without it, so they open here
// behind the desk cookie, same origin, and may be framed by this page only.
const CARDS = { boss: 'BOSS_CARD', goku: 'GOKU_CARD' };
const CARD_HEADERS = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "frame-ancestors 'self'", 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };
async function card(env, name) {
  const bind = env[CARDS[name]];
  if (!bind) return new Response('This card is not connected (' + CARDS[name] + ').', { status: 503, headers: CARD_HEADERS });
  const r = await bind.fetch(new Request('https://' + name + '.card/', { headers: { Accept: 'text/html' } }));
  if (!r.ok) return new Response('The ' + name + ' card answered ' + r.status + '.', { status: 502, headers: CARD_HEADERS });
  return new Response(await r.text(), { headers: CARD_HEADERS });
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const page = (html, status = 200, extra = {}) => new Response(html, { status, headers: { ...PAGE_HEADERS, ...extra } });
const NEXT = new Set(['/']);
const TZ = 'Europe/Amsterdam';
const amsterdam = (ms, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', ...opts }).format(new Date(ms));
const amsterdamHour = ms => Number(amsterdam(ms, { hour: '2-digit' }));
const isMonday = ms => amsterdam(ms, { weekday: 'short' }) === 'Mon';

async function readFields(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) return (await request.json().catch(() => ({}))) || {};
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

// ---- The week's world ----
// Before Monday 06:00 the previous week's world is still "this week's".
export function themeWeek(now = Date.now()) {
  const week = isoWeek(now);
  return isMonday(now) && amsterdamHour(now) < 6 ? weekAfter(week, -1) : week;
}

async function currentTheme(env, s, now = Date.now()) {
  const week = themeWeek(now);
  const rows = await s.themes(12);
  const current = rows.find(r => r.week === week) || rows.find(r => r.status === 'ready') || null;
  const catalogue = await loadCatalogue(env.DB).catch(() => []);
  const next = catalogue.length ? pickTheme(catalogue, weekAfter(week, 1)) : null;
  const critter = current ? await s.cached('critter:' + current.week) : null;
  return themeView(current, next, critter, loreFor(catalogue, current));
}

// A preview's own note: the time it shows and, when that week has no world yet, the one the Monday
// run will pick (pickTheme is the same pick the run makes; nothing is generated here).
async function previewNote(env, s, at) {
  const week = themeWeek(at), row = await s.theme(week);
  const catalogue = row ? [] : await loadCatalogue(env.DB).catch(() => []);
  const pick = catalogue.length ? pickTheme(catalogue, week) : null;
  return { at: new Date(at).toISOString(), week, world: row ? { franchise: row.franchise, scene: row.scene, character: row.character, ready: row.status === 'ready' } : pick ? { franchise: pick.franchise, scene: pick.scene, character: pick.character, ready: false } : null };
}

// Starts the week's generation when it has none (or the last try failed). Idempotent.
// force remakes the week from scratch (new still and clip); a retry keeps a finished still.
// `character` remakes the week with that character; otherwise a week keeps the character it has.
export async function ensureTheme(env, s, { week = themeWeek(), force = false, retry = false, character = null } = {}) {
  const row = await s.theme(week);
  if (row && row.status === 'running' && !force && !retry) return { ok: 1, status: 'running', week };
  if (row && row.status === 'ready' && !force && !retry) return { ok: 1, status: 'ready', week };
  const catalogue = await loadCatalogue(env.DB);
  if (!catalogue.length) throw new Error('No franchises with scenes and characters in the catalogue');
  const pick = pickTheme(catalogue, week, { character: character || (row && !force ? row.character : null) });
  const run = await env.DESK_THEME.create({ params: { week } });
  if (!force && row && row.still_public_id && row.franchise === pick.franchise && row.character === pick.character) {
    // A retry of the same pick with a still already made: only the clip is redone, with the current prompt.
    await s.updateTheme(week, { status: 'running', error: null, prompts: JSON.stringify(pick.prompts), workflow_id: run.id, started_at: new Date().toISOString(), finished_at: null });
  } else {
    if (row) await s.resetTheme(week);
    await s.startTheme(pick, run.id);
  }
  return { ok: 1, status: 'started', week, workflow: run.id, pick: { franchise: pick.franchise, scene: pick.scene, character: pick.character } };
}

// Starts the week's critter CRITTER_ART asks for, once: the ask is claimed in one step before the run
// starts (the board's /data calls from two screens can arrive together), and the run's id comes from
// the ask, so a second start for the same ask is refused too.
async function ensureCritter(env, s) {
  const ask = critterDue(env.CRITTER_ART, false); if (!ask) return null;
  if (!(await s.claim(ask.key, 3650 * 864e5))) return null;
  const run = await env.DESK_THEME.create({ id: ask.key.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 64), params: { critterWeek: ask.week, critterSheet: ask.sheet } });
  return { ok: 1, week: ask.week, sheet: ask.sheet, workflow: run.id };
}

// ---- Edits on the board ----
// Today's places set on the screen go to the admin board (src/work.js); once it has them the answer
// carries them as `work` (what the board now reads from the journal row) and the edits no longer do.
async function withWork(env, s, day, n) {
  if (!n.edits || !n.edits.work) return n;
  const sync = await syncWork(env, s, day, { days: [day], overwrite: true }).catch(err => ({ saved: [], failed: [{ date: day, message: err.message }] }));
  if (!sync.saved.includes(day)) return { ...n, synced: false };
  const { work, ...edits } = n.edits;
  return { ...n, edits, work, synced: true };
}

async function edit(env, s, day, fn) {
  const { data } = await s.day(day);
  const before = JSON.stringify(data);
  const out = fn(data) || {};
  await s.saveDay(day, data, before);
  return { ok: 1, edits: data, undo: true, ...out };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname;
    const s = state(env);
    try {
      if (path === '/status') {
        const t = await s.theme(themeWeek());
        return json({ ok: 1, week: themeWeek(), theme: t ? t.status : 'none' });
      }
      if (!env.DESK_PASSWORD) return json({ ok: 0, code: 'not_configured', message: 'DESK_PASSWORD is not set' }, 503);

      // Admin routes, with the token.
      if (path.startsWith('/theme/') && request.method !== 'OPTIONS') {
        if (!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token') !== env.ADMIN_TOKEN) return json({ ok: 0, code: 'bad_token' }, 401);
        if (path === '/theme/list') return json({ ok: 1, themes: (await s.themes(12)).map(r => themeView(r, null)) });
        if (path === '/theme/run' && request.method === 'POST') {
          const f = await readFields(request);
          return json(await ensureTheme(env, s, { week: f.week || themeWeek(), force: f.force === '1' || f.force === true, character: f.character || null }));
        }
        if (path === '/theme/retry' && request.method === 'POST') {
          const f = await readFields(request);
          return json(await ensureTheme(env, s, { week: f.week || themeWeek(), retry: true }));
        }
        return json({ ok: 0, code: 'not_found' }, 404);
      }

      if (path === '/login') {
        if (request.method === 'POST') {
          const f = await readFields(request);
          const next = NEXT.has(f.next) ? f.next : '/';
          if (!sameText(f.password || '', env.DESK_PASSWORD)) {
            await new Promise(r => setTimeout(r, 800));
            return page(loginPage({ next, wrong: true }), 401);
          }
          return new Response(null, { status: 303, headers: { Location: next, 'Set-Cookie': await sessionCookie(env.DESK_PASSWORD) } });
        }
        return page(loginPage({ next: url.searchParams.get('next') || '/' }));
      }
      if (path === '/logout' && request.method === 'POST') {
        return new Response(null, { status: 303, headers: { Location: '/login', 'Set-Cookie': clearCookie() } });
      }

      const signedIn = await isSignedIn(request, env.DESK_PASSWORD);
      if (!signedIn) {
        if (path === '/') return new Response(null, { status: 303, headers: { Location: '/login?next=/' } });
        return json({ ok: 0, code: 'signed_out' }, 401);
      }

      const at = url.searchParams.has('at') ? previewAt(url.searchParams.get('at')) : null;
      if (url.searchParams.has('at') && at == null && (path === '/' || path === '/data')) return json({ ok: 0, code: 'bad_at', message: 'at must be a time within 60 days, like 2026-10-12T07:00 (Amsterdam)' }, 400);
      if (at != null && (path === '/' || path === '/data') && request.method === 'GET') {
        const [data, theme, preview] = await Promise.all([board(env, s, at, { preview: true }), currentTheme(env, s, at), previewNote(env, s, at)]);
        if (path === '/data') return json({ ok: 1, ...data, theme, preview });
        return page(deskPage({ data: { ...data, preview }, theme, moodArt: MOOD_ART.map(b => 'data:image/webp;base64,' + b) }));
      }
      if (path === '/' && request.method === 'GET') {
        const [data, theme] = await Promise.all([board(env, s), currentTheme(env, s)]);
        return page(deskPage({ data, theme, moodArt: MOOD_ART.map(b => 'data:image/webp;base64,' + b) }));
      }
      if (path === '/data') {
        ctx.waitUntil(ensureCritter(env, s).catch(err => console.error('critter: ' + (err && err.message || err))));
        if (env.ADMIN_BOARD && env.ADMIN_PASSWORD) ctx.waitUntil(syncWork(env, s, ymd(Date.now())).catch(err => console.error('work sync: ' + (err && err.message || err))));
        const [data, theme] = await Promise.all([board(env, s), currentTheme(env, s)]);
        return json({ ok: 1, ...data, theme });
      }
      if (path === '/theme') return json({ ok: 1, theme: await currentTheme(env, s) });
      if (path.startsWith('/card/') && CARDS[path.slice(6)]) return card(env, path.slice(6));

      if (path === '/redo' && request.method === 'POST') {
        const f = await readFields(request), now = themeWeek();
        const week = String(f.week || now), what = f.what === 'all' ? 'all' : f.what === 'clip' ? 'clip' : null;
        if (!what) return json({ ok: 0, code: 'bad_what', message: 'what must be clip or all' }, 400);
        if (week !== now && week !== weekAfter(now, 1)) return json({ ok: 0, code: 'bad_week', message: 'Only this week or next week can be redone' }, 400);
        const row = await s.theme(week);
        if (!row) return json({ ok: 0, code: 'no_world', message: 'That week has no world yet' }, 404);
        if (['running', 'still'].includes(row.status)) return json({ ok: 0, code: 'busy', message: 'That week is being made right now' }, 409);
        return json(await ensureTheme(env, s, what === 'all' ? { week, force: true, character: row.character } : { week, retry: true }));
      }

      if (path === '/act' && request.method === 'POST') {
        const a = await readFields(request), day = ymd(Date.now());
        // A missing day filled in: a past day this year gets its places and ride in its own DeskState row.
        if (a.type === 'work' && a.day && a.day !== day) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.day)) || a.day > day || a.day.slice(0, 4) !== day.slice(0, 4)) return json({ ok: 0, code: 'bad_day', message: 'Only a past day this year can be filled in' }, 400);
          const n = await edit(env, s, a.day, data => ({ applied: applyActions(data, [{ ...a, type: 'work' }], Date.now()) }));
          const sync = await syncWork(env, s, day, { days: [a.day], overwrite: true }).catch(err => ({ saved: [], failed: [{ date: a.day, message: err.message }] }));
          return json({ ok: 1, day: a.day, applied: n.applied, synced: sync.saved.includes(a.day) });
        }
        if (a.type === 'focus') {
          const f = focusSession(a, day);
          if (!f) return json({ ok: 0, code: 'bad_session', message: 'A focus session needs day, at (HH:MM) and 1 to 25 minutes' }, 400);
          return json({ ok: 1, focus: (await s.addFocus(f)).filter(x => x.day === day) });
        }
        if (a.type === 'undo') {
          const { undo } = await s.day(day);
          if (!undo) return json({ ok: 0, code: 'nothing_to_undo' });
          await s.saveDay(day, undo, null);
          return json({ ok: 1, edits: undo, undo: false });
        }
        const n = await edit(env, s, day, data => ({ applied: applyActions(data, [a], Date.now()) }));
        return json(await withWork(env, s, day, n));
      }

      if (path === '/ask' && request.method === 'POST') {
        const { text } = await readFields(request);
        if (!text || !String(text).trim()) return json({ ok: 0, code: 'empty' }, 400);
        const data = await board(env, s);
        const out = await chatJson(env, askPrompt(data, String(text).trim().slice(0, 240)));
        const actions = Array.isArray(out.actions) ? out.actions : [];
        const reply = typeof out.reply === 'string' ? out.reply.slice(0, 320) : '';
        if (!actions.length) return json({ ok: 1, reply: reply || 'Nothing to change.', applied: 0 });
        const n = await withWork(env, s, data.today, await edit(env, s, data.today, d => ({ applied: applyActions(d, actions, Date.now()) })));
        return json({ ...n, reply: reply || (n.applied ? 'Done.' : 'Nothing to change.') });
      }

      return json({ ok: 0, code: 'not_found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ ok: 0, code: 'server_error', message: String(err && err.message || err) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    if (!env.DESK_PASSWORD) return;
    ctx.waitUntil((async () => {
      const s = state(env);
      try {
        const now = event.scheduledTime || Date.now(), week = themeWeek(now);
        const character = remakeDue(env.REMAKE, await s.theme(week), week);
        await ensureTheme(env, s, character ? { week, force: true, character } : { week });
        await ensureCritter(env, s);
      } catch (err) {
        console.error('theme cron: ' + (err && err.message || err));
      }
    })());
  }
};
