package com.flowlogin.agent;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

final class DeviceIdentity {
    private static final String PREFS_NAME = "flow_agent";
    private static final String SERIAL_KEY = "serial";

    private DeviceIdentity() {
    }

    static String getAndroidId(Context context) {
        try {
            String androidId = Settings.Secure.getString(
                context.getContentResolver(),
                Settings.Secure.ANDROID_ID
            );
            return androidId == null ? "" : androidId.trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    static String resolveDisplaySerial(Context context) {
        String adbSerial = resolveAdbSerial(context, true);
        if (isUsableAdbSerial(adbSerial)) {
            return adbSerial;
        }
        String androidId = getAndroidId(context);
        return androidId.isEmpty() ? "---" : "android:" + androidId;
    }

    static String resolveAdbSerial(Context context, boolean persist) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String stored = clean(prefs.getString(SERIAL_KEY, ""));
        if (isUsableAdbSerial(stored)) {
            return stored;
        }

        String wifiIp = getWifiIpAddress(context);
        if (isUsableWifiIp(wifiIp)) {
            String detected = wifiIp + ":5555";
            if (persist) {
                prefs.edit().putString(SERIAL_KEY, detected).apply();
            }
            return detected;
        }

        if (!stored.isEmpty() && !"unknown".equalsIgnoreCase(stored)) {
            return stored;
        }
        return "";
    }

    static boolean isUsableAdbSerial(String serial) {
        String value = clean(serial);
        if (value.isEmpty()) return false;
        if ("unknown".equalsIgnoreCase(value)) return false;
        if (value.startsWith("127.")) return false;
        if (value.startsWith("0.0.0.0")) return false;
        return true;
    }

    private static String getWifiIpAddress(Context context) {
        try {
            android.net.wifi.WifiManager wifiManager = (android.net.wifi.WifiManager)
                context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager == null) return "";

            android.net.wifi.WifiInfo wifiInfo = wifiManager.getConnectionInfo();
            if (wifiInfo == null) return "";

            int ipInt = wifiInfo.getIpAddress();
            if (ipInt == 0) return "";

            return String.format("%d.%d.%d.%d",
                (ipInt & 0xff),
                (ipInt >> 8 & 0xff),
                (ipInt >> 16 & 0xff),
                (ipInt >> 24 & 0xff));
        } catch (Exception ignored) {
            return "";
        }
    }

    private static boolean isUsableWifiIp(String ip) {
        String value = clean(ip);
        if (value.isEmpty()) return false;
        if (value.startsWith("127.")) return false;
        if (value.startsWith("0.")) return false;
        return value.indexOf('.') > 0;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
