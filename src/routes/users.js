const express = require("express");
const router = express.Router();
const { pool } = require("../db/database");
const { authMiddleware, dmOnly } = require("../middleware/auth");

// GET /api/users
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role === "dm") {
      const { rows } = await pool.query(
        "SELECT id, username, email, role, avatar, creado_en FROM usuarios ORDER BY username",
      );

      return res.json(rows);
    }

    const { rows } = await pool.query(
      "SELECT id, username, email, role, avatar, creado_en FROM usuarios WHERE id=$1",
      [req.user.id],
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/users/players
router.get("/players", authMiddleware, dmOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, email, role, avatar FROM usuarios WHERE role='player' ORDER BY username",
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /api/users/:id
router.delete("/:id", authMiddleware, dmOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    }

    const result = await pool.query(
      "DELETE FROM usuarios WHERE id=$1 RETURNING id",
      [req.params.id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
