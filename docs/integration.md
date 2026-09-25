# Contrato compartido — primera integración

Todas las rutas de negocio están bajo `/api`, requieren `Authorization: Bearer <Supabase access_token>` y devuelven JSON. IDs: UUID; fechas: ISO 8601 UTC; errores: `{ "error": "mensaje" }` (validación puede incluir `details`). 401 = sesión inválida, 400 = datos inválidos, 404 = inexistente/no accesible, 409 = duplicado/transición inválida. Nunca inferir autorización de `role` enviado por el cliente.

| Ruta | Uso y permisos |
|---|---|
| GET `/health` | Comprobación pública del proceso |
| GET `/auth/me` | Perfil propio; crea el perfil si falta |
| GET/POST `/campaigns` | Listar propias/participadas; crear y ser su DM |
| GET `/campaigns/:id` | Dueño o participante; incluye `players` |
| PUT/DELETE `/campaigns/:id` | Solo dueño |
| POST `/campaigns/:id/players` | Dueño, body `{playerId}`; usuario ya registrado |
| DELETE `/campaigns/:id/players/:playerId` | Dueño; elimina asignaciones y desvincula personajes de esa campaña |
| GET `/missions?campaignId=UUID` | Solo campañas accesibles; filtro opcional |
| GET `/missions/:id` | Dueño o participante |
| POST `/missions` | Dueño de `campaignId` |
| PUT/DELETE `/missions/:id` | Dueño; PUT no permite cambiar campaña ni estado |
| POST `/missions/:id/assign` | Dueño, `{playerId}`; solo participantes |
| POST `/missions/:id/accept` | Jugador asignado, sin body; aceptación persistida e idempotente |
| POST `/missions/:id/complete` | Dueño, sin body; idempotente |
| GET `/encounters?campaignId=UUID` y GET `/encounters/:id` | Campañas accesibles |
| POST `/encounters`, PUT/DELETE `/encounters/:id` | Dueño |
| POST `/encounters/:id/start`, `/nextround`, `/end` | Dueño; transiciones validadas |
| PATCH `/encounters/:id/damage` | Dueño; `{monsters, initiativeOrder}` |
| GET `/users` | Perfiles públicos de personas en campañas compartidas y uno mismo |
| GET `/users/players?email=correo` | Búsqueda por correo exacto; devuelve id/username/avatar |
| GET `/characters` | Personajes propios, más reciente primero |
| GET `/characters?campaignId=UUID` | Personajes vinculados a una campaña accesible |
| POST `/characters` | Crea personaje propio, campaña opcional |
| PUT/DELETE `/characters/:id` | Solo propietario del personaje |
| GET `/monsters`, GET `/monsters/:slug`, POST `/monsters/xp` | Catálogo Open5e existente |

## Formatos

Campaña: `{id,name,description,dmId,status,image,createdAt,playerCount,missionCount}`. Estados: `active`, `completed`, `archived`.

Crear misión:
```json
{"campaignId":"UUID","title":"Buscar el tomo","description":"Investigar la biblioteca","reward":"Objeto especial","rewardXp":200,"rewardGold":50,"difficulty":"medium"}
```

Respuesta de misión, consistente para GET/POST/PUT/acciones:
```json
{"id":"UUID","campaignId":"UUID","title":"Buscar el tomo","description":"Investigar la biblioteca","status":"available","reward":"Objeto especial","rewardXp":200,"rewardGold":50,"difficulty":"medium","assignedTo":[],"acceptedBy":[],"createdAt":"2026-09-24T00:00:00.000Z"}
```

Estados: `available` → `active` al aceptar → `completed` por DM. Asignar no equivale a aceptar. Una misión puede tener varios asignados; cada uno acepta individualmente. La finalización corresponde a la misión completa. `reward` es texto libre, `rewardXp` y `rewardGold` son enteros >= 0. No se parsea el texto para calcular XP.

Personaje: `{id,ownerId,campaignId,name,race,characterClass,level,alignment,strength,dexterity,constitution,intelligence,wisdom,charisma,createdAt}`. POST no acepta `ownerId`: lo obtiene del token. Nivel 1–20; atributos 1–30. Android muestra el más reciente y crea personajes; selección múltiple/vinculación desde UI queda pendiente. La API admite `campaignId` si el propietario pertenece a la campaña.

Encuentro: `{id,campaignId,name,description,status,monsters,initiativeOrder,round,xpTotal,estimatedDifficulty,createdAt}`. Se mantiene el objeto anidado de monstruo que usa la web: `{slug,nombre,cantidad,hp_max,hp_actual,ca,cr,xp_unidad}`. Estados: `pending`, `active`, `completed`.

## Prueba manual con servicios reales

1. Configurar un único proyecto Supabase en backend, React y Android; aplicar `npm run db:deploy`.
2. Crear y confirmar dos cuentas. Iniciar sesión una vez con cada una para crear sus perfiles.
3. Desde React, crear una campaña con la primera cuenta. Esa cuenta es su DM.
4. En Jugadores, buscar el email exacto de la segunda cuenta y agregarla.
5. Crear misión y asignarla al participante. Abrir Android con la segunda cuenta, pulsar Actualizar.
6. Aceptar en Android. Recargar Misiones en React y verificar `acceptedBy` y estado `active`.
7. Completar desde React. Actualizar Android: aparece como completada, incluso tras reiniciar.
8. Crear personaje en Android, cerrar y volver a abrir: el personaje se recupera desde la API.
9. Probar otra cuenta: no puede ver ni modificar esa campaña mediante sus IDs.
10. Quitar al participante: deja de ver las misiones; su personaje personal sigue existiendo.

## Límites de esta entrega

No se han desplegado servicios ni reactivado el proyecto Supabase. Las URL y credenciales privadas se configuran fuera de git. Los datos anteriores son de prueba y no se importan. Esta rama debe integrarse junto con las ramas correspondientes de React y Android; las versiones anteriores usan un contrato de autenticación incompatible.
