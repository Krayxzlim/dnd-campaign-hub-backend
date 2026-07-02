# D&D Campaign Hub — Backend

REST API for managing Dungeons & Dragons 5e campaigns.
Built with Node.js and Express, backed by PostgreSQL. Consumed by the frontend SPA and, potentially, by an Android client.

---

## Technologies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.22 | HTTP framework and routing |
| pg | ^8.16 | PostgreSQL client and connection pool |
| jsonwebtoken | ^9.0 | JWT generation and validation |
| bcryptjs | ^2.4 | Secure password hashing |
| cors | ^2.8 | CORS support for the frontend |
| dotenv | ^16.6 | Environment variables from `.env` |

---

## Folder structure

```
backend/
├── src/
│   ├── index.js               Entry point: creates the Express app and registers routes
│   ├── db/
│   │   └── database.js        PostgreSQL pool, schema creation, and seed data
│   ├── middleware/
│   │   └── auth.js            JWT middleware: authMiddleware + dmOnly
│   └── routes/
│       ├── auth.js            /api/auth  (login, register, me)
│       ├── campaigns.js       /api/campaigns
│       ├── missions.js        /api/missions
│       ├── encounters.js      /api/encounters
│       ├── monsters.js        /api/monsters (proxies Open5e)
│       └── users.js           /api/users
├── .env                        Environment variables (not committed)
└── package.json
```

---

## Installation and setup

### Requirements

- Node.js 18 or higher
- npm 8 or higher
- A running PostgreSQL instance

### Steps

```bash
# 1. Move into the folder
cd backend

# 2. Install dependencies
npm install

# 3. Create a .env file (see Environment variables below)

# 4. Start the server
npm start
# or, for automatic reload during development:
npm run dev
```

Expected output:

```
Connected to PostgreSQL
Schema ready
Seed data inserted
D&D Campaign Hub API running at http://localhost:3001
Health check: http://localhost:3001/api/health
```

On first startup, `database.js` creates the required tables if they do not exist and, if the `usuarios` table is empty, inserts a set of demo users, a campaign, missions, and one encounter.

---

## Authentication

The API uses JWT (JSON Web Token).

### Flow

1. The client sends a POST request to `/api/auth/login` with email and password.
2. The API validates the credentials with bcrypt and returns a signed JWT.
3. For protected routes, the client includes the token in the header:
   ```
   Authorization: Bearer <token>
   ```
4. The `authMiddleware` verifies the token on every request.
5. The `dmOnly` middleware rejects the request with 403 if the role is not `dm`.

### Roles

| Role | Description |
|------|--------------|
| dm | Dungeon Master. Full access: create, edit, and delete all resources. |
| player | Can only read their own missions and the encounters of their campaign. |

---

## Endpoints

Base URL: `http://localhost:3001/api`

### Health

```
GET /health
```

Returns `{ status, message, timestamp }`. No authentication required.

---

### Auth — /api/auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /login | No | Sign in. Body: `{ email, password }`. Returns `{ token, user }`. |
| POST | /register | No | Create an account. Body: `{ username, email, password, role }`. |
| GET | /me | Yes | Returns the currently authenticated user. |

---

### Campaigns — /api/campaigns

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | / | Both | Lists campaigns. DM sees their own; Player sees the ones they belong to. |
| GET | /:id | Both | Campaign detail, including the player list. |
| POST | / | DM | Create a campaign. Body: `{ nombre, descripcion, imagen }`. |
| PUT | /:id | DM | Update a campaign. Body: `{ nombre, descripcion, imagen, estado }`. |
| DELETE | /:id | DM | Delete a campaign and its content. |
| POST | /:id/players | DM | Add a player. Body: `{ playerId }`. |
| DELETE | /:id/players/:playerId | DM | Remove a player from the campaign. |

---

### Missions — /api/missions

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | /?campaignId=xxx | Both | Lists missions. A player only sees available or assigned missions. |
| GET | /:id | Both | Mission detail. |
| POST | / | DM | Create a mission. Body: `{ campaignId, title, description, reward, difficulty }`. |
| PUT | /:id | DM | Update a mission. |
| DELETE | /:id | DM | Delete a mission. |
| POST | /:id/assign | DM | Assign a player. Body: `{ playerId }`. Sets status to `active`. |
| POST | /:id/complete | DM | Mark a mission as completed. |

Mission status: `available` -> `active` -> `completed`.

Difficulty: `easy`, `medium`, `hard`, `deadly`.

---

### Encounters — /api/encounters

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | /?campaignId=xxx | Both | Lists encounters. |
| GET | /:id | Both | Encounter detail, including initiative order. |
| POST | / | DM | Create an encounter. Body: `{ campaignId, name, description, monsters[] }`. |
| PUT | /:id | DM | Update an encounter. |
| POST | /:id/start | DM | Starts combat: rolls a d20 for each monster instance and sorts by initiative. |
| PATCH | /:id/damage | DM | Applies damage. Body: `{ monsters, initiativeOrder }`. |
| POST | /:id/nextround | DM | Advances one round. |
| POST | /:id/end | DM | Ends the encounter. |
| DELETE | /:id | DM | Delete the encounter. |

Encounter status: `pending` -> `active` -> `completed`.

---

### Monsters — /api/monsters

This route proxies the public [Open5e](https://open5e.com/) API rather than reading from the local database.

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | /?search=&type=&cr=&page= | Both | Searches the Open5e SRD monster catalog with optional filters. |
| GET | /:slug | Both | Full stat block for a single monster. |
| POST | /xp | Both | Calculates total XP and an estimated difficulty for a list of monsters. |

---

### Users — /api/users

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | / | Both | DM sees every user; Player sees only themselves. |
| GET | /players | DM | Lists users with the `player` role. |
| DELETE | /:id | DM | Deletes a user. A DM cannot delete their own account (enforced server-side). |

---

## Database

The API uses PostgreSQL through the `pg` connection pool. `database.js` is responsible for:

1. Connecting to the database configured in `.env`.
2. Creating the schema (`usuarios`, `campanas`, `campana_jugadores`, `misiones`, `mision_asignados`, `encuentros`) if it does not already exist.
3. Seeding demo data the first time the `usuarios` table is empty.

Table and column names are in Spanish; the API layer translates them to the English, camelCase shape consumed by the frontend (with the exception noted below).

---

## Seed data

On first startup, the following are created automatically:

Users:
- `dm@dndcompanion.com` / `dm123456` (role: dm)
- `player@dndcompanion.com` / `player123` (role: player)
- `zorathis@dndcompanion.com` / `player123` (role: player)

Campaign: La Maldicion de Strahd

Missions: three missions (one active, two available)

Encounters: one pending encounter with goblins and an orc leader

---

## Environment variables

Create a `.env` file in the backend root. It is not committed to version control.

```env
PORT=3001
JWT_SECRET=replace-with-a-long-random-string

PG_HOST=localhost
PG_PORT=5432
PG_USER=your-db-user
PG_PASSWORD=your-db-password
PG_DATABASE=dndcampaign
```

Use a long, random value for `JWT_SECRET` in any non-local environment, and never commit real database credentials.

---

## Known issues

- The `POST` and `PUT` handlers in `routes/campaigns.js` read `nombre`, `descripcion`, and `imagen` from the request body, while the frontend's campaign creation form (`DashboardPage.jsx`) sends `name`, `description`, and `image`. As written, campaign creation and updates from the frontend will fail with "Nombre requerido" or silently store `null` values. Align the field names on either side before relying on this flow.
- `db.json` is a leftover artifact from an earlier version of this API that used a local JSON datastore (lowdb). The current implementation reads and writes exclusively through PostgreSQL; `db.json` is not read by any route and should not be committed going forward (see `.gitignore`). If it is already tracked in the repository's history, consider removing it, since it contains bcrypt password hashes for the seed accounts.
- The repository's `.env` file, if already committed, contains a JWT secret and database credentials. Rotate these values and remove the file from git history rather than only relying on `.gitignore` going forward.
