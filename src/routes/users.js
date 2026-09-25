const { Router } = require("express");
const { z } = require("zod");
const { route, visibleCampaign } = require("../lib/http");
const select = { id: true, username: true, avatar: true };
module.exports = ({ db, auth }) => {
  const router = Router();
  router.use(auth);
  router.get(
    "/",
    route(async (req, res) => {
      // Only oneself and people in shared campaigns; never expose the global account directory.
      res.json(
        await db.user.findMany({
          where: {
            OR: [
              { id: req.user.id },
              {
                memberships: {
                  some: { campaign: visibleCampaign(req.user.id) },
                },
              },
              {
                campaigns: {
                  some: { players: { some: { playerId: req.user.id } } },
                },
              },
            ],
          },
          select,
          orderBy: { username: "asc" },
        }),
      );
    }),
  );
  router.get(
    "/players",
    route(async (req, res) => {
      const email = z
        .string()
        .email()
        .max(254)
        .parse(req.query.email)
        .toLowerCase();
      // Exact email lookup supports adding known players, without publishing emails or roles.
      const player = await db.user.findUnique({ where: { email }, select });
      res.json(player && player.id !== req.user.id ? [player] : []);
    }),
  );
  // A DM can remove campaign membership, never delete another Supabase identity.
  return router;
};
