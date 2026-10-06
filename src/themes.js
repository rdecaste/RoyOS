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

// The pick for a week: random franchise, random scene and character inside it, seeded by the week.
export function pickTheme(catalogue, week) {
  const r = rng('roy-os:' + week);
  const f = catalogue[Math.floor(r() * catalogue.length)];
  const scene = f.scenes[Math.floor(r() * f.scenes.length)];
  const character = f.characters[Math.floor(r() * f.characters.length)];
  return {
    week, franchise: f.name, scene: scene.scene_name, character: character.character_name, character_id: character.id,
    look: scene.canonical_elements, palette: PALETTES[f.name] || DEFAULT_PALETTE,
    prompts: { still: stillPrompt(scene, character), clip: clipPrompt() }, avatar_url: character.avatar_url || null
  };
}

// ---- Prompts ----
// The still follows the scene and character rows word for word where it matters,
// plus the desk's layout: subject in the middle third, both sides dark for the panels, room for the quote.
export function stillPrompt(scene, character) {
  return [
    'Semi-realistic anime key art, painterly cinematic lighting, crisp shapes, rich fine detail; the character exactly as in the reference image (face, hair, outfit), rendered in that same style. Not photorealistic.',
    `A wide 16:9 living-wallpaper still for a desk dashboard. Setting: ${scene.scene_name} (${scene.franchise}): ${scene.canonical_identity}. Elements: ${scene.canonical_elements}. Feel: ${scene.signature_features}.`,
    `The character is ${character.character_name} (${character.franchise}): ${character.canonical_identity} ${character.canonical_elements} They are part of the scene, not posing for the camera: standing or leaning in it with their weight settled, looking at something in the scene, relaxed and in character (a settled pose, because the clip holds it; a mid-stride pose reads as frozen). Medium shot, waist up: the figure is cut at the hips by the bottom edge or by foreground elements, never shown full length, and the head sits a little above the centre of the frame.`,
    'Composition: the image fills a 1920x1080 desk screen with see-through panels down both sides (the outer quarter of the width on the left and on the right) and a timeline across the bottom fifth. Keep the character inside the middle third of the frame width, centred, with head and torso in the upper two thirds of the height. Keep both outer quarters darker and calmer, with few bright lights, so the panels stay readable. The bottom fifth holds only ground, foreground and reflections, nothing that matters. Leave the upper area just right of the character open and calm: a short handwritten quote is placed there. The top edge is calm. Small in-world signs are fine.',
    `Restrictions: ${scene.restrictions} ${character.restrictions} No watermark.`
  ].join('\n\n');
}

// The clip follows the quest engine's living-wallpaper rules: locked camera, the character
// anchored in place, every motion back to its start. Roy asked (6 Oct 2026) for a little life in
// the character too: expressions, glances and small gestures in place, never a step or a pan.
// It never names the character: Veo's filter reads a name as a real person (5 Oct 2026).
export function clipPrompt() {
  return [
    'Animate the supplied image as a seamless infinite loop for dashboard playback. Preserve the character exactly as drawn there: identity, outfit, materials, lighting, anatomy, composition and the semi-realistic anime rendering; do not make it photorealistic.',
    'ABSOLUTE RULES:\n- The camera must remain completely static and locked.\n- No zoom, pan, tilt, dolly, push-in, parallax, shake, reframing, or perspective drift.\n- Create a clean cyclic loop where the final frame matches the first frame as closely as possible.\n- No cuts, transitions, or new elements appearing/disappearing.',
    'MOTION:\n- The character is alive but stays in place: breathing, blinking, a glance away and back, a change of expression (a smile, a smirk, a narrowed look), a slight tilt or turn of the head, a shift of weight, a small gesture with the hands or with what they hold.\n- The scene lives around them: hair and cloth moving in the air, flickering signs and lights, drifting haze or steam, falling rain or particles, reflections moving on wet ground.\n- No walking, stepping, running, lunging, leaning out of the frame or large body movement; the character keeps the same position and size in the frame throughout.\n- Every motion is a small arc that comes back: by the last frame the pose, gaze and expression match the source image again, so the loop closes without a jump.',
    'COMPOSITION:\n- Preserve the composition: the character stays inside the middle third, both sides stay dark and calm for dashboard overlays.\n- Keep anatomy coherent. No new text, UI, panels or overlays.',
    'OUTPUT:\n- Alive, subtle, stable, premium. Landscape 16:9. Silent: no dialogue, music or sound effects.\n- Prioritize seamless loop continuity over dramatic motion.'
  ].join('\n\n');
}
