@echo off
chcp 65001 >nul 2>&1
title IPTV Stremio Addon
color 0B
cd /d "%~dp0"

:: ─────────────────────────────────────────────
::  Check prerequisites
:: ─────────────────────────────────────────────
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo  ╔══════════════════════════════════════════════╗
    echo  ║   Node.js is NOT installed on this PC!       ║
    echo  ║                                              ║
    echo  ║   Download it from:                          ║
    echo  ║   https://nodejs.org/                        ║
    echo  ║                                              ║
    echo  ║   Install it, restart your PC, then try      ║
    echo  ║   double-clicking this file again.           ║
    echo  ╚══════════════════════════════════════════════╝
    echo.
    pause
    exit /b
)

:: ─────────────────────────────────────────────
::  Read PORT from .env (default 7000)
:: ─────────────────────────────────────────────
set SERVER_PORT=7000
if exist ".env" (
    for /f "tokens=1,* delims==" %%A in ('findstr /B "PORT=" ".env"') do (
        set "SERVER_PORT=%%B"
    )
)

:: ─────────────────────────────────────────────
::  Check if the server is already running
:: ─────────────────────────────────────────────
netstat -ano 2>nul | findstr ":%SERVER_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
    goto :ALREADY_RUNNING
) else (
    goto :START_SERVER
)

:: ─────────────────────────────────────────────
::  START SERVER
:: ─────────────────────────────────────────────
:START_SERVER
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║       IPTV Stremio Addon - Starting...       ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo  [*] First time setup - installing dependencies...
    echo      This may take a minute...
    echo.
    npm install --production >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo  [!] Failed to install dependencies.
        echo      Try running "npm install" manually in this folder.
        echo.
        pause
        exit /b
    )
    echo  [OK] Dependencies installed.
    echo.
)

echo  [*] Starting server on port %SERVER_PORT%...
echo.

:: Start the server in a hidden minimized window
start "IPTV-Addon-Server" /MIN cmd /c "cd /d "%~dp0" && node server.js"

:: Wait a few seconds for the server to boot
set RETRIES=0
:WAIT_LOOP
timeout /t 2 /nobreak >nul
set /a RETRIES+=1
netstat -ano 2>nul | findstr ":%SERVER_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 goto :SERVER_OK
if %RETRIES% LSS 5 goto :WAIT_LOOP

:: If we get here, server didn't start in time
color 0C
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  [!] Server failed to start.                 ║
echo  ║                                              ║
echo  ║  Check that port %SERVER_PORT% is not in use         ║
echo  ║  or look for errors in the minimized window. ║
echo  ╚══════════════════════════════════════════════╝
echo.
pause
exit /b

:SERVER_OK
cls
color 0A
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║     IPTV Stremio Addon is now RUNNING!       ║
echo  ║                                              ║
echo  ╠══════════════════════════════════════════════╣
echo  ║                                              ║
echo  ║  Open Stremio, go to Addons, and paste:      ║
echo  ║                                              ║
echo  ║    http://localhost:%SERVER_PORT%                     ║
echo  ║                                              ║
echo  ║  To configure the addon open your browser:   ║
echo  ║                                              ║
echo  ║    http://localhost:%SERVER_PORT%                     ║
echo  ║                                              ║
echo  ╠══════════════════════════════════════════════╣
echo  ║                                              ║
echo  ║  The server runs in the background.          ║
echo  ║  Double-click this file again to stop it.    ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  This window will close in 10 seconds...
timeout /t 10 /nobreak >nul
exit

:: ─────────────────────────────────────────────
::  SERVER ALREADY RUNNING
:: ─────────────────────────────────────────────
:ALREADY_RUNNING
cls
color 0E
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║   Server is already running on port %SERVER_PORT%!    ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  What would you like to do?
echo.
echo    [1] Stop the server
echo    [2] Keep it running (exit)
echo.
choice /C 12 /N /M "  Enter your choice (1 or 2): "

if %ERRORLEVEL%==1 goto :STOP_SERVER
if %ERRORLEVEL%==2 goto :KEEP_RUNNING

:STOP_SERVER
echo.
echo  [*] Stopping server...

:: Find and kill the process on the port
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":%SERVER_PORT% " ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)

:: Small wait then verify
timeout /t 2 /nobreak >nul
netstat -ano 2>nul | findstr ":%SERVER_PORT% " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
    color 0C
    echo  [!] Could not stop the server. Try ending "node.exe" in Task Manager.
    pause
    exit /b
) else (
    color 0A
    echo.
    echo  ╔══════════════════════════════════════════════╗
    echo  ║                                              ║
    echo  ║      Server stopped successfully!            ║
    echo  ║                                              ║
    echo  ╚══════════════════════════════════════════════╝
    echo.
    echo  This window will close in 5 seconds...
    timeout /t 5 /nobreak >nul
)
exit

:KEEP_RUNNING
echo.
echo  Server is still running. Closing...
timeout /t 3 /nobreak >nul
exit
