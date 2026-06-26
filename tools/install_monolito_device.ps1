param(
    [string]$Serial = "192.168.1.43:5555",
    [string]$HostIp = "127.0.0.1",
    [int]$Port = 8766
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Adb = Join-Path $Root "scrcpy-win64-v4.0\adb.exe"
$Apk = Join-Path $Root "flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-arm64-v8a.apk"
$Package = "com.flowlogin.agent"
$Ime = "com.flowlogin.agent/.FlowKeyboardService"
$A11yServices = "com.flowlogin.agent/.FlowAccessibilityService:com.flowlogin.agent/org.autojs.autojs.core.accessibility.AccessibilityServiceUsher"

function Invoke-Adb {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & $Adb -s $Serial @Args
}

function Invoke-AdbAllowFail {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    try {
        & $Adb -s $Serial @Args | Out-Host
    } catch {
        Write-Host "[WARN] adb failed but continuing: $($Args -join ' ')"
    }
}

function Package-Installed {
    param([string]$Name)
    $packages = (& $Adb -s $Serial shell pm list packages $Name) -join "`n"
    return $packages -match [regex]::Escape("package:$Name")
}

function Grant-Permission {
    param([string]$Permission)
    Invoke-AdbAllowFail shell pm grant $Package $Permission
}

function Accept-MediaProjectionDialog {
    Invoke-AdbAllowFail shell uiautomator dump /sdcard/window.xml | Out-Null
    $xml = (& $Adb -s $Serial shell cat /sdcard/window.xml) -join "`n"
    if ($xml -match "Start now") {
        if ($xml -match "Don't show again" -and $xml -notmatch 'checked="true"') {
            Invoke-AdbAllowFail shell input tap 540 1520
            Start-Sleep -Milliseconds 500
        }
        # Samsung S8/S9 Android 9 can report dialog bounds above the actual tap target.
        Invoke-AdbAllowFail shell input tap 820 1840
        Start-Sleep -Seconds 2
    }
}

if (!(Test-Path $Adb)) { throw "ADB empaquetado no encontrado: $Adb" }
if (!(Test-Path $Apk)) { throw "APK monolito no encontrado: $Apk" }

Write-Host "[1/7] Verificando dispositivo $Serial"
& $Adb devices | Out-Host

Write-Host "[2/7] Desinstalando APKs anteriores en $Serial"
Invoke-AdbAllowFail shell am force-stop $Package
if (Package-Installed "org.autojs.autojs6") {
    Invoke-AdbAllowFail uninstall org.autojs.autojs6
} else {
    Write-Host "[OK] AutoJs6 standalone no instalado"
}
if (Package-Installed $Package) {
    Invoke-AdbAllowFail uninstall $Package
} else {
    Write-Host "[OK] FlowAgent anterior no instalado"
}

Write-Host "[3/7] Instalando monolito"
Invoke-Adb install -r $Apk

Write-Host "[4/7] Configurando reverse/socket, appops y permisos"
Invoke-Adb reverse tcp:$Port tcp:$Port
Invoke-AdbAllowFail reverse tcp:8765 tcp:8765
Invoke-AdbAllowFail shell appops set $Package SYSTEM_ALERT_WINDOW allow
Invoke-AdbAllowFail shell appops set $Package WRITE_SETTINGS allow
Invoke-AdbAllowFail shell appops set $Package GET_USAGE_STATS allow
Invoke-AdbAllowFail shell appops set $Package RUN_IN_BACKGROUND allow
Invoke-AdbAllowFail shell cmd deviceidle whitelist +$Package

@(
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.READ_PHONE_STATE",
    "android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS",
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.RECEIVE_SMS",
    "android.permission.GET_ACCOUNTS",
    "android.permission.READ_CALENDAR",
    "android.permission.WRITE_CALENDAR"
) | ForEach-Object { Grant-Permission $_ }

Write-Host "[5/7] Activando accesibilidad real e IME"
Invoke-AdbAllowFail shell settings put secure accessibility_enabled 0
Invoke-Adb shell settings put secure enabled_accessibility_services $A11yServices
Invoke-Adb shell settings put secure accessibility_enabled 1
Start-Sleep -Seconds 2
Invoke-Adb shell ime enable $Ime
Invoke-Adb shell ime set $Ime

Write-Host "[6/7] Abriendo FlowAgent y aceptando dialogos"
Invoke-Adb shell monkey "-p" $Package "-c" android.intent.category.LAUNCHER 1
Start-Sleep -Seconds 2
Accept-MediaProjectionDialog
Invoke-Adb shell am start -n "$Package/.MainActivity" --es host $HostIp --ei port $Port --es serial $Serial --ez autoconnect true --ez request_capture false
Start-Sleep -Seconds 3

# Samsung may restore the default keyboard after the capture dialog. Re-apply after launch.
Invoke-Adb shell settings put secure enabled_accessibility_services $A11yServices
Invoke-Adb shell settings put secure accessibility_enabled 1
Invoke-Adb shell ime enable $Ime
Invoke-Adb shell ime set $Ime

Write-Host "[7/7] Verificacion local Android"
Write-Host "Package:"
Invoke-Adb shell dumpsys package $Package | Select-String -Pattern "versionName|versionCode|firstInstallTime|lastUpdateTime" | Out-Host
Write-Host "Accessibility:"
Invoke-Adb shell dumpsys accessibility | Select-String -Pattern "enabled services|bound services|FlowAgent" | Out-Host
Write-Host "IME:"
Invoke-Adb shell settings get secure default_input_method | Out-Host
Write-Host "PID:"
Invoke-AdbAllowFail shell pidof $Package

Write-Host "[OK] Instalacion/configuracion automatica terminada para $Serial"
