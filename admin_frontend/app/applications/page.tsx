"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Send, XCircle, AlertCircle, RefreshCw, Building2,
  Clock, Filter, ChevronRight, Loader2,
  CheckCircle2, BrainCircuit, ListFilter, Calendar, Mail,
} from "lucide-react";

type Application = {
  id: string;
  user_id: string;
  job_id: string;
  job_title: string;
  job_title_display: string;
  company: string;
  user_name: string;
  status: "sent" | "skipped" | "error";
  match_score: number | null;
  skip_reason: string | null;
  decision_reasons: string[] | null;
  missing_skills: string[] | null;
  matched_skills: string[] | null;
  error_reason: string | null;
  applied_at: string;
  is_today: boolean;
};

type Stats = {
  total: number; sent: number; skipped: number; error: number;
  today_sent: number; today_skipped: number;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent")    return <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full"><Send className="w-3 h-3" />أُرسل</span>;
  if (status === "skipped") return <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />تجاوز</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" />خطأ</span>;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>;
  const color = score >= 70 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return <span className={`text-sm font-bold ${color}`}>{score}%</span>;
}

export default function ApplicationsPage() {
  const [apps, setApps]     = useState<Application[]>([]);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "sent" | "skipped" | "error">("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("today");
  const [reportSending, setReportSending] = useState(false);
  const [reportMsg, setReportMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const sendReport = async () => {
    setReportSending(true);
    setReportMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/internal/weekly-report`, { method: "GET", credentials: "include" });
      const j = await r.json();
      if (j.ok) {
        setReportMsg({ ok: true, text: `✅ أُرسل التقرير إلى ${j.sentTo} — ${j.stats?.totalSent || 0} تقديم، ${j.stats?.totalSkipped || 0} متجاوز` });
      } else {
        setReportMsg({ ok: false, text: j.error || "فشل الإرسال" });
      }
    } catch (e) {
      setReportMsg({ ok: false, text: String(e) });
    } finally {
      setReportSending(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const dateFrom = dateFilter === "today" ? today.toISOString().split("T")[0]
                     : dateFilter === "week"  ? weekAgo.toISOString().split("T")[0]
                     : "";
      const params = new URLSearchParams({ limit: "300" });
      if (dateFrom) params.set("date_from", dateFrom);
      const r = await fetch(`${API_BASE}/api/admin/applications?${params}`, { credentials: "include" });
      const j = await r.json();
      setApps(j.applications || []);
      setStats(j.stats || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFilter]);

  const filtered = useMemo(() => {
    let list = apps;
    if (filter !== "all") list = list.filter(a => a.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a =>
        a.user_name.toLowerCase().includes(q) ||
        a.job_title_display.toLowerCase().includes(q) ||
        (a.company || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [apps, filter, search]);

  return (
    <Shell>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BrainCircuit className="w-7 h-7 text-indigo-500" />
              مراقبة التقديمات
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              جميع قرارات البوت — التقديم والرفض — مع الأسباب الحقيقية
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={sendReport} disabled={reportSending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg transition">
              {reportSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              إرسال التقرير الأسبوعي
            </button>
            <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* Report feedback */}
        {reportMsg && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${reportMsg.ok ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"}`}>
            {reportMsg.text}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.today_sent}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1"><Send className="w-3 h-3" />تقديمات اليوم</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.today_skipped}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1"><XCircle className="w-3 h-3" />متجاوزة اليوم</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.sent}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />إجمالي أُرسل</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{stats.total}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1"><ListFilter className="w-3 h-3" />إجمالي السجلات</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            {(["today", "week", "all"] as const).map(d => (
              <button key={d} onClick={() => setDateFilter(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${dateFilter === d ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                {d === "today" ? "اليوم" : d === "week" ? "أسبوع" : "الكل"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            {(["all", "sent", "skipped", "error"] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${filter === s ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                {s === "all" ? "الكل" : s === "sent" ? "أُرسل" : s === "skipped" ? "متجاوز" : "خطأ"}
              </button>
            ))}
          </div>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المستخدم أو الوظيفة..."
            className="flex-1 min-w-[180px] px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin ml-2" />
              جاري التحميل...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">لا توجد سجلات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">المستخدم</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">الوظيفة</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">الشركة</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">الحالة</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">التطابق</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">السبب</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">الوقت</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {filtered.map(app => (
                    <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                      <td className="py-3 px-4">
                        <Link href={`/applications/${app.user_id}`} className="flex items-center gap-2 group">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold flex-shrink-0">
                            {app.user_name[0] || "؟"}
                          </div>
                          <span className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate max-w-[120px]">
                            {app.user_name}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 max-w-[180px]">
                        <span className="truncate block">{app.job_title_display}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 max-w-[120px]">
                        <span className="truncate block">{app.company || "—"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="py-3 px-4">
                        <ScoreBadge score={app.match_score} />
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        {app.status === "skipped" && app.skip_reason && (
                          <span className="text-xs text-amber-700 dark:text-amber-400 line-clamp-2">{app.skip_reason}</span>
                        )}
                        {app.status === "sent" && app.matched_skills && app.matched_skills.length > 0 && (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 line-clamp-1">
                            ✓ {app.matched_skills.slice(0, 2).join("، ")}
                          </span>
                        )}
                        {app.status === "error" && app.error_reason && (
                          <span className="text-xs text-red-600 dark:text-red-400 line-clamp-1">{app.error_reason.slice(0, 60)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {fmtTime(app.applied_at)}
                        </div>
                        {app.is_today && <span className="text-indigo-500 dark:text-indigo-400 text-xs">اليوم</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/applications/${app.user_id}`} className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            عرض {filtered.length} من {apps.length} سجل
          </p>
        )}
      </div>
    </Shell>
  );
}
