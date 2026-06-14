"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import type { CvProfile } from "@/lib/cv-parser";
import {
  Upload, FileText, CheckCircle, XCircle,
  Bot, Search, Send, Eye, Calendar,
  Sparkles, Loader2, X, MapPin, GraduationCap,
  Briefcase, Award, Star, Languages,
} from "lucide-react";

interface CVInfo { has_cv: boolean; file_name?: string; updated_at?: string; preview_url?: string; cv_profile?: any; }

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

  const [cv, setCV] = useState<CVInfo | null>(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cvMsg, setCvMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [profile, setProfile] = useState<CvProfile | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryMsg, setSummaryMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadCV() {
    try {
      const res = await portalFetch("/cv");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const data = await res.json();
      setCV(data);
      if (data.cv_profile) setProfile(data.cv_profile);
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setCvLoading(false); }
  }

  useEffect(() => { loadCV(); }, []);

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

  async function handleExtractSummary() {
    setSummarizing(true); setSummaryMsg(null);
    try {
      const res = await fetch("/api/portal/cv/summary", {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (!res.ok) { setSummaryMsg(d.error || "فشل التحليل"); return; }
      setProfile(d.profile);
      setSummaryMsg(d.message || "تم تحليل السيرة ✓");
    } catch { setSummaryMsg("خطأ في الاتصال"); }
    finally { setSummarizing(false); }
  }

  const uploadedAt = cv?.updated_at
    ? new Date(cv.updated_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <PortalShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
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
                color: cvMsg.type === "ok" ? (dark ? "#fff" : "#166534") : "#f87171",
                border: `1px solid ${cvMsg.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
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

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
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
                  <button onClick={() => fileRef.current?.click()} style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "10px 18px", borderRadius: 12,
                    border: `1px solid ${t.border2}`, background: "transparent",
                    color: t.text2, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>
                    <Upload size={14} /> استبدال السيرة
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} disabled={uploading} />

                  {/* ملخص السيرة الذاتية — نسخة احترافية */}
                  <div style={{
                    background: dark ? "#0d0d1a" : "#f5f3ff",
                    border: `1px solid ${dark ? "#1e1e3a" : "#ddd6fe"}`,
                    borderRadius: 18, padding: "20px 18px", marginBottom: 20,
                  }}>
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
                            ملف السيرة الذاتية
                          </p>
                          <p style={{ margin: "2px 0 0", color: t.text3, fontSize: 12 }}>
                            {profile?.name ? "تم تحليل السيرة بنجاح" : "اضغط تحليل لاستخراج بيانات سيرتك"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleExtractSummary}
                        disabled={summarizing}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 7,
                          padding: "9px 16px", borderRadius: 10, border: "none",
                          background: dark ? "#7c3aed" : "#7c3aed",
                          color: "#fff", fontSize: 12, fontWeight: 700,
                          cursor: summarizing ? "not-allowed" : "pointer",
                          opacity: summarizing ? 0.7 : 1, fontFamily: "inherit",
                        }}
                      >
                        {summarizing
                          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> جاري التحليل…</>
                          : <><Sparkles size={13} /> {profile ? "إعادة تحليل" : "تحليل السيرة"}</>
                        }
                      </button>
                    </div>

                    {summaryMsg && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px", borderRadius: 10, marginTop: 12,
                        fontSize: 12, fontWeight: 500,
                        background: summaryMsg.includes("خطأ")||summaryMsg.includes("فشل")||summaryMsg.includes("لا يوجد") ? (dark ? "#1a0a0a" : "#fef2f2") : (dark ? "#0a1f0a" : "#f0fdf4"),
                        color: summaryMsg.includes("خطأ")||summaryMsg.includes("فشل")||summaryMsg.includes("لا يوجد") ? (dark ? "#f87171" : "#dc2626") : (dark ? "#86efac" : "#166534"),
                        border: `1px solid ${summaryMsg.includes("خطأ")||summaryMsg.includes("فشل")||summaryMsg.includes("لا يوجد") ? (dark ? "#7f1d1d" : "#fecaca") : (dark ? "#2a2a2a" : "#bbf7d0")}`,
                      }}>
                        {summaryMsg.includes("خطأ")||summaryMsg.includes("فشل")||summaryMsg.includes("لا يوجد") ? <XCircle size={13} /> : <CheckCircle size={13} />} {summaryMsg}
                      </div>
                    )}

                    {profile && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>

                        {/* الاسم والمدينة */}
                        <div style={{
                          background: dark ? "#111" : "#fff", borderRadius: 12, padding: 16,
                          border: `1px solid ${t.border}`,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            {profile.name && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: dark ? "#1a1a3a" : "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Star size={14} color={dark ? "#a78bfa" : "#7c3aed"} />
                                </div>
                                <span style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{profile.name}</span>
                              </div>
                            )}
                            {profile.city && (
                              <div style={{ display: "flex", alignItems: "center", gap: 5, color: t.text2, fontSize: 13 }}>
                                <MapPin size={13} /> {profile.city}
                              </div>
                            )}
                          </div>
                          {(profile.email || profile.phone) && (
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 13 }}>
                              {profile.email && <span style={{ color: t.text2, direction: "ltr" }}>{profile.email}</span>}
                              {profile.phone && <span style={{ color: t.text2, direction: "ltr" }}>{profile.phone}</span>}
                            </div>
                          )}
                        </div>

                        {/* النبذة العامة */}
                        {profile.summary && (
                          <div style={{
                            background: dark ? "#111" : "#fff", borderRadius: 12, padding: 14,
                            border: `1px solid ${t.border}`, fontSize: 13, lineHeight: 1.7, color: t.text2,
                          }}>
                            {profile.summary}
                          </div>
                        )}

                        {/* التعليم */}
                        {profile.education && (
                          <div style={{
                            background: dark ? "#111" : "#fff", borderRadius: 12, padding: 14,
                            border: `1px solid ${t.border}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <GraduationCap size={15} color={t.text2} />
                              <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>التعليم</span>
                            </div>
                            <div style={{ fontSize: 13, color: t.text2 }}>
                              {profile.education.degree && <span>{profile.education.degree}</span>}
                              {profile.education.major && <span> — {profile.education.major}</span>}
                              {profile.education.university && <div style={{ marginTop: 4 }}>{profile.education.university}</div>}
                              {(profile.education.gpa || profile.education.year) && (
                                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                                  {profile.education.gpa && <span>{profile.education.gpa}</span>}
                                  {profile.education.year && <span>{profile.education.year}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* الخبرة */}
                        {profile.experience && profile.experience.length > 0 && (
                          <div style={{
                            background: dark ? "#111" : "#fff", borderRadius: 12, padding: 14,
                            border: `1px solid ${t.border}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <Briefcase size={15} color={t.text2} />
                              <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>
                                الخبرة {profile.experience_years ? `(${profile.experience_years} سنوات)` : ""}
                              </span>
                            </div>
                            {profile.experience.slice(0, 3).map((exp, i) => (
                              <div key={i} style={{ fontSize: 13, color: t.text2, marginBottom: i < 2 ? 8 : 0 }}>
                                {exp.title && <span style={{ color: t.text, fontWeight: 500 }}>{exp.title}</span>}
                                {exp.company && <span> — {exp.company}</span>}
                                {(exp.from || exp.to) && (
                                  <div style={{ fontSize: 12, color: t.text3 }}>{exp.from}{exp.to ? ` - ${exp.to}` : ""}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* المهارات التقنية */}
                        {profile.skills && profile.skills.length > 0 && (
                          <div style={{
                            background: dark ? "#111" : "#fff", borderRadius: 12, padding: 14,
                            border: `1px solid ${t.border}`,
                          }}>
                            <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>المهارات</span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              {profile.skills.map((s, i) => (
                                <span key={i} style={{
                                  padding: "4px 10px", borderRadius: 100, fontSize: 12,
                                  background: dark ? "#1a1a3a" : "#ede9fe",
                                  color: dark ? "#c4b5fd" : "#5b21b6",
                                  border: `1px solid ${dark ? "#3a3a6a" : "#c4b5fd"}`,
                                }}>{s}</span>
                              ))}
                              {(profile.soft_skills || []).map((s, i) => (
                                <span key={`soft-${i}`} style={{
                                  padding: "4px 10px", borderRadius: 100, fontSize: 12,
                                  background: dark ? "#0a1f0a" : "#f0fdf4",
                                  color: dark ? "#86efac" : "#166534",
                                  border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`,
                                }}>{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* إجادة اللغة */}
                        {profile.english_level && (
                          <div style={{
                            background: dark ? "#111" : "#fff", borderRadius: 12, padding: 14,
                            border: `1px solid ${t.border}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Languages size={15} color={t.text2} />
                              <span style={{ color: t.text, fontSize: 13 }}>الإنجليزية: <strong>{profile.english_level}</strong></span>
                            </div>
                          </div>
                        )}

                        {/* الشهادات */}
                        {profile.certifications && profile.certifications.length > 0 && (
                          <div style={{
                            background: dark ? "#111" : "#fff", borderRadius: 12, padding: 14,
                            border: `1px solid ${t.border}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <Award size={15} color={t.text2} />
                              <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>الشهادات</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {profile.certifications.map((c, i) => (
                                <span key={i} style={{
                                  padding: "4px 10px", borderRadius: 100, fontSize: 12,
                                  background: dark ? "#1a1a1a" : "#f4f4f5",
                                  color: t.text2, border: `1px solid ${t.border}`,
                                }}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* المجالات الوظيفية المناسبة */}
                        {profile.job_categories && profile.job_categories.length > 0 && (
                          <div style={{
                            background: dark ? "#0a1f0a" : "#f0fdf4",
                            borderRadius: 12, padding: 14,
                            border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <Star size={15} color={dark ? "#86efac" : "#166534"} />
                              <span style={{ color: dark ? "#86efac" : "#166534", fontSize: 13, fontWeight: 600 }}>المجالات المناسبة</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {profile.job_categories.map((c, i) => (
                                <span key={i} style={{
                                  padding: "6px 14px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                                  background: dark ? "#0f2a0f" : "#dcfce7",
                                  color: dark ? "#86efac" : "#166534",
                                  border: `1px solid ${dark ? "#2a2a2a" : "#bbf7d0"}`,
                                }}>{c}</span>
                              ))}
                            </div>
                            {profile.overall_score !== undefined && (
                              <div style={{ marginTop: 10, fontSize: 13, color: dark ? "#86efac" : "#166534", fontWeight: 700 }}>
                                جودة السيرة: {profile.overall_score}/100
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

            {/* كيف يعمل النظام */}
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: "20px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Bot size={17} strokeWidth={1.5} color={t.text} />
                <span style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>كيف يعمل النظام؟</span>
              </div>
              {[
                { icon: <Search size={15} strokeWidth={1.5} />, text: "يقرأ النظام سيرتك ويستخرج مجالاتك ومهاراتك" },
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
    </div>
  );
}
