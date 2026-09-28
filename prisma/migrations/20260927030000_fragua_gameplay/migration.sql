-- AlterTable
ALTER TABLE "app"."personajes" ADD COLUMN     "datos_juego" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "version_estado" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "app"."comandos_personaje" (
    "id" UUID NOT NULL,
    "personaje_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comandos_personaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."secciones_notas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secciones_notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."notas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "seccion_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "strokes" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comandos_personaje_personaje_id_creado_en_idx" ON "app"."comandos_personaje"("personaje_id", "creado_en");

-- CreateIndex
CREATE INDEX "secciones_notas_usuario_id_idx" ON "app"."secciones_notas"("usuario_id");

-- CreateIndex
CREATE INDEX "notas_usuario_id_seccion_id_idx" ON "app"."notas"("usuario_id", "seccion_id");

-- AddForeignKey
ALTER TABLE "app"."comandos_personaje" ADD CONSTRAINT "comandos_personaje_personaje_id_fkey" FOREIGN KEY ("personaje_id") REFERENCES "app"."personajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."secciones_notas" ADD CONSTRAINT "secciones_notas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "app"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."notas" ADD CONSTRAINT "notas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "app"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."notas" ADD CONSTRAINT "notas_seccion_id_fkey" FOREIGN KEY ("seccion_id") REFERENCES "app"."secciones_notas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE app.comandos_personaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.secciones_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.notas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.comandos_personaje, app.secciones_notas, app.notas FROM anon, authenticated;
ALTER TABLE app.personajes ADD CONSTRAINT version_estado_nonnegative CHECK (version_estado >= 0);
