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

La URL y clave pública de `Krayxzlim's Project` ya están en `config/supabase.public.json`, igual que en web y Android. Para cambiar de proyecto, sobrescribir juntas `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.

1. Instalar y configurar la conexión privada:
   ```sh
   npm ci
   npm run setup
   ```
   Pegar la URI de **Supabase > Connect > Session pooler (5432)** con la contraseña real, codificada como componente de URL. El asistente guarda `.env`, excluido de Git, y completa `DATABASE_URL`, `DIRECT_URL` y el esquema `app`. No pegar esta conexión en React ni Android. La contraseña PostgreSQL no es la clave publishable y no se puede recuperar mediante el conector usado para preparar el proyecto.
2. Validar y generar el cliente:
   ```sh
   npm ci
   npm run db:validate
   npm run db:generate
   ```
3. **Este proyecto ya fue preparado el 25/09/2026** con el SQL exacto de `20260924225329_supabase_prisma`. En esa base, registrar una sola vez la migración aplicada:
   ```sh
   npm run db:baseline
   npm run db:deploy
   ```
   `db:baseline` no crea tablas: registra en Prisma la migración ya ejecutada. No usarlo sobre una base vacía o distinta. Para un proyecto nuevo, omitir baseline y aplicar la migración:
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
