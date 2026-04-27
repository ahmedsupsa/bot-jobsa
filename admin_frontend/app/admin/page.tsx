"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/dashboard";
import Shell from "@/components/shell";

export default function AdminPage() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) { window.location.href = "/login"; return; }
        const data = await r.json();
        if (!data.ok) { window.location.href = "/login"; return; }
        if (!data.isSuper) {
          // Redirect non-super admins to their first allowed page
          const permMap: Record<string, string> = {
            users: "/users", support: "/support-admin", jobs: "/jobs",
            codes: "/codes", crm: "/crm", store: "/store-admin",
            affiliate: "/affiliate-admin", finance: "/finance",
            notifications: "/notifications", admins: "/admin/admins",
            "email-test": "/admin/email-test",
          };
          const perms: string[] = data.permissions ?? [];
          const first = perms.map(p => permMap[p]).find(Boolean);
          window.location.href = first ?? "/login";
          return;
        }
        setAuthed(true);
      })
      .catch(() => { window.location.href = "/login"; })
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!authed) return null;

  return (
    <Shell>
      <Dashboard />
    </Shell>
  );
}
