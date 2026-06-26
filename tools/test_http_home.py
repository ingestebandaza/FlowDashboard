import urllib.request, json, time, subprocess

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"

serial = "192.168.1.53:5555"

subprocess.run([ADB, "-s", serial, "shell", "am start -a android.settings.SETTINGS"])
time.sleep(2)

print("Check INITIAL STATE")
res = subprocess.run([ADB, "-s", serial, "shell", "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'"], capture_output=True, text=True)
print(res.stdout)

req = urllib.request.Request('http://127.0.0.1:8765/control/keyevent', data=json.dumps({'serial':serial,'name':'home', 'preferScrcpy': True}).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    r = urllib.request.urlopen(req)
    print("OK", r.read().decode('utf-8'))
except Exception as e:
    print("ERR", e.read().decode('utf-8'))
    
time.sleep(2)

print("Check STATE AFTER HOME")
res = subprocess.run([ADB, "-s", serial, "shell", "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'"], capture_output=True, text=True)
print(res.stdout)
