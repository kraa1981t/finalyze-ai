# ============================================================
#  SAFEGUARD.BAT  —  تحصين البناء قبل كل رفع
#  الاستخدام:  safeguard.bat
#  يفعل: (1) فحص أنواع TypeScript  (2) بناء الإنتاج
#        (3) يخبرك بنتيجة واحدة: SAFE_TO_PUSH أو FAILED
#  الهدف: لا يُرفع أي كود إلى GitHub قبل أن يجتاز هذين الفحصين.
# ============================================================
@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ============================================
echo   SAFEGUARD  --  build verification
echo ============================================
echo.

echo [1/2] TypeScript type-check  (npx tsc --noEmit) ...
call npx tsc --noEmit
if errorlevel 1 (
  echo.
  echo   X  TYPE ERRORS FOUND  --  DO NOT PUSH
  echo.
  exit /b 1
)
echo   OK  --  types clean

echo.
echo [2/2] Production build  (npm run build) ...
call npm run build
if errorlevel 1 (
  echo.
  echo   X  BUILD FAILED  --  DO NOT PUSH
  echo.
  exit /b 1
)
echo   OK  --  build produced

echo.
echo ============================================
echo   SAFE_TO_PUSH   (types + build both pass)
echo   Next step:  git add -A  ^&^&  git commit  ^&^&  git push
echo ============================================
echo.
endlocal
