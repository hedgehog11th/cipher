@echo off
rem Double-click after adding or changing question files: checks them and rebuilds data\index.json.
cd /d "%~dp0"
python tools\build_data.py
pause
