const { Router } = require("express");
const { z } = require("zod");
const {
  route,
  uuid,
  text,
  nonnegative,
  fail,
  visibleCampaign,
  campaignAccess,
  resourceAccess,
  transaction,
} = require("../lib/http");
// The nested monster shape remains compatible with the existing combat UI.
const monster = z
  .object({
    slug: text,
    nombre: text,
    cantidad: z.number().int().min(1).max(100),
    hp_max: z.number().int().min(1).max(100000),
    hp_actual: z.array(nonnegative).max(100),
    ca: nonnegative,
    cr: z.string().max(20),
    xp_unidad: nonnegative,
  })
  .passthrough()
  .refine(
    (m) =>
      m.hp_actual.length === m.cantidad &&
      m.hp_actual.every((hp) => hp <= m.hp_max),
    "HP/cantidad inválidos",
  );
const monsters = z.array(monster).max(100);
const initiative = z
  .array(
    z
      .object({
        id: text,
        name: text,
        hp: nonnegative,
        maxHp: nonnegative,
        initiative: z.number().int().min(-100).max(100),
      })
      .passthrough(),
  )
  .max(10000);
const fields = z.object({
  name: text,
  description: z.string().max(20000).default(""),
  monsters: monsters.default([]),
  xpTotal: nonnegative.default(0),
  estimatedDifficulty: z.string().max(80).default(""),
});
module.exports = ({ db, auth }) => {
  const router = Router();
  router.use(auth);
  router.get(
    "/",
    route(async (req, res) => {
      const campaignId = req.query.campaignId
        ? uuid.parse(req.query.campaignId)
        : undefined;
      if (campaignId) await campaignAccess(db, campaignId, req.user.id);
      res.json(
        await db.encounter.findMany({
          where: { campaignId, campaign: visibleCampaign(req.user.id) },
          orderBy: { createdAt: "desc" },
        }),
      );
    }),
  );
  router.get(
    "/:id",
    route(async (req, res) =>
      res.json(
        await resourceAccess(db, "encounter", req.params.id, req.user.id),
      ),
    ),
  );
  router.post(
    "/",
    route(async (req, res) => {
      const data = fields.extend({ campaignId: uuid }).strict().parse(req.body);
      res.status(201).json(
        await transaction(db, async (tx) => {
          await campaignAccess(tx, data.campaignId, req.user.id, true);
          return tx.encounter.create({ data });
        }),
      );
    }),
  );
  const mutate = (fn) =>
    route(async (req, res) =>
      res.json(
        await transaction(db, async (tx) => {
          const encounter = await resourceAccess(
            tx,
            "encounter",
            req.params.id,
            req.user.id,
            true,
          );
          return fn(tx, encounter, req);
        }),
      ),
    );
  router.put(
    "/:id",
    mutate((tx, e, req) =>
      tx.encounter.update({
        where: { id: e.id },
        data: fields.partial().strict().parse(req.body),
      }),
    ),
  );
  router.post(
    "/:id/start",
    mutate((tx, e) => {
      if (e.status !== "pending") fail(409, "El encuentro ya fue iniciado");
      const initiativeOrder = e.monsters
        .flatMap((m, group) =>
          Array.from({ length: m.cantidad }, (_, i) => ({
            id: `${m.slug}-${group}-${i}`,
            name: m.cantidad > 1 ? `${m.nombre} ${i + 1}` : m.nombre,
            monsterId: m.slug,
            instanceIndex: i,
            initiative: Math.floor(Math.random() * 20) + 1,
            hp: m.hp_actual[i],
            maxHp: m.hp_max,
            ac: m.ca,
            isPlayer: false,
          })),
        )
        .sort((a, b) => b.initiative - a.initiative);
      return tx.encounter.update({
        where: { id: e.id },
        data: { status: "active", round: 1, initiativeOrder },
      });
    }),
  );
  router.patch(
    "/:id/damage",
    mutate((tx, e, req) => {
      if (e.status !== "active") fail(409, "El encuentro no está activo");
      const data = z
        .object({ monsters, initiativeOrder: initiative })
        .strict()
        .parse(req.body);
      return tx.encounter.update({ where: { id: e.id }, data });
    }),
  );
  router.post(
    "/:id/nextround",
    mutate((tx, e) => {
      if (e.status !== "active") fail(409, "El encuentro no está activo");
      return tx.encounter.update({
        where: { id: e.id },
        data: { round: { increment: 1 } },
      });
    }),
  );
  router.post(
    "/:id/end",
    mutate((tx, e) => {
      if (e.status === "pending") fail(409, "El encuentro no fue iniciado");
      return tx.encounter.update({
        where: { id: e.id },
        data: { status: "completed" },
      });
    }),
  );
  router.delete(
    "/:id",
    route(async (req, res) => {
      await transaction(db, async (tx) => {
        await resourceAccess(tx, "encounter", req.params.id, req.user.id, true);
        await tx.encounter.delete({ where: { id: req.params.id } });
      });
      res.json({ message: "Encuentro eliminado" });
    }),
  );
  return router;
};
