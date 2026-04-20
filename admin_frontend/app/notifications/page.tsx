"use client";

import Shell from "@/components/shell";
import { useEffect, useState, useCallback } from "react";
import {
  Bell, Send, Users, CheckCircle, XCircle, Loader2, RefreshCw,
  Mail, FileText, UserX, TrendingDown, Trophy, Zap, ChevronDown, ChevronUp,
} from "lucide-react";

type Segment = "no_email" | "no_cv" | "expired" | "expiring" | "achievement" | "all";

interface SegmentInfo {
  id: Segment;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  templateTitle: string;
  templateBody: string;
  templateUrl: string;
}

const SEGMENTS: SegmentInfo[] = [
  {
    id: "no_email",
    label: "لم يربطوا الإيميل",
    desc: "مشتركون نشطون بدون إيميل مربوط",
    icon: <Mail size={16} />,
    color: "#f59e0b",
    templateTitle: "باقي خطوة يا {name} 👀",
    templateBody: "اربط إيميلك عشان نبدأ نقدم لك وظائف تلقائياً بدون تدخل 🔥",
    templateUrl: "/portal/settings",
  },
  {
    id: "no_cv",
    label: "لم يرفعوا السيرة",
    desc: "مشتركون نشطون بدون CV",
    icon: <FileText size={16} />,
    color: "#3b82f6",
    templateTitle: "جاهز نقدم لك؟ 🔥",
    templateBody: "ارفع سيرتك الذاتية وخلي البوت يقدم لك وظائف كل 30 دقيقة",
    templateUrl: "/portal/cv",
  },
  {
    id: "expiring",
    label: "اشتراكهم ينتهي قريباً",
    desc: "ينتهي خلال 3 أيام",
    icon: <TrendingDown size={16} />,
    color: "#f97316",
    templateTitle: "اشتراكك ينتهي قريباً يا {name} ⏳",
    templateBody: "جدّد اشتراكك الآن واستمر في التقديم التلقائي",
    templateUrl: "/portal/dashboard",
  },
  {
    id: "expired",
    label: "اشتراكهم انتهى",
    desc: "مستخدمون سابقون — أعدهم",
    icon: <UserX size={16} />,
    color: "#ef4444",
    templateTitle: "وينك يا {name}؟ 😅",
    templateBody: "اشتراكك انتهى — جدّده الآن وابدأ التقديم التلقائي من جديد",
    templateUrl: "/portal/dashboard",
  },
  {
    id: "achievement",
    label: "إنجازات اليوم 🚀",
    desc: "من تم التقديم لهم اليوم",
    icon: <Trophy size={16} />,
    color: "#fff",
    templateTitle: "تم التقديم على وظائف اليوم 🚀",
    templateBody: "تابع إيميلك لأي رد من الشركات — البوت شغّال لأجلك",
    templateUrl: "/portal/applications",
  },
  {
    id: "all",
    label: "جميع المشتركين",
    desc: "بث عام لكل من وافق على الإشعارات",
    icon: <Zap size={16} />,
    color: "#a78bfa",
    templateTitle: "مرحباً يا {name} 👋",
    templateBody: "لديك تحديثات جديدة على Jobbots",
    templateUrl: "/portal/dashboard",
  },
];

export default function NotificationsPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  const [activeSegment, setActiveSegment] = useState<Segment | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [showManual, setShowManual] = useState(false);

  const loadData = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const [smartRes, broadcastRes] = await Promise.all([
        fetch("/api/admin/notifications/smart", { credentials: "include" }),
        fetch("/api/admin/notifications", { credentials: "include" }),
      ]);
      const smart = await smartRes.json();
      const broad = await broadcastRes.json();
      if (smart.ok) setCounts(smart.counts || {});
      setSubscribers(broad.subscribers ?? 0);
    } catch { /* silent */ }
    finally { setLoadingCounts(false); }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 30_000);
    return () => clearInterval(id);
  }, [loadData]);

  function selectSegment(seg: SegmentInfo) {
    setActiveSegment(seg.id);
    setCustomTitle(seg.templateTitle);
    setCustomBody(seg.templateBody);
    setCustomUrl(seg.templateUrl);
    setMsg("");
  }

  async function sendSmart() {
    if (!activeSegment || !customTitle.trim() || !customBody.trim()) return;
    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/notifications/smart", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: activeSegment,
          customTitle: customTitle.trim(),
          customBody: customBody.trim(),
          customUrl: customUrl.trim() || "/portal/dashboard",
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setMsg(d.error || "حدث خطأ");
        setMsgType("err");
      } else {
        setMsg(`تم الإرسال ✓ — استُهدف ${d.targeted} · وصل لـ ${d.sent}${d.failed > 0 ? ` · فشل ${d.failed}` : ""}`);
        setMsgType("ok");
        await loadData();
      }
    } catch {
      setMsg("خطأ في الاتصال");
      setMsgType("err");
    } finally {
      setSending(false);
    }
  }

  async function sendManual(title: string, body: string, url: string) {
    if (!title || !body) return;
    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url: url || "/portal/dashboard" }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setMsg(d.error || d.message || "حدث خطأ");
        setMsgType("err");
      } else {
        setMsg(`تم الإرسال ✓ — وصل لـ ${d.sent}${d.failed > 0 ? ` · فشل ${d.failed}` : ""}`);
        setMsgType("ok");
        await loadData();
      }
    } catch {
      setMsg("خطأ في الاتصال");
      setMsgType("err");
    } finally {
      setSending(false);
    }
  }

  const selected = SEGMENTS.find(s => s.id === activeSegment);

  return (
    <Shell>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell size={20} className="text-accent" />
          إشعارات Push الذكية
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          إرسال إشعارات مخصصة بالاسم — تصل حتى وهم خارج الموقع
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 rounded-xl border border-line/70 bg-panel px-4 py-2.5">
          <Users size={15} className="text-accent" />
          <span className="text-sm font-semibold text-white">
            {subscribers === null ? "—" : subscribers}
          </span>
          <span className="text-xs text-slate-400">مشترك</span>
        </div>
        <button
          onClick={loadData}
          disabled={loadingCounts}
          className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-panel px-3 py-2.5 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={loadingCounts ? "animate-spin" : ""} />
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">

        {/* Segment selector */}
        <div className="xl:col-span-2 rounded-2xl border border-line/70 bg-panel shadow-card p-5">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            اختر الفئة المستهدفة
          </h2>
          <div className="space-y-2">
            {SEGMENTS.map(seg => {
              const count = counts[seg.id] ?? null;
              const isActive = activeSegment === seg.id;
              return (
                <button
                  key={seg.id}
                  onClick={() => selectSegment(seg)}
                  className={`w-full text-right rounded-xl border px-4 py-3 transition-all ${
                    isActive
                      ? "border-accent/50 bg-accent/10"
                      : "border-line/60 bg-panel2 hover:border-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: seg.color }}>
                      {seg.icon}
                      <span className="text-sm font-semibold text-white">{seg.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {loadingCounts ? (
                        <Loader2 size={12} className="animate-spin text-slate-500" />
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${seg.color}20`, color: seg.color }}>
                          {count ?? 0}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 text-right">{seg.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compose panel */}
        <div className="xl:col-span-3 space-y-4">
          <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
            {!activeSegment ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Bell size={24} className="text-accent" />
                </div>
                <p className="text-sm text-slate-400 max-w-xs">
                  اختر فئة من القائمة اليسار لتخصيص الإشعار وإرساله بالاسم
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span style={{ color: selected?.color }}>{selected?.icon}</span>
                  <h2 className="font-semibold text-white">{selected?.label}</h2>
                  <span className="mr-auto text-xs px-2.5 py-1 rounded-full font-bold"
                    style={{ background: `${selected?.color}20`, color: selected?.color }}>
                    {counts[activeSegment] ?? 0} مستخدم
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-400">
                      عنوان الإشعار <span className="text-slate-600">· استخدم {"{"}name{"}"} لاسم المستخدم</span>
                    </label>
                    <input
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-slate-400">نص الإشعار</label>
                    <textarea
                      value={customBody}
                      onChange={e => setCustomBody(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-slate-400">رابط عند الضغط</label>
                    <input
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      dir="ltr"
                      className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
                    />
                  </div>

                  {/* Preview */}
                  {customTitle && customBody && (
                    <div className="rounded-xl border border-line/50 bg-panel2 p-4">
                      <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">معاينة الإشعار</p>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                          <Bell size={14} className="text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {customTitle.replace("{name}", "أحمد")}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{customBody}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg && (
                    <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
                      msgType === "ok"
                        ? "border-white/20 bg-white/5 text-white"
                        : "border-red-500/25 bg-red-950/30 text-red-300"
                    }`}>
                      {msgType === "ok" ? <CheckCircle size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
                      {msg}
                    </div>
                  )}

                  <button
                    onClick={sendSmart}
                    disabled={sending || !customTitle.trim() || !customBody.trim() || (counts[activeSegment] ?? 0) === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending
                      ? <><Loader2 size={14} className="animate-spin" /> جاري الإرسال…</>
                      : <><Send size={14} /> إرسال للفئة ({counts[activeSegment] ?? 0} مستخدم)</>}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Manual broadcast (collapsible) */}
          <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
            <button
              onClick={() => setShowManual(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Send size={14} />
                إرسال يدوي لجميع المشتركين
              </span>
              {showManual ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showManual && <ManualCompose onSend={sendManual} sending={sending} msg={msg} msgType={msgType} subscribers={subscribers} />}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function ManualCompose({ onSend, sending, msg, msgType, subscribers }: {
  onSend: (title: string, body: string, url: string) => void;
  sending: boolean;
  msg: string;
  msgType: "ok" | "err";
  subscribers: number | null;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/portal/dashboard");

  return (
    <div className="px-5 pb-5 border-t border-line/50 pt-4 space-y-3">
      <p className="text-xs text-slate-500">إرسال نفس الرسالة بدون تخصيص — لكل {subscribers ?? 0} مشترك</p>
      <div>
        <label className="mb-1.5 block text-xs text-slate-400">عنوان الإشعار</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="مثال: وظيفة جديدة تناسبك 🔔"
          className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-slate-400">النص</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none resize-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs text-slate-400">الرابط</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          dir="ltr"
          className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
        />
      </div>
      <button
        onClick={() => onSend(title, body, url)}
        disabled={sending || !title.trim() || !body.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-line/60 bg-panel2 py-2.5 text-sm text-slate-300 font-medium hover:text-white transition-colors disabled:opacity-40"
      >
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        بث للجميع
      </button>
    </div>
  );
}
