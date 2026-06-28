const express = require("express");
const router = express.Router();
const { pool } = require("../db/database");
const { authMiddleware, dmOnly } = require("../middleware/auth");

// Traduce una fila cruda de Postgres (columnas en español) al formato
// que espera el frontend (camelCase en inglés). Se usa en TODAS las
// rutas que devuelven un encuentro, para que el shape de la respuesta
// sea siempre el mismo sin importar el endpoint que la generó.
function mapEncounter(e) {
  return {
    id: e.id,
    campaignId: e.campana_id,
    name: e.nombre,
    description: e.descripcion,
    status: e.estado,
    monsters: e.monstruos || [],
    initiativeOrder: e.orden_iniciativa || [],
    round: e.ronda,
    xpTotal: e.xp_total,
    estimatedDifficulty: e.dificultad_est,
    createdAt: e.creado_en,
  };
}

// GET /api/encounters?campaignId=xxx
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.query;

    let query = "SELECT * FROM encuentros";
    const params = [];

    if (campaignId) {
      query += " WHERE campana_id=$1";
      params.push(campaignId);
    }

    query += " ORDER BY creado_en DESC";

    const { rows } = await pool.query(query, params);

    res.json(rows.map(mapEncounter));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/encounters/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM encuentros WHERE id=$1", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Encuentro no encontrado" });
    }

    res.json(mapEncounter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/encounters
router.post("/", authMiddleware, dmOnly, async (req, res) => {
  try {
    const {
      campaignId,
      name,
      description,
      monsters,
      xpTotal,
      estimatedDifficulty,
    } = req.body;

    if (!campaignId || !name) {
      return res.status(400).json({ error: "campaignId y name requeridos" });
    }

    const id = `enc-${Date.now()}`;

    const { rows } = await pool.query(
      `INSERT INTO encuentros
      (id,campana_id,nombre,descripcion,monstruos,xp_total,dificultad_est)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        id,
        campaignId,
        name,
        description || "",
        JSON.stringify(monsters || []),
        xpTotal || 0,
        estimatedDifficulty || "",
      ],
    );

    res.status(201).json(mapEncounter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/encounters/:id
router.put("/:id", authMiddleware, dmOnly, async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      monsters,
      initiativeOrder,
      round,
      xpTotal,
      estimatedDifficulty,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE encuentros
      SET nombre=$1,
          descripcion=$2,
          estado=$3,
          monstruos=$4,
          orden_iniciativa=$5,
          ronda=$6,
          xp_total=$7,
          dificultad_est=$8
      WHERE id=$9
      RETURNING *`,
      [
        name,
        description,
        status,
        JSON.stringify(monsters || []),
        JSON.stringify(initiativeOrder || []),
        round,
        xpTotal,
        estimatedDifficulty,
        req.params.id,
      ],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Encuentro no encontrado" });
    }

    res.json(mapEncounter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/encounters/:id/start
router.post("/:id/start", authMiddleware, dmOnly, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM encuentros WHERE id=$1", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Encuentro no encontrado" });
    }

    const encounter = rows[0];

    const initiative = encounter.monstruos
      .flatMap((m) =>
        Array.from({ length: m.cantidad }, (_, i) => ({
          id: `${m.slug}-${i}`,
          name: m.cantidad > 1 ? `${m.nombre} ${i + 1}` : m.nombre,
          monsterId: m.slug,
          instanceIndex: i,
          initiative: Math.floor(Math.random() * 20) + 1,
          hp: m.hp_actual[i],
          maxHp: m.hp_max,
          ac: m.ca,
          isPlayer: false,
        })),
      )
      .sort((a, b) => b.initiative - a.initiative);

    await pool.query(
      `UPDATE encuentros
      SET estado='active',
          orden_iniciativa=$1,
          ronda=1
      WHERE id=$2`,
      [JSON.stringify(initiative), req.params.id],
    );

    const updated = await pool.query("SELECT * FROM encuentros WHERE id=$1", [
      req.params.id,
    ]);

    res.json(mapEncounter(updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PATCH /api/encounters/:id/damage
router.patch("/:id/damage", authMiddleware, dmOnly, async (req, res) => {
  try {
    const { monsters, initiativeOrder } = req.body;

    await pool.query(
      `UPDATE encuentros
      SET monstruos=$1,
          orden_iniciativa=$2
      WHERE id=$3`,
      [
        JSON.stringify(monsters),
        JSON.stringify(initiativeOrder),
        req.params.id,
      ],
    );

    const { rows } = await pool.query("SELECT * FROM encuentros WHERE id=$1", [
      req.params.id,
    ]);

    res.json(mapEncounter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/encounters/:id/nextround
router.post("/:id/nextround", authMiddleware, dmOnly, async (req, res) => {
  try {
    await pool.query("UPDATE encuentros SET ronda=ronda+1 WHERE id=$1", [
      req.params.id,
    ]);

    const { rows } = await pool.query("SELECT * FROM encuentros WHERE id=$1", [
      req.params.id,
    ]);

    res.json(mapEncounter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/encounters/:id/end
router.post("/:id/end", authMiddleware, dmOnly, async (req, res) => {
  try {
    await pool.query("UPDATE encuentros SET estado='completed' WHERE id=$1", [
      req.params.id,
    ]);

    const { rows } = await pool.query("SELECT * FROM encuentros WHERE id=$1", [
      req.params.id,
    ]);

    res.json(mapEncounter(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/encounters/:id
router.delete("/:id", authMiddleware, dmOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM encuentros WHERE id=$1 RETURNING id",
      [req.params.id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Encuentro no encontrado" });
    }

    res.json({ message: "Encuentro eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
