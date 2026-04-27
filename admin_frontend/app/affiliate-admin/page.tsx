"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Shell from "@/components/shell";
import { TrendingUp, DollarSign, Users, Loader2, CheckCircle2, Wallet, X, Upload, Eye, Copy, Check } from "lucide-react";

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

interface Withdrawal {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  amount: number;
  method: "bank" | "wallet";
  bank_name: string | null;
  iban: string | null;
  account_holder: string;
  wallet_provider: string | null;
  wallet_number: string | null;
  status: "pending" | "paid" | "rejected";
  proof_url: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

export default function AffiliateAdminPage() {
  const [tab, setTab] = useState<"affiliates" | "withdrawals">("withdrawals");
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWd, setActiveWd] = useState<Withdrawal | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewProof, setPreviewProof] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/admin/affiliates", { credentials: "include" }),
        fetch("/api/admin/affiliates/withdrawals", { credentials: "include" }),
      ]);
      const j1 = await r1.json();
      const j2 = await r2.json();
      if (j1.ok) setAffiliates(j1.affiliates || []);
      if (j2.ok) setWithdrawals(j2.withdrawals || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const reject = async (id: string) => {
    const reason = prompt("سبب الرفض (اختياري):") ?? null;
    if (reason === null && !confirm("رفض الطلب بدون سبب؟")) return;
    await fetch("/api/admin/affiliates/withdrawals", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withdrawal_id: id, action: "reject", notes: reason }),
    });
    await load();
    setActiveWd(null);
  };

  const uploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeWd) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("withdrawal_id", activeWd.id);
    fd.append("file", file);
    try {
      const r = await fetch("/api/admin/affiliates/withdrawals/proof", {
        method: "POST", credentials: "include", body: fd,
      });
      const j = await r.json();
      if (j.ok) {
        await load();
        setActiveWd(null);
      } else alert(j.error || "فشل الرفع");
    } catch { alert("فشل الرفع"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const pendingWds = withdrawals.filter((w) => w.status === "pending");
  const totalPendingAmount = pendingWds.reduce((s, w) => s + Number(w.amount || 0), 0);

  return (
    <Shell>
      <div style={{ padding: 4 }}>
        <h1 style={{ margin: "0 0 20px", color: "var(--text)", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={22} color="var(--text)" /> برنامج الربح
        </h1>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <SumCard icon={Users} color="#a78bfa" label="عدد المسوّقين" value={String(affiliates.length)} />
          <SumCard icon={Wallet} color="#fbbf24" label="طلبات سحب معلّقة" value={String(pendingWds.length)} />
          <SumCard icon={DollarSign} color="#f59e0b" label="إجمالي المعلّق" value={`${totalPendingAmount.toFixed(2)} ر.س`} />
          <SumCard icon={CheckCircle2} color="var(--text)" label="إجمالي المبيعات" value={String(affiliates.reduce((s, a) => s + Number(a.referrals_count || 0), 0))} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <TabBtn active={tab === "withdrawals"} onClick={() => setTab("withdrawals")}>
            طلبات السحب {pendingWds.length > 0 && <span style={{ background: "var(--text)", color: "var(--bg)", borderRadius: 8, padding: "1px 7px", fontSize: 10, marginInlineStart: 6 }}>{pendingWds.length}</span>}
          </TabBtn>
          <TabBtn active={tab === "affiliates"} onClick={() => setTab("affiliates")}>المسوّقون</TabBtn>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={24} color="var(--text3)" className="animate-spin" />
          </div>
        ) : tab === "withdrawals" ? (
          withdrawals.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 60, textAlign: "center", color: "var(--text3)" }}>
              لا توجد طلبات سحب
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
              {withdrawals.map((w) => (
                <div key={w.id} style={{
                  padding: "14px 18px", borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ margin: 0, color: "var(--text)", fontSize: 14, fontWeight: 600 }}>
                      {w.full_name || "—"} <span style={{ color: "var(--text3)", fontSize: 11, fontWeight: 400 }}>· {w.phone}</span>
                    </p>
                    <p style={{ margin: "3px 0 0", color: "var(--text3)", fontSize: 12 }}>
                      {new Date(w.created_at).toLocaleString("ar-SA")}
                    </p>
                  </div>
                  <p style={{ margin: 0, color: "var(--text)", fontSize: 16, fontWeight: 700 }}>
                    {Number(w.amount).toFixed(2)} ر.س
                  </p>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                    background: w.status === "paid" ? "rgba(34,197,94,0.1)" : w.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    color: w.status === "paid" ? "#22c55e" : w.status === "rejected" ? "#f87171" : "#fbbf24",
                    border: `1px solid ${w.status === "paid" ? "#22c55e33" : w.status === "rejected" ? "#ef444433" : "#f59e0b33"}`,
                  }}>
                    {w.status === "paid" ? "مدفوع" : w.status === "rejected" ? "مرفوض" : "معلّق"}
                  </span>
                  {w.status === "pending" ? (
                    <button onClick={() => setActiveWd(w)} style={{
                      background: "var(--accent)", color: "var(--accent-fg)", border: "none",
                      borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>معالجة</button>
                  ) : w.proof_url ? (
                    <button onClick={() => setPreviewProof(w.proof_url)} style={{
                      background: "var(--surface2)", color: "#3b82f6", border: "1px solid var(--border2)",
                      borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}><Eye size={11} /> الإيصال</button>
                  ) : <span style={{ width: 70 }} />}
                </div>
              ))}
            </div>
          )
        ) : affiliates.length === 0 ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 60, textAlign: "center", color: "var(--text3)" }}>
            لا يوجد مسوّقون مسجلون بعد
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr 1fr 1fr",
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
              background: "var(--bg)", fontSize: 12, color: "var(--text3)", fontWeight: 600,
            }}>
              <span>الاسم</span>
              <span>الجوال</span>
              <span>الكود</span>
              <span>المبيعات</span>
              <span>إجمالي ربح</span>
              <span>المدفوع</span>
            </div>
            {affiliates.map((a) => (
              <div key={a.user_id} style={{
                display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.8fr 1fr 1fr",
                padding: "14px 16px", borderBottom: "1px solid var(--border)",
                fontSize: 13, color: "var(--text)", alignItems: "center",
              }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.full_name || "—"}</span>
                <span style={{ color: "var(--text3)", direction: "ltr" }}>{a.phone || "—"}</span>
                <span style={{ color: "var(--text)", fontFamily: "monospace", fontWeight: 700 }}>{a.code}</span>
                <span>{a.referrals_count}</span>
                <span style={{ color: "#fbbf24" }}>{Number(a.total_earnings).toFixed(2)}</span>
                <span style={{ color: "#3b82f6" }}>{Number(a.paid_earnings).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdrawal Action Modal */}
      {activeWd && (
        <div onClick={() => !uploading && setActiveWd(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16,
            padding: 24, width: "100%", maxWidth: 480,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: "var(--text)", fontSize: 17, fontWeight: 700 }}>طلب سحب</h2>
              <button onClick={() => setActiveWd(null)} disabled={uploading} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><X size={20} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              <Row label="المسوّق" value={activeWd.full_name} />
              <Row label="الجوال" value={activeWd.phone} ltr />
              <Row label="المبلغ" value={`${Number(activeWd.amount).toFixed(2)} ر.س`} highlight />
              <div style={{
                padding: "8px 0", borderBottom: "1px solid var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ color: "var(--text3)", fontSize: 12 }}>طريقة الاستلام</span>
                <span style={{
                  background: activeWd.method === "wallet" ? "rgba(168,139,250,0.1)" : "rgba(59,130,246,0.1)",
                  color: activeWd.method === "wallet" ? "#a78bfa" : "#3b82f6",
                  border: `1px solid ${activeWd.method === "wallet" ? "#a78bfa33" : "#3b82f633"}`,
                  borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                }}>
                  {activeWd.method === "wallet" ? "محفظة رقمية" : "حساب بنكي"}
                </span>
              </div>
              <Row label="اسم الحساب" value={activeWd.account_holder} />

              {activeWd.method === "bank" ? (
                <>
                  <Row label="البنك" value={activeWd.bank_name || "—"} />
                  <CopyRow label="الآيبان" value={activeWd.iban || ""} copied={copiedField === "iban"} onCopy={() => copyText(activeWd.iban || "", "iban")} />
                </>
              ) : (
                <>
                  <Row label="نوع المحفظة" value={activeWd.wallet_provider || "—"} />
                  <CopyRow label="رقم الجوال" value={activeWd.wallet_number || ""} copied={copiedField === "wallet"} onCopy={() => copyText(activeWd.wallet_number || "", "wallet")} />
                </>
              )}
            </div>

            <p style={{ margin: "0 0 10px", color: "#f59e0b", fontSize: 12, lineHeight: 1.6 }}>
              ⚠️ بعد تحويل المبلغ يدوياً للحساب، ارفع صورة إيصال التحويل لإكمال الطلب.
            </p>

            <input ref={fileRef} type="file" accept="image/*" onChange={uploadProof} style={{ display: "none" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => reject(activeWd.id)} disabled={uploading} style={{
                background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid #ef444433",
                borderRadius: 10, padding: "12px 16px", fontSize: 13, fontWeight: 600,
                cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.5 : 1,
              }}>رفض</button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                flex: 1, background: "var(--accent)", color: "var(--accent-fg)", border: "none",
                borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
                cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "جاري الرفع..." : "رفع إيصال + تأكيد الدفع"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewProof && (
        <div onClick={() => setPreviewProof(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <img src={previewProof} alt="إيصال" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12 }} />
        </div>
      )}
    </Shell>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", color: "var(--text3)", fontSize: 11 }}>{label}</p>
      <div style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ flex: 1, color: "var(--text)", fontSize: 13, fontFamily: "monospace", direction: "ltr" }}>{value}</span>
        <button onClick={onCopy} style={{
          background: copied ? "rgba(34,197,94,0.1)" : "var(--surface2)",
          border: `1px solid ${copied ? "#22c55e44" : "var(--border2)"}`,
          color: copied ? "#22c55e" : "var(--text2)",
          borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "تم" : "نسخ"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, ltr, highlight }: { label: string; value: string; ltr?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text3)", fontSize: 12 }}>{label}</span>
      <span style={{ color: "var(--text)", fontSize: highlight ? 16 : 13, fontWeight: highlight ? 700 : 500, direction: ltr ? "ltr" : undefined }}>{value}</span>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", color: active ? "var(--text)" : "var(--text3)",
      borderBottom: `2px solid ${active ? "var(--text)" : "transparent"}`,
      padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
      marginBottom: -1,
    }}>{children}</button>
  );
}

function SumCard({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ color: "var(--text3)", fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ margin: 0, color: "var(--text)", fontSize: 18, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
