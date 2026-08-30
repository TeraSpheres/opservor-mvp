@echo off
rem Double-clickable wrapper for zoho-refresh-token.js.
rem
rem The exchange is one command, but "open a terminal and change directory"
rem is a real barrier for someone who does not live in one. This opens its
rem own window, starts in the right folder whatever folder it was launched
rem from, and stays open at the end so the token can be read and copied.

title Opservor - Zoho refresh token

rem %~dp0 is this file's own folder (tools\), so .. is the project root.
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node is not installed, or Windows cannot find it.
  echo   Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

node "tools\zoho-refresh-token.js"

echo.
echo   ------------------------------------------------------------
echo   Copy the refresh token above, then close this window.
echo   ------------------------------------------------------------
echo.
pause
