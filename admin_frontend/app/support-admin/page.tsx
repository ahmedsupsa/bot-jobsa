"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Shell from "@/components/shell";
import { Send, MessageCircle, Loader2, ArrowRight, Search, Plus, X, User, Phone, Mail, FileText, Paperclip, Image as ImageIcon } from "lucide-react";

interface Attachment { url: string; name?: string | null; type?: string | null; size?: number | null; }
function fmtSize(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface Conv {
  user_id: string;
  full_name: string;
  phone: string;
  last_message: string;
  last_at: string;
  last_sender: string;
  unread_count: number;
}
interface Meta {
  kind?: string;
  title?: string;
  fields?: { label: string; value: string }[];
  [k: string]: unknown;
}
interface Msg {
  id: string;
  sender: "user" | "admin";
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  attachment_size?: number | null;
  meta?: Meta | null;
}
interface SearchUser {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
}

export default function SupportAdminPage() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [filtered, setFiltered]           = useState<Conv[]>([]);
  const [searchConv, setSearchConv]       = useState("");
  const [activeUserId, setActiveUserId]   = useState<string | null>(null);
  const [activeUser, setActiveUser]       = useState<{ full_name: string; phone: string } | null>(null);
  const [messages, setMessages]           = useState<Msg[]>([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [loadingList, setLoadingList]     = useState(true);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [pendingFile, setPendingFile]     = useState<Attachment | null>(null);
  const [uploading, setUploading]         = useState(false);
  const fileInputRef                       = useRef<HTMLInputElement>(null);

  const [showNewConv, setShowNewConv]     = useState(false);
  const [userQuery, setUserQuery]         = useState("");
  const [userResults, setUserResults]     = useState<SearchUser[]>([]);
  const [searching, setSearching]         = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/support/conversations", { credentials: "include" });
      const j = await r.json();
      if (j.ok) setConversations(j.conversations || []);
    } catch {}
    setLoadingList(false);
  }, []);

  useEffect(() => {
    const q = searchConv.trim().toLowerCase();
    if (!q) { setFiltered(conversations); return; }
    setFiltered(conversations.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    ));
  }, [searchConv, conversations]);

  const loadMessages = useCallback(async (uid: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/admin/support/messages?user_id=${uid}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) { setMessages(j.messages || []); setActiveUser(j.user); }
    } catch {}
    setLoadingMsgs(false);
  }, []);

  useEffect(() => { loadConversations(); const id = setInterval(loadConversations, 8000); return () => clearInterval(id); }, [loadConversations]);
  useEffect(() => { if (!activeUserId) return; loadMessages(activeUserId); const id = setInterval(() => loadMessages(activeUserId), 6000); return () => clearInterval(id); }, [activeUserId, loadMessages]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!activeUserId || (!input.trim() && !pendingFile) || sending) return;
    const text = input.trim();
    const att = pendingFile;
    setSending(true); setInput(""); setPendingFile(null);
    try {
      const r = await fetch("/api/admin/support/messages", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeUserId, content: text, attachment: att }),
      });
      const j = await r.json();
      if (j.ok && j.message) { setMessages(prev => [...prev, j.message]); loadConversations(); }
    } catch {}
    setSending(false);
  };

  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert("الحد الأقصى 10 ميجا"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/admin/support/upload", { method: "POST", credentials: "include", body: fd });
      const j = await r.json();
      if (j.ok && j.attachment) setPendingFile(j.attachment);
      else alert(j.error || "فشل الرفع");
    } catch { alert("فشل الرفع"); }
    setUploading(false);
  };

  const searchUsers = (q: string) => {
    setUserQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim() || q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/support/search-users?q=${encodeURIComponent(q)}`, { credentials: "include" });
        const j = await r.json();
        if (j.ok) setUserResults(j.users || []);
      } catch {}
      setSearching(false);
    }, 350);
  };

  const startConvWith = (u: SearchUser) => {
    setShowNewConv(false); setUserQuery(""); setUserResults([]);
    setActiveUserId(u.id);
    setActiveUser({ full_name: u.full_name, phone: u.phone });
    setMessages([]);
  };

  const fmtTime = (s: string) => new Date(s).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (s: string) => {
    const d = new Date(s), today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(s);
    return d.toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit" });
  };

  const totalUnread = conversations.reduce((n, c) => n + c.unread_count, 0);

  return (
    <Shell>
      <style jsx>{`
        .chat-shell {
          display: flex;
          height: calc(100dvh - 120px);
          min-height: 480px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .sidebar {
          width: 320px;
          flex-shrink: 0;
          border-inline-end: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }
        .conv-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        @media (max-width: 768px) {
          .chat-shell {
            height: calc(100dvh - 90px);
            border-radius: 12px;
          }
          .sidebar { width: 100%; }
          .chat-shell.has-active .sidebar { display: none; }
          .chat-shell:not(.has-active) .conv-pane { display: none; }
          .desktop-close { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-back { display: none !important; }
        }
      `}</style>

      <div className={`chat-shell ${activeUserId ? "has-active" : ""}`}>

        {/* ── Sidebar (conversation list) ── */}
        <div className="sidebar">
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={16} color="var(--text)" />
                <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>
                  المحادثات
                  {totalUnread > 0 && (
                    <span style={{ marginRight: 6, background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 7px" }}>
                      {totalUnread}
                    </span>
                  )}
                </span>
              </div>
              <button
                onClick={() => { setShowNewConv(v => !v); setUserQuery(""); setUserResults([]); }}
                title="محادثة جديدة"
                style={{
                  width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)",
                  background: showNewConv ? "var(--accent)" : "var(--bg2)",
                  color: showNewConv ? "var(--accent-fg)" : "var(--text2)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {showNewConv ? <X size={16} /> : <Plus size={16} />}
              </button>
            </div>

            {!showNewConv && (
              <div style={{ position: "relative" }}>
                <Search size={14} color="var(--text4)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={searchConv}
                  onChange={e => setSearchConv(e.target.value)}
                  placeholder="ابحث بالاسم أو الجوال…"
                  style={{
                    width: "100%", padding: "10px 32px 10px 10px",
                    background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
                    color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {showNewConv && (
              <div>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <Search size={14} color="var(--text4)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={userQuery}
                    onChange={e => searchUsers(e.target.value)}
                    placeholder="اسم أو جوال أو إيميل…"
                    autoFocus
                    style={{
                      width: "100%", padding: "10px 32px 10px 10px",
                      background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
                      color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {searching && <Loader2 size={13} color="var(--text4)" className="animate-spin" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />}
                </div>
                {userResults.length > 0 && (
                  <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => startConvWith(u)}
                        style={{
                          width: "100%", padding: "11px 12px", background: "transparent",
                          border: "none", borderBottom: "1px solid var(--border)",
                          textAlign: "right", cursor: "pointer",
                          display: "flex", flexDirection: "column", gap: 3,
                        }}
                      >
                        <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 700 }}>{u.full_name}</span>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {u.phone && <span style={{ color: "var(--text3)", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}><Phone size={10} />{u.phone}</span>}
                          {u.email && <span style={{ color: "var(--text3)", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }} dir="ltr"><Mail size={10} />{u.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {userQuery.length >= 2 && !searching && userResults.length === 0 && (
                  <p style={{ color: "var(--text4)", fontSize: 12, textAlign: "center", margin: "8px 0 0" }}>لا نتائج</p>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {loadingList ? (
              <div style={{ padding: 30, textAlign: "center" }}>
                <Loader2 size={20} color="var(--text4)" className="animate-spin" style={{ display: "inline-block" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text4)", fontSize: 13 }}>
                {searchConv ? "لا نتائج" : "لا توجد محادثات"}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => { setActiveUserId(c.user_id); setShowNewConv(false); }}
                  style={{
                    width: "100%", padding: "14px 14px",
                    background: activeUserId === c.user_id ? "var(--bg2)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                    borderInlineStart: activeUserId === c.user_id ? "3px solid var(--accent)" : "3px solid transparent",
                    textAlign: "right", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 5,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.full_name}
                    </span>
                    <span style={{ color: "var(--text4)", fontSize: 11, flexShrink: 0 }}>{fmtDate(c.last_at)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--text3)", fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.phone && <span style={{ color: "var(--text4)", marginLeft: 4 }}>{c.phone} · </span>}
                      {c.last_sender === "admin" && <span style={{ color: "var(--text2)", fontWeight: 600 }}>أنت: </span>}
                      {c.last_message}
                    </span>
                    {c.unread_count > 0 && (
                      <span style={{ background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 7px", minWidth: 20, textAlign: "center", flexShrink: 0 }}>
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Conversation pane ── */}
        <div className="conv-pane">
          {!activeUserId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text4)" }}>
              <MessageCircle size={40} color="var(--border2)" strokeWidth={1} />
              <p style={{ margin: 0, fontSize: 14 }}>اختر محادثة أو ابدأ محادثة جديدة</p>
              <button
                onClick={() => setShowNewConv(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 10, border: "1px solid var(--border)",
                  background: "var(--bg2)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                <Plus size={14} /> محادثة جديدة
              </button>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <button
                  className="mobile-back"
                  onClick={() => { setActiveUserId(null); setMessages([]); setActiveUser(null); }}
                  title="رجوع"
                  style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", cursor: "pointer", flexShrink: 0 }}
                >
                  <ArrowRight size={18} />
                </button>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--bg2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text)", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {(activeUser?.full_name || "?")[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "var(--text)", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeUser?.full_name || "..."}</p>
                  <p style={{ margin: 0, color: "var(--text4)", fontSize: 12 }} dir="ltr">{activeUser?.phone || ""}</p>
                </div>
                <button
                  className="desktop-close"
                  onClick={() => { setActiveUserId(null); setMessages([]); setActiveUser(null); }}
                  style={{ background: "transparent", border: "none", color: "var(--text4)", cursor: "pointer", padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10, background: "var(--bg2)" }}>
                {loadingMsgs && messages.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={20} color="var(--text4)" className="animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, flexDirection: "column", gap: 8, color: "var(--text4)" }}>
                    <User size={28} strokeWidth={1} />
                    <p style={{ margin: 0, fontSize: 13 }}>لا رسائل بعد — ابدأ المحادثة</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isImg = !!m.attachment_type && m.attachment_type.startsWith("image/");
                    const isAdmin = m.sender === "admin";
                    return (
                    <div key={m.id} style={{ alignSelf: isAdmin ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                      <div style={{
                        background: isAdmin ? "var(--accent)" : "var(--bg)",
                        border: `1px solid ${isAdmin ? "var(--accent)" : "var(--border)"}`,
                        color: isAdmin ? "var(--accent-fg)" : "var(--text)",
                        padding: m.attachment_url && isImg ? 6 : "10px 14px",
                        borderRadius: 14,
                        fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        display: "flex", flexDirection: "column", gap: 8,
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}>
                        {m.attachment_url && isImg && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a href={m.attachment_url} target="_blank" rel="noreferrer">
                            <img src={m.attachment_url} alt={m.attachment_name || ""}
                              style={{ width: "100%", maxWidth: 260, borderRadius: 10, display: "block" }} />
                          </a>
                        )}
                        {m.attachment_url && !isImg && (
                          <a href={m.attachment_url} target="_blank" rel="noreferrer"
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                              borderRadius: 10,
                              background: isAdmin ? "rgba(255,255,255,0.15)" : "var(--bg2)",
                              color: "inherit",
                              border: `1px solid ${isAdmin ? "rgba(255,255,255,0.25)" : "var(--border)"}`,
                              textDecoration: "none", fontSize: 13, fontWeight: 600,
                            }}>
                            <FileText size={16} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                              {m.attachment_name || "ملف"}
                            </span>
                          </a>
                        )}
                        {m.meta && (
                          <div style={{
                            borderRadius: 10, padding: "10px 12px",
                            background: isAdmin ? "rgba(255,255,255,0.15)" : "var(--bg2)",
                            color: "inherit",
                            border: `1px solid ${isAdmin ? "rgba(255,255,255,0.25)" : "var(--border)"}`,
                          }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.75, marginBottom: 6 }}>{m.meta.title || "تفاصيل"}</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {(m.meta.fields || []).map((f, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                                  <span style={{ opacity: 0.7 }}>{f.label}</span>
                                  <span style={{ fontWeight: 600, textAlign: "left" }}>{f.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {m.content && <span style={{ paddingInline: m.attachment_url && isImg ? 8 : 0, paddingBottom: m.attachment_url && isImg ? 4 : 0 }}>{m.content}</span>}
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--text4)", marginTop: 4, textAlign: isAdmin ? "left" : "right", paddingInline: 4 }}>
                        {fmtTime(m.created_at)}
                        {isAdmin && m.read_at && <span style={{ color: "var(--text2)", marginRight: 4 }}> ✓ قُرئت</span>}
                      </div>
                    </div>
                  );})
                )}
              </div>

              {/* Pending file preview */}
              {pendingFile && (
                <div style={{
                  padding: "10px 14px", borderTop: "1px solid var(--border)",
                  background: "var(--bg)", display: "flex", gap: 10, alignItems: "center", flexShrink: 0,
                }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                    {pendingFile.type?.startsWith("image/")
                      ? <ImageIcon size={16} color="var(--text)" />
                      : <FileText size={16} color="var(--text)" />}
                    <span style={{ color: "var(--text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pendingFile.name}
                    </span>
                    <span style={{ color: "var(--text4)", fontSize: 11, flexShrink: 0 }}>{fmtSize(pendingFile.size)}</span>
                  </div>
                  <button onClick={() => setPendingFile(null)}
                    style={{ background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", padding: 4, display: "flex" }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Composer */}
              <div style={{
                padding: "10px 12px",
                paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                borderTop: "1px solid var(--border)",
                background: "var(--bg)",
                display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0,
              }}>
                <input ref={fileInputRef} type="file" hidden
                  accept="image/*,application/pdf,.doc,.docx,.txt"
                  onChange={onFileChange} />
                <button onClick={onPickFile} disabled={uploading} title="إرفاق ملف"
                  style={{
                    width: 44, height: 44, flexShrink: 0,
                    background: "var(--bg2)", border: "1px solid var(--border)",
                    borderRadius: 12, color: "var(--text)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.5 : 1,
                  }}>
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                </button>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="اكتب ردك…"
                  rows={1}
                  style={{
                    flex: 1, background: "var(--bg2)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "11px 14px", color: "var(--text)",
                    fontSize: 15, fontFamily: "inherit", resize: "none",
                    outline: "none", maxHeight: 120, minHeight: 44,
                  }}
                />
                <button
                  onClick={send}
                  disabled={sending || (!input.trim() && !pendingFile)}
                  title="إرسال"
                  style={{
                    background: "var(--accent)", color: "var(--accent-fg)", border: "none",
                    borderRadius: 12, width: 44, height: 44, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: sending || (!input.trim() && !pendingFile) ? "not-allowed" : "pointer",
                    opacity: sending || (!input.trim() && !pendingFile) ? 0.4 : 1,
                  }}
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
