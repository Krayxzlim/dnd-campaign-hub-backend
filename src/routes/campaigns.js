const express = require("express");
const router = express.Router();
const { pool } = require("../db/database");
const { authMiddleware, dmOnly } = require("../middleware/auth");
function mapCampaign(c) {
  return {
    id: c.id,
    name: c.nombre,
    description: c.descripcion,
    dmId: c.dm_id,
    status: c.estado,
    image: c.imagen,
    createdAt: c.creado_en,
    ...(c.playerCount !== undefined && { playerCount: c.playerCount }),
    ...(c.missionCount !== undefined && { missionCount: c.missionCount }),
    ...(c.players !== undefined && { players: c.players }),
  };
}

async function enriquecer(campanas) {
  return Promise.all(
    campanas.map(async (c) => {
      const [
        {
          rows: [{ count: players }],
        },
        {
          rows: [{ count: missions }],
        },
      ] = await Promise.all([
        pool.query(
          "SELECT COUNT(*) FROM campana_jugadores WHERE campana_id=$1",
          [c.id],
        ),
        pool.query("SELECT COUNT(*) FROM misiones WHERE campana_id=$1", [c.id]),
      ]);
      return mapCampaign({
        ...c,
        playerCount: +players,
        missionCount: +missions,
      });
    }),
  );
}

// GET /api/campaigns
router.get("/", authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === "dm") {
    ({ rows } = await pool.query(
      "SELECT * FROM campanas WHERE dm_id=$1 ORDER BY creado_en DESC",
      [req.user.id],
    ));
  } else {
    ({ rows } = await pool.query(
      `SELECT c.* FROM campanas c
       JOIN campana_jugadores cj ON cj.campana_id=c.id
       WHERE cj.jugador_id=$1 ORDER BY c.creado_en DESC`,
      [req.user.id],
    ));
  }
  res.json(await enriquecer(rows));
});

// GET /api/campaigns/:id
router.get("/:id", authMiddleware, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM campanas WHERE id=$1", [
    req.params.id,
  ]);
  if (!rows.length)
    return res.status(404).json({ error: "Campaña no encontrada" });

  if (req.user.role !== "dm") {
    const check = await pool.query(
      "SELECT 1 FROM campana_jugadores WHERE campana_id=$1 AND jugador_id=$2",
      [req.params.id, req.user.id],
    );
    if (!check.rows.length)
      return res.status(403).json({ error: "Sin acceso a esta campaña" });
  }

  const { rows: players } = await pool.query(
    `SELECT u.id,u.username,u.email,u.role,u.avatar FROM usuarios u
     JOIN campana_jugadores cj ON cj.jugador_id=u.id
     WHERE cj.campana_id=$1`,
    [req.params.id],
  );
  res.json(mapCampaign({ ...rows[0], players }));
});

// POST /api/campaigns
// Acepta tanto nombres en español (nombre/descripcion/imagen) como los que
// manda el frontend en inglés (name/description/image), para no depender
// de que ambos lados usen la misma convención.
router.post("/", authMiddleware, dmOnly, async (req, res) => {
  const { nombre, name, descripcion, description, imagen, image } = req.body;
  const campNombre = nombre || name;
  const campDescripcion = descripcion || description || "";
  const campImagen = imagen || image || "🗺️";

  if (!campNombre) return res.status(400).json({ error: "Nombre requerido" });

  const newId = "campaign-" + Date.now();
  const { rows } = await pool.query(
    "INSERT INTO campanas (id,nombre,descripcion,dm_id,imagen) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [newId, campNombre, campDescripcion, req.user.id, campImagen],
  );
  res.status(201).json(mapCampaign(rows[0]));
});

// PUT /api/campaigns/:id
router.put("/:id", authMiddleware, dmOnly, async (req, res) => {
  const {
    nombre,
    name,
    descripcion,
    description,
    imagen,
    image,
    estado,
    status,
  } = req.body;
  const campNombre = nombre || name;
  const campDescripcion = descripcion || description;
  const campImagen = imagen || image;
  const campEstado = estado || status;

  const { rows } = await pool.query(
    `UPDATE campanas SET nombre=$1,descripcion=$2,imagen=$3,estado=$4
     WHERE id=$5 AND dm_id=$6 RETURNING *`,
    [
      campNombre,
      campDescripcion,
      campImagen,
      campEstado,
      req.params.id,
      req.user.id,
    ],
  );
  if (!rows.length)
    return res.status(404).json({ error: "Campaña no encontrada" });
  res.json(mapCampaign(rows[0]));
});

// DELETE /api/campaigns/:id
router.delete("/:id", authMiddleware, dmOnly, async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM campanas WHERE id=$1 AND dm_id=$2",
    [req.params.id, req.user.id],
  );
  if (!rowCount)
    return res.status(404).json({ error: "Campaña no encontrada" });
  res.json({ message: "Campaña eliminada" });
});

// POST /api/campaigns/:id/players
router.post("/:id/players", authMiddleware, dmOnly, async (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: "playerId requerido" });

  const player = await pool.query(
    "SELECT id FROM usuarios WHERE id=$1 AND role='player'",
    [playerId],
  );
  if (!player.rows.length)
    return res.status(404).json({ error: "Jugador no encontrado" });

  try {
    await pool.query(
      "INSERT INTO campana_jugadores (id,campana_id,jugador_id) VALUES ('cp-'||$1,$2,$3)",
      [Date.now(), req.params.id, playerId],
    );
  } catch {
    return res.status(409).json({ error: "El jugador ya está en la campaña" });
  }

  res.status(201).json({ message: "Jugador añadido" });
});

// DELETE /api/campaigns/:id/players/:pid
router.delete("/:id/players/:pid", authMiddleware, dmOnly, async (req, res) => {
  await pool.query(
    "DELETE FROM campana_jugadores WHERE campana_id=$1 AND jugador_id=$2",
    [req.params.id, req.params.pid],
  );
  res.json({ message: "Jugador removido" });
});

module.exports = router;
