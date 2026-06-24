const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, dmOnly } = require('../middleware/auth');

// GET /api/monsters
router.get('/', authMiddleware, (req, res) => {
  res.json(db.get('monsters').value());
});

// POST /api/monsters - DM only
router.post('/', authMiddleware, dmOnly, (req, res) => {
  const { name, hp, ac, cr, attack, damage, type } = req.body;
  if (!name) return res.status(400).json({ error: 'name requerido' });

  const monster = {
    id: `mon-${Date.now()}`,
    name,
    hp: hp || 10,
    ac: ac || 10,
    cr: cr || '1',
    attack: attack || '+0',
    damage: damage || '1d6',
    type: type || 'Humanoide'
  };

  db.get('monsters').insert(monster).write();
  res.status(201).json(monster);
});

// DELETE /api/monsters/:id - DM only
router.delete('/:id', authMiddleware, dmOnly, (req, res) => {
  db.get('monsters').remove({ id: req.params.id }).write();
  res.json({ message: 'Monstruo eliminado' });
});

module.exports = router;
