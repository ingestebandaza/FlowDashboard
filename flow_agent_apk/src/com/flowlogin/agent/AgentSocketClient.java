package com.flowlogin.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

public class AgentSocketClient {
    private static final AgentSocketClient INSTANCE = new AgentSocketClient();
    private volatile boolean running;
    private volatile boolean connected;
    private volatile String lastMessage = "Esperando conexion.";
    private volatile int generation;
    private Thread thread;
    private Socket socket;
    private volatile PrintWriter writer;

    public static AgentSocketClient get() {
        return INSTANCE;
    }

    public synchronized void restart(Context context) {
        stop();
        start(context.getApplicationContext());
    }

    public synchronized void start(final Context context) {
        if (running) return;
        running = true;
        generation += 1;
        final int runGeneration = generation;
        thread = new Thread(new Runnable() {
            @Override
            public void run() {
                loop(context.getApplicationContext(), runGeneration);
            }
        }, "FlowAgentSocket");
        thread.setDaemon(true);
        thread.start();
    }

    public synchronized void stop() {
        running = false;
        generation += 1;
        connected = false;
        closeSocket();
    }

    public boolean isConnected() {
        return connected;
    }

    public String getLastMessage() {
        return lastMessage;
    }

    public synchronized void sendFrame(JSONObject frameMessage) {
        try {
            if (writer == null || !connected) {
                return;
            }
            writer.println(frameMessage.toString());
            writer.flush();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void loop(Context context, int runGeneration) {
        sleep(2000);
        while (running && runGeneration == generation) {
            SharedPreferences prefs = context.getSharedPreferences("flow_agent", Context.MODE_PRIVATE);
            String host = prefs.getString("host", "localhost");
            int port = prefs.getInt("port", 8766);

            Socket activeSocket = null;
            try {
                lastMessage = "Conectando a " + host + ":" + port;
                activeSocket = new Socket();
                synchronized (this) {
                    socket = activeSocket;
                }
                activeSocket.connect(new InetSocketAddress(host, port), 5000);
                connected = true;
                lastMessage = "Socket conectado.";

                BufferedReader reader = new BufferedReader(new InputStreamReader(activeSocket.getInputStream(), StandardCharsets.UTF_8));
                PrintWriter localWriter = new PrintWriter(new OutputStreamWriter(activeSocket.getOutputStream(), StandardCharsets.UTF_8), true);
                synchronized (this) {
                    writer = localWriter;
                }
                writer.println(buildHello(context).toString());

                String line;
                while (running && (line = reader.readLine()) != null) {
                    handleIncoming(line, localWriter);
                }
                if (running && isCurrentSocket(activeSocket) && runGeneration == generation) {
                    lastMessage = "Servidor cerro la conexion. Reintentando...";
                }
            } catch (Exception exc) {
                if (isCurrentSocket(activeSocket) && runGeneration == generation) {
                    lastMessage = "Conexion fallida: " + exc.getMessage();
                }
            } finally {
                if (isCurrentSocket(activeSocket) && runGeneration == generation) {
                    connected = false;
                }
                synchronized (this) {
                    writer = null;
                }
                closeSocket(activeSocket);
            }
            sleep(2200);
        }
    }

    private JSONObject buildHello(Context context) throws Exception {
        String androidId = DeviceIdentity.getAndroidId(context);

        String adbSerial = "";
        for (int i = 0; i < 5; i++) {
            adbSerial = DeviceIdentity.resolveAdbSerial(context, true);
            if (DeviceIdentity.isUsableAdbSerial(adbSerial)) {
                break;
            }
            try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
        }

        if (!DeviceIdentity.isUsableAdbSerial(adbSerial)) {
            adbSerial = androidId == null || androidId.isEmpty() ? "" : "android:" + androidId;
        }

        final String finalSerial = adbSerial;
        new Thread(() -> registerDeviceInBackend(androidId, finalSerial)).start();

        JSONObject hello = new JSONObject();
        hello.put("type", "hello");
        hello.put("agentId", androidId);
        hello.put("serial", adbSerial);
        hello.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
        hello.put("manufacturer", Build.MANUFACTURER);
        hello.put("model", Build.MODEL);
        hello.put("androidVersion", Build.VERSION.RELEASE);
        hello.put("agentVersion", "0.3.8");
        hello.put("accessibility", FlowAccessibilityService.getInstance() != null);
        hello.put("keyboardInstalled", true);
        hello.put("keyboardActive", FlowKeyboardService.getInstance() != null);
        hello.put("keyboardName", "FlowKeyboard");
        return hello;
    }

    private void registerDeviceInBackend(String androidId, String adbSerial) {
        java.net.HttpURLConnection conn = null;
        try {
            String host = "localhost";
            int port = 5000;
            String url = "http://" + host + ":" + port + "/api/devices/register";

            java.net.URL urlObj = new java.net.URL(url);
            conn = (java.net.HttpURLConnection) urlObj.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);

            JSONObject payload = new JSONObject();
            payload.put("androidId", androidId);
            payload.put("adbSerial", adbSerial);

            conn.setDoOutput(true);
            java.io.OutputStream os = conn.getOutputStream();
            byte[] input = payload.toString().getBytes("utf-8");
            os.write(input, 0, input.length);
            os.close();

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                lastMessage = "Dispositivo registrado en backend";
            }
        } catch (Exception e) {
            lastMessage = "No se pudo registrar en backend: " + e.getMessage();
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void handleIncoming(String line, PrintWriter writer) {
        try {
            JSONObject message = new JSONObject(line);
            String type = message.optString("type", "");
            if (!"command".equalsIgnoreCase(type)) return;

            String requestId = message.optString("requestId", "");
            JSONObject command = message.optJSONObject("command");
            if (command == null) command = new JSONObject();
            String commandName = command.optString("name", "").toLowerCase(java.util.Locale.US);

            FlowAccessibilityService service = FlowAccessibilityService.getInstance();
            JSONObject result;
            if (commandName.startsWith("keyboard_")) {
                result = FlowKeyboardService.executeKeyboardCommand(command);
            } else if (service == null) {
                result = new JSONObject();
                result.put("ok", false);
                result.put("error", "AccessibilityService no esta activo.");
            } else {
                result = service.executeCommand(command);
            }

            JSONObject response = new JSONObject();
            response.put("type", "response");
            response.put("requestId", requestId);
            response.put("result", result);
            writer.println(response.toString());
            lastMessage = "Comando atendido: " + command.optString("name", "sin nombre");
        } catch (Exception exc) {
            lastMessage = "Error procesando comando: " + exc.getMessage();
        }
    }

    private void closeSocket() {
        Socket current;
        synchronized (this) {
            current = socket;
            socket = null;
        }
        closeSocket(current);
    }

    private void closeSocket(Socket target) {
        try {
            if (target != null) target.close();
        } catch (Exception ignored) {
        }
        synchronized (this) {
            if (socket == target) {
                socket = null;
            }
        }
    }

    private boolean isCurrentSocket(Socket target) {
        synchronized (this) {
            return socket != null && socket == target;
        }
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
        }
    }
}
