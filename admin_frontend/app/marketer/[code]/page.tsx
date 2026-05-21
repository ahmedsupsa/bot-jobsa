"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  TrendingUp, ShoppingCart, Clock, CheckCircle2,
  Copy, Check, Link2, RefreshCw, DollarSign,
  Calendar, User, ChevronDown,
} from "lucide-react";

type MarketerInfo = {
  name: string;
  code: string;
  commission_type: "percent" | "fixed";
  commission_value: number;
  member_since: string;
};

type Stats = {
  sales_count: number;
  total_earned: number;
  pending_earned: number;
  paid_earned: number;
};

type Sale = {
  id: string;
  order_amount: number;
  commission_earned: number;
  status: "pending" | "paid";
  customer_name?: string | null;
  created_at: string;
  paid_at?: string | null;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleDateString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MarketerPortalPage() {
  const params = useParams();
  const code = (params?.code as string || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marketer, setMarketer] = useState<MarketerInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    fetch(`/api/marketer/${code}`)
      .then(r => r.json())
      .then(j => {
        if (!j.ok) { setError(j.error || "حدث خطأ"); return; }
        setMarketer(j.marketer);
        setStats(j.stats);
        setSales(j.sales || []);
      })
      .catch(() => setError("تعذّر الاتصال بالخادم"))
      .finally(() => setLoading(false));
  }, [code]);

  const refLink = `https://jobbots.org/store?ref=${code}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(refLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const displayedSales = showAll ? sales : sales.slice(0, 5);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg, #f4f4f5)" }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={28} className="animate-spin" style={{ color: "var(--text3, #888)" }} />
          <p style={{ color: "var(--text3, #888)", fontSize: 14 }}>جاري التحميل…</p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !marketer || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg, #f4f4f5)" }}>
        <div className="w-full max-w-sm rounded-2xl border p-8 text-center" style={{ background: "var(--surface, #fff)", borderColor: "var(--border, #e4e4e7)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--danger-bg, #fef2f2)" }}>
            <TrendingUp size={24} style={{ color: "var(--danger, #b91c1c)" }} />
          </div>
          <h1 className="font-bold text-lg mb-1" style={{ color: "var(--text, #000)", fontFamily: "Tajawal, sans-serif" }}>
            {error || "الصفحة غير موجودة"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text3, #888)", fontFamily: "Tajawal, sans-serif" }}>
            تحقق من الرابط أو تواصل مع الإدارة
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen pb-12"
      style={{ background: "var(--bg, #f4f4f5)", fontFamily: "Tajawal, sans-serif" }}
    >
      {/* ── Hero header ── */}
      <div
        className="px-4 pt-10 pb-8"
        style={{
          background: "linear-gradient(135deg, #09090b 0%, #1a1a2e 60%, #16213e 100%)",
        }}
      >
        <div className="max-w-lg mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
              <TrendingUp size={16} style={{ color: "#fff" }} />
            </div>
            <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>Jobbots</span>
          </div>

          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              {marketer.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "#fff" }}>{marketer.name}</h1>
              <p className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                <Calendar size={11} />
                عضو منذ {fmt(marketer.member_since)}
              </p>
            </div>
          </div>

          {/* Commission badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <DollarSign size={13} />
            عمولتك: {marketer.commission_type === "percent"
              ? `${marketer.commission_value}% من كل عملية بيع`
              : `${marketer.commission_value} ر.س ثابتة لكل عملية`}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: ShoppingCart,
              label: "إجمالي المبيعات",
              value: String(stats.sales_count),
              sub: "عملية بيع",
              color: "#3b82f6",
              bg: "rgba(59,130,246,0.08)",
              border: "rgba(59,130,246,0.2)",
            },
            {
              icon: TrendingUp,
              label: "إجمالي العمولات",
              value: `${stats.total_earned.toFixed(2)}`,
              sub: "ريال سعودي",
              color: "#8b5cf6",
              bg: "rgba(139,92,246,0.08)",
              border: "rgba(139,92,246,0.2)",
            },
            {
              icon: Clock,
              label: "معلّقة (قيد الصرف)",
              value: `${stats.pending_earned.toFixed(2)}`,
              sub: "ريال سعودي",
              color: "#f59e0b",
              bg: "rgba(245,158,11,0.08)",
              border: "rgba(245,158,11,0.2)",
            },
            {
              icon: CheckCircle2,
              label: "مدفوعة لك",
              value: `${stats.paid_earned.toFixed(2)}`,
              sub: "ريال سعودي",
              color: "#10b981",
              bg: "rgba(16,185,129,0.08)",
              border: "rgba(16,185,129,0.2)",
            },
          ].map(({ icon: Icon, label, value, sub, color, bg, border }) => (
            <div
              key={label}
              className="rounded-2xl p-4"
              style={{ background: "var(--surface, #fff)", border: `1px solid var(--border, #e4e4e7)` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg, border: `1px solid ${border}` }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <span className="text-xs" style={{ color: "var(--text3, #888)" }}>{label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--text, #000)" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text3, #888)" }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Referral Link ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e4e7)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={15} style={{ color: "var(--text3, #888)" }} />
            <h2 className="font-bold text-sm" style={{ color: "var(--text, #000)" }}>رابط الإحالة الخاص بك</h2>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text3, #888)" }}>
            شارك هذا الرابط مع الآخرين — كل عملية شراء عبره تُحتسب لك عمولة
          </p>

          <div
            className="flex items-center gap-2 rounded-xl p-3 mb-3"
            style={{ background: "var(--bg, #f4f4f5)", border: "1px solid var(--border, #e4e4e7)" }}
          >
            <span className="flex-1 text-xs font-mono truncate" style={{ color: "var(--text2, #111)" }} dir="ltr">
              {refLink}
            </span>
          </div>

          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
            style={{
              background: copied ? "rgba(16,185,129,0.1)" : "var(--text, #09090b)",
              color: copied ? "#10b981" : "var(--bg2, #fff)",
              border: copied ? "1px solid rgba(16,185,129,0.3)" : "none",
            }}
          >
            {copied ? <><Check size={14} />تم النسخ!</> : <><Copy size={14} />نسخ رابط الإحالة</>}
          </button>
        </div>

        {/* ── Sales list ── */}
        <div
          className="rounded-2xl"
          style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #e4e4e7)" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border, #e4e4e7)" }}>
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} style={{ color: "var(--text3, #888)" }} />
              <h2 className="font-bold text-sm" style={{ color: "var(--text, #000)" }}>
                المبيعات ({stats.sales_count})
              </h2>
            </div>
            {stats.pending_earned > 0 && (
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                {stats.pending_earned.toFixed(2)} ر.س معلّقة
              </span>
            )}
          </div>

          {sales.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart size={28} className="mx-auto mb-3" style={{ color: "var(--border2, #d4d4d8)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text3, #888)" }}>لا توجد مبيعات بعد</p>
              <p className="text-xs mt-1" style={{ color: "var(--text4, #aaa)" }}>شارك رابطك لتبدأ بكسب العمولات</p>
            </div>
          ) : (
            <>
              <div className="divide-y" style={{ borderColor: "var(--border, #e4e4e7)" }}>
                {displayedSales.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-4">
                    {/* Index */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ background: "var(--bg, #f4f4f5)", color: "var(--text3, #888)" }}
                    >
                      {i + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.customer_name && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text2, #111)" }}>
                            <User size={10} />
                            {s.customer_name}
                          </span>
                        )}
                        <span
                          className="rounded-full border px-2 py-0.5 text-xs font-medium"
                          style={s.status === "paid"
                            ? { background: "rgba(16,185,129,0.08)", color: "#10b981", borderColor: "rgba(16,185,129,0.2)" }
                            : { background: "rgba(245,158,11,0.08)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.2)" }
                          }
                        >
                          {s.status === "paid" ? "✓ مدفوع" : "قيد الصرف"}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text4, #aaa)" }}>
                        {fmtTime(s.created_at)}
                        {s.status === "paid" && s.paid_at && (
                          <span> · صُرفت {fmt(s.paid_at)}</span>
                        )}
                      </p>
                    </div>

                    {/* Amounts */}
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold" style={{ color: "var(--text, #000)" }}>
                        {Number(s.order_amount).toFixed(0)} ر.س
                      </p>
                      <p className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                        +{Number(s.commission_earned).toFixed(2)} عمولة
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {sales.length > 5 && !showAll && (
                <div className="px-5 pb-4 pt-2">
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all"
                    style={{
                      background: "var(--bg, #f4f4f5)",
                      color: "var(--text2, #111)",
                      border: "1px solid var(--border, #e4e4e7)",
                    }}
                  >
                    <ChevronDown size={14} />
                    عرض كل المبيعات ({sales.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer note ── */}
        <p className="text-center text-xs pb-4" style={{ color: "var(--text4, #aaa)" }}>
          للاستفسار عن عمولاتك تواصل مع فريق Jobbots
        </p>
      </div>
    </div>
  );
}
