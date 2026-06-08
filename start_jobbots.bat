@echo off
title Jobbots — جميع الخدمات
cd /d "%~dp0"
echo ==============================================
echo   Jobbots — تشغيل جميع الخدمات
echo ==============================================
echo.

:: قتل أي عملية سابقة على port 5000
echo [0/2] تنظيف port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTEN') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: تشغيل مستمع تليجرام (نافذة مصغّرة بالخلفية)
echo [1/2] تشغيل مستمع تليجرام...
start /min "Telegram Listener" cmd /c "python worker/telegram_listener.py"

:: تشغيل سيرفر الإدارة
echo [2/2] تشغيل سيرفر الإدارة...
start "Admin Server" cmd /c "cd /d admin_frontend && node server.js"

echo.
echo تم تشغيل جميع الخدمات بنجاح!
echo.
echo لوحة الإدارة: http://localhost:5000/admin/login
echo.
pause
