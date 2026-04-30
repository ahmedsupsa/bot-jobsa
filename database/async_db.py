# -*- coding: utf-8 -*-
"""
تشغيل دوال db المزامنة في خلفية (thread) حتى لا تُبطئ العمليات.
"""
import asyncio
from database import db


def run_sync(func, *args, **kwargs):
    """تشغيل دالة مزامنة في خلفية وإرجاع النتيجة."""
    return asyncio.to_thread(func, *args, **kwargs)
