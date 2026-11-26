"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";

type VoiceRecorderProps = {
  onTranscriptReady: (transcript: string, summary: string) => void;
};

export function VoiceRecorder({ onTranscriptReady }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Request specific mimeType if needed, but WAV/WebM is standard
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access error:", error);
      alert("Unable to access microphone. Please check browser permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      // Whisper expects a file with an extension it recognizes
      formData.append("file", blob, "recording.webm");

      const response = await fetch("/api/intelligence/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to process audio.");
      
      onTranscriptReady(data.transcript, data.summary);
    } catch (error) {
      console.error("Transcription error:", error);
      alert(error instanceof Error ? error.message : "Failed to transcribe audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "12px",
        justifyItems: "center",
        padding: "20px",
        border: "1px dashed var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 600 }}>Lecture Recorder</div>
      <p style={{ fontSize: "12px", color: "var(--text-3)", textAlign: "center", margin: 0, maxWidth: "280px" }}>
        Record a snippet of your lecture. We'll transcribe and create study notes for you.
      </p>

      {!isRecording ? (
        <Button variant="gold" onClick={startRecording} disabled={isProcessing} style={{ minWidth: "160px" }}>
          {isProcessing ? "Transcribing..." : "🎤 Start Recording"}
        </Button>
      ) : (
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "var(--red)",
              boxShadow: "0 0 8px var(--red)",
            }}
            className="animate-pulse"
          />
          <Button variant="outline" onClick={stopRecording}>
            🛑 Stop & Process
          </Button>
        </div>
      )}
    </div>
  );
}
