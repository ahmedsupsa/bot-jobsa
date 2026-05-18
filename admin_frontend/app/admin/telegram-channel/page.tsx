"use client";

import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/shell";
import {
  Radio, Users, Eye, Send, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, MessageSquare,
} from "lucide-react";

interface StatsData {
  ok: boolean;
  channel_title?: string;
  channel_username?: string;
  subscribers?: number;
  total_posts?: number;
  total_views?: number;
  recent_posts?: Post[];
}

interface Post {
  id: string;
  title_ar: string;
  company?: string;
  application_email?: string;
  tg_message_id?: number;
  tg_views?: number;
  created_at: string;
  source_account?: string;
}

function formatDate(s: string) {
  return new Date(s).toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatCard({ icon: Icon, label, value, color = "blue" }: {
  icon: any; label: string; value: string | number; color?: string;
}) {
  const colors: Record<string, string> = {
    blue:    "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    purple:  "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
    orange:  "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
  };
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={17} />
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export default function TelegramChannelPage() {
  const [stats, setStats]       = useState<StatsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [compose, setCompose]   = useState("");
  const [sending, setSending]   = useState(false);
  const [sendMsg, setSendMsg]   = useState("");
  const [sendOk, setSendOk]     = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/telegram/stats", { credentials: "include", cache: "no-store" });
      setStats(await r.json());
    } catch { setStats(null); }
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const sendPost = async () => {
    if (!compose.trim()) return;
    setSending(true); setSendMsg("");
    try {
      const r = await fetch("/api/admin/telegram/post", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: compose }),
      });
      const d = await r.json();
      if (d.ok) {
        setSendOk(true);
        setSendMsg(`✅ نُشر بنجاح (message_id: ${d.message_id})`);
        setCompose("");
        setTimeout(loadStats, 2000);
      } else {
        setSendOk(false);
        setSendMsg(`❌ ${d.error || "فشل الإرسال"}`);
      }
    } catch (e) {
      setSendOk(false);
      setSendMsg(`❌ ${e}`);
    }
    setSending(false);
  };

  const deletePost = async (msgId: number, jobId: string) => {
    if (!confirm("حذف هذا المنشور من القناة؟")) return;
    setDeleting(jobId);
    try {
      await fetch("/api/admin/telegram/post", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msgId }),
      });
      await loadStats();
    } catch {}
    setDeleting(null);
  };

  const channelUrl = stats?.channel_username
    ? `https://t.me/${stats.channel_username}`
    : null;

  return (
    <Shell>
      <div className="p-4 md:p-6 max-w-5xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio size={20} className="text-blue-500" />
              قناة Telegram — الوظائف
            </h1>
            {stats?.channel_title && (
              <p className="text-sm text-gray-500 mt-0.5">
                {stats.channel_title}
                {channelUrl && (
                  <a href={channelUrl} target="_blank" rel="noreferrer"
                    className="mr-2 text-blue-500 hover:underline text-xs">@{stats.channel_username}</a>
                )}
              </p>
            )}
          </div>
          <button onClick={loadStats} disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> تحديث
          </button>
        </div>

        {loading && !stats && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw size={18} className="animate-spin ml-2" /> جاري التحميل...
          </div>
        )}

        {stats && (
          <div className="space-y-6">
            {/* إحصائيات */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Users}        label="المشتركون"        value={stats.subscribers?.toLocaleString("ar") ?? "—"} color="blue" />
              <StatCard icon={MessageSquare} label="إجمالي المنشورات" value={stats.total_posts ?? 0}                          color="emerald" />
              <StatCard icon={Eye}          label="إجمالي المشاهدات" value={stats.total_views?.toLocaleString("ar") ?? "—"} color="purple" />
              <StatCard icon={Radio}        label="القناة"           value={stats.channel_title ? "✅ متصلة" : "❌ غير متصلة"} color="orange" />
            </div>

            {/* إرسال منشور مخصص */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Send size={14} /> إرسال منشور مخصص للقناة
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                يمكنك استخدام HTML للتنسيق: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">&lt;b&gt;</code> عريض،
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded mr-1">&lt;i&gt;</code> مائل،
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded mr-1">&lt;a href=&quot;...&quot;&gt;</code> رابط
              </p>
              <textarea
                value={compose}
                onChange={e => setCompose(e.target.value)}
                rows={5}
                placeholder="اكتب نص المنشور هنا..."
                className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                dir="auto"
              />
              {sendMsg && (
                <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${sendOk ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700" : "bg-red-50 dark:bg-red-900/20 text-red-600"}`}>
                  {sendMsg}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{compose.length} حرف</span>
                <button
                  onClick={sendPost}
                  disabled={sending || !compose.trim()}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold"
                >
                  <Send size={14} />
                  {sending ? "جاري الإرسال..." : "نشر في القناة"}
                </button>
              </div>
            </div>

            {/* آخر المنشورات */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Eye size={14} /> آخر المنشورات في القناة
              </h2>
              {!stats.recent_posts?.length ? (
                <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  لا توجد منشورات محفوظة بعد
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">الوظيفة</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 hidden sm:table-cell">المصدر</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">المشاهدات</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 hidden md:table-cell">التاريخ</th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {stats.recent_posts.map(post => (
                        <tr key={post.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800 dark:text-gray-100 line-clamp-1">{post.title_ar}</div>
                            {post.company && <div className="text-xs text-gray-500">{post.company}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                            {post.source_account || "يدوي"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                              <Eye size={11} />
                              {(post.tg_views || 0).toLocaleString("ar")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                            {formatDate(post.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {post.tg_message_id && channelUrl && (
                                <a
                                  href={`${channelUrl}/${post.tg_message_id}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-xs text-blue-500 hover:underline"
                                >فتح</a>
                              )}
                              {post.tg_message_id && (
                                <button
                                  onClick={() => deletePost(post.tg_message_id!, post.id)}
                                  disabled={deleting === post.id}
                                  className="p-1 text-red-400 hover:text-red-600 disabled:opacity-40"
                                  title="حذف من القناة"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
