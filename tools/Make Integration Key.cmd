@echo off
rem Prints a fresh INTEGRATION_KEY.
rem
rem 32 random bytes as hex: 64 characters, digits and a-f only. Generated
rem rather than invented, and hex rather than base64 so it cannot contain a
rem character that needs escaping or a break that survives a paste.

title Opservor - new INTEGRATION_KEY

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node is not installed, or Windows cannot find it.
  echo.
  pause
  exit /b 1
)

echo.
echo   Your new INTEGRATION_KEY
echo   ------------------------------------------------------------
echo.

node -e "console.log('   ' + require('crypto').randomBytes(32).toString('hex'))"

echo.
echo   ------------------------------------------------------------
echo   Select the line above, right-click to copy, and paste it into
echo   Vercel as the value of INTEGRATION_KEY.
echo.
echo   It is new. It is not any of the Zoho or Supabase values.
echo   Do not put it in a document or a chat.
echo.
pause
