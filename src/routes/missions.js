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
const fields = z.object({
  title: text,
  description: z.string().max(20000).default(""),
  reward: z.string().max(1000).default(""),
  rewardXp: nonnegative.default(0),
  rewardGold: nonnegative.default(0),
  difficulty: z.enum(["easy", "medium", "hard", "deadly"]).default("medium"),
});
const include = { assignments: true };
const map = ({ assignments, ...m }) => ({
  ...m,
  assignedTo: assignments.map((a) => a.playerId),
  acceptedBy: assignments.filter((a) => a.acceptedAt).map((a) => a.playerId),
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
        (
          await db.mission.findMany({
            where: { campaignId, campaign: visibleCampaign(req.user.id) },
            include,
            orderBy: { createdAt: "desc" },
          })
        ).map(map),
      );
    }),
  );
  router.get(
    "/:id",
    route(async (req, res) => {
      await resourceAccess(db, "mission", req.params.id, req.user.id);
      const m = await db.mission.findUnique({
        where: { id: req.params.id },
        include,
      });
      if (!m) fail(404, "Misión no encontrada");
      res.json(map(m));
    }),
  );
  router.post(
    "/",
    route(async (req, res) => {
      const data = fields.extend({ campaignId: uuid }).strict().parse(req.body);
      const m = await transaction(db, async (tx) => {
        await campaignAccess(tx, data.campaignId, req.user.id, true);
        return tx.mission.create({ data, include });
      });
      res.status(201).json(map(m));
    }),
  );
  router.put(
    "/:id",
    route(async (req, res) => {
      const data = fields.partial().strict().parse(req.body);
      res.json(
        map(
          await transaction(db, async (tx) => {
            const m = await resourceAccess(
              tx,
              "mission",
              req.params.id,
              req.user.id,
              true,
            );
            if (m.status === "completed")
              fail(409, "La misión ya está completada");
            return tx.mission.update({ where: { id: m.id }, data, include });
          }),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    route(async (req, res) => {
      await transaction(db, async (tx) => {
        await resourceAccess(tx, "mission", req.params.id, req.user.id, true);
        await tx.mission.delete({ where: { id: req.params.id } });
      });
      res.json({ message: "Misión eliminada" });
    }),
  );
  router.post(
    "/:id/assign",
    route(async (req, res) => {
      const { playerId } = z
        .object({ playerId: uuid })
        .strict()
        .parse(req.body);
      res.json(
        map(
          await transaction(db, async (tx) => {
            const m = await resourceAccess(
              tx,
              "mission",
              req.params.id,
              req.user.id,
              true,
            );
            if (m.status === "completed")
              fail(409, "La misión ya está completada");
            if (
              !(await tx.campaignPlayer.findUnique({
                where: {
                  campaignId_playerId: { campaignId: m.campaignId, playerId },
                },
              }))
            )
              fail(400, "El jugador no pertenece a la campaña");
            await tx.missionAssignment.upsert({
              where: { missionId_playerId: { missionId: m.id, playerId } },
              create: { missionId: m.id, playerId },
              update: {},
            });
            return tx.mission.findUnique({ where: { id: m.id }, include });
          }),
        ),
      );
    }),
  );
  router.post(
    "/:id/accept",
    route(async (req, res) => {
      res.json(
        map(
          await transaction(db, async (tx) => {
            const m = await resourceAccess(
              tx,
              "mission",
              req.params.id,
              req.user.id,
            );
            const playerId = req.user.id;
            const key = { missionId_playerId: { missionId: m.id, playerId } };
            if (
              !(await tx.campaignPlayer.findUnique({
                where: {
                  campaignId_playerId: { campaignId: m.campaignId, playerId },
                },
              }))
            )
              fail(403, "Solo los jugadores participantes pueden aceptar");
            if (m.status === "completed")
              fail(409, "La misión ya está completada");
            const assignment = await tx.missionAssignment.findUnique({
              where: key,
            });
            if (!assignment)
              fail(403, "La misión no está asignada a este jugador");
            if (!assignment.acceptedAt)
              await tx.missionAssignment.update({
                where: key,
                data: { acceptedAt: new Date() },
              });
            return tx.mission.update({
              where: { id: m.id },
              data: { status: "active" },
              include,
            });
          }),
        ),
      );
    }),
  );
  router.post(
    "/:id/complete",
    route(async (req, res) => {
      res.json(
        map(
          await transaction(db, async (tx) => {
            const m = await resourceAccess(
              tx,
              "mission",
              req.params.id,
              req.user.id,
              true,
            );
            return tx.mission.update({
              where: { id: m.id },
              data: { status: "completed" },
              include,
            });
          }),
        ),
      );
    }),
  );
  return router;
};
