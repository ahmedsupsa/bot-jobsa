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

  /* بحث مستخدم جديد */
  const [showNewConv, setShowNewConv]     = useState(false);
  const [userQuery, setUserQuery]         = useState("");
  const [userResults, setUserResults]     = useState<SearchUser[]>([]);
  const [searching, setSearching]         = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── تحميل المحادثات ── */
  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/support/conversations", { credentials: "include" });
      const j = await r.json();
      if (j.ok) setConversations(j.conversations || []);
    } catch {}
    setLoadingList(false);
  }, []);

  /* ── فلترة المحادثات بالبحث ── */
  useEffect(() => {
    const q = searchConv.trim().toLowerCase();
    if (!q) { setFiltered(conversations); return; }
    setFiltered(conversations.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    ));
  }, [searchConv, conversations]);

  /* ── تحميل رسائل محادثة ── */
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

  /* ── إرسال رسالة ── */
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

  /* ── رفع ملف من المسؤول ── */
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

  /* ── البحث عن مستخدم جديد ── */
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

  /* ── تنسيق الوقت ── */
  const fmtTime = (s: string) => new Date(s).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (s: string) => {
    const d = new Date(s), today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(s);
    return d.toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit" });
  };

  const totalUnread = conversations.reduce((n, c) => n + c.unread_count, 0);

  return (
    <Shell>
      <div style={{
        display: "flex", height: "calc(100vh - 100px)",
        background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 16,
        overflow: "hidden",
      }}>

        {/* ── القائمة الجانبية ── */}
        <div style={{ width: 320, borderInlineEnd: "1px solid #1f1f1f", display: "flex", flexDirection: "column", background: "#0d0d0d" }}>

          {/* Header */}
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #1f1f1f" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={16} color="#fff" />
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                  المحادثات
                  {totalUnread > 0 && (
                    <span style={{ marginRight: 6, background: "#fff", color: "#000", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 7px" }}>
                      {totalUnread}
                    </span>
                  )}
                </span>
              </div>
              <button
                onClick={() => { setShowNewConv(v => !v); setUserQuery(""); setUserResults([]); }}
                title="محادثة جديدة"
                style={{
                  width: 32, height: 32, borderRadius: 9, border: "1px solid #2a2a2a",
                  background: showNewConv ? "#fff" : "#1a1a1a",
                  color: showNewConv ? "#000" : "#aaa",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {showNewConv ? <X size={14} /> : <Plus size={14} />}
              </button>
            </div>

            {/* بحث في المحادثات الحالية */}
            {!showNewConv && (
              <div style={{ position: "relative" }}>
                <Search size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  value={searchConv}
                  onChange={e => setSearchConv(e.target.value)}
                  placeholder="ابحث بالاسم أو الجوال…"
                  style={{
                    width: "100%", padding: "8px 32px 8px 10px",
                    background: "#111", border: "1px solid #222", borderRadius: 9,
                    color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {/* بحث مستخدم جديد */}
            {showNewConv && (
              <div>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <Search size={13} color="#555" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={userQuery}
                    onChange={e => searchUsers(e.target.value)}
                    placeholder="اسم أو جوال أو إيميل…"
                    autoFocus
                    style={{
                      width: "100%", padding: "8px 32px 8px 10px",
                      background: "#111", border: "1px solid #ffffff20", borderRadius: 9,
                      color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {searching && <Loader2 size={13} color="#555" className="animate-spin" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />}
                </div>
                {/* نتائج البحث */}
                {userResults.length > 0 && (
                  <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 10, overflow: "hidden" }}>
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => startConvWith(u)}
                        style={{
                          width: "100%", padding: "10px 12px", background: "transparent",
                          border: "none", borderBottom: "1px solid #181818",
                          textAlign: "right", cursor: "pointer",
                          display: "flex", flexDirection: "column", gap: 3,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{u.full_name}</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          {u.phone && <span style={{ color: "#555", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}><Phone size={10} />{u.phone}</span>}
                          {u.email && <span style={{ color: "#555", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }} dir="ltr"><Mail size={10} />{u.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {userQuery.length >= 2 && !searching && userResults.length === 0 && (
                  <p style={{ color: "#555", fontSize: 12, textAlign: "center", margin: "8px 0 0" }}>لا نتائج</p>
                )}
              </div>
            )}
          </div>

          {/* قائمة المحادثات */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingList ? (
              <div style={{ padding: 30, textAlign: "center" }}>
                <Loader2 size={20} color="#666" className="animate-spin" style={{ display: "inline-block" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#555", fontSize: 13 }}>
                {searchConv ? "لا نتائج" : "لا توجد محادثات"}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => { setActiveUserId(c.user_id); setShowNewConv(false); }}
                  style={{
                    width: "100%", padding: "13px 14px",
                    background: activeUserId === c.user_id ? "#1a1a1a" : "transparent",
                    borderBottom: "1px solid #181818",
                    borderInlineStart: activeUserId === c.user_id ? "3px solid #fff" : "3px solid transparent",
                    border: "none", textAlign: "right", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.full_name}
                    </span>
                    <span style={{ color: "#555", fontSize: 11, flexShrink: 0 }}>{fmtDate(c.last_at)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#666", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.phone && <span style={{ color: "#444", marginLeft: 4 }}>{c.phone} · </span>}
                      {c.last_sender === "admin" && <span style={{ color: "#fff" }}>أنت: </span>}
                      {c.last_message}
                    </span>
                    {c.unread_count > 0 && (
                      <span style={{ background: "#fff", color: "#000", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 7px", minWidth: 20, textAlign: "center", flexShrink: 0 }}>
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── نافذة المحادثة ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!activeUserId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#555" }}>
              <MessageCircle size={40} color="#222" strokeWidth={1} />
              <p style={{ margin: 0, fontSize: 14 }}>اختر محادثة أو ابدأ محادثة جديدة</p>
              <button
                onClick={() => setShowNewConv(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 18px", borderRadius: 10, border: "1px solid #2a2a2a",
                  background: "#1a1a1a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                <Plus size={14} color="#fff" /> محادثة جديدة
              </button>
            </div>
          ) : (
            <>
              {/* Header المحادثة */}
              <div style={{ padding: "13px 20px", borderBottom: "1px solid #1f1f1f", background: "#0d0d0d", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {(activeUser?.full_name || "?")[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>{activeUser?.full_name || "..."}</p>
                  <p style={{ margin: 0, color: "#555", fontSize: 12 }}>{activeUser?.phone || ""}</p>
                </div>
                <button
                  onClick={() => { setActiveUserId(null); setMessages([]); setActiveUser(null); }}
                  style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* الرسائل */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10, background: "#070707" }}>
                {loadingMsgs && messages.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={20} color="#666" className="animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, flexDirection: "column", gap: 8, color: "#444" }}>
                    <User size={28} strokeWidth={1} />
                    <p style={{ margin: 0, fontSize: 13 }}>لا رسائل بعد — ابدأ المحادثة</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isImg = !!m.attachment_type && m.attachment_type.startsWith("image/");
                    return (
                    <div key={m.id} style={{ alignSelf: m.sender === "admin" ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                      <div style={{
                        background: m.sender === "admin" ? "#fff" : "#1a1a1a",
                        border: `1px solid ${m.sender === "admin" ? "#fff" : "#2a2a2a"}`,
                        color: m.sender === "admin" ? "#000" : "#fff",
                        padding: m.attachment_url && isImg ? 6 : "10px 14px",
                        borderRadius: 14,
                        fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        display: "flex", flexDirection: "column", gap: 8,
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
                              borderRadius: 10, background: m.sender === "admin" ? "#f4f4f5" : "#0a0a0a",
                              color: m.sender === "admin" ? "#000" : "#fff",
                              border: `1px solid ${m.sender === "admin" ? "#e4e4e7" : "#2a2a2a"}`,
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
                            background: m.sender === "admin" ? "#f4f4f5" : "#0a0a0a",
                            color: m.sender === "admin" ? "#000" : "#fff",
                            border: `1px solid ${m.sender === "admin" ? "#e4e4e7" : "#2a2a2a"}`,
                          }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: m.sender === "admin" ? "#444" : "#888", marginBottom: 6 }}>{m.meta.title || "تفاصيل"}</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {(m.meta.fields || []).map((f, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                                  <span style={{ color: m.sender === "admin" ? "#444" : "#888" }}>{f.label}</span>
                                  <span style={{ fontWeight: 600, textAlign: "left" }}>{f.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {m.content && <span style={{ paddingInline: m.attachment_url && isImg ? 8 : 0, paddingBottom: m.attachment_url && isImg ? 4 : 0 }}>{m.content}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#444", marginTop: 3, textAlign: m.sender === "admin" ? "left" : "right", paddingInline: 4 }}>
                        {fmtTime(m.created_at)}
                        {m.sender === "admin" && m.read_at && <span style={{ color: "#fff", marginRight: 4 }}> ✓ قُرئت</span>}
                      </div>
                    </div>
                  );})
                )}
              </div>

              {/* معاينة الملف المُرفق قبل الإرسال */}
              {pendingFile && (
                <div style={{
                  padding: "10px 14px", borderTop: "1px solid #1f1f1f",
                  background: "#0d0d0d", display: "flex", gap: 10, alignItems: "center",
                }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                    {pendingFile.type?.startsWith("image/")
                      ? <ImageIcon size={16} color="#fff" />
                      : <FileText size={16} color="#fff" />}
                    <span style={{ color: "#fff", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pendingFile.name}
                    </span>
                    <span style={{ color: "#666", fontSize: 11, flexShrink: 0 }}>{fmtSize(pendingFile.size)}</span>
                  </div>
                  <button onClick={() => setPendingFile(null)}
                    style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", padding: 4, display: "flex" }}>
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* كتابة الرد */}
              <div style={{ padding: 14, borderTop: "1px solid #1f1f1f", background: "#0d0d0d", display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input ref={fileInputRef} type="file" hidden
                  accept="image/*,application/pdf,.doc,.docx,.txt"
                  onChange={onFileChange} />
                <button onClick={onPickFile} disabled={uploading} title="إرفاق ملف"
                  style={{
                    width: 42, height: 42, flexShrink: 0,
                    background: "#0a0a0a", border: "1px solid #2a2a2a",
                    borderRadius: 12, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.5 : 1,
                  }}>
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                </button>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="اكتب ردك… (Enter للإرسال)"
                  rows={1}
                  style={{
                    flex: 1, background: "#0a0a0a", border: "1px solid #2a2a2a",
                    borderRadius: 12, padding: "10px 14px", color: "#fff",
                    fontSize: 14, fontFamily: "inherit", resize: "none",
                    outline: "none", maxHeight: 120, minHeight: 42,
                  }}
                />
                <button
                  onClick={send}
                  disabled={sending || (!input.trim() && !pendingFile)}
                  title="إرسال + إشعار جوال"
                  style={{
                    background: "#fff", color: "#000", border: "none",
                    borderRadius: 12, width: 42, height: 42,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: sending || (!input.trim() && !pendingFile) ? "not-allowed" : "pointer",
                    opacity: sending || (!input.trim() && !pendingFile) ? 0.4 : 1,
                  }}
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
