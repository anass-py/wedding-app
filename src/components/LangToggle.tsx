import { useI18n } from "../i18n";

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button className="langtoggle" onClick={() => setLang(lang === "en" ? "fr" : "en")} aria-label="Language">
      <span className={lang === "en" ? "on" : ""}>EN</span>
      <span className="sep">/</span>
      <span className={lang === "fr" ? "on" : ""}>FR</span>
    </button>
  );
}
