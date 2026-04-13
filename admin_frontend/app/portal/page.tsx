"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/portal-auth";

export default function PortalRoot() {
  const router = useRouter();
  useEffect(() => {
    const token = getToken();
    if (token) {
      router.replace("/portal/dashboard");
    } else {
      router.replace("/portal/login");
    }
  }, [router]);
  return null;
}
