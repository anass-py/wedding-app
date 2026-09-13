import { useMemo, useState } from "react";
import { THEMES, type Theme } from "../config";
import { useI18n } from "../i18n";
import { finalScore, topPhotos } from "../lib/ranking";
import type { Api, Photo } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface Props {
  photos: Photo[];
  api: Api;
  onSelect: (photo: Photo) => void;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function TopPhotos({ photos, api, onSelect }: Props) {
  const { t, themeName } = useI18n();
  const [theme, setTheme] = useState<Theme | "all">("all");

  // Only offer themes that have at least one scored photo.
  const themesWithPhotos = useMemo(
    () => THEMES.filter((th) => photos.some((p) => p.score?.theme === th)),
    [photos],
  );
  const ranked = useMemo(() => topPhotos(photos, theme), [photos, theme]);
  const [first, ...rest] = ranked;

  return (
    <div className="top">
      <header className="top__head">
        <p className="eyebrow">{t("topEyebrow")}</p>
        <h2 className="top__title">
          {t("top")}
          <span className="top__theme"> · {theme === "all" ? t("allThemes") : themeName(theme)}</span>
        </h2>
        <p className="top__sub">{t("topSub")}</p>
      </header>

      <div className="chips chips--scroll">
        <button className={"chip chip--btn" + (theme === "all" ? " chip--active" : "")} onClick={() => setTheme("all")}>
          {t("allThemes")}
        </button>
        {themesWithPhotos.map((th) => (
          <button
            key={th}
            className={"chip chip--btn" + (theme === th ? " chip--active" : "")}
            onClick={() => setTheme(th)}
          >
            {themeName(th)}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <div className="top__empty">
          <div className="ornament">
            <span>✦</span>
          </div>
          <p className="muted">{t("topEmpty")}</p>
        </div>
      ) : (
        <>
          <button className="hero" onClick={() => onSelect(first)}>
            <span className="hero__frame">
              <img src={api.urlFor(first.path)} alt="" draggable={false} />
              <span className="hero__numeral">{ROMAN[0]}</span>
            </span>
            <span className="hero__meta">
              <Avatar guest={first.guest} urlFor={api.urlFor} size={34} />
              <span className="hero__name">{first.guest.name}</span>
              <Stats photo={first} />
            </span>
            {first.score?.reason && <span className="hero__reason">{first.score.reason}</span>}
          </button>

          {rest.length > 0 && (
            <>
              <div className="ornament">
                <span>✦</span>
              </div>
              <ol className="ranklist">
                {rest.map((p, i) => (
                  <li key={p.id}>
                    <button className="rankrow" onClick={() => onSelect(p)}>
                      <span className="rankrow__numeral">{ROMAN[i + 1]}</span>
                      <span className="rankrow__thumb">
                        <img src={api.urlFor(p.thumb_path)} alt="" loading="lazy" draggable={false} />
                      </span>
                      <span className="rankrow__body">
                        <span className="rankrow__name">{p.guest.name}</span>
                        <Stats photo={p} />
                        {p.score?.reason && <span className="rankrow__reason">{p.score.reason}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stats({ photo }: { photo: Photo }) {
  return (
    <span className="stats">
      <span>
        <Icon name="heart" size={13} fill /> {photo.hearts}
      </span>
      {photo.score && (
        <span>
          <Icon name="star" size={13} fill strokeWidth={0} /> {finalScore(photo).toFixed(1)}
        </span>
      )}
    </span>
  );
}
