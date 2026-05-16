@echo off
cd /d "%~dp0"
echo ====================================================
echo    FINALYZER AI - AUTO-REPAIR & DEPLOY v4.0
echo ====================================================
echo.

if not exist .git (
    echo [!] Initializing connection...
    git init
    git remote add origin https://github.com/kraa1981t/finalyze-ai.git
) else (
    git remote set-url origin https://github.com/kraa1981t/finalyze-ai.git
)

echo Preparing latest updates (Crypto Accuracy + 24/7 Fixes)...
git add .
git commit -m "🚀 FINAL DEPLOY: Institutional v4.0 - High Precision & 24/7 Market Sync"
echo.
echo ----------------------------------------------------
echo IMPORTANT: A GitHub login window may pop up now.
echo Please SIGN IN to complete the update to v4.0.
echo ----------------------------------------------------
echo.
git push -u origin main --force
echo.
echo === DEPLOYMENT COMPLETE ===
echo Your site is now live at: https://finalyze-ai-sigma.vercel.app
pause
