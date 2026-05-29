@echo off
set "ROOT=%~dp0.."
if not exist "%ROOT%\runtime-logs" mkdir "%ROOT%\runtime-logs"
pushd "%ROOT%\backend"
"%ROOT%\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >> "%ROOT%\runtime-logs\backend.log" 2>> "%ROOT%\runtime-logs\backend.err.log"
popd
