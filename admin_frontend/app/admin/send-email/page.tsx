"use client";

import { useState } from "react";
import Shell from "@/components/shell";
import { motion } from "framer-motion";
import { Send, Mail, User, FileText, MessageSquare, Reply, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SendEmailPage() {
  const [toEmail, setToEmail]   = useState("");
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo]   = useState("");
  const [sending, setSending]   = useState(false);
  const [status, setStatus]     = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    setSending(true);
    setStatus(null);
    try {
      const r = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: toEmail,
          subject,
          message,
          from_name: fromName || undefined,
          reply_to: replyTo || undefined,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setStatus({ ok: false, msg: j.error || "فشل الإرسال" });
      } else {
        setStatus({ ok: true, msg: "تم إرسال البريد بنجاح ✉️" });
        setToEmail(""); setSubject(""); setMessage(""); setReplyTo("");
      }
    } catch (e) {
      setStatus({ ok: false, msg: "خطأ في الاتصال" });
    }
    setSending(false);
  };

  const canSend = toEmail.trim() && subject.trim() && message.trim() && !sending;

  return (
    <Shell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Mail size={24} className="text-purple-400" />
            إرسال بريد إلكتروني
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            أرسل رسالة إلى أي شخص بالاسم الذي تختاره — تستخدم نفس قناة Resend الرسمية للمنصة.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-line bg-panel p-6 space-y-4"
        >
          {/* Recipient */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
              <User size={13} />
              البريد المرسَل إليه *
            </label>
            <input
              type="email"
              dir="ltr"
              className="w-full rounded-xl border border-line bg-black px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/30 text-right"
              placeholder="user@example.com"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              disabled={sending}
            />
          </div>

          {/* Sender name */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
              <User size={13} />
              اسم المرسِل (يظهر للمستلم) — اختياري
            </label>
            <input
              className="w-full rounded-xl border border-line bg-black px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/30"
              placeholder="مثلاً: إدارة Jobbots — أحمد"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              disabled={sending}
            />
            <p className="text-xs text-slate-500 mt-1.5">
              لو تركته فاضي يُرسل باسم Jobbots الافتراضي.
            </p>
          </div>

          {/* Reply-to */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
              <Reply size={13} />
              بريد الرد (Reply-To) — اختياري
            </label>
            <input
              type="email"
              dir="ltr"
              className="w-full rounded-xl border border-line bg-black px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/30 text-right"
              placeholder="manager@yourdomain.com"
              value={replyTo}
              onChange={e => setReplyTo(e.target.value)}
              disabled={sending}
            />
            <p className="text-xs text-slate-500 mt-1.5">
              لو وضع المستلم رد، يصل على هذا البريد بدلاً من البريد الرسمي للمنصة.
            </p>
          </div>

          {/* Subject */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
              <FileText size={13} />
              عنوان الرسالة *
            </label>
            <input
              className="w-full rounded-xl border border-line bg-black px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/30"
              placeholder="مرحباً، بخصوص حسابك في Jobbots"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          {/* Message */}
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-400 mb-1.5">
              <MessageSquare size={13} />
              نص الرسالة *
            </label>
            <textarea
              rows={10}
              className="w-full rounded-xl border border-line bg-black px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/30 leading-relaxed resize-y"
              placeholder={"السلام عليكم،\n\nنود إعلامكم بأن..."}
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={sending}
            />
            <p className="text-xs text-slate-500 mt-1.5">
              يدعم الأسطر الجديدة. لا تضف HTML — يتم تنسيق الرسالة تلقائياً.
            </p>
          </div>

          {/* Status */}
          {status && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                status.ok
                  ? "border-purple-400/30 bg-purple-400/10 text-purple-200"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {status.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
              {status.msg}
            </div>
          )}

          {/* Send */}
          <div className="flex justify-end pt-1">
            <button
              onClick={send}
              disabled={!canSend}
              className="flex items-center gap-2 rounded-xl bg-white text-black px-5 py-2.5 text-sm font-bold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {sending
                ? <><Loader2 size={14} className="animate-spin" /> جاري الإرسال...</>
                : <><Send size={14} /> إرسال</>}
            </button>
          </div>
        </motion.div>
      </div>
    </Shell>
  );
}
