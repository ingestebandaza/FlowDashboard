package com.flowlogin.agent;

import android.media.projection.MediaProjection;

/**
 * Almacena el MediaProjection globalmente para que el servicio de accesibilidad
 * pueda acceder a él aunque MainActivity esté en segundo plano.
 */
public class MediaProjectionHolder {
    private static volatile MediaProjection instance;

    public static void set(MediaProjection mp) {
        instance = mp;
    }

    public static MediaProjection get() {
        return instance;
    }

    public static void clear() {
        instance = null;
    }
}
