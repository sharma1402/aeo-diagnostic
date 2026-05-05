import type { AppProps } from "next/app";
// @ts-ignore: CSS module types not declared in this project setup
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}