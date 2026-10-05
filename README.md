# Roy OS

The desk screen next to Roy all day: clock, the day's plan, focus and main habits, body (recovery, training load, ki), mood and commute, an Ask box, and a world that changes every Monday morning: a random franchise, scene and character from the quest database, made as a looping clip.

- Cloudflare Worker, one page, signed in once (30-day cookie).
- Data: the quest engine's public cards (habits, hero, power), the journal's day, nights and workouts from the quest D1 (read only), the weather.
- Weekly world: `DeskTheme` Workflow (Nano Banana 2 still, Veo clip, Cloudinary), started by the hourly cron from Monday 06:00 Amsterdam.

See `docs/royos.md` for routes, data and operations.

```bash
npm install
npm test
npx wrangler dev
```
