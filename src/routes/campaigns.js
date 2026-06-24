const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, dmOnly } = require('../middleware/auth');

// GET /api/campaigns - list campaigns for current user
router.get('/', authMiddleware, (req, res) => {
  let campaigns;
  if (req.user.role === 'dm') {
    campaigns = db.get('campaigns').filter({ dmId: req.user.id }).value();
  } else {
    const playerCampaignIds = db.get('campaign_players')
      .filter({ playerId: req.user.id })
      .map('campaignId').value();
    campaigns = db.get('campaigns')
      .filter(c => playerCampaignIds.includes(c.id)).value();
  }

  // Enrich with player count
  campaigns = campaigns.map(c => ({
    ...c,
    playerCount: db.get('campaign_players').filter({ campaignId: c.id }).size().value(),
    missionCount: db.get('missions').filter({ campaignId: c.id }).size().value()
  }));

  res.json(campaigns);
});

// GET /api/campaigns/:id
router.get('/:id', authMiddleware, (req, res) => {
  const campaign = db.get('campaigns').find({ id: req.params.id }).value();
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

  // Check access
  if (req.user.role !== 'dm') {
    const cp = db.get('campaign_players').find({ campaignId: req.params.id, playerId: req.user.id }).value();
    if (!cp) return res.status(403).json({ error: 'No pertenecés a esta campaña' });
  }

  const players = db.get('campaign_players')
    .filter({ campaignId: req.params.id })
    .map(cp => {
      const u = db.get('users').find({ id: cp.playerId }).value();
      if (!u) return null;
      const { password, ...safe } = u;
      return safe;
    }).filter(Boolean).value();

  res.json({ ...campaign, players });
});

// POST /api/campaigns - DM only
router.post('/', authMiddleware, dmOnly, (req, res) => {
  const { name, description, image } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const campaign = {
    id: `campaign-${Date.now()}`,
    name,
    description: description || '',
    dmId: req.user.id,
    status: 'active',
    image: image || '🗺️',
    createdAt: new Date().toISOString()
  };

  db.get('campaigns').insert(campaign).write();
  res.status(201).json(campaign);
});

// PUT /api/campaigns/:id - DM only
router.put('/:id', authMiddleware, dmOnly, (req, res) => {
  const campaign = db.get('campaigns').find({ id: req.params.id, dmId: req.user.id }).value();
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

  const updated = db.get('campaigns').find({ id: req.params.id })
    .assign({ ...req.body, id: req.params.id, dmId: req.user.id }).write();
  res.json(db.get('campaigns').find({ id: req.params.id }).value());
});

// DELETE /api/campaigns/:id - DM only
router.delete('/:id', authMiddleware, dmOnly, (req, res) => {
  const campaign = db.get('campaigns').find({ id: req.params.id, dmId: req.user.id }).value();
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

  db.get('campaigns').remove({ id: req.params.id }).write();
  db.get('missions').remove({ campaignId: req.params.id }).write();
  db.get('encounters').remove({ campaignId: req.params.id }).write();
  db.get('campaign_players').remove({ campaignId: req.params.id }).write();
  res.json({ message: 'Campaña eliminada' });
});

// POST /api/campaigns/:id/players - Add player to campaign (DM only)
router.post('/:id/players', authMiddleware, dmOnly, (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'playerId requerido' });

  const campaign = db.get('campaigns').find({ id: req.params.id, dmId: req.user.id }).value();
  if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

  const player = db.get('users').find({ id: playerId, role: 'player' }).value();
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

  const exists = db.get('campaign_players').find({ campaignId: req.params.id, playerId }).value();
  if (exists) return res.status(409).json({ error: 'El jugador ya está en la campaña' });

  db.get('campaign_players').insert({ id: `cp-${Date.now()}`, campaignId: req.params.id, playerId }).write();
  res.status(201).json({ message: 'Jugador añadido' });
});

// DELETE /api/campaigns/:id/players/:playerId - Remove player (DM only)
router.delete('/:id/players/:playerId', authMiddleware, dmOnly, (req, res) => {
  db.get('campaign_players').remove({ campaignId: req.params.id, playerId: req.params.playerId }).write();
  res.json({ message: 'Jugador removido' });
});

module.exports = router;
