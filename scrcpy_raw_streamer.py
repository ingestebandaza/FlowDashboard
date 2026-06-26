"""scrcpy_raw_streamer.py - Streaming H.264 RAW desde scrcpy-server v4.0.

Protocolo documentado en:
  https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md#standalone-server

Modo de operacion:
  1. push scrcpy-server a /data/local/tmp/scrcpy-server-manual.jar (idempotente).
  2. Generar scid unico (entero 32-bit) por sesion.
     adb forward tcp:LOCAL_PORT localabstract:scrcpy_{scid}
  3. lanza app_process con flags:
       scid={scid} tunnel_forward=true audio=false control=false cleanup=false
       raw_stream=true max_size=N max_fps=N video_bit_rate=N
     - scid: identifica el socket abstracto. Con scid distinto, dos sesiones
       (ej: grid 'thumbnail' y focus 'balanced') coexisten en el mismo device
       sin conflicto. La doc oficial dice: "scid is a random number to identify
       different clients running on the same device".
     - cleanup=false es CRITICO: permite que el server siga vivo si el socket
       se cierra y reabre (reconexion, probe, etc.).
  4. conecta socket TCP a 127.0.0.1:LOCAL_PORT con timeout generoso (5s).
  5. lee bytes H.264 Annex-B y los reparte a subscribers.

Notas sobre el protocolo:
  - Con scid=N: el socket abstracto es "scrcpy_N" (8 hex digits, ej: scrcpy_00001A2B).
  - raw_stream=true desactiva device_meta, frame_meta, dummy_byte y stream_meta.
  - El primer byte que llega es el inicio del SPS (00 00 00 01 67 ...).
  - cleanup=false: el server NO muere cuando el socket se cierra.
    Esto es importante para el probe y para reconexiones.
  - _spawn_lock es por device (no global): permite spawns paralelos de
    devices distintos, pero serializa spawns del mismo device.

Compatibilidad: scrcpy 4.0.
"""

from __future__ import annotations

import os
import random
import socket
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional
import logging

log = logging.getLogger("scrcpy_raw_streamer")

# Version del cliente. DEBE coincidir con la version del jar.
SCRCPY_VERSION = "4.0"

# Ruta en el device donde se pushea el jar.
DEVICE_JAR_PATH = "/data/local/tmp/scrcpy-server-manual.jar"

# Prefijo del socket abstracto. Con scid, el nombre completo es
# "scrcpy_{scid_hex}" (ej: "scrcpy_1A2B3C4D").
ABSTRACT_SOCKET_PREFIX = "scrcpy"

# Ruta local del jar. En producto debe venir empaquetado junto al proyecto.
DEFAULT_JAR_PATH = Path(
    os.getenv(
        "SCRCPY_SERVER_JAR",
        str(Path(__file__).resolve().parent / "scrcpy-win64-v4.0" / "scrcpy-server.jar"),
    )
)


@dataclass
class StreamPreset:
    name: str
    max_size: int
    max_fps: int
    bit_rate: int


PRESETS: Dict[str, StreamPreset] = {
    "thumbnail": StreamPreset("thumbnail", 240,  8,   300_000),
    "eco":       StreamPreset("eco",       480,  24, 1_000_000),
    "balanced":  StreamPreset("balanced",  720,  30, 2_500_000),
    # 1080 can make some Android encoders close the scrcpy stream with an
    # empty read. Keep Pro above Balanced but below native 1080p for stability.
    "pro":       StreamPreset("pro",       960,  30, 4_000_000),
}


def get_preset(name: str) -> StreamPreset:
    return PRESETS.get((name or "balanced").lower(), PRESETS["balanced"])


@dataclass
class StreamSession:
    serial: str
    preset: StreamPreset
    local_port: int
    scid: int = 0                    # ID unico de sesion (32-bit). Determina el socket abstracto.
    socket_name: str = ABSTRACT_SOCKET_PREFIX
    scid_enabled: bool = False
    frame_meta_enabled: bool = False
    stream_codec_id: int = 0
    stream_width: int = 0
    stream_height: int = 0
    process: Optional[subprocess.Popen] = None
    sock: Optional[socket.socket] = None
    reader_thread: Optional[threading.Thread] = None
    subscribers: List[Callable[[bytes], None]] = field(default_factory=list)
    subscribers_lock: threading.Lock = field(default_factory=threading.Lock)
    stop_event: threading.Event = field(default_factory=threading.Event)
    started_at: float = 0.0
    bytes_streamed: int = 0
    chunks_read: int = 0
    first_nal_types: list = __import__("dataclasses").field(default_factory=list)
    nal_type_counts: Dict[int, int] = field(default_factory=dict)
    sps_count: int = 0
    pps_count: int = 0
    idr_count: int = 0
    non_idr_count: int = 0
    first_idr_at: float = 0.0
    last_idr_at: float = 0.0
    last_sps_at: float = 0.0
    last_pps_at: float = 0.0
    nalu_scan_tail: bytes = b""
    last_byte_at: float = 0.0
    error: str = ""
    # Cache del ultimo SPS/PPS para enviarlo a nuevos subscribers.
    # El scrcpy-server solo emite SPS+PPS al inicio; si un cliente conecta
    # tarde, necesita recibirlos para que el VideoDecoder pueda configurarse.
    last_sps_pps: Optional[bytes] = None
    last_key_frame: Optional[bytes] = None
    last_sps_pps_lock: threading.Lock = field(default_factory=threading.Lock)
    frame_packets: int = 0
    config_packets: int = 0
    key_packets: int = 0
    remote_kill_count: int = 0
    last_cleanup_reason: str = ""


class ScrcpyRawStreamer:
    """Gestor de sesiones scrcpy raw H.264.

    Una sesion por (serial, preset). Multiples subscribers comparten la misma
    sesion (1 proceso app_process por device).
    """

    def __init__(self, adb_path: str, jar_path: Optional[Path] = None):
        self.adb = str(adb_path)
        self.jar = Path(jar_path) if jar_path else DEFAULT_JAR_PATH
        if not self.jar.exists():
            raise FileNotFoundError(f"scrcpy-server jar no encontrado: {self.jar}")

        self._sessions: Dict[str, StreamSession] = {}
        self._sessions_lock = threading.Lock()

        # Cache de push: que devices ya tienen el jar en esta corrida.
        self._pushed: set = set()
        self._pushed_lock = threading.Lock()

        # Pool de puertos para adb forward.
        self._port_pool = list(range(28200, 28400))
        self._used_ports: set = set()
        self._port_lock = threading.Lock()

        # Lock por device para serializar spawn+connect del mismo serial.
        # Permite spawns paralelos de devices distintos (cada uno tiene su scid
        # y su socket abstracto propio, sin colisiones).
        self._spawn_locks: Dict[str, threading.Lock] = {}
        self._spawn_locks_lock = threading.Lock()

        # Canary gate for scid-backed video sockets.
        # FLOW_H264_SCID=1 enables it globally.
        # FLOW_H264_SCID_SERIALS=serial1,serial2 enables it only for selected devices.
        self._scid_global = os.environ.get("FLOW_H264_SCID", "").strip().lower() in {
            "1", "true", "yes", "all"
        }
        scid_serials = os.environ.get("FLOW_H264_SCID_SERIALS", "")
        canary_serial = os.environ.get("FLOW_H264_CANARY_SERIAL", "")
        self._scid_serials = {
            item.strip()
            for item in (scid_serials + "," + canary_serial).split(",")
            if item.strip()
        }
        self._frame_meta_global = os.environ.get("FLOW_H264_FRAME_META", "").strip().lower() in {
            "1", "true", "yes", "all"
        }
        frame_meta_serials = os.environ.get("FLOW_H264_FRAME_META_SERIALS", "")
        self._frame_meta_serials = {
            item.strip()
            for item in frame_meta_serials.split(",")
            if item.strip()
        }

    def _get_spawn_lock(self, serial: str) -> threading.Lock:
        """Devuelve el lock de spawn para este serial (lo crea si no existe)."""
        with self._spawn_locks_lock:
            if serial not in self._spawn_locks:
                self._spawn_locks[serial] = threading.Lock()
            return self._spawn_locks[serial]

    # ------------------------------------------------------------------ helpers

    def _next_port(self) -> int:
        with self._port_lock:
            for p in self._port_pool:
                if p not in self._used_ports:
                    self._used_ports.add(p)
                    return p
        raise RuntimeError("Sin puertos libres en el pool 28200-28400")

    def _release_port(self, port: int):
        with self._port_lock:
            self._used_ports.discard(port)

    def _adb(self, *args: str, timeout: float = 8.0) -> subprocess.CompletedProcess:
        return subprocess.run(
            [self.adb, *args],
            capture_output=True, text=True, timeout=timeout,
        )

    def _wake_display_for_video(self, serial: str):
        """Wake the physical display before starting video-only scrcpy.

        scrcpy's official power_on option is handled by the control controller.
        Our video sessions run with control=false, so a dozing device may stream
        valid black frames unless we wake it first.
        """
        try:
            cp = self._adb("-s", serial, "shell", "input", "keyevent", "WAKEUP", timeout=3)
            if cp.returncode != 0:
                log.debug(
                    "[H264-BACKEND] wakeup failed serial=%s stderr=%s stdout=%s",
                    serial, (cp.stderr or "").strip(), (cp.stdout or "").strip()
                )
        except Exception as exc:
            log.debug("[H264-BACKEND] wakeup exception serial=%s error=%s", serial, exc)

    def _ensure_jar_pushed(self, serial: str):
        """Push del jar al device (idempotente por tamano)."""
        try:
            cp = self._adb("-s", serial, "shell", "ls", "-l", DEVICE_JAR_PATH, timeout=5)
            local_size = self.jar.stat().st_size
            if cp.returncode == 0 and str(local_size) in cp.stdout:
                log.debug("jar ya presente en %s", serial)
                return
        except Exception:
            pass
        log.info("push jar -> %s", serial)
        cp = self._adb("-s", serial, "push", str(self.jar), DEVICE_JAR_PATH, timeout=25)
        if cp.returncode != 0:
            raise RuntimeError(f"adb push fallo: {cp.stderr.strip() or cp.stdout.strip()}")

    def _is_scid_enabled(self, serial: str) -> bool:
        return self._scid_global or serial in self._scid_serials

    def _is_frame_meta_enabled(self, serial: str) -> bool:
        return self._frame_meta_global or serial in self._frame_meta_serials

    @staticmethod
    def _socket_name_for(scid: int, scid_enabled: bool) -> str:
        if scid_enabled:
            return f"{ABSTRACT_SOCKET_PREFIX}_{scid:08x}"
        return ABSTRACT_SOCKET_PREFIX

    def _setup_forward(self, serial: str, scid: int, scid_enabled: bool) -> tuple[int, str]:
        """adb forward tcp:0 to the selected scrcpy localabstract socket."""
        socket_name = self._socket_name_for(scid, scid_enabled)
        cp = self._adb(
            "-s", serial, "forward",
            "tcp:0", f"localabstract:{socket_name}",
            timeout=5,
        )
        if cp.returncode != 0:
            raise RuntimeError(f"adb forward fallo: {cp.stderr.strip() or cp.stdout.strip()}")
        return int(cp.stdout.strip()), socket_name

    def _remove_forward(self, serial: str, local_port: int):
        try:
            self._adb("-s", serial, "forward", "--remove", f"tcp:{local_port}", timeout=3)
        except Exception:
            pass

    def _kill_remote_scrcpy(
        self,
        serial: str,
        *,
        scid: Optional[int] = None,
        legacy_raw: bool = False,
        reason: str = "cleanup",
    ) -> List[str]:
        """Kill only matching remote scrcpy raw processes for one device.

        scid cleanup is safe: it targets the exact session socket id.
        legacy_raw is intentionally opt-in because it kills non-scid raw streams
        on the selected serial and should only be used for canary recovery.
        """
        if scid is None and not legacy_raw:
            return []

        script = (
            "ps -A -o PID,ARGS | "
            "grep 'com.genymobile.scrcpy.Server' | "
        )
        if scid is not None:
            script += f"grep 'scid={scid:08x}' | "
        else:
            script += "grep 'raw_stream=true' | grep -v 'scid=' | "
        script += (
            "grep -v grep | "
            "while read pid rest; do kill \"$pid\" 2>/dev/null; echo \"$pid\"; done"
        )

        cp = self._adb("-s", serial, "shell", script, timeout=5)
        killed = [line.strip() for line in (cp.stdout or "").splitlines() if line.strip()]
        if killed:
            log.info(
                "[H264-BACKEND] remote scrcpy cleanup serial=%s scid=%s legacy_raw=%s reason=%s killed=%s",
                serial, f"{scid:08x}" if scid is not None else "", legacy_raw, reason, killed
            )
        if cp.returncode != 0:
            log.warning(
                "[H264-BACKEND] remote scrcpy cleanup failed serial=%s reason=%s stderr=%s stdout=%s",
                serial, reason, (cp.stderr or "").strip(), (cp.stdout or "").strip()
            )
        return killed

    def _spawn_server(
        self,
        serial: str,
        preset: StreamPreset,
        scid: int,
        scid_enabled: bool,
        frame_meta_enabled: bool,
    ) -> subprocess.Popen:
        """Lanza app_process en el device con un scid unico.

        Flags clave:
          - scid: identifica el socket abstracto (localabstract:scrcpy_{scid_hex}).
            Permite multiples sesiones simultaneas en el mismo device, por ejemplo
            grid en 'thumbnail' y focus en 'balanced'.
          - cleanup=false: el server NO muere cuando el socket se cierra.
            Esto es esencial para que el probe y las reconexiones funcionen.
          - raw_stream=true: desactiva todos los headers (device_meta, frame_meta,
            dummy_byte, stream_meta). El primer byte es directamente H.264 Annex-B.
          - frame_meta_enabled: canario que conserva el header oficial de 12 bytes
            por paquete MediaCodec, pero desactiva device/dummy/stream metadata.
        """
        stream_mode_args = (
            # Keep stream metadata in frame_meta mode. This matches scrcpy's
            # normal packet protocol: dummy byte, codec id, session packet(s),
            # then 12-byte frame headers + MediaCodec packets.
            "send_device_meta=false "
            "send_stream_meta=true "
            "send_dummy_byte=true "
            "send_frame_meta=true "
            if frame_meta_enabled else
            "raw_stream=true "
        )
        shell_cmd = (
            f"CLASSPATH={DEVICE_JAR_PATH} "
            f"app_process / com.genymobile.scrcpy.Server {SCRCPY_VERSION} "
            f"{f'scid={scid:08x} ' if scid_enabled else ''}"
            f"tunnel_forward=true "
            f"audio=false "
            f"control=false "
            f"cleanup=false "
            f"{stream_mode_args}"
            f"max_size={preset.max_size} "
            f"max_fps={preset.max_fps} "
            f"video_bit_rate={preset.bit_rate}"
        )
        kwargs: dict = {}
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen(
            [self.adb, "-s", serial, "shell", shell_cmd],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            **kwargs,
        )
        return proc

    def _connect_and_probe(self, local_port: int, timeout_sec: float = 5.0) -> socket.socket:
        """Conecta al TCP forward y espera el primer byte (probe).

        El server tarda ~500ms-1s en abrir el LocalServerSocket y hacer accept().
        Esperamos hasta timeout_sec segundos por el primer byte.
        Si no llega, lanzamos OSError.
        """
        deadline = time.time() + timeout_sec
        last_error: Optional[Exception] = None
        while time.time() < deadline:
            sock = None
            try:
                sock = socket.create_connection(("127.0.0.1", local_port), timeout=1.0)
                sock.settimeout(max(0.2, min(1.0, deadline - time.time())))
                first_byte = sock.recv(1)
                if first_byte:
                    break
                last_error = OSError("Server cerro la conexion sin transmitir")
            except (OSError, socket.timeout) as exc:
                last_error = exc
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass
            time.sleep(0.15)
        else:
            if isinstance(last_error, socket.timeout):
                raise OSError(f"Timeout esperando primer byte del server en :{local_port}")
            raise OSError(str(last_error or f"Timeout esperando primer byte del server en :{local_port}"))
        # Exito. Configurar socket para lectura continua.
        sock.settimeout(None)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 256 * 1024)
        except Exception:
            pass
        # Devolver socket con el primer byte ya leido, envuelto para no perderlo.
        return _SocketWithPrefix(sock, first_byte)

    def _connect_without_probe(self, local_port: int, timeout_sec: float = 5.0) -> socket.socket:
        """Conecta al TCP forward sin esperar bytes de video.

        En modo frame_meta, el primer paquete puede tardar si la pantalla esta
        estatica. La conexion TCP ya valida que el server acepto el socket.
        """
        deadline = time.time() + timeout_sec
        last_error: Optional[Exception] = None
        while time.time() < deadline:
            try:
                sock = socket.create_connection(("127.0.0.1", local_port), timeout=1.0)
                sock.settimeout(None)
                try:
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 256 * 1024)
                except Exception:
                    pass
                return sock
            except OSError as exc:
                last_error = exc
                time.sleep(0.15)
        raise OSError(str(last_error or f"Timeout conectando al server en :{local_port}"))

    def _connect_and_consume_dummy(self, local_port: int, timeout_sec: float = 5.0) -> socket.socket:
        """Conecta al TCP forward y consume el dummy byte oficial de scrcpy.

        Mantener send_dummy_byte=true permite saber que el server del dispositivo
        acepto realmente el socket. Ese byte no pertenece al frame header.
        """
        deadline = time.time() + timeout_sec
        last_error: Optional[Exception] = None
        while time.time() < deadline:
            sock = None
            try:
                sock = socket.create_connection(("127.0.0.1", local_port), timeout=1.0)
                sock.settimeout(max(0.2, min(1.0, deadline - time.time())))
                dummy = sock.recv(1)
                if dummy:
                    sock.settimeout(None)
                    try:
                        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 256 * 1024)
                    except Exception:
                        pass
                    return sock
                last_error = OSError("Server cerro la conexion sin dummy byte")
            except (OSError, socket.timeout) as exc:
                last_error = exc
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass
            time.sleep(0.15)
        if isinstance(last_error, socket.timeout):
            raise OSError(f"Timeout esperando dummy byte del server en :{local_port}")
        raise OSError(str(last_error or f"Timeout esperando dummy byte del server en :{local_port}"))

    def _reader_loop(self, session: StreamSession):
        """Lee bytes del socket y los reparte a subscribers.

        Ademas detecta y cachea el bloque SPS+PPS (NAL types 7 y 8) para
        enviarlo a nuevos subscribers que conecten tarde.
        """
        sock = session.sock
        if sock is None:
            return
        if session.frame_meta_enabled:
            return self._reader_loop_frame_meta(session)
        buf = bytearray()
        try:
            log.info("[H264-BACKEND] reader_loop started for %s|%s", session.serial, session.preset.name)
            while not session.stop_event.is_set():
                try:
                    chunk = sock.recv(65536)
                except (OSError, socket.timeout) as exc:
                    log.info("[H264-BACKEND] reader_loop ended reason=exception: %s", exc)
                    session.error = str(exc)
                    break
                if not chunk:
                    log.info("[H264-BACKEND] reader_loop ended reason=empty_read")
                    session.error = "empty read"
                    break
                session.bytes_streamed += len(chunk)
                session.chunks_read += 1
                session.last_byte_at = time.time()

                self._observe_nalus(session, chunk)

                if session.chunks_read <= 5 or session.chunks_read % 120 == 0:
                    log.debug("[H264-BACKEND] raw read chunk=%d raw bytes total=%d", len(chunk), session.bytes_streamed)

                # Detectar SPS/PPS en el chunk para cachearlos.
                # SPS = NAL type 7 (0x67), PPS = NAL type 8 (0x68).
                # Buscamos el patron 00 00 00 01 67 o 00 00 01 67.
                self._try_cache_sps_pps(session, chunk)

                # Reparto a subscribers.
                with session.subscribers_lock:
                    subs = list(session.subscribers)
                for cb in subs:
                    try:
                        cb(chunk)
                    except Exception:
                        pass
        finally:
            session.stop_event.set()
            
            # Recopilar stats de salida scrcpy
            exit_code = "running"
            if session.process is not None:
                exit_code = str(session.process.poll())
            log.info("[H264-BACKEND] reader_loop terminado para %s. reason=%s, scrcpy exit code=%s", session.serial, session.error or "closed", exit_code)

    @staticmethod
    def _read_exact(sock, size: int) -> bytes:
        chunks = []
        remaining = size
        while remaining > 0:
            chunk = sock.recv(remaining)
            if not chunk:
                raise OSError("empty read")
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    @staticmethod
    def _frame_ws_payload(packet: bytes, *, config: bool, key_frame: bool) -> bytes:
        flags = (1 if config else 0) | (2 if key_frame else 0)
        return b"FDH1" + bytes([flags, 0, 0, 0]) + packet

    def _reader_loop_frame_meta(self, session: StreamSession):
        """Lee paquetes con frame_meta oficial de scrcpy y conserva sus limites.

        Scrcpy documenta un header de 12 bytes por media packet:
        u64 PTS+flags + u32 packet_size. Al conservarlo en Python, el frontend
        no tiene que adivinar limites de frame a partir de NALUs Annex-B.
        """
        sock = session.sock
        if sock is None:
            return
        try:
            log.info("[H264-BACKEND] frame_meta reader_loop started for %s|%s", session.serial, session.preset.name)
            codec_header = self._read_exact(sock, 4)
            session.stream_codec_id = int.from_bytes(codec_header, "big", signed=False)
            log.info(
                "[H264-BACKEND] frame_meta stream codec_id=%08x serial=%s",
                session.stream_codec_id, session.serial
            )
            while not session.stop_event.is_set():
                try:
                    header = self._read_exact(sock, 12)
                    pts_flags = int.from_bytes(header[:8], "big", signed=False)
                    is_session_packet = bool(pts_flags & (1 << 63))
                    if is_session_packet:
                        width = int.from_bytes(header[4:8], "big", signed=False)
                        height = int.from_bytes(header[8:12], "big", signed=False)
                        session.stream_width = width
                        session.stream_height = height
                        session.last_byte_at = time.time()
                        log.info(
                            "[H264-BACKEND] frame_meta session packet width=%d height=%d serial=%s",
                            width, height, session.serial
                        )
                        continue

                    packet_size = int.from_bytes(header[8:12], "big", signed=False)
                    if packet_size <= 0 or packet_size > 8 * 1024 * 1024:
                        raise OSError(f"invalid scrcpy packet size: {packet_size}")
                    packet = self._read_exact(sock, packet_size)
                except (OSError, socket.timeout) as exc:
                    log.info("[H264-BACKEND] frame_meta reader_loop ended reason=%s", exc)
                    session.error = str(exc)
                    break

                config = bool(pts_flags & (1 << 62))
                key_frame = bool(pts_flags & (1 << 61))
                payload = self._frame_ws_payload(packet, config=config, key_frame=key_frame)

                session.bytes_streamed += len(packet)
                session.chunks_read += 1
                session.frame_packets += 1
                if config:
                    session.config_packets += 1
                if key_frame:
                    session.key_packets += 1
                session.last_byte_at = time.time()

                self._observe_nalus(session, packet)
                self._try_cache_sps_pps(session, packet)
                if config:
                    with session.last_sps_pps_lock:
                        session.last_sps_pps = payload
                if key_frame:
                    with session.last_sps_pps_lock:
                        session.last_key_frame = payload

                log.info(
                    "[H264-BACKEND] frame_meta packet size=%d config=%s key=%s packets=%d bytes=%d",
                    packet_size, config, key_frame, session.frame_packets, session.bytes_streamed
                )

                with session.subscribers_lock:
                    subs = list(session.subscribers)
                for cb in subs:
                    try:
                        cb(payload)
                    except Exception:
                        pass
        finally:
            session.stop_event.set()
            exit_code = "running"
            if session.process is not None:
                exit_code = str(session.process.poll())
            log.info(
                "[H264-BACKEND] frame_meta reader_loop terminado para %s. reason=%s, scrcpy exit code=%s",
                session.serial, session.error or "closed", exit_code
            )

    @staticmethod
    def _observe_nalus(session: StreamSession, chunk: bytes):
        """Update diagnostic NAL counters without changing stream bytes."""
        data = session.nalu_scan_tail + chunk
        now = time.time()
        i = 0
        found_new = False
        while i < len(data) - 4:
            sc_len = 0
            if data[i] == 0 and data[i + 1] == 0 and data[i + 2] == 0 and data[i + 3] == 1:
                sc_len = 4
            elif data[i] == 0 and data[i + 1] == 0 and data[i + 2] == 1:
                sc_len = 3
            if not sc_len:
                i += 1
                continue

            nal_index = i + sc_len
            if nal_index >= len(data):
                break
            nal_type = data[nal_index] & 0x1f
            found_new = True
            if len(session.first_nal_types) < 12:
                session.first_nal_types.append(nal_type)
            session.nal_type_counts[nal_type] = session.nal_type_counts.get(nal_type, 0) + 1
            if nal_type == 7:
                session.sps_count += 1
                session.last_sps_at = now
            elif nal_type == 8:
                session.pps_count += 1
                session.last_pps_at = now
            elif nal_type == 5:
                session.idr_count += 1
                if not session.first_idr_at:
                    session.first_idr_at = now
                session.last_idr_at = now
            elif nal_type == 1:
                session.non_idr_count += 1
            i = nal_index + 1

        session.nalu_scan_tail = bytes(data[-4:]) if len(data) >= 4 else bytes(data)
        if found_new and len(session.first_nal_types) <= 12:
            log.info("[H264-BACKEND] backend NAL types=%s counts=%s", session.first_nal_types, session.nal_type_counts)

    @staticmethod
    def _try_cache_sps_pps(session: StreamSession, chunk: bytes):
        """Si el chunk contiene SPS (NAL 7), cachea desde ese punto hasta
        el final del PPS (NAL 8) para enviarlo a nuevos clientes."""
        # Buscar start code + NAL type 7 (SPS).
        i = 0
        while i < len(chunk) - 4:
            # start code 4 bytes
            if chunk[i] == 0 and chunk[i+1] == 0 and chunk[i+2] == 0 and chunk[i+3] == 1:
                nal_type = chunk[i+4] & 0x1f if i+4 < len(chunk) else 0
                if nal_type == 7:  # SPS encontrado
                    # Guardar desde aqui hasta el final del chunk como SPS+PPS.
                    # El PPS suele venir inmediatamente despues del SPS.
                    sps_pps = bytes(chunk[i:])
                    with session.last_sps_pps_lock:
                        session.last_sps_pps = sps_pps
                    return
                # start code 3 bytes
            elif chunk[i] == 0 and chunk[i+1] == 0 and chunk[i+2] == 1:
                nal_type = chunk[i+3] & 0x1f if i+3 < len(chunk) else 0
                if nal_type == 7:
                    sps_pps = bytes(chunk[i:])
                    with session.last_sps_pps_lock:
                        session.last_sps_pps = sps_pps
                    return
            i += 1

    # ------------------------------------------------------------------ public

    def start_session(self, serial: str, preset_name: str = "balanced") -> StreamSession:
        """Crea o reusa la sesion para (serial, preset).

        Serializado con lock por device para que multiples clientes que piden
        el mismo (serial, preset) no lancen multiples procesos app_process.
        En esta integracion mantenemos una sola sesion viva por serial: si el
        Focus pide otro preset, se cierra la sesion anterior antes de abrir la
        nueva. El socket abstracto real de scrcpy en estos devices se comporta
        como recurso unico por telefono.
        """
        preset = get_preset(preset_name)
        key = f"{serial}|{preset.name}"
        log.info("[H264-BACKEND] start_session key=%s", key)

        # Check rapido sin lock.
        with self._sessions_lock:
            existing = self._sessions.get(key)
            if existing and not existing.stop_event.is_set() and existing.sock is not None:
                return existing
            if existing is not None:
                self._sessions.pop(key, None)

        # Push del jar (paralelo OK, cacheado).
        self._ensure_jar_pushed(serial)
        self._wake_display_for_video(serial)

        # Spawn + connect serializado POR DEVICE (no global).
        # Distintos devices pueden arrancar en paralelo.
        spawn_lock = self._get_spawn_lock(serial)
        with spawn_lock:
            # Doble-check.
            with self._sessions_lock:
                existing = self._sessions.get(key)
                if existing and not existing.stop_event.is_set() and existing.sock is not None:
                    return existing
                stale_same_serial = []
                for old_key, old_session in self._sessions.items():
                    if old_session.serial == serial and old_key != key:
                        stale_same_serial.append(old_key)
                        log.info(
                            "[H264-BACKEND] stale_same_serial cleanup old_key=%s new_key=%s old_session.serial=%s old_session.preset=%s old_session.pid=%s reason=stale_same_serial cleanup_called=true",
                            old_key, key, old_session.serial, old_session.preset.name,
                            getattr(old_session.process, "pid", "None") if old_session.process else "None"
                        )
                stale_sessions = [self._sessions.pop(old_key) for old_key in stale_same_serial]

            for old_session in stale_sessions:
                self._cleanup_session(old_session, reason="stale_same_serial")

            # Generar scid unico para esta sesion.
            # El scid determina el socket abstracto: localabstract:scrcpy_{scid:08X}
            # Rango 1..0xFFFFFF para evitar colisiones y el valor 0 (sin scid).
            scid = random.randint(1, 0x00FFFFFF)
            frame_meta_enabled = self._is_frame_meta_enabled(serial)
            scid_enabled = self._is_scid_enabled(serial) or frame_meta_enabled

            proc = None
            sock = None
            local_port = 0
            socket_name = self._socket_name_for(scid, scid_enabled)
            try:
                # 1. Forward al socket abstracto de esta sesion (ADB asigna puerto libre).
                local_port, socket_name = self._setup_forward(serial, scid, scid_enabled)
                log.info("[H264-BACKEND] start_session key=%s|%s", serial, preset.name)
                log.info("forward tcp:%d -> localabstract:%s [%s]", local_port, socket_name, serial)

                # 2. Spawn server con el scid.
                proc = self._spawn_server(serial, preset, scid, scid_enabled, frame_meta_enabled)
                log.info(
                    "[H264-BACKEND] scrcpy PID=%d scid=%08X scid_enabled=%s frame_meta_enabled=%s socket=%s serial=%s",
                    proc.pid, scid, scid_enabled, frame_meta_enabled, socket_name, serial
                )

                # 3. Esperar a que el server abra el listener y conectar.
                # El server tarda ~500ms-1s. Damos 5s de margen.
                time.sleep(0.9)
                if frame_meta_enabled:
                    sock = self._connect_and_consume_dummy(local_port, timeout_sec=5.0)
                    log.info("[H264-BACKEND] frame_meta socket connected")
                else:
                    sock = self._connect_and_probe(local_port, timeout_sec=5.0)
                    log.info("[H264-BACKEND] raw socket connected")
                log.info("socket conectado OK [%s preset=%s scid=%08X frame_meta=%s]", serial, preset.name, scid, frame_meta_enabled)

            except Exception as exc:
                # Leer stderr del server para diagnostico.
                stderr_msg = ""
                if proc is not None:
                    try:
                        proc.kill()
                        proc.wait(timeout=1.0)
                        exit_code = proc.poll()
                        log.info("[H264-BACKEND] scrcpy exit_code=%s", exit_code)
                        stderr_text = proc.stderr.read() if proc.stderr else b""
                        if stderr_text:
                            log.info("[H264-BACKEND] stderr tail=%s", str(stderr_text)[-300:])
                        stderr_text = proc.stderr.read()
                        if stderr_text:
                            stderr_msg = " | stderr: " + str(stderr_text)[:300]
                    except Exception:
                        pass
                if sock is not None:
                    try:
                        sock.close()
                    except Exception:
                        pass
                if local_port > 0:
                    self._remove_forward(serial, local_port)
                    self._release_port(local_port)
                raise RuntimeError(f"start_session({serial}, {preset_name}) fallo: {exc}{stderr_msg}")

            session = StreamSession(
                serial=serial,
                preset=preset,
                local_port=local_port,
                scid=scid,
                socket_name=socket_name,
                scid_enabled=scid_enabled,
                frame_meta_enabled=frame_meta_enabled,
                process=proc,
                sock=sock,
                started_at=time.time(),
            )
            t = threading.Thread(
                target=self._reader_loop,
                args=(session,),
                name=f"scrcpy-reader-{serial}-{preset.name}",
                daemon=True,
            )
            session.reader_thread = t
            t.start()

            with self._sessions_lock:
                self._sessions[key] = session
            log.info("sesion OK [%s preset=%s port=%d scid=%08X]", serial, preset.name, local_port, scid)
            return session

    def attach_subscriber(
        self, serial: str, preset_name: str, callback: Callable[[bytes], None]
    ) -> StreamSession:
        """Crea/reusa sesion y registra un subscriber.

        Si la sesion ya tenia SPS/PPS y keyframe cacheados (porque el cliente
        conecta tarde), los envia inmediatamente al nuevo subscriber para que
        el VideoDecoder pueda configurarse sin esperar movimiento en pantalla.
        """
        session = self.start_session(serial, preset_name)
        # Enviar config/key cacheados ANTES de registrar el subscriber,
        # para que el cliente los reciba como primeros mensajes.
        with session.last_sps_pps_lock:
            cached_packets = [p for p in (session.last_sps_pps, session.last_key_frame) if p]
        for cached in cached_packets:
            try:
                callback(cached)
            except Exception:
                pass
        with session.subscribers_lock:
            session.subscribers.append(callback)
        return session

    def detach_subscriber(self, session: StreamSession, callback: Callable[[bytes], None]):
        if session is None:
            return
        with session.subscribers_lock:
            try:
                session.subscribers.remove(callback)
            except ValueError:
                pass
            remaining = len(session.subscribers)
        if remaining == 0:
            self.stop_session(session.serial, session.preset.name)

    def _cleanup_session(self, session: StreamSession, reason: str = "cleanup"):
        session.stop_event.set()
        session.last_cleanup_reason = reason
        # Limpiar cache SPS/PPS para que el proximo cliente reciba datos frescos.
        with session.last_sps_pps_lock:
            session.last_sps_pps = None
            session.last_key_frame = None
        if session.sock is not None:
            try:
                session.sock.close()
            except Exception:
                pass
            session.sock = None
        if session.process is not None:
            try:
                session.process.terminate()
                session.process.wait(timeout=2.0)
            except Exception:
                try:
                    session.process.kill()
                except Exception:
                    pass
            session.process = None
        if session.scid_enabled and session.scid:
            killed = self._kill_remote_scrcpy(session.serial, scid=session.scid, reason=reason)
            session.remote_kill_count += len(killed)
        self._remove_forward(session.serial, session.local_port)
        self._release_port(session.local_port)

    @staticmethod
    def is_startup_stalled(
        session: StreamSession,
        *,
        grace_sec: float = 5.0,
        min_bytes: int = 2048,
        max_chunks: int = 16,
    ) -> bool:
        """Detect a stream that started but stopped before becoming useful."""
        now = time.time()
        age = now - session.started_at if session.started_at else 0
        if age < grace_sec:
            return False
        idle = now - session.last_byte_at if session.last_byte_at else age
        if idle < grace_sec:
            return False
        if session.bytes_streamed == 0:
            return True
        if session.frame_meta_enabled and session.config_packets > 0 and session.key_packets > 0:
            return False
        return session.chunks_read <= max_chunks or session.bytes_streamed <= min_bytes

    def recover_session(
        self,
        serial: str,
        preset_name: str = "balanced",
        *,
        force: bool = False,
        kill_legacy_raw: bool = False,
        grace_sec: float = 5.0,
        min_bytes: int = 2048,
        max_chunks: int = 16,
    ) -> dict:
        """Stop a stalled raw H.264 session for one device and clean its remote server."""
        preset = get_preset(preset_name)
        key = f"{serial}|{preset.name}"
        with self._sessions_lock:
            session = self._sessions.get(key)
            before = None
            if session is not None:
                before = {
                    "bytes_streamed": session.bytes_streamed,
                    "chunks_read": session.chunks_read,
                    "last_byte_at": session.last_byte_at,
                    "seconds_since_last_byte": (
                        round(time.time() - session.last_byte_at, 3) if session.last_byte_at else None
                    ),
                    "scid": f"{session.scid:08X}",
                    "socket_name": session.socket_name,
                    "scid_enabled": session.scid_enabled,
                    "frame_meta_enabled": session.frame_meta_enabled,
                    "alive": (
                        not session.stop_event.is_set()
                        and session.sock is not None
                        and session.process is not None
                        and session.process.poll() is None
                    ),
                }
            should_recover = (
                force
                or (session is not None and self.is_startup_stalled(
                    session,
                    grace_sec=grace_sec,
                    min_bytes=min_bytes,
                    max_chunks=max_chunks,
                ))
            )
            if session is not None and should_recover:
                self._sessions.pop(key, None)

        legacy_killed: List[str] = []
        if session is not None and should_recover:
            self._cleanup_session(session, reason="recover_stalled_or_forced")
        if kill_legacy_raw:
            legacy_killed = self._kill_remote_scrcpy(
                serial,
                legacy_raw=True,
                reason="recover_legacy_raw_canary",
            )

        return {
            "success": True,
            "serial": serial,
            "preset": preset.name,
            "hadSession": session is not None,
            "recovered": bool(session is not None and should_recover),
            "force": force,
            "killLegacyRaw": kill_legacy_raw,
            "legacyKilled": legacy_killed,
            "before": before,
            "reason": "forced" if force else "startup_stalled" if should_recover else "not_stalled",
        }

    def stop_session(self, serial: str, preset_name: str = "balanced"):
        preset = get_preset(preset_name)
        key = f"{serial}|{preset.name}"
        log.info("[H264-BACKEND] start_session key=%s", key)
        with self._sessions_lock:
            session = self._sessions.pop(key, None)
        if session:
            self._cleanup_session(session, reason="stop_session")

    def stop_all(self):
        with self._sessions_lock:
            sessions = list(self._sessions.values())
            self._sessions.clear()
        for s in sessions:
            self._cleanup_session(s, reason="stop_all")

    def list_sessions(self) -> List[dict]:
        with self._sessions_lock:
            sessions = list(self._sessions.values())
        result = []
        for s in sessions:
            with s.subscribers_lock:
                sub_count = len(s.subscribers)
            result.append({
                "serial": s.serial,
                "preset": s.preset.name,
                "max_size": s.preset.max_size,
                "max_fps": s.preset.max_fps,
                "bit_rate": s.preset.bit_rate,
                "local_port": s.local_port,
                "scid": f"{s.scid:08X}",
                "socket_name": s.socket_name,
                "scid_enabled": s.scid_enabled,
                "frame_meta_enabled": s.frame_meta_enabled,
                "subscribers": sub_count,
                "bytes_streamed": s.bytes_streamed,
                "chunks_read": s.chunks_read,
                    "frame_packets": s.frame_packets,
                    "stream_codec_id": f"{s.stream_codec_id:08x}" if s.stream_codec_id else "",
                    "stream_width": s.stream_width,
                    "stream_height": s.stream_height,
                    "config_packets": s.config_packets,
                "key_packets": s.key_packets,
                "first_nal_types": list(s.first_nal_types),
                "nal_type_counts": {str(k): v for k, v in sorted(s.nal_type_counts.items())},
                "sps_count": s.sps_count,
                "pps_count": s.pps_count,
                "idr_count": s.idr_count,
                "non_idr_count": s.non_idr_count,
                "has_sps_pps": s.sps_count > 0 and s.pps_count > 0,
                "has_idr": s.idr_count > 0,
                "first_idr_at": s.first_idr_at,
                "last_idr_at": s.last_idr_at,
                "last_sps_at": s.last_sps_at,
                "last_pps_at": s.last_pps_at,
                "started_at": s.started_at,
                "last_byte_at": s.last_byte_at,
                "seconds_since_last_byte": (
                    round(time.time() - s.last_byte_at, 3) if s.last_byte_at else None
                ),
                "startup_stalled": self.is_startup_stalled(s),
                "remote_kill_count": s.remote_kill_count,
                "last_cleanup_reason": s.last_cleanup_reason,
                "alive": (
                    not s.stop_event.is_set()
                    and s.sock is not None
                    and s.process is not None
                    and s.process.poll() is None
                ),
                "error": s.error,
            })
        return result


class _SocketWithPrefix:
    """Socket wrapper que reinserta el primer byte leido en el probe."""
    __slots__ = ("_sock", "_prefix")

    def __init__(self, sock: socket.socket, prefix: bytes):
        self._sock = sock
        self._prefix = prefix  # puede ser b"" si ya se consumio

    def recv(self, bufsize: int) -> bytes:
        if self._prefix:
            data = self._prefix
            self._prefix = b""
            return data
        return self._sock.recv(bufsize)

    def close(self):
        return self._sock.close()

    def shutdown(self, how: int):
        return self._sock.shutdown(how)

    def settimeout(self, t):
        return self._sock.settimeout(t)
