// Studio: paints for Work Garden with Roy OS's keys (src/garden.js says why). A WorkerEntrypoint is
// reachable only from Workers with a service binding to it (Work Garden's STUDIO binding).
// It reuses the weekly world's painting functions as they are; nothing else in Roy OS calls it.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { generateStill, generateClip, chatJson } from './media.js';
import { checkPaint, checkClip, checkDraft } from './garden.js';

export class Studio extends WorkerEntrypoint {
  // A 16:9 still (IMAGE_MODEL, as the weekly world): the JPEG's bytes.
  async still(prompt) {
    const image = await generateStill(this.env, checkPaint(prompt));
    return image.bytes;
  }
  // A looping clip of the image at imageUrl (VIDEO_MODEL, as the weekly world): the MP4's bytes.
  async clip(imageUrl, prompt) {
    const c = checkClip(imageUrl, prompt);
    const video = await generateClip(this.env, c.imageUrl, c.prompt);
    return video.bytes;
  }
  // A JSON answer from the chat model (CHAT_MODEL, as the Ask box), for Work Garden's planting draft.
  async draft(system, user) {
    return chatJson(this.env, checkDraft(system, user), { maxTokens: 2000 });
  }
}
