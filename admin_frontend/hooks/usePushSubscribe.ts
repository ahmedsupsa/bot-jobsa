"use client";
import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/portal-auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function trySubscribe() {
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await portalFetch("/push-subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
  } catch (e) {
    console.warn("[Push] subscribe failed:", e);
  }
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushSubscribe() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const current = Notification.permission as PushPermission;
    setPermission(current);
    if (current === "granted") trySubscribe();
  }, []);

  async function requestPermission() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result === "granted") {
        await trySubscribe();
      }
    } catch (e) {
      console.warn("[Push] requestPermission failed:", e);
    } finally {
      setRequesting(false);
    }
  }

  return { permission, requesting, requestPermission };
}
