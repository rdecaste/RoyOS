// The weekly world, as a Workflow: pick, still, clip, each paid step run once and its
// result kept small (Cloudinary ids only), so a retry never pays twice.
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { generateStill, generateClip, cloudinaryUpload, stillUrl, THEME_FOLDER } from './media.js';
import { state } from './state.js';

const CHEAP = { retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' }, timeout: '2 minutes' };
const ONCE_PAID = { retries: { limit: 0, delay: '1 second' }, timeout: '15 minutes' };

export class DeskTheme extends WorkflowEntrypoint {
  async run(event, step) {
    const { week } = event.payload;
    const s = state(this.env);
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
        const video = await generateClip(this.env, stillUrl(still.public_id, still.version), theme.prompts.clip);
        return cloudinaryUpload(this.env, video.bytes, { resourceType: 'video', mimeType: video.mimeType, publicId: `${THEME_FOLDER}/${week}-clip`, assetFolder: THEME_FOLDER, tags: 'desk-theme' });
      });
      await step.do('save clip', CHEAP, async () => s.updateTheme(week, { clip_public_id: clip.public_id, clip_version: String(clip.version), status: 'ready', finished_at: new Date().toISOString() }));
      return { ok: 1, week };
    } catch (err) {
      await s.updateTheme(week, { status: 'failed', error: String(err && err.message || err).slice(0, 500), finished_at: new Date().toISOString() });
      throw err;
    }
  }
}
