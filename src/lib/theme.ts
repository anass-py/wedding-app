import { WEDDING } from "../config";

export type ThemeName = "midnight" | "ivory";
const KEY = "wedding.theme";

export function getTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "midnight" || saved === "ivory") return saved;
  } catch {
    /* private mode */
  }
  return WEDDING.theme;
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "ivory" ? "#f6f1e8" : "#100e0c");
}

export function setTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}
