"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { Search, Save, User } from "lucide-react";

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
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const load = async () => {
    const res = await apiGet<{ ok: boolean; users: UserRow[] }>("/api/admin/users");
    setRows(res.users || []);
  };

  useEffect(() => {
    load().catch((e) => { setMsg(String(e)); setMsgType("err"); });
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
      setMsg("تم تحديث البريد بنجاح ✓");
      setMsgType("ok");
      await load();
    } catch (e) {
      setMsg(String(e));
      setMsgType("err");
    }
  };

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">المستخدمون</h1>
        <p className="text-sm text-slate-400 mt-0.5">إدارة حسابات المشتركين وبريدهم الإلكتروني</p>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          msgType === "ok"
            ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-300"
            : "border-red-500/25 bg-red-950/30 text-red-300"
        }`}>
          {msg}
        </div>
      )}

      <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
        <div className="border-b border-line/60 px-5 py-4">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الآيدي أو البريد..."
              className="w-full rounded-xl border border-line/70 bg-panel2 pr-9 pl-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="px-5 py-2.5 border-b border-line/40 text-xs text-slate-500">
          {filtered.length} مستخدم
        </div>
        <div className="divide-y divide-line/40">
          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">لا توجد نتائج</div>
          ) : (
            filtered.map((u) => <UserCard key={u.id} user={u} onSave={updateEmail} />)
          )}
        </div>
      </div>
    </Shell>
  );
}

function UserCard({ user, onSave }: { user: UserRow; onSave: (id: string, email: string) => Promise<void> }) {
  const [email, setEmail] = useState(user.email || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(user.id, email);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 border border-accent/25 shrink-0">
          <User size={16} className="text-accent" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{user.name || "—"}</div>
          <div className="text-xs text-slate-400">ID: {user.telegram_id}</div>
        </div>
      </div>
      <div className="flex gap-2 sm:w-80">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الإلكتروني"
          className="flex-1 min-w-0 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3 py-2 text-xs text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
        >
          <Save size={13} />
          {saving ? "..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}
