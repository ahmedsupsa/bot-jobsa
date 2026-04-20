"use client";
import { useEffect } from "react";
import { portalFetch } from "@/lib/portal-auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function usePushSubscribe() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!VAPID_PUBLIC_KEY) return;

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          await portalFetch("/push-subscribe", {
            method: "POST",
            body: JSON.stringify({ subscription: existing.toJSON() }),
          });
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await portalFetch("/push-subscribe", {
          method: "POST",
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch (e) {
        console.warn("[Push] subscribe failed:", e);
      }
    }

    subscribe();
  }, []);
}
