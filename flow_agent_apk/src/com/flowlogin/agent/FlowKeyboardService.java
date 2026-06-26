package com.flowlogin.agent;

import android.inputmethodservice.InputMethodService;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.widget.Button;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

public class FlowKeyboardService extends InputMethodService {
    private static volatile FlowKeyboardService instance;
    private volatile String lastAction = "Listo";
    private volatile long lastActionAt = 0L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, Button> visualKeys = new HashMap<>();
    private final Random random = new Random();
    private volatile TextView statusView;

    public static FlowKeyboardService getInstance() {
        return instance;
    }

    public static JSONObject statusSnapshot() throws Exception {
        FlowKeyboardService service = instance;
        JSONObject result = new JSONObject();
        result.put("ok", true);
        result.put("installed", true);
        result.put("active", service != null);
        result.put("hasInputConnection", service != null && service.getCurrentInputConnection() != null);
        result.put("lastAction", service == null ? "" : service.lastAction);
        result.put("lastActionAt", service == null ? 0L : service.lastActionAt);
        return result;
    }

    public static JSONObject executeKeyboardCommand(JSONObject command) throws Exception {
        FlowKeyboardService service = instance;
        if (service == null) {
            return failStatic("FlowKeyboard no esta activo como teclado actual.");
        }
        String name = command.optString("name", "").toLowerCase(Locale.US);
        if ("keyboard_status".equals(name)) {
            return statusSnapshot();
        }
        if ("keyboard_type".equals(name) || "keyboard_type_text".equals(name)) {
            return service.typeText(command.optString("text", ""), command.optInt("delayMs", 0));
        }
        if ("keyboard_type_human".equals(name) || "keyboard_type_text_human".equals(name)) {
            return service.typeTextHuman(
                    command.optString("text", ""),
                    command.optInt("minDelayMs", 80),
                    command.optInt("maxDelayMs", 220)
            );
        }
        if ("keyboard_clear".equals(name)) {
            return service.clearText();
        }
        if ("keyboard_backspace".equals(name)) {
            return service.backspace(command.optInt("count", 1));
        }
        if ("keyboard_enter".equals(name)) {
            return service.editorAction(EditorInfo.IME_ACTION_GO, "enter");
        }
        if ("keyboard_next".equals(name)) {
            return service.editorAction(EditorInfo.IME_ACTION_NEXT, "next");
        }
        if ("keyboard_done".equals(name)) {
            return service.editorAction(EditorInfo.IME_ACTION_DONE, "done");
        }
        return failStatic("Comando de teclado no soportado: " + name);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }

    @Override
    public View onCreateInputView() {
        View view = getLayoutInflater().inflate(R.layout.flow_keyboard_view, null);
        statusView = (TextView) view.findViewById(R.id.flow_keyboard_status);
        if (statusView != null) statusView.setText("FlowKeyboard listo");
        registerVisualKeys(view);
        bindButton(view, R.id.flow_key_backspace, new Runnable() {
            @Override public void run() {
                flashVisualKey("backspace");
                safeRun("backspace", () -> backspace(1));
            }
        });
        bindButton(view, R.id.flow_key_space, new Runnable() {
            @Override public void run() {
                flashVisualKey("space");
                safeRun("space", () -> typeText(" ", 0));
            }
        });
        bindButton(view, R.id.flow_key_enter, new Runnable() {
            @Override public void run() {
                flashVisualKey("enter");
                safeRun("enter", () -> editorAction(EditorInfo.IME_ACTION_DONE, "done"));
            }
        });
        return view;
    }

    private void registerVisualKeys(View root) {
        visualKeys.clear();
        registerCharKey(root, R.id.flow_key_q, "q");
        registerCharKey(root, R.id.flow_key_w, "w");
        registerCharKey(root, R.id.flow_key_e, "e");
        registerCharKey(root, R.id.flow_key_r, "r");
        registerCharKey(root, R.id.flow_key_t, "t");
        registerCharKey(root, R.id.flow_key_y, "y");
        registerCharKey(root, R.id.flow_key_u, "u");
        registerCharKey(root, R.id.flow_key_i, "i");
        registerCharKey(root, R.id.flow_key_o, "o");
        registerCharKey(root, R.id.flow_key_p, "p");
        registerCharKey(root, R.id.flow_key_a, "a");
        registerCharKey(root, R.id.flow_key_s, "s");
        registerCharKey(root, R.id.flow_key_d, "d");
        registerCharKey(root, R.id.flow_key_f, "f");
        registerCharKey(root, R.id.flow_key_g, "g");
        registerCharKey(root, R.id.flow_key_h, "h");
        registerCharKey(root, R.id.flow_key_j, "j");
        registerCharKey(root, R.id.flow_key_k, "k");
        registerCharKey(root, R.id.flow_key_l, "l");
        registerCharKey(root, R.id.flow_key_z, "z");
        registerCharKey(root, R.id.flow_key_x, "x");
        registerCharKey(root, R.id.flow_key_c, "c");
        registerCharKey(root, R.id.flow_key_v, "v");
        registerCharKey(root, R.id.flow_key_b, "b");
        registerCharKey(root, R.id.flow_key_n, "n");
        registerCharKey(root, R.id.flow_key_m, "m");
        registerSpecialKey(root, R.id.flow_key_symbol, "symbol");
        registerSpecialKey(root, R.id.flow_key_space, "space");
        registerSpecialKey(root, R.id.flow_key_enter, "enter");
        registerSpecialKey(root, R.id.flow_key_backspace, "backspace");
    }

    private void registerCharKey(View root, int id, final String value) {
        Button button = (Button) root.findViewById(id);
        if (button == null) return;
        visualKeys.put(value, button);
        button.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                flashVisualKey(value);
                safeRun(value, () -> typeText(value, 0));
            }
        });
    }

    private void registerSpecialKey(View root, int id, String name) {
        Button button = (Button) root.findViewById(id);
        if (button != null) visualKeys.put(name, button);
    }

    private void bindButton(View root, int id, final Runnable action) {
        Button button = (Button) root.findViewById(id);
        if (button == null) return;
        button.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                action.run();
            }
        });
    }

    private interface JsonAction {
        JSONObject run() throws Exception;
    }

    private void safeRun(String label, JsonAction action) {
        try {
            action.run();
        } catch (Exception exc) {
            mark("Error " + label);
        }
    }

    private JSONObject typeText(String text, int delayMs) throws Exception {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) return fail("No hay campo de texto enfocado.");
        String value = text == null ? "" : text;
        int safeDelay = Math.max(0, Math.min(delayMs, 350));
        if (safeDelay <= 0 || value.length() <= 1) {
            if (value.length() == 1) flashVisualKey(keyNameFor(value.charAt(0)));
            ic.commitText(value, 1);
        } else {
            for (int i = 0; i < value.length(); i += 1) {
                char ch = value.charAt(i);
                flashVisualKey(keyNameFor(ch));
                ic.commitText(String.valueOf(ch), 1);
                SystemClock.sleep(safeDelay);
            }
        }
        mark("Texto enviado (" + value.length() + " chars)");
        return ok().put("chars", value.length());
    }

    private JSONObject typeTextHuman(String text, int minDelayMs, int maxDelayMs) throws Exception {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) return fail("No hay campo de texto enfocado.");
        String value = text == null ? "" : text;
        int minDelay = Math.max(35, Math.min(minDelayMs, 500));
        int maxDelay = Math.max(minDelay, Math.min(maxDelayMs, 700));
        updateStatus("Tipeando...");
        try {
            for (int i = 0; i < value.length(); i += 1) {
                char ch = value.charAt(i);
                flashVisualKey(keyNameFor(ch));
                ic.commitText(String.valueOf(ch), 1);
                int delay = minDelay + random.nextInt((maxDelay - minDelay) + 1);
                SystemClock.sleep(delay);
            }
        } finally {
            updateStatus("FlowKeyboard listo");
        }
        mark("Texto humano (" + value.length() + " chars)");
        return ok().put("chars", value.length()).put("mode", "human");
    }

    private JSONObject clearText() throws Exception {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) return fail("No hay campo de texto enfocado.");
        CharSequence before = ic.getTextBeforeCursor(10000, 0);
        CharSequence after = ic.getTextAfterCursor(10000, 0);
        int beforeLen = before == null ? 0 : before.length();
        int afterLen = after == null ? 0 : after.length();
        ic.deleteSurroundingText(beforeLen, afterLen);
        mark("Campo limpiado");
        return ok().put("deletedBefore", beforeLen).put("deletedAfter", afterLen);
    }

    private JSONObject backspace(int count) throws Exception {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) return fail("No hay campo de texto enfocado.");
        int safeCount = Math.max(1, Math.min(count, 200));
        for (int i = 0; i < safeCount; i += 1) {
            flashVisualKey("backspace");
            ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL));
            ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DEL));
        }
        mark("Backspace x" + safeCount);
        return ok().put("count", safeCount);
    }

    private JSONObject editorAction(int action, String label) throws Exception {
        InputConnection ic = getCurrentInputConnection();
        if (ic == null) return fail("No hay campo de texto enfocado.");
        boolean sent = ic.performEditorAction(action);
        if (!sent && "enter".equals(label)) {
            flashVisualKey("enter");
            ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER));
            ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER));
            sent = true;
        }
        mark("Accion " + label);
        return sent ? ok().put("action", label) : fail("No se pudo enviar accion " + label);
    }

    private void mark(String action) {
        lastAction = action;
        lastActionAt = System.currentTimeMillis();
    }

    private String keyNameFor(char ch) {
        if (ch == ' ') return "space";
        if (ch == '\n' || ch == '\r') return "enter";
        String value = String.valueOf(ch).toLowerCase(Locale.US);
        if (value.length() == 1 && ((value.charAt(0) >= 'a' && value.charAt(0) <= 'z')
                || (value.charAt(0) >= '0' && value.charAt(0) <= '9'))) {
            return value;
        }
        return "symbol";
    }

    private void flashVisualKey(final String keyName) {
        mainHandler.post(new Runnable() {
            @Override public void run() {
                final Button button = visualKeys.get(keyName);
                if (button == null) return;
                button.setPressed(true);
                button.setTextColor(Color.WHITE);
                button.animate().cancel();
                button.animate().scaleX(0.92f).scaleY(0.92f).alpha(0.72f).setDuration(45).start();
                mainHandler.postDelayed(new Runnable() {
                    @Override public void run() {
                        button.setPressed(false);
                        button.setTextColor("enter".equals(keyName) ? Color.WHITE : Color.parseColor("#E7EEFC"));
                        button.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(90).start();
                    }
                }, 120L);
            }
        });
    }

    private void updateStatus(final String text) {
        mainHandler.post(new Runnable() {
            @Override public void run() {
                if (statusView != null) statusView.setText(text);
            }
        });
    }

    private JSONObject ok() throws Exception {
        JSONObject result = new JSONObject();
        result.put("ok", true);
        result.put("keyboard", "FlowKeyboard");
        return result;
    }

    private JSONObject fail(String error) throws Exception {
        return failStatic(error);
    }

    private static JSONObject failStatic(String error) throws Exception {
        JSONObject result = new JSONObject();
        result.put("ok", false);
        result.put("keyboard", "FlowKeyboard");
        result.put("error", error == null ? "Error desconocido" : error);
        return result;
    }
}
