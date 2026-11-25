# Integración del lector e iniciativas — 22/11/2026

## Recorrido y responsabilidades

CameraWebServer entrega JPEG. El lector local coordina las capturas para detector, vista y análisis, conservando por separado el fotograma en vivo y la foto candidata. Ollama propone; la interfaz permite corregir. La confirmación local se vincula a una revisión para rechazar fotos obsoletas. No hay entrenamiento ni almacenamiento automático de imágenes.

En el frontend, InitiativeSetup mantiene filas nominales y fotos en memoria. readPhysicalDie detiene el automático y espera disponibilidad, luego solicita /api/read. La respuesta lleva la foto exacta y el candidato juntos. Cada fila debe confirmarse; editar nombre, tirada o modificador revoca esa confirmación. El backend compartido valida los participantes, calcula el total, comprueba el DM y persiste el JSON del encuentro. No recibe imágenes ni crea personajes.

## Alternativas consideradas

- Proxy de cámara/Ollama desde el backend remoto: descartado porque ese servidor no tiene acceso a la cámara y al modelo de la PC, y trasladaría fotos fuera del equipo.
- Lector local invocado desde el navegador, con lista explícita de orígenes: elegido. La sesión de FRAGUA no se envía al lector. Requiere que el lector se ejecute en la misma PC del navegador y probar los permisos de red local al usar un frontend HTTPS publicado.

Para la vista, se eligieron capturas sucesivas con exclusión compartida frente a un segundo stream MJPEG paralelo. Evita abrir dos consumidores permanentes sobre la ESP32-CAM; sacrifica fluidez y se pausa durante inferencias.

## Contratos

- /api/live-frame no modifica la lectura candidata.
- /api/read devuelve resultado + revisión + imageData (JPEG base64 de la misma captura).
- /api/confirm exige revisión actual y rango válido; conserva el original, marca confirmed y avanza la revisión. Estado solo en RAM.
- POST /api/encounters/:id/start admite players opcional, compatible con clientes previos. Cada jugador lleva name, roll 1–20, modifier −50..50. Sin migración: initiativeOrder ya era JSON.

## Comprobaciones

- Lector: 13 pruebas aprobadas, incluidas revisión obsoleta, corrección, foto preservada frente a vista en vivo y origen permitido/rechazado.
- Backend: 52 pruebas aprobadas en PostgreSQL WASM efímero, incluidas persistencia y relectura de iniciativas, rangos, autorización y doble inicio.
- Frontend: lint aprobado; compilación aprobada cargando vite.config.js directamente con la API de Vite porque el cargador esbuild del comando npm run build recibió acceso denegado al directorio superior en esta sesión.
- Prueba de interfaz aislada: candidato simulado 16 → corrección 6, modificador 3, total 9; el payload contiene roll 6 y modifier 3. No usó cámara ni campaña reales. Fixture reproducible en frontend/test/initiative-review.html mediante Vite, fuera del build principal.
- Informe: portada y diagramas revisados en navegador. Contiene 40 pruebas/28 aciertos como datos reportados por el autor, no resultados de esta suite.
- Captura física del 22/11: timeout desde CAMERA_URL. No se declara verificada la integración completa con hardware.

Trabajo local sobre testing; no se alteró main/master, no se desplegó ni se modificó la base remota. Material original derivado del prototipo esp32-ollama-dice-reader de Krayxzlim/Fragua.
