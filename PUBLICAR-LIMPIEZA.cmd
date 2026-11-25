@echo off
setlocal
cd /d "%~dp0"
set "GIT_CONFIG_COUNT=2"
set "GIT_CONFIG_KEY_0=safe.directory"
set "GIT_CONFIG_VALUE_0=%CD:\=/%"
set "GIT_CONFIG_KEY_1=http.sslBackend"
set "GIT_CONFIG_VALUE_1=openssl"
set "BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not "%BRANCH%"=="testing" goto failed
git rev-parse -q --verify MERGE_HEAD >nul 2>&1
if not errorlevel 1 goto failed
git fetch origin testing
if errorlevel 1 goto failed
rem Guarda las eliminaciones y conserva los creditos del contenido.
git add -u -- "*.md"
if errorlevel 1 goto failed
git add -- ATRIBUCIONES.txt PUBLICAR-LIMPIEZA.cmd
if errorlevel 1 goto failed
git diff --cached --quiet
if errorlevel 1 (
 git commit -m "Elimina archivos markdown y conserva las atribuciones del contenido"
 if errorlevel 1 goto failed
)
git merge --no-edit -m "Integra los cambios remotos de testing" origin/testing
if errorlevel 1 goto failed
call npm run db:validate
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
call npm test --prefix tools/lector-dados
if errorlevel 1 goto failed
git ls-files "*.md" | findstr . >nul
if not errorlevel 1 goto failed
git push origin testing:testing
if errorlevel 1 goto failed
echo LIMPIEZA PUBLICADA EN testing.
goto end
:failed
echo No se completo la publicacion. Copia el error anterior para revisarlo.
:end
pause
