"use client";

import Shell from "@/components/shell";
import { apiGet, apiSend } from "@/lib/api";
import { useEffect, useState } from "react";

export default function CodesPage() {
  const [used, setUsed] = useState<string[]>([]);
  const [unused, setUnused] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [count, setCount] = useState(49);
  const [days, setDays] = useState(365);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r = await apiGet<{ ok: boolean; used_codes: string[]; unused_codes: string[] }>(
      "/api/admin/codes"
    );
    setUsed(r.used_codes || []);
    setUnused(r.unused_codes || []);
  };

  useEffect(() => {
    load().catch((e) => setMsg(String(e)));
  }, []);

  const generate = async () => {
    try {
      const r = await apiSend<{ ok: boolean; codes: string[] }>(
        "/api/admin/codes/generate",
        "POST",
        { count, days }
      );
      setGenerated(r.codes || []);
      setMsg("تم توليد الأكواد بنجاح");
      await load();
    } catch (e) {
      setMsg(String(e));
    }
  };

  const copy = async (text: string) => navigator.clipboard.writeText(text);

  return (
    <Shell>
      <section className="space-y-4">
        <div className="rounded-xl border border-line/70 bg-panel/70 p-4">
          <h2 className="mb-3 text-lg font-semibold">توليد الأكواد</h2>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-lg border border-line/60 bg-slate-950/50 px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-line/60 bg-slate-950/50 px-3 py-2 text-sm"
            />
            <button
              onClick={generate}
              className="rounded-lg border border-sky-400/40 bg-sky-500/20 px-3 py-2 text-sm text-sky-100"
            >
              توليد
            </button>
          </div>
          {msg && <div className="mt-2 text-sm text-sky-200">{msg}</div>}
        </div>

        <CodeBlock title="الأكواد المولدة الآن" list={generated} onCopy={copy} />
        <CodeBlock title="الأكواد المستخدمة" list={used} onCopy={copy} />
        <CodeBlock title="الأكواد غير المستخدمة" list={unused} onCopy={copy} />
      </section>
    </Shell>
  );
}

function CodeBlock({
  title,
  list,
  onCopy,
}: {
  title: string;
  list: string[];
  onCopy: (t: string) => Promise<void>;
}) {
  const text = list.join("\n");
  return (
    <div className="rounded-xl border border-line/70 bg-panel/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button
          onClick={() => onCopy(text)}
          className="rounded-lg border border-slate-500/40 bg-slate-700/30 px-3 py-1 text-xs"
        >
          نسخ
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-lg border border-line/50 bg-slate-950/50 p-3 text-xs">
        {text || "لا توجد بيانات"}
      </pre>
    </div>
  );
}
