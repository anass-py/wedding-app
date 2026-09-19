import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type { Message, Photo } from "../lib/types";

interface Props {
  photos?: Photo[];
  message?: Message;
  urlFor: (path: string) => string;
  onDone: () => void;
}

const HOLD_MS = 2300;
const OUT_MS = 550;

/** Full-screen "Posted!" moment: photo springs in, sparks burst, then it flies to the wall. */
export function Celebration({ photos = [], message, urlFor, onDone }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const a = window.setTimeout(() => setPhase("out"), HOLD_MS);
    const b = window.setTimeout(onDone, HOLD_MS + OUT_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [onDone]);

  const sparks = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        angle: (i / 28) * 360 + (Math.random() - 0.5) * 18,
        dist: 130 + Math.random() * 150,
        size: 4 + Math.random() * 7,
        delay: Math.random() * 0.25,
        kind: i % 3,
      })),
    [],
  );

  const skip = () => {
    if (phase === "out") return;
    setPhase("out");
    window.setTimeout(onDone, OUT_MS);
  };

  const hero = photos[0];
  const portrait = hero?.width && hero?.height ? hero.height >= hero.width : true;

  return (
    <div className={`celebrate celebrate--${phase}`} onClick={skip} role="status">
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
        {message ? (
          <div className="celebrate__photo celebrate__note">
            <span className="note__quote" aria-hidden="true">
              “
            </span>
            <p className="note__text">{message.text}</p>
          </div>
        ) : (
          <div className={"celebrate__photo" + (portrait ? "" : " celebrate__photo--wide")}>
            <img src={urlFor(hero.thumb_path)} alt="" draggable={false} />
            {photos.length > 1 && <span className="celebrate__count">+{photos.length - 1}</span>}
          </div>
        )}
      </div>
      <h2 className="celebrate__title">{message ? t("messageSent") : t("posted")}</h2>
      <p className="celebrate__sub">{message ? t("messageCelebrate") : photos.length > 1 ? t("celebrateMany", { n: photos.length }) : t("celebrateOne")}</p>
    </div>
  );
}
