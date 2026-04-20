"use client";

import Shell from "@/components/shell";
import { API_BASE } from "@/lib/api";
import { useEffect, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Save, ToggleLeft, ToggleRight,
  Mail, FileText, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
};

const EMPTY: Omit<Template, "id" | "created_at"> = {
  name: "",
  subject: "",
  body: "",
  is_active: true,
};

const PLACEHOLDERS = [
  { key: "{الاسم}", desc: "اسم المتقدم" },
  { key: "{المسمى_الوظيفي}", desc: "عنوان الوظيفة" },
  { key: "{الشركة}", desc: "اسم الشركة" },
  { key: "{المدينة}", desc: "المدينة" },
  { key: "{التخصص}", desc: "التخصص المهني" },
];

const s = {
  page: { padding: "4px 0" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 } as React.CSSProperties,
  title: { color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  addBtn: {
    display: "flex", alignItems: "center", gap: 7, background: "#fff", color: "#000",
    border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer",
  } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 } as React.CSSProperties,
  card: {
    background: "#111", border: "1px solid #222", borderRadius: 16, padding: 20,
    display: "flex", flexDirection: "column", gap: 14,
  } as React.CSSProperties,
  cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } as React.CSSProperties,
  cardTitle: { color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 } as React.CSSProperties,
  cardSubject: { color: "#888", fontSize: 13, margin: 0, lineHeight: 1.5 } as React.CSSProperties,
  cardBody: {
    color: "#666", fontSize: 12, lineHeight: 1.7, maxHeight: 80, overflow: "hidden",
    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4,
  } as React.CSSProperties,
  badgeActive: { background: "#ffffff15", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 },
  badgeInactive: { background: "#ff000015", color: "#f87171", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 },
  actions: { display: "flex", gap: 8, marginTop: 4 } as React.CSSProperties,
  iconBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "transparent",
    border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 12px",
    fontSize: 12, color: "#aaa", cursor: "pointer",
  } as React.CSSProperties,
  dangerBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "transparent",
    border: "1px solid #3a1a1a", borderRadius: 8, padding: "6px 12px",
    fontSize: 12, color: "#f87171", cursor: "pointer",
  } as React.CSSProperties,
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 999, padding: 16,
  } as React.CSSProperties,
  modal: {
    background: "#111", border: "1px solid #2a2a2a", borderRadius: 20,
    padding: 28, width: "100%", maxWidth: 640, maxHeight: "90vh",
    overflowY: "auto", display: "flex", flexDirection: "column", gap: 18,
  } as React.CSSProperties,
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: 700, margin: 0 } as React.CSSProperties,
  label: { color: "#aaa", fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" } as React.CSSProperties,
  input: {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  } as React.CSSProperties,
  textarea: {
    width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13,
    outline: "none", resize: "vertical", minHeight: 200, boxSizing: "border-box",
    fontFamily: "monospace", lineHeight: 1.7,
  } as React.CSSProperties,
  phBox: {
    background: "#0f0f0f", border: "1px solid #1f1f1f", borderRadius: 10, padding: 12,
  } as React.CSSProperties,
  phTitle: { color: "#666", fontSize: 12, marginBottom: 8 } as React.CSSProperties,
  phChips: { display: "flex", flexWrap: "wrap", gap: 6 } as React.CSSProperties,
  phChip: {
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 6,
    padding: "3px 8px", fontSize: 11, color: "#aaa", cursor: "pointer",
    fontFamily: "monospace",
  } as React.CSSProperties,
  saveBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "#fff", color: "#000", border: "none", borderRadius: 12,
    padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%",
  } as React.CSSProperties,
  empty: { textAlign: "center", padding: "60px 20px", color: "#444" } as React.CSSProperties,
  expandBtn: {
    background: "none", border: "none", color: "#555", cursor: "pointer",
    fontSize: 11, display: "flex", alignItems: "center", gap: 4, padding: 0,
  } as React.CSSProperties,
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<Omit<Template, "id" | "created_at">>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/templates`);
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY);
    setEditId(null);
    setModal("create");
  }

  function openEdit(t: Template) {
    setForm({ name: t.name, subject: t.subject, body: t.body, is_active: t.is_active });
    setEditId(t.id);
    setModal("edit");
  }

  async function save() {
    setSaving(true);
    try {
      const url = modal === "edit" ? `${API_BASE}/api/templates/${editId}` : `${API_BASE}/api/templates`;
      const method = modal === "edit" ? "PUT" : "POST";
      await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(t: Template) {
    await fetch(`${API_BASE}/api/templates/${t.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...t, is_active: !t.is_active }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا القالب؟")) return;
    await fetch(`${API_BASE}/api/templates/${id}`, { method: "DELETE" });
    await load();
  }

  function insertPlaceholder(key: string) {
    setForm(f => ({ ...f, body: f.body + key }));
  }

  return (
    <Shell>
      <div style={s.page}>
        <div style={s.header}>
          <h1 style={s.title}>
            <FileText size={22} color="#fff" /> قوالب رسائل التقديم
          </h1>
          <button style={s.addBtn} onClick={openCreate}>
            <Plus size={16} /> قالب جديد
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} color="#444" className="animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div style={s.empty}>
            <Mail size={40} color="#333" style={{ marginBottom: 14 }} />
            <p style={{ margin: 0, fontSize: 15, color: "#555" }}>لا توجد قوالب بعد</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#444" }}>أضف قالباً يستخدمه النظام عند إرسال طلبات التقديم</p>
          </div>
        ) : (
          <div style={s.grid}>
            {templates.map(t => (
              <div key={t.id} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={{ flex: 1 }}>
                    <p style={s.cardTitle}>{t.name}</p>
                    <p style={{ ...s.cardSubject, marginTop: 4 }}>
                      <span style={{ color: "#555", fontSize: 11 }}>الموضوع: </span>{t.subject}
                    </p>
                  </div>
                  <span style={t.is_active ? s.badgeActive : s.badgeInactive}>
                    {t.is_active ? "نشط" : "معطّل"}
                  </span>
                </div>

                <div>
                  <p style={expanded[t.id] ? { ...s.cardBody, maxHeight: "none", WebkitLineClamp: "unset" as unknown as number } : s.cardBody}>
                    {t.body}
                  </p>
                  <button style={s.expandBtn} onClick={() => setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}>
                    {expanded[t.id] ? <><ChevronUp size={12} /> تصغير</> : <><ChevronDown size={12} /> عرض الكامل</>}
                  </button>
                </div>

                <div style={s.actions}>
                  <button style={s.iconBtn} onClick={() => openEdit(t)}>
                    <Pencil size={12} /> تعديل
                  </button>
                  <button style={s.iconBtn} onClick={() => toggle(t)}>
                    {t.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                    {t.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button style={s.dangerBtn} onClick={() => remove(t.id)}>
                    <Trash2 size={12} /> حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {modal && (
          <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
            <div style={s.modal}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={s.modalTitle}>{modal === "edit" ? "تعديل القالب" : "قالب جديد"}</h2>
                <button style={{ background: "none", border: "none", color: "#666", cursor: "pointer" }} onClick={() => setModal(null)}>
                  <X size={20} />
                </button>
              </div>

              <div>
                <label style={s.label}>اسم القالب</label>
                <input
                  style={s.input}
                  placeholder="مثال: رسالة تقديم عامة"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  dir="rtl"
                />
              </div>

              <div>
                <label style={s.label}>موضوع البريد (Subject)</label>
                <input
                  style={s.input}
                  placeholder="مثال: طلب التوظيف — {المسمى_الوظيفي} في {الشركة}"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  dir="rtl"
                />
              </div>

              <div>
                <label style={s.label}>نص الرسالة (Body)</label>
                <div style={s.phBox}>
                  <p style={s.phTitle}>متغيرات متاحة — اضغط للإضافة:</p>
                  <div style={s.phChips as React.CSSProperties}>
                    {PLACEHOLDERS.map(p => (
                      <button key={p.key} style={s.phChip} title={p.desc} onClick={() => insertPlaceholder(p.key)}>
                        {p.key}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  style={{ ...s.textarea, marginTop: 8 }}
                  placeholder="اكتب نص الرسالة هنا..."
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  dir="rtl"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ ...s.label, margin: 0 }}>نشط</label>
                <button
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: form.is_active ? "#fff" : "#555" }}
                >
                  {form.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              <button style={s.saveBtn} onClick={save} disabled={saving || !form.name || !form.subject || !form.body}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "جارٍ الحفظ..." : "حفظ القالب"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
