"use strict";
const sharp = require("sharp");
const WIDTH = 64;
const HEIGHT = 48;

// Achica la foto y la pasa a gris para comparar movimiento con menos datos.
async function thumbnail(image) {
  return sharp(image, { failOn: "error", limitInputPixels:16000000 })
    .resize(WIDTH, HEIGHT, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();
}
// Calcula qué proporción de píxeles cambió entre las dos fotos.
function changedFraction(a, b, pixelDelta = 30) {
  if (!a || !b || a.length !== b.length || !a.length) {
    throw new Error("Frames de comparación incompatibles");
  }
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) >= pixelDelta) changed++;
  }
  return changed / a.length;
}
module.exports = { thumbnail, changedFraction };

