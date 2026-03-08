# -*- coding: utf-8 -*-
"""
تحليل السيرة الذاتية وتوليد رسالة تغطية احترافية ومختصرة وصادقة.
"""
import os
import io
from dotenv import load_dotenv

load_dotenv()


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """استخراج النص من ملف PDF."""
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()
    except ImportError:
        pass
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text.strip()
    except Exception:
        pass
    return ""


def analyze_cv_and_generate_letter(
    job_title: str,
    applicant_name: str,
    company: str = "",
    job_description: str = "",
    lang: str = "ar",
    cv_text: str = "",
) -> str:
    """
    يحلل السيرة الذاتية ويكتب رسالة تغطية مختصرة وصادقة ومهنية.
    - يستخرج المهارات والخبرات الحقيقية من السيرة
    - لا يدّعي خبرات غير موجودة
    - إذا لا توجد خبرة مباشرة يبرز المهارات القابلة للنقل
    - الرسالة قصيرة: فقرة إلى فقرتين كحد أقصى
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _fallback_cover(job_title, applicant_name, company, lang)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        has_cv = cv_text and len(cv_text.strip()) > 80

        if lang == "ar":
            if has_cv:
                prompt = f"""أنت خبير في كتابة رسائل التقديم الوظيفي الاحترافية.

مهمتك: اكتب رسالة تقديم مختصرة وصادقة ومهنية بالعربية.

**معلومات الوظيفة:**
- المسمى الوظيفي: {job_title}
{"- الشركة: " + company if company else ""}
{"- وصف الوظيفة: " + job_description[:400] if job_description else ""}

**معلومات المتقدم:**
- الاسم: {applicant_name}

**السيرة الذاتية:**
{cv_text[:2500]}

**قواعد صارمة يجب الالتزام بها:**
1. استخرج فقط المهارات والخبرات الحقيقية الموجودة في السيرة
2. لا تختلق أو تضخم أي خبرة غير موجودة
3. إذا لم تكن هناك خبرة مباشرة في المجال، أبرز المهارات القابلة للنقل بصدق
4. الرسالة يجب أن تكون فقرة واحدة أو فقرتين كحد أقصى
5. أسلوب مهني ومباشر بدون حشو أو كلام فارغ
6. ابدأ بـ "السلام عليكم" وانهِ بالشكر والاسم فقط
7. لا تضع أي عناوين أو نقاط أو formatting

اكتب الرسالة الآن:"""
            else:
                prompt = f"""اكتب رسالة تقديم مهنية ومختصرة بالعربية لشخص يتقدم لوظيفة:
- المسمى الوظيفي: {job_title}
{"- الشركة: " + company if company else ""}
- اسم المتقدم: {applicant_name}

القواعد:
- فقرة واحدة فقط، مهنية ومباشرة
- لا تدّعِ خبرات محددة غير معروفة
- ابدأ بـ "السلام عليكم" وانهِ بالاسم
- بدون أي formatting أو نقاط"""
        else:
            if has_cv:
                prompt = f"""You are an expert professional cover letter writer.

Task: Write a SHORT, HONEST, and PROFESSIONAL cover letter in English.

**Job Information:**
- Job Title: {job_title}
{"- Company: " + company if company else ""}
{"- Job Description: " + job_description[:400] if job_description else ""}

**Applicant:** {applicant_name}

**CV Content:**
{cv_text[:2500]}

**Strict Rules:**
1. Extract ONLY real skills and experiences from the CV
2. Never fabricate or exaggerate any experience
3. If no direct experience, highlight transferable skills honestly
4. Maximum 1-2 short paragraphs
5. Professional and direct, no filler words
6. Start with "Dear Hiring Manager," end with name only
7. No headers, bullets, or markdown formatting

Write the letter now:"""
            else:
                prompt = f"""Write a short professional cover letter in English:
- Job Title: {job_title}
{"- Company: " + company if company else ""}
- Applicant: {applicant_name}

Rules:
- One paragraph only, professional and direct
- No false claims about experience
- Start with "Dear Hiring Manager," end with name
- No formatting"""

        response = model.generate_content(prompt)
        if response and response.text:
            return response.text.strip()
    except Exception:
        pass

    return _fallback_cover(job_title, applicant_name, company, lang)


def generate_cover_letter(
    job_title: str,
    applicant_name: str,
    company: str = "",
    job_description_snippet: str = "",
    lang: str = "ar",
    cv_text: str = "",
) -> str:
    """واجهة موحدة لتوليد رسالة التغطية."""
    return analyze_cv_and_generate_letter(
        job_title=job_title,
        applicant_name=applicant_name,
        company=company,
        job_description=job_description_snippet,
        lang=lang,
        cv_text=cv_text,
    )


def _fallback_cover(job_title: str, applicant_name: str, company: str = "", lang: str = "ar") -> str:
    if lang == "en":
        co = f" at {company}" if company else ""
        return (
            f"Dear Hiring Manager,\n\n"
            f"I am writing to express my interest in the {job_title} position{co}. "
            f"I believe my background makes me a suitable candidate for this role. "
            f"I would welcome the opportunity to discuss my qualifications further.\n\n"
            f"Thank you for your consideration.\n{applicant_name}"
        )
    co = f" في {company}" if company else ""
    return (
        f"السلام عليكم،\n\n"
        f"أتقدم بطلبي للنظر في وظيفة «{job_title}»{co}. "
        f"أثق بأن مؤهلاتي وخبراتي تجعلني مرشحاً مناسباً لهذا الدور، "
        f"وأتطلع لمناقشة كيف يمكنني إضافة قيمة لفريقكم.\n\n"
        f"شكراً لكم،\n{applicant_name}"
    )
