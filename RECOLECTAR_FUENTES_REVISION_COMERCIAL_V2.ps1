<#
FlowDashboard Pro - Recolector de fuentes para revisión comercial V2
Compatible con Windows PowerShell 5.1.

SEGURIDAD:
- No modifica el código fuente.
- No inicia ni detiene servicios.
- No ejecuta el Dashboard.
- No copia .supabase_config.json, .env, mail_config.json, claves, APK, EXE,
  logs, recordings, payloads, node_modules, bin, obj, dist ni restore_points.
- Solo crea una carpeta y un ZIP dentro de reports\commercial_review_bundle\.

EJECUCIÓN:
  cd C:\DASHBOARD\FlowDashboard
  powershell -ExecutionPolicy Bypass -File .\RECOLECTAR_FUENTES_REVISION_COMERCIAL_V2.ps1

RESULTADO:
  reports\commercial_review_bundle\FlowDashboard_Commercial_Review_Bundle.zip
#>

$ErrorActionPreference = "Stop"
$Root = (Get-Location).Path
$ReportsRoot = Join-Path $Root "reports\commercial_review_bundle"
$BundleRoot = Join-Path $ReportsRoot "bundle"
$ZipPath = Join-Path $ReportsRoot "FlowDashboard_Commercial_Review_Bundle.zip"
$ManifestPath = Join-Path $ReportsRoot "bundle_manifest.txt"

$ExcludedDirRegex = '\\(node_modules|bin|obj|dist|build|restore_points|scratch|recordings|release_packages|target|__pycache__|\.git|\.venv|\.flowlogin_payloads|\.upload_tmp|Eliminar)\\'
$ForbiddenNameRegex = '(?i)(^\.supabase_config\.json$|^\.env.*$|mail_config|appsettings|secret|credential|password|token|private|service[_-]?role|device_names\.json$|device_groups\.json$|device_inventory\.json$|device_mappings\.json$|devices_output\.json$|^update_config\.json$|key-test\.json$|tap-test\.json$)'
$AllowedExtensions = @(
  ".py", ".js", ".html", ".css", ".json", ".md", ".txt",
  ".ps1", ".bat", ".cs", ".csproj", ".sln", ".spec",
  ".yml", ".yaml", ".toml", ".props", ".targets"
)

if (Test-Path -LiteralPath $ReportsRoot) {
    Remove-Item -LiteralPath $ReportsRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $BundleRoot -Force | Out-Null

$Manifest = New-Object System.Collections.Generic.List[string]

function Add-Manifest([string]$Text) {
    $Manifest.Add($Text)
}

function Copy-SafeFile([string]$SourcePath) {
    if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
        Add-Manifest ("MISSING`t" + $SourcePath)
        return
    }

    $item = Get-Item -LiteralPath $SourcePath
    if ($item.FullName -match $ExcludedDirRegex) {
        Add-Manifest ("EXCLUDED_DIR`t" + $item.FullName)
        return
    }
    if ($item.Name -match $ForbiddenNameRegex) {
        Add-Manifest ("EXCLUDED_SECRET_OR_RUNTIME_DATA`t" + $item.FullName)
        return
    }
    if ($AllowedExtensions -notcontains $item.Extension.ToLowerInvariant()) {
        Add-Manifest ("EXCLUDED_EXTENSION`t" + $item.FullName)
        return
    }

    $relative = $item.FullName.Substring($Root.Length).TrimStart('\')
    $destination = Join-Path $BundleRoot $relative
    $destinationDir = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
    Add-Manifest ("COPIED`t" + $relative)
}

function Copy-SafeTree([string]$RelativeDir, [string[]]$Extensions) {
    $sourceDir = Join-Path $Root $RelativeDir
    if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
        Add-Manifest ("MISSING_DIR`t" + $RelativeDir)
        return
    }

    Get-ChildItem -LiteralPath $sourceDir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch $ExcludedDirRegex -and
            $_.Name -notmatch $ForbiddenNameRegex -and
            $Extensions -contains $_.Extension.ToLowerInvariant()
        } |
        ForEach-Object { Copy-SafeFile $_.FullName }
}

Add-Manifest "FlowDashboard Pro - Commercial Review Bundle"
Add-Manifest ("GeneratedAt`t" + (Get-Date).ToString("o"))
Add-Manifest ("Root`t" + $Root)
Add-Manifest "OfficialLauncher\tabrir_electron.bat"
Add-Manifest ""

# Archivos raíz concretos de lanzamiento, empaquetado, versión y actualización.
$RootFiles = @(
    "abrir_electron.bat",
    "abrir_electron.ps1",
    "abrir_dashboard.bat",
    "abrir_dashboard.ps1",
    "CrearActualizacion.bat",
    "Crearexe.bat",
    "build.bat",
    "compilar_backend.bat",
    "launcher.py",
    "launcher.spec",
    "main.py",
    "updater.py",
    "update.json",
    "update_config.example.json",
    "app_meta.py",
    "requirements.txt",
    "package.json",
    ".gitignore",
    "h264_canary_config.json"
)
foreach ($relative in $RootFiles) {
    Copy-SafeFile (Join-Path $Root $relative)
}

# Backend C# completo, solo fuentes y proyectos.
Copy-SafeTree "FlowDashboard.Core" @(
    ".cs", ".csproj", ".sln", ".props", ".targets", ".md"
)

# Aplicación Electron completa, sin dependencias, logs ni builds.
Copy-SafeTree "electron-app" @(
    ".js", ".html", ".css", ".md"
)
Copy-SafeFile (Join-Path $Root "electron-app\package.json")
Copy-SafeFile (Join-Path $Root "electron-app\package-lock.json")

# Fuentes de herramientas, nunca binarios.
Copy-SafeTree "Herramientas" @(
    ".py", ".js", ".cs", ".md", ".txt",
    ".ps1", ".bat", ".spec", ".toml", ".yml", ".yaml"
)

# Guardar un estado Git de solo lectura.
$GitReport = Join-Path $BundleRoot "reports_source\git_snapshot.txt"
New-Item -ItemType Directory -Path (Split-Path -Parent $GitReport) -Force | Out-Null
$gitLines = New-Object System.Collections.Generic.List[string]
$gitLines.Add("Branch:")
try { (git branch --show-current 2>&1) | ForEach-Object { $gitLines.Add([string]$_) } } catch {}
$gitLines.Add("")
$gitLines.Add("HEAD:")
try { (git rev-parse HEAD 2>&1) | ForEach-Object { $gitLines.Add([string]$_) } } catch {}
$gitLines.Add("")
$gitLines.Add("Status --short:")
try { (git status --short 2>&1) | ForEach-Object { $gitLines.Add([string]$_) } } catch {}
$gitLines | Set-Content -LiteralPath $GitReport -Encoding UTF8
Add-Manifest "GENERATED`treports_source\git_snapshot.txt"

$Manifest | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $BundleRoot "bundle_manifest.txt") -Force

if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path (Join-Path $BundleRoot "*") -DestinationPath $ZipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Bundle creado correctamente:" -ForegroundColor Green
Write-Host $ZipPath -ForegroundColor Cyan
Write-Host ""
Write-Host "No se copiaron secretos, ejecutables, APK, logs ni datos de clientes." -ForegroundColor Yellow
