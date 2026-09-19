import { roleOf } from "../config";
import { useI18n } from "../i18n";
import { Icon } from "./Icon";

/** A small gold ring next to the bride's and groom's names. */
export function RoleBadge({ name, size = 14 }: { name: string; size?: number }) {
  const { t } = useI18n();
  const role = roleOf(name);
  if (role === "guest") return null;
  return (
    <span className="rolebadge" title={t(role)} aria-label={t(role)}>
      <Icon name="ring" size={size} strokeWidth={1.8} />
    </span>
  );
}
