import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goGarden } from '../src/garden.js';

const URL_ = 'https://garden.example.test';

test('/go/garden sends the browser to Work Garden with a fresh pass', async () => {
  let asked = 0;
  const pass = 'ab'.repeat(32);
  const r = await goGarden({ WORK_GARDEN: { mint: async () => (asked++, pass) }, WORK_GARDEN_URL: URL_ });
  assert.equal(asked, 1);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('Location'), `${URL_}/pass?t=${pass}`);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.equal(r.headers.get('Referrer-Policy'), 'no-referrer');
});

test('/go/garden refuses when Work Garden is not connected or answers oddly', async () => {
  assert.equal((await goGarden({ WORK_GARDEN_URL: URL_ })).status, 503);
  assert.equal((await goGarden({ WORK_GARDEN: { mint: async () => 'x' } })).status, 503);
  const odd = await goGarden({ WORK_GARDEN: { mint: async () => '"><script>' }, WORK_GARDEN_URL: URL_ });
  assert.equal(odd.status, 502);
  assert.equal(odd.headers.get('Location'), null);
});
