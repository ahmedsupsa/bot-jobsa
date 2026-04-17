"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch, clearToken, authHeaders } from "@/lib/portal-auth";
import {
  Sparkles, CheckCircle, XCircle, Save, Briefcase, Bot, Loader2,
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
  const [aiTitles, setAiTitles] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState("");

  async function load() {
    try {
      const res = await portalFetch("/preferences");
      if (res.status === 401) { clearToken(); router.replace("/portal/login"); return; }
      const d = await res.json();
      setFields(d.all_fields || []);
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
      setMsg({ text: `تم حفظ ${d.count} مجال بنجاح`, type: "ok" });
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setSaving(false); }
  }

  async function extractFromCV() {
    setExtracting(true); setMsg(null); setAiTitles([]); setAiSummary("");
    try {
      const res = await fetch("/api/portal/preferences/extract", {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ text: d.error || "فشل التحليل", type: "err" }); return; }

      const newIds: string[] = d.matched_ids.map(String);

      // Update fields list with AI-generated ones
      if (d.all_fields?.length) setFields(prev => {
        const existingIds = new Set(prev.map((f: Field) => String(f.id)));
        const newOnes = d.all_fields.filter((f: Field) => !existingIds.has(String(f.id)));
        return [...prev, ...newOnes];
      });

      setSelected(new Set(newIds));
      setAiTitles(d.job_titles || []);
      setAiSummary(d.summary || "");

      // Auto-save immediately to DB
      const saveRes = await portalFetch("/preferences", {
        method: "POST",
        body: JSON.stringify({ field_ids: newIds }),
      });
      const saveData = await saveRes.json();

      if (saveRes.ok) {
        setMsg({ text: `تم استخراج ${newIds.length} مسمى وظيفي وحفظها تلقائياً ✓`, type: "ok" });
      } else {
        setMsg({ text: saveData.error || "استُخرجت المسميات لكن فشل الحفظ، اضغط حفظ يدوياً", type: "info" });
      }
    } catch { setMsg({ text: "خطأ في الاتصال", type: "err" }); }
    finally { setExtracting(false); }
  }

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

        {/* AI Extract button */}
        <div style={s.aiCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Bot size={18} strokeWidth={1.5} color="#fff" />
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>استخراج تلقائي بالذكاء الاصطناعي</span>
          </div>
          <p style={{ color: "#888", fontSize: 13, margin: "0 0 16px", lineHeight: 1.7 }}>
            يقرأ الذكاء الاصطناعي سيرتك الذاتية ويقترح تلقائياً المجالات والمسميات الوظيفية المناسبة لك
          </p>
          <button
            style={{ ...s.btnAI, ...(extracting ? s.btnDisabled : {}) }}
            onClick={extractFromCV}
            disabled={extracting}
          >
            {extracting
              ? <><Loader2 size={15} strokeWidth={1.5} className="spin-icon" /> جاري التحليل…</>
              : <><Sparkles size={15} strokeWidth={1.5} /> استخرج من سيرتي الذاتية</>
            }
          </button>
        </div>

        {/* AI Summary + Titles */}
        {(aiSummary || aiTitles.length > 0) && (
          <div style={s.summaryCard}>
            {aiSummary && (
              <div style={{ marginBottom: aiTitles.length ? 16 : 0 }}>
                <p style={{ color: "#999", fontSize: 12, margin: "0 0 6px", fontWeight: 600 }}>ملخص سيرتك</p>
                <p style={{ color: "#ccc", fontSize: 13, margin: 0, lineHeight: 1.7 }}>{aiSummary}</p>
              </div>
            )}
            {aiTitles.length > 0 && (
              <div>
                <p style={{ color: "#999", fontSize: 12, margin: "0 0 10px", fontWeight: 600 }}>
                  المسميات الوظيفية المقترحة ({aiTitles.length})
                </p>
                <div style={s.titlesWrap}>
                  {aiTitles.map((t, i) => (
                    <span key={i} style={s.titleChip}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Message */}
        {msg && (
          <div style={{
            ...s.msg,
            background: msg.type === "ok" ? "#0a1f0a" : msg.type === "info" ? "#0a0f1a" : "#1a0a0a",
            color: msg.type === "ok" ? "#22c55e" : msg.type === "info" ? "#60a5fa" : "#f87171",
            border: `1px solid ${msg.type === "ok" ? "#22c55e22" : msg.type === "info" ? "#60a5fa22" : "#f8717122"}`,
          }}>
            {msg.type === "ok" ? <CheckCircle size={15} strokeWidth={2} />
              : msg.type === "info" ? <Sparkles size={15} strokeWidth={2} />
                : <XCircle size={15} strokeWidth={2} />}
            {msg.text}
          </div>
        )}

        {/* Fields grid */}
        {loading ? (
          <p style={{ color: "#555", textAlign: "center", padding: 40 }}>جاري التحميل…</p>
        ) : (
          <>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>المجالات المتاحة</span>
              <span style={s.sectionCount}>{selectedCount} محدد من {fields.length}</span>
            </div>

            <div style={s.grid}>
              {fields.map(f => {
                const active = selected.has(String(f.id));
                return (
                  <button
                    key={f.id}
                    style={{ ...s.chip, ...(active ? s.chipActive : {}) }}
                    onClick={() => toggle(String(f.id))}
                  >
                    {active && <CheckCircle size={13} strokeWidth={2} color="#22c55e" />}
                    {f.name_ar}
                  </button>
                );
              })}
            </div>

            <button
              style={{ ...s.saveBtn, ...(saving ? s.btnDisabled : {}) }}
              onClick={save}
              disabled={saving}
            >
              <Save size={16} strokeWidth={1.5} />
              {saving ? "جاري الحفظ…" : `حفظ التفضيلات (${selectedCount})`}
            </button>
          </>
        )}

      </div>
    </PortalShell>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 680, margin: "0 auto" },
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
    borderRadius: 16, padding: "22px 24px", marginBottom: 16,
  },
  btnAI: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "11px 22px", borderRadius: 12,
    background: "#fff", color: "#0a0a0a",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: "none",
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },

  summaryCard: {
    background: "#111", border: "1px solid #1f1f1f",
    borderRadius: 14, padding: "20px 22px", marginBottom: 16,
  },
  titlesWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  titleChip: {
    background: "#1a1a2a", border: "1px solid #2a2a4a",
    borderRadius: 100, padding: "5px 14px",
    color: "#90a0ff", fontSize: 12, fontWeight: 500,
  },

  msg: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "13px 16px", borderRadius: 12, marginBottom: 16,
    fontSize: 13, fontWeight: 500,
  },

  sectionHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: { color: "#fff", fontSize: 14, fontWeight: 700 },
  sectionCount: {
    background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 100, padding: "4px 12px",
    color: "#888", fontSize: 12,
  },

  grid: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 16px", borderRadius: 100,
    background: "#111", border: "1px solid #2a2a2a",
    color: "#888", fontSize: 13, cursor: "pointer",
    transition: "all 0.15s", fontFamily: "inherit",
  },
  chipActive: {
    background: "#0a1f0a", border: "1px solid #22c55e44",
    color: "#fff",
  },

  saveBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "14px",
    background: "#fff", color: "#0a0a0a",
    border: "none", borderRadius: 14,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
};
