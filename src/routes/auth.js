const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../db/database");
const { generateToken, authMiddleware } = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM usuarios WHERE email=$1", [
      email,
    ]);

    if (!rows.length) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const user = rows[0];

    const valid = bcrypt.compareSync(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = generateToken(user);

    const { password: _, ...safeUser } = user;

    res.json({
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Todos los campos son requeridos" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM usuarios WHERE email=$1",
      [email],
    );

    if (existing.rows.length) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const safeRole = role === "dm" ? "dm" : "player";

    const hashedPassword = bcrypt.hashSync(password, 10);

    const id = `user-${Date.now()}`;

    const { rows } = await pool.query(
      `INSERT INTO usuarios
      (id, username, email, password, role, avatar)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        id,
        username,
        email,
        hashedPassword,
        safeRole,
        safeRole === "dm" ? "🧙" : "⚔️",
      ],
    );

    const token = generateToken(rows[0]);

    const { password: _, ...safeUser } = rows[0];

    res.status(201).json({
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM usuarios WHERE id=$1", [
      req.user.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const { password: _, ...safeUser } = rows[0];

    res.json(safeUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;
