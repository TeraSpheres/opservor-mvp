@echo off
rem Tests the Zoho values against Zoho, from this machine.
rem
rem The Connections screen can only report that something was refused. This
rem says which step refused it: the sign-in, the organisation, or the items.
rem That distinction is the difference between a wrong secret, a wrong region
rem and a stale deployment, all of which look identical in a red box.

title Opservor - check Zoho connection

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node is not installed, or Windows cannot find it.
  echo.
  pause
  exit /b 1
)

node "tools\zoho-check-connection.js"

echo.
pause
