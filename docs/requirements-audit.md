# Auditoría del creador y la progresión

Referencia: [requerimientos.md de Fragua](https://github.com/Krayxzlim/Fragua/blob/main/requerimientos.md). Auditoría del 14 de octubre de 2026 sobre el backend `feat/fragua-character-engine`, Android `feat/guided-character-creation` y React `main`.

## Flujo actual verificado

Android abre `CrearPersonajeActivity` desde el menú real. El asistente conserva especie, clase, método y asignación de atributos, guías, identidad y revisión. Guarda mediante `POST /api/characters` y devuelve el ID a `MainActivity`. `GameViewModel` obtiene la ficha calculada por la API. Room conserva consultas por cuenta; los cambios requieren confirmación del servidor.

React/Vite administra campañas, usuarios, misiones y encuentros. No tiene un creador ni una ficha de jugador conectados. Un helper `getCharacters` no equivale a una pantalla implementada.

Express autentica con Supabase Auth. Prisma guarda los datos en el esquema PostgreSQL `app`. `Character` conserva seis atributos y nivel como columnas, además de `gameData` y `stateVersion`. Los comandos tienen ID, hash de payload y comparación de versión dentro de una transacción.

## Cobertura y faltantes

| Requisito | Estado antes de esta entrega | Próximo trabajo |
| --- | --- | --- |
| RF-01, RF-02 | Especies remotas como botones; clases y ayudas estáticas en Android. | Catálogos estructurados y panel exclusivo de la selección. Las variantes requieren decisiones persistidas. |
| RF-03 | No hay trasfondos, dotes de origen ni aumentos derivados. | Catálogo verificable, validación de opciones y persistencia de sus efectos. |
| RF-04 | Estándar, 27 puntos y 4d6 ya funcionan en Android. | Compartir definición y validación. Manual requiere política del DM. |
| RF-05, RF-06 | Controles verticales y reparto equilibrado independiente de clase. | Filas horizontales, disponibilidad por resultado y recomendación opcional desde configuración. |
| RF-07 | Se guardan atributos finales; no se conocen sus fuentes históricas. | Modelo versionado de base, trasfondo, mejoras y excepciones, sin inventar datos para personajes existentes. |
| RF-08 | Nombre, alineación y nivel 1–20. | Descripción, avatar y política de nivel inicial de campaña. |
| RF-09 | Elegir nivel cambia un número; no reconstruye elecciones. | Reproducir y validar decisiones de cada nivel antes de confirmar. |
| RF-10 | Subclases y configuración parcial; los textos de rasgos no ejecutan todos sus efectos. | Descriptores de decisiones y aplicación de efectos por clase y especie. |
| RF-11 | Catálogo SRD 2024 con búsqueda; conjuros declarados y acciones básicas. | Elegibilidad, cupos, filtros y distinción entre adquisición, preparación y concesiones. |
| RF-12 | Modificadores, competencia, habilidades, salvaciones, CA, iniciativa, velocidad, percepción, ataques y espacios tienen cálculo central. | PV por nivel y Constitución; efectos y recursos exhaustivos. Mantener efectos condicionales separados. |
| RF-13 a RF-16 | No existe asistente ni comando de subida de nivel. Hay tabla de XP. | Preview sin mutación, decisiones obligatorias, autorización XP/hitos y confirmación. |
| RF-17 | Historial técnico e idempotencia de comandos. | Historial semántico de progresión y correcciones explícitas. |
| RF-18 | No hay políticas de creación/progresión por campaña. | Configuración exclusiva del DM y separación oficial/homebrew. |
| RF-19 | Motor central real; Android lo utiliza. | Web debe consumir el mismo contrato cuando incorpore ficha y creador. |
| RF-20 | Estado de recursos y configuración en JSON; sin decisiones de progresión reconstruibles. | Modelo permanente de decisiones separado del estado consumible. |
| RF-21 | Navegación Android real y consulta sin conexión. | Conectar los nuevos asistentes; comprobar flujo real en ambos clientes. |

## Decisión de esta entrega

Primero se agrega un catálogo backend versionado de creación y una validación pura de atributos base. Las recomendaciones secundarias son consejos editoriales modificables; no son requisitos oficiales. Las reglas y los textos oficiales indican su procedencia. Los snapshots existentes contienen SRD 2024 de Open5e, no todo el Manual del Jugador.

Android consume el catálogo para los selectores, la información contextual y las recomendaciones. La edición libre de las asignaciones se conserva. La compra de puntos, el arreglo estándar y las tiradas no cambian de significado.

El endpoint de preview valida únicamente atributos base. No certifica la legalidad de un personaje completo. Esta entrega no aplica bonificaciones de trasfondo, no persiste nuevas elecciones y no implementa progresión 1–20. El contrato de alta existente sigue siendo compatible.

## Orden de las siguientes entregas

1. Persistir una decisión de creación versionada, incluidos trasfondo y fuentes de atributos. Aplicar efectos compatibles sin duplicar aumentos de 2014.
2. Añadir un registro de decisiones por nivel y un preview de progresión. Empezar por contenido verificable y declarar qué opciones están soportadas.
3. Confirmar mediante el protocolo de comandos existente. Actualizar nivel, atributos y JSON en una misma transacción; el escritor actual solo modifica JSON y versión.
4. Conectar asistentes Android y React al mismo preview, con elecciones obligatorias y resumen de cambios.
5. Agregar políticas del DM, XP/hitos y correcciones auditables. Comprobar que consultar o recalcular nunca restaure recursos consumidos.

## Verificación de cada entrega

Las pruebas de reglas deben cubrir entradas inválidas, decisiones repetidas, modificadores y ausencia de mutación. Las pruebas de API deben verificar autenticación, contrato y persistencia real con Prisma. Las pruebas Android deben recorrer la navegación utilizada y representar una pantalla móvil estrecha. Las pruebas con PGlite utilizan PostgreSQL local de prueba; no reemplazan la persistencia de producción ni modifican Supabase remoto.

La aceptación completa exige los catorce escenarios del documento original. Esta entrega solo verifica el bloque de catálogo, presentación y atributos base; no marca los demás como cumplidos.

## Incremento posterior: trasfondo y procedencia

La entrega documentada en [background-decisions.md](background-decisions.md) agrega elección y aumentos del trasfondo de nivel 1, validación al guardar y un registro permanente separado del estado consumible. Las fichas anteriores conservan sus valores y no reciben una historia inventada. RF-03 y RF-07 siguen parcialmente cubiertos: dote de origen, competencias, herramientas, equipo, mejoras por nivel y correcciones todavía requieren implementación.
