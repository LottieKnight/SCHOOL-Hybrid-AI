"use client";

import { useState, useEffect } from "react";

type Props = { paperId: string };

export function PastPaperBookmarkButton({ paperId }: Props) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/past-papers/${paperId}/bookmark`)
      .then((r) => r.json())
      .then((d) => setBookmarked(Boolean(d.bookmarked)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paperId]);

  async function toggle() {
    setLoading(true);
    try {
      const r = await fetch(`/api/past-papers/${paperId}/bookmark`, { method: "POST" });
      const d = await r.json();
      setBookmarked(Boolean(d.bookmarked));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className={`pp-bookmark-btn${bookmarked ? " active" : ""}`}
      onClick={toggle}
      disabled={loading}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this paper"}
      title={bookmarked ? "Bookmarked" : "Bookmark"}
    >
      {bookmarked ? "★" : "☆"}
    </button>
  );
}
