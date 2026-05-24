import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/admin-auth";
import { sendAdminOrderNotification } from "@/lib/admin-notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const _denied_ = enforcePermission("store"); if (_denied_) return _denied_;

  try {
    const body = await req.json().catch(() => ({}));
    const gateway: "tamara" | "streampay" | "bank_transfer" =
      body.gateway || "tamara";

    const ok = await sendAdminOrderNotification({
      order_id:        "TEST-001",
      user_name:       "أحمد العمري (تجربة)",
      user_email:      "customer@example.com",
      user_phone:      "0512345678",
      amount:          199,
      payment_gateway: gateway,
      paid_at:         new Date().toISOString(),
    });

    if (ok) {
      return NextResponse.json({ ok: true, message: "تم إرسال البريد التجريبي بنجاح ✅" });
    }
    return NextResponse.json(
      { ok: false, error: "فشل الإرسال — تحقق من RESEND_API_KEY في البيئة" },
      { status: 500 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "خطأ غير متوقع" }, { status: 500 });
  }
}
