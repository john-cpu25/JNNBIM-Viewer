@echo off
setlocal
cd /d "%~dp0"
echo === JNN BIM Viewer: push to GitHub ===
where git >nul 2>nul
if errorlevel 1 (
  echo [LOI] Chua cai Git. Tai tai https://git-scm.com/download/win roi chay lai file nay.
  pause
  exit /b 1
)

rem Move the Pages workflow into place (.github cannot be written remotely).
if exist "_setup\pages.yml" (
  if not exist ".github\workflows" mkdir ".github\workflows"
  move /y "_setup\pages.yml" ".github\workflows\pages.yml" >nul
  rmdir "_setup" 2>nul
)

if not exist ".git" git init -b main
git config user.name >nul 2>nul || git config user.name "nhannguyenthanh202594-cmyk"
git config user.email >nul 2>nul || git config user.email "nhan.nguyenthanh0894@gmail.com"

git add -A
git commit -m "M1 web viewer UI, M3-01/02 geometry core skeleton + AABB, TODO plan, Pages deploy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01N5xgqTnLEVptwmj43ZFriH"

git remote get-url origin >nul 2>nul || git remote add origin https://github.com/nhannguyenthanh202594-cmyk/JNNViewer.git
git branch -M main
echo.
echo Dang push... neu hien cua so dang nhap GitHub, hay dang nhap.
git push -u origin main
if errorlevel 1 (
  echo [LOI] Push that bai. Xem thong bao o tren.
) else (
  echo [OK] Da push len https://github.com/nhannguyenthanh202594-cmyk/JNNViewer
)
echo.
pause
