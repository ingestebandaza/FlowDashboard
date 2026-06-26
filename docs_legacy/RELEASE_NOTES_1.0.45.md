# FlowDashboard 1.0.45

## Nuevo: FlowRegister completo

Crear cuentas de Spotify de forma totalmente automatica desde el dashboard, panel `Crear Cuentas`.

- Limpieza visual del clon (cache + datos + permiso Storage) antes de cada registro.
- Apertura de Spotify, deteccion de la pantalla `Sign up free` y avance al flujo de email.
- Email y password tomados de la lista `Total` de la seccion `Crear Cuentas`.
- Fecha de nacimiento aleatoria mayor de edad (1975 - año actual menos 18).
- Genero aleatorio entre `Female` y `Male`.
- Nombre completo aleatorio realista segun genero (50 nombres masculinos, 50 femeninos, 50 apellidos hispanos).
- Boton `Create account` localizado por clase + texto, no por coordenadas fijas.

## Captcha

- Integracion con [CapSolver](https://capsolver.com) via API REST para resolver reCAPTCHA v2 cuando aparece.
- Sitekey de Spotify ya configurado: `6LeO36obAAAAALSBZrY6RYM1hcAY7RLvpDDcJLy3`.
- Si aparece challenge de imagenes (raro), la cuenta queda en `review` para completarla manualmente.
- API key se carga desde `.supabase_config.json` (clave `CAPSOLVER_API_KEY`).

## Bugs corregidos

- `agent_for_serial` devolvia conexiones zombi muertas. Ahora ordena por `last_seen` desc y devuelve la mas reciente.
- `prepare_flowlogin_payload` con `is_register=True` ya no toca el perfil del telefono. Las cuentas de Crear Cuentas son efimeras y no contaminan FlowLogin.
- Picker de fecha oscilaba infinitamente entre `09` y `10`: ahora `day_list` usa formato `01`-`09` con cero a la izquierda como Spotify lo muestra.
- Frontend ya no borra el textarea `Total` al iniciar el proceso. Las cuentas se mueven a `Validos`/`No validos` cuando llega resultado terminal.
- `loginStatusesAreTerminal` ya no termina prematuramente para dispositivos en modo creacion.
- `execute_autojs` tenia firma duplicada que rompia el compile.

## Mejoras visuales

- Paneles `Cuentas` y `Crear Cuentas` se pueden colapsar haciendo clic en su header. Estado persistente en `localStorage`.

## Endpoints nuevos

- `POST /debug/dump` con `{"serial": "..."}` -> nodos visibles en pantalla con texto, clase, bounds, clickable, editable y centro. Util para inspeccionar pantallas con `FLAG_SECURE` activo.

## Como actualizar

1. Cierra FlowDashboard si esta abierto.
2. Espera a que el dashboard detecte la actualizacion y la instale automaticamente.
3. O descarga manualmente `FlowDashboard-1.0.45.zip` desde la Release de GitHub y reemplaza el contenido en tu carpeta de instalacion.
