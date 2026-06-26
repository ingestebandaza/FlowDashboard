# FlowDashboard 1.0.46

## Reordenar dispositivos

- Arrastrar y soltar dispositivos **entre ellos**, dentro de la misma categoria o entre categorias diferentes. Aparece una linea azul-verde indicando si el drop es antes o despues del dispositivo de destino.
- El orden personalizado se guarda automaticamente en `device_groups.json` (campo `order`) y se mantiene aunque el dispositivo se desconecte y reconecte.
- Cada tarjeta de dispositivo muestra ahora un **numerito visual** arriba a la izquierda al lado del nombre, con la posicion global (1, 2, 3, ...).
- Nuevo boton de **Reordenar** en la barra de herramientas (grupo `Vista`, junto a Crear categoria) que renumera los dispositivos respetando primero las categorias y luego el orden actual.

## Como actualizar

Abre FlowDashboard. El updater detecta la nueva version y la instala automaticamente.
