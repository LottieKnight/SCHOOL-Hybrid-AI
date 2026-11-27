"use client";

import { useEffect, useState } from "react";
import {
  MINIMAL_PROFILE_EVENT,
  MINIMAL_PROFILE_STORAGE_KEY,
  readMinimalProfile,
  writeMinimalProfile,
  type MinimalProfile,
} from "@/lib/minimalProfile";

export function useMinimalProfile() {
  const [profile, setProfile] = useState<MinimalProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => setProfile(readMinimalProfile(window.localStorage));
    read();
    setReady(true);
    const onChange = () => read();
    window.addEventListener(MINIMAL_PROFILE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(MINIMAL_PROFILE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const save = (next: MinimalProfile) => {
    const saved = writeMinimalProfile(window.localStorage, next);
    window.dispatchEvent(new Event(MINIMAL_PROFILE_EVENT));
    setProfile(saved);
    return saved;
  };

  return { profile, ready, save, storageKey: MINIMAL_PROFILE_STORAGE_KEY };
}
