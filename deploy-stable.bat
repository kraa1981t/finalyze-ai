@echo off
cd /d "%~dp0"
echo ===== Reverting to stable-v3 =====
git checkout stable-v3
call npx vite build
echo ===== Deploying to GitHub Pages =====
set TMP=%TEMP%\finalyze_deploy
if exist "%TMP%" rmdir /s /q "%TMP%"
xcopy /e /i "dist" "%TMP%"
cd /d "%TMP%"
git init
git config user.email "taybekraa@gmail.com"
git config user.name "kraa1981t"
git add -A
git commit -m "deploy stable-v3"
git remote add origin https://github.com/kraa1981t/finalyze-ai.git
git push -f origin HEAD:gh-pages
echo ===== Done! Stable-v3 deployed. =====
pause
