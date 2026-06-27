[CmdletBinding()]
param(
    [string]$Path = "",
    [ValidateSet("tracked","staged","all")]
    [string]$Scope = "tracked",
    [switch]$IncludeDocs,
    [int]$MaxFileSizeKB = 2048,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Path)) {
    $Path = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$repoRoot = (Resolve-Path $Path).Path
Set-Location $repoRoot

$prohibitedNames = @(
    ".supabase_config.json",
    ".supabase_db_url",
    "mail_config.json",
    "update_config.json",
    "h264_canary_config.json"
)
$prohibitedExt = @(".pfx", ".pem", ".p12", ".key", ".keystore", ".jks")

$patterns = @(
    @{ Name = "JWT"; Severity = "BLOCK"; Regex = "eyJ[A-Za-z0-9_=-]{8,}\.[A-Za-z0-9_=-]{8,}\.[A-Za-z0-9_=-]{6,}" },
    @{ Name = "PEM_PRIVATE_KEY"; Severity = "BLOCK"; Regex = "-----BEGIN [A-Z ]*PRIVATE KEY-----" },
    @{ Name = "CERTIFICATE"; Severity = "BLOCK"; Regex = "-----BEGIN CERTIFICATE-----" },
    @{ Name = "GITHUB_TOKEN"; Severity = "BLOCK"; Regex = "gh[pousr]_[A-Za-z0-9]{20,}" },
    @{ Name = "GITHUB_PAT"; Severity = "BLOCK"; Regex = "github_pat_[A-Za-z0-9_]{20,}" },
    @{ Name = "CAPSOLVER_KEY"; Severity = "BLOCK"; Regex = "CAP-[A-Z0-9]{16,}" },
    @{ Name = "PG_CONN_PASSWORD"; Severity = "BLOCK"; Regex = "postgres(ql)?://[^:/\s]+:[^@\s]{3,}@" },
    @{ Name = "SECRET_ASSIGNMENT"; Severity = "WARN"; Regex = "(?i)(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*[`"'][^`"'\s]{8,}[`"']" }
)

function Get-TargetFiles {
    switch ($Scope) {
        "staged" { $list = & git diff --cached --name-only 2>$null }
        "tracked" { $list = & git ls-files 2>$null }
        "all" { $list = & git ls-files --cached --others --exclude-standard 2>$null }
    }
    if (-not $list) {
        $list = Get-ChildItem -Path $repoRoot -Recurse -File |
            Where-Object { $_.FullName -notmatch "\\(node_modules|\.git|\.venv|restore_points|release|release_packages|win-unpacked|dist|bin|obj)\\" } |
            ForEach-Object { $_.FullName.Substring($repoRoot.Length + 1) }
    }
    return $list
}

$findings = New-Object System.Collections.Generic.List[object]
$files = Get-TargetFiles

foreach ($rel in $files) {
    if ([string]::IsNullOrWhiteSpace($rel)) { continue }
    $full = Join-Path $repoRoot $rel
    if (-not (Test-Path $full -PathType Leaf)) { continue }

    $leaf = Split-Path $rel -Leaf
    $ext = [System.IO.Path]::GetExtension($leaf).ToLower()

    if ($prohibitedNames -contains $leaf) {
        $findings.Add([pscustomobject]@{ Severity = "BLOCK"; Type = "PROHIBITED_FILE"; File = $rel; Line = 0; Match = $leaf })
        continue
    }
    if ($prohibitedExt -contains $ext) {
        $findings.Add([pscustomobject]@{ Severity = "BLOCK"; Type = "PROHIBITED_EXT"; File = $rel; Line = 0; Match = $ext })
        continue
    }

    if ($rel -replace "/","\" -eq ("scripts\security\scan-secrets.ps1")) { continue }

    $info = Get-Item $full
    if ($info.Length -gt ($MaxFileSizeKB * 1024)) { continue }

    $isDoc = ($ext -eq ".md" -or $ext -eq ".txt")
    if ($isDoc -and -not $IncludeDocs) { continue }

    $content = Get-Content -LiteralPath $full -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    if ($content.Contains([char]0)) { continue }

    foreach ($p in $patterns) {
        $m = [regex]::Matches($content, $p.Regex)
        foreach ($hit in $m) {
            $prefix = $content.Substring(0, $hit.Index)
            $lineNo = ([regex]::Matches($prefix, "`n")).Count + 1
            $snippet = $hit.Value
            if ($snippet.Length -gt 40) { $snippet = $snippet.Substring(0, 12) + "..." + $snippet.Substring($snippet.Length - 6) }
            $findings.Add([pscustomobject]@{ Severity = $p.Severity; Type = $p.Name; File = $rel; Line = $lineNo; Match = $snippet })
        }
    }
}

$blockers = @($findings | Where-Object { $_.Severity -eq "BLOCK" })
$warns = @($findings | Where-Object { $_.Severity -eq "WARN" })

if (-not $Quiet) {
    Write-Host ""
    Write-Host "Escaneo de secretos (scope=$Scope, archivos=$($files.Count))" -ForegroundColor Cyan
    if ($findings.Count -eq 0) {
        Write-Host "Sin hallazgos." -ForegroundColor Green
    } else {
        foreach ($f in $findings) {
            $color = if ($f.Severity -eq "BLOCK") { "Red" } else { "Yellow" }
            Write-Host ("[{0}] {1} {2}:{3} {4}" -f $f.Severity, $f.Type, $f.File, $f.Line, $f.Match) -ForegroundColor $color
        }
    }
    Write-Host ""
    Write-Host ("Bloqueantes: {0}  Avisos: {1}" -f $blockers.Count, $warns.Count) -ForegroundColor Cyan
}

if ($blockers.Count -gt 0) { exit 1 }
exit 0
