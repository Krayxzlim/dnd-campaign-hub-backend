# D&D Campaign Hub — API

API Express compartida por React y DNDcompanion (Android). Supabase Auth administra identidades; Prisma ORM administra los datos de juego en Supabase PostgreSQL.

## Primera integración

- Prisma **6.19.3**, fijado con su cliente para conservar CommonJS y evitar una conversión de framework en esta entrega.
- Modelos: perfiles, campañas, participantes, misiones, asignaciones/aceptación, encuentros y personajes.
- UUID de `auth.users` como identidad; no se guardan contraseñas ni se emiten JWT propios.
- El dueño de cada campaña es su DM. Una cuenta puede dirigir una campaña y jugar en otra.
- Todas las operaciones verifican propiedad o pertenencia en el servidor. No se usan roles de `user_metadata` para autorizar.
- JSON en inglés/camelCase; tablas en español mediante `@map`/`@@map`.
- Esquema privado `app`; la API REST de negocio es Express. No exponer `app` en Supabase Data API.

## Configuración

Requisitos: Node 22+, un proyecto Supabase activo con email/password habilitado y conexión PostgreSQL.

1. Copiar `.env.example` a `.env` y completar las variables. `DATABASE_URL` y `DIRECT_URL` son privadas del servidor. Obtener las conexiones desde **Connect** en Supabase; el Session pooler (5432) sirve en entornos IPv4. Escapar la contraseña como componente de URL.
2. Instalar y generar el cliente:
   ```sh
   npm ci
   npm run db:validate
   npm run db:generate
   ```
3. Aplicar la migración nueva:
   ```sh
   npm run db:deploy
   ```
4. Iniciar:
   ```sh
   npm run dev
   ```

`SUPABASE_PUBLISHABLE_KEY` puede ser la clave pública moderna; no se necesita `service_role`. `CORS_ORIGINS` acepta una lista de orígenes web separados por comas. Android usa la URL HTTPS pública del servidor; el emulador puede acceder al equipo por `http://10.0.2.2:3001/api`.

Esta entrega crea `app` desde cero y no migra ni elimina los datos anteriores de `public`/Firebase. El esquema `app` debe estar vacío antes de la primera migración. No ejecutar `migrate reset`, `db push` o `migrate dev` sobre el proyecto compartido. La FK hacia `auth.users`, los CHECK y los permisos se conservan en SQL versionado; Auth queda fuera del esquema administrado por Prisma. Para cambios futuros usar una base de desarrollo Supabase separada y revisar el SQL antes de aplicar `db:deploy`.

La conexión inicial usa el propietario de las tablas: RLS está habilitado y los roles `anon`/`authenticated` no tienen acceso; el propietario SQL puede omitir RLS. Por ello la autorización por campaña se aplica en Express. No reutilizar esta conexión en clientes ni asumir que Prisma convierte el JWT en una sesión RLS. Si se adopta otro rol de ejecución, otorgar sus permisos explícitamente y mantenerlo inaccesible desde la Data API.

## Auth y datos de prueba

Registrar cuentas nuevas desde web o Android, confirmar el correo si corresponde e iniciar sesión. La primera petición autenticada crea el perfil mediante Prisma. No se insertan cuentas demo ni contraseñas automáticas.

Configurar **Site URL** y **Redirect URLs** de Supabase Auth para la URL de la web. Android usa confirmación por correo en el navegador y luego login manual; no implementa deep links. Ambas aplicaciones deben apuntar al mismo proyecto y backend.

El perfil usa el UUID confirmado por `supabase.auth.getUser(accessToken)`. `/api/auth/me` devuelve un `role` derivado solo para compatibilidad visual; no es una autorización global. No existen ya `/auth/login`, `/auth/register` ni eliminación global de cuentas por parte del DM.

## API y comprobación

Ver [contrato y recorrido de aceptación](docs/integration.md).

```sh
npm test
```

La prueba levanta PostgreSQL WASM (PGlite), aplica el SQL real de migración y usa el cliente Prisma real y HTTP Express. Solo Supabase Auth se simula y `auth.users` se representa con una tabla mínima de prueba. Comprueba persistencia, contratos, accesos cruzados, aceptación, finalización, personajes, limpieza al quitar participantes, FK, CHECK y bloqueo de los roles de la Data API. No requiere ni modifica el proyecto remoto.

## Alcance

La primera entrega sincroniza campañas/misiones/personajes a través de la API. La recompensa XP/oro es información estructurada: todavía no acredita XP ni calcula niveles automáticamente. No hay push, realtime ni modo offline. Open5e conserva su integración para el catálogo de monstruos. Arcos, capítulos y generación procedural quedan para otra etapa.
