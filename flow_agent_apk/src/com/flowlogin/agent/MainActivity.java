package com.flowlogin.agent;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.accessibility.AccessibilityManager;
import android.widget.Button;
import android.widget.TextView;

/**
 * MainActivity PRO - Interfaz profesional para FlowAgent
 * 
 * Características:
 * - Diseño Material Design 3
 * - Monitoreo en tiempo real del estado
 * - Información del dispositivo
 * - Logs en vivo
 * - Controles intuitivos
 * - Solicitud de permisos de captura de pantalla
 */
public class MainActivity extends Activity {

    private static final int REQUEST_MEDIA_PROJECTION = 1001;

    private TextView statusText;
    private TextView connectionInfo;
    private TextView accessibilityStatus;
    private TextView socketStatus;
    private TextView captureStatus;
    private TextView deviceModel;
    private TextView androidVersion;
    private TextView deviceSerial;
    private TextView logsText;
    private View statusIndicator;
    private Button btnEnableAccessibility;
    private Button btnClearLogs;
    private Button btnEnableCapture;

    private AccessibilityManager accessibilityManager;
    private MediaProjectionManager mediaProjectionManager;
    private StringBuilder logsBuilder = new StringBuilder();
    private String lastDisplayedSerial = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        boolean shouldRestartSocket = persistLaunchIntent(getIntent());

        initializeViews();
        setupListeners();
        updateDeviceInfo();
        
        // Iniciar o reiniciar el socket con los extras actuales del dashboard.
        if (shouldRestartSocket) {
            AgentSocketClient.get().restart(this);
        } else {
            AgentSocketClient.get().start(this);
        }
        addLog("🔌 Socket cliente iniciado");
        
        startMonitoring();
        
        // Solicitar permisos de captura de pantalla automáticamente
        requestScreenCapturePermission();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        boolean shouldRestartSocket = persistLaunchIntent(intent);
        updateDeviceSerial(true);
        if (shouldRestartSocket) {
            AgentSocketClient.get().restart(this);
            addLog("Socket reiniciado con configuracion del dashboard");
        }
        if (intent != null && intent.getBooleanExtra("request_capture", false)) {
            requestScreenCapturePermission();
        }
    }

    private boolean persistLaunchIntent(Intent intent) {
        // Python lanza el APK con: --es host 127.0.0.1 --es serial 192.168.1.X:5555 --ei port 8766
        if (intent == null) return false;
        android.content.SharedPreferences prefs = getSharedPreferences("flow_agent", Context.MODE_PRIVATE);
        android.content.SharedPreferences.Editor editor = prefs.edit();
        String host = intent.getStringExtra("host");
        String serial = intent.getStringExtra("serial");
        int port = intent.getIntExtra("port", 0);
        boolean autoconnect = intent.getBooleanExtra("autoconnect", false);
        boolean changed = false;
        if (host != null && !host.isEmpty()) {
            editor.putString("host", host);
            changed = true;
        }
        if (serial != null && !serial.isEmpty()) {
            editor.putString("serial", serial);
            changed = true;
        }
        if (port > 0) {
            editor.putInt("port", port);
            changed = true;
        }
        editor.apply();
        return changed || autoconnect;
    }

    /**
     * Inicializa todas las vistas
     */
    private void initializeViews() {
        // statusText y connectionInfo fueron removidos del nuevo layout minimalista
        // statusText = (TextView) findViewById(R.id.status_text);
        // connectionInfo = (TextView) findViewById(R.id.connection_info);
        
        accessibilityStatus = (TextView) findViewById(R.id.accessibility_status);
        socketStatus = (TextView) findViewById(R.id.socket_status);
        captureStatus = (TextView) findViewById(R.id.capture_status);
        deviceModel = (TextView) findViewById(R.id.device_model);
        androidVersion = (TextView) findViewById(R.id.android_version);
        deviceSerial = (TextView) findViewById(R.id.device_serial);
        logsText = (TextView) findViewById(R.id.logs_text);
        statusIndicator = (View) findViewById(R.id.status_indicator);
        btnEnableAccessibility = (Button) findViewById(R.id.btn_enable_accessibility);
        btnClearLogs = (Button) findViewById(R.id.btn_clear_logs);

        accessibilityManager = (AccessibilityManager) getSystemService(Context.ACCESSIBILITY_SERVICE);
        mediaProjectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
    }

    /**
     * Configura los listeners de botones
     */
    private void setupListeners() {
        btnEnableAccessibility.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openAccessibilitySettings();
            }
        });
        
        btnClearLogs.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                clearLogs();
            }
        });
    }

    /**
     * Solicita permisos de captura de pantalla
     */
    private void requestScreenCapturePermission() {
        if (mediaProjectionManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Intent intent = mediaProjectionManager.createScreenCaptureIntent();
            startActivityForResult(intent, REQUEST_MEDIA_PROJECTION);
            addLog("📹 Solicitando permisos de captura de pantalla...");
        }
    }

    /**
     * Abre la configuración de accesibilidad
     */
    private void openAccessibilitySettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        startActivity(intent);
        addLog("📱 Abriendo configuración de accesibilidad...");
    }

    /**
     * Limpia los logs
     */
    private void clearLogs() {
        logsBuilder.setLength(0);
        logsText.setText("Logs limpiados");
        addLog("🗑️ Logs limpiados");
    }

    /**
     * Actualiza la información del dispositivo
     */
    private void updateDeviceInfo() {
        deviceModel.setText(Build.MODEL);
        androidVersion.setText("Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
        
        // Mostrar serial ADB desde SharedPreferences (guardado cuando Python lanza el APK)
        updateDeviceSerial(true);

        addLog("📋 Información del dispositivo cargada");
        addLog("   Modelo: " + Build.MODEL);
        addLog("   Android: " + Build.VERSION.RELEASE);
        addLog("   Serial ADB/WiFi: " + lastDisplayedSerial);
    }

    private void updateDeviceSerial(boolean forceLog) {
        String displaySerial = DeviceIdentity.resolveDisplaySerial(this);
        deviceSerial.setText(displaySerial);
        if (!displaySerial.equals(lastDisplayedSerial)) {
            lastDisplayedSerial = displaySerial;
            if (!forceLog) {
                addLog("   Serial ADB/WiFi actualizado: " + displaySerial);
            }
        }
    }

    /**
     * Inicia el monitoreo del estado
     */
    private void startMonitoring() {
        Thread monitorThread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (true) {
                    try {
                        Thread.sleep(1000); // Actualizar cada segundo

                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                updateAccessibilityStatus();
                                updateSocketStatus();
                                updateCaptureStatus();
                                updateDeviceSerial(false);
                                updateConnectionInfo();
                            }
                        });
                    } catch (InterruptedException e) {
                        e.printStackTrace();
                    }
                }
            }
        });
        monitorThread.setDaemon(true);
        monitorThread.start();

        addLog("👀 Monitoreo iniciado");
    }

    /**
     * Actualiza el estado de accesibilidad
     */
    private void updateAccessibilityStatus() {
        boolean isEnabled = isAccessibilityServiceEnabled();
        
        if (isEnabled) {
            accessibilityStatus.setText("✓ Habilitado");
            accessibilityStatus.setTextColor(0xFF4CAF50); // Verde
            btnEnableAccessibility.setText("Accesibilidad OK");
            btnEnableAccessibility.setEnabled(false);
        } else {
            accessibilityStatus.setText("✗ Deshabilitado");
            accessibilityStatus.setTextColor(0xFFF44336); // Rojo
            btnEnableAccessibility.setText("Habilitar Accesibilidad");
            btnEnableAccessibility.setEnabled(true);
        }
    }

    /**
     * Actualiza el estado del socket
     */
    private void updateSocketStatus() {
        boolean isConnected = AgentSocketClient.get() != null && AgentSocketClient.get().isConnected();
        
        if (isConnected) {
            socketStatus.setText("✓ Conectado");
            socketStatus.setTextColor(0xFF4CAF50); // Verde
        } else {
            socketStatus.setText("✗ Desconectado");
            socketStatus.setTextColor(0xFFF44336); // Rojo
        }
    }

    /**
     * Actualiza el estado de captura
     */
    private void updateCaptureStatus() {
        boolean isCapturing = MediaProjectionHolder.get() != null;
        
        if (isCapturing) {
            captureStatus.setText("✓ Activa");
            captureStatus.setTextColor(0xFF4CAF50); // Verde
        } else {
            captureStatus.setText("✗ Inactiva");
            captureStatus.setTextColor(0xFFF44336); // Rojo
        }
    }

    /**
     * Actualiza la información de conexión
     */
    private void updateConnectionInfo() {
        boolean isAccessibilityEnabled = isAccessibilityServiceEnabled();
        boolean isSocketConnected = AgentSocketClient.get() != null && AgentSocketClient.get().isConnected();

        // Actualizar indicador de estado
        if (isAccessibilityEnabled && isSocketConnected) {
            statusIndicator.setBackgroundColor(0xFF22b86f); // Verde
        } else if (isAccessibilityEnabled) {
            statusIndicator.setBackgroundColor(0xFFFFC107); // Amarillo
        } else {
            statusIndicator.setBackgroundColor(0xFFd45862); // Rojo
        }
    }

    /**
     * Verifica si el servicio de accesibilidad está habilitado
     */
    private boolean isAccessibilityServiceEnabled() {
        AccessibilityManager am = (AccessibilityManager) getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) return false;

        java.util.List<AccessibilityServiceInfo> services = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_GENERIC);
        for (AccessibilityServiceInfo service : services) {
            if (service.getId().contains("flowlogin")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Agrega un mensaje al log
     */
    private void addLog(String message) {
        String timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date());
        String logEntry = "[" + timestamp + "] " + message + "\n";
        
        logsBuilder.append(logEntry);
        
        // Mantener solo los últimos 100 logs
        String[] lines = logsBuilder.toString().split("\n");
        if (lines.length > 100) {
            logsBuilder.setLength(0);
            for (int i = lines.length - 100; i < lines.length; i++) {
                if (i >= 0) {
                    logsBuilder.append(lines[i]).append("\n");
                }
            }
        }

        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                logsText.setText(logsBuilder.toString());
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == RESULT_OK && data != null) {
                addLog("✓ Permisos de captura de pantalla otorgados");
                
                // Obtener MediaProjection y pasarlo al ScreenCaptureThread
                MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                if (mpm != null) {
                    try {
                        MediaProjection mediaProjection = mpm.getMediaProjection(resultCode, data);
                        if (mediaProjection != null) {
                            // Guardar globalmente para que FlowAccessibilityService pueda usarlo
                            MediaProjectionHolder.set(mediaProjection);
                            
                            // Crear e iniciar ScreenCaptureThread
                            FlowAccessibilityService service = FlowAccessibilityService.getInstance();
                            ScreenCaptureThread captureThread = new ScreenCaptureThread(service);
                            captureThread.setMediaProjection(mediaProjection);
                            captureThread.start();
                            addLog("✓ Captura de pantalla iniciada");
                        } else {
                            addLog("✗ No se pudo obtener MediaProjection");
                        }
                    } catch (Exception e) {
                        addLog("✗ Error al iniciar captura: " + e.getMessage());
                        e.printStackTrace();
                    }
                } else {
                    addLog("✗ MediaProjectionManager no disponible");
                }
            } else {
                addLog("✗ Permisos de captura de pantalla denegados");
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        addLog("📱 App en primer plano");
        updateAccessibilityStatus();
    }

    @Override
    protected void onPause() {
        super.onPause();
        addLog("📱 App en segundo plano");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        addLog("📱 App cerrada");
    }
}
