# -*- coding: utf-8 -*-
import asyncio
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

try:
    import aiosmtplib
except ImportError:
    aiosmtplib = None  # fallback to sync smtplib


def _html_professional_full(
    name: str,
    phone: str,
    job_title: str,
    company: str,
    cover_letter: str,
    lang: str = "ar",
) -> str:
    """قالب HTML احترافي يدمج رسالة التغطية مع بيانات المتقدم."""
    is_rtl = lang != "en"
    direction = "rtl" if is_rtl else "ltr"
    text_align = "right" if is_rtl else "left"
    cover_html = cover_letter.replace("\n", "<br>") if cover_letter else ""

    if lang == "ar":
        label_to = "إلى"
        label_subject = "الموضوع"
        label_name = "الاسم"
        label_phone = "الجوال"
        subject_text = f"طلب توظيف - {job_title}"
        company_text = f" | {company}" if company else ""
        dear = ""
    else:
        label_to = "To"
        label_subject = "Subject"
        label_name = "Name"
        label_phone = "Phone"
        subject_text = f"Job Application - {job_title}"
        company_text = f" | {company}" if company else ""
        dear = ""

    return f"""<!DOCTYPE html>
<html dir="{direction}" lang="{'ar' if is_rtl else 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background:#f4f6f9; }}
  .wrapper {{ max-width:640px; margin:30px auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }}
  .header {{ background:linear-gradient(135deg,#1a3c5e,#2e86c1); padding:32px 36px; text-align:{text_align}; }}
  .header h1 {{ color:#fff; font-size:22px; font-weight:700; margin-bottom:6px; }}
  .header p {{ color:#a8d4f0; font-size:14px; }}
  .meta-bar {{ background:#f0f7ff; border-bottom:1px solid #dde8f5; padding:14px 36px; display:flex; gap:24px; flex-wrap:wrap; direction:{direction}; }}
  .meta-item {{ font-size:13px; color:#555; }}
  .meta-item strong {{ color:#1a3c5e; }}
  .body {{ padding:32px 36px; direction:{direction}; text-align:{text_align}; }}
  .cover {{ font-size:15px; line-height:1.9; color:#2c2c2c; margin-bottom:28px; }}
  .divider {{ border:none; border-top:1px solid #e8edf3; margin:24px 0; }}
  .info-box {{ background:#f8fafc; border:{('right' if is_rtl else 'left')}:4px solid #2e86c1; padding:16px 20px; border-radius:6px; }}
  .info-row {{ display:flex; justify-content:space-between; padding:6px 0; font-size:13.5px; border-bottom:1px solid #eef1f5; }}
  .info-row:last-child {{ border-bottom:none; }}
  .info-label {{ color:#888; font-weight:600; }}
  .info-value {{ color:#1a3c5e; font-weight:500; }}
  .footer {{ background:#f0f7ff; padding:16px 36px; text-align:center; font-size:12px; color:#999; border-top:1px solid #dde8f5; }}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>{subject_text}</h1>
    <p>{name}{company_text}</p>
  </div>
  <div class="meta-bar">
    <span class="meta-item"><strong>{label_name}:</strong> {name}</span>
    <span class="meta-item"><strong>{label_phone}:</strong> {phone}</span>
  </div>
  <div class="body">
    <div class="cover">{cover_html}</div>
    <hr class="divider">
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">{label_name}</span>
        <span class="info-value">{name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">{label_phone}</span>
        <span class="info-value">{phone}</span>
      </div>
      <div class="info-row">
        <span class="info-label">{label_subject}</span>
        <span class="info-value">{job_title}</span>
      </div>
    </div>
  </div>
  <div class="footer">تم الإرسال عبر بوت التقديم الذكي</div>
</div>
</body>
</html>"""


def _html_formal(name: str, phone: str, job_title: str) -> str:
    return f"""
    <div dir="rtl" style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
      <h2 style="color: #333;">تقديم لوظيفة</h2>
      <p><strong>الوظيفة:</strong> {job_title}</p>
      <hr/>
      <p><strong>الاسم:</strong> {name}</p>
      <p><strong>رقم الجوال:</strong> {phone}</p>
      <p style="margin-top: 30px;">مع خالص التقدير،</p>
      <p>{name}</p>
    </div>
    """


def _html_normal(name: str, phone: str, job_title: str) -> str:
    return f"""
    <div dir="rtl" style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9;">
      <p>السلام عليكم،</p>
      <p>أقدم لكم طلبي للوظيفة المعلن عنها: <strong>{job_title}</strong>.</p>
      <p><strong>الاسم:</strong> {name}</p>
      <p><strong>الجوال:</strong> {phone}</p>
      <p>شكراً لكم.</p>
    </div>
    """


def _html_professional(name: str, phone: str, job_title: str) -> str:
    return f"""
    <div dir="rtl" style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 30px; border-left: 4px solid #1a5276;">
      <h1 style="color: #1a5276;">طلب توظيف</h1>
      <p>الوظيفة المستهدفة: <strong>{job_title}</strong></p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0;"><strong>الاسم الكامل:</strong></td><td>{name}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>رقم الاتصال:</strong></td><td>{phone}</td></tr>
      </table>
      <p style="margin-top: 24px;">أتطلع للانضمام لفريقكم.</p>
    </div>
    """


def get_preview_html(template_type: str, name: str, phone: str, job_title: str = "وظيفة تجريبية - معاينة") -> str:
    name = name or "الاسم"
    phone = phone or "رقم الجوال"
    if template_type == "formal":
        return _html_formal(name, phone, job_title)
    if template_type == "professional":
        return _html_professional(name, phone, job_title)
    return _html_normal(name, phone, job_title)


def build_application_html(
    name: str,
    phone: str,
    job_title: str,
    company: str,
    cover_letter: str,
    lang: str = "ar",
    template_type: str = "normal",
    cv_used_for_letter: bool = False,
) -> str:
    """
    بناء HTML التقديم بناءً على القالب الذي اختاره المستخدم.
    template_type: formal | normal | professional
    cv_used_for_letter: إذا True يُضاف سطر يوضح أن رسالة التغطية نُشئت من تحليل السيرة.
    """
    footer_note = ""
    if cv_used_for_letter:
        footer_note = (
            '<p style="margin-top:16px;font-size:12px;color:#666;">'
            + ("تم توليد رسالة التغطية أعلاه بناءً على تحليل السيرة الذاتية المرفقة." if lang == "ar" else "The cover letter above was generated from the attached CV.")
            + "</p>"
        )
    if template_type == "formal":
        base = _html_formal(name, phone, job_title)
        cover_html = cover_letter.replace("\n", "<br>") if cover_letter else ""
        direction = "rtl" if lang != "en" else "ltr"
        return f"""<!DOCTYPE html><html dir="{direction}"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px;">
<div style="border:1px solid #ddd;padding:20px;">
<h2 style="color:#333;">{"طلب توظيف" if lang=="ar" else "Job Application"} - {job_title}</h2>
<hr/>
<p style="line-height:1.8;">{cover_html}</p>
{footer_note}
<hr/>
<p><strong>{"الاسم" if lang=="ar" else "Name"}:</strong> {name}</p>
<p><strong>{"الجوال" if lang=="ar" else "Phone"}:</strong> {phone}</p>
</div></body></html>"""

    elif template_type == "professional":
        html = _html_professional_full(name, phone, job_title, company, cover_letter, lang)
        if footer_note:
            html = html.replace(
                "    <hr class=\"divider\">\n    <div class=\"info-box\">",
                footer_note + "\n    <hr class=\"divider\">\n    <div class=\"info-box\">",
            )
        return html

    else:  # normal
        cover_html = cover_letter.replace("\n", "<br>") if cover_letter else ""
        direction = "rtl" if lang != "en" else "ltr"
        return f"""<!DOCTYPE html><html dir="{direction}"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9;">
<div style="background:#fff;padding:24px;border-radius:8px;">
<p style="line-height:1.9;color:#2c2c2c;">{cover_html}</p>
{footer_note}
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
<p><strong>{"الاسم" if lang=="ar" else "Name"}:</strong> {name}</p>
<p><strong>{"الجوال" if lang=="ar" else "Phone"}:</strong> {phone}</p>
</div></body></html>"""


# مهلة الاتصال بـ SMTP (ثواني) — بيئات السحابة قد تكون أبطأ
SMTP_TIMEOUT = 60
# عدد المحاولات قبل الفشل (محاولة أولى + إعادة محاولتين)
SMTP_MAX_ATTEMPTS = 3
SMTP_RETRY_DELAY = 2


def is_smtp_network_error(exc: Exception) -> bool:
    """هل الخطأ ناتج عن عدم إمكانية الوصول لخوادم البريد (شبكة/منفذ مغلق)؟"""
    msg = (str(exc) or "").lower()
    errno = getattr(exc, "errno", None)
    if errno in (101, 111, 110, 113):  # unreachable, refused, timeout, no route
        return True
    if "network is unreachable" in msg or "errno 101" in msg:
        return True
    if "connection refused" in msg or "connection reset" in msg:
        return True
    if "timed out" in msg or "timeout" in msg:
        return True
    return False


# رسالة توجيهية عند منع الاستضافة لـ SMTP (تُستخدم في الإعدادات والتقديم التلقائي)
SMTP_NETWORK_ERROR_HINT = (
    "⚠️ لا يمكن إرسال البريد عبر Gmail SMTP من هذا السيرفر.\n\n"
    "DigitalOcean (ومزودات أخرى) تمنع منافذ SMTP 25 و465 و587 على الـ Droplets افتراضياً "
    "(سياسة ضد السبام). Railway قد تمنعها أيضاً.\n\n"
    "الحل: شغّل البوت من جهازك، أو VPS لا يحجب SMTP (مثل Hetzner)، "
    "أو لاحقاً Gmail API عبر HTTPS (منفذ 443) بدل SMTP."
)


def get_smtp_error_user_message(exc: Exception) -> str | None:
    """رسالة عربية توجيهية عند فشل الإرسال بسبب الشبكة/الاستضافة."""
    if not is_smtp_network_error(exc):
        return None
    return SMTP_NETWORK_ERROR_HINT


def _do_smtp_send_sync(
    sender_email: str,
    app_password: str,
    to_email: str,
    msg: MIMEMultipart,
) -> None:
    """تنفيذ إرسال واحدة (sync) عبر 465 أو 587 — للاستخدام عند عدم توفر aiosmtplib."""
    err_465 = None
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=SMTP_TIMEOUT) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, to_email, msg.as_string())
        return
    except OSError as e:
        err_465 = e
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=SMTP_TIMEOUT) as server:
            server.starttls()
            server.login(sender_email, app_password)
            server.sendmail(sender_email, to_email, msg.as_string())
    except Exception:
        if err_465 is not None:
            raise err_465
        raise


async def _do_smtp_send_async(
    sender_email: str,
    app_password: str,
    to_email: str,
    msg: MIMEMultipart,
) -> None:
    """تنفيذ إرسال واحدة عبر aiosmtplib (465 ثم 587)."""
    if aiosmtplib is None:
        await asyncio.to_thread(_do_smtp_send_sync, sender_email, app_password, to_email, msg)
        return
    try:
        smtp = aiosmtplib.SMTP(
            hostname="smtp.gmail.com",
            port=465,
            use_tls=True,
            timeout=SMTP_TIMEOUT,
        )
        async with smtp:
            await smtp.login(sender_email, app_password)
            await smtp.send_message(msg)
        return
    except Exception:
        pass
    smtp = aiosmtplib.SMTP(
        hostname="smtp.gmail.com",
        port=587,
        use_tls=False,
        timeout=SMTP_TIMEOUT,
    )
    async with smtp:
        await smtp.starttls()
        await smtp.login(sender_email, app_password)
        await smtp.send_message(msg)


def _build_smtp_message(
    sender_email: str,
    to_email: str,
    subject: str,
    html_body: str,
    attachment_bytes: bytes | None,
    attachment_filename: str | None,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    if attachment_bytes and attachment_filename:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(attachment_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
        msg.attach(part)
    return msg


async def send_email_smtp(
    sender_email: str,
    app_password: str,
    to_email: str,
    subject: str,
    html_body: str,
    attachment_bytes: bytes | None = None,
    attachment_filename: str | None = None,
) -> None:
    """الإرسال من إيميل المستخدم عبر Gmail SMTP (App Password) — async مع إعادة محاولة."""
    msg = _build_smtp_message(
        sender_email, to_email, subject, html_body,
        attachment_bytes, attachment_filename,
    )
    last_error = None
    for attempt in range(SMTP_MAX_ATTEMPTS):
        try:
            await _do_smtp_send_async(sender_email, app_password, to_email, msg)
            return
        except Exception as e:
            last_error = e
            if attempt < SMTP_MAX_ATTEMPTS - 1:
                await asyncio.sleep(SMTP_RETRY_DELAY)
    if last_error is not None:
        raise last_error


async def send_template_preview_email(bot, user: dict, settings: dict, template_key: str, chat_id: int) -> None:
    email = settings.get("email")
    app_password = settings.get("app_password_encrypted")
    if not email or not app_password:
        raise ValueError("لم يتم ربط الإيميل أو كلمة مرور التطبيق.")
    name = user.get("full_name") or "الاسم"
    phone = user.get("phone") or "رقم الجوال"
    job_fake = "وظيفة وهمية - معاينة القالب"
    html = get_preview_html(template_key, name, phone, job_fake)
    await send_email_smtp(
        sender_email=email,
        app_password=app_password,
        to_email=email,
        subject=f"معاينة قالب التقديم - {template_key}",
        html_body=html,
    )
