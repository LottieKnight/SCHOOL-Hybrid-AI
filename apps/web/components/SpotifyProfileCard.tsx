"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./SpotifyProfileCard.module.css";

type SpotifyData = {
  connected: boolean;
  topArtists?: Array<{ name: string; imageUrl: string | null; genres: string[] }>;
  topTracks?: Array<{ name: string; artists: string; albumImageUrl: string | null }>;
};

export function SpotifyProfileCard() {
  const [data, setData] = useState<SpotifyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/spotify/me")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading vibes...</div>;
  if (!data?.connected) return (
    <div className={styles.disconnected}>
      <p>Connect your Spotify to share your study vibes! 🎵</p>
      <Link href="/api/auth/spotify" className={styles.connectBtn}>Connect Spotify</Link>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Study Vibes</h3>
        <span className={styles.brand}>Spotify</span>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Top Artists</h4>
        <div className={styles.artistList}>
          {data.topArtists?.map((artist, i) => (
            <div key={i} className={styles.artist}>
              {artist.imageUrl && <Image src={artist.imageUrl} alt={artist.name} className={styles.avatar} width={48} height={48} />}
              <div className={styles.meta}>
                <span className={styles.name}>{artist.name}</span>
                <span className={styles.genres}>{artist.genres.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Recently Study Mix</h4>
        <div className={styles.trackList}>
          {data.topTracks?.map((track, i) => (
            <div key={i} className={styles.track}>
              {track.albumImageUrl && <Image src={track.albumImageUrl} alt={track.name} className={styles.albumArt} width={48} height={48} />}
              <div className={styles.meta}>
                <span className={styles.trackName}>{track.name}</span>
                <span className={styles.trackArtist}>{track.artists}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
