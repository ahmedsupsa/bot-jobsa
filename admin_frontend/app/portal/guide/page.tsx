"use client";
import { PortalShell } from "@/components/portal-shell";
import { useTheme } from "@/contexts/theme-context";
import {
  FileText, Briefcase, Mail, ClipboardList, Info,
} from "lucide-react";

const sections = [
  {
    icon: <FileText size={20} strokeWidth={1.5} />,
    title: "سيرتي الذاتية",
    path: "/portal/cv",
    steps: [
      "ارفع سيرتك الذاتية (PDF أو صورة). تأكد إنها سيرة حقيقية وتحتوي على مؤهلاتك وخبراتك.",
      "بعد الرفع، استخرج الملخص عشان نشوف وش مكتوب فيها.",
      "إذا السيرة مضروبة أو مو حقيقية، النظام بيعرف وبيقفلها.",
      "السيرة لازم تكون PDF نصي مو صورة ممسوحة.",
    ],
  },
  {
    icon: <Briefcase size={20} strokeWidth={1.5} />,
    title: "التفضيلات",
    path: "/portal/preferences",
    steps: [
      "هنا تحدد المسميات الوظيفية اللي تبي البوت يقدم عليها.",
      "أضف مسميات زي: محاسب، مبرمج، مهندس، مسؤول موارد بشرية...",
      "البوت بيقدم على الوظائف اللي عنوانها يطابق المسميات اللي اخترتها.",
      "نصيحة: اختر ٣-٥ مسميات عشان تزيد فرصك.",
    ],
  },
  {
    icon: <Mail size={20} strokeWidth={1.5} />,
    title: "ربط الإيميل",
    path: "/portal/email",
    steps: [
      "عشان البوت يرسل التقديمات، لازم تربط إيميل Gmail.",
      "سوّي App Password من إعدادات Google (مو كلمة مرورك العادية).",
      "شوف شروحات كيف تسوي App Password: حسابات Google ← الأمان ← كلمات مرور التطبيقات.",
      "حط البريد الإلكتروني وكلمة مرور التطبيق في الصفحة، واحفظ.",
      "بدون هالخطوة، البوت ما يقدر يرسل نيابة عنك.",
    ],
  },
  {
    icon: <ClipboardList size={20} strokeWidth={1.5} />,
    title: "التقديمات",
    path: "/portal/applications",
    steps: [
      "هنا تشوف كل التقديمات اللي أرسلها البوت.",
      "تلقى حالة كل تقديم: تم الإرسال، خطأ، أو تم التخطي.",
      "إذا فيه خطأ، راجع إعدادات الإيميل أو السيرة.",
      "تقدر تشوف تفاصيل كل تقديم: الوظيفة، الشركة، وتاريخ الإرسال.",
    ],
  },
  {
    icon: <Info size={20} strokeWidth={1.5} />,
    title: "طريقة العمل العامة",
    steps: [
      "كل ٣٠ دقيقة، البوت يشوف الوظائف الجديدة في قاعدة البيانات.",
      "يقارن المسميات اللي اخترتها بعناوين الوظائف.",
      "إذا لقى تطابق، يكتب رسالة تقديم احترافية ويحط سيرتك.",
      "يرسل الإيميل باسمك من حسابك الشخصي (عن طريق App Password).",
      "كل مستخدم له حد ٣٠ تقديم في اليوم.",
      "تقدر تتابع كل شيء من صفحة التقديمات.",
    ],
  },
];

export default function GuidePage() {
  const { theme } = useTheme();
  const dark = theme === "dark";

  const t = {
    surface: dark ? "#111" : "#fff",
    border: dark ? "#1f1f1f" : "#e4e4e7",
    text: dark ? "#fff" : "#09090b",
    text2: dark ? "#aaa" : "#71717a",
    text3: dark ? "#666" : "#a1a1aa",
    purple: dark ? "#c4b5fd" : "#5b21b6",
    purpleBg: dark ? "#0d0d1a" : "#f5f3ff",
    purpleBd: dark ? "#1e1e3a" : "#ddd6fe",
    blue: dark ? "#93c5fd" : "#2563eb",
    blueBg: dark ? "#0a1a2a" : "#eff6ff",
    blueBd: dark ? "#1e3a5a" : "#bfdbfe",
  };

  return (
    <PortalShell>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: t.text, fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>الشروحات</h1>
          <p style={{ color: t.text2, fontSize: 14, margin: 0 }}>
            كل اللي تحتاج تعرفه عشان تستخدم البوت بالشكل الصحيح
          </p>
        </div>

        {sections.map((section, i) => (
          <div
            key={i}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              padding: "22px 20px",
              marginBottom: 16,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: section.path ? t.purpleBg : t.blueBg,
                  border: `1px solid ${section.path ? t.purpleBd : t.blueBd}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: section.path ? t.purple : t.blue,
                }}
              >
                {section.icon}
              </div>
              <div>
                <h2
                  style={{
                    color: t.text,
                    fontSize: 16,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {section.title}
                </h2>
                {section.path && (
                  <a
                    href={section.path}
                    style={{
                      color: t.purple,
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    {section.path}
                  </a>
                )}
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {section.steps.map((step, j) => (
                <div
                  key={j}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 22,
                      background: section.path ? t.purpleBg : t.blueBg,
                      border: `1px solid ${section.path ? t.purpleBd : t.blueBd}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <span
                      style={{
                        color: section.path ? t.purple : t.blue,
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {j + 1}
                    </span>
                  </div>
                  <p
                    style={{
                      color: t.text2,
                      fontSize: 13,
                      margin: 0,
                      lineHeight: 1.7,
                      paddingTop: 2,
                    }}
                  >
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
