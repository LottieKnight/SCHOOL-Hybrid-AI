import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata = {
  title: "User Guide — SCHOOL",
  description: "Learn your way around SCHOOL: sign in, navigate, and get the most out of every feature.",
};

const NAV_SECTIONS = [
  {
    title: "Getting started",
    intro: "The fastest path from new account to a working study flow.",
    items: [
      {
        title: "Create an account",
        body: "Sign up with your email and a password (min 8 characters). New accounts get a free 14-day trial of full access, including AI study generations.",
        links: [{ href: "/signup", label: "Create account" }],
      },
      {
        title: "Sign in",
        body: "Use your email and password from any device. Sessions keep you signed in across the sidebar, mobile navigation, and the AI study assistant.",
        links: [{ href: "/auth", label: "Sign in" }],
      },
      {
        title: "Complete onboarding",
        body: "Tell SCHOOL your grade or programme, subjects, and goals. This powers personalisation: the planner, the daily quiz, learning reminders, and AI answers tuned to your curriculum (CAPS for school, your modules for university).",
        links: [{ href: "/onboarding", label: "Set up my profile" }],
      },
      {
        title: "Add your material",
        body: "Upload notes, past papers, or course content so the AI assistant can ground its answers in what you're actually studying.",
        links: [{ href: "/notes", label: "Open notes" }, { href: "/study/new", label: "New study session" }],
      },
    ],
  },
  {
    title: "Navigating the platform",
    intro: "Everything hangs off the sidebar on desktop and the bottom navigation on mobile.",
    items: [
      {
        title: "Sidebar (desktop)",
        body: "The left sidebar groups the platform into Learn (learning material, practice, daily quiz, planner), Connect (community, study circles, leaderboard, games), and Account (settings, learning journey). Collapse it with the toggle for more reading room.",
      },
      {
        title: "Bottom navigation (mobile)",
        body: "On small screens the sidebar becomes a bottom bar with the core destinations: Home, Learn, Community, and Profile. The full menu stays one tap away.",
      },
      {
        title: "Dashboard",
        body: "Your landing page summarises today's plan: streak, reminders, recent material, and quick actions. Anything here links to the fuller tool.",
        links: [{ href: "/dashboard", label: "Open dashboard" }],
      },
      {
        title: "The AI study assistant",
        body: "Available from the sidebar (AI Tutor) or inside a study session. Paste notes, ask for an explanation, a summary, or practice questions. The assistant adapts to your language preference and curriculum. Free accounts get a daily generation cap; the cap resets daily.",
        links: [{ href: "/tutor", label: "Open AI Tutor" }, { href: "/study", label: "Open study session" }],
      },
    ],
  },
  {
    title: "Personalisation",
    intro: "The features that make SCHOOL feel like yours.",
    items: [
      {
        title: "Learning profile",
        body: "Your grade or programme, selected subjects, and study preferences drive the planner, quiz difficulty, and AI tone. Update it any time from the learning journey.",
        links: [{ href: "/profile/learning", label: "Open learning journey" }],
      },
      {
        title: "Planner",
        body: "Build a weekly study timetable around your subjects. Mark sessions complete to keep your streak and get reminders for what's due.",
        links: [{ href: "/planner", label: "Open planner" }],
      },
      {
        title: "Daily quiz",
        body: "A short, personalised quiz each day based on your weakest subjects. Keep your streak to stay consistent.",
        links: [{ href: "/daily-quiz", label: "Take today's quiz" }],
      },
      {
        title: "Language and accessibility",
        body: "Set your preferred language and accessibility options in Settings. The AI assistant and interface adapt accordingly.",
        links: [{ href: "/settings", label: "Open settings" }],
      },
    ],
  },
  {
    title: "Practice and assessment",
    intro: "Turn studying into results.",
    items: [
      {
        title: "Past papers",
        body: "Browse CAPS past papers by province, grade, and subject. Attempts are saved to your account; completed attempts unlock detailed reports (unlockable with Scholar Credits).",
        links: [{ href: "/past-papers", label: "Browse past papers" }],
      },
      {
        title: "Notes",
        body: "Save and sync notes to your account so they follow you across sessions and devices.",
        links: [{ href: "/notes", label: "Open notes" }],
      },
      {
        title: "Scholar Credits",
        body: "Earn credits through activity and referrals, and spend them on premium unlocks like detailed past-paper reports.",
        links: [{ href: "/credits", label: "View credits" }],
      },
    ],
  },
  {
    title: "Community",
    intro: "Learn together.",
    items: [
      {
        title: "Community feed",
        body: "Post questions, share wins, and follow peers. The feed is personalised to your subjects and school.",
        links: [{ href: "/community", label: "Open community" }],
      },
      {
        title: "Study circles",
        body: "Join or create small groups around a subject or goal, with shared material and reminders.",
        links: [{ href: "/community/circles", label: "Browse circles" }],
      },
      {
        title: "Games centre",
        body: "Turn revision into games: citation sprints, CV optimiser, debate clock, and more.",
        links: [{ href: "/community/games", label: "Open games" }],
      },
      {
        title: "Leaderboard",
        body: "See how you rank among peers on streaks, quizzes, and engagement.",
        links: [{ href: "/community/leaderboard", label: "View leaderboard" }],
      },
    ],
  },
  {
    title: "Account and plans",
    intro: "Keep your data and access in order.",
    items: [
      {
        title: "Settings",
        body: "Manage profile details, language, accessibility, notifications, and privacy from one place.",
        links: [{ href: "/settings", label: "Open settings" }],
      },
      {
        title: "Plans and access",
        body: "New accounts run on a 14-day trial. After the trial, the AI assistant continues with a daily generation cap on the free plan. Upgrade any time for unlimited AI sessions.",
      },
      {
        title: "Safety and consent",
        body: "Learners under 18 need parental consent to register, and users under 13 may not create accounts, in line with POPIA. Marketplace and tutoring features require phone verification.",
        links: [{ href: "/verify-phone", label: "Verify phone" }],
      },
    ],
  },
];

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
  padding: "20px",
};

const sectionHeaderStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  marginBottom: "4px",
};

function GuideSection({ section }: { section: (typeof NAV_SECTIONS)[number] }) {
  return (
    <section>
      <div style={sectionHeaderStyle}>
        <h2 className="title" style={{ margin: 0, fontSize: "1.4rem" }}>{section.title}</h2>
        {section.intro ? <p className="subtitle" style={{ margin: 0 }}>{section.intro}</p> : null}
      </div>
      <div style={{ display: "grid", gap: "14px", marginTop: "14px" }}>
        {section.items.map((item) => (
          <article key={item.title} className="glass card" style={cardStyle}>
            <strong style={{ fontSize: "1.02rem" }}>{item.title}</strong>
            <p style={{ margin: 0, color: "var(--text-2)", lineHeight: 1.6, fontSize: "14px" }}>{item.body}</p>
            {item.links && item.links.length > 0 ? (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {item.links.map((link) => (
                  <Link key={link.href} className="button button-ghost" href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="route-lock-dock" style={{ padding: "32px 20px", maxWidth: "860px", margin: "0 auto", width: "100%" }}>
      <div className="route-lock-frame glass card card-with-back" style={{ display: "grid", gap: "28px" }}>
        <header>
          <span className="eyebrow">User Guide</span>
          <h1 className="title" style={{ marginTop: "0.2rem" }}>
            Learn your way around SCHOOL.
          </h1>
          <p className="subtitle">
            A plain-English tour of signing in, navigating, and getting the most out of every feature —
            whether you&apos;re a school learner following CAPS or a university student.
          </p>
        </header>

        <nav aria-label="Guide contents">
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {NAV_SECTIONS.map((section) => (
              <a
                key={section.title}
                href={`#${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="button button-ghost"
                style={{ padding: "8px 14px", fontSize: "13px", textDecoration: "none" }}
              >
                {section.title}
              </a>
            ))}
          </div>
        </nav>

        {NAV_SECTIONS.map((section) => (
          <GuideSection key={section.title} section={section} />
        ))}

        <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "18px" }}>
          <p className="subtitle" style={{ margin: 0, fontSize: "13px" }}>
            Stuck? Start at the{" "}
            <Link href="/dashboard" style={{ textDecoration: "underline" }}>
              dashboard
            </Link>{" "}
            or ask the{" "}
            <Link href="/tutor" style={{ textDecoration: "underline" }}>
              AI tutor
            </Link>{" "}
            for help.
          </p>
        </footer>
      </div>
    </div>
  );
}
