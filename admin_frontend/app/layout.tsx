import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "جبسا — التقديم التلقائي على الوظائف",
  description: "منصة جبسا تقدّم عنك على المئات من الوظائف تلقائياً بالذكاء الاصطناعي",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
