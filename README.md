# ScreenVault Player

This is the small Vercel project that renders your ScreenVault Pro recording pages. It is designed to be deployed into **your** Vercel account and connected directly to **your** Cloudflare R2 bucket.

## Fastest setup

1. Create a free Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com), open **R2 Object Storage**, and create a bucket. Use a name such as `screenvault-recordings`.
2. In R2, open **Manage R2 API Tokens**, create an API token, and grant `Object Read & Write` for the bucket. Copy the Access Key ID and Secret Access Key immediately; Cloudflare only shows the secret once.
3. In the bucket, open **Settings > Public access** and enable the `r2.dev` public URL for development, or connect your own domain. Copy the complete public URL, for example `https://pub-xxxx.r2.dev`.
4. Open the `Publishing` tab in ScreenVault Pro and click **Deploy your publishing page**. Vercel will clone this project into your account.
5. When Vercel asks for environment variables, enter the five values below. Do not add quotes or trailing spaces.
6. Click **Deploy**. When the deployment finishes, copy the Vercel URL into ScreenVault Pro's **Your publishing domain** field.
7. Click **Test Page**. You should see `ScreenVault Player is running.`

## Environment variables

| Name | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID from R2 Overview |
| `R2_ACCESS_KEY_ID` | Access Key ID from the R2 API token |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key from the R2 API token |
| `R2_BUCKET_NAME` | Exact bucket name, such as `screenvault-recordings` |
| `R2_PUBLIC_URL` | Public base URL, without a trailing slash |

The app creates these objects when you publish:

```text
recordings/<slug>/video.mp4
recordings/<slug>/thumb.jpg
recordings/<slug>/meta.json
recordings/index.json
```

## Routes

- `/r/<slug>` renders a recording page, increments its view count, and serves the video from your R2 public URL.
- `/r/test` is a connection check used by the desktop app.

## Custom domain

In Vercel, open the project, choose **Settings > Domains**, and add your domain. Follow Vercel's DNS instructions. Then paste the custom domain into ScreenVault Pro. The player project and your R2 bucket remain yours if you stop using ScreenVault Pro.

## Troubleshooting

- **Test page works but a recording is a 404:** check that the deployment has the exact same R2 bucket name and that the desktop app successfully uploaded `meta.json`.
- **AccessDenied or video will not play:** enable public access on the R2 bucket or use a public custom domain. The player needs to be able to request the MP4 from a browser.
- **Invalid credentials:** create a new R2 API token with Object Read & Write access scoped to the correct bucket and replace the Vercel environment values. Redeploy after changing variables.
- **Views do not change:** the Vercel deployment needs write access, not read-only access, because it writes the incremented `meta.json`.

Your files never pass through a ScreenVault server. The player talks directly to your R2 bucket using the credentials stored privately in your Vercel project.
