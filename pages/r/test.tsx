import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { checkConnection, missingEnvironment } from "../../lib/r2";

type TestProps = { ok: boolean; error?: string };

export const getServerSideProps: GetServerSideProps<TestProps> = async () => {
  const missing = missingEnvironment();
  if (missing.length) return { props: { ok: false, error: `Missing environment variables: ${missing.join(", ")}` } };
  try {
    await checkConnection();
    return { props: { ok: true } };
  } catch (error) {
    console.error("R2 connection check failed", error);
    return { props: { ok: false, error: "R2 credentials or bucket configuration could not be verified." } };
  }
};

export default function TestPage({ ok, error }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <main style={{ fontFamily: "system-ui", padding: "4rem", color: "#20202a" }}>{ok ? "ScreenVault Player is running." : `ScreenVault Player configuration error: ${error}`}</main>;
}
