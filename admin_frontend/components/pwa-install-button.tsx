"use client";
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) { setInstalled(true); return; }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setDismissed(false);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    if (isIOS && isSafari && !standalone) {
      const t = setTimeout(() => setShowIOS(true), 5000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setShowIOS(false);
    setDeferred(null);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const r = await deferred.userChoice;
    if (r.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  if (installed || dismissed) return null;

  if (deferred) {
    return (
      <div className="pwa-install-bar" style={bar}>
        <div style={iconBox}><Download size={18} style={{ color: "var(--accent)" }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text)", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>
            ثبّت تطبيق Jobbots
          </div>
          <div style={{ color: "var(--text3)", fontSize: 11.5, marginTop: 2, lineHeight: 1.4 }}>
            للوصول السريع من شاشتك الرئيسية
          </div>
        </div>
        <button onClick={install} style={installBtn}>تثبيت</button>
        <button onClick={dismiss} style={closeBtn}><X size={16} /></button>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div className="pwa-install-bar" style={bar}>
        <div style={iconBox}><Share size={18} style={{ color: "var(--accent)" }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text)", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>
            أضِف Jobbots لشاشتك
          </div>
          <div style={{ color: "var(--text3)", fontSize: 11.5, marginTop: 2, lineHeight: 1.4 }}>
            اضغط مشاركة <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> ثم "إضافة إلى الشاشة الرئيسية"
          </div>
        </div>
        <button onClick={dismiss} style={closeBtn}><X size={16} /></button>
      </div>
    );
  }

  return null;
}

const bar: React.CSSProperties = {
  position: "fixed", bottom: 16, left: 16, right: 16,
  maxWidth: 460, margin: "0 auto",
  background: "var(--surface)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: "12px 14px",
  display: "flex", alignItems: "center", gap: 12,
  boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
  zIndex: 9999,
  direction: "rtl",
  animation: "pwaSlideUp 0.4s ease-out",
};

const iconBox: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const installBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-fg)",
  border: "none",
  borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 700,
  cursor: "pointer", flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  background: "transparent", border: "none", color: "var(--text3)",
  cursor: "pointer", padding: 4, display: "flex", flexShrink: 0,
};
