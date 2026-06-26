/**
 * Votos Auto.js runner
 * Reescrito para usar UI Flotante y FlowKeyboard como Login.js
 */

auto();

var STATUS_PATH = "/sdcard/Download/votos_status.json";
var SITE_URL = "https://www.mallorcaburgerfest.com";
var SEARCH_TEXT = "La Bandida";
var SEARCH_SUBTITLE = "Cocina con clase";
var CHROME_PACKAGE = "com.android.chrome";
var SCRIPT_START_TIME = Date.now();
var logsList = [];
var win = null;

var state = {
  startedAt: nowIso(),
  updatedAt: nowIso(),
  status: "running",
  message: "Iniciando",
  steps: [],
  findings: {}
};

try {
  win = floaty.rawWindow(
    <card cardCornerRadius="10dp" cardBackgroundColor="#CC000000" cardElevation="0dp">
      <vertical padding="10">
        <horizontal>
          <text text="FlowVotos" textSize="12sp" textStyle="bold" textColor="#1DB954"/>
          <text id="clock" text="00:00" textSize="12sp" textColor="#FFFFFF" layout_weight="1" gravity="right"/>
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

function main() {
  addLog("Iniciando script de Votos");
  logStep("open_chrome", "Abriendo Chrome");
  openChrome(SITE_URL);
  sleep(6500);

  logStep("find_search", "Buscando buscador");
  var searchField = findSearchField(15000);
  if (!searchField) {
    finish("review", "No se encontro el buscador");
    return;
  }
  state.findings.searchField = nodeInfo(searchField);

  logStep("type_search", "Escribiendo: " + SEARCH_TEXT);
  var typeResult = flowKeyboardTypeHuman(searchField, SEARCH_TEXT, "generic");
  if (!typeResult.ok) {
      addLog("Fallo teclado, intentando setText");
      searchField.setText(SEARCH_TEXT);
  } else {
      addLog("Texto escrito visualmente");
  }
  sleep(1500);

  logStep("hide_keyboard", "Ocultando teclado");
  var chromeBar = id("com.android.chrome:id/toolbar_progress_bar_container").findOne(1000);
  if (chromeBar) {
      clickNode(chromeBar);
  } else {
      click(device.width / 2, 213);
  }
  sleep(1500);

  logStep("verify_card", "Buscando tarjeta");
  var card = verifyBurgerCard(SEARCH_TEXT, SEARCH_SUBTITLE, 15000);
  state.findings.laBandida = card;
  
  if (!card.ok) {
    finish("review", "No se encontró la tarjeta");
    return;
  }

  logStep("click_vote", "Haciendo clic en Votar");
  clickNode(card.voteButton) || click(card.voteButton.center[0], card.voteButton.center[1]);
  sleep(5000); // Esperar que procese el clic y se abra el formulario de email

  logStep("open_tempmail", "Abriendo temp-mail en Chrome (nueva pestaña)");
  openChromeNewTab("https://temp-mail.org/es/");
  sleep(5000); // Esperar 5 segundos

  logStep("get_email", "Obteniendo email temporal");
  var email = getTempEmail(15000);
  if (!email) {
    finish("review", "No se pudo obtener el email temporal");
    return;
  }
  state.findings.tempEmail = email;

  logStep("switch_to_burger", "Volviendo a la pestaña de Burger Fest");
  if (!switchChromeTab(/.*burgerfest.*/i)) {
    finish("review", "No se pudo volver a la pestaña de Burger Fest");
    return;
  }
  sleep(1500);

  logStep("submit_email", "Ingresando email y enviando código");
  enterEmailAndRequestCode(email);

  logStep("switch_to_tempmail", "Volviendo a la pestaña de Temp Mail");
  if (!switchChromeTab(/.*temp.*mail.*|.*correo.*temporal.*/i)) {
    finish("review", "No se pudo cambiar de pestaña a temp-mail");
    return;
  }
  sleep(1500);

  logStep("open_vote_email", "Buscando y abriendo correo de votación");
  if (!findAndOpenEmail(30000)) {
    finish("review", "No se encontró o no se pudo abrir el correo de votación");
    return;
  }
  sleep(2000);

  logStep("get_code", "Obteniendo código de seguridad");
  var code = getVerificationCode(20000);
  if (!code) {
    finish("review", "No se pudo encontrar el código de verificación");
    return;
  }
  state.findings.voteCode = code;

  logStep("switch_to_burger_final", "Volviendo a Burger Fest para validar");
  if (!switchChromeTab(/.*burgerfest.*/i)) {
    finish("review", "No se pudo volver a la pestaña de Burger Fest al final");
    return;
  }
  sleep(1500);

  logStep("validate_and_vote", "Validando código y votando");
  enterCodeAndVote(code);

  finish("success", "Voto validado y completado exitosamente");
}

function openChromeNewTab(url) {
  try {
    addLog("Abriendo en Chrome (nueva pestaña): " + url);
    var Intent = Packages.android.content.Intent;
    var Uri = Packages.android.net.Uri;
    var intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.setPackage(CHROME_PACKAGE);
    intent.putExtra("com.android.browser.application_id", "com.android.chrome_" + Date.now());
    intent.putExtra("create_new_tab", true);
    intent.putExtra("com.google.android.apps.chrome.EXTRA_OPEN_NEW_TAB", true);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    context.startActivity(intent);
  } catch (e) {
    addLog("Error abriendo nueva pestaña: " + (e.message || e));
  }
}

function getTempEmail(timeoutMs) {
  var end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    var mailNode = id("mail").findOne(1000) || textMatches(/.*@.*/).findOne(100);
    if (mailNode) {
      var mailText = String(mailNode.text() || mailNode.desc() || "");
      if (mailText.indexOf("@") !== -1 && mailText.indexOf(".") !== -1) {
        addLog("Email obtenido: " + mailText);
        return mailText;
      }
    }
    sleep(1000);
  }
  return null;
}

function switchChromeTab(tabTitleKeyword) {
  addLog("Buscando cambiar a pestaña: " + tabTitleKeyword);
  var btn = descMatches(/.*tabs.*|.*pestañas.*/i).findOne(3000) || idMatches(/.*tab_switcher_button.*/).findOne(3000);
  if (btn) {
    clickNode(btn);
    sleep(2000);
    
    var pattern = (tabTitleKeyword instanceof RegExp) ? tabTitleKeyword : new RegExp(".*" + tabTitleKeyword + ".*", "i");
    var tab = textMatches(pattern).findOne(3000) || descMatches(pattern).findOne(3000);
    if (tab) {
      clickNode(tab);
      sleep(2000);
      return true;
    } else {
      addLog("No se encontró pestaña con patrón: " + pattern + ", intentando volver atrás");
      try { back(); } catch(e) {}
      sleep(1000);
    }
  } else {
    addLog("No se encontró el botón de cambiar pestaña");
  }
  return false;
}

function enterEmailAndRequestCode(email) {
  var emailField = null;
  var inputs = className("android.widget.EditText").find();
  if (inputs && inputs.size) {
    for (var i = 0; i < inputs.size(); i++) {
      var node = inputs.get(i);
      var idStr = String(node.id() || "");
      if (idStr.indexOf("url") === -1 && idStr.indexOf("location") === -1) {
        emailField = node;
        break;
      }
    }
  }

  if (emailField) {
    addLog("Campo email detectado en Y=" + emailField.bounds().centerY());
    clickNode(emailField);
  } else {
    addLog("Usando clic de coordenadas de respaldo para email");
    click(539, 1140);
  }
  sleep(1000);

  var typeResult = flowKeyboardTypeHuman(emailField || { click: function(){} }, email, "email");
  if (!typeResult.ok) {
    if (emailField) emailField.setText(email);
    else setClip(email);
  }
  sleep(1500);

  var chromeBar = id("com.android.chrome:id/toolbar_progress_bar_container").findOne(1000);
  if (chromeBar) {
    clickNode(chromeBar);
  } else {
    click(device.width / 2, 213);
  }
  sleep(1000);

  var btn = textMatches(/.*Enviar código.*/i).findOne(2000) || descMatches(/.*Enviar código.*/i).findOne(2000);
  if (btn) {
    clickNode(btn);
  } else {
    addLog("Pulsando botón Enviar código por coordenadas");
    click(539, 1325);
  }
  
  addLog("Esperando confirmación de envío...");
  var confirmed = false;
  var checkEnd = Date.now() + 10000;
  while (Date.now() < checkEnd) {
    var checkNode = textContains("Hemos enviado un código").findOne(500) || descContains("Hemos enviado un código").findOne(500);
    if (checkNode) {
      addLog("Confirmación detectada: Hemos enviado un código temporal");
      confirmed = true;
      break;
    }
    sleep(500);
  }
  if (!confirmed) {
    addLog("Advertencia: No se detectó la confirmación de envío de código");
  }
  sleep(1500);
}

function findAndOpenEmail(timeoutMs) {
  var end = Date.now() + timeoutMs;
  addLog("Buscando el correo de votación...");
  while (Date.now() < end) {
    var emailNode = textMatches(/.*código de votación.*|.*mallorcaburgerfest.*/i).findOne(100) || 
                    descMatches(/.*código de votación.*|.*mallorcaburgerfest.*/i).findOne(100);
    
    if (emailNode) {
      var eb = emailNode.bounds();
      if (eb.centerY() > 200 && eb.centerY() < device.height - 200 && eb.height() > 10) {
        addLog("Correo encontrado en Y=" + eb.centerY() + ", abriendo...");
        clickNode(emailNode) || click(eb.centerX(), eb.centerY());
        return true;
      } else {
        addLog("Correo fuera de rango visible Y=" + eb.centerY() + ", desplazando...");
        if (eb.centerY() <= 200) {
          swipe(device.width / 2, Math.floor(device.height * 0.3), device.width / 2, Math.floor(device.height * 0.7), 500);
        } else {
          swipe(device.width / 2, Math.floor(device.height * 0.75), device.width / 2, Math.floor(device.height * 0.35), 500);
        }
        sleep(1000);
      }
    } else {
      addLog("Deslizando para buscar correo en bandeja...");
      swipe(device.width / 2, Math.floor(device.height * 0.75), device.width / 2, Math.floor(device.height * 0.45), 500);
      sleep(1200);
    }
  }
  return false;
}

function getVerificationCode(timeoutMs) {
  var end = Date.now() + timeoutMs;
  addLog("Buscando código de 6 dígitos...");
  while (Date.now() < end) {
    var labelNode = textMatches(/.*código de seguridad.*|.*validar tu voto.*/i).findOne(100) ||
                    descMatches(/.*código de seguridad.*|.*validar tu voto.*/i).findOne(100);
    
    if (labelNode) {
      var lb = labelNode.bounds();
      var numbers = textMatches(/^\d{6}$/).find();
      if (numbers && numbers.size && numbers.size() > 0) {
        for (var i = 0; i < numbers.size(); i++) {
          var numNode = numbers.get(i);
          var nb = numNode.bounds();
          if (nb.top >= lb.bottom - 100 && nb.top < lb.bottom + 200) {
            var code = String(numNode.text() || "");
            addLog("Código de verificación encontrado: " + code);
            return code;
          }
        }
      }
    }
    
    addLog("Deslizando buscando código...");
    swipe(device.width / 2, Math.floor(device.height * 0.72), device.width / 2, Math.floor(device.height * 0.40), 500);
    sleep(1200);
  }
  return null;
}

function enterCodeAndVote(code) {
  addLog("Buscando campo para código de seguridad...");
  var codeField = null;
  var inputs = className("android.widget.EditText").find();
  if (inputs && inputs.size) {
    for (var i = 0; i < inputs.size(); i++) {
      var node = inputs.get(i);
      var idStr = String(node.id() || "");
      if (idStr.indexOf("url") === -1 && idStr.indexOf("location") === -1) {
        codeField = node;
        break;
      }
    }
  }

  if (codeField) {
    addLog("Campo de código detectado en Y=" + codeField.bounds().centerY());
    clickNode(codeField);
  } else {
    addLog("Usando clic de coordenadas de respaldo para el código");
    click(539, 1039);
  }
  sleep(1000);

  var typeResult = flowKeyboardTypeHuman(codeField || { click: function(){} }, code, "number");
  if (!typeResult.ok) {
    if (codeField) codeField.setText(code);
    else setClip(code);
  }
  sleep(1500);

  var chromeBar = id("com.android.chrome:id/toolbar_progress_bar_container").findOne(1000);
  if (chromeBar) {
    clickNode(chromeBar);
  } else {
    click(device.width / 2, 213);
  }
  sleep(1000);

  var btn = textMatches(/.*Validar y Votar.*/i).findOne(2000) || 
            textMatches(/.*Validar.*/i).findOne(2000) || 
            descMatches(/.*Validar.*/i).findOne(2000);
  if (btn) {
    addLog("Pulsando botón Validar");
    clickNode(btn);
  } else {
    addLog("Pulsando botón Validar por coordenadas de respaldo");
    click(539, 1220); 
  }
  
  addLog("Esperando confirmación final del voto...");
  var success = false;
  var checkEnd = Date.now() + 15000;
  while (Date.now() < checkEnd) {
    var confirmNode = textMatches(/.*Gracias por tu voto.*|.*Registrado correctamente.*/i).findOne(500) || 
                      descMatches(/.*Gracias por tu voto.*|.*Registrado correctamente.*/i).findOne(500) ||
                      id("com.android.chrome:id/message_paragraph_1").findOne(500);
    if (confirmNode) {
      var txt = String(confirmNode.text() || confirmNode.desc() || "");
      addLog("Voto confirmado: " + txt);
      success = true;
      break;
    }
    sleep(500);
  }
  if (!success) {
    addLog("Advertencia: No se detectó el mensaje de éxito final");
  }
  sleep(1500);
}


function openChrome(url) {
  try {
    app.startActivity({
      action: "android.intent.action.VIEW",
      data: url,
      packageName: CHROME_PACKAGE
    });
  } catch (e) {
    app.launchPackage(CHROME_PACKAGE);
    sleep(1500);
    setClip(url);
  }
}

function findSearchField(timeoutMs) {
  var end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    // 1. Si existe el botón "Las burgers del festival", clicamos
    var btn = textMatches(/.*burgers del festival.*/i).findOne(100) || descMatches(/.*burgers del festival.*/i).findOne(100);
    if (btn) {
      addLog("Detectado botón Las burgers del festival");
      var bb = btn.bounds();
      // Si está muy abajo (zona de gestos), hacer un scroll pequeño
      if (bb.centerY() > device.height - 180) {
        addLog("Desplazando para poder pulsar el botón");
        swipe(device.width / 2, Math.floor(device.height * 0.8), device.width / 2, Math.floor(device.height * 0.5), 500);
        sleep(1000);
        continue;
      }
      addLog("Pulsando botón");
      clickNode(btn);
      sleep(1500);
    }

    // 2. Intentar buscar por texto/desc o por tipo EditText
    var direct = textMatches(/.*nombre o restaurante.*/i).findOne(100) || descMatches(/.*nombre o restaurante.*/i).findOne(100);
    
    if (!direct) {
      var inputs = className("android.widget.EditText").find();
      if (inputs && inputs.size && inputs.size() > 0) {
        for (var i = 0; i < inputs.size(); i++) {
          var node = inputs.get(i);
          var idStr = String(node.id() || "");
          var textStr = String(node.text() || "");
          
          // Ignorar la barra de navegación del navegador
          if (idStr.indexOf("url") !== -1 || idStr.indexOf("location") !== -1 || textStr.indexOf("mallorcaburgerfest.com") !== -1) {
            continue;
          }
          
          var b = node.bounds();
          if (b && b.centerY() > 300 && b.height() > 0) {
             direct = node;
             break;
          }
        }
      }
    }

    if (direct) {
        var db = direct.bounds();
        // Verificar que esté en la zona visible y no colapsado
        if (db.centerY() > 250 && db.centerY() < device.height - 250 && db.height() > 10) {
            addLog("Buscador encontrado en Y=" + db.centerY());
            return direct;
        } else {
            addLog("Buscador fuera de rango visible Y=" + db.centerY() + ", desplazando...");
            if (db.centerY() <= 250) {
                swipe(device.width / 2, Math.floor(device.height * 0.3), device.width / 2, Math.floor(device.height * 0.7), 500);
            } else {
                swipe(device.width / 2, Math.floor(device.height * 0.75), device.width / 2, Math.floor(device.height * 0.35), 500);
            }
            sleep(1000);
        }
    } else {
        addLog("Buscando buscador... deslizando");
        swipe(device.width / 2, Math.floor(device.height * 0.75), device.width / 2, Math.floor(device.height * 0.35), 500);
        sleep(1000);
    }
  }
  return null;
}

function verifyBurgerCard(burgerName, subtitleKeyword, timeoutMs) {
  var end = Date.now() + timeoutMs;
  var result = { ok: false, title: null, subtitle: null, voteButton: null };

  var nameReg = new RegExp(burgerName, "i");

  while (Date.now() < end) {
    var title = textMatches(nameReg).findOne(100) || descMatches(nameReg).findOne(100);
    var subtitle = textContains(subtitleKeyword).findOne(100) || descContains(subtitleKeyword).findOne(100);
    var button = textMatches(/^Votar$/i).findOne(100) || descMatches(/^Votar$/i).findOne(100) || textMatches(/^votar$/i).findOne(100) || descMatches(/^votar$/i).findOne(100);

    var foundAll = (title && subtitle && button);
    var buttonVisible = false;

    if (button) {
        var bb = button.bounds();
        if (bb.centerY() > 200 && bb.centerY() < device.height - 150 && bb.height() > 10) {
            buttonVisible = true;
        }
    }

    if (foundAll && buttonVisible) {
      result.title = nodeInfo(title);
      result.subtitle = nodeInfo(subtitle);
      result.voteButton = nodeInfo(button);
      result.ok = true;
      return result;
    }
    
    var reference = button || title;
    if (reference) {
      var rb = reference.bounds();
      if (rb.centerY() <= 200) {
        addLog("Desplazando hacia arriba para mostrar tarjeta");
        swipe(device.width / 2, Math.floor(device.height * 0.3), device.width / 2, Math.floor(device.height * 0.7), 500);
      } else {
        addLog("Desplazando hacia abajo para mostrar tarjeta");
        swipe(device.width / 2, Math.floor(device.height * 0.72), device.width / 2, Math.floor(device.height * 0.40), 500);
      }
    } else {
      addLog("Buscando tarjeta " + burgerName + "...");
      swipe(device.width / 2, Math.floor(device.height * 0.72), device.width / 2, Math.floor(device.height * 0.40), 500);
    }
    sleep(1200);
  }
  return result;
}

// ----------------------------------------------------
// UTILITIES PORTED FROM LOGIN.JS
// ----------------------------------------------------

function startUiThread() {
  if (!win) return;
  threads.start(function() {
    while (true) {
      var now = new Date();
      var timeStr = ("0" + now.getHours()).slice(-2) + ":" + ("0" + now.getMinutes()).slice(-2);
      ui.run(function() {
        if (!win) return;
        win.clock.setText(timeStr);
        win.status.setText(state.message);
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
    command.put("minDelayMs", 80);
    command.put("maxDelayMs", 220);
    
    var result = FlowKeyboardService.executeKeyboardCommand(command);
    var ok = !!result.optBoolean("ok", false);
    
    if (!ok) {
      return { ok: false, message: String(result.optString("error", "FlowKeyboard fallo")) };
    }
    sleep(500);
    return { ok: true, message: "FlowKeyboard OK" };
  } catch (e) {
    return { ok: false, message: "FlowKeyboard no disponible: " + (e && e.message ? e.message : e) };
  }
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

function nodeInfo(node) {
  if (!node) return null;
  var b = node.bounds();
  return {
    text: String(node.text() || ""),
    id: String(node.id() || ""),
    className: String(node.className() || ""),
    clickable: !!node.clickable(),
    bounds: [b.left, b.top, b.right, b.bottom],
    center: [b.centerX(), b.centerY()]
  };
}

function logStep(name, message) {
  state.updatedAt = nowIso();
  state.message = message;
  state.steps.push({ name: name, message: message, at: nowIso() });
  writeStatus();
  addLog(message);
}

function finish(status, message) {
  state.status = status;
  state.message = message;
  state.updatedAt = nowIso();
  writeStatus();
  addLog("FIN: " + message);
  sleep(2000);
  safeExit();
}

function writeStatus() {
  try {
    files.write(STATUS_PATH, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function nowIso() {
  return new Date().toISOString();
}

function clearChromeDataAndForceStop() {
  addLog("Iniciando limpieza de Chrome...");
  
  // 1. Intentar primero por Shell (rápido y silencioso)
  try {
    var sh1 = shell("pm clear " + CHROME_PACKAGE, true);
    if (sh1 && (sh1.code === 0 || String(sh1.result).indexOf("Success") !== -1)) {
      addLog("Limpieza por Shell exitosa");
      return;
    }
    var sh2 = shell("pm clear " + CHROME_PACKAGE, false);
    if (sh2 && (sh2.code === 0 || String(sh2.result).indexOf("Success") !== -1)) {
      addLog("Limpieza por Shell (no root) exitosa");
      return;
    }
  } catch (e) {
    addLog("Shell no disponible, usando UI...");
  }

  // 2. Fallback: Interfaz visual
  try {
    app.openAppSetting(CHROME_PACKAGE);
    sleep(2500);

    // Forzar detención (Force Stop)
    var btnForce = textMatches(/Forzar detención|Force stop/i).findOne(2000) || 
                   descMatches(/Forzar detención|Force stop/i).findOne(2000);
    if (btnForce) {
      addLog("Forzando detención de Chrome");
      clickNode(btnForce);
      sleep(1500);
      var btnOk = textMatches(/Aceptar|OK|Forzar detención|Force stop/i).findOne(1500) || 
                  descMatches(/Aceptar|OK|Forzar detención|Force stop/i).findOne(1500);
      if (btnOk) clickNode(btnOk);
      sleep(1500);
    }

    // Ir a Almacenamiento (Storage)
    var btnStorage = textMatches(/Almacenamiento|Storage|Storage & cache/i).findOne(2000) || 
                     descMatches(/Almacenamiento|Storage|Storage & cache/i).findOne(2000);
    if (btnStorage) {
      addLog("Abriendo almacenamiento de Chrome");
      clickNode(btnStorage);
      sleep(2000);

      // Borrar caché (Clear Cache)
      var btnCache = textMatches(/Borrar caché|Clear cache/i).findOne(1500) || 
                     descMatches(/Borrar caché|Clear cache/i).findOne(1500);
      if (btnCache) {
        addLog("Borrando caché de Chrome");
        clickNode(btnCache);
        sleep(1500);
      }

      // Administrar almacenamiento o borrar datos (Manage Storage / Clear Data)
      var btnManage = textMatches(/Administrar almacenamiento|Gestionar espacio|Manage space|Clear storage|Clear data/i).findOne(1500) || 
                      descMatches(/Administrar almacenamiento|Gestionar espacio|Manage space|Clear storage|Clear data/i).findOne(1500);
      if (btnManage) {
        addLog("Abriendo gestión de almacenamiento");
        clickNode(btnManage);
        sleep(2500);

        // Borrar todos los datos de Chrome
        var btnClearAll = textMatches(/Borrar todos los datos|Clear all data/i).findOne(2000) || 
                          descMatches(/Borrar todos los datos|Clear all data/i).findOne(2000);
        if (btnClearAll) {
          addLog("Borrando todos los datos de Chrome");
          clickNode(btnClearAll);
          sleep(1500);
          var btnConfirm = textMatches(/Aceptar|OK/i).findOne(1500) || 
                           descMatches(/Aceptar|OK/i).findOne(1500);
          if (btnConfirm) clickNode(btnConfirm);
          sleep(3000);
        } else {
          var btnConfirm2 = textMatches(/Aceptar|OK/i).findOne(1500);
          if (btnConfirm2) {
             clickNode(btnConfirm2);
             sleep(2000);
          }
        }
      }
    }
  } catch(e) {
    addLog("Error en limpieza de Chrome: " + (e.message || e));
  }
  
  try {
    home();
    sleep(1000);
  } catch(e) {}
}

function safeExit() {
  clearChromeDataAndForceStop();
  try { ui.run(function(){ if (win) { win.close(); win = null; } }); } catch (e) {}
  exit();
}

try {
  main();
} catch (e) {
  state.status = "error";
  state.message = String(e && e.stack ? e.stack : e);
  state.updatedAt = nowIso();
  writeStatus();
  addLog("Error: " + e.message);
  sleep(3000);
  safeExit();
}
