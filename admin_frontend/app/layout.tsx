import "./globals.css";
import type { Metadata } from "next";
import { PWARegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/contexts/theme-context";

export const metadata: Metadata = {
  title: "Jobbots — بوت التقديم التلقائي على الوظائف بالذكاء الاصطناعي",
  description: "Jobbots يقدّم عنك على الوظائف تلقائياً باستخدام الذكاء الاصطناعي. وفّر وقتك، زد فرصك، واحصل على وظيفتك المثالية بدون جهد.",
  keywords: "تقديم تلقائي على الوظائف, بوت وظائف, ذكاء اصطناعي, jobbots, وظائف السعودية, بوت تقديم وظائف السعودية, أداة تقديم وظائف, بحث عن وظيفة تلقائي, وظائف 2026, ذكاء اصطناعي وظائف, AI وظائف, عاطل يبحث عن وظيفة, كيف أبحث عن وظيفة في السعودية, وظائف محاسب مهندس مبرمج السعودية",
  openGraph: {
    title: "Jobbots — بوت التقديم التلقائي على الوظائف",
    description: "Jobbots يقدّم عنك على المئات من الوظائف كل يوم تلقائياً.",
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
  alternates: { canonical: "https://jobbots.org" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "بوت التقديم" },
  other: { "mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.png",
  },
  applicationName: "Jobbots",
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body style={{ fontFamily: "'Thmanyah Sans', 'Tajawal', 'Segoe UI', Tahoma, sans-serif" }} suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <PWARegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
