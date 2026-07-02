require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: parseInt(process.env.PG_PORT || "5432"),
  user: process.env.PG_USER || "dndadmin",
  password: process.env.PG_PASSWORD || "dnd2024secure",
  database: process.env.PG_DATABASE || "dndcampaign",
});

async function crearEsquema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id        TEXT PRIMARY KEY,
      username  TEXT NOT NULL,
      email     TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      role      TEXT NOT NULL DEFAULT 'player',
      avatar    TEXT DEFAULT '⚔️',
      creado_en TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS campanas (
      id          TEXT PRIMARY KEY,
      nombre      TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      dm_id       TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      estado      TEXT DEFAULT 'active',
      imagen      TEXT DEFAULT '🗺️',
      creado_en   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS campana_jugadores (
      id         TEXT PRIMARY KEY,
      campana_id TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      jugador_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      UNIQUE(campana_id, jugador_id)
    );

    CREATE TABLE IF NOT EXISTS misiones (
      id          TEXT PRIMARY KEY,
      campana_id  TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      titulo      TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      estado      TEXT DEFAULT 'available',
      recompensa  TEXT DEFAULT '',
      dificultad  TEXT DEFAULT 'medium',
      creado_en   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mision_asignados (
      mision_id  TEXT NOT NULL REFERENCES misiones(id) ON DELETE CASCADE,
      jugador_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      PRIMARY KEY (mision_id, jugador_id)
    );

    CREATE TABLE IF NOT EXISTS encuentros (
      id               TEXT PRIMARY KEY,
      campana_id       TEXT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
      nombre           TEXT NOT NULL,
      descripcion      TEXT DEFAULT '',
      estado           TEXT DEFAULT 'pending',
      monstruos        JSONB DEFAULT '[]',
      orden_iniciativa JSONB DEFAULT '[]',
      ronda            INTEGER DEFAULT 0,
      xp_total         INTEGER DEFAULT 0,
      dificultad_est   TEXT DEFAULT '',
      creado_en        TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✦ Esquema PostgreSQL listo");
}

async function sembrarDatos() {
  const { rows } = await pool.query("SELECT id FROM usuarios LIMIT 1");
  if (rows.length > 0) return;

  const bcrypt = require("bcryptjs");
  const passDM = bcrypt.hashSync("dm123456", 10);
  const passP = bcrypt.hashSync("player123", 10);

  await pool.query(
    `
    INSERT INTO usuarios (id,username,email,password,role,avatar) VALUES
      ('user-dm-1',     'dungeon_master','dm@dndcompanion.com',       $1,'dm',    '🧙'),
      ('user-player-1', 'Arannis',       'player@dndcompanion.com',   $2,'player','⚔️'),
      ('user-player-2', 'Zorathis',      'zorathis@dndcompanion.com', $2,'player','🏹')
  `,
    [passDM, passP],
  );

  await pool.query(`
    INSERT INTO campanas (id,nombre,descripcion,dm_id,imagen) VALUES
      ('campaign-1','La Maldición de Strahd',
       'Los aventureros son atraídos a las brumosas tierras de Barovia.',
       'user-dm-1','🏰')
  `);

  await pool.query(`
    INSERT INTO campana_jugadores (id,campana_id,jugador_id) VALUES
      ('cp-1','campaign-1','user-player-1'),
      ('cp-2','campaign-1','user-player-2')
  `);

  await pool.query(`
    INSERT INTO misiones (id,campana_id,titulo,descripcion,estado,recompensa,dificultad) VALUES
      ('mission-1','campaign-1','Investigar la Taberna del Oso',
       'El posadero ha desaparecido. Los aldeanos piden ayuda.','active','150 XP + 50 PO','easy'),
      ('mission-2','campaign-1','Eliminar a los Bandidos del Norte',
       'Bandidos atacan las caravanas.','available','200 XP + 100 PO','medium'),
      ('mission-3','campaign-1','El Castillo de Ravenloft',
       'Confrontad al Conde Strahd.','available','1000 XP + Artefacto','deadly')
  `);

  await pool.query(`
    INSERT INTO mision_asignados (mision_id,jugador_id) VALUES
      ('mission-1','user-player-1'),
      ('mission-1','user-player-2')
  `);

  await pool.query(`
    INSERT INTO encuentros (id,campana_id,nombre,descripcion,monstruos,xp_total,dificultad_est) VALUES
      ('enc-1','campaign-1','Emboscada en el Bosque',
       'Los jugadores son emboscados por goblins.',
       '[
         {"slug":"goblin","nombre":"Goblin","cantidad":4,"hp_max":7,"hp_actual":[7,7,7,7],"ca":15,"cr":"1/4","xp_unidad":50},
         {"slug":"orc","nombre":"Orco Líder","cantidad":1,"hp_max":15,"hp_actual":[15],"ca":13,"cr":"1/2","xp_unidad":100}
       ]'::jsonb,
       300,'Media')
  `);

  console.log("✦ Datos semilla insertados");
}

async function conectar() {
  await pool.query("SELECT 1");
  console.log("🐘 Conectado a PostgreSQL");
  await crearEsquema();
  await sembrarDatos();
}

module.exports = { pool, conectar };
