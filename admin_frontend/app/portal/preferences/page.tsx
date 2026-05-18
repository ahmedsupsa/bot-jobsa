"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Search, CheckCircle, Save, Loader2, XCircle, Plus, X,
} from "lucide-react";

interface JobField { id: string; name_ar: string; category?: string; }

export default function PreferencesPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const t = {
    surface: dark ? "#111"    : "#fff",
    border:  dark ? "#1f1f1f" : "#e4e4e7",
    text:    dark ? "#fff"    : "#09090b",
    text2:   dark ? "#aaa"    : "#71717a",
    text3:   dark ? "#666"    : "#a1a1aa",
    iconBg:  dark ? "#1a1a1a" : "#f4f4f5",
    input:   dark ? "#141414" : "#fff",
  };

  const [allFields, setAllFields] = useState<JobField[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  async function load() {
    try {
      const res = await portalFetch("/preferences");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const d = await res.json();
      setAllFields(d.all_fields || []);
      setSelectedIds(new Set((d.selected_ids || []).map(String)));
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function toggleField(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setMsg(null);
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/portal/preferences", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ field_ids: [...selectedIds] }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الحفظ", type: "err" }); return; }
      setMsg({ text: `تم حفظ ${d.count} مجال وظيفي ✓`, type: "ok" });
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
      const newField = d.field as JobField;
      setAllFields(prev =>
        prev.find(f => f.id === newField.id) ? prev : [...prev, newField]
      );
      setSelectedIds(prev => new Set([...prev, String(newField.id)]));
      setCustomName("");
      setMsg({ text: `تمت إضافة "${newField.name_ar}" ✓`, type: "ok" });
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setAddingCustom(false); }
  }

  const filtered = allFields.filter(f =>
    f.name_ar.toLowerCase().includes(search.toLowerCase())
  );
  const selectedFields = allFields.filter(f => selectedIds.has(f.id));

  return (
    <PortalShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: t.text, fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
            تفضيلات الوظائف
          </h1>
          <p style={{ color: t.text2, fontSize: 13, margin: 0 }}>
            اختر المجالات التي تريد البوت يبحث فيها عن وظائف لك
          </p>
        </div>

        {loading ? (
          <p style={{ color: t.text3, textAlign: "center", padding: 60 }}>جاري التحميل…</p>
        ) : (
          <>
            {/* رسالة */}
            {msg && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, marginBottom: 16,
                fontSize: 13, fontWeight: 500,
                background: msg.type === "ok" ? (dark ? "#0a1f0a" : "#f0fdf4") : (dark ? "#1a0a0a" : "#fef2f2"),
                color: msg.type === "ok" ? (dark ? "#86efac" : "#166534") : "#f87171",
                border: `1px solid ${msg.type === "ok" ? (dark ? "#2a2a2a" : "#bbf7d0") : (dark ? "#7f1d1d" : "#fecaca")}`,
              }}>
                {msg.type === "ok" ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {msg.text}
              </div>
            )}

            {/* المجالات المختارة */}
            {selectedFields.length > 0 && (
              <div style={{
                background: dark ? "#0d0d1a" : "#f5f3ff",
                border: `1px solid ${dark ? "#1e1e3a" : "#ddd6fe"}`,
                borderRadius: 16, padding: "16px", marginBottom: 16,
              }}>
                <p style={{ color: dark ? "#c4b5fd" : "#5b21b6", fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>
                  {selectedFields.length} مجال مختار
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {selectedFields.map(f => (
                    <span key={f.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 10px 6px 7px", borderRadius: 100,
                      background: dark ? "#1a1a3a" : "#ede9fe",
                      border: `1px solid ${dark ? "#3a3a6a" : "#c4b5fd"}`,
                      color: dark ? "#c4b5fd" : "#5b21b6", fontSize: 12,
                    }}>
                      {f.name_ar}
                      <button onClick={() => toggleField(f.id)} style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: dark ? "#a78bfa" : "#7c3aed", padding: 0, display: "flex",
                      }}>
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* إضافة مسمى مخصص */}
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: 14, padding: "14px 16px", marginBottom: 16,
            }}>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>
                أضف مسمى وظيفي غير موجود في القائمة
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCustom()}
                  placeholder="مثال: مطور تطبيقات جوال…"
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${t.border}`, background: t.input,
                    color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={handleAddCustom}
                  disabled={addingCustom || !customName.trim()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: dark ? "#fff" : "#09090b",
                    color: dark ? "#0a0a0a" : "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    opacity: addingCustom || !customName.trim() ? 0.5 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  {addingCustom ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />}
                  إضافة
                </button>
              </div>
            </div>

            {/* البحث */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "11px 14px", borderRadius: 12,
              background: t.input, border: `1px solid ${t.border}`,
              marginBottom: 12,
            }}>
              <Search size={16} strokeWidth={1.5} color={t.text3} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`ابحث في ${allFields.length} مجال…`}
                style={{
                  flex: 1, border: "none", background: "transparent",
                  color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit",
                }}
              />
            </div>

            {/* قائمة المجالات */}
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: 16, overflow: "hidden", marginBottom: 20,
            }}>
              {filtered.length === 0 ? (
                <p style={{ color: t.text3, textAlign: "center", padding: "30px 20px", fontSize: 13 }}>
                  لا توجد نتائج
                </p>
              ) : (
                filtered.map((field, i) => {
                  const selected = selectedIds.has(field.id);
                  return (
                    <button
                      key={field.id}
                      onClick={() => toggleField(field.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "14px 16px",
                        background: selected ? (dark ? "#0d0d1a" : "#f5f3ff") : "transparent",
                        border: "none",
                        borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none",
                        cursor: "pointer", textAlign: "right", fontFamily: "inherit",
                        transition: "background 0.12s",
                      }}
                    >
                      <span style={{
                        fontSize: 14, fontWeight: selected ? 600 : 400,
                        color: selected ? (dark ? "#c4b5fd" : "#5b21b6") : t.text,
                      }}>
                        {field.name_ar}
                      </span>
                      <div style={{
                        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                        border: `1.5px solid ${selected ? (dark ? "#7c3aed" : "#7c3aed") : t.border}`,
                        background: selected ? "#7c3aed" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.12s",
                      }}>
                        {selected && <CheckCircle size={13} strokeWidth={2.5} color="#fff" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* زر الحفظ */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "14px",
                background: dark ? "#fff" : "#09090b",
                color: dark ? "#0a0a0a" : "#fff",
                border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving
                ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> جاري الحفظ…</>
                : <><Save size={16} /> حفظ {selectedIds.size} مجال</>
              }
            </button>
          </>
        )}
      </div>
    </PortalShell>
  );
}
