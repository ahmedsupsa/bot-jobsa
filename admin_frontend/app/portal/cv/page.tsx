"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Upload, Trash2, FileText, CheckCircle, XCircle,
  Bot, Search, Send, Eye, RefreshCw, Calendar,
  Sparkles, Save, Briefcase, Loader2, X, Lock, MessageCircle,
} from "lucide-react";

interface CVInfo { has_cv: boolean; file_name?: string; updated_at?: string; preview_url?: string; }
interface Field { id: string; name_ar: string; }
type Tab = "cv" | "prefs";

export default function CVPrefsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [tab, setTab] = useState<Tab>("cv");

  const t = {
    surface: dark ? "#111"    : "#fff",
    border:  dark ? "#1f1f1f" : "#e4e4e7",
    border2: dark ? "#2a2a2a" : "#d4d4d8",
    text:    dark ? "#fff"    : "#09090b",
    text2:   dark ? "#aaa"    : "#71717a",
    text3:   dark ? "#666"    : "#a1a1aa",
    iconBg:  dark ? "#1a1a1a" : "#f4f4f5",
    input:   dark ? "#141414" : "#fff",
    dashed:  dark ? "#2a2a2a" : "#d4d4d8",
  };

  /* ── CV STATE ── */
  const [cv, setCV] = useState<CVInfo | null>(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cvMsg, setCvMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── PREFS STATE ── */
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [search, setSearch] = useState("");
  const [prefsMsg, setPrefsMsg] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);

  async function loadCV() {
    try {
      const res = await portalFetch("/cv");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      setCV(await res.json());
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setCvLoading(false); }
  }

  async function loadPrefs() {
    try {
      const res = await portalFetch("/preferences");
      const d = await res.json();
      const seen = new Set<string>();
      const unique = (d.all_fields || []).filter((f: Field) => { if (seen.has(f.name_ar)) return false; seen.add(f.name_ar); return true; });
      setFields(unique);
      setSelected(new Set((d.selected_ids || []).map(String)));
    } catch {}
    finally { setPrefsLoading(false); }
  }

  useEffect(() => { loadCV(); loadPrefs(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setCvMsg(null);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch("/api/portal/cv/upload", { method: "POST", headers: authHeaders(), body: form });
      const d = await res.json();
      if (!res.ok) { setCvMsg({ text: d.error || "فشل الرفع", type: "err" }); return; }
      setCvMsg({ text: "تم رفع السيرة بنجاح ✓", type: "ok" });
      setShowReplace(false); await loadCV();
    } catch { setCvMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف السيرة؟")) return;
    setDeleting(true); setCvMsg(null);
    try {
      const res = await portalFetch("/cv/delete", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { setCvMsg({ text: d.error || "فشل الحذف", type: "err" }); return; }
      setCvMsg({ text: "تم حذف السيرة الذاتية", type: "ok" });
      setShowReplace(false); await loadCV();
    } catch { setCvMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setDeleting(false); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file && fileRef.current) { const dt = new DataTransfer(); dt.items.add(file); fileRef.current.files = dt.files; handleUpload({ target: fileRef.current } as any); }
  }

  function toggleField(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function savePrefs() {
    setSaving(true); setPrefsMsg(null);
    try {
      const res = await portalFetch("/preferences", { method: "POST", body: JSON.stringify({ field_ids: Array.from(selected) }) });
      const d = await res.json();
      if (!res.ok) { setPrefsMsg({ text: d.error || "فشل الحفظ", type: "err" }); return; }
      setPrefsMsg({ text: `تم حفظ ${d.count} مجال بنجاح ✓`, type: "ok" });
    } catch { setPrefsMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  async function extractFromCV() {
    setExtracting(true); setPrefsMsg(null); setAiSummary("");
    try {
      const res = await fetch("/api/portal/preferences/extract", { method: "POST", headers: authHeaders() });
      const d = await res.json();
      if (!res.ok) { setPrefsMsg({ text: d.error || "فشل التحليل", type: "err" }); return; }
      const newIds: string[] = d.matched_ids.map(String);
      if (d.all_fields?.length) {
        setFields(prev => { const seen = new Set(prev.map((f: Field) => f.name_ar)); return [...prev, ...d.all_fields.filter((f: Field) => !seen.has(f.name_ar))]; });
      }
      setSelected(new Set(newIds)); setAiSummary(d.summary || "");
      const saveRes = await portalFetch("/preferences", { method: "POST", body: JSON.stringify({ field_ids: newIds }) });
      const saveData = await saveRes.json();
      setPrefsMsg({ text: saveRes.ok ? `تم استخراج ${newIds.length} مسمى وحفظها ✓` : (saveData.error || "استُخرجت المسميات — اضغط حفظ لتأكيدها"), type: saveRes.ok ? "ok" : "info" });
    } catch { setPrefsMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setExtracting(false); }
  }

  const sortedFiltered = useMemo(() => {
    const q = search.trim();
    const filtered = q ? fields.filter(f => f.name_ar.includes(q)) : fields;
    return [...filtered].sort((a, b) => {
      const as = selected.has(String(a.id)), bs = selected.has(String(b.id));
      if (as && !bs) return -1; if (!as && bs) return 1;
      return a.name_ar.localeCompare(b.name_ar, "ar");
    });
  }, [fields, selected, search]);

  const uploadedAt = cv?.updated_at ? new Date(cv.updated_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <PortalShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4,
          background: t.surface, border: `1px solid ${t.border}`,
          borderRadius: 14, padding: 4, marginBottom: 20,
        }}>
          {([["cv", "السيرة الذاتية", <FileText size={15} key="f" />], ["prefs", "تفضيلات الوظائف", <Briefcase size={15} key="b" />]] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 0", borderRadius: 11, border: "none", cursor: "pointer",
                background: tab === key ? (dark ? "#fff" : "#09090b") : "transparent",
                color: tab === key ? (dark ? "#0a0a0a" : "#fff") : t.text3,
                fontSize: 14, fontWeight: tab === key ? 700 : 400,
                transition: "all 0.18s",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── CV TAB ── */}
        {tab === "cv" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            {cvLoading ? (
              <p style={{ color: t.text3, textAlign: "center", padding: 60 }}>جاري التحميل…</p>
            ) : (
              <>
                {cvMsg && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "13px 16px", borderRadius: 12, marginBottom: 16,
                    fontSize: 13, fontWeight: 500,
                    background: cvMsg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
                    color: cvMsg.type === "ok" ? "#22c55e" : "#f87171",
                    border: `1px solid ${cvMsg.type === "ok" ? "#22c55e22" : "#f8717122"}`,
                  }}>
                    {cvMsg.type === "ok" ? <CheckCircle size={16} strokeWidth={1.5} /> : <XCircle size={16} strokeWidth={1.5} />}
                    {cvMsg.text}
                  </div>
                )}

                {cv?.has_cv ? (
                  <>
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: 18,
                      background: dark ? "#0a1a0a" : "#f0fdf4",
                      border: "1px solid #22c55e33", borderRadius: 18,
                      padding: "22px 20px", marginBottom: 14,
                    }}>
                      <div style={{
                        width: 60, height: 60, borderRadius: 15,
                        background: dark ? "#0f2a0f" : "#dcfce7",
                        border: "1px solid #22c55e44",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <FileText size={28} strokeWidth={1.2} color="#22c55e" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: dark ? "#0f2a0f" : "#dcfce7",
                          border: "1px solid #22c55e33", borderRadius: 100,
                          padding: "3px 12px", fontSize: 11, fontWeight: 700, color: "#22c55e", marginBottom: 8,
                        }}>
                          <CheckCircle size={12} strokeWidth={2} /> سيرتك الذاتية مرفوعة وجاهزة
                        </div>
                        <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: "0 0 6px", wordBreak: "break-all" }}>{cv.file_name}</p>
                        {uploadedAt && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: t.text3, fontSize: 12 }}>
                            <Calendar size={11} /> آخر تحديث: {uploadedAt}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      {cv.preview_url && (
                        <a href={cv.preview_url} target="_blank" rel="noopener noreferrer" style={{
                          display: "inline-flex", alignItems: "center", gap: 7,
                          padding: "10px 18px", borderRadius: 12,
                          background: dark ? "#fff" : "#09090b", color: dark ? "#0a0a0a" : "#fff",
                          fontSize: 13, fontWeight: 700, textDecoration: "none",
                        }}>
                          <Eye size={14} /> معاينة السيرة
                        </a>
                      )}
                    </div>

                    {/* قفل تغيير السيرة — يتم عبر الدعم فقط */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: dark ? "#14100a" : "#fffbeb",
                      border: "1px solid #f59e0b33", borderRadius: 14,
                      padding: "14px 16px", marginBottom: 14,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: dark ? "#1f1500" : "#fef3c7",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <Lock size={16} strokeWidth={1.8} color="#f59e0b" />
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
                        background: "#f59e0b", color: "#000",
                        fontSize: 12, fontWeight: 700, textDecoration: "none",
                      }}>
                        <MessageCircle size={13} /> الدعم
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: dark ? "#1a0a0a" : "#fef2f2",
                      border: "1px solid #f8717122", borderRadius: 12,
                      padding: "13px 16px", marginBottom: 16,
                    }}>
                      <XCircle size={16} strokeWidth={1.5} color="#f87171" />
                      <span style={{ color: "#f87171", fontSize: 13, fontWeight: 600 }}>لم تُرفع سيرة ذاتية بعد — ارفع سيرتك لبدء التقديم التلقائي</span>
                    </div>
                    <DropZone t={t} dark={dark} drag={drag} setDrag={setDrag} uploading={uploading} fileRef={fileRef} handleUpload={handleUpload} handleDrop={handleDrop} />
                  </>
                )}

                {/* How it works */}
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "20px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <Bot size={17} strokeWidth={1.5} color={t.text} />
                    <span style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>كيف يعمل الذكاء الاصطناعي؟</span>
                  </div>
                  {[
                    { icon: <Search size={15} strokeWidth={1.5} />, text: "يقرأ الذكاء الاصطناعي سيرتك ويستخرج مجالاتك ومهاراتك" },
                    { icon: <Bot size={15} strokeWidth={1.5} />, text: "كل 30 دقيقة يبحث عن وظائف جديدة تناسب تخصصك" },
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
        )}

        {/* ── PREFS TAB ── */}
        {tab === "prefs" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            {/* AI extract card */}
            <div style={{
              background: dark ? "#0d0d1a" : "#f5f3ff",
              border: `1px solid ${dark ? "#1e1e3a" : "#ddd6fe"}`,
              borderRadius: 16, padding: "18px 16px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <Bot size={17} strokeWidth={1.5} color={dark ? "#a78bfa" : "#7c3aed"} />
                <span style={{ color: dark ? "#c4b5fd" : "#7c3aed", fontSize: 14, fontWeight: 700 }}>استخراج تلقائي بالذكاء الاصطناعي</span>
              </div>
              {aiSummary && (
                <p style={{ color: t.text2, fontSize: 12, margin: "0 0 12px", lineHeight: 1.7, borderRight: `2px solid ${dark ? "#2a2a4a" : "#ddd6fe"}`, paddingRight: 10 }}>
                  {aiSummary}
                </p>
              )}
              {!aiSummary && (
                <p style={{ color: t.text3, fontSize: 13, margin: "0 0 14px" }}>يقرأ سيرتك ويستخرج المسميات المناسبة لك ويحفظها تلقائياً</p>
              )}
              <button onClick={extractFromCV} disabled={extracting} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10,
                background: dark ? "#fff" : "#7c3aed", color: dark ? "#0a0a0a" : "#fff",
                fontSize: 13, fontWeight: 700, cursor: extracting ? "not-allowed" : "pointer",
                border: "none", opacity: extracting ? 0.5 : 1,
              }}>
                {extracting ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> جاري التحليل…</> : <><Sparkles size={14} /> استخرج من سيرتي الذاتية</>}
              </button>
            </div>

            {prefsMsg && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, marginBottom: 16,
                fontSize: 13, fontWeight: 500,
                background: prefsMsg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : prefsMsg.type === "info" ? (dark ? "#0a0f1a" : "#eff6ff") : (dark ? "#1a0a0a" : "#fef2f2"),
                color: prefsMsg.type === "ok" ? "#22c55e" : prefsMsg.type === "info" ? "#60a5fa" : "#f87171",
                border: `1px solid ${prefsMsg.type === "ok" ? "#22c55e33" : prefsMsg.type === "info" ? "#60a5fa33" : "#f8717133"}`,
              }}>
                {prefsMsg.type === "ok" ? <CheckCircle size={15} /> : prefsMsg.type === "info" ? <Sparkles size={15} /> : <XCircle size={15} />}
                {prefsMsg.text}
              </div>
            )}

            {prefsLoading ? (
              <p style={{ color: t.text3, textAlign: "center", padding: 40 }}>جاري التحميل…</p>
            ) : (
              <>
                {/* Search + count bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{
                    flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 10,
                    background: t.surface, border: `1px solid ${t.border2}`,
                    borderRadius: 10, padding: "9px 14px",
                  }}>
                    <Search size={14} strokeWidth={1.5} color={t.text3} style={{ flexShrink: 0 }} />
                    <input
                      type="text" placeholder="ابحث عن مجال…" value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ flex: 1, background: "transparent", border: "none", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}
                    />
                    {search && (
                      <button onClick={() => setSearch("")} style={{ background: "transparent", border: "none", color: t.text3, cursor: "pointer", padding: 2, display: "flex" }}>
                        <X size={12} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selected.size > 0 && (
                      <button onClick={() => setSelected(new Set())} style={{
                        background: "transparent", border: `1px solid ${t.border2}`,
                        borderRadius: 8, padding: "5px 12px", color: t.text3, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      }}>إلغاء الكل</button>
                    )}
                    <span style={{
                      background: t.iconBg, border: `1px solid ${t.border2}`,
                      borderRadius: 100, padding: "5px 14px", color: t.text2, fontSize: 12, whiteSpace: "nowrap",
                    }}>{selected.size} محدد</span>
                  </div>
                </div>

                {/* Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 20 }}>
                  {sortedFiltered.length === 0 && <p style={{ color: t.text3, fontSize: 13 }}>لا توجد نتائج</p>}
                  {sortedFiltered.map(f => {
                    const isActive = selected.has(String(f.id));
                    return (
                      <button
                        key={f.id}
                        onClick={() => toggleField(String(f.id))}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "8px 16px", borderRadius: 100,
                          background: isActive ? (dark ? "#071a07" : "#f0fdf4") : t.surface,
                          border: `1px solid ${isActive ? "#22c55e55" : t.border}`,
                          color: isActive ? (dark ? "#e8ffe8" : "#166534") : t.text3,
                          fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                          transition: "all 0.12s",
                        }}
                      >
                        {isActive && <CheckCircle size={12} strokeWidth={2.5} color="#22c55e" style={{ flexShrink: 0 }} />}
                        {f.name_ar}
                      </button>
                    );
                  })}
                </div>

                {/* Save */}
                <button onClick={savePrefs} disabled={saving} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "14px",
                  background: dark ? "#fff" : "#09090b",
                  color: dark ? "#0a0a0a" : "#fff",
                  border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}>
                  <Save size={16} strokeWidth={1.5} />
                  {saving ? "جاري الحفظ…" : `حفظ التفضيلات${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
              </>
            )}
          </div>
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
        opacity: uploading ? 0.6 : 1,
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
