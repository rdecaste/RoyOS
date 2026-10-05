// Gemini and Cloudinary for the weekly world: a still with Nano Banana 2, a looping
// clip with Veo, both uploaded straight to Cloudinary. Nothing here returns bytes
// to a Workflow step: steps keep {public_id, version, secure_url} only.

export const CLOUD_NAME = 'a3xk0plk';
export const THEME_FOLDER = 'Desk-Themes';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function gemini(env, method, path, body) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const response = await fetch(`${GEMINI_URL}${path}`, {
    method,
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${(data.error && data.error.message) || JSON.stringify(data).slice(0, 200) || 'request failed'}`);
  return data;
}

async function readUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not read ${new URL(url).pathname} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

// ---- The still: OpenAI gpt-image (the quest engine's image model) or Nano Banana, by IMAGE_MODEL ----
export async function generateStill(env, prompt, referenceUrls = []) {
  const model = env.IMAGE_MODEL || 'gpt-image-2.5-flare';
  return /^gpt-image/.test(model) ? openaiStill(env, model, prompt, referenceUrls) : geminiStill(env, model, prompt, referenceUrls);
}

// gpt-image: edit mode with the character's avatar as the reference face, landscape 1536x1024,
// the same settings as quest-engine's editImage (high, moderation low).
async function openaiStill(env, model, prompt, referenceUrls) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  for (const url of referenceUrls) form.append('image[]', new Blob([await readUrl(url)], { type: 'image/jpeg' }), 'reference.jpg');
  form.append('n', '1'); form.append('size', '1536x1024'); form.append('quality', 'high'); form.append('background', 'opaque'); form.append('moderation', 'low');
  form.append('output_format', 'jpeg'); form.append('output_compression', '92');
  const response = await fetch(referenceUrls.length ? 'https://api.openai.com/v1/images/edits' : 'https://api.openai.com/v1/images/generations', referenceUrls.length
    ? { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: form }
    : { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, n: 1, size: '1536x1024', quality: 'high', background: 'opaque', moderation: 'low', output_format: 'jpeg', output_compression: 92 }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(data.error && data.error.message) || 'image generation failed'}`);
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('OpenAI returned no image');
  return { bytes: fromBase64(b64), mimeType: 'image/jpeg' };
}

// Nano Banana: a 16:9 still, steered by reference images (the character's avatar).
async function geminiStill(env, model, prompt, referenceUrls) {
  const parts = [{ text: prompt }];
  for (const url of referenceUrls) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: toBase64(await readUrl(url)) } });
  }
  const data = await gemini(env, 'POST', `/models/${model}:generateContent`, {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } }
  });
  const out = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const image = out.find(p => p.inlineData);
  if (!image) throw new Error('Gemini returned no image: ' + JSON.stringify(data).slice(0, 300));
  return { bytes: fromBase64(image.inlineData.data), mimeType: image.inlineData.mimeType || 'image/jpeg' };
}

// ---- The clip: Gemini omni (the quest engine's video model, Interactions API) or Veo, by VIDEO_MODEL ----
export async function generateClip(env, stillUrl, prompt) {
  const model = env.VIDEO_MODEL || 'gemini-omni-flash-preview';
  return /^veo/.test(model) ? veoClip(env, model, stillUrl, prompt) : omniClip(env, model, stillUrl, prompt);
}

function findVideo(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'video' && (node.data || node.uri)) return node;
  for (const value of Array.isArray(node) ? node : Object.values(node)) { const found = findVideo(value); if (found) return found; }
  return null;
}

// The image goes in by URL, as quest-engine's animateImage sends it (inline bytes were refused by the filter).
async function omniClip(env, model, imageUrl, prompt) {
  let result = await gemini(env, 'POST', '/interactions', {
    model,
    input: [{ type: 'image', uri: imageUrl, mime_type: 'image/jpeg' }, { type: 'text', text: prompt }],
    response_format: { type: 'video', aspect_ratio: '16:9' }
  });
  const deadline = Date.now() + 12 * 60 * 1000;
  while (!findVideo(result)) {
    const status = String(result.status || '').toLowerCase();
    if (['failed', 'cancelled', 'canceled', 'blocked'].includes(status)) throw new Error('Gemini video ' + status + ': ' + JSON.stringify(result.error || result).slice(0, 300));
    if (!result.id || Date.now() > deadline) throw new Error('Gemini returned no video: ' + JSON.stringify(result).slice(0, 300));
    await sleep(10000);
    result = await gemini(env, 'GET', `/interactions/${result.id}`);
  }
  const video = findVideo(result), mimeType = video.mime_type || video.mimeType || 'video/mp4';
  if (video.data) return { bytes: fromBase64(video.data), mimeType };
  const fileName = video.uri.split('?')[0].replace(/:download$/, '').replace(/^.*\/v1beta\//, '');
  while (true) {
    const file = await gemini(env, 'GET', `/${fileName}`).catch(() => ({ state: 'ACTIVE' }));
    const state = String(file.state || 'ACTIVE').toUpperCase();
    if (state === 'ACTIVE') break;
    if (state === 'FAILED') throw new Error('Gemini video file failed');
    if (Date.now() > deadline) throw new Error('Gemini video file never became ready');
    await sleep(5000);
  }
  const download = await fetch(`${GEMINI_URL}/${fileName}:download?alt=media`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  if (!download.ok) throw new Error(`Gemini download ${download.status}`);
  return { bytes: new Uint8Array(await download.arrayBuffer()), mimeType };
}

// Veo: the still as first AND last frame, so the clip has to come back to its start.
async function veoClip(env, model, stillUrl, prompt) {
  const still = { bytesBase64Encoded: toBase64(await readUrl(stillUrl)), mimeType: 'image/jpeg' };
  let op = await gemini(env, 'POST', `/models/${model}:predictLongRunning`, {
    instances: [{ prompt, image: still, lastFrame: still }],
    parameters: { aspectRatio: '16:9', resolution: '1080p', durationSeconds: 8, personGeneration: 'allow_adult' }
  });
  const deadline = Date.now() + 12 * 60 * 1000;
  while (!op.done) {
    if (Date.now() > deadline) throw new Error('Veo did not finish in 12 minutes');
    await sleep(10000);
    op = await gemini(env, 'GET', `/${op.name}`);
  }
  if (op.error) throw new Error('Veo failed: ' + JSON.stringify(op.error).slice(0, 300));
  const samples = (((op.response || {}).generateVideoResponse || {}).generatedSamples) || [];
  const uri = samples[0] && samples[0].video && samples[0].video.uri;
  if (!uri) throw new Error('Veo returned no video: ' + JSON.stringify(op.response || op).slice(0, 300));
  const download = await fetch(uri, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  if (!download.ok) throw new Error(`Veo download ${download.status}`);
  return { bytes: new Uint8Array(await download.arrayBuffer()), mimeType: 'video/mp4' };
}

// ---- Cloudinary: signed upload, as quest-engine does it ----
async function sha1Hex(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function cloudinaryUpload(env, bytes, { resourceType, mimeType, publicId, assetFolder, tags }) {
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary secrets are not set');
  const params = { timestamp: String(Math.floor(Date.now() / 1000)), public_id: publicId, overwrite: 'true', invalidate: 'true' };
  if (assetFolder) params.asset_folder = assetFolder;
  if (tags) params.tags = tags;
  if (resourceType === 'video') params.use_filename = 'false';
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('signature', await sha1Hex(toSign + env.CLOUDINARY_API_SECRET));
  form.append('file', new Blob([bytes], { type: mimeType }), 'upload');
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body: form });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { public_id: data.public_id, version: data.version, secure_url: data.secure_url };
    last = new Error(`Cloudinary ${response.status}: ${(data.error && data.error.message) || 'upload failed'}`);
    if (response.status < 500 && response.status !== 429) break;
    await sleep(2000 * (attempt + 1));
  }
  throw last;
}

export const stillUrl = (publicId, version) => `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${version ? 'v' + version + '/' : ''}${publicId}.jpg`;
// The still is 3:2 (gpt-image has no 16:9); the clip and the screen are 16:9, so both get the same centre crop.
export const stillUrl169 = (publicId, version) => `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/ar_16:9,c_fill,g_center/${version ? 'v' + version + '/' : ''}${publicId}.jpg`;
export const clipUrl = (publicId, version) => `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${version ? 'v' + version + '/' : ''}${publicId}.mp4`;

// ---- OpenAI chat for the Ask box (the same model the other Workers use) ----
export async function chatJson(env, messages, { maxTokens = 900 } = {}) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  const body = { model: env.CHAT_MODEL || 'gpt-6-astra', messages, response_format: { type: 'json_object' }, max_completion_tokens: maxTokens };
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(data.error && data.error.message) || 'chat failed'}`);
  const text = (((data.choices || [])[0] || {}).message || {}).content || '{}';
  try { return JSON.parse(text); } catch (_) { throw Object.assign(new Error('The answer was not JSON'), { code: 'invalid_json' }); }
}
