import { JOIN_NETWORKS, SOCIAL_META, type SocialKey } from "../lib/socials";
import { Icon } from "./Icon";

interface Props {
  value: SocialKey | null;
  onChange: (key: SocialKey) => void;
}

/** Floating, bobbing network icons; the chosen one glows in its brand colour. */
export function SocialPicker({ value, onChange }: Props) {
  return (
    <div className="socialpick" role="radiogroup">
      {JOIN_NETWORKS.map((k, i) => {
        const meta = SOCIAL_META[k];
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={meta.label}
            className={"socialpick__btn" + (on ? " socialpick__btn--on" : "")}
            style={{ ["--brand" as string]: meta.color, ["--i" as string]: i }}
            onClick={() => onChange(k)}
          >
            <span className="socialpick__icon">
              <Icon name={meta.icon} size={30} strokeWidth={1.6} fill={k === "snapchat" || k === "facebook"} />
            </span>
            <span className="socialpick__label">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
