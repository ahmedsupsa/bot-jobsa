@echo off
title Jobbots Telegram Listener
cd /d "%~dp0"
echo [%date% %time%] Starting Jobbots Telegram Listener...
python worker/telegram_listener.py
echo.
echo Listener stopped. Press any key to exit.
pause >nul
