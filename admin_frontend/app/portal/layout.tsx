"use client";
import type { Metadata } from "next";
import "../globals.css";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {children}
    </div>
  );
}
