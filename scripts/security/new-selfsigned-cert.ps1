[CmdletBinding()]
param(
    [string]$Subject = "FlowDashboard",
    [string]$OutDir = "",
    [string]$Password = $env:FLOWDASHBOARD_CODESIGN_PASSWORD,
    [int]$ValidityYears = 3,
    [switch]$InstallRoot,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Write-Line($msg, $color) {
    if (-not $Quiet) { Write-Host $msg -ForegroundColor $color }
}

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ([string]::IsNullOrWhiteSpace($OutDir)) { $OutDir = Join-Path $RepoRoot "secrets" }
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "Defina una contrasena: parametro -Password o variable FLOWDASHBOARD_CODESIGN_PASSWORD."
}

$cn = $Subject
if ($cn -notmatch '^CN=') { $cn = "CN=$Subject" }

Write-Line "Generando certificado autofirmado de firma de codigo: $cn" "Cyan"

$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $cn `
    -KeyAlgorithm RSA `
    -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature `
    -KeyExportPolicy Exportable `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears($ValidityYears)

$thumb = $cert.Thumbprint
$pfxPath = Join-Path $OutDir "flowdashboard-codesign.pfx"
$cerPath = Join-Path $OutDir "flowdashboard-codesign.cer"
$securePwd = ConvertTo-SecureString -String $Password -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null

Write-Line "PFX (privado, NO compartir): $pfxPath" "Green"
Write-Line "CER (publico, para confiar): $cerPath" "Green"
Write-Line "Huella (thumbprint): $thumb" "DarkCyan"

if ($InstallRoot) {
    Write-Line "Instalando certificado en la raiz de confianza del usuario actual..." "Cyan"
    Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
    Write-Line "Certificado instalado en Cert:\CurrentUser\Root." "Green"
}

Write-Line "" "Gray"
Write-Line "Para firmar configure estas variables y ejecute la release:" "Yellow"
Write-Line "  setx FLOWDASHBOARD_CODESIGN_PFX `"$pfxPath`"" "Gray"
Write-Line "  setx FLOWDASHBOARD_CODESIGN_PASSWORD `"<su-contrasena>`"" "Gray"
exit 0
