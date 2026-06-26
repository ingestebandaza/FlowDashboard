import asyncio
import websockets
import time

def split_nalus(buf):
    out = []
    length = len(buf)
    i = 0
    while i < length:
        sc_len = 0
        if i + 4 <= length and buf[i] == 0 and buf[i+1] == 0 and buf[i+2] == 0 and buf[i+3] == 1:
            sc_len = 4
        elif i + 3 <= length and buf[i] == 0 and buf[i+1] == 0 and buf[i+2] == 1:
            sc_len = 3
        else:
            i += 1
            continue
            
        j = i + sc_len
        while j < length:
            if j + 3 <= length and buf[j] == 0 and buf[j+1] == 0 and (buf[j+2] == 1 or (buf[j+2] == 0 and j + 4 <= length and buf[j+3] == 1)):
                break
            j += 1
            
        out.append(buf[i+sc_len:j])
        i = j
    return out

async def analyze_stream(preset, max_nalus=15):
    uri = f"ws://127.0.0.1:8768/192.168.1.11:5555?preset={preset}"
    print(f"\n--- Conectando a {preset.upper()} ({uri}) ---")
    nalus_seen = []
    try:
        async with websockets.connect(uri) as ws:
            while len(nalus_seen) < max_nalus:
                chunk = await asyncio.wait_for(ws.recv(), timeout=5.0)
                nalus = split_nalus(chunk)
                for n in nalus:
                    t = n[0] & 0x1f if len(n) > 0 else 0
                    nalus_seen.append(t)
                    if t == 7: name = "SPS"
                    elif t == 8: name = "PPS"
                    elif t == 5: name = "IDR"
                    elif t == 1: name = "DELTA"
                    else: name = str(t)
                    print(f"NAL type {t} ({name}) - length: {len(n)}")
                    if len(nalus_seen) >= max_nalus: break
    except Exception as e:
        print(f"Error o fin: {e}")
    print(f"Resumen de {preset}: {nalus_seen}")

async def main():
    # 1. Analizar Grid
    await analyze_stream("thumbnail")
    time.sleep(1)
    # 2. Analizar Focus (que levanta proceso nuevo o reusa el WS)
    await analyze_stream("eco")

asyncio.run(main())
