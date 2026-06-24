const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, dmOnly } = require('../middleware/auth');

// GET /api/missions?campaignId=xxx
router.get('/', authMiddleware, (req, res) => {
  const { campaignId } = req.query;
  let missions = campaignId
    ? db.get('missions').filter({ campaignId }).value()
    : db.get('missions').value();

  if (req.user.role === 'player') {
    missions = missions.filter(m =>
      m.assignedTo.includes(req.user.id) || m.status === 'available'
    );
  }

  res.json(missions);
});

// GET /api/missions/:id
router.get('/:id', authMiddleware, (req, res) => {
  const mission = db.get('missions').find({ id: req.params.id }).value();
  if (!mission) return res.status(404).json({ error: 'Misión no encontrada' });
  res.json(mission);
});

// POST /api/missions - DM only
router.post('/', authMiddleware, dmOnly, (req, res) => {
  const { campaignId, title, description, reward, difficulty } = req.body;
  if (!campaignId || !title) return res.status(400).json({ error: 'campaignId y title requeridos' });

  const mission = {
    id: `mission-${Date.now()}`,
    campaignId,
    title,
    description: description || '',
    status: 'available',
    reward: reward || '',
    difficulty: difficulty || 'medium',
    assignedTo: [],
    createdAt: new Date().toISOString()
  };

  db.get('missions').insert(mission).write();
  res.status(201).json(mission);
});

// PUT /api/missions/:id - DM only
router.put('/:id', authMiddleware, dmOnly, (req, res) => {
  const mission = db.get('missions').find({ id: req.params.id }).value();
  if (!mission) return res.status(404).json({ error: 'Misión no encontrada' });

  db.get('missions').find({ id: req.params.id })
    .assign({ ...req.body, id: req.params.id }).write();
  res.json(db.get('missions').find({ id: req.params.id }).value());
});

// DELETE /api/missions/:id - DM only
router.delete('/:id', authMiddleware, dmOnly, (req, res) => {
  db.get('missions').remove({ id: req.params.id }).write();
  res.json({ message: 'Misión eliminada' });
});

// POST /api/missions/:id/assign - DM assigns player
router.post('/:id/assign', authMiddleware, dmOnly, (req, res) => {
  const { playerId } = req.body;
  const mission = db.get('missions').find({ id: req.params.id }).value();
  if (!mission) return res.status(404).json({ error: 'Misión no encontrada' });

  const assigned = mission.assignedTo || [];
  if (!assigned.includes(playerId)) assigned.push(playerId);

  db.get('missions').find({ id: req.params.id }).assign({ assignedTo: assigned, status: 'active' }).write();
  res.json(db.get('missions').find({ id: req.params.id }).value());
});

// POST /api/missions/:id/complete - DM marks complete
router.post('/:id/complete', authMiddleware, dmOnly, (req, res) => {
  db.get('missions').find({ id: req.params.id }).assign({ status: 'completed' }).write();
  res.json(db.get('missions').find({ id: req.params.id }).value());
});

module.exports = router;
