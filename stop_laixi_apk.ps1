$adb = 'C:\DASHBOARD\FlowDashboard\scrcpy-win64-v4.0\adb.exe'
$laixiPkg = 'youhu.laixijs'

$devices = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
Write-Host "Deteniendo APK de Laixi en $($devices.Count) dispositivos..." -ForegroundColor Cyan

$jobs = @()
foreach ($d in $devices) {
    $jobs += Start-Job -ScriptBlock {
        param($adb, $pkg, $d)
        # Verificar si está instalado
        $installed = & $adb -s $d shell pm list packages 2>&1 | Select-String $pkg
        if ($installed) {
            # Forzar cierre
            & $adb -s $d shell am force-stop $pkg 2>&1 | Out-Null
            "OK detenido $pkg en $d"
        } else {
            "NO instalado en $d"
        }
    } -ArgumentList $adb, $laixiPkg, $d
}

$jobs | Wait-Job -Timeout 20 | Receive-Job | ForEach-Object {
    if ($_ -match '^OK') { Write-Host $_ -ForegroundColor Green }
    else { Write-Host $_ -ForegroundColor Gray }
}
$jobs | Remove-Job -Force

Write-Host ""
Write-Host "Listo. Ahora relanza FlowAgent para que tome el MediaProjection." -ForegroundColor Cyan
