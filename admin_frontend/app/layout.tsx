import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobbots — بوت التقديم التلقائي على الوظائف بالذكاء الاصطناعي",
  description:
    "Jobbots يقدّم عنك على الوظائف تلقائياً باستخدام الذكاء الاصطناعي. وفّر وقتك، زد فرصك، واحصل على وظيفتك المثالية بدون جهد.",
  keywords:
    "تقديم تلقائي على الوظائف, بوت وظائف, ذكاء اصطناعي, jobbots, وظائف السعودية, Jobbots, التقديم على وظائف, بحث عن عمل",
  openGraph: {
    title: "Jobbots — بوت التقديم التلقائي على الوظائف",
    description:
      "Jobbots يقدّم عنك على المئات من الوظائف كل يوم تلقائياً. وفّر وقتك وزد فرصك في الحصول على وظيفة.",
    url: "https://jobbots.org",
    siteName: "Jobbots",
    locale: "ar_SA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jobbots — بوت التقديم التلقائي على الوظائف",
    description: "يقدّم عنك تلقائياً باستخدام الذكاء الاصطناعي",
  },
  alternates: {
    canonical: "https://jobbots.org",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Tajawal', 'Segoe UI', Tahoma, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
