"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/shell";
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Clock,
  Database, Bot, Mail, Cpu, Users, Briefcase, Send,
  ShoppingCart, MessageCircle, Bell, Key, Zap, Activity,
  TrendingUp, AlertTriangle,
} from "lucide-react";

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
      ran_at: string;
      status: string;
      applied_count: number;
      active_users: number;
      duration_ms: number;
      errors: string[];
    }>;
  };
}

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

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/system-status", { credentials: "include", cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setData(d);
        setLastRefresh(new Date());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => load(), 30000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

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
              onClick={load}
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

        {data && (
          <div className="space-y-6">

            {/* Services */}
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

            {/* Worker Status */}
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

                {/* Worker history */}
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
                        {h.errors.length > 0 && (
                          <span className="text-red-500">• {h.errors.length} خطأ</span>
                        )}
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

            {/* Stats Grid */}
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

            {/* Applications */}
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

            {/* Orders + Support + Push */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Orders */}
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

              {/* Support */}
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

              {/* Push + Users breakdown */}
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

          </div>
        )}
      </div>
    </Shell>
  );
}
