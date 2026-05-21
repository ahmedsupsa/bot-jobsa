"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import Shell from "@/components/shell";
import {
  Send, Mail, User, FileText, MessageSquare, Reply, CheckCircle, XCircle,
  Loader2, Users, BarChart2, Eye, Clock, ChevronLeft, ChevronRight,
  Inbox, AlertCircle, RefreshCw, Zap, TrendingUp, ArrowUpRight,
  Paperclip, AtSign, Sparkles, Radio, Pencil, Trash2, Square, CheckSquare, X,
} from "lucide-react";

type Campaign = {
  id: string; name: string; subject: string; from_name: string;
  total_sent: number; total_opened: number; created_at: string; sent_at: string | null;
};
type Tab = "quick" | "campaign" | "history";

// ── helpers ──────────────────────────────────────────────────────────────────
function buildPreviewHtml(subject: string, body: string, name = "المستلم") {
  const personalizedBody = body.replace(/\{\{name\}\}/gi, name);
  const safeBody = personalizedBody.replace(/\n/g, "<br>");
  return `<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:540px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 32px;direction:rtl;text-align:right;">
    <h2 style="color:#1a1a1a;margin:0 0 14px;font-size:18px;border-bottom:1px solid #f0f0f0;padding-bottom:14px;">${subject || "عنوان الرسالة"}</h2>
    <div style="color:#444;line-height:1.9;font-size:14px;">${safeBody || '<span style="color:#aaa">نص الرسالة يظهر هنا...</span>'}</div>
    <hr style="border:none;border-top:1px solid #f0f0f0;margin:20px 0 14px;">
    <p style="color:#bbb;font-size:11px;margin:0;text-align:center;">Jobbots — منصة التقديم التلقائي للوظائف</p>
  </div>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SendEmailPage() {
  const [tab, setTab] = useState<Tab>("quick");

  const TABS: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
    { key: "quick",    label: "إرسال سريع",       icon: Zap,       desc: "رسالة فردية فورية" },
    { key: "campaign", label: "حملة جماعية",      icon: Radio,     desc: "إرسال لقائمة مستلمين" },
    { key: "history",  label: "الحملات السابقة",  icon: BarChart2, desc: "إحصائيات ومتابعة" },
  ];

  return (
    <Shell>
      <div className="max-w-6xl space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 border border-accent/25">
                <Mail size={20} className="text-accent" />
              </div>
              <h1 className="text-2xl font-bold text-ink">البريد الإلكتروني</h1>
            </div>
            <p className="text-sm text-muted mr-14">إرسال سريع، حملات جماعية، وتتبع الفتح</p>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-right transition-all ${
                tab === t.key
                  ? "border-accent/50 bg-accent/10 shadow-sm"
                  : "border-line/70 bg-panel hover:border-accent/30 hover:bg-panel2"
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                tab === t.key ? "bg-accent text-white" : "bg-panel2 border border-line text-muted2"
              }`}>
                <t.icon size={15} />
              </div>
              <span className={`text-sm font-semibold ${tab === t.key ? "text-accent" : "text-ink"}`}>{t.label}</span>
              <span className="text-[11px] text-muted2">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {tab === "quick"    && <QuickSend />}
        {tab === "campaign" && <CampaignCreate onSent={() => setTab("history")} />}
        {tab === "history"  && <CampaignHistory />}
      </div>
    </Shell>
  );
}

// ── Quick Send ────────────────────────────────────────────────────────────────
function QuickSend() {
  const [toEmail, setToEmail]   = useState("");
  const [toName, setToName]     = useState("");
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo]   = useState("");
  const [sending, setSending]   = useState(false);
  const [status, setStatus]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [messages, setMessages] = useState<any[] | null>(null);

  const loadHistory = useCallback(() => {
    fetch("/api/admin/sent-private-messages", { credentials: "include" })
      .then(r => r.json()).then(d => setMessages(Array.isArray(d) ? d : []));
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const send = async () => {
    setSending(true); setStatus(null);
    try {
      const r = await fetch("/api/admin/send-email", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: toEmail, to_name: toName || undefined, subject, message, from_name: fromName || undefined, reply_to: replyTo || undefined }),
      });
      const j = await r.json();
      if (!j.ok) { setStatus({ ok: false, msg: j.error || "فشل الإرسال" }); }
      else {
        setStatus({ ok: true, msg: "تم الإرسال بنجاح ✉️" });
        setToEmail(""); setToName(""); setSubject(""); setMessage(""); setReplyTo("");
        loadHistory();
      }
    } catch { setStatus({ ok: false, msg: "خطأ في الاتصال" }); }
    setSending(false);
  };

  const canSend = toEmail.trim() && subject.trim() && message.trim() && !sending;
  const preview = useMemo(() => buildPreviewHtml(subject, message, toName || "المستلم"), [subject, message, toName]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* ─ Composer ─ */}
      <div className="lg:col-span-3 rounded-2xl border border-line/70 bg-panel shadow-card overflow-hidden">
        {/* Email header bar */}
        <div className="border-b border-line/60 bg-panel2/50 px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted2 w-10 shrink-0 text-left">إلى</span>
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <AtSign size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2" />
                <input type="email" dir="ltr" value={toEmail} onChange={e => setToEmail(e.target.value)}
                  placeholder="user@example.com" disabled={sending}
                  className="w-full rounded-xl border border-line/70 bg-panel pr-8 pl-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
              </div>
              <div className="relative flex-1">
                <User size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2" />
                <input value={toName} onChange={e => setToName(e.target.value)}
                  placeholder="اسم المستلم" disabled={sending}
                  className="w-full rounded-xl border border-line/70 bg-panel pr-8 pl-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted2 w-10 shrink-0 text-left">من</span>
            <input value={fromName} onChange={e => setFromName(e.target.value)}
              placeholder="Jobbots (اسم المرسِل)" disabled={sending}
              className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted2 w-10 shrink-0 text-left">رد</span>
            <input type="email" dir="ltr" value={replyTo} onChange={e => setReplyTo(e.target.value)}
              placeholder="reply@domain.com (اختياري)" disabled={sending}
              className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted2 w-10 shrink-0 text-left">عنوان</span>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="موضوع الرسالة..." disabled={sending}
              className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none font-medium" />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <textarea rows={10} value={message} onChange={e => setMessage(e.target.value)} disabled={sending}
            placeholder={"السلام عليكم {{name}}،\n\nنود إعلامكم بأن..."}
            className="w-full rounded-xl border border-line/70 bg-panel2/50 px-4 py-3 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none leading-relaxed" />
          <p className="text-[11px] text-muted2 flex items-center gap-1.5">
            <Sparkles size={11} />
            اكتب <code className="font-mono bg-panel2 border border-line/60 rounded px-1.5 py-0.5 mx-1">{"{{name}}"}</code> ليُستبدل باسم المستلم تلقائياً
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-line/60 px-5 py-3 flex items-center justify-between gap-3">
          {status ? (
            <div className={`flex items-center gap-2 text-sm rounded-xl border px-3 py-1.5 ${
              status.ok ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-danger-border bg-danger-bg text-danger"
            }`}>
              {status.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {status.msg}
            </div>
          ) : <div />}
          <button onClick={send} disabled={!canSend}
            className="flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm">
            {sending ? <><Loader2 size={14} className="animate-spin" /> جاري الإرسال...</> : <><Send size={14} /> إرسال</>}
          </button>
        </div>
      </div>

      {/* ─ Right panel: Preview + History ─ */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Live Preview */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card overflow-hidden">
          <div className="border-b border-line/60 px-4 py-3 flex items-center gap-2">
            <Eye size={13} className="text-muted2" />
            <span className="text-xs font-semibold text-muted2">معاينة مباشرة</span>
            {(subject || message) && (
              <span className="mr-auto text-[10px] rounded-md border border-green-500/30 bg-green-500/10 text-green-400 px-1.5 py-0.5">حي</span>
            )}
          </div>
          <div className="p-3 bg-[#f5f5f5] dark:bg-panel2/30 min-h-[180px]">
            <div dangerouslySetInnerHTML={{ __html: preview }}
              className="text-sm rounded-xl overflow-hidden shadow-sm" />
          </div>
        </div>

        {/* Sent History */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card flex-1 overflow-hidden">
          <div className="border-b border-line/60 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-muted2" />
              <span className="text-xs font-semibold text-muted2">آخر الرسائل المُرسَلة</span>
            </div>
            <button onClick={loadHistory} className="text-muted2 hover:text-ink transition-colors">
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="overflow-y-auto max-h-64 divide-y divide-line/30">
            {messages === null ? (
              <div className="flex items-center justify-center py-8 text-muted2 text-xs gap-2">
                <Loader2 size={13} className="animate-spin" /> جاري التحميل...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted2 text-xs gap-2">
                <Inbox size={22} className="opacity-30" />
                لا توجد رسائل مُرسَلة بعد
              </div>
            ) : (
              messages.slice(0, 20).map((msg) => (
                <div key={msg.id} className="px-4 py-3 hover:bg-panel2/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-[11px] font-mono text-accent truncate" dir="ltr">{msg.recipient_email}</span>
                    <span className="text-[10px] text-muted2 shrink-0 whitespace-nowrap">
                      {new Date(msg.sent_at).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                  <p className="text-xs text-ink font-medium truncate">{msg.subject}</p>
                  <p className="text-[11px] text-muted2 truncate mt-0.5">{msg.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Campaign Create ────────────────────────────────────────────────────────────
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

  const lineCount = recipientsRaw.split("\n").filter(l => l.trim()).length;
  const preview   = useMemo(() => buildPreviewHtml(subject, body), [subject, body]);

  const STEPS = [
    { key: "compose",    label: "إعداد الرسالة" },
    { key: "recipients", label: "قائمة المستلمين" },
  ];
  const stepIdx = step === "compose" ? 0 : step === "recipients" ? 1 : 1;

  const saveAndNext = async () => {
    if (!name || !subject || !body) { setErr("الاسم والعنوان والنص مطلوبة"); return; }
    setSaving(true); setErr("");
    const r = await fetch("/api/admin/campaigns", {
      method: "POST", credentials: "include",
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
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients: lines }),
    });
    const j = await r.json();
    setSending(false);
    if (!j.ok) { setErr(j.error || "خطأ في الإرسال"); setStep("recipients"); return; }
    setResult({ sent: j.sent, total: j.total });
    setStep("done");
  };

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Recipients");
    ws.columns = [{ header: "الاسم", key: "name", width: 20 }, { header: "البريد", key: "email", width: 30 }];
    ws.addRow({ name: "Ahmed", email: "ahmed@example.com" });
    ws.addRow({ name: "Sara", email: "sara@example.com" });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    Object.assign(document.createElement("a"), { href: url, download: "recipients_template.xlsx" }).click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result as string, { type: "binary" });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
      const fmt = data.slice(1).map(row => (row[0] ? `${row[0]} <${row[1]}>` : row[1])).filter(Boolean).join("\n");
      setRecipientsRaw(p => p + (p ? "\n" : "") + fmt);
    };
    reader.readAsBinaryString(file);
  };

  if (step === "done" && result) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="rounded-3xl border border-green-500/30 bg-green-500/5 p-10 text-center max-w-sm w-full">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/15 border border-green-500/30 mx-auto mb-5">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="text-lg font-bold text-ink mb-2">تم إرسال الحملة!</h2>
          <div className="flex items-center justify-center gap-6 my-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-ink">{result.sent}</div>
              <div className="text-xs text-muted2">أُرسل</div>
            </div>
            <div className="h-8 w-px bg-line/60" />
            <div className="text-center">
              <div className="text-2xl font-bold text-ink">{result.total}</div>
              <div className="text-xs text-muted2">إجمالي</div>
            </div>
          </div>
          <p className="text-muted2 text-xs mb-6">تابع إحصائيات الفتح في «الحملات السابقة»</p>
          <button onClick={onSent}
            className="flex items-center gap-2 mx-auto rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold hover:opacity-90">
            <BarChart2 size={15} /> عرض الإحصائيات
          </button>
        </div>
      </div>
    );
  }

  if (step === "sending") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="relative mx-auto mb-5 w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-accent/10 flex items-center justify-center">
              <Send size={18} className="text-accent" />
            </div>
          </div>
          <p className="text-ink font-semibold">جاري إرسال الحملة…</p>
          <p className="text-muted text-sm mt-1">يرجى الانتظار، لا تغلق الصفحة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* ─ Left: Form ─ */}
      <div className="lg:col-span-3 space-y-4">
        {/* Steps */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                i < stepIdx ? "bg-green-500 text-white" : i === stepIdx ? "bg-accent text-white" : "bg-panel2 border border-line text-muted2"
              }`}>
                {i < stepIdx ? "✓" : i + 1}
              </div>
              <span className={`text-sm ${i === stepIdx ? "text-ink font-semibold" : "text-muted2"}`}>{s.label}</span>
              {i < STEPS.length - 1 && <ChevronLeft size={14} className="text-muted2 mx-1" />}
            </div>
          ))}
        </div>

        {step === "compose" && (
          <div className="rounded-2xl border border-line/70 bg-panel shadow-card overflow-hidden">
            <div className="border-b border-line/60 bg-panel2/50 px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted2 w-16 shrink-0 text-left">اسم الحملة</span>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً: حملة رمضان 2026"
                  className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted2 w-16 shrink-0 text-left">المرسِل</span>
                <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Jobbots"
                  className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted2 w-16 shrink-0 text-left">رد على</span>
                <input type="email" dir="ltr" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="reply@domain.com"
                  className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted2 w-16 shrink-0 text-left">العنوان</span>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="موضوع الرسالة..."
                  className="flex-1 rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none font-medium" />
              </div>
            </div>
            <div className="p-5">
              <textarea rows={10} value={body} onChange={e => setBody(e.target.value)}
                placeholder={"السلام عليكم {{name}}،\n\nنود إعلامكم بأن..."}
                className="w-full rounded-xl border border-line/70 bg-panel2/50 px-4 py-3 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none leading-relaxed" />
              <p className="text-[11px] text-muted2 mt-2 flex items-center gap-1.5">
                <Sparkles size={11} />
                اكتب <code className="font-mono bg-panel2 border border-line/60 rounded px-1.5 py-0.5 mx-1">{"{{name}}"}</code> ليُستبدل باسم كل مستلم
              </p>
            </div>
            <div className="border-t border-line/60 px-5 py-3 flex items-center justify-between">
              {err && <span className="text-xs text-danger flex items-center gap-1.5"><AlertCircle size={12} />{err}</span>}
              {!err && <div />}
              <button onClick={saveAndNext} disabled={saving || !name || !subject || !body}
                className="flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40 shadow-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                التالي <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        )}

        {step === "recipients" && (
          <div className="rounded-2xl border border-line/70 bg-panel shadow-card overflow-hidden">
            <div className="border-b border-line/60 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">قائمة المستلمين</h3>
                <p className="text-xs text-muted2 mt-0.5">إيميل واحد في كل سطر، أو بصيغة <span dir="ltr" className="font-mono">Name &lt;email&gt;</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-xs border border-line/70 bg-panel2 text-muted2 hover:text-ink px-3 py-1.5 rounded-xl transition-colors">
                  <FileText size={12} /> قالب Excel
                </button>
                <label className="flex items-center gap-1.5 text-xs border border-accent/30 bg-accent/10 text-accent px-3 py-1.5 rounded-xl cursor-pointer hover:bg-accent/20 transition-colors">
                  <Paperclip size={12} /> رفع Excel
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
            <div className="p-5">
              <textarea rows={12} dir="ltr" value={recipientsRaw} onChange={e => setRecipientsRaw(e.target.value)}
                placeholder={"ahmed@example.com\nSara <sara@example.com>\ninfo@company.com"}
                className="w-full rounded-xl border border-line/70 bg-panel2/50 px-4 py-3 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none font-mono leading-relaxed" />
            </div>
            <div className="border-t border-line/60 px-5 py-3 flex items-center justify-between">
              <button onClick={() => setStep("compose")} className="text-sm text-muted hover:text-ink flex items-center gap-1.5 transition-colors">
                <ChevronRight size={14} /> رجوع
              </button>
              <div className="flex items-center gap-4">
                {lineCount > 0 && (
                  <span className="text-xs text-muted2">
                    <span className="font-bold text-ink">{lineCount}</span> إيميل
                  </span>
                )}
                {err && <span className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{err}</span>}
                <button onClick={sendCampaign} disabled={sending || lineCount === 0}
                  className="flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-40 shadow-sm">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  إرسال ({lineCount})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─ Right: Preview ─ */}
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card overflow-hidden sticky top-4">
          <div className="border-b border-line/60 px-4 py-3 flex items-center gap-2">
            <Eye size={13} className="text-muted2" />
            <span className="text-xs font-semibold text-muted2">معاينة الرسالة</span>
          </div>
          <div className="p-3 bg-[#f5f5f5] dark:bg-panel2/30 min-h-[300px]">
            <div dangerouslySetInnerHTML={{ __html: preview }} className="text-sm rounded-xl overflow-hidden shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditCampaignModal({ campaign, onClose, onSaved }: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: (updated: Partial<Campaign>) => void;
}) {
  const [name,     setName]     = useState(campaign.name);
  const [subject,  setSubject]  = useState(campaign.subject);
  const [fromName, setFromName] = useState(campaign.from_name);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  const save = async () => {
    if (!name || !subject) { setErr("الاسم والعنوان مطلوبان"); return; }
    setSaving(true); setErr("");
    const r = await fetch(`/api/admin/campaigns/${campaign.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, from_name: fromName }),
    });
    const j = await r.json();
    setSaving(false);
    if (!j.ok) { setErr(j.error || "خطأ في الحفظ"); return; }
    onSaved({ name, subject, from_name: fromName });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line/70 bg-[var(--bg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-4">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Pencil size={14} className="text-accent" /> تعديل الحملة
          </h3>
          <button onClick={onClose} className="text-muted2 hover:text-ink transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-muted2 mb-1.5 block">اسم الحملة</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm focus:border-accent/50 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted2 mb-1.5 block">عنوان البريد</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm focus:border-accent/50 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted2 mb-1.5 block">اسم المرسِل</label>
            <input value={fromName} onChange={e => setFromName(e.target.value)}
              className="w-full rounded-xl border border-line/70 bg-panel px-3 py-2 text-sm focus:border-accent/50 focus:outline-none" />
          </div>
          {err && <p className="text-xs text-danger flex items-center gap-1"><AlertCircle size={12} />{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line/60 px-5 py-3">
          <button onClick={onClose} className="text-sm text-muted hover:text-ink px-4 py-2 rounded-xl transition-colors">إلغاء</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2 text-sm font-bold hover:opacity-90 disabled:opacity-40">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Campaign History ───────────────────────────────────────────────────────────
function CampaignHistory() {
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [loading, setLoading]       = useState(true);
  const [detailId, setDetailId]     = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting]     = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/campaigns", { credentials: "include" });
    const j = await r.json();
    setCampaigns(j.campaigns || []);
    setCheckedIds(new Set());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── single delete ──
  const deleteSingle = async (id: string) => {
    setDeleting(p => new Set(p).add(id));
    await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE", credentials: "include" });
    setCampaigns(p => p.filter(c => c.id !== id));
    setCheckedIds(p => { const s = new Set(p); s.delete(id); return s; });
    setDeleting(p => { const s = new Set(p); s.delete(id); return s; });
  };

  // ── bulk delete ──
  const deleteBulk = async () => {
    setConfirmBulk(false);
    const ids = [...checkedIds];
    ids.forEach(id => setDeleting(p => new Set(p).add(id)));
    await Promise.all(ids.map(id =>
      fetch(`/api/admin/campaigns/${id}`, { method: "DELETE", credentials: "include" })
    ));
    setCampaigns(p => p.filter(c => !ids.includes(c.id)));
    setCheckedIds(new Set());
    setDeleting(new Set());
  };

  const toggleCheck = (id: string) =>
    setCheckedIds(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setCheckedIds(checkedIds.size === campaigns.length ? new Set() : new Set(campaigns.map(c => c.id)));

  if (detailId) return <CampaignDetail id={detailId} onBack={() => setDetailId(null)} />;

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-muted2 gap-2">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );

  if (campaigns.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-muted text-center">
      <Inbox size={40} className="mb-3 opacity-30" />
      <p className="text-sm">لا توجد حملات بعد.</p>
    </div>
  );

  const totalSent   = campaigns.reduce((s, c) => s + c.total_sent, 0);
  const totalOpened = campaigns.reduce((s, c) => s + c.total_opened, 0);
  const avgOpen     = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const allChecked  = checkedIds.size === campaigns.length;
  const someChecked = checkedIds.size > 0;

  return (
    <>
      {editTarget && (
        <EditCampaignModal
          campaign={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updates) => {
            setCampaigns(p => p.map(c => c.id === editTarget.id ? { ...c, ...updates } : c));
            setEditTarget(null);
          }}
        />
      )}

      {/* Bulk-delete confirm dialog */}
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-danger-border bg-[var(--bg)] shadow-xl p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-bg border border-danger-border mx-auto mb-4">
              <Trash2 size={20} className="text-danger" />
            </div>
            <h3 className="text-sm font-bold text-ink mb-1">حذف {checkedIds.size} حملة؟</h3>
            <p className="text-xs text-muted2 mb-5">سيُحذف المستلمون وكل البيانات المرتبطة بها نهائياً.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setConfirmBulk(false)} className="px-4 py-2 text-sm text-muted hover:text-ink rounded-xl border border-line/60 transition-colors">إلغاء</button>
              <button onClick={deleteBulk} className="px-4 py-2 text-sm font-bold text-white bg-danger rounded-xl hover:opacity-90">تأكيد الحذف</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي الحملات",  value: campaigns.length,            icon: Radio,     color: "text-accent"   },
            { label: "إجمالي المُرسَل", value: totalSent.toLocaleString("ar"), icon: Send,    color: "text-blue-400" },
            { label: "متوسط معدل الفتح",value: `${avgOpen}%`,               icon: TrendingUp, color: avgOpen >= 30 ? "text-green-400" : "text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-line/70 bg-panel shadow-card p-4">
              <div className={`flex items-center gap-2 mb-2 ${s.color}`}>
                <s.icon size={15} /><span className="text-xs text-muted2">{s.label}</span>
              </div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* Select-all checkbox */}
            <button onClick={toggleAll}
              className={`flex items-center gap-2 text-xs rounded-xl border px-3 py-1.5 transition-all ${
                someChecked ? "border-accent/40 bg-accent/10 text-accent" : "border-line/60 bg-panel text-muted2 hover:text-ink"
              }`}>
              {allChecked
                ? <CheckSquare size={13} />
                : someChecked
                  ? <CheckSquare size={13} className="opacity-60" />
                  : <Square size={13} />}
              {someChecked ? `${checkedIds.size} محدد` : "تحديد الكل"}
            </button>

            {someChecked && (
              <button onClick={() => setConfirmBulk(true)}
                className="flex items-center gap-1.5 text-xs text-danger border border-danger-border bg-danger-bg px-3 py-1.5 rounded-xl hover:opacity-80 transition-opacity">
                <Trash2 size={12} /> حذف المحدد ({checkedIds.size})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted2">{campaigns.length} حملة</span>
            <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors">
              <RefreshCw size={12} /> تحديث
            </button>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map(c => {
            const openRate  = c.total_sent > 0 ? Math.round((c.total_opened / c.total_sent) * 100) : 0;
            const isChecked = checkedIds.has(c.id);
            const isDeleting = deleting.has(c.id);

            return (
              <div key={c.id}
                className={`relative rounded-2xl border bg-panel shadow-card transition-all ${
                  isChecked ? "border-accent/50 bg-accent/5" : "border-line/70"
                } ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}>

                {/* Checkbox top-right */}
                <button
                  onClick={() => toggleCheck(c.id)}
                  className="absolute top-3 left-3 z-10 text-muted2 hover:text-accent transition-colors">
                  {isChecked ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                </button>

                {/* Card body — click to view detail */}
                <button onClick={() => setDetailId(c.id)}
                  className="w-full p-4 text-right group">
                  <div className="flex items-start justify-between gap-2 mb-3 pr-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 shrink-0">
                      <Mail size={15} className="text-accent" />
                    </div>
                    <ArrowUpRight size={13} className="text-muted2 group-hover:text-accent transition-colors mt-1 shrink-0" />
                  </div>
                  <div className="text-sm font-bold text-ink truncate mb-0.5">{c.name}</div>
                  <div className="text-xs text-muted2 truncate mb-3">{c.subject}</div>
                  {c.sent_at ? (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-muted2"><Send size={10} />{c.total_sent}</span>
                      <span className={`flex items-center gap-1 font-semibold ${openRate >= 30 ? "text-green-400" : openRate >= 10 ? "text-yellow-400" : "text-muted2"}`}>
                        <Eye size={10} />{openRate}% فتح
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 rounded-md px-2 py-0.5">مسودة</span>
                  )}
                </button>

                {/* Action bar */}
                <div className="border-t border-line/40 px-3 py-2 flex items-center justify-end gap-1">
                  <button
                    onClick={() => setEditTarget(c)}
                    className="flex items-center gap-1.5 text-[11px] text-muted2 hover:text-ink px-2.5 py-1 rounded-lg hover:bg-panel2 transition-all">
                    <Pencil size={11} /> تعديل
                  </button>
                  <button
                    onClick={() => deleteSingle(c.id)}
                    className="flex items-center gap-1.5 text-[11px] text-danger/70 hover:text-danger px-2.5 py-1 rounded-lg hover:bg-danger-bg transition-all">
                    <Trash2 size={11} /> حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Campaign Detail ────────────────────────────────────────────────────────────
function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData]       = useState<{ campaign: Campaign; recipients: any[] } | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/campaigns/${id}`, { credentials: "include" })
      .then(r => r.json()).then(setData);
  }, [id]);

  if (!data) return <div className="flex justify-center py-20"><Loader2 size={22} className="animate-spin text-muted2" /></div>;

  const { campaign: c, recipients } = data;
  const opened  = recipients.filter(r => r.opened_at).length;
  const failed  = recipients.filter(r => r.error).length;
  const pending = recipients.length - opened - failed;
  const openRate = recipients.length > 0 ? Math.round((opened / recipients.length) * 100) : 0;
  const list = showAll ? recipients : recipients.slice(0, 10);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors">
        <ChevronRight size={15} /> العودة للحملات
      </button>

      <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
        <h2 className="text-base font-bold text-ink mb-1">{c.name}</h2>
        <p className="text-sm text-muted2 mb-4">{c.subject}</p>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "أُرسل", value: c.total_sent, color: "text-ink" },
            { label: "فُتح", value: opened, color: "text-green-400" },
            { label: "معدل الفتح", value: `${openRate}%`, color: openRate >= 30 ? "text-green-400" : "text-yellow-400" },
            { label: "فشل", value: failed, color: failed > 0 ? "text-danger" : "text-muted2" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-line/60 bg-panel2/50 p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-muted2 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {openRate > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted2 mb-1.5">
              <span>معدل الفتح</span><span>{openRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-panel2 border border-line/40 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-l from-accent to-accent/50 transition-all"
                style={{ width: `${openRate}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line/70 bg-panel shadow-card overflow-hidden">
        <div className="border-b border-line/60 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">المستلمون ({recipients.length})</span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-green-400"><Eye size={11} />{opened} فتح</span>
            <span className="flex items-center gap-1 text-muted2"><Clock size={11} />{pending} بانتظار</span>
            {failed > 0 && <span className="flex items-center gap-1 text-danger"><XCircle size={11} />{failed} فشل</span>}
          </div>
        </div>
        <div className="divide-y divide-line/30">
          {list.map(r => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-xs font-mono text-muted2" dir="ltr">{r.email}</span>
              <div className="flex items-center gap-2">
                {r.error ? (
                  <span className="text-[11px] border border-danger-border bg-danger-bg text-danger rounded-md px-2 py-0.5 truncate max-w-32" title={r.error}>خطأ</span>
                ) : r.opened_at ? (
                  <span className="text-[11px] border border-green-500/30 bg-green-500/10 text-green-400 rounded-md px-2 py-0.5">
                    فُتح {new Date(r.opened_at).toLocaleDateString("ar-SA")}
                  </span>
                ) : (
                  <span className="text-[11px] border border-line/50 bg-panel2 text-muted2 rounded-md px-2 py-0.5">بانتظار الفتح</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {recipients.length > 10 && (
          <div className="border-t border-line/60 px-5 py-3">
            <button onClick={() => setShowAll(v => !v)} className="text-xs text-accent hover:underline">
              {showAll ? "عرض أقل" : `عرض الكل (${recipients.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm placeholder:text-muted2 focus:border-accent/50 focus:outline-none";
