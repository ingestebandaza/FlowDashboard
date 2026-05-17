package com.flowlogin.agent;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String PREFS = "flow_agent";

    private EditText hostInput;
    private EditText portInput;
    private TextView accessibilityChip;
    private TextView socketChip;
    private TextView lastMessageText;
    private TextView configSummaryText;
    private TextView heroStatusText;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable statusTick = new Runnable() {
        @Override
        public void run() {
            updateStatus();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(7, 17, 31));

        applyIntentConfig(getIntent());
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        hostInput = new EditText(this);
        portInput = new EditText(this);

        setContentView(buildContent(prefs));
        autoConnectFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyIntentConfig(intent);
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        hostInput.setText(prefs.getString("host", "127.0.0.1"));
        portInput.setText(String.valueOf(prefs.getInt("port", 8766)));
        autoConnectFromIntent(intent);
        updateStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        statusTick.run();
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(statusTick);
    }

    private View buildContent(SharedPreferences prefs) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackground(gradient(
            new int[] {Color.rgb(7, 17, 31), Color.rgb(12, 29, 47), Color.rgb(6, 12, 24)},
            0
        ));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(20), dp(18), dp(22));
        scroll.addView(root, new ScrollView.LayoutParams(
            ScrollView.LayoutParams.MATCH_PARENT,
            ScrollView.LayoutParams.WRAP_CONTENT
        ));

        root.addView(buildHero());
        root.addView(buildStatusPanel());
        root.addView(buildConnectionPanel(prefs));
        root.addView(buildActionPanel());
        root.addView(buildLogPanel());
        return scroll;
    }

    private View buildHero() {
        LinearLayout hero = card();
        hero.setPadding(dp(16), dp(16), dp(16), dp(16));
        hero.setBackground(gradient(
            new int[] {Color.rgb(16, 52, 68), Color.rgb(10, 24, 42)},
            dp(22)
        ));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        hero.addView(row);

        TextView mark = text("F", 28, true);
        mark.setGravity(Gravity.CENTER);
        mark.setTextColor(Color.WHITE);
        mark.setBackground(gradient(
            new int[] {Color.rgb(20, 184, 166), Color.rgb(34, 184, 111)},
            dp(18)
        ));
        LinearLayout.LayoutParams markParams = new LinearLayout.LayoutParams(dp(58), dp(58));
        row.addView(mark, markParams);

        LinearLayout titleStack = new LinearLayout(this);
        titleStack.setOrientation(LinearLayout.VERTICAL);
        titleStack.setPadding(dp(14), 0, 0, 0);
        row.addView(titleStack, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView title = text("FlowAgent", 28, true);
        TextView subtitle = text("Motor socket para FlowLogin", 13, false);
        subtitle.setTextColor(Color.rgb(183, 203, 232));
        heroStatusText = text("Esperando estado", 12, true);
        heroStatusText.setTextColor(Color.rgb(186, 252, 242));
        heroStatusText.setPadding(0, dp(6), 0, 0);
        titleStack.addView(title);
        titleStack.addView(subtitle);
        titleStack.addView(heroStatusText);

        TextView badge = text("0.2.4", 12, true);
        badge.setGravity(Gravity.CENTER);
        badge.setTextColor(Color.rgb(186, 252, 242));
        badge.setBackground(outline(Color.rgb(18, 42, 60), Color.rgb(20, 184, 166), dp(999)));
        row.addView(badge, new LinearLayout.LayoutParams(dp(62), dp(32)));
        return hero;
    }

    private View buildStatusPanel() {
        LinearLayout panel = card();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));

        TextView title = sectionTitle("Estado en vivo");
        panel.addView(title);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        row.setPadding(0, dp(10), 0, 0);
        panel.addView(row);

        accessibilityChip = statusChip("Accesibilidad");
        socketChip = statusChip("Socket");
        LinearLayout.LayoutParams chipParams = new LinearLayout.LayoutParams(0, dp(58), 1);
        chipParams.rightMargin = dp(8);
        row.addView(accessibilityChip, chipParams);

        LinearLayout.LayoutParams chipParams2 = new LinearLayout.LayoutParams(0, dp(58), 1);
        row.addView(socketChip, chipParams2);
        return panel;
    }

    private View buildConnectionPanel(SharedPreferences prefs) {
        LinearLayout panel = card();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        panel.addView(sectionTitle("Conexion"));

        configSummaryText = text("", 12, true);
        configSummaryText.setTextColor(Color.rgb(159, 176, 204));
        configSummaryText.setPadding(0, dp(4), 0, dp(12));
        panel.addView(configSummaryText);

        hostInput.setSingleLine(true);
        hostInput.setText(prefs.getString("host", "127.0.0.1"));
        hostInput.setHint("127.0.0.1");
        styleInput(hostInput);
        panel.addView(label("Host"));
        panel.addView(hostInput);

        portInput.setSingleLine(true);
        portInput.setText(String.valueOf(prefs.getInt("port", 8766)));
        portInput.setHint("8766");
        styleInput(portInput);
        panel.addView(label("Puerto"));
        panel.addView(portInput);
        return panel;
    }

    private View buildActionPanel() {
        LinearLayout panel = card();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        panel.addView(sectionTitle("Acciones"));

        Button save = primaryButton("Guardar y conectar");
        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                saveConfig();
                FlowAccessibilityService service = FlowAccessibilityService.getInstance();
                if (service != null) {
                    service.restartSocket();
                } else {
                    openAccessibilitySettings();
                }
                updateStatus();
            }
        });
        panel.addView(save);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(10), 0, 0);
        panel.addView(row);

        Button accessibility = secondaryButton("Accesibilidad");
        accessibility.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openAccessibilitySettings();
            }
        });
        LinearLayout.LayoutParams left = new LinearLayout.LayoutParams(0, dp(48), 1);
        left.rightMargin = dp(8);
        row.addView(accessibility, left);

        Button appSettings = secondaryButton("Ajustes app");
        appSettings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            }
        });
        row.addView(appSettings, new LinearLayout.LayoutParams(0, dp(48), 1));
        return panel;
    }

    private View buildLogPanel() {
        LinearLayout panel = card();
        panel.setPadding(dp(14), dp(14), dp(14), dp(14));
        panel.addView(sectionTitle("Ultimo mensaje"));
        lastMessageText = text("Esperando conexion.", 13, false);
        lastMessageText.setTextColor(Color.rgb(207, 221, 245));
        lastMessageText.setPadding(0, dp(8), 0, 0);
        panel.addView(lastMessageText);
        return panel;
    }

    private void saveConfig() {
        int port = 8766;
        try {
            port = Integer.parseInt(portInput.getText().toString().trim());
        } catch (Exception ignored) {
        }
        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit()
            .putString("host", hostInput.getText().toString().trim())
            .putInt("port", port)
            .apply();
    }

    private void applyIntentConfig(Intent intent) {
        if (intent == null) return;
        boolean changed = false;
        SharedPreferences.Editor editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        if (intent.hasExtra("host")) {
            String host = intent.getStringExtra("host");
            if (host != null && host.trim().length() > 0) {
                editor.putString("host", host.trim());
                changed = true;
            }
        }
        if (intent.hasExtra("port")) {
            int port = intent.getIntExtra("port", 8766);
            if (port > 0) {
                editor.putInt("port", port);
                changed = true;
            }
        }
        if (intent.hasExtra("serial")) {
            String serial = intent.getStringExtra("serial");
            if (serial != null && serial.trim().length() > 0) {
                editor.putString("serial", serial.trim());
                changed = true;
            }
        }
        if (changed) {
            editor.apply();
        }
    }

    private void autoConnectFromIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("autoconnect", false)) return;
        FlowAccessibilityService service = FlowAccessibilityService.getInstance();
        if (service != null) {
            service.restartSocket();
        }
    }

    private void openAccessibilitySettings() {
        startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
    }

    private void updateStatus() {
        FlowAccessibilityService service = FlowAccessibilityService.getInstance();
        boolean accessibility = service != null;
        boolean accessibilitySettingEnabled = isAccessibilitySettingEnabled();
        boolean socket = AgentSocketClient.get().isConnected();
        String last = AgentSocketClient.get().getLastMessage();

        updateChip(accessibilityChip, "Accesibilidad", accessibility, accessibility ? "Activo" : (accessibilitySettingEnabled ? "Sin enlazar" : "Pendiente"));
        updateChip(socketChip, "Socket", socket, socket ? "Activo" : "Pendiente");
        heroStatusText.setText(socket ? "Conectado al dashboard" : (accessibilitySettingEnabled && !accessibility ? "Reactiva Accesibilidad" : "Esperando dashboard"));
        configSummaryText.setText(hostInput.getText().toString().trim() + ":" + portInput.getText().toString().trim());
        lastMessageText.setText(last == null || last.length() == 0 ? "Sin mensajes recientes." : last);
    }

    private boolean isAccessibilitySettingEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        String full = getPackageName() + "/" + FlowAccessibilityService.class.getName();
        String shortName = getPackageName() + "/." + FlowAccessibilityService.class.getSimpleName();
        String[] parts = enabled.split(":");
        for (String part : parts) {
            String item = part == null ? "" : part.trim();
            if (full.equals(item) || shortName.equals(item)) return true;
        }
        return false;
    }

    private LinearLayout card() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(outline(Color.rgb(13, 28, 47), Color.rgb(36, 68, 98), dp(22)));
        card.setElevation(dp(8));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.bottomMargin = dp(14);
        card.setLayoutParams(params);
        return card;
    }

    private TextView sectionTitle(String value) {
        TextView view = text(value, 14, true);
        view.setTextColor(Color.rgb(231, 238, 252));
        return view;
    }

    private TextView label(String value) {
        TextView view = text(value, 11, true);
        view.setTextColor(Color.rgb(159, 176, 204));
        view.setPadding(0, dp(12), 0, dp(6));
        return view;
    }

    private TextView statusChip(String title) {
        TextView chip = text(title + "\nPendiente", 12, true);
        chip.setGravity(Gravity.CENTER);
        chip.setLineSpacing(dp(2), 1.0f);
        chip.setBackground(outline(Color.rgb(18, 32, 52), Color.rgb(65, 88, 120), dp(16)));
        return chip;
    }

    private void updateChip(TextView chip, String title, boolean active, String stateLabel) {
        int fill = active ? Color.rgb(12, 64, 55) : Color.rgb(35, 38, 54);
        int stroke = active ? Color.rgb(20, 184, 166) : Color.rgb(105, 82, 98);
        int textColor = active ? Color.rgb(186, 252, 242) : Color.rgb(255, 199, 205);
        chip.setText(title + "\n" + stateLabel);
        chip.setTextColor(textColor);
        chip.setBackground(outline(fill, stroke, dp(16)));
    }

    private TextView text(String value, int sp, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(Color.rgb(231, 238, 252));
        view.setTextSize(sp);
        if (bold) {
            view.setTypeface(Typeface.DEFAULT_BOLD);
        }
        return view;
    }

    private void styleInput(EditText input) {
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.rgb(124, 139, 165));
        input.setTextSize(15);
        input.setPadding(dp(13), 0, dp(13), 0);
        input.setMinHeight(dp(48));
        input.setSingleLine(true);
        input.setBackground(outline(Color.rgb(9, 20, 36), Color.rgb(42, 75, 110), dp(14)));
    }

    private Button primaryButton(String value) {
        Button button = baseButton(value);
        button.setBackground(gradient(
            new int[] {Color.rgb(20, 184, 166), Color.rgb(34, 184, 111)},
            dp(15)
        ));
        return button;
    }

    private Button secondaryButton(String value) {
        Button button = baseButton(value);
        button.setBackground(outline(Color.rgb(17, 35, 58), Color.rgb(67, 104, 148), dp(15)));
        return button;
    }

    private Button baseButton(String value) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextColor(Color.WHITE);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setGravity(Gravity.CENTER);
        button.setAllCaps(false);
        button.setPadding(dp(8), 0, dp(8), 0);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(50)
        );
        params.topMargin = dp(12);
        button.setLayoutParams(params);
        return button;
    }

    private GradientDrawable outline(int fill, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private GradientDrawable gradient(int[] colors, int radius) {
        GradientDrawable drawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
