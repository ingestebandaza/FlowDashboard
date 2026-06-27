# Firma de codigo autofirmada (gratis) - FlowDashboard

Esta guia explica como firmar el instalador y los ejecutables de FlowDashboard
con un certificado autofirmado, sin coste. Es la opcion gratuita.

## Que resuelve y que NO resuelve

- Elimina el aviso "editor desconocido" SOLO en los equipos donde el certificado
  publico (.cer) este instalado como raiz de confianza.
- En equipos donde NO se instale ese certificado, Windows seguira mostrando
  advertencia (y SmartScreen seguira marcando el archivo). Por eso esta opcion
  es adecuada para: uso interno, equipos propios o clientes que aceptan instalar
  tu certificado raiz.
- Para distribucion publica sin avisos se necesita un certificado de una
  Autoridad de Certificacion (ej. Azure Trusted Signing, ~9,99 USD/mes). Eso es
  de pago y no se cubre aqui.

## Archivos involucrados

- `scripts/security/new-selfsigned-cert.ps1` - genera el certificado.
- `scripts/security/sign-artifacts.ps1` - firma los artefactos con ese
  certificado (ya integrado en `scripts/release/release.ps1`).
- `secrets/` - carpeta de salida (excluida de git). Contiene el `.pfx` privado.

## Paso 1: generar el certificado

Desde la carpeta del proyecto, en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\security\new-selfsigned-cert.ps1" -Subject "FlowDashboard" -Password "TU_CONTRASENA" -InstallRoot
```

Parametros:
- `-Subject` nombre que se mostrara como editor (por defecto FlowDashboard).
- `-Password` contrasena que protege el archivo .pfx (elija una propia).
- `-ValidityYears` anos de validez (por defecto 3).
- `-InstallRoot` instala el certificado como raiz de confianza del usuario
  actual (recomendado en su PC para que la firma se verifique sin avisos).
- `-OutDir` carpeta de salida (por defecto `secrets`).

Genera:
- `secrets\flowdashboard-codesign.pfx` - PRIVADO. No compartir ni subir a git.
- `secrets\flowdashboard-codesign.cer` - PUBLICO. Este es el que se instala en
  otros equipos para que confien en la firma.

## Paso 2: configurar las variables de entorno

```powershell
setx FLOWDASHBOARD_CODESIGN_PFX "C:\DASHBOARD\FlowDashboard\secrets\flowdashboard-codesign.pfx"
setx FLOWDASHBOARD_CODESIGN_PASSWORD "TU_CONTRASENA"
```

Cierre y vuelva a abrir la terminal para que las variables tomen efecto.

## Paso 3: firmar al crear la release

Con las variables configuradas, el pipeline de release firma automaticamente.
Cree la version desde `GESTOR_FLOWDASHBOARD.bat` (opcion 3 local, 4 beta o 5
stable). El paso de firma usa `sign-artifacts.ps1`.

Para firmar un ejecutable suelto manualmente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\security\sign-artifacts.ps1" -InstallerPath "ruta\al\FlowDashboard-Setup-2.0.0.exe"
```

## Paso 4: confiar en el certificado en OTROS equipos

En cada equipo donde quiera evitar el aviso de editor desconocido, copie
`flowdashboard-codesign.cer` y ejecute (como administrador para todos los
usuarios):

```powershell
Import-Certificate -FilePath "flowdashboard-codesign.cer" -CertStoreLocation "Cert:\LocalMachine\Root"
```

O, solo para el usuario actual:

```powershell
Import-Certificate -FilePath "flowdashboard-codesign.cer" -CertStoreLocation "Cert:\CurrentUser\Root"
```

## Seguridad

- El archivo `.pfx` contiene la clave privada: NUNCA se sube a git (la carpeta
  `secrets/` y los `*.pfx`/`*.cer` estan en `.gitignore`).
- El escaner `scripts/security/scan-secrets.ps1` bloquea la inclusion de
  certificados privados en el repositorio.
- Si la contrasena del .pfx se filtra, regenere el certificado.

## Renovacion

El certificado caduca segun `-ValidityYears`. La firma de archivos ya firmados
sigue siendo valida gracias al sello de tiempo (timestamp). Para nuevas firmas
tras el vencimiento, regenere el certificado (Paso 1) y vuelva a distribuir el
nuevo `.cer`.
