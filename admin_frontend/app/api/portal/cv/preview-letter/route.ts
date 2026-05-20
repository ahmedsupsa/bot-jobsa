import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractToken, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

function freshClient() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

type Cert = { type: string; name: string; issuer: string | null };
type CvProfile = {
  degree?: string; specialization?: string; experience_years?: number;
  skills?: string[]; prev_jobs?: string[]; languages?: string[];
};

// ── Gemini: توليد نص الرسالة ─────────────────────────────────────────────────

async function generateLetterBody(
  name: string, jobTitle: string,
  profile: CvProfile | null, certs: Cert[], cvText: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const spec     = profile?.specialization || profile?.degree || "";
  const degree   = profile?.degree || "";
  const expYears = profile?.experience_years ?? -1;
  const skills   = (profile?.skills ?? []).slice(0, 8).join("، ");
  const prevJobs = (profile?.prev_jobs ?? []).slice(0, 3).join("، ");
  const certList = certs.map(c => c.name + (c.issuer ? ` (${c.issuer})` : "")).join("، ");
  const expStr   = expYears > 0 ? `${expYears} ${expYears === 1 ? "سنة" : "سنوات"}` : "حديث التخرج";

  const prompt = `أنت خبير في كتابة رسائل التقديم الوظيفي في السوق السعودي.
اكتب رسالة تقديم احترافية باللغة العربية لهذا المتقدم:

الاسم: ${name}
المسمى الوظيفي المستهدف: ${jobTitle}
التخصص: ${spec || "غير محدد"}
المؤهل العلمي: ${degree || "غير محدد"}
الخبرة: ${expStr}
المهارات: ${skills || "—"}
الشهادات والرخص: ${certList || "—"}
الوظائف السابقة: ${prevJobs || "—"}
${cvText ? `\nنبذة من السيرة:\n${cvText.slice(0, 1000)}` : ""}

القواعد الصارمة:
- 3 فقرات فقط: افتتاحية، جسم يبرز المهارات والخبرات، خاتمة.
- أسلوب رسمي ومهني يناسب الشركات السعودية.
- لا تذكر اسم شركة محددة — استخدم "شركتكم" أو "مؤسستكم".
- لا تضف تحية افتتاحية (مثل: السلام عليكم) ولا توقيعاً — ستُضافان تلقائياً.
- لا تتجاوز 220 كلمة.
- أعد نص الرسالة فقط، بدون أي تنسيق إضافي.`;

  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!r.ok) continue;
      const data = await r.json();
      const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      if (text.length > 80) return text;
    } catch { continue; }
  }
  return "";
}

// ── بناء HTML النهائي للعرض ──────────────────────────────────────────────────

function wrapInEmailHtml(
  name: string, phone: string, email: string, bodyText: string,
): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(p => p.trim()).filter(Boolean)
    .map(p => `<p style="line-height:1.95;margin:0 0 16px;font-size:15px;color:#e2e8f0;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;padding:20px 16px 32px;background:#f0f2f5;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl}.badge{display:inline-flex;align-items:center;gap:6px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px;margin-bottom:16px}.card{background:#0a1e36;color:#fff;padding:36px 32px;border-radius:14px;max-width:600px}.hdr{font-size:19px;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:16px;margin:0 0 20px;line-height:1.5}.greet{font-size:15px;font-weight:600;margin:0 0 18px;color:#93c5fd}.footer{margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.12);font-size:13px;line-height:1.9;color:#cbd5e1}.footer strong{color:#fff;font-size:14px}.note{color:#94a3b8;font-size:11px;text-align:center;margin-top:14px}</style>
</head>
<body>
<div class="badge">👁 معاينة — هذا هو الإيميل الحقيقي الذي يصل للشركة باسمك</div>
<div class="card">
  <p class="hdr">إلى فريق التوظيف المختص</p>
  <p class="greet">السلام عليكم ورحمة الله وبركاته،</p>
  <div>${paragraphs}</div>
  <div class="footer">مع خالص التحية،<br><strong>${name}</strong><br>${phone || "رقم الجوال"}<br>${email || "البريد الإلكتروني"}</div>
</div>
<p class="note">اسم الشركة يُستبدل تلقائياً لكل وظيفة عند التقديم</p>
</body></html>`;
}

// ── GET: جلب أو توليد القالب ─────────────────────────────────────────────────

export async function GET(req: Request) {
  const token = extractToken(req);
  if (!token) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "غير مخوّل" }, { status: 401 });
  const uid = payload.user_id;

  const url = new URL(req.url);
  const forceRegen = url.searchParams.get("regenerate") === "1";
  const formatJson = url.searchParams.get("format") === "json";

  // وضع JSON — يُرجع نص الجسم الخام فقط (للتعديل)
  if (formatJson && !forceRegen) {
    const db = freshClient();
    const { data } = await db.from("user_settings").select("cover_letter_body").eq("user_id", uid).single();
    return NextResponse.json({ body: data?.cover_letter_body || "" });
  }
  const db = freshClient();

  const [userRes, cvRes, settingsRes, certsRes, prefsRes] = await Promise.all([
    db.from("users").select("full_name, phone").eq("id", uid).single(),
    db.from("user_cvs").select("cv_profile, cv_parsed_text").eq("user_id", uid).limit(1),
    db.from("user_settings").select("smtp_email, email, cover_letter_body").eq("user_id", uid).single(),
    db.from("user_certifications").select("type, name, issuer").eq("user_id", uid),
    db.from("user_job_preferences").select("job_fields(name_ar)").eq("user_id", uid).limit(5),
  ]);

  const user     = userRes.data;
  const cvRow    = cvRes.data?.[0];
  const settings = settingsRes.data;
  const certs    = (certsRes.data ?? []) as Cert[];
  const profile  = (cvRow?.cv_profile ?? null) as CvProfile | null;
  const cvText   = String(cvRow?.cv_parsed_text ?? "").trim();
  const name     = user?.full_name || "المتقدم";
  const phone    = user?.phone || "";
  const email    = settings?.smtp_email || settings?.email || "";
  const savedBody = (!forceRegen && settings?.cover_letter_body) || null;

  // إذا في قالب محفوظ ومش طلب إعادة إنشاء → أعده فوراً
  if (savedBody) {
    const html = wrapInEmailHtml(name, phone, email, savedBody);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // أفضل مسمى وظيفي من تفضيلات المستخدم
  type PrefRow = { job_fields: { name_ar: string } | { name_ar: string }[] | null };
  const prefs = (prefsRes.data ?? []) as unknown as PrefRow[];
  const rawField = prefs[0]?.job_fields;
  const firstPref = Array.isArray(rawField) ? rawField[0] : rawField;
  const jobTitle = firstPref?.name_ar || profile?.specialization || "وظيفة مناسبة";

  // توليد بالذكاء الاصطناعي
  const aiBody = await generateLetterBody(name, jobTitle, profile, certs, cvText);

  if (aiBody) {
    await db.from("user_settings").update({ cover_letter_body: aiBody }).eq("user_id", uid);
    const html = wrapInEmailHtml(name, phone, email, aiBody);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Fallback: قالب ثابت إذا فشل الذكاء الاصطناعي
  const spec   = profile?.specialization || profile?.degree || "مجال التخصص";
  const exp    = profile?.experience_years ?? -1;
  const skills = (profile?.skills ?? []).slice(0, 5).join("، ") || "";
  const degree = profile?.degree || "مؤهل علمي مناسب";
  const expStr = exp > 0 ? `خبرة ${exp} ${exp === 1 ? "سنة" : "سنوات"} في المجال` : "حديث التخرج";
  const fallbackBody = `أنا ${name}، متخصص في ${spec}، وأرغب بالانضمام إلى فريقكم.\n\n${degree}. ${expStr}${skills ? `\nأبرز مهاراتي: ${skills}.` : ""}\n\nأرفقت سيرتي الذاتية وأتطلع للتواصل معكم.`;

  const html = wrapInEmailHtml(name, phone, email, fallbackBody);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
