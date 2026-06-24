const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const lodashId = require('lodash-id');
const path = require('path');
const bcrypt = require('bcryptjs');

const adapter = new FileSync(path.join(__dirname, '../../db.json'));
const db = low(adapter);

db._.mixin(lodashId);

// Default DB structure
db.defaults({
  users: [],
  campaigns: [],
  missions: [],
  encounters: [],
  monsters: [],
  campaign_players: []
}).write();

// Seed initial data if empty
function seedIfEmpty() {
  if (db.get('users').size().value() === 0) {
    const dmPassword = bcrypt.hashSync('dm123456', 10);
    const playerPassword = bcrypt.hashSync('player123', 10);

    db.get('users').insert({
      id: 'user-dm-1',
      username: 'dungeon_master',
      email: 'dm@dndcompanion.com',
      password: dmPassword,
      role: 'dm',
      avatar: '🧙',
      createdAt: new Date().toISOString()
    }).write();

    db.get('users').insert({
      id: 'user-player-1',
      username: 'Arannis',
      email: 'player@dndcompanion.com',
      password: playerPassword,
      role: 'player',
      avatar: '⚔️',
      createdAt: new Date().toISOString()
    }).write();

    db.get('users').insert({
      id: 'user-player-2',
      username: 'Zorathis',
      email: 'zorathis@dndcompanion.com',
      password: playerPassword,
      role: 'player',
      avatar: '🏹',
      createdAt: new Date().toISOString()
    }).write();

    // Seed campaign
    db.get('campaigns').insert({
      id: 'campaign-1',
      name: 'La Maldición de Strahd',
      description: 'Los aventureros son atraídos a las brumosas tierras de Barovia, dominadas por el vampiro Strahd von Zarovich.',
      dmId: 'user-dm-1',
      status: 'active',
      image: '🏰',
      createdAt: new Date().toISOString()
    }).write();

    // Seed campaign players
    db.get('campaign_players').insert({ id: 'cp-1', campaignId: 'campaign-1', playerId: 'user-player-1' }).write();
    db.get('campaign_players').insert({ id: 'cp-2', campaignId: 'campaign-1', playerId: 'user-player-2' }).write();

    // Seed missions
    db.get('missions').insert({
      id: 'mission-1',
      campaignId: 'campaign-1',
      title: 'Investigar la Taberna del Oso',
      description: 'El posadero ha desaparecido misteriosamente. Los aldeanos piden ayuda para encontrarlo.',
      status: 'active',
      reward: '150 XP + 50 PO',
      difficulty: 'easy',
      assignedTo: ['user-player-1', 'user-player-2'],
      createdAt: new Date().toISOString()
    }).write();

    db.get('missions').insert({
      id: 'mission-2',
      campaignId: 'campaign-1',
      title: 'Eliminar a los Bandidos del Norte',
      description: 'Un grupo de bandidos está atacando las caravanas. Debéis neutralizarlos.',
      status: 'available',
      reward: '200 XP + 100 PO',
      difficulty: 'medium',
      assignedTo: [],
      createdAt: new Date().toISOString()
    }).write();

    db.get('missions').insert({
      id: 'mission-3',
      campaignId: 'campaign-1',
      title: 'El Castillo de Ravenloft',
      description: 'Confrontad al Conde Strahd en su propio castillo. Solo los más valientes sobreviven.',
      status: 'available',
      reward: '1000 XP + Artefacto Legendario',
      difficulty: 'deadly',
      assignedTo: [],
      createdAt: new Date().toISOString()
    }).write();

    // Seed monsters
    db.get('monsters').insert({ id: 'mon-1', name: 'Goblin', hp: 7, ac: 15, cr: '1/4', attack: '+4', damage: '1d6+2', type: 'Humanoide' }).write();
    db.get('monsters').insert({ id: 'mon-2', name: 'Esqueleto', hp: 13, ac: 13, cr: '1/4', attack: '+4', damage: '1d6+2', type: 'No-Muerto' }).write();
    db.get('monsters').insert({ id: 'mon-3', name: 'Zombi', hp: 22, ac: 8, cr: '1/4', attack: '+3', damage: '1d6+1', type: 'No-Muerto' }).write();
    db.get('monsters').insert({ id: 'mon-4', name: 'Lobo', hp: 11, ac: 13, cr: '1/4', attack: '+4', damage: '2d4+2', type: 'Bestia' }).write();
    db.get('monsters').insert({ id: 'mon-5', name: 'Orco', hp: 15, ac: 13, cr: '1/2', attack: '+5', damage: '1d12+3', type: 'Humanoide' }).write();
    db.get('monsters').insert({ id: 'mon-6', name: 'Ogro', hp: 59, ac: 11, cr: '2', attack: '+6', damage: '2d8+4', type: 'Gigante' }).write();
    db.get('monsters').insert({ id: 'mon-7', name: 'Troll', hp: 84, ac: 15, cr: '5', attack: '+7', damage: '2d6+4', type: 'Gigante' }).write();
    db.get('monsters').insert({ id: 'mon-8', name: 'Vampiro Espectral', hp: 144, ac: 16, cr: '13', attack: '+9', damage: '1d8+5', type: 'No-Muerto' }).write();

    // Seed encounter
    db.get('encounters').insert({
      id: 'enc-1',
      campaignId: 'campaign-1',
      name: 'Emboscada en el Bosque',
      description: 'Los jugadores son emboscados por goblins mientras viajan.',
      status: 'pending',
      monsters: [
        { monsterId: 'mon-1', name: 'Goblin', count: 4, currentHp: [7,7,7,7], maxHp: 7, ac: 15 },
        { monsterId: 'mon-5', name: 'Orco Líder', count: 1, currentHp: [15], maxHp: 15, ac: 13 }
      ],
      initiativeOrder: [],
      round: 0,
      createdAt: new Date().toISOString()
    }).write();

    console.log('✦ Database seeded successfully');
  }
}

seedIfEmpty();

module.exports = db;
