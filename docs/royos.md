# Roy OS

The desk screen next to Roy all day (16-inch ASUS ZenScreen, 1920×1080, landscape). A Cloudflare Worker named `royos`.

## What is on the screen
- **Menu bar:** Roy OS menu (this week's world, wallpaper, full screen, refresh, sign out), the mode (morning, day, evening, night), the week's world chip, a "now" pill with Roy's current plan block and a countdown (hover: Steph and the kids), weather, recovery, date and time.
- **Left:** clock, date, greeting, the focus quest chip; Focus (today's win-if from the journal, open must/can to-dos, quick add); the five main habits as discs (done, due now, late, later by their usual time).
- **Right:** Me today (recovery ring, long vs short term load sparkline, load ratio bar, ki charge, mood faces, commute); From Steph (journal to-dos tagged "Steph"); Coming up (placeholder until a calendar is connected).
- **Bottom:** Your day, three lanes (Roy, Steph, Kids), editable; the dock with one icon per app and the Ask box.
- Hover shows details; a click opens the app's window (Body, Focus, Main habits, Mood, Commute, From Steph, Coming up, Quest).
- The clip loops through a one-second crossfade (two copies take turns), so the seam never jumps.
- From 23:00 to 04:00 a lock screen dims the board; a tap wakes it until the next phase.

## Routes
All need the desk cookie unless noted. JSON is `{ok, code, message, ...}`.
- `GET /` the page. `GET /login`, `POST /login` (password, next), `POST /logout`.
- `GET /data` everything the page shows (polled every minute). `GET /theme` this week's world and next week's pick.
- `POST /act` one edit: `{type}` = `todo_tick {text, done}`, `todo_add {text, list}`, `habit {name, done}`, `mood {mood, note}`, `work {am, pm, commute}`, `plan {events}`, `undo`.
- `POST /ask {text}` the Ask box: the board as JSON plus Roy's words go to the chat model, which answers with a reply and actions; the actions are applied through the same code as `/act`, with one undo.
- `GET /status` (no cookie) `{ok, week, theme}` for healthchecks.
- Admin, header `X-Admin-Token`: `GET /theme/list`, `POST /theme/run` (`week`, `force=1`), `POST /theme/retry` (`week`).

## Data
- Quest engine over the service binding (`/boss`, `/hero`, `/mainquest`, `/questboard`, and `/recovery` with `QUEST_ENGINE_TOKEN`): the load ratio with its zone and TSB (`power.load_ratio`), the morning's recovery and the last 7 mornings (`/recovery`, the readiness rules), and main habits and their 14-day history (good hits only), the load series (`power.load`, fitness and fatigue times a factor that is read off today's `power.fitness`), today's fitness, fatigue and form state, the week's peak, ki charge, the focus quest.
- Quest D1, read only: `journal` + `journal_focus` (win-if, must/can), `todos` tagged Steph, `work_location` (today and the year's Belgium share), `workouts` joined with `workout_streams` (this week's sessions with hrTSS, average HR and minutes per zone; Z1 ≤145, Z2 146–162, Z3 163–173, Z4 174–184, Z5 185+). The per-second streams in R2 are not used.
- Weather: Open-Meteo for home, cached 15 minutes.
- The day's edits (ticks, added to-dos, habit ticks, moods, the plan, the commute) are kept per Amsterdam day in the `DeskState` Durable Object. The journal stays the record of the day; nothing is written to D1 from here.
- Privacy: `safeText` drops any text containing a `DESK_HIDE` word (default `fap,pmo`), so the main quest never shows.

## The weekly world
- Week = ISO week of the Amsterdam date. Before Monday 06:00 the previous week's world is still current.
- Pick: seeded by the week (`rng('roy-os:' + week)`): random franchise among those with desk-worthy scenes and enabled characters (from the `characters` and `scenes` tables), then a random scene and a random character of that franchise. `NOT_FOR_DESK` lists the scenes skipped. The palette per franchise is in `PALETTES`; the page sets `--accent`, `--second`, `--tint` from it.
- Generation (`DeskTheme` Workflow): the still with the quest engine's image model `gpt-image-2.5-flare` (`IMAGE_MODEL`; edit mode with the character's avatar as reference, 1536×1024, high, moderation low), uploaded to Cloudinary `Desk-Themes/<week>-still`; the clip with the quest engine's video model `gemini-omni-flash-preview` (`VIDEO_MODEL`; Interactions API, the still's 16:9 centre crop by URL, 16:9 out), uploaded as `Desk-Themes/<week>-clip`. `IMAGE_MODEL` starting with `gemini-` switches the still to Nano Banana, a `VIDEO_MODEL` starting with `veo` switches the clip to Veo (still as first and last frame, 1080p). Veo refuses prompts that name a character, so the clip prompt never does. Status goes `running → still → ready`, or `failed` with the error.
- Cron `5 * * * *`: each hour `ensureTheme` starts the week's generation if the week has no row or its last try failed; running and ready weeks are left alone. `POST /theme/run` with `force=1` remakes a week.
- Prompts: `stillPrompt` (scene and character rows word for word, the character walking through the scene, subject in the middle third, the left third dark) and `clipPrompt` (quest-engine's living-wallpaper rules word for word: locked camera, the character anchored in place, ambient motion only, every motion returns to its start, first and last frame match; the character is never named).

## Operations
- Secrets: `DESK_PASSWORD`, `ADMIN_TOKEN`, `QUEST_ENGINE_TOKEN` (the engine's ADMIN_TOKEN), `GEMINI_API_KEY`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `OPENAI_API_KEY`.
- Deploy: push to `main` (Workers Builds runs `npm test`, then deploys). The first deploy creates the Durable Object and the Workflow.
- First world: `curl -X POST https://royos.<account>.workers.dev/theme/run -H "X-Admin-Token: …"`, then watch `GET /theme/list`.

## Change log
- 2026-10-05: recovery and the load ratio come from the quest engine (`/recovery`, `power.load_ratio`); the desk no longer judges nights or picks bands itself.
- 2026-10-05: the Load cell shows the 7-day peak (e.g. ↑38 Sun) and a 14-day sparkline with a tight y axis; the Body chart keeps 4 weeks.
- 2026-10-05: Body shows this week's sessions with TSS and zone minutes from `workouts` and `workout_streams`, and today's form state; the load scale is read off the engine's values.
- 2026-10-05: omni gets the still's 16:9 centre crop (the still is 3:2), so it no longer re-frames; the board uses the same crop as poster.
- 2026-10-05: the clip keeps the character anchored with ambient motion only, as the quest videos do (a wandering character never looped cleanly on omni).
- 2026-10-05: first version. Page and widgets from the mockup (claude.ai artifact "Roy OS"), live data from the quest engine and D1, the weekly world pipeline, the Ask box.
