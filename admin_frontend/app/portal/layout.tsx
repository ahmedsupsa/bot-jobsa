import type { Metadata } from "next";
import { PWAInstallGate } from "@/components/pwa-install-gate";

export const metadata: Metadata = { title: "بوت التقديم | بوابة المستخدمين" };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .portal-root, .portal-root * {
          font-family: 'Thmanyah Sans', 'Tajawal', system-ui, sans-serif !important;
        }
      `}} />
      <PWAInstallGate>{children}</PWAInstallGate>
    </>
  );
}
