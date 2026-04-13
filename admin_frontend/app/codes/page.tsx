"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";
import { Zap, Copy, CheckCheck, Hash, Calendar } from "lucide-react";

export default function CodesPage() {
  const [used, setUsed] = useState<string[]>([]);
  const [unused, setUnused] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [count, setCount] = useState(49);
  const [days, setDays] = useState(365);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const r = await apiGet<{ ok: boolean; used_codes: string[]; unused_codes: string[] }>(
      "/api/admin/codes"
    );
    setUsed(r.used_codes || []);
    setUnused(r.unused_codes || []);
  };

  useEffect(() => {
    load().catch((e) => { setMsg(String(e)); setMsgType("err"); });
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const r = await apiSend<{ ok: boolean; codes: string[] }>(
        "/api/admin/codes/generate",
        "POST",
        { count, days }
      );
      setGenerated(r.codes || []);
      setMsg(`تم توليد ${r.codes?.length || 0} كود بنجاح ✓`);
      setMsgType("ok");
      await load();
    } catch (e) {
      setMsg(String(e));
      setMsgType("err");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => navigator.clipboard.writeText(text);

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">أكواد التفعيل</h1>
        <p className="text-sm text-slate-400 mt-0.5">توليد وإدارة أكواد الاشتراك للمستخدمين</p>
      </div>

      {/* Generator */}
      <div className="mb-5 rounded-2xl border border-line/70 bg-panel shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={17} className="text-accent" />
          <h2 className="font-semibold text-white">توليد أكواد جديدة</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
              <Hash size={12} /> عدد الأكواد
            </label>
            <input
              type="number"
              value={count}
              min={1} max={500}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm focus:border-accent/50 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar size={12} /> أيام الاشتراك
            </label>
            <input
              type="number"
              value={days}
              min={1}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full rounded-xl border border-line/70 bg-panel2 px-3 py-2.5 text-sm focus:border-accent/50 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-5 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
            >
              <Zap size={14} />
              {loading ? "جاري التوليد..." : "توليد"}
            </button>
          </div>
        </div>
        {msg && (
          <div className={`mt-3 rounded-xl border px-4 py-2.5 text-sm ${
            msgType === "ok"
              ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-300"
              : "border-red-500/25 bg-red-950/30 text-red-300"
          }`}>
            {msg}
          </div>
        )}
      </div>

      {/* Code blocks */}
      <div className="space-y-4">
        <CodeBlock title="الأكواد المولدة الآن" list={generated} onCopy={copy} accent="emerald" />
        <div className="grid gap-4 xl:grid-cols-2">
          <CodeBlock title={`الأكواد غير المستخدمة (${unused.length})`} list={unused} onCopy={copy} accent="blue" />
          <CodeBlock title={`الأكواد المستخدمة (${used.length})`} list={used} onCopy={copy} accent="slate" />
        </div>
      </div>
    </Shell>
  );
}

function CodeBlock({
  title,
  list,
  onCopy,
  accent,
}: {
  title: string;
  list: string[];
  onCopy: (t: string) => Promise<void>;
  accent: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = list.join("\n");

  const handleCopy = async () => {
    await onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const borderColor = accent === "emerald" ? "border-emerald-500/20" : accent === "blue" ? "border-accent/20" : "border-line/70";

  return (
    <div className={`rounded-2xl border bg-panel shadow-card ${borderColor}`}>
      <div className="flex items-center justify-between border-b border-line/50 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-slate-300 hover:border-accent/40 hover:text-accent transition-colors"
        >
          {copied ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? "تم النسخ" : "نسخ"}
        </button>
      </div>
      <pre className="max-h-56 overflow-auto p-4 text-xs text-slate-300 leading-relaxed">
        {text || <span className="text-slate-500">لا توجد بيانات</span>}
      </pre>
    </div>
  );
}
