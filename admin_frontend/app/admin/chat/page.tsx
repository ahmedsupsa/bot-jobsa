"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Shell from "@/components/shell";
import {
  Send, Paperclip, X, FileText, Download, ChevronRight,
  MessageCircle, ImageIcon, FileArchive, File,
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
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
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
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "var(--accent)", color: "var(--accent-fg, #fff)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, userSelect: "none",
      }}
    >
      {name[0]?.toUpperCase() ?? "؟"}
    </div>
  );
}

function FileIcon({ type }: { type: string | null }) {
  if (!type) return <File size={20} />;
  if (type.startsWith("image/")) return <ImageIcon size={20} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z")) return <FileArchive size={20} />;
  return <FileText size={20} />;
}

function MessageBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const isImage = msg.file_type?.startsWith("image/");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 6,
      }}
    >
      <div
        style={{
          maxWidth: "72%",
          borderRadius: isMine ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
          padding: msg.file_url && isImage ? 4 : "10px 14px",
          background: isMine ? "var(--accent)" : "var(--panel2)",
          color: isMine ? "var(--accent-fg, #fff)" : "var(--ink)",
          border: isMine ? "none" : "1px solid var(--line)",
          wordBreak: "break-word",
          fontSize: 14,
          lineHeight: 1.55,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        {msg.file_url && isImage && (
          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
            <img
              src={msg.file_url}
              alt={msg.file_name || "صورة"}
              style={{ maxWidth: 280, maxHeight: 220, borderRadius: 12, display: "block" }}
            />
          </a>
        )}
        {msg.file_url && !isImage && (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noopener noreferrer"
            download={msg.file_name || true}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              textDecoration: "none",
              color: isMine ? "var(--accent-fg, #fff)" : "var(--ink)",
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: isMine ? "rgba(255,255,255,0.18)" : "var(--bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: isMine ? "none" : "1px solid var(--line)",
            }}>
              <FileIcon type={msg.file_type} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                {msg.file_name || "ملف"}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{formatSize(msg.file_size)}</div>
            </div>
            <Download size={16} style={{ flexShrink: 0, opacity: 0.7 }} />
          </a>
        )}
        {msg.body && (
          <div style={{ marginTop: msg.file_url ? 6 : 0, padding: msg.file_url && isImage ? "0 6px 4px" : 0 }}>
            {msg.body}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, paddingInline: 4 }}>
        {formatTime(msg.created_at)}
        {isMine && (
          <span style={{ marginRight: 4, color: msg.read_at ? "#3b82f6" : "var(--muted)" }}>
            {msg.read_at ? "✓✓" : "✓"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [me, setMe] = useState<{ username: string; isSuper: boolean } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    path: string; name: string; size: number; type: string; previewUrl?: string;
  } | null>(null);
  const [showContacts, setShowContacts] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [authed, setAuthed] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const loadMessages = useCallback(async (withUser: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    const r = await fetch(`/api/admin/chat/messages?with=${encodeURIComponent(withUser)}`, { credentials: "include" });
    const d = await r.json();
    if (d.ok) {
      setMessages(d.messages || []);
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
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => {
      loadMessages(selected, true);
      loadContacts();
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, loadMessages, loadContacts]);

  useEffect(() => {
    if (selected) loadMessages(selected);
  }, [selected, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (authed && contacts.length > 0 && !selected) {
      const first = contacts[0];
      setSelected(first.username);
      setShowContacts(false);
    }
  }, [authed, contacts, selected]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      setInput("");
      setPendingFile(null);
      await loadMessages(selected, true);
      await loadContacts();
    }
    setSending(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      </div>
    );
  }

  const selectedContact = contacts.find((c) => c.username === selected);

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

  const totalUnread = contacts.reduce((s, c) => s + c.unread, 0);

  return (
    <Shell>
      <div style={{ display: "flex", height: "calc(100vh - 120px)", minHeight: 500, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg)" }}>

        {/* Contacts Panel */}
        <div style={{
          width: showContacts || !selected ? 280 : 0,
          minWidth: showContacts || !selected ? 280 : 0,
          borderLeft: "1px solid var(--line)",
          background: "var(--sidebar)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.2s, min-width 0.2s",
          flexShrink: 0,
        }}>
          <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} style={{ color: "var(--muted)" }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>الدردشة الداخلية</span>
            {totalUnread > 0 && (
              <span style={{ marginRight: "auto", background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "1px 7px" }}>
                {totalUnread}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {contacts.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                لا يوجد محادثات حتى الآن
              </div>
            ) : (
              contacts.map((c) => (
                <button
                  key={c.username}
                  onClick={() => { setSelected(c.username); setShowContacts(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", border: "none", cursor: "pointer",
                    background: selected === c.username ? "var(--panel2)" : "transparent",
                    borderBottom: "1px solid var(--line2)",
                    textAlign: "right",
                    borderRight: selected === c.username ? "3px solid var(--accent)" : "3px solid transparent",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar name={c.username} size={40} />
                    {c.isSuper && (
                      <span style={{
                        position: "absolute", bottom: -1, right: -1,
                        width: 12, height: 12, borderRadius: "50%",
                        background: "#22c55e", border: "2px solid var(--sidebar)",
                      }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.username}
                        {c.isSuper && <span style={{ fontSize: 10, marginRight: 4, color: "var(--muted)", fontWeight: 400 }}>مدير</span>}
                      </span>
                      {c.lastMessage && (
                        <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>
                          {formatTime(c.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {c.lastMessage
                          ? (c.lastMessage.isMine ? "أنت: " : "") + (c.lastMessage.body || (c.lastMessage.fileName ? `📎 ${c.lastMessage.fileName}` : ""))
                          : "ابدأ محادثة"}
                      </span>
                      {c.unread > 0 && (
                        <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, padding: "1px 6px", flexShrink: 0 }}>
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", gap: 12 }}>
              <MessageCircle size={48} strokeWidth={1.2} />
              <div style={{ fontSize: 15, fontWeight: 500 }}>اختر محادثة للبدء</div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px 16px", borderBottom: "1px solid var(--line)",
                background: "var(--sidebar)", flexShrink: 0,
              }}>
                <button
                  onClick={() => setShowContacts(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex", alignItems: "center" }}
                >
                  <ChevronRight size={20} />
                </button>
                <Avatar name={selected} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                    {selected}
                    {selectedContact?.isSuper && (
                      <span style={{ fontSize: 11, marginRight: 6, color: "var(--muted)", fontWeight: 400 }}>مدير</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#22c55e" }}>متاح</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column" }}>
                {loadingMsgs ? (
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
                    <div className="h-5 w-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 40 }}>
                    لا توجد رسائل — ابدأ المحادثة
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((group) => (
                    <div key={group.date}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px" }}>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                        <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--panel2)", padding: "2px 10px", borderRadius: 999, border: "1px solid var(--line)" }}>
                          {group.date}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                      </div>
                      {group.messages.map((msg) => (
                        <MessageBubble key={msg.id} msg={msg} isMine={msg.sender === me?.username} />
                      ))}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Pending file preview */}
              {pendingFile && (
                <div style={{
                  margin: "0 16px 8px",
                  padding: "10px 14px",
                  background: "var(--panel2)",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  {pendingFile.previewUrl ? (
                    <img src={pendingFile.previewUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                      <FileIcon type={pendingFile.type} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pendingFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatSize(pendingFile.size)}</div>
                  </div>
                  <button onClick={() => setPendingFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Input Area */}
              <div style={{
                padding: "10px 14px 14px",
                borderTop: "1px solid var(--line)",
                background: "var(--sidebar)",
                flexShrink: 0,
              }}>
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
                      flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                      border: "1px solid var(--line)", background: "var(--panel2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: uploading ? "wait" : "pointer", color: "var(--muted2)",
                    }}
                  >
                    {uploading
                      ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : <Paperclip size={18} />
                    }
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالة... (Enter للإرسال، Shift+Enter لسطر جديد)"
                    rows={1}
                    style={{
                      flex: 1, resize: "none", overflowY: "auto", maxHeight: 120,
                      borderRadius: 12, border: "1px solid var(--line)",
                      background: "var(--panel2)", color: "var(--ink)",
                      padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
                      outline: "none", fontFamily: "inherit", direction: "rtl",
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
                      flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                      border: "none", background: "var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", opacity: (!input.trim() && !pendingFile) || sending ? 0.45 : 1,
                      color: "var(--accent-fg, #fff)",
                      transition: "opacity 0.15s",
                    }}
                  >
                    {sending
                      ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
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
