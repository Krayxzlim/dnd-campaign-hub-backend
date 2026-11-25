"use strict";
const MAX_JPEG_BYTES = 4 * 1024 * 1024;
// Comprueba que la respuesta tenga inicio y cierre de una imagen JPEG.
function isJpeg(bytes) {
  return bytes.length >= 4 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}
// Configura la dirección de la cámara y el tiempo máximo de espera.
function createCamera({ url, timeoutMs = 10000, fetchFn = fetch }) {
  if (!url) throw new Error("Configurar CAMERA_URL en .env");
  const cameraUrl = new URL(url);
  if (!["http:", "https:"].includes(cameraUrl.protocol)) {
    throw new Error("CAMERA_URL debe usar http o https");
  }
  return async function capture() {
    let response;
    try {
      // Pide la foto sin usar una copia guardada en caché.
      response = await fetchFn(cameraUrl, {
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      throw new Error(`No se pudo conectar con la cámara: ${error.message}`);
    }
    if (!response.ok) {
      throw new Error(`La cámara respondió HTTP ${response.status}; revisá CAMERA_URL y /capture`);
    }
    const advertisedSize = Number(response.headers.get("content-length"));
    if (advertisedSize > MAX_JPEG_BYTES) throw new Error("La imagen supera 4 MB");
    const type = response.headers.get("content-type") || "";
    if (type && !/image\/jpeg|image\/jpg|application\/octet-stream/i.test(type)) {
      throw new Error(`La cámara respondió ${type}, no JPEG`);
    }
    // Lee la imagen por partes y corta si supera el tamaño permitido.
    const chunks = [];
    let length = 0;
    if (!response.body) throw new Error("La respuesta de la cámara no tiene imagen");
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > MAX_JPEG_BYTES) {
        await response.body.cancel().catch(() => {});
        throw new Error("La imagen supera 4 MB");
      }
      chunks.push(chunk);
    }
    const image = Buffer.concat(chunks);
    if (!isJpeg(image)) throw new Error("/capture no devolvió un JPEG completo y válido");
    return image;
  };
}
module.exports = { createCamera, isJpeg };

