const { Router } = require("express");
const { z } = require("zod");
const { route, uuid, fail, transaction } = require("../lib/http");
const { note, section } = require("../game/schema");
module.exports = ({ db, auth }) => {
  const r = Router();
  r.use(auth);
  r.get(
    "/",
    route(async (req, res) => {
      const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(10000)
        .parse(req.query.page || 1);
      const notes = await db.note.findMany({
        where: { ownerId: req.user.id },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 50,
        take: 51,
        select: {
          id: true,
          title: true,
          sectionId: true,
          version: true,
          updatedAt: true,
        },
      });
      res.json({
        sections: await db.noteSection.findMany({
          where: { ownerId: req.user.id },
          orderBy: [{ order: "asc" }, { id: "asc" }],
        }),
        notes: notes.slice(0, 50),
        page,
        hasMore: notes.length > 50,
      });
    }),
  );
  r.get(
    "/notes/:id",
    route(async (req, res) => {
      const found = await db.note.findFirst({
        where: { id: uuid.parse(req.params.id), ownerId: req.user.id },
      });
      if (!found) fail(404, "Nota no encontrada");
      res.json(found);
    }),
  );
  r.put(
    "/sections/:id",
    route(async (req, res) => {
      const data = section.parse({ ...req.body, id: req.params.id });
      res.json(
        await transaction(db, async (tx) => {
          const current = await tx.noteSection.findUnique({
            where: { id: data.id },
          });
          if (current && current.ownerId !== req.user.id)
            fail(404, "Sección no encontrada");
          return tx.noteSection.upsert({
            where: { id: data.id },
            create: { ...data, ownerId: req.user.id },
            update: { name: data.name, order: data.order },
          });
        }),
      );
    }),
  );
  r.delete(
    "/sections/:id",
    route(async (req, res) => {
      const count = await db.note.count({
        where: { sectionId: uuid.parse(req.params.id), ownerId: req.user.id },
      });
      if (count)
        fail(409, "Mové o eliminá las notas antes de borrar la sección.");
      const d = await db.noteSection.deleteMany({
        where: { id: req.params.id, ownerId: req.user.id },
      });
      if (!d.count) fail(404, "Sección no encontrada");
      res.json({ ok: true });
    }),
  );
  r.put(
    "/notes/:id",
    route(async (req, res) => {
      const id = uuid.parse(req.params.id);
      const input = z
        .object({ expectedVersion: z.number().int().min(-1), note })
        .strict()
        .parse(req.body);
      res.json(
        await transaction(db, async (tx) => {
          if (
            !(await tx.noteSection.findFirst({
              where: { id: input.note.sectionId, ownerId: req.user.id },
            }))
          )
            fail(404, "Sección no encontrada");
          const current = await tx.note.findUnique({ where: { id } });
          if (current && current.ownerId !== req.user.id)
            fail(404, "Nota no encontrada");
          if (
            current &&
            current.version === input.expectedVersion + 1 &&
            current.title === input.note.title &&
            current.text === input.note.text &&
            current.sectionId === input.note.sectionId &&
            require("node:util").isDeepStrictEqual(
              current.strokes,
              input.note.strokes,
            )
          )
            return current;
          if ((current?.version ?? -1) !== input.expectedVersion)
            fail(409, "La nota cambió; conservá tu texto y recargá.");
          return current
            ? tx.note.update({
                where: { id, version: input.expectedVersion },
                data: { ...input.note, version: { increment: 1 } },
              })
            : tx.note.create({
                data: { id, ownerId: req.user.id, ...input.note },
              });
        }),
      );
    }),
  );
  r.delete(
    "/notes/:id",
    route(async (req, res) => {
      const version = z.coerce.number().int().min(0).parse(req.query.version);
      const count = await db.note.deleteMany({
        where: { id: uuid.parse(req.params.id), ownerId: req.user.id, version },
      });
      if (!count.count) fail(409, "La nota cambió o ya no está disponible.");
      res.json({ ok: true });
    }),
  );
  return r;
};
