"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";
import { Plus, Trash2, Building2, Mail, BriefcaseBusiness } from "lucide-react";

type Job = {
  id: string;
  title_ar?: string;
  title_en?: string;
  company?: string;
  application_email?: string;
  is_active?: boolean;
};

const EMPTY_FORM = {
  title_ar: "",
  title_en: "",
  description_ar: "",
  company: "",
  link_url: "",
  application_email: "",
  specializations: "",
};

const FIELD_LABELS: Record<string, string> = {
  title_ar: "عنوان الوظيفة (عربي)",
  title_en: "Job Title (English)",
  description_ar: "الوصف",
  company: "الشركة",
  link_url: "رابط التقديم",
  application_email: "البريد للتقديم",
  specializations: "التخصصات",
};

export default function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const r = await apiGet<{ ok: boolean; jobs: Job[] }>("/api/admin/jobs");
    setRows(r.jobs || []);
  };
  useEffect(() => {
    load().catch((e) => { setMsg(String(e)); setMsgType("err"); });
  }, []);

  const add = async () => {
    setAdding(true);
    try {
      await apiSend("/api/admin/jobs", "POST", form);
      setMsg("تمت إضافة الوظيفة بنجاح ✓");
      setMsgType("ok");
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      setMsg(String(e));
      setMsgType("err");
    } finally {
      setAdding(false);
    }
  };

  const del = async (id: string) => {
    await apiSend(`/api/admin/jobs/${id}`, "DELETE");
    await load();
  };

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">الوظائف</h1>
        <p className="text-sm text-slate-400 mt-0.5">إدارة الوظائف المتاحة في البوت</p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Add form */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={17} className="text-accent" />
            <h2 className="font-semibold text-white">إضافة وظيفة جديدة</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(form).map(([k, v]) => (
              k === "description_ar" ? (
                <div key={k}>
                  <label className="mb-1.5 block text-xs text-slate-400">{FIELD_LABELS[k]}</label>
                  <textarea
                    value={v}
                    onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none resize-none"
                  />
                </div>
              ) : (
                <div key={k}>
                  <label className="mb-1.5 block text-xs text-slate-400">{FIELD_LABELS[k]}</label>
                  <input
                    value={v}
                    onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
                    className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
                  />
                </div>
              )
            ))}
            {msg && (
              <div className={`rounded-xl border px-4 py-2.5 text-sm ${
                msgType === "ok"
                  ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-300"
                  : "border-red-500/25 bg-red-950/30 text-red-300"
              }`}>
                {msg}
              </div>
            )}
            <button
              onClick={add}
              disabled={adding}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
            >
              <Plus size={15} />
              {adding ? "جاري الإضافة..." : "إضافة الوظيفة"}
            </button>
          </div>
        </div>

        {/* Jobs list */}
        <div className="rounded-2xl border border-line/70 bg-panel shadow-card">
          <div className="flex items-center gap-2 border-b border-line/60 px-5 py-4">
            <BriefcaseBusiness size={16} className="text-accent" />
            <h2 className="font-semibold text-white">الوظائف ({rows.length})</h2>
          </div>
          <div className="divide-y divide-line/40 max-h-[600px] overflow-y-auto">
            {rows.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">لا توجد وظائف</div>
            ) : rows.map((j) => (
              <div key={j.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{j.title_ar || j.title_en || "—"}</div>
                    {j.company && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Building2 size={11} /> {j.company}
                      </div>
                    )}
                    {j.application_email && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Mail size={11} /> {j.application_email}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => del(j.id)}
                    className="shrink-0 rounded-lg border border-red-500/25 bg-red-950/30 p-2 text-red-400 hover:bg-red-500/20 transition-colors"
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
