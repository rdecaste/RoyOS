import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue, pickTheme, loreFor, isoWeek, weekAfter, mondayOf, rng, NOT_FOR_DESK, PALETTES } from '../src/themes.js';

const chars = [
  { id: 'c1', character_name: 'Jinx', franchise: 'Arcane', canonical_identity: 'Arcane Jinx.', canonical_elements: 'Long blue braids.', restrictions: 'No gore.', avatar_url: 'https://x/jinx.jpg' },
  { id: 'c2', character_name: 'Vi', franchise: 'Arcane', canonical_identity: 'Arcane Vi.', canonical_elements: 'Pink hair.', restrictions: '' },
  { id: 'c3', character_name: 'Goku', franchise: 'Dragon Ball', canonical_identity: 'Goku.', canonical_elements: 'Gi.', restrictions: '' },
  { id: 'c4', character_name: 'Nobody', franchise: 'No Scenes', canonical_identity: '', canonical_elements: '', restrictions: '' }
];
const scenes = [
  { scene_name: 'Zaun — The Lanes', franchise: 'Arcane', canonical_identity: 'The Lanes.', canonical_elements: 'pipes; neon', signature_features: 'teal and magenta', restrictions: 'Keep it Zaun.' },
  { scene_name: 'The Last Drop', franchise: 'Arcane', canonical_identity: 'bar', canonical_elements: '', signature_features: '', restrictions: '' },
  { scene_name: 'Planet Namek', franchise: 'Dragon Ball', canonical_identity: 'Namek.', canonical_elements: 'blue grass', signature_features: 'bright', restrictions: '' },
  { scene_name: 'Nowhere', franchise: 'No Characters', canonical_identity: '', canonical_elements: '', signature_features: '', restrictions: '' }
];

test('catalogue: scenes marked not for the desk are dropped, franchises need both scenes and characters', () => {
  const cat = buildCatalogue(chars, scenes);
  assert.deepEqual(cat.map(f => f.name), ['Arcane', 'Dragon Ball']);
  assert.deepEqual(cat[0].scenes.map(s => s.scene_name), ['Zaun — The Lanes']);
  assert.ok(NOT_FOR_DESK.has('The Last Drop'));
});

test('pick: seeded by the week, the same every time, different across weeks', () => {
  const cat = buildCatalogue(chars, scenes);
  const a = pickTheme(cat, '2026-W41'), b = pickTheme(cat, '2026-W41');
  assert.deepEqual([a.franchise, a.scene, a.character], [b.franchise, b.scene, b.character]);
  const weeks = Array.from({ length: 20 }, (_, i) => pickTheme(cat, weekAfter('2026-W41', i)).franchise);
  assert.ok(new Set(weeks).size > 1, 'the rotation uses more than one franchise');
  assert.ok(a.prompts.still.includes(a.scene) && a.prompts.still.includes(a.character));
  assert.ok(a.prompts.clip.includes('completely static and locked') && a.prompts.clip.includes('final frame matches the first frame'));
  assert.ok(a.prompts.clip.includes('No walking'), 'the character stays anchored, as in the quest videos');
  assert.ok(!a.prompts.clip.includes(a.character), 'the clip prompt never names the character (Veo refuses names)');
  assert.equal(a.palette, PALETTES[a.franchise]);
});

test('pick: a character asked for by name pins the week to them and their franchise', () => {
  const cat = buildCatalogue(chars, scenes);
  for (let i = 0; i < 6; i++) {
    const p = pickTheme(cat, weekAfter('2026-W41', i), { character: 'jinx' });
    assert.deepEqual([p.franchise, p.character, p.character_id], ['Arcane', 'Jinx', 'c1']);
    assert.equal(p.scene, 'Zaun — The Lanes');
  }
  assert.throws(() => pickTheme(cat, '2026-W41', { character: 'Nobody' }), /No character named Nobody/);
});

test('weeks: ISO weeks on Amsterdam dates, Monday first', () => {
  assert.equal(isoWeek(Date.parse('2026-10-05T10:00:00Z')), '2026-W41');
  assert.equal(isoWeek(Date.parse('2026-10-04T23:30:00Z')), '2026-W41'); // 01:30 Monday in Amsterdam
  assert.equal(mondayOf(Date.parse('2026-10-08T10:00:00Z')), '2026-10-05');
  assert.equal(weekAfter('2026-W41', 1), '2026-W42');
  assert.equal(weekAfter('2026-W01', -1), '2025-W52');
  assert.equal(weekAfter('2026-W52', 1), '2026-W53');
});

test('rng: deterministic and in [0, 1)', () => {
  const a = rng('x'), b = rng('x');
  const xs = Array.from({ length: 5 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every(v => v >= 0 && v < 1));
});

test('remake from the config: once, for its week, while the row is older than the ask', async () => {
  const { remakeDue } = await import('../src/themes.js');
  const spec = '2026-W41|Jinx|2026-10-06T07:00:00Z';
  assert.equal(remakeDue(spec, { started_at: '2026-10-05T04:05:00.000Z' }, '2026-W41'), 'Jinx');
  assert.equal(remakeDue(spec, null, '2026-W41'), 'Jinx');
  assert.equal(remakeDue(spec, { started_at: '2026-10-06T07:05:01.000Z' }, '2026-W41'), null);
  assert.equal(remakeDue(spec, { started_at: '2026-10-05T04:05:00.000Z' }, '2026-W42'), null);
  assert.equal(remakeDue('', null, '2026-W41'), null);
  assert.equal(remakeDue('2026-W41|Jinx|soon', null, '2026-W41'), null);
});

test('the week\'s critter: asked for by week and time, once', async () => {
  const { critterDue } = await import('../src/themes.js');
  assert.deepEqual(critterDue('2026-W41|2026-10-06T08:20:00Z', false), { week: '2026-W41', sheet: null, key: 'critter-ask:2026-W41|2026-10-06T08:20:00Z' });
  assert.deepEqual(critterDue('2026-W41|rest|2026-10-06T08:30:00Z', false), { week: '2026-W41', sheet: 'rest', key: 'critter-ask:2026-W41|rest|2026-10-06T08:30:00Z' });
  assert.equal(critterDue('2026-W41|tail|2026-10-06T08:30:00Z', false), null);
  assert.equal(critterDue('2026-W41|2026-10-06T08:20:00Z', true), null);
  assert.equal(critterDue('cat|2026-10-06T07:45:00Z', false), null);
  assert.equal(critterDue('', false), null);
});

test('the week\'s critter: a fantasy creature of the world, three sheets of 8 frames, the walk as reference', async () => {
  const { critterPickMessages, critterFromAnswer, critterPrompts, CRITTER_SHEETS, CRITTER_FALLBACK } = await import('../src/themes.js');
  const theme = { franchise: 'Arcane', scene: 'Zaun', look: 'chem-lit undercity', character: 'Jinx' };
  const msgs = critterPickMessages(theme);
  assert.ok(/fantasy creature/.test(msgs[0].content) && /four legs/.test(msgs[0].content));
  assert.ok(/Zaun/.test(msgs[1].content) && /Jinx/.test(msgs[1].content));
  assert.deepEqual(critterFromAnswer({ name: 'Chem \"lynx\"', look: 'small and\nglowing' }), { name: 'Chem lynx', look: 'small and glowing' });
  assert.deepEqual(critterFromAnswer(null), CRITTER_FALLBACK);
  assert.deepEqual(CRITTER_SHEETS, ['walk', 'rest', 'leap']);
  const p = critterPrompts({ name: 'Chem lynx', look: 'A small glowing lynx.' }, theme);
  for (const k of CRITTER_SHEETS) {
    assert.ok(/4 by 2 grid/.test(p[k]) && /Transparent background/.test(p[k]) && /Zaun/.test(p[k]), k);
    assert.ok(/standing still on all four legs/.test(p[k]) || k === 'walk', k + ' has a standing frame to size it by');
  }
  assert.ok(!/reference/.test(p.walk) && /reference/.test(p.rest) && /reference/.test(p.leap));
  assert.ok(/follow the reference/.test(p.rest) && /follow the reference/.test(p.leap));
});

test('the critter reaches the page only with all three sheets', async () => {
  const { critterView } = await import('../src/data.js');
  const sheet = k => ({ public_id: 'Desk-Themes/2026-W41-critter-' + k, version: 7 });
  assert.equal(critterView(null), null);
  assert.equal(critterView({ name: 'Chem lynx', walk: sheet('walk'), rest: { error: 'x' } }), null);
  const v = critterView({ name: 'Chem lynx', walk: sheet('walk'), rest: sheet('rest'), leap: sheet('leap') });
  assert.equal(v.name, 'Chem lynx');
  assert.ok(/\/v7\/Desk-Themes\/2026-W41-critter-rest\.png$/.test(v.rest));
});

test('lore: the scene and character descriptions from the catalogue, the scene\'s features as short words', () => {
  const cat = buildCatalogue(chars, [{ ...scenes[0], signature_features: 'teal and magenta; chem smog, a feature that is far too long to show as one small chip' }, ...scenes.slice(1)]);
  const lore = loreFor(cat, { franchise: 'Arcane', scene: 'Zaun — The Lanes', character: 'Jinx', character_id: 'c1' });
  assert.deepEqual(lore, { scene: 'The Lanes.', character: 'Arcane Jinx.', feel: ['teal and magenta', 'chem smog'] });
  const long = loreFor(buildCatalogue([{ ...chars[0], canonical_identity: 'A sentence. '.repeat(60) }], scenes), { franchise: 'Arcane', scene: 'Zaun — The Lanes', character: 'Jinx' });
  assert.ok(long.character.length <= 420 && long.character.endsWith('.'), 'cut at a sentence end');
  assert.equal(loreFor(cat, { franchise: 'Unknown', scene: 'x', character: 'y' }), null);
  assert.equal(loreFor(cat, null), null);
});

test('still prompt: a wide shot with the character busy in the scene, never a pin-up bust', async () => {
  const { stillPrompt } = await import('../src/themes.js');
  const p = stillPrompt({ scene_name: 'S', franchise: 'F', canonical_identity: '', canonical_elements: '', signature_features: '', restrictions: '' }, { character_name: 'C', franchise: 'F', canonical_identity: '', canonical_elements: '', restrictions: '' });
  assert.match(p, /not a pin-up/); assert.match(p, /not looking at the viewer/); assert.match(p, /Wide shot/); assert.match(p, /Never younger, never childlike/);
  assert.doesNotMatch(p, /waist up:/);
});
