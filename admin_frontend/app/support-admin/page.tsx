"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Shell from "@/components/shell";
import { Send, MessageCircle, Loader2, ArrowRight } from "lucide-react";

interface Conv {
  user_id: string;
  full_name: string;
  phone: string;
  last_message: string;
  last_at: string;
  last_sender: string;
  unread_count: number;
}
interface Msg {
  id: string;
  sender: "user" | "admin";
  content: string;
  created_at: string;
  read_at: string | null;
}

const API_BASE = "";

export default function SupportAdminPage() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<{ full_name: string; phone: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/admin/support/conversations`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) setConversations(j.conversations || []);
    } catch {}
    setLoadingList(false);
  }, []);

  const loadMessages = useCallback(async (uid: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/support/messages?user_id=${uid}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) {
        setMessages(j.messages || []);
        setActiveUser(j.user);
      }
    } catch {}
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 8000);
    return () => clearInterval(id);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeUserId) return;
    loadMessages(activeUserId);
    const id = setInterval(() => loadMessages(activeUserId), 6000);
    return () => clearInterval(id);
  }, [activeUserId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!activeUserId || !input.trim() || sending) return;
    const text = input.trim();
    setSending(true);
    setInput("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/support/messages`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeUserId, content: text }),
      });
      const j = await r.json();
      if (j.ok && j.message) {
        setMessages((prev) => [...prev, j.message]);
        loadConversations();
      }
    } catch {}
    setSending(false);
  };

  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (s: string) => {
    const d = new Date(s);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(s);
    return d.toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit" });
  };

  return (
    <Shell>
      <div style={{
        display: "flex", height: "calc(100vh - 100px)",
        background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 16,
        overflow: "hidden",
      }}>
        {/* Sidebar - Conversations List */}
        <div style={{
          width: 320, borderInlineEnd: "1px solid #1f1f1f",
          display: "flex", flexDirection: "column", background: "#0d0d0d",
        }}>
          <div style={{ padding: 16, borderBottom: "1px solid #1f1f1f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MessageCircle size={18} color="#22c55e" />
              <h2 style={{ margin: 0, color: "#fff", fontSize: 15, fontWeight: 600 }}>
                المحادثات ({conversations.length})
              </h2>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingList ? (
              <div style={{ padding: 30, textAlign: "center" }}>
                <Loader2 size={20} color="#666" className="animate-spin" style={{ display: "inline-block" }} />
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#555", fontSize: 13 }}>
                لا توجد محادثات
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.user_id}
                  onClick={() => setActiveUserId(c.user_id)}
                  style={{
                    width: "100%", padding: "14px 16px",
                    background: activeUserId === c.user_id ? "#1a1a1a" : "transparent",
                    borderBottom: "1px solid #181818",
                    borderInlineStart: activeUserId === c.user_id ? "3px solid #22c55e" : "3px solid transparent",
                    border: "none", textAlign: "right", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 4,
                    transition: "background .15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.full_name}
                    </span>
                    <span style={{ color: "#555", fontSize: 11, flexShrink: 0 }}>{fmtDate(c.last_at)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <span style={{
                      color: "#888", fontSize: 12, flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.last_sender === "admin" && <span style={{ color: "#22c55e" }}>أنت: </span>}
                      {c.last_message}
                    </span>
                    {c.unread_count > 0 && (
                      <span style={{
                        background: "#22c55e", color: "#000",
                        fontSize: 10, fontWeight: 700,
                        borderRadius: 10, padding: "2px 7px",
                        minWidth: 20, textAlign: "center",
                      }}>{c.unread_count}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat View */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!activeUserId ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 12, color: "#555",
            }}>
              <ArrowRight size={32} color="#333" />
              <p style={{ margin: 0, fontSize: 14 }}>اختر محادثة لعرضها</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{
                padding: "14px 20px", borderBottom: "1px solid #1f1f1f", background: "#0d0d0d",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "rgba(34,197,94,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#22c55e", fontSize: 16, fontWeight: 700,
                }}>
                  {(activeUser?.full_name || "?")[0]}
                </div>
                <div>
                  <p style={{ margin: 0, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                    {activeUser?.full_name || "..."}
                  </p>
                  <p style={{ margin: 0, color: "#666", fontSize: 12 }}>{activeUser?.phone || ""}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} style={{
                flex: 1, overflowY: "auto", padding: 20,
                display: "flex", flexDirection: "column", gap: 10,
                background: "#070707",
              }}>
                {loadingMsgs && messages.length === 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={20} color="#666" className="animate-spin" />
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} style={{
                      alignSelf: m.sender === "admin" ? "flex-end" : "flex-start",
                      maxWidth: "70%",
                    }}>
                      <div style={{
                        background: m.sender === "admin" ? "#1f3d1f" : "#1a1a1a",
                        border: `1px solid ${m.sender === "admin" ? "#22c55e33" : "#2a2a2a"}`,
                        color: "#fff",
                        padding: "10px 14px", borderRadius: 14,
                        fontSize: 14, lineHeight: 1.6,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {m.content}
                      </div>
                      <div style={{
                        fontSize: 10, color: "#555", marginTop: 4,
                        textAlign: m.sender === "admin" ? "left" : "right",
                        paddingInline: 6,
                      }}>
                        {fmtTime(m.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Composer */}
              <div style={{
                padding: 14, borderTop: "1px solid #1f1f1f", background: "#0d0d0d",
                display: "flex", gap: 10, alignItems: "flex-end",
              }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="اكتب ردك..."
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
                  disabled={sending || !input.trim()}
                  style={{
                    background: "#22c55e", color: "#000", border: "none",
                    borderRadius: 12, width: 42, height: 42,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                    opacity: sending || !input.trim() ? 0.4 : 1,
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
