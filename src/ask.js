// The Ask box: the board's state as JSON, Roy's words, and the few edits the assistant
// may make. applyActions is also what /act uses, so a tap and a sentence do the same thing.
const WHO = ['roy', 'steph', 'kids', 'all'];
const KINDS = { work: '💼', move: '🚲', train: '🏃', fam: '👪', mind: '📓' };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const FEEL = ['Sucky', 'Tired', 'Normal', 'Good', 'On fire'];
const PLACES = ['🇳🇱 Home', '🇧🇪 Beerse', '🇧🇪 Ghent', '✈️ Travel', '🏖️ Holiday', '🎉 Public holiday'];
const RIDES = ['🚲 E-bike', '🚗 Car', '✈️ Plane', 'N/A'];
export const OPTIONS = { places: PLACES, rides: RIDES, feel: FEEL, kinds: KINDS, who: WHO };

const minOf = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const hhmm = ms => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
const pick = (list, v) => { v = String(v || '').toLowerCase().trim(); return v ? list.find(o => o.toLowerCase() === v) || list.find(o => o.toLowerCase().includes(v)) || null : null; };

// Applies a list of actions to the day's edits in place; returns how many changed something.
export function applyActions(d, list, now = Date.now()) {
  let n = 0;
  const m = minOf(hhmm(now));
  for (const a of Array.isArray(list) ? list : []) {
    const type = String((a && a.type) || '');
    if (type.indexOf('event_') === 0) {
      d.events = Array.isArray(d.events) ? d.events : [];
      const clean = {};
      if (a.who != null && WHO.includes(String(a.who))) clean.who = String(a.who);
      if (a.k != null && KINDS[String(a.k)]) { clean.k = String(a.k); clean.ic = KINDS[clean.k]; }
      if (a.from != null && TIME.test(String(a.from))) clean.from = String(a.from);
      if (a.to != null && TIME.test(String(a.to))) clean.to = String(a.to);
      if (a.t != null && String(a.t).trim()) clean.t = String(a.t).trim().slice(0, 40);
      if (type === 'event_delete') { const k = d.events.length; d.events = d.events.filter(e => e.id !== String(a.id)); if (d.events.length < k) n++; }
      else if (type === 'event_update') { const e = d.events.find(x => x.id === String(a.id)); if (e && minOf(clean.to || e.to) > minOf(clean.from || e.from)) { Object.assign(e, clean); n++; } }
      else if (type === 'event_add' && clean.from && clean.to && clean.t && minOf(clean.to) > minOf(clean.from)) { d.events.push({ id: 'e' + now.toString(36) + n, who: 'roy', k: 'mind', ic: KINDS.mind, ...clean }); n++; }
    } else if (type === 'todo_add' && String(a.text || '').trim()) {
      d.added.unshift({ t: String(a.text).trim().slice(0, 80), g: a.list === 'can' ? 'can' : 'must' }); n++;
    } else if (type === 'todo_tick' || type === 'todo_done') {
      const t = String(a.text || a.t || '').trim();
      if (t) { d.ticks[t] = type === 'todo_done' ? true : !!(a.done === true || a.done === '1' || a.done === 'true'); n++; }
    } else if (type === 'habit' || type === 'habit_done') {
      const name = String(a.name || '').trim();
      if (name) { const done = type === 'habit_done' ? true : (a.done === true || a.done === '1' || a.done === 'true'); d.habits[name] = done ? hhmm(now) : false; n++; }
    } else if (type === 'mood' || type === 'mood_log') {
      const v = Math.round(Number(a.mood || a.m)); if (v >= 1 && v <= 5) { d.moods.push({ at: m, m: v, note: String(a.note || '').slice(0, 80) }); n++; }
    } else if (type === 'work' || type === 'work_set') {
      const w = d.work || {}; const am = pick(PLACES, a.am), pm = pick(PLACES, a.pm), ride = pick(RIDES, a.ride || a.commute);
      if (am) w.am = am; if (pm) w.pm = pm; if (ride) w.commute = ride;
      if (am || pm || ride) { d.work = w; n++; }
    } else if (type === 'plan' && Array.isArray(a.events)) {
      d.events = a.events.filter(e => e && TIME.test(String(e.from)) && TIME.test(String(e.to)) && minOf(e.to) > minOf(e.from) && String(e.t || '').trim()).slice(0, 60)
        .map(e => ({ id: String(e.id || 'e' + Math.random().toString(36).slice(2, 8)), who: WHO.includes(e.who) ? e.who : 'roy', k: KINDS[e.k] ? e.k : 'mind', ic: KINDS[KINDS[e.k] ? e.k : 'mind'], from: e.from, to: e.to, t: String(e.t).trim().slice(0, 40) })); n++;
    }
  }
  return n;
}

// What the assistant sees: the board, trimmed to what it may need.
export function askPrompt(data, text) {
  const e = data.edits, j = data.journal, f = data.fitness;
  const context = {
    today: data.today, time: data.now,
    plan: (e.events || []).map(({ id, who, from, to, t, k }) => ({ id, who, from, to, t, k })),
    focus: { win_if: j.win_if, must: j.must.map(x => ({ t: x.t, done: e.ticks[x.t] != null ? e.ticks[x.t] : x.done })), can: j.can.map(x => ({ t: x.t, done: e.ticks[x.t] != null ? e.ticks[x.t] : x.done })), added: e.added },
    from_steph: j.steph, main_habits: data.main.map(h => ({ name: h.name, done: e.habits[h.name] ? true : e.habits[h.name] === false ? false : h.done, usual: h.usual, streak: h.streak })),
    mood_today: e.moods.map(x => ({ at: x.at, mood: FEEL[x.m - 1], note: x.note })),
    work_today: e.work || j.work, work_options: { places: PLACES, rides: RIDES },
    body: f.recovery ? { recovery: f.recovery.score + '% ' + f.recovery.verdict, sleep_h: f.recovery.sleep, hrv: f.recovery.hrv, rest_hr: f.recovery.rhr } : null,
    load: f.now ? { fitness_ctl: f.now.fitness, fatigue_atl: f.now.fatigue, form_state: f.now.form_state, load_ratio: f.ratio ? f.ratio.value + ' (' + f.ratio.zone + ')' : null, training_this_week_h: f.week.hours + ' of ' + f.week.target, sessions_this_week: (f.week.list || []).map(w => w.sport + ' ' + w.min + ' min' + (w.tss != null ? ', TSS ' + w.tss : '')) } : null,
    quest: data.quest ? { title: data.quest.title, next_move: data.quest.next_move, days_left: data.quest.days_left } : null
  };
  const system = 'You are the assistant built into Roy OS, the desk screen next to Roy all day. You answer questions about what the screen shows, and you can change it.\n' +
    'Lanes ("who") in the plan: roy (Roy, who is typing), steph (Steph, his partner), kids (their children), all (everyone). Event types ("k"): work, move (commute, driving, school run), train (sport), fam (family, school, kids), mind (personal, journal, yoga).\n' +
    'Do what he asks. Include obvious knock-on effects in the plan (no school means no school run or pickup, and the kids are home). Do not invent details you cannot infer. If he only asks a question, answer it from the data and change nothing.\n' +
    'Reply with only a JSON object {"reply":"...","actions":[...]}. "reply" is one or two short sentences: the answer, or what you changed. Actions, any number, in order:\n' +
    '{"type":"event_add","who":"kids","from":"08:30","to":"15:15","t":"Home","k":"fam"}\n' +
    '{"type":"event_update","id":"e7","from":"15:00","to":"15:30","t":"New title","who":"steph","k":"move"} (only the fields that change)\n' +
    '{"type":"event_delete","id":"e9"}\n' +
    '{"type":"todo_add","text":"Call the plumber","list":"must"} (list: must or can)\n' +
    '{"type":"todo_done","text":"<the exact to-do text>"}\n' +
    '{"type":"habit_done","name":"Supplements"} (one of the main habits)\n' +
    '{"type":"mood_log","mood":4,"note":"Focused"} (mood: 1 Sucky, 2 Tired, 3 Normal, 4 Good, 5 On fire)\n' +
    '{"type":"work_set","am":"🇳🇱 Home","pm":"🇧🇪 Beerse","ride":"🚲 E-bike"} (values from work_options; only what changes)\n' +
    'Times are 24-hour HH:MM between 06:00 and 23:00. Titles under 30 characters.';
  return [{ role: 'system', content: system }, { role: 'user', content: 'The screen now, as JSON:\n' + JSON.stringify(context) + '\n\nRoy says: "' + text.replace(/"/g, "'") + '"' }];
}
