import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type RecordingMeta = {
  slug: string;
  title: string;
  description?: string;
  cta_text?: string;
  cta_url?: string;
  video_size?: "s" | "m" | "l";
  bg_color?: string;
  button_color?: string;
  custom_logo_key?: string;
  video_key: string;
  thumb_key?: string;
  created_at: string;
  views: number;
};

export function objectUrl(key: string): string { return `${required("R2_PUBLIC_URL").replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`; }

export function missingEnvironment(): string[] {
  return ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
    .filter((name) => !process.env[name]?.trim());
}

export async function getMeta(slug: string): Promise<RecordingMeta | null> {
  try {
    const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: `recordings/${slug}/meta.json` }));
    if (!result.Body) return null;
    return JSON.parse(await result.Body.transformToString()) as RecordingMeta;
  } catch (error: unknown) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function incrementViews(meta: RecordingMeta): Promise<RecordingMeta> {
  const updated = { ...meta, views: Math.max(0, Number(meta.views) || 0) + 1 };
  await client().send(new PutObjectCommand({ Bucket: bucket(), Key: `recordings/${meta.slug}/meta.json`, Body: JSON.stringify(updated, null, 2), ContentType: "application/json", CacheControl: "no-store" }));
  return updated;
}

export async function deleteRecording(slug: string): Promise<void> {
  await Promise.all(["video.mp4", "meta.json", "thumb.jpg"].map((name) => client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: `recordings/${slug}/${name}` }))));
}

export async function checkConnection(): Promise<void> { await client().send(new HeadBucketCommand({ Bucket: bucket() })); }
export function bucket(): string { return required("R2_BUCKET_NAME"); }

function client(): S3Client {
  const accountId = required("R2_ACCOUNT_ID");
  return new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") } });
}

function required(name: string): string { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
function isMissing(error: unknown): boolean { const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }; return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404; }
