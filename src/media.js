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
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${(data.error && data.error.message) || 'request failed'}`);
  return data;
}

async function readUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not read ${new URL(url).pathname} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

// ---- Nano Banana 2: a 16:9 still, steered by reference images (the character's avatar) ----
export async function generateStill(env, prompt, referenceUrls = []) {
  const parts = [{ text: prompt }];
  for (const url of referenceUrls) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: toBase64(await readUrl(url)) } });
  }
  const data = await gemini(env, 'POST', `/models/${env.IMAGE_MODEL || 'gemini-3.1-flash-image'}:generateContent`, {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: '2K' } }
  });
  const out = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const image = out.find(p => p.inlineData);
  if (!image) throw new Error('Gemini returned no image: ' + JSON.stringify(data).slice(0, 300));
  return { bytes: fromBase64(image.inlineData.data), mimeType: image.inlineData.mimeType || 'image/jpeg' };
}

// ---- Veo: the still as first AND last frame, so the clip has to come back to its start ----
export async function generateClip(env, stillUrl, prompt) {
  const still = { bytesBase64Encoded: toBase64(await readUrl(stillUrl)), mimeType: 'image/jpeg' };
  const model = env.VIDEO_MODEL || 'veo-3.1-fast-generate-preview';
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
