"use client";

import { useRef, useState } from "react";
import type { VideoLessonMeta, VideoChapter } from "@saedu/shared";

type Props = {
  video: VideoLessonMeta;
};

function isYoutube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isVimeo(url: string) {
  return url.includes("vimeo.com");
}

function youtubeEmbedUrl(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!match) return url;
  return `https://www.youtube.com/embed/${match[1]}`;
}

function vimeoEmbedUrl(url: string) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (!match) return url;
  return `https://player.vimeo.com/video/${match[1]}`;
}

export function VideoPlayer({ video }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  function seekTo(seconds: number, idx: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
    setActiveChapter(idx);
  }

  const isEmbed = isYoutube(video.videoUrl) || isVimeo(video.videoUrl);
  const embedUrl = isYoutube(video.videoUrl)
    ? youtubeEmbedUrl(video.videoUrl)
    : isVimeo(video.videoUrl)
      ? vimeoEmbedUrl(video.videoUrl)
      : null;

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: video.chapters?.length ? "1fr 240px" : "1fr",
          gap: "var(--space-3)",
          alignItems: "start",
        }}
      >
        <div style={{ position: "relative", width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          {isEmbed && embedUrl ? (
            <iframe
              src={embedUrl}
              style={{ width: "100%", aspectRatio: "16/9", border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.videoUrl}
            />
          ) : (
            <video
              ref={videoRef}
              src={video.videoUrl}
              controls
              poster={video.thumbnailUrl}
              style={{ width: "100%", display: "block", background: "#000" }}
            >
              {video.captionsUrl && (
                <track kind="captions" src={video.captionsUrl} default />
              )}
            </video>
          )}
        </div>

        {video.chapters && video.chapters.length > 0 && (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--color-border)",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
              }}
            >
              Chapters
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {video.chapters.map((chapter: VideoChapter, idx: number) => (
                <button
                  key={idx}
                  onClick={() => seekTo(chapter.startSeconds, idx)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "none",
                    borderBottom: "1px solid var(--color-border)",
                    background: activeChapter === idx ? "var(--color-surface-raised)" : "transparent",
                    cursor: "pointer",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{chapter.title}</span>
                  <span style={{ display: "block", color: "var(--color-fg-muted)", fontSize: "var(--text-xs)" }}>
                    {formatSeconds(chapter.startSeconds)}
                  </span>
                  {chapter.summary && (
                    <span style={{ display: "block", color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", marginTop: 2 }}>
                      {chapter.summary}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {video.transcript && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <button
            onClick={() => setTranscriptOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 12px",
              border: "none",
              borderBottom: transcriptOpen ? "1px solid var(--color-border)" : "none",
              background: "transparent",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              textAlign: "left",
            }}
          >
            <span>{transcriptOpen ? "▾" : "▸"}</span>
            Transcript
          </button>
          {transcriptOpen && (
            <div
              style={{
                padding: "12px",
                maxHeight: 240,
                overflowY: "auto",
                fontSize: "var(--text-sm)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {video.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
