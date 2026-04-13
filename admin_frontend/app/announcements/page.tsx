"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";

type Ann = { id: string; title?: string; body_text?: string; is_active?: boolean };

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Ann[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const r = await apiGet<{ ok: boolean; announcements: Ann[] }>("/api/admin/announcements");
    setRows(r.announcements || []);
  };
  useEffect(() => {
    load().catch((e) => { setMsg(String(e)); setMsgType("err"); });
  }, []);

  const add = async () => {
    setSending(true);
    try {
      await apiSend("/api/admin/announcements", "POST", { title, body_text: body });
      setTitle("");
      setBody("");
      setMsg("تم نشر الإعلان بنجاح ✓");
      setMsgType("ok");
      await load();
    } catch (e) {
      setMsg(String(e));
      setMsgType("err");
    } finally {
      setSending(false);
    }
  };

  const del = async (id: string) => {
    await apiSend(`/api/admin/announcements/${id}`, "DELETE");
    await load();
  };

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">الإعلانات</h1>
        <p className="text-sm text-slate-400 mt-0.5">نشر رسائل وإعلانات للمشتركين في البوت</p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Compose */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send size={17} className="text-accent" />
            <h2 className="font-semibold text-white">إعلان جديد</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">العنوان</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان الإعلان..."
                className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">نص الإعلان</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب الرسالة هنا..."
                rows={6}
                className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none resize-none"
              />
            </div>
            {msg && (
              <div className={`rounded-xl border px-4 py-2.5 text-sm ${
                msgType === "ok"
                  ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-300"
                  : "border-red-500/25 bg-red-950/30 text-red-300"
              }`}>
                {msg}
              </div>
            )}
            <button
              onClick={add}
              disabled={sending || !body.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? "جاري النشر..." : "نشر الإعلان"}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-line/60 px-5 py-4">
            <Megaphone size={16} className="text-accent" />
            <h2 className="font-semibold text-white">الإعلانات ({rows.length})</h2>
          </div>
          <div className="divide-y divide-line/40 max-h-[500px] overflow-y-auto">
            {rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">لا توجد إعلانات</div>
            ) : rows.map((a) => (
              <div key={a.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{a.title || "بدون عنوان"}</div>
                    <div className="mt-1 text-xs text-slate-400 line-clamp-2">{a.body_text || ""}</div>
                    {a.is_active !== undefined && (
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                        a.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/50 text-slate-400"
                      }`}>
                        {a.is_active ? "نشط" : "مخفي"}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => del(a.id)}
                    className="shrink-0 rounded-lg border border-red-500/25 bg-red-950/30 p-2 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
