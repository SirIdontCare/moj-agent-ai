import type { SVGProps } from "react";

export type PictogramName =
  | "alert" | "bot" | "book" | "briefcase" | "calculator" | "calendar"
  | "camera" | "chart" | "check" | "chevron-down" | "chevron-up" | "clipboard"
  | "clock" | "cloud-sun" | "coins" | "copy" | "download" | "eye" | "file"
  | "folder" | "globe" | "graduation" | "hand" | "history" | "image" | "inbox"
  | "info" | "leaf" | "mail" | "menu" | "message" | "moon" | "mouse"
  | "newspaper" | "notebook" | "paperclip" | "pencil" | "plane" | "refresh"
  | "ruler" | "save" | "search" | "shield" | "sparkles" | "sun" | "timer"
  | "trash" | "upload" | "users" | "utensils" | "wallet" | "wrench" | "x"
  | "zap" | "brain" | "building";

type PictogramProps = SVGProps<SVGSVGElement> & { name: PictogramName };

export default function Pictogram({ name, ...props }: PictogramProps) {
  const common = {
    "aria-hidden": props["aria-label"] ? undefined : true,
    fill: "none",
    height: 20,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 20,
  };

  const shapes: Record<PictogramName, React.ReactNode> = {
    alert: <><path d="M10.3 3.6 2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 7h16"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    calculator: <><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    camera: <><path d="M14.5 5 13 3h-2L9.5 5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"/><circle cx="12" cy="12.5" r="3.5"/></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8.5"/></>,
    "chevron-down": <path d="m7 9 5 5 5-5"/>,
    "chevron-up": <path d="m7 15 5-5 5 5"/>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    "cloud-sun": <><path d="M8 6.5a4 4 0 1 1 7.3 2.2M15 4V2M19.2 5.8l1.4-1.4"/><path d="M17.5 20H6a4 4 0 1 1 1.1-7.8A5.5 5.5 0 0 1 17.5 20Z"/></>,
    coins: <><ellipse cx="8" cy="6" rx="5" ry="3"/><path d="M3 6v4c0 1.7 2.2 3 5 3M13 6v3"/><ellipse cx="16" cy="15" rx="5" ry="3"/><path d="M11 15v3c0 1.7 2.2 3 5 3s5-1.3 5-3v-3"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 20h16"/></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    file: <><path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
    folder: <><path d="M3 6h7l2 2h9v11H3Z"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></>,
    graduation: <><path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9v6"/></>,
    hand: <><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v5c0 5-3 8-8 8H9c-3 0-5-2-6-4l-1-2a1.6 1.6 0 0 1 2.8-1.6L7 16"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    inbox: <><path d="M4 4h16l2 12H16l-2 3h-4l-2-3H2Z"/><path d="M2 16h6M16 16h6"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    leaf: <><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z"/><path d="M4 21c2-5 6-9 12-12"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    message: <><path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a8 8 0 1 1 18-5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    mouse: <><rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 2v6"/></>,
    newspaper: <><path d="M4 4h14v16H4Z"/><path d="M18 8h2v12h-2M7 8h4v4H7ZM13 8h2M13 12h2M7 15h8M7 18h8"/></>,
    notebook: <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M8 3v18M3 7h4M3 12h4M3 17h4M12 8h4M12 12h4"/></>,
    paperclip: <path d="m20.5 11.5-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>,
    pencil: <><path d="m4 16-1 5 5-1L19 9l-4-4Z"/><path d="m13.5 6.5 4 4"/></>,
    plane: <><path d="M22 2 9 15M22 2l-6 20-4-8-8-4Z"/></>,
    refresh: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5"/></>,
    ruler: <><path d="m4 17 13-13 3 3L7 20H4Z"/><path d="m13 8 3 3M10 11l2 2M7 14l3 3"/></>,
    save: <><path d="M5 3h12l3 3v15H4V4Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    shield: <><path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5Z"/><path d="m9 12 2 2 4-5"/></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8ZM19 14l.7 1.8 1.8.7-1.8.7L19 19l-.7-1.8-1.8-.7 1.8-.7Z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 5V2"/></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8ZM7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 20h16"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/></>,
    utensils: <><path d="M7 2v7a3 3 0 0 1-3 3V2M4 12v10M10 2v20M16 2v8a3 3 0 0 0 3 3h1V2M20 13v9"/></>,
    wallet: <><path d="M4 5h14a2 2 0 0 1 2 2v12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12"/><path d="M15 10h7v5h-7a2.5 2.5 0 0 1 0-5Z"/></>,
    wrench: <path d="M14.5 6.5a4 4 0 0 0-5-5L12 4l-3 3-2.5-2.5a4 4 0 0 0 5 5L4 17l3 3 7.5-7.5a4 4 0 0 0 5-5L17 10l-3-3Z"/>,
    x: <path d="m6 6 12 12M18 6 6 18"/>,
    zap: <path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>,
    brain: <><path d="M9.5 4A3.5 3.5 0 0 0 6 7.5v.3A3.5 3.5 0 0 0 4 11v1a3.5 3.5 0 0 0 2 3.2v.3A3.5 3.5 0 0 0 9.5 19H12V4Z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5v.3a3.5 3.5 0 0 1 2 3.2v1a3.5 3.5 0 0 1-2 3.2v.3a3.5 3.5 0 0 1-3.5 3.5H12V4ZM8 9h4M12 14h4"/></>,
    building: <><path d="M4 21V4h12v17M16 9h4v12M8 8h4M8 12h4M8 16h4M2 21h20"/></>,
  };

  return <svg {...common} {...props}>{shapes[name]}</svg>;
}
