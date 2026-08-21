@echo off
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run_gui.py
    if errorlevel 1 (
        echo.
        echo The GUI closed with an error ^(see above^).
        pause
    )
) else (
    echo ============================================
    echo  Setup required
    echo ============================================
    echo No .venv found. Please run Setup.bat first,
    echo then run this file again.
    echo.
    pause
)
