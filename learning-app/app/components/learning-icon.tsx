import { Heart, Settings } from "lucide-react";

type IconName = "overview" | "home" | "learning" | "explore" | "heart" | "certificate" | "settings" | "menu" | "close" | "bell" | "collapse" | "profile" | "chevron" | "arrow-left" | "courses" | "add-course" | "instructor-review" | "course-review" | "image" | "camera" | "jobs";

const paths: Record<IconName, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 15h3v3H7zM14 7h3v3h-3zM14 14h3v4h-3z" /></>,
  home: <><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" /></>,
  learning: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H20v15.5H7.5A3.5 3.5 0 0 0 4 23V5.5Z" /><path d="M4 5.5V20" /><path d="M8 8h8M8 12h8" /></>,
  explore: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2M8 10.8h5.6M10.8 8v5.6" /></>,
  heart: <path d="M20.8 8.6c0 5.4-8.8 10.2-8.8 10.2S3.2 14 3.2 8.6A4.8 4.8 0 0 1 12 5.9a4.8 4.8 0 0 1 8.8 2.7Z" />,
  certificate: <><path d="M6 3.5h12v11H6z" /><path d="m9 14.5-1.2 6 4.2-2.2 4.2 2.2-1.2-6" /><path d="m9 8 1.8 1.7L14.5 6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1Z" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  collapse: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M14 9l-3 3 3 3" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  "arrow-left": <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
  courses: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H20v15.5H7.5A3.5 3.5 0 0 0 4 23V5.5Z" /><path d="M4 5.5V20M8 8h8M8 12h8M8 16h5" /></>,
  "add-course": <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H15v11H7.5A3.5 3.5 0 0 0 4 20.5V5.5Z" /><path d="M4 5.5v15M8 8h4M18 10v8M14 14h8" /></>,
  "instructor-review": <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 10l1.7 1.7L21 8.5M15 19h6" /></>,
  "course-review": <><path d="M5 3.5h11l3 3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-15a1.5 1.5 0 0 1 1-1.5Z" /><path d="M15 3.5V7h4M8 11h8M8 15h5" /><path d="m16 18 1.5 1.5L21 16" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m3 17 5-5 4 4 3-3 6 6" /></>,
  camera: <><path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="14" r="3.2" /></>,
  jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2" /></>,
};

export function LearningIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name === "settings") {
    return <Settings aria-hidden="true" className="learning-icon" size={size} strokeWidth={1.8} />;
  }
  if (name === "heart") {
    return <Heart aria-hidden="true" className="learning-icon" size={size} strokeWidth={1.8} />;
  }

  return <svg aria-hidden="true" className="learning-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
