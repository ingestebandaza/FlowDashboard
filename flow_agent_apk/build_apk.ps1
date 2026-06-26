$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Sdk = $env:ANDROID_HOME
if (-not $Sdk) {
  throw "ANDROID_HOME no esta definido."
}

$BuildToolsDir = Get-ChildItem -Path (Join-Path $Sdk "build-tools") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
$PlatformDir = Get-ChildItem -Path (Join-Path $Sdk "platforms") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $BuildToolsDir -or -not $PlatformDir) {
  throw "Faltan build-tools o platforms en el Android SDK."
}

$Aapt2 = Join-Path $BuildToolsDir.FullName "aapt2.exe"
$D8 = Join-Path $BuildToolsDir.FullName "d8.bat"
if (-not (Test-Path $D8)) { $D8 = Join-Path $BuildToolsDir.FullName "d8.exe" }
$Zipalign = Join-Path $BuildToolsDir.FullName "zipalign.exe"
$Apksigner = Join-Path $BuildToolsDir.FullName "apksigner.bat"
if (-not (Test-Path $Apksigner)) { $Apksigner = Join-Path $BuildToolsDir.FullName "apksigner.exe" }
$AndroidJar = Join-Path $PlatformDir.FullName "android.jar"

$Javac = (Get-Command javac -ErrorAction Stop).Source
$Jar = (Get-Command jar -ErrorAction Stop).Source
$Keytool = (Get-Command keytool -ErrorAction Stop).Source

$Build = Join-Path $Root "build"
$Compiled = Join-Path $Build "compiled.zip"
$Gen = Join-Path $Build "gen"
$Classes = Join-Path $Build "classes"
$Dex = Join-Path $Build "dex"
$ClassesJar = Join-Path $Build "classes.jar"
$LocalAndroidJar = Join-Path $Build "android.jar"
$Unsigned = Join-Path $Build "flowagent-unsigned.apk"
$UnsignedDex = Join-Path $Build "flowagent-unsigned-dex.apk"
$Aligned = Join-Path $Build "flowagent-aligned.apk"
$Signed = Join-Path $Build "flowagent-debug.apk"
$KeyStore = Join-Path $Root "flowagent-debug.keystore"

if (Test-Path $Build) {
  Remove-Item -LiteralPath $Build -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $Build, $Gen, $Classes, $Dex | Out-Null
Copy-Item -LiteralPath $AndroidJar -Destination $LocalAndroidJar -Force

function Run-Native {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$File fallo con codigo $LASTEXITCODE"
  }
}

function Run-Javac {
  param(
    [Parameter(Mandatory = $true)][string]$File,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $File @Arguments 2>&1
    $Code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }
  if ($Code -ne 0) {
    $Output | ForEach-Object { Write-Host $_ }
    throw "$File fallo con codigo $Code"
  }
}

Run-Native $Aapt2 @("compile", "--dir", (Join-Path $Root "res"), "-o", $Compiled)
Run-Native $Aapt2 @("link", "-o", $Unsigned, "-I", $AndroidJar, "--manifest", (Join-Path $Root "AndroidManifest.xml"), $Compiled, "--java", $Gen, "--auto-add-overlay")

$Sources = @()
$Sources += Get-ChildItem -Path (Join-Path $Root "src") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$Sources += Get-ChildItem -Path $Gen -Recurse -Filter *.java | ForEach-Object { $_.FullName }

# Nota: WebP compression esta disponible nativamente en Android 4.2.1+ via Bitmap.compress()
# No se requiere dependencia externa adicional. El codigo usa Bitmap.CompressFormat.WEBP_LOSSY
# que esta disponible en android.jar desde API 30+. Para APIs anteriores, fallback a PNG.

Run-Javac $Javac (@("-encoding", "UTF-8", "-source", "11", "-target", "11", "-classpath", $LocalAndroidJar, "-d", $Classes) + $Sources)
Run-Native $Jar @("cf", $ClassesJar, "-C", $Classes, ".")
Run-Native $D8 @("--min-api", "26", "--classpath", $LocalAndroidJar, "--output", $Dex, $ClassesJar)

Copy-Item -LiteralPath $Unsigned -Destination $UnsignedDex -Force
Run-Native $Jar @("uf", $UnsignedDex, "-C", $Dex, "classes.dex")
Run-Native $Zipalign @("-f", "4", $UnsignedDex, $Aligned)

if (-not (Test-Path $KeyStore)) {
  Run-Native $Keytool @("-genkeypair", "-v", "-keystore", $KeyStore, "-storepass", "android", "-alias", "androiddebugkey", "-keypass", "android", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-dname", "CN=Android Debug,O=FlowAgent,C=US")
}
Run-Native $Apksigner @("sign", "--ks", $KeyStore, "--ks-pass", "pass:android", "--key-pass", "pass:android", "--out", $Signed, $Aligned)
Remove-Item -LiteralPath $LocalAndroidJar -Force -ErrorAction SilentlyContinue

Write-Host "APK generado: $Signed"
