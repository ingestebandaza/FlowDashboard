# FASE 15 - Matriz de aceptacion FlowDashboard 2.0.0

Fecha: 2026-06-27
Rama: commercial/v2.0.0
Version: 2.0.0 (canal stable)

Leyenda Estado: PEND (pendiente) / OK / FALLO / N/A.
Severidad: CRIT (critico, bloquea entrega) / MAY (mayor) / MEN (menor).
Las pruebas marcadas [AUTO] las verifica la IA; el resto las ejecuta el propietario en los entornos indicados.

## Entornos de referencia
| ID | Entorno | Estado |
|----|---------|--------|
| E1 | PC de desarrollo | OK |
| E2 | VM Windows 10 x64 limpia | PEND |
| E3 | VM Windows 11 x64 limpia | PEND |
| E4 | PC canario real | PEND |
| E5 | Dispositivo USB | PEND |
| E6 | Varios dispositivos Wi-Fi | PEND |
| E7 | Dispositivo unauthorized | PEND |
| E8 | Sin Internet | PEND |
| E9 | Supabase no disponible | PEND |

## 1. Instalacion (CRIT)
| ID | Caso | Resultado esperado | Entorno | Estado |
|----|------|--------------------|---------|--------|
| INS-01 | Instalacion limpia con un unico EXE | Instala sin dependencias externas | E2/E3 | PEND |
| INS-02 | Reinstalacion sobre version existente | Conserva configuracion | E2/E3 | PEND |
| INS-03 | Reparacion | Restaura archivos sin perder datos | E2/E3 | PEND |
| INS-04 | Actualizacion 2.0.0 -> 2.0.1 | Migra y conserva datos | E2/E3 | PEND |
| INS-05 | Desinstalacion | Elimina binarios, ofrece conservar datos | E2/E3 | PEND |
| INS-06 | Conservar datos al desinstalar | dataRoot intacto | E2/E3 | PEND |
| INS-07 | Borrado opcional de datos | Elimina dataRoot bajo confirmacion | E2/E3 | PEND |
| INS-08 | Rutas con espacios | Funciona en "C:\Archivos de programa\..." | E2/E3 | PEND |
| INS-09 | Usuario sin admin | Instala por usuario o pide elevacion correcta | E2/E3 | PEND |

## 2. Runtime / sidecars (CRIT)
| ID | Caso | Resultado esperado | Entorno | Estado |
|----|------|--------------------|---------|--------|
| RUN-01 | Sin Python en el sistema | Backend Python embebido arranca | E2/E3 | PEND |
| RUN-02 | Sin .NET en el sistema | Backend C# embebido arranca | E2/E3 | PEND |
| RUN-03 | Sin Node en el sistema | Electron embebido arranca | E2/E3 | PEND |
| RUN-04 | ADB incluido | adb interno operativo | E2/E3 | PEND |
| RUN-05 | scrcpy incluido | scrcpy interno operativo | E2/E3 | PEND |
| RUN-06 | Health de servicios | RuntimeManager reporta listo | E1/E2 | PEND |
| RUN-07 | Shutdown ordenado | Detiene todos los sidecars | E1/E2 | PEND |
| RUN-08 | Reinicio | Recupera estado | E1/E2 | PEND |
| RUN-09 | Crash recovery | Relanza sidecar caido | E1/E2 | PEND |
| RUN-10 | Puerto ocupado | Detecta y reporta o reasigna | E1/E2 | PEND |

## 3. Dashboard / control (CRIT control)
| ID | Caso | Resultado esperado | Entorno | Estado |
|----|------|--------------------|---------|--------|
| DSH-01 | Grid | Renderiza N dispositivos | E5/E6 | PEND |
| DSH-02 | Focus | Vista enfocada estable | E5/E6 | PEND |
| DSH-03 | Reconexion | Recupera tras caida | E6 | PEND |
| DSH-04 | Pantalla negra | Recupera stream | E6 | PEND |
| DSH-05 | Reinicio de dispositivos | Reaparecen sin reiniciar app | E6 | PEND |
| DSH-06 | Estabilidad de posiciones | No se reordenan al reconectar | E6 | PEND |
| DSH-07 | Taps | Precision correcta | E5/E6 | PEND |
| DSH-08 | Swipes | Trayectoria correcta | E5/E6 | PEND |
| DSH-09 | Control fisico (Back/Home/Recents) | Responde | E5/E6 | PEND |
| DSH-10 | Teclado | Entrada de texto correcta | E5/E6 | PEND |
| DSH-11 | Grabacion | Genera archivo valido | E5/E6 | PEND |
| DSH-12 | Apps | Lista/lanza apps | E5/E6 | PEND |
| DSH-13 | Files | Explora/transfiere | E5/E6 | PEND |
| DSH-14 | ADB | Comandos correctos | E5/E6 | PEND |
| DSH-15 | Inspector | Inspeccion de jerarquia | E5/E6 | PEND |
| DSH-16 | OCR bajo seleccion | Texto reconocido | E5/E6 | PEND |
| DSH-17 | FlowLogin | Operativo | E5/E6 | PEND |
| DSH-18 | FlowKeyboard | Operativo | E5/E6 | PEND |
| DSH-19 | FlowMail | Operativo | E5/E6 | PEND |
| DSH-20 | FlowTrackName | Operativo | E5/E6 | PEND |

## 4. Licencias (CRIT)
| ID | Caso | Resultado esperado | Entorno | Estado |
|----|------|--------------------|---------|--------|
| LIC-01 | Licencia valida | Acceso concedido | E1/E8 | PEND |
| LIC-02 | Email incorrecto | reason_code correcto, sin acceso | E1 | PEND |
| LIC-03 | Clave incorrecta | reason_code correcto, sin acceso | E1 | PEND |
| LIC-04 | Estado pendiente | Bloqueo informativo | E1 | PEND |
| LIC-05 | Suspendida | Bloqueo | E1 | PEND |
| LIC-06 | Revocada | Bloqueo | E1 | PEND |
| LIC-07 | Vencida | Bloqueo sin borrar datos | E1 | PEND |
| LIC-08 | Gracia 48h | Acceso durante gracia | E1 | PEND |
| LIC-09 | Offline 72h | Acceso offline con cache firmada | E8 | PEND |
| LIC-10 | Reloj cambiado | Detecta manipulacion temporal | E8 | PEND |
| LIC-11 | Limite de PCs | Bloquea alta excedente | E1 | PEND |
| LIC-12 | Desvinculacion | Libera dispositivo | E1 | PEND |
| LIC-13 | Bloqueo | Aplica politica | E1 | PEND |
| LIC-14 | Plan legacy | LEGACY_FULL concede todo | E1 | PEND |
| LIC-15 | Cambio de plan | Aplica nuevos limites | E1 | PEND |
| LIC-16 | Override | license_overrides respetado | E1 | PEND |
| LIC-17 | Supabase no disponible | Fail-open/cache segun reglas | E9 | PEND |

## 5. Actualizacion (CRIT)
| ID | Caso | Resultado esperado | Entorno | Estado |
|----|------|--------------------|---------|--------|
| UPD-01 | stable N -> N+1 | Actualiza y conserva datos | E2/E3 | PEND |
| UPD-02 | Beta | Canal beta actualiza | E2/E3 | PEND |
| UPD-03 | Descarga interrumpida | Reintenta sin corromper | E2/E3 | PEND |
| UPD-04 | Hash/firma incorrecta | Rechaza el paquete | E2/E3 | PEND |
| UPD-05 | Release draft | No se ofrece a clientes | E1 | PEND |
| UPD-06 | Release publicada | Se ofrece | E2/E3 | PEND |
| UPD-07 | "Mas tarde" | Pospone | E2/E3 | PEND |
| UPD-08 | "Reiniciar ahora" | Aplica e inicia | E2/E3 | PEND |
| UPD-09 | Operacion critica activa | No interrumpe | E2/E3 | PEND |
| UPD-10 | Actualizacion con licencia vencida | Comportamiento definido | E2/E3 | PEND |
| UPD-11 | Datos preservados | dataRoot intacto | E2/E3 | PEND |
| UPD-12 | Rollback documentado | Procedimiento reproducible | E1 | PEND |

## 6. Seguridad / secretos (CRIT)
| ID | Caso | Resultado esperado | Estado |
|----|------|--------------------|--------|
| SEC-01 [AUTO] | Escaner de secretos sobre repo rastreado | Sin bloqueantes nuevos no documentados | OK (2 hallazgos bajo riesgo documentados) |
| SEC-02 [AUTO] | Escaner sobre release_packages antes de publicar | Sin secretos en el paquete | PEND (al empaquetar) |
| SEC-03 | No se distribuyen .supabase_config.json/.supabase_db_url/mail_config.json | Ausentes del instalador | PEND |
| SEC-04 | RLS protege Supabase | Tablas con RLS activo | PEND |
| SEC-05 | Build externa firmada antes del primer cliente | signtool + verify OK | PEND (requiere certificado) |
| SEC-06 [AUTO] | Sanitizacion de logs | JWT/tokens/passwords redactados | OK |

## 7. Verificaciones automaticas ejecutadas (E1)
| ID | Caso | Resultado |
|----|------|-----------|
| AUT-01 | release.ps1 -Action validate (preflight + tests estaticos) | OK |
| AUT-02 | release.ps1 -Action diagnostics | OK |
| AUT-03 | Diagnostico de consistencia de documentacion | OK |
| AUT-04 | node --check (index.js, preload.js, entitlements-cache.js, app.js, log-manager.js) | OK |
| AUT-05 | py_compile (local_adb_server.py, entitlements.py, app_meta.py) | OK |
| AUT-06 | get_diagnostics (index.js, log-manager.js, entitlements-cache.js, preload.js) | 0 |
| AUT-07 | Instalador 2.0.0 presente en release_packages | OK |

## 8. Criterio de salida (no entregar con fallo critico)
| Area | Estado |
|------|--------|
| Instalacion | PEND (E2/E3) |
| Arranque | PEND (E2/E3) |
| Licencia | PEND |
| Actualizacion | PEND |
| Grid/Focus | PEND (E5/E6) |
| Control | PEND (E5/E6) |
| Preservacion de datos | PEND |
| Secretos | OK (escaner+sanitizacion); pendiente firma externa y RLS |

## 9. Condiciones de "listo" (seccion 22 del plan)
| # | Condicion | Estado |
|---|-----------|--------|
| 1 | Win10/11 limpio instala con un EXE | PEND |
| 2 | Sin Python/.NET/Node/Java/ADB/scrcpy externos | PEND (verificar en VM) |
| 3 | Electron inicia/detiene sidecars | OK (E1) / PEND (VM) |
| 4 | Grid/Focus/control conservan funcionamiento | PEND (dispositivos) |
| 5 | Datos fuera de la instalacion | OK (PathResolver dataRoot) |
| 6 | Actualizacion 2.0.0 -> 2.0.1 | PEND |
| 7 | No se distribuyen secretos | OK (escaner) / PEND (paquete) |
| 8 | RLS protege Supabase | PEND |
| 9 | Licencia online/offline | PEND |
| 10 | Bloqueo por vencimiento no borra datos | PEND |
| 11 | Panel admin no en el cliente | OK (standalone) |
| 12 | Release desde un unico gestor | OK (GESTOR_FLOWDASHBOARD.bat) |
| 13 | Existe rollback | OK (restore_points + release.ps1 -Action restore) |
| 14 | Documentacion actualizada | EN CURSO (fase docs) |
| 15 | Legacy separado y etiquetado | OK (FASE 1) |
| 16 | Build externa firmada antes del primer cliente | PEND (certificado) |
