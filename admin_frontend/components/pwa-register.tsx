"use client";
import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Register on next tick so it never blocks first paint
    const t = setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Non-fatal: PWA install just won't be available
          console.warn("[PWA] SW registration failed:", err);
        });
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
