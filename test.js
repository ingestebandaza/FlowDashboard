"auto.waitFor()";
console.show();
// Nombre del script: Spotify_Storage_Permission_Auto
// Función: Abrir App Info de com.spotify.musid y configurar permiso de Storage para Android 9/10

function clickNode(node) {
    if (!node) return false;
    if (node.clickable()) return node.click();
    let p = node.parent();
    while (p) {
        if (p.clickable()) return p.click();
        p = p.parent();
    }
    let b = node.bounds();
    return click(b.centerX(), b.centerY());
}

function findOneByAnyText(textArr, timeout) {
    let t = Date.now();
    while (Date.now() - t < timeout) {
        for (let i = 0; i < textArr.length; i++) {
            let n = text(textArr[i]).findOne(200);
            if (n) return n;
        }
    }
    return null;
}

function scrollToPermission(maxSwipe) {
    for (let i = 0; i < maxSwipe; i++) {
        let perm = findOneByAnyText(["Permissions", "Permisos"], 500);
        if (perm) return perm;
        swipe(device.width / 2, parseInt(device.height * 0.78), device.width / 2, parseInt(device.height * 0.28), 350);
        sleep(700);
    }
    return findOneByAnyText(["Permissions", "Permisos"], 1000);
}

function openAppInfo(packageName) {
    app.openAppSetting(packageName);
    sleep(2000);

    // Esperar pantalla de App info
    let ok = false;
    for (let i = 0; i < 8; i++) {
        if (
            textContains("App info").exists() ||
            textContains("Información").exists() ||
            textContains("Info").exists() ||
            idMatches(/.*(entity_header_title|app_name|title).*/).exists()
        ) {
            ok = true;
            break;
        }
        sleep(500);
    }
    return ok;
}

function handleAndroid9SwitchFlow() {
    // Buscar switch de Storage/Archivos y medios
    let storageRow = findOneByAnyText(
        ["Storage", "Almacenamiento", "Files and media", "Archivos y contenido multimedia", "Archivos y multimedia"],
        2000
    );

    let switched = false;
    let sw = className("android.widget.Switch").find();

    if (sw && sw.size() > 0) {
        // Priorizar switch cerca de texto Storage
        if (storageRow) {
            let rb = storageRow.bounds();
            for (let i = 0; i < sw.size(); i++) {
                let s = sw.get(i);
                let sb = s.bounds();
                let sameLine = Math.abs(sb.centerY() - rb.centerY()) < 140;
                if (sameLine) {
                    if (!s.checked()) {
                        clickNode(s);
                        sleep(800);
                    }
                    switched = true;
                    break;
                }
            }
        }

        // Fallback: activar primer switch apagado
        if (!switched) {
            for (let i = 0; i < sw.size(); i++) {
                let s = sw.get(i);
                if (!s.checked()) {
                    clickNode(s);
                    sleep(800);
                    switched = true;
                    break;
                }
            }
            if (!switched) switched = true; // ya estaban activos
        }
    }

    // Si no detecta android.widget.Switch, intentar SwitchCompat por id/texto
    if (!switched) {
        let toggle = idMatches(/.*switch.*/).findOne(1200);
        if (toggle) {
            if (toggle.checkable() && !toggle.checked()) {
                clickNode(toggle);
                sleep(800);
            }
            switched = true;
        }
    }

    back();
    sleep(900);
}

function handleAndroid10RadioFlow() {
    // Entrar a Storage
    let storageBtn = findOneByAnyText(
        ["Storage", "Almacenamiento", "Files and media", "Archivos y contenido multimedia", "Archivos y multimedia"],
        2500
    );

    if (storageBtn) {
        clickNode(storageBtn);
        sleep(1200);
    } else {
        // fallback de scroll y búsqueda
        swipe(device.width / 2, parseInt(device.height * 0.75), device.width / 2, parseInt(device.height * 0.3), 300);
        sleep(700);
        storageBtn = findOneByAnyText(
            ["Storage", "Almacenamiento", "Files and media", "Archivos y contenido multimedia", "Archivos y multimedia"],
            1800
        );
        if (storageBtn) {
            clickNode(storageBtn);
            sleep(1200);
        }
    }

    // Verificar Allow
    let allowTxt = findOneByAnyText(["Allow", "Permitir"], 1500);
    let allowSelected = false;

    if (allowTxt) {
        if (allowTxt.selected()) {
            allowSelected = true;
        } else {
            // Buscar RadioButton en la misma fila
            let radios = className("android.widget.RadioButton").find();
            let ab = allowTxt.bounds();
            for (let i = 0; i < radios.size(); i++) {
                let r = radios.get(i);
                let rb = r.bounds();
                if (Math.abs(rb.centerY() - ab.centerY()) < 130) {
                    if (r.checked()) allowSelected = true;
                    if (!r.checked()) {
                        clickNode(r);
                        sleep(700);
                        allowSelected = true;
                    }
                    break;
                }
            }

            // Fallback: clic sobre texto Allow
            if (!allowSelected) {
                clickNode(allowTxt);
                sleep(700);
                allowSelected = true;
            }
        }
    } else {
        // Opciones alternativas Android 10+
        let opt = findOneByAnyText(
            ["Allow access to media only", "Allow management of all files", "Permitir"],
            1500
        );
        if (opt) {
            clickNode(opt);
            sleep(700);
        }
    }

    // Back de Storage -> Permissions
    back();
    sleep(900);
    // Back de Permissions -> App info
    back();
    sleep(900);
}

function main() {
    let pkg = "com.spotify.musid";
    log("Abriendo App Info de: " + pkg);

    if (!openAppInfo(pkg)) {
        log("No se pudo abrir App Info.");
        return;
    }

    let permNode = scrollToPermission(8);
    if (!permNode) {
        log("No se encontró 'Permissions'.");
        return;
    }

    clickNode(permNode);
    sleep(1200);

    // Detectar Android 9 por Switch visible
    let hasSwitch = className("android.widget.Switch").exists() || idMatches(/.*switch.*/).exists();

    if (hasSwitch) {
        log("Detectado flujo tipo Android 9 (Switch).");
        handleAndroid9SwitchFlow();
    } else {
        log("Detectado flujo tipo Android 10 (RadioButton/Allow).");
        handleAndroid10RadioFlow();
    }

    log("Proceso completado.");
}

main();