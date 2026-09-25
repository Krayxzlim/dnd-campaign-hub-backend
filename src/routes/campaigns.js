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
const fields = z
  .object({
    name: text,
    description: z.string().max(20000).default(""),
    image: z.string().max(500).default("🗺️"),
    status: z.enum(["active", "completed", "archived"]).default("active"),
  })
  .strict();
const include = { _count: { select: { players: true, missions: true } } };
const map = ({ _count, ...c }) => ({
  ...c,
  playerCount: _count?.players || 0,
  missionCount: _count?.missions || 0,
});
module.exports = ({ db, auth }) => {
  const router = Router();
  router.use(auth);
  router.get(
    "/",
    route(async (req, res) =>
      res.json(
        (
          await db.campaign.findMany({
            where: visibleCampaign(req.user.id),
            include,
            orderBy: { createdAt: "desc" },
          })
        ).map(map),
      ),
    ),
  );
  router.get(
    "/:id",
    route(async (req, res) => {
      await campaignAccess(db, req.params.id, req.user.id);
      const c = await db.campaign.findUnique({
        where: { id: req.params.id },
        include: {
          ...include,
          players: {
            include: {
              player: { select: { id: true, username: true, avatar: true } },
            },
          },
        },
      });
      if (!c) fail(404, "Campaña no encontrada");
      res.json({ ...map(c), players: c.players.map((p) => p.player) });
    }),
  );
  router.post(
    "/",
    route(async (req, res) => {
      res
        .status(201)
        .json(
          map(
            await db.campaign.create({
              data: { ...fields.parse(req.body), dmId: req.user.id },
              include,
            }),
          ),
        );
    }),
  );
  router.put(
    "/:id",
    route(async (req, res) => {
      const data = fields.partial().parse(req.body);
      res.json(
        await transaction(db, async (tx) => {
          await campaignAccess(tx, req.params.id, req.user.id, true);
          return map(
            await tx.campaign.update({
              where: { id: req.params.id },
              data,
              include,
            }),
          );
        }),
      );
    }),
  );
  router.delete(
    "/:id",
    route(async (req, res) => {
      await transaction(db, async (tx) => {
        await campaignAccess(tx, req.params.id, req.user.id, true);
        await tx.campaign.delete({ where: { id: req.params.id } });
      });
      res.json({ message: "Campaña eliminada" });
    }),
  );
  router.post(
    "/:id/players",
    route(async (req, res) => {
      const { playerId } = z
        .object({ playerId: uuid })
        .strict()
        .parse(req.body);
      await transaction(db, async (tx) => {
        await campaignAccess(tx, req.params.id, req.user.id, true);
        if (playerId === req.user.id)
          fail(400, "El propietario ya participa como DM");
        if (!(await tx.user.findUnique({ where: { id: playerId } })))
          fail(404, "Jugador no encontrado");
        await tx.campaignPlayer.create({
          data: { campaignId: req.params.id, playerId },
        });
      });
      res.status(201).json({ message: "Jugador añadido" });
    }),
  );
  router.delete(
    "/:id/players/:pid",
    route(async (req, res) => {
      uuid.parse(req.params.pid);
      await transaction(db, async (tx) => {
        await campaignAccess(tx, req.params.id, req.user.id, true);
        await tx.missionAssignment.deleteMany({
          where: {
            playerId: req.params.pid,
            mission: { campaignId: req.params.id },
          },
        });
        await tx.character.updateMany({
          where: { ownerId: req.params.pid, campaignId: req.params.id },
          data: { campaignId: null },
        });
        const removed = await tx.campaignPlayer.deleteMany({
          where: { campaignId: req.params.id, playerId: req.params.pid },
        });
        if (!removed.count) fail(404, "Participante no encontrado");
      });
      res.json({ message: "Jugador removido" });
    }),
  );
  return router;
};
