"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Plus, Trash2, Building2, Mail, BriefcaseBusiness, Sparkles,
  CheckCircle2, FileSpreadsheet, Download, Upload, Loader2,
  Clock, AlertTriangle, CheckSquare, Square, X, Filter,
} from "lucide-react";

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

function daysAgo(iso?: string): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export default function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [aiSpecs, setAiSpecs] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; total: number } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ inserted: number; total: number; skipped: number } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const load = async () => {
    const r = await fetch(`${API_BASE}/api/admin/jobs`, { credentials: "include" });
    const j = await r.json();
    setRows(j.jobs || []);
    setSelected(new Set());
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "expired") return rows.filter(j => daysAgo(j.created_at) > 10);
    if (filter === "active") return rows.filter(j => daysAgo(j.created_at) <= 10);
    return rows;
  }, [rows, filter]);

  const expiredCount = useMemo(() => rows.filter(j => daysAgo(j.created_at) > 10).length, [rows]);
  const activeCount  = useMemo(() => rows.filter(j => daysAgo(j.created_at) <= 10).length, [rows]);

  const allSelected = filtered.length > 0 && filtered.every(j => selected.has(j.id));
  const someSelected = filtered.some(j => selected.has(j.id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach(j => next.delete(j.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach(j => next.add(j.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const set = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(s => ({ ...s, [k]: e.target.value }));

  const add = async () => {
    if (!form.title_ar.trim() || !form.application_email.trim()) {
      setMsg("عنوان الوظيفة والبريد الإلكتروني مطلوبان"); setMsgType("err"); return;
    }
    setAdding(true); setMsg(""); setAiSpecs("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الإضافة");
      setAiSpecs(j.specializations || "");
      setMsg("تمت إضافة الوظيفة بنجاح ✓"); setMsgType("ok");
      setForm(EMPTY); await load();
    } catch (e: any) { setMsg(String(e)); setMsgType("err"); }
    finally { setAdding(false); }
  };

  const delOne = async (job: Job) => {
    const label = job.title_ar || job.title_en || "هذه الوظيفة";
    if (!window.confirm(`حذف "${label}" نهائياً؟`)) return;
    setDeletingIds(s => new Set(s).add(job.id));
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحذف");
      setMsg(`تم حذف "${label}" ✓`); setMsgType("ok");
      await load();
    } catch (e: any) { setMsg(String(e)); setMsgType("err"); }
    finally { setDeletingIds(s => { const n = new Set(s); n.delete(job.id); return n; }); }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(`حذف ${ids.length} وظيفة نهائياً؟`)) return;
    setBulkDeleting(true); setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحذف");
      setMsg(`تم حذف ${j.deleted || ids.length} وظيفة ✓`); setMsgType("ok");
      await load();
    } catch (e: any) { setMsg(String(e)); setMsgType("err"); }
    finally { setBulkDeleting(false); }
  };

  const deleteExpired = async () => {
    if (!window.confirm(`حذف ${expiredCount} وظيفة منتهية الصلاحية (أكثر من 10 أيام)؟`)) return;
    setBulkDeleting(true); setMsg("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "expired" }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الحذف");
      setMsg(`تم حذف ${j.deleted} وظيفة منتهية ✓`); setMsgType("ok");
      await load();
    } catch (e: any) { setMsg(String(e)); setMsgType("err"); }
    finally { setBulkDeleting(false); }
  };

  const fetchFromText = async () => {
    if (!pasteText.trim()) return;
    setFetching(true); setMsg(""); setFetchResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/jobs/fetch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الاستخراج");
      setFetchResult({ inserted: j.inserted, total: j.total, skipped: j.skipped });
      setMsg(j.inserted > 0 ? `تم استخراج ${j.inserted} وظيفة جديدة ✓` : (j.message || "لم يجد الذكاء الاصطناعي وظائف"));
      setMsgType(j.inserted > 0 ? "ok" : "err");
      if (j.inserted > 0) { setPasteText(""); setShowPaste(false); }
      await load();
    } catch (e: any) { setMsg(e?.message || String(e)); setMsgType("err"); }
    finally { setFetching(false); }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) { setMsg("الرجاء اختيار ملف Excel (.xlsx)"); setMsgType("err"); return; }
    setImporting(true); setMsg(""); setImportResult(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch(`${API_BASE}/api/admin/jobs/bulk`, { method: "POST", credentials: "include", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الاستيراد");
      setImportResult({ inserted: j.inserted, total: j.total });
      setMsg(`تم استيراد ${j.inserted} وظيفة بنجاح ✓`); setMsgType("ok");
      await load();
    } catch (e: any) { setMsg(e?.message || String(e)); setMsgType("err"); }
    finally { setImporting(false); }
  };

  return (
    <Shell>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">الوظائف</h1>
          <p className="text-sm text-muted mt-0.5">
            {rows.length} وظيفة إجمالاً · {activeCount} نشطة · {expiredCount > 0 && (
              <span className="text-orange-400">{expiredCount} منتهية</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onFileChange} />
          <button
            onClick={() => window.location.href = `${API_BASE}/api/admin/jobs/template`}
            className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-panel px-3.5 py-2 text-xs text-ink2 font-medium hover:border-accent/40 hover:text-accent transition-colors"
          >
            <Download size={13} /> تحميل قالب Excel
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/15 px-3.5 py-2 text-xs text-accent font-semibold hover:bg-accent/25 transition-colors disabled:opacity-60"
          >
            {importing ? <><Loader2 size={13} className="animate-spin" /> استيراد...</> : <><Upload size={13} /> رفع ملف Excel</>}
          </button>
          <button
            onClick={() => setShowPaste(s => !s)}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs text-sky-400 font-semibold hover:bg-sky-500/20 transition-colors"
          >
            <Sparkles size={13} /> استخراج بالذكاء الاصطناعي
          </button>
          {expiredCount > 0 && (
            <button
              onClick={deleteExpired}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-2 text-xs text-orange-400 font-semibold hover:bg-orange-500/20 transition-colors disabled:opacity-60"
            >
              <AlertTriangle size={13} /> حذف المنتهية ({expiredCount})
            </button>
          )}
        </div>
      </div>

      {/* AI paste panel */}
      {showPaste && (
        <div className="mb-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-sky-400" />
            <span className="text-sm font-semibold text-ink">استخراج وظائف بالذكاء الاصطناعي</span>
          </div>
          <p className="text-xs text-muted">انسخ التغريدات وألصقها هنا — الذكاء الاصطناعي يستخرج الوظائف تلقائياً</p>
          <textarea
            value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6}
            placeholder="الصق التغريدات هنا..."
            className="w-full rounded-xl border border-line/70 bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-sky-500/50 focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={fetchFromText} disabled={fetching || !pasteText.trim()}
              className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/15 px-4 py-2 text-sm text-sky-400 font-semibold hover:bg-sky-500/25 transition-colors disabled:opacity-50">
              {fetching ? <><Loader2 size={14} className="animate-spin" /> يستخرج...</> : <><Sparkles size={14} /> استخرج الوظائف</>}
            </button>
            <button onClick={() => { setShowPaste(false); setPasteText(""); }}
              className="rounded-xl border border-line/70 px-4 py-2 text-sm text-muted hover:text-ink transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Results banners */}
      {fetchResult && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Sparkles size={16} className="text-sky-500 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">اكتمل الاستخراج</div>
            <div className="text-xs mt-0.5 opacity-80">{fetchResult.inserted} جديدة · {fetchResult.skipped} مكررة · {fetchResult.total} تعرّف عليها</div>
          </div>
        </div>
      )}
      {importResult && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <FileSpreadsheet size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">تم الاستيراد بنجاح</div>
            <div className="text-xs mt-0.5 opacity-80">{importResult.inserted} وظيفة من أصل {importResult.total}</div>
          </div>
        </div>
      )}
      {msg && (
        <div className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${msgType === "ok" ? "border-line2 bg-panel2 text-ink" : "border-danger-border bg-danger-bg text-danger"}`}>
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Add form */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus size={17} className="text-accent" />
            <h2 className="font-semibold text-ink">إضافة وظيفة جديدة</h2>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">عنوان الوظيفة <span className="text-danger">*</span></label>
            <input value={form.title_ar} onChange={set("title_ar")} placeholder="مصمم جرافيك"
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">الوصف الوظيفي</label>
            <textarea value={form.description_ar} onChange={set("description_ar")} rows={4}
              placeholder="صف متطلبات الوظيفة..." 
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">البريد للتقديم <span className="text-danger">*</span></label>
            <input value={form.application_email} onChange={set("application_email")} type="email"
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">اسم الشركة (اختياري)</label>
            <input value={form.company} onChange={set("company")} placeholder="شركة ..."
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none" />
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-950/20 px-3 py-2.5">
            <Sparkles size={14} className="text-violet-400 mt-0.5 shrink-0" />
            <p className="text-xs text-violet-300/80">الذكاء الاصطناعي يستخرج التخصصات ويطابقها مع المستخدمين تلقائياً</p>
          </div>
          {aiSpecs && (
            <div className="flex items-start gap-2 rounded-xl border border-line2 bg-panel2 px-3 py-2.5">
              <CheckCircle2 size={14} className="text-ink/80 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-medium text-ink mb-1">تخصصات مُولَّدة:</div>
                <div className="text-xs text-muted">{aiSpecs}</div>
              </div>
            </div>
          )}
          <button onClick={add} disabled={adding}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50">
            {adding ? <><Sparkles size={15} className="animate-pulse" /> يحلل ويضيف...</> : <><Plus size={15} /> إضافة الوظيفة</>}
          </button>
        </div>

        {/* Jobs list */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card flex flex-col">
          {/* List header */}
          <div className="flex items-center justify-between gap-2 border-b border-line/60 px-4 py-3 flex-wrap gap-y-2">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness size={16} className="text-accent" />
              <h2 className="font-semibold text-ink text-sm">الوظائف ({filtered.length})</h2>
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1 rounded-xl border border-line/60 bg-panel2 p-1">
              {([["all","الكل"], ["active","نشطة"], ["expired","منتهية"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => { setFilter(v); setSelected(new Set()); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${filter === v ? "bg-accent text-accent-fg" : "text-muted hover:text-ink"}`}>
                  {label}
                  {v === "expired" && expiredCount > 0 && <span className="mr-1 text-orange-400">({expiredCount})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk actions bar */}
          {someSelected && (
            <div className="flex items-center justify-between gap-2 border-b border-line/60 bg-accent/5 px-4 py-2">
              <span className="text-xs text-accent font-semibold">{selected.size} محدد</span>
              <div className="flex gap-2">
                <button onClick={() => setSelected(new Set())}
                  className="flex items-center gap-1 rounded-lg border border-line/70 px-2.5 py-1 text-xs text-muted hover:text-ink transition-colors">
                  <X size={11} /> إلغاء التحديد
                </button>
                <button onClick={bulkDelete} disabled={bulkDeleting}
                  className="flex items-center gap-1 rounded-lg border border-danger-border bg-danger-bg px-2.5 py-1 text-xs text-danger font-semibold hover:bg-danger/15 transition-colors disabled:opacity-60">
                  {bulkDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  حذف المحدد ({selected.size})
                </button>
              </div>
            </div>
          )}

          {/* Select all row */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 border-b border-line/40 px-4 py-2 bg-panel2/50">
              <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors">
                {allSelected ? <CheckSquare size={14} className="text-accent" /> : someSelected ? <CheckSquare size={14} className="text-muted" /> : <Square size={14} />}
                {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
            </div>
          )}

          {/* List */}
          <div className="divide-y divide-line/40 overflow-y-auto" style={{ maxHeight: 540 }}>
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted">لا توجد وظائف</div>
            ) : filtered.map(j => {
              const days = daysAgo(j.created_at);
              const expired = days > 10;
              const isSelected = selected.has(j.id);
              return (
                <div key={j.id}
                  className={`px-4 py-3 transition-colors ${isSelected ? "bg-accent/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    {/* Checkbox */}
                    <button onClick={() => toggleOne(j.id)}
                      className="mt-0.5 shrink-0 text-muted hover:text-accent transition-colors">
                      {isSelected ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                    </button>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink leading-tight">{j.title_ar || j.title_en || "—"}</span>
                        {expired ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                            <AlertTriangle size={9} /> منتهية ({days}ي)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                            <Clock size={9} /> {days === 0 ? "اليوم" : `${days}ي`}
                          </span>
                        )}
                      </div>
                      {j.company && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted">
                          <Building2 size={10} /> {j.company}
                        </div>
                      )}
                      {j.application_email && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted2">
                          <Mail size={10} /> {j.application_email}
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted2">
                        <Clock size={9} /> أُضيفت {fmtDate(j.created_at)}
                        {expired && <span className="text-orange-400 mr-1">· البوت لن يقدم عليها</span>}
                      </div>
                      {j.specializations && (
                        <div className="mt-1.5 flex items-start gap-1">
                          <Sparkles size={10} className="text-violet-400 mt-0.5 shrink-0" />
                          <div className="text-[10px] text-muted leading-relaxed line-clamp-2">{j.specializations}</div>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <button onClick={() => delOne(j)} disabled={deletingIds.has(j.id)}
                      className="shrink-0 rounded-lg border border-danger-border bg-danger-bg p-1.5 text-danger hover:bg-danger/15 transition-colors disabled:opacity-40">
                      {deletingIds.has(j.id)
                        ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-danger border-t-transparent" />
                        : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
