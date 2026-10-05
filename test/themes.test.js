import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue, pickTheme, isoWeek, weekAfter, mondayOf, rng, NOT_FOR_DESK, PALETTES } from '../src/themes.js';

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
  assert.ok(a.prompts.clip.includes('locked camera') && a.prompts.clip.includes('first and final frames must match'));
  assert.equal(a.palette, PALETTES[a.franchise]);
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
