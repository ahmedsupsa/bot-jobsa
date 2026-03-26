"use client";

import { motion } from "framer-motion";
import { Users, BriefcaseBusiness, Megaphone, Activity } from "lucide-react";
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

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/admin/summary`, {
          credentials: "include",
        });
        if (!r.ok) {
          throw new Error("Unauthorized or API not reachable");
        }
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
      <div className="rounded-xl border border-red-400/30 bg-red-950/40 p-4 text-sm text-red-200">
        فشل تحميل البيانات: {error}
        <div className="mt-2 text-xs text-red-300/80">
          تأكد أنك مسجّل دخول في خدمة Flask وأن NEXT_PUBLIC_ADMIN_API_BASE صحيح.
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-300">جاري تحميل البيانات...</div>;
  }

  const cards = [
    { k: "إجمالي الوظائف", v: data.stats.jobs_total, icon: BriefcaseBusiness },
    { k: "إجمالي الإعلانات", v: data.stats.announcements_total, icon: Megaphone },
    { k: "وظائف نشطة", v: data.stats.jobs_active, icon: Activity },
    { k: "إعلانات نشطة", v: data.stats.announcements_active, icon: Users },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.k}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-line/70 bg-panel/80 p-4 shadow-glow"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">{c.k}</div>
              <c.icon size={16} className="text-sky-300" />
            </div>
            <div className="mt-2 text-2xl font-bold">{c.v}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h3 className="mb-3 text-lg font-semibold">آخر التقديمات</h3>
          <div className="space-y-2 text-sm">
            {data.recent_applications.map((a, i) => (
              <div key={`${a.user_name}-${i}`} className="rounded-lg border border-line/40 bg-slate-950/30 p-2">
                <div className="font-medium">{a.user_name}</div>
                <div className="text-slate-300">{a.job_title}</div>
                <div className="text-xs text-slate-400">{a.applied_at}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h3 className="mb-3 text-lg font-semibold">أحدث المستخدمين</h3>
          <div className="space-y-2 text-sm">
            {data.recent_users.map((u, i) => (
              <div key={`${u.telegram_id}-${i}`} className="rounded-lg border border-line/40 bg-slate-950/30 p-2">
                <div className="font-medium">{u.name}</div>
                <div className="text-slate-300">ID: {u.telegram_id}</div>
                <div className="text-xs text-slate-400">{u.created_at}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
