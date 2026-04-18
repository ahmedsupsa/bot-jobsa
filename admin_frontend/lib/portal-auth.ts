export const TOKEN_KEY = "portal_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function delCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // Try localStorage first, then fall back to cookie (iOS PWA may clear localStorage after 7 days)
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = getCookie(TOKEN_KEY);
    if (t) localStorage.setItem(TOKEN_KEY, t); // restore to localStorage
  }
  return t;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  setCookie(TOKEN_KEY, token, COOKIE_MAX_AGE);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  delCookie(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function portalFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`/api/portal${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  // Sliding session: server may issue a refreshed token in this header
  const refreshed = res.headers.get("X-Refresh-Token");
  if (refreshed) setToken(refreshed);
  return res;
}
