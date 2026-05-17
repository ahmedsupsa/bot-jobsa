"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken } from "@/lib/portal-auth";
import { Gift, Wallet, Building2, RefreshCw, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock } from "lucide-react";

interface SpinRecord {
  id: string;
  amount: number;
  status: "pending" | "withdrawn";
  spun_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: "pending" | "paid" | "rejected";
  admin_notes: string | null;
  proof_url: string | null;
  created_at: string;
  processed_at: string | null;
}

interface RewardData {
  ok: boolean;
  pending_spins: number;
  available_balance: number;
  subscription_active: boolean;
  spins: SpinRecord[];
  withdrawals: Withdrawal[];
}

// ─── جدول جوائز العجلة (يطابق الـ backend) ────────────────────────────────────
const SEGMENTS = [
  { amount: 0.05,  label: "5 هللات",  color: "#6366f1" },
  { amount: 0.10,  label: "10 هللات", color: "#8b5cf6" },
  { amount: 0.25,  label: "25 هللات", color: "#06b6d4" },
  { amount: 0.50,  label: "50 هللات", color: "#10b981" },
  { amount: 1.00,  label: "1 ريال",   color: "#f59e0b" },
  { amount: 1.50,  label: "1.5 ريال", color: "#ef4444" },
  { amount: 2.00,  label: "2 ريال",   color: "#ec4899" },
  { amount: 5.00,  label: "5 ريالات", color: "#f97316" },
  { amount: 10.00, label: "10 ريالات",color: "#eab308" },
];

const NUM_SEGS = SEGMENTS.length;
const SEG_ANGLE = 360 / NUM_SEGS;

function WheelCanvas({ spinning, targetAmount, onDone }: {
  spinning: boolean;
  targetAmount: number | null;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const rafRef = useRef<number>(0);
  const isDoneRef = useRef(false);

  // رسم العجلة
  const draw = (rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 6;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < NUM_SEGS; i++) {
      const startA = (rotation + i * SEG_ANGLE - 90) * (Math.PI / 180);
      const endA   = startA + SEG_ANGLE * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startA, endA);
      ctx.fillStyle = SEGMENTS[i].color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // النص
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startA + SEG_ANGLE * (Math.PI / 180) / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px 'Tajawal', sans-serif";
      ctx.fillText(SEGMENTS[i].label, r - 10, 4);
      ctx.restore();
    }

    // دائرة مركزية
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  useEffect(() => { draw(0); }, []); // eslint-disable-line

  useEffect(() => {
    if (!spinning || targetAmount === null) return;
    isDoneRef.current = false;

    // أوجد القطاع الهدف
    const segIdx = SEGMENTS.findIndex(s => s.amount === targetAmount);
    const targetIdx = segIdx >= 0 ? segIdx : 0;

    // احسب الدوران المستهدف
    const currentRot = rotRef.current % 360;
    const targetSegCenter = -(targetIdx * SEG_ANGLE + SEG_ANGLE / 2);
    let needed = ((targetSegCenter - currentRot) % 360 + 360) % 360;
    if (needed < 30) needed += 360;
    const totalRotation = 1440 + needed; // 4 دورات كاملة + الهدف

    const startRot = rotRef.current;
    const startTime = performance.now();
    const duration = 4000; // ms

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3);
      rotRef.current = startRot + totalRotation * ease;
      draw(rotRef.current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        if (!isDoneRef.current) {
          isDoneRef.current = true;
          onDone();
        }
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, targetAmount]); // eslint-disable-line

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* مؤشر */}
      <div style={{
        position: "absolute", top: "50%", right: -18, transform: "translateY(-50%)",
        width: 0, height: 0,
        borderTop: "10px solid transparent",
        borderBottom: "10px solid transparent",
        borderRight: "18px solid var(--accent)",
        zIndex: 10,
        filter: "drop-shadow(0 0 6px rgba(99,102,241,0.8))",
      }} />
      <canvas ref={canvasRef} width={260} height={260} style={{ borderRadius: "50%", display: "block" }} />
    </div>
  );
}

export default function RewardsPage() {
  const router = useRouter();
  const [data, setData] = useState<RewardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [targetAmount, setTargetAmount] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [spinErr, setSpinErr] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<"bank" | "wallet" | "subscription_credit">("bank");
  const [wDetails, setWDetails] = useState({ iban: "", account_holder: "", wallet_provider: "stcpay", wallet_phone: "" });
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawMsgType, setWithdrawMsgType] = useState<"ok" | "err">("ok");
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    const res = await portalFetch("/rewards");
    if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
    const j = await res.json();
    setData(j);
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleSpin = async () => {
    if (spinning || !data || data.pending_spins <= 0) return;
    setSpinErr("");
    setSpinning(true);
    setShowWin(false);
    setLastWin(null);

    const res = await portalFetch("/rewards/spin", { method: "POST" });
    const j = await res.json();
    if (!j.ok) {
      setSpinErr(j.error || "فشل التشغيل");
      setSpinning(false);
      return;
    }

    setTargetAmount(j.amount);
    // onDone يُستدعى من WheelCanvas
  };

  const onSpinDone = async () => {
    setSpinning(false);
    setLastWin(targetAmount);
    setShowWin(true);
    await load(); // تحديث الرصيد
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setWithdrawMsg("");
    try {
      let details: Record<string, string> = {};
      if (withdrawMethod === "bank") {
        details = { iban: wDetails.iban.trim(), account_holder: wDetails.account_holder.trim() };
        if (!details.iban || !details.account_holder) throw new Error("يرجى إدخال رقم الآيبان واسم صاحب الحساب");
      } else if (withdrawMethod === "wallet") {
        details = { wallet_provider: wDetails.wallet_provider, wallet_phone: wDetails.wallet_phone.trim() };
        if (!details.wallet_phone) throw new Error("يرجى إدخال رقم الجوال");
      }

      const res = await portalFetch("/rewards/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: withdrawMethod, details }),
      });
      const j = await res.json();
      if (!j.ok && j.error) throw new Error(j.error);
      setWithdrawMsg(`تم تقديم طلب سحب ${j.amount?.toFixed(2)} ريال ✓`);
      setWithdrawMsgType("ok");
      setShowWithdraw(false);
      await load();
    } catch (e) {
      setWithdrawMsg(String(e).replace("Error: ", ""));
      setWithdrawMsgType("err");
    }
    setWithdrawing(false);
  };

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso.slice(0, 16); }
  }

  const statusLabel = (s: string) => ({
    pending: "معلق",
    paid: "مُدفوع",
    rejected: "مرفوض",
    withdrawn: "مسحوب",
  }[s] ?? s);

  const methodLabel = (m: string) => ({
    bank: "تحويل بنكي",
    wallet: "محفظة إلكترونية",
    subscription_credit: "رصيد اشتراك",
  }[m] ?? m);

  return (
    <PortalShell>
      <div style={s.page}>

        {/* ── رأس الصفحة ── */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>عجلة الحظ 🎡</h1>
            <p style={s.sub}>كل تقديم ناجح يمنحك نقرة — ادِر العجلة واكسب مكافآت مالية</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <RefreshCw size={26} color="var(--text3)" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : !data?.subscription_active ? (
          <div style={s.lockedCard}>
            <AlertCircle size={36} color="var(--text3)" strokeWidth={1.2} />
            <h3 style={{ color: "var(--text)", fontSize: 17, fontWeight: 700, margin: 0 }}>يجب أن يكون اشتراكك نشطاً</h3>
            <p style={{ color: "var(--text3)", fontSize: 13, margin: 0, textAlign: "center", maxWidth: 320, lineHeight: 1.7 }}>
              اشترك بـ 90 ريال أو أكثر لتبدأ في ادارة عجلة الحظ وتراكم مكافآتك مع كل تقديم يرسله البوت.
            </p>
            <button onClick={() => router.push("/store")} style={s.buyBtn}>اشترك الآن</button>
          </div>
        ) : (
          <>
            {/* ── بطاقة الرصيد ── */}
            <div style={s.balanceRow}>
              <div style={s.balanceCard}>
                <span style={s.balLabel}>رصيدك المتراكم</span>
                <span style={s.balNum}>{data.available_balance.toFixed(2)}</span>
                <span style={s.balCurr}>ريال</span>
              </div>
              <div style={{ ...s.balanceCard, background: "var(--surface2)" }}>
                <span style={s.balLabel}>نقرات متبقية</span>
                <span style={{ ...s.balNum, color: data.pending_spins > 0 ? "var(--accent-fg)" : "var(--text3)" }}>
                  {data.pending_spins}
                </span>
                <span style={s.balCurr}>نقرة</span>
              </div>
            </div>

            {/* ── العجلة ── */}
            <div style={s.wheelWrap}>
              <WheelCanvas
                spinning={spinning}
                targetAmount={targetAmount}
                onDone={onSpinDone}
              />

              {/* نتيجة الفوز */}
              {showWin && lastWin !== null && (
                <div style={s.winBanner}>
                  <span style={{ fontSize: 24 }}>🎉</span>
                  <span style={{ color: "var(--text)", fontSize: 16, fontWeight: 800 }}>
                    ربحت {lastWin >= 1 ? `${lastWin} ريال` : `${(lastWin * 100).toFixed(0)} هللة`}!
                  </span>
                </div>
              )}

              {spinErr && (
                <div style={s.errBanner}>
                  <AlertCircle size={14} />
                  <span>{spinErr}</span>
                </div>
              )}

              <button
                onClick={handleSpin}
                disabled={spinning || (data.pending_spins ?? 0) <= 0}
                style={{
                  ...s.spinBtn,
                  opacity: spinning || data.pending_spins <= 0 ? 0.5 : 1,
                  cursor: spinning || data.pending_spins <= 0 ? "not-allowed" : "pointer",
                }}
              >
                {spinning
                  ? <><RefreshCw size={16} style={{ animation: "spin 0.5s linear infinite" }} /> يدور…</>
                  : <><Gift size={16} /> {data.pending_spins > 0 ? `ادِر العجلة (${data.pending_spins} نقرة)` : "لا توجد نقرات — قيد الانتظار"}</>
                }
              </button>

              <p style={s.hint}>
                {data.pending_spins <= 0
                  ? "البوت سيمنحك نقرة جديدة بعد كل تقديم ناجح"
                  : `تبدأ الجوائز من 5 هللات حتى 10 ريالات — الاشتراك منذ 180+ يوم يفتح الجائزة الكبرى`
                }
              </p>
            </div>

            {/* ── طلب السحب ── */}
            {data.available_balance >= 30 && (
              <div style={s.withdrawCard}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ color: "var(--text)", fontSize: 15, fontWeight: 700 }}>
                      رصيدك وصل الحد الأدنى للسحب!
                    </div>
                    <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 3 }}>
                      يمكنك سحب {data.available_balance.toFixed(2)} ريال نقداً أو كرصيد اشتراك
                    </div>
                  </div>
                  <button onClick={() => setShowWithdraw(v => !v)} style={s.withdrawBtn}>
                    <Wallet size={15} />
                    {showWithdraw ? "إغلاق" : "اطلب السحب"}
                    {showWithdraw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {withdrawMsg && (
                  <div style={{ ...s.msgBox, background: withdrawMsgType === "ok" ? "#f0fdf4" : "#fff1f1", border: `1px solid ${withdrawMsgType === "ok" ? "#86efac" : "#fca5a5"}`, color: withdrawMsgType === "ok" ? "#166534" : "#dc2626", marginTop: 14 }}>
                    {withdrawMsgType === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {withdrawMsg}
                  </div>
                )}

                {showWithdraw && (
                  <div style={s.withdrawForm} dir="rtl">
                    <div style={s.methodTabs}>
                      {[
                        { v: "bank" as const, icon: <Building2 size={13} />, label: "تحويل بنكي" },
                        { v: "wallet" as const, icon: <Wallet size={13} />, label: "محفظة إلكترونية" },
                        { v: "subscription_credit" as const, icon: <Gift size={13} />, label: "رصيد اشتراك" },
                      ].map(tab => (
                        <button
                          key={tab.v}
                          onClick={() => setWithdrawMethod(tab.v)}
                          style={{ ...s.methodTab, ...(withdrawMethod === tab.v ? s.methodTabActive : {}) }}
                        >
                          {tab.icon} {tab.label}
                        </button>
                      ))}
                    </div>

                    {withdrawMethod === "bank" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={s.field}>
                          <label style={s.fieldLabel}>رقم الآيبان (IBAN)</label>
                          <input
                            value={wDetails.iban}
                            onChange={e => setWDetails(d => ({ ...d, iban: e.target.value }))}
                            placeholder="SA..."
                            style={s.input}
                            dir="ltr"
                          />
                        </div>
                        <div style={s.field}>
                          <label style={s.fieldLabel}>اسم صاحب الحساب</label>
                          <input
                            value={wDetails.account_holder}
                            onChange={e => setWDetails(d => ({ ...d, account_holder: e.target.value }))}
                            placeholder="الاسم كما في البطاقة"
                            style={s.input}
                          />
                        </div>
                      </div>
                    )}

                    {withdrawMethod === "wallet" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={s.field}>
                          <label style={s.fieldLabel}>المحفظة</label>
                          <select
                            value={wDetails.wallet_provider}
                            onChange={e => setWDetails(d => ({ ...d, wallet_provider: e.target.value }))}
                            style={s.input}
                          >
                            <option value="stcpay">STC Pay</option>
                            <option value="urpay">Urpay</option>
                            <option value="alrajhi_wallet">محفظة الراجحي</option>
                          </select>
                        </div>
                        <div style={s.field}>
                          <label style={s.fieldLabel}>رقم الجوال</label>
                          <input
                            value={wDetails.wallet_phone}
                            onChange={e => setWDetails(d => ({ ...d, wallet_phone: e.target.value }))}
                            placeholder="05xxxxxxxx"
                            style={s.input}
                            dir="ltr"
                          />
                        </div>
                      </div>
                    )}

                    {withdrawMethod === "subscription_credit" && (
                      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--text3)", lineHeight: 1.7 }}>
                        سيُضاف {data.available_balance.toFixed(2)} ريال كرصيد يُخصم من تجديد اشتراكك القادم مباشرة.
                      </div>
                    )}

                    <button onClick={handleWithdraw} disabled={withdrawing} style={s.confirmBtn}>
                      {withdrawing ? <RefreshCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle2 size={14} />}
                      تأكيد سحب {data.available_balance.toFixed(2)} ريال
                    </button>
                  </div>
                )}
              </div>
            )}

            {data.available_balance > 0 && data.available_balance < 30 && (
              <div style={s.progressCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>التقدم نحو السحب</span>
                  <span style={{ color: "var(--text3)", fontSize: 12 }}>{data.available_balance.toFixed(2)} / 30 ريال</span>
                </div>
                <div style={{ height: 8, background: "var(--surface2)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min((data.available_balance / 30) * 100, 100)}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.5s" }} />
                </div>
                <p style={{ color: "var(--text3)", fontSize: 11.5, marginTop: 8, margin: "8px 0 0" }}>
                  تحتاج {(30 - data.available_balance).toFixed(2)} ريال إضافية لطلب السحب
                </p>
              </div>
            )}

            {/* ── سجل السحوبات والمكافآت ── */}
            <button onClick={() => setShowHistory(v => !v)} style={s.historyToggle}>
              <Clock size={14} />
              سجل المكافآت والسحوبات
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* سحوبات */}
                {data.withdrawals.length > 0 && (
                  <div style={s.historySection}>
                    <h4 style={s.historyTitle}>طلبات السحب</h4>
                    {data.withdrawals.map(w => (
                      <div key={w.id} style={s.historyRow}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>{w.amount.toFixed(2)} ريال</span>
                          <span style={{ color: "var(--text3)", fontSize: 11, marginRight: 8 }}>— {methodLabel(w.method)}</span>
                          <p style={{ color: "var(--text4)", fontSize: 11, margin: "3px 0 0" }}>{fmtDate(w.created_at)}</p>
                          {w.admin_notes && w.status === "rejected" && (
                            <p style={{ color: "#dc2626", fontSize: 11, margin: "3px 0 0" }}>سبب الرفض: {w.admin_notes}</p>
                          )}
                        </div>
                        <span style={{
                          ...s.statusBadge,
                          background: w.status === "paid" ? "#f0fdf4" : w.status === "rejected" ? "#fff1f1" : "var(--surface2)",
                          color: w.status === "paid" ? "#166534" : w.status === "rejected" ? "#dc2626" : "var(--text3)",
                          border: `1px solid ${w.status === "paid" ? "#86efac" : w.status === "rejected" ? "#fca5a5" : "var(--border2)"}`,
                        }}>
                          {statusLabel(w.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* نقرات العجلة */}
                {data.spins.length > 0 && (
                  <div style={s.historySection}>
                    <h4 style={s.historyTitle}>نتائج العجلة</h4>
                    {data.spins.map(spin => (
                      <div key={spin.id} style={s.historyRow}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>
                            {spin.amount >= 1 ? `${spin.amount} ريال` : `${(spin.amount * 100).toFixed(0)} هللة`}
                          </span>
                          <p style={{ color: "var(--text4)", fontSize: 11, margin: "3px 0 0" }}>{fmtDate(spin.spun_at)}</p>
                        </div>
                        <span style={{
                          ...s.statusBadge,
                          background: spin.status === "withdrawn" ? "var(--surface2)" : "var(--accent)",
                          color: spin.status === "withdrawn" ? "var(--text3)" : "var(--accent-fg)",
                          border: "none",
                        }}>
                          {spin.status === "withdrawn" ? "مسحوب" : "متراكم"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {data.spins.length === 0 && data.withdrawals.length === 0 && (
                  <div style={{ textAlign: "center", padding: "30px 20px", color: "var(--text3)", fontSize: 13 }}>
                    لا يوجد سجل بعد — ابدأ بتشغيل العجلة!
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 },
  header: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 18, padding: "22px 26px",
  },
  title: { color: "var(--text)", fontSize: 22, fontWeight: 800, margin: 0 },
  sub: { color: "var(--text3)", fontSize: 13, margin: "5px 0 0", lineHeight: 1.6 },
  lockedCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
    padding: "50px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
  },
  buyBtn: {
    background: "var(--accent)", color: "var(--accent-fg)", border: "none",
    borderRadius: 12, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    marginTop: 6,
  },
  balanceRow: { display: "flex", gap: 14 },
  balanceCard: {
    flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "18px 20px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
  },
  balLabel: { color: "var(--text3)", fontSize: 12 },
  balNum: { color: "var(--text)", fontSize: 32, fontWeight: 900, lineHeight: 1 },
  balCurr: { color: "var(--text3)", fontSize: 12 },
  wheelWrap: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20,
    padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
  },
  winBanner: {
    display: "flex", alignItems: "center", gap: 10,
    background: "linear-gradient(135deg, #fef9c3, #fef08a)",
    border: "1px solid #fde047", borderRadius: 12,
    padding: "12px 20px", animation: "fadeIn 0.4s ease",
  },
  errBanner: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#fff1f1", border: "1px solid #fca5a5",
    borderRadius: 10, padding: "10px 14px",
    color: "#dc2626", fontSize: 12,
  },
  spinBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "none", borderRadius: 14, padding: "14px 32px",
    fontSize: 15, fontWeight: 800, transition: "opacity 0.2s",
  },
  hint: { color: "var(--text3)", fontSize: 12, textAlign: "center", lineHeight: 1.6, margin: 0, maxWidth: 300 },
  withdrawCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
    padding: "20px 22px",
  },
  withdrawBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "none", borderRadius: 12, padding: "10px 20px",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  withdrawForm: { marginTop: 18, display: "flex", flexDirection: "column", gap: 14 },
  methodTabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  methodTab: {
    display: "flex", alignItems: "center", gap: 6,
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", color: "var(--text3)",
  },
  methodTabActive: {
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "1px solid transparent",
  },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { color: "var(--text3)", fontSize: 11.5 },
  input: {
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "var(--text)",
    outline: "none", width: "100%", boxSizing: "border-box" as const,
  },
  confirmBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "var(--accent)", color: "var(--accent-fg)",
    border: "none", borderRadius: 12, padding: "12px 24px",
    fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
  },
  msgBox: {
    display: "flex", alignItems: "center", gap: 8,
    borderRadius: 10, padding: "10px 14px", fontSize: 12,
  },
  progressCard: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "18px 20px",
  },
  historyToggle: {
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 12, padding: "10px 18px", fontSize: 13, color: "var(--text3)",
    cursor: "pointer", width: "100%", justifyContent: "center",
  },
  historySection: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, overflow: "hidden",
  },
  historyTitle: {
    color: "var(--text3)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    padding: "10px 16px", borderBottom: "1px solid var(--border)", margin: 0,
    textTransform: "uppercase" as const,
  },
  historyRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px", borderBottom: "1px solid var(--border)",
  },
  statusBadge: {
    borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
};
