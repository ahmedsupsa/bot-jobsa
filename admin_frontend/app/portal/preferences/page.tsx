"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreferencesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/portal/cv"); }, [router]);
  return null;
}
