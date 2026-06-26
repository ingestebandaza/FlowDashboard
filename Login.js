/**
 * FlowLogin Auto.js runner
 * Lee cuentas asignadas por el dashboard y reporta estado por clon.
 */

auto();

var ACCOUNTS_PATH = "/sdcard/Download/flowlogin_accounts.json";
var STATUS_PATH = "/sdcard/Download/flowlogin_status.json";
var ACCOUNT_DELIMITER = ":";
var APP_LOAD_WAIT_TIME = 8000;
var MAX_ATTEMPTS = 2;
var SCRIPT_START_TIME = Date.now();

var payload = readPayload();
var accounts = payload.accounts || [];
var statusItems = [];
var logsList = [];
var deferredRetries = [];

for (var i = 0; i < accounts.length; i++) {
  statusItems.push({
    accountId: accounts[i].accountId || "",
    clone: accounts[i].clone || (i + 1),
    package: accounts[i].package || "",
    line: accounts[i].line || "",
    status: "pending",
    message: "Pendiente",
    attempts: 0,
    updatedAt: nowIso()
  });
}

var win = null;
try {
  win = floaty.rawWindow(
    <card cardCornerRadius="10dp" cardBackgroundColor="#CC000000" cardElevation="0dp">
      <vertical padding="10">
        <horizontal>
          <text text="FlowLogin" textSize="12sp" textStyle="bold" textColor="#1DB954"/>
          <text id="clock" text="00:00" textSize="12sp" textColor="#FFFFFF" layout_weight="1" gravity="right"/>
        </horizontal>
        <View h="1" bg="#55FFFFFF" marginTop="5" marginBottom="5"/>
        <horizontal>
          <vertical layout_weight="1" gravity="center">
            <text text="OK" textSize="9sp" textColor="#AAAAAA"/>
            <text id="successCounter" text="0" textSize="14sp" textStyle="bold" textColor="#4CAF50"/>
          </vertical>
          <vertical layout_weight="1" gravity="center">
            <text text="ACTIVO" textSize="9sp" textColor="#AAAAAA"/>
            <text id="alreadyCounter" text="0" textSize="14sp" textStyle="bold" textColor="#FF9800"/>
          </vertical>
          <vertical layout_weight="1" gravity="center">
            <text text="ERR" textSize="9sp" textColor="#AAAAAA"/>
            <text id="errorCounter" text="0" textSize="14sp" textStyle="bold" textColor="#F44336"/>
          </vertical>
        </horizontal>
        <View h="1" bg="#55FFFFFF" marginTop="5" marginBottom="5"/>
        <text id="status" text="Iniciando..." textSize="10sp" textColor="#DDDDDD" maxLines="8"/>
        <text id="logs" text="" textSize="9sp" textColor="#AAAAAA" maxLines="5" marginTop="5"/>
      </vertical>
    </card>
  );
  win.setPosition(0, 100);
  win.setSize(600, -2);
  win.setTouchable(false);
} catch (e) {
  win = null;
}

writeStatus();
startUiThread();

if (!accounts.length) {
  addLog("Sin cuentas asignadas.");
  writeStatus();
  sleep(1200);
  safeExit();
}

for (var accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
  var item = accounts[accountIndex];
  var parsed = parseAccount(item.line || "");
  if (!item.package) {
    setItemStatus(item, "error", "Paquete del clon no definido", 0);
    continue;
  }
  if (!parsed) {
    setItemStatus(item, "error", "Formato invalido: email----password", 0);
    continue;
  }

  var finalResult = null;
  var finalAttempt = 0;
  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    finalAttempt = attempt;
    setItemStatus(item, attempt === 1 ? "running" : "retrying", "Intento " + attempt, attempt);
    if (attempt > 1) recoverPackage(item.package);

    if (!launchAndWait(item.package)) {
      finalResult = { status: "review", message: "El clon no abrio o no respondio", retry: true };
    } else {
      finalResult = performLogin(item.clone, item.package, parsed, item);
    }

    if (finalResult.retry && attempt < MAX_ATTEMPTS) {
      deferredRetries.push({ item: item, parsed: parsed, attempt: attempt + 1 });
      finalResult = { status: "retrying", message: "Programada para intento " + (attempt + 1) + ": " + finalResult.message, retry: false };
      break;
    }

    if (!finalResult.retry || attempt === MAX_ATTEMPTS) break;
  }

  setItemStatus(item, finalResult.status, finalResult.message, finalAttempt);
  sleep(1500);
  home();
  sleep(800);
}

if (deferredRetries.length > 0) {
  addLog("Ejecutando reintentos programados.");
}

for (var retryIndex = 0; retryIndex < deferredRetries.length; retryIndex++) {
  var retryJob = deferredRetries[retryIndex];
  var retryItem = retryJob.item;
  var retryAttempt = retryJob.attempt || 2;
  var retryResult = null;

  setItemStatus(retryItem, "retrying", "Limpiando cache/datos antes del intento " + retryAttempt, retryAttempt);
  var cleanResult = clearCacheDataForRetry(retryItem.package);
  if (!cleanResult.ok) {
    retryResult = { status: "error", message: "No se pudo limpiar cache/datos: " + cleanResult.message, retry: false };
    setItemStatus(retryItem, retryResult.status, retryResult.message, retryAttempt);
    sleep(1500);
    home();
    sleep(800);
    continue;
  }

  setItemStatus(retryItem, "retrying", "Intento " + retryAttempt + " despues de limpiar cache/datos", retryAttempt);
  if (!launchAndWait(retryItem.package)) {
    retryResult = { status: "review", message: "El clon no abrio o no respondio", retry: false };
  } else {
    retryResult = performLogin(retryItem.clone, retryItem.package, retryJob.parsed, retryItem);
  }

  retryResult = finalizeSecondAttemptResult(retryResult);
  setItemStatus(retryItem, retryResult.status, retryResult.message, retryAttempt);
  sleep(1500);
  home();
  sleep(800);
}

addLog("Proceso finalizado.");
writeStatus();
sleep(1800);
safeExit();

function readPayload() {
  try {
    if (!files.exists(ACCOUNTS_PATH)) {
      toast("No existe flowlogin_accounts.json");
      return { accounts: [] };
    }
    var data = JSON.parse(files.read(ACCOUNTS_PATH));
    if (!data || !data.accounts) return { accounts: [] };
    if (data.statusPath) STATUS_PATH = data.statusPath;
    if (data.delimiter) ACCOUNT_DELIMITER = String(data.delimiter);
    return data;
  } catch (e) {
    toast("Error leyendo cuentas: " + e.message);
    return { accounts: [] };
  }
}

function parseAccount(line) {
  line = String(line || "").trim();
  if (!line) return null;
  var separatorIndex = -1;
  var separatorLength = 0;
  var delimiters = [ACCOUNT_DELIMITER, ":", "----"];
  for (var i = 0; i < delimiters.length; i++) {
    var delimiter = String(delimiters[i] || "");
    if (!delimiter) continue;
    separatorIndex = line.indexOf(delimiter);
    separatorLength = delimiter.length;
    if (separatorIndex >= 0) break;
  }
  if (separatorIndex < 0) return null;
  var user = line.substring(0, separatorIndex).trim();
  var pass = line.substring(separatorIndex + separatorLength).trim();
  if (user.length < 2 || !pass) return null;
  return { user: user, pass: pass };
}

function nowIso() {
  return new Date().toISOString();
}

function writeStatus() {
  var summary = { pending: 0, running: 0, retrying: 0, waiting_mail: 0, success: 0, already: 0, error: 0, review: 0 };
  for (var i = 0; i < statusItems.length; i++) {
    var status = statusItems[i].status || "pending";
    summary[status] = (summary[status] || 0) + 1;
  }
  var output = {
    device: payload.device || "",
    startedAt: SCRIPT_START_TIME,
    updatedAt: nowIso(),
    summary: summary,
    items: statusItems
  };
  try {
    files.write(STATUS_PATH, JSON.stringify(output, null, 2));
  } catch (e) {}
}

function setItemStatus(item, status, message, attempts, extra) {
  for (var i = 0; i < statusItems.length; i++) {
    if (Number(statusItems[i].clone) === Number(item.clone)) {
      statusItems[i].status = status;
      statusItems[i].message = message || "";
      statusItems[i].attempts = attempts || statusItems[i].attempts || 0;
      statusItems[i].updatedAt = nowIso();
      if (extra && extra.flowMail) {
        statusItems[i].flowMail = extra.flowMail;
      } else if (status !== "waiting_mail") {
        try { delete statusItems[i].flowMail; } catch (e) {}
      }
      break;
    }
  }
  addLog("C" + item.clone + ": " + status + " - " + (message || ""));
  writeStatus();
}

function startUiThread() {
  if (!win) return;
  threads.start(function() {
    while (true) {
      var now = new Date();
      var timeStr = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
      var success = 0;
      var already = 0;
      var error = 0;
      var lines = "";
      for (var i = 0; i < statusItems.length; i++) {
        if (statusItems[i].status === "success") success++;
        if (statusItems[i].status === "already") already++;
        if (statusItems[i].status === "error" || statusItems[i].status === "review") error++;
        lines += "C" + statusItems[i].clone + ": " + statusItems[i].status + "\n";
      }
      ui.run(function() {
        if (!win) return;
        win.clock.setText(timeStr);
        win.successCounter.setText(success + "");
        win.alreadyCounter.setText(already + "");
        win.errorCounter.setText(error + "");
        win.status.setText(lines);
      });
      sleep(1000);
    }
  });
}

function addLog(msg) {
  var d = new Date();
  var h = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
  logsList.push("[" + h + "] " + msg);
  if (logsList.length > 5) logsList.shift();
  try {
    ui.run(function() {
      if (!win) return;
      win.logs.setText(logsList.join("\n"));
    });
  } catch (e) {}
}

function currentPackageSafe() {
  try {
    return currentPackage();
  } catch (e) {
    return "";
  }
}

function recoverPackage(packageName) {
  addLog("Recuperando " + packageName);
  try { home(); } catch (e) {}
  sleep(1000);
  try { shell("am force-stop " + packageName, true); } catch (e1) {
    try { shell("am force-stop " + packageName, false); } catch (e2) {}
  }
  sleep(1400);
}

function clearRetryTapNode(node) {
  if (!node) return false;
  try {
    if (node.clickable() && node.click()) {
      sleep(1200);
      return true;
    }
  } catch (e) {}
  try {
    var b = node.bounds();
    click(b.centerX(), b.centerY());
    sleep(1200);
    return true;
  } catch (e2) {}
  return false;
}

function clearRetryClickByTextDescId(texts, idRegex, timeoutEach) {
  timeoutEach = timeoutEach || 2000;
  for (var i = 0; i < texts.length; i++) {
    var label = texts[i];
    var textNode = text(label).findOne(timeoutEach);
    if (textNode && clearRetryTapNode(textNode)) return true;

    var descNode = desc(label).findOne(700);
    if (descNode && clearRetryTapNode(descNode)) return true;
  }

  if (idRegex) {
    var idNode = idMatches(idRegex).findOne(1200);
    if (idNode && clearRetryTapNode(idNode)) return true;
  }
  return false;
}

function clearRetryOpenAppInfo(packageName) {
  app.openAppSetting(packageName);
  sleep(2600);
  return !!(
    textMatches(/App info|Informaci.n de la aplicaci.n|Informaci.n de app/i).findOne(2500) ||
    id("com.android.settings:id/entity_header_title").textMatches(/Spotify/i).findOne(1500) ||
    descMatches(/Navigate up|Volver|Subir/i).findOne(1200)
  );
}

function clearRetryOpenStorage() {
  if (clearRetryClickByTextDescId(
    ["Storage", "Almacenamiento", "Storage & cache", "Storage and cache", "Almacenamiento y cache"],
    null,
    2200
  )) return true;

  var titles = id("android:id/title").find();
  for (var i = 0; i < titles.size(); i++) {
    var tx = String(titles.get(i).text() || "").toLowerCase();
    if (tx.indexOf("storage") >= 0 || tx.indexOf("almacenamiento") >= 0) {
      return clearRetryTapNode(titles.get(i));
    }
  }
  return false;
}

function clearRetryCacheDataOk() {
  clearRetryClickByTextDescId(
    ["Clear cache", "CLEAR CACHE", "Borrar cache", "Borrar cach"],
    /.*clear_cache.*/,
    2200
  );

  var clearDataClicked = clearRetryClickByTextDescId(
    ["Clear data", "CLEAR DATA", "Clear storage", "CLEAR STORAGE", "Clear all data", "Borrar datos", "Borrar almacenamiento", "Eliminar datos"],
    /.*(clear_data|clear_storage).*/,
    2400
  );

  if (clearDataClicked) {
    clearRetryClickByTextDescId(
      ["OK", "Aceptar"],
      /android:id\/button1|.*button_positive|.*button1.*/,
      3000
    );
  }
  return clearDataClicked;
}

function clearRetryFindOneByAnyText(texts, timeout) {
  var start = Date.now();
  while (Date.now() - start < timeout) {
    for (var i = 0; i < texts.length; i++) {
      var node = text(texts[i]).findOne(200);
      if (node) return node;
    }
  }
  return null;
}

function clearRetryScrollToPermissions(maxSwipe) {
  for (var i = 0; i < maxSwipe; i++) {
    var permissionNode = clearRetryFindOneByAnyText(["Permissions", "Permisos"], 500);
    if (permissionNode) return permissionNode;
    swipe(device.width / 2, parseInt(device.height * 0.78), device.width / 2, parseInt(device.height * 0.28), 350);
    sleep(700);
  }
  return clearRetryFindOneByAnyText(["Permissions", "Permisos"], 1000);
}

function clearRetryHandleStorageSwitchFlow() {
  var storageRow = clearRetryFindOneByAnyText(
    ["Storage", "Almacenamiento", "Files and media", "Archivos y contenido multimedia", "Archivos y multimedia"],
    2000
  );
  var switched = false;
  var switches = className("android.widget.Switch").find();

  if (switches && switches.size() > 0) {
    if (storageRow) {
      var rowBounds = storageRow.bounds();
      for (var i = 0; i < switches.size(); i++) {
        var sw = switches.get(i);
        var swBounds = sw.bounds();
        if (Math.abs(swBounds.centerY() - rowBounds.centerY()) < 140) {
          if (!sw.checked()) {
            clearRetryTapNode(sw);
            sleep(800);
          }
          switched = true;
          break;
        }
      }
    }

    if (!switched) {
      for (var j = 0; j < switches.size(); j++) {
        var fallbackSwitch = switches.get(j);
        if (!fallbackSwitch.checked()) {
          clearRetryTapNode(fallbackSwitch);
          sleep(800);
          switched = true;
          break;
        }
      }
      if (!switched) switched = true;
    }
  }

  if (!switched) {
    var toggle = idMatches(/.*switch.*/).findOne(1200);
    if (toggle) {
      if (toggle.checkable() && !toggle.checked()) {
        clearRetryTapNode(toggle);
        sleep(800);
      }
      switched = true;
    }
  }

  back();
  sleep(900);
  return switched;
}

function clearRetryHandleStorageRadioFlow() {
  var storageButton = clearRetryFindOneByAnyText(
    ["Storage", "Almacenamiento", "Files and media", "Archivos y contenido multimedia", "Archivos y multimedia"],
    2500
  );

  if (!storageButton) {
    swipe(device.width / 2, parseInt(device.height * 0.75), device.width / 2, parseInt(device.height * 0.3), 300);
    sleep(700);
    storageButton = clearRetryFindOneByAnyText(
      ["Storage", "Almacenamiento", "Files and media", "Archivos y contenido multimedia", "Archivos y multimedia"],
      1800
    );
  }

  if (storageButton) {
    clearRetryTapNode(storageButton);
    sleep(1200);
  }

  var allowed = false;
  var allowText = clearRetryFindOneByAnyText(["Allow", "Permitir"], 1500);
  if (allowText) {
    if (allowText.selected()) {
      allowed = true;
    } else {
      var radios = className("android.widget.RadioButton").find();
      var allowBounds = allowText.bounds();
      for (var i = 0; i < radios.size(); i++) {
        var radio = radios.get(i);
        var radioBounds = radio.bounds();
        if (Math.abs(radioBounds.centerY() - allowBounds.centerY()) < 130) {
          if (!radio.checked()) {
            clearRetryTapNode(radio);
            sleep(700);
          }
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        clearRetryTapNode(allowText);
        sleep(700);
        allowed = true;
      }
    }
  } else {
    var alternative = clearRetryFindOneByAnyText(
      ["Allow access to media only", "Allow management of all files", "Permitir"],
      1500
    );
    if (alternative) {
      clearRetryTapNode(alternative);
      sleep(700);
      allowed = true;
    }
  }

  back();
  sleep(900);
  back();
  sleep(900);
  return allowed;
}

function clearRetryEnsureStoragePermission(packageName) {
  addLog("Permiso storage " + packageName);
  try {
    var permissionNode = clearRetryScrollToPermissions(8);
    if (!permissionNode) {
      return { ok: false, message: "No se encontro Permisos" };
    }

    clearRetryTapNode(permissionNode);
    sleep(1200);

    var hasSwitch = className("android.widget.Switch").exists() || idMatches(/.*switch.*/).exists();
    var ok = hasSwitch ? clearRetryHandleStorageSwitchFlow() : clearRetryHandleStorageRadioFlow();
    return { ok: ok, message: ok ? "Permiso storage revisado" : "No se pudo activar storage" };
  } catch (e) {
    try { back(); sleep(500); } catch (e2) {}
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
}

function clearRetryScrollAppInfoToTop() {
  for (var i = 0; i < 3; i++) {
    if (textMatches(/Force stop|FORCE STOP|Forzar detencion/i).findOne(500) ||
        idMatches(/.*force_stop.*/).findOne(500)) {
      return true;
    }
    swipe(device.width / 2, parseInt(device.height * 0.28), device.width / 2, parseInt(device.height * 0.78), 350);
    sleep(700);
  }
  return !!(
    textMatches(/Force stop|FORCE STOP|Forzar detencion/i).findOne(500) ||
    idMatches(/.*force_stop.*/).findOne(500)
  );
}

function clearRetryForceStopTwice() {
  clearRetryClickByTextDescId(
    ["Force stop", "FORCE STOP", "Forzar detencion"],
    /.*force_stop.*/,
    3000
  );

  clearRetryClickByTextDescId(
    ["Force stop", "FORCE STOP", "Forzar detencion"],
    /android:id\/button1|.*button_positive|.*button1.*/,
    3000
  );
}

function clearCacheDataForRetry(packageName) {
  if (!packageName) return { ok: false, message: "Paquete vacio" };
  addLog("Limpiando " + packageName);
  try {
    home();
    sleep(800);
    var opened = clearRetryOpenAppInfo(packageName);
    if (!opened) addLog("No se confirmo App info, continuando");

    var storageOpened = clearRetryOpenStorage();
    if (!storageOpened) return { ok: false, message: "No se encontro Storage" };

    var cleared = clearRetryCacheDataOk();
    if (!cleared) return { ok: false, message: "No se encontro Clear data" };

    back();
    sleep(1400);
    var permissionResult = clearRetryEnsureStoragePermission(packageName);
    if (!permissionResult.ok) addLog("Permiso storage: " + permissionResult.message);

    clearRetryScrollAppInfoToTop();
    clearRetryForceStopTwice();
    back();
    sleep(1000);
    home();
    sleep(1000);
    return { ok: true, message: "Cache/datos limpiados" };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
}

function finalizeSecondAttemptResult(result) {
  if (!result) return { status: "error", message: "Segundo intento sin resultado", retry: false };
  if (result.status === "success" || result.status === "already") return result;
  return {
    status: "error",
    message: result.message || "Segundo intento sin login confirmado",
    retry: false
  };
}

function launchAndWait(packageName) {
  try {
    app.launchPackage(packageName);
  } catch (e) {
    addLog("No abre paquete: " + e.message);
    return false;
  }
  sleep(APP_LOAD_WAIT_TIME);
  if (currentPackageSafe() === packageName) return true;
  if (hasLoginMarkers(1200) || hasLoggedInMarkers(1200)) return true;
  return false;
}

function getSortedInputs() {
  var rawInputs = className("android.widget.EditText").find();
  var sortedInputs = [];
  for (var k = 0; k < rawInputs.size(); k++) sortedInputs.push(rawInputs.get(k));
  sortedInputs.sort(function(a, b) {
    return a.bounds().top - b.bounds().top;
  });
  return sortedInputs;
}

function clickNode(node) {
  if (!node) return false;
  try {
    if (node.click()) return true;
  } catch (e) {}
  try {
    var b = node.bounds();
    click(b.centerX(), b.centerY());
    return true;
  } catch (e2) {}
  return false;
}

function nodeText(node) {
  try {
    return String(node.text ? node.text() : "");
  } catch (e) {
    return "";
  }
}

function nodeId(node) {
  try {
    return String(node.id ? node.id() : "");
  } catch (e) {
    return "";
  }
}

function setTextChecked(node, value, allowMasked) {
  if (!node) return false;
  value = String(value || "");
  for (var i = 0; i < 2; i++) {
    try {
      node.click();
      sleep(400);
      node.setText(value);
      sleep(900);
      var current = nodeText(node);
      if (current === value) return true;
      if (allowMasked && current.length > 0) return true;
    } catch (e) {}
  }
  var finalText = nodeText(node);
  return finalText === value || (allowMasked && finalText.length > 0);
}

function flowKeyboardTypeHuman(node, value, fieldType) {
  if (!node) return { ok: false, message: "No hay campo enfocado" };
  value = String(value || "");
  fieldType = String(fieldType || "generic");
  try {
    node.click();
  } catch (e) {}
  sleep(900);
  try {
    var JSONObject = Packages.org.json.JSONObject;
    var FlowKeyboardService = Packages.com.flowlogin.agent.FlowKeyboardService;
    var command = new JSONObject();
    command.put("name", "keyboard_type_human");
    command.put("text", value);
    command.put("fieldType", fieldType);
    command.put("allowFallback", false);
    command.put("mistakesEnabled", false);
    command.put("verifyText", true);
    if (fieldType === "password") {
      command.put("minDelayMs", 120);
      command.put("maxDelayMs", 280);
    } else if (fieldType === "email") {
      command.put("minDelayMs", 70);
      command.put("maxDelayMs", 190);
    } else {
      command.put("minDelayMs", 80);
      command.put("maxDelayMs", 220);
    }
    var result = FlowKeyboardService.executeKeyboardCommand(command);
    var ok = !!result.optBoolean("ok", false);
    var hasVerifyFields = !!(result.has && result.has("typedText") && result.has("matchesRequested"));
    var typedText = String(result.optString("typedText", ""));
    var matchesRequested = !!result.optBoolean("matchesRequested", false);
    var failedCount = Number(result.optInt("failedCount", 0));
    var fallbackCount = Number(result.optInt("charsFallback", 0));
    var typedCount = Number(result.optInt("typedCount", typedText.length));
    var requestedCount = Number(result.optInt("requestedCount", value.length));
    if (!hasVerifyFields) {
      return { ok: false, message: "FlowAgent/FlowKeyboard sin soporte verifyText; actualiza FlowAgent" };
    }
    if (!ok) {
      return {
        ok: false,
        message: String(result.optString("error", "FlowKeyboard fallo")) +
          " esperado=" + requestedCount +
          " escrito=" + typedCount +
          " fallidos=" + failedCount +
          " fallback=" + fallbackCount
      };
    }
    if (!matchesRequested || typedText !== value || failedCount > 0 || fallbackCount > 0 || typedCount !== requestedCount) {
      return {
        ok: false,
        message: "FlowKeyboard verificacion fallo: esperado=" + requestedCount +
          " escrito=" + typedCount +
          " fallidos=" + failedCount +
          " fallback=" + fallbackCount
      };
    }
    sleep(fieldType === "password" ? 700 : 500);
    return { ok: true, message: "FlowKeyboard OK len=" + requestedCount };
  } catch (e) {
    return { ok: false, message: "FlowKeyboard no disponible: " + (e && e.message ? e.message : e) };
  }
}

function typeRequired(node, value, fieldType) {
  var result = flowKeyboardTypeHuman(node, value, fieldType);
  if (!result.ok) {
    addLog("FlowKeyboard fallo: " + result.message);
  }
  return result;
}

function hasLoggedInMarkers(timeout) {
  return textMatches(/^(Home|Inicio|Search|Buscar|Your Library|Library|Biblioteca|Tu biblioteca)$/i).findOne(timeout || 1000) ||
    descMatches(/^(Home|Inicio|Search|Buscar|Your Library|Library|Biblioteca|Tu biblioteca)$/i).findOne(300);
}

function confirmLoggedIn() {
  if (!hasLoggedInMarkers(2500)) return false;
  sleep(2500);
  return !!hasLoggedInMarkers(2500);
}

function confirmLoggedInQuick() {
  if (!hasLoggedInMarkers(450)) return false;
  sleep(1200);
  return !!hasLoggedInMarkers(800);
}

function hasLoginMarkers(timeout) {
  return textMatches(/(Log in|Log In|Login|Iniciar sesi.n|Continuar con email|Continuar con correo|Continue with email|Welcome back|Te damos la bienvenida|Log in with a password|contrase.a)/i).findOne(timeout || 1000) ||
    className("android.widget.EditText").findOne(500);
}

function findErrorMarker(timeout) {
  return textMatches(/(incorrect|wrong|try again|not match|something went wrong|couldn.t log|can't log|captcha|verify|verification|too many|error|incorrecta|incorrecto|int.ntalo de nuevo|no coincide|algo sali.|no pudimos|verifica|verificaci.n|demasiados|error)/i).findOne(timeout || 1000) ||
    descMatches(/(incorrect|wrong|try again|not match|something went wrong|captcha|verify|verification|too many|error|incorrecta|incorrecto|int.ntalo de nuevo|no coincide|verifica|verificaci.n|demasiados)/i).findOne(300);
}

function isIncorrectCredentialsText(value) {
  return /^\s*This email and password combination is incorrect\.\s*$/i.test(String(value || ""));
}

function escapeRegexLiteral(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isExpectedPackageBodyNode(node, packageName) {
  var idValue = nodeId(node);
  if (!packageName) return false;
  return new RegExp("^" + escapeRegexLiteral(packageName) + ":id\\/body$", "i").test(idValue);
}

function isExpectedActivePackage(packageName) {
  return !!packageName && currentPackageSafe() === packageName;
}

function isIncorrectCredentialsNodeForPackage(node, packageName) {
  if (!isIncorrectCredentialsText(nodeText(node))) return false;
  if (isExpectedPackageBodyNode(node, packageName)) return true;
  return isExpectedActivePackage(packageName);
}

function scanIncorrectCredentialsTextViews(packageName) {
  var nodes = className("android.widget.TextView").find();
  for (var i = 0; i < nodes.size(); i++) {
    var node = nodes.get(i);
    if (isIncorrectCredentialsNodeForPackage(node, packageName)) return node;
  }
  return null;
}

function findIncorrectCredentialsMarker(packageName, timeout) {
  var until = Date.now() + (timeout || 1000);
  if (!packageName) return null;
  var bodyIdRegex = new RegExp("^" + escapeRegexLiteral(packageName) + ":id\\/body$", "i");
  while (Date.now() < until) {
    var scannedNode = scanIncorrectCredentialsTextViews(packageName);
    if (scannedNode) return scannedNode;

    var bodyNode = idMatches(bodyIdRegex).textMatches(/^\s*This email and password combination is incorrect\.\s*$/i).findOne(250);
    if (bodyNode) return bodyNode;

    if (isExpectedActivePackage(packageName)) {
      var textNode = textMatches(/^\s*This email and password combination is incorrect\.\s*$/i).findOne(250);
      if (textNode) return textNode;
    }

    sleep(120);
  }
  return null;
}

function maskEmail(value) {
  value = String(value || "").trim();
  var at = value.indexOf("@");
  if (at <= 1) return value ? "***" : "";
  return value.substring(0, 2) + "***" + value.substring(at);
}

function isAbroad14Text(value) {
  return /You can only use Spotify abroad for 14 days\. Update your location at Spotify\.com to continue using it\./i.test(String(value || ""));
}

function isExpectedPackageNode(node, packageName, resourceSuffix) {
  var idValue = nodeId(node);
  if (!packageName) return false;
  return new RegExp("^" + escapeRegexLiteral(packageName) + ":id\\/" + escapeRegexLiteral(resourceSuffix) + "$", "i").test(idValue);
}

function scanAbroad14TextViews(packageName) {
  var nodes = className("android.widget.TextView").find();
  for (var i = 0; i < nodes.size(); i++) {
    var node = nodes.get(i);
    if (!isAbroad14Text(nodeText(node))) continue;
    if (isExpectedPackageNode(node, packageName, "body") || isExpectedActivePackage(packageName)) {
      return node;
    }
  }
  return null;
}

function findAbroad14Marker(packageName, timeout) {
  var until = Date.now() + (timeout || 1000);
  var bodyIdRegex = new RegExp("^" + escapeRegexLiteral(packageName) + ":id\\/body$", "i");
  while (Date.now() < until) {
    var scannedNode = scanAbroad14TextViews(packageName);
    if (scannedNode) return scannedNode;

    var bodyNode = id(packageName + ":id/body").findOne(250);
    if (bodyNode && isAbroad14Text(nodeText(bodyNode))) return bodyNode;

    bodyNode = idMatches(bodyIdRegex).textMatches(/You can only use Spotify abroad for 14 days/i).findOne(250);
    if (bodyNode && isAbroad14Text(nodeText(bodyNode))) return bodyNode;

    if (isExpectedActivePackage(packageName)) {
      var textNode = textMatches(/You can only use Spotify abroad for 14 days/i).findOne(250);
      if (textNode && isAbroad14Text(nodeText(textNode))) return textNode;
    }
    sleep(120);
  }
  return null;
}

function clickPackageId(packageName, resourceSuffix, textRegex, timeout) {
  var node = id(packageName + ":id/" + resourceSuffix).findOne(timeout || 2500);
  if (!node && textRegex) node = textMatches(textRegex).findOne(900);
  if (!node) return false;
  if (resourceSuffix && !isExpectedPackageNode(node, packageName, resourceSuffix) && currentPackageSafe() !== packageName) return false;
  clickNode(node);
  return true;
}

function extractMagicSentEmail(value) {
  value = String(value || "").replace(/\s+/g, " ");
  var match = value.match(/We sent you an email with a link that will log you in at\s+([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i);
  if (!match) match = String(value || "").match(/([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/i);
  return match ? String(match[1] || "").replace(/[.,;:]+$/, "").toLowerCase() : "";
}

function isMagicRequestSentText(value) {
  return /We sent you an email with a link that will log you in at/i.test(String(value || ""));
}

function scanMagicRequestSentTextViews(packageName, expectedEmail) {
  var nodes = className("android.widget.TextView").find();
  for (var i = 0; i < nodes.size(); i++) {
    var node = nodes.get(i);
    var text = nodeText(node);
    if (!isMagicRequestSentText(text)) continue;
    if (!isExpectedPackageNode(node, packageName, "request_sent_message") && !isExpectedActivePackage(packageName)) continue;
    var sentEmail = extractMagicSentEmail(text);
    if (!sentEmail || sentEmail === expectedEmail) return node;
  }
  return null;
}

function findMagicRequestSent(packageName, expectedEmail, timeout) {
  var until = Date.now() + (timeout || 10000);
  expectedEmail = String(expectedEmail || "").trim().toLowerCase();
  var sentIdRegex = new RegExp("^" + escapeRegexLiteral(packageName) + ":id\\/request_sent_message$", "i");
  while (Date.now() < until) {
    var node = id(packageName + ":id/request_sent_message").findOne(600);
    if (!node) node = idMatches(sentIdRegex).findOne(300);
    if (!node && isExpectedActivePackage(packageName)) {
      node = textMatches(/We sent you an email with a link that will log you in at/i).findOne(600);
    }
    if (!node) node = scanMagicRequestSentTextViews(packageName, expectedEmail);
    if (node) {
      var text = nodeText(node);
      var sentEmail = extractMagicSentEmail(text);
      if (sentEmail && sentEmail === expectedEmail) return node;
      if (!sentEmail && isMagicRequestSentText(text)) return node;
    }
    sleep(350);
  }
  return null;
}

function isExpiredMagicLinkText(value) {
  return /This link has expired\./i.test(String(value || ""));
}

function scanExpiredMagicLinkTextViews(packageName) {
  var nodes = className("android.widget.TextView").find();
  for (var i = 0; i < nodes.size(); i++) {
    var node = nodes.get(i);
    if (!isExpiredMagicLinkText(nodeText(node))) continue;
    if (isExpectedPackageNode(node, packageName, "body") || isExpectedActivePackage(packageName)) {
      return node;
    }
  }
  return null;
}

function findExpiredMagicLinkMarker(packageName, timeout) {
  var until = Date.now() + (timeout || 1000);
  var bodyIdRegex = new RegExp("^" + escapeRegexLiteral(packageName) + ":id\\/body$", "i");
  while (Date.now() < until) {
    var scannedNode = scanExpiredMagicLinkTextViews(packageName);
    if (scannedNode) return scannedNode;

    var bodyNode = id(packageName + ":id/body").findOne(250);
    if (bodyNode && isExpiredMagicLinkText(nodeText(bodyNode))) return bodyNode;

    bodyNode = idMatches(bodyIdRegex).textMatches(/This link has expired/i).findOne(250);
    if (bodyNode && isExpiredMagicLinkText(nodeText(bodyNode))) return bodyNode;

    if (isExpectedActivePackage(packageName)) {
      var textNode = textMatches(/This link has expired/i).findOne(250);
      if (textNode && isExpiredMagicLinkText(nodeText(textNode))) return textNode;
    }
    sleep(120);
  }
  return null;
}

function clickBrowserMagicLoginIfVisible() {
  var login = id("login").textMatches(/^Log In$/i).findOne(400);
  if (!login) login = textMatches(/^Log In$/i).findOne(250);
  if (!login) return false;
  clickNode(login);
  sleep(2500);
  return true;
}

function setFlowMailWaiting(item, packageName, email, requestedAt, message, requireRecent) {
  setItemStatus(item, "waiting_mail", "Esperando FlowMail para " + maskEmail(email), item.attempts || 1, {
    flowMail: {
      email: String(email || "").trim().toLowerCase(),
      requestedAt: requestedAt,
      package: packageName,
      requireRecent: !!requireRecent
    }
  });
  if (message) addLog(message);
}

function requestNewFlowMailLink(packageName, item, email) {
  if (!findExpiredMagicLinkMarker(packageName, 700)) return false;
  addLog("FlowMail: link expirado detectado; solicitando link nuevo.");
  if (!clickPackageId(packageName, "button_positive", /Send new link/i, 2500)) {
    addLog("FlowMail: no se pudo pulsar Send new link.");
    return false;
  }
  sleep(3500);
  var sentNode = findMagicRequestSent(packageName, email, 12000);
  if (sentNode) {
    addLog("FlowMail: nuevo mensaje de envio detectado; esperando correo nuevo.");
  } else {
    addLog("FlowMail: no se confirmo visualmente el nuevo envio; buscando por destinatario.");
  }
  setFlowMailWaiting(item, packageName, email, nowIso(), "", true);
  return true;
}

function waitForFlowMailLogin(packageName, item, email, requestedAt) {
  setFlowMailWaiting(item, packageName, email, requestedAt, "", false);
  var deadline = Date.now() + 150000;
  var newLinkRequests = 0;
  while (Date.now() < deadline) {
    if (confirmLoggedInQuick()) return { status: "success", message: "Login con FlowMail", retry: false };
    clickBrowserMagicLoginIfVisible();
    if (currentPackageSafe() === packageName && confirmLoggedInQuick()) {
      return { status: "success", message: "Login con FlowMail", retry: false };
    }
    if (currentPackageSafe() === packageName && newLinkRequests < 2 && findExpiredMagicLinkMarker(packageName, 450)) {
      newLinkRequests++;
      if (requestNewFlowMailLink(packageName, item, email)) {
        deadline = Date.now() + 150000;
      }
    }
    sleep(1800);
  }
  return { status: "review", message: "FlowMail sin confirmacion segura", retry: true };
}

function handleAbroad14WithFlowMail(packageName, account, item) {
  var marker = findAbroad14Marker(packageName, 1800);
  if (!marker) return null;
  addLog("Aviso 14 dias detectado; solicitando FlowMail.");
  if (!clickPackageId(packageName, "button_positive", /^OK$/i, 2500)) {
    return { status: "review", message: "FlowMail: no se pudo pulsar OK", retry: true };
  }
  sleep(2500);

  if (!clickPackageId(packageName, "request_magiclink_lower_button", /Log in without password/i, 5000)) {
    return { status: "review", message: "FlowMail: no encontro boton Log in without password", retry: true };
  }
  sleep(3500);
  var sentNode = findMagicRequestSent(packageName, account.user, 12000);
  if (!sentNode) {
    addLog("FlowMail: no se confirmo el mensaje visual de email; buscando correo por destinatario.");
  }
  if (sentNode) {
    addLog("FlowMail: mensaje de envio detectado; buscando correo por destinatario.");
  }
  return waitForFlowMailLogin(packageName, item, account.user, nowIso());
}

function clickInitialLoginIfPresent() {
  var loginBtn = textMatches(/^(Log in|Log In|Login|Iniciar sesi.n)$/i).clickable(true).findOne(2500);
  if (!loginBtn) loginBtn = textMatches(/^(Log in|Log In|Login|Iniciar sesi.n)$/i).findOne(1000);
  if (loginBtn) {
    clickNode(loginBtn);
    sleep(2500);
  }
}

function clickContinueWithEmailIfPresent() {
  var emailOption = textMatches(/(Continue with email|Continuar con email|Continuar con correo)/i).findOne(2500);
  if (emailOption) {
    clickNode(emailOption);
    sleep(7000);
  }
}

function clickPasswordOptionIfPresent() {
  var passwordOption = textMatches(/(Log in with a password|Iniciar sesi.n con contrase.a|contrase.a)/i).findOne(2500);
  if (passwordOption) {
    clickNode(passwordOption);
    sleep(3500);
  }
}

function clickContinueIfPresent() {
  var btn = textMatches(/^(Continue|Next|Continuar|Siguiente)$/i).findOne(2500);
  if (!btn) btn = descMatches(/^(Continue|Next|Continuar|Siguiente)$/i).findOne(800);
  if (btn) {
    clickNode(btn);
  } else {
    press(66);
  }
  sleep(4000);
}

function clickSubmit(passField) {
  var passBottom = passField ? passField.bounds().bottom : 0;
  var allLogins = textMatches(/^(Log in|Log In|Login|Iniciar sesi.n|Continue|Continuar|Next|Siguiente)$/i).find();
  for (var j = 0; j < allLogins.size(); j++) {
    var el = allLogins.get(j);
    if (!passBottom || el.bounds().top > passBottom) {
      clickNode(el);
      sleep(3000);
      return true;
    }
  }
  press(66);
  sleep(3000);
  return true;
}

function confirmOutcome(packageName, account, item) {
  for (var i = 0; i < 8; i++) {
    var flowMailResult = handleAbroad14WithFlowMail(packageName, account, item);
    if (flowMailResult) return flowMailResult;
    var credentialErr = findIncorrectCredentialsMarker(packageName, 450);
    if (credentialErr) {
      var credentialText = String(credentialErr.text ? credentialErr.text() : "credenciales incorrectas");
      return { status: "error", message: "Credenciales incorrectas: " + credentialText, retry: true, deferRetry: true };
    }
    if (confirmLoggedInQuick()) return { status: "success", message: "Login confirmado", retry: false };
    var err = findErrorMarker(450);
    if (err) {
      var errText = String(err.text ? err.text() : "login");
      if (isIncorrectCredentialsText(errText)) {
        if (isExpectedPackageBodyNode(err, packageName) || isExpectedActivePackage(packageName)) {
          return { status: "error", message: "Credenciales incorrectas: " + errText, retry: true, deferRetry: true };
        }
        sleep(300);
        continue;
      }
      return { status: "error", message: "Error visible: " + errText, retry: false };
    }
    if (currentPackageSafe() !== packageName && i > 1) {
      return { status: "review", message: "El clon salio de pantalla", retry: true };
    }
    sleep(700);
  }
  return { status: "review", message: "Sin confirmacion segura", retry: true };
}

function performLogin(clone, packageName, account, item) {
  addLog("C" + clone + ": verificando");
  if (confirmLoggedIn()) {
    return { status: "already", message: "Sesion ya iniciada", retry: false };
  }

  clickInitialLoginIfPresent();
  if (confirmLoggedIn()) {
    return { status: "already", message: "Sesion ya iniciada", retry: false };
  }

  clickContinueWithEmailIfPresent();

  var inputs = getSortedInputs();
  if (inputs.length >= 2) {
    var emailResult = typeRequired(inputs[0], account.user, "email");
    if (!emailResult.ok) {
      return { status: "review", message: "FlowKeyboard email obligatorio: " + emailResult.message, retry: true };
    }
    sleep(900);
    var passField = inputs[inputs.length - 1];
    var passResult = typeRequired(passField, account.pass, "password");
    if (!passResult.ok) {
      return { status: "review", message: "FlowKeyboard password obligatorio: " + passResult.message, retry: true };
    }
    sleep(900);
    clickSubmit(passField);
    return confirmOutcome(packageName, account, item);
  }

  var emailInput = className("android.widget.EditText").findOne(2500);
  if (emailInput) {
    var singleEmailResult = typeRequired(emailInput, account.user, "email");
    if (!singleEmailResult.ok) {
      return { status: "review", message: "FlowKeyboard email obligatorio: " + singleEmailResult.message, retry: true };
    }
    sleep(900);
    clickContinueIfPresent();
  }

  clickPasswordOptionIfPresent();

  var sortedFields = getSortedInputs();
  if (sortedFields.length > 0) {
    var passInput = sortedFields[sortedFields.length - 1];
    var singlePassResult = typeRequired(passInput, account.pass, "password");
    if (!singlePassResult.ok) {
      return { status: "review", message: "FlowKeyboard password obligatorio: " + singlePassResult.message, retry: true };
    }
    sleep(900);
    clickSubmit(passInput);
    return confirmOutcome(packageName, account, item);
  }

  var visibleError = findErrorMarker(1000);
  if (visibleError) {
    return { status: "error", message: "Error visible antes de escribir", retry: false };
  }
  return { status: "review", message: "No encontro campos de login", retry: true };
}

function safeExit() {
  try { if (win) win.close(); } catch (e) {}
  exit();
}
