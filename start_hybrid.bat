@echo off
echo ========================================
echo FlowDashboard Pro - Inicio Hibrido
echo ========================================
echo.

REM Verificar .NET
echo [1/4] Verificando .NET SDK...
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] .NET SDK no encontrado
    echo Instala .NET 8.0 desde: https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)
echo [OK] .NET SDK instalado
echo.

REM Verificar Node.js
echo [2/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no encontrado
    echo Instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js instalado
echo.

REM Compilar C# si es necesario
echo [3/4] Compilando C# Core Engine...
cd FlowDashboard.Core
if not exist "bin\Debug\net8.0\FlowDashboard.Core.dll" (
    echo Compilando por primera vez...
    dotnet restore
    dotnet build
)
cd ..
echo [OK] C# Core Engine listo
echo.

REM Instalar dependencias Electron si es necesario
echo [4/4] Verificando dependencias Electron...
cd electron-app
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
)
cd ..
echo [OK] Electron listo
echo.

echo ========================================
echo Iniciando FlowDashboard Pro...
echo ========================================
echo.
echo [INFO] Servidor C#: http://localhost:5000
echo [INFO] Swagger: http://localhost:5000/swagger
echo [INFO] Electron se abrira automaticamente
echo.
echo Presiona Ctrl+C para detener
echo.

REM Iniciar Electron (que a su vez inicia C#)
cd electron-app
call npm start

pause
