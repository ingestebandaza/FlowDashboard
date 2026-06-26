$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DashboardUrl = "http://127.0.0.1:8765/wsapi_demo.html"
$HealthUrl = "http://127.0.0.1:8765/health"
$PythonCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python310\python.exe"),
    "python"
)
$AdbCandidates = @(
    (Join-Path $AppDir "scrcpy-win64-v4.0\adb.exe"),
    "adb"
)

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text
}

function Get-FirstCommand {
    param([string[]]$Candidates)
    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        if (Test-Path -LiteralPath $candidate) { return $candidate }
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Invoke-NativeQuiet {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $global:LASTEXITCODE = 0
    try {
        $ErrorActionPreference = "Continue"
        & $FilePath @Arguments *>$null
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-NativeOutput {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $global:LASTEXITCODE = 0
    try {
        $ErrorActionPreference = "Continue"
        return & $FilePath @Arguments 2>$null
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-NativeTimed {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [int]$TimeoutSec = 10,
        [switch]$CaptureOutput
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $escapedArguments = @()
    foreach ($arg in $Arguments) {
        $text = [string]$arg
        if ($text -match '[\s"]') {
            $text = '"' + ($text -replace '"', '\"') + '"'
        }
        $escapedArguments += $text
    }
    $psi.Arguments = $escapedArguments -join " "
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    if (-not $process.WaitForExit($TimeoutSec * 1000)) {
        try { $process.Kill() } catch {}
        return @{
            ExitCode = 124
            Output = ""
            Error = "Timeout despues de $TimeoutSec segundos: $FilePath $($Arguments -join ' ')"
            TimedOut = $true
        }
    }

    $output = $process.StandardOutput.ReadToEnd()
    $errorText = $process.StandardError.ReadToEnd()
    return @{
        ExitCode = $process.ExitCode
        Output = $output
        Error = $errorText
        TimedOut = $false
    }
}

function Invoke-AdbTimedQuiet {
    param(
        [Parameter(Mandatory = $true)][string]$Adb,
        [string[]]$Arguments = @(),
        [int]$TimeoutSec = 10
    )
    $result = Invoke-NativeTimed -FilePath $Adb -Arguments $Arguments -TimeoutSec $TimeoutSec
    if ($result.TimedOut) {
        Write-Host "   ADB tardo demasiado: adb $($Arguments -join ' ')"
    }
    return $result
}

function Test-ServerReady {
    try {
        $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 -ErrorAction Stop
        return [bool]$response.ok
    } catch {
        return $false
    }
}

function Stop-FlowDashboardProcesses {
    $currentPid = $PID
    $patterns = @(
        "local_adb_server.py",
        "websocket_server.py",
        "launcher.py"
    )

    try {
        $processes = Get-CimInstance Win32_Process -ErrorAction Stop |
            Where-Object {
                $commandLine = $_.CommandLine
                $matchesFlowDashboardScript = $false
                foreach ($pattern in $patterns) {
                    if ($commandLine -like "*$pattern*") {
                        $matchesFlowDashboardScript = $true
                        break
                    }
                }

                $_.ProcessId -ne $currentPid -and
                $commandLine -and
                (
                    ($_.Name -match "^(python|pythonw)\.exe$" -and $matchesFlowDashboardScript) -or
                    ($_.Name -eq "FlowDashboard.exe")
                )
            }
    } catch {
        Write-Host "   No se pudo leer la linea de comandos de procesos; se usara limpieza por puertos."
        $processes = @()
    }

    foreach ($process in $processes) {
        Write-Host "   Cerrando proceso previo: $($process.Name) PID $($process.ProcessId)"
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Get-KnownAdbSerials {
    $serials = New-Object System.Collections.Generic.List[string]

    $payloadDir = Join-Path $AppDir ".flowlogin_payloads"
    if (Test-Path -LiteralPath $payloadDir) {
        Get-ChildItem -LiteralPath $payloadDir -File -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.BaseName -match "^(\d{1,3}(?:\.\d{1,3}){3})_(\d+)_accounts$") {
                $serial = "$($matches[1]):$($matches[2])"
                if (-not $serials.Contains($serial)) { $serials.Add($serial) }
            }
        }
    }

    foreach ($fileName in @("device_names.json", "device_groups.json")) {
        $path = Join-Path $AppDir $fileName
        if (Test-Path -LiteralPath $path) {
            $text = Get-Content -Raw -LiteralPath $path -ErrorAction SilentlyContinue
            if ($text) {
                [regex]::Matches($text, "\b\d{1,3}(?:\.\d{1,3}){3}(?::5555)?\b") | ForEach-Object {
                    $serial = $_.Value
                    if ($serial -notlike "*:*") { $serial = "$serial`:5555" }
                    if (-not $serials.Contains($serial)) { $serials.Add($serial) }
                }
            }
        }
    }

    return @($serials)
}

function Test-TcpPortFast {
    param(
        [Parameter(Mandatory = $true)][string]$HostName,
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 350
    )

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Get-ReachableAdbSerials {
    param([string[]]$Serials)

    $reachable = New-Object System.Collections.Generic.List[string]
    foreach ($serial in $Serials) {
        if ($serial -match "^([^:]+):(\d+)$") {
            if (Test-TcpPortFast -HostName $matches[1] -Port ([int]$matches[2])) {
                $reachable.Add($serial)
            }
        }
    }
    return @($reachable)
}

function Stop-PortOwners {
    param([int[]]$Ports)

    foreach ($port in $Ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($connection in $connections) {
            if ($connection.OwningProcess -and $connection.OwningProcess -ne $PID) {
                $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "   Liberando puerto $port ocupado por $($process.ProcessName) PID $($process.Id)"
                    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}

function Reset-AdbSession {
    param([string]$Adb)

    if (-not $Adb) {
        Write-Host "   ADB no encontrado en PATH ni en scrcpy-win64-v4.0."
        return
    }

    Write-Host "   Usando ADB: $Adb"
    Get-Process -Name "adb" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("kill-server") -TimeoutSec 5 | Out-Null
    Start-Sleep -Milliseconds 700
    Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("start-server") -TimeoutSec 8 | Out-Null
    Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("forward", "--remove-all") -TimeoutSec 5 | Out-Null

    $knownSerials = Get-KnownAdbSerials
    if ($knownSerials.Count -gt 0) {
        Write-Host "   Dispositivos WiFi conocidos: $($knownSerials.Count). Conectando todos..."
        foreach ($serial in $knownSerials) {
            Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("connect", $serial) -TimeoutSec 6 | Out-Null
        }
        Start-Sleep -Seconds 3
    }

    $devicesResult = Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("devices") -TimeoutSec 8
    $devicesText = @()
    if (-not $devicesResult.TimedOut) {
        $devicesText = $devicesResult.Output -split "`r?`n"
    }
    $serials = @()
    foreach ($line in $devicesText) {
        if ($line -match "^([^\s]+)\s+device$") {
            $serials += $matches[1]
        }
    }

    foreach ($serial in $serials) {
        Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("-s", $serial, "reverse", "--remove", "tcp:8766") -TimeoutSec 5 | Out-Null
        Invoke-AdbTimedQuiet -Adb $Adb -Arguments @("-s", $serial, "reverse", "tcp:8766", "tcp:8766") -TimeoutSec 5 | Out-Null
    }

    Write-Host "   ADB reiniciado. Dispositivos listos: $($serials.Count)"
}

function Start-LocalServer {
    param(
        [string]$Python,
        [string]$Adb
    )

    if (-not $Python) {
        throw "No se encontro Python. Instala Python o agrega python.exe al PATH."
    }

    Write-Host "   Usando Python: $Python"
    if ($Adb) {
        $env:FLOWDASHBOARD_ADB = $Adb
        Write-Host "   Backend usara ADB: $Adb"
    }
    Start-Process -FilePath $Python -ArgumentList "-u", "local_adb_server.py" -WorkingDirectory $AppDir -WindowStyle Normal

    for ($i = 1; $i -le 30; $i++) {
        if (Test-ServerReady) {
            Write-Host "   Servidor HTTP/ADB listo en 127.0.0.1:8765"
            Write-Host "   Socket FlowAgent listo en 0.0.0.0:8766"
            Write-Host "   WebSocket streaming listo en 127.0.0.1:8767"
            try {
                Write-Host "   Preparando FlowAgent en dispositivos conectados..."
                $payload = @{ deviceIds = "all"; install = "auto"; launch = $true } | ConvertTo-Json
                Invoke-RestMethod -Uri "http://127.0.0.1:8765/flowagent/setup" -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 180 | Out-Null
                Start-Sleep -Seconds 3
            } catch {
                Write-Host "   FlowAgent no quedo preparado automaticamente: $($_.Exception.Message)"
            }
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw "El servidor local no respondio en /health despues de 15 segundos."
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  FLOWDASHBOARD - INICIANDO SESION LIMPIA"
Write-Host "============================================================"

Set-Location -LiteralPath $AppDir

Write-Step "[1/5] Cerrando sesiones anteriores de FlowDashboard..."
Stop-FlowDashboardProcesses
Stop-PortOwners -Ports @(8765, 8766, 8767)
Stop-Process -Name "scrcpy" -Force -ErrorAction SilentlyContinue
Write-Host "   Limpieza de procesos completada."

Write-Step "[2/5] Reiniciando ADB y tuneles necesarios..."
$Adb = Get-FirstCommand -Candidates $AdbCandidates
Reset-AdbSession -Adb $Adb

Write-Step "[3/5] Iniciando servidor local, FlowAgent socket y streaming..."
$Python = Get-FirstCommand -Candidates $PythonCandidates
Start-LocalServer -Python $Python -Adb $Adb

Write-Step "[4/5] Abriendo dashboard..."
Start-Process "chrome" -ArgumentList $DashboardUrl
Write-Host "   Dashboard abierto: $DashboardUrl"

Write-Step "[5/5] Listo."
Write-Host ""
Write-Host "============================================================"
Write-Host "  URL: $DashboardUrl"
Write-Host "============================================================"
