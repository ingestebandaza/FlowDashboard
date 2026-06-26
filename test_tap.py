import urllib.request, json
req = urllib.request.Request('http://127.0.0.1:8765/control/tap', data=json.dumps({'serial':'192.168.1.45:5555','x':100,'y':100}).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    r = urllib.request.urlopen(req)
    print(r.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print(e.read().decode('utf-8'))
