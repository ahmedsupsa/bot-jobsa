import Link from "next/link";
import Image from "next/image";

const s: Record<string, React.CSSProperties> = {
  footer: { borderTop: "1px solid var(--border)", padding: "60px 20px 28px", background: "var(--surface)" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 48, flexWrap: "wrap" as const, paddingBottom: 48, borderBottom: "1px solid var(--border)" },
  brand: { display: "flex", flexDirection: "column" as const, gap: 16, maxWidth: 280 },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoBox: { width: 32, height: 32, borderRadius: 8, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 5, flexShrink: 0 },
  logoText: { fontWeight: 800, fontSize: 17, letterSpacing: "-0.5px" },
  tagline: { fontSize: 13, color: "var(--text3)", lineHeight: 1.8, margin: 0 },
  social: { display: "flex", gap: 8 },
  socialBtn: { width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", background: "var(--bg)", transition: "all 0.15s" },
  cols: { display: "flex", gap: 48, flexWrap: "wrap" as const },
  col: { display: "flex", flexDirection: "column" as const, gap: 10, minWidth: 100 },
  colTitle: { fontSize: 12, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 4px" },
  colLink: { fontSize: 13, color: "var(--text3)" },
  bottom: { maxWidth: 1100, margin: "28px auto 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8 },
  copy: { color: "var(--text4)", fontSize: 12 },
};

export function Footer() {
  return (
    <footer style={s.footer}>
      <div style={s.footerInner}>
        <div style={s.brand}>
          <div style={s.logo}>
            <div style={s.logoBox}>
              <Image src="/logo-transparent.png" alt="بوت التقديم على الوظائف بالذكاء الاصطناعي" width={22} height={22} style={{ display: "block" }} />
            </div>
            <span style={s.logoText}>بوت التقديم على الوظائف بالذكاء الاصطناعي</span>
          </div>
          <p style={s.tagline}>بوت التقديم على الوظائف بالذكاء الاصطناعي — يقدّم عنك تلقائياً كل 30 دقيقة.</p>
          <div style={s.social}>
            <a href="https://t.me/jobbotssa" target="_blank" rel="noopener noreferrer" style={s.socialBtn} aria-label="Telegram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.9l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.958.659z"/></svg>
            </a>
            <a href="https://twitter.com/jobbotssa" target="_blank" rel="noopener noreferrer" style={s.socialBtn} aria-label="Twitter">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
        </div>

        <div style={s.cols}>
          <div style={s.col}>
            <p style={s.colTitle}>المنتج</p>
            <Link href="/store" style={s.colLink}>المتجر</Link>
            <Link href="/wazaif" style={s.colLink}>الوظائف</Link>
            <Link href="/daleel" style={s.colLink}>الأدلة</Link>
          </div>
          <div style={s.col}>
            <p style={s.colTitle}>الحساب</p>
            <Link href="/portal/login" style={s.colLink}>دخول المشترك</Link>
            <Link href="/?scroll=pricing" style={s.colLink}>الباقات</Link>
          </div>
          <div style={s.col}>
            <p style={s.colTitle}>قانوني</p>
            <Link href="/privacy" style={s.colLink}>سياسة الخصوصية</Link>
            <Link href="/terms" style={s.colLink}>الشروط والأحكام</Link>
          </div>
        </div>
      </div>

      <div style={s.bottom}>
        <span style={s.copy}>© 2026 بوت التقديم على الوظائف بالذكاء الاصطناعي. جميع الحقوق محفوظة.</span>
        <span style={s.copy}>صُنع بالسعودية 🇸🇦</span>
      </div>
    </footer>
  );
}
