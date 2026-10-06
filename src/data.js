// What the board shows: the quest engine's public cards (habits, hero, power), the
// journal's day (focus, win-if, moods, work), the last nights and workouts from the
// quest D1 (read only), the weather, and the week's world. Plus the day's own edits.
import { ymd, isoWeek, mondayOf } from './themes.js';
import { parseIcs, agenda } from './calendar.js';
import { emptyDay } from './day.js';
import { stillUrl169, clipUrl, spriteUrl } from './media.js';

const TZ = 'Europe/Amsterdam';
const DAY = 864e5;
export const MAIN_HABITS = ['Got up at 6', 'Weigh-in', 'Supplements', 'Morning review', 'Evening review'];
const USUAL = { 'Got up at 6': '06:00', 'Weigh-in': '06:30', 'Supplements': '07:00', 'Morning review': '07:30', 'Evening review': '21:30' };
const SHORT = { 'Got up at 6': 'Up at 6', 'Weigh-in': 'Weigh-in', 'Supplements': 'Supplements', 'Morning review': 'Morning', 'Evening review': 'Evening' };
const WORKOUT = /^(Run|Bike|Swim|Gym|Ruck|E-bike)$/;

// Game days roll over at 04:00 Amsterdam, as the boss card counts them.
export const gameDay = ms => ymd(ms - 4 * 3600e3);
const hhmm = ms => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));

// Words that keep the main quest off a screen visitors can see.
const hidden = env => String(env.DESK_HIDE || 'fap,pmo').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export function safeText(env, text) {
  if (!text) return '';
  const low = String(text).toLowerCase();
  return hidden(env).some(w => low.includes(w)) ? '' : String(text);
}

// ---- The quest engine, over the service binding (fetch as a fallback in dev) ----
async function engine(env, path, { admin = false } = {}) {
  if (admin && !env.QUEST_ENGINE_TOKEN) throw new Error('QUEST_ENGINE_TOKEN is not set');
  const make = () => new Request(`${env.QUEST_ENGINE_URL}${path}`, { headers: { Accept: 'application/json', ...(admin ? { 'X-Admin-Token': env.QUEST_ENGINE_TOKEN } : {}) } });
  let r = await (env.QUEST_ENGINE ? env.QUEST_ENGINE.fetch(make()) : fetch(make()));
  // The public routes are also reachable over the open internet (local dev has no binding to the real engine).
  if (!r.ok && !admin && env.QUEST_ENGINE) r = await fetch(make());
  if (!r.ok) throw new Error(`quest-engine${path} answered ${r.status}`);
  return r.json();
}

export function mainHabits(boss, hero, now) {
  const today = gameDay(now);
  const hits = (hero && hero.days || []).flatMap(d => d.events || []).filter(e => e.kind === 'boss' && MAIN_HABITS.includes(e.habit));
  return MAIN_HABITS.map(n => (boss && boss.habits || []).find(x => x.name === n)).filter(Boolean).map(x => {
    const done = !!x.last_attack && gameDay(Date.parse(x.last_attack)) === today;
    const days = [...new Set(hits.filter(e => e.habit === x.name).map(e => gameDay(Date.parse(e.at))))].filter(d => d !== today).sort();
    return { name: x.name, short: SHORT[x.name], icon: x.icon || '', streak: x.streak || 0, done, at: done ? hhmm(Date.parse(x.last_attack)) : null, usual: USUAL[x.name], days };
  });
}

// The boss widget: the boss's HP from the boss card (GET /boss) and Goku's front-of-card
// metrics (GET /mainquest, live hero HP from /boss, the form from /hero). Read only: habits
// are ticked on the boss card itself, never here.
export function bossView(env, boss, mq, hero) {
  const num = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const b = boss && boss.max_hp ? { name: safeText(env, boss.boss_name) || 'The boss', epithet: safeText(env, boss.epithet), level: num(boss.boss_level), hp: Math.max(0, num(boss.current_hp) || 0), max: num(boss.max_hp), status: boss.status || '' } : null;
  const P = mq && mq.power || {};
  const lv = mq ? Math.trunc(Number(mq.level ?? mq.display_level)) : NaN;
  const hp = boss && num(boss.hero_max_hp) > 0 ? { hp: num(boss.hero_hp), max: num(boss.hero_max_hp) } : mq && num(mq.max_hp) > 0 ? { hp: num(mq.current_hp), max: num(mq.max_hp) } : null;
  const goku = mq || hp ? {
    form: hero && hero.now && hero.now.form || null, level: Number.isFinite(lv) && lv > 0 ? lv : null,
    hp: hp ? Math.max(0, hp.hp || 0) : null, max_hp: hp ? hp.max : null, shield: Math.max(0, Math.round(num(P.shield && P.shield.amount) || 0)),
    xp: mq ? num(mq.level_xp) : null, xp_max: mq ? num(mq.level_xp_max) : null, power: num(P.power_level),
    ki: P.ki ? { level: P.ki.level || 0, peak: P.ki.peak || 5 } : null
  } : null;
  return b || goku ? { boss: b, goku } : null;
}

// Long-term and short-term load, last 28 days (power.load ÷ 100), the week's peak and the ki charge.
// The series is fitness and fatigue times a factor (100 today); the factor is read off
// today's values rather than assumed, so a change in the engine cannot skew the chart.
export function power(mq, hero, quest) {
  const Pw = mq && mq.power, L = Pw && Pw.load;
  const now = Pw ? { fitness: Pw.fitness, fatigue: Pw.fatigue, form_state: Pw.form_state || null, power_level: Pw.power_level } : null;
  const ratio = Pw && Pw.load_ratio ? Pw.load_ratio : null;
  if (!L || !L.long || !L.long.length) return { clal: [], peak: null, ki: null, now, ratio, load: null, moves: [] };
  const n = L.long.length, from = Date.parse(L.from + 'T12:00:00Z');
  const scale = now && now.fitness > 0 && L.long[n - 1] > 0 ? L.long[n - 1] / now.fitness : 100;
  const clal = L.long.slice(-28).map((l, i) => { const k = n - 28 + i; return { date: ymd(from + k * DAY), cl: l / scale, al: L.short[k] / scale }; });
  let bi = -1;
  for (let k = Math.max(0, n - 7); k < n - 1; k++) if (bi < 0 || L.short[k] > L.short[bi]) bi = k;
  let peak = null;
  if (bi >= 0 && L.short[bi] > L.short[n - 1]) {
    const date = ymd(from + bi * DAY);
    const ev = (hero && hero.days || []).flatMap(d => d.events || []).filter(e => e.kind === 'boss' && WORKOUT.test(e.habit) && gameDay(Date.parse(e.at)) === date).sort((a, b) => (b.damage || 0) - (a.damage || 0))[0];
    let what = ev ? ev.habit.toLowerCase() : 'workout';
    const km = ev && ev.habit === 'Run' && quest && quest.updatedAt === date ? /([\d.]+)\s*km/.exec(quest.latestEvidence || '') : null;
    if (km) what = (Math.round(+km[1] * 10) / 10) + ' km ' + what;
    peak = { i: bi - (n - 28), date, al: L.short[bi] / scale, cl: L.long[bi] / scale, what };
  }
  const K = Pw.ki || {};
  // The Goku card's load chart, as the engine serves it (84 days: long, short, form, ratio, recovery), with only the unlocked moves' marks.
  const load = { from: L.from, long: L.long, short: L.short, form: L.form || [], ratio: L.ratio || null, ratio_bands: L.ratio_bands || null, recovery: L.recovery || null };
  const moves = (Pw.moves || []).filter(m => m && m.name && m.state !== 'locked').map(m => ({ name: m.name, power: m.power, state: m.state }));
  return { clal, peak, ki: { level: K.level || 0, peak: K.peak || 5, heal_cap: K.heal_cap, recovery_bonus: K.recovery_bonus }, now, ratio, load, moves };
}

// ---- Journal and health from the quest D1 (read only) ----
async function rows(db, sql, ...binds) { return ((await db.prepare(sql).bind(...binds).all()).results) || []; }

export async function journalDay(env, day) {
  const db = env.DB;
  const j = (await rows(db, 'SELECT id, win_if, mood_morning, mood_evening FROM journal WHERE date = ? ORDER BY updated_at DESC LIMIT 1', day))[0] || null;
  const focus = j ? await rows(db, 'SELECT grp, position, text, done FROM journal_focus WHERE journal_id = ? ORDER BY grp, position', j.id) : [];
  const group = g => focus.filter(f => f.grp === g).map(f => ({ t: f.text || '', done: !!f.done }));
  const todos = await rows(db, "SELECT task, tag, due FROM todos WHERE status NOT IN ('Done','Completed') AND tag IS NOT NULL AND lower(tag) LIKE '%steph%' ORDER BY due LIMIT 10");
  const work = (await rows(db, 'SELECT am, pm, commute FROM work_location WHERE date = ? LIMIT 1', day))[0] || null;
  const year = day.slice(0, 4);
  const ytd = await rows(db, "SELECT am, pm FROM work_location WHERE date >= ? AND date < ? AND (weekend IS NULL OR weekend = 0)", `${year}-01-01`, day);
  let be = 0, nl = 0;
  for (const w of ytd) for (const v of [w.am, w.pm]) { if (/🇧🇪/.test(v || '')) be += .5; else if (/🇳🇱/.test(v || '')) nl += .5; }
  return {
    win_if: j ? safeText(env, j.win_if) : '', must: group('must').map(x => ({ ...x, t: safeText(env, x.t) })).filter(x => x.t), can: group('can').map(x => ({ ...x, t: safeText(env, x.t) })).filter(x => x.t),
    mood_morning: j && j.mood_morning || null, mood_evening: j && j.mood_evening || null,
    steph: todos.map(t => ({ t: t.task, due: t.due ? t.due.slice(5) : '' })),
    // A row with empty fields (the day not filled in yet) counts as no row.
    work: work && (work.am || work.pm || work.commute) ? { am: work.am || '🇳🇱 Home', pm: work.pm || work.am || '🇳🇱 Home', commute: work.commute || 'N/A' } : null, border: { be, nl }
  };
}

// Recovery comes from the engine's /recovery (the readiness rules, one place for every dashboard).
const SCORE = { good: 85, steady: 56, easy: 28 };
export async function recovery(env) { return recoveryView(await engine(env, '/recovery', { admin: true })); }
export function recoveryView(r) {
  if (!r || !r.ok || !r.verdict) return { last: null, usual: {}, nights: [] };
  return {
    last: { date: r.date, fresh: !!r.fresh, score: SCORE[r.verdict] || 50, verdict: r.verdict, text: r.verdict_text, sub: r.verdict_sub, sleep: r.sleep.value, hrv: r.hrv.value, rhr: r.rhr.value, low: { sleep: !!r.sleep.low, hrv: !!r.hrv.low, rhr: !!r.rhr.low } },
    usual: r.usual || {}, nights: (r.nights || []).filter(n => n.measured !== false && n.verdict).map(n => ({ day: n.date, sleep: n.sleep, hrv: n.hrv, rhr: n.rhr, verdict: n.verdict }))
  };
}

export async function trainingWeek(env, day) {
  const monday = mondayOf(Date.parse(day + 'T12:00:00Z'));
  const list = await rows(env.DB, 'SELECT w.strava_id, w.name, w.start_date_local, w.sport_type_mapped, w.moving_time, w.distance, w.effort_score, w.form_state, s.hr_tss, s.hr_avg, s.z1_min, s.z2_min, s.z3_min, s.z4_min, s.z5_min, s.hr_drift_pct FROM workouts w LEFT JOIN workout_streams s ON s.strava_id = w.strava_id WHERE substr(w.start_date_local, 1, 10) >= ? AND substr(w.start_date_local, 1, 10) <= ? ORDER BY w.start_date_local', monday, day);
  const zones = [0, 0, 0, 0, 0];
  const sessions = list.map(w => {
    const z = [w.z1_min, w.z2_min, w.z3_min, w.z4_min, w.z5_min].map(v => Math.round((v || 0) * 10) / 10);
    z.forEach((v, i) => { zones[i] += v; });
    return { id: w.strava_id, name: w.name, sport: w.sport_type_mapped, day: String(w.start_date_local || '').slice(0, 10), at: String(w.start_date_local || '').slice(11, 16), min: Math.round((w.moving_time || 0) / 60), km: w.distance ? Math.round(w.distance / 100) / 10 : null, tss: w.hr_tss != null ? Math.round(w.hr_tss) : w.effort_score != null ? Math.round(w.effort_score) : null, hr_avg: w.hr_avg != null ? Math.round(w.hr_avg) : null, zones: z, drift: w.hr_drift_pct, form_state: w.form_state };
  });
  const seconds = list.reduce((a, w) => a + (w.moving_time || 0), 0);
  return { hours: Math.round(seconds / 360) / 10, sessions: sessions.length, target: 6, list: sessions, tss: sessions.reduce((a, w) => a + (w.tss || 0), 0), zones: zones.map(v => Math.round(v)) };
}

// ---- Weather for home, cached 15 minutes ----
// Open-Meteo's answer shaped for the tile: now, the day's range, sunrise and sunset, and the next 12 hours.
export function weatherView(w, now = Date.now()) {
  const c = w.current || {}, d = w.daily || {}, h = w.hourly || {};
  const at = (k, i = 0) => (Array.isArray(d[k]) ? d[k][i] : null);
  const stamp = ymd(now) + 'T' + hhmm(now).slice(0, 2) + ':00';
  const times = Array.isArray(h.time) ? h.time : [];
  let i0 = times.findIndex(t => t >= stamp); if (i0 < 0) i0 = 0;
  const hours = times.slice(i0, i0 + 12).map((t, j) => ({ t: t.slice(11, 16), temp: Math.round((h.temperature_2m || [])[i0 + j]), pop: (h.precipitation_probability || [])[i0 + j] ?? null, code: (h.weather_code || [])[i0 + j] ?? null, day: (h.is_day || [])[i0 + j] !== 0 }));
  return {
    temp: c.temperature_2m ?? null, feels: c.apparent_temperature ?? null, code: c.weather_code ?? null, day: c.is_day !== 0, wind: c.wind_speed_10m ?? null,
    hi: at('temperature_2m_max'), lo: at('temperature_2m_min'), rain: at('precipitation_probability_max'),
    sunrise: String(at('sunrise') || '').slice(11, 16), sunset: String(at('sunset') || '').slice(11, 16), hours
  };
}
export async function weather(env, s, now = Date.now()) {
  const key = 'weather:v2';
  const hit = await s.cached(key);
  if (hit) return hit;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${env.WEATHER_LAT || '51.286'}&longitude=${env.WEATHER_LON || '3.828'}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=sunrise,sunset,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=Europe%2FAmsterdam&forecast_days=2`;
    const out = weatherView(await (await fetch(u)).json(), now);
    await s.remember(key, out, 15 * 60e3);
    return out;
  } catch (_) { return null; }
}

// ---- The calendars (published iCloud feeds), cached 10 minutes ----
// The family calendar is the Kids lane (Roy: "the kids is actually the family calendar") and
// fills Coming up; Steph's
// work calendar fills her lane only (daily shifts would drown Coming up); Roy's personal
// calendar fills his lane and Coming up, the kids' calendar theirs. All are published feeds, read only.
const feeds = env => [
  { key: 'family', url: env.FAMILY_ICS_URL, coming: true, opts: { lane: 'kids' } },
  { key: 'steph', url: env.STEPH_ICS_URL, coming: false, opts: { lane: 'steph', kind: 'work', icon: '💼' } },
  { key: 'roy', url: env.ROY_ICS_URL, coming: true, opts: { lane: 'roy', kind: 'mind', icon: '📅' } },
  { key: 'kids', url: env.KIDS_ICS_URL, coming: true, opts: { lane: 'kids', kind: 'fam', icon: '🧒' } }
].filter(f => f.url);
async function feed(f, now) {
  const res = await fetch(String(f.url).replace(/^webcal:/i, 'https:'), { headers: { accept: 'text/calendar' } });
  if (!res.ok) throw new Error(f.key + ' feed ' + res.status);
  return agenda(parseIcs(await res.text()), now, { days: 30, ...f.opts });
}
export async function calendar(env, s, now = Date.now()) {
  const list = feeds(env); if (!list.length) return null;
  // The version in the key drops the cache when the lanes change (v2: the family calendar is Kids).
  const key = 'calendar:v2:' + list.map(f => f.key).join('+'), hit = await s.cached(key);
  if (hit && hit.today === ymd(now)) return hit;
  const got = await Promise.allSettled(list.map(f => feed(f, now)));
  const errors = got.map((g, i) => g.status === 'rejected' ? list[i].key + ': ' + g.reason.message : null).filter(Boolean);
  if (errors.length === list.length) throw new Error(errors.join('; '));
  const out = { today: ymd(now), today_timed: [], upcoming: [], feeds: list.map(f => f.key), errors };
  got.forEach((g, i) => { if (g.status !== 'fulfilled') return; out.today_timed.push(...g.value.today_timed); if (list[i].coming) out.upcoming.push(...g.value.upcoming); });
  out.today_timed.sort((a, b) => a.from.localeCompare(b.from));
  await s.remember(key, out, 10 * 60e3);
  return out;
}

// ---- The week's world as the page sees it ----
// The critter goes to the page only when all three sheets were made; otherwise the drawn cat walks.
export function critterView(c) {
  if (!c || !['walk', 'rest', 'leap'].every(k => c[k] && c[k].public_id)) return null;
  return { name: c.name, walk: spriteUrl(c.walk.public_id, c.walk.version), rest: spriteUrl(c.rest.public_id, c.rest.version), leap: spriteUrl(c.leap.public_id, c.leap.version) };
}
export function themeView(row, next, critter = null) {
  if (!row) return null;
  return {
    week: row.week, franchise: row.franchise, scene: row.scene, character: row.character, look: row.look, palette: row.palette, status: row.status, error: row.error || null,
    still: row.still_public_id ? stillUrl169(row.still_public_id, row.still_version) : null,
    clip: row.clip_public_id ? clipUrl(row.clip_public_id, row.clip_version) : null,
    critter: critterView(critter),
    next: next ? { week: next.week, franchise: next.franchise, scene: next.scene, character: next.character, palette: next.palette } : null
  };
}

// Everything the page needs, in one object. Each source fails on its own, so one
// outage never blanks the screen.
export async function board(env, s, now = Date.now()) {
  const day = ymd(now), errors = [];
  const safe = (label, p, fallback) => p.catch(err => { errors.push(`${label}: ${err.message}`); return fallback; });
  const [boss, hero, mq, questboard, journal, sleep, week, wx, dayState, cal] = await Promise.all([
    safe('boss', engine(env, '/boss'), null), safe('hero', engine(env, '/hero'), null), safe('mainquest', engine(env, '/mainquest'), null), safe('questboard', engine(env, '/questboard'), []),
    safe('journal', journalDay(env, day), { win_if: '', must: [], can: [], steph: [], work: null, border: { be: 0, nl: 0 } }),
    safe('recovery', recovery(env), { last: null, usual: {}, nights: [] }), safe('workouts', trainingWeek(env, day), { hours: 0, sessions: 0, target: 6, list: [], tss: 0, zones: [0, 0, 0, 0, 0] }),
    safe('weather', weather(env, s, now), null), s.day(day), safe('calendar', calendar(env, s, now), null)
  ]);
  const focusQuest = (questboard || []).find(q => q.questAttention === 'Focus') || (questboard || [])[0] || null;
  const P = power(mq, hero, focusQuest);
  const edits = dayState && dayState.data || emptyDay();
  return {
    today: day, now: hhmm(now), week: isoWeek(now), errors,
    main: mainHabits(boss, hero, now), boss: bossView(env, boss, mq, hero),
    quest: focusQuest ? { title: focusQuest.questTitle, phase: focusQuest.questPhase, next_move: focusQuest.nextMove, target: focusQuest.targetDate, days_left: focusQuest.targetDate ? Math.round((Date.parse(focusQuest.targetDate + 'T12:00:00Z') - Date.parse(day + 'T12:00:00Z')) / DAY) : null, evidence: focusQuest.latestEvidence, check: focusQuest.passFailQuestion, quote: safeText(env, focusQuest.quote), author: safeText(env, focusQuest.quoteAuthor), longest_km: (/([\d.]+)\s*km/.exec(focusQuest.latestEvidence || '') || [])[1] ? +(/([\d.]+)\s*km/.exec(focusQuest.latestEvidence || '')[1]) : null, goal_km: /half marathon/i.test(focusQuest.questTitle || '') ? 21.1 : null } : null,
    journal, fitness: { recovery: sleep.last, usual: sleep.usual, nights: sleep.nights, clal: P.clal, peak: P.peak, ki: P.ki, now: P.now, ratio: P.ratio, load: P.load, moves: P.moves, week },
    weather: wx ? { ...wx, place: env.WEATHER_PLACE || 'Home' } : wx, calendar: cal, edits, undo: !!(dayState && dayState.undo)
  };
}
