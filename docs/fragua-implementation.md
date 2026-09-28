# Fragua móvil — implementación y cobertura

Esta entrega conecta la app Android con una ficha persistente y reglas compartidas. Es una implementación del núcleo y de los flujos principales del documento Fragua v0.5. **No completa todavía toda la automatización de D&D 2024 ni toda la matriz de aceptación del documento.**

## Comportamiento implementado

| Área | Comportamiento |
|---|---|
| Ficha | Seis características, competencia por nivel, seis salvaciones, dieciocho habilidades, pericia declarada, iniciativa, CA, velocidad, PV y progreso de XP |
| Clases | Doce clases básicas, niveles de multiclase, dados de golpe, progresión de espacios y Pacto separado; elección de las doce subclases incluidas en el SRD y consulta de rasgos por nivel |
| Tiradas | Dados libres, habilidad, salvación, ataque, muerte; ventaja y desventaja se cancelan; resultado persistido e idempotente |
| Vida | Absorción de daño por PV temporales, curación limitada, daño masivo, fallos de muerte a 0 PV y recordatorio de concentración |
| Descansos | Corto de una hora y gasto secuencial de dados; largo de ocho horas, recuperación de todos los dados, PV y espacios, reducciones temporales y un nivel de agotamiento; intervalo narrativo de 16 horas; interrupciones y Trance declarado |
| Magia | Preparación declarada, gasto de espacios elegibles, rituales, concentración reemplazada con confirmación, Ritual Adept del mago y Recuperación arcana después de descanso corto |
| Acciones | Armas equipadas, ataques por acción, acciones universales, conjuros preparados agrupados por tiempo y recursos declarados; los objetivos los resuelve la mesa |
| Inventario | Cantidad, equipamiento, competencia, sutil, ataque a distancia, daño, alcance, CA y notas; el equipo cambia los cálculos |
| Compañeros | Mascota, familiar, compañero de clase e invocación diferenciados, fuente, PV y presencia opcional en inicio |
| Notas | Secciones ordenadas, texto, dibujo, deshacer, rehacer, limpiar, mover notas, revisiones y borrado confirmado; listado paginado separado de los dibujos |
| Misiones | Consulta y aceptación de asignaciones por la API ya existente |
| Sin conexión | Instantáneas Room separadas por cuenta; consulta de lo previamente cargado; mutaciones de juego requieren respuesta del servidor |

La estética usa el fondo y retrato existentes, negro/verde petróleo, dorado, tipografía serif, anillo de vida y ruedas nativas con controles accesibles. El nombre abre la ficha; inventario y notas son accesos pequeños; el compañero aparece cuando está activo. La captura de `HomeScreen` en las pruebas usa una ficha de ejemplo y no representa datos de un usuario.

## Cobertura pendiente

- Automatización exhaustiva de rasgos de las doce clases y subclases, dotes, especies y trasfondos. Los textos están disponibles pero no todos sus efectos se ejecutan. Faltan, entre otros, puntos de hechicería/metamagia, transformaciones, maestrías, excepciones de CA y costes especiales.
- Aplicación contextual completa de condiciones, resistencias, inmunidades, vulnerabilidad, componentes costosos y reglas de objetivo. El usuario declara ajustes de mesa; un recordatorio no equivale a validación automática.
- Lanzamientos de orígenes distintos de clase, hechizos gratuitos por rasgo, contabilidad estricta por turno y resolución automatizada sobre otras criaturas.
- Creador completo con elecciones de trasfondo/especie/subclase, competencias legales y equipo inicial. Los datos básicos se crean y la ficha se completa explícitamente.
- Recompensas de misiones aplicadas automáticamente al personaje, subida de nivel guiada y decisión XP/hitos. No se presupone qué personaje recibe una recompensa.
- Dibujo con zoom/paneo, selección y herramientas avanzadas; recuperación del borrador de nota después de matar el proceso. Se conserva durante rotación mediante ViewModel; una nota guardada persiste en servidor.
- Favoritos configurables, avatares propios, fidelidad visual final con las imágenes de inspiración y pruebas de uso en dispositivos físicos, TalkBack y tamaños de fuente grandes.

## Contratos

Todos requieren el token de Supabase de la cuenta. La app nunca recibe credenciales privilegiadas.

- `GET /api/characters/:id/sheet`: propietario o DM de la campaña; comandos e historial solo propietario.
- `POST /api/characters/:id/commands`: `{ commandId: UUID, expectedVersion: integer, type, data }`.
- Tipos: `configure`, `hp`, `roll`, `rest`, `hitDie`, `arcaneRecovery`, `resource`, `cast`, `inventory`, `spell`, `companion`, `reductions`, `status`.
- `GET /api/characters/:id/commands`: últimos 30 resultados resumidos. `GET /:id/commands/:commandId`: respuesta confirmada para reconciliar.
- `GET /api/notebooks?page=1`: secciones y 50 títulos por página. `GET /api/notebooks/notes/:id`: contenido propio completo.
- `PUT /api/notebooks/sections/:id`: nombre y orden. Se elimina solo si está vacía.
- `PUT /api/notebooks/notes/:id`: `{expectedVersion, note:{title,sectionId,text,strokes}}`; -1 crea, 0 o más actualiza. `DELETE /notes/:id?version=n` protege frente a un borrado sobre revisión vieja.
- `GET /api/catalog/spells?q=...&page=1`: Open5e v2 filtrado estrictamente por `srd-2024`; no vuelve al catálogo 2014 ante fallos. `GET /api/catalog/species`: instantánea 2024 para el creador.

## Preparación y despliegue

1. Conservar la configuración actual de Supabase y sus variables privadas en el backend. Revisar la nueva migración `20260927030000_fragua_gameplay`.
2. Ejecutar `npm ci`, `npm run db:generate`, `npm test` y `npm run db:deploy` en el entorno de destino usando su conexión Prisma autorizada. La migración **no fue aplicada a la base remota durante esta implementación**.
3. Desplegar primero esta API, después Android. La app requiere los nuevos endpoints. Una API vieja devolverá 404; no se inventa una ficha local sustitutiva.
4. En Android Studio usar el JDK 21 configurado en el proyecto y SDK 36.1. Configurar `API_BASE_URL`: el valor debug predeterminado `http://10.0.2.2:3001/api` es para emulador con backend local. Para un teléfono se necesita una dirección accesible; release exige HTTPS y una URL configurada.
5. Ejecutar `bash gradlew assembleDebug testDebugUnitTest lintDebug`. GitHub Actions conserva APK, pruebas y captura de componente en `android-verification`.

## Verificación

El backend tiene 25 pruebas aprobadas: reglas de cálculo, descansos, recursos, Ritual Adept, Recuperación arcana, permisos, migraciones/RLS, aislamiento de notas, reintentos y dos comandos concurrentes sobre la misma versión. Se ejecutan contra PostgreSQL WASM con Prisma y Express reales; solo la identidad externa se simula.

Android tiene verificación de compilación, lint y pruebas nativas con Robolectric para rutas del inicio, áreas táctiles de las seis salvaciones y conservación de trazos. La ejecución [36408806991](https://github.com/Krayxzlim/DNDcompanion/actions/runs/36408806991) aprobó ensamblado, 3 pruebas de interfaz más la prueba unitaria existente, y lint sin errores. Persisten advertencias de estilos, textos y recursos heredados; esto no equivale a certificar accesibilidad completa. No se ha hecho una sesión de juego completa contra el Supabase de producción.

## Fuentes y licencia

Las reglas centrales se contrastaron con [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf). Las instantáneas de clases y especies proceden de [Open5e v2](https://open5e.com/api-docs), documento `srd-2024`, recuperadas el 28 de septiembre de 2026. Open5e identifica ese documento como SRD 5.2; la app conserva esa procedencia y no lo rebautiza 5.2.1. Las descripciones originales se conservan en inglés.

This work includes material from the System Reference Document 5.2 and 5.2.1 (SRD) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode. Las explicaciones breves en español y su adaptación a cálculos/interacciones son modificaciones de Fragua; no implican aprobación de Wizards of the Coast.
