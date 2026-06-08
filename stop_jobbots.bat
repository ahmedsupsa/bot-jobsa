@echo off
title Jobbots — إيقاف الخدمات
cd /d "%~dp0"
echo ==============================================
echo   Jobbots — إيقاف جميع الخدمات
echo ==============================================
echo.

:: إيقاف سيرفر Node.js (Admin Server)
echo [1/2] إيقاف سيرفر الإدارة...
taskkill /fi "WINDOWTITLE eq Admin Server" /f >nul 2>&1

:: إيقاف مستمع تليجرام
echo [2/2] إيقاف مستمع تليجرام...
taskkill /fi "WINDOWTITLE eq Telegram Listener" /f >nul 2>&1

echo.
echo تم إيقاف جميع الخدمات.
echo.
pause
