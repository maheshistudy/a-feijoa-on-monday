@echo off
rem Start the local test server without changing the machine's PowerShell execution policy.
rem Double-click this file, or run:  tools\serve.cmd
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*