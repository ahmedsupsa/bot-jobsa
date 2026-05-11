const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export async function sendTelegram(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch {}
}

function now(): string {
  return new Date().toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const tg = {
  // ── مستخدم جديد سجّل ──────────────────────────────────────────────
  newUser: (name: string, phone: string, city: string) =>
    sendTelegram(
      `👤 <b>مستخدم جديد سجّل</b>\n` +
      `الاسم: ${name}\n` +
      `الجوال: ${phone}\n` +
      `المدينة: ${city}\n` +
      `🕐 ${now()}`
    ),

  // ── دفع ناجح (متجر) ───────────────────────────────────────────────
  payment: (name: string, email: string, amount: number, gateway: string, days: number) =>
    sendTelegram(
      `💰 <b>دفع ناجح</b>\n` +
      `العميل: ${name}\n` +
      `البريد: ${email}\n` +
      `المبلغ: ${amount} ر.س\n` +
      `البوابة: ${gateway}\n` +
      `الاشتراك: ${days} يوم\n` +
      `🕐 ${now()}`
    ),

  // ── فشل الدفع ─────────────────────────────────────────────────────
  paymentFailed: (name: string, email: string, phone: string, amount: number, gateway: string, orderId: string) =>
    sendTelegram(
      `❌ <b>فشل الدفع</b>\n` +
      `العميل: ${name || "—"}\n` +
      `البريد: ${email || "—"}\n` +
      `الجوال: ${phone || "—"}\n` +
      `المبلغ: ${amount} ر.س\n` +
      `البوابة: ${gateway}\n` +
      `رقم الطلب: ${orderId}\n` +
      `🕐 ${now()}`
    ),

  // ── تجديد اشتراك ──────────────────────────────────────────────────
  renewal: (name: string, email: string, amount: number, days: number) =>
    sendTelegram(
      `🔄 <b>تجديد اشتراك</b>\n` +
      `العميل: ${name}\n` +
      `البريد: ${email}\n` +
      `المبلغ: ${amount} ر.س\n` +
      `الإضافة: ${days} يوم\n` +
      `🕐 ${now()}`
    ),

  // ── إيصال تحويل بنكي وصل ─────────────────────────────────────────
  bankReceipt: (orderId: string, receiptUrl: string) =>
    sendTelegram(
      `🏦 <b>إيصال تحويل بنكي</b>\n` +
      `رقم الطلب: ${orderId}\n` +
      `الإيصال: ${receiptUrl || "—"}\n` +
      `⏳ <i>بانتظار التأكيد اليدوي</i>\n` +
      `🕐 ${now()}`
    ),

  // ── تفعيل يدوي للطلب ──────────────────────────────────────────────
  orderActivated: (orderId: string, email: string) =>
    sendTelegram(
      `✅ <b>طلب مُفعَّل يدوياً</b>\n` +
      `رقم الطلب: ${orderId}\n` +
      `البريد: ${email}\n` +
      `🕐 ${now()}`
    ),

  // ── رفع سيرة ذاتية ───────────────────────────────────────────────
  cvUploaded: (userId: string, name: string, fileName: string) =>
    sendTelegram(
      `📄 <b>سيرة ذاتية رُفعت</b>\n` +
      `المستخدم: ${name || userId}\n` +
      `الملف: ${fileName}\n` +
      `🕐 ${now()}`
    ),

  // ── ربط إيميل SMTP ────────────────────────────────────────────────
  smtpConnected: (userId: string, email: string) =>
    sendTelegram(
      `📧 <b>إيميل مُربوط</b>\n` +
      `المستخدم: ${userId}\n` +
      `البريد: ${email}\n` +
      `🕐 ${now()}`
    ),

  // ── تشغيل الـ Worker يدوياً ───────────────────────────────────────
  workerTriggered: (by: string) =>
    sendTelegram(
      `⚙️ <b>Worker شغّله الأدمن</b>\n` +
      `بواسطة: ${by}\n` +
      `🕐 ${now()}`
    ),

  // ── Worker اكتمل (من Edge Function) ──────────────────────────────
  workerDone: (applied: number, users: number) =>
    sendTelegram(
      `🤖 <b>Worker اكتمل</b>\n` +
      `التقديمات: ${applied}\n` +
      `المستفيدون: ${users} مستخدم\n` +
      `🕐 ${now()}`
    ),

  // ── نتائج Worker التفصيلية ────────────────────────────────────────
  workerResult: (
    applied: number,
    users: number,
    durationSec: number,
    details: Array<{ user: string; job: string; status: string; reason?: string }>
  ) => {
    const successLines = details
      .filter(d => d.status === "sent")
      .map(d => `  ✅ ${d.user} → ${d.job}`);
    const errorLines = details
      .filter(d => d.status === "error")
      .map(d => `  ⚠️ ${d.user} → ${d.job}: ${d.reason?.slice(0, 80) || "خطأ"}`);

    let msg =
      `🤖 <b>Worker اكتمل</b>\n` +
      `التقديمات الناجحة: ${applied}\n` +
      `المستفيدون: ${users} مستخدم\n` +
      `المدة: ${durationSec} ثانية\n`;

    if (successLines.length) {
      msg += `\n<b>قُدِّم بنجاح:</b>\n` + successLines.slice(0, 15).join("\n");
      if (successLines.length > 15) msg += `\n  ... و${successLines.length - 15} أخرى`;
    }
    if (errorLines.length) {
      msg += `\n\n<b>أخطاء:</b>\n` + errorLines.slice(0, 5).join("\n");
    }
    msg += `\n🕐 ${now()}`;
    return sendTelegram(msg);
  },

  // ── خطأ في Worker ─────────────────────────────────────────────────
  workerError: (error: string) =>
    sendTelegram(
      `🚨 <b>Worker — خطأ فادح</b>\n` +
      `الخطأ: ${error.slice(0, 300)}\n` +
      `🕐 ${now()}`
    ),

  // ── وظيفة أضافها الأدمن ───────────────────────────────────────────
  jobAdded: (title: string, company: string, email: string) =>
    sendTelegram(
      `💼 <b>وظيفة جديدة أضيفت</b>\n` +
      `العنوان: ${title}\n` +
      `الشركة: ${company || "—"}\n` +
      `البريد: ${email}\n` +
      `🕐 ${now()}`
    ),

  // ── وظيفة حُذفت ───────────────────────────────────────────────────
  jobDeleted: (id: string | number) =>
    sendTelegram(
      `🗑️ <b>وظيفة حُذفت</b>\n` +
      `ID: ${id}\n` +
      `🕐 ${now()}`
    ),

  // ── دخول أدمن ─────────────────────────────────────────────────────
  adminLogin: (username: string) =>
    sendTelegram(
      `🔐 <b>دخول أدمن</b>\n` +
      `اسم المستخدم: ${username}\n` +
      `🕐 ${now()}`
    ),

  // ── تسجيل دخول مستخدم ────────────────────────────────────────────
  userLogin: (userId: string) =>
    sendTelegram(
      `🔑 <b>دخول مستخدم</b>\n` +
      `ID: ${userId}\n` +
      `🕐 ${now()}`
    ),

  // ── طلب دفع جديد (checkout) ──────────────────────────────────────
  newOrder: (name: string, email: string, amount: number, gateway: string) =>
    sendTelegram(
      `🛒 <b>طلب دفع جديد</b>\n` +
      `العميل: ${name}\n` +
      `البريد: ${email}\n` +
      `المبلغ: ${amount} ر.س\n` +
      `البوابة: ${gateway}\n` +
      `🕐 ${now()}`
    ),

  // ── رسالة دعم من مستخدم ───────────────────────────────────────────
  supportMessage: (userId: string, name: string, msg: string) =>
    sendTelegram(
      `💬 <b>رسالة دعم جديدة</b>\n` +
      `المستخدم: ${name || userId}\n` +
      `الرسالة:\n${msg.slice(0, 300)}\n` +
      `🕐 ${now()}`
    ),

  // ── كود تفعيل مُنشأ (admin) ───────────────────────────────────────
  codesGenerated: (count: number, days: number) =>
    sendTelegram(
      `🎟️ <b>أكواد تفعيل جديدة</b>\n` +
      `العدد: ${count}\n` +
      `المدة: ${days} يوم\n` +
      `🕐 ${now()}`
    ),
};
