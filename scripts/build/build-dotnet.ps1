param(
    [switch]$Clean,
    [switch]$SkipInventory
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ProjectPath = Join-Path $RepoRoot "FlowDashboard.Core\FlowDashboard.Core.csproj"
$OutputPath = Join-Path $RepoRoot "build\runtime\dotnet"
$BuildRoot = Join-Path $RepoRoot "build"
$RuntimeIdentifier = "win-x64"
$CoreExe = Join-Path $OutputPath "FlowDashboard.Core.exe"

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

Write-Step "FlowDashboard C# self-contained build"

if (-not (Test-Path -LiteralPath $ProjectPath)) {
    throw "Missing project: $ProjectPath"
}

$safeBuildRoot = Assert-UnderRoot $BuildRoot $RepoRoot
$safeOutputPath = Assert-UnderRoot $OutputPath $safeBuildRoot

if ($Clean -and (Test-Path -LiteralPath $safeOutputPath)) {
    Write-Step "Cleaning previous .NET runtime output"
    Remove-Item -LiteralPath $safeOutputPath -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $safeOutputPath | Out-Null

Write-Step "Publishing FlowDashboard.Core"
dotnet publish $ProjectPath `
    -c Release `
    -r $RuntimeIdentifier `
    --self-contained true `
    -p:PublishSingleFile=false `
    -p:PublishTrimmed=false `
    -p:PublishReadyToRun=false `
    -p:PublishAot=false `
    -o $safeOutputPath

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed."
}

if (-not (Test-Path -LiteralPath $CoreExe)) {
    throw "Published executable missing: $CoreExe"
}

$runtimeMarkers = @(
    "hostfxr.dll",
    "hostpolicy.dll",
    "coreclr.dll",
    "FlowDashboard.Core.dll"
)

foreach ($marker in $runtimeMarkers) {
    $markerPath = Join-Path $safeOutputPath $marker
    if (-not (Test-Path -LiteralPath $markerPath)) {
        throw "Self-contained runtime marker missing: $marker"
    }
}

if (Test-Path -LiteralPath (Join-Path $safeOutputPath "mail_config.json")) {
    throw "mail_config.json must not be published next to the executable."
}

if (-not $SkipInventory) {
    Write-Step "Build output inventory"
    Get-ChildItem -LiteralPath $safeOutputPath -Force |
        Select-Object Name, Length |
        Sort-Object Name |
        Format-Table -AutoSize
}

Write-Step "C# self-contained build complete"
Write-Host "Output: $safeOutputPath" -ForegroundColor Green
