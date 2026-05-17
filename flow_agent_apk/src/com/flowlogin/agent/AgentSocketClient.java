package com.flowlogin.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

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

    private void loop(Context context, int runGeneration) {
        while (running && runGeneration == generation) {
            SharedPreferences prefs = context.getSharedPreferences("flow_agent", Context.MODE_PRIVATE);
            String host = prefs.getString("host", "127.0.0.1");
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
                PrintWriter writer = new PrintWriter(new OutputStreamWriter(activeSocket.getOutputStream(), StandardCharsets.UTF_8), true);
                writer.println(buildHello(context).toString());

                String line;
                while (running && (line = reader.readLine()) != null) {
                    handleIncoming(line, writer);
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
                closeSocket(activeSocket);
            }
            sleep(2200);
        }
    }

    private JSONObject buildHello(Context context) throws Exception {
        SharedPreferences prefs = context.getSharedPreferences("flow_agent", Context.MODE_PRIVATE);
        JSONObject hello = new JSONObject();
        hello.put("type", "hello");
        hello.put("agentId", Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID));
        hello.put("serial", prefs.getString("serial", ""));
        hello.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
        hello.put("manufacturer", Build.MANUFACTURER);
        hello.put("model", Build.MODEL);
        hello.put("androidVersion", Build.VERSION.RELEASE);
        hello.put("agentVersion", "0.2.4");
        hello.put("accessibility", FlowAccessibilityService.getInstance() != null);
        return hello;
    }

    private void handleIncoming(String line, PrintWriter writer) {
        try {
            JSONObject message = new JSONObject(line);
            String type = message.optString("type", "");
            if (!"command".equalsIgnoreCase(type)) return;

            String requestId = message.optString("requestId", "");
            JSONObject command = message.optJSONObject("command");
            if (command == null) command = new JSONObject();

            FlowAccessibilityService service = FlowAccessibilityService.getInstance();
            JSONObject result;
            if (service == null) {
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
