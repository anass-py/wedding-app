import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { WEDDING } from "./config";
import { TvWall } from "./components/TvWall";
import { I18nProvider } from "./i18n";
import "./styles.css";

registerSW({ immediate: true });

document.documentElement.dataset.theme = WEDDING.theme;
document.querySelector('meta[name="theme-color"]')?.setAttribute("content", WEDDING.theme === "ivory" ? "#f6f1e8" : "#100e0c");

const isTv = location.pathname.replace(/\/$/, "") === "/tv" || new URLSearchParams(location.search).has("tv");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>{isTv ? <TvWall /> : <App />}</I18nProvider>
  </StrictMode>,
);
