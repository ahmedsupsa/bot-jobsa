"use client";
import { useEffect, useRef, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { portalFetch } from "@/lib/portal-auth";
import { Send, MessageCircle, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  sender: "user" | "admin";
  content: string;
  created_at: string;
  read_at: string | null;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await portalFetch("/api/portal/support");
      const j = await r.json();
      if (j.ok) setMessages(j.messages || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const r = await portalFetch("/api/portal/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const j = await r.json();
      if (j.ok && j.message) {
        setMessages((prev) => [...prev, j.message]);
      }
    } catch {}
    setSending(false);
  };

  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

  return (
    <PortalShell>
      <div style={{
        display: "flex", flexDirection: "column",
        height: "calc(100vh - 80px)", maxHeight: 800,
        background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 16,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #1f1f1f",
          display: "flex", alignItems: "center", gap: 12, background: "#0d0d0d",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(34,197,94,0.1)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={20} color="#22c55e" />
          </div>
          <div>
            <p style={{ margin: 0, color: "#fff", fontSize: 15, fontWeight: 600 }}>الدعم الفني</p>
            <p style={{ margin: 0, color: "#666", fontSize: 12 }}>راسلنا وسنرد عليك في أقرب وقت</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: 20,
          display: "flex", flexDirection: "column", gap: 10,
          background: "#070707",
        }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={24} color="#666" className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#555", padding: 40, fontSize: 13 }}>
              لا توجد رسائل بعد. ابدأ المحادثة!
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{
                alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "75%",
              }}>
                <div style={{
                  background: m.sender === "user" ? "#1f3d1f" : "#1a1a1a",
                  border: `1px solid ${m.sender === "user" ? "#22c55e33" : "#2a2a2a"}`,
                  color: "#fff",
                  padding: "10px 14px", borderRadius: 14,
                  fontSize: 14, lineHeight: 1.6,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
                <div style={{
                  fontSize: 10, color: "#555", marginTop: 4,
                  textAlign: m.sender === "user" ? "left" : "right",
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
            placeholder="اكتب رسالتك..."
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
              transition: "opacity .15s",
            }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </PortalShell>
  );
}
