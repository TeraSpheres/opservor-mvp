@echo off
rem Replaces INTEGRATION_KEY in Vercel production, without it passing through
rem a clipboard.
rem
rem The value has been set by hand twice and arrived wrong both times: once
rem carrying a line break that nothing displayed, and once, apparently, empty.
rem Both look identical in a dashboard that hides the value. Generating it and
rem piping it straight to Vercel removes the step where it kept going wrong.
rem
rem Nothing is printed, so the key exists only in Vercel.

title Opservor - set INTEGRATION_KEY

cd /d "%~dp0.."

echo.
echo   Set INTEGRATION_KEY in Vercel (production)
echo   ------------------------------------------------------------
echo.
echo   This removes the current value and writes a fresh one.
echo   Nothing is displayed and nothing is copied.
echo.
echo   Safe to stop: press Ctrl+C now, or any key to continue.
echo.
pause >nul

echo   Removing the current value...
call npx.cmd vercel env rm INTEGRATION_KEY production --yes
if errorlevel 1 (
  echo.
  echo   Could not remove it. Nothing has been changed.
  echo   If it says the variable was not found, that is the whole problem --
  echo   carry on and the next step will create it.
  echo.
)

echo.
echo   Writing a new one...
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | call npx.cmd vercel env add INTEGRATION_KEY production
if errorlevel 1 (
  echo.
  echo   That did not work. INTEGRATION_KEY may now be missing.
  echo   Add it again in the Vercel dashboard, or run this once more.
  echo.
  pause
  exit /b 1
)

echo.
echo   ------------------------------------------------------------
echo   Done. Now confirming what Vercel actually holds:
echo.

call npx.cmd vercel env ls production

echo.
echo   INTEGRATION_KEY should be listed above.
echo.
echo   A deployment fixes its environment at build time, so this does
echo   not reach the live site until the next build. Tell Claude and
echo   it will push one.
echo.
pause
