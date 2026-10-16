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

## Ampliación: beneficios de trasfondo

Las altas nuevas pueden resolver el paquete inicial o 50 po, herramientas y las dotes Alerta, Atacante salvaje e Iniciado en la magia para los cuatro trasfondos SRD disponibles. El inventario y saldo se crean una sola vez; los comandos de gasto y uso de dotes conservan versión e idempotencia. Esto amplía la cobertura de creación y procedencia, pero no completa los requisitos de especie/clase, progresión ni reconstrucción de personajes de nivel superior. Véase `background-decisions.md` para contratos, compatibilidad y límites de automatización.

## Ampliación: competencias de clase

Las doce clases SRD permiten seleccionar sus habilidades iniciales con cupo y lista validados por la API. Se conserva la procedencia y se combina por rango, sin duplicar bonos del trasfondo. RF-10 continúa parcial: faltan pericia, salvaciones, equipo, conjuros y las demás decisiones de rasgos. Esta entrega no modifica progresión ni aplica concesiones retroactivas.

## Ampliación: base de clase de nivel 1

Las altas versionadas inicializan PV base con dado máximo y Constitución final y registran salvaciones de clase. Leer no restaura recursos consumidos y las concesiones no desaparecen con configuración genérica. RF-12 sigue parcial: faltan aumentos de PV por otras fuentes, reconstrucción y progresión por nivel. Las fichas históricas no se recalculan.

## Ampliación: pericia inicial del pícaro

La creación guiada permite dos pericias entre las habilidades concedidas por clase y trasfondo y guarda su fuente. La API valida cupo, unicidad, clase y competencia previa. RF-10 continúa parcial para los demás rasgos y decisiones de clase; este bloque no implementa progresión ni concede pericias de niveles posteriores.
