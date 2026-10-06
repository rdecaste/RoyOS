// The weekly world: every Monday morning a random franchise, then a random scene and
// character of that franchise, from the quest D1's characters and scenes tables.
// The pick is seeded by the ISO week, so it is the same wherever it is computed,
// and next week's pick can be shown ahead. The board's colours follow the franchise.

const TZ = 'Europe/Amsterdam';

// The board's palette per franchise: accent, a second colour for gradients, and the glass tint (rgb).
export const PALETTES = {
  'Arcane': { accent: '#6fd8ff', second: '#ff7ac8', tint: '10, 18, 38' },
  'Dragon Ball': { accent: '#ffa63a', second: '#4f8ae8', tint: '22, 14, 8' },
  'Bleach': { accent: '#c9d4ff', second: '#ff5f6d', tint: '12, 12, 24' },
  'Solo Leveling': { accent: '#a28bff', second: '#5ab8ff', tint: '12, 8, 30' },
  'Cyberpunk: Edgerunners': { accent: '#e8ff3a', second: '#3ddcff', tint: '16, 14, 6' },
  'Jujutsu Kaisen': { accent: '#7c8cff', second: '#ff4b5c', tint: '10, 12, 28' },
  'One Punch Man': { accent: '#ffd23f', second: '#ff5a3c', tint: '20, 16, 6' },
  'Fairy Tail': { accent: '#f6c045', second: '#ff6b6b', tint: '22, 16, 6' },
  'Chainsaw Man': { accent: '#ff6a3d', second: '#ffb08a', tint: '20, 10, 8' },
  'Tokyo Ghoul': { accent: '#ff5a6e', second: '#8fa3c7', tint: '14, 10, 18' }
};
const DEFAULT_PALETTE = { accent: '#6fd8ff', second: '#ff7ac8', tint: '9, 14, 27' };

// Scenes that are too dark, enclosed or grim for a screen that is on all day.
export const NOT_FOR_DESK = new Set([
  'The Last Drop', 'Cartenon Temple', 'Malevolent Shrine', 'Monster Association Underground',
  'Endless Hotel Corridor', 'Chainsaw City Battle', 'Aogiri Tree Hideout', 'Dragon Ruins Tokyo'
]);

export const ymd = (ms, tz = TZ) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ms));

// ISO week of the Amsterdam date, as "2026-W41".
export function isoWeek(ms) {
  const d = new Date(ymd(ms) + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const y = d.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4));
  const wk = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}
export function mondayOf(ms) {
  const d = new Date(ymd(ms) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
export const weekAfter = (week, n = 1) => {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 864e5 + (w - 1 + n) * 7 * 864e5);
  return isoWeek(monday.getTime() + 12 * 3600e3);
};

// A small seeded generator (mulberry32 over an FNV-style hash of the seed).
export function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// The catalogue: franchises with their desk-worthy scenes and enabled characters.
export async function loadCatalogue(db) {
  const chars = (await db.prepare('SELECT id, character_name, franchise, canonical_identity, canonical_elements, restrictions, avatar_url FROM characters WHERE enabled = 1 AND (in_trash IS NULL OR in_trash = 0)').all()).results || [];
  const scenes = (await db.prepare('SELECT scene_name, franchise, canonical_identity, canonical_elements, signature_features, restrictions FROM scenes WHERE enabled = 1 AND (in_trash IS NULL OR in_trash = 0)').all()).results || [];
  return buildCatalogue(chars, scenes);
}

export function buildCatalogue(chars, scenes) {
  const by = {};
  for (const s of scenes) {
    if (NOT_FOR_DESK.has(s.scene_name)) continue;
    (by[s.franchise] = by[s.franchise] || { name: s.franchise, scenes: [], characters: [] }).scenes.push(s);
  }
  for (const c of chars) if (by[c.franchise]) by[c.franchise].characters.push(c);
  return Object.values(by).filter(f => f.scenes.length && f.characters.length).sort((a, b) => a.name.localeCompare(b.name));
}

// What the character is doing in the still, one per pick so redos don't repeat one pose. Settled poses
// the clip can hold (it only adds breathing, blinks, glances and small hand movements).
export const ACTIVITIES = [
  'sitting on a crate or ledge, tinkering with a small gadget or piece of their gear in their hands',
  'leaning on a railing, watching the scene below',
  'sitting at a counter or stall with a drink, half turned towards the street',
  'crouched on a rooftop edge or high perch, looking out over the place',
  'working at a bench or device, lit by its glow',
  'leaning in a doorway or against a wall, arms folded, watching something off to the side',
  'sitting on steps, elbows on knees, looking at something in their hands',
  'standing at a window or edge, one hand resting on the frame, looking out'
];

// The pick for a week: random franchise, random scene and character inside it, seeded by the week.
// `character` (a name, any case) pins the week to that character, its franchise and one of its
// scenes, for a remake Roy asks for by name. `variant` (a redo) reseeds the scene and the activity and
// avoids `avoidScene` (the scene the week had), so remaking a week doesn't give the same picture again
// (Roy, 6 Oct 2026: five redos of W41 came out with the same scene and pose). Variant 0 is the Monday pick.
export function pickTheme(catalogue, week, { character: want = null, variant = 0, avoidScene = null } = {}) {
  const r = rng('roy-os:' + week + (variant ? ':' + variant : ''));
  let f = catalogue[Math.floor(r() * catalogue.length)];
  if (want) {
    f = catalogue.find(x => x.characters.some(c => c.character_name.toLowerCase() === String(want).trim().toLowerCase()));
    if (!f) throw new Error('No character named ' + want + ' in the catalogue');
  }
  const scenes = avoidScene && f.scenes.length > 1 ? f.scenes.filter(x => x.scene_name !== avoidScene) : f.scenes;
  const scene = scenes[Math.floor(r() * scenes.length)];
  const character = want ? f.characters.find(c => c.character_name.toLowerCase() === String(want).trim().toLowerCase()) : f.characters[Math.floor(r() * f.characters.length)];
  const activity = ACTIVITIES[Math.floor(r() * ACTIVITIES.length)];
  return {
    week, franchise: f.name, scene: scene.scene_name, character: character.character_name, character_id: character.id,
    look: scene.canonical_elements, palette: PALETTES[f.name] || DEFAULT_PALETTE, activity,
    prompts: { still: stillPrompt(scene, character, activity), clip: clipPrompt() }, avatar_url: character.avatar_url || null
  };
}

// The lore for tap the world: the scene's and the character's own descriptions from the catalogue
// (canonical_identity) and the scene's signature features as a few short words. Read only, nothing generated.
export function loreFor(catalogue, row) {
  if (!row || !Array.isArray(catalogue)) return null;
  const f = catalogue.find(x => x.name === row.franchise);
  if (!f) return null;
  const scene = f.scenes.find(x => x.scene_name === row.scene), ch = f.characters.find(x => (row.character_id && String(x.id) === String(row.character_id)) || x.character_name === row.character);
  const clip = t => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length <= 420) return t; const cut = t.slice(0, 420), end = cut.lastIndexOf('. '); return end > 200 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…'; };
  const feel = String(scene && scene.signature_features || '').split(/[;,\n]+/).map(x => x.trim().replace(/\.$/, '')).filter(x => x && x.length <= 40).slice(0, 5);
  const lore = { scene: clip(scene && scene.canonical_identity), character: clip(ch && ch.canonical_identity), feel };
  return lore.scene || lore.character || feel.length ? lore : null;
}

// A remake asked for in the config, for when no one can call /theme/run: REMAKE is
// "<week>|<character>|<ISO time>". The hourly cron remakes that week with that character once,
// only while the week's row was started before that time; a later deploy can ask again.
export function remakeDue(spec, row, week) {
  const [w, character, at] = String(spec || '').split('|').map(x => x.trim());
  const t = Date.parse(at || '');
  if (!w || !character || isNaN(t) || w !== week) return null;
  if (row && row.started_at && Date.parse(row.started_at) >= t) return null;
  return character;
}

// ---- The week's critter ----
// Every week a small fantasy creature that belongs in the week's world walks the tops of the tiles.
// The chat model picks and describes it; flare paints it as three transparent sheets of 8 frames
// (4 by 2): the walk first, then rest and leap with the walk sheet as the reference, so it stays
// the same creature. Each sheet has one plain standing frame, so the board can size them alike.
export const CRITTER_SHEETS = ['walk', 'rest', 'leap'];
export const CRITTER_FALLBACK = { name: 'Black cat', look: 'a sleek short-haired black cat with green-gold eyes' };

export function critterPickMessages(theme) {
  return [
    { role: 'system', content: 'You pick the one small creature that lives on a desk dashboard for a week, walking along the tops of its panels. It must be a fantasy creature that belongs in the given world: invented for it or drawn from its lore and mood, never a named character, never a person or humanoid. It has four legs and the body of a small agile animal, so it can walk, sit upright, groom a raised front paw, curl up asleep and leap like a cat. No big wings, no long trailing parts, no text or logos on it. Answer as JSON: {"name": "2 to 3 words", "look": "one sentence of at most 35 words: body shape, size like a cat, colours, markings, eyes, any glow, in plain visual words"}.' },
    { role: 'user', content: `World: ${theme.franchise}, ${theme.scene}. Look of the scene: ${theme.look || 'not given'}. The week's character (not the creature): ${theme.character}.` }
  ];
}

// The chat model's answer, cleaned; anything unusable falls back to the black cat.
export function critterFromAnswer(a) {
  const clean = (v, n) => String(v || '').replace(/["\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const name = clean(a && a.name, 40), look = clean(a && a.look, 300);
  return name && look ? { name, look } : { ...CRITTER_FALLBACK };
}

const SHEET = 'Eight frames in a 4 by 2 grid, read left to right, top row first, with generous empty space around each frame so they can be cut apart. Side view, every frame facing right, all at the same size and scale.';
const STYLE = 'Painterly semi-realistic anime key art, crisp silhouette, fine detail, soft rim light in the colours of the world it lives in.';
const SAME = 'The reference image is a sprite sheet of this creature. Draw exactly the SAME creature, copied from the reference: the same head shape, ears, crest or spines, fur, colours, markings, glowing parts, eyes, paws and tail, in the same painterly style and at the same scale. Where the words below and the reference differ, follow the reference.';
const BARE = 'Transparent background. No ground, no floor, no cast shadows, no text, no numbers, no labels, no grid lines, no frames, nothing else in the image.';
export function critterPrompts(critter, theme) {
  const who = `${critter.look} It lives in ${theme.scene} (${theme.franchise}).`;
  return {
    walk: [`A sprite sheet of one small fantasy creature for an animated desk dashboard: ${who}`, 'An 8-frame walk cycle.', SHEET,
      'The head and back at the same height in every frame, so the frames line up when played in a loop. One full stride, evenly spaced in time: 1 near front paw reaching forward and touching down, far hind leg pushed back; 2 weight moving onto the near front paw; 3 passing pose, the near hind leg swinging forward under the body; 4 near hind paw reaching forward, far front leg pushed back; 5 far front paw reaching forward and touching down, near hind leg pushed back; 6 weight moving onto the far front paw; 7 passing pose, the far hind leg swinging forward under the body; 8 far hind paw reaching forward, near front leg pushed back, leading back into frame 1. Calm unhurried walk, tail low in a soft curve, swaying a little.',
      STYLE, BARE].join(' '),
    rest: [SAME, `The creature: ${who}`, 'Eight resting poses.', SHEET,
      '1 sitting upright, tail around the front paws, looking ahead; 2 the same sitting pose with the head turned, looking over its shoulder; 3 sitting, one front paw raised to the mouth; 4 sitting, licking the raised paw, eyes half closed; 5 curled up asleep, eyes closed; 6 the same curled sleeping pose breathing in, the body a little rounder; 7 standing still on all four legs, calm, looking ahead; 8 a long stretch, front legs reaching far forward, chest low, hind end up.',
      STYLE, BARE].join(' '),
    leap: [SAME, `The creature: ${who}`, 'One leap from one ledge to another, in 8 frames.', SHEET,
      '1 standing still on all four legs, calm, looking ahead; 2 crouched low, hind legs bunched, ready to spring; 3 pushing off, hind legs extending, front paws leaving the ground; 4 rising, body angled up, front legs tucked; 5 fully stretched in mid-air, front paws reaching forward, hind legs trailing; 6 starting to come down, front legs reaching down; 7 landing on the front paws, hind legs still in the air; 8 landed on all four paws, settling.',
      STYLE, BARE].join(' ')
  };
}

// CRITTER_ART asks for a week's critter outside the Monday run, made once per ask: "<week>|<ISO time>"
// for a whole new critter, or "<week>|<sheet>|<ISO time>" to repaint one sheet of the week's critter.
export function critterDue(spec, done) {
  const parts = String(spec || '').split('|').map(x => x.trim()), [week] = parts, at = parts[parts.length - 1];
  const sheet = parts.length === 3 ? parts[1] : null;
  if (!/^\d{4}-W\d{2}$/.test(week || '') || isNaN(Date.parse(at || '')) || done) return null;
  if (parts.length > 3 || (sheet && !CRITTER_SHEETS.includes(sheet))) return null;
  return { week, sheet, key: 'critter-ask:' + parts.join('|') };
}

// ---- Prompts ----
// The still follows the scene and character rows word for word where it matters,
// plus the desk's layout: subject in the middle third, both sides dark and calm, room for the quote. It never
// mentions the screen's panels or timeline: flare drew them into W41's still as boxes (6 Oct 2026).
// A wide shot with the character small and busy in the scene: "waist up" gave W42 a pin-up bust facing
// the viewer (Roy, 6 Oct 2026: "part of the scene, doing something"). Kept short and with the age pinned to
// the reference: a longer version ("dressed as they are day to day in the show", "nothing that puts the body
// on display", the reference "for identity only") made W41's Jinx look like a child.
export function stillPrompt(scene, character, activity = ACTIVITIES[1]) {
  return [
    'Semi-realistic anime key art, painterly cinematic lighting, crisp shapes, rich fine detail; the character exactly as in the reference image (face, hair, outfit), rendered in that same style. Not photorealistic.',
    `A wide 16:9 living-wallpaper still for a desk dashboard. Setting: ${scene.scene_name} (${scene.franchise}): ${scene.canonical_identity}. Elements: ${scene.canonical_elements}. Feel: ${scene.signature_features}.`,
    `The character is ${character.character_name} (${character.franchise}): ${character.canonical_identity} ${character.canonical_elements} Same person as in the reference image: same age, adult face and body proportions, hair and outfit. Never younger, never childlike or chibi.`,
    `Wide shot: the place matters as much as the character, who fills about two thirds of the frame height (cut around the knees or thighs by the bottom edge or foreground). They are ${activity}, absorbed in it the way they would be there, seen from the side or three-quarters, not looking at the viewer, in a settled pose they can hold. Not a close-up, not a pin-up or glamour pose.`,
    'Composition: one continuous scene from edge to edge; the screen\'s own widgets are laid over it later, so none are drawn. Keep the character inside the middle third of the frame width, near the centre, with their head and what they are doing in the upper two thirds of the height. The outer quarter of the width on the left and on the right is more of the same scene (walls, buildings, sky, foliage), darker and calmer, with few bright lights. The bottom fifth holds only ground, foreground and reflections, nothing that matters. Leave the upper area just right of the character open and calm. The top edge is calm. Small in-world signs are fine.',
    `Restrictions: ${scene.restrictions} ${character.restrictions} No watermark. No frames, borders, panels, boxes, windows, cards, rounded rectangles, outlines, grids, timelines, interface or HUD elements, and no text overlays anywhere in the image: only the scene.`
  ].join('\n\n');
}

// The clip follows the quest engine's living-wallpaper rules: locked camera, the character
// anchored in place, every motion back to its start. Roy asked (6 Oct 2026) for a little life in
// the character too: expressions, glances and small gestures in place, never a step or a pan.
// It never names the character: Veo's filter reads a name as a real person (5 Oct 2026).
export function clipPrompt() {
  return [
    'Animate the supplied image as a seamless infinite loop for dashboard playback. Preserve the character exactly as drawn there: identity, outfit, materials, lighting, anatomy, composition and the semi-realistic anime rendering; do not make it photorealistic.',
    'ABSOLUTE RULES:\n- The camera must remain completely static and locked.\n- No zoom, pan, tilt, dolly, push-in, parallax, shake, reframing, or perspective drift.\n- Create a clean cyclic loop where the final frame matches the first frame as closely as possible.\n- No cuts, transitions, or new elements appearing/disappearing.\n- The character looks the same in every frame: nothing is added to or taken from them (no headset, glasses, hat, mask, hood, jewellery, weapon or prop appears, vanishes or changes); hair, face and outfit stay exactly as in the first frame.',
    'MOTION:\n- The character is alive but stays in place: breathing, blinking, a glance away and back, a change of expression (a smile, a smirk, a narrowed look), a slight tilt or turn of the head, a shift of weight, a small gesture with the hands or with what they hold.\n- The scene lives around them: hair and cloth moving in the air, flickering signs and lights, drifting haze or steam, falling rain or particles, reflections moving on wet ground.\n- No walking, stepping, running, lunging, leaning out of the frame or large body movement; the character keeps the same position and size in the frame throughout.\n- Every motion is a small arc that comes back: by the last frame the pose, gaze and expression match the source image again, so the loop closes without a jump.',
    'COMPOSITION:\n- Preserve the composition: the character stays inside the middle third, both sides stay dark and calm.\n- Keep anatomy coherent. No new text, UI, frames, boxes, panels or overlays.',
    'OUTPUT:\n- Alive, subtle, stable, premium. Landscape 16:9. Sound: only the soft ambient sound of the place (hum, rain, distant traffic); no voices, no speech, no singing, no music.\n- Prioritize seamless loop continuity over dramatic motion.'
  ].join('\n\n');
}
