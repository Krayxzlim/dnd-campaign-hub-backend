const { Router } = require("express");
const { route } = require("../lib/http");
module.exports = ({ db, auth }) => {
  const router = Router();
  router.get(
    "/me",
    auth,
    route(async (req, res) => {
      const ownsCampaign = await db.campaign.count({
        where: { dmId: req.user.id },
      });
      res.json({ ...req.user, role: ownsCampaign ? "dm" : "player" });
    }),
  );
  // Registration, login, logout and refresh are handled by Supabase Auth in the clients.
  return router;
};
