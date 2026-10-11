// ---- Work Garden ----
// Roy OS is the way into Work Garden (Roy, 11 Oct 2026: "my RoyOS should have the access layer,
// from there I should be able to navigate to the other pages"). GET /go/garden, behind the desk cookie,
// asks Work Garden for a one-time pass over the WORK_GARDEN service binding (its GardenPass entrypoint,
// not reachable from the internet) and sends the browser to WORK_GARDEN_URL/pass?t=…, good once within
// a minute. Work Garden sends visitors without a session here, so they come straight back signed in.

const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };

export async function goGarden(env) {
  if (!env.WORK_GARDEN || !env.WORK_GARDEN_URL) {
    return new Response('Work Garden is not connected (WORK_GARDEN, WORK_GARDEN_URL).', { status: 503, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const pass = await env.WORK_GARDEN.mint();
  if (!/^[0-9a-f]{64}$/.test(String(pass))) {
    return new Response('Work Garden did not hand over a pass.', { status: 502, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: env.WORK_GARDEN_URL + '/pass?t=' + pass } });
}

// ---- Painting for Work Garden ----
// Work Garden's pictures are painted with Roy OS's OpenAI and Gemini keys, so the keys live in one place
// (Roy, 11 Oct 2026: "can't you reuse the keys from the roy os?"). The Studio entrypoint (src/studio.js) is
// reached only over a service binding, never from the internet; Work Garden sends fixed prompts. These checks
// keep what it may ask for small.
export function checkPaint(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw new Error('A prompt of 1 to 4000 characters is needed');
  return prompt;
}
export function checkClip(imageUrl, prompt) {
  checkPaint(prompt);
  let url;
  try { url = new URL(imageUrl); } catch { throw new Error('The image must be an https address'); }
  if (url.protocol !== 'https:') throw new Error('The image must be an https address');
  return { imageUrl: url.href, prompt };
}
