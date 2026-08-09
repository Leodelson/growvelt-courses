type IconName = "overview" | "learning" | "explore" | "certificate" | "settings" | "menu" | "close";

const paths: Record<IconName, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 15h3v3H7zM14 7h3v3h-3zM14 14h3v4h-3z" /></>,
  learning: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H20v15.5H7.5A3.5 3.5 0 0 0 4 23V5.5Z" /><path d="M4 5.5V20" /><path d="M8 8h8M8 12h8" /></>,
  explore: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2M8 10.8h5.6M10.8 8v5.6" /></>,
  certificate: <><path d="M6 3.5h12v11H6z" /><path d="m9 14.5-1.2 6 4.2-2.2 4.2 2.2-1.2-6" /><path d="m9 8 1.8 1.7L14.5 6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
};

export function LearningIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" className="learning-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
