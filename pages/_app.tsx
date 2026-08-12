import type { AppProps } from "next/app";
import "../styles/player.global.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
