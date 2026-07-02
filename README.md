# ⚔️ D&D Campaign Hub — Backend

API REST para gestión de campañas de Dungeons & Dragons 5e.  
Construida con Node.js + Express. Se comunica con el frontend SPA y puede ser consumida también por la app Android.

---

## 🛠️ Tecnologías

| Paquete | Versión | Para qué sirve |
|---------|---------|----------------|
| **express** | ^4.18 | Framework HTTP y routing |
| **lowdb** | 1.0.0 | Base de datos JSON persistente en archivo `db.json` |
| **jsonwebtoken** | ^9.0 | Generación y validación de JWT |
| **bcryptjs** | ^2.4 | Hash seguro de contraseñas |
| **cors** | ^2.8 | Habilitar CORS para el frontend |
| **dotenv** | ^16.3 | Variables de entorno desde `.env` |
| **uuid** | ^9.0 | Generación de IDs únicos |

---

## 📁 Estructura de carpetas

```
backend/
├── src/
│   ├── index.js               ← Entry point: crea la app Express y registra rutas
│   ├── db/
│   │   └── database.js        ← Inicializa lowdb y ejecuta el seed de datos
│   ├── middleware/
│   │   └── auth.js            ← Middleware JWT: authMiddleware + dmOnly
│   └── routes/
│       ├── auth.js            ← /api/auth  (login, register, me)
│       ├── campaigns.js       ← /api/campaigns
│       ├── missions.js        ← /api/missions
│       ├── encounters.js      ← /api/encounters
│       ├── monsters.js        ← /api/monsters
│       └── users.js           ← /api/users
├── db.json                    ← Base de datos (se genera automáticamente)
├── .env                       ← Variables de entorno
└── package.json
```

---

## 🚀 Instalación y arranque

### Requisitos previos
- Node.js >= 18
- npm >= 8

### Pasos

```bash
# 1. Entrar a la carpeta
cd backend

# 2. Instalar dependencias
npm install

# 3. (Opcional) Revisar variables de entorno
cat .env
# PORT=3001
# JWT_SECRET=dnd-campaign-hub-secret-key-2024

# 4. Iniciar el servidor
node src/index.js
```

Salida esperada:
```
⚔️  D&D Campaign Hub API corriendo en http://localhost:3001
📖 Health: http://localhost:3001/api/health
✦ Database seeded successfully
```

> La primera vez que corre, `database.js` inserta automáticamente usuarios, una campaña, misiones, encuentros y monstruos de ejemplo en `db.json`.

---

## 🔐 Autenticación

El sistema usa **JWT (JSON Web Token)**.

### Flujo
1. El cliente hace POST a `/api/auth/login` con email y contraseña.
2. La API valida las credenciales con bcrypt y devuelve un token JWT.
3. Para rutas protegidas, el cliente incluye el token en el header:
   ```
   Authorization: Bearer <token>
   ```
4. El middleware `authMiddleware` verifica el token en cada request.
5. El middleware `dmOnly` rechaza con 403 si el rol no es `dm`.

### Roles

| Rol | Descripción |
|-----|-------------|
| `dm` | Dungeon Master. Acceso total: crear, editar, eliminar todo. |
| `player` | Jugador. Solo puede leer sus propias misiones y los encuentros de su campaña. |

---

## 🔌 Endpoints

Base URL: `http://localhost:3001/api`

### Health

```
GET /health
```
Devuelve `{ status: "ok" }`. Sin autenticación. Útil para verificar que el servidor está corriendo.

---

### Auth — `/api/auth`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/login` | ❌ | Iniciar sesión. Body: `{ email, password }`. Devuelve `{ token, user }`. |
| POST | `/register` | ❌ | Crear cuenta. Body: `{ username, email, password, role }`. |
| GET | `/me` | ✅ | Devuelve el usuario autenticado actual. |

---

### Campañas — `/api/campaigns`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/` | Ambos | Lista campañas. DM ve las suyas; Player ve las que integra. |
| GET | `/:id` | Ambos | Detalle de campaña con lista de jugadores. |
| POST | `/` | DM | Crear campaña. Body: `{ name, description, image }`. |
| PUT | `/:id` | DM | Editar campaña. |
| DELETE | `/:id` | DM | Eliminar campaña y todo su contenido. |
| POST | `/:id/players` | DM | Agregar jugador. Body: `{ playerId }`. |
| DELETE | `/:id/players/:playerId` | DM | Remover jugador de la campaña. |

---

### Misiones — `/api/missions`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/?campaignId=xxx` | Ambos | Lista misiones. Player solo ve las asignadas o disponibles. |
| GET | `/:id` | Ambos | Detalle de misión. |
| POST | `/` | DM | Crear misión. Body: `{ campaignId, title, description, reward, difficulty }`. |
| PUT | `/:id` | DM | Editar misión. |
| DELETE | `/:id` | DM | Eliminar misión. |
| POST | `/:id/assign` | DM | Asignar jugador. Body: `{ playerId }`. Cambia estado a `active`. |
| POST | `/:id/complete` | DM | Marcar misión como completada. |

**Estados de misión:** `available` → `active` → `completed`

**Dificultades:** `easy`, `medium`, `hard`, `deadly`

---

### Encuentros — `/api/encounters`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/?campaignId=xxx` | Ambos | Lista encuentros. |
| GET | `/:id` | Ambos | Detalle con orden de iniciativa. |
| POST | `/` | DM | Crear encuentro. Body: `{ campaignId, name, description, monsters[] }`. |
| PUT | `/:id` | DM | Editar encuentro. |
| POST | `/:id/start` | DM | Inicia el combate: tira d20 de iniciativa para cada monstruo y ordena. |
| PATCH | `/:id/damage` | DM | Aplica daño. Body: `{ monsterId, instanceIndex, damage }`. |
| POST | `/:id/nextround` | DM | Avanza una ronda. |
| POST | `/:id/end` | DM | Finaliza el encuentro. |
| DELETE | `/:id` | DM | Eliminar encuentro. |

**Estados de encuentro:** `pending` → `active` → `completed`

---

### Monstruos — `/api/monsters`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/` | Ambos | Lista todo el catálogo de monstruos. |
| POST | `/` | DM | Crear monstruo. Body: `{ name, hp, ac, cr, attack, damage, type }`. |
| DELETE | `/:id` | DM | Eliminar monstruo. |

---

### Usuarios — `/api/users`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/` | Ambos | DM ve todos; Player solo se ve a sí mismo. |
| GET | `/players` | DM | Lista solo los usuarios con rol `player`. |
| DELETE | `/:id` | DM | Eliminar usuario y sus asignaciones de campaña. |

---

## 🗃️ Estructura de la base de datos

El archivo `db.json` tiene esta forma:

```json
{
  "users": [
    {
      "id": "user-dm-1",
      "username": "dungeon_master",
      "email": "dm@dndcompanion.com",
      "password": "$2a$10$...",
      "role": "dm",
      "avatar": "🧙"
    }
  ],
  "campaigns": [...],
  "missions": [...],
  "encounters": [...],
  "monsters": [...],
  "campaign_players": [
    { "id": "cp-1", "campaignId": "campaign-1", "playerId": "user-player-1" }
  ]
}
```

> **Nota:** `db.json` es la base de datos. No borrarlo entre ejecuciones si querés mantener los datos. Si lo borrás, el seed se ejecuta de nuevo automáticamente al reiniciar.

---

## 🌱 Datos de ejemplo (seed)

Al iniciar por primera vez se crean:

**Usuarios**
- `dm@dndcompanion.com` / `dm123456` → rol `dm`
- `player@dndcompanion.com` / `player123` → rol `player`
- `zorathis@dndcompanion.com` / `player123` → rol `player`

**Campaña:** La Maldición de Strahd

**Misiones:** 3 (1 activa, 2 disponibles)

**Encuentros:** 1 pendiente con Goblins y un Orco Líder

**Monstruos:** 8 (Goblin, Esqueleto, Zombi, Lobo, Orco, Ogro, Troll, Vampiro Espectral)

---

## ⚙️ Variables de entorno

Archivo `.env` en la raíz del backend:

```env
PORT=3001
JWT_SECRET=dnd-campaign-hub-secret-key-2024
```

Podés cambiar `JWT_SECRET` por cualquier string largo y aleatorio en producción.

---

<p align="center"><sub>✦ D&D Campaign Hub · Backend · ACN4AP ✦</sub></p>
