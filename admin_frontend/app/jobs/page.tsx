"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Building2, Mail, BriefcaseBusiness, Sparkles, CheckCircle2, FileSpreadsheet, Download, Upload, Loader2, Twitter } from "lucide-react";

type Job = {
  id: string;
  title_ar?: string;
  title_en?: string;
  company?: string;
  application_email?: string;
  specializations?: string;
  is_active?: boolean;
  created_at?: string;
};

const EMPTY = { title_ar: "", description_ar: "", application_email: "", company: "" };

export default function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [aiSpecs, setAiSpecs] = useState("");

  const load = async () => {
    const r = await fetch(`${API_BASE}/api/admin/jobs`, { credentials: "include" });
    const j = await r.json();
    setRows(j.jobs || []);
  };

  useEffect(() => { load(); }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const add = async () => {
    if (!form.title_ar.trim() || !form.application_email.trim()) {
      setMsg("عنوان الوظيفة والبريد الإلكتروني مطلوبان");
      setMsgType("err");
      return;
    }
    setAdding(true);
    setMsg("");
    setAiSpecs("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الإضافة");
      setAiSpecs(j.specializations || "");
      setMsg("تمت إضافة الوظيفة بنجاح ✓");
      setMsgType("ok");
      setForm(EMPTY);
      await load();
    } catch (e) {
      setMsg(String(e));
      setMsgType("err");
    } finally {
      setAdding(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulk import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; total: number } | null>(null);

  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ inserted: number; total: number; skipped: number } | null>(null);

  const fetchFromTwitter = async () => {
    setFetching(true);
    setMsg("");
    setFetchResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs/fetch`, {
        method: "POST",
        credentials: "include",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الجلب");
      setFetchResult({ inserted: j.inserted, total: j.total, skipped: j.skipped });
      setMsg(j.inserted > 0 ? `تم جلب ${j.inserted} وظيفة جديدة من تويتر ✓` : "لا توجد وظائف جديدة — كل شيء محدّث");
      setMsgType("ok");
      await load();
    } catch (e: any) {
      setMsg(e?.message || String(e));
      setMsgType("err");
    } finally {
      setFetching(false);
    }
  };

  const downloadTemplate = () => {
    window.location.href = `${API_BASE}/api/admin/jobs/template`;
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setMsg("الرجاء اختيار ملف Excel (.xlsx)"); setMsgType("err"); return;
    }
    setImporting(true); setMsg(""); setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${API_BASE}/api/admin/jobs/bulk`, {
        method: "POST", credentials: "include", body: fd,
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الاستيراد");
      setImportResult({ inserted: j.inserted, total: j.total });
      setMsg(`تم استيراد ${j.inserted} وظيفة بنجاح ✓`); setMsgType("ok");
      await load();
    } catch (e: any) {
      setMsg(e?.message || String(e)); setMsgType("err");
    } finally {
      setImporting(false);
    }
  };


  const del = async (job: Job) => {
    const label = job.title_ar || job.title_en || "هذه الوظيفة";
    if (!window.confirm(`هل تريد حذف "${label}" نهائياً؟\n\nطلبات التقديم السابقة عليها ستبقى محفوظة في السجل بدون ربط بالوظيفة.`)) {
      return;
    }
    setDeletingId(job.id);
    setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحذف");
      setMsg(`تم حذف "${label}" ✓`);
      setMsgType("ok");
      await load();
    } catch (e: any) {
      setMsg(e?.message || String(e));
      setMsgType("err");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Shell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">الوظائف</h1>
          <p className="text-sm text-muted mt-0.5">أضف الوظائف وسيستخرج الذكاء الاصطناعي التخصصات تلقائياً</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={onFileChange}
          />
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel px-3.5 py-2 text-xs text-ink2 font-medium hover:border-accent/40 hover:text-accent transition-colors"
          >
            <Download size={13} />
            تحميل قالب Excel
          </button>
          <button
            onClick={onPickFile}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3.5 py-2 text-xs text-accent font-semibold hover:bg-accent/25 transition-colors disabled:opacity-60"
          >
            {importing
              ? <><Loader2 size={13} className="animate-spin" /> جاري الاستيراد...</>
              : <><Upload size={13} /> رفع ملف Excel</>}
          </button>
          <button
            onClick={fetchFromTwitter}
            disabled={fetching}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs text-sky-400 font-semibold hover:bg-sky-500/20 transition-colors disabled:opacity-60"
          >
            {fetching
              ? <><Loader2 size={13} className="animate-spin" /> جاري الجلب من تويتر...</>
              : <><Twitter size={13} /> جلب من تويتر</>}
          </button>
        </div>
      </div>

      {fetchResult && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Twitter size={16} className="text-sky-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">جلب تويتر اكتمل</div>
            <div className="text-xs mt-0.5 opacity-80">
              {fetchResult.inserted} وظيفة جديدة · {fetchResult.skipped} مكررة تم تخطيها · فحص {fetchResult.total} تغريدة من 7 حسابات
            </div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <FileSpreadsheet size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">تم الاستيراد بنجاح</div>
            <div className="text-xs mt-0.5 opacity-80">
              أُضيفت {importResult.inserted} وظيفة من أصل {importResult.total} في الملف.
              تم استخراج التخصصات بالذكاء الاصطناعي تلقائياً للحقول الفارغة.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Add form */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={17} className="text-accent" />
            <h2 className="font-semibold text-ink">إضافة وظيفة جديدة</h2>
          </div>

          {/* Title AR - required */}
          <div>
            <label className="mb-1.5 block text-xs text-muted">
              عنوان الوظيفة <span className="text-danger">*</span>
            </label>
            <input
              value={form.title_ar}
              onChange={set("title_ar")}
              placeholder="مصمم جرافيك"
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs text-muted">الوصف الوظيفي</label>
            <textarea
              value={form.description_ar}
              onChange={set("description_ar")}
              rows={4}
              placeholder="صف متطلبات الوظيفة والمهام... (يستخدمها الذكاء الاصطناعي لاستخراج التخصصات)"
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none"
            />
          </div>

          {/* Email - required */}
          <div>
            <label className="mb-1.5 block text-xs text-muted">
              البريد للتقديم <span className="text-danger">*</span>
            </label>
            <input
              value={form.application_email}
              onChange={set("application_email")}
              type="email"
              placeholder=""
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
            />
          </div>

          {/* Company - optional */}
          <div>
            <label className="mb-1.5 block text-xs text-muted">اسم الشركة (اختياري)</label>
            <input
              value={form.company}
              onChange={set("company")}
              placeholder="شركة ..."
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
            />
          </div>

          {/* AI hint */}
          <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2.5">
            <Sparkles size={14} className="text-violet-400 mt-0.5 shrink-0" />
            <p className="text-xs text-violet-300/80">
              الذكاء الاصطناعي سيستخرج التخصصات ويطابقها مع تفضيلات المستخدمين تلقائياً
            </p>
          </div>

          {/* AI specs result */}
          {aiSpecs && (
            <div className="flex items-start gap-2 rounded-xl border border-line2 bg-panel2 px-3 py-2.5">
              <CheckCircle2 size={14} className="text-ink/80 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium text-ink mb-1">تخصصات مُولَّدة:</div>
                <div className="text-xs text-muted">{aiSpecs}</div>
              </div>
            </div>
          )}

          {msg && (
            <div className={`rounded-xl border px-4 py-2.5 text-sm ${
              msgType === "ok"
                ? "border-line2 bg-panel2 text-ink"
                : "border-danger-border bg-danger-bg text-danger"
            }`}>
              {msg}
            </div>
          )}

          <button
            onClick={add}
            disabled={adding}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {adding ? (
              <>
                <Sparkles size={15} className="animate-pulse" />
                يحلل بالذكاء الاصطناعي ويضيف...
              </>
            ) : (
              <>
                <Plus size={15} />
                إضافة الوظيفة
              </>
            )}
          </button>
        </div>

        {/* Jobs list */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-line/60 px-5 py-4">
            <BriefcaseBusiness size={16} className="text-accent" />
            <h2 className="font-semibold text-ink">الوظائف ({rows.length})</h2>
          </div>
          <div className="divide-y divide-line/40 max-h-[600px] overflow-y-auto">
            {rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted">لا توجد وظائف — أضف أول وظيفة</div>
            ) : rows.map((j) => (
              <div key={j.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{j.title_ar || j.title_en || "—"}</div>
                    {j.company && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                        <Building2 size={11} /> {j.company}
                      </div>
                    )}
                    {j.application_email && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted2">
                        <Mail size={11} /> {j.application_email}
                      </div>
                    )}
                    {j.specializations && (
                      <div className="mt-1.5 flex items-start gap-1">
                        <Sparkles size={10} className="text-violet-400 mt-0.5 shrink-0" />
                        <div className="text-[10px] text-muted leading-relaxed">{j.specializations}</div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => del(j)}
                    disabled={deletingId === j.id}
                    title="حذف الوظيفة"
                    className="shrink-0 rounded-lg border border-danger-border bg-danger-bg p-2 text-danger hover:bg-danger/15 transition-colors disabled:opacity-40"
                  >
                    {deletingId === j.id
                      ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-danger border-t-transparent" />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
