@echo off
REM Mở XAMPP Control Panel
start "" "D:\xampp\xampp-control.exe"
timeout /t 5

REM Start Apache
net start Apache2.4

REM Start MySQL
net start mysql

start cmd /k "cd /d D:\2. Project\AyaLearning && npm run start-dev"