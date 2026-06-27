param(
    [switch]$Clean,
    [switch]$SkipResourcePrep,
    [switch]$SkipVersionSync,
    [switch]$DirOnly
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ElectronRoot = Join-Path $RepoRoot "electron-app"
$ReleaseRoot = Join-Path $RepoRoot "release_packages"
$ResourceRoot = Join-Path $RepoRoot "build\staging\commercial-resources"
$IconPng = Join-Path $ElectronRoot "assets\icon.png"
$IconIco = Join-Path $ElectronRoot "assets\icon.ico"
$ManifestPath = Join-Path $ReleaseRoot "PHASE9_UPDATER_INSTALLER_MANIFEST.json"

function Assert-UnderRepo {
    param([string]$Path)
    $repoFull = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full -ne [System.IO.Path]::GetFullPath($RepoRoot) -and -not $full.StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to operate outside repository: $full"
    }
}

function Assert-File {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing required file [$Label]: $Path"
    }
}

function Assert-Directory {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "Missing required directory [$Label]: $Path"
    }
}

function New-IcoFromPng {
    param([string]$PngPath, [string]$IcoPath)
    Assert-File $PngPath "icon png"
    Add-Type -AssemblyName System.Drawing
    $source = [System.Drawing.Image]::FromFile($PngPath)
    $sizes = @(256, 128, 64, 48, 32, 16)
    $entries = New-Object System.Collections.Generic.List[object]
    try {
        foreach ($size in $sizes) {
            $canvas = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($canvas)
                try {
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $scale = [Math]::Min($size / $source.Width, $size / $source.Height)
                    $width = [int][Math]::Round($source.Width * $scale)
                    $height = [int][Math]::Round($source.Height * $scale)
                    $x = [int][Math]::Floor(($size - $width) / 2)
                    $y = [int][Math]::Floor(($size - $height) / 2)
                    $graphics.DrawImage($source, $x, $y, $width, $height)
                } finally {
                    $graphics.Dispose()
                }
                $ms = New-Object System.IO.MemoryStream
                $canvas.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
                $entries.Add([pscustomobject]@{
                    Size = $size
                    Bytes = $ms.ToArray()
                }) | Out-Null
                $ms.Dispose()
            } finally {
                $canvas.Dispose()
            }
        }

        $stream = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
        try {
            $writer = [System.IO.BinaryWriter]::new($stream)
            try {
                $writer.Write([UInt16]0)
                $writer.Write([UInt16]1)
                $writer.Write([UInt16]$entries.Count)
                $offset = 6 + (16 * $entries.Count)
                foreach ($entry in $entries) {
                    $dimension = if ($entry.Size -ge 256) { 0 } else { $entry.Size }
                    $writer.Write([byte]$dimension)
                    $writer.Write([byte]$dimension)
                    $writer.Write([byte]0)
                    $writer.Write([byte]0)
                    $writer.Write([UInt16]1)
                    $writer.Write([UInt16]32)
                    $writer.Write([UInt32]$entry.Bytes.Length)
                    $writer.Write([UInt32]$offset)
                    $offset += $entry.Bytes.Length
                }
                foreach ($entry in $entries) {
                    $writer.Write([byte[]]$entry.Bytes)
                }
            } finally {
                $writer.Dispose()
            }
        } finally {
            $stream.Dispose()
        }
    } finally {
        $source.Dispose()
    }
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativeUnixPath {
    param([string]$Base, [string]$Path)
    $baseFull = [System.IO.Path]::GetFullPath($Base).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $baseUri = New-Object System.Uri($baseFull)
    $pathUri = New-Object System.Uri($pathFull)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('\', '/')
}

if (-not $SkipVersionSync) {
    powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\release\sync-version.ps1")
}

if (-not $SkipResourcePrep) {
    powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\build\prepare-commercial-resources.ps1") -Clean
}

Assert-Directory $ResourceRoot "commercial resources"
Assert-File (Join-Path $ResourceRoot "RESOURCE_MANIFEST.json") "commercial resource manifest"
Assert-File (Join-Path $ResourceRoot "runtime\python\FlowDashboard.Backend.exe") "packaged Python backend"
Assert-File (Join-Path $ResourceRoot "runtime\dotnet\FlowDashboard.Core.exe") "packaged C# backend"
Assert-File (Join-Path $ResourceRoot "scrcpy-win64-v4.0\adb.exe") "bundled ADB"
Assert-File (Join-Path $ResourceRoot "android\flowagent\agent-v1.0.0-arm64-v8a.apk") "FlowAgent APK"

$preflightDataRoot = Join-Path $RepoRoot "scratch\phase9-installer-preflight"
New-Item -ItemType Directory -Force -Path $preflightDataRoot | Out-Null
$previousProductMode = $env:FLOWDASHBOARD_PRODUCT_MODE
$previousResourceDir = $env:FLOWDASHBOARD_RESOURCE_DIR
$previousDataDir = $env:FLOWDASHBOARD_DATA_DIR
try {
    $env:FLOWDASHBOARD_PRODUCT_MODE = "1"
    $env:FLOWDASHBOARD_RESOURCE_DIR = $ResourceRoot
    $env:FLOWDASHBOARD_DATA_DIR = $preflightDataRoot
    $backendExe = Join-Path $ResourceRoot "runtime\python\FlowDashboard.Backend.exe"
    $selfCheckText = (& $backendExe --self-check 2>&1) -join [Environment]::NewLine
    if ($LASTEXITCODE -ne 0) {
        throw "Packaged Python self-check failed with exit code $LASTEXITCODE`n$selfCheckText"
    }
    $start = $selfCheckText.IndexOf('{')
    $end = $selfCheckText.LastIndexOf('}')
    if ($start -lt 0 -or $end -lt $start) {
        throw "Packaged Python self-check did not return JSON: $selfCheckText"
    }
    $selfCheck = $selfCheckText.Substring($start, $end - $start + 1) | ConvertFrom-Json
    if (-not $selfCheck.ok) {
        throw "Packaged Python self-check returned ok=false: $selfCheckText"
    }
    if (-not $selfCheck.flowAgentApkExists) {
        throw "Packaged Python cannot see staged FlowAgent APK: $($selfCheck.flowAgentApk)"
    }
    if ([string]$selfCheck.flowAgentApk -notmatch 'android[\\/]+flowagent[\\/]+agent-v1\.0\.0-arm64-v8a\.apk$') {
        throw "Packaged Python resolved unexpected FlowAgent path: $($selfCheck.flowAgentApk)"
    }
} finally {
    $env:FLOWDASHBOARD_PRODUCT_MODE = $previousProductMode
    $env:FLOWDASHBOARD_RESOURCE_DIR = $previousResourceDir
    $env:FLOWDASHBOARD_DATA_DIR = $previousDataDir
    if (Test-Path -LiteralPath $preflightDataRoot) {
        Assert-UnderRepo $preflightDataRoot
        Remove-Item -LiteralPath $preflightDataRoot -Recurse -Force
    }
}

New-IcoFromPng -PngPath $IconPng -IcoPath $IconIco
Assert-File $IconIco "Windows icon"

if ($Clean -and (Test-Path -LiteralPath $ReleaseRoot)) {
    Assert-UnderRepo $ReleaseRoot
    Remove-Item -LiteralPath $ReleaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:FLOWDASHBOARD_PRODUCT_MODE = "1"

Push-Location $ElectronRoot
try {
    $npmArgs = @("run", "build:win")
    if ($DirOnly) {
        $npmArgs = @("run", "build:dir")
    }
    & npm @npmArgs
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($npmArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

if (-not $DirOnly) {
    Assert-File (Join-Path $ReleaseRoot "latest.yml") "electron-updater latest.yml"
}

$installer = Get-ChildItem -LiteralPath $ReleaseRoot -Filter "FlowDashboard-Setup-*.exe" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$winUnpacked = Join-Path $ReleaseRoot "win-unpacked"
$resourcesDir = Join-Path $winUnpacked "resources"
$requiredPackagedFiles = @(
    "resources\runtime\python\FlowDashboard.Backend.exe",
    "resources\runtime\dotnet\FlowDashboard.Core.exe",
    "resources\scrcpy-win64-v4.0\adb.exe",
    "resources\scrcpy-win64-v4.0\scrcpy.exe",
    "resources\android\flowagent\agent-v1.0.0-arm64-v8a.apk",
    "resources\Herramientas\FlowTrackName.exe",
    "resources\scripts\Login.js",
    "resources\THIRD_PARTY_NOTICES.txt",
    "resources\RESOURCE_MANIFEST.json"
)
$packagedResourceChecks = @()
foreach ($relative in $requiredPackagedFiles) {
    $path = Join-Path $winUnpacked $relative
    $packagedResourceChecks += [pscustomobject]@{
        path = $relative.Replace('\', '/')
        exists = Test-Path -LiteralPath $path -PathType Leaf
        bytes = if (Test-Path -LiteralPath $path -PathType Leaf) { (Get-Item -LiteralPath $path).Length } else { 0 }
    }
}

$releaseFiles = Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName | ForEach-Object {
    [pscustomobject]@{
        path = Get-RelativeUnixPath $ReleaseRoot $_.FullName
        bytes = $_.Length
        sha256 = Get-Sha256 $_.FullName
    }
}

$manifest = [ordered]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    product = "FlowDashboard"
    phase = "COMMERCIAL-V2-PHASE9-UPDATER-AWARE-INSTALLER"
    releaseRoot = $ReleaseRoot
    installer = if ($installer) {
        [ordered]@{
            path = Get-RelativeUnixPath $ReleaseRoot $installer.FullName
            bytes = $installer.Length
            sha256 = Get-Sha256 $installer.FullName
        }
    } else {
        $null
    }
    dirOnly = [bool]$DirOnly
    winUnpackedExists = Test-Path -LiteralPath $winUnpacked -PathType Container
    resourcesDirExists = Test-Path -LiteralPath $resourcesDir -PathType Container
    packagedResourceChecks = $packagedResourceChecks
    fileCount = $releaseFiles.Count
    totalBytes = ($releaseFiles | Measure-Object -Property bytes -Sum).Sum
    files = $releaseFiles
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

$summary = [ordered]@{
    ok = $true
    releaseRoot = $ReleaseRoot
    installer = $manifest.installer
    dirOnly = [bool]$DirOnly
    packagedResourceMissing = @($packagedResourceChecks | Where-Object { -not $_.exists }).path
    manifest = $ManifestPath
}
$summary | ConvertTo-Json -Depth 5
