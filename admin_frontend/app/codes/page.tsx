"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";
import { Zap, Copy, CheckCheck, Hash, Calendar, Search, User, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type LookupResult = {
  ok: boolean;
  status: "used" | "unused";
  code: string;
  subscription_days: number;
  used_at?: string;
  user?: {
    id: string;
    full_name: string;
    phone: string;
    city: string;
    age: number;
    email: string;
    subscription_ends_at: string;
  } | null;
};

export default function CodesPage() {
  const [used, setUsed] = useState<string[]>([]);
  const [unused, setUnused] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [count, setCount] = useState(49);
  const [days, setDays] = useState(365);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [loading, setLoading] = useState(false);

  const [lookupCode, setLookupCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");

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
        "/api/admin/codes",
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

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim()) return;
    setLookupLoading(true);
    setLookupResult(null);
    setLookupError("");
    try {
      const res = await fetch(`/api/admin/codes/lookup?code=${encodeURIComponent(lookupCode.trim().toUpperCase())}`, {
        credentials: "include",
      });
      const data: LookupResult = await res.json();
      if (!res.ok) { setLookupError((data as any).error || "خطأ"); return; }
      setLookupResult(data);
    } catch {
      setLookupError("خطأ في الاتصال");
    } finally {
      setLookupLoading(false);
    }
  };

  const copy = async (text: string) => navigator.clipboard.writeText(text);

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">أكواد التفعيل</h1>
        <p className="text-sm text-slate-400 mt-0.5">توليد وإدارة أكواد الاشتراك للمستخدمين</p>
      </div>

      {/* ── Code Lookup ── */}
      <div className="mb-5 rounded-2xl border border-line/70 bg-panel shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search size={17} className="text-accent" />
          <h2 className="font-semibold text-white">البحث عن كود</h2>
        </div>
        <form onSubmit={lookup} className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={lookupCode}
              onChange={e => setLookupCode(e.target.value)}
              placeholder="أدخل الكود هنا..."
              dir="ltr"
              className="w-full rounded-xl border border-line/70 bg-panel2 pr-9 pl-3 py-2.5 text-sm placeholder:text-slate-500 focus:border-accent/50 focus:outline-none uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={lookupLoading || !lookupCode.trim()}
            className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/15 px-5 py-2.5 text-sm text-accent font-medium hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            بحث
          </button>
        </form>

        {lookupError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            <XCircle size={15} /> {lookupError}
          </div>
        )}

        {lookupResult && (
          <div className={`mt-3 rounded-xl border p-4 ${
            lookupResult.status === "used"
              ? "border-white/20 bg-white/5"
              : "border-yellow-500/25 bg-yellow-950/20"
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {lookupResult.status === "used"
                ? <CheckCircle2 size={16} className="text-white/80" />
                : <XCircle size={16} className="text-yellow-400" />}
              <span className={`text-sm font-semibold ${lookupResult.status === "used" ? "text-white" : "text-yellow-300"}`}>
                {lookupResult.status === "used" ? "كود مستخدم" : "كود غير مستخدم"}
              </span>
              <span className="mr-auto text-xs text-slate-500 font-mono">{lookupResult.code}</span>
            </div>
            {lookupResult.status === "unused" && (
              <p className="text-sm text-slate-400">اشتراك {lookupResult.subscription_days} يوم — لم يُستخدم بعد</p>
            )}
            {lookupResult.status === "used" && lookupResult.user && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: "الاسم", val: lookupResult.user.full_name },
                  { label: "الجوال", val: lookupResult.user.phone },
                  { label: "المدينة", val: lookupResult.user.city },
                  { label: "العمر", val: lookupResult.user.age },
                  { label: "البريد", val: lookupResult.user.email || "—" },
                  { label: "ينتهي في", val: lookupResult.user.subscription_ends_at ? new Date(lookupResult.user.subscription_ends_at).toLocaleDateString("ar") : "—" },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-lg bg-white/5 px-3 py-2">
                    <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                    <div className="text-sm text-white font-medium">{String(val)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Generator ── */}
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
              ? "border-white/20 bg-white/5 text-white"
              : "border-red-500/25 bg-red-950/30 text-red-300"
          }`}>
            {msg}
          </div>
        )}
      </div>

      {/* Code blocks */}
      <div className="space-y-4">
        <CodeBlock title="الأكواد المولدة الآن" list={generated} onCopy={copy} accent="white" />
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

  const borderColor = accent === "emerald" ? "border-white/20" : accent === "blue" ? "border-accent/20" : "border-line/70";

  return (
    <div className={`rounded-2xl border bg-panel shadow-card ${borderColor}`}>
      <div className="flex items-center justify-between border-b border-line/50 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-slate-300 hover:border-accent/40 hover:text-accent transition-colors"
        >
          {copied ? <CheckCheck size={12} className="text-white/80" /> : <Copy size={12} />}
          {copied ? "تم النسخ" : "نسخ"}
        </button>
      </div>
      <pre className="max-h-56 overflow-auto p-4 text-xs text-slate-300 leading-relaxed">
        {text || <span className="text-slate-500">لا توجد بيانات</span>}
      </pre>
    </div>
  );
}
