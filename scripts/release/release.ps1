param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("validate", "local", "beta", "stable", "publish", "restore", "diagnostics")]
    [string]$Action,

    [ValidateSet("patch", "minor", "major", "beta")]
    [string]$Bump,

    [string]$RestorePoint,

    [switch]$Approve,

    [switch]$CommitPush
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$VersionFile = Join-Path $RepoRoot "version.json"
$ReleaseRoot = Join-Path $RepoRoot "release_packages"
$RestoreRoot = Join-Path $RepoRoot "restore_points"
$LogRoot = Join-Path $RepoRoot "build\release-logs"
$ExpectedBranch = "commercial/v2.0.0"

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Text)
    Write-Host "    [OK]   $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "    [WARN] $Text" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Text)
    Write-Host "    [FAIL] $Text" -ForegroundColor Red
}

function Get-VersionInfo {
    if (-not (Test-Path -LiteralPath $VersionFile)) {
        throw "version.json no encontrado en $VersionFile"
    }
    return Get-Content -LiteralPath $VersionFile -Raw | ConvertFrom-Json
}

function Save-VersionInfo {
    param($Info)
    $json = $Info | ConvertTo-Json -Depth 10
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($VersionFile, $json + [Environment]::NewLine, $encoding)
}

function Test-Tool {
    param([string]$Name, [string]$Command)
    $cmd = Get-Command $Command -ErrorAction SilentlyContinue
    if ($cmd) {
        return [pscustomobject]@{ Name = $Name; Status = "OK"; Detail = [string]$cmd.Source }
    }
    return [pscustomobject]@{ Name = $Name; Status = "MISSING"; Detail = "no disponible" }
}

function Invoke-Preflight {
    param([switch]$RequireBuild, [switch]$RequirePublish)

    Write-Step "Preflight"
    $results = New-Object System.Collections.Generic.List[object]
    $fatal = $false

    $rootMarkers = @("version.json", "electron-app", "FlowDashboard.Core", "scripts")
    $rootOk = $true
    foreach ($marker in $rootMarkers) {
        if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $marker))) { $rootOk = $false }
    }
    if ($rootOk) { Write-Ok "Raiz del proyecto correcta" } else { Write-Fail "Raiz del proyecto invalida"; $fatal = $true }

    try {
        $branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null).Trim()
        if ($branch -eq $ExpectedBranch) { Write-Ok "Rama: $branch" }
        else { Write-Warn "Rama actual '$branch' (esperada '$ExpectedBranch')" }
    } catch { Write-Warn "No se pudo determinar la rama Git" }

    try {
        $status = & git -C $RepoRoot status --porcelain 2>$null
        if ([string]::IsNullOrWhiteSpace(($status | Out-String))) { Write-Ok "Arbol de trabajo limpio" }
        else { Write-Warn "Hay cambios sin confirmar en el arbol de trabajo" }
    } catch { Write-Warn "No se pudo consultar el estado Git" }

    $node = Test-Tool "Node" "node"
    if ($node.Status -eq "OK") { Write-Ok "Node ($($node.Detail))" } else { Write-Fail "Node no disponible"; if ($RequireBuild) { $fatal = $true } }

    $npm = Test-Tool "npm" "npm"
    if ($npm.Status -eq "OK") { Write-Ok "npm ($($npm.Detail))" } else { Write-Fail "npm no disponible"; if ($RequireBuild) { $fatal = $true } }

    $dotnet = Test-Tool ".NET SDK" "dotnet"
    if ($dotnet.Status -eq "OK") { Write-Ok ".NET SDK ($($dotnet.Detail))" } else { Write-Fail ".NET SDK no disponible"; if ($RequireBuild) { $fatal = $true } }

    try {
        $git = (& git --version 2>$null)
        Write-Ok ($git | Select-Object -First 1)
    } catch { Write-Fail "Git no disponible"; $fatal = $true }

    $pythonCandidates = @(
        $env:FLOWDASHBOARD_PYTHON,
        (Join-Path $RepoRoot ".venv\Scripts\python.exe"),
        (Join-Path $RepoRoot "python\python.exe"),
        "python"
    )
    $pyOk = $false
    foreach ($candidate in $pythonCandidates) {
        if (-not $candidate) { continue }
        try {
            & $candidate -m PyInstaller --version 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Ok "Python+PyInstaller: $candidate"; $pyOk = $true; break }
        } catch { }
    }
    if (-not $pyOk) { Write-Warn "Python con PyInstaller no detectado"; if ($RequireBuild) { $fatal = $true } }

    $gh = Test-Tool "GitHub CLI" "gh"
    if ($gh.Status -eq "OK") { Write-Ok "GitHub CLI disponible" }
    else { if ($RequirePublish) { Write-Fail "GitHub CLI requerido para publicar"; $fatal = $true } else { Write-Warn "GitHub CLI no disponible" } }

    try {
        $drive = Get-PSDrive -Name ($RepoRoot.Substring(0, 1)) -ErrorAction Stop
        $freeGb = [math]::Round($drive.Free / 1GB, 1)
        if ($freeGb -ge 5) { Write-Ok "Espacio libre: ${freeGb} GB" } else { Write-Warn "Espacio libre bajo: ${freeGb} GB" }
    } catch { Write-Warn "No se pudo medir el espacio libre" }

    $resources = @(
        @{ Path = "scrcpy-win64-v4.0\adb.exe"; Label = "ADB" },
        @{ Path = "scrcpy-win64-v4.0\scrcpy.exe"; Label = "scrcpy" },
        @{ Path = "flow_agent_monolito\app\build\outputs\apk\app\release\agent-v1.0.0-universal.apk"; Label = "FlowAgent APK universal" },
        @{ Path = "Herramientas\FlowTrackName.exe"; Label = "FlowTrackName" }
    )
    foreach ($res in $resources) {
        $full = Join-Path $RepoRoot $res.Path
        if (Test-Path -LiteralPath $full) { Write-Ok "$($res.Label) presente" }
        else { if ($RequireBuild) { Write-Fail "$($res.Label) faltante: $($res.Path)"; $fatal = $true } else { Write-Warn "$($res.Label) faltante" } }
    }

    $secretFiles = @(".supabase_config.json", ".supabase_db_url", "mail_config.json")
    foreach ($secret in $secretFiles) {
        $full = Join-Path $RepoRoot $secret
        if (Test-Path -LiteralPath $full) { Write-Ok "Secreto local presente: $secret" }
        else { Write-Warn "Secreto local ausente: $secret" }
    }

    if ($fatal) { throw "Preflight fallido: revise los elementos marcados [FAIL]." }
    Write-Ok "Preflight superado"
}

function Invoke-StaticTests {
    Write-Step "Tests estaticos"

    $jsFiles = @(
        "electron-app\src\main\index.js",
        "electron-app\preload\preload.js",
        "electron-app\src\main\entitlements-cache.js",
        "electron-app\src\renderer\app.js"
    )
    foreach ($rel in $jsFiles) {
        $full = Join-Path $RepoRoot $rel
        if (Test-Path -LiteralPath $full) {
            & node --check $full
            if ($LASTEXITCODE -ne 0) { throw "node --check fallo en $rel" }
            Write-Ok "node --check $rel"
        }
    }

    $pyCandidate = (Join-Path $RepoRoot ".venv\Scripts\python.exe")
    if (-not (Test-Path -LiteralPath $pyCandidate)) { $pyCandidate = "python" }
    $pyFiles = @("local_adb_server.py", "entitlements.py", "app_meta.py")
    foreach ($rel in $pyFiles) {
        $full = Join-Path $RepoRoot $rel
        if (Test-Path -LiteralPath $full) {
            & $pyCandidate -m py_compile $full
            if ($LASTEXITCODE -ne 0) { throw "py_compile fallo en $rel" }
            Write-Ok "py_compile $rel"
        }
    }
    Write-Ok "Tests estaticos superados"
}

function New-RestorePoint {
    param([string]$Tag)
    $date = Get-Date -Format "yyyy-MM-dd"
    $dir = Join-Path $RestoreRoot "${date}_$Tag"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $files = @(
        "version.json",
        "electron-app\package.json",
        "app_meta.py",
        "FlowDashboard.Core\FlowDashboard.Core.csproj"
    )
    foreach ($rel in $files) {
        $src = Join-Path $RepoRoot $rel
        if (Test-Path -LiteralPath $src) {
            $dst = Join-Path $dir ($rel -replace "[\\/]", "__")
            Copy-Item -LiteralPath $src -Destination $dst -Force
        }
    }
    Write-Ok "Punto de restauracion: $dir"
    return $dir
}

function Step-VersionBump {
    param([string]$Type)
    $info = Get-VersionInfo
    $old = [string]$info.version
    if ($old -notmatch '^\d+\.\d+\.\d+$') { throw "version.json invalida: $old" }
    $parts = $old.Split(".")
    [int]$maj = $parts[0]; [int]$min = $parts[1]; [int]$pat = $parts[2]
    switch ($Type) {
        "major" { $maj++; $min = 0; $pat = 0; $info.channel = "stable" }
        "minor" { $min++; $pat = 0; $info.channel = "stable" }
        "patch" { $pat++; $info.channel = "stable" }
        "beta"  { $pat++; $info.channel = "beta" }
    }
    $new = "$maj.$min.$pat"
    $info.version = $new
    Save-VersionInfo $info
    Write-Ok "Version $old -> $new (canal $($info.channel))"
    return [pscustomobject]@{ Old = $old; New = $new; Channel = [string]$info.channel }
}

function Step-SyncVersion {
    Write-Step "Sincronizar version"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\release\sync-version.ps1")
    if ($LASTEXITCODE -ne 0) { throw "sync-version.ps1 fallo" }
    Write-Ok "Version sincronizada"
}

function Step-BuildBackends {
    Write-Step "Build Python + MailHelper"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\build\build-python.ps1") -Clean
    if ($LASTEXITCODE -ne 0) { throw "build-python.ps1 fallo" }
    Write-Ok "Backend Python construido"

    Write-Step "Publish C#"
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\build\build-dotnet.ps1") -Clean
    if ($LASTEXITCODE -ne 0) { throw "build-dotnet.ps1 fallo" }
    Write-Ok "Backend C# publicado"
}

function Step-BuildInstaller {
    param([switch]$DirOnly)
    Write-Step "Build Electron + instalador NSIS"
    $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $RepoRoot "scripts\build\build-electron-installer.ps1"), "-Clean", "-SkipVersionSync")
    if ($DirOnly) { $args += "-DirOnly" }
    & powershell @args
    if ($LASTEXITCODE -ne 0) { throw "build-electron-installer.ps1 fallo" }
    Write-Ok "Instalador generado"
}

function Get-LatestInstaller {
    if (-not (Test-Path -LiteralPath $ReleaseRoot)) { return $null }
    return Get-ChildItem -LiteralPath $ReleaseRoot -Filter "FlowDashboard-Setup-*.exe" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Step-SecretScan {
    Write-Step "Escaneo de secretos (repositorio rastreado)"
    $scanner = Join-Path $RepoRoot "scripts\security\scan-secrets.ps1"
    if (Test-Path -LiteralPath $scanner) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $scanner -Scope tracked
        if ($LASTEXITCODE -ne 0) { throw "Escaneo de secretos (repositorio) encontro bloqueantes. Release abortada." }
        Write-Ok "Escaneo de repositorio sin bloqueantes"
    } else {
        Write-Warn "scan-secrets.ps1 no encontrado: usando escaneo basico"
    }

    Write-Step "Escaneo de secretos en release_packages"
    if (-not (Test-Path -LiteralPath $ReleaseRoot)) { Write-Warn "release_packages no existe"; return }
    $patterns = @(
        "postgresql://",
        "service_role",
        "BEGIN PRIVATE KEY",
        "pooler.supabase.com",
        "SUPABASE_KEY"
    )
    $bannedNames = @(".supabase_config.json", ".supabase_db_url", "mail_config.json")
    $hits = New-Object System.Collections.Generic.List[string]
    Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ($bannedNames -contains $_.Name) { $hits.Add("archivo prohibido: $($_.FullName)") }
        if ($_.Length -lt 2MB -and $_.Extension -match '^\.(json|yml|yaml|js|txt|cfg|ini|env)$') {
            $text = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
            foreach ($pat in $patterns) {
                if ($text -and $text -match [regex]::Escape($pat)) { $hits.Add("patron '$pat' en $($_.FullName)") }
            }
        }
    }
    if ($hits.Count -gt 0) {
        foreach ($h in $hits) { Write-Fail $h }
        throw "Escaneo de secretos encontro coincidencias. Release abortada."
    }
    Write-Ok "Sin secretos detectados"
}

function Step-Sign {
    param([switch]$Require)
    Write-Step "Firma de artefactos"
    $signer = Join-Path $RepoRoot "scripts\security\sign-artifacts.ps1"
    if (-not (Test-Path -LiteralPath $signer)) { Write-Warn "sign-artifacts.ps1 no encontrado: omitiendo firma"; return }
    $installer = Get-LatestInstaller
    $installerPath = if ($installer) { $installer.FullName } else { "" }
    $signArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $signer, "-InstallerPath", $installerPath)
    if ($Require) { $signArgs += "-RequireSigning" }
    & powershell @signArgs
    if ($LASTEXITCODE -ne 0) { throw "Firma de artefactos fallida." }
    Write-Ok "Etapa de firma completada"
}

function Step-Hashes {
    Write-Step "Hashes SHA256"
    $installer = Get-LatestInstaller
    if (-not $installer) { Write-Warn "Instalador no encontrado"; return $null }
    $hash = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Ok "$($installer.Name): $hash"
    return [pscustomobject]@{ File = $installer.FullName; Name = $installer.Name; Sha256 = $hash }
}

function Step-ReleaseNotes {
    param([string]$Version, [string]$Channel)
    Write-Step "Notas de release"
    $notes = Join-Path $RepoRoot "RELEASE_NOTES_$Version.md"
    if (-not (Test-Path -LiteralPath $notes)) {
        $text = @(
            "# Release Notes - FlowDashboard $Version",
            "",
            "Canal: $Channel",
            "Fecha: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))",
            "",
            "## Cambios",
            "",
            "- Pendiente de completar por el propietario.",
            ""
        ) -join [Environment]::NewLine
        $encoding = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($notes, $text, $encoding)
        Write-Ok "Generadas $notes"
    } else {
        Write-Ok "Ya existen $notes"
    }
    return $notes
}

function Get-CurrentBranch {
    $branch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $branch) { throw "No se pudo determinar la rama Git actual" }
    return $branch.Trim()
}

function Step-CommitBump {
    param([string]$Version)
    Write-Step "Commit del incremento de version"
    $files = @(
        "version.json",
        "electron-app\package.json",
        "package.json",
        "app_meta.py",
        "FlowDashboard.Core\FlowDashboard.Core.csproj",
        "RELEASE_NOTES_$Version.md"
    )
    foreach ($rel in $files) {
        $path = Join-Path $RepoRoot $rel
        if (Test-Path -LiteralPath $path) { & git -C $RepoRoot add -- $rel | Out-Null }
    }
    $pending = & git -C $RepoRoot status --porcelain -- $files
    if (-not $pending) { Write-Warn "Sin cambios de version que confirmar"; return }
    & git -C $RepoRoot commit -m "chore(release): v$Version"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el commit de release" }
    Write-Ok "Commit de release v$Version creado"
}

function Step-PushBranch {
    Write-Step "Push de la rama"
    $branch = Get-CurrentBranch
    & git -C $RepoRoot push origin $branch
    if ($LASTEXITCODE -ne 0) { throw "No se pudo hacer push de la rama $branch" }
    Write-Ok "Rama $branch publicada en origin"
}

function Step-PushTag {
    param([string]$Tag)
    Write-Step "Push de la etiqueta"
    & git -C $RepoRoot push origin $Tag
    if ($LASTEXITCODE -ne 0) { throw "No se pudo hacer push de la etiqueta $Tag" }
    Write-Ok "Etiqueta $Tag publicada en origin"
}

function Step-Tag {
    param([string]$Version)
    Write-Step "Etiqueta Git"
    $tag = "v$Version"
    $existing = & git -C $RepoRoot tag --list $tag
    if ($existing) { Write-Warn "La etiqueta $tag ya existe"; return $tag }
    & git -C $RepoRoot tag -a $tag -m "FlowDashboard $Version"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la etiqueta $tag" }
    Write-Ok "Etiqueta $tag creada (push manual: git push origin $tag)"
    return $tag
}

function Step-DraftRelease {
    param([string]$Tag, [string]$NotesFile, [string]$InstallerPath, [string]$Channel)
    Write-Step "GitHub draft release"
    $ghOk = $false
    try { & gh --version 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $ghOk = $true } } catch { }
    if (-not $ghOk) { Write-Warn "GitHub CLI no disponible: omitiendo creacion de draft"; return }

    $assets = @()
    if ($InstallerPath -and (Test-Path -LiteralPath $InstallerPath)) { $assets += $InstallerPath }
    $latestYml = Join-Path $ReleaseRoot "latest.yml"
    if (Test-Path -LiteralPath $latestYml) { $assets += $latestYml }

    $prerelease = if ($Channel -eq "beta") { "--prerelease" } else { "" }
    $cmd = @("release", "create", $Tag, "--draft", "--title", "FlowDashboard $Tag", "--notes-file", $NotesFile)
    if ($prerelease) { $cmd += $prerelease }
    $cmd += $assets
    & gh @cmd
    if ($LASTEXITCODE -ne 0) { throw "gh release create fallo" }
    Write-Ok "Draft release $Tag creada (sin publicar)"
}

function Invoke-Publish {
    Write-Step "Publicar release preparada"
    if (-not $Approve) { throw "Publicacion requiere -Approve (aprobacion explicita)." }
    $info = Get-VersionInfo
    $tag = "v$($info.version)"
    $ghOk = $false
    try { & gh --version 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { $ghOk = $true } } catch { }
    if (-not $ghOk) { throw "GitHub CLI requerido para publicar." }
    & gh release edit $tag --draft=false
    if ($LASTEXITCODE -ne 0) { throw "gh release edit fallo" }
    Write-Ok "Release $tag publicada"
}

function Invoke-Restore {
    param([string]$Name)
    Write-Step "Restaurar version"
    if (-not $Name) {
        Write-Host "Puntos de restauracion disponibles:" -ForegroundColor Cyan
        Get-ChildItem -LiteralPath $RestoreRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  - $($_.Name)" }
        throw "Indique -RestorePoint <nombre>"
    }
    $dir = Join-Path $RestoreRoot $Name
    if (-not (Test-Path -LiteralPath $dir)) { throw "Punto de restauracion no encontrado: $dir" }
    Get-ChildItem -LiteralPath $dir -File | ForEach-Object {
        $rel = $_.Name -replace "__", "\"
        $dst = Join-Path $RepoRoot $rel
        Copy-Item -LiteralPath $_.FullName -Destination $dst -Force
        Write-Ok "Restaurado $rel"
    }
    Step-SyncVersion
    Write-Ok "Version restaurada desde $Name"
}

function Invoke-Diagnostics {
    Write-Step "Diagnosticos"
    $diag = Join-Path $RepoRoot "scripts\diagnostics\verify-documentation-consistency.ps1"
    if (Test-Path -LiteralPath $diag) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $diag
        if ($LASTEXITCODE -ne 0) { Write-Warn "Diagnostico de documentacion reporto incidencias" }
        else { Write-Ok "Diagnostico de documentacion superado" }
    } else { Write-Warn "Script de diagnostico no encontrado" }
    $info = Get-VersionInfo
    Write-Ok "Version actual: $($info.version) (canal $($info.channel))"
    $installer = Get-LatestInstaller
    if ($installer) { Write-Ok "Ultimo instalador: $($installer.Name)" } else { Write-Warn "No hay instaladores en release_packages" }
}

function Invoke-FullPipeline {
    param([string]$BumpType, [switch]$DoCommitPush)

    New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null

    Invoke-Preflight -RequireBuild
    $restorePointTag = "PRE_RELEASE_v" + ((Get-VersionInfo).version)
    New-RestorePoint -Tag $restorePointTag | Out-Null

    $bumpResult = $null
    if ($BumpType) {
        $bumpResult = Step-VersionBump -Type $BumpType
    }
    Step-SyncVersion

    try {
        Invoke-StaticTests
        Step-BuildBackends
        Step-BuildInstaller
        Step-SecretScan
        Step-Sign
        $hashInfo = Step-Hashes
        $info = Get-VersionInfo
        $notes = Step-ReleaseNotes -Version $info.version -Channel $info.channel
        if ($BumpType) {
            if ($DoCommitPush) {
                Step-CommitBump -Version $info.version
                Step-PushBranch
            }
            $tag = Step-Tag -Version $info.version
            if ($DoCommitPush) { Step-PushTag -Tag $tag }
            $installer = if ($hashInfo) { $hashInfo.File } else { $null }
            Step-DraftRelease -Tag $tag -NotesFile $notes -InstallerPath $installer -Channel $info.channel
        }
    } catch {
        if ($bumpResult) {
            Write-Warn "Build fallida: revirtiendo version $($bumpResult.New) -> $($bumpResult.Old)"
            $info = Get-VersionInfo
            $info.version = $bumpResult.Old
            $info.channel = $bumpResult.Channel
            Save-VersionInfo $info
            Step-SyncVersion
        }
        throw
    }

    Write-Step "Resumen"
    $info = Get-VersionInfo
    Write-Ok "Version: $($info.version) (canal $($info.channel))"
    $installer = Get-LatestInstaller
    if ($installer) { Write-Ok "Instalador: $($installer.FullName)" }
    if ($BumpType -and $DoCommitPush) { Write-Host "    Rama y etiqueta ya publicadas. Para publicar la release: GESTOR opcion 7 (o release.ps1 -Action publish -Approve)" -ForegroundColor Yellow }
    elseif ($BumpType) { Write-Host "    Para publicar: GESTOR opcion 7 (o release.ps1 -Action publish -Approve)" -ForegroundColor Yellow }
}

Write-Host "FlowDashboard release.ps1 - accion: $Action" -ForegroundColor Magenta

switch ($Action) {
    "validate" { Invoke-Preflight; Invoke-StaticTests }
    "local" { Invoke-FullPipeline -BumpType $null }
    "beta" { Invoke-FullPipeline -BumpType "beta" }
    "stable" {
        $type = $Bump
        if (-not $type -or $type -eq "beta") { $type = "patch" }
        Invoke-FullPipeline -BumpType $type -DoCommitPush:$CommitPush
    }
    "publish" { Invoke-Preflight -RequirePublish; Invoke-Publish }
    "restore" { Invoke-Restore -Name $RestorePoint }
    "diagnostics" { Invoke-Diagnostics }
}

Write-Host ""
Write-Host "release.ps1 finalizado." -ForegroundColor Magenta
