auto.waitFor();
console.show();

// Nombre del script: spotify_appinfo_storage_clear_force_back
// Funcion: abrir App info del clon elegido, entrar a Storage, borrar cache/datos,
// confirmar, forzar detencion y volver.
//
// Argumentos opcionales para AutoJS/Laixi:
// - clone: numero de clon 1..10
// - packageName/package: paquete Android directo

var SPOTIFY_CLONE_PACKAGES = [
    "com.spotify.musid",
    "com.spotify.musie",
    "com.spotify.musif",
    "com.spotify.musig",
    "com.spotify.musih",
    "com.spotify.musii",
    "com.spotify.musij",
    "com.spotify.musik",
    "com.spotify.musil",
    "com.spotify.musim"
];

var TARGET_CONFIG_PATH = "/sdcard/Download/flowcache_target.json";
var TARGET_CONFIG = null;

function readTargetConfig() {
    if (TARGET_CONFIG !== null) return TARGET_CONFIG;
    TARGET_CONFIG = {};
    try {
        if (files.exists(TARGET_CONFIG_PATH)) {
            TARGET_CONFIG = JSON.parse(files.read(TARGET_CONFIG_PATH) || "{}");
        }
    } catch (e) {
        TARGET_CONFIG = {};
    }
    return TARGET_CONFIG;
}

function readArg(name, fallback) {
    try {
        var args = engines.myEngine().execArgv || {};
        if (args[name] !== undefined && args[name] !== null && String(args[name]).length) {
            return String(args[name]);
        }
    } catch (e) {
    }
    try {
        var config = readTargetConfig();
        if (config[name] !== undefined && config[name] !== null && String(config[name]).length) {
            return String(config[name]);
        }
    } catch (e2) {
    }
    return fallback;
}

function packageForClone(clone) {
    var index = parseInt(clone, 10) - 1;
    if (isNaN(index) || index < 0 || index >= SPOTIFY_CLONE_PACKAGES.length) {
        index = 0;
    }
    return SPOTIFY_CLONE_PACKAGES[index];
}

function targetPackage() {
    var directPackage = readArg("packageName", readArg("package", ""));
    if (directPackage) return directPackage;
    return packageForClone(readArg("clone", "1"));
}

function tapNode(node) {
    if (!node) return false;
    if (node.clickable()) {
        node.click();
    } else {
        var b = node.bounds();
        click(b.centerX(), b.centerY());
    }
    sleep(1200);
    return true;
}

function clickByTextDescId(texts, idRegex, timeoutEach) {
    timeoutEach = timeoutEach || 2000;

    for (var i = 0; i < texts.length; i++) {
        var k = texts[i];

        var t = text(k).findOne(timeoutEach);
        if (t && tapNode(t)) return true;

        var d = desc(k).findOne(700);
        if (d && tapNode(d)) return true;
    }

    if (idRegex) {
        var idNode = idMatches(idRegex).findOne(1200);
        if (idNode && tapNode(idNode)) return true;
    }
    return false;
}

function openAppInfo(pkg) {
    app.openAppSetting(pkg);
    sleep(2600);
    return !!(
        textMatches(/App info|Informaci.n de la aplicaci.n|Informaci.n de app/i).findOne(2500) ||
        id("com.android.settings:id/entity_header_title").textMatches(/Spotify/i).findOne(1500) ||
        descMatches(/Navigate up|Volver|Subir/i).findOne(1200)
    );
}

function openStorage() {
    if (clickByTextDescId(
        ["Storage", "Almacenamiento", "Storage & cache", "Almacenamiento y cache"],
        null,
        2200
    )) return true;

    var titles = id("android:id/title").find();
    for (var i = 0; i < titles.length; i++) {
        var tx = (titles[i].text() || "").toLowerCase();
        if (tx.indexOf("storage") >= 0 || tx.indexOf("almacenamiento") >= 0) {
            return tapNode(titles[i]);
        }
    }
    return false;
}

function clearCacheDataOk() {
    clickByTextDescId(
        ["Clear cache", "CLEAR CACHE", "Borrar cache"],
        /.*clear_cache.*/,
        2200
    );

    clickByTextDescId(
        ["Clear data", "CLEAR DATA", "Clear storage", "CLEAR STORAGE", "Borrar datos", "Borrar almacenamiento"],
        /.*clear_data|.*clear_storage.*/,
        2400
    );

    clickByTextDescId(
        ["OK", "Aceptar"],
        /android:id\/button1|.*button_positive|.*button1.*/,
        3000
    );
}

function forceStopTwice() {
    clickByTextDescId(
        ["Force stop", "FORCE STOP", "Forzar detencion"],
        /.*force_stop.*/,
        3000
    );

    clickByTextDescId(
        ["Force stop", "FORCE STOP", "Forzar detencion"],
        /android:id\/button1|.*button_positive|.*button1.*/,
        3000
    );
}

function main() {
    var pkg = targetPackage();
    var clone = readArg("clone", "1");

    log("Clon objetivo: " + clone + " / " + pkg);

    log("1) Abrir App info");
    if (!openAppInfo(pkg)) log("No se confirmo App info, continuando...");

    log("2) Abrir Storage");
    if (!openStorage()) log("No se encontro Storage.");

    log("3) Clear Cache + Clear Data + OK");
    clearCacheDataOk();

    log("4) Back");
    back();
    sleep(1400);

    log("5) Force stop + confirmar Force stop");
    forceStopTwice();

    log("6) Back final");
    back();
    sleep(1000);

    log("Flujo completado.");
}

main();
