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
        if (!r.ok) { window.location.href = "/admin/login"; return; }
        const data = await r.json();
        if (!data.ok) { window.location.href = "/admin/login"; return; }
        if (!data.isSuper) {
          const permMap: Record<string, string> = {
            users: "/admin/users", support: "/admin/support", jobs: "/admin/jobs",
            codes: "/admin/codes", crm: "/admin/crm", store: "/admin/store",
            affiliate: "/admin/affiliate", finance: "/admin/finance",
            notifications: "/admin/notifications", admins: "/admin/admins",
            "email-test": "/admin/email-test",
          };
          const perms: string[] = data.permissions ?? [];
          const first = perms.map(p => permMap[p]).find(Boolean);
          window.location.href = first ?? "/admin/chat";
          return;
        }
        setAuthed(true);
      })
      .catch(() => { window.location.href = "/admin/login"; })
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
