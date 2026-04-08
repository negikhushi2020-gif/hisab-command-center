@echo off
title Hisab Business Dashboard

cd /d "c:\Users\Office Agile\Desktop\hisab"

echo.
echo  ============================================
echo    Hisab Business Dashboard
echo  ============================================
echo.
echo  Server starting... please wait.
echo  Once ready, open: http://localhost:3000
echo.
echo  Keep this window open while using the app.
echo  Close this window to stop the server.
echo.

node node_modules\next\dist\bin\next dev --turbopack

pause
