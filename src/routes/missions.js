const express = require("express");
const router = express.Router();
const { pool } = require("../db/database");
const { authMiddleware, dmOnly } = require("../middleware/auth");

// GET /api/missions?campaignId=xxx
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.query;

    let query = `
      SELECT m.*,
             COALESCE(
               array_remove(array_agg(ma.jugador_id), NULL),
               '{}'
             ) AS assigned_to
      FROM misiones m
      LEFT JOIN mision_asignados ma ON ma.mision_id = m.id
    `;

    const params = [];

    if (campaignId) {
      query += " WHERE m.campana_id=$1";
      params.push(campaignId);
    }

    query += `
      GROUP BY m.id
      ORDER BY m.creado_en DESC
    `;

    const { rows } = await pool.query(query, params);

    let missions = rows.map((m) => ({
      id: m.id,
      campaignId: m.campana_id,
      title: m.titulo,
      description: m.descripcion,
      status: m.estado,
      reward: m.recompensa,
      difficulty: m.dificultad,
      assignedTo: m.assigned_to || [],
      createdAt: m.creado_en,
    }));

    if (req.user.role === "player") {
      missions = missions.filter(
        (m) => m.status === "available" || m.assignedTo.includes(req.user.id),
      );
    }

    res.json(missions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/missions/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT m.*,
             COALESCE(
               array_remove(array_agg(ma.jugador_id), NULL),
               '{}'
             ) AS assigned_to
      FROM misiones m
      LEFT JOIN mision_asignados ma ON ma.mision_id=m.id
      WHERE m.id=$1
      GROUP BY m.id
      `,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Misión no encontrada" });
    }

    const m = rows[0];

    res.json({
      id: m.id,
      campaignId: m.campana_id,
      title: m.titulo,
      description: m.descripcion,
      status: m.estado,
      reward: m.recompensa,
      difficulty: m.dificultad,
      assignedTo: m.assigned_to || [],
      createdAt: m.creado_en,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/missions
router.post("/", authMiddleware, dmOnly, async (req, res) => {
  try {
    const { campaignId, title, description, reward, difficulty } = req.body;

    if (!campaignId || !title) {
      return res.status(400).json({ error: "campaignId y title requeridos" });
    }

    const id = `mission-${Date.now()}`;

    const { rows } = await pool.query(
      `
      INSERT INTO misiones
      (id,campana_id,titulo,descripcion,recompensa,dificultad)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        id,
        campaignId,
        title,
        description || "",
        reward || "",
        difficulty || "medium",
      ],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/missions/:id
router.put("/:id", authMiddleware, dmOnly, async (req, res) => {
  try {
    const { title, description, reward, difficulty, status } = req.body;

    const { rows } = await pool.query(
      `
      UPDATE misiones
      SET titulo=$1,
          descripcion=$2,
          recompensa=$3,
          dificultad=$4,
          estado=$5
      WHERE id=$6
      RETURNING *
      `,
      [title, description, reward, difficulty, status, req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Misión no encontrada" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/missions/:id
router.delete("/:id", authMiddleware, dmOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM misiones WHERE id=$1 RETURNING id",
      [req.params.id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Misión no encontrada" });
    }

    res.json({ message: "Misión eliminada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/missions/:id/assign
router.post("/:id/assign", authMiddleware, dmOnly, async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "playerId requerido" });
    }

    await pool.query(
      `
      INSERT INTO mision_asignados (mision_id,jugador_id)
      VALUES ($1,$2)
      ON CONFLICT DO NOTHING
      `,
      [req.params.id, playerId],
    );

    await pool.query("UPDATE misiones SET estado='active' WHERE id=$1", [
      req.params.id,
    ]);

    res.json({ message: "Jugador asignado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/missions/:id/complete
router.post("/:id/complete", authMiddleware, dmOnly, async (req, res) => {
  try {
    await pool.query("UPDATE misiones SET estado='completed' WHERE id=$1", [
      req.params.id,
    ]);

    res.json({ message: "Misión completada" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
