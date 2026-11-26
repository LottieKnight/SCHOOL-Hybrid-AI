export const MUSIC_GENRES = [
  "Amapiano",
  "Kwaito",
  "Gqom",
  "Maskandi",
  "SA House (Deep/Afro)",
  "Gospel",
  "SA Hip-hop",
  "Afrobeats",
  "Jazz",
  "R&B/Soul",
  "Afropop",
  "Sungura",
  "Classical",
  "Rock",
  "Indie",
  "Electronic",
  "Folk/Traditional",
  "Ragga/Dancehall",
  "Other",
] as const;

export const MUSIC_VIBES = [
  "Study Mode",
  "Hype",
  "Chilled",
  "Late Night",
  "Morning Motivation",
  "Spiritual",
  "Feel Good",
  "Workout",
  "Campus Vibes",
  "Heartbreak",
] as const;

export const MAX_GENRES = 5;
export const MAX_ARTISTS = 10;

export type MusicPlatform =
  | "spotify"
  | "youtube-music"
  | "apple-music"
  | "soundcloud"
  | "deezer"
  | "generic";

export function detectMusicPlatform(url: string): MusicPlatform {
  if (url.includes("spotify.com")) return "spotify";
  if (url.includes("music.youtube.com") || url.includes("youtube.com/playlist"))
    return "youtube-music";
  if (url.includes("music.apple.com")) return "apple-music";
  if (url.includes("soundcloud.com")) return "soundcloud";
  if (url.includes("deezer.com")) return "deezer";
  return "generic";
}

export const PLATFORM_LABELS: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  "youtube-music": "YouTube Music",
  "apple-music": "Apple Music",
  soundcloud: "SoundCloud",
  deezer: "Deezer",
  generic: "Open link",
};

export type MusicProfileData = {
  user_id: string;
  genres: string[];
  artists: string[];
  playlist_url: string | null;
  playlist_title: string | null;
  vibe_tags: string[];
  visibility: "public" | "campus" | "private";
  updated_at: string;
};

export type MusicDiscoveryRecord = {
  user_id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  avatar_uniform: Record<string, unknown> | null;
  school_name: string | null;
  genres: string[];
  artists: string[];
  playlist_url: string | null;
  playlist_title: string | null;
  vibe_tags: string[];
  overlap_count: number | null;
};
