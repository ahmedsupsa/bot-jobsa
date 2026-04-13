"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/dashboard";
import Shell from "@/components/shell";

export default function Page() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/summary", { credentials: "include" })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          window.location.href = "/login";
        } else {
          setAuthed(true);
        }
      })
      .catch(() => {
        setAuthed(true);
      })
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
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
