"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import {
  Send, Trash2, ExternalLink, Mail, Building2, FileText,
  Loader2, Clock, Hash,
} from "lucide-react";

type PendingJob = {
  id: string;
  title_ar: string;
  company?: string;
  description_ar?: string;
  application_email?: string;
  link_url?: string;
  source_account?: string;
  fetched_at: string;
  status: string;
};

export default function PendingJobsPage() {
  const [rows, setRows] = useState<PendingJob[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [publishing, setPublishing] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PendingJob>>({});

  const load = async () => {
    const r = await fetch(`${API_BASE}/api/admin/pending-jobs`, { credentials: "include" });
    const j = await r.json();
    setRows(j.jobs || []);
  };

  useEffect(() => { load(); }, []);

  const publish = async (job: PendingJob) => {
    setPublishing((s) => new Set(s).add(job.id));
    try {
      const r = await fetch(`${API_BASE}/api/admin/pending-jobs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      const j = await r.json();
      if (!j.ok) { setMsg(j.error || "فشل النشر"); setMsgType("err"); return; }
      setMsg(`تم نشر "${job.title_ar}" ✓`); setMsgType("ok");
      await load();
    } catch { setMsg("خطأ في الاتصال"); setMsgType("err"); }
    finally { setPublishing((s) => { const n = new Set(s); n.delete(job.id); return n; }); }
  };

  const discard = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الوظيفة؟")) return;
    setDeleting((s) => new Set(s).add(id));
    try {
      await fetch(`${API_BASE}/api/admin/pending-jobs`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } catch { setMsg("خطأ في الاتصال"); setMsgType("err"); }
    finally { setDeleting((s) => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const startEdit = (job: PendingJob) => {
    setEditId(job.id);
    setEditForm({ ...job });
  };

  const saveEdit = () => {
    if (!editId) return;
    setRows((prev) => prev.map((j) => (j.id === editId ? { ...j, ...editForm } : j)));
    setEditId(null);
    setEditForm({});
  };

  return (
    <Shell>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line/60">
        <h1 className="text-sm font-bold text-ink">الوظائف الواردة من Telegram</h1>
        <button onClick={load} className="text-xs text-accent hover:underline">تحديث</button>
      </div>

      {msg && (
        <div className={`mx-4 mt-3 rounded-xl px-4 py-2 text-xs font-medium ${
          msgType === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-danger-bg text-danger border border-danger-border"
        }`}>{msg}</div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted2">
          <Clock size={32} className="mb-3 opacity-40" />
          <p className="text-sm">لا توجد وظائف واردة حالياً</p>
          <p className="text-xs mt-1">الوظائف الجديدة من قنوات Telegram ستظهر هنا</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {rows.map((job) => (
            <div key={job.id} className="rounded-2xl border border-line/60 bg-panel shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  {editId === job.id ? (
                    <div className="space-y-2">
                      <input
                        value={editForm.title_ar || ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, title_ar: e.target.value }))}
                        className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
                        placeholder="المسمى الوظيفي"
                      />
                      <div className="flex gap-2">
                        <input
                          value={editForm.company || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                          className="flex-1 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
                          placeholder="الشركة"
                        />
                        <input
                          value={editForm.application_email || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, application_email: e.target.value }))}
                          className="flex-1 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
                          dir="ltr"
                          placeholder="بريد التقديم"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={editForm.link_url || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, link_url: e.target.value }))}
                          className="flex-[2] rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
                          dir="ltr"
                          placeholder="رابط الوظيفة (اختياري)"
                        />
                        <input
                          value={(editForm as any).salary || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, salary: e.target.value }))}
                          className="flex-1 rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none"
                          placeholder="الراتب (اختياري)"
                        />
                      </div>
                      <textarea
                        value={editForm.description_ar || ""}
                        onChange={(e) => setEditForm((f) => ({ ...f, description_ar: e.target.value }))}
                        className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-accent/50 focus:outline-none resize-none"
                        rows={3}
                        placeholder="الوصف"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditId(null)}
                          className="rounded-lg border border-line/70 px-3 py-1.5 text-xs text-muted hover:text-ink transition-colors">
                          إلغاء
                        </button>
                        <button onClick={saveEdit}
                          className="rounded-lg border border-accent/30 bg-accent/15 px-3 py-1.5 text-xs text-accent font-medium hover:bg-accent/25 transition-colors">
                          حفظ التعديلات
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-ink text-sm">{job.title_ar}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted2">
                        {job.company && (
                          <span className="flex items-center gap-1"><Building2 size={10} />{job.company}</span>
                        )}
                        {job.application_email && (
                          <span className="flex items-center gap-1" dir="ltr"><Mail size={10} />{job.application_email}</span>
                        )}
                        {job.source_account && (
                          <span className="flex items-center gap-1"><Hash size={10} />{job.source_account}</span>
                        )}
                        <span className="flex items-center gap-1"><Clock size={10} />{new Date(job.fetched_at).toLocaleDateString("ar-SA")}</span>
                      </div>
                      {job.link_url && (
                        <a href={job.link_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-xs text-accent hover:underline">
                          <ExternalLink size={10} />الرابط
                        </a>
                      )}
                      {job.description_ar && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted2 cursor-pointer hover:text-ink transition-colors flex items-center gap-1">
                            <FileText size={10} />عرض النص الكامل
                          </summary>
                          <p className="mt-1 text-xs text-muted whitespace-pre-wrap bg-panel2 rounded-xl p-2 border border-line/50 leading-relaxed max-h-40 overflow-y-auto">
                            {job.description_ar}
                          </p>
                        </details>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              {editId !== job.id && (
                <div className="flex items-center gap-2 border-t border-line/50 px-4 py-2 bg-panel2">
                  <button onClick={() => startEdit(job)}
                    className="flex items-center gap-1 rounded-lg border border-line/70 px-2.5 py-1 text-xs text-muted hover:text-ink transition-colors">
                    <FileText size={11} /> تعديل
                  </button>
                  <button onClick={() => publish(job)} disabled={publishing.has(job.id)}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-60">
                    {publishing.has(job.id) ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    {publishing.has(job.id) ? "جاري النشر..." : "نشر"}
                  </button>
                  <button onClick={() => discard(job.id)} disabled={deleting.has(job.id)}
                    className="flex items-center gap-1 rounded-lg border border-danger-border bg-danger-bg px-2.5 py-1 text-xs text-danger hover:bg-danger/15 transition-colors disabled:opacity-60 mr-auto">
                    {deleting.has(job.id) ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    حذف
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
