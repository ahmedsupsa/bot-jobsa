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

    // Already installed?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore iOS Safari
      window.navigator.standalone === true;
    if (standalone) { setInstalled(true); return; }

    // User dismissed before?
    if (localStorage.getItem("jobbots_pwa_dismissed") === "1") {
      setDismissed(true);
    }

    // Chrome / Edge / Android
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari (no beforeinstallprompt) — show our own hint after a delay
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
    localStorage.setItem("jobbots_pwa_dismissed", "1");
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

  // Chrome / Edge / Android — actual install button
  if (deferred) {
    return (
      <div style={s.bar} className="pwa-install-prompt">
        <div style={s.iconBox}><Download size={18} color="#a78bfa" /></div>
        <div style={s.text}>
          <div style={s.title}>ثبّت تطبيق Jobbots</div>
          <div style={s.sub}>للوصول السريع من شاشتك الرئيسية</div>
        </div>
        <button onClick={install} style={s.installBtn}>تثبيت</button>
        <button onClick={dismiss} style={s.closeBtn}><X size={16} /></button>
      </div>
    );
  }

  // iOS Safari hint
  if (showIOS) {
    return (
      <div style={s.bar} className="pwa-install-prompt">
        <div style={s.iconBox}><Share size={18} color="#a78bfa" /></div>
        <div style={s.text}>
          <div style={s.title}>أضِف Jobbots لشاشتك</div>
          <div style={s.sub}>اضغط مشاركة <Share size={11} style={{ display: "inline", verticalAlign: "middle" }} /> ثم "إضافة إلى الشاشة الرئيسية"</div>
        </div>
        <button onClick={dismiss} style={s.closeBtn}><X size={16} /></button>
      </div>
    );
  }

  return null;
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    position: "fixed", bottom: 16, left: 16, right: 16,
    maxWidth: 460, margin: "0 auto",
    background: "rgba(15,15,15,0.95)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid #2a2a2a", borderRadius: 16,
    padding: "12px 14px",
    display: "flex", alignItems: "center", gap: 12,
    boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.1)",
    zIndex: 9999,
    direction: "rtl",
    animation: "pwaSlideUp 0.4s ease-out",
  },
  iconBox: {
    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
    background: "rgba(167,139,250,0.12)",
    border: "1px solid rgba(167,139,250,0.25)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  text: { flex: 1, minWidth: 0 },
  title: { color: "#fff", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 },
  sub: { color: "#888", fontSize: 11.5, marginTop: 2, lineHeight: 1.4 },
  installBtn: {
    background: "#fff", color: "#0a0a0a", border: "none",
    borderRadius: 9, padding: "8px 14px", fontSize: 12.5, fontWeight: 700,
    cursor: "pointer", flexShrink: 0,
  },
  closeBtn: {
    background: "transparent", border: "none", color: "#666",
    cursor: "pointer", padding: 4, display: "flex", flexShrink: 0,
  },
};
