"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  telegram_id: number;
  email: string;
  created_at: string;
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await apiGet<{ ok: boolean; users: UserRow[] }>("/api/admin/users");
    setRows(res.users || []);
  };

  useEffect(() => {
    load().catch((e) => setMsg(String(e)));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.name} ${r.telegram_id} ${r.email}`.toLowerCase().includes(s)
    );
  }, [q, rows]);

  const updateEmail = async (id: string, email: string) => {
    try {
      await apiSend(`/api/admin/users/${id}/email`, "POST", { email });
      setMsg("تم تحديث البريد بنجاح");
      await load();
    } catch (e) {
      setMsg(String(e));
    }
  };

  return (
    <Shell>
      <section className="rounded-xl border border-line/70 bg-panel/70 p-4">
        <h2 className="mb-3 text-lg font-semibold">إدارة المستخدمين</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو الآيدي أو البريد"
          className="mb-4 w-full rounded-lg border border-line/70 bg-slate-950/40 px-3 py-2 text-sm"
        />
        {msg && <div className="mb-3 text-sm text-sky-200">{msg}</div>}
        <div className="space-y-2">
          {filtered.map((u) => (
            <UserCard key={u.id} user={u} onSave={updateEmail} />
          ))}
        </div>
      </section>
    </Shell>
  );
}

function UserCard({
  user,
  onSave,
}: {
  user: UserRow;
  onSave: (id: string, email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(user.email || "");
  return (
    <div className="rounded-lg border border-line/60 bg-slate-950/30 p-3">
      <div className="mb-2 text-sm">
        <div className="font-medium">{user.name}</div>
        <div className="text-slate-300">ID: {user.telegram_id}</div>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line/60 bg-slate-950/50 px-3 py-2 text-sm"
        />
        <button
          onClick={() => onSave(user.id, email)}
          className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-sm text-sky-100"
        >
          حفظ البريد
        </button>
      </div>
    </div>
  );
}
