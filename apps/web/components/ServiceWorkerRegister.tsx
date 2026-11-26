"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const isProd = process.env.NODE_ENV === "production";
    const register = async () => {
      try {
        if (!isProd) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          return;
        }
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // ignore
      }
    };
    register();
  }, []);

  return null;
}
