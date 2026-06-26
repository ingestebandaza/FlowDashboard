# Requirements Document: FlowKeyboard

## Introduction

FlowKeyboard agrega a FlowAgent un teclado Android propio para que FlowDashboard pueda escribir en campos de texto mediante `InputConnection`, sin depender de `adb input text`, portapapeles ni rutas fragiles. El objetivo es mejorar estabilidad, soporte de caracteres especiales y trazabilidad de automatizaciones `.js`, manteniendo intacto el flujo actual de FlowAgent, streaming y FlowLogin.

## Requirements

### Requirement 1: Teclado incluido en FlowAgent

**User Story:** Como operador, quiero que FlowKeyboard venga dentro del APK FlowAgent, para no instalar otro APK ni mantener paquetes separados.

#### Acceptance Criteria

1. THE APK SHALL declarar `FlowKeyboardService` como `InputMethodService` dentro del paquete `com.flowlogin.agent`.
2. THE APK SHALL seguir instalando FlowAgent con el mismo flujo existente.
3. THE APK SHALL NOT activar FlowKeyboard automaticamente al abrir Electron.
4. THE APK SHALL expose metadata del IME para que Android lo liste como teclado disponible.

### Requirement 2: Activacion explicita y verificable

**User Story:** Como operador, quiero preparar FlowKeyboard solo cuando lo decida, para evitar cambios inesperados en los telefonos.

#### Acceptance Criteria

1. THE dashboard/backend SHALL expose una accion explicita para preparar FlowKeyboard.
2. THE backend SHALL verificar si FlowKeyboard esta disponible, habilitado y seleccionado como `default_input_method`.
3. THE backend SHALL NOT reinstalar FlowAgent si el APK ya esta instalado y FlowKeyboard ya esta listo.
4. THE backend SHALL return estado por dispositivo: `installed`, `enabled`, `selected`, `imeId`.

### Requirement 3: Escritura controlada por socket

**User Story:** Como desarrollador, quiero que los scripts `.js` envien texto a FlowKeyboard via FlowAgent, para que escribir sea mas robusto.

#### Acceptance Criteria

1. THE socket command SHALL support `keyboard_status`, `keyboard_type`, `keyboard_clear`, `keyboard_backspace`, `keyboard_enter`, `keyboard_next`, `keyboard_done`.
2. THE keyboard SHALL write only when FlowKeyboard is the active input method and has an active `InputConnection`.
3. THE keyboard SHALL return structured errors when inactive, unfocused, or missing input connection.
4. THE keyboard SHALL mask sensitive values in logs and status responses.

### Requirement 4: Diseño visual PRO

**User Story:** Como operador, quiero que FlowKeyboard tenga una UI limpia, compacta y profesional cuando sea visible.

#### Acceptance Criteria

1. THE keyboard SHALL use a dark FlowDashboard-compatible palette.
2. THE keyboard SHALL show compact controls for Backspace, Space, Enter/Done and status.
3. THE keyboard SHALL NOT include emojis.
4. THE keyboard SHALL remain usable on Android 9 Samsung S8/S8+ screens.

### Requirement 5: No romper flujos actuales

**User Story:** Como operador, quiero que FlowKeyboard no afecte FlowAgent ni FlowLogin hasta que se active explicitamente.

#### Acceptance Criteria

1. THE existing accessibility, socket, streaming and FlowLogin behavior SHALL remain compatible.
2. IF FlowKeyboard is not selected, FlowLogin SHALL fail/skip text-entry-by-keyboard paths explicitly, not silently.
3. Existing `/agent/command` commands SHALL remain backward compatible.
4. No secrets from account payloads SHALL be copied into documentation.
