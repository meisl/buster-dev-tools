@IF EXIST "%~dp0"\"node.exe" (
  "%~dp0"\"node.exe"  "%~dp0\run-tests-in-affected" %*
) ELSE (
  node "%~dp0\run-tests-in-affected" %*
)