Set-Location 'C:\DASHBOARD\FlowDashboard'
$python = 'C:\Users\elyup\AppData\Local\Programs\Python\Python310\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { $python = $cmd.Source }
}
& $python -u 'C:\DASHBOARD\FlowDashboard\.upload_tmp\test_raw_streamer.py'
exit $LASTEXITCODE
