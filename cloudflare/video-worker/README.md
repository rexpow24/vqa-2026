# VQA video Worker

This Worker streams link-shared Google Drive videos after the VQA app authorizes a viewer.
The app redirects the browser with an encrypted, one-hour URL that does not reveal the Drive file ID.
The Worker forwards byte ranges for seeking and strips Google's cross-origin and attachment headers.

## Deploy

1. Run `npm ci` in this directory and sign in with `npx wrangler login`.
2. Generate one random 32-byte base64url secret and set it as `VIDEO_WORKER_SECRET` in both the Worker and the Vercel project.
3. Set the Worker secret with `npx wrangler secret put VIDEO_WORKER_SECRET`.
4. Run `npm run deploy` and copy the resulting HTTPS `workers.dev` origin.
5. In the Vercel project, set `VIDEO_WORKER_URL` to that origin and `VIDEO_WORKER_SECRET` to the same secret for Production.
6. Redeploy the Vercel project so the new environment variables take effect.

Without both Vercel variables, the existing Vercel video stream remains active.
The Worker URL is a temporary bearer link: someone who copies it can watch that video until it expires, but it contains no permanent Drive URL.
