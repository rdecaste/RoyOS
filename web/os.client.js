// Roy OS, in the browser. Widgets stay glanceable; hover shows details, a click opens
// the app's window. Edits go to /act and come back as the day's edits; the board
// refreshes from /data every minute. (Imported as text and inlined in the page.)
(() => {
'use strict';
let D = window.DESK;
const TZ = 'Europe/Amsterdam';
const $ = id => document.getElementById(id);
const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Time ----
const HM = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const now = () => Date.now();
const hm = (ms = now()) => HM.format(new Date(ms));
const minAt = ms => { const [h, m] = hm(ms).split(':').map(Number); return h * 60 + m; };
const nowMin = () => minAt(now());
const minOf = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const hhmm = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const gm = m => (m - 240 + 1440) % 1440;
const dur = min => { min = Math.max(0, Math.round(min)); const h = Math.floor(min / 60), m = min % 60; return h ? h + 'h' + (m ? ' ' + String(m).padStart(2, '0') + 'm' : '') : m + 'm'; };
const sleepTxt = h => { if (h == null) return '–'; const m = Math.round(h * 60); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0'); };
const one = n => (n == null ? '–' : String(Math.round(n * 10) / 10));
const pct = (a, b) => (a > 0 && b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0);
const phaseOf = m => { const h = Math.floor(m / 60); return h >= 23 || h < 4 ? 'night' : h < 10 ? 'morning' : h < 18 ? 'day' : 'evening'; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const wdShort = d => new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const dayFmt = d => { const x = new Date(d + 'T12:00:00Z'); return wdShort(d) + ' ' + x.getUTCDate() + ' ' + MON[x.getUTCMonth()]; };
const ymdAdd = (d, k) => new Date(Date.parse(d + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const DAY0 = 6, DAY1 = 23;
const xOf = min => Math.max(0, Math.min(100, (min / 60 - DAY0) / (DAY1 - DAY0) * 100));

// ---- Icons and apps ----
const P = {
  logo: '<path d="M12 2.8 21.2 12 12 21.2 2.8 12Z"/><path d="M12 8.3 15.7 12 12 15.7 8.3 12Z"/>',
  focus: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r=".8"/>',
  habits: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="m8 12.4 2.8 2.8 5.6-5.8"/>',
  body: '<path d="M2.8 12.5h4l2-4.6 3.4 9.6 2.3-5h6.7"/>',
  mood: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14.2c1.9 2.1 4.9 2.1 6.8 0"/><path d="M9.2 9.7h.01M14.8 9.7h.01" stroke-width="2.6"/>',
  commute: '<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="m6 16 3.6-6.6h5.2L18 16M9.6 9.4 12.8 16M13.4 6.2h2.8"/>',
  steph: '<rect x="3" y="5.5" width="18" height="13" rx="2.6"/><path d="m3.8 7.2 8.2 6 8.2-6"/>',
  dates: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8.2 3v4M15.8 3v4"/>',
  quest: '<path d="M5.5 21V3.8"/><path d="M5.5 4.6c4.6-2.4 8 2.4 13 0v8.6c-5 2.4-8.4-2.4-13 0"/>',
  day: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7 9.5h5.5M9.5 14.2h7.5"/>',
  claude: '<path d="M12 2.8c.6 4.9 4.3 8.6 9.2 9.2-4.9.6-8.6 4.3-9.2 9.2-.6-4.9-4.3-8.6-9.2-9.2 4.9-.6 8.6-4.3 9.2-9.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  cloud: '<path d="M7.5 18.5h9.8a3.9 3.9 0 0 0 .3-7.8 5.6 5.6 0 0 0-10.8 1.4 3.2 3.2 0 0 0 .7 6.4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', chev: '<path d="m9.5 6 6 6-6 6"/>'
};
P.os = P.logo;
const icon = n => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>';
const APPS = [['focus', 'Focus', '#f6c045'], ['habits', 'Main habits', '#3ddc84'], ['body', 'Body', '#ff7a7a'], ['mood', 'Mood', '#7ee0c3'],
  ['commute', 'Commute', '#6fd8ff'], ['steph', 'From Steph', '#ff7ac8'], ['dates', 'Coming up', '#ff9f5a'], ['quest', 'Quest', '#8fb8ff']];
const APP = Object.fromEntries(APPS.map(([k, name, ac]) => [k, { name, ac }]));
APP.day = { name: 'Your day', ac: '#5b93f0' }; APP.claude = { name: 'Claude', ac: '#b18cff' }; APP.os = { name: 'Roy OS', ac: '#6fd8ff' };

// ---- The board's state: the server's data plus the day's edits ----
const ICON = { work: '💼', move: '🚲', train: '🏃', fam: '👪', mind: '📓' };
const WHO = { roy: 'Roy', steph: 'Steph', kids: 'Kids', all: 'Everyone' };
const FEEL = ['Sucky', 'Tired', 'Normal', 'Good', 'On fire'];
const PLACES = ['🇳🇱 Home', '🇧🇪 Beerse', '🇧🇪 Ghent', '✈️ Travel', '🏖️ Holiday', '🎉 Public holiday'];
const RIDES = ['🚲 E-bike', '🚗 Car', '✈️ Plane', 'N/A'];
let E = D.edits;
const EVENTS = () => (Array.isArray(E.events) ? E.events : []);
const ticked = x => (E.ticks[x.t] != null ? E.ticks[x.t] : !!x.done);
const focusList = g => E.added.filter(a => a.g === g).map(a => ({ t: a.t, done: !!E.ticks[a.t], added: true })).concat((D.journal[g] || []).map(x => ({ t: x.t, done: ticked(x) })));
const stephList = () => D.journal.steph.map(x => ({ t: x.t, due: x.due, done: !!E.ticks[x.t] }));
const workToday = () => E.work || D.journal.work || { am: '🇳🇱 Home', pm: '🇳🇱 Home', commute: 'N/A' };
let WIN = null, popPick = 0, moodPick = 0, lastPhase = null, clockPhase = null;

// Main habits: done when logged today (or ticked here), otherwise due, late or later by the usual time.
function habitState(x, m) {
  if (m == null) m = nowMin();
  const manual = E.habits[x.name];
  let at = null;
  if (typeof manual === 'string') at = manual;
  else if (manual !== false && x.done && x.at && gm(minOf(x.at)) <= gm(m)) at = x.at;
  if (at) return { st: 'done', at };
  const u = gm(minOf(x.usual)), n = gm(m);
  return { st: n > u + 60 ? 'late' : n >= u - 30 ? 'due' : 'later' };
}
const habitLine = (x, s) => (s.st === 'done' ? 'Done at ' + s.at : s.st === 'due' ? 'Due now · usually ' + x.usual : s.st === 'late' ? 'Late · usually ' + x.usual : 'Later · usually ' + x.usual);

// Body
const F = () => D.fitness;
const R = () => F().recovery;
const L = () => F().clal, LAST = () => L()[L().length - 1], PREV = () => L()[L().length - 2];
const REC_LABEL = { good: ['Good', 'Good to train', 'All three on your usual or better'], steady: ['Moderate', 'Go steady', 'Easy session only, skip anything hard'], easy: ['Low', 'Rest day', 'Two of three below your usual'] };
const recColor = s => (s >= 67 ? 'var(--good)' : s >= 34 ? 'var(--warn)' : 'var(--bad)');
const ratioOf = d => Math.round(d.al / d.cl * 100) / 100;
const RZ = [[0.8, 'Low', '#3f8fe8'], [1.3, 'Optimal', '#3ddc84'], [1.5, 'High', '#ff9a2e'], [9, 'Risk', '#ef4b4b']];
const zoneOf = r => RZ.find(z => r <= z[0]);
const RSAY = { Low: 'Low: you train less than your body is used to, so fitness slowly fades.', Optimal: 'Balanced: ideal for progress with a low injury risk.', High: 'High: keep the next sessions easy and watch your recovery.', Risk: 'Risk zone: back off for a few days to avoid an injury.' };
const ratioPos = r => (r <= .8 ? Math.max(2, (r - .5) / .3 * 20) : r <= 1.3 ? 20 + (r - .8) / .5 * 40 : r <= 1.5 ? 60 + (r - 1.3) / .2 * 25 : Math.min(98, 85 + (r - 1.5) / .5 * 15));
const trend = (v, u, upGood, thr) => { if (v == null || u == null) return ''; const d = v - u; if (Math.abs(d) < thr) return '<span class="tr good">=</span>'; const up = d > 0; return '<span class="tr ' + (up === upGood ? 'good' : 'bad') + '">' + (up ? '↑' : '↓') + '</span>'; };
const kiState = k => (k.level >= k.peak ? 'Full power' : k.level ? 'Charging' : 'Empty');
const NIGHTC = { good: '#3ddc84', steady: '#ffc24a', easy: '#ff5f6d' };
const SPORT = { Run: '🏃', Ride: '🚴', VirtualRide: '🚴', Swim: '🏊', WeightTraining: '🏋️', Walk: '🚶', Hike: '🥾', Rowing: '🚣' };
const ZONEC = ['#5b93f0', '#3ddc84', '#ffd23f', '#ff9a2e', '#ff5f6d'];
const FORMC = { Rusty: '#8fa3c7', Steady: '#3ddc84', Building: '#ffd23f', Overreaching: '#ff5f6d' };
const formChip = () => { const n = F().now; return n && n.form_state ? '<span class="zchip" style="background:' + (FORMC[n.form_state] || '#8fa3c7') + '22;color:' + (FORMC[n.form_state] || '#8fa3c7') + '">' + esc(n.form_state) + '</span>' : ''; };
// Minutes per heart-rate zone this week (Z1 to Z5), as one bar.
const zoneBar = z => { const t = (z || []).reduce((a, b) => a + b, 0); if (!t) return ''; return '<div class="bbar" style="margin-top:.5rem">' + z.map((m, i) => '<i style="width:' + (m / t * 100) + '%;background:' + ZONEC[i] + '" title="Z' + (i + 1) + ' ' + m + ' min"></i>').join('') + '</div><div class="legend" style="margin-top:.3rem">' + z.map((m, i) => '<span><i style="background:' + ZONEC[i] + '"></i>Z' + (i + 1) + ' ' + m + '′</span>').join('') + '</div>'; };
const NIGHTW = { good: 'Good to train', steady: 'Train with care', easy: 'Rest day' };

// Commute
const placeName = v => String(v || '').replace(/^\S+\s/, '');
const isBE = v => /🇧🇪/.test(v || ''), isNL = v => /🇳🇱/.test(v || '');
function border() {
  const B = D.journal.border, T = workToday();
  const be = B.be + (isBE(T.am) ? .5 : 0) + (isBE(T.pm) ? .5 : 0), nl = B.nl + (isNL(T.am) ? .5 : 0) + (isNL(T.pm) ? .5 : 0);
  return { be, nl, share: be + nl ? Math.round(be / (be + nl) * 100) : 0, spare: Math.floor(be - nl) };
}
const workPlace = () => { const T = workToday(); return T.am === T.pm ? T.am : T.am + ' → ' + placeName(T.pm); };

const faceImg = (m, alt) => '<img src="' + D.moodArt[m - 1] + '" alt="' + esc(alt == null ? FEEL[m - 1] : alt) + '">';
const moodsSoFar = () => E.moods.slice();
const lastMood = () => { const so = moodsSoFar(); return so[so.length - 1] || null; };
function laneNow(who, m) {
  const evs = EVENTS().filter(e => e.who === who || e.who === 'all').map(e => ({ ...e, a: minOf(e.from), z: minOf(e.to) })).sort((p, q) => p.a - q.a);
  return { cur: evs.find(e => e.a <= m && m < e.z), next: evs.find(e => e.a > m) };
}
const WMO = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunder' };

// ---- Server calls ----
async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 401) { location.href = '/login?next=/'; throw new Error('signed out'); }
  const out = await r.json().catch(() => ({}));
  if (!out.ok) throw Object.assign(new Error(out.message || out.code || 'failed'), { code: out.code });
  return out;
}
let acting = Promise.resolve();
function act(action, after) {
  // Edits are applied locally first, then sent; the server's copy wins when it answers.
  acting = acting.then(() => post('/act', action)).then(out => { E = out.edits; $('liveTag').textContent = 'Live'; if (after) after(out); renderAll(); refreshWin(); }).catch(err => { if (err.message !== 'signed out') notify({ app: 'os', html: 'Could not save that: ' + esc(err.message) }); });
  return acting;
}
async function refresh() {
  try {
    const r = await fetch('/data', { headers: { Accept: 'application/json' } });
    if (r.status === 401) { location.href = '/login?next=/'; return; }
    const out = await r.json();
    if (!out.ok) throw new Error(out.message || out.code);
    const art = D.moodArt; D = out; D.moodArt = art; E = D.edits;
    $('liveTag').textContent = 'Live'; $('liveTag').classList.remove('stale');
    applyTheme(D.theme); renderAll(); refreshWin(); nudges();
  } catch (err) { $('liveTag').textContent = 'Stale'; $('liveTag').classList.add('stale'); }
}

// ---- Charts ----
// The load chart: the last `days` of the 28 kept, with the y axis fitted tightly to what is shown.
function loadSvg(H, grid, days) {
  const all28 = L(), off = Math.max(0, all28.length - (days || 28)), Ld = all28.slice(off), n = Ld.length; if (n < 2) return '<div class="say">No load data yet.</div>';
  const W = 300, all = Ld.flatMap(d => [d.cl * 1.1, d.al, d.cl * .9]), lo = Math.min(...all) * .97, hi = Math.max(...all) * 1.02 || 1;
  const x = i => 4 + i / (n - 1) * (W - 8), y = v => 4 + (1 - (v - lo) / (hi - lo || 1)) * (H - 8);
  const line = k => Ld.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1)).join(' ');
  const band = Ld.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.cl * 1.1).toFixed(1)).join(' ') + ' ' + Ld.slice().reverse().map((d, i) => 'L' + x(n - 1 - i).toFixed(1) + ' ' + y(d.cl * .9).toFixed(1)).join(' ') + 'Z';
  const lines = grid ? [7, 14, 21].filter(k => k < n).map(k => '<line x1="' + x(n - 1 - k) + '" x2="' + x(n - 1 - k) + '" y1="0" y2="' + H + '" stroke="rgba(238,243,255,.08)" stroke-width="1" vector-effect="non-scaling-stroke"/>').join('') : '';
  const px = i => (x(i) / W * 100) + '%', py = v => (y(v) / H * 100) + '%', last = Ld[n - 1], Pk = F().peak;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + lines + '<path d="' + band + '" fill="rgba(63,216,232,.16)"/>' +
    '<path d="' + line('al') + '" fill="none" stroke="#a28bff" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
    '<path d="' + line('cl') + '" fill="none" stroke="#3fd8e8" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  s += '<span class="pt" style="--c:#a28bff;left:' + px(n - 1) + ';top:' + py(last.al) + '"></span><span class="pt" style="--c:#3fd8e8;left:' + px(n - 1) + ';top:' + py(last.cl) + '"></span>';
  if (Pk && Pk.i - off >= 0) s += '<span class="pt peak" style="left:' + px(Pk.i - off) + ';top:' + py(Pk.al) + '"></span>';
  return s + '<i class="xh"></i>';
}
function loadTip(i) {
  const d = L()[i], r = ratioOf(d), z = zoneOf(r), Pk = F().peak, peak = Pk && Pk.i === i;
  return '<span class="tt">' + (i === L().length - 1 ? 'Today' : dayFmt(d.date)) + '</span><div class="kv"><span>Long term</span><b class="lt-c">' + one(d.cl) + '</b><span></span><span>Short term</span><b class="st-c">' + one(d.al) + '</b><span></span><span>Ratio</span><b style="color:' + z[2] + '">' + r.toFixed(2) + '</b><span class="mut">' + z[1] + '</span></div>' + (peak ? '<span class="hint">Peak of the week: ' + esc(Pk.what) + '</span>' : '');
}
function nightsSvg() {
  const N = F().nights, W = 300, H = 90, n = N.length; if (!n) return '<div class="say">No nights yet.</div>';
  const bw = W / n, ys = h => H - (h || 0) / 9 * (H - 6);
  const hv = N.map(d => d.hrv).filter(v => v != null), lo = (hv.length ? Math.min(...hv) : 40) - 4, hi = (hv.length ? Math.max(...hv) : 60) + 4;
  const yh = v => 6 + (1 - (v - lo) / (hi - lo || 1)) * (H - 26);
  const bars = N.map((d, i) => '<rect x="' + (i * bw + bw * .18).toFixed(1) + '" width="' + (bw * .64).toFixed(1) + '" y="' + ys(d.sleep).toFixed(1) + '" height="' + (H - ys(d.sleep)).toFixed(1) + '" rx="2" fill="' + NIGHTC[d.verdict] + '" fill-opacity="' + (i === n - 1 ? .95 : .55) + '"/>').join('');
  const line = N.filter(d => d.hrv != null).map((d, i, arr) => (i ? 'L' : 'M') + (N.indexOf(d) * bw + bw / 2).toFixed(1) + ' ' + yh(d.hrv).toFixed(1)).join(' ');
  const usual = F().usual.sleep;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + bars + (usual ? '<line x1="0" x2="' + W + '" y1="' + ys(usual).toFixed(1) + '" y2="' + ys(usual).toFixed(1) + '" stroke="rgba(238,243,255,.45)" stroke-dasharray="3 3" stroke-width="1" vector-effect="non-scaling-stroke"/>' : '') +
    '<path d="' + line + '" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><i class="xh"></i>';
}
function nightTip(i) {
  const d = F().nights[i], U = F().usual;
  return '<span class="tt">' + (i === F().nights.length - 1 ? 'Last night' : dayFmt(d.day)) + '</span><b style="color:' + NIGHTC[d.verdict] + '">' + NIGHTW[d.verdict] + '</b><div class="kv"><span>Sleep</span><b>' + sleepTxt(d.sleep) + '</b><span class="mut">usual ' + sleepTxt(U.sleep) + '</span><span>HRV</span><b>' + (d.hrv == null ? '–' : d.hrv + ' ms') + '</b><span class="mut">usual ' + one(U.hrv) + '</span><span>Resting HR</span><b>' + (d.rhr == null ? '–' : d.rhr) + '</b><span class="mut">usual ' + one(U.rhr) + '</span></div>';
}
function ratioBar() {
  if (L().length < 2) return '';
  const r = ratioOf(LAST()), z = zoneOf(r), rp = ratioOf(PREV());
  return '<div class="ratiobar">' + (Math.abs(rp - r) >= .03 ? '<span class="ghost" style="left:' + ratioPos(rp) + '%"></span>' : '') + [20, 60, 85].map(v => '<span class="tk" style="left:' + v + '%"></span>').join('') + '<span class="pill" style="left:' + ratioPos(r) + '%;background:' + z[2] + '">' + r.toFixed(2) + '</span></div>';
}
const R_LABELS = '<div class="rlabels">' + [['Low', 10, '#3f8fe8'], ['Optimal', 40, '#3ddc84'], ['High', 72.5, '#ff9a2e'], ['Risk', 92.5, '#ef4b4b']].map(([t, l, c]) => '<span style="left:' + l + '%;color:' + c + '">' + t + '</span>').join('') + '</div>';
const pips = k => '<div class="pips">' + Array.from({ length: k.peak }, (_, i) => '<i class="' + (i < k.level ? 'on' : '') + '"></i>').join('') + '</div>';
const todoBtn = (x, g, cls) => '<button type="button" class="todo' + (x.done ? ' done' : '') + (x.added ? ' new' : '') + (cls ? ' ' + cls : '') + '" data-act="todo" data-g="' + g + '" data-t="' + esc(x.t) + '" role="checkbox" aria-checked="' + !!x.done + '"><span class="chk"></span><span class="tx">' + esc(x.t) + '</span>' + (x.due && !x.done ? '<em>' + esc(x.due) + '</em>' : '<span></span>') + '</button>';

// ---- Tooltips ----
const TIPS = {
  recovery: () => { const r = R(); if (!r) return '<span class="tt">Recovery</span>No night synced yet.'; const U = F().usual, lab = REC_LABEL[r.verdict];
    return '<span class="tt">Recovery · ' + (r.fresh ? 'last night' : 'night to ' + dayFmt(r.date)) + '</span><b style="color:' + recColor(r.score) + '">' + lab[0] + ' · ' + lab[1] + '</b><div class="kv"><span>Sleep</span><b>' + sleepTxt(r.sleep) + '</b><span class="mut">usual ' + sleepTxt(U.sleep) + '</span><span>HRV</span><b>' + (r.hrv == null ? '–' : r.hrv + ' ms') + '</b><span class="mut">usual ' + one(U.hrv) + '</span><span>Resting HR</span><b>' + (r.rhr == null ? '–' : r.rhr) + '</b><span class="mut">usual ' + one(U.rhr) + '</span></div><span class="hint">' + lab[2] + '. Tap for the last 7 nights.</span>'; },
  load: () => { const n = F().now; return L().length ? '<span class="tt">Training load' + (n && n.form_state ? ' · ' + esc(n.form_state) : '') + '</span><b class="lt-c">Long term ' + one(LAST().cl) + '</b> is your fitness (42-day), <b class="st-c">short term ' + one(LAST().al) + '</b> your fatigue (7-day).' + (F().week.tss ? '<br>This week: TSS ' + Math.round(F().week.tss) + ' in ' + F().week.sessions + ' session' + (F().week.sessions === 1 ? '' : 's') + '.' : '') + '<span class="hint">Hover the chart for each day of the last 4 weeks.</span>' : ''; },
  ratio: () => { if (L().length < 2) return ''; const r = ratioOf(LAST()), z = zoneOf(r), rp = ratioOf(PREV()), Pk = F().peak, why = Pk && Pk.date === PREV().date ? ' after the ' + esc(Pk.what) : '';
    return '<span class="tt">Load ratio · short ÷ long term</span><b style="color:' + z[2] + '">' + r.toFixed(2) + ' · ' + z[1] + '</b><br>' + esc(RSAY[z[1]]) + '<span class="hint">Yesterday ' + rp.toFixed(2) + why + '. Low under 0.8, optimal to 1.3, high to 1.5, risk above.</span>'; },
  ki: () => { const k = F().ki; return k ? '<span class="tt">Ki charge</span><b>' + k.level + ' of ' + k.peak + ' · ' + kiState(k) + '</b><div class="kv"><span>Healing cap</span><b>' + (k.heal_cap || '–') + ' HP</b><span></span><span>Overnight bonus</span><b>+' + Math.round((k.recovery_bonus || 0) * 100) + '%</b><span></span></div>' : ''; },
  commute: () => { const b = border(), T = workToday(); return '<span class="tt">Commute</span><div class="kv"><span>Morning</span><b>' + esc(T.am) + '</b><span></span><span>Afternoon</span><b>' + esc(T.pm) + '</b><span></span><span>Ride</span><b>' + esc(T.commute) + '</b><span></span></div><span class="hint">' + b.share + '% of this year’s work days in Belgium (minimum 50%), ' + b.spare + ' days to spare. Tap to change today.</span>'; },
  steph: () => { const open = stephList().filter(x => !x.done); return '<span class="tt">From Steph</span>' + (open.length ? '<ul>' + open.map(x => '<li>' + esc(x.t) + (x.due ? ' <span class="mut">· ' + esc(x.due) + '</span>' : '') + '</li>').join('') + '</ul>' : 'Nothing open. To-dos tagged Steph in the journal land here.'); },
  dates: () => '<span class="tt">Coming up</span>Birthdays and important dates will come from the shared calendar.',
  quest: () => { const q = D.quest; return q ? '<span class="tt">Quest · ' + esc(q.phase) + ' phase</span><b>' + esc(q.title) + '</b><br><span class="mut">Next move:</span> ' + esc(q.next_move) + (q.longest_km && q.goal_km ? '<span class="hint">Longest run ' + q.longest_km + ' of ' + q.goal_km + ' km · ' + q.days_left + ' days to go</span>' : '') : ''; },
  weather: () => { const w = D.weather; return w ? '<span class="tt">Weather at home</span><b>' + Math.round(w.temp) + '° · ' + esc(WMO[w.code] || '') + '</b><br>' + (w.rain != null ? w.rain + '% chance of rain · ' : '') + 'sunset ' + esc(w.sunset) : ''; },
  mode: () => '<span class="tt">Mode</span>' + { morning: 'Morning habits until 10:00.', day: 'Daytime habits until 18:00.', evening: 'Evening habits until 04:00.', night: 'Night. The screen dims until morning.' }[phaseOf(nowMin())],
  habit: el => { const x = D.main[+el.dataset.i], s = habitState(x); return '<span class="tt">Main habit</span><b>' + esc(x.icon + ' ' + x.name) + '</b><br>' + habitLine(x, s) + (x.streak >= 2 ? '<br><span class="mut">🔥 ' + x.streak + '-day streak</span>' : '') + '<span class="hint">Tap to ' + (s.st === 'done' ? 'untick' : 'tick it off') + '</span>'; },
  lastmood: () => { const m = lastMood(); return m ? '<span class="tt">Last logged · ' + hhmm(m.at) + '</span><b>' + FEEL[m.m - 1] + '</b>' + (m.note ? '<br>' + esc(m.note) : '') : 'No mood logged yet today'; },
  blk: el => { const e = EVENTS().find(x => x.id === el.dataset.id); if (!e) return ''; return '<span class="tt">' + esc(WHO[e.who] || '') + ' · ' + e.from + '–' + e.to + ' · ' + dur(minOf(e.to) - minOf(e.from)) + '</span><b>' + esc((e.ic || '') + ' ' + e.t) + '</b><span class="hint">Tap to edit</span>'; },
  theme: () => { const t = D.theme; if (!t) return '<span class="tt">This week’s world</span>Not made yet.'; return '<span class="tt">This week’s world · ' + esc(t.week) + '</span><b>' + esc(t.franchise) + ' · ' + esc(t.scene) + '</b><br>' + esc(t.character) + (t.status !== 'ready' ? ' · ' + esc(t.status) : '') + '<span class="hint">New video every Monday morning, random franchise, random scene and character. The colours of the board follow it.</span>'; }
};
const tip = $('tip');
let tipFor = null;
function placeTip(x, top, bottom) {
  const r = tip.getBoundingClientRect(), m = 8, bar = document.querySelector('.menubar'), minTop = (bar ? bar.getBoundingClientRect().bottom : 0) + 6;
  const left = Math.max(m, Math.min(innerWidth - r.width - m, x - r.width / 2));
  let y = top - r.height - 10; if (y < minTop && top > minTop) y = Math.min(innerHeight - r.height - m, bottom + 10); if (y < m) y = Math.min(innerHeight - r.height - m, bottom + 10);
  tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(y) + 'px)';
}
function showTipAt(html, x, top, bottom) { if (!html) { hideTip(); return; } tip.innerHTML = html; tip.classList.add('show'); placeTip(x, top, bottom); }
function showTip(html, el) { const r = el.getBoundingClientRect(); showTipAt(html, r.left + r.width / 2, r.top, r.bottom); }
function hideTip(keep) { tip.classList.remove('show'); if (!keep) tipFor = null; }
const tipHtml = el => { const k = el.dataset.tip; return k.charAt(0) === '@' ? (TIPS[k.slice(1)] ? TIPS[k.slice(1)](el) : '') : esc(k); };
document.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const el = e.target.closest('[data-tip]'); if (!el || el === tipFor) return; tipFor = el; showTip(tipHtml(el), el); });
document.addEventListener('pointerout', e => {
  const to = e.relatedTarget;
  if (tipFor && !(to && tipFor.contains(to))) hideTip();
  const ch = e.target.closest('[data-chart]'); if (ch && !(to && ch.contains(to))) { const xh = ch.querySelector('.xh'); if (xh) xh.style.opacity = 0; hideTip(); }
  const tr = e.target.closest('.track'); if (tr && !(to && tr.contains(to))) hideTip();
});
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const ch = e.target.closest('[data-chart]'); if (ch) { chartHover(ch, e); return; }
  const tr = e.target.closest('.track');
  if (tr && !e.target.closest('.blk')) { const r = tr.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); const start = Math.min(DAY1 * 60 - 60, Math.round((DAY0 * 60 + f * (DAY1 - DAY0) * 60) / 15) * 15); showTipAt('<b>+ Add</b> for ' + WHO[tr.dataset.who] + ' at ' + hhmm(start), e.clientX, r.top, r.bottom); }
});
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el && e.target.matches(':focus-visible')) { tipFor = el; showTip(tipHtml(el), el); } });
document.addEventListener('focusout', () => hideTip());
document.addEventListener('pointerdown', () => hideTip(true));
function chartHover(el, e) {
  const r = el.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), xh = el.querySelector('.xh');
  if (el.dataset.chart === 'load') { const days = +el.dataset.days || 28, off = Math.max(0, L().length - days), n = L().length - off; if (n < 2) return; const W = 300, i = Math.max(0, Math.min(n - 1, Math.round((f * W - 4) / (W - 8) * (n - 1)))); if (xh) { xh.style.left = ((4 + i / (n - 1) * (W - 8)) / W * 100) + '%'; xh.style.opacity = 1; } showTipAt(loadTip(off + i), e.clientX, r.top, r.bottom); }
  else { const n = F().nights.length; if (!n) return; const i = Math.max(0, Math.min(n - 1, Math.floor(f * n))); if (xh) { xh.style.left = ((i + .5) / n * 100) + '%'; xh.style.opacity = 1; } showTipAt(nightTip(i), e.clientX, r.top, r.bottom); }
}

// ---- Notifications ----
const NOTED = new Set();
function notify(o) {
  if (o.key) { if (NOTED.has(o.key)) return; NOTED.add(o.key); }
  const a = APP[o.app] || APP.os, el = document.createElement('div');
  el.className = 'note' + (o.open ? ' link' : ''); el.style.setProperty('--ac', a.ac);
  el.innerHTML = '<div class="nico">' + icon(o.app) + '</div><div><div class="nt"><span>' + esc(o.title || a.name) + '</span><span>' + hm() + '</span></div><div class="nb">' + o.html + '</div></div><button type="button" class="nx" aria-label="Dismiss">' + icon('x') + '</button>';
  const box = $('notes'); box.prepend(el); qa('.note', box).slice(3).forEach(n => n.remove());
  let timer = null;
  const go = () => { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 320); };
  const arm = ms => { clearTimeout(timer); timer = setTimeout(go, ms); };
  arm(o.ttl || 7000);
  el.addEventListener('pointerenter', () => clearTimeout(timer)); el.addEventListener('pointerleave', () => arm(2500));
  el.addEventListener('click', ev => { if (ev.target.closest('.nx')) { go(); return; } if (o.open) { go(); openWin(o.open, el); } });
}
function nudges() {
  const m = nowMin(), ph = phaseOf(m);
  if (ph !== lastPhase) { lastPhase = ph; if (ph !== 'night') brief(ph, m); }
  if (ph === 'night') return;
  const st = D.main.map(x => ({ x, s: habitState(x, m) }));
  const due = st.filter(o => o.s.st === 'due').map(o => o.x), late = st.filter(o => o.s.st === 'late').map(o => o.x);
  const list = xs => xs.map(x => x.icon + ' <b>' + esc(x.name) + '</b>').join(', ');
  if (due.length) notify({ key: 'due:' + due.map(x => x.name).join(), app: 'habits', open: 'habits', html: 'Due now: ' + list(due) + '.' });
  if (late.length) notify({ key: 'late:' + late.map(x => x.name).join(), app: 'habits', open: 'habits', html: 'Still open: ' + list(late) + '. Tap one on the Main habits widget to tick it off.' });
  EVENTS().forEach(e => { const a = minOf(e.from); if (a > m && a - m <= 20) notify({ key: 'ev:' + e.id + '@' + e.from, app: 'day', html: esc(e.ic || '') + ' <b>' + esc(e.t) + '</b> starts at ' + e.from + (e.who === 'roy' ? '' : ' · ' + esc(WHO[e.who])) + '.' }); });
}
function brief(ph, m) {
  const left = D.main.filter(x => habitState(x, m).st !== 'done').length, r = laneNow('roy', m), nx = r.cur ? null : r.next, must = focusList('must').filter(x => !x.done), rec = R();
  const habits = left ? left + ' main habit' + (left > 1 ? 's' : '') + ' still open.' : 'All main habits done.';
  const next = nx ? 'Next: ' + esc(nx.ic || '') + ' ' + esc(nx.t) + ' at ' + nx.from + '. ' : '';
  const html = ph === 'morning' ? 'Good morning, Roy. ' + (rec ? 'Recovery <b>' + rec.score + '%</b>, so ' + REC_LABEL[rec.verdict][1].toLowerCase() + ' today. ' : '') + habits
    : ph === 'day' ? (must.length ? 'Must do: <b>' + esc(must[0].t) + '</b>' + (must.length > 1 ? ' and ' + (must.length - 1) + ' more' : '') + '. ' : 'Your must-dos are done. ') + next
    : 'Good evening, Roy. ' + next + habits;
  notify({ key: 'brief:' + ph + ':' + D.today, app: 'os', html, ttl: 9000 });
}

// ---- Theme and wallpaper ----
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ');
let wallNow = null, wallAr = 16 / 9, wallChoice = null;
function applyTheme(t) {
  const p = (t && t.palette) || { accent: '#6fd8ff', second: '#ff7ac8', tint: '9, 14, 27' }, st = document.documentElement.style;
  st.setProperty('--accent', p.accent); st.setProperty('--accent-rgb', hexRgb(p.accent)); st.setProperty('--second', p.second); st.setProperty('--tint', p.tint);
  $('themeChip').innerHTML = t ? '<i></i>' + esc(t.franchise) + ' <em>· ' + esc(t.scene) + '</em>' : '<i></i>No world yet';
  $('themeChip').setAttribute('aria-label', t ? 'This week: ' + t.franchise + ', ' + t.scene + ' with ' + t.character + '. Open the menu' : 'This week has no world yet. Open the menu');
  $('mTheme').innerHTML = t ? '<span>' + esc(t.week) + (t.status === 'ready' ? ' · since Monday 06:00' : ' · ' + esc(t.status) + (t.error ? ': ' + esc(t.error) : '')) + '</span><b>' + esc(t.franchise) + ' · ' + esc(t.scene) + '</b><span>' + esc(t.character) + ' · ' + esc(t.look || '') + '</span>' +
    '<span class="sw"><i style="background:' + p.accent + '"></i><i style="background:' + p.second + '"></i><i style="background:rgb(' + p.tint + ')"></i></span>' + (t.next ? '<span>Next Monday: ' + esc(t.next.franchise) + ' · ' + esc(t.next.scene) + ' · ' + esc(t.next.character) + '</span>' : '') : '<span>No world has been made yet. The Monday cron makes one.</span>';
  const walls = []; if (t && t.clip) walls.push({ id: 'clip', name: 'This week’s clip', video: t.clip, poster: t.still }); if (t && t.still) walls.push({ id: 'still', name: 'This week’s still', src: t.still });
  $('mWalls').innerHTML = walls.map(w => '<button type="button" data-act="wall" data-w="' + w.id + '" aria-pressed="false">' + esc(w.name) + '</button>').join('') || '<span class="mnote" style="padding:0;font-size:.72rem">Nothing to show yet.</span>';
  const want = walls.find(w => w.id === wallChoice) || walls[0] || null;
  if (want && (!wallNow || wallNow.video !== want.video || wallNow.src !== want.src)) setWall(want);
  qa('[data-w]').forEach(b => b.setAttribute('aria-pressed', String(!!want && b.dataset.w === want.id)));
}
function placeWall() {
  if (!wallNow) return;
  const w = innerWidth, h = innerHeight, dw = Math.max(w, h * wallAr), x = Math.max(w - dw, Math.min(0, w / 2 - .5 * dw));
  $('wall').style.backgroundPosition = Math.round(x) + 'px 30%';
  qa('#wall video').forEach(v => { v.style.left = Math.round(x) + 'px'; v.style.width = Math.round(dw) + 'px'; });
}
// The clip loops through a crossfade: two copies of it take turns, the next one fading
// in over the last second of the other, so the seam never jumps or flickers.
const FADE = 1.0;
let loopRaf = 0;
function setWall(w) {
  wallNow = w;
  cancelAnimationFrame(loopRaf);
  qa('#wall video').forEach(v => v.remove());
  if (w.poster || w.src) $('wall').style.backgroundImage = 'url(' + (w.poster || w.src) + ')';
  if (w.video) {
    const make = () => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('aria-hidden', 'true'); v.src = w.video; v.style.opacity = '0'; $('wall').appendChild(v); return v; };
    const vids = [make(), make()];
    let cur = 0, switching = false;
    vids[0].addEventListener('loadedmetadata', () => { if (wallNow === w && vids[0].videoHeight) { wallAr = vids[0].videoWidth / vids[0].videoHeight; placeWall(); } });
    vids[0].addEventListener('playing', () => { vids[0].style.opacity = '1'; }, { once: true });
    vids[0].play().catch(() => {});
    const tick = () => {
      if (wallNow !== w) return;
      const v = vids[cur], d = v.duration;
      if (d && !switching && v.currentTime >= d - FADE) {
        switching = true;
        const n = vids[1 - cur]; n.currentTime = 0;
        n.play().then(() => { n.style.opacity = '1'; v.style.opacity = '0'; setTimeout(() => { v.pause(); switching = false; }, FADE * 1000 + 50); cur = 1 - cur; }).catch(() => { switching = false; v.currentTime = 0; v.play().catch(() => {}); });
      }
      loopRaf = requestAnimationFrame(tick);
    };
    loopRaf = requestAnimationFrame(tick);
  } else { const img = new Image(); img.onload = () => { if (wallNow === w && img.naturalHeight) { wallAr = img.naturalWidth / img.naturalHeight; placeWall(); } }; img.src = w.src; }
  placeWall();
}
addEventListener('resize', placeWall);

// ---- Rendering ----
function renderClock() {
  const t = now(), m = minAt(t), ph = phaseOf(m);
  if (ph !== clockPhase) { clockPhase = ph; document.body.classList.remove('awake'); }
  document.body.dataset.phase = ph;
  $('clock').textContent = $('lockClock').textContent = hm(t);
  $('dateline').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t));
  $('greet').textContent = { morning: 'Good morning, Roy', day: 'Keep going, Roy', evening: 'Good evening, Roy', night: 'Rest up, Roy' }[ph];
  $('trTime').innerHTML = esc(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(t))) + '<b>' + hm(t) + '</b>';
  $('mode').textContent = { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' }[ph];
}
function renderTray() {
  const w = D.weather, r = R();
  $('trWeather').innerHTML = w ? icon(w.code <= 1 ? 'sun' : 'cloud') + Math.round(w.temp) + '°' : '';
  $('trRec').innerHTML = r ? '<span class="dot" style="--c:' + recColor(r.score) + '"></span>' + r.score + '%' : '';
  $('trRec').setAttribute('aria-label', r ? 'Recovery ' + r.score + '%. Open Body' : 'Open Body');
}
function renderIsland() {
  const m = nowMin(), r = laneNow('roy', m);
  $('islPill').innerHTML = r.cur ? '<span>' + esc(r.cur.ic || '') + '</span><span class="t">' + esc(r.cur.t) + '</span><span class="isl-bar"><i style="width:' + pct(m - r.cur.a, r.cur.z - r.cur.a) + '%"></i></span><span class="left">' + dur(r.cur.z - m) + ' left</span>'
    : r.next ? '<span class="k">Next</span><span>' + esc(r.next.ic || '') + '</span><span class="t">' + esc(r.next.t) + '</span><span class="left">in ' + dur(r.next.a - m) + '</span>'
    : '<span class="k">' + (EVENTS().length ? 'Free' : 'Plan') + '</span><span class="t">' + (EVENTS().length ? 'Nothing else planned today' : 'Nothing planned yet. Tap a lane below to add.') + '</span>';
  $('islPanel').innerHTML = [['roy', 'Roy'], ['steph', 'Steph'], ['kids', 'Kids']].map(([w, name]) => { const x = laneNow(w, m);
    const cur = x.cur ? '<span><em>now</em>' + esc((x.cur.ic || '') + ' ' + x.cur.t) + ' <em>until ' + x.cur.to + '</em></span>' : '', nxt = x.next ? '<span class="nxt"><em>' + x.next.from + '</em>' + esc((x.next.ic || '') + ' ' + x.next.t) + '</span>' : '';
    return '<div class="isl-row"><span class="who ' + w + '">' + name + '</span><div class="what">' + (cur || nxt ? cur + nxt : '<span class="nxt">Free for the rest of the day</span>') + '</div></div>'; }).join('');
}
function renderQuest() {
  const q = D.quest;
  $('questChip').hidden = !q;
  if (!q) return;
  $('questChip').innerHTML = icon('quest') + '<b>' + esc(q.title.length > 22 ? q.title.slice(0, 20) + '…' : q.title) + '</b>' + (q.longest_km && q.goal_km ? '<span class="qbar"><i style="width:' + pct(q.longest_km, q.goal_km) + '%"></i></span>' : '') + (q.days_left != null ? '<span class="d">' + q.days_left + ' days</span>' : '');
  $('questChip').setAttribute('aria-label', q.title + (q.days_left != null ? ', ' + q.days_left + ' days to go' : '') + '. Open Quest');
}
function renderFocusW() {
  const all = focusList('must').concat(focusList('can')), open = all.filter(x => !x.done);
  $('focusCount').textContent = all.filter(x => x.done).length + '/' + all.length;
  $('winIf').innerHTML = '<small>Today is a win if</small>' + (D.journal.win_if ? esc(D.journal.win_if) : '<span class="say">Not set in your journal yet.</span>');
  const must = focusList('must').filter(x => !x.done).map(x => ({ x, g: 'must' })), can = focusList('can').filter(x => !x.done).map(x => ({ x, g: 'can' })), list = must.concat(can);
  $('focusTodos').innerHTML = list.length ? list.slice(0, 3).map(o => todoBtn(o.x, o.g)).join('') + (list.length > 3 ? '<div class="say" style="font-size:.78rem">+' + (list.length - 3) + ' more</div>' : '') : all.length ? '<div class="alldone">All done. That’s a win.</div>' : '<div class="say">No to-dos yet. Add one below.</div>';
}
function renderHabitsW() {
  const m = nowMin(), st = D.main.map(x => habitState(x, m));
  $('habitCount').textContent = st.filter(s => s.st === 'done').length + '/' + D.main.length;
  $('habitRow').innerHTML = D.main.map((x, i) => { const s = st[i]; return '<button type="button" class="hab ' + s.st + '" data-act="habit" data-i="' + i + '" data-tip="@habit" aria-label="' + esc(x.name + ': ' + habitLine(x, s)) + '"><span class="disc">' + esc(x.icon) + (s.st === 'done' ? '<span class="badge">✓</span>' : s.st === 'late' ? '<span class="badge">!</span>' : '') + '</span><span class="lab">' + esc(x.short) + '</span></button>'; }).join('');
}
function renderMe() {
  const r = R(), lm = lastMood(), b = border(), k = F().ki;
  $('cRec').innerHTML = '<div class="cl">Recovery</div>' + (r ? '<div class="rec"><div class="ring" style="--p:' + r.score + ';--c:' + recColor(r.score) + '"><b>' + r.score + '%</b></div><div class="recw" style="--c:' + recColor(r.score) + '"><b>' + REC_LABEL[r.verdict][0] + '</b><span>' + REC_LABEL[r.verdict][1] + '</span></div></div>' : '<div class="say">No night synced yet.</div>');
  const Pk = F().peak;
  $('cLoad').innerHTML = '<div class="cl"><span>Load</span>' + (L().length ? '<span class="pair" data-tip="@load"><span><b class="lt-c">' + Math.round(LAST().cl) + '</b> long</span><span><b class="st-c">' + Math.round(LAST().al) + '</b> short</span>' + (Pk ? '<span title="7-day peak"><b class="st-c">↑' + Math.round(Pk.al) + '</b> ' + wdShort(Pk.date) + '</span>' : '') + '</span>' : '') + '</div><div class="spark" data-chart="load" data-days="14">' + loadSvg(100, false, 14) + '</div>';
  const rz = L().length > 1 ? zoneOf(ratioOf(LAST())) : null;
  $('cRatio').innerHTML = '<div class="cl">Load ratio' + (rz ? '<b style="color:' + rz[2] + '">' + rz[1] + '</b>' : '') + '</div>' + ratioBar();
  $('cKi').innerHTML = '<div class="cl">Ki charge' + (k ? '<b>' + k.level + ' of ' + k.peak + '</b>' : '') + '</div>' + (k ? pips(k) : '');
  $('cMood').innerHTML = '<div class="cl">Mood' + (lm ? '<span class="lastm" data-tip="@lastmood">' + hhmm(lm.at) + faceImg(lm.m, '') + '</span>' : '') + '</div><div class="moods" role="group" aria-label="Log your mood">' + FEEL.map((f, i) => '<button type="button" class="face' + (lm && lm.m === i + 1 ? ' last' : '') + '" data-act="face" data-m="' + (i + 1) + '" data-tip="' + f + '" aria-label="Log mood: ' + f + '">' + faceImg(i + 1, '') + '</button>').join('') + '</div>';
  $('cCommute').innerHTML = '<div class="cl">Commute</div><div class="commute"><span class="place">' + esc(workPlace()) + '</span><span class="ride">' + esc(workToday().commute) + '</span><span class="minring" style="--p:' + b.share + '"><b>' + b.share + '%</b></span></div>';
}
function renderMinis() {
  const open = stephList().filter(x => !x.done);
  $('stephBody').innerHTML = '<div class="big">' + open.length + '<small>open</small></div><div class="mtx">' + (open.length ? esc(open[0].t) : 'Nothing from Steph right now.') + '</div>';
  $('datesBody').innerHTML = '<div class="mtx">Birthdays and dates come with the shared calendar.</div>';
}
const LANES = [['roy', 'Roy'], ['steph', 'Steph'], ['kids', 'Kids']];
function renderDay() {
  const m = nowMin(), nowIn = m >= DAY0 * 60 && m <= DAY1 * 60;
  let html = '';
  LANES.forEach(([who, name], li) => {
    const evs = EVENTS().filter(e => e.who === who || e.who === 'all').map(e => ({ ...e, a: minOf(e.from), z: minOf(e.to) })).sort((p, q) => p.a - q.a);
    const rows = []; evs.forEach(e => { let r = rows.findIndex(end => end <= e.a); if (r < 0) { r = rows.length; rows.push(0); } rows[r] = e.z; e.row = r; });
    const rh = 100 / Math.max(1, rows.length);
    let t = ''; for (let h = DAY0 + 2; h < DAY1; h += 2) t += '<i class="tick" style="left:' + xOf(h * 60) + '%"></i>';
    t += evs.map(e => { const st = e.z <= m ? ' past' : e.a <= m ? ' now' : ''; return '<div class="blk ' + who + st + '" data-act="ev" data-id="' + esc(e.id) + '" data-tip="@blk" role="button" tabindex="0" aria-label="' + esc(e.t + ', ' + e.from + ' to ' + e.to + '. Edit') + '" style="left:calc(' + xOf(e.a) + '% + 1px);width:calc(' + (xOf(e.z) - xOf(e.a)) + '% - 2px);top:calc(' + (e.row * rh) + '% + 1px);height:calc(' + rh + '% - 2px)"><span>' + esc((e.ic || ICON[e.k] || '') + ' ' + e.t) + '</span></div>'; }).join('');
    if (nowIn) t += '<div class="pastshade" style="width:' + xOf(m) + '%"></div><div class="nowl" style="left:' + xOf(m) + '%">' + (li === 0 ? '<span>' + hm() + '</span>' : '') + '</div>';
    html += '<span class="lname ' + who + '">' + name + '</span><div class="track" data-act="track" data-who="' + who + '">' + t + '</div>';
  });
  let axis = ''; for (let h = DAY0; h < DAY1; h += 2) axis += '<span style="left:' + xOf(h * 60) + '%">' + String(h).padStart(2, '0') + '</span>';
  $('lanes').innerHTML = html + '<span></span><div class="axis">' + axis + '</div>';
}
function renderApps() { $('apps').innerHTML = APPS.map(([k, name, ac]) => '<button type="button" class="app" data-open="' + k + '" data-tip="' + esc(name) + '" aria-label="Open ' + esc(name) + '" style="--ac:' + ac + '">' + icon(k) + '</button>').join(''); }
function renderDockState() { qa('.app').forEach(a => a.classList.toggle('open', !!WIN && WIN.key === a.dataset.open)); }
function renderAll() { renderClock(); renderTray(); renderIsland(); renderQuest(); renderFocusW(); renderHabitsW(); renderMe(); renderMinis(); renderDay(); renderDockState(); }

// ---- Windows ----
const sec = (id, hl, html) => '<div class="sec' + (hl === id ? ' hl' : '') + '">' + html + '</div>';
const WINS = {
  body: { w: 50, title: 'Body', tags: () => '',
    render(b, arg) {
      const r = R(), U = F().usual, k = F().ki, N = F().nights, Ld = L();
      const left = sec('recovery', arg, '<div class="sh"><span>Recovery' + (r ? ' · ' + (r.fresh ? 'last night' : 'night to ' + dayFmt(r.date)) : '') + '</span></div>' + (r ? '<div class="rec big"><div class="ring bigring" style="--p:' + r.score + ';--c:' + recColor(r.score) + '"><b>' + r.score + '%</b></div><div class="recw" style="--c:' + recColor(r.score) + '"><b>' + REC_LABEL[r.verdict][0] + ' · ' + REC_LABEL[r.verdict][1] + '</b><span>' + REC_LABEL[r.verdict][2] + '</span></div></div>' +
          '<div class="vit"><span>Sleep</span><b>' + sleepTxt(r.sleep) + ' ' + trend(r.sleep, U.sleep, true, .25) + '</b><em>usual ' + sleepTxt(U.sleep) + '</em><span>HRV</span><b>' + (r.hrv == null ? '–' : r.hrv + ' ms ') + trend(r.hrv, U.hrv, true, (U.hrv || 50) * .05) + '</b><em>usual ' + one(U.hrv) + '</em><span>Resting HR</span><b>' + (r.rhr == null ? '–' : r.rhr + ' ') + trend(r.rhr, U.rhr, false, 2) + '</b><em>usual ' + one(U.rhr) + '</em></div>' : '<p class="say">No night synced yet.</p>')) +
        sec('nights', arg, '<div class="sh"><span>Last 7 nights</span></div><div class="chart nights" data-chart="nights">' + nightsSvg() + '</div><div class="xlab seven">' + N.map((d, i) => '<span>' + (i === N.length - 1 ? 'Last' : wdShort(d.day)) + '</span>').join('') + '</div><div class="legend"><span><i style="background:#3ddc84"></i>Train</span><span><i style="background:#ffc24a"></i>Careful</span><span><i style="background:#ff5f6d"></i>Rest</span><span><i style="background:#fff"></i>HRV</span></div>');
      const r2 = Ld.length > 1 ? ratioOf(LAST()) : null, z = r2 != null ? zoneOf(r2) : null, rp = Ld.length > 1 ? ratioOf(PREV()) : null, Pk = F().peak, why = Pk && Ld.length > 1 && Pk.date === PREV().date ? ' after the ' + esc(Pk.what) : '';
      const right = sec('load', arg, '<div class="sh"><span>Fitness vs fatigue · 4 weeks</span>' + (Ld.length ? '<span>' + formChip() + ' <b class="lt-c">' + one(LAST().cl) + '</b> · <b class="st-c">' + one(LAST().al) + '</b></span>' : '') + '</div><div class="chart load" data-chart="load">' + loadSvg(120, true) + '</div>' + (Ld.length ? '<div class="xlab"><span>' + dayFmt(Ld[0].date) + '</span><span>Today</span></div>' : '') + '<div class="legend"><span><i style="background:var(--long)"></i>Long term (fitness)</span><span><i style="background:var(--short)"></i>Short term (fatigue)</span>' + (Pk ? '<span><i style="background:var(--short);width:.5rem;height:.5rem;border-radius:50%;vertical-align:0"></i>' + wdShort(Pk.date) + ': ' + esc(Pk.what) + '</span>' : '') + '</div>') +
        (z ? sec('ratio', arg, '<div class="sh"><span>Load ratio</span><b style="color:' + z[2] + '">' + r2.toFixed(2) + ' · ' + z[1] + '</b></div>' + ratioBar() + R_LABELS + '<p class="say">' + esc(RSAY[z[1]]) + ' Yesterday it was <b>' + rp.toFixed(2) + '</b>' + why + '.</p>') : '') +
        '<div class="grid2">' + (k ? sec('ki', arg, '<div class="sh"><span>Ki charge</span><b>' + kiState(k) + '</b></div>' + pips(k) + '<div class="kv2"><b>' + k.level + ' of ' + k.peak + '</b>' + (k.heal_cap ? ' · healing cap <b>' + k.heal_cap + ' HP</b>' : '') + '</div>') : '') +
        sec('week', arg, '<div class="sh"><span>Training this week</span>' + (F().week.tss ? '<b>TSS ' + Math.round(F().week.tss) + '</b>' : '') + '</div><div class="meter"><i style="width:' + pct(F().week.hours, F().week.target) + '%"></i></div><div class="kv2"><b>' + one(F().week.hours) + ' h</b> of ' + F().week.target + ' h · ' + F().week.sessions + ' session' + (F().week.sessions === 1 ? '' : 's') + '</div>' + zoneBar(F().week.zones)) + '</div>' +
        ((F().week.list || []).length ? sec('sessions', arg, '<div class="sh"><span>Sessions</span></div><div class="rows">' + F().week.list.map(w => '<div class="rowi"><span>' + (SPORT[w.sport] || '🏃') + '</span><span>' + esc(w.name) + '<small>' + wdShort(w.day) + ' ' + w.at + ' · ' + w.min + ' min' + (w.km ? ' · ' + w.km + ' km' : '') + (w.hr_avg ? ' · ' + w.hr_avg + ' bpm' : '') + '</small></span><span class="in">' + (w.tss != null ? 'TSS ' + w.tss : '') + '</span></div>').join('') + '</div>') : '');
      b.innerHTML = '<div class="bodygrid"><div>' + left + '</div><div>' + right + '</div></div>';
    } },
  focus: { w: 30, title: 'Focus', tags: () => '',
    render(b) {
      const g0 = $('wAddG') ? $('wAddG').value : 'must';
      const group = (title, g) => { const l = focusList(g); return sec(g, '', '<div class="sh"><span>' + title + '</span><span>' + l.filter(x => x.done).length + '/' + l.length + '</span></div><div class="todos">' + (l.length ? l.map(x => todoBtn(x, g, 'wide')).join('') : '<p class="say">Nothing here yet.</p>') + '</div>'); };
      b.innerHTML = '<div class="winif" style="margin:0"><small>Today is a win if</small>' + (D.journal.win_if ? esc(D.journal.win_if) : '<span class="say">Not set in your journal yet.</span>') + '</div>' + group('Must do', 'must') + group('Can do', 'can') +
        '<form class="addfull" id="wAddForm" autocomplete="off"><label class="sr" for="wAddIn">New to-do</label><input class="inp" id="wAddIn" type="text" maxlength="120" placeholder="Add a to-do"><label class="sr" for="wAddG">List</label><select class="sel" id="wAddG"><option value="must"' + (g0 === 'must' ? ' selected' : '') + '>Must do</option><option value="can"' + (g0 === 'can' ? ' selected' : '') + '>Can do</option></select><button type="submit" class="btn primary">Add</button></form><p class="say">Ticks and new to-dos live on this screen for the day; the journal stays the record.</p>';
    } },
  habits: { w: 36, title: 'Main habits', tags: () => '',
    render(b) {
      const m = nowMin(), days = Array.from({ length: 14 }, (_, k) => ymdAdd(D.today, k - 13));
      b.innerHTML = '<div class="hlist">' + D.main.map((x, i) => { const s = habitState(x, m), set = new Set(x.days);
        return '<button type="button" class="hline ' + s.st + '" data-act="habit" data-i="' + i + '" aria-label="' + esc(x.name + ': ' + habitLine(x, s) + '. Tap to ' + (s.st === 'done' ? 'untick' : 'tick it off')) + '"><span class="disc">' + esc(x.icon) + (s.st === 'done' ? '<span class="badge">✓</span>' : s.st === 'late' ? '<span class="badge">!</span>' : '') + '</span><span><span class="nm">' + esc(x.name) + '</span><br><span class="st">' + habitLine(x, s) + '</span></span><span class="hright"><span class="streak">' + (x.streak >= 2 ? '🔥 ' + x.streak + ' days' : '') + '</span><span class="hist" aria-hidden="true">' + days.map(d => '<i class="' + ((d === D.today ? s.st === 'done' : set.has(d)) ? 'on' : '') + (d === D.today ? ' today' : '') + '"></i>').join('') + '</span></span></button>'; }).join('') +
        '</div><p class="say">Tap a habit to tick it off here. The squares are the last 14 days from the boss log, today on the right.</p>';
    } },
  mood: { w: 30, title: 'Mood', tags: () => '',
    render(b) {
      const so = moodsSoFar();
      b.innerHTML = '<div class="sec"><div class="sh"><span>How are you feeling?</span></div><div class="facesbig" role="group" aria-label="Mood">' + FEEL.map((f, i) => '<button type="button" data-act="wface" data-m="' + (i + 1) + '" aria-pressed="' + (moodPick === i + 1) + '">' + faceImg(i + 1, '') + f + '</button>').join('') + '</div>' +
        '<form class="moodform" id="wMoodForm" autocomplete="off"' + (moodPick ? '' : ' hidden') + '><label class="sr" for="wMoodNote">A few words</label><input class="inp" id="wMoodNote" type="text" maxlength="80" placeholder="A few words (optional)"><button type="submit" class="btn primary">Log ' + (moodPick ? FEEL[moodPick - 1] : '') + '</button></form></div>' +
        '<div class="sec"><div class="sh"><span>Today</span><span>' + so.length + ' logged</span></div><div class="moodstrip">' + so.map(x => '<img src="' + D.moodArt[x.m - 1] + '" alt="' + esc(FEEL[x.m - 1] + ' at ' + hhmm(x.at)) + '" style="left:' + xOf(x.at) + '%" data-tip="' + esc(hhmm(x.at) + ' · ' + FEEL[x.m - 1] + (x.note ? ': ' + x.note : '')) + '">').join('') + '</div><div class="axis" style="grid-column:auto">' + [6, 9, 12, 15, 18, 21].map(h => '<span style="left:' + xOf(h * 60) + '%">' + String(h).padStart(2, '0') + ':00</span>').join('') + '</div>' +
        '<div>' + so.slice().reverse().map(x => '<div class="mlrow"><time>' + hhmm(x.at) + '</time>' + faceImg(x.m) + '<span>' + esc(x.note || FEEL[x.m - 1]) + '</span></div>').join('') + '</div></div>';
    } },
  commute: { w: 31, title: 'Commute', tags: () => '',
    render(b) {
      const T = workToday(), x = border();
      const sel = (id, label, list, v) => '<div class="fld"><label for="' + id + '">' + label + '</label><select class="sel" id="' + id + '">' + list.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
      b.innerHTML = '<div class="sec"><div class="sh"><span>Today</span></div><div class="grid3">' + sel('wAm', 'Morning', PLACES, T.am) + sel('wPm', 'Afternoon', PLACES, T.pm) + sel('wRide', 'Ride', RIDES, T.commute) + '</div></div>' +
        '<div class="sec"><div class="sh"><span>Work days this year</span><b>' + x.share + '% in Belgium</b></div><div class="bbar"><i style="width:' + x.share + '%"></i><i style="width:' + (100 - x.share) + '%"></i><span class="half"></span></div><div class="bnums"><span>🇧🇪 Belgium <b>' + one(x.be) + '</b></span><span>minimum 50%</span><span>🇳🇱 Netherlands <b>' + one(x.nl) + '</b></span></div><p class="say">You have <b>' + x.spare + ' days</b> to spare before Belgium drops under half of your work days. A change here is kept on this screen for today; the journal’s border page stays the record.</p></div>';
    } },
  steph: { w: 28, title: 'From Steph', tags: () => '', render(b) { const l = stephList(); b.innerHTML = l.length ? '<div class="todos">' + l.map(x => todoBtn(x, 'steph', 'wide')).join('') + '</div><p class="say">Tap one to tick it off.</p>' : '<p class="say">Nothing open. To-dos tagged “Steph” in the journal land here.</p>'; } },
  dates: { w: 29, title: 'Coming up', tags: () => '', render(b) { b.innerHTML = '<p class="say">Birthdays and important dates will come from the shared calendar once it is connected.</p>'; } },
  quest: { w: 33, title: 'Quest', tags: () => '',
    render(b) {
      const q = D.quest; if (!q) { b.innerHTML = '<p class="say">No quest in focus.</p>'; return; }
      b.innerHTML = '<div class="sec"><div class="sh"><span>' + esc(q.phase) + ' phase' + (q.days_left != null ? ' · ' + q.days_left + ' days to go' : '') + '</span>' + (q.target ? '<span>' + dayFmt(q.target) + '</span>' : '') + '</div><h3 class="qtitle">' + esc(q.title) + '</h3></div>' +
        (q.longest_km && q.goal_km ? '<div class="sec"><div class="sh"><span>Longest run so far</span><b>' + q.longest_km + ' of ' + q.goal_km + ' km</b></div><div class="meter"><i style="width:' + pct(q.longest_km, q.goal_km) + '%;background:linear-gradient(90deg,var(--roy),var(--accent))"></i></div></div>' : '') +
        '<div class="qkv"><span>Next move</span><span>' + esc(q.next_move) + '</span><span>Weekly check</span><span>' + esc(q.check) + '</span><span>Latest</span><span>' + esc(q.evidence) + '</span></div>' + (q.quote ? '<p class="quote">“' + esc(q.quote) + '”' + (q.author ? ' · ' + esc(q.author) : '') + '</p>' : '');
    } },
  event: { w: 27, icon: 'day', title: a => (a && a.id ? 'Edit event' : 'New event'), live: false,
    render(b, a) {
      const ev = a && a.id ? EVENTS().find(x => x.id === a.id) : null;
      const from = ev ? ev.from : hhmm(a.start), to = ev ? ev.to : hhmm(Math.min(DAY1 * 60, a.start + 60)), who = ev ? ev.who : a.who || 'roy', k = ev ? ev.k : 'mind';
      const opt = (v, n, cur) => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + n + '</option>';
      b.innerHTML = '<form id="evForm" autocomplete="off" style="display:grid;gap:.8rem"><div class="fld"><label for="evName">What</label><input class="inp" id="evName" type="text" maxlength="60" placeholder="e.g. Dentist" value="' + esc(ev ? ev.t : '') + '" data-autofocus></div>' +
        '<div class="grid2"><div class="fld"><label for="evFrom">From</label><input class="inp" id="evFrom" type="time" step="900" value="' + from + '"></div><div class="fld"><label for="evTo">To</label><input class="inp" id="evTo" type="time" step="900" value="' + to + '"></div></div>' +
        '<div class="grid2"><div class="fld"><label for="evWho">Who</label><select class="sel" id="evWho">' + Object.entries(WHO).map(([v, n]) => opt(v, n, who)).join('') + '</select></div><div class="fld"><label for="evKind">Type</label><select class="sel" id="evKind">' + [['work', '💼 Work'], ['move', '🚲 Commute'], ['train', '🏃 Training'], ['fam', '👪 Family'], ['mind', '📓 Personal']].map(([v, n]) => opt(v, n, k)).join('') + '</select></div></div>' +
        '<p class="err" id="evErr" hidden></p><div class="btns">' + (ev ? '<button type="button" class="btn danger" data-act="evdel">Delete</button>' : '') + '<span class="sp"></span><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary">Save</button></div></form>';
    } }
};
function openWin(key, from, arg) {
  const def = WINS[key]; if (!def) return;
  if (WIN) closeWin(true);
  hideTip(); closePop();
  const el = document.createElement('div');
  el.className = 'win'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'wt_' + key);
  el.style.setProperty('--ww', def.w + 'rem'); el.style.setProperty('--ac', (APP[key] || APP.day).ac);
  el.innerHTML = '<div class="tbar"><div class="lights"><button type="button" class="x" data-close aria-label="Close window">' + icon('x') + '</button><i></i><i></i></div><span class="wt" id="wt_' + key + '">' + icon(def.icon || key) + '<span>' + esc(typeof def.title === 'function' ? def.title(arg) : def.title) + '</span></span><span class="tags">' + (def.tags ? def.tags(arg) : '') + '</span></div><div class="wbody"></div>';
  $('winLayer').appendChild(el);
  WIN = { key, el, def, arg, from };
  def.render(el.querySelector('.wbody'), arg);
  if (from && from.getBoundingClientRect && !reduced()) { const r = from.getBoundingClientRect(), w = el.getBoundingClientRect(); el.animate([{ transform: 'translate(-50%, -50%) translate(' + Math.round(r.left + r.width / 2 - (w.left + w.width / 2)) + 'px, ' + Math.round(r.top + r.height / 2 - (w.top + w.height / 2)) + 'px) scale(.2)', opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2, .85, .25, 1)' }); }
  renderDockState();
  const f = el.querySelector('[data-autofocus]') || el.querySelector('.x');
  setTimeout(() => { if (f && f.isConnected) f.focus({ preventScroll: true }); }, 40);
}
function closeWin(instant) {
  if (!WIN) return;
  const { el, from } = WIN; WIN = null;
  const hadFocus = el.contains(document.activeElement);
  if (instant || reduced()) el.remove();
  else { el.style.pointerEvents = 'none'; el.animate([{ opacity: 1, transform: 'translate(-50%, -50%)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(.96)' }], { duration: 150, easing: 'ease-in' }).onfinish = () => el.remove(); }
  if (hadFocus && from && from.isConnected && from.focus) from.focus({ preventScroll: true });
  renderDockState();
}
function refreshWin() { if (WIN && WIN.def.live !== false) WIN.def.render(WIN.el.querySelector('.wbody'), null); }

// ---- Actions ----
function toggleHabit(i) {
  const x = D.main[i]; if (!x) return;
  const was = habitState(x).st === 'done';
  E.habits[x.name] = was ? false : hm(); renderHabitsW(); refreshWin();
  act({ type: 'habit', name: x.name, done: !was }, () => { const n = D.main.filter(h => habitState(h).st === 'done').length; notify({ app: 'habits', html: x.icon + ' <b>' + esc(x.name) + '</b> ' + (was ? 'unticked.' : 'done. ' + n + ' of ' + D.main.length + ' main habits today.') }); });
}
function pickFace(m, el) {
  popPick = m;
  const pop = $('moodPop'), img = $('moodPopImg'); img.src = D.moodArt[m - 1]; img.alt = FEEL[m - 1]; pop.hidden = false;
  const r = el.closest('.moods').getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.right - pw)) + 'px'; pop.style.top = (r.bottom + 8 + ph > innerHeight - 8 ? r.top - ph - 8 : r.bottom + 8) + 'px';
  $('moodNote').value = ''; $('moodNote').focus({ preventScroll: true });
}
function closePop() { $('moodPop').hidden = true; popPick = 0; }
function logMood(m, note) {
  if (!m) return;
  const t = String(note || '').trim().slice(0, 80);
  E.moods.push({ at: nowMin(), m, note: t }); closePop(); moodPick = 0; renderMe(); refreshWin();
  act({ type: 'mood', mood: m, note: t }, () => notify({ app: 'mood', html: '<b>' + FEEL[m - 1] + '</b> logged at ' + hm() + (t ? ': ' + esc(t) : '.') }));
}
function addTodo(f) {
  const inp = f.querySelector('input'), t = inp.value.trim(), g = f.id === 'wAddForm' ? $('wAddG').value : 'must';
  if (!t) { inp.focus(); return; }
  E.added.unshift({ t, g }); inp.value = ''; renderFocusW(); refreshWin(); if (f.id === 'wAddForm' && $('wAddIn')) $('wAddIn').focus();
  act({ type: 'todo_add', text: t, list: g }, () => notify({ app: 'focus', html: 'Added to ' + (g === 'must' ? 'Must do' : 'Can do') + ': <b>' + esc(t) + '</b>' }));
}
function savePlan(evs, after) { act({ type: 'plan', events: evs }, after); }
function saveEvent() {
  const a = WIN && WIN.arg, t = $('evName').value.trim(), from = $('evFrom').value, to = $('evTo').value, k = $('evKind').value, who = $('evWho').value;
  const err = !t ? 'Give the event a name.' : !from || !to ? 'Set a start and an end time.' : minOf(to) <= minOf(from) ? 'The end has to be after the start.' : '';
  if (err) { $('evErr').textContent = err; $('evErr').hidden = false; return; }
  const evs = EVENTS().slice(), ev = a && a.id ? evs.find(x => x.id === a.id) : null;
  if (ev) Object.assign(ev, { t, from, to, k, who, ic: ICON[k] }); else evs.push({ id: 'n' + Date.now().toString(36), t, from, to, k, who, ic: ICON[k] });
  E.events = evs; closeWin(); renderDay(); renderIsland();
  savePlan(evs, () => notify({ app: 'day', html: ICON[k] + ' <b>' + esc(t) + '</b> saved, ' + from + '–' + to + (who === 'roy' ? '' : ' · ' + WHO[who]) + '.' }));
}
function deleteEvent() {
  const a = WIN && WIN.arg, ev = a && EVENTS().find(x => x.id === a.id); if (!ev) return;
  const evs = EVENTS().filter(x => x !== ev); E.events = evs; closeWin(); renderDay(); renderIsland();
  savePlan(evs, () => notify({ app: 'day', html: '<b>' + esc(ev.t) + '</b> deleted.' }));
}
function toggleMenu(open) { const m = $('sysMenu'); if (open == null) open = m.hidden; m.hidden = !open; $('logoBtn').setAttribute('aria-expanded', String(open)); }
const closeMenu = () => toggleMenu(false);
function setIsland(open) { $('island').classList.toggle('open', open); $('islPill').setAttribute('aria-expanded', String(open)); }
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  try { navigator.wakeLock.request('screen').catch(() => {}); } catch (_) {}
  closeMenu();
}
function doAct(el, e) {
  const a = el.dataset.act;
  if (a === 'todo') { const t = el.dataset.t, done = el.getAttribute('aria-checked') !== 'true'; E.ticks[t] = done; renderFocusW(); renderMinis(); refreshWin(); act({ type: 'todo_tick', text: t, done }, () => { if (done) notify({ app: el.dataset.g === 'steph' ? 'steph' : 'focus', html: 'Done: <b>' + esc(t) + '</b>' }); }); }
  else if (a === 'habit') toggleHabit(+el.dataset.i);
  else if (a === 'face') pickFace(+el.dataset.m, el);
  else if (a === 'wface') { moodPick = moodPick === +el.dataset.m ? 0 : +el.dataset.m; refreshWin(); if (moodPick && $('wMoodNote')) $('wMoodNote').focus(); }
  else if (a === 'ev') { if (EVENTS().some(x => x.id === el.dataset.id)) openWin('event', el, { id: el.dataset.id }); }
  else if (a === 'track') { const r = el.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); openWin('event', el, { start: Math.min(DAY1 * 60 - 60, Math.round((DAY0 * 60 + f * (DAY1 - DAY0) * 60) / 15) * 15), who: el.dataset.who }); }
  else if (a === 'addev') openWin('event', el, { start: Math.max(DAY0 * 60, Math.min(DAY1 * 60 - 60, Math.ceil(nowMin() / 15) * 15)), who: 'roy' });
  else if (a === 'evdel') deleteEvent();
  else if (a === 'menu') toggleMenu();
  else if (a === 'island') setIsland(!$('island').classList.contains('open'));
  else if (a === 'fs') fullscreen();
  else if (a === 'refresh') { closeMenu(); refresh(); }
  else if (a === 'wall') { wallChoice = el.dataset.w; applyTheme(D.theme); }
  else if (a === 'sugg') { const i = $('askIn'); i.value = el.dataset.q; hideAsk(); i.focus(); }
  else if (a === 'undo') undo();
  else if (a === 'askclose') hideAsk();
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('.note')) return;
  if (t.closest('#lock')) { document.body.classList.add('awake'); return; }
  if (t.closest('[data-close]')) { closeWin(); return; }
  const inWin = !!t.closest('.win'), inPop = !!t.closest('#moodPop');
  if (!inPop && !t.closest('[data-act="face"]')) closePop();
  if (!t.closest('.sysmenu')) closeMenu();
  if (!t.closest('.island')) setIsland(false);
  if (!t.closest('.dock') && !$('askPop').hidden && $('askPop').querySelector('[data-act="sugg"]')) hideAsk();
  if (inPop) return;
  const actEl = t.closest('[data-act]');
  if (actEl) { doAct(actEl, e); return; }
  if (inWin || t.closest('input, select, textarea, label, form')) return;
  const op = t.closest('[data-open]');
  if (op) { openWin(op.dataset.open, op, op.dataset.arg); return; }
  if (WIN) closeWin();
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'addForm' || f.id === 'wAddForm') { e.preventDefault(); addTodo(f); }
  else if (f.id === 'moodForm') { e.preventDefault(); logMood(popPick, $('moodNote').value); }
  else if (f.id === 'wMoodForm') { e.preventDefault(); logMood(moodPick, $('wMoodNote').value); }
  else if (f.id === 'evForm') { e.preventDefault(); saveEvent(); }
  else if (f.id === 'askForm') { e.preventDefault(); ask(); }
});
document.addEventListener('change', e => {
  const id = e.target.id, key = { wAm: 'am', wPm: 'pm', wRide: 'commute' }[id];
  if (!key) return;
  const w = { ...workToday(), [key]: e.target.value }; E.work = w; renderMe(); refreshWin();
  act({ type: 'work', am: w.am, pm: w.pm, commute: w.commute }, () => notify({ app: 'commute', html: 'Saved: ' + { am: 'morning', pm: 'afternoon', commute: 'ride' }[key] + ' <b>' + esc(e.target.value) + '</b>.' }));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('moodPop').hidden) closePop(); else if (WIN) closeWin(); else if (!$('sysMenu').hidden) closeMenu(); else if (!$('askPop').hidden) hideAsk(); else setIsland(false); return; }
  if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); $('askIn').focus(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]:not(button)')) { e.preventDefault(); e.target.click(); }
});

// ---- Ask: one box for anything on the screen; the server talks to the model and applies the edits ----
let asking = false, askTimer = null;
const SUGG = ['The kids are home today', 'I took my supplements', 'Log my mood: good and focused', 'Add a to-do: call the garage', 'How is my training load?'];
const askHead = label => '<div class="ah">' + icon('claude') + '<span>' + label + '</span><button type="button" class="nx" data-act="askclose" aria-label="Close">' + icon('x') + '</button></div>';
function showAsk(html, cls) { const p = $('askPop'); p.className = 'askpop' + (cls ? ' ' + cls : ''); p.innerHTML = html; p.hidden = false; clearTimeout(askTimer); }
function hideAsk() { $('askPop').hidden = true; clearTimeout(askTimer); }
function showSuggestions() { if (!asking) showAsk(askHead('Ask · try') + '<div class="chips">' + SUGG.map(s => '<button type="button" data-act="sugg" data-q="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>'); }
$('askIn').addEventListener('focus', () => { if (!$('askIn').value.trim() && $('askPop').hidden) showSuggestions(); });
$('askIn').addEventListener('input', () => { if ($('askIn').value.trim() && $('askPop').querySelector('[data-act="sugg"]')) hideAsk(); });
$('askPop').addEventListener('pointerenter', () => clearTimeout(askTimer));
$('askPop').addEventListener('pointerleave', () => { if (!asking && !$('askPop').querySelector('[data-act="sugg"]')) askTimer = setTimeout(hideAsk, 8000); });
function undo() { act({ type: 'undo' }, () => { showAsk(askHead('Claude') + '<p>Undone. The board is back to how it was.</p>'); askTimer = setTimeout(hideAsk, 6000); }); }
async function ask() {
  if (asking) return;
  const text = $('askIn').value.trim();
  if (!text) { $('askIn').focus(); showSuggestions(); return; }
  asking = true; $('askBtn').textContent = 'Working'; $('askForm').classList.add('busy'); $('askIn').disabled = true;
  showAsk(askHead('Claude is on it') + '<p style="color:var(--dim)">' + esc(text) + '</p><span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>');
  try {
    const out = await post('/ask', { text });
    if (out.edits) { E = out.edits; renderAll(); refreshWin(); }
    showAsk(askHead('Claude') + '<p>' + esc(out.reply || (out.applied ? 'Done.' : 'Nothing to change.')) + '</p>' + (out.applied ? '<div class="chips"><button type="button" data-act="undo">Undo</button></div>' : ''));
    askTimer = setTimeout(hideAsk, 30000); $('askIn').value = '';
  } catch (err) {
    if (err.message !== 'signed out') showAsk(askHead('Ask') + '<p>' + esc(err.code === 'invalid_json' ? 'The answer did not come back in the right shape. Try rephrasing.' : 'Something went wrong: ' + err.message) + '</p>', 'err');
  } finally { asking = false; $('askBtn').textContent = 'Ask'; $('askForm').classList.remove('busy'); $('askIn').disabled = false; }
}

// ---- Boot ----
qa('[data-ic]').forEach(el => { el.outerHTML = icon(el.dataset.ic); });
renderApps();
applyTheme(D.theme);
renderAll();
setTimeout(nudges, 900);
setInterval(() => { renderClock(); renderIsland(); renderDay(); }, 15e3);
setInterval(refresh, 60e3);
setInterval(() => { renderHabitsW(); renderMe(); nudges(); }, 60e3);
// A browser pauses video in a hidden tab; when the board is shown again the clip resumes and the data refreshes.
document.addEventListener('visibilitychange', () => { if (document.hidden) return; refresh(); qa('#wall video').forEach(v => { if (v.style.opacity === '1' && v.paused) v.play().catch(() => {}); }); });
})();
