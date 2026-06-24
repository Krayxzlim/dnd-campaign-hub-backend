require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const missionRoutes = require('./routes/missions');
const encounterRoutes = require('./routes/encounters');
const monsterRoutes = require('./routes/monsters');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '⚔️ D&D Campaign Hub API running', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/encounters', encounterRoutes);
app.use('/api/monsters', monsterRoutes);
app.use('/api/users', userRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`⚔️  D&D Campaign Hub API corriendo en http://localhost:${PORT}`);
  console.log(`📖 Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;
