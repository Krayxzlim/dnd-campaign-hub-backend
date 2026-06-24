const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken, authMiddleware } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = db.get('users').find({ email }).value();
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const token = generateToken(user);
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const existing = db.get('users').find({ email }).value();
  if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

  const safeRole = role === 'dm' ? 'dm' : 'player';
  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    id: `user-${Date.now()}`,
    username,
    email,
    password: hashedPassword,
    role: safeRole,
    avatar: safeRole === 'dm' ? '🧙' : '⚔️',
    createdAt: new Date().toISOString()
  };

  db.get('users').insert(newUser).write();
  const token = generateToken(newUser);
  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

module.exports = router;
