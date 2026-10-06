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
  boss: '<path d="M14.5 3.5h6v6L9.8 20.2l-6-6Z"/><path d="m6.3 11.7 6 6M3.5 20.5l2.8-2.8"/>',
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
const APPS = [['focus', 'Focus', '#f6c045'], ['boss', 'Showdown', '#ff5f6d'], ['body', 'Body', '#ff7a7a'], ['mood', 'Mood', '#7ee0c3'],
  ['commute', 'Commute', '#6fd8ff'], ['steph', 'From Steph', '#ff7ac8'], ['dates', 'Coming up', '#ff9f5a'], ['quest', 'Quest', '#8fb8ff']];
const APP = Object.fromEntries(APPS.map(([k, name, ac]) => [k, { name, ac }]));
// The menu bar's apps (the quest opens from the line written on the world).
const BAR_APPS = APPS.filter(([k]) => k !== 'quest');
APP.day = { name: 'Your day', ac: '#5b93f0' }; APP.claude = { name: 'Claude', ac: '#b18cff' }; APP.os = { name: 'Roy OS', ac: '#6fd8ff' };

// ---- The board's state: the server's data plus the day's edits ----
const ICON = { work: '💼', move: '🚲', train: '🏃', fam: '👪', mind: '📓' };
const WHO = { roy: 'Roy', steph: 'Steph', kids: 'Kids', all: 'Everyone' };
const FEEL = ['Sucky', 'Tired', 'Normal', 'Good', 'On fire'];
const PLACES = ['🇳🇱 Home', '🇧🇪 Beerse', '🇧🇪 Ghent', '✈️ Travel', '🏖️ Holiday', '🎉 Public holiday'];
const RIDES = ['🚲 E-bike', '🚗 Car', '✈️ Plane', 'N/A'];
let E = D.edits;
const EVENTS = () => (Array.isArray(E.events) ? E.events : []);
const CAL = () => (D.calendar && Array.isArray(D.calendar.today_timed) ? D.calendar.today_timed : []);
const COMING = () => (D.calendar && Array.isArray(D.calendar.upcoming) ? D.calendar.upcoming : []);
const ALLEV = () => EVENTS().concat(CAL());
const daySpan = i => (i.end_day ? dayFmt(i.day) + ' – ' + dayFmt(i.end_day) : i.day === D.today ? 'Today' : dayFmt(i.day)) + (i.all_day ? '' : ' · ' + i.from + '–' + i.to);
const ticked = x => (E.ticks[x.t] != null ? E.ticks[x.t] : !!x.done);
const focusList = g => E.added.filter(a => a.g === g).map(a => ({ t: a.t, done: !!E.ticks[a.t], added: true })).concat((D.journal[g] || []).map(x => ({ t: x.t, done: ticked(x) })));
const stephList = () => D.journal.steph.map(x => ({ t: x.t, due: x.due, done: !!E.ticks[x.t] }));
const workToday = () => E.work || D.journal.work || { am: '🇳🇱 Home', pm: '🇳🇱 Home', commute: 'N/A' };
let WIN = null, popPick = 0, moodPick = 0, lastPhase = null, clockPhase = null;

// Main habits, read only: done when ticked on the boss card today, otherwise due, late or
// later by the usual time. They are only ever ticked on the boss card, never here.
function habitState(x, m) {
  if (m == null) m = nowMin();
  if (x.done && x.at && gm(minOf(x.at)) <= gm(m)) return { st: 'done', at: x.at };
  const u = gm(minOf(x.usual)), n = gm(m);
  return { st: n > u + 60 ? 'late' : n >= u - 30 ? 'due' : 'later' };
}
const habitLine = (x, s) => (s.st === 'done' ? 'Done at ' + s.at : s.st === 'due' ? 'Due now · usually ' + x.usual : s.st === 'late' ? 'Late · usually ' + x.usual : 'Later · usually ' + x.usual);

// Body
const F = () => D.fitness;
const R = () => F().recovery;
const L = () => F().clal, LAST = () => L()[L().length - 1], PREV = () => L()[L().length - 2];
const REC_LABEL = { good: ['Good', 'Good to go', 'Train as planned'], steady: ['Moderate', 'Go steady', 'Easy session only · skip anything hard'], easy: ['Low', 'Take it easy', 'Rest or a gentle walk today'] };
const recColor = s => (s >= 67 ? 'var(--good)' : s >= 34 ? 'var(--warn)' : 'var(--bad)');
const ZC = { Low: '#3f8fe8', Optimal: '#3ddc84', High: '#ff9a2e', Risk: '#ef4b4b' };
// The ratio and its zone come from the engine (power.load_ratio); the bands are the engine's.
const RATIO = () => F().ratio && F().ratio.value != null ? F().ratio : null;
const RSAY = { Low: 'Low: you train less than your body is used to, so fitness slowly fades.', Optimal: 'Balanced: ideal for progress with a low injury risk.', High: 'High: keep the next sessions easy and watch your recovery.', Risk: 'Risk zone: back off for a few days to avoid an injury.' };
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
  const evs = ALLEV().filter(e => e.who === who || e.who === 'all').map(e => ({ ...e, a: minOf(e.from), z: minOf(e.to) })).sort((p, q) => p.a - q.a);
  return { cur: evs.find(e => e.a <= m && m < e.z), next: evs.find(e => e.a > m) };
}
// The next 12 hours in one line for the weather tip.
const rainSoon = w => { const h = (w.hours || []).find(x => x.pop != null && x.pop >= 40); return h ? 'Rain likely from ' + h.t + ' (' + h.pop + '%).' : 'Dry for the next 12 hours.'; };
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
  acting = acting.then(() => post('/act', action)).then(out => { E = out.edits; $('liveTag').hidden = true; if (after) after(out); renderAll(); refreshWin(); }).catch(err => { if (err.message !== 'signed out') notify({ app: 'os', html: 'Could not save that: ' + esc(err.message) }); });
  return acting;
}
async function refresh() {
  try {
    const r = await fetch('/data', { headers: { Accept: 'application/json' } });
    if (r.status === 401) { location.href = '/login?next=/'; return; }
    const out = await r.json();
    if (!out.ok) throw new Error(out.message || out.code);
    const art = D.moodArt; D = out; D.moodArt = art; E = D.edits;
    $('liveTag').hidden = true;
    applyTheme(D.theme); renderAll(); refreshWin(); nudges();
  } catch (err) { $('liveTag').hidden = false; }
}

// ---- Charts ----
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
const pips = k => '<div class="pips">' + Array.from({ length: k.peak }, (_, i) => '<i class="' + (i < k.level ? 'on' : '') + '"></i>').join('') + '</div>';
const todoBtn = (x, g, cls) => '<button type="button" class="todo' + (x.done ? ' done' : '') + (x.added ? ' new' : '') + (cls ? ' ' + cls : '') + '" data-act="todo" data-g="' + g + '" data-t="' + esc(x.t) + '" role="checkbox" aria-checked="' + !!x.done + '"><span class="chk"></span><span class="tx">' + esc(x.t) + '</span>' + (x.due && !x.done ? '<em>' + esc(x.due) + '</em>' : '<span></span>') + '</button>';

// ---- The Goku card's load chart (rdecaste/MainQuest index.html, loadChart), the same widget here ----
// 84 days of long-term load (fitness, the power level) and short-term load (fatigue), the
// unlocked moves' marks, a strip with each day's form, the load ratio with the engine's bands,
// and each morning's recovery. A pointer on it reads a day across all rows.
const LD_W = 246, LD_H = 150, LD_RH = 58, WD3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REC_TEXT = { good: 'Good to go', steady: 'Go steady', easy: 'Take it easy' };
const fmtNum = n => Math.round(Number(n) || 0).toLocaleString('en-GB');
const RATIO_ZONE = (r, b) => (r === null || r === undefined ? null : r < b.low ? 'Low' : r <= b.optimal ? 'Optimal' : r <= b.high ? 'High' : 'Risk');
function loadChart(load, moves) {
  const long = load.long.map(Number), short = load.short.map(Number), n = long.length;
  const marks = (moves || []).filter(m => m.name && m.state !== 'locked').map(m => ({ p: Number(m.power), n: m.name })).filter(m => m.p > 0);
  const yMax = Math.max(1, ...long, ...short) * 1.05;
  const x = i => (i / Math.max(1, n - 1)) * LD_W;
  const y = v => 8 + (1 - v / yMax) * (LD_H - 12);
  const path = vals => vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  let prevY = null, right = false;
  const lines = marks.filter(m => m.p <= yMax).sort((a, b) => a.p - b.p).map(m => {
    const my = y(m.p);
    right = prevY !== null && Math.abs(prevY - my) < 18 ? !right : false;
    prevY = my;
    return '<line x1="0" x2="' + LD_W + '" y1="' + my + '" y2="' + my + '" stroke="rgba(255,214,92,.55)" stroke-dasharray="3 4" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
      '<text x="' + (right ? LD_W - 2 : 2) + '" y="' + (my - 3) + '" text-anchor="' + (right ? 'end' : 'start') + '" font-size="8" font-weight="800" fill="rgba(255,214,92,.8)">' + esc(m.n) + ' · ' + esc(fmtNum(m.p)) + '</text>';
  }).join('');
  const start = Date.parse(load.from + 'T12:00:00Z');
  const dayOf = i => new Date(start + i * 86400000);
  let months = '';
  for (let i = 0; i < n; i++) { const d = dayOf(i); if (d.getUTCDate() === 1) months += '<span style="left:' + (i / (n - 1)) * 100 + '%">' + MON[d.getUTCMonth()] + '</span>'; }
  const ratio = Array.isArray(load.ratio) && load.ratio.length === n ? load.ratio.map(r => (r === null ? null : Number(r))) : null;
  const rec = Array.isArray(load.recovery) && load.recovery.length === n ? load.recovery : null;
  const bands = load.ratio_bands || { low: 0.8, optimal: 1.3, high: 1.5 };
  const ry = r => 2 + (1 - Math.min(2, Math.max(0, r)) / 2) * (LD_RH - 4);
  let ratioRow = '';
  if (ratio) {
    const band = (a, b, c) => '<rect x="0" width="' + LD_W + '" y="' + ry(b) + '" height="' + (ry(a) - ry(b)) + '" fill="' + c + '"/>';
    let d = '', on = false;
    ratio.forEach((r, i) => { if (r === null) { on = false; return; } d += (on ? 'L' : 'M') + x(i).toFixed(1) + ' ' + ry(r).toFixed(1); on = true; });
    const lastR = ratio[n - 1];
    ratioRow = '<div class="ld-row" data-tip="@ratio"><span>Load ratio · short ÷ long</span><b>' + (lastR === null ? '–' : esc(lastR.toFixed(2)) + ' · ' + esc(RATIO_ZONE(lastR, bands))) + '</b></div>' +
      '<svg class="ld-ratio" viewBox="0 0 ' + LD_W + ' ' + LD_RH + '" preserveAspectRatio="none" aria-label="Load ratio, last 12 weeks">' +
      band(bands.low, bands.optimal, 'rgba(61,220,132,.16)') + band(bands.high, 2, 'rgba(255,95,95,.14)') +
      '<line x1="0" x2="' + LD_W + '" y1="' + ry(1) + '" y2="' + ry(1) + '" stroke="rgba(255,255,255,.12)" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>' +
      '<text x="2" y="' + (ry(bands.optimal) + 8) + '" font-size="7" font-weight="800" fill="rgba(125,255,176,.75)">' + esc(bands.low) + '–' + esc(bands.optimal) + '</text>' +
      '<text x="2" y="' + (ry(2) + 8) + '" font-size="7" font-weight="800" fill="rgba(255,159,159,.8)">' + esc(bands.high) + '+</text>' +
      '<path d="' + d + '" fill="none" stroke="#cfe3ff" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      (lastR === null ? '' : '<circle cx="' + x(n - 1) + '" cy="' + ry(lastR) + '" r="2.6" fill="#cfe3ff"/>') +
      '<circle class="ld-cr" r="3" fill="#cfe3ff" visibility="hidden"/></svg>';
  }
  const recRow = rec
    ? '<div class="ld-row" data-tip="@recovery"><span>Recovery · each morning</span><b>' + (rec[n - 1] ? 'Today ' + esc(REC_TEXT[rec[n - 1]] || rec[n - 1]) : 'No night yet today') + '</b></div>' +
      '<div class="ld-rec">' + rec.map(r => '<span class="rc-' + (REC_TEXT[r] ? r : 'none') + '"></span>').join('') + '</div>'
    : '';
  const html =
    '<div class="ld-wrap"><svg class="ld-chart" viewBox="0 0 ' + LD_W + ' ' + LD_H + '" preserveAspectRatio="none" aria-label="Long-term and short-term load, last 12 weeks">' + lines +
    '<path d="' + path(long) + ' L' + LD_W + ' ' + LD_H + ' L0 ' + LD_H + 'Z" fill="rgba(63,216,232,.14)"/>' +
    '<path d="' + path(short) + '" fill="none" stroke="#a28bff" stroke-width="1.6" stroke-linejoin="round" opacity=".9" vector-effect="non-scaling-stroke"/>' +
    '<path d="' + path(long) + '" fill="none" stroke="#3fd8e8" stroke-width="2.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
    '<circle class="ld-cf" r="3.5" fill="#3fd8e8" visibility="hidden"/><circle class="ld-ca" r="3" fill="#a28bff" visibility="hidden"/></svg>' +
    '<div class="ld-strip">' + load.form.map(f => '<span class="fs-' + esc(f) + '"></span>').join('') + '</div>' +
    ratioRow + recRow +
    '<div class="ld-x">' + months + '</div><div class="ld-cursor" hidden></div><div class="ld-tip" hidden></div></div>';
  const bind = wrap => {
    const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.ld-tip'), cur = wrap.querySelector('.ld-cursor'), cr = wrap.querySelector('.ld-cr');
    const dots = [...svg.querySelectorAll('.ld-cf,.ld-ca')];
    const show = i => {
      const cx = x(i), d = dayOf(i);
      svg.querySelector('.ld-cf').setAttribute('cx', cx); svg.querySelector('.ld-cf').setAttribute('cy', y(long[i]));
      svg.querySelector('.ld-ca').setAttribute('cx', cx); svg.querySelector('.ld-ca').setAttribute('cy', y(short[i]));
      dots.forEach(m => m.setAttribute('visibility', 'visible'));
      const r = ratio ? ratio[i] : null;
      if (cr) { cr.setAttribute('cx', cx); if (r !== null) cr.setAttribute('cy', ry(r)); cr.setAttribute('visibility', r === null ? 'hidden' : 'visible'); }
      const rc = rec ? rec[i] : null;
      tip.innerHTML = WD3[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + '<br><span class="f">Long-term ' + esc(fmtNum(long[i])) + '</span><br><span class="a">Short-term ' + esc(fmtNum(short[i])) + '</span>' +
        (ratio && r !== null ? '<br><span class="r">Ratio ' + esc(r.toFixed(2)) + ' · ' + esc(RATIO_ZONE(r, bands)) + '</span>' : '') +
        '<br><span class="form-chip fs-' + esc(load.form[i]) + '">' + esc(load.form[i]) + '</span>' +
        (rec ? ' <span class="form-chip rc-' + (REC_TEXT[rc] ? rc : 'none') + '">' + esc(REC_TEXT[rc] || 'No night') + '</span>' : '');
      tip.hidden = false;
      const w = wrap.clientWidth, left = (cx / LD_W) * w;
      cur.style.left = left + 'px'; cur.hidden = false;
      tip.style.left = Math.max(0, Math.min(w - tip.offsetWidth, left + (left > w / 2 ? -tip.offsetWidth - 8 : 8))) + 'px';
    };
    const hide = () => { tip.hidden = true; cur.hidden = true; dots.forEach(m => m.setAttribute('visibility', 'hidden')); if (cr) cr.setAttribute('visibility', 'hidden'); };
    const at = ev => { const r = wrap.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) / r.width) * (n - 1)))); };
    wrap.addEventListener('pointerdown', ev => { if (!ev.target.closest('.ld-row')) { ev.stopPropagation(); show(at(ev)); } });
    wrap.addEventListener('pointermove', ev => { if (ev.target.closest('.ld-row')) { hide(); return; } show(at(ev)); });
    wrap.addEventListener('pointerleave', hide);
    wrap.addEventListener('pointercancel', hide);
  };
  return { html, bind };
}

// ---- Tooltips ----
const TIPS = {
  recovery: () => { const r = R(); if (!r) return '<span class="tt">Recovery</span>No night synced yet.'; const U = F().usual, lab = REC_LABEL[r.verdict];
    return '<span class="tt">Recovery · ' + (r.fresh ? 'last night' : 'night to ' + dayFmt(r.date)) + ' · from the quest engine</span><b style="color:' + recColor(r.score) + '">' + lab[0] + ' · ' + lab[1] + '</b><div class="kv"><span>Sleep</span><b>' + sleepTxt(r.sleep) + '</b><span class="mut">usual ' + sleepTxt(U.sleep) + '</span><span>HRV</span><b>' + (r.hrv == null ? '–' : r.hrv + ' ms') + '</b><span class="mut">usual ' + one(U.hrv) + '</span><span>Resting HR</span><b>' + (r.rhr == null ? '–' : r.rhr) + '</b><span class="mut">usual ' + one(U.rhr) + '</span></div><span class="hint">' + lab[2] + '. Tap for the last 7 nights.</span>'; },
  ratio: () => { const R2 = RATIO(); if (!R2) return ''; const z = [0, R2.zone, ZC[R2.zone]], rp = R2.yesterday, Pk = F().peak, why = Pk && L().length > 1 && Pk.date === PREV().date ? ' after the ' + esc(Pk.what) : '';
    return '<span class="tt">Load ratio · fatigue ÷ fitness · from the quest engine</span><b style="color:' + z[2] + '">' + R2.value.toFixed(2) + ' · ' + esc(R2.zone) + '</b>' + (R2.tsb != null ? ' <span class="mut">· TSB ' + (R2.tsb > 0 ? '+' : '') + R2.tsb + ' ' + esc(R2.state || '') + '</span>' : '') + '<br>' + esc(RSAY[R2.zone] || '') + '<span class="hint">' + (rp && rp.value != null ? 'Yesterday ' + rp.value.toFixed(2) + why + '. ' : '') + 'Low under ' + R2.bands.low + ', optimal to ' + R2.bands.optimal + ', high to ' + R2.bands.high + ', risk above.</span>'; },
  ki: () => { const k = F().ki; return k ? '<span class="tt">Ki charge</span><b>' + k.level + ' of ' + k.peak + ' · ' + kiState(k) + '</b><div class="kv"><span>Healing cap</span><b>' + (k.heal_cap || '–') + ' HP</b><span></span><span>Overnight bonus</span><b>+' + Math.round((k.recovery_bonus || 0) * 100) + '%</b><span></span></div>' : ''; },
  commute: () => { const b = border(), T = workToday(); return '<span class="tt">Commute</span><div class="kv"><span>Morning</span><b>' + esc(T.am) + '</b><span></span><span>Afternoon</span><b>' + esc(T.pm) + '</b><span></span><span>Ride</span><b>' + esc(T.commute) + '</b><span></span></div><span class="hint">' + b.share + '% of this year’s work days in Belgium (minimum 50%), ' + b.spare + ' days to spare. Tap to change today.</span>'; },
  steph: () => { const open = stephList().filter(x => !x.done); return '<span class="tt">From Steph</span>' + (open.length ? '<ul>' + open.map(x => '<li>' + esc(x.t) + (x.due ? ' <span class="mut">· ' + esc(x.due) + '</span>' : '') + '</li>').join('') + '</ul>' : 'Nothing open. To-dos tagged Steph in the journal land here.'); },
  dates: () => { const l = COMING().slice(0, 6); return '<span class="tt">Coming up · family calendar</span>' + (l.length ? '<div class="kv">' + l.map(i => '<span>' + esc(daySpan(i)) + '</span><b>' + esc(i.t) + '</b><span class="mut">' + esc(WHO[i.who] === 'Everyone' ? '' : WHO[i.who] || '') + '</span>').join('') + '</div>' : 'Nothing in the next 30 days.') + '<span class="hint">' + (D.calendar ? 'Read from the shared iCloud calendar, refreshed every 10 minutes.' : 'No calendar connected.') + '</span>'; },
  quest: () => { const q = D.quest; return q ? '<span class="tt">Quest · ' + esc(q.phase) + ' phase</span><b>' + esc(q.title) + '</b><br><span class="mut">Next move:</span> ' + esc(q.next_move) + (q.longest_km && q.goal_km ? '<span class="hint">Longest run ' + q.longest_km + ' of ' + q.goal_km + ' km · ' + q.days_left + ' days to go</span>' : '') : ''; },
  weather: () => { const w = D.weather; return w && w.temp != null ? '<span class="tt">Weather at home</span><b>' + Math.round(w.temp) + '° · ' + esc(WMO[w.code] || '') + '</b>' + (w.feels != null ? '<br>Feels like ' + Math.round(w.feels) + '°' : '') + '<div class="kv"><span>Today</span><b>' + (w.hi != null ? Math.round(w.hi) + '° / ' + Math.round(w.lo) + '°' : '–') + '</b><span></span><span>Rain chance</span><b>' + (w.rain != null ? w.rain + '%' : '–') + '</b><span></span><span>Wind</span><b>' + (w.wind != null ? Math.round(w.wind) + ' km/h' : '–') + '</b><span></span><span>Sun</span><b>' + esc(w.sunrise || '–') + ' – ' + esc(w.sunset || '–') + '</b><span></span></div><span class="hint">' + esc(rainSoon(w)) + ' Open-Meteo for home, every 15 minutes.</span>' : ''; },
  habits: () => { const m = nowMin(); return '<span class="tt">Main habits · from the boss card</span>' + D.main.map(x => { const st = habitState(x, m); return '<div class="hb-line ' + st.st + '">' + esc(x.icon) + ' ' + esc(x.short) + ' <span class="mut">· ' + habitLine(x, st) + '</span></div>'; }).join('') + '<span class="hint">Tick them off on the boss card: tap the boss.</span>'; },
  boss: () => { const b = BOSS().boss; return b ? '<span class="tt">Boss' + (b.level ? ' · level ' + b.level : '') + '</span><b>' + esc(b.name) + '</b>' + (b.epithet ? '<br><span class="mut">' + esc(b.epithet) + '</span>' : '') + '<br>HP ' + fmtNum(b.hp) + ' of ' + fmtNum(b.max) + (b.status && b.status !== 'Active' ? ' · ' + esc(b.status) : '') + '<span class="hint">Tap to open the boss card</span>' : '<span class="tt">Boss</span>The boss card did not answer.'; },
  goku: () => { const g = BOSS().goku; return g ? '<span class="tt">Goku' + (g.form ? ' · ' + esc(g.form) : '') + '</span><div class="kv">' + (g.level ? '<span>Level</span><b>' + g.level + '</b><span></span>' : '') + (g.max_hp ? '<span>HP</span><b>' + fmtNum(g.hp) + ' / ' + fmtNum(g.max_hp) + '</b><span class="mut">' + (g.shield ? '+' + g.shield + ' ki shield' : '') + '</span>' : '') + (g.xp_max ? '<span>XP</span><b>' + fmtNum(g.xp) + ' / ' + fmtNum(g.xp_max) + '</b><span></span>' : '') + (g.power ? '<span>Power level</span><b>' + fmtNum(g.power) + '</b><span></span>' : '') + '</div><span class="hint">Tap to open the Goku card</span>' : ''; },
  lastmood: () => { const m = lastMood(); return m ? '<span class="tt">Last logged · ' + hhmm(m.at) + '</span><b>' + FEEL[m.m - 1] + '</b>' + (m.note ? '<br>' + esc(m.note) : '') : 'No mood logged yet today'; },
  blk: el => { const e = ALLEV().find(x => x.id === el.dataset.id); if (!e) return ''; return '<span class="tt">' + esc(WHO[e.who] || '') + ' · ' + e.from + '–' + e.to + ' · ' + dur(minOf(e.to) - minOf(e.from)) + '</span><b>' + esc((e.ic || '') + ' ' + e.t) + '</b><span class="hint">' + (e.cal ? 'From the family calendar' : 'Tap to edit') + '</span>'; }
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
  const n = F().nights.length; if (!n) return; const i = Math.max(0, Math.min(n - 1, Math.floor(f * n))); if (xh) { xh.style.left = ((i + .5) / n * 100) + '%'; xh.style.opacity = 1; } showTipAt(nightTip(i), e.clientX, r.top, r.bottom); 
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
  if (due.length) notify({ key: 'due:' + due.map(x => x.name).join(), app: 'boss', open: 'boss', html: 'Due now: ' + list(due) + '. Tick it off on the boss card.' });
  if (late.length) notify({ key: 'late:' + late.map(x => x.name).join(), app: 'boss', open: 'boss', html: 'Still open: ' + list(late) + '. Tap to open the boss card and tick it off.' });
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

// ---- The board: 1920 × 1080, scaled to the window and centred; the phone layout flows instead ----
const BW = 1920, BH = 1080;
const portrait = () => matchMedia('(max-width: 900px), (orientation: portrait)').matches;
function fitBoard() {
  const b = $('board');
  if (portrait()) { b.style.transform = ''; return; }
  const s = Math.min(innerWidth / BW, innerHeight / BH);
  b.style.transform = 'translate(' + Math.round((innerWidth - BW * s) / 2) + 'px, ' + Math.round((innerHeight - BH * s) / 2) + 'px) scale(' + s + ')';
}
// Burn-in care: everything on the board but the world shifts by a pixel or two every four minutes.
const DRIFT = [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [2, 1], [0, 2], [-2, 1], [-1, -2], [2, -1]];
let driftAt = 0;
function drift() { const [x, y] = DRIFT[++driftAt % DRIFT.length]; $('os').style.translate = x + 'px ' + y + 'px'; }

// ---- The critters ----
// Three small animals live on the board: a black cat, a Zaun rat and a gecko. They walk the top
// edges of the tiles, stop, and jump from tile to tile; the gecko also climbs down the tiles' sides.
// They never take a tap (pointer-events: none), hide at night, in the phone layout and with
// reduced motion, and only run while the page is visible.
const CRIT_ART = {
  cat: '<svg viewBox="0 0 64 44" width="64" height="44">' +
    '<g class="p-walk"><path class="tail" d="M13 21 C6 20 3 13 5 5"/>' +
      '<g class="leg far lhf"><path d="M14 23 C12 29 15.5 33 14.6 37.5 L13.4 43.6 L17.6 43.6 L19 37.5 C20.6 33 22 29 23 24 Z"/></g>' +
      '<g class="torso"><g class="leg far lff"><path d="M39.6 24 L39 43.6 L43 43.6 L44.4 24 Z"/></g>' +
        '<path d="M10 24 C10 16 18 13.5 27 14.5 C35 15.2 42 13.8 47 15.6 C51 17.2 51.5 25 48 28 C41 31 23 31.2 16 30 C12 29.2 10 27 10 24 Z"/>' +
        '<g class="leg lfn"><path d="M43 24 L42.4 43.6 L46.4 43.6 L47.8 24 Z"/></g>' +
        '<g class="head"><path d="M44 19 C45 13.5 48.5 10 53 10 C57.5 10 60.5 12.6 60.5 16 C60.5 18.5 59 20.3 56 21 C52 22 47 22.5 44 19 Z"/><path d="M48.8 11.6 L49.6 4.8 L53.6 9.6 Z"/><path d="M54.2 9.8 L57.8 4.6 L58.6 11.2 Z"/><ellipse class="eye" cx="56.3" cy="14.4" rx="1.35" ry=".75"/></g></g>' +
      '<g class="leg lhn"><path d="M18 23 C16 29 19.5 33 18.6 37.5 L17.4 43.6 L21.6 43.6 L23 37.5 C24.6 33 26 29 27 24 Z"/></g></g>' +
    '<g class="p-sit"><path class="tail" d="M13 42.6 C21 45 36 45 45 42.6"/>' +
      '<ellipse cx="23" cy="35.5" rx="11.5" ry="8.4"/><path d="M22 31 C23 23 28 18 35 17 C40 16.6 43 20 42.5 26 L41.6 43.6 L35 43.6 C34 38 30 34 22 31 Z"/>' +
      '<path d="M36.4 27 L35.8 43.6 L39.2 43.6 L40.2 27 Z"/><g class="paw"><path d="M38.6 30 C39.6 26 41.4 22 43 18.8 L45.6 19.8 C44.2 23 42.6 27 41.6 31 Z"/></g>' +
      '<g class="head"><path d="M33 12.5 C33 8 36.5 5 41 5 C45.5 5 48.5 8 48 12 C47.5 15.5 44.5 17.5 41 17.5 C36.5 17.5 33 16 33 12.5 Z"/><path d="M35 7.6 L35.6 .6 L40 4.8 Z"/><path d="M41.6 5 L45.6 .4 L46.6 7 Z"/><ellipse class="eye" cx="44.4" cy="10.6" rx="1.3" ry=".75"/></g></g>' +
    '<g class="p-sleep"><path class="tail" d="M16 41 C18 46.5 38 47 48 42"/><ellipse class="breathe" cx="31" cy="37.6" rx="16" ry="6.6"/>' +
      '<g class="head"><path d="M38 38 C38 33.5 41.5 31 45.5 31 C49.5 31 52 33.5 52 37 C52 40.5 49 42.5 45 42.5 C41 42.5 38 41 38 38 Z"/><path d="M41.5 32.6 L42.5 27.6 L45.6 31.4 Z"/><path d="M46.4 31.2 L50 27.8 L50.4 33 Z"/></g></g></svg>',
  rat: '<svg viewBox="0 0 56 24" width="56" height="24">' +
    '<g class="body"><path class="tail" d="M10 19 C3 19.5 -4 22.5 -14 21"/>' +
      '<g class="leg far lhf"><path d="M16 18 C15 21 15.4 23 16.4 24 L19.4 24 C19 22 19.4 20 20.4 18 Z"/></g>' +
      '<g class="leg far lff"><path d="M38 18 L37.5 24 L40 24 L40.5 18 Z"/></g>' +
      '<g class="torso"><path class="fur" d="M8 18.5 C8 11.5 16 8.5 26 9 C33 9.4 39 11 43 13.6 C46 15.6 46 18.8 43.5 19.8 C38 21.6 26 22 18 21.8 C11 21.6 8 20.6 8 18.5 Z"/>' +
        '<g class="snout"><path class="fur" d="M39 12.5 C43 11.6 48.5 13.4 53.2 16.4 C54.6 17.4 54 18.8 52.2 18.9 C48 19.2 43.5 19 40.5 18.2 Z"/><circle class="nose" cx="53.6" cy="17.3" r=".9"/><path class="whisk" d="M51 17 L58 14.4 M51 17.4 L58.6 17.6 M51 17.8 L57.6 20.6"/></g>' +
        '<circle class="ear" cx="41" cy="10.4" r="3.3"/><circle class="earin" cx="41.3" cy="10.6" r="1.9"/><circle class="eye" cx="46.6" cy="14" r="1.05"/><circle class="glint" cx="46.9" cy="13.7" r=".35"/></g>' +
      '<g class="leg lhn"><path d="M13 16 C11.5 20 12 22.5 13.5 24 L17 24 C16 22 16.6 19.5 18.5 17 Z"/></g>' +
      '<g class="leg lfn"><path d="M41 18 L40.6 24 L43 24 L43.4 18 Z"/></g></g></svg>',
  gecko: '<svg viewBox="0 0 62 16" width="62" height="16">' +
    '<g class="body"><path class="fur tailg" d="M17 10.2 C9 9.6 1 11 -10 12.8 C1 13.2 9 13.6 17 13.4 Z"/>' +
      '<path class="leg far lhf" d="M21 12 L24.5 15.2 L27 15.6"/><path class="leg far lff" d="M36 12 L33.5 15.2 L31 15.6"/>' +
      '<path class="fur" d="M15 10.5 C19 7.4 30 6.6 38 7.6 C42.5 8.2 45 9.6 45 11.4 C45 12.9 41.5 13.8 37 13.9 C29 14.1 21 13.9 15 13.4 Z"/>' +
      '<path class="fur head" d="M43 8.4 C47 6.8 53 7.2 57.5 9.6 C59 10.5 58.6 12.2 56.6 12.6 C52 13.3 47 13.2 44 12.7 Z"/>' +
      '<g class="spots"><circle cx="20" cy="10.6" r=".9"/><circle cx="25" cy="9.2" r="1"/><circle cx="30" cy="8.8" r=".9"/><circle cx="35" cy="9.1" r="1"/><circle cx="39.5" cy="9.8" r=".8"/><circle cx="27.5" cy="11.6" r=".7"/><circle cx="33" cy="11.5" r=".7"/><circle cx="9" cy="11.2" r=".7"/><circle cx="3" cy="11.9" r=".6"/></g>' +
      '<circle class="eye" cx="51.5" cy="9.7" r="1.45"/><path class="pupil" d="M51.5 8.6 L51.5 10.8"/>' +
      '<path class="leg lhn" d="M19 12.5 L16 15.2 L13.5 15.8"/><path class="leg lfn" d="M39 12.5 L42 15.2 L44.5 15.8"/></g></svg>'
};
const SPECIES = {
  cat: { w: 64, h: 44, home: e => e.id === 'wAsk', reach: [460, 300, 440], crouch: 240, arc: 40 },
  rat: { w: 56, h: 24, home: e => e.classList.contains('day'), reach: [260, 200, 420], crouch: 0, arc: 26 },
  gecko: { w: 62, h: 16, home: e => e.id === 'wFocus', reach: [190, 40, 300], crouch: 0, arc: 16 }
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = w => { let r = rnd(0, Object.values(w).reduce((n, x) => n + x, 0)); for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; };
let CRP = [], CRITS = [], crLast = 0, crSeen = 0, crOffNow = true;
function crPlats() {
  return qa('.os > .t').filter(e => e.offsetParent && !e.hidden).map(e => ({ el: e, x1: e.offsetLeft + 12, x2: e.offsetLeft + e.offsetWidth - 12, y: e.offsetTop, l: e.offsetLeft, r: e.offsetLeft + e.offsetWidth, b: e.offsetTop + e.offsetHeight }));
}
const crPl = c => CRP.find(q => q.el === c.pe);
function crGo(c, mode, ms, t) { c.mode = mode; c.until = t + ms; }
function crWalk(c, t, v, ms) { c.v = v; crGo(c, 'walk', ms, t); }
// A jump to another tile within the species' reach, preferring the way it faces; never straight up or down.
function crLeap(c, t) {
  const S = SPECIES[c.sp], here = crPl(c), opts = [];
  CRP.forEach(q => {
    if (q === here) return;
    [c.dir, -c.dir].forEach(dir => {
      const tx = Math.min(q.x2, Math.max(q.x1, c.x + dir * rnd(60, S.reach[0] * .7))), dx = tx - c.x, dy = q.y - here.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) > S.reach[0] || dy < -S.reach[1] || dy > S.reach[2]) return;
      opts.push({ q, tx, w: (Math.sign(dx) === c.dir ? 3 : 1) / (1 + Math.abs(dx) / 200) });
    });
  });
  if (!opts.length) return false;
  let r = rnd(0, opts.reduce((n, o) => n + o.w, 0)), o = opts[0];
  for (const x of opts) { r -= x.w; if (r <= 0) { o = x; break; } }
  const up = Math.max(0, here.y - o.q.y);
  c.dir = o.tx >= c.x ? 1 : -1;
  c.jump = { x0: c.x, y0: c.y, x1: o.tx, pe: o.q.el, d: .42 + Math.abs(o.tx - c.x) / 1000 + up / 1400, H: S.arc + up };
  if (S.crouch) crGo(c, 'crouch', S.crouch, t); else { c.jump.t0 = t; c.mode = 'jump'; }
  return true;
}
// What each animal does next: at an edge, after landing, or when its current move runs out.
const CR_NEXT = {
  cat(c, t, why) {
    if (why === 'edge') { if (Math.random() < .75 && crLeap(c, t)) return; c.dir = -c.dir; return crWalk(c, t, 50, rnd(1500, 4000)); }
    if (why === 'land') return Math.random() < .4 ? crGo(c, 'sit', rnd(3000, 7000), t) : crWalk(c, t, 50, rnd(2000, 5000));
    if (c.mode === 'sleep') return crGo(c, 'stretch', 1600, t);
    if (c.mode === 'stretch') return crWalk(c, t, 50, rnd(2000, 5000));
    if (c.mode === 'sit') { const k = pick({ groom: 1.2, sleep: .5, walk: 2, leap: 1.2 }); if (k === 'leap' && crLeap(c, t)) return; if (k === 'groom') return crGo(c, 'groom', rnd(2500, 5000), t); if (k === 'sleep') return crGo(c, 'sleep', rnd(15000, 40000), t); return crWalk(c, t, 50, rnd(2000, 6000)); }
    if (c.mode === 'groom') return crGo(c, 'sit', rnd(2000, 5000), t);
    const k = pick({ walk: 2.5, trot: .6, sit: 2, leap: 2, turn: 1 });
    if (k === 'leap' && crLeap(c, t)) return;
    if (k === 'sit') return crGo(c, 'sit', rnd(3000, 8000), t);
    if (k === 'turn') c.dir = -c.dir;
    crWalk(c, t, k === 'trot' ? 95 : 50, rnd(1500, 5000));
  },
  rat(c, t, why) {
    if (why === 'edge') { if (Math.random() < .85 && crLeap(c, t)) return; c.dir = -c.dir; return crWalk(c, t, 150, rnd(300, 900)); }
    if (why === 'land') return crGo(c, 'sniff', rnd(600, 1500), t);
    const k = pick({ scurry: 4, sniff: c.mode === 'walk' ? 3 : .8, rear: c.mode === 'walk' ? .2 : 1, leap: 1.2, turn: 1 });
    if (k === 'leap' && crLeap(c, t)) return;
    if (k === 'sniff') return crGo(c, 'sniff', rnd(600, 2200), t);
    if (k === 'rear') return crGo(c, 'rear', rnd(1000, 2600), t);
    if (k === 'turn') c.dir = -c.dir;
    crWalk(c, t, rnd(120, 170), rnd(350, 1400));
  },
  gecko(c, t, why) {
    const pl = crPl(c);
    if (why === 'edge') {
      if (pl.b - pl.y > 70 && Math.random() < .6) { c.wall = { side: c.dir > 0 ? 'R' : 'L', x: c.dir > 0 ? pl.r : pl.l, top: pl.y, bottom: pl.b - 10 }; c.cy = pl.y; c.vdir = 1; c.cyTo = rnd(pl.y + 30, pl.b - 14); c.v = 150; c.mode = 'climb'; return; }
      if (Math.random() < .4 && crLeap(c, t)) return;
      c.dir = -c.dir; return crGo(c, 'freeze', rnd(500, 2000), t);
    }
    if (why === 'land') return crGo(c, 'freeze', rnd(800, 2500), t);
    if (c.mode === 'cling') {
      if (c.vdir > 0 && Math.random() < .35) { c.cyTo = Math.min(c.wall.bottom, c.cy + rnd(20, 90)); c.mode = 'climb'; return; }
      c.vdir = -1; c.cyTo = c.wall.top; c.mode = 'climb'; return;
    }
    if (c.mode === 'walk') return crGo(c, 'freeze', rnd(600, 3500), t);
    if (Math.random() < .3) c.dir = -c.dir;
    crWalk(c, t, rnd(150, 210), rnd(150, 550));
  }
};
function crTick(c, t, dt) {
  const pl = crPl(c);
  if (!pl) { const h = CRP.find(q => SPECIES[c.sp].home(q.el)) || CRP[0]; c.pe = h.el; c.x = rnd(h.x1, h.x2); c.y = h.y; c.wall = null; return crGo(c, 'freeze', 1000, t); }
  if (c.mode === 'jump') {
    const j = c.jump, k = Math.min(1, (t - j.t0) / (j.d * 1000)), to = CRP.find(q => q.el === j.pe) || pl;
    c.x = j.x0 + (j.x1 - j.x0) * k;
    c.y = j.y0 + (to.y - j.y0) * k - j.H * 4 * k * (1 - k);
    if (k >= 1) { c.pe = to.el; c.y = to.y; CR_NEXT[c.sp](c, t, 'land'); }
    return;
  }
  if (c.mode === 'crouch') { c.y = pl.y; if (t > c.until) { c.jump.t0 = t; c.mode = 'jump'; } return; }
  if (c.mode === 'climb') {
    c.cy += c.vdir * c.v * dt;
    if (c.vdir > 0 && c.cy >= c.cyTo) { c.cy = c.cyTo; crGo(c, 'cling', rnd(1200, 4500), t); }
    else if (c.vdir < 0 && c.cy <= c.wall.top) { c.dir = c.wall.side === 'R' ? -1 : 1; c.x = c.wall.side === 'R' ? pl.x2 : pl.x1; c.y = pl.y; c.wall = null; crGo(c, 'freeze', rnd(500, 1500), t); }
    return;
  }
  if (c.mode === 'cling') { if (t > c.until) CR_NEXT[c.sp](c, t, 'end'); return; }
  c.y = pl.y;
  if (c.mode === 'walk') {
    c.x += c.dir * c.v * dt;
    if (c.x <= pl.x1 || c.x >= pl.x2) { c.x = Math.min(pl.x2, Math.max(pl.x1, c.x)); return CR_NEXT[c.sp](c, t, 'edge'); }
  }
  if (t > c.until) CR_NEXT[c.sp](c, t, 'end');
}
function crDraw(c) {
  const S = SPECIES[c.sp], wall = c.mode === 'climb' || c.mode === 'cling';
  let flip = c.dir < 0;
  if (wall) {
    c.el.style.transform = 'translate(' + Math.round(c.wall.x - S.w / 2) + 'px, ' + Math.round(c.cy - S.h) + 'px) rotate(' + (c.wall.side === 'R' ? 90 : -90) + 'deg)';
    flip = c.wall.side === 'R' ? c.vdir < 0 : c.vdir > 0;
  } else c.el.style.transform = 'translate(' + Math.round(c.x - S.w / 2) + 'px, ' + Math.round(c.y - S.h + 1) + 'px)';
  c.el.classList.toggle('left', flip);
  const m = c.mode === 'walk' && c.v > 80 && c.sp === 'cat' ? 'trot' : c.mode;
  if (c.el.dataset.mode !== m) c.el.dataset.mode = m;
}
function crStep(t) {
  requestAnimationFrame(crStep);
  const dt = Math.min(.1, (t - (crLast || t)) / 1000); crLast = t;
  if (t - crSeen > 1000) {
    crSeen = t;
    crOffNow = portrait() || matchMedia('(prefers-reduced-motion: reduce)').matches || getComputedStyle($('lock')).display !== 'none';
    $('critters').hidden = crOffNow;
    if (!crOffNow) CRP = crPlats();
  }
  if (crOffNow || !CRP.length) return;
  CRITS.forEach(c => { crTick(c, t, dt); crDraw(c); });
}
function critters() {
  const box = $('critters'); if (!box) return;
  CRITS = Object.keys(SPECIES).map(sp => {
    const el = document.createElement('div'), S = SPECIES[sp];
    el.className = 'crit ' + sp; el.style.width = S.w + 'px'; el.style.height = S.h + 'px'; el.style.transformOrigin = S.w / 2 + 'px ' + S.h + 'px';
    el.innerHTML = '<div class="cb">' + CRIT_ART[sp] + '</div>';
    box.appendChild(el);
    return { sp, el, pe: null, x: 0, y: 0, dir: Math.random() < .5 ? 1 : -1, mode: 'freeze', until: 0, v: 0 };
  });
  requestAnimationFrame(crStep);
}

// ---- Theme and wallpaper ----
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ');
let wallNow = null, wallAr = 16 / 9, wallChoice = null;
function applyTheme(t) {
  const p = (t && t.palette) || { accent: '#6fd8ff', second: '#ff7ac8', tint: '9, 14, 27' }, st = document.documentElement.style;
  st.setProperty('--accent', p.accent); st.setProperty('--accent-rgb', hexRgb(p.accent)); st.setProperty('--second', p.second); st.setProperty('--tint', p.tint);
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
  const [w, h] = portrait() ? [innerWidth, innerHeight] : [BW, BH], dw = Math.max(w, h * wallAr), x = Math.max(w - dw, Math.min(0, w / 2 - .5 * dw));
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
addEventListener('resize', () => { fitBoard(); placeWall(); });

// ---- Rendering ----
// ---- The light of day on the glass ----
// A tint over the panels that follows the real sun: amber around sunrise, neutral by day,
// orange around sunset, a cool blue at night. The world clip is never tinted.
function daylight(m, sunrise, sunset) {
  const bell = (c, before, after) => (m < c ? Math.max(0, 1 - (c - m) / before) : Math.max(0, 1 - (m - c) / after));
  const dawn = bell(sunrise, 60, 90), dusk = bell(sunset, 60, 90);
  const night = m < sunrise - 60 || m > sunset + 90 ? 1 : m < sunrise ? (sunrise - m) / 60 : m > sunset ? (m - sunset) / 90 : 0;
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  let tint = [255, 255, 255], amt = 0;
  if (dawn >= dusk && dawn > 0) { tint = [255, 178, 96]; amt = .16 * dawn; }
  else if (dusk > 0) { tint = [255, 138, 84]; amt = .17 * dusk; }
  if (night > 0) { const k = Math.min(1, night); tint = mix(tint, [86, 118, 255], amt ? k * .6 : 1); amt = Math.max(amt, .11 * k); }
  return { tint, amt: +amt.toFixed(3), word: amt < .02 ? 'day' : dawn >= dusk && dawn > 0 && night < 1 ? 'dawn' : dusk > 0 && night < 1 ? 'dusk' : 'night' };
}
function renderLight(m) {
  const w = D.weather || {}, sr = minOf(w.sunrise || '07:30'), ss = minOf(w.sunset || '19:00');
  const L = daylight(m, sr, ss), r = document.documentElement.style;
  r.setProperty('--day-tint', L.tint.join(',')); r.setProperty('--day-amt', L.amt); document.body.dataset.light = L.word;
}
function renderClock() {
  const t = now(), m = minAt(t), ph = phaseOf(m);
  renderLight(m);
  if (ph !== clockPhase) { clockPhase = ph; document.body.classList.remove('awake'); }
  document.body.dataset.phase = ph;
  $('clock').textContent = $('trTime').textContent = hm(t);
  $('dateline').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t));
  $('trDate').textContent = dayFmt(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(t)));
  $('greet').textContent = { morning: 'Good morning, Roy', day: 'Keep going, Roy', evening: 'Good evening, Roy', night: 'Rest up, Roy' }[ph];
}
// ---- The weather tile: a sky icon for the conditions now, the temperature, feels like, today's range ----
const WX_KIND = code => (code == null ? 'none' : code <= 1 ? 'clear' : code <= 3 ? 'cloud' : code <= 49 ? 'fog' : code <= 57 ? 'drizzle' : code <= 67 || (code >= 80 && code <= 82) ? 'rain' : code <= 77 || code === 85 || code === 86 ? 'snow' : code >= 95 ? 'thunder' : 'cloud');
function skyHtml(kind, day, code) {
  const clouds = n => Array.from({ length: n }, (_, i) => '<i class="cl c' + (i + 1) + '"></i>').join('');
  let s = day ? '<i class="sun"></i>' : '<i class="moon"></i><i class="stars"></i>';
  if (kind === 'clear') s += code === 1 ? clouds(1) : '';
  else if (kind === 'cloud') s += clouds(code === 2 ? 2 : 3);
  else if (kind === 'fog') s += clouds(2) + '<i class="fog"></i><i class="fog f2"></i>';
  else if (kind === 'drizzle') s += clouds(3) + '<i class="rain light"></i>';
  else if (kind === 'rain') s += clouds(3) + '<i class="rain' + (code === 65 || code === 82 ? ' heavy' : '') + '"></i>';
  else if (kind === 'snow') s += clouds(3) + '<i class="snow"></i>';
  else if (kind === 'thunder') s += clouds(3) + '<i class="rain"></i><i class="flash"></i>';
  return s;
}
function renderWeather() {
  const w = D.weather, el = $('wWx'); if (!el) return;
  if (!w || w.temp == null) { el.hidden = true; return; }
  el.hidden = false;
  const kind = WX_KIND(w.code), sky = $('wxSky');
  sky.className = 'wx-sky ' + kind + (w.day ? ' is-day' : ' is-night'); sky.innerHTML = skyHtml(kind, w.day, w.code);
  $('wxTemp').textContent = Math.round(w.temp) + '°';
  $('wxTxt').textContent = (w.place || 'Home') + (w.feels != null ? ' · feels ' + Math.round(w.feels) + '°' : '');
  $('wxHl').innerHTML = w.hi != null ? '↑ ' + Math.round(w.hi) + '°<br>↓ ' + Math.round(w.lo) + '°' : '';
}
// The now pill: Roy's current block and the time left, else the next one, else free.
const leftTxt = min => (min < 60 ? Math.max(1, Math.round(min)) + ' min' : dur(min));
function renderIsland() {
  const m = nowMin(), r = laneNow('roy', m);
  $('islPill').innerHTML = r.cur ? '<em>NOW</em><span class="it">' + esc(r.cur.t) + ' · ' + leftTxt(r.cur.z - m) + ' left</span>'
    : r.next ? '<em>NEXT</em><span class="it">' + esc(r.next.t) + ' · in ' + leftTxt(r.next.a - m) + '</span>'
    : '<em>' + (ALLEV().length ? 'FREE' : 'PLAN') + '</em><span class="it">' + (ALLEV().length ? 'Nothing else planned today' : 'Nothing planned yet. Tap a lane to add.') + '</span>';
  $('islPanel').innerHTML = [['roy', 'Roy'], ['steph', 'Steph'], ['kids', 'Kids']].map(([w, name]) => { const x = laneNow(w, m);
    const cur = x.cur ? '<span><em>now</em>' + esc((x.cur.ic || '') + ' ' + x.cur.t) + ' <em>until ' + x.cur.to + '</em></span>' : '', nxt = x.next ? '<span class="nxt"><em>' + x.next.from + '</em>' + esc((x.next.ic || '') + ' ' + x.next.t) + '</span>' : '';
    return '<div class="isl-row"><span class="who ' + w + '">' + name + '</span><div class="what">' + (cur || nxt ? cur + nxt : '<span class="nxt">Free for the rest of the day</span>') + '</div></div>'; }).join('');
}
// The line written on the world: the focus quest's quote; a tap opens the quest.
function renderQuote() {
  const q = D.quest, el = $('quote');
  el.hidden = !(q && q.quote);
  if (el.hidden) return;
  el.innerHTML = '<span class="q">“' + esc(q.quote) + '”</span><small>' + esc(q.author || 'The quest') + '</small>';
  el.setAttribute('aria-label', '“' + q.quote + '”' + (q.author ? ', ' + q.author : '') + '. Open Quest');
}
function renderFocusW(max = focusMax) {
  const all = focusList('must').concat(focusList('can'));
  $('focusCount').textContent = all.filter(x => x.done).length + '/' + all.length;
  $('winIf').innerHTML = '<small>Today is a win if</small>' + (D.journal.win_if ? '<span class="wtx">' + esc(D.journal.win_if) + '</span>' : '<span class="say">Not set in your journal yet.</span>');
  const must = focusList('must').filter(x => !x.done).map(x => ({ x, g: 'must' })), can = focusList('can').filter(x => !x.done).map(x => ({ x, g: 'can' })), list = must.concat(can);
  $('focusTodos').innerHTML = list.length ? list.slice(0, max).map(o => todoBtn(o.x, o.g)).join('') + (list.length > max ? '<div class="tmore">' + (max ? '+' + (list.length - max) + ' more' : list.length + ' open, tap Focus to see them') + '</div>' : '') : all.length ? '<div class="alldone">All done. That’s a win.</div>' : '<div class="tsay">No to-dos yet. Add one in Focus.</div>';
}
// Focus shows as many open to-dos as fit (up to 3) above Showdown, keeping the mockup's gap of at
// least 16 px, so the left column never runs together. (In the phone layout everything flows.)
let focusMax = 3;
const GAP = 16;
// The side columns share the screen's 1080 px: each stack runs from its top to 16 px above the
// day row, its tiles spaced evenly, so the bottoms line up with Your day and Ask Claude.
const COLS = [{ ids: ['wFocus', 'wBoss', 'wMe'], top: 262 }, { ids: ['wWx', 'wDates', 'wSteph', 'wMood', 'wCommute'], top: 54 }], COL_END = 892 - GAP;
const colRoom = c => COL_END - c.top - c.ids.reduce((n, id) => n + $(id).offsetHeight, 0) - GAP * (c.ids.length - 1);
function stackCol(c) {
  const els = c.ids.map($), free = COL_END - c.top - els.reduce((n, e) => n + e.offsetHeight, 0), gap = Math.max(GAP, free / (els.length - 1));
  let y = c.top;
  for (const e of els) { e.style.top = Math.round(y) + 'px'; y += e.offsetHeight + gap; }
}
function fitLeft() {
  if (portrait()) { COLS.forEach(c => c.ids.forEach(id => { $(id).style.top = ''; })); return; }
  for (focusMax = 3; focusMax > 0 && colRoom(COLS[0]) < 0; ) renderFocusW(--focusMax);
  COLS.forEach(stackCol);
}
function fitAfterRender() { if (focusMax !== 3) { focusMax = 3; renderFocusW(); } fitLeft(); }
// Showdown: the boss's HP and Goku's front-of-card metrics, read from the quest engine.
const BOSS = () => D.boss || { boss: null, goku: null };
const short = n => (Math.abs(n) >= 10000 ? (Math.round(n / 100) / 10).toLocaleString('en-GB') + 'k' : fmtNum(n));
const sbar = (c, v, max, extra) => '<span class="sbar"><i style="width:' + pct(v, max) + '%;--c:' + c + '"></i>' + (extra || '') + '</span>';
const tnum = (v, max) => '<span class="tn">' + short(v) + ' <small>/ ' + short(max) + '</small></span>';
function renderBossW() {
  const m = nowMin(), done = D.main.filter(x => habitState(x, m).st === 'done').length, b = BOSS().boss, g = BOSS().goku;
  $('bossTitle').textContent = 'Goku vs ' + (b ? b.name : 'the boss');
  $('bossHabits').textContent = D.main.length ? done + '/' + D.main.length + ' habits' : '';
  $('bossSide').setAttribute('aria-label', b ? 'Boss ' + b.name + ', HP ' + Math.round(b.hp) + ' of ' + b.max + '. Open the boss card' : 'Open the boss card');
  $('bossSide').innerHTML = '<span class="k">Boss' + (b && b.level ? ' · Lv ' + b.level : '') + '</span>' + (b
    ? sbar('var(--bad)', b.hp, b.max) + (b.status && b.status !== 'Active' ? '<span class="tn">' + esc(b.status) + '</span>' : tnum(b.hp, b.max))
    : '<span class="say">Not answering</span>');
  $('gokuSide').setAttribute('aria-label', g ? 'Goku, level ' + (g.level || '') + '. Open the Goku card' : 'Open the Goku card');
  $('gokuSide').innerHTML = g
    ? '<span class="k">Goku' + (g.level ? ' · Lv ' + g.level : '') + '</span>' + (g.max_hp ? sbar('var(--good)', g.hp, g.max_hp, g.shield ? '<b style="left:' + pct(g.hp, g.max_hp) + '%;width:' + Math.min(pct(g.shield, g.max_hp), 100 - pct(g.hp, g.max_hp)) + '%"></b>' : '') + tnum(g.hp, g.max_hp) : '<span></span><span></span>') +
      (g.power || g.xp_max ? '<span class="k pw">' + (g.power ? '⚡ ' + fmtNum(g.power) : '') + '</span>' + (g.xp_max ? sbar('var(--gold)', g.xp, g.xp_max) + tnum(g.xp, g.xp_max) : '<span></span><span></span>') : '')
    : '<span class="k">Goku</span><span class="say">Not answering</span>';
}
// Me today: the recovery ring, the load ratio, ki charge and this week's training.
function renderMe() {
  const r = R(), k = F().ki, R2 = RATIO(), wk = F().week;
  $('meSay').textContent = r ? REC_LABEL[r.verdict][1] : '';
  $('meBody').innerHTML = '<div class="ringw" data-open="body" data-arg="recovery" data-tip="@recovery" role="button" tabindex="0" aria-label="' + (r ? 'Recovery ' + r.score + '%' : 'Recovery') + ', open Body">' +
      (r ? '<div class="mring" style="--p:' + r.score + ';--c:' + recColor(r.score) + '"></div><b>' + r.score + '%</b>' : '<div class="mring" style="--p:0;--c:var(--faint)"></div><span class="none">No night<br>yet</span>') + '</div>' +
    '<div class="kv"><div class="r" data-tip="@ratio"><span class="mut">Load ratio</span>' + (R2 ? '<b style="color:' + ZC[R2.zone] + '">' + R2.value.toFixed(2) + ' · ' + esc(R2.zone) + '</b>' : '<b class="mut">–</b>') + '</div>' +
      '<div class="kbar"><i style="width:' + (R2 ? Math.min(100, R2.value / 2 * 100) : 0) + '%;--c:' + (R2 ? ZC[R2.zone] : 'transparent') + '"></i></div>' +
      '<div class="r" data-tip="@ki"><span class="mut">Ki charge</span>' + (k ? '<span class="kpips">' + Array.from({ length: k.peak }, (_, i) => '<i class="' + (i < k.level ? 'on' : '') + '"></i>').join('') + '</span>' : '<b class="mut">–</b>') + '</div>' +
      '<div class="r"><span class="mut">Training</span><b>' + one(wk.hours) + ' of ' + wk.target + ' h</b></div></div>';
}
// Mood: five faces (the last one logged lit; a tap logs one). Today's timeline opens with a tap on the tile.
function renderMood() {
  const lm = lastMood();
  $('moodLast').textContent = lm ? FEEL[lm.m - 1] + ' · ' + hhmm(lm.at) : 'Not logged yet';
  $('moodFaces').innerHTML = FEEL.map((f, i) => '<button type="button" class="face' + (lm && lm.m === i + 1 ? ' on' : '') + '" data-act="face" data-m="' + (i + 1) + '" data-tip="' + f + '" aria-label="Log mood: ' + f + '">' + faceImg(i + 1, '') + '</button>').join('');
}
// Commute: morning and afternoon places, the ride, and the year's share of work days in Belgium.
function renderCommute() {
  const T = workToday(), b = border(), C = 2 * Math.PI * 15;
  $('commRide').textContent = T.commute && T.commute !== 'N/A' ? T.commute : 'No ride';
  $('commBody').innerHTML = '<div class="pl"><small>Morning</small>' + esc(T.am) + '</div><div class="pl"><small>Afternoon</small>' + esc(T.pm) + '</div>' +
    '<div class="be"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="#ffcf3a" stroke-width="4" stroke-dasharray="' + (b.share / 100 * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 18 18)"/></svg><b>' + b.share + '%</b></div>';
  $('commNote').textContent = b.share + '% of work days in Belgium · ' + (b.spare >= 0 ? b.spare + ' day' + (b.spare === 1 ? '' : 's') + ' to spare' : -b.spare + ' days short');
}
function renderSteph() {
  const open = stephList().filter(x => !x.done);
  $('stephCount').textContent = open.length + ' open';
  $('stephBody').textContent = open.length ? open[0].t : 'Nothing from Steph right now.';
  $('stephBody').className = open.length ? '' : 'none';
}
function renderDates() {
  const c = COMING().slice(0, 3);
  $('datesBody').innerHTML = D.calendar ? (c.length ? c.map(i => '<div class="ev"><span class="ed">' + esc(i.day <= D.today ? 'Today' : wdShort(i.day) + ' ' + +i.day.slice(8, 10)) + '</span><span class="et">' + esc(i.t) + '</span></div>').join('') : '<div class="tsay">Nothing in the next 30 days.</div>') : '<div class="tsay">No calendar connected.</div>';
}
// Your day: three thin lanes from 06 to 23, one now line across them.
const LANES = [['roy', 'Roy'], ['steph', 'Steph'], ['kids', 'Kids']];
function renderDay() {
  const m = nowMin(), nowIn = m >= DAY0 * 60 && m <= DAY1 * 60;
  let html = '';
  LANES.forEach(([who, name]) => {
    const evs = ALLEV().filter(e => e.who === who || e.who === 'all').map(e => ({ ...e, a: minOf(e.from), z: minOf(e.to) })).sort((p, q) => p.a - q.a);
    const rows = []; evs.forEach(e => { let r = rows.findIndex(end => end <= e.a); if (r < 0) { r = rows.length; rows.push(0); } rows[r] = e.z; e.row = r; });
    const rh = 100 / Math.max(1, rows.length);
    const t = evs.map(e => { const st = e.z <= m ? ' past' : ''; return '<div class="blk ' + who + st + (e.cal ? ' cal' : '') + '" data-act="ev" data-id="' + esc(e.id) + '" data-tip="@blk" role="button" tabindex="0" aria-label="' + esc(e.t + ', ' + e.from + ' to ' + e.to + (e.cal ? '. From the family calendar' : '. Edit')) + '" style="left:calc(' + xOf(e.a) + '% + 1px);width:calc(' + (xOf(e.z) - xOf(e.a)) + '% - 2px);top:calc(' + (e.row * rh) + '% + 2px);height:calc(' + rh + '% - 4px)"><span>' + esc(e.t) + '</span></div>'; }).join('');
    html += '<span class="lname ' + who + '">' + name + '</span><div class="track" data-act="track" data-who="' + who + '">' + t + '</div>';
  });
  $('lanes').innerHTML = html + (nowIn ? '<span class="nowl" style="left:calc(82px + (100% - 82px) * ' + (xOf(m) / 100).toFixed(4) + ')"></span>' : '');
  $('dayHours').textContent = [6, 9, 12, 15, 18, 21, 23].map(h => String(h).padStart(2, '0')).join(' · ');
}
function renderApps() { $('apps').innerHTML = BAR_APPS.map(([k, name, ac]) => '<button type="button" class="app" data-open="' + k + '" data-tip="' + esc(name) + '" aria-label="Open ' + esc(name) + '" style="--ac:' + ac + '">' + icon(k) + '</button>').join(''); }
function renderDockState() { qa('.app').forEach(a => a.classList.toggle('open', !!WIN && WIN.key === a.dataset.open)); }
// Ask: one suggestion at a time under the title, changing every ten minutes; a tap puts it in the box.
function renderAskTry() { const q = SUGG[Math.floor(now() / 6e5) % SUGG.length]; $('askTry').textContent = 'Try: “' + q + '”'; $('askTry').dataset.q = q; }
function renderAll() { renderClock(); renderWeather(); renderIsland(); renderQuote(); renderFocusW(); renderBossW(); renderMe(); renderMood(); renderCommute(); renderSteph(); renderDates(); renderDay(); renderDockState(); renderAskTry(); fitAfterRender(); }

// ---- Windows ----
const sec = (id, hl, html) => '<div class="sec' + (hl === id ? ' hl' : '') + '">' + html + '</div>';
const WINS = {
  body: { w: 54, title: 'Body', tags: () => '',
    render(b, arg) {
      const r = R(), U = F().usual, k = F().ki, N = F().nights, Ld = L();
      const left = sec('recovery', arg, '<div class="sh"><span>Recovery' + (r ? ' · ' + (r.fresh ? 'last night' : 'night to ' + dayFmt(r.date)) : '') + '</span></div>' + (r ? '<div class="rec big"><div class="ring bigring" style="--p:' + r.score + ';--c:' + recColor(r.score) + '"><b>' + r.score + '%</b></div><div class="recw" style="--c:' + recColor(r.score) + '"><b>' + REC_LABEL[r.verdict][0] + ' · ' + REC_LABEL[r.verdict][1] + '</b><span>' + REC_LABEL[r.verdict][2] + '</span></div></div>' +
          '<div class="vit"><span>Sleep</span><b>' + sleepTxt(r.sleep) + ' ' + trend(r.sleep, U.sleep, true, .25) + '</b><em>usual ' + sleepTxt(U.sleep) + '</em><span>HRV</span><b>' + (r.hrv == null ? '–' : r.hrv + ' ms ') + trend(r.hrv, U.hrv, true, (U.hrv || 50) * .05) + '</b><em>usual ' + one(U.hrv) + '</em><span>Resting HR</span><b>' + (r.rhr == null ? '–' : r.rhr + ' ') + trend(r.rhr, U.rhr, false, 2) + '</b><em>usual ' + one(U.rhr) + '</em></div>' : '<p class="say">No night synced yet.</p>')) +
        sec('nights', arg, '<div class="sh"><span>Last 7 nights</span></div><div class="chart nights" data-chart="nights">' + nightsSvg() + '</div><div class="xlab seven">' + N.map((d, i) => '<span>' + (i === N.length - 1 ? 'Last' : wdShort(d.day)) + '</span>').join('') + '</div><div class="legend"><span><i style="background:#3ddc84"></i>Train</span><span><i style="background:#ffc24a"></i>Careful</span><span><i style="background:#ff5f6d"></i>Rest</span><span><i style="background:#fff"></i>HRV</span></div>');
      const LD = F().load, chart = LD && LD.long && LD.long.length > 1 ? loadChart(LD, F().moves) : null, last = LD ? LD.long.length - 1 : 0;
      const right = sec('load', arg, '<div class="sh"><span>Load · 12 weeks · the Goku card\'s chart</span>' + (chart ? '<span>' + formChip() + '</span>' : '') + '</div>' +
          (chart ? '<div class="ld-legend"><span><i style="background:var(--long)"></i>Long-term ' + esc(fmtNum(LD.long[last])) + '</span><span><i style="background:var(--short)"></i>Short-term ' + esc(fmtNum(LD.short[last])) + '</span>' + (LD.form[last] ? '<span class="form-chip fs-' + esc(LD.form[last]) + '">' + esc(LD.form[last]) + '</span>' : '') + '</div>' + chart.html : '<p class="say">No load data yet.</p>')) +
        '<div class="grid2">' + (k ? sec('ki', arg, '<div class="sh"><span>Ki charge</span><b>' + kiState(k) + '</b></div>' + pips(k) + '<div class="kv2"><b>' + k.level + ' of ' + k.peak + '</b>' + (k.heal_cap ? ' · healing cap <b>' + k.heal_cap + ' HP</b>' : '') + '</div>') : '') +
        sec('week', arg, '<div class="sh"><span>Training this week</span>' + (F().week.tss ? '<b>TSS ' + Math.round(F().week.tss) + '</b>' : '') + '</div><div class="meter"><i style="width:' + pct(F().week.hours, F().week.target) + '%"></i></div><div class="kv2"><b>' + one(F().week.hours) + ' h</b> of ' + F().week.target + ' h · ' + F().week.sessions + ' session' + (F().week.sessions === 1 ? '' : 's') + '</div>' + zoneBar(F().week.zones)) + '</div>' +
        ((F().week.list || []).length ? sec('sessions', arg, '<div class="sh"><span>Sessions</span></div><div class="rows">' + F().week.list.map(w => '<div class="rowi"><span>' + (SPORT[w.sport] || '🏃') + '</span><span>' + esc(w.name) + '<small>' + wdShort(w.day) + ' ' + w.at + ' · ' + w.min + ' min' + (w.km ? ' · ' + w.km + ' km' : '') + (w.hr_avg ? ' · ' + w.hr_avg + ' bpm' : '') + '</small></span><span class="in">' + (w.tss != null ? 'TSS ' + w.tss : '') + '</span></div>').join('') + '</div>') : '');
      b.innerHTML = '<div class="bodygrid"><div>' + left + '</div><div>' + right + '</div></div>';
      if (chart) chart.bind(b.querySelector('.ld-wrap'));
    } },
  focus: { w: 30, title: 'Focus', tags: () => '',
    render(b) {
      const g0 = $('wAddG') ? $('wAddG').value : 'must';
      const group = (title, g) => { const l = focusList(g); return sec(g, '', '<div class="sh"><span>' + title + '</span><span>' + l.filter(x => x.done).length + '/' + l.length + '</span></div><div class="todos">' + (l.length ? l.map(x => todoBtn(x, g, 'wide')).join('') : '<p class="say">Nothing here yet.</p>') + '</div>'); };
      b.innerHTML = '<div class="winif" style="margin:0"><small>Today is a win if</small>' + (D.journal.win_if ? esc(D.journal.win_if) : '<span class="say">Not set in your journal yet.</span>') + '</div>' + group('Must do', 'must') + group('Can do', 'can') +
        '<form class="addfull" id="wAddForm" autocomplete="off"><label class="sr" for="wAddIn">New to-do</label><input class="inp" id="wAddIn" type="text" maxlength="120" placeholder="Add a to-do"><label class="sr" for="wAddG">List</label><select class="sel" id="wAddG"><option value="must"' + (g0 === 'must' ? ' selected' : '') + '>Must do</option><option value="can"' + (g0 === 'can' ? ' selected' : '') + '>Can do</option></select><button type="submit" class="btn primary">Add</button></form><p class="say">Ticks and new to-dos live on this screen for the day; the journal stays the record.</p>';
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
  dates: { w: 30, title: 'Coming up', tags: () => (D.calendar ? '<span class="tag">Family calendar · next 30 days</span>' : ''), render(b) {
    const l = COMING(); if (!D.calendar) { b.innerHTML = '<p class="say">No calendar connected.</p>'; return; }
    if (!l.length) { b.innerHTML = '<p class="say">Nothing in the next 30 days.</p>'; return; }
    const byDay = []; l.forEach(i => { const k = i.day < D.today ? D.today : i.day; let g = byDay.find(x => x.day === k); if (!g) { g = { day: k, items: [] }; byDay.push(g); } g.items.push(i); });
    b.innerHTML = '<div class="rows cal">' + byDay.map(g => g.items.map((i, n) => '<div class="rowi"><span class="dd">' + (n ? '' : esc(g.day === D.today ? 'Today' : dayFmt(g.day))) + '</span><span>' + esc(i.t) + '<small>' + esc(i.all_day ? (i.end_day ? 'All day until ' + dayFmt(i.end_day) : 'All day') : i.from + '–' + i.to) + '</small></span><span class="who ' + esc(i.who) + '">' + esc(i.who === 'all' ? '' : WHO[i.who] || '') + '</span></div>').join('')).join('') + '</div><p class="say">Read from the shared iCloud calendar, refreshed every 10 minutes. Change it on your phone.</p>';
  } },
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
  if (CARD_SRC[key]) { openCard(key); return; }
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
// ---- The cards: the boss card and the Goku card as on Roy's iPhone, served by Roy OS (/card/…) ----
// Habits are ticked there, so the board refreshes when the card closes.
const CARD_SRC = { boss: '/card/boss', goku: '/card/goku' };
let cardOpen = null;
function openCard(key) {
  if (WIN) closeWin(true);
  hideTip(); closePop();
  const pop = $('cardPop'), phone = $('cardPhone');
  Object.keys(CARD_SRC).forEach(k => {
    let f = phone.querySelector('iframe[data-card="' + k + '"]');
    if (k === key && !f) { f = document.createElement('iframe'); f.dataset.card = k; f.title = k === 'boss' ? 'Boss card' : 'Goku card'; f.src = CARD_SRC[k]; f.allow = 'autoplay; fullscreen'; phone.appendChild(f); }
    if (f) f.hidden = k !== key;
  });
  $('ctBoss').setAttribute('aria-selected', String(key === 'boss')); $('ctGoku').setAttribute('aria-selected', String(key === 'goku'));
  pop.setAttribute('aria-label', key === 'boss' ? 'Boss card' : 'Goku card');
  if (!cardOpen) { pop.hidden = false; if (!reduced()) pop.querySelector('.cardbox').animate([{ transform: 'scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2, .85, .25, 1)' }); }
  cardOpen = key;
  setTimeout(() => { const f = phone.querySelector('iframe:not([hidden])'); if (f) f.focus(); }, 60);
}
function closeCard() {
  if (!cardOpen) return;
  cardOpen = null; $('cardPop').hidden = true; $('cardPhone').innerHTML = '';
  refresh();
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
  E.moods.push({ at: nowMin(), m, note: t }); closePop(); moodPick = 0; renderMood(); refreshWin();
  act({ type: 'mood', mood: m, note: t }, () => notify({ app: 'mood', html: '<b>' + FEEL[m - 1] + '</b> logged at ' + hm() + (t ? ': ' + esc(t) : '.') }));
}
function addTodo(f) {
  const inp = f.querySelector('input'), t = inp.value.trim(), g = f.id === 'wAddForm' ? $('wAddG').value : 'must';
  if (!t) { inp.focus(); return; }
  E.added.unshift({ t, g }); inp.value = ''; renderFocusW(); fitAfterRender(); refreshWin(); if (f.id === 'wAddForm' && $('wAddIn')) $('wAddIn').focus();
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
  if (a === 'todo') { const t = el.dataset.t, done = el.getAttribute('aria-checked') !== 'true'; E.ticks[t] = done; renderFocusW(); fitAfterRender(); renderSteph(); refreshWin(); act({ type: 'todo_tick', text: t, done }, () => { if (done) notify({ app: el.dataset.g === 'steph' ? 'steph' : 'focus', html: 'Done: <b>' + esc(t) + '</b>' }); }); }
  else if (a === 'card') openCard(el.dataset.card);
  else if (a === 'cardclose') closeCard();
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
  if (cardOpen && !t.closest('.cardbox')) { closeCard(); return; }
  if (t.closest('[data-close]')) { closeWin(); return; }
  const inWin = !!t.closest('.win'), inPop = !!t.closest('#moodPop');
  if (!inPop && !t.closest('[data-act="face"]')) closePop();
  if (!t.closest('.sysmenu')) closeMenu();
  if (!t.closest('.island')) setIsland(false);
  if (!t.closest('.askt') && !$('askPop').hidden && $('askPop').querySelector('[data-act="sugg"]')) hideAsk();
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
  const w = { ...workToday(), [key]: e.target.value }; E.work = w; renderCommute(); refreshWin();
  act({ type: 'work', am: w.am, pm: w.pm, commute: w.commute }, () => notify({ app: 'commute', html: 'Saved: ' + { am: 'morning', pm: 'afternoon', commute: 'ride' }[key] + ' <b>' + esc(e.target.value) + '</b>.' }));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (cardOpen) closeCard(); else if (!$('moodPop').hidden) closePop(); else if (WIN) closeWin(); else if (!$('sysMenu').hidden) closeMenu(); else if (!$('askPop').hidden) hideAsk(); else setIsland(false); return; }
  if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); $('askIn').focus(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]:not(button)')) { e.preventDefault(); e.target.click(); }
});

// ---- Ask: one box for anything on the screen; the server talks to the model and applies the edits ----
let asking = false, askTimer = null;
const SUGG = ['The kids are home today', 'What is still open today?', 'Log my mood: good and focused', 'Add a to-do: call the garage', 'How is my training load?'];
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
fitBoard();
renderApps();
applyTheme(D.theme);
renderAll();
if (document.fonts) document.fonts.ready.then(fitAfterRender);
addEventListener('resize', fitAfterRender);
matchMedia('(max-width: 900px), (orientation: portrait)').addEventListener('change', () => { fitBoard(); placeWall(); fitAfterRender(); });
setTimeout(nudges, 900);
setInterval(() => { renderClock(); renderIsland(); renderDay(); }, 15e3);
setInterval(refresh, 60e3);
setInterval(() => { renderBossW(); renderMe(); renderMood(); renderAskTry(); nudges(); }, 60e3);
setInterval(drift, 4 * 60e3);
critters();
// A browser pauses video in a hidden tab; when the board is shown again the clip resumes and the data refreshes.
document.addEventListener('visibilitychange', () => { if (document.hidden) return; refresh(); qa('#wall video').forEach(v => { if (v.style.opacity === '1' && v.paused) v.play().catch(() => {}); }); });
})();
