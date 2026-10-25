@echo off
setlocal
cd /d "%~dp0"
echo === Push JNN-BIM-Viewer to john-cpu25/JNNBIM-Viewer (replace main) ===
where git >nul 2>nul || (echo [LOI] Chua cai Git. & pause & exit /b 1)

if exist "fix-push.cmd" del /q "fix-push.cmd"
git add -A
git diff --cached --quiet || git commit -q -m "Remove helper script" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

git remote get-url origin >nul 2>nul && git remote remove origin
git remote add origin https://john-cpu25@github.com/john-cpu25/JNNBIM-Viewer.git

echo.
echo [1/3] Tai main cu tu GitHub...
git fetch origin main || (echo [LOI] Khong fetch duoc. & pause & exit /b 1)

echo [2/3] Luu code cu vao nhanh archive/old-main (de khoi phuc neu can)...
git push origin refs/remotes/origin/main:refs/heads/archive/old-main || (echo [LOI] Khong tao duoc nhanh backup - dung lai, chua xoa gi. & pause & exit /b 1)

echo [3/3] Thay main bang code moi...
git push --force -u origin main
if errorlevel 1 (
  echo [LOI] Push that bai. Chup man hinh gui lai cho Claude.
) else (
  echo [OK] main da duoc thay bang code moi. Code cu nam o nhanh archive/old-main.
  echo      https://github.com/john-cpu25/JNNBIM-Viewer
)
echo.
pause
