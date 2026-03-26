const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_BASE || "";

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return r.json();
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "DELETE",
  body?: unknown
): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} failed: ${r.status}`);
  return r.json();
}

export { API_BASE };
