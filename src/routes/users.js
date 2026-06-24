const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, dmOnly } = require('../middleware/auth');

// GET /api/users - DM sees all, player sees only self
router.get('/', authMiddleware, (req, res) => {
  if (req.user.role === 'dm') {
    const users = db.get('users').map(u => { const { password, ...s } = u; return s; }).value();
    res.json(users);
  } else {
    const user = db.get('users').find({ id: req.user.id }).value();
    const { password, ...safe } = user;
    res.json([safe]);
  }
});

// GET /api/users/players - All players (DM only)
router.get('/players', authMiddleware, dmOnly, (req, res) => {
  const players = db.get('users').filter({ role: 'player' })
    .map(u => { const { password, ...s } = u; return s; }).value();
  res.json(players);
});

// DELETE /api/users/:id - DM only
router.delete('/:id', authMiddleware, dmOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  db.get('users').remove({ id: req.params.id }).write();
  db.get('campaign_players').remove({ playerId: req.params.id }).write();
  res.json({ message: 'Usuario eliminado' });
});

module.exports = router;
