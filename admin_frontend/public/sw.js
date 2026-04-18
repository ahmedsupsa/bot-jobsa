// Jobbots PWA Service Worker — Pass-through (no caching, no offline)
// Intentionally minimal: enables PWA install but never intercepts requests
// so API calls, form submissions, payments, and navigation always hit network.

self.addEventListener("install", (event) => {
  // Activate immediately on first install
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of open pages without requiring reload
  event.waitUntil(self.clients.claim());
  // Clear any legacy caches if a previous SW version cached anything
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
});

// NOTE: No 'fetch' listener registered on purpose.
// All network requests pass directly to the browser without interference.
// This guarantees that API calls, payments, OTP emails, etc. are NEVER blocked.
