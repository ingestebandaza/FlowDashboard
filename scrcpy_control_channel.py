"""Control manual por canal nativo de scrcpy v4.0.

Este modulo implementa solo el subconjunto necesario para Focus:
tap, swipe y Back/Home/Recents. Esta basado en la documentacion local de
scrcpy (`doc/develop.md`) y en los tests oficiales de serializacion
(`app/tests/test_control_msg_serialize.c`).

La sesion es control-only (`video=false audio=false control=true`) y usa un
`scid` propio para no tocar el stream H.264 raw existente.
"""

from __future__ import annotations

import os
import atexit
import random
import socket
import struct
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple


SCRCPY_VERSION = "4.0"
DEVICE_JAR_PATH = "/data/local/tmp/scrcpy-server-manual.jar"
DEFAULT_JAR_PATH = Path(
    os.getenv(
        "SCRCPY_SERVER_JAR",
        str(Path(__file__).resolve().parent / "scrcpy-win64-v4.0" / "scrcpy-server.jar"),
    )
)

TYPE_INJECT_KEYCODE = 0
TYPE_INJECT_TEXT = 1
TYPE_INJECT_TOUCH_EVENT = 2
TYPE_SET_CLIPBOARD = 9

KEY_ACTION_DOWN = 0
KEY_ACTION_UP = 1

MOTION_ACTION_DOWN = 0
MOTION_ACTION_UP = 1
MOTION_ACTION_MOVE = 2

BUTTON_PRIMARY = 1
POINTER_ID_GENERIC_FINGER = (1 << 64) - 2

KEYCODES = {
    "home": 3,
    "back": 4,
    "recents": 187,
    "enter": 66,
    "backspace": 67,
    "tab": 61,
    "arrowup": 19,
    "arrowdown": 20,
    "arrowleft": 21,
    "arrowright": 22,
}


@dataclass
class ScrcpyControlSession:
    serial: str
    scid: int
    local_port: int
    process: subprocess.Popen
    sock: socket.socket
    started_at: float
    last_used_at: float
    screen_size: Tuple[int, int]
    lock: threading.Lock


class ScrcpyControlManager:
    def __init__(self, adb_path: str, jar_path: Optional[Path] = None):
        self.adb = str(adb_path)
        self.jar = Path(jar_path) if jar_path else DEFAULT_JAR_PATH
        self._sessions: Dict[str, ScrcpyControlSession] = {}
        self._sessions_lock = threading.Lock()
        self._pushed = set()
        self._pushed_lock = threading.Lock()
        atexit.register(self.close_all)

    def _adb(self, *args: str, timeout: float = 8.0) -> subprocess.CompletedProcess:
        return subprocess.run([self.adb, *args], capture_output=True, text=True, timeout=timeout)

    def _ensure_jar_pushed(self, serial: str):
        if not self.jar.exists():
            raise RuntimeError(f"scrcpy-server no encontrado: {self.jar}")
        with self._pushed_lock:
            if serial in self._pushed:
                return
        try:
            cp = self._adb("-s", serial, "shell", "ls", "-l", DEVICE_JAR_PATH, timeout=5)
            if cp.returncode == 0 and str(self.jar.stat().st_size) in cp.stdout:
                with self._pushed_lock:
                    self._pushed.add(serial)
                return
        except Exception:
            pass
        cp = self._adb("-s", serial, "push", str(self.jar), DEVICE_JAR_PATH, timeout=25)
        if cp.returncode != 0:
            raise RuntimeError(f"adb push scrcpy-server fallo: {cp.stderr.strip() or cp.stdout.strip()}")
        with self._pushed_lock:
            self._pushed.add(serial)

    def _screen_size(self, serial: str) -> Tuple[int, int]:
        cp = self._adb("-s", serial, "shell", "wm", "size", timeout=5)
        text = cp.stdout or ""
        import re
        match = re.search(r"(\d+)x(\d+)", text)
        if not match:
            return 1080, 1920
        return int(match.group(1)), int(match.group(2))

    @staticmethod
    def _socket_name(scid: int) -> str:
        return f"scrcpy_{scid:08x}"

    def _setup_forward(self, serial: str, scid: int) -> int:
        cp = self._adb(
            "-s", serial, "forward", "tcp:0", f"localabstract:{self._socket_name(scid)}", timeout=5
        )
        if cp.returncode != 0:
            raise RuntimeError(f"adb forward scrcpy-control fallo: {cp.stderr.strip() or cp.stdout.strip()}")
        return int(cp.stdout.strip())

    def _remove_forward(self, serial: str, local_port: int):
        try:
            self._adb("-s", serial, "forward", "--remove", f"tcp:{local_port}", timeout=3)
        except Exception:
            pass

    def _spawn_server(self, serial: str, scid: int) -> subprocess.Popen:
        shell_cmd = (
            f"CLASSPATH={DEVICE_JAR_PATH} "
            f"app_process / com.genymobile.scrcpy.Server {SCRCPY_VERSION} "
            f"scid={scid:08x} "
            f"tunnel_forward=true "
            f"video=false "
            f"audio=false "
            f"control=true "
            f"cleanup=false "
            f"power_on=false "
            f"clipboard_autosync=false "
            f"send_dummy_byte=true "
            f"send_device_meta=false"
        )
        kwargs = {}
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        return subprocess.Popen(
            [self.adb, "-s", serial, "shell", shell_cmd],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            **kwargs,
        )

    def _connect(self, local_port: int, timeout_sec: float = 5.0) -> socket.socket:
        deadline = time.time() + timeout_sec
        last_error: Optional[Exception] = None
        while time.time() < deadline:
            try:
                sock = socket.create_connection(("127.0.0.1", local_port), timeout=0.8)
                sock.settimeout(2.0)
                dummy = sock.recv(1)
                if len(dummy) != 1:
                    raise RuntimeError("scrcpy dummy byte not received")
                return sock
            except OSError as exc:
                last_error = exc
                time.sleep(0.12)
            except RuntimeError as exc:
                last_error = exc
                if sock:
                    try:
                        sock.close()
                    except:
                        pass
                time.sleep(0.12)
        raise RuntimeError(f"No se pudo conectar al socket scrcpy-control: {last_error}")

    def _new_session(self, serial: str) -> ScrcpyControlSession:
        self._ensure_jar_pushed(serial)
        screen_size = self._screen_size(serial)
        scid = random.randint(1, 0x7FFFFFFF)
        local_port = self._setup_forward(serial, scid)
        process = self._spawn_server(serial, scid)
        try:
            sock = self._connect(local_port)
        except Exception:
            try:
                process.terminate()
            except Exception:
                pass
            self._remove_forward(serial, local_port)
            raise
        return ScrcpyControlSession(
            serial=serial,
            scid=scid,
            local_port=local_port,
            process=process,
            sock=sock,
            started_at=time.time(),
            last_used_at=time.time(),
            screen_size=screen_size,
            lock=threading.Lock(),
        )

    def _get_session(self, serial: str) -> ScrcpyControlSession:
        with self._sessions_lock:
            session = self._sessions.get(serial)
            if session and session.process.poll() is None:
                return session
            if session:
                self._drop_session_locked(serial)
            session = self._new_session(serial)
            self._sessions[serial] = session
            return session

    def _drop_session_locked(self, serial: str):
        session = self._sessions.pop(serial, None)
        if not session:
            return
        try:
            session.sock.close()
        except Exception:
            pass
        try:
            if session.process.poll() is None:
                session.process.terminate()
        except Exception:
            pass
        self._remove_forward(serial, session.local_port)

    def close(self, serial: str):
        with self._sessions_lock:
            self._drop_session_locked(serial)

    def close_all(self):
        with self._sessions_lock:
            for serial in list(self._sessions.keys()):
                self._drop_session_locked(serial)

    def list_sessions(self):
        with self._sessions_lock:
            stale = [serial for serial, s in self._sessions.items() if s.process.poll() is not None]
            for serial in stale:
                self._drop_session_locked(serial)
            return [
                {
                    "serial": s.serial,
                    "scid": f"{s.scid:08x}",
                    "localPort": s.local_port,
                    "pid": s.process.pid,
                    "screenSize": {"width": s.screen_size[0], "height": s.screen_size[1]},
                    "startedAt": s.started_at,
                    "lastUsedAt": s.last_used_at,
                }
                for s in self._sessions.values()
            ]

    @staticmethod
    def _touch_msg(action: int, x: int, y: int, width: int, height: int, pressure: float, buttons: int, action_button: int) -> bytes:
        pressure_u16 = max(0, min(0xFFFF, int(round(pressure * 0xFFFF))))
        return struct.pack(
            ">BBQiiHHHII",
            TYPE_INJECT_TOUCH_EVENT,
            action,
            POINTER_ID_GENERIC_FINGER,
            int(x),
            int(y),
            int(width),
            int(height),
            pressure_u16,
            int(action_button),
            int(buttons),
        )

    @staticmethod
    def _key_msg(action: int, keycode: int) -> bytes:
        return struct.pack(">BBIII", TYPE_INJECT_KEYCODE, action, int(keycode), 0, 0)

    @staticmethod
    def _text_msg(text: str) -> bytes:
        data = str(text or "").encode("utf-8")
        return struct.pack(">BI", TYPE_INJECT_TEXT, len(data)) + data

    @staticmethod
    def _set_clipboard_msg(sequence: int, text: str, paste: bool = True) -> bytes:
        data = str(text or "").encode("utf-8")
        return struct.pack(">BQBI", TYPE_SET_CLIPBOARD, int(sequence), 1 if paste else 0, len(data)) + data

    def _send(self, serial: str, payload: bytes):
        session = self._get_session(serial)
        with session.lock:
            try:
                session.sock.sendall(payload)
                session.last_used_at = time.time()
            except OSError:
                self.close(serial)
                session = self._get_session(serial)
                with session.lock:
                    session.sock.sendall(payload)
                    session.last_used_at = time.time()

    def tap(self, serial: str, x: int, y: int, width: Optional[int] = None, height: Optional[int] = None):
        session = self._get_session(serial)
        width = int(width or session.screen_size[0])
        height = int(height or session.screen_size[1])
        down = self._touch_msg(MOTION_ACTION_DOWN, x, y, width, height, 1.0, BUTTON_PRIMARY, BUTTON_PRIMARY)
        up = self._touch_msg(MOTION_ACTION_UP, x, y, width, height, 0.0, 0, BUTTON_PRIMARY)
        self._send(serial, down)
        time.sleep(0.035)
        self._send(serial, up)

    def touch(self, serial: str, action: int, x: int, y: int, width: Optional[int] = None, height: Optional[int] = None):
        session = self._get_session(serial)
        width = int(width or session.screen_size[0])
        height = int(height or session.screen_size[1])
        # action: 0=DOWN, 1=UP, 2=MOVE
        pressure = 1.0 if action != MOTION_ACTION_UP else 0.0
        buttons = BUTTON_PRIMARY if action != MOTION_ACTION_UP else 0
        action_button = BUTTON_PRIMARY if action != MOTION_ACTION_UP else 0
        msg = self._touch_msg(action, x, y, width, height, pressure, buttons, action_button)
        self._send(serial, msg)


    def swipe(
        self,
        serial: str,
        start_x: int,
        start_y: int,
        end_x: int,
        end_y: int,
        duration_ms: int = 350,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ):
        session = self._get_session(serial)
        width = int(width or session.screen_size[0])
        height = int(height or session.screen_size[1])
        duration_ms = max(80, min(int(duration_ms), 1800))
        steps = max(2, min(24, int(duration_ms / 35)))
        self._send(serial, self._touch_msg(MOTION_ACTION_DOWN, start_x, start_y, width, height, 1.0, BUTTON_PRIMARY, BUTTON_PRIMARY))
        delay = duration_ms / steps / 1000.0
        for i in range(1, steps):
            ratio = i / steps
            x = round(start_x + (end_x - start_x) * ratio)
            y = round(start_y + (end_y - start_y) * ratio)
            self._send(serial, self._touch_msg(MOTION_ACTION_MOVE, x, y, width, height, 1.0, BUTTON_PRIMARY, 0))
            time.sleep(delay)
        self._send(serial, self._touch_msg(MOTION_ACTION_UP, end_x, end_y, width, height, 0.0, 0, BUTTON_PRIMARY))

    def keyevent(self, serial: str, name: str):
        keycode = KEYCODES.get(str(name or "").lower())
        if not keycode:
            raise RuntimeError("name debe ser back, home, recents, enter, backspace, tab o flechas")
        self._send(serial, self._key_msg(KEY_ACTION_DOWN, keycode))
        time.sleep(0.025)
        self._send(serial, self._key_msg(KEY_ACTION_UP, keycode))

    def type_text(self, serial: str, text: str):
        text = str(text or "")
        if not text:
            raise RuntimeError("text requerido")
        if len(text) > 300:
            raise RuntimeError("text excede 300 caracteres")
        self._send(serial, self._text_msg(text))

    def paste_text(self, serial: str, text: str, paste: bool = True):
        text = str(text or "")
        if not text:
            raise RuntimeError("text requerido")
        if len(text) > 4096:
            raise RuntimeError("text excede 4096 caracteres")
        sequence = int(time.time() * 1000) & 0x7FFFFFFFFFFFFFFF
        self._send(serial, self._set_clipboard_msg(sequence, text, paste=paste))
