package com.flowlogin.agent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class FlowAccessibilityService extends AccessibilityService {
    private static volatile FlowAccessibilityService instance;

    public static FlowAccessibilityService getInstance() {
        return instance;
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        AgentSocketClient.get().start(this);
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        AgentSocketClient.get().stop();
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
    }

    @Override
    public void onInterrupt() {
    }

    public void restartSocket() {
        AgentSocketClient.get().restart(this);
    }

    public JSONObject executeCommand(JSONObject command) {
        try {
            String name = command.optString("name", "ping").toLowerCase(Locale.US);
            if ("ping".equals(name)) {
                return ok().put("message", "pong");
            }
            if ("status".equals(name)) {
                return status();
            }
            if ("dump".equals(name)) {
                return dump(command.optInt("maxNodes", 120));
            }
            if ("launchpackage".equals(name) || "launch_package".equals(name)) {
                return launchPackage(command.optString("packageName", command.optString("package", "")));
            }
            if ("openappinfo".equals(name) || "open_app_info".equals(name)) {
                return openAppInfo(command.optString("packageName", command.optString("package", "")));
            }
            if ("getedittexts".equals(name) || "get_edit_texts".equals(name)) {
                return getEditTexts();
            }
            if ("clicktext".equals(name) || "click_text".equals(name)) {
                return clickText(command.optString("text", ""), command.optBoolean("contains", true));
            }
            if ("settext".equals(name) || "set_text".equals(name)) {
                return setText(command.optString("text", ""), command.optString("targetText", ""));
            }
            if ("settextindex".equals(name) || "set_text_index".equals(name)) {
                return setTextIndex(command.optInt("index", 0), command.optString("text", ""));
            }
            if ("tap".equals(name)) {
                return tap(command.optInt("x", -1), command.optInt("y", -1));
            }
            if ("swipe".equals(name)) {
                return swipe(
                    command.optInt("startX", -1),
                    command.optInt("startY", -1),
                    command.optInt("endX", -1),
                    command.optInt("endY", -1),
                    command.optInt("duration", 350)
                );
            }
            if ("home".equals(name)) {
                return global(GLOBAL_ACTION_HOME, "home");
            }
            if ("back".equals(name)) {
                return global(GLOBAL_ACTION_BACK, "back");
            }
            if ("recents".equals(name)) {
                return global(GLOBAL_ACTION_RECENTS, "recents");
            }
            return fail("Comando no soportado: " + name);
        } catch (Exception exc) {
            try {
                return fail(exc.getMessage());
            } catch (Exception ignored) {
                return new JSONObject();
            }
        }
    }

    private JSONObject status() throws Exception {
        JSONObject result = ok();
        AccessibilityNodeInfo root = getRootInActiveWindow();
        result.put("hasRoot", root != null);
        if (root != null) {
            result.put("packageName", safe(root.getPackageName()));
            result.put("className", safe(root.getClassName()));
        }
        return result;
    }

    private JSONObject dump(int maxNodes) throws Exception {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return fail("No hay ventana activa.");
        JSONArray nodes = new JSONArray();
        int[] count = new int[] {0};
        appendNode(root, nodes, count, Math.max(1, Math.min(maxNodes, 500)));
        return ok().put("nodes", nodes).put("count", nodes.length());
    }

    private void appendNode(AccessibilityNodeInfo node, JSONArray nodes, int[] count, int maxNodes) throws Exception {
        if (node == null || count[0] >= maxNodes) return;
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        JSONObject item = new JSONObject();
        item.put("text", safe(node.getText()));
        item.put("desc", safe(node.getContentDescription()));
        item.put("className", safe(node.getClassName()));
        item.put("clickable", node.isClickable());
        item.put("checkable", node.isCheckable());
        item.put("checked", node.isChecked());
        item.put("selected", node.isSelected());
        item.put("enabled", node.isEnabled());
        item.put("editable", node.isEditable());
        item.put("focused", node.isFocused());
        item.put("bounds", rect.left + "," + rect.top + "," + rect.right + "," + rect.bottom);
        nodes.put(item);
        count[0] += 1;
        for (int i = 0; i < node.getChildCount() && count[0] < maxNodes; i += 1) {
            appendNode(node.getChild(i), nodes, count, maxNodes);
        }
    }

    private JSONObject launchPackage(String packageName) throws Exception {
        if (packageName == null || packageName.trim().isEmpty()) return fail("Falta packageName.");
        Intent intent = getPackageManager().getLaunchIntentForPackage(packageName.trim());
        if (intent == null) return fail("No se encontro actividad launcher para " + packageName);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        startActivity(intent);
        return ok().put("message", "launchPackage ejecutado").put("packageName", packageName.trim());
    }

    private JSONObject openAppInfo(String packageName) throws Exception {
        if (packageName == null || packageName.trim().isEmpty()) return fail("Falta packageName.");
        Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + packageName.trim()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(intent);
        return ok().put("message", "openAppInfo ejecutado").put("packageName", packageName.trim());
    }

    private JSONObject getEditTexts() throws Exception {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return fail("No hay ventana activa.");
        List<AccessibilityNodeInfo> editTexts = sortedEditTexts(root);
        JSONArray nodes = new JSONArray();
        for (int i = 0; i < editTexts.size(); i += 1) {
            AccessibilityNodeInfo node = editTexts.get(i);
            Rect rect = new Rect();
            node.getBoundsInScreen(rect);
            JSONObject item = new JSONObject();
            item.put("index", i);
            item.put("text", safe(node.getText()));
            item.put("desc", safe(node.getContentDescription()));
            item.put("className", safe(node.getClassName()));
            item.put("focused", node.isFocused());
            item.put("bounds", rect.left + "," + rect.top + "," + rect.right + "," + rect.bottom);
            nodes.put(item);
        }
        return ok().put("nodes", nodes).put("count", nodes.length());
    }

    private JSONObject clickText(String text, boolean contains) throws Exception {
        if (text == null || text.trim().isEmpty()) return fail("Falta text.");
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return fail("No hay ventana activa.");
        AccessibilityNodeInfo node = findByText(root, text.trim(), contains);
        if (node == null) return fail("No se encontro texto: " + text);
        boolean clicked = clickNode(node);
        return clicked ? ok().put("message", "clickText ejecutado") : fail("No se pudo hacer click.");
    }

    private JSONObject setText(String value, String targetText) throws Exception {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return fail("No hay ventana activa.");
        AccessibilityNodeInfo node = null;
        if (targetText != null && !targetText.trim().isEmpty()) {
            node = findByText(root, targetText.trim(), true);
        }
        if (node == null) {
            node = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        }
        if (node == null) {
            node = findEditable(root);
        }
        if (node == null) return fail("No se encontro campo editable.");
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value);
        boolean changed = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
        return changed ? ok().put("message", "setText ejecutado") : fail("No se pudo escribir texto.");
    }

    private JSONObject setTextIndex(int index, String value) throws Exception {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return fail("No hay ventana activa.");
        List<AccessibilityNodeInfo> editTexts = sortedEditTexts(root);
        if (editTexts.isEmpty()) return fail("No se encontraron campos editables.");
        int targetIndex = index;
        if (targetIndex < 0) {
            targetIndex = editTexts.size() + targetIndex;
        }
        if (targetIndex < 0 || targetIndex >= editTexts.size()) {
            return fail("Indice editable fuera de rango: " + index);
        }
        AccessibilityNodeInfo node = editTexts.get(targetIndex);
        node.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, value);
        boolean changed = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
        return changed ? ok().put("message", "setTextIndex ejecutado").put("index", targetIndex) : fail("No se pudo escribir texto.");
    }

    private AccessibilityNodeInfo findEditable(AccessibilityNodeInfo node) {
        if (node == null) return null;
        if (node.isEditable()) return node;
        for (int i = 0; i < node.getChildCount(); i += 1) {
            AccessibilityNodeInfo child = findEditable(node.getChild(i));
            if (child != null) return child;
        }
        return null;
    }

    private List<AccessibilityNodeInfo> sortedEditTexts(AccessibilityNodeInfo root) {
        ArrayList<AccessibilityNodeInfo> nodes = new ArrayList<>();
        appendEditable(root, nodes);
        Collections.sort(nodes, new Comparator<AccessibilityNodeInfo>() {
            @Override
            public int compare(AccessibilityNodeInfo a, AccessibilityNodeInfo b) {
                Rect ar = new Rect();
                Rect br = new Rect();
                a.getBoundsInScreen(ar);
                b.getBoundsInScreen(br);
                if (ar.top != br.top) return ar.top - br.top;
                return ar.left - br.left;
            }
        });
        return nodes;
    }

    private void appendEditable(AccessibilityNodeInfo node, List<AccessibilityNodeInfo> nodes) {
        if (node == null) return;
        if (node.isEditable()) {
            nodes.add(node);
        }
        for (int i = 0; i < node.getChildCount(); i += 1) {
            appendEditable(node.getChild(i), nodes);
        }
    }

    private AccessibilityNodeInfo findByText(AccessibilityNodeInfo node, String needle, boolean contains) {
        if (node == null) return null;
        String text = (safe(node.getText()) + " " + safe(node.getContentDescription())).trim();
        String haystack = text.toLowerCase(Locale.US);
        String wanted = needle.toLowerCase(Locale.US);
        if (contains ? haystack.contains(wanted) : haystack.equals(wanted)) {
            return node;
        }
        for (int i = 0; i < node.getChildCount(); i += 1) {
            AccessibilityNodeInfo found = findByText(node.getChild(i), needle, contains);
            if (found != null) return found;
        }
        return null;
    }

    private boolean clickNode(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        while (current != null) {
            if (current.isClickable() && current.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true;
            }
            current = current.getParent();
        }
        Rect rect = new Rect();
        node.getBoundsInScreen(rect);
        return tap(rect.centerX(), rect.centerY()).optBoolean("ok", false);
    }

    private JSONObject tap(int x, int y) {
        try {
            if (x < 0 || y < 0) return fail("Coordenadas invalidas.");
            Path path = new Path();
            path.moveTo(x, y);
            GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(path, 0, 80);
            GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
            boolean ok = dispatchGesture(gesture, null, null);
            return ok ? ok().put("message", "tap ejecutado") : fail("No se pudo enviar tap.");
        } catch (Exception exc) {
            try {
                return fail(exc.getMessage());
            } catch (Exception ignored) {
                return new JSONObject();
            }
        }
    }

    private JSONObject swipe(int startX, int startY, int endX, int endY, int durationMs) {
        try {
            if (startX < 0 || startY < 0 || endX < 0 || endY < 0) return fail("Coordenadas invalidas.");
            Path path = new Path();
            path.moveTo(startX, startY);
            path.lineTo(endX, endY);
            int safeDuration = Math.max(120, Math.min(durationMs, 1800));
            GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(path, 0, safeDuration);
            GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
            boolean ok = dispatchGesture(gesture, null, null);
            return ok ? ok().put("message", "swipe ejecutado") : fail("No se pudo enviar swipe.");
        } catch (Exception exc) {
            try {
                return fail(exc.getMessage());
            } catch (Exception ignored) {
                return new JSONObject();
            }
        }
    }

    private JSONObject global(int action, String name) throws Exception {
        boolean ok = performGlobalAction(action);
        return ok ? ok().put("message", name + " ejecutado") : fail("No se pudo ejecutar " + name);
    }

    private JSONObject ok() throws Exception {
        JSONObject result = new JSONObject();
        result.put("ok", true);
        return result;
    }

    private JSONObject fail(String error) throws Exception {
        JSONObject result = new JSONObject();
        result.put("ok", false);
        result.put("error", error == null ? "Error desconocido" : error);
        return result;
    }

    private String safe(CharSequence value) {
        return value == null ? "" : value.toString();
    }
}
