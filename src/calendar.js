// The family calendar: a published iCloud feed (ICS), read only. Parsed here into the
// day's lane blocks and the next weeks' dates. Enough of RFC 5545 for a family calendar:
// timed and all-day events, DAILY/WEEKLY/MONTHLY/YEARLY rules with INTERVAL, UNTIL, COUNT,
// BYDAY, BYMONTH and BYMONTHDAY, EXDATE, and RECURRENCE-ID overrides.
const TZ = 'Europe/Amsterdam';
const DAY = 864e5;
const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ---- Time in the desk's zone ----
const partsOf = (ms, tz = TZ) => {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
};
// Local wall-clock time in `tz` → UTC ms (two passes handle the DST offset).
export function zoned(y, mo, d, h = 0, mi = 0, s = 0, tz = TZ) {
  let ms = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 2; i++) {
    const p = partsOf(ms, tz), here = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    ms += Date.UTC(y, mo - 1, d, h, mi, s) - here;
  }
  return ms;
}
export const ymdOf = (ms, tz = TZ) => { const p = partsOf(ms, tz); return p.y + '-' + String(p.mo).padStart(2, '0') + '-' + String(p.d).padStart(2, '0'); };
export const hhmmOf = (ms, tz = TZ) => { const p = partsOf(ms, tz); return String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0'); };
const dayMs = ymd => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymdFromDayMs = ms => new Date(ms).toISOString().slice(0, 10);

// Apple writes Europe/Brussels and Europe/Paris, same clock as Amsterdam; "GMT+0200" style ids are fixed offsets.
function tzOf(id) {
  if (!id) return null;
  const m = /^(?:GMT|UTC)([+-])(\d{2}):?(\d{2})$/.exec(id);
  if (m) return { fixed: (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) };
  try { new Intl.DateTimeFormat('en-GB', { timeZone: id }); return { tz: id }; } catch (_) { return { tz: TZ }; }
}

// ---- ICS text → events ----
function unfold(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
function prop(line) {
  const i = line.indexOf(':'); if (i < 0) return null;
  const [name, ...ps] = line.slice(0, i).split(';');
  const params = {}; ps.forEach(p => { const j = p.indexOf('='); if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, ''); });
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}
const unescapeText = s => String(s).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// A DATE or DATE-TIME value → { allDay, ms } (all-day: ms is the UTC midnight of that date, a "day stamp").
function parseStamp(value, params) {
  const v = value.trim();
  if ((params.VALUE === 'DATE' || /^\d{8}$/.test(v)) && /^\d{8}$/.test(v)) return { allDay: true, ms: Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)) };
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v); if (!m) return null;
  const [y, mo, d, h, mi, s] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || 0)];
  if (m[7]) return { allDay: false, ms: Date.UTC(y, mo - 1, d, h, mi, s) };
  const z = tzOf(params.TZID);
  if (z && z.fixed != null) return { allDay: false, ms: Date.UTC(y, mo - 1, d, h, mi, s) - z.fixed * 60e3 };
  return { allDay: false, ms: zoned(y, mo, d, h, mi, s, (z && z.tz) || TZ) };
}
function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v).trim()); if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * ((+m[2] || 0) * 7 * DAY + (+m[3] || 0) * DAY + (+m[4] || 0) * 36e5 + (+m[5] || 0) * 6e4 + (+m[6] || 0) * 1e3);
}
function parseRule(v) {
  const r = {}; String(v).split(';').forEach(p => { const [k, x] = p.split('='); if (k && x) r[k.toUpperCase()] = x; });
  const out = { freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1), count: r.COUNT ? +r.COUNT : null, until: null, byday: null, bymonth: null, bymonthday: null };
  if (r.UNTIL) { const u = parseStamp(r.UNTIL, /T/.test(r.UNTIL) ? {} : { VALUE: 'DATE' }); out.until = u ? (u.allDay ? u.ms + DAY - 1 : u.ms) : null; }
  if (r.BYDAY) out.byday = r.BYDAY.split(',').map(x => x.trim().slice(-2));
  if (r.BYMONTH) out.bymonth = r.BYMONTH.split(',').map(Number);
  if (r.BYMONTHDAY) out.bymonthday = r.BYMONTHDAY.split(',').map(Number);
  return out;
}

export function parseIcs(text) {
  const events = []; let ev = null, depth = 0;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { ev = { uid: '', title: '', start: null, end: null, duration: null, rule: null, exdates: [], recurrenceId: null, cancelled: false }; depth = 0; continue; }
    if (line === 'END:VEVENT') { if (ev && ev.start) finish(ev, events); ev = null; continue; }
    if (!ev) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; } if (line.startsWith('END:')) { depth--; continue; } if (depth) continue;
    const p = prop(line); if (!p) continue;
    if (p.name === 'UID') ev.uid = p.value;
    else if (p.name === 'SUMMARY') ev.title = unescapeText(p.value).trim();
    else if (p.name === 'DTSTART') ev.start = parseStamp(p.value, p.params);
    else if (p.name === 'DTEND') ev.end = parseStamp(p.value, p.params);
    else if (p.name === 'DURATION') ev.duration = parseDuration(p.value);
    else if (p.name === 'RRULE') ev.rule = parseRule(p.value);
    else if (p.name === 'EXDATE') p.value.split(',').forEach(x => { const s = parseStamp(x, p.params); if (s) ev.exdates.push(s.ms); });
    else if (p.name === 'RECURRENCE-ID') { const s = parseStamp(p.value, p.params); ev.recurrenceId = s ? s.ms : null; }
    else if (p.name === 'STATUS') ev.cancelled = /CANCELLED/i.test(p.value);
  }
  return events;
}
function finish(ev, events) {
  const s = ev.start;
  if (!ev.end && ev.duration != null) ev.end = { allDay: s.allDay, ms: s.ms + ev.duration };
  if (!ev.end) ev.end = { allDay: s.allDay, ms: s.allDay ? s.ms + DAY : s.ms };
  if (ev.end.ms <= s.ms) ev.end.ms = s.allDay ? s.ms + DAY : s.ms;
  ev.length = ev.end.ms - s.ms;
  events.push(ev);
}

// ---- Occurrences in a window ----
// Instances of one rule, as start stamps (ms). Walked day by day from the first start,
// which is cheap enough for a family calendar and keeps COUNT exact.
function ruleStarts(ev, winFrom, winTo) {
  const r = ev.rule, s = ev.start, out = [];
  const base = s.allDay ? partsOf(s.ms, 'UTC') : partsOf(s.ms);
  const startDay = s.allDay ? s.ms : dayMs(ymdOf(s.ms));
  const endDay = Math.min(winTo + DAY, r.until != null ? r.until + DAY : winTo + DAY);
  const weekOf = ms => Math.floor((ms - 3 * DAY) / (7 * DAY)); // weeks starting Monday
  const byday = r.byday || [WD[new Date(startDay).getUTCDay()]];
  let n = 0;
  for (let d = startDay; d <= endDay && d <= winTo + 31 * DAY; d += DAY) {
    const dt = new Date(d), y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + 1, dom = dt.getUTCDate(), wd = WD[dt.getUTCDay()];
    let ok = false;
    if (r.freq === 'DAILY') ok = Math.round((d - startDay) / DAY) % r.interval === 0;
    else if (r.freq === 'WEEKLY') ok = byday.includes(wd) && (weekOf(d) - weekOf(startDay)) % r.interval === 0;
    else if (r.freq === 'MONTHLY') ok = (r.bymonthday ? r.bymonthday.includes(dom) : dom === base.d) && ((y - base.y) * 12 + (mo - base.mo)) % r.interval === 0 && (!r.byday || r.byday.includes(wd));
    else if (r.freq === 'YEARLY') ok = (r.bymonth ? r.bymonth.includes(mo) : mo === base.mo) && (r.bymonthday ? r.bymonthday.includes(dom) : dom === base.d) && (y - base.y) % r.interval === 0 && (!r.byday || r.byday.includes(wd));
    if (!ok) continue;
    const ms = s.allDay ? d : zoned(y, mo, dom, base.h, base.mi, base.s);
    if (r.until != null && ms > r.until) break;
    n++; if (r.count && n > r.count) break;
    if (ms + ev.length > winFrom && ms <= winTo) out.push(ms);
  }
  return out;
}

// All instances that touch [from, to], with overrides and exceptions applied.
export function occurrences(events, from, to) {
  const overrides = new Map();
  events.forEach(e => { if (e.recurrenceId != null) overrides.set(e.uid + '@' + e.recurrenceId, e); });
  const out = [];
  const push = (e, ms) => { if (!e.cancelled && ms + e.length > from && ms <= to) out.push({ uid: e.uid, title: e.title, allDay: e.start.allDay, ms, end: ms + e.length }); };
  for (const e of events) {
    if (e.recurrenceId != null) { push(e, e.start.ms); continue; }
    if (!e.rule) { push(e, e.start.ms); continue; }
    for (const ms of ruleStarts(e, from, to)) {
      if (e.exdates.some(x => Math.abs(x - ms) < 6e4 || (e.start.allDay && ymdFromDayMs(x) === ymdFromDayMs(ms)))) continue;
      if (overrides.has(e.uid + '@' + ms)) continue;
      push(e, ms);
    }
  }
  return out.sort((a, b) => a.ms - b.ms || a.title.localeCompare(b.title));
}

// ---- Which lane: words in the title, from LANE_WORDS ("steph:steph,stephanie;kids:…") ----
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function laneWords(spec) {
  const out = [];
  String(spec || 'roy:roy;steph:steph,stephanie').split(';').forEach(part => {
    const [who, words] = part.split(':'); if (!who || !words) return;
    out.push([who.trim(), words.split(',').map(w => fold(w.trim())).filter(Boolean)]);
  });
  return out;
}
// One name: that lane. Several names: 'all'. No name: `unnamed` (the family calendar's own lane).
export function laneOf(title, words, unnamed = 'all') {
  const t = ' ' + fold(title).replace(/[^a-z0-9]+/g, ' ') + ' ';
  const hits = words.filter(([, ws]) => ws.some(w => t.includes(' ' + w + ' ')));
  return hits.length === 1 ? hits[0][0] : hits.length ? 'all' : unnamed;
}

// ---- The view: today's lane blocks and the coming days ----
// `lane` fixes every event to one lane (a personal calendar); `unnamed` is the lane of an event
// that names nobody; `kind` and `icon` style its blocks.
export function agenda(events, now, { days = 30, words = laneWords(), lane = null, unnamed = 'all', kind = 'fam', icon = '📅' } = {}) {
  const today = ymdOf(now), from = zoned(+today.slice(0, 4), +today.slice(5, 7), +today.slice(8, 10)), to = from + days * DAY;
  const list = occurrences(events, from, to);
  const items = list.map(o => {
    const day = o.allDay ? ymdFromDayMs(o.ms) : ymdOf(o.ms), endDay = o.allDay ? ymdFromDayMs(o.end - 1) : ymdOf(o.end - 1);
    return { id: 'cal:' + o.uid + ':' + o.ms, t: o.title, who: lane || laneOf(o.title, words, unnamed), day, end_day: endDay > day ? endDay : null, all_day: o.allDay, from: o.allDay ? null : hhmmOf(o.ms), to: o.allDay ? null : hhmmOf(o.end), ms: o.ms };
  });
  const todayTimed = items.filter(i => !i.all_day && i.day === today).map(i => ({ id: i.id, who: i.who, k: kind, ic: icon, from: i.from, to: i.end_day ? '23:59' : i.to, t: i.t, cal: true }));
  return { today, today_timed: todayTimed, upcoming: items.map(({ ms, ...rest }) => rest) };
}
