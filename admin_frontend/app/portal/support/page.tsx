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
      const r = await portalFetch("/support");
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
      const r = await portalFetch("/support", {
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
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12, background: "var(--surface2)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(255,255,255,0.06)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={20} color="#fff" />
          </div>
          <div>
            <p style={{ margin: 0, color: "var(--text)", fontSize: 15, fontWeight: 600 }}>الدعم الفني</p>
            <p style={{ margin: 0, color: "var(--text3)", fontSize: 12 }}>راسلنا وسنرد عليك في أقرب وقت</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: 20,
          display: "flex", flexDirection: "column", gap: 10,
          background: "var(--bg)",
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
                  background: m.sender === "user" ? "rgba(34,197,94,0.12)" : "var(--surface2)",
                  border: `1px solid ${m.sender === "user" ? "#ffffff15" : "var(--border)"}`,
                  color: "var(--text)",
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
          padding: 14, borderTop: "1px solid var(--border)", background: "var(--surface2)",
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
              flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, padding: "10px 14px", color: "var(--text)",
              fontSize: 14, fontFamily: "inherit", resize: "none",
              outline: "none", maxHeight: 120, minHeight: 42,
            }}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            style={{
              background: "#fff", color: "#000", border: "none",
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
