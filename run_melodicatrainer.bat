@echo off
TITLE MelodicaTrainer Runner
SETLOCAL

cd /d "%~dp0"

echo ========================================
echo   MelodicaTrainer: Application Launch
echo ========================================

where npm >nul 2>nul
IF ERRORLEVEL 1 (
    echo [ERROR] npm was not found. Install Node.js first.
    pause
    exit /b 1
)

:: Checking node_modules
IF NOT EXIST "node_modules\" (
    echo [INFO] Folder node_modules was not found. Installing dependencies...
    IF EXIST "package-lock.json" (
        call npm ci
    ) ELSE (
        call npm install
    )
    IF ERRORLEVEL 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
) ELSE (
    echo [INFO] Dependencies already installed.
)

echo [INFO] Launching dev server...
echo [HINT] The app will open at the Melodica screen.

:: Vite launch and automatic browser launch
call npm run dev -- --open /MelodicaTrainer/#/melodica

pause
