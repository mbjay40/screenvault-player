import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import type { CSSProperties } from "react";
import { getMeta, incrementViews, objectUrl, type RecordingMeta } from "../../lib/r2";
import styles from "../../styles/player.module.css";
import overrides from "../../styles/player.overrides.module.css";

const DEFAULT_BG_COLOR = "#ffffff";
const DEFAULT_BUTTON_COLOR = "#1a1a2e";

type RecordingPageProps =
  | { meta: RecordingMeta; videoUrl: string; thumbUrl: string | null; logoUrl: string | null }
  | { error: string };

function hexColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function buttonTextColor(color: string): string {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const luminance = channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114;
  if (luminance > 0.7) return "#1a1a2e";
  if (luminance < 0.3) return "#ffffff";
  return "#ffffff";
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function pageTextColors(background: string): { primary: string; muted: string } {
  const dark = "#191821";
  const light = "#ffffff";
  return contrastRatio(background, dark) >= contrastRatio(background, light)
    ? { primary: dark, muted: dark }
    : { primary: light, muted: light };
}

export const getServerSideProps: GetServerSideProps<RecordingPageProps> = async ({ params, res }) => {
  const slug = typeof params?.slug === "string" ? params.slug : "";
  if (!slug || slug === "test") return { notFound: true };
  try {
    const meta = await getMeta(slug);
    if (!meta) return { notFound: true };
    const updated = await incrementViews(meta);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return {
      props: {
        meta: updated,
        videoUrl: objectUrl(updated.video_key),
        thumbUrl: updated.thumb_key ? objectUrl(updated.thumb_key) : null,
        logoUrl: updated.custom_logo_key ? objectUrl(updated.custom_logo_key) : null,
      },
    };
  } catch (error) {
    console.error("Recording page configuration error", error);
    return { props: { error: "This publishing page is not configured. Add all five R2 environment variables in Vercel, then redeploy." } };
  }
};

export default function RecordingPage(props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  if ("error" in props) {
    return <main className={`${styles.page} ${overrides.page}`}><section className={styles.content}><div className={`${styles.details} ${overrides.details}`}><h1 className={overrides.title}>Publishing page setup required</h1><p className={`${styles.description} ${overrides.description}`}>{props.error}</p></div></section></main>;
  }
  const { meta, videoUrl, thumbUrl, logoUrl } = props;
  const title = meta.title || "ScreenVault recording";
  const bgColor = hexColor(meta.bg_color, DEFAULT_BG_COLOR);
  const buttonColor = hexColor(meta.button_color, DEFAULT_BUTTON_COLOR);
  const videoSize = ["s", "m", "l"].includes(meta.video_size || "") ? meta.video_size || "m" : "m";
  const buttonText = buttonTextColor(buttonColor);
  const pageText = pageTextColors(bgColor);
  const date = new Date(meta.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const theme = { "--bg-color": bgColor, "--button-color": buttonColor, "--button-text-color": buttonText, "--text-color": pageText.primary, "--muted-text-color": pageText.muted } as CSSProperties;
  return <><Head><title>{title} - ScreenVault</title><meta name="description" content={meta.description || title} /></Head><main className={`${styles.page} ${overrides.page}`} style={theme}><div className={styles.topline}>{logoUrl && <img className={styles.logo} src={logoUrl} alt="" />}</div><section className={styles.content}><div className={`${styles.videoFrame} ${styles[`size-${videoSize}`]} ${overrides.video}`}><video controls preload="metadata" src={videoUrl} poster={thumbUrl || undefined} /></div><div className={`${styles.details} ${overrides.details}`}><h1 className={overrides.title}>{title}</h1>{meta.description && <p className={`${styles.description} ${overrides.description}`}>{meta.description}</p>}<div className={`${styles.meta} ${overrides.pageText}`}><span>{Number(meta.views || 0).toLocaleString()} views</span><i aria-hidden="true">·</i><span>{date}</span></div>{meta.cta_text && meta.cta_url && <a className={styles.cta} href={meta.cta_url} target="_blank" rel="noreferrer">{meta.cta_text}<span>↗</span></a>}</div></section><footer className={`${styles.footer} ${overrides.pageText}`}><span>Made with <b>ScreenVault</b></span><a href="https://miniappsfactory.store/screenvault-pro">Create your own</a></footer></main></>;
}
