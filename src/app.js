const express = require("express");
const cors = require("cors");
const { ZodError } = require("zod");
const { authMiddleware } = require("./middleware/auth");
function createApp({ db, supabase, origins = ["http://localhost:5173"] }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  const deps = { db, auth: authMiddleware(db, supabase) };
  for (const name of [
    "auth",
    "campaigns",
    "missions",
    "encounters",
    "users",
    "characters",
    "monsters",
  ]) {
    app.use(`/api/${name}`, require(`./routes/${name}`)(deps));
  }
  app.use((req, res) =>
    res.status(404).json({ error: "Endpoint no encontrado" }),
  );
  app.use((err, req, res, next) => {
    if (err instanceof ZodError)
      return res
        .status(400)
        .json({
          error: "Datos inválidos",
          details: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
    if (err.code === "P2002")
      return res.status(409).json({ error: "El registro ya existe" });
    if (err.code === "P2003")
      return res.status(400).json({ error: "Referencia inválida" });
    if (err.code === "P2025")
      return res.status(404).json({ error: "Registro no encontrado" });
    if (err.code === "P2034")
      return res
        .status(409)
        .json({ error: "Conflicto concurrente. Volvé a intentar." });
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    if (status === 500) console.error("API error:", err.code || err.name);
    res
      .status(status)
      .json({
        error: status === 500 ? "Error interno del servidor" : err.message,
      });
  });
  return app;
}
module.exports = { createApp };
