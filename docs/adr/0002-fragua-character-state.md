# ADR 0002 — Ficha calculada y comandos versionados

Estado: implementado para el núcleo descrito en `docs/fragua-implementation.md`.

La app Android existente usa Java, Views, Supabase Auth y Express. La web ya modifica los datos básicos del personaje. Se necesita que una tirada, un lanzamiento o un descanso produzcan el mismo resultado persistido aunque Android repita una solicitud después de perder la conexión.

Se compararon dos opciones: calcular y guardar la ficha en cada cliente, o centralizar el cálculo y las mutaciones en la API compartida. La primera facilita la edición sin conexión, pero duplica reglas y requiere resolver conflictos entre la app y la web. Se elige la segunda porque el modo autorizado sin conexión es solo consulta.

`GET /api/characters/:id/sheet` produce identidad, estado declarado y valores derivados. `POST /api/characters/:id/commands` recibe `commandId`, `expectedVersion`, `type` y `data`. La transacción Serializable comprueba propietario, identificador y hash del contenido, versión actual y regla aplicable. Persiste el estado y el resultado conjuntamente. Repetir el mismo comando devuelve el mismo resultado; usar su identificador con otro contenido o una revisión vieja devuelve 409. El historial general omite las copias completas de las fichas.

`src/game/rules.js` concentra reglas puras; las rutas realizan autenticación, validación, transacción y serialización. El catálogo de Open5e conserva su procedencia. Los textos de rasgos no se interpretan como código ni conceden automáticamente efectos. Las clases y subclases requieren elecciones explícitas. Una clase desconocida no se convierte silenciosamente en mago.

Android usa `GameRepository` para transporte y caché Room por cuenta, `GameViewModel` para la ficha, estado de carga y comandos, y Views nativas para interacción. `HomeScreen` renderiza una instantánea sin hacer llamadas de red. Los comandos pendientes se guardan antes de enviarlos y se comprueban por identificador después de una respuesta incierta. La app nunca aplica cambios de juego optimistas a la copia local. Las notas emplean revisión propia y aceptan un reintento idéntico de la revisión inmediatamente anterior.

Costes aceptados: los formularios y algunos flujos auxiliares todavía viven en MainActivity; JSON validado sustituye por ahora a DTO Java específicos. Las operaciones guardan una instantánea por comando para asegurar respuestas reproducibles, por lo que se limita el tamaño del estado. No se ha agregado una cola de sincronización de escrituras ni un motor de turnos.

La migración agrega columnas y tablas sin eliminar datos anteriores. Los clientes viejos siguen usando los campos básicos; si los modifican, se invalida la configuración de juego sin borrar inventario, conjuros o compañeros. Prisma sigue siendo la única autoridad de migraciones. Las nuevas tablas tienen RLS y no otorgan acceso directo a `anon` ni `authenticated`.
