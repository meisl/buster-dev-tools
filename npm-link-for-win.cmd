@echo off
:: Windows way of getting stdout into a variable:
REM FOR /F "tokens=*" %%i in ('cd') do SET CWD=%%i

IF EXIST "%~dp0"\"node.exe" (
  "%~dp0"\"node.exe"  "%~dp0\npm-link-for-win.js" %*
) ELSE (
  node  "%~dp0\npm-link-for-win.js" %*
)

REM ECHO current working dir: %CWD%
REM ECHO path to this batch: %~dp0