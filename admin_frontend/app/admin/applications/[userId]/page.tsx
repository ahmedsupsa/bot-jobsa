"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, Send, XCircle, AlertCircle, User, FileText,
  CheckCircle2, Sparkles, Clock, Building2, Brain,
  ChevronDown, ChevronUp, Loader2, BadgeCheck, AlertTriangle,
} from "lucide-react";

type App = {
  id: string;
  job_id: string;
  job_title_display: string;
  company: string;
  application_email: string;
  status: "sent" | "skipped" | "error";
  match_score: number | null;
  skip_reason: string | null;
  decision_reasons: string[] | null;
  missing_skills: string[] | null;
  matched_skills: string[] | null;
  error_reason: string | null;
  applied_at: string;
  provider_used: string | null;
};

type UserDetail = {
  user: { id: string; full_name: string; phone: string; subscription_ends_at: string | null; created_at: string } | null;
  settings: { email: string | null; smtp_email: string | null; email_connected: boolean; application_language: string } | null;
  cv: { file_name: string; cv_parsed_text: string | null; cv_parsed_at: string | null } | null;
  preferences: string[];
  applications: App[];
  stats: { total: number; sent: number; skipped: number; error: number; today_sent: number; today_skipped: number };
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-sm">—</span>;
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const text  = score >= 70 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-bold w-10 text-right ${text}`}>{score}%</span>
    </div>
  );
}

function DecisionCard({ app }: { app: App }) {
  const [open, setOpen] = useState(false);
  const isSent    = app.status === "sent";
  const isSkipped = app.status === "skipped";
  const isError   = app.status === "error";

  const borderColor = isSent ? "border-emerald-200 dark:border-emerald-800" : isSkipped ? "border-amber-200 dark:border-amber-800" : "border-red-200 dark:border-red-800";
  const bgColor     = isSent ? "bg-emerald-50/50 dark:bg-emerald-900/10" : isSkipped ? "bg-amber-50/50 dark:bg-amber-900/10" : "bg-red-50/50 dark:bg-red-900/10";

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isSent    && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              {isSkipped && <XCircle      className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              {isError   && <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0" />}
              <span className="font-medium text-gray-800 dark:text-gray-200">{app.job_title_display}</span>
              {app.company && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{app.company}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <ScoreBar score={app.match_score} />
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />{fmtDate(app.applied_at)}
              </span>
            </div>
          </div>
          <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-1 transition">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Skip reason summary */}
        {isSkipped && app.skip_reason && (
          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-lg px-3 py-2">
            {app.skip_reason}
          </div>
        )}
        {isError && app.error_reason && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg px-3 py-2">
            {app.error_reason.slice(0, 200)}
          </div>
        )}
      </div>

      {/* Expandable Decision Details */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" />
            تفاصيل قرار الـ AI
          </h4>

          {/* Decision reasons */}
          {app.decision_reasons && app.decision_reasons.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">أسباب القرار:</p>
              <ul className="space-y-1">
                {app.decision_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0">{isSent ? "✅" : "⚠️"}</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Matched skills */}
            {app.matched_skills && app.matched_skills.length > 0 && (
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 font-medium flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  المهارات المطابقة في السيرة
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {app.matched_skills.map((s, i) => (
                    <span key={i} className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing skills */}
            {app.missing_skills && app.missing_skills.length > 0 && (
              <div>
                <p className="text-xs text-red-600 dark:text-red-400 mb-2 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  المتطلبات الناقصة
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {app.missing_skills.map((s, i) => (
                    <span key={i} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isSent && (
            <div className="text-xs text-gray-400">
              أُرسل عبر: {app.provider_used || "smtp"} • {app.application_email}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserApplicationsPage() {
  const params  = useParams();
  const userId  = params.userId as string;
  const [data, setData]     = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cvOpen, setCvOpen] = useState(false);
  const [tab, setTab]       = useState<"sent" | "skipped" | "all">("all");

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/applications/${userId}`, { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin ml-2" />جاري التحميل...
        </div>
      </Shell>
    );
  }

  if (!data || !data.user) {
    return (
      <Shell>
        <div className="p-6 text-center text-gray-500">لم يُعثر على المستخدم</div>
      </Shell>
    );
  }

  const { user, settings, cv, preferences, applications, stats } = data;
  const filteredApps = tab === "all" ? applications : applications.filter(a => a.status === tab);

  return (
    <Shell>
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto" dir="rtl">
        {/* Back */}
        <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
          <ArrowRight className="w-4 h-4" />
          العودة لمراقبة التقديمات
        </Link>

        {/* User Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-bold flex-shrink-0">
              {user.full_name?.[0] || "؟"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{user.full_name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
                {user.phone && <span>{user.phone}</span>}
                {settings?.smtp_email && <span>📧 {settings.smtp_email}</span>}
                {preferences.length > 0 && <span>🎯 {preferences.join("، ")}</span>}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4">
            {[
              { label: "أُرسل اليوم",   val: stats.today_sent,    color: "text-emerald-600 dark:text-emerald-400" },
              { label: "متجاوز اليوم",  val: stats.today_skipped, color: "text-amber-600 dark:text-amber-400" },
              { label: "إجمالي أُرسل",  val: stats.sent,          color: "text-gray-800 dark:text-gray-200" },
              { label: "إجمالي متجاوز", val: stats.skipped,       color: "text-gray-800 dark:text-gray-200" },
              { label: "أخطاء",          val: stats.error,         color: "text-red-600 dark:text-red-400" },
              { label: "المجموع",        val: stats.total,         color: "text-gray-800 dark:text-gray-200" },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center">
                <div className={`text-xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CV Section */}
        {cv?.cv_parsed_text && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button onClick={() => setCvOpen(o => !o)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition">
              <div className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200">
                <FileText className="w-4 h-4 text-indigo-500" />
                المهارات المستخرجة من السيرة الذاتية
                {cv.file_name && <span className="text-xs text-gray-400">({cv.file_name})</span>}
              </div>
              {cvOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {cvOpen && (
              <div className="px-5 pb-5">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed font-mono text-xs">
                  {cv.cv_parsed_text}
                </div>
                {cv.cv_parsed_at && (
                  <p className="text-xs text-gray-400 mt-2">آخر تحليل: {fmtDate(cv.cv_parsed_at)}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Applications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              سجل قرارات البوت
            </h2>
            <div className="flex gap-2">
              {(["all", "sent", "skipped"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${tab === t ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                  {t === "all" ? `الكل (${stats.total})` : t === "sent" ? `أُرسل (${stats.sent})` : `متجاوز (${stats.skipped})`}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {filteredApps.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">لا توجد سجلات</div>
            ) : (
              filteredApps.map(app => <DecisionCard key={app.id} app={app} />)
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
