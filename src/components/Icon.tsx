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
  pause: <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" />,
  sound: (
    <>
      <path d="M4 9.5v5h3.5l4.5 3.8V5.7L7.5 9.5z" />
      <path d="M15.5 8.8a4.6 4.6 0 0 1 0 6.4M18.3 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  muted: (
    <>
      <path d="M4 9.5v5h3.5l4.5 3.8V5.7L7.5 9.5z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6.5" width="13" height="11" rx="2" />
      <path d="M16 10.5l5-2.5v8l-5-2.5" />
    </>
  ),
  flip: (
    <>
      <path d="M4 8.5h2.8l1.5-2.5h7.4l1.5 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <path d="M9 13.5a3 3 0 0 0 5.2 2M15 13.5a3 3 0 0 0-5.2-2" />
      <path d="M14.5 15.5h-1.6v-1.6M9.5 11.5h1.6v1.6" />
    </>
  ),
  fit: <path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15M9.5 9.5h5v5h-5z" />,
  fill: <path d="M4.5 9V4.5H9M15 4.5h4.5V9M4.5 15v4.5H9M19.5 15v4.5H15M8 8l3 3M16 8l-3 3M8 16l3-3M16 16l-3-3" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  x: <path d="M4.5 4.5l15 15M19.5 4.5l-15 15" />,
  snapchat: (
    <path d="M12 3.5c-3 0-5 2.2-5 5.2v2.1c-.5.1-1.2 0-1.6-.2-.4.4 0 1 .9 1.3-.3 1.4-1.6 2.9-3.3 3.3.2.8 1.5 1 2.4 1.1.2.6.3 1.2.5 1.2.7 0 1.5-.4 2.4-.2.9.2 1.9 1.5 3.7 1.5s2.8-1.3 3.7-1.5c.9-.2 1.7.2 2.4.2.2 0 .3-.6.5-1.2.9-.1 2.2-.3 2.4-1.1-1.7-.4-3-1.9-3.3-3.3.9-.3 1.3-.9.9-1.3-.4.2-1.1.3-1.6.2V8.7c0-3-2-5.2-5-5.2z" />
  ),
  facebook: <path d="M14.5 8.2H16V4.8h-2.2c-2.5 0-3.9 1.6-3.9 4v1.7H7.8v3.4h2.1v6.3h3.4v-6.3h2.5l.4-3.4h-2.9V9.3c0-.7.4-1.1 1.2-1.1z" />,
  tiktok: <path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3M13.5 3.5c.4 2.6 2.1 4.3 4.7 4.6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5s1.3-6.1 3.9-8.5z" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M5.5 15.5h-1a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14" r="6" />
      <path d="M9.5 8.5L12 4.5l2.5 4M9.5 8.5h5" />
    </>
  ),
  quill: <path d="M4.5 19.5c1-6 4.5-11 10.5-14.5 2-1.1 3.5-1 4.5 0-1.5 1.5-2.5 3.5-3.5 6.5-1.3 3.6-4 5.5-8 5.5M4.5 19.5L12 12" />,
  reel: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M3.5 8.5h17M8 3.5l2.5 5M13 3.5l2.5 5M10.5 12l4 2.5-4 2.5z" />
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
