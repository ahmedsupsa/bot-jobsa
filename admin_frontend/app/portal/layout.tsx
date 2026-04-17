import type { Metadata } from "next";

export const metadata: Metadata = { title: "Jobsa | بوابة المستخدمين" };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .portal-root, .portal-root * {
          font-family: 'Rubik', system-ui, sans-serif !important;
        }
      `}} />
      {children}
    </>
  );
}
