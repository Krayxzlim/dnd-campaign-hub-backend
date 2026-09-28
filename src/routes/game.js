const { Router } = require("express");
const { createHash } = require("node:crypto");
const { route, uuid, fail, transaction } = require("../lib/http");
const rules = require("../game/rules");
const schema = require("../game/schema");
function canonical(value) {
  return JSON.stringify(value, function (k, v) {
    return v && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v)
          .sort()
          .reduce((a, key) => ((a[key] = v[key]), a), {})
      : v;
  });
}
module.exports = ({ db, auth }) => {
  const r = Router();
  r.use(auth);
  const owned = async (tx, id, user) => {
    const c = await tx.character.findFirst({
      where: { id: uuid.parse(id), ownerId: user },
    });
    if (!c) fail(404, "Personaje no encontrado");
    return c;
  };
  r.get(
    "/:id/sheet",
    route(async (req, res) => {
      const c = await db.character.findFirst({
        where: {
          id: uuid.parse(req.params.id),
          OR: [{ ownerId: req.user.id }, { campaign: { dmId: req.user.id } }],
        },
      });
      if (!c) fail(404, "Personaje no encontrado");
      res.json(rules.sheet(c));
    }),
  );
  r.get(
    "/:id/commands",
    route(async (req, res) => {
      await owned(db, req.params.id, req.user.id);
      const rows = await db.characterCommand.findMany({
        where: { characterId: req.params.id, actorId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, createdAt: true, result: true },
      });
      res.json(
        rows.map((x) => ({
          id: x.id,
          createdAt: x.createdAt,
          type: x.result.type,
          result: x.result.result,
        })),
      );
    }),
  );
  r.get(
    "/:id/commands/:commandId",
    route(async (req, res) => {
      await owned(db, req.params.id, req.user.id);
      const found = await db.characterCommand.findFirst({
        where: {
          id: uuid.parse(req.params.commandId),
          characterId: req.params.id,
          actorId: req.user.id,
        },
      });
      if (!found) fail(404, "Operación no encontrada");
      res.json(found.result);
    }),
  );
  r.post(
    "/:id/commands",
    route(async (req, res) => {
      const e = schema.envelope.parse(req.body),
        op = schema.operation.parse(e),
        hash = createHash("sha256")
          .update(canonical({ characterId: req.params.id, ...e }))
          .digest("hex");
      const output = await transaction(db, async (tx) => {
        const c = await owned(tx, req.params.id, req.user.id);
        const prior = await tx.characterCommand.findUnique({
          where: { id: e.commandId },
        });
        if (prior) {
          if (
            prior.actorId !== req.user.id ||
            prior.characterId !== c.id ||
            prior.payloadHash !== hash
          )
            fail(409, "El identificador ya fue usado con otra operación.");
          return prior.result;
        }
        if (c.stateVersion !== e.expectedVersion)
          fail(409, "La ficha cambió. Actualizá y revisá la operación.");
        const change = rules.apply(c, op);
        const update = await tx.character.updateMany({
          where: { id: c.id, stateVersion: e.expectedVersion },
          data: { gameData: change.state, stateVersion: { increment: 1 } },
        });
        if (update.count !== 1) fail(409, "La ficha cambió.");
        const output = {
          commandId: e.commandId,
          type: e.type,
          sheet: rules.sheet({
            ...c,
            gameData: change.state,
            stateVersion: c.stateVersion + 1,
          }),
          result: change.result,
        };
        await tx.characterCommand.create({
          data: {
            id: e.commandId,
            characterId: c.id,
            actorId: req.user.id,
            payloadHash: hash,
            result: output,
          },
        });
        return output;
      });
      res.json(output);
    }),
  );
  return r;
};
