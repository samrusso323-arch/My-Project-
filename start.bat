@echo off
REM Double-click this file to start Speed Map Builder (Windows).
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python isn't installed. Get it from https://www.python.org/downloads/
    echo IMPORTANT: on the install screen, check the box "Add python.exe to PATH".
    echo Then double-click this file again.
    pause
    exit /b 1
)

echo Setting up (first run only takes a minute)...
python -m pip install --quiet -r requirements.txt

echo Starting Speed Map Builder...
start "" cmd /c "timeout /t 2 >nul & start http://localhost:5000"

echo.
echo Speed Map Builder is running. Your browser should open automatically.
echo If not, go to: http://localhost:5000
echo.
echo Leave this window open while you use the app. Close it to stop.
echo.

python app.py
