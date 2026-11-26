export type LearnerNavId = "dashboard" | "learn" | "practice" | "community" | "profile";

export type LearnerNavIconKey = "home" | "book" | "file" | "messages" | "user";

export type LearnerNavItem = {
  id: LearnerNavId;
  label: string;
  href: string;
  icon: LearnerNavIconKey;
  match: (pathname: string) => boolean;
};

export type LearnerPrimaryAction = {
  id: "assistant";
  label: string;
  href: string;
  icon: "sparkles";
};

function normalizePathname(pathname: string) {
  const withoutQuery = pathname.split("?")[0] ?? "/";
  const withoutHash = withoutQuery.split("#")[0] ?? "/";
  const normalized = withoutHash.replace(/\/+$/, "");
  return normalized.length ? normalized : "/";
}

function matchesAnyPrefix(pathname: string, prefixes: string[]) {
  const normalized = normalizePathname(pathname);
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export const learnerNavItems: LearnerNavItem[] = [
  {
    id: "dashboard",
    label: "Today",
    href: "/dashboard",
    icon: "home",
    match: (pathname) => {
      const normalized = normalizePathname(pathname);
      return normalized === "/dashboard";
    },
  },
  {
    id: "learn",
    label: "Learn",
    href: "/learn",
    icon: "book",
    match: (pathname) => matchesAnyPrefix(pathname, ["/learn", "/phase"]),
  },
  {
    id: "practice",
    label: "Practise",
    href: "/past-papers",
    icon: "file",
    match: (pathname) =>
      matchesAnyPrefix(pathname, ["/past-papers", "/daily-quiz", "/textbooks", "/tutor"]) ||
      pathname.includes("/past-papers"),
  },
  {
    id: "community",
    label: "Community",
    href: "/community",
    icon: "messages",
    match: (pathname) =>
      matchesAnyPrefix(pathname, ["/community", "/messages", "/tutors"]) ||
      normalizePathname(pathname) === "/community",
  },
  {
    id: "profile",
    label: "Progress",
    href: "/dashboard/progress",
    icon: "user",
    match: (pathname) =>
      matchesAnyPrefix(pathname, ["/dashboard/progress", "/profile", "/settings"]),
  },
];

export const learnerPrimaryAction: LearnerPrimaryAction = {
  id: "assistant",
  label: "Hybrid tutor",
  href: "/tutor",
  icon: "sparkles",
};

export function resolveLearnerNavId(pathname: string): LearnerNavId | null {
  const active = learnerNavItems.find((item) => item.match(pathname));
  return active?.id ?? null;
}

export function resolveLearnerNavDisplayId(pathname: string, rememberedId: LearnerNavId | null) {
  return resolveLearnerNavId(pathname) ?? rememberedId;
}

export function isLearnerNavActive(id: LearnerNavId, pathname: string) {
  return learnerNavItems.some((item) => item.id === id && item.match(pathname));
}
