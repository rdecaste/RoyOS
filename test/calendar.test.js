import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs, occurrences, agenda, laneWords, laneOf, zoned, ymdOf } from '../src/calendar.js';

const ICS = `BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:Europe/Brussels
BEGIN:DAYLIGHT
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:gym
SUMMARY;LANGUAGE=en-US:Michelle turnles
DTSTART;TZID=Europe/Brussels:20250907T093000
DTEND;TZID=Europe/Brussels:20250907T103000
RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261231T073000Z;INTERVAL=1;BYDAY=SU
EXDATE;TZID=Europe/Brussels:20261011T093000
END:VEVENT
BEGIN:VEVENT
UID:gym
RECURRENCE-ID;TZID=Europe/Brussels:20261018T093000
SUMMARY:Michelle turnles (later)
DTSTART;TZID=Europe/Brussels:20261018T140000
DTEND;TZID=Europe/Brussels:20261018T150000
END:VEVENT
BEGIN:VEVENT
UID:drop
SUMMARY:kindjes brengen
DTSTART;TZID=Europe/Paris:20260110T080000
DTEND;TZID=Europe/Paris:20260110T100000
RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261231T070000Z;INTERVAL=2;BYDAY=SA
END:VEVENT
BEGIN:VEVENT
UID:bday
SUMMARY:Bday Rassell
DTSTART;VALUE=DATE:20240205
DTEND;VALUE=DATE:20240206
RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=2;BYMONTHDAY=5
END:VEVENT
BEGIN:VEVENT
UID:move
SUMMARY:Verhuizen!!!
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261012
END:VEVENT
BEGIN:VEVENT
UID:fysio
SUMMARY:Fysio\\, Steph
DTSTART;TZID=Europe/Brussels:20261005T173000
DURATION:PT30M
END:VEVENT
BEGIN:VEVENT
UID:old
SUMMARY:Dinner
DTSTART;TZID=Europe/Brussels:20231201T180000
DTEND;TZID=Europe/Brussels:20231201T190000
RRULE:FREQ=DAILY;UNTIL=20231225T170000Z
END:VEVENT
END:VCALENDAR`;

const NOW = zoned(2026, 10, 5, 10, 0);
const WORDS = laneWords('roy:roy;steph:steph,stephanie;kids:rassell,michelle,raphael,kindjes');

test('ics: events parse with folded params, escapes, durations and zones', () => {
  const ev = parseIcs(ICS);
  assert.equal(ev.length, 7, 'timezone rules are not events');
  const f = ev.find(e => e.uid === 'fysio');
  assert.equal(f.title, 'Fysio, Steph'); assert.equal(f.length, 30 * 60e3);
  assert.equal(ymdOf(f.start.ms) + ' ' + new Date(f.start.ms).toISOString().slice(11, 16), '2026-10-05 15:30', 'Brussels 17:30 in October is 15:30 UTC');
});

test('occurrences: weekly, every other week, yearly, exceptions and overrides', () => {
  const ev = parseIcs(ICS), from = zoned(2026, 10, 5), to = from + 30 * 864e5;
  const days = occurrences(ev, from, to).map(o => ymdOf(o.ms) + ' ' + o.title);
  assert.deepEqual(days.filter(d => d.includes('turnles')), ['2026-10-18 Michelle turnles (later)', '2026-10-25 Michelle turnles', '2026-11-01 Michelle turnles'], 'the 11th is an exception, the 18th is moved');
  assert.deepEqual(days.filter(d => d.includes('kindjes')), ['2026-10-17 kindjes brengen', '2026-10-31 kindjes brengen']);
  assert.ok(!days.some(d => d.includes('Dinner')), 'a rule that ended in 2023 yields nothing');
  const feb = occurrences(ev, zoned(2027, 2, 1), zoned(2027, 2, 28)).map(o => ymdOf(o.ms) + ' ' + o.title);
  assert.deepEqual(feb, ['2027-02-05 Bday Rassell']);
});

test('agenda: today\'s timed blocks on a lane, and the coming days', () => {
  const a = agenda(parseIcs(ICS), NOW, { days: 30, words: WORDS });
  assert.equal(a.today, '2026-10-05');
  assert.deepEqual(a.today_timed.map(({ who, from, to, t, k, cal }) => ({ who, from, to, t, k, cal })), [{ who: 'steph', from: '17:30', to: '18:00', t: 'Fysio, Steph', k: 'fam', cal: true }]);
  const move = a.upcoming.find(i => i.t === 'Verhuizen!!!');
  assert.deepEqual({ day: move.day, end_day: move.end_day, all_day: move.all_day, who: move.who }, { day: '2026-10-10', end_day: '2026-10-11', all_day: true, who: 'all' });
  assert.equal(a.upcoming[0].t, 'Fysio, Steph', 'sorted by time');
});

test('agenda: a personal calendar is pinned to one lane with its own block style', () => {
  const a = agenda(parseIcs(ICS), NOW, { days: 30, lane: 'steph', kind: 'work', icon: '💼' });
  assert.deepEqual(a.today_timed.map(({ who, k, ic }) => ({ who, k, ic })), [{ who: 'steph', k: 'work', ic: '💼' }]);
  assert.ok(a.upcoming.every(i => i.who === 'steph'));
});

test('lanes: one name picks the lane, none or two means everyone; accents and case do not matter', () => {
  assert.equal(laneOf('Michelle turnles', WORDS), 'kids');
  assert.equal(laneOf('Raphaël naar oma', WORDS), 'kids');
  assert.equal(laneOf('Stephanie vrij - koningsdag', WORDS), 'steph');
  assert.equal(laneOf('Roy en Steph uit eten', WORDS), 'all');
  assert.equal(laneOf('CV ketel onderhoud', WORDS), 'all');
});
