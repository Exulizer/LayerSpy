@echo off
title LayerSpy - 3D Printing G-Code Analyzer
echo ========================================================
echo   LayerSpy - Professional G-Code Analyzer & Simulator
echo ========================================================
echo.
echo Starting LayerSpy...
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Node.js detected. Starting local server...
    start "" http://localhost:3000
    npx serve -l 3000 .
) else (
    echo [INFO] Opening directly in default web browser...
    start "" index.html
)
