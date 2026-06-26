<#
FlowDashboard Pro - Inventario comercial de solo lectura (V2 compatible con Windows PowerShell 5.1)
--------------------------------------------------------
No modifica código, base de datos, servicios ni configuración.
Solo crea un informe de texto dentro de reports\.

Ejecutar desde PowerShell:
  cd C:\DASHBOARD\FlowDashboard
  powershell -ExecutionPolicy Bypass -File .\AUDITORIA_COMERCIAL_SOLO_LECTURA.ps1

Después subir:
  reports\commercial_readiness_inventory.txt
#>

$ErrorActionPreference = "Continue"
$Root = (Get-Location).Path
$ReportsDir = Join-Path $Root "reports"
New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null
$Output = Join-Path $ReportsDir "commercial_readiness_inventory.txt"

function Add-Line([string]$Text = "") {
    Add-Content -LiteralPath $Output -Value $Text -Encoding UTF8
}

function Add-Section([string]$Title) {
    Add-Line ""
    Add-Line ("=" * 88)
    Add-Line $Title
    Add-Line ("=" * 88)
}

Set-Content -LiteralPath $Output -Value "FlowDashboard Pro - Commercial Readiness Inventory V2" -Encoding UTF8
Add-Line ("GeneratedAt: " + (Get-Date).ToString("o"))
Add-Line ("Root: " + $Root)
Add-Line "Official dashboard launcher: abrir_electron.bat"
Add-Line "Mode: READ-ONLY (except this report file)"

Add-Section "1. VERSION CONTROL"
if (Get-Command git -ErrorAction SilentlyContinue) {
    Add-Line ("Git branch: " + ((git branch --show-current 2>$null) -join " "))
    Add-Line ("Git HEAD: " + ((git rev-parse --short HEAD 2>$null) -join " "))
    Add-Line "Git status:"
    (git status --short 2>$null) | ForEach-Object { Add-Line $_ }

    Add-Line ""
    Add-Line "Potential secret/config files tracked by Git:"
    $tracked = git ls-files 2>$null
    $patterns = @(
        '^\.supabase_config\.json$',
        '(^|/)\.env($|\.)',
        '(^|/)update_config\.json$',
        '(^|/)mail_config\.json$',
        '\.(pem|key|pfx|p12)$',
        'device_registrations\.json$',
        '(^|/)\.flowlogin_payloads/'
    )
    $matches = foreach ($file in $tracked) {
        foreach ($pattern in $patterns) {
            if ($file -match $pattern) { $file; break }
        }
    }
    if ($matches) {
        $matches | Sort-Object -Unique | ForEach-Object { Add-Line ("TRACKED: " + $_) }
    } else {
        Add-Line "None detected."
    }
} else {
    Add-Line "Git not available."
}

Add-Section "2. TOOLCHAIN VERSIONS"
$commands = @(
    @{Name="PowerShell"; Cmd={$PSVersionTable.PSVersion.ToString()}},
    @{Name="Python"; Cmd={python --version 2>&1}},
    @{Name="Node"; Cmd={node --version 2>&1}},
    @{Name="npm"; Cmd={npm --version 2>&1}},
    @{Name=".NET"; Cmd={dotnet --info 2>&1 | Select-Object -First 25}},
    @{Name="Java"; Cmd={java -version 2>&1 | Select-Object -First 5}},
    @{Name="ADB"; Cmd={& ".\scrcpy-win64-v4.0\adb.exe" version 2>&1 | Select-Object -First 5}},
    @{Name="scrcpy"; Cmd={& ".\scrcpy-win64-v4.0\scrcpy.exe" --version 2>&1 | Select-Object -First 8}}
)
foreach ($entry in $commands) {
    Add-Line ""
    Add-Line ("[" + $entry.Name + "]")
    try {
        (& $entry.Cmd) | ForEach-Object { Add-Line ([string]$_) }
    } catch {
        Add-Line ("Unavailable: " + $_.Exception.Message)
    }
}

Add-Section "3. IMPORTANT PROJECT FILES"
$importantPatterns = @(
    "*.sln","*.csproj","*.fsproj","package.json","package-lock.json",
    "requirements*.txt","pyproject.toml","Pipfile","*.spec",
    "electron-builder*.yml","electron-builder*.yaml",
    "*.bat","*.ps1","*.sql",
    "app_meta.py","update_config*.json","h264_canary_config*.json",
    "Dockerfile","docker-compose*.yml","docker-compose*.yaml"
)
$important = foreach ($pattern in $importantPatterns) {
    Get-ChildItem -LiteralPath $Root -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch '\\node_modules\\' -and
            $_.FullName -notmatch '\\\.venv\\' -and
            $_.FullName -notmatch '\\dist\\' -and
            $_.FullName -notmatch '\\build\\' -and
            $_.FullName -notmatch '\\restore_points\\' -and
            $_.FullName -notmatch '\\scratch\\'
        }
}
$important |
    Sort-Object FullName -Unique |
    ForEach-Object {
        $relative = $_.FullName.Substring($Root.Length).TrimStart('\')
        Add-Line ("{0}`t{1} bytes`tModified {2:o}" -f $relative, $_.Length, $_.LastWriteTime)
    }

Add-Section "4. TOP-LEVEL INVENTORY"
Get-ChildItem -LiteralPath $Root -Force -ErrorAction SilentlyContinue |
    Sort-Object -Property @{ Expression = 'PSIsContainer'; Descending = $true }, @{ Expression = 'Name'; Descending = $false } |
    ForEach-Object {
        $type = if ($_.PSIsContainer) { "DIR " } else { "FILE" }
        $size = if ($_.PSIsContainer) { "" } else { "$($_.Length) bytes" }
        Add-Line ("{0}`t{1}`t{2}" -f $type, $_.Name, $size)
    }

Add-Section "5. SOURCE FILE COUNTS (EXCLUDING GENERATED/DEPENDENCY DIRECTORIES)"
$excluded = '\\(node_modules|\.venv|dist|build|restore_points|scratch|release_packages|target|__pycache__)\\'
$sourceFiles = Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $excluded }
$sourceFiles |
    Group-Object Extension |
    Sort-Object Count -Descending |
    ForEach-Object {
        $ext = if ([string]::IsNullOrWhiteSpace($_.Name)) { "(no extension)" } else { $_.Name }
        Add-Line ("{0}`t{1}" -f $ext, $_.Count)
    }

Add-Section "6. LARGE FILES OVER 10 MB (EXCLUDING DEPENDENCIES/RESTORE POINTS)"
$sourceFiles |
    Where-Object { $_.Length -ge 10MB } |
    Sort-Object Length -Descending |
    ForEach-Object {
        $relative = $_.FullName.Substring($Root.Length).TrimStart('\')
        Add-Line ("{0:N2} MB`t{1}" -f ($_.Length / 1MB), $relative)
    }

Add-Section "7. CONFIGURATION FILE NAMES (VALUES NOT READ)"
$configNameRegex = '(?i)(config|secret|credential|token|license|mail|supabase|update|manifest)'
$sourceFiles |
    Where-Object { $_.Name -match $configNameRegex } |
    Sort-Object FullName |
    ForEach-Object {
        $relative = $_.FullName.Substring($Root.Length).TrimStart('\')
        Add-Line $relative
    }

Add-Section "8. SECURITY-RELEVANT TEXT MATCH COUNTS (NO VALUES PRINTED)"
$searchTerms = @(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_API_KEY",
    "CAPSOLVER_API_KEY",
    "unsafe-eval",
    "unsafe-inline",
    "Math.random",
    "ALLOW_LOCAL_LICENSE_MODE",
    "FLOWDASHBOARD_ALLOW_LOCAL_LICENSE",
    "check_app_license",
    "validate_flowdashboard_license"
)
$textExtensions = @(".py",".js",".html",".css",".ps1",".bat",".json",".md",".sql",".cs",".csproj",".yml",".yaml")
foreach ($term in $searchTerms) {
    $count = 0
    foreach ($file in $sourceFiles | Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }) {
        try {
            $matches = Select-String -LiteralPath $file.FullName -Pattern $term -SimpleMatch -ErrorAction SilentlyContinue
            if ($matches) { $count += @($matches).Count }
        } catch {}
    }
    Add-Line ("{0}`t{1}" -f $term, $count)
}

Add-Section "9. C# PROJECT ROUTES / ENDPOINT MARKERS"
$csFiles = $sourceFiles | Where-Object { $_.Extension -eq ".cs" }
foreach ($file in $csFiles) {
    try {
        $matches = Select-String -LiteralPath $file.FullName -Pattern @(
            "MapGet","MapPost","MapPut","MapDelete",
            "[HttpGet","[HttpPost","[HttpPut","[HttpDelete",
            "Route("
        ) -SimpleMatch -ErrorAction SilentlyContinue
        foreach ($match in $matches) {
            $relative = $file.FullName.Substring($Root.Length).TrimStart('\')
            Add-Line ("{0}:{1}`t{2}" -f $relative, $match.LineNumber, $match.Line.Trim())
        }
    } catch {}
}

Add-Section "10. RESULT"
Add-Line "Inventory completed successfully."
Add-Line ("Report: " + $Output)

Write-Host ""
Write-Host "Auditoría terminada:" -ForegroundColor Green
Write-Host $Output -ForegroundColor Cyan
