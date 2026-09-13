import { useEffect, useMemo } from "react";
import { useI18n } from "../i18n";

/** Short "Welcome, Name" moment right after joining. */
export function Welcome({ name, onDone }: { name: string; onDone: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const id = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(id);
  }, [onDone]);
  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        angle: (i / 18) * 360 + (Math.random() - 0.5) * 20,
        dist: 90 + Math.random() * 110,
        size: 3 + Math.random() * 6,
        delay: 0.15 + Math.random() * 0.25,
        kind: i % 3,
      })),
    [],
  );
  return (
    <div className="celebrate welcome" onClick={onDone} role="status">
      <div className="celebrate__stage">
        <div className="celebrate__burst" aria-hidden="true">
          {sparks.map((s, i) => (
            <span
              key={i}
              className={`spark spark--${s.kind}`}
              style={{
                ["--a" as string]: `${s.angle}deg`,
                ["--d" as string]: `${s.dist}px`,
                ["--s" as string]: `${s.size}px`,
                ["--delay" as string]: `${s.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="welcome__mark">✦</div>
      </div>
      <h2 className="celebrate__title welcome__title">{t("welcomeName", { name })}</h2>
      <p className="celebrate__sub">{t("welcomeSub")}</p>
    </div>
  );
}
