"use client";

import styles from "@/app/messages/page.module.css";

type MessageAttachment = {
  id: string;
  message_id?: string;
  conversation_id?: string;
  uploader_id?: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: "file" | "image" | "video" | "audio";
  duration_seconds: number | null;
  scan_status?: "pending" | "clean" | "blocked";
  created_at?: string;
};

type MessageAttachmentListProps = {
  attachments: MessageAttachment[];
  attachmentUrl: (attachment: any) => string;
  attachmentScanLabel: (attachment: any) => string | null;
  formatBytes: (value: number) => string;
};

export function MessageAttachmentList({
  attachments,
  attachmentUrl,
  attachmentScanLabel,
  formatBytes,
}: MessageAttachmentListProps) {
  return (
    <div className={styles.attachmentStack}>
      {attachments.map((attachment) => {
        const url = attachmentUrl(attachment);
        const scanLabel = attachmentScanLabel(attachment);
        const blocked = attachment.scan_status === "blocked";
        if (attachment.kind === "image") {
          if (blocked) {
            return (
              <div key={attachment.id} className={`${styles.attachmentFile} ${styles.attachmentBlocked}`}>
                <strong>{attachment.file_name}</strong>
                <span>{scanLabel || "Blocked attachment"}</span>
              </div>
            );
          }
          return (
            <div key={attachment.id} className={styles.attachmentRichWrap}>
              <a href={url} target="_blank" rel="noreferrer" className={styles.attachmentImageLink}>
                {/* Attachments are user-uploaded and streamed from the API; keep <img> for direct blob-style rendering. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.attachmentImage} src={url} alt={attachment.file_name} loading="lazy" />
              </a>
              {scanLabel ? <span className={styles.scanBadge}>{scanLabel}</span> : null}
            </div>
          );
        }
        if (attachment.kind === "video") {
          if (blocked) {
            return (
              <div key={attachment.id} className={`${styles.attachmentFile} ${styles.attachmentBlocked}`}>
                <strong>{attachment.file_name}</strong>
                <span>{scanLabel || "Blocked attachment"}</span>
              </div>
            );
          }
          return (
            <div key={attachment.id} className={styles.attachmentRichWrap}>
              <video className={styles.attachmentMedia} controls preload="metadata">
                <source src={url} type={attachment.mime_type} />
              </video>
              {scanLabel ? <span className={styles.scanBadge}>{scanLabel}</span> : null}
            </div>
          );
        }
        if (attachment.kind === "audio") {
          if (blocked) {
            return (
              <div key={attachment.id} className={`${styles.attachmentFile} ${styles.attachmentBlocked}`}>
                <strong>{attachment.file_name}</strong>
                <span>{scanLabel || "Blocked attachment"}</span>
              </div>
            );
          }
          return (
            <div key={attachment.id} className={styles.attachmentAudioWrap}>
              <audio controls className={styles.attachmentAudio}>
                <source src={url} type={attachment.mime_type} />
              </audio>
              <span className={styles.attachmentMetaText}>
                Voice note
                {attachment.duration_seconds ? ` (${Math.round(attachment.duration_seconds)}s)` : ""}
              </span>
              {scanLabel ? <span className={styles.scanBadge}>{scanLabel}</span> : null}
            </div>
          );
        }
        if (blocked) {
          return (
            <div key={attachment.id} className={`${styles.attachmentFile} ${styles.attachmentBlocked}`}>
              <strong>{attachment.file_name}</strong>
              <span>{scanLabel || "Blocked attachment"}</span>
            </div>
          );
        }
        return (
          <a key={attachment.id} href={url} target="_blank" rel="noreferrer" className={styles.attachmentFile}>
            <strong>{attachment.file_name}</strong>
            <span>
              {attachment.kind.toUpperCase()} - {formatBytes(Number(attachment.size_bytes || 0))}
            </span>
            {scanLabel ? <span className={styles.scanBadge}>{scanLabel}</span> : null}
          </a>
        );
      })}
    </div>
  );
}
