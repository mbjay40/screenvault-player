export interface Env {
  BUCKET: R2Bucket;
}

type VideoSize = "s" | "m" | "l";

type RecordingMeta = {
  slug: string;
  title: string;
  description?: string;
  cta_text?: string;
  cta_url?: string;
  video_size?: VideoSize;
  bg_color?: string;
  button_color?: string;
  custom_logo_key?: string;
  video_key: string;
  thumb_key?: string;
  created_at: string;
  views: number;
  published?: boolean;
  password_hash?: string;
  pixels?: { meta?: string; google?: string; linkedin?: string; tiktok?: string };
};

const DEFAULT_BG_COLOR = "#ffffff";
const DEFAULT_BUTTON_COLOR = "#1a1a2e";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] as string);
}

function hexColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function buttonTextColor(color: string): string {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const luminance = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114;
  if (luminance > 0.7) return "#1a1a2e";
  if (luminance < 0.3) return "#ffffff";
  return "#ffffff";
}

function pageTextColors(background: string): { primary: string; muted: string } {
  const dark = "#191821";
  const light = "#ffffff";
  return contrastRatio(background, dark) >= contrastRatio(background, light)
    ? { primary: dark, muted: dark }
    : { primary: light, muted: light };
}

function normalizeCtaUrl(value: string | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const candidate = raw.startsWith("//")
    ? `https:${raw}`
    : /^[a-z][a-z0-9+.-]*:/i.test(raw)
      ? raw
      : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return parsed.hostname && (parsed.protocol === "http:" || parsed.protocol === "https:")
      ? candidate
      : null;
  } catch {
    return null;
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatViews(views: number): string {
  return (Math.max(0, Number(views) || 0)).toLocaleString("en-US");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function verifyPassword(value: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, saltHex, digestHex] = String(encoded || "").split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltHex || !digestHex) return false;
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations < 1 || iterations > 100000) return false;
  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(digestHex);
  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(value),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial,
      expected.length * 8
    );
    return timingSafeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

async function getMeta(env: Env, slug: string): Promise<RecordingMeta | null> {
  try {
    const object = await env.BUCKET.get(`recordings/${slug}/meta.json`);
    if (!object) return null;
    return (await object.json()) as RecordingMeta;
  } catch {
    return null;
  }
}

async function incrementViews(env: Env, meta: RecordingMeta): Promise<RecordingMeta> {
  const updated = { ...meta, views: Math.max(0, Number(meta.views) || 0) + 1 };
  await env.BUCKET.put(
    `recordings/${meta.slug}/meta.json`,
    JSON.stringify(updated, null, 2),
    { httpMetadata: { contentType: "application/json" }, customMetadata: { "cache-control": "no-store" } }
  );
  return updated;
}

function mediaPath(key: string): string {
  return "/files/" + key.split("/").map(encodeURIComponent).join("/");
}

const CSS = `
:root{--bg-color:#fff;--button-color:#1a1a2e;--button-text-color:#fff;--text-color:#191821;--muted-text-color:#514d5d}
*{box-sizing:border-box}
html,body{margin:0}
.page{min-height:100vh;background:var(--bg-color);color:var(--text-color);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:26px clamp(22px,5vw,76px);display:flex;flex-direction:column}
.topline{display:flex;align-items:center;max-width:1120px;width:100%;min-height:48px;margin:0 auto}
.logo{display:block;max-width:180px;max-height:48px;width:auto;height:auto;object-fit:contain;object-position:left center}
.content{max-width:1120px;width:100%;margin:auto;padding:70px 0 75px}
.videoFrame{width:100%;background:#17161e;border-radius:16px;padding:9px;box-shadow:0 25px 70px rgba(32,29,47,.16);margin-left:0;margin-right:0}
.videoFrame video{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#0e0e13;border-radius:10px}
.size-s{max-width:600px;margin:0 auto}
.size-m{max-width:860px;margin:0 auto}
.size-l{max-width:100%}
.details{max-width:none;padding:42px 10px}
.details h1{font-size:clamp(24px,2vw,40px);line-height:1.03;letter-spacing:-.065em;margin:0;max-width:none}
.description{font-size:16px;line-height:1.65;color:var(--muted-text-color);max-width:none;margin:22px 0;white-space:pre-wrap}
.cta{display:inline-flex;align-items:center;gap:26px;padding:13px 17px;border-radius:8px;background:var(--button-color);color:var(--button-text-color);text-decoration:none;font-size:13px;font-weight:700;margin-top:10px;box-shadow:0 10px 25px rgba(104,89,232,.2)}
.cta span{font-size:16px;font-weight:400}
.meta{display:flex;gap:12px;align-items:center;color:var(--muted-text-color);font-size:11px;margin-top:28px}
.meta i{font-style:normal;color:#bbb8c1}
.footer{border-top:1px solid #e5e4e9;max-width:1120px;width:100%;margin:0 auto;padding-top:18px;display:flex;justify-content:space-between;color:#aaa7b2;font-size:11px}
.footer a{color:#777386;text-decoration:none}
.footer a:hover{color:#191821}
.pageText,.pageText span,.pageText i,.pageText b,.pageText a{color:var(--text-color)!important}
.pw-form{display:flex;flex-direction:column;gap:12px;max-width:340px;margin-top:26px}
.pw-form input{font-family:inherit;font-size:15px;padding:12px 14px;border:1px solid #d9d7e0;border-radius:8px;background:#fff;color:#191821}
.pw-form button{font-family:inherit;font-size:14px;font-weight:700;padding:12px 14px;border:none;border-radius:8px;background:var(--button-color);color:var(--button-text-color);cursor:pointer}
.pw-error{font-size:13px;color:#c0392b;min-height:18px}
@media (max-width:700px){.content{padding:42px 0 54px}.details{padding:32px 4px}.footer{gap:14px;flex-wrap:wrap}}
`;

function htmlDocument(title: string, body: string, headExtra = ""): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${CSS}</style>${headExtra}</head><body>${body}</body></html>`;
}

function pixelHead(pixels: RecordingMeta["pixels"]): string {
  if (!pixels) return "";
  const parts: string[] = [];
  if (pixels.meta) {
    const id = pixels.meta.replace(/[^0-9]/g, "");
    parts.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`);
  }
  if (pixels.google) {
    const id = encodeURIComponent(pixels.google);
    parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`);
    parts.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${pixels.google.replace(/[^A-Za-z0-9_-]/g, "")}');</script>`);
  }
  if (pixels.linkedin) {
    const id = pixels.linkedin.replace(/[^0-9]/g, "");
    parts.push(`<script>_linkedin_partner_id='${id}';window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);</script>`);
    parts.push(`<script async src="https://snap.licdn.com/li.lms-analytics/insight.min.js"></script>`);
  }
  if (pixels.tiktok) {
    const id = encodeURIComponent(pixels.tiktok);
    parts.push(`<script async src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${id}&lib=ttq"></script>`);
    parts.push(`<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods='page';ttq.load('${pixels.tiktok.replace(/[^A-Za-z0-9_-]/g, "")}');ttq.page()}(window,document,'ttq');</script>`);
  }
  return parts.join("");
}

function renderRecordingPage(meta: RecordingMeta): string {
  const title = meta.title || "ScreenVault recording";
  const bgColor = hexColor(meta.bg_color, DEFAULT_BG_COLOR);
  const buttonColor = hexColor(meta.button_color, DEFAULT_BUTTON_COLOR);
  const videoSize: VideoSize = ["s", "m", "l"].includes(meta.video_size || "") ? (meta.video_size as VideoSize) : "m";
  const buttonText = buttonTextColor(buttonColor);
  const pageText = pageTextColors(bgColor);
  const date = formatDate(meta.created_at);
  const ctaUrl = normalizeCtaUrl(meta.cta_url);
  const theme = `--bg-color:${bgColor};--button-color:${buttonColor};--button-text-color:${buttonText};--text-color:${pageText.primary};--muted-text-color:${pageText.muted}`;

  const headExtra = `<meta name="description" content="${escapeHtml(meta.description || title)}">${pixelHead(meta.pixels)}`;

  const logoUrl = meta.custom_logo_key ? mediaPath(meta.custom_logo_key) : "";
  const videoUrl = mediaPath(meta.video_key);
  const thumbUrl = meta.thumb_key ? mediaPath(meta.thumb_key) : "";

  const ctaHtml = meta.cta_text && ctaUrl
    ? `<a class="cta" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noreferrer">${escapeHtml(meta.cta_text)}<span>→</span></a>`
    : "";

  const body = `<main class="page" style="${theme}"><div class="topline">${logoUrl ? `<img class="logo" src="${logoUrl}" alt="">` : ""}</div><section class="content"><div class="videoFrame size-${videoSize}"><video controls preload="metadata" src="${videoUrl}"${thumbUrl ? ` poster="${thumbUrl}"` : ""}></video></div><div class="details"><h1>${escapeHtml(title)}</h1>${meta.description ? `<p class="description">${escapeHtml(meta.description)}</p>` : ""}<div class="meta pageText"><span>${formatViews(meta.views)} views</span><i aria-hidden="true">·</i><span>${escapeHtml(date)}</span></div>${ctaHtml}</div></section><footer class="footer pageText"><span>Made with <b>ScreenVault</b></span><a href="https://miniappsfactory.store/screenvault-pro">Create your own</a></footer></main>`;

  return htmlDocument(`${title} - ScreenVault`, body, headExtra);
}

function renderPasswordGate(slug: string, title: string): string {
  const body = `<main class="page"><section class="content"><div class="details"><h1>${escapeHtml(title)}</h1><p class="description">This recording is password protected.</p><form class="pw-form" onsubmit="event.preventDefault();const f=event.currentTarget;const d=new FormData(f).get('password');fetch('/api/unlock/${encodeURIComponent(slug)}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:d})}).then(r=>{if(r.ok)window.location.reload();else{document.getElementById('pw-error').textContent='Incorrect password.';}});"><input name="password" type="password" autofocus required placeholder="Password"><button type="submit">Unlock</button><p class="pw-error" id="pw-error"></p></form></div></section></main>`;
  return htmlDocument(`${title} - ScreenVault`, body);
}

function renderErrorPage(detail: string): string {
  const body = `<main class="page"><section class="content"><div class="details"><h1>Publishing page setup required</h1><p class="description">${escapeHtml(detail)}</p></div></section></main>`;
  return htmlDocument("ScreenVault", body);
}

function renderNotFound(): string {
  const body = `<main class="page"><section class="content"><div class="details"><h1>This recording does not exist or has been deleted.</h1><p class="description">Check the link and try again.</p></div></section></main>`;
  return htmlDocument("ScreenVault", body);
}

function htmlResponse(html: string, status = 200, headers: Record<string, string> = {}): Response {
  const extra: Record<string, string> = { ...headers };
  if (status === 200) {
    extra["Cache-Control"] = "no-store, max-age=0";
  }
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      ...extra,
    },
  });
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function handleTest(env: Env): Promise<Response> {
  if (!env.BUCKET) {
    return htmlResponse(renderErrorPage("ScreenVault Player configuration error: Missing R2 bucket binding."), 200);
  }
  try {
    await env.BUCKET.list({ limit: 1 });
    return htmlResponse("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>ScreenVault Player</title></head><body style=\"font-family:system-ui;padding:4rem;color:#20202a\">ScreenVault Player is running.</body></html>");
  } catch (error) {
    console.error("R2 connection check failed", error);
    return htmlResponse(renderErrorPage("ScreenVault Player configuration error: R2 bucket could not be reached. Bind the Worker to your R2 bucket and redeploy."), 200);
  }
}

async function handleRecording(env: Env, request: Request, slug: string): Promise<Response> {
  try {
    const meta = await getMeta(env, slug);
    if (!meta || meta.published === false) return htmlResponse(renderNotFound(), 404);

    const accessCookie = `screenvault_access_${slug}`;
    const cookieHeader = request.headers.get("Cookie") || "";
    const hasAccess = !meta.password_hash || cookieHeader.includes(`${accessCookie}=`);

    if (meta.password_hash && !hasAccess) {
      return htmlResponse(renderPasswordGate(slug, meta.title || "ScreenVault recording"));
    }

    const updated = await incrementViews(env, meta);
    return htmlResponse(renderRecordingPage(updated));
  } catch (error) {
    console.error("Recording page configuration error", error);
    return htmlResponse(renderErrorPage("This publishing page is not configured. Bind the Worker to your R2 bucket and redeploy."));
  }
}

async function handleUnlock(env: Env, request: Request, slug: string): Promise<Response> {
  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
  const meta = slug ? await getMeta(env, slug) : null;
  if (!meta || meta.published === false) return jsonResponse({ error: "Recording not found" }, 404);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!meta.password_hash || !(await verifyPassword(password, meta.password_hash))) {
    return jsonResponse({ error: "Incorrect password" }, 401);
  }
  const secure = request.url.startsWith("https://") ? "; Secure" : "";
  const cookie = `screenvault_access_${slug}=1; Path=/r/${slug}; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": cookie });
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

async function serveObject(env: Env, request: Request, rawKey: string): Promise<Response> {
  if (!rawKey) return new Response("Not found", { status: 404 });
  const key = rawKey.split("/").map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  }).join("/");

  const head = await env.BUCKET.head(key);
  if (!head) return new Response("Not found", { status: 404 });

  const size = head.size;
  const contentType = head.httpMetadata?.contentType || guessContentType(key);
  const rangeHeader = request.headers.get("Range");

  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  });

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      let start = match[1] === "" ? 0 : parseInt(match[1], 10);
      let end = match[2] === "" ? size - 1 : parseInt(match[2], 10);
      if (match[1] === "" && match[2] !== "") {
        start = Math.max(0, size - parseInt(match[2], 10));
        end = size - 1;
      }
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= size) end = size - 1;
      if (start < 0 || start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const length = end - start + 1;
      const object = await env.BUCKET.get(key, { range: { offset: start, length } });
      if (!object) return new Response("Not found", { status: 404 });
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
      headers.set("Content-Length", String(length));
      return new Response(object.body, { status: 206, headers });
    }
  }

  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  headers.set("Content-Length", String(size));
  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/r/test") return handleTest(env);

    if (path.startsWith("/files/")) return serveObject(env, request, path.slice("/files/".length));

    if (path.startsWith("/api/unlock/")) {
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
      return handleUnlock(env, request, path.slice("/api/unlock/".length));
    }

    if (path.startsWith("/r/")) {
      const slug = path.slice("/r/".length);
      if (slug && slug !== "test") return handleRecording(env, request, slug);
    }

    return htmlResponse(renderNotFound(), 404);
  },
};
