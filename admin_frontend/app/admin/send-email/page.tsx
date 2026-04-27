"use client";

import { useState, useEffect, useCallback } from "react";
import Shell from "@/components/shell";
import {
  Send, Mail, User, FileText, MessageSquare, Reply, CheckCircle, XCircle,
  Loader2, Users, BarChart2, Eye, EyeOff, Clock, ChevronLeft, Plus,
  Inbox, AlertCircle, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Campaign = {
  id: string; name: string; subject: string; from_name: string;
  total_sent: number; total_opened: number; created_at: string; sent_at: string | null;
};
type Recipient = {
  id: string; email: string; name: string | null; opened_at: string | null; error: string | null;
};
type Tab = "quick" | "campaign" | "history";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SendEmailPage() {
  const [tab, setTab] = useState<Tab>("quick");

  return (
    <Shell>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-ink flex items-center gap-3 m-0">
            <Mail size={22} className="text-ink" />
            البريد الإلكتروني
          </h1>
          <p className="text-sm text-muted mt-1 m-0">إرسال سريع، حملات جماعية، وتتبع الفتح</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-panel2 rounded-xl border border-line mb-6 w-fit">
          {([
            { key: "quick",    label: "إرسال سريع",      icon: Send },
            { key: "campaign", label: "حملة جماعية",     icon: Users },
            { key: "history",  label: "الحملات السابقة", icon: BarChart2 },
          ] as { key: Tab; label: string; icon: any }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-[var(--bg)] text-ink shadow-sm border border-line"
                  : "text-muted hover:text-ink"
              }`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "quick"    && <QuickSend />}
        {tab === "campaign" && <CampaignCreate onSent={() => setTab("history")} />}
        {tab === "history"  && <CampaignHistory />}
      </div>
    </Shell>
  );
}

// ─── Quick Send ───────────────────────────────────────────────────────────────
function QuickSend() {
  const [toEmail, setToEmail]   = useState("");
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo]   = useState("");
  const [sending, setSending]   = useState(false);
  const [status, setStatus]     = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    setSending(true); setStatus(null);
    try {
      const r = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: toEmail, subject, message, from_name: fromName || undefined, reply_to: replyTo || undefined }),
      });
      const j = await r.json();
      if (!j.ok) { setStatus({ ok: false, msg: j.error || "فشل الإرسال" }); }
      else { setStatus({ ok: true, msg: "تم إرسال البريد بنجاح ✉️" }); setToEmail(""); setSubject(""); setMessage(""); setReplyTo(""); }
    } catch { setStatus({ ok: false, msg: "خطأ في الاتصال" }); }
    setSending(false);
  };

  const canSend = toEmail.trim() && subject.trim() && message.trim() && !sending;

  return (
    <div className="rounded-2xl border border-line bg-panel p-6 space-y-4 max-w-2xl">
      <Field label="البريد المرسَل إليه *" icon={<User size={13} />}>
        <input type="email" dir="ltr" className={inputCls} placeholder="user@example.com"
          value={toEmail} onChange={e => setToEmail(e.target.value)} disabled={sending} />
      </Field>
      <Field label="اسم المرسِل — اختياري" icon={<User size={13} />}>
        <input className={inputCls} placeholder="مثلاً: إدارة Jobbots"
          value={fromName} onChange={e => setFromName(e.target.value)} disabled={sending} />
      </Field>
      <Field label="بريد الرد (Reply-To) — اختياري" icon={<Reply size={13} />}>
        <input type="email" dir="ltr" className={inputCls} placeholder="manager@yourdomain.com"
          value={replyTo} onChange={e => setReplyTo(e.target.value)} disabled={sending} />
      </Field>
      <Field label="عنوان الرسالة *" icon={<FileText size={13} />}>
        <input className={inputCls} placeholder="مرحباً، بخصوص حسابك في Jobbots"
          value={subject} onChange={e => setSubject(e.target.value)} disabled={sending} />
      </Field>
      <Field label="نص الرسالة *" icon={<MessageSquare size={13} />}>
        <textarea rows={8} className={`${inputCls} resize-y leading-relaxed`}
          placeholder={"السلام عليكم،\n\nنود إعلامكم بأن..."}
          value={message} onChange={e => setMessage(e.target.value)} disabled={sending} />
        <p className="text-xs text-muted2 mt-1">يدعم الأسطر الجديدة. لا تضف HTML — يتم تنسيق الرسالة تلقائياً.</p>
      </Field>
      {status && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${status.ok ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
          {status.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {status.msg}
        </div>
      )}
      <div className="flex justify-end pt-1">
        <button onClick={send} disabled={!canSend}
          className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {sending ? <><Loader2 size={14} className="animate-spin" /> جاري الإرسال...</> : <><Send size={14} /> إرسال</>}
        </button>
      </div>
    </div>
  );
}

// ─── Campaign Create ──────────────────────────────────────────────────────────
function CampaignCreate({ onSent }: { onSent: () => void }) {
  const [step, setStep] = useState<"compose" | "recipients" | "sending" | "done">("compose");
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const [name, setName]         = useState("");
  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");
  const [fromName, setFromName] = useState("Jobbots");
  const [replyTo, setReplyTo]   = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");

  const [saving, setSaving]   = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<{ sent: number; total: number } | null>(null);
  const [err, setErr]         = useState("");

  const saveAndNext = async () => {
    if (!name || !subject || !body) { setErr("الاسم والعنوان والنص مطلوبة"); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, body, from_name: fromName, reply_to: replyTo || undefined }),
    });
    const j = await r.json();
    setSaving(false);
    if (!j.ok) { setErr(j.error || "خطأ في الحفظ"); return; }
    setCampaignId(j.id);
    setStep("recipients");
  };

  const sendCampaign = async () => {
    if (!campaignId) return;
    const lines = recipientsRaw.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { setErr("أضف إيميلات للإرسال"); return; }
    setSending(true); setErr(""); setStep("sending");
    const r = await fetch(`/api/admin/campaigns/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients: lines }),
    });
    const j = await r.json();
    setSending(false);
    if (!j.ok) { setErr(j.error || "خطأ في الإرسال"); setStep("recipients"); return; }
    setResult({ sent: j.sent, total: j.total });
    setStep("done");
  };

  const lineCount = recipientsRaw.split("\n").filter(l => l.trim()).length;

  if (step === "done" && result) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-8 text-center max-w-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-panel2 border border-line mx-auto mb-4">
          <CheckCircle size={32} className="text-accent" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">تم إرسال الحملة!</h2>
        <p className="text-muted text-sm mb-1">أُرسل إلى <span className="text-ink font-bold">{result.sent}</span> من أصل <span className="text-ink font-bold">{result.total}</span> مستلم</p>
        <p className="text-muted2 text-xs mb-6">يمكنك متابعة إحصائيات الفتح في تبويب "الحملات السابقة"</p>
        <button onClick={onSent} className="flex items-center gap-2 mx-auto rounded-xl bg-accent text-accent-fg px-5 py-2.5 text-sm font-bold hover:opacity-90">
          <BarChart2 size={15} /> عرض الإحصائيات
        </button>
      </div>
    );
  }

  if (step === "sending") {
    return (
      <div className="rounded-2xl border border-line bg-panel p-10 text-center max-w-md">
        <Loader2 size={36} className="animate-spin text-accent mx-auto mb-4" />
        <p className="text-ink font-semibold">جاري إرسال الحملة…</p>
        <p className="text-muted text-sm mt-1">يرجى الانتظار، لا تغلق الصفحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === "compose" ? "bg-accent text-accent-fg" : "bg-panel2 border border-line text-ink"}`}>1</span>
        <span className={step === "compose" ? "text-ink font-medium" : ""}>إعداد الرسالة</span>
        <ChevronLeft size={14} />
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === "recipients" ? "bg-accent text-accent-fg" : "bg-panel2 border border-line text-ink"}`}>2</span>
        <span className={step === "recipients" ? "text-ink font-medium" : ""}>قائمة المستلمين</span>
      </div>

      {step === "compose" && (
        <div className="rounded-2xl border border-line bg-panel p-6 space-y-4">
          <Field label="اسم الحملة (للمرجعية)" icon={<FileText size={13} />}>
            <input className={inputCls} placeholder="مثلاً: حملة رمضان 2025"
              value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="اسم المرسِل" icon={<User size={13} />}>
            <input className={inputCls} placeholder="Jobbots"
              value={fromName} onChange={e => setFromName(e.target.value)} />
          </Field>
          <Field label="بريد الرد (Reply-To) — اختياري" icon={<Reply size={13} />}>
            <input type="email" dir="ltr" className={inputCls} placeholder="manager@jobbots.org"
              value={replyTo} onChange={e => setReplyTo(e.target.value)} />
          </Field>
          <Field label="عنوان البريد *" icon={<FileText size={13} />}>
            <input className={inputCls} placeholder="مرحباً من Jobbots"
              value={subject} onChange={e => setSubject(e.target.value)} />
          </Field>
          <Field label="نص الرسالة *" icon={<MessageSquare size={13} />}>
            <textarea rows={10} className={`${inputCls} resize-y leading-relaxed`}
              placeholder={"السلام عليكم،\n\nنود إعلامكم بأن..."}
              value={body} onChange={e => setBody(e.target.value)} />
            <p className="text-xs text-muted2 mt-1">يدعم الأسطر الجديدة. ستُضاف بكسل التتبع تلقائياً لمعرفة من فتح الإيميل.</p>
          </Field>
          {err && <div className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger flex items-center gap-2"><AlertCircle size={14} />{err}</div>}
          <div className="flex justify-end">
            <button onClick={saveAndNext} disabled={saving || !name || !subject || !body}
              className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <ChevronLeft size={14} />}
              التالي: قائمة المستلمين
            </button>
          </div>
        </div>
      )}

      {step === "recipients" && (
        <div className="rounded-2xl border border-line bg-panel p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-ink mb-1">قائمة المستلمين</h2>
            <p className="text-xs text-muted">
              أدخل إيميل واحد في كل سطر. يمكن إضافة الاسم بالصيغة: <span dir="ltr" className="font-mono bg-panel2 border border-line rounded px-1">Ahmed &lt;ahmed@example.com&gt;</span>
            </p>
          </div>
          <textarea
            rows={14}
            dir="ltr"
            className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
            placeholder={"ahmed@example.com\nSara <sara@example.com>\ninfo@company.com"}
            value={recipientsRaw}
            onChange={e => setRecipientsRaw(e.target.value)}
          />
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{lineCount > 0 ? <><span className="text-ink font-bold">{lineCount}</span> إيميل مُضاف</> : "لا توجد إيميلات بعد"}</span>
          </div>
          {err && <div className="rounded-xl border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger flex items-center gap-2"><AlertCircle size={14} />{err}</div>}
          <div className="flex items-center justify-between">
            <button onClick={() => setStep("compose")} className="text-sm text-muted hover:text-ink flex items-center gap-1">
              <ChevronLeft size={14} className="rotate-180" /> رجوع
            </button>
            <button onClick={sendCampaign} disabled={sending || lineCount === 0}
              className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              إرسال الحملة ({lineCount} إيميل)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Campaign History ─────────────────────────────────────────────────────────
function CampaignHistory() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/campaigns");
    const j = await r.json();
    setCampaigns(j.campaigns || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <CampaignDetail id={selected} onBack={() => setSelected(null)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted2">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted text-center">
        <Inbox size={40} className="mb-3 opacity-30" />
        <p className="text-sm">لا توجد حملات بعد. أنشئ أول حملة من تبويب "حملة جماعية".</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-muted">{campaigns.length} حملة</span>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink">
          <RefreshCw size={13} /> تحديث
        </button>
      </div>
      {campaigns.map(c => {
        const openRate = c.total_sent > 0 ? Math.round((c.total_opened / c.total_sent) * 100) : 0;
        return (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className="w-full rounded-2xl border border-line bg-panel p-4 text-right hover:border-line2 transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-ink truncate">{c.name}</div>
                <div className="text-xs text-muted mt-0.5 truncate">{c.subject}</div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-xs text-muted">
                {c.sent_at ? (
                  <>
                    <span className="flex items-center gap-1"><Send size={12} />{c.total_sent} أُرسل</span>
                    <span className={`flex items-center gap-1 font-semibold ${openRate >= 30 ? "text-green-600" : openRate >= 10 ? "text-amber-500" : "text-muted"}`}>
                      <Eye size={12} />{c.total_opened} فتح ({openRate}%)
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500"><Clock size={12} />لم يُرسَل</span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {c.sent_at && c.total_sent > 0 && (
                <div className="flex-1 h-1.5 rounded-full bg-panel2 border border-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${openRate}%` }}
                  />
                </div>
              )}
              <span className="text-xs text-muted2 flex items-center gap-1 flex-shrink-0">
                <Clock size={11} />
                {new Date(c.created_at).toLocaleDateString("ar-SA")}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Campaign Detail ──────────────────────────────────────────────────────────
function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<{ campaign: Campaign; recipients: Recipient[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "opened" | "not_opened">("all");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/campaigns/${id}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setData({ campaign: j.campaign, recipients: j.recipients }); })
      .finally(() => setLoading(false));
  }, [id, refresh]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted2">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const { campaign, recipients } = data;
  const opened    = recipients.filter(r => r.opened_at);
  const notOpened = recipients.filter(r => !r.opened_at && !r.error);
  const errored   = recipients.filter(r => r.error);
  const openRate  = recipients.length > 0 ? Math.round((opened.length / recipients.length) * 100) : 0;

  const filtered =
    filter === "opened"     ? opened :
    filter === "not_opened" ? notOpened :
    recipients;

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ChevronLeft size={16} className="rotate-180" /> رجوع
        </button>
        <span className="text-muted">/</span>
        <span className="text-sm font-bold text-ink truncate">{campaign.name}</span>
        <button onClick={() => setRefresh(r => r + 1)} className="mr-auto flex items-center gap-1 text-xs text-muted hover:text-ink">
          <RefreshCw size={12} /> تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الإرسال", value: recipients.length, icon: Send, color: "text-ink" },
          { label: "فتحوا الإيميل",  value: opened.length,    icon: Eye,  color: "text-green-600" },
          { label: "لم يفتحوا",      value: notOpened.length, icon: EyeOff, color: "text-muted" },
          { label: "نسبة الفتح",     value: `${openRate}%`,   icon: BarChart2, color: openRate >= 30 ? "text-green-600" : openRate >= 10 ? "text-amber-500" : "text-muted" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-line bg-panel p-4 text-right">
            <s.icon size={18} className={`mb-2 ${s.color}`} />
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Open rate bar */}
      {recipients.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted mb-1.5">
            <span>نسبة الفتح</span>
            <span className="font-bold text-ink">{openRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-panel2 border border-line overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${openRate}%` }} />
          </div>
        </div>
      )}

      {/* Recipients list */}
      <div className="rounded-2xl border border-line bg-panel overflow-hidden">
        {/* Filter tabs */}
        <div className="flex border-b border-line px-4 pt-3 gap-4">
          {([
            { key: "all",        label: `الكل (${recipients.length})` },
            { key: "opened",     label: `فتحوا (${opened.length})` },
            { key: "not_opened", label: `لم يفتحوا (${notOpened.length})` },
          ] as { key: typeof filter; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`pb-2.5 text-sm font-medium border-b-2 transition-all ${
                filter === f.key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">لا توجد نتائج</div>
        ) : (
          <div className="divide-y divide-line max-h-[420px] overflow-y-auto">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${r.error ? "bg-danger-bg border border-danger-border" : r.opened_at ? "bg-panel2 border border-line" : "bg-panel2 border border-line"}`}>
                  {r.error
                    ? <XCircle size={14} className="text-danger" />
                    : r.opened_at
                    ? <Eye size={14} className="text-green-600" />
                    : <EyeOff size={14} className="text-muted" />}
                </div>
                <div className="min-w-0 flex-1">
                  {r.name && <div className="text-xs font-medium text-ink truncate">{r.name}</div>}
                  <div className="text-xs text-muted truncate" dir="ltr">{r.email}</div>
                  {r.error && <div className="text-[11px] text-danger mt-0.5">{r.error}</div>}
                </div>
                <div className="text-[11px] text-muted2 flex-shrink-0 text-left">
                  {r.opened_at
                    ? <span className="text-green-600 font-medium">{new Date(r.opened_at).toLocaleString("ar-SA")}</span>
                    : r.error ? <span className="text-danger">فشل الإرسال</span>
                    : <span>لم يُفتح</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {errored.length > 0 && (
        <div className="rounded-xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger flex items-center gap-2">
          <AlertCircle size={15} />
          {errored.length} إيميل فشل إرساله
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">{icon}{label}</div>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-[var(--input-bg)] px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-line2";
