// Roy OS's own state, in one SQLite Durable Object: the weekly worlds and what Roy
// does on the screen during the day (ticks, moods, the plan, the commute, focus sessions). The quest
// D1 is never written from here; the journal stays the record of the day.
import { DurableObject } from 'cloudflare:workers';
import { emptyDay } from './day.js';
export { emptyDay };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS themes (
  week TEXT PRIMARY KEY, franchise TEXT, scene TEXT, character TEXT, character_id TEXT, look TEXT,
  palette TEXT, prompts TEXT, status TEXT, error TEXT,
  still_public_id TEXT, still_version TEXT, clip_public_id TEXT, clip_version TEXT,
  workflow_id TEXT, started_at TEXT, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, data TEXT, undo TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires INTEGER);
CREATE TABLE IF NOT EXISTS focus (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, at TEXT NOT NULL, min INTEGER NOT NULL, done INTEGER NOT NULL, created_at TEXT);
CREATE INDEX IF NOT EXISTS focus_day ON focus (day);
`;

export class DeskState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(SCHEMA);
  }

  // ---- Weekly worlds ----
  theme(week) {
    const row = this.sql.exec('SELECT * FROM themes WHERE week = ?', week).toArray()[0];
    return row ? inflate(row) : null;
  }
  themes(limit = 12) {
    return this.sql.exec('SELECT * FROM themes ORDER BY week DESC LIMIT ?', limit).toArray().map(inflate);
  }
  // Records a pick before generation starts; returns false when the week already has a row.
  startTheme(t, workflowId) {
    if (this.theme(t.week)) return false;
    this.sql.exec('INSERT INTO themes (week, franchise, scene, character, character_id, look, palette, prompts, status, workflow_id, started_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      t.week, t.franchise, t.scene, t.character, t.character_id, t.look, JSON.stringify(t.palette), JSON.stringify(t.prompts), 'running', workflowId, new Date().toISOString());
    return true;
  }
  updateTheme(week, patch) {
    const keys = Object.keys(patch);
    if (!keys.length) return;
    this.sql.exec(`UPDATE themes SET ${keys.map(k => k + ' = ?').join(', ')} WHERE week = ?`, ...keys.map(k => patch[k]), week);
  }
  // A failed week can be retried: its row goes, the next cron tick starts it again.
  resetTheme(week) { this.sql.exec('DELETE FROM themes WHERE week = ?', week); }

  // ---- The day's edits (one JSON blob per Amsterdam day) ----
  day(day) {
    const row = this.sql.exec('SELECT data, undo FROM days WHERE day = ?', day).toArray()[0];
    return { data: row && row.data ? JSON.parse(row.data) : emptyDay(), undo: row && row.undo ? JSON.parse(row.undo) : null };
  }
  saveDay(day, data, undo) {
    this.sql.exec('INSERT INTO days (day, data, undo, updated_at) VALUES (?,?,?,?) ON CONFLICT(day) DO UPDATE SET data = excluded.data, undo = excluded.undo, updated_at = excluded.updated_at',
      day, JSON.stringify(data), undo === undefined ? null : JSON.stringify(undo), new Date().toISOString());
  }

  // ---- Focus sessions (the focus timer): one row per finished or stopped session, kept for good ----
  focusDay(day) {
    return this.sql.exec('SELECT day, at, min, done FROM focus WHERE day = ? ORDER BY id', day).toArray().map(r => ({ ...r, done: !!r.done }));
  }
  addFocus(f) {
    this.sql.exec('INSERT INTO focus (day, at, min, done, created_at) VALUES (?,?,?,?,?)', f.day, f.at, f.min, f.done ? 1 : 0, new Date().toISOString());
    return this.focusDay(f.day);
  }

  // ---- Small cache (weather) ----
  cached(key) {
    const row = this.sql.exec('SELECT value, expires FROM cache WHERE key = ?', key).toArray()[0];
    return row && row.expires > Date.now() ? JSON.parse(row.value) : null;
  }
  remember(key, value, ttlMs) {
    this.sql.exec('INSERT INTO cache (key, value, expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires = excluded.expires', key, JSON.stringify(value), Date.now() + ttlMs);
  }
  // Takes a key once: true the first time, false while it is held. One call, so two requests that
  // arrive together can't both win (a cached + remember pair from outside could).
  claim(key, ttlMs) {
    if (this.cached(key)) return false;
    this.remember(key, { at: new Date().toISOString() }, ttlMs);
    return true;
  }
}

function inflate(row) {
  return { ...row, palette: row.palette ? JSON.parse(row.palette) : null, prompts: row.prompts ? JSON.parse(row.prompts) : null };
}

export const state = env => env.STATE.get(env.STATE.idFromName('main'));
