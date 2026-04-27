"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Shell from "@/components/shell";
import {
  Play, Copy, Check, Trash2, Clock, Database,
  ChevronDown, Loader2, AlertCircle, Table2, Download,
} from "lucide-react";

const SNIPPETS = [
  {
    label: "إنشاء جداول المهام (Tasks)",
    sql: `-- جداول نظام المهام الداخلية
CREATE TABLE IF NOT EXISTS admin_task_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_tasks (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES admin_task_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to TEXT,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);`,
  },
  {
    label: "قائمة الجداول",
    sql: `SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;`,
  },
  {
    label: "قائمة الأعمدة",
    sql: `SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;`,
  },
  {
    label: "إحصائيات قاعدة البيانات",
    sql: `SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;`,
  },
];

const HISTORY_KEY = "sql_editor_history";
const MAX_HISTORY = 20;

function getHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveToHistory(sql: string) {
  const prev = getHistory().filter(s => s !== sql);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([sql, ...prev].slice(0, MAX_HISTORY)));
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function downloadCSV(columns: string[], rows: Record<string, unknown>[]) {
  const header = columns.join(",");
  const body = rows.map(r =>
    columns.map(c => {
      const v = String(r[c] ?? "");
      return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",")
  ).join("\n");
  const blob = new Blob(["\ufeff" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "query_result.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function SqlEditorPage() {
  const [authed, setAuthed] = useState(false);
  const [sql, setSql] = useState("SELECT current_database(), current_user, version();");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    rows?: Record<string, unknown>[];
    columns?: string[];
    count?: number;
    elapsed_ms?: number;
    error?: string;
  } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<number | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.ok || !d.isSuper) { window.location.href = "/login"; return; }
        setAuthed(true);
        setHistory(getHistory());
      });
  }, []);

  const run = useCallback(async () => {
    const query = sql.trim();
    if (!query || running) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/sql", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      setResult(d);
      if (d.ok) {
        saveToHistory(query);
        setHistory(getHistory());
      }
    } catch (e) {
      setResult({ ok: false, error: "فشل الاتصال بالخادم" });
    }
    setRunning(false);
  }, [sql, running]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [run]);

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text4)" }} />
      </div>
    );
  }

  return (
    <Shell>
      <style jsx>{`
        .sql-textarea {
          width: 100%;
          height: 220px;
          resize: vertical;
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          font-size: 13.5px;
          line-height: 1.6;
          padding: 14px 16px;
          background: var(--bg);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 10px;
          outline: none;
          direction: ltr;
          text-align: left;
          tab-size: 2;
          box-sizing: border-box;
        }
        .sql-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
        }
        .result-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          direction: ltr;
        }
        .result-table th {
          background: var(--bg2);
          color: var(--text);
          font-weight: 700;
          padding: 9px 12px;
          text-align: left;
          border-bottom: 2px solid var(--border);
          white-space: nowrap;
          position: sticky;
          top: 0;
        }
        .result-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-table tr:hover td { background: var(--bg2); }
        .dropdown-panel {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 50;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          min-width: 280px;
          max-width: 420px;
          max-height: 360px;
          overflow-y: auto;
          padding: 6px;
        }
        .snippet-btn {
          display: block;
          width: 100%;
          padding: 10px 12px;
          background: none;
          border: none;
          border-radius: 8px;
          text-align: right;
          cursor: pointer;
          font-size: 13px;
          color: var(--text);
          font-family: inherit;
        }
        .snippet-btn:hover { background: var(--bg2); }
      `}</style>

      <div style={{ maxWidth: "100%", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Database size={20} style={{ color: "var(--text)" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>SQL Editor</h1>
            <p style={{ fontSize: 12, color: "var(--text4)", margin: 0 }}>قاعدة البيانات المحلية — Ctrl+Enter للتشغيل</p>
          </div>
        </div>

        {/* Editor Card */}
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)" }}>

          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg2)", flexWrap: "wrap" }}>

            {/* Run */}
            <button
              onClick={run}
              disabled={running || !sql.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 9, border: "none",
                background: "var(--accent)", color: "var(--accent-fg, #fff)",
                fontSize: 13, fontWeight: 700, cursor: running ? "wait" : "pointer",
                opacity: !sql.trim() || running ? 0.55 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              تشغيل
            </button>

            {/* Clear */}
            <button
              onClick={() => { setSql(""); setResult(null); textareaRef.current?.focus(); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
            >
              <Trash2 size={13} /> مسح
            </button>

            {/* Snippets */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => { setShowSnippets(v => !v); setShowHistory(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: showSnippets ? "var(--bg2)" : "transparent", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
              >
                استعلامات جاهزة <ChevronDown size={13} />
              </button>
              {showSnippets && (
                <div className="dropdown-panel">
                  {SNIPPETS.map((s, i) => (
                    <button
                      key={i}
                      className="snippet-btn"
                      onClick={() => { setSql(s.sql); setShowSnippets(false); textareaRef.current?.focus(); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setShowHistory(v => !v); setShowSnippets(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: showHistory ? "var(--bg2)" : "transparent", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
                >
                  <Clock size={13} /> السجل ({history.length})
                </button>
                {showHistory && (
                  <div className="dropdown-panel">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        className="snippet-btn"
                        style={{ fontFamily: "monospace", fontSize: 11, direction: "ltr", textAlign: "left" }}
                        onClick={() => { setSql(h); setShowHistory(false); textareaRef.current?.focus(); }}
                      >
                        {h.slice(0, 80).replace(/\s+/g, " ")}{h.length > 80 ? "…" : ""}
                      </button>
                    ))}
                    <button
                      onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); setShowHistory(false); }}
                      style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 8, textAlign: "right", cursor: "pointer", fontSize: 12, color: "#ef4444", fontFamily: "inherit", borderTop: "1px solid var(--border)", marginTop: 4 }}
                    >
                      مسح السجل كله
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Copy SQL */}
            <button
              onClick={async () => {
                await copyToClipboard(sql);
                setCopiedSnippet(-1);
                setTimeout(() => setCopiedSnippet(null), 1500);
              }}
              style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 13, cursor: "pointer" }}
            >
              {copiedSnippet === -1 ? <Check size={13} style={{ color: "#22c55e" }} /> : <Copy size={13} />}
              نسخ
            </button>
          </div>

          {/* Textarea */}
          <div style={{ padding: 14 }}>
            <textarea
              ref={textareaRef}
              className="sql-textarea"
              value={sql}
              onChange={e => setSql(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              placeholder="اكتب استعلام SQL هنا…"
              onClick={() => { setShowSnippets(false); setShowHistory(false); }}
            />
            <p style={{ fontSize: 11, color: "var(--text4)", margin: "6px 0 0", textAlign: "left", direction: "ltr" }}>
              Ctrl + Enter to run · Tab = 2 spaces
            </p>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div style={{ background: "var(--bg)", border: `1px solid ${result.ok ? "var(--border)" : "#ef4444"}`, borderRadius: 14, overflow: "hidden", boxShadow: "var(--shadow)" }}>

            {/* Result header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
              {result.ok ? (
                <>
                  <Table2 size={15} style={{ color: "var(--text2)", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                    {result.count} صف{result.count !== 1 ? "" : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text4)" }}>
                    · {result.elapsed_ms} ms
                  </span>
                  {result.count === 0 && (
                    <span style={{ fontSize: 12, color: "#22c55e" }}>✓ تم تنفيذ الاستعلام</span>
                  )}
                  {(result.count ?? 0) > 0 && (
                    <button
                      onClick={() => downloadCSV(result.columns!, result.rows as Record<string, unknown>[])}
                      style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: 12, cursor: "pointer" }}
                    >
                      <Download size={12} /> CSV
                    </button>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle size={15} style={{ color: "#ef4444", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>خطأ</span>
                </>
              )}
            </div>

            {/* Error */}
            {!result.ok && (
              <div style={{ padding: 16, direction: "ltr" }}>
                <pre style={{ fontSize: 13, color: "#ef4444", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                  {result.error}
                </pre>
              </div>
            )}

            {/* Table */}
            {result.ok && (result.count ?? 0) > 0 && (
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <table className="result-table">
                  <thead>
                    <tr>
                      <th style={{ background: "var(--bg2)", color: "var(--text4)", fontSize: 11, padding: "7px 12px", borderBottom: "2px solid var(--border)", textAlign: "left", position: "sticky", top: 0 }}>#</th>
                      {result.columns!.map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.rows as Record<string, unknown>[]).map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text4)", fontSize: 11, userSelect: "none" }}>{i + 1}</td>
                        {result.columns!.map(col => {
                          const val = row[col];
                          const str = val === null ? "NULL" : val === true ? "true" : val === false ? "false" : String(val);
                          const isNull = val === null;
                          return (
                            <td
                              key={col}
                              title={str}
                              style={{ color: isNull ? "var(--text4)" : "var(--text)", fontStyle: isNull ? "italic" : "normal", fontFamily: "monospace", fontSize: 12 }}
                            >
                              {str}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty result success */}
            {result.ok && (result.count ?? 0) === 0 && (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text4)", fontSize: 13 }}>
                لا توجد صفوف
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close dropdowns on outside click */}
      {(showSnippets || showHistory) && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
          onClick={() => { setShowSnippets(false); setShowHistory(false); }}
        />
      )}
    </Shell>
  );
}
