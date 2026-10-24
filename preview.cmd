@echo off
rem Double-click to preview Cipher in the browser. Keep the window open while viewing.
cd /d "%~dp0"
python tools\serve.py
pause
