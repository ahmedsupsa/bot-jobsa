# -*- coding: utf-8 -*-
import logging
import warnings
from datetime import datetime, timezone, timedelta
from telegram.ext import Application, ContextTypes
from telegram.error import Conflict, BadRequest

import config
from handlers import setup_all_handlers

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

warnings.filterwarnings("ignore", message=".*per_message.*", category=UserWarning)

_last_conflict_log = 0


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    import time
    global _last_conflict_log
    err = context.error
    if isinstance(err, Conflict):
        now = time.time()
        if now - _last_conflict_log > 60:
            _last_conflict_log = now
            logger.warning("تعارض: نسخة أخرى من البوت تعمل.")
        return
    if isinstance(err, BadRequest) and "message is not modified" in str(err).lower():
        return
    logger.exception("خطأ أثناء معالجة التحديث: %s", err)


async def auto_apply_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    """مهمة دورية: تُشغَّل تلقائياً كل 30 دقيقة للتقديم على الوظائف الجديدة."""
    from services.auto_apply import run_auto_apply_cycle
    logger.info("⏰ بدء دورة التقديم التلقائي...")
    try:
        await run_auto_apply_cycle(context.bot)
        logger.info("✅ انتهت دورة التقديم التلقائي.")
    except Exception as e:
        logger.error("❌ خطأ في دورة التقديم التلقائي: %s", e)
    # تخزين موعد الدورة القادمة لعرضه للمستخدم (رسالة مفاجأة)
    now = datetime.now(timezone.utc)
    context.bot_data["next_auto_apply_at"] = now + timedelta(seconds=1800)


def main():
    app = Application.builder().token(config.BOT_TOKEN).build()
    setup_all_handlers(app)
    app.add_error_handler(error_handler)

    # Scheduler: تقديم تلقائي كل 30 دقيقة
    job_queue = app.job_queue
    if job_queue:
        # تعيين موعد الدورة القادمة (أول تشغيل بعد دقيقتين) لرسالة "سيتم التقديم خلال X دقيقة"
        app.bot_data["next_auto_apply_at"] = datetime.now(timezone.utc) + timedelta(seconds=120)
        job_queue.run_repeating(
            auto_apply_job,
            interval=1800,   # كل 30 دقيقة
            first=120,        # أول تشغيل بعد دقيقتين من البدء
            name="auto_apply_cycle",
        )
        logger.info("📅 Scheduler مُفعَّل: تقديم تلقائي كل 30 دقيقة.")
        if getattr(config, "GEMINI_API_KEY", ""):
            logger.info("🔑 GEMINI_API_KEY معرّف — التقديم التلقائي يستخدم جيميني لرسالة التغطية وقراءة السيرة (PDF/صور).")
        else:
            logger.warning("⚠️ GEMINI_API_KEY غير معرّف — التقديم التلقائي سيعمل برسالة عامة فقط (بدون جيميني).")
    else:
        logger.warning("⚠️ job_queue غير متوفر، التقديم التلقائي لن يعمل.")

    allowed = ["message", "callback_query"]
    if getattr(config, "JOBS_SOURCE_CHANNEL_ID", None):
        allowed.append("channel_post")
    if config.USE_WEBHOOK:
        full_url = f"{config.WEBHOOK_URL}/{config.WEBHOOK_PATH}"
        logger.info("البوت يعمل بوضع Webhook على %s", full_url)
        app.run_webhook(
            listen=config.WEBHOOK_LISTEN,
            port=config.WEBHOOK_PORT,
            url_path=config.WEBHOOK_PATH,
            webhook_url=full_url,
            allowed_updates=allowed,
            drop_pending_updates=True,
        )
    else:
        logger.info("البوت يعمل بوضع Polling...")
        app.run_polling(
            allowed_updates=allowed,
            drop_pending_updates=True,
        )


if __name__ == "__main__":
    main()
