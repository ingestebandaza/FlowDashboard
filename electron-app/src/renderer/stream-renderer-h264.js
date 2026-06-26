/**
 * stream-renderer-h264.js - Etapa C (Streaming Pro) - RAW H.264 via scrcpy v4.0
 *
 * Cliente WebCodecs que decodifica H.264 RAW en tiempo real con HW accel.
 *
 * Backend: ws://127.0.0.1:8768/<serial>preset=thumbnail|eco|balanced|pro
 *   Implementado en `scrcpy_raw_ws_server.py` (puerto 8768) que reenvia el
 *   stream H.264 raw del scrcpy-server.jar v4.0 (modo `raw_stream=true`).
 *
 * Formato recibido: H.264 Annex-B puro (NALUs con start code 00 00 00 01).
 * NO es fMP4. El primer paquete trae SPS+PPS, el siguiente IDR, y luego
 * P-frames. Lo alimentamos directo al VideoDecoder.
 *
 * Decisiones:
 *   - 1 sesion (WebSocket + VideoDecoder) por serial. El usuario hace `attach`
 *     con `preset` y si cambia el preset cierra-y-reabre.
 *   - Multi-canvas: el mismo serial puede pintar en N canvases (grid + focus).
 *   - HW accel preferido. Software decode como fallback automatico.
 *   - Auto-reconnect con backoff exponencial.
 *
 * Latencia esperada en LAN: 50-80 ms.
 */

(function () {
  'use strict';
  // v5 - arquitectura dos niveles: grid=thumbnail fijo, focus=sesion independiente

  const PRESETS = {
    thumbnail: { quality: 240, fps: 8 },
    eco:       { quality: 480, fps: 24 },
    balanced:  { quality: 720, fps: 30 },
    // Pro keeps higher detail than Balanced without forcing native 1080p,
    // which can make some device encoders close the stream.
    pro:       { quality: 960, fps: 30 },
  };

  // Etiquetas mas comunes de H.264; el VideoDecoder las acepta y luego se
  // re-configura cuando llega el SPS real con la profile/level exactos.
  const FALLBACK_CODEC = 'avc1.42E01F'; // baseline 3.1
  const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000];

  // ---------- helpers Annex-B ----------

  /**
   * Encuentra todos los NALUs en un buffer Annex-B.
   * Retorna array de Uint8Array (sin start code).
   */
  function splitNalus(buf) {
    const out = [];
    const len = buf.length;
    let i = 0;
    while (i < len) {
      // buscar start code
      let scLen = 0;
      if (i + 4 <= len && buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 0 && buf[i + 3] === 1) {
        scLen = 4;
      } else if (i + 3 <= len && buf[i] === 0 && buf[i + 1] === 0 && buf[i + 2] === 1) {
        scLen = 3;
      } else {
        i++;
        continue;
      }
      // proximo start code
      let j = i + scLen;
      while (j < len) {
        if (j + 3 <= len && buf[j] === 0 && buf[j + 1] === 0 && (buf[j + 2] === 1 || (buf[j + 2] === 0 && j + 4 <= len && buf[j + 3] === 1))) {
          break;
        }
        j++;
      }
      out.push(buf.subarray(i + scLen, j));
      i = j;
    }
    return out;
  }

  function naluType(n) {
    return n.length > 0 ? (n[0] & 0x1f) : 0;
  }

  function naluWithStartCode(nalu) {
    const out = new Uint8Array(4 + nalu.length);
    out.set([0, 0, 0, 1], 0);
    out.set(nalu, 4);
    return out;
  }

  function concatUint8(parts) {
    let total = 0;
    for (const part of parts) total += part.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const part of parts) {
      out.set(part, pos);
      pos += part.length;
    }
    return out;
  }

  function containsNalType(annexB, type) {
    for (const nalu of splitNalus(annexB)) {
      if (naluType(nalu) === type) return true;
    }
    return false;
  }

  function rbspPayload(nalu) {
    const out = [];
    let zeroCount = 0;
    for (let i = 1; i < nalu.length; i++) {
      const b = nalu[i];
      if (zeroCount >= 2 && b === 0x03) {
        zeroCount = 0;
        continue;
      }
      out.push(b);
      if (b === 0) zeroCount++;
      else zeroCount = 0;
    }
    return out;
  }

  function readBit(bytes, state) {
    if (state.bit >= bytes.length * 8) return 0;
    const value = (bytes[state.bit >> 3] >> (7 - (state.bit & 7))) & 1;
    state.bit++;
    return value;
  }

  function readUe(bytes, state) {
    let leadingZeroBits = 0;
    while (state.bit < bytes.length * 8 && readBit(bytes, state) === 0) {
      leadingZeroBits++;
      if (leadingZeroBits > 31) return 0;
    }
    let suffix = 0;
    for (let i = 0; i < leadingZeroBits; i++) {
      suffix = (suffix << 1) | readBit(bytes, state);
    }
    return Math.pow(2, leadingZeroBits) - 1 + suffix;
  }

  function firstMbInSlice(nalu) {
    if (!nalu || nalu.length < 2) return 0;
    try {
      return readUe(rbspPayload(nalu), { bit: 0 });
    } catch (_) {
      return 0;
    }
  }

  /**
   * Construye el `description` (avcC) para configure() a partir de SPS/PPS.
   * Esto permite HW decode confiable en algunos navegadores.
   */
  function buildAvcC(sps, pps) {
    if (!sps || !pps || sps.length < 4) return null;
    const out = new Uint8Array(7 + 2 + sps.length + 1 + 2 + pps.length);
    let p = 0;
    out[p++] = 0x01;          // configurationVersion
    out[p++] = sps[1];        // AVCProfileIndication
    out[p++] = sps[2];        // profile_compatibility
    out[p++] = sps[3];        // AVCLevelIndication
    out[p++] = 0xff;          // 6 bits reserved + 2 bits NAL length size minus 1 (=3)
    out[p++] = 0xe1;          // 3 bits reserved + 5 bits SPS count (=1)
    out[p++] = (sps.length >> 8) & 0xff;
    out[p++] = sps.length & 0xff;
    out.set(sps, p); p += sps.length;
    out[p++] = 0x01;          // PPS count
    out[p++] = (pps.length >> 8) & 0xff;
    out[p++] = pps.length & 0xff;
    out.set(pps, p);
    return out;
  }

  function codecStringFromSps(sps) {
    if (!sps || sps.length < 4) return FALLBACK_CODEC;
    const profile = sps[1].toString(16).padStart(2, '0');
    const compat  = sps[2].toString(16).padStart(2, '0');
    const level   = sps[3].toString(16).padStart(2, '0');
    return `avc1.${profile}${compat}${level}`.toLowerCase();
  }

  // ---------- StreamSession ----------

  class StreamSession {
    constructor(serial, wsBase, opts) {
      this.serial = serial;
      this.wsBase = wsBase;
      this.preset = opts.preset || 'balanced';
      this.onError = opts.onError || (() => {});
      this.onFps   = opts.onFps   || (() => {});
      this.onSize  = opts.onSize  || (() => {});

      /** @type {Set<HTMLCanvasElement>} */
      this.canvases = new Set();

      /** @type {WebSocket|null} */
      this.ws = null;
      /** @type {VideoDecoder|null} */
      this.decoder = null;

      this._sps = null;
      this._pps = null;
      this._configured = false;
      this._waitingKeyframe = true;
      this._residue = new Uint8Array(0);
      this._flushTimeout = null;
      this._auParts = [];
      this._auHasVcl = false;
      this._auIsKey = false;
      this._reconnectAttempt = 0;
      this._closed = false;

      this._framesDecoded = 0;
      this._lastFpsAt = performance.now();
      this._lastFpsCount = 0;
      this._lastFrameAt = 0;

      // ---- INSTRUMENTACION ----
      this._bytesReceived = 0;
      this._chunksReceived = 0;
      this._nalusEmitted = 0;
      this._nalTypesCount = {};
      this._spsCount = 0;
      this._ppsCount = 0;
      this._idrCount = 0;
      this._nonIdrCount = 0;
      this._decodeCalls = 0;
      this._decodeErrors = 0;
      this._lastChunkAt = 0;
      this._lastNaluAt = 0;
      this._lastIdrAt = 0;
      this._lastDecodeAt = 0;
      this._generation = 0;
      this._suppressNextCloseReconnect = false;
      this._lastBitmap = null;

      this._frameW = 0;
      this._frameH = 0;
    }

    addCanvas(canvas) {
      if (!canvas) return;
      this.canvases.add(canvas);
      if (this._lastBitmap && this._frameW && this._frameH) {
        this._paintBitmapToCanvas(this._lastBitmap, canvas, this._frameW, this._frameH);
      }
    }
    removeCanvas(canvas) {
      this.canvases.delete(canvas);
    }
    hasCanvases() {
      return this.canvases.size > 0;
    }

    setPreset(preset) {
      if (preset === this.preset) return;
      this.preset = preset;
      // Resetear backoff: este cierre es intencional (cambio de calidad),
      // no un fallo de red. El proximo open() debe intentar de inmediato.
      this._reconnectAttempt = 0;
      this._generation++;
      this._suppressNextCloseReconnect = true;
      const oldWs = this.ws;
      this.ws = null;
      this._teardownDecoder();
      this._clearCanvases();
      try { oldWs && oldWs.close(); } catch (_) {}
      setTimeout(() => {
        if (!this._closed && this.hasCanvases() && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.open();
        }
      }, 80);
    }

    open() {
      if (this._closed) return;
      this._openedAt = performance.now();
      // NO usar encodeURIComponent en el serial: el servidor necesita el serial
      // exactamente como viene (ej: "192.168.1.11:5555"). El ":" es valido en
      // un path de URL y no necesita codificarse para WebSocket.
      const url = `${this.wsBase}/${this.serial}?preset=${encodeURIComponent(this.preset)}`;
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
      } catch (exc) {
        this.onError(exc, this.serial);
        return this._scheduleReconnect();
      }
      const wsRef = this.ws;

      wsRef.addEventListener('open', () => {
        if (this.ws !== wsRef) return;
        this._reconnectAttempt = 0;
      });

      wsRef.addEventListener('message', (ev) => {
        if (this.ws !== wsRef) return;
        if (typeof ev.data === 'string') return;
        this._onBytes(new Uint8Array(ev.data));
      });

      wsRef.addEventListener('close', () => {
        if (this.ws !== wsRef) {
          if (this._suppressNextCloseReconnect) this._suppressNextCloseReconnect = false;
          return;
        }
        this._teardownDecoder();
        if (this._suppressNextCloseReconnect) {
          this._suppressNextCloseReconnect = false;
          return;
        }
        if (!this._closed && this.hasCanvases()) {
          this._scheduleReconnect();
        }
      });

      wsRef.addEventListener('error', () => {
        // 'close' tomara el control del retry.
      });
    }

    _scheduleReconnect() {
      const delay = RECONNECT_BACKOFF_MS[Math.min(this._reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
      this._reconnectAttempt++;
      setTimeout(() => {
        if (!this._closed && this.hasCanvases()) this.open();
      }, delay);
    }

    _onBytes(chunk) {
      if (
        chunk.length >= 8 &&
        chunk[0] === 0x46 && chunk[1] === 0x44 &&
        chunk[2] === 0x48 && chunk[3] === 0x31
      ) {
        this._onFramedPacket(chunk);
        return;
      }
      this._bytesReceived += chunk.length;
      this._chunksReceived++;
      this._lastChunkAt = performance.now();
      
      const merged = new Uint8Array(this._residue.length + chunk.length);
      merged.set(this._residue, 0);
      merged.set(chunk, this._residue.length);

      // Límite de seguridad 5MB para evitar memory leak
      if (merged.length > 5 * 1024 * 1024) {
        console.warn(`[H264] ${this.serial}: Residuo excedió 5MB, purgando.`);
        this._residue = new Uint8Array(0);
        return;
      }

      const nalus = [];
      let i = 0;
      const len = merged.length;

      while (i < len) {
        let scLen = 0;
        if (i + 4 <= len && merged[i] === 0 && merged[i+1] === 0 && merged[i+2] === 0 && merged[i+3] === 1) {
          scLen = 4;
        } else if (i + 3 <= len && merged[i] === 0 && merged[i+1] === 0 && merged[i+2] === 1) {
          scLen = 3;
        } else {
          i++;
          continue;
        }

        let j = i + scLen;
        let foundNext = false;
        while (j < len) {
          if (j + 3 <= len && merged[j] === 0 && merged[j+1] === 0 && (merged[j+2] === 1 || (merged[j+2] === 0 && j + 4 <= len && merged[j+3] === 1))) {
            foundNext = true;
            break;
          }
          j++;
        }

        if (foundNext) {
          nalus.push(merged.subarray(i + scLen, j));
          i = j;
        } else {
          // Último NALU: no está cerrado por otro start code.
          // Guardar como residue empezando desde el start code.
          this._residue = merged.subarray(i);
          for (const n of nalus) this._handleNalu(n);
          return;
        }
      }

      // Buffer completado exactamente con startcodes (raro)
      this._residue = new Uint8Array(0);
      for (const n of nalus) this._handleNalu(n);
    }

    _cacheConfigFromAnnexB(data) {
      for (const nalu of splitNalus(data)) {
        const t = naluType(nalu);
        const now = performance.now();
        this._nalusEmitted++;
        this._lastNaluAt = now;
        this._nalTypesCount[t] = (this._nalTypesCount[t] || 0) + 1;
        if (t === 7) {
          this._sps = nalu;
          this._spsCount++;
          this._configured = false;
          this._waitingKeyframe = true;
        } else if (t === 8) {
          this._pps = nalu;
          this._ppsCount++;
          this._configured = false;
          this._waitingKeyframe = true;
        } else if (t === 5) {
          this._idrCount++;
          this._lastIdrAt = now;
        } else if (t === 1) {
          this._nonIdrCount++;
        }
      }
    }

    _onFramedPacket(message) {
      const flags = message[4] || 0;
      const isConfig = !!(flags & 1);
      const isKey = !!(flags & 2);
      const packet = message.subarray(8);

      this._bytesReceived += packet.length;
      this._chunksReceived++;
      this._lastChunkAt = performance.now();
      this._residue = new Uint8Array(0);
      this._resetAccessUnit();

      this._cacheConfigFromAnnexB(packet);
      if (isConfig) {
        this._waitingKeyframe = true;
        return;
      }

      let payload = packet;
      if (isKey && this._sps && this._pps) {
        const hasSps = containsNalType(payload, 7);
        const hasPps = containsNalType(payload, 8);
        if (!hasSps || !hasPps) {
          const prefix = [];
          if (!hasSps) prefix.push(naluWithStartCode(this._sps));
          if (!hasPps) prefix.push(naluWithStartCode(this._pps));
          payload = concatUint8([...prefix, payload]);
        }
      }

      this._decodeAccessUnit(payload, isKey);
    }

    _ensureDecoder() {
      if (this.decoder && this.decoder.state !== 'closed') return;
      // Si el decoder anterior estaba cerrado, lo descartamos.
      if (this.decoder) {
        try { this.decoder.close(); } catch (_) {}
        this.decoder = null;
      }
      const decoder = new VideoDecoder({
        output: (frame) => this._onFrame(frame),
        error: (err) => {
          this._decodeErrors++;
          this.onError(err, this.serial);
          // Marcar para re-crear en el proximo IDR. NO llamar configure aqui
          // para evitar el loop "error -> configure -> error -> ...".
          this._configured = false;
          this._waitingKeyframe = true;
          // Cerrar el decoder roto para que _ensureDecoder cree uno nuevo.
          try { this.decoder && this.decoder.close(); } catch (_) {}
          this.decoder = null;
        },
      });
      this.decoder = decoder;
    }

    _configureDecoder() {
      if (!this._sps || !this._pps) return;
      // Si ya hay un decoder configurado y no cerrado, no reconfigurar.
      if (this._configured && this.decoder && this.decoder.state !== 'closed') return;
      this._ensureDecoder();
      if (!this.decoder) return;
      const codec = codecStringFromSps(this._sps);
      try {
        // NO pasar description (avcC): cuando se alimenta Annex-B al decoder,
        // el description causaria que el decoder espere AVCC (length-prefixed)
        // en lugar de Annex-B (start codes 00 00 00 01).
        this.decoder.configure({
          codec,
          hardwareAcceleration: 'prefer-hardware',
          optimizeForLatency: true,
        });
        this._configured = true;
      } catch (exc) {
        this._decodeErrors++;
        this.onError(exc, this.serial);
        this._configured = false;
      }
    }

    _resetAccessUnit() {
      this._auParts = [];
      this._auHasVcl = false;
      this._auIsKey = false;
    }

    _appendToAccessUnit(nalu) {
      this._auParts.push(naluWithStartCode(nalu));
    }

    _flushAccessUnit() {
      if (!this._auHasVcl || !this._auParts.length) {
        this._resetAccessUnit();
        return;
      }

      let payload = concatUint8(this._auParts);
      const isKey = this._auIsKey;

      if (isKey && this._sps && this._pps) {
        const hasSps = containsNalType(payload, 7);
        const hasPps = containsNalType(payload, 8);
        if (!hasSps || !hasPps) {
          const prefix = [];
          if (!hasSps) prefix.push(naluWithStartCode(this._sps));
          if (!hasPps) prefix.push(naluWithStartCode(this._pps));
          payload = concatUint8([...prefix, payload]);
        }
      }

      this._decodeAccessUnit(payload, isKey);
      this._resetAccessUnit();
    }

    _decodeAccessUnit(payload, isKey) {
      if (!this._configured && !isKey) {
        this._waitingKeyframe = true;
        return;
      }
      if (!this._configured) this._configureDecoder();
      if (!this._configured) return;
      if (this._waitingKeyframe && !isKey) return;
      this._waitingKeyframe = false;

      try {
        if (!this.decoder || this.decoder.state === 'closed') return;
        const chunk = new EncodedVideoChunk({
          type: isKey ? 'key' : 'delta',
          timestamp: performance.now() * 1000, // micros
          data: payload,
        });
        this._decodeCalls++;
        this._lastDecodeAt = performance.now();
        this.decoder.decode(chunk);
      } catch (exc) {
        this._decodeErrors++;
        this.onError(exc, this.serial);
        this._configured = false;
        this._waitingKeyframe = true;
        try { this.decoder && this.decoder.close(); } catch (_) {}
        this.decoder = null;
        this._resetAccessUnit();
      }
    }

    _handleNalu(nalu) {
      const t = naluType(nalu);
      const now = performance.now();
      this._nalusEmitted++;
      this._lastNaluAt = now;
      this._nalTypesCount[t] = (this._nalTypesCount[t] || 0) + 1;
      // 7 = SPS, 8 = PPS, 5 = IDR, 1 = non-IDR slice, 6 = SEI, 9 = AUD.
      if (t === 7) {
        this._sps = nalu;
        this._spsCount++;
        this._configured = false;
        this._waitingKeyframe = true;
        this._appendToAccessUnit(nalu);
      } else if (t === 8) {
        this._pps = nalu;
        this._ppsCount++;
        this._configured = false;
        this._waitingKeyframe = true;
        this._appendToAccessUnit(nalu);
      } else if (t === 9) {
        this._flushAccessUnit();
        this._appendToAccessUnit(nalu);
      } else if (t === 6) {
        this._appendToAccessUnit(nalu);
      } else if (t === 5 || t === 1) {
        if (t === 5) {
          this._idrCount++;
          this._lastIdrAt = now;
        } else {
          this._nonIdrCount++;
        }

        if (this._auHasVcl && firstMbInSlice(nalu) === 0) {
          this._flushAccessUnit();
        }
        this._appendToAccessUnit(nalu);
        this._auHasVcl = true;
        this._auIsKey = this._auIsKey || t === 5;
      }
      // Otros tipos: se ignoran para no contaminar el access unit.
    }

    _onFrame(frame) {
      const frameGeneration = this._generation;
      this._framesDecoded++;
      this._lastFrameAt = performance.now();
      const w = frame.codedWidth || frame.displayWidth;
      const h = frame.codedHeight || frame.displayHeight;
      if (w !== this._frameW || h !== this._frameH) {
        this._frameW = w; this._frameH = h;
        this.onSize({ serial: this.serial, width: w, height: h });
      }

      // Convertir el frame a un mapa de pixeles para evitar los bloqueos de 
      // hardware del navegador al dibujar en multiples pantallas.
      const f = frame.clone();
      createImageBitmap(f).then(bitmap => {
        if (frameGeneration !== this._generation || this._closed) {
          bitmap.close();
          f.close();
          return;
        }
        if (this._lastBitmap && this._lastBitmap !== bitmap) {
          try { this._lastBitmap.close(); } catch (_) {}
        }
        this._lastBitmap = bitmap;
        const canvasArray = Array.from(this.canvases);
        for (let i = 0; i < canvasArray.length; i++) {
          const canvas = canvasArray[i];
          if (!canvas) continue;
          try {
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            const ctx2 = canvas.getContext('2d');
            if (ctx2) {
              ctx2.drawImage(bitmap, 0, 0, w, h);
            }
          } catch (e) {
            console.error(`[H264] ${this.serial}: error crítico pintando canvas ${canvas.id}`, e);
          }
        }
        f.close();
      }).catch(err => {
        console.error(`[H264] ${this.serial}: error decodificando bitmap`, err);
        try { f.close(); } catch (_) {}
      });

      // FPS periodico (cada 1s).
      const now = performance.now();
      if (now - this._lastFpsAt >= 1000) {
        const fps = (this._framesDecoded - this._lastFpsCount) / ((now - this._lastFpsAt) / 1000);
        this._lastFpsAt = now;
        this._lastFpsCount = this._framesDecoded;
        this.onFps({ serial: this.serial, fps: +fps.toFixed(1), framesDecoded: this._framesDecoded });
      }

      try { frame.close(); } catch (_) {}
    }

    _paintBitmapToCanvas(bitmap, canvas, w, h) {
      try {
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx2 = canvas.getContext('2d');
        if (ctx2) {
          ctx2.drawImage(bitmap, 0, 0, w, h);
        }
      } catch (e) {
        console.error(`[H264] ${this.serial}: error pintando canvas ${canvas.id}`, e);
      }
    }

    _clearCanvases() {
      for (const canvas of this.canvases) {
        if (!canvas) continue;
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
        } catch (_) {}
      }
    }

    _teardownDecoder() {
      this._generation++;
      if (this.decoder) {
        try {
          if (this.decoder.state !== 'closed') this.decoder.close();
        } catch (_) {}
        this.decoder = null;
      }
      this._configured = false;
      this._waitingKeyframe = true;
      this._sps = null;
      this._pps = null;
      if (this._lastBitmap) {
        try { this._lastBitmap.close(); } catch (_) {}
        this._lastBitmap = null;
      }
      this._residue = new Uint8Array(0);
      this._resetAccessUnit();
    }

    close() {
      this._closed = true;
      try { this.ws && this.ws.close(); } catch (_) {}
      this.ws = null;
      this._teardownDecoder();
      this.canvases.clear();
    }
  }

  // ---------- public renderer ----------

  class H264StreamRenderer {
    constructor(opts = {}) {
      this.wsBase     = opts.wsUrl || 'ws://127.0.0.1:8768';
      this.onError    = opts.onError || (() => {});
      this.onFps      = opts.onFps || (() => {});
      this.onSize     = opts.onSize || (() => {});
      this.defaultPreset = opts.defaultPreset || 'balanced';
      /** @type {Map<string, StreamSession>} */
      this.sessions = new Map();

      this.supported = (
        typeof window !== 'undefined' &&
        typeof window.VideoDecoder !== 'undefined' &&
        typeof window.EncodedVideoChunk !== 'undefined' &&
        typeof window.WebSocket !== 'undefined'
      );
      if (!this.supported) {
        console.warn('[H264] WebCodecs / WebSocket no disponible.');
      }
    }


    isSupported() { return this.supported; }

    _hasValidFrame(session) {
      return Number(session?._framesDecoded || 0) > 0
        && Number(session?._frameW || 0) > 0
        && Number(session?._frameH || 0) > 0
        && Number(session?._lastFrameAt || 0) > 0;
    }

    _isCanvasAttached(canvas) {
      return !!canvas && (typeof document === 'undefined' || document.contains(canvas));
    }

    _pruneDetachedCanvases(session) {
      if (!session) return;
      for (const canvas of Array.from(session.canvases)) {
        if (!this._isCanvasAttached(canvas)) session.removeCanvas(canvas);
      }
    }

    _aliasKeysForSession(session, serial = null) {
      const aliasKeys = [];
      for (const [key, aliasSession] of this.sessions) {
        if (aliasSession === session) aliasKeys.push(key);
      }
      if (serial && !aliasKeys.includes(serial)) aliasKeys.push(serial);
      return aliasKeys;
    }

    _deleteSessionAliases(session, serial = null) {
      for (const key of this._aliasKeysForSession(session, serial)) {
        this.sessions.delete(key);
      }
    }

    _recreateSession(serial, preset = null, extraCanvas = null) {
      const currentSession = this.sessions.get(serial);
      if (!currentSession) return null;

      this._pruneDetachedCanvases(currentSession);
      const savedCanvases = new Set(currentSession.canvases);
      if (this._isCanvasAttached(extraCanvas)) savedCanvases.add(extraCanvas);
      const savedPreset = preset || currentSession.preset || this.defaultPreset;
      const aliasKeys = this._aliasKeysForSession(currentSession, serial);

      try { currentSession._clearCanvases(); } catch (_) {}
      try { currentSession.close(); } catch (_) {}
      for (const key of aliasKeys) this.sessions.delete(key);

      const nextSession = new StreamSession(serial, this.wsBase, {
        preset: savedPreset,
        onError: this.onError,
        onFps: this.onFps,
        onSize: this.onSize,
      });

      for (const key of aliasKeys) this.sessions.set(key, nextSession);
      for (const canvas of savedCanvases) {
        if (this._isCanvasAttached(canvas)) nextSession.addCanvas(canvas);
      }
      if (nextSession.hasCanvases()) nextSession.open();
      return nextSession;
    }

    _startGridRecoveryWatchdog(serial, canvas, preset) {
      if (!serial || !this._isCanvasAttached(canvas)) return;
      if (!this._gridWatchdogs) this._gridWatchdogs = new Map();
      if (!this._gridRecoveryCounts) this._gridRecoveryCounts = new Map();
      if (this._gridWatchdogs.has(serial)) return;

      const startedAt = performance.now();
      const timer = setInterval(() => {
        const session = this.sessions.get(serial);
        if (!session || session._closed) {
          clearInterval(timer);
          this._gridWatchdogs.delete(serial);
          return;
        }

        this._pruneDetachedCanvases(session);
        if (this._isCanvasAttached(canvas) && !session.canvases.has(canvas)) {
          session.addCanvas(canvas);
          console.log(`[H264-grid] watchdog reattached canvas a sesion viva: ${serial}`);
        }
        if (this._hasValidFrame(session)) {
          clearInterval(timer);
          this._gridWatchdogs.delete(serial);
          this._gridRecoveryCounts.delete(serial);
          return;
        }

        const ageMs = performance.now() - startedAt;
        if (ageMs < 10000) return;

        const wsState = session.ws ? session.ws.readyState : WebSocket.CLOSED;
        const canRestart = wsState !== WebSocket.CONNECTING || ageMs > 15000;
        if (!canRestart) return;

        const retryCount = (this._gridRecoveryCounts.get(serial) || 0) + 1;
        this._gridRecoveryCounts.set(serial, retryCount);
        if (retryCount > 3) {
          console.warn(`[H264-grid] recovery agotado sin frame valido: ${serial}`);
          clearInterval(timer);
          this._gridWatchdogs.delete(serial);
          return;
        }

        console.log(`[H264-grid] recovery ${retryCount}/3: recreando sesion sin frame valido ${serial}`);
        this._recreateSession(serial, preset, canvas);
        clearInterval(timer);
        this._gridWatchdogs.delete(serial);
        setTimeout(() => this._startGridRecoveryWatchdog(serial, canvas, preset), 80);
      }, 3000);

      this._gridWatchdogs.set(serial, timer);
    }

    /**
     * FASE 2: Crea una sesion H.264 INDEPENDIENTE para el Focus, con su propio
     * WebSocket al backend Python. Clave: `serial|preset` (ej: "192.168.1.43:5555|balanced").
     * El backend Python ya distingue sesiones por (serial, preset) en scrcpy_raw_streamer.py.
     *
     * No toca la sesion del grid (`serial` → thumbnail).
     * Dos procesos scrcpy en el telefono: uno para thumbnail (grid) y uno para HD (focus).
     * Con cleanup=false, ambos procesos conviven sin conflictos.
     */
    _isSessionAlive(session) {
      if (!session) return false;

      if (session._closed) return false;

      if (!session.ws || (session.ws.readyState !== WebSocket.OPEN && session.ws.readyState !== WebSocket.CONNECTING)) {
        if (session.ws && session.ws.readyState === WebSocket.CONNECTING) return true;
        return false;
      }

      const now = performance.now();
      const age = now - (session._openedAt || now);

      // Gracia de arranque: todavía no hay primer frame, pero acaba de abrir.
      if (age < 10000 && session._framesDecoded === 0) return true;

      // Si nunca llegó primer frame tras la gracia, sí está muerto.
      if (session._framesDecoded === 0) return false;

      // STATIC SCREEN COMPAT:
      // Si ya hubo al menos un frame válido, la sesión NO debe morir solo porque
      // lastFrameAt sea viejo. Scrcpy puede dejar de emitir bytes si la pantalla no cambia.
      if (session._framesDecoded > 0 && session._lastFrameAt > 0) return true;

      return false;
    }

    attachFocus(serial, canvas, preset) {
      if (!this.supported || !serial || !canvas) return null;
      const focusPreset = preset || 'balanced';
      const key = `${serial}|${focusPreset}`;

      let session = this.sessions.get(serial);
      
      // HOTFIX H264-MASTER-STALE-RECOVERY-01
        const hasValidFrame = this._hasValidFrame(session);
        if (session && !hasValidFrame && !this._isSessionAlive(session)) {
        console.log(`[H264-focus] Detectada sesion fisica stale/congelada. Cerrando y recreando master: ${serial}`);
        session.close();
        this._deleteSessionAliases(session, serial);
        session = null;
      }

      if (!session) {
        // Si no existe, crear la sesion fisica con el serial base para que el Grid la reutillice si arranca despues
        console.log(`[H264-focus] Creando pipeline fisico H.264 principal desde Focus: ${serial}`);
        session = new StreamSession(serial, this.wsBase, {
          preset: focusPreset,
          onError: this.onError,
          onFps: this.onFps,
          onSize: this.onSize,
        });
        this.sessions.set(serial, session);
      } else {
        console.log(`[H264-focus] Pipeline existente encontrado; vida pendiente de watchdog para Focus: ${serial}`);
        if (session.preset !== focusPreset) {
           session.setPreset(focusPreset);
        }
      }

      this.sessions.set(key, session); // alias para getStats

      session.addCanvas(canvas);
      if (!session.ws || (session.ws.readyState !== WebSocket.OPEN && session.ws.readyState !== WebSocket.CONNECTING)) {
        session.open();
      }

      // HOTFIX H264-WATCHDOG-STATIC-SCREEN-COMPAT-01
      if (!this._watchdogs) this._watchdogs = new Map();
      if (!this._watchdogRetryCounts) this._watchdogRetryCounts = new Map();
      
      if (!this._watchdogs.has(serial)) {
        const baselineFrames = session._framesDecoded || 0;
        const baselineLastFrameAt = session._lastFrameAt || 0;
        const baselineTime = performance.now();
        
        console.log(`[H264-watchdog] started serial=${serial} baselineFrames=${baselineFrames} baselineLastFrameAt=${baselineLastFrameAt}`);
        
        this._watchdogs.set(serial, { timer: setInterval(() => {
          let currentSession = this.sessions.get(serial);
          if (!currentSession || currentSession._closed) {
             clearInterval(this._watchdogs.get(serial).timer);
             this._watchdogs.delete(serial);
             return;
          }
          
          const now = performance.now();
            const hasValidFrame = currentSession._framesDecoded > 0 && currentSession._lastFrameAt > 0;
            const ageMs = now - baselineTime;
            console.log(`[H264-watchdog] tick serial=${serial} frames=${currentSession._framesDecoded} lastFrameAt=${currentSession._lastFrameAt} ageMs=${Math.round(ageMs)} hasValidFrame=${hasValidFrame}`);
            if (hasValidFrame) {
              console.log(`[H264-watchdog] stream alive (static screen compat): has valid frame`);
              clearInterval(this._watchdogs.get(serial).timer);
              this._watchdogs.delete(serial);
              if (this._watchdogRetryCounts) this._watchdogRetryCounts.delete(serial);
              return;
            }
          if (ageMs > 10000 && currentSession.ws && currentSession.ws.readyState === WebSocket.OPEN) {
             console.log(`[H264-watchdog] stream stale: frames not advancing`);
             
             const retryCount = (this._watchdogRetryCounts.get(serial) || 0) + 1;
             this._watchdogRetryCounts.set(serial, retryCount);
             
             if (retryCount > 3) {
               console.log(`[H264-watchdog] Abortando tras 3 reintentos reales. El dispositivo no manda H264: ${serial}`);
               clearInterval(this._watchdogs.get(serial).timer);
               this._watchdogs.delete(serial);
               return; // Parar bucle infinito y pasar a diagnostico backend real
             }
             
             console.log(`[H264-watchdog] closing stale master (${serial})`);
             const savedCanvases = new Set(currentSession.canvases);
             const savedPreset = currentSession.preset;
             
             currentSession.close();
             this.sessions.delete(serial);
             
             console.log(`[H264-watchdog] purging aliases (${serial})`);
             for (const [aliasKey, aliasSession] of this.sessions) {
                if (aliasSession === currentSession) {
                   this.sessions.delete(aliasKey);
                }
             }
             
             console.log(`[H264-watchdog] recreating master attempt=${retryCount}/3 (${serial})`);
             const newSession = new StreamSession(serial, this.wsBase, {
                preset: savedPreset,
                onError: this.onError,
                onFps: this.onFps,
                onSize: this.onSize,
             });
             this.sessions.set(serial, newSession);
             
             this.sessions.set(key, newSession);
             
             for (const c of savedCanvases) {
                newSession.addCanvas(c);
             }
             console.log(`[H264-watchdog] reattached focus canvas (${serial})`);
             newSession.open();
             
             // Update baseline for the new session attempt so we don't instantly kill it on the next tick
             clearInterval(this._watchdogs.get(serial).timer);
             this._watchdogs.delete(serial);
             // Let the next attachFocus or the user reopening focus trigger a new watchdog, 
             // OR re-trigger it here recursively. It's safer to re-trigger it:
             this.attachFocus(serial, canvas, preset);
          }
        }, 3000) });
      }

      return session;
    }

    /**
     * FASE 2: Cierra la sesion de focus para `serial` y `preset`.
     * NO toca la sesion del grid (serial|thumbnail).
     */
    detachFocus(serial, preset) {
      const focusPreset = preset || 'balanced';
      const key = `${serial}|${focusPreset}`;
      const session = this.sessions.get(key);
      if (session) {
        this.sessions.delete(key);
        if (session !== this.sessions.get(serial)) {
          session.close();
          console.log(`[H264-focus] Sesion independiente cerrada: ${key}`);
        } else {
          console.log(`[H264-focus] Alias de focus borrado, preservando Grid: ${key}`);
        }
      }
    }

    /**
     * Cierra todas las sesiones de focus para un serial dado
     * (sin importar el preset). Util al cerrar el overlay.
     */
    detachAllFocus(serial) {
      for (const [key, session] of this.sessions) {
        if (key.startsWith(`${serial}|`)) {
          this.sessions.delete(key);
          if (session !== this.sessions.get(serial)) {
            session.close();
          }
        }
      }
    }

    forceRestart(serial, preset = null, extraCanvas = null) {
      return !!this._recreateSession(serial, preset, extraCanvas);
    }

    ensureCanvas(serial, canvas) {
      if (!this.supported || !serial || !this._isCanvasAttached(canvas)) return false;
      const session = this.sessions.get(serial);
      if (!session || session._closed) return false;

      this._pruneDetachedCanvases(session);
      session.addCanvas(canvas);
      if (!session.ws || (session.ws.readyState !== WebSocket.OPEN && session.ws.readyState !== WebSocket.CONNECTING)) {
        session.open();
      }
      return true;
    }

    /**
     * Conecta el stream para `serial` y dibuja en `canvas`.
     * Si ya hay sesion, agrega el canvas (reutiliza el WS).
     * Si `preset` cambio, re-arranca.
     */
    attach(serial, canvas, preset = null) {
      if (!this.supported || !serial || !canvas) return null;
      const wantPreset = preset || this.defaultPreset;

      let session = this.sessions.get(serial);
      if (session) {
        this._pruneDetachedCanvases(session);
        if (!this._hasValidFrame(session) && !this._isSessionAlive(session)) {
          console.log(`[H264-grid] Detectada sesion stale/congelada. Recreando master: ${serial}`);
          session = this._recreateSession(serial, wantPreset, canvas);
          this._startGridRecoveryWatchdog(serial, canvas, wantPreset);
          return session;
        }
      }

      if (!session) {
        session = new StreamSession(serial, this.wsBase, {
          preset: wantPreset,
          onError: this.onError,
          onFps: this.onFps,
          onSize: this.onSize,
        });
        this.sessions.set(serial, session);
        session.addCanvas(canvas);
        session.open();
      } else {
        if (session.preset !== wantPreset) session.setPreset(wantPreset);
        session.addCanvas(canvas);
        // Si es un canvas nuevo Y el WS no está conectado, reconectar.
        // NO resetear el decoder si el WS está activo — eso mataría el stream del grid.
        if (!session.ws || (session.ws.readyState !== WebSocket.OPEN && session.ws.readyState !== WebSocket.CONNECTING)) {
          session.open();
        }
      }
      this._startGridRecoveryWatchdog(serial, canvas, wantPreset);
      return session;
    }

    /** Desasocia un canvas. Si era el ultimo, cierra el WS. */
    detach(serial, canvas = null) {
      const session = this.sessions.get(serial);
      if (!session) return;
      if (canvas) session.removeCanvas(canvas);
      else session.canvases.clear();
      if (!session.hasCanvases()) {
        session.close();
        this._deleteSessionAliases(session, serial);
      }
    }

    setQuality(serial, preset) {
      const session = this.sessions.get(serial);
      if (session) session.setPreset(preset);
    }

    detachAll() {
      for (const [, s] of this.sessions) s.close();
      this.sessions.clear();
    }

    getStats(serial) {
      const s = this.sessions.get(serial);
      if (!s) return null;
      // calcular FPS instantaneo basado en la ventana de medicion del session.
      const now = performance.now();
      const window = Math.max(1, now - s._lastFpsAt);
      const fps = ((s._framesDecoded - s._lastFpsCount) / window) * 1000;
      return {
        serial,
        preset: s.preset,
        framesDecoded: s._framesDecoded,
        fps: +fps.toFixed(1),
        lastFrameAt: s._lastFrameAt || 0,
        width: s._frameW,
        height: s._frameH,
        connected: !!(s.ws && s.ws.readyState === WebSocket.OPEN),
        canvases: s.canvases.size,
        bytesReceived: s._bytesReceived,
        chunksReceived: s._chunksReceived,
        nalusEmitted: s._nalusEmitted,
        nalTypesCount: { ...s._nalTypesCount },
        spsCount: s._spsCount,
        ppsCount: s._ppsCount,
        idrCount: s._idrCount,
        nonIdrCount: s._nonIdrCount,
        decodeCalls: s._decodeCalls,
        decodeErrors: s._decodeErrors,
        lastChunkAt: s._lastChunkAt || 0,
        lastNaluAt: s._lastNaluAt || 0,
        lastIdrAt: s._lastIdrAt || 0,
        lastDecodeAt: s._lastDecodeAt || 0,
        residueBytes: s._residue ? s._residue.length : 0,
        waitingKeyframe: !!s._waitingKeyframe,
        configured: !!s._configured,
        decoderState: s.decoder ? s.decoder.state : 'none',
      };
    }
  }

  // Exponer al renderer global.
  if (typeof window !== 'undefined') {
    window.H264StreamRenderer = H264StreamRenderer;
  }
})();
