param(
    [switch]$Clean,
    [switch]$SmokeTestFlowTrackName,
    [string]$OutputRoot = "build\staging\commercial-resources"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$StagingRoot = Join-Path $RepoRoot "build\staging"
$OutputRootFull = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputRoot))
$ExpectedStagingRoot = [System.IO.Path]::GetFullPath($StagingRoot)
$ExpectedStagingRootWithSep = $ExpectedStagingRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

function Assert-UnderStaging {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    if ($full -ne $ExpectedStagingRoot -and -not $full.StartsWith($ExpectedStagingRootWithSep, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to operate outside build staging: $full"
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

function Copy-DirectoryContents {
    param([string]$Source, [string]$RelativeTarget)
    Assert-Directory $Source $RelativeTarget
    $target = Join-Path $OutputRootFull $RelativeTarget
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
    }
}

function Copy-ResourceFile {
    param([string]$Source, [string]$RelativeTarget, [string]$Label)
    Assert-File $Source $Label
    $target = Join-Path $OutputRootFull $RelativeTarget
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $Source -Destination $target -Force
}

function Get-RelativeUnixPath {
    param([string]$Base, [string]$Path)
    $baseFull = [System.IO.Path]::GetFullPath($Base).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $baseUri = New-Object System.Uri($baseFull)
    $pathUri = New-Object System.Uri($pathFull)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('\', '/')
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

Assert-UnderStaging $OutputRootFull
if ($Clean -and (Test-Path -LiteralPath $OutputRootFull)) {
    Remove-Item -LiteralPath $OutputRootFull -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutputRootFull | Out-Null

$pythonRuntime = Join-Path $RepoRoot "build\runtime\python"
$dotnetRuntime = Join-Path $RepoRoot "build\runtime\dotnet"
$scrcpyRoot = Join-Path $RepoRoot "scrcpy-win64-v4.0"
$flowAgentReleaseDir = Join-Path $RepoRoot "flow_agent_monolito\app\build\outputs\apk\app\release"
$flowAgentApk = Join-Path $flowAgentReleaseDir "agent-v1.0.0-arm64-v8a.apk"
$flowAgentUniversalApk = Join-Path $flowAgentReleaseDir "agent-v1.0.0-universal.apk"
$flowAgentMetadataPath = Join-Path $flowAgentReleaseDir "output-metadata.json"
$flowTrackNameExe = Join-Path $RepoRoot "Herramientas\FlowTrackName.exe"
$thirdPartyNotices = Join-Path $RepoRoot "docs\commercial\THIRD_PARTY_NOTICES.txt"

Assert-File (Join-Path $pythonRuntime "FlowDashboard.Backend.exe") "Python backend runtime"
Assert-File (Join-Path $pythonRuntime "FlowDashboard.MailHelper.exe") "FlowMail helper runtime"
Assert-File (Join-Path $dotnetRuntime "FlowDashboard.Core.exe") "C# self-contained runtime"
Assert-File $flowAgentUniversalApk "FlowAgent universal APK"
Assert-File $flowAgentMetadataPath "FlowAgent output metadata"
Assert-File $flowTrackNameExe "FlowTrackName executable"
Assert-File $thirdPartyNotices "third-party notices"

$metadata = Get-Content -LiteralPath $flowAgentMetadataPath -Raw | ConvertFrom-Json
$universal = @($metadata.elements | Where-Object { $_.outputFile -eq "agent-v1.0.0-universal.apk" })[0]
if (-not $universal) {
    throw "FlowAgent metadata does not contain agent-v1.0.0-universal.apk"
}
if ([string]$universal.versionName -ne "1.0.0" -or [int]$universal.versionCode -ne 106) {
    throw "FlowAgent universal APK metadata mismatch: versionName=$($universal.versionName), versionCode=$($universal.versionCode)"
}

Copy-DirectoryContents $pythonRuntime "runtime\python"
Copy-DirectoryContents $dotnetRuntime "runtime\dotnet"

$scrcpyFiles = @(
    "adb.exe",
    "AdbWinApi.dll",
    "AdbWinUsbApi.dll",
    "avcodec-62.dll",
    "avformat-62.dll",
    "avutil-60.dll",
    "libusb-1.0.dll",
    "scrcpy.exe",
    "scrcpy-server",
    "scrcpy-server.jar",
    "SDL3.dll",
    "swresample-6.dll",
    "disconnected.png",
    "scrcpy.png"
)
foreach ($fileName in $scrcpyFiles) {
    Copy-ResourceFile (Join-Path $scrcpyRoot $fileName) (Join-Path "scrcpy-win64-v4.0" $fileName) "scrcpy resource $fileName"
}

Copy-ResourceFile $flowAgentUniversalApk "android\flowagent\agent-v1.0.0-universal.apk" "FlowAgent commercial APK"
Copy-ResourceFile $flowTrackNameExe "Herramientas\FlowTrackName.exe" "FlowTrackName executable"
Copy-ResourceFile $thirdPartyNotices "THIRD_PARTY_NOTICES.txt" "third-party notices"

$scriptFiles = @("Login.js", "Register.js")
foreach ($scriptFile in $scriptFiles) {
    $source = Join-Path $RepoRoot $scriptFile
    if (Test-Path -LiteralPath $source -PathType Leaf) {
        Copy-ResourceFile $source (Join-Path "scripts" $scriptFile) "automation script $scriptFile"
    }
}

$flowTrackStartupTest = @{
    executed = $false
    result = "not-run"
    note = "FlowTrackName has no documented silent CLI mode; execute with -SmokeTestFlowTrackName only during interactive validation."
}
if ($SmokeTestFlowTrackName) {
    $process = Start-Process -FilePath (Join-Path $OutputRootFull "Herramientas\FlowTrackName.exe") -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 3
    $flowTrackStartupTest.executed = $true
    $flowTrackStartupTest.result = if ($process.HasExited) { "started-and-exited" } else { "started" }
    if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
        $flowTrackStartupTest.result = "started-and-stopped"
    }
}

$files = Get-ChildItem -LiteralPath $OutputRootFull -Recurse -File | Sort-Object FullName | ForEach-Object {
    [pscustomobject]@{
        path = Get-RelativeUnixPath $OutputRootFull $_.FullName
        bytes = $_.Length
        sha256 = Get-Sha256 $_.FullName
    }
}

$forbiddenPatterns = @(
    '(^|/)\.supabase_config\.json$',
    '(^|/)\.env$',
    '(^|/)device_names\.json$',
    '(^|/)device_groups\.json$',
    '(^|/)device_inventory\.json$',
    '(^|/)device_mappings\.json$',
    '(^|/)device_registrations\.json$',
    '(^|/)mail_config\.json$',
    '(^|/)license\.json$',
    '(^|/)recordings(/|$)',
    '(^|/)\.flowlogin_payloads(/|$)',
    '(^|/)\.upload_tmp(/|$)',
    '(^|/)\.app_icon_cache(/|$)',
    '(^|/)reports(/|$)',
    '(^|/)restore_points(/|$)',
    '(^|/).*\.sql$'
)
$forbiddenMatches = @($files | Where-Object {
    $relativePath = $_.path
    $forbiddenPatterns | Where-Object { $relativePath -match $_ } | Select-Object -First 1
})
if ($forbiddenMatches.Count -gt 0) {
    $joined = ($forbiddenMatches | Select-Object -First 20 | ForEach-Object { $_.path }) -join ", "
    throw "Forbidden files were staged: $joined"
}

$requiredRelativePaths = @(
    "runtime/python/FlowDashboard.Backend.exe",
    "runtime/python/FlowDashboard.MailHelper.exe",
    "runtime/dotnet/FlowDashboard.Core.exe",
    "scrcpy-win64-v4.0/adb.exe",
    "scrcpy-win64-v4.0/scrcpy.exe",
    "scrcpy-win64-v4.0/scrcpy-server.jar",
    "android/flowagent/agent-v1.0.0-universal.apk",
    "Herramientas/FlowTrackName.exe",
    "scripts/Login.js",
    "THIRD_PARTY_NOTICES.txt"
)
$stagedPaths = @{}
$files | ForEach-Object { $stagedPaths[$_.path] = $true }
foreach ($relative in $requiredRelativePaths) {
    if (-not $stagedPaths.ContainsKey($relative)) {
        throw "Missing required staged file: $relative"
    }
}

$manifest = [ordered]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    product = "FlowDashboard"
    version = "2.0.0"
    phase = "COMMERCIAL-V2-PHASE7-RESOURCES"
    outputRoot = $OutputRootFull
    layout = [ordered]@{
        runtime = "runtime/"
        scrcpy = "scrcpy-win64-v4.0/"
        flowAgent = "android/flowagent/agent-v1.0.0-universal.apk"
        flowTrackName = "Herramientas/FlowTrackName.exe"
        scripts = "scripts/"
        thirdPartyNotices = "THIRD_PARTY_NOTICES.txt"
    }
    flowAgent = [ordered]@{
        includedAbi = "universal"
        versionName = [string]$universal.versionName
        versionCode = [int]$universal.versionCode
        arm64ApkAvailable = (Test-Path -LiteralPath $flowAgentApk -PathType Leaf)
        arm64ApkIncluded = $false
        abiDecision = "Universal APK selected in Phase 7 for full device compatibility (arm64-v8a, armeabi-v7a, armeabi, x86, x86_64). Same FlowAgent monolito build (applicationId com.flowlogin.agent, versionCode 106)."
        source = Get-RelativeUnixPath $RepoRoot $flowAgentUniversalApk
    }
    flowTrackName = [ordered]@{
        source = Get-RelativeUnixPath $RepoRoot $flowTrackNameExe
        installedPath = "Herramientas/FlowTrackName.exe"
        bytes = (Get-Item -LiteralPath $flowTrackNameExe).Length
        sha256 = Get-Sha256 $flowTrackNameExe
        startupTest = $flowTrackStartupTest
    }
    exclusions = @(
        ".supabase_config.json",
        ".flowlogin_payloads/",
        "device_names.json",
        "device_groups.json",
        "device_inventory.json",
        "device_mappings.json",
        "device_registrations.json",
        "mail_config.json",
        "recordings/",
        "reports/",
        "restore_points/",
        "*.sql",
        "flow_agent_monolito Gradle sources",
        "flow_agent_apk legacy/debug outputs",
        "FlowAgent per-ABI split APKs (arm64-v8a, armeabi-v7a, armeabi, x86, x86_64) - universal selected",
        "root scrcpy-server duplicates"
    )
    fileCount = $files.Count
    totalBytes = ($files | Measure-Object -Property bytes -Sum).Sum
    files = $files
}

$manifestPath = Join-Path $OutputRootFull "RESOURCE_MANIFEST.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$summary = [ordered]@{
    ok = $true
    outputRoot = $OutputRootFull
    manifest = $manifestPath
    fileCount = $manifest.fileCount
    totalBytes = $manifest.totalBytes
    flowAgentAbi = $manifest.flowAgent.includedAbi
    flowAgentVersion = "$($manifest.flowAgent.versionName)+$($manifest.flowAgent.versionCode)"
    arm64Available = $manifest.flowAgent.arm64ApkAvailable
    arm64Included = $manifest.flowAgent.arm64ApkIncluded
    flowTrackNameSha256 = $manifest.flowTrackName.sha256
}

$summary | ConvertTo-Json -Depth 4
