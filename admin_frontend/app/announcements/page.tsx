"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";

type Ann = { id: string; title?: string; body_text?: string; is_active?: boolean };

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Ann[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r = await apiGet<{ ok: boolean; announcements: Ann[] }>("/api/admin/announcements");
    setRows(r.announcements || []);
  };
  useEffect(() => {
    load().catch((e) => setMsg(String(e)));
  }, []);

  const add = async () => {
    try {
      await apiSend("/api/admin/announcements", "POST", { title, body_text: body });
      setTitle("");
      setBody("");
      setMsg("تم نشر الإعلان");
      await load();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const del = async (id: string) => {
    await apiSend(`/api/admin/announcements/${id}`, "DELETE");
    await load();
  };

  return (
    <Shell>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">إضافة إعلان</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="العنوان"
            className="mb-2 w-full rounded-lg border border-line/60 bg-slate-950/50 px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="نص الإعلان"
            className="mb-2 min-h-36 w-full rounded-lg border border-line/60 bg-slate-950/50 px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-sm text-sky-100"
          >
            نشر
          </button>
          {msg && <div className="mt-2 text-sm text-sky-200">{msg}</div>}
        </div>
        <div className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">الإعلانات الحالية</h2>
          <div className="space-y-2">
            {rows.map((a) => (
              <div key={a.id} className="rounded-lg border border-line/50 bg-slate-950/40 p-3 text-sm">
                <div className="font-medium">{a.title || "بدون عنوان"}</div>
                <div className="line-clamp-3 text-slate-300">{a.body_text || ""}</div>
                <div className="mt-2">
                  <button
                    onClick={() => del(a.id)}
                    className="rounded-lg border border-red-400/30 bg-red-500/20 px-2 py-1 text-xs text-red-100"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  );
}
