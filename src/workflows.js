// The weekly world, as a Workflow: pick, still, clip, each paid step run once and its
// result kept small (Cloudinary ids only), so a retry never pays twice.
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { generateStill, generateClip, generateSprite, spriteUrl, cloudinaryUpload, chatJson, stillUrl169, THEME_FOLDER } from './media.js';
import { CRITTER_SHEETS, critterPickMessages, critterFromAnswer, critterPrompts } from './themes.js';
import { state } from './state.js';

const CHEAP = { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' }, timeout: '2 minutes' };
const ONCE_PAID = { retries: { limit: 0, delay: '1 second' }, timeout: '15 minutes' };

export class DeskTheme extends WorkflowEntrypoint {
  async run(event, step) {
    const { week } = event.payload;
    const s = state(this.env);
    // Only the week's critter (CRITTER_ART asks for one outside the Monday run).
    if (event.payload.critterWeek) return this.critter(event.payload.critterWeek, step, s, event.payload.critterSheet || null);
    try {
      const theme = await step.do('load pick', CHEAP, async () => {
        const t = await s.theme(week);
        if (!t) throw new Error(`No pick stored for ${week}`);
        // A retry after a failed clip keeps the still it already paid for.
        return { prompts: t.prompts, character_id: t.character_id, still: t.still_public_id ? { public_id: t.still_public_id, version: t.still_version } : null };
      });
      const avatar = await step.do('avatar url', CHEAP, async () => {
        const row = await this.env.DB.prepare('SELECT avatar_url FROM characters WHERE id = ?').bind(theme.character_id).first();
        return (row && row.avatar_url) || null;
      });
      const still = theme.still || await step.do('still', ONCE_PAID, async () => {
        const image = await generateStill(this.env, theme.prompts.still, avatar ? [avatar] : []);
        return cloudinaryUpload(this.env, image.bytes, { resourceType: 'image', mimeType: image.mimeType, publicId: `${THEME_FOLDER}/${week}-still`, assetFolder: THEME_FOLDER, tags: 'desk-theme' });
      });
      await step.do('save still', CHEAP, async () => s.updateTheme(week, { still_public_id: still.public_id, still_version: String(still.version), status: 'still' }));
      const clip = await step.do('clip', ONCE_PAID, async () => {
        const video = await generateClip(this.env, stillUrl169(still.public_id, still.version), theme.prompts.clip);
        return cloudinaryUpload(this.env, video.bytes, { resourceType: 'video', mimeType: video.mimeType, publicId: `${THEME_FOLDER}/${week}-clip`, assetFolder: THEME_FOLDER, tags: 'desk-theme' });
      });
      await step.do('save clip', CHEAP, async () => s.updateTheme(week, { clip_public_id: clip.public_id, clip_version: String(clip.version), status: 'ready', finished_at: new Date().toISOString() }));
    } catch (err) {
      await s.updateTheme(week, { status: 'failed', error: String(err && err.message || err).slice(0, 500), finished_at: new Date().toISOString() });
      throw err;
    }
    // The critter comes after the world is ready; when it fails the world stays and the board shows the drawn cat.
    await this.critter(week, step, s).catch(err => console.error('critter ' + week + ': ' + (err && err.message || err)));
    return { ok: 1, week };
  }

  // The week's critter: picked by the chat model, painted as three sheets (walk, then rest and leap
  // with the walk as reference), each paid once; what was made is remembered as critter:<week>.
  // With `only`, the week's critter keeps its pick and other sheets and that one sheet is repainted.
  async critter(week, step, s, only = null) {
    const theme = await step.do('critter world', CHEAP, async () => {
      const t = await s.theme(week);
      if (!t) throw new Error(`No pick stored for ${week}`);
      return { franchise: t.franchise, scene: t.scene, look: t.look, character: t.character };
    });
    const kept = only ? await step.do('critter kept', CHEAP, async () => s.cached('critter:' + week)) : null;
    if (only && !(kept && kept.walk && kept.walk.public_id)) throw new Error(`No critter with a walk sheet for ${week}`);
    const critter = kept ? { name: kept.name, look: kept.look } : await step.do('critter pick', CHEAP, async () => critterFromAnswer(await chatJson(this.env, critterPickMessages(theme), { maxTokens: 300 }).catch(() => null)));
    const prompts = critterPrompts(critter, theme), made = kept ? { walk: kept.walk, rest: kept.rest, leap: kept.leap } : {};
    for (const sheet of CRITTER_SHEETS) {
      if (only && sheet !== only) continue;
      made[sheet] = await step.do('critter ' + sheet, ONCE_PAID, async () => {
        const image = await generateSprite(this.env, prompts[sheet], sheet === 'walk' ? null : spriteUrl(made.walk.public_id, made.walk.version));
        const up = await cloudinaryUpload(this.env, image.bytes, { resourceType: 'image', mimeType: image.mimeType, publicId: `${THEME_FOLDER}/${week}-critter-${sheet}`, assetFolder: THEME_FOLDER, tags: 'desk-critter' });
        return { public_id: up.public_id, version: up.version };
      }).catch(err => ({ error: String(err && err.message || err).slice(0, 300) }));
      if (sheet === 'walk' && made.walk.error) break;
    }
    await step.do('save critter', CHEAP, async () => s.remember('critter:' + week, { ...critter, ...made, made_at: new Date().toISOString() }, 3650 * 864e5));
    return { ok: 1, week, critter: critter.name };
  }
}
