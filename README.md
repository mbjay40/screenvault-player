# ScreenVault Player (Cloudflare Worker)

This is the Cloudflare Worker version of the ScreenVault Pro recording player. It replaces the Vercel + GitHub clone flow: no Vercel account, no environment variables. The Worker connects directly to your Cloudflare R2 bucket through an R2 binding and serves your recording pages and videos.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mbjay40/screenvault-player)

## One-click setup (what ScreenVault Pro customers do)

1. Create a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com), open **R2 Object Storage**, and create a bucket (for example `screenvault-recordings`).
2. In R2, open **Manage R2 API Tokens**, create an API token, and grant `Object Read & Write` for the bucket. Copy the Access Key ID and Secret Access Key — these go into the **ScreenVault Pro desktop app**, not the Worker.
3. In ScreenVault Pro's **Publishing** tab, click **Deploy your publishing page**. This opens Cloudflare's one-click **Deploy to Workers** flow. Sign in, choose your R2 bucket when prompted to bind it, and finish.
4. Copy the resulting `https://screenvault-player.<subdomain>.workers.dev` URL into ScreenVault Pro's **Your publishing domain** field.
5. Click **Test Page**. You should see `ScreenVault Player is running.`

## How it differs from the Vercel version

- **No Vercel.** The player runs entirely on Cloudflare Workers.
- **No secrets.** The Worker uses an R2 binding, so no Access Key / Secret Key are stored in the Worker.
- **Private bucket.** Your R2 bucket stays private — the Worker streams video, thumbnails, and logos directly, so you do not need the public `r2.dev` URL.
- **No deploy hook.** Pages render live from R2 on every request, so nothing needs rebuilding after each publish.

## Developing locally

```powershell
npm install
npx wrangler login
```

Edit `wrangler.toml` and set `bucket_name` to your bucket, then deploy:

```powershell
npm run deploy
```

## Objects the desktop app creates

```text
recordings/<slug>/video.mp4
recordings/<slug>/thumb.jpg
recordings/<slug>/meta.json
recordings/index.json
```

## Routes

- `/r/<slug>` renders a recording page, increments its view count, and streams the video from your R2 bucket.
- `/r/test` is the connection check used by the desktop app.
- `/api/unlock/<slug>` verifies the password for password-protected recordings.
- `/files/...` streams media (video, thumbnail, logo) from your private bucket with byte-range support.

## Password-protected recordings

Passwords are hashed with PBKDF2-SHA256 at 100,000 iterations (the Cloudflare Workers limit). The desktop app in this cloudflare-version has been updated to match, so password-protected recordings verify correctly on Workers.

## Custom domain

In the Cloudflare dashboard, open your Worker, choose **Triggers > Custom Domains**, and add your domain. Then paste the custom domain into ScreenVault Pro. The Worker and your R2 bucket remain yours if you stop using ScreenVault Pro.

## Troubleshooting

- **Test page shows a configuration error:** make sure `bucket_name` in `wrangler.toml` matches your bucket and that you redeployed after changing it.
- **A recording is a 404:** confirm the desktop app successfully uploaded `meta.json` to the same bucket.
- **Views do not change:** the Worker's R2 binding needs read **and** write access, because it writes the incremented `meta.json`.
- **Video will not play:** check that the bucket is bound to the Worker. No public access is required.

Your files never pass through a ScreenVault server. The Worker reads directly from your R2 bucket through its binding.
