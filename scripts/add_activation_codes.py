# -*- coding: utf-8 -*-
"""
توليد 200 كود تفعيل (7 أرقام + حرفين) وإضافتها في جدول activation_codes.
تشغيل: من مجلد المشروع: python -m scripts.add_activation_codes
أو: python scripts/add_activation_codes.py
"""
import random
import string
import sys
import os

# إضافة جذر المشروع للمسار
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from database.db import insert_activation_codes


def generate_code() -> str:
    """كود واحد: 7 أرقام + حرفين (إنجليزي كبير)."""
    digits = "".join(random.choices(string.digits, k=7))
    letters = "".join(random.choices(string.ascii_uppercase, k=2))
    return digits + letters


def generate_unique_codes(count: int = 200) -> list[str]:
    seen = set()
    codes = []
    while len(codes) < count:
        code = generate_code()
        if code not in seen:
            seen.add(code)
            codes.append(code)
    return codes


def main():
    import argparse
    p = argparse.ArgumentParser(description="توليد أكواد تفعيل وإضافتها في Supabase")
    p.add_argument("-n", "--count", type=int, default=200, help="عدد الأكواد (افتراضي: 200)")
    p.add_argument("-d", "--days", type=int, default=30, help="أيام الاشتراك لكل كود (365 = سنة)")
    args = p.parse_args()
    subscription_days = args.days
    count = args.count

    print(f"جاري توليد {count} كود تفعيل (7 أرقام + حرفين، اشتراك {subscription_days} يوم)...")
    codes = generate_unique_codes(count)

    rows = [
        {"code": code, "subscription_days": subscription_days}
        for code in codes
    ]

    print("جاري الإدراج في قاعدة البيانات...")
    inserted = insert_activation_codes(rows)
    print(f"تم إضافة {inserted} كود تفعيل بنجاح.")

    # عرض عينة من الأكواد
    print("\nعينة من الأكواد المضافة:")
    for c in codes[:10]:
        print(f"  {c}")
    print("  ...")


if __name__ == "__main__":
    main()
