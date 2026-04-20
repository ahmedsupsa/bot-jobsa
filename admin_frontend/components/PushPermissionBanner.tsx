"use client";
import { useState } from "react";
import { Bell, Clock, CheckCircle, X, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { usePushSubscribe, PushPermission } from "@/hooks/usePushSubscribe";

export function PushPermissionBanner() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const { permission, requesting, requestPermission } = usePushSubscribe();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if: already granted, denied, unsupported, or dismissed
  if (dismissed || permission === "granted" || permission === "denied" || permission === "unsupported") {
    return null;
  }

  const t = {
    bg:      dark ? "#0d1117" : "#fff",
    border:  dark ? "#f59e0b33" : "#fbbf2433",
    text:    dark ? "#fff"    : "#09090b",
    text2:   dark ? "#aaa"    : "#71717a",
    text3:   dark ? "#666"    : "#a1a1aa",
    iconBg:  dark ? "#1a1500" : "#fffbeb",
  };

  return (
    <div style={{
      background: dark ? "linear-gradient(135deg,#1a1200 0%,#1a1400 100%)" : "linear-gradient(135deg,#fffbeb 0%,#fff7d6 100%)",
      border: `1px solid ${t.border}`,
      borderRadius: 18,
      padding: "18px 16px",
      marginBottom: 20,
      position: "relative",
      animation: "fadeIn 0.3s ease",
    }}>
      {/* Close button */}
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute", top: 12, left: 12,
          background: "transparent", border: "none",
          color: t.text3, cursor: "pointer",
          display: "flex", alignItems: "center",
          padding: 4, borderRadius: 6,
        }}
      >
        <X size={15} strokeWidth={2} />
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: t.iconBg,
          border: "1px solid #f59e0b44",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Bell size={22} strokeWidth={1.5} color="#f59e0b" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: t.text, fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
            فعّل الإشعارات لتتابع تقديماتك
          </p>

          {/* Benefits list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
            {[
              { icon: <Clock size={13} strokeWidth={1.5} />, text: "تنبيه قبل انتهاء وقت التقديم" },
              { icon: <Bell size={13} strokeWidth={1.5} />,  text: "إشعار فور إرسال طلبك لشركة" },
              { icon: <CheckCircle size={13} strokeWidth={1.5} />, text: "تحديثات مباشرة حتى لو الموقع مغلق" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, color: t.text2 }}>
                <span style={{ color: "#f59e0b", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: 13 }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Action button */}
          <button
            onClick={requestPermission}
            disabled={requesting}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 22px", borderRadius: 12,
              background: requesting ? "#92400e" : "#f59e0b",
              color: "#0a0a0a",
              border: "none", cursor: requesting ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 800,
              transition: "all 0.15s",
              boxShadow: "0 2px 12px #f59e0b44",
            }}
          >
            {requesting
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> جاري التفعيل…</>
              : <><Bell size={14} strokeWidth={2} /> تفعيل الإشعارات</>}
          </button>
        </div>
      </div>
    </div>
  );
}
