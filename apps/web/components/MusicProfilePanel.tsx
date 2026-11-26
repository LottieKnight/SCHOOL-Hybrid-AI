"use client";

import Link from "next/link";
import {
  detectMusicPlatform,
  PLATFORM_LABELS,
  type MusicProfileData,
} from "@/lib/musicConstants";
import styles from "./MusicProfilePanel.module.css";

type Props = {
  profile: MusicProfileData;
  isSelf: boolean;
  onEdit: () => void;
};

export function MusicProfilePanel({ profile, isSelf, onEdit }: Props) {
  const { genres, artists, playlist_url, playlist_title, vibe_tags } = profile;

  const safePlaylistUrl = (() => {
    if (!playlist_url) return null;
    try {
      const u = new URL(playlist_url);
      return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
    } catch {
      return null;
    }
  })();

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>Music Identity</h3>
        {isSelf && (
          <button className={styles.editBtn} onClick={onEdit} type="button">
            Edit
          </button>
        )}
      </div>

      {genres.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Genres</span>
          <div className={styles.pills}>
            {genres.map((g) => (
              <span key={g} className={styles.pill}>
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {artists.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Artists</span>
          <p className={styles.artists}>{artists.join(" · ")}</p>
        </div>
      )}

      {safePlaylistUrl && playlist_title && (
        <div className={styles.section}>
          <span className={styles.label}>Featured Playlist</span>
          <a
            href={safePlaylistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.playlistCard}
          >
            <span className={styles.playlistIcon}>▶</span>
            <span className={styles.playlistTitle}>{playlist_title}</span>
            <span className={styles.platformLabel}>
              {PLATFORM_LABELS[detectMusicPlatform(safePlaylistUrl)]} ↗
            </span>
          </a>
        </div>
      )}

      {vibe_tags.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Vibes</span>
          <div className={styles.pills}>
            {vibe_tags.map((v) => (
              <span key={v} className={`${styles.pill} ${styles.vibePill}`}>
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {!isSelf && (
        <Link href="/community/music?match=different" className={styles.discoverLink}>
          Discover students with different tastes →
        </Link>
      )}
    </section>
  );
}
