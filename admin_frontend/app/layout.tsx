import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobsa — بوت التقديم على الوظائف بالذكاء الاصطناعي",
  description: "Jobsa بوت التقديم على الوظائف بالذكاء الاصطناعي — يقدّم عنك تلقائياً",
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
