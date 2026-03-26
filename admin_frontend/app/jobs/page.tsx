"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";

type Job = {
  id: string;
  title_ar?: string;
  title_en?: string;
  company?: string;
  application_email?: string;
  is_active?: boolean;
};

export default function JobsPage() {
  const [rows, setRows] = useState<Job[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    title_ar: "",
    title_en: "",
    description_ar: "",
    company: "",
    link_url: "",
    application_email: "",
    specializations: "",
  });

  const load = async () => {
    const r = await apiGet<{ ok: boolean; jobs: Job[] }>("/api/admin/jobs");
    setRows(r.jobs || []);
  };
  useEffect(() => {
    load().catch((e) => setMsg(String(e)));
  }, []);

  const add = async () => {
    try {
      await apiSend("/api/admin/jobs", "POST", form);
      setMsg("تمت إضافة الوظيفة");
      setForm({
        title_ar: "",
        title_en: "",
        description_ar: "",
        company: "",
        link_url: "",
        application_email: "",
        specializations: "",
      });
      await load();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const del = async (id: string) => {
    await apiSend(`/api/admin/jobs/${id}`, "DELETE");
    await load();
  };

  return (
    <Shell>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">إضافة وظيفة</h2>
          <div className="space-y-2">
            {Object.entries(form).map(([k, v]) => (
              <input
                key={k}
                value={v}
                onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
                placeholder={k}
                className="w-full rounded-lg border border-line/60 bg-slate-950/50 px-3 py-2 text-sm"
              />
            ))}
            <button
              onClick={add}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-sm text-sky-100"
            >
              إضافة
            </button>
            {msg && <div className="text-sm text-sky-200">{msg}</div>}
          </div>
        </div>
        <div className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">الوظائف</h2>
          <div className="space-y-2">
            {rows.map((j) => (
              <div key={j.id} className="rounded-lg border border-line/50 bg-slate-950/40 p-3 text-sm">
                <div className="font-medium">{j.title_ar || j.title_en || "—"}</div>
                <div className="text-slate-300">{j.company || "—"}</div>
                <div className="mt-2">
                  <button
                    onClick={() => del(j.id)}
                    className="rounded-lg border border-red-400/30 bg-red-500/20 px-2 py-1 text-xs text-red-100"
                  >
                    حذف/تعطيل
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  );
}
