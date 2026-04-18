"use client";
import { useEffect, useState, useCallback } from "react";
import Shell from "@/components/shell";
import { TrendingUp, DollarSign, Users, Loader2, CheckCircle2 } from "lucide-react";

interface Affiliate {
  user_id: string;
  code: string;
  full_name: string;
  phone: string;
  created_at: string;
  referrals_count: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
}

export default function AffiliateAdminPage() {
  const [list, setList] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/affiliates", { credentials: "include" });
      const j = await r.json();
      if (j.ok) setList(j.affiliates || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (userId: string) => {
    if (!confirm("تأكيد دفع كل العمولات المعلّقة لهذا المسوّق؟")) return;
    setMarking(userId);
    try {
      await fetch("/api/admin/affiliates", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "mark_paid" }),
      });
      await load();
    } catch {}
    setMarking(null);
  };

  const totalPending = list.reduce((s, a) => s + Number(a.pending_earnings || 0), 0);
  const totalPaid = list.reduce((s, a) => s + Number(a.paid_earnings || 0), 0);
  const totalSales = list.reduce((s, a) => s + Number(a.referrals_count || 0), 0);

  return (
    <Shell>
      <div style={{ padding: 4 }}>
        <h1 style={{ margin: "0 0 20px", color: "#fff", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={22} color="#22c55e" /> برنامج الربح — المسوّقون
        </h1>

        {/* Summary */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12, marginBottom: 20,
        }}>
          <SumCard icon={Users} color="#a78bfa" label="عدد المسوّقين" value={String(list.length)} />
          <SumCard icon={TrendingUp} color="#3b82f6" label="إجمالي المبيعات" value={String(totalSales)} />
          <SumCard icon={DollarSign} color="#f59e0b" label="عمولات معلّقة" value={`${totalPending.toFixed(2)} ر.س`} />
          <SumCard icon={CheckCircle2} color="#22c55e" label="عمولات مدفوعة" value={`${totalPaid.toFixed(2)} ر.س`} />
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={24} color="#666" className="animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div style={{
            background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16,
            padding: 60, textAlign: "center", color: "#666",
          }}>
            لا يوجد مسوّقون مسجلون بعد
          </div>
        ) : (
          <div style={{
            background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16,
            overflow: "hidden",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 1fr 1fr 1fr 1fr",
              padding: "12px 16px", borderBottom: "1px solid #1f1f1f",
              background: "#0a0a0a", fontSize: 12, color: "#888", fontWeight: 600,
            }}>
              <span>الاسم</span>
              <span>رقم الجوال</span>
              <span>الكود</span>
              <span>المبيعات</span>
              <span>المعلّقة</span>
              <span>المدفوعة</span>
              <span></span>
            </div>
            {list.map((a) => (
              <div key={a.user_id} style={{
                display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 1fr 1fr 1fr 1fr",
                padding: "14px 16px", borderBottom: "1px solid #181818",
                fontSize: 13, color: "#fff", alignItems: "center",
              }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name || "—"}</span>
                <span style={{ color: "#999", direction: "ltr" }}>{a.phone || "—"}</span>
                <span style={{ color: "#22c55e", fontFamily: "monospace", fontWeight: 700 }}>{a.code}</span>
                <span>{a.referrals_count}</span>
                <span style={{ color: "#fbbf24" }}>{Number(a.pending_earnings).toFixed(2)}</span>
                <span style={{ color: "#3b82f6" }}>{Number(a.paid_earnings).toFixed(2)}</span>
                <span>
                  {a.pending_earnings > 0 && (
                    <button
                      onClick={() => markPaid(a.user_id)}
                      disabled={marking === a.user_id}
                      style={{
                        background: "#22c55e", color: "#000", border: "none",
                        borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                        opacity: marking === a.user_id ? 0.5 : 1,
                      }}
                    >
                      {marking === a.user_id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                      دفع
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function SumCard({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div style={{
      background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 14, padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
