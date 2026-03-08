# -*- coding: utf-8 -*-
from .start import setup_start_handlers
from .main_menu import setup_main_menu_handlers
from .applications import setup_applications_handlers
from .account import setup_account_handlers
from .settings import setup_settings_handlers
from .admin import setup_admin_handlers

def setup_all_handlers(application):
    # الإعدادات وربط الإيميل أولاً حتى لا تُسرق الرسائل النصية من محادثة التسجيل (كود التفعيل)
    setup_settings_handlers(application)
    setup_admin_handlers(application)  # /admin للأدمن فقط
    setup_main_menu_handlers(application)  # يجب قبل applications لأن reply keyboard handler هنا
    setup_applications_handlers(application)
    setup_account_handlers(application)
    setup_start_handlers(application)
