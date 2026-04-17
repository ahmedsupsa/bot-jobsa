import Link from "next/link";
import { Briefcase, ArrowRight, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div style={s.page} dir="rtl">
      <nav style={s.nav}>
        <div style={s.navInner}>
          <Link href="/" style={s.logo}>
            <div style={s.logoIcon}><Briefcase size={18} strokeWidth={1.5} color="#0a0a0a" /></div>
            <span style={s.logoText}>Jobbots</span>
          </Link>
        </div>
      </nav>

      <div style={s.body}>
        <div style={s.code}>404</div>
        <h1 style={s.title}>الصفحة غير موجودة</h1>
        <p style={s.sub}>
          يبدو أن هذه الصفحة لا وجود لها أو تم نقلها.<br />
          تحقق من الرابط أو ارجع للصفحة الرئيسية.
        </p>
        <div style={s.btns}>
          <Link href="/" style={s.btnPrimary}>
            <Home size={16} strokeWidth={1.8} />
            الصفحة الرئيسية
          </Link>
          <Link href="/portal/login" style={s.btnSecondary}>
            دخول المشترك
            <ArrowRight size={15} strokeWidth={1.8} />
          </Link>
        </div>
      </div>

      <footer style={s.footer}>
        <p style={{ color: "#444", fontSize: 13, margin: 0 }}>
          © {new Date().getFullYear()} Jobbots. جميع الحقوق محفوظة.
        </p>
      </footer>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column" },
  nav: { borderBottom: "1px solid #1a1a1a", padding: "0 24px" },
  navInner: { maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center" },
  logo: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoIcon: { width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 18, fontWeight: 800 },
  body: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" },
  code: { fontSize: 120, fontWeight: 900, color: "#1a1a1a", lineHeight: 1, marginBottom: 8, fontFamily: "monospace", letterSpacing: -4 },
  title: { fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 14px" },
  sub: { fontSize: 16, color: "#555", lineHeight: 1.8, margin: "0 0 36px", maxWidth: 420 },
  btns: { display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" },
  btnPrimary: {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "#fff", color: "#0a0a0a", padding: "13px 24px",
    borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none",
  },
  btnSecondary: {
    display: "inline-flex", alignItems: "center", gap: 8,
    border: "1px solid #2a2a2a", color: "#888", padding: "13px 20px",
    borderRadius: 12, fontSize: 14, textDecoration: "none",
  },
  footer: { borderTop: "1px solid #1a1a1a", padding: "24px", textAlign: "center" },
};
