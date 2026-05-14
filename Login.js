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

for (var i = 0; i < accounts.length; i++) {
  statusItems.push({
    accountId: accounts[i].accountId || "",
    clone: accounts[i].clone || (i + 1),
    package: accounts[i].package || "",
    status: "pending",
    message: "Pendiente",
    attempts: 0,
    updatedAt: nowIso()
  });
}

var win = floaty.rawWindow(
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

try {
  win.setPosition(0, 100);
  win.setSize(600, -2);
  win.setTouchable(false);
} catch (e) {}

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
      finalResult = performLogin(item.clone, item.package, parsed);
    }

    if (!finalResult.retry || attempt === MAX_ATTEMPTS) break;
  }

  setItemStatus(item, finalResult.status, finalResult.message, finalAttempt);
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
  var summary = { pending: 0, running: 0, retrying: 0, success: 0, already: 0, error: 0, review: 0 };
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

function setItemStatus(item, status, message, attempts) {
  for (var i = 0; i < statusItems.length; i++) {
    if (Number(statusItems[i].clone) === Number(item.clone)) {
      statusItems[i].status = status;
      statusItems[i].message = message || "";
      statusItems[i].attempts = attempts || statusItems[i].attempts || 0;
      statusItems[i].updatedAt = nowIso();
      break;
    }
  }
  addLog("C" + item.clone + ": " + status + " - " + (message || ""));
  writeStatus();
}

function startUiThread() {
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

function hasLoggedInMarkers(timeout) {
  return textMatches(/^(Home|Search|Your Library|Library)$/i).findOne(timeout || 1000) ||
    descMatches(/^(Home|Search|Your Library|Library)$/i).findOne(300);
}

function confirmLoggedIn() {
  if (!hasLoggedInMarkers(2500)) return false;
  sleep(2500);
  return !!hasLoggedInMarkers(2500);
}

function hasLoginMarkers(timeout) {
  return textMatches(/(Log in|Log In|Continue with email|Welcome back|Log in with a password)/i).findOne(timeout || 1000) ||
    className("android.widget.EditText").findOne(500);
}

function findErrorMarker(timeout) {
  return textMatches(/(incorrect|wrong|try again|not match|something went wrong|couldn.t log|can't log|captcha|verify|verification|too many|error)/i).findOne(timeout || 1000) ||
    descMatches(/(incorrect|wrong|try again|not match|something went wrong|captcha|verify|verification|too many|error)/i).findOne(300);
}

function clickInitialLoginIfPresent() {
  var loginBtn = textMatches(/^(Log in|Log In)$/).clickable(true).findOne(2500);
  if (!loginBtn) loginBtn = textMatches(/^(Log in|Log In)$/).findOne(1000);
  if (loginBtn) {
    clickNode(loginBtn);
    sleep(2500);
  }
}

function clickContinueWithEmailIfPresent() {
  var emailOption = textContains("Continue with email").findOne(2500);
  if (emailOption) {
    clickNode(emailOption);
    sleep(7000);
  }
}

function clickPasswordOptionIfPresent() {
  var passwordOption = textContains("Log in with a password").findOne(2500);
  if (passwordOption) {
    clickNode(passwordOption);
    sleep(3500);
  }
}

function clickContinueIfPresent() {
  var btn = textMatches(/^(Continue|Next)$/i).findOne(2500);
  if (!btn) btn = descMatches(/^(Continue|Next)$/i).findOne(800);
  if (btn) {
    clickNode(btn);
  } else {
    press(66);
  }
  sleep(4000);
}

function clickSubmit(passField) {
  var passBottom = passField ? passField.bounds().bottom : 0;
  var allLogins = textMatches(/^(Log in|Log In|Login)$/i).find();
  for (var j = 0; j < allLogins.size(); j++) {
    var el = allLogins.get(j);
    if (!passBottom || el.bounds().top > passBottom) {
      clickNode(el);
      sleep(3000);
      return true;
    }
  }
  if (passField) {
    click(passField.bounds().centerX(), passBottom + 150);
    sleep(3000);
    return true;
  }
  press(66);
  sleep(3000);
  return true;
}

function confirmOutcome(packageName) {
  for (var i = 0; i < 4; i++) {
    if (confirmLoggedIn()) return { status: "success", message: "Login confirmado", retry: false };
    var err = findErrorMarker(1200);
    if (err) return { status: "error", message: "Error visible: " + String(err.text ? err.text() : "login"), retry: false };
    if (currentPackageSafe() !== packageName && i > 1) {
      return { status: "review", message: "El clon salio de pantalla", retry: true };
    }
    sleep(2500);
  }
  return { status: "review", message: "Sin confirmacion segura", retry: true };
}

function performLogin(clone, packageName, account) {
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
    inputs[0].click();
    sleep(500);
    inputs[0].setText(account.user);
    sleep(1800);
    var passField = inputs[inputs.length - 1];
    passField.click();
    sleep(500);
    passField.setText(account.pass);
    sleep(1800);
    clickSubmit(passField);
    return confirmOutcome(packageName);
  }

  var emailInput = className("android.widget.EditText").findOne(2500);
  if (emailInput) {
    emailInput.click();
    sleep(500);
    emailInput.setText(account.user);
    sleep(1800);
    clickContinueIfPresent();
  }

  clickPasswordOptionIfPresent();

  var sortedFields = getSortedInputs();
  if (sortedFields.length > 0) {
    var passInput = sortedFields[sortedFields.length - 1];
    passInput.click();
    sleep(500);
    passInput.setText(account.pass);
    sleep(1800);
    clickSubmit(passInput);
    return confirmOutcome(packageName);
  }

  var visibleError = findErrorMarker(1000);
  if (visibleError) {
    return { status: "error", message: "Error visible antes de escribir", retry: false };
  }
  return { status: "review", message: "No encontro campos de login", retry: true };
}

function safeExit() {
  try { win.close(); } catch (e) {}
  exit();
}
