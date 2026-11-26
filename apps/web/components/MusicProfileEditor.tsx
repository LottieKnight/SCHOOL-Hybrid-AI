"use client";

import { useState } from "react";
import {
  MUSIC_GENRES,
  MUSIC_VIBES,
  MAX_GENRES,
  MAX_ARTISTS,
  type MusicProfileData,
} from "@/lib/musicConstants";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import styles from "./MusicProfileEditor.module.css";

type Props = {
  initial: MusicProfileData | null;
  onSave: (profile: MusicProfileData) => void;
  onCancel: () => void;
};

export function MusicProfileEditor({ initial, onSave, onCancel }: Props) {
  const [genres, setGenres] = useState<string[]>(initial?.genres ?? []);
  const [artists, setArtists] = useState<string[]>(initial?.artists ?? []);
  const [artistInput, setArtistInput] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState(initial?.playlist_url ?? "");
  const [playlistTitle, setPlaylistTitle] = useState(initial?.playlist_title ?? "");
  const [vibeTags, setVibeTags] = useState<string[]>(initial?.vibe_tags ?? []);
  const [visibility, setVisibility] = useState<"public" | "campus" | "private">(
    initial?.visibility ?? "campus"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : prev.length < MAX_GENRES
        ? [...prev, genre]
        : prev
    );
  }

  function toggleVibe(vibe: string) {
    setVibeTags((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]
    );
  }

  function addArtist() {
    const trimmed = artistInput.trim();
    if (!trimmed || artists.length >= MAX_ARTISTS || artists.includes(trimmed)) return;
    setArtists((prev) => [...prev, trimmed]);
    setArtistInput("");
  }

  function removeArtist(artist: string) {
    setArtists((prev) => prev.filter((a) => a !== artist));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/profile/music/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genres,
          artists,
          playlist_url: playlistUrl.trim() || null,
          playlist_title: playlistTitle.trim() || null,
          vibe_tags: vibeTags,
          visibility,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      const updated: MusicProfileData = await res.json();
      onSave(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save music profile"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.editor}>
      <div className={styles.fieldGroup}>
        <span className={styles.label}>Genres (pick up to {MAX_GENRES})</span>
        <div className={styles.checkGrid}>
          {MUSIC_GENRES.map((g) => (
            <label key={g} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={genres.includes(g)}
                onChange={() => toggleGenre(g)}
                disabled={!genres.includes(g) && genres.length >= MAX_GENRES}
              />
              {g}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.label}>Artists (up to {MAX_ARTISTS})</span>
        <div className={styles.tagRow}>
          {artists.map((a) => (
            <span key={a} className={styles.tag}>
              {a}
              <button type="button" onClick={() => removeArtist(a)} className={styles.tagRemove}>
                ×
              </button>
            </span>
          ))}
          {artists.length < MAX_ARTISTS && (
            <input
              className={styles.artistInput}
              value={artistInput}
              onChange={(e) => setArtistInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addArtist())}
              placeholder="Type name, press Enter"
              maxLength={60}
            />
          )}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.label}>Featured Playlist</span>
        <input
          className={styles.textInput}
          type="url"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          placeholder="Paste any music link (Spotify, YouTube, Apple Music…)"
          maxLength={500}
        />
        <input
          className={styles.textInput}
          type="text"
          value={playlistTitle}
          onChange={(e) => setPlaylistTitle(e.target.value)}
          placeholder="Playlist title"
          maxLength={80}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.label}>Vibes</span>
        <div className={styles.checkGrid}>
          {MUSIC_VIBES.map((v) => (
            <label key={v} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={vibeTags.includes(v)}
                onChange={() => toggleVibe(v)}
              />
              {v}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.label}>Who can see this</span>
        <div className={styles.radioRow}>
          {(["campus", "public", "private"] as const).map((v) => (
            <label key={v} className={styles.radioItem}>
              <input
                type="radio"
                name="visibility"
                value={v}
                checked={visibility === v}
                onChange={() => setVisibility(v)}
              />
              {v === "campus" ? "My campus only" : v === "public" ? "All SCHOOL students" : "Only me"}
            </label>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} className={styles.cancelBtn} disabled={saving}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} className={styles.saveBtn} disabled={saving}>
          {saving ? "Saving…" : "Save Music Profile"}
        </button>
      </div>
    </section>
  );
}
