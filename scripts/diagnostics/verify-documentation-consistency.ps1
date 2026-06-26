$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string]$Message)
    $Failures.Add($Message) | Out-Null
}

function Read-TextIfExists {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        return Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue
    }
    return ""
}

$versionPath = Join-Path $RepoRoot "version.json"
$versionInfo = $null
if (Test-Path -LiteralPath $versionPath) {
    $versionInfo = Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json
} else {
    Add-Failure "Missing version.json"
}

$expectedVersion = if ($versionInfo) { [string]$versionInfo.version } else { "2.0.0" }
$expectedProduct = if ($versionInfo) { [string]$versionInfo.productName } else { "FlowDashboard" }

$activeFiles = @(
    "version.json",
    "app_meta.py",
    "electron-app\package.json",
    "electron-app\package-lock.json",
    "FlowDashboard.Core\FlowDashboard.Core.csproj",
    "FlowDashboard.Core\Program.cs",
    "FlowDashboard.Core\Services\AdbService.cs",
    "FlowDashboard.Core\Services\AppPaths.cs",
    "FlowDashboard.Core\Services\ScrcpyService.cs",
    "electron-app\src\main\path-resolver.js",
    "electron-app\src\main\runtime-manager.js",
    "electron-app\src\main\update-manager.js",
    "electron-app\electron-builder.config.js",
    "build_specs\FlowDashboard.Backend.spec",
    "build_specs\FlowDashboard.MailHelper.spec",
    "scripts\build\build-python.ps1",
    "scripts\build\build-dotnet.ps1",
    "scripts\build\prepare-commercial-resources.ps1",
    "scripts\build\build-electron-installer.ps1",
    "README.md",
    "docs\master_technical_specification.md",
    "docs\current\CURRENT_ARCHITECTURE.md",
    "docs\current\REPOSITORY_MAP.md",
    "docs\current\DEVELOPMENT_START.md",
    "docs\current\BUILD_AND_RELEASE.md",
    "docs\current\SECURITY.md",
    "docs\current\RUNTIME_CODE_DOCUMENTATION_MATRIX.md",
    "docs\commercial\COMMERCIAL_RESOURCES.md",
    "docs\commercial\THIRD_PARTY_NOTICES.txt",
    "RELEASE_NOTES_2.0.0.md"
)

foreach ($relative in $activeFiles) {
    $path = Join-Path $RepoRoot $relative
    $text = Read-TextIfExists $path
    if (-not $text) {
        if ($relative -notin @("RELEASE_NOTES_2.0.0.md", "docs\current\RUNTIME_CODE_DOCUMENTATION_MATRIX.md")) {
            Add-Failure "Missing active file: $relative"
        }
        continue
    }

    if ($relative -match '\.md$' -and $relative -notin @("README.md")) {
        if ($text -notmatch 'STATUS:\s*(CURRENT|LEGACY|EXPERIMENTAL|ARCHIVED|PROHIBITED-AS-SOURCE)') {
            Add-Failure "Missing STATUS header: $relative"
        }
    }

    if ($text -match '1\.0\.60|1\.0\.47') {
        Add-Failure "Old version reference in active file: $relative"
    }

    if ($text -match 'FlowDashboard Pro|flowdashboard-pro|com\.flowdashboard\.pro') {
        Add-Failure "Old product naming in active file: $relative"
    }
}

$appMeta = Read-TextIfExists (Join-Path $RepoRoot "app_meta.py")
if ($appMeta -notmatch "APP_VERSION\s*=\s*`"$expectedVersion`"") {
    Add-Failure "app_meta.py does not report $expectedVersion"
}

$electronPackagePath = Join-Path $RepoRoot "electron-app\package.json"
if (Test-Path -LiteralPath $electronPackagePath) {
    $pkg = Get-Content -LiteralPath $electronPackagePath -Raw | ConvertFrom-Json
    if ([string]$pkg.version -ne $expectedVersion) { Add-Failure "electron-app/package.json version mismatch" }
    if ([string]$pkg.build.productName -ne $expectedProduct) { Add-Failure "electron-app/package.json productName mismatch" }
}

$updatePath = Join-Path $RepoRoot "update.json"
if ($Failures.Count -gt 0) {
    Write-Host "Documentation consistency check FAILED" -ForegroundColor Red
    foreach ($failure in $Failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Documentation consistency check PASS for $expectedProduct $expectedVersion" -ForegroundColor Green
exit 0
