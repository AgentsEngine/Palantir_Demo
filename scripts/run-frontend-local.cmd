@echo off
set "ROOT=%~dp0.."
if not exist "%ROOT%\runtime-logs" mkdir "%ROOT%\runtime-logs"
pushd "%ROOT%\frontend"
"%ROOT%\frontend\node_modules\.bin\vite.cmd" --host 127.0.0.1 >> "%ROOT%\runtime-logs\frontend.log" 2>> "%ROOT%\runtime-logs\frontend.err.log"
popd
