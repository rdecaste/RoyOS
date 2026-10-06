// Commute days, written through the admin board. work_location lives in the quest D1, which Roy OS
// only reads; the admin dashboard owns its writes (POST /border/save, the calendar's "tap a day").
// A day set on Roy OS goes there over the ADMIN_BOARD service binding, signed in with the board's
// own cookie scheme (ADMIN_PASSWORD is the dashboard's DASHBOARD_PASSWORD). Once the board has it,
// Roy OS drops its own copy, so both screens read the same row (Roy, 6 Oct 2026).

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const FIELDS = ['am', 'pm', 'commute'];

// The admin dashboard's session cookie (its src/auth.js): admin_session=<expires>.<HMAC of "admin:<expires>">.
export async function adminCookie(secret, now = Date.now()) {
  const expires = Math.floor(now / 1000) + 600;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `admin_session=${expires}.${hex(await crypto.subtle.sign('HMAC', key, enc.encode('admin:' + expires)))}`;
}

export const isWeekday = day => { const d = new Date(day + 'T12:00:00Z').getUTCDay(); return d >= 1 && d <= 5; };

// What to send for the days Roy OS holds. overwrite (a change Roy just made): every field he set.
// Otherwise (catching up on days set before the sync existed) only the fields the board's row
// leaves empty, so nothing filled in on the admin board is replaced. Weekends stay on Roy OS:
// the board keeps no weekend rows.
export function workToSend(desk, rows, { overwrite = false } = {}) {
  const by = new Map((rows || []).map(r => [r.date, r]));
  const days = [], done = [];
  for (const w of desk || []) {
    if (!w || !w.date || !isWeekday(w.date)) continue;
    const row = by.get(w.date) || {}, d = { date: w.date };
    for (const f of FIELDS) if (w[f] && (overwrite || !row[f])) d[f] = w[f];
    if (Object.keys(d).length > 1) days.push(d); else done.push(w.date);
  }
  return { days, done };
}

// Sends days to the admin board; answers {ok, saved: [dates], failed: [{date, message}]}.
export async function saveToBoard(env, days, now = Date.now()) {
  if (!days.length) return { ok: 1, saved: [], failed: [] };
  const fail = message => ({ ok: 0, saved: [], failed: days.map(d => ({ date: d.date, message })) });
  if (!env.ADMIN_BOARD || !env.ADMIN_PASSWORD) return fail('ADMIN_BOARD or ADMIN_PASSWORD is not set');
  const r = await env.ADMIN_BOARD.fetch(new Request('https://admindashboard/border/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: await adminCookie(env.ADMIN_PASSWORD, now) }, body: JSON.stringify({ days })
  }));
  const out = await r.json().catch(() => null);
  if (!out) return fail('admin board answered ' + r.status);
  if (out.code === 'signed_out') return fail('admin board refused the sign-in: ADMIN_PASSWORD is not its DASHBOARD_PASSWORD');
  return { ok: out.ok ? 1 : 0, saved: out.saved || [], failed: out.failed || [] };
}

// Moves the days Roy OS holds (all of them, or only `days`) to the admin board and drops each one
// the board took. A day the board refuses stays on Roy OS and is tried again on the next load.
export async function syncWork(env, s, today, { days = null, overwrite = false } = {}) {
  const from = days ? days.reduce((a, b) => (a < b ? a : b)) : today.slice(0, 4) + '-01-01';
  const desk = (await s.works(from, nextDay(today))).filter(w => !days || days.includes(w.date));
  if (!desk.length) return { ok: 1, saved: [], failed: [] };
  const rows = await env.DB.prepare(`SELECT date, am, pm, commute FROM work_location WHERE date IN (${desk.map(() => '?').join(',')})`).bind(...desk.map(w => w.date)).all().then(r => r.results || []);
  const send = workToSend(desk, rows, { overwrite });
  const out = await saveToBoard(env, send.days);
  for (const day of [...out.saved, ...send.done]) await s.clearWork(day);
  if (out.failed.length) console.error('work sync: ' + out.failed.map(f => f.date + ' ' + f.message).join('; '));
  return out;
}

const nextDay = day => new Date(Date.parse(day + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
