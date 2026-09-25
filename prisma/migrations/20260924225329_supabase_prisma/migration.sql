-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateTable
CREATE TABLE "app"."usuarios" (
    "id" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '⚔️',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."campanas" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "dm_id" UUID NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'active',
    "imagen" TEXT NOT NULL DEFAULT '🗺️',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."campana_jugadores" (
    "campana_id" UUID NOT NULL,
    "jugador_id" UUID NOT NULL,

    CONSTRAINT "campana_jugadores_pkey" PRIMARY KEY ("campana_id","jugador_id")
);

-- CreateTable
CREATE TABLE "app"."misiones" (
    "id" UUID NOT NULL,
    "campana_id" UUID NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'available',
    "recompensa" TEXT NOT NULL DEFAULT '',
    "recompensa_xp" INTEGER NOT NULL DEFAULT 0,
    "recompensa_oro" INTEGER NOT NULL DEFAULT 0,
    "dificultad" TEXT NOT NULL DEFAULT 'medium',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "misiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."mision_asignados" (
    "mision_id" UUID NOT NULL,
    "jugador_id" UUID NOT NULL,
    "aceptada_en" TIMESTAMPTZ(3),

    CONSTRAINT "mision_asignados_pkey" PRIMARY KEY ("mision_id","jugador_id")
);

-- CreateTable
CREATE TABLE "app"."encuentros" (
    "id" UUID NOT NULL,
    "campana_id" UUID NOT NULL,
    "nombre" VARCHAR(160) NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'pending',
    "monstruos" JSONB NOT NULL DEFAULT '[]',
    "orden_iniciativa" JSONB NOT NULL DEFAULT '[]',
    "ronda" INTEGER NOT NULL DEFAULT 0,
    "xp_total" INTEGER NOT NULL DEFAULT 0,
    "dificultad_est" TEXT NOT NULL DEFAULT '',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encuentros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."personajes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "campana_id" UUID,
    "nombre" VARCHAR(160) NOT NULL,
    "raza" VARCHAR(80) NOT NULL,
    "clase" VARCHAR(80) NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "alineacion" TEXT NOT NULL DEFAULT '',
    "fue" INTEGER NOT NULL DEFAULT 10,
    "des" INTEGER NOT NULL DEFAULT 10,
    "con" INTEGER NOT NULL DEFAULT 10,
    "int" INTEGER NOT NULL DEFAULT 10,
    "sab" INTEGER NOT NULL DEFAULT 10,
    "car" INTEGER NOT NULL DEFAULT 10,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "app"."usuarios"("email");

-- CreateIndex
CREATE INDEX "campanas_dm_id_idx" ON "app"."campanas"("dm_id");

-- CreateIndex
CREATE INDEX "campana_jugadores_jugador_id_idx" ON "app"."campana_jugadores"("jugador_id");

-- CreateIndex
CREATE INDEX "misiones_campana_id_estado_idx" ON "app"."misiones"("campana_id", "estado");

-- CreateIndex
CREATE INDEX "mision_asignados_jugador_id_idx" ON "app"."mision_asignados"("jugador_id");

-- CreateIndex
CREATE INDEX "encuentros_campana_id_idx" ON "app"."encuentros"("campana_id");

-- CreateIndex
CREATE INDEX "personajes_usuario_id_idx" ON "app"."personajes"("usuario_id");

-- CreateIndex
CREATE INDEX "personajes_campana_id_idx" ON "app"."personajes"("campana_id");

-- AddForeignKey
ALTER TABLE "app"."campanas" ADD CONSTRAINT "campanas_dm_id_fkey" FOREIGN KEY ("dm_id") REFERENCES "app"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campana_jugadores" ADD CONSTRAINT "campana_jugadores_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "app"."campanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."campana_jugadores" ADD CONSTRAINT "campana_jugadores_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "app"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."misiones" ADD CONSTRAINT "misiones_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "app"."campanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."mision_asignados" ADD CONSTRAINT "mision_asignados_mision_id_fkey" FOREIGN KEY ("mision_id") REFERENCES "app"."misiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."mision_asignados" ADD CONSTRAINT "mision_asignados_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "app"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."encuentros" ADD CONSTRAINT "encuentros_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "app"."campanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."personajes" ADD CONSTRAINT "personajes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "app"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."personajes" ADD CONSTRAINT "personajes_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "app"."campanas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Auth is managed externally. Never migrate or seed auth.users with Prisma.
ALTER TABLE app.usuarios ADD CONSTRAINT usuarios_auth_user_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE app.campanas ADD CONSTRAINT campanas_estado_check CHECK (estado IN ('active','completed','archived'));
ALTER TABLE app.misiones ADD CONSTRAINT misiones_estado_check CHECK (estado IN ('available','active','completed'));
ALTER TABLE app.misiones ADD CONSTRAINT misiones_dificultad_check CHECK (dificultad IN ('easy','medium','hard','deadly'));
ALTER TABLE app.misiones ADD CONSTRAINT misiones_recompensas_check CHECK (recompensa_xp >= 0 AND recompensa_oro >= 0);
ALTER TABLE app.encuentros ADD CONSTRAINT encuentros_estado_check CHECK (estado IN ('pending','active','completed'));
ALTER TABLE app.encuentros ADD CONSTRAINT encuentros_numeros_check CHECK (ronda >= 0 AND xp_total >= 0);
ALTER TABLE app.personajes ADD CONSTRAINT personajes_nivel_check CHECK (nivel BETWEEN 1 AND 20);
ALTER TABLE app.personajes ADD CONSTRAINT personajes_atributos_check CHECK (
  fue BETWEEN 1 AND 30 AND des BETWEEN 1 AND 30 AND con BETWEEN 1 AND 30 AND
  int BETWEEN 1 AND 30 AND sab BETWEEN 1 AND 30 AND car BETWEEN 1 AND 30);

-- The Express backend owns authorization. app is NOT an exposed Data API schema.
REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC, anon, authenticated;
ALTER TABLE app.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.campana_jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.misiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.mision_asignados ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.encuentros ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.personajes ENABLE ROW LEVEL SECURITY;
