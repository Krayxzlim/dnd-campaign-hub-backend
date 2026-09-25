const { z } = require("zod");
const route = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(160);
const nonnegative = z.number().int().min(0).max(100000000);
const visibleCampaign = (userId) => ({
  OR: [{ dmId: userId }, { players: { some: { playerId: userId } } }],
});
async function campaignAccess(db, id, userId, write = false) {
  uuid.parse(id);
  const campaign = await db.campaign.findFirst({
    where: { id, ...(write ? { dmId: userId } : visibleCampaign(userId)) },
  });
  if (!campaign) fail(404, "Campaña no encontrada o sin acceso");
  return campaign;
}
async function resourceAccess(db, model, id, userId, write = false) {
  uuid.parse(id);
  const resource = await db[model].findFirst({
    where: { id, campaign: write ? { dmId: userId } : visibleCampaign(userId) },
  });
  if (!resource) fail(404, "Recurso no encontrado o sin acceso");
  return resource;
}
// Retry only serialization/deadlock conflicts; all business reads and writes share the transaction.
async function transaction(db, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error.code !== "P2034" || attempt >= 2) throw error;
    }
  }
}
module.exports = {
  route,
  fail,
  uuid,
  text,
  nonnegative,
  visibleCampaign,
  campaignAccess,
  resourceAccess,
  transaction,
};
