"use client";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch } from "@/lib/portal-auth";
import { TrendingUp, Copy, Check, DollarSign, Users, Clock, Loader2, Share2, AlertCircle } from "lucide-react";

interface Referral {
  id: string;
  amount: number;
  commission: number;
  status: "pending" | "paid";
  created_at: string;
}

interface AffiliateData {
  ok: boolean;
  joined: boolean;
  eligible: boolean;
  code?: string;
  total_earnings?: number;
  pending_earnings?: number;
  paid_earnings?: number;
  referrals_count?: number;
  referrals?: Referral[];
  commission_rate: number;
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const r = await portalFetch("/affiliate");
      const j = await r.json();
      if (j.ok) setData(j);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const join = async () => {
    setJoining(true);
    try {
      const r = await portalFetch("/affiliate", { method: "POST" });
      const j = await r.json();
      if (j.ok) await load();
      else alert(j.error || "فشل الانضمام");
    } catch {}
    setJoining(false);
  };

  const link = data?.code ? `https://www.jobbots.org/store?ref=${data.code}` : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Jobbots — التقديم التلقائي على الوظائف",
          text: "وفّر وقتك في البحث عن وظيفة! Jobbots يقدّم لك تلقائياً.",
          url: link,
        });
      } catch {}
    } else copyLink();
  };

  if (loading) {
    return (
      <PortalShell>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={28} color="#666" className="animate-spin" />
        </div>
      </PortalShell>
    );
  }

  // Not joined yet
  if (!data?.joined) {
    return (
      <PortalShell>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 0" }}>
          <div style={{
            background: "linear-gradient(135deg, #0d1f0d 0%, #0a1a0a 100%)",
            border: "1px solid #22c55e33", borderRadius: 20, padding: 32,
            textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: "0 auto 18px",
              background: "rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingUp size={28} color="#22c55e" />
            </div>
            <h1 style={{ margin: "0 0 10px", color: "#fff", fontSize: 22, fontWeight: 700 }}>
              برنامج الربح
            </h1>
            <p style={{ margin: "0 0 20px", color: "#999", fontSize: 14, lineHeight: 1.7 }}>
              اربح <span style={{ color: "#22c55e", fontWeight: 700 }}>10%</span> عمولة من كل اشتراك يتم عبر رابطك الخاص.
              <br />العمولة على كل عملية شراء، حتى لو جدّد العميل اشتراكه لاحقاً.
            </p>

            {!data?.eligible ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, justifyContent: "center",
                background: "#1f1408", border: "1px solid #f59e0b33",
                color: "#fbbf24", padding: "12px 16px", borderRadius: 12,
                fontSize: 13,
              }}>
                <AlertCircle size={16} />
                <span>تحتاج اشتراك نشط للانضمام لبرنامج الربح</span>
              </div>
            ) : (
              <button
                onClick={join}
                disabled={joining}
                style={{
                  background: "#22c55e", color: "#000", border: "none",
                  borderRadius: 12, padding: "12px 28px", fontSize: 15, fontWeight: 700,
                  cursor: joining ? "wait" : "pointer", opacity: joining ? 0.6 : 1,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}
              >
                {joining ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                انضم الآن مجاناً
              </button>
            )}
          </div>
        </div>
      </PortalShell>
    );
  }

  // Joined
  return (
    <PortalShell>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 20px", color: "#fff", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={22} color="#22c55e" /> برنامج الربح
        </h1>

        {/* Stats Cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12, marginBottom: 20,
        }}>
          <StatCard icon={DollarSign} color="#22c55e" label="إجمالي الأرباح" value={`${(data.total_earnings || 0).toFixed(2)} ر.س`} />
          <StatCard icon={Clock} color="#f59e0b" label="معلّقة" value={`${(data.pending_earnings || 0).toFixed(2)} ر.س`} />
          <StatCard icon={Check} color="#3b82f6" label="مدفوعة" value={`${(data.paid_earnings || 0).toFixed(2)} ر.س`} />
          <StatCard icon={Users} color="#a78bfa" label="عدد المبيعات" value={String(data.referrals_count || 0)} />
        </div>

        {/* Referral Link */}
        <div style={{
          background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16,
          padding: 20, marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 12px", color: "#888", fontSize: 13 }}>رابطك الخاص</p>
          <div style={{
            display: "flex", gap: 8, alignItems: "center",
            background: "#070707", border: "1px solid #1f1f1f",
            borderRadius: 10, padding: "10px 14px", marginBottom: 12,
          }}>
            <span style={{ flex: 1, color: "#22c55e", fontSize: 13, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "ltr" }}>
              {link}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyLink} style={{
              flex: 1, background: copied ? "#1f3d1f" : "#1a1a1a",
              border: `1px solid ${copied ? "#22c55e" : "#2a2a2a"}`,
              color: copied ? "#22c55e" : "#fff",
              borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "تم النسخ" : "نسخ الرابط"}
            </button>
            <button onClick={share} style={{
              flex: 1, background: "#22c55e", border: "none", color: "#000",
              borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Share2 size={14} /> شارك الآن
            </button>
          </div>
          <p style={{ margin: "12px 0 0", color: "#666", fontSize: 12, lineHeight: 1.6 }}>
            تربح <span style={{ color: "#22c55e", fontWeight: 700 }}>10%</span> من كل عملية بيع تتم عبر هذا الرابط
          </p>
        </div>

        {/* Referrals List */}
        <div style={{
          background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16,
          overflow: "hidden",
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f1f1f" }}>
            <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>سجل المبيعات</p>
          </div>
          {!data.referrals || data.referrals.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>
              لا توجد مبيعات بعد. شارك رابطك للبدء!
            </div>
          ) : (
            data.referrals.map((r) => (
              <div key={r.id} style={{
                padding: "14px 20px", borderBottom: "1px solid #181818",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                    +{Number(r.commission).toFixed(2)} ر.س
                  </p>
                  <p style={{ margin: "2px 0 0", color: "#666", fontSize: 11 }}>
                    من بيع بقيمة {Number(r.amount).toFixed(2)} ر.س · {new Date(r.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                  background: r.status === "paid" ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)",
                  color: r.status === "paid" ? "#3b82f6" : "#fbbf24",
                  border: `1px solid ${r.status === "paid" ? "#3b82f633" : "#f59e0b33"}`,
                }}>
                  {r.status === "paid" ? "مدفوعة" : "معلّقة"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </PortalShell>
  );
}

function StatCard({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div style={{
      background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 14,
      padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
