# Lector físico de dados · FRAGUA

La versión vigente está en `tools/lector-dados` del repositorio backend (rama testing). El código anterior en el espejo del proyecto IoT queda como antecedente; no ejecutar ambas copias a la vez.

## Inicio local

Requisitos: Node.js 22, Ollama en esta PC y `gemma3:4b` descargado.

1. En esta carpeta ejecutar `npm ci`.
2. Copiar `.env.example` a `.env` si no existe. Configurar `CAMERA_URL` con la IP actual de la ESP32-CAM.
3. Ejecutar `node setup-model.js` para crear `fragua-dados` si no está instalado.
4. Ejecutar `INICIAR.cmd` y abrir http://127.0.0.1:3000.

La PC actual ya tiene el perfil. El modelo está configurado mediante instrucciones; NO se entrenaron sus pesos. Los pesos no se versionan en Git.

## Cámara y revisión

- «Ver cámara en vivo» muestra capturas sucesivas, sin guardar video. No es un stream de alta velocidad. Durante inferencia se reutiliza el último fotograma.
- «Ver foto» y «Analizar dado» detienen el automático y esperan que se libere la cámara. Funcionan aunque la detección haya fallado.
- La vista en vivo no reemplaza la foto del candidato. Corregir tipo/valor y confirmar actualiza la lectura en memoria, conservando el resultado original.
- Una foto nueva invalida la confirmación anterior. No se guarda un dataset automáticamente.
- La iniciativa de FRAGUA admite un d20 revisado; el lector general también admite candidatos d4/d6/d8/d10/d12. Dados de decenas porcentuales no admitidos.
- La confianza del modelo no está calibrada. Transparencia, reflejos, caligrafías y caras laterales pueden producir respuestas erróneas incluso con confianza alta.

## Integración con encuentros

El frontend ofrece preparación de iniciativas al iniciar un encuentro pendiente, después de seleccionar y guardar los monstruos. El DM agrega nombres, d20 y modificador, lee opcionalmente una foto y confirma cada fila. La suma se calcula de nuevo en el backend y se persiste en `initiativeOrder`, junto a los monstruos. No se crean fichas de personaje ni se alteran sus PV.

El navegador consulta directamente al lector de esta PC: no se envían imágenes ni tokens de FRAGUA al backend compartido. `VITE_DICE_READER_URL` permite cambiar la dirección local. `FRAGUA_ORIGINS` en `.env` admite exclusivamente los orígenes web indicados, separados por comas. Por defecto se habilitan localhost y 127.0.0.1 en puertos 5173 y 4173. Para un frontend publicado, agregar su origen HTTPS exacto y reiniciar el lector. No usar comodines. Los permisos de acceso a red local y restricciones de HTTP/HTTPS del navegador requieren validación en el navegador de destino.

## API local

- GET `/api/health`: salud del proceso, no verifica cámara/modelo.
- GET `/api/state`: candidato, revisión, estado automático y captura en curso.
- GET `/api/live-frame`: fotograma para vista en vivo, no cambia la revisión analizada.
- GET `/api/capture`: captura foto; rechaza si el detector está activo.
- POST `/api/read`: captura y analiza; devuelve `imageData` con la misma foto analizada, candidato y revisión.
- POST `/api/read-image`: JPEG/PNG binario, máximo 4 MiB y 16 MP; reducción a 1024 por lado.
- GET `/api/last-image`: última fotografía revisada.
- POST `/api/confirm`: JSON `{revision,dado,valor}`; valida rango y revisión, responde 409 si cambió o está ocupado. No equivale a registro persistente en una campaña.
- POST `/api/auto/calibrate`, `/api/auto/start`, `/api/auto/stop`: control del detector.

El detector usa cambios de miniaturas, no un detector entrenado de objetos. La configuración local parte de 1 % para presencia y 0,8 % para mesa vacía, dos fotogramas de presencia y cuatro de vacío. Recalibrar después de cambiar luz, encuadre o exposición.

## Validación y evidencia

`npm test` ejecuta pruebas locales con dobles de cámara/modelo. `node smoke-local.js` consulta realmente Ollama con una imagen gris sintética: no mide precisión física y reemplaza la última imagen.

El autor reportó 40 ensayos, 28 correctos (70 %) y 12 no satisfactorios. No hay desglose individual. No atribuir esa cifra a las pruebas automatizadas ni a la integración nueva. El informe actualizado se encuentra en `public/informe-iot.html` del repositorio frontend e incluye un apartado para incorporar fotografías reales del montaje.

Pendientes: validación de extremo a extremo con la cámara y una campaña, navegador HTTPS publicado, dataset etiquetado y actuador físico demostrado. Las imágenes de revisión solo viven en RAM. No se desplegó ni migró ninguna base de datos.
