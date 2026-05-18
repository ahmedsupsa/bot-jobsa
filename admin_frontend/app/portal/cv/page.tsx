"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Upload, FileText, CheckCircle, XCircle,
  Bot, Search, Send, Eye, Calendar,
  Lock, MessageCircle, Sparkles, Loader2, X, Save, RefreshCw,
} from "lucide-react";

interface CVInfo { has_cv: boolean; file_name?: string; updated_at?: string; preview_url?: string; }

export default function CVPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const t = {
    surface: dark ? "#111"    : "#fff",
    border:  dark ? "#1f1f1f" : "#e4e4e7",
    border2: dark ? "#2a2a2a" : "#d4d4d8",
    text:    dark ? "#fff"    : "#09090b",
    text2:   dark ? "#aaa"    : "#71717a",
    text3:   dark ? "#666"    : "#a1a1aa",
    iconBg:  dark ? "#1a1a1a" : "#f4f4f5",
    dashed:  dark ? "#2a2a2a" : "#d4d4d8",
  };

  /* ── CV ── */
  const [cv, setCV] = useState<CVInfo | null>(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cvMsg, setCvMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── مسميات وظيفية ── */
  const [savedTitles, setSavedTitles] = useState<string[]>([]);
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titlesMsg, setTitlesMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [titlesLoading, setTitlesLoading] = useState(true);

  async function loadCV() {
    try {
      const res = await portalFetch("/cv");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      setCV(await res.json());
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setCvLoading(false); }
  }

  async function loadSavedTitles() {
    try {
      const res = await fetch("/api/portal/preferences/save-titles", { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        setSavedTitles(d.titles || []);
        if ((d.titles || []).length > 0) setSuggestedTitles(d.titles);
      }
    } catch {}
    finally { setTitlesLoading(false); }
  }

  useEffect(() => { loadCV(); loadSavedTitles(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setCvMsg(null);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch("/api/portal/cv/upload", { method: "POST", headers: authHeaders(), body: form });
      const d = await res.json();
      if (!res.ok) { setCvMsg({ text: d.error || "فشل الرفع", type: "err" }); return; }
      setCvMsg({ text: "تم رفع السيرة بنجاح ✓", type: "ok" });
      await loadCV();
    } catch { setCvMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file && fileRef.current) {
      const dt = new DataTransfer(); dt.items.add(file);
      fileRef.current.files = dt.files;
      handleUpload({ target: fileRef.current } as any);
    }
  }

  async function handleSuggest() {
    setSuggesting(true); setTitlesMsg(null);
    try {
      const res = await fetch("/api/portal/preferences/suggest", {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (!res.ok) { setTitlesMsg({ text: d.error || "فشل الاقتراح", type: "err" }); return; }
      setSuggestedTitles(d.titles || []);
      setTitlesMsg({ text: `اقترح الذكاء الاصطناعي ${d.titles?.length || 0} مسمى — راجعها وعدّل ثم احفظ`, type: "ok" });
    } catch { setTitlesMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSuggesting(false); }
  }

  async function handleSaveTitles() {
    if (suggestedTitles.length === 0) return;
    setSaving(true); setTitlesMsg(null);
    try {
      const res = await fetch("/api/portal/preferences/save-titles", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ titles: suggestedTitles }),
      });
      const d = await res.json();
      if (!res.ok) { setTitlesMsg({ text: d.error || "فشل الحفظ", type: "err" }); return; }
      setSavedTitles(suggestedTitles);
      setTitlesMsg({ text: `تم حفظ ${d.count} مسمى وظيفي ✓ — البوت سيستخدمها في التطابق`, type: "ok" });
    } catch { setTitlesMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  function removeTitle(title: string) {
    setSuggestedTitles(prev => prev.filter(t => t !== title));
  }

  const uploadedAt = cv?.updated_at
    ? new Date(cv.updated_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const titlesChanged = JSON.stringify(suggestedTitles.slice().sort()) !== JSON.stringify(savedTitles.slice().sort());

  return (
    <PortalShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {cvLoading ? (
          <p style={{ color: t.text3, textAlign: "center", padding: 60 }}>جاري التحميل…</p>
        ) : (
          <>
            {/* رسالة CV */}
            {cvMsg && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "13px 16px", borderRadius: 12, marginBottom: 16,
                fontSize: 13, fontWeight: 500,
                background: cvMsg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
                color: cvMsg.type === "ok" ? (dark ? "#fff" : "#166534") : "#f87171",
                border: `1px solid ${cvMsg.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
              }}>
                {cvMsg.type === "ok" ? <CheckCircle size={16} strokeWidth={1.5} /> : <XCircle size={16} strokeWidth={1.5} />}
                {cvMsg.text}
              </div>
            )}

            {cv?.has_cv ? (
              <>
                {/* بطاقة السيرة */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 18,
                  background: dark ? "#0a1a0a" : "#f0fdf4",
                  border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`, borderRadius: 18,
                  padding: "22px 20px", marginBottom: 14,
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: 15,
                    background: dark ? "#0f2a0f" : "#dcfce7",
                    border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <FileText size={28} strokeWidth={1.2} color={dark ? "#fff" : "#166534"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: dark ? "#0f2a0f" : "#dcfce7",
                      border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`, borderRadius: 100,
                      padding: "3px 12px", fontSize: 11, fontWeight: 700,
                      color: dark ? "#fff" : "#166534", marginBottom: 8,
                    }}>
                      <CheckCircle size={12} strokeWidth={2} /> سيرتك الذاتية مرفوعة وجاهزة
                    </div>
                    <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: "0 0 6px", wordBreak: "break-all" }}>
                      {cv.file_name}
                    </p>
                    {uploadedAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: t.text3, fontSize: 12 }}>
                        <Calendar size={11} /> آخر تحديث: {uploadedAt}
                      </div>
                    )}
                  </div>
                </div>

                {/* معاينة */}
                {cv.preview_url && (
                  <div style={{ marginBottom: 14 }}>
                    <a href={cv.preview_url} target="_blank" rel="noopener noreferrer" style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "10px 18px", borderRadius: 12,
                      background: dark ? "#fff" : "#09090b", color: dark ? "#0a0a0a" : "#fff",
                      fontSize: 13, fontWeight: 700, textDecoration: "none",
                    }}>
                      <Eye size={14} /> معاينة السيرة
                    </a>
                  </div>
                )}

                {/* قفل */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: dark ? "#14100a" : "#fffbeb",
                  border: `1px solid ${dark ? "#78350f" : "#fde68a"}`, borderRadius: 14,
                  padding: "14px 16px", marginBottom: 20,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: dark ? "#1f1500" : "#fef3c7",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Lock size={16} strokeWidth={1.8} color="var(--alert-fg2)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: dark ? "#fcd34d" : "#92400e", fontSize: 13, fontWeight: 700 }}>السيرة الذاتية مقفلة</p>
                    <p style={{ margin: "3px 0 0", color: dark ? "#a78054" : "#b45309", fontSize: 12, lineHeight: 1.5 }}>
                      لتغيير السيرة الذاتية تواصل مع فريق الدعم
                    </p>
                  </div>
                  <a href="/portal/support" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 10,
                    background: "var(--accent)", color: "var(--accent-fg)",
                    fontSize: 12, fontWeight: 700, textDecoration: "none",
                  }}>
                    <MessageCircle size={13} /> الدعم
                  </a>
                </div>

                {/* ── بطاقة المسميات الوظيفية ── */}
                {!titlesLoading && (
                  <div style={{
                    background: dark ? "#0d0d1a" : "#f5f3ff",
                    border: `1px solid ${dark ? "#1e1e3a" : "#ddd6fe"}`,
                    borderRadius: 18, padding: "20px 18px", marginBottom: 20,
                  }}>
                    {/* رأس البطاقة */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          background: dark ? "#1a1a3a" : "#ede9fe",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Sparkles size={17} strokeWidth={1.5} color={dark ? "#a78bfa" : "#7c3aed"} />
                        </div>
                        <div>
                          <p style={{ margin: 0, color: dark ? "#c4b5fd" : "#5b21b6", fontSize: 14, fontWeight: 700 }}>
                            المسميات الوظيفية
                          </p>
                          <p style={{ margin: "2px 0 0", color: t.text3, fontSize: 12 }}>
                            {savedTitles.length > 0
                              ? `${savedTitles.length} مسمى محفوظ — البوت يطابق عليها`
                              : "لم تحدد مسمياتك بعد — الذكاء الاصطناعي سيقترح لك"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleSuggest}
                        disabled={suggesting}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 7,
                          padding: "9px 16px", borderRadius: 10, border: "none",
                          background: dark ? "#7c3aed" : "#7c3aed",
                          color: "#fff", fontSize: 12, fontWeight: 700,
                          cursor: suggesting ? "not-allowed" : "pointer",
                          opacity: suggesting ? 0.7 : 1, fontFamily: "inherit",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {suggesting
                          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جاري التحليل…</>
                          : <><RefreshCw size={13} /> {savedTitles.length > 0 ? "إعادة الاقتراح" : "اقتراح بالذكاء الاصطناعي"}</>
                        }
                      </button>
                    </div>

                    {/* رسالة */}
                    {titlesMsg && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px", borderRadius: 10, marginTop: 12,
                        fontSize: 12, fontWeight: 500,
                        background: titlesMsg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
                        color: titlesMsg.type === "ok" ? (dark ? "#86efac" : "#166534") : "#f87171",
                        border: `1px solid ${titlesMsg.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
                      }}>
                        {titlesMsg.type === "ok" ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        {titlesMsg.text}
                      </div>
                    )}

                    {/* Chips المسميات */}
                    {suggestedTitles.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <p style={{ color: t.text3, fontSize: 12, margin: "0 0 10px" }}>
                          اضغط × لحذف أي مسمى لا يناسبك
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {suggestedTitles.map(title => (
                            <span
                              key={title}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "7px 12px 7px 8px", borderRadius: 100,
                                background: dark ? "#1a1a3a" : "#ede9fe",
                                border: `1px solid ${dark ? "#3a3a6a" : "#c4b5fd"}`,
                                color: dark ? "#c4b5fd" : "#5b21b6",
                                fontSize: 13,
                              }}
                            >
                              {title}
                              <button
                                onClick={() => removeTitle(title)}
                                style={{
                                  background: "transparent", border: "none", cursor: "pointer",
                                  color: dark ? "#a78bfa" : "#7c3aed", padding: 0, display: "flex",
                                  lineHeight: 1,
                                }}
                              >
                                <X size={12} strokeWidth={2.5} />
                              </button>
                            </span>
                          ))}
                        </div>

                        {/* زر الحفظ */}
                        {titlesChanged && (
                          <button
                            onClick={handleSaveTitles}
                            disabled={saving}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                              width: "100%", marginTop: 16, padding: "13px",
                              background: dark ? "#fff" : "#09090b",
                              color: dark ? "#0a0a0a" : "#fff",
                              border: "none", borderRadius: 12,
                              fontSize: 14, fontWeight: 700,
                              cursor: saving ? "not-allowed" : "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {saving
                              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> جاري الحفظ…</>
                              : <><Save size={15} /> حفظ {suggestedTitles.length} مسمى وظيفي</>
                            }
                          </button>
                        )}
                      </div>
                    )}

                    {/* حال فارغة */}
                    {suggestedTitles.length === 0 && !suggesting && (
                      <div style={{
                        marginTop: 14, padding: "20px", textAlign: "center",
                        border: `1.5px dashed ${dark ? "#2a2a4a" : "#ddd6fe"}`, borderRadius: 12,
                      }}>
                        <p style={{ color: t.text3, fontSize: 13, margin: "0 0 4px" }}>
                          اضغط "اقتراح بالذكاء الاصطناعي" ليحلل تخصصك
                        </p>
                        <p style={{ color: t.text3, fontSize: 12, margin: 0 }}>
                          سيقترح 20 مسمى وظيفي مناسباً لسيرتك
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: dark ? "#1a0a0a" : "#fef2f2",
                  border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`, borderRadius: 12,
                  padding: "13px 16px", marginBottom: 16,
                }}>
                  <XCircle size={16} strokeWidth={1.5} color="#f87171" />
                  <span style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>
                    لم تُرفع سيرة ذاتية بعد — ارفع سيرتك لبدء التقديم التلقائي
                  </span>
                </div>
                <DropZone
                  t={t} dark={dark} drag={drag} setDrag={setDrag}
                  uploading={uploading} fileRef={fileRef}
                  handleUpload={handleUpload} handleDrop={handleDrop}
                />
              </>
            )}

            {/* كيف يعمل الذكاء الاصطناعي */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "20px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Bot size={17} strokeWidth={1.5} color={t.text} />
                <span style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>كيف يعمل الذكاء الاصطناعي؟</span>
              </div>
              {[
                { icon: <Search size={15} strokeWidth={1.5} />, text: "يقرأ الذكاء الاصطناعي سيرتك ويستخرج مجالاتك ومهاراتك" },
                { icon: <Bot size={15} strokeWidth={1.5} />, text: "كل 30 دقيقة يبحث عن وظائف جديدة تناسب مسمياتك" },
                { icon: <Send size={15} strokeWidth={1.5} />, text: "يكتب رسالة تغطية مخصصة ويرسلها باسمك للشركة" },
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: t.iconBg, border: `1px solid ${t.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color: t.text2,
                  }}>{step.icon}</div>
                  <p style={{ color: t.text2, fontSize: 13, margin: 0, lineHeight: 1.6, paddingTop: 6 }}>{step.text}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}

function DropZone({ t, dark, drag, setDrag, uploading, fileRef, handleUpload, handleDrop }: any) {
  return (
    <div
      style={{
        background: drag ? (dark ? "#1a1a1a" : "#f4f4f5") : t.surface,
        border: `1.5px dashed ${drag ? (dark ? "#fff" : "#09090b") : t.dashed}`,
        borderRadius: 16, padding: "44px 24px",
        textAlign: "center", cursor: uploading ? "not-allowed" : "pointer",
        marginBottom: 16, transition: "all 0.2s",
      }}
      onClick={() => !uploading && fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: t.iconBg, border: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
      }}>
        <Upload size={24} strokeWidth={1.5} color={drag ? t.text : t.text3} />
      </div>
      <p style={{ color: t.text, fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
        {uploading ? "جاري الرفع…" : "اسحب ملفاً أو اضغط للرفع"}
      </p>
      <p style={{ color: t.text3, fontSize: 13, margin: 0 }}>PDF · JPG · PNG — حتى 10 ميغابايت</p>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />
    </div>
  );
}
