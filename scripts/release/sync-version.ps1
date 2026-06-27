$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$VersionFile = Join-Path $RepoRoot "version.json"

if (-not (Test-Path -LiteralPath $VersionFile)) {
    throw "version.json not found at $VersionFile"
}

$VersionInfo = Get-Content -LiteralPath $VersionFile -Raw | ConvertFrom-Json
$Version = [string]$VersionInfo.version
$ProductName = [string]$VersionInfo.productName
$Publisher = [string]$VersionInfo.publisher

if (-not $Version -or -not $ProductName -or -not $Publisher) {
    throw "version.json must define version, productName and publisher"
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must use MAJOR.MINOR.PATCH format. Current: $Version"
}

$AssemblyVersion = "$Version.0"

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Content
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Save-JsonFile {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)]$Object,
        [int]$Depth = 20
    )
    $json = $Object | ConvertTo-Json -Depth $Depth
    Write-Utf8NoBom -Path $Path -Content ($json + [Environment]::NewLine)
}

function Set-RegexFile {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string]$Pattern,
        [Parameter(Mandatory=$true)][string]$Replacement
    )
    $text = Get-Content -LiteralPath $Path -Raw
    $updated = [regex]::Replace($text, $Pattern, $Replacement)
    if ($updated -eq $text) {
        throw "No replacement made in $Path for pattern $Pattern"
    }
    Write-Utf8NoBom -Path $Path -Content $updated
}

$ElectronPackage = Join-Path $RepoRoot "electron-app\package.json"
if (Test-Path -LiteralPath $ElectronPackage) {
    $pkg = Get-Content -LiteralPath $ElectronPackage -Raw | ConvertFrom-Json
    $pkg.name = "flowdashboard"
    $pkg.version = $Version
    $pkg.description = "$ProductName - Android device operations dashboard"
    $pkg.author = $Publisher
    if (-not $pkg.build) {
        $pkg | Add-Member -NotePropertyName build -NotePropertyValue ([pscustomobject]@{})
    }
    foreach ($buildProperty in @("appId", "productName", "artifactName", "publish")) {
        if ($pkg.build.PSObject.Properties.Name -notcontains $buildProperty) {
            $pkg.build | Add-Member -NotePropertyName $buildProperty -NotePropertyValue $(if ($buildProperty -eq "publish") { @() } else { "" })
        }
    }
    $pkg.build.appId = "com.flowdashboard.app"
    $pkg.build.productName = $ProductName
    $pkg.build.artifactName = "$ProductName-Setup-`${version}.`${ext}"
    $pkg.build.publish = @(
        [pscustomobject]@{
            provider = "github"
            owner = "ingestebandaza"
            repo = "FlowDashboard"
            releaseType = "release"
        }
    )
    Save-JsonFile -Path $ElectronPackage -Object $pkg
}

$ElectronLock = Join-Path $RepoRoot "electron-app\package-lock.json"
if (Test-Path -LiteralPath $ElectronLock) {
    $lockText = Get-Content -LiteralPath $ElectronLock -Raw
    $lockText = [regex]::Replace($lockText, '("name"\s*:\s*)"[^"]+"', "`${1}`"flowdashboard`"", 2)
    $lockText = [regex]::Replace($lockText, '("version"\s*:\s*)"[^"]+"', "`${1}`"$Version`"", 2)
    Write-Utf8NoBom -Path $ElectronLock -Content $lockText
}

$RootPackage = Join-Path $RepoRoot "package.json"
if (Test-Path -LiteralPath $RootPackage) {
    $rootPkgJson = Get-Content -LiteralPath $RootPackage -Raw | ConvertFrom-Json
    $rootPkgJson.name = "flowdashboard"
    $rootPkgJson.version = $Version
    Save-JsonFile -Path $RootPackage -Object $rootPkgJson
}

$AppMeta = Join-Path $RepoRoot "app_meta.py"
if (Test-Path -LiteralPath $AppMeta) {
    $appMetaText = @(
        "APP_NAME = `"$ProductName`""
        "APP_VERSION = `"$Version`""
        ""
    ) -join [Environment]::NewLine
    Write-Utf8NoBom -Path $AppMeta -Content $appMetaText
}

# Phase 9 replaces the old Python/update.json manifest with electron-updater.
# Keep update.json historical if it exists, but do not mutate it as an active release target.

$Csproj = Join-Path $RepoRoot "FlowDashboard.Core\FlowDashboard.Core.csproj"
if (Test-Path -LiteralPath $Csproj) {
    [xml]$xml = Get-Content -LiteralPath $Csproj -Raw
    $propertyGroup = $xml.Project.PropertyGroup | Select-Object -First 1
    foreach ($name in @("Version", "AssemblyVersion", "FileVersion", "InformationalVersion", "IncludeSourceRevisionInInformationalVersion", "Product", "Company")) {
        if (-not $propertyGroup.$name) {
            $node = $xml.CreateElement($name)
            [void]$propertyGroup.AppendChild($node)
        }
    }
    $propertyGroup.Version = $Version
    $propertyGroup.AssemblyVersion = $AssemblyVersion
    $propertyGroup.FileVersion = $AssemblyVersion
    $propertyGroup.InformationalVersion = $Version
    $propertyGroup.IncludeSourceRevisionInInformationalVersion = "false"
    $propertyGroup.Product = $ProductName
    $propertyGroup.Company = $Publisher
    $xml.Save($Csproj)
}

$ReleaseNotes = Join-Path $RepoRoot "RELEASE_NOTES_2.0.0.md"
if (-not (Test-Path -LiteralPath $ReleaseNotes)) {
    $releaseNotesText = @(
        "# Release Notes - FlowDashboard 2.0.0"
        ""
        "STATUS: CURRENT"
        "Last verified against code: 2026-06-23"
        "Last verified against runtime: 2026-06-23"
        "Canonical replacement: N/A"
        "Owner: FlowDashboard"
        ""
        "## Commercial Migration"
        ""
        "- Unified application version source through version.json."
        "- Synchronized Electron, Python metadata, C# assembly metadata and Electron updater metadata to 2.0.0."
        "- Runtime packaging, installer hardening and Electron updater wiring are implemented; signing, clean-machine validation, entitlements and admin panel remain in later phases."
        ""
    ) -join [Environment]::NewLine
    Write-Utf8NoBom -Path $ReleaseNotes -Content $releaseNotesText
}

Write-Host "Version synchronized to $Version for $ProductName"
