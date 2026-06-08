@echo off
title Jobbots Admin Server
cd /d "%~dp0admin_frontend"
echo [%date% %time%] Starting Jobbots Admin Server on http://localhost:5000...
node server.js
pause