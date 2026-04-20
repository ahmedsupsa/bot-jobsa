"use client";
import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/portal-auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function saveSubscription(sub: PushSubscription) {
  await portalFetch("/push-subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushSubscribe() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    // If already granted, silently register/refresh subscription
    if (Notification.permission === "granted") {
      const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      if (!VAPID_PUBLIC_KEY) return;
      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          const existing = await reg.pushManager.getSubscription();
          if (existing) { await saveSubscription(existing); return; }
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
          await saveSubscription(sub);
        } catch {}
      });
    }
  }, []);

  async function requestPermission() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) return;
    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!VAPID_PUBLIC_KEY) return;

    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await saveSubscription(sub);
    } catch (e) {
      console.warn("[Push] requestPermission failed:", e);
    } finally {
      setRequesting(false);
    }
  }

  return { permission, requesting, requestPermission };
}
