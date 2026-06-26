@echo off
cd /d C:\DASHBOARD\FlowDashboard
"C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe" -u .upload_tmp\test_17_sessions.py > .upload_tmp\test_17.log 2>&1
type .upload_tmp\test_17.log
