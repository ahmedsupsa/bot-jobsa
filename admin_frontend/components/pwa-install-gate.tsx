"use client";
import { useEffect, useState } from "react";
import { Download, Share, Plus, Smartphone, Chrome } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Status = "loading" | "ok" | "gate-android" | "gate-ios" | "gate-other";

export function PWAInstallGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore iOS Safari
      window.navigator.standalone === true;
    if (standalone) { setStatus("ok"); return; }

    const ua = window.navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    if (!isMobile) { setStatus("ok"); return; }

    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setStatus("gate-android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => setStatus("ok");
    window.addEventListener("appinstalled", onInstalled);

    if (isIOS) {
      setStatus("gate-ios");
    } else if (isAndroid) {
      setStatus("gate-android");
    } else {
      setStatus("gate-other");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const r = await deferred.userChoice;
    if (r.outcome === "accepted") setStatus("ok");
    setDeferred(null);
  };

  if (status === "loading" || status === "ok") return <>{children}</>;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <Smartphone size={36} color="#7c3aed" />
        </div>
        <h1 style={styles.title}>ثبّت التطبيق للمتابعة</h1>
        <p style={styles.subtitle}>
          للوصول السريع للوظائف والإشعارات الفورية، يجب تثبيت التطبيق على شاشتك الرئيسية.
        </p>

        {status === "gate-android" && (
          <>
            {deferred ? (
              <button onClick={install} style={styles.installBtn}>
                <Download size={18} />
                تثبيت التطبيق الآن
              </button>
            ) : (
              <div style={styles.steps}>
                <div style={styles.stepRow}>
                  <span style={styles.stepNum}>1</span>
                  <span style={styles.stepText}>اضغط على القائمة <span style={styles.kbd}>⋮</span> أعلى المتصفح</span>
                </div>
                <div style={styles.stepRow}>
                  <span style={styles.stepNum}>2</span>
                  <span style={styles.stepText}>اختر <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b></span>
                </div>
                <div style={styles.stepRow}>
                  <span style={styles.stepNum}>3</span>
                  <span style={styles.stepText}>افتح التطبيق من شاشتك الرئيسية</span>
                </div>
              </div>
            )}
            <p style={styles.hint}>
              <Chrome size={13} style={{ verticalAlign: "middle", marginLeft: 4 }} />
              يفضّل استخدام متصفح Chrome
            </p>
          </>
        )}

        {status === "gate-ios" && (
          <>
            <div style={styles.steps}>
              <div style={styles.stepRow}>
                <span style={styles.stepNum}>1</span>
                <span style={styles.stepText}>
                  اضغط زر المشاركة <Share size={14} style={{ verticalAlign: "middle", color: "#7c3aed" }} /> أسفل المتصفح
                </span>
              </div>
              <div style={styles.stepRow}>
                <span style={styles.stepNum}>2</span>
                <span style={styles.stepText}>
                  اختر <b>"إضافة إلى الشاشة الرئيسية"</b> <Plus size={13} style={{ verticalAlign: "middle" }} />
                </span>
              </div>
              <div style={styles.stepRow}>
                <span style={styles.stepNum}>3</span>
                <span style={styles.stepText}>اضغط <b>"إضافة"</b> ثم افتح التطبيق من شاشتك الرئيسية</span>
              </div>
            </div>
            <p style={styles.hint}>
              يجب استخدام متصفح <b>Safari</b> على iPhone
            </p>
          </>
        )}

        {status === "gate-other" && (
          <p style={styles.subtitle}>
            متصفحك لا يدعم تثبيت التطبيق. الرجاء فتح الموقع من متصفح Chrome على Android أو Safari على iPhone.
          </p>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 99999,
    background: "linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20, direction: "rtl",
    overflowY: "auto",
  },
  card: {
    width: "100%", maxWidth: 420,
    background: "#ffffff",
    border: "1px solid #e9d5ff",
    borderRadius: 22,
    padding: "28px 22px",
    boxShadow: "0 20px 50px rgba(124, 58, 237, 0.18)",
    textAlign: "center",
  },
  iconWrap: {
    width: 76, height: 76, margin: "0 auto 16px",
    borderRadius: 22,
    background: "linear-gradient(135deg, #f3e8ff, #ede9fe)",
    border: "1px solid #ddd6fe",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  title: {
    margin: "0 0 8px", color: "#1a1a1a",
    fontSize: 22, fontWeight: 800, lineHeight: 1.3,
  },
  subtitle: {
    margin: "0 0 22px", color: "#6b7280",
    fontSize: 14, lineHeight: 1.7,
  },
  installBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    color: "#ffffff", border: "none",
    borderRadius: 14, padding: "14px 18px",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 8px 20px rgba(124, 58, 237, 0.35)",
    fontFamily: "inherit",
  },
  steps: {
    display: "flex", flexDirection: "column", gap: 12,
    background: "#fafaf9", border: "1px solid #f3e8ff",
    borderRadius: 14, padding: 16, marginBottom: 14,
    textAlign: "right",
  },
  stepRow: {
    display: "flex", alignItems: "flex-start", gap: 10,
  },
  stepNum: {
    width: 24, height: 24, borderRadius: 8,
    background: "#7c3aed", color: "#fff",
    fontSize: 12, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  stepText: {
    fontSize: 13.5, color: "#1f2937", lineHeight: 1.6, flex: 1,
  },
  kbd: {
    display: "inline-block", padding: "1px 6px", borderRadius: 5,
    background: "#fff", border: "1px solid #e5e7eb",
    fontFamily: "monospace", fontSize: 12,
  },
  hint: {
    margin: "8px 0 0", color: "#9ca3af",
    fontSize: 12, lineHeight: 1.5,
  },
};
