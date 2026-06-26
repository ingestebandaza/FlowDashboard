import socket
import struct
import subprocess
import time
import sys

ADB = r"C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe"

def log(msg):
    print(f"[*] {msg}")

def test_control(serial):
    log(f"Starting minimal test for {serial}")
    
    log("Check INITIAL STATE")
    res = subprocess.run([ADB, "-s", serial, "shell", "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'"], capture_output=True, text=True)
    print(res.stdout)

    scid = 0x11223344
    local_port = 27888
    
    log("Setting up adb forward")
    subprocess.run([ADB, "-s", serial, "forward", f"tcp:{local_port}", f"localabstract:scrcpy_{scid:08x}"])
    
    log("Spawning scrcpy-server on device")
    cmd = [
        ADB, "-s", serial, "shell",
        "CLASSPATH=/data/local/tmp/scrcpy-server-manual.jar",
        "app_process", "/", "com.genymobile.scrcpy.Server", "4.0",
        f"scid={scid:08x}",
        "tunnel_forward=true",
        "video=false",
        "audio=false",
        "control=true",
        "cleanup=false",
        "power_on=false",
        "clipboard_autosync=false",
        "send_dummy_byte=false",
        "send_device_meta=false"
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    time.sleep(2)  # Wait for server to start listening
    
    log(f"Connecting to 127.0.0.1:{local_port}")
    try:
        sock = socket.create_connection(("127.0.0.1", local_port), timeout=2.0)
        log("Socket connected!")
    except Exception as e:
        log(f"Connection failed: {e}")
        return
        
    # Send HOME
    log("Sending HOME keyevent...")
    # struct format: type(B), action(B), keycode(I), repeat(I), meta_state(I)
    # TYPE_INJECT_KEYCODE = 0
    # ACTION_DOWN = 0, ACTION_UP = 1
    # HOME = 3
    msg_down = struct.pack(">BBIII", 0, 0, 3, 0, 0)
    msg_up = struct.pack(">BBIII", 0, 1, 3, 0, 0)
    
    sock.sendall(msg_down)
    time.sleep(0.05)
    sock.sendall(msg_up)
    
    log("Sent HOME bytes.")
    
    time.sleep(1)
    
    log("Check STATE AFTER HOME")
    res = subprocess.run([ADB, "-s", serial, "shell", "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'"], capture_output=True, text=True)
    print(res.stdout)

    log("Sending TAP to center of screen (e.g., 500, 1000)...")
    # type(B), action(B), pointer_id(Q), x(i), y(i), width(H), height(H), pressure(H), action_button(I), buttons(I)
    # TYPE_INJECT_TOUCH_EVENT = 2
    # POINTER_ID_GENERIC_FINGER = (1 << 64) - 2
    POINTER_ID = (1 << 64) - 2
    msg_tap_down = struct.pack(">BBQiiHHHII", 2, 0, POINTER_ID, 500, 1000, 1080, 1920, 0xFFFF, 1, 1)
    msg_tap_up = struct.pack(">BBQiiHHHII", 2, 1, POINTER_ID, 500, 1000, 1080, 1920, 0, 0, 1)

    sock.sendall(msg_tap_down)
    time.sleep(0.05)
    sock.sendall(msg_tap_up)

    log("Sent TAP bytes.")
    time.sleep(1)
    
    log("Check STATE AFTER TAP")
    res = subprocess.run([ADB, "-s", serial, "shell", "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'"], capture_output=True, text=True)
    print(res.stdout)
    
    log("Cleaning up...")
    sock.close()
    proc.terminate()
    subprocess.run([ADB, "-s", serial, "forward", "--remove", f"tcp:{local_port}"])
    log("Done.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_control(sys.argv[1])
    else:
        test_control("192.168.1.45:5555")
