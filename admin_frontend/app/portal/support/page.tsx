"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch } from "@/lib/portal-auth";
import {
  Send, MessageCircle, Loader2, Paperclip, Share2, X,
  FileText, Image as ImageIcon, ShoppingBag, KeyRound, User as UserIcon, Calendar,
} from "lucide-react";

interface Attachment {
  url: string;
  name?: string | null;
  type?: string | null;
  size?: number | null;
}
interface Meta {
  kind?: "order" | "code" | "profile" | "subscription" | "applications";
  title?: string;
  fields?: { label: string; value: string }[];
  [k: string]: unknown;
}
interface Msg {
  id: string;
  sender: "user" | "admin";
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  meta?: Meta | null;
}

interface ShareData {
  profile: { full_name: string; phone: string; email: string | null; subscription_ends_at: string | null } | null;
  activation: { id: string; code: string; subscription_days: number } | null;
  orders: { id: string; status: string; amount: number; plan_name: string | null; payment_method: string | null; created_at: string }[];
  applications_count: number;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingMeta, setPendingMeta] = useState<Meta | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await portalFetch("/support");
      const j = await r.json();
      if (j.ok) setMessages(j.messages || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      alert("الحد الأقصى لحجم الملف 10 ميجا");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await portalFetch("/support/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (j.ok && j.attachment) setPendingFile(j.attachment);
      else alert(j.error || "فشل الرفع");
    } catch {
      alert("فشل الرفع");
    }
    setUploading(false);
  };

  const openShare = async () => {
    setShowShare(true);
    if (shareData) return;
    setShareLoading(true);
    try {
      const r = await portalFetch("/support/share-options");
      const j = await r.json();
      if (j.ok) setShareData(j);
    } catch {}
    setShareLoading(false);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !pendingFile && !pendingMeta) || sending) return;
    setSending(true);
    const att = pendingFile, mta = pendingMeta, body = text;
    setInput(""); setPendingFile(null); setPendingMeta(null);
    try {
      const r = await portalFetch("/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body, attachment: att, meta: mta }),
      });
      const j = await r.json();
      if (j.ok && j.message) setMessages((prev) => [...prev, j.message]);
    } catch {}
    setSending(false);
  };

  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtSize = (b?: number | null) => {
    if (!b) return "";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  const isImage = (type?: string | null) => !!type && type.startsWith("image/");

  /* ───── share builders ───── */
  const buildOrderMeta = (o: ShareData["orders"][number]): Meta => ({
    kind: "order",
    title: "طلب شراء",
    order_id: o.id,
    fields: [
      { label: "الباقة", value: o.plan_name || "—" },
      { label: "المبلغ", value: `${o.amount} ر.س` },
      { label: "الحالة", value: statusAr(o.status) },
      { label: "طريقة الدفع", value: paymentAr(o.payment_method) },
      { label: "التاريخ", value: fmtDate(o.created_at) },
    ],
  });
  const buildCodeMeta = (c: NonNullable<ShareData["activation"]>): Meta => ({
    kind: "code",
    title: "كود التفعيل الخاص بي",
    code: c.code,
    fields: [
      { label: "الكود", value: c.code },
      { label: "مدة الاشتراك", value: `${c.subscription_days} يوم` },
    ],
  });
  const buildProfileMeta = (p: NonNullable<ShareData["profile"]>): Meta => ({
    kind: "profile",
    title: "بيانات حسابي",
    fields: [
      { label: "الاسم", value: p.full_name || "—" },
      { label: "الجوال", value: p.phone || "—" },
      { label: "البريد", value: p.email || "—" },
    ],
  });
  const buildSubMeta = (p: NonNullable<ShareData["profile"]>): Meta => {
    const ends = p.subscription_ends_at ? new Date(p.subscription_ends_at) : null;
    const days = ends ? Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86400000)) : 0;
    return {
      kind: "subscription",
      title: "اشتراكي الحالي",
      fields: [
        { label: "ينتهي في", value: ends ? fmtDate(p.subscription_ends_at!) : "—" },
        { label: "المتبقي", value: `${days} يوم` },
      ],
    };
  };
  const buildAppsMeta = (count: number): Meta => ({
    kind: "applications",
    title: "إجمالي تقديماتي",
    fields: [{ label: "عدد التقديمات", value: String(count) }],
  });

  const pickMeta = (m: Meta) => { setPendingMeta(m); setShowShare(false); };

  return (
    <PortalShell>
      <div className="support-wrap" style={{
        display: "flex", flexDirection: "column",
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12, background: "var(--surface2)",
          flexShrink: 0,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: "var(--surface)", border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={18} color="var(--text)" />
          </div>
          <div>
            <p style={{ margin: 0, color: "var(--text)", fontSize: 15, fontWeight: 700 }}>الدعم الفني</p>
            <p style={{ margin: 0, color: "var(--text3)", fontSize: 12 }}>راسلنا وسنرد عليك بأسرع وقت</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: 16,
          display: "flex", flexDirection: "column", gap: 10,
          background: "var(--bg)",
        }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={22} color="var(--text3)" className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text3)", padding: 40, fontSize: 13 }}>
              لا توجد رسائل بعد. ابدأ المحادثة!
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender === "user";
              return (
                <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                  <div style={{
                    background: mine ? "var(--accent)" : "var(--surface2)",
                    color: mine ? "var(--accent-fg)" : "var(--text)",
                    border: `1px solid ${mine ? "var(--accent)" : "var(--border)"}`,
                    padding: m.attachment_url && isImage(m.attachment_type) ? 6 : "10px 14px",
                    borderRadius: 14,
                    fontSize: 14, lineHeight: 1.6,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    {m.attachment_url && isImage(m.attachment_type) && (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.attachment_url} alt={m.attachment_name || ""}
                          style={{ width: "100%", maxWidth: 260, borderRadius: 10, display: "block" }} />
                      </a>
                    )}
                    {m.attachment_url && !isImage(m.attachment_type) && (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px", borderRadius: 10,
                          background: mine ? "var(--accent-fg)" : "var(--surface)",
                          color: mine ? "var(--accent)" : "var(--text)",
                          textDecoration: "none", fontSize: 13, fontWeight: 600,
                          border: `1px solid ${mine ? "var(--accent-fg)" : "var(--border)"}`,
                        }}>
                        <FileText size={16} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                          {m.attachment_name || "ملف"}
                        </span>
                        {m.attachment_size ? <span style={{ opacity: 0.7, fontSize: 11 }}>{fmtSize(m.attachment_size)}</span> : null}
                      </a>
                    )}
                    {m.meta && <MetaCard meta={m.meta} mine={mine} />}
                    {m.content && <span style={{ paddingInline: m.attachment_url && isImage(m.attachment_type) ? 8 : 0, paddingBottom: m.attachment_url && isImage(m.attachment_type) ? 4 : 0 }}>{m.content}</span>}
                  </div>
                  <div style={{
                    fontSize: 10, color: "var(--text3)", marginTop: 4,
                    textAlign: mine ? "left" : "right", paddingInline: 6,
                  }}>
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pending preview (file or shared meta) */}
        {(pendingFile || pendingMeta) && (
          <div style={{
            padding: "10px 14px", borderTop: "1px solid var(--border)",
            background: "var(--surface2)", display: "flex", gap: 10, alignItems: "center",
            flexShrink: 0,
          }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
              {pendingFile && (
                <>
                  {isImage(pendingFile.type) ? <ImageIcon size={18} color="var(--text)" /> : <FileText size={18} color="var(--text)" />}
                  <span style={{ color: "var(--text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pendingFile.name}
                  </span>
                  <span style={{ color: "var(--text3)", fontSize: 11, flexShrink: 0 }}>{fmtSize(pendingFile.size)}</span>
                </>
              )}
              {pendingMeta && (
                <>
                  <Share2 size={16} color="var(--text)" />
                  <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>سيتم مشاركة: {pendingMeta.title}</span>
                </>
              )}
            </div>
            <button onClick={() => { setPendingFile(null); setPendingMeta(null); }}
              style={{ background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", padding: 4, display: "flex" }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Composer */}
        <div style={{
          padding: 12, borderTop: "1px solid var(--border)", background: "var(--surface2)",
          display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
        }}>
          <input ref={fileInputRef} type="file" hidden
            accept="image/*,application/pdf,.doc,.docx,.txt"
            onChange={onFileChange} />
          <button onClick={onPickFile} disabled={uploading} title="إرفاق ملف أو صورة"
            style={iconBtnStyle(uploading)}>
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </button>
          <button onClick={openShare} title="مشاركة عملية تخصني" style={iconBtnStyle(false)}>
            <Share2 size={16} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="اكتب رسالتك..."
            rows={1}
            style={{
              flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "10px 14px", color: "var(--text)",
              fontSize: 14, fontFamily: "inherit", resize: "none",
              outline: "none", maxHeight: 120, minHeight: 42,
            }}
          />
          <button onClick={send} disabled={sending || (!input.trim() && !pendingFile && !pendingMeta)}
            style={{
              background: sending || (!input.trim() && !pendingFile && !pendingMeta) ? "var(--surface)" : "var(--accent)",
              color: sending || (!input.trim() && !pendingFile && !pendingMeta) ? "var(--text3)" : "var(--accent-fg)",
              border: "1px solid var(--border)",
              borderRadius: 12, width: 42, height: 42,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: sending || (!input.trim() && !pendingFile && !pendingMeta) ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <div onClick={() => setShowShare(false)}
          style={{
            position: "fixed", inset: 0, background: "var(--bg)",
            zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: 0,
          }}>
          <div onClick={(e) => e.stopPropagation()}
            className="share-sheet"
            style={{
              width: "100%", maxWidth: 600, background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              maxHeight: "80vh", overflowY: "auto",
              paddingBottom: "max(20px, env(safe-area-inset-bottom))",
            }}>
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              position: "sticky", top: 0, background: "var(--surface)", zIndex: 1,
            }}>
              <div>
                <p style={{ margin: 0, color: "var(--text)", fontWeight: 700, fontSize: 15 }}>مشاركة عملية معي</p>
                <p style={{ margin: 0, color: "var(--text3)", fontSize: 12 }}>اختر ما تريد إرفاقه برسالتك</p>
              </div>
              <button onClick={() => setShowShare(false)}
                style={{ background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", padding: 4, display: "flex" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {shareLoading && (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <Loader2 size={20} className="animate-spin" color="var(--text3)" />
                </div>
              )}
              {!shareLoading && shareData && (
                <>
                  {shareData.profile && (
                    <ShareItem
                      icon={<UserIcon size={18} />}
                      title="بيانات حسابي"
                      subtitle={`${shareData.profile.full_name || "—"} · ${shareData.profile.phone || "—"}`}
                      onClick={() => pickMeta(buildProfileMeta(shareData.profile!))}
                    />
                  )}
                  {shareData.profile?.subscription_ends_at && (
                    <ShareItem
                      icon={<Calendar size={18} />}
                      title="اشتراكي"
                      subtitle={`ينتهي في ${fmtDate(shareData.profile.subscription_ends_at)}`}
                      onClick={() => pickMeta(buildSubMeta(shareData.profile!))}
                    />
                  )}
                  {shareData.activation && (
                    <ShareItem
                      icon={<KeyRound size={18} />}
                      title="كود التفعيل"
                      subtitle={shareData.activation.code}
                      onClick={() => pickMeta(buildCodeMeta(shareData.activation!))}
                    />
                  )}
                  {shareData.applications_count > 0 && (
                    <ShareItem
                      icon={<MessageCircle size={18} />}
                      title="عدد تقديماتي"
                      subtitle={`${shareData.applications_count} تقديم`}
                      onClick={() => pickMeta(buildAppsMeta(shareData.applications_count))}
                    />
                  )}
                  {shareData.orders.length > 0 && (
                    <>
                      <p style={{ margin: "10px 4px 0", color: "var(--text3)", fontSize: 12, fontWeight: 600 }}>طلبات الشراء</p>
                      {shareData.orders.map((o) => (
                        <ShareItem key={o.id}
                          icon={<ShoppingBag size={18} />}
                          title={o.plan_name || "طلب"}
                          subtitle={`${o.amount} ر.س · ${statusAr(o.status)} · ${fmtDate(o.created_at)}`}
                          onClick={() => pickMeta(buildOrderMeta(o))}
                        />
                      ))}
                    </>
                  )}
                  {shareData.orders.length === 0 && !shareData.activation && !shareData.profile && (
                    <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: 20 }}>
                      لا توجد عمليات قابلة للمشاركة بعد
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .support-wrap {
          height: calc(100dvh - 220px);
          max-height: 820px;
          min-height: 380px;
        }
        @media (min-width: 901px) {
          .support-wrap {
            height: calc(100vh - 100px);
            max-height: 820px;
          }
        }
      `}</style>
    </PortalShell>
  );
}

/* ──────── helpers ──────── */
function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 42, height: 42, flexShrink: 0,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 12, color: "var(--text)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
  };
}

function ShareItem({ icon, title, subtitle, onClick }: {
  icon: React.ReactNode; title: string; subtitle: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 12,
      background: "var(--surface2)", border: "1px solid var(--border)",
      color: "var(--text)", textAlign: "right", cursor: "pointer",
      width: "100%",
    }}>
      <div style={{
        width: 36, height: 36, flexShrink: 0, borderRadius: 10,
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text)",
      }}>{icon}</div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{title}</p>
        <p style={{ margin: 0, color: "var(--text3)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function MetaCard({ meta, mine }: { meta: Meta; mine: boolean }) {
  const fields = meta.fields || [];
  return (
    <div style={{
      borderRadius: 10,
      background: mine ? "var(--accent-fg)" : "var(--surface)",
      color: mine ? "var(--accent)" : "var(--text)",
      border: `1px solid ${mine ? "var(--accent-fg)" : "var(--border)"}`,
      padding: "10px 12px",
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: mine ? "var(--accent)" : "var(--text3)", marginBottom: 6 }}>{meta.title || "تفاصيل"}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
            <span style={{ color: mine ? "var(--accent)" : "var(--text3)" }}>{f.label}</span>
            <span style={{ fontWeight: 600, textAlign: "left" }}>{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusAr(s: string): string {
  const m: Record<string, string> = {
    pending: "قيد الانتظار",
    awaiting_review: "قيد المراجعة",
    paid: "مدفوع",
    cancelled: "ملغي",
    failed: "فشل",
    refunded: "مسترد",
  };
  return m[s] || s;
}
function paymentAr(p: string | null | undefined): string {
  if (!p) return "—";
  const m: Record<string, string> = {
    bank_transfer: "تحويل بنكي",
    tamara: "تمارا",
    streampay: "Stream Pay",
  };
  return m[p] || p;
}
