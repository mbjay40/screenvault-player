import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import { getMeta, incrementViews, objectUrl, type RecordingMeta } from "../../lib/r2";
import styles from "../../styles/player.module.css";

export const getServerSideProps: GetServerSideProps<{ meta: RecordingMeta }> = async ({ params, res }) => {
  const slug = typeof params?.slug === "string" ? params.slug : "";
  if (!slug || slug === "test") return { notFound: true };
  const meta = await getMeta(slug);
  if (!meta) return { notFound: true };
  const updated = await incrementViews(meta);
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return { props: { meta: updated } };
};

export default function RecordingPage({ meta }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const title = meta.title || "ScreenVault recording";
  return <><Head><title>{title} - ScreenVault</title><meta name="description" content={meta.description || title} /></Head><main className={styles.page}><div className={styles.topline}><a href="/" className={styles.wordmark}><span>S</span> ScreenVault</a><span className={styles.privateLabel}>Recording</span></div><section className={styles.content}><div className={styles.videoFrame}><video controls preload="metadata" src={objectUrl(meta.video_key)} poster={meta.thumb_key ? objectUrl(meta.thumb_key) : undefined} /></div><div className={styles.details}><p className={styles.kicker}>ScreenVault recording</p><h1>{title}</h1>{meta.description && <p className={styles.description}>{meta.description}</p>}{meta.cta_text && meta.cta_url && <a className={styles.cta} href={meta.cta_url} target="_blank" rel="noreferrer">{meta.cta_text}<span>↗</span></a>}<div className={styles.meta}><span>{new Date(meta.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span><i /> <span>{meta.views.toLocaleString()} views</span></div></div></section><footer className={styles.footer}><span>Made with <b>ScreenVault</b></span><a href="https://miniappsfactory.store/screenvault-pro">Create your own</a></footer></main></>;
}
