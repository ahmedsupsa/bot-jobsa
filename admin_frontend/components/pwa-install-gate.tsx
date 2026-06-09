"use client";
import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa_banner_dismissed";

export function PWAInstallGate({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // لا تعرض لو مثبّت بالفعل
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    // لا تعرض لو أغلقه المستخدم من قبل
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ua = window.navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    if (!isMobile) return;

    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", dismiss);

    // أظهر البانر بعد ثانيتين
    const t = setTimeout(() => setShow(true), 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", dismiss);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const r = await deferred.userChoice;
    if (r.outcome === "accepted") dismiss();
    setDeferred(null);
  };

  return (
    <>
      {children}

      {show && (
        <div style={styles.banner}>
          <div style={styles.content}>
            <span style={styles.icon}>📱</span>
            <div style={styles.text}>
              <strong style={styles.title}>ثبّت تطبيق بوت التقديم على الوظائف بالذكاء الاصطناعي</strong>
              <span style={styles.sub}>
                {isIOS
                  ? <>اضغط <Share size={12} style={{ verticalAlign: "middle" }} /> ثم "إضافة للشاشة الرئيسية"</>
                  : "للوصول السريع من شاشتك الرئيسية"}
              </span>
            </div>
          </div>
          <div style={styles.actions}>
            {!isIOS && deferred && (
              <button onClick={install} style={styles.installBtn}>
                <Download size={14} /> تثبيت
              </button>
            )}
            <button onClick={dismiss} style={styles.closeBtn} aria-label="إغلاق">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: "fixed",
    bottom: 16,
    left: 12,
    right: 12,
    zIndex: 9999,
    background: "#1a1a2e",
    borderRadius: 16,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    direction: "rtl",
  },
  content: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  icon: {
    fontSize: 28,
    flexShrink: 0,
  },
  text: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  sub: {
    color: "#a0a0b0",
    fontSize: 11,
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  installBtn: {
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.1)",
    color: "#a0a0b0",
    border: "none",
    borderRadius: 8,
    padding: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
};
