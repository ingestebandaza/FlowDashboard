[CmdletBinding()]
param(
    [string]$InstallerPath = "",
    [string[]]$ExtraPaths = @(),
    [string]$PfxPath = $env:FLOWDASHBOARD_CODESIGN_PFX,
    [string]$PfxPassword = $env:FLOWDASHBOARD_CODESIGN_PASSWORD,
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [switch]$RequireSigning,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Write-Line($msg, $color) {
    if (-not $Quiet) { Write-Host $msg -ForegroundColor $color }
}

function Find-SignTool {
    $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $roots = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
        "${env:ProgramFiles}\Windows Kits\10\bin"
    )
    foreach ($r in $roots) {
        if (Test-Path $r) {
            $found = Get-ChildItem -Path $r -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match "x64" } |
                Sort-Object FullName -Descending |
                Select-Object -First 1
            if ($found) { return $found.FullName }
        }
    }
    return $null
}

if ([string]::IsNullOrWhiteSpace($PfxPath) -or -not (Test-Path -LiteralPath $PfxPath)) {
    if ($RequireSigning) {
        throw "Firma requerida pero no hay certificado. Defina FLOWDASHBOARD_CODESIGN_PFX (ruta .pfx) y FLOWDASHBOARD_CODESIGN_PASSWORD."
    }
    Write-Line "Sin certificado configurado: build interna sin firmar (permitido). Para release comercial externa defina FLOWDASHBOARD_CODESIGN_PFX/_PASSWORD." "Yellow"
    exit 0
}

$signtool = Find-SignTool
if (-not $signtool) {
    if ($RequireSigning) { throw "signtool.exe no encontrado. Instale Windows SDK." }
    Write-Line "signtool.exe no encontrado: omitiendo firma." "Yellow"
    exit 0
}

$targets = New-Object System.Collections.Generic.List[string]
if ($InstallerPath -and (Test-Path -LiteralPath $InstallerPath)) { $targets.Add((Resolve-Path $InstallerPath).Path) }
foreach ($p in $ExtraPaths) {
    if (Test-Path -LiteralPath $p) {
        Get-ChildItem -LiteralPath $p -Recurse -Include *.exe, *.dll -ErrorAction SilentlyContinue |
            ForEach-Object { $targets.Add($_.FullName) }
    }
}

if ($targets.Count -eq 0) {
    Write-Line "No hay artefactos para firmar." "Yellow"
    exit 0
}

$failed = 0
foreach ($t in $targets) {
    Write-Line "Firmando: $t" "Cyan"
    & $signtool sign /fd SHA256 /tr $TimestampUrl /td SHA256 /f $PfxPath /p $PfxPassword $t
    if ($LASTEXITCODE -ne 0) { Write-Line "Fallo al firmar $t" "Red"; $failed++; continue }
    & $signtool verify /pa /v $t | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Line "Fallo la verificacion de firma $t" "Red"; $failed++; continue }
    Write-Line "Firmado y verificado: $t" "Green"
}

if ($failed -gt 0) {
    if ($RequireSigning) { throw "Firma fallida en $failed artefacto(s)." }
    exit 1
}
exit 0
