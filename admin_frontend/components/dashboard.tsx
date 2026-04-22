"use client";

import { motion } from "framer-motion";
import {
  Users, BriefcaseBusiness, TrendingUp, Clock, Wallet, ShoppingBag,
  Bot, FileText, Zap, AlertTriangle, CheckCircle2, RefreshCw, Timer, XCircle
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "@/lib/api";

type Summary = {
  stats: {
    jobs_total: number;
    jobs_active: number;
    total_revenue: number;
    paid_orders: number;
    pending_orders: number;
  };
  recent_applications: Array<{ user_name: string; job_title: string; applied_at: string }>;
  recent_users: Array<{ name: string; created_at: string }>;
};

type BotStatus = {
  is_active: boolean;
  minutes_since_last: number | null;
  last_application_at: string | null;
  apps_today: number;
  apps_total: number;
  users_total: number;
  users_with_cv: number;
};

type WorkerLog = {
  id: number;
  ran_at: string;
  applied_count: number;
  active_users: number;
  errors: string[];
  duration_ms: number;
  status: "success" | "partial" | "error";
};

function StatCard({ label, value, icon: Icon, delay, sub }: { label: string; value: number | string; icon: React.ElementType; delay: number; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-card"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted2 mb-2">{label}</div>
          <div className="text-3xl font-bold text-ink truncate">{value}</div>
          {sub && <div className="text-[11px] text-muted2 mt-1.5 truncate">{sub}</div>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel2 border border-line shrink-0">
          <Icon size={20} className="text-ink2" />
        </div>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-panel2 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-ink">
      <CheckCircle2 size={10} /> ناجح
    </span>
  );
  if (status === "partial") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-950/60 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
      <AlertTriangle size={10} /> جزئي
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg border border-danger-border px-2 py-0.5 text-[10px] font-medium text-danger">
      <XCircle size={10} /> خطأ
    </span>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [logs, setLogs] = useState<WorkerLog[]>([]);
  const [error, setError] = useState("");
  const [triggeringWorker, setTriggeringWorker] = useState(false);
  const [workerMsg, setWorkerMsg] = useState("");
  const [workerMsgType, setWorkerMsgType] = useState<"ok"|"err">("ok");
  const [runDetails, setRunDetails] = useState<Array<{user:string;job:string;to_email:string;status:"sent"|"skipped"|"error";reason?:string}>>([]);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API_BASE}/api/admin/summary`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/bot-status`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/worker-logs`, { credentials: "include" }),
      ]);
      if (!r1.ok) throw new Error("Unauthorized or API not reachable");
      const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      setData(j1);
      setBot(j2);
      setLogs(j3.logs || []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const triggerWorker = async () => {
    setTriggeringWorker(true);
    setWorkerMsg("");
    setRunDetails([]);
    try {
      const r = await fetch(`${API_BASE}/api/admin/trigger-worker`, {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json();
      if (j.ok) {
        setWorkerMsg(`اكتمل: ${j.applied} تقديم أُرسل — ${j.users} مستخدم نشط — ${j.duration_ms}ms`);
        setWorkerMsgType("ok");
        setRunDetails(j.details || []);
      } else {
        setWorkerMsg(`فشل: ${j.error || "خطأ غير معروف"}`);
        setWorkerMsgType("err");
      }
      await loadData();
    } catch (e) {
      setWorkerMsg(`فشل الاتصال: ${e}`);
      setWorkerMsgType("err");
    } finally {
      setTriggeringWorker(false);
    }
  };

  const formatMinutes = (m: number | null) => {
    if (m === null) return "لا توجد بيانات";
    if (m < 60) return `منذ ${m} دقيقة`;
    return `منذ ${Math.floor(m / 60)} ساعة`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const errorsOnly = logs.filter((l) => l.errors?.length > 0);

  if (error) {
    return (
      <div className="rounded-2xl border border-danger-border bg-danger-bg p-5">
        <div className="flex items-center gap-2 text-danger font-medium mb-1">
          <span>⚠️</span> فشل تحميل البيانات
        </div>
        <div className="text-sm text-danger">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted2 py-8">
        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
        جاري تحميل البيانات...
      </div>
    );
  }

  const fmtMoney = (n: number) =>
    `${n.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;

  const stats = [
    { label: "إجمالي الوظائف", value: data.stats.jobs_total, icon: BriefcaseBusiness },
    { label: "وظائف نشطة", value: data.stats.jobs_active, icon: TrendingUp },
    { label: "إجمالي المبيعات", value: fmtMoney(data.stats.total_revenue), icon: Wallet, sub: `${data.stats.paid_orders} طلب مدفوع` },
    { label: "طلبات بانتظار التأكيد", value: data.stats.pending_orders, icon: ShoppingBag, sub: "حوالات بنكية تحتاج مراجعة" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Worker Status Banner ── */}
      {bot && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className={`rounded-2xl border p-5 ${
            bot.is_active
              ? "border-emerald-500/25 bg-panel2"
              : "border-amber-500/25 bg-amber-950/20"
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                bot.is_active ? "bg-panel2 border-emerald-500/30" : "bg-amber-950/50 border-amber-500/30"
              }`}>
                <Bot size={20} className={bot.is_active ? "text-ink" : "text-amber-400"} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${bot.is_active ? "bg-ink animate-pulse" : "bg-muted"}`} />
                  <span className={`text-sm font-bold ${bot.is_active ? "text-ink" : "text-amber-300"}`}>
                    {bot.is_active ? "Worker يعمل وآخر تقديم حديث" : "Worker لم يقدّم منذ فترة"}
                  </span>
                </div>
                <div className="text-xs text-muted2 mt-1">
                  {bot.last_application_at
                    ? `آخر تقديم: ${formatMinutes(bot.minutes_since_last)} — ${new Date(bot.last_application_at).toLocaleString("ar")}`
                    : "لا يوجد تقديم مسجّل بعد"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {[
                { icon: Zap, label: "تقديمات اليوم", val: bot.apps_today },
                { icon: TrendingUp, label: "إجمالي التقديمات", val: bot.apps_total },
                { icon: Users, label: "المستخدمون", val: bot.users_total },
                { icon: FileText, label: "لديهم CV", val: bot.users_with_cv },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-bold text-ink">{val}</div>
                  <div className="text-xs text-muted2">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={(i + 1) * 0.07} />
        ))}
      </div>

      {/* ── Worker Monitoring ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="rounded-2xl border border-line bg-panel shadow-card overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-muted" />
            <h3 className="font-semibold text-ink text-sm">سجل تشغيل الـ Worker</h3>
            <span className="text-xs text-muted">(آخر {Math.min(logs.length, 7)} دورة)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerWorker}
              disabled={triggeringWorker}
              className="flex items-center gap-1.5 rounded-lg bg-panel2 border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-panel2 transition disabled:opacity-50"
            >
              <RefreshCw size={12} className={triggeringWorker ? "animate-spin" : ""} />
              {triggeringWorker ? "يشتغل..." : "تشغيل الآن"}
            </button>
          </div>
        </div>

        {/* Live run results */}
        {triggeringWorker && (
          <div className="px-5 py-4 border-b border-line flex items-center gap-3">
            <RefreshCw size={14} className="animate-spin text-accent" />
            <span className="text-sm text-ink2">Worker يشتغل... قد يستغرق بضع ثوانٍ</span>
          </div>
        )}
        {!triggeringWorker && workerMsg && (
          <div className={`px-5 py-3 border-b border-line text-xs font-medium ${
            workerMsgType === "ok" ? "text-ink bg-panel2" : "text-danger bg-danger-bg"
          }`}>{workerMsg}</div>
        )}
        {!triggeringWorker && runDetails.length > 0 && (
          <div className="border-b border-line">
            <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted2">
              تفاصيل آخر تشغيل ({runDetails.filter(d => d.status === "sent").length} أُرسل / {runDetails.filter(d => d.status === "skipped").length} تخطّى / {runDetails.filter(d => d.status === "error").length} خطأ)
            </div>
            <div className="divide-y divide-line/40 max-h-64 overflow-y-auto">
              {runDetails.map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5 hover:bg-panel2">
                  {d.status === "sent" ? (
                    <CheckCircle2 size={13} className="text-ink shrink-0" />
                  ) : d.status === "error" ? (
                    <XCircle size={13} className="text-danger shrink-0" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-ink">{d.user}</span>
                      <span className="text-[10px] text-muted2">→</span>
                      <span className="text-xs text-ink2">{d.job}</span>
                      {d.status === "sent" && (
                        <span className="text-[10px] text-muted2">→ {d.to_email}</span>
                      )}
                    </div>
                    {d.reason && (
                      <div className="text-[10px] text-muted mt-0.5">{d.reason}</div>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md border ${
                    d.status === "sent"
                      ? "border-emerald-500/25 bg-panel2 text-ink"
                      : d.status === "error"
                      ? "border-danger-border bg-danger-bg text-danger"
                      : "border-slate-700 bg-slate-900 text-muted2"
                  }`}>
                    {d.status === "sent" ? "أُرسل" : d.status === "error" ? "خطأ" : "تخطّى"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted2">
            لا توجد دورات مسجّلة بعد — سيظهر السجل بعد أول تشغيل للـ Worker
          </div>
        ) : (
          <div className="divide-y divide-line">
            {logs.slice(0, 7).map((log) => (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-panel2 transition text-right"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={log.status} />
                    <div className="min-w-0">
                      <div className="text-xs text-muted">
                        {new Date(log.ran_at).toLocaleString("ar-SA")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <div className="text-sm font-bold text-ink">{log.applied_count}</div>
                      <div className="text-[10px] text-muted">تقديم</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-ink">{log.active_users}</div>
                      <div className="text-[10px] text-muted">مستخدم</div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Timer size={11} />
                      {formatDuration(log.duration_ms)}
                    </div>
                    {log.errors?.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-danger">
                        <AlertTriangle size={11} />
                        {log.errors.length}
                      </div>
                    )}
                  </div>
                </button>
                {expandedLog === log.id && log.errors?.length > 0 && (
                  <div className="border-t border-line bg-danger-bg px-5 py-3">
                    <div className="text-xs font-medium text-danger mb-2">الأخطاء:</div>
                    <div className="space-y-1">
                      {log.errors.map((err, i) => (
                        <div key={i} className="text-xs text-danger bg-danger-bg rounded px-3 py-1.5 font-mono break-all">
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Errors Summary ── */}
      {errorsOnly.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="rounded-2xl border border-danger-border bg-danger-bg shadow-card overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-danger-border px-5 py-4">
            <AlertTriangle size={16} className="text-danger" />
            <h3 className="font-semibold text-danger text-sm">الأخطاء التشغيلية الأخيرة</h3>
            <span className="text-xs text-danger">({errorsOnly.reduce((s, l) => s + l.errors.length, 0)} خطأ)</span>
          </div>
          <div className="divide-y divide-red-500/10">
            {errorsOnly.slice(0, 5).map((log) => (
              <div key={log.id} className="px-5 py-3">
                <div className="text-[10px] text-danger mb-2">
                  {new Date(log.ran_at).toLocaleString("ar-SA")}
                </div>
                <div className="space-y-1">
                  {log.errors.map((err, i) => (
                    <div key={i} className="text-xs text-danger font-mono bg-danger-bg rounded px-3 py-1.5 break-all">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recent Applications */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-line bg-panel shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Clock size={16} className="text-muted" />
            <h3 className="font-semibold text-ink text-sm">آخر التقديمات</h3>
          </div>
          <div className="divide-y divide-line">
            {data.recent_applications.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted2 text-center">لا توجد بيانات</div>
            ) : (
              data.recent_applications.slice(0, 7).map((a, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{a.user_name}</div>
                    <div className="text-xs text-muted2 truncate">{a.job_title}</div>
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap">{a.applied_at?.slice(0, 16)}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          className="rounded-2xl border border-line bg-panel shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Users size={16} className="text-muted" />
            <h3 className="font-semibold text-ink text-sm">أحدث المستخدمين</h3>
          </div>
          <div className="divide-y divide-line">
            {data.recent_users.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted2 text-center">لا توجد بيانات</div>
            ) : (
              data.recent_users.slice(0, 7).map((u, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{u.name}</div>
                  </div>
                  <div className="text-xs text-muted whitespace-nowrap">{u.created_at?.slice(0, 10)}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
