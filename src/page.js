// The one page. CSS, markup and the browser script are plain files in web/ (imported
// as text); the board's data is embedded for the first paint and refreshed by the script.
import css from '../web/os.css';
import markup from '../web/os.html';
import client from '../web/os.client.js';

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, ' ');

const HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700;800&family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Chakra+Petch:wght@500;600;700&display=swap">`;

export function deskPage({ data, theme, moodArt }) {
  return `${HEAD}<title>Roy OS</title><style>${css}</style></head><body>
${markup}
<script>window.DESK = ${json({ ...data, theme, moodArt })};</script>
<script>${client}</script>
</body></html>`;
}

export function loginPage({ next = '/', wrong = false } = {}) {
  return `${HEAD}<title>Roy OS</title><style>${css}</style></head><body>
<div id="wall" aria-hidden="true"></div>
<main class="signin"><form method="post" action="/login"><h1>Roy OS</h1><p>${wrong ? 'That password is not right.' : 'The desk screen signs in once and stays signed in for 30 days.'}</p>
<input type="hidden" name="next" value="${esc(next)}"><label class="lbl" for="pw">Password</label><input class="inp" id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
<button type="submit" class="btn primary">Sign in</button></form></main>
</body></html>`;
}
