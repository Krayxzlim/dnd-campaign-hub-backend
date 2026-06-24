const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, dmOnly } = require('../middleware/auth');

// GET /api/encounters?campaignId=xxx
router.get('/', authMiddleware, (req, res) => {
  const { campaignId } = req.query;
  const encounters = campaignId
    ? db.get('encounters').filter({ campaignId }).value()
    : db.get('encounters').value();
  res.json(encounters);
});

// GET /api/encounters/:id
router.get('/:id', authMiddleware, (req, res) => {
  const encounter = db.get('encounters').find({ id: req.params.id }).value();
  if (!encounter) return res.status(404).json({ error: 'Encuentro no encontrado' });
  res.json(encounter);
});

// POST /api/encounters - DM only
router.post('/', authMiddleware, dmOnly, (req, res) => {
  const { campaignId, name, description, monsters } = req.body;
  if (!campaignId || !name) return res.status(400).json({ error: 'campaignId y name requeridos' });

  const encounter = {
    id: `enc-${Date.now()}`,
    campaignId,
    name,
    description: description || '',
    status: 'pending',
    monsters: (monsters || []).map(m => ({
      monsterId: m.monsterId,
      name: m.name,
      count: m.count || 1,
      maxHp: m.hp || 10,
      currentHp: Array(m.count || 1).fill(m.hp || 10),
      ac: m.ac || 10,
      attack: m.attack || '+0',
      damage: m.damage || '1d6'
    })),
    initiativeOrder: [],
    round: 0,
    createdAt: new Date().toISOString()
  };

  db.get('encounters').insert(encounter).write();
  res.status(201).json(encounter);
});

// PUT /api/encounters/:id - DM only (full update)
router.put('/:id', authMiddleware, dmOnly, (req, res) => {
  const encounter = db.get('encounters').find({ id: req.params.id }).value();
  if (!encounter) return res.status(404).json({ error: 'Encuentro no encontrado' });

  db.get('encounters').find({ id: req.params.id })
    .assign({ ...req.body, id: req.params.id }).write();
  res.json(db.get('encounters').find({ id: req.params.id }).value());
});

// POST /api/encounters/:id/start - Start combat, roll initiative
router.post('/:id/start', authMiddleware, dmOnly, (req, res) => {
  const encounter = db.get('encounters').find({ id: req.params.id }).value();
  if (!encounter) return res.status(404).json({ error: 'Encuentro no encontrado' });

  // Auto-roll initiative for each monster group
  const initiative = encounter.monsters.flatMap(m =>
    Array.from({ length: m.count }, (_, i) => ({
      id: `${m.monsterId}-${i}`,
      name: m.count > 1 ? `${m.name} ${i + 1}` : m.name,
      monsterId: m.monsterId,
      instanceIndex: i,
      initiative: Math.floor(Math.random() * 20) + 1,
      hp: m.currentHp[i],
      maxHp: m.maxHp,
      ac: m.ac,
      isPlayer: false
    }))
  ).sort((a, b) => b.initiative - a.initiative);

  db.get('encounters').find({ id: req.params.id })
    .assign({ status: 'active', initiativeOrder: initiative, round: 1 }).write();

  res.json(db.get('encounters').find({ id: req.params.id }).value());
});

// PATCH /api/encounters/:id/damage - Apply damage to a monster instance
router.patch('/:id/damage', authMiddleware, dmOnly, (req, res) => {
  const { monsterId, instanceIndex, damage } = req.body;
  const encounter = db.get('encounters').find({ id: req.params.id }).value();
  if (!encounter) return res.status(404).json({ error: 'Encuentro no encontrado' });

  const monsters = encounter.monsters.map(m => {
    if (m.monsterId === monsterId) {
      const newHp = [...m.currentHp];
      newHp[instanceIndex] = Math.max(0, newHp[instanceIndex] - damage);
      return { ...m, currentHp: newHp };
    }
    return m;
  });

  // Update initiative order HP too
  const initiativeOrder = encounter.initiativeOrder.map(entry => {
    if (entry.monsterId === monsterId && entry.instanceIndex === instanceIndex) {
      return { ...entry, hp: Math.max(0, entry.hp - damage) };
    }
    return entry;
  });

  db.get('encounters').find({ id: req.params.id })
    .assign({ monsters, initiativeOrder }).write();

  res.json(db.get('encounters').find({ id: req.params.id }).value());
});

// POST /api/encounters/:id/nextround
router.post('/:id/nextround', authMiddleware, dmOnly, (req, res) => {
  const encounter = db.get('encounters').find({ id: req.params.id }).value();
  if (!encounter) return res.status(404).json({ error: 'Encuentro no encontrado' });

  db.get('encounters').find({ id: req.params.id })
    .assign({ round: encounter.round + 1 }).write();
  res.json(db.get('encounters').find({ id: req.params.id }).value());
});

// POST /api/encounters/:id/end
router.post('/:id/end', authMiddleware, dmOnly, (req, res) => {
  db.get('encounters').find({ id: req.params.id }).assign({ status: 'completed' }).write();
  res.json(db.get('encounters').find({ id: req.params.id }).value());
});

// DELETE /api/encounters/:id
router.delete('/:id', authMiddleware, dmOnly, (req, res) => {
  db.get('encounters').remove({ id: req.params.id }).write();
  res.json({ message: 'Encuentro eliminado' });
});

module.exports = router;
