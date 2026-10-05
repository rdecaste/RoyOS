// Login: the DESK_PASSWORD secret. A successful login sets a signed, HttpOnly
// cookie for 30 days (the screen logs in once); changing the password signs it out.
// Same scheme as the admin dashboard's src/auth.js.

const COOKIE = 'desk_session';
const MAX_AGE = 30 * 86400;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

// Compares without leaking where two strings differ.
export function sameText(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function sessionCookie(secret, now = Date.now()) {
  const expires = Math.floor(now / 1000) + MAX_AGE;
  const value = `${expires}.${await sign(secret, 'desk:' + expires)}`;
  return `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export async function isSignedIn(request, secret, now = Date.now()) {
  if (!secret) return false;
  const cookie = (request.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!cookie) return false;
  const [expires, mac] = cookie.slice(COOKIE.length + 1).split('.');
  if (!expires || !mac || Number(expires) * 1000 < now) return false;
  return sameText(mac, await sign(secret, 'desk:' + expires));
}
