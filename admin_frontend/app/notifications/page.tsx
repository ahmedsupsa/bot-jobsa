"use client";

import Shell from "@/components/shell";
import { useEffect, useState } from "react";
import { Bell, Send, Users, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/portal/dashboard");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [subscribers, setSubscribers] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSubscribers(d.subscribers ?? 0))
      .catch(() => setSubscribers(0));
  }, []);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url: url.trim() || "/portal/dashboard" }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setMsg(d.error || d.message || "حدث خطأ");
        setMsgType("err");
      } else {
        setMsg(`تم الإرسال ✓ — وصل لـ ${d.sent} مستخدم${d.failed > 0 ? ` · فشل ${d.failed}` : ""}`);
        setMsgType("ok");
        setTitle("");
        setBody("");
        setUrl("/portal/dashboard");
        setSubscribers((s) => s !== null ? s - (d.failed || 0) : s);
      }
    } catch {
      setMsg("خطأ في الاتصال");
      setMsgType("err");
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell size={20} className="text-accent" />
          إشعارات Push
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          إرسال إشعارات فورية لمتصفحات المستخدمين — تصلهم حتى وهم خارج الموقع
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Compose */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send size={17} className="text-accent" />
            <h2 className="font-semibold text-white">إرسال إشعار جديد</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">عنوان الإشعار *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: وظيفة جديدة تناسبك 🔔"
                className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">نص الإشعار *</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب تفاصيل الإشعار هنا..."
                rows={4}
                className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">رابط عند الضغط على الإشعار</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/portal/dashboard"
                dir="ltr"
                className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
              />
            </div>

            {msg && (
              <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
                msgType === "ok"
                  ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-300"
                  : "border-red-500/25 bg-red-950/30 text-red-300"
              }`}>
                {msgType === "ok"
                  ? <CheckCircle size={14} className="shrink-0" />
                  : <XCircle size={14} className="shrink-0" />}
                {msg}
              </div>
            )}

            <button
              onClick={send}
              disabled={sending || !title.trim() || !body.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending
                ? <><Loader2 size={14} className="animate-spin" /> جاري الإرسال…</>
                : <><Send size={14} /> إرسال للجميع</>}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-4">
          {/* Subscribers count */}
          <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-accent" />
              <h2 className="font-semibold text-white">المشتركون في الإشعارات</h2>
            </div>
            <div className="text-4xl font-bold text-white">
              {subscribers === null ? "…" : subscribers}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              مستخدم وافق على استقبال الإشعارات
            </p>
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={16} className="text-accent" />
              <h2 className="font-semibold text-white">كيف يعمل؟</h2>
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              {[
                "المستخدم يوافق على الإشعارات من داخل البورتال",
                "الإشعار يصل فوراً لجهازه حتى لو الموقع مغلق",
                "يعمل على الجوال والحاسب — iOS وAndroid وDesktop",
                "الاشتراكات المنتهية تُحذف تلقائياً",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Shell>
  );
}
