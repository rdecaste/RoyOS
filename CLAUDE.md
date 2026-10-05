# Roy OS

The desk screen next to Roy all day (ASUS ZenScreen 1920×1080, landscape), with a new world every Monday. A Cloudflare Worker: `src/index.js` serves the page and JSON, `src/workflows.js` makes the week's still and clip, `src/state.js` is the SQLite Durable Object that keeps Roy OS's own state.

## Rules
- The quest D1 (`quest`) is **read only** here. Its schema belongs to quest-engine; never add migrations for it in this repo. Roy OS's own state (weekly worlds, the day's ticks, moods, plan, commute) lives in the `DeskState` Durable Object.
- The main quest never reaches the screen (`safeText` in `src/data.js`, `DESK_HIDE`). Bad habits are never listed. The boss has no visuals here.
- Media: the quest engine's models (`gpt-image-2.5-flare` stills, `gemini-omni-flash-preview` clips), both to Cloudinary folder `Desk-Themes`; Nano Banana and Veo stay selectable by env var. Prompts in `src/themes.js`; the clip rules mirror quest-engine's living-wallpaper rules (locked camera, character anchored, ambient motion only, loop closes) and never name the character.
- Before committing: `git pull --rebase` (other sessions work here too), then `npm test`.
- Deploys: Cloudflare Workers Builds on push to `main` (`npm test` must pass). Check with `npx wrangler deployments list`. Secrets are set with `npx wrangler secret put` (names in `wrangler.jsonc`).
- Keep `docs/royos.md` current with every change (routes, data, cron, change log).
- Style as quest-engine: ESM, 2 spaces, single quotes, `// ----` section comments, `{ok, code, message}` JSON, tests with `node:test`.
