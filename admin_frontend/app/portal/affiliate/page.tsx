"use client";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch } from "@/lib/portal-auth";
import { TrendingUp, Copy, Check, Users, Clock, Loader2, Share2, AlertCircle, Building2, Wallet, X, Eye, Smartphone, AlertTriangle } from "lucide-react";

type Method = "bank" | "wallet";

interface Referral {
  id: string;
  amount: number;
  commission: number;
  status: "pending" | "paid";
  withdrawal_id: string | null;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  proof_url: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

interface AffiliateData {
  ok: boolean;
  joined: boolean;
  eligible: boolean;
  code?: string;
  payout_method?: Method | "";
  bank_name?: string;
  iban?: string;
  account_holder?: string;
  wallet_provider?: string;
  wallet_number?: string;
  user_full_name?: string;
  total_earnings?: number;
  available_balance?: number;
  requested_balance?: number;
  paid_earnings?: number;
  referrals_count?: number;
  referrals?: Referral[];
  withdrawals?: Withdrawal[];
  commission_rate: number;
  min_withdraw: number;
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [accMethod, setAccMethod] = useState<Method>("bank");
  const [bankForm, setBankForm] = useState({ bank_name: "", iban: "", account_holder: "" });
  const [walletForm, setWalletForm] = useState({ wallet_provider: "", wallet_number: "", account_holder: "" });
  const [savingAcc, setSavingAcc] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [previewProof, setPreviewProof] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await portalFetch("/affiliate");
      const j = await r.json();
      if (j.ok) {
        setData(j);
        setAccMethod((j.payout_method as Method) || "bank");
        setBankForm({
          bank_name: j.bank_name || "",
          iban: j.iban || "",
          account_holder: j.account_holder || j.user_full_name || "",
        });
        setWalletForm({
          wallet_provider: j.wallet_provider || "",
          wallet_number: j.wallet_number || "",
          account_holder: j.account_holder || j.user_full_name || "",
        });
      }
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

  const saveAccount = async () => {
    setSavingAcc(true);
    try {
      const body = accMethod === "bank"
        ? { payout_method: "bank", ...bankForm }
        : { payout_method: "wallet", ...walletForm };
      const r = await portalFetch("/affiliate/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        await load();
        setShowAccount(false);
      } else alert(j.error || "فشل الحفظ");
    } catch {}
    setSavingAcc(false);
  };

  const requestWithdraw = async () => {
    if (!confirm(`تأكيد طلب سحب ${(data?.available_balance || 0).toFixed(2)} ريال؟`)) return;
    setWithdrawing(true);
    try {
      const r = await portalFetch("/affiliate/withdraw", { method: "POST" });
      const j = await r.json();
      if (j.ok) { alert("تم إرسال طلب السحب بنجاح. سيتم التحويل قريباً."); await load(); }
      else alert(j.error || "فشل طلب السحب");
    } catch {}
    setWithdrawing(false);
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

  if (!data?.joined) {
    return (
      <PortalShell>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 0" }}>
          <div style={{
            background: "linear-gradient(135deg, #0d1f0d 0%, #0a1a0a 100%)",
            border: "1px solid #22c55e33", borderRadius: 20, padding: 32, textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: "0 auto 18px",
              background: "rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingUp size={28} color="#22c55e" />
            </div>
            <h1 style={{ margin: "0 0 10px", color: "#fff", fontSize: 22, fontWeight: 700 }}>برنامج الربح</h1>
            <p style={{ margin: "0 0 20px", color: "#999", fontSize: 14, lineHeight: 1.7 }}>
              اربح <span style={{ color: "#22c55e", fontWeight: 700 }}>10%</span> عمولة من كل اشتراك يتم عبر رابطك الخاص.
              <br />العمولة على كل عملية شراء، حتى لو جدّد العميل اشتراكه لاحقاً.
            </p>
            {!data?.eligible ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, justifyContent: "center",
                background: "#1f1408", border: "1px solid #f59e0b33",
                color: "#fbbf24", padding: "12px 16px", borderRadius: 12, fontSize: 13,
              }}>
                <AlertCircle size={16} />
                <span>تحتاج اشتراك نشط للانضمام لبرنامج الربح</span>
              </div>
            ) : (
              <button onClick={join} disabled={joining} style={{
                background: "#22c55e", color: "#000", border: "none",
                borderRadius: 12, padding: "12px 28px", fontSize: 15, fontWeight: 700,
                cursor: joining ? "wait" : "pointer", opacity: joining ? 0.6 : 1,
                display: "inline-flex", alignItems: "center", gap: 8,
              }}>
                {joining ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
                انضم الآن مجاناً
              </button>
            )}
          </div>
        </div>
      </PortalShell>
    );
  }

  const hasAccount = !!data.payout_method && !!data.account_holder;
  const canWithdraw = hasAccount && (data.available_balance || 0) >= (data.min_withdraw || 20);

  return (
    <PortalShell>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 20px", color: "#fff", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={22} color="#22c55e" /> برنامج الربح
        </h1>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12, marginBottom: 20,
        }}>
          <StatCard icon={Wallet} color="#22c55e" label="رصيد متاح" value={`${(data.available_balance || 0).toFixed(2)} ر.س`} />
          <StatCard icon={Clock} color="#f59e0b" label="قيد التحويل" value={`${(data.requested_balance || 0).toFixed(2)} ر.س`} />
          <StatCard icon={Check} color="#3b82f6" label="مدفوعة" value={`${(data.paid_earnings || 0).toFixed(2)} ر.س`} />
          <StatCard icon={Users} color="#a78bfa" label="عدد المبيعات" value={String(data.referrals_count || 0)} />
        </div>

        {/* Withdraw Card */}
        <div style={{
          background: "linear-gradient(135deg, #0d1f0d 0%, #0a1a0a 100%)",
          border: "1px solid #22c55e33", borderRadius: 16,
          padding: 18, marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                {canWithdraw ? "جاهز للسحب!" : `الحد الأدنى للسحب: ${data.min_withdraw} ريال`}
              </p>
              <p style={{ margin: "4px 0 0", color: "#888", fontSize: 12 }}>
                {!hasAccount
                  ? "أضف بيانات الحساب البنكي أو المحفظة الرقمية أولاً"
                  : !canWithdraw
                  ? `تحتاج ${((data.min_withdraw || 20) - (data.available_balance || 0)).toFixed(2)} ر.س إضافية`
                  : data.payout_method === "bank"
                  ? `سيتم التحويل إلى: ${data.bank_name} · ${data.iban?.slice(0, 8)}...`
                  : `سيتم التحويل إلى: ${data.wallet_provider} · ${data.wallet_number}`}
              </p>
            </div>
            <button onClick={() => setShowAccount(true)} style={{
              background: hasAccount ? "#1a1a1a" : "#22c55e",
              color: hasAccount ? "#fff" : "#000",
              border: hasAccount ? "1px solid #2a2a2a" : "none",
              borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {data.payout_method === "wallet" ? <Smartphone size={14} /> : <Building2 size={14} />}
              {hasAccount ? "تعديل الحساب" : "إضافة حساب"}
            </button>
            {canWithdraw && (
              <button onClick={requestWithdraw} disabled={withdrawing} style={{
                background: "#22c55e", color: "#000", border: "none",
                borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                opacity: withdrawing ? 0.5 : 1,
              }}>
                {withdrawing ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                طلب سحب
              </button>
            )}
          </div>

          {/* Important warning */}
          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: "rgba(239,68,68,0.08)", border: "1px solid #ef444433",
            borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, color: "#fca5a5", fontSize: 12, lineHeight: 1.6 }}>
              <strong>تنبيه مهم:</strong> لن يتم تحويل أي مبلغ إلى حساب باسم مختلف عن اسم المشترك المسجّل
              {data.user_full_name ? ` (${data.user_full_name})` : ""}. تأكد أن اسم صاحب الحساب مطابق تماماً.
            </p>
          </div>
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
        </div>

        {/* Withdrawals History */}
        {data.withdrawals && data.withdrawals.length > 0 && (
          <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f1f1f" }}>
              <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>طلبات السحب</p>
            </div>
            {data.withdrawals.map((w) => (
              <div key={w.id} style={{
                padding: "14px 20px", borderBottom: "1px solid #181818",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
              }}>
                <div>
                  <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>{Number(w.amount).toFixed(2)} ر.س</p>
                  <p style={{ margin: "2px 0 0", color: "#666", fontSize: 11 }}>{new Date(w.created_at).toLocaleString("ar-SA")}</p>
                  {w.notes && <p style={{ margin: "4px 0 0", color: "#f87171", fontSize: 11 }}>{w.notes}</p>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {w.proof_url && (
                    <button onClick={() => setPreviewProof(w.proof_url!)} style={{
                      background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#3b82f6",
                      borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                      <Eye size={11} /> إيصال التحويل
                    </button>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                    background: w.status === "paid" ? "rgba(34,197,94,0.1)" : w.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    color: w.status === "paid" ? "#22c55e" : w.status === "rejected" ? "#f87171" : "#fbbf24",
                    border: `1px solid ${w.status === "paid" ? "#22c55e33" : w.status === "rejected" ? "#ef444433" : "#f59e0b33"}`,
                  }}>
                    {w.status === "paid" ? "تم التحويل" : w.status === "rejected" ? "مرفوض" : "قيد المعالجة"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sales Log */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #1f1f1f" }}>
            <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>سجل المبيعات</p>
          </div>
          {!data.referrals || data.referrals.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>لا توجد مبيعات بعد. شارك رابطك للبدء!</div>
          ) : (
            data.referrals.map((r) => (
              <div key={r.id} style={{
                padding: "14px 20px", borderBottom: "1px solid #181818",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>+{Number(r.commission).toFixed(2)} ر.س</p>
                  <p style={{ margin: "2px 0 0", color: "#666", fontSize: 11 }}>
                    من بيع بقيمة {Number(r.amount).toFixed(2)} ر.س · {new Date(r.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
                  background: r.status === "paid" ? "rgba(34,197,94,0.1)" : r.withdrawal_id ? "rgba(245,158,11,0.1)" : "rgba(168,139,250,0.1)",
                  color: r.status === "paid" ? "#22c55e" : r.withdrawal_id ? "#fbbf24" : "#a78bfa",
                  border: `1px solid ${r.status === "paid" ? "#22c55e33" : r.withdrawal_id ? "#f59e0b33" : "#a78bfa33"}`,
                }}>
                  {r.status === "paid" ? "مدفوعة" : r.withdrawal_id ? "قيد التحويل" : "متاحة"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Account Modal */}
      {showAccount && (
        <div onClick={() => setShowAccount(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 16,
            padding: 24, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: "#fff", fontSize: 17, fontWeight: 700 }}>طريقة استلام الأرباح</h2>
              <button onClick={() => setShowAccount(false)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Method Toggle */}
            <div className="payout-method-toggle" style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18,
              background: "#070707", border: "1px solid #1f1f1f", borderRadius: 12, padding: 4,
            }}>
              <MethodBtn active={accMethod === "bank"} onClick={() => setAccMethod("bank")} icon={Building2} label="حساب بنكي" />
              <MethodBtn active={accMethod === "wallet"} onClick={() => setAccMethod("wallet")} icon={Smartphone} label="محفظة رقمية" />
            </div>

            {/* Warning */}
            <div style={{
              padding: "10px 12px", marginBottom: 14,
              background: "rgba(239,68,68,0.08)", border: "1px solid #ef444433",
              borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, color: "#fca5a5", fontSize: 12, lineHeight: 1.6 }}>
                لن يتم تحويل أي مبلغ إلى حساب باسم مختلف عن اسم المشترك
                {data.user_full_name ? ` (${data.user_full_name})` : ""}.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {accMethod === "bank" ? (
                <>
                  <Input label="اسم البنك" value={bankForm.bank_name} onChange={(v) => setBankForm({ ...bankForm, bank_name: v })} placeholder="مثلاً: الراجحي" />
                  <Input label="اسم صاحب الحساب" value={bankForm.account_holder} onChange={(v) => setBankForm({ ...bankForm, account_holder: v })} placeholder="الاسم الكامل" />
                  <Input label="رقم الآيبان (IBAN)" value={bankForm.iban} onChange={(v) => setBankForm({ ...bankForm, iban: v })} placeholder="SA0000000000000000000000" mono />
                </>
              ) : (
                <>
                  <Input label="اسم المحفظة" value={walletForm.wallet_provider} onChange={(v) => setWalletForm({ ...walletForm, wallet_provider: v })} placeholder="مثلاً: STC Pay، urpay، باي بال..." />
                  <Input label="اسم صاحب الحساب" value={walletForm.account_holder} onChange={(v) => setWalletForm({ ...walletForm, account_holder: v })} placeholder="الاسم الكامل" />
                  <Input label="رقم الجوال المسجّل" value={walletForm.wallet_number} onChange={(v) => setWalletForm({ ...walletForm, wallet_number: v })} placeholder="05XXXXXXXX" mono />
                </>
              )}

              <button onClick={saveAccount} disabled={savingAcc} style={{
                background: "#22c55e", color: "#000", border: "none",
                borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", marginTop: 8, opacity: savingAcc ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {savingAcc && <Loader2 size={14} className="animate-spin" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 380px) {
          .payout-method-toggle { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {previewProof && (
        <div onClick={() => setPreviewProof(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <img src={previewProof} alt="إيصال" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12 }} />
        </div>
      )}
    </PortalShell>
  );
}

function MethodBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#22c55e" : "transparent",
      color: active ? "#000" : "#888",
      border: "none", borderRadius: 8, padding: "10px",
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>
      <Icon size={14} /> {label}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label style={{ display: "block", color: "#888", fontSize: 12, marginBottom: 6 }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: "#070707", border: "1px solid #1f1f1f",
          borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14,
          fontFamily: mono ? "monospace" : "inherit",
          direction: mono ? "ltr" : undefined,
          outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid #1f1f1f", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ color: "#888", fontSize: 12 }}>{label}</span>
      </div>
      <p style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
