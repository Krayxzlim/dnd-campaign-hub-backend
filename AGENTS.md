# Instrucciones de trabajo de Fragua

Comunicar en español. Conservar tecnologías, contratos y cambios existentes.

## Rama de trabajo acordada con el usuario — 2026-10-26

- Continuar el desarrollo y las correcciones en `testing` por defecto; mantenerla actualizada.
- Conservar `master` o `main` intacta como versión funcional original. No fusionar testing hacia ella ni cambiarla sin instrucción expresa del usuario.
- Crear otra rama solo si hay una necesidad concreta de aislamiento o el usuario lo indica; explicar el motivo y reintegrar el trabajo validado en testing.
- Las ramas anteriores se consolidaron y sus puntas se conservan en etiquetas `archive/2026-10-26/...`. No usar esas etiquetas como base rutinaria de desarrollo.
- Ejecutar las verificaciones del repositorio antes de publicar. No desplegar ni modificar la base remota por el solo hecho de publicar testing.
