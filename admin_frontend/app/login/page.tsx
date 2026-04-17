"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Lock, ArrowRight, Loader2, Key, Users, BriefcaseBusiness, Megaphone } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "كلمة المرور غير صحيحة"); return; }
      router.replace("/");
    } catch { setError("خطأ في الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  const features = [
    { icon: <Key size={16} strokeWidth={1.5} />, label: "إدارة أكواد التفعيل" },
    { icon: <Users size={16} strokeWidth={1.5} />, label: "متابعة المستخدمين" },
    { icon: <BriefcaseBusiness size={16} strokeWidth={1.5} />, label: "إدارة الوظائف" },
    { icon: <Megaphone size={16} strokeWidth={1.5} />, label: "نشر الإعلانات" },
  ];

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      dir="rtl"
      style={{ background: "radial-gradient(900px at 60% 0%, #1a2d52 0%, #060b18 55%)" }}
    >
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 border border-accent/30 mb-4">
            <Bot size={32} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-white">Jobsa Bot</h1>
          <p className="text-slate-400 text-sm mt-1">لوحة تحكم الإدارة</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-line/60 p-8"
          style={{ background: "rgba(13,22,40,0.9)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 border border-accent/25">
              <Lock size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">تسجيل الدخول</p>
              <p className="text-slate-500 text-xs">أدخل كلمة مرور الأدمن</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-slate-400 text-xs font-medium mb-2">كلمة المرور</label>
            <div className="relative mb-4">
              <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                className="w-full rounded-xl border border-line bg-panel2 text-white text-sm py-3 pr-10 pl-4 outline-none placeholder:text-slate-600 focus:border-accent/50 transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                dir="ltr"
              />
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-all hover:bg-accent-dim disabled:opacity-50"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> جاري التحقق…</>
                : <> دخول <ArrowRight size={16} /></>
              }
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {features.map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-line/40 bg-panel/50 px-4 py-3"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                {icon}
              </div>
              <span className="text-slate-400 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
