"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Search, CheckCircle, Save, Loader2, XCircle, Plus, X,
  ChevronDown, ChevronUp, GraduationCap, Briefcase,
} from "lucide-react";

interface JobField { id: string; name_ar: string; category?: string; }
interface TaxonomyEntry { m: string; m_en: string; c: string; c_en: string; j: string[]; j_en: string[]; }
type Taxonomy = Record<string, TaxonomyEntry>;
interface UniMajor { a: string; e: string; d: string; }
interface UniEntry { id: string; name_ar: string; name_en: string; city_ar: string; majors: UniMajor[]; }
interface UniData { universities: UniEntry[]; mapping: Record<string, number>; }

export default function PreferencesPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const t = {
    surface:  dark ? "#111"    : "#fff",
    border:   dark ? "#1f1f1f" : "#e4e4e7",
    text:     dark ? "#fff"    : "#09090b",
    text2:    dark ? "#aaa"    : "#71717a",
    text3:    dark ? "#666"    : "#a1a1aa",
    iconBg:   dark ? "#1a1a1a" : "#f4f4f5",
    input:    dark ? "#141414" : "#fff",
    purple:   dark ? "#c4b5fd" : "#5b21b6",
    purpleBg: dark ? "#0d0d1a" : "#f5f3ff",
    purpleBd: dark ? "#1e1e3a" : "#ddd6fe",
  };

  const [tab, setTab] = useState<"taxonomy" | "custom">("taxonomy");

  // Taxonomy state
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [selectedMajorIds, setSelectedMajorIds] = useState<Set<number>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [taxSearch, setTaxSearch] = useState("");
  const [savingTax, setSavingTax] = useState(false);
  const [taxMsg, setTaxMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // Custom fields state
  const [allFields, setAllFields] = useState<JobField[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customSearch, setCustomSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const [allowTamheer, setAllowTamheer] = useState(false);
  const [allowCooperative, setAllowCooperative] = useState(false);
  const [loading, setLoading] = useState(true);

  // University picker state
  const [uniData, setUniData] = useState<UniData | null>(null);
  const [uniOpen, setUniOpen] = useState(false);
  const [uniSearch, setUniSearch] = useState("");
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [uniMajorSearch, setUniMajorSearch] = useState("");
  const [uniPickMsg, setUniPickMsg] = useState<string | null>(null);

  async function load() {
    try {
      const [prefsRes, taxRes, taxDataRes, uniRes] = await Promise.all([
        portalFetch("/preferences"),
        portalFetch("/preferences/taxonomy"),
        fetch("/jobs_taxonomy_compact.json"),
        fetch("/saudi_unis_compact.json"),
      ]);
      if (prefsRes.status === 401) { clearToken(); router.replace("/portal/login"); return; }

      const prefsData = await prefsRes.json();
      setAllFields(prefsData.all_fields || []);
      setSelectedIds(new Set((prefsData.selected_ids || []).map(String)));
      setAllowTamheer(prefsData.allow_tamheer ?? false);
      setAllowCooperative(prefsData.allow_cooperative ?? false);

      const taxData = await taxRes.json();
      setSelectedMajorIds(new Set((taxData.major_ids || []).map(Number)));

      const fullTax: Taxonomy = await taxDataRes.json();
      setTaxonomy(fullTax);

      if (uniRes.ok) {
        const ud: UniData = await uniRes.json();
        setUniData(ud);
      }
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Group taxonomy by category
  const categories = useMemo(() => {
    const cats: Record<string, { id: number; name: string }[]> = {};
    for (const [id, entry] of Object.entries(taxonomy)) {
      if (!cats[entry.c]) cats[entry.c] = [];
      cats[entry.c].push({ id: Number(id), name: entry.m });
    }
    return cats;
  }, [taxonomy]);

  // Filtered taxonomy search (Arabic + English)
  const taxSearchResults = useMemo(() => {
    if (!taxSearch.trim()) return [];
    const q = taxSearch.trim().toLowerCase();
    const results: { id: number; major: string; major_en: string; cat: string; matchedJobs: string[] }[] = [];
    for (const [id, entry] of Object.entries(taxonomy)) {
      const majorMatch = entry.m.toLowerCase().includes(q) || (entry.m_en || "").toLowerCase().includes(q);
      const matchedJobsAr = entry.j.filter(j => j.toLowerCase().includes(q));
      const matchedJobsEn = (entry.j_en || []).filter(j => j.toLowerCase().includes(q));
      const matchedJobs = [...matchedJobsAr, ...matchedJobsEn.filter(j => !matchedJobsAr.some(a => a.toLowerCase() === j.toLowerCase()))];
      if (majorMatch || matchedJobs.length > 0) {
        results.push({ id: Number(id), major: entry.m, major_en: entry.m_en || "", cat: entry.c, matchedJobs: majorMatch ? [] : matchedJobs.slice(0, 4) });
      }
    }
    return results.slice(0, 20);
  }, [taxSearch, taxonomy]);

  // University picker computed
  const filteredUnis = useMemo(() => {
    if (!uniData) return [];
    const q = uniSearch.trim();
    if (!q) return uniData.universities;
    const ql = q.toLowerCase();
    return uniData.universities.filter(u =>
      u.name_ar.includes(q) || u.name_en.toLowerCase().includes(ql) || u.city_ar.includes(q)
    ).slice(0, 20);
  }, [uniData, uniSearch]);

  const selectedUni = useMemo(
    () => uniData?.universities.find(u => u.id === selectedUniId) ?? null,
    [uniData, selectedUniId]
  );

  const filteredUniMajors = useMemo(() => {
    if (!selectedUni) return [];
    const q = uniMajorSearch.trim();
    if (!q) return selectedUni.majors;
    const ql = q.toLowerCase();
    return selectedUni.majors.filter(m =>
      m.a.includes(q) || m.e.toLowerCase().includes(ql)
    );
  }, [selectedUni, uniMajorSearch]);

  function handleMajorPick(majorNameAr: string) {
    if (!uniData) return;
    const taxId = uniData.mapping[majorNameAr];
    if (taxId !== undefined) {
      setSelectedMajorIds(prev => { const n = new Set(prev); n.add(taxId); return n; });
      const taxName = taxonomy[String(taxId)]?.m || "";
      setUniPickMsg(`✅ تم إضافة "${taxName}" إلى تخصصاتك المختارة`);
      setTaxMsg(null);
    } else {
      setTaxSearch(majorNameAr);
      setUniOpen(false);
    }
    setTimeout(() => setUniPickMsg(null), 4000);
  }

  function toggleMajor(id: number) {
    setSelectedMajorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setTaxMsg(null);
  }

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function handleSaveTaxonomy() {
    setSavingTax(true); setTaxMsg(null);
    try {
      const res = await fetch("/api/portal/preferences/taxonomy", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ major_ids: [...selectedMajorIds] }),
      });
      const d = await res.json();
      if (!res.ok) { setTaxMsg({ text: d.error || "فشل الحفظ", type: "err" }); return; }
      setTaxMsg({ text: `تم حفظ ${selectedMajorIds.size} تخصص (${d.keyword_count} مسمى وظيفي) ✓`, type: "ok" });
    } catch { setTaxMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSavingTax(false); }
  }

  // Custom fields
  function toggleField(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/portal/preferences", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ field_ids: [...selectedIds], allow_tamheer: allowTamheer, allow_cooperative: allowCooperative }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الحفظ", type: "err" }); return; }
      setMsg({ text: `تم حفظ ${d.count} مسمى ✓`, type: "ok" });
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  async function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    setAddingCustom(true); setMsg(null);
    try {
      const res = await fetch("/api/portal/preferences/custom", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الإضافة", type: "err" }); return; }
      const nf = d.field as JobField;
      setAllFields(prev => prev.find(f => f.id === nf.id) ? prev : [...prev, nf]);
      setSelectedIds(prev => new Set([...prev, String(nf.id)]));
      setCustomName("");
      setMsg({ text: `تمت إضافة "${nf.name_ar}" ✓`, type: "ok" });
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setAddingCustom(false); }
  }

  const filteredCustom = allFields.filter(f => f.name_ar.toLowerCase().includes(customSearch.toLowerCase()));
  const selectedFields = allFields.filter(f => selectedIds.has(f.id));
  const selectedMajors = [...selectedMajorIds].map(id => taxonomy[String(id)]?.m).filter(Boolean);

  const msgBox = (m: { text: string; type: "ok"|"err" }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "12px 16px", borderRadius: 12, marginBottom: 16,
      fontSize: 13, fontWeight: 500,
      background: m.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
      color: m.type === "ok" ? (dark ? "#86efac" : "#166534") : "#f87171",
      border: `1px solid ${m.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
    }}>
      {m.type === "ok" ? <CheckCircle size={14}/> : <XCircle size={14}/>} {m.text}
    </div>
  );

  return (
    <PortalShell>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: t.text, fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>تفضيلات الوظائف</h1>
          <p style={{ color: t.text2, fontSize: 13, margin: 0 }}>حدد تخصصك الجامعي أو أضف مسميات يدوياً</p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, padding: 4,
          background: dark ? "#1a1a1a" : "#f4f4f5",
          borderRadius: 12, marginBottom: 20,
        }}>
          {([["taxonomy","تخصصي الجامعي","GraduationCap"],["custom","مسميات مخصصة","Briefcase"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as any)} style={{
              flex: 1, padding: "10px 16px", borderRadius: 9,
              background: tab === id ? (dark ? "#fff" : "#09090b") : "transparent",
              color: tab === id ? (dark ? "#000" : "#fff") : t.text2,
              border: "none", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: t.text3, textAlign: "center", padding: 60 }}>جاري التحميل…</p>
        ) : tab === "taxonomy" ? (

          /* ── تبويب التخصص الجامعي ── */
          <>
            {taxMsg && msgBox(taxMsg)}

            {/* المختارون */}
            {selectedMajors.length > 0 && (
              <div style={{ background: t.purpleBg, border: `1px solid ${t.purpleBd}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <p style={{ color: t.purple, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>
                  {selectedMajors.length} تخصص مختار
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {selectedMajors.map((name, i) => {
                    const id = [...selectedMajorIds][i];
                    return (
                      <span key={id} style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 10px 6px 7px", borderRadius: 100,
                        background: dark ? "#1a1a3a" : "#ede9fe",
                        border: `1px solid ${dark ? "#3a3a6a" : "#c4b5fd"}`,
                        color: t.purple, fontSize: 12,
                      }}>
                        {name}
                        <button onClick={() => toggleMajor(id)} style={{ background:"transparent",border:"none",cursor:"pointer",color:t.purple,padding:0,display:"flex" }}>
                          <X size={11} strokeWidth={2.5}/>
                        </button>
                      </span>
                    );
                  })}
                </div>
                <p style={{ color: t.text3, fontSize: 11, margin: "10px 0 0" }}>
                  سيقدم البوت على الوظائف المناسبة لهذه التخصصات تلقائياً
                </p>
              </div>
            )}

            {/* ── منتقي الجامعة ── */}
            {uniData && (
              <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:14, marginBottom:12, overflow:"hidden" }}>
                {/* رأس القسم */}
                <button onClick={() => { setUniOpen(o => !o); setUniPickMsg(null); }} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  width:"100%", padding:"13px 16px", background:"transparent",
                  border:"none", cursor:"pointer", fontFamily:"inherit",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <GraduationCap size={16} color={dark ? "#a78bfa" : "#7c3aed"}/>
                    <span style={{ fontSize:13, fontWeight:700, color:t.text }}>اختر بجامعتك</span>
                    <span style={{ fontSize:11, color:t.text3 }}>57 جامعة سعودية</span>
                  </div>
                  {uniOpen ? <ChevronUp size={15} color={t.text3}/> : <ChevronDown size={15} color={t.text3}/>}
                </button>

                {uniOpen && (
                  <div style={{ borderTop:`1px solid ${t.border}`, padding:"14px 16px" }}>

                    {/* رسالة نجاح */}
                    {uniPickMsg && (
                      <div style={{
                        fontSize:13, color: dark?"#86efac":"#166534",
                        background: dark?"#0a1f0a":"#f0fdf4",
                        border:`1px solid ${dark?"#166534":"#bbf7d0"}`,
                        borderRadius:10, padding:"10px 14px", marginBottom:12,
                      }}>
                        {uniPickMsg}
                      </div>
                    )}

                    {!selectedUni ? (
                      <>
                        <p style={{ fontSize:12, color:t.text3, margin:"0 0 10px" }}>ابحث عن جامعتك ثم اختر تخصصك</p>
                        {/* بحث الجامعة */}
                        <div style={{
                          display:"flex", alignItems:"center", gap:8,
                          padding:"10px 12px", borderRadius:10,
                          background:t.input, border:`1px solid ${t.border}`, marginBottom:10,
                        }}>
                          <Search size={14} color={t.text3}/>
                          <input
                            value={uniSearch}
                            onChange={e => setUniSearch(e.target.value)}
                            placeholder="اسم الجامعة أو المدينة…"
                            style={{ flex:1, border:"none", background:"transparent", color:t.text, fontSize:13, outline:"none", fontFamily:"inherit" }}
                            autoFocus
                          />
                          {uniSearch && <button onClick={()=>setUniSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:t.text3,padding:0,display:"flex"}}><X size={13}/></button>}
                        </div>
                        {/* قائمة الجامعات */}
                        <div style={{ maxHeight:220, overflowY:"auto", borderRadius:10, border:`1px solid ${t.border}` }}>
                          {filteredUnis.length === 0 ? (
                            <p style={{ color:t.text3, fontSize:12, textAlign:"center", padding:16 }}>لا توجد نتائج</p>
                          ) : filteredUnis.map((u, i) => (
                            <button key={u.id} onClick={() => { setSelectedUniId(u.id); setUniSearch(""); setUniMajorSearch(""); }} style={{
                              display:"flex", alignItems:"center", justifyContent:"space-between",
                              width:"100%", padding:"11px 14px", background:"transparent",
                              border:"none", borderBottom: i < filteredUnis.length-1 ? `1px solid ${t.border}` : "none",
                              cursor:"pointer", textAlign:"right", fontFamily:"inherit",
                            }}>
                              <span style={{ fontSize:13, color:t.text }}>{u.name_ar}</span>
                              <span style={{ fontSize:11, color:t.text3 }}>{u.city_ar}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* رأس الجامعة المختارة */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                          <div>
                            <p style={{ fontSize:13, fontWeight:700, color:dark?"#a78bfa":"#7c3aed", margin:"0 0 2px" }}>{selectedUni.name_ar}</p>
                            <p style={{ fontSize:11, color:t.text3, margin:0 }}>{selectedUni.majors.length} تخصص</p>
                          </div>
                          <button onClick={() => { setSelectedUniId(null); setUniMajorSearch(""); }} style={{
                            fontSize:12, color:t.text3, background:"transparent",
                            border:`1px solid ${t.border}`, borderRadius:8, padding:"5px 10px",
                            cursor:"pointer", fontFamily:"inherit",
                          }}>تغيير</button>
                        </div>
                        {/* بحث التخصص */}
                        <div style={{
                          display:"flex", alignItems:"center", gap:8,
                          padding:"9px 12px", borderRadius:10,
                          background:t.input, border:`1px solid ${t.border}`, marginBottom:10,
                        }}>
                          <Search size={14} color={t.text3}/>
                          <input
                            value={uniMajorSearch}
                            onChange={e => setUniMajorSearch(e.target.value)}
                            placeholder="ابحث في تخصصات الجامعة…"
                            style={{ flex:1, border:"none", background:"transparent", color:t.text, fontSize:13, outline:"none", fontFamily:"inherit" }}
                          />
                          {uniMajorSearch && <button onClick={()=>setUniMajorSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:t.text3,padding:0,display:"flex"}}><X size={13}/></button>}
                        </div>
                        {/* قائمة التخصصات */}
                        <div style={{ maxHeight:240, overflowY:"auto", borderRadius:10, border:`1px solid ${t.border}` }}>
                          {filteredUniMajors.map((m, i) => {
                            const taxId = uniData.mapping[m.a];
                            const hasTax = taxId !== undefined;
                            const isSelected = hasTax && selectedMajorIds.has(taxId);
                            return (
                              <button key={m.a} onClick={() => handleMajorPick(m.a)} style={{
                                display:"flex", alignItems:"center", justifyContent:"space-between",
                                width:"100%", padding:"11px 14px",
                                background: isSelected ? t.purpleBg : "transparent",
                                border:"none",
                                borderBottom: i < filteredUniMajors.length-1 ? `1px solid ${t.border}` : "none",
                                cursor: hasTax ? "pointer" : "default",
                                textAlign:"right", fontFamily:"inherit", opacity: hasTax ? 1 : 0.45,
                              }}>
                                <div>
                                  <span style={{ fontSize:13, fontWeight: isSelected?700:400, color: isSelected ? (dark?"#a78bfa":"#7c3aed") : t.text }}>{m.a}</span>
                                  {m.e && <span style={{ fontSize:11, color:t.text3, marginRight:6 }}>{m.e}</span>}
                                  {!hasTax && <span style={{ fontSize:10, color:t.text3, marginRight:4 }}>· غير مرتبط</span>}
                                </div>
                                <div style={{
                                  width:20, height:20, borderRadius:6, flexShrink:0,
                                  border:`1.5px solid ${isSelected ? "#7c3aed" : (hasTax ? t.border : "transparent")}`,
                                  background: isSelected ? "#7c3aed" : "transparent",
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                }}>
                                  {isSelected && <CheckCircle size={12} strokeWidth={2.5} color="#fff"/>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p style={{ fontSize:11, color:t.text3, margin:"10px 0 0", lineHeight:1.6 }}>
                          التخصصات الباهتة غير مرتبطة بالتاكسونومي — اضغط عليها للبحث يدوياً.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* بحث */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 14px", borderRadius: 12,
              background: t.input, border: `1px solid ${t.border}`, marginBottom: 12,
            }}>
              <Search size={16} strokeWidth={1.5} color={t.text3}/>
              <input
                value={taxSearch}
                onChange={e => setTaxSearch(e.target.value)}
                placeholder="أو ابحث بالتخصص أو المسمى الوظيفي…"
                style={{ flex:1, border:"none", background:"transparent", color:t.text, fontSize:14, outline:"none", fontFamily:"inherit" }}
              />
              {taxSearch && <button onClick={()=>setTaxSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:t.text3,display:"flex"}}><X size={14}/></button>}
            </div>

            {/* نتائج البحث */}
            {taxSearch.trim() ? (
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow:"hidden", marginBottom: 16 }}>
                {taxSearchResults.length === 0 ? (
                  <p style={{ color:t.text3, textAlign:"center", padding:"24px 20px", fontSize:13 }}>لا توجد نتائج</p>
                ) : taxSearchResults.map((r, i) => {
                  const sel = selectedMajorIds.has(r.id);
                  return (
                    <button key={r.id} onClick={() => toggleMajor(r.id)} style={{
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      width:"100%", padding:"14px 16px", background: sel ? t.purpleBg : "transparent",
                      border:"none", borderBottom: i < taxSearchResults.length-1 ? `1px solid ${t.border}` : "none",
                      cursor:"pointer", textAlign:"right", fontFamily:"inherit",
                    }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                          <span style={{ fontSize:14, fontWeight:600, color: sel ? t.purple : t.text }}>{r.major}</span>
                          {r.major_en && <span style={{ fontSize:11, color:t.text3 }}>{r.major_en}</span>}
                        </div>
                        <span style={{ fontSize:11, color:t.text3 }}>{r.cat}</span>
                        {r.matchedJobs.length > 0 && (
                          <div style={{ fontSize:11, color:t.text3, marginTop:3 }}>
                            تتضمن: {r.matchedJobs.join("، ")}
                          </div>
                        )}
                      </div>
                      <div style={{
                        width:22, height:22, borderRadius:7, flexShrink:0,
                        border:`1.5px solid ${sel ? "#7c3aed" : t.border}`,
                        background: sel ? "#7c3aed" : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        {sel && <CheckCircle size={13} strokeWidth={2.5} color="#fff"/>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* عرض حسب الفئة */
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                {Object.entries(categories).map(([cat, majors]) => {
                  const open = expandedCats.has(cat);
                  const selectedInCat = majors.filter(m => selectedMajorIds.has(m.id)).length;
                  return (
                    <div key={cat} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:14, overflow:"hidden" }}>
                      <button onClick={() => toggleCat(cat)} style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        width:"100%", padding:"14px 16px", background:"transparent",
                        border:"none", cursor:"pointer", textAlign:"right", fontFamily:"inherit",
                      }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:t.text }}>{cat}</span>
                          {selectedInCat > 0 && (
                            <span style={{
                              fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:100,
                              background: dark ? "#1a1a3a" : "#ede9fe", color:t.purple,
                            }}>{selectedInCat}</span>
                          )}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:11, color:t.text3 }}>{majors.length} تخصص</span>
                          {open ? <ChevronUp size={16} color={t.text3}/> : <ChevronDown size={16} color={t.text3}/>}
                        </div>
                      </button>
                      {open && (
                        <div style={{ borderTop:`1px solid ${t.border}` }}>
                          {majors.map((m, i) => {
                            const sel = selectedMajorIds.has(m.id);
                            const jobs = taxonomy[String(m.id)]?.j || [];
                            return (
                              <button key={m.id} onClick={() => toggleMajor(m.id)} style={{
                                display:"flex", alignItems:"center", justifyContent:"space-between",
                                width:"100%", padding:"13px 20px",
                                background: sel ? t.purpleBg : "transparent",
                                border:"none",
                                borderBottom: i < majors.length-1 ? `1px solid ${t.border}` : "none",
                                cursor:"pointer", textAlign:"right", fontFamily:"inherit",
                              }}>
                                <div>
                                  <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                                    <span style={{ fontSize:13, fontWeight: sel ? 700 : 400, color: sel ? t.purple : t.text }}>
                                      {m.name}
                                    </span>
                                    {taxonomy[String(m.id)]?.m_en && (
                                      <span style={{ fontSize:11, color:t.text3 }}>{taxonomy[String(m.id)].m_en}</span>
                                    )}
                                  </div>
                                  <span style={{ fontSize:11, color:t.text3 }}>
                                    {jobs.length} وظيفة
                                  </span>
                                </div>
                                <div style={{
                                  width:20, height:20, borderRadius:6, flexShrink:0,
                                  border:`1.5px solid ${sel ? "#7c3aed" : t.border}`,
                                  background: sel ? "#7c3aed" : "transparent",
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                }}>
                                  {sel && <CheckCircle size={12} strokeWidth={2.5} color="#fff"/>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* حفظ التخصصات */}
            <button onClick={handleSaveTaxonomy} disabled={savingTax} style={{
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              width:"100%", padding:"14px",
              background: dark ? "#fff" : "#09090b",
              color: dark ? "#0a0a0a" : "#fff",
              border:"none", borderRadius:14, fontSize:15, fontWeight:700,
              cursor: savingTax ? "not-allowed" : "pointer",
              fontFamily:"inherit", opacity: savingTax ? 0.7 : 1,
            }}>
              {savingTax
                ? <><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/> جاري الحفظ…</>
                : <><GraduationCap size={16}/> حفظ {selectedMajorIds.size} تخصص</>
              }
            </button>
          </>

        ) : (

          /* ── تبويب المسميات المخصصة ── */
          <>
            {msg && msgBox(msg)}

            {selectedFields.length > 0 && (
              <div style={{ background:t.purpleBg, border:`1px solid ${t.purpleBd}`, borderRadius:16, padding:16, marginBottom:16 }}>
                <p style={{ color:t.purple, fontSize:13, fontWeight:700, margin:"0 0 10px" }}>{selectedFields.length} مسمى مختار</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {selectedFields.map(f => (
                    <span key={f.id} style={{
                      display:"inline-flex", alignItems:"center", gap:5,
                      padding:"6px 10px 6px 7px", borderRadius:100,
                      background: dark ? "#1a1a3a" : "#ede9fe",
                      border:`1px solid ${dark ? "#3a3a6a" : "#c4b5fd"}`,
                      color:t.purple, fontSize:12,
                    }}>
                      {f.name_ar}
                      <button onClick={() => toggleField(f.id)} style={{ background:"transparent",border:"none",cursor:"pointer",color:t.purple,padding:0,display:"flex" }}>
                        <X size={11} strokeWidth={2.5}/>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
              <p style={{ color:t.text, fontSize:13, fontWeight:600, margin:"0 0 10px" }}>أضف مسمى غير موجود في القائمة</p>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCustom()}
                  placeholder="مثال: مطور تطبيقات جوال…"
                  style={{
                    flex:1, padding:"10px 14px", borderRadius:10,
                    border:`1px solid ${t.border}`, background:t.input,
                    color:t.text, fontSize:13, outline:"none", fontFamily:"inherit",
                  }}
                />
                <button onClick={handleAddCustom} disabled={addingCustom || !customName.trim()} style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  padding:"10px 16px", borderRadius:10, border:"none",
                  background: dark ? "#fff" : "#09090b", color: dark ? "#0a0a0a" : "#fff",
                  fontSize:13, fontWeight:700, cursor:"pointer",
                  opacity: addingCustom || !customName.trim() ? 0.5 : 1, fontFamily:"inherit",
                }}>
                  {addingCustom ? <Loader2 size={13} style={{ animation:"spin 1s linear infinite" }}/> : <Plus size={13}/>}
                  إضافة
                </button>
              </div>
            </div>

            <div style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"11px 14px", borderRadius:12,
              background:t.input, border:`1px solid ${t.border}`, marginBottom:12,
            }}>
              <Search size={16} strokeWidth={1.5} color={t.text3}/>
              <input
                value={customSearch}
                onChange={e => setCustomSearch(e.target.value)}
                placeholder={`ابحث في ${allFields.length} مسمى…`}
                style={{ flex:1, border:"none", background:"transparent", color:t.text, fontSize:14, outline:"none", fontFamily:"inherit" }}
              />
            </div>

            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", marginBottom:20 }}>
              {filteredCustom.length === 0 ? (
                <p style={{ color:t.text3, textAlign:"center", padding:"30px 20px", fontSize:13 }}>لا توجد نتائج</p>
              ) : filteredCustom.map((field, i) => {
                const selected = selectedIds.has(field.id);
                return (
                  <button key={field.id} onClick={() => toggleField(field.id)} style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    width:"100%", padding:"14px 16px",
                    background: selected ? t.purpleBg : "transparent",
                    border:"none",
                    borderBottom: i < filteredCustom.length-1 ? `1px solid ${t.border}` : "none",
                    cursor:"pointer", textAlign:"right", fontFamily:"inherit",
                  }}>
                    <span style={{ fontSize:14, fontWeight:selected?600:400, color:selected?t.purple:t.text }}>{field.name_ar}</span>
                    <div style={{
                      width:22, height:22, borderRadius:7, flexShrink:0,
                      border:`1.5px solid ${selected ? "#7c3aed" : t.border}`,
                      background: selected ? "#7c3aed" : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      {selected && <CheckCircle size={13} strokeWidth={2.5} color="#fff"/>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* برامج التوظيف */}
            <div style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:14, padding:16, marginBottom:16 }}>
              <p style={{ color:t.text, fontSize:13, fontWeight:600, margin:"0 0 12px" }}>برامج التوظيف</p>
              {[["allowTamheer","تمهير","تقديم على وظائف برنامج تمهير"],["allowCooperative","تدريب تعاوني","تقديم على وظائف التدريب التعاوني للطلاب"]].map(([key,label,desc])=>(
                <label key={key} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 0", borderBottom: key==="allowTamheer" ? `1px solid ${t.border}` : "none",
                  cursor:"pointer",
                }}>
                  <div>
                    <p style={{ color:t.text, fontSize:13, fontWeight:600, margin:0 }}>{label}</p>
                    <p style={{ color:t.text3, fontSize:11, margin:0 }}>{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={key==="allowTamheer" ? allowTamheer : allowCooperative}
                    onChange={e => key==="allowTamheer" ? setAllowTamheer(e.target.checked) : setAllowCooperative(e.target.checked)}
                    style={{ width:16, height:16, cursor:"pointer", accentColor:"#7c3aed" }}
                  />
                </label>
              ))}
            </div>

            <button onClick={handleSave} disabled={saving} style={{
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              width:"100%", padding:"14px",
              background: dark ? "#fff" : "#09090b", color: dark ? "#0a0a0a" : "#fff",
              border:"none", borderRadius:14, fontSize:15, fontWeight:700,
              cursor:saving?"not-allowed":"pointer", fontFamily:"inherit",
            }}>
              {saving
                ? <><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/> جاري الحفظ…</>
                : <><Save size={16}/> حفظ {selectedIds.size} مسمى</>
              }
            </button>
          </>
        )}
      </div>
    </PortalShell>
  );
}
