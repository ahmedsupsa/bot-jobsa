"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Sparkles, CheckCircle, XCircle, Save, Briefcase, Bot, Loader2, Search, X,
} from "lucide-react";

interface Field { id: string; name_ar: string; }

export default function PreferencesPage() {
  const router = useRouter();
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" | "info" } | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const res = await portalFetch("/preferences");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const d = await res.json();
      // Deduplicate by name_ar
      const seen = new Set<string>();
      const unique = (d.all_fields || []).filter((f: Field) => {
        if (seen.has(f.name_ar)) return false;
        seen.add(f.name_ar); return true;
      });
      setFields(unique);
      setSelected(new Set((d.selected_ids || []).map(String)));
    } catch { clearToken(); router.replace("/portal/login"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await portalFetch("/preferences", {
        method: "POST",
        body: JSON.stringify({ field_ids: Array.from(selected) }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل الحفظ", type: "err" }); return; }
      setMsg({ text: `تم حفظ ${d.count} مجال بنجاح ✓`, type: "ok" });
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  async function extractFromCV() {
    setExtracting(true); setMsg(null); setAiSummary("");
    try {
      const res = await fetch("/api/portal/preferences/extract", {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل التحليل", type: "err" }); return; }

      const newIds: string[] = d.matched_ids.map(String);

      // Merge new AI fields (deduplicated)
      if (d.all_fields?.length) {
        setFields(prev => {
          const seen = new Set(prev.map((f: Field) => f.name_ar));
          const newOnes = d.all_fields.filter((f: Field) => !seen.has(f.name_ar));
          return [...prev, ...newOnes];
        });
      }

      setSelected(new Set(newIds));
      setAiSummary(d.summary || "");

      // Auto-save to DB
      const saveRes = await portalFetch("/preferences", {
        method: "POST",
        body: JSON.stringify({ field_ids: newIds }),
      });
      const saveData = await saveRes.json();

      if (saveRes.ok) {
        setMsg({ text: `تم استخراج ${newIds.length} مسمى وظيفي وحفظها تلقائياً ✓`, type: "ok" });
      } else {
        setMsg({ text: saveData.error || "استُخرجت المسميات — اضغط حفظ لتأكيدها", type: "info" });
      }
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setExtracting(false); }
  }

  // Smart sort: selected first → then alphabetical
  const sortedFiltered = useMemo(() => {
    const q = search.trim();
    const filtered = q
      ? fields.filter(f => f.name_ar.includes(q))
      : fields;
    return [...filtered].sort((a, b) => {
      const aSelected = selected.has(String(a.id));
      const bSelected = selected.has(String(b.id));
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name_ar.localeCompare(b.name_ar, "ar");
    });
  }, [fields, selected, search]);

  const selectedCount = selected.size;

  return (
    <PortalShell>
      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}><Briefcase size={22} strokeWidth={1.5} color="#fff" /></div>
          <div>
            <h1 style={s.title}>تفضيلات الوظائف</h1>
            <p style={s.sub}>حدّد المجالات التي تريد التقديم عليها</p>
          </div>
        </div>

        {/* AI Extract */}
        <div style={s.aiCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Bot size={18} strokeWidth={1.5} color="#fff" />
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>استخراج تلقائي بالذكاء الاصطناعي</span>
          </div>
          {aiSummary && (
            <p style={{ color: "#aaa", fontSize: 12, margin: "0 0 12px", lineHeight: 1.7, borderRight: "2px solid #2a2a4a", paddingRight: 10 }}>
              {aiSummary}
            </p>
          )}
          {!aiSummary && (
            <p style={{ color: "#666", fontSize: 13, margin: "0 0 14px" }}>
              يقرأ سيرتك ويستخرج المسميات المناسبة لك ويحفظها تلقائياً
            </p>
          )}
          <button style={{ ...s.btnAI, ...(extracting ? s.btnDisabled : {}) }} onClick={extractFromCV} disabled={extracting}>
            {extracting
              ? <><Loader2 size={14} strokeWidth={1.5} className="spin-icon" /> جاري التحليل…</>
              : <><Sparkles size={14} strokeWidth={1.5} /> استخرج من سيرتي الذاتية</>}
          </button>
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            ...s.msg,
            background: msg.type === "ok" ? "#0a1f0a" : msg.type === "info" ? "#0a0f1a" : "#1a0a0a",
            color: msg.type === "ok" ? "#22c55e" : msg.type === "info" ? "#60a5fa" : "#f87171",
            border: `1px solid ${msg.type === "ok" ? "#22c55e33" : msg.type === "info" ? "#60a5fa33" : "#f8717133"}`,
          }}>
            {msg.type === "ok" ? <CheckCircle size={15} strokeWidth={2} /> : msg.type === "info" ? <Sparkles size={15} /> : <XCircle size={15} strokeWidth={2} />}
            {msg.text}
          </div>
        )}

        {/* Fields section */}
        {!loading && (
          <>
            {/* Top bar */}
            <div style={s.topBar}>
              {/* Search */}
              <div style={s.searchWrap}>
                <Search size={14} strokeWidth={1.5} color="#555" style={{ flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="ابحث عن مجال…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={s.searchInput}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={s.clearBtn}>
                    <X size={12} strokeWidth={2} />
                  </button>
                )}
              </div>

              {/* Count + deselect all */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {selectedCount > 0 && (
                  <button style={s.deselectBtn} onClick={() => setSelected(new Set())}>
                    إلغاء الكل
                  </button>
                )}
                <span style={s.countBadge}>{selectedCount} محدد</span>
              </div>
            </div>

            {/* Chips */}
            <div style={s.grid}>
              {sortedFiltered.length === 0 && (
                <p style={{ color: "#555", fontSize: 13, padding: "20px 0" }}>لا توجد نتائج</p>
              )}
              {sortedFiltered.map(f => {
                const active = selected.has(String(f.id));
                return (
                  <button
                    key={f.id}
                    style={{ ...s.chip, ...(active ? s.chipActive : {}) }}
                    onClick={() => toggle(String(f.id))}
                  >
                    {active && <CheckCircle size={12} strokeWidth={2.5} color="#22c55e" style={{ flexShrink: 0 }} />}
                    {f.name_ar}
                  </button>
                );
              })}
            </div>

            {/* Save button */}
            <button style={{ ...s.saveBtn, ...(saving ? s.btnDisabled : {}) }} onClick={save} disabled={saving}>
              <Save size={16} strokeWidth={1.5} />
              {saving ? "جاري الحفظ…" : `حفظ التفضيلات${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
            </button>
          </>
        )}

        {loading && <p style={{ color: "#555", textAlign: "center", padding: 40 }}>جاري التحميل…</p>}
      </div>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 700, margin: "0 auto" },
  header: {
    display: "flex", alignItems: "center", gap: 16,
    background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 18, padding: "24px 28px", marginBottom: 20,
  },
  headerIcon: {
    width: 52, height: 52, borderRadius: 14, background: "#1a1a1a",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 },
  sub: { color: "#666", fontSize: 13, margin: "4px 0 0" },

  aiCard: {
    background: "#0d0d1a", border: "1px solid #1e1e3a",
    borderRadius: 16, padding: "20px 22px", marginBottom: 16,
  },
  btnAI: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 20px", borderRadius: 10,
    background: "#fff", color: "#0a0a0a",
    fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },

  msg: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "12px 16px", borderRadius: 12, marginBottom: 16,
    fontSize: 13, fontWeight: 500,
  },

  topBar: {
    display: "flex", alignItems: "center", gap: 12,
    marginBottom: 14, flexWrap: "wrap",
  },
  searchWrap: {
    flex: 1, minWidth: 180,
    display: "flex", alignItems: "center", gap: 10,
    background: "#111", border: "1px solid #2a2a2a",
    borderRadius: 10, padding: "9px 14px",
  },
  searchInput: {
    flex: 1, background: "transparent", border: "none",
    color: "#fff", fontSize: 13, outline: "none",
    fontFamily: "inherit", direction: "rtl",
  },
  clearBtn: {
    background: "transparent", border: "none",
    color: "#555", cursor: "pointer", padding: 2, display: "flex",
  },
  deselectBtn: {
    background: "transparent", border: "1px solid #2a2a2a",
    borderRadius: 8, padding: "5px 12px",
    color: "#666", fontSize: 12, cursor: "pointer",
    fontFamily: "inherit",
  },
  countBadge: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 100, padding: "5px 14px",
    color: "#aaa", fontSize: 12, whiteSpace: "nowrap",
  },

  grid: { display: "flex", flexWrap: "wrap", gap: 9, marginBottom: 24 },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 100,
    background: "#111", border: "1px solid #222",
    color: "#777", fontSize: 13, cursor: "pointer",
    transition: "all 0.12s", fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  chipActive: {
    background: "#071a07", border: "1px solid #22c55e55",
    color: "#e8ffe8",
  },

  saveBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "14px",
    background: "#fff", color: "#0a0a0a",
    border: "none", borderRadius: 14,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
};
