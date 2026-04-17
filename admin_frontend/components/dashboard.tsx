"use client";

import { motion } from "framer-motion";
import { Users, BriefcaseBusiness, Megaphone, Activity, TrendingUp, Clock, Bot, FileText, CheckCircle2, XCircle, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type Summary = {
  stats: {
    jobs_total: number;
    announcements_total: number;
    jobs_active: number;
    announcements_active: number;
  };
  recent_applications: Array<{ user_name: string; job_title: string; applied_at: string }>;
  recent_users: Array<{ name: string; telegram_id: number; created_at: string }>;
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

function StatCard({ label, value, icon: Icon, delay }: { label: string; value: number; icon: React.ElementType; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">{label}</div>
          <div className="text-3xl font-bold text-white">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 border border-white/10">
          <Icon size={20} className="text-slate-300" />
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/api/admin/summary`, { credentials: "include" }),
          fetch(`${API_BASE}/api/admin/bot-status`, { credentials: "include" }),
        ]);
        if (!r1.ok) throw new Error("Unauthorized or API not reachable");
        const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
        setData(j1);
        setBot(j2);
      } catch (e) {
        setError((e as Error).message);
      }
    };
    run();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-950/30 p-5">
        <div className="flex items-center gap-2 text-red-300 font-medium mb-1">
          <span>⚠️</span> فشل تحميل البيانات
        </div>
        <div className="text-sm text-red-300/80">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-500 py-8">
        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
        جاري تحميل البيانات...
      </div>
    );
  }

  const stats = [
    { label: "إجمالي الوظائف", value: data.stats.jobs_total, icon: BriefcaseBusiness },
    { label: "وظائف نشطة", value: data.stats.jobs_active, icon: TrendingUp },
    { label: "إجمالي الإعلانات", value: data.stats.announcements_total, icon: Megaphone },
    { label: "إعلانات نشطة", value: data.stats.announcements_active, icon: Activity },
  ];

  const formatMinutes = (m: number | null) => {
    if (m === null) return "لا توجد بيانات";
    if (m < 60) return `منذ ${m} دقيقة`;
    return `منذ ${Math.floor(m / 60)} ساعة`;
  };

  return (
    <div className="space-y-6">

      {/* ── Bot Status Banner ── */}
      {bot && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className={`rounded-2xl border p-5 ${
            bot.is_active
              ? "border-emerald-500/25 bg-emerald-950/20"
              : "border-red-500/25 bg-red-950/20"
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                bot.is_active ? "bg-emerald-950/50 border-emerald-500/30" : "bg-red-950/50 border-red-500/30"
              }`}>
                <Bot size={20} className={bot.is_active ? "text-emerald-400" : "text-red-400"} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${bot.is_active ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                  <span className={`text-sm font-bold ${bot.is_active ? "text-emerald-300" : "text-red-300"}`}>
                    {bot.is_active ? "البوت يعمل ويقدّم" : "البوت متوقف أو لم يُشغَّل"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {bot.last_application_at
                    ? `آخر تقديم: ${formatMinutes(bot.minutes_since_last)} — ${new Date(bot.last_application_at).toLocaleString("ar")}`
                    : "لا يوجد تقديم مسجّل بعد"}
                </div>
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              {[
                { icon: Zap, label: "تقديمات اليوم", val: bot.apps_today },
                { icon: TrendingUp, label: "إجمالي التقديمات", val: bot.apps_total },
                { icon: Users, label: "المستخدمون", val: bot.users_total },
                { icon: FileText, label: "لديهم CV", val: bot.users_with_cv },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="text-center">
                  <div className="text-xl font-bold text-white">{val}</div>
                  <div className="text-xs text-slate-500">{label}</div>
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
            <Clock size={16} className="text-slate-400" />
            <h3 className="font-semibold text-white text-sm">آخر التقديمات</h3>
          </div>
          <div className="divide-y divide-line">
            {data.recent_applications.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-500 text-center">لا توجد بيانات</div>
            ) : (
              data.recent_applications.map((a, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{a.user_name}</div>
                    <div className="text-xs text-slate-500 truncate">{a.job_title}</div>
                  </div>
                  <div className="text-xs text-slate-600 whitespace-nowrap">{a.applied_at?.slice(0, 16)}</div>
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
            <Users size={16} className="text-slate-400" />
            <h3 className="font-semibold text-white text-sm">أحدث المستخدمين</h3>
          </div>
          <div className="divide-y divide-line">
            {data.recent_users.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-500 text-center">لا توجد بيانات</div>
            ) : (
              data.recent_users.map((u, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.name}</div>
                    <div className="text-xs text-slate-500">ID: {u.telegram_id}</div>
                  </div>
                  <div className="text-xs text-slate-600 whitespace-nowrap">{u.created_at?.slice(0, 10)}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
