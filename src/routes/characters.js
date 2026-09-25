const { Router } = require("express");
const { z } = require("zod");
const {
  route,
  uuid,
  text,
  fail,
  visibleCampaign,
  campaignAccess,
  transaction,
} = require("../lib/http");
const ability = z.number().int().min(1).max(30).default(10);
const fields = z
  .object({
    name: text,
    race: z.string().trim().min(1).max(80),
    characterClass: z.string().trim().min(1).max(80),
    level: z.number().int().min(1).max(20).default(1),
    alignment: z.string().max(100).default(""),
    strength: ability,
    dexterity: ability,
    constitution: ability,
    intelligence: ability,
    wisdom: ability,
    charisma: ability,
    campaignId: uuid.nullable().optional(),
  })
  .strict();
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
        await db.character.findMany({
          where: campaignId
            ? { campaignId, campaign: visibleCampaign(req.user.id) }
            : { ownerId: req.user.id },
          orderBy: { createdAt: "desc" },
        }),
      );
    }),
  );
  router.post(
    "/",
    route(async (req, res) => {
      const data = fields.parse(req.body);
      res.status(201).json(
        await transaction(db, async (tx) => {
          if (data.campaignId)
            await campaignAccess(tx, data.campaignId, req.user.id);
          return tx.character.create({
            data: { ...data, ownerId: req.user.id },
          });
        }),
      );
    }),
  );
  router.put(
    "/:id",
    route(async (req, res) => {
      const id = uuid.parse(req.params.id),
        data = fields.partial().parse(req.body);
      res.json(
        await transaction(db, async (tx) => {
          if (
            !(await tx.character.findFirst({
              where: { id, ownerId: req.user.id },
            }))
          )
            fail(404, "Personaje no encontrado");
          if (data.campaignId)
            await campaignAccess(tx, data.campaignId, req.user.id);
          return tx.character.update({ where: { id }, data });
        }),
      );
    }),
  );
  router.delete(
    "/:id",
    route(async (req, res) => {
      const result = await db.character.deleteMany({
        where: { id: uuid.parse(req.params.id), ownerId: req.user.id },
      });
      if (!result.count) fail(404, "Personaje no encontrado");
      res.json({ message: "Personaje eliminado" });
    }),
  );
  return router;
};
