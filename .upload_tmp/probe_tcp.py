import socket, sys, time
port = int(sys.argv[1]) if len(sys.argv) > 1 else 28100
print(f"Conectando a 127.0.0.1:{port}...")
try:
    s = socket.create_connection(("127.0.0.1", port), timeout=3)
    print("Conectado. Leyendo 4s...")
    s.settimeout(4)
    total = 0
    head = b""
    try:
        while True:
            chunk = s.recv(4096)
            if not chunk:
                print("Conexion cerrada por server")
                break
            total += len(chunk)
            if len(head) < 32:
                head += chunk[:32-len(head)]
    except socket.timeout:
        pass
    print(f"Total bytes: {total}")
    if head:
        print(f"Primeros bytes: {head.hex()}")
        if head[:4] == b'\x00\x00\x00\x01' or head[:3] == b'\x00\x00\x01':
            print("OK: Annex-B start code")
        else:
            print("AVISO: no empieza con Annex-B")
    s.close()
except Exception as e:
    print(f"ERROR: {e}")
