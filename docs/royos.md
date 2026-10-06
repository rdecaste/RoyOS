# Roy OS

The desk screen next to Roy all day (16-inch ASUS ZenScreen, 1920×1080, landscape). A Cloudflare Worker named `royos`.

## What is on the screen
- **Menu bar:** Roy OS menu (this week's world, wallpaper, full screen, refresh, sign out), the mode (morning, day, evening, night), the week's world chip, a "now" pill with Roy's current plan block and a countdown (hover: Steph and the kids), weather, recovery, date and time.
- **Left:** clock, date, greeting, the focus quest chip; the weather tile (an animated sky for the conditions now: sun or moon, drifting clouds, rain, snow, fog, lightning; the temperature, today's range and wind; the next 12 hours as temperature with a rain-chance bar each; hover for feels-like, sunrise and sunset); Focus (today's win-if from the journal, open must/can to-dos, quick add); Showdown, titled "Goku vs <boss>": two stacked rows, the boss (level, HP bar, HP) and Goku (level, power level, HP bar with the ki shield in blue, XP bar), each with its numbers on the right, plus how many of the five main habits are done today (hover lists them: done, due now, late, later). Tapping the boss row opens the boss card, the Goku row the Goku card, in a popup at the iPhone's size (402 × 874 points) with a Boss / Goku switch; the board refreshes when it closes. Habits are ticked on the boss card only, never from Roy OS.
- **Right:** Me today (recovery ring, long and short term load with a 14-day sparkline, load ratio bar, ki charge, mood faces, commute); From Steph (journal to-dos tagged "Steph"); Coming up (the next three dates from the family calendar; the window lists 30 days).
- **Bottom:** Your day, three lanes (Roy, Steph, Kids), editable, with today's timed events from the family calendar, Steph's work calendar and Roy's personal calendar as dashed blocks (read only); the dock with one icon per app and the Ask box.
- Hover shows details; a click opens the app's window (Body, Focus, Mood, Commute, From Steph, Coming up, Quest), or for Showdown the card popup. Habit nudges (due now, still open) open the boss card.
- The light of day: the glass of the panels, the menu bar, the now pill and the dock carry a faint tint that follows the real sun from the weather data: amber from an hour before sunrise to ninety minutes after, neutral by day, orange around sunset, a cool blue at night. The world clip is never tinted. `body[data-light]` is dawn, day, dusk or night.
- The clip loops through a one-second crossfade (two copies take turns), so the seam never jumps.
- The left column fits the screen to the pixel: Focus shows up to three open to-dos and drops them one by one ("+N more") while the column would run into Your day.
- From 23:00 to 04:00 a lock screen dims the board; a tap wakes it until the next phase.

## Routes
All need the desk cookie unless noted. JSON is `{ok, code, message, ...}`.
- `GET /` the page. `GET /login`, `POST /login` (password, next), `POST /logout`.
- `GET /data` everything the page shows (polled every minute). `GET /theme` this week's world and next week's pick.
- `POST /act` one edit: `{type}` = `todo_tick {text, done}`, `todo_add {text, list}`, `mood {mood, note}`, `work {am, pm, commute}`, `plan {events}`, `undo`. There is no habit edit: habits are ticked on the boss card.
- `GET /card/boss`, `GET /card/goku` the boss card and the Goku card (rdecaste/Boss and rdecaste/MainQuest `index.html`), fetched over the service bindings `BOSS_CARD` (Worker `boss`) and `GOKU_CARD` (Worker `mainquest`), which skip their Cloudflare Access login; served same origin behind the desk cookie, framable by this page only (`X-Frame-Options: SAMEORIGIN`). The cards read and write the quest engine themselves; a boss card tap asks for the card passcode once on this screen (kept in this browser).
- `POST /ask {text}` the Ask box: the board as JSON plus Roy's words go to the chat model, which answers with a reply and actions; the actions are applied through the same code as `/act`, with one undo.
- `GET /status` (no cookie) `{ok, week, theme}` for healthchecks.
- Admin, header `X-Admin-Token`: `GET /theme/list`, `POST /theme/run` (`week`, `force=1`; as JSON `{"week":"2026-W41","force":true}`: the number 1 is not read as force), `POST /theme/retry` (`week`).

## Data
- Quest engine over the service binding (`/boss`, `/hero`, `/mainquest`, `/questboard`, and `/recovery` with `QUEST_ENGINE_TOKEN`): the load ratio with its zone and TSB (`power.load_ratio`), the morning's recovery and the last 7 mornings (`/recovery`, the readiness rules), and main habits and their 14-day history (good hits only), the load series (`power.load`, fitness and fatigue times a factor that is read off today's `power.fitness`), today's fitness, fatigue and form state, the week's peak, ki charge, the focus quest.
- Quest D1, read only: `journal` + `journal_focus` (win-if, must/can), `todos` tagged Steph, `work_location` (today and the year's Belgium share), `workouts` joined with `workout_streams` (this week's sessions with hrTSS, average HR and minutes per zone; Z1 ≤145, Z2 146–162, Z3 163–173, Z4 174–184, Z5 185+). The per-second streams in R2 are not used.
- Weather: Open-Meteo for home (current, hourly for 12 hours, daily range, sunrise and sunset), shaped by `weatherView`, cached 15 minutes.
- Calendars: the published iCloud feeds in `FAMILY_ICS_URL` (the family calendar: lanes by title words, and Coming up) `STEPH_ICS_URL` (Steph's work shifts: her lane only, as work blocks, never in Coming up) and `ROY_ICS_URL` (Roy's personal calendar: his lane and Coming up), webcal read as https, parsed by `src/calendar.js` (timed and all-day events; DAILY/WEEKLY/MONTHLY/YEARLY rules with INTERVAL, UNTIL, COUNT, BYDAY, BYMONTH, BYMONTHDAY; EXDATE; RECURRENCE-ID overrides; Apple's Europe/Brussels and Europe/Paris stamps read in Amsterdam time). `agenda` gives today's timed events as lane blocks and 30 days of dates. The lane is chosen from words in the title (`LANE_WORDS`, e.g. the children's names → Kids, Steph → Steph); one match picks the lane, none or several means everyone. Cached 10 minutes in the Durable Object; nothing is written to the calendar.
- The boss widget (`bossView`): from `/boss` the boss's `boss_name`, `epithet`, `boss_level`, `current_hp`, `max_hp`, `status` and the live hero HP (`hero_hp`, `hero_max_hp`); from `/mainquest` Goku's `level`, `level_xp`, `level_xp_max`, `power.power_level`, `power.shield.amount`, `power.ki`; the form from `/hero` `now.form`. Read only.
- The day's edits (ticks, added to-dos, moods, the plan, the commute) are kept per Amsterdam day in the `DeskState` Durable Object. The journal stays the record of the day; nothing is written to D1 from here.
- Privacy: `safeText` drops any text containing a `DESK_HIDE` word (default `fap,pmo`), so the main quest never shows.

## The weekly world
- Week = ISO week of the Amsterdam date. Before Monday 06:00 the previous week's world is still current.
- Pick: seeded by the week (`rng('roy-os:' + week)`): random franchise among those with desk-worthy scenes and enabled characters (from the `characters` and `scenes` tables), then a random scene and a random character of that franchise. `NOT_FOR_DESK` lists the scenes skipped. The palette per franchise is in `PALETTES`; the page sets `--accent`, `--second`, `--tint` from it.
- Generation (`DeskTheme` Workflow): the still with the quest engine's image model `gpt-image-2.5-flare` (`IMAGE_MODEL`; edit mode with the character's avatar as reference, 2048×1152 (16:9 like the screen; 1536×1024 if the model refuses that size), high, moderation low), uploaded to Cloudinary `Desk-Themes/<week>-still`; the clip with the quest engine's video model `gemini-omni-flash-preview` (`VIDEO_MODEL`; Interactions API, the still's 16:9 centre crop by URL, 16:9 out), uploaded as `Desk-Themes/<week>-clip`. `IMAGE_MODEL` starting with `gemini-` switches the still to Nano Banana, a `VIDEO_MODEL` starting with `veo` switches the clip to Veo (still as first and last frame, 1080p). Veo refuses prompts that name a character, so the clip prompt never does. Status goes `running → still → ready`, or `failed` with the error.
- Cron `5 * * * *`: each hour `ensureTheme` starts the week's generation if the week has no row or its last try failed; running and ready weeks are left alone. `POST /theme/run` with `force=1` remakes a week.
- Prompts: `stillPrompt` (scene and character rows word for word, the character walking through the scene, a medium shot cut at the hips with the head a little above centre so the day lanes never cut the legs, subject in the middle third, the bottom fifth unimportant, both outer quarters dark for the side panels, open space right of the head for the quote) and `clipPrompt` (quest-engine's living-wallpaper rules word for word: locked camera, the character anchored in place, ambient motion only, every motion returns to its start, first and last frame match; the character is never named).

## Operations
- Secrets: `DESK_PASSWORD`, `ADMIN_TOKEN`, `QUEST_ENGINE_TOKEN` (the engine's ADMIN_TOKEN), `GEMINI_API_KEY`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `OPENAI_API_KEY`, `FAMILY_ICS_URL`, `STEPH_ICS_URL`, `ROY_ICS_URL`, `LANE_WORDS`.
- Deploy: push to `main` (Workers Builds runs `npm test`, then deploys). The first deploy creates the Durable Object and the Workflow.
- First world: `curl -X POST https://royos.<account>.workers.dev/theme/run -H "X-Admin-Token: …"`, then watch `GET /theme/list`.

## Change log
- 2026-10-06: the weekly still fits the 1920×1080 desk layout: asked for at 2048×1152 (16:9, no crop or upscale) instead of 1536×1024, and the prompt keeps both sides dark for the panels and leaves room for the quote. Takes effect with the next world (Monday) or a remake.
- 2026-10-06: Boss battle renamed Showdown ("Goku vs <boss>"), the boss and Goku stacked as two rows; the left column no longer runs into Your day (Focus shows as many open to-dos as fit).
- 2026-10-06: Main habits widget replaced by Boss battle: the boss's HP and Goku's level, power level, HP with ki shield and XP; a tap opens the real boss card or Goku card at iPhone size in a popup (`/card/boss`, `/card/goku`, service bindings `BOSS_CARD`, `GOKU_CARD`). Habits can no longer be ticked from Roy OS (the habit action left `/act` and the Ask box; the Main habits window is gone); habit state comes only from the boss card, and the habit nudges open it.
- 2026-10-06: the light of day on the glass: panels, menu bar, now pill and dock take a sunrise, sunset or night tint from the real sun times; the clip stays untouched.
- 2026-10-06: the still is framed as a medium shot (waist up, head above centre, nothing that matters in the bottom quarter) so the Your day lanes and dock no longer cut the character at the knees; this week's world remade.
- 2026-10-05: the weather tile under the clock: an animated sky from the current weather code, the day's range and wind, and the next 12 hours with rain chance; the clock is a touch smaller to make room.
- 2026-10-05: Roy's personal calendar (third iCloud feed) fills his lane and Coming up.
- 2026-10-05: Steph's work calendar (second iCloud feed) fills her lane with the day's shifts.
- 2026-10-05: the family calendar (published iCloud feed) feeds Coming up and the day lanes; the Ask box sees it too.
- 2026-10-05: the load ratio cell names the four bands (low, optimal, high, risk) under the bar, each centred in its band, with today's lit in its colour; the word left the cell's header.
- 2026-10-05: the load ratio bar no longer draws yesterday's ghost marker; the move since yesterday stays in the hover tip.
- 2026-10-05: the Load cell shows only long and short (no label, no peak); the sparkline's end dots are smaller and the numbers are set in the label font.
- 2026-10-05: the Body window shows the Goku card's load chart (rdecaste/MainQuest `loadChart`, 12 weeks: long and short load, unlocked moves' marks, form strip, load ratio row with the engine's bands, recovery row; a pointer reads a day), fed by `power.load` as the engine serves it.
- 2026-10-05: recovery and the load ratio come from the quest engine (`/recovery`, `power.load_ratio`); the desk no longer judges nights or picks bands itself.
- 2026-10-05: the Load cell shows the 7-day peak (e.g. ↑38 Sun) and a 14-day sparkline with a tight y axis; the Body chart keeps 4 weeks.
- 2026-10-05: Body shows this week's sessions with TSS and zone minutes from `workouts` and `workout_streams`, and today's form state; the load scale is read off the engine's values.
- 2026-10-05: omni gets the still's 16:9 centre crop (the still is 3:2), so it no longer re-frames; the board uses the same crop as poster.
- 2026-10-05: the clip keeps the character anchored with ambient motion only, as the quest videos do (a wandering character never looped cleanly on omni).
- 2026-10-05: first version. Page and widgets from the mockup (claude.ai artifact "Roy OS"), live data from the quest engine and D1, the weekly world pipeline, the Ask box.
