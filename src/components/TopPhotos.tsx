import { useMemo, useState } from "react";
import { THEMES, type Theme } from "../config";
import { useI18n } from "../i18n";
import { finalScore, topPhotos } from "../lib/ranking";
import type { Api, Photo } from "../lib/types";
import { Avatar } from "./Avatar";

interface Props {
  photos: Photo[];
  api: Api;
  onSelect: (photo: Photo) => void;
}

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
        <p className="top__empty muted">{t("topEmpty")}</p>
      ) : (
        <>
          <TopCard photo={first} rank={1} api={api} onSelect={onSelect} big />
          <div className="top__grid">
            {rest.map((p, i) => (
              <TopCard key={p.id} photo={p} rank={i + 2} api={api} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TopCard({
  photo,
  rank,
  api,
  onSelect,
  big,
}: {
  photo: Photo;
  rank: number;
  api: Api;
  onSelect: (p: Photo) => void;
  big?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button className={"topcard" + (big ? " topcard--big" : "")} onClick={() => onSelect(photo)}>
      <img src={api.urlFor(big ? photo.path : photo.thumb_path)} alt="" loading="lazy" draggable={false} />
      <span className="topcard__rank">{rank}</span>
      <span className="topcard__foot">
        <Avatar guest={photo.guest} urlFor={api.urlFor} size={big ? 30 : 24} />
        <span className="topcard__name">{photo.guest.name}</span>
        <span className="topcard__stats">
          ♥ {photo.hearts}
          {photo.score && <span title={t("aiPick")}> · ★ {finalScore(photo).toFixed(1)}</span>}
        </span>
      </span>
      {big && photo.score?.reason && <span className="topcard__reason">{photo.score.reason}</span>}
    </button>
  );
}
