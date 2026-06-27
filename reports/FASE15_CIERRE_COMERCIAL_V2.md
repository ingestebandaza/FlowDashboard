# FASE 15 - Cierre comercial V2: Pruebas y matriz de aceptacion

Fecha: 2026-06-27
Rama: commercial/v2.0.0
Version: 2.0.0 (canal stable)

## 1. Objetivo
Definir y arrancar la matriz de aceptacion comercial: cubrir instalacion, runtime, dashboard/control, licencias, actualizacion y seguridad en los entornos exigidos por el plan, y ejecutar las verificaciones automatizables.

## 2. Alcance
- Matriz de aceptacion completa (reports/FASE15_MATRIZ_ACEPTACION.md) con todos los casos del plan.
- Ejecucion de verificaciones automaticas posibles en el PC de desarrollo (E1).
- Las pruebas en VMs limpias (E2/E3), canario (E4) y dispositivos (E5-E7), sin internet (E8) y Supabase caido (E9) las ejecuta el propietario.
Sin cambios de codigo en esta fase.

## 3. Estado inicial
- FASES 0-14 cerradas. Instalador 2.0.0 presente. Gestor de release operativo. Seguridad endurecida (FASE 14).
- No existia una matriz de aceptacion formal consolidada.

## 4. Cambios realizados
- NUEVO reports/FASE15_MATRIZ_ACEPTACION.md: 9 bloques (entornos, instalacion, runtime, dashboard, licencias, actualizacion, seguridad, verificaciones automaticas, criterio de salida y condiciones de listo). Sin cambios de codigo.

## 5. Verificacion en runtime (automatizado, E1)
- release.ps1 -Action validate: preflight OK, 4 node --check + 3 py_compile OK.
- release.ps1 -Action diagnostics: documentacion OK, version 2.0.0 stable, instalador FlowDashboard-Setup-2.0.0.exe detectado.
- Diagnostico de consistencia de documentacion: superado.
- scan-secrets.ps1 (FASE 14): 1027 archivos, 2 hallazgos de bajo riesgo documentados.
- log-manager sanitize: redaccion verificada.
- get_diagnostics: index.js, log-manager.js -> 0.

## 6. Pruebas con dispositivos
Pendientes de ejecucion por el propietario (E5-E7): Grid, Focus, taps, swipes, control fisico, teclado, grabacion, Apps, Files, ADB, Inspector, OCR, FlowLogin/FlowKeyboard/FlowMail/FlowTrackName. Registradas en la matriz (DSH-01..DSH-20) con estado PEND. No se modifico el pipeline de video/touch/scrcpy.

## 7. Hallazgos y correcciones
- La validacion completa requiere entornos fisicos/virtuales no disponibles en modo de ahorro; se entrega la matriz como instrumento de ejecucion y registro.
- Acciones de seguridad pendientes heredadas de FASE 14: firma de build externa (certificado) y verificacion de RLS en Supabase; reflejadas en la matriz (SEC-04, SEC-05) y en las condiciones de listo (#8, #16).

## 8. Componentes protegidos
No se modificaron. La matriz solo observa y registra su comportamiento.

## 9. Coherencia codigo-runtime-documentacion
- La matriz referencia el contrato real de licencias (RPC validate_flowdashboard_license, schema_version 2) y el modelo de planes vigente (LEGACY_FULL + STARTER/GROWTH/ENTERPRISE draft).
- Las verificaciones automaticas confirman que codigo, build y documentacion de diagnostico estan alineados en E1.

## 10. Riesgos y mitigaciones
- Riesgo: casos PEND sin ejecutar antes de entregar. Mitigacion: criterio de salida explicito (seccion 8 de la matriz) prohibe entrega con fallo critico.
- Riesgo: firma y RLS pendientes. Mitigacion: documentado como condicion de listo bloqueante para clientes externos.

## 11. Rollback
Sin cambios de codigo: rollback no aplica. Eliminar el .md de la matriz revierte la fase.

## 12. Evidencias
- bash 326: diagnostics OK (documentacion, version, instalador).
- bash 318-321 (FASE 14): validate, sanitizacion, node --check.
- reports/FASE15_MATRIZ_ACEPTACION.md.

## 13. Configuracion y secretos
Sin cambios. Verificaciones automaticas confirman ausencia de bloqueantes nuevos.

## 14. Checklist
- [x] Matriz de aceptacion completa creada
- [x] Verificaciones automaticas (E1) ejecutadas y OK
- [x] Criterio de salida definido
- [x] Condiciones de listo mapeadas
- [ ] Pruebas E2-E9 (las ejecuta el propietario)
- [ ] Firma de build externa (certificado)
- [ ] Verificacion de RLS

## 15. Conclusion y siguiente fase
FASE 15 entregada: matriz de aceptacion lista para ejecucion y porcion automatizable verificada en verde. La validacion fisica en VMs y dispositivos queda a cargo del propietario usando la matriz. Siguiente: documentacion de handoff y guia no tecnica.
