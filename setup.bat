@echo off
REM Setup script for Pillama (Windows)

echo ==========================================
echo Pillama Setup Script
echo ==========================================
echo.

REM Check Node.js
echo Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js 16+ from https://nodejs.org
    exit /b 1
)
node --version
echo ✓ Node.js installed

REM Check npm
echo Checking npm...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed
    exit /b 1
)
npm --version
echo ✓ npm installed

REM Check Python
echo Checking Python...
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed
    echo Please install Python 3.8+ from https://python.org
    exit /b 1
)
python --version
echo ✓ Python installed

REM Check pip
echo Checking pip...
where pip >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pip is not installed
    exit /b 1
)
echo ✓ pip installed

echo.
echo Installing Node.js dependencies...
call npm install

echo.
echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Testing hailo-platform...
python test_hailo.py

echo.
echo Creating models directory...
if not exist models mkdir models

echo.
echo ==========================================
echo Setup Complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Place your .hef model files in the models\ directory
echo   2. Update config.json with your model paths
echo   3. Start the Python service: python python_service\hailo_service.py
echo   4. Start the Express server: npm start
echo   5. Test the API: python test_api.py
echo.
echo For more information, see README.md
echo.

pause
