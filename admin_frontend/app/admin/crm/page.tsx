"use client";

import Shell from "@/components/shell";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Contact, Plus, Search, Phone, Mail, MessageCircle, Instagram, Twitter,
  Calendar, Clock, AlertCircle, CheckCircle2, Loader2, X, Save, Trash2,
  ChevronRight, Bell, ArrowDownLeft, ArrowUpRight, User as UserIcon, Users,
} from "lucide-react";

type Status = "lead" | "contacted" | "negotiating" | "won" | "lost";
type Channel = "whatsapp" | "phone" | "email" | "instagram" | "twitter" | "in_person" | "other";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: Status;
  notes: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Interaction {
  id: string;
  customer_id: string;
  channel: Channel;
  direction: "in" | "out";
  summary: string;
  occurred_at: string;
}

const STATUS_INFO: Record<Status, { label: string; color: string; bg: string }> = {
  lead:        { label: "عميل محتمل",  color: "#3b82f6", bg: "rgba(59,130,246,.12)" },
  contacted:   { label: "تم التواصل", color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  negotiating: { label: "قيد التفاوض", color: "#a855f7", bg: "rgba(168,85,247,.12)" },
  won:         { label: "تم البيع ✓",  color: "#10b981", bg: "rgba(16,185,129,.12)" },
  lost:        { label: "مفقود",       color: "#ef4444", bg: "rgba(239,68,68,.12)" },
};

const CHANNEL_INFO: Record<Channel, { label: string; icon: any }> = {
  whatsapp:  { label: "واتساب",   icon: MessageCircle },
  phone:     { label: "اتصال",    icon: Phone },
  email:     { label: "بريد",     icon: Mail },
  instagram: { label: "إنستقرام", icon: Instagram },
  twitter:   { label: "تويتر",    icon: Twitter },
  in_person: { label: "حضوري",    icon: UserIcon },
  other:     { label: "أخرى",     icon: MessageCircle },
};

const EMPTY: Omit<Customer, "id" | "created_at" | "updated_at"> = {
  name: "", phone: "", email: "", source: "",
  status: "lead", notes: "", next_followup_at: null,
};

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  } catch { return s; }
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("ar-SA", { dateStyle: "medium" }); }
  catch { return s; }
}
function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s).getTime() < Date.now();
}
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CrmPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Status | "due">("all");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [openCustomer, setOpenCustomer] = useState<Customer | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [editing, setEditing] = useState<Customer | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [newInter, setNewInter] = useState<{ channel: Channel; direction: "in" | "out"; summary: string }>(
    { channel: "whatsapp", direction: "out", summary: "" }
  );
  const [interSaving, setInterSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/crm/customers", { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (j.ok) setCustomers(j.customers);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDrawer = useCallback(async (id: string) => {
    setOpenId(id);
    setDrawerLoading(true);
    try {
      const r = await fetch(`/api/admin/crm/customers/${id}`, { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setOpenCustomer(j.customer);
        setInteractions(j.interactions || []);
        setEditing(j.customer);
      }
    } finally { setDrawerLoading(false); }
  }, []);

  const closeDrawer = () => {
    setOpenId(null); setOpenCustomer(null); setInteractions([]); setEditing(null);
    setNewInter({ channel: "whatsapp", direction: "out", summary: "" });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      if (filter === "due" && !isOverdue(c.next_followup_at)) return false;
      if (filter !== "all" && filter !== "due" && c.status !== filter) return false;
      if (q) {
        const hay = `${c.name} ${c.phone||""} ${c.email||""} ${c.source||""} ${c.notes||""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, search, filter]);

  const stats = useMemo(() => {
    const s = { total: customers.length, lead: 0, contacted: 0, negotiating: 0, won: 0, lost: 0, due: 0 };
    customers.forEach(c => {
      (s as any)[c.status] = ((s as any)[c.status] || 0) + 1;
      if (isOverdue(c.next_followup_at)) s.due++;
    });
    return s;
  }, [customers]);

  const create = async () => {
    setCreateErr(""); setSaving(true);
    try {
      const payload = {
        ...form,
        next_followup_at: form.next_followup_at ? new Date(form.next_followup_at).toISOString() : null,
      };
      const r = await fetch("/api/admin/crm/customers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "فشل الإضافة");
      setShowCreate(false); setForm({ ...EMPTY }); await load();
    } catch (e) { setCreateErr(String(e).replace("Error: ", "")); }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const payload = {
        name: editing.name, phone: editing.phone, email: editing.email,
        source: editing.source, status: editing.status, notes: editing.notes,
        next_followup_at: editing.next_followup_at
          ? new Date(editing.next_followup_at).toISOString() : null,
      };
      const r = await fetch(`/api/admin/crm/customers/${editing.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.ok) { setOpenCustomer(j.customer); await load(); }
    } finally { setSavingEdit(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا العميل وجميع سجلات تواصله؟")) return;
    await fetch(`/api/admin/crm/customers/${id}`, { method: "DELETE", credentials: "include" });
    closeDrawer(); await load();
  };

  const addInteraction = async () => {
    if (!openId || !newInter.summary.trim()) return;
    setInterSaving(true);
    try {
      const r = await fetch(`/api/admin/crm/customers/${openId}/interactions`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInter),
      });
      const j = await r.json();
      if (j.ok) {
        setInteractions(prev => [j.interaction, ...prev]);
        setNewInter({ channel: newInter.channel, direction: newInter.direction, summary: "" });
      }
    } finally { setInterSaving(false); }
  };

  const removeInteraction = async (interId: string) => {
    if (!openId) return;
    if (!confirm("حذف هذا السجل؟")) return;
    await fetch(`/api/admin/crm/customers/${openId}/interactions?interactionId=${interId}`, {
      method: "DELETE", credentials: "include",
    });
    setInteractions(prev => prev.filter(i => i.id !== interId));
  };

  return (
    <Shell>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-panel2 border border-line flex items-center justify-center">
              <Contact size={20} className="text-ink" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">علاقات العملاء</h1>
              <p className="text-xs text-muted">تابع عملاءك من أول تواصل لإغلاق الصفقة</p>
            </div>
          </div>
          <button
            onClick={() => { setForm({ ...EMPTY }); setCreateErr(""); setShowCreate(true); }}
            className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2.5 text-sm font-bold hover:opacity-90 transition"
          >
            <Plus size={16} /> إضافة عميل
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="الإجمالي" value={stats.total} icon={<Users size={16} />} active={filter==="all"} onClick={() => setFilter("all")} />
          <StatCard label="متابعات اليوم" value={stats.due} icon={<Bell size={16} />} active={filter==="due"} onClick={() => setFilter("due")} accent />
          <StatCard label={STATUS_INFO.lead.label}        value={stats.lead}        active={filter==="lead"}        onClick={() => setFilter("lead")} />
          <StatCard label={STATUS_INFO.contacted.label}   value={stats.contacted}   active={filter==="contacted"}   onClick={() => setFilter("contacted")} />
          <StatCard label={STATUS_INFO.negotiating.label} value={stats.negotiating} active={filter==="negotiating"} onClick={() => setFilter("negotiating")} />
          <StatCard label={STATUS_INFO.won.label}         value={stats.won}         active={filter==="won"}         onClick={() => setFilter("won")} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، الجوال، الإيميل، أو الملاحظات..."
            className="w-full rounded-xl border border-line bg-panel py-2.5 pr-10 pl-4 text-sm text-ink placeholder:text-muted2 focus:outline-none focus:border-line2"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted gap-2">
            <Loader2 size={18} className="animate-spin" /> جاري التحميل...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-line bg-panel p-10 text-center">
            <Contact size={36} className="mx-auto text-muted2 mb-3" />
            <p className="text-sm text-muted">لا يوجد عملاء يطابقون البحث</p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-panel overflow-hidden">
            {filtered.map((c, i) => {
              const st = STATUS_INFO[c.status];
              const overdue = isOverdue(c.next_followup_at);
              return (
                <button
                  key={c.id}
                  onClick={() => openDrawer(c.id)}
                  className={`w-full flex items-center gap-3 p-4 text-right hover:bg-panel2 transition ${i>0 ? "border-t border-line" : ""}`}
                >
                  <div className="h-10 w-10 rounded-full bg-panel2 border border-line flex items-center justify-center text-ink font-bold flex-shrink-0">
                    {c.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink truncate">{c.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {overdue && (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold bg-danger-bg text-danger">
                          <AlertCircle size={11} /> متابعة متأخرة
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mt-1 flex-wrap">
                      {c.phone && <span className="flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1 truncate"><Mail size={11} />{c.email}</span>}
                      {c.source && <span className="text-muted2">• {c.source}</span>}
                      {c.next_followup_at && (
                        <span className={`flex items-center gap-1 ${overdue ? "text-danger" : ""}`}>
                          <Calendar size={11} /> {fmtDate(c.next_followup_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted2 flex-shrink-0 rtl:rotate-180" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="إضافة عميل جديد">
          <FormFields form={form} setForm={setForm as any} />
          {createErr && <div className="text-xs text-danger mt-2">{createErr}</div>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowCreate(false)} className="rounded-xl border border-line bg-panel2 px-4 py-2 text-sm text-ink hover:bg-panel">إلغاء</button>
            <button onClick={create} disabled={saving || !form.name.trim()}
              className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-bold disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ
            </button>
          </div>
        </Modal>
      )}

      {/* Drawer / details */}
      {openId && (
        <div className="fixed inset-0 z-50 flex" dir="rtl">
          <div className="flex-1 bg-[var(--modal-backdrop)]" onClick={closeDrawer} />
          <div className="w-full max-w-2xl bg-bg border-l border-line overflow-y-auto" style={{ height: "100dvh" }}>
            <div className="flex items-center justify-between p-4 border-b border-line sticky top-0 bg-bg z-10">
              <div className="flex items-center gap-2">
                <Contact size={18} className="text-ink" />
                <h2 className="font-bold text-ink">تفاصيل العميل</h2>
              </div>
              <div className="flex items-center gap-1">
                {openCustomer && (
                  <button onClick={() => remove(openCustomer.id)}
                    className="p-2 rounded-lg text-danger hover:bg-danger-bg" title="حذف">
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={closeDrawer} className="p-2 rounded-lg text-muted hover:bg-panel2">
                  <X size={18} />
                </button>
              </div>
            </div>

            {drawerLoading || !editing ? (
              <div className="flex items-center justify-center py-20 text-muted gap-2">
                <Loader2 size={18} className="animate-spin" /> جاري التحميل...
              </div>
            ) : (
              <div className="p-4 space-y-5">
                {/* Edit */}
                <section className="rounded-xl border border-line bg-panel p-4 space-y-3">
                  <div className="text-xs font-bold text-muted">البيانات الأساسية</div>
                  <FormFields form={editing as any} setForm={setEditing as any} />
                  <div className="flex justify-end">
                    <button onClick={saveEdit} disabled={savingEdit}
                      className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-bold disabled:opacity-50">
                      {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} حفظ التعديلات
                    </button>
                  </div>
                </section>

                {/* Add interaction */}
                <section className="rounded-xl border border-line bg-panel p-4 space-y-3">
                  <div className="text-xs font-bold text-muted">إضافة سجل تواصل</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newInter.channel}
                      onChange={e => setNewInter(s => ({ ...s, channel: e.target.value as Channel }))}
                      className="rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink">
                      {Object.entries(CHANNEL_INFO).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <select value={newInter.direction}
                      onChange={e => setNewInter(s => ({ ...s, direction: e.target.value as any }))}
                      className="rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink">
                      <option value="out">صادر (أنا تواصلت معه)</option>
                      <option value="in">وارد (هو تواصل معي)</option>
                    </select>
                  </div>
                  <textarea value={newInter.summary}
                    onChange={e => setNewInter(s => ({ ...s, summary: e.target.value }))}
                    placeholder="ملخص التواصل: وش تكلمتوا فيه، نتيجة المكالمة، الخطوة القادمة..."
                    rows={3}
                    className="w-full rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink placeholder:text-muted2 resize-none" />
                  <div className="flex justify-end">
                    <button onClick={addInteraction} disabled={interSaving || !newInter.summary.trim()}
                      className="flex items-center gap-2 rounded-xl bg-accent text-accent-fg px-4 py-2 text-sm font-bold disabled:opacity-50">
                      {interSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} إضافة سجل
                    </button>
                  </div>
                </section>

                {/* Timeline */}
                <section>
                  <div className="text-xs font-bold text-muted mb-2 flex items-center gap-2">
                    <Clock size={12} /> سجل التواصل ({interactions.length})
                  </div>
                  {interactions.length === 0 ? (
                    <div className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-muted">
                      لا يوجد سجلات تواصل بعد
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {interactions.map(it => {
                        const ch = CHANNEL_INFO[it.channel] || CHANNEL_INFO.other;
                        const Icon = ch.icon;
                        return (
                          <div key={it.id} className="rounded-xl border border-line bg-panel p-3 flex gap-3">
                            <div className="h-8 w-8 rounded-full bg-panel2 border border-line flex items-center justify-center flex-shrink-0">
                              <Icon size={14} className="text-ink" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-ink">{ch.label}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-panel2 text-muted flex items-center gap-1">
                                  {it.direction === "in"
                                    ? <><ArrowDownLeft size={10} /> وارد</>
                                    : <><ArrowUpRight size={10} /> صادر</>}
                                </span>
                                <span className="text-[10px] text-muted2 mr-auto">{fmtDateTime(it.occurred_at)}</span>
                              </div>
                              <p className="text-sm text-ink mt-1 whitespace-pre-wrap">{it.summary}</p>
                            </div>
                            <button onClick={() => removeInteraction(it.id)}
                              className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger-bg flex-shrink-0 self-start">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

function StatCard({ label, value, icon, active, accent, onClick }: any) {
  return (
    <button onClick={onClick}
      className={`rounded-xl border p-3 text-right transition ${
        active ? "border-line2 bg-panel2" : "border-line bg-panel hover:bg-panel2"
      }`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted truncate">{label}</span>
        {icon && <span className={accent && value > 0 ? "text-danger" : "text-muted2"}>{icon}</span>}
      </div>
      <div className={`text-xl font-bold mt-1 ${accent && value > 0 ? "text-danger" : "text-ink"}`}>{value}</div>
    </button>
  );
}

function Modal({ children, title, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)]" onClick={onClose} dir="rtl">
      <div className="w-full max-w-lg rounded-2xl bg-bg border border-line shadow-xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:bg-panel2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormFields({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const upd = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));
  return (
    <div className="space-y-2.5">
      <Field label="الاسم *" value={form.name || ""} onChange={v => upd("name", v)} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="الجوال" value={form.phone || ""} onChange={v => upd("phone", v)} dir="ltr" />
        <Field label="البريد" value={form.email || ""} onChange={v => upd("email", v)} dir="ltr" type="email" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="المصدر (مثلاً: إنستقرام)" value={form.source || ""} onChange={v => upd("source", v)} />
        <div>
          <label className="text-[11px] font-bold text-muted block mb-1">الحالة</label>
          <select value={form.status || "lead"} onChange={e => upd("status", e.target.value)}
            className="w-full rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink">
            {Object.entries(STATUS_INFO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-muted block mb-1">تذكير المتابعة القادم</label>
        <input type="datetime-local"
          value={toLocalInputValue(form.next_followup_at)}
          onChange={e => upd("next_followup_at", e.target.value || null)}
          className="w-full rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink" />
      </div>
      <div>
        <label className="text-[11px] font-bold text-muted block mb-1">ملاحظات</label>
        <textarea value={form.notes || ""} onChange={e => upd("notes", e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink placeholder:text-muted2 resize-none"
          placeholder="أي تفاصيل مهمة عن العميل..." />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", dir }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; dir?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold text-muted block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} dir={dir}
        className="w-full rounded-xl border border-line bg-bg py-2 px-3 text-sm text-ink placeholder:text-muted2" />
    </div>
  );
}
