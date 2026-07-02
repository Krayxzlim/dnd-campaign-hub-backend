# D&D Campaign Hub — Backend

API REST para gestionar campañas de Dungeons & Dragons 5e.
Hecha con Node.js y Express, con PostgreSQL como base de datos. La consume el frontend SPA y, en algún momento, podría consumirla también un cliente Android.

---

## Tecnologías

| Paquete | Versión | Para qué se usa |
|---------|---------|-------------|
| express | ^4.22 | Framework HTTP y ruteo |
| pg | ^8.16 | Cliente de PostgreSQL y pool de conexiones |
| jsonwebtoken | ^9.0 | Generación y validación de JWT |
| bcryptjs | ^2.4 | Hasheo seguro de contraseñas |
| cors | ^2.8 | Soporte CORS para el frontend |
| dotenv | ^16.6 | Variables de entorno desde `.env` |

---

## Estructura de carpetas

```
backend/
├── src/
│   ├── index.js               Punto de entrada: crea la app de Express y registra las rutas
│   ├── db/
│   │   └── database.js        Pool de PostgreSQL, creación del esquema y datos semilla
│   ├── middleware/
│   │   └── auth.js            Middleware de JWT: authMiddleware + dmOnly
│   └── routes/
│       ├── auth.js            /api/auth  (login, registro, me)
│       ├── campaigns.js       /api/campaigns
│       ├── missions.js        /api/missions
│       ├── encounters.js      /api/encounters
│       ├── monsters.js        /api/monsters (proxy a Open5e)
│       └── users.js           /api/users
├── .env                        Variables de entorno (no se commitea)
└── package.json
```

---

## Instalación

### Requisitos

- Node.js 18 o superior
- npm 8 o superior
- Una instancia de PostgreSQL corriendo

### Pasos

```bash
# 1. Entrar a la carpeta
cd backend

# 2. Instalar dependencias
npm install

# 3. Crear un archivo .env (ver Variables de entorno más abajo)

# 4. Levantar el servidor
npm start
# o, para recarga automática durante el desarrollo:
npm run dev
```

Salida esperada:

```
Conectado a PostgreSQL
Esquema listo
Datos semilla insertados
D&D Campaign Hub API corriendo en http://localhost:3001
Health check: http://localhost:3001/api/health
```

En el primer arranque, `database.js` crea las tablas que hagan falta y, si la tabla `usuarios` está vacía, carga usuarios de prueba, una campaña, misiones y un encuentro.

---

## Autenticación

La API usa JWT (JSON Web Token).

### Flujo

1. El cliente manda un POST a `/api/auth/login` con email y contraseña.
2. La API valida las credenciales con bcrypt y devuelve un JWT firmado.
3. En las rutas protegidas, el cliente manda el token en el header:
   ```
   Authorization: Bearer <token>
   ```
4. `authMiddleware` verifica el token en cada request.
5. `dmOnly` rechaza el request con 403 si el rol no es `dm`.

### Roles

| Rol | Descripción |
|------|--------------|
| dm | Dungeon Master. Acceso total: crea, edita y borra todos los recursos. |
| player | Solo puede leer sus propias misiones y los encuentros de su campaña. |

---

## Endpoints

URL base: `http://localhost:3001/api`

### Health

```
GET /health
```

Devuelve `{ status, message, timestamp }`. No requiere autenticación.

---

### Auth — /api/auth

| Método | Ruta | Auth | Descripción |
|--------|-------|------|-------------|
| POST | /login | No | Inicia sesión. Body: `{ email, password }`. Devuelve `{ token, user }`. |
| POST | /register | No | Crea una cuenta. Body: `{ username, email, password, role }`. |
| GET | /me | Sí | Devuelve el usuario autenticado. |

---

### Campañas — /api/campaigns

| Método | Ruta | Rol | Descripción |
|--------|-------|------|-------------|
| GET | / | Ambos | Lista campañas. El DM ve las suyas; el jugador ve aquellas a las que pertenece. |
| GET | /:id | Ambos | Detalle de la campaña, incluye la lista de jugadores. |
| POST | / | DM | Crea una campaña. Body: `{ nombre, descripcion, imagen }`. |
| PUT | /:id | DM | Actualiza una campaña. Body: `{ nombre, descripcion, imagen, estado }`. |
| DELETE | /:id | DM | Borra una campaña y todo su contenido. |
| POST | /:id/players | DM | Agrega un jugador. Body: `{ playerId }`. |
| DELETE | /:id/players/:playerId | DM | Saca a un jugador de la campaña. |

---

### Misiones — /api/missions

| Método | Ruta | Rol | Descripción |
|--------|-------|------|-------------|
| GET | /?campaignId=xxx | Ambos | Lista misiones. Un jugador solo ve las disponibles o las que tiene asignadas. |
| GET | /:id | Ambos | Detalle de la misión. |
| POST | / | DM | Crea una misión. Body: `{ campaignId, title, description, reward, difficulty }`. |
| PUT | /:id | DM | Actualiza una misión. |
| DELETE | /:id | DM | Borra una misión. |
| POST | /:id/assign | DM | Asigna un jugador. Body: `{ playerId }`. Pasa el estado a `active`. |
| POST | /:id/complete | DM | Marca la misión como completada. |

Estados de misión: `available` -> `active` -> `completed`.

Dificultad: `easy`, `medium`, `hard`, `deadly`.

---

### Encuentros — /api/encounters

| Método | Ruta | Rol | Descripción |
|--------|-------|------|-------------|
| GET | /?campaignId=xxx | Ambos | Lista encuentros. |
| GET | /:id | Ambos | Detalle del encuentro, incluye el orden de iniciativa. |
| POST | / | DM | Crea un encuentro. Body: `{ campaignId, name, description, monsters[] }`. |
| PUT | /:id | DM | Actualiza un encuentro. |
| POST | /:id/start | DM | Arranca el combate: tira un d20 por cada instancia de monstruo y ordena por iniciativa. |
| PATCH | /:id/damage | DM | Aplica daño. Body: `{ monsters, initiativeOrder }`. |
| POST | /:id/nextround | DM | Avanza una ronda. |
| POST | /:id/end | DM | Termina el encuentro. |
| DELETE | /:id | DM | Borra el encuentro. |

Estados de encuentro: `pending` -> `active` -> `completed`.

---

### Monstruos — /api/monsters

Esta ruta hace de proxy hacia la API pública de [Open5e](https://open5e.com/); no lee de la base de datos local.

| Método | Ruta | Rol | Descripción |
|--------|-------|------|-------------|
| GET | /?search=&type=&cr=&page= | Ambos | Busca en el catálogo SRD de monstruos de Open5e, con filtros opcionales. |
| GET | /:slug | Ambos | Ficha completa de un monstruo. |
| POST | /xp | Ambos | Calcula el XP total y una dificultad estimada para una lista de monstruos. |

---

### Usuarios — /api/users

| Método | Ruta | Rol | Descripción |
|--------|-------|------|-------------|
| GET | / | Ambos | El DM ve a todos los usuarios; el jugador se ve solo a sí mismo. |
| GET | /players | DM | Lista los usuarios con rol `player`. |
| DELETE | /:id | DM | Borra un usuario. Un DM no puede borrarse a sí mismo (esto se valida en el backend). |

---

## Base de datos

La API usa PostgreSQL a través del pool de conexiones de `pg`. `database.js` se encarga de:

1. Conectarse a la base configurada en `.env`.
2. Crear el esquema (`usuarios`, `campanas`, `campana_jugadores`, `misiones`, `mision_asignados`, `encuentros`) si todavía no existe.
3. Cargar datos de prueba la primera vez que la tabla `usuarios` está vacía.

Los nombres de tablas y columnas están en español; la capa de la API los traduce al formato en inglés y camelCase que consume el frontend (con la excepción que se aclara más abajo).

---

## Datos semilla

En el primer arranque se crean automáticamente:

Usuarios:
- `dm@dndcompanion.com` / `dm123456` (rol: dm)
- `player@dndcompanion.com` / `player123` (rol: player)
- `zorathis@dndcompanion.com` / `player123` (rol: player)

Campaña: La Maldición de Strahd

Misiones: tres misiones (una en curso, dos disponibles)

Encuentros: un encuentro pendiente con goblins y un orco líder

---

## Variables de entorno

Crear un archivo `.env` en la raíz del backend. No se sube al repositorio.

```env
PORT=3001
JWT_SECRET=reemplazar-por-un-string-largo-y-random

PG_HOST=localhost
PG_PORT=5432
PG_USER=tu-usuario-de-db
PG_PASSWORD=tu-password-de-db
PG_DATABASE=dndcampaign
```

Usar un valor largo y random para `JWT_SECRET` en cualquier entorno que no sea local, y nunca commitear credenciales reales de base de datos.

---

## Problemas conocidos

- Los handlers `POST` y `PUT` de `routes/campaigns.js` leen `nombre`, `descripcion` e `imagen` del body, mientras que el formulario de creación de campañas del frontend (`DashboardPage.jsx`) manda `name`, `description` e `image`. Tal como está, crear o editar una campaña desde el frontend falla con "Nombre requerido" o guarda `null` en silencio. Hay que alinear los nombres de los campos de un lado o del otro antes de confiar en ese flujo.
- `db.json` es un resto de una versión anterior de esta API que usaba un datastore local en JSON (lowdb). La implementación actual lee y escribe únicamente a través de PostgreSQL; ninguna ruta lee `db.json` y no debería volver a commitearse (ver `.gitignore`). Si ya quedó en el historial del repo, conviene sacarlo, porque contiene los hashes bcrypt de las cuentas semilla.
- Si el `.env` del repo ya se llegó a commitear en algún momento, contiene el secreto del JWT y las credenciales de la base. Conviene rotar esos valores y sacar el archivo del historial de git, no alcanza con solo agregarlo al `.gitignore` de ahora en más.
