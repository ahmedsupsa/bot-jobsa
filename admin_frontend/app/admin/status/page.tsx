"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/shell";
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Clock,
  Database, Bot, Mail, Cpu, Users, Briefcase, Send,
  ShoppingCart, MessageCircle, Bell, Key, Zap, Activity,
  TrendingUp, AlertTriangle, Sparkles, BrainCircuit, Link,
} from "lucide-react";

/* ── Telegram Webhook Panel ────────────────────────────────────────── */
function TelegramWebhookPanel() {
  const [info, setInfo] = useState<{ ok?: boolean; result?: { url?: string; pending_update_count?: number; last_error_message?: string }; expected_url?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const loadInfo = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/telegram/webhook?action=info", { credentials: "include" });
      setInfo(await r.json());
    } catch { setInfo(null); }
    setLoading(false);
  };

  const register = async () => {
    setLoading(true); setMsg("");
    try {
      const r = await fetch("/api/telegram/webhook?action=register", { credentials: "include" });
      const d = await r.json();
      if (d.ok) { setMsg("✅ تم تسجيل الـ Webhook بنجاح"); setMsgType("ok"); await loadInfo(); }
      else { setMsg(`❌ ${d.description || "فشل التسجيل"}`); setMsgType("err"); }
    } catch (e) { setMsg(`❌ ${e}`); setMsgType("err"); }
    setLoading(false);
  };

  const remove = async () => {
    if (!confirm("حذف الـ Webhook؟")) return;
    setLoading(true); setMsg("");
    try {
      const r = await fetch("/api/telegram/webhook?action=delete", { credentials: "include" });
      const d = await r.json();
      setMsg(d.ok ? "🗑️ تم حذف الـ Webhook" : `❌ ${d.description}`);
      setMsgType(d.ok ? "ok" : "err");
      await loadInfo();
    } catch (e) { setMsg(`❌ ${e}`); setMsgType("err"); }
    setLoading(false);
  };

  useEffect(() => { loadInfo(); }, []);

  const currentUrl   = info?.result?.url || "";
  const expectedUrl  = info?.expected_url || "";
  const isRegistered = currentUrl && currentUrl === expectedUrl;
  const isWrong      = currentUrl && currentUrl !== expectedUrl;
  const pendingCount = info?.result?.pending_update_count ?? 0;
  const lastErr      = info?.result?.last_error_message || "";

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <Link size={14} /> Telegram Webhook — قنوات الوظائف
      </h2>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isRegistered ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={11} /> مُسجَّل وشغّال
                </span>
              ) : isWrong ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={11} /> مُسجَّل بـ URL مختلف
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  <XCircle size={11} /> غير مُسجَّل
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">({pendingCount} رسالة معلقة)</span>
              )}
            </div>
            {currentUrl && (
              <div className="text-xs text-gray-400 font-mono truncate max-w-md" title={currentUrl}>{currentUrl}</div>
            )}
            {lastErr && (
              <div className="text-xs text-red-500 mt-1">آخر خطأ: {lastErr}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadInfo} disabled={loading} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1">
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> تحديث
            </button>
            <button onClick={register} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1">
              {isRegistered ? "إعادة تسجيل" : "تسجيل الآن"}
            </button>
            {currentUrl && (
              <button onClick={remove} disabled={loading} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                حذف
              </button>
            )}
          </div>
        </div>

        {msg && (
          <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${msgType === "ok" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
            {msg}
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
          <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">كيفية الاستخدام:</p>
          <p>١. اضغط <b>تسجيل الآن</b> لتفعيل الـ Webhook</p>
          <p>٢. افتح تطبيق Telegram → اذهب لـ <b>@jobbotssa_bot</b></p>
          <p>٣. أضف البوت كمشرف (<b>Admin</b>) في أي قناة وظائف</p>
          <p>٤. كل رسالة وظيفة تنزل في القناة → تُحلَّل تلقائياً وتُضاف للمنصة</p>
        </div>
      </div>
    </div>
  );
}

interface ServiceStatus { ok: boolean; latencyMs?: number; botName?: string; error?: string }
interface StatusData {
  ok: boolean;
  checked_at: string;
  services: {
    supabase: ServiceStatus;
    telegram: ServiceStatus;
    resend: ServiceStatus;
    gemini: ServiceStatus;
  };
  users: { total: number; active: number; with_cv: number; with_smtp: number; with_prefs: number };
  jobs: { total: number; active: number };
  applications: { today: number; week: number; total: number; last_at: string | null; last_minutes_ago: number | null };
  orders: { total: number; paid: number; pending: number; failed: number };
  support: { unread: number };
  push: { subscriptions: number };
  codes: { total: number; used: number; available: number };
  worker: {
    last_ran_at: string | null;
    last_minutes_ago: number | null;
    last_status: string | null;
    last_applied: number;
    last_users: number;
    last_duration_ms: number;
    last_errors: string[];
    history: Array<{
      ran_at: string; status: string; applied_count: number;
      active_users: number; duration_ms: number; errors: string[];
    }>;
  };
}

interface ModelResult {
  id: string; label: string; priority: number;
  ok: boolean; latencyMs?: number; status?: number; error?: string; quota?: boolean;
}
interface AiStatusData {
  ok: boolean; key_set: boolean;
  active_model: string | null; active_model_label: string | null; active_latency_ms: number | null;
  models: ModelResult[];
  features: Array<{ key: string; label: string; route: string }>;
  features_ok: boolean;
  checked_at: string;
}

/* ── Badges ───────────────────────────────────────────────────── */
function StatusBadge({ ok, label, error }: { ok: boolean; label?: string; error?: string }) {
  if (ok) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
      <CheckCircle2 size={11} /> {label || "يعمل"}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full" title={error}>
      <XCircle size={11} /> {label || "خطأ"}
    </span>
  );
}

function WorkerBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">لم يُشغَّل</span>;
  const map: Record<string, { color: string; label: string; icon: any }> = {
    success: { color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30", label: "ناجح", icon: CheckCircle2 },
    partial: { color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30", label: "جزئي", icon: AlertCircle },
    error:   { color: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30",     label: "فشل",  icon: XCircle },
  };
  const s = map[status] || map.error;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
      <Icon size={11} /> {s.label}
    </span>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */
function formatAgo(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "منذ أقل من دقيقة";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Cards ────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color = "blue", alert = false }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; alert?: boolean;
}) {
  const colors: Record<string, string> = {
    blue:    "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
    red:     "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    purple:  "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    gray:    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}><Icon size={16} /></div>
        {alert && <AlertTriangle size={14} className="text-red-500 mt-1" />}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function ServiceCard({ icon: Icon, label, status, extra }: { icon: any; label: string; status: ServiceStatus; extra?: string }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${status.ok ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"}`}>
      <div className={`p-2.5 rounded-xl ${status.ok ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-red-100 dark:bg-red-900/30 text-red-500"}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {status.ok
            ? (status.botName ? `@${status.botName}` : status.latencyMs ? `${status.latencyMs}ms` : extra || "متصل")
            : (status.error || "خطأ في الاتصال")}
        </div>
      </div>
      <StatusBadge ok={status.ok} />
    </div>
  );
}

/* ── Gemini AI Panel ──────────────────────────────────────────── */
function ModelRow({ m, isActive }: { m: ModelResult; isActive: boolean }) {
  let badge: React.ReactNode;
  if (m.ok) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={10} /> يعمل {m.latencyMs ? `(${m.latencyMs}ms)` : ""}
      </span>
    );
  } else if (m.quota) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
        <AlertCircle size={10} /> تجاوز الحصة (429)
      </span>
    );
  } else if (m.status === 404) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
        <XCircle size={10} /> غير متاح
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full" title={m.error}>
        <XCircle size={10} /> خطأ
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isActive ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" : "bg-gray-50 dark:bg-gray-700/40"}`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.ok ? "bg-emerald-500" : m.quota ? "bg-amber-400" : "bg-gray-300 dark:bg-gray-600"}`} />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-gray-800 dark:text-gray-100">{m.label}</span>
        {isActive && <span className="mr-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">← نشط</span>}
      </div>
      {badge}
    </div>
  );
}

function AiPanel({ ai, loading }: { ai: AiStatusData | null; loading: boolean }) {
  if (loading && !ai) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
        <RefreshCw size={14} className="animate-spin" /> جاري فحص الذكاء الاصطناعي...
      </div>
    );
  }
  if (!ai) return null;

  const FEATURES_AR: Record<string, string> = {
    cv_parse:    "تحليل السيرة الذاتية",
    cover_letter:"رسالة التغطية (Worker)",
    job_spec:    "تخصصات الوظائف",
    job_bulk:    "رفع وظائف Excel",
    job_fetch:   "استيراد وظائف تلقائي",
  };

  return (
    <div className={`rounded-xl border p-4 ${ai.ok ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" : "border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${ai.ok ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "bg-red-100 dark:bg-red-900/30 text-red-500"}`}>
            <BrainCircuit size={18} />
          </div>
          <div>
            <div className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              Gemini AI
              {!ai.key_set && (
                <span className="text-xs font-normal text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                  المفتاح غير مضبوط
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {ai.ok
                ? `النموذج النشط: ${ai.active_model_label} • ${ai.active_latency_ms}ms`
                : ai.key_set ? "جميع النماذج معطّلة حالياً" : "GEMINI_API_KEY غير موجود"}
            </div>
          </div>
        </div>
        <StatusBadge ok={ai.ok} label={ai.ok ? "يعمل" : "معطّل"} />
      </div>

      {/* Alert if all broken */}
      {!ai.ok && ai.key_set && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            الذكاء الاصطناعي <strong>لا يعمل</strong> — المزايا التالية ستفشل:
            رسائل التغطية، تحليل السيرة الذاتية، تخصصات الوظائف.
            تحقق من رصيد Gemini أو تجاوز الحصة (429).
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Models */}
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> النماذج المتاحة (fallback chain)
          </div>
          <div className="space-y-1.5">
            {ai.models.map(m => (
              <ModelRow key={m.id} m={m} isActive={m.id === ai.active_model} />
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
            <Zap size={11} /> المزايا التي تعتمد على الذكاء الاصطناعي
          </div>
          <div className="space-y-1.5">
            {ai.features.map(f => (
              <div key={f.key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-xs">
                <span className="text-gray-700 dark:text-gray-200">{FEATURES_AR[f.key] || f.label}</span>
                <StatusBadge ok={ai.features_ok} label={ai.features_ok ? "جاهزة" : "معطّلة"} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-left" dir="ltr">
        Last checked: {ai.checked_at ? new Date(ai.checked_at).toLocaleTimeString("ar-SA") : "—"}
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [ai, setAi] = useState<AiStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMain = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/system-status", { credentials: "include", cache: "no-store" });
      if (r.ok) { setData(await r.json()); setLastRefresh(new Date()); }
    } catch {}
  }, []);

  const loadAi = useCallback(async () => {
    setAiLoading(true);
    try {
      const r = await fetch("/api/admin/ai-status", { credentials: "include", cache: "no-store" });
      if (r.ok) setAi(await r.json());
    } catch {}
    setAiLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadMain(), loadAi()]);
    setLoading(false);
  }, [loadMain, loadAi]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => { loadMain(); }, 30000);
    const t2 = setInterval(() => { loadAi(); }, 60000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, [autoRefresh, loadMain, loadAi]);

  const workerHealthy = data?.worker.last_minutes_ago !== null && (data?.worker.last_minutes_ago ?? 999) < 90;
  const workerOverdue = data?.worker.last_minutes_ago !== null && (data?.worker.last_minutes_ago ?? 0) >= 90;

  return (
    <Shell>
      <div className="p-4 md:p-6 max-w-6xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity size={20} className="text-blue-500" />
              حالة النظام
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {lastRefresh ? `آخر تحديث: ${lastRefresh.toLocaleTimeString("ar-SA")}` : "جاري التحميل..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${autoRefresh ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-700 text-gray-500"}`}
            >
              {autoRefresh ? "تجديد تلقائي: شغّال" : "تجديد تلقائي: إيقاف"}
            </button>
            <button
              onClick={loadAll}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              تحديث
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw size={20} className="animate-spin ml-2" /> جاري فحص النظام...
          </div>
        )}

        {(data || ai) && (
          <div className="space-y-6">

            {/* Services */}
            {data && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Zap size={14} /> الخدمات الخارجية
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <ServiceCard icon={Database} label="Supabase" status={data.services.supabase} />
                  <ServiceCard icon={Bot} label="بوت التيليجرام" status={data.services.telegram} />
                  <ServiceCard icon={Mail} label="Resend (إيميلات)" status={data.services.resend} />
                  <ServiceCard icon={Cpu} label="Gemini AI" status={data.services.gemini} />
                </div>
              </div>
            )}

            {/* ── Gemini AI Deep Status ── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <BrainCircuit size={14} /> الذكاء الاصطناعي — تفاصيل كاملة
              </h2>
              <AiPanel ai={ai} loading={aiLoading} />
            </div>

            {/* Worker Status */}
            {data && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Bot size={14} /> Worker التقديم التلقائي
                </h2>
                <div className={`rounded-xl border p-4 ${workerOverdue ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${workerHealthy ? "bg-emerald-100 dark:bg-emerald-900/30" : workerOverdue ? "bg-red-100 dark:bg-red-900/30" : "bg-gray-100 dark:bg-gray-700"}`}>
                        <Bot size={18} className={workerHealthy ? "text-emerald-600" : workerOverdue ? "text-red-500" : "text-gray-400"} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                          آخر تشغيل: {formatAgo(data.worker.last_minutes_ago)}
                        </div>
                        <div className="text-xs text-gray-500">{formatTime(data.worker.last_ran_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <WorkerBadge status={data.worker.last_status} />
                      {workerOverdue && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> متأخر
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{data.worker.last_applied}</div>
                      <div className="text-xs text-gray-500">تقديمات آخر دورة</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{data.worker.last_users}</div>
                      <div className="text-xs text-gray-500">مستخدمون مستفيدون</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{Math.round((data.worker.last_duration_ms || 0) / 1000)}ث</div>
                      <div className="text-xs text-gray-500">مدة الدورة</div>
                    </div>
                  </div>

                  {data.worker.last_errors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
                      <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={12} /> أخطاء آخر دورة ({data.worker.last_errors.length})
                      </div>
                      <div className="space-y-1">
                        {data.worker.last_errors.slice(0, 5).map((e, i) => (
                          <div key={i} className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-900/20 px-2 py-1 rounded break-all">{e}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-2">آخر 5 دورات</div>
                    <div className="space-y-1.5">
                      {data.worker.history.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-400 w-32 shrink-0">{formatTime(h.ran_at)}</span>
                          <WorkerBadge status={h.status} />
                          <span className="text-gray-600 dark:text-gray-300">
                            {h.applied_count} تقديم • {h.active_users} مستخدم
                          </span>
                          {h.errors.length > 0 && <span className="text-red-500">• {h.errors.length} خطأ</span>}
                          <span className="text-gray-400 mr-auto">{Math.round((h.duration_ms || 0) / 1000)}ث</span>
                        </div>
                      ))}
                      {data.worker.history.length === 0 && (
                        <div className="text-xs text-gray-400">لا يوجد سجل تشغيل بعد</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            {data && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <TrendingUp size={14} /> إحصائيات عامة
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard icon={Users} label="إجمالي المستخدمين" value={data.users.total} color="blue" />
                  <StatCard icon={Users} label="مستخدمون نشطون" value={data.users.active} color="emerald" />
                  <StatCard icon={Users} label="لديهم CV" value={data.users.with_cv} color="purple" />
                  <StatCard icon={Mail} label="ربطوا SMTP" value={data.users.with_smtp}
                    color={data.users.with_smtp === 0 ? "red" : "emerald"}
                    alert={data.users.with_smtp === 0} />
                  <StatCard icon={Briefcase} label="وظائف نشطة" value={data.jobs.active} sub={`من ${data.jobs.total} إجمالي`} color="blue" />
                  <StatCard icon={Key} label="أكواد متاحة" value={data.codes.available} sub={`${data.codes.used} مُستخدم`} color={data.codes.available < 5 ? "red" : "gray"} alert={data.codes.available < 5} />
                </div>
              </div>
            )}

            {/* Applications */}
            {data && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Send size={14} /> التقديمات
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard icon={Send} label="اليوم" value={data.applications.today} color="emerald" />
                  <StatCard icon={Send} label="هذا الأسبوع" value={data.applications.week} color="blue" />
                  <StatCard icon={Send} label="الإجمالي" value={data.applications.total} color="purple" />
                  <StatCard icon={Clock} label="آخر تقديم" value={formatAgo(data.applications.last_minutes_ago)} color="gray" />
                </div>
              </div>
            )}

            {/* Telegram Webhook */}
            <TelegramWebhookPanel />

            {/* Orders + Support + Push */}
            {data && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <ShoppingCart size={14} /> الطلبات
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "مدفوعة", value: data.orders.paid, color: "text-emerald-600 dark:text-emerald-400" },
                      { label: "بانتظار التأكيد", value: data.orders.pending, color: data.orders.pending > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-gray-600 dark:text-gray-300" },
                      { label: "فاشلة", value: data.orders.failed, color: "text-red-500 dark:text-red-400" },
                      { label: "الإجمالي", value: data.orders.total, color: "text-gray-700 dark:text-gray-200" },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                        <span className={row.color}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {data.orders.pending > 0 && (
                    <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2 py-1.5 flex items-center gap-1">
                      <AlertTriangle size={11} /> {data.orders.pending} طلب بانتظار تأكيد يدوي
                    </div>
                  )}
                </div>

                <div className={`rounded-xl border p-4 ${data.support.unread > 0 ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"}`}>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <MessageCircle size={14} /> الدعم الفني
                  </div>
                  <div className="text-4xl font-bold mb-1" style={{ color: data.support.unread > 0 ? "#f97316" : undefined }}>
                    {data.support.unread}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">رسائل غير مقروءة</div>
                  {data.support.unread > 0 && (
                    <a href="/support-admin" className="mt-3 text-xs text-orange-600 dark:text-orange-400 underline block">
                      فتح الدعم الفني ←
                    </a>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Bell size={14} /> تفاصيل المستخدمين
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "لديهم تفضيلات وظيفية", value: data.users.with_prefs },
                      { label: "ربطوا SMTP (جاهزون)", value: data.users.with_smtp },
                      { label: "رفعوا CV", value: data.users.with_cv },
                      { label: "مشتركو Push", value: data.push.subscriptions },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </Shell>
  );
}
