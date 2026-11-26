"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./CommandPalette.module.css";

type CommandItem = {
  id: string;
  title: string;
  category: "Past Papers" | "Modules" | "Study Tools" | "Navigation";
  href: string;
  icon: string;
  badge?: string;
};

const COMMANDS: CommandItem[] = [
  // Past Papers
  { id: "pp-math", title: "Mathematics Past Papers (Grade 10-12)", category: "Past Papers", href: "/past-papers?subject=Mathematics", icon: "📐" },
  { id: "pp-ps", title: "Physical Sciences Past Papers", category: "Past Papers", href: "/past-papers?subject=Physical+Sciences", icon: "🧪" },
  { id: "pp-acc", title: "Accounting Past Papers", category: "Past Papers", href: "/past-papers?subject=Accounting", icon: "📊" },
  { id: "pp-ls", title: "Life Sciences Past Papers", category: "Past Papers", href: "/past-papers?subject=Life+Sciences", icon: "🧬" },
  
  // Modules
  { id: "mod-wves312", title: "WVES312 — Ethics & Values", category: "Modules", href: "/university/modules/wves312", icon: "⚖️" },
  { id: "mod-econ211", title: "ECON211 — Intermediate Microeconomics", category: "Modules", href: "/university/modules/econ211", icon: "📈" },
  { id: "mod-ekip212", title: "EKIP212 — Economics & Policy", category: "Modules", href: "/university/modules/ekip212", icon: "🌐" },
  
  // Study Tools
  { id: "tool-flashcards", title: "Spaced Repetition Flashcards (SM-2)", category: "Study Tools", href: "/study/flashcards", icon: "🗂", badge: "SRS" },
  { id: "tool-aps", title: "University APS Calculator", category: "Study Tools", href: "/bursary#aps-calculator", icon: "🎓", badge: "New" },
  { id: "tool-quiz", title: "Daily CAPS Quiz", category: "Study Tools", href: "/daily-quiz", icon: "⚡" },
  { id: "tool-planner", title: "Study Planner & Timetable", category: "Study Tools", href: "/planner", icon: "📅" },
  { id: "tool-assistant", title: "Multilingual AI Assistant", category: "Study Tools", href: "/tutor", icon: "🤖" },
  
  // Navigation
  { id: "nav-dash", title: "Dashboard", category: "Navigation", href: "/dashboard", icon: "🏠" },
  { id: "nav-learn", title: "CAPS Curriculum Explorer", category: "Navigation", href: "/learn", icon: "📚" },
  { id: "nav-community", title: "Student Community", category: "Navigation", href: "/community", icon: "👥" },
  { id: "nav-bursary", title: "Bursaries & Applications", category: "Navigation", href: "/bursary", icon: "💰" },
  { id: "nav-profile", title: "Profile & Settings", category: "Navigation", href: "/profile", icon: "⚙️" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Handle Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Keyboard navigation within list
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      navigate(filtered[selectedIndex].href);
    }
  };

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            autoFocus
            type="text"
            className={styles.searchInput}
            placeholder="Search past papers, modules, tools, or navigate... (Press Esc to exit)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
          />
          <span className={styles.kbdHint}>ESC</span>
        </div>

        <div className={styles.resultsList}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>No matching results for "{query}"</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                className={`${styles.resultItem} ${idx === selectedIndex ? styles.selected : ""}`}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className={styles.itemIcon}>{item.icon}</span>
                <div className={styles.itemMeta}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemCategory}>{item.category}</span>
                </div>
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
              </button>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <span>Use <strong>↑↓</strong> to navigate</span>
          <span><strong>↵</strong> to select</span>
          <span><strong>ESC</strong> to close</span>
        </div>
      </div>
    </div>
  );
}
