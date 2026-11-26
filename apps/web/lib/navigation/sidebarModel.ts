export type NavIconName =
  | "home"
  | "book"
  | "file"
  | "spark"
  | "calendar"
  | "quiz"
  | "chat"
  | "bell"
  | "users"
  | "trophy"
  | "game"
  | "pen"
  | "coin"
  | "shop"
  | "grad"
  | "compass"
  | "note";

export type SidebarLink = {
  id: string;
  labelKey: string;
  href: string;
  icon: NavIconName;
  match: (pathname: string) => boolean;
};

function clean(pathname: string) {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.length ? trimmed : "/";
}

function under(pathname: string, prefix: string) {
  const path = clean(pathname);
  return path === prefix || path.startsWith(`${prefix}/`);
}

export const studyLinks: SidebarLink[] = [
  {
    id: "today",
    labelKey: "dashboard",
    href: "/dashboard",
    icon: "home",
    match: (pathname) => clean(pathname) === "/dashboard",
  },
  {
    id: "learn",
    labelKey: "learn",
    href: "/learn",
    icon: "book",
    match: (pathname) => under(pathname, "/learn") || under(pathname, "/phase"),
  },
  {
    id: "papers",
    labelKey: "papers",
    href: "/past-papers",
    icon: "file",
    match: (pathname) => under(pathname, "/past-papers") || pathname.includes("/past-papers"),
  },
  {
    id: "tutor",
    labelKey: "hybridTutor",
    href: "/tutor",
    icon: "spark",
    match: (pathname) => under(pathname, "/tutor") || under(pathname, "/assistant"),
  },
];

export const practiceLinks: SidebarLink[] = [
  {
    id: "planner",
    labelKey: "planner",
    href: "/planner",
    icon: "calendar",
    match: (pathname) => under(pathname, "/planner"),
  },
  {
    id: "quiz",
    labelKey: "dailyQuiz",
    href: "/daily-quiz",
    icon: "quiz",
    match: (pathname) => under(pathname, "/daily-quiz"),
  },
  {
    id: "community",
    labelKey: "community",
    href: "/community",
    icon: "chat",
    match: (pathname) => {
      const path = clean(pathname);
      if (!under(path, "/community") && !under(path, "/messages")) return false;
      return !under(path, "/community/games") && !under(path, "/community/circles") && !under(path, "/community/leaderboard");
    },
  },
];

export const moreLinks: SidebarLink[] = [
  { id: "notes", labelKey: "notes", href: "/notes", icon: "note", match: (pathname) => under(pathname, "/notes") },
  { id: "progress", labelKey: "learningJourney", href: "/profile/learning", icon: "compass", match: (pathname) => under(pathname, "/profile/learning") || under(pathname, "/dashboard/progress") },
  { id: "modules", labelKey: "modules", href: "/university/learning", icon: "grad", match: (pathname) => under(pathname, "/university") },
  { id: "alerts", labelKey: "notifications", href: "/notifications", icon: "bell", match: (pathname) => under(pathname, "/notifications") },
  { id: "circles", labelKey: "studyCircles", href: "/community/circles", icon: "users", match: (pathname) => under(pathname, "/community/circles") },
  { id: "ranks", labelKey: "leaderboard", href: "/community/leaderboard", icon: "trophy", match: (pathname) => under(pathname, "/community/leaderboard") },
  { id: "games", labelKey: "gamesCenter", href: "/community/games", icon: "game", match: (pathname) => under(pathname, "/community/games") },
  { id: "press", labelKey: "press", href: "/press", icon: "pen", match: (pathname) => under(pathname, "/press") },
  { id: "bursaries", labelKey: "bursaries", href: "/bursary", icon: "grad", match: (pathname) => under(pathname, "/bursary") },
  { id: "credits", labelKey: "credits", href: "/credits", icon: "coin", match: (pathname) => under(pathname, "/credits") },
  {
    id: "shop",
    labelKey: "marketplace",
    href: "/marketplace",
    icon: "shop",
    match: (pathname) => ["/marketplace", "/bookstore", "/store", "/cart", "/checkout", "/orders", "/wallet"].some((prefix) => under(pathname, prefix)),
  },
  { id: "guide", labelKey: "guide", href: "/guide", icon: "compass", match: (pathname) => under(pathname, "/guide") },
];

export const phoneBarLinks = [studyLinks[0], studyLinks[1], studyLinks[2]] as const;

export function activeSidebarId(pathname: string) {
  const all = [...studyLinks, ...practiceLinks, ...moreLinks];
  return all.find((link) => link.match(pathname))?.id ?? null;
}
