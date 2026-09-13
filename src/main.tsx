import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { applyTheme, getTheme } from "./lib/theme";
import { TvWall } from "./components/TvWall";
import { I18nProvider } from "./i18n";
import "./styles.css";

registerSW({ immediate: true });

applyTheme(getTheme());

const isTv = location.pathname.replace(/\/$/, "") === "/tv" || new URLSearchParams(location.search).has("tv");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>{isTv ? <TvWall /> : <App />}</I18nProvider>
  </StrictMode>,
);
