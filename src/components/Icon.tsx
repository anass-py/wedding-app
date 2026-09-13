import type { ReactNode } from "react";

/** Consistent 24px stroke icons so the UI looks the same on iPhone and Android. */
const paths: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
    </>
  ),
  bubbles: (
    <>
      <circle cx="12" cy="7" r="3.2" />
      <circle cx="6.5" cy="16" r="3.2" />
      <circle cx="17.5" cy="16" r="3.2" />
    </>
  ),
  star: <path d="M12 3.4l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.7l6-.8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  heart: (
    <path d="M12 20.3S3.6 15.3 2.6 10.2C1.9 6.8 4.3 4.2 7.2 4.2c2 0 3.5 1.2 4.8 3 1.3-1.8 2.8-3 4.8-3 2.9 0 5.3 2.6 4.6 6-1 5.1-9.4 10.1-9.4 10.1z" />
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  share: <path d="M12 3.5v11M8.5 7L12 3.5 15.5 7M5 13.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-5.5" />,
  download: <path d="M12 3.5v11M8.5 11L12 14.5 15.5 11M5 19.5h14" />,
  camera: (
    <>
      <path d="M4 8.5h2.8l1.5-2.5h7.4l1.5 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.3" r="3.3" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M20.5 15.5l-4.5-4.5-7 7" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5" />,
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" />,
  video: (
    <>
      <rect x="3" y="6.5" width="13" height="11" rx="2" />
      <path d="M16 10.5l5-2.5v8l-5-2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" />
    </>
  ),
};

interface Props {
  name: keyof typeof paths;
  size?: number;
  /** Fill with currentColor (used for the active heart/star). */
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 22, fill = false, strokeWidth = 1.7, className }: Props) {
  return (
    <svg
      className={"icon" + (className ? ` ${className}` : "")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
