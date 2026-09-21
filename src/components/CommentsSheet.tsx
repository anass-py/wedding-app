import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { describeError } from "../lib/errors";
import type { Api, Trend, TrendComment } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { relativeTime } from "./PhotoDetail";
import { RoleBadge } from "./RoleBadge";

interface Props {
  trend: Trend;
  api: Api;
  meId: string | null;
  onClose: () => void;
  onCount: (delta: number) => void;
  onToast: (msg: string) => void;
}

/** Bottom sheet with a trend's comments, live. */
export function CommentsSheet({ trend, api, meId, onClose, onCount, onToast }: Props) {
  const { t } = useI18n();
  const [list, setList] = useState<TrendComment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api
      .listTrendComments(trend.id)
      .then((c) => live && setList(c))
      .catch((e: unknown) => onToast(describeError(e)));
    const unsubscribe = api.subscribe({
      onPhotoInsert: () => undefined,
      onPhotoDelete: () => undefined,
      onHeart: () => undefined,
      onScore: () => undefined,
      onTrendComment: (c) => {
        if (c.trend_id !== trend.id) return;
        setList((prev) => (prev && !prev.some((x) => x.id === c.id) ? [...prev, c] : prev));
      },
      onTrendCommentDelete: (_trendId, id) => setList((prev) => prev?.filter((c) => c.id !== id) ?? prev),
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [api, trend.id, onToast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [list?.length]);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const c = await api.postTrendComment(trend.id, text);
      setList((prev) => (prev ? [...prev, c] : [c]));
      setText("");
      onCount(1);
    } catch (e) {
      onToast(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: TrendComment) => {
    setList((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
    onCount(-1);
    try {
      await api.deleteTrendComment(c.id);
    } catch (e) {
      onToast(describeError(e));
    }
  };

  return (
    <div className="sheet-backdrop sheet-backdrop--comments" onClick={onClose}>
      <div className="sheet comments" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <p className="comments__title">
          {t("comments")} <span className="muted">· {list?.length ?? trend.comments}</span>
        </p>
        <div className="comments__list">
          {list === null && <p className="muted small">…</p>}
          {list?.length === 0 && <p className="muted small">{t("noComments")}</p>}
          {list?.map((c) => (
            <div key={c.id} className="comment">
              <Avatar guest={c.guest} urlFor={api.urlFor} size={30} />
              <div className="comment__body">
                <div className="comment__head">
                  <span className="comment__name">
                    {c.guest.name}
                    <RoleBadge name={c.guest.name} size={11} />
                  </span>
                  <span className="muted small">{relativeTime(c.created_at, t)}</span>
                  {meId === c.guest_id && (
                    <button className="comment__delete" onClick={() => remove(c)} aria-label={t("delete")}>
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
                <p className="comment__text">{c.text}</p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="comments__compose">
          <input
            className="input"
            value={text}
            placeholder={t("commentPlaceholder")}
            maxLength={300}
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
          />
          <button className="fab fab--small" onClick={send} disabled={!text.trim() || busy} aria-label={t("send")}>
            <Icon name="send" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
