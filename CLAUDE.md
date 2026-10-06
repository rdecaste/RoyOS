# Roy OS

The desk screen next to Roy all day (ASUS ZenScreen 1920×1080, landscape), with a new world every Monday. A Cloudflare Worker: `src/index.js` serves the page and JSON, `src/workflows.js` makes the week's still and clip, `src/state.js` is the SQLite Durable Object that keeps Roy OS's own state.

## Rules
- The quest D1 (`quest`) is **read only** here. Its schema belongs to quest-engine; never add migrations for it in this repo. Roy OS's own state (weekly worlds, the day's ticks, moods, plan, focus sessions) lives in the `DeskState` Durable Object. The one write path: commute days (places and ride) go to `work_location` through the admin dashboard's own `POST /border/save` (`src/work.js`, binding `ADMIN_BOARD`), never as SQL from here (Roy, 6 Oct 2026).
- Recovery and the load ratio are the quest engine's (`/recovery`, `power.load_ratio`); never compute a health verdict here.
- The calendars (the family one, Steph's work one, Roy's personal one and, when set, the kids' one) are published iCloud feeds, read only (`src/calendar.js`); their links and the lane words (family names) are secrets, never in the repo.
- The main quest never reaches the screen (`safeText` in `src/data.js`, `DESK_HIDE`). Bad habits are never listed. The boss has no visuals here, with one exception Roy asked for (6 Oct 2026): the Showdown widget (boss HP and Goku's metrics) and its popup, which shows the real boss card and Goku card (`/card/boss`, `/card/goku`) as on his iPhone.
- Habits are ticked on the boss card only, never from Roy OS: no habit action in `/act` or the Ask box; habit state is read from the quest engine (`/boss`).
- Media: `gpt-image-2.5-flare` stills (the quest engine's) and omni clips (`gemini-omni-flash-preview`, 720p; Roy went back from Veo on 6 Oct 2026 because a Veo clip cost €1–2), both to Cloudinary folder `Desk-Themes`; Nano Banana and Veo 3.1 1080p (`veo-3.1-generate-preview`, the still as first and last frame) stay selectable by env var. Prompts in `src/themes.js`; the clip rules follow quest-engine's living-wallpaper rules (locked camera, character anchored, loop closes) and never name the character; Roy allows small character motion in place (expressions, glances, small gestures, 6 Oct 2026), never a camera move or a step.
- Before committing: `git pull --rebase` (other sessions work here too), then `npm test`.
- Deploys: Cloudflare Workers Builds on push to `main` (`npm test` must pass). Check with `npx wrangler deployments list`. Secrets are set with `npx wrangler secret put` (names in `wrangler.jsonc`).
- Keep `docs/royos.md` current with every change (routes, data, cron, change log).
- Style as quest-engine: ESM, 2 spaces, single quotes, `// ----` section comments, `{ok, code, message}` JSON, tests with `node:test`.
