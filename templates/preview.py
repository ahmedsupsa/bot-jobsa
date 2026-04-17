# -*- coding: utf-8 -*-
import asyncio
import base64
import httpx
from config import RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME


def build_application_html(
    name: str,
    phone: str,
    job_title: str,
    company: str,
    cover_letter: str,
    lang: str = "ar",
    cv_used_for_letter: bool = False,
) -> str:
    cv_note_html = ""
    cover_html = cover_letter.replace("\n", "<br>") if cover_letter else ""
    is_ar = (lang or "ar").strip().lower() == "ar"
    direction = "rtl" if is_ar else "ltr"
    title_h2 = "طلب توظيف" if is_ar else "Job Application"
    lbl_name = "الاسم" if is_ar else "Name"
    lbl_phone = "الجوال" if is_ar else "Phone"
    lbl_company = "الشركة" if is_ar else "Company"
    company_html = ""
    if (company or "").strip():
        company_html = f'<p style="line-height:1.6;"><strong>{lbl_company}:</strong> {company}</p>'

    return f"""<!DOCTYPE html><html dir="{direction}" lang="{'ar' if is_ar else 'en'}"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;direction:{direction};text-align:{'right' if is_ar else 'left'};">
<div style="background:#fff;padding:24px;border-radius:8px;">
<h2 style="color:#333;margin:0 0 12px 0;">{title_h2} — {job_title}</h2>
<p style="line-height:1.9;color:#2c2c2c;">{cover_html}</p>
{cv_note_html}
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
{company_html}
<p><strong>{lbl_name}:</strong> {name}</p>
<p><strong>{lbl_phone}:</strong> {phone}</p>
</div></body></html>"""


def get_preview_html(name: str, phone: str, job_title: str = "وظيفة تجريبية - معاينة") -> str:
    name = name or "الاسم"
    phone = phone or "رقم الجوال"
    fake_cover = (
        "هذه معاينة لشكل رسالة التقديم. سيُستبدل هذا النص برسالة تغطية مُولَّدة تلقائياً "
        "حسب الوظيفة ومعلوماتك وسيرتك."
    )
    return build_application_html(
        name=name,
        phone=phone,
        job_title=job_title,
        company="",
        cover_letter=fake_cover,
        lang="ar",
        cv_used_for_letter=False,
    )


async def send_email_resend(
    to_email: str,
    subject: str,
    html_body: str,
    from_email_override: str | None = None,
    from_name_override: str | None = None,
    reply_to_email: str | None = None,
    cc_email: str | None = None,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
) -> None:
    """إرسال البريد عبر Resend API."""
    api_key = (RESEND_API_KEY or "").strip()
    from_email = (from_email_override or RESEND_FROM_EMAIL or "").strip()
    if not api_key or not from_email:
        raise RuntimeError("RESEND_API_KEY أو RESEND_FROM_EMAIL غير معرّف.")

    from_name = (from_name_override or RESEND_FROM_NAME or "").strip() or "Jobsa Bot"
    payload: dict = {
        "from": f"{from_name} <{from_email}>",
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }
    if reply_to_email:
        payload["reply_to"] = reply_to_email
    if cc_email and cc_email.strip().lower() != to_email.strip().lower():
        payload["cc"] = [cc_email]
    if attachment_bytes and attachment_filename:
        payload["attachments"] = [{
            "filename": attachment_filename,
            "content": base64.b64encode(attachment_bytes).decode("ascii"),
        }]

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code not in (200, 201, 202):
        raise RuntimeError(f"Resend error {r.status_code}: {r.text}")


async def send_email(
    sender_email: str | None,
    app_password: str | None,
    to_email: str,
    subject: str,
    html_body: str,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
    resend_from_email: str | None = None,
    resend_from_name: str | None = None,
    reply_to_email: str | None = None,
    cc_email: str | None = None,
) -> None:
    """إرسال موحد عبر Resend API فقط."""
    await send_email_resend(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        from_email_override=(resend_from_email or "").strip() or None,
        from_name_override=(resend_from_name or "").strip() or None,
        reply_to_email=(reply_to_email or sender_email or "").strip() or None,
        cc_email=(cc_email or sender_email or "").strip() or None,
        attachment_bytes=attachment_bytes,
        attachment_filename=attachment_filename,
    )


async def send_template_preview_email(bot, user: dict, settings: dict) -> None:
    email = settings.get("email")
    sender_alias = (settings.get("sender_email_alias") or "").strip() or None
    if not email:
        raise ValueError("يرجى ربط الإيميل أولاً من الإعدادات.")
    name = user.get("full_name") or "الاسم"
    phone = user.get("phone") or "رقم الجوال"
    job_fake = "وظيفة وهمية - معاينة القالب"
    html = get_preview_html(name, phone, job_fake)
    await send_email(
        sender_email=email,
        app_password=None,
        to_email=email,
        subject="معاينة قالب التقديم",
        html_body=html,
        resend_from_email=sender_alias,
        reply_to_email=email,
        cc_email=email,
    )


async def send_welcome_email(user: dict, settings: dict) -> None:
    """إرسال رسالة ترحيبية بعد ربط الإيميل."""
    email = (settings.get("email") or "").strip()
    sender_alias = (settings.get("sender_email_alias") or "").strip() or None
    if not email:
        raise ValueError("لا يوجد إيميل مربوط للمستخدم.")

    name = (user.get("full_name") or "المشترك").strip()
    phone = (user.get("phone") or "").strip()
    html = f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f7f9fc;padding:24px;direction:rtl;text-align:right;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e6edf5;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 12px 0;color:#1e3a5f;">مرحباً {name}</h2>
    <p style="margin:0 0 10px 0;line-height:1.9;color:#2d3748;">
      يسعدنا انضمامك إلى بوت التقديم على الوظائف. تم تفعيل حسابك البريدي بنجاح.
    </p>
    <p style="margin:0 0 10px 0;line-height:1.9;color:#2d3748;">
      من الآن سيصلك إشعار عند نجاح التقديم، ويمكنك متابعة الحالة من داخل البوت.
    </p>
    <hr style="border:none;border-top:1px solid #edf2f7;margin:16px 0;">
    <p style="margin:0;color:#4a5568;"><strong>الاسم:</strong> {name}</p>
    <p style="margin:6px 0 0 0;color:#4a5568;"><strong>الإيميل:</strong> {email}</p>
    <p style="margin:6px 0 0 0;color:#4a5568;"><strong>الجوال:</strong> {phone or '—'}</p>
  </div>
</body>
</html>"""

    await send_email(
        sender_email=email,
        app_password=None,
        to_email=email,
        subject="أهلاً بك في بوت التقديم على الوظائف",
        html_body=html,
        resend_from_email=sender_alias,
        reply_to_email=email,
        cc_email=email,
    )


# للتوافق مع الكود القديم (لا تُحذف — مرجع فقط)
def get_smtp_error_user_message(exc: Exception) -> str | None:
    return None


SMTP_NETWORK_ERROR_HINT = ""
