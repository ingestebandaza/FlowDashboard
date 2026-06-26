package com.flowlogin.agent;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.Looper;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * Thread que captura la pantalla del dispositivo cada 100ms como WebP
 * y envia los frames al backend via socket.
 */
public class ScreenCaptureThread extends Thread {
    private static final int CAPTURE_INTERVAL_MS = 100; // 10 fps
    private static final int WEBP_QUALITY = 70;
    private static final int VIRTUAL_DISPLAY_DPI = 160;

    private final FlowAccessibilityService service;
    private volatile boolean running = false;
    private volatile boolean stopped = false;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int screenWidth;
    private int screenHeight;

    public ScreenCaptureThread(FlowAccessibilityService service) {
        this.service = service;
        this.setName("ScreenCaptureThread");
        this.setDaemon(true);
    }

    /**
     * Establece la MediaProjection obtenida de startActivityForResult
     */
    public void setMediaProjection(MediaProjection mediaProjection) {
        this.mediaProjection = mediaProjection;
    }

    @Override
    public void run() {
        try {
            running = true;
            
            // Esperar a que se establezca mediaProjection (máximo 10 segundos)
            int waitCount = 0;
            while (mediaProjection == null && waitCount < 100) {
                Thread.sleep(100);
                waitCount++;
            }
            
            if (mediaProjection == null) {
                throw new Exception("MediaProjection no fue establecida");
            }
            
            initializeCapture();
            captureLoop();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            cleanup();
            running = false;
            stopped = true;
        }
    }

    private void initializeCapture() throws Exception {
        // Obtener dimensiones de pantalla
        screenWidth = 1080;
        screenHeight = 1920;

        // Crear ImageReader para capturar frames
        imageReader = ImageReader.newInstance(
            screenWidth,
            screenHeight,
            PixelFormat.RGBA_8888,
            2 // buffer count
        );

        // Crear VirtualDisplay para captura
        if (mediaProjection != null) {
            virtualDisplay = mediaProjection.createVirtualDisplay(
                "FlowAgent Screen Capture",
                screenWidth,
                screenHeight,
                VIRTUAL_DISPLAY_DPI,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                null
            );
        }
    }

    private void captureLoop() {
        while (running && !stopped) {
            try {
                captureAndSendFrame();
                Thread.sleep(CAPTURE_INTERVAL_MS);
            } catch (InterruptedException e) {
                break;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void captureAndSendFrame() throws Exception {
        if (imageReader == null) {
            return;
        }

        Image image = imageReader.acquireLatestImage();
        if (image == null) {
            return;
        }

        try {
            // Convertir Image a Bitmap
            Bitmap bitmap = imageToBitmap(image);
            if (bitmap == null) {
                return;
            }

            // Comprimir a WebP
            byte[] webpData = compressToWebP(bitmap);
            bitmap.recycle();

            // Enviar al backend
            sendFrameToBackend(webpData);
        } finally {
            image.close();
        }
    }

    private Bitmap imageToBitmap(Image image) {
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int width = image.getWidth();
        int height = image.getHeight();

        // Usar rowStride para manejar el padding correcto de cada fila
        int rowPadding = rowStride - pixelStride * width;
        Bitmap bitmap = Bitmap.createBitmap(width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888);
        bitmap.copyPixelsFromBuffer(buffer);

        // Recortar al tamaño real si hay padding
        if (rowPadding != 0) {
            Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height);
            bitmap.recycle();
            return cropped;
        }
        return bitmap;
    }

    private byte[] compressToWebP(Bitmap bitmap) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        
        // Usar WebP compression si esta disponible
        // Android 10+: WEBP_LOSSY
        // Android 4.2.1-9: WEBP
        // Fallback: PNG
        boolean compressed = false;
        
        try {
            // Intentar WEBP_LOSSY (Android 10+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                compressed = bitmap.compress(Bitmap.CompressFormat.WEBP_LOSSY, WEBP_QUALITY, baos);
            } else {
                // Android 9 y anteriores: usar WEBP sin LOSSY
                compressed = bitmap.compress(Bitmap.CompressFormat.WEBP, WEBP_QUALITY, baos);
            }
        } catch (Exception e) {
            // Fallback a PNG si WebP falla
            try {
                compressed = bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos);
            } catch (Exception e2) {
                throw new Exception("No se pudo comprimir el bitmap: " + e2.getMessage());
            }
        }

        if (!compressed) {
            throw new Exception("No se pudo comprimir el bitmap");
        }

        return baos.toByteArray();
    }

    private void sendFrameToBackend(byte[] frameData) {
        try {
            AgentSocketClient client = AgentSocketClient.get();
            if (client == null || !client.isConnected()) {
                return;
            }

            // Crear mensaje de frame en formato JSON
            // El frame se envia como base64 para compatibilidad con JSON
            String base64Frame = android.util.Base64.encodeToString(frameData, android.util.Base64.NO_WRAP);
            
            // Obtener androidId para identificar el dispositivo en el backend
            String androidId = android.provider.Settings.Secure.getString(
                service.getContentResolver(),
                android.provider.Settings.Secure.ANDROID_ID
            );

            org.json.JSONObject frameMessage = new org.json.JSONObject();
            frameMessage.put("type", "frame");
            frameMessage.put("serial", androidId != null ? androidId : "");
            frameMessage.put("format", "webp");
            frameMessage.put("data", base64Frame);
            frameMessage.put("timestamp", System.currentTimeMillis());

            // Enviar via socket
            // Nota: Esto requiere que AgentSocketClient exponga el writer de forma thread-safe
            // Por ahora, usamos el metodo sendFrame que se agregó
            client.sendFrame(frameMessage);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void stopCapture() {
        running = false;
        stopped = true;
    }

    public boolean isRunning() {
        return running && !stopped;
    }

    private void cleanup() {
        try {
            if (virtualDisplay != null) {
                virtualDisplay.release();
                virtualDisplay = null;
            }
            if (imageReader != null) {
                imageReader.close();
                imageReader = null;
            }
            if (mediaProjection != null) {
                mediaProjection.stop();
                mediaProjection = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
