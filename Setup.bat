@echo off
cd /d "%~dp0"

echo ============================================
echo  Research Paper Extractor - one-time setup
echo ============================================
echo.

echo [1/3] Creating virtual environment (.venv)...
python -m venv .venv
if errorlevel 1 (
    echo.
    echo ERROR: Could not create the virtual environment.
    echo Make sure Python is installed and on your PATH, then try again.
    pause
    exit /b 1
)

echo.
echo [2/3] Installing pipeline dependencies (requirements.txt)...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: Failed to install requirements.txt. See the messages above.
    pause
    exit /b 1
)

echo.
echo [3/3] Installing GUI dependencies (requirements-gui.txt)...
".venv\Scripts\python.exe" -m pip install -r requirements-gui.txt
if errorlevel 1 (
    echo.
    echo ERROR: Failed to install requirements-gui.txt. See the messages above.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Setup complete. You can now run Start GUI.bat
echo ============================================
pause
