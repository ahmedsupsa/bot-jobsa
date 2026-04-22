"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import { Plus, Trash2, Building2, Mail, BriefcaseBusiness, Sparkles, CheckCircle2 } from "lucide-react";

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

  const del = async (id: string) => {
    await fetch(`${API_BASE}/api/admin/jobs`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  };

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">الوظائف</h1>
        <p className="text-sm text-muted mt-0.5">أضف الوظائف وسيستخرج الذكاء الاصطناعي التخصصات تلقائياً</p>
      </div>

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
              placeholder="hr@company.com"
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
                    onClick={() => del(j.id)}
                    className="shrink-0 rounded-lg border border-danger-border bg-danger-bg p-2 text-danger hover:bg-danger-bg transition-colors"
                  >
                    <Trash2 size={14} />
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
