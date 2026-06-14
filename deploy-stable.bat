@echo off
cd /d "%~dp0"
echo ===== Reverting to stable-v2 =====
git checkout stable-v2
call npx vite build
echo ===== Deploying to GitHub Pages =====
set TMP=%TEMP%\finalyze_deploy
if exist "%TMP%" rmdir /s /q "%TMP%"
xcopy /e /i "dist" "%TMP%"
cd /d "%TMP%"
git init
git config user.email "taybekraa@gmail.com"
git config user.name "taybekraa"
git add -A
git commit -m "deploy stable-v2"
git remote add origin https://github.com/kraa1981t/finalyze-ai.git
git push -f origin HEAD:gh-pages
echo ===== Done! Stable-v2 deployed. =====
pause
