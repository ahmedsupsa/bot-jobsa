"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Shell from "@/components/shell";
import {
  Send, Paperclip, X, FileText, Download,
  MessageCircle, ImageIcon, FileArchive, File,
  Loader2, ArrowRight, Search,
} from "lucide-react";

interface Contact {
  username: string;
  isSuper: boolean;
  lastMessage: { body: string | null; fileName: string | null; createdAt: string; isMine: boolean } | null;
  unread: number;
}

interface Message {
  id: number;
  sender: string;
  receiver: string;
  body: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  file_url: string | null;
  created_at: string;
  read_at: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: "var(--accent)", color: "var(--accent-fg, #fff)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, userSelect: "none",
      border: "1px solid var(--border)",
    }}>
      {name[0]?.toUpperCase() ?? "؟"}
    </div>
  );
}

function FileIconComp({ type }: { type: string | null }) {
  if (!type) return <File size={18} />;
  if (type.startsWith("image/")) return <ImageIcon size={18} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return <FileArchive size={18} />;
  return <FileText size={18} />;
}

function groupMessagesByDate(msgs: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of msgs) {
    const d = formatDate(msg.created_at);
    if (d !== currentDate) { groups.push({ date: d, messages: [] }); currentDate = d; }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

export default function ChatPage() {
  const [me, setMe] = useState<{ username: string; isSuper: boolean } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filtered, setFiltered] = useState<Contact[]>([]);
  const [searchConv, setSearchConv] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    path: string; name: string; size: number; type: string; previewUrl?: string;
  } | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [authed, setAuthed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMsgCountRef = useRef(0);
  const lastMsgIdRef = useRef<number | null>(null);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const scrollToBottom = (force = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (force || isNearBottom()) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  };

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.ok) { window.location.href = "/login"; return; }
        setMe({ username: d.username, isSuper: d.isSuper });
        setAuthed(true);
      });
  }, []);

  const loadContacts = useCallback(async () => {
    const r = await fetch("/api/admin/chat/contacts", { credentials: "include" });
    const d = await r.json();
    if (d.ok) setContacts(d.contacts || []);
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadContacts();
  }, [authed, loadContacts]);

  useEffect(() => {
    const q = searchConv.trim().toLowerCase();
    if (!q) { setFiltered(contacts); return; }
    setFiltered(contacts.filter(c => c.username.toLowerCase().includes(q)));
  }, [searchConv, contacts]);

  const loadMessages = useCallback(async (withUser: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    const r = await fetch(`/api/admin/chat/messages?with=${encodeURIComponent(withUser)}`, { credentials: "include" });
    const d = await r.json();
    if (d.ok) {
      const msgs: Message[] = d.messages || [];
      const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
      const isNew = lastId !== lastMsgIdRef.current;

      setMessages(msgs);

      if (isNew) {
        lastMsgIdRef.current = lastId;
        setTimeout(() => scrollToBottom(true), 80);
      }

      fetch("/api/admin/chat/messages", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: withUser }),
      });
      setContacts((prev) =>
        prev.map((c) => (c.username === withUser ? { ...c, unread: 0 } : c))
      );
    }
    if (!silent) setLoadingMsgs(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => {
      loadMessages(selected, true);
      loadContacts();
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, loadMessages, loadContacts]);

  useEffect(() => {
    if (!selected) return;
    lastMsgIdRef.current = null;
    lastMsgCountRef.current = 0;
    loadMessages(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (authed && contacts.length > 0 && !selected) {
      setSelected(contacts[0].username);
    }
  }, [authed, contacts, selected]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("الحد الأقصى 10 ميجا"); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/chat/upload", { method: "POST", credentials: "include", body: fd });
    const d = await r.json();
    setUploading(false);
    if (d.ok) {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setPendingFile({ path: d.file_path, name: d.file_name, size: d.file_size, type: d.file_type, previewUrl: preview });
    } else {
      alert(d.error || "فشل رفع الملف");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSend() {
    if (!selected || (!input.trim() && !pendingFile) || sending) return;
    setSending(true);
    const payload: Record<string, unknown> = { receiver: selected };
    if (input.trim()) payload.body = input.trim();
    if (pendingFile) {
      payload.file_path = pendingFile.path;
      payload.file_name = pendingFile.name;
      payload.file_size = pendingFile.size;
      payload.file_type = pendingFile.type;
    }
    const r = await fetch("/api/admin/chat/messages", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.ok) {
      setInput(""); setPendingFile(null);
      await loadMessages(selected, true);
      await loadContacts();
      setTimeout(() => scrollToBottom(true), 80);
    }
    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text4)" }} />
      </div>
    );
  }

  const selectedContact = contacts.find((c) => c.username === selected);
  const totalUnread = contacts.reduce((s, c) => s + c.unread, 0);

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
          width: 300px;
          flex-shrink: 0;
          border-inline-end: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }
        .conv-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .chat-shell {
            height: calc(100dvh - 90px);
            border-radius: 12px;
          }
          .sidebar { width: 100%; }
          .chat-shell.has-active .sidebar { display: none; }
          .chat-shell:not(.has-active) .conv-pane { display: none; }
          .mobile-back { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-back { display: none !important; }
        }
      `}</style>

      <div className={`chat-shell ${selected ? "has-active" : ""}`}>

        {/* ── Sidebar ── */}
        <div className="sidebar">
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MessageCircle size={16} color="var(--text)" />
              <span style={{ color: "var(--text)", fontSize: 14, fontWeight: 700 }}>
                الدردشة الداخلية
              </span>
              {totalUnread > 0 && (
                <span style={{ marginRight: "auto", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 7px" }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <Search size={14} color="var(--text4)" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={searchConv}
                onChange={e => setSearchConv(e.target.value)}
                placeholder="ابحث بالاسم…"
                style={{
                  width: "100%", padding: "9px 32px 9px 10px",
                  background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10,
                  color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
            {contacts.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text4)", fontSize: 13 }}>
                لا يوجد محادثات حتى الآن
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "var(--text4)", fontSize: 13 }}>لا نتائج</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.username}
                  onClick={() => setSelected(c.username)}
                  style={{
                    width: "100%", padding: "14px",
                    background: selected === c.username ? "var(--bg2)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                    borderInlineStart: selected === c.username ? "3px solid var(--accent)" : "3px solid transparent",
                    textAlign: "right", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 4,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--text)", fontSize: 13.5, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.username}
                      {c.isSuper && <span style={{ fontSize: 10, marginRight: 5, color: "var(--text4)", fontWeight: 400 }}>مدير</span>}
                    </span>
                    {c.lastMessage && (
                      <span style={{ color: "var(--text4)", fontSize: 11, flexShrink: 0 }}>
                        {formatTime(c.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.lastMessage
                        ? (c.lastMessage.isMine ? <span style={{ color: "var(--text2)", fontWeight: 600 }}>أنت: </span> : null)
                        : null}
                      {c.lastMessage
                        ? (c.lastMessage.body || (c.lastMessage.fileName ? `📎 ${c.lastMessage.fileName}` : ""))
                        : "ابدأ محادثة"}
                    </span>
                    {c.unread > 0 && (
                      <span style={{ background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "2px 6px", flexShrink: 0 }}>
                        {c.unread}
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
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--text4)" }}>
              <MessageCircle size={40} strokeWidth={1} />
              <p style={{ margin: 0, fontSize: 14 }}>اختر محادثة للبدء</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <button
                  className="mobile-back"
                  onClick={() => setSelected(null)}
                  style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "none", alignItems: "center", justifyContent: "center", color: "var(--text)", cursor: "pointer", flexShrink: 0 }}
                >
                  <ArrowRight size={18} />
                </button>
                <Avatar name={selected} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "var(--text)", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selected}
                    {selectedContact?.isSuper && <span style={{ fontSize: 11, marginRight: 6, color: "var(--text4)", fontWeight: 400 }}>مدير</span>}
                  </p>
                  <p style={{ margin: 0, color: "var(--text4)", fontSize: 12 }}>مدير داخلي</p>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as const,
                  padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10,
                  background: "var(--bg2)",
                }}
              >
                {loadingMsgs && messages.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
                    <Loader2 size={20} color="var(--text4)" className="animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, flexDirection: "column", gap: 8, color: "var(--text4)" }}>
                    <MessageCircle size={28} strokeWidth={1} />
                    <p style={{ margin: 0, fontSize: 13 }}>لا رسائل بعد — ابدأ المحادثة</p>
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((group) => (
                    <div key={group.date}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 8px" }}>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        <span style={{ fontSize: 11, color: "var(--text4)", background: "var(--bg)", padding: "2px 10px", borderRadius: 999, border: "1px solid var(--border)" }}>
                          {group.date}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                      </div>
                      {group.messages.map((msg) => {
                        const isMine = msg.sender === me?.username;
                        const isImage = msg.file_type?.startsWith("image/");
                        return (
                          <div key={msg.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "85%", display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start", marginBottom: 4 }}>
                            <div style={{
                              background: isMine ? "var(--accent)" : "var(--bg)",
                              border: `1px solid ${isMine ? "var(--accent)" : "var(--border)"}`,
                              color: isMine ? "var(--accent-fg, #fff)" : "var(--text)",
                              padding: msg.file_url && isImage ? 6 : "10px 14px",
                              borderRadius: 14,
                              fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                              display: "flex", flexDirection: "column", gap: 8,
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                            }}>
                              {msg.file_url && isImage && (
                                <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                  <img src={msg.file_url} alt={msg.file_name || "صورة"}
                                    style={{ maxWidth: 260, borderRadius: 10, display: "block" }} />
                                </a>
                              )}
                              {msg.file_url && !isImage && (
                                <a
                                  href={msg.file_url} target="_blank" rel="noopener noreferrer"
                                  download={msg.file_name || true}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                                    borderRadius: 10,
                                    background: isMine ? "rgba(255,255,255,0.15)" : "var(--bg2)",
                                    color: "inherit",
                                    border: `1px solid ${isMine ? "rgba(255,255,255,0.25)" : "var(--border)"}`,
                                    textDecoration: "none", fontSize: 13, fontWeight: 600,
                                  }}
                                >
                                  <FileIconComp type={msg.file_type} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                                    {msg.file_name || "ملف"}
                                  </span>
                                  <span style={{ marginRight: "auto", fontSize: 11, opacity: 0.65 }}>{formatSize(msg.file_size)}</span>
                                  <Download size={14} style={{ flexShrink: 0, opacity: 0.65 }} />
                                </a>
                              )}
                              {msg.body && (
                                <span style={{ paddingInline: msg.file_url && isImage ? 8 : 0, paddingBottom: msg.file_url && isImage ? 4 : 0 }}>
                                  {msg.body}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--text4)", marginTop: 3, paddingInline: 4 }}>
                              {formatTime(msg.created_at)}
                              {isMine && (
                                <span style={{ marginRight: 4, color: msg.read_at ? "var(--accent)" : "var(--text4)" }}>
                                  {msg.read_at ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Pending file preview */}
              {pendingFile && (
                <div style={{
                  margin: "0 14px 8px",
                  padding: "10px 14px",
                  background: "var(--bg)",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  {pendingFile.previewUrl ? (
                    <img src={pendingFile.previewUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
                      <FileIconComp type={pendingFile.type} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pendingFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text4)" }}>{formatSize(pendingFile.size)}</div>
                  </div>
                  <button onClick={() => setPendingFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text4)", padding: 4 }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    title="إرفاق ملف"
                    style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: 10,
                      border: "1px solid var(--border)", background: "var(--bg2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: uploading ? "wait" : "pointer", color: "var(--text2)",
                    }}
                  >
                    {uploading
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Paperclip size={18} />
                    }
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالة… (Enter للإرسال، Shift+Enter لسطر جديد)"
                    rows={1}
                    style={{
                      flex: 1, resize: "none", overflowY: "auto", maxHeight: 120,
                      borderRadius: 10, border: "1px solid var(--border)",
                      background: "var(--bg2)", color: "var(--text)",
                      padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
                      outline: "none", fontFamily: "inherit", direction: "rtl",
                      boxSizing: "border-box",
                    }}
                    onInput={(e) => {
                      const t = e.currentTarget;
                      t.style.height = "auto";
                      t.style.height = Math.min(t.scrollHeight, 120) + "px";
                    }}
                  />

                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && !pendingFile) || sending || uploading}
                    style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: 10,
                      border: "none", background: "var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                      opacity: (!input.trim() && !pendingFile) || sending ? 0.45 : 1,
                      color: "var(--accent-fg, #fff)",
                      transition: "opacity 0.15s",
                    }}
                  >
                    {sending
                      ? <Loader2 size={16} className="animate-spin" />
                      : <Send size={17} />
                    }
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
