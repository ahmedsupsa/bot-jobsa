"use client";

import { motion } from "framer-motion";
import { Users, BriefcaseBusiness, Megaphone, Activity, TrendingUp, Clock } from "lucide-react";
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-line/70 bg-panel p-5 shadow-card"
    >
      <div className={`absolute left-0 top-0 h-1 w-full ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-400 mb-2">{label}</div>
          <div className="text-3xl font-bold text-white">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.replace("bg-", "bg-").replace("500", "500/15")} border border-current/10`}>
          <Icon size={20} className={color.replace("bg-", "text-").replace("/50", "")} />
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/admin/summary`, { credentials: "include" });
        if (!r.ok) throw new Error("Unauthorized or API not reachable");
        const j = await r.json();
        setData(j);
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
        <div className="mt-2 text-xs text-red-400/60">
          تأكد من تسجيل الدخول وأن Flask Admin يعمل على المنفذ 8080
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-400 py-8">
        <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        جاري تحميل البيانات...
      </div>
    );
  }

  const stats = [
    { label: "إجمالي الوظائف", value: data.stats.jobs_total, icon: BriefcaseBusiness, color: "bg-blue-500" },
    { label: "وظائف نشطة", value: data.stats.jobs_active, icon: TrendingUp, color: "bg-emerald-500" },
    { label: "إجمالي الإعلانات", value: data.stats.announcements_total, icon: Megaphone, color: "bg-violet-500" },
    { label: "إعلانات نشطة", value: data.stats.announcements_active, icon: Activity, color: "bg-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.07} />
        ))}
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recent Applications */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-line/70 bg-panel shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-line/60 px-5 py-4">
            <Clock size={16} className="text-accent" />
            <h3 className="font-semibold text-white">آخر التقديمات</h3>
          </div>
          <div className="divide-y divide-line/40">
            {data.recent_applications.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">لا توجد بيانات</div>
            ) : (
              data.recent_applications.map((a, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{a.user_name}</div>
                    <div className="text-xs text-slate-400 truncate">{a.job_title}</div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">{a.applied_at?.slice(0, 16)}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.37 }}
          className="rounded-2xl border border-line/70 bg-panel shadow-card"
        >
          <div className="flex items-center gap-2 border-b border-line/60 px-5 py-4">
            <Users size={16} className="text-accent" />
            <h3 className="font-semibold text-white">أحدث المستخدمين</h3>
          </div>
          <div className="divide-y divide-line/40">
            {data.recent_users.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">لا توجد بيانات</div>
            ) : (
              data.recent_users.map((u, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.name}</div>
                    <div className="text-xs text-slate-400">ID: {u.telegram_id}</div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">{u.created_at?.slice(0, 10)}</div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
