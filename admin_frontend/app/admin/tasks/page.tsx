"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "@/components/shell";
import {
  Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp,
  Flag, User, Calendar, MoreHorizontal, GripVertical, Loader2,
  ListTodo, ClipboardList,
} from "lucide-react";

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

interface TaskGroup {
  id: number;
  name: string;
  color: string;
  position: number;
  created_by: string;
  created_at: string;
}

interface Task {
  id: number;
  group_id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigned_to: string | null;
  due_date: string | null;
  created_by: string;
  position: number;
  created_at: string;
  updated_at: string | null;
}

const STATUS_LABELS: Record<Status, string> = {
  todo: "للتنفيذ",
  in_progress: "قيد التنفيذ",
  done: "مكتمل",
};

const STATUS_COLORS: Record<Status, string> = {
  todo: "#6b7280",
  in_progress: "#f59e0b",
  done: "#10b981",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#6b7280",
  medium: "#f59e0b",
  high: "#ef4444",
};

const GROUP_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
  "#84cc16", "#f97316",
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function isOverdue(due: string | null, status: Status) {
  if (!due || status === "done") return false;
  return new Date(due) < new Date();
}

// ─── Task Card ───
function TaskCard({
  task,
  groups,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: Task;
  groups: TaskGroup[];
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: Status) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overdue = isOverdue(task.due_date, task.status);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const nextStatus: Record<Status, Status> = { todo: "in_progress", in_progress: "done", done: "todo" };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 8,
        cursor: "default",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => onStatusChange(task.id, nextStatus[task.status])}
          title={`تغيير الحالة إلى: ${STATUS_LABELS[nextStatus[task.status]]}`}
          style={{
            width: 20, height: 20, borderRadius: "50%", border: `2px solid ${STATUS_COLORS[task.status]}`,
            background: task.status === "done" ? STATUS_COLORS[task.status] : "transparent",
            flexShrink: 0, cursor: "pointer", marginTop: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {task.status === "done" && <Check size={11} color="#fff" strokeWidth={3} />}
        </button>
        <span
          style={{
            flex: 1, fontSize: 14, fontWeight: 500, color: "var(--ink)",
            textDecoration: task.status === "done" ? "line-through" : "none",
            opacity: task.status === "done" ? 0.6 : 1,
            lineHeight: 1.4,
          }}
        >
          {task.title}
        </span>
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              padding: "2px 4px", borderRadius: 6, border: "none", background: "transparent",
              cursor: "pointer", color: "var(--muted)", lineHeight: 1,
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", left: 0, top: "100%", zIndex: 50,
              background: "var(--panel)", border: "1px solid var(--line)",
              borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 140, padding: "6px 4px",
            }}>
              <button
                onClick={() => { setMenuOpen(false); onEdit(task); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: "none", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}
              >
                <Pencil size={13} /> تعديل
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete(task.id); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: "none", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#ef4444" }}
              >
                <Trash2 size={13} /> حذف
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, lineHeight: 1.5, marginRight: 28 }}>
          {task.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginRight: 28 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
          background: `${PRIORITY_COLORS[task.priority]}20`,
          color: PRIORITY_COLORS[task.priority],
        }}>
          <Flag size={9} style={{ display: "inline", marginLeft: 3, verticalAlign: "middle" }} />
          {PRIORITY_LABELS[task.priority]}
        </span>

        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
          background: `${STATUS_COLORS[task.status]}20`,
          color: STATUS_COLORS[task.status],
        }}>
          {STATUS_LABELS[task.status]}
        </span>

        {task.assigned_to && (
          <span style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 3 }}>
            <User size={10} /> {task.assigned_to}
          </span>
        )}

        {task.due_date && (
          <span style={{
            fontSize: 11, color: overdue ? "#ef4444" : "var(--muted)",
            display: "flex", alignItems: "center", gap: 3, fontWeight: overdue ? 700 : 400,
          }}>
            <Calendar size={10} /> {formatDate(task.due_date)}
            {overdue && " ⚠️"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Task Form Modal ───
function TaskModal({
  task,
  groups,
  defaultGroupId,
  onSave,
  onClose,
}: {
  task: Task | null;
  groups: TaskGroup[];
  defaultGroupId: number | null;
  onSave: (data: Partial<Task> & { id?: number }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState<Status>(task?.status || "todo");
  const [priority, setPriority] = useState<Priority>(task?.priority || "medium");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || "");
  const [dueDate, setDueDate] = useState(task?.due_date?.slice(0, 10) || "");
  const [groupId, setGroupId] = useState<number>(task?.group_id || defaultGroupId || groups[0]?.id || 0);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      id: task?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      assigned_to: assignedTo.trim() || undefined,
      due_date: dueDate || undefined,
      group_id: groupId,
    });
    setSaving(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--panel)", borderRadius: 16,
        border: "1px solid var(--line)", width: "100%", maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px 24px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            {task ? "تعديل المهمة" : "مهمة جديدة"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>عنوان المهمة *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="اكتب عنوان المهمة..."
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)",
                fontSize: 14, boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>الوصف</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="تفاصيل إضافية (اختياري)..."
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)",
                fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>المجموعة</label>
              <select
                value={groupId}
                onChange={e => setGroupId(Number(e.target.value))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }}
              >
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>الحالة</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as Status)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }}
              >
                {(Object.keys(STATUS_LABELS) as Status[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>الأولوية</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }}
              >
                {(Object.keys(PRIORITY_LABELS) as Priority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>تاريخ الاستحقاق</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>المسند إليه</label>
            <input
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              placeholder="اسم المسؤول (اختياري)"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 10,
                border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)",
                fontSize: 13, boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--ink2)", fontSize: 14, cursor: "pointer", fontWeight: 500 }}
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={saving || !title.trim()}
            style={{
              padding: "9px 22px", borderRadius: 10, border: "none",
              background: "var(--accent)", color: "var(--accent-fg, #fff)",
              fontSize: 14, fontWeight: 700, cursor: saving ? "wait" : "pointer",
              opacity: saving || !title.trim() ? 0.6 : 1,
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {task ? "حفظ التغييرات" : "إضافة المهمة"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Column ───
function GroupColumn({
  group,
  tasks,
  allGroups,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onEditGroup,
  onDeleteGroup,
}: {
  group: TaskGroup;
  tasks: Task[];
  allGroups: TaskGroup[];
  onAddTask: (groupId: number) => void;
  onEditTask: (t: Task) => void;
  onDeleteTask: (id: number) => void;
  onStatusChange: (id: number, status: Status) => void;
  onEditGroup: (g: TaskGroup) => void;
  onDeleteGroup: (id: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [groupMenu, setGroupMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const done = tasks.filter(t => t.status === "done").length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setGroupMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div style={{
      width: 300, flexShrink: 0,
      background: "var(--panel2)", borderRadius: 16,
      border: "1px solid var(--line)", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "14px 14px 12px",
        borderBottom: collapsed ? "none" : "1px solid var(--line)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: "50%",
          background: group.color, flexShrink: 0,
        }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {group.name}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
          background: `${group.color}20`, color: group.color,
        }}>
          {tasks.length}
        </span>
        {done > 0 && (
          <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>
            ✓{done}
          </span>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            onClick={() => setGroupMenu(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 2 }}
          >
            <MoreHorizontal size={14} />
          </button>
          {groupMenu && (
            <div style={{
              position: "absolute", left: 0, top: "100%", zIndex: 50,
              background: "var(--panel)", border: "1px solid var(--line)",
              borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 140, padding: "6px 4px",
            }}>
              <button
                onClick={() => { setGroupMenu(false); onEditGroup(group); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: "none", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "var(--ink)" }}
              >
                <Pencil size={13} /> تعديل المجموعة
              </button>
              <button
                onClick={() => { setGroupMenu(false); onDeleteGroup(group.id); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: "none", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#ef4444" }}
              >
                <Trash2 size={13} /> حذف المجموعة
              </button>
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, padding: "12px 10px 10px", overflowY: "auto", minHeight: 60 }}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              groups={allGroups}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onStatusChange={onStatusChange}
            />
          ))}
          <button
            onClick={() => onAddTask(group.id)}
            style={{
              display: "flex", alignItems: "center", gap: 7, width: "100%",
              padding: "8px 10px", borderRadius: 10, border: "1px dashed var(--line)",
              background: "transparent", color: "var(--muted)", fontSize: 13,
              cursor: "pointer", marginTop: tasks.length > 0 ? 4 : 0,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = group.color;
              e.currentTarget.style.color = group.color;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            <Plus size={14} /> إضافة مهمة
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Group Form Modal ───
function GroupModal({
  group,
  onSave,
  onClose,
}: {
  group: TaskGroup | null;
  onSave: (data: { id?: number; name: string; color: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [color, setColor] = useState(group?.color || GROUP_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ id: group?.id, name: name.trim(), color });
    setSaving(false);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--panel)", borderRadius: 16, border: "1px solid var(--line)", width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            {group ? "تعديل المجموعة" : "مجموعة جديدة"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>اسم المجموعة *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="مثال: التسويق، التقنية..."
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 8 }}>اللون</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {GROUP_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", background: c,
                    border: color === c ? "3px solid var(--ink)" : "3px solid transparent",
                    cursor: "pointer", outline: "none",
                    boxShadow: color === c ? `0 0 0 2px var(--panel), 0 0 0 4px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--line)", background: "transparent", color: "var(--ink2)", fontSize: 14, cursor: "pointer", fontWeight: 500 }}>
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            style={{
              padding: "9px 22px", borderRadius: 10, border: "none",
              background: color, color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: saving ? "wait" : "pointer", opacity: saving || !name.trim() ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {group ? "حفظ" : "إنشاء المجموعة"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function TasksPage() {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null; defaultGroupId: number | null }>({ open: false, task: null, defaultGroupId: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: TaskGroup | null }>({ open: false, group: null });

  const load = useCallback(async () => {
    const [gr, tk] = await Promise.all([
      fetch("/api/admin/tasks/groups", { credentials: "include" }).then(r => r.json()),
      fetch("/api/admin/tasks", { credentials: "include" }).then(r => r.json()),
    ]);
    if (gr.ok) setGroups(gr.groups || []);
    if (tk.ok) setTasks(tk.tasks || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─ Task actions ─
  const saveTask = async (data: Partial<Task> & { id?: number }) => {
    if (data.id) {
      await fetch("/api/admin/tasks", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } else {
      await fetch("/api/admin/tasks", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    await load();
    setTaskModal({ open: false, task: null, defaultGroupId: null });
  };

  const deleteTask = async (id: number) => {
    if (!confirm("تأكيد حذف هذه المهمة؟")) return;
    await fetch(`/api/admin/tasks?id=${id}`, { method: "DELETE", credentials: "include" });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const changeStatus = async (id: number, status: Status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await fetch("/api/admin/tasks", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
  };

  // ─ Group actions ─
  const saveGroup = async (data: { id?: number; name: string; color: string }) => {
    if (data.id) {
      await fetch("/api/admin/tasks/groups", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } else {
      await fetch("/api/admin/tasks/groups", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    await load();
    setGroupModal({ open: false, group: null });
  };

  const deleteGroup = async (id: number) => {
    const count = tasks.filter(t => t.group_id === id).length;
    const msg = count > 0 ? `هذه المجموعة تحتوي على ${count} مهمة. هل تريد حذفها جميعاً؟` : "تأكيد حذف المجموعة؟";
    if (!confirm(msg)) return;
    await fetch(`/api/admin/tasks/groups?id=${id}`, { method: "DELETE", credentials: "include" });
    setGroups(prev => prev.filter(g => g.id !== id));
    setTasks(prev => prev.filter(t => t.group_id !== id));
  };

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
    overdue: tasks.filter(t => isOverdue(t.due_date, t.status)).length,
  };

  return (
    <Shell>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--panel2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={20} color="var(--ink)" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>المهام</h1>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>تتبع وإدارة مهام الفريق</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setGroupModal({ open: true, group: null })}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                borderRadius: 10, border: "1px solid var(--line)", background: "var(--panel)",
                color: "var(--ink)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus size={15} /> مجموعة جديدة
            </button>
            {groups.length > 0 && (
              <button
                onClick={() => setTaskModal({ open: true, task: null, defaultGroupId: groups[0]?.id || null })}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                  borderRadius: 10, border: "none", background: "var(--accent)",
                  color: "var(--accent-fg, #fff)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                <Plus size={15} /> مهمة جديدة
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {tasks.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { label: "الكل", value: stats.total, color: "var(--ink)" },
              { label: "للتنفيذ", value: stats.todo, color: "#6b7280" },
              { label: "قيد التنفيذ", value: stats.in_progress, color: "#f59e0b" },
              { label: "مكتمل", value: stats.done, color: "#10b981" },
              ...(stats.overdue > 0 ? [{ label: "متأخر", value: stats.overdue, color: "#ef4444" }] : []),
            ].map(s => (
              <div key={s.label} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 99, background: "var(--panel2)", border: "1px solid var(--line)",
                fontSize: 13, color: "var(--muted)",
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</span>
                {s.label}
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "var(--muted)" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && groups.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "80px 20px", textAlign: "center",
          }}>
            <ListTodo size={48} color="var(--muted)" style={{ marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>لا توجد مجموعات بعد</h3>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 20px" }}>أنشئ مجموعة لبدء تنظيم مهامك</p>
            <button
              onClick={() => setGroupModal({ open: true, group: null })}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "10px 20px",
                borderRadius: 10, border: "none", background: "var(--accent)",
                color: "var(--accent-fg, #fff)", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              <Plus size={16} /> إنشاء أول مجموعة
            </button>
          </div>
        )}

        {/* Kanban Board */}
        {!loading && groups.length > 0 && (
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
            {groups.map(group => (
              <GroupColumn
                key={group.id}
                group={group}
                tasks={tasks.filter(t => t.group_id === group.id)}
                allGroups={groups}
                onAddTask={gid => setTaskModal({ open: true, task: null, defaultGroupId: gid })}
                onEditTask={t => setTaskModal({ open: true, task: t, defaultGroupId: null })}
                onDeleteTask={deleteTask}
                onStatusChange={changeStatus}
                onEditGroup={g => setGroupModal({ open: true, group: g })}
                onDeleteGroup={deleteGroup}
              />
            ))}

            {/* Add group card */}
            <div
              onClick={() => setGroupModal({ open: true, group: null })}
              style={{
                width: 280, flexShrink: 0, borderRadius: 16, border: "2px dashed var(--line)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "32px 20px", cursor: "pointer", color: "var(--muted)",
                transition: "all 0.15s", minHeight: 120,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--muted)"; }}
            >
              <Plus size={24} style={{ marginBottom: 8 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>مجموعة جديدة</span>
            </div>
          </div>
        )}
      </div>

      {/* Task Modal */}
      {taskModal.open && (
        <TaskModal
          task={taskModal.task}
          groups={groups}
          defaultGroupId={taskModal.defaultGroupId}
          onSave={saveTask}
          onClose={() => setTaskModal({ open: false, task: null, defaultGroupId: null })}
        />
      )}

      {/* Group Modal */}
      {groupModal.open && (
        <GroupModal
          group={groupModal.group}
          onSave={saveGroup}
          onClose={() => setGroupModal({ open: false, group: null })}
        />
      )}
    </Shell>
  );
}
