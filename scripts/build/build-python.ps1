param(
    [switch]$Clean,
    [switch]$SkipSelfCheck
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$SpecPath = Join-Path $RepoRoot "build_specs\FlowDashboard.Backend.spec"
$MailHelperSpecPath = Join-Path $RepoRoot "build_specs\FlowDashboard.MailHelper.spec"
$WorkPath = Join-Path $RepoRoot "build\staging\pyinstaller-work"
$DistPath = Join-Path $RepoRoot "build\staging\pyinstaller-dist"
$OutputPath = Join-Path $RepoRoot "build\runtime\python"
$BackendExe = Join-Path $OutputPath "FlowDashboard.Backend.exe"
$MailHelperExe = Join-Path $OutputPath "FlowDashboard.MailHelper.exe"

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor Cyan
}

function Assert-UnderRoot {
    param(
        [string]$Path,
        [string]$ExpectedRoot
    )
    $resolved = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetFullPath($ExpectedRoot)
    if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify path outside expected root: $resolved"
    }
    return $resolved
}

function Select-PythonForBuild {
    $candidates = @(
        $env:FLOWDASHBOARD_PYTHON,
        (Join-Path $RepoRoot ".venv\Scripts\python.exe"),
        (Join-Path $RepoRoot "python\python.exe"),
        "python"
    )
    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        try {
            & $candidate -c "import sys; print(sys.executable)" 2>$null | Out-Null
            if ($LASTEXITCODE -ne 0) { continue }
            & $candidate -m PyInstaller --version 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { return $candidate }
            Write-Host "Skipping Python without PyInstaller: $candidate" -ForegroundColor Yellow
        } catch { }
    }
    throw "No Python executable with PyInstaller available for build."
}

Write-Step "FlowDashboard Python backend build"

if (-not (Test-Path -LiteralPath $SpecPath)) {
    throw "Missing spec: $SpecPath"
}

$safeBuildRoot = Assert-UnderRoot (Join-Path $RepoRoot "build") $RepoRoot
$safeWorkPath = Assert-UnderRoot $WorkPath $safeBuildRoot
$safeDistPath = Assert-UnderRoot $DistPath $safeBuildRoot
$safeOutputPath = Assert-UnderRoot $OutputPath $safeBuildRoot

if ($Clean) {
    Write-Step "Cleaning previous Python build output"
    foreach ($target in @($safeWorkPath, $safeDistPath, $safeOutputPath)) {
        if (Test-Path -LiteralPath $target) {
            Remove-Item -LiteralPath $target -Recurse -Force
        }
    }
}

New-Item -ItemType Directory -Force -Path $safeWorkPath, $safeDistPath, $safeOutputPath | Out-Null

$Python = Select-PythonForBuild
Write-Host "Python: $Python"

Write-Step "Checking PyInstaller"
& $Python -m PyInstaller --version
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not available in selected Python."
}

Write-Step "Running PyInstaller"
& $Python -m PyInstaller --noconfirm --clean --distpath $safeDistPath --workpath $safeWorkPath $SpecPath
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed."
}

if (Test-Path -LiteralPath $MailHelperSpecPath) {
    Write-Step "Running PyInstaller for FlowMail helper"
    $MailWorkPath = Join-Path $safeWorkPath "mailhelper"
    New-Item -ItemType Directory -Force -Path $MailWorkPath | Out-Null
    & $Python -m PyInstaller --noconfirm --clean --distpath $safeDistPath --workpath $MailWorkPath $MailHelperSpecPath
    if ($LASTEXITCODE -ne 0) {
        throw "FlowMail helper PyInstaller build failed."
    }
}

$BuiltDir = Join-Path $safeDistPath "FlowDashboard.Backend"
if (-not (Test-Path -LiteralPath $BuiltDir)) {
    throw "Expected PyInstaller output not found: $BuiltDir"
}

Write-Step "Copying backend sidecar to build/runtime/python"
if (Test-Path -LiteralPath $safeOutputPath) {
    Remove-Item -LiteralPath $safeOutputPath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $safeOutputPath | Out-Null
Get-ChildItem -LiteralPath $BuiltDir -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $safeOutputPath -Recurse -Force
}

if (-not (Test-Path -LiteralPath $BackendExe)) {
    throw "Backend executable missing after copy: $BackendExe"
}

$BuiltMailHelperExe = Join-Path $safeDistPath "FlowDashboard.MailHelper.exe"
if (Test-Path -LiteralPath $BuiltMailHelperExe) {
    Copy-Item -LiteralPath $BuiltMailHelperExe -Destination $MailHelperExe -Force
}

if (-not $SkipSelfCheck) {
    Write-Step "Running packaged backend self-check"
    $env:FLOWDASHBOARD_PRODUCT_MODE = "1"
    $env:FLOWDASHBOARD_BASE_DIR = $OutputPath
    $env:FLOWDASHBOARD_RESOURCE_DIR = $RepoRoot
    $env:FLOWDASHBOARD_DATA_DIR = Join-Path $RepoRoot "scratch\flowdashboard-data-runtime"
    $env:FLOWDASHBOARD_ADB = Join-Path $RepoRoot "scrcpy-win64-v4.0\adb.exe"
    $env:SCRCPY_PATH = Join-Path $RepoRoot "scrcpy-win64-v4.0\scrcpy.exe"
    $env:SCRCPY_SERVER_JAR = Join-Path $RepoRoot "scrcpy-win64-v4.0\scrcpy-server.jar"
    & $BackendExe --self-check
    if ($LASTEXITCODE -ne 0) {
        throw "Packaged backend self-check failed."
    }
    if (-not (Test-Path -LiteralPath $MailHelperExe)) {
        throw "FlowMail helper executable missing after build: $MailHelperExe"
    }
}

Write-Step "Python backend build complete"
Write-Host "Output: $safeOutputPath" -ForegroundColor Green
