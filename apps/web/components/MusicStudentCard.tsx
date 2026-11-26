"use client";

import Link from "next/link";
import {
  detectMusicPlatform,
  PLATFORM_LABELS,
  type MusicDiscoveryRecord,
} from "@/lib/musicConstants";
import styles from "./MusicStudentCard.module.css";

type Props = {
  record: MusicDiscoveryRecord;
};

export function MusicStudentCard({ record }: Props) {
  const {
    first_name,
    last_name,
    username,
    school_name,
    genres,
    artists,
    playlist_url,
    overlap_count,
  } = record;

  const initials = (first_name[0] ?? "").toUpperCase() + (last_name[0] ?? "").toUpperCase();

  const safePlaylistUrl = (() => {
    if (!playlist_url) return null;
    try {
      const u = new URL(playlist_url);
      return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
      return null;
    }
  })();

  const displayGenres = genres.slice(0, 3);
  const displayArtists = artists.slice(0, 3);

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <div className={styles.avatar} aria-hidden="true">
          {initials}
        </div>
        <div className={styles.identity}>
          <span className={styles.name}>
            {first_name} {last_name}
          </span>
          {username !== null && (
            <span className={styles.username}>@{username}</span>
          )}
          {school_name !== null && (
            <span className={styles.school}>{school_name}</span>
          )}
        </div>
        {overlap_count !== null && overlap_count > 0 && (
          <span className={styles.overlapBadge}>
            {overlap_count} shared genre{overlap_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {displayGenres.length > 0 && (
        <div className={styles.pills}>
          {displayGenres.map((g) => (
            <span key={g} className={styles.pill}>
              {g}
            </span>
          ))}
        </div>
      )}

      {displayArtists.length > 0 && (
        <p className={styles.artists}>{displayArtists.join(" · ")}</p>
      )}

      {safePlaylistUrl !== null && (
        <a
          href={safePlaylistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.playlistLink}
        >
          {PLATFORM_LABELS[detectMusicPlatform(safePlaylistUrl)]} ↗
        </a>
      )}

      {username !== null && (
        <Link href={`/profile/${username}`} className={styles.profileLink}>
          View profile →
        </Link>
      )}
    </article>
  );
}
